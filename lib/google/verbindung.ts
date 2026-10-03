// ─── Google — EINE Verbindung je Person (Server, 03.10.2026) ─────────────────
// Kevin 03.10.: „Wir haben nur den Kalender bei Google für MAKE und alles andere läuft über MAKE OS.“ — je Person eine
// feste Verbindung zum Google-Workspace-Konto (Domain makeinnovation.de). Diese Datei ist der ALLGEMEINE Unterbau und
// kennt keinen Kalender: OAuth 2.0 (Authorization-Code + PKCE + `state`), Token-Bestand, Erneuern, Widerruf, Domain-
// Prüfung, Scope-Verwaltung. Der Kalender-Abgleich (lib/kalender/google/*) und Gmail (lib/gmail/*, seit 03.10.) setzen darauf
// auf — jedes weitere Google-Modul trägt sich nur in `GOOGLE_FUNKTIONEN` ein und holt sein Token über `googleZugriffstoken`.
//
// Inkrementelle Autorisierung: Scopes gehören zu FUNKTIONEN und werden einzeln zugeschaltet. Jede Anmeldung schickt
// `include_granted_scopes=true` — Google ergänzt die neuen Scopes zu den bereits gewährten, es bleibt EINE Verbindung und
// EIN Refresh-Token je Person (`scopes` im Bestand = Vereinigung). `googleZugriffstoken(person, funktion)` prüft, dass die
// Scopes der Funktion gewährt sind, sonst `GoogleVerbindungsFehler('scope-fehlt')`.
//
// Sicherheit:
//   · Tokens nur serverseitig, verschlüsselt im Bestand `google-verbindung--<person>` (lib/store/local-db.ts) — nie an den
//     Browser, nie in Protokolle/Fehlertexte. Die Oberfläche bekommt nur `googleStatus` (maskierte Adresse, Zustände).
//   · PKCE (S256) + `state` (32 Zufallsbytes, einmalig, 15 Min.) im Bestand `google-oauth-zustand`; der Rückruf gilt nur der
//     PERSON, die ihn gestartet hat (Sitzung) — eine fremde Sitzung kann einen fremden Code nicht einlösen.
//   · Domain: `GOOGLE_ERLAUBTE_DOMAIN` (z. B. makeinnovation.de) — E-Mail UND `hd`-Anspruch müssen passen (gmail.com hat
//     kein `hd`); sonst wird das Token SOFORT bei Google widerrufen und nichts gespeichert.
//   · Zugangsdaten gehen nur an accounts.google.com, oauth2.googleapis.com und www.googleapis.com.
//
// Umgebung (Server-.env, nie im Repo): GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_RUECKRUF_URL (sonst
// `MAKE_OS_ADRESSE` + /api/google/rueckruf), GOOGLE_ERLAUBTE_DOMAIN. Ohne ID/Secret ist alles sichtbar aus („noch nicht
// eingerichtet“) — nichts bricht. Die Funktionen sind neue, optionale Bestände: ein Rückweg auf den alten Online-Stand
// liest sie nie (GO_LIVE_CHECKLISTE.md).

import { createHash, randomBytes } from 'node:crypto';
import { loadJson, saveJson, updateJson } from '@/lib/store/local-db';
import { adresseMaskiert } from '@/lib/zugang/konten';

// ── Funktionen und ihre Scopes ──────────────────────────────────────────────

/**
 * Was MAKE OS von Google nutzen darf — je Funktion die Scopes, minimal.
 *   basis      `openid email`: nur um die Adresse des Kontos zu erfahren (Domain-Prüfung, Anzeige). Keine Daten.
 *   kalender   `calendar.events` (Termine lesen, anlegen, ändern, löschen) + `calendar.readonly` (die Kalenderliste, um
 *              den Kalender zu wählen). Kein `calendar` (Kalender anlegen/löschen/Freigaben) — das braucht MAKE OS nie.
 *   gmail      NUR `gmail.modify` (03.10.): Nachrichten lesen, als gelesen markieren, Labels setzen (Archivieren), senden
 *              (`users.messages.send` akzeptiert `gmail.modify`), `history.list`, `users.watch`, `sendAs.list`, Anhänge lesen.
 *              Bewusst NICHT `mail.google.com/` (Vollzugriff inkl. endgültigem Löschen) und kein zusätzliches `gmail.send`
 *              (wäre durch `gmail.modify` schon abgedeckt, nur ein weiterer Haken). `gmail.modify` kann Nachrichten nicht
 *              endgültig löschen und keine Einstellungen (Weiterleitung, Filter, Delegation) ändern.
 * Ein weiteres Modul trägt sich hier ein: `xyz: { scopes: [...], text: '…' }` — Rest unverändert.
 */
