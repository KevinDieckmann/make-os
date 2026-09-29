// ─── K4 (29.09.): öffentliche Buchungsseite — Routen, CRM-Vorgang, Freigabe, Datenschutz ─
// Eigener Datenordner, Dienstschlüssel + Person, Konten mit Test-Haushalt, Datenschlüssel und Pepper gesetzt. iCloud ist
// gemockt (nie echte Aufrufe). Alle Namen und Adressen erfunden (@example.invalid).
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Kontakt } from '@/lib/make-one/crm';
import type { BuchungBestand } from '@/lib/kalender/buchung';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-k4-buchung-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-k4-buchung';
process.env.SESSION_SECRET = 'pruef-sitzung-k4-buchung-nur-im-test';
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-k4-nur-im-test';
process.env.MAKE_OS_PEPPER = 'pruef-pepper-k4-nur-im-test-0123456789abcdef';

// ── iCloud gemockt: Termine liegen im Speicher dieses Tests ────────────────────
const ic = vi.hoisted(() => ({ verbunden: true, termine: [] as { uid: string; id: string; titel: string; start: string; ende: string; ganztags: boolean; kalender: string; notiz?: string; art: string; beschaeftigt: boolean }[], angelegt: 0, gaeste: [] as { email: string }[][], bestaetigt: [] as boolean[] }));
vi.mock('@/lib/kalender/icloud', () => ({
  CACHE: 'calendar-cache',
  SPEICHER: 'kalender-icloud',
  holfenster: () => ({ von: '2026-07-01', bis: '2027-11-01' }),
  objekteKurz: () => ic.termine.map(t => ({ uid: t.uid, tag: t.start.slice(0, 10), zusatz: null })),
  verbunden: () => ic.verbunden,
  ladeStand: async () => ({ at: '2026-10-05T06:00:00.000Z', kalender: [], objekte: {} }),
  frischerStand: async () => ({ at: '2026-10-05T06:00:00.000Z', kalender: [], objekte: {} }),
  termineImZeitraum: (_s: unknown, von: string, bis: string) => ic.termine.filter(t => t.start.slice(0, 10) < bis && t.ende.slice(0, 10) >= von).map(t => ({ ...t, href: '', kalenderId: '', serie: false, mitTeilnehmern: false, bearbeitbar: true })),
  anlegen: async (e: { titel: string; kalender: string; start: string; ende: string; notiz?: string; art?: string; beschaeftigt?: boolean; gaeste?: { email: string }[] }, opt: { einladungBestaetigt?: boolean } = {}) => {
    ic.angelegt++;
    ic.gaeste.push(e.gaeste ?? []); ic.bestaetigt.push(!!opt.einladungBestaetigt);
    const uid = `UID-TEST-${ic.angelegt}`;
    ic.termine.push({ uid, id: uid, titel: e.titel, start: e.start, ende: e.ende, ganztags: false, kalender: e.kalender, notiz: e.notiz, art: e.art ?? 'termin', beschaeftigt: e.beschaeftigt ?? true });
    return { uid, kalender: e.kalender };
  },
}));

type Ctx = { params: Promise<{ slug: string }> };
type Route = { GET?: (r: Request, c: Ctx) => Promise<Response>; POST?: (r: Request, c: Ctx) => Promise<Response> };
type Verwaltung = { GET: (r: Request) => Promise<Response>; POST: (r: Request) => Promise<Response> };
let db: typeof import('@/lib/store/local-db');
let drossel: typeof import('@/lib/zugang/drossel');
let verwaltung: Verwaltung, oeffentlich: Route, status: Route;
let SLUG = '';
const HAUS = 'test-haus';

