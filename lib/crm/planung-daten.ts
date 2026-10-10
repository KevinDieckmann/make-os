// ─── Markttraktion · Planung — die Daten (rein, client-sicher, getestet) ─────────────────────────────────────────────
// Kevin 10.10.: „Umsatzziele auf einzelne Aktivitäten runterplanen — Sales, Marketing, was auch immer — mit Kapa und allem, was dazugehört.
// Das Wochen-Scoreboard ist mega, aber nur, wenn ich weiß, was das Ziel war. Dann wöchentliche Challenges …“ und: „Die Pipeline in einem
// Bereich sehen, wo wir die Conversions sehen und anpassen können — planen pro Leadkanal.“
//
// Gespeichert wird NUR, was es nirgends sonst gibt (Bestand `markttraktion-planung--<haushalt>`, Business, lib/crm/planung-server.ts):
//   kanaele      Leadkanäle (Name, Herkunft, Plan-Leads/Monat, Sales Cycle, Plan-Quoten, Kosten/Lead, Zeit/Lead, Verantwortlich, aktiv) —
//                welche Leads/Deals dazugehören, wird NIE gespeichert, sondern aus der vorhandenen Herkunft abgeleitet (lib/crm/planung.ts)
//   ziele        Umsatzziele je Business-Gesellschaft und Zeitraum (optional mit Verweis auf ein Zahlenziel der Planung)
//   challenges   Wochen-Challenges (1–3 je Woche, je Person oder gemeinsam) — der Fortschritt kommt aus echten Aktivitäten
//   zeiten       Minuten je Aktivität (Gespräch, Angebot, Nachfassen, Beitrag) für den Abgleich mit der Kapazität
//   nachLeistung Schritte „nach der Leistung“ je Mandat, die man nur von Hand abhaken kann (Bewertung, Testimonial …) — nur Kennung + wann + wer
// Änderungen kommen als Einzel-Schritte mit Stand je Eintrag (409 bei fremder Änderung), nie als ganze Datei; über den Grenzen → 413,
// Unsinn → 400 — nie still gekürzt. Keine Namen von Personen oder Firmen im Code: Verantwortliche sind Team-Kürzel (lib/crm/team-liste.ts).

import type { KanalId } from './kanal';
import { KANAL } from './kanal';
import type { Welt } from './traktion';
import { TEAM, BEIDE } from './team-liste';
import { istKalendertag } from '@/lib/zeit';
import { montagVon } from '@/lib/zeit/kalender-kern';
import { istBusinessGesellschaft, istRegisterKennung, privatEinheit, istGesellschaft, GEHOERT_ZU_PRIVAT } from '@/lib/einheiten';

export const PLANUNG_VERSION = 1;
/** Antwort auf eine Anfrage aus der Sicht Privat (Route `?space=privat`): hier gibt es nichts — die Markttraktion ist Business. */
export const NUR_BUSINESS = 'Die Markttraktion gehört zu Business — im Privat-Bereich gibt es keine Vertriebsplanung.';

// ── Leadkanäle ───────────────────────────────────────────────────────────────────────────────────────────────────

export type KanalHerkunft = 'kampagne' | 'eventreihe' | 'netzwerk' | 'empfehlung' | 'inbound' | 'partner' | 'frei';
/**
 * Herkunft eines Leadkanals: die Welt, in der er Leads erzeugt, welche Herkunftskanäle der Kartei (`kanalVon`, lib/crm/kanal.ts) er
 * ohne eigene Wahl aufnimmt, und die Zeit je Lead (Vorgabe, je Kanal änderbar).
 */
export const KANAL_HERKUNFT: readonly { id: KanalHerkunft; label: string; welt: Welt; kanaele: readonly KanalId[]; minutenJeLead: number; bezug?: 'kampagne' | 'reihe' }[] = [
  { id: 'kampagne', label: 'Marketing-Kampagne', welt: 'marketing', kanaele: ['kampagne', 'content'], minutenJeLead: 10, bezug: 'kampagne' },
  { id: 'eventreihe', label: 'Eigene Eventreihe', welt: 'event', kanaele: ['event'], minutenJeLead: 30, bezug: 'reihe' },
  { id: 'netzwerk', label: 'Netzwerk', welt: 'sales', kanaele: ['netzwerk', 'outreach'], minutenJeLead: 20 },
  { id: 'empfehlung', label: 'Empfehlung', welt: 'sales', kanaele: ['empfehlung'], minutenJeLead: 15 },
  { id: 'inbound', label: 'Inbound', welt: 'marketing', kanaele: ['inbound'], minutenJeLead: 5 },
  { id: 'partner', label: 'Partner', welt: 'sales', kanaele: [], minutenJeLead: 20 },
  { id: 'frei', label: 'Frei', welt: 'sales', kanaele: [], minutenJeLead: 20 },
];
export const herkunftVon = (h: KanalHerkunft) => KANAL_HERKUNFT.find(x => x.id === h) ?? KANAL_HERKUNFT[KANAL_HERKUNFT.length - 1];

