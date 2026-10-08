// ─── Qualifizierung & Scoring — der Rechenkern (rein, getestet, 03.10.) ──────
// Kevin: „Leadscoring ist der Oberbegriff der Qualifizierung — darunter die Scoring-Einstellungen von Marketing
// und von Sales, also von MQL zu SQL.“ Eine Rechnung, eine Quelle: dieser Kern rechnet aus den Einstellungen
// (`ScoringEinstellungen`) ALLES — den Score 0–100 mit Temperatur (`leadScore` in score.ts ruft ihn), die
// Marketing-Schwelle (MQL) und die Sales-Schwelle (SQL) samt „fehlt noch …“.
//
// Methode (nur das Verfahren, eigene Kriterien und Texte): Kriterien in Blöcken (Teile) — Interaktionen und
// Signale, Qualifikationsfragen und Fit, Potenzial. Je Kriterium Stufen mit Punkten (im Vorschlag 1 · 3 · 5,
// 0 = trifft nicht zu), optional ein Gewicht. Die Summe eines Blocks geht gegen eine Mindestpunktzahl (Schwelle);
// die mögliche Höchstpunktzahl steht immer daneben. „Muss“-Kriterien sind Ausschlusskriterien: ohne sie hilft
// keine Punktzahl (z. B. kein Schmerz, kein Entscheider).
//
// Zwei Seiten:
//   marketing  Signale und Interaktionen bis zum MQL — gemessen aus den Daten (Messfühler, `MESSUNGEN`)
//   sales      Qualifikation MQL → SQL — Fit- und Kaufkriterien, beantwortet im Gespräch (`Lead.stufen`)
//
// Der STANDARD bildet die bisherige Rechnung (Fit 30 · Wärme 30 · Qualifizierung 30 · Erreichbarkeit 10) Punkt für
// Punkt nach — die Scores ändern sich nicht, solange niemand etwas einstellt. Der VORSCHLAG ist die geschärfte
// Fassung (MEDDICC/BANT-Kriterien, 1/3/5). Beides steht in SCORING.md.
//
// Alles hier ist rein (keine Speicherzugriffe) — Laden und Schreiben: lib/crm/scoring-server.ts.

import type { Kontakt, Aktivitaet } from '@/lib/make-one/crm';
import type { Event, Kampagne, Kriterien, Lead, Qual, Teilnahme } from './typen';
import { kanalVon } from './kanal';
import { echtesGespraech } from './pipeline';
import { hatTyp, kategorieBeginnt } from './mehrfach';
import { istNetzwerkenEvent, alsMarketingAnmeldung } from './marke';
import { nachweisLuecken } from './einwilligung';

export const SCORING_VERSION = 1;
/** Nach so vielen Tagen zählen „hat geantwortet“ und „angesprochen“ nur noch abgekühlt (wie bisher, 28.09.). */
export const WAERME_VERFALL_TAGEN = 180;

// ── Typen ────────────────────────────────────────────────────────────────────

export type ScoringSeiteId = 'marketing' | 'sales';
export type MessungId =
  | 'waerme' | 'mail' | 'telefon' | 'linkedin' | 'eignung'
  | 'gespraech' | 'antwort' | 'event' | 'makeone' | 'newsletter' | 'termin' | 'empfehlung' | 'anfrage' | 'erreichbar';
/** Die alten Felder am Lead, aus denen eine Antwort gelesen wird, solange keine neue Stufe gewählt ist. */
export type AltFeld = keyof Kriterien | 'fit';
export const ALT_FELDER: readonly AltFeld[] = ['schmerz', 'entscheider', 'budget', 'zeitpunkt', 'wirkung', 'alternative', 'fit'];

export interface ScoringStufe {
  id: string;
  text: string;
  punkte: number;
  /** Wer diese Stufe hat, deckelt den Block auf höchstens so viele Punkte (z. B. „kein Schmerz“). */
  deckel?: number;
}
export interface ScoringKriterium {
  id: string;
  name: string;
  /** Die Frage (Sales) bzw. die Erklärung (Marketing) — der Gesprächsmodus liest sie vor. */
  hinweis?: string;
  quelle: 'messung' | 'frage';
  messung?: MessungId;
  alt?: AltFeld;
  stufen: ScoringStufe[];
  /** Welche Stufe gilt, wenn nichts beantwortet bzw. gemessen ist (sonst: 0 Punkte, „offen“). */
  ohneAntwort?: string;
  /** Faktor auf die Stufenpunkte (Standard 1). */
  gewicht?: number;
  aus?: boolean;
}
export interface ScoringTeil { id: string; name: string; kriterien: ScoringKriterium[] }
/** Ausschlusskriterium: mindestens `mindestens` der Kriterien müssen auf einer Stufe mit ≥ `stufePunkte` Punkten stehen. */
export interface ScoringMuss { kriterien: string[]; mindestens: number; stufePunkte: number }
export interface ScoringSeite { schwelle: number; teile: ScoringTeil[]; muss: ScoringMuss[] }
export interface TemperaturAb { lau: number; warm: number; heiss: number }
export interface ScoringEinstellungen {
  version: number;
  marketing: ScoringSeite;
  sales: ScoringSeite;
  temperaturAb: TemperaturAb;
  /** Woher die Einstellungen stammen — nur Anzeige. */
  quelle?: 'standard' | 'vorschlag' | 'bisherig' | 'eigen';
  geaendert?: string;
  geaendertVon?: string;
}

/** Was der Kern von außen braucht — Teilnahmen und Events für die Signale Event/Make.One, Kampagnen für die Herkunft „Marketing“. */
export interface ScoringKontext {
  einstellungen?: ScoringEinstellungen;
  teilnahmen?: readonly Teilnahme[];
  events?: readonly Event[];
  kampagnen?: readonly Kampagne[];
}

// ── Marketing-Lead (03.10.) ──────────────────────────────────────────────────
// Kevin: „MQL sind nur die Leads, die aus dem Marketing kommen. Wenn jemand auf dem Event kommt, ist es ein Lead, bis es durch die
// Qualifragen gekommen ist.“ Eine Funktion entscheidet, ob ein Lead aus dem Marketing kommt — Lifecycle (MQL), Qualifizierungsrunde,
// Leads-Liste, Kennzahlen und ZOE fragen sie. Marketing sind (je Person der Firma, ein Treffer genügt):
//   anfrage     Website-/Inbound-Anfrage (eine Anfrage im Verlauf — nicht über Empfehlung/Event, nicht zu einem besuchten Event — oder
//               die Quelle; seit 08.10. NIE die Datenschutz-Herkunft „selbst angegeben“, Woche 1 · 5.1)
//   newsletter  Newsletter mit nachgewiesenem Double-Opt-in
//   kampagne    Mitglied einer gestarteten Kampagne (nicht Direktansprache: „LinkedIn vernetzen“, persönlich, Telefon) — oder Quelle „Kampagne“
//   inhalt      Content / Leadmagnet (Quelle Content, Beitrag, Newsletter, LinkedIn-Beitrag)
//   event       Anmeldung zu einem EIGENEN Event (Make.One) — selbst angemeldet oder per Mail/LinkedIn eingeladen, nicht persönlich/telefonisch
// Keine Marketing-Herkunft haben Begegnungen (besuchte Events, „Netzwerken“), Empfehlungen, Direktansprache, Recherche/Listen und
// der Bestand (HubSpot, Auftrag): Sie bleiben „Lead“, bis die Qualifizierung durch ist (Sales-Scoring + Muss-Kriterien → SQL).
export type MarketingQuelle = 'anfrage' | 'newsletter' | 'kampagne' | 'inhalt' | 'event';
export interface MarketingGrund { quelle: MarketingQuelle; text: string }
export const MARKETING_QUELLEN_LABEL: Record<MarketingQuelle, string> = {
  anfrage: 'Website-Anfrage', newsletter: 'Newsletter (Double-Opt-in)', kampagne: 'Kampagne', inhalt: 'Content / Leadmagnet', event: 'Anmeldung zu eigenem Event',
};
/** Kampagnen der Direktansprache zählen nicht als Marketing. */
const DIREKT_PLAYBOOKS: ReadonlySet<string> = new Set(['vernetzen']);
const DIREKT_KANAELE: ReadonlySet<string> = new Set(['persoenlich', 'telefon']);
const kampagnenMerk = new WeakMap<readonly Kampagne[], Set<string>>();
function marketingKampagnenPersonen(l: readonly Kampagne[]): Set<string> {
  let s = kampagnenMerk.get(l);
  if (!s) {
    s = new Set(l.filter(k => k.status !== 'entwurf' && !DIREKT_PLAYBOOKS.has(k.playbook) && !DIREKT_KANAELE.has(k.kanal)).flatMap(k => k.kontaktIds));
    kampagnenMerk.set(l, s);
  }
  return s;
}
/**
 * Anfrage-Kanäle, die KEIN Marketing sind (08.10., Woche 1 · 5.1): eine Anfrage nach einer Empfehlung oder auf einem Event ist eine
 * Begegnung, kein Marketing-Erfolg. Die Namen sind die Beschriftungen aus `ANFRAGE_KANAELE` (lib/crm/anfragen.ts) — dort steht die
 * Marke „Anfrage über <Kanal>: …“ (Wächter in tests/markttraktion-woche1.test.ts).
 */
