// ─── Google — WEITERE Konten je Person, nur Kalender, nur lesen (Server, 30.10.2026) ──────────
// Kevin 30.10.: „Ich möchte, dass wir einfach ein zweites Konto bei MAKE OS anlegen können — es geht erstmal um uns.“ Wer auch
// für andere Firmen arbeitet, hat dort einen weiteren Google-Kalender (andere Workspace-Domain). Ohne Abgleich entstehen
// Doppelbuchungen. Deshalb: je Person zusätzlich zur Haupt-Verbindung (lib/google/verbindung.ts — bleibt unverändert) bis zu
// `ZUSATZ_MAX` weitere Google-Konten, NUR `calendar.readonly` (kein Schreiben, kein Gmail). Ihre Termine zählen als „belegt“.
//
// Getrennt von der Haupt-Verbindung, damit sie bit-gleich bleibt:
//   · Bestand `google-zusatz--<person>` (verschlüsselt): Liste der Konten (Kennung `gz-<uuid>`, Adresse, Bezeichnung, Token,
//     gewählte Kalender, Zustand). Tokens nie an den Browser, nie ins Log/Protokoll — `zusatzStatus` liefert nur maskierte Adressen.
//   · Anmelde-Zustand `google-zusatz-zustand` (state-Hash → Person, PKCE-Verifier, 15 Min.). Der Rückruf läuft über DENSELBEN Pfad
//     wie die Haupt-Verbindung (/api/google/rueckruf — die einzige Cross-Site-Ausnahme); er erkennt einen Zusatz-State an diesem
//     Bestand (`istZusatzState`) und ruft dann nur `zusatzAbschliessen` — der Weg der Haupt-Verbindung bleibt unberührt.
//   · Domains: `GOOGLE_ZUSATZ_DOMAINS` (Komma-Liste, Instanz-Umgebung) — leer = Zusatzkonten aus („nicht eingerichtet“). Die Adresse
//     muss auf eine dieser Domains enden; trägt das Konto einen Workspace-Anspruch (`hd`), muss er dieselbe Domain sein. Dieselbe
//     Adresse wie die Haupt-Verbindung oder ein schon verbundenes Konto → abgelehnt, das Token wird sofort widerrufen.
//   · Erneuern wie die Haupt-Verbindung; `invalid_grant` (widerrufen, Passwort geändert, Testmodus der Google-App: Anmeldungen
//     verfallen nach 7 Tagen) → Zustand „abgelaufen“ + EINE Glocke je Konto (der Kalender-Abgleich meldet), „Neu verbinden“ mit
//     einem Klick (`zusatzStarten(person, { konto })`).
//   · Trennen = Widerruf bei Google + Konto aus dem Bestand; das letzte Konto → Bestände ganz weg (`bestandEntfernen`).
// Nichts Persönliches fest im Code: Domains, Adressen und Bezeichnungen kommen aus der Instanz bzw. von der Person.

import { createHash, randomBytes } from 'node:crypto';
import { loadJson, updateJson, bestandEntfernen } from '@/lib/store/local-db';
import { adresseMaskiert } from '@/lib/zugang/konten';
import { neueKennung } from '@/lib/kennung';
import {
  googleKonfig, tokenAnfrage, tokenWiderrufen, jwtNutzlast, pkcePaar, scopeNorm, scopesFehlen, domainSauber, ladeVerbindung,
  TOKEN_URL, AUTH_URL, type GoogleKonfig,
} from './verbindung';

// ── Konfiguration ───────────────────────────────────────────────────────────

/** NUR lesen: die Adresse des Kontos (Prüfung, Anzeige) und die Kalender (Liste + Termine). Kein Schreiben, kein Gmail. */
export const ZUSATZ_SCOPES: readonly string[] = ['openid', 'email', 'https://www.googleapis.com/auth/calendar.readonly'];
/** Höchstens so viele weitere Konten je Person. */
export const ZUSATZ_MAX = 5;
/** Höchstens so viele Kalender je weiterem Konto. */
export const ZUSATZ_KALENDER_MAX = 10;
const ZUSTAND_MS = 15 * 60_000;
const ZUSTAND = 'google-zusatz-zustand';
const PERSON = /^[a-z0-9-]{1,40}$/;
const KONTO = /^gz-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const istZusatzKonto = (v: unknown): v is string => typeof v === 'string' && KONTO.test(v);

/** Bestandsname je Person (kein Sonderfall für eine feste Person). */
export const zusatzName = (person: string) => `google-zusatz--${person}`;

