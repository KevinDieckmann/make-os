// ─── Markttraktion · Visitenkarte → Kontakt (rein, getestet) ────────────────
// Auf Events und in Terminen bekommen Kevin und Malin Visitenkarten. Foto →
// das Modell liest die Karte (app/api/crm/visitenkarte) → diese Datei putzt
// die Antwort, bevor irgendetwas in ein Formular fällt. Warum eine eigene,
// reine Stufe: ein Lesefehler soll als LEERES Feld ankommen, nicht als
// halbrichtige Mailadresse, an die später eine Einladung geht.
//
// Regeln (Kevins Vorgabe, DSGVO/DE-first):
//   · Nichts erfinden. Leeres bleibt leer; was nicht plausibel ist, fällt weg
//     und steht in „unsicher“ — ehrlicher als stilles Raten.
//   · E-Mail klein und formal gültig, Telefon als +49 … (Leerzeichen erlaubt),
//     LinkedIn nur linkedin.com/in/…, Webseite nur http(s), alles längenbegrenzt.
//   · Akademischer Titel (Dr., Prof.) bleibt VORN im Vornamen: die Kartei hat
//     kein eigenes Titelfeld, die bestehenden Einträge machen es genauso, und
//     so stimmen Anzeigename („Dr. Anna Weber“) und Anrede im Entwurf („Frau
//     Dr. Weber“). Abschlüsse (MBA, Dipl.-Kfm.) und „Herr/Frau“ fallen weg.
//     Für die Dublettenprüfung zählt der Name OHNE Titel.
//   · Eine Visitenkarte ist keine Einwilligung: der Kontakt aus der Karte hat
//     eine Herkunft (Art. 14 entfällt, die Daten kamen von der Person selbst),
//     aber nie einen Eintrag in `einwilligungen`.
//   · Das Foto selbst wird nirgends gespeichert — hier kommt nur Text an.

import { HERKUNFT, type Herkunft, type Kontakt } from '@/lib/make-one/crm';
import { domainVon, firmenSchluessel } from './firmen';
import type { Firma } from './typen';

/** Was von einer Karte übernommen wird. Alle Felder optional: nicht gelesen = nicht da. */
export interface VisitenkartenDaten {
  /** Mit akademischem Titel vorn („Dr. Anna“). */
  vorname?: string;
  nachname?: string;
  firma?: string;
  position?: string;
  email?: string;
  /** Hauptnummer: Festnetz/Durchwahl, sonst die Mobilnummer. */
  telefon?: string;
  /** Mobilnummer — nur, wenn es daneben eine andere Hauptnummer gibt (Kartei: `sms`). */
  mobil?: string;
  linkedin?: string;
  /** Webseite der Firma (Kartei: `firmaWebseite`). */
  webseite?: string;
}
export type KartenFeld = keyof VisitenkartenDaten;

export const KARTEN_FELDER: { id: KartenFeld; label: string }[] = [
  { id: 'vorname', label: 'Vorname' }, { id: 'nachname', label: 'Nachname' }, { id: 'firma', label: 'Firma' }, { id: 'position', label: 'Position' },
  { id: 'email', label: 'E-Mail' }, { id: 'telefon', label: 'Telefon' }, { id: 'mobil', label: 'Mobil' }, { id: 'linkedin', label: 'LinkedIn' }, { id: 'webseite', label: 'Webseite' },
];

/** Obergrenzen je Feld — dieselbe Größenordnung wie die Kartei (lib/make-one/crm.ts). */
const LAENGE: Record<KartenFeld, number> = { vorname: 80, nachname: 80, firma: 140, position: 120, email: 160, telefon: 40, mobil: 40, linkedin: 200, webseite: 200 };

/** Was das Modell zurückgibt (Schema in der Route). Alles „unknown“, weil es von außen kommt. */
export interface KartenRoh {
  istVisitenkarte?: unknown;
  titel?: unknown; vorname?: unknown; nachname?: unknown; firma?: unknown; position?: unknown;
  email?: unknown; telefon?: unknown; mobil?: unknown; linkedin?: unknown; webseite?: unknown;
  unsicher?: unknown;
}

/** Feldnamen, die das Modell in `unsicher` nennen darf (Schema-Enum der Route). */
export const ROH_FELDER = ['titel', 'vorname', 'nachname', 'firma', 'position', 'email', 'telefon', 'mobil', 'linkedin', 'webseite'] as const;

