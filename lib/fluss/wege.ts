// ─── Überblick „Für dich“ — wohin ein Klick in die Linie führt (16.10., Abnahme 2 · B7, rein, client-sicher) ─────────
// Kevin: „Keine losen Enden — jede Grafik führt weiter, jede Zahl stimmt.“ Die Linie der FlussKarte (components/os/ui/fluss.tsx)
// ist je Periode anklickbar: Ist (Vergangenheit) und Prognose (ab heute) öffnen die Ansicht, in der genau diese Woche bzw. dieser
// Monat steht — Kalender an der Woche, Aufgaben-Modus des Kalenders, Buchungen des Monats, Liquidität … Ziele NUR über `WEG`
// bzw. die Adress-Bausteine der Bereiche (lib/kalender/modus.ts) — nie Pfade von Hand. Jeder Bereich aus FLUSS_BEREICHE hat
// einen Weg (Wächter tests/grafik-weiter.test.ts).

import { WEG } from '@/lib/wege';
import { kalenderLink } from '@/lib/kalender/modus';
import { FLUSS_FENSTER, type FlussBereich, type FlussRaster, type FlussReihe } from './modell';

export type FlussArt = 'ist' | 'prognose';

/** Eine anklickbare Periode der Linie: Beginn (Montag bzw. Monatserster), Lage 0–1 auf der Linie, Wert, Text. */
export interface FlussPeriode { art: FlussArt; start: string; x: number; wert: number; text: string }

const TAG_MS = 864e5;
const ms = (t: string) => Date.parse(`${t.slice(0, 10)}T12:00:00Z`);
const iso = (m: number) => new Date(m).toISOString().slice(0, 10);
const montag = (t: string) => { const m = ms(t); return m - ((new Date(m).getUTCDay() + 6) % 7) * TAG_MS; };
const monatErster = (t: string, plus: number) => { const d = new Date(`${t.slice(0, 7)}-01T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + plus); return iso(d.getTime()); };
const kurz = (t: string) => `${t.slice(8, 10)}.${t.slice(5, 7)}.`;
const MONATE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

/** Beginn der Periode `versatz` (0 = laufende, −1 = vorige, +1 = nächste) — Woche ab Montag, Monat ab dem Ersten. */
export function periodeStart(heute: string, raster: FlussRaster, versatz: number): string {
  return raster === 'woche' ? iso(montag(heute) + versatz * 7 * TAG_MS) : monatErster(heute, versatz);
}

/** Wie die Periode heißt („Woche ab 12.10.“, „Okt 2026“). */
export const periodeName = (start: string, raster: FlussRaster): string =>
  raster === 'woche' ? `Woche ab ${kurz(start)}` : `${MONATE[Number(start.slice(5, 7)) - 1]} ${start.slice(0, 4)}`;

/**
 * Die Perioden der Linie mit ihrer Lage (wie `flussPunkte`: Ist links bis HEUTE in der Mitte, Prognose ab HEUTE nach rechts).
 * Die laufende Periode steht EINMAL (als Ist bis heute) — die Prognose beginnt mit der nächsten.
 */
export function flussPerioden(f: Pick<FlussReihe, 'ist' | 'prognose' | 'raster' | 'heute' | 'istLabel' | 'prognoseLabel'>): FlussPeriode[] {
  const aus: FlussPeriode[] = [];
  const n = f.ist.length, p = f.prognose.length;
  f.ist.forEach((wert, k) => {
    const versatz = k - (n - 1);
    const start = periodeStart(f.heute, f.raster, versatz);
    aus.push({ art: 'ist', start, x: n < 2 ? 0.5 : (k / (n - 1)) * 0.5, wert, text: `${periodeName(start, f.raster)} · ${f.istLabel} ${zahl(wert)}` });
  });
  f.prognose.forEach((wert, k) => {
    if (k === 0 && n) return;
    const start = periodeStart(f.heute, f.raster, k);
    aus.push({ art: 'prognose', start, x: 0.5 + (p < 2 ? 0 : (k / (p - 1)) * 0.5), wert, text: `${periodeName(start, f.raster)} · ${f.prognoseLabel} ${zahl(wert)}` });
  });
  return aus;
}
const zahl = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',');

/**
 * Wohin ein Klick auf eine Periode führt — je Bereich die Ansicht, die genau diese Zeit zeigt. `space` nur, wo der Bereich ihn kennt
 * (Kalender, Aufgaben, Planung). Ein Weg für JEDEN Bereich (Record über FlussBereich — ein neuer Bereich ohne Weg baut nicht).
 */
const ZIELE: Record<FlussBereich, (p: { art: FlussArt; start: string; raster: FlussRaster; space?: 'privat' | 'business' | null }) => string> = {
  aufgaben: ({ start, space }) => kalenderLink({ modus: 'aufgaben', tag: start, ...(space ? { space } : {}) }),
  kalender: ({ start, space }) => kalenderLink({ tag: start, ...(space ? { space } : {}) }),
  planung: ({ start, space }) => kalenderLink({ modus: 'planen', tag: start, ...(space ? { space } : {}) }),
  inbox: () => WEG.inbox(),
  markttraktion: ({ art }) => (art === 'ist' ? WEG.kunden() : WEG.deals()),
  'finanzen-privat': ({ art, start }) => (art === 'ist' ? WEG.buchungen({ monat: start.slice(0, 7), privat: true }) : WEG.finanzplanung('privat', 'monat')),
  'finanzen-business': ({ art, start }) => (art === 'ist' ? WEG.buchungen({ monat: start.slice(0, 7) }) : WEG.liquiditaet()),
  gesundheit: () => WEG.sport('training'),
  familie: () => WEG.familie('wir'),
  netzwerken: ({ art }) => (art === 'ist' ? WEG.netzwerken() : WEG.followup('woche')),
};

export function flussPeriodeLink(bereich: FlussBereich, p: { art: FlussArt; start: string; raster: FlussRaster; space?: 'privat' | 'business' | null }): string {
  return ZIELE[bereich](p);
}

/** Für Tests: wie viele Perioden die Linie bei vollem Fenster zeigt (Ist + Prognose ohne die doppelte laufende). */
export const flussPeriodenAnzahl = (raster: FlussRaster) => FLUSS_FENSTER[raster] * 2 - 1;
