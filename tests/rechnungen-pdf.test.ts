// ─── Rechnungen schreiben mit PDF (08.10.) — Route /api/rechnung + Server ────
// Eigener Datenordner, gesetzter Datenschlüssel (Ablage verschlüsselt), Konten mit Test-Haushalt, alles erfunden
// (@example.invalid, öffentliche Beispiel-IBAN zusammengesetzt). Geprüft: Entwurf mit Stand, Pflichtangaben → 409, Stellen
// (Nummer lückenlos, PDF mit Pflichtangaben + SHA-256, Beleg nicht löschbar), festgeschrieben unveränderlich, gleichzeitige
// Aufrufe, Abbruch nach jedem Schritt, Stornorechnung (auch über den Finanzplan-Weg), Angebot → Rechnung, Mandat → Monats-
// entwurf, Mahnvorschlag + Aufgabe, Rechte (Business-Sicht bekommt nichts aus Privat, fremder Haushalt, Dienstweg).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { FinanzplanFile, Rechnung } from '@/lib/finanzen/finanzplan-bestand';
import type { Angebot, CrmBestand, Mandat } from '@/lib/crm/typen';
import type { Kontakt } from '@/lib/make-one/crm';

const IBAN = ['DE89', '3704', '0044', '0532', '0130', '00'].join('');
const IBAN_LESBAR = ['DE89', '3704', '0044', '0532', '0130', '00'].join(' ');

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-rechnung-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-rechnung';
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-nur-fuer-den-rechnungs-test';

type H = (r: Request) => Promise<Response>;
let route: { GET: H; POST: H };
let finanzplan: { PATCH: H };
let db: typeof import('@/lib/store/local-db');
let server: typeof import('@/lib/finanzen/rechnung/server');
let ablage: typeof import('@/lib/dateien/ablage');
let localDay: () => string;
let JAHR = 0;

const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
const dienst = (person: string) => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': person });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Antwort = { status: number; d: Record<string, any> };
const post = async (body: Record<string, unknown>, kopf: Record<string, string> = sitzung('kevin')): Promise<Antwort> => {
  const r = await route.POST(new Request('http://test/api/rechnung', { method: 'POST', headers: kopf, body: JSON.stringify(body) }));
  return { status: r.status, d: await r.json() };
};
const holen = async (person = 'kevin', q = ''): Promise<Antwort> => {
  const r = await route.GET(new Request(`http://test/api/rechnung${q}`, { headers: sitzung(person) }));
  return { status: r.status, d: r.headers.get('content-type')?.includes('json') ? await r.json() : { bytes: new Uint8Array(await r.arrayBuffer()) } };
};
const plan = async () => (await db.loadJson<FinanzplanFile>('finanzplan'))!;
const rechnung = async (id: string) => (await plan()).rechnungen.find(r => r.id === id)!;
const zaehler = async () => (await db.loadJson<{ zaehler?: Record<string, number> }>('rechnungswesen'))?.zaehler ?? {};
const nr = (n: number, kurz = 'KDV') => `${kurz}-R-${JAHR}-${String(n).padStart(4, '0')}`;

async function pdfText(bytes: Uint8Array): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs') as unknown as { getDocument: (o: object) => { promise: Promise<{ numPages: number; getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: { str?: string }[] }> }> }> } };
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, disableFontFace: true }).promise;
  let text = '';
  for (let i = 1; i <= doc.numPages; i++) text += (await (await doc.getPage(i)).getTextContent()).items.map(x => x.str ?? '').join(' ') + '\n';
  return text;
}

