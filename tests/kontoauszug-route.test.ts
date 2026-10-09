// ─── Kontoauszug einlesen — Route, Übernahme, Rückgängig, Rechte, Abbruch (09.10., ONBOARDING_PLAN.md › B9 d) ──────────────────────────
// Vorschau schreibt nichts; Übernehmen nur mit der Vorschau-Kennung (409); Saldo als Stand `quelle: 'bank'` (mit Rückweg-Spiegel); Umsätze als
// Business-Buchungen (Gesellschaft, `ort`) bzw. Haushalts-Buchungen (privat, Haushalts-Konto angelegt und verknüpft); ein zweiter Import legt nichts
// doppelt an; Rückgängig nur seitdem Unverändertes (Konflikt-Liste); Saldo-Prüfung nicht stimmig → nur „trotzdem“; Wächter „Sicht Business bekommt
// nichts aus Privat“ (403), Dienstweg 403, fremder Haushalt 404; XXE 415, zu groß 413; das Lauf-Protokoll trägt keine Namen Dritter;
// Abbruch nach jedem Schritt → die Wiederaufnahme ergibt denselben Endzustand. Eigener Datenordner, erfundene Personen und Beträge.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { rmSync } from 'node:fs';

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-kontoauszug-'));
  process.env.MAKE_OS_DATEN_DIR = o;
  process.env.MAKE_OS_KEY = 'pruef-schluessel-kontoauszug';
  process.env.MAKE_OS_OHNE_APPLE = '1';
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  delete process.env.NEXT_PUBLIC_MAKE_OS_EINHEITEN;
  return o;
});

import { camt, testIban, utf8 } from './fixtures/kontoauszug';
import { bytesZuBase64 } from '@/lib/finanzen/kontoauszug/lesen';
import type { RegisterKonto } from '@/lib/finanzen/konten/register';

type Route = { GET?: (r: Request) => Promise<Response>; POST?: (r: Request) => Promise<Response> };
const anfrage = (url: string, person?: string, body?: unknown, kopf: Record<string, string> = {}) => new Request(`http://test${url}`, {
  method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(person ? { 'x-make-user': person } : {}), ...kopf }, ...(body ? { body: JSON.stringify(body) } : {}),
});
const tag = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' }); };

const IBAN_UG = testIban('37040044', '532013000');
const IBAN_PRIVAT = testIban('10010010', '123456789');
const IBAN_GEGEN = testIban('50010517', '987654321');
const NAME_DRITTER = 'Gegenseite Beispiel KG';

let db: typeof import('@/lib/store/local-db');
let konten: Route, auszug: Route;
let ugKonto = '', privatKonto = '';

const lies = async <T = Record<string, unknown>>(person: string, url: string) => { const r = await auszug.GET!(anfrage(url, person)); return { status: r.status, j: await r.json() as T }; };
const sende = async <T = Record<string, unknown>>(person: string, body: unknown, sicht?: string, kopf: Record<string, string> = {}) => {
  const r = await auszug.POST!(anfrage(`/api/finanzen/konten/auszug${sicht ? `?sicht=${sicht}` : ''}`, person, body, kopf));
  return { status: r.status, j: await r.json() as T };
};
const datei = (xml: string) => ({ inhalt: bytesZuBase64(utf8(xml)) });
const registerLaden = async () => (await db.loadJson<{ konten: RegisterKonto[] }>('konten--h-k'))!;
const businessBuchungen = async () => ((await db.loadJson<{ buchungen: { id: string; ort?: string; auszug?: string; betrag: number; wer: string; zweck?: string }[] }>('buchungen'))?.buchungen ?? []);