/** Die erlaubten Domains der weiteren Konten aus der Umgebung (gesäubert, ohne Doppelte). Leer = aus. */
export function zusatzDomains(roh = process.env.GOOGLE_ZUSATZ_DOMAINS): string[] {
  return Array.from(new Set(String(roh ?? '').split(/[\s,;]+/).map(d => domainSauber(d)).filter((d): d is string => !!d))).slice(0, 20);
}
/** Weitere Konten sind möglich: Google ist eingerichtet UND mindestens eine Domain steht in `GOOGLE_ZUSATZ_DOMAINS`. */
export const zusatzKonfiguriert = (): boolean => !!googleKonfig() && zusatzDomains().length > 0;

// ── Fehler ──────────────────────────────────────────────────────────────────

export type ZusatzFehlerCode = 'nicht-konfiguriert' | 'person' | 'state' | 'token' | 'domain' | 'gleich' | 'doppelt' | 'anderes-konto' | 'voll' | 'scope-fehlt' | 'unbekannt' | 'abgelaufen' | 'netz';
const TEXT: Record<ZusatzFehlerCode, string> = {
  'nicht-konfiguriert': 'Weitere Kalender-Konten sind auf dieser Instanz noch nicht eingerichtet — das richtet die Inhaberin bzw. der Betreiber eurer Instanz ein.',
  person: 'Dieses Kalender-Konto gehört einer anderen Person.',
  state: 'Die Anmeldung ist abgelaufen oder ungültig — bitte noch einmal starten.',
  token: 'Google hat den Code nicht angenommen.',
  domain: 'Dieses Google-Konto gehört zu keiner Domain, die für weitere Kalender freigegeben ist.',
  gleich: 'Das ist dein Haupt-Konto bei Google — als weiteres Konto verbindest du ein anderes.',
  doppelt: 'Dieses Google-Konto ist schon als weiteres Kalender-Konto verbunden.',
  'anderes-konto': 'Bei Google wurde ein anderes Konto gewählt — zum Neu-Verbinden bitte dasselbe Konto wählen.',
  voll: `Mehr als ${ZUSATZ_MAX} weitere Kalender-Konten gehen nicht.`,
  'scope-fehlt': 'Google hat den Lesezugriff auf den Kalender nicht freigegeben — bitte neu verbinden und das Häkchen setzen.',
  unbekannt: 'Dieses Kalender-Konto gibt es nicht (mehr).',
  abgelaufen: 'Die Anmeldung dieses Kalender-Kontos ist abgelaufen — bitte neu verbinden.',
  netz: 'Google ist gerade nicht erreichbar.',
};
export const zusatzText = (c: ZusatzFehlerCode): string => TEXT[c];
export class ZusatzFehler extends Error {
  constructor(public code: ZusatzFehlerCode, public status = 409) { super(TEXT[code]); }
}

// ── Bestand ─────────────────────────────────────────────────────────────────

/** Ein weiteres Konto — NUR auf dem Server, nie ausliefern. */
export interface ZusatzKonto {
  id: string;
  email: string;
  hd?: string;
  /** Bezeichnung, die die Person selbst setzt (Vorgabe: die Domain) — steht im Kalendernamen „<Kalender> · <Bezeichnung>“. */
  label: string;
  refreshToken: string;
  accessToken?: string;
  ablauf?: number;
  scopes: string[];
  /** Gewählte Google-Kalender (Kennungen bei Google); Vorgabe: der Hauptkalender des Kontos. */
  kalender: string[];
  verbundenAm: string;
  erneuertAm?: string;
  status: 'verbunden' | 'abgelaufen';
  abgelaufenAm?: string;
  /** Die Glocke „neu verbinden“ ging schon — höchstens eine je Ablauf. */
  gemeldet?: true;
}
export interface ZusatzBestand { v: 1; konten: ZusatzKonto[] }

export async function ladeZusatz(person: string): Promise<ZusatzBestand> {
  if (!PERSON.test(person)) return { v: 1, konten: [] };
  const b = await loadJson<ZusatzBestand>(zusatzName(person));
  return b && b.v === 1 && Array.isArray(b.konten) ? { v: 1, konten: b.konten.filter(k => k && istZusatzKonto(k.id) && typeof k.refreshToken === 'string') } : { v: 1, konten: [] };
}
export async function ladeZusatzKonto(person: string, id: string): Promise<ZusatzKonto | null> {
  return (await ladeZusatz(person)).konten.find(k => k.id === id) ?? null;
}

