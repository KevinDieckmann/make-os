// ─── Markttraktion · ICP-Bewertung und Steckbrief an der Firma (31.10.2026, Profile Start-ups · Unternehmer · Scale-ups, lib/funde/icp.ts) ─────
// Rein (Server UND Browser). Kevin: „Unsere Datenbasis muss perfekt sein, dann können wir das immer mit den Marktdaten und Studien abgleichen und
// unsere Ansprache verbessern.“ Darum liegen Passung und Steckbrief STRUKTURIERT an der Firma (nicht nur als Notiz) — auswertbar je Segment.
// Inhalt nur aus öffentlichen Quellen (Website, Impressum, Team-/Karriere-/Blog-Seite, Förder-/Portfolio-Listen), je Feld mit Quelle in `Firma.quellen`.
// Rollen statt Personen: „Vertriebsleitung ja/nein“ und die Rollen-Bezeichnung — nie Namen von Mitarbeitenden (Art. 5 Abs. 1 lit. c DSGVO).
// Soziale Profile nur als Link; Beiträge nur von der eigenen Website der Firma (LinkedIn/Instagram zeigen sie nur angemeldet — kein Auslesen).

import { VERTRIEBSLEITUNG_TEXT, SEGMENT_TEXT, type VertriebsleitungStatus, type LageSegment } from '@/lib/funde/lage';

