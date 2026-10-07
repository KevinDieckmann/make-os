// ─── Postfächer — die Leitung zu IMAP und SMTP (Server, 06.10.2026) ───────────────────────────────────────────────
// EINE schmale Schnittstelle (`ImapSitzung`, `SmtpSender`, `ImapWaechter`) zwischen der Inbox und dem Netz. Echt über
//   · imapflow (IMAP: TLS, LOGIN, LIST mit SPECIAL-USE, UID SEARCH/FETCH/STORE/MOVE, APPEND, IDLE) und
//   · nodemailer (SMTP: SSL 465 bzw. STARTTLS 587, Anmeldung, die Nachricht geht als fertige Rohnachricht raus — gebaut von
//     `mimeBauen`, derselben Stelle wie bei Gmail).
// Warum Pakete statt eigenem Code (Abhängigkeit begründet, UPDATES.md 06.10.): IMAP-Antworten mit Literalen, IDLE, STARTTLS und
// SASL sind sicherheitskritisch und voller Randfälle; imapflow und nodemailer kommen vom selben, seit Jahren gepflegten Autor
// (MIT/MIT-0), nodemailer hat keine weiteren Abhängigkeiten. Versionen sind fest gepinnt (package.json), Protokoll aus (`logger: false`).
//
// Sicherheit:
//   · Nur TLS (IMAP immer 993/SSL bzw. STARTTLS nur wenn ausdrücklich), TLS ≥ 1.2, Zertifikat wird geprüft (Node-Standard).
//   · Kein Ziel im eigenen Netz (Server-Anfragefälschung): der Hostname wird aufgelöst; Loopback, private, link-lokale und
//     Carrier-NAT-Adressen werden abgelehnt (`zielPruefen`).
//   · Zugangsdaten nur im Speicher dieses Aufrufs — nie in Fehlertexten, nie im Protokoll.
// Tests und die Demo-Instanz setzen eigene Leitungen (`transportSetzen`); im Betrieb gibt es keinen anderen Weg.

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import type { StrukturKnoten } from './rfc822';

export type FehlerCode = 'anmeldung' | 'netz' | 'tls' | 'zeit' | 'server' | 'ziel' | 'ordner' | 'abgelehnt';

/** Ein Fehler der Leitung — die Meldung ist für Menschen und enthält nie Zugangsdaten oder Mailinhalt. */
export class PostfachFehler extends Error {
  constructor(public code: FehlerCode, message: string, public status = 409) { super(message); }
}

export const FEHLER_TEXT: Record<FehlerCode, string> = {
  anmeldung: 'Der Anbieter hat die Anmeldung abgelehnt — Adresse und Passwort prüfen (bei iCloud ein App-spezifisches Passwort).',
  netz: 'Der Server des Anbieters ist gerade nicht erreichbar.',
  tls: 'Die gesicherte Verbindung zum Anbieter kam nicht zustande (Zertifikat oder TLS).',
  zeit: 'Der Anbieter hat zu lange nicht geantwortet.',
  server: 'Der Anbieter hat die Anfrage nicht angenommen.',
  ziel: 'Diese Serveradresse ist nicht erlaubt.',
  ordner: 'Im Postfach fehlt ein Ordner, den MAKE OS braucht.',
  abgelehnt: 'Der Anbieter hat die Mail nicht angenommen.',
};

export interface ImapZugang { host: string; port: number; benutzer: string; passwort: string; demo?: { person: string; postfach: string } }
export interface SmtpZugang { host: string; port: number; sicherheit: 'ssl' | 'starttls'; benutzer: string; passwort: string; demo?: { person: string; postfach: string } }

export interface OrdnerInfo { pfad: string; specialUse?: string }
export interface OrdnerStand { uidValidity: string; uidNext: number; anzahl: number }
export interface Abruf { uid: number; flags: string[]; internalDate?: string; groesse?: number; quelle: Buffer; struktur?: StrukturKnoten }

