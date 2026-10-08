// ─── Wächter: Sicht im Agenten-Bereich — „Sicht X bekommt nichts aus Y“ (09.10., Paket 1 „Kern“; AGENTEN_KONZEPT.md C5) ─────────
// Rein (lib/agenten/sicht.ts) und über die Routen: zweite Person, Konto „nur Business“, fremder Haushalt, Testkunde, Dienstweg,
// Gesundheit ohne Einwilligung. Eigener Datenordner, erfundene Konten, kein Modell, kein Netz.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-agenten-sicht-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-agenten-sicht';
process.env.MAKE_OS_KI_VORGABE = 'kompatibel';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.ANTHROPIC_API_KEY;
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

import { KATALOG } from '@/lib/agenten/katalog';
import { fadenSichtbar, headSichtbar, headsFuer, kategorienFuer, teilenErlaubt, type KontoSicht } from '@/lib/agenten/sicht';
import { kontenSaeen, rufe, sitzung, dienst, HAUS } from './fixtures/agenten-kern';

const voll = (person: string, extra: Partial<KontoSicht> = {}): KontoSicht => ({ person, imHaushalt: true, vollesMitglied: true, privatFinanzen: true, gesundheit: { verarbeiten: false, ki: false }, ...extra });
const nurBusiness = (person: string): KontoSicht => ({ person, imHaushalt: true, vollesMitglied: false, privatFinanzen: false, gesundheit: { verarbeiten: false, ki: false } });
const fremd = (person: string): KontoSicht => ({ person, imHaushalt: false, vollesMitglied: false, privatFinanzen: false, gesundheit: { verarbeiten: true, ki: true } });
const BUSINESS = KATALOG.filter(h => h.bereich === 'business').map(h => h.id);
const PRIVAT = KATALOG.filter(h => h.bereich === 'privat').map(h => h.id);

describe('Filterstelle (rein)', () => {
  it('volles Mitglied: alle Business-Heads, Privat ohne Gesundheit (ohne Einwilligung)', () => {
    const ids = headsFuer(voll('person-a')).map(h => h.id);
    for (const b of BUSINESS) expect(ids).toContain(b);
    expect(ids).toEqual(expect.arrayContaining(['ernaehrung', 'familie', 'finanzen-privat', 'assistenz']));
    expect(ids).not.toContain('gesundheit');
  });
  it('Gesundheit nur mit (a) UND (b) — (a) allein oder (b) allein reicht nie', () => {
    expect(headSichtbar(voll('p', { gesundheit: { verarbeiten: true, ki: false } }), 'gesundheit')).toBe(false);
    expect(headSichtbar(voll('p', { gesundheit: { verarbeiten: false, ki: true } }), 'gesundheit')).toBe(false);
    expect(headSichtbar(voll('p', { gesundheit: { verarbeiten: true, ki: true } }), 'gesundheit')).toBe(true);
  });
  it('„nur Business“ sieht nur Business-Heads — kein Privat-Head, keine Familie, keine Finanzen privat', () => {
    const ids = headsFuer(nurBusiness('team-c')).map(h => h.id);
    expect(ids.sort()).toEqual([...BUSINESS].sort());
    for (const p of PRIVAT) expect(headSichtbar(nurBusiness('team-c'), p), p).toBe(false);
  });
  it('fremder Haushalt / Testkunde / ohne Konto: nichts', () => {
    expect(headsFuer(fremd('gast'))).toEqual([]);
    expect(headsFuer(null)).toEqual([]);
    expect(headSichtbar(fremd('gast'), 'sales')).toBe(false);
  });
  it('Finanzen privat nur mit privatem Finanzzugang', () => {
    expect(headSichtbar(voll('p', { privatFinanzen: false }), 'finanzen-privat')).toBe(false);
  });
  it('Kategorien: Business nie Gesundheit; Ernährung bekommt Gesundheit nur mit (a)+(b)', () => {
    for (const h of KATALOG.filter(x => x.bereich === 'business')) expect(kategorienFuer({ ...h, kategorienMitEinwilligung: ['gesundheit'] }, voll('p', { gesundheit: { verarbeiten: true, ki: true } }))).not.toContain('gesundheit');
    const ern = KATALOG.find(h => h.id === 'ernaehrung')!;
    expect(kategorienFuer(ern, voll('p'))).not.toContain('gesundheit');
    expect(kategorienFuer(ern, voll('p', { gesundheit: { verarbeiten: true, ki: true } }))).toContain('gesundheit');
  });
  it('Threads: Besitzer sieht; andere nur geteilte BUSINESS-Threads, die sie sehen dürfen; Privat nie geteilt', () => {
    const business = { besitzer: 'person-a', agent: { art: 'head' as const, headId: 'sales' }, bereich: 'business' as const };
    const privat = { besitzer: 'person-a', agent: { art: 'head' as const, headId: 'assistenz' }, bereich: 'privat' as const };
    expect(fadenSichtbar(business, voll('person-a'))).toBe(true);
    expect(fadenSichtbar(business, voll('person-b'))).toBe(false);
    expect(fadenSichtbar({ ...business, geteilt: { am: 'x', von: 'person-a' } }, voll('person-b'))).toBe(true);
    expect(fadenSichtbar({ ...business, geteilt: { am: 'x', von: 'person-a' } }, nurBusiness('team-c'))).toBe(true);
    expect(fadenSichtbar({ ...business, geteilt: { am: 'x', von: 'person-a' } }, fremd('gast'))).toBe(false);
    expect(fadenSichtbar({ ...privat, geteilt: { am: 'x', von: 'person-a' } }, voll('person-b'))).toBe(false);
    expect(teilenErlaubt(privat, 'person-a')).toBe(false);
    expect(teilenErlaubt(business, 'person-b')).toBe(false);
    expect(teilenErlaubt(business, 'person-a')).toBe(true);
  });
});

