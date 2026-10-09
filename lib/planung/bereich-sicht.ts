// ─── Planung: Privat-Bereich für Konten „nur Business“ ausblenden (rein, 09.10., E4-Rest — Kevin: „Ja, Privates bleibt privat“) ────────
// Gegenstück zu lib/aufgaben/bereich-sicht.ts für Routinen, Blöcke der Wochenvorlage, Ziele (alle Horizonte, Fokus-Sätze) und Meilensteine.
// Ob ausgeblendet wird, entscheidet NUR die Konto-Sicht (lib/zugang/konto-sicht.ts `privatAusblenden` bzw. Server
// `privatAusgeblendetFuer`) — hier steht nur, WAS privat ist. Der Bereich kommt IMMER aus den vorhandenen Regeln (lib/planung/bereich.ts
// `wirksamerSpace`: eine Privat-Einheit wie die Selbstständigkeit ist Privat), nie aus `space` direkt:
//   · Routine     — `spaceVonRoutine` (ohne Angabe Privat, Privat-Einheit → Privat).
//   · Block       — `art` mit Einheit über `wirksamerSpace` (Arbeit der Selbstständigkeit ist als `business` + Einheit gespeichert → Privat).
//   · Ziel        — `wirksamerSpace` (ohne Angabe Business — dieselbe Regel wie Lichtfäden, Jahresziele, Wochenvorschlag).
//   · Meilenstein — `meilensteinSpace` (Altfeld `bereich: gesundheit` → Privat).
//   · Fokus-Satz  — nur Schlüssel `business:…` sind Business; der gemeinsame Satz (ohne Präfix, z. B. „jahr“, „prio:…“) gilt für beide
//                   Bereiche und ist darum im Zweifel privat (wie der Stapel: „im Zweifel privat“).
// Geschrieben wird darauf ebenso wenig: Vorhandenes im Privat-Bereich gibt es nicht (404, `PLANUNG_NICHT_GEFUNDEN`), Neues/Verschobenes
// dorthin → 403 (`NUR_BUSINESS_PRIVAT`). Vollschreiben (Altwege PUT) behält die ausgeblendeten Einträge in ihrer gespeicherten Fassung.
// Wächter: tests/konto-sicht-planung.test.ts, tests/messlatte-malin.test.ts (Partner).

import { NUR_BUSINESS_PRIVAT } from '@/lib/zugang/konto-sicht';
import { wirksamerSpace } from './bereich';
import { spaceVonRoutine } from './routinen';
import { meilensteinSpace } from './meilensteine';
import { ZIEL_HORIZONTE, type Block, type Routine, type Ziel, type ZieleDatei } from './typen';

export { NUR_BUSINESS_PRIVAT };

/** Antwort (404), wenn ein Konto „nur Business“ einen vorhandenen Eintrag im Privat-Bereich ändern oder löschen will — es gibt ihn für es nicht. */
export const PLANUNG_NICHT_GEFUNDEN = 'Diesen Eintrag gibt es nicht (mehr). Nichts gespeichert.';

/** HTTP-Status zu den beiden Sätzen (sonst null — die Route entscheidet selbst). */
export function privatStatus(fehler: string | null | undefined): 403 | 404 | null {
  return fehler === PLANUNG_NICHT_GEFUNDEN ? 404 : fehler === NUR_BUSINESS_PRIVAT ? 403 : null;
}

export const routineImPrivat = (r: Pick<Routine, 'space' | 'einheit'>): boolean => spaceVonRoutine(r) === 'privat';
export const blockImPrivat = (b: Pick<Block, 'art' | 'einheit'>): boolean => (wirksamerSpace({ space: b.art, einheit: b.einheit }) ?? 'privat') === 'privat';
export const zielImPrivat = (z: Pick<Ziel, 'space' | 'einheit'>): boolean => wirksamerSpace(z) === 'privat';
export const meilensteinImPrivat = (m: { space?: unknown; bereich?: unknown; einheit?: unknown }): boolean => meilensteinSpace(m) === 'privat';
/** Fokus-Schlüssel im Privat-Bereich: alles außer `business:…` (der gemeinsame Satz ist im Zweifel privat). */
export const fokusSchluesselImPrivat = (schluessel: string): boolean => !schluessel.startsWith('business:');

export const routinenOhnePrivat = <R extends Pick<Routine, 'space' | 'einheit'>>(l: readonly R[]): R[] => l.filter(r => !routineImPrivat(r));
export const bloeckeOhnePrivat = <B extends Pick<Block, 'art' | 'einheit'>>(l: readonly B[]): B[] => l.filter(b => !blockImPrivat(b));
export const zieleOhnePrivat = <Z extends Pick<Ziel, 'space' | 'einheit'>>(l: readonly Z[]): Z[] => l.filter(z => !zielImPrivat(z));
export const meilensteineOhnePrivat = <M extends { space?: unknown; bereich?: unknown; einheit?: unknown }>(l: readonly M[]): M[] => l.filter(m => !meilensteinImPrivat(m));

