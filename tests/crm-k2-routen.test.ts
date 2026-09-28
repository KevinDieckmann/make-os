// ─── Paket K2 (28.09.) — Routen: Import-Vorschau, Sperrliste, Import-Lauf rückgängig, Kartei-Schreibweg, Suche ──
// Eigener Datenordner, erfundene Konten und Daten (@example.invalid) — nie der echte Bestand.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-k2-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-k2';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

type Handler = (r: Request) => Promise<Response>;
type Route = { GET?: Handler; POST?: Handler; PATCH?: Handler };
type Kontakt = import('@/lib/make-one/crm').Kontakt;
const HAUS = 'k2-haus';
const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
const anfrage = (pfad: string, person: string, method = 'GET', body?: unknown) => new Request(`http://test${pfad}`, { method, headers: sitzung(person), ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied') => ({ id, speicher, email: `${speicher}@example.invalid`, name: speicher, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: HAUS });

let db: typeof import('@/lib/store/local-db');
let importRoute: Route, kontakteRoute: Route, sucheRoute: Route;
const kontakte = async () => ((await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? []);
const finde = async (vorname: string) => (await kontakte()).find(k => k.vorname === vorname);
const imp = async (body: Record<string, unknown>) => { const r = await importRoute.POST!(anfrage('/api/crm/import', 'kevin', 'POST', body)); return { status: r.status, d: await r.json() }; };
const patch = async (ops: unknown[], person = 'malin') => { const r = await kontakteRoute.PATCH!(anfrage('/api/state/kontakte', person, 'PATCH', { ops })); return { status: r.status, d: await r.json() }; };
const sperrlisteText = () => readFileSync(path.join(ordner, `crm-sperrliste--${HAUS}.json`), 'utf8');

const KOPF = 'VORNAME;NACHNAME;EMAIL;FIRMA;QUELLE;HUBSPOT_ID;PLZ;LETZTER_KONTAKT';
const csv = (zeilen: string[]) => [KOPF, ...zeilen].join('\n');

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'inhaber'), konto('k2', 'malin', 'mitglied')], einladungen: [] });
  const { ausZeile } = await import('@/lib/make-one/crm');
  // Bestand: Anna (aus einer früheren Liste), Bert (mit Werbesperre).
  const anna = ausZeile({ VORNAME: 'Anna', NACHNAME: 'Beispiel', EMAIL: 'anna@example.invalid', FIRMA: 'Testfirma GmbH', QUELLE: 'Liste' }, '2026-09-01');
  const bert = { ...ausZeile({ VORNAME: 'Bert', NACHNAME: 'Probe', EMAIL: 'bert@example.invalid', FIRMA: 'Musterwerk AG', QUELLE: 'Liste' }, '2026-09-01'), werbesperre: { seit: '2026-09-10', grund: 'Widerspruch' } };
  await db.saveJson('kontakte', { kontakte: [anna, bert] });
  await db.saveJson('crm', (await import('@/lib/crm/speicher')).leererBestand());
  importRoute = (await import('@/app/api/crm/import/route')) as unknown as Route;
  kontakteRoute = (await import('@/app/api/state/kontakte/route')) as Route;
  sucheRoute = (await import('@/app/api/crm/suche/route')) as Route;
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Import-Vorschau prüft (#21–#23) und zählt Gesperrte (#60)', () => {
  it('meldet E+, PLZ, Datum, Spaltenzahl — und „gesperrt übersprungen“ (Werbesperre wird vorher nachgetragen)', async () => {
    // Bert ist gesperrt UND inzwischen gelöscht: vorher legte ein Import ihn ungesperrt neu an.
    const bert = (await finde('Bert'))!;
    const { personEntfernen } = await import('@/lib/crm/person-bestaende');
    await personEntfernen(bert.id);
    expect(await finde('Bert')).toBeUndefined();
    const liste = csv([
      'Bert;Probe;bert@example.invalid;Musterwerk AG;Liste;;;',
      'Carla;Neu;carla@example.invalid;Neufirma GmbH;Liste;1,23457E+11;1067;31.02.2026',
      'Dora;Verrutscht;dora@example.invalid;X;Liste;;;;zu viel',
    ]);
    const { status, d } = await imp({ csv: liste, name: 'liste.csv', vorschau: true });
    expect(status).toBe(200);
    expect(d).toMatchObject({ gesperrt: 1, neu: 2, pruefung: { spalten: 1, excel_zahl: 1, plz_null: 1, datum: 1 } });
    expect(await finde('Carla')).toBeUndefined();   // Vorschau schreibt nichts
    // Die Sperrliste trägt nur Hashes.
    expect(sperrlisteText()).not.toMatch(/bert|probe|musterwerk|example/i);
  });

  it('Schreiben: der Gesperrte wird nicht angelegt, Carla schon — mit Herkunft (Art. 14) und verworfenem Datum', async () => {
    const liste = csv(['Bert;Probe;bert@example.invalid;Musterwerk AG;Liste;;;', 'Carla;Neu;carla@example.invalid;Neufirma GmbH;Liste;;;31.02.2026']);
    const { status, d } = await imp({ csv: liste, name: 'liste.csv' });
    expect(status).toBe(200);
    expect(d).toMatchObject({ neu: 1, gesperrt: 1 });
    expect(d.laufId).toMatch(/^imp-/);
    expect(await finde('Bert')).toBeUndefined();
    const carla = (await finde('Carla'))!;
    expect(carla).toMatchObject({ herkunft: 'recherche', fremddaten: true });
    expect(carla.letzterKontakt).toBeUndefined();
  });
});

