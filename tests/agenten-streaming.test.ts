// ─── Wächter Streaming für ZOE und den Agenten-Chat (09.10.; AGENTEN_KONZEPT.md C8 Risiko 8 „ohne Streaming wirkt der Chat langsamer“) ──
//   • Format auf der Leitung (lib/http/sse.ts) und Zusammenbau der Messages-API-Ereignisse (lib/ki/nachricht-strom.ts) — rein.
//   • `askStream` geht durch DIESELBE Schranke wie `askText`: gesperrtes KI-Tor, Budget, Guthaben → kein Stream, kein Netz; Verbrauch wie dort.
//   • Die Schleife streamt Text und Werkzeug-Stände in Reihenfolge; das Ergebnis ist dasselbe wie ohne Strom.
//   • Routen /api/kimmi und /api/agenten/faden: `Accept: text/event-stream` → Strom, `ende` = gespeichertes Ergebnis = JSON-Antwort; Fehler
//     vor dem Strom als JSON mit Status; Abbruch des Browsers → nichts Halbes gespeichert.
//   • Browser: Rückfall auf JSON (lib/http/strom-client.ts), Anzeige „ruft … auf“.
// Eigener Datenordner, erfundene Konten (`@example.invalid`), nachgebaute Messages-API (kein Netz).
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { rmSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-agenten-strom-'));
  Object.assign(process.env, { MAKE_OS_DATEN_DIR: o, MAKE_OS_KEY: 'pruef-schluessel-agenten-strom', MAKE_OS_KI_VORGABE: 'kompatibel', ANTHROPIC_API_KEY: 'test-schluessel', MAKE_OS_BRAIN_INDEX: 'aus', MAKE_OS_DOKU_WURZEL: 'aus', MAKE_VAULT_DIR: p.join(o, 'vault') });
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  delete process.env.ANTHROPIC_MODEL;
  delete process.env.MAKE_OS_KI_ANBIETER_TOR;
  delete process.env.MAKE_OS_KI_BUDGET_MONAT_EURO;
  return o;
});
vi.mock('@/lib/brain', async orig => ({ ...(await orig<typeof import('@/lib/brain')>()), gatherBrain: vi.fn(async () => ({})), promptBrain: () => '' }));
vi.mock('@/lib/zoe/vault', async orig => ({ ...(await orig<typeof import('@/lib/zoe/vault')>()), brainAnweisung: async () => '' }));

import type { FadenKern } from '@/lib/agenten/faeden';
import type { StromEreignis } from '@/lib/http/sse';
import { kontenSaeen, rufe, sitzung, dienst, text, werkzeug, type ModellAntwort } from './fixtures/agenten-kern';

type H = (r: Request) => Promise<Response>;
let kimmi: { POST: H };
let faden: { GET: H; POST: H };
let db: typeof import('@/lib/store/local-db');
let anthropic: typeof import('@/lib/anthropic');
let ke: typeof import('@/lib/datenschutz/ki-einstellungen');

// ── Nachgebaute Messages-API: JSON ohne `stream`, sonst Server-Sent Events in krummen Stücken (auch mitten in einem Umlaut) ──────────

type Vorlage = ModellAntwort | { haengen: true } | { stromFehler: 'overloaded_error' };
const NETZ = { anfragen: [] as Record<string, unknown>[], antworten: [] as Vorlage[] };
const zeile = (name: string, d: unknown) => `event: ${name}\ndata: ${JSON.stringify(d)}\n\n`;
const stuecke = (t: string, n: number) => { const r: string[] = []; for (let i = 0; i < t.length; i += n) r.push(t.slice(i, i + n)); return r; };
const START = zeile('message_start', { type: 'message_start', message: { id: 'msg_test', type: 'message', role: 'assistant', model: 'test', content: [], stop_reason: null, usage: { input_tokens: 1000, output_tokens: 1 } } });

function sseText(a: ModellAntwort): string {
  let s = START;
  a.content.forEach((b, i) => {
    if (b.type === 'text') {
      s += zeile('content_block_start', { type: 'content_block_start', index: i, content_block: { type: 'text', text: '' } });
      for (const t of stuecke(b.text ?? '', 4)) s += zeile('content_block_delta', { type: 'content_block_delta', index: i, delta: { type: 'text_delta', text: t } });
    } else if (b.type === 'tool_use') {
      s += zeile('content_block_start', { type: 'content_block_start', index: i, content_block: { type: 'tool_use', id: b.id, name: b.name, input: {} } });
      for (const t of stuecke(JSON.stringify(b.input ?? {}), 5)) s += zeile('content_block_delta', { type: 'content_block_delta', index: i, delta: { type: 'input_json_delta', partial_json: t } });
    }
    s += ': ping\n\n';
    s += zeile('content_block_stop', { type: 'content_block_stop', index: i });
  });
  s += zeile('message_delta', { type: 'message_delta', delta: { stop_reason: a.stop_reason, stop_sequence: null }, usage: { output_tokens: 100 } });
  return s + zeile('message_stop', { type: 'message_stop' });
}

