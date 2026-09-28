// ─── Finanzplan: Storno statt Löschen, Stand je Eintrag, Cent (28.09., K3) ──
// Prüfbericht #50/#81: gestellte/bezahlte Rechnungen waren per ✕ hart löschbar,
// die Buchung blieb verwaist. #107: zwei Fenster überschrieben sich gegenseitig
// still. #79: Beträge wurden auf ganze Euro gerundet (1.190,50 → 1.191).
// Eigener Datenordner, Dienstaufruf mit Schlüssel + Person. Erfundene Zahlen.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-fp-storno-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-fps';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

const kopf = { 'content-type': 'application/json', 'x-make-key': 'pruef-schluessel-fps', 'x-make-person': 'kevin' };
const req = (body?: unknown, method = 'GET') =>
  new Request('http://test/api/state/finanzplan', { method, headers: kopf, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });

interface R { id: string; firmaId: string; kunde: string; titel: string; betrag: number; status: string; faellig?: string; nummer?: string; datum?: string; storniertAm?: string; stornoGrund?: string; fassung?: string }
type Plan = { rechnungen: R[]; zahlungen: { id: string; betrag: number; fassung?: string }[]; firmen: { id: string; name: string; bank: string; kontostand: number | null; stand: string | null; fassung?: string }[] };
type Mod = { GET: (r: Request) => Promise<Response>; PATCH: (r: Request) => Promise<Response>; PUT: (r: Request) => Promise<Response> };
let route: Mod;
let db: typeof import('@/lib/store/local-db');

const patch = async (body: unknown) => { const r = await route.PATCH(req(body, 'PATCH')); return { status: r.status, d: await r.json() as Record<string, unknown> & Plan } };
const lade = async () => (await (await route.GET(req())).json()) as Plan;
const rechnung = async (id: string) => (await lade()).rechnungen.find(r => r.id === id)!;
const buchungen = async () => ((await db.loadJson<{ buchungen: { id: string; betrag: number; rechnungId?: string; datum: string }[] }>('buchungen'))?.buchungen ?? []);
const neu = (id: string, x: Partial<R> = {}): R => ({ id, firmaId: 'kdc', kunde: `Kunde ${id}`, titel: `Leistung ${id}`, betrag: 1000, status: 'geplant', ...x });
const upsert = (e: Partial<R>, stand?: string) => patch({ ops: [{ liste: 'rechnungen', op: 'upsert', eintrag: e, ...(stand ? { stand } : {}) }] });

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [
    { id: 'k1', speicher: 'kevin', email: 'k@test', name: 'Kevin Test', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'test-fps' },
  ], einladungen: [] });
  route = (await import('@/app/api/state/finanzplan/route')) as unknown as Mod;
  await db.saveJson('finanzplan', { firmen: [{ id: 'kdc', name: 'Testfirma', bank: 'Testbank', kontostand: 500, stand: '2026-09-01' }], rechnungen: [], merkposten: [], zahlungen: [], produkte: [{ id: 'p1', name: 'Paket', beschreibung: '', preis: 1, einheit: 'einmalig', status: 'entwurf' }], uhrwerk: { letztesMeeting: null, agenda: [{ id: 'a1', label: 'Punkt', done: false }] } });
  await db.saveJson('buchungen', { buchungen: [] });
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Beträge auf den Cent (#79)', () => {
  it('1.190,50 € bleibt 1.190,50 € — Rechnung und Zahlung', async () => {
    expect((await upsert(neu('r-cent', { betrag: 1190.5 }))).status).toBe(200);
    expect((await patch({ ops: [{ liste: 'zahlungen', op: 'upsert', eintrag: { id: 'z-cent', firmaId: 'kdc', an: 'Empfänger', titel: 'Miete', betrag: 99.99, status: 'offen' } }] })).status).toBe(200);
    const p = await lade();
    expect(p.rechnungen.find(r => r.id === 'r-cent')!.betrag).toBe(1190.5);
    expect(p.zahlungen.find(z => z.id === 'z-cent')!.betrag).toBe(99.99);
  });
  it('bezahlt bucht den Eingang centgenau', async () => {
    await upsert({ ...neu('r-cent', { betrag: 1190.5 }), status: 'gestellt' });
    expect((await patch({ aktion: 'bezahlt', rechnungId: 'r-cent', am: '2026-09-20' })).status).toBe(200);
    expect((await buchungen()).find(b => b.id === 'bu-re-r-cent')!.betrag).toBe(1190.5);
  });
});