/** Ein vollständiger Entwurf (frei) für Gesellschaft g — angelegt und mit allen Pflichtangaben gespeichert. */
async function fertigerEntwurf(g = 'kdv', person = 'kevin'): Promise<Rechnung & { fassung: string }> {
  const n = await post({ aktion: 'neu', quelle: 'frei', firmaId: g, kontaktId: 'c-anna1' }, sitzung(person));
  expect(n.status, JSON.stringify(n.d)).toBe(200);
  const s = await post({ aktion: 'speichern', id: n.d.rechnung.id, stand: n.d.rechnung.fassung, felder: { leistungVon: '2026-10-01', leistungBis: '2026-10-31', positionen: [{ id: 'p1', titel: 'Beratung Oktober', text: 'Zwei Workshops', menge: 2, einheit: 'Tag', einzelpreisCent: 120000, ustSatz: 19 }] } }, sitzung(person));
  expect(s.status, JSON.stringify(s.d)).toBe(200);
  return s.d.rechnung;
}

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  ablage = await import('@/lib/dateien/ablage');
  ({ localDay } = await import('@/lib/zeit'));
  JAHR = Number(localDay().slice(0, 4));
  const speicher = await import('@/lib/crm/speicher');
  const konto = (id: string, sp: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) => ({ id, speicher: sp, email: `${sp}@example.invalid`, name: `${sp} Test`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...extra });
  await db.saveJson('konten', { konten: [
    konto('k1', 'kevin', 'inhaber', { haushalt: 'test-haus' }), konto('k2', 'malin', 'mitglied', { haushalt: 'test-haus' }),
    konto('k3', 'partner', 'mitglied', { haushalt: 'test-haus', finanzRecht: 'business' }), konto('k4', 'gast', 'mitglied', { haushalt: 'anderer-haus' }),
  ], einladungen: [] });
  const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id, vorname: 'Anna', nachname: 'Test', email: `${id}@example.invalid`, eignung: '', prio: '', stufe: 'gewonnen', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', ...x });
  await db.saveJson('kontakte', { kontakte: [k('c-anna1', { firmaId: 'f-muster', firma: 'Muster GmbH' })] });
  const J = '2026-09-01T10:00:00.000Z';
  const mandat = { id: 'm-test1', kunde: 'Muster GmbH', firmaId: 'f-muster', kontaktIds: ['c-anna1'], titel: 'Begleitung', art: 'retainer', gesellschaft: 'kdv', status: 'aktiv', vertragUnterschrieben: true, verlaengerung: 'auto', honorar: { betrag: 2500, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 10, ziele: [], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: ['Jour fixe'], offen: [], geaendert: J } as unknown as Mandat;
  const angebot = (id: string, status: Angebot['status']): Angebot => ({ id, gesellschaft: 'kdv', kontaktId: 'c-anna1', firmaId: 'f-muster', mandatId: 'm-test1', titel: 'Strategie-Sprint', nummer: `KDV-A-${JAHR}-0001`, positionen: [{ id: 'p1', titel: 'Sprint', text: 'Analyse', menge: 1, einheit: 'pauschal', einzelpreisCent: 500000, ustSatz: 19, basis: 'einmalig' }], einleitung: '', schluss: '', gueltigBis: '2026-12-31', zahlungszielTage: 21, status, version: 1, gestelltAm: J, angelegt: J, geaendert: J } as Angebot);
  await db.saveJson('crm', { ...speicher.leererBestand(), firmen: [{ id: 'f-muster', name: 'Muster GmbH', rolle: 'kunde', geaendert: J, zahlung: { empfaenger: { anschrift: 'Hauptstraße 5, 54321 Beispielstadt' }, referenz: 'PO-7' } }], mandate: [mandat], angebote: [angebot('ang-test-angenommen', 'angenommen'), angebot('ang-test-gestellt', 'gestellt')] } as unknown as CrmBestand);
  const absender = (id: string, x: Record<string, unknown> = {}) => ({ id, firmierung: `Beispiel ${id.toUpperCase()}`, strasse: 'Beispielweg 1', plz: '12345', ort: 'Musterstadt', email: 'info@example.invalid', steuernummer: '12/345/67890', bank: { iban: IBAN, bic: 'COBADEFFXXX', bank: 'Beispielbank' }, ...x });
  await db.saveJson('gesellschaften--test-haus', { gesellschaften: [
    absender('kdv', { firmierung: 'Beispiel Ventures UG (haftungsbeschränkt)', geschaeftsfuehrung: 'Erika Beispiel', register: 'Amtsgericht Musterstadt HRB 1' }),
    absender('kdc', { firmierung: 'Beispiel Beratung' }),
    { id: 'ug', firmierung: 'Beispiel GmbH' },
  ] });
  const { SEED } = await import('@/lib/finanzen/finanzplan-bestand');
  await db.saveJson('finanzplan', SEED);
  route = (await import('@/app/api/rechnung/route')) as unknown as { GET: H; POST: H };
  finanzplan = (await import('@/app/api/state/finanzplan/route')) as unknown as { PATCH: H };
  server = await import('@/lib/finanzen/rechnung/server');
});
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten();
  rmSync(ordner, { recursive: true, force: true });
});

