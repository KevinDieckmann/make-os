// ─── Markttraktion · LinkedIn-Netzwerk: anreichern, vernetzen, anschreiben (rein, getestet) ──
// Kevin 25.09.: „ein Modus beim Head of Marketing, dass wir die Daten immer
// anreichern und mit allen bei LinkedIn vernetzt sein wollen — erst vernetzen,
// dann schreiben … ein kompletter Flow in die Bearbeitung der Leute.“
// Entscheidungen (25.09.): eine geführte Vernetzen-Runde, der Head of
// Marketing plant die Tagesportion; die Nachricht nach der Annahme ist je
// Kampagne einstellbar („modular zur Kampagne“); anreichern über den
// LinkedIn-Export (Connections.csv) und einen vorbefüllten Suchlink; Kevin und
// Malin vernetzen getrennt — der Stand je Profil steht an der Person.
//
// Der Weg einer Person je Profil:
//   anreichern  → kein Profil hinterlegt: Suchlink öffnen, Adresse einfügen
//   anfragen    → Profil öffnen, Vernetzungsanfrage schicken (in LinkedIn)
//   warten      → Anfrage läuft; nach 21 Tagen ohne Annahme: zurückziehen
//   schreiben   → angenommen: Nachricht aus der Kampagne (Sie/Du, Name, Firma)
//   nachfassen  → nach den Folgetagen ohne Reaktion: nachfassen oder anrufen
//   fertig      → geschrieben und noch in der Frist, oder schon im Gespräch
// MAKE OS versendet nichts: Es öffnet LinkedIn und kopiert den Text — geklickt
// wird von Kevin oder Malin. Die Annahme kommt von Hand oder beim nächsten
// Export-Import automatisch.
// Recht (§ 7 UWG): Vernetzen ist keine Werbung; eine Nachricht danach ist
// elektronische Post. Jede Vorlage trägt deshalb ihre Ampel — die Entscheidung,
// welche Vorlage eine Kampagne nutzt, trifft Kevin.

import { anzeigename, type Kontakt } from '@/lib/make-one/crm';
import type { Kampagne } from './typen';
import { firmenSchluessel } from './firmen';

import type { NetzStand, VernetzenEinstellung, VorlageId } from './netzwerk-form';
export { NETZ_STATUS, netzwerkSaeubern, netzwerkVereinen, vernetzenSaeubern, type NetzStand, type NetzStatus, type VernetzenEinstellung, type VorlageId } from './netzwerk-form';

export type NetzStufe = 'anreichern' | 'anfragen' | 'warten' | 'zurueckziehen' | 'schreiben' | 'nachfassen' | 'fertig' | 'raus';

/** Nach so vielen Tagen ohne Annahme wird eine Anfrage zurückgezogen (LinkedIn zählt offene Anfragen gegen das Wochenlimit). */
export const ANFRAGE_TAGE = 21;
/** LinkedIn lässt ohne Premium rund 100 Anfragen je Woche zu — 15 am Tag bleiben sicher darunter. */
export const PRO_TAG_STANDARD = 15;
/** Notiz zur Vernetzungsanfrage: ohne Premium höchstens 200 Zeichen. */
export const NOTIZ_MAX = 200;

