// ─── Markttraktion · Betriebe als vollwertige Ziele (01.11.2026, Welle A „Firmen als Ziel“, KUNDENGEWINNUNG_PLAN.md S1/S2) ──────────────
// Rein (Server UND Browser). Ein Betrieb (Restaurant, Laden, Handwerk …) ist eine Firma der Kartei, oft OHNE Ansprechpartner. Damit er sauber
// geführt werden kann, trägt die Firma optional:
//   · Ort: `adresse` {strasse, hausnummer, plz, ort}, `bezirk`, `osmId` (OpenStreetMap), `oeffnungszeiten`, `mobil` (Handy des Betriebs)
//   · Herkunft je Angabe: `quellen` {feld → http(s)-Adresse} (Art. 14 Abs. 2 lit. f), `anreicherung` {am, quelle}
//   · Bewertung: `bewertung` {punkte 0–100, gruende[], gemessenAm} (Website-Bedarf aus den Homepage-Funden)
//   · Recht wie am Kontakt: `herkunft`, `fremddaten` + `erfasstAm` (Art.-14-Uhr), `art14InformiertAm`, `werbesperre`, `geprueftAm/Von` —
//     diese stempelt NUR der Server (`betriebRechtStempeln` in `wendeCrmAn`, lib/crm/speicher.ts), nie der Browser.
// Kennung und Dubletten (Regel: Betriebe gleichen Namens an verschiedenen Adressen verschmelzen NIE):
//   Schlüssel OSM-ID → Domain → Name + PLZ/Straße (`betriebFinden`, `betriebFirmenId`). Manuelles Anlegen bleibt bei `firmenId(name)`.
// Sperrliste (lib/crm/betrieb-sperre.ts): Merkmale `betriebMerkmale` (OSM-ID, Domain, Name + Adresse) — gehasht, nie Klartext.

import type { Firma } from './typen';
import type { Herkunft } from '@/lib/make-one/crm';
import { HERKUNFT } from '@/lib/make-one/crm';
import { firmenSchluessel, firmenIdMit, FREEMAIL } from './firmen';

export interface FirmaAdresse { strasse?: string; hausnummer?: string; plz?: string; ort?: string }
export interface FirmaBewertung { punkte: number; gruende: string[]; gemessenAm: string }
/** Woher die Angaben des Betriebs stammen: OpenStreetMap, von Hand eingetragen, aus einer Recherche-Datei. */
export type BetriebQuelle = 'osm' | 'hand' | 'datei';
export const BETRIEB_QUELLEN: { id: BetriebQuelle; label: string }[] = [
  { id: 'osm', label: 'OpenStreetMap' }, { id: 'hand', label: 'Von Hand' }, { id: 'datei', label: 'Recherche-Datei' },
];
export interface FirmaAnreicherung { am: string; quelle: BetriebQuelle }

export const QUELLEN_MAX = 12;
export const GRUENDE_MAX = 8;
const OSM_ID = /^[nwr]\d{1,15}$/;
const tagOk = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const t = (v: unknown, n: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n) : '');

// ── Säubern (vom Säuberer `firma()` in lib/crm/speicher.ts genutzt) ─────────────────────────────────────────────────────────────

export function adresseSaeubern(roh: unknown): FirmaAdresse | undefined {
  const o = roh && typeof roh === 'object' ? roh as Record<string, unknown> : null;
  if (!o) return undefined;
  const a: FirmaAdresse = {};
  const strasse = t(o.strasse, 120), hnr = t(o.hausnummer, 20), plz = t(o.plz, 10), ort = t(o.ort, 80);
  if (strasse) a.strasse = strasse;
  if (hnr) a.hausnummer = hnr;
  if (/^[0-9A-Za-z -]{3,10}$/.test(plz)) a.plz = plz;
  if (ort) a.ort = ort;
  return Object.keys(a).length ? a : undefined;
}

