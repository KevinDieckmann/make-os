// ─── Paket H4 (28.09.) — Routen: Notizen ändern/löschen, Meeting-Zeitpunkt, IBAN nur maskiert ──
// Eigener Datenordner, Dienstaufruf per Schlüssel — nie der echte Bestand. Alle Daten erfunden;
// die IBAN wird zur Laufzeit aus einer erfundenen Kontonummer gerechnet (tests/repo-sauber.test.ts).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Kontakt, Aktivitaet } from '@/lib/make-one/crm';
import type { Firma } from '@/lib/crm/typen';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-h4-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-28-09-h4';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

const mod97 = (ziffern: string) => Array.from(ziffern).reduce((r, z) => (r * 10 + Number(z)) % 97, 0);
const mitPruefziffer = (bban: string) => `DE${String(98 - mod97(`${bban}131400`)).padStart(2, '0')}${bban}`;
const IBAN = mitPruefziffer('120300009876543210');
const IBAN_NEU = mitPruefziffer('500105170123456789');
const MASKE = (i: string) => `${i.slice(0, 4)} •••• •••• ${i.slice(-4)}`;

const H = new Date().toISOString().slice(0, 10);
const kopf = (person: string | null = 'kevin') => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, ...(person ? { 'x-make-person': person } : {}) });
const req = (url: string, body?: unknown, method = 'POST', person: string | null = 'kevin') => new Request(`http://test${url}`, { method, headers: kopf(person), ...(body ? { body: JSON.stringify(body) } : {}) });

type Route = { GET?: (r: Request) => Promise<Response>; POST?: (r: Request) => Promise<Response>; PATCH?: (r: Request) => Promise<Response> };
let akt: Route, kontakte: Route, bestand: Route, datenschutz: Route;
let db: typeof import('@/lib/store/local-db');
let speicher: typeof import('@/lib/crm/speicher');
let aktLib: typeof import('@/lib/crm/aktivitaeten');

const NOTIZ_K: Aktivitaet = { am: '2026-09-20T08:00:00.000Z', art: 'notiz', text: 'Erste Fassung', von: 'kevin' };
const NOTIZ_M: Aktivitaet = { am: '2026-09-21T08:00:00.000Z', art: 'notiz', text: 'Von Malin', von: 'malin' };
const NOTIZ_2: Aktivitaet = { am: '2026-09-22T08:00:00.000Z', art: 'notiz', text: 'Zum Löschen', von: 'kevin' };
const ANRUF: Aktivitaet = { am: '2026-09-23T08:00:00.000Z', art: 'anruf', text: 'Kurz gesprochen', von: 'kevin', ergebnis: 'gespraech' };
const person = (id: string, x: Partial<Kontakt> = {}) => ({ id, vorname: 'Anna', nachname: 'Beispiel', eignung: '', prio: '', stufe: 'gespraech', aktivitaeten: [], importiertAm: H, geaendertAm: H, ...x });