describe('Entwurf: anlegen, speichern mit Stand, Pflichtangaben', () => {
  it('legt einen Entwurf an — Empfänger aus der Kartei, Status geplant, ohne Nummer', async () => {
    const n = await post({ aktion: 'neu', quelle: 'frei', firmaId: 'kdv', kontaktId: 'c-anna1' });
    expect(n.status).toBe(200);
    expect(n.d.rechnung).toMatchObject({ status: 'geplant', firmaId: 'kdv', kunde: 'Muster GmbH', positionen: [], empfaenger: { firma: 'Muster GmbH', name: 'Anna Test', strasse: 'Hauptstraße 5', plz: '54321', ort: 'Beispielstadt', referenz: 'PO-7' } });
    expect(n.d.rechnung.nummer).toBeUndefined();
    // Veralteter Stand → 409 mit dem aktuellen Entwurf, nichts überschrieben.
    const a = await post({ aktion: 'speichern', id: n.d.rechnung.id, stand: n.d.rechnung.fassung, felder: { titel: 'Erste' } });
    expect(a.status).toBe(200);
    const b = await post({ aktion: 'speichern', id: n.d.rechnung.id, stand: n.d.rechnung.fassung, felder: { titel: 'Zweite' } }, sitzung('malin'));
    expect(b.status).toBe(409);
    expect(b.d.aktuell.titel).toBe('Erste');
    expect((await rechnung(n.d.rechnung.id)).titel).toBe('Erste');
  });
  it('Pflichtangaben fehlen → 409 mit Liste und Weg, keine Nummer verbraucht', async () => {
    const n = await post({ aktion: 'neu', quelle: 'frei', firmaId: 'kdv' });
    const r = await post({ aktion: 'stellen', id: n.d.rechnung.id, stand: n.d.rechnung.fassung });
    expect(r.status).toBe(409);
    expect(r.d.grund).toBe('pflichtangaben');
    expect(r.d.fehlt.map((f: { text: string }) => f.text).join(' | ')).toMatch(/Empfänger[^]*Anschrift[^]*Leistungsdatum[^]*Position/);
    // Absender unvollständig (ug): der Weg führt ins Register.
    const u = await post({ aktion: 'neu', quelle: 'frei', firmaId: 'ug', kontaktId: 'c-anna1' });
    const ru = await post({ aktion: 'stellen', id: u.d.rechnung.id, stand: u.d.rechnung.fassung });
    expect(ru.status).toBe(409);
    expect(ru.d.fehlt.some((f: { weg?: string }) => f.weg === '/os/unternehmen?g=ug&r=absender')).toBe(true);
    expect(await zaehler()).toEqual({});
    expect((await plan()).rechnungen.every(x => !x.nummer)).toBe(true);
  });
});

