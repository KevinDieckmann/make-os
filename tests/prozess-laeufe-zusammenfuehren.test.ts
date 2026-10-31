// ─── Prozess-Läufe beim Zusammenführen von Personen (Kevin 31.10., Klickrunde) ──────────────────────────────────────────────────────────────────
// Die Läufe der entfernten Person wandern auf die behaltene; laufen danach zwei gleiche offen, bleibt der weiter fortgeschrittene (bei Gleichstand der
// ältere), der andere endet mit „zusammengeführt mit …“ — nie gelöscht. Rein + über die Dubletten-Route (Absichtsprotokoll, Abbruch nach dem Schritt).
// Eigener Datenordner, erfundene Kennungen.
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Kontakt } from '@/lib/make-one/crm';
import type { CrmBestand } from '@/lib/crm/typen';
import type { LaeufeDatei, ProzessLauf } from '@/lib/prozesse/lauf-typen';
import { laeufeZusammenfuehren, bleibenderLauf } from '@/lib/prozesse/laeufe-zusammenfuehren';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-laeufe-zusammen-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
delete process.env.MAKE_OS_GRABSTEINE_DIR;
process.env.MAKE_OS_KEY = 'pruef-schluessel-laeufe-zusammen';
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-laeufe-zusammen';
process.env.MAKE_OS_PEPPER = 'pruef-pepper-laeufe-zusammen-0123456789abcdef';

