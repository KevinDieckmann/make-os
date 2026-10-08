// ─── WHOOP — Anfragen an die API v2 (Server, 08.10.2026) ─────────────────────────────────────────────────────────────────
// Eine Stelle für jeden Aufruf von api.prod.whoop.com/developer (Doku: https://developer.whoop.com/api,
// Rate-Limits: https://developer.whoop.com/docs/developing/rate-limiting). Zugriffstoken der Person (verbindung.ts), bei 401 einmal
// erneuern und wiederholen. Fehler:
//   WhoopUeberlastet   429 — Pause nach `X-RateLimit-Reset` (Sekunden; ein Retry-After nennt die Doku nicht), sonst Backoff
//   WhoopApiFehler     alles andere, das nicht als Antwort zurückkommt (401 nach Erneuern, 5xx = `vorlaeufig`, Netz)
// Nie wird ein Token geloggt oder in einen Fehlertext geschrieben.

import { WHOOP_API, whoopHost } from './konfig';
import { whoopZugriffstoken } from './verbindung';

export class WhoopApiFehler extends Error {
  constructor(message: string, public status: number, public vorlaeufig = false) { super(message); }
}
export class WhoopUeberlastet extends WhoopApiFehler {
  constructor(message: string, public sekunden?: number) { super(message, 429, true); }
}

/** `X-RateLimit-Reset` (Sekunden) bzw. `Retry-After` → Sekunden, gedeckelt auf eine Stunde. */
export function pauseSekunden(kopf: Headers): number | undefined {
  for (const n of ['x-ratelimit-reset', 'retry-after']) {
    const v = Number((kopf.get(n) ?? '').trim());
    if (Number.isFinite(v) && v > 0) return Math.min(3600, Math.ceil(v));
  }
  return undefined;
}

export async function whoopAnfrage<T = Record<string, unknown>>(person: string, pfad: string, query: Record<string, string | number | undefined> = {}): Promise<{ status: number; json: T }> {
  const u = new URL(`${WHOOP_API}${pfad}`);
  for (const [k, v] of Object.entries(query)) if (v !== undefined) u.searchParams.set(k, String(v));
  if (!whoopHost(u.toString()) || !pfad.startsWith('/v2/')) throw new WhoopApiFehler('Unerwartete Adresse — Abbruch.', 502);
  for (let versuch = 0; versuch < 2; versuch++) {
    const token = await whoopZugriffstoken(person, { erneuern: versuch > 0 });
    let r: Response;
    try {
      r = await fetch(u.toString(), { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'User-Agent': 'MAKE OS' }, signal: AbortSignal.timeout(25_000), redirect: 'error' });
    } catch (e) {
      const name = (e as { name?: string } | null)?.name;
      throw new WhoopApiFehler(name === 'TimeoutError' || name === 'AbortError' ? 'WHOOP antwortet nicht (Zeitüberschreitung).' : 'WHOOP ist gerade nicht erreichbar.', 504, true);
    }
    if (r.status === 401 && versuch === 0) continue; // abgelaufen → einmal erneuern
    if (r.status === 429) throw new WhoopUeberlastet('WHOOP bittet um Pause (429) — neuer Versuch später.', pauseSekunden(r.headers));
    if (r.status === 401) throw new WhoopApiFehler('WHOOP lehnt den Zugriff ab (401).', 401);
    if (r.status >= 500) throw new WhoopApiFehler(`WHOOP meldet einen Fehler (${r.status}).`, r.status, true);
    let json: unknown = {};
    if (r.status !== 204) { try { json = await r.json(); } catch { json = {}; } }
    return { status: r.status, json: json as T };
  }
  throw new WhoopApiFehler('WHOOP lehnt den Zugriff ab (401).', 401);
}

/** Höchstens so viele Seiten je Sammlung und Lauf (25 je Seite → 1.000 Einträge; 90 Tage brauchen ~4). */
export const SEITEN_MAX = 40;

/** Eine Sammlung seitenweise lesen (`records` + `next_token` → `nextToken`, belegt). 404/403 → leere Liste mit `status`. */
export async function sammlungLesen(person: string, pfad: string, start: string, ende?: string): Promise<{ records: Record<string, unknown>[]; status: number }> {
  const records: Record<string, unknown>[] = [];
  let nextToken: string | undefined;
  for (let seite = 0; seite < SEITEN_MAX; seite++) {
    const r = await whoopAnfrage<{ records?: unknown; next_token?: unknown }>(person, pfad, { limit: 25, start, end: ende, nextToken });
    if (r.status !== 200) return { records, status: r.status };
    if (Array.isArray(r.json.records)) for (const x of r.json.records) if (x && typeof x === 'object') records.push(x as Record<string, unknown>);
    nextToken = typeof r.json.next_token === 'string' && r.json.next_token ? r.json.next_token : undefined;
    if (!nextToken) break;
  }
  return { records, status: 200 };
}

/** Vorübergehend (später noch einmal)? */
export const vorlaeufig = (e: unknown): boolean => e instanceof WhoopApiFehler ? e.vorlaeufig : (e as { code?: unknown } | null)?.code === 'netz';