export const GOOGLE_FUNKTIONEN = {
  basis: { scopes: ['openid', 'email'], text: 'Adresse des Kontos prüfen' },
  kalender: { scopes: ['https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/calendar.readonly'], text: 'Kalender: Termine lesen und schreiben' },
  gmail: { scopes: ['https://www.googleapis.com/auth/gmail.modify'], text: 'Gmail: Mails lesen, zuordnen, Antworten senden (nur auf Klick)' },
} as const satisfies Record<string, { scopes: readonly string[]; text: string }>;
export type GoogleFunktion = keyof typeof GOOGLE_FUNKTIONEN;
export const istGoogleFunktion = (v: unknown): v is GoogleFunktion => typeof v === 'string' && Object.prototype.hasOwnProperty.call(GOOGLE_FUNKTIONEN, v);

/** Die Scopes zu einer Liste von Funktionen (`basis` immer dabei) — ohne Doppelte. */
export function scopesFuer(funktionen: readonly GoogleFunktion[]): string[] {
  return Array.from(new Set(['basis' as GoogleFunktion, ...funktionen].flatMap(f => GOOGLE_FUNKTIONEN[f].scopes)));
}
/** Google meldet `email` als `…/auth/userinfo.email` zurück (und `profile` entsprechend) — beide Schreibweisen sind derselbe Scope. */
const SCOPE_ALIAS: Record<string, string> = { email: 'https://www.googleapis.com/auth/userinfo.email', profile: 'https://www.googleapis.com/auth/userinfo.profile' };
export const scopeNorm = (s: string): string => SCOPE_ALIAS[s] ?? s;
/** Welche Scopes einer Funktion fehlen im gewährten Satz? */
export function scopesFehlen(gewaehrt: readonly string[], noetig: readonly string[]): string[] {
  const g = new Set(gewaehrt.map(scopeNorm));
  return noetig.filter(s => !g.has(scopeNorm(s)));
}

// ── Konfiguration ───────────────────────────────────────────────────────────

export interface GoogleKonfig { clientId: string; clientSecret: string; rueckrufUrl: string; erlaubteDomain: string | null }

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
/** Hierhin dürfen Google-Zugangsdaten gehen — sonst nirgends. `gmail.googleapis.com` = die Gmail API (03.10.). */
export const GOOGLE_HOSTS: readonly string[] = ['accounts.google.com', 'oauth2.googleapis.com', 'www.googleapis.com', 'gmail.googleapis.com'];
export const googleHost = (u: string): boolean => { try { const x = new URL(u); return x.protocol === 'https:' && GOOGLE_HOSTS.includes(x.hostname); } catch { return false; } };

export const RUECKRUF_PFAD = '/api/google/rueckruf';

const domainSauber = (v: string | undefined): string | null => {
  const d = (v ?? '').trim().toLowerCase().replace(/^@/, '');
  return /^[a-z0-9]([a-z0-9.-]{0,60}[a-z0-9])?\.[a-z]{2,24}$/.test(d) ? d : null;
};

/** Die Konfiguration aus der Umgebung — null, solange ID oder Secret fehlen. */
export function googleKonfig(): GoogleKonfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  const adresse = (process.env.MAKE_OS_ADRESSE ?? '').trim().replace(/\/+$/, '') || 'http://localhost:3001';
  const rueckrufUrl = (process.env.GOOGLE_RUECKRUF_URL ?? '').trim() || `${adresse}${RUECKRUF_PFAD}`;
  return { clientId, clientSecret, rueckrufUrl, erlaubteDomain: domainSauber(process.env.GOOGLE_ERLAUBTE_DOMAIN) };
}
export const googleKonfiguriert = (): boolean => googleKonfig() !== null;

// ── Fehler ──────────────────────────────────────────────────────────────────

