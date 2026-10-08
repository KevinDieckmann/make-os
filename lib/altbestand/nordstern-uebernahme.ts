// ─── Einmalige Übernahme des Altbestands: Nordstern (08.10. abends, Fragebogen Teil 3, Frage 2 — Paket A2) ────────────────
// WIRD MIT DEM ÜBERNÄCHSTEN UPLOAD GELÖSCHT — samt der Umgebungsvariable MAKE_OS_ALTBESTAND_PERSON
// (UPDATES.md › „08.10. abends — Fragebogen Teil 3“ › offene Einmal-Schritte). Eigene Datei neben lib/altbestand/uebernahme.ts
// (Paket A1, Körper-Profil) — gleiche Regeln, gleiche Variable; beide fliegen zusammen raus.
//
// Kevin: „Meine bisherigen Inhalte einmalig in meine Daten übernehmen, dann aus dem Code löschen.“ Bis 08.10. stand der Nordstern
// als Konstante im Code (lib/make-one/nordstern-data.ts, entfernt). Der Text liegt UNVERÄNDERT hier (aus dem Code hierher
// verschoben) und wird genau einmal in die Daten geschrieben — geteilt in zwei Teile:
//   · der gemeinsame Satz (alles vor „Persönliches Kernziel“) → Nordstern des Haushalts der Person (`nordstern--<haushalt>`,
//     lib/planung/nordstern-server.ts) — den lesen alle im Haushalt, auch Business-Konten;
//   · der persönliche Teil (danach) → ein EIGENES Jahresziel der Person (`ziele-eigen`, Bereich Privat) — nicht geteilt, andere
//     sehen es nur, wenn die Person ihre Ziele ausdrücklich teilt (lib/planung/eigene-ziele-sicht.ts).
//
// Regeln (Wächter tests/nordstern-uebernahme.test.ts, mit erfundenem Inhalt):
//   - Nur mit MAKE_OS_ALTBESTAND_PERSON = Speichername der Person (unser Server). Demo- und Kunden-Instanzen setzen die Variable
//     NIE → dort passiert nichts; mit MAKE_OS_DEMO=1 passiert auch mit Variable nichts. Die Person muss Inhaber mit Haushalt sein
//     (der Altbestand stammt aus dem Code des Inhabers — eine falsch gesetzte Variable legt nie etwas in ein fremdes Konto).
//   - Nur wenn das Ziel leer ist: kein Nordstern über einen schon gepflegten, kein Jahresziel doppelt; idempotent über die Marken
//     `altbestand` im Nordstern-Bestand (bleiben, auch wenn die Person das Ziel später löscht — es kommt nie zurück).
//   - Der persönliche Teil kann einen Gesundheitsbezug tragen → behandelt wie Art.-9-Daten: nur mit AUSDRÜCKLICH erklärter
//     Einwilligung (a) „verarbeiten“ der Person (System › Datenschutz; der stille Übergang für Bestands-Konten zählt hier nicht),
//     sonst übersprungen (Log ohne Inhalt) und beim nächsten Start erneut versucht.
//   - Log und Protokoll nennen nur Teil und Ergebnis, nie den Inhalt.
// Ausgelöst einmal nach dem Start (lib/store/betrieb.ts, nur wenn die Variable gesetzt ist). Server-Modul — nie im Browser.

import type { NordsternDatei } from '@/lib/planung/nordstern';
import type { ZieleDatei } from '@/lib/planung/typen';

export const ALTBESTAND_VARIABLE = 'MAKE_OS_ALTBESTAND_PERSON';
/** Feste Kennung des übernommenen persönlichen Jahresziels (idempotent). */
export const KERNZIEL_ID = 'z-altbestand-kernziel';
/** Trennstelle im bisherigen Text — eine Beschriftung, kein Inhalt. */
const PERSOENLICH_MARKE = 'Persönliches Kernziel';
const TITEL_MAX = 200;

export type TeilErgebnis = 'uebernommen' | 'schon-uebernommen' | 'ziel-belegt' | 'ohne-einwilligung' | 'leer' | 'fehler';
export interface NordsternUebernahmeBericht { lauf: boolean; grund?: string; teile: { name: 'nordstern' | 'kernziel'; ergebnis: TeilErgebnis }[] }

/** Den bisherigen Text teilen (rein): gemeinsamer Satz vor der Marke, persönlicher Teil danach (ohne die Marke und den Doppelpunkt). */
export function nordsternTeilen(text: string): { gemeinsam: string; persoenlich: string } {
  const t = String(text ?? '').trim();
  const i = t.indexOf(PERSOENLICH_MARKE);
  if (i < 0) return { gemeinsam: t, persoenlich: '' };
  return { gemeinsam: t.slice(0, i).trim(), persoenlich: t.slice(i + PERSOENLICH_MARKE.length).replace(/^\s*:\s*/, '').trim() };
}

