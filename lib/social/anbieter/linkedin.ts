// ─── MAKE OS — Social: LinkedIn als Person (Share on LinkedIn, Posts API) — 27.10.2026 ───────────────────────────────────────────────
// Fakten mit Quelle: research/social/FAKTEN_VEROEFFENTLICHEN.md (nur offizielle Doku, learn.microsoft.com/linkedin). Ohne Antrag nutzbar:
// Produkte „Share on LinkedIn“ (`w_member_social`) + „Sign in with LinkedIn using OpenID Connect“ (`openid profile`).
//   · Anmeldung: Authorization-Code, `state` einmalig (15 Min., an die Person der Sitzung gebunden), Code gilt 30 Min.
//   · Token: 60 Tage, KEIN Refresh-Token für Share-Apps → die Person verbindet alle 60 Tage neu (Glocke 7 Tage vorher, lage.ts).
//   · Autor: `urn:li:person:{sub}` aus `GET /v2/userinfo`.
//   · Beitrag: `POST /rest/posts` mit `LinkedIn-Version` + `X-Restli-Protocol-Version: 2.0.0`; Kennung im Kopf `x-restli-id`.
//   · Karussell → PDF-Dokument (`/rest/documents?action=initializeUpload`, PUT an `uploadUrl`, dann `content.media`). Ob der Status des
//     Dokuments mit nur `w_member_social` lesbar ist, sagt die Doku nicht (Annahme: nein) → kurze Wartezeit vor dem Post.
//   · Zahlen eigener Beiträge gibt es auf diesem Weg NICHT (`r_member_postAnalytics` nur mit Community-Management-Antrag) → `messen` = null,
//     die Zahlen kommen weiter über den CSV-Import.
// Zugangsdaten gehen nur an `www.linkedin.com` (Anmeldung) und `api.linkedin.com` — sonst nirgends; der Upload geht an die `uploadUrl`,
// die LinkedIn selbst zurückgibt (nur https, nur *.linkedin.com bzw. *.licdn.com).
// Umgebung (nie im Repo): LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, LINKEDIN_RUECKRUF_URL (sonst MAKE_OS_ADRESSE + Rückruf-Pfad),
// optional LINKEDIN_VERSION (Vorgabe unten — jede Version gilt ≥ 1 Jahr laut Doku).

import { randomBytes } from 'node:crypto';
import { updateJson } from '@/lib/store/local-db';
import type { SocialAnbieter, VerbindungGeheim, PostEingabe, PostErgebnis } from './typen';
import { karussellPdf, folienAus } from './karussell-pdf';
import { nurText } from './typen';

export const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
export const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
export const LINKEDIN_API = 'https://api.linkedin.com';
export const LINKEDIN_SCOPES: readonly string[] = ['openid', 'profile', 'w_member_social'];
export const LINKEDIN_RUECKRUF_PFAD = '/api/social/linkedin/rueckruf';
/** Neueste Version laut Doku (Oktober 2026). Über LINKEDIN_VERSION änderbar, ohne Code. */
export const LINKEDIN_VERSION_VORGABE = '202610';

type Umgebung = Readonly<Record<string, string | undefined>>;
export interface LinkedinKonfig { clientId: string; clientSecret: string; rueckrufUrl: string; version: string }

/** Was fehlt — nur NAMEN der Variablen. */
export function linkedinFehlt(env: Umgebung = process.env): string[] {
  const f: string[] = [];
  if (!env.LINKEDIN_CLIENT_ID?.trim()) f.push('LINKEDIN_CLIENT_ID');
  if (!env.LINKEDIN_CLIENT_SECRET?.trim()) f.push('LINKEDIN_CLIENT_SECRET');
  if (!env.LINKEDIN_RUECKRUF_URL?.trim() && !/^https:\/\/[^\s/]+/.test(env.MAKE_OS_ADRESSE ?? '')) f.push('LINKEDIN_RUECKRUF_URL oder MAKE_OS_ADRESSE (https)');
  return f;
}
export function linkedinKonfig(env: Umgebung = process.env): LinkedinKonfig | null {
  if (linkedinFehlt(env).length) return null;
  const rueckruf = env.LINKEDIN_RUECKRUF_URL?.trim() || `${(env.MAKE_OS_ADRESSE ?? '').trim().replace(/\/+$/, '')}${LINKEDIN_RUECKRUF_PFAD}`;
  const version = /^\d{6}$/.test(env.LINKEDIN_VERSION ?? '') ? env.LINKEDIN_VERSION! : LINKEDIN_VERSION_VORGABE;
  return { clientId: env.LINKEDIN_CLIENT_ID!.trim(), clientSecret: env.LINKEDIN_CLIENT_SECRET!.trim(), rueckrufUrl: rueckruf, version };
}
export const linkedinEingerichtet = (): boolean => linkedinKonfig() !== null;

