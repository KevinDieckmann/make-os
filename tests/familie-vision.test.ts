// ─── Familie › Vision: Einträge ändert/löscht nur ihre Anlegerin (08.10., Kevin, Phase 0) — Regel + Route, erfundene Daten ─────
// Wächter „Person B ändert nichts aus Person A“: Ziel-Eintrag und Traum einer anderen Person → 403, NICHTS gespeichert (auch keine
// mitgeschickten Ops); lesen wie bisher für beide; Altbestand ohne Anlegerin bleibt für alle änderbar; `von` setzt nur der Server.
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { visionSetzen, visionEintragFrei, VISION_FREMD, VISION_FREMDER_TRAUM } from '@/lib/familie/vision';
import type { Vision } from '@/lib/familie/typen';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-familie-vision-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-familie-vision';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

const ALT: Vision = {
  jahr: 2026, leitbild: 'Ruhiger leben',
  ziele: [
    { id: 'z-a', text: 'Ziel von A', erreicht: false, von: 'person-a' },
    { id: 'z-b', text: 'Ziel von B', erreicht: false, von: 'person-b' },
    { id: 'z-alt', text: 'Altes Ziel ohne Anlegerin', erreicht: false },
  ],
  traeume: [{ person: 'person-a', text: 'Traum von A' }, { person: 'person-b', text: 'Traum von B' }, { person: '', text: 'Alter Traum' }],
};

describe('visionSetzen (rein)', () => {
  it('eigene und Altbestand frei; fremd ändern/abhaken/löschen → abgelehnt', () => {
    const z = ALT.ziele;
    expect(visionEintragFrei(z[1], 'person-b')).toBe(true);
    expect(visionEintragFrei(z[2], 'person-b')).toBe(true);
    expect(visionEintragFrei(z[0], 'person-b')).toBe(false);
    const ok = visionSetzen(ALT, { ziele: [z[0], { ...z[1], text: 'neu B', erreicht: true }, { ...z[2], text: 'Altes geändert' }] }, 'person-b', 2026);
    expect(ok.ok).toBe(true);
    expect(visionSetzen(ALT, { ziele: [{ ...z[0], text: 'umgeschrieben' }, z[1], z[2]] }, 'person-b', 2026)).toEqual({ ok: false, fehler: VISION_FREMD });
    expect(visionSetzen(ALT, { ziele: [{ ...z[0], erreicht: true }, z[1], z[2]] }, 'person-b', 2026)).toEqual({ ok: false, fehler: VISION_FREMD });
    expect(visionSetzen(ALT, { ziele: [z[1], z[2]] }, 'person-b', 2026)).toEqual({ ok: false, fehler: VISION_FREMD });
  });

  it('neue Einträge gehören der schreibenden Person — ein mitgeschicktes `von` zählt nie', () => {
    const r = visionSetzen(ALT, { ziele: [...ALT.ziele, { id: 'z-neu', text: 'Neu', erreicht: false, von: 'person-a' }] }, 'person-b', 2026);
    expect(r.ok && r.vision.ziele.find(z => z.id === 'z-neu')?.von).toBe('person-b');
    // Ein bestehender Eintrag behält seine Anlegerin, auch wenn der Browser eine andere schickt.
    const r2 = visionSetzen(ALT, { ziele: [ALT.ziele[0], { ...ALT.ziele[1], von: 'person-a' }, ALT.ziele[2]] }, 'person-b', 2026);
    expect(r2.ok && r2.vision.ziele[1].von).toBe('person-b');
    expect(r2.ok && r2.vision.ziele[2].von).toBeUndefined(); // Altbestand bleibt ohne Anlegerin
  });

  it('Träume: fremde unverändert lassen, eigene frei, nie im Namen einer anderen Person', () => {
    const t = ALT.traeume;
    expect(visionSetzen(ALT, { traeume: [t[0], { person: 'person-b', text: 'Anderer Traum' }, t[2]] }, 'person-b', 2026).ok).toBe(true);
    expect(visionSetzen(ALT, { traeume: [t[1], t[2]] }, 'person-b', 2026)).toEqual({ ok: false, fehler: VISION_FREMDER_TRAUM });
    expect(visionSetzen(ALT, { traeume: [{ person: 'person-a', text: 'geändert' }, t[1], t[2]] }, 'person-b', 2026)).toEqual({ ok: false, fehler: VISION_FREMDER_TRAUM });
    expect(visionSetzen(ALT, { traeume: [...t, { person: 'person-a', text: 'untergeschoben' }] }, 'person-b', 2026)).toEqual({ ok: false, fehler: VISION_FREMDER_TRAUM });
    // Ohne Person: der unveränderte Alt-Traum bleibt ohne Person, ein neuer gehört der schreibenden Person.
    const r = visionSetzen(ALT, { traeume: [...t, { person: '', text: 'Neuer Traum' }] }, 'person-b', 2026);
    expect(r.ok && r.vision.traeume).toEqual([...t, { person: 'person-b', text: 'Neuer Traum' }]);
  });

  it('nur das Leitbild: Einträge bleiben, wie sie sind', () => {
    const r = visionSetzen(ALT, { leitbild: 'Neues Leitbild' }, 'person-b', 2026);
    expect(r).toEqual({ ok: true, vision: { ...ALT, leitbild: 'Neues Leitbild' } });
  });
});

