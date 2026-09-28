// ─── Angebots-Tool (28.09.): Route /api/crm/angebot + Gesellschaften + Verbindungen ──
// Eigener Datenordner, Dienstschlüssel + Person, Konten mit Test-Haushalt, gesetzter
// Datenschlüssel (Ablage verschlüsselt). Alle Daten erfunden (@example.invalid).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Angebot, Chance, CrmBestand, Leistung } from '@/lib/crm/typen';
import type { Kontakt } from '@/lib/make-one/crm';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-angebot-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-angebot';
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-nur-fuer-den-angebots-test';

type Route = { GET: (r: Request) => Promise<Response>; POST: (r: Request) => Promise<Response>; PATCH?: (r: Request) => Promise<Response>; DELETE?: (r: Request) => Promise<Response> };
let angebot: Route, gesellschaften: Route, bestand: Route, lead: Route;
let db: typeof import('@/lib/store/local-db');
let speicher: typeof import('@/lib/crm/speicher');
let ablage: typeof import('@/lib/dateien/ablage');

const kopf = (person?: string) => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, ...(person ? { 'x-make-person': person } : {}) });
const post = async (body: Record<string, unknown>, person = 'kevin') => { const r = await angebot.POST(new Request('http://test/api/crm/angebot', { method: 'POST', headers: kopf(person), body: JSON.stringify(body) })); return { status: r.status, d: await r.json() as Record<string, any> }; }; // eslint-disable-line @typescript-eslint/no-explicit-any
const crm = () => speicher.ladeCrm();
const kontakte = async () => (await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte;

const J = '2026-09-01T10:00:00.000Z';
const L: Leistung = { id: 'l-strategie', name: 'Strategie-Retainer', typ: 'retainer', stufe: 'kern', preis: { betrag: 2500, einheit: 'Monat netto', basis: 'monat' }, laufzeitMonate: 6, lieferumfang: [], gesellschaft: 'kdv', status: 'aktiv', angebot: { leistungstext: 'Monatlich zwei Strategietermine, Vorbereitung und Protokoll.' }, geaendert: J };
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id, vorname: 'Anna', nachname: `Test ${id}`, email: `${id}@example.invalid`, eignung: '', prio: '', stufe: 'gespraech', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', ...x });

async function pdfText(bytes: Uint8Array): Promise<{ seiten: number; text: string }> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs') as unknown as { getDocument: (o: object) => { promise: Promise<{ numPages: number; getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: { str?: string }[] }> }> }> } };
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, disableFontFace: true }).promise;
  let text = '';
  for (let i = 1; i <= doc.numPages; i++) text += (await (await doc.getPage(i)).getTextContent()).items.map(x => x.str ?? '').join(' ') + '\n';
  return { seiten: doc.numPages, text };
}
const neuerEntwurf = async (felder: Record<string, unknown>, id?: string) => {
  const r = await post({ aktion: 'speichern', ...(id ? { id } : {}), felder: { gesellschaft: 'kdv', titel: 'Strategie-Retainer 2027', positionen: [{ id: 'p1', leistungId: 'l-strategie', titel: 'Strategie', text: 'Text', menge: 1, einheit: 'Monat', einzelpreisCent: 250000, ustSatz: 19, basis: 'monat', laufzeitMonate: 6 }, { id: 'p2', titel: 'Kickoff', text: '', menge: 1, einheit: 'pauschal', einzelpreisCent: 90000, rabattProzent: 10, ustSatz: 19, basis: 'einmalig' }], ...felder } });
  expect(r.status).toBe(200);
  return r.d.angebot as Angebot & { stand: string };
};

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  speicher = await import('@/lib/crm/speicher');
  ablage = await import('@/lib/dateien/ablage');
  await db.saveJson('konten', { konten: [
    { id: 'k1', speicher: 'kevin', email: 'k@test', name: 'Kevin Test', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'test-haus' },
    { id: 'k2', speicher: 'malin', email: 'm@test', name: 'Malin Test', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'test-haus' },
    { id: 'k3', speicher: 'gast', email: 'g@test', name: 'Gast', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'anderer-haus' },
  ], einladungen: [] });
  await db.saveJson('kontakte', { kontakte: [
    k('c-anna1', { firmaId: 'f-muster', firma: 'Muster GmbH', anrede: 'Sie' }),
    k('c-bert1', { vorname: 'Bert', anrede: 'Du' }),
    k('c-sperre1', { werbesperre: { seit: '2026-09-01', grund: 'Widerspruch' } }),
    k('c-dora1'),
  ] });
  await db.saveJson('crm', { ...speicher.leererBestand(), firmen: [{ id: 'f-muster', name: 'Muster GmbH', rolle: 'zielkunde', geaendert: J }], leistungen: [L, { ...L, id: 'l-roh', name: 'Ohne Text', status: 'entwurf', angebot: undefined }] });
  await db.saveJson('gesellschaften--test-haus', { gesellschaften: [{ id: 'kdv', firmierung: 'Beispiel Ventures UG (haftungsbeschränkt)', strasse: 'Beispielweg 1', plz: '12345', ort: 'Musterstadt', email: 'info@example.invalid', steuernummer: '12/345/67890', bank: { iban: 'DE89370400440532013000' } }] });
  angebot = (await import('@/app/api/crm/angebot/route')) as unknown as Route;
  gesellschaften = (await import('@/app/api/crm/gesellschaften/route')) as unknown as Route;
  bestand = (await import('@/app/api/crm/bestand/route')) as unknown as Route;
  lead = (await import('@/app/api/crm/lead/route')) as unknown as Route;
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Entwurf: speichern mit Stand', () => {
  it('legt an, ändert mit Stand; veralteter Stand → 409 mit aktuellem Angebot', async () => {
    const a = await neuerEntwurf({ kontaktId: 'c-anna1' }, 'ang-entwurf1');
    expect(a).toMatchObject({ id: 'ang-entwurf1', status: 'entwurf', version: 1, gesellschaft: 'kdv', zahlungszielTage: 14 });
    const r1 = await post({ aktion: 'speichern', id: a.id, stand: a.stand, felder: { titel: 'Neu' } });
    expect(r1.status).toBe(200);
    const r2 = await post({ aktion: 'speichern', id: a.id, stand: a.stand, felder: { titel: 'Anders' } }, 'malin');
    expect(r2.status).toBe(409);
    expect(r2.d.aktuell.titel).toBe('Neu');
    expect((await post({ aktion: 'speichern', id: a.id, felder: { titel: 'Ohne Stand' } })).status).toBe(409);
    expect((await crm()).angebote.find(x => x.id === a.id)!.titel).toBe('Neu');
  });
  it('Grenzen: zu viele Positionen → 413, nichts geschrieben', async () => {
    const r = await post({ aktion: 'speichern', felder: { titel: 'x', positionen: Array.from({ length: 201 }, (_, i) => ({ titel: `P${i}` })) } });
    expect(r.status).toBe(413);
  });
  it('der allgemeine Bestand-Weg lehnt Angebote ab (409)', async () => {
    const r = await bestand.PATCH!(new Request('http://test/api/crm/bestand', { method: 'PATCH', headers: kopf('kevin'), body: JSON.stringify({ ops: [{ liste: 'angebote', op: 'teil', id: 'ang-entwurf1', felder: { status: 'angenommen' } }] }) }));
    expect(r.status).toBe(409);
    expect((await crm()).angebote.find(x => x.id === 'ang-entwurf1')!.status).toBe('entwurf');
  });
  it('Produkt ohne Leistungstext → „aktiv“ abgelehnt (409)', async () => {
    const r = await bestand.PATCH!(new Request('http://test/api/crm/bestand', { method: 'PATCH', headers: kopf('kevin'), body: JSON.stringify({ ops: [{ liste: 'leistungen', op: 'teil', id: 'l-roh', felder: { status: 'aktiv' } }] }) }));
    expect(r.status).toBe(409);
    expect(((await r.json()) as { fehler: string }).fehler).toMatch(/Leistungstext/);
    expect((await crm()).leistungen.find(x => x.id === 'l-roh')!.status).toBe('entwurf');
  });
});