/** Ein Strom aus Bytes in 7er-Stücken; `haengen` = nach dem ersten Text-Stück offen bis zum Abbruch. */
function strom(textRoh: string, o: { haengen?: boolean; signal?: AbortSignal } = {}): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(textRoh);
  return new ReadableStream<Uint8Array>({
    start(c) {
      for (let i = 0; i < bytes.length; i += 7) c.enqueue(bytes.slice(i, i + 7));
      if (!o.haengen) { c.close(); return; }
      o.signal?.addEventListener('abort', () => c.error(Object.assign(new Error('abgebrochen'), { name: 'AbortError' })), { once: true });
    },
  });
}

function netzAn(): () => void {
  const alt = globalThis.fetch;
  globalThis.fetch = (async (url: unknown, init?: { body?: unknown; signal?: AbortSignal }) => {
    if (!String(url).startsWith('https://api.anthropic.com/')) throw new Error(`Netz im Test gesperrt: ${String(url).slice(0, 80)}`);
    const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
    NETZ.anfragen.push(body);
    const v = NETZ.antworten.shift() ?? text('Erledigt.');
    const sse = { status: 200, headers: { 'content-type': 'text/event-stream', 'request-id': 'req-strom' } };
    if ('haengen' in v) {
      const roh = START + zeile('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }) + zeile('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Ich fange an' } });
      return new Response(strom(roh, { haengen: true, signal: init?.signal }), sse);
    }
    if ('stromFehler' in v) return new Response(strom(START + zeile('error', { type: 'error', error: { type: v.stromFehler, message: 'Overloaded' } })), sse);
    if (body.stream === true) return new Response(strom(sseText(v)), sse);
    return new Response(JSON.stringify({ ...v, usage: { input_tokens: 1000, output_tokens: 100 } }), { status: 200, headers: { 'content-type': 'application/json', 'request-id': 'req-json' } });
  }) as typeof fetch;
  return () => { globalThis.fetch = alt; };
}

const SSE_KOPF = (person: string) => ({ ...sitzung(person), accept: 'text/event-stream' });
async function stromRufen(h: H, pfad: string, kopf: Record<string, string>, body: unknown, signal?: AbortSignal) {
  return h(new Request(`http://test${pfad}`, { method: 'POST', headers: kopf, body: JSON.stringify(body), ...(signal ? { signal } : {}) }));
}
async function stromAuslesen(r: Response): Promise<{ ereignisse: StromEreignis[]; ende: { status: number; body: Record<string, unknown> } | null }> {
  const { stromLesen } = await import('@/lib/http/strom-client');
  const ereignisse: StromEreignis[] = [];
  const ende = await stromLesen(r, e => ereignisse.push(e));
  return { ereignisse, ende: ende as { status: number; body: Record<string, unknown> } | null };
}
const ergebnisInhalt = (b: Record<string, unknown>): string => {
  const letzte = ((b.messages as { content?: unknown }[] | undefined) ?? []).at(-1);
  return Array.isArray(letzte?.content) ? String((letzte!.content as { content?: unknown }[])[0]?.content ?? '') : '';
};
const textAus = (es: StromEreignis[]) => es.filter(e => e.art === 'text').map(e => (e as { text: string }).text).join('');
const bestand = async (p: string) => (await db.loadJson<{ faeden: FadenKern[] }>(`agenten-faeden--${p}`))?.faeden ?? [];
async function bis(f: () => Promise<boolean>): Promise<boolean> { for (let i = 0; i < 80; i++) { if (await f()) return true; await new Promise(r => setTimeout(r, 25)); } return false; }
const verbrauchVon = async (zweck: string) => ((await db.loadJson<{ tage: { posten: { zweck: string; ein: number; aus: number }[] }[] }>('ki-verbrauch'))?.tage ?? []).flatMap(t => t.posten).filter(p => p.zweck === zweck);

let netzAus: () => void;
beforeAll(async () => {
  await kontenSaeen();
  db = await import('@/lib/store/local-db');
  anthropic = await import('@/lib/anthropic');
  ke = await import('@/lib/datenschutz/ki-einstellungen');
  kimmi = (await import('@/app/api/kimmi/route')) as unknown as typeof kimmi;
  faden = (await import('@/app/api/agenten/faden/route')) as unknown as typeof faden;
  netzAus = netzAn();
});
afterAll(() => { netzAus(); rmSync(ordner, { recursive: true, force: true }); });
beforeEach(() => { NETZ.anfragen.length = 0; NETZ.antworten.length = 0; });

// ── (1) rein ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('Format auf der Leitung (lib/http/sse.ts)', () => {
  it('zerlegt Ereignisse über Stückgrenzen, überspringt Kommentare und kaputtes JSON, kennt nur bekannte Ereignisse', async () => {
    const { sseZerlegen, ereignisAus, sseZeile, willStrom } = await import('@/lib/http/sse');
    const roh = `: strom\n\n${sseZeile('text', { text: 'Hal' })}event: text\r\ndata: {"text":"lo"}\r\n\r\nevent: text\ndata: {kaputt\n\n${sseZeile('werkzeug', { name: 'suche_arbeit', status: 'laeuft' })}${sseZeile('ende', { status: 200, body: { reply: 'Hallo' } })}event: te`;
    const z = sseZerlegen(roh);
    expect(z.rest).toBe('event: te');
    expect(z.ereignisse.map(ereignisAus)).toEqual([
      { art: 'text', text: 'Hal' }, { art: 'text', text: 'lo' },
      { art: 'werkzeug', name: 'suche_arbeit', status: 'laeuft' },
      { art: 'ende', ende: { status: 200, body: { reply: 'Hallo' } } },
    ]);
    expect(ereignisAus({ name: 'werkzeug', daten: { name: 'x', status: 'irgendwas' } })).toBeNull();
    expect(ereignisAus({ name: 'ende', daten: { body: {} } })).toBeNull();
    expect(willStrom(new Request('http://t', { headers: { accept: 'text/event-stream, application/json;q=0.9' } }))).toBe(true);
    expect(willStrom(new Request('http://t', { headers: { accept: 'application/json' } }))).toBe(false);
    expect(willStrom(new Request('http://t'))).toBe(false);
  });

  it('„was entsteht“: Text wird angehängt, das laufende Werkzeug steht da, bis alle fertig sind', async () => {
    const { ENTSTEHEND_LEER, entstehendNach } = await import('@/lib/http/sse');
    let s = ENTSTEHEND_LEER;
    for (const e of [{ art: 'text', text: 'Ich ' }, { art: 'werkzeug', name: 'a', status: 'laeuft' }, { art: 'werkzeug', name: 'b', status: 'laeuft' }, { art: 'werkzeug', name: 'a', status: 'fertig' }] as StromEreignis[]) s = entstehendNach(s, e);
    expect(s).toEqual({ text: 'Ich ', werkzeug: 'b', laufend: 1 });
    s = entstehendNach(entstehendNach(s, { art: 'werkzeug', name: 'b', status: 'fehler' }), { art: 'text', text: 'schaue.' });
    expect(s).toEqual({ text: 'Ich schaue.', werkzeug: null, laufend: 0 });
  });
});

