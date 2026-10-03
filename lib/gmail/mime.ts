// ─── Gmail — MIME lesen und bauen (rein, 03.10.2026) ─────────────────────────
// Ohne Paket, mit Tests (tests/gmail-mime.test.ts). Zwei Richtungen:
//   LESEN   Google liefert `format=full`: den Nachrichtenbaum (`payload.parts`) mit Kopfzeilen und base64url-Körpern. Der
//           Körper ist von Google schon vom Transfer-Encoding (Quoted-Printable/Base64) befreit — es sind die Bytes im
//           Zeichensatz des Teils (`Content-Type: …; charset=`), den wir hier selbst auflösen (UTF-8, Latin-1, Windows-1252 …).
//           Kopfzeilen kommen als RFC-2047-Wörter (`=?UTF-8?Q?…?=`), die `rfc2047Lesen` auflöst. Aus dem Baum wird ein
//           Kopf (`GmailKopf`) + reiner Text: text/plain bevorzugt, HTML nur über `htmlZuText` (NIE ungesäubert weiter),
//           Anhänge nur als Metadaten.
//   BAUEN   `mimeBauen` schreibt eine Antwort/neue Mail als RFC 5322: Kopfzeilen ohne Zeilenumbrüche (kein
//           Header-Injection), Betreff/Namen als RFC-2047-Wörter, Text als UTF-8 Quoted-Printable (Zeilen ≤ 76 Zeichen),
//           `In-Reply-To`/`References` für den Thread. `rfc822Lesen` liest so eine Nachricht (Tests, Rohformat) zurück —
//           mit Transfer-Encoding und Zeichensatz.
// Fremder Text ist Daten: nichts hier führt etwas aus, nichts lädt etwas nach.

import { randomBytes } from 'node:crypto';
import { htmlZuText } from './html';
import { GMAIL_GRENZEN, type Adr, type Anhang, type GmailKopf } from './typen';

// ── Zeichensätze ────────────────────────────────────────────────────────────

const CP1252_OBEN = '€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ';

/** Windows-1252 (WHATWG: auch die Bezeichnung „iso-8859-1“/„latin1“) — selbst gelesen, weil `TextDecoder` die Bytes 0x80–0x9F je nach Laufzeit als Steuerzeichen statt als „€“ „ „“ liefert. */
export function cp1252Lesen(bytes: Uint8Array): string {
  let aus = '';
  for (const b of bytes) aus += b >= 0x80 && b <= 0x9f ? CP1252_OBEN[b - 0x80] : String.fromCharCode(b);
  return aus;
}

/** Bytes → Text im angegebenen Zeichensatz; unbekannt/fehlerhaft → UTF-8 (ungültige Bytes werden �, nie ein Wurf). */
export function zeichensatzLesen(bytes: Uint8Array, charset?: string | null): string {
  const c = (charset ?? 'utf-8').trim().replace(/^["']|["']$/g, '').toLowerCase();
  if (['iso-8859-1', 'iso8859-1', 'latin1', 'latin-1', 'l1', 'windows-1252', 'cp1252', 'us-ascii', 'ascii', 'ansi_x3.4-1968'].includes(c)) return cp1252Lesen(bytes);
  for (const n of [c, 'utf-8']) {
    try { return new TextDecoder(n).decode(bytes).replace(/^\uFEFF/, ''); } catch { /* nächster Versuch */ }
  }
  return Buffer.from(bytes).toString('utf8');
}

/** base64url (Google) oder base64 → Bytes. */
export function base64urlBytes(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}
export const bytesBase64url = (b: Uint8Array | string): string => Buffer.from(b as Uint8Array).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// ── Quoted-Printable ────────────────────────────────────────────────────────

/** Quoted-Printable (RFC 2045) → Bytes. Weiche Umbrüche (`=` am Zeilenende) fallen weg; ungültige `=XX` bleiben wörtlich. */
export function quotedPrintableLesen(s: string): Buffer {
  const roh = s.replace(/=\r?\n/g, '');
  const aus: number[] = [];
  for (let i = 0; i < roh.length; i++) {
    const ch = roh.charCodeAt(i);
    if (ch === 0x3d && /^[0-9A-Fa-f]{2}$/.test(roh.slice(i + 1, i + 3))) { aus.push(parseInt(roh.slice(i + 1, i + 3), 16)); i += 2; }
    else if (ch < 0x80) aus.push(ch);
    else aus.push(...Buffer.from(roh[i], 'utf8'));
  }
  return Buffer.from(aus);
}

/** Text → Quoted-Printable (UTF-8), Zeilen ≤ 76 Zeichen, harte Umbrüche als CRLF, Leerraum am Zeilenende kodiert. */
export function quotedPrintableBauen(text: string): string {
  const zeilen = text.replace(/\r\n?/g, '\n').split('\n');
  const aus: string[] = [];
  for (const z of zeilen) {
    const bytes = Buffer.from(z, 'utf8');
    let zeile = '';
    const teile: string[] = [];
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i];
      const letztes = i === bytes.length - 1;
      let t: string;
      if (b === 0x3d || b > 0x7e || (b < 0x20 && b !== 0x09) || ((b === 0x20 || b === 0x09) && letztes)) t = `=${b.toString(16).toUpperCase().padStart(2, '0')}`;
      else t = String.fromCharCode(b);
      // Eine kodierte UTF-8-Folge nie mitten durch einen weichen Umbruch trennen ist nicht nötig (jedes =XX ist für sich gültig).
      if (zeile.length + t.length > 75) { teile.push(`${zeile}=`); zeile = ''; }
      zeile += t;
    }
    teile.push(zeile);
    aus.push(...teile);
  }
  return aus.join('\r\n');
}