/** Die vier Übergänge des Rückwärts-Trichters (Plan je Kanal, in Prozent). */
export type PlanQuote = 'leadZuGespraech' | 'gespraechZuSql' | 'sqlZuAngebot' | 'angebotZuGewonnen';
export const PLAN_QUOTEN: readonly { id: PlanQuote; label: string; von: string; nach: string }[] = [
  { id: 'leadZuGespraech', label: 'Lead → Gespräch', von: 'Leads', nach: 'Gespräche' },
  { id: 'gespraechZuSql', label: 'Gespräch → SQL', von: 'Gespräche', nach: 'SQL' },
  { id: 'sqlZuAngebot', label: 'SQL → Angebot', von: 'SQL', nach: 'Angebote' },
  { id: 'angebotZuGewonnen', label: 'Angebot → Gewonnen', von: 'Angebote', nach: 'Gewonnen' },
];
export const PLAN_QUOTE_IDS = PLAN_QUOTEN.map(q => q.id);

export interface LeadKanal {
  /** `lk-…` */
  id: string;
  name: string;
  herkunft: KanalHerkunft;
  /** Genauer Bezug: Kampagne (`kp-…`) bzw. Eventreihe (Reihen-Kennung, lib/crm/marke.ts). Personen dort gehören zuerst zu diesem Kanal. */
  bezug?: string;
  /** Welche Herkunftskanäle der Kartei (`kanalVon`) hierher zählen — nur abgeleitet, nie an den Leads gespeichert. */
  kanaele: KanalId[];
  /** Geplante neue Leads je Monat. */
  leadsMonat: number;
  /** Sales Cycle in Wochen: vom Lead bis zum Abschluss. Letzter Start = Ende des Zeitraums − Zyklus. */
  zyklusWochen: number;
  /** Plan-Quoten in Prozent — fehlt eine, gilt die Annahme (lib/crm/planung.ts `standardQuoten`). */
  quoten: Partial<Record<PlanQuote, number>>;
  /** Kosten je Lead in Euro (optional). */
  kostenJeLead?: number;
  /** Zeit je Lead (Ansprache, Erfassen) in Minuten — fehlt: Vorgabe der Herkunft. */
  minutenJeLead?: number;
  /** Beiträge (Posts) je Woche, die dieser Kanal braucht — gehen mit `zeiten.beitrag` in die Kapazität. */
  beitraegeWoche?: number;
  /** Wer die Leads erzeugt: Team-Kürzel oder „beide“ — fehlt: die/der Verantwortliche der Welt. */
  verantwortlich?: string;
  /** Wer Gespräche und Angebote führt — fehlt: die Sales-Verantwortung. */
  vertrieb?: string;
  aktiv: boolean;
  /** Reihenfolge (1 = zuerst) — bei der Zuordnung gewinnt der erste passende Kanal. */
  rang?: number;
  geaendert: string;
  geaendertVon: string;
}

// ── Umsatzziele ──────────────────────────────────────────────────────────────────────────────────────────────────

export interface UmsatzZiel {
  /** `uz-…` */
  id: string;
  /** Business-Gesellschaft (feste Kennung oder `g-…` aus dem Register) — nie eine Privat-Einheit. */
  gesellschaft: string;
  titel?: string;
  von: string;
  bis: string;
  /** Umsatz netto in Euro im Zeitraum. */
  umsatz: number;
  /** Ø Deal-Wert in Euro — fehlt: gemessen (Ø der gewonnenen Deals, lib/crm/deal-auswertung.ts `zyklus`). */
  dealWert?: number;
  /** Verweis auf ein Business-Zahlenziel der Planung (nur Anzeige/Vorschlag, nie geändert). */
  zielId?: string;
  /** Anteil der Deals je Kanal in Prozent — fehlt: nach der geplanten Leistung der Kanäle verteilt. */
  anteile?: Record<string, number>;
  geaendert: string;
  geaendertVon: string;
}

// ── Challenges ───────────────────────────────────────────────────────────────────────────────────────────────────

