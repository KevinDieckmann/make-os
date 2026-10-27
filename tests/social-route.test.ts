// ─── Social — Route: Zugang, Trennung Privat/Business, Stand/409, Import mit Vorschau ─────────────────────────────────────────────────
// Eigener Datenordner, erfundene Personen (@example.invalid) — nie der echte Bestand. Geprüft wird:
//   · Haushalt des Inhabers (anderer Haushalt 403, ohne Person 403), Konto „nur Business“ darf (Social ist Business)
//   · Sicht Privat bekommt nichts: `?space=privat` → 400
//   · Schreiben nur per Sitzung (Dienstweg 403), Stand je Eintrag (409), Import: Vorschau schreibt nichts, Übernahme nur eindeutige Zeilen
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-social-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-social';
process.env.MAKE_OS_OHNE_APPLE = '1';

type Mod = { GET: (r: Request) => Promise<Response>; PATCH: (r: Request) => Promise<Response>; POST: (r: Request) => Promise<Response> };
let route: Mod;
const URL_ = 'http://test/api/social';
const get = (person?: string, q = '') => new Request(`${URL_}${q}`, { headers: person ? { 'x-make-user': person } : {} });
const sende = (methode: 'PATCH' | 'POST', person: string, body: unknown, extra: Record<string, string> = {}) => new Request(URL_, {
  method: methode, headers: { 'content-type': 'application/json', 'x-make-user': person, ...extra }, body: JSON.stringify(body),
});
type Lage = { ok: boolean; fehler?: string; datei: { kanaele: { id: string; stand: string; name: string }[]; folgen: { id: string; stand: string; titel: string; messungen: unknown[] }[] }; folgen: Record<string, { weg: { weg: string } }>; analyse: Record<string, { folgenMitZahlen: number }> };

beforeAll(async () => {
  const db = await import('@/lib/store/local-db');
  route = (await import('@/app/api/social/route')) as unknown as Mod;
  await db.saveJson('konten', { konten: [
    { id: '1', speicher: 'pa', email: 'pa@example.invalid', name: 'Anna Prüf', rolle: 'inhaber', hash: 'x', salz: 'x', angelegt: '2026-09-01', haushalt: 'h-pruef' },
    { id: '2', speicher: 'pb', email: 'pb@example.invalid', name: 'Bert Prüf', rolle: 'mitglied', hash: 'x', salz: 'x', angelegt: '2026-09-01', haushalt: 'h-pruef', finanzRecht: 'business' },
    { id: '3', speicher: 'px', email: 'px@example.invalid', name: 'Testkunde', rolle: 'mitglied', hash: 'x', salz: 'x', angelegt: '2026-09-01', haushalt: 'h-fremd' },
  ], einladungen: [] });
  await (await import('@/lib/zugang/konten')).ladeKonten();
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Social — wer darf', () => {
  it('ohne Person und aus einem anderen Haushalt: 403 — nie unsere Daten', async () => {
    expect((await route.GET(get())).status).toBe(403);
    const r = await route.GET(get('px'));
    expect(r.status).toBe(403);
    expect(JSON.stringify(await r.json())).not.toMatch(/kanaele/);
  });
  it('Sicht Privat bekommt nichts (400), Business-Konto darf lesen', async () => {
    expect((await route.GET(get('pa', '?space=privat'))).status).toBe(400);
    expect((await route.GET(get('pb'))).status).toBe(200);
  });
  it('Dienstweg schreibt nie (403) — auch nicht mit Person', async () => {
    const r = await route.PATCH(sende('PATCH', 'pa', { ops: [{ op: 'kanal', eintrag: { name: 'X' } }] }, { 'x-make-key': 'pruef-schluessel-social' }));
    expect(r.status).toBe(403);
    expect((await route.POST(sende('POST', 'pa', { aktion: 'import-vorschau' }, { 'x-make-key': 'pruef-schluessel-social' }))).status).toBe(403);
  });
});

