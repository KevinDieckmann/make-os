// ─── Öffentliche Strecken: „Adresse unbestätigt“ (Kevin 31.10., Klickrunde) ─────────────────────────────────────────────────────────────
// Trifft die Mail einer öffentlichen Strecke (Innovations-Check, externer Link des Angebots-Formulars) eine VORHANDENE Person, wird nur
// angehängt: System-Vermerk „Anfrage (Adresse unbestätigt) über …“, Follow-up „Anfrage prüfen — Adresse unbestätigt“, KEINE Einwilligung,
// KEINE Stufe, KEIN Lead, kein Deal, keine automatische Mail. Neue Personen wie bisher. „Anfrage übernehmen“ (Check) bzw. „Senden“ in der
// Freigabe (Formular) übernimmt von Hand über die vorhandenen Wege. Eigener Datenordner, erfundene Daten (@example.invalid), kein Netz.
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Kontakt } from '@/lib/make-one/crm';
import type { Leistung } from '@/lib/crm/typen';
import type { PostSpeicher as PS } from '@/lib/postfach/post-speicher';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-adresse-unbestaetigt-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-unbestaetigt';
process.env.MAKE_OS_KEY = 'dienst-test-unbestaetigt';
process.env.MAKE_OS_PEPPER = 'pruef-pepper-unbestaetigt-0123456789ab';

const D = 'example.invalid';
const PW = 'Geheim-Postfach-4711';
type R = { GET?: (r: Request) => Promise<Response>; POST?: (r: Request) => Promise<Response> };
let formulare: R, postfaecher: R, stapel: R, followup: R;
let db: typeof import('@/lib/store/local-db');
let T: typeof import('@/lib/postfach/transport');
let P: typeof import('@/lib/postfach/post-speicher');
let server: PS;