/** Ein Auszug für das MAKE-Konto: Gutschrift, zwei gleiche Lastschriften, eine vorgemerkte; Saldo-Prüfung stimmt. */
const ugAuszug = (iban = IBAN_UG, endeBetrag = '1093.60') => camt({
  iban, anfang: { betrag: '0.00', datum: tag(-5) }, ende: { betrag: endeBetrag, datum: tag(-1) }, posten: [
    { betrag: '1100.00', datum: tag(-4), name: NAME_DRITTER, iban: IBAN_GEGEN, zweck: ['Rechnung 1'], ref: `R1-${iban.slice(-4)}` },
    { betrag: '3.20', dbit: true, datum: tag(-2), name: 'Kaffee Beispiel', zweck: ['Kaffee'] },
    { betrag: '3.20', dbit: true, datum: tag(-2), name: 'Kaffee Beispiel', zweck: ['Kaffee'] },
    { betrag: '9.00', dbit: true, datum: tag(-1), name: 'Vorgemerkt Beispiel', status: 'PDNG' },
  ],
});

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  konten = await import('@/app/api/finanzen/konten/route') as Route;
  auszug = await import('@/app/api/finanzen/konten/auszug/route') as Route;
  await db.saveJson('konten', { konten: [
    { id: '1', speicher: 'pa', email: 'pa@example.invalid', name: 'Anna Prüf', rolle: 'inhaber', hash: 'x', salz: 'x', angelegt: '2026-09-01', haushalt: 'h-k' },
    { id: '2', speicher: 'pb', email: 'pb@example.invalid', name: 'Ben Prüf', rolle: 'mitglied', hash: 'x', salz: 'x', angelegt: '2026-09-01', haushalt: 'h-k' },
    { id: '3', speicher: 'pt', email: 'pt@example.invalid', name: 'Team Prüf', rolle: 'mitglied', hash: 'x', salz: 'x', angelegt: '2026-09-01', haushalt: 'h-k', finanzRecht: 'business' },
    { id: '4', speicher: 'px', email: 'px@example.invalid', name: 'Testkunde', rolle: 'mitglied', hash: 'x', salz: 'x', angelegt: '2026-09-01', haushalt: 'h-fremd' },
  ], einladungen: [] });
  await db.saveJson('finanzplan', { firmen: [{ id: 'ug', name: 'MAKE', bank: '', kontostand: 500, stand: tag(-30) }], rechnungen: [], zahlungen: [], merkposten: [], produkte: [], uhrwerk: { letztesMeeting: null, agenda: [] } });
  const r = await konten.POST!(anfrage('/api/finanzen/konten', 'pa', { ops: [
    { op: 'konto-neu', konto: { name: 'Geschäftskonto MAKE', art: 'giro', ort: 'ug', iban: IBAN_UG } },
    { op: 'konto-neu', konto: { name: 'Girokonto Anna', art: 'giro', ort: 'privat', person: 'pa', iban: IBAN_PRIVAT, bank: 'Beispielbank' } },
  ] }));
  const j = await r.json();
  expect(r.status, JSON.stringify(j)).toBe(200);
  [ugKonto, privatKonto] = j.neu;
});
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten();
  rmSync(ordner, { recursive: true, force: true });
});

