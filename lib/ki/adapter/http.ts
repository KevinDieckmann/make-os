// ─── KI-Adapter: EIN fetch für alle neuen Anbieter (09.10.2026, Paket 6a) — Server ─────────────────────────────────────────
// R1 der Recherche: jeder Aufruf an einen KI-Anbieter geht durch einen Adapter in lib/ki/adapter/ — und jeder Adapter durch diese Stelle:
//   · Ziel nur https auf einem Host aus dem Katalog des Zugangs (lib/ki/anbieter.ts `hostErlaubt`), keine Umleitungen (`redirect: 'error'`)
//   · Zeitgrenze je Aufruf, Antwort-Größe begrenzt (Video ≤ 60 MB, sonst 413-Fehler statt still kürzen)
//   · Schlüssel nur im Kopf, nie in der Adresse, nie im Log; Fehlermeldungen des Anbieters gehen gekürzt und ohne Kopf zurück
// Tests ersetzen `fetch` über `_kiFetchSetzen` (kein Netz zu Anbietern in Tests).

import { hostErlaubt, type AnbieterId } from '../anbieter';

type FetchFn = (url: string, init: RequestInit) => Promise<Response>;
let fetchFn: FetchFn = (url, init) => fetch(url, init);
/** Nur für Tests: einen nachgebauten Anbieter setzen (null = zurück zum echten fetch). */
export const _kiFetchSetzen = (f: FetchFn | null): void => { fetchFn = f ?? ((url, init) => fetch(url, init)); };

export class KiAnbieterFehler extends Error {
  constructor(message: string, public status: number, public art: 'host' | 'netz' | 'zeit' | 'anbieter' | 'zu-gross' | 'antwort' = 'anbieter') { super(message); }
}

/** Ein Aufruf an den Anbieter `id`. Wirft `KiAnbieterFehler` (nie mit Schlüssel im Text). */
export async function kiFetch(id: AnbieterId, url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  if (!hostErlaubt(id, url)) throw new KiAnbieterFehler(`Ziel nicht erlaubt für ${id}`, 0, 'host');
  const { timeoutMs = 90_000, ...rest } = init;
  try {
    return await fetchFn(url, { ...rest, redirect: 'error', signal: rest.signal ?? AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    // Eigenes Abbruch-Signal des Aufrufers (askText): den Fehler unverändert weitergeben — der Aufrufer zählt Zeit und Wiederholung selbst.
    if (rest.signal?.aborted) throw e;
    const zeit = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError');
    throw new KiAnbieterFehler(zeit ? `Zeitüberschreitung nach ${Math.round(timeoutMs / 1000)} s` : 'Netzfehler', 0, zeit ? 'zeit' : 'netz');
  }
}

/** JSON lesen; Fehlerstatus → `KiAnbieterFehler` mit gekürztem Text (ohne Köpfe). */
export async function kiJson<T>(id: AnbieterId, url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const r = await kiFetch(id, url, init);
  const text = await r.text();
  if (!r.ok) throw new KiAnbieterFehler(`${id} antwortet ${r.status}: ${text.replace(/\s+/g, ' ').slice(0, 200)}`, r.status);
  try { return JSON.parse(text) as T; } catch { throw new KiAnbieterFehler(`${id}: Antwort ist kein JSON`, r.status, 'antwort'); }
}

/** Base64 → Bytes mit Grenze (nie still kürzen). */
export function base64Bytes(b64: string, maxBytes: number): Buffer {
  if (Math.floor((b64.length * 3) / 4) > maxBytes + 3) throw new KiAnbieterFehler(`Ergebnis zu groß (über ${Math.round(maxBytes / 1e6)} MB)`, 413, 'zu-gross');
  const b = Buffer.from(b64, 'base64');
  if (b.length > maxBytes) throw new KiAnbieterFehler(`Ergebnis zu groß (über ${Math.round(maxBytes / 1e6)} MB)`, 413, 'zu-gross');
  return b;
}