export type VerbindungsFehlerCode = 'nicht-konfiguriert' | 'nicht-verbunden' | 'getrennt' | 'scope-fehlt' | 'domain' | 'state' | 'token' | 'netz' | 'abgebrochen' | 'person';
export class GoogleVerbindungsFehler extends Error {
  constructor(public code: VerbindungsFehlerCode, message: string, public status = 409) { super(message); }
}
const TEXT: Record<VerbindungsFehlerCode, string> = {
  'nicht-konfiguriert': 'Google ist noch nicht eingerichtet (GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET fehlen in der Server-Umgebung).',
  'nicht-verbunden': 'Google ist für diese Person nicht verbunden.',
  getrennt: 'Die Google-Verbindung ist getrennt — bitte neu verbinden.',
  'scope-fehlt': 'Für diese Funktion fehlt eine Freigabe bei Google — bitte neu verbinden und alle Häkchen setzen.',
  domain: 'Dieses Google-Konto gehört nicht zur erlaubten Domain.',
  state: 'Die Anmeldung ist abgelaufen oder ungültig — bitte noch einmal starten.',
  token: 'Google hat den Code nicht angenommen.',
  netz: 'Google ist gerade nicht erreichbar.',
  abgebrochen: 'Die Anmeldung bei Google wurde abgebrochen.',
  person: 'Diese Verbindung gehört einer anderen Person.',
};
export const verbindungsText = (c: VerbindungsFehlerCode): string => TEXT[c];

// ── Bestand ─────────────────────────────────────────────────────────────────

/** Bestand je Person — nur auf dem Server, verschlüsselt. Nie ausliefern. */
export interface GoogleVerbindung {
  v: 1;
  email: string;
  /** `hd`-Anspruch (Workspace-Domain) — leer bei privaten Konten. */
  hd?: string;
  refreshToken: string;
  accessToken?: string;
  /** Ablauf des Zugriffstokens (ms). */
  ablauf?: number;
  /** Gewährte Scopes (Vereinigung aller Anmeldungen). */
  scopes: string[];
  /** Zugeschaltete Funktionen (gewollt) — `basis` immer. */
  funktionen: GoogleFunktion[];
  verbundenAm: string;
  erneuertAm?: string;
  status: 'verbunden' | 'getrennt';
  getrenntGrund?: string;
  getrenntAm?: string;
}

/** Bestandsname je Person (kein Sonderfall für „kevin“). */
export const verbindungName = (person: string) => `google-verbindung--${person}`;
const ZUSTAND = 'google-oauth-zustand';
const PERSON = /^[a-z0-9-]{1,40}$/;
const personOk = (p: string) => PERSON.test(p);

export async function ladeVerbindung(person: string): Promise<GoogleVerbindung | null> {
  if (!personOk(person)) return null;
  const v = await loadJson<GoogleVerbindung>(verbindungName(person));
  return v && v.v === 1 && typeof v.refreshToken === 'string' ? v : null;
}

// ── Reine Helfer (getestet) ─────────────────────────────────────────────────

const b64url = (b: Buffer) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** PKCE-Paar (RFC 7636, S256): 32 Zufallsbytes als Verifier. */
export function pkcePaar(): { verifier: string; challenge: string } {
  const verifier = b64url(randomBytes(32));
  return { verifier, challenge: b64url(createHash('sha256').update(verifier).digest()) };
}
export const challengeZu = (verifier: string): string => b64url(createHash('sha256').update(verifier).digest());

export interface AutorisierungsEingabe { konfig: GoogleKonfig; state: string; challenge: string; scopes: readonly string[]; loginHint?: string }
/** Die Adresse der Google-Anmeldeseite (Authorization-Code, PKCE, offline, Zustimmung, bereits gewährte Scopes behalten). */
export function autorisierungsUrl(e: AutorisierungsEingabe): string {
  const u = new URL(AUTH_URL);
  const p = u.searchParams;
  p.set('client_id', e.konfig.clientId);
  p.set('redirect_uri', e.konfig.rueckrufUrl);
  p.set('response_type', 'code');
  p.set('scope', e.scopes.join(' '));
  p.set('state', e.state);
  p.set('code_challenge', e.challenge);
  p.set('code_challenge_method', 'S256');
  p.set('access_type', 'offline');
  p.set('prompt', 'consent');
  p.set('include_granted_scopes', 'true');
  if (e.konfig.erlaubteDomain) p.set('hd', e.konfig.erlaubteDomain);
  if (e.loginHint) p.set('login_hint', e.loginHint);
  return u.toString();
}

