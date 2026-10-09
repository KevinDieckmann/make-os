// ─── Fixture: nachgebaute Messages-API mit Fehler-Einspeisung (09.10., Härtetest Agenten) ─────────────────────────────────────
// EIN Fake für alle Härtetests: `fetch` wird NUR für https://api.anthropic.com/ ersetzt (jede andere Adresse wirft — kein Netz im Test).
// Je Aufruf nimmt der Fake die nächste Vorlage aus `ki.folge` (sonst `ki.standard`):
//   ModellAntwort                 normale Antwort — als JSON oder, wenn die Anfrage `stream: true` trägt, als Server-Sent Events in krummen Stücken
//   { http, text?, kopf? }        HTTP-Fehler (z. B. 529 overloaded, 429 mit/ohne retry-after, 401, 400 „prompt is too long“)
//   { netz }                      die Verbindung reißt vor der Antwort (fetch wirft wie bei ECONNRESET/ENOTFOUND)
//   { zeit: true }                Zeitüberschreitung (fetch wirft AbortError — so endet askText bei seiner Zeitgrenze)
//   { stromFehler, nachText? }    Fehler-Ereignis mitten im Strom (optional nachdem schon Text kam)
//   { haengen: true }             Strom bleibt nach dem ersten Stück offen, bis abgebrochen wird
//   { abgeschnitten, text? }      `stop_reason: max_tokens` mitten in einem Werkzeug-Aufruf (abgeschnittenes JSON)
// Jede Antwort trägt `usage` (Vorgabe 1000 ein / 100 aus; je Vorlage über `usage` änderbar) — damit Kosten nachrechenbar sind.
import type { ModellAntwort } from './agenten-kern';

export type Usage = { input_tokens: number; output_tokens: number };
export type Vorlage =
  | (ModellAntwort & { usage?: Usage })
  | { http: number; text?: string; kopf?: Record<string, string> }
  | { netz: string }
  | { zeit: true }
  | { stromFehler: string; nachText?: string }
  | { haengen: true }
  | { abgeschnitten: { name: string; teilJson: string }; text?: string; usage?: Usage }
  /** Erst antworten, wenn `warte` erfüllt ist (Gleichzeitigkeit: ein Zug „läuft“, während ein zweiter kommt). */
  | { warte: Promise<unknown>; dann: Vorlage }
  | ((body: Record<string, unknown>) => Vorlage);

export interface KiFake {
  folge: Vorlage[];
  anfragen: Record<string, unknown>[];
  standard: ModellAntwort;
  /** Wie viele Aufrufe kamen an (auch fehlgeschlagene). */
  readonly anzahl: number;
  zurueck(): void;
}

const zeile = (name: string, d: unknown) => `event: ${name}\ndata: ${JSON.stringify(d)}\n\n`;
const stuecke = (t: string, n: number) => { const r: string[] = []; for (let i = 0; i < t.length; i += n) r.push(t.slice(i, i + n)); return r; };
const STANDARD_USAGE: Usage = { input_tokens: 1000, output_tokens: 100 };
const start = (u: Usage) => zeile('message_start', { type: 'message_start', message: { id: 'msg_fake', type: 'message', role: 'assistant', model: 'fake', content: [], stop_reason: null, usage: { input_tokens: u.input_tokens, output_tokens: 1 } } });

function sseAus(a: ModellAntwort, u: Usage): string {
  let s = start(u);
  a.content.forEach((b, i) => {
    if (b.type === 'text') {
      s += zeile('content_block_start', { type: 'content_block_start', index: i, content_block: { type: 'text', text: '' } });
      for (const t of stuecke(b.text ?? '', 5)) s += zeile('content_block_delta', { type: 'content_block_delta', index: i, delta: { type: 'text_delta', text: t } });
    } else if (b.type === 'tool_use') {
      s += zeile('content_block_start', { type: 'content_block_start', index: i, content_block: { type: 'tool_use', id: b.id, name: b.name, input: {} } });
      for (const t of stuecke(JSON.stringify(b.input ?? {}), 6)) s += zeile('content_block_delta', { type: 'content_block_delta', index: i, delta: { type: 'input_json_delta', partial_json: t } });
    } else if (b.type === 'thinking') {
      s += zeile('content_block_start', { type: 'content_block_start', index: i, content_block: { type: 'thinking', thinking: '' } });
      s += zeile('content_block_delta', { type: 'content_block_delta', index: i, delta: { type: 'thinking_delta', thinking: String((b as { thinking?: string }).thinking ?? '…') } });
    }
    s += zeile('content_block_stop', { type: 'content_block_stop', index: i });
  });
  s += zeile('message_delta', { type: 'message_delta', delta: { stop_reason: a.stop_reason, stop_sequence: null }, usage: { output_tokens: u.output_tokens } });
  return s + zeile('message_stop', { type: 'message_stop' });
}

