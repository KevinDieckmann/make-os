// ─── Gesundheit — die Tageswerte eines Tages gegen den eigenen 7-Tage-Bezug (rein, getestet, 09.10.2026) ──────────────────
// Kevin 09.10.: „optimiere das Gesundheits-Cockpit mit allen Daten, die du bekommen kannst“ — für jetzt (bis Malin sagt, was sie braucht)
// eine schlichte Kennzahlen-Reihe unter dem Morgen-Check: Körperwerte gegen den EIGENEN Bezug (Ø der 7 Tage davor, mindestens 3 Werte),
// Schlaf (Phasen, Bedarf gegen Ist, Leistung/Konsistenz/Effizienz), Tag (Energie, Schritte). Woher die Werte kommen: lib/vitals.ts
// (`DayVitals`, WHOOP über lib/whoop/abbilden.ts). Fehlt ein Wert, fehlt er hier auch (nie 0, die Oberfläche zeigt „—“).
//
// Ampeln nur, wo der Gesundheits-Index schon eine Schwelle hat (HRV: unter 85 % des Bezugs; Ruhepuls: mehr als 4 Schläge über dem Bezug —
// lib/gesundheit/index.ts). Atemfrequenz, SpO2 und Hauttemperatur bekommen KEINE Ampel, nur die Abweichung: Hinweis, keine ärztliche Beratung.
// Client- und server-sicher (kein Bestand, kein Netz).

import type { DayVitals, VitalsLog } from '@/lib/vitals';

export type KoerperId = 'hrv' | 'rhr' | 'atem' | 'spo2' | 'hautTemp';
export type Abweichung = 'gut' | 'achtung' | 'neutral';
export interface KoerperWert {
  id: KoerperId;
  label: string;
  einheit: string;
  wert?: number;
  /** Ø der 7 Tage davor — nur mit mindestens 3 Werten. */
  bezug?: number;
  /** wert − bezug (gerundet wie der Wert). */
  diff?: number;
  /** Nur HRV und Ruhepuls bewerten (Schwellen wie im Gesundheits-Index); sonst neutral. */
  lage: Abweichung;
  /** Nur die Abweichung zeigen (Hauttemperatur — der absolute Wert sagt wenig). */
  nurAbweichung?: boolean;
}
export interface SchlafWerte {
  dauer?: number; bedarf?: number; leistung?: number; konsistenz?: number; effizienz?: number; stoerungen?: number;
  phasen?: { leicht: number; tief: number; rem: number; wach: number };
}
export interface Koerperwerte {
  tag: string;
  strain?: number;
  kcal?: number;
  schritte?: number;
  schlaf: SchlafWerte;
  koerper: KoerperWert[];
  /** Gibt es überhaupt einen Wert aus den Zusatzfeldern? (sonst zeigt die Oberfläche die Reihe nicht) */
  leer: boolean;
}

const DEF: { id: KoerperId; label: string; einheit: string; stellen: number; nurAbweichung?: boolean }[] = [
  { id: 'hrv', label: 'HRV', einheit: 'ms', stellen: 0 },
  { id: 'rhr', label: 'Ruhepuls', einheit: 'bpm', stellen: 0 },
  { id: 'atem', label: 'Atemfrequenz', einheit: '/min', stellen: 1 },
  { id: 'spo2', label: 'SpO2', einheit: '%', stellen: 1 },
  { id: 'hautTemp', label: 'Hauttemperatur', einheit: '°C', stellen: 1, nurAbweichung: true },
];
/** Schwellen wie im Gesundheits-Index (`hrv` rot unter 85 % der Basis, `ruhepuls` rot über +4 Schläge). */
export const HRV_ACHTUNG_ANTEIL = 0.85;
export const RHR_ACHTUNG_PLUS = 4;
export const BEZUG_TAGE = 7;
export const BEZUG_MIN = 3;

