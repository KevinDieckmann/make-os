// ─── Finanzplanung jetzt — Ampeln und Schwellen (rein, getestet) ─────────────
// Kevin 02.10.: „Wir müssen alle Felder anpassbar haben.“ Die Grenzen, ab denen eine Zahl gelb oder rot wird
// (Runway, frei verfügbar, Luft im Haushalt …), standen bisher fest im Code. Jetzt liegen sie als `schwellen`
// im Plan-Dokument; fehlt ein Wert, gilt die bisherige Vorgabe — es ändert sich keine Anzeige, bis jemand
// etwas einträgt. Schwellen färben nur; gerechnet wird im Rechenkern.

import type { FinanzDaten } from './rechenkern';

export interface Schwellen {
  /** Runway in Monaten: darunter gelb. */
  runwayWarnMonate: number;
  /** Runway in Monaten: darüber grün. */
  runwayGutMonate: number;
  /** Frei verfügbar jetzt (alle Orte) in €: ab hier grün. */
  freiGut: number;
  /** Tiefpunkt „MAKE frei“ in €: ab hier grün (darunter ab 0 gelb). */
  tiefpunktGut: number;
  /** MAKE frei am Ende des nächsten Jahres in €: ab hier grün. */
  endeGut: number;
  /** Privat Luft im schlechtesten Monat in €: ab hier grün. */
  privatLuftGut: number;
  /** Privat Luft in €: darunter „auf Kante“. */
  privatLuftKnapp: number;
  /** Anteil des größten Mandats am Umsatz: ab hier gelb (0,3 = 30 %). */
  ankerAnteilMax: number;
  /** Buchungen ohne Zuordnung: ab hier ein Hinweis. */
  buchungenOffen: number;
}

/** Die bisherigen, fest eingebauten Grenzen — gelten, solange nichts eingetragen ist. */
export const SCHWELLEN_VORGABE: Readonly<Schwellen> = {
  runwayWarnMonate: 6, runwayGutMonate: 12, freiGut: 5000, tiefpunktGut: 1000, endeGut: 20000,
  privatLuftGut: 250, privatLuftKnapp: 100, ankerAnteilMax: 0.3, buchungenOffen: 20,
};

export const SCHWELLEN_FELDER: { id: keyof Schwellen; label: string; einheit: '€' | 'Monate' | '%' | 'Stück'; hinweis: string }[] = [
  { id: 'runwayWarnMonate', label: 'Runway: gelb unter', einheit: 'Monate', hinweis: 'Monate, die das Geld noch trägt' },
  { id: 'runwayGutMonate', label: 'Runway: grün ab', einheit: 'Monate', hinweis: '' },
  { id: 'freiGut', label: 'Frei verfügbar jetzt: grün ab', einheit: '€', hinweis: 'alle Orte zusammen' },
  { id: 'tiefpunktGut', label: 'Tiefpunkt der Firma (frei): grün ab', einheit: '€', hinweis: 'unter 0 = rot, dazwischen gelb' },
  { id: 'endeGut', label: 'Firma frei am Jahresende: grün ab', einheit: '€', hinweis: 'Dezember des nächsten Jahres' },
  { id: 'privatLuftGut', label: 'Privat Luft: grün ab', einheit: '€', hinweis: 'schlechtester Monat' },
  { id: 'privatLuftKnapp', label: 'Privat Luft: „auf Kante“ unter', einheit: '€', hinweis: '' },
  { id: 'ankerAnteilMax', label: 'Größtes Mandat: gelb ab Anteil', einheit: '%', hinweis: 'am Umsatz, Juni nächstes Jahr' },
  { id: 'buchungenOffen', label: 'Buchungen ohne Zuordnung: Hinweis ab', einheit: 'Stück', hinweis: '' },
];

const endlich = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Die geltenden Schwellen: eingetragene Werte über den Vorgaben. */
export function schwellenVon(d: Pick<FinanzDaten, 'schwellen'>): Schwellen {
  const s = d.schwellen ?? {};
  const n: Schwellen = { ...SCHWELLEN_VORGABE };
  for (const k of Object.keys(SCHWELLEN_VORGABE) as (keyof Schwellen)[]) { const v = (s as Partial<Schwellen>)[k]; if (endlich(v)) n[k] = v; }
  return n;
}

/** `schwellen` aus rohen Daten bereinigen: nur bekannte Schlüssel, endliche Zahlen ≥ 0 (Anteil höchstens 1). Leer → undefined. */
export function pruefeSchwellen(roh: unknown): Partial<Schwellen> | undefined {
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return undefined;
  const r = roh as Record<string, unknown>, out: Partial<Schwellen> = {};
  for (const k of Object.keys(SCHWELLEN_VORGABE) as (keyof Schwellen)[]) {
    const v = r[k]; if (!endlich(v)) continue;
    out[k] = k === 'ankerAnteilMax' ? Math.max(0, Math.min(1, v)) : Math.max(0, v);
  }
  return Object.keys(out).length ? out : undefined;
}
