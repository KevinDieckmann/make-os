// ─── Paket U2 (28.09.) — Datenschutz vollständig ──────────────────────────────
// #55 Einwilligung mit vollem Nachweis · #51 Einschränkung nach Art. 18 als echte Sperre ·
// #52 Löschfristen je Datenart (Takt-Lauf) · #34 „zuletzt geprüft“ · #57 Bestandskundenprivileg ·
// #58 Telefon nur mit Anlass · #46 Ereigniszeit für alle Aktivitäten · Auskunft/Dubletten.
// Eigener Datenordner, erfundene Konten und Daten (@example.invalid) — nie der echte Bestand.
// Alle Module werden erst NACH dem Umbiegen des Datenordners geladen (dynamische Importe).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-u2-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-u2';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

type Handler = (r: Request) => Promise<Response>;
type Route = { GET?: Handler; POST?: Handler; PATCH?: Handler };
type Kontakt = import('@/lib/make-one/crm').Kontakt;
type Einwilligung = import('@/lib/make-one/crm').Einwilligung;
const HAUS = 'u2-haus';
const HEUTE = '2026-09-28';
const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
const anfrage = (pfad: string, person: string, method = 'GET', body?: unknown) => new Request(`http://test${pfad}`, { method, headers: sitzung(person), ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied') => ({ id, speicher, email: `${speicher}@example.invalid`, name: speicher, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: HAUS });

let db: typeof import('@/lib/store/local-db');
let crmLib: typeof import('@/lib/make-one/crm');
let ew: typeof import('@/lib/crm/einwilligung');
let ein: typeof import('@/lib/crm/einschraenkung');
let lf: typeof import('@/lib/crm/loeschfristen');
let recht: typeof import('@/lib/crm/recht');
let kontakteRoute: Route, datenschutzRoute: Route, aktRoute: Route;

const person = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({
  id, vorname: 'Test', nachname: id.replace(/^c-/, ''), eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01', ...x,
});
const VOLL: Omit<Einwilligung, 'kanal'> = { grundlage: 'einwilligung', erteiltAm: '2026-09-01', nachweis: 'ja', zeitpunkt: '2026-09-01T10:00:00.000Z', erfasstVon: 'kevin', wortlaut: 'Darf ich Ihnen … schicken? — Ja', belegRef: 'Gespräch vom 01.09.' };
const kontakte = async () => ((await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? []);
const gespeichert = async (id: string) => (await kontakte()).find(k => k.id === id)!;
const patch = async (ops: unknown[], wer = 'malin') => { const r = await kontakteRoute.PATCH!(anfrage('/api/state/kontakte', wer, 'PATCH', { ops })); return { status: r.status, d: await r.json() }; };
const ds = async (body: unknown, wer = 'kevin') => { const r = await datenschutzRoute.POST!(anfrage('/api/crm/datenschutz', wer, 'POST', body)); return { status: r.status, d: await r.json() }; };
const akt = async (body: unknown, wer = 'kevin') => { const r = await aktRoute.POST!(anfrage('/api/crm/aktivitaet', wer, 'POST', body)); return { status: r.status, d: await r.json() }; };

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  crmLib = await import('@/lib/make-one/crm');
  ew = await import('@/lib/crm/einwilligung');
  ein = await import('@/lib/crm/einschraenkung');
  lf = await import('@/lib/crm/loeschfristen');
  recht = await import('@/lib/crm/recht');
  await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'inhaber'), konto('k2', 'malin', 'mitglied')], einladungen: [] });
  await db.saveJson('kontakte', { kontakte: [
    person('c-anna', { email: 'anna@example.invalid' }),
    person('c-bert', { telefon: '030 1234567', kreis: 'A' }),
    person('c-carl', { telefon: '030 7654321', einwilligungen: [{ kanal: 'telefon', ...VOLL }] }),
    person('c-dora', { email: 'dora@example.invalid', kreis: 'B' }),
  ] });
  await db.saveJson('crm', (await import('@/lib/crm/speicher')).leererBestand());
  kontakteRoute = (await import('@/app/api/state/kontakte/route')) as Route;
  datenschutzRoute = (await import('@/app/api/crm/datenschutz/route')) as Route;
  aktRoute = (await import('@/app/api/crm/aktivitaet/route')) as Route;
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('#55 Einwilligung mit vollem Nachweis', () => {
  it('rein: Säubern behält die Nachweis-Felder, Lücken werden benannt', () => {
    const e = ew.einwilligungSaeubern({ kanal: 'mail', ...VOLL, fremd: 'x', erfasstVon: 'KEVIN!' })!;
    expect(e).toMatchObject({ wortlaut: VOLL.wortlaut, belegRef: VOLL.belegRef, zeitpunkt: VOLL.zeitpunkt });
    expect(e.erfasstVon).toBeUndefined();                    // ungültige Person fällt weg
    expect(ew.nachweisLuecken({ kanal: 'mail', grundlage: 'einwilligung', erteiltAm: '2026-01-01', nachweis: 'DOI' })).toEqual(['Zeitpunkt', 'erfasst von', 'Wortlaut', 'Beleg']);
    expect(ew.nachweisVollstaendig({ kanal: 'mail', ...VOLL })).toBe(true);
  });

  it('rein: Stempeln — neu mit Server-Zeit und Person; bekannt unveränderlich; Widerruf nur hinzu; nichts geht verloren', () => {
    const alt: Einwilligung[] = [{ kanal: 'mail', ...VOLL }];
    const neu = { kanal: 'social' as const, grundlage: 'einwilligung' as const, erteiltAm: '2026-12-01', nachweis: 'x', wortlaut: 'Ja, gern auf LinkedIn', belegRef: 'LinkedIn-Nachricht', erfasstVon: 'gefaelscht', zeitpunkt: '2020-01-01T00:00:00.000Z' };
    const verfaelscht = { ...alt[0], wortlaut: 'anderer Text' };
    const r = ew.einwilligungenStempeln(alt, [verfaelscht, neu], 'malin', '2026-09-28T09:00:00.000Z', HEUTE);
    expect(r.fehler).toBeUndefined();
    expect(r.liste[0].wortlaut).toBe(VOLL.wortlaut);         // gespeicherter Nachweis gewinnt
    expect(r.liste[1]).toMatchObject({ kanal: 'social', erfasstVon: 'malin', zeitpunkt: '2026-09-28T09:00:00.000Z', erteiltAm: HEUTE });
    const w = ew.einwilligungenStempeln(r.liste, [{ ...r.liste[0], widerrufenAm: '2020-01-01' }, r.liste[1]], 'kevin', '2026-09-28T10:00:00.000Z', HEUTE);
    expect(w.liste[0]).toMatchObject({ widerrufenAm: HEUTE, widerrufenVon: 'kevin' });
    const zurueck = ew.einwilligungenStempeln(w.liste, [{ ...w.liste[0], widerrufenAm: undefined }], 'malin', '2026-09-28T11:00:00.000Z', HEUTE);
    expect(zurueck.liste[0].widerrufenAm).toBe(HEUTE);        // Widerruf geht nie zurück
    expect(zurueck.liste).toHaveLength(2);                    // fehlender Eintrag bleibt (Nachweis wächst nur)
    expect(ew.einwilligungenStempeln([], [{ kanal: 'mail', grundlage: 'einwilligung', erteiltAm: HEUTE, nachweis: 'ja' }], 'kevin', '2026-09-28T09:00:00.000Z', HEUTE).fehler).toMatch(/Wortlaut und Beleg/);
  });

  it('Ampel: Altbestand ohne vollen Nachweis gelb (mit Grund), voller Nachweis grün', () => {
    const alt = person('c-x', { email: 'x@example.invalid', einwilligungen: [{ kanal: 'mail', grundlage: 'einwilligung', erteiltAm: '2026-01-01', nachweis: 'DOI' }] });
    expect(recht.kanalStatus(alt, 'mail')).toMatchObject({ farbe: 'gelb' });
    expect(recht.kanalStatus(alt, 'mail').grund).toMatch(/Nachweis unvollständig/);
    expect(recht.kanalStatus({ ...alt, einwilligungen: [...alt.einwilligungen!, { kanal: 'mail', ...VOLL }] }, 'mail').farbe).toBe('gruen');
  });

  it('Route: Server stempelt Zeitpunkt und Person, der Browser kann nichts fälschen; ohne Beleg 409', async () => {
    const neu = { kanal: 'mail', grundlage: 'einwilligung', erteiltAm: '2026-09-20', nachweis: 'ja', wortlaut: 'Darf ich Ihnen … schicken? — Ja', belegRef: 'Formular Messe v2', erfasstVon: 'kevin', zeitpunkt: '2020-01-01T00:00:00.000Z' };
    expect((await patch([{ op: 'teil', id: 'c-anna', felder: { einwilligungen: [neu] } }])).status).toBe(200);
    const e = (await gespeichert('c-anna')).einwilligungen![0];
    expect(e.erfasstVon).toBe('malin');
    expect(e.zeitpunkt).not.toBe('2020-01-01T00:00:00.000Z');
    expect(e.zeitpunkt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    const ohne = await patch([{ op: 'teil', id: 'c-anna', felder: { einwilligungen: [e, { kanal: 'telefon', grundlage: 'einwilligung', erteiltAm: '2026-09-20', nachweis: 'ja', wortlaut: 'Anruf ok — Ja' }] } }]);
    expect(ohne.status).toBe(409);
    expect(ohne.d.error).toMatch(/Wortlaut und Beleg/);
    // Leeren geht nicht: die Liste ist ein Nachweis.
    expect((await patch([{ op: 'teil', id: 'c-anna', felder: { einwilligungen: null } }])).status).toBe(200);
    expect((await gespeichert('c-anna')).einwilligungen).toHaveLength(1);
  });

  it('einwilligungUebernehmen (Gespräch) bringt Wortlaut und Beleg mit', async () => {
    const { einwilligungUebernehmen } = await import('@/lib/crm/erfassen');
    const n = einwilligungUebernehmen(person('c-y'), 'Darf ich dir … schicken? — Ja', HEUTE, 'malin', '2026-09-28T08:00:00.000Z')!;
    expect(ew.nachweisVollstaendig(n.einwilligungen![0])).toBe(true);
  });
});

describe('U2-Nachtrag: Newsletter-Ampel und Datenqualität „ohne vollständigen Nachweis“', () => {
  it('Newsletter: Double-Opt-in ohne vollen Nachweis gelb (mit Grund), mit vollem grün; ohne DOI rot', () => {
    const alt = person('c-nl', { email: 'nl@example.invalid', einwilligungen: [{ kanal: 'newsletter', grundlage: 'einwilligung', erteiltAm: '2026-01-01', nachweis: 'DOI' }] });
    const s = recht.kanalStatus(alt, 'newsletter');
    expect(s.farbe).toBe('gelb');
    expect(s.grund).toMatch(/Nachweis unvollständig/);
    expect(recht.kanalStatus({ ...alt, einwilligungen: [{ kanal: 'newsletter', ...VOLL }] }, 'newsletter').farbe).toBe('gruen');
    expect(recht.kanalStatus(person('c-nl2', { email: 'x@example.invalid' }), 'newsletter').farbe).toBe('rot');
  });

  it('Segment „Kanal newsletter“ und Newsletter-Empfänger nehmen nur vollständige Nachweise', async () => {
    const { leererBestand } = await import('@/lib/crm/speicher');
    const { imSegment, kontextAus } = await import('@/lib/crm/segmente');
    const ctx = kontextAus(leererBestand(), HEUTE);
    const alt = person('c-s1', { email: 's1@example.invalid', einwilligungen: [{ kanal: 'newsletter', grundlage: 'einwilligung', erteiltAm: '2026-01-01', nachweis: 'DOI' }] });
    const voll = person('c-s2', { email: 's2@example.invalid', einwilligungen: [{ kanal: 'newsletter', ...VOLL }] });
    expect(imSegment(alt, { kanal: 'newsletter' }, ctx)).toBe(false);
    expect(imSegment(voll, { kanal: 'newsletter' }, ctx)).toBe(true);
    const { exportCsv } = await import('@/lib/crm/export');
    const csv = exportCsv('kontakte', { kontakte: [alt, voll], crm: leererBestand(), heute: HEUTE }).split('\n');
    const kopf = csv[0].replace(/^\uFEFF/, '').split(';'), i = kopf.indexOf('NEWSLETTER_DOI');
    expect(csv.slice(1).map(z => z.split(';')[i])).toEqual(['nein', 'ja']);
  });

  it('Datenqualität: Anzahl je Kanal und Liste; Widerrufene, Anfragen, Gesperrte zählen nicht; nichts wird geändert', () => {
    const l = [
      person('c-q1', { einwilligungen: [{ kanal: 'mail', grundlage: 'einwilligung', erteiltAm: '2026-01-01', nachweis: 'ja' }, { kanal: 'newsletter', grundlage: 'einwilligung', erteiltAm: '2026-01-01', nachweis: 'DOI' }] }),
      person('c-q2', { einwilligungen: [{ kanal: 'mail', ...VOLL }] }),
      person('c-q3', { einwilligungen: [{ kanal: 'mail', grundlage: 'einwilligung', erteiltAm: '2026-01-01', nachweis: 'ja', widerrufenAm: '2026-02-01' }] }),
      person('c-q4', { einwilligungen: [{ kanal: 'mail', grundlage: 'anfrage', erteiltAm: '2026-01-01', nachweis: 'Anfrage' }] }),
      person('c-q5', { werbesperre: { seit: '2026-02-01', grund: 'x' }, einwilligungen: [{ kanal: 'mail', grundlage: 'einwilligung', erteiltAm: '2026-01-01', nachweis: 'ja' }] }),
    ];
    const vorher = JSON.stringify(l);
    const r = ew.nachweisOffen(l);
    expect(r.liste.map(x => x.id)).toEqual(['c-q1']);
    expect(r.liste[0]).toMatchObject({ kanaele: ['mail', 'newsletter'], fehlt: ['Zeitpunkt', 'erfasst von', 'Wortlaut', 'Beleg'] });
    expect(r.jeKanal).toMatchObject({ mail: 1, newsletter: 1, telefon: 0 });
    expect(JSON.stringify(l)).toBe(vorher);
  });

  it('Befund „ohne vollständigen Nachweis“ zeigt auf Datenqualität', async () => {
    const { befunde } = await import('@/lib/crm/befunde');
    const { leererBestand } = await import('@/lib/crm/speicher');
    const b = befunde([person('c-b9', { einwilligungen: [{ kanal: 'mail', grundlage: 'einwilligung', erteiltAm: '2026-01-01', nachweis: 'ja' }] })], leererBestand(), HEUTE);
    expect(b.find(x => /ohne vollständigen Nachweis/.test(x.titel))).toMatchObject({ bereich: 'stammdaten', ansicht: 'qualitaet' });
  });
});

describe('#57 Bestandskundenprivileg / #58 Telefon mit Anlass', () => {
  it('Mail an Kunden: grün nur mit Vermerk „Hinweis bei Erhebung“, sonst gelb mit Grund', () => {
    const k = person('c-k', { email: 'k@example.invalid', lebensphase: 'kunde' });
    expect(recht.kanalStatus(k, 'mail')).toMatchObject({ farbe: 'gelb', grundlage: 'bestandskunde_7_3' });
    expect(recht.kanalStatus(k, 'mail').grund).toMatch(/Hinweis bei Erhebung fehlt/);
    expect(recht.kanalStatus({ ...k, hinweisBeiErhebung: { am: '2026-05-01' } }, 'mail').farbe).toBe('gruen');
    expect(recht.kanalStatus(person('c-m', { email: 'm@example.invalid' }), 'mail', { hatMandat: true }).farbe).toBe('gelb');
  });

  it('Route: Anruf bei gelber Telefon-Ampel ohne Anlass → 409, mit Anlass gespeichert; grün braucht keinen', async () => {
    expect(recht.anlassPflicht(await gespeichert('c-bert'))).toBe(true);
    const ohne = await akt({ id: 'c-bert', art: 'anruf', ergebnis: 'nicht_erreicht' });
    expect(ohne.status).toBe(409);
    expect(ohne.d.anlassPflicht).toBe(true);
    expect((await gespeichert('c-bert')).aktivitaeten).toHaveLength(0);
    const mit = await akt({ id: 'c-bert', art: 'anruf', ergebnis: 'gespraech', anlass: 'Rückfrage zum Angebot vom 20.09.' });
    expect(mit.status).toBe(200);
    expect((await gespeichert('c-bert')).aktivitaeten.at(-1)).toMatchObject({ art: 'anruf', anlass: 'Rückfrage zum Angebot vom 20.09.' });
    expect((await akt({ id: 'c-carl', art: 'anruf', ergebnis: 'mailbox' })).status).toBe(200);
  });

  it('Route: Hinweis bei Erhebung — Person stempelt der Server, Tag höchstens heute', async () => {
    expect((await patch([{ op: 'teil', id: 'c-dora', felder: { hinweisBeiErhebung: { am: '2099-01-01', von: 'jemand' } } }], 'kevin')).status).toBe(200);
    const h = (await gespeichert('c-dora')).hinweisBeiErhebung!;
    expect(h.von).toBe('kevin');
    expect(h.am.startsWith('2099')).toBe(false);
  });
});

describe('#46 Ereigniszeit für alle Aktivitäten', () => {
  it('rein: nachgetragener Anruf setzt den letzten Kontakt auf seinen Tag — nie zurück', () => {
    const k = person('c-e', { letzterKontakt: '2026-09-10', stufe: 'angesprochen' });
    const a = crmLib.wendeAktivitaetAn(k, { art: 'anruf', von: 'kevin', wann: '2026-09-20' }, HEUTE, '2026-09-28T08:00:00.000Z', d => d);
    expect(a.letzterKontakt).toBe('2026-09-20');
    const b = crmLib.wendeAktivitaetAn({ ...k, letzterKontakt: '2026-09-25' }, { art: 'mail', von: 'kevin', wann: '2026-09-20' }, HEUTE, '2026-09-28T08:00:00.000Z', d => d);
    expect(b.letzterKontakt).toBe('2026-09-25');
    expect(crmLib.letzterKontaktVon({ letzterKontakt: '2026-09-01', aktivitaeten: [{ am: '2026-09-28T08:00:00.000Z', art: 'anruf', von: 'kevin', wann: '2026-09-15' }] }, HEUTE)).toBe('2026-09-15');
    // Sortierung „wann ?? am“: der nachgetragene Anruf liegt vor einer Mail, die gestern festgehalten wurde.
    const l = [{ am: '2026-09-28T08:00:00.000Z', art: 'anruf' as const, von: 'kevin', wann: '2026-09-15' }, { am: '2026-09-27T08:00:00.000Z', art: 'mail' as const, von: 'kevin' }];
    expect([...l].sort((x, y) => crmLib.ereignisMs(x) - crmLib.ereignisMs(y))[0].art).toBe('anruf');
    expect(crmLib.ereignisMs({ am: 'x', wann: '2026-09-15T10:00' })).toBe(Date.parse('2026-09-15T08:00:00Z')); // Berliner Sommerzeit
  });

  it('Route: wann für eine Mail, nie in der Zukunft', async () => {
    expect((await akt({ id: 'c-dora', art: 'mail', wann: '2099-01-01' })).status).toBe(400);
    expect((await akt({ id: 'c-dora', art: 'mail', wann: '2026-09-02', text: 'nachgetragen' })).status).toBe(200);
    expect((await gespeichert('c-dora')).aktivitaeten.at(-1)).toMatchObject({ art: 'mail', wann: '2026-09-02' });
  });
});

describe('#51 Einschränkung nach Art. 18 als echte Sperre', () => {
  it('rein: raus aus Ampel, Segment, Follow-ups, Leads, Paket; Export markiert', async () => {
    const k = person('c-z', { email: 'z@example.invalid', telefon: '030 111111', kreis: 'A', naechsterSchritt: { text: 'anrufen', datum: '2026-09-20' }, einwilligungen: [{ kanal: 'mail', ...VOLL }], eingeschraenkt: { seit: '2026-09-27', grund: 'Richtigkeit bestritten', von: 'kevin' } });
    expect(ein.ausgenommen(k)).toBe(true);
    expect(recht.ampel(k).every(s => s.farbe === 'rot')).toBe(true);
    const { leererBestand } = await import('@/lib/crm/speicher');
    const crm = leererBestand();
    const { imSegment, kontextAus } = await import('@/lib/crm/segmente');
    expect(imSegment(k, {}, kontextAus(crm, HEUTE))).toBe(false);
    const { faellige } = await import('@/lib/crm/followup');
    expect(faellige([k], crm, HEUTE).filter(f => f.kontaktId === k.id)).toEqual([]);
    const { leads } = await import('@/lib/crm/leads');
    expect(leads([k], crm, HEUTE).some(l => l.id === k.id)).toBe(false);
    const { kontaktPaket } = await import('@/lib/crm/zusammenfassung');
    expect(kontaktPaket(k, crm, HEUTE)).toBeNull();
    const { exportCsv } = await import('@/lib/crm/export');
    // 29.09. (D-B #72): standardmäßig fehlt die eingeschränkte Person ganz — nur „mit eingeschränkten“ (Auskunft) markiert dabei.
    const ohne = exportCsv('kontakte', { kontakte: [k], crm, heute: HEUTE });
    expect(ohne).toMatch(/EINGESCHRAENKT/);
    expect(ohne).not.toContain(k.id);
    const csv = exportCsv('kontakte', { kontakte: [k], crm, heute: HEUTE, mitEingeschraenkten: true });
    expect(csv).toMatch(/seit 2026-09-27/);                 // im Export nur MIT Markierung
  });

  it('Route: setzen nur mit Grund; danach Bearbeiten 409, Aktivität 409, Löschen 409; Aufheben mit Grund', async () => {
    expect((await ds({ aktion: 'einschraenken', id: 'c-dora', grund: '' })).status).toBe(400);
    expect((await ds({ aktion: 'einschraenken', id: 'c-dora', grund: 'Richtigkeit bestritten' })).status).toBe(200);
    const d = await gespeichert('c-dora');
    expect(d.eingeschraenkt).toMatchObject({ seit: expect.any(String), grund: 'Richtigkeit bestritten', von: 'kevin' });
    expect(d.aktivitaeten.at(-1)).toMatchObject({ art: 'system', von: 'kevin' });
    const bearbeiten = await patch([{ op: 'teil', id: 'c-dora', felder: { position: 'Chefin' } }]);
    expect(bearbeiten.status).toBe(409);
    expect(bearbeiten.d.error).toMatch(/Art\. 18/);
    // Nie über die Kartei aufheben — der Wert wird ignoriert bzw. abgelehnt.
    expect((await patch([{ op: 'teil', id: 'c-dora', felder: { eingeschraenkt: null } }])).status).toBe(409);
    expect((await akt({ id: 'c-dora', art: 'notiz', text: 'x' })).status).toBe(409);
    expect((await ds({ id: 'c-dora', grund: 'Art. 17' })).status).toBe(409);
    expect((await patch([{ op: 'delete', id: 'c-dora' }])).status).toBe(409);
    // Werbewiderspruch bleibt möglich (Art. 21).
    expect((await patch([{ op: 'teil', id: 'c-dora', felder: { werbesperre: { seit: HEUTE, grund: 'Widerspruch' } } }])).status).toBe(200);
    expect((await ds({ aktion: 'einschraenkung-aufheben', id: 'c-dora', grund: '' })).status).toBe(400);
    expect((await ds({ aktion: 'einschraenkung-aufheben', id: 'c-dora', grund: 'Richtigkeit bestätigt' })).status).toBe(200);
    expect((await gespeichert('c-dora')).eingeschraenkt).toBeUndefined();
  });

  it('Import bearbeitet eine eingeschränkte Person nicht', () => {
    const k = { ...crmLib.ausZeile({ VORNAME: 'Ina', NACHNAME: 'Imp', EMAIL: 'ina@example.invalid', FIRMA: 'X' }, '2026-09-01'), eingeschraenkt: { seit: '2026-09-27', grund: 'Antrag', von: 'kevin' } };
    const r = crmLib.importieren([k], [{ VORNAME: 'Ina', NACHNAME: 'Imp', EMAIL: 'ina@example.invalid', FIRMA: 'X', POSITION_AKTUELL: 'Neu' }], HEUTE);
    expect(r.unveraendert).toBe(1);
    expect(r.kontakte[0].position).toBeUndefined();
  });

  it('Dubletten: Einschränkung bleibt; „geprüft“ nur, wenn beide geprüft sind', async () => {
    const { zusammenfuehren } = await import('@/lib/crm/dubletten');
    const a = person('c-a1', { geprueftAm: '2026-09-01', geprueftVon: 'kevin' });
    const b = person('c-b1', { eingeschraenkt: { seit: '2026-09-27', grund: 'x', von: 'kevin' }, hinweisBeiErhebung: { am: '2026-02-01', von: 'malin' } });
    const m = zusammenfuehren(a, b, 'kevin', '2026-09-28T09:00:00.000Z');
    expect(m.eingeschraenkt).toMatchObject({ grund: 'x' });
    expect(m.geprueftAm).toBeUndefined();
    expect(m.hinweisBeiErhebung).toEqual({ am: '2026-02-01', von: 'malin' });
    expect(zusammenfuehren(a, { ...b, eingeschraenkt: undefined, geprueftAm: '2026-08-01' }, 'kevin', '2026-09-28T09:00:00.000Z').geprueftAm).toBe('2026-08-01');
  });
});

describe('#34 „zuletzt geprüft“', () => {
  it('rein: aktive Beziehungen/Leads, deren Prüfung (sonst Import) über 12 Monate her ist', async () => {
    const { nichtGeprueft } = await import('@/lib/crm/geprueft');
    const l = [
      person('c-alt', { kreis: 'A', importiertAm: '2025-01-01' }),
      person('c-frisch', { kreis: 'A', importiertAm: '2025-01-01', geprueftAm: '2026-03-01' }),
      person('c-kalt', { importiertAm: '2024-01-01' }),                         // keine aktive Beziehung
      person('c-gesperrt', { kreis: 'A', importiertAm: '2024-01-01', werbesperre: { seit: '2025-01-01', grund: 'x' } }),
    ];
    expect(nichtGeprueft(l, null, HEUTE).map(x => x.id)).toEqual(['c-alt']);
  });

  it('Route: „Stammdaten geprüft“ — Tag heute und Person stempelt der Server', async () => {
    expect((await patch([{ op: 'teil', id: 'c-anna', felder: { geprueftAm: '2001-01-01', geprueftVon: 'jemand' } }], 'kevin')).status).toBe(200);
    const a = await gespeichert('c-anna');
    expect(a.geprueftVon).toBe('kevin');
    expect(a.geprueftAm).not.toBe('2001-01-01');
  });
});

describe('#52 Löschfristen je Datenart', () => {
  it('rein: Standard nie gespeichert, Rahmen geprüft, feste Frist nicht einstellbar', () => {
    expect(lf.fristenWirksam({}).kontakte).toBe(24);
    const r = lf.fristenSpeichern({}, { kontakte: 36, 'heads-replay': 90 });
    expect(r).toEqual({ ok: true, fristen: { kontakte: 36 } });   // 90 = Standard → nicht gespeichert
    expect(lf.fristenSpeichern({ kontakte: 36 }, { kontakte: null })).toEqual({ ok: true, fristen: {} });
    expect(lf.fristenSpeichern({}, { kontakte: 2 }).ok).toBe(false);
    expect(lf.fristenSpeichern({}, { 'aktivitaeten-geloeschte': 5 }).ok).toBe(false);
    expect(lf.monateZurueck('2026-03-31', 1)).toBe('2026-02-28');
  });

  it('rein: Kontakte über der Frist — nie Kunden, Mandate, Einschränkung, Verlängerung, jüngere Spur', () => {
    const l = [
      person('c-weg', { importiertAm: '2023-01-01' }),
      person('c-kunde', { importiertAm: '2023-01-01', lebensphase: 'kunde' }),
      person('c-ein', { importiertAm: '2023-01-01', eingeschraenkt: { seit: '2026-01-01', grund: 'x', von: 'kevin' } }),
      person('c-verl', { importiertAm: '2023-01-01', loeschfristVerlaengert: { bis: '2027-01-01', grund: 'Gespräche', von: 'kevin', am: '2026-09-01' } }),
      person('c-akt', { importiertAm: '2023-01-01', aktivitaeten: [{ am: '2026-09-01T08:00:00.000Z', art: 'mail', von: 'kevin' }] }),
    ];
    expect(lf.kontakteUeberFrist(l, null, HEUTE, 24).map(x => x.id)).toEqual(['c-weg']);
  });

  it('Takt-Lauf: Personen nur als Aufgabe (nie gelöscht), technische Bestände bereinigt, Tagesmarke', async () => {
    await db.saveJson('kontakte', { kontakte: [
      ...(await kontakte()),
      person('c-uralt', { importiertAm: '2023-01-01' }),
      person('c-signal', { kreis: 'A', importiertAm: '2023-01-01', aktivitaeten: [
        { am: '2024-02-01T08:00:00.000Z', art: 'antwort', text: 'Betreff: alt', von: 'system', bezug: 'mail-abc' },
        { am: '2026-09-01T08:00:00.000Z', art: 'antwort', text: 'Betreff: neu', von: 'system', bezug: 'mail-def' },
      ] }),
    ] });
    await db.saveJson('heads-replay-sales', { faelle: [{ zeit: '2026-01-01T08:00:00.000Z' }, { zeit: '2026-09-20T08:00:00.000Z' }] });
    await db.saveJson('crm-import-konflikte', { konflikte: [{ kontaktId: 'c-anna', feld: 'email', online: 1, liste: 2 }], moeglicheDubletten: [], ohneBesitzer: 0, stand: '2026-01-01T08:00:00.000Z', quelle: 'liste.csv' });
    await db.saveJson(`aenderungsprotokoll--${HAUS}--2022-01`, { eintraege: [{ at: '2022-01-05T08:00:00.000Z', wer: 'system', bestand: 'kontakte', op: 'geaendert', id: 'c#1' }] });
    const vorher = (await kontakte()).length;
    const { loeschfristenLauf, LOESCHFRIST_AUFGABE } = await import('@/lib/crm/loeschfristen-lauf');
    const r = await loeschfristenLauf(new Date('2026-09-28T08:00:00.000Z'), true);
    expect(r.ok).toBe(true);
    expect(r.ueberFrist).toBeGreaterThanOrEqual(1);
    expect((await kontakte()).length).toBe(vorher);             // NIE automatisch gelöscht
    const t = ((await db.loadJson<{ tasks: { id: string; title: string; description: string; status: string }[] }>('tasks'))?.tasks ?? []).find(x => x.id === LOESCHFRIST_AUFGABE)!;
    expect(t.title).toMatch(/über der Löschfrist — prüfen: löschen oder begründen/);
    expect(t.description).not.toMatch(/c-uralt|Test/);          // keine Kennung, kein Name
    expect((await db.loadJson<{ faelle: unknown[] }>('heads-replay-sales'))!.faelle).toHaveLength(1);
    expect((await db.loadJson<{ konflikte: unknown[] }>('crm-import-konflikte'))!.konflikte).toHaveLength(0);
    expect((await db.loadJson<{ eintraege: unknown[]; bereinigt?: unknown }>(`aenderungsprotokoll--${HAUS}--2022-01`))).toMatchObject({ eintraege: [], bereinigt: expect.any(Object) });
    const sig = (await gespeichert('c-signal')).aktivitaeten;
    expect(sig[0].text).toBeUndefined();                          // Betreff nach 12 Monaten weg …
    expect(sig[0].bezug).toBe('mail-abc');                        // … das Ereignis bleibt
    expect(sig[1].text).toBe('Betreff: neu');
    // Tagesmarke: ein zweiter Lauf am selben Tag tut nichts.
    expect((await loeschfristenLauf(new Date('2026-09-28T09:00:00.000Z'))).uebersprungen).toBe(true);
    // Frist verlängern mit Grund → Person fällt aus der Liste; ohne Grund 400.
    expect((await ds({ aktion: 'frist-verlaengern', id: 'c-uralt', bis: '2027-06-01' })).status).toBe(400);
    expect((await ds({ aktion: 'frist-verlaengern', id: 'c-uralt', bis: '2027-06-01', grund: 'Empfehlung läuft' })).status).toBe(200);
    expect((await gespeichert('c-uralt')).loeschfristVerlaengert).toMatchObject({ bis: '2027-06-01', von: 'kevin' });
    expect(existsSync(path.join(ordner, 'crm-loeschfristen.json'))).toBe(true);
    expect(readFileSync(path.join(ordner, 'crm-loeschfristen.json'), 'utf8')).not.toMatch(/"fristen"/); // Standard nie gespeichert
  });

  it('Route: Fristen anpassen — nur die Abweichung wird gespeichert', async () => {
    expect((await ds({ aktion: 'fristen', fristen: { signale: 6 } })).status).toBe(200);
    expect((await db.loadJson<{ fristen?: Record<string, number> }>('crm-loeschfristen'))!.fristen).toEqual({ signale: 6 });
    expect((await ds({ aktion: 'fristen', fristen: { signale: 12 } })).status).toBe(200);
    expect((await db.loadJson<{ fristen?: Record<string, number> }>('crm-loeschfristen'))!.fristen).toBeUndefined();
    expect((await ds({ aktion: 'fristen', fristen: { signale: 999 } })).status).toBe(400);
  });
});

describe('Art. 15: Auskunft enthält die Einwilligungs-Nachweise vollständig', () => {
  it('Nachweise mit Zeitpunkt, wer, Wortlaut, Beleg, Lücken; dazu Einschränkung, geprüft, Frist', async () => {
    const r = await datenschutzRoute.GET!(anfrage('/api/crm/datenschutz?id=c-anna', 'kevin'));
    expect(r.status).toBe(200);
    const a = await r.json();
    expect(a.einwilligungsNachweise[0]).toMatchObject({ kanal: 'mail', erfasstVon: 'malin', wortlaut: expect.any(String), belegRef: 'Formular Messe v2', vollstaendig: true, fehlt: [] });
    expect(a).toHaveProperty('einschraenkung', null);
    expect(a.geprueft).toMatchObject({ von: 'kevin' });
  });
});