/** Eine angemeldete IMAP-Sitzung. Methoden ab `oeffnen` beziehen sich auf den geöffneten Ordner. */
export interface ImapSitzung {
  /** Bietet der Server IDLE an? */
  idle: boolean;
  ordnerListe(): Promise<OrdnerInfo[]>;
  oeffnen(pfad: string, schreiben?: boolean): Promise<OrdnerStand>;
  /** UIDs im Ordner, optional erst ab einem Tag (SEARCH SINCE). */
  uids(seitTag?: string): Promise<number[]>;
  /** Nachrichten holen: Flags, Eingang, Größe, BODYSTRUCTURE und die Quelle bis `quelleMax` Byte. */
  holen(uids: readonly number[], quelleMax: number): Promise<Abruf[]>;
  flags(uids: readonly number[]): Promise<{ uid: number; flags: string[] }[]>;
  flagsAendern(uids: readonly number[], hinzu: readonly string[], weg: readonly string[]): Promise<void>;
  verschieben(uids: readonly number[], ziel: string): Promise<void>;
  ordnerAnlegen(pfad: string): Promise<void>;
  anhaengen(pfad: string, roh: Buffer, flags: readonly string[]): Promise<void>;
  /** UIDs mit dieser Message-ID im geöffneten Ordner. */
  sucheMessageId(messageId: string): Promise<number[]>;
  /** Einen Teil (Anhang) holen — Transfer-Encoding aufgelöst. */
  teil(uid: number, teil: string, max: number): Promise<{ bytes: Buffer; typ?: string }>;
  schliessen(): Promise<void>;
}

export type ImapOeffner = (z: ImapZugang) => Promise<ImapSitzung>;
export type SmtpSender = (z: SmtpZugang, umschlag: { von: string; an: readonly string[] }, roh: Buffer) => Promise<{ angenommen: string[] }>;
/** IDLE: hält eine Verbindung auf dem Posteingang offen und ruft `neu`, sobald Post kommt; `ende` bei Abbruch. */
export type ImapWaechter = (z: ImapZugang, pfad: string, neu: () => void, ende: (e?: unknown) => void) => Promise<{ stop: () => Promise<void> }>;

// ── Ziel prüfen ─────────────────────────────────────────────────────────────

/** Ist diese IP-Adresse im eigenen/privaten Netz? Rein. */
export function ipIntern(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  if (v === 6) {
    const x = ip.toLowerCase();
    if (x === '::1' || x === '::') return true;
    if (x.startsWith('::ffff:')) return ipIntern(x.slice(7));
    return /^f[cd]/.test(x) || /^fe[89ab]/.test(x) || x.startsWith('ff');
  }
  return true;
}

/** Hostname auflösen und Ziele im eigenen Netz ablehnen. */
export async function zielPruefen(host: string): Promise<void> {
  let adressen: { address: string }[];
  try { adressen = await lookup(host, { all: true }); } catch { throw new PostfachFehler('netz', `Den Server „${host.slice(0, 80)}“ gibt es nicht (DNS).`); }
  if (!adressen.length || adressen.some(a => ipIntern(a.address))) throw new PostfachFehler('ziel', FEHLER_TEXT.ziel, 400);
}

// ── Fehler übersetzen ───────────────────────────────────────────────────────

/** Fehler aus imapflow/nodemailer/Netz → `PostfachFehler` (nie mit Zugangsdaten). Rein. */
export function fehlerUebersetzen(e: unknown): PostfachFehler {
  if (e instanceof PostfachFehler) return e;
  const x = (e ?? {}) as { code?: string; authenticationFailed?: boolean; responseCode?: number; responseText?: string; serverResponseCode?: string; message?: string };
  const code = String(x.code ?? '');
  const text = String(x.message ?? '');
  if (x.authenticationFailed || code === 'EAUTH' || x.serverResponseCode === 'AUTHENTICATIONFAILED' || /AUTHENTICATIONFAILED|authentication failed|invalid credentials|LOGIN failed/i.test(text)) return new PostfachFehler('anmeldung', FEHLER_TEXT.anmeldung);
  if (/^(ETIMEDOUT|ETIMEOUT|ESOCKETTIMEDOUT|NoConnection|ConnectionTimeout|GreetingTimeout)$/i.test(code) || /timed? ?out|zeitüberschreitung/i.test(text)) return new PostfachFehler('zeit', FEHLER_TEXT.zeit, 503);
  if (/CERT|SSL|TLS|SELF_SIGNED|UNABLE_TO_VERIFY|ERR_TLS/i.test(code) || /certificate|ssl|tls handshake/i.test(text)) return new PostfachFehler('tls', FEHLER_TEXT.tls);
  if (/^(ENOTFOUND|ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENETUNREACH|EPIPE|ECONNECTION|ESOCKET|EAI_AGAIN)$/i.test(code)) return new PostfachFehler('netz', FEHLER_TEXT.netz, 503);
  if (x.responseCode && x.responseCode >= 500) return new PostfachFehler('abgelehnt', `${FEHLER_TEXT.abgelehnt} (${x.responseCode})`, 502);
  return new PostfachFehler('server', FEHLER_TEXT.server, 502);
}