describe('Business-Konto (Gesellschaft): Vorschau → Übernehmen → zweiter Import → Rückgängig', () => {
  let laufId = '';
  it('Vorschau schreibt nichts; neu/schon da/übersprungen, Saldo neu, Saldo-Prüfung stimmt', async () => {
    const v = await sende<{ ok: boolean; zahlen: Record<string, number>; saldo: { status: string; betrag: number }; pruefung: { stimmt: boolean }; ziel: { art: string; satz: string }; basis: string }>('pa', { aktion: 'vorschau', kontoId: ugKonto, datei: datei(ugAuszug()) });
    expect(v.status, JSON.stringify(v.j)).toBe(200);
    expect(v.j.zahlen).toEqual({ gelesen: 4, neu: 3, vorhanden: 0, uebersprungen: 1 });
    expect(v.j.saldo).toMatchObject({ status: 'neu', betrag: 1093.6 });
    expect(v.j.pruefung.stimmt).toBe(true);
    expect(v.j.ziel.art).toBe('business');
    expect(await db.loadJson('buchungen')).toBeNull();
    expect((await registerLaden()).konten.find(k => k.id === ugKonto)!.staende).toEqual([]);
  });

  it('falsche Vorschau-Kennung → 409 mit neuer Vorschau; dann übernommen: Buchungen mit ort, Saldo als Stand (bank), Rückweg-Spiegel', async () => {
    const falsch = await sende<{ vorschau: { basis: string } }>('pa', { aktion: 'uebernehmen', kontoId: ugKonto, datei: datei(ugAuszug()), basis: 'alt' });
    expect(falsch.status).toBe(409);
    expect(await db.loadJson('buchungen')).toBeNull();
    const u = await sende<{ ok: boolean; angelegt: number; lauf: { id: string; buchungen: unknown[]; status: string }; saldo: string }>('pa', { aktion: 'uebernehmen', kontoId: ugKonto, datei: datei(ugAuszug()), basis: falsch.j.vorschau.basis });
    expect(u.status, JSON.stringify(u.j)).toBe(200);
    expect(u.j).toMatchObject({ ok: true, angelegt: 3, saldo: 'neu' });
    expect(u.j.lauf.status).toBe('uebernommen');
    laufId = u.j.lauf.id;
    const b = await businessBuchungen();
    expect(b).toHaveLength(3);
    expect(b.every(x => x.ort === 'ug' && x.auszug === laufId && x.id.startsWith('bu-ka-'))).toBe(true);
    expect(b.map(x => x.betrag).sort((x, y) => x - y)).toEqual([-3.2, -3.2, 1100]);
    const konto = (await registerLaden()).konten.find(k => k.id === ugKonto)!;
    expect(konto.staende).toHaveLength(1);
    expect(konto.staende[0]).toMatchObject({ betrag: 1093.6, datum: tag(-1), quelle: 'bank', herkunft: { art: 'auszug', id: laufId }, erfasstVon: 'pa' });
    const fp = (await db.loadJson<{ firmen: { id: string; kontostand: number; stand: string }[] }>('finanzplan'))!;
    expect(fp.firmen.find(f => f.id === 'ug')).toMatchObject({ kontostand: 1093.6, stand: tag(-1) });
  });

  it('das Lauf-Protokoll hält nur Kennungen und Zahlen — keine Namen, Zwecke, IBANs; die Absicht ist abgeschlossen und geleert', async () => {
    const roh = JSON.stringify(await db.loadJson('kontoauszug-laeufe--h-k'));
    expect(roh).toContain(laufId);
    for (const t of [NAME_DRITTER, 'Kaffee', 'Rechnung 1', IBAN_GEGEN, IBAN_UG]) expect(roh).not.toContain(t);
    const ab = JSON.stringify(await db.loadJson('absichten--h-k'));
    expect(ab).not.toContain(NAME_DRITTER);
    expect(ab).toContain('"status":"fertig"');
  });

  it('ein zweiter Import derselben Datei legt nichts doppelt an (Vorschau: alles schon da)', async () => {
    const v = await sende<{ zahlen: Record<string, number>; saldo: { status: string }; basis: string }>('pa', { aktion: 'vorschau', kontoId: ugKonto, datei: datei(ugAuszug()) });
    expect(v.j.zahlen).toMatchObject({ neu: 0, vorhanden: 3 });
    expect(v.j.saldo.status).toBe('vorhanden');
    const u = await sende<{ nichtsNeu: boolean; angelegt: number }>('pa', { aktion: 'uebernehmen', kontoId: ugKonto, datei: datei(ugAuszug()), basis: v.j.basis });
    expect(u.j).toMatchObject({ nichtsNeu: true, angelegt: 0 });
    expect(await businessBuchungen()).toHaveLength(3);
  });

  it('Läufe des Kontos lesen; Rückgängig nimmt nur Unverändertes (Konflikt-Liste), Saldo-Stand zurückgenommen, Spiegel zieht nach', async () => {
    const l = await lies<{ laeufe: { id: string }[] }>('pa', `/api/finanzen/konten/auszug?konto=${ugKonto}`);
    expect(l.j.laeufe.map(x => x.id)).toEqual([laufId]);
    // Eine Buchung wird inzwischen geändert (z. B. Zweck ergänzt).
    await db.updateJson<{ buchungen: { id: string; betrag: number; zweck?: string }[] }>('buchungen', cur => ({ ...cur!, buchungen: cur!.buchungen.map(b => (b.betrag === 1100 ? { ...b, zweck: 'Rechnung 1 — geprüft' } : b)) }));
    const z = await sende<{ ok: boolean; entfernt: number; konflikte: { betrag: number }[]; standZurueck: number; lauf: { status: string } }>('pa', { aktion: 'zuruecknehmen', laufId });
    expect(z.status, JSON.stringify(z.j)).toBe(200);
    expect(z.j).toMatchObject({ entfernt: 2, standZurueck: 1, lauf: { status: 'teilweise' } });
    expect(z.j.konflikte).toEqual([expect.objectContaining({ betrag: 1100 })]);
    const b = await businessBuchungen();
    expect(b).toHaveLength(1);
    expect(b[0].zweck).toBe('Rechnung 1 — geprüft');
    const konto = (await registerLaden()).konten.find(k => k.id === ugKonto)!;
    expect(konto.staende).toHaveLength(1);
    expect(konto.staende[0].zurueckgenommenAm).toBeTruthy();
    // Nahtstellen 09.10.: erst dieser Saldo machte das Register zur Quelle — Rückgängig stellt den Kontostand von vorher her (500 €, nicht „unbekannt“).
    expect((await db.loadJson<{ firmen: { id: string; kontostand: number | null; stand: string | null }[] }>('finanzplan'))!.firmen.find(f => f.id === 'ug')).toMatchObject({ kontostand: 500, stand: tag(-30) });
    // Noch einmal: der geänderte bleibt Konflikt, nichts doppelt entfernt.
    const z2 = await sende<{ entfernt: number; konflikte: unknown[] }>('pa', { aktion: 'zuruecknehmen', laufId });
    expect(z2.j).toMatchObject({ entfernt: 0, konflikte: [expect.anything()] });
  });
});

