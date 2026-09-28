// Routen-Tests der Follow-up-Ebene (Feinschliff 3, 27.09.): virtuelle Einträge verschieben/auslassen, Deal-Regel, Event-Nachfassen.
// Eigener Datenordner, Dienstaufruf per Schlüssel — nie der echte Bestand.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { localDay, tagePlus } from '@/lib/zeit';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-fu-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-27-09';
delete process.env.MAKE_OS_DATENSCHLUESSEL;

const tag = (n: number) => tagePlus(localDay(), n);
// Berliner Tag wie der Server (29.09., Paket D-A #40) — vorher UTC-Tag: zwischen 0 und 2 Uhr rot.
const H = localDay();
const kopf = { 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': 'kevin' };
const req = (url: string, body?: unknown, method = 'POST') => new Request(`http://test${url}`, { method, headers: kopf, ...(body ? { body: JSON.stringify(body) } : {}) });

type Mod = { POST: (r: Request) => Promise<Response>; GET: (r: Request) => Promise<Response> };
let fu: Mod, ev: Mod, db: typeof import('@/lib/store/local-db'), speicher: typeof import('@/lib/crm/speicher');

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  // Regel 5 (28.09. abends): der Dienstweg braucht eine Person im Haushalt des Inhabers — erfundene Konten.
  await db.saveJson('konten', { konten: [
    { id: 'k1', speicher: 'kevin', email: 'k@test.invalid', name: 'Kevin Test', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'test-haus' },
    { id: 'k2', speicher: 'malin', email: 'm@test.invalid', name: 'Malin Test', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'test-haus' },
  ], einladungen: [] });
  speicher = await import('@/lib/crm/speicher');
  fu = (await import('@/app/api/crm/followup/route')) as unknown as Mod;
  ev = (await import('@/app/api/crm/events/route')) as unknown as Mod;
  const jetzt = new Date().toISOString();
  const person = (id: string, n: string) => ({ id, vorname: n, nachname: 'Test', stufe: 'gespraech', kreis: 'B', besitzer: 'kevin', aktivitaeten: [], geaendertAm: H });
  await db.saveJson('kontakte', { kontakte: [person('c-a', 'Anna'), person('c-b', 'Ben'), person('c-c', 'Cem')] });
  await db.saveJson('crm', {
    ...speicher.leererBestand(),
    events: [{ id: 'ev1', titel: 'Abend', datum: tag(-3), status: 'durchgefuehrt', zustaendig: 'kevin', angelegt: jetzt, geaendert: jetzt }],
    teilnahmen: [
      { id: 't1', eventId: 'ev1', kontaktId: 'c-a', status: 'da', geaendert: jetzt },
      { id: 't2', eventId: 'ev1', kontaktId: 'c-b', status: 'da', geaendert: jetzt },
      { id: 't3', eventId: 'ev1', kontaktId: 'c-c', status: 'da', geaendert: jetzt },
    ],
    chancen: [{ id: 'ch1', titel: 'Pilot', kontaktIds: ['c-a'], stufe: 'angebot', historie: [{ stufe: 'angebot', am: jetzt, von: 'kevin' }], wert: { betrag: 1000, basis: 'monat' }, art: 'retainer', gesellschaft: 'offen', besitzer: 'kevin', naechsterSchritt: { text: 'Angebot besprechen', datum: H }, angelegt: jetzt, geaendert: jetzt }],
    followups: [{ id: 'fu-c', bezug: { art: 'event', id: 'ev1' }, kontaktId: 'c-c', art: 'mail', text: 'Cem nachfassen', faellig: H, zustaendig: 'kevin', status: 'offen', quelle: 'event', angelegt: jetzt, geaendert: jetzt }],
  });
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

const liste = async () => ((await (await fu.GET(req('/api/crm/followup', undefined, 'GET'))).json()) as { liste: { id: string; quelle: string; kontaktId?: string }[] }).liste;

describe('Follow-up-Route — virtuelle Einträge wirken', () => {
  it('„+3 Tage“ auf ein Event-Nachfassen legt ein echtes Event-Follow-up an; der virtuelle Eintrag tritt zurück, der Gast gilt NICHT als nachgefasst', async () => {
    expect((await liste()).some(f => f.id === 'v:nachfassen:t1')).toBe(true);
    const r = await fu.POST(req('/api/crm/followup', { aktion: 'verschieben', id: 'v:nachfassen:t1', tage: 3 }));
    expect(r.status).toBe(200);
    const crm = await speicher.ladeCrm();
    const neu = crm.followups?.find(f => f.kontaktId === 'c-a' && f.bezug.art === 'event');
    expect(neu).toMatchObject({ bezug: { art: 'event', id: 'ev1' }, faellig: tag(3), quelle: 'event', status: 'offen' });
    expect(crm.teilnahmen.find(t => t.id === 't1')?.followUpAm).toBeUndefined();
    const l = await liste();
    expect(l.some(f => f.id === 'v:nachfassen:t1')).toBe(false);
    expect(l.some(f => f.id === neu!.id)).toBe(true);
  });
  it('„Auslassen“ eines Event-Nachfassens nimmt den Gast aus der Liste, setzt aber kein Nachfass-Datum (Kennzahl bleibt ehrlich)', async () => {
    const r = await fu.POST(req('/api/crm/followup', { aktion: 'absagen', id: 'v:nachfassen:t2' }));
    expect(r.status).toBe(200);
    const t = (await speicher.ladeCrm()).teilnahmen.find(x => x.id === 't2')!;
    expect(t.nachfassenVerzichtet).toBe(H);
    expect(t.followUpAm).toBeUndefined();
    expect((await liste()).some(f => f.id === 'v:nachfassen:t2')).toBe(false);
  });
  it('Deal-Regel: der nächste Schritt am Deal lässt sich weder ohne Nachfolger erledigen noch absagen', async () => {
    const ohne = await fu.POST(req('/api/crm/followup', { aktion: 'erledigen', id: 'v:dealschritt:ch1' }));
    expect(ohne.status).toBe(400);
    expect(((await ohne.json()) as { fehler: string }).fehler).toMatch(/nächster Schritt/);
    const ab = await fu.POST(req('/api/crm/followup', { aktion: 'absagen', id: 'v:dealschritt:ch1' }));
    expect(ab.status).toBe(400);
    expect((await speicher.ladeCrm()).chancen[0].naechsterSchritt).toMatchObject({ text: 'Angebot besprechen' });
    const mit = await fu.POST(req('/api/crm/followup', { aktion: 'erledigen', id: 'v:dealschritt:ch1', naechster: { text: 'Vertrag schicken', faellig: tag(2) } }));
    expect(mit.status).toBe(200);
    expect((await speicher.ladeCrm()).chancen[0].naechsterSchritt).toEqual({ text: 'Vertrag schicken', datum: tag(2) });
  });
  it('Nachfassen im Events-Reiter erledigt ein offenes Event-Follow-up desselben Gastes mit', async () => {
    const r = await ev.POST(req('/api/crm/events', { eventId: 'ev1', aktion: 'nachfassen', teilnahmeId: 't3', ergebnis: 'erledigt' }));
    expect(r.status).toBe(200);
    const crm = await speicher.ladeCrm();
    expect(crm.teilnahmen.find(t => t.id === 't3')?.followUpAm).toBe(H);
    expect(crm.followups?.find(f => f.id === 'fu-c')?.status).toBe('erledigt');
    expect((await liste()).some(f => f.kontaktId === 'c-c')).toBe(false);
  });
});

describe('Regel 5 (28.09. abends): Dienstweg ohne Person oder mit fremder Person → 403', () => {
  it('ohne Person und mit einer Person außerhalb des Haushalts des Inhabers wird nichts gelesen', async () => {
    const ohne = { 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY! };
    expect((await fu.GET(new Request('http://test/api/crm/followup', { headers: ohne }))).status).toBe(403);
    expect((await fu.GET(new Request('http://test/api/crm/followup', { headers: { ...ohne, 'x-make-person': 'fremd' } }))).status).toBe(403);
  });
});