/** Nutzlast eines JWT (id_token) — ohne Signaturprüfung: wir bekommen es direkt vom Token-Endpunkt über TLS (Google-Vorgabe). */
export function jwtNutzlast(token: string | undefined | null): Record<string, unknown> | null {
  const teile = String(token ?? '').split('.');
  if (teile.length < 2) return null;
  try { const j = JSON.parse(Buffer.from(teile[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')); return j && typeof j === 'object' ? j as Record<string, unknown> : null; } catch { return null; }
}

/**
 * Passt das Konto zur erlaubten Domain? Ohne Einstellung: ja. Mit: die Adresse endet auf @domain UND der `hd`-Anspruch
 * ist genau diese Domain (private Konten haben keinen) UND die Adresse ist von Google bestätigt.
 */
export function domainPasst(konto: { email?: string; hd?: string; emailBestaetigt?: boolean }, erlaubt: string | null): boolean {
  if (!erlaubt) return true;
  const mail = (konto.email ?? '').trim().toLowerCase();
  const d = erlaubt.toLowerCase();
  return mail.endsWith(`@${d}`) && (konto.hd ?? '').trim().toLowerCase() === d && konto.emailBestaetigt !== false;
}

// ── Zugriff auf Google (nur diese Hosts) ────────────────────────────────────

async function tokenAnfrage(url: string, koerper: URLSearchParams): Promise<{ status: number; json: Record<string, unknown> }> {
  if (!googleHost(url)) throw new GoogleVerbindungsFehler('netz', 'Unerwartete Adresse — Abbruch (Zugang geht nur an Google).', 502);
  let r: Response;
  try {
    r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: koerper.toString(), signal: AbortSignal.timeout(25_000), redirect: 'error' });
  } catch { throw new GoogleVerbindungsFehler('netz', TEXT.netz, 503); }
  let json: Record<string, unknown> = {};
  try { const j = await r.json(); if (j && typeof j === 'object') json = j as Record<string, unknown>; } catch { /* leere Antwort */ }
  return { status: r.status, json };
}

/** Bei Google widerrufen (Refresh- oder Zugriffstoken) — true, wenn Google es bestätigt hat. Wirft nie. */
export async function tokenWiderrufen(token: string): Promise<boolean> {
  try { return (await tokenAnfrage(REVOKE_URL, new URLSearchParams({ token }))).status === 200; } catch { return false; }
}

// ── Anmelden: Start und Rückruf ─────────────────────────────────────────────

interface ZustandBestand { eintraege: Record<string, { person: string; verifier: string; funktionen: GoogleFunktion[]; at: number; /** Was DIESE Anmeldung neu wollte (ohne `basis`) — der Rückruf richtet nur das ein. */ angefordert?: GoogleFunktion[] }> }
const ZUSTAND_MS = 15 * 60_000;
const hash = (s: string) => createHash('sha256').update(s).digest('hex');

/**
 * Anmeldung starten (nur für die eigene Person — die Route prüft die Sitzung): legt `state` + PKCE-Verifier ab und liefert
 * die Adresse der Google-Anmeldeseite. `funktionen` = die gewünschten Funktionen; schon gewährte bleiben (inkrementell).
 */
export async function verbindungStarten(person: string, funktionen: readonly GoogleFunktion[], jetzt = Date.now()): Promise<{ url: string }> {
  const konfig = googleKonfig();
  if (!konfig) throw new GoogleVerbindungsFehler('nicht-konfiguriert', TEXT['nicht-konfiguriert'], 409);
  if (!personOk(person)) throw new GoogleVerbindungsFehler('person', TEXT.person, 403);
  const alt = await ladeVerbindung(person);
  const gewollt = Array.from(new Set<GoogleFunktion>([...(alt?.status === 'verbunden' ? alt.funktionen : []), ...funktionen, 'basis']));
  const state = b64url(randomBytes(32));
  const { verifier, challenge } = pkcePaar();
  const angefordert = Array.from(new Set(funktionen.filter(f => f !== 'basis')));
  await updateJson<ZustandBestand>(ZUSTAND, cur => {
    const eintraege = Object.fromEntries(Object.entries(cur?.eintraege ?? {}).filter(([, v]) => jetzt - v.at < ZUSTAND_MS));
    eintraege[hash(state)] = { person, verifier, funktionen: gewollt, at: jetzt, angefordert };
    return { eintraege };
  });
  // Ist schon ein Konto verbunden, schlägt Google genau dieses vor (`login_hint`) — eine zweite Funktion ergänzt die Verbindung,
  // sie ersetzt sie nicht durch ein anderes Konto.
  return { url: autorisierungsUrl({ konfig, state, challenge, scopes: scopesFuer(gewollt), ...(alt?.status === 'verbunden' ? { loginHint: alt.email } : {}) }) };
}

/** `state` einlösen (einmalig) — null, wenn unbekannt/abgelaufen. */
async function zustandEinloesen(state: string, jetzt: number): Promise<{ person: string; verifier: string; funktionen: GoogleFunktion[]; angefordert: GoogleFunktion[] } | null> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(state)) return null;
  const schluessel = hash(state);
  const f = await loadJson<ZustandBestand>(ZUSTAND);
  const e = f?.eintraege?.[schluessel];
  if (!e) return null;
  await updateJson<ZustandBestand>(ZUSTAND, cur => { const eintraege = { ...(cur?.eintraege ?? {}) }; delete eintraege[schluessel]; return { eintraege }; });
  return jetzt - e.at <= ZUSTAND_MS ? { person: e.person, verifier: e.verifier, funktionen: e.funktionen, angefordert: e.angefordert ?? e.funktionen.filter(f => f !== 'basis') } : null;
}