const A = 'c-behalten-a-1', B = 'c-entfernt-b-2', C = 'c-andere-c-3';
const T0 = '2026-10-01T08:00:00.000Z', T1 = '2026-10-05T08:00:00.000Z', JETZT = '2026-10-31T09:00:00.000Z';
const pl = (n: number) => `pl-00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const lauf = (n: number, prozessId: string, kontakt: string, x: Partial<ProzessLauf> = {}): ProzessLauf => ({
  id: pl(n), prozessId, version: 1, fall: { art: 'lead', id: kontakt }, bereich: 'kundengewinnung' as ProzessLauf['bereich'], schluessel: `${prozessId}|lead:${kontakt}`, durchgang: 1,
  modus: 'scharf', status: 'wartet', person: 'kevin', ausloeser: { art: 'ereignis' } as ProzessLauf['ausloeser'], tiefe: 0, daten: { 'bezug.kontaktId': kontakt }, start: T0, geaendert: T0,
  aktuell: 'k2', schritte: [{ knoten: 'k1', status: 'erledigt', ab: T0, bis: T0 }, { knoten: 'k2', status: 'wartet', ab: T0 }], kostenCent: 0, ...x,
});
const datei = (laeufe: ProzessLauf[], x: Partial<LaeufeDatei> = {}): LaeufeDatei => ({ v: 1, laeufe, zurueckgehalten: [], prozesse: {}, ...x });
const paare = new Map([[B, A]]);

describe('rein', () => {
  it('Lauf der entfernten Person wandert mit (Fall, Schlüssel, Daten); fremde Läufe bleiben unberührt', () => {
    const r = laeufeZusammenfuehren(datei([lauf(1, 'pr-a', B), lauf(2, 'pr-a', C)]), paare, JETZT);
    const [l1, l2] = r.datei.laeufe;
    expect(l1).toMatchObject({ fall: { art: 'lead', id: A }, schluessel: `pr-a|lead:${A}`, daten: { 'bezug.kontaktId': A }, status: 'wartet' });
    expect(l2).toBe(r.datei.laeufe[1]);
    expect(l2.fall.id).toBe(C);
    expect(r).toMatchObject({ umgebogen: 1, beendet: 0 });
  });

  it('zwei gleiche offen: der weiter fortgeschrittene bleibt, der andere endet mit Vermerk — nie gelöscht', () => {
    const weiter = lauf(1, 'pr-a', B, { start: T1, schritte: [{ knoten: 'k1', status: 'erledigt', ab: T1 }, { knoten: 'k2', status: 'erledigt', ab: T1 }, { knoten: 'k3', status: 'wartet', ab: T1 }] });
    const r = laeufeZusammenfuehren(datei([lauf(2, 'pr-a', A), weiter]), paare, JETZT);
    expect(r.datei.laeufe).toHaveLength(2);
    const bleibt = r.datei.laeufe.find(l => l.id === pl(1))!, weg = r.datei.laeufe.find(l => l.id === pl(2))!;
    expect(bleibt.status).toBe('wartet');
    expect(weg).toMatchObject({ status: 'abgebrochen', grund: 'zusammengefuehrt', ergebnis: 'abbruch', zusammengefuehrtMit: pl(1), ende: JETZT });
    expect(weg.wartet).toBeUndefined();
    expect(r.beendet).toBe(1);
  });

  it('Gleichstand → der ältere bleibt; anderer Prozess und anderer Modus laufen weiter', () => {
    const alt = lauf(1, 'pr-a', A, { start: T0 }), jung = lauf(2, 'pr-a', B, { start: T1 });
    const anderer = lauf(3, 'pr-b', B), schatten = lauf(4, 'pr-a', B, { modus: 'schatten' });
    const r = laeufeZusammenfuehren(datei([jung, alt, anderer, schatten]), paare, JETZT);
    const s = (id: string) => r.datei.laeufe.find(l => l.id === id)!;
    expect(s(pl(1)).status).toBe('wartet');
    expect(s(pl(2))).toMatchObject({ status: 'abgebrochen', zusammengefuehrtMit: pl(1) });
    expect(s(pl(3))).toMatchObject({ status: 'wartet', fall: { id: A } });
    expect(s(pl(4))).toMatchObject({ status: 'wartet', modus: 'schatten', fall: { id: A } });
    expect(bleibenderLauf(jung, alt)).toBe(alt);
  });

  it('ein beendeter Lauf zählt nicht als doppelt; idempotent (zweiter Durchgang ändert nichts)', () => {
    const fertig = lauf(1, 'pr-a', A, { status: 'fertig', ende: T1, aktuell: null });
    const r1 = laeufeZusammenfuehren(datei([fertig, lauf(2, 'pr-a', B)]), paare, JETZT);
    expect(r1.beendet).toBe(0);
    expect(r1.datei.laeufe.find(l => l.id === pl(2))!.status).toBe('wartet');
    const r2 = laeufeZusammenfuehren(r1.datei, paare, JETZT);
    expect(r2).toMatchObject({ umgebogen: 0, beendet: 0 });
    expect(r2.datei).toBe(r1.datei);
  });

  it('Listen der CRM-Abfrage, zurückgehaltene Starts und Testfälle wandern mit (ohne Doppelte in der Liste)', () => {
    const mitListe = lauf(1, 'pr-q', C, { listen: { q1: { faelle: [{ art: 'lead', id: A }, { art: 'lead', id: B }, { art: 'lead', id: C }], gesamt: 3, am: T0 } } });
    const d = datei([mitListe], {
      zurueckgehalten: [{ id: 'zh-00000000-0000-4000-8000-000000000001', prozessId: 'pr-a', fall: { art: 'lead', id: B }, ausloeser: { art: 'ereignis' } as ProzessLauf['ausloeser'], person: 'kevin', daten: {}, tiefe: 0, am: T0 }],
      prozesse: { 'pr-a': { einstellung: {}, verlauf: [], tests: [{ id: 'tf-00000000-0000-4000-8000-000000000001', nr: 1, fall: { art: 'lead', id: B }, erwartet: [], am: T0 }] } },
    });
    const r = laeufeZusammenfuehren(d, paare, JETZT);
    expect(r.datei.laeufe[0].listen!.q1.faelle).toEqual([{ art: 'lead', id: A }, { art: 'lead', id: C }]);
    expect(r.datei.zurueckgehalten[0].fall.id).toBe(A);
    expect((r.datei.prozesse['pr-a'].tests![0].fall as { id: string }).id).toBe(A);
    expect(JSON.stringify(r.datei)).not.toContain(B);
  });
});

// ── Über die Dubletten-Route (Absichtsprotokoll) ──────────────────────────────────────────────────────────────────────────────────────────────
type Route = { POST?: (r: Request) => Promise<Response> };
let db: typeof import('@/lib/store/local-db');
let ab: typeof import('@/lib/store/absichten');
let fort: typeof import('@/lib/store/absichten-fortsetzen');
const HAUS = 'test-haus';
const kopf = { 'x-make-key': 'pruef-schluessel-laeufe-zusammen', 'x-make-person': 'kevin', 'content-type': 'application/json' };
const post = (url: string, body: unknown) => new Request(`http://test${url}`, { method: 'POST', headers: kopf, body: JSON.stringify(body) });
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id, vorname: 'Testi', nachname: 'Doppel', email: 'testi.doppel@example.invalid', stufe: 'kontakt', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01', ...x } as Kontakt);
const leer = (): CrmBestand => ({ firmen: [], chancen: [], mandate: [], leistungen: [], events: [], teilnahmen: [], sitzungen: [], antraege: [], verarbeitungen: [], segmente: [], beitraege: [], newsletter: [], kampagnen: [], followups: [], angebote: [] } as unknown as CrmBestand);
const NAME = `prozess-laeufe--${HAUS}`;