// ── Echte Leitungen (imapflow / nodemailer) ─────────────────────────────────

const ZEIT = { verbindung: 20_000, gruss: 15_000, socket: 120_000 } as const;
const SEARCH_TAG = (tag: string) => new Date(`${tag}T00:00:00Z`);

async function imapflowOeffnen(z: ImapZugang): Promise<ImapSitzung> {
  await zielPruefen(z.host);
  const { ImapFlow } = await import('imapflow');
  const c = new ImapFlow({
    host: z.host, port: z.port, secure: true, auth: { user: z.benutzer, pass: z.passwort }, logger: false, emitLogs: false,
    disableAutoIdle: true, tls: { minVersion: 'TLSv1.2', servername: z.host }, clientInfo: { name: 'MAKE OS' },
    connectionTimeout: ZEIT.verbindung, greetingTimeout: ZEIT.gruss, socketTimeout: ZEIT.socket,
  });
  c.on('error', () => { /* Fehler kommen über die Aufrufe; ohne Hörer würde der Prozess abstürzen */ });
  try { await c.connect(); } catch (e) { c.close(); throw fehlerUebersetzen(e); }
  const leite = async <T>(f: () => Promise<T>): Promise<T> => { try { return await f(); } catch (e) { throw fehlerUebersetzen(e); } };
  const uidListe = (u: readonly number[]) => u.join(',');
  return {
    idle: c.capabilities.has('IDLE'),
    ordnerListe: () => leite(async () => (await c.list()).map(l => ({ pfad: l.path, ...(l.specialUse ? { specialUse: l.specialUse } : {}) }))),
    oeffnen: (pfad, schreiben = false) => leite(async () => { const m = await c.mailboxOpen(pfad, { readOnly: !schreiben }); return { uidValidity: String(m.uidValidity), uidNext: m.uidNext, anzahl: m.exists }; }),
    uids: seitTag => leite(async () => { const r = await c.search(seitTag ? { since: SEARCH_TAG(seitTag) } : { all: true }, { uid: true }); return Array.isArray(r) ? r : []; }),
    holen: (uids, quelleMax) => leite(async () => {
      if (!uids.length) return [];
      const raus: Abruf[] = [];
      for await (const m of c.fetch(uidListe(uids), { uid: true, flags: true, internalDate: true, size: true, bodyStructure: true, source: { maxLength: quelleMax } }, { uid: true })) {
        raus.push({ uid: m.uid, flags: Array.from(m.flags ?? []), ...(m.internalDate ? { internalDate: new Date(m.internalDate).toISOString() } : {}), ...(m.size ? { groesse: m.size } : {}), quelle: m.source ?? Buffer.alloc(0), ...(m.bodyStructure ? { struktur: m.bodyStructure as unknown as StrukturKnoten } : {}) });
      }
      return raus;
    }),
    flags: uids => leite(async () => {
      if (!uids.length) return [];
      const raus: { uid: number; flags: string[] }[] = [];
      for await (const m of c.fetch(uidListe(uids), { uid: true, flags: true }, { uid: true })) raus.push({ uid: m.uid, flags: Array.from(m.flags ?? []) });
      return raus;
    }),
    flagsAendern: (uids, hinzu, weg) => leite(async () => {
      if (!uids.length) return;
      if (hinzu.length) await c.messageFlagsAdd(uidListe(uids), [...hinzu], { uid: true });
      if (weg.length) await c.messageFlagsRemove(uidListe(uids), [...weg], { uid: true });
    }),
    verschieben: (uids, ziel) => leite(async () => { if (uids.length) await c.messageMove(uidListe(uids), ziel, { uid: true }); }),
    ordnerAnlegen: pfad => leite(async () => { await c.mailboxCreate(pfad); }),
    anhaengen: (pfad, roh, flags) => leite(async () => { await c.append(pfad, roh, [...flags]); }),
    sucheMessageId: mid => leite(async () => { const r = await c.search({ header: { 'message-id': mid } }, { uid: true }); return Array.isArray(r) ? r : []; }),
    teil: (uid, teil, max) => leite(async () => {
      const d = await c.download(String(uid), teil, { uid: true, maxBytes: max });
      if (!('content' in d) || !d.content) throw new PostfachFehler('server', 'Diesen Anhang gibt es nicht (mehr).', 404);
      const stuecke: Buffer[] = [];
      let n = 0;
      for await (const s of d.content as AsyncIterable<Buffer>) { n += s.length; if (n > max) throw new PostfachFehler('server', 'Der Anhang ist zu groß.', 413); stuecke.push(s); }
      return { bytes: Buffer.concat(stuecke), ...(d.meta?.contentType ? { typ: d.meta.contentType } : {}) };
    }),
    schliessen: async () => { try { await c.logout(); } catch { c.close(); } },
  };
}