export const ANFRAGE_OHNE_MARKETING: readonly string[] = ['Empfehlung', 'Event'];
/**
 * Ist diese Anfrage (Aktivität „Anfrage über …“) ein Marketing-Signal? Nein bei Kanal Empfehlung/Event und bei Bezug auf ein BESUCHTES
 * Event (Netzwerken — dort lernten wir die Person kennen). Ohne Events im Kontext lässt sich der Bezug nicht prüfen: dann zählt nur der Kanal.
 */
export function anfrageIstMarketing(a: Pick<Aktivitaet, 'text' | 'bezug'>, events?: readonly Event[]): boolean {
  const kanal = (a.text ?? '').slice(ANFRAGE_ANFANG.length).split(':')[0].trim();
  if (ANFRAGE_OHNE_MARKETING.includes(kanal)) return false;
  const e = a.bezug && events ? events.find(x => x.id === a.bezug) : undefined;
  return !(e && istNetzwerkenEvent(e));
}
/** Woher der Marketing-Lead kommt — leer, wenn er nicht aus dem Marketing stammt (dann „Lead · noch zu qualifizieren“). */
export function marketingHerkunft(personen: readonly Kontakt[], ctx: Pick<ScoringKontext, 'kampagnen' | 'teilnahmen' | 'events'> = {}): MarketingGrund[] {
  const gruende: MarketingGrund[] = [];
  const dazu = (quelle: MarketingQuelle) => { if (!gruende.some(g => g.quelle === quelle)) gruende.push({ quelle, text: MARKETING_QUELLEN_LABEL[quelle] }); };
  const ids = new Set(personen.map(p => p.id));
  for (const p of personen) {
    // 5.1 (08.10.): die Marketing-Herkunft kommt NICHT aus der Datenschutz-Herkunft (`herkunft` = Art. 14: „selbst angegeben“ heißt auch
    // „Visitenkarte überreicht“). Eine Anfrage zählt nur über ihre Marke im Verlauf — und nur, wenn sie ein Marketing-Signal ist.
    const anfragen = (p.aktivitaeten ?? []).filter(a => a.art === 'antwort' && (a.text ?? '').startsWith(ANFRAGE_ANFANG));
    const anfrageMarketing = anfragen.some(a => anfrageIstMarketing(a, ctx.events));
    if (anfrageMarketing) dazu('anfrage');
    if ((p.einwilligungen ?? []).some(e => e.kanal === 'newsletter' && !e.widerrufenAm && !nachweisLuecken(e).length)) dazu('newsletter');
    // Der Kanal aus der Liste/Quelle (ohne die Datenschutz-Herkunft). Hat die Person nur Anfragen ohne Marketing (Empfehlung, Event,
    // besuchtes Event), macht die Quelle „Anfrage über …“ sie nicht doch zum Marketing-Lead.
    const kanal = kanalVon({ ...p, herkunft: undefined });
    const nurBegegnung = anfragen.length > 0 && !anfrageMarketing;
    if (kanal === 'inbound' && !nurBegegnung) dazu('anfrage'); else if (kanal === 'content' && !nurBegegnung) dazu('inhalt'); else if (kanal === 'kampagne') dazu('kampagne');
  }
  if (ctx.kampagnen?.length) { const m = marketingKampagnenPersonen(ctx.kampagnen); if (personen.some(p => m.has(p.id))) dazu('kampagne'); }
  if (ctx.teilnahmen?.length && ctx.events?.length) {
    const events = new Map(ctx.events.map(e => [e.id, e]));
    // EINE Regel (`alsMarketingAnmeldung`, lib/crm/marke.ts) — dieselbe zählt die „Leads“ je Reihe (lib/crm/reihen.ts).
    for (const t of ctx.teilnahmen) {
      if (!ids.has(t.kontaktId)) continue;
      const e = events.get(t.eventId);
      if (!e || !alsMarketingAnmeldung(t, e)) continue;
      dazu('event'); break;
    }
  }
  return gruende;
}
/** Kommt dieser Lead aus dem Marketing? Nur dann kann er MQL werden (Kampagne, Newsletter, Anfrage, Content, eigenes Event). */
export const istMarketingLead = (personen: readonly Kontakt[], ctx: Pick<ScoringKontext, 'kampagnen' | 'teilnahmen' | 'events'> = {}): boolean => marketingHerkunft(personen, ctx).length > 0;

// ── Messfühler (aus den Daten gemessene Signale) ─────────────────────────────

interface MessKontext { heute: string; teilnahmen: readonly Teilnahme[]; events: readonly Event[] }
interface Messwert { stufe: string; grund: string }
interface MessungDef { label: string; hinweis: string; stufen: { id: string; text: string }[]; messen: (personen: readonly Kontakt[], k: MessKontext) => Messwert }

const tage = (a: string, b: string) => Math.round((Date.parse(`${b.slice(0, 10)}T12:00:00Z`) - Date.parse(`${a.slice(0, 10)}T12:00:00Z`)) / 864e5);
const zuletzt = (l: { am: string }[]) => l.map(a => a.am.slice(0, 10)).sort().pop();
const aktivitaeten = (personen: readonly Kontakt[]) => personen.flatMap(k => k.aktivitaeten ?? []);
const ANFRAGE_ANFANG = 'Anfrage über ';

/** Wärme — die bisherige Regel (Gespräch zuletzt, sonst Antwort, Ansprache, warmer Typ), verblasst nach 180 Tagen. */
function waermeMessen(personen: readonly Kontakt[], k: MessKontext): Messwert {
  const akt = aktivitaeten(personen);
  const gespraech = akt.filter(echtesGespraech).map(a => a.am.slice(0, 10)).concat(personen.map(p => p.letzterKontakt ?? '').filter(Boolean)).sort().pop();
  if (gespraech) {
    const t = tage(gespraech, k.heute);
    if (t <= 30) return { stufe: 'gespraech30', grund: `Echtes Gespräch vor ${t} Tagen` };
    if (t <= 90) return { stufe: 'gespraech90', grund: `Letztes Gespräch vor ${t} Tagen` };
    if (t <= 365) return { stufe: 'gespraech365', grund: `Letztes Gespräch vor ${t} Tagen — wieder aufwärmen` };
  }
  // Antwort und Ansprache verfallen: nach WAERME_VERFALL_TAGEN zählen sie nur noch wenig. Frische Signale gehen vor;
  // verblasste treten gegen den warmen Typ an (Reihenfolge fest: Typ vor alter Antwort vor alter Ansprache).
  const verblasst: Messwert[] = [];
  const antwortAm = zuletzt(akt.filter(a => a.art === 'antwort' || a.ergebnis === 'rueckruf'));
  if (antwortAm) {
    const t = tage(antwortAm, k.heute);
    if (t <= WAERME_VERFALL_TAGEN) return { stufe: 'antwort', grund: 'Hat geantwortet' };
    verblasst.push({ stufe: 'antwort_alt', grund: `Antwort liegt ${t} Tage zurück — abgekühlt` });
  }
  const angesprochenAm = zuletzt(akt.filter(a => a.von !== 'system' && (a.art === 'mail' || a.art === 'linkedin' || a.art === 'whatsapp' || a.art === 'anruf')));
  if (angesprochenAm) {
    const t = tage(angesprochenAm, k.heute);
    if (t <= WAERME_VERFALL_TAGEN) return { stufe: 'ansprache', grund: 'Angesprochen, noch keine Antwort' };
    verblasst.push({ stufe: 'ansprache_alt', grund: `Zuletzt vor ${t} Tagen angesprochen — abgekühlt` });
  } else if (!verblasst.length && personen.some(p => p.stufe === 'angesprochen')) {
    // Nur die Stufe aus der Liste, ohne datierte Ansprache — nicht zu altern, zählt wie bisher.
    return { stufe: 'ansprache', grund: 'Angesprochen, noch keine Antwort' };
  }
  if (personen.some(p => hatTyp(p, 'Netzwerk') || hatTyp(p, 'Kunde') || kategorieBeginnt(p, 'Apple') || /apple/i.test(p.quelle ?? ''))) return { stufe: 'typ', grund: 'Bekannt aus Netzwerk oder früherer Zusammenarbeit' };
  if (verblasst.length) return verblasst[0];
  return { stufe: 'keine', grund: 'Noch kein Kontakt' };
}

const weg = (nameWeg: string, stufeJa: string, hat: (p: readonly Kontakt[]) => boolean): ((p: readonly Kontakt[]) => Messwert) =>
  p => (hat(p) ? { stufe: stufeJa, grund: `${nameWeg} bekannt` } : { stufe: 'nein', grund: `${nameWeg} fehlt` });

