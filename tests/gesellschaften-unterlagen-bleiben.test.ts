// ─── DSGVO-Nachtrag 04.10.: Unterlagen beim endgültigen Löschen einer Gesellschaft bzw. eines Vertrags ─────────────
// Kevin (UMBAU_ABEND_0410.md › 12): behalten (§ 257 HGB) + deutlicher Hinweis mit Link in der Rückfrage; danach bleibt der Bezug
// als „(gelöscht)“ lesbar statt eines toten Links. Eigener Datenordner, erfundene Konten (@example.invalid) — nie der echte Bestand.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { rmSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { geloeschtVermerken, geloeschterBezug, geloeschtText, registerAufraeumen, unterlagenFiltern, MAX_VERMERKE, type RegisterDatei, type Vertrag } from '@/lib/gesellschaften/modell';
import { WEG } from '@/lib/wege';

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-unterlagen-bleiben-'));
  process.env.MAKE_OS_DATEN_DIR = o;
  process.env.MAKE_OS_KEY = 'pruef-schluessel-unterlagen';
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  return o;
});
vi.mock('@/lib/meldungen/melden', () => ({ melde: async () => {} }));
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

const G1 = 'g-11111111-1111-4111-8111-111111111111';
const G2 = 'g-22222222-2222-4222-8222-222222222222';
const VA = 'vt-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const VB = 'vt-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const J = '2026-10-04T10:00:00.000Z';
const vertrag = (id: string, titel: string, dateiIds: string[], x: Partial<Vertrag> = {}): Vertrag => ({ id, art: 'sonstiger', titel, parteien: [], status: 'unterschrieben', dateiIds, ...x } as Vertrag);
const datei = (id: string, gesellschaft: string, tag: string) => ({ id, art: 'vertrag', titel: `Unterlage ${id}`, gesellschaft, hochgeladenAm: `${tag}T08:00:00.000Z`, hochgeladenVon: 'person-a' });

describe('rein: Vermerke über endgültig Gelöschtes', () => {
  const basis: RegisterDatei = { gesellschaften: [{ id: G1, name: 'Erfundene Beispiel GmbH', vertraege: [vertrag(VA, 'Mietvertrag Büro', ['d-1']), vertrag(VB, 'Darlehen', ['d-2'])] }] };

  it('Vertrag verschwindet → Vermerk mit Titel und Datei-Kennungen; nichts verschwunden → derselbe Stand', () => {
    expect(geloeschtVermerken(basis, basis, J)).toBe(basis);
    const nach = geloeschtVermerken(basis, { gesellschaften: [{ ...basis.gesellschaften[0], vertraege: [basis.gesellschaften[0].vertraege![1]] }] }, J);
    expect(nach.geloescht).toEqual([{ art: 'vertrag', id: VA, gesellschaftId: G1, titel: 'Mietvertrag Büro', am: J, dateiIds: ['d-1'] }]);
    expect(geloeschtText(geloeschterBezug(nach, 'vertrag', VA)!)).toBe('„Mietvertrag Büro“ (gelöscht)');
  });

  it('Gesellschaft verschwindet → Vermerk für sie und ihre Verträge; feste Gesellschaften nie; gleiche Kennung ersetzt', () => {
    const nach = geloeschtVermerken({ gesellschaften: [...basis.gesellschaften, { id: 'kdv' }] }, { gesellschaften: [] }, J);
    expect(nach.geloescht?.map(b => `${b.art}:${b.id}`)).toEqual([`gesellschaft:${G1}`, `vertrag:${VA}`, `vertrag:${VB}`]);
    expect(geloeschterBezug(nach, 'gesellschaft', G1)?.titel).toBe('Erfundene Beispiel GmbH');
    const zweimal = geloeschtVermerken(basis, { gesellschaften: [], geloescht: nach.geloescht }, '2026-10-05T10:00:00.000Z');
    expect(zweimal.geloescht).toHaveLength(3);
    expect(zweimal.geloescht?.every(b => b.am === '2026-10-05T10:00:00.000Z')).toBe(true);
  });

  it('höchstens MAX_VERMERKE — die ältesten fallen zuerst', () => {
    const alt = Array.from({ length: MAX_VERMERKE }, (_, i) => ({ art: 'vertrag' as const, id: `vt-alt-${i}`, gesellschaftId: G1 as `g-${string}`, titel: 'Alt', am: J }));
    const nach = geloeschtVermerken(basis, { gesellschaften: [{ ...basis.gesellschaften[0], vertraege: [] }], geloescht: alt }, J);
    expect(nach.geloescht).toHaveLength(MAX_VERMERKE);
    expect(nach.geloescht?.[0].id).toBe('vt-alt-2');
    expect(nach.geloescht?.at(-1)?.id).toBe(VB);
  });

  it('Morgenlauf (Papierkorb 30 Tage) vermerkt ebenfalls', () => {
    const d: RegisterDatei = { gesellschaften: [{ id: G1, name: 'X', vertraege: [vertrag(VA, 'Alt im Korb', ['d-9'], { geloeschtAm: '2026-08-01T00:00:00.000Z' })] }] };
    const r = registerAufraeumen(d, {}, J);
    expect(r.n).toBe(1);
    expect(geloeschterBezug(r.d, 'vertrag', VA)?.dateiIds).toEqual(['d-9']);
  });

  it('Ablage filtern: Gesellschaft, optional Vertrag (Datei-Kennungen), neueste zuerst', () => {
    const l = [datei('d-1', G1, '2026-01-01'), datei('d-2', G1, '2026-02-01'), datei('d-3', 'kdv', '2026-03-01')];
    expect(unterlagenFiltern(l, G1).map(e => e.id)).toEqual(['d-2', 'd-1']);
    expect(unterlagenFiltern(l, G1, ['d-1', 'd-3']).map(e => e.id)).toEqual(['d-1']);
    expect(unterlagenFiltern(l, G1, []).map(e => e.id)).toEqual([]);
  });
});