describe('Rechnungen ab „gestellt“: nicht löschen, nicht umschreiben (#50/#81)', () => {
  it('geplante Rechnung ist löschbar', async () => {
    await upsert(neu('r-plan'));
    expect((await patch({ ops: [{ liste: 'rechnungen', op: 'delete', id: 'r-plan' }] })).status).toBe(200);
    expect((await lade()).rechnungen.some(r => r.id === 'r-plan')).toBe(false);
  });

  it('gestellte Rechnung: Löschen → 409 mit Text, sie bleibt', async () => {
    await upsert(neu('r-gest', { status: 'gestellt' }));
    const a = await patch({ ops: [{ liste: 'rechnungen', op: 'delete', id: 'r-gest' }] });
    expect(a.status).toBe(409);
    expect(String(a.d.error)).toMatch(/storniert/);
    expect(await rechnung('r-gest')).toMatchObject({ status: 'gestellt', betrag: 1000 });
  });

  it('bezahlte Rechnung: Löschen → 409', async () => {
    expect((await patch({ ops: [{ liste: 'rechnungen', op: 'delete', id: 'r-cent' }] })).status).toBe(409);
    expect((await rechnung('r-cent')).status).toBe('bezahlt');
  });

  it('Betrag ändern ab gestellt → 409; Nummer/Datum nachtragen geht, danach ändern nicht', async () => {
    const alt = await rechnung('r-gest');
    expect((await upsert({ ...alt, betrag: 900 })).status).toBe(409);
    expect((await rechnung('r-gest')).betrag).toBe(1000);
    expect((await upsert({ ...alt, nummer: 'RE-1', datum: '2026-09-10' })).status).toBe(200);
    const mitNr = await rechnung('r-gest');
    expect((await upsert({ ...mitNr, nummer: 'RE-2' })).status).toBe(409);
    expect((await upsert({ ...mitNr, datum: '2026-09-11' })).status).toBe(409);
    expect(await rechnung('r-gest')).toMatchObject({ nummer: 'RE-1', datum: '2026-09-10' });
    // Andere Felder (z. B. Fälligkeit) bleiben pflegbar.
    expect((await upsert({ ...mitNr, faellig: '2026-10-10' })).status).toBe(200);
  });

  it('kein Weg zurück: bezahlt → geplant → 409 (sonst wäre sie danach löschbar)', async () => {
    const r = await rechnung('r-cent');
    expect((await upsert({ ...r, status: 'geplant' })).status).toBe(409);
    expect((await upsert({ ...r, status: 'gestellt' })).status).toBe(409);
    expect((await upsert({ ...r, status: 'storniert' })).status).toBe(409);
    expect((await rechnung('r-cent')).status).toBe('bezahlt');
  });

  it('PUT (Vollschreiben) ohne die gestellte Rechnung → 409', async () => {
    const p = await lade();
    const r = await route.PUT(req({ ...p, rechnungen: p.rechnungen.filter(x => x.id !== 'r-gest') }, 'PUT'));
    expect(r.status).toBe(409);
    expect(await rechnung('r-gest')).toBeTruthy();
  });
});

