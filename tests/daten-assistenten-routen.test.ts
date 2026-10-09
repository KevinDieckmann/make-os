// ─── Daten-Assistenten (09.10., B9 a–c) — Routen: Vorschau → Übernehmen → Rückgängig, Idempotenz, Konflikte, Rechte ──────────────────
// (a) Monatsabschluss aus BWA/Excel über /api/business bzw. /api/privat/abschluss (je Bereich, ein Bereich sieht die Läufe des anderen nie),
// (b) offene Posten des 0-Punkts + „bezahlt am“ über /api/business/eroeffnung (neue Fassung, Rückgängig = zurücknehmen),
// (c) Mandate über /api/crm/mandate-tabelle (Firmen über firmaSichern, Mandate über den CRM-Schreibweg, Rückgängig nur Unverändertes).
// Eigener Datenordner, erfundene Personen, Firmen und Zahlen.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-daten-assistenten-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-daten-assistenten';
process.env.MAKE_OS_OHNE_APPLE = '1';
delete process.env.MAKE_OS_DATENSCHLUESSEL;
delete process.env.NEXT_PUBLIC_MAKE_OS_EINHEITEN;

import { tabelleLesen, datensaetzeBauen, zeilenAufbereiten, type Datensatz } from '@/lib/tabelle/einfuegen';
import { abschlussAufbereiten } from '@/lib/business/abschluss-tabelle';
import { POSTEN_FELDER } from '@/lib/business/eroeffnung-tabelle';
import { MANDAT_FELDER } from '@/lib/crm/mandate-tabelle';
import type { Monatsabschluss } from '@/lib/business/messen';
import type { CrmBestand, Mandat } from '@/lib/crm/typen';

type Handler = (r: Request) => Promise<Response>;
type Route = { GET?: Handler; POST?: Handler };
const anfrage = (url: string, person?: string, body?: unknown, extra: Record<string, string> = {}) => new Request(`http://test${url}`, {
  method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(person ? { 'x-make-user': person } : {}), ...extra }, ...(body ? { body: JSON.stringify(body) } : {}),
});
const dienst = { 'x-make-key': 'pruef-schluessel-daten-assistenten', 'x-make-person': 'pa' };
const tag = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' }); };
const crmLeer = (x: Partial<CrmBestand> = {}): CrmBestand => ({ firmen: [], chancen: [], mandate: [], leistungen: [], events: [], teilnahmen: [], sitzungen: [], antraege: [], verarbeitungen: [], segmente: [], beitraege: [], newsletter: [], kampagnen: [], followups: [], angebote: [], ...x } as unknown as CrmBestand);
const zeilenAus = (text: string, aufbereiten: (z: ReturnType<typeof tabelleLesen> & { ok: true }) => ReturnType<typeof zeilenAufbereiten>): Datensatz[] => {
  const g = tabelleLesen(text);
  if (!g.ok) throw new Error(g.fehler);
  const a = aufbereiten(g);
  return datensaetzeBauen(a, a.vorschlag);
};

