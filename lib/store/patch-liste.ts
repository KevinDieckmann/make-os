// ─── MAKE OS — Einzel-Änderungen an Listen-Beständen ────────────────────────
// Das Zwei-Fenster-Fundament als gemeinsamer Baustein. Vorher hat jede Route
// dasselbe Muster einzeln ausgeschrieben — jetzt einmal hier, sauber geprüft:
//
//   • ein Fenster schickt nur, was es selbst geändert hat
//   • updateJson führt die Schreibvorgänge serialisiert aus, zwei
//     gleichzeitige Klicks gehen beide durch
//   • gegen Massenlöschung ist gesichert: mehr als die halbe Liste auf einmal
//     zu löschen ist nie eine Absicht, sondern ein Client mit halbem Stand
//
// Die Route liefert nur ihre eigene Säuberungs-Funktion — die Regeln bleiben
// dort, wo der Bestand definiert ist.

import { updateJson } from './local-db';
import { zaehle } from './messwerte';
import { fingerabdruck } from './fingerabdruck';
import { protokolliere, feldDiff, type Aenderung, type Wer } from './aenderungsprotokoll';

/**
 * Eine Änderung: ganzer Eintrag (`upsert`), nur Felder (`teil`, 27.09.) oder `delete`.
 * `stand` ist der Fingerabdruck, den der Browser bekam — stimmt er nicht mehr mit
 * dem gespeicherten überein, hat inzwischen jemand geändert: 409, nichts überschrieben.
 */
export interface ListenOp<E> { op: 'upsert' | 'delete' | 'teil'; eintrag?: E; id?: string; felder?: Record<string, unknown>; stand?: string }
export interface Konflikt { id: string; grund: 'inzwischen geändert' | 'inzwischen gelöscht' | 'unbekannt'; aktuell?: unknown }

export interface PatchErgebnis<T> {
  ok: boolean;
  angewandt: number;
  next?: T;
  fehler?: string;
  /** 409: welche Zeilen inzwischen anders sind — mit dem aktuellen Datensatz zum Abgleich. */
  konflikte?: Konflikt[];
  /** Neue Fingerabdrücke der geschriebenen Zeilen — der Browser trägt sie an seinem Stand nach. */
  zeilen?: { id: string; stand: string }[];
}

export interface PatchOptionen<E, T = Record<string, unknown>> {
  /** Neuen Eintrag mit dem aktuellen Serverstand vereinen (z. B. anhängende Logs nie verlieren). */
  vereinen?: (neu: E, alt: E) => E;
  /** `teil`: Felder auf den aktuellen Eintrag legen und prüfen — null, wenn das Ergebnis ungültig wäre. */
  teil?: (alt: E, felder: Record<string, unknown>) => E | null;
  /** `upsert` ohne Altstand (neu angelegt): den Eintrag vor dem Speichern noch einmal anfassen (z. B. Herkunft je Feld setzen, 27.09.). */
  neu?: (eintrag: E) => E;
  /** Läuft INNERHALB der Sperre über der aktuellen Liste — ein Text lehnt die ganze Änderung ab (Massen-Wache). */
  pruefen?: (liste: E[], ops: ListenOp<E>[]) => string | null;
  /** Läuft INNERHALB der Sperre nach einer erfolgreichen Änderung über dem ganzen Bestand (z. B. die Ziel-Kaskade, 28.09.). */
  danach?: (bestand: T) => T;
  /** Wer schreibt — fürs Änderungsprotokoll (28.09., K1 #44). Fehlt es, gilt die laufende Anfrage (next/headers). */
  wer?: Wer;
}

/**
 * Warum eine Änderungsliste abgelehnt wird — oder null. Mehr als `grenze` Änderungen auf einmal werden
 * ABGELEHNT, nie still gekürzt (28.09., K1: vorher fielen alle ab der 201. still weg, der Aufrufer hielt sie
 * für gespeichert).
 */
export function opsFehler(roh: unknown, grenze = 200): string | null {
  if (!Array.isArray(roh)) return 'ops muss eine Liste sein.';
  if (roh.length > grenze) { zaehle('413'); return `Abgelehnt: ${roh.length} Änderungen auf einmal — höchstens ${grenze}. Nichts gespeichert; bitte in Teilen schicken.`; }
  return null;
}

/** Rohe Änderungen aus dem Netz in geprüfte Änderungen übersetzen — null, wenn `opsFehler` etwas findet. */
export function opsLesen<E extends { id: string }>(
  roh: unknown,
  saeubern: (e: unknown) => E | null,
  grenze = 200,
): ListenOp<E>[] | null {
  if (opsFehler(roh, grenze) || !Array.isArray(roh)) return null;
  const ops: ListenOp<E>[] = [];
  const liste = roh as Record<string, unknown>[];
  const stand = (o: Record<string, unknown>) => (typeof o.stand === 'string' && o.stand ? { stand: o.stand } : {});
  for (let i = 0; i < liste.length; i++) {
    const o = liste[i];
    if (o?.op === 'delete' && typeof o.id === 'string') ops.push({ op: 'delete', id: o.id, ...stand(o) });
    else if (o?.op === 'upsert' && o.eintrag) {
      const e = saeubern(o.eintrag);
      // Der Stand darf auch im Eintrag stehen (der Browser schickt den Datensatz zurück, wie er ihn bekam).
      const s = stand(o).stand ?? (typeof (o.eintrag as { stand?: unknown }).stand === 'string' ? String((o.eintrag as { stand?: string }).stand) : undefined);
      if (e) ops.push({ op: 'upsert', eintrag: e, ...(s ? { stand: s } : {}) });
    } else if (o?.op === 'teil' && typeof o.id === 'string' && o.felder && typeof o.felder === 'object') {
      ops.push({ op: 'teil', id: o.id, felder: o.felder as Record<string, unknown>, ...stand(o) });
    }
  }
  return ops;
}

