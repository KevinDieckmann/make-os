// ─── Lead-Score (rein, getestet) ─────────────────────────────────────────────
// Kevin (27.09.): „Ein Lead-Scoring-System über Markttraktion, Head of Sales und
// Head of Marketing — kalt/warm, Qualifizierungsgrad, Kanal, Kanal-Leistung.“
// Vier Teile, jeder einzeln sichtbar — keine Zahl ist eine Blackbox:
//   Fit 30 · Wärme 30 · Qualifizierung 30 · Erreichbarkeit 10 = 0–100.
// Die Temperatur wird nie gespeichert, sondern wie die Phase abgeleitet.

import type { Kontakt } from '@/lib/make-one/crm';
import type { Kriterien, Lead, Qual, Temperatur } from './typen';
import { echtesGespraech } from './pipeline';
import { MINDESTMENGE } from './deal-auswertung';

export type ScoreTeilId = 'fit' | 'waerme' | 'qualifizierung' | 'erreichbarkeit';
export interface ScoreTeil { id: ScoreTeilId; label: string; punkte: number; max: number; grund: string }
export interface LeadScore { punkte: number; temperatur: Temperatur; teile: ScoreTeil[] }

export const TEMPERATUR: { id: Temperatur; label: string; ab: number; farbe: string }[] = [
  { id: 'kalt', label: 'Kalt', ab: 0, farbe: '#7C8796' },
  { id: 'lau', label: 'Lau', ab: 25, farbe: '#58D9CD' },
  { id: 'warm', label: 'Warm', ab: 50, farbe: '#FF9F43' },
  { id: 'heiss', label: 'Heiß', ab: 75, farbe: '#FF5A6E' },
];
export const temperaturVon = (punkte: number): Temperatur => [...TEMPERATUR].reverse().find(t => punkte >= t.ab)!.id;
export const temperaturLabel = (t: Temperatur) => TEMPERATUR.find(x => x.id === t)!.label;
export const temperaturFarbe = (t: Temperatur) => TEMPERATUR.find(x => x.id === t)!.farbe;
/** Warm oder heiß — ab hier gehört ein Lead in die Leads-Liste statt ins Vernetzen. */
export const warmPlus = (t: Temperatur) => t === 'warm' || t === 'heiss';

const tage = (a: string, b: string) => Math.round((Date.parse(`${b.slice(0, 10)}T12:00:00Z`) - Date.parse(`${a.slice(0, 10)}T12:00:00Z`)) / 864e5);
const KERNFRAGEN: (keyof Kriterien)[] = ['schmerz', 'entscheider', 'budget', 'zeitpunkt', 'wirkung', 'alternative'];

/** Fit: die Antwort am Lead zuerst, sonst die Vertriebseignung aus der Liste (ja/vielleicht/nein). */
function fit(personen: Kontakt[], lead?: Lead): ScoreTeil {
  const q: Qual | undefined = lead?.fit;
  if (q === 'ja') return { id: 'fit', label: 'Fit', punkte: 30, max: 30, grund: 'Passt zu unserem Kundenprofil (am Lead gesetzt)' };
  if (q === 'nein') return { id: 'fit', label: 'Fit', punkte: 0, max: 30, grund: 'Kein Fit (am Lead gesetzt)' };
  const eignung = personen.map(k => k.eignung).sort((a, b) => rang(a) - rang(b))[0] ?? '';
  if (eignung === 'ja') return { id: 'fit', label: 'Fit', punkte: 30, max: 30, grund: 'Vertriebseignung „ja“ aus der Liste' };
  if (eignung === 'vielleicht') return { id: 'fit', label: 'Fit', punkte: 15, max: 30, grund: 'Vertriebseignung „vielleicht“' };
  if (eignung === 'nein') return { id: 'fit', label: 'Fit', punkte: 0, max: 30, grund: 'Vertriebseignung „nein“' };
  return { id: 'fit', label: 'Fit', punkte: 8, max: 30, grund: 'Fit noch offen' };
}
const rang = (e: string) => (e === 'ja' ? 0 : e === 'vielleicht' ? 1 : e === '' ? 2 : 3);

