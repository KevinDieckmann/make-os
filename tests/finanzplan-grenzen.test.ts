// ─── Finanzplan: nie still kürzen, „bezahlt“ + Buchung in einem Schritt (28.09.) ──
// Prüfbericht 28.09.: Die Säuberung schnitt Rechnungen bei 200 ab, der PATCH ging
// davon aus — jede 201. Rechnung verschwand beim nächsten Speichern. Und „bezahlt“
// schickte die Buchung als zweiten Aufruf hinterher, der still verloren gehen konnte.
// Eigener Datenordner, Dienstaufruf mit Schlüssel + Person. Erfundene Zahlen.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-fp-grenzen-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-fpg';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

const kopf = { 'content-type': 'application/json', 'x-make-key': 'pruef-schluessel-fpg', 'x-make-person': 'kevin' };
const req = (body?: unknown, method = 'GET') =>
  new Request('http://test/api/state/finanzplan', { method, headers: kopf, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });

type Mod = { GET: (r: Request) => Promise<Response>; PATCH: (r: Request) => Promise<Response>; PUT: (r: Request) => Promise<Response> };
type Plan = { rechnungen: { id: string; status: string; bezahltAm?: string; betrag: number }[]; zahlungen: unknown[]; firmen: unknown[] };
let route: Mod;
let db: typeof import('@/lib/store/local-db');

const rechnung = (i: number) => ({ id: `r-t${i}`, firmaId: 'kdc', kunde: `Kunde ${i}`, titel: `Leistung ${i}`, betrag: 100 + i, status: 'gestellt' });
const patch = async (body: unknown) => { const r = await route.PATCH(req(body, 'PATCH')); return { status: r.status, d: await r.json() as Record<string, unknown> & Plan } };
const lade = async () => (await (await route.GET(req())).json()) as Plan;
const buchungen = async () => ((await db.loadJson<{ buchungen: { id: string; betrag: number; rechnungId?: string; datum: string }[] }>('buchungen'))?.buchungen ?? []);

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [
    { id: 'k1', speicher: 'kevin', email: 'k@test', name: 'Kevin Test', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'test-fpg' },
  ], einladungen: [] });
  route = (await import('@/app/api/state/finanzplan/route')) as unknown as Mod;
  await lade(); // Startbestand anlegen
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Finanzplan kürzt nie still', () => {
  it('250 Rechnungen überleben einen PATCH (vorher: nach 200 abgeschnitten)', async () => {
    const vorher = await lade();
    const ops = Array.from({ length: 250 }, (_, i) => ({ liste: 'rechnungen', op: 'upsert', eintrag: rechnung(i) }));
    const a = await patch({ ops });
    expect(a.status).toBe(200);
    expect(a.d.angewandt).toBe(250);
    expect((await lade()).rechnungen.length).toBe(vorher.rechnungen.length + 250);
    // Ein weiterer, kleiner PATCH (eine Zahlung) lässt alle Rechnungen stehen.
    const b = await patch({ ops: [{ liste: 'zahlungen', op: 'upsert', eintrag: { id: 'z-t1', firmaId: 'kdc', an: 'Vermieter', titel: 'Miete', betrag: 10, status: 'offen' } }] });
    expect(b.status).toBe(200);
    const nachher = await lade();
    expect(nachher.rechnungen.length).toBe(vorher.rechnungen.length + 250);
    expect(nachher.rechnungen.find(r => r.id === 'r-t249')).toBeTruthy();
  });

  it('über der Grenze: 413 mit Text, der Bestand bleibt unverändert', async () => {
    const vorher = await lade();
    const ops = Array.from({ length: 51 }, (_, i) => ({ liste: 'firmen', op: 'upsert', eintrag: { id: `f-t${i}`, name: `Firma ${i}`, bank: 'Testbank', kontostand: null, stand: null } }));
    const a = await patch({ ops });
    expect(a.status).toBe(413);
    expect(String(a.d.error)).toMatch(/höchstens 50 Firmen/);
    expect((await lade()).firmen.length).toBe(vorher.firmen.length);
  });

  it('mehr als 1000 Änderungen je Aufruf: 413 statt nur die ersten 100 zu nehmen', async () => {
    const ops = Array.from({ length: 1001 }, (_, i) => ({ liste: 'rechnungen', op: 'upsert', eintrag: rechnung(1000 + i) }));
    const a = await patch({ ops });
    expect(a.status).toBe(413);
  });

  it('ZOE erfasse_zahlung: hängt an; an der Grenze Ablehnung mit Text, nichts gekürzt', async () => {
    const { WERKZEUGE } = await import('@/lib/zoe/werkzeuge');
    const { GRENZEN, ueberGrenze } = await import('@/lib/finanzen/finanzplan-bestand');
    const vorher = await lade();
    // Seit 09.10. (ZOE-Schreibwege): über die Route mit der auslösenden Person, nur eine Business-Gesellschaft (die Selbstständigkeit gehört zu Privat).
    expect(await WERKZEUGE.erfasse_zahlung.lauf({ an: 'Testempfänger', betrag: 12, firma: 'kdv' }, 'http://test', 'kevin')).toMatch(/^Erfasst/);
    expect((await lade()).zahlungen.length).toBe(vorher.zahlungen.length + 1);
    // Bestand auf die Grenze füllen (Rohschreiben wie ein Altbestand) — ZOE lehnt ab, statt den PATCH später kürzen zu lassen.
    const roh = (await db.loadJson<Record<string, unknown> & { zahlungen: unknown[] }>('finanzplan'))!;
    const voll = Array.from({ length: GRENZEN.zahlungen }, (_, i) => ({ id: `z-v${i}`, firmaId: 'kdc', an: `E${i}`, titel: '', betrag: 1, status: 'offen' }));
    await db.saveJson('finanzplan', { ...roh, zahlungen: voll });
    expect(await WERKZEUGE.erfasse_zahlung.lauf({ an: 'Zuviel', betrag: 1, firma: 'kdv' }, 'http://test', 'kevin')).toMatch(/^Fehlgeschlagen: höchstens/);
    // Ein PATCH an anderer Stelle lässt alle Zahlungen stehen (vorher: auf 100 gekürzt).
    expect((await patch({ ops: [{ liste: 'rechnungen', op: 'upsert', eintrag: rechnung(999) }] })).status).toBe(200);
    expect((await lade()).zahlungen.length).toBe(GRENZEN.zahlungen);
    // Ein Bestand, der schon darüber liegt, bleibt bearbeitbar (nur Wachsen wird abgelehnt).
    expect(ueberGrenze({ produkte: new Array(GRENZEN.produkte + 4).fill({}) }, { produkte: new Array(GRENZEN.produkte + 5).fill({}) })).toBeNull();
    // Zurück auf einen kleinen Bestand für die folgenden Fälle.
    await db.saveJson('finanzplan', { ...roh });
  });
});

