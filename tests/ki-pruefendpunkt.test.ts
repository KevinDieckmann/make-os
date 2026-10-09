// ─── KI-Prüfendpunkt + Prüfmodell (09.10., „Agenten live durchgeklickt“) ────────────────────────────────────────────────────
// Wächter: die Umlenkung der Messages-API (MAKE_OS_KI_PRUEFENDPUNKT, lib/ki/pruefendpunkt.ts) greift NIE in Produktion (außer Demo-Instanz),
// NIE zu fremden Hosts, und es reist NIE der echte Schlüssel dorthin. Start-Riegel „scharf“ startet mit gesetzter Variable nicht; der Head of IT
// zeigt sie in Produktion rot. Dazu das nachgebaute Modell (scripts/ki-pruefmodell.mjs) von Ende zu Ende: askText/askStream über loopback,
// ZOE ruft head_fragen, ein Head delegiert an einen Mitarbeiter, JSON-Antworten, Fehler-Modus.
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-ki-pruef-'));
  Object.assign(process.env, { MAKE_OS_DATEN_DIR: o, MAKE_OS_KEY: 'pruef-schluessel-ki-pruefendpunkt', MAKE_OS_KI_VORGABE: 'kompatibel', ANTHROPIC_API_KEY: 'echter-schluessel-darf-nie-reisen', MAKE_OS_BRAIN_INDEX: 'aus', MAKE_OS_DOKU_WURZEL: 'aus' });
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  delete process.env.MAKE_OS_KI_ANBIETER_TOR;
  delete process.env.MAKE_OS_KI_BUDGET_MONAT_EURO;
  delete process.env.MAKE_OS_KI_PRUEFENDPUNKT;
  delete process.env.MAKE_OS_DEMO;
  return o;
});

import { pruefEndpunkt, pruefUrl, pruefSatz, PRUEF_SCHLUESSEL, PRUEF_VARIABLE } from '@/lib/ki/pruefendpunkt';
import { startPruefung, mangelSatz } from '@/lib/zugang/start-riegel';
import { kiPruefBefunde, zugangBefunde } from '@/lib/hoi/lage';
import { anbieterEingerichtet } from '@/lib/ki/konfig';

const L = 'x'.repeat(64);
const SERVER = { NODE_ENV: 'production', MAKE_OS_ADRESSE: 'https://app.example.invalid', MAKE_OS_KEY: L, SESSION_SECRET: L };
const env0 = { ...process.env };
afterEach(() => {
  for (const k of [PRUEF_VARIABLE, 'MAKE_OS_DEMO', 'NODE_ENV']) { if (env0[k] === undefined) delete process.env[k]; else Object.assign(process.env, { [k]: env0[k] }); }
  process.env.ANTHROPIC_API_KEY = 'echter-schluessel-darf-nie-reisen';
});

// ── (1) rein: wann greift die Umlenkung? ────────────────────────────────────────────────────────────────────────────────────