const smtpEcht: SmtpSender = async (z, umschlag, roh) => {
  await zielPruefen(z.host);
  const nodemailer = await import('nodemailer');
  const t = nodemailer.createTransport({
    host: z.host, port: z.port, secure: z.sicherheit === 'ssl', requireTLS: z.sicherheit === 'starttls', auth: { user: z.benutzer, pass: z.passwort },
    connectionTimeout: ZEIT.verbindung, greetingTimeout: ZEIT.gruss, socketTimeout: 60_000, tls: { minVersion: 'TLSv1.2', servername: z.host }, logger: false, debug: false,
  });
  try {
    const r = await t.sendMail({ envelope: { from: umschlag.von, to: [...umschlag.an] }, raw: roh });
    return { angenommen: ((r.accepted ?? []) as (string | { address: string })[]).map(a => (typeof a === 'string' ? a : a.address)) };
  } catch (e) { throw fehlerUebersetzen(e); } finally { t.close(); }
};

const waechterEcht: ImapWaechter = async (z, pfad, neu, ende) => {
  await zielPruefen(z.host);
  const { ImapFlow } = await import('imapflow');
  // Eigene Verbindung NUR für IDLE: imapflow geht nach dem Öffnen von selbst in IDLE und erneuert es alle 25 Min. (RFC 2177: < 29).
  const c = new ImapFlow({ host: z.host, port: z.port, secure: true, auth: { user: z.benutzer, pass: z.passwort }, logger: false, emitLogs: false, maxIdleTime: 25 * 60_000, tls: { minVersion: 'TLSv1.2', servername: z.host }, connectionTimeout: ZEIT.verbindung, greetingTimeout: ZEIT.gruss, socketTimeout: 35 * 60_000 });
  let gestoppt = false;
  c.on('error', e => { if (!gestoppt) ende(e); });
  c.on('close', () => { if (!gestoppt) ende(); });
  c.on('exists', () => neu());
  try { await c.connect(); await c.mailboxOpen(pfad, { readOnly: true }); } catch (e) { gestoppt = true; c.close(); throw fehlerUebersetzen(e); }
  return { stop: async () => { gestoppt = true; try { await c.logout(); } catch { c.close(); } } };
};

// ── Auswahl der Leitung (echt · Demo · Test) ────────────────────────────────

interface Leitungen { imap: ImapOeffner; smtp: SmtpSender; waechter: ImapWaechter }
const ECHT: Leitungen = { imap: imapflowOeffnen, smtp: smtpEcht, waechter: waechterEcht };
let gesetzt: Partial<Leitungen> | null = null;

/** Nur Tests: eigene Leitungen setzen (Fakes). `null` = zurück auf echt. */
export function transportSetzen(l: Partial<Leitungen> | null): void { gesetzt = l; }

/** Die Leitungen für ein Postfach: Demo-Postfächer (nur Demo-Instanz) laufen über die erfundene Post, sonst echt bzw. Test. */
export async function leitungen(demo: boolean): Promise<Leitungen> {
  if (gesetzt) return { ...ECHT, ...gesetzt };
  if (demo) {
    if (process.env.MAKE_OS_DEMO !== '1') throw new PostfachFehler('ziel', 'Demo-Postfächer gibt es nur in der Demo-Instanz.', 400);
    const d = await import('./demo-post');
    return { imap: d.demoImap, smtp: d.demoSmtp, waechter: d.demoWaechter };
  }
  return ECHT;
}
