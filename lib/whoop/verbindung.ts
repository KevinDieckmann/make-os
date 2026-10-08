// ─── WHOOP — EINE Verbindung je Person (Server, 08.10.2026) ──────────────────────────────────────────────────────────────
// Vorbild: lib/google/verbindung.ts. Jede Person verbindet IHR WHOOP-Konto selbst (Kevin seins, Malin ihres) — nie ein gemeinsamer
// Token. Doku: https://developer.whoop.com/docs/developing/oauth (Fakten: research/whoop/FAKTEN_WHOOP.md).
//
//   · OAuth 2.0 Authorization-Code + `state` (genau 8 Zeichen laut Doku, einmalig, 15 Min., an die Person der Sitzung gebunden).
//     Kein PKCE — die Doku nennt es nicht (Annahme); der Client ist vertraulich (Secret nur auf dem Server).
//   · Tokens nur serverseitig, verschlüsselt im Bestand `whoop-verbindung--<person>` — nie an den Browser, nie ins Log/Protokoll.
//     Die Oberfläche bekommt nur `whoopStatus` (maskierte Adresse, Zustände, Zeiten).
//   · Refresh-Token ROTIERT (belegt): höchstens ein Erneuern je Person gleichzeitig, das neue Refresh-Token wird sofort gespeichert.
//     Abgelehnt (400/401) → „getrennt“ + EINE Glocke (Art `verbindung`), bis die Person neu verbindet.
//   · Eine WHOOP-Kennung (`user_id`) gehört höchstens EINER Person — sonst ließen sich Webhooks nicht eindeutig zuordnen (409).
//   · Trennen: Widerruf bei WHOOP (`DELETE /v2/user/access`), Bestand samt Tageskopien weg, Grabstein `{ v: 0 }` als Marke.
//
// Übergang (Rohbau bis 08.10.: lib/oauth.ts, EIN gemeinsamer Token in `oauth-tokens.whoop`, nur Inhaber): der alte Token gilt NUR für
// den Inhaber und wird beim ersten Lesen einmal in SEINEN Bestand übernommen (dann aus `oauth-tokens` gelöscht). Nie für eine andere
// Person. Fehlen ihm Scopes (der alte Rohbau bat nicht um `read:workout`), zeigt der Status „neu verbinden“.

import { randomInt } from 'node:crypto';
import { loadJson, saveJson, updateJson, bestandEntfernen } from '@/lib/store/local-db';
import { adresseMaskiert } from '@/lib/zugang/konten';
import { WHOOP_API, WHOOP_AUTH_URL, WHOOP_SCOPES, WHOOP_PFLICHT_SCOPES, WHOOP_TOKEN_URL, whoopHost, whoopKonfig, whoopFehlt, verbindungName, standName, ZUSTAND_NAME, PERSON_OK, type WhoopKonfig } from './konfig';

// ── Fehler ──────────────────────────────────────────────────────────────────

export type WhoopFehlerCode = 'nicht-konfiguriert' | 'nicht-verbunden' | 'getrennt' | 'state' | 'token' | 'netz' | 'person' | 'belegt' | 'einwilligung';
export class WhoopVerbindungsFehler extends Error {
  constructor(public code: WhoopFehlerCode, message: string, public status = 409) { super(message); }
}
const TEXT: Record<WhoopFehlerCode, string> = {
  'nicht-konfiguriert': 'WHOOP ist noch nicht eingerichtet (Server-Umgebung).',
  'nicht-verbunden': 'WHOOP ist für dich nicht verbunden.',
  getrennt: 'Die WHOOP-Verbindung ist getrennt — bitte neu verbinden.',
  state: 'Die Anmeldung ist abgelaufen oder ungültig — bitte noch einmal starten.',
  token: 'WHOOP hat die Anmeldung nicht angenommen.',
  netz: 'WHOOP ist gerade nicht erreichbar.',
  person: 'Diese Anmeldung gehört einer anderen Person.',
  belegt: 'Dieses WHOOP-Konto ist schon mit einer anderen Person verbunden.',
  einwilligung: 'Gesundheitsdaten werden erst nach deiner Einwilligung erfasst (System › Datenschutz).',
};
export const whoopFehlerText = (c: WhoopFehlerCode): string => TEXT[c];