describe('Social — schreiben und lernen', () => {
  let kanalId = '', folgeId = '';
  it('Kanal, Format und Folge anlegen; Lage enthält Prüfung und Leitplanken-Entscheidung', async () => {
    const r = await route.PATCH(sende('PATCH', 'pa', { ops: [{ op: 'kanal', eintrag: { name: 'Beispiel-KI', sprache: 'en', kiKanal: true, plattformen: ['tiktok'] } }] }));
    expect(r.status).toBe(200);
    const l = await r.json() as Lage;
    kanalId = l.datei.kanaele[0].id;
    const r2 = await route.PATCH(sende('PATCH', 'pa', { ops: [{ op: 'folge', eintrag: { kanalId, titel: 'Day 1', skript: 'Hi. I am an AI and this is day {{tag}}.', hooks: [{ text: 'Hi.' }], status: 'entwurf' } }] }));
    const l2 = await r2.json() as Lage;
    folgeId = l2.datei.folgen[0].id;
    expect(l2.folgen[folgeId].weg.weg).toBe('gesperrt'); // offener Platzhalter
  });
  it('veralteter Stand → 409 mit aktuellem Bestand, nichts geändert', async () => {
    const r = await route.PATCH(sende('PATCH', 'pa', { ops: [{ op: 'folge', eintrag: { id: folgeId, titel: 'Neu' }, stand: 'veraltet' }] }));
    expect(r.status).toBe(409);
    const l = await r.json() as Lage;
    expect(l.datei.folgen[0].titel).toBe('Day 1');
  });
  it('Import: Vorschau schreibt nichts, Übernahme hängt Messungen an', async () => {
    const csv = 'Video title,Total views,Total shares\nDay 1,1500,30\nGibt es nicht,10,0';
    const v = await route.POST(sende('POST', 'pa', { aktion: 'import-vorschau', kanalId, plattform: 'tiktok', text: csv }));
    const vj = await v.json() as { vorschau: { zeilen: { folgeId: string | null }[] } };
    expect(vj.vorschau.zeilen.map(z => z.folgeId)).toEqual([folgeId, null]);
    const nachher = await (await route.GET(get('pa'))).json() as Lage;
    expect(nachher.datei.folgen[0].messungen).toEqual([]);
    const ue = await route.POST(sende('POST', 'pa', { aktion: 'import', kanalId, plattform: 'tiktok', text: csv }));
    const uj = await ue.json() as Lage & { uebernommen: number; uebersprungen: number };
    expect(uj.uebernommen).toBe(1);
    expect(uj.uebersprungen).toBe(1);
    expect(uj.analyse[kanalId].folgenMitZahlen).toBe(1);
  });
  it('Import: Stand der Zahlen = gewählter Tag (nie Post time), Zukunft → 400', async () => {
    const csv = 'Video title,Post time,Total views\nDay 1,2026-01-02,2000';
    const { localDay } = await import('@/lib/zeit');
    const { tagPlus } = await import('@/lib/zeit/kalender-kern');
    const vor2 = tagPlus(localDay(), -2);
    const v = await route.POST(sende('POST', 'pa', { aktion: 'import-vorschau', kanalId, plattform: 'tiktok', text: csv, stand: vor2 }));
    const vj = await v.json() as { vorschau: { zeilen: { veroeffentlichtAm?: string; messung: { am: string } }[] } };
    expect(vj.vorschau.zeilen[0].messung.am).toBe(vor2);
    expect(vj.vorschau.zeilen[0].veroeffentlichtAm).toBe('2026-01-02');
    expect((await route.POST(sende('POST', 'pa', { aktion: 'import-vorschau', kanalId, plattform: 'tiktok', text: csv, stand: tagPlus(localDay(), 1) }))).status).toBe(400);
    expect((await route.POST(sende('POST', 'pa', { aktion: 'import-vorschau', kanalId, plattform: 'tiktok', text: csv, stand: tagPlus(localDay(), -400) }))).status).toBe(400);
    expect((await route.POST(sende('POST', 'pa', { aktion: 'import-vorschau', kanalId, plattform: 'tiktok', text: csv, stand: '2026-02-30' }))).status).toBe(400);
  });
  it('Import in einen unbekannten Kanal: 404; falsche Plattform: 400', async () => {
    expect((await route.POST(sende('POST', 'pa', { aktion: 'import', kanalId: 'sk-gibtsnicht', plattform: 'tiktok', text: 'a' }))).status).toBe(404);
    expect((await route.POST(sende('POST', 'pa', { aktion: 'import', kanalId, plattform: 'facebook', text: 'a' }))).status).toBe(400);
  });
});