/** Nur Längen des bisherigen Texts (für den Wächtertest — der Inhalt selbst verlässt das Modul nie). */
export function altbestandLaengen(): { gemeinsam: number; persoenlich: number } {
  const t = nordsternTeilen(ALTBESTAND_NORDSTERN);
  return { gemeinsam: t.gemeinsam.length, persoenlich: t.persoenlich.length };
}

/** Kontrollfluss in der Sperre: nichts schreiben. */
class Ohne extends Error { constructor(readonly ergebnis: Exclude<TeilErgebnis, 'uebernommen' | 'fehler' | 'ohne-einwilligung'>) { super(ergebnis); } }

const log = (teil: string, ergebnis: TeilErgebnis) => console.log(`[MAKE OS] Altbestand „${teil}“: ${ergebnis}.`);

/**
 * Die Übernahme. `inhalt` nur für Tests (erfundener Text) — ohne Angabe der bisherige Text unten. Die Person kommt IMMER aus der
 * Umgebungsvariable, nie aus einem Parameter. Wirft nie.
 */
export async function nordsternAltbestandUebernehmen(opts: { inhalt?: string; tag?: string; jahr?: number } = {}): Promise<NordsternUebernahmeBericht> {
  const person = (process.env[ALTBESTAND_VARIABLE] ?? '').trim();
  if (!person) return { lauf: false, grund: 'keine Variable', teile: [] };
  if (process.env.MAKE_OS_DEMO === '1') return { lauf: false, grund: 'Demo-Instanz', teile: [] };
  if (!/^[a-z0-9-]{1,40}$/.test(person)) { console.error('[MAKE OS] Altbestand Nordstern: Variable ungültig — nichts übernommen.'); return { lauf: false, grund: 'Variable ungültig', teile: [] }; }

  let haushalt: string;
  try {
    const { kontoFuerSpeicher } = await import('@/lib/zugang/konten');
    const { HAUSHALT_OK } = await import('@/lib/finanzen/haushalt/zugriff');
    const konto = await kontoFuerSpeicher(person);
    if (!konto) { console.error('[MAKE OS] Altbestand Nordstern: kein Konto zur Variable — nichts übernommen.'); return { lauf: false, grund: 'kein Konto', teile: [] }; }
    if (konto.rolle !== 'inhaber') { console.error('[MAKE OS] Altbestand Nordstern: die Variable nennt nicht den Inhaber — nichts übernommen.'); return { lauf: false, grund: 'nicht Inhaber', teile: [] }; }
    if (!konto.haushalt || !HAUSHALT_OK.test(konto.haushalt)) { console.error('[MAKE OS] Altbestand Nordstern: Konto ohne Haushalt — nichts übernommen.'); return { lauf: false, grund: 'kein Haushalt', teile: [] }; }
    haushalt = konto.haushalt;
  } catch {
    console.error('[MAKE OS] Altbestand Nordstern: Konten nicht lesbar — nichts übernommen (läuft beim nächsten Start erneut).');
    return { lauf: false, grund: 'Konten nicht lesbar', teile: [] };
  }

  const { localDay } = await import('@/lib/zeit');
  const tag = opts.tag ?? localDay();
  const jahr = opts.jahr ?? Number(tag.slice(0, 4));
  const { gemeinsam, persoenlich } = nordsternTeilen(opts.inhalt ?? ALTBESTAND_NORDSTERN);
  const { updateJson, loadJson } = await import('@/lib/store/local-db');
  const { protokolliere } = await import('@/lib/store/aenderungsprotokoll');
  const { nordsternName } = await import('@/lib/planung/nordstern-server');
  const { nordsternTextVon } = await import('@/lib/planung/nordstern');
  const name = nordsternName(haushalt);
  const bericht: NordsternUebernahmeBericht = { lauf: true, teile: [] };
  const merke = (teil: 'nordstern' | 'kernziel', ergebnis: TeilErgebnis) => { bericht.teile.push({ name: teil, ergebnis }); log(teil, ergebnis); };

  // 1) Gemeinsamer Satz → Nordstern des Haushalts (nur, wenn noch keiner gepflegt ist).
  // Die Marke wird IMMER gesetzt, sobald entschieden ist — auch bei „ziel-belegt“ (Haushalt pflegte schon einen) und „leer“:
  // leert der Haushalt ihn später bewusst, holt der nächste Start (täglich 04:30) den alten Text nie zurück (wie beim Kernziel).
  try {
    let ergebnis: TeilErgebnis = 'uebernommen';
    await updateJson<NordsternDatei>(name, cur => {
      if (cur?.altbestand?.nordstern) throw new Ohne('schon-uebernommen');
      const altbestand = { ...(cur?.altbestand ?? {}), nordstern: tag };
      if (nordsternTextVon(cur)) { ergebnis = 'ziel-belegt'; return { ...(cur ?? {}), altbestand }; }
      if (!gemeinsam) { ergebnis = 'leer'; return { ...(cur ?? {}), altbestand }; }
      ergebnis = 'uebernommen';
      return { ...(cur ?? {}), nordstern: { text: gemeinsam, geaendertAm: new Date().toISOString() }, altbestand };
    });
    if (ergebnis === 'uebernommen') await protokolliere(name, [{ op: 'geaendert', id: 'nordstern', felder: ['text'] }], { art: 'system' });
    merke('nordstern', ergebnis);
  } catch (e) {
    if (e instanceof Ohne) merke('nordstern', e.ergebnis);
    else { merke('nordstern', 'fehler'); console.error('[MAKE OS] Altbestand „nordstern“: Fehler —', e instanceof Error ? e.name : 'unbekannt'); }
  }

  // 2) Persönlicher Teil → eigenes Jahresziel der Person (Art.-9-Schranke: Einwilligung (a)).
  // Marke wie in Schritt 1, sobald entschieden ist (nur „ohne Einwilligung“ und Fehler versuchen es beim nächsten Start erneut).
  const kernzielMarke = () => updateJson<NordsternDatei>(name, cur => ({ ...(cur ?? {}), altbestand: { ...(cur?.altbestand ?? {}), kernziel: tag } }));
  try {
    if ((await loadJson<NordsternDatei>(name))?.altbestand?.kernziel) { merke('kernziel', 'schon-uebernommen'); return bericht; }
    if (!persoenlich) { await kernzielMarke(); merke('kernziel', 'leer'); return bericht; }
    // Ausdrücklich erklärte Einwilligung (a) — strenger als der Schreibweg-Übergang für Bestands-Konten ohne Erklärung
    // (`verarbeitungErlaubt`): Inhalte aus dem Code werden nur mit einer echten Erklärung der Person zu ihren Daten.
    const { gesundheitStandFuer } = await import('@/lib/datenschutz/gesundheit-einwilligung');
    if (!(await gesundheitStandFuer(person)).verarbeiten.an) {
      console.log('[MAKE OS] Altbestand „kernziel“: übersprungen — keine erklärte Einwilligung (a); wird beim nächsten Start erneut versucht.');
      bericht.teile.push({ name: 'kernziel', ergebnis: 'ohne-einwilligung' });
      return bericht;
    }
    const { speicherFuer } = await import('@/lib/zoe/raum');
    const { sauberZiel } = await import('@/lib/planung/ziele');
    const ziel = sauberZiel(persoenlich.length <= TITEL_MAX
      ? { id: KERNZIEL_ID, titel: persoenlich, fortschritt: 0, space: 'privat', jahr }
      : { id: KERNZIEL_ID, titel: PERSOENLICH_MARKE, notiz: persoenlich, fortschritt: 0, space: 'privat', jahr });
    if (!ziel) { await kernzielMarke(); merke('kernziel', 'leer'); return bericht; }
    const zieleName = speicherFuer('ziele-eigen', person);
    let ergebnis: TeilErgebnis = 'uebernommen';
    try {
      await updateJson<ZieleDatei>(zieleName, cur => {
        const liste = Array.isArray(cur?.jahr) ? cur!.jahr : [];
        if (liste.some(z => z.id === KERNZIEL_ID)) throw new Ohne('schon-uebernommen');
        if (liste.some(z => z.titel.trim() === ziel.titel.trim())) throw new Ohne('ziel-belegt');
        return { ...(cur ?? { tag: [], woche: [], monat: [], quartal: [], fokus: {} }), jahr: [...liste, ziel] } as ZieleDatei;
      });
      await protokolliere(zieleName, [{ op: 'neu', id: KERNZIEL_ID }], { art: 'system' });
    } catch (e) {
      if (!(e instanceof Ohne)) throw e;
      ergebnis = e.ergebnis;
    }
    // Marke setzen — auch wenn das Ziel schon da war (Abbruch zwischen den beiden Schreibungen) oder die Person es selbst schon
    // angelegt hatte: danach versucht es niemand mehr, ein späteres Löschen holt es nie zurück.
    await kernzielMarke();
    merke('kernziel', ergebnis);
  } catch (e) {
    merke('kernziel', 'fehler');
    console.error('[MAKE OS] Altbestand „kernziel“: Fehler —', e instanceof Error ? e.name : 'unbekannt');
  }
  return bericht;
}

// ── Der bisherige Text — UNVERÄNDERT aus lib/make-one/nordstern-data.ts hierher verschoben ──────────────────────────────────
// Nicht ändern, nicht woanders verwenden: er geht genau einmal in die Daten und wird dann mit diesem Modul gelöscht.
// (Die frühere Liste MILESTONES ist ersatzlos entfallen — veraltet; echte Meilensteine kommen aus dem Bestand.)
const ALTBESTAND_NORDSTERN =
  '1 Mio € Umsatz bei KD Ventures → daraus min. 300k € Gewinn für Kevin & Malin. Persönliches Kernziel: „mehr Ruhe" + Gesundheit in den Griff.';