// ── RFC 2047 (Kopfzeilen mit Umlauten) ──────────────────────────────────────

const WORT = /=\?([^?\s]+)\?([bBqQ])\?([^?\s]*)\?=/g;

/** Kopfzeile mit kodierten Wörtern (`=?UTF-8?Q?M=C3=BCller?=`) → Text. Wörter, die nur durch Leerraum getrennt sind, werden zusammengesetzt. */
export function rfc2047Lesen(s: string): string {
  if (!s || !s.includes('=?')) return s ?? '';
  const ohneLeerraum = s.replace(/(\?=)\s+(?==\?)/g, '$1');
  return ohneLeerraum.replace(WORT, (_m, cs: string, art: string, daten: string) => {
    const charset = cs.replace(/\*.*$/, '');
    try {
      const bytes = art.toLowerCase() === 'b' ? Buffer.from(daten, 'base64') : quotedPrintableLesen(daten.replace(/_/g, ' '));
      return zeichensatzLesen(bytes, charset);
    } catch { return ''; }
  });
}

/** Text → RFC-2047-Wort(e), wenn nötig (nur ASCII bleibt, wie es ist). Ein Wort ≤ 75 Zeichen, mehrere durch Leerzeichen. */
export function rfc2047Bauen(s: string): string {
  const roh = zeilenfrei(s);
  if (/^[\x20-\x7e]*$/.test(roh)) return roh;
  const bytes = Buffer.from(roh, 'utf8');
  const woerter: string[] = [];
  let teil: number[] = [];
  const zu = () => { if (teil.length) woerter.push(`=?UTF-8?B?${Buffer.from(teil).toString('base64')}?=`); teil = []; };
  // 45 Byte → 60 Zeichen Base64 + 12 Zeichen Rahmen < 75; nie mitten in einer UTF-8-Folge trennen.
  for (let i = 0; i < bytes.length;) {
    const laenge = bytes[i] >= 0xf0 ? 4 : bytes[i] >= 0xe0 ? 3 : bytes[i] >= 0xc0 ? 2 : 1;
    if (teil.length + laenge > 42) zu();
    for (let j = 0; j < laenge && i + j < bytes.length; j++) teil.push(bytes[i + j]);
    i += laenge;
  }
  zu();
  return woerter.join(' ');
}

/** Zeilenumbrüche und Steuerzeichen raus (Header-Injection-Schutz) — ein Wert, eine Zeile. */
export const zeilenfrei = (s: string): string => String(s ?? '').replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ').replace(/\s+/g, ' ').trim();

// ── Adressen ────────────────────────────────────────────────────────────────

