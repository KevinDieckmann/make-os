// ─── Fixture: Agenten-Bereich Paket 1 „Kern“ — Konten, Modell-Fake, Aufrufe (09.10.) ─────────────────────────────────────────
// Erfundene Konten (`@example.invalid`), kein echter Modellaufruf: `modellFake()` ersetzt `fetch` NUR für die Modell-Schnittstelle
// (jede andere Adresse wirft — kein Netz im Test) und spielt vorbereitete Antworten ab (Text oder Werkzeugaufrufe).
import { expect } from 'vitest';

export const HAUS = 'haus-a';
export const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) =>
  ({ id, speicher, email: `${speicher}@example.invalid`, name: `${speicher[0].toUpperCase()}${speicher.slice(1)} Beispiel`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...extra });

/** person-a Inhaberin, person-b volles Mitglied, team-c nur Business, gast fremder Haushalt, kunde ohne Haushalt. */
export async function kontenSaeen(): Promise<void> {
  const db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [
    konto('k1', 'person-a', 'inhaber', { haushalt: HAUS }),
    konto('k2', 'person-b', 'mitglied', { haushalt: HAUS }),
    konto('k3', 'team-c', 'mitglied', { haushalt: HAUS, finanzRecht: 'business' }),
    konto('k4', 'gast', 'mitglied', { haushalt: 'haus-fremd' }),
    konto('k5', 'kunde', 'mitglied'),
  ], einladungen: [] });
}

export type ModellAntwort = { content: { type: string; id?: string; name?: string; input?: Record<string, unknown>; text?: string }[]; stop_reason: string };
export const text = (t: string): ModellAntwort => ({ content: [{ type: 'text', text: t }], stop_reason: 'end_turn' });
let nr = 0;
export const werkzeug = (...aufrufe: [string, Record<string, unknown>][]): ModellAntwort =>
  ({ content: aufrufe.map(([name, input]) => ({ type: 'tool_use', id: `toolu_${++nr}`, name, input })), stop_reason: 'tool_use' });

export interface ModellFake {
  antworten: (ModellAntwort | ((body: Record<string, unknown>) => ModellAntwort))[];
  anfragen: Record<string, unknown>[];
  /** Rückfall, wenn keine Antwort vorbereitet ist. */
  standard: ModellAntwort;
  zurueck(): void;
}

/** `fetch` nur für die Modell-Schnittstelle — alles andere wirft (kein Netz im Test). */
export function modellFake(): ModellFake {
  const alt = globalThis.fetch;
  const f: ModellFake = {
    antworten: [], anfragen: [], standard: text('Erledigt.'),
    zurueck: () => { globalThis.fetch = alt; },
  };
  globalThis.fetch = (async (url: unknown, init?: { body?: unknown }) => {
    if (!String(url).startsWith('https://api.anthropic.com/')) throw new Error(`Netz im Test gesperrt: ${String(url).slice(0, 80)}`);
    const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
    f.anfragen.push(body);
    const n = f.antworten.shift() ?? f.standard;
    const a = typeof n === 'function' ? n(body) : n;
    return new Response(JSON.stringify({ ...a, usage: { input_tokens: 1000, output_tokens: 100 } }), { status: 200, headers: { 'content-type': 'application/json', 'request-id': 'req-test' } });
  }) as typeof fetch;
  return f;
}

export const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
export const dienst = (person?: string) => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, ...(person ? { 'x-make-person': person } : {}) });

type Handler = (r: Request) => Promise<Response>;
export async function rufe(h: Handler, pfad: string, kopf: Record<string, string>, body?: unknown): Promise<{ status: number; d: Record<string, unknown> }> {
  const r = await h(new Request(`http://test${pfad}`, { method: body === undefined ? 'GET' : 'POST', headers: kopf, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }));
  const t = await r.text();
  let d: Record<string, unknown> = {};
  try { d = JSON.parse(t) as Record<string, unknown>; } catch { d = { roh: t }; }
  return { status: r.status, d };
}

/** Die Werkzeug-Namen einer Modell-Anfrage. */
export const werkzeugNamen = (body: Record<string, unknown>): string[] => ((body.tools as { name: string }[] | undefined) ?? []).map(t => t.name);

export function ohneLeck(text: string, marken: string[]): void {
  for (const m of marken) expect(text, m).not.toContain(m);
}