describe('„bezahlt“ + Buchung in einer Sperre', () => {
  it('setzt Status + Datum und legt die Buchung bu-re-<id> an — ein Aufruf', async () => {
    const a = await patch({ aktion: 'bezahlt', rechnungId: 'r-t1', am: '2026-09-20' });
    expect(a.status).toBe(200);
    expect(a.d.ok).toBe(true);
    const r = (await lade()).rechnungen.find(x => x.id === 'r-t1')!;
    expect(r).toMatchObject({ status: 'bezahlt', bezahltAm: '2026-09-20' });
    const b = (await buchungen()).filter(x => x.id === 'bu-re-r-t1');
    expect(b).toHaveLength(1);
    expect(b[0]).toMatchObject({ betrag: 101, rechnungId: 'r-t1', datum: '2026-09-20' });
  });

  it('idempotent: noch einmal → schonBezahlt, weiterhin genau eine Buchung', async () => {
    const a = await patch({ aktion: 'bezahlt', rechnungId: 'r-t1', am: '2026-09-21' });
    expect(a.status).toBe(200);
    expect(a.d.schonBezahlt).toBe(true);
    expect((await buchungen()).filter(x => x.id === 'bu-re-r-t1')).toHaveLength(1);
    expect((await lade()).rechnungen.find(x => x.id === 'r-t1')!.bezahltAm).toBe('2026-09-20');
  });

  it('heilt: Rechnung schon bezahlt, Buchung fehlt → wird angelegt', async () => {
    await patch({ ops: [{ liste: 'rechnungen', op: 'upsert', eintrag: { ...rechnung(2), status: 'bezahlt', bezahltAm: '2026-09-19' } }] });
    expect((await buchungen()).some(x => x.id === 'bu-re-r-t2')).toBe(false);
    const a = await patch({ aktion: 'bezahlt', rechnungId: 'r-t2' });
    expect(a.status).toBe(200);
    expect((await buchungen()).find(x => x.id === 'bu-re-r-t2')).toMatchObject({ datum: '2026-09-19', rechnungId: 'r-t2' });
  });

  it('unbekannte Rechnung → 404, veralteter Stand → 409 mit aktuellem Eintrag', async () => {
    expect((await patch({ aktion: 'bezahlt', rechnungId: 'gibt-es-nicht' })).status).toBe(404);
    const k = await patch({ aktion: 'bezahlt', rechnungId: 'r-t3', stand: 'veraltet' });
    expect(k.status).toBe(409);
    expect(k.d.aktuell).toMatchObject({ id: 'r-t3', status: 'gestellt' });
    expect((await lade()).rechnungen.find(x => x.id === 'r-t3')!.status).toBe('gestellt');
  });

  it('Buchung nicht schreibbar → Rechnung bleibt unverändert (kein „bezahlt“ ohne Buchung)', async () => {
    // Buchungen-Bestand beschädigen: local-db legt ihn beiseite und verweigert das Schreiben.
    writeFileSync(path.join(ordner, 'buchungen.json'), '{ kaputt', 'utf8');
    db.leseCacheLeeren();
    const a = await patch({ aktion: 'bezahlt', rechnungId: 'r-t4' });
    expect(a.status).toBe(500);
    expect((await lade()).rechnungen.find(x => x.id === 'r-t4')!.status).toBe('gestellt');
    // Aufräumen: beiseitegelegte Kopie entfernen.
    for (const f of readdirSync(ordner)) if (f.startsWith('buchungen') && f.includes('corrupt')) rmSync(path.join(ordner, f));
  });
});