describe('Stellen: Nummer, PDF, Verbindungen', () => {
  let gestellt: Angebot & { stand: string };
  let pdfId = '';
  it('stellt fest: Nummer, PDF verschlüsselt in der Ablage, Prüfsumme, Deal/Follow-up/Aktivität/BEAN', async () => {
    const a = (await crm()).angebote.find(x => x.id === 'ang-entwurf1')!;
    const { standVon } = await import('@/lib/crm/crm-stand');
    const r = await post({ aktion: 'stellen', id: a.id, stand: standVon(a), nachfassenAm: '2026-12-01' });
    expect(r.status).toBe(200);
    gestellt = r.d.angebot;
    pdfId = r.d.pdf.id;
    const jahr = new Date().getFullYear();
    expect(gestellt).toMatchObject({ nummer: `KDV-A-${jahr}-0001`, status: 'gestellt', gestelltVon: 'kevin', lauf: { jahr, nr: 1 }, firmaId: 'f-muster' });
    expect(gestellt.absender?.fuss.join(' ')).toContain('DE89 •••• •••• 3000');
    expect(r.d.mail).toMatchObject({ an: 'c-anna1@example.invalid', betreff: `Angebot KDV-A-${jahr}-0001 – Neu` });
    // PDF: verschlüsselt auf der Platte, Text enthält die Nummer, Prüfsumme passt, Bezug Angebot/Kontakt/Firma/Deal.
    const d = (await ablage.lesen('test-haus', pdfId))!;
    expect(d.eintrag).toMatchObject({ art: 'angebot', angebotId: 'ang-entwurf1', kontaktId: 'c-anna1', firmaId: 'f-muster', dealId: gestellt.dealId, datei: { typ: 'application/pdf', verschluesselt: true } });
    expect(readFileSync(ablage.dateiPfad('test-haus', pdfId)).subarray(0, 8).toString('ascii')).toBe('MKOSDAT1');
    expect(createHash('sha256').update(d.bytes).digest('hex')).toBe(gestellt.pruefsumme);
    const p = await pdfText(new Uint8Array(d.bytes));
    expect(p.seiten).toBeGreaterThanOrEqual(1);
    expect(p.text).toContain(`KDV-A-${jahr}-0001`);
    expect(p.text).toContain('DE89 3704 0044 0532 0130 00'); // volle IBAN nur im PDF
    // Deal neu über dealAnlegen, Stufe Angebot, Wert aus dem Angebot, nächster Schritt = Nachfassen.
    const b = await crm();
    const deal = b.chancen.find(c => c.id === gestellt.dealId)!;
    expect(deal).toMatchObject({ stufe: 'angebot', wert: { betrag: 2500, basis: 'monat', laufzeitMonate: 6 }, naechsterSchritt: { datum: '2026-12-01' }, gesellschaft: 'kdv', firmaId: 'f-muster' });
    expect(b.followups.find(f => f.id === 'fu-ang-entwurf1')).toMatchObject({ faellig: '2026-12-01', status: 'offen', bezug: { art: 'chance', id: deal.id }, kontaktId: 'c-anna1' });
    const anna = (await kontakte()).find(x => x.id === 'c-anna1')!;
    expect(anna.aktivitaeten.some(x => x.art === 'mail' && x.text?.startsWith(`Angebot KDV-A-${jahr}-0001 gesendet`) && x.bezug === deal.id)).toBe(true);
    expect(anna.stufe).toBe('angebot');
    const { beanVon } = await import('@/lib/crm/bean');
    expect(beanVon(anna, b).bean).toBe('A');
  });
  it('gestellt = festgeschrieben: speichern/löschen/erneut stellen → 409; Ablage-PDF nicht löschbar', async () => {
    expect((await post({ aktion: 'speichern', id: gestellt.id, stand: gestellt.stand, felder: { titel: 'Änderung' } })).status).toBe(409);
    expect((await post({ aktion: 'loeschen', id: gestellt.id, stand: gestellt.stand })).status).toBe(409);
    expect((await post({ aktion: 'stellen', id: gestellt.id, stand: gestellt.stand })).status).toBe(409);
    await expect(ablage.entfernen('test-haus', pdfId)).rejects.toMatchObject({ status: 409 });
  });
  it('neue Version: Entwurf mit Bezug; gestellt → Vorgänger „ersetzt“, alte bleibt lesbar', async () => {
    const v = await post({ aktion: 'version', id: gestellt.id });
    expect(v.status).toBe(200);
    expect(v.d.angebot).toMatchObject({ status: 'entwurf', version: 2, vorgaengerId: gestellt.id, kontaktId: 'c-anna1', dealId: gestellt.dealId });
    expect((await post({ aktion: 'version', id: gestellt.id })).d.angebot.id).toBe(v.d.angebot.id); // kein zweiter Entwurf
    const s = await post({ aktion: 'stellen', id: v.d.angebot.id, stand: v.d.angebot.stand });
    expect(s.status).toBe(200);
    expect(s.d.angebot.nummer).toMatch(/-0002$/);
    const b = await crm();
    const alt = b.angebote.find(x => x.id === gestellt.id)!;
    expect(alt).toMatchObject({ status: 'ersetzt', nachfolgerId: v.d.angebot.id, nummer: gestellt.nummer, pruefsumme: gestellt.pruefsumme });
    expect(b.chancen.filter(c => c.kontaktIds.includes('c-anna1')).length).toBe(1); // derselbe Deal
    gestellt = s.d.angebot;
  });
  it('annehmen → Deal gewonnen, Follow-up erledigt; „Mandat anlegen“ vorbelegt aus dem Angebot', async () => {
    const r = await post({ aktion: 'annehmen', id: gestellt.id, stand: gestellt.stand });
    expect(r.status).toBe(200);
    const b = await crm();
    expect(b.chancen.find(c => c.id === gestellt.dealId)!.stufe).toBe('gewonnen');
    expect(b.followups.find(f => f.id === `fu-${gestellt.id}`)!.status).toBe('erledigt');
    const m = await lead.POST(new Request('http://test/api/crm/lead', { method: 'POST', headers: kopf('kevin'), body: JSON.stringify({ aktion: 'mandat', chanceId: gestellt.dealId }) }));
    expect(m.status).toBe(200);
    const mandat = (await crm()).mandate.find(x => x.chanceId === gestellt.dealId)!;
    expect(mandat).toMatchObject({ gesellschaft: 'kdv', honorar: { betrag: 2500, basis: 'monat' }, mindestlaufzeitMonate: 6, leistungId: 'l-strategie', zahlungszielTage: 14, rechnungsrhythmus: 'monatlich' });
  });
  it('ablehnen: Grund Pflicht (400), mit Grund → Deal verloren mit Grund', async () => {
    const e = await neuerEntwurf({ kontaktId: 'c-bert1', titel: 'Workshop' });
    const s = await post({ aktion: 'stellen', id: e.id, stand: e.stand });
    expect(s.status).toBe(200);
    expect((await post({ aktion: 'ablehnen', id: e.id, stand: s.d.angebot.stand })).status).toBe(400);
    const r = await post({ aktion: 'ablehnen', id: e.id, stand: s.d.angebot.stand, grund: 'Preis' });
    expect(r.status).toBe(200);
    expect(r.d.angebot).toMatchObject({ status: 'abgelehnt', grund: 'Preis' });
    expect((await crm()).chancen.find(c => c.id === s.d.angebot.dealId)).toMatchObject({ stufe: 'verloren', grund: 'Preis' });
  });
  it('Nummern lückenlos und parallel sicher (5 gleichzeitig)', async () => {
    const entwuerfe = await Promise.all([1, 2, 3, 4, 5].map(i => neuerEntwurf({ kontaktId: 'c-dora1', titel: `Parallel ${i}` })));
    const r = await Promise.all(entwuerfe.map(e => post({ aktion: 'stellen', id: e.id, stand: e.stand })));
    expect(r.map(x => x.status)).toEqual([200, 200, 200, 200, 200]);
    const nr = r.map(x => (x.d.angebot as Angebot).lauf!.nr).sort((a, b) => a - b);
    expect(nr).toEqual([4, 5, 6, 7, 8]);
    expect(new Set(r.map(x => x.d.angebot.nummer)).size).toBe(5);
    expect((await crm()).chancen.filter(c => c.kontaktIds.includes('c-dora1') && c.stufe === 'angebot').length).toBe(1); // ein Deal, nicht fünf
  });
  it('Kanal-Ampel: Werbesperre blockt das Stellen mit Grund (409), nichts vergeben', async () => {
    const e = await neuerEntwurf({ kontaktId: 'c-sperre1' });
    const r = await post({ aktion: 'stellen', id: e.id, stand: e.stand });
    expect(r.status).toBe(409);
    expect(r.d.fehler).toMatch(/Werbesperre/);
    expect((await crm()).angebote.find(x => x.id === e.id)!.status).toBe('entwurf');
  });
  it('Ablauf: nach „gültig bis“ wird gestellt → abgelaufen (beim Lesen)', async () => {
    const e = await neuerEntwurf({ kontaktId: 'c-bert1', titel: 'Läuft ab' });
    const s = await post({ aktion: 'stellen', id: e.id, stand: e.stand });
    const { aendereCrm } = speicher;
    await aendereCrm(b => ({ ...b, angebote: b.angebote.map(a => (a.id === e.id ? { ...a, gueltigBis: '2020-01-01' } : a)) }));
    const g = await angebot.GET(new Request('http://test/api/crm/angebot', { headers: kopf('kevin') }));
    const l = ((await g.json()) as { angebote: Angebot[] }).angebote;
    expect(l.find(x => x.id === s.d.angebot.id)).toMatchObject({ status: 'abgelaufen' });
  });
});

