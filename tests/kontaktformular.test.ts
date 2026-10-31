// ─── Kontaktformular der Website (31.10., Website-Anbau): öffentliche Route, Schutz, „Adresse unbestätigt“, Middleware, Caddy, Register ────────
// Eigener Datenordner, Datenschlüssel und Pepper, Konten mit Test-Haushalt; Verantwortlicher über die Check-Einstellungen (Abweichung der Website).
// Erfundene Daten (@example.invalid), kein Netz, keine Mail, kein Modell.
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { NextRequest } from 'next/server';
import type { Kontakt } from '@/lib/make-one/crm';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-kontaktformular-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-kontaktformular';
process.env.SESSION_SECRET = 'pruef-sitzung-kontaktformular-nur-im-test';
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-kontaktformular';
process.env.MAKE_OS_PEPPER = 'pruef-pepper-kontaktformular-0123456789abcdef';

type R = { GET?: (r: Request) => Promise<Response>; POST?: (r: Request) => Promise<Response> };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Antwort = { status: number; d: Record<string, any> };
let db: typeof import('@/lib/store/local-db');
let drossel: typeof import('@/lib/zugang/drossel');
let S: typeof import('@/lib/kontaktformular/server');
let anfrage: R, intern: R;
const HAUS = 'test-haus';
const D = 'example.invalid';
const sitzung = (wer = 'kevin') => ({ 'content-type': 'application/json', 'x-make-user': wer });
const json = async (r: Response): Promise<Antwort> => ({ status: r.status, d: await r.json() });
const senden = async (body: Record<string, unknown>, roh?: string) => json(await anfrage.POST!(new Request('http://test/api/anfrage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: roh ?? JSON.stringify(body) })));
const kontakte = async () => (await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];
const T0 = new Date('2026-11-03T09:00:00Z');
const uhr = T0.getTime();
const gut = (x: Record<string, unknown> = {}) => ({ vorname: 'Nora', nachname: 'Neu', firma: 'Neuprobe GmbH', email: `nora.neu@${D}`, nachricht: 'Bitte um Rückruf zum Thema Automatisierung.', stempel: S.kontaktformularStempel(uhr - 10_000), webseite: '', ...x });

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
  db = await import('@/lib/store/local-db');
  drossel = await import('@/lib/zugang/drossel');
  S = await import('@/lib/kontaktformular/server');
  await db.saveJson('konten', { konten: [
    { id: 'k1', speicher: 'kevin', email: `k@${D}`, name: 'Kevin Test', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: HAUS },
    { id: 'k2', speicher: 'malin', email: `m@${D}`, name: 'Malin Test', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: HAUS },
  ], einladungen: [] });
  await db.saveJson('kontakte', { kontakte: [
    { id: 'c-bekannt', vorname: 'Berta', nachname: 'Bestand', email: `berta.bestand@${D}`, eignung: '', prio: '', stufe: 'gespraech', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01', anrede: 'Sie' },
    { id: 'c-gesperrt', vorname: 'Gerd', nachname: 'Gesperrt', email: `gerd.gesperrt@${D}`, eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01', anrede: 'Sie', eingeschraenkt: { seit: '2026-09-01', grund: 'Antrag', von: 'kevin' } },
  ] });
  anfrage = await import('@/app/api/anfrage/route') as R;
  intern = await import('@/app/api/kontaktformular/intern/route') as R;
});
afterEach(() => drossel._zuruecksetzen());
afterAll(() => { vi.useRealTimers(); rmSync(ordner, { recursive: true, force: true }); });

describe('Schalter und Verantwortlicher', () => {
  it('kommt AUS (404); ohne Verantwortlichen lässt es sich nicht einschalten (409); nur der Inhaber schaltet', async () => {
    const status = async () => json(await anfrage.GET!(new Request('http://test/api/anfrage')));
    // Lese-Weg „an/aus“ (31.10., Knopf auf der Website): nur ok + aktiv, sonst nichts.
    const aus = await status();
    expect(aus).toEqual({ status: 200, d: { ok: true, aktiv: false } });
    expect((await senden(gut())).status).toBe(404);
    expect((await json(await intern.POST!(new Request('http://test/api/kontaktformular/intern', { method: 'POST', headers: sitzung(), body: JSON.stringify({ aktiv: true }) })))).status).toBe(409);
    await db.saveJson('check-einstellungen', { aktiv: false, gastgeber: 'kevin', verantwortlich: `Probe GmbH, datenschutz@${D}` });
    expect((await json(await intern.POST!(new Request('http://test/api/kontaktformular/intern', { method: 'POST', headers: sitzung('malin'), body: JSON.stringify({ aktiv: true }) })))).status).toBe(403);
    expect((await json(await intern.POST!(new Request('http://test/api/kontaktformular/intern', { method: 'POST', headers: { ...sitzung(), 'x-make-key': 'pruef-schluessel-kontaktformular', 'x-make-person': 'kevin' }, body: JSON.stringify({ aktiv: true }) })))).status).toBe(403);
    const an = await json(await intern.POST!(new Request('http://test/api/kontaktformular/intern', { method: 'POST', headers: sitzung(), body: JSON.stringify({ aktiv: true }) })));
    expect(an).toMatchObject({ status: 200, d: { aktiv: true } });
    expect(await status()).toEqual({ status: 200, d: { ok: true, aktiv: true } });
    const lesen = await json(await intern.GET!(new Request('http://test/api/kontaktformular/intern', { headers: sitzung('malin') })));
    expect(lesen.d).toMatchObject({ aktiv: true, bereit: true, pfad: '/anfrage', istInhaber: false });
    const fremd = await json(await intern.GET!(new Request('http://test/api/kontaktformular/intern', { headers: sitzung('gast') })));
    expect(fremd.status).toBe(403);
  });
  it('Datenschutzhinweis nennt den Verantwortlichen und keine Werbe-Einwilligung', async () => {
    const b = await S.kontaktformularBereit();
    expect(b?.hinweis.zeilen[0]).toContain('Probe GmbH');
    expect(b?.hinweis.zeilen.join(' ')).toMatch(/Werbung schicken wir Ihnen damit nicht/);
  });
});

describe('Schutz: Honigtopf, Stempel, Größe, Drossel', () => {
  it('Honigtopf, gefälschter/zu frischer Stempel → derselbe Text (400); zu lang → 413; unförmig → 400; nichts angelegt', async () => {
    const a = await senden(gut({ webseite: 'http://spam.example.invalid' }));
    const b = await senden(gut({ stempel: 'kaputt.stempel' }));
    const c = await senden(gut({ stempel: S.kontaktformularStempel(uhr) }));
    expect([a.status, b.status, c.status]).toEqual([400, 400, 400]);
    expect(new Set([a.d.fehler, b.d.fehler, c.d.fehler]).size).toBe(1);
    expect((await senden(gut({ nachricht: 'x'.repeat(2600) }))).status).toBe(413);
    expect((await senden({}, 'x'.repeat(9000))).status).toBe(413);
    expect((await senden(gut({ email: 'keine-adresse' }))).status).toBe(400);
    expect((await senden(gut({ vorname: 'Zeile\nZwei' }))).status).toBe(400);
    expect((await kontakte()).some(k => k.email === `nora.neu@${D}`)).toBe(false);
  });
  it('Drossel je Netz: nach sechs Versuchen → 429', async () => {
    const codes: number[] = [];
    for (let i = 0; i < 8; i++) codes.push((await senden(gut({ webseite: 'falle' }))).status);
    expect(codes.slice(0, 6).every(c => c === 400)).toBe(true);
    expect(codes[codes.length - 1]).toBe(429);
  });
});

describe('Eingang über den Anfrage-Weg', () => {
  it('neue Person: Anfrage über Website, Follow-up, Ereignis mit Stufe webseite-formular', async () => {
    const r = await senden(gut());
    expect(r).toMatchObject({ status: 200, d: { ok: true } });
    const k = (await kontakte()).find(x => x.email === `nora.neu@${D}`)!;
    expect(k.aktivitaeten.some(a => (a.text ?? '').startsWith('Anfrage über Website: Kontaktformular'))).toBe(true);
    const crm = await (await import('@/lib/crm/speicher')).ladeCrm();
    expect((crm.followups ?? []).some(f => f.kontaktId === k.id && /Anfrage beantworten/.test(f.text))).toBe(true);
    const { ereignisseLaden } = await import('@/lib/ereignisse/server');
    expect((await ereignisseLaden(HAUS)).eintraege.some(e => e.art === 'neuer-lead' && e.bezug.kontaktId === k.id && e.stufe === 'webseite-formular')).toBe(true);
  });
  it('vorhandene Person: nur „Adresse unbestätigt“ — keine Einwilligung, kein Ereignis; dieselbe Antwort', async () => {
    const r = await senden(gut({ vorname: 'Berta', email: `berta.bestand@${D}` }));
    expect(r).toMatchObject({ status: 200, d: { ok: true } });
    const k = (await kontakte()).find(x => x.id === 'c-bekannt')!;
    expect(k.aktivitaeten.some(a => (a.text ?? '').startsWith('Anfrage (Adresse unbestätigt) über Website: Kontaktformular'))).toBe(true);
    expect(k.einwilligungen ?? []).toHaveLength(0);
    expect(k.stufe).toBe('gespraech');
    const { ereignisseLaden } = await import('@/lib/ereignisse/server');
    expect((await ereignisseLaden(HAUS)).eintraege.some(e => e.bezug.kontaktId === 'c-bekannt')).toBe(false);
  });
  it('eingeschränkte Person (Art. 18): dieselbe Antwort, nichts geschrieben', async () => {
    const vorher = JSON.stringify((await kontakte()).find(x => x.id === 'c-gesperrt'));
    const r = await senden(gut({ vorname: 'Gerd', email: `gerd.gesperrt@${D}` }));
    expect(r).toMatchObject({ status: 200, d: { ok: true } });
    expect(JSON.stringify((await kontakte()).find(x => x.id === 'c-gesperrt'))).toBe(vorher);
  });
});

describe('Middleware, Caddy, Köpfe, Register', () => {
  let middleware: typeof import('@/middleware').middleware;
  beforeAll(async () => { ({ middleware } = await import('@/middleware')); });
  const offen = (r: Response) => r.headers.get('x-middleware-next') === '1';
  const lauf = (pfad: string, init: { method?: string; headers?: Record<string, string> } = {}) => middleware(new NextRequest(`http://localhost:3001${pfad}`, init as never));
  it('nur /anfrage (GET/HEAD) und /api/anfrage (POST, GET an/aus) sind offen, ohne Köpfe einer Person', async () => {
    expect(offen(await lauf('/anfrage'))).toBe(true);
    expect(offen(await lauf('/anfrage', { method: 'HEAD' }))).toBe(true);
    const r = await lauf('/api/anfrage', { method: 'POST', headers: { origin: 'http://localhost:3001', host: 'localhost:3001', 'x-make-user': 'kevin' } });
    expect(offen(r)).toBe(true);
    expect(r.headers.get('x-middleware-request-x-make-user')).toBeNull();
    expect(offen(await lauf('/api/anfrage'))).toBe(true);
    for (const [p, m] of [['/api/kontaktformular/intern', 'GET'], ['/api/kontaktformular/intern', 'POST'], ['/anfrage', 'POST'], ['/anfrage/x', 'GET'], ['/anfragen', 'GET'], ['/api/anfrage/x', 'POST']] as const) {
      const x = await lauf(p, m === 'POST' ? { method: 'POST', headers: { origin: 'http://localhost:3001', host: 'localhost:3001' } } : {});
      expect(offen(x), `${m} ${p}`).toBe(false);
    }
  });
  it('Caddy: eigener Block mit genau /anfrage und /api/anfrage; next.config: strenge Köpfe', () => {
    const caddy = readFileSync('deploy/caddy/Caddyfile', 'utf8');
    const block = caddy.slice(caddy.search(/^fokusinnovation\.de \{/m));
    const pfade = /^\s*@kontaktformular path (.+)$/m.exec(block)?.[1].split(/\s+/) ?? [];
    expect(pfade.sort()).toEqual(['/anfrage', '/api/anfrage']);
    expect(block).toMatch(/handle @kontaktformular \{[\s\S]*?Referrer-Policy no-referrer[\s\S]*?reverse_proxy app:3000/);
    const cfg = readFileSync('next.config.mjs', 'utf8');
    expect(cfg).toContain("{ source: '/anfrage', headers: buchung }");
    expect(cfg).toContain("{ source: '/api/anfrage', headers: buchung }");
  });
  it('öffentliche Dateien nennen nie den Namen der Software', () => {
    for (const datei of ['app/anfrage/page.tsx', 'app/anfrage/not-found.tsx', 'components/kontaktformular/Kontaktformular.tsx', 'lib/kontaktformular/regeln.ts', 'components/oeffentlich/ZoeBegleiterin.tsx', 'lib/oeffentlich/zoe-begleiterin-texte.ts']) {
      const q = readFileSync(datei, 'utf8').replace(/^\s*\/\/.*$/gm, '');
      expect(q, datei).not.toMatch(/MAKE OS|make os|Life & Business OS/i);
    }
  });
  it('Verzeichnis (Art. 30) und Auskunft (Art. 15) kennen das Formular', async () => {
    const { verzeichnisVervollstaendigen } = await import('@/lib/crm/datenschutz');
    expect(verzeichnisVervollstaendigen([], '2026-11-03T10:00:00Z', { kontaktformular: true }).liste.some(v => v.id === 'vv-kontaktformular')).toBe(true);
    expect(verzeichnisVervollstaendigen([], '2026-11-03T10:00:00Z', {}).liste.some(v => v.id === 'vv-kontaktformular')).toBe(false);
    const { kontaktBereiche, verarbeitungenFuer } = await import('@/lib/datenschutz/art15');
    const b = kontaktBereiche({ person: { aktivitaeten: [{ text: 'Anfrage über Website: Kontaktformular — Hallo' }] } });
    expect(b).toContain('kontaktformular');
    expect(verarbeitungenFuer('kontakt', b)).toContain('vv-kontaktformular');
  });
});