export type ChallengeArt = 'gespraeche' | 'leads' | 'angebote' | 'deals' | 'powerhours' | 'reaktivieren' | 'events';
export const CHALLENGE_ARTEN: readonly { id: ChallengeArt; label: string; einheit: string }[] = [
  { id: 'gespraeche', label: 'Echte Gespräche', einheit: 'Gespräche' },
  { id: 'leads', label: 'Neue Leads', einheit: 'Leads' },
  { id: 'angebote', label: 'Angebote raus', einheit: 'Angebote' },
  { id: 'deals', label: 'Neue Deals (SQL)', einheit: 'Deals' },
  { id: 'powerhours', label: 'Power Hours', einheit: 'Power Hours' },
  { id: 'reaktivieren', label: 'Ruhende Kontakte reaktivieren', einheit: 'Kontakte' },
  { id: 'events', label: 'Menschen auf Events treffen', einheit: 'Begegnungen' },
];
export const challengeArtLabel = (a: ChallengeArt) => CHALLENGE_ARTEN.find(x => x.id === a)?.label ?? a;

export interface Challenge {
  /** `chl-…` */
  id: string;
  /** Montag der Woche. */
  woche: string;
  art: ChallengeArt;
  titel: string;
  ziel: number;
  /** Team-Kürzel oder „beide“ (gemeinsam). */
  person: string;
  /** Optional: der Leadkanal, aus dem die Lücke kam. */
  kanalId?: string;
  /** Rückblick (ein Satz nach der Woche). */
  rueckblick?: string;
  geaendert: string;
  geaendertVon: string;
}

// ── Zeiten und Schritte nach der Leistung ────────────────────────────────────────────────────────────────────────

/** Minuten je Aktivität — Vorgaben, je Haushalt änderbar. */
export interface AktivitaetZeiten { gespraech: number; angebot: number; nachfassen: number; beitrag: number }
export const ZEITEN_VORGABE: AktivitaetZeiten = { gespraech: 45, angebot: 120, nachfassen: 15, beitrag: 30 };
export const ZEITEN_LABEL: Record<keyof AktivitaetZeiten, string> = { gespraech: 'Gespräch', angebot: 'Angebot', nachfassen: 'Nachfassen je Gespräch', beitrag: 'Beitrag (Post)' };
const ZEITEN_GRENZE: Record<keyof AktivitaetZeiten, [number, number]> = { gespraech: [5, 480], angebot: [5, 960], nachfassen: [0, 240], beitrag: [0, 480] };

/**
 * „Nach der Leistung“ (Kevin 10.10.: „zu Ende, Upselling, Cross-Selling, oder Bewertung/Rezension, Testimonial, Newsletter (am besten schon
 * vorher), dann wieder verkaufen“) — je Kunde. Abgeleitet, wo es die Daten schon sagen (Mandat beendet, neuer Deal, Newsletter-Einwilligung),
 * sonst von Hand abgehakt.
 */
export type NachLeistungSchritt = 'ende' | 'upselling' | 'crossselling' | 'bewertung' | 'testimonial' | 'newsletter';
export const NACH_LEISTUNG: readonly { id: NachLeistungSchritt; label: string; schonWaehrend: boolean }[] = [
  { id: 'newsletter', label: 'Newsletter', schonWaehrend: true },
  { id: 'bewertung', label: 'Bewertung / Rezension', schonWaehrend: true },
  { id: 'testimonial', label: 'Testimonial', schonWaehrend: true },
  { id: 'upselling', label: 'Upselling', schonWaehrend: true },
  { id: 'crossselling', label: 'Cross-Selling', schonWaehrend: true },
  { id: 'ende', label: 'Leistung beendet', schonWaehrend: false },
];
export const NACH_LEISTUNG_IDS = NACH_LEISTUNG.map(s => s.id);
export interface SchrittMarke { am: string; von: string }

export interface PlanungDatei {
  version: number;
  kanaele: LeadKanal[];
  ziele: UmsatzZiel[];
  challenges: Challenge[];
  zeiten: AktivitaetZeiten;
  /** Mandat-Kennung → abgehakte Schritte. */
  nachLeistung: Record<string, Partial<Record<NachLeistungSchritt, SchrittMarke>>>;
}
export const leerePlanung = (): PlanungDatei => ({ version: PLANUNG_VERSION, kanaele: [], ziele: [], challenges: [], zeiten: { ...ZEITEN_VORGABE }, nachLeistung: {} });

/** Grenzen — darüber wird abgelehnt (413), nie gekürzt. */
export const PLANUNG_GRENZEN = { kanaele: 40, ziele: 40, challenges: 1500, nachLeistung: 3000, ops: 60, challengesJeWoche: 12 } as const;

// ── Säubern (Lesen: robust — kaputte Einträge fallen weg, nie ein Absturz) ───────────────────────────────────────