describe('Personenbezug und Verbindungsprüfung', () => {
  it('Art. 17: Entwürfe weg, gestellte bleiben ohne Personenbezug', async () => {
    const { personEntfernen } = await import('@/lib/crm/person-bestaende');
    await personEntfernen('c-anna1');
    const b = await crm();
    expect(b.angebote.some(a => a.kontaktId === 'c-anna1')).toBe(false);
    const geloest = b.angebote.filter(a => a.personGeloest);
    expect(geloest.length).toBeGreaterThanOrEqual(2);
    expect(geloest.every(a => a.status !== 'entwurf' && a.empfaenger?.name === '[Person gelöst]')).toBe(true);
    // Die PDFs bleiben (Geschäftsunterlage), der Personenbezug in der Ablage ist gelöst.
    const l = await ablage.ablageListe('test-haus');
    expect(l.filter(x => x.angebotId).every(x => x.kontaktId !== 'c-anna1')).toBe(true);
  });
  it('Verbindungsprüfung: tote Verweise und fehlende PDFs werden gemeldet', async () => {
    const { verbindungenPruefen } = await import('@/lib/crm/verbindungen');
    const b = await crm();
    const neu: CrmBestand = { ...b, angebote: [...b.angebote, { ...b.angebote[0], id: 'ang-kaputt', kontaktId: 'c-weg11', dealId: 'ch-weg', pdfDateiId: undefined, status: 'gestellt', nummer: 'X-1' }] };
    const befunde = verbindungenPruefen({ heute: '2026-09-28', kontakte: await kontakte(), crm: neu, dateien: { eintraege: await ablage.ablageListe('test-haus'), aufPlatte: [] } });
    expect(befunde.find(x => x.id === 'angebot-verweis-tot')?.beispiele).toContain('ang-kaputt');
    expect(befunde.find(x => x.id === 'angebot-ohne-pdf')?.beispiele).toContain('ang-kaputt');
  });
});