async function ladeKontakte(personId = 'kevin'): Promise<(Kontakt & { stand: string })[]> {
  const r = await kontakte.GET!(req('/api/state/kontakte?voll=1', undefined, 'GET', personId));
  return ((await r.json()) as { kontakte: (Kontakt & { stand: string })[] }).kontakte;
}
const gespeichert = async (id: string) => ((await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? []).find(k => k.id === id)!;
const anker = (k: Kontakt, text: string) => aktLib.ankerListe(k.aktivitaeten)[k.aktivitaeten.findIndex(a => a.text === text)];

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  speicher = await import('@/lib/crm/speicher');
  aktLib = await import('@/lib/crm/aktivitaeten');
  akt = (await import('@/app/api/crm/aktivitaet/route')) as unknown as Route;
  kontakte = (await import('@/app/api/state/kontakte/route')) as unknown as Route;
  bestand = (await import('@/app/api/crm/bestand/route')) as unknown as Route;
  datenschutz = (await import('@/app/api/crm/datenschutz/route')) as unknown as Route;
  // Kartei nur für den Haushalt des Inhabers (28.09., K1 #66/#67): erfundene Konten im selben Haushalt.
  await db.saveJson('konten', { konten: [
    { id: 'k1', speicher: 'kevin', email: 'k@test.invalid', name: 'Kevin Test', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'test-haus' },
    { id: 'k2', speicher: 'malin', email: 'm@test.invalid', name: 'Malin Test', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'test-haus' },
  ], einladungen: [] });
  await db.saveJson('kontakte', { kontakte: [
    person('c-anna', { aktivitaeten: [NOTIZ_K, NOTIZ_M, NOTIZ_2, ANRUF], zahlung: { weg: 'sepa', iban: IBAN } }),
    person('c-bert', { vorname: 'Bert', firmaId: 'f-werke' }),
  ] });
  const f: Firma = { id: 'f-werke', name: 'Beispiel Werke GmbH', rolle: 'kunde', zahlung: { weg: 'ueberweisung', iban: IBAN }, geaendert: H };
  await db.saveJson('crm', { ...speicher.leererBestand(), firmen: [f] });
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Eigene Notizen ändern und löschen (POST /api/crm/aktivitaet, aktion)', () => {
  let vorher: Kontakt & { stand: string };

  it('ändern: eigene Notiz, aktueller Stand → neuer Text, Löschmarke für die alte Fassung, Antwort mit Stand', async () => {
    vorher = (await ladeKontakte()).find(k => k.id === 'c-anna')!;
    const r = await akt.POST!(req('/api/crm/aktivitaet', { aktion: 'aendern', id: 'c-anna', anker: anker(vorher, 'Erste Fassung'), stand: vorher.stand, text: 'Zweite Fassung' }));
    expect(r.status).toBe(200);
    const b = (await r.json()) as { ok: boolean; kontakt: Kontakt & { stand: string } };
    expect(b.kontakt.stand).toMatch(/\S/);
    expect(b.kontakt.stand).not.toBe(vorher.stand);
    const k = await gespeichert('c-anna');
    expect(k.aktivitaeten.filter(a => a.art === 'notiz' && a.von === 'kevin').map(a => a.text)).toEqual(['Zweite Fassung', 'Zum Löschen']);
    expect(k.aktivitaeten.find(a => a.text === 'Zweite Fassung')?.bearbeitet).toMatch(/Z$/);
    expect(k.geloeschteAktivitaeten).toHaveLength(1);
  });

  it('veralteter Stand → 409 mit dem aktuellen Kontakt, nichts geändert', async () => {
    const r = await akt.POST!(req('/api/crm/aktivitaet', { aktion: 'loeschen', id: 'c-anna', anker: anker(vorher, 'Zum Löschen'), stand: vorher.stand }));
    expect(r.status).toBe(409);
    const b = (await r.json()) as { ok: boolean; konflikt: boolean; kontakt: Kontakt };
    expect(b).toMatchObject({ ok: false, konflikt: true });
    expect(b.kontakt.aktivitaeten.some(a => a.text === 'Zweite Fassung')).toBe(true);
    expect((await gespeichert('c-anna')).aktivitaeten.some(a => a.text === 'Zum Löschen')).toBe(true);
  });

  it('fremde Notiz → 403 (auch als Malin an Kevins Notiz); kein Stand → 400; ohne Person → 403', async () => {
    const jetzt = (await ladeKontakte()).find(k => k.id === 'c-anna')!;
    const fremd = await akt.POST!(req('/api/crm/aktivitaet', { aktion: 'aendern', id: 'c-anna', anker: anker(jetzt, 'Von Malin'), stand: jetzt.stand, text: 'übernommen' }));
    expect(fremd.status).toBe(403);
    const alsMalin = await akt.POST!(req('/api/crm/aktivitaet', { aktion: 'loeschen', id: 'c-anna', anker: anker(jetzt, 'Zum Löschen'), stand: jetzt.stand }, 'POST', 'malin'));
    expect(alsMalin.status).toBe(403);
    const anruf = await akt.POST!(req('/api/crm/aktivitaet', { aktion: 'loeschen', id: 'c-anna', anker: anker(jetzt, 'Kurz gesprochen'), stand: jetzt.stand }));
    expect(anruf.status).toBe(403);
    const ohneStand = await akt.POST!(req('/api/crm/aktivitaet', { aktion: 'loeschen', id: 'c-anna', anker: anker(jetzt, 'Zum Löschen') }));
    expect(ohneStand.status).toBe(400);
    const ohnePerson = await akt.POST!(req('/api/crm/aktivitaet', { aktion: 'loeschen', id: 'c-anna', anker: anker(jetzt, 'Zum Löschen'), stand: jetzt.stand }, 'POST', null));
    expect(ohnePerson.status).toBe(403);
    const k = await gespeichert('c-anna');
    expect(k.aktivitaeten.map(a => a.text)).toEqual(['Zweite Fassung', 'Von Malin', 'Zum Löschen', 'Kurz gesprochen']);
  });

  it('löschen: eigene Notiz weg, Löschmarke gesetzt', async () => {
    const jetzt = (await ladeKontakte()).find(k => k.id === 'c-anna')!;
    const r = await akt.POST!(req('/api/crm/aktivitaet', { aktion: 'loeschen', id: 'c-anna', anker: anker(jetzt, 'Zum Löschen'), stand: jetzt.stand }));
    expect(r.status).toBe(200);
    const k = await gespeichert('c-anna');
    expect(k.aktivitaeten.some(a => a.text === 'Zum Löschen')).toBe(false);
    expect(k.geloeschteAktivitaeten).toHaveLength(2);
  });

  it('keine Wiederauferstehung: ganzer Eintrag ohne Stand (altes Fenster, ZOE) holt nichts zurück und verdoppelt nichts', async () => {
    // `vorher` ist der Stand von VOR Ändern und Löschen — genau das, was ein altes Fenster noch hat.
    const { stand: _s, ...alt } = vorher;
    const r = await kontakte.PATCH!(req('/api/state/kontakte', { ops: [{ op: 'upsert', eintrag: { ...alt, notiz: 'Team-Notiz aus altem Fenster' } }] }, 'PATCH'));
    expect(r.status).toBe(200);
    const k = await gespeichert('c-anna');
    expect(k.notiz).toBe('Team-Notiz aus altem Fenster');
    expect(k.aktivitaeten.map(a => a.text)).toEqual(['Zweite Fassung', 'Von Malin', 'Kurz gesprochen']);
    // Der Browser kann Marken weder setzen noch löschen.
    expect(k.geloeschteAktivitaeten).toHaveLength(2);
  });

  it('auch nicht über `teil` mit dem alten Verlauf', async () => {
    const r = await kontakte.PATCH!(req('/api/state/kontakte', { ops: [{ op: 'teil', id: 'c-anna', felder: { aktivitaeten: vorher.aktivitaeten, geloeschteAktivitaeten: [] } }] }, 'PATCH'));
    expect(r.status).toBe(200);
    const k = await gespeichert('c-anna');
    expect(k.aktivitaeten.map(a => a.text)).toEqual(['Zweite Fassung', 'Von Malin', 'Kurz gesprochen']);
    expect(k.geloeschteAktivitaeten).toHaveLength(2);
  });
});

