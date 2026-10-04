// ─── Inbox-Status: Zugang je Haushalt und je Postfach (DSGVO-Prüfung 04.10.) ─
// Vorher las und schrieb jede angemeldete Person die ganze Karte `inbox-status` (auch ein Testkunde aus einem anderen
// Haushalt), ein PUT überschrieb die Triage aller. Jetzt: Haushalt des Inhabers (sonst 403), eigene Gmail-Nachrichten,
// Apple-Mail/M365 nur der Inhaber; fremde Einträge nie in der Antwort und beim Schreiben unberührt.
// Eigener Datenordner, erfundene Personen (@example.invalid).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { inboxStatusFuer, inboxStatusErsetzen, gmailSchluessel } from '@/lib/inbox/status-sicht';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-inbox-status-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-inbox';
delete process.env.MAKE_OS_DATENSCHLUESSEL;

type Mod = { GET: (r: Request) => Promise<Response>; PUT: (r: Request) => Promise<Response>; PATCH: (r: Request) => Promise<Response> };
let route: Mod; let db: typeof import('@/lib/store/local-db');

const anfrage = (methode: string, person?: string, body?: unknown) => new Request('http://test/api/state/inbox', {
  method: methode, headers: { 'content-type': 'application/json', ...(person ? { 'x-make-user': person } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}),
});
const AT = '2026-10-01T10:00:00Z';
const START = {
  'apple-mail-1': { status: 'erledigt', at: AT },
  'gmail-th-a': { status: 'snoozed', at: AT, bis: '2026-10-09' },
  'gmail-th-b': { status: 'erledigt', at: AT },
};

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  route = (await import('@/app/api/state/inbox/route')) as unknown as Mod;
  const k = (id: string, speicher: string, rolle: string, haushalt: string) => ({ id, speicher, email: `${speicher}@example.invalid`, name: speicher, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt });
  await db.saveJson('konten', { konten: [k('1', 'pa', 'inhaber', 'h-pruef'), k('2', 'pb', 'mitglied', 'h-pruef'), k('3', 'px', 'mitglied', 'h-fremd')], einladungen: [] });
  const kopf = (id: string, threadId: string) => ({ id, threadId, am: AT, von: { email: 'x@example.invalid' }, an: [], cc: [], betreff: 'Erfunden', labels: ['INBOX'] });
  await db.saveJson('gmail-stand--pa', { v: 1, person: 'pa', email: 'pa@example.invalid', koepfe: { ma: kopf('ma', 'th-a') } });
  await db.saveJson('gmail-stand--pb', { v: 1, person: 'pb', email: 'pb@example.invalid', koepfe: { mb: kopf('mb', 'th-b') } });
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Inbox-Status — rein', () => {
  it('Gmail nach eigenem Spiegel, Apple/M365 nur Inhaber; Ersetzen lässt Fremdes stehen', () => {
    const e = { inhaber: false, gmail: gmailSchluessel({ mb: { id: 'mb', threadId: 'th-b' } }) };
    expect(Object.keys(inboxStatusFuer(START, e))).toEqual(['gmail-th-b']);
    const neu = inboxStatusErsetzen(START, { 'gmail-th-b': { status: 'aufgabe', at: AT }, 'gmail-th-a': { status: 'offen', at: AT }, 'apple-mail-1': { status: 'offen', at: AT } }, e);
    expect(neu).toEqual({ 'apple-mail-1': START['apple-mail-1'], 'gmail-th-a': START['gmail-th-a'], 'gmail-th-b': { status: 'aufgabe', at: AT } });
  });
});

describe('Inbox-Status — Route', () => {
  it('ohne Person und aus einem anderen Haushalt (Testkunde): 403 — lesen und schreiben', async () => {
    await db.saveJson('inbox-status', START);
    expect((await route.GET(anfrage('GET'))).status).toBe(403);
    const r = await route.GET(anfrage('GET', 'px'));
    expect(r.status).toBe(403);
    expect(JSON.stringify(await r.json())).not.toContain('apple-mail-1');
    expect((await route.PUT(anfrage('PUT', 'px', {}))).status).toBe(403);
    expect((await route.PATCH(anfrage('PATCH', 'px', { ops: [{ id: 'apple-mail-1', status: null }] }))).status).toBe(403);
    expect(await db.loadJson('inbox-status')).toEqual(START);
  });
  it('Sicht X bekommt nichts aus Y: der Inhaber sieht Apple + eigenes Gmail, das Mitglied nur sein Gmail', async () => {
    await db.saveJson('inbox-status', START);
    const a = await (await route.GET(anfrage('GET', 'pa'))).json();
    expect(Object.keys(a.status).sort()).toEqual(['apple-mail-1', 'gmail-th-a']);
    const b = await (await route.GET(anfrage('GET', 'pb'))).json();
    expect(Object.keys(b.status)).toEqual(['gmail-th-b']);
  });
  it('Schreiben auf fremde Postfächer wirkt nie — PATCH überspringt, PUT ersetzt nur den eigenen Teil', async () => {
    await db.saveJson('inbox-status', START);
    const p = await route.PATCH(anfrage('PATCH', 'pb', { ops: [{ id: 'gmail-th-a', status: null }, { id: 'apple-mail-1', status: 'offen' }] }));
    expect(p.status).toBe(400); // keine gültige (eigene) Änderung
    expect(await db.loadJson('inbox-status')).toEqual(START);
    const ok = await route.PATCH(anfrage('PATCH', 'pb', { ops: [{ id: 'gmail-th-b', status: 'aufgabe' }] }));
    expect((await ok.json()).anzahl).toBe(1);
    expect((await route.PUT(anfrage('PUT', 'pb', {}))).status).toBe(200); // eigener Teil leer
    const nach = await db.loadJson<Record<string, unknown>>('inbox-status');
    expect(nach).toEqual({ 'apple-mail-1': START['apple-mail-1'], 'gmail-th-a': START['gmail-th-a'] });
  });
});