/** Wärme: echtes Gespräch zuletzt, sonst Antwort/Inbound, sonst nur angesprochen. */
function waerme(personen: Kontakt[], heute: string): ScoreTeil {
  const akt = personen.flatMap(k => k.aktivitaeten ?? []);
  const gespraech = akt.filter(echtesGespraech).map(a => a.am.slice(0, 10)).concat(personen.map(k => k.letzterKontakt ?? '').filter(Boolean)).sort().pop();
  if (gespraech) {
    const t = tage(gespraech, heute);
    if (t <= 30) return { id: 'waerme', label: 'Wärme', punkte: 30, max: 30, grund: `Echtes Gespräch vor ${t} Tagen` };
    if (t <= 90) return { id: 'waerme', label: 'Wärme', punkte: 20, max: 30, grund: `Letztes Gespräch vor ${t} Tagen` };
    if (t <= 365) return { id: 'waerme', label: 'Wärme', punkte: 12, max: 30, grund: `Letztes Gespräch vor ${t} Tagen — wieder aufwärmen` };
  }
  // Antwort und Ansprache verfallen (28.09., K4, #93): nach WAERME_VERFALL_TAGEN zählen sie nur noch wenig — eine Antwort
  // von vor zwei Jahren ist keine Wärme mehr. Frische Signale gehen vor; verblasste treten gegen den warmen Typ an.
  const zuletzt = (l: typeof akt) => l.map(a => a.am.slice(0, 10)).sort().pop();
  const verblasst: ScoreTeil[] = [];
  const antwortAm = zuletzt(akt.filter(a => a.art === 'antwort' || a.ergebnis === 'rueckruf'));
  if (antwortAm) {
    const t = tage(antwortAm, heute);
    if (t <= WAERME_VERFALL_TAGEN) return { id: 'waerme', label: 'Wärme', punkte: 12, max: 30, grund: 'Hat geantwortet' };
    verblasst.push({ id: 'waerme', label: 'Wärme', punkte: 5, max: 30, grund: `Antwort liegt ${t} Tage zurück — abgekühlt` });
  }
  const ansprachen = akt.filter(a => a.von !== 'system' && (a.art === 'mail' || a.art === 'linkedin' || a.art === 'anruf'));
  const angesprochenAm = zuletzt(ansprachen);
  if (angesprochenAm) {
    const t = tage(angesprochenAm, heute);
    if (t <= WAERME_VERFALL_TAGEN) return { id: 'waerme', label: 'Wärme', punkte: 8, max: 30, grund: 'Angesprochen, noch keine Antwort' };
    verblasst.push({ id: 'waerme', label: 'Wärme', punkte: 3, max: 30, grund: `Zuletzt vor ${t} Tagen angesprochen — abgekühlt` });
  } else if (!verblasst.length && personen.some(k => k.stufe === 'angesprochen')) {
    // Nur die Stufe aus der Liste, ohne datierte Ansprache — nicht zu altern, zählt wie bisher.
    return { id: 'waerme', label: 'Wärme', punkte: 8, max: 30, grund: 'Angesprochen, noch keine Antwort' };
  }
  const warmerTyp = personen.some(k => k.typ === 'Netzwerk' || k.typ === 'Kunde' || (k.kategorie ?? '').startsWith('Apple') || /apple/i.test(k.quelle ?? ''));
  if (warmerTyp) verblasst.push({ id: 'waerme', label: 'Wärme', punkte: 10, max: 30, grund: 'Bekannt aus Netzwerk oder früherer Zusammenarbeit' });
  if (verblasst.length) return verblasst.reduce((a, b) => (b.punkte > a.punkte ? b : a));
  return { id: 'waerme', label: 'Wärme', punkte: 0, max: 30, grund: 'Noch kein Kontakt' };
}

/** Nach so vielen Tagen zählen „hat geantwortet“ und „angesprochen“ nur noch abgekühlt (28.09., K4). */
export const WAERME_VERFALL_TAGEN = 180;

/** Qualifizierung: 5 Punkte je Kernfrage „ja“; Schmerz oder Entscheider „nein“ deckelt auf 10. */
function qualifizierung(k: Kriterien): ScoreTeil {
  const ja = KERNFRAGEN.filter(f => k[f] === 'ja').length;
  const gedeckelt = k.schmerz === 'nein' || k.entscheider === 'nein';
  const punkte = gedeckelt ? Math.min(10, ja * 5) : ja * 5;
  const grund = gedeckelt ? `${ja} von 6 geklärt — ${k.schmerz === 'nein' ? 'kein Schmerz' : 'kein Entscheider'} deckelt` : ja ? `${ja} von 6 Kernfragen mit „ja“` : 'Noch keine Kernfrage geklärt';
  return { id: 'qualifizierung', label: 'Qualifizierung', punkte, max: 30, grund };
}

/** Erreichbarkeit: E-Mail 4 · Telefon 3 · LinkedIn 3 — über alle Personen der Firma. */
function erreichbarkeit(personen: Kontakt[]): ScoreTeil {
  const mail = personen.some(k => (k.email ?? '').includes('@')) ? 4 : 0;
  const tel = personen.some(k => k.telefon || k.sms) ? 3 : 0;
  const li = personen.some(k => k.linkedin) ? 3 : 0;
  const wege = [mail && 'E-Mail', tel && 'Telefon', li && 'LinkedIn'].filter(Boolean).join(', ');
  return { id: 'erreichbarkeit', label: 'Erreichbar', punkte: mail + tel + li, max: 10, grund: wege ? `Erreichbar per ${wege}` : 'Kein Weg bekannt' };
}