// ── Bestand ─────────────────────────────────────────────────────────────────

/** Bestand je Person — nur auf dem Server, verschlüsselt. Nie ausliefern. */
export interface WhoopVerbindung {
  v: 1;
  /** WHOOP-Kennung (`user_id` aus dem Profil) — Zuordnung der Webhooks. null nur kurz beim Übergang des alten Tokens. */
  userId: number | null;
  /** Adresse des WHOOP-Kontos (nur serverseitig; angezeigt wird sie maskiert). */
  email?: string;
  refreshToken: string;
  accessToken?: string;
  /** Ablauf des Zugriffstokens (ms). */
  ablauf?: number;
  scopes: string[];
  verbundenAm: string;
  erneuertAm?: string;
  status: 'verbunden' | 'getrennt';
  getrenntGrund?: string;
  getrenntAm?: string;
  /** Glocke „getrennt“ schon gemeldet (EINE je Trennung). */
  getrenntGemeldet?: boolean;
  /** `alt` = aus dem gemeinsamen Rohbau-Token übernommen (nur Inhaber). */
  herkunft?: 'alt';
}

const personOk = (p: string) => PERSON_OK.test(p);

export async function ladeVerbindung(person: string): Promise<WhoopVerbindung | null> {
  if (!personOk(person)) return null;
  await altUebernehmen(person).catch(() => { /* Übergang ist ein Komfort — nie ein Fehler */ });
  const v = await loadJson<WhoopVerbindung>(verbindungName(person));
  return v && v.v === 1 && typeof v.refreshToken === 'string' ? v : null;
}

// ── Reine Helfer (getestet) ─────────────────────────────────────────────────

const ZEICHEN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
/** `state` nach der Doku: genau 8 Zeichen — aus crypto.randomInt (nie Math.random). */
export function neuerState(): string {
  let s = '';
  for (let i = 0; i < 8; i++) s += ZEICHEN[randomInt(ZEICHEN.length)];
  return s;
}
export const STATE_FORM = /^[A-Za-z0-9]{8}$/;

/** Adresse der WHOOP-Anmeldeseite. */
export function autorisierungsUrl(k: WhoopKonfig, state: string): string {
  const u = new URL(WHOOP_AUTH_URL);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', k.clientId);
  u.searchParams.set('redirect_uri', k.rueckrufUrl);
  u.searchParams.set('scope', WHOOP_SCOPES.join(' '));
  u.searchParams.set('state', state);
  return u.toString();
}

/** Fehlende Pflicht-Scopes (rein). */
export const scopesFehlen = (gewaehrt: readonly string[], noetig: readonly string[] = WHOOP_SCOPES.filter(s => s !== 'offline')): string[] =>
  noetig.filter(s => !gewaehrt.includes(s));

// ── Zugriff auf WHOOP (nur diese Hosts) ─────────────────────────────────────

async function tokenAnfrage(koerper: URLSearchParams): Promise<{ status: number; json: Record<string, unknown> }> {
  if (!whoopHost(WHOOP_TOKEN_URL)) throw new WhoopVerbindungsFehler('netz', 'Unerwartete Adresse — Abbruch.', 502);
  let r: Response;
  try {
    r = await fetch(WHOOP_TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: koerper.toString(), signal: AbortSignal.timeout(25_000), redirect: 'error' });
  } catch { throw new WhoopVerbindungsFehler('netz', TEXT.netz, 503); }
  let json: Record<string, unknown> = {};
  try { const j = await r.json(); if (j && typeof j === 'object') json = j as Record<string, unknown>; } catch { /* leer */ }
  return { status: r.status, json };
}

/** Profil mit einem frischen Zugriffstoken (vor dem Speichern — der Bestand braucht die `user_id`). */
async function profilLesen(token: string): Promise<{ userId: number; email?: string } | null> {
  const url = `${WHOOP_API}/v2/user/profile/basic`;
  if (!whoopHost(url)) return null;
  try {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, signal: AbortSignal.timeout(20_000), redirect: 'error' });
    if (r.status !== 200) return null;
    const j = await r.json() as { user_id?: unknown; email?: unknown };
    const userId = Number(j.user_id);
    if (!Number.isSafeInteger(userId) || userId <= 0) return null;
    return { userId, ...(typeof j.email === 'string' && j.email.includes('@') ? { email: j.email.trim().toLowerCase().slice(0, 200) } : {}) };
  } catch { return null; }
}

