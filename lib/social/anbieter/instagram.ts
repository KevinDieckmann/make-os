// ─── MAKE OS — Social: Instagram (Instagram API with Instagram Login) — 28.10.2026, Malin-Paket ─────────────────────────────────────────
// Fakten mit Quelle: research/social/FAKTEN_VEROEFFENTLICHEN.md › 3 und research/social/FAKTEN_MALIN_PAKET.md (nur offizielle Doku von Meta).
//   · Konto: Instagram-Professional-Konto (Business oder Creator), KEINE Facebook-Seite nötig. Eigene Konten: Standard Access ohne App Review.
//   · Anmeldung: `www.instagram.com/oauth/authorize` → Code (1 h, einmal; angehängtes `#_` abschneiden) → `api.instagram.com/oauth/access_token`
//     (kurz, 1 h) → `graph.instagram.com/access_token?grant_type=ig_exchange_token` (lang, 60 Tage). Verlängern mit `refresh_access_token`
//     frühestens 24 h nach Ausstellung, nur solange es gilt — der Takt verlängert ab 7 Tagen Restlaufzeit (`erneuern`), sonst Glocke.
//   · Veröffentlichen in Schritten (Container): `POST /<IG_ID>/media` (image_url | media_type=REELS + video_url | is_carousel_item) →
//     `GET /<container>?fields=status_code` (FINISHED · IN_PROGRESS · ERROR · EXPIRED · PUBLISHED) → `POST /<IG_ID>/media_publish`.
//     Container gelten 24 h. KI-Inhalt: `is_ai_generated=true` am Container (beim Karussell am Karussell-Container).
//     Ein Video braucht Minuten — deshalb `warten`: der Veröffentlicher setzt im nächsten Lauf mit `weiter` fort (nie blockierend).
//   · Medien holt Meta selbst über eine öffentliche https-Adresse (lib/social/medien-link.ts) — Bilder nur JPEG, Videos nur aus der Werkstatt.
//   · Zahlen: `GET /<media>/insights?metric=views,reach,likes,comments,shares,saved` (Reels zusätzlich Wiedergabezeit); für Karussell-Alben gibt
//     es laut Doku keine Insights → null. `impressions` ist abgeschaltet.
// Zugangsdaten gehen nur an `www.instagram.com` (Anmeldung, nur der Browser), `api.instagram.com` und `graph.instagram.com` — sonst nirgends.
// Umgebung (nie im Repo, gesetzt über deploy/instagram-verbinden.sh): INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, INSTAGRAM_RUECKRUF_URL (sonst
// MAKE_OS_ADRESSE + Rückruf-Pfad), optional INSTAGRAM_GRAPH_VERSION.

import { randomBytes } from 'node:crypto';
import { updateJson } from '@/lib/store/local-db';
import type { SocialAnbieter, VerbindungGeheim, PostEingabe, PostErgebnis, Zahlen } from './typen';
import { instagramMedien } from '../medien';

export const IG_AUTH_URL = 'https://www.instagram.com/oauth/authorize';
export const IG_TOKEN_URL = 'https://api.instagram.com/oauth/access_token';
export const IG_GRAPH = 'https://graph.instagram.com';
/** Scopes (Namen seit 27.01.2025): Profil, Veröffentlichen, Kommentare, Nachrichten, Insights. */
export const IG_SCOPES: readonly string[] = [
  'instagram_business_basic', 'instagram_business_content_publish', 'instagram_business_manage_comments',
  'instagram_business_manage_messages', 'instagram_business_manage_insights',
];
export const IG_RUECKRUF_PFAD = '/api/social/instagram/rueckruf';
/** Version der Graph-API — Doku-Beispiele nutzen v26.0; über INSTAGRAM_GRAPH_VERSION änderbar, ohne Code. */
export const IG_VERSION_VORGABE = 'v26.0';
/** So lange darf ein Versuch auf Meta warten, dann gilt er als gescheitert (der Medien-Link gilt 60 Min.). */
export const IG_WARTEN_MAX_MIN = 55;

type Umgebung = Readonly<Record<string, string | undefined>>;
export interface InstagramKonfig { appId: string; appSecret: string; rueckrufUrl: string; version: string }