describe('pruefEndpunkt (rein)', () => {
  const dev = { NODE_ENV: 'development' };
  it('nicht gesetzt → keine Umlenkung', () => {
    expect(pruefEndpunkt(dev)).toEqual({ gesetzt: false });
    expect(pruefUrl({ ...dev, [PRUEF_VARIABLE]: '   ' })).toBeNull();
    expect(pruefSatz({ gesetzt: false })).toBeNull();
  });
  it('loopback in Entwicklung → aktiv; „/v1/messages“ wird angehängt, auch für [::1] und localhost', () => {
    expect(pruefEndpunkt({ ...dev, [PRUEF_VARIABLE]: 'http://127.0.0.1:4599' })).toEqual({ gesetzt: true, aktiv: true, url: 'http://127.0.0.1:4599/v1/messages' });
    expect(pruefUrl({ ...dev, [PRUEF_VARIABLE]: 'http://localhost:4599/' })).toBe('http://localhost:4599/v1/messages');
    expect(pruefUrl({ ...dev, [PRUEF_VARIABLE]: 'http://[::1]:4599/v1/messages' })).toBe('http://[::1]:4599/v1/messages');
    expect(pruefUrl({ NODE_ENV: 'test', [PRUEF_VARIABLE]: 'https://127.0.0.1:8443' })).toBe('https://127.0.0.1:8443/v1/messages');
  });
  it('NIE in Produktion — außer Demo-Instanz (MAKE_OS_DEMO=1)', () => {
    expect(pruefEndpunkt({ NODE_ENV: 'production', [PRUEF_VARIABLE]: 'http://127.0.0.1:4599' })).toEqual({ gesetzt: true, aktiv: false, grund: 'produktion' });
    expect(pruefUrl({ NODE_ENV: 'production', MAKE_OS_DEMO: '0', [PRUEF_VARIABLE]: 'http://127.0.0.1:4599' })).toBeNull();
    expect(pruefUrl({ NODE_ENV: 'production', MAKE_OS_DEMO: 'ja', [PRUEF_VARIABLE]: 'http://127.0.0.1:4599' })).toBeNull();
    expect(pruefUrl({ NODE_ENV: 'production', MAKE_OS_DEMO: '1', [PRUEF_VARIABLE]: 'http://127.0.0.1:4599' })).toBe('http://127.0.0.1:4599/v1/messages');
  });
  it('NIE zu fremden Hosts — auch nicht mit Demo, auch nicht mit Tricks im Namen', () => {
    for (const ziel of ['https://api.example.com', 'http://10.0.0.5:4599', 'http://192.168.1.2', 'http://localhost.example.com', 'http://127.0.0.1.nip.io', 'http://0.0.0.0:4599',
      'http://127.0.0.2:4599', 'http://evil.test@', 'http://169.254.169.254', 'http://[::ffff:7f00:1]:4599', 'http://[fe80::1]:4599']) {
      const p = pruefEndpunkt({ NODE_ENV: 'development', MAKE_OS_DEMO: '1', [PRUEF_VARIABLE]: ziel });
      expect(p.gesetzt && p.aktiv, ziel).toBe(false);
    }
    // Benutzer/Passwort, Abfrage, andere Schemata, Unsinn → ungültig
    for (const ziel of ['http://user:pw@127.0.0.1:4599', 'http://127.0.0.1:4599/?x=1', 'ftp://127.0.0.1', 'file:///etc/passwd', 'kein-url']) {
      expect(pruefEndpunkt({ NODE_ENV: 'development', [PRUEF_VARIABLE]: ziel }), ziel).toMatchObject({ gesetzt: true, aktiv: false });
    }
  });
  it('Sätze nennen nie die Adresse', () => {
    for (const ziel of ['http://127.0.0.1:47123', 'http://10.9.8.7:47123']) {
      for (const NODE_ENV of ['development', 'production']) {
        const s = pruefSatz(pruefEndpunkt({ NODE_ENV, [PRUEF_VARIABLE]: ziel })) ?? '';
        expect(s).toContain(PRUEF_VARIABLE);
        expect(s).not.toMatch(/10\.9\.8\.7|47123/);
      }
    }
  });
});