/** Bei WHOOP widerrufen (`DELETE /v2/user/access`) — true, wenn WHOOP es bestätigt (2xx). Wirft nie. */
export async function zugriffWiderrufen(token: string): Promise<boolean> {
  const url = `${WHOOP_API}/v2/user/access`;
  if (!whoopHost(url) || !token) return false;
  try {
    const r = await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000), redirect: 'error' });
    return r.status >= 200 && r.status < 300;
  } catch { return false; }
}

// ── Anmelden: Start und Rückruf ─────────────────────────────────────────────

interface ZustandBestand { eintraege: Record<string, { person: string; at: number }> }
const ZUSTAND_MS = 15 * 60_000;
/** Höchstens so viele offene Anmeldungen je Person (die kurze `state`-Form soll nicht durch Masse erraten werden). */
const OFFEN_JE_PERSON = 3;

export async function verbindungStarten(person: string, jetzt = Date.now()): Promise<{ url: string }> {
  const konfig = whoopKonfig();
  if (!konfig) throw new WhoopVerbindungsFehler('nicht-konfiguriert', TEXT['nicht-konfiguriert'], 409);
  if (!personOk(person)) throw new WhoopVerbindungsFehler('person', TEXT.person, 403);
  let state = neuerState();
  await updateJson<ZustandBestand>(ZUSTAND_NAME, cur => {
    const alt = Object.entries(cur?.eintraege ?? {}).filter(([, v]) => jetzt - v.at < ZUSTAND_MS);
    const eigene = alt.filter(([, v]) => v.person === person).sort((a, b) => a[1].at - b[1].at);
    const weg = new Set(eigene.slice(0, Math.max(0, eigene.length - (OFFEN_JE_PERSON - 1))).map(([k]) => k));
    const eintraege = Object.fromEntries(alt.filter(([k]) => !weg.has(k)));
    while (eintraege[state]) state = neuerState();
    eintraege[state] = { person, at: jetzt };
    return { eintraege };
  });
  return { url: autorisierungsUrl(konfig, state) };
}

async function zustandEinloesen(state: string, jetzt: number): Promise<{ person: string } | null> {
  if (!STATE_FORM.test(state)) return null;
  const f = await loadJson<ZustandBestand>(ZUSTAND_NAME);
  const e = f?.eintraege?.[state];
  if (!e) return null;
  await updateJson<ZustandBestand>(ZUSTAND_NAME, cur => { const eintraege = { ...(cur?.eintraege ?? {}) }; delete eintraege[state]; return { eintraege }; });
  return jetzt - e.at <= ZUSTAND_MS ? { person: e.person } : null;
}

/** Wem gehört diese WHOOP-Kennung (aus einer Kandidatenliste)? */
export async function personZuUserId(userId: number, kandidaten: readonly string[]): Promise<string | null> {
  for (const p of kandidaten) {
    const v = await loadJson<WhoopVerbindung>(verbindungName(p)).catch(() => null);
    if (v && v.v === 1 && v.userId === userId && v.status === 'verbunden') return p;
  }
  return null;
}

/**
 * Rückruf: Code gegen Tokens tauschen. `person` = die Person der SITZUNG — gehört der `state` einer anderen, wird nichts getauscht.
 * `kandidaten` = alle Konten (Prüfung „WHOOP-Konto schon bei einer anderen Person“).
 */