/** Was fehlt — nur NAMEN der Variablen. */
export function instagramFehlt(env: Umgebung = process.env): string[] {
  const f: string[] = [];
  if (!env.INSTAGRAM_APP_ID?.trim()) f.push('INSTAGRAM_APP_ID');
  if (!env.INSTAGRAM_APP_SECRET?.trim()) f.push('INSTAGRAM_APP_SECRET');
  if (!env.INSTAGRAM_RUECKRUF_URL?.trim() && !/^https:\/\/[^\s/]+/.test(env.MAKE_OS_ADRESSE ?? '')) f.push('INSTAGRAM_RUECKRUF_URL oder MAKE_OS_ADRESSE (https)');
  return f;
}
export function instagramKonfig(env: Umgebung = process.env): InstagramKonfig | null {
  if (instagramFehlt(env).length) return null;
  const rueckruf = env.INSTAGRAM_RUECKRUF_URL?.trim() || `${(env.MAKE_OS_ADRESSE ?? '').trim().replace(/\/+$/, '')}${IG_RUECKRUF_PFAD}`;
  const version = /^v\d{2}\.\d$/.test(env.INSTAGRAM_GRAPH_VERSION ?? '') ? env.INSTAGRAM_GRAPH_VERSION! : IG_VERSION_VORGABE;
  return { appId: env.INSTAGRAM_APP_ID!.trim(), appSecret: env.INSTAGRAM_APP_SECRET!.trim(), rueckrufUrl: rueckruf, version };
}
export const instagramEingerichtet = (): boolean => instagramKonfig() !== null;

/** Für Tests: eigenes fetch. */
let holen: typeof fetch = (...a) => fetch(...a);
export function _instagramFetchSetzen(f: typeof fetch | null) { holen = f ?? ((...a) => fetch(...a)); }

// ── Anmeldung ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const ZUSTAND = 'social-instagram-zustand';
interface Offen { state: string; person: string; kanalId: string; bis: number }

export async function instagramStart(person: string, kanalId: string, jetzt = Date.now()): Promise<string> {
  const k = instagramKonfig();
  if (!k) throw new Error('Instagram ist in dieser Instanz noch nicht eingerichtet.');
  const state = randomBytes(24).toString('base64url');
  await updateJson<{ offen: Offen[] }>(ZUSTAND, cur => {
    const offen = (cur?.offen ?? []).filter(o => o.bis > jetzt && o.person !== person);
    return { offen: [...offen, { state, person, kanalId, bis: jetzt + 15 * 60_000 }] };
  });
  const q = new URLSearchParams({ client_id: k.appId, redirect_uri: k.rueckrufUrl, response_type: 'code', scope: IG_SCOPES.join(','), state });
  return `${IG_AUTH_URL}?${q}`;
}

export type InstagramAbschluss = { ok: true; kanalId: string; geheim: VerbindungGeheim; konto?: string } | { ok: false; grund: 'state' | 'token' | 'profil' | 'einrichtung' | 'konto' };

const json = async <T>(r: Response | null): Promise<T | null> => (r ? await r.json().catch(() => null) as T | null : null);

/** Rückruf: state einlösen (einmalig, nur die Person, die gestartet hat), Code → kurzes Token → langes Token, Konto aus `/me`. */
export async function instagramAbschliessen(person: string, codeRoh: string, state: string, jetzt = Date.now()): Promise<InstagramAbschluss> {
  const k = instagramKonfig();
  if (!k) return { ok: false, grund: 'einrichtung' };
  let gefunden: Offen | null = null;
  await updateJson<{ offen: Offen[] }>(ZUSTAND, cur => {
    const offen = (cur?.offen ?? []).filter(o => o.bis > jetzt);
    gefunden = offen.find(o => o.state === state && o.person === person) ?? null;
    return { offen: offen.filter(o => o.state !== state) };
  });
  const offen = gefunden as Offen | null;
  if (!offen) return { ok: false, grund: 'state' };
  const code = codeRoh.replace(/#_$/, '');
  const t = await holen(IG_TOKEN_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: k.appId, client_secret: k.appSecret, grant_type: 'authorization_code', redirect_uri: k.rueckrufUrl, code }),
  }).catch(() => null);
  // Die Antwort kommt je nach Version flach oder als `data: [ … ]` — beides lesen.
  const tj = t?.ok ? await json<{ access_token?: string; permissions?: string[] | string; data?: { access_token?: string; permissions?: string }[] }>(t) : null;
  const kurz = tj?.access_token ?? tj?.data?.[0]?.access_token;
  if (!kurz) return { ok: false, grund: 'token' };
  const l = await holen(`${IG_GRAPH}/access_token?${new URLSearchParams({ grant_type: 'ig_exchange_token', client_secret: k.appSecret, access_token: kurz })}`).catch(() => null);
  const lj = l?.ok ? await json<{ access_token?: string; expires_in?: number }>(l) : null;
  if (!lj?.access_token) return { ok: false, grund: 'token' };
  const me = await holen(`${IG_GRAPH}/${k.version}/me?${new URLSearchParams({ fields: 'user_id,username,account_type', access_token: lj.access_token })}`).catch(() => null);
  const mj = me?.ok ? await json<{ user_id?: string | number; username?: string; account_type?: string }>(me) : null;
  if (!mj?.user_id) return { ok: false, grund: 'profil' };
  // Nur Professional-Konten (Business, Creator) können veröffentlichen — ein privates Konto lehnen wir gleich hier ab.
  if (mj.account_type && !/^(BUSINESS|MEDIA_CREATOR|CREATOR)$/i.test(mj.account_type)) return { ok: false, grund: 'konto' };
  const scopes = Array.isArray(tj?.permissions) ? tj!.permissions : String(tj?.permissions ?? tj?.data?.[0]?.permissions ?? '').split(/[ ,]+/).filter(Boolean);
  return {
    ok: true, kanalId: offen.kanalId, konto: typeof mj.username === 'string' ? `@${mj.username.slice(0, 60)}` : undefined,
    geheim: { accessToken: lj.access_token, ablauf: jetzt + (lj.expires_in ?? 5_184_000) * 1000, ausgestellt: jetzt, autor: String(mj.user_id), scopes },
  };
}