describe('Meeting-Zeitpunkt als Feld (wann, ort)', () => {
  it('„+ Meeting“ schreibt wann/ort; der Text ist nur die Notiz; Kommend und Sortierung nach wann', async () => {
    const r = await akt.POST!(req('/api/crm/aktivitaet', { id: 'c-anna', art: 'termin', wann: '2099-10-02T14:00', ort: '  Büro\n  Hamburg ', text: 'Diagnose besprechen' }));
    expect(r.status).toBe(200);
    const k = await gespeichert('c-anna');
    const m = k.aktivitaeten.find(a => a.art === 'termin')!;
    expect(m).toMatchObject({ wann: '2099-10-02T14:00', text: 'Diagnose besprechen' });
    expect(m.ort).toBe('Büro Hamburg');
    const e = aktLib.aufbereiten(k, null, { heute: H, jetzt: new Date().toISOString() }).find(x => x.art === 'termin')!;
    expect(e).toMatchObject({ kommend: true, tag: '2099-10-02', zeit: '14:00', text: 'Diagnose besprechen', ort: 'Büro Hamburg' });
  });
  it('ungültiges wann fällt weg (kein Fantasiedatum)', async () => {
    await akt.POST!(req('/api/crm/aktivitaet', { id: 'c-bert', art: 'termin', wann: 'morgen früh', text: 'x' }));
    const m = (await gespeichert('c-bert')).aktivitaeten.find(a => a.art === 'termin')!;
    expect(m.wann).toBeUndefined();
  });
});