export interface Abschluss { email: string; funktionen: GoogleFunktion[]; fehlendeScopes: string[]; /** Die Funktionen, die DIESE Anmeldung neu wollte (z. B. nur `gmail`) — der Rückruf richtet nur diese ein. */ angefordert: GoogleFunktion[] }

/**
 * Rückruf: Code gegen Tokens tauschen. `person` = die Person der SITZUNG — gehört der `state` einer anderen, wird nichts
 * getauscht (der state ist dann trotzdem verbraucht). Domain-Verstoß → Token sofort widerrufen, nichts gespeichert.
 */
export async function verbindungAbschliessen(person: string, code: string, state: string, jetzt = Date.now()): Promise<Abschluss> {
  const konfig = googleKonfig();
  if (!konfig) throw new GoogleVerbindungsFehler('nicht-konfiguriert', TEXT['nicht-konfiguriert'], 409);
  const z = await zustandEinloesen(state, jetzt);
  if (!z) throw new GoogleVerbindungsFehler('state', TEXT.state, 400);
  if (z.person !== person) throw new GoogleVerbindungsFehler('person', TEXT.person, 403);
  if (!code || code.length > 2000) throw new GoogleVerbindungsFehler('token', TEXT.token, 400);
  const r = await tokenAnfrage(TOKEN_URL, new URLSearchParams({
    grant_type: 'authorization_code', code, redirect_uri: konfig.rueckrufUrl, client_id: konfig.clientId, client_secret: konfig.clientSecret, code_verifier: z.verifier,
  }));
  const j = r.json;
  const access = typeof j.access_token === 'string' ? j.access_token : '';
  const refresh = typeof j.refresh_token === 'string' ? j.refresh_token : '';
  if (r.status !== 200 || !access) throw new GoogleVerbindungsFehler('token', TEXT.token, 400);
  const nutzlast = jwtNutzlast(typeof j.id_token === 'string' ? j.id_token : '');
  const email = typeof nutzlast?.email === 'string' ? nutzlast.email.trim().toLowerCase() : '';
  const hd = typeof nutzlast?.hd === 'string' ? nutzlast.hd.trim().toLowerCase() : undefined;
  const widerrufen = async () => { await tokenWiderrufen(refresh || access); };
  if (!email || !domainPasst({ email, hd, emailBestaetigt: nutzlast?.email_verified !== false }, konfig.erlaubteDomain)) {
    await widerrufen();
    throw new GoogleVerbindungsFehler('domain', TEXT.domain, 403);
  }
  const gewaehrt = String(j.scope ?? '').split(/\s+/).filter(Boolean).map(scopeNorm);
  const alt = await ladeVerbindung(person);
  // Ohne neues Refresh-Token (Google schickt es nur bei der ersten Zustimmung bzw. mit prompt=consent) bleibt das alte.
  const refreshToken = refresh || alt?.refreshToken || '';
  if (!refreshToken) { await widerrufen(); throw new GoogleVerbindungsFehler('token', TEXT.token, 400); }
  // Dasselbe Konto? Eine andere Adresse ersetzt die Verbindung ganz (alter Zugang wird widerrufen, nicht vermischt).
  const anderesKonto = !!alt && alt.status === 'verbunden' && alt.email !== email;
  if (anderesKonto) await tokenWiderrufen(alt!.refreshToken);
  const scopes = Array.from(new Set([...(anderesKonto || alt?.status === 'getrennt' ? [] : alt?.scopes ?? []), ...gewaehrt]));
  const funktionen = Array.from(new Set<GoogleFunktion>(['basis', ...z.funktionen]));
  const fehlende = funktionen.flatMap(f => scopesFehlen(scopes, GOOGLE_FUNKTIONEN[f].scopes));
  const neu: GoogleVerbindung = {
    v: 1, email, ...(hd ? { hd } : {}), refreshToken, accessToken: access, ablauf: jetzt + Math.max(60, Number(j.expires_in) || 3600) * 1000,
    scopes, funktionen, verbundenAm: anderesKonto || !alt || alt.status === 'getrennt' ? new Date(jetzt).toISOString() : alt.verbundenAm, erneuertAm: new Date(jetzt).toISOString(), status: 'verbunden',
  };
  await saveJson(verbindungName(person), neu);
  return { email, funktionen, fehlendeScopes: fehlende, angefordert: z.angefordert };
}