describe('Saldo-Prüfung, Zuordnung, Grenzen', () => {
  it('Prüfung geht nicht auf → 409 ohne „trotzdem“, mit „trotzdem“ übernommen', async () => {
    const x = ugAuszug(IBAN_UG, '5000.00').replace(/R1-/g, 'P1-').replace(/Kaffee/g, 'Tee');
    const v = await sende<{ pruefung: { stimmt: boolean; abweichung: number }; basis: string }>('pa', { aktion: 'vorschau', kontoId: ugKonto, datei: datei(x) });
    expect(v.j.pruefung).toMatchObject({ stimmt: false });
    const nein = await sende('pa', { aktion: 'uebernehmen', kontoId: ugKonto, datei: datei(x), basis: v.j.basis });
    expect(nein.status).toBe(409);
    const ja = await sende<{ angelegt: number }>('pa', { aktion: 'uebernehmen', kontoId: ugKonto, datei: datei(x), basis: v.j.basis, trotzAbweichung: true });
    expect(ja.status).toBe(200);
    expect(ja.j.angelegt).toBe(3);
  });
  it('Auszug eines anderen Kontos → 409 mit dem passenden Konto; XXE → 415; zu groß → 413; kaputtes base64 → 400', async () => {
    const r = await sende<{ anderesKonto: { id: string } }>('pa', { aktion: 'vorschau', kontoId: ugKonto, datei: datei(ugAuszug(IBAN_PRIVAT)) });
    expect(r.status).toBe(409);
    expect(r.j.anderesKonto.id).toBe(privatKonto);
    const xxe = '<?xml version="1.0"?><!DOCTYPE d [<!ENTITY x SYSTEM "file:///etc/hosts">]><Document><BkToCstmrStmt><Stmt>&x;</Stmt></BkToCstmrStmt></Document>';
    expect((await sende('pa', { aktion: 'vorschau', kontoId: ugKonto, datei: datei(xxe) })).status).toBe(415);
    expect((await sende('pa', { aktion: 'vorschau', kontoId: ugKonto, datei: { inhalt: bytesZuBase64(new Uint8Array(5 * 1024 * 1024 + 10)) } })).status).toBe(413);
    expect((await sende('pa', { aktion: 'vorschau', kontoId: ugKonto, datei: { inhalt: '%%%' } })).status).toBe(400);
    expect((await sende('pa', { aktion: 'loeschen' })).status).toBe(400);
  });
});