const wegeZahl = (p: readonly Kontakt[]) => (p.some(k => (k.email ?? '').includes('@')) ? 1 : 0) + (p.some(k => k.telefon || k.sms) ? 1 : 0) + (p.some(k => k.linkedin) ? 1 : 0);

const RANG_EIGNUNG = (e: string) => (e === 'ja' ? 0 : e === 'vielleicht' ? 1 : e === '' ? 2 : 3);

/** Zeitstufen t30 / t90 / t(letzte) für „zuletzt vor n Tagen“. */
function zeitStufe(am: string | undefined, heute: string, grenzen: [number, number, number], name: string): Messwert {
  if (!am) return { stufe: 'keine', grund: `Kein ${name}` };
  const t = tage(am, heute);
  if (t <= grenzen[0]) return { stufe: `t${grenzen[0]}`, grund: `${name} vor ${t} Tagen` };
  if (t <= grenzen[1]) return { stufe: `t${grenzen[1]}`, grund: `${name} vor ${t} Tagen` };
  if (t <= grenzen[2]) return { stufe: `t${grenzen[2]}`, grund: `${name} vor ${t} Tagen` };
  return { stufe: 'keine', grund: `${name} liegt über ${grenzen[2]} Tage zurück` };
}

/** Teilnahmen der Personen, bei denen sie wirklich dabei waren — getrennt nach besuchtem Event (Netzwerken) und Make.One. */
function dabei(personen: readonly Kontakt[], k: MessKontext, besucht: boolean): number {
  const ids = new Set(personen.map(p => p.id));
  const events = new Map(k.events.map(e => [e.id, e]));
  const welche = new Set<string>();
  for (const t of k.teilnahmen) {
    if (t.status !== 'da' || !ids.has(t.kontaktId)) continue;
    const e = events.get(t.eventId);
    if (!e || istNetzwerkenEvent(e) !== besucht) continue;
    welche.add(t.eventId);
  }
  return welche.size;
}

export const MESSUNGEN: Record<MessungId, MessungDef> = {
  waerme: {
    label: 'Wärme', hinweis: 'Gespräch, Antwort, Ansprache oder bekannter Typ — verblasst nach 180 Tagen.',
    stufen: [
      { id: 'gespraech30', text: 'Echtes Gespräch in den letzten 30 Tagen' }, { id: 'gespraech90', text: 'Echtes Gespräch in den letzten 90 Tagen' },
      { id: 'gespraech365', text: 'Echtes Gespräch im letzten Jahr' }, { id: 'antwort', text: 'Hat in den letzten 180 Tagen geantwortet' },
      { id: 'ansprache', text: 'Angesprochen (180 Tage), noch keine Antwort' }, { id: 'typ', text: 'Bekannt aus Netzwerk oder früherer Zusammenarbeit' },
      { id: 'antwort_alt', text: 'Antwort liegt über 180 Tage zurück' }, { id: 'ansprache_alt', text: 'Ansprache liegt über 180 Tage zurück' }, { id: 'keine', text: 'Noch kein Kontakt' },
    ],
    messen: waermeMessen,
  },
  mail: { label: 'E-Mail bekannt', hinweis: 'Mindestens eine E-Mail-Adresse bei einer Person der Firma.', stufen: [{ id: 'ja', text: 'E-Mail bekannt' }, { id: 'nein', text: 'keine E-Mail' }], messen: weg('E-Mail', 'ja', p => p.some(k => (k.email ?? '').includes('@'))) },
  telefon: { label: 'Telefon bekannt', hinweis: 'Telefon oder Handynummer bei einer Person der Firma.', stufen: [{ id: 'ja', text: 'Telefon bekannt' }, { id: 'nein', text: 'kein Telefon' }], messen: weg('Telefon', 'ja', p => p.some(k => !!(k.telefon || k.sms))) },
  linkedin: { label: 'LinkedIn bekannt', hinweis: 'LinkedIn-Profil bei einer Person der Firma.', stufen: [{ id: 'ja', text: 'LinkedIn bekannt' }, { id: 'nein', text: 'kein LinkedIn' }], messen: weg('LinkedIn', 'ja', p => p.some(k => !!k.linkedin)) },
  erreichbar: {
    label: 'Erreichbarkeit', hinweis: 'Wie viele Wege (E-Mail, Telefon, LinkedIn) bekannt sind.',
    stufen: [{ id: 'drei', text: 'Drei Wege bekannt' }, { id: 'zwei', text: 'Zwei Wege bekannt' }, { id: 'eins', text: 'Ein Weg bekannt' }, { id: 'keine', text: 'Kein Weg bekannt' }],
    messen: p => { const n = wegeZahl(p); return n >= 3 ? { stufe: 'drei', grund: 'Erreichbar per E-Mail, Telefon und LinkedIn' } : n === 2 ? { stufe: 'zwei', grund: 'Zwei Wege bekannt' } : n === 1 ? { stufe: 'eins', grund: 'Ein Weg bekannt' } : { stufe: 'keine', grund: 'Kein Weg bekannt' }; },
  },
  eignung: {
    label: 'Vertriebseignung (Liste)', hinweis: 'Die Eignung aus der Masterliste — die beste Person der Firma zählt.',
    stufen: [{ id: 'ja', text: 'Passt zu unserem Kundenprofil' }, { id: 'vielleicht', text: 'Vielleicht' }, { id: 'offen', text: 'Noch offen' }, { id: 'nein', text: 'Kein Fit' }],
    messen: p => {
      const e = p.map(k => k.eignung as string).sort((a, b) => RANG_EIGNUNG(a) - RANG_EIGNUNG(b))[0] ?? '';
      return e === 'ja' ? { stufe: 'ja', grund: 'Vertriebseignung „ja“ aus der Liste' } : e === 'vielleicht' ? { stufe: 'vielleicht', grund: 'Vertriebseignung „vielleicht“' } : e === 'nein' ? { stufe: 'nein', grund: 'Vertriebseignung „nein“' } : { stufe: 'offen', grund: 'Fit noch offen' };
    },
  },
  gespraech: {
    label: 'Echtes Gespräch', hinweis: 'Wann zuletzt ein echtes Gespräch oder ein Termin stattfand.',
    stufen: [{ id: 't30', text: 'in den letzten 30 Tagen' }, { id: 't90', text: 'in den letzten 90 Tagen' }, { id: 't365', text: 'im letzten Jahr' }, { id: 'keine', text: 'kein Gespräch' }],
    messen: (p, k) => zeitStufe(aktivitaeten(p).filter(echtesGespraech).map(a => a.am.slice(0, 10)).concat(p.map(x => x.letzterKontakt ?? '').filter(Boolean)).sort().pop(), k.heute, [30, 90, 365], 'Gespräch'),
  },
  antwort: {
    label: 'Auf Ansprache geantwortet', hinweis: 'Wann zuletzt eine Antwort oder ein Rückruf kam.',
    stufen: [{ id: 't30', text: 'in den letzten 30 Tagen' }, { id: 't90', text: 'in den letzten 90 Tagen' }, { id: 't180', text: 'in den letzten 180 Tagen' }, { id: 'keine', text: 'keine Antwort' }],
    messen: (p, k) => zeitStufe(zuletzt(aktivitaeten(p).filter(a => (a.art === 'antwort' || a.ergebnis === 'rueckruf') && a.von !== 'system')), k.heute, [30, 90, 180], 'Antwort'),
  },
  termin: {
    label: 'Termin angefragt oder gebucht', hinweis: 'Ein Termin wurde vereinbart oder angefragt (Buchungsseite, Gespräch, Netzwerken).',
    stufen: [{ id: 't30', text: 'in den letzten 30 Tagen' }, { id: 't90', text: 'in den letzten 90 Tagen' }, { id: 'keine', text: 'kein Termin' }],
    messen: (p, k) => zeitStufe(zuletzt(aktivitaeten(p).filter(a => a.von !== 'system' && (a.art === 'termin' || a.ergebnis === 'termin'))), k.heute, [30, 90, 90], 'Termin'),
  },
  event: {
    label: 'Event besucht', hinweis: 'Bei einem besuchten (fremden) Event persönlich getroffen — Netzwerken.',
    stufen: [{ id: 'drei', text: 'Drei oder mehr Events' }, { id: 'zwei', text: 'Zwei Events' }, { id: 'eins', text: 'Ein Event' }, { id: 'keine', text: 'Kein Event' }],
    messen: (p, k) => { const n = dabei(p, k, true); return n >= 3 ? { stufe: 'drei', grund: `Bei ${n} besuchten Events getroffen` } : n === 2 ? { stufe: 'zwei', grund: 'Bei zwei besuchten Events getroffen' } : n === 1 ? { stufe: 'eins', grund: 'Bei einem besuchten Event getroffen' } : { stufe: 'keine', grund: 'Kein besuchtes Event' }; },
  },
  makeone: {
    label: 'Make.One-Gast', hinweis: 'War Gast an einem unserer eigenen Make.One-Abende.',
    stufen: [{ id: 'mehrere', text: 'Zwei oder mehr Abende' }, { id: 'eins', text: 'Ein Abend' }, { id: 'keine', text: 'Nie dabei' }],
    messen: (p, k) => { const n = dabei(p, k, false); return n >= 2 ? { stufe: 'mehrere', grund: `Gast an ${n} Make.One-Abenden` } : n === 1 ? { stufe: 'eins', grund: 'Gast an einem Make.One-Abend' } : { stufe: 'keine', grund: 'Kein Make.One-Abend' }; },
  },
  newsletter: {
    label: 'Newsletter mit Double-Opt-in', hinweis: 'Newsletter-Anmeldung — zählt voll nur mit vollständig nachgewiesenem Double-Opt-in.',
    stufen: [{ id: 'doi', text: 'Double-Opt-in nachgewiesen' }, { id: 'offen', text: 'angemeldet, Nachweis unvollständig' }, { id: 'keine', text: 'nicht angemeldet' }],
    messen: p => {
      const ew = p.flatMap(k => (k.einwilligungen ?? []).filter(e => e.kanal === 'newsletter' && !e.widerrufenAm));
      if (ew.some(e => !nachweisLuecken(e).length)) return { stufe: 'doi', grund: 'Newsletter mit nachgewiesenem Double-Opt-in' };
      return ew.length ? { stufe: 'offen', grund: 'Newsletter angemeldet, Nachweis unvollständig' } : { stufe: 'keine', grund: 'Nicht im Newsletter' };
    },
  },
  empfehlung: {
    label: 'Empfehlung', hinweis: 'Persönlich empfohlen oder aus dem eigenen Netzwerk.',
    stufen: [{ id: 'empfehlung', text: 'Persönlich empfohlen' }, { id: 'bekannt', text: 'Aus dem Netzwerk, persönlich bekannt' }, { id: 'keine', text: 'Keine Empfehlung' }],
    messen: p => (p.some(k => k.herkunft === 'empfehlung') ? { stufe: 'empfehlung', grund: 'Persönlich empfohlen' } : p.some(k => k.herkunft === 'bekannt' || hatTyp(k, 'Netzwerk')) ? { stufe: 'bekannt', grund: 'Aus dem Netzwerk, persönlich bekannt' } : { stufe: 'keine', grund: 'Keine Empfehlung' }),
  },
  anfrage: {
    label: 'Website-Anfrage', hinweis: 'Die Person hat selbst angefragt (Anfrageformular, Buchungsseite).',
    stufen: [{ id: 'ja', text: 'Hat selbst angefragt' }, { id: 'keine', text: 'Keine Anfrage' }],
    messen: p => (p.some(k => k.herkunft === 'selbst') || aktivitaeten(p).some(a => a.art === 'antwort' && (a.text ?? '').startsWith(ANFRAGE_ANFANG)) ? { stufe: 'ja', grund: 'Hat selbst angefragt' } : { stufe: 'keine', grund: 'Keine Anfrage' }),
  },
};
export const MESSUNG_IDS = Object.keys(MESSUNGEN) as MessungId[];
export const istMessung = (v: unknown): v is MessungId => typeof v === 'string' && v in MESSUNGEN;