/** Konten ändern (serialisiert). Ohne Bestand und ohne neue Konten wird nichts angelegt. */
async function aendereZusatz(person: string, mutate: (konten: ZusatzKonto[]) => ZusatzKonto[]): Promise<ZusatzKonto[]> {
  let raus: ZusatzKonto[] = [];
  const alt = await loadJson<ZusatzBestand>(zusatzName(person));
  if (!alt && !mutate([]).length) return [];
  await updateJson<ZusatzBestand>(zusatzName(person), cur => {
    const konten = cur && cur.v === 1 && Array.isArray(cur.konten) ? cur.konten : [];
    raus = mutate(konten);
    return { v: 1, konten: raus };
  });
  return raus;
}

// ── Reine Helfer (getestet) ─────────────────────────────────────────────────

/** Bezeichnung säubern: 1–40 Zeichen, ohne Steuerzeichen und ohne „·“ (Trenner im Kalendernamen). */
export function labelSauber(roh: unknown): string | null {
  const t = typeof roh === 'string' ? roh.replace(/[\u0000-\u001f\u007f·]/g, ' ').replace(/\s+/g, ' ').trim() : '';
  return t && t.length <= 40 ? t : null;
}
/** Vorgabe der Bezeichnung: die Domain der Adresse. */
export const vorgabeLabel = (email: string): string => labelSauber(email.split('@')[1] ?? '') ?? 'Weiteres Konto';

/**
 * Passt das Konto zu den freigegebenen Domains? Die Adresse endet auf @<domain> einer Domain der Liste; trägt das Konto einen
 * Workspace-Anspruch (`hd`), ist er genau diese Domain; die Adresse ist von Google bestätigt. Leere Liste: nie.
 */
export function zusatzDomainPasst(konto: { email?: string; hd?: string; emailBestaetigt?: boolean }, domains: readonly string[]): boolean {
  const mail = (konto.email ?? '').trim().toLowerCase();
  const d = mail.split('@')[1] ?? '';
  if (!d || !domains.map(x => x.toLowerCase()).includes(d) || konto.emailBestaetigt === false) return false;
  const hd = (konto.hd ?? '').trim().toLowerCase();
  return !hd || hd === d;
}

const b64url = (b: Buffer) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const hash = (s: string) => createHash('sha256').update(s).digest('hex');

/** Adresse der Google-Anmeldeseite: nur lesen, offline, Zustimmung UND Kontowahl (ein anderes Konto als das angemeldete). */
export function zusatzAutorisierungsUrl(e: { konfig: GoogleKonfig; state: string; challenge: string; loginHint?: string }): string {
  const u = new URL(AUTH_URL);
  const p = u.searchParams;
  p.set('client_id', e.konfig.clientId);
  p.set('redirect_uri', e.konfig.rueckrufUrl);
  p.set('response_type', 'code');
  p.set('scope', ZUSATZ_SCOPES.join(' '));
  p.set('state', e.state);
  p.set('code_challenge', e.challenge);
  p.set('code_challenge_method', 'S256');
  p.set('access_type', 'offline');
  p.set('prompt', 'consent select_account');
  if (e.loginHint) p.set('login_hint', e.loginHint);
  return u.toString();
}

// ── Anmelden: Start und Rückruf ─────────────────────────────────────────────

interface ZustandBestand { eintraege: Record<string, { person: string; verifier: string; at: number; /** Neu verbinden: dieses Konto. */ konto?: string }> }

/**
 * Anmeldung eines weiteren Kontos starten (nur die eigene Person — die Route prüft die Sitzung). `konto`: ein vorhandenes Konto neu
 * verbinden (abgelaufen) — Google schlägt dann genau diese Adresse vor.
 */
export async function zusatzStarten(person: string, opt: { konto?: string } = {}, jetzt = Date.now()): Promise<{ url: string }> {
  const konfig = googleKonfig();
  if (!konfig || !zusatzDomains().length) throw new ZusatzFehler('nicht-konfiguriert', 409);
  if (!PERSON.test(person)) throw new ZusatzFehler('person', 403);
  const b = await ladeZusatz(person);
  let loginHint: string | undefined;
  if (opt.konto) {
    const k = b.konten.find(x => x.id === opt.konto);
    if (!k) throw new ZusatzFehler('unbekannt', 404);
    loginHint = k.email;
  } else if (b.konten.length >= ZUSATZ_MAX) throw new ZusatzFehler('voll', 409);
  const state = b64url(randomBytes(32));
  const { verifier, challenge } = pkcePaar();
  await updateJson<ZustandBestand>(ZUSTAND, cur => {
    const eintraege = Object.fromEntries(Object.entries(cur?.eintraege ?? {}).filter(([, v]) => jetzt - v.at < ZUSTAND_MS));
    eintraege[hash(state)] = { person, verifier, at: jetzt, ...(opt.konto ? { konto: opt.konto } : {}) };
    return { eintraege };
  });
  return { url: zusatzAutorisierungsUrl({ konfig, state, challenge, ...(loginHint ? { loginHint } : {}) }) };
}

