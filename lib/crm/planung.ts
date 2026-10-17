// ─── Markttraktion · Planung — die Rechnung (rein, getestet) ─────────────────────────────────────────────────────
// EINE Rechnung für den Schnellknopf „Planung“ (Kevin 10.10.). Nichts wird hier doppelt gerechnet — die Bausteine kommen aus den
// vorhandenen Regeln:
//   Leads, Status, Herkunftskanal     lib/crm/leads.ts (`leads`), lib/crm/kanal.ts (`kanalVon`, steckt in der Lead-Zeile)
//   Deals, Wahrscheinlichkeiten        lib/crm/pipeline.ts (`gesamtwert`, `wahrscheinlichkeit`, `echtesGespraech`, `OFFENE_STUFEN`)
//   gemessene Quoten, Ø Deal-Wert      lib/crm/deal-auswertung.ts (`gemesseneQuoten`, `zyklus`, `MINDESTMENGE`)
//   Marketing-Anmeldung (Eventreihe)   lib/crm/marke.ts (`alsMarketingAnmeldung`, `reiheVon`)
//   Machbarkeits-Schwellen             lib/kapazitaet/typen.ts (`MACHBAR_BIS`, `ENG_BIS`)
// Gerechnet wird:
//   1. Zuordnung Lead/Deal/Mandat → Leadkanal — NUR abgeleitet (genauer Bezug Kampagne/Eventreihe zuerst, dann die Herkunft), nie gespeichert.
//   2. Der Kreislauf: Leadkanäle → Leads & Qualifizierung → Deals → Follow-up → Fulfillment → Nach der Leistung → Wiederkauf → zurück.
//   3. Ziel → Aktivitäten (Rückwärts-Trichter): Umsatz ÷ Ø Deal-Wert → Deals ÷ Angebot→Gewonnen → Angebote ÷ SQL→Angebot → SQL ÷ Gespräch→SQL
//      → Gespräche ÷ Lead→Gespräch → Leads je Kanal; je Woche bis zum letzten Start (Ende − Sales Cycle) und je Person/Welt.
//   4. Gegen die Kapazität (freie Stunden je Person) — „machbar · eng · nicht machbar — bräuchte X h/Woche“.
//   5. Wochenziele fürs Scoreboard und 6. Challenges (Fortschritt aus echten Aktivitäten, Vorschläge aus den Lücken).

import type { Kontakt } from '@/lib/make-one/crm';
import type { Chance, CrmBestand, Mandat } from './typen';
import { inArbeit, type LeadZeile } from './leads';
import type { KanalId } from './kanal';
import type { Welt } from './traktion';
import type { Mitglied } from './team-liste';
import { TEAM, BEIDE } from './team-liste';
import { gesamtwert, wahrscheinlichkeit, echtesGespraech, OFFENE_STUFEN } from './pipeline';
import { gemesseneQuoten, zyklus, MINDESTMENGE } from './deal-auswertung';
import { MARKE_EVENTS, alsMarketingAnmeldung, reiheVon } from './marke';
import { MACHBAR_BIS, ENG_BIS } from '@/lib/kapazitaet/typen';
import { tagPlus, montagVon } from '@/lib/zeit/kalender-kern';
import { tagVon } from '@/lib/zeit';
import { neuerLeadAm } from './neue-leads';
import { imBusiness } from './treppe';
import { WEG } from '@/lib/wege';
import { mandateLink } from './adresse';
import {
  herkunftVon, PLAN_QUOTE_IDS, NACH_LEISTUNG,
  type LeadKanal, type PlanQuote, type UmsatzZiel, type AktivitaetZeiten, type PlanungDatei, type Challenge, type ChallengeArt, type NachLeistungSchritt,
} from './planung-daten';

const tage = (a: string, b: string) => Math.round((Date.parse(`${b.slice(0, 10)}T12:00:00Z`) - Date.parse(`${a.slice(0, 10)}T12:00:00Z`)) / 864e5);
const rund1 = (n: number) => Math.round(n * 10) / 10;
/** Dieselbe Zahl als deutscher Text („2,3“, 17.10., Gesamtprüfung L4 B8 — vorher stand „2.3 neue Leads/Monat“). */
const de1 = (n: number) => rund1(n).toLocaleString('de-DE');
/** Wochen je Monat (365,25 ÷ 12 ÷ 7). */
export const WOCHEN_JE_MONAT = 365.25 / 12 / 7;
/** Ab so vielen Tagen ohne Kontakt gilt jemand als „ruhend“ (Challenge „reaktivieren“). */
export const RUHEND_TAGE = 90;

// ── 1. Zuordnung ─────────────────────────────────────────────────────────────────────────────────────────────────