// ── Text ────────────────────────────────────────────────────────────────────

/** Einzeilig, ohne Steuerzeichen, getrimmt, gekürzt. */
export function text(v: unknown, max: number): string {
  if (typeof v !== 'string' && typeof v !== 'number') return '';
  // eslint-disable-next-line no-control-regex
  return String(v).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max).trim();
}

// ── E-Mail ──────────────────────────────────────────────────────────────────

const MAIL = /^[a-z0-9._%+-]+@[a-z0-9äöü-]+(\.[a-z0-9äöü-]+)*\.[a-z]{2,24}$/;

/** Klein, ohne „mailto:“/Leerzeichen, formal gültig — sonst undefined. */
export function emailNormal(v: unknown): string | undefined {
  let t = text(v, 300).toLowerCase().replace(/^mailto:/, '').replace(/^e-?mail(?:\s*:\s*|\s+)/, '');
  t = t.replace(/\s+/g, '').replace(/[.,;:]+$/, '');
  if (!t || t.length > LAENGE.email || t.includes('..') || !MAIL.test(t)) return undefined;
  const [lokal] = t.split('@');
  if (lokal.startsWith('.') || lokal.endsWith('.')) return undefined;
  return t;
}

// ── Telefon ─────────────────────────────────────────────────────────────────

const ziffern = (t: string) => t.replace(/\D/g, '');

/**
 * Telefonnummer mit Ländervorwahl, Gruppen wie gedruckt:
 * „0211 / 123 45-67“ → „+49 211 123 45 67“, „+49 (0) 171 1234567“ → „+49 171 1234567“,
 * „0043 1 234 5678“ → „+43 1 234 5678“. Ohne Länder- oder Ortsvorwahl → undefined
 * (eine Nummer, die man nicht wählen kann, ist schlechter als keine).
 */