describe('Zusammenbau der Messages-API-Ereignisse (lib/ki/nachricht-strom.ts)', () => {
  it('baut dieselbe Antwort wie ohne Strom — Denken mit Signatur, zwei Text-Blöcke, Werkzeug-Eingabe aus JSON-Stücken; Stücke nur aus Text', async () => {
    const { NachrichtZusammenbau } = await import('@/lib/ki/nachricht-strom');
    const zb = new NachrichtZusammenbau();
    const ev: [string, unknown][] = [
      ['message_start', { message: { id: 'm1', role: 'assistant', content: [], usage: { input_tokens: 50, cache_read_input_tokens: 7 } } }],
      ['content_block_start', { index: 0, content_block: { type: 'thinking', thinking: '' } }],
      ['content_block_delta', { index: 0, delta: { type: 'thinking_delta', thinking: 'GEHEIMES DENKEN' } }],
      ['content_block_delta', { index: 0, delta: { type: 'signature_delta', signature: 'sig-1' } }],
      ['content_block_stop', { index: 0 }],
      ['content_block_start', { index: 1, content_block: { type: 'text', text: '' } }],
      ['content_block_delta', { index: 1, delta: { type: 'text_delta', text: 'Grü' } }],
      ['content_block_delta', { index: 1, delta: { type: 'text_delta', text: 'ße.' } }],
      ['content_block_stop', { index: 1 }],
      ['content_block_start', { index: 2, content_block: { type: 'tool_use', id: 't1', name: 'suche_arbeit', input: {} } }],
      ['content_block_delta', { index: 2, delta: { type: 'input_json_delta', partial_json: '{"frage":"Ang' } }],
      ['content_block_delta', { index: 2, delta: { type: 'input_json_delta', partial_json: 'ebot"}' } }],
      ['content_block_stop', { index: 2 }],
      ['content_block_start', { index: 3, content_block: { type: 'text', text: '' } }],
      ['content_block_delta', { index: 3, delta: { type: 'text_delta', text: 'Zweiter.' } }],
      ['content_block_stop', { index: 3 }],
      ['ping', {}],
      ['message_delta', { delta: { stop_reason: 'tool_use', stop_sequence: null }, usage: { output_tokens: 42 } }],
      ['message_stop', {}],
    ];
    const gezeigt = ev.map(([n, d]) => zb.anwenden(n, d)).filter(Boolean);
    expect(gezeigt).toEqual(['Grü', 'ße.', '\nZweiter.']);
    expect(gezeigt.join('')).not.toContain('GEHEIMES');
    expect(zb.fertig).toBe(true);
    const n = zb.nachricht();
    expect(n.content).toEqual([
      { type: 'thinking', thinking: 'GEHEIMES DENKEN', signature: 'sig-1' },
      { type: 'text', text: 'Grüße.' },
      { type: 'tool_use', id: 't1', name: 'suche_arbeit', input: { frage: 'Angebot' } },
      { type: 'text', text: 'Zweiter.' },
    ]);
    expect(n.stop_reason).toBe('tool_use');
    const { extractText } = await import('@/lib/anthropic');
    expect(extractText(n)).toBe('Grüße.\nZweiter.');
    expect(zb.verbrauch()).toEqual({ ein: 50, aus: 42, cacheLesen: 7, cacheSchreiben: 0 });
  });
});

// ── (2) askStream: dieselbe Schranke wie askText ────────────────────────────────────────────────────────────────────────────