export async function verbindungAbschliessen(person: string, code: string, state: string, kandidaten: readonly string[], jetzt = Date.now()): Promise<{ konto?: string; scopesFehlen: string[] }> {
  const konfig = whoopKonfig();
  if (!konfig) throw new WhoopVerbindungsFehler('nicht-konfiguriert', TEXT['nicht-konfiguriert'], 409);
  const z = await zustandEinloesen(state, jetzt);
  if (!z) throw new WhoopVerbindungsFehler('state', TEXT.state, 400);
  if (z.person !== person) throw new WhoopVerbindungsFehler('person', TEXT.person, 403);
  if (!code || code.length > 2000) throw new WhoopVerbindungsFehler('token', TEXT.token, 400);
  const r = await tokenAnfrage(new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: konfig.rueckrufUrl, client_id: konfig.clientId, client_secret: konfig.clientSecret }));
  const access = typeof r.json.access_token === 'string' ? r.json.access_token : '';
  const refresh = typeof r.json.refresh_token === 'string' ? r.json.refresh_token : '';
  if (r.status !== 200 || !access) throw new WhoopVerbindungsFehler('token', TEXT.token, 400);
  if (!refresh) { await zugriffWiderrufen(access); throw new WhoopVerbindungsFehler('token', 'WHOOP hat keinen dauerhaften Zugang erteilt (Scope „offline“ fehlt) — bitte erneut verbinden und zustimmen.', 400); }
  const profil = await profilLesen(access);
  if (!profil) { await zugriffWiderrufen(access); throw new WhoopVerbindungsFehler('token', 'Das WHOOP-Profil ließ sich nicht lesen — bitte erneut verbinden und „Profil“ zulassen.', 400); }
  const fremd = await personZuUserId(profil.userId, kandidaten.filter(p => p !== person));
  if (fremd) { await zugriffWiderrufen(access); throw new WhoopVerbindungsFehler('belegt', TEXT.belegt, 409); }
  const gewaehrt = String(r.json.scope ?? WHOOP_SCOPES.join(' ')).split(/\s+/).filter(Boolean);
  const alt = await loadJson<WhoopVerbindung>(verbindungName(person)).catch(() => null);
  // Ein anderes WHOOP-Konto ersetzt die Verbindung ganz (der alte Zugang wird widerrufen, nicht vermischt) — der Spiegel gehört dem alten.
  if (alt && alt.v === 1 && alt.userId !== null && alt.userId !== profil.userId) {
    if (alt.accessToken) await zugriffWiderrufen(alt.accessToken);
    await bestandEntfernen(standName(person), { tageskopien: true }).catch(() => false);
  }
  const neu: WhoopVerbindung = {
    v: 1, userId: profil.userId, ...(profil.email ? { email: profil.email } : {}), refreshToken: refresh, accessToken: access,
    ablauf: jetzt + Math.max(60, Number(r.json.expires_in) || 3600) * 1000, scopes: gewaehrt,
    verbundenAm: new Date(jetzt).toISOString(), erneuertAm: new Date(jetzt).toISOString(), status: 'verbunden',
  };
  await saveJson(verbindungName(person), neu);
  return { ...(profil.email ? { konto: adresseMaskiert(profil.email) } : {}), scopesFehlen: scopesFehlen(gewaehrt) };
}

// ── Zugriffstoken ───────────────────────────────────────────────────────────

const laufend = new Map<string, Promise<string>>();

/** Als „getrennt“ markieren — true, wenn die Verbindung DADURCH getrennt wurde (dann meldet der Aufrufer EINMAL). */
export async function alsGetrenntMarkieren(person: string, grund: string): Promise<boolean> {
  let neu = false;
  await updateJson<WhoopVerbindung | null>(verbindungName(person), cur => {
    if (!cur || cur.v !== 1) return cur;
    neu = cur.status !== 'getrennt';
    return { ...cur, status: 'getrennt', getrenntGrund: grund.slice(0, 160), getrenntAm: cur.getrenntAm && !neu ? cur.getrenntAm : new Date().toISOString(), accessToken: undefined, ablauf: undefined };
  });
  if (neu) await getrenntMelden(person);
  return neu;
}

/** EINE Glocke je Trennung (ohne Werte, ohne Adresse). */
async function getrenntMelden(person: string): Promise<void> {
  const v = await loadJson<WhoopVerbindung>(verbindungName(person)).catch(() => null);
  if (!v || v.v !== 1 || v.getrenntGemeldet) return;
  const { melde } = await import('@/lib/meldungen/melden');
  await melde({ an: person, art: 'verbindung', titel: 'Die WHOOP-Verbindung ist getrennt — bitte unter Gesundheit neu verbinden.', link: '/os/gesundheit#whoop' });
  await updateJson<WhoopVerbindung | null>(verbindungName(person), cur => (cur && cur.v === 1 ? { ...cur, getrenntGemeldet: true } : cur));
}

