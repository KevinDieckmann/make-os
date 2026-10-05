// ─── Lese-Protokoll (05.10., Paket „Protokolle nachweisfest“) ─────────────────────────────────────────────────────
// Eigener Datenordner, erfundene Konten und Werte. Prüft: GET-Routen für Gesundheit, Finanzen, Kontakte, Firmen und das
// Gesellschafts-Register notieren wer/was/wann — ohne Inhalte, Kennungen nur als Fingerabdruck; gedrosselt; abgelehnte
// Zugriffe (403) werden nicht notiert; Aufbewahrung 12 Monate; die Ansicht sieht nur der Inhaber (nicht der Dienstweg).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-lesen-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-lesen';
process.env.MAKE_OS_PEPPER = 'test-pepper-lesen-' + 'p'.repeat(40);
delete process.env.MAKE_OS_DATEN_SCHLUESSEL; // Klartext im Test: so lässt sich die Datei roh auf Inhalte prüfen

type Handler = (r: Request) => Promise<Response>;
type Route = { GET?: Handler; POST?: Handler };
let db: typeof import('@/lib/store/local-db');
let lp: typeof import('@/lib/store/leseprotokoll');
let vitals: Route, kontakte: Route, nachweise: Route, unterlagen: Route;

const H = 'haus-lesen';
const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
const dienst = (person?: string) => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, ...(person ? { 'x-make-person': person } : {}) });
const anfrage = (pfad: string, kopf: Record<string, string>, method = 'GET', body?: unknown) => new Request(`http://test${pfad}`, { method, headers: kopf, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
const konto = (id: string, sp: string, rolle: 'inhaber' | 'mitglied', teilt: string[] = []) => ({ id, speicher: sp, email: `${sp}@test.invalid`, name: sp, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: teilt }, haushalt: H });
const roh = () => readdirSync(ordner).filter(n => n.startsWith('leseprotokoll--')).map(n => readFileSync(path.join(ordner, n), 'utf8')).join('\n');
const eintraege = async () => { await lp.leseprotokollWarten(); return lp.leseprotokollMonat(H, (await import('@/lib/store/aenderungsprotokoll')).monatBerlin()); };

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  lp = await import('@/lib/store/leseprotokoll');
  await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'inhaber'), konto('k2', 'malin', 'mitglied', ['kevin'])], einladungen: [] });
  // Ältere Monate (Altbestand ohne Kette) — liegen vor dem ersten neuen Eintrag da, wie nach dem Hochladen.
  await db.saveJson(`leseprotokoll--${H}--2025-09`, { eintraege: [{ at: '2025-09-02T10:00:00.000Z', wer: 'person', person: 'kevin', bereich: 'finanzplan' }] });
  await db.saveJson(`leseprotokoll--${H}--2025-11`, { eintraege: [{ at: '2025-11-02T10:00:00.000Z', wer: 'person', person: 'kevin', bereich: 'finanzplan' }] });
  await db.saveJson('vitals--malin', { '2026-10-01': { rec: 73.0412, note: 'GEHEIME-NOTIZ-ZUM-SCHLAF' } });
  await db.saveJson('kontakte', { kontakte: [{ id: 'c-anna-beispiel@test.invalid', vorname: 'Anna', nachname: 'Beispiel', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01' }] });
  vitals = (await import('@/app/api/state/vitals/route')) as Route;
  kontakte = (await import('@/app/api/state/kontakte/route')) as Route;
  unterlagen = (await import('@/app/api/gesellschaften/unterlagen/route')) as Route;
  nachweise = (await import('@/app/api/datenschutz/nachweise/route')) as unknown as Route;
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Lese-Protokoll ohne Inhalte', () => {
  it('Gesundheit einer anderen Person lesen: wer, Bereich, wessen Daten, Weg — nie der Wert, nie die Notiz', async () => {
    lp.leseDrosselLeeren();
    const r = await vitals.GET!(anfrage('/api/state/vitals?fuer=malin&suche=Anna', sitzung('kevin')));
    expect(r.status).toBe(200);
    const e = await eintraege();
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({ wer: 'person', person: 'kevin', bereich: 'gesundheit', betroffen: 'malin', weg: '/api/state/vitals' });
    expect(typeof (e[0] as unknown as { h?: string }).h).toBe('string'); // verkettet
    const t = roh();
    // Wert mit Punkt und Sekunden > 59: kann weder in einem Hash (hex) noch in einer Zeit („SS.mmm“) zufällig vorkommen (vorher „42“ — wackelig).
    expect(t).not.toMatch(/GEHEIME-NOTIZ|73\.0412|Anna|suche/);
  });

  it('gedrosselt: derselbe Zugriff innerhalb von 10 Minuten nur einmal; ZOE im Auftrag zählt eigen', async () => {
    await vitals.GET!(anfrage('/api/state/vitals?fuer=malin', sitzung('kevin')));
    await vitals.GET!(anfrage('/api/state/vitals?fuer=malin', dienst('kevin')));
    const e = await eintraege();
    expect(e).toHaveLength(2);
    expect(e[1]).toMatchObject({ wer: 'zoe', person: 'kevin', bereich: 'gesundheit' });
  });

  it('abgelehnter Zugriff (403) wird nicht notiert', async () => {
    lp.leseDrosselLeeren();
    const vorher = (await eintraege()).length;
    const r = await vitals.GET!(anfrage('/api/state/vitals?fuer=kevin', sitzung('malin'))); // Kevin teilt nicht mit Malin
    expect(r.status).toBe(403);
    expect(await eintraege()).toHaveLength(vorher);
  });

  it('Kontakte: die Kartei-Liste wird mit Bereich notiert, Kennungen nur als Fingerabdruck', async () => {
    await kontakte.GET!(anfrage('/api/state/kontakte', sitzung('kevin')));
    const k = (await eintraege()).filter(x => x.bereich === 'kontakte');
    expect(k).toHaveLength(1);
    expect(lp.leseKennung('c-anna-beispiel@test.invalid')).toMatch(/^c2#[0-9a-f]{16}$/);
    expect(lp.leseKennung('f-mueller-gmbh')).toMatch(/^k2#[0-9a-f]{16}$/);
    expect(lp.leseKennung('vt-abcd-1234')).toBe('vt-abcd-1234'); // Vertrags-Kennungen tragen keine Personen
    expect(roh()).not.toMatch(/anna|beispiel/i);
  });

  it('Gesellschafts-Unterlagen: Kennungen der Gesellschaft/des Vertrags stehen im Eintrag', async () => {
    await unterlagen.GET!(anfrage('/api/gesellschaften/unterlagen?id=kdc&vertrag=vt-abcd-1234', sitzung('kevin')));
    const g = (await eintraege()).filter(x => x.bereich === 'gesellschaften');
    expect(g[0]).toMatchObject({ ids: ['kdc', 'vt-abcd-1234'] });
  });

  it('Aufbewahrung 12 Monate: ältere Monate werden geleert (Vermerk bleibt), jüngere bleiben', async () => {
    const geleert = await lp.leseprotokollAufraeumen(new Date('2026-10-05T10:00:00.000Z'));
    expect(geleert).toEqual([`leseprotokoll--${H}--2025-09`]);
    expect(await db.loadJson(`leseprotokoll--${H}--2025-09`)).toMatchObject({ eintraege: [], bereinigt: { eintraege: 1 } });
    expect((await db.loadJson<{ eintraege: unknown[] }>(`leseprotokoll--${H}--2025-11`))!.eintraege).toHaveLength(1);
  });
});

describe('Ansicht System › Nachweise', () => {
  it('nur der Inhaber — nicht ein anderes Konto, nicht der Dienstweg', async () => {
    expect((await nachweise.GET!(anfrage('/api/datenschutz/nachweise', sitzung('malin')))).status).toBe(403);
    expect((await nachweise.GET!(anfrage('/api/datenschutz/nachweise', dienst()))).status).toBe(403);
    expect((await nachweise.GET!(anfrage('/api/datenschutz/nachweise', dienst('kevin')))).status).toBe(403);
  });

  it('der Inhaber sieht Zugriffe (neueste zuerst, filterbar), Kette, Verschlüsselung und die v2-Bereitschaft', async () => {
    const r = await nachweise.GET!(anfrage('/api/datenschutz/nachweise?tage=30&bereich=gesundheit', sitzung('kevin')));
    expect(r.status).toBe(200);
    const j = await r.json() as { lesen: { eintraege: { bereich: string; at: string }[] }; verschluesselung: { modus: string }; v2: { punkte: { id: string }[] } };
    expect(j.lesen.eintraege.length).toBeGreaterThan(0);
    expect(j.lesen.eintraege.every(e => e.bereich === 'gesundheit')).toBe(true);
    expect(j.lesen.eintraege[0].at >= j.lesen.eintraege[j.lesen.eintraege.length - 1].at).toBe(true);
    expect(j.v2.punkte.map(p => p.id)).toEqual(expect.arrayContaining(['modus', 'pepper', 'bilder', 'brain-index']));
    const nurFremde = await (await nachweise.GET!(anfrage('/api/datenschutz/nachweise?fremde=1', sitzung('kevin')))).json() as { lesen: { eintraege: { betroffen?: string; person?: string }[] } };
    expect(nurFremde.lesen.eintraege.every(e => e.betroffen && e.betroffen !== e.person)).toBe(true);
  });

  it('„Jetzt prüfen“ versiegelt und prüft die Kette', async () => {
    const r = await nachweise.POST!(anfrage('/api/datenschutz/nachweise', sitzung('kevin'), 'POST', { aktion: 'kette-pruefen' }));
    const j = await r.json() as { ok: boolean; kette: { ok: boolean; dateien: number } };
    expect(j.ok).toBe(true);
    expect(j.kette.ok).toBe(true);
    expect(j.kette.dateien).toBeGreaterThanOrEqual(3);
  });
});
