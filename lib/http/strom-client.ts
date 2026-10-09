// ─── Browser: eine Chat-Anfrage mit Strom — und Rückfall auf JSON (09.10.) ────────────────────────────────────────────────────
// EINE Stelle für ZoePanel, Empfang und den Agenten-Client (components/os/agenten/daten.ts): POST mit `Accept: text/event-stream`,
// Text-Stücke und Werkzeug-Stände gehen an `bei`, am Ende kommt GENAU die JSON-Antwort (Status + Körper) wie ohne Strom.
// Rückfall (Kevin: „wenn Streaming fehlschlägt — Proxy, alter Browser“):
//   • Browser ohne ReadableStream/TextDecoder → gleich die JSON-Anfrage wie bisher.
//   • Die Anfrage scheitert, bevor eine Antwort da ist (Netz, Proxy lehnt ab) → EINMAL dieselbe Anfrage als JSON.
//   • Der Server antwortet ohne Strom (Fehler vor dem Strom, Hintergrundaufgabe) → die JSON-Antwort wird gelesen wie bisher.
//   • Ein Proxy puffert den Strom → die Stücke kommen am Ende auf einmal; das Ergebnis ist dasselbe.
//   • Der Strom reißt nach dem Anfang ab (kein `ende`) → `unterbrochen` — KEINE automatische Wiederholung (sie könnte den Zug doppelt
//     laufen lassen und doppelt kosten); die Oberfläche lädt den Thread neu. Der Server hat bei Abbruch nichts Halbes gespeichert.
// Reduzierte Bewegung braucht hier nichts: Text wird nur angehängt, kein Tipp-Effekt.

import { ereignisAus, sseZerlegen, SSE_TYP, type StromEnde, type StromEreignis } from './sse';

export interface StromAntwort {
  /** HTTP-Status bzw. der Status aus `ende` (0 = keine Antwort). */
  status: number;
  /** Der Körper wie ohne Strom (null = keine Antwort). */
  body: unknown;
  /** Kam die Antwort als Strom? */
  gestreamt: boolean;
  /** Der Strom hat angefangen und ist ohne `ende` abgerissen. */
  unterbrochen?: boolean;
  /** Keine Verbindung (auch der JSON-Rückfall nicht). */
  netz?: boolean;
}

/** Kann dieser Browser einen Strom lesen? */
export function kannStrom(): boolean {
  return typeof ReadableStream !== 'undefined' && typeof TextDecoder !== 'undefined' && typeof fetch === 'function';
}

async function alsJson(url: string, body: unknown, signal?: AbortSignal): Promise<StromAntwort> {
  let r: Response;
  try {
    r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body), ...(signal ? { signal } : {}) });
  } catch { return { status: 0, body: null, gestreamt: false, netz: true }; }
  let d: unknown = null;
  try { d = await r.json(); } catch { /* leerer Körper */ }
  return { status: r.status, body: d, gestreamt: false };
}

/** Einen Strom lesen (rein bis auf die Antwort): Ereignisse an `bei`, Ergebnis = `ende` oder null (abgerissen). */
export async function stromLesen(r: Response, bei: (e: StromEreignis) => void): Promise<StromEnde | null> {
  let ende = null as StromEnde | null;
  const verarbeiten = (puffer: string): string => {
    const z = sseZerlegen(puffer);
    for (const roh of z.ereignisse) {
      const e = ereignisAus(roh);
      if (!e) continue;
      if (e.art === 'ende') ende = e.ende;
      else { try { bei(e); } catch { /* Anzeige darf das Lesen nicht stören */ } }
    }
    return z.rest;
  };
  const leser = r.body && typeof r.body.getReader === 'function' ? r.body.getReader() : null;
  if (!leser) { verarbeiten(`${await r.text()}\n\n`); return ende; }
  const dec = new TextDecoder();
  let puffer = '';
  try {
    for (;;) {
      const { done, value } = await leser.read();
      puffer = verarbeiten(puffer + (done ? dec.decode() : dec.decode(value, { stream: true })));
      if (done) break;
      if (ende) { await leser.cancel().catch(() => { /* schon zu */ }); break; }
    }
    if (!ende && puffer.trim()) verarbeiten(`${puffer}\n\n`);
  } catch { /* abgerissen — `ende` fehlt */ }
  return ende;
}

/**
 * POST mit Strom (sonst JSON wie bisher). `signal` = Stopp durch die Person: der Server bricht den Lauf ab und speichert nichts Halbes.
 */
export async function postMitStrom(url: string, body: unknown, bei: (e: StromEreignis) => void, o: { signal?: AbortSignal } = {}): Promise<StromAntwort> {
  if (!kannStrom()) return alsJson(url, body, o.signal);
  let r: Response;
  try {
    r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: `${SSE_TYP}, application/json;q=0.9` },
      body: JSON.stringify(body),
      ...(o.signal ? { signal: o.signal } : {}),
    });
  } catch {
    if (o.signal?.aborted) return { status: 0, body: null, gestreamt: false, unterbrochen: true };
    return alsJson(url, body, o.signal);
  }
  if (!(r.headers.get('content-type') ?? '').toLowerCase().includes(SSE_TYP)) {
    let d: unknown = null;
    try { d = await r.json(); } catch { /* leerer Körper */ }
    return { status: r.status, body: d, gestreamt: false };
  }
  const ende = await stromLesen(r, bei);
  return ende ? { status: ende.status, body: ende.body, gestreamt: true } : { status: 0, body: null, gestreamt: true, unterbrochen: true };
}