const dienst = { 'content-type': 'application/json', 'x-make-key': 'pruef-schluessel-k4-buchung', 'x-make-person': 'kevin' };
const verwalten = async (body: Record<string, unknown>) => { const r = await verwaltung.POST(new Request('http://test/api/kalender/buchung', { method: 'POST', headers: dienst, body: JSON.stringify(body) })); return { status: r.status, d: await r.json() as Record<string, any> }; }; // eslint-disable-line @typescript-eslint/no-explicit-any
const ctx = (slug: string) => ({ params: Promise.resolve({ slug }) });
const holen = async (slug = SLUG) => { const r = await oeffentlich.GET!(new Request(`http://test/api/buchung/${slug}`), ctx(slug)); return { status: r.status, d: await r.json() as Record<string, any>, text: '' }; }; // eslint-disable-line @typescript-eslint/no-explicit-any
const buchen = async (body: Record<string, unknown>, slug = SLUG) => { const r = await oeffentlich.POST!(new Request(`http://test/api/buchung/${slug}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), ctx(slug)); return { status: r.status, d: await r.json() as Record<string, any> }; }; // eslint-disable-line @typescript-eslint/no-explicit-any
const statusAktion = async (token: string, aktion: string, slug = SLUG) => { const r = await status.POST!(new Request(`http://test/api/buchung/${slug}/status`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, aktion }) }), ctx(slug)); return { status: r.status, d: await r.json() as Record<string, any> }; }; // eslint-disable-line @typescript-eslint/no-explicit-any
const bestand = async () => (await db.loadJson<BuchungBestand>(`buchung--${HAUS}`))!;
const kontakte = async () => (await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];
const T0 = new Date('2026-10-05T06:00:00Z'); // Mo 08:00 Berlin
let uhr = T0.getTime();
const weiter = (sek: number) => { uhr += sek * 1000; vi.setSystemTime(new Date(uhr)); };

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
  db = await import('@/lib/store/local-db');
  drossel = await import('@/lib/zugang/drossel');
  await db.saveJson('konten', { konten: [
    { id: 'k1', speicher: 'kevin', email: 'k@example.invalid', name: 'Kevin Test', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: HAUS },
    { id: 'k2', speicher: 'malin', email: 'm@example.invalid', name: 'Malin Test', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: HAUS },
  ], einladungen: [] });
  await db.saveJson('kalender-einstellungen', { kalender: { kevin: 'Testkalender', malin: 'Malin-Kalender', beide: 'Gemeinsam' } });
  verwaltung = await import('@/app/api/kalender/buchung/route');
  oeffentlich = await import('@/app/api/buchung/[slug]/route');
  status = await import('@/app/api/buchung/[slug]/status/route');
  const r = await verwalten({ aktion: 'seite', seite: { titel: 'Erstgespräch', person: 'kevin', dauerMin: 30, fenster: [{ tage: [1, 2, 3, 4, 5, 6, 7], von: '09:00', bis: '12:00' }], tageVoraus: 7, vorlaufMin: 0, maxJeTag: 10, pufferMin: 0, rasterMin: 30, zielKalender: 'Testkalender', ort: 'Videoraum folgt', verantwortlich: 'Probe GmbH, datenschutz@example.invalid' } });
  expect(r.status).toBe(200);
  SLUG = r.d.seite.slug;
});
afterEach(() => drossel._zuruecksetzen());
afterAll(() => { vi.useRealTimers(); rmSync(ordner, { recursive: true, force: true }); });

describe('Buchungsseite verwalten', () => {
  it('neue Seite bekommt eine nicht erratbare Adresse; nur der Haushalt', async () => {
    expect(SLUG).toMatch(/^erstgesprach-[a-f0-9]{24}$/);
    const fremd = await verwaltung.POST(new Request('http://test/api/kalender/buchung', { method: 'POST', headers: { ...dienst, 'x-make-person': 'gast' }, body: '{}' }));
    expect(fremd.status).toBe(403);
    const ohne = await verwaltung.GET(new Request('http://test/api/kalender/buchung'));
    expect(ohne.status).toBe(403);
  });
});

describe('Öffentliche Seite', () => {
  it('zeigt nur freie Plätze — keine Person, keinen Kalender, keinen Ort, keine Termininhalte', async () => {
    ic.termine.push({ uid: 'belegt-1', id: 'belegt-1', titel: 'Geheimes Treffen mit Testo Probe', start: '2026-10-05T09:30:00', ende: '2026-10-05T10:30:00', ganztags: false, kalender: 'Testkalender', notiz: 'vertraulich', art: 'termin', beschaeftigt: true });
    // Frei gesetzter Termin (TRANSP:TRANSPARENT) blockiert nicht — K1 entscheidet das.
    ic.termine.push({ uid: 'frei-1', id: 'frei-1', titel: 'Erinnerung', start: '2026-10-05T11:00:00', ende: '2026-10-05T12:00:00', ganztags: false, kalender: 'Testkalender', art: 'termin', beschaeftigt: false });
    const r = await holen();
    expect(r.status).toBe(200);
    const heute = (r.d.plaetze as { start: string }[]).filter(p => p.start.startsWith('2026-10-05')).map(p => p.start.slice(11, 16));
    expect(heute).toEqual(['09:00', '10:30', '11:00', '11:30']);
    const text = JSON.stringify(r.d);
    for (const geheim of ['kevin', 'Kevin', 'Testkalender', 'Videoraum', 'Geheimes', 'Testo', 'vertraulich']) expect(text).not.toContain(geheim);
    expect(r.d.seite).toMatchObject({ titel: 'Erstgespräch', dauerMin: 30 });
    ic.termine.length = 0;
  });
  it('fremde oder unförmige Adresse → 404', async () => {
    expect((await holen('erstgesprach-0123456789abcdef01234567')).status).toBe(404);
    expect((await holen('erstgesprach')).status).toBe(404);
    expect((await buchen({}, 'erstgesprach-0123456789abcdef01234567')).status).toBe(404);
  });
});

describe('Buchen: Spam-Schutz, Doppelbuchung, Drosselung', () => {
  const eingabe = (stempel: string, x: Record<string, unknown> = {}) => ({ start: '2026-10-05T11:00:00', name: 'Testa Gast', email: 'testa.gast@example.invalid', firma: 'Probe GmbH', anliegen: 'Kennenlernen', einwilligung: true, stempel, webseite: '', ...x });

  it('Honigtopf → 400, zu schnell → 400, gefälschter Stempel → 400, zu groß → 413', async () => {
    const { d } = await holen();
    weiter(5);
    expect((await buchen(eingabe(d.stempel, { webseite: 'http://spam.example.invalid' }))).status).toBe(400);
    drossel._zuruecksetzen();
    const { d: d2 } = await holen();
    expect((await buchen(eingabe(d2.stempel))).status).toBe(400); // gleich abgeschickt
    expect((await buchen(eingabe(`${Date.now() - 60_000}.gefaelscht`))).status).toBe(400);
    drossel._zuruecksetzen();
    expect((await buchen(eingabe(d.stempel, { anliegen: 'x'.repeat(9000) }))).status).toBe(413);
    expect((await bestand()).buchungen).toHaveLength(0);
  });

  it('gültige Buchung → 201 vorläufig; derselbe Platz ein zweites Mal → 409; dieselbe E-Mail offen → 409', async () => {
    const { d } = await holen();
    weiter(5);
    const r = await buchen(eingabe(d.stempel));
    expect(r.status).toBe(201);
    expect(r.d).toMatchObject({ ok: true, status: 'vorlaeufig', statusPfad: `/buchen/${SLUG}/status` });
    expect(r.d.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const b = (await bestand()).buchungen;
    expect(b).toHaveLength(1);
    expect(JSON.stringify(b)).not.toContain(r.d.token); // nur der Hash liegt im Bestand
    // Doppelbuchung: anderer Gast, derselbe Platz
    const doppelt = await buchen(eingabe(d.stempel, { email: 'zweite@example.invalid' }));
    expect(doppelt.status).toBe(409);
    // Dieselbe E-Mail, anderer Platz
    drossel._zuruecksetzen();
    expect((await buchen(eingabe(d.stempel, { start: '2026-10-05T11:30:00' }))).status).toBe(409);
    // Der Platz ist aus der öffentlichen Liste verschwunden
    const nachher = await holen();
    expect((nachher.d.plaetze as { start: string }[]).some(p => p.start === '2026-10-05T11:00:00')).toBe(false);
    token = r.d.token;
  });

  it('Drosselung je Adresse: nach fünf Versuchen in der Viertelstunde → 429', async () => {
    const { d } = await holen();
    weiter(5);
    const codes: number[] = [];
    for (let i = 0; i < 7; i++) codes.push((await buchen(eingabe(d.stempel, { email: `viele${i}@example.invalid`, start: '2026-10-06T09:00:00', webseite: 'falle' }))).status);
    expect(codes.slice(0, 6).every(c => c === 400)).toBe(true);
    expect(codes[6]).toBe(429);
  });
});

let token = '';

describe('Bestätigen → EIN CRM-Vorgang → Freigabe → Termin', () => {
  it('Status sehen, bestätigen: Anfrage im CRM mit vollem Einwilligungs-Nachweis, Follow-up, Glocke', async () => {
    const s = await statusAktion(token, 'ansehen');
    expect(s.status).toBe(200);
    expect(s.d.sicht).toMatchObject({ status: 'vorlaeufig', titel: 'Erstgespräch' });
    expect(s.d.sicht).not.toHaveProperty('ort');
    expect((await statusAktion('A'.repeat(43), 'ansehen')).status).toBe(404);

    const b = await statusAktion(token, 'bestaetigen');
    expect(b.d.sicht.status).toBe('angefragt');
    const buchung = (await bestand()).buchungen[0];
    expect(buchung.kontaktId).toMatch(/^c-/);
    const k = (await kontakte()).find(x => x.id === buchung.kontaktId)!;
    expect(k).toMatchObject({ email: 'testa.gast@example.invalid', vorname: 'Testa', nachname: 'Gast', herkunft: 'selbst' });
    expect(k.aktivitaeten.filter(a => (a.text ?? '').startsWith('Anfrage über Website: Terminbuchung „Erstgespräch“'))).toHaveLength(1);
    const ew = k.einwilligungen!.find(e => e.grundlage === 'anfrage' && e.kanal === 'mail')!;
    expect(ew).toMatchObject({ belegRef: `buchung:${buchung.id}`, wortlautVersion: buchung.einwilligung.version, erfasstVon: 'kevin' });
    expect(ew.wortlaut).toBe(buchung.einwilligung.wortlaut);
    expect(ew.zeitpunkt).toBeTruthy();
    const crm = (await db.loadJson<{ followups: { id: string; text: string; kontaktId?: string }[] }>('crm'))!;
    expect(crm.followups.find(f => f.id === buchung.followUpId)).toMatchObject({ kontaktId: k.id });
    const glocke = await db.loadJson<{ eintraege: { art: string; titel: string }[] }>('meldungen--kevin');
    expect(glocke!.eintraege.some(m => m.art === 'buchung' && m.titel.includes('Erstgespräch'))).toBe(true);
    // Zweimal bestätigen legt nichts doppelt an
    await statusAktion(token, 'bestaetigen');
    expect((await kontakte()).filter(x => x.email === 'testa.gast@example.invalid')).toHaveLength(1);
  });

  it('Freigabe: fester Termin (echte UID), genau eine Aktivität „Termin gebucht“ mit Termin-Bezug, Follow-up „vorbereiten“, Audit', async () => {
    const id = (await bestand()).buchungen[0].id;
    // K3: „einladen“ ohne Bestätigung → 409, nichts angelegt.
    expect((await verwalten({ aktion: 'freigeben', id, einladen: true })).status).toBe(409);
    expect(ic.angelegt).toBe(0);
    const r = await verwalten({ aktion: 'freigeben', id });
    expect(r.status).toBe(200);
    expect(ic.angelegt).toBe(1);
    expect(ic.gaeste[0]).toEqual([]); // ohne „einladen“ nie ein Gast im Termin
    const b = (await bestand()).buchungen[0];
    expect(b).toMatchObject({ status: 'bestaetigt', terminUid: 'UID-TEST-1', entschiedenVon: 'kevin' });
    expect(ic.termine[0].notiz).not.toContain(b.kontaktId!); // Kontaktbezug nie im Termin …
    const bezug = await db.loadJson<{ bezuege: Record<string, { kontaktId?: string; von?: string }> }>('kalender-bezug'); // … sondern in K1 `kalender-bezug`
    expect(bezug!.bezuege['UID-TEST-1']).toMatchObject({ kontaktId: b.kontaktId, von: 'kevin' });
    const k = (await kontakte()).find(x => x.id === b.kontaktId)!;
    const termin = k.aktivitaeten.filter(a => a.art === 'termin');
    expect(termin).toHaveLength(1);
    // K3: die Meeting-Aktivität verweist auf den Termin (`terminUid`) — die Zeit steht nur im Termin, kein `wann`.
    expect(termin[0]).toMatchObject({ terminUid: 'UID-TEST-1' });
    expect(termin[0].wann).toBeUndefined();
    const crm = (await db.loadJson<{ followups: { id: string; text: string; faellig: string }[] }>('crm'))!;
    expect(crm.followups.find(f => f.id === b.vorbereitenId)?.text).toContain('Termin vorbereiten');
    // Audit: Kalender-Schreibaktion mit UID, ohne Titel/Namen
    const monat = `aenderungsprotokoll--${HAUS}--2026-10`;
    const prot = await db.loadJson<{ eintraege: { bestand: string; id: string; op: string; person?: string }[] }>(monat);
    expect(prot!.eintraege.some(e => e.bestand === 'kalender' && e.id === 'UID-TEST-1' && e.op === 'neu' && e.person === 'kevin')).toBe(true);
    expect(JSON.stringify(prot)).not.toContain('Testa');
    // Zweite Freigabe: kein zweiter Termin
    await verwalten({ aktion: 'freigeben', id });
    expect(ic.angelegt).toBe(1);
    // Status-Seite zeigt jetzt den Ort
    expect((await statusAktion(token, 'ansehen')).d.sicht).toMatchObject({ status: 'bestaetigt', ort: 'Videoraum folgt' });
    // Folge-Vorschlag nur als Vorschlag
    const g = await verwaltung.GET(new Request('http://test/api/kalender/buchung', { headers: dienst }));
    const gd = await g.json() as { vorschlaege: Record<string, { art: string }>; buchungen: Record<string, unknown>[] };
    expect(gd.vorschlaege[id]).toMatchObject({ art: 'qualifizierung' });
    expect(gd.buchungen.every(x => !('tokenHash' in x))).toBe(true);
    expect((await db.loadJson<{ chancen: unknown[] }>('crm'))!.chancen).toHaveLength(0);
  });

  it('ohne iCloud keine Freigabe (409), nichts halb geschrieben', async () => {
    const { d } = await holen();
    weiter(5);
    const r = await buchen({ start: '2026-10-06T10:00:00', name: 'Testo Zwei', email: 'testo.zwei@example.invalid', einwilligung: true, stempel: d.stempel });
    expect(r.status).toBe(201);
    await statusAktion(r.d.token, 'bestaetigen');
    const id = (await bestand()).buchungen.find(x => x.email === 'testo.zwei@example.invalid')!.id;
    ic.verbunden = false;
    const f = await verwalten({ aktion: 'freigeben', id });
    ic.verbunden = true;
    expect(f.status).toBe(409);
    expect((await bestand()).buchungen.find(x => x.id === id)!.status).toBe('angefragt');
    // Ablehnen: Gast sieht den Grund
    expect((await verwalten({ aktion: 'ablehnen', id, grund: 'Termin passt leider nicht' })).status).toBe(200);
    expect((await statusAktion(r.d.token, 'ansehen')).d.sicht).toMatchObject({ status: 'abgelehnt', grund: 'Termin passt leider nicht' });
  });
});

describe('Absichtsprotokoll: Abbruch nach jedem Schritt der Freigabe → Wiederaufnahme → derselbe Endzustand', () => {
  const SCHRITTE = ['termin', 'buchung', 'kartei', 'crm'];
  for (const schritt of SCHRITTE) for (const wann of ['vorAbhaken', 'nachAbhaken'] as const) {
    it(`Abbruch ${wann === 'vorAbhaken' ? 'vor' : 'nach'} dem Abhaken von „${schritt}“`, async () => {
      const ab = await import('@/lib/store/absichten');
      const fort = await import('@/lib/store/absichten-fortsetzen');
      const { FREIGABE_SCHRITTE } = await import('@/lib/kalender/buchung-ablauf');
      expect([...FREIGABE_SCHRITTE]).toEqual(SCHRITTE);
      const { d } = await holen();
      weiter(5);
      const mail = `abbruch.${schritt}.${wann}@example.invalid`.toLowerCase();
      const min = 9 * 60 + SCHRITTE.indexOf(schritt) * 30;
      const start = `2026-10-0${wann === 'vorAbhaken' ? 7 : 8}T${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}:00`;
      const r = await buchen({ start, name: 'Testa Abbruch', email: mail, einwilligung: true, stempel: d.stempel });
      expect(r.status, JSON.stringify(r.d)).toBe(201);
      drossel._zuruecksetzen();
      await statusAktion(r.d.token, 'bestaetigen');
      const id = (await bestand()).buchungen.find(x => x.email === mail)!.id;
      const vorher = ic.angelegt;
      ab.absichtTest[wann] = (art, name) => { if (art === 'buchung' && name === schritt) throw new ab.TestAbbruch(name); };
      const f = await verwalten({ aktion: 'freigeben', id });
      ab.absichtTest[wann] = null;
      expect(f.status).toBe(502);
      const e = await fort.offeneFertigstellen();
      expect(e.fehler).toEqual([]);
      const b = (await bestand()).buchungen.find(x => x.id === id)!;
      expect(b.status).toBe('bestaetigt');
      expect(ic.angelegt - vorher).toBe(1); // nie doppelt angelegt (Marke im Termin)
      const k = (await kontakte()).find(x => x.id === b.kontaktId)!;
      expect(k.aktivitaeten.filter(a => a.art === 'termin')).toHaveLength(1);
      const crm = (await db.loadJson<{ followups: { id: string }[] }>('crm'))!;
      expect(crm.followups.filter(x => x.id === b.vorbereitenId)).toHaveLength(1);
      const offen = (await ab.absichtenLaden(HAUS)).filter(ab.istOffen);
      expect(offen).toHaveLength(0);
    });
  }
});

describe('Datenschutz und Verbindungen', () => {
  it('Art. 17: Buchungen der Person fallen aus `buchung--*`; Register kennt den Bestand', async () => {
    const { registerEintrag } = await import('@/lib/crm/speicher-register');
    expect(registerEintrag(`buchung--${HAUS}`)).toMatchObject({ bezug: 'dritte', behandlung: 'entfernen' });
    const pw = await import('@/lib/crm/person-weitere');
    const b = (await bestand()).buchungen.find(x => x.email === 'testa.gast@example.invalid')!;
    const k = (await kontakte()).find(x => x.id === b.kontaktId)!;
    const vorher = (await bestand()).buchungen.length;
    const r = await pw.weitereEntfernen(pw.merkmaleVon(k.id, k));
    expect(r.speicher[`buchung--${HAUS}`]).toBeGreaterThan(0);
    const nach = await bestand();
    expect(nach.buchungen).toHaveLength(vorher - 1);
    expect(JSON.stringify(nach)).not.toContain('testa.gast@example.invalid');
    expect(nach.seiten).toHaveLength(1);
  });

  it('Verbindungsprüfung: Buchung mit toter Person und Termin, der in Apple fehlt', async () => {
    const { ladeVerbindungsBestaende } = await import('@/lib/crm/verbindungen-laden');
    const { verbindungenPruefen } = await import('@/lib/crm/verbindungen');
    const b = (await bestand()).buchungen.find(x => x.status === 'bestaetigt')!;
    await db.updateJson<{ kontakte: Kontakt[] }>('kontakte', cur => ({ kontakte: (cur?.kontakte ?? []).filter(x => x.id !== b.kontaktId) }));
    ic.termine = ic.termine.filter(t => t.uid !== b.terminUid);
    const befunde = verbindungenPruefen(await ladeVerbindungsBestaende('2026-10-05'));
    expect(befunde.find(x => x.id === 'buchung-kontakt-tot')?.beispiele).toContain(b.id);
    expect(befunde.find(x => x.id === 'buchung-termin-tot')?.beispiele).toContain(b.id);
    expect(JSON.stringify(befunde.filter(x => x.id.startsWith('buchung-')))).not.toMatch(/@example\.invalid|Testa/);
  });

  it('Löschfrist: Endzustände nach der Frist weg (mit Protokoll), offene bleiben', async () => {
    const { buchungenLoeschfrist } = await import('@/lib/kalender/buchung-speicher');
    const spaeter = new Date(uhr + 40 * 86_400_000);
    const vorher = (await bestand()).buchungen.length;
    const n = await buchungenLoeschfrist(spaeter, 30);
    expect(n).toBe(vorher);
    expect((await bestand()).buchungen).toHaveLength(0);
  });
});
