// ─── Sport · Ziele & Plan: Wochenstruktur aus dem Ziel, Plan/Ist, Deload ────
// Nur Vorschläge — keine Trainingsberatung. Die Person entscheidet, der Plan
// ist ein Rahmen, den sie selbst umstellt.

import type { Disziplin, PlanArt, SportStand, Woche, Wochentag, Ziel } from './modell';
import { WOCHENTAGE, leereWoche } from './modell';
import { montagVon, tagPlus, tageZwischen } from './pace';

/** Wochen bis zu einem Datum (aufgerundet, nie negativ). */
export function wochenBis(heute: string, datum: string): number {
  return Math.max(0, Math.ceil(tageZwischen(heute, datum) / 7));
}

/** Das führende Ziel: das nächste offene mit Datum, sonst das erste offene. */
export function hauptziel(ziele: Ziel[], heute: string): Ziel | null {
  const offen = ziele.filter(z => !z.erledigt);
  const mitDatum = offen.filter(z => z.datum && z.datum >= heute).sort((a, b) => (a.datum! < b.datum! ? -1 : 1));
  return mitDatum[0] ?? offen[0] ?? null;
}

/** Reihenfolge, in der Trainingstage über die Woche verteilt werden (Luft zwischen harten Tagen). */
const REIHE: Wochentag[] = ['di', 'do', 'sa', 'mo', 'fr', 'mi', 'so'];

/**
 * Wochenstruktur aus Ziel und Tagen pro Woche. Verteilung je Schwerpunkt:
 *   hyrox      Lauf, Gym, Hyrox-Stationen im Wechsel (ab 5 Tagen zwei Läufe)
 *   lauf       überwiegend Laufen, ein Gym-Tag zur Stütze
 *   kraft      überwiegend Gym, ein Lauf zur Grundlage
 *   grundlagen abwechselnd Lauf und Gym
 * Mindestens ein Ruhetag (Sonntag), die übrigen Tage bleiben frei.
 */
export function vorschlagWoche(art: Disziplin, tageProWoche: number): Woche {
  const n = Math.max(1, Math.min(6, Math.round(tageProWoche)));
  const w = leereWoche();
  const folge: Record<Disziplin, PlanArt[]> = {
    hyrox: ['lauf', 'gym', 'hyrox', 'lauf', 'gym', 'hyrox'],
    lauf: ['lauf', 'lauf', 'gym', 'lauf', 'lauf', 'gym'],
    kraft: ['gym', 'gym', 'lauf', 'gym', 'gym', 'lauf'],
    grundlagen: ['lauf', 'gym', 'lauf', 'gym', 'lauf', 'gym'],
  };
  const dauer: Record<PlanArt, number> = { lauf: 45, gym: 60, hyrox: 60, ruhe: 0, frei: 0 };
  REIHE.slice(0, n).forEach((t, i) => { const a = folge[art][i]; w[t] = { art: a, dauerMin: dauer[a] }; });
  w.so = w.so.art === 'frei' ? { art: 'ruhe' } : w.so;
  if (!WOCHENTAGE.some(t => w[t].art === 'ruhe')) { const frei = WOCHENTAGE.find(t => w[t].art === 'frei'); if (frei) w[frei] = { art: 'ruhe' }; }
  return w;
}

export interface Umfang { einheiten: number; minuten: number; je: Record<PlanArt, number>; ruhetage: number }

/** Was der Wochenplan vorsieht. */
export function planUmfang(w: Woche): Umfang {
  const je: Record<PlanArt, number> = { hyrox: 0, lauf: 0, gym: 0, ruhe: 0, frei: 0 };
  let minuten = 0;
  for (const t of WOCHENTAGE) { je[w[t].art] += 1; minuten += w[t].dauerMin ?? 0; }
  return { einheiten: je.hyrox + je.lauf + je.gym, minuten, je, ruhetage: je.ruhe };
}

export interface WocheIst { montag: string; hyrox: number; lauf: number; gym: number; einheiten: number; km: number }

/** Was in einer Woche tatsächlich stattfand (Einheiten je Disziplin, Laufkilometer). */
export function wocheIst(stand: SportStand, montag: string): WocheIst {
  const ende = tagPlus(montag, 6);
  const drin = (d: string) => d >= montag && d <= ende;
  const hyrox = stand.hyrox.filter(e => drin(e.datum)).length;
  const laeufe = stand.laeufe.filter(l => drin(l.datum));
  const gym = stand.gym.einheiten.filter(e => drin(e.datum)).length;
  return { montag, hyrox, lauf: laeufe.length, gym, einheiten: hyrox + laeufe.length + gym, km: Math.round(laeufe.reduce((s, l) => s + l.distanzKm, 0) * 10) / 10 };
}

export interface PlanIst { montag: string; plan: number; ist: number; anteil: number }

/** Plan gegen Ist je Woche, älteste zuerst — so sieht man, ob der Rahmen hält. */
export function planIst(stand: SportStand, heute: string, wochen = 8): PlanIst[] {
  const plan = planUmfang(stand.woche).einheiten;
  const start = montagVon(heute);
  const r: PlanIst[] = [];
  for (let i = wochen - 1; i >= 0; i--) {
    const montag = tagPlus(start, -7 * i);
    const ist = wocheIst(stand, montag).einheiten;
    r.push({ montag, plan, ist, anteil: plan > 0 ? Math.min(1, ist / plan) : 0 });
  }
  return r;
}

export interface Deload { wocheImBlock: number; rhythmus: number; jetzt: boolean; naechsteIn: number; naechsterMontag: string }

/**
 * Deload-Rhythmus: alle `rhythmus` Wochen (4–6) eine leichte Woche. Gezählt ab `planStart`
 * (Montag); ohne Start ab dem Montag der ersten erfassten Einheit.
 */
export function deload(planStart: string | undefined, heute: string, rhythmus = 4): Deload | null {
  if (!planStart) return null;
  const r = Math.max(3, Math.min(8, rhythmus));
  const start = montagVon(planStart);
  const diff = Math.floor(Math.max(0, tageZwischen(start, montagVon(heute))) / 7);
  const wocheImBlock = (diff % r) + 1;
  const jetzt = wocheImBlock === r;
  const naechsteIn = jetzt ? 0 : r - wocheImBlock;
  return { wocheImBlock, rhythmus: r, jetzt, naechsteIn, naechsterMontag: tagPlus(montagVon(heute), 7 * naechsteIn) };
}

/** Der erste Tag mit Einheit im Bestand — für den Deload-Start, wenn kein Plan gesetzt wurde. */
export function ersteEinheit(stand: SportStand): string | undefined {
  const tage = [...stand.hyrox.map(e => e.datum), ...stand.laeufe.map(l => l.datum), ...stand.gym.einheiten.map(e => e.datum)].sort();
  return tage[0];
}

/** Welcher Wochentag ist ein Datum. */
export function wochentagVon(tag: string): Wochentag {
  return WOCHENTAGE[(new Date(`${tag}T12:00:00`).getDay() + 6) % 7];
}