// ── Standard (die bisherige Rechnung) und Vorschlag (geschärft) ──────────────

const FRAGEN_ALT: { id: keyof Kriterien; name: string; frage: string; deckel?: boolean }[] = [
  { id: 'schmerz', name: 'Schmerz', frage: 'Welches Problem kostet sie heute Geld, Zeit oder Nerven — konkret?', deckel: true },
  { id: 'entscheider', name: 'Entscheider', frage: 'Wer entscheidet und zahlt — und sprechen wir mit ihr oder ihm?', deckel: true },
  { id: 'budget', name: 'Budget', frage: 'Gibt es einen Rahmen, oder ist der Schmerz groß genug, einen zu schaffen?' },
  { id: 'zeitpunkt', name: 'Zeitpunkt', frage: 'Bis wann muss es gelöst sein — und warum dann?' },
  { id: 'wirkung', name: 'Wirkung', frage: 'Woran merken sie in sechs Monaten, dass es sich gelohnt hat?' },
  { id: 'alternative', name: 'Alternative', frage: 'Was tun sie, wenn sie nichts tun — oder mit wem sprechen sie noch?' },
];

const messKriterium = (id: string, messung: MessungId, punkte: Record<string, number>, gewicht?: number, name?: string): ScoringKriterium => ({
  id, name: name ?? MESSUNGEN[messung].label, hinweis: MESSUNGEN[messung].hinweis, quelle: 'messung', messung,
  stufen: MESSUNGEN[messung].stufen.filter(s => s.id in punkte).map(s => ({ id: s.id, text: s.text, punkte: punkte[s.id] })),
  ...(gewicht && gewicht !== 1 ? { gewicht } : {}),
});

/**
 * Die bisherige Rechnung (bis 03.10.): Fit 30 · Wärme 30 · Qualifizierung 30 · Erreichbarkeit 10 — genau die Rechnung von vor dem Umbau.
 * Seit 03.10. nicht mehr der Standard (Kevin: der geschärfte Vorschlag gilt sofort), aber als wählbare Fassung erhalten
 * („Bisherige Rechnung“) — und als Maßstab der Paritätsprüfung (tests/scoring-standard-paritaet.test.ts).
 */
export function bisherigeRechnung(): ScoringEinstellungen {
  return {
    version: SCORING_VERSION, quelle: 'bisherig',
    marketing: {
      // 35: ein frisches echtes Gespräch (30) und mindestens zwei Wege (E-Mail 4, Telefon 3, LinkedIn 3) — oder mehr. Die bisherige Rechnung
      // sollte das alte Verhalten treffen (MQL-Vorschlag erst bei „warm“): ein bekannter Typ (10) + erreichbar (10) reichen bewusst nicht.
      // Seit 03.10. entscheidet über den MQL zuerst die Herkunft (`istMarketingLead`), nicht die Schwelle — der neue Standard misst
      // die Signale selbst (Schwelle 8).
      schwelle: 35,
      muss: [],
      teile: [
        { id: 'waerme', name: 'Wärme', kriterien: [{ ...messKriterium('waerme', 'waerme', { gespraech30: 30, gespraech90: 20, gespraech365: 12, antwort: 12, ansprache: 8, typ: 10, antwort_alt: 5, ansprache_alt: 3, keine: 0 }), ohneAntwort: 'keine' }] },
        { id: 'erreichbarkeit', name: 'Erreichbar', kriterien: [
          messKriterium('mail', 'mail', { ja: 4, nein: 0 }), messKriterium('telefon', 'telefon', { ja: 3, nein: 0 }), messKriterium('linkedin', 'linkedin', { ja: 3, nein: 0 }),
        ] },
      ],
    },
    sales: {
      schwelle: 15,
      muss: [
        { kriterien: ['schmerz'], mindestens: 1, stufePunkte: 5 }, { kriterien: ['entscheider'], mindestens: 1, stufePunkte: 5 },
        { kriterien: ['budget', 'zeitpunkt'], mindestens: 1, stufePunkte: 5 },
      ],
      teile: [
        { id: 'fit', name: 'Fit', kriterien: [{
          id: 'fit', name: 'Fit zu uns', hinweis: 'Passt die Firma zu unserem Kundenprofil? Ohne Antwort zählt die Vertriebseignung aus der Liste.', quelle: 'frage', messung: 'eignung', alt: 'fit',
          stufen: [{ id: 'ja', text: 'Passt', punkte: 30 }, { id: 'vielleicht', text: 'Vielleicht', punkte: 15 }, { id: 'offen', text: 'Noch offen', punkte: 8 }, { id: 'nein', text: 'Kein Fit', punkte: 0 }],
          ohneAntwort: 'offen',
        }] },
        { id: 'qualifizierung', name: 'Qualifizierung', kriterien: FRAGEN_ALT.map(f => ({
          id: f.id, name: f.name, hinweis: f.frage, quelle: 'frage' as const, alt: f.id,
          stufen: [{ id: 'ja', text: 'ja — geklärt', punkte: 5 }, { id: 'nein', text: 'nein — trifft nicht zu', punkte: 0, ...(f.deckel ? { deckel: 10 } : {}) }],
        })) },
      ],
    },
    temperaturAb: { lau: 25, warm: 50, heiss: 75 },
  };
}

const stufen135 = (t5: string, t3: string, t1: string, t0: string): ScoringStufe[] => [
  { id: 's5', text: t5, punkte: 5 }, { id: 's3', text: t3, punkte: 3 }, { id: 's1', text: t1, punkte: 1 }, { id: 's0', text: t0, punkte: 0 },
];
const frage135 = (id: string, name: string, hinweis: string, t5: string, t3: string, t1: string, t0: string, extra: Partial<ScoringKriterium> = {}): ScoringKriterium =>
  ({ id, name, hinweis, quelle: 'frage', stufen: stufen135(t5, t3, t1, t0), ...extra });