/** Aktive Kanäle in der Reihenfolge, in der die Zuordnung sie fragt: Rang, dann Name. */
export function aktiveKanaele(kanaele: readonly LeadKanal[]): LeadKanal[] {
  return kanaele.filter(k => k.aktiv).sort((a, b) => (a.rang ?? 1e9) - (b.rang ?? 1e9) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

/** Personen je Kampagne und je Eventreihe (Anmeldung als Marketing — dieselbe Regel wie die Leads je Reihe). */
export interface KanalKontext { kampagnen: Map<string, Set<string>>; reihen: Map<string, Set<string>> }
export function kanalKontext(crm: Pick<CrmBestand, 'kampagnen' | 'teilnahmen' | 'events'>): KanalKontext {
  const kampagnen = new Map((crm.kampagnen ?? []).filter(k => !k.geloeschtAm).map(k => [k.id, new Set(k.kontaktIds ?? [])]));
  const reihen = new Map<string, Set<string>>();
  const events = new Map((crm.events ?? []).map(e => [e.id, e]));
  for (const t of crm.teilnahmen ?? []) {
    const e = events.get(t.eventId);
    if (!e || !alsMarketingAnmeldung(t, e)) continue;
    const r = reiheVon(e)?.id;
    if (!r) continue;
    const s = reihen.get(r) ?? new Set<string>();
    s.add(t.kontaktId); reihen.set(r, s);
  }
  return { kampagnen, reihen };
}

/** Der Kanal eines Leads: erst ein genauer Bezug (Kampagne/Eventreihe mit einer seiner Personen), dann die Herkunft — sonst keiner. */
export function kanalFuerLead(aktiv: readonly LeadKanal[], z: Pick<LeadZeile, 'kanal' | 'personen'>, ctx: KanalKontext): string | null {
  const ids = z.personen.map(p => p.id);
  for (const k of aktiv) {
    if (!k.bezug) continue;
    const art = herkunftVon(k.herkunft).bezug;
    const menge = art === 'kampagne' ? ctx.kampagnen.get(k.bezug) : art === 'reihe' ? ctx.reihen.get(k.bezug) : undefined;
    if (menge && ids.some(id => menge.has(id))) return k.id;
  }
  return aktiv.find(k => k.kanaele.includes(z.kanal))?.id ?? null;
}

export interface Zuordnung {
  lead: Map<string, string | null>;
  deal: Map<string, string | null>;
  mandat: Map<string, string | null>;
}
/** Lead → Kanal, Deal → Kanal (über seinen Lead, sonst die Deal-Quelle), Mandat → Kanal (über den Deal, sonst die Firma). */
export function zuordnen(kanaele: readonly LeadKanal[], zeilen: readonly LeadZeile[], crm: Pick<CrmBestand, 'chancen' | 'mandate' | 'kampagnen' | 'teilnahmen' | 'events'>): Zuordnung {
  const aktiv = aktiveKanaele(kanaele);
  const ctx = kanalKontext(crm);
  const lead = new Map(zeilen.map(z => [z.id, kanalFuerLead(aktiv, z, ctx)]));
  const nachDeal = new Map<string, string | null>(), nachPerson = new Map<string, string | null>(), nachFirma = new Map<string, string | null>();
  for (const z of zeilen) {
    const k = lead.get(z.id) ?? null;
    if (z.deal) nachDeal.set(z.deal.id, k);
    for (const p of z.personen) if (!nachPerson.has(p.id)) nachPerson.set(p.id, k);
    if (z.firmaId) nachFirma.set(z.firmaId, k);
  }
  const deal = new Map<string, string | null>();
  for (const c of crm.chancen) {
    let k: string | null | undefined = nachDeal.get(c.id);
    if (k === undefined && c.firmaId) k = nachFirma.get(c.firmaId);
    if (k === undefined) for (const id of c.kontaktIds) { if (nachPerson.has(id)) { k = nachPerson.get(id); break; } }
    if (!k && c.quelle) k = aktiv.find(x => x.kanaele.includes(c.quelle as KanalId))?.id ?? null;
    deal.set(c.id, k ?? null);
  }
  const mandat = new Map<string, string | null>();
  for (const m of crm.mandate) {
    let k: string | null | undefined = m.chanceId ? deal.get(m.chanceId) : undefined;
    if (k === undefined && m.firmaId) k = nachFirma.get(m.firmaId);
    if (k === undefined) for (const id of m.kontaktIds ?? []) { if (nachPerson.has(id)) { k = nachPerson.get(id); break; } }
    mandat.set(m.id, k ?? null);
  }
  return { lead, deal, mandat };
}
/** Passt eine Zuordnung zum Filter? `null` = alle, `'ohne'` = ohne Kanal. */
export const passtKanal = (k: string | null | undefined, filter: string | null): boolean => filter === null || (filter === 'ohne' ? !k : k === filter);

// ── Quoten: Plan, Annahme, Ist ───────────────────────────────────────────────────────────────────────────────────

/**
 * Die Annahme, solange ein Kanal keine eigene Plan-Quote hat: SQL → Angebot und Angebot → Gewonnen aus den Wahrscheinlichkeiten der
 * Pipeline (Stammdaten › Stufen, sonst die vorsichtigen Standardwerte — EINE Quelle), die Lead-Stufen als feste Startannahme.
 */
export const LEAD_ANNAHME: Pick<Record<PlanQuote, number>, 'leadZuGespraech' | 'gespraechZuSql'> = { leadZuGespraech: 30, gespraechZuSql: 40 };
export function standardQuoten(eigene?: CrmBestand['wahrscheinlichkeiten']): Record<PlanQuote, number> {
  const pSql = wahrscheinlichkeit('qualifiziert', eigene), pAng = wahrscheinlichkeit('angebot', eigene);
  return { ...LEAD_ANNAHME, sqlZuAngebot: pAng > 0 ? Math.min(100, Math.round((100 * pSql) / pAng)) : 40, angebotZuGewonnen: pAng > 0 ? pAng : 50 };
}
export interface QuoteWert { wert: number; quelle: 'plan' | 'annahme' }
export function wirksameQuoten(k: Pick<LeadKanal, 'quoten'>, std: Record<PlanQuote, number>): Record<PlanQuote, QuoteWert> {
  return Object.fromEntries(PLAN_QUOTE_IDS.map(q => [q, k.quoten[q] ? { wert: k.quoten[q] as number, quelle: 'plan' as const } : { wert: std[q], quelle: 'annahme' as const }])) as Record<PlanQuote, QuoteWert>;
}

const imGespraech = (z: Pick<LeadZeile, 'status' | 'deal' | 'sqlAm'>) => ['im_gespraech', 'qualifizierung', 'sql', 'kunde'].includes(z.status) || !!z.deal || !!z.sqlAm;
const istSql = (z: Pick<LeadZeile, 'status' | 'deal' | 'sqlAm'>) => z.status === 'sql' || z.status === 'kunde' || !!z.deal || !!z.sqlAm;

/**
 * Gemessene Quoten (ab `MINDESTMENGE`, sonst null): Lead → Gespräch und Gespräch → SQL aus den Leads; Angebot → Gewonnen und SQL → Gewonnen
 * aus `gemesseneQuoten` (entschiedene Deals) — SQL → Angebot ist deren Verhältnis.
 */
export function istQuoten(zeilen: readonly Pick<LeadZeile, 'status' | 'deal' | 'sqlAm'>[], deals: Chance[]): { werte: Record<PlanQuote, number | null>; n: Record<PlanQuote, number> } {
  const gespraech = zeilen.filter(imGespraech), sql = gespraech.filter(istSql);
  const gq = gemesseneQuoten(deals);
  const qSql = gq.find(x => x.stufe === 'qualifiziert'), qAng = gq.find(x => x.stufe === 'angebot');
  const sqlZuAng = qSql?.quote != null && qAng?.quote ? Math.min(100, Math.round((100 * qSql.quote) / qAng.quote)) : null;
  return {
    werte: {
      leadZuGespraech: zeilen.length >= MINDESTMENGE ? Math.round((100 * gespraech.length) / zeilen.length) : null,
      gespraechZuSql: gespraech.length >= MINDESTMENGE ? Math.round((100 * sql.length) / gespraech.length) : null,
      sqlZuAngebot: sqlZuAng,
      angebotZuGewonnen: qAng?.quote ?? null,
    },
    n: { leadZuGespraech: zeilen.length, gespraechZuSql: gespraech.length, sqlZuAngebot: qSql?.n ?? 0, angebotZuGewonnen: qAng?.n ?? 0 },
  };
}

// ── Kanal-Stand (Liste der Leadkanäle) ───────────────────────────────────────────────────────────────────────────

/**
 * Wann ein Lead entstand: die früheste Anlage einer seiner Personen, die als NEUER Lead zählt (von Hand bzw. aus einem Kanal angelegt —
 * EINE Regel mit dem Wochen-Scoreboard, lib/crm/neue-leads.ts `neuerLeadAm`; Prüf-Fund 11.10.).
 */
export function leadAngelegt(z: Pick<LeadZeile, 'personen'>, kontaktNach: ReadonlyMap<string, Pick<Kontakt, 'importiertAm' | 'aktivitaeten'> & { quelle?: string }>): string | null {
  const tageL = z.personen.map(p => kontaktNach.get(p.id)).map(k => (k ? neuerLeadAm(k) : null)).filter((t): t is string => !!t).sort();
  return tageL[0] ?? null;
}

export interface KanalStand {
  id: string; name: string; herkunft: LeadKanal['herkunft']; welt: Welt; aktiv: boolean;
  leads: number; inArbeit: number;
  /** Neue Leads Ø je Monat (letzte drei Monate). */
  neueLeadsMonat: number;
  dealsOffen: number; wertOffen: number; gewonnen: number;
  quoten: Record<PlanQuote, { plan: QuoteWert; ist: number | null; n: number }>;
  /** Kosten je SQL (Plan): Kosten je Lead ÷ (Lead→Gespräch × Gespräch→SQL). */
  kostenJeSql: number | null;
}
export function kanalStaende(e: { kanaele: readonly LeadKanal[]; zeilen: readonly LeadZeile[]; crm: Pick<CrmBestand, 'chancen' | 'mandate' | 'kampagnen' | 'teilnahmen' | 'events' | 'wahrscheinlichkeiten'>; kontaktNach: ReadonlyMap<string, Pick<Kontakt, 'importiertAm' | 'aktivitaeten'>>; heute: string; zuordnung?: Zuordnung }): KanalStand[] {
  const zo = e.zuordnung ?? zuordnen(e.kanaele, e.zeilen, e.crm);
  const std = standardQuoten(e.crm.wahrscheinlichkeiten);
  const ab = tagPlus(e.heute, -91);
  return [...e.kanaele].sort((a, b) => Number(b.aktiv) - Number(a.aktiv) || (a.rang ?? 1e9) - (b.rang ?? 1e9) || a.name.localeCompare(b.name)).map(k => {
    const z = e.zeilen.filter(x => zo.lead.get(x.id) === k.id);
    const deals = e.crm.chancen.filter(c => zo.deal.get(c.id) === k.id);
    const offen = deals.filter(c => OFFENE_STUFEN.includes(c.stufe));
    const ist = istQuoten(z, deals);
    const plan = wirksameQuoten(k, std);
    const neu = z.filter(x => { const t = leadAngelegt(x, e.kontaktNach); return !!t && t >= ab && t <= e.heute; }).length;
    const kSql = plan.leadZuGespraech.wert * plan.gespraechZuSql.wert / 10_000;
    return {
      id: k.id, name: k.name, herkunft: k.herkunft, welt: herkunftVon(k.herkunft).welt, aktiv: k.aktiv,
      // „In Arbeit“ = EINE Zählregel mit der Leads-Liste und dem Trichter (lib/crm/leads.ts `inArbeit`, Abnahme 14.10., B5).
      leads: z.length, inArbeit: z.filter(inArbeit).length,
      neueLeadsMonat: rund1(neu / 3), dealsOffen: offen.length, wertOffen: Math.round(offen.reduce((a, c) => a + gesamtwert(c), 0)),
      gewonnen: deals.filter(c => c.stufe === 'gewonnen').length,
      quoten: Object.fromEntries(PLAN_QUOTE_IDS.map(q => [q, { plan: plan[q], ist: ist.werte[q], n: ist.n[q] }])) as KanalStand['quoten'],
      kostenJeSql: k.kostenJeLead && kSql > 0 ? Math.round(k.kostenJeLead / kSql) : null,
    };
  });
}

// ── 2. Der Kreislauf ─────────────────────────────────────────────────────────────────────────────────────────────

export type KreislaufId = 'kanaele' | 'leads' | 'deals' | 'followup' | 'fulfillment' | 'nachher' | 'wiederkauf';
export interface KreislaufStufe {
  id: KreislaufId; label: string;
  /** Die Zahl der Stufe (Kanäle, Leads in Arbeit, offene Deals, fällige Follow-ups, aktive Mandate, Kunden mit offenen Schritten, Bestandskunden mit neuem Deal). */
  anzahl: number;
  zusatz: string;
  /** Plan und Ist der Umwandlung in die nächste Stufe (Text), `annahme` = Plan ist eine Annahme, `istFehlt` = noch zu wenig gemessen. */
  plan?: string; ist?: string; annahme?: boolean;
  /** Die vorhandene Ansicht der Stufe (Liste, Board, Mandate …). */
  href: string; hrefLabel: string;
  /** Hängt etwas (17.10., Reise im Kreislauf): `rot` = überfällige Follow-ups — dieselbe Zahl wie `zusatz`, nichts neu gerechnet. */
  haengt?: 'rot';
}
export interface NachLeistungZeile {
  mandatId: string; kunde: string; titel: string; status: Mandat['status']; produkt?: string; phase?: string;
  schritte: { id: NachLeistungSchritt; label: string; erledigt: boolean; quelle: 'abgeleitet' | 'hand' | null; am?: string; von?: string; grund?: string }[];
  offen: number; href: string;
  /** Fortschritt im Paket (10.10., Leistungstreppe): Stufe, Lieferungen „n/m“, reif für die nächste Stufe — nur, wenn eine Treppe gepflegt ist. */
  paket?: string; lieferungen?: string; naechsteStufe?: string;
}
export interface Kreislauf {
  stufen: KreislaufStufe[];
  fulfillment: { produktId: string | null; produkt: string; phase: string | null; anzahl: number; href: string }[];
  kunden: NachLeistungZeile[];
  /** Bestandskunden (Firma mit gewonnenem Deal bzw. Mandat), die erneut gekauft haben. */
  wiederkauf: { kunden: number; wiederkaeufer: number; offen: number; quote: number | null };
}
export interface KreislaufEingabe {
  heute: string;
  kanaele: readonly LeadKanal[];
  zeilen: readonly LeadZeile[];
  crm: Pick<CrmBestand, 'chancen' | 'mandate' | 'leistungen' | 'kampagnen' | 'teilnahmen' | 'events' | 'wahrscheinlichkeiten'>;
  kontakte: readonly Pick<Kontakt, 'id' | 'importiertAm' | 'aktivitaeten' | 'einwilligungen'>[];
  nachLeistung: PlanungDatei['nachLeistung'];
  /** Fällige Follow-ups (lib/crm/followup.ts `faellige`) — je Lead-Kennung bzw. ohne. */
  followup: { faellig: number; ueberfaellig: number };
  zuordnung?: Zuordnung;
  /** Fortschritt je Mandat aus der Leistungstreppe (Produkte & Mandate, lib/crm/treppe-server.ts `fortschrittFuerKreislauf`) — fehlt: wie bisher. */
  fortschritt?: Record<string, { paket?: string; lieferungen?: string; naechsteStufe?: string }>;
}

const pz = (n: number | null | undefined) => (n == null ? '—' : `${Math.round(n)} %`);

/** Die Schritte „nach der Leistung“ eines Mandats — abgeleitet aus den Daten, sonst von Hand. */
export function nachLeistungSchritte(m: Mandat, crm: Pick<CrmBestand, 'chancen'>, kontakte: readonly Pick<Kontakt, 'id' | 'einwilligungen'>[], marken: PlanungDatei['nachLeistung'][string] | undefined): NachLeistungZeile['schritte'] {
  const start = m.start ?? m.geaendert?.slice(0, 10) ?? '';
  const spaeter = crm.chancen.filter(c => c.id !== m.chanceId && ((!!m.firmaId && c.firmaId === m.firmaId) || c.kontaktIds.some(id => (m.kontaktIds ?? []).includes(id))) && tagVon(c.angelegt) >= start);
  const gleich = spaeter.find(c => !!m.leistungId && c.leistungId === m.leistungId);
  const anders = spaeter.find(c => !m.leistungId || c.leistungId !== m.leistungId);
  const personen = new Set(m.kontaktIds ?? []);
  const newsletter = kontakte.some(k => personen.has(k.id) && (k.einwilligungen ?? []).some(e => e.kanal === 'newsletter' && !e.widerrufenAm));
  const abgeleitet: Partial<Record<NachLeistungSchritt, string>> = {
    ...(m.status === 'beendet' ? { ende: m.ende ? `beendet am ${m.ende}` : 'Mandat beendet' } : {}),
    ...(gleich ? { upselling: `neuer Deal „${gleich.titel}“ (gleiches Produkt)` } : {}),
    ...(anders ? { crossselling: `neuer Deal „${anders.titel}“` } : {}),
    ...(newsletter ? { newsletter: 'Newsletter-Einwilligung liegt vor' } : {}),
  };
  return NACH_LEISTUNG.map(s => {
    const grund = abgeleitet[s.id];
    const hand = marken?.[s.id];
    return { id: s.id, label: s.label, erledigt: !!grund || !!hand, quelle: grund ? 'abgeleitet' as const : hand ? 'hand' as const : null, ...(grund ? { grund } : {}), ...(hand && !grund ? { am: hand.am, von: hand.von } : {}) };
  });
}

/** Zusatz der Stufe „Fulfillment“ aus der Leistungstreppe: wie viele aktive Kunden im Paket stehen und wie viele reif für die nächste Stufe sind. */
function fortschrittZusatz(aktive: readonly Pick<Mandat, 'id'>[], f: KreislaufEingabe['fortschritt']): string[] {
  if (!f || !Object.keys(f).length) return [];
  const imPaket = aktive.filter(m => f[m.id]?.paket).length;
  const reif = aktive.filter(m => f[m.id]?.naechsteStufe).length;
  return [`${imPaket} in Lieferung`, ...(reif ? [`${reif} reif für die nächste Stufe`] : [])];
}

/** Der ganze Kreislauf — optional nur für einen Kanal (`filter` = Kennung, `'ohne'` = ohne Kanal). */
export function kreislauf(e: KreislaufEingabe, filter: string | null = null): Kreislauf {
  const zo = e.zuordnung ?? zuordnen(e.kanaele, e.zeilen, e.crm);
  const aktiv = aktiveKanaele(e.kanaele).filter(k => filter === null || k.id === filter);
  const std = standardQuoten(e.crm.wahrscheinlichkeiten);
  const z = e.zeilen.filter(x => passtKanal(zo.lead.get(x.id), filter));
  // Nur Business (Prüf-Fund 11.10.): Deals und Mandate einer Privat-Einheit zählen im Kreislauf nicht (`imBusiness`, lib/crm/treppe.ts).
  const deals = e.crm.chancen.filter(c => imBusiness(c) && passtKanal(zo.deal.get(c.id), filter));
  const mandate = e.crm.mandate.filter(m => !m.geloeschtAm && imBusiness(m) && passtKanal(zo.mandat.get(m.id), filter));
  const ist = istQuoten(z, deals);
  // Plan über die gewählten Kanäle gemittelt (gewichtet nach Plan-Leads); ohne Kanal die Annahme.
  const gewicht = aktiv.reduce((a, k) => a + Math.max(k.leadsMonat, 0.0001), 0);
  const planQ = (q: PlanQuote) => (aktiv.length ? aktiv.reduce((a, k) => a + wirksameQuoten(k, std)[q].wert * Math.max(k.leadsMonat, 0.0001), 0) / gewicht : std[q]);
  const annahme = (...qs: PlanQuote[]) => !aktiv.length || aktiv.some(k => qs.some(q => !k.quoten[q]));
  const kontaktNach = new Map(e.kontakte.map(k => [k.id, k]));
  const ab = tagPlus(e.heute, -91);
  const neueLeads = z.filter(x => { const t = leadAngelegt(x, kontaktNach); return !!t && t >= ab; }).length;
  const planLeads = aktiv.reduce((a, k) => a + k.leadsMonat, 0);
  // „In Arbeit“ = EINE Zählregel mit der Leads-Liste und dem Trichter (lib/crm/leads.ts `inArbeit`, Abnahme 14.10., B5) — vorher eine eigene
  // Statusliste, die auch kalte Leads zählte.
  const leadsInArbeit = z.filter(inArbeit);
  const offen = deals.filter(c => OFFENE_STUFEN.includes(c.stufe));
  const leadZuSqlPlan = planQ('leadZuGespraech') * planQ('gespraechZuSql') / 100;
  const leadZuSqlIst = ist.werte.leadZuGespraech != null && ist.werte.gespraechZuSql != null ? (ist.werte.leadZuGespraech * ist.werte.gespraechZuSql) / 100 : null;
  const sqlZuGewPlan = planQ('sqlZuAngebot') * planQ('angebotZuGewonnen') / 100;
  const gq = gemesseneQuoten(deals).find(x => x.stufe === 'qualifiziert');
  const aktiveM = mandate.filter(m => m.status === 'aktiv');
  // Fulfillment: aktive Mandate je Produkt und Phase (Produkte & Mandate).
  const leistung = new Map(e.crm.leistungen.map(l => [l.id, l]));
  const ff = new Map<string, { produktId: string | null; produkt: string; phase: string | null; anzahl: number; href: string }>();
  for (const m of aktiveM) {
    const l = m.leistungId ? leistung.get(m.leistungId) : undefined;
    const phase = m.phase ? l?.phasen?.find(p => p.id === m.phase)?.name ?? null : null;
    const key = `${l?.id ?? '-'}|${phase ?? '-'}`;
    const alt = ff.get(key) ?? { produktId: l?.id ?? null, produkt: l?.name ?? 'ohne Produkt', phase, anzahl: 0, href: l ? WEG.produkt(l.id) : WEG.mandat() };
    alt.anzahl++; ff.set(key, alt);
  }
  // Nach der Leistung: aktive Mandate (schon während des Fulfillments) und die im letzten Jahr beendeten.
  const seit = tagPlus(e.heute, -365);
  const kunden: NachLeistungZeile[] = mandate.filter(m => m.status === 'aktiv' || (m.status === 'beendet' && (m.ende ?? m.geaendert.slice(0, 10)) >= seit)).map(m => {
    const l = m.leistungId ? leistung.get(m.leistungId) : undefined;
    const schritte = nachLeistungSchritte(m, e.crm, e.kontakte, e.nachLeistung[m.id]);
    return {
      mandatId: m.id, kunde: m.kunde, titel: m.titel, status: m.status, ...(l ? { produkt: l.name } : {}),
      ...(m.phase && l?.phasen?.find(p => p.id === m.phase) ? { phase: l.phasen.find(p => p.id === m.phase)!.name } : {}),
      schritte, offen: schritte.filter(s => !s.erledigt && (m.status === 'beendet' || NACH_LEISTUNG.find(x => x.id === s.id)?.schonWaehrend)).length,
      href: mandateLink('mandate', m.id), ...(e.fortschritt?.[m.id] ?? {}),
    };
  }).sort((a, b) => b.offen - a.offen || a.kunde.localeCompare(b.kunde));
  // Wiederkauf: Firmen mit gewonnenem Deal oder Mandat; wer danach einen weiteren Deal hat, kauft wieder.
  const kaeufe = new Map<string, string[]>();
  for (const c of deals) if (c.firmaId && c.stufe === 'gewonnen') kaeufe.set(c.firmaId, [...(kaeufe.get(c.firmaId) ?? []), tagVon(c.historie.filter(h => h.stufe === 'gewonnen').pop()?.am ?? c.geaendert)]);
  for (const m of mandate) if (m.firmaId && !kaeufe.has(m.firmaId) && (m.status === 'aktiv' || m.status === 'beendet' || m.status === 'pausiert')) kaeufe.set(m.firmaId, [m.start ?? m.geaendert.slice(0, 10)]);
  let wieder = 0, offenWieder = 0;
  for (const [firma, daten] of kaeufe) {
    const erster = [...daten].sort()[0];
    const spaeter = deals.filter(c => c.firmaId === firma && tagVon(c.angelegt) > erster);
    if (spaeter.some(c => c.stufe === 'gewonnen') || daten.length > 1) wieder++;
    offenWieder += spaeter.filter(c => OFFENE_STUFEN.includes(c.stufe)).length;
  }
  const kundenZahl = kaeufe.size;
  const stufen: KreislaufStufe[] = [
    { id: 'kanaele', label: 'Leadkanäle', anzahl: aktiv.length, zusatz: aktiv.length ? `${de1(planLeads)} Leads/Monat geplant` : 'noch kein Leadkanal angelegt',
      plan: `${de1(planLeads)} neue Leads/Monat`, ist: `${de1(neueLeads / 3)} neue Leads/Monat (Ø 3 Monate)`, href: '', hrefLabel: 'Leadkanäle pflegen' },
    { id: 'leads', label: 'Leads & Qualifizierung', anzahl: leadsInArbeit.length, zusatz: `${z.length} Leads gesamt`,
      plan: `Lead → SQL ${pz(leadZuSqlPlan)}`, ist: `Lead → SQL ${pz(leadZuSqlIst)}`, annahme: annahme('leadZuGespraech', 'gespraechZuSql'), href: WEG.qualifizierung(), hrefLabel: 'Qualifizierung öffnen' },
    { id: 'deals', label: 'Deals (SQL … Abschluss)', anzahl: offen.length, zusatz: `${Math.round(offen.reduce((a, c) => a + gesamtwert(c), 0)).toLocaleString('de-DE')} € offen`,
      plan: `SQL → Gewonnen ${pz(sqlZuGewPlan)}`, ist: `SQL → Gewonnen ${pz(gq?.quote)}`, annahme: annahme('sqlZuAngebot', 'angebotZuGewonnen'), href: WEG.deals(), hrefLabel: 'Deals öffnen' },
    { id: 'followup', label: 'Abschluss & Follow-up', anzahl: e.followup.faellig, zusatz: e.followup.ueberfaellig ? `${e.followup.ueberfaellig} überfällig` : 'nichts überfällig', href: WEG.followup(), hrefLabel: 'Follow-up öffnen', ...(e.followup.ueberfaellig ? { haengt: 'rot' as const } : {}) },
    { id: 'fulfillment', label: 'Fulfillment', anzahl: aktiveM.length, zusatz: [`${ff.size} Produkt-Phasen`, ...(fortschrittZusatz(aktiveM, e.fortschritt))].join(' · '), href: WEG.fulfillment('kreislauf'), hrefLabel: 'Fulfillment öffnen' },
    { id: 'nachher', label: 'Nach der Leistung', anzahl: kunden.filter(k => k.offen > 0).length, zusatz: 'Upselling · Cross-Selling · Bewertung · Testimonial · Newsletter', href: '', hrefLabel: 'Schritte je Kunde' },
    { id: 'wiederkauf', label: 'Wiederkauf', anzahl: wieder, zusatz: `${offenWieder} offene Deals mit Bestandskunden`,
      ist: kundenZahl >= MINDESTMENGE ? `${Math.round((100 * wieder) / kundenZahl)} % kaufen wieder` : `${wieder} von ${kundenZahl} Kunden`, href: WEG.deals(), hrefLabel: 'Deals öffnen' },
  ];
  return {
    stufen, fulfillment: [...ff.values()].sort((a, b) => b.anzahl - a.anzahl || a.produkt.localeCompare(b.produkt)), kunden,
    wiederkauf: { kunden: kundenZahl, wiederkaeufer: wieder, offen: offenWieder, quote: kundenZahl >= MINDESTMENGE ? Math.round((100 * wieder) / kundenZahl) : null },
  };
}

// ── 3. Ziel → Aktivitäten (Rückwärts-Trichter) ───────────────────────────────────────────────────────────────────

export interface Aktivitaeten { leads: number; gespraeche: number; sql: number; angebote: number; gewonnen: number }
export interface ZielKanalZeile extends Aktivitaeten {
  kanalId: string; name: string; welt: Welt; verantwortlich: string; vertrieb: string;
  /** Anteil an den Deals (0–1). */
  anteil: number;
  quoten: Record<PlanQuote, QuoteWert>;
  /** Ab wann (heute bzw. Anfang des Zeitraums) und bis wann neue Leads noch in diesem Zeitraum abschließen (Ende − Sales Cycle). */
  start: string; letzterStart: string;
  /** Wochen zwischen Start und letztem Start (0, wenn es zu spät ist). */
  wochen: number;
  /** Zu spät: der letzte Start liegt vor dem Start — Leads ab jetzt zählen für den nächsten Zeitraum. */
  zuSpaet: boolean;
  /** Liegt heute im Lead-Fenster (dann gelten die Wochenziele jetzt)? */
  imFenster: boolean;
  jeWoche: (Aktivitaeten & { beitraege: number }) | null;
  /** Nötige Leads je Monat gegen den Plan des Kanals. */
  leadsMonatNoetig: number | null; leadsMonatPlan: number;
  kosten: number | null;
}
export interface ZielLage {
  ziel: UmsatzZiel;
  dealWert: { wert: number | null; quelle: 'eingabe' | 'gemessen' | null };
  /** Noch nötige Deals — für den REST des Ziels (Ziel − schon gewonnener Umsatz im Zeitraum). */
  deals: number | null;
  /** `rest` = Ziel − gewonnener Umsatz im Zeitraum (nie unter 0) — daraus rechnet der Trichter. */
  ist: { umsatz: number; rest: number; anteil: number | null; offenGewichtet: number };
  kanaele: ZielKanalZeile[];
  summe: Aktivitaeten & { kosten: number | null };
  fehlt: string[];
  vorbei: boolean;
}

/** Wer im Team eine Welt verantwortet (wie lib/crm/team.ts `verantwortlich`, mit übergebener Liste — testbar ohne Build-Variable). */
export const verantwortlichIn = (team: readonly Pick<Mitglied, 'id' | 'verantwortet'>[], w: Welt): string => team.find(t => t.verantwortet.includes(w))?.id ?? team[0]?.id ?? BEIDE;

/** Anteile der Kanäle an den Deals: eigene Anteile des Ziels, sonst nach der geplanten Leistung (Leads/Monat × alle Quoten), sonst gleich. */
export function kanalAnteile(aktiv: readonly LeadKanal[], ziel: Pick<UmsatzZiel, 'anteile'>, std: Record<PlanQuote, number>): Map<string, number> {
  const eigen = aktiv.filter(k => ziel.anteile && ziel.anteile[k.id] !== undefined);
  const roh = new Map<string, number>(eigen.length
    ? aktiv.map(k => [k.id, ziel.anteile?.[k.id] ?? 0])
    : aktiv.map(k => { const q = wirksameQuoten(k, std); return [k.id, k.leadsMonat * PLAN_QUOTE_IDS.reduce((a, x) => a * q[x].wert / 100, 1)]; }));
  const summe = [...roh.values()].reduce((a, b) => a + b, 0);
  return new Map(aktiv.map(k => [k.id, summe > 0 ? (roh.get(k.id) ?? 0) / summe : aktiv.length ? 1 / aktiv.length : 0]));
}

/** Der Rückwärts-Trichter eines Umsatzziels. `gewonnenIst` = gewonnene Deals dieser Gesellschaft (für das Ist). */
export function zielLage(ziel: UmsatzZiel, e: {
  heute: string; kanaele: readonly LeadKanal[]; crm: Pick<CrmBestand, 'chancen' | 'wahrscheinlichkeiten'>; team?: readonly Pick<Mitglied, 'id' | 'verantwortet'>[];
}): ZielLage {
  const team = e.team ?? TEAM;
  const aktiv = aktiveKanaele(e.kanaele);
  const std = standardQuoten(e.crm.wahrscheinlichkeiten);
  const gemessen = zyklus(e.crm.chancen).dealGroesse;
  const dealWert = ziel.dealWert ? { wert: ziel.dealWert, quelle: 'eingabe' as const } : gemessen ? { wert: gemessen, quelle: 'gemessen' as const } : { wert: null, quelle: null };
  const fehlt: string[] = [];
  if (!dealWert.wert) fehlt.push('Ø Deal-Wert fehlt — eintragen oder erst drei gewonnene Deals mit Wert abwarten.');
  if (!aktiv.length) fehlt.push('Kein aktiver Leadkanal — Leadkanäle anlegen, über die geplant wird.');
  // Ist zuerst (Prüf-Fund 11.10.): der Trichter rechnet mit dem REST des Ziels — schon gewonnener Umsatz im Zeitraum braucht keine Leads,
  // Gespräche und Angebote mehr (Wochenziele, Kapazitätsbedarf, Scoreboard-Soll lesen alle hieraus).
  const gewonnenAm = (c: Chance) => tagVon(c.historie.filter(h => h.stufe === 'gewonnen').pop()?.am ?? c.geaendert);
  const eigene = e.crm.chancen.filter(c => c.gesellschaft === ziel.gesellschaft);
  const umsatzIst = eigene.filter(c => c.stufe === 'gewonnen' && gewonnenAm(c) >= ziel.von && gewonnenAm(c) <= ziel.bis).reduce((a, c) => a + gesamtwert(c), 0);
  const rest = Math.max(0, ziel.umsatz - umsatzIst);
  const deals = dealWert.wert ? Math.ceil(rest / dealWert.wert) : null;
  const vorbei = e.heute > ziel.bis;
  const start = e.heute > ziel.von ? e.heute : ziel.von;
  const anteile = kanalAnteile(aktiv, ziel, std);
  const kanaele: ZielKanalZeile[] = aktiv.map(k => {
    const q = wirksameQuoten(k, std);
    const anteil = anteile.get(k.id) ?? 0;
    const gewonnen = (deals ?? 0) * anteil;
    const angebote = gewonnen / (q.angebotZuGewonnen.wert / 100);
    const sql = angebote / (q.sqlZuAngebot.wert / 100);
    const gespraeche = sql / (q.gespraechZuSql.wert / 100);
    const leads = gespraeche / (q.leadZuGespraech.wert / 100);
    const letzterStart = tagPlus(ziel.bis, -7 * k.zyklusWochen);
    const wochen = Math.max(0, tage(start, letzterStart) / 7);
    const zuSpaet = !vorbei && leads > 0 && wochen < 1;
    const imFenster = !vorbei && e.heute >= ziel.von && e.heute <= letzterStart;
    const w = wochen >= 1 ? wochen : null;
    const welt = herkunftVon(k.herkunft).welt;
    return {
      kanalId: k.id, name: k.name, welt, verantwortlich: k.verantwortlich ?? verantwortlichIn(team, welt), vertrieb: k.vertrieb ?? verantwortlichIn(team, 'sales'),
      anteil, quoten: q, gewonnen, angebote, sql, gespraeche, leads, start, letzterStart, wochen: rund1(wochen), zuSpaet, imFenster,
      jeWoche: w ? { leads: leads / w, gespraeche: gespraeche / w, sql: sql / w, angebote: angebote / w, gewonnen: gewonnen / w, beitraege: k.beitraegeWoche ?? 0 } : null,
      leadsMonatNoetig: w ? rund1(leads / (w / WOCHEN_JE_MONAT)) : null, leadsMonatPlan: k.leadsMonat,
      kosten: k.kostenJeLead ? Math.round(leads * k.kostenJeLead) : null,
    };
  });
  if (kanaele.some(k => k.zuSpaet)) fehlt.push('Für einige Kanäle ist es zu spät: ihr letzter Start (Ende − Sales Cycle) ist vorbei — neue Leads zählen fürs nächste Ziel.');
  const sum = (f: keyof Aktivitaeten) => kanaele.reduce((a, k) => a + k[f], 0);
  // Ist: gewonnene Deals der Gesellschaft im Zeitraum (Tag des Gewinns, oben gerechnet) — und die offenen dieser Gesellschaft gewichtet.
  const offenGewichtet = eigene.filter(c => OFFENE_STUFEN.includes(c.stufe) && (!c.erwartetAm || c.erwartetAm <= ziel.bis)).reduce((a, c) => a + (gesamtwert(c) * wahrscheinlichkeit(c.stufe, e.crm.wahrscheinlichkeiten)) / 100, 0);
  const kostenL = kanaele.filter(k => k.kosten !== null);
  return {
    ziel, dealWert, deals, vorbei,
    ist: { umsatz: Math.round(umsatzIst), rest: Math.round(rest), anteil: ziel.umsatz > 0 ? Math.round((100 * umsatzIst) / ziel.umsatz) : null, offenGewichtet: Math.round(offenGewichtet) },
    kanaele, summe: { leads: sum('leads'), gespraeche: sum('gespraeche'), sql: sum('sql'), angebote: sum('angebote'), gewonnen: sum('gewonnen'), kosten: kostenL.length ? kostenL.reduce((a, k) => a + (k.kosten ?? 0), 0) : null },
    fehlt,
  };
}

// ── 4. Gegen die Kapazität ───────────────────────────────────────────────────────────────────────────────────────

export interface PersonBedarf { person: string; leads: number; gespraeche: number; angebote: number; beitraege: number; minuten: number; stunden: number }
/** Je Person diese Woche: Leads (Verantwortliche des Kanals), Gespräche + Angebote (Vertrieb), Beiträge — in Stunden nach den Zeiten. „beide“ teilt gleich. */
export function bedarfJePerson(lagen: readonly ZielLage[], kanaele: readonly LeadKanal[], zeiten: AktivitaetZeiten, team: readonly string[] = TEAM.map(t => t.id)): PersonBedarf[] {
  const je = new Map<string, PersonBedarf>(team.map(p => [p, { person: p, leads: 0, gespraeche: 0, angebote: 0, beitraege: 0, minuten: 0, stunden: 0 }]));
  const auf = (wer: string, f: (b: PersonBedarf, anteil: number) => void) => {
    const personen = wer === BEIDE || !je.has(wer) ? team : [wer];
    for (const p of personen) f(je.get(p)!, 1 / personen.length);
  };
  const nachId = new Map(kanaele.map(k => [k.id, k]));
  const beitragGezaehlt = new Set<string>();
  for (const l of lagen) for (const z of l.kanaele) {
    if (!z.imFenster || !z.jeWoche) continue;
    const k = nachId.get(z.kanalId);
    const minLead = k?.minutenJeLead ?? herkunftVon(k?.herkunft ?? 'frei').minutenJeLead;
    const w = z.jeWoche;
    auf(z.verantwortlich, (b, a) => { b.leads += w.leads * a; b.minuten += w.leads * minLead * a; });
    auf(z.vertrieb, (b, a) => { b.gespraeche += w.gespraeche * a; b.angebote += w.angebote * a; b.minuten += (w.gespraeche * (zeiten.gespraech + zeiten.nachfassen) + w.angebote * zeiten.angebot) * a; });
    if (!beitragGezaehlt.has(z.kanalId) && w.beitraege > 0) {
      beitragGezaehlt.add(z.kanalId);
      auf(z.verantwortlich, (b, a) => { b.beitraege += w.beitraege * a; b.minuten += w.beitraege * zeiten.beitrag * a; });
    }
  }
  return [...je.values()].map(b => ({ ...b, leads: rund1(b.leads), gespraeche: rund1(b.gespraeche), angebote: rund1(b.angebote), beitraege: rund1(b.beitraege), minuten: Math.round(b.minuten), stunden: rund1(b.minuten / 60) }));
}

export type PlanMachbar = 'machbar' | 'eng' | 'nicht-machbar' | 'unbekannt' | 'nichts';
export interface KapaZeile { person: string; stunden: number; frei: number | null; status: PlanMachbar; text: string }
/**
 * Bedarf gegen die freie Zeit (Ø nächste vier Wochen, lib/kapazitaet: belastbar − bereits verplant) — Schwellen wie die Kapazität:
 * bis 70 % machbar, bis 90 % eng, sonst „nicht machbar — bräuchte X h/Woche, frei sind F“.
 */
export function kapaVergleich(bedarf: readonly PersonBedarf[], frei: Readonly<Record<string, number | null>> | null): KapaZeile[] {
  return bedarf.map(b => {
    const f = frei ? frei[b.person] ?? null : null;
    if (b.stunden <= 0) return { person: b.person, stunden: 0, frei: f, status: 'nichts' as const, text: 'Diese Woche keine geplanten Aktivitäten.' };
    if (f === null) return { person: b.person, stunden: b.stunden, frei: null, status: 'unbekannt' as const, text: `Braucht ${b.stunden} h/Woche — Kapazität unbekannt (Planung › Kapazität).` };
    const anteil = f > 0 ? b.stunden / f : Infinity;
    const status: PlanMachbar = anteil <= MACHBAR_BIS ? 'machbar' : anteil <= ENG_BIS ? 'eng' : 'nicht-machbar';
    const text = status === 'nicht-machbar' ? `Nicht machbar — bräuchte ${b.stunden} h/Woche, frei sind ${de1(Math.max(0, f))} h.` : `${status === 'eng' ? 'Eng' : 'Machbar'}: ${b.stunden} von ${de1(f)} freien h/Woche.`;
    return { person: b.person, stunden: b.stunden, frei: rund1(f), status, text };
  });
}

// ── 5. Wochenziele fürs Scoreboard ───────────────────────────────────────────────────────────────────────────────

/** Was die Planung für die laufende Woche verlangt (Summe der Kanäle im Lead-Fenster, aufgerundet) — null ohne Plan. */
export interface PlanWoche { leads: number; gespraeche: number; sql: number; angebote: number; quelle: string }
export function wochenziele(lagen: readonly ZielLage[]): PlanWoche | null {
  const z = lagen.flatMap(l => l.kanaele.filter(k => k.imFenster && k.jeWoche).map(k => k.jeWoche!));
  if (!z.length) return null;
  const s = (f: keyof Aktivitaeten) => { const n = z.reduce((a, x) => a + x[f], 0); return n > 0 ? Math.max(1, Math.ceil(n - 1e-9)) : 0; };
  const namen = lagen.filter(l => l.kanaele.some(k => k.imFenster)).map(l => l.ziel.titel ?? `Umsatzziel bis ${l.ziel.bis}`);
  return { leads: s('leads'), gespraeche: s('gespraeche'), sql: s('sql'), angebote: s('angebote'), quelle: `Planung: ${namen.join(' · ')}` };
}

/** Je Welt diese Woche: Leads nach der Welt ihres Kanals, Gespräche/SQL/Angebote im Sales (Deals führt immer der Vertrieb). */
export function jeWelt(lagen: readonly ZielLage[]): Record<Welt, { leads: number; gespraeche: number; sql: number; angebote: number }> {
  const r: Record<Welt, { leads: number; gespraeche: number; sql: number; angebote: number }> = { sales: { leads: 0, gespraeche: 0, sql: 0, angebote: 0 }, marketing: { leads: 0, gespraeche: 0, sql: 0, angebote: 0 }, event: { leads: 0, gespraeche: 0, sql: 0, angebote: 0 } };
  for (const l of lagen) for (const z of l.kanaele) {
    if (!z.imFenster || !z.jeWoche) continue;
    r[z.welt].leads += z.jeWoche.leads;
    r.sales.gespraeche += z.jeWoche.gespraeche; r.sales.sql += z.jeWoche.sql; r.sales.angebote += z.jeWoche.angebote;
  }
  for (const w of Object.keys(r) as Welt[]) for (const f of ['leads', 'gespraeche', 'sql', 'angebote'] as const) r[w][f] = rund1(r[w][f]);
  return r;
}

// ── 6. Challenges ────────────────────────────────────────────────────────────────────────────────────────────────

export type WochenZahlen = Record<ChallengeArt, number>;
const leer = (): WochenZahlen => ({ gespraeche: 0, leads: 0, angebote: 0, deals: 0, powerhours: 0, reaktivieren: 0, events: 0 });
const ANSPRACHE = new Set(['anruf', 'mail', 'linkedin', 'gespraech', 'termin', 'whatsapp']);

/**
 * Was in der Woche [von, bis] wirklich passiert ist — je Person und fürs Team (dieselben Zählregeln wie das Scoreboard; System-Einträge
 * zählen nie). Gespräche `echtesGespraech`, neue Leads = von Hand angelegte Personen, Angebote = Deals, die die Stufe „Angebot“ erreichten,
 * Deals = neu angelegt, Power Hours = Sitzungen, Reaktivieren = Ansprache nach ≥ 90 Tagen Stille, Events = Gäste „da“ auf Events der Woche.
 */
export function wochenIst(kontakte: readonly (Pick<Kontakt, 'id' | 'importiertAm' | 'aktivitaeten' | 'besitzer'> & { quelle?: string })[], crm: Pick<CrmBestand, 'chancen' | 'sitzungen' | 'teilnahmen' | 'events'>, von: string, bis: string): { team: WochenZahlen; je: Record<string, WochenZahlen> } {
  const team = leer();
  const je: Record<string, WochenZahlen> = {};
  const plus = (art: ChallengeArt, wer: string | undefined) => { team[art]++; if (wer && wer !== 'system') (je[wer] ??= leer())[art]++; };
  const drin = (d: string) => d >= von && d <= bis;
  for (const k of kontakte) {
    const akt = (k.aktivitaeten ?? []).filter(a => a.von !== 'system' && (a.art as string) !== 'system').map(a => ({ ...a, tag: tagVon(a.am) })).sort((a, b) => a.tag.localeCompare(b.tag));
    for (const a of akt) if (drin(a.tag) && echtesGespraech(a)) plus('gespraeche', a.von);
    const angelegt = (k.importiertAm ?? '').slice(0, 10);
    const neu = neuerLeadAm(k);
    if (neu && drin(neu)) plus('leads', k.besitzer ?? akt[0]?.von);
    const erste = akt.find(a => drin(a.tag) && ANSPRACHE.has(a.art));
    if (erste) {
      const vorher = akt.filter(a => a.tag < von).pop()?.tag ?? (/^\d{4}-\d{2}-\d{2}$/.test(angelegt) && angelegt < von ? angelegt : null);
      if (vorher && tage(vorher, erste.tag) >= RUHEND_TAGE) plus('reaktivieren', erste.von);
    }
  }
  for (const c of crm.chancen) {
    if (drin(tagVon(c.angelegt))) plus('deals', c.besitzer || c.historie[0]?.von);
    const ang = c.historie.find(h => h.stufe === 'angebot' && drin(tagVon(h.am)));
    if (ang) plus('angebote', ang.von);
  }
  for (const s of crm.sitzungen ?? []) if (drin(s.datum)) plus('powerhours', s.person);
  const events = new Map((crm.events ?? []).map(e => [e.id, e]));
  for (const t of crm.teilnahmen ?? []) { const e = events.get(t.eventId); if (e && t.status === 'da' && drin(e.datum)) plus('events', t.einladenDurch); }
  return { team, je };
}

export interface ChallengeStand { challenge: Challenge; ist: number; erreicht: boolean; anteil: number; href: string; linkLabel: string }
export function challengeStand(c: Challenge, ist: { team: WochenZahlen; je: Record<string, WochenZahlen> }, kanaele: readonly LeadKanal[]): ChallengeStand {
  const n = c.person === BEIDE ? ist.team[c.art] : ist.je[c.person]?.[c.art] ?? 0;
  const l = challengeLink(c.art, c.kanalId ? kanaele.find(k => k.id === c.kanalId) : undefined);
  return { challenge: c, ist: n, erreicht: n >= c.ziel, anteil: c.ziel > 0 ? Math.min(1, n / c.ziel) : 1, href: l.href, linkLabel: l.label };
}

/** Wohin eine Challenge führt, um Opportunities zu finden — immer eine vorhandene Liste (Power Hour, Qualifizierung, Kadenz, Events …). */
export function challengeLink(art: ChallengeArt, kanal?: Pick<LeadKanal, 'herkunft' | 'bezug'>): { href: string; label: string } {
  switch (art) {
    case 'gespraeche': case 'powerhours': return { href: WEG.powerHour(), label: 'Power Hour' };
    case 'angebote': return { href: WEG.angebot(), label: 'Angebot' };
    case 'deals': return { href: WEG.qualifizierung(), label: 'Qualifizierung' };
    case 'reaktivieren': return { href: WEG.followup('kadenz'), label: 'Ruhende Kontakte (Kadenz)' };
    case 'events': return { href: WEG.besuch(), label: 'Events' };
    case 'leads':
      if (kanal?.herkunft === 'kampagne') return { href: WEG.kampagne(kanal.bezug), label: 'Kampagne' };
      if (kanal?.herkunft === 'eventreihe') return { href: WEG.event(), label: MARKE_EVENTS };
      if (kanal?.herkunft === 'netzwerk') return { href: WEG.netzwerken(), label: 'Netzwerken' };
      if (kanal?.herkunft === 'empfehlung') return { href: WEG.kreisRunde(), label: 'Kreis-Runde' };
      if (kanal?.herkunft === 'inbound') return { href: WEG.marketing('anfragen'), label: 'Anfragen' };
      return { href: WEG.qualifizierung(), label: 'Qualifizierung' };
  }
}

export interface ChallengeVorschlag { art: ChallengeArt; titel: string; ziel: number; person: string; kanalId?: string; grund: string; href: string; linkLabel: string }
/**
 * Bis zu drei Challenges für die Woche aus den Lücken des Plans (Regelwerk, ohne Modell — wie der Grundlauf der Heads): je Kennzahl das
 * Wochenziel gegen das, was letzte Woche passierte; die größte Lücke zuerst. Schon vorhandene Arten dieser Woche fallen weg. Ohne Plan
 * die Startwerte des Scoreboards (Gespräche, Power Hours). Ruhende Kontakte füllen auf, wenn es welche gibt.
 */
export function challengeVorschlaege(e: {
  woche: string; plan: PlanWoche | null; lagen: readonly ZielLage[]; kanaele: readonly LeadKanal[]; vorwoche: WochenZahlen; vorhanden: readonly Challenge[];
  ruhend: number; startwerte: { gespraeche: number; powerhours: number }; team?: readonly Pick<Mitglied, 'id' | 'verantwortet'>[];
}): ChallengeVorschlag[] {
  const team = e.team ?? TEAM;
  const schon = new Set(e.vorhanden.filter(c => c.woche === e.woche).map(c => `${c.art}|${c.kanalId ?? ''}`));
  const kand: (ChallengeVorschlag & { prio: number })[] = [];
  const dazu = (art: ChallengeArt, ziel: number, ist: number, person: string, titel: string, kanal?: LeadKanal) => {
    if (ziel < 1 || schon.has(`${art}|${kanal?.id ?? ''}`)) return;
    const l = challengeLink(art, kanal);
    kand.push({ art, ziel, person, titel, ...(kanal ? { kanalId: kanal.id } : {}), grund: `Wochenziel ${ziel}, letzte Woche ${ist}.`, href: l.href, linkLabel: l.label, prio: (ziel - Math.min(ist, ziel)) / ziel });
  };
  const sales = verantwortlichIn(team, 'sales');
  if (e.plan) {
    dazu('gespraeche', e.plan.gespraeche, e.vorwoche.gespraeche, sales, `${e.plan.gespraeche} echte Gespräche`);
    dazu('angebote', e.plan.angebote, e.vorwoche.angebote, sales, `${e.plan.angebote} ${e.plan.angebote === 1 ? 'Angebot' : 'Angebote'} raus`);
    dazu('deals', e.plan.sql, e.vorwoche.deals, sales, `${e.plan.sql} neue ${e.plan.sql === 1 ? 'Deal' : 'Deals'} (SQL)`);
    // Leads: der Kanal mit dem größten Wochenziel.
    const jeKanal = new Map<string, { leads: number; verantwortlich: string }>();
    for (const l of e.lagen) for (const z of l.kanaele) if (z.imFenster && z.jeWoche) {
      const a = jeKanal.get(z.kanalId) ?? { leads: 0, verantwortlich: z.verantwortlich };
      a.leads += z.jeWoche.leads; jeKanal.set(z.kanalId, a);
    }
    const top = [...jeKanal.entries()].sort((a, b) => b[1].leads - a[1].leads)[0];
    const kanal = top ? e.kanaele.find(k => k.id === top[0]) : undefined;
    if (top && kanal) { const n = Math.max(1, Math.ceil(top[1].leads - 1e-9)); dazu('leads', n, e.vorwoche.leads, top[1].verantwortlich, `${n} neue Leads über „${kanal.name}“`, kanal); }
  } else {
    dazu('gespraeche', e.startwerte.gespraeche, e.vorwoche.gespraeche, sales, `${e.startwerte.gespraeche} echte Gespräche`);
    dazu('powerhours', e.startwerte.powerhours, e.vorwoche.powerhours, sales, `${e.startwerte.powerhours} Power Hours`);
  }
  const auswahl = kand.sort((a, b) => b.prio - a.prio).slice(0, 3);
  if (auswahl.length < 3 && e.ruhend >= 3 && !schon.has('reaktivieren|')) {
    const n = Math.min(5, e.ruhend);
    const l = challengeLink('reaktivieren');
    auswahl.push({ art: 'reaktivieren', ziel: n, person: BEIDE, titel: `${n} ruhende Kontakte reaktivieren`, grund: `${e.ruhend} Kontakte seit über ${RUHEND_TAGE} Tagen ohne Kontakt — dort liegen Projekte und Opportunities.`, href: l.href, linkLabel: l.label, prio: 0 });
  }
  return auswahl.map(({ prio: _p, ...v }) => v);
}

/** Wie viele Kontakte ruhen (letzter Kontakt älter als `RUHEND_TAGE`). */
export const ruhendeKontakte = (kontakte: readonly Pick<Kontakt, 'letzterKontakt'>[], heute: string): number =>
  kontakte.filter(k => !!k.letzterKontakt && /^\d{4}-\d{2}-\d{2}/.test(k.letzterKontakt) && tage(k.letzterKontakt.slice(0, 10), heute) >= RUHEND_TAGE).length;

/** Die Woche (Montag) zu einem Tag und die Woche davor. */
export const wocheVon = (tag: string) => montagVon(tag);
export const vorwocheVon = (tag: string) => tagPlus(montagVon(tag), -7);