describe('PATCH /api/familie — Vision', () => {
  type H = (r: Request) => Promise<Response>;
  let route: { GET: H; PATCH: H };
  let db: typeof import('@/lib/store/local-db');
  const patch = (p: string, body: unknown) => route.PATCH(new Request('http://test/api/familie', { method: 'PATCH', headers: { 'content-type': 'application/json', 'x-make-user': p }, body: JSON.stringify(body) }));
  const gespeichert = async () => (await db.loadJson<{ visionen: Vision[]; themen: { id: string }[] }>('familie--haus-v'))!;

  beforeAll(async () => {
    db = await import('@/lib/store/local-db');
    const k = (id: string, speicher: string, rolle: string) => ({ id, speicher, email: `${speicher}@example.invalid`, name: speicher, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'haus-v' });
    await db.saveJson('konten', { konten: [k('k1', 'person-a', 'inhaber'), k('k2', 'person-b', 'mitglied')], einladungen: [] });
    route = (await import('@/app/api/familie/route')) as unknown as typeof route;
  });
  beforeEach(async () => {
    const { startBestand } = await import('@/lib/familie/speicher');
    await db.saveJson('familie--haus-v', { ...startBestand('2026-09-01T00:00:00.000Z'), visionen: [ALT] });
  });
  afterAll(() => rmSync(ordner, { recursive: true, force: true }));

  it('person-b löscht oder ändert den Eintrag von person-a → 403, nichts gespeichert (auch nicht die mitgeschickten Ops)', async () => {
    const r = await patch('person-b', { ops: [{ liste: 'themen', op: 'upsert', eintrag: { id: 'th-neu', titel: 'Thema', art: 'loesbar', status: 'offen', hut: 'privat' } }], felder: { vision: { ...ALT, ziele: ALT.ziele.filter(z => z.id !== 'z-a') } } });
    expect(r.status).toBe(403);
    expect(((await r.json()) as { fehler: string }).fehler).toBe(VISION_FREMD);
    const f = await gespeichert();
    expect(f.visionen).toEqual([ALT]);
    expect(f.themen.some(t => t.id === 'th-neu')).toBe(false);
    expect((await patch('person-b', { felder: { vision: { ...ALT, ziele: ALT.ziele.map(z => (z.id === 'z-a' ? { ...z, erreicht: true } : z)) } } })).status).toBe(403);
    expect((await gespeichert()).visionen).toEqual([ALT]);
  });

  it('eigene Einträge, Altbestand und das Leitbild darf person-b ändern; neue tragen ihre Anlegerin; person-a liest alles', async () => {
    const neu = { ...ALT, leitbild: 'Gemeinsam neu', ziele: [ALT.ziele[0], { ...ALT.ziele[1], erreicht: true }, { id: 'z-neu', text: 'Neues Ziel', erreicht: false }] };
    const r = await patch('person-b', { felder: { vision: neu } });
    expect(r.status).toBe(200);
    const v = (await gespeichert()).visionen[0];
    expect(v.leitbild).toBe('Gemeinsam neu');
    expect(v.ziele).toEqual([ALT.ziele[0], { ...ALT.ziele[1], erreicht: true }, { id: 'z-neu', text: 'Neues Ziel', erreicht: false, von: 'person-b' }]);
    const sicht = await (await route.GET(new Request('http://test/api/familie', { headers: { 'x-make-user': 'person-a' } }))).text();
    expect(sicht).toContain('Neues Ziel');
    expect(sicht).toContain('Traum von B');
    // Jetzt kann person-a den neuen Eintrag von person-b nicht löschen.
    expect((await patch('person-a', { felder: { vision: { ...v, ziele: v.ziele.filter(z => z.id !== 'z-neu') } } })).status).toBe(403);
  });
});