let standardMerk: ScoringEinstellungen | null = null;
/** Der Standard zum Rechnen — einmal gebaut und nie verändert (die Rechnung läuft pro Lead hunderte Male). Wer bearbeitet, nimmt `standardScoring()`. */
export const standardZumRechnen = (): ScoringEinstellungen => (standardMerk ??= standardScoring());

/**
 * Der Standard (seit 03.10., Kevin: „sofort übernehmen“): geschärfte Kriterien (MEDDICC/BANT), Stufen 1 · 3 · 5, Muss-Kriterien
 * Schmerz, Entscheider und Budget oder Zeitpunkt. Wer keine eigenen Einstellungen gespeichert hat, rechnet damit.
 */
export function standardScoring(): ScoringEinstellungen {
  return {
    version: SCORING_VERSION, quelle: 'standard',
    marketing: {
      schwelle: 8,
      muss: [],
      teile: [
        { id: 'signale', name: 'Interaktionen & Signale', kriterien: [
          messKriterium('gespraech', 'gespraech', { t30: 5, t90: 3, t365: 1, keine: 0 }, 2),
          messKriterium('antwort', 'antwort', { t30: 5, t90: 3, t180: 1, keine: 0 }, 2),
          messKriterium('termin', 'termin', { t30: 5, t90: 3, keine: 0 }),
          messKriterium('event', 'event', { drei: 5, zwei: 3, eins: 1, keine: 0 }),
          messKriterium('makeone', 'makeone', { mehrere: 5, eins: 3, keine: 0 }),
          messKriterium('newsletter', 'newsletter', { doi: 3, offen: 1, keine: 0 }),
          messKriterium('empfehlung', 'empfehlung', { empfehlung: 5, bekannt: 3, keine: 0 }),
          messKriterium('anfrage', 'anfrage', { ja: 5, keine: 0 }),
        ] },
        { id: 'erreichbarkeit', name: 'Erreichbarkeit', kriterien: [messKriterium('erreichbar', 'erreichbar', { drei: 5, zwei: 3, eins: 1, keine: 0 })] },
      ],
    },
    sales: {
      schwelle: 28,
      muss: [
        { kriterien: ['schmerz'], mindestens: 1, stufePunkte: 3 }, { kriterien: ['entscheider'], mindestens: 1, stufePunkte: 3 },
        { kriterien: ['budget', 'zeitpunkt'], mindestens: 1, stufePunkte: 3 },
      ],
      teile: [
        { id: 'fit', name: 'Fit', kriterien: [
          { id: 'fit', name: 'Passt zu unserem Kundenprofil', hinweis: 'Ohne Antwort zählt die Vertriebseignung aus der Liste.', quelle: 'frage', messung: 'eignung', alt: 'fit',
            stufen: [{ id: 'ja', text: 'Passt', punkte: 5 }, { id: 'vielleicht', text: 'Vielleicht', punkte: 3 }, { id: 'offen', text: 'Noch offen', punkte: 1 }, { id: 'nein', text: 'Kein Fit', punkte: 0 }], ohneAntwort: 'offen' },
          frage135('groesse', 'Unternehmensgröße', 'Wie groß ist das Unternehmen — Mitarbeitende, Umsatz, eigene Geschäftsführung?',
            'Kernzielgruppe: Mittelstand mit eigener Geschäftsführung, grob 10–250 Mitarbeitende', 'Randbereich: kleiner (Gründer, Team unter 10) oder größer (Konzerntochter)', 'Entfernt: Solo-Selbstständige ohne Team oder Konzern mit Zentraleinkauf', 'Passt nicht'),
          frage135('passung', 'Passung & Chemie', 'Wie gut passt das Gespräch zu uns — Haltung, Tempo, Erwartung an Zusammenarbeit?',
            'Sehr gut: gleiche Sprache, klare Erwartung, Lust auf Zusammenarbeit', 'Gut, aber mit Fragezeichen bei Erwartung oder Tempo', 'Holprig: Erwartung und Angebot liegen weit auseinander', 'Keine Passung'),
        ] },
        { id: 'qualifikation', name: 'Qualifikation (MEDDICC · BANT)', kriterien: [
          { ...frage135('schmerz', 'Schmerz', FRAGEN_ALT[0].frage, 'Konkret und beziffert: Zahl, Beispiel oder Zitat liegt vor', 'Benannt, aber noch vage — Folgen nicht beziffert', 'Nur vermutet, nicht bestätigt', 'Kein Schmerz erkennbar'), alt: 'schmerz', gewicht: 2 },
          { ...frage135('entscheider', 'Entscheider', FRAGEN_ALT[1].frage, 'Die Entscheiderin oder der Entscheider spricht selbst mit uns', 'Entscheider bekannt, Zugang nur über Dritte', 'Unklar, wer entscheidet und zahlt', 'Kein Zugang zur Entscheidung'), alt: 'entscheider', gewicht: 2 },
          { ...frage135('budget', 'Budget', FRAGEN_ALT[2].frage, 'Rahmen genannt oder freigegeben', 'Kein Rahmen, aber der Schmerz ist groß genug, einen zu schaffen', 'Budget unklar', 'Kein Budget'), alt: 'budget' },
          { ...frage135('zeitpunkt', 'Zeitpunkt', FRAGEN_ALT[3].frage, 'Entscheidung binnen drei Monaten, mit konkretem Anlass', 'Entscheidung binnen zwölf Monaten', 'Irgendwann, ohne Anlass', 'Kein Zeitfenster'), alt: 'zeitpunkt' },
          frage135('champion', 'Fürsprecher im Haus', 'Wer treibt das Thema intern — und setzt sich für uns ein?', 'Ein interner Fürsprecher treibt aktiv', 'Wohlwollender Kontakt, aber ohne Einfluss', 'Neutral, kein erkennbarer Fürsprecher', 'Niemand oder eine Gegenstimme'),
          frage135('prozess', 'Entscheidungsprozess', 'Wie wird entschieden — wer ist beteiligt, nach welchen Kriterien, bis wann?', 'Ablauf und Kriterien sind klar und besprochen', 'Teilweise klar', 'Unklar', 'Nicht erkennbar'),
          { ...frage135('wirkung', 'Wirkung', FRAGEN_ALT[4].frage, 'Messbares Ziel in sechs Monaten benannt', 'Erwartung benannt, aber nicht messbar', 'Unklar, woran man Erfolg merkt', 'Keine Erwartung'), alt: 'wirkung' },
          { ...frage135('alternative', 'Alternative', FRAGEN_ALT[5].frage, 'Kein Wettbewerber im Spiel, Nichtstun kostet spürbar', 'Vergleich mit ein bis zwei Anbietern', 'Breite Auswahl oder Ausschreibung', 'Intern gelöst, kein Bedarf an Extern'), alt: 'alternative' },
        ] },
        { id: 'potenzial', name: 'Potenzial', kriterien: [
          frage135('folge', 'Folgeauftrag & Empfehlung', 'Was kann daraus werden — Folgeauftrag, Beteiligung, weitere Kontakte im Netzwerk?',
            'Mehrstufig: Folgeauftrag oder Beteiligung absehbar, starker Netzwerkhebel', 'Folgeauftrag wahrscheinlich', 'Einmaliger Auftrag', 'Kein Potenzial über den ersten Schritt hinaus'),
        ] },
      ],
    },
    // Der Gesamtwert ist der Anteil an ALLEN möglichen Punkten (hier 123): wer erst wenige der zwölf Fragen beantwortet hat, liegt zwangsläufig
    // niedrig — deshalb sind die Stufen enger als beim Standard (dort 25 / 50 / 75), damit die Verteilung kalt/lau/warm vergleichbar bleibt.
    temperaturAb: { lau: 5, warm: 12, heiss: 25 },
  };
}

// ── Prüfen und säubern ───────────────────────────────────────────────────────

export const SCORING_GRENZEN = { teileJeSeite: 6, kriterienJeSeite: 30, stufenJeKriterium: 8, stufenJeMessung: 12, musseJeSeite: 8, name: 60, hinweis: 400, stufenText: 200, punkteMax: 100, schwelleMax: 1000, gewichtMin: 0.5, gewichtMax: 10 } as const;
const ID = /^[a-z][a-z0-9_-]{0,30}$/;
const zahl = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const rund2 = (n: number) => Math.round(n * 100) / 100;

export interface ScoringFehler { pfad: string; text: string; status?: 400 | 413 }