let db: typeof import('@/lib/store/local-db');
let business: Route, privat: Route, eroeffnung: Route, mandate: Route;

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  business = await import('@/app/api/business/route') as Route;
  privat = await import('@/app/api/privat/abschluss/route') as Route;
  eroeffnung = await import('@/app/api/business/eroeffnung/route') as Route;
  mandate = await import('@/app/api/crm/mandate-tabelle/route') as Route;
  await db.saveJson('konten', { konten: [
    { id: '1', speicher: 'pa', email: 'pa@example.invalid', name: 'Anna Prüf', rolle: 'inhaber', hash: 'x', salz: 'x', angelegt: '2026-09-01', haushalt: 'h-pruef' },
    { id: '2', speicher: 'pt', email: 'pt@example.invalid', name: 'Team Prüf', rolle: 'mitglied', hash: 'x', salz: 'x', angelegt: '2026-09-01', haushalt: 'h-pruef', finanzRecht: 'business' },
    { id: '3', speicher: 'px', email: 'px@example.invalid', name: 'Testkunde', rolle: 'mitglied', hash: 'x', salz: 'x', angelegt: '2026-09-01', haushalt: 'h-fremd' },
    { id: '4', speicher: 'po', email: 'po@example.invalid', name: 'Ohne Haushalt', rolle: 'mitglied', hash: 'x', salz: 'x', angelegt: '2026-09-01' },
  ], einladungen: [] });
  await db.saveJson('finanzplan', { firmen: [{ id: 'ug', name: 'MAKE', bank: '', kontostand: 5000, stand: tag(-60) }], rechnungen: [], zahlungen: [], merkposten: [], produkte: [] });
  await db.saveJson('crm', crmLeer({
    firmen: [{ id: 'f-beispielwerke-a1', name: 'Beispiel Werke', rolle: 'kunde', geaendert: '2026-09-01T00:00:00.000Z' }] as unknown as CrmBestand['firmen'],
    leistungen: [{ id: 'l-retainer', name: 'Beispiel-Retainer', typ: 'retainer', stufe: 'kern', status: 'aktiv', geaendert: '2026-09-01T00:00:00.000Z' }] as unknown as CrmBestand['leistungen'],
  }));
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

const abschluesse = async () => (await db.loadJson<{ eintraege: Monatsabschluss[] }>('business-abschluesse'))?.eintraege ?? [];
const post = async (r: Route, url: string, person: string | undefined, body: unknown, extra?: Record<string, string>) => {
  const x = await r.POST!(anfrage(url, person, body, extra));
  return { status: x.status, j: await x.json() };
};

// ── (a) Monatsabschluss ────────────────────────────────────────────────────────────────────────────────────────────────────────

const BWA = [
  'BWA;Kurzfristige Erfolgsrechnung', 'Mandant;Beispiel GmbH', '',
  'Bezeichnung;Jan/2026;Feb/2026;Mär/2026;Summe',
  'Umsatzerlöse;10.000,00;12.500,50;9.000,00;31.500,50',
  'Personalkosten;-4.000,00;-4.000,00;-4.100,00;-12.100,00',
  'Raumkosten;-800,00;-800,00;-800,00;-2.400,00',
  'Gesamtkosten;-5.000,00;-5.200,00;-5.100,00;-15.300,00',
].join('\n');
const bwaZeilen = (text = BWA) => zeilenAus(text, g => abschlussAufbereiten(g.zeilen));