export function quellenSaeubern(roh: unknown): Record<string, string> | undefined {
  const o = roh && typeof roh === 'object' && !Array.isArray(roh) ? roh as Record<string, unknown> : null;
  if (!o) return undefined;
  const l = Object.entries(o).filter(([k, v]) => /^[a-z]{2,20}$/i.test(k) && typeof v === 'string' && /^https?:\/\/[^\s<>"]{4,300}$/.test(v)).slice(0, QUELLEN_MAX);
  return l.length ? Object.fromEntries(l) as Record<string, string> : undefined;
}

export function bewertungSaeubern(roh: unknown): FirmaBewertung | undefined {
  const o = roh && typeof roh === 'object' ? roh as Record<string, unknown> : null;
  if (!o || typeof o.punkte !== 'number' || !Number.isFinite(o.punkte)) return undefined;
  const gruende = Array.isArray(o.gruende) ? o.gruende.map(x => t(x, 200)).filter(Boolean).slice(0, GRUENDE_MAX) : [];
  const am = typeof o.gemessenAm === 'string' && !Number.isNaN(Date.parse(o.gemessenAm)) ? o.gemessenAm.slice(0, 30) : '';
  return am ? { punkte: Math.round(Math.min(100, Math.max(0, o.punkte))), gruende, gemessenAm: am } : undefined;
}

export function anreicherungSaeubern(roh: unknown): FirmaAnreicherung | undefined {
  const o = roh && typeof roh === 'object' ? roh as Record<string, unknown> : null;
  if (!o || !BETRIEB_QUELLEN.some(q => q.id === o.quelle)) return undefined;
  const am = typeof o.am === 'string' && !Number.isNaN(Date.parse(o.am)) ? o.am.slice(0, 30) : '';
  return am ? { am, quelle: o.quelle as BetriebQuelle } : undefined;
}

export const osmIdSaeubern = (v: unknown) => (typeof v === 'string' && OSM_ID.test(v) ? v : undefined);
export const herkunftSaeubern = (v: unknown): Herkunft | undefined => (HERKUNFT.some(h => h.id === v) ? v as Herkunft : undefined);
export const werbesperreSaeubern = (v: unknown): { seit: string; grund: string } | undefined => {
  const o = v && typeof v === 'object' ? v as Record<string, unknown> : null;
  return o && tagOk(o.seit) ? { seit: o.seit, grund: t(o.grund, 200) || 'Werbewiderspruch (Art. 21)' } : undefined;
};
/** Die Recht-Felder in ihrer Form (Inhalt und Zeitpunkt entscheidet `betriebRechtStempeln`). */
export function betriebRechtSaeubern(o: Record<string, unknown>): Partial<Pick<Firma, 'herkunft' | 'fremddaten' | 'erfasstAm' | 'art14InformiertAm' | 'werbesperre' | 'geprueftAm' | 'geprueftVon'>> {
  const h = herkunftSaeubern(o.herkunft), w = werbesperreSaeubern(o.werbesperre);
  return {
    ...(h ? { herkunft: h } : {}), ...(o.fremddaten === true ? { fremddaten: true } : {}), ...(tagOk(o.erfasstAm) ? { erfasstAm: o.erfasstAm } : {}),
    ...(tagOk(o.art14InformiertAm) ? { art14InformiertAm: o.art14InformiertAm } : {}), ...(w ? { werbesperre: w } : {}),
    ...(tagOk(o.geprueftAm) ? { geprueftAm: o.geprueftAm, ...(t(o.geprueftVon, 40) ? { geprueftVon: t(o.geprueftVon, 40) } : {}) } : {}),
  };
}

const herkunftIstFremd = (h: Herkunft | undefined) => !!h && (HERKUNFT.find(x => x.id === h)?.fremd ?? true);

/**
 * Recht an der Firma — NUR der Server stempelt (wie `datenschutzStempeln` am Kontakt). `neu` ist das gesäuberte Ergebnis einer
 * Browser-Änderung, `alt` der gespeicherte Stand:
 *   herkunft             gesetzt wie geschickt (sonst der gespeicherte); fremd → `fremddaten` + `erfasstAm` (Start der Art.-14-Uhr, bleibt)
 *   art14InformiertAm    nur setzen (ein Tag ≤ heute), nie entfernen
 *   werbesperre          setzen ja (seit = heute), entfernen über diesen Weg nie (Art. 21 bleibt)
 *   geprueftAm/Von       geändert → heute + Person; sonst der gespeicherte Wert
 */
export function betriebRechtStempeln(neu: Firma, alt: Firma | undefined, person: string, heute: string): Firma {
  const { herkunft: _h, fremddaten: _f, erfasstAm: _e, art14InformiertAm: _a, werbesperre: _w, geprueftAm: _g, geprueftVon: _gv, ...rest } = neu;
  const out: Firma = { ...rest };
  const herkunft = neu.herkunft ?? alt?.herkunft;
  if (herkunft) out.herkunft = herkunft;
  if (alt?.fremddaten || herkunftIstFremd(herkunft)) { out.fremddaten = true; out.erfasstAm = alt?.erfasstAm ?? heute; }
  else if (alt?.erfasstAm) out.erfasstAm = alt.erfasstAm;
  const a14 = alt?.art14InformiertAm ?? (neu.art14InformiertAm && neu.art14InformiertAm <= heute ? neu.art14InformiertAm : undefined);
  if (a14) out.art14InformiertAm = a14;
  if (alt?.werbesperre) out.werbesperre = alt.werbesperre;
  else if (neu.werbesperre) out.werbesperre = { seit: heute, grund: neu.werbesperre.grund };
  if (neu.geprueftAm && neu.geprueftAm !== alt?.geprueftAm) { out.geprueftAm = heute; out.geprueftVon = person; }
  else if (alt?.geprueftAm) { out.geprueftAm = alt.geprueftAm; if (alt.geprueftVon) out.geprueftVon = alt.geprueftVon; }
  return out;
}

/** Art.-14-Uhr an der Firma (wie `art14` am Kontakt): Fremddaten ohne Information — ab Tag 25 fällig (Frist ein Monat). */
export function art14Firma(f: Pick<Firma, 'fremddaten' | 'art14InformiertAm' | 'erfasstAm'>, heute: string): { tage: number; faellig: boolean } | null {
  if (!f.fremddaten || f.art14InformiertAm) return null;
  const seit = Math.round((Date.parse(`${heute}T12:00:00Z`) - Date.parse(`${(f.erfasstAm || heute).slice(0, 10)}T12:00:00Z`)) / 864e5);
  return { tage: seit, faellig: seit >= 25 };
}

// ── Merkmale, Schlüssel, Dubletten ────────────────────────────────────────────────────────────────────────────────────────

/** Plattformen, die viele Betriebe teilen — ihre Domain ist kein Merkmal eines Betriebs. */
const GETEILTE_DOMAINS = /(^|\.)(facebook\.com|fb\.com|instagram\.com|linktr\.ee|google\.[a-z.]+|goo\.gl|business\.site|lieferando\.de|wolt\.com|ubereats\.com|tripadvisor\.[a-z.]+|yelp\.[a-z.]+|treatwell\.de|booksy\.com|speisekarte\.de|opentable\.[a-z.]+|quandoo\.[a-z.]+|thefork\.[a-z.]+|booking\.com|gelbeseiten\.de|dasoertliche\.de)$/i;

/** Eigene Domain des Betriebs (Webseite, sonst Domain-Feld, sonst Mail) — nie eine geteilte Plattform oder ein Freemailer. */
export function betriebDomain(f: Pick<Firma, 'domain' | 'webseite' | 'email'>): string | undefined {
  const host = (u?: string) => (u ?? '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#:]/)[0];
  for (const d of [host(f.webseite), host(f.domain), (f.email ?? '').toLowerCase().split('@')[1] ?? '']) {
    if (d && d.includes('.') && !FREEMAIL.has(d) && !GETEILTE_DOMAINS.test(d)) return d;
  }
  return undefined;
}

const normStrasse = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/strasse\b|str\.?(?=\s|$|\d)/g, 'str').replace(/[^a-z0-9]/g, '');
/** Adresse als Schlüssel: PLZ + Straße + Hausnummer (normiert) — leer, wenn weder PLZ noch Straße bekannt sind. */
export function adresseSchluessel(a: FirmaAdresse | undefined): string {
  if (!a) return '';
  const strasse = normStrasse(`${a.strasse ?? ''}${a.hausnummer ?? ''}`);
  const plz = (a.plz ?? '').replace(/\s/g, '');
  return plz || strasse ? `${plz}|${strasse}` : '';
}

export type BetriebKandidat = Pick<Firma, 'name'> & Partial<Pick<Firma, 'osmId' | 'adresse' | 'domain' | 'webseite' | 'email'>>;

/** Merkmale für die Sperrliste (Klartext nur hier im Speicher, gehasht wird in lib/crm/betrieb-sperre.ts). */
export function betriebMerkmale(f: BetriebKandidat): string[] {
  const l: string[] = [];
  if (f.osmId && OSM_ID.test(f.osmId)) l.push(`o:${f.osmId}`);
  const d = betriebDomain(f);
  if (d) l.push(`d:${d}`);
  const s = firmenSchluessel(f.name), a = adresseSchluessel(f.adresse);
  if (s && a) l.push(`b:${s}|${a}`);
  return l;
}

/**
 * Derselbe Betrieb? `ja` (OSM-ID gleich; Domain gleich ohne widersprechende Orte; Name + Adresse gleich; Name gleich und beide ohne Ort),
 * `nein` (verschiedene OSM-IDs bzw. verschiedene Adressen — NIE verschmelzen), `vielleicht` (Name gleich, nur einer kennt die Adresse).
 */
export function gleicherBetrieb(a: BetriebKandidat, b: BetriebKandidat): 'ja' | 'nein' | 'vielleicht' {
  if (a.osmId && b.osmId) return a.osmId === b.osmId ? 'ja' : 'nein';
  const aa = adresseSchluessel(a.adresse), ab = adresseSchluessel(b.adresse);
  if (aa && ab && aa !== ab) return 'nein';
  const da = betriebDomain(a), db = betriebDomain(b);
  if (da && db && da === db) return 'ja';
  const sa = firmenSchluessel(a.name), sb = firmenSchluessel(b.name);
  if (!sa || sa !== sb) return 'nein';
  if (aa && ab) return 'ja';
  return !aa && !ab && !a.osmId && !b.osmId ? 'ja' : 'vielleicht';
}

/** Den Betrieb in der Kartei finden (nur `ja`) — Papierkorb zählt mit (der Upsert holt ihn sonst zurück). */
export function betriebFinden<F extends BetriebKandidat & { id: string }>(firmen: readonly F[], k: BetriebKandidat): F | undefined {
  return firmen.find(f => !!k.osmId && f.osmId === k.osmId) ?? firmen.find(f => gleicherBetrieb(f, k) === 'ja');
}

/**
 * Feste Kennung eines importierten Betriebs: Name + Unterscheider (OSM-ID, sonst Adresse, sonst Domain) — zwei „Café Rosa“ an zwei Adressen
 * bekommen zwei Kennungen, derselbe Betrieb beim zweiten Import dieselbe. Ohne Unterscheider die Kennung aus dem Namen (`firmenId`).
 */
export function betriebFirmenId(k: BetriebKandidat): string {
  const unter = k.osmId ? `osm:${k.osmId}` : adresseSchluessel(k.adresse) ? `adr:${adresseSchluessel(k.adresse)}` : betriebDomain(k) ? `dom:${betriebDomain(k)}` : '';
  return firmenIdMit(k.name, unter);
}

/** Adresse in einer Zeile (Anzeige, Export). */
export function adresseText(a: FirmaAdresse | undefined): string {
  if (!a) return '';
  const strasse = [a.strasse, a.hausnummer].filter(Boolean).join(' ');
  const ort = [a.plz, a.ort].filter(Boolean).join(' ');
  return [strasse, ort].filter(Boolean).join(', ');
}

/** Erreichbarkeit eines Betriebs (für Segmente): Handy, Festnetz, Mail. */
export type Erreichbarkeit = 'handy' | 'festnetz' | 'mail';
export const ERREICHBARKEITEN: { id: Erreichbarkeit; label: string }[] = [{ id: 'handy', label: 'Handy' }, { id: 'festnetz', label: 'Festnetz' }, { id: 'mail', label: 'Mail' }];
const istHandy = (n?: string) => /^\+491[567]\d/.test((n ?? '').replace(/[\s/()-]/g, '')) || /^01[567]\d/.test((n ?? '').replace(/[\s/()-]/g, ''));
export function erreichbarkeitVon(x: { telefon?: string; mobil?: string; sms?: string; email?: string }): Erreichbarkeit[] {
  const l: Erreichbarkeit[] = [];
  if ((x.mobil ?? '').trim() || (x.sms ?? '').trim() || istHandy(x.telefon)) l.push('handy');
  if ((x.telefon ?? '').trim() && !istHandy(x.telefon)) l.push('festnetz');
  if ((x.email ?? '').trim()) l.push('mail');
  return l;
}

// ── Angaben aus den Homepage-Funden, die an der Firma bleiben (01.11.) ─────────────────────────────────────────────────────

/** Niveau-Analyse der Website (lib/funde/analyse.ts) — schlank an der Firma: Niveau, Teile, Design, Lücken, Aufhänger. */
export interface FirmaAnalyse {
  niveau: number;
  teile?: { technik: number; gaeste: number; auffindbar: number; recht: number };
  design?: number;
  luecken: string[];
  aufhaenger: string[];
  /** Unter unserem Niveau (gerechnet beim Fund, `unterNiveau`). */
  unterNiveau?: boolean;
  gemessenAm: string;
}
const zahl100 = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(Math.min(100, Math.max(0, v))) : undefined);
export function analyseSaeubern(roh: unknown): FirmaAnalyse | undefined {
  const o = roh && typeof roh === 'object' ? roh as Record<string, unknown> : null;
  const niveau = zahl100(o?.niveau);
  if (!o || niveau === undefined) return undefined;
  const am = typeof o.gemessenAm === 'string' && !Number.isNaN(Date.parse(o.gemessenAm)) ? o.gemessenAm.slice(0, 30) : '';
  if (!am) return undefined;
  const liste = (v: unknown) => (Array.isArray(v) ? v.map(x => t(x, 240)).filter(Boolean).slice(0, 10) : []);
  const tl = o.teile && typeof o.teile === 'object' ? o.teile as Record<string, unknown> : null;
  const teile = tl && ['technik', 'gaeste', 'auffindbar', 'recht'].every(k => zahl100(tl[k]) !== undefined)
    ? { technik: zahl100(tl.technik)!, gaeste: zahl100(tl.gaeste)!, auffindbar: zahl100(tl.auffindbar)!, recht: zahl100(tl.recht)! } : undefined;
  const design = typeof o.design === 'number' && Number.isFinite(o.design) ? Math.round(Math.min(5, Math.max(0, o.design))) : undefined;
  return { niveau, ...(teile ? { teile } : {}), ...(design !== undefined ? { design } : {}), luecken: liste(o.luecken), aufhaenger: liste(o.aufhaenger), ...(o.unterNiveau === true ? { unterNiveau: true } : {}), gemessenAm: am };
}
export const instagramSaeubern = (v: unknown) => { const s = typeof v === 'string' ? v.trim().replace(/^@/, '') : ''; return /^[A-Za-z0-9_.]{2,30}$/.test(s) ? s : undefined; };
/** Inhaber/Betreiber (Anbieterkennzeichnung) — bei Einzelunternehmen ein Personenname: Art. 15/17 über lib/crm/person-verweise.ts. */
export const inhaberSaeubern = (v: unknown) => { const s = t(v, 120); return s && !/[0-9(){}[\]@]/.test(s) ? s : undefined; };
/** Stammt der Inhaber aus einer Anbieterkennzeichnung (Impressum) — nicht aus dem OSM-Feld `operator`, nicht ohne Quelle? */
export const inhaberAusImpressum = (f: { inhaber?: string; inhaberArt?: string; quellen?: Record<string, string> }) =>
  !!f.inhaber && f.inhaberArt === 'person' && !!f.quellen?.inhaber && !/openstreetmap\.org/i.test(f.quellen.inhaber);