/** Prüft rohe Einstellungen und nennt JEDEN Fehler mit Pfad — nichts wird still gekürzt oder geändert. */
export function scoringPruefen(roh: unknown): ScoringFehler[] {
  const f: ScoringFehler[] = [];
  const fehler = (pfad: string, text: string, status?: 400 | 413) => f.push({ pfad, text, ...(status ? { status } : {}) });
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return [{ pfad: '', text: 'Die Einstellungen fehlen.' }];
  const o = roh as Record<string, unknown>;
  const ta = o.temperaturAb as Record<string, unknown> | undefined;
  const lau = zahl(ta?.lau), warm = zahl(ta?.warm), heiss = zahl(ta?.heiss);
  if (lau === null || warm === null || heiss === null || !(lau > 0 && lau < warm && warm < heiss && heiss <= 100)) fehler('temperaturAb', 'Temperatur: lau < warm < heiß, jeweils zwischen 1 und 100 Punkten.');
  for (const seite of ['marketing', 'sales'] as const) {
    const s = o[seite] as Record<string, unknown> | undefined;
    const sn = seite === 'marketing' ? 'Marketing' : 'Sales';
    if (!s || typeof s !== 'object') { fehler(seite, `${sn}: fehlt.`); continue; }
    const schwelle = zahl(s.schwelle);
    if (schwelle === null || schwelle < 0 || schwelle > SCORING_GRENZEN.schwelleMax) fehler(`${seite}.schwelle`, `${sn}: Schwelle zwischen 0 und ${SCORING_GRENZEN.schwelleMax} Punkten.`);
    const teile = Array.isArray(s.teile) ? s.teile as Record<string, unknown>[] : null;
    if (!teile || !teile.length) { fehler(`${seite}.teile`, `${sn}: mindestens ein Block.`); continue; }
    if (teile.length > SCORING_GRENZEN.teileJeSeite) fehler(`${seite}.teile`, `${sn}: höchstens ${SCORING_GRENZEN.teileJeSeite} Blöcke.`, 413);
    const teilIds = new Set<string>(), kritIds = new Map<string, Record<string, unknown>>();
    let anzahl = 0;
    teile.forEach((t, ti) => {
      const tp = `${seite}.teile[${ti}]`;
      if (!t || typeof t !== 'object') return fehler(tp, `${sn}: Block ${ti + 1} ist kein Block.`);
      const tid = String(t.id ?? '');
      if (!ID.test(tid)) fehler(`${tp}.id`, `${sn}: Block „${String(t.name ?? '')}“ hat keine gültige Kennung.`);
      else if (teilIds.has(tid)) fehler(`${tp}.id`, `${sn}: Block-Kennung „${tid}“ kommt doppelt vor.`);
      teilIds.add(tid);
      const tname = String(t.name ?? '').trim();
      if (!tname || tname.length > SCORING_GRENZEN.name) fehler(`${tp}.name`, `${sn}: der Block braucht einen Namen (höchstens ${SCORING_GRENZEN.name} Zeichen).`);
      const krits = Array.isArray(t.kriterien) ? t.kriterien as Record<string, unknown>[] : null;
      if (!krits || !krits.length) return fehler(`${tp}.kriterien`, `${sn}: Block „${tname}“ ohne Kriterium.`);
      krits.forEach((k, ki) => {
        anzahl++;
        const kp = `${tp}.kriterien[${ki}]`;
        if (!k || typeof k !== 'object') return fehler(kp, `${sn}: Kriterium ${ki + 1} in „${tname}“ ist kein Kriterium.`);
        const kid = String(k.id ?? ''), kname = String(k.name ?? '').trim();
        const wo = `${sn}: „${kname || kid}“`;
        if (!ID.test(kid)) fehler(`${kp}.id`, `${wo}: ungültige Kennung.`);
        else if (kritIds.has(kid)) fehler(`${kp}.id`, `${wo}: Kennung „${kid}“ kommt doppelt vor.`);
        kritIds.set(kid, k);
        if (!kname || kname.length > SCORING_GRENZEN.name) fehler(`${kp}.name`, `${wo}: Name fehlt oder ist zu lang (höchstens ${SCORING_GRENZEN.name} Zeichen).`);
        if (k.hinweis !== undefined && (typeof k.hinweis !== 'string' || k.hinweis.length > SCORING_GRENZEN.hinweis)) fehler(`${kp}.hinweis`, `${wo}: Frage/Hinweis zu lang (höchstens ${SCORING_GRENZEN.hinweis} Zeichen).`);
        if (k.quelle !== 'messung' && k.quelle !== 'frage') fehler(`${kp}.quelle`, `${wo}: quelle ist messung oder frage.`);
        if ((k.quelle === 'messung' || k.messung !== undefined) && !istMessung(k.messung)) fehler(`${kp}.messung`, `${wo}: unbekannte Messung.`);
        if (k.quelle === 'messung' && seite === 'sales') fehler(`${kp}.quelle`, `${wo}: Sales-Kriterien werden im Gespräch beantwortet (frage), nicht gemessen.`);
        if (k.quelle === 'frage' && seite === 'marketing') fehler(`${kp}.quelle`, `${wo}: Marketing-Kriterien werden aus den Daten gemessen.`);
        if (k.alt !== undefined && !(ALT_FELDER as readonly unknown[]).includes(k.alt)) fehler(`${kp}.alt`, `${wo}: unbekanntes altes Feld.`);
        if (k.alt !== undefined && k.quelle !== 'frage') fehler(`${kp}.alt`, `${wo}: ein altes Feld gehört nur zu einer Frage.`);
        if (k.gewicht !== undefined) { const g = zahl(k.gewicht); if (g === null || g < SCORING_GRENZEN.gewichtMin || g > SCORING_GRENZEN.gewichtMax) fehler(`${kp}.gewicht`, `${wo}: Gewicht zwischen ${SCORING_GRENZEN.gewichtMin} und ${SCORING_GRENZEN.gewichtMax}.`); }
        const st = Array.isArray(k.stufen) ? k.stufen as Record<string, unknown>[] : null;
        if (!st || st.length < (k.quelle === 'frage' ? 2 : 1)) return fehler(`${kp}.stufen`, `${wo}: ${k.quelle === 'frage' ? 'mindestens zwei Stufen' : 'mindestens eine Stufe'}.`);
        const stufenMax = k.quelle === 'messung' ? SCORING_GRENZEN.stufenJeMessung : SCORING_GRENZEN.stufenJeKriterium;
        if (st.length > stufenMax) fehler(`${kp}.stufen`, `${wo}: höchstens ${stufenMax} Stufen.`, 413);
        const sids = new Set<string>();
        st.forEach((s, si) => {
          const sp = `${kp}.stufen[${si}]`;
          if (!s || typeof s !== 'object') return fehler(sp, `${wo}: Stufe ${si + 1} ist keine Stufe.`);
          const sid = String(s.id ?? '');
          if (!ID.test(sid)) fehler(`${sp}.id`, `${wo}: Stufe ${si + 1} hat keine gültige Kennung.`);
          else if (sids.has(sid)) fehler(`${sp}.id`, `${wo}: Stufen-Kennung „${sid}“ kommt doppelt vor.`);
          sids.add(sid);
          const text = String(s.text ?? '').trim();
          if (!text || text.length > SCORING_GRENZEN.stufenText) fehler(`${sp}.text`, `${wo}: Stufe ${si + 1} braucht einen Text (höchstens ${SCORING_GRENZEN.stufenText} Zeichen).`);
          const p = zahl(s.punkte);
          if (p === null || p < 0 || p > SCORING_GRENZEN.punkteMax) fehler(`${sp}.punkte`, `${wo}: Punkte zwischen 0 und ${SCORING_GRENZEN.punkteMax}.`);
          if (s.deckel !== undefined) { const d = zahl(s.deckel); if (d === null || d < 0 || d > SCORING_GRENZEN.schwelleMax) fehler(`${sp}.deckel`, `${wo}: Deckel zwischen 0 und ${SCORING_GRENZEN.schwelleMax}.`); }
          if (k.quelle === 'messung' && istMessung(k.messung) && !MESSUNGEN[k.messung].stufen.some(m => m.id === sid)) fehler(`${sp}.id`, `${wo}: die Messung „${MESSUNGEN[k.messung].label}“ kennt keine Stufe „${sid}“.`);
        });
        if (k.ohneAntwort !== undefined && !sids.has(String(k.ohneAntwort))) fehler(`${kp}.ohneAntwort`, `${wo}: die Stufe für „ohne Antwort“ gibt es nicht.`);
      });
    });
    if (anzahl > SCORING_GRENZEN.kriterienJeSeite) fehler(`${seite}.teile`, `${sn}: höchstens ${SCORING_GRENZEN.kriterienJeSeite} Kriterien.`, 413);
    const muss = Array.isArray(s.muss) ? s.muss as Record<string, unknown>[] : s.muss === undefined ? [] : null;
    if (!muss) fehler(`${seite}.muss`, `${sn}: muss ist eine Liste.`);
    else {
      if (muss.length > SCORING_GRENZEN.musseJeSeite) fehler(`${seite}.muss`, `${sn}: höchstens ${SCORING_GRENZEN.musseJeSeite} Muss-Kriterien.`, 413);
      muss.forEach((m, mi) => {
        const mp = `${seite}.muss[${mi}]`;
        const ids = Array.isArray(m?.kriterien) ? m.kriterien.map(String) : [];
        if (!ids.length || ids.some(i => !kritIds.has(i))) return fehler(mp, `${sn}: ein Muss-Kriterium verweist auf ein Kriterium, das es nicht gibt.`);
        const n = zahl(m.mindestens), sp = zahl(m.stufePunkte);
        if (n === null || !Number.isInteger(n) || n < 1 || n > ids.length) fehler(`${mp}.mindestens`, `${sn}: „mindestens“ liegt zwischen 1 und ${ids.length}.`);
        if (sp === null || sp < 0 || sp > SCORING_GRENZEN.punkteMax) fehler(`${mp}.stufePunkte`, `${sn}: Mindeststufe zwischen 0 und ${SCORING_GRENZEN.punkteMax} Punkten.`);
      });
    }
  }
  return f;
}