describe('Start-Riegel und Head of IT', () => {
  it('scharf/streng: gesetzt → Start verweigert; lokal/entwicklung: nur Warnung', () => {
    const voll = { datenSchluessel: 64, pepper: 64 };
    const scharf = startPruefung({ ...SERVER, [PRUEF_VARIABLE]: 'http://127.0.0.1:4599' }, voll);
    expect(scharf.blockiert).toBe(true);
    expect(scharf.maengel).toEqual([{ was: 'KI-Prüfendpunkt', art: 'gesetzt', hart: true }]);
    expect(startPruefung({ ...SERVER, MAKE_OS_START_RIEGEL: 'streng', MAKE_OS_PEPPER: L, [PRUEF_VARIABLE]: 'http://127.0.0.1:4599' }, voll).blockiert).toBe(true);
    const lokal = startPruefung({ NODE_ENV: 'production', MAKE_OS_KEY: L, SESSION_SECRET: L, MAKE_OS_DEMO: '1', [PRUEF_VARIABLE]: 'http://127.0.0.1:4599' }, voll);
    expect(lokal.blockiert).toBe(false);
    expect(lokal.maengel).toEqual([{ was: 'KI-Prüfendpunkt', art: 'gesetzt', hart: false }]);
    expect(startPruefung({ NODE_ENV: 'development', [PRUEF_VARIABLE]: 'http://127.0.0.1:4599' }, voll).blockiert).toBe(false);
    expect(startPruefung(SERVER, voll)).toEqual({ modus: 'scharf', maengel: [], blockiert: false });
    expect(mangelSatz({ was: 'KI-Prüfendpunkt', art: 'gesetzt', hart: true })).toContain(PRUEF_VARIABLE);
  });
  it('HOI: in Produktion gesetzt → rot; wirksam (Demo/Entwicklung) → gelb; nicht gesetzt → nichts', () => {
    expect(kiPruefBefunde(undefined)).toEqual([]);
    expect(kiPruefBefunde({ gesetzt: false, aktiv: false, produktion: true })).toEqual([]);
    expect(kiPruefBefunde({ gesetzt: true, aktiv: false, produktion: true })[0]).toMatchObject({ id: 'ki-pruefendpunkt', ampel: 'rot' });
    expect(kiPruefBefunde({ gesetzt: true, aktiv: true, produktion: false })[0]).toMatchObject({ id: 'ki-pruefendpunkt', ampel: 'gelb', wert: 'Prüfmodell aktiv' });
    expect(kiPruefBefunde({ gesetzt: true, aktiv: false, produktion: false })[0]).toMatchObject({ ampel: 'gelb', wert: 'gesetzt, aber ignoriert' });
    // Riegel-Befund nennt den Mangel lesbar
    const b = zugangBefunde({ zuliefererSchluessel: false, zuliefererAltZuletzt: null, riegel: { modus: 'scharf', maengel: [{ was: 'KI-Prüfendpunkt', art: 'gesetzt', hart: true }] } }, new Date().toISOString());
    expect(b.find(x => x.id === 'start-riegel')?.wert).toBe('scharf: KI-Prüfendpunkt gesetzt');
  });
  it('Anbieter-Tor: der Prüfendpunkt zählt als „Anthropic direkt eingerichtet“ nur, wenn er wirkt', () => {
    expect(anbieterEingerichtet('anthropic', { NODE_ENV: 'development', [PRUEF_VARIABLE]: 'http://127.0.0.1:4599' })).toBe(true);
    expect(anbieterEingerichtet('anthropic', { NODE_ENV: 'production', [PRUEF_VARIABLE]: 'http://127.0.0.1:4599' })).toBe(false);
    expect(anbieterEingerichtet('anthropic', { NODE_ENV: 'development', [PRUEF_VARIABLE]: 'http://10.0.0.5:4599' })).toBe(false);
  });
});

// ── (2) askText/askStream: Ziel und Schlüssel — gegen das echte Prüfmodell-Skript über loopback ─────────────────────────────

let kind: ChildProcess | null = null;
let basis = '';
type Aufruf = { url: string; schluessel: string | null };
const aufrufe: Aufruf[] = [];
let fetchAlt: typeof fetch;