// ── Graph-Aufrufe ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
interface GraphFehler { error?: { message?: string; code?: number; error_subcode?: number; type?: string } }
export type GraphAntwort<T> = { ok: true; daten: T } | { ok: false; status: number; code?: number; text: string };

export async function igGraph<T>(g: VerbindungGeheim, k: InstagramKonfig, pfad: string, o: { methode?: 'GET' | 'POST'; params?: Record<string, string>; zeitMs?: number } = {}): Promise<GraphAntwort<T>> {
  const params = new URLSearchParams({ ...(o.params ?? {}), access_token: g.accessToken });
  const url = `${IG_GRAPH}/${k.version}/${pfad}`;
  const ab = new AbortController();
  const uhr = setTimeout(() => ab.abort(), o.zeitMs ?? 30_000);
  try {
    const r = o.methode === 'POST'
      ? await holen(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params, signal: ab.signal })
      : await holen(`${url}?${params}`, { signal: ab.signal });
    const j = await r.json().catch(() => null) as (T & GraphFehler) | null;
    if (r.ok && j && !j.error) return { ok: true, daten: j };
    return { ok: false, status: r.status, code: j?.error?.code, text: (j?.error?.message ?? `Instagram antwortete mit ${r.status}.`).slice(0, 200) };
  } catch {
    return { ok: false, status: 0, text: 'Instagram nicht erreichbar oder keine Antwort.' };
  } finally { clearTimeout(uhr); }
}

/** Fehler der Graph-API → Ergebnis. 190 = Token ungültig; 4/17/32/613 = Limit; `gesendet` = die Wirkung kann eingetreten sein. */
function fehlerAus(a: { status: number; code?: number; text: string }, gesendet: boolean): PostErgebnis {
  if (a.code === 190 || a.status === 401) return { ok: false, erneuern: true, text: 'Instagram hat die Anmeldung abgelehnt (abgelaufen oder zurückgezogen) — neu verbinden.' };
  if (a.code === 4 || a.code === 17 || a.code === 32 || a.code === 613 || a.status === 429) return { ok: false, text: 'Instagram-Limit erreicht — später erneut (Veröffentlichungen je 24 h sind begrenzt).' };
  if (a.status === 0) return { ok: false, unklar: gesendet, text: gesendet ? 'Keine Antwort von Instagram — bitte dort nachsehen, ob der Beitrag online ist.' : 'Instagram nicht erreichbar.' };
  return { ok: false, unklar: gesendet && a.status >= 500, text: `Instagram: ${a.text}` };
}

/** Zustand eines laufenden Versuchs (in `PostVersuch.warten`, nie ein Token). */
interface IgWarten { art: 'bild' | 'reel' | 'karussell'; kinder: string[]; eltern?: string; seit: number }
const wartenAus = (s: string): IgWarten | null => {
  try {
    const o = JSON.parse(s) as IgWarten;
    return o && ['bild', 'reel', 'karussell'].includes(o.art) && Array.isArray(o.kinder) && o.kinder.every(x => /^\d{1,40}$/.test(x)) && (!o.eltern || /^\d{1,40}$/.test(o.eltern)) && typeof o.seit === 'number' ? o : null;
  } catch { return null; }
};