const UPLOAD_HOST = /(^|\.)(linkedin\.com|licdn\.com)$/;
const uploadErlaubt = (u: string) => { try { const x = new URL(u); return x.protocol === 'https:' && UPLOAD_HOST.test(x.hostname); } catch { return false; } };

/** Für Tests: eigenes fetch. */
let holen: typeof fetch = (...a) => fetch(...a);
export function _linkedinFetchSetzen(f: typeof fetch | null) { holen = f ?? ((...a) => fetch(...a)); }

// ── Anmeldung: state je Person ────────────────────────────────────────────────────────────────────────────────────────────────────
const ZUSTAND = 'social-linkedin-zustand';
interface Offen { state: string; person: string; kanalId: string; bis: number }

export async function linkedinStart(person: string, kanalId: string, jetzt = Date.now()): Promise<string> {
  const k = linkedinKonfig();
  if (!k) throw new Error('LinkedIn ist in dieser Instanz noch nicht eingerichtet.');
  const state = randomBytes(24).toString('base64url');
  await updateJson<{ offen: Offen[] }>(ZUSTAND, cur => {
    const offen = (cur?.offen ?? []).filter(o => o.bis > jetzt && o.person !== person);
    return { offen: [...offen, { state, person, kanalId, bis: jetzt + 15 * 60_000 }] };
  });
  const q = new URLSearchParams({ response_type: 'code', client_id: k.clientId, redirect_uri: k.rueckrufUrl, state, scope: LINKEDIN_SCOPES.join(' ') });
  return `${LINKEDIN_AUTH_URL}?${q}`;
}

export type LinkedinAbschluss = { ok: true; kanalId: string; geheim: VerbindungGeheim; konto?: string } | { ok: false; grund: 'state' | 'token' | 'profil' | 'einrichtung' };

/** Rückruf: state einlösen (einmalig, nur die Person, die gestartet hat), Code gegen Token, Autor aus userinfo. */
export async function linkedinAbschliessen(person: string, code: string, state: string, jetzt = Date.now()): Promise<LinkedinAbschluss> {
  const k = linkedinKonfig();
  if (!k) return { ok: false, grund: 'einrichtung' };
  let gefunden: Offen | null = null;
  await updateJson<{ offen: Offen[] }>(ZUSTAND, cur => {
    const offen = (cur?.offen ?? []).filter(o => o.bis > jetzt);
    gefunden = offen.find(o => o.state === state && o.person === person) ?? null;
    return { offen: offen.filter(o => o.state !== state) };
  });
  const offen = gefunden as Offen | null;
  if (!offen) return { ok: false, grund: 'state' };
  const t = await holen(LINKEDIN_TOKEN_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, client_id: k.clientId, client_secret: k.clientSecret, redirect_uri: k.rueckrufUrl }),
  }).catch(() => null);
  const tj = t?.ok ? await t.json().catch(() => null) as { access_token?: string; expires_in?: number; scope?: string } | null : null;
  if (!tj?.access_token) return { ok: false, grund: 'token' };
  const u = await holen(`${LINKEDIN_API}/v2/userinfo`, { headers: { Authorization: `Bearer ${tj.access_token}` } }).catch(() => null);
  const uj = u?.ok ? await u.json().catch(() => null) as { sub?: string; name?: string } | null : null;
  if (!uj?.sub) return { ok: false, grund: 'profil' };
  return {
    ok: true, kanalId: offen.kanalId, konto: typeof uj.name === 'string' ? uj.name.slice(0, 80) : undefined,
    geheim: { accessToken: tj.access_token, ablauf: jetzt + (tj.expires_in ?? 5_184_000) * 1000, autor: `urn:li:person:${uj.sub}`, scopes: (tj.scope ?? '').split(/[ ,]+/).filter(Boolean) },
  };
}

// ── Veröffentlichen ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
const koepfe = (g: VerbindungGeheim, version: string) => ({
  Authorization: `Bearer ${g.accessToken}`, 'LinkedIn-Version': version, 'X-Restli-Protocol-Version': '2.0.0', 'Content-Type': 'application/json',
});
const warte = (ms: number) => new Promise(r => setTimeout(r, ms));
/** Wartezeit nach dem Dokument-Upload (Annahme, s. Kopf) — in Tests 0. */
export const DOKUMENT_WARTEN_MS = { wert: 20_000 };

function fehlerAus(status: number, gesendet: boolean): PostErgebnis {
  if (status === 401) return { ok: false, erneuern: true, text: 'LinkedIn hat die Anmeldung abgelehnt (Token abgelaufen oder zurückgezogen) — neu verbinden.' };
  if (status === 403) return { ok: false, text: 'LinkedIn erlaubt diesen Beitrag mit dieser Verbindung nicht (Berechtigung fehlt).' };
  if (status === 429) return { ok: false, text: 'LinkedIn-Tageslimit erreicht — später erneut.' };
  if (status === 0) return { ok: false, unklar: gesendet, text: gesendet ? 'Keine Antwort von LinkedIn — bitte dort nachsehen, ob der Beitrag online ist.' : 'LinkedIn nicht erreichbar.' };
  return { ok: false, unklar: status >= 500 && gesendet, text: `LinkedIn antwortete mit ${status}.` };
}