describe('Import-Lauf rückgängig (#25)', () => {
  let laufId = '';
  it('jeder schreibende Import ist ein Lauf; Vorher-Stand liegt verschlüsselt im Haushalts-Speicher', async () => {
    const liste = csv(['Anna;Beispiel;anna@example.invalid;Testfirma GmbH;Liste;4711;;', 'Emil;Frisch;emil@example.invalid;Frischfirma AG;Liste;;;']);
    const { d } = await imp({ csv: liste, name: 'zweite.csv' });
    laufId = d.laufId;
    expect(d).toMatchObject({ neu: 1, aktualisiert: 1 });
    expect((await finde('Anna'))!.hubspotId).toBe('4711');
    expect(readdirSync(ordner)).toContain(`crm-import-laeufe--${HAUS}.json`);
    const g = await (await importRoute.GET!(anfrage('/api/crm/import', 'kevin'))).json();
    expect(g.laeufe[0]).toMatchObject({ id: laufId, neu: 1, geaendert: 1 });
  });

  it('von Hand geändert → Konflikt, nichts überschrieben; der Rest geht zurück', async () => {
    const emil = (await finde('Emil'))!;
    const r = await patch([{ op: 'teil', id: emil.id, felder: { notiz: 'Malin hat angerufen' } }]);
    expect(r.status).toBe(200);
    const { status, d } = await imp({ aktion: 'rueckgaengig', laufId });
    expect(status).toBe(200);
    expect(d.zurueck).toBe(1);
    expect(d.konflikte).toEqual([{ id: emil.id, grund: 'seitdem geändert' }]);
    expect((await finde('Anna'))!.hubspotId).toBeUndefined();   // Vorher-Stand zurück
    expect((await finde('Emil'))!.notiz).toBe('Malin hat angerufen');  // bleibt
    expect((await imp({ aktion: 'rueckgaengig', laufId })).status).toBe(409);
  });

  it('ein unveränderter neuer Kontakt fällt wieder weg', async () => {
    const { d } = await imp({ csv: csv(['Fritz;Frei;fritz@example.invalid;Freifirma GmbH;Liste;;;']), name: 'dritte.csv' });
    expect(await finde('Fritz')).toBeDefined();
    const r = await imp({ aktion: 'rueckgaengig', laufId: d.laufId });
    expect(r.d).toMatchObject({ zurueck: 1, konflikte: [] });
    expect(await finde('Fritz')).toBeUndefined();
  });
});

