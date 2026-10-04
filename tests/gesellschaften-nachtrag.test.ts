// Gesellschafts-Register, Nachtrag 04.10. (Kevins Antworten): Rolle „Holding“ steuert die operativen Kennzahlen im Business-Index
// (ohne feste Firma: Rückfall nur, solange keine Rolle gepflegt ist), Erinnerung vor „kündigen bis“ (Aufgabe + Glocke, idempotent),
// Organe & Beschlüsse als eigene Listen (optionale Felder, Archiv/Papierkorb, Rechte serverseitig).
// Eigener Datenordner, erfundene Konten (@example.invalid) und Daten.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { rmSync } from 'node:fs';
import { kennzahlenFuer, HOLDING_VORGABE } from '@/lib/business/register';
import {
  holdingSichten, faelligeErinnerungen, erinnerungAufgabeId, beschlussSaeubern, organSaeubern, eintragAktion, eintragArchiviert, steckbriefAnwenden,
  type RegisterGesellschaft,
} from '@/lib/gesellschaften/modell';
import { pruefeEingabe } from '@/lib/meldungen/regeln';

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-gesellschaften-2-'));
  process.env.MAKE_OS_DATEN_DIR = o;
  process.env.MAKE_OS_KEY = 'pruef-schluessel-gesellschaften-2';
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  return o;
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

const ids = (scope: Parameters<typeof kennzahlenFuer>[0], h?: readonly ('kdc' | 'kdv' | 'ug' | 'gesamt')[]) => kennzahlenFuer(scope, h).map(k => k.id);
const G1 = 'g-11111111-1111-4111-8111-111111111111';

describe('Holding aus der Rolle im Register', () => {
  it('ohne gepflegte Rolle: null → Vorgabe, Ergebnis wie bisher', () => {
    expect(holdingSichten(null)).toBeNull();
    expect(holdingSichten({ gesellschaften: [{ id: 'kdv', firmierung: 'x' }, { id: G1, rolle: 'holding' }] })).toBeNull();
    expect(ids('kdv')).not.toContain('win_rate');
    expect(ids('kdv', HOLDING_VORGABE)).toEqual(ids('kdv'));
  });
  it('Rolle gepflegt: nur Holdings verlieren die operativen Kennzahlen; feste Ausnahmen bleiben', () => {
    expect(holdingSichten({ gesellschaften: [{ id: 'kdv', rolle: 'holding' }, { id: 'ug' }] })).toEqual(['kdv']);
    expect(holdingSichten({ gesellschaften: [{ id: 'kdc', rolle: 'operativ' }] })).toEqual([]);
    expect(ids('kdv', [])).toContain('win_rate');           // nicht (mehr) Holding → operative Kennzahlen gelten
    expect(ids('ug', ['ug'])).not.toContain('win_rate');     // MAKE als Holding
    expect(ids('ug', ['ug'])).not.toContain('auslastung');
    expect(ids('ug', [])).not.toContain('auslastung');       // fest „nicht für ug“ bleibt
    expect(ids('ug', [])).toContain('win_rate');
    expect(ids('gesamt', ['kdv'])).toContain('win_rate');    // die Gesamtsicht ist nie Holding
  });
  it('Rolle im Steckbrief: holding gespeichert, operativ = ohne Feld, Unsinn → Fehler', () => {
    expect(steckbriefAnwenden({ id: 'kdv' }, { rolle: 'holding' }, []).g.rolle).toBe('holding');
    expect(steckbriefAnwenden({ id: 'kdv', rolle: 'holding' }, { rolle: 'operativ' }, []).g.rolle).toBeUndefined();
    expect(steckbriefAnwenden({ id: 'kdv' }, { rolle: 'konzern' }, []).fehler[0].feld).toBe('rolle');
  });
});