describe('(a) Monatsabschluss aus BWA/Excel — Business-Index', () => {
  let lauf1 = '';
  it('Vorschau schreibt nichts; Übernehmen nur mit der Vorschau-Kennung (sonst 409 mit neuer Vorschau)', async () => {
    const v = await post(business, '/api/business', 'pa', { aktion: 'tabelle_vorschau', firma: 'ug', zeilen: bwaZeilen() });
    expect(v.status).toBe(200);
    expect(v.j.zeilen.map((z: { titel: string; status: string }) => [z.titel, z.status])).toEqual([['Januar 2026', 'neu'], ['Februar 2026', 'neu'], ['März 2026', 'neu']]);
    expect(await abschluesse()).toEqual([]);
    const alt = await post(business, '/api/business', 'pa', { aktion: 'tabelle_uebernehmen', firma: 'ug', zeilen: bwaZeilen(), basis: 'ab-veraltet' });
    expect(alt.status).toBe(409);
    expect(alt.j.vorschau.basis).toBe(v.j.basis);
    const u = await post(business, '/api/business', 'pa', { aktion: 'tabelle_uebernehmen', firma: 'ug', zeilen: bwaZeilen(), basis: v.j.basis });
    expect(u.status).toBe(200);
    expect(u.j).toMatchObject({ ok: true, geschrieben: 3 });
    lauf1 = u.j.laufId;
    const a = await abschluesse();
    expect(a.find(x => x.monat === '2026-02')).toMatchObject({ firma: 'ug', umsatz: 12500.5, personal: 4000, kosten: 5200, von: 'pa' });
    expect(a.find(x => x.monat === '2026-01')?.marketingVertrieb).toBeUndefined();
  });

  it('idempotent: dieselbe Einfügung noch einmal = alles gleich, nichts geschrieben', async () => {
    const v = await post(business, '/api/business', 'pa', { aktion: 'tabelle_vorschau', firma: 'ug', zeilen: bwaZeilen() });
    expect(v.j.zeilen.every((z: { status: string }) => z.status === 'gleich')).toBe(true);
    const vorher = JSON.stringify(await abschluesse());
    const u = await post(business, '/api/business', 'pa', { aktion: 'tabelle_uebernehmen', firma: 'ug', zeilen: bwaZeilen(), basis: v.j.basis });
    expect(u.j).toMatchObject({ ok: true, laufId: null, geschrieben: 0 });
    expect(JSON.stringify(await abschluesse())).toBe(vorher);
  });

  let lauf2 = '';
  it('Auswahl: nur die gewählten Monate; Rückgängig mit Konflikt lässt Geändertes stehen', async () => {
    const neu = BWA.replace('12.500,50', '13.000,00').replace('9.000,00', '9.500,00');
    const v = await post(business, '/api/business', 'pt', { aktion: 'tabelle_vorschau', firma: 'ug', zeilen: bwaZeilen(neu) });
    expect(v.status).toBe(200); // Konto mit Business-Finanzrecht darf (Business-Buchführung)
    expect(v.j.zeilen.map((z: { schluessel: string; status: string }) => [z.schluessel, z.status])).toEqual([['2026-01', 'gleich'], ['2026-02', 'geaendert'], ['2026-03', 'geaendert']]);
    const u = await post(business, '/api/business', 'pt', { aktion: 'tabelle_uebernehmen', firma: 'ug', zeilen: bwaZeilen(neu), basis: v.j.basis, auswahl: ['2026-02'] });
    expect(u.j).toMatchObject({ ok: true, geschrieben: 1 });
    lauf2 = u.j.laufId;
    const a = await abschluesse();
    expect(a.find(x => x.monat === '2026-02')?.umsatz).toBe(13000);
    expect(a.find(x => x.monat === '2026-03')?.umsatz).toBe(9000);
    // Von Hand im Januar geändert (Formular-Weg).
    expect((await post(business, '/api/business', 'pa', { aktion: 'abschluss', firma: 'ug', monat: '2026-01', umsatz: 10001 })).status).toBe(200);
    // Lauf 1 zurück: Januar (von Hand) und Februar (Lauf 2) seitdem geändert → bleiben; März (neu, unverändert) → weg.
    const z = await post(business, '/api/business', 'pa', { aktion: 'tabelle_zurueck', laufId: lauf1 });
    expect(z.j).toMatchObject({ ok: true, zurueck: 1, konflikte: ['2026-01', '2026-02'] });
    expect((await abschluesse()).filter(x => x.firma === 'ug').map(x => x.monat).sort()).toEqual(['2026-01', '2026-02']);
    // Lauf 2 zurück: Februar wieder auf den Wert von Lauf 1.
    const z2 = await post(business, '/api/business', 'pa', { aktion: 'tabelle_zurueck', laufId: lauf2 });
    expect(z2.j).toMatchObject({ ok: true, zurueck: 1, konflikte: [] });
    expect((await abschluesse()).find(x => x.monat === '2026-02')?.umsatz).toBe(12500.5);
    expect((await post(business, '/api/business', 'pa', { aktion: 'tabelle_zurueck', laufId: lauf2 })).status).toBe(409);
  });

  it('Rechte: fremder Haushalt, ohne Haushalt, ohne Person → 403; Dienstweg → 403; Privat-Einheit im Business → 400', async () => {
    for (const p of ['px', 'po', undefined]) expect((await post(business, '/api/business', p, { aktion: 'tabelle_vorschau', firma: 'ug', zeilen: bwaZeilen() })).status, String(p)).toBe(403);
    expect((await post(business, '/api/business', undefined, { aktion: 'tabelle_vorschau', firma: 'ug', zeilen: bwaZeilen() }, dienst)).status).toBe(403);
    const kdc = await post(business, '/api/business', 'pa', { aktion: 'tabelle_vorschau', firma: 'kdc', zeilen: bwaZeilen() });
    expect(kdc.status).toBe(400);
    expect(kdc.j.fehler).toMatch(/Privat/);
  });
});