describe('Stellen: Nummer + PDF in einer Sperre', () => {
  let gestellt: Rechnung & { fassung: string };
  let pdfId = '';
  it('vergibt die erste Nummer, schreibt PDF (verschlüsselt, Prüfsumme) und Beleg', async () => {
    const e = await fertigerEntwurf();
    expect(e).toMatchObject({ betrag: 2856, netto: 2400, ustSatz: 19 });
    const r = await post({ aktion: 'stellen', id: e.id, stand: e.fassung, anfrageId: 'anf-test-stellen-1' });
    expect(r.status, JSON.stringify(r.d)).toBe(200);
    gestellt = r.d.rechnung; pdfId = r.d.pdf.id;
    expect(gestellt).toMatchObject({ status: 'gestellt', nummer: nr(1), datum: localDay(), lauf: { jahr: JAHR, nr: 1 }, gestelltVon: 'kevin', betrag: 2856, pdfDateiId: pdfId });
    expect(gestellt.absender!.fuss.join(' ')).toContain('DE89 •••• •••• 3000'); // Momentaufnahme maskiert …
    expect(r.d.mail).toMatchObject({ an: 'c-anna1@example.invalid', betreff: `Rechnung ${nr(1)} – ${gestellt.titel}` });
    const d = (await ablage.lesen('test-haus', pdfId))!;
    expect(d.eintrag).toMatchObject({ art: 'rechnung', rechnungsPdf: e.id, rechnungId: e.id, kontaktId: 'c-anna1', firmaId: 'f-muster', datei: { typ: 'application/pdf', verschluesselt: true } });
    expect(readFileSync(ablage.dateiPfad('test-haus', pdfId)).subarray(0, 7).toString('ascii')).toMatch(/^MKOSDAT/);
    expect(createHash('sha256').update(d.bytes).digest('hex')).toBe(gestellt.sha256);
    // … im PDF stehen die Pflichtangaben, die IBAN voll.
    const t = await pdfText(d.bytes);
    for (const w of [nr(1), 'Rechnungsdatum', 'Leistungszeitraum', '01.10.2026', '31.10.2026', 'Beispiel Ventures UG', 'Muster GmbH', 'Hauptstraße 5', '54321 Beispielstadt', 'Steuernummer 12/345/67890', IBAN_LESBAR, '19 % USt', '2.856,00', 'Fällig am', 'Erika Beispiel', 'HRB 1']) expect(t, w).toContain(w);
    expect(await zaehler()).toEqual({ [`kdv-${JAHR}`]: 1 });
  });
  it('dieselbe Anfrage noch einmal → dieselbe Antwort, keine zweite Nummer', async () => {
    const r = await post({ aktion: 'stellen', id: gestellt.id, stand: 'egal', anfrageId: 'anf-test-stellen-1' });
    expect(r.status).toBe(200);
    expect(r.d.rechnung.nummer).toBe(nr(1));
    const zweimal = await post({ aktion: 'stellen', id: gestellt.id, stand: gestellt.fassung });
    expect(zweimal.status).toBe(409);
    expect(await zaehler()).toEqual({ [`kdv-${JAHR}`]: 1 });
  });
  it('PDF-Download über die Route (attachment, nosniff, Sandbox)', async () => {
    const r = await route.GET(new Request(`http://test/api/rechnung?pdf=${gestellt.id}`, { headers: sitzung('malin') }));
    expect(r.status).toBe(200);
    expect(r.headers.get('content-disposition')).toContain(`Rechnung ${nr(1)}.pdf`);
    expect(r.headers.get('x-content-type-options')).toBe('nosniff');
    expect(r.headers.get('content-security-policy')).toContain('sandbox');
    expect(createHash('sha256').update(new Uint8Array(await r.arrayBuffer())).digest('hex')).toBe(gestellt.sha256);
  });
  it('festgeschrieben: Entwurf-Speichern, Finanzplan-Upsert und Löschen → 409; das PDF ist nicht löschbar', async () => {
    expect((await post({ aktion: 'speichern', id: gestellt.id, stand: gestellt.fassung, felder: { titel: 'anders' } })).status).toBe(409);
    expect((await post({ aktion: 'loeschen', id: gestellt.id, stand: gestellt.fassung })).status).toBe(409);
    const vorher = JSON.stringify(await rechnung(gestellt.id));
    const patch = async (op: Record<string, unknown>) => (await finanzplan.PATCH(new Request('http://test/api/state/finanzplan', { method: 'PATCH', headers: sitzung('kevin'), body: JSON.stringify({ ops: [op] }) }))).status;
    expect(await patch({ liste: 'rechnungen', op: 'upsert', eintrag: { ...gestellt, positionen: [{ titel: 'Billiger', menge: 1, einzelpreisCent: 1, ustSatz: 19 }] }, stand: gestellt.fassung })).toBe(409);
    expect(await patch({ liste: 'rechnungen', op: 'upsert', eintrag: { ...gestellt, titel: 'Umbenannt' }, stand: gestellt.fassung })).toBe(409);
    expect(await patch({ liste: 'rechnungen', op: 'delete', id: gestellt.id, stand: gestellt.fassung })).toBe(409);
    expect(JSON.stringify(await rechnung(gestellt.id))).toBe(vorher);
    await expect(ablage.entfernen('test-haus', pdfId)).rejects.toMatchObject({ status: 409 });
    // Vom Bezug lösen geht auch nicht — der Bezug zur Rechnung bleibt fest.
    const geaendert = await ablage.aendern('test-haus', 'kevin', pdfId, { rechnungId: null, mandatId: null });
    expect(geaendert).toMatchObject({ rechnungId: gestellt.id, rechnungsPdf: gestellt.id });
  });
  it('Status-Klick „geplant → gestellt“ am Entwurf mit Positionen → 409 (nur „Rechnung stellen“)', async () => {
    const e = await fertigerEntwurf();
    const r = await finanzplan.PATCH(new Request('http://test/api/state/finanzplan', { method: 'PATCH', headers: sitzung('kevin'), body: JSON.stringify({ ops: [{ liste: 'rechnungen', op: 'upsert', eintrag: { ...e, status: 'gestellt', nummer: 'HAND-1' }, stand: e.fassung }] }) }));
    expect(r.status).toBe(409);
    expect((await rechnung(e.id)).status).toBe('geplant');
    await post({ aktion: 'loeschen', id: e.id, stand: (await post({ aktion: 'speichern', id: e.id, stand: e.fassung, felder: {} })).d.rechnung.fassung });
    expect((await plan()).rechnungen.some(x => x.id === e.id)).toBe(false);
  });
});