async function erneuern(person: string, v: WhoopVerbindung, konfig: WhoopKonfig): Promise<string> {
  const r = await tokenAnfrage(new URLSearchParams({ grant_type: 'refresh_token', refresh_token: v.refreshToken, client_id: konfig.clientId, client_secret: konfig.clientSecret, scope: 'offline' }));
  const access = typeof r.json.access_token === 'string' ? r.json.access_token : '';
  if (r.status === 200 && access) {
    // Rotation (belegt): das NEUE Refresh-Token sofort speichern — das alte gilt nicht mehr.
    const refresh = typeof r.json.refresh_token === 'string' && r.json.refresh_token ? r.json.refresh_token : v.refreshToken;
    const ablauf = Date.now() + Math.max(60, Number(r.json.expires_in) || 3600) * 1000;
    await updateJson<WhoopVerbindung | null>(verbindungName(person), cur => (cur && cur.v === 1 ? { ...cur, refreshToken: refresh, accessToken: access, ablauf, erneuertAm: new Date().toISOString() } : cur));
    return access;
  }
  if (r.status === 400 || r.status === 401 || r.json.error === 'invalid_grant') {
    await alsGetrenntMarkieren(person, 'Zugang wurde bei WHOOP widerrufen oder ist abgelaufen');
    throw new WhoopVerbindungsFehler('getrennt', TEXT.getrennt, 409);
  }
  throw new WhoopVerbindungsFehler('netz', TEXT.netz, 503);
}

/** Gültiges Zugriffstoken dieser Person — erneuert bei Bedarf (höchstens ein Erneuern je Person gleichzeitig). */
export async function whoopZugriffstoken(person: string, opt: { erneuern?: boolean } = {}): Promise<string> {
  const konfig = whoopKonfig();
  if (!konfig) throw new WhoopVerbindungsFehler('nicht-konfiguriert', TEXT['nicht-konfiguriert'], 409);
  const l = laufend.get(person);
  if (l) return l;
  const v = await ladeVerbindung(person);
  if (!v) throw new WhoopVerbindungsFehler('nicht-verbunden', TEXT['nicht-verbunden'], 409);
  if (v.status !== 'verbunden') throw new WhoopVerbindungsFehler('getrennt', TEXT.getrennt, 409);
  if (!opt.erneuern && v.accessToken && v.ablauf && Date.now() < v.ablauf - 60_000) return v.accessToken;
  const p = erneuern(person, v, konfig).finally(() => laufend.delete(person));
  laufend.set(person, p);
  return p;
}

// ── Trennen ─────────────────────────────────────────────────────────────────

/**
 * Trennen: bei WHOOP widerrufen (solange ein Token gilt), Verbindung und Spiegel samt Tageskopien löschen, Grabstein `{ v: 0 }`.
 * Beim Inhaber fällt auch ein noch nicht übernommener alter Rohbau-Token weg. Die übernommenen Werte (Vitalwerte, Trainings) bleiben —
 * sie gehören der Person; löschen kann sie sie dort.
 */
export async function whoopTrennen(person: string): Promise<{ war: boolean; widerrufen: boolean }> {
  if (!personOk(person)) return { war: false, widerrufen: false };
  const v = await ladeVerbindung(person);
  let widerrufen = false;
  if (v) {
    let token = v.status === 'verbunden' && v.accessToken && v.ablauf && Date.now() < v.ablauf - 60_000 ? v.accessToken : '';
    if (!token && v.status === 'verbunden') token = await whoopZugriffstoken(person, { erneuern: true }).catch(() => '');
    if (token) widerrufen = await zugriffWiderrufen(token);
  }
  await bestandEntfernen(verbindungName(person), { tageskopien: true }).catch(() => false);
  await bestandEntfernen(standName(person), { tageskopien: true }).catch(() => false);
  await saveJson(verbindungName(person), { v: 0, getrenntAm: new Date().toISOString() });
  return { war: !!v, widerrufen };
}

// ── Übergang: alter gemeinsamer Token (nur Inhaber) ─────────────────────────

interface AltToken { access_token?: string; refresh_token?: string; expires_at?: number; scope?: string; verbunden_am?: string }

