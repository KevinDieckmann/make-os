// ─── Wann läuft der Head of Finance? ────────────────────────────────────────
// Der Code wählt den Modus, nicht das Modell (Anthropic: Routing statt
// Agenten-Entscheidung, wo die Schritte vorhersehbar sind). Pro Takt höchstens
// ein Lauf, der wichtigste zuerst: Monatsabschluss > Steuercheck >
// Wochenreview > Tagescheck. Ein gescheiterter Versuch sperrt eine Stunde.

import type { Modus } from './prompt';
import type { ChefStand } from './stand';
import { werktag } from './steuertermine';
import { tageZwischen, monatPlus } from '../haushalt/monat';
import { tagVon } from '@/lib/zeit';

/** Der n-te Werktag des Monats (JJJJ-MM-TT) — n ≥ 1. */
export function nterWerktag(monat: string, n: number): string {
  let d = werktag(`${monat}-01`);
  for (let i = 0; i < Math.max(1, Math.round(n)) - 1; i++) {
    const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + 1);
    d = werktag(x.toISOString().slice(0, 10));
  }
  return d;
}
/** Dritter Werktag des Monats (JJJJ-MM-TT) — die Vorgabe des Fensters. */
export const dritterWerktag = (monat: string): string => nterWerktag(monat, 3);
/** Fenster des Monatsabschlusses (Vorgabe = bis 22.10. fest: ab dem 3. Werktag bis zum 20.) — Stellschraube `abschlussFenster` (lib/prozesse/stellschrauben-werte.ts). */
export const ABSCHLUSS_FENSTER_VORGABE = { abWerktag: 3, bisTag: 20 } as const;

/** Berliner Tag eines Zeitstempels (09.10., Takt robust) — nie `.slice(0, 10)` (UTC-Tag). */
const tag = (iso?: string) => (iso ? tagVon(iso) : undefined);

export function faelligerModus(s: ChefStand, heute: string, wochentag: number, stunde: number, termine: { datum: string }[], jetzt: Date = new Date(), fenster: { abWerktag: number; bisTag: number } = ABSCHLUSS_FENSTER_VORGABE): { modus: Modus; grund: string; monat?: string } | null {
  if (stunde < 8 || stunde >= 21) return null;
  // Läuft gerade ein Modus (Versuch ohne Abschluss, jünger als 15 Minuten)? Dann
  // nichts Weiteres — sonst plant der nächste Takt den nächstwichtigen Modus
  // parallel (gesehen am 24.09.: Monatsabschluss und Wochenreview gleichzeitig).
  const laeuft = (Object.entries(s.versuche) as [Modus, string | undefined][]).some(([m, v]) => v && jetzt.getTime() - Date.parse(v) < 15 * 60_000 && (!s.letzte[m] || Date.parse(s.letzte[m]!) < Date.parse(v)));
  if (laeuft) return null;
  const gesperrt = (m: Modus) => { const v = s.versuche[m]; return !!v && jetzt.getTime() - Date.parse(v) < 60 * 60_000 && (!s.letzte[m] || Date.parse(s.letzte[m]!) < Date.parse(v)); };
  const vormonat = monatPlus(heute.slice(0, 7), -1);
  const abgeschlossen = s.berichte.some(b => b.modus === 'monatsabschluss' && b.monat === vormonat);
  // Fenster: vom 3. Werktag bis zum 20. — später ist ein Abschluss des Vormonats kalter Kaffee. Seit 22.10. einstellbar (Stellschraube `fenster`).
  if (heute >= nterWerktag(heute.slice(0, 7), fenster.abWerktag) && Number(heute.slice(8, 10)) <= fenster.bisTag && !abgeschlossen && !gesperrt('monatsabschluss')) return { modus: 'monatsabschluss', grund: `Monatsabschluss ${vormonat} steht aus`, monat: vormonat };
  const bald = termine.find(t => t.datum >= heute && tageZwischen(heute, t.datum) <= 14);
  const letzterSteuer = tag(s.letzte.steuercheck);
  if (bald && (!letzterSteuer || tageZwischen(letzterSteuer, heute) >= 7) && !gesperrt('steuercheck')) return { modus: 'steuercheck', grund: `Steuertermin am ${bald.datum}` };
  const letzteWoche = tag(s.letzte.wochenreview);
  const seitWoche = letzteWoche ? tageZwischen(letzteWoche, heute) : Infinity;
  if (((wochentag === 1 && seitWoche >= 5) || seitWoche >= 8) && !gesperrt('wochenreview')) return { modus: 'wochenreview', grund: letzteWoche ? `letzter Wochenreview am ${letzteWoche}` : 'noch kein Wochenreview' };
  // Ein größerer Lauf heute ersetzt den Tagescheck.
  const heuteSchon = (['tagescheck', 'wochenreview', 'monatsabschluss', 'steuercheck'] as Modus[]).some(m => tag(s.letzte[m]) === heute);
  if (!heuteSchon && !gesperrt('tagescheck')) return { modus: 'tagescheck', grund: 'heute noch kein Tagescheck' };
  return null;
}