/** Instagram-Beschriftung: höchstens 2.200 Zeichen, 30 Hashtags (Doku Content Publishing) — darüber lehnen wir ab, nie still gekürzt. */
export const IG_TEXT_MAX = 2200;
export const IG_HASHTAGS_MAX = 30;
export function igTextPruefen(t: string): string | null {
  if (t.length > IG_TEXT_MAX) return `Der Text ist ${t.length} Zeichen lang — Instagram nimmt höchstens ${IG_TEXT_MAX}.`;
  const tags = t.match(/#[\p{L}\p{N}_]+/gu)?.length ?? 0;
  if (tags > IG_HASHTAGS_MAX) return `${tags} Hashtags — Instagram nimmt höchstens ${IG_HASHTAGS_MAX}.`;
  return null;
}

async function statusVon(g: VerbindungGeheim, k: InstagramKonfig, id: string): Promise<'fertig' | 'laeuft' | 'fehler' | { fehler: PostErgebnis }> {
  const r = await igGraph<{ status_code?: string; status?: string }>(g, k, id, { params: { fields: 'status_code,status' } });
  if (!r.ok) return r.code === 190 || r.status === 401 ? { fehler: fehlerAus(r, false) } : 'laeuft'; // Netzfehler beim NACHSEHEN: einfach später erneut
  const s = r.daten.status_code;
  if (s === 'FINISHED' || s === 'PUBLISHED') return 'fertig';
  if (s === 'ERROR' || s === 'EXPIRED') return 'fehler';
  return 'laeuft';
}

async function veroeffentlichen(g: VerbindungGeheim, k: InstagramKonfig, container: string): Promise<PostErgebnis> {
  const r = await igGraph<{ id?: string }>(g, k, 'me/media_publish', { methode: 'POST', params: { creation_id: container }, zeitMs: 60_000 });
  if (!r.ok) return fehlerAus(r, true);
  const id = r.daten.id;
  if (!id) return { ok: false, unklar: true, text: 'Instagram bestätigte ohne Kennung — bitte dort nachsehen.' };
  const p = await igGraph<{ permalink?: string }>(g, k, id, { params: { fields: 'permalink' } });
  const link = p.ok && typeof p.daten.permalink === 'string' && /^https:\/\/(www\.)?instagram\.com\//.test(p.daten.permalink) ? p.daten.permalink : undefined;
  return { ok: true, externeId: id, ...(link ? { link } : {}) };
}

/** Ein Schritt weiter: Kinder fertig? → Eltern (Karussell) anlegen → fertig? → veröffentlichen. */
async function schritt(g: VerbindungGeheim, k: InstagramKonfig, w: IgWarten, e: PostEingabe, jetzt: number): Promise<PostErgebnis> {
  const ki: Record<string, string> = e.folge.kiInhalt ? { is_ai_generated: 'true' } : {};
  if (jetzt - w.seit > IG_WARTEN_MAX_MIN * 60_000) return { ok: false, text: `Instagram hat das Medium nach ${IG_WARTEN_MAX_MIN} Minuten nicht fertig verarbeitet — neu planen.` };
  const offen = w.eltern ? [w.eltern] : w.kinder;
  for (const id of offen) {
    const s = await statusVon(g, k, id);
    if (typeof s === 'object') return s.fehler;
    if (s === 'fehler') return { ok: false, text: 'Instagram konnte ein Medium nicht verarbeiten (Format, Länge oder Datei nicht erreichbar).' };
    if (s === 'laeuft') return { ok: 'warten', warten: JSON.stringify(w) };
  }
  if (w.art === 'karussell' && !w.eltern) {
    const r = await igGraph<{ id?: string }>(g, k, 'me/media', { methode: 'POST', params: { media_type: 'CAROUSEL', children: w.kinder.join(','), caption: e.text, ...ki } });
    if (!r.ok || !r.daten.id) return r.ok ? { ok: false, text: 'Instagram gab für das Karussell keine Kennung zurück.' } : fehlerAus(r, false);
    return schritt(g, k, { ...w, eltern: r.daten.id }, e, jetzt);
  }
  return veroeffentlichen(g, k, w.eltern ?? w.kinder[0]);
}

export const instagramAnbieter: SocialAnbieter = {
  id: 'instagram', plattform: 'instagram', name: 'Instagram (Professional-Konto)',
  kann(f, format, medien) {
    if (!/^https:\/\//.test(process.env.MAKE_OS_ADRESSE ?? '')) return { ok: false, grund: 'Instagram holt Bilder selbst ab — dafür braucht die Instanz eine öffentliche https-Adresse (MAKE_OS_ADRESSE).' };
    const p = instagramMedien(f, format, medien);
    return p.ok ? { ok: true } : p;
  },
  async posten(g: VerbindungGeheim, e: PostEingabe): Promise<PostErgebnis> {
    const k = instagramKonfig();
    if (!k) return { ok: false, text: 'Instagram ist in dieser Instanz nicht (mehr) eingerichtet.' };
    if (g.ablauf && g.ablauf < Date.now()) return { ok: false, erneuern: true, text: 'Die Instagram-Anmeldung ist abgelaufen (60 Tage) — neu verbinden.' };
    const zuLang = igTextPruefen(e.text);
    if (zuLang) return { ok: false, text: zuLang };
    const medien = new Map((e.medien ?? []).map(m => [m.id, m] as const));
    const plan = instagramMedien(e.folge, e.format, medien);
    if (!plan.ok) return { ok: false, text: plan.grund };
    if (!e.link) return { ok: false, text: 'Kein öffentlicher Link für die Medien (MAKE_OS_ADRESSE fehlt).' };
    // KI-Kennzeichnung per API (Feld `is_ai_generated` am Container; beim Karussell am Karussell-Container) — Art. 50 KI-VO.
    const ki: Record<string, string> = e.folge.kiInhalt ? { is_ai_generated: 'true' } : {};
    const kinder: string[] = [];
    for (const m of plan.medien) {
      const url = await e.link(m);
      if (!url) return { ok: false, text: 'Kein öffentlicher Link für ein Medium.' };
      const params: Record<string, string> = plan.art === 'karussell'
        ? { is_carousel_item: 'true', ...(m.art === 'bild' ? { image_url: url } : { media_type: 'VIDEO', video_url: url }) }
        : plan.art === 'reel'
          ? { media_type: 'REELS', video_url: url, caption: e.text, share_to_feed: 'true', ...ki }
          : { image_url: url, caption: e.text, ...ki };
      const r = await igGraph<{ id?: string }>(g, k, 'me/media', { methode: 'POST', params });
      if (!r.ok || !r.daten.id) return r.ok ? { ok: false, text: 'Instagram gab keine Container-Kennung zurück.' } : fehlerAus(r, false);
      kinder.push(r.daten.id);
    }
    return schritt(g, k, { art: plan.art, kinder, seit: Date.now() }, e, Date.now());
  },
  async weiter(g: VerbindungGeheim, warten: string, e: PostEingabe): Promise<PostErgebnis> {
    const k = instagramKonfig();
    if (!k) return { ok: false, text: 'Instagram ist in dieser Instanz nicht (mehr) eingerichtet.' };
    const w = wartenAus(warten);
    if (!w) return { ok: false, text: 'Der Zwischenstand bei Instagram ist unlesbar — neu planen.' };
    return schritt(g, k, w, e, Date.now());
  },
  async erneuern(g: VerbindungGeheim, jetzt: number): Promise<VerbindungGeheim | null> {
    // Doku: frühestens 24 h nach Ausstellung, nur solange gültig. Wir verlängern ab 7 Tagen Restlaufzeit.
    if (!g.ablauf || g.ablauf < jetzt || g.ablauf - jetzt > 7 * 86_400_000) return null;
    if (g.ausgestellt && jetzt - g.ausgestellt < 24 * 3_600_000) return null;
    const r = await holen(`${IG_GRAPH}/refresh_access_token?${new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: g.accessToken })}`).catch(() => null);
    const j = r?.ok ? await json<{ access_token?: string; expires_in?: number }>(r) : null;
    if (!j?.access_token) return null;
    return { ...g, accessToken: j.access_token, ablauf: jetzt + (j.expires_in ?? 5_184_000) * 1000, ausgestellt: jetzt };
  },
  async messen(g: VerbindungGeheim, externeId: string): Promise<Zahlen | null> {
    const k = instagramKonfig();
    if (!k || !/^\d{1,40}$/.test(externeId)) return null;
    const r = await igGraph<{ data?: { name?: string; values?: { value?: number }[]; total_value?: { value?: number } }[] }>(g, k, `${externeId}/insights`, { params: { metric: 'views,likes,comments,shares,saved' } });
    if (!r.ok) return null;
    const wert = (n: string) => {
      const x = r.daten.data?.find(d => d.name === n);
      const v = x?.total_value?.value ?? x?.values?.[0]?.value;
      return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined;
    };
    const views = wert('views');
    if (views === undefined) return null;
    return { views, likes: wert('likes'), kommentare: wert('comments'), shares: wert('shares'), saves: wert('saved') };
  },
};