describe('Sicht über die Routen', () => {
  type H = (r: Request) => Promise<Response>;
  let agenten: { GET: H };
  let faden: { GET: H; POST: H };
  const GEHEIM_PRIVAT = 'SICHT-GEHEIM-PRIVAT-A';
  const GEHEIM_BUSINESS = 'SICHT-GEHEIM-BUSINESS-A';
  const GEHEIM_GESUNDHEIT = 'SICHT-GEHEIM-GESUNDHEIT-A';

  beforeAll(async () => {
    await kontenSaeen();
    const db = await import('@/lib/store/local-db');
    const { fadenBestand } = await import('@/lib/agenten/typen');
    const jetzt = new Date().toISOString();
    const f = (id: string, headId: string, bereich: 'business' | 'privat', titel: string, extra: Record<string, unknown> = {}) => ({ id, besitzer: 'person-a', agent: { art: 'head', headId }, bereich, titel, status: 'offen', fremdGelesen: false, vertraulich: false, erstellt: jetzt, aktualisiert: jetzt, nachrichten: [{ id: `nr-${id}`, rolle: 'person', von: 'person-a', text: titel, zeit: jetzt }], ...extra });
    await db.saveJson(fadenBestand('person-a'), { v: 1, faeden: [
      f('fd-00000000-0000-4000-8000-0000000000a1', 'assistenz', 'privat', GEHEIM_PRIVAT),
      f('fd-00000000-0000-4000-8000-0000000000a2', 'sales', 'business', GEHEIM_BUSINESS),
      f('fd-00000000-0000-4000-8000-0000000000a3', 'gesundheit', 'privat', GEHEIM_GESUNDHEIT),
    ], gedaechtnis: { 'head:assistenz': [{ id: 'ms-00000000-0000-4000-8000-000000000001', text: GEHEIM_PRIVAT, am: jetzt, von: 'head:assistenz', quelle: 'vorschlag' }] } });
    agenten = (await import('@/app/api/agenten/route')) as unknown as typeof agenten;
    faden = (await import('@/app/api/agenten/faden/route')) as unknown as typeof faden;
  });

  const alles = async (person: string) => {
    const t: string[] = [];
    for (const p of ['/api/agenten', '/api/agenten/faden', '/api/agenten/faden?agent=head:sales', '/api/agenten/faden?id=fd-00000000-0000-4000-8000-0000000000a1', '/api/agenten/faden?id=fd-00000000-0000-4000-8000-0000000000a2', '/api/agenten/faden?gedaechtnis=head:assistenz', '/api/agenten/faden?fuer=person-a&person=person-a']) {
      const h = p.startsWith('/api/agenten/faden') ? faden.GET : agenten.GET;
      t.push(JSON.stringify((await rufe(h, p, sitzung(person))).d));
    }
    return t.join('\n');
  };

  it('zweite Person: kein Thread, kein Merksatz, kein Titel der ersten', async () => {
    const t = await alles('person-b');
    for (const m of [GEHEIM_PRIVAT, GEHEIM_BUSINESS, GEHEIM_GESUNDHEIT]) expect(t).not.toContain(m);
  });
  it('Konto „nur Business“: keine Privat-Heads in der Liste, Privat-Thread-Abruf 404', async () => {
    const r = await rufe(agenten.GET, '/api/agenten', sitzung('team-c'));
    expect(r.status).toBe(200);
    const ids = (r.d.heads as { id: string }[]).map(h => h.id);
    for (const p of PRIVAT) expect(ids).not.toContain(p);
    expect(ids).toContain('sales');
    expect((await rufe(faden.GET, '/api/agenten/faden?id=fd-00000000-0000-4000-8000-0000000000a1', sitzung('team-c'))).status).toBe(404);
    const s = await rufe(faden.POST, '/api/agenten/faden', sitzung('team-c'), { aktion: 'senden', agent: { art: 'head', headId: 'assistenz' }, text: 'Hallo' });
    expect(s.status).toBe(403);
  });
  it('Gesundheit ohne Einwilligung: der Besitzer sieht weder Head noch Thread; senden → 403', async () => {
    const r = await rufe(agenten.GET, '/api/agenten', sitzung('person-a'));
    expect((r.d.heads as { id: string }[]).map(h => h.id)).not.toContain('gesundheit');
    expect(JSON.stringify(r.d)).not.toContain(GEHEIM_GESUNDHEIT);
    expect((await rufe(faden.GET, '/api/agenten/faden?id=fd-00000000-0000-4000-8000-0000000000a3', sitzung('person-a'))).status).toBe(404);
    expect((await rufe(faden.POST, '/api/agenten/faden', sitzung('person-a'), { aktion: 'senden', agent: { art: 'head', headId: 'gesundheit' }, text: 'Wie war mein Schlaf?' })).status).toBe(403);
  });
  it('Gegenprobe: der Besitzer sieht seine Threads und Merksätze', async () => {
    const t = await alles('person-a');
    expect(t).toContain(GEHEIM_PRIVAT);
    expect(t).toContain(GEHEIM_BUSINESS);
  });
  it('fremder Haushalt, Testkunde, Dienstweg (mit und ohne Person): 403 auf jedem Weg', async () => {
    for (const kopf of [sitzung('gast'), sitzung('kunde'), dienst('person-a'), dienst()]) {
      expect((await rufe(agenten.GET, '/api/agenten', kopf)).status).toBe(403);
      expect((await rufe(faden.GET, '/api/agenten/faden', kopf)).status).toBe(403);
      expect((await rufe(faden.POST, '/api/agenten/faden', kopf, { aktion: 'senden', agent: { art: 'head', headId: 'sales' }, text: 'x' })).status).toBe(403);
    }
  });
  it('geteilter Business-Thread: die zweite Person liest ihn — schreiben darf sie nicht', async () => {
    const id = 'fd-00000000-0000-4000-8000-0000000000a2';
    const vorher = await rufe(faden.GET, `/api/agenten/faden?id=${id}`, sitzung('person-a'));
    const t = await rufe(faden.POST, '/api/agenten/faden', sitzung('person-a'), { aktion: 'teilen', fadenId: id, geteilt: true, stand: vorher.d.stand });
    expect(t.status).toBe(200);
    const b = await rufe(faden.GET, `/api/agenten/faden?id=${id}`, sitzung('person-b'));
    expect(b.status).toBe(200);
    expect(JSON.stringify(b.d)).toContain(GEHEIM_BUSINESS);
    expect((await rufe(faden.GET, `/api/agenten/faden?id=${id}`, sitzung('gast'))).status).toBe(403);
    // Schreiben (Nachricht, Umbenennen, Löschen) nur der Besitzer.
    expect((await rufe(faden.POST, '/api/agenten/faden', sitzung('person-b'), { aktion: 'umbenennen', fadenId: id, titel: 'Fremd', stand: b.d.stand })).status).toBe(404);
    expect((await rufe(faden.POST, '/api/agenten/faden', sitzung('person-b'), { aktion: 'senden', agent: { art: 'head', headId: 'sales' }, fadenId: id, text: 'x' })).status).toBe(404);
    // Privat bleibt privat, auch wenn jemand „teilen“ versucht.
    const p = await rufe(faden.GET, '/api/agenten/faden?id=fd-00000000-0000-4000-8000-0000000000a1', sitzung('person-a'));
    expect((await rufe(faden.POST, '/api/agenten/faden', sitzung('person-a'), { aktion: 'teilen', fadenId: 'fd-00000000-0000-4000-8000-0000000000a1', geteilt: true, stand: p.d.stand })).status).toBe(403);
    expect(HAUS).toBe('haus-a');
  });
});
