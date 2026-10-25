// ─── Markttraktion › Formulare · „Angebot anfordern“ (25.10.2026) — von Ende zu Ende ─────────────────────────────────────────────────────
// Nachgebautes Postfach (PostSpeicher über `transportSetzen`, nie ein echter Server), eigener Datenordner, erfundene Daten (@example.invalid).
// Geprüft: neuer Kunde → Kontakt + Firma + Deal + Angebot + Mail mit genau diesem PDF; bekannter Kunde → angehängt, keine Dublette; Rabatt/eigener
// Preis → Freigabe statt Versand (dann „Senden“ eines Inhabers); Werbesperre → Freigabe; Art. 18 → abgelehnt, nichts angelegt; ohne Absender →
// Freigabe; Abbruch nach jedem Schritt + Wiederholung = nichts doppelt; Wächter der Versand-Funktion; Trennung der Sichten auf dem Server.
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Kontakt } from '@/lib/make-one/crm';
import type { Leistung } from '@/lib/crm/typen';
import type { PostSpeicher as PS } from '@/lib/postfach/post-speicher';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-angebotsformular-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-angebotsformular';
process.env.MAKE_OS_KEY = 'dienst-test-angebotsformular';
process.env.MAKE_OS_PEPPER = 'pruef-pepper-angebotsformular-0123456789';

const D = 'example.invalid';
const PW = 'Geheim-Postfach-4711';
const wurzel = path.resolve(__dirname, '..');
type R = { GET?: (r: Request) => Promise<Response>; POST?: (r: Request) => Promise<Response> };
let formulare: R, postfaecher: R, stapel: R;
let db: typeof import('@/lib/store/local-db');
let T: typeof import('@/lib/postfach/transport');
let P: typeof import('@/lib/postfach/post-speicher');
let A: typeof import('@/lib/store/absichten');
let server: PS;

const sitzung = (person: string) => ({ 'x-make-user': person, 'content-type': 'application/json' });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const j = async (r: Response) => ({ status: r.status, text: await r.clone().text(), d: await r.json().catch(() => ({})) as Record<string, any> });
const GET = (route: R, url: string, h: Record<string, string> = sitzung('kevin')) => route.GET!(new Request(`http://localhost${url}`, { headers: h })).then(j);
const POST = (route: R, url: string, body: unknown, h: Record<string, string> = sitzung('kevin')) => route.POST!(new Request(`http://localhost${url}`, { method: 'POST', headers: h, body: JSON.stringify(body) })).then(j);
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id, vorname: 'Vera', nachname: `Muster ${id.slice(2)}`, eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01', anrede: 'Sie', ...x } as Kontakt);
const J = '2026-09-01T10:00:00.000Z';
const PRODUKT: Leistung = {
  id: 'l-beratung', name: 'Beratungs-Retainer', typ: 'retainer', stufe: 'kern', preis: { betrag: 2500, einheit: 'Monat netto', basis: 'monat' }, lieferumfang: ['Zwei Termine'], gesellschaft: 'ug', status: 'aktiv',
  angebot: { leistungstext: 'Monatlich zwei Beratungstermine mit Vorbereitung und Protokoll.' }, geaendert: J,
  preise: [{ id: 'pt-monat', art: 'monatlich', betragCent: 250000, rolle: 'grund' }, { id: 'pt-std', art: 'stundensatz', betragCent: 15000, rolle: 'option', deckel: { stundenJeMonat: 10 }, mengeJeMonat: 4 }],
  vertrag: { mindestlaufzeitMonate: 6 },
} as Leistung;
const PRIVAT_PRODUKT = { ...PRODUKT, id: 'l-privat', name: 'Privates Ding', gesellschaft: 'kdc' } as Leistung;
const ENTWURF_PRODUKT = { ...PRODUKT, id: 'l-entwurf', name: 'Noch Entwurf', status: 'entwurf' } as Leistung;

const KONTEN = { konten: [
  { id: 'k1', speicher: 'kevin', email: `kevin@${D}`, name: 'Kevin Beispiel', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'h' },
  { id: 'k2', speicher: 'malin', email: `malin@${D}`, name: 'Malin Beispiel', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'h' },
  { id: 'k3', speicher: 'partner', email: `partner@${D}`, name: 'Paul Partner', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'h', finanzRecht: 'business' },
  { id: 'k4', speicher: 'fremd', email: `fremd@${D}`, name: 'Fremd', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'anderer' },
], einladungen: [] };