export type IcpZielgruppeFirma = 'startup' | 'unternehmer' | 'scaleup';
export interface FirmaIcp {
  score: number;
  stufe: 'A' | 'B' | 'C';
  zielgruppe: IcpZielgruppeFirma;
  einstieg: 'vertrieb' | 'sichtbarkeit' | 'struktur';
  /** Lead-Score für die Ansprache 0–100 (Passung, Erreichbarkeit, Geschäftsführung, fehlende Vertriebsleitung). */
  prioritaet?: number;
  gruende: string[];
  aufhaenger: string[];
  gemessenAm: string;
}
export interface FirmaBeitrag { titel: string; datum?: string; url: string }
/** Ansprechpartner laut eigener Team-/Über-uns-Seite bzw. Strukturdaten (Gründer, CEO) — nur, wenn die Firma ihn selbst veröffentlicht; Quelle Pflicht. */
export interface FirmaAnsprechpartner { name: string; rolle: string; quelle: string }
/** Erkannte Werkzeuge auf der eigenen Website (Skripte/Einbindungen) — Hinweis auf Reife im Vertrieb/Marketing, nie mehr. */
export const TECHNIK = ['HubSpot', 'Salesforce', 'Pardot', 'Pipedrive', 'Zoho', 'Microsoft Dynamics', 'Close', 'Freshworks', 'ActiveCampaign', 'Brevo', 'Mailchimp', 'Klaviyo', 'Intercom', 'Drift', 'Zendesk', 'Calendly', 'Chili Piper', 'Leadinfo', 'Dealfront', 'LinkedIn Insight', 'Google Ads', 'Meta Pixel', 'Webflow', 'WordPress', 'Shopify', 'Personio', 'Join', 'Greenhouse', 'Lever', 'Recruitee', 'Softgarden', 'Workable'] as const;
/** Branchen-Schlagwort (eine Stelle: `branchenTag` in lib/funde/icp.ts) — für Auswertung je Segment und Abgleich mit Studien. */
export const BRANCHEN_TAGS = ['KI & Daten', 'SaaS & Software', 'FinTech & InsurTech', 'HealthTech & Medizintechnik', 'Energie & Klima', 'Industrie & IoT', 'Mobilität & Logistik', 'Food & Ernährung', 'PropTech & Bau', 'HR & Arbeit', 'Security', 'Bildung', 'Handel & E-Commerce', 'Sport & Freizeit', 'Sonstiges'] as const;
/** EU-Forschungsprojekte laut CORDIS (offene Daten der EU-Kommission, Horizon 2020 + Horizon Europe): Zahlen und höchstens 3 Projekttitel. */
export interface FirmaEuProjekte { anzahl: number; foerderung: number; laufend: number; koordinator: number; titel: string[] }
/** Wie die Website verkauft (aus Knöpfen/Links der eigenen Website erkannt) — Hinweis für die Ansprache, nie mehr. */
export const VERTRIEBSWEGE = ['Demo/Termin', 'Self-Service/Preise', 'Angebotsanfrage'] as const;
/** Zertifikate/Siegel, die die Website selbst nennt. */
export const ZERTIFIKATE = ['ISO 27001', 'TISAX', 'ISO 9001', 'ISO 13485', 'ISO 14001', 'SOC 2', 'BSI C5', 'DSGVO-konform', 'Made in Germany', 'CE/MDR'] as const;
export const BUNDESLAENDER = ['Baden-Württemberg', 'Bayern', 'Berlin', 'Brandenburg', 'Bremen', 'Hamburg', 'Hessen', 'Mecklenburg-Vorpommern', 'Niedersachsen', 'Nordrhein-Westfalen', 'Rheinland-Pfalz', 'Saarland', 'Sachsen', 'Sachsen-Anhalt', 'Schleswig-Holstein', 'Thüringen'] as const;
export interface FirmaProfile { linkedin?: string; instagram?: string; x?: string; youtube?: string; xing?: string; tiktok?: string; facebook?: string }
export interface FirmaSteckbrief {
  /** Vertriebsleitung auf der Website: ja · nein (Team-Seite gelesen, keine) · unbekannt. */
  vertriebsleitung?: 'ja' | 'nein' | 'unbekannt';
  /** Rollen-Bezeichnung, wie sie auf der Website steht (z. B. „Head of Sales“) — nie ein Name. */
  vertriebsleitungRolle?: string;
  mitarbeitende?: number;
  stellen?: number;
  stellenVertrieb?: number;
  gruendungsjahr?: number;
  /** Handelsregister laut Impressum, z. B. „HRB 12345 B, Amtsgericht Charlottenburg“. */
  register?: string;
  /** Finanzierung/Auszeichnung laut Quelle (z. B. „Series A, 12 Mio. € (03/2026)“). */
  signal?: string;
  profile?: FirmaProfile;
  /** Letzte Beiträge auf Blog/News der eigenen Website (höchstens 5). */
  beitraege?: FirmaBeitrag[];
  /** Partner, Integrationen, Investoren — Firmennamen, wie sie auf der Website stehen (höchstens 20). */
  partner?: string[];
  /** Anzahl gezeigter Referenzkunden/Logos (grob). */
  referenzen?: number;
  branche?: (typeof BRANCHEN_TAGS)[number];
  technik?: string[];
  /** Offene Vertriebsstellen (Titel, wie ausgeschrieben, höchstens 5). */
  stellenTitel?: string[];
  ansprechpartner?: FirmaAnsprechpartner[];
  /** Mail-Domain nimmt Post an (MX-Eintrag vorhanden) — geprüft am `gemessenAm`. */
  mailZustellbar?: boolean;
  /** Pressemeldungen über die Firma (Titel, Datum, Link; höchstens 5, letzte 12 Monate). */
  presse?: FirmaBeitrag[];
  /** EU-Forschungsprojekte (CORDIS). */
  euProjekte?: FirmaEuProjekte;
  vertriebsweg?: (typeof VERTRIEBSWEGE)[number][];
  /** Fallstudien, Referenzen oder Kundenstimmen auf der Website. */
  belege?: boolean;
  newsletter?: boolean;
  webinare?: boolean;
  zertifikate?: (typeof ZERTIFIKATE)[number][];
  /** Messen, die die Website nennt (höchstens 10). */
  messen?: string[];
  /** Sprachen der Website (ISO-Kürzel, z. B. de, en). */
  sprachen?: string[];
  /** Mehr als zwei Sprachen oder „weltweit/international tätig“ auf der Website. */
  international?: boolean;
  /** Aus der PLZ der Anschrift (Impressum) abgeleitet. */
  bundesland?: (typeof BUNDESLAENDER)[number];
  /** Mutterfirma bzw. Eigentümer laut Wikidata (Hinweis auf Konzernzugehörigkeit) und der Wikidata-Eintrag. */
  mutter?: string;
  wikidata?: string;
  /** Lage je Firma (lib/funde/lage.ts): Vertriebsleitung mit Beleg, Bedarf und Potenzial 0–100, Segment, Satz. */
  lage?: FirmaLage;
  /** Website-Reichweite: Rang in der offenen Tranco-Liste, erste Archivierung (Internet Archive), Versionen der Startseite in 12 Monaten. */
  reichweite?: { tranco?: number; archivSeit?: number; versionen12?: number };
  gemessenAm: string;
}