describe('Erinnerung vor „kündigen bis“', () => {
  const V = (id: string, kuendigenBis: string, x: Record<string, unknown> = {}) => ({ id, art: 'gf-vertrag' as const, titel: `Vertrag ${id}`, parteien: [], status: 'unterschrieben' as const, kuendigenBis, ...x });
  const alle: RegisterGesellschaft[] = [{ id: G1, name: 'Neue Beispiel GmbH', vertraege: [
    V('vt-a-0001', '2026-11-01'), V('vt-b-0001', '2026-12-31'), V('vt-c-0001', '2026-11-01', { erinnerungTage: 0 }),
    V('vt-d-0001', '2026-11-01', { status: 'beendet' }), V('vt-e-0001', '2026-10-01'), V('vt-f-0001', '2026-10-20', { erinnerungTage: 10 }),
  ] }];
  it('Vorgabe 30 Tage, eigener Vorlauf, 0 = keine, beendet/vorbei nie', () => {
    const f = faelligeErinnerungen(alle, '2026-10-05');
    expect(f.map(e => e.vertragId)).toEqual(['vt-a-0001']);
    expect(faelligeErinnerungen(alle, '2026-10-10').map(e => e.vertragId)).toEqual(['vt-a-0001', 'vt-f-0001']);
    expect(f[0].aufgabeId).toBe(erinnerungAufgabeId('vt-a-0001', '2026-11-01'));
    expect(f[0].titel).toMatch(/bis 01\.11\.2026/);
  });
  it('Meldungs-Art „vertrag“ ist zulässig', () => {
    expect(pruefeEingabe({ an: 'person-a', art: 'vertrag', titel: 'x', link: '/os/unternehmen', bezug: { art: 'aufgabe', id: 'vte-a-20261101' } })).toEqual({ ok: true });
  });
});

describe('Organe & Beschlüsse', () => {
  it('säubern: Pflichtfelder, nur Person/Kontakt als Organ', () => {
    expect(organSaeubern({ id: 'og-test-0001', funktion: 'geschaeftsfuehrung', wer: { art: 'firma', id: 'f-1' } }).fehler[0].feld).toBe('wer');
    expect(organSaeubern({ id: 'og-test-0001', funktion: 'geschaeftsfuehrung', wer: { art: 'person', id: 'person-a' }, seit: '2026-10-01' }).e).toMatchObject({ seit: '2026-10-01' });
    expect(beschlussSaeubern({ id: 'bs-test-0001', datum: '2026-10-04', art: 'gesellschafterbeschluss' }).fehler.map(f => f.feld)).toContain('titel');
  });
  it('Archiv: Organ „bis heute“, Beschluss „aufgehoben“ und zurück', () => {
    const o = organSaeubern({ id: 'og-test-0001', funktion: 'beirat', wer: { art: 'kontakt', id: 'c-1' } }).e!;
    const a = eintragAktion('organe', o, 'archivieren', '2026-10-04', 'x');
    expect(a.bis).toBe('2026-10-04');
    expect(eintragArchiviert('organe', a, '2026-10-04')).toBe(true);
    expect(eintragArchiviert('organe', { ...o, bis: '2027-01-01' }, '2026-10-04')).toBe(false);
    const b = beschlussSaeubern({ id: 'bs-test-0001', datum: '2026-10-04', art: 'gf-beschluss', titel: 'Bestellung', status: 'eingetragen' }).e!;
    const ba = eintragAktion('beschluesse', b, 'archivieren', '2026-10-04', 'x');
    expect(ba.status).toBe('aufgehoben');
    expect(eintragAktion('beschluesse', ba, 'zurueckholen', '2026-10-04', 'x').status).toBe('eingetragen');
  });
});