const KENNUNG = /^[A-Za-z0-9][A-Za-z0-9_.:~-]{0,79}$/;
export const KANAL_ID = /^lk-[a-z0-9-]{4,60}$/;
export const ZIEL_ID = /^uz-[a-z0-9-]{4,60}$/;
export const CHALLENGE_ID = /^chl-[a-z0-9-]{4,60}$/;
const KANAL_IDS = new Set<string>(KANAL.map(k => k.id));
const HERKUNFT_IDS = new Set<string>(KANAL_HERKUNFT.map(h => h.id));
const ART_IDS = new Set<string>(CHALLENGE_ARTEN.map(a => a.id));
const zahl = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v.replace(',', '.'))) ? Number(v.replace(',', '.')) : null);
const text = (v: unknown): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
const rund1 = (n: number) => Math.round(n * 10) / 10;
/** Team-Kürzel oder „beide“ — sonst nichts (wie lib/crm/team.ts `wer`, ohne den Importkreis über team.ts). */
export function teamWer(v: unknown): string | undefined {
  const s = text(v).toLowerCase();
  return s === BEIDE || TEAM.some(t => t.id === s) ? s : undefined;
}
const zeitstempel = (v: unknown) => (typeof v === 'string' && v.length <= 40 ? v : '');

function kanalLesen(o: Record<string, unknown>): LeadKanal | null {
  const id = text(o.id), name = text(o.name), herkunft = text(o.herkunft);
  if (!KANAL_ID.test(id) || !name || !HERKUNFT_IDS.has(herkunft)) return null;
  const quoten: Partial<Record<PlanQuote, number>> = {};
  const q = (o.quoten && typeof o.quoten === 'object' ? o.quoten : {}) as Record<string, unknown>;
  for (const k of PLAN_QUOTE_IDS) { const n = zahl(q[k]); if (n !== null && n > 0 && n <= 100) quoten[k] = rund1(n); }
  const opt = (k: string, max: number) => { const n = zahl(o[k]); return n !== null && n >= 0 && n <= max ? { [k]: rund1(n) } : {}; };
  return {
    id, name: name.slice(0, 60), herkunft: herkunft as KanalHerkunft,
    ...(KENNUNG.test(text(o.bezug)) ? { bezug: text(o.bezug) } : {}),
    kanaele: Array.from(new Set((Array.isArray(o.kanaele) ? o.kanaele : []).map(text).filter(k => KANAL_IDS.has(k)))) as KanalId[],
    leadsMonat: Math.max(0, Math.min(10_000, rund1(zahl(o.leadsMonat) ?? 0))),
    zyklusWochen: Math.max(0, Math.min(104, Math.round(zahl(o.zyklusWochen) ?? 8))),
    quoten, ...opt('kostenJeLead', 100_000), ...opt('minutenJeLead', 600), ...opt('beitraegeWoche', 50),
    ...(teamWer(o.verantwortlich) ? { verantwortlich: teamWer(o.verantwortlich) } : {}),
    ...(teamWer(o.vertrieb) ? { vertrieb: teamWer(o.vertrieb) } : {}),
    aktiv: o.aktiv !== false,
    ...(Number.isInteger(o.rang) && (o.rang as number) > 0 ? { rang: o.rang as number } : {}),
    geaendert: zeitstempel(o.geaendert), geaendertVon: text(o.geaendertVon).slice(0, 40),
  };
}

function zielLesen(o: Record<string, unknown>): UmsatzZiel | null {
  const id = text(o.id), g = text(o.gesellschaft), von = text(o.von), bis = text(o.bis), umsatz = zahl(o.umsatz);
  if (!ZIEL_ID.test(id) || !gesellschaftOk(g) || !istKalendertag(von) || !istKalendertag(bis) || von > bis || umsatz === null || umsatz <= 0) return null;
  const anteile: Record<string, number> = {};
  const a = (o.anteile && typeof o.anteile === 'object' ? o.anteile : {}) as Record<string, unknown>;
  for (const [k, v] of Object.entries(a)) { const n = zahl(v); if (KANAL_ID.test(k) && n !== null && n >= 0 && n <= 100) anteile[k] = rund1(n); }
  const dw = zahl(o.dealWert);
  return {
    id, gesellschaft: g, ...(text(o.titel) ? { titel: text(o.titel).slice(0, 80) } : {}), von, bis, umsatz: Math.round(umsatz * 100) / 100,
    ...(dw !== null && dw > 0 ? { dealWert: Math.round(dw * 100) / 100 } : {}),
    ...(KENNUNG.test(text(o.zielId)) ? { zielId: text(o.zielId) } : {}),
    ...(Object.keys(anteile).length ? { anteile } : {}),
    geaendert: zeitstempel(o.geaendert), geaendertVon: text(o.geaendertVon).slice(0, 40),
  };
}