/**
 * Änderungen auf eine benannte Liste in einem Bestand anwenden.
 *
 * @param name    Bestand (Dateiname ohne .json)
 * @param feld    Feld im Bestand, das die Liste hält
 * @param ops     geprüfte Änderungen
 * @param abZahl  ab wie vielen Einträgen der Massenlösch-Schutz greift
 */
export async function listePatchen<E extends { id: string }, T extends Record<string, unknown>>(
  name: string,
  feld: keyof T & string,
  ops: ListenOp<E>[],
  abZahl = 10,
  /** Optional: neuen Eintrag mit dem aktuellen Serverstand vereinen (z. B. anhängende Logs nie verlieren). */
  vereinen?: (neu: E, alt: E) => E,
  opt: PatchOptionen<E, T> = {},
): Promise<PatchErgebnis<T>> {
  if (!ops.length) return { ok: false, angewandt: 0, fehler: 'Keine gültigen Änderungen.' };
  const vereine = opt.vereinen ?? vereinen;

  // Alles INNERHALB der Sperre (Stufe 2): Massenlösch-Schutz, Massen-Wache, Stand-Prüfung und die Änderung selbst
  // sehen denselben Bestand — vorher lag das Lesen davor, und zwei gleichzeitige Anfragen prüften einen Stand, den es
  // beim Schreiben nicht mehr gab.
  let angewandt = 0;
  let fehler: string | undefined;
  const konflikte: Konflikt[] = [];
  const zeilen: { id: string; stand: string }[] = [];
  /** Fürs Änderungsprotokoll: Kennung + Feldnamen, nie Werte (28.09., K1 #44). */
  let aenderungen: Aenderung[] = [];
  const next = await updateJson<T>(name, current => {
    aenderungen = [];
    const f = (current ?? {}) as T;
    const liste = (Array.isArray(f[feld]) ? f[feld] : []) as E[];
    const loeschungen = ops.filter(o => o.op === 'delete').length;
    if (liste.length >= abZahl && loeschungen > liste.length / 2) { fehler = `Abgelehnt: das hätte über die Hälfte von ${feld} gelöscht.`; return f; }
    const grund = opt.pruefen?.(liste, ops);
    if (grund) { fehler = grund; return f; }

    const nachId = new Map(liste.map(x => [x.id, x]));
    const abdruck = (e: E) => fingerabdruck(e as unknown as Record<string, unknown>);
    const passt = (o: ListenOp<E>, alt: E | undefined, id: string): boolean => {
      if (o.stand === undefined) return true; // ohne Stand: wie bisher (ZOE, Importe, alte Fenster)
      if (!alt) { konflikte.push({ id, grund: 'inzwischen gelöscht' }); return false; }
      if (abdruck(alt) !== o.stand) { konflikte.push({ id, grund: 'inzwischen geändert', aktuell: alt }); return false; }
      return true;
    };
    const neuListe = new Map(nachId);
    for (const o of ops) {
      if (o.op === 'delete') {
        const alt = nachId.get(o.id!);
        if (!passt(o, alt, o.id!)) continue;
        if (neuListe.delete(o.id!)) { angewandt++; aenderungen.push({ op: 'geloescht', id: o.id! }); }
      } else if (o.op === 'teil') {
        const alt = nachId.get(o.id!);
        if (!alt) { konflikte.push({ id: o.id!, grund: o.stand === undefined ? 'unbekannt' : 'inzwischen gelöscht' }); continue; }
        if (!passt(o, alt, o.id!)) continue;
        const neu = opt.teil ? opt.teil(alt, o.felder ?? {}) : ({ ...alt, ...(o.felder ?? {}) } as E);
        if (!neu) { konflikte.push({ id: o.id!, grund: 'unbekannt' }); continue; }
        const fertig = vereine ? vereine(neu, alt) : neu;
        neuListe.set(o.id!, fertig); zeilen.push({ id: o.id!, stand: abdruck(fertig) }); angewandt++;
        const felder = feldDiff(alt as unknown as Record<string, unknown>, fertig as unknown as Record<string, unknown>);
        if (felder.length) aenderungen.push({ op: 'geaendert', id: o.id!, felder });
      } else {
        const id = o.eintrag!.id;
        const alt = nachId.get(id);
        if (!passt(o, alt, id)) continue;
        const fertig = alt ? (vereine ? vereine(o.eintrag!, alt) : o.eintrag!) : (opt.neu ? opt.neu(o.eintrag!) : o.eintrag!);
        neuListe.set(id, fertig); zeilen.push({ id, stand: abdruck(fertig) }); angewandt++;
        if (!alt) aenderungen.push({ op: 'neu', id });
        else { const felder = feldDiff(alt as unknown as Record<string, unknown>, fertig as unknown as Record<string, unknown>); if (felder.length) aenderungen.push({ op: 'geaendert', id, felder }); }
      }
    }
    // Ein Konflikt lehnt die ganze Änderung ab — halbe Stände sind schlimmer als eine Nachfrage.
    if (konflikte.length) { angewandt = 0; return f; }
    const fertig = { ...f, [feld]: Array.from(neuListe.values()) } as T;
    return opt.danach ? opt.danach(fertig) : fertig;
  });

  if (fehler) return { ok: false, angewandt: 0, fehler };
  if (konflikte.length) zaehle('409'); // Messwert für den Head of IT (Paket D-A #87)
  if (konflikte.length) return { ok: false, angewandt: 0, fehler: 'Jemand hat inzwischen geändert — Stand neu geladen, bitte noch einmal.', konflikte };
  await protokolliere(name, aenderungen, opt.wer);
  return { ok: true, angewandt, next, zeilen };
}