describe('(a) Monatsabschluss — Privat › Selbstständigkeit; Sicht X bekommt nichts aus Y', () => {
  it('Privat: nur Privat-Einheiten, nur volles Finanzrecht; Business-Lauf bleibt unsichtbar (und umgekehrt)', async () => {
    expect((await post(privat, '/api/privat/abschluss', 'pt', { aktion: 'tabelle_vorschau', firma: 'kdc', zeilen: bwaZeilen() })).status).toBe(403);
    expect((await post(privat, '/api/privat/abschluss', 'pa', { aktion: 'tabelle_vorschau', firma: 'ug', zeilen: bwaZeilen() })).status).toBe(400);
    expect((await post(privat, '/api/privat/abschluss', undefined, { aktion: 'tabelle_vorschau', firma: 'kdc', zeilen: bwaZeilen() }, dienst)).status).toBe(403);
    const v = await post(privat, '/api/privat/abschluss', 'pa', { aktion: 'tabelle_vorschau', firma: 'kdc', zeilen: bwaZeilen() });
    expect(v.status).toBe(200);
    const u = await post(privat, '/api/privat/abschluss', 'pa', { aktion: 'tabelle_uebernehmen', firma: 'kdc', zeilen: bwaZeilen(), basis: v.j.basis });
    expect(u.j).toMatchObject({ ok: true, geschrieben: 3 });
    const pg = await (await privat.GET!(anfrage('/api/privat/abschluss', 'pa'))).json();
    expect(pg.abschlussLaeufe.map((l: { id: string; firma: string }) => l.firma)).toEqual(['kdc']);
    const bg = await (await business.GET!(anfrage('/api/business?scope=ug', 'pa'))).json();
    expect(bg.abschlussLaeufe.length).toBe(2);
    expect(bg.abschlussLaeufe.every((l: { firma: string }) => l.firma === 'ug')).toBe(true);
    expect(JSON.stringify(bg.abschlussLaeufe)).not.toContain(u.j.laufId);
    // Ein Bereich nimmt nie den Lauf des anderen zurück.
    expect((await post(business, '/api/business', 'pa', { aktion: 'tabelle_zurueck', laufId: u.j.laufId })).status).toBe(404);
    expect((await post(privat, '/api/privat/abschluss', 'pa', { aktion: 'tabelle_zurueck', laufId: u.j.laufId })).j).toMatchObject({ ok: true, zurueck: 3 });
    // Das Lauf-Protokoll trägt keine Personen (Register „kein“): weder Speichername noch Namen.
    const roh = JSON.stringify(await db.loadJson('abschluss-laeufe'));
    expect(roh).not.toContain('"pa"');
    expect(roh).not.toContain('Beispiel');
  });
});

// ── (b) Offene Posten des 0-Punkts ───────────────────────────────────────────────────────────────────────────────────────────────

const OP = 'Kunde;Rechnungsnr.;Rechnungsdatum;Betrag brutto;Fällig\nKunde A;RE-1;01.09.2026;1.500,00;\nKunde B;RE-2;02.09.2026;800,00;30.10.2026\n';
const opZeilen = (text = OP) => zeilenAus(text, g => zeilenAufbereiten(g.zeilen, POSTEN_FELDER));
const geltend = async () => (await (await eroeffnung.GET!(anfrage('/api/business/eroeffnung', 'pa'))).json());