/** Aus geprüften Rohdaten die saubere Form (nur Bekanntes, Zahlen gerundet). Null, wenn die Prüfung etwas findet. */
export function scoringSaeubern(roh: unknown, vermerk?: { quelle?: ScoringEinstellungen['quelle']; geaendert?: string; geaendertVon?: string }): ScoringEinstellungen | null {
  if (scoringPruefen(roh).length) return null;
  const o = roh as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- nach scoringPruefen strukturell gesichert
  const stufe = (s: Record<string, any>): ScoringStufe => ({ id: String(s.id), text: String(s.text).trim(), punkte: rund2(Number(s.punkte)), ...(s.deckel !== undefined ? { deckel: rund2(Number(s.deckel)) } : {}) }); // eslint-disable-line @typescript-eslint/no-explicit-any
  const krit = (k: Record<string, any>): ScoringKriterium => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
    id: String(k.id), name: String(k.name).trim(), ...(typeof k.hinweis === 'string' && k.hinweis.trim() ? { hinweis: k.hinweis.trim() } : {}),
    quelle: k.quelle, ...(k.messung ? { messung: k.messung as MessungId } : {}), ...(k.alt ? { alt: k.alt as AltFeld } : {}),
    stufen: (k.stufen as Record<string, unknown>[]).map(s => stufe(s)), ...(k.ohneAntwort !== undefined ? { ohneAntwort: String(k.ohneAntwort) } : {}),
    ...(k.gewicht !== undefined && rund2(Number(k.gewicht)) !== 1 ? { gewicht: rund2(Number(k.gewicht)) } : {}), ...(k.aus ? { aus: true } : {}),
  });
  const seite = (s: Record<string, any>): ScoringSeite => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
    schwelle: rund2(Number(s.schwelle)),
    teile: (s.teile as Record<string, any>[]).map(t => ({ id: String(t.id), name: String(t.name).trim(), kriterien: (t.kriterien as Record<string, unknown>[]).map(k => krit(k)) })), // eslint-disable-line @typescript-eslint/no-explicit-any
    muss: ((s.muss ?? []) as Record<string, any>[]).map(m => ({ kriterien: (m.kriterien as unknown[]).map(String), mindestens: Number(m.mindestens), stufePunkte: rund2(Number(m.stufePunkte)) })), // eslint-disable-line @typescript-eslint/no-explicit-any
  });
  return {
    version: SCORING_VERSION, marketing: seite(o.marketing), sales: seite(o.sales),
    temperaturAb: { lau: Number(o.temperaturAb.lau), warm: Number(o.temperaturAb.warm), heiss: Number(o.temperaturAb.heiss) },
    ...(vermerk?.quelle ? { quelle: vermerk.quelle } : o.quelle === 'standard' || o.quelle === 'vorschlag' || o.quelle === 'bisherig' || o.quelle === 'eigen' ? { quelle: o.quelle } : {}),
    ...(vermerk?.geaendert ? { geaendert: vermerk.geaendert } : typeof o.geaendert === 'string' ? { geaendert: o.geaendert } : {}),
    ...(vermerk?.geaendertVon ? { geaendertVon: vermerk.geaendertVon } : typeof o.geaendertVon === 'string' ? { geaendertVon: o.geaendertVon } : {}),
  };
}

/** Wie `scoringSaeubern`, aber mit Rückfall auf den Standard (Lesen eines beschädigten Bestands) — nie null. */
export const scoringOderStandard = (roh: unknown): ScoringEinstellungen => scoringSaeubern(roh) ?? standardScoring();

// ── Rechnen ──────────────────────────────────────────────────────────────────

export interface KriteriumErgebnis {
  id: string; name: string; teilId: string; quelle: 'messung' | 'frage';
  stufeId?: string; stufeText?: string; punkte: number; max: number;
  /** Eine Frage ohne eigene Antwort (nur aus der Liste abgeleitet oder gar nichts) bzw. nichts messbar — in der Runde „noch offen“. */
  offen: boolean;
  /** Es gibt einen Wert (gewählt, alte Antwort oder gemessen) — nur dann zählt das Kriterium für „Muss“. */
  beantwortet: boolean;
  /** Woher der Wert kommt: am Lead gewählt · alte Antwort ja/nein · gemessen · keine Antwort. */
  herkunft: 'lead' | 'alt' | 'messung' | 'ohne';
  grund: string;
  /** Rohe Stufenpunkte (ohne Gewicht) der gewählten Stufe — für die Muss-Prüfung. */
  stufePunkte: number;
}
export interface TeilErgebnis { id: string; name: string; seite: ScoringSeiteId; punkte: number; max: number; kriterien: KriteriumErgebnis[]; gedeckeltAuf?: number; grund: string }
/** Ein Muss-Kriterium am Lead: Text, erfüllt — und die Kriterien dahinter (08.10., Woche 1 · 2.1: die Runde zählt nur offene Muss-Fragen). */
export interface MussErgebnis { text: string; ok: boolean; kriterien: string[] }
export interface SeitenErgebnis {
  seite: ScoringSeiteId; punkte: number; max: number; schwelle: number; erreicht: boolean;
  /**
   * Gilt die Seite für diesen Lead? Das Marketing-Scoring gilt nur für Leads aus dem Marketing (`istMarketingLead`); bei allen anderen
   * (Begegnung, Empfehlung, Direktansprache, Bestand) ist `gilt` false und `erreicht` immer false — der Lead bleibt „Lead · noch zu
   * qualifizieren“. Die Punkte werden trotzdem gerechnet (Wärme für die Reihenfolge in der Runde), sie führen nur nie zum MQL.
   */
  gilt: boolean;
  /** Was bis zur Schwelle fehlt, in der Reihenfolge, in der man fragt (Muss-Kriterien zuerst, dann Punkte). */
  fehlt: string[]; muss: MussErgebnis[]; teile: TeilErgebnis[];
}
export interface ScoringErgebnis {
  marketing: SeitenErgebnis; sales: SeitenErgebnis; gesamt: number;
  /** Kommt der Lead aus dem Marketing — und woher (leer = nein). */
  marketingLead: boolean; marketingHerkunft: MarketingGrund[];
}

/** Was an einem Lead beantwortet ist: neue Stufen, dazu die alten Felder (`kriterien`, `fit`). */
export type LeadAntworten = Pick<Lead, 'kriterien' | 'fit' | 'stufen'> | { kriterien?: Kriterien; fit?: Qual; stufen?: Record<string, string> };

const mitGewicht = (k: ScoringKriterium) => k.gewicht ?? 1;
const hoechste = (st: ScoringStufe[]) => st.reduce((a, b) => (b.punkte > a.punkte ? b : a));
const niedrigste = (st: ScoringStufe[]) => st.reduce((a, b) => (b.punkte < a.punkte ? b : a));

/** Die alte Antwort (ja/nein/unklar) als Stufe dieses Kriteriums: ja = beste, nein = schlechteste, unklar = keine. */
function altAntwort(k: ScoringKriterium, l: LeadAntworten | undefined): ScoringStufe | undefined {
  if (!k.alt || !l) return undefined;
  const w: Qual | undefined = k.alt === 'fit' ? l.fit : l.kriterien?.[k.alt];
  if (w === 'ja') return hoechste(k.stufen);
  if (w === 'nein') return niedrigste(k.stufen);
  return undefined;
}

function kriteriumRechnen(k: ScoringKriterium, teilId: string, personen: readonly Kontakt[], lead: LeadAntworten | undefined, mk: MessKontext): KriteriumErgebnis {
  const max = Math.max(...k.stufen.map(s => s.punkte)) * mitGewicht(k);
  const basis = { id: k.id, name: k.name, teilId, quelle: k.quelle, max: Math.round(max * 100) / 100 };
  const fertig = (s: ScoringStufe | undefined, grund: string, herkunft: KriteriumErgebnis['herkunft']): KriteriumErgebnis => {
    const roh = s?.punkte ?? 0;
    const beantwortet = !!s && herkunft !== 'ohne';
    return {
      ...basis, ...(s ? { stufeId: s.id, stufeText: s.text } : {}), punkte: Math.round(roh * mitGewicht(k) * 100) / 100, stufePunkte: roh, grund, herkunft, beantwortet,
      offen: k.quelle === 'frage' ? herkunft === 'messung' || herkunft === 'ohne' : !s,
    };
  };
  const nachId = (id: string | undefined) => k.stufen.find(s => s.id === id);
  // 1. die gewählte Stufe am Lead
  const gewaehlt = nachId(lead?.stufen?.[k.id]);
  if (gewaehlt) return fertig(gewaehlt, `${k.name}: ${gewaehlt.text}`, 'lead');
  // 2. die alte Antwort (Kernfrage ja/nein, Fit ja/nein)
  const alt = altAntwort(k, lead);
  if (alt) return fertig(alt, `${k.name}: ${alt.text}`, 'alt');
  // 3. die Messung (Signal, oder bei „Fit“ der Rückfall auf die Liste)
  if (k.messung) {
    const m = MESSUNGEN[k.messung].messen(personen, mk);
    const s = nachId(m.stufe);
    if (s) return fertig(s, m.grund, 'messung');
  }
  // 4. ohne Antwort
  const ohne = nachId(k.ohneAntwort);
  return fertig(ohne, ohne ? `${k.name}: ${ohne.text}` : `${k.name}: noch offen`, 'ohne');
}