/** Den alten Rohbau-Token EINMAL in den Bestand des Inhabers übernehmen — nie für eine andere Person. */
async function altUebernehmen(person: string): Promise<void> {
  const alt = await loadJson<Record<string, AltToken>>('oauth-tokens').catch(() => null);
  const t = alt?.whoop;
  if (!t?.refresh_token) return;
  const { inhaberSpeicher } = await import('@/lib/zugang/haushalt-inhaber');
  if ((await inhaberSpeicher()) !== person) return;
  const vorhanden = await loadJson<{ v?: number }>(verbindungName(person)).catch(() => null);
  if (!vorhanden) {
    const neu: WhoopVerbindung = {
      v: 1, userId: null, refreshToken: t.refresh_token, ...(t.access_token ? { accessToken: t.access_token } : {}), ...(typeof t.expires_at === 'number' ? { ablauf: t.expires_at } : {}),
      scopes: String(t.scope ?? '').split(/\s+/).filter(Boolean), verbundenAm: t.verbunden_am ?? new Date().toISOString(), status: 'verbunden', herkunft: 'alt',
    };
    await saveJson(verbindungName(person), neu);
  }
  // Ein vorhandener (auch getrennter) Bestand gewinnt — der alte Token wird in jedem Fall aus dem gemeinsamen Bestand genommen.
  await updateJson<Record<string, AltToken>>('oauth-tokens', cur => { const c = { ...(cur ?? {}) }; delete c.whoop; return c; });
}

/** `user_id` nachtragen, wo sie fehlt (übernommener alter Token) — braucht ein gültiges Token. */
export async function userIdNachtragen(person: string): Promise<void> {
  const v = await ladeVerbindung(person);
  if (!v || v.status !== 'verbunden' || v.userId !== null) return;
  const p = await profilLesen(await whoopZugriffstoken(person));
  if (!p) return;
  await updateJson<WhoopVerbindung | null>(verbindungName(person), cur => (cur && cur.v === 1 ? { ...cur, userId: p.userId, ...(p.email ? { email: p.email } : {}) } : cur));
}

// ── Status (für die Oberfläche — nie Tokens) ────────────────────────────────

export interface WhoopStatus {
  konfiguriert: boolean;
  /** Nur Namen fehlender Variablen (nie Werte) — damit die Karte sagt, was zu tun ist. */
  fehlt: string[];
  verbunden: boolean;
  getrennt?: { grund: string; seit?: string };
  /** k***@beispiel.de */
  konto?: string;
  seit?: string;
  /** Scopes, die WHOOP nicht gewährt hat (z. B. alter Token ohne Workouts) → neu verbinden. */
  scopesFehlen: string[];
  /** Aus dem alten gemeinsamen Token übernommen (nur Inhaber). */
  uebernommen?: boolean;
}

export async function whoopStatus(person: string): Promise<WhoopStatus> {
  const fehlt = whoopFehlt();
  const basis = { konfiguriert: fehlt.length === 0, fehlt };
  const v = await ladeVerbindung(person);
  if (!v) return { ...basis, verbunden: false, scopesFehlen: [] };
  const konto = v.email ? adresseMaskiert(v.email) : undefined;
  if (v.status !== 'verbunden') return { ...basis, verbunden: false, getrennt: { grund: v.getrenntGrund ?? 'getrennt', ...(v.getrenntAm ? { seit: v.getrenntAm } : {}) }, ...(konto ? { konto } : {}), scopesFehlen: [] };
  return { ...basis, verbunden: true, ...(konto ? { konto } : {}), seit: v.verbundenAm, scopesFehlen: v.scopes.length ? scopesFehlen(v.scopes) : [], ...(v.herkunft ? { uebernommen: true } : {}) };
}

/** Alle Personen mit einer aktiven Verbindung (aus einer Kandidatenliste, z. B. den Konten). */
export async function personenMitWhoop(kandidaten: readonly string[]): Promise<string[]> {
  const raus: string[] = [];
  for (const p of kandidaten) { const v = await ladeVerbindung(p).catch(() => null); if (v && v.status === 'verbunden') raus.push(p); }
  return raus;
}

/** Fehlen Pflicht-Scopes für den Abgleich? (Leere Scope-Liste beim alten Token = unbekannt → versuchen.) */
export const abgleichMoeglich = (v: WhoopVerbindung): boolean => !v.scopes.length || scopesFehlen(v.scopes, WHOOP_PFLICHT_SCOPES).length === 0;
