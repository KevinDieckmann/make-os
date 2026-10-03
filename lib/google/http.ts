// ─── Google — Anfragen an die Google-APIs (Server, 03.10.2026) ───────────────
// Eine Stelle für jeden Aufruf von www.googleapis.com: Zugriffstoken der Person holen (lib/google/verbindung.ts), bei 401
// einmal erneuern und wiederholen, Fehler in zwei Klassen sortieren:
//   GoogleUeberlastet   429 oder 403 mit Kontingent-Grund (rateLimitExceeded …) — Pause nach `Retry-After`, sonst Backoff
//   GoogleApiFehler     alles andere, das nicht als Antwort zurückkommt (401 nach Erneuern, 5xx = `vorlaeufig`)
// 2xx und die übrigen 4xx (404, 410, 409, 412 …) kommen als Antwort zurück — der Aufrufer weiß, was sie bedeuten
// (410 beim syncToken = voller Neuabgleich, 412 beim Schreiben = Konflikt). Nie wird ein Token geloggt oder in einen
// Fehlertext geschrieben; die Zugangsdaten gehen nur an www.googleapis.com.

import { googleZugriffstoken, googleHost, type GoogleFunktion } from './verbindung';

export class GoogleApiFehler extends Error {
  constructor(message: string, public status: number, public grund?: string, public vorlaeufig = false) { super(message); }
}
/** 429 / Kontingent: nicht sofort wieder fragen. `sekunden` aus `Retry-After`, wenn Google es nennt. */
export class GoogleUeberlastet extends GoogleApiFehler {
  constructor(message: string, public sekunden?: number, grund?: string) { super(message, 429, grund, true); }
}

export interface GoogleAntwort<T = Record<string, unknown>> { status: number; json: T; etag?: string; kopf: Headers }

/** Retry-After (Sekunden oder HTTP-Datum) → Sekunden, gedeckelt auf eine Stunde. */
export function retryNach(v: string | null | undefined, jetzt = Date.now()): number | undefined {
  if (!v) return undefined;
  const n = Number(v.trim());
  const s = Number.isFinite(n) ? n : (Date.parse(v) - jetzt) / 1000;
  return Number.isFinite(s) && s > 0 ? Math.min(3600, Math.ceil(s)) : undefined;
}

/** Kontingent-Gründe, die Google mit 403 meldet — das ist „später noch einmal“, kein Rechteproblem. */
export const KONTINGENT_GRUENDE = ['rateLimitExceeded', 'userRateLimitExceeded', 'quotaExceeded', 'dailyLimitExceeded', 'backendError'] as const;

export function grundVon(json: unknown): string | undefined {
  const e = (json as { error?: { errors?: { reason?: string }[]; status?: string; message?: string } } | null)?.error;
  return e?.errors?.[0]?.reason ?? e?.status;
}

export interface GoogleOptionen {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** Wird als JSON gesendet. */
  body?: unknown;
  /** Zusätzliche Kopfzeilen (z. B. If-Match). */
  kopf?: Record<string, string>;
  /** Abfrage-Parameter (undefined fällt weg). */
  query?: Record<string, string | number | boolean | undefined>;
  /** Zeitüberschreitung in ms (Standard 25 s). */
  zeitMs?: number;
}

/** URL mit Abfrage-Parametern bauen — nur Google-Adressen (der Aufrufer reicht eine absolute `https://www.googleapis.com/…`). */
export function googleUrl(basis: string, query?: GoogleOptionen['query']): string {
  const u = new URL(basis);
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined) u.searchParams.set(k, String(v));
  return u.toString();
}

export async function googleAnfrage<T = Record<string, unknown>>(person: string, funktion: GoogleFunktion, url: string, opt: GoogleOptionen = {}): Promise<GoogleAntwort<T>> {
  const ziel = googleUrl(url, opt.query);
  if (!googleHost(ziel)) throw new GoogleApiFehler('Unerwartete Adresse — Abbruch (Zugang geht nur an Google).', 502);
  for (let versuch = 0; versuch < 2; versuch++) {
    const token = await googleZugriffstoken(person, funktion, { erneuern: versuch > 0 });
    let r: Response;
    try {
      r = await fetch(ziel, {
        method: opt.method ?? 'GET', redirect: 'error', signal: AbortSignal.timeout(opt.zeitMs ?? 25_000),
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'User-Agent': 'MAKE OS Kalender', ...(opt.body !== undefined ? { 'Content-Type': 'application/json; charset=utf-8' } : {}), ...opt.kopf },
        ...(opt.body !== undefined ? { body: JSON.stringify(opt.body) } : {}),
      });
    } catch (e) {
      const name = (e as { name?: string } | null)?.name;
      throw new GoogleApiFehler(name === 'TimeoutError' || name === 'AbortError' ? 'Google antwortet nicht (Zeitüberschreitung).' : 'Google ist gerade nicht erreichbar.', 504, name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'netz', true);
    }
    if (r.status === 401 && versuch === 0) continue; // Token abgelaufen/widerrufen → einmal erneuern und wiederholen
    let json: unknown = {};
    if (r.status !== 204) { try { json = await r.json(); } catch { json = {}; } }
    const grund = grundVon(json);
    if (r.status === 429 || (r.status === 403 && grund && (KONTINGENT_GRUENDE as readonly string[]).includes(grund))) {
      throw new GoogleUeberlastet(`Google bittet um Pause (${r.status}${grund ? `, ${grund}` : ''}) — neuer Versuch später.`, retryNach(r.headers.get('retry-after')), grund);
    }
    if (r.status === 401) throw new GoogleApiFehler('Google lehnt den Zugriff ab (401).', 401, grund);
    if (r.status >= 500) throw new GoogleApiFehler(`Google meldet einen Fehler (${r.status}).`, r.status, grund, true);
    return { status: r.status, json: json as T, etag: r.headers.get('etag') ?? undefined, kopf: r.headers };
  }
  throw new GoogleApiFehler('Google lehnt den Zugriff ab (401).', 401);
}

/** Vorübergehend (später noch einmal versuchen)? Überlast, 5xx, Zeitüberschreitung, Netz, Google-Verbindung kurz weg. */
export function vorlaeufigerFehler(e: unknown): boolean {
  if (e instanceof GoogleApiFehler) return e.vorlaeufig;
  const c = (e as { code?: unknown } | null)?.code;
  return c === 'netz';
}