describe('Lückenlos: gleichzeitig und nach Abbruch in jedem Schritt', () => {
  it('zwei gleichzeitige Stellen-Aufrufe → zwei aufeinanderfolgende Nummern', async () => {
    const [a, b] = [await fertigerEntwurf(), await fertigerEntwurf()];
    const [ra, rb] = await Promise.all([post({ aktion: 'stellen', id: a.id, stand: a.fassung }), post({ aktion: 'stellen', id: b.id, stand: b.fassung })]);
    expect([ra.status, rb.status]).toEqual([200, 200]);
    expect([ra.d.rechnung.nummer, rb.d.rechnung.nummer].sort()).toEqual([nr(2), nr(3)]);
    // Dieselbe Rechnung zweimal gleichzeitig → eine Nummer, ein 409.
    const c = await fertigerEntwurf();
    const doppelt = await Promise.all([post({ aktion: 'stellen', id: c.id, stand: c.fassung }), post({ aktion: 'stellen', id: c.id, stand: c.fassung })]);
    expect(doppelt.map(x => x.status).sort()).toEqual([200, 409]);
    expect(doppelt.find(x => x.status === 200)!.d.rechnung.nummer).toBe(nr(4));
    expect(await zaehler()).toEqual({ [`kdv-${JAHR}`]: 4 });
  });
  for (const schritt of ['nachPdf', 'nachAblage', 'nachFestschreiben'] as const) {
    it(`Abbruch ${schritt}: keine Lücke, kein doppeltes PDF`, async () => {
      const vorher = Math.max(0, ...(await plan()).rechnungen.filter(r => r.firmaId === 'kdv' && r.lauf?.jahr === JAHR).map(r => r.lauf!.nr));
      const e = await fertigerEntwurf();
      server.rechnungTest[schritt] = () => { throw new Error(`Abbruch ${schritt}`); };
      try {
        await expect(server.rechnungStellen({ id: e.id, stand: e.fassung, person: 'kevin', haushalt: 'test-haus', sicht: 'privat' })).rejects.toThrow(`Abbruch ${schritt}`);
      } finally { delete server.rechnungTest[schritt]; }
      const nach = await rechnung(e.id);
      if (schritt === 'nachFestschreiben') {
        // Festgeschrieben, nur der Zähler hinkt — die nächste Rechnung zählt trotzdem lückenlos weiter.
        expect(nach).toMatchObject({ status: 'gestellt', nummer: nr(vorher + 1) });
        const f = await fertigerEntwurf();
        expect((await post({ aktion: 'stellen', id: f.id, stand: f.fassung })).d.rechnung.nummer).toBe(nr(vorher + 2));
      } else {
        expect(nach.status).toBe('geplant');
        expect(nach.nummer).toBeUndefined();
        const stand = (await holen()).d.rechnungen.find((x: Rechnung & { fassung: string }) => x.id === e.id).fassung;
        const r = await post({ aktion: 'stellen', id: e.id, stand });
        expect(r.status, JSON.stringify(r.d)).toBe(200);
        expect(r.d.rechnung.nummer).toBe(nr(vorher + 1));
        const pdfs = (await ablage.ablageListe('test-haus')).filter(x => x.rechnungsPdf === e.id);
        expect(pdfs.map(x => x.id)).toEqual([r.d.pdf.id]);
      }
      const nummern = (await plan()).rechnungen.filter(r => r.firmaId === 'kdv' && r.lauf?.jahr === JAHR).map(r => r.lauf!.nr).sort((a, b) => a - b);
      expect(nummern).toEqual(nummern.map((_, i) => i + 1));
    });
  }
});