describe('Server: Organe/Beschlüsse über die Route, Erinnerung idempotent', () => {
  type Route = { GET: (r: Request) => Promise<Response>; PATCH: (r: Request) => Promise<Response> };
  let reg: Route;
  let db: typeof import('@/lib/store/local-db');
  const kopf = (p: string) => ({ 'content-type': 'application/json', 'x-make-user': p });
  const konto = (id: string, sp: string, rolle: 'inhaber' | 'mitglied', haushalt: string) => ({ id, speicher: sp, email: `${sp}@example.invalid`, name: sp, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt });
  const patch = (p: string, body: unknown) => reg.PATCH(new Request('http://test/api/gesellschaften', { method: 'PATCH', headers: kopf(p), body: JSON.stringify(body) }));
  const kdv = async () => ((await (await reg.GET(new Request('http://test/api/gesellschaften', { headers: kopf('person-a') }))).json()).gesellschaften as { id: string; stand: string; organe?: unknown[]; beschluesse?: unknown[] }[]).find(g => g.id === 'kdv')!;
  beforeAll(async () => {
    db = await import('@/lib/store/local-db');
    await db.saveJson('konten', { konten: [konto('k1', 'person-a', 'inhaber', 'haus'), konto('k2', 'person-b', 'mitglied', 'haus'), konto('k3', 'testkunde', 'inhaber', 'kunde-haus'), konto('k4', 'partner', 'mitglied', 'kunde-haus')], einladungen: [] });
    await db.saveJson('kontakte', { kontakte: [] });
    await db.saveJson('tasks', { projects: [], tasks: [], listen: [], statusEigen: [], gruppen: [], vorlagen: [], umbauVersion: 2 });
    reg = (await import('@/app/api/gesellschaften/route')) as unknown as Route;
  });
  it('Testkunde/Partner: 403 auch für Organe und Beschlüsse', async () => {
    for (const p of ['testkunde', 'partner']) expect((await patch(p, { id: 'kdv', stand: 'x', liste: 'organe', eintrag: { funktion: 'beirat', wer: { art: 'person', id: p } } })).status).toBe(403);
  });
  it('Organ + Beschluss anlegen, Organ archivieren', async () => {
    let g = await kdv();
    let r = await (await patch('person-a', { id: 'kdv', stand: g.stand, liste: 'organe', eintrag: { funktion: 'geschaeftsfuehrung', wer: { art: 'person', id: 'person-a' }, seit: '2026-01-01' } })).json();
    expect(r.gesellschaft.organe).toHaveLength(1);
    r = await (await patch('person-a', { id: 'kdv', stand: r.gesellschaft.stand, liste: 'beschluesse', eintrag: { datum: '2026-10-04', art: 'gesellschafterbeschluss', titel: 'Umfirmierung beschließen' } })).json();
    expect(r.gesellschaft.beschluesse[0]).toMatchObject({ status: 'gefasst', titel: 'Umfirmierung beschließen' });
    const og = r.gesellschaft.organe[0].id;
    r = await (await patch('person-a', { id: 'kdv', stand: r.gesellschaft.stand, liste: 'organe', eintragId: og, aktion: 'archivieren' })).json();
    expect(r.gesellschaft.organe[0].bis).toBeTruthy();
    g = await kdv();
    expect(g.organe).toHaveLength(1);
  });
  it('Vertrag mit „kündigen bis“ im Vorlauf → eine Aufgabe + Glocke für beide; zweiter Lauf legt nichts doppelt an', async () => {
    const { localDay, tagePlus } = await import('@/lib/zeit');
    const bis = tagePlus(localDay(), 10);
    const g = await kdv();
    const r = await (await patch('person-a', { id: 'kdv', stand: g.stand, liste: 'vertraege', eintrag: { art: 'darlehen', titel: 'Darlehen (Beispiel)', status: 'unterschrieben', parteien: [], kuendigenBis: bis } })).json();
    const vid = r.gesellschaft.vertraege[0].id as string;
    const aid = erinnerungAufgabeId(vid, bis);
    const tasks = await db.loadJson<{ tasks: { id: string; dueDate?: string }[] }>('tasks');
    expect(tasks!.tasks.filter(t => t.id === aid)).toHaveLength(1);
    expect(tasks!.tasks.find(t => t.id === aid)?.dueDate).toBe(bis);
    for (const p of ['person-a', 'person-b']) {
      const m = await db.loadJson<{ eintraege: { art: string; bezug?: { id: string } }[] }>(`meldungen--${p}`);
      expect(m!.eintraege.filter(e => e.art === 'vertrag' && e.bezug?.id === aid)).toHaveLength(1);
    }
    const { vertragsErinnerungen } = await import('@/lib/gesellschaften/server');
    expect((await vertragsErinnerungen('haus')).neu).toBe(0);
    const t2 = await db.loadJson<{ tasks: { id: string }[] }>('tasks');
    expect(t2!.tasks.filter(t => t.id === aid)).toHaveLength(1);
  });
});
