// ─── Firma ändern mit Absicht (Kevin 28.09.): Jobwechsel · Zusätzlich · Korrektur · Altweg ──
// Kartei-Schreibweg PATCH /api/state/kontakte mit `firmaWechsel` im `teil`. Eigener Datenordner,
// erfundene Konten und Daten (@example.invalid) — nie der echte Bestand.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-firmawechsel-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-firmawechsel';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

type Handler = (r: Request) => Promise<Response>;
type Kontakt = import('@/lib/make-one/crm').Kontakt;
const HAUS = 'fw-haus';
const HEUTE_MUSTER = /^\d{4}-\d{2}-\d{2}$/;
const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied') => ({ id, speicher, email: `${speicher}@example.invalid`, name: speicher, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: HAUS });
const firma = (id: string) => ({ id, name: `Firma ${id}`, rolle: 'zielkunde', geaendert: '2026-09-01T10:00:00.000Z' });
const k = (id: string, x: Partial<Kontakt>): Kontakt => ({ id, vorname: 'Vera', nachname: id.slice(2), eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', ...x });

let db: typeof import('@/lib/store/local-db');
let route: { PATCH: Handler };
const patch = async (ops: unknown[]) => {
  const r = await route.PATCH(new Request('http://test/api/state/kontakte', { method: 'PATCH', headers: { 'content-type': 'application/json', 'x-make-user': 'kevin' }, body: JSON.stringify({ ops }) }));
  return { status: r.status, d: await r.json() };
};
const lies = async (id: string) => ((await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? []).find(x => x.id === id)!;
const mitStationen = (id: string) => k(id, { firmaId: 'f-alpha', firma: 'Firma f-alpha', position: 'GF', stationen: [{ firmaId: 'f-alpha', rolle: 'GF', von: '2020-01-01', aktiv: true, haupt: true }, { firmaId: 'f-gamma', aktiv: false, bis: '2019-12-31' }] });

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'inhaber')], einladungen: [] });
  await db.saveJson('crm', { ...(await import('@/lib/crm/speicher')).leererBestand(), firmen: [firma('f-alpha'), firma('f-beta'), firma('f-gamma')] });
  await db.saveJson('kontakte', { kontakte: [
    mitStationen('c-jobw1'), mitStationen('c-zusa1'), mitStationen('c-korr1'), mitStationen('c-ohne1'), mitStationen('c-leer1'),
    k('c-alt001', { firmaId: 'f-alpha', firma: 'Firma f-alpha', position: 'Einkauf', email: 'alt@example.invalid' }),
  ] });
  route = (await import('@/app/api/state/kontakte/route')) as unknown as { PATCH: Handler };
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Firma ändern — die drei Absichten und der Altweg', () => {
  it('Jobwechsel: die bisherige Hauptstation endet heute, der Verlauf bleibt, die neue Firma wird Hauptstation', async () => {
    const r = await patch([{ op: 'teil', id: 'c-jobw1', felder: { firmaId: 'f-beta', firma: 'Firma f-beta', firmaWechsel: 'jobwechsel' } }]);
    expect(r.status).toBe(200);
    const n = await lies('c-jobw1');
    expect(n.firmaId).toBe('f-beta');
    expect(n.firma).toBe('Firma f-beta');
    const alpha = n.stationen!.find(s => s.firmaId === 'f-alpha')!;
    expect(alpha).toMatchObject({ aktiv: false, rolle: 'GF', von: '2020-01-01' });
    expect(alpha.bis).toMatch(HEUTE_MUSTER);
    expect(n.stationen!.find(s => s.firmaId === 'f-beta')).toMatchObject({ aktiv: true, haupt: true });
    expect(n.stationen!.find(s => s.firmaId === 'f-gamma')).toMatchObject({ aktiv: false, bis: '2019-12-31' });
    expect(JSON.stringify(n)).not.toContain('firmaWechsel');
  });

  it('Zusätzliche Firma: neue laufende Station, die bisherige bleibt aktiv und Hauptstation', async () => {
    const r = await patch([{ op: 'teil', id: 'c-zusa1', felder: { firmaId: 'f-beta', firma: 'Firma f-beta', firmaWechsel: 'zusaetzlich' } }]);
    expect(r.status).toBe(200);
    const n = await lies('c-zusa1');
    expect(n.firmaId).toBe('f-alpha');
    expect(n.position).toBe('GF');
    expect(n.stationen!.filter(s => s.aktiv).map(s => s.firmaId).sort()).toEqual(['f-alpha', 'f-beta']);
    expect(n.stationen!.find(s => s.firmaId === 'f-alpha')?.haupt).toBe(true);
  });

  it('Korrektur: die Hauptstation wird ersetzt — ohne Historie, Rolle und Zeitraum bleiben', async () => {
    const r = await patch([{ op: 'teil', id: 'c-korr1', felder: { firmaId: 'f-beta', firma: 'Firma f-beta', firmaWechsel: 'korrektur' } }]);
    expect(r.status).toBe(200);
    const n = await lies('c-korr1');
    expect(n.firmaId).toBe('f-beta');
    expect(n.stationen).toEqual([{ firmaId: 'f-beta', rolle: 'GF', von: '2020-01-01', aktiv: true, haupt: true }, { firmaId: 'f-gamma', aktiv: false, bis: '2019-12-31' }]);
  });

  it('Altweg ohne Absicht bei gespeicherten Stationen: 409 mit Hinweis, nichts geändert, keine Station endet', async () => {
    const vorher = await lies('c-ohne1');
    const r = await patch([{ op: 'teil', id: 'c-ohne1', felder: { firmaId: 'f-beta', firma: 'Firma f-beta' } }]);
    expect(r.status).toBe(409);
    expect(r.d.error).toMatch(/Jobwechsel, zusätzliche Firma oder Korrektur/);
    expect(await lies('c-ohne1')).toEqual(vorher);
    // Auch ein ganzer Eintrag aus einem älteren Fenster mit anderer Firma wird abgelehnt.
    const { stationen: _s, ...ohne } = vorher;
    expect((await patch([{ op: 'upsert', eintrag: { ...ohne, firmaId: 'f-beta' } }])).status).toBe(409);
    // Firma leeren ohne Absicht ebenso; mit „jobwechsel“ endet die Station (ausgeschieden).
    expect((await patch([{ op: 'teil', id: 'c-leer1', felder: { firmaId: null, firma: null } }])).status).toBe(409);
    expect((await patch([{ op: 'teil', id: 'c-leer1', felder: { firmaId: null, firma: null, firmaWechsel: 'jobwechsel' } }])).status).toBe(200);
    const leer = await lies('c-leer1');
    expect(leer.firmaId).toBeUndefined();
    expect(leer.stationen!.find(s => s.firmaId === 'f-alpha')).toMatchObject({ aktiv: false });
  });

  it('Altweg ohne Absicht beim Altbestand (keine gespeicherten Stationen): Korrektur wie früher, nichts Neues geschrieben', async () => {
    const r = await patch([{ op: 'teil', id: 'c-alt001', felder: { firmaId: 'f-beta', firma: 'Firma f-beta' } }]);
    expect(r.status).toBe(200);
    const n = await lies('c-alt001');
    expect(n).toMatchObject({ firmaId: 'f-beta', firma: 'Firma f-beta', position: 'Einkauf', email: 'alt@example.invalid' });
    expect(n.stationen).toBeUndefined();
  });
});