function challengeLesen(o: Record<string, unknown>): Challenge | null {
  const id = text(o.id), woche = text(o.woche), art = text(o.art), titel = text(o.titel), ziel = zahl(o.ziel);
  if (!CHALLENGE_ID.test(id) || !istKalendertag(woche) || montagVon(woche) !== woche || !ART_IDS.has(art) || !titel || ziel === null || ziel < 1) return null;
  const person = teamWer(o.person) ?? BEIDE;
  return {
    id, woche, art: art as ChallengeArt, titel: titel.slice(0, 100), ziel: Math.min(1000, Math.round(ziel)), person,
    ...(KANAL_ID.test(text(o.kanalId)) ? { kanalId: text(o.kanalId) } : {}),
    ...(text(o.rueckblick) ? { rueckblick: text(o.rueckblick).slice(0, 500) } : {}),
    geaendert: zeitstempel(o.geaendert), geaendertVon: text(o.geaendertVon).slice(0, 40),
  };
}

function zeitenLesen(v: unknown): AktivitaetZeiten {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const z = { ...ZEITEN_VORGABE };
  for (const k of Object.keys(ZEITEN_GRENZE) as (keyof AktivitaetZeiten)[]) {
    const n = zahl(o[k]); const [min, max] = ZEITEN_GRENZE[k];
    if (n !== null && n >= min && n <= max) z[k] = Math.round(n);
  }
  return z;
}

/** Den Bestand lesen — Unlesbares fällt weg (Liste), fehlende Teile gelten als leer bzw. Vorgabe. */
export function planungAus(roh: unknown): PlanungDatei {
  if (!roh || typeof roh !== 'object') return leerePlanung();
  const o = roh as Record<string, unknown>;
  const liste = <T,>(v: unknown, f: (x: Record<string, unknown>) => T | null): T[] => (Array.isArray(v) ? v : []).flatMap(x => (x && typeof x === 'object' ? [f(x as Record<string, unknown>)] : [])).filter((x): x is T => !!x);
  const nl: PlanungDatei['nachLeistung'] = {};
  const n = (o.nachLeistung && typeof o.nachLeistung === 'object' ? o.nachLeistung : {}) as Record<string, unknown>;
  for (const [mid, s] of Object.entries(n)) {
    if (!KENNUNG.test(mid) || !s || typeof s !== 'object') continue;
    const marken: Partial<Record<NachLeistungSchritt, SchrittMarke>> = {};
    for (const [k, m] of Object.entries(s as Record<string, unknown>)) {
      const mm = m as Partial<SchrittMarke> | null;
      if ((NACH_LEISTUNG_IDS as string[]).includes(k) && mm && istKalendertag(mm.am)) marken[k as NachLeistungSchritt] = { am: mm.am as string, von: text(mm.von).slice(0, 40) };
    }
    if (Object.keys(marken).length) nl[mid] = marken;
  }
  return { version: PLANUNG_VERSION, kanaele: liste(o.kanaele, kanalLesen), ziele: liste(o.ziele, zielLesen), challenges: liste(o.challenges, challengeLesen), zeiten: zeitenLesen(o.zeiten), nachLeistung: nl };
}

/** Darf ein Umsatzziel an dieser Gesellschaft hängen? Nur Business (feste Business-Gesellschaft oder `g-…` des Registers). */
export function gesellschaftOk(g: unknown): boolean {
  return istBusinessGesellschaft(g) || istRegisterKennung(g);
}

// ── Schreiben: Einzel-Schritte mit Stand ─────────────────────────────────────────────────────────────────────────

export type PlanungOp =
  | { op: 'kanal'; eintrag: Record<string, unknown>; stand?: string }
  | { op: 'kanal-weg'; id: string; stand?: string }
  | { op: 'ziel'; eintrag: Record<string, unknown>; stand?: string }
  | { op: 'ziel-weg'; id: string; stand?: string }
  | { op: 'challenge'; eintrag: Record<string, unknown>; stand?: string }
  | { op: 'challenge-weg'; id: string; stand?: string }
  | { op: 'zeiten'; zeiten: Record<string, unknown>; stand?: string }
  | { op: 'schritt'; mandatId: string; schritt: NachLeistungSchritt; erledigt: boolean };