// ── Zugriffstoken ───────────────────────────────────────────────────────────

const laufend = new Map<string, Promise<string>>();

/** Die Verbindung als „getrennt“ markieren (Refresh-Token tot) — der Aufrufer meldet (Glocke). */
export async function alsGetrenntMarkieren(person: string, grund: string): Promise<void> {
  await updateJson<GoogleVerbindung | null>(verbindungName(person), cur => (cur && cur.v === 1 ? { ...cur, status: 'getrennt', getrenntGrund: grund.slice(0, 160), getrenntAm: new Date().toISOString(), accessToken: undefined, ablauf: undefined } : cur));
}

async function erneuern(person: string, v: GoogleVerbindung, konfig: GoogleKonfig): Promise<string> {
  const r = await tokenAnfrage(TOKEN_URL, new URLSearchParams({ grant_type: 'refresh_token', refresh_token: v.refreshToken, client_id: konfig.clientId, client_secret: konfig.clientSecret }));
  const access = typeof r.json.access_token === 'string' ? r.json.access_token : '';
  if (r.status === 200 && access) {
    const ablauf = Date.now() + Math.max(60, Number(r.json.expires_in) || 3600) * 1000;
    await updateJson<GoogleVerbindung | null>(verbindungName(person), cur => (cur && cur.v === 1 ? { ...cur, accessToken: access, ablauf, erneuertAm: new Date().toISOString() } : cur));
    return access;
  }
  // invalid_grant: widerrufen, abgelaufen (Testmodus 7 Tage), Passwort geändert, App entfernt — die Verbindung ist tot.
  if (r.json.error === 'invalid_grant' || r.status === 400 || r.status === 401) {
    await alsGetrenntMarkieren(person, 'Zugriff wurde bei Google widerrufen oder ist abgelaufen');
    throw new GoogleVerbindungsFehler('getrennt', TEXT.getrennt, 409);
  }
  throw new GoogleVerbindungsFehler('netz', TEXT.netz, 503);
}

/**
 * Gültiges Zugriffstoken dieser Person für eine Funktion — erneuert bei Bedarf (höchstens ein Erneuern je Person
 * gleichzeitig). Wirft `GoogleVerbindungsFehler`: nicht konfiguriert/verbunden/getrennt, Scope fehlt.
 */