describe('(b) Offene Posten aus Excel/OP-Liste + „bezahlt am“', () => {
  it('ohne 0-Punkt: 409 mit Satz; Rechte wie die Eröffnung', async () => {
    const r = await post(eroeffnung, '/api/business/eroeffnung', 'pa', { aktion: 'posten_vorschau', firma: 'ug', art: 'forderungen', zeilen: opZeilen() });
    expect(r.status).toBe(409);
    expect(r.j.fehler).toMatch(/0-Punkt/);
    expect((await post(eroeffnung, '/api/business/eroeffnung', 'px', { aktion: 'posten_vorschau', firma: 'ug', art: 'forderungen', zeilen: opZeilen() })).status).toBe(403);
    expect((await post(eroeffnung, '/api/business/eroeffnung', undefined, { aktion: 'posten', firma: 'ug', art: 'forderungen', zeilen: opZeilen() }, dienst)).status).toBe(403);
    expect((await post(eroeffnung, '/api/business/eroeffnung', 'pa', { aktion: 'posten_vorschau', firma: 'kdc', art: 'forderungen', zeilen: opZeilen() })).status).toBe(400);
  });

  let fassung1 = '', fassung2 = '';
  it('Übernehmen = neue Fassung (Historie bleibt); veraltete Basis → 409; ergänzen erkennt dieselbe Rechnung', async () => {
    const s = await post(eroeffnung, '/api/business/eroeffnung', 'pa', { aktion: 'setzen', firma: 'ug', stichtag: tag(-10), kontostand: 8000, basis: null, forderungen: [{ name: 'Kunde A', betrag: 1500, rechnungsnr: 'RE-1' }] });
    expect(s.status).toBe(200);
    fassung1 = s.j.eintrag.id;
    const v = await post(eroeffnung, '/api/business/eroeffnung', 'pa', { aktion: 'posten_vorschau', firma: 'ug', art: 'forderungen', modus: 'ergaenzen', zeilen: opZeilen() });
    expect(v.status).toBe(200);
    expect(v.j.basis).toBe(fassung1);
    expect(v.j.zeilen.map((z: { status: string }) => z.status)).toEqual(['geaendert', 'neu']); // Kunde A bekommt das Rechnungsdatum dazu
    expect((await post(eroeffnung, '/api/business/eroeffnung', 'pa', { aktion: 'posten', firma: 'ug', art: 'forderungen', zeilen: opZeilen(), basis: 'er-veraltet' })).status).toBe(409);
    const u = await post(eroeffnung, '/api/business/eroeffnung', 'pa', { aktion: 'posten', firma: 'ug', art: 'forderungen', modus: 'ergaenzen', zeilen: opZeilen(), basis: v.j.basis });
    expect(u.status).toBe(200);
    fassung2 = u.j.eintrag.id;
    const g = await geltend();
    expect(g.geltend.ug.forderungen).toEqual([
      { name: 'Kunde A', betrag: 1500, rechnungsnr: 'RE-1', datum: '2026-09-01' },
      { name: 'Kunde B', betrag: 800, rechnungsnr: 'RE-2', datum: '2026-09-02', faellig: '2026-10-30' },
    ]);
    expect(g.geltend.ug.kontostand).toBe(8000);
    expect(g.eintraege.filter((e: { firma: string }) => e.firma === 'ug')).toHaveLength(2);
    // Dieselbe Liste noch einmal: nichts zu tun, keine neue Fassung.
    const v2 = await post(eroeffnung, '/api/business/eroeffnung', 'pa', { aktion: 'posten_vorschau', firma: 'ug', art: 'forderungen', zeilen: opZeilen() });
    expect(v2.j.zeilen.map((z: { status: string }) => z.status)).toEqual(['gleich', 'gleich']);
    const u2 = await post(eroeffnung, '/api/business/eroeffnung', 'pa', { aktion: 'posten', firma: 'ug', art: 'forderungen', zeilen: opZeilen(), basis: v2.j.basis });
    expect(u2.j).toMatchObject({ ok: true, nichts: true });
    expect((await geltend()).eintraege).toHaveLength(2);
  });

  it('„bezahlt am“ (L34): eigener Schreibweg mit Stand, zählt nicht mehr als offen; Rückgängig = Fassung zurücknehmen', async () => {
    expect((await post(eroeffnung, '/api/business/eroeffnung', 'pa', { aktion: 'bezahlt', firma: 'ug', art: 'forderungen', index: 0, bezahltAm: tag(3), basis: fassung2 })).status).toBe(400);
    expect((await post(eroeffnung, '/api/business/eroeffnung', 'pa', { aktion: 'bezahlt', firma: 'ug', art: 'forderungen', index: 0, bezahltAm: tag(0), basis: fassung1 })).status).toBe(409);
    expect((await post(eroeffnung, '/api/business/eroeffnung', 'pa', { aktion: 'bezahlt', firma: 'ug', art: 'forderungen', index: 7, bezahltAm: tag(0), basis: fassung2 })).status).toBe(400);
    const b = await post(eroeffnung, '/api/business/eroeffnung', 'pt', { aktion: 'bezahlt', firma: 'ug', art: 'forderungen', index: 0, bezahltAm: tag(0), basis: fassung2 });
    expect(b.status).toBe(200);
    const { mitEroeffnung } = await import('@/lib/business/eroeffnung-server');
    const fp = (await db.loadJson<{ firmen: never[]; rechnungen: never[]; zahlungen: never[] }>('finanzplan'))!;
    expect((await mitEroeffnung(fp)).rechnungen.map((r: { kunde: string }) => r.kunde)).toEqual(['Kunde B']);
    // Rückgängig: die Fassung „bezahlt“ zurücknehmen — Kunde A ist wieder offen.
    expect((await post(eroeffnung, '/api/business/eroeffnung', 'pa', { aktion: 'zuruecknehmen', firma: 'ug', basis: b.j.eintrag.id })).status).toBe(200);
    expect((await mitEroeffnung(fp)).rechnungen.map((r: { kunde: string }) => r.kunde)).toEqual(['Kunde A', 'Kunde B']);
  });

  it('Ersetzen mit Auswahl: abgewählte „entfällt“ bleibt stehen', async () => {
    const nur = 'Kunde;Rechnungsnr.;Betrag\nKunde C;RE-3;99,00\n';
    const v = await post(eroeffnung, '/api/business/eroeffnung', 'pa', { aktion: 'posten_vorschau', firma: 'ug', art: 'forderungen', modus: 'ersetzen', zeilen: opZeilen(nur) });
    expect(v.j.zeilen.map((z: { schluessel: string; status: string }) => [z.schluessel, z.status])).toEqual([['n0', 'neu'], ['x0', 'entfaellt'], ['x1', 'entfaellt']]);
    const u = await post(eroeffnung, '/api/business/eroeffnung', 'pa', { aktion: 'posten', firma: 'ug', art: 'forderungen', modus: 'ersetzen', zeilen: opZeilen(nur), basis: v.j.basis, auswahl: ['n0', 'x1'] });
    expect(u.status).toBe(200);
    expect((await geltend()).geltend.ug.forderungen.map((p: { name: string }) => p.name)).toEqual(['Kunde C', 'Kunde A']);
  });
});