describe('Storno = Stornorechnung mit eigener Nummer und PDF', () => {
  it('über die Route: Original storniert, Stornorechnung negativ mit nächster Nummer; Gegenbuchung bei Zahlungseingang', async () => {
    const e = await fertigerEntwurf();
    const g = await post({ aktion: 'stellen', id: e.id, stand: e.fassung });
    const vorNr = g.d.rechnung.lauf.nr as number;
    // bezahlt (Buchung bu-re-…), dann storniert → Gegenbuchung bu-st-…
    const bez = await finanzplan.PATCH(new Request('http://test/api/state/finanzplan', { method: 'PATCH', headers: sitzung('kevin'), body: JSON.stringify({ aktion: 'bezahlt', rechnungId: e.id, am: localDay() }) }));
    expect(bez.status).toBe(200);
    expect((await post({ aktion: 'storno', id: e.id, grund: 'x' })).status).toBe(400);
    const s = await post({ aktion: 'storno', id: e.id, grund: 'Doppelt gestellt', anfrageId: 'anf-test-storno-1' });
    expect(s.status, JSON.stringify(s.d)).toBe(200);
    expect(s.d.original).toMatchObject({ status: 'storniert', stornoGrund: 'Doppelt gestellt', stornoRechnungId: s.d.storno.id });
    expect(s.d.storno).toMatchObject({ art: 'storno', status: 'storniert', stornoZu: e.id, nummer: nr(vorNr + 1), betrag: -2856, netto: -2400 });
    expect(s.d.gegenbuchung).toBe('neu');
    const buchungen = (await db.loadJson<{ buchungen: { id: string; betrag: number }[] }>('buchungen'))!.buchungen;
    expect(buchungen.find(b => b.id === `bu-st-${e.id}`.slice(0, 40))!.betrag).toBe(-2856);
    const t = await pdfText((await ablage.lesen('test-haus', s.d.storno.pdfDateiId))!.bytes);
    for (const w of ['Stornorechnung', nr(vorNr + 1), g.d.rechnung.nummer, '-2.856,00']) expect(t, w).toContain(w);
    // Noch einmal → dieselbe Stornorechnung (idempotent), keine neue Nummer.
    const wieder = await post({ aktion: 'storno', id: e.id, grund: 'Doppelt gestellt' });
    expect(wieder.d.storno.id).toBe(s.d.storno.id);
    expect(wieder.d.schonStorniert).toBe(true);
  });
  it('über den Finanzplan-Weg (aktion storno) bekommt eine PDF-Rechnung ebenfalls die Stornorechnung; der Dienstweg nicht', async () => {
    const e = await fertigerEntwurf();
    const g = await post({ aktion: 'stellen', id: e.id, stand: e.fassung });
    const patch = (kopf: Record<string, string>) => finanzplan.PATCH(new Request('http://test/api/state/finanzplan', { method: 'PATCH', headers: kopf, body: JSON.stringify({ aktion: 'storno', rechnungId: e.id, grund: 'Falscher Betrag' }) }));
    expect((await patch(dienst('kevin'))).status).toBe(403);
    const r = await patch(sitzung('malin'));
    const d = await r.json() as { ok: boolean; stornoRechnung: Rechnung };
    expect(r.status).toBe(200);
    expect(d.stornoRechnung).toMatchObject({ art: 'storno', stornoZu: e.id, nummer: nr((g.d.rechnung.lauf.nr as number) + 1) });
  });
});