export interface AnwendenKontext {
  person: string;
  jetzt: string;
  heute: string;
  /** Fingerabdruck eines Eintrags (Server: lib/store/fingerabdruck.ts) — rein injiziert, damit diese Datei client-sicher bleibt. */
  standVon: (x: object) => string;
  /** Neue Kennung (Server: `neueKennung`) für Einträge ohne eigene. */
  neueId: (praefix: 'lk' | 'uz' | 'chl') => string;
}
export type AnwendenErgebnis =
  | { ok: true; datei: PlanungDatei; geaendert: string[] }
  | { ok: false; status: 409; konflikte: { op: number; id: string }[] }
  | { ok: false; status: 400 | 413; fehler: string };

class Abgelehnt extends Error { constructor(public status: 400 | 413, msg: string) { super(msg); } }
const nein = (msg: string, status: 400 | 413 = 400): never => { throw new Abgelehnt(status, msg); };

/** Felder eines Teil-Eintrags auf den alten legen — `null` entfernt ein optionales Feld, `undefined` bleibt beim alten. */
function mischen(alt: Record<string, unknown> | undefined, teil: Record<string, unknown>): Record<string, unknown> {
  const raus: Record<string, unknown> = { ...(alt ?? {}) };
  for (const [k, v] of Object.entries(teil)) { if (v === null) delete raus[k]; else if (v !== undefined) raus[k] = v; }
  return raus;
}

/** Prüft die Rohwerte eines Kanals (vor dem Säubern), damit nichts still verschwindet. */
function kanalPruefen(o: Record<string, unknown>): void {
  if (!text(o.name)) nein('Der Leadkanal braucht einen Namen.');
  if (text(o.name).length > 60) nein('Der Name ist zu lang (höchstens 60 Zeichen).');
  if (!HERKUNFT_IDS.has(text(o.herkunft))) nein('Unbekannte Herkunft des Leadkanals.');
  const zahlIn = (k: string, min: number, max: number, label: string) => { if (o[k] === undefined) return; const n = zahl(o[k]); if (n === null || n < min || n > max) nein(`${label}: ${min} bis ${max}.`); };
  zahlIn('leadsMonat', 0, 10_000, 'Leads je Monat'); zahlIn('zyklusWochen', 0, 104, 'Sales Cycle (Wochen)'); zahlIn('kostenJeLead', 0, 100_000, 'Kosten je Lead');
  zahlIn('minutenJeLead', 0, 600, 'Minuten je Lead'); zahlIn('beitraegeWoche', 0, 50, 'Beiträge je Woche');
  const q = (o.quoten && typeof o.quoten === 'object' ? o.quoten : {}) as Record<string, unknown>;
  for (const [k, v] of Object.entries(q)) {
    if (!(PLAN_QUOTE_IDS as string[]).includes(k)) nein(`Unbekannte Quote „${k}“.`);
    const n = zahl(v); if (n === null || n <= 0 || n > 100) nein('Quoten: mehr als 0 und höchstens 100 %.');
  }
  for (const k of (Array.isArray(o.kanaele) ? o.kanaele : [])) if (!KANAL_IDS.has(text(k))) nein(`Unbekannte Herkunft „${text(k)}“.`);
  if (o.bezug !== undefined && !KENNUNG.test(text(o.bezug))) nein('Der Bezug (Kampagne oder Reihe) ist keine gültige Kennung.');
  for (const k of ['verantwortlich', 'vertrieb']) if (o[k] !== undefined && !teamWer(o[k])) nein('Verantwortlich: ein Team-Kürzel oder „beide“.');
}
function zielPruefen(o: Record<string, unknown>): void {
  const g = text(o.gesellschaft);
  if (!gesellschaftOk(g)) {
    const p = privatEinheit(g);
    if (p) nein(GEHOERT_ZU_PRIVAT(p));
    if (istGesellschaft(g)) nein(GEHOERT_ZU_PRIVAT(g));
    nein('Unbekannte Gesellschaft — Umsatzziele gelten für eine Business-Gesellschaft.');
  }
  if (!istKalendertag(o.von) || !istKalendertag(o.bis)) nein('Zeitraum: zwei gültige Tage (von, bis).');
  if ((o.von as string) > (o.bis as string)) nein('Der Zeitraum endet vor seinem Anfang.');
  const tage = (Date.parse(`${o.bis}T12:00:00Z`) - Date.parse(`${o.von}T12:00:00Z`)) / 864e5;
  if (tage > 3 * 366) nein('Der Zeitraum ist zu lang (höchstens drei Jahre).');
  const u = zahl(o.umsatz); if (u === null || u <= 0 || u > 100_000_000) nein('Umsatz: eine Zahl über 0 (Euro, netto).');
  if (o.dealWert !== undefined) { const d = zahl(o.dealWert); if (d === null || d <= 0 || d > 10_000_000) nein('Ø Deal-Wert: eine Zahl über 0 (Euro).'); }
  if (o.titel !== undefined && text(o.titel).length > 80) nein('Der Titel ist zu lang (höchstens 80 Zeichen).');
  const a = (o.anteile && typeof o.anteile === 'object' ? o.anteile : {}) as Record<string, unknown>;
  for (const [k, v] of Object.entries(a)) { const n = zahl(v); if (!KANAL_ID.test(k) || n === null || n < 0 || n > 100) nein('Anteile: je Leadkanal 0 bis 100 %.'); }
}
function challengePruefen(o: Record<string, unknown>): void {
  if (!istKalendertag(o.woche) || montagVon(o.woche as string) !== o.woche) nein('Die Woche ist der Montag (JJJJ-MM-TT).');
  if (!ART_IDS.has(text(o.art))) nein('Unbekannte Art der Challenge.');
  if (!text(o.titel)) nein('Die Challenge braucht einen Titel.');
  if (text(o.titel).length > 100) nein('Der Titel ist zu lang (höchstens 100 Zeichen).');
  const z = zahl(o.ziel); if (z === null || z < 1 || z > 1000) nein('Ziel: 1 bis 1000.');
  if (o.person !== undefined && !teamWer(o.person)) nein('Für wen: ein Team-Kürzel oder „beide“.');
  if (o.rueckblick !== undefined && text(o.rueckblick).length > 500) nein('Der Rückblick ist zu lang (höchstens 500 Zeichen).');
}

