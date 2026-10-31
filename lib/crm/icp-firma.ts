// ─── Markttraktion · ICP-Bewertung und Steckbrief an der Firma (31.10.2026, Profile Start-ups · Unternehmer · Scale-ups, lib/funde/icp.ts) ─────
// Rein (Server UND Browser). Kevin: „Unsere Datenbasis muss perfekt sein, dann können wir das immer mit den Marktdaten und Studien abgleichen und
// unsere Ansprache verbessern.“ Darum liegen Passung und Steckbrief STRUKTURIERT an der Firma (nicht nur als Notiz) — auswertbar je Segment.
// Inhalt nur aus öffentlichen Quellen (Website, Impressum, Team-/Karriere-/Blog-Seite, Förder-/Portfolio-Listen), je Feld mit Quelle in `Firma.quellen`.
// Rollen statt Personen: „Vertriebsleitung ja/nein“ und die Rollen-Bezeichnung — nie Namen von Mitarbeitenden (Art. 5 Abs. 1 lit. c DSGVO).
// Soziale Profile nur als Link; Beiträge nur von der eigenen Website der Firma (LinkedIn/Instagram zeigen sie nur angemeldet — kein Auslesen).

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
  gemessenAm: string;
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
  const jahr = ganz(o.gruendungsjahr, 2100);
  const s: FirmaSteckbrief = {
    ...(vl ? { vertriebsleitung: vl } : {}), ...(t(o.vertriebsleitungRolle, 80) ? { vertriebsleitungRolle: t(o.vertriebsleitungRolle, 80) } : {}),
    ...(ganz(o.mitarbeitende, 1e6) ? { mitarbeitende: ganz(o.mitarbeitende, 1e6) } : {}), ...(ganz(o.stellen, 10000) !== undefined ? { stellen: ganz(o.stellen, 10000) } : {}),
    ...(ganz(o.stellenVertrieb, 10000) !== undefined ? { stellenVertrieb: ganz(o.stellenVertrieb, 10000) } : {}), ...(jahr && jahr >= 1800 ? { gruendungsjahr: jahr } : {}),
    ...(t(o.register, 120) ? { register: t(o.register, 120) } : {}), ...(t(o.signal, 240) ? { signal: t(o.signal, 240) } : {}),
    ...(profile ? { profile } : {}), ...(beitraege.length ? { beitraege } : {}), ...(partner.length ? { partner } : {}),
    ...(ganz(o.referenzen, 10000) !== undefined ? { referenzen: ganz(o.referenzen, 10000) } : {}), gemessenAm: am,
  };
  return Object.keys(s).length > 1 ? s : undefined;
}
