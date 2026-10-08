// ─── Business-frei durchsetzen (08.10., Lücke 7) — Server, Rechte, Glocke, ZOE ────────────────────────────────────────
// Wächter „Sicht X bekommt nichts aus Y“: /api/arbeitsrahmen liefert NUR die eigene Person; über andere nur ja/nein (volle
// Mitglieder zusätzlich „bis“, Konten mit finanzRecht „business“ nie Zeiten); eigene Ergänzung mit Stand/409, Grenzen 400/413;
// Dienstweg, fremder Haushalt, Konto ohne Haushalt → 403. Die Familie gilt nur für volle Mitglieder. Glocke: eine Meldung in der
// freien Zeit trägt `freiBis` und ruht, danach kommt sie gesammelt. ZOE im Hintergrund legt in der freien Zeit keine
// Business-Vorschläge an. Temp-Ordner, erfundene Konten (@example.invalid), keine echten Daten.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-business-frei-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-business-frei';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.ANTHROPIC_API_KEY;
afterAll(() => rmSync(ordner, { recursive: true, force: true }));

type H = (r: Request) => Promise<Response>;
let route: { GET: H; PUT: H };
let db: typeof import('@/lib/store/local-db');

const sitzung = (p: string) => ({ 'content-type': 'application/json', 'x-make-user': p });
const dienst = (p?: string) => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, ...(p ? { 'x-make-person': p } : {}) });
const get = async (kopf: Record<string, string>, suche = '') => { const r = await route.GET(new Request(`http://test/api/arbeitsrahmen${suche}`, { headers: kopf })); return { status: r.status, text: await r.text() }; };
const put = async (kopf: Record<string, string>, body: unknown) => { const r = await route.PUT(new Request('http://test/api/arbeitsrahmen', { method: 'PUT', headers: kopf, body: JSON.stringify(body) })); return { status: r.status, j: (await r.json()) as Record<string, unknown> }; };

// Die Familie des Haushalts ist IMMER Business-frei (jeden Tag 24 h) — so ist „jetzt“ in jedem Testlauf frei.
const IMMER = [{ tage: [0, 1, 2, 3, 4, 5, 6], von: '00:00', bis: '00:00' }];
// Eine eindeutige Zeit, die nur in der eigenen Ergänzung von person-b steht.
const EIGENE_B = [{ tage: [2], von: '05:17', bis: '06:43' }];

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  const k = (id: string, speicher: string, rolle: string, extra: Record<string, unknown> = {}) =>
    ({ id, speicher, email: `${speicher}@example.invalid`, name: speicher, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...extra });
  await db.saveJson('konten', { konten: [
    k('k1', 'person-a', 'inhaber', { haushalt: 'haus-bf' }),
    k('k2', 'person-b', 'mitglied', { haushalt: 'haus-bf' }),
    k('k3', 'partner', 'mitglied', { haushalt: 'haus-bf', finanzRecht: 'business' }),
    k('k4', 'fremd', 'mitglied', { haushalt: 'haus-x' }),
    k('k5', 'kunde', 'mitglied'),
  ], einladungen: [] });
  await db.saveJson('familie--haus-bf', { einstellungen: { gespraech: { wochentag: 0, uhrzeit: '19:00', dauerMin: 45 }, businessFrei: IMMER, kinder: false, ausnahmeBis: null } });
  route = (await import('@/app/api/arbeitsrahmen/route')) as unknown as typeof route;
  // Die schweren Module einmal vorab laden (Glocke, ZOE) — sonst läuft der erste Test unter Last in die Zeitgrenze.
  await import('@/lib/meldungen/speicher');
  await import('@/lib/zoe/ausfuehren');
}, 180_000);