beforeAll(async () => {
  const skript = path.join(process.cwd(), 'scripts', 'ki-pruefmodell.mjs');
  kind = spawn(process.execPath, [skript, '--port', '0', '--tempo', '0'], { stdio: ['ignore', 'pipe', 'pipe'] });
  basis = await new Promise<string>((ok, nein) => {
    const t = setTimeout(() => nein(new Error('Prüfmodell startet nicht')), 8000);
    kind!.stdout!.on('data', (d: Buffer) => { const m = /http:\/\/127\.0\.0\.1:(\d+)/.exec(String(d)); if (m) { clearTimeout(t); ok(`http://127.0.0.1:${m[1]}`); } });
  });
  // Mitschreiben, wohin die App sendet und mit welchem Schlüssel — loopback geht an das echte Skript, api.anthropic.com bekommt eine feste
  // Antwort (kein Netz nach draußen im Test).
  fetchAlt = globalThis.fetch;
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    const u = String(url);
    const h = new Headers(init?.headers);
    if (u.includes('/v1/messages')) aufrufe.push({ url: u, schluessel: h.get('x-api-key') });
    if (u.startsWith('https://api.anthropic.com/')) return new Response(JSON.stringify({ id: 'm', type: 'message', role: 'assistant', content: [{ type: 'text', text: 'von der echten Adresse' }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } }), { status: 200, headers: { 'content-type': 'application/json' } });
    if (u.startsWith(basis)) return fetchAlt(url as string, init);
    throw new Error(`Netz im Test gesperrt: ${u.slice(0, 60)}`);
  }) as typeof fetch;
}, 15_000);
afterAll(() => { globalThis.fetch = fetchAlt; kind?.kill('SIGTERM'); rmSync(ordner, { recursive: true, force: true }); });

const ki = { lauf: 'aufruf' as const, person: 'person-a', kategorien: ['allgemein' as const] };

describe('askText/askStream mit Prüfendpunkt', () => {
  it('Entwicklung + loopback: an das Prüfmodell, mit dem Platzhalter — NIE mit dem echten Schlüssel', async () => {
    const { askText, askStream } = await import('@/lib/anthropic');
    process.env[PRUEF_VARIABLE] = basis;
    aufrufe.length = 0;
    const r = await askText({ system: 'Du bist ZOE', user: 'Was steht heute an?', zweck: 'test-pruef', ki });
    expect(r.ok).toBe(true);
    expect(r.text).toMatch(/heute/i);
    const stuecke: string[] = [];
    const s = await askStream({ system: 'Du bist ZOE', user: 'Was steht heute an?', zweck: 'test-pruef-strom', ki }, { onText: t => stuecke.push(t) });
    expect(s.ok).toBe(true);
    expect(stuecke.length).toBeGreaterThan(3);
    expect(stuecke.join('')).toBe(s.text);
    expect(s.usage?.ein).toBeGreaterThan(0);
    expect(aufrufe.length).toBe(2);
    for (const a of aufrufe) {
      expect(a.url).toBe(`${basis}/v1/messages`);
      expect(a.schluessel).toBe(PRUEF_SCHLUESSEL);
      expect(a.schluessel).not.toBe(process.env.ANTHROPIC_API_KEY);
    }
  });
  it('ohne ANTHROPIC_API_KEY: mit wirksamer Umlenkung antwortet das Prüfmodell, ohne → „no-key“ (nichts geht hinaus)', async () => {
    const { askText, hasAnthropicKey } = await import('@/lib/anthropic');
    delete process.env.ANTHROPIC_API_KEY;
    process.env[PRUEF_VARIABLE] = basis;
    expect(hasAnthropicKey()).toBe(true);
    expect((await askText({ system: 's', user: 'Hallo', zweck: 'test-pruef', ki })).ok).toBe(true);
    delete process.env[PRUEF_VARIABLE];
    expect(hasAnthropicKey()).toBe(false);
    aufrufe.length = 0;
    expect((await askText({ system: 's', user: 'Hallo', zweck: 'test-pruef', ki })).error).toBe('no-key');
    expect(aufrufe.length).toBe(0);
  });
  it('Produktion ohne Demo: ignoriert — die echte Adresse mit dem echten Schlüssel; mit Demo: Prüfmodell', async () => {
    const { askText } = await import('@/lib/anthropic');
    process.env[PRUEF_VARIABLE] = basis;
    Object.assign(process.env, { NODE_ENV: 'production' });
    aufrufe.length = 0;
    const r = await askText({ system: 's', user: 'Hallo', zweck: 'test-pruef', ki });
    expect(r.text).toBe('von der echten Adresse');
    expect(aufrufe[0]).toEqual({ url: 'https://api.anthropic.com/v1/messages', schluessel: 'echter-schluessel-darf-nie-reisen' });
    process.env.MAKE_OS_DEMO = '1';
    aufrufe.length = 0;
    await askText({ system: 's', user: 'Hallo', zweck: 'test-pruef', ki });
    expect(aufrufe[0]).toEqual({ url: `${basis}/v1/messages`, schluessel: PRUEF_SCHLUESSEL });
  });
  it('fremder Host: ignoriert — die echte Adresse', async () => {
    const { askText } = await import('@/lib/anthropic');
    process.env[PRUEF_VARIABLE] = 'http://10.0.0.5:4599';
    aufrufe.length = 0;
    await askText({ system: 's', user: 'Hallo', zweck: 'test-pruef', ki });
    expect(aufrufe[0].url).toBe('https://api.anthropic.com/v1/messages');
  });
});