export interface FirmaLage {
  vertriebsleitung: VertriebsleitungStatus;
  beleg?: { text: string; url?: string };
  bedarf: number;
  potenzial: number;
  segment: LageSegment;
  satz: string;
}

export const BEITRAEGE_MAX = 5;
export const PARTNER_MAX = 20;
const t = (v: unknown, n: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n) : '');
const url = (v: unknown) => (typeof v === 'string' && /^https?:\/\/[^\s<>"]{4,300}$/.test(v.trim()) ? v.trim() : undefined);
const ganz = (v: unknown, max: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(Math.min(max, v)) : undefined);
const tag = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}(-\d{2})?$/.test(v) ? v : undefined);
const amOk = (v: unknown) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v.slice(0, 30) : '');

export function firmaIcpSaeubern(roh: unknown): FirmaIcp | undefined {
  const o = roh && typeof roh === 'object' ? roh as Record<string, unknown> : null;
  const score = ganz(o?.score, 100), am = amOk(o?.gemessenAm);
  if (!o || score === undefined || !am) return undefined;
  const liste = (v: unknown, n: number) => (Array.isArray(v) ? v.map(x => t(x, 240)).filter(Boolean).slice(0, n) : []);
  const prioritaet = ganz(o.prioritaet, 100);
  return {
    score, stufe: score >= 70 ? 'A' : score >= 50 ? 'B' : 'C',
    zielgruppe: o.zielgruppe === 'scaleup' ? 'scaleup' : o.zielgruppe === 'unternehmer' ? 'unternehmer' : 'startup',
    einstieg: o.einstieg === 'sichtbarkeit' ? 'sichtbarkeit' : o.einstieg === 'struktur' ? 'struktur' : 'vertrieb',
    ...(prioritaet !== undefined ? { prioritaet } : {}), gruende: liste(o.gruende, 12), aufhaenger: liste(o.aufhaenger, 3), gemessenAm: am,
  };
}

const PROFIL_HOSTS: Record<keyof FirmaProfile, RegExp> = {
  linkedin: /^https:\/\/([a-z]{2,3}\.)?linkedin\.com\/(company|showcase|school)\//i, instagram: /^https:\/\/(www\.)?instagram\.com\//i,
  x: /^https:\/\/(www\.)?(x|twitter)\.com\//i, youtube: /^https:\/\/(www\.)?youtube\.com\//i, xing: /^https:\/\/(www\.)?xing\.com\/pages\//i,
  tiktok: /^https:\/\/(www\.)?tiktok\.com\/@/i, facebook: /^https:\/\/(www\.|de-de\.)?facebook\.com\//i,
};
export function profileSaeubern(roh: unknown): FirmaProfile | undefined {
  const o = roh && typeof roh === 'object' ? roh as Record<string, unknown> : null;
  if (!o) return undefined;
  const p: FirmaProfile = {};
  for (const k of Object.keys(PROFIL_HOSTS) as (keyof FirmaProfile)[]) { const u = url(o[k]); if (u && PROFIL_HOSTS[k].test(u)) p[k] = u; }
  return Object.keys(p).length ? p : undefined;
}

