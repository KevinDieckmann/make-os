// ─── Sport · Laufen: Pace, Zeiten, Wochenkilometer, Bestzeiten ──────────────
// Reine Rechenlogik. Zeiten immer in Sekunden, Distanzen in km.

import type { Lauf, Ziel } from './modell';

/** Pace in Sekunden je Kilometer. */
export function paceSekProKm(distanzKm: number, dauerSek: number): number | null {
  if (!(distanzKm > 0) || !(dauerSek > 0)) return null;
  return dauerSek / distanzKm;
}

/** „4:32“ aus Sekunden je km. */
export function formatPace(sekProKm: number | null | undefined): string {
  if (sekProKm == null || !Number.isFinite(sekProKm)) return '—';
  const s = Math.round(sekProKm);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** „1:23:45“ oder „23:45“ aus Sekunden. */
export function formatZeit(sek: number | null | undefined): string {
  if (sek == null || !Number.isFinite(sek)) return '—';
  const s = Math.max(0, Math.round(sek));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
}

/** „1:23:45“, „23:45“, „45“ oder „1h 23m“ → Sekunden. Null, wenn nichts Lesbares. */
export function parseZeit(text: string | number | null | undefined): number | null {
  if (typeof text === 'number') return Number.isFinite(text) && text > 0 ? Math.round(text) : null;
  const t = String(text ?? '').trim().toLowerCase().replace(',', '.');
  if (!t) return null;
  const hm = t.match(/^(?:(\d+)\s*h)?\s*(?:(\d+)\s*(?:m|min))?\s*(?:(\d+)\s*s)?$/);
  if (hm && (hm[1] || hm[2] || hm[3])) return (Number(hm[1] ?? 0) * 3600) + (Number(hm[2] ?? 0) * 60) + Number(hm[3] ?? 0);
  const teile = t.split(':').map(Number);
  if (teile.some(n => !Number.isFinite(n) || n < 0)) return null;
  if (teile.length === 3) return Math.round(teile[0] * 3600 + teile[1] * 60 + teile[2]);
  if (teile.length === 2) return Math.round(teile[0] * 60 + teile[1]);
  if (teile.length === 1) return Math.round(teile[0]);
  return null;
}

/** Montag der Woche eines Tags (YYYY-MM-DD). */
export function montagVon(tag: string): string {
  const d = new Date(`${tag}T12:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
export function tagPlus(tag: string, n: number): string {
  const d = new Date(`${tag}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
export function tageZwischen(von: string, bis: string): number {
  return Math.round((new Date(`${bis}T12:00:00`).getTime() - new Date(`${von}T12:00:00`).getTime()) / 86_400_000);
}

export interface WochenKm { montag: string; km: number; laeufe: number; dauerSek: number }

/** Wochenkilometer der letzten `wochen` Wochen (älteste zuerst, aktuelle Woche zuletzt). */
export function wochenKilometer(laeufe: Lauf[], heute: string, wochen = 12): WochenKm[] {
  const start = montagVon(heute);
  const liste: WochenKm[] = [];
  for (let i = wochen - 1; i >= 0; i--) liste.push({ montag: tagPlus(start, -7 * i), km: 0, laeufe: 0, dauerSek: 0 });
  const index = new Map(liste.map((w, i) => [w.montag, i]));
  for (const l of laeufe) {
    const i = index.get(montagVon(l.datum));
    if (i === undefined) continue;
    liste[i].km += l.distanzKm; liste[i].laeufe += 1; liste[i].dauerSek += l.dauerSek;
  }
  for (const w of liste) w.km = Math.round(w.km * 10) / 10;
  return liste;
}

/** Trend: Mittel der letzten 4 Wochen gegen die 4 davor, in Prozent (null ohne Grundlage). */
export function kmTrend(wochen: WochenKm[]): number | null {
  if (wochen.length < 8) return null;
  const letzte = wochen.slice(-4).reduce((s, w) => s + w.km, 0) / 4;
  const davor = wochen.slice(-8, -4).reduce((s, w) => s + w.km, 0) / 4;
  if (davor <= 0) return letzte > 0 ? 100 : null;
  return Math.round(((letzte - davor) / davor) * 100);
}

export const BESTZEIT_DISTANZEN = [5, 10, 21.1] as const;
export interface Bestzeit { distanzKm: number; sek: number; datum: string; laufId: string; hochgerechnet: boolean }

/**
 * Bestzeiten 5 / 10 / 21,1 km: ein Lauf zählt, wenn er die Distanz erreicht und nicht mehr
 * als 8 % länger war — die Zeit wird dann auf die Distanz gerechnet (Pace gehalten).
 */
export function bestzeiten(laeufe: Lauf[]): Bestzeit[] {
  const r: Bestzeit[] = [];
  for (const d of BESTZEIT_DISTANZEN) {
    let best: Bestzeit | null = null;
    for (const l of laeufe) {
      if (l.distanzKm < d - 0.05 || l.distanzKm > d * 1.08) continue;
      const genau = Math.abs(l.distanzKm - d) <= 0.05;
      const sek = genau ? l.dauerSek : Math.round((l.dauerSek / l.distanzKm) * d);
      if (!best || sek < best.sek) best = { distanzKm: d, sek, datum: l.datum, laufId: l.id, hochgerechnet: !genau };
    }
    if (best) r.push(best);
  }
  return r;
}

/** Riegel: Zeit über d2 aus Zeit über d1 (Ausdauer-Exponent 1,06). */
export function riegel(sek1: number, d1: number, d2: number): number {
  return Math.round(sek1 * Math.pow(d2 / d1, 1.06));
}

/** Zielpace (Sek/km) aus einem Laufziel — null, wenn dem Ziel Zeit oder Distanz fehlt. */
export function zielPace(ziel: Pick<Ziel, 'zielzeitSek' | 'distanzKm'>): number | null {
  return ziel.zielzeitSek && ziel.distanzKm ? paceSekProKm(ziel.distanzKm, ziel.zielzeitSek) : null;
}

/**
 * Trainingspaces aus der Zielpace — Vorschlag, keine Trainingsberatung:
 * locker +60…90 s, Longrun +45…75 s, Tempo −5…+10 s, Intervall −15…−25 s.
 */
export function trainingsPaces(zielSekProKm: number): { art: string; von: number; bis: number }[] {
  return [
    { art: 'locker', von: zielSekProKm + 60, bis: zielSekProKm + 90 },
    { art: 'longrun', von: zielSekProKm + 45, bis: zielSekProKm + 75 },
    { art: 'tempo', von: zielSekProKm - 5, bis: zielSekProKm + 10 },
    { art: 'intervall', von: zielSekProKm - 25, bis: zielSekProKm - 15 },
  ];
}