function bytesStrom(roh: string, o: { haengen?: boolean; signal?: AbortSignal } = {}): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(roh);
  return new ReadableStream<Uint8Array>({
    start(c) {
      for (let i = 0; i < bytes.length; i += 7) c.enqueue(bytes.slice(i, i + 7));
      if (!o.haengen) { c.close(); return; }
      o.signal?.addEventListener('abort', () => c.error(Object.assign(new Error('abgebrochen'), { name: 'AbortError' })), { once: true });
    },
  });
}

const istAntwort = (v: object): v is ModellAntwort & { usage?: Usage } => 'content' in v && 'stop_reason' in v;

/** `fetch` nur für die Modell-Schnittstelle — alles andere wirft (kein Netz im Test). */
export function kiFake(): KiFake {
  const alt = globalThis.fetch;
  let anzahl = 0;
  const f: KiFake = {
    folge: [], anfragen: [], standard: { content: [{ type: 'text', text: 'Erledigt.' }], stop_reason: 'end_turn' },
    get anzahl() { return anzahl; },
    zurueck: () => { globalThis.fetch = alt; },
  };
  globalThis.fetch = (async (url: unknown, init?: { body?: unknown; signal?: AbortSignal }) => {
    if (!String(url).startsWith('https://api.anthropic.com/')) throw new Error(`Netz im Test gesperrt: ${String(url).slice(0, 80)}`);
    const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
    anzahl++;
    f.anfragen.push(body);
    let v: Vorlage = f.folge.shift() ?? f.standard;
    for (;;) {
      if (typeof v === 'function') { v = v(body); continue; }
      if ('warte' in v) { await v.warte; v = v.dann; continue; }
      break;
    }
    const strom = body.stream === true;
    const sse = { status: 200, headers: { 'content-type': 'text/event-stream', 'request-id': 'req-fake' } };
    if ('http' in v) return new Response(v.text ?? JSON.stringify({ type: 'error', error: { type: 'api_error', message: `Fehler ${v.http}` } }), { status: v.http, headers: { 'content-type': 'application/json', 'request-id': 'req-fake', ...(v.kopf ?? {}) } });
    if ('netz' in v) throw Object.assign(new TypeError('fetch failed'), { cause: Object.assign(new Error(v.netz), { code: v.netz }) });
    if ('zeit' in v) throw Object.assign(new Error('This operation was aborted'), { name: 'AbortError' });
    if ('haengen' in v) {
      const roh = start(STANDARD_USAGE) + zeile('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }) + zeile('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Ich fange an' } });
      return new Response(bytesStrom(roh, { haengen: true, signal: init?.signal }), sse);
    }
    if ('stromFehler' in v) {
      const vorweg = v.nachText ? zeile('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }) + zeile('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: v.nachText } }) : '';
      return new Response(bytesStrom(start(STANDARD_USAGE) + vorweg + zeile('error', { type: 'error', error: { type: v.stromFehler, message: 'Overloaded' } })), sse);
    }
    if ('abgeschnitten' in v) {
      const u = v.usage ?? STANDARD_USAGE;
      const content: Record<string, unknown>[] = [...(v.text ? [{ type: 'text', text: v.text }] : []), { type: 'tool_use', id: 'toolu_abgeschnitten', name: v.abgeschnitten.name, input: {} }];
      if (!strom) return new Response(JSON.stringify({ id: 'msg_fake', type: 'message', role: 'assistant', content, stop_reason: 'max_tokens', usage: u }), { status: 200, headers: { 'content-type': 'application/json' } });
      let s = start(u);
      if (v.text) {
        s += zeile('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } });
        s += zeile('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: v.text } });
        s += zeile('content_block_stop', { type: 'content_block_stop', index: 0 });
      }
      const i = v.text ? 1 : 0;
      s += zeile('content_block_start', { type: 'content_block_start', index: i, content_block: { type: 'tool_use', id: 'toolu_abgeschnitten', name: v.abgeschnitten.name, input: {} } });
      s += zeile('content_block_delta', { type: 'content_block_delta', index: i, delta: { type: 'input_json_delta', partial_json: v.abgeschnitten.teilJson } });
      s += zeile('content_block_stop', { type: 'content_block_stop', index: i });
      s += zeile('message_delta', { type: 'message_delta', delta: { stop_reason: 'max_tokens', stop_sequence: null }, usage: { output_tokens: u.output_tokens } });
      return new Response(bytesStrom(s + zeile('message_stop', { type: 'message_stop' })), sse);
    }
    if (!istAntwort(v)) throw new Error('Fake: unbekannte Vorlage');
    const u = v.usage ?? STANDARD_USAGE;
    if (strom) return new Response(bytesStrom(sseAus(v, u)), sse);
    return new Response(JSON.stringify({ id: 'msg_fake', type: 'message', role: 'assistant', content: v.content, stop_reason: v.stop_reason, usage: u }), { status: 200, headers: { 'content-type': 'application/json', 'request-id': 'req-fake' } });
  }) as typeof fetch;
  return f;
}
