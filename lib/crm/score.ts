// ─── Lead-Score (rein, getestet) ─────────────────────────────────────────────
// Kevin (27.09.): „Ein Lead-Scoring-System über Markttraktion, Head of Sales und
// Head of Marketing — kalt/warm, Qualifizierungsgrad, Kanal, Kanal-Leistung.“
// Seit 03.10. (Qualifizierung & Scoring) rechnet der Kern in lib/crm/scoring.ts — aus den Einstellungen
// (Marketing-Signale bis MQL, Sales-Qualifikation bis SQL). Diese Datei ist die Brücke: `leadScore` liefert
// dieselbe Form wie immer (Punkte 0–100, Temperatur, Teile mit Grund) und trägt das volle Ergebnis in `scoring`.
// Beim Standard sind es genau die vier Teile von früher: Fit 30 · Wärme 30 · Qualifizierung 30 · Erreichbarkeit 10.
// Die Temperatur wird nie gespeichert, sondern wie die Phase abgeleitet.

import type { Kontakt } from '@/lib/make-one/crm';
import type { CrmBestand, Kriterien, Lead, Temperatur } from './typen';
import { MINDESTMENGE } from './deal-auswertung';
import { scoringRechnen, temperaturAus, standardZumRechnen, WAERME_VERFALL_TAGEN, type ScoringErgebnis, type ScoringKontext, type TemperaturAb } from './scoring';

export { WAERME_VERFALL_TAGEN };

export interface ScoreTeil { id: string; label: string; punkte: number; max: number; grund: string; seite?: 'marketing' | 'sales' }
export interface LeadScore {
  punkte: number; temperatur: Temperatur; teile: ScoreTeil[];
  /** Das volle Ergebnis des Kerns (MQL-/SQL-Schwelle, fehlt noch …, je Kriterium). Fehlt nur bei von Hand gebauten Werten (Tests). */
  scoring?: ScoringErgebnis;
}

export const TEMPERATUR: { id: Temperatur; label: string; ab: number; farbe: string }[] = [
  { id: 'kalt', label: 'Kalt', ab: 0, farbe: '#7C8796' },
  { id: 'lau', label: 'Lau', ab: 25, farbe: '#58D9CD' },
  { id: 'warm', label: 'Warm', ab: 50, farbe: '#FF9F43' },
  { id: 'heiss', label: 'Heiß', ab: 75, farbe: '#FF5A6E' },
];
/** Temperatur aus dem Wert — ohne `ab` mit den Standardstufen 25 / 50 / 75, sonst mit den eingestellten. */
export const temperaturVon = (punkte: number, ab?: TemperaturAb): Temperatur => temperaturAus(punkte, ab);
export const temperaturLabel = (t: Temperatur) => TEMPERATUR.find(x => x.id === t)!.label;
export const temperaturFarbe = (t: Temperatur) => TEMPERATUR.find(x => x.id === t)!.farbe;
/** Warm oder heiß — ab hier gehört ein Lead in die Leads-Liste statt ins Vernetzen. */
export const warmPlus = (t: Temperatur) => t === 'warm' || t === 'heiss';

/** Was der Kern aus dem CRM-Bestand braucht: die Einstellungen, Teilnahmen/Events (Event- und Make.One-Signale) und Kampagnen (Marketing-Herkunft). */
export function scoringKontext(crm?: Partial<Pick<CrmBestand, 'scoring' | 'teilnahmen' | 'events' | 'kampagnen'>> | null): ScoringKontext {
  return { ...(crm?.scoring ? { einstellungen: crm.scoring } : {}), ...(crm?.teilnahmen ? { teilnahmen: crm.teilnahmen } : {}), ...(crm?.events ? { events: crm.events } : {}), ...(crm?.kampagnen ? { kampagnen: crm.kampagnen } : {}) };
}

/**
 * Der Score eines Leads (Firma mit ihren Personen oder eine Person ohne Firma) — die EINE Rechnung: gerechnet wird in
 * `scoringRechnen` (Einstellungen aus `ctx.einstellungen`, ohne sie der Standard). Wer die Einstellungen kennt, übergibt
 * `scoringKontext(crm)` — sonst rechnet jede Stelle mit dem Standard und die Zahlen wichen voneinander ab.
 */