async function beitragSenden(g: VerbindungGeheim, k: LinkedinKonfig, commentary: string, content?: Record<string, unknown>): Promise<PostErgebnis> {
  const body = {
    author: g.autor, commentary, visibility: 'PUBLIC',
    distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
    ...(content ? { content } : {}), lifecycleState: 'PUBLISHED', isReshareDisabledByAuthor: false,
  };
  const ab = new AbortController();
  const uhr = setTimeout(() => ab.abort(), 30_000);
  try {
    const r = await holen(`${LINKEDIN_API}/rest/posts`, { method: 'POST', headers: koepfe(g, k.version), body: JSON.stringify(body), signal: ab.signal });
    if (r.status === 201 || r.ok) {
      const id = r.headers.get('x-restli-id') ?? undefined;
      return { ok: true, externeId: id, link: id ? `https://www.linkedin.com/feed/update/${encodeURIComponent(id)}/` : undefined };
    }
    return fehlerAus(r.status, true);
  } catch {
    return fehlerAus(0, true);
  } finally { clearTimeout(uhr); }
}

/**
 * LinkedIn-Text („little“-Format): reservierte Zeichen werden maskiert (Doku Posts API › little text format). Ein `#` direkt vor einem
 * Wort bleibt stehen — so schreibt die Doku Hashtags (`#wort`); Annahme: nur dieses `#` ist als Hashtag gemeint.
 */
export const commentaryAus = (t: string): string => t.replace(/[\\|{}@[\]()<>*_~]|#(?![\p{L}\p{N}])/gu, c => `\\${c}`);

async function dokumentHochladen(g: VerbindungGeheim, k: LinkedinKonfig, pdf: Uint8Array): Promise<{ ok: true; urn: string } | { ok: false; e: PostErgebnis }> {
  const init = await holen(`${LINKEDIN_API}/rest/documents?action=initializeUpload`, { method: 'POST', headers: koepfe(g, k.version), body: JSON.stringify({ initializeUploadRequest: { owner: g.autor } }) }).catch(() => null);
  if (!init?.ok) return { ok: false, e: fehlerAus(init?.status ?? 0, false) };
  const v = (await init.json().catch(() => null) as { value?: { uploadUrl?: string; document?: string } } | null)?.value;
  if (!v?.uploadUrl || !v.document || !uploadErlaubt(v.uploadUrl)) return { ok: false, e: { ok: false, text: 'LinkedIn gab keine gültige Upload-Adresse zurück.' } };
  const put = await holen(v.uploadUrl, { method: 'PUT', headers: { Authorization: `Bearer ${g.accessToken}`, 'Content-Type': 'application/octet-stream' }, body: pdf as unknown as BodyInit }).catch(() => null);
  if (!put?.ok) return { ok: false, e: fehlerAus(put?.status ?? 0, false) };
  return { ok: true, urn: v.document };
}

export const linkedinAnbieter: SocialAnbieter = {
  id: 'linkedin', plattform: 'linkedin', name: 'LinkedIn (als Person)',
  kann(f, format) {
    const art = format?.art ?? 'video';
    if (art === 'karussell') return folienAus(f.skript).length >= 2 ? { ok: true } : { ok: false, grund: 'Karussell ohne Folien — Folien im Skript mit einer Zeile „---“ trennen.' };
    return nurText(f, format);
  },
  async posten(g: VerbindungGeheim, e: PostEingabe): Promise<PostErgebnis> {
    const k = linkedinKonfig();
    if (!k) return { ok: false, text: 'LinkedIn ist in dieser Instanz nicht (mehr) eingerichtet.' };
    if (!g.autor) return { ok: false, erneuern: true, text: 'Die Verbindung kennt den Autor nicht — neu verbinden.' };
    if (g.ablauf && g.ablauf < Date.now()) return { ok: false, erneuern: true, text: 'Die LinkedIn-Anmeldung ist abgelaufen (60 Tage) — neu verbinden.' };
    if ((e.format?.art ?? 'video') === 'karussell') {
      const folien = folienAus(e.folge.skript);
      const pdf = await karussellPdf(e.folge.titel, folien);
      const up = await dokumentHochladen(g, k, pdf);
      if (!up.ok) return up.e;
      if (DOKUMENT_WARTEN_MS.wert) await warte(DOKUMENT_WARTEN_MS.wert);
      const begleit = [e.folge.hooks.find(h => h.id === e.folge.hookId)?.text ?? e.folge.hooks[0]?.text, e.folge.cta].filter(Boolean).join('\n\n');
      return beitragSenden(g, k, commentaryAus(begleit || e.folge.titel), { media: { title: `${e.folge.titel.slice(0, 80)}.pdf`, id: up.urn } });
    }
    return beitragSenden(g, k, commentaryAus(e.text));
  },
  async messen() { return null; },
};