describe('Angebot → Rechnung, Mandat → Monatsentwurf', () => {
  it('aus dem angenommenen Angebot: Positionen, Kunde, Mandat, Gesellschaft, Angebotsnummer — zweimal = derselbe Entwurf', async () => {
    const a = await post({ aktion: 'neu', quelle: 'angebot', angebotId: 'ang-test-angenommen' });
    expect(a.status).toBe(200);
    expect(a.d.rechnung).toMatchObject({ firmaId: 'kdv', mandatId: 'm-test1', kontaktId: 'c-anna1', kundeFirmaId: 'f-muster', angebotId: 'ang-test-angenommen', angebot: `KDV-A-${JAHR}-0001`, zahlungszielTage: 21, betrag: 5950, positionen: [{ titel: 'Sprint', einzelpreisCent: 500000, ustSatz: 19 }] });
    expect((await post({ aktion: 'neu', quelle: 'angebot', angebotId: 'ang-test-angenommen' })).d).toMatchObject({ vorhanden: true, rechnung: { id: a.d.rechnung.id } });
    expect((await post({ aktion: 'neu', quelle: 'angebot', angebotId: 'ang-test-gestellt' })).status).toBe(409);
  });
  it('Monatsrechnung aus dem Mandat: Leistungsmonat, Honorar netto, nie gestellt — je Monat einer', async () => {
    const m = await post({ aktion: 'neu', quelle: 'mandat', mandatId: 'm-test1', monat: '2026-09' });
    expect(m.status).toBe(200);
    expect(m.d.rechnung).toMatchObject({ status: 'geplant', leistungVon: '2026-09-01', leistungBis: '2026-09-30', mandatId: 'm-test1', zahlungszielTage: 10, betrag: 2975, positionen: [{ einheit: 'Monat', einzelpreisCent: 250000, text: '• Jour fixe' }] });
    expect(m.d.rechnung.nummer).toBeUndefined();
    expect((await post({ aktion: 'neu', quelle: 'mandat', mandatId: 'm-test1', monat: '2026-09' })).d).toMatchObject({ vorhanden: true, rechnung: { id: m.d.rechnung.id } });
    expect((await post({ aktion: 'neu', quelle: 'mandat', mandatId: 'm-test1', monat: '2026-10' })).d.vorhanden).toBe(false);
  });
});

describe('Mahnstufen — Vorschlag, Aufgabe ohne Betrag, Versand nur per Klick', () => {
  let id = '';
  it('überfällige Rechnung → Vorschlag „Zahlungserinnerung“; Morgenlauf legt EINE Aufgabe an', async () => {
    const e = await fertigerEntwurf();
    id = (await post({ aktion: 'stellen', id: e.id, stand: e.fassung })).d.rechnung.id;
    await db.updateJson<FinanzplanFile>('finanzplan', f => ({ ...f!, rechnungen: f!.rechnungen.map(r => (r.id === id ? { ...r, faellig: '2026-01-01' } : r)) }));
    const g = await holen();
    expect(g.d.mahnvorschlaege.find((v: { rechnungId: string }) => v.rechnungId === id)).toMatchObject({ stufe: 1, label: 'Zahlungserinnerung' });
    expect((await server.mahnAufgabenNachziehen()).neu).toBeGreaterThanOrEqual(1);
    expect((await server.mahnAufgabenNachziehen()).neu).toBe(0);
    const t = ((await db.loadJson<{ tasks: { id: string; title: string }[] }>('tasks'))?.tasks ?? []).find(x => x.id === `mahn-${id}-1`)!;
    expect(t.title).toMatch(/^Zahlungserinnerung vorbereiten — Rechnung /);
    expect(t.title).not.toMatch(/€|\d+,\d\d/);
  });
  it('Versand per Klick: Stufe vermerkt + Mail-Entwurf; Stufen nur der Reihe nach; Dienstweg 403', async () => {
    expect((await post({ aktion: 'mahnung', id, stufe: 3 })).status).toBe(409);
    expect((await post({ aktion: 'mahnung', id, stufe: 1 }, dienst('kevin'))).status).toBe(403);
    const m = await post({ aktion: 'mahnung', id, stufe: 1, anfrageId: 'anf-test-mahnung-1' });
    expect(m.status).toBe(200);
    expect(m.d.mail.betreff).toMatch(/^Zahlungserinnerung: Rechnung /);
    expect(m.d.rechnung.mahnungen).toEqual([{ stufe: 1, am: localDay(), von: 'kevin' }]);
    expect((await post({ aktion: 'mahntage', tage: [3, 2, 1] })).status).toBe(400);
    expect((await post({ aktion: 'mahntage', tage: [5, 10, 15] })).d.mahnTage).toEqual([5, 10, 15]);
  });
});