describe('Server: endgültig löschen — Unterlagen bleiben, der Bezug bleibt lesbar', () => {
  type Route = { GET: (r: Request) => Promise<Response>; PATCH: (r: Request) => Promise<Response> };
  let reg: Route, unterlagen: Pick<Route, 'GET'>;
  let db: typeof import('@/lib/store/local-db');
  const kopf = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
  const konto = (id: string, sp: string, rolle: 'inhaber' | 'mitglied', haushalt: string) => ({ id, speicher: sp, email: `${sp}@example.invalid`, name: sp, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt });
  const get = async (p: string) => (await reg.GET(new Request('http://test/api/gesellschaften?papierkorb=1', { headers: kopf(p) }))).json();
  const patch = (p: string, body: unknown) => reg.PATCH(new Request('http://test/api/gesellschaften', { method: 'PATCH', headers: kopf(p), body: JSON.stringify(body) }));
  const ablage = (p: string, q: string) => unterlagen.GET(new Request(`http://test/api/gesellschaften/unterlagen?${q}`, { headers: kopf(p) }));
  const stand = async (id: string) => ((await get('person-a')).gesellschaften as { id: string; stand: string }[]).find(g => g.id === id)!.stand;

  beforeAll(async () => {
    db = await import('@/lib/store/local-db');
    await db.saveJson('konten', { konten: [konto('k1', 'person-a', 'inhaber', 'haus'), konto('k2', 'person-b', 'mitglied', 'haus'), konto('k3', 'testkunde', 'inhaber', 'kunde-haus')], einladungen: [] });
    await db.saveJson('kontakte', { kontakte: [] });
    await db.saveJson('gesellschaften--haus', { gesellschaften: [
      { id: G1, name: 'Erfundene Beispiel GmbH', vertraege: [vertrag(VA, 'Mietvertrag Büro', ['d-1'], { geloeschtAm: J }), vertrag(VB, 'Darlehen', ['d-2'])] },
      { id: G2, name: 'Andere Erfunden GmbH', vertraege: [] },
    ] });
    await db.saveJson('crm-dateien--haus', { eintraege: [datei('d-1', G1, '2026-01-01'), datei('d-2', G1, '2026-02-01'), datei('d-3', 'kdv', '2026-03-01')] });
    reg = (await import('@/app/api/gesellschaften/route')) as unknown as Route;
    unterlagen = (await import('@/app/api/gesellschaften/unterlagen/route')) as unknown as Route;
  });

  it('Vertrag endgültig: Unterlage bleibt in der Ablage, gefiltert auf den Vertrag mit „(gelöscht)“-Bezug', async () => {
    const r = await patch('person-a', { id: G1, stand: await stand(G1), liste: 'vertraege', eintragId: VA, aktion: 'endgueltig' });
    expect(r.status).toBe(200);
    const d = await get('person-a');
    expect(d.gesellschaften.find((g: { id: string }) => g.id === G1).vertraege.map((v: Vertrag) => v.id)).toEqual([VB]);
    expect(d.geloescht).toEqual([expect.objectContaining({ art: 'vertrag', id: VA, gesellschaftId: G1, titel: 'Mietvertrag Büro', dateiIds: ['d-1'] })]);
    const a = await (await ablage('person-a', `id=${G1}&vertrag=${VA}`)).json();
    expect(a.eintraege.map((e: { id: string }) => e.id)).toEqual(['d-1']);
    expect(a.bezug).toEqual({ gesellschaft: { name: 'Erfundene Beispiel GmbH', geloescht: false }, vertrag: { titel: 'Mietvertrag Büro', geloescht: true } });
    const b = await (await ablage('person-b', `id=${G1}&vertrag=${VB}`)).json();
    expect(b.eintraege.map((e: { id: string }) => e.id)).toEqual(['d-2']);
    expect(b.bezug.vertrag).toEqual({ titel: 'Darlehen', geloescht: false });
    expect((await ablage('person-a', `id=${G2}&vertrag=${VA}`)).status).toBe(404); // Vertrag einer anderen Gesellschaft
    expect((await ablage('person-a', `id=${G1}&vertrag=vt-gibt-es-nicht`)).status).toBe(404);
    expect((await ablage('person-a', `id=${G1}&vertrag=../x`)).status).toBe(400);
  });

  it('Gesellschaft endgültig: alle Unterlagen bleiben, Bezug „(gelöscht)“; der Ablage-Bestand ist unverändert', async () => {
    const korb = await patch('person-a', { id: G1, stand: await stand(G1), aktion: 'loeschen' });
    expect(korb.status).toBe(200);
    expect((await patch('person-a', { id: G1, stand: await stand(G1), aktion: 'endgueltig' })).status).toBe(200);
    const d = await get('person-a');
    expect(d.gesellschaften.some((g: { id: string }) => g.id === G1)).toBe(false);
    expect(d.geloescht.map((b: { art: string; id: string }) => `${b.art}:${b.id}`)).toEqual([`vertrag:${VA}`, `gesellschaft:${G1}`, `vertrag:${VB}`]);
    const a = await (await ablage('person-a', `id=${G1}`)).json();
    expect(a.eintraege.map((e: { id: string }) => e.id)).toEqual(['d-2', 'd-1']);
    expect(a.bezug).toEqual({ gesellschaft: { name: 'Erfundene Beispiel GmbH', geloescht: true } });
    expect((await (await ablage('person-a', `id=${G1}&vertrag=${VB}`)).json()).bezug.vertrag).toEqual({ titel: 'Darlehen', geloescht: true });
    expect(((await db.loadJson<{ eintraege: unknown[] }>('crm-dateien--haus'))?.eintraege ?? []).length).toBe(3);
  });

  it('fremder Haushalt (Testkunde): 403 — nie Namen gelöschter Gesellschaften', async () => {
    const r = await ablage('testkunde', `id=${G1}`);
    expect(r.status).toBe(403);
    expect(JSON.stringify(await r.json())).not.toContain('Erfundene');
    const g = await reg.GET(new Request('http://test/api/gesellschaften', { headers: kopf('testkunde') }));
    expect(g.status).toBe(403);
  });
});