/** Gehört dieser `state` zu einer Anmeldung eines weiteren Kontos? (Nur lesen — der Rückruf entscheidet damit den Weg.) */
export async function istZusatzState(state: string | null | undefined): Promise<boolean> {
  if (!state || !/^[A-Za-z0-9_-]{20,100}$/.test(state)) return false;
  const f = await loadJson<ZustandBestand>(ZUSTAND).catch(() => null);
  return !!f?.eintraege?.[hash(state)];
}

async function zustandEinloesen(state: string, jetzt: number): Promise<{ person: string; verifier: string; konto?: string } | null> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(state)) return null;
  const schluessel = hash(state);
  const f = await loadJson<ZustandBestand>(ZUSTAND);
  const e = f?.eintraege?.[schluessel];
  if (!e) return null;
  await updateJson<ZustandBestand>(ZUSTAND, cur => { const eintraege = { ...(cur?.eintraege ?? {}) }; delete eintraege[schluessel]; return { eintraege }; });
  return jetzt - e.at <= ZUSTAND_MS ? { person: e.person, verifier: e.verifier, ...(e.konto ? { konto: e.konto } : {}) } : null;
}

/**
 * Rückruf eines weiteren Kontos: Code gegen Tokens tauschen. `person` = die Person der SITZUNG. Jede Ablehnung widerruft das
 * frische Token sofort (nichts gespeichert): Domain nicht freigegeben, Haupt-Konto, schon verbunden, anderes Konto beim Neu-
 * Verbinden, Lesezugriff nicht gewährt.
 */
export async function zusatzAbschliessen(person: string, code: string, state: string, jetzt = Date.now()): Promise<{ konto: string; neu: boolean }> {
  const konfig = googleKonfig();
  if (!konfig || !zusatzDomains().length) throw new ZusatzFehler('nicht-konfiguriert', 409);
  const z = await zustandEinloesen(state, jetzt);
  if (!z) throw new ZusatzFehler('state', 400);
  if (z.person !== person) throw new ZusatzFehler('person', 403);
  if (!code || code.length > 2000) throw new ZusatzFehler('token', 400);
  let r: Awaited<ReturnType<typeof tokenAnfrage>>;
  try {
    r = await tokenAnfrage(TOKEN_URL, new URLSearchParams({
      grant_type: 'authorization_code', code, redirect_uri: konfig.rueckrufUrl, client_id: konfig.clientId, client_secret: konfig.clientSecret, code_verifier: z.verifier,
    }));
  } catch { throw new ZusatzFehler('netz', 503); }
  const j = r.json;
  const access = typeof j.access_token === 'string' ? j.access_token : '';
  const refresh = typeof j.refresh_token === 'string' ? j.refresh_token : '';
  if (r.status !== 200 || !access) throw new ZusatzFehler('token', 400);
  const ablehnen = async (c: ZusatzFehlerCode, status: number): Promise<never> => { await tokenWiderrufen(refresh || access); throw new ZusatzFehler(c, status); };
  const nutzlast = jwtNutzlast(typeof j.id_token === 'string' ? j.id_token : '');
  const email = typeof nutzlast?.email === 'string' ? nutzlast.email.trim().toLowerCase() : '';
  const hd = typeof nutzlast?.hd === 'string' ? nutzlast.hd.trim().toLowerCase() : undefined;
  if (!email || !zusatzDomainPasst({ email, hd, emailBestaetigt: nutzlast?.email_verified !== false }, zusatzDomains())) return ablehnen('domain', 403);
  const haupt = await ladeVerbindung(person);
  if (haupt && haupt.email === email) return ablehnen('gleich', 409);
  const gewaehrt = String(j.scope ?? '').split(/\s+/).filter(Boolean).map(scopeNorm);
  if (scopesFehlen(gewaehrt, ZUSATZ_SCOPES).length) return ablehnen('scope-fehlt', 409);
  const bestand = await ladeZusatz(person);
  const alt = z.konto ? bestand.konten.find(k => k.id === z.konto) : undefined;
  if (z.konto && !alt) return ablehnen('unbekannt', 404);
  if (alt && alt.email !== email) return ablehnen('anderes-konto', 409);
  if (!alt && bestand.konten.some(k => k.email === email)) return ablehnen('doppelt', 409);
  if (!alt && bestand.konten.length >= ZUSATZ_MAX) return ablehnen('voll', 409);
  const refreshToken = refresh || alt?.refreshToken || '';
  if (!refreshToken) return ablehnen('token', 400);
  const ablauf = jetzt + Math.max(60, Number(j.expires_in) || 3600) * 1000;
  const zeit = new Date(jetzt).toISOString();
  const id = alt?.id ?? neueKennung('gz');
  // Ein neues Refresh-Token ersetzt das alte — das alte wird widerrufen (nie zwei gültige für dasselbe Konto).
  if (alt && refresh && alt.refreshToken !== refresh) await tokenWiderrufen(alt.refreshToken);
  let doch: ZusatzFehlerCode | null = null;
  await aendereZusatz(person, konten => {
    if (!alt && konten.some(k => k.email === email)) { doch = 'doppelt'; return konten; }
    if (!alt && konten.length >= ZUSATZ_MAX) { doch = 'voll'; return konten; }
    const neu: ZusatzKonto = {
      id, email, ...(hd ? { hd } : {}), label: alt?.label ?? vorgabeLabel(email), refreshToken, accessToken: access, ablauf,
      scopes: Array.from(new Set(gewaehrt)), kalender: alt?.kalender?.length ? alt.kalender : ['primary'],
      verbundenAm: alt?.verbundenAm ?? zeit, erneuertAm: zeit, status: 'verbunden',
    };
    return alt ? konten.map(k => (k.id === id ? neu : k)) : [...konten, neu];
  });
  if (doch) return ablehnen(doch, 409);
  return { konto: id, neu: !alt };
}