describe('Rechte: Business-Sicht bekommt nichts aus Privat, fremder Haushalt, Dienstweg', () => {
  let privatId = '';
  it('Rechnung der Selbstständigkeit (kdc, Privat) — gestellt von einem vollen Mitglied', async () => {
    const e = await fertigerEntwurf('kdc', 'malin');
    const r = await post({ aktion: 'stellen', id: e.id, stand: e.fassung }, sitzung('malin'));
    expect(r.status, JSON.stringify(r.d)).toBe(200);
    expect(r.d.rechnung.nummer).toBe(nr(1, 'KDC'));
    privatId = e.id;
  });
  it('Partner (finanzRecht business): sieht nur Business-Gesellschaften — keine kdc-Rechnung, kein kdc-Absender, kein PDF, kein Schreiben', async () => {
    const g = await holen('partner');
    expect(g.status).toBe(200);
    expect(g.d.sicht).toBe('business');
    expect(g.d.rechnungen.length).toBeGreaterThan(0);
    expect(g.d.rechnungen.every((r: Rechnung) => r.firmaId === 'kdv' || r.firmaId === 'ug')).toBe(true);
    expect(JSON.stringify(g.d)).not.toContain(privatId);
    expect(JSON.stringify(g.d)).not.toContain('Beispiel Beratung');
    expect(g.d.gesellschaften.map((x: { id: string }) => x.id).sort()).toEqual(['kdv', 'ug']);
    expect((await holen('partner', `?pdf=${privatId}`)).status).toBe(404);
    expect((await post({ aktion: 'neu', quelle: 'frei', firmaId: 'kdc' }, sitzung('partner'))).status).toBe(403);
    expect((await post({ aktion: 'storno', id: privatId, grund: 'Versuch' }, sitzung('partner'))).status).toBe(404);
    expect((await post({ aktion: 'mahntage', tage: [1, 2, 3] }, sitzung('partner'))).status).toBe(403);
    // Ein Business-Entwurf geht.
    expect((await post({ aktion: 'neu', quelle: 'frei', firmaId: 'kdv' }, sitzung('partner'))).status).toBe(200);
  });
  it('fremder Haushalt und Dienstweg: 403 — die Absender-Antwort trägt nie die volle IBAN', async () => {
    expect((await holen('gast')).status).toBe(403);
    expect((await post({ aktion: 'neu', quelle: 'frei', firmaId: 'kdv' }, sitzung('gast'))).status).toBe(403);
    const e = await fertigerEntwurf();
    expect((await post({ aktion: 'stellen', id: e.id, stand: e.fassung }, dienst('kevin'))).status).toBe(403);
    expect((await rechnung(e.id)).status).toBe('geplant');
    expect(JSON.stringify((await holen('kevin')).d)).not.toContain(IBAN);
  });
  it('Art. 15: die Auskunft nennt die Rechnungen an die Person', async () => {
    const { personAufzaehlen } = await import('@/lib/crm/person-bestaende');
    const a = await personAufzaehlen('c-anna1') as unknown as { rechnungen: { nummer?: string }[] };
    expect(a.rechnungen.some(r => r.nummer === nr(1))).toBe(true);
  });
});