describe('askStream (lib/anthropic.ts)', () => {
  const ki = { lauf: 'gespraech' as const, person: 'person-a', kategorien: ['allgemein' as const] };

  it('Stücke in Reihenfolge, Ergebnis wie ohne Strom, Verbrauch verbucht wie bei askText', async () => {
    NETZ.antworten.push(text('Guten Morgen — drei Dinge für heute: Fokus, Pipeline, Pause.'));
    const stuecke: string[] = [];
    const r = await anthropic.askStream({ system: 's', user: 'Hallo', zweck: 'test-strom', ki }, { onText: t => stuecke.push(t) });
    expect(r.ok).toBe(true);
    expect(NETZ.anfragen[0].stream).toBe(true);
    expect(stuecke.length).toBeGreaterThan(3);
    expect(stuecke.join('')).toBe(r.text);
    expect(r.text).toBe('Guten Morgen — drei Dinge für heute: Fokus, Pipeline, Pause.');
    expect((r.raw as { content: unknown[] }).content).toEqual([{ type: 'text', text: r.text }]);
    expect(r.usage).toMatchObject({ ein: 1000, aus: 100 });
    expect(await bis(async () => (await verbrauchVon('test-strom')).length === 1)).toBe(true);
    expect((await verbrauchVon('test-strom'))[0]).toMatchObject({ ein: 1000, aus: 100 });
    // ohne Strom: dieselbe Antwort
    NETZ.antworten.push(text('Guten Morgen — drei Dinge für heute: Fokus, Pipeline, Pause.'));
    const j = await anthropic.askText({ system: 's', user: 'Hallo', zweck: 'test-json', ki });
    expect(NETZ.anfragen[1].stream).toBeUndefined();
    expect(j.text).toBe(r.text);
  });

  it('KI-Tor gesperrt (Bereich aus) → derselbe Fehler wie askText, kein Netz, kein Stück', async () => {
    await ke.aendereKiEinstellungen(d => ({ ...d, personen: { ...(d.personen ?? {}), 'person-a': { bereiche: { crm: false } } } }));
    const stuecke: string[] = [];
    const s = await anthropic.askStream({ system: 's', user: 'u', zweck: 'test-gesperrt', ki: { ...ki, kategorien: ['crm'] } }, { onText: t => stuecke.push(t) });
    const t = await anthropic.askText({ system: 's', user: 'u', zweck: 'test-gesperrt', ki: { ...ki, kategorien: ['crm'] } });
    expect(s.error).toBe('ki-gesperrt:bereich-crm');
    expect(s).toMatchObject({ ok: t.ok, status: t.status, error: t.error });
    expect(anthropic.kiGesperrt(s)).toBe(true);
    expect(stuecke).toEqual([]);
    expect(NETZ.anfragen).toHaveLength(0);
    await ke.aendereKiEinstellungen(d => ({ ...d, personen: {} }));
  });

  it('Budget erreicht → gesperrt, kein Netz; Guthaben leer → 402, kein Netz', async () => {
    await ke.aendereKiEinstellungen(d => ({ ...d, instanz: { ...(d.instanz ?? {}), budget: { monatEuroCent: 100 } } }));
    const vorher = await db.loadJson('ki-verbrauch');
    await db.saveJson('ki-verbrauch', { tage: [{ tag: new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' }), posten: [{ modell: 'claude-sonnet-5', zweck: 'test', ein: 1, aus: 1, anzahl: 1, cent: 9000 }] }] });
    const stuecke: string[] = [];
    const r = await anthropic.askStream({ system: 's', user: 'u', zweck: 'test-budget', ki }, { onText: t => stuecke.push(t) });
    expect(r.error).toBe('ki-gesperrt:budget');
    await ke.aendereKiEinstellungen(d => ({ ...d, instanz: { ...(d.instanz ?? {}), budget: undefined } }));
    await db.saveJson('ki-verbrauch', vorher ?? { tage: [] });
    anthropic._guthabenSetzen(Date.now());
    const g = await anthropic.askStream({ system: 's', user: 'u', zweck: 'test-guthaben', ki }, { onText: t => stuecke.push(t) });
    anthropic._guthabenSetzen(0);
    expect(g).toMatchObject({ ok: false, status: 402, error: 'guthaben-leer' });
    expect(stuecke).toEqual([]);
    expect(NETZ.anfragen).toHaveLength(0);
  });

  it('Fehler mitten im Strom, bevor etwas gezeigt wurde → einmal nochmal; nichts doppelt', async () => {
    NETZ.antworten.push({ stromFehler: 'overloaded_error' }, text('Jetzt klappt es.'));
    const stuecke: string[] = [];
    const r = await anthropic.askStream({ system: 's', user: 'u', zweck: 'test-nochmal', ki }, { onText: t => stuecke.push(t) });
    expect(r.ok).toBe(true);
    expect(NETZ.anfragen).toHaveLength(2);
    expect(stuecke.join('')).toBe('Jetzt klappt es.');
  });

  it('Abbruch von außen → sofort `abgebrochen`, keine Wiederholung, die schon bezahlte Eingabe ist verbucht', async () => {
    NETZ.antworten.push({ haengen: true });
    const ab = new AbortController();
    const stuecke: string[] = [];
    const r = await anthropic.askStream({ system: 's', user: 'u', zweck: 'test-abbruch', ki }, { signal: ab.signal, onText: t => { stuecke.push(t); ab.abort(); } });
    expect(r).toMatchObject({ ok: false, error: anthropic.KI_ABGEBROCHEN });
    expect(stuecke).toEqual(['Ich fange an']);
    expect(NETZ.anfragen).toHaveLength(1);
    expect(await bis(async () => (await verbrauchVon('test-abbruch')).length === 1)).toBe(true);
    expect((await verbrauchVon('test-abbruch'))[0]).toMatchObject({ ein: 1000 });
  });
});

// ── (3) Die Schleife ────────────────────────────────────────────────────────────────────────────────────────────────────

describe('Schleife mit `ereignis` (lib/agenten/schleife.ts)', () => {
  const basis = () => ({
    system: 'S', messages: [{ role: 'user', content: 'Frage' }] as unknown[], tools: [{ name: 'suche_arbeit' }], runden: 3,
    zustand: { fremdGelesen: false, vertraulich: false, kategorien: ['allgemein' as const] },
    ask: { maxTokens: 1000, timeoutMs: 60_000, zweck: 'test-schleife', ki: { lauf: 'gespraech' as const, person: 'person-a' } },
    ausfuehren: async () => ({ inhalt: '3 Treffer', ok: true }),
  });
  const runde1 = (): ModellAntwort => ({ content: [{ type: 'text', text: 'Ich schaue nach.' }, ...werkzeug(['suche_arbeit', { frage: 'Angebot' }]).content], stop_reason: 'tool_use' });

  it('Text-Stücke und Werkzeug-Stände in Reihenfolge; Ende = dasselbe Ergebnis wie ohne Strom', async () => {
    const { schleife } = await import('@/lib/agenten/schleife');
    NETZ.antworten.push(runde1(), text('Fertig: drei Treffer.'));
    const es: StromEreignis[] = [];
    const s = await schleife({ ...basis(), ereignis: e => es.push(e) });
    const reihe = es.map(e => (e.art === 'text' ? 'T' : `W:${e.name}:${e.status}`)).filter((x, i, a) => x !== 'T' || a[i - 1] !== 'T');
    expect(reihe).toEqual(['T', 'W:suche_arbeit:laeuft', 'W:suche_arbeit:fertig', 'T']);
    expect(textAus(es)).toBe('Ich schaue nach.\n\nFertig: drei Treffer.');
    expect(s.text).toBe(textAus(es));
    expect(NETZ.anfragen.every(b => b.stream === true)).toBe(true);
    // ohne Strom
    NETZ.antworten.push(runde1(), text('Fertig: drei Treffer.'));
    const j = await schleife(basis());
    expect(NETZ.anfragen.slice(2).every(b => b.stream === undefined)).toBe(true);
    expect({ text: j.text, status: j.status, aufrufe: j.aufrufe, runden: j.runden, token: j.token }).toEqual({ text: s.text, status: s.status, aufrufe: s.aufrufe, runden: s.runden, token: s.token });
  });

  it('Browser weg → kein Werkzeug mehr, Lauf `abgebrochen`; Grenzen bleiben (Runden)', async () => {
    const { schleife, ABBRUCH_BROWSER } = await import('@/lib/agenten/schleife');
    const ab = new AbortController();
    const ausgefuehrt: string[] = [];
    NETZ.antworten.push(runde1());
    const s = await schleife({ ...basis(), signal: ab.signal, ereignis: e => { if (e.art === 'text') ab.abort(); }, ausfuehren: async a => { ausgefuehrt.push(a.name); return { inhalt: 'x', ok: true }; } });
    expect(s).toMatchObject({ status: 'abgebrochen', grund: ABBRUCH_BROWSER, werkzeugAufrufe: 0 });
    expect(ausgefuehrt).toEqual([]);
    // Runden-Grenze gilt im Strom genauso: 1 Runde, das Werkzeug läuft, danach Schluss.
    NETZ.antworten.push(runde1());
    const g = await schleife({ ...basis(), runden: 1, ereignis: () => {} });
    expect(g.runden).toBe(1);
  });
});

// ── (4) Routen ──────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('/api/kimmi mit Strom', () => {
  it('Accept: text/event-stream → Strom; `ende` = JSON-Antwort = gespeicherte Antwort im Thread', async () => {
    NETZ.antworten.push(text('Heute zählt vor allem eines: das Angebot fertig machen.'));
    const r = await stromRufen(kimmi.POST, '/api/kimmi', SSE_KOPF('person-a'), { message: 'Was ist heute wichtig?', zoeFaden: 'neu' });
    expect(r.headers.get('content-type')).toMatch(/^text\/event-stream/);
    expect(r.headers.get('cache-control')).toMatch(/no-transform/);
    const { ereignisse, ende } = await stromAuslesen(r);
    expect(ende?.status).toBe(200);
    expect(textAus(ereignisse)).toBe('Heute zählt vor allem eines: das Angebot fertig machen.');
    expect(ende!.body.reply).toBe(textAus(ereignisse));
    const f = (await bestand('person-a')).find(x => x.id === ende!.body.fadenId)!;
    expect(f.nachrichten.map(n => [n.rolle, n.text])).toEqual([['person', 'Was ist heute wichtig?'], ['agent', ende!.body.reply]]);
    // derselbe Zug ohne Strom: dieselbe Form der Antwort
    NETZ.antworten.push(text('Heute zählt vor allem eines: das Angebot fertig machen.'));
    const j = await rufe(kimmi.POST, '/api/kimmi', sitzung('person-a'), { message: 'Was ist heute wichtig?', zoeFaden: f.id });
    expect(j.status).toBe(200);
    expect(Object.keys(j.d).sort()).toEqual(Object.keys(ende!.body).sort());
    expect(j.d.reply).toBe(ende!.body.reply);
  });

  it('Werkzeuge erscheinen als Stand (läuft → Vorschlag), nur mit Namen — die Regeln (Stapel) gelten unverändert', async () => {
    NETZ.antworten.push(werkzeug(['fakt_merken', { thema: 'Termine', satz: 'MARKE-FAKT: keine Termine vor zehn' }]), text('Liegt in deinem Stapel.'));
    const r = await stromRufen(kimmi.POST, '/api/kimmi', SSE_KOPF('person-a'), { message: 'Merk dir: keine Termine vor zehn.', zoeFaden: 'neu' });
    const { ereignisse, ende } = await stromAuslesen(r);
    const w = ereignisse.filter(e => e.art === 'werkzeug');
    expect(w).toEqual([{ art: 'werkzeug', name: 'fakt_merken', status: 'laeuft' }, { art: 'werkzeug', name: 'fakt_merken', status: 'vorgeschlagen' }]);
    expect(JSON.stringify(ereignisse)).not.toContain('MARKE-FAKT');
    expect(ende!.body.ran).toEqual([{ agent: 'fakt_merken', ok: true }]);
    expect(ergebnisInhalt(NETZ.anfragen[1])).toMatch(/^VORGESCHLAGEN, NICHT AUSGEFÜHRT/);
  });

  it('Fehler vor dem Strom → JSON mit Status (kein Strom)', async () => {
    const r = await stromRufen(kimmi.POST, '/api/kimmi', SSE_KOPF('person-a'), { message: 'Hallo', zoeFaden: '../fremd' });
    expect(r.status).toBe(400);
    expect(r.headers.get('content-type')).toMatch(/json/);
    const k = await stromRufen(kimmi.POST, '/api/kimmi', SSE_KOPF('kunde'), { message: 'Hallo', zoeFaden: 'neu' });
    expect(k.status).toBe(403);
    expect(k.headers.get('content-type')).toMatch(/json/);
    expect(NETZ.anfragen).toHaveLength(0);
  });

  it('KI-Tor gesperrt → kein Stück Text, kein Modell-Aufruf; Ende wie ohne Strom', async () => {
    await ke.aendereKiEinstellungen(d => ({ ...d, instanz: { ...(d.instanz ?? {}), budget: { monatEuroCent: 100 } } }));
    const vorher = await db.loadJson('ki-verbrauch');
    await db.saveJson('ki-verbrauch', { tage: [{ tag: new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' }), posten: [{ modell: 'claude-sonnet-5', zweck: 'test', ein: 1, aus: 1, anzahl: 1, cent: 9000 }] }] });
    const r = await stromRufen(kimmi.POST, '/api/kimmi', SSE_KOPF('person-a'), { message: 'Hallo', zoeFaden: 'neu' });
    const { ereignisse, ende } = await stromAuslesen(r);
    await ke.aendereKiEinstellungen(d => ({ ...d, instanz: { ...(d.instanz ?? {}), budget: undefined } }));
    await db.saveJson('ki-verbrauch', vorher ?? { tage: [] });
    expect(ereignisse.filter(e => e.art === 'text')).toEqual([]);
    expect(NETZ.anfragen).toHaveLength(0);
    expect(ende?.status).toBe(200);
    expect(String(ende!.body.error)).toContain('ki-gesperrt:budget');
  });

  it('Browser schließt mitten in der Antwort → keine halbe Antwort, die unbeantwortete Frage geht wieder heraus', async () => {
    NETZ.antworten.push({ haengen: true });
    const ab = new AbortController();
    const r = await stromRufen(kimmi.POST, '/api/kimmi', SSE_KOPF('person-a'), { message: 'MARKE-ABBRUCH-4411', zoeFaden: 'neu' }, ab.signal);
    expect(r.headers.get('content-type')).toMatch(/^text\/event-stream/);
    // Die Frage steht im Thread, solange der Zug läuft (seit dem Härtetest 09.10. legt der Zug sie selbst an — innerhalb von `einmalig`).
    expect(await bis(async () => JSON.stringify(await bestand('person-a')).includes('MARKE-ABBRUCH-4411'))).toBe(true);
    const leser = r.body!.getReader();
    const dec = new TextDecoder();
    let gelesen = '';
    while (!gelesen.includes('Ich fange an')) { const { value, done } = await leser.read(); if (done) break; gelesen += dec.decode(value, { stream: true }); }
    ab.abort();
    await leser.cancel().catch(() => {});
    expect(await bis(async () => !JSON.stringify(await bestand('person-a')).includes('MARKE-ABBRUCH-4411'))).toBe(true);
    expect(JSON.stringify(await bestand('person-a'))).not.toContain('Ich fange an');
    expect(NETZ.anfragen).toHaveLength(1);
  });
});

describe('/api/agenten/faden (senden) mit Strom', () => {
  it('Head-Chat: Text entsteht im Strom, `ende` trägt den gespeicherten Thread; ohne Accept JSON wie bisher', async () => {
    NETZ.antworten.push(text('Die Pipeline ist ruhig — zwei Deals warten auf ein Angebot.'));
    const r = await stromRufen(faden.POST, '/api/agenten/faden', SSE_KOPF('person-a'), { aktion: 'senden', agent: { art: 'head', headId: 'sales' }, text: 'Wie steht die Pipeline?' });
    expect(r.headers.get('content-type')).toMatch(/^text\/event-stream/);
    const { ereignisse, ende } = await stromAuslesen(r);
    expect(ende?.status).toBe(200);
    const f = ende!.body.faden as FadenKern;
    expect(f.nachrichten.at(-1)).toMatchObject({ rolle: 'agent', ki: true, text: textAus(ereignisse) });
    expect((await bestand('person-a')).find(x => x.id === f.id)!.nachrichten.at(-1)!.text).toBe(textAus(ereignisse));
    NETZ.antworten.push(text('Weiter ruhig.'));
    const j = await rufe(faden.POST, '/api/agenten/faden', sitzung('person-a'), { aktion: 'senden', agent: { art: 'head', headId: 'sales' }, fadenId: f.id, text: 'Und jetzt?' });
    expect(j.status).toBe(200);
    expect(Object.keys(j.d).sort()).toEqual(Object.keys(ende!.body).sort());
  });

  it('Fehler vor dem Strom → JSON (Dienstweg 403); Fehler im Senden-Weg kommen als `ende` mit demselben Status', async () => {
    const d = await stromRufen(faden.POST, '/api/agenten/faden', { ...dienst('person-a'), accept: 'text/event-stream' }, { aktion: 'senden', agent: { art: 'head', headId: 'sales' }, text: 'x' });
    expect(d.status).toBe(403);
    expect(d.headers.get('content-type')).toMatch(/json/);
    const r = await stromRufen(faden.POST, '/api/agenten/faden', SSE_KOPF('person-a'), { aktion: 'senden', agent: { art: 'head', headId: 'sales' }, text: 'x'.repeat(8_001) });
    const { ende } = await stromAuslesen(r);
    const j = await rufe(faden.POST, '/api/agenten/faden', sitzung('person-a'), { aktion: 'senden', agent: { art: 'head', headId: 'sales' }, text: 'x'.repeat(8_001) });
    expect(ende).toEqual({ status: j.status, body: j.d });
    expect(j.status).toBe(413);
  });

  it('Browser schließt mitten in der Antwort → nichts gespeichert, auch der neue Thread nicht; dieselbe anfrageId darf neu laufen', async () => {
    NETZ.antworten.push({ haengen: true });
    const anfrageId = 'strom-abbruch-0001';
    const vorher = (await bestand('person-a')).length;
    const r = await stromRufen(faden.POST, '/api/agenten/faden', SSE_KOPF('person-a'), { aktion: 'senden', agent: { art: 'head', headId: 'sales' }, text: 'MARKE-HEAD-ABBRUCH-5512', anfrageId });
    const leser = r.body!.getReader();
    const dec = new TextDecoder();
    let gelesen = '';
    while (!gelesen.includes('Ich fange an')) { const { value, done } = await leser.read(); if (done) break; gelesen += dec.decode(value, { stream: true }); }
    await leser.cancel();
    expect(await bis(async () => !JSON.stringify(await bestand('person-a')).includes('MARKE-HEAD-ABBRUCH-5512'))).toBe(true);
    expect((await bestand('person-a')).length).toBe(vorher);
    // `einmalig` hat die Anfrage freigegeben (499 = nichts gemerkt): derselbe Versuch läuft jetzt sauber durch.
    expect(await bis(async () => {
      const a = await db.loadJson<{ anfragen: Record<string, unknown> }>('anfragen-ergebnis');
      return !a?.anfragen?.[`agenten-faden:${anfrageId}`];
    })).toBe(true);
    NETZ.antworten.push(text('Jetzt vollständig.'));
    const j = await rufe(faden.POST, '/api/agenten/faden', sitzung('person-a'), { aktion: 'senden', agent: { art: 'head', headId: 'sales' }, text: 'MARKE-HEAD-ABBRUCH-5512', anfrageId });
    expect(j.status).toBe(200);
    expect((j.d.faden as FadenKern).nachrichten.map(n => n.rolle)).toEqual(['person', 'agent']);
  });
});

// ── (5) Browser ─────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('Browser: Strom mit Rückfall auf JSON (lib/http/strom-client.ts)', () => {
  const sseAntwort = (roh: string) => new Response(roh, { status: 200, headers: { 'content-type': 'text/event-stream' } });
  const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'content-type': 'application/json' } });

  it('Strom → Ereignisse + Ende; JSON-Antwort → wie bisher; Netzfehler → EINMAL als JSON; abgerissen → keine Wiederholung', async () => {
    const { postMitStrom } = await import('@/lib/http/strom-client');
    const { sseZeile } = await import('@/lib/http/sse');
    const alt = globalThis.fetch;
    const aufrufe: { accept: string }[] = [];
    let folge: (() => Response | Promise<Response>)[] = [];
    globalThis.fetch = (async (_u: unknown, init?: { headers?: Record<string, string> }) => { aufrufe.push({ accept: String(init?.headers?.Accept ?? '') }); return folge.shift()!(); }) as typeof fetch;
    try {
      const es: StromEreignis[] = [];
      folge = [() => sseAntwort(`${sseZeile('text', { text: 'Hal' })}${sseZeile('werkzeug', { name: 'a', status: 'laeuft' })}${sseZeile('text', { text: 'lo' })}${sseZeile('ende', { status: 200, body: { reply: 'Hallo' } })}`)];
      expect(await postMitStrom('/api/kimmi', {}, e => es.push(e))).toEqual({ status: 200, body: { reply: 'Hallo' }, gestreamt: true });
      expect(textAus(es)).toBe('Hallo');
      expect(aufrufe[0].accept).toContain('text/event-stream');

      folge = [() => json({ ok: false, fehler: 'Stand veraltet.' }, 409)];
      expect(await postMitStrom('/api/agenten/faden', {}, () => {})).toEqual({ status: 409, body: { ok: false, fehler: 'Stand veraltet.' }, gestreamt: false });

      aufrufe.length = 0;
      folge = [() => { throw new TypeError('Failed to fetch'); }, () => json({ reply: 'Per JSON.' })];
      expect(await postMitStrom('/api/kimmi', {}, () => {})).toEqual({ status: 200, body: { reply: 'Per JSON.' }, gestreamt: false });
      expect(aufrufe.map(a => a.accept)).toEqual([expect.stringContaining('text/event-stream'), 'application/json']);

      aufrufe.length = 0;
      folge = [() => sseAntwort(sseZeile('text', { text: 'Halb' }))];
      expect(await postMitStrom('/api/kimmi', {}, () => {})).toMatchObject({ unterbrochen: true, gestreamt: true, status: 0 });
      expect(aufrufe).toHaveLength(1);
    } finally { globalThis.fetch = alt; }
  });

  it('daten.ts: `ende` mit Fehlerstatus wird ein Ergebnis wie ohne Strom; abgerissen → Satz statt stiller Wiederholung', async () => {
    const daten = await import('@/components/os/agenten/daten');
    const { sseZeile } = await import('@/lib/http/sse');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(sseZeile('ende', { status: 409, body: { ok: false, fehler: 'Der Thread hat sich inzwischen geändert.' } }), { headers: { 'content-type': 'text/event-stream' } })));
    const r = await daten.fadenSenden({ aktion: 'senden', agent: { art: 'head', headId: 'sales' }, text: 'x' }, () => {});
    expect(r).toMatchObject({ ok: false, status: 409, text: 'Der Thread hat sich inzwischen geändert.' });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(sseZeile('text', { text: 'Halb' }), { headers: { 'content-type': 'text/event-stream' } })));
    const u = await daten.zoeFragen({ message: 'x', space: 'privat', zoeFaden: 'neu' }, () => {});
    expect(u).toMatchObject({ ok: false, status: 0, text: daten.STROM_ABGERISSEN });
    vi.unstubAllGlobals();
  });

  it('Anzeige: der Text, während er entsteht, und „ruft … auf“', async () => {
    const { Schreibt } = await import('@/components/os/agenten/Chat');
    const html = renderToStaticMarkup(createElement(Schreibt, { name: 'ZOE', entsteht: { text: 'Ich schaue gerade', werkzeug: 'suche_arbeit' } }));
    expect(html).toContain('Ich schaue gerade');
    expect(html).toContain('ZOE ruft suche_arbeit auf …');
    expect(renderToStaticMarkup(createElement(Schreibt, { name: 'ZOE' }))).toContain('ZOE schreibt …');
  });
});

