// ─── WhatsApp — Anfragen an die Graph-API von Meta (Server, 07.10.2026) ──────────────────────────────────────────────────
// EINE Stelle für alles, was Richtung Meta geht — die Versions-Konstante steht NUR hier (`GRAPH_VERSION`).
// Graph-API-Versionen: https://developers.facebook.com/docs/graph-api/changelog (abgerufen 07.10.2026: v26.0 vom 29.07.2026 ist die
// neueste). Beim Wechsel: hier hochsetzen, Tests laufen lassen, Changelog der WhatsApp Cloud API lesen.
//
// Sicherheit:
//   · Ziele nur `https://graph.facebook.com/<Version>/…` und — für den Medien-Download — eine von Meta gelieferte https-Adresse auf
//     einem Meta-Host (`MEDIEN_HOSTS`, Annahme: Meta nennt die Hosts nicht; wir lassen den Schlüssel nur dorthin). Keine Umleitungen.
//   · Der Zugriffsschlüssel geht nur im Kopf `Authorization: Bearer …` mit; nie in die Adresse, nie ins Log.
//   · Fehler von Meta werden in `WhatsappFehler` (deutscher Satz, lib/whatsapp/fehler.ts) übersetzt — der Rohtext von Meta geht nie an
//     den Browser.
// Tests ersetzen `fetch` über `_fetchSetzen` (kein Netz zu Meta in Tests).

import { metaFehler, NETZ, type WaFehlerArt, type WaFehlerText } from './fehler';
import type { WaKonfig } from './konfig';

export const GRAPH_VERSION = 'v26.0';
export const GRAPH_BASIS = `https://graph.facebook.com/${GRAPH_VERSION}`;
/** Hosts, an die der Medien-Download den Schlüssel schicken darf (Annahme, siehe Kopf). */
export const MEDIEN_HOSTS = [/\.fbsbx\.com$/, /\.facebook\.com$/, /\.fbcdn\.net$/, /\.whatsapp\.net$/] as const;

export class WhatsappFehler extends Error {
  constructor(public art: WaFehlerArt, message: string, public status: number, public code?: number, public erneuern = false) { super(message); }
  static aus(t: WaFehlerText, code?: number): WhatsappFehler { return new WhatsappFehler(t.art, t.text, t.status, code, t.erneuern); }
}

type FetchFn = (url: string, init: RequestInit) => Promise<Response>;
let fetchFn: FetchFn = (url, init) => fetch(url, init);
/** Nur für Tests: einen Fake für `fetch` setzen (null = zurück zum echten). */
export const _fetchSetzen = (f: FetchFn | null): void => { fetchFn = f ?? ((url, init) => fetch(url, init)); };

/** Wird gerufen, wenn Meta den Schlüssel ablehnt bzw. wieder annimmt (lib/whatsapp/zustand.ts meldet einmal an die Glocke). */
let tokenHaken: ((ok: boolean) => Promise<void>) | null = null;
export const tokenHakenSetzen = (f: ((ok: boolean) => Promise<void>) | null): void => { tokenHaken = f; };

interface MetaFehlerKoerper { error?: { code?: number; error_subcode?: number; message?: string } }

/** Eine JSON-Anfrage an die Graph-API. `pfad` beginnt mit „/“ (z. B. `/<Telefonnummer-ID>/messages`). Wirft `WhatsappFehler`. */
export async function graph<T>(k: Pick<WaKonfig, 'zugriff'>, pfad: string, o: { method?: 'GET' | 'POST'; body?: unknown; query?: Record<string, string> } = {}): Promise<T> {
  if (!/^\/[A-Za-z0-9_/]{1,200}$/.test(pfad)) throw new WhatsappFehler('unbekannt', 'Ungültiger Pfad.', 400);
  const url = new URL(`${GRAPH_BASIS}${pfad}`);
  for (const [a, b] of Object.entries(o.query ?? {})) url.searchParams.set(a, b);
  return graphUrl<T>(k, url.toString(), o);
}

/** Wie `graph`, aber mit einer vollständigen Adresse (nur für `paging.next` von Meta) — nur graph.facebook.com. */
export async function graphUrl<T>(k: Pick<WaKonfig, 'zugriff'>, adresse: string, o: { method?: 'GET' | 'POST'; body?: unknown } = {}): Promise<T> {
  let u: URL;
  try { u = new URL(adresse); } catch { throw new WhatsappFehler('unbekannt', 'Ungültige Adresse.', 400); }
  if (u.protocol !== 'https:' || u.hostname !== 'graph.facebook.com' || !u.pathname.startsWith(`/${GRAPH_VERSION}/`)) throw new WhatsappFehler('unbekannt', 'Unerwartete Adresse von Meta.', 502);
  u.searchParams.delete('access_token'); // nie den Schlüssel in der Adresse (Meta legt ihn manchmal in paging.next — Annahme)
  let r: Response;
  try {
    r = await fetchFn(u.toString(), {
      method: o.method ?? 'GET', redirect: 'error', signal: AbortSignal.timeout(15_000),
      headers: { Authorization: `Bearer ${k.zugriff}`, Accept: 'application/json', ...(o.body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      ...(o.body !== undefined ? { body: JSON.stringify(o.body) } : {}),
    });
  } catch { throw WhatsappFehler.aus(NETZ); }
  let j: unknown = null;
  try { j = await r.json(); } catch { j = null; }
  if (!r.ok) {
    const e = (j as MetaFehlerKoerper | null)?.error;
    const t = metaFehler(e?.code, e?.error_subcode);
    if (t.erneuern && tokenHaken) await tokenHaken(false).catch(() => {});
    throw WhatsappFehler.aus(t, e?.code);
  }
  if (tokenHaken) await tokenHaken(true).catch(() => {});
  return j as T;
}

/** Ist diese Adresse ein erlaubtes Medien-Ziel (https, Meta-Host)? Rein. */
export function medienAdresseOk(adresse: string): boolean {
  try {
    const u = new URL(adresse);
    return u.protocol === 'https:' && !u.username && !u.password && MEDIEN_HOSTS.some(h => h.test(u.hostname));
  } catch { return false; }
}

/** Eine Datei von Meta laden (Medien-Download, höchstens `max` Byte). Wirft `WhatsappFehler`. */
export async function medienLaden(k: Pick<WaKonfig, 'zugriff'>, adresse: string, max: number): Promise<Buffer> {
  if (!medienAdresseOk(adresse)) throw new WhatsappFehler('medien', 'Die Datei liegt nicht bei Meta — nicht geladen.', 502);
  let r: Response;
  try { r = await fetchFn(adresse, { redirect: 'error', signal: AbortSignal.timeout(60_000), headers: { Authorization: `Bearer ${k.zugriff}` } }); }
  catch { throw WhatsappFehler.aus(NETZ); }
  if (!r.ok) {
    if (r.status === 401 || r.status === 403) { const t = metaFehler(190); if (tokenHaken) await tokenHaken(false).catch(() => {}); throw WhatsappFehler.aus(t, 190); }
    throw WhatsappFehler.aus(metaFehler(131052), 131052);
  }
  const laenge = Number(r.headers.get('content-length') ?? '');
  if (Number.isFinite(laenge) && laenge > max) throw new WhatsappFehler('medien', 'Die Datei ist zu groß.', 413);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > max) throw new WhatsappFehler('medien', 'Die Datei ist zu groß.', 413);
  return buf;
}