describe('IBAN nur maskiert an den Browser', () => {
  it('Kartei: IBAN maskiert + ibanGesetzt, nirgends im Klartext', async () => {
    const r = await kontakte.GET!(req('/api/state/kontakte?voll=1', undefined, 'GET'));
    const text = await r.text();
    expect(text).not.toContain(IBAN);
    const anna = (JSON.parse(text) as { kontakte: Kontakt[] }).kontakte.find(k => k.id === 'c-anna')!;
    expect(anna.zahlung).toMatchObject({ iban: MASKE(IBAN), ibanGesetzt: true, weg: 'sepa' });
    // Auch die Antwort der Aktivitäts-Route.
    const a = await akt.POST!(req('/api/crm/aktivitaet', { id: 'c-anna', art: 'notiz', text: 'Hallo' }));
    expect(await a.text()).not.toContain(IBAN);
  });
  it('Speichern: maskiert oder leer = unverändert; neue gültige ersetzt; Entfernen nur ausdrücklich', async () => {
    const teil = (zahlung: Record<string, unknown>) => kontakte.PATCH!(req('/api/state/kontakte', { ops: [{ op: 'teil', id: 'c-anna', felder: { zahlung } }] }, 'PATCH'));
    await teil({ weg: 'ueberweisung', iban: MASKE(IBAN), ibanGesetzt: true });
    expect((await gespeichert('c-anna')).zahlung).toEqual({ weg: 'ueberweisung', iban: IBAN });
    await teil({ weg: 'ueberweisung', zielTage: 14 });
    expect((await gespeichert('c-anna')).zahlung?.iban).toBe(IBAN);
    await teil({ weg: 'ueberweisung', iban: 'DE00 kaputt' });
    expect((await gespeichert('c-anna')).zahlung?.iban).toBe(IBAN);
    await teil({ weg: 'ueberweisung', iban: IBAN_NEU });
    expect((await gespeichert('c-anna')).zahlung?.iban).toBe(IBAN_NEU);
    // Ganzer Eintrag (Kartei) mit maskierter IBAN: bleibt.
    const k = (await ladeKontakte()).find(x => x.id === 'c-anna')!;
    await kontakte.PATCH!(req('/api/state/kontakte', { ops: [{ op: 'upsert', eintrag: k, stand: k.stand }] }, 'PATCH'));
    expect((await gespeichert('c-anna')).zahlung?.iban).toBe(IBAN_NEU);
    await teil({ weg: 'ueberweisung', ibanEntfernen: true });
    const z = (await gespeichert('c-anna')).zahlung;
    expect(z?.iban).toBeUndefined();
    expect(z).not.toHaveProperty('ibanEntfernen');
    await teil({ weg: 'sepa', iban: IBAN });
  });
  it('Bestand: Firmen-IBAN maskiert; teil/upsert mit Maske behalten sie, ibanEntfernen nimmt sie', async () => {
    const r = await bestand.GET!(req('/api/crm/bestand', undefined, 'GET'));
    const text = await r.text();
    expect(text).not.toContain(IBAN);
    const f = (JSON.parse(text) as { stand: { firmen: Firma[] } }).stand.firmen[0];
    expect(f.zahlung).toMatchObject({ iban: MASKE(IBAN), ibanGesetzt: true });
    const patch = (ops: unknown[]) => bestand.PATCH!(req('/api/crm/bestand', { ops }, 'PATCH'));
    const p1 = await patch([{ liste: 'firmen', op: 'teil', id: 'f-werke', felder: { zahlung: { ...f.zahlung, zielTage: 30 } } }]);
    expect(await p1.text()).not.toContain(IBAN);
    expect((await speicher.ladeCrm()).firmen[0].zahlung).toMatchObject({ iban: IBAN, zielTage: 30 });
    await patch([{ liste: 'firmen', op: 'upsert', eintrag: { ...f, notiz: 'neu' } }]);
    expect((await speicher.ladeCrm()).firmen[0]).toMatchObject({ notiz: 'neu', zahlung: { iban: IBAN } });
    await patch([{ liste: 'firmen', op: 'teil', id: 'f-werke', felder: { zahlung: { weg: 'ueberweisung', ibanEntfernen: true } } }]);
    expect((await speicher.ladeCrm()).firmen[0].zahlung?.iban).toBeUndefined();
    await patch([{ liste: 'firmen', op: 'teil', id: 'f-werke', felder: { zahlung: { weg: 'ueberweisung', iban: IBAN } } }]);
  });
  it('Auskunft nach Art. 15: die IBAN der Person voll, die der Firma maskiert', async () => {
    const r = await datenschutz.GET!(req('/api/crm/datenschutz?id=c-anna', undefined, 'GET'));
    const a = (await r.json()) as { person: Kontakt };
    expect(a.person.zahlung?.iban).toBe(IBAN);
    const r2 = await datenschutz.GET!(req('/api/crm/datenschutz?id=c-bert', undefined, 'GET'));
    const t2 = await r2.text();
    expect(t2).not.toContain(IBAN);
    expect((JSON.parse(t2) as { firma: Firma }).firma.zahlung?.iban).toBe(MASKE(IBAN));
  });
});