describe('Zugang', () => {
  it('Konto außerhalb des Inhaber-Haushalts → 403 (Angebote und Gesellschaften)', async () => {
    const r = await angebot.GET(new Request('http://test/api/crm/angebot', { headers: { 'x-make-user': 'gast' } }));
    expect(r.status).toBe(403);
    expect((await gesellschaften.GET(new Request('http://test/api/crm/gesellschaften', { headers: { 'x-make-user': 'gast' } }))).status).toBe(403);
    // Dienstweg ohne Person: keine Gesellschaften, kein Stellen.
    expect((await gesellschaften.GET(new Request('http://test/api/crm/gesellschaften', { headers: kopf() }))).status).toBe(403);
    expect((await angebot.POST(new Request('http://test/api/crm/angebot', { method: 'POST', headers: kopf(), body: JSON.stringify({ aktion: 'stellen', id: 'ang-x' }) }))).status).toBe(403);
  });
});

describe('Gesellschaften-Route', () => {
  const holen = async () => ((await (await gesellschaften.GET(new Request('http://test/api/crm/gesellschaften', { headers: kopf('kevin') }))).json()) as { gesellschaften: (Record<string, any> & { stand: string })[] }).gesellschaften; // eslint-disable-line @typescript-eslint/no-explicit-any
  const patch = (body: Record<string, unknown>, person = 'kevin') => gesellschaften.PATCH!(new Request('http://test/api/crm/gesellschaften', { method: 'PATCH', headers: kopf(person), body: JSON.stringify(body) }));
  it('GET: drei Gesellschaften, IBAN maskiert, Lücken', async () => {
    const l = await holen();
    expect(l.map(g => g.id)).toEqual(['kdc', 'kdv', 'ug']);
    const kdv = l.find(g => g.id === 'kdv')!;
    expect(kdv.bank).toEqual({ iban: 'DE89 •••• •••• 3000', ibanGesetzt: true });
    expect(l.find(g => g.id === 'ug')!.luecken).toContain('Firmierung');
  });
  it('PATCH mit Stand; veraltet → 409; ungültige IBAN → 400; maskierte IBAN = unverändert', async () => {
    const ug = (await holen()).find(g => g.id === 'ug')!;
    expect((await patch({ id: 'ug', stand: ug.stand, felder: { firmierung: 'Beispiel OS UG', nummernformat: 'MOS-{JAHR}-{NR3}' } })).status).toBe(200);
    expect((await patch({ id: 'ug', stand: ug.stand, felder: { firmierung: 'Anders' } }, 'malin')).status).toBe(409);
    const kdv = (await holen()).find(g => g.id === 'kdv')!;
    expect((await patch({ id: 'kdv', stand: kdv.stand, felder: { bank: { iban: 'DE00 0000' } } })).status).toBe(400);
    expect((await patch({ id: 'kdv', stand: kdv.stand, felder: { bank: { iban: kdv.bank.iban, bic: 'COBADEFFXXX' } } })).status).toBe(200);
    const gespeichert = (await db.loadJson<{ gesellschaften: { id: string; bank?: { iban?: string; bic?: string } }[] }>('gesellschaften--test-haus'))!.gesellschaften.find(g => g.id === 'kdv')!;
    expect(gespeichert.bank).toEqual({ iban: 'DE89370400440532013000', bic: 'COBADEFFXXX' });
  });
  it('Logo: nur PNG/JPG (am Inhalt), wird verknüpft', async () => {
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const f = new FormData(); f.append('id', 'kdc'); f.append('datei', new File([png as BlobPart], 'logo.png', { type: 'image/png' }));
    const r = await gesellschaften.POST(new Request('http://test/api/crm/gesellschaften', { method: 'POST', headers: { 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': 'kevin' }, body: f }));
    expect(r.status).toBe(200);
    expect(((await r.json()) as { gesellschaft: { logoDateiId?: string } }).gesellschaft.logoDateiId).toMatch(/^d-/);
    const pdf = new FormData(); pdf.append('id', 'kdc'); pdf.append('datei', new File([new TextEncoder().encode('%PDF-1.4\n') as BlobPart], 'logo.pdf', { type: 'application/pdf' }));
    expect((await gesellschaften.POST(new Request('http://test/api/crm/gesellschaften', { method: 'POST', headers: { 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': 'kevin' }, body: pdf }))).status).toBe(415);
  });
});

// Deal-Typ nur für Lesbarkeit der Erwartungen.
export type _D = Chance;