describe('Stornieren (#50/#81) und die Buchung dazu', () => {
  it('ohne Grund → 400; geplante → 409 (die wird gelöscht)', async () => {
    expect((await patch({ aktion: 'storno', rechnungId: 'r-gest' })).status).toBe(400);
    await upsert(neu('r-plan2'));
    expect((await patch({ aktion: 'storno', rechnungId: 'r-plan2', grund: 'falsch angelegt' })).status).toBe(409);
  });

  it('gestellt → storniert mit Datum und Grund; der Eintrag bleibt, keine Buchung', async () => {
    const a = await patch({ aktion: 'storno', rechnungId: 'r-gest', grund: 'Doppelt gestellt', am: '2026-09-22' });
    expect(a.status).toBe(200);
    expect(await rechnung('r-gest')).toMatchObject({ status: 'storniert', storniertAm: '2026-09-22', stornoGrund: 'Doppelt gestellt', betrag: 1000, nummer: 'RE-1' });
    expect((await buchungen()).some(b => b.rechnungId === 'r-gest')).toBe(false);
    // Storniert bleibt, wie sie ist: nicht bezahlbar, nicht änderbar, nicht löschbar.
    expect((await patch({ aktion: 'bezahlt', rechnungId: 'r-gest' })).status).toBe(409);
    expect((await upsert({ ...(await rechnung('r-gest')), faellig: '2026-12-01' })).status).toBe(409);
    expect((await patch({ ops: [{ liste: 'rechnungen', op: 'delete', id: 'r-gest' }] })).status).toBe(409);
  });

  it('bezahlt → storniert: Gegenbuchung bu-st-<id> (negativ) — kein verwaister Ist-Eingang; idempotent', async () => {
    const a = await patch({ aktion: 'storno', rechnungId: 'r-cent', grund: 'Gutschrift', am: '2026-09-25' });
    expect(a.status).toBe(200);
    expect(a.d.gegenbuchung).toBe('neu');
    const zuR = (await buchungen()).filter(b => b.rechnungId === 'r-cent');
    expect(zuR.map(b => b.id).sort()).toEqual(['bu-re-r-cent', 'bu-st-r-cent']);
    expect(zuR.reduce((s, b) => s + b.betrag, 0)).toBe(0);
    expect(zuR.find(b => b.id === 'bu-st-r-cent')).toMatchObject({ betrag: -1190.5, datum: '2026-09-25' });
    // Noch einmal: nichts doppelt.
    const b = await patch({ aktion: 'storno', rechnungId: 'r-cent', grund: 'Gutschrift' });
    expect(b.status).toBe(200);
    expect(b.d.schonStorniert).toBe(true);
    expect((await buchungen()).filter(x => x.id === 'bu-st-r-cent')).toHaveLength(1);
  });

  it('Storno zählt nicht mehr: Liquiditätsvorschau und Umsatz des Kunden', async () => {
    const { vorschau } = await import('@/lib/make-one/liquiditaet');
    const { umsatzKennzahlen } = await import('@/lib/crm/umsatz');
    const heute = '2026-09-28';
    const rechnungen = [
      { id: 'a', kunde: 'X', titel: 't', betrag: 500, status: 'gestellt', faellig: '2026-10-01' },
      { id: 'b', kunde: 'X', titel: 't', betrag: 700, status: 'storniert', faellig: '2026-10-01' },
    ];
    const v = vorschau([{ id: 'kdc', name: 'F', kontostand: 0, stand: null }], rechnungen, [], [], heute, 4);
    expect(v.summeEin).toBe(500);
    const kz = umsatzKennzahlen({ mandate: [], deals: [], rechnungen: rechnungen.map(r => ({ r, perName: false, ueberfaellig: false })) } as never);
    expect(kz.offen).toBe(500);
    expect(kz.bezahlt).toBe(0);
  });
});