describe('Route /api/arbeitsrahmen — nur die eigene Person', () => {
  it('volles Mitglied: jetzt Business-frei (Familie), Fenster im Zeitraum, über andere ja/nein mit „bis“', async () => {
    const r = await get(sitzung('person-a'));
    expect(r.status).toBe(200);
    const d = JSON.parse(r.text) as { jetzt: { frei: boolean; bisText?: string }; fenster: unknown[]; familie: { gilt: boolean }; andere: { person: string; frei: boolean; bis?: string }[] };
    expect(d.jetzt.frei).toBe(true);
    expect(d.jetzt.bisText).toMatch(/^bis /);
    expect(d.familie.gilt).toBe(true);
    expect(d.fenster.length).toBeGreaterThan(0);
    const b = d.andere.find(a => a.person === 'person-b')!;
    expect(b).toMatchObject({ frei: true });
    expect(b.bis).toBeTruthy();
    // Das Konto „nur Business“ gehört nicht zur Familie: für es gelten die gemeinsamen Zeiten nicht.
    expect(d.andere.find(a => a.person === 'partner')).toMatchObject({ frei: false });
    // Ein anderer Haushalt und ein Konto ohne Haushalt stehen gar nicht in der Antwort.
    expect(d.andere.map(a => a.person).sort()).toEqual(['partner', 'person-b']);
  }, 120_000);

  it('Konto mit finanzRecht „business“: Familie gilt nicht, über andere NUR ja/nein (keine Zeiten)', async () => {
    const r = await get(sitzung('partner'));
    expect(r.status).toBe(200);
    const d = JSON.parse(r.text) as { jetzt: { frei: boolean }; fenster: unknown[]; familie: { gilt: boolean }; andere: Record<string, unknown>[] };
    expect(d.familie.gilt).toBe(false);
    expect(d.jetzt.frei).toBe(false);
    expect(d.fenster).toEqual([]);
    expect(d.andere.length).toBe(2);
    for (const a of d.andere) { expect(Object.keys(a).sort()).toEqual(['frei', 'name', 'person']); expect(a.frei).toBe(true); }
  }, 120_000);

  it('Dienstweg (mit und ohne Person), fremder Haushalt, Konto ohne Haushalt → 403; keine Personen-Parameter', async () => {
    expect((await get(dienst())).status).toBe(403);
    expect((await get(dienst('person-a'))).status).toBe(403);
    expect((await get(sitzung('fremd'))).status).toBe(403);
    expect((await get(sitzung('kunde'))).status).toBe(403);
    expect((await put(dienst('person-a'), { fenster: [] })).status).toBe(403);
    // ?fuer/person werden nicht gelesen: person-a bekommt mit ?fuer=person-b nur die eigene Ergänzung.
    await put(sitzung('person-b'), { fenster: EIGENE_B, stand: '[]' });
    const r = await get(sitzung('person-a'), '?fuer=person-b&person=person-b&wer=person-b');
    expect(r.text).not.toContain('05:17');
  }, 120_000);

  it('eigene Ergänzung: speichern mit Stand, alter Stand → 409, ungültig → 400, zu viele → 413 — und keine andere Sicht sieht sie', async () => {
    const vorher = JSON.parse((await get(sitzung('person-b'))).text) as { eigene: { fenster: unknown[]; stand: string } };
    expect(vorher.eigene.fenster).toEqual(EIGENE_B);
    const neu = [...EIGENE_B, { tage: [6], von: '14:00', bis: '18:00' }];
    const ok = await put(sitzung('person-b'), { fenster: neu, stand: vorher.eigene.stand });
    expect(ok.status).toBe(200);
    expect(await db.loadJson('arbeitsrahmen--person-b')).toMatchObject({ businessFrei: neu });
    expect((await put(sitzung('person-b'), { fenster: [], stand: vorher.eigene.stand })).status).toBe(409);
    expect((await put(sitzung('person-b'), { fenster: [{ tage: [9], von: 'x', bis: '06:00' }] })).status).toBe(400);
    expect((await put(sitzung('person-b'), { fenster: Array.from({ length: 11 }, () => EIGENE_B[0]) })).status).toBe(413);
    // Sicht X bekommt nichts aus Y: weder person-a noch das Business-Konto sieht die Zeiten von person-b.
    for (const p of ['person-a', 'partner']) expect((await get(sitzung(p))).text).not.toContain('05:17');
    // Die eigene Ergänzung wirkt: person-b ist (auch) dienstags 05:17 frei — hier über die Fenster des Zeitraums.
    const { businessFreiFensterFuer } = await import('@/lib/arbeitsrahmen/server');
    const partnerFenster = await businessFreiFensterFuer('partner', '2026-10-13', '2026-10-14');
    expect(partnerFenster).toEqual([]);
  }, 120_000);

  it('die Ergänzung eines Business-Kontos gilt nur für dieses Konto', async () => {
    await put(sitzung('partner'), { fenster: [{ tage: [0, 1, 2, 3, 4, 5, 6], von: '00:00', bis: '00:00' }], stand: '[]' });
    const d = JSON.parse((await get(sitzung('partner'))).text) as { jetzt: { frei: boolean } };
    expect(d.jetzt.frei).toBe(true);
    const a = JSON.parse((await get(sitzung('person-a'))).text) as { andere: { person: string; frei: boolean; bis?: string }[] };
    expect(a.andere.find(x => x.person === 'partner')).toMatchObject({ frei: true });
  }, 120_000);
});