export function steckbriefSaeubern(roh: unknown): FirmaSteckbrief | undefined {
  const o = roh && typeof roh === 'object' ? roh as Record<string, unknown> : null;
  const am = amOk(o?.gemessenAm);
  if (!o || !am) return undefined;
  const vl = o.vertriebsleitung === 'ja' || o.vertriebsleitung === 'nein' ? o.vertriebsleitung : o.vertriebsleitung === 'unbekannt' ? 'unbekannt' : undefined;
  const beitraege = Array.isArray(o.beitraege) ? o.beitraege.map(b => {
    const x = b && typeof b === 'object' ? b as Record<string, unknown> : {};
    const titel = t(x.titel, 200), u = url(x.url), d = tag(x.datum);
    return titel && u ? { titel, url: u, ...(d ? { datum: d } : {}) } : null;
  }).filter((b): b is FirmaBeitrag => !!b).slice(0, BEITRAEGE_MAX) : [];
  const partner = Array.isArray(o.partner) ? Array.from(new Set(o.partner.map(x => t(x, 80)).filter(Boolean))).slice(0, PARTNER_MAX) : [];
  const profile = profileSaeubern(o.profile);
  const technik = Array.isArray(o.technik) ? Array.from(new Set(o.technik.filter((x): x is string => typeof x === 'string' && (TECHNIK as readonly string[]).includes(x)))) : [];
  const stellenTitel = Array.isArray(o.stellenTitel) ? o.stellenTitel.map(x => t(x, 120)).filter(Boolean).slice(0, 5) : [];
  const ansprechpartner = Array.isArray(o.ansprechpartner) ? o.ansprechpartner.map(a => {
    const x = a && typeof a === 'object' ? a as Record<string, unknown> : {};
    const name = t(x.name, 80), rolle = t(x.rolle, 80), q = url(x.quelle);
    return name && rolle && q && !/[0-9@()]/.test(name) ? { name, rolle, quelle: q } : null;
  }).filter((a): a is FirmaAnsprechpartner => !!a).slice(0, 3) : [];
  const presse = Array.isArray(o.presse) ? o.presse.map(b => {
    const x = b && typeof b === 'object' ? b as Record<string, unknown> : {};
    const titel = t(x.titel, 200), u = url(x.url), d = tag(x.datum);
    return titel && u ? { titel, url: u, ...(d ? { datum: d } : {}) } : null;
  }).filter((b): b is FirmaBeitrag => !!b).slice(0, BEITRAEGE_MAX) : [];
  const eu = o.euProjekte && typeof o.euProjekte === 'object' ? o.euProjekte as Record<string, unknown> : null;
  const euAnzahl = eu ? ganz(eu.anzahl, 1000) : undefined;
  const euProjekte: FirmaEuProjekte | undefined = eu && euAnzahl ? {
    anzahl: euAnzahl, foerderung: ganz(eu.foerderung, 1e10) ?? 0, laufend: Math.min(euAnzahl, ganz(eu.laufend, 1000) ?? 0), koordinator: Math.min(euAnzahl, ganz(eu.koordinator, 1000) ?? 0),
    titel: Array.isArray(eu.titel) ? eu.titel.map(x => t(x, 200)).filter(Boolean).slice(0, 3) : [],
  } : undefined;
  const ausListe = <T extends string>(v: unknown, erlaubt: readonly T[]) => (Array.isArray(v) ? Array.from(new Set(v.filter((x): x is T => typeof x === 'string' && (erlaubt as readonly string[]).includes(x)))) : []);
  const vertriebsweg = ausListe(o.vertriebsweg, VERTRIEBSWEGE), zertifikate = ausListe(o.zertifikate, ZERTIFIKATE);
  const messen = Array.isArray(o.messen) ? Array.from(new Set(o.messen.map(x => t(x, 60)).filter(Boolean))).slice(0, 10) : [];
  const sprachen = Array.isArray(o.sprachen) ? Array.from(new Set(o.sprachen.filter((x): x is string => typeof x === 'string' && /^[a-z]{2}$/.test(x)))).slice(0, 8) : [];
  const bundesland = (BUNDESLAENDER as readonly string[]).includes(String(o.bundesland)) ? o.bundesland as FirmaSteckbrief['bundesland'] : undefined;
  const wikidata = url(o.wikidata) && /^https:\/\/www\.wikidata\.org\/wiki\/Q\d+$/.test(String(o.wikidata)) ? String(o.wikidata) : undefined;
  const ja = (v: unknown) => (typeof v === 'boolean' ? v : undefined);
  const la = o.lage && typeof o.lage === 'object' ? o.lage as Record<string, unknown> : null;
  const lb = la?.beleg && typeof la.beleg === 'object' ? la.beleg as Record<string, unknown> : null;
  const lage: FirmaLage | undefined = la && String(la.vertriebsleitung) in VERTRIEBSLEITUNG_TEXT && String(la.segment) in SEGMENT_TEXT && t(la.satz, 300) ? {
    vertriebsleitung: la.vertriebsleitung as VertriebsleitungStatus, ...(lb && t(lb.text, 240) ? { beleg: { text: t(lb.text, 240), ...(url(lb.url) ? { url: url(lb.url) } : {}) } } : {}),
    bedarf: ganz(la.bedarf, 100) ?? 0, potenzial: ganz(la.potenzial, 100) ?? 0, segment: la.segment as LageSegment, satz: t(la.satz, 300),
  } : undefined;
  const rw = o.reichweite && typeof o.reichweite === 'object' ? o.reichweite as Record<string, unknown> : null;
  const reichweite = rw ? Object.fromEntries(Object.entries({ tranco: ganz(rw.tranco, 1e6), archivSeit: ganz(rw.archivSeit, 2100), versionen12: ganz(rw.versionen12, 10000) }).filter(([k, v]) => v !== undefined && (k !== 'tranco' || v > 0) && (k !== 'archivSeit' || v >= 1995))) : {};
  const zusatz = {
    ...(lage ? { lage } : {}), ...(Object.keys(reichweite).length ? { reichweite } : {}),
    ...(euProjekte ? { euProjekte } : {}), ...(vertriebsweg.length ? { vertriebsweg } : {}), ...(ja(o.belege) !== undefined ? { belege: ja(o.belege) } : {}),
    ...(ja(o.newsletter) !== undefined ? { newsletter: ja(o.newsletter) } : {}), ...(ja(o.webinare) !== undefined ? { webinare: ja(o.webinare) } : {}),
    ...(zertifikate.length ? { zertifikate } : {}), ...(messen.length ? { messen } : {}), ...(sprachen.length ? { sprachen } : {}),
    ...(ja(o.international) !== undefined ? { international: ja(o.international) } : {}), ...(bundesland ? { bundesland } : {}),
    ...(t(o.mutter, 120) ? { mutter: t(o.mutter, 120) } : {}), ...(wikidata ? { wikidata } : {}),
  };
  const branche = (BRANCHEN_TAGS as readonly string[]).includes(String(o.branche)) ? o.branche as FirmaSteckbrief['branche'] : undefined;
  const jahr = ganz(o.gruendungsjahr, 2100);
  const s: FirmaSteckbrief = {
    ...(vl ? { vertriebsleitung: vl } : {}), ...(t(o.vertriebsleitungRolle, 80) ? { vertriebsleitungRolle: t(o.vertriebsleitungRolle, 80) } : {}),
    ...(ganz(o.mitarbeitende, 1e6) ? { mitarbeitende: ganz(o.mitarbeitende, 1e6) } : {}), ...(ganz(o.stellen, 10000) !== undefined ? { stellen: ganz(o.stellen, 10000) } : {}),
    ...(ganz(o.stellenVertrieb, 10000) !== undefined ? { stellenVertrieb: ganz(o.stellenVertrieb, 10000) } : {}), ...(jahr && jahr >= 1800 ? { gruendungsjahr: jahr } : {}),
    ...(t(o.register, 120) ? { register: t(o.register, 120) } : {}), ...(t(o.signal, 240) ? { signal: t(o.signal, 240) } : {}),
    ...(profile ? { profile } : {}), ...(beitraege.length ? { beitraege } : {}), ...(partner.length ? { partner } : {}),
    ...(ganz(o.referenzen, 10000) !== undefined ? { referenzen: ganz(o.referenzen, 10000) } : {}),
    ...(branche ? { branche } : {}), ...(technik.length ? { technik } : {}), ...(stellenTitel.length ? { stellenTitel } : {}), ...(ansprechpartner.length ? { ansprechpartner } : {}),
    ...(typeof o.mailZustellbar === 'boolean' ? { mailZustellbar: o.mailZustellbar } : {}), ...(presse.length ? { presse } : {}), ...zusatz, gemessenAm: am,
  };
  return Object.keys(s).length > 1 ? s : undefined;
}