describe('Oberfläche: Rückfrage sagt es deutlich, mit Link zur gefilterten Ablage', () => {
  const lies = (p: string) => readFileSync(path.join(process.cwd(), p), 'utf8');
  it('ein Satz, eine Stelle — in beiden Rückfragen (Gesellschaft, Vertrag) mit WEG.unterlagen', () => {
    expect(lies('components/os/unternehmen/teile.tsx')).toContain('Die Unterlagen bleiben in der Ablage erhalten (Aufbewahrungspflicht) — ');
    expect(lies('components/os/unternehmen/UnternehmenView.tsx')).toMatch(/endgültig löschen\?`, text: <>.*<UnterlagenBleiben href=\{WEG\.unterlagen\(g\.id\)\} \/>/);
    expect(lies('components/os/unternehmen/Vertraege.tsx')).toMatch(/<UnterlagenBleiben href=\{WEG\.unterlagen\(g\.id, v\.id\)\} \/>/);
    expect(WEG.unterlagen(G1, VA)).toBe(`/os/unternehmen?ablage=${G1}&v=${VA}`);
    expect(WEG.unterlagen(G1)).toBe(`/os/unternehmen?ablage=${G1}`);
  });
  it('gelöschte Gesellschaft im Link (Glocke, Aufgabe): Name „(gelöscht)“ statt „Nicht gefunden“; Unterlage nennt den gelöschten Vertrag', async () => {
    expect(lies('components/os/unternehmen/UnternehmenView.tsx')).toContain("geloeschterBezug(daten, 'gesellschaft', offen)");
    const { vertragBezugText } = await import('@/components/os/unternehmen/Vertraege');
    const g = { id: G1 as `g-${string}`, vertraege: [vertrag(VB, 'Darlehen', ['d-2'])] };
    expect(vertragBezugText('d-2', g, [])).toBe('zu „Darlehen“');
    expect(vertragBezugText('d-1', g, [{ art: 'vertrag', id: VA, gesellschaftId: G1, titel: 'Mietvertrag Büro', am: J, dateiIds: ['d-1'] }])).toBe('zu „Mietvertrag Büro“ (gelöscht)');
    expect(vertragBezugText('d-7', g, [])).toBeUndefined();
  });
});