/**
 * Schritte anwenden — alles oder nichts. Neu (Kennung unbekannt oder ohne Kennung) braucht keinen Stand; Ändern und Löschen eines
 * vorhandenen Eintrags nur mit dem Stand, den der Browser bekam (sonst 409 mit den Kennungen).
 */
export function planungAnwenden(datei: PlanungDatei, opsRoh: unknown, k: AnwendenKontext): AnwendenErgebnis {
  if (!Array.isArray(opsRoh) || !opsRoh.length) return { ok: false, status: 400, fehler: 'ops: eine Liste von Änderungen.' };
  if (opsRoh.length > PLANUNG_GRENZEN.ops) return { ok: false, status: 413, fehler: `Höchstens ${PLANUNG_GRENZEN.ops} Änderungen auf einmal — nichts gespeichert.` };
  const d: PlanungDatei = { ...datei, kanaele: [...datei.kanaele], ziele: [...datei.ziele], challenges: [...datei.challenges], zeiten: { ...datei.zeiten }, nachLeistung: { ...datei.nachLeistung } };
  const konflikte: { op: number; id: string }[] = [];
  const geaendert: string[] = [];
  const vermerk = { geaendert: k.jetzt, geaendertVon: k.person };
  try {
    opsRoh.forEach((roh, i) => {
      if (!roh || typeof roh !== 'object') nein(`Änderung ${i + 1} ist kein Objekt.`);
      const op = roh as PlanungOp & Record<string, unknown>;
      const listeFuer = (art: 'kanal' | 'ziel' | 'challenge') => (art === 'kanal' ? d.kanaele : art === 'ziel' ? d.ziele : d.challenges) as { id: string }[];
      const setzeListe = (art: 'kanal' | 'ziel' | 'challenge', l: { id: string }[]) => { if (art === 'kanal') d.kanaele = l as LeadKanal[]; else if (art === 'ziel') d.ziele = l as UmsatzZiel[]; else d.challenges = l as Challenge[]; };
      const muster = { kanal: KANAL_ID, ziel: ZIEL_ID, challenge: CHALLENGE_ID } as const;
      const praefix = { kanal: 'lk', ziel: 'uz', challenge: 'chl' } as const;
      if (op.op === 'kanal' || op.op === 'ziel' || op.op === 'challenge') {
        const art = op.op;
        const e = (op.eintrag && typeof op.eintrag === 'object' ? op.eintrag : nein(`Änderung ${i + 1}: eintrag fehlt.`)) as Record<string, unknown>;
        const liste = listeFuer(art);
        const id = e.id === undefined ? undefined : text(e.id);
        if (id !== undefined && !muster[art].test(id)) nein(`Änderung ${i + 1}: ungültige Kennung.`);
        const alt = id ? liste.find(x => x.id === id) : undefined;
        if (alt && op.stand !== k.standVon(alt)) { konflikte.push({ op: i, id: alt.id }); return; }
        const roh2 = mischen(alt as Record<string, unknown> | undefined, { ...e, id: alt?.id ?? id ?? k.neueId(praefix[art]) });
        if (art === 'kanal') {
          if (!alt && roh2.kanaele === undefined) roh2.kanaele = [...herkunftVon(text(roh2.herkunft) as KanalHerkunft).kanaele];
          kanalPruefen(roh2);
        } else if (art === 'ziel') zielPruefen(roh2);
        else challengePruefen(roh2);
        const neu = art === 'kanal' ? kanalLesen({ ...roh2, ...vermerk }) : art === 'ziel' ? zielLesen({ ...roh2, ...vermerk }) : challengeLesen({ ...roh2, ...vermerk });
        if (!neu) nein(`Änderung ${i + 1}: Eintrag unvollständig.`);
        if (!alt) {
          const grenze = art === 'kanal' ? PLANUNG_GRENZEN.kanaele : art === 'ziel' ? PLANUNG_GRENZEN.ziele : PLANUNG_GRENZEN.challenges;
          if (liste.length >= grenze) nein(`Höchstens ${grenze} ${art === 'kanal' ? 'Leadkanäle' : art === 'ziel' ? 'Umsatzziele' : 'Challenges'} — nichts gespeichert.`, 413);
          if (art === 'challenge' && d.challenges.filter(c => c.woche === (neu as Challenge).woche).length >= PLANUNG_GRENZEN.challengesJeWoche) nein(`Höchstens ${PLANUNG_GRENZEN.challengesJeWoche} Challenges je Woche.`, 413);
          setzeListe(art, [...liste, neu as { id: string }]);
        } else setzeListe(art, liste.map(x => (x.id === alt.id ? neu as { id: string } : x)));
        geaendert.push((neu as { id: string }).id);
        return;
      }
      if (op.op === 'kanal-weg' || op.op === 'ziel-weg' || op.op === 'challenge-weg') {
        const art = op.op.slice(0, -4) as 'kanal' | 'ziel' | 'challenge';
        const liste = listeFuer(art);
        const alt = liste.find(x => x.id === text(op.id));
        if (!alt) return; // schon weg — idempotent
        if (op.stand !== k.standVon(alt)) { konflikte.push({ op: i, id: alt.id }); return; }
        setzeListe(art, liste.filter(x => x.id !== alt.id));
        if (art === 'kanal') d.ziele = d.ziele.map(z => (z.anteile && alt.id in z.anteile ? { ...z, anteile: Object.fromEntries(Object.entries(z.anteile).filter(([x]) => x !== alt.id)) } : z));
        geaendert.push(alt.id);
        return;
      }
      if (op.op === 'zeiten') {
        if (op.stand !== k.standVon(d.zeiten)) { konflikte.push({ op: i, id: 'zeiten' }); return; }
        const z = (op.zeiten && typeof op.zeiten === 'object' ? op.zeiten : nein('zeiten fehlt.')) as Record<string, unknown>;
        for (const [key, v] of Object.entries(z)) {
          const g = ZEITEN_GRENZE[key as keyof AktivitaetZeiten];
          if (!g) nein(`Unbekannte Aktivität „${key}“.`);
          const n = zahl(v); if (n === null || n < g[0] || n > g[1]) nein(`${ZEITEN_LABEL[key as keyof AktivitaetZeiten]}: ${g[0]} bis ${g[1]} Minuten.`);
        }
        d.zeiten = zeitenLesen({ ...d.zeiten, ...z });
        geaendert.push('zeiten');
        return;
      }
      if (op.op === 'schritt') {
        const mid = text(op.mandatId);
        if (!KENNUNG.test(mid)) nein('Ungültige Mandat-Kennung.');
        if (!(NACH_LEISTUNG_IDS as string[]).includes(op.schritt)) nein('Unbekannter Schritt.');
        const alt = d.nachLeistung[mid] ?? {};
        if (op.erledigt) {
          if (!d.nachLeistung[mid] && Object.keys(d.nachLeistung).length >= PLANUNG_GRENZEN.nachLeistung) nein(`Höchstens ${PLANUNG_GRENZEN.nachLeistung} Kunden mit Schritten.`, 413);
          if (!alt[op.schritt]) d.nachLeistung[mid] = { ...alt, [op.schritt]: { am: k.heute, von: k.person } };
        } else if (alt[op.schritt]) {
          const rest = { ...alt }; delete rest[op.schritt];
          if (Object.keys(rest).length) d.nachLeistung[mid] = rest; else delete d.nachLeistung[mid];
        }
        geaendert.push(`${mid}:${op.schritt}`);
        return;
      }
      nein(`Änderung ${i + 1}: unbekannte Art „${String((roh as { op?: unknown }).op)}“.`);
    });
  } catch (e) {
    if (e instanceof Abgelehnt) return { ok: false, status: e.status, fehler: e.message };
    throw e;
  }
  if (konflikte.length) return { ok: false, status: 409, konflikte };
  return { ok: true, datei: d, geaendert };
}