/** Der Score eines Leads (Firma mit ihren Personen oder eine Person ohne Firma). */
export function leadScore(personen: Kontakt[], lead: Lead | undefined, heute: string, kriterien?: Kriterien): LeadScore {
  const k: Kriterien = kriterien ?? lead?.kriterien ?? { schmerz: 'unklar', entscheider: 'unklar', budget: 'unklar', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' };
  const teile = [fit(personen, lead), waerme(personen, heute), qualifizierung(k), erreichbarkeit(personen)];
  const punkte = teile.reduce((s, t) => s + t.punkte, 0);
  return { punkte, temperatur: temperaturVon(punkte), teile };
}

// ── Herkunftskanal ───────────────────────────────────────────────────────────
export type KanalId = 'empfehlung' | 'event' | 'content' | 'outreach' | 'bestand' | 'inbound' | 'kampagne' | 'netzwerk' | 'unbekannt';
export const KANAL: { id: KanalId; label: string }[] = [
  { id: 'empfehlung', label: 'Empfehlung' }, { id: 'event', label: 'Event' }, { id: 'content', label: 'Content' }, { id: 'outreach', label: 'Outreach' },
  { id: 'inbound', label: 'Inbound' }, { id: 'kampagne', label: 'Kampagne' }, { id: 'netzwerk', label: 'Netzwerk' }, { id: 'bestand', label: 'Bestand' }, { id: 'unbekannt', label: 'Unbekannt' },
];
export const kanalLabel = (k: KanalId) => KANAL.find(x => x.id === k)!.label;

/** Über welchen Kanal ein Kontakt zu uns kam: erst die gepflegte Herkunft, sonst die Quelle aus der Liste. */
export function kanalVon(k: Pick<Kontakt, 'herkunft' | 'quelle' | 'kategorie' | 'typ'>): KanalId {
  switch (k.herkunft) {
    case 'empfehlung': return 'empfehlung';
    case 'veranstaltung': return 'event';
    case 'recherche': return 'outreach';
    case 'bekannt': return 'netzwerk';
    case 'selbst': return 'inbound';
    case 'hubspot': case 'vertrag': return 'bestand';
    default: break;
  }
  const q = (k.quelle ?? '').toLowerCase();
  if (/empfehl/.test(q)) return 'empfehlung';
  if (/event|messe|veranstalt|meetup/.test(q)) return 'event';
  if (/linkedin|content|newsletter|beitrag/.test(q)) return 'content';
  if (/kampagne/.test(q)) return 'kampagne';
  if (/inbound|anfrage|website/.test(q)) return 'inbound';
  if (/apple/.test(q) || (k.kategorie ?? '').startsWith('Apple') || k.typ === 'Netzwerk') return 'netzwerk';
  if (/hubspot|import|export|bestand/.test(q)) return 'bestand';
  if (/leadliste|recherche|kaltakquise/.test(q)) return 'outreach';
  return 'unbekannt';
}

/** Kanal-Leistung: je Kanal Anzahl, warm+, SQL/Kunde, gewonnen — für Sales-Auswertung, Marketing und die Heads. */
export interface KanalZeile { kanal: KanalId; label: string; anzahl: number; warm: number; sql: number; gewonnen: number; warmQuote: number; sqlQuote: number }
export function kanalLeistung(zeilen: { kanal: KanalId; score: LeadScore; status: string; deal?: { stufe: string } }[]): KanalZeile[] {
  const je = new Map<KanalId, KanalZeile>();
  for (const z of zeilen) {
    const e = je.get(z.kanal) ?? { kanal: z.kanal, label: kanalLabel(z.kanal), anzahl: 0, warm: 0, sql: 0, gewonnen: 0, warmQuote: 0, sqlQuote: 0 };
    e.anzahl++;
    if (warmPlus(z.score.temperatur)) e.warm++;
    if (z.status === 'sql' || z.status === 'kunde') e.sql++;
    if (z.status === 'kunde' || z.deal?.stufe === 'gewonnen') e.gewonnen++;
    je.set(z.kanal, e);
  }
  return [...je.values()].map(e => ({ ...e, warmQuote: e.anzahl ? Math.round((100 * e.warm) / e.anzahl) : 0, sqlQuote: e.anzahl ? Math.round((100 * e.sql) / e.anzahl) : 0 })).sort((a, b) => b.sql - a.sql || b.warm - a.warm || b.anzahl - a.anzahl);
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