describe('Stand je Eintrag: zwei Schreiber (#107)', () => {
  it('GET liefert je Eintrag eine Fassung — auch Firmen (deren `stand` bleibt das Datum)', async () => {
    const p = await lade();
    expect(p.rechnungen.every(r => typeof r.fassung === 'string' && r.fassung.length > 0)).toBe(true);
    expect(p.firmen[0]).toMatchObject({ stand: '2026-09-01' });
    expect(typeof p.firmen[0].fassung).toBe('string');
  });

  it('Malin ändert, Kevin mit altem Stand → 409 mit aktuellem Eintrag, nichts überschrieben', async () => {
    await upsert(neu('r-zwei', { betrag: 300 }));
    const kevinSieht = await rechnung('r-zwei');
    const malinSieht = await rechnung('r-zwei');
    // Malin zuerst (mit ihrem Stand im Eintrag, wie der Browser ihn zurückschickt).
    expect((await upsert({ ...malinSieht, titel: 'von Malin' })).status).toBe(200);
    // Kevin mit dem Stand von vorher.
    const k = await upsert({ ...kevinSieht, betrag: 350 }, kevinSieht.fassung);
    expect(k.status).toBe(409);
    const konflikte = k.d.konflikte as { id: string; grund: string; aktuell: R }[];
    expect(konflikte[0]).toMatchObject({ id: 'r-zwei', grund: 'inzwischen geändert' });
    expect(konflikte[0].aktuell).toMatchObject({ titel: 'von Malin', betrag: 300 });
    // Die 409-Antwort trägt den ganzen aktuellen Stand zum Neuladen.
    expect((k.d.stand as unknown as Plan).rechnungen.find(r => r.id === 'r-zwei')).toMatchObject({ titel: 'von Malin' });
    expect(await rechnung('r-zwei')).toMatchObject({ titel: 'von Malin', betrag: 300 });
    // Mit dem neuen Stand geht es.
    const frisch = await rechnung('r-zwei');
    expect((await upsert({ ...frisch, betrag: 350 }, frisch.fassung)).status).toBe(200);
  });

  it('Löschen mit veraltetem Stand → 409; Firma mit Fassung (Datum `stand` stört nicht)', async () => {
    const alt = await rechnung('r-zwei');
    await upsert({ ...alt, titel: 'noch einmal geändert' });
    expect((await patch({ ops: [{ liste: 'rechnungen', op: 'delete', id: 'r-zwei', stand: alt.fassung }] })).status).toBe(409);
    expect(await rechnung('r-zwei')).toBeTruthy();
    const f = (await lade()).firmen[0];
    expect((await patch({ ops: [{ liste: 'firmen', op: 'upsert', eintrag: { ...f, bank: 'Neue Bank' } }] })).status).toBe(200);
    expect((await patch({ ops: [{ liste: 'firmen', op: 'upsert', eintrag: { ...f, bank: 'Dritte Bank' } }] })).status).toBe(409);
    expect((await lade()).firmen[0].bank).toBe('Neue Bank');
  });

  it('ohne Stand (ZOE, Importe, alte Fenster) wie bisher', async () => {
    const { fassung: _f, ...ohne } = await rechnung('r-zwei');
    expect((await upsert({ ...ohne, titel: 'ohne Stand' })).status).toBe(200);
  });
});

describe('Browser-Seite: Stand aus dem letzten Serverstand (hooks/useSpeichern)', () => {
  it('eine alte Fassung in der Sicht zählt nicht als Änderung; Löschungen tragen den Stand der Basis', async () => {
    const { standAusBasis, loeschStand } = await import('@/hooks/useSpeichern');
    const { aenderungen } = await import('@/lib/sync');
    const basis = { rechnungen: [{ id: 'a', betrag: 1, fassung: 'neu-a' }, { id: 'b', betrag: 2, fassung: 'neu-b' }] };
    // Sicht von vor dem letzten Speichern: a mit alter Fassung (unverändert), b geändert mit alter Fassung.
    const sicht = { rechnungen: [{ id: 'a', betrag: 1, fassung: 'alt-a' }, { id: 'b', betrag: 3, fassung: 'alt-b' }] };
    const a = aenderungen(basis, standAusBasis(basis, sicht, ['rechnungen'], 'fassung'), ['rechnungen']);
    expect(a.ops).toHaveLength(1);
    expect(a.ops[0]).toMatchObject({ op: 'upsert', eintrag: { id: 'b', betrag: 3, fassung: 'neu-b' } });
    const weg = loeschStand(aenderungen(basis, { rechnungen: [basis.rechnungen[0]] }, ['rechnungen']), basis, ['rechnungen'], 'fassung');
    expect(weg.ops[0]).toMatchObject({ op: 'delete', id: 'b', stand: 'neu-b' });
  });
});