// ── Zugriffstoken ───────────────────────────────────────────────────────────

const laufend = new Map<string, Promise<string>>();

/** Das Konto als „abgelaufen“ markieren. Liefert true, wenn dafür noch KEINE Glocke ging (der Aufrufer meldet dann einmal). */
export async function zusatzAlsAbgelaufen(person: string, id: string, jetzt = Date.now()): Promise<boolean> {
  let melden = false;
  await aendereZusatz(person, konten => konten.map(k => {
    if (k.id !== id) return k;
    melden = !k.gemeldet;
    const { accessToken: _a, ablauf: _b, ...rest } = k;
    return { ...rest, status: 'abgelaufen', abgelaufenAm: k.abgelaufenAm ?? new Date(jetzt).toISOString(), gemeldet: true };
  }));
  return melden;
}

/** Glocke „neu verbinden“ — neutral, ohne Adresse und ohne Firmennamen (Telegram-Regel); höchstens eine je Ablauf und Konto. */
export const ZUSATZ_MELDUNG = 'Ein weiteres Kalender-Konto muss neu verbunden werden — Kalender › Einstellungen › Weitere Kalender.';
async function zusatzGlocke(person: string): Promise<void> {
  const { melde } = await import('@/lib/meldungen/melden');
  await melde({ an: person, art: 'kalender', titel: ZUSATZ_MELDUNG, link: '/os/kalender' });
}

async function erneuern(person: string, k: ZusatzKonto, konfig: GoogleKonfig): Promise<string> {
  let r: Awaited<ReturnType<typeof tokenAnfrage>>;
  try { r = await tokenAnfrage(TOKEN_URL, new URLSearchParams({ grant_type: 'refresh_token', refresh_token: k.refreshToken, client_id: konfig.clientId, client_secret: konfig.clientSecret })); }
  catch { throw new ZusatzFehler('netz', 503); }
  const access = typeof r.json.access_token === 'string' ? r.json.access_token : '';
  if (r.status === 200 && access) {
    const ablauf = Date.now() + Math.max(60, Number(r.json.expires_in) || 3600) * 1000;
    await aendereZusatz(person, konten => konten.map(x => (x.id === k.id ? { ...x, accessToken: access, ablauf, erneuertAm: new Date().toISOString() } : x)));
    return access;
  }
  // invalid_grant: widerrufen, Passwort geändert, Testmodus der Google-App (7 Tage) — die Anmeldung ist tot.
  if (r.json.error === 'invalid_grant' || r.status === 400 || r.status === 401) {
    if (await zusatzAlsAbgelaufen(person, k.id)) await zusatzGlocke(person);
    throw new ZusatzFehler('abgelaufen', 409);
  }
  throw new ZusatzFehler('netz', 503);
}