export async function googleZugriffstoken(person: string, funktion: GoogleFunktion, opt: { erneuern?: boolean } = {}): Promise<string> {
  const konfig = googleKonfig();
  if (!konfig) throw new GoogleVerbindungsFehler('nicht-konfiguriert', TEXT['nicht-konfiguriert'], 409);
  const v = await ladeVerbindung(person);
  if (!v) throw new GoogleVerbindungsFehler('nicht-verbunden', TEXT['nicht-verbunden'], 409);
  if (v.status !== 'verbunden') throw new GoogleVerbindungsFehler('getrennt', TEXT.getrennt, 409);
  if (scopesFehlen(v.scopes, GOOGLE_FUNKTIONEN[funktion].scopes).length) throw new GoogleVerbindungsFehler('scope-fehlt', TEXT['scope-fehlt'], 409);
  if (!opt.erneuern && v.accessToken && v.ablauf && Date.now() < v.ablauf - 60_000) return v.accessToken;
  const l = laufend.get(person);
  if (l) return l;
  const p = erneuern(person, v, konfig).finally(() => laufend.delete(person));
  laufend.set(person, p);
  return p;
}

// ── Trennen ─────────────────────────────────────────────────────────────────

/**
 * Trennen: Token bei Google widerrufen, dann den Bestand LÖSCHEN. `vorher` läuft zuerst, solange das Token noch gilt
 * (der Kalender stoppt damit seinen Push-Kanal) — ein Fehler dort verhindert das Trennen nie.
 */
export async function googleTrennen(person: string, vorher?: () => Promise<void>): Promise<{ war: boolean; widerrufen: boolean }> {
  const v = await ladeVerbindung(person);
  if (!v) return { war: false, widerrufen: false };
  if (vorher) await vorher().catch(() => { /* Trennen geht vor */ });
  const widerrufen = await tokenWiderrufen(v.refreshToken);
  // Kein Löschen in der Datenschicht: ein leerer Grabstein ersetzt den Bestand (`v: 0` liest `ladeVerbindung` als „nicht verbunden“).
  await saveJson(verbindungName(person), { v: 0, getrenntAm: new Date().toISOString() });
  return { war: true, widerrufen };
}

// ── Status (für die Oberfläche — nie Tokens) ────────────────────────────────

export interface GoogleStatus {
  konfiguriert: boolean;
  verbunden: boolean;
  /** Verbindung war da, ist aber tot (widerrufen/abgelaufen) → neu verbinden. */
  getrennt?: { grund: string; seit?: string };
  /** k***@makeinnovation.de */
  konto?: string;
  seit?: string;
  funktionen: GoogleFunktion[];
  /** Funktionen, deren Scopes vollständig gewährt sind. */
  bereit: GoogleFunktion[];
  erlaubteDomain: string | null;
}

export async function googleStatus(person: string): Promise<GoogleStatus> {
  const konfig = googleKonfig();
  const v = await ladeVerbindung(person);
  const basis = { konfiguriert: !!konfig, erlaubteDomain: konfig?.erlaubteDomain ?? null };
  if (!v) return { ...basis, verbunden: false, funktionen: [], bereit: [] };
  const bereit = (Object.keys(GOOGLE_FUNKTIONEN) as GoogleFunktion[]).filter(f => v.funktionen.includes(f) && !scopesFehlen(v.scopes, GOOGLE_FUNKTIONEN[f].scopes).length);
  if (v.status !== 'verbunden') return { ...basis, verbunden: false, getrennt: { grund: v.getrenntGrund ?? 'getrennt', ...(v.getrenntAm ? { seit: v.getrenntAm } : {}) }, konto: adresseMaskiert(v.email), funktionen: v.funktionen, bereit: [] };
  return { ...basis, verbunden: true, konto: adresseMaskiert(v.email), seit: v.verbundenAm, funktionen: v.funktionen, bereit };
}

/** Die E-Mail-Adresse der Verbindung (nur serverseitig, z. B. für „bin ich der Organisator?“) — nie ausliefern. */
export async function googleAdresse(person: string): Promise<string | null> {
  const v = await ladeVerbindung(person);
  return v && v.status === 'verbunden' ? v.email : null;
}

/** Alle Personen mit einer aktiven Verbindung für diese Funktion (aus einer Kandidatenliste, z. B. den Konten). */
export async function personenMit(funktion: GoogleFunktion, kandidaten: readonly string[]): Promise<string[]> {
  const raus: string[] = [];
  for (const p of kandidaten) {
    const v = await ladeVerbindung(p);
    if (v && v.status === 'verbunden' && v.funktionen.includes(funktion) && !scopesFehlen(v.scopes, GOOGLE_FUNKTIONEN[funktion].scopes).length) raus.push(p);
  }
  return raus;
}