const sitzung = (person: string) => ({ 'x-make-user': person, 'content-type': 'application/json' });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const j = async (r: Response) => ({ status: r.status, text: await r.clone().text(), d: await r.json().catch(() => ({})) as Record<string, any> });
const POST = (route: R, url: string, body: unknown, h: Record<string, string> = sitzung('kevin')) => route.POST!(new Request(`http://localhost${url}`, { method: 'POST', headers: h, body: JSON.stringify(body) })).then(j);
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id, vorname: 'Vera', nachname: `Muster ${id.slice(2)}`, eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01', anrede: 'Sie', ...x } as Kontakt);
const J = '2026-09-01T10:00:00.000Z';
const PRODUKT: Leistung = {
  id: 'l-beratung', name: 'Beratungs-Retainer', typ: 'retainer', stufe: 'kern', preis: { betrag: 2500, einheit: 'Monat netto', basis: 'monat' }, lieferumfang: ['Zwei Termine'], gesellschaft: 'ug', status: 'aktiv',
  angebot: { leistungstext: 'Monatlich zwei Beratungstermine mit Vorbereitung und Protokoll.' }, geaendert: J,
  preise: [{ id: 'pt-monat', art: 'monatlich', betragCent: 250000, rolle: 'grund' }],
} as Leistung;
const KONTEN = { konten: [
  { id: 'k1', speicher: 'kevin', email: `kevin@${D}`, name: 'Kevin Beispiel', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'h' },
  { id: 'k2', speicher: 'malin', email: `malin@${D}`, name: 'Malin Beispiel', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'h' },
], einladungen: [] };
const anfrage = (email: string) => ({
  firma: { name: 'Fremdfirma GmbH', strasse: 'Musterweg 3', plz: '12345', ort: 'Beispielstadt' },
  person: { anrede: 'Sie', vorname: 'Unbekannt', nachname: 'Jemand', email },
  produkte: [{ id: 'l-beratung' }],
});
let zaehler = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++zaehler).padStart(12, '0')}`;
const crm = async () => (await import('@/lib/crm/speicher')).ladeCrm();
const kontakte = async () => (await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte;
const bert = async () => (await kontakte()).find(x => x.id === 'c-bekannt')!;
const formular = async () => (await import('@/lib/crm/formulare-speicher')).ladeFormular();

beforeAll(async () => {
  db = await import('@/lib/store/local-db'); T = await import('@/lib/postfach/transport'); P = await import('@/lib/postfach/post-speicher');
  formulare = await import('../app/api/crm/formulare/route') as R;
  postfaecher = await import('../app/api/inbox/postfaecher/route') as R;
  stapel = await import('../app/api/zoe/stapel/route') as R;
  followup = await import('../app/api/crm/followup/route') as R;
});
afterAll(() => { T.transportSetzen(null); rmSync(ordner, { recursive: true, force: true }); });
afterEach(() => { vi.unstubAllGlobals(); });

beforeEach(async () => {
  for (const f of readdirSync(ordner)) rmSync(path.join(ordner, f), { recursive: true, force: true });
  db.leseCacheLeeren();
  vi.stubEnv('GOOGLE_CLIENT_ID', ''); vi.stubEnv('GOOGLE_CLIENT_SECRET', ''); vi.stubEnv('NEXT_PUBLIC_MAKE_BAU', '');
  vi.stubGlobal('fetch', async () => { throw new Error('kein Netz im Test'); });
  server = new P.PostSpeicher({ passwort: PW, ordner: [{ pfad: 'INBOX' }, { pfad: 'Gesendete Objekte' }] });
  T.transportSetzen({ imap: z => server.sitzung(z), smtp: (z, u, roh) => server.senden(z, u, roh), waechter: async () => ({ stop: async () => {} }) });
  await db.saveJson('konten', KONTEN);
  await db.saveJson('kontakte', { kontakte: [k('c-bekannt', { vorname: 'Bert', nachname: 'Bekannt', email: `bert@kunde.${D}`, firma: 'Bestand AG', firmaId: 'f-bestand', besitzer: 'kevin' })] });
  const { leererBestand } = await import('@/lib/crm/speicher');
  await db.saveJson('crm', { ...leererBestand(), firmen: [{ id: 'f-bestand', name: 'Bestand AG', rolle: 'interessent', geaendert: J }], leistungen: [PRODUKT] });
  await db.saveJson('gesellschaften--h', { gesellschaften: [{ id: 'ug', firmierung: 'Beispiel Innovation GmbH', strasse: 'Beispielweg 1', plz: '12345', ort: 'Musterstadt', email: `info@${D}` }] });
  await db.saveJson('datenschutz-einrichtung', { verantwortlicher: { name: 'Beispiel Innovation GmbH', anschrift: 'Beispielweg 1, 12345 Musterstadt', mail: `datenschutz@${D}` } });
});

const checkAnfrage = async (email: string, oeffentlich = true) => {
  const { anfrageAnlegen } = await import('@/lib/crm/anfrage-anlegen');
  return anfrageAnlegen({ neu: { vorname: 'Fremd', email, firma: 'Fremdfirma GmbH' }, kanal: 'website', text: 'Kurzcheck ausgefüllt, Stufe 2.' }, { person: 'kevin', wer: { art: 'system' }, ...(oeffentlich ? { oeffentlich: true } : {}) });
};

describe('Innovations-Check (öffentlich) — vorhandene Person', () => {
  it('fremde Anfrage mit bekannter Mail: Vermerk „unbestätigt“, KEINE Einwilligung, KEINE Stufe, KEIN Lead, Follow-up „Anfrage prüfen“', async () => {
    const r = await checkAnfrage(`BERT@kunde.${D}`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.bau.unbestaetigt).toBe(true);
    expect(r.bau.neuePerson).toBe(false);
    const b = await bert();
    expect(b.einwilligungen ?? []).toEqual([]);
    expect(b.stufe).toBe('neu');
    expect(b.letzterKontakt).toBeUndefined();
    expect(b.lead).toBeUndefined();
    expect(b.aktivitaeten).toHaveLength(1);
    expect(b.aktivitaeten[0]).toMatchObject({ art: 'system', von: 'system' });
    expect(b.aktivitaeten[0].text).toMatch(/^Anfrage \(Adresse unbestätigt\) über Website: /);
    const c = await crm();
    expect(c.firmen.find(f => f.id === 'f-bestand')!.lead).toBeUndefined();
    expect(c.firmen).toHaveLength(1); // keine Firma aus der Anfrage angelegt
    const fu = c.followups.find(f => f.kontaktId === 'c-bekannt')!;
    expect(fu).toMatchObject({ text: 'Anfrage prüfen — Adresse unbestätigt — Website', art: 'sonstig', status: 'offen' });
    // Zählt nicht als Anfrage (Trichter, Marketing-Herkunft, Anfragen-Liste).
    const { anfragenListe } = await import('@/lib/crm/anfragen');
    expect(anfragenListe(await kontakte(), c, fu.faellig)).toEqual([]);
  });

  it('neue Person (keine Übereinstimmung) wie bisher: Einwilligung „Antwort auf Anfrage“, Follow-up „Anfrage beantworten“', async () => {
    const r = await checkAnfrage(`neu@woanders.${D}`);
    expect(r.ok && r.bau.neuePerson && !r.bau.unbestaetigt).toBe(true);
    if (!r.ok) return;
    const p = (await kontakte()).find(x => x.id === r.bau.kontakt.id)!;
    expect(p.einwilligungen?.some(e => e.kanal === 'mail' && e.grundlage === 'anfrage')).toBe(true);
    expect(p.aktivitaeten.some(a => a.art === 'antwort' && a.text?.startsWith('Anfrage über Website'))).toBe(true);
    expect((await crm()).followups.find(f => f.kontaktId === p.id)!.text).toMatch(/^Anfrage beantworten/);
  });

  it('interner Weg (nicht öffentlich) an derselben Person: unverändert mit Einwilligung und Stufe', async () => {
    const r = await checkAnfrage(`bert@kunde.${D}`, false);
    expect(r.ok && !r.bau.unbestaetigt).toBe(true);
    const b = await bert();
    expect(b.einwilligungen?.some(e => e.kanal === 'mail' && e.grundlage === 'anfrage')).toBe(true);
    expect(b.stufe).not.toBe('neu');
  });

  it('„Anfrage übernehmen“ (von Hand): dann wie jede Anfrage — Einwilligung, Stufe, Follow-up „beantworten“; ein zweiter Klick legt nichts doppelt an', async () => {
    await checkAnfrage(`bert@kunde.${D}`);
    const fu = (await crm()).followups.find(f => f.kontaktId === 'c-bekannt')!;
    const r = await POST(followup, '/api/crm/followup', { aktion: 'anfrage-uebernehmen', id: fu.id });
    expect(r.status, r.text).toBe(200);
    const b = await bert();
    expect(b.einwilligungen?.some(e => e.kanal === 'mail' && e.grundlage === 'anfrage')).toBe(true);
    expect(b.stufe).toBe('angesprochen');
    const c = await crm();
    expect(c.followups.find(f => f.id === fu.id)!.status).toBe('erledigt');
    expect(c.followups.filter(f => f.kontaktId === 'c-bekannt' && f.text.startsWith('Anfrage beantworten'))).toHaveLength(1);
    const zwei = await POST(followup, '/api/crm/followup', { aktion: 'anfrage-uebernehmen', id: fu.id });
    expect(zwei.status).toBe(409);
    expect((await crm()).followups.filter(f => f.kontaktId === 'c-bekannt' && f.text.startsWith('Anfrage beantworten'))).toHaveLength(1);
    // Ein anderes Follow-up lässt sich so nicht „übernehmen“.
    const anders = (await crm()).followups.find(f => f.text.startsWith('Anfrage beantworten'))!;
    expect((await POST(followup, '/api/crm/followup', { aktion: 'anfrage-uebernehmen', id: anders.id })).status).toBe(404);
  });

  it('Art. 18 bleibt: eine eingeschränkte Person bekommt auch keinen Vermerk', async () => {
    await db.saveJson('kontakte', { kontakte: [k('c-eng', { email: `eng@kunde.${D}`, eingeschraenkt: { seit: '2026-09-01', grund: 'Art. 18', von: 'kevin' } })] });
    db.leseCacheLeeren();
    const r = await checkAnfrage(`eng@kunde.${D}`);
    expect(r.ok).toBe(false);
    expect((await kontakte())[0].aktivitaeten).toEqual([]);
  });
});

describe('Angebots-Formular über einen externen Link — vorhandene Person', () => {
  async function link() {
    const pf = await POST(postfaecher, '/api/inbox/postfaecher', { aktion: 'hinzufuegen', anbieter: 'ionos', adresse: `angebote@firma.${D}`, passwort: PW, bereich: 'ug', anzeigename: 'Angebote', absenderName: 'Vertrieb Beispiel' });
    expect(pf.status, pf.text).toBe(200);
    expect((await POST(formulare, '/api/crm/formulare', { aktion: 'einstellungen', absender: pf.d.id })).status).toBe(200);
    const l = await POST(formulare, '/api/crm/formulare', { aktion: 'link-neu', name: 'Rita Reisende', produkte: ['l-beratung'] });
    expect(l.status, l.text).toBe(200);
    return (await formular()).links[0];
  }
  const perLink = async (l: Awaited<ReturnType<typeof link>>, email: string, anfrageId = uuid()) => {
    const { angebotAnfordern } = await import('@/lib/crm/formulare-server');
    return { r: await angebotAnfordern({ ...anfrage(email) }, { art: 'link', link: l }, { anfrageId }), anfrageId };
  };

  it('bekannte Mail: kein Versand, kein Deal, keine Einwilligung, keine Firma; Vermerk + Follow-up; „Senden“ (Inhaber) übernimmt', async () => {
    const l = await link();
    const { r, anfrageId } = await perLink(l, `bert@kunde.${D}`);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, status: 'freigabe' });
    expect(JSON.stringify(r.body)).not.toContain('Bekannt'); // dem Externen nie etwas aus dem Bestand
    expect(server.gesendet).toHaveLength(0);
    const c = await crm();
    expect(c.chancen).toEqual([]);
    expect(c.firmen).toHaveLength(1);
    const a = c.angebote.find(x => x.id === `ang-af-${anfrageId}`)!;
    expect(a).toMatchObject({ status: 'entwurf', kontaktId: 'c-bekannt' });
    expect(a.dealId).toBeUndefined();
    const b = await bert();
    expect(b.einwilligungen ?? []).toEqual([]);
    expect(b.stufe).toBe('neu');
    expect(b.aktivitaeten.some(x => x.art === 'system' && x.text?.startsWith('Anfrage (Adresse unbestätigt) über '))).toBe(true);
    const fu = c.followups.find(f => f.id === `fu-af-${anfrageId}`)!;
    expect(fu).toMatchObject({ text: 'Anfrage prüfen — Adresse unbestätigt — Angebot anfordern', status: 'offen', art: 'sonstig' });
    const e = (await formular()).eingaenge[0];
    expect(e).toMatchObject({ status: 'freigabe', adresseUnbestaetigt: true });
    expect(e.gruende?.join(' ')).toContain('Adresse unbestätigt');
    // „Anfrage übernehmen“ am Follow-up gilt hier nicht — die Freigabe übernimmt.
    expect((await POST(followup, '/api/crm/followup', { aktion: 'anfrage-uebernehmen', id: fu.id })).status).toBe(409);
    // Senden (Inhaber, Sitzung) = Übernahme von Hand: gestellt, verschickt, jetzt mit Einwilligung und Deal, Follow-up erledigt.
    const f = await POST(stapel, '/api/zoe/stapel', { id: e.vorschlagId }, sitzung('kevin'));
    expect(f.status, f.text).toBe(200);
    expect(server.gesendet).toHaveLength(1);
    const c2 = await crm();
    const a2 = c2.angebote.find(x => x.id === a.id)!;
    expect(a2.status).toBe('gestellt');
    expect(a2.dealId).toBeTruthy();
    expect((await bert()).einwilligungen?.some(x => x.kanal === 'mail' && x.grundlage === 'anfrage' && /von Hand übernommen/.test(x.nachweis ?? ''))).toBe(true);
    expect(c2.followups.find(x => x.id === fu.id)!.status).toBe('erledigt');
  });

  it('Ablehnen in der Freigabe: Prüf-Follow-up abgesagt, an der Person bleibt nur der Vermerk', async () => {
    const l = await link();
    const { anfrageId } = await perLink(l, `bert@kunde.${D}`);
    const e = (await formular()).eingaenge[0];
    const r = await POST(stapel, '/api/zoe/stapel', { id: e.vorschlagId, entscheidung: 'ablehnen', grund: 'Nicht von Bert' }, sitzung('kevin'));
    expect(r.status, r.text).toBe(200);
    const c = await crm();
    expect(c.followups.find(f => f.id === `fu-af-${anfrageId}`)!.status).toBe('abgesagt');
    expect(c.chancen).toEqual([]);
    expect((await bert()).einwilligungen ?? []).toEqual([]);
  });

  it('neue Mail über den Link: wie bisher (Kontakt neu, Deal, Einwilligung) — kein „unbestätigt“', async () => {
    const l = await link();
    const { anfrageId } = await perLink(l, `ganz.neu@woanders.${D}`);
    const e = (await formular()).eingaenge[0];
    expect(e.adresseUnbestaetigt).toBeUndefined();
    const c = await crm();
    expect(c.chancen.some(x => x.id === `ch-af-${anfrageId}`)).toBe(true);
    expect(c.followups.some(f => f.id === `fu-af-${anfrageId}`)).toBe(false);
  });

  it('Wiederholung derselben Anfrage legt Vermerk und Follow-up nicht doppelt an', async () => {
    const l = await link();
    const id = uuid();
    await perLink(l, `bert@kunde.${D}`, id);
    await perLink(l, `bert@kunde.${D}`, id);
    expect((await bert()).aktivitaeten.filter(x => x.art === 'system')).toHaveLength(1);
    expect((await crm()).followups.filter(f => f.id === `fu-af-${id}`)).toHaveLength(1);
  });
});