describe('Rechte (Trennung serverseitig)', () => {
  it('Business-Recht bzw. Business-Bereich: Privat-Konto → 403 (lesen, Vorschau, Läufe); Business-Konto geht', async () => {
    for (const [p, s] of [['pt', undefined], ['pt', 'privat'], ['pa', 'business']] as const) {
      expect((await sende(p, { aktion: 'vorschau', kontoId: privatKonto, datei: datei(ugAuszug(IBAN_PRIVAT)) }, s)).status, `${p} ${s}`).toBe(403);
      expect((await auszug.GET!(anfrage(`/api/finanzen/konten/auszug?konto=${privatKonto}${s ? `&sicht=${s}` : ''}`, p))).status).toBe(404);
    }
    expect((await sende('pt', { aktion: 'vorschau', kontoId: ugKonto, datei: datei(ugAuszug()) })).status).toBe(200);
  });
  it('Dienstweg → 403 (auch mit Person); fremder Haushalt findet das Konto nicht (404); ohne Haushalt 403', async () => {
    const dienst = { 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': 'pa' };
    expect((await sende('pa', { aktion: 'vorschau', kontoId: ugKonto, datei: datei(ugAuszug()) }, undefined, dienst)).status).toBe(403);
    expect((await auszug.GET!(anfrage(`/api/finanzen/konten/auszug?konto=${ugKonto}`, undefined, undefined, dienst))).status).toBe(403);
    expect((await sende('px', { aktion: 'vorschau', kontoId: ugKonto, datei: datei(ugAuszug()) })).status).toBe(404);
    expect((await sende('niemand', { aktion: 'vorschau', kontoId: ugKonto, datei: datei(ugAuszug()) })).status).toBe(403);
  });
});

describe('Privat-Konto: CSV → Haushalt (Haushalts-Konto angelegt und verknüpft)', () => {
  const csv = () => [
    `Kontonummer;${IBAN_PRIVAT}`,
    'Buchungstag;Empfänger;Verwendungszweck;Betrag;Saldo',
    `${tag(-3).split('-').reverse().join('.')};Supermarkt Beispiel;Einkauf;-23,45;976,55`,
    `${tag(-2).split('-').reverse().join('.')};Anna Beispiel;Rückzahlung;10,00;986,55`,
  ].join('\n');
  it('Vorschau → Übernehmen: Buchungen im Haushalt (Cent, import_id = Lauf), Saldo-Stand, Verknüpfung alt.haushaltKonto', async () => {
    const d = { inhalt: bytesZuBase64(utf8(csv())) };
    const v = await sende<{ zahlen: Record<string, number>; ziel: { art: string; neu: boolean }; basis: string; csv: { kopfZeile: number } }>('pb', { aktion: 'vorschau', kontoId: privatKonto, datei: d });
    expect(v.status, JSON.stringify(v.j)).toBe(200);
    expect(v.j).toMatchObject({ zahlen: { neu: 2 }, ziel: { art: 'haushalt', neu: true }, csv: { kopfZeile: 2 } });
    // Einordnung wie im Haushalt (lib/finanzen/haushalt/einordnung.ts): eine Ausgabe, eine Einnahme ohne Art, beide ohne Kategorie.
    expect((v.j as unknown as { einordnung: Record<string, number> }).einordnung).toEqual({ 'ausgabe-variabel': 1, 'einnahme-offen': 1, ohneKategorie: 2 });
    const u = await sende<{ angelegt: number; lauf: { id: string; haushaltKonto: { id: string; neu: boolean } } }>('pb', { aktion: 'uebernehmen', kontoId: privatKonto, datei: d, basis: v.j.basis });
    expect(u.status, JSON.stringify(u.j)).toBe(200);
    expect(u.j.angelegt).toBe(2);
    const stamm = (await db.loadJson<{ konten: { id: string; name: string; inhaber: string | null; iban_suffix: string | null }[] }>('haushalt-stamm--h-k'))!;
    const hk = stamm.konten.find(k => k.id === u.j.lauf.haushaltKonto.id)!;
    expect(hk).toMatchObject({ name: 'Girokonto Anna', inhaber: 'Anna', iban_suffix: IBAN_PRIVAT.slice(-4) });
    const reg = (await registerLaden()).konten.find(k => k.id === privatKonto)!;
    expect(reg.alt?.haushaltKonto).toBe(hk.id);
    expect(reg.staende[0]).toMatchObject({ betrag: 986.55, quelle: 'bank' });
    const hb = (await db.loadJson<{ buchungen: { konto_id: string; betrag: number; import_id: string; erfasst_von: string; zeilen_hash: string }[] }>('haushalt-buchungen--h-k'))!.buchungen;
    expect(hb.map(b => b.betrag).sort((a, b) => a - b)).toEqual([-2345, 1000]);
    expect(hb.every(b => b.konto_id === hk.id && b.import_id === u.j.lauf.id && b.erfasst_von === 'pb' && !!b.zeilen_hash)).toBe(true);
    // Zweiter Import: nichts neu; dasselbe Haushalts-Konto (verknüpft).
    const v2 = await sende<{ zahlen: Record<string, number>; ziel: { neu: boolean; haushaltKontoId: string } }>('pb', { aktion: 'vorschau', kontoId: privatKonto, datei: d });
    expect(v2.j.zahlen).toMatchObject({ neu: 0, vorhanden: 2 });
    expect(v2.j.ziel).toMatchObject({ neu: false, haushaltKontoId: hk.id });
    // Rückgängig: beide weg, das Haushalts-Konto bleibt.
    const z = await sende<{ entfernt: number; hinweis: string }>('pb', { aktion: 'zuruecknehmen', laufId: u.j.lauf.id });
    expect(z.j.entfernt).toBe(2);
    expect(z.j.hinweis).toContain('bleibt');
    expect((await db.loadJson<{ buchungen: unknown[] }>('haushalt-buchungen--h-k'))!.buchungen).toHaveLength(0);
    expect((await db.loadJson<{ konten: { id: string }[] }>('haushalt-stamm--h-k'))!.konten.some(k => k.id === hk.id)).toBe(true);
  });
});

describe('Absichtsprotokoll: Abbruch nach jedem Schritt → Wiederaufnahme ergibt denselben Endzustand', () => {
  const schritte = ['lauf', 'haushaltkonto', 'buchungen', 'saldo', 'abschluss'] as const;
  let nr = 0;
  for (const schritt of schritte) {
    for (const haken of ['vorAbhaken', 'nachAbhaken'] as const) {
      it(`${haken} „${schritt}“`, async () => {
        const ab = await import('@/lib/store/absichten');
        const srv = await import('@/lib/finanzen/kontoauszug/server');
        const fortsetzenHaushalt = 'h-k';
        nr++;
        const iban = testIban('20050550', String(100000 + nr));
        const reg = await konten.POST!(anfrage('/api/finanzen/konten', 'pa', { ops: [{ op: 'konto-neu', konto: { name: `Konto ${nr}`, ort: 'kdv', iban } }] }));
        const kontoId = (await reg.json()).neu[0] as string;
        const bytes = utf8(ugAuszug(iban));
        const ctx = { haushalt: fortsetzenHaushalt, person: 'pa', sicht: 'privat' as const };
        const v = await srv.auszugVorschau(ctx, kontoId, bytes, undefined);
        if (!v.ok) throw new Error(v.fehler);
        ab.absichtTest[haken] = (art, s) => { if (art === 'kontoauszug' && s === schritt) throw new ab.TestAbbruch(s); };
        await expect(srv.auszugUebernehmen(ctx, kontoId, bytes, undefined, v.basis)).rejects.toThrow(/Testabbruch/);
        ab.absichtTest[haken] = null;
        const offen = (await ab.absichtenLaden('h-k')).filter(ab.istOffen);
        expect(offen).toHaveLength(1);
        await srv.kontoauszugFortsetzen('h-k', offen[0]);
        expect((await ab.absichtenLaden('h-k')).filter(ab.istOffen)).toHaveLength(0);
        const { kontoMarke } = await import('@/lib/finanzen/kontoauszug/plan');
        const meine = (await businessBuchungen()).filter(b => b.ort === 'kdv' && b.id.startsWith(`bu-ka-${kontoMarke(kontoId)}-`));
        expect(meine).toHaveLength(3);
        const k = (await registerLaden()).konten.find(x => x.id === kontoId)!;
        expect(k.staende.filter(s => !s.zurueckgenommenAm)).toHaveLength(1);
        const lauf = (await srv.laeufeLaden('h-k')).find(l => l.kontoId === kontoId)!;
        expect(lauf.status).toBe('uebernommen');
        expect(lauf.buchungen).toHaveLength(3);
        expect(lauf.standId).toBe(k.staende[0].id);
      });
    }
  }
});

describe('Absichtsprotokoll: Rückgängig mit Abbruch', () => {
  for (const schritt of ['buchungen', 'saldo', 'protokoll'] as const) {
    it(`nachAbhaken „${schritt}“ → Wiederaufnahme: alle entfernt, Saldo zurückgenommen, Lauf zurückgenommen`, async () => {
      const ab = await import('@/lib/store/absichten');
      const srv = await import('@/lib/finanzen/kontoauszug/server');
      const iban = testIban('20050550', String(200000 + schritt.length));
      const reg = await konten.POST!(anfrage('/api/finanzen/konten', 'pa', { ops: [{ op: 'konto-neu', konto: { name: `Rückgängig ${schritt}`, ort: 'kdv', iban } }] }));
      const kontoId = (await reg.json()).neu[0] as string;
      const bytes = utf8(ugAuszug(iban));
      const ctx = { haushalt: 'h-k', person: 'pa', sicht: 'privat' as const };
      const v = await srv.auszugVorschau(ctx, kontoId, bytes, undefined);
      if (!v.ok) throw new Error(v.fehler);
      const u = await srv.auszugUebernehmen(ctx, kontoId, bytes, undefined, v.basis);
      if (!u.ok || !u.lauf) throw new Error('Übernahme fehlgeschlagen');
      ab.absichtTest.nachAbhaken = (art, s) => { if (art === 'kontoauszug' && s === schritt) throw new ab.TestAbbruch(s); };
      await expect(srv.auszugZuruecknehmen(ctx, u.lauf.id)).rejects.toThrow(/Testabbruch/);
      ab.absichtTest.nachAbhaken = null;
      const offen = (await ab.absichtenLaden('h-k')).filter(ab.istOffen);
      expect(offen).toHaveLength(1);
      await srv.kontoauszugFortsetzen('h-k', offen[0]);
      const { kontoMarke } = await import('@/lib/finanzen/kontoauszug/plan');
      expect((await businessBuchungen()).filter(b => b.id.startsWith(`bu-ka-${kontoMarke(kontoId)}-`))).toHaveLength(0);
      const k = (await registerLaden()).konten.find(x => x.id === kontoId)!;
      expect(k.staende.every(s => !!s.zurueckgenommenAm)).toBe(true);
      expect((await srv.laeufeLaden('h-k')).find(l => l.id === u.lauf!.id)!.status).toBe('zurueckgenommen');
    });
  }
});
