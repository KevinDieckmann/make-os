// ─── Körper-Profil je Person — Server (08.10. abends, Fragebogen Teil 3, Frage 2) ─────────────────────────────────────
// Lesen und Schreiben des Bestands `gesundheit-koerper` (Erstkonto) bzw. `gesundheit-koerper--<person>` (speicherFuer).
// Wer welche Person anfragen darf, entscheidet allein die Route (/api/gesundheit/koerper: nur die Person selbst). Hier gibt
// es deshalb keinen Personen-Parameter von außen — die Route reicht die Person der Sitzung durch.
// Stand = Fingerabdruck des gespeicherten Profils; ein veralteter Stand → 409 mit dem aktuellen Profil (zwei Geräte).

import { createHash } from 'crypto';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { speicherFuer } from '@/lib/zoe/raum';
import { koerperAnwenden, koerperSaeubern, koerperHatInhalt, KoerperFehler, type KoerperStand } from './koerper';

/** Stand des Profils (Fingerabdruck); ohne Bestand `leer`. */
export function koerperFingerabdruck(k: KoerperStand | null): string {
  return k ? createHash('sha256').update(JSON.stringify(k)).digest('hex').slice(0, 20) : 'leer';
}

/** Das eigene Profil der Person — oder null, wenn sie noch keins angelegt hat. Liest nur, schreibt nie. */
export async function koerperLaden(person: string): Promise<{ koerper: KoerperStand | null; stand: string }> {
  const koerper = koerperSaeubern(await loadJson<unknown>(speicherFuer('gesundheit-koerper', person)));
  return { koerper, stand: koerperFingerabdruck(koerper) };
}

export type KoerperAenderung =
  | { ok: true; koerper: KoerperStand; stand: string }
  | { ok: false; status: 400 | 404 | 409 | 413; fehler: string; koerper?: KoerperStand | null; stand?: string };

class StandVeraltet extends Error { constructor(readonly koerper: KoerperStand | null, readonly stand: string) { super('Stand veraltet'); } }

/**
 * Schritte auf das eigene Profil anwenden — in EINER Sperre, nur wenn `basisStand` zum gespeicherten Stand passt.
 * Wirft ein Schritt, wird nichts geschrieben (updateJson schreibt bei einem Fehler nicht).
 */
export async function koerperAendern(person: string, basisStand: unknown, ops: unknown, jetzt = new Date().toISOString()): Promise<KoerperAenderung> {
  try {
    const roh = await updateJson<unknown>(speicherFuer('gesundheit-koerper', person), cur => {
      const alt = koerperSaeubern(cur);
      const stand = koerperFingerabdruck(alt);
      if (basisStand !== stand) throw new StandVeraltet(alt, stand);
      const neu = koerperAnwenden(alt, ops);
      return { ...neu, geaendert: jetzt };
    });
    const koerper = koerperSaeubern(roh)!;
    return { ok: true, koerper, stand: koerperFingerabdruck(koerper) };
  } catch (e) {
    if (e instanceof StandVeraltet) return { ok: false, status: 409, fehler: 'Das Profil wurde inzwischen geändert (anderes Gerät?) — neu geladen, bitte noch einmal.', koerper: e.koerper, stand: e.stand };
    if (e instanceof KoerperFehler) return { ok: false, status: e.status, fehler: e.message };
    throw e;
  }
}

/**
 * Einmalige Übernahme eines vorbereiteten Profils (nur lib/altbestand/uebernahme.ts): schreibt NUR, wenn die Person noch
 * kein Profil mit Inhalt hat und noch keine Übernahme-Marke trägt. Nie über vorhandene Daten.
 */
export async function koerperAltbestandSetzen(person: string, inhalt: KoerperStand, tag: string): Promise<'uebernommen' | 'schon-uebernommen' | 'ziel-belegt'> {
  let ergebnis: 'uebernommen' | 'schon-uebernommen' | 'ziel-belegt' = 'uebernommen';
  await updateJson<unknown>(speicherFuer('gesundheit-koerper', person), cur => {
    const alt = koerperSaeubern(cur);
    if (alt?.altbestand) { ergebnis = 'schon-uebernommen'; return cur; }
    // Belegt = irgendein gepflegter Wert (auch nur eine Einstellung) — die Person hat dann selbst angefangen.
    if (alt && (koerperHatInhalt(alt) || alt.symptom || alt.sauberZaehler || alt.routinenHinweise.length)) { ergebnis = 'ziel-belegt'; return cur; }
    return { ...koerperSaeubern(inhalt)!, altbestand: tag, geaendert: new Date().toISOString() };
  });
  return ergebnis;
}