describe('Ausnahmezeit der Familie pausiert den Schutz NICHT', () => {
  it('mit `ausnahmeBis` in der Zukunft bleibt die Person Business-frei', async () => {
    await db.updateJson<{ einstellungen: Record<string, unknown> }>('familie--haus-bf', cur => ({ ...cur!, einstellungen: { ...cur!.einstellungen, ausnahmeBis: '2099-01-01' } }));
    const d = JSON.parse((await get(sitzung('person-a'))).text) as { jetzt: { frei: boolean } };
    expect(d.jetzt.frei).toBe(true);
  }, 120_000);
});

describe('Glocke: in der freien Zeit gesammelt, danach EINE Meldung', () => {
  it('Business ruht bis zum Ende des Fensters; Sicherheit kommt sofort; danach „n Business-Hinweise aus der freien Zeit“', async () => {
    const { meldungAblegen, meldungenSicht, meldungenGelesen } = await import('@/lib/meldungen/speicher');
    const jetzt = new Date('2026-10-12T18:00:00.000Z');
    await meldungAblegen({ an: 'person-b', art: 'netzwerken', titel: 'Neue Person zugeteilt (Test)', link: '/os/netzwerken', von: 'person-a', bezug: { art: 'netzwerken', id: 'nw-bf-1' } }, jetzt);
    await meldungAblegen({ an: 'person-b', art: 'sicherheit', titel: 'Zugang geändert (Test)', link: '/os/konto' }, jetzt);
    const bestand = await db.loadJson<{ eintraege: { art: string; freiBis?: string }[] }>('meldungen--person-b');
    const nw = bestand!.eintraege.find(e => e.art === 'netzwerken')!;
    expect(nw.freiBis).toBeTruthy();
    const im = await meldungenSicht('person-b', jetzt);
    expect(im.meldungen.map(m => m.art)).toEqual(['sicherheit']);
    // „Alle gelesen“ in der freien Zeit fasst Ruhendes nicht an.
    await meldungenGelesen('person-b', { alle: true }, jetzt);
    const danach = await meldungenSicht('person-b', new Date(Date.parse(nw.freiBis!) + 3_600_000));
    const s = danach.meldungen.find(m => m.art === 'businessfrei')!;
    expect(s.titel).toBe('1 Business-Hinweis aus der freien Zeit');
    expect(s.enthalten!.map(e => e.titel)).toEqual(['Neue Person zugeteilt (Test)']);
    expect(danach.ungelesen).toBe(1);
    // Gelesen über die Sammelmeldung → die Meldung darin ist gelesen; gelöscht wird nichts.
    const g = await meldungenGelesen('person-b', { ids: [s.id] }, new Date(Date.parse(nw.freiBis!) + 3_600_000));
    expect(g.ungelesen).toBe(0);
    expect((await db.loadJson<{ eintraege: unknown[] }>('meldungen--person-b'))!.eintraege).toHaveLength(2);
  }, 120_000);
});

describe('ZOE im Hintergrund: keine Business-Vorschläge in der freien Zeit', () => {
  it('ein Lauf (quelle „lauf“) legt nichts Business-mäßiges in den Stapel; das Gespräch und Privates bleiben frei', async () => {
    const { fuehreAus } = await import('@/lib/zoe/ausfuehren');
    const r = await fuehreAus('setze_kontostand', { betrag: 1234, firma: 'kdv' }, 'http://test', { person: 'person-b', quelle: 'lauf' });
    expect(r.gestapelt).toBe(false);
    expect(r.text).toMatch(/^ZURÜCKGEHALTEN/);
    expect(((await db.loadJson<{ vorschlaege?: unknown[] }>('zoe-stapel'))?.vorschlaege ?? [])).toHaveLength(0);
    // Dasselbe aus dem Gespräch: wird (wie immer) nur vorgeschlagen.
    const g = await fuehreAus('setze_kontostand', { betrag: 1234, firma: 'kdv' }, 'http://test', { person: 'person-b', quelle: 'gespraech' });
    expect(g.gestapelt).toBe(true);
  }, 120_000);
});
