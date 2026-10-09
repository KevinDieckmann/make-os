// ─── Agenten-Bereich: die EINE Filterstelle (09.10., Paket 1 „Kern“; AGENTEN_KONZEPT.md C5) ─────────────────────────────
// Wer welche Heads, Threads und Kategorien sieht — rein und getestet (tests/agenten-sicht.test.ts). Jede Route und jeder Lauf
// des Agenten-Bereichs fragt NUR hier; die Oberfläche blendet nie bloß aus (Plattform-Regel: Trennung serverseitig).
//
//   Konto                          Business-Heads   Privat-Heads (Ebene Person)   Familie (Ebene Haushalt)
//   volles Haushaltsmitglied       ja               die eigenen                   ja
//   `finanzRecht: 'business'`      ja               nein                          nein
//   fremder Haushalt / Testkunde   nein (403)       nein                          nein
//   Dienstweg ohne Person          — (die Routen lehnen vorher ab)
//
// Voraussetzungen: Gesundheit nur mit Einwilligung (a)+(b) der Person selbst (nur eigene Werte); Finanzen privat nur mit
// privatem Finanzzugang (Haushalt des Inhabers, ohne „nur Business“). Business-Heads tragen nie die Kategorie Gesundheit.
// Threads gehören dem Besitzer; per Knopf teilbar sind nur Business-Threads — dann lesen sie alle im Haushalt des Inhabers,
// die den Head sehen. Privat-Threads werden nie geteilt.

import { headDef, KATALOG } from './katalog';
import type { AgentRef, Faden, HeadDef, KiKategorie } from './typen';
import type { KontoSicht as ZentraleKontoSicht } from '@/lib/zugang/konto-sicht';

/**
 * Was die Filterstelle über das anfragende Konto wissen muss — seit 09.10. (E4) die EINE Konto-Sicht (lib/zugang/konto-sicht.ts), geladen
 * auf dem Server (`sichtLaden` → `kontoSichtLaden`). Hier nur der Ausschnitt, den der Agenten-Bereich liest: Person, im Haushalt, volles
 * Mitglied (nur dann Privat-Heads), privater Finanzzugang, Gesundheits-Einwilligung (a)/(b) der Person selbst.
 */
export type KontoSicht = Pick<ZentraleKontoSicht, 'person' | 'imHaushalt' | 'vollesMitglied' | 'privatFinanzen' | 'gesundheit'>;

/** Ein Thread mit den Feldern, die nur der Kern kennt (geteilt) — siehe faeden.ts. */
type FadenSicht = Pick<Faden, 'besitzer' | 'agent' | 'bereich'> & { geteilt?: { am: string; von: string } | null };

/** Head-Kennung eines Agenten (ZOE hat keinen). */
export const headVon = (a: AgentRef): string | null => (a.art === 'zoe' ? null : a.headId);

/** Erfüllt das Konto die Voraussetzung des Heads? */
function voraussetzungErfuellt(h: HeadDef, k: KontoSicht): boolean {
  switch (h.voraussetzung) {
    case 'gesundheit-ki': return k.gesundheit.verarbeiten && k.gesundheit.ki;
    case 'privat-finanzen': return k.privatFinanzen;
    // Module ohne Lizenz-Prüfung: bis dahin gilt das Haushalts-Tor (lib/zugang/routen-register.ts › modul:<name>).
    case 'modul:markttraktion': return k.imHaushalt;
    default: return true;
  }
}

/** Sieht dieses Konto den Head? (Liste UND direkter Aufruf — eine Regel.) */
export function headSichtbar(k: KontoSicht | null | undefined, headId: string): boolean {
  if (!k || !k.imHaushalt) return false;
  const h = headDef(headId);
  if (!h) return false;
  if (h.bereich === 'privat' && !k.vollesMitglied) return false;
  return voraussetzungErfuellt(h, k);
}

/** Die Heads, die das Konto sieht — Reihenfolge wie im Katalog. */
export function headsFuer(k: KontoSicht | null | undefined): HeadDef[] {
  return KATALOG.filter(h => headSichtbar(k, h.id));
}

/**
 * Die KI-Kategorien, die ein Head für dieses Konto trägt: die eigenen + `kategorienMitEinwilligung` nur mit (a)+(b).
 * Business nie Gesundheit (auch wenn ein Katalog-Fehler es versuchte).
 */
export function kategorienFuer(h: HeadDef, k: KontoSicht): KiKategorie[] {
  const mitEinwilligung = k.gesundheit.verarbeiten && k.gesundheit.ki ? h.kategorienMitEinwilligung ?? [] : [];
  const alle = Array.from(new Set<KiKategorie>([...h.kategorien, ...mitEinwilligung]));
  return h.bereich === 'business' ? alle.filter(x => x !== 'gesundheit') : alle;
}

/**
 * Sieht `k` diesen Thread? Der Besitzer sieht ihn, solange er den Head sieht (Rechte ändern sich — die Sicht folgt dem heutigen
 * Konto, der Export nach Art. 15 bleibt davon unberührt). Andere nur einen GETEILTEN Business-Thread, wenn sie den Head sehen.
 */
export function fadenSichtbar(f: FadenSicht | null | undefined, k: KontoSicht | null | undefined): boolean {
  if (!f || !k || !k.imHaushalt) return false;
  const headId = headVon(f.agent);
  const headOk = headId === null ? true : headSichtbar(k, headId);
  if (f.besitzer === k.person) return headOk;
  if (!f.geteilt || f.bereich !== 'business' || headId === null) return false;
  return headOk && headDef(headId)?.bereich === 'business';
}

/** Darf `person` den Thread teilen bzw. das Teilen aufheben? Nur der Besitzer, nur Business-Threads eines Heads. */
export function teilenErlaubt(f: FadenSicht, person: string): boolean {
  const headId = headVon(f.agent);
  return f.besitzer === person && f.bereich === 'business' && headId !== null && headDef(headId)?.bereich === 'business';
}

/** Schreiben (Nachricht, Umbenennen, Löschen, Lauf) — nur der Besitzer. Geteilt heißt: lesen. */
export const fadenSchreibbar = (f: Pick<Faden, 'besitzer'>, person: string): boolean => f.besitzer === person;