/** E-Mail-Adresse, wie sie im Alltag vorkommt — kein Leerraum, genau ein @, Punkt in der Domain, keine spitzen Klammern. */
export const ADRESSE_OK = /^[^\s@<>(),;:"\\[\]]{1,64}@[^\s@<>(),;:"\\[\]]{1,190}\.[^\s@<>(),;:"\\[\]]{2,63}$/;
export function adresseGueltig(e: unknown): e is string {
  return typeof e === 'string' && e.length <= 254 && ADRESSE_OK.test(e) && !e.includes('..');
}
export const adresseKlein = (e: string): string => e.normalize('NFC').trim().toLowerCase();

/** Eine Adressliste (`To:`, `Cc:`, `From:`) → Adressen; Kommas in Anführungszeichen/Klammern trennen nicht. Ungültiges fällt weg. */
export function adressenLesen(kopf: string | undefined | null, max: number = GMAIL_GRENZEN.adressenMax): Adr[] {
  if (!kopf) return [];
  const teile: string[] = [];
  let tiefe = 0, anf = false, akt = '';
  for (const ch of kopf) {
    if (ch === '"' ) anf = !anf;
    if (!anf && ch === '<') tiefe++;
    if (!anf && ch === '>') tiefe = Math.max(0, tiefe - 1);
    if ((ch === ',' || ch === ';') && !anf && tiefe === 0) { teile.push(akt); akt = ''; } else akt += ch;
  }
  teile.push(akt);
  const raus: Adr[] = [];
  for (const t of teile) {
    const s = t.trim();
    if (!s) continue;
    const m = /^(.*?)<\s*([^<>\s]+)\s*>\s*$/.exec(s);
    const mail = adresseKlein(m ? m[2] : s.replace(/^["']|["']$/g, '').replace(/\(.*?\)/g, '').trim());
    if (!adresseGueltig(mail)) continue;
    const roh = m ? m[1].trim().replace(/^"(.*)"$/, '$1').replace(/\\(.)/g, '$1') : '';
    const name = rfc2047Lesen(roh).replace(/\s+/g, ' ').trim().slice(0, 120);
    if (!raus.some(a => a.email === mail)) raus.push({ ...(name && name.toLowerCase() !== mail ? { name } : {}), email: mail });
    if (raus.length >= max) break;
  }
  return raus;
}

/** Eine Adresse für eine Kopfzeile: `Name <a@b.de>` (Name als RFC-2047-Wort bzw. in Anführungszeichen), Name ohne Umbrüche. */
export function adresseBauen(a: Adr): string {
  const name = zeilenfrei(a.name ?? '');
  if (!name) return a.email;
  if (/^[\x20-\x7e]*$/.test(name)) return `"${name.replace(/(["\\])/g, '\\$1')}" <${a.email}>`;
  return `${rfc2047Bauen(name)} <${a.email}>`;
}

// ── Nachrichtenbaum (Gmail `format=full`) ──────────────────────────────────

export interface GPart {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: { name: string; value: string }[];
  body?: { attachmentId?: string; size?: number; data?: string };
  parts?: GPart[];
}
export interface GMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  historyId?: string;
  internalDate?: string;
  sizeEstimate?: number;
  payload?: GPart;
}

const kopfWert = (headers: GPart['headers'] | undefined, name: string): string | undefined => headers?.find(h => h.name.toLowerCase() === name.toLowerCase())?.value;
const charsetVon = (ct: string | undefined): string | undefined => /charset\s*=\s*"?([^";\s]+)"?/i.exec(ct ?? '')?.[1];
const istAnhang = (p: GPart): boolean => {
  const dispo = kopfWert(p.headers, 'Content-Disposition') ?? '';
  return !!(p.filename && p.filename.trim()) || /^\s*attachment/i.test(dispo) || (!!p.body?.attachmentId && !/^text\/(plain|html)$/i.test(p.mimeType ?? ''));
};

/** Körper eines Teils als Text (Zeichensatz des Teils). */
function teilText(p: GPart): string {
  if (!p.body?.data) return '';
  return zeichensatzLesen(base64urlBytes(p.body.data), charsetVon(kopfWert(p.headers, 'Content-Type')));
}

interface TextErgebnis { text: string; bilder: number }
function textSammeln(p: GPart): TextErgebnis {
  const mt = (p.mimeType ?? '').toLowerCase();
  if (istAnhang(p)) return { text: '', bilder: 0 };
  if (mt === 'text/plain') return { text: teilText(p).replace(/\r\n?/g, '\n'), bilder: 0 };
  if (mt === 'text/html') { const h = htmlZuText(teilText(p)); return { text: h.text, bilder: h.bilder }; }
  if (mt.startsWith('multipart/')) {
    const kinder = (p.parts ?? []).map(textSammeln);
    if (mt === 'multipart/alternative') {
      // Die Alternativen sagen dasselbe: text/plain, wenn es etwas enthält, sonst das aus HTML Gewonnene.
      const plain = (p.parts ?? []).findIndex(k => (k.mimeType ?? '').toLowerCase() === 'text/plain' && !istAnhang(k) && kinder[(p.parts ?? []).indexOf(k)].text.trim());
      const bilder = kinder.reduce((n, k) => n + k.bilder, 0);
      if (plain >= 0) return { text: kinder[plain].text, bilder };
      const eins = kinder.find(k => k.text.trim());
      return { text: eins?.text ?? '', bilder };
    }
    return { text: kinder.map(k => k.text.trim()).filter(Boolean).join('\n\n'), bilder: kinder.reduce((n, k) => n + k.bilder, 0) };
  }
  return { text: '', bilder: 0 };
}

function anhaengeSammeln(p: GPart, raus: Anhang[], pfad: string): void {
  if (raus.length >= GMAIL_GRENZEN.anhaengeMax) return;
  const mt = (p.mimeType ?? 'application/octet-stream').toLowerCase();
  if (!mt.startsWith('multipart/') && istAnhang(p)) {
    const cid = kopfWert(p.headers, 'Content-ID');
    const dispo = kopfWert(p.headers, 'Content-Disposition') ?? '';
    const name = rfc2047Lesen(p.filename ?? '').replace(/[\u0000-\u001f\u007f/\\]+/g, ' ').trim().slice(0, 160) || (mt === 'text/calendar' ? 'Termineinladung.ics' : 'Anhang');
    raus.push({ teil: p.partId || pfad, name, typ: mt.slice(0, 100), groesse: Math.max(0, Math.floor(p.body?.size ?? 0)), ...(cid && !/attachment/i.test(dispo) ? { eingebettet: true } : {}) });
  }
  (p.parts ?? []).forEach((k, i) => anhaengeSammeln(k, raus, `${pfad}.${i + 1}`));
}

/** Teil per Kennung finden (für den Abruf eines Anhangs: die aktuelle `attachmentId` steht im frisch geholten Baum). */
export function teilFinden(p: GPart | undefined, teil: string, pfad = '0'): GPart | null {
  if (!p) return null;
  if ((p.partId ?? pfad) === teil) return p;
  for (const [i, k] of (p.parts ?? []).entries()) { const r = teilFinden(k, teil, `${pfad}.${i + 1}`); if (r) return r; }
  return null;
}

const nachricht = (v: string | undefined, max: number) => zeilenfrei(rfc2047Lesen(v ?? '')).slice(0, max);

/**
 * Eine Nachricht aus Gmail (`format=full`) → Kopf + Text. Wirft nie bei fremdem Inhalt: kaputte Kopfzeilen werden leer,
 * unlesbare Teile übersprungen. Der Text ist reiner Text (nie HTML) und auf `textMax` gekürzt.
 */
export function nachrichtAus(m: GMessage): { kopf: GmailKopf; text: string } {
  const h = m.payload?.headers;
  const ms = Number(m.internalDate);
  const datum = Date.parse(kopfWert(h, 'Date') ?? '');
  const am = new Date(Number.isFinite(ms) && ms > 0 ? ms : Number.isFinite(datum) ? datum : Date.now()).toISOString();
  const von = adressenLesen(kopfWert(h, 'From'), 1)[0] ?? { email: 'unbekannt@invalid.example' };
  const antwortAn = adressenLesen(kopfWert(h, 'Reply-To'), 1)[0];
  const gesammelt = m.payload ? textSammeln(m.payload) : { text: '', bilder: 0 };
  let text = gesammelt.text.replace(/\u0000/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  const gekuerzt = text.length > GMAIL_GRENZEN.textMax;
  if (gekuerzt) text = text.slice(0, GMAIL_GRENZEN.textMax);
  const anhaenge: Anhang[] = [];
  if (m.payload) anhaengeSammeln(m.payload, anhaenge, '0');
  const refs = (kopfWert(h, 'References') ?? '').match(/<[^<>\s]{1,300}>/g) ?? [];
  const listeKopf = kopfWert(h, 'List-Unsubscribe') || /bulk|list|junk/i.test(kopfWert(h, 'Precedence') ?? '');
  const ausschnitt = zeilenfrei(rfc2047Lesen((m.snippet ?? '').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'))).slice(0, GMAIL_GRENZEN.ausschnittMax);
  const kopf: GmailKopf = {
    id: m.id, threadId: m.threadId, am, von,
    an: adressenLesen(kopfWert(h, 'To')), cc: adressenLesen(kopfWert(h, 'Cc')),
    ...(antwortAn && antwortAn.email !== von.email ? { antwortAn } : {}),
    betreff: nachricht(kopfWert(h, 'Subject'), GMAIL_GRENZEN.betreffMax),
    ausschnitt,
    ...(kopfWert(h, 'Message-ID') || kopfWert(h, 'Message-Id') ? { messageId: (/<[^<>\s]{1,300}>/.exec(kopfWert(h, 'Message-ID') ?? kopfWert(h, 'Message-Id') ?? '') ?? [])[0] } : {}),
    ...(/<[^<>\s]{1,300}>/.exec(kopfWert(h, 'In-Reply-To') ?? '') ? { inReplyTo: /<[^<>\s]{1,300}>/.exec(kopfWert(h, 'In-Reply-To') ?? '')![0] } : {}),
    ...(refs.length ? { references: refs.slice(-30) } : {}),
    labels: (m.labelIds ?? []).filter(l => typeof l === 'string' && l.length <= 80).slice(0, 40),
    anhaenge,
    ...(listeKopf ? { liste: true } : {}),
    ...(gesammelt.bilder ? { bilder: gesammelt.bilder } : {}),
    ...(gekuerzt ? { gekuerzt: true } : {}),
    ...(m.sizeEstimate ? { groesse: m.sizeEstimate } : {}),
  };
  if (kopf.messageId === undefined) delete kopf.messageId;
  return { kopf, text };
}

// ── Antwort / neue Mail bauen ───────────────────────────────────────────────

export interface MailEntwurf {
  von: Adr;
  an: Adr[];
  cc?: Adr[];
  betreff: string;
  text: string;
  inReplyTo?: string;
  references?: string[];
  /** Eigene Message-ID (Standard: zufällig auf der Domain des Absenders). */
  messageId?: string;
  datum?: Date;
}

const MID = /^<[^<>\s@]{1,200}@[^<>\s@]{1,200}>$/;
export const messageIdOk = (v: unknown): v is string => typeof v === 'string' && v.length <= 400 && MID.test(v);

/** `Re: …` genau einmal (auch `AW:`/`Re:` am Anfang zählen als schon da). */
export function antwortBetreff(betreff: string): string {
  const b = zeilenfrei(betreff);
  return /^(re|aw|antw)\s*:/i.test(b) ? b : `Re: ${b || '(kein Betreff)'}`;
}

/** Kopfzeile für `References`: die bisherigen (höchstens 30, die letzten) + die Message-ID der beantworteten Mail. */
export function referenzenFuer(vorher: readonly string[] | undefined, messageId: string | undefined): string[] {
  const alle = [...(vorher ?? []), ...(messageId ? [messageId] : [])].filter(messageIdOk);
  return Array.from(new Set(alle)).slice(-30);
}

/** Faltet eine lange Kopfzeile (RFC 5322, Zeile ≤ 78) an Leerzeichen. */
function falten(name: string, wert: string): string {
  const teile = wert.split(' ');
  let zeile = `${name}:`;
  const aus: string[] = [];
  for (const t of teile) {
    if (zeile.length + 1 + t.length > 76 && zeile.trim() !== `${name}:`) { aus.push(zeile); zeile = ` ${t}`; } else zeile += ` ${t}`;
  }
  aus.push(zeile);
  return aus.join('\r\n');
}

/** Die fertige Nachricht (RFC 5322, CRLF). Wirft bei ungültigen Adressen — der Aufrufer prüft vorher mit `adresseGueltig`. */
export function mimeBauen(e: MailEntwurf): string {
  for (const a of [e.von, ...e.an, ...(e.cc ?? [])]) if (!adresseGueltig(a.email)) throw new Error('Ungültige E-Mail-Adresse.');
  if (!e.an.length) throw new Error('Kein Empfänger.');
  const domain = e.von.email.split('@')[1] ?? 'makeinnovation.de';
  const id = e.messageId && messageIdOk(e.messageId) ? e.messageId : `<${bytesBase64url(randomBytes(18))}@${domain}>`;
  const zeilen = [
    falten('From', adresseBauen(e.von)),
    falten('To', e.an.map(adresseBauen).join(', ')),
    ...(e.cc?.length ? [falten('Cc', e.cc.map(adresseBauen).join(', '))] : []),
    falten('Subject', rfc2047Bauen(e.betreff || '(kein Betreff)')),
    `Date: ${(e.datum ?? new Date()).toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: ${id}`,
    ...(e.inReplyTo && messageIdOk(e.inReplyTo) ? [`In-Reply-To: ${e.inReplyTo}`] : []),
    ...(e.references?.filter(messageIdOk).length ? [falten('References', e.references.filter(messageIdOk).join(' '))] : []),
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: quoted-printable',
  ];
  return `${zeilen.join('\r\n')}\r\n\r\n${quotedPrintableBauen(e.text.replace(/\s+$/, ''))}\r\n`;
}

// ── Rohformat lesen (RFC 822) ───────────────────────────────────────────────

export interface Rfc822 {
  /** Kopfzeilen (Name klein) → Werte, entfaltet, NICHT RFC-2047-aufgelöst. */
  kopf: Record<string, string[]>;
  /** Körper eines einteiligen text/plain bzw. der erste text/plain-Teil — Transfer-Encoding und Zeichensatz aufgelöst. */
  text: string;
}

function koepfeTeilen(roh: string): { kopf: Record<string, string[]>; rest: string } {
  const norm = roh.replace(/\r\n/g, '\n');
  const i = norm.indexOf('\n\n');
  const kopfText = i >= 0 ? norm.slice(0, i) : norm;
  const rest = i >= 0 ? norm.slice(i + 2) : '';
  const kopf: Record<string, string[]> = {};
  const entfaltet = kopfText.replace(/\n[ \t]+/g, ' ');
  for (const z of entfaltet.split('\n')) {
    const k = z.indexOf(':');
    if (k <= 0) continue;
    const name = z.slice(0, k).trim().toLowerCase();
    (kopf[name] ??= []).push(z.slice(k + 1).trim());
  }
  return { kopf, rest };
}

function koerperLesen(kopf: Record<string, string[]>, rest: string, tiefe = 0): string {
  const ct = kopf['content-type']?.[0] ?? 'text/plain';
  const cte = (kopf['content-transfer-encoding']?.[0] ?? '7bit').toLowerCase();
  const mt = ct.split(';')[0].trim().toLowerCase();
  if (mt.startsWith('multipart/') && tiefe < 5) {
    const grenze = /boundary\s*=\s*"?([^";]+)"?/i.exec(ct)?.[1];
    if (!grenze) return '';
    const teile = rest.split(`--${grenze}`).slice(1).filter(t => !t.startsWith('--'));
    for (const t of teile) {
      const s = koepfeTeilen(t.replace(/^\r?\n/, ''));
      const m = (s.kopf['content-type']?.[0] ?? 'text/plain').split(';')[0].trim().toLowerCase();
      if (m === 'text/plain' || m.startsWith('multipart/')) { const x = koerperLesen(s.kopf, s.rest, tiefe + 1); if (x.trim()) return x; }
    }
    return '';
  }
  if (mt !== 'text/plain') return '';
  const bytes = cte === 'base64' ? Buffer.from(rest.replace(/\s+/g, ''), 'base64') : cte === 'quoted-printable' ? quotedPrintableLesen(rest) : Buffer.from(rest, 'utf8');
  const text = zeichensatzLesen(bytes, charsetVon(ct));
  return text.replace(/\n$/, '');
}

/** Eine Rohnachricht (RFC 822) lesen: Kopfzeilen + Text. */
export function rfc822Lesen(roh: string): Rfc822 {
  const { kopf, rest } = koepfeTeilen(roh);
  return { kopf, text: koerperLesen(kopf, rest) };
}