/** Gültiges Zugriffstoken eines weiteren Kontos — erneuert bei Bedarf (höchstens ein Erneuern je Konto gleichzeitig). */
export async function zusatzZugriffstoken(person: string, id: string, opt: { erneuern?: boolean } = {}): Promise<string> {
  const konfig = googleKonfig();
  if (!konfig) throw new ZusatzFehler('nicht-konfiguriert', 409);
  const k = await ladeZusatzKonto(person, id);
  if (!k) throw new ZusatzFehler('unbekannt', 404);
  if (k.status !== 'verbunden') throw new ZusatzFehler('abgelaufen', 409);
  if (!opt.erneuern && k.accessToken && k.ablauf && Date.now() < k.ablauf - 60_000) return k.accessToken;
  const schluessel = `${person}|${id}`;
  const l = laufend.get(schluessel);
  if (l) return l;
  const p = erneuern(person, k, konfig).finally(() => laufend.delete(schluessel));
  laufend.set(schluessel, p);
  return p;
}

// ── Einstellen, Trennen ─────────────────────────────────────────────────────

/** Bezeichnung und/oder gewählte Kalender eines Kontos setzen. false = Konto unbekannt. */
export async function zusatzSetzen(person: string, id: string, felder: { label?: string; kalender?: string[] }): Promise<boolean> {
  if (!(await ladeZusatzKonto(person, id))) return false;
  await aendereZusatz(person, konten => konten.map(k => (k.id === id ? {
    ...k, ...(felder.label ? { label: felder.label } : {}), ...(felder.kalender ? { kalender: felder.kalender.slice(0, ZUSATZ_KALENDER_MAX) } : {}),
  } : k)));
  return true;
}

/** Ein Konto trennen: bei Google widerrufen, aus dem Bestand nehmen; das letzte Konto → Bestand ganz weg. */
export async function zusatzKontoTrennen(person: string, id: string): Promise<{ war: boolean; widerrufen: boolean }> {
  const k = await ladeZusatzKonto(person, id);
  if (!k) return { war: false, widerrufen: false };
  const widerrufen = await tokenWiderrufen(k.refreshToken);
  const rest = await aendereZusatz(person, konten => konten.filter(x => x.id !== id));
  if (!rest.length) await bestandEntfernen(zusatzName(person), { tageskopien: true });
  return { war: true, widerrufen };
}

/** Alle weiteren Konten einer Person trennen (Konto löschen): widerrufen, Bestand samt Tageskopien weg. */
export async function zusatzAlleTrennen(person: string): Promise<{ konten: number; widerrufen: number }> {
  if (!PERSON.test(person)) return { konten: 0, widerrufen: 0 };
  const b = await ladeZusatz(person);
  let widerrufen = 0;
  for (const k of b.konten) if (await tokenWiderrufen(k.refreshToken)) widerrufen++;
  await bestandEntfernen(zusatzName(person), { tageskopien: true });
  return { konten: b.konten.length, widerrufen };
}

// ── Status (für die Oberfläche — nie Tokens, nie volle Adressen) ────────────

export interface ZusatzKontoStatus { id: string; konto: string; label: string; status: 'verbunden' | 'abgelaufen'; seit: string; abgelaufenAm?: string; kalender: string[] }
export interface ZusatzStatus { konfiguriert: boolean; max: number; konten: ZusatzKontoStatus[] }

export async function zusatzStatus(person: string): Promise<ZusatzStatus> {
  const b = await ladeZusatz(person);
  return {
    konfiguriert: zusatzKonfiguriert(), max: ZUSATZ_MAX,
    konten: b.konten.map(k => ({ id: k.id, konto: adresseMaskiert(k.email), label: k.label, status: k.status, seit: k.verbundenAm, ...(k.abgelaufenAm ? { abgelaufenAm: k.abgelaufenAm } : {}), kalender: k.kalender })),
  };
}

/** Personen mit mindestens einem weiteren Konto (aus einer Kandidatenliste, z. B. den Konten). */
export async function personenMitZusatz(kandidaten: readonly string[]): Promise<string[]> {
  const raus: string[] = [];
  for (const p of kandidaten) if ((await ladeZusatz(p).catch(() => ({ konten: [] as ZusatzKonto[] }))).konten.length) raus.push(p);
  return raus;
}