export function telefonNormal(v: unknown): string | undefined {
  let t = text(v, 80);
  t = t.replace(/^[^\d+(]*/, '');            // Beschriftung vorn: „Tel.:“, „M“, „Fon“
  t = t.replace(/\(\s*0\s*\)/g, ' ');        // +49 (0) 211 → +49 211
  t = t.replace(/[()/.\-–—]/g, ' ');         // Trenner → Leerzeichen
  t = t.replace(/[^\d+\s].*$/, '');          // Text dahinter („Zentrale“, „Fax“) weg
  t = t.replace(/\s+/g, ' ').trim();
  if (!t || t.indexOf('+', 1) >= 0) return undefined;
  if (t.startsWith('00')) t = `+${t.slice(2).trimStart()}`;
  else if (t.startsWith('0')) t = `+49 ${t.slice(1).trimStart()}`;
  else if (!t.startsWith('+')) return undefined;
  t = t.replace(/^\+49\s*0\s*/, '+49 ').replace(/^\+49(?=\d)/, '+49 ');
  const n = ziffern(t).length;
  if (n < 7 || n > 15) return undefined;
  return t.slice(0, LAENGE.telefon).trim();
}

// ── LinkedIn und Webseite ───────────────────────────────────────────────────

function alsUrl(v: unknown): URL | undefined {
  let t = text(v, 400);
  // Leerzeichen mitten in der Adresse: lieber leer als zusammengeraten.
  if (!t || /\s/.test(t)) return undefined;
  // Fremdes Schema (javascript:, mailto:, ftp:) nie durchlassen.
  if (/^[a-z][a-z0-9+.-]*:/i.test(t) && !/^https?:\/\//i.test(t)) return undefined;
  if (!/^https?:\/\//i.test(t)) t = `https://${t}`;
  try {
    const u = new URL(t);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return undefined;
    if (u.username || u.password) return undefined;
    return u;
  } catch { return undefined; }
}

const istLinkedinHost = (host: string) => host === 'linkedin.com' || host.endsWith('.linkedin.com');

/** Nur Personenprofile auf linkedin.com (…/in/… oder …/pub/…), einheitlich als https://www.linkedin.com/in/…. */
export function linkedinNormal(v: unknown): string | undefined {
  const u = alsUrl(v);
  if (!u || !istLinkedinHost(u.hostname.toLowerCase())) return undefined;
  const pfad = u.pathname.replace(/\/+$/, '');
  if (!/^\/(in|pub)\/[^/]+/i.test(pfad)) return undefined;
  const url = `https://www.linkedin.com${pfad}`;
  return url.length <= LAENGE.linkedin ? url : undefined;
}

/** Firmen-Webseite, nur http(s), ohne Tracking-Anhang — nie linkedin.com, nie eine Mailadresse. */
export function webNormal(v: unknown): string | undefined {
  if (text(v, 400).includes('@')) return undefined;
  const u = alsUrl(v);
  if (!u) return undefined;
  const host = u.hostname.toLowerCase();
  if (!/^[a-z0-9äöü.-]+\.([a-z]{2,24}|xn--[a-z0-9-]+)$/.test(host) || host.includes('..') || istLinkedinHost(host)) return undefined;
  const pfad = u.pathname === '/' ? '' : u.pathname.replace(/\/+$/, '');
  const url = `${u.protocol}//${host}${u.port ? `:${u.port}` : ''}${pfad}`;
  return url.length <= LAENGE.webseite ? url : undefined;
}

// ── Namen ───────────────────────────────────────────────────────────────────

const TITEL = /^(prof\.?|professor|univ\.-prof\.?|dr\.?|dr\.-ing\.?|pd|priv\.-doz\.?)$/i;
/** Zusätze, die nur direkt nach einem Titel stehen („Dr. med.“, „Dr. rer. nat.“, „Dr. h. c.“). */
const TITEL_ZUSATZ = /^(med\.?|dent\.?|vet\.?|rer\.?|nat\.?|pol\.?|oec\.?|phil\.?|jur\.?|iur\.?|theol\.?|h\.c\.?|habil\.?|mult\.?|ing\.?)$/i;
const ANREDE = /^(herr|herrn|frau|mr\.?|mrs\.?|ms\.?)$/i;
const ABSCHLUSS = /^(dipl\.?-?[\wäöü.-]*|diplom-[\wäöü.-]+|mba|emba|m\.?sc\.?|b\.?sc\.?|m\.?a\.?|b\.?a\.?|ll\.?m\.?|ll\.?b\.?|ph\.?d\.?|m\.?eng\.?|b\.?eng\.?|cfa|cpa|acca|mag\.?|bsc|msc)$/i;
const PARTIKEL = /^(von|vom|zu|zum|zur|van|de|der|den|di|da|del|della|la|le|ten|ter)$/i;

const woerter = (v: unknown) => text(v, 200).replace(/,.*$/, '').split(' ').filter(Boolean);

/** „ANNA-LENA“ → „Anna-Lena“ — nur wenn der ganze Name in Großbuchstaben steht. */
function schreibweise(w: string): string {
  const buchstaben = w.replace(/[^A-Za-zÄÖÜäöüßÀ-ÿ]/g, '');
  if (buchstaben.length < 2 || w !== w.toUpperCase() || w === w.toLowerCase()) return w;
  return w.toLowerCase().split(/([\s-])/).map(t => t.charAt(0).toUpperCase() + t.slice(1)).join('');
}

/** Titel einheitlich schreiben: „dr“ → „Dr.“, „professor“ → „Prof.“. */
function titelForm(t: string): string {
  const k = t.toLowerCase().replace(/\.$/, '');
  if (k === 'dr') return 'Dr.';
  if (k === 'prof' || k === 'professor') return 'Prof.';
  return t;
}

/** Titel (und seine Zusätze) vorn abnehmen, Anrede und Abschlüsse vorn/hinten entfernen. */
function zerlegen(liste: string[]): { titel: string[]; rest: string[] } {
  const titel: string[] = [];
  const rest = liste.slice();
  let nachTitel = false;
  while (rest.length) {
    const w = rest[0];
    if (ANREDE.test(w)) { rest.shift(); continue; }
    if (TITEL.test(w)) { titel.push(titelForm(w)); rest.shift(); nachTitel = true; continue; }
    if (nachTitel && TITEL_ZUSATZ.test(w)) { titel.push(w); rest.shift(); continue; }
    // „h. c.“ in zwei Wörtern — ein einzelnes „C.“ wäre dagegen eine Initiale.
    if (nachTitel && /^h\.$/i.test(w) && /^c\.$/i.test(rest[1] ?? '')) { titel.push(w, rest[1]); rest.splice(0, 2); continue; }
    if (ABSCHLUSS.test(w)) { rest.shift(); nachTitel = false; continue; }
    break;
  }
  while (rest.length && ABSCHLUSS.test(rest[rest.length - 1])) rest.pop();
  return { titel, rest };
}

/** Index, ab dem der Nachname beginnt: erster Namenszusatz („von“) nach dem ersten Wort, sonst das letzte Wort. */
function nachnameAb(w: string[]): number {
  for (let i = 1; i < w.length - 1; i++) if (PARTIKEL.test(w[i])) return i;
  return w.length - 1;
}

/**
 * Vor- und Nachname aus Titel/Vorname/Nachname des Modells. Steht alles in
 * einem Feld („Dr. Anna Weber“), wird geteilt; „von“, „van“, „de“ gehören
 * zum Nachnamen. Titel landen vorn im Vornamen, doppelte nur einmal.
 */
export function nameTeilen(roh: { titel?: unknown; vorname?: unknown; nachname?: unknown }): { vorname?: string; nachname?: string } {
  const t0 = zerlegen(woerter(roh.titel));
  const v0 = zerlegen(woerter(roh.vorname));
  const n0 = zerlegen(woerter(roh.nachname));
  let vor = v0.rest, nach = n0.rest;
  if (!nach.length && vor.length >= 2) { const i = nachnameAb(vor); nach = vor.slice(i); vor = vor.slice(0, i); }
  else if (!vor.length && nach.length >= 2) { const i = nachnameAb(nach); vor = nach.slice(0, i); nach = nach.slice(i); }
  const titel: string[] = [];
  for (const t of [...t0.titel, ...t0.rest.filter(w => TITEL.test(w) || TITEL_ZUSATZ.test(w)), ...v0.titel, ...n0.titel]) {
    if (!titel.some(x => x.toLowerCase() === t.toLowerCase())) titel.push(t);
  }
  const nachname = nach.map(schreibweise).map((w, i) => (i < nach.length - 1 && PARTIKEL.test(w) ? w.toLowerCase() : w)).join(' ').slice(0, LAENGE.nachname).trim();
  const vorOhne = vor.map(schreibweise).join(' ');
  const vorname = [...titel, vorOhne].filter(Boolean).join(' ').slice(0, LAENGE.vorname).trim();
  // Nur Titel ohne Vornamen („Dr.“ + „Weber“) bleibt stehen — so heißt es in der Kartei „Dr. Weber“.
  return { ...(vorname && (vorOhne || nachname) ? { vorname } : {}), ...(nachname ? { nachname } : {}) };
}

/** Name ohne Titel/Anrede, klein, ohne Akzente — der Schlüssel für die Dublettenprüfung. */
export function namensSchluessel(vorname?: string, nachname?: string): string {
  const w = zerlegen(`${vorname ?? ''} ${nachname ?? ''}`.split(/\s+/).filter(Boolean)).rest;
  return w.join('').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/[^a-z0-9]/g, '');
}

/** Gleiche Person dem Namen nach? „Dr. Anna Weber“ = „Anna Weber“. Leere oder sehr kurze Namen zählen nicht. */
export function gleicherName(a: { vorname?: string; nachname?: string }, b: { vorname?: string; nachname?: string }): boolean {
  if (!(a.nachname ?? '').trim() || !(b.nachname ?? '').trim()) return false;
  const x = namensSchluessel(a.vorname, a.nachname);
  return x.length >= 4 && x === namensSchluessel(b.vorname, b.nachname);
}

// ── Die ganze Karte ─────────────────────────────────────────────────────────

export interface KartenErgebnis {
  /** false, wenn auf dem Foto erkennbar keine Visitenkarte ist. */
  istVisitenkarte: boolean;
  daten: VisitenkartenDaten;
  /** Felder, die das Modell unsicher fand ODER die beim Putzen weggefallen sind. */
  unsicher: KartenFeld[];
}

/** Die Modellantwort säubern. Wirft nie — Unbrauchbares wird leer. */
export function saeubereKarte(eingang: unknown): KartenErgebnis {
  const roh: KartenRoh = eingang && typeof eingang === 'object' ? (eingang as KartenRoh) : {};
  const daten: VisitenkartenDaten = {};
  const weg: KartenFeld[] = [];
  const hatte = (v: unknown) => text(v, 400) !== '';

  const name = nameTeilen(roh);
  if (name.vorname) daten.vorname = name.vorname;
  if (name.nachname) daten.nachname = name.nachname;
  const firma = text(roh.firma, LAENGE.firma);
  if (firma) daten.firma = firma;
  const position = text(roh.position, LAENGE.position);
  if (position) daten.position = position;

  const email = emailNormal(roh.email);
  if (email) daten.email = email; else if (hatte(roh.email)) weg.push('email');

  const tel = telefonNormal(roh.telefon);
  const mob = telefonNormal(roh.mobil);
  if (!tel && hatte(roh.telefon)) weg.push('telefon');
  if (!mob && hatte(roh.mobil)) weg.push(tel ? 'mobil' : 'telefon');
  if (tel) daten.telefon = tel;
  if (mob && !tel) daten.telefon = mob;
  else if (mob && tel && ziffern(mob) !== ziffern(tel)) daten.mobil = mob;

  const linkedin = linkedinNormal(roh.linkedin);
  if (linkedin) daten.linkedin = linkedin; else if (hatte(roh.linkedin)) weg.push('linkedin');
  const web = webNormal(roh.webseite);
  if (web) daten.webseite = web; else if (hatte(roh.webseite)) weg.push('webseite');

  // Was das Modell selbst unsicher fand — auf die Felder dieser Seite abgebildet.
  const genannt = Array.isArray(roh.unsicher) ? roh.unsicher.map(x => String(x)) : [];
  const abbilden = (f: string): KartenFeld | null => {
    if (f === 'titel') return 'vorname';
    if (f === 'mobil') return mob && !tel ? 'telefon' : 'mobil';
    return KARTEN_FELDER.some(k => k.id === f) ? (f as KartenFeld) : null;
  };
  const unsicher: KartenFeld[] = [];
  for (const f of [...genannt.map(abbilden), ...weg]) if (f && !unsicher.includes(f)) unsicher.push(f);

  return { istVisitenkarte: roh.istVisitenkarte !== false, daten, unsicher };
}

/** Wurde überhaupt etwas Brauchbares gelesen? (Name, Firma oder ein Kanal.) */
export function hatInhalt(d: VisitenkartenDaten): boolean {
  return !!(d.nachname || d.vorname || d.firma || d.email || d.telefon || d.linkedin);
}

// ── Bild prüfen (Route) ─────────────────────────────────────────────────────

export const BILD_TYPEN = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
export type BildTyp = typeof BILD_TYPEN[number];
export const MAX_BILD_MB = 5;

/** Echter Bildtyp aus den ersten Bytes — dem mitgeschickten Typ allein wird nicht getraut. */
export function bildTypAusDaten(b64: string): BildTyp | null {
  let kopf = '';
  try { kopf = atob(b64.slice(0, 24)); } catch { return null; }
  const b = (i: number) => kopf.charCodeAt(i);
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return 'image/jpeg';
  if (kopf.startsWith('\x89PNG')) return 'image/png';
  if (kopf.startsWith('GIF8')) return 'image/gif';
  if (kopf.startsWith('RIFF') && kopf.slice(8, 12) === 'WEBP') return 'image/webp';
  return null;
}

export type BildPruefung = { ok: true; daten: string; medientyp: BildTyp } | { ok: false; status: number; fehler: string };

/** Data-URL oder reines Base64 → geprüftes Base64 mit echtem Typ, höchstens MAX_BILD_MB. */
export function pruefeBild(bild: unknown, medientyp: unknown): BildPruefung {
  const roh = typeof bild === 'string' ? bild : '';
  const kopf = /^data:([^;,]+);base64,/.exec(roh);
  const daten = roh.slice(kopf ? kopf[0].length : 0).replace(/\s+/g, '');
  if (!daten) return { ok: false, status: 400, fehler: 'Kein Foto übergeben.' };
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(daten)) return { ok: false, status: 400, fehler: 'Das Foto kam beschädigt an — bitte noch einmal aufnehmen.' };
  const bytes = Math.floor((daten.length * 3) / 4) - (daten.endsWith('==') ? 2 : daten.endsWith('=') ? 1 : 0);
  if (bytes > MAX_BILD_MB * 1024 * 1024) {
    return { ok: false, status: 413, fehler: `Das Foto ist ${(bytes / 1024 / 1024).toFixed(1)} MB groß — bis ${MAX_BILD_MB} MB geht es.` };
  }
  const echt = bildTypAusDaten(daten);
  if (!echt) {
    const angegeben = String(medientyp || kopf?.[1] || '').toLowerCase();
    const heic = /heic|heif/.test(angegeben);
    return { ok: false, status: 415, fehler: heic ? 'HEIC-Fotos kann die Erkennung nicht lesen — bitte als JPG aufnehmen (Kamera: „Maximale Kompatibilität“).' : 'Dieses Bildformat wird nicht gelesen — bitte ein Foto als JPG oder PNG.' };
  }
  return { ok: true, daten, medientyp: echt };
}

// ── In die Kartei ───────────────────────────────────────────────────────────

/** Schon in der Kartei? Mail ist der harte Schlüssel, der Name (ohne Titel) nur ein Hinweis. */
export function kartenDubletten(d: Pick<VisitenkartenDaten, 'vorname' | 'nachname' | 'email'>, kontakte: Kontakt[]): { mail?: Kontakt; name?: Kontakt } {
  const mailKey = (d.email ?? '').trim().toLowerCase();
  const mail = mailKey.includes('@') ? kontakte.find(k => (k.email ?? '').trim().toLowerCase() === mailKey) : undefined;
  const name = kontakte.find(k => k !== mail && gleicherName(k, d));
  return { ...(mail ? { mail } : {}), ...(name ? { name } : {}) };
}

/** Bestehende Firma zur Karte: gleicher Name (ohne Rechtsform) oder gleiche Domain. Ohne Firmennamen keine Zuordnung. */
export function firmaZurKarte(d: Pick<VisitenkartenDaten, 'firma' | 'email' | 'webseite'>, firmen: Firma[]): Firma | undefined {
  const name = (d.firma ?? '').trim();
  if (!name) return undefined;
  const s = firmenSchluessel(name);
  const nachName = s.length >= 2 ? firmen.find(f => firmenSchluessel(f.name) === s) : undefined;
  if (nachName) return nachName;
  const dom = domainVon({ email: d.email, firmaWebseite: d.webseite });
  return dom ? firmen.find(f => f.domain === dom || domainVon({ firmaWebseite: f.webseite }) === dom) : undefined;
}

export interface KarteAnlegen {
  id: string;
  /** YYYY-MM-DD */
  heute: string;
  /** ISO-Zeitpunkt für die Aktivität. */
  jetzt: string;
  /** Wer anlegt (Team-Kürzel) — hält danach die Beziehung. */
  von?: string | null;
  herkunft: Herkunft;
  firma?: { id: string; name: string };
  /** Text der ersten Aktivität, z. B. „Per Visitenkarte am Einlass angelegt — Stammtisch“. */
  anlass: string;
}

/** Neuer Kartei-Eintrag aus der Karte. Herkunft ja, Einwilligung nie. */
export function kontaktAusKarte(d: VisitenkartenDaten, o: KarteAnlegen): Kontakt {
  const firma = o.firma?.name ?? (d.firma ?? '').trim();
  const herk = HERKUNFT.find(h => h.id === o.herkunft);
  return {
    id: o.id, vorname: (d.vorname ?? '').trim(), nachname: (d.nachname ?? '').trim(),
    ...(d.email ? { email: d.email.trim().toLowerCase() } : {}), ...(d.telefon ? { telefon: d.telefon } : {}), ...(d.mobil ? { sms: d.mobil } : {}),
    ...(d.position ? { position: d.position } : {}), ...(d.linkedin ? { linkedin: d.linkedin } : {}),
    ...(firma ? { firma, ...(o.firma ? { firmaId: o.firma.id } : {}) } : {}), ...(d.webseite ? { firmaWebseite: d.webseite } : {}),
    eignung: '', prio: '', stufe: 'neu', lebensphase: 'kontakt', anrede: 'Sie',
    ...(o.von ? { besitzer: o.von } : {}), herkunft: o.herkunft, ...(herk?.fremd ? { fremddaten: true } : {}),
    quelle: 'Visitenkarte',
    aktivitaeten: [{ am: o.jetzt, art: 'system', text: o.anlass.slice(0, 300), von: o.von || 'system' }],
    importiertAm: o.heute, geaendertAm: o.heute,
  };
}