export function leadScore(personen: Kontakt[], lead: Lead | undefined, heute: string, kriterien?: Kriterien, ctx?: ScoringKontext): LeadScore {
  const antworten = { ...(lead ?? {}), ...(kriterien ? { kriterien } : {}) };
  const e = scoringRechnen(personen, antworten, heute, ctx);
  const einst = ctx?.einstellungen ?? standardZumRechnen();
  const teile: ScoreTeil[] = [...e.marketing.teile, ...e.sales.teile].map(t => ({ id: t.id, label: t.name, punkte: t.punkte, max: t.max, grund: t.grund, seite: t.seite }));
  // Reihenfolge wie bisher: Fit, Wärme, Qualifizierung, Erreichbarkeit (beim Standard) — sonst Marketing vor Sales.
  const reihe = ['fit', 'waerme', 'qualifizierung', 'erreichbarkeit'];
  if (teile.length === 4 && reihe.every(id => teile.some(t => t.id === id))) teile.sort((a, b) => reihe.indexOf(a.id) - reihe.indexOf(b.id));
  return { punkte: e.gesamt, temperatur: temperaturAus(e.gesamt, einst.temperaturAb), teile, scoring: e };
}

// ── Herkunftskanal (ausgelagert nach kanal.ts, hier weiter exportiert) ────────
export { KANAL, kanalLabel, kanalVon, type KanalId } from './kanal';
import { kanalLabel, type KanalId } from './kanal';

/** Kanal-Leistung: je Kanal Anzahl, warm+, SQL/Kunde, gewonnen — für Sales-Auswertung, Marketing und die Heads. */
/** Quoten erst ab MINDESTMENGE Leads je Kanal, sonst null (7.4, 08.10.: vorher „1 (100 %)“) — wie bei der Temperatur. */
export interface KanalZeile { kanal: KanalId; label: string; anzahl: number; warm: number; sql: number; gewonnen: number; warmQuote: number | null; sqlQuote: number | null }
export function kanalLeistung(zeilen: { kanal: KanalId; score: LeadScore; status: string; deal?: { stufe: string } }[]): KanalZeile[] {
  const je = new Map<KanalId, KanalZeile>();
  for (const z of zeilen) {
    const e = je.get(z.kanal) ?? { kanal: z.kanal, label: kanalLabel(z.kanal), anzahl: 0, warm: 0, sql: 0, gewonnen: 0, warmQuote: null, sqlQuote: null };
    e.anzahl++;
    if (warmPlus(z.score.temperatur)) e.warm++;
    if (z.status === 'sql' || z.status === 'kunde') e.sql++;
    if (z.status === 'kunde' || z.deal?.stufe === 'gewonnen') e.gewonnen++;
    je.set(z.kanal, e);
  }
  return [...je.values()].map(e => ({ ...e, warmQuote: e.anzahl >= MINDESTMENGE ? Math.round((100 * e.warm) / e.anzahl) : null, sqlQuote: e.anzahl >= MINDESTMENGE ? Math.round((100 * e.sql) / e.anzahl) : null })).sort((a, b) => b.sql - a.sql || b.warm - a.warm || b.anzahl - a.anzahl);
}

/**
 * SQL- und Gewinnquote je Temperatur (28.09., K4, #95) — für die Sales-Auswertung: trägt die Temperatur, was sie
 * verspricht? Dieselben Zählregeln wie `kanalLeistung` (SQL = Status sql/kunde, gewonnen = Kunde oder Deal gewonnen);
 * Quoten erst ab MINDESTMENGE Leads je Temperatur, sonst null.
 */
export interface TemperaturZeile { temperatur: Temperatur; label: string; anzahl: number; sql: number; gewonnen: number; sqlQuote: number | null; gewinnQuote: number | null }
export function temperaturLeistung(zeilen: { score: LeadScore; status: string; deal?: { stufe: string } }[]): TemperaturZeile[] {
  return TEMPERATUR.map(t => {
    const l = zeilen.filter(z => z.score.temperatur === t.id);
    const sql = l.filter(z => z.status === 'sql' || z.status === 'kunde').length;
    const gewonnen = l.filter(z => z.status === 'kunde' || z.deal?.stufe === 'gewonnen').length;
    const genug = l.length >= MINDESTMENGE;
    return { temperatur: t.id, label: t.label, anzahl: l.length, sql, gewonnen, sqlQuote: genug ? Math.round((100 * sql) / l.length) : null, gewinnQuote: genug ? Math.round((100 * gewonnen) / l.length) : null };
  });
}

/** Verteilung kalt/lau/warm/heiß — für den Überblick. */
export function temperaturVerteilung(zeilen: { score: LeadScore }[]): Record<Temperatur, number> {
  const v: Record<Temperatur, number> = { kalt: 0, lau: 0, warm: 0, heiss: 0 };
  for (const z of zeilen) v[z.score.temperatur]++;
  return v;
}