// ── (3) das Prüfmodell selbst: Werkzeug-Aufrufe, JSON, Fehler-Modus ─────────────────────────────────────────────────────────

const frage = async (body: Record<string, unknown>) => (await fetchAlt(`${basis}/v1/messages`, { method: 'POST', body: JSON.stringify({ model: 'm', max_tokens: 100, ...body }) })).json() as Promise<{ content: { type: string; name?: string; input?: Record<string, unknown>; text?: string }[]; stop_reason: string; usage: { input_tokens: number } }>;
const ZOE = 'Du bist ZOE — die zentrale Intelligenz.\nHEADS:\n- sales · Head of Sales (Business) — Vertrieb\n- marketing · Head of Marketing (Business) — Marketing';

describe('Prüfmodell (scripts/ki-pruefmodell.mjs)', () => {
  it('ZOE: „Frag Sales …“ → head_fragen; „Gib … an Marketing“ → an_head; nach dem Ergebnis ein Text, der den Head nennt', async () => {
    const tools = [{ name: 'head_fragen', input_schema: {} }, { name: 'an_head', input_schema: {} }];
    const a = await frage({ system: ZOE, messages: [{ role: 'user', content: 'Frag Sales, wie die Pipeline steht' }], tools });
    expect(a.stop_reason).toBe('tool_use');
    const tu = a.content.find(c => c.type === 'tool_use')!;
    expect(tu).toMatchObject({ name: 'head_fragen', input: { head: 'sales' } });
    const b = await frage({ system: ZOE, messages: [{ role: 'user', content: 'Gib das bitte an Marketing: Beitrag zur Messe vorbereiten' }], tools });
    expect(b.content.find(c => c.type === 'tool_use')).toMatchObject({ name: 'an_head', input: { head: 'marketing' } });
    const c = await frage({ system: ZOE, tools, messages: [
      { role: 'user', content: 'Frag Sales, wie die Pipeline steht' },
      { role: 'assistant', content: a.content },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: (tu as { id?: string }).id, content: 'ANTWORT von Head of Sales (Daten aus seinem Bereich):\n3 offene Deals, 1 überfällig.' }] },
    ] });
    expect(c.stop_reason).toBe('end_turn');
    expect(c.content[0].text).toMatch(/Head of Sales/);
  });
  it('Head: „… von einem Mitarbeiter prüfen“ → an_mitarbeiter mit passendem Mitarbeiter und vollständigem Auftrag; „Aufgabe …“ → create_task', async () => {
    const tools = [{ name: 'an_mitarbeiter', input_schema: { properties: { mitarbeiter: { enum: ['sales-recherche', 'sales-angebote', 'sales-nachfassen'] } } } }, { name: 'create_task', input_schema: {} }];
    const sys = 'Du bist Head of Sales. Dein Auftrag: Vertrieb.';
    const a = await frage({ system: sys, tools, messages: [{ role: 'user', content: 'Lass die offenen Angebote von einem Mitarbeiter prüfen' }] });
    const tu = a.content.find(c => c.type === 'tool_use')!;
    expect(tu.name).toBe('an_mitarbeiter');
    expect(tu.input).toMatchObject({ mitarbeiter: 'sales-angebote' });
    expect(Object.keys(tu.input!.auftrag as object).sort()).toEqual(['format', 'grenzen', 'quellen', 'ziel']);
    const b = await frage({ system: sys, tools, messages: [{ role: 'user', content: 'Lege eine Aufgabe an: Angebot Nordlicht nachfassen' }] });
    expect(b.content.find(c => c.type === 'tool_use')).toMatchObject({ name: 'create_task', input: { title: 'Angebot Nordlicht nachfassen' } });
  });
  it('JSON: Schema der strukturierten Ausgabe und „Antworte NUR mit JSON“ (Testlauf: je Erwartung true)', async () => {
    const a = await frage({ system: 'x', messages: [{ role: 'user', content: 'y' }], output_config: { format: { type: 'json_schema', schema: { type: 'object', properties: { gruss: { type: 'string' }, punkte: { type: 'array', items: { type: 'string' } }, stufe: { type: 'string', enum: ['gut', 'schlecht'] } } } } } });
    expect(JSON.parse(a.content[0].text!)).toMatchObject({ stufe: 'gut', punkte: [expect.any(String)] });
    const b = await frage({ system: 'Du prüfst einen Testlauf. Antworte NUR mit JSON: {"erfuellt": boolean[] (je Erwartung), "notiz": string (≤ 200 Zeichen)}.', messages: [{ role: 'user', content: '<erwartungen>\n1. a\n2. b\n3. c\n</erwartungen>' }] });
    expect(JSON.parse(b.content[0].text!)).toMatchObject({ erfuellt: [true, true, true], notiz: expect.any(String) });
    // „Antworte als reines JSON: {…}“ mit Vorlage (Loop, Morgenlauf, Ernährung …): gültiges JSON aus der Vorlage
    const v = await frage({ system: 'Antworte als reines JSON: {"vorschlaege":[{"titel":"kurz","warum":"Beleg","prio":1|2|3}],"plan":{"mo":{"abend":"…"},…,"so":{…}},"ruhig": true|false}', messages: [{ role: 'user', content: 'x' }] });
    expect(JSON.parse(v.content[0].text!)).toEqual({ vorschlaege: [{ titel: 'kurz', warum: 'Beleg', prio: 1 }], plan: { mo: { abend: '…' }, so: {} }, ruhig: true });
  });
  it('Fehler-Modus: 529 für genau eine Anfrage, danach wieder normal; „[pruef:401]“ in der Nachricht', async () => {
    await fetchAlt(`${basis}/_modus`, { method: 'POST', body: JSON.stringify({ fehler: '529', anzahl: 1 }) });
    expect((await fetchAlt(`${basis}/v1/messages`, { method: 'POST', body: JSON.stringify({ system: 's', messages: [{ role: 'user', content: 'x' }] }) })).status).toBe(529);
    expect((await fetchAlt(`${basis}/v1/messages`, { method: 'POST', body: JSON.stringify({ system: 's', messages: [{ role: 'user', content: 'x' }] }) })).status).toBe(200);
    expect((await fetchAlt(`${basis}/v1/messages`, { method: 'POST', body: JSON.stringify({ system: 's', messages: [{ role: 'user', content: 'x [pruef:401]' }] }) })).status).toBe(401);
    const lage = await (await fetchAlt(`${basis}/_lage`)).json() as { anfragen: number; letzte: { art: string }[] };
    expect(lage.anfragen).toBeGreaterThan(3);
  });
  it('askText übersetzt den Fehler-Modus in EINEN verständlichen Satz (überlastet)', async () => {
    const { askText, modellFehlerText } = await import('@/lib/anthropic');
    process.env[PRUEF_VARIABLE] = basis;
    await fetchAlt(`${basis}/_modus`, { method: 'POST', body: JSON.stringify({ fehler: '529', anzahl: 3 }) });
    const r = await askText({ system: 's', user: 'Hallo', zweck: 'test-pruef', ki, retries: 2 });
    expect(r.ok).toBe(false);
    expect(modellFehlerText(r)).toMatch(/überlastet/);
  }, 15_000);
});