const zahlOk = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const rund = (n: number, s: number) => Math.round(n * 10 ** s) / 10 ** s;
const tagMinus = (t: string, n: number) => { const d = new Date(`${t}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };

/** Ø eines Feldes über die `BEZUG_TAGE` Tage VOR `tag` (der Tag selbst zählt nicht) — mit weniger als `BEZUG_MIN` Werten keiner. */
export function bezugVon(log: VitalsLog, tag: string, feld: keyof DayVitals): number | undefined {
  const w: number[] = [];
  for (let i = 1; i <= BEZUG_TAGE; i++) { const v = log[tagMinus(tag, i)]?.[feld]; if (zahlOk(v)) w.push(v); }
  return w.length >= BEZUG_MIN ? w.reduce((a, b) => a + b, 0) / w.length : undefined;
}

/** Die Werte eines Tages mit Bezug (rein). `tag` = der Tag, den die Seite zeigt (z. B. der Stand des Morgen-Checks). */
export function koerperwerteAus(log: VitalsLog, tag: string): Koerperwerte {
  const d: DayVitals = log[tag] ?? {};
  const koerper: KoerperWert[] = DEF.map(k => {
    const wert = zahlOk(d[k.id]) ? (d[k.id] as number) : undefined;
    const b = wert === undefined ? undefined : bezugVon(log, tag, k.id);
    const bezug = b === undefined ? undefined : rund(b, k.stellen);
    const diff = wert !== undefined && b !== undefined ? rund(wert - b, k.id === 'hautTemp' ? 2 : k.stellen) : undefined;
    let lage: Abweichung = 'neutral';
    if (wert !== undefined && b !== undefined) {
      if (k.id === 'hrv') lage = wert < b * HRV_ACHTUNG_ANTEIL ? 'achtung' : 'gut';
      if (k.id === 'rhr') lage = wert > b + RHR_ACHTUNG_PLUS ? 'achtung' : 'gut';
    }
    return { id: k.id, label: k.label, einheit: k.einheit, ...(wert !== undefined ? { wert } : {}), ...(bezug !== undefined ? { bezug } : {}), ...(diff !== undefined ? { diff } : {}), lage, ...(k.nurAbweichung ? { nurAbweichung: true } : {}) };
  });
  const z = (v: unknown) => (zahlOk(v) ? v : undefined);
  const phasen = [d.phaseLeicht, d.phaseTief, d.phaseRem, d.phaseWach].every(zahlOk)
    ? { leicht: d.phaseLeicht as number, tief: d.phaseTief as number, rem: d.phaseRem as number, wach: d.phaseWach as number } : undefined;
  const schlaf: SchlafWerte = Object.fromEntries(Object.entries({
    dauer: z(d.sleep), bedarf: z(d.schlafBedarf), leistung: z(d.schlafLeistung), konsistenz: z(d.schlafKonsistenz), effizienz: z(d.schlafEffizienz),
    stoerungen: z(d.stoerungen), phasen,
  }).filter(([, v]) => v !== undefined));
  const zusatz = [d.strain, d.kcal, d.schritte, d.spo2, d.hautTemp, d.atem, d.schlafLeistung, d.schlafKonsistenz, d.schlafEffizienz, d.schlafBedarf, d.phaseLeicht, d.stoerungen];
  return {
    tag,
    ...(zahlOk(d.strain) ? { strain: d.strain } : {}),
    ...(zahlOk(d.kcal) ? { kcal: d.kcal } : {}),
    ...(zahlOk(d.schritte) ? { schritte: d.schritte } : {}),
    schlaf, koerper, leer: !zusatz.some(zahlOk),
  };
}

/** Anteile der Schlafphasen (0–1, Summe 1) für den Balken — null ohne Phasen oder ohne Schlaf. */
export function phasenAnteile(p?: SchlafWerte['phasen']): { leicht: number; tief: number; rem: number; wach: number } | null {
  if (!p) return null;
  const summe = p.leicht + p.tief + p.rem + p.wach;
  if (!(summe > 0)) return null;
  return { leicht: p.leicht / summe, tief: p.tief / summe, rem: p.rem / summe, wach: p.wach / summe };
}