const tag = (iso?: string) => (iso ?? '').slice(0, 10);
const tageZwischen = (von: string, bis: string) => Math.round((Date.parse(`${tag(bis)}T12:00:00Z`) - Date.parse(`${tag(von)}T12:00:00Z`)) / 864e5);
const plus = (d: string, n: number) => { const x = new Date(`${tag(d)}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

// ── Profile ─────────────────────────────────────────────────────────────────

/** LinkedIn-Profiladresse → „linkedin.com/in/slug“ (klein, ohne Protokoll, www., Sprache, Schrägstrich, Parameter). */
export function profilSchluessel(url?: string | null): string | null {
  const t = String(url ?? '').trim().toLowerCase();
  const m = t.match(/linkedin\.com\/(in|pub)\/([^/?#\s]+)/);
  if (!m) return null;
  try { return `linkedin.com/${m[1]}/${decodeURIComponent(m[2]).replace(/\/+$/, '')}`; } catch { return `linkedin.com/${m[1]}/${m[2]}`; }
}

/** Saubere Profiladresse zum Speichern (https://www.linkedin.com/in/slug) — null, wenn es kein Personenprofil ist. */
export function profilAdresse(url?: string | null): string | null {
  const s = profilSchluessel(url);
  return s ? `https://www.${s}` : null;
}

const RECHTSFORM = /\b(gmbh|mbh|ag|ug|kg|ohg|gbr|se|ltd|inc|llc|co\.?|haftungsbeschränkt|&)\b/gi;
/** Vorbefüllte Personensuche bei LinkedIn: Vor- und Nachname, dazu die Firma ohne Rechtsform. */
export function suchLink(k: Pick<Kontakt, 'vorname' | 'nachname' | 'firma'>): string {
  const firma = (k.firma ?? '').replace(/\(.*?\)/g, ' ').replace(RECHTSFORM, ' ').replace(/\s+/g, ' ').trim();
  const q = [k.vorname, k.nachname, firma].map(x => (x ?? '').trim()).filter(Boolean).join(' ');
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(q)}`;
}

// ── Stufe je Person und Profil ──────────────────────────────────────────────

export function netzStand(k: Pick<Kontakt, 'netzwerk'>, profil: string): NetzStand | undefined {
  return k.netzwerk?.[profil];
}

/** Wo steht die Person für dieses Profil — und warum? `folgeTage`: nach der Nachricht so lange warten, dann nachfassen. */
export function netzStufe(k: Kontakt, profil: string, heute: string, folgeTage = 7): { stufe: NetzStufe; grund: string } {
  if (k.werbesperre) return { stufe: 'raus', grund: 'Werbesperre' };
  const s = netzStand(k, profil);
  if (s?.status === 'abgelehnt' || s?.status === 'zurueckgezogen') return { stufe: 'raus', grund: s.status === 'abgelehnt' ? 'Anfrage abgelehnt' : 'Anfrage zurückgezogen' };
  if (s?.status === 'vernetzt') {
    if (!s.geschriebenAm) return { stufe: 'schreiben', grund: `Vernetzt seit ${s.vernetztAm ? tag(s.vernetztAm) : 'kurzem'} — noch keine Nachricht` };
    // Eine Reaktion oder ein Gespräch nach der Nachricht beendet den Flow — der Rest ist Vertrieb.
    const danach = (k.aktivitaeten ?? []).some(a => tag(a.am) > tag(s.geschriebenAm) && (a.art === 'antwort' || a.art === 'gespraech' || a.art === 'termin' || a.ergebnis === 'gespraech' || a.ergebnis === 'termin'));
    if (danach) return { stufe: 'fertig', grund: 'Reaktion nach der Nachricht' };
    const seit = tageZwischen(s.geschriebenAm, heute);
    return seit >= folgeTage ? { stufe: 'nachfassen', grund: `Nachricht vor ${seit} Tagen, noch keine Reaktion` } : { stufe: 'fertig', grund: `Nachricht vor ${seit} Tagen — Nachfassen ab ${plus(s.geschriebenAm, folgeTage)}` };
  }
  if (s?.status === 'angefragt') {
    const seit = s.angefragtAm ? tageZwischen(s.angefragtAm, heute) : 0;
    return seit >= ANFRAGE_TAGE ? { stufe: 'zurueckziehen', grund: `Anfrage seit ${seit} Tagen offen` } : { stufe: 'warten', grund: `Anfrage seit ${seit === 0 ? 'heute' : `${seit} Tagen`}` };
  }
  if (!profilAdresse(k.linkedin)) return k.linkedinNichtGefunden ? { stufe: 'raus', grund: 'Kein Profil gefunden' } : { stufe: 'anreichern', grund: 'Kein LinkedIn-Profil hinterlegt' };
  return { stufe: 'anfragen', grund: 'Noch nicht vernetzt' };
}

// ── Die Runde ───────────────────────────────────────────────────────────────

export interface NetzKarte { kontakt: Kontakt; stufe: NetzStufe; grund: string }
export interface NetzZahlen { anreichern: number; anfragen: number; warten: number; zurueckziehen: number; schreiben: number; nachfassen: number; vernetzt: number; heuteAngefragt: number; restHeute: number }

/** Wer gehört überhaupt ins Netzwerk? Keine Sperre, kein Wettbewerb, keine Dienstleister. */
export function netzFaehig(k: Kontakt): boolean {
  return !k.werbesperre && k.typ !== 'Dienstleister';
}

/** Wichtige zuerst: Kunden, Kreis A/B, Prio A/B, Leads — dann alphabetisch. */
function rang(k: Kontakt): number {
  return (k.lebensphase === 'kunde' ? 0 : 10) + (k.kreis === 'A' ? 0 : k.kreis === 'B' ? 2 : 5) + (k.prio === 'A' ? 0 : k.prio === 'B' ? 2 : 6) + (k.typ === 'Lead' || k.lebensphase === 'interessent' ? 0 : 3);
}

/**
 * Die Karten für heute, in der Reihenfolge, in der sie am meisten bringen:
 * erst schreiben (angenommen, wartet auf uns), dann nachfassen, dann die
 * Tagesportion neuer Anfragen (abzüglich der heute schon gestellten), dann
 * anreichern (so viele wie die Portion), zuletzt alte Anfragen zurückziehen.
 * Mit Kampagne nur deren Personen und deren Folgetage.
 */
export function netzRunde(kontakte: Kontakt[], profil: string, heute: string, opt: { kampagne?: Pick<Kampagne, 'kontaktIds' | 'vernetzen'>; proTag?: number } = {}): { karten: NetzKarte[]; zahlen: NetzZahlen } {
  const ids = opt.kampagne ? new Set(opt.kampagne.kontaktIds) : null;
  const folge = opt.kampagne?.vernetzen?.folgeTage ?? 7;
  const proTag = opt.proTag ?? opt.kampagne?.vernetzen?.proTag ?? PRO_TAG_STANDARD;
  const alle = kontakte.filter(k => netzFaehig(k) && (!ids || ids.has(k.id)));
  const mit = alle.map(k => ({ kontakt: k, ...netzStufe(k, profil, heute, folge) })).sort((a, b) => rang(a.kontakt) - rang(b.kontakt) || anzeigename(a.kontakt).localeCompare(anzeigename(b.kontakt)));
  const je = (s: NetzStufe) => mit.filter(x => x.stufe === s);
  const heuteAngefragt = kontakte.filter(k => tag(k.netzwerk?.[profil]?.angefragtAm) === heute).length;
  const restHeute = Math.max(0, proTag - heuteAngefragt);
  const karten = [...je('schreiben'), ...je('nachfassen'), ...je('anfragen').slice(0, restHeute), ...je('anreichern').slice(0, Math.max(restHeute, 5)), ...je('zurueckziehen').slice(0, 10)];
  return {
    karten,
    zahlen: {
      anreichern: je('anreichern').length, anfragen: je('anfragen').length, warten: je('warten').length, zurueckziehen: je('zurueckziehen').length,
      schreiben: je('schreiben').length, nachfassen: je('nachfassen').length, vernetzt: alle.filter(k => k.netzwerk?.[profil]?.status === 'vernetzt').length,
      heuteAngefragt, restHeute,
    },
  };
}

// ── Vorlagen (modular je Kampagne) ──────────────────────────────────────────

export interface Vorlage { id: VorlageId; label: string; ampel: 'gruen' | 'gelb'; recht: string; notiz: { sie: string; du: string }; nachricht: { sie: string; du: string } }

const NOTIZ = { sie: 'Hallo {vorname} {nachname}, ich würde mich gern mit Ihnen vernetzen — {thema} beschäftigt uns beide. Viele Grüße, {absender}', du: 'Hallo {vorname}, ich würde mich gern mit dir vernetzen — {thema} beschäftigt uns beide. Viele Grüße, {absender}' };

export const VORLAGEN: Vorlage[] = [
  {
    id: 'erlaubnis', label: 'Danke + Erlaubnisfrage', ampel: 'gruen',
    recht: 'Ohne Werbung: Dank und die Frage, ob man schreiben darf. Ein ausdrückliches Ja wird als Einwilligung mit Wortlaut gespeichert.',
    notiz: NOTIZ,
    nachricht: {
      sie: 'Hallo {vorname} {nachname}, danke fürs Vernetzen! Wir beschäftigen uns gerade intensiv mit {thema}. Darf ich Ihnen kurz schreiben, woran wir arbeiten? Viele Grüße, {absender}',
      du: 'Hallo {vorname}, danke fürs Vernetzen! Wir beschäftigen uns gerade intensiv mit {thema}. Darf ich dir kurz schreiben, woran wir arbeiten? Viele Grüße, {absender}',
    },
  },
  {
    id: 'mehrwert', label: 'Danke + Austausch', ampel: 'gruen',
    recht: 'Ohne Werbung: Dank und Austausch. Keine Ankündigung eines Angebots.',
    notiz: NOTIZ,
    nachricht: {
      sie: 'Hallo {vorname} {nachname}, danke fürs Vernetzen! Ich teile hier regelmäßig, was wir zu {thema} lernen — freue mich auf den Austausch. Viele Grüße, {absender}',
      du: 'Hallo {vorname}, danke fürs Vernetzen! Ich teile hier regelmäßig, was wir zu {thema} lernen — freue mich auf den Austausch. Viele Grüße, {absender}',
    },
  },
  {
    id: 'ankuendigung', label: '„Wir melden uns die Tage“', ampel: 'gelb',
    recht: 'Kündigt eine geschäftliche Ansprache an. Ohne Einwilligung angreifbar (§ 7 UWG) — deine Entscheidung je Kampagne.',
    notiz: NOTIZ,
    nachricht: {
      sie: 'Hallo {vorname} {nachname}, danke fürs Vernetzen! Ich melde mich in den nächsten Tagen kurz bei Ihnen — ich glaube, {thema} ist für {firma} gerade spannend. Viele Grüße, {absender}',
      du: 'Hallo {vorname}, danke fürs Vernetzen! Ich melde mich in den nächsten Tagen kurz bei dir — ich glaube, {thema} ist für {firma} gerade spannend. Viele Grüße, {absender}',
    },
  },
  {
    id: 'eigen', label: 'Eigener Text', ampel: 'gelb',
    recht: 'Eigener Text — vor dem Einsatz prüfen: Wirbt er, braucht er eine Einwilligung (§ 7 UWG).',
    notiz: NOTIZ, nachricht: { sie: '', du: '' },
  },
];

export const vorlage = (id?: string) => VORLAGEN.find(v => v.id === id) ?? VORLAGEN[0];

/** Die Einstellung einer neuen Vernetzen-Kampagne — die empfohlene, rechtlich grüne Vorlage. */
export function vernetzenStandard(thema = 'Wachstum im Mittelstand'): VernetzenEinstellung {
  const v = vorlage('erlaubnis');
  return { vorlage: v.id, thema, notiz: { ...v.notiz }, nachricht: { ...v.nachricht }, folgeTage: 7, proTag: PRO_TAG_STANDARD };
}

/** Ampel der Kampagne: eine geänderte grüne Vorlage gilt als eigener Text (gelb). */
export function vernetzenAmpel(e: VernetzenEinstellung): { ampel: 'gruen' | 'gelb'; recht: string } {
  const v = vorlage(e.vorlage);
  const veraendert = v.id !== 'eigen' && (e.nachricht.sie.trim() !== v.nachricht.sie || e.nachricht.du.trim() !== v.nachricht.du);
  return veraendert ? { ampel: 'gelb', recht: `Aus „${v.label}“ angepasst — vor dem Einsatz prüfen, ob der Text wirbt (§ 7 UWG).` } : { ampel: v.ampel, recht: v.recht };
}

/** Text für eine Person: Sie/Du nach ihrer Anrede, Platzhalter {vorname} {nachname} {firma} {thema} {absender}. */
export function textFuer(vorlagen: { sie: string; du: string }, k: Pick<Kontakt, 'vorname' | 'nachname' | 'firma' | 'anrede'>, thema: string, absender: string): string {
  const du = k.anrede === 'Du';
  const t = du ? vorlagen.du : vorlagen.sie;
  const firma = (k.firma ?? '').trim() || (du ? 'dein Unternehmen' : 'Ihr Unternehmen');
  return t.replace(/\{vorname\}/g, (k.vorname ?? '').trim()).replace(/\{nachname\}/g, (k.nachname ?? '').trim()).replace(/\{firma\}/g, firma)
    .replace(/\{thema\}/g, thema.trim() || 'Wachstum im Mittelstand').replace(/\{absender\}/g, absender).replace(/ {2,}/g, ' ').replace(/ ,/g, ',').trim();
}

// ── LinkedIn-Export (Connections.csv) ───────────────────────────────────────

export interface ExportZeile { vorname: string; nachname: string; url: string; email?: string; firma?: string; position?: string; vernetztAm?: string }

/** Eine CSV-Zeile mit Anführungszeichen und Kommas in Feldern. */
function csvZeile(z: string): string[] {
  const raus: string[] = []; let cur = ''; let q = false;
  for (let i = 0; i < z.length; i++) {
    const c = z[i];
    if (q) { if (c === '"') { if (z[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { raus.push(cur); cur = ''; }
    else cur += c;
  }
  raus.push(cur);
  return raus.map(x => x.trim());
}

const MONAT: Record<string, number> = { jan: 1, feb: 2, mar: 3, mär: 3, maer: 3, apr: 4, may: 5, mai: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, okt: 10, nov: 11, dec: 12, dez: 12 };
/** „25 Sep 2026“, „25. Sep. 2026“ oder „2026-09-25“ → 2026-09-25. */
export function exportDatum(t?: string): string | undefined {
  const s = String(t ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})\.?\s+([A-Za-zÄäÖöÜü]+)\.?\s+(\d{4})$/);
  const mon = m ? MONAT[m[2].toLowerCase().slice(0, 3)] ?? MONAT[m[2].toLowerCase().slice(0, 4)] : undefined;
  return m && mon ? `${m[3]}-${String(mon).padStart(2, '0')}-${m[1].padStart(2, '0')}` : undefined;
}

/** Connections.csv lesen: die „Notes“ davor überspringen, Kopf auf Englisch oder Deutsch. */
export function exportLesen(csv: string): ExportZeile[] {
  const zeilen = csv.replace(/^﻿/, '').split(/\r?\n/);
  const kopfIdx = zeilen.findIndex(z => /first name|vorname/i.test(z) && /url/i.test(z));
  if (kopfIdx < 0) return [];
  const kopf = csvZeile(zeilen[kopfIdx]).map(h => h.toLowerCase());
  const spalte = (...namen: string[]) => kopf.findIndex(h => namen.some(n => h === n || h.startsWith(n)));
  const i = { v: spalte('first name', 'vorname'), n: spalte('last name', 'nachname'), u: spalte('url'), e: spalte('email', 'e-mail'), f: spalte('company', 'unternehmen', 'firma'), p: spalte('position'), d: spalte('connected on', 'verbunden', 'vernetzt') };
  const raus: ExportZeile[] = [];
  for (const z of zeilen.slice(kopfIdx + 1)) {
    if (!z.trim()) continue;
    const f = csvZeile(z);
    const url = profilAdresse(f[i.u]);
    if (!url) continue;
    const opt = (j: number) => (j >= 0 && f[j] ? f[j] : undefined);
    raus.push({ vorname: f[i.v] ?? '', nachname: f[i.n] ?? '', url, ...(opt(i.e) ? { email: opt(i.e) } : {}), ...(opt(i.f) ? { firma: opt(i.f) } : {}), ...(opt(i.p) ? { position: opt(i.p) } : {}), ...(exportDatum(opt(i.d)) ? { vernetztAm: exportDatum(opt(i.d)) } : {}) });
  }
  return raus;
}

const namensSchl = (v?: string, n?: string) => `${v ?? ''}${n ?? ''}`.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/\b(dr|prof|med|dipl|ing)\b\.?/g, '').replace(/[^a-z]/g, '');

export interface ExportTreffer { kontaktId: string; zeile: ExportZeile; wie: 'profil' | 'name_firma' | 'name'; neuesProfil: boolean; wirdVernetzt: boolean }
export interface ExportAbgleich { treffer: ExportTreffer[]; ohneTreffer: number; zeilen: number }

/**
 * Welche Kontakte stecken im Export? Zuerst über das Profil, dann über Name und
 * Firma, zuletzt über den Namen allein — aber nur, wenn er in der Kartei
 * eindeutig ist und die Person noch kein anderes Profil hat. Wer nicht in der
 * Kartei steht, bleibt draußen (nur eigene Kontakte, kein Adressbuch-Import).
 */
export function exportAbgleich(kontakte: Kontakt[], zeilen: ExportZeile[], profil: string): ExportAbgleich {
  const nachProfil = new Map<string, Kontakt>();
  const nachName = new Map<string, Kontakt[]>();
  for (const k of kontakte) {
    const p = profilSchluessel(k.linkedin);
    if (p) nachProfil.set(p, k);
    const n = namensSchl(k.vorname, k.nachname);
    if (n.length >= 5) nachName.set(n, [...(nachName.get(n) ?? []), k]);
  }
  const vergeben = new Set<string>();
  const treffer: ExportTreffer[] = [];
  for (const z of zeilen) {
    let k = nachProfil.get(profilSchluessel(z.url)!);
    let wie: ExportTreffer['wie'] = 'profil';
    if (!k) {
      const gleich = nachName.get(namensSchl(z.vorname, z.nachname)) ?? [];
      const f = firmenSchluessel(z.firma ?? '');
      const mitFirma = f ? gleich.filter(x => { const g = firmenSchluessel(x.firma ?? ''); return g && (g.includes(f) || f.includes(g)); }) : [];
      if (mitFirma.length === 1) { k = mitFirma[0]; wie = 'name_firma'; }
      else if (gleich.length === 1) { k = gleich[0]; wie = 'name'; }
      // Hat die Person schon ein ANDERES Profil, ist es jemand anderes mit gleichem Namen.
      if (k && profilSchluessel(k.linkedin) && profilSchluessel(k.linkedin) !== profilSchluessel(z.url)) k = undefined;
    }
    if (!k || vergeben.has(k.id)) continue;
    vergeben.add(k.id);
    treffer.push({ kontaktId: k.id, zeile: z, wie, neuesProfil: !profilSchluessel(k.linkedin), wirdVernetzt: k.netzwerk?.[profil]?.status !== 'vernetzt' });
  }
  return { treffer, ohneTreffer: zeilen.length - treffer.length, zeilen: zeilen.length };
}

/** Den Export auf einen Kontakt anwenden: Profil ergänzen (nie überschreiben), Stand „vernetzt“ — eine laufende Anfrage gilt damit als angenommen. */
export function exportAnwenden(k: Kontakt, t: ExportTreffer, profil: string, heute: string): Kontakt {
  const alt = k.netzwerk?.[profil];
  const stand: NetzStand = alt?.status === 'vernetzt' ? alt : { ...(alt ?? {}), status: 'vernetzt', vernetztAm: t.zeile.vernetztAm ?? heute, quelle: 'export' };
  return { ...k, ...(t.neuesProfil ? { linkedin: t.zeile.url, linkedinNichtGefunden: undefined } : {}), netzwerk: { ...(k.netzwerk ?? {}), [profil]: stand } };
}