const anfrage = (email: string, x: Record<string, unknown> = {}) => ({
  firma: { name: 'Kundenwerk GmbH', strasse: 'Musterweg 3', plz: '12345', ort: 'Beispielstadt' },
  person: { anrede: 'Sie', vorname: 'Klara', nachname: 'Kunde', email, telefon: '+49 30 1234567' },
  produkte: [{ id: 'l-beratung' }], start: '2026-12-01', notiz: 'Kunde will im Dezember starten.', ...x,
});
let zaehler = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++zaehler).padStart(12, '0')}`;
const anfordern = (body: Record<string, unknown>, person = 'malin', anfrageId = uuid()) => POST(formulare, '/api/crm/formulare', { aktion: 'anfordern', anfrageId, anfrage: body }, sitzung(person)).then(r => ({ ...r, anfrageId }));
const crm = async () => (await import('@/lib/crm/speicher')).ladeCrm();
const kontakte = async () => (await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte;
const formular = async () => (await import('@/lib/crm/formulare-speicher')).ladeFormular();

async function postfachVerbinden(bereich = 'ug'): Promise<string> {
  const a = await POST(postfaecher, '/api/inbox/postfaecher', { aktion: 'hinzufuegen', anbieter: 'ionos', adresse: `angebote@firma.${D}`, passwort: PW, bereich, anzeigename: 'Angebote', absenderName: 'Vertrieb Beispiel' });
  expect(a.status, a.text).toBe(200);
  return a.d.id as string;
}

beforeAll(async () => {
  db = await import('@/lib/store/local-db'); T = await import('@/lib/postfach/transport'); P = await import('@/lib/postfach/post-speicher'); A = await import('@/lib/store/absichten');
  formulare = await import('../app/api/crm/formulare/route') as R;
  postfaecher = await import('../app/api/inbox/postfaecher/route') as R;
  stapel = await import('../app/api/zoe/stapel/route') as R;
});
afterAll(() => { T.transportSetzen(null); rmSync(ordner, { recursive: true, force: true }); });
afterEach(() => { A.absichtTest.vorAbhaken = null; A.absichtTest.nachAbhaken = null; A.absichtTest.vorSchritt = null; });

beforeEach(async () => {
  for (const f of readdirSync(ordner)) rmSync(path.join(ordner, f), { recursive: true, force: true });
  db.leseCacheLeeren();
  vi.stubEnv('GOOGLE_CLIENT_ID', ''); vi.stubEnv('GOOGLE_CLIENT_SECRET', ''); vi.stubEnv('NEXT_PUBLIC_MAKE_BAU', '');
  vi.stubGlobal('fetch', async () => { throw new Error('kein Netz im Test'); });
  server = new P.PostSpeicher({ passwort: PW, ordner: [{ pfad: 'INBOX' }, { pfad: 'Gesendete Objekte' }] });
  T.transportSetzen({ imap: z => server.sitzung(z), smtp: (z, u, roh) => server.senden(z, u, roh), waechter: async () => ({ stop: async () => {} }) });
  await db.saveJson('konten', KONTEN);
  await db.saveJson('kontakte', { kontakte: [
    k('c-bekannt', { vorname: 'Bert', nachname: 'Bekannt', email: `bert@kunde.${D}`, firma: 'Bestand AG', firmaId: 'f-bestand' }),
    k('c-sperre', { vorname: 'Selma', nachname: 'Sperre', email: `selma@kunde.${D}`, werbesperre: { seit: '2026-09-01', grund: 'Widerspruch' } }),
    k('c-eng', { vorname: 'Erika', nachname: 'Eng', email: `erika@kunde.${D}`, eingeschraenkt: { seit: '2026-09-01', grund: 'Art. 18', von: 'kevin' } }),
  ] });
  const { leererBestand } = await import('@/lib/crm/speicher');
  await db.saveJson('crm', { ...leererBestand(), firmen: [{ id: 'f-bestand', name: 'Bestand AG', rolle: 'kunde', geaendert: J }], leistungen: [PRODUKT, PRIVAT_PRODUKT, ENTWURF_PRODUKT] });
  await db.saveJson('gesellschaften--h', { gesellschaften: [{ id: 'ug', firmierung: 'Beispiel Innovation GmbH', strasse: 'Beispielweg 1', plz: '12345', ort: 'Musterstadt', email: `info@${D}` }] });
  await db.saveJson('datenschutz-einrichtung', { verantwortlicher: { name: 'Beispiel Innovation GmbH', anschrift: 'Beispielweg 1, 12345 Musterstadt', mail: `datenschutz@${D}` } });
});

async function mitAbsender(): Promise<string> {
  const pf = await postfachVerbinden();
  const e = await POST(formulare, '/api/crm/formulare', { aktion: 'einstellungen', absender: pf });
  expect(e.status, e.text).toBe(200);
  return pf;
}

// ── Rein ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('Regeln (rein)', () => {
  it('Eingabe: Pflichtfelder, 413 statt Kürzen, Link nimmt keine Kennungen', async () => {
    const { anfrageEingabePruefen } = await import('@/lib/crm/formulare');
    expect(anfrageEingabePruefen({ ...anfrage(`a@${D}`), person: { vorname: 'A', nachname: 'B', email: 'kaputt' } }, 'intern')).toMatchObject({ ok: false, status: 400 });
    expect(anfrageEingabePruefen({ ...anfrage(`a@${D}`), firma: { name: 'x'.repeat(161) } }, 'intern')).toMatchObject({ ok: false, status: 413 });
    expect(anfrageEingabePruefen({ ...anfrage(`a@${D}`), produkte: [] }, 'intern')).toMatchObject({ ok: false, status: 400 });
    const link = anfrageEingabePruefen({ ...anfrage(`a@${D}`), kontaktId: 'c-bekannt', firmaId: 'f-bestand' }, 'link');
    expect(link.ok && (link.e.kontaktId ?? link.e.firmaId)).toBeFalsy();
  });
  it('Positionen wie „Angebot erstellen“; Menge nur in den Grenzen; Rabatt und eigener Preis → Abweichung', async () => {
    const { positionenAusWahl, nurListenpreise } = await import('@/lib/crm/formulare');
    const r = positionenAusWahl([{ id: 'l-beratung', optionen: ['pt-std'], mengen: { 'pt-std': 8 } }], [PRODUKT]);
    expect(r.ok && r.r.positionen.map(p => [p.preisTeilId, p.einzelpreisCent, p.menge])).toEqual([['pt-monat', 250000, 1], ['pt-std', 15000, 8]]);
    expect(r.ok && nurListenpreise(r.r.positionen, [PRODUKT])).toBe(true);
    expect(positionenAusWahl([{ id: 'l-beratung', optionen: ['pt-std'], mengen: { 'pt-std': 11 } }], [PRODUKT])).toMatchObject({ ok: false });
    expect(positionenAusWahl([{ id: 'l-entwurf' }], [ENTWURF_PRODUKT])).toMatchObject({ ok: false });
    const rabatt = positionenAusWahl([{ id: 'l-beratung', rabattProzent: 10 }], [PRODUKT]);
    expect(rabatt.ok && rabatt.r.abweichungen.length).toBe(1);
    expect(rabatt.ok && nurListenpreise(rabatt.r.positionen, [PRODUKT])).toBe(false);
    const preis = positionenAusWahl([{ id: 'l-beratung', preise: { 'pt-monat': 200000 } }], [PRODUKT]);
    expect(preis.ok && preis.r.abweichungen[0]).toContain('eigener Preis');
  });
  it('Leitplanken: nur wenn alles stimmt; Mail aus der Vorlage mit Datenschutzhinweis, ohne KI', async () => {
    const { leitplanken, angebotMail, ABSENDER_FEHLT } = await import('@/lib/crm/formulare');
    const gut = { listenpreise: true, abweichungen: [], offen: [], adresseOk: true, werbesperre: false, absenderOk: true, datenschutzOk: true };
    expect(leitplanken(gut)).toEqual({ versenden: true, gruende: [] });
    expect(leitplanken({ ...gut, absenderOk: false }).gruende).toEqual([ABSENDER_FEHLT]);
    expect(leitplanken({ ...gut, werbesperre: true }).versenden).toBe(false);
    const m = angebotMail({ betreff: 'Ihr Angebot {nummer}', text: '{gruss}\n\nAnbei {titel} für {firma}.' }, { anrede: 'Sie', vorname: 'Klara', nachname: 'Kunde', firma: 'Kundenwerk', nummer: 'BI-A-2026-0001', titel: 'Beratung', gueltigBis: '2026-11-30', absender: 'Beispiel GmbH' }, { verantwortlich: 'Beispiel GmbH', mail: `ds@${D}`, seite: '' });
    expect(m.betreff).toBe('Ihr Angebot BI-A-2026-0001');
    expect(m.text).toContain('Guten Tag Klara Kunde,');
    expect(m.text).toContain('Anbei Beratung für Kundenwerk.');
    expect(m.text).toContain('Art. 6 Abs. 1 lit. b DSGVO');
  });
});

// ── Ablauf ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('Angebot anfordern — von Ende zu Ende', () => {
  it('neuer Kunde: Kontakt + Firma + Deal + Angebot (gestellt) + Mail mit GENAU diesem PDF; Glocke an den Inhaber', async () => {
    await mitAbsender();
    const r = await anfordern(anfrage(`klara@neu.${D}`));
    expect(r.status, r.text).toBe(200);
    expect(r.d).toMatchObject({ ok: true, status: 'verschickt' });
    const u = r.anfrageId;
    const kk = (await kontakte()).find(x => x.id === `c-${u}`)!;
    expect(kk).toMatchObject({ vorname: 'Klara', email: `klara@neu.${D}`, herkunft: 'vertrag', rechtsgrundlage: 'vertrag', quelle: 'Vertrieb (Formular)' });
    expect(kk.einwilligungen?.some(e => e.kanal === 'mail' && e.grundlage === 'anfrage')).toBe(true);
    expect(kk.datenschutzInformiertAm).toBeTruthy();
    expect(kk.aktivitaeten.some(a => a.art === 'mail' && /^Angebot .* gesendet/.test(a.text ?? ''))).toBe(true);
    const c = await crm();
    const firma = c.firmen.find(f => f.name === 'Kundenwerk GmbH')!;
    expect(firma.zahlung?.empfaenger?.anschrift).toBe('Musterweg 3, 12345 Beispielstadt');
    const deal = c.chancen.find(x => x.id === `ch-af-${u}`)!;
    expect(deal).toMatchObject({ leistungId: 'l-beratung', firmaId: firma.id, stufe: 'angebot' });
    expect(deal.notiz).toContain('Kunde will im Dezember starten.');
    const a = c.angebote.find(x => x.id === `ang-af-${u}`)!;
    expect(a).toMatchObject({ status: 'gestellt', kontaktId: `c-${u}`, dealId: deal.id, gesellschaft: 'ug' });
    expect(a.nummer).toBeTruthy();
    expect(a.versendet?.length).toBe(1);
    expect(c.followups.some(f => f.id === `fu-${a.id}`)).toBe(true);
    // Die Mail: an die Adresse der Anfrage, mit dem PDF dieses Angebots.
    expect(server.gesendet).toHaveLength(1);
    expect(server.gesendet[0].an).toEqual([`klara@neu.${D}`]);
    const roh = server.gesendet[0].roh.toString('utf8');
    expect(roh).toContain('Content-Type: application/pdf');
    expect(roh).toContain(`Angebot ${a.nummer}.pdf`);
    expect(roh).toMatch(/Datenschutz/);
    // Eingang: nur Kennungen, Empfänger als Fingerabdruck — nie die Adresse im Klartext.
    const roh2 = readFileSync(path.join(ordner, 'angebot-formular--h.json'), 'utf8');
    expect(roh2).not.toContain(`klara@neu.${D}`);
    const e = (await formular()).eingaenge[0];
    expect(e).toMatchObject({ status: 'verschickt', kontaktId: `c-${u}`, angebotId: a.id, nummer: a.nummer, quelle: 'intern', von: 'malin' });
    expect(e.an?.maskiert).toBe(`k***@neu.${D}`);
    // Glocke an den Inhaber (nicht an die Vertrieblerin selbst).
    const glocke = await db.loadJson<{ eintraege: { art: string; titel: string }[] }>('meldungen--kevin');
    expect(glocke?.eintraege.some(m => m.art === 'angebot' && m.titel.includes('verschickt') && m.titel.includes('Malin'))).toBe(true);
  });

  it('bekannter Kunde (Adresse in anderer Schreibweise): angehängt, keine Dublette', async () => {
    await mitAbsender();
    const vorher = (await kontakte()).length;
    const r = await anfordern({ ...anfrage(`BERT@kunde.${D}`), firma: { name: 'Bestand AG' } });
    expect(r.d.status).toBe('verschickt');
    expect((await kontakte()).length).toBe(vorher);
    const a = (await crm()).angebote.find(x => x.id === `ang-af-${r.anfrageId}`)!;
    expect(a).toMatchObject({ kontaktId: 'c-bekannt', firmaId: 'f-bestand' });
    expect(server.gesendet[0].an).toEqual([`bert@kunde.${D}`]);
  });

  it('Rabatt bzw. eigener Preis → fertig gebaut, NICHT verschickt, Freigabe; „Senden“ eines Inhabers verschickt (ein Klick)', async () => {
    await mitAbsender();
    const r = await anfordern({ ...anfrage(`rabatt@neu.${D}`), produkte: [{ id: 'l-beratung', rabattProzent: 10 }] });
    expect(r.d).toMatchObject({ ok: true, status: 'freigabe' });
    expect(r.d.gruende.join(' ')).toContain('Rabatt');
    expect(server.gesendet).toHaveLength(0);
    const a = (await crm()).angebote.find(x => x.id === `ang-af-${r.anfrageId}`)!;
    expect(a.status).toBe('entwurf');
    const e = (await formular()).eingaenge[0];
    expect(e.status).toBe('freigabe');
    // Nicht-Inhaber gibt nicht frei; der Inhaber per Sitzung schon.
    expect((await POST(stapel, '/api/zoe/stapel', { id: e.vorschlagId }, sitzung('malin'))).status).toBe(403);
    const f = await POST(stapel, '/api/zoe/stapel', { id: e.vorschlagId }, sitzung('kevin'));
    expect(f.status, f.text).toBe(200);
    expect(server.gesendet).toHaveLength(1);
    expect((await crm()).angebote.find(x => x.id === a.id)!.status).toBe('gestellt');
    expect((await formular()).eingaenge[0]).toMatchObject({ status: 'verschickt', entschieden: { art: 'gesendet', von: 'kevin' } });
  });

  it('Werbesperre → nur verknüpfen, Freigabe; keine Einwilligung angehängt', async () => {
    await mitAbsender();
    const r = await anfordern(anfrage(`selma@kunde.${D}`));
    expect(r.d.status).toBe('freigabe');
    expect(r.d.gruende.join(' ')).toContain('Werbesperre');
    expect(server.gesendet).toHaveLength(0);
    const s = (await kontakte()).find(x => x.id === 'c-sperre')!;
    expect(s.einwilligungen ?? []).toEqual([]);
  });

  it('Art. 18 → abgelehnt, NICHTS angelegt (kein Kontakt, keine Firma, kein Deal, kein Angebot)', async () => {
    await mitAbsender();
    const [k0, c0] = [(await kontakte()).length, await crm()];
    const r = await anfordern({ ...anfrage(`erika@kunde.${D}`), firma: { name: 'Ganz Neue Firma GmbH' } });
    expect(r.status).toBe(409);
    expect(r.d).toMatchObject({ ok: false, status: 'abgelehnt', eingeschraenkt: true });
    const c1 = await crm();
    expect((await kontakte()).length).toBe(k0);
    expect(c1.firmen.length).toBe(c0.firmen.length);
    expect(c1.chancen.length).toBe(c0.chancen.length);
    expect(c1.angebote.length).toBe(c0.angebote.length);
    expect(server.gesendet).toHaveLength(0);
    expect((await formular()).eingaenge[0]).toMatchObject({ status: 'abgelehnt' });
    expect((await formular()).eingaenge[0].kontaktId).toBeUndefined();
  });

  it('ohne Absender-Postfach → Freigabe mit Hinweis „Absender-Postfach fehlt“', async () => {
    const r = await anfordern(anfrage(`ohne@neu.${D}`));
    expect(r.d.status).toBe('freigabe');
    expect(r.d.gruende.join(' ')).toContain('Absender-Postfach fehlt');
  });

  it('Privat-Gesellschaft nie; nicht aktive Produkte nie', async () => {
    expect((await anfordern({ ...anfrage(`p@neu.${D}`), produkte: [{ id: 'l-privat' }] })).status).toBe(400);
    expect((await anfordern({ ...anfrage(`p@neu.${D}`), produkte: [{ id: 'l-entwurf' }] })).status).toBe(400);
  });

  for (const schritt of ['eingang', 'kunde', 'deal', 'angebot', 'entscheiden', 'stellen', 'senden', 'abschluss']) {
    it(`Abbruch nach „${schritt}“ + Wiederholung = nichts doppelt`, async () => {
      await mitAbsender();
      const id = uuid();
      let einmal = true;
      A.absichtTest.vorAbhaken = (art, s) => { if (art === 'angebot-anfrage' && s === schritt && einmal) { einmal = false; throw new A.TestAbbruch(s); } };
      const erst = await anfordern(anfrage(`abbruch@neu.${D}`), 'malin', id);
      expect(erst.status).toBe(500);
      const zweit = await anfordern(anfrage(`abbruch@neu.${D}`), 'malin', id);
      expect([200, 202]).toContain(zweit.status);
      await (await import('@/lib/store/absichten-fortsetzen')).offeneFertigstellen();
      const c = await crm();
      expect((await kontakte()).filter(x => x.email === `abbruch@neu.${D}`)).toHaveLength(1);
      expect(c.firmen.filter(f => f.name === 'Kundenwerk GmbH')).toHaveLength(1);
      expect(c.chancen.filter(x => x.id.startsWith('ch-af-'))).toHaveLength(1);
      expect(c.angebote.filter(x => x.id.startsWith('ang-af-'))).toHaveLength(1);
      expect(c.angebote[0].status).toBe('gestellt');
      expect(server.gesendet).toHaveLength(1);
      const f = await formular();
      expect(f.eingaenge).toHaveLength(1);
      expect(f.eingaenge[0].status).toBe('verschickt');
      expect((await A.absichtenLaden('h')).filter(x => x.art === 'angebot-anfrage' && A.istOffen(x))).toEqual([]);
      const glocke = await db.loadJson<{ eintraege: { art: string }[] }>('meldungen--kevin');
      expect(glocke?.eintraege.filter(m => m.art === 'angebot')).toHaveLength(1);
    });
  }
});

// ── Versand-Wächter ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('„Angebot verschicken im Auftrag“ — nichts anderes geht darüber', () => {
  it('nimmt NUR die Kennung des Eingangs (kein Empfänger, kein Text, kein Anhang, kein Postfach von außen)', () => {
    const q = readFileSync(path.join(wurzel, 'lib/crm/angebot-versand.ts'), 'utf8');
    expect(q).toMatch(/export async function angebotVerschickenImAuftrag\(eingangId: string, o: \{ ausgeloest: string \}\)/);
    // Nur der Formular-Kern ruft sie (automatisch und bei „Senden“).
    const dateien = (dir: string): string[] => readdirSync(path.join(wurzel, dir), { withFileTypes: true }).flatMap(e => e.isDirectory() ? (e.name === 'node_modules' ? [] : dateien(`${dir}/${e.name}`)) : /\.tsx?$/.test(e.name) ? [`${dir}/${e.name}`] : []);
    const nutzer = ['lib', 'app', 'components'].flatMap(dateien).filter(f => f !== 'lib/crm/angebot-versand.ts' && readFileSync(path.join(wurzel, f), 'utf8').includes('angebotVerschickenImAuftrag'));
    expect(nutzer).toEqual(['lib/crm/formulare-server.ts']);
  });
  it('Entwurf, fremde Adresse, Privat-Postfach → nichts verschickt', async () => {
    const pf = await mitAbsender();
    const r = await anfordern({ ...anfrage(`w@neu.${D}`), produkte: [{ id: 'l-beratung', rabattProzent: 5 }] });
    const id = `af-${r.anfrageId}`;
    const { angebotVerschickenImAuftrag } = await import('@/lib/crm/angebot-versand');
    expect(await angebotVerschickenImAuftrag(id, { ausgeloest: 'kevin' })).toMatchObject({ ok: false, status: 409 });
    // Fingerabdruck verbogen → keine Adresse des Kontakts passt.
    const S = await import('@/lib/crm/formulare-speicher');
    await S.aendereEingang(id, e => ({ ...e, an: { hash: '0'.repeat(64), maskiert: 'x' } }));
    const { angebotStellen } = await import('@/lib/crm/angebot-server');
    const { standVon } = await import('@/lib/crm/crm-stand');
    const a = (await crm()).angebote.find(x => x.id === `ang-af-${r.anfrageId}`)!;
    await angebotStellen({ id: a.id, stand: standVon(a), person: 'kevin', haushalt: 'h' });
    expect(await angebotVerschickenImAuftrag(id, { ausgeloest: 'kevin' })).toMatchObject({ ok: false, status: 409 });
    // Privat-Postfach als Absender lässt sich nicht wählen.
    const privat = await POST(postfaecher, '/api/inbox/postfaecher', { aktion: 'hinzufuegen', anbieter: 'ionos', adresse: `privat@firma.${D}`, passwort: PW, bereich: 'privat', anzeigename: 'Privat' });
    expect((await POST(formulare, '/api/crm/formulare', { aktion: 'einstellungen', absender: privat.d.id })).status).toBe(400);
    expect(pf).toBeTruthy();
    expect(server.gesendet).toHaveLength(0);
  });
});

// ── Trennung auf dem Server ─────────────────────────────────────────────────────────────────────────────────────────────────────
describe('Sicht X bekommt nichts aus Y', () => {
  it('Eingänge: Inhaber alle, andere nur die eigenen; Links und Einstellungen nur Inhaber; fremder Haushalt 403; Dienstweg schreibt nicht', async () => {
    await anfordern(anfrage(`m1@neu.${D}`), 'malin');
    await anfordern(anfrage(`k1@neu.${D}`), 'kevin');
    const link = await POST(formulare, '/api/crm/formulare', { aktion: 'link-neu', name: 'Rita Reisende', produkte: ['l-beratung'] });
    expect(link.status, link.text).toBe(200);
    expect(link.d.pfad).toMatch(/^\/angebot\/rita-reisende-[a-f0-9]{24}$/);
    expect(link.text).not.toContain('tokenHash');
    const kevin = await GET(formulare, '/api/crm/formulare');
    expect(kevin.d.eingaenge).toHaveLength(2);
    expect(kevin.d.links).toHaveLength(1);
    const malin = await GET(formulare, '/api/crm/formulare', sitzung('malin'));
    expect(malin.d.eingaenge).toHaveLength(1);
    expect(malin.d.links).toEqual([]);
    expect(malin.text).not.toContain('Rita');
    expect((await POST(formulare, '/api/crm/formulare', { aktion: 'link-neu', name: 'X', produkte: ['l-beratung'] }, sitzung('malin'))).status).toBe(403);
    expect((await GET(formulare, '/api/crm/formulare', sitzung('fremd'))).status).toBe(403);
    expect((await POST(formulare, '/api/crm/formulare', { aktion: 'anfordern', anfrage: anfrage(`d@neu.${D}`) }, { 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': 'kevin', 'content-type': 'application/json' })).status).toBe(403);
    // Eine Adresse steht nie im Klartext in der Antwort.
    expect(kevin.text).not.toContain(`m1@neu.${D}`);
  });
  it('Partner „nur Business“ darf intern anfordern', async () => {
    const r = await anfordern(anfrage(`partner@neu.${D}`), 'partner');
    expect(r.status, r.text).toBe(200);
    expect(r.d.status).toBe('freigabe');
  });
});