async function welt() {
  for (const n of readdirSync(ordner)) if (n !== 'konten.json') rmSync(path.join(ordner, n), { recursive: true, force: true });
  db.leseCacheLeeren();
  await db.saveJson('kontakte', { kontakte: [k(A), k(B)] });
  await db.saveJson('crm', leer());
  const weiter = lauf(2, 'pr-a', B, { start: T1, schritte: [{ knoten: 'k1', status: 'erledigt', ab: T1 }, { knoten: 'k2', status: 'erledigt', ab: T1 }, { knoten: 'k3', status: 'wartet', ab: T1 }] });
  await db.saveJson(NAME, datei([lauf(1, 'pr-a', A), weiter, lauf(3, 'pr-b', B)]));
}
const laeufe = async () => (await db.loadJson<LaeufeDatei>(NAME))!.laeufe;
const pruefen = async () => {
  const l = await laeufe();
  expect(l).toHaveLength(3);
  expect(l.find(x => x.id === pl(1))).toMatchObject({ status: 'abgebrochen', grund: 'zusammengefuehrt', zusammengefuehrtMit: pl(2) });
  expect(l.find(x => x.id === pl(2))).toMatchObject({ status: 'wartet', fall: { id: A }, schluessel: `pr-a|lead:${A}` });
  expect(l.find(x => x.id === pl(3))).toMatchObject({ status: 'wartet', fall: { id: A } });
  expect(JSON.stringify(l)).not.toContain(B);
};

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [
    { id: 'k1', speicher: 'kevin', email: 'k@test', name: 'Kevin Test', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: HAUS },
  ], einladungen: [] });
  ab = await import('@/lib/store/absichten');
  fort = await import('@/lib/store/absichten-fortsetzen');
});
afterEach(() => { ab.absichtTest.vorSchritt = null; ab.absichtTest.vorAbhaken = null; ab.absichtTest.nachAbhaken = null; });
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Dubletten zusammenführen — Prozess-Läufe', () => {
  it('ohne Abbruch: mitgewandert, der doppelte weniger fortgeschrittene beendet; ein zweiter Durchgang ändert nichts', async () => {
    await welt();
    const route = (await import('@/app/api/crm/dubletten/route')) as unknown as Route;
    const r = await route.POST!(post('/api/crm/dubletten', { behalten: A, weg: B }));
    expect(r.status, await r.clone().text()).toBe(200);
    await pruefen();
    const vorher = JSON.stringify(await laeufe());
    const { personUmbiegen } = await import('@/lib/crm/person-bestaende');
    await personUmbiegen(B, A);
    expect(JSON.stringify(await laeufe())).toBe(vorher);
  });
  for (const wann of ['vorAbhaken', 'nachAbhaken'] as const) {
    it(`Abbruch ${wann === 'vorAbhaken' ? 'vor' : 'nach'} dem Abhaken des Schritts „verweise“ → Wiederaufnahme = derselbe Endstand`, async () => {
      await welt();
      const route = (await import('@/app/api/crm/dubletten/route')) as unknown as Route;
      ab.absichtTest[wann] = (art, s) => { if (art === 'zusammenfuehren' && s === 'verweise') throw new ab.TestAbbruch(s); };
      await expect(route.POST!(post('/api/crm/dubletten', { behalten: A, weg: B }))).rejects.toThrow(/Testabbruch/);
      ab.absichtTest[wann] = null;
      await fort.offeneFertigstellen();
      await pruefen();
    });
  }
});