// ── (c) Mandate ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const MANDATE = 'Kunde\tProdukt\tHonorar netto/Monat\tStart\tLaufzeit\nBeispiel Werke GmbH\tBeispiel-Retainer\t4.500,00\t01.11.2026\t12\nNeu GmbH\tWorkshop Beispiel\t1.200,00\t01.12.2026\t\n';
const mZeilen = (text = MANDATE) => zeilenAus(text, g => zeilenAufbereiten(g.zeilen, MANDAT_FELDER));
const crm = async () => (await db.loadJson<CrmBestand>('crm'))!;

describe('(c) Mandate aus Excel', () => {
  it('Rechte: fremder Haushalt/ohne Person → 403, Dienstweg → 403 (auch nur lesen der Läufe: fremd → 403)', async () => {
    for (const p of ['px', 'po', undefined]) expect((await post(mandate, '/api/crm/mandate-tabelle', p, { aktion: 'vorschau', zeilen: mZeilen(), gesellschaft: 'ug' })).status, String(p)).toBe(403);
    expect((await post(mandate, '/api/crm/mandate-tabelle', undefined, { aktion: 'vorschau', zeilen: mZeilen() }, dienst)).status).toBe(403);
    expect((await mandate.GET!(anfrage('/api/crm/mandate-tabelle', 'px'))).status).toBe(403);
  });

  let lauf1 = '';
  it('Vorschau: Firma vorhanden bzw. neu, Gesellschaft Pflicht; Übernehmen legt Firma + Mandate an; noch einmal = gleich', async () => {
    const ohne = await post(mandate, '/api/crm/mandate-tabelle', 'pa', { aktion: 'vorschau', zeilen: mZeilen(), gesellschaft: 'offen' });
    expect(ohne.j.zeilen.every((z: { status: string }) => z.status === 'fehler')).toBe(true);
    const v = await post(mandate, '/api/crm/mandate-tabelle', 'pa', { aktion: 'vorschau', zeilen: mZeilen(), gesellschaft: 'ug' });
    expect(v.status).toBe(200);
    expect(v.j.zeilen.map((z: { status: string; text: string }) => [z.status, z.text])).toEqual([
      ['neu', 'Firma „Beispiel Werke“ vorhanden'], ['neu', 'Firma „Neu GmbH“ wird angelegt'],
    ]);
    expect((await post(mandate, '/api/crm/mandate-tabelle', 'pa', { aktion: 'uebernehmen', zeilen: mZeilen(), gesellschaft: 'ug', basis: 'mt-alt' })).status).toBe(409);
    const u = await post(mandate, '/api/crm/mandate-tabelle', 'pa', { aktion: 'uebernehmen', zeilen: mZeilen(), gesellschaft: 'ug', basis: v.j.basis });
    expect(u.status).toBe(200);
    expect(u.j).toMatchObject({ ok: true, neu: 2, geaendert: 0, firmenNeu: 1 });
    lauf1 = u.j.laufId;
    const c = await crm();
    const neuFirma = c.firmen.find(f => f.name === 'Neu GmbH')!;
    expect(neuFirma).toBeTruthy();
    const m = c.mandate.filter(x => x.id.startsWith('m-tab-'));
    expect(m.map(x => [x.kunde, x.firmaId, x.gesellschaft, x.leistungId ?? null, x.honorar.betrag, x.mindestlaufzeitMonate ?? null, x.status])).toEqual([
      ['Beispiel Werke', 'f-beispielwerke-a1', 'ug', 'l-retainer', 4500, 12, 'aktiv'],
      ['Neu GmbH', neuFirma.id, 'ug', null, 1200, null, 'aktiv'],
    ]);
    const v2 = await post(mandate, '/api/crm/mandate-tabelle', 'pa', { aktion: 'vorschau', zeilen: mZeilen(), gesellschaft: 'ug' });
    expect(v2.j.zeilen.map((z: { status: string }) => z.status)).toEqual(['gleich', 'gleich']);
    expect((await post(mandate, '/api/crm/mandate-tabelle', 'pa', { aktion: 'uebernehmen', zeilen: mZeilen(), gesellschaft: 'ug', basis: v2.j.basis })).j).toMatchObject({ ok: true, laufId: null });
    expect((await crm()).mandate.filter(x => x.id.startsWith('m-tab-'))).toHaveLength(2);
  });

  it('geändertes Honorar → geändert; Rückgängig stellt es wieder her; Rückgängig von Lauf 1 lässt Geändertes stehen', async () => {
    const neu = MANDATE.replace('4.500,00', '5.000,00');
    const v = await post(mandate, '/api/crm/mandate-tabelle', 'pa', { aktion: 'vorschau', zeilen: mZeilen(neu), gesellschaft: 'ug' });
    expect(v.j.zeilen.map((z: { status: string }) => z.status)).toEqual(['geaendert', 'gleich']);
    const u = await post(mandate, '/api/crm/mandate-tabelle', 'pa', { aktion: 'uebernehmen', zeilen: mZeilen(neu), gesellschaft: 'ug', basis: v.j.basis });
    expect(u.j).toMatchObject({ ok: true, neu: 0, geaendert: 1 });
    const beispiel = () => crm().then(c => c.mandate.find(x => x.kunde === 'Beispiel Werke' && x.id.startsWith('m-tab-')) as Mandat);
    expect((await beispiel()).honorar.betrag).toBe(5000);
    expect((await post(mandate, '/api/crm/mandate-tabelle', 'pa', { aktion: 'zurueck', laufId: u.j.laufId })).j).toMatchObject({ ok: true, mandate: 1, konflikte: 0 });
    expect((await beispiel()).honorar.betrag).toBe(4500);
    // Jemand ändert das Mandat der neuen Firma von Hand — Lauf 1 zurück: das bleibt (und damit auch seine Firma), das andere geht.
    const { aendereCrm } = await import('@/lib/crm/speicher');
    await aendereCrm(b => ({ ...b, mandate: b.mandate.map(x => (x.kunde === 'Neu GmbH' ? { ...x, notiz: 'von Hand ergänzt' } : x)) }));
    const z = await post(mandate, '/api/crm/mandate-tabelle', 'pa', { aktion: 'zurueck', laufId: lauf1 });
    expect(z.j).toMatchObject({ ok: true, mandate: 1, firmen: 0, konflikte: 2 });
    const c = await crm();
    expect(c.mandate.filter(x => x.id.startsWith('m-tab-')).map(x => x.kunde)).toEqual(['Neu GmbH']);
    expect(c.firmen.some(f => f.name === 'Neu GmbH')).toBe(true);
    expect(c.firmen.some(f => f.id === 'f-beispielwerke-a1')).toBe(true); // vorhandene Firma nie angefasst
    const l = await (await mandate.GET!(anfrage('/api/crm/mandate-tabelle', 'pa'))).json();
    expect(l.laeufe.find((x: { id: string }) => x.id === lauf1)?.status).toBe('teilweise');
    // Ein ganz neuer Lauf, sofort zurück: Mandat UND neue Firma sind ganz weg (über den Papierkorb, nicht darin liegen geblieben).
    const t = 'Kunde\tTitel\tHonorar\tGesellschaft\nWeg GmbH\tKurzprojekt\t300\tKD Ventures\n';
    const v3 = await post(mandate, '/api/crm/mandate-tabelle', 'pa', { aktion: 'vorschau', zeilen: mZeilen(t) });
    const u3 = await post(mandate, '/api/crm/mandate-tabelle', 'pa', { aktion: 'uebernehmen', zeilen: mZeilen(t), basis: v3.j.basis });
    expect(u3.j).toMatchObject({ ok: true, neu: 1, firmenNeu: 1 });
    expect((await crm()).mandate.find(x => x.kunde === 'Weg GmbH')?.gesellschaft).toBe('kdv');
    expect((await post(mandate, '/api/crm/mandate-tabelle', 'pa', { aktion: 'zurueck', laufId: u3.j.laufId })).j).toMatchObject({ ok: true, mandate: 1, firmen: 1, konflikte: 0 });
    const c3 = await crm();
    expect(c3.mandate.some(x => x.kunde === 'Weg GmbH')).toBe(false);
    expect(c3.firmen.some(f => f.name === 'Weg GmbH')).toBe(false);
    // Lauf-Protokoll ohne Namen und ohne Personen.
    const roh = JSON.stringify(await db.loadJson('mandate-tabelle-laeufe'));
    for (const t of ['Neu GmbH', 'Beispiel Werke', '"pa"']) expect(roh).not.toContain(t);
  });
});