describe('Kartei-Schreibweg (#68, nie abschneiden, #64)', () => {
  it('700 Aktivitäten überleben ein Speichern (vorher: auf 600 gekürzt); über 10.000 → 413', async () => {
    const anna = (await finde('Anna'))!;
    const aktivitaeten = Array.from({ length: 700 }, (_, i) => ({ am: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(), art: 'notiz', text: `N${i}`, von: 'malin' }));
    await db.updateJson<{ kontakte: Kontakt[] }>('kontakte', cur => ({ kontakte: cur!.kontakte.map(k => (k.id === anna.id ? { ...k, aktivitaeten } as Kontakt : k)) }));
    expect((await patch([{ op: 'teil', id: anna.id, felder: { notiz: 'kurz' } }])).status).toBe(200);
    expect((await finde('Anna'))!.aktivitaeten).toHaveLength(700);
    const zuViel = Array.from({ length: 10_001 }, (_, i) => ({ am: `2026-01-01T00:00:00.${i}Z`, art: 'notiz', von: 'malin' }));
    expect((await patch([{ op: 'teil', id: anna.id, felder: { aktivitaeten: zuViel } }])).status).toBe(413);
    expect((await finde('Anna'))!.aktivitaeten).toHaveLength(700);
  });

  it('geaendertAm/importiertAm/vonHand aus dem Browser zählen nicht', async () => {
    const anna = (await finde('Anna'))!;
    const r = await patch([{ op: 'teil', id: anna.id, felder: { aufhaenger: 'Hand', geaendertAm: '2099-12-31', importiertAm: '2000-01-01', vonHand: ['email', 'firma'] } }]);
    expect(r.status).toBe(200);
    const nach = (await finde('Anna'))!;
    expect(nach.geaendertAm).not.toBe('2099-12-31');
    expect(nach.importiertAm).toBe(anna.importiertAm);
    expect(nach.vonHand).toContain('aufhaenger');
    expect(nach.vonHand).not.toContain('email');
  });

  it('Werbesperre: setzen → Sperrliste; aufheben ohne Nachweis abgelehnt; mit Nachweis → aufgehoben, System-Aktivität, Liste leer', async () => {
    const carla = (await finde('Carla'))!;
    expect((await patch([{ op: 'teil', id: carla.id, felder: { werbesperre: { seit: '2026-09-28', grund: 'Widerspruch' } } }])).status).toBe(200);
    const vorher = JSON.parse(sperrlisteText()).eintraege.length;
    expect(sperrlisteText()).not.toMatch(/carla|neufirma/i);
    // ohne Nachweis: abgelehnt, bleibt gesperrt
    expect((await patch([{ op: 'teil', id: carla.id, felder: { werbesperre: null } }])).status).toBe(409);
    expect((await finde('Carla'))!.werbesperre).toBeDefined();
    // ein ganzer Eintrag ohne Sperre hebt auch nicht auf (Sperre gewinnt)
    const ganz = { ...(await finde('Carla'))! };
    delete ganz.werbesperre;
    expect((await patch([{ op: 'upsert', eintrag: ganz }])).status).toBe(200);
    expect((await finde('Carla'))!.werbesperre).toBeDefined();
    // mit Nachweis im selben Schritt
    const ew = { kanal: 'mail', grundlage: 'einwilligung', erteiltAm: '2026-09-28', nachweis: 'DOI-Bestätigung vom 28.09.', wortlaut: 'Ja, ich möchte wieder Post bekommen.', belegRef: 'DOI-Mail vom 28.09.' };
    expect((await patch([{ op: 'teil', id: carla.id, felder: { werbesperre: null, einwilligungen: [ew] } }])).status).toBe(200);
    const nach = (await finde('Carla'))!;
    expect(nach.werbesperre).toBeUndefined();
    expect(nach.aktivitaeten.at(-1)).toMatchObject({ art: 'system', von: 'malin' });
    expect(nach.aktivitaeten.at(-1)?.text).toContain('DOI-Bestätigung');
    expect(JSON.parse(sperrlisteText()).eintraege.length).toBe(vorher - 1);
  });
});

describe('Suche (#105/#106)', () => {
  const suche = async (q: string) => ((await (await sucheRoute.GET!(anfrage(`/api/crm/suche?q=${encodeURIComponent(q)}`, 'kevin'))).json()).treffer ?? []) as { titel: string }[];
  it('„mueller“ findet eine NFD-Müller; eine Änderung ist sofort sichtbar (Zwischenstand hängt am Speicherstand)', async () => {
    expect(await suche('mueller')).toEqual([]);
    const { ausZeile } = await import('@/lib/make-one/crm');
    const m = ausZeile({ VORNAME: 'Jörg'.normalize('NFD'), NACHNAME: 'Müller'.normalize('NFD'), EMAIL: 'joerg@example.invalid' }, '2026-09-28');
    await db.updateJson<{ kontakte: Kontakt[] }>('kontakte', cur => ({ kontakte: [...(cur?.kontakte ?? []), { ...m, vorname: 'Jörg'.normalize('NFD'), nachname: 'Müller'.normalize('NFD') }] }));
    const t = await suche('mueller');
    expect(t.map(x => x.titel.normalize('NFC'))).toContain('Jörg Müller');
    expect((await suche('müller')).length).toBe(1);
  });
});