function teilGrund(t: TeilErgebnis): string {
  const fragen = t.kriterien.filter(k => k.quelle === 'frage');
  if (fragen.length > 1) {
    const geklaert = fragen.filter(k => k.herkunft === 'lead' || k.herkunft === 'alt').filter(k => k.punkte > 0).length;
    const deckel = t.gedeckeltAuf !== undefined ? ` — ein Ausschluss deckelt auf ${t.gedeckeltAuf} Punkte` : '';
    return geklaert ? `${geklaert} von ${fragen.length} geklärt${deckel}` : `Noch keine Frage geklärt${deckel}`;
  }
  const treffer = t.kriterien.filter(k => k.punkte > 0);
  if (treffer.length) return treffer.map(k => k.grund).join(' · ');
  return t.kriterien.length === 1 ? t.kriterien[0].grund : 'Noch nichts erkennbar';
}

/** Ein Muss-Kriterium als Satz: „Schmerz“ · „Budget oder Zeitpunkt“ · „mindestens 2 von …“ — EINE Formulierung für Lead, Runde und Texte. */
export function mussText(m: ScoringMuss, nameVon: (id: string) => string): string {
  const namen = m.kriterien.map(nameVon);
  return m.kriterien.length === 1 ? namen[0] : m.mindestens === 1 ? namen.join(' oder ') : `mindestens ${m.mindestens} von ${namen.join(', ')}`;
}

/**
 * Die SQL-Regel der Einstellungen in einem Satz (08.10., Woche 1 · 2.6) — statt fester Texte („Schmerz, Entscheider und Budget oder
 * Zeitpunkt“), die nach einer Änderung der Scoring-Einstellungen nicht mehr stimmten. Beispiel Standard:
 * „Muss: Schmerz · Entscheider · Budget oder Zeitpunkt — dazu mindestens 28 Sales-Punkte“.
 */
export function sqlRegelText(e: Pick<ScoringEinstellungen, 'sales'>): string {
  const namen = new Map(e.sales.teile.flatMap(t => t.kriterien).map(k => [k.id, k.name]));
  const muss = e.sales.muss.map(m => mussText(m, id => namen.get(id) ?? id));
  const punkte = `mindestens ${e.sales.schwelle} Sales-Punkte`;
  return muss.length ? `Muss: ${muss.join(' · ')} — dazu ${punkte}` : punkte;
}

function seiteRechnen(seite: ScoringSeiteId, s: ScoringSeite, personen: readonly Kontakt[], lead: LeadAntworten | undefined, mk: MessKontext): SeitenErgebnis {
  const alle: KriteriumErgebnis[] = [];
  const teile: TeilErgebnis[] = s.teile.map(t => {
    const kriterien = t.kriterien.filter(k => !k.aus).map(k => kriteriumRechnen(k, t.id, personen, lead, mk));
    alle.push(...kriterien);
    const summe = kriterien.reduce((a, k) => a + k.punkte, 0);
    const deckel = t.kriterien.filter(k => !k.aus).map((k, i) => ({ k, e: kriterien[i] })).map(({ k, e }) => k.stufen.find(st => st.id === e.stufeId)?.deckel).filter((d): d is number => d !== undefined);
    const gedeckeltAuf = deckel.length ? Math.min(...deckel) : undefined;
    const punkte = Math.round((gedeckeltAuf !== undefined ? Math.min(gedeckeltAuf, summe) : summe) * 100) / 100;
    const e: TeilErgebnis = { id: t.id, name: t.name, seite, punkte, max: Math.round(kriterien.reduce((a, k) => a + k.max, 0) * 100) / 100, kriterien, ...(gedeckeltAuf !== undefined && gedeckeltAuf < summe ? { gedeckeltAuf } : {}), grund: '' };
    return { ...e, grund: teilGrund(e) };
  });
  const nachId = new Map(alle.map(k => [k.id, k]));
  const nameVon = (id: string) => nachId.get(id)?.name ?? s.teile.flatMap(t => t.kriterien).find(k => k.id === id)?.name ?? id;
  const muss: MussErgebnis[] = s.muss.map(m => {
    const erfuellt = m.kriterien.filter(id => { const e = nachId.get(id); return !!e && e.beantwortet && e.stufePunkte >= m.stufePunkte && e.stufePunkte > 0; }).length;
    return { text: mussText(m, nameVon), ok: erfuellt >= m.mindestens, kriterien: [...m.kriterien] };
  });
  const punkte = Math.round(teile.reduce((a, t) => a + t.punkte, 0) * 100) / 100;
  const max = Math.round(teile.reduce((a, t) => a + t.max, 0) * 100) / 100;
  const mussOk = muss.every(m => m.ok);
  const fehlt = muss.filter(m => !m.ok).map(m => m.text);
  // Erst die Muss-Kriterien, dann die Punkte — wer die Pflichtfragen klärt, sammelt meist auch die Punkte.
  if (mussOk && punkte < s.schwelle) fehlt.push(`Punkte (${punkte} von mindestens ${s.schwelle})`);
  return { seite, punkte, max, schwelle: s.schwelle, erreicht: punkte >= s.schwelle && mussOk, gilt: true, fehlt, muss, teile };
}

/** Temperatur aus dem Gesamtwert — die Stufen sind einstellbar (Standard 25 / 50 / 75). */
export function temperaturAus(punkte: number, ab: TemperaturAb = { lau: 25, warm: 50, heiss: 75 }): 'kalt' | 'lau' | 'warm' | 'heiss' {
  return punkte >= ab.heiss ? 'heiss' : punkte >= ab.warm ? 'warm' : punkte >= ab.lau ? 'lau' : 'kalt';
}

/**
 * Der ganze Lead: beide Seiten und der Gesamtwert 0–100 (Anteil aller erreichten an allen möglichen Punkten).
 * Beim Standard ist die mögliche Summe 100 — der Gesamtwert ist dann einfach die Summe wie bisher.
 */
export function scoringRechnen(personen: readonly Kontakt[], lead: LeadAntworten | undefined, heute: string, ctx: ScoringKontext = {}): ScoringErgebnis {
  const e = ctx.einstellungen ?? standardZumRechnen();
  const mk: MessKontext = { heute, teilnahmen: ctx.teilnahmen ?? [], events: ctx.events ?? [] };
  const herkunft = marketingHerkunft(personen, ctx);
  const marketingLead = herkunft.length > 0;
  const mkt = seiteRechnen('marketing', e.marketing, personen, lead, mk);
  // Kein Marketing-Lead: die Marketing-Schwelle gilt nicht (03.10.) — nie MQL, nichts „fehlt“; die Punkte bleiben als Wärme sichtbar.
  const marketing: SeitenErgebnis = marketingLead ? mkt : { ...mkt, gilt: false, erreicht: false, fehlt: [] };
  const sales = seiteRechnen('sales', e.sales, personen, lead, mk);
  const max = marketing.max + sales.max;
  const gesamt = max > 0 ? Math.round((100 * (marketing.punkte + sales.punkte)) / max) : 0;
  return { marketing, sales, gesamt, marketingLead, marketingHerkunft: herkunft };
}

/** Die Kriterien, die im Gespräch gefragt werden: Sales-Fragen in Reihenfolge der Blöcke. */
export function gespraechsFragen(e: ScoringEinstellungen): { teil: string; kriterium: ScoringKriterium }[] {
  return e.sales.teile.flatMap(t => t.kriterien.filter(k => k.quelle === 'frage' && !k.aus).map(k => ({ teil: t.name, kriterium: k })));
}

/** Das alte Feld am Lead, das zu einer gewählten Stufe passt (für die Spiegelung an `kriterien` und `fit`): beste = ja, ab 60 % = ja, 0 = nein, sonst unklar. */
export function altWertAusStufe(k: ScoringKriterium, stufeId: string | null | undefined): Qual {
  const s = k.stufen.find(x => x.id === stufeId);
  if (!s) return 'unklar';
  const max = hoechste(k.stufen).punkte;
  if (max <= 0) return 'unklar';
  if (s.punkte <= 0) return 'nein';
  return s.punkte / max >= 0.6 ? 'ja' : 'unklar';
}