/** Fokus-Sätze ohne den Privat-Bereich (nur `business:…`). */
export function fokusOhnePrivat(f: Record<string, string> | null | undefined): Record<string, string> {
  return Object.fromEntries(Object.entries(f ?? {}).filter(([k]) => !fokusSchluesselImPrivat(k)));
}

/** Der Ziele-Bestand (alle Horizonte + Fokus) ohne den Privat-Bereich (rein; dieselben Objekte, damit Stände gleich bleiben). */
export function zieleDateiOhnePrivat<D extends Partial<ZieleDatei>>(d: D): D {
  const aus = { ...d } as D & Record<string, unknown>;
  for (const h of ZIEL_HORIZONTE) if (Array.isArray(d[h])) (aus as Record<string, unknown>)[h] = zieleOhnePrivat(d[h] as Ziel[]);
  if (d.fokus && typeof d.fokus === 'object') (aus as Record<string, unknown>).fokus = fokusOhnePrivat(d.fokus);
  return aus;
}

/** Form einer Listen-Änderung (wie `ListenOp` aus lib/store/patch-liste — hier ohne Server-Import). */
export interface PlanOp<E> { op: 'upsert' | 'delete' | 'teil'; eintrag?: E; id?: string; felder?: Record<string, unknown> }

/**
 * In der Sperre (PATCH): berührt eine Änderung den Privat-Bereich? Vorhandener Eintrag im Privat-Bereich → `PLANUNG_NICHT_GEFUNDEN`
 * (es gibt ihn für das Konto nicht — lesen, ändern, löschen), ein neuer bzw. ein geänderter Eintrag, der danach im Privat-Bereich läge
 * (`upsert` oder `teil` mit Space/Einheit/Art) → `NUR_BUSINESS_PRIVAT`. Sonst null. `teilAnwenden` = derselbe Säuberer wie der Schreibweg.
 */
export function privatSchreibPruefen<E extends { id: string }>(
  liste: readonly E[], ops: readonly PlanOp<E>[], imPrivat: (e: E) => boolean, teilAnwenden?: (alt: E, felder: Record<string, unknown>) => E | null,
): string | null {
  const nachId = new Map(liste.map(e => [e.id, e]));
  for (const o of ops) {
    const id = o.op === 'upsert' ? o.eintrag?.id : o.id;
    const alt = id ? nachId.get(id) : undefined;
    if (alt && imPrivat(alt)) return PLANUNG_NICHT_GEFUNDEN;
    if (o.op === 'upsert' && o.eintrag && imPrivat(o.eintrag)) return NUR_BUSINESS_PRIVAT;
    if (o.op === 'teil' && alt && o.felder) {
      const neu = teilAnwenden ? teilAnwenden(alt, o.felder) : ({ ...alt, ...o.felder } as E);
      if (neu && imPrivat(neu)) return NUR_BUSINESS_PRIVAT;
    }
  }
  return null;
}

/**
 * Vollschreiben (Altwege PUT): die ausgeblendeten Einträge des Privat-Bereichs bleiben in ihrer gespeicherten Fassung stehen — das Konto
 * kennt sie nicht und schickt sie darum nie mit. Nennt der Körper einen davon (Kennung) → `PLANUNG_NICHT_GEFUNDEN`, einen neuen im
 * Privat-Bereich → `NUR_BUSINESS_PRIVAT`. Sonst die Liste = Körper + die gespeicherten Privat-Einträge (hinten angehängt).
 */
export function privatBehalten<E extends { id: string }>(gespeichert: readonly E[], neu: readonly E[], imPrivat: (e: E) => boolean): { liste: E[] } | { fehler: string } {
  const privat = gespeichert.filter(imPrivat);
  const privatIds = new Set(privat.map(e => e.id));
  for (const e of neu) {
    if (privatIds.has(e.id)) return { fehler: PLANUNG_NICHT_GEFUNDEN };
    if (imPrivat(e)) return { fehler: NUR_BUSINESS_PRIVAT };
  }
  return { liste: [...neu, ...privat] };
}

/** Konflikt-Antworten (409) ohne Einträge des Privat-Bereichs: deren `aktuell` fällt weg (zur Sicherheit — die Prüfung oben greift vorher). */
export function konflikteOhnePrivat<K extends { aktuell?: unknown }>(konflikte: readonly K[], imPrivat: (e: never) => boolean): K[] {
  return konflikte.map(k => (k.aktuell && imPrivat(k.aktuell as never) ? (({ aktuell: _a, ...rest }) => rest as K)(k) : k));
}