describe('Verdrahtung (Wächter)', () => {
  it('alle vier Chats schicken über den Strom-Client; nur daten.ts spricht im Agenten-Bereich mit dem Server', async () => {
    const { readFileSync } = await import('node:fs');
    for (const f of ['components/os/ZoePanel.tsx', 'components/os/ZoeStart.tsx']) {
      const t = readFileSync(f, 'utf8');
      expect(t, f).toContain("postMitStrom('/api/kimmi'");
      expect(t, f).not.toMatch(/fetch\('\/api\/kimmi'/);
    }
    const d = readFileSync('components/os/agenten/daten.ts', 'utf8');
    expect(d).toContain('postMitStrom(');
    for (const f of ['ZoeMitte', 'HeadMitte', 'FadenMitte']) expect(readFileSync(`components/os/agenten/${f}.tsx`, 'utf8'), f).toMatch(/entstehendNach\(s, e\)/);
    // Beide Routen prüfen vor dem Strom wie bisher und streamen nur auf Wunsch des Browsers.
    for (const f of ['app/api/kimmi/route.ts', 'app/api/agenten/faden/route.ts']) expect(readFileSync(f, 'utf8'), f).toMatch(/if \(willStrom\(req\)( && [^)]+)?\) return sseAntwort\(req, /);
  });
});
