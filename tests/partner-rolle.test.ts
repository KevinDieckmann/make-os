// ─── Rolle „nur Business“ in der Markttraktion (13.10., Kevin: „Nur lesen + Entwürfe“) ─────────────────────────────────────────────
// Ein Konto mit `finanzRecht: 'business'` (Vertriebspartner) im Haushalt der Inhaber: Angebote und Unterlagen LESEN, Angebots-ENTWÜRFE
// vorbereiten — stellen, annehmen, ablehnen, neue Version, Gesellschaften verwalten → 403. Nie Privates (Angebote/Mandate einer
// Privat-Einheit), nie die Firmen-Akte (Unterlagen einer eigenen Gesellschaft), nie Rechnungen. Wächter je Route; Regel: lib/crm/nur-business.ts.
// Eigener Datenordner, erfundene Daten (@example.invalid) — nie der echte Bestand.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Angebot, Mandat } from '@/lib/crm/typen';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-partner-rolle-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-partner-rolle';
process.env.MAKE_OS_OHNE_APPLE = '1';
for (const n of ['MAKE_OS_DATEN_SCHLUESSEL', 'ICLOUD_APPLE_ID', 'ICLOUD_APP_PASSWORT', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'NEXT_PUBLIC_MAKE_BAU']) delete process.env[n];

const HAUS = 'pr-haus';
const J = '2026-10-01T10:00:00.000Z';
const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) =>
  ({ id, speicher, email: `${speicher}@example.invalid`, name: `${speicher} Test`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: HAUS, ...extra });
const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
type Route = Record<string, (r: Request) => Promise<Response>>;
type Antwort = { status: number; d: Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
const rufe = async (h: (r: Request) => Promise<Response>, pfad: string, person: string, init: RequestInit = {}): Promise<Antwort> => {
  const r = await h(new Request(`http://test${pfad}`, { ...init, headers: { ...sitzung(person), ...(init.headers ?? {}) } }));
  return { status: r.status, d: await r.json().catch(() => ({})) };
};
const PRIVAT = 'PRIVAT-MARKE-SELBSTSTAENDIGKEIT';
const AKTE = 'FIRMENAKTE-MARKE';

const angebot = (id: string, gesellschaft: string, status: Angebot['status'], titel: string): Angebot => ({
  id, gesellschaft: gesellschaft as Angebot['gesellschaft'], titel, positionen: [{ id: 'p1', titel: 'Leistung', text: '', menge: 1, einheit: 'pauschal', einzelpreisCent: 100000, ustSatz: 19, basis: 'einmalig' }],
  einleitung: 'Guten Tag,', schluss: 'Viele Grüße', gueltigBis: '2099-12-31', zahlungszielTage: 14, status, version: 1, angelegt: J, geaendert: J,
  ...(status !== 'entwurf' ? { nummer: `${gesellschaft.toUpperCase()}-A-2026-0001`, gestelltAm: J, gestelltVon: 'inh' } : {}),
} as Angebot);
const mandat = (id: string, gesellschaft: string): Mandat => ({ id, kunde: 'Beispiel Werke', kontaktIds: [], titel: 'Retainer', art: 'retainer', gesellschaft, status: 'aktiv', vertragUnterschrieben: true, verlaengerung: 'offen', honorar: { betrag: 100, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: J } as unknown as Mandat);

let angebotR: Route, dateienR: Route, crmGesR: Route, gesR: Route, spiegelR: Route;
const ids: Record<string, string> = {};

beforeAll(async () => {
  const db = await import('@/lib/store/local-db');
  const speicher = await import('@/lib/crm/speicher');
  const ablage = await import('@/lib/dateien/ablage');
  await db.saveJson('konten', { konten: [
    konto('k1', 'inh', 'inhaber'), konto('k2', 'voll', 'mitglied'), konto('k3', 'partner', 'mitglied', { finanzRecht: 'business' }),
    konto('k4', 'fremd', 'mitglied', { haushalt: 'anderer-haus', finanzRecht: 'business' }),
  ], einladungen: [] });
  await db.saveJson('kontakte', { kontakte: [{ id: 'c-anna1', vorname: 'Anna', nachname: 'Beispiel', email: 'anna@example.invalid', eignung: '', prio: '', stufe: 'gespraech', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01' }] });
  await db.saveJson('crm', { ...speicher.leererBestand(),
    angebote: [angebot('ang-kdv-gestellt', 'kdv', 'gestellt', 'Business gestellt'), angebot('ang-kdv-entwurf', 'kdv', 'entwurf', 'Business Entwurf'), angebot('ang-kdc-entwurf', 'kdc', 'entwurf', PRIVAT)],
    mandate: [mandat('m-kdv', 'kdv'), mandat('m-kdc', 'kdc')],
    events: [{ id: 'ev-pr', titel: 'Make.One Abend', datum: '2099-06-01', uhrzeit: '18:00', status: 'geplant', format: 'abend', geaendert: J }],
  });
  await db.saveJson(`gesellschaften--${HAUS}`, { gesellschaften: [
    { id: 'kdv', firmierung: 'Beispiel Ventures UG (haftungsbeschränkt)', strasse: 'Beispielweg 1', plz: '12345', ort: 'Musterstadt', kurz: 'BVU' },
    { id: 'kdc', firmierung: `${PRIVAT} Einzelunternehmen`, strasse: 'Privatweg 2', plz: '12345', ort: 'Musterstadt' },
  ] });
  // Ablage: je Fall ein Eintrag (Klartext ohne Datenschlüssel) — Inhalt ein kleines PDF.
  const pdf = (name: string) => ({ bytes: Buffer.from('%PDF-1.4\n% partner-rolle\n'), name, typ: 'application/pdf' as const });
  ids.kontakt = (await ablage.ablegen(HAUS, 'inh', { art: 'vertrag', titel: 'Rahmenvertrag Kunde', kontaktId: 'c-anna1' }, pdf('vertrag.pdf'), J)).id;
  ids.angebotBusiness = (await ablage.ablegen(HAUS, 'inh', { art: 'angebot', titel: 'Angebot Business', kontaktId: 'c-anna1' }, pdf('ang-kdv.pdf'), J, { angebotId: 'ang-kdv-gestellt' })).id;
  ids.angebotPrivat = (await ablage.ablegen(HAUS, 'inh', { art: 'angebot', titel: `${PRIVAT} Angebot`, kontaktId: 'c-anna1' }, pdf('ang-kdc.pdf'), J, { angebotId: 'ang-kdc-entwurf' })).id;
  ids.mandatPrivat = (await ablage.ablegen(HAUS, 'inh', { art: 'vertrag', titel: `${PRIVAT} Mandat`, mandatId: 'm-kdc' }, pdf('m-kdc.pdf'), J)).id;
  ids.mandatBusiness = (await ablage.ablegen(HAUS, 'inh', { art: 'vertrag', titel: 'Mandat Business', mandatId: 'm-kdv' }, pdf('m-kdv.pdf'), J)).id;
  ids.akte = (await ablage.ablegen(HAUS, 'inh', { art: 'sonstig', titel: `${AKTE} Gesellschaftsvertrag` }, pdf('gv.pdf'), J, { gesellschaft: 'kdv' })).id;
  ids.rechnung = (await ablage.ablegen(HAUS, 'inh', { art: 'rechnung', titel: 'Rechnung 1', rechnungId: 'r-1', kontaktId: 'c-anna1' }, pdf('r.pdf'), J)).id;
  ids.logo = (await ablage.ablegen(HAUS, 'inh', { art: 'sonstig', titel: 'Logo KDV' }, { bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]), name: 'logo.png', typ: 'image/png' }, J, { gesellschaft: 'kdv' })).id;
  await db.updateJson<{ gesellschaften: { id: string; logoDateiId?: string }[] }>(`gesellschaften--${HAUS}`, d => ({ gesellschaften: (d?.gesellschaften ?? []).map(g => (g.id === 'kdv' ? { ...g, logoDateiId: ids.logo } : g)) }));
  angebotR = (await import('@/app/api/crm/angebot/route')) as unknown as Route;
  dateienR = (await import('@/app/api/crm/dateien/route')) as unknown as Route;
  crmGesR = (await import('@/app/api/crm/gesellschaften/route')) as unknown as Route;
  gesR = (await import('@/app/api/gesellschaften/route')) as unknown as Route;
  spiegelR = (await import('@/app/api/kalender/spiegel/route')) as unknown as Route;
}, 60_000);
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Regel (rein): lib/crm/nur-business.ts', () => {
  it('Angebot: nur speichern/ablage/loeschen; ablage/loeschen nur Entwürfe; nie Privat-Einheit', async () => {
    const { angebotAktionNurBusiness, NUR_ENTWURF, NUR_BUSINESS_SICHT } = await import('@/lib/crm/nur-business');
    for (const a of ['stellen', 'annehmen', 'ablehnen', 'version', 'gesendet', 'irgendwas', undefined]) expect(angebotAktionNurBusiness(a)).toBe(NUR_ENTWURF);
    expect(angebotAktionNurBusiness('speichern', { felder: { gesellschaft: 'kdv' } })).toBeNull();
    expect(angebotAktionNurBusiness('speichern', { felder: { gesellschaft: 'kdc' } })).toBe(NUR_BUSINESS_SICHT);
    expect(angebotAktionNurBusiness('speichern', { alt: { gesellschaft: 'kdc', status: 'entwurf' } })).toBe(NUR_BUSINESS_SICHT);
    expect(angebotAktionNurBusiness('ablage', { alt: { gesellschaft: 'kdv', status: 'entwurf' } })).toBeNull();
    expect(angebotAktionNurBusiness('ablage', { alt: { gesellschaft: 'kdv', status: 'gestellt' } })).toBe(NUR_ENTWURF);
    expect(angebotAktionNurBusiness('loeschen', { alt: { gesellschaft: 'kdv', status: 'abgelehnt' } })).toBe(NUR_ENTWURF);
  });
  it('Dateien: nur Business-Bezüge — nie Firmen-Akte, Rechnung, Aufgaben, Privat-Mandat/-Angebot, unbekannte Bezüge', async () => {
    const { dateiFuerNurBusiness } = await import('@/lib/crm/nur-business');
    const crm = { angebote: [{ id: 'a1', gesellschaft: 'kdv' as const }, { id: 'a2', gesellschaft: 'kdc' as const }], mandate: [{ id: 'm1', gesellschaft: 'ug' }, { id: 'm2', gesellschaft: 'kdc' }], chancen: [{ id: 'd1', gesellschaft: 'g-1234' }] };
    expect(dateiFuerNurBusiness({ kontaktId: 'c-1' }, crm)).toBe(true);
    expect(dateiFuerNurBusiness({ firmaId: 'f-1', dealId: 'd1' }, crm)).toBe(true);
    expect(dateiFuerNurBusiness({ angebotId: 'a1', kontaktId: 'c-1' }, crm)).toBe(true);
    expect(dateiFuerNurBusiness({ mandatId: 'm1' }, crm)).toBe(true);
    expect(dateiFuerNurBusiness({ angebotId: 'a2', kontaktId: 'c-1' }, crm)).toBe(false);
    expect(dateiFuerNurBusiness({ mandatId: 'm2' }, crm)).toBe(false);
    expect(dateiFuerNurBusiness({ dealId: 'unbekannt' }, crm)).toBe(false);
    expect(dateiFuerNurBusiness({ gesellschaft: 'kdv' }, crm)).toBe(false);
    expect(dateiFuerNurBusiness({ rechnungId: 'r-1', kontaktId: 'c-1' }, crm)).toBe(false);
    expect(dateiFuerNurBusiness({ projektId: 'p-1', kontaktId: 'c-1' }, crm)).toBe(false);
    expect(dateiFuerNurBusiness({}, crm)).toBe(false);
  });
});

describe('/api/crm/angebot — lesen + Entwürfe', () => {
  it('GET: Partner sieht nur Business-Angebote und -Absender (nurEntwuerfe), volle Mitglieder alles, fremder Haushalt 403', async () => {
    const p = await rufe(angebotR.GET, '/api/crm/angebot', 'partner');
    expect(p.status).toBe(200);
    expect(p.d.nurEntwuerfe).toBe(true);
    expect(p.d.angebote.map((a: Angebot) => a.id).sort()).toEqual(['ang-kdv-entwurf', 'ang-kdv-gestellt']);
    expect(p.d.gesellschaften.map((g: { id: string }) => g.id)).not.toContain('kdc');
    expect(JSON.stringify(p.d)).not.toContain(PRIVAT);
    const v = await rufe(angebotR.GET, '/api/crm/angebot', 'voll');
    expect(v.d.nurEntwuerfe).toBeUndefined();
    expect(JSON.stringify(v.d)).toContain(PRIVAT);
    expect((await rufe(angebotR.GET, '/api/crm/angebot', 'fremd')).status).toBe(403);
  });

  it('POST: Entwurf speichern ja (mit Absender-Vorgaben), stellen/annehmen/ablehnen/version/gesendet 403 — nichts geändert', async () => {
    const post = (body: Record<string, unknown>, wer = 'partner') => rufe(angebotR.POST, '/api/crm/angebot', wer, { method: 'POST', body: JSON.stringify(body) });
    const neu = await post({ aktion: 'speichern', felder: { gesellschaft: 'kdv', titel: 'Vom Partner', kontaktId: 'c-anna1', positionen: [] } });
    expect(neu.status).toBe(200);
    expect(neu.d.angebot).toMatchObject({ status: 'entwurf', gesellschaft: 'kdv', angelegtVon: 'partner' });
    const neuId = neu.d.angebot.id as string;
    expect((await post({ aktion: 'speichern', felder: { gesellschaft: 'kdc', titel: 'Privat' } })).status).toBe(403);
    expect((await post({ aktion: 'speichern', id: 'ang-kdc-entwurf', felder: { titel: 'X' } })).status).toBe(403);
    for (const aktion of ['stellen', 'annehmen', 'ablehnen', 'version', 'gesendet']) {
      const r = await post({ aktion, id: aktion === 'stellen' ? neuId : 'ang-kdv-gestellt', stand: 'x', grund: 'Preis' });
      expect(r.status, aktion).toBe(403);
      expect(r.d.fehler, aktion).toMatch(/Inhaber oder volle Mitglieder/);
    }
    // Archiv/Papierkorb: eigener Entwurf ja, gestelltes Angebot nein.
    expect((await post({ aktion: 'ablage', id: 'ang-kdv-gestellt', art: 'archiv' })).status).toBe(403);
    expect((await post({ aktion: 'ablage', id: neuId, art: 'papierkorb' })).status).toBe(200);
    const crm = await (await import('@/lib/crm/speicher')).ladeCrmMitPapierkorb();
    expect(crm.angebote.find(a => a.id === 'ang-kdv-gestellt')).toMatchObject({ status: 'gestellt' });
    expect(crm.angebote.find(a => a.id === 'ang-kdv-gestellt')?.archiviertAm).toBeUndefined();
    expect(crm.angebote.filter(a => a.vorgaengerId === 'ang-kdv-gestellt')).toEqual([]);
    // Gegenprobe: ein volles Mitglied wird nicht von der Rollen-Sperre aufgehalten.
    const voll = await post({ aktion: 'version', id: 'ang-kdv-gestellt' }, 'voll');
    expect(voll.status).toBe(200);
  });
});

describe('/api/crm/dateien — lesen an Business-Bezügen, hochladen ja, ändern/löschen nein', () => {
  it('GET Liste: Partner nur Kontakt/Business-Angebot/Business-Mandat — nie Privat, Firmen-Akte, Rechnung; volles Mitglied alles', async () => {
    const p = await rufe(dateienR.GET, '/api/crm/dateien', 'partner');
    expect(p.status).toBe(200);
    const ihre = p.d.eintraege.map((e: { id: string }) => e.id).sort();
    expect(ihre).toEqual([ids.kontakt, ids.angebotBusiness, ids.mandatBusiness].sort());
    expect(JSON.stringify(p.d)).not.toContain(PRIVAT);
    expect(JSON.stringify(p.d)).not.toContain(AKTE);
    const v = await rufe(dateienR.GET, '/api/crm/dateien', 'voll');
    expect(v.d.eintraege.length).toBe(8);
    expect((await rufe(dateienR.GET, '/api/crm/dateien', 'fremd')).status).toBe(403);
  });

  it('GET ?id=: Business-Unterlage und das Logo eines Business-Absenders 200, alles andere 404', async () => {
    const lade = async (id: string, wer = 'partner') => (await dateienR.GET(new Request(`http://test/api/crm/dateien?id=${id}`, { headers: sitzung(wer) }))).status;
    expect(await lade(ids.angebotBusiness)).toBe(200);
    expect(await lade(ids.logo)).toBe(200);
    for (const id of [ids.angebotPrivat, ids.mandatPrivat, ids.akte, ids.rechnung]) expect(await lade(id)).toBe(404);
    expect(await lade(ids.akte, 'voll')).toBe(200);
  });

  it('POST nur an Business-Bezügen; PATCH und DELETE 403', async () => {
    const hoch = (meta: Record<string, unknown>) => rufe(dateienR.POST, '/api/crm/dateien', 'partner', { method: 'POST', body: JSON.stringify({ meta }) });
    expect((await hoch({ art: 'angebot', titel: 'Notiz-Angebot', kontaktId: 'c-anna1' })).status).toBe(200);
    expect((await hoch({ art: 'angebot', titel: 'X', mandatId: 'm-kdc' })).status).toBe(403);
    expect((await hoch({ art: 'angebot', titel: 'X', rechnungId: 'r-1', kontaktId: 'c-anna1' })).status).toBe(403);
    expect((await rufe(dateienR.PATCH, '/api/crm/dateien', 'partner', { method: 'PATCH', body: JSON.stringify({ id: ids.kontakt, felder: { titel: 'neu' } }) })).status).toBe(403);
    expect((await rufe(dateienR.DELETE, `/api/crm/dateien?id=${ids.kontakt}`, 'partner', { method: 'DELETE' })).status).toBe(403);
    const ablage = await import('@/lib/dateien/ablage');
    expect((await ablage.ablageListe(HAUS)).find(e => e.id === ids.kontakt)?.titel).toBe('Rahmenvertrag Kunde');
  });
});

describe('Gesellschaften — nur die Auswahl lesen', () => {
  it('/api/crm/gesellschaften: Partner nur Kennung/Name/Kürzel/Logo der Business-Gesellschaften; PATCH/POST/DELETE 403', async () => {
    const p = await rufe(crmGesR.GET, '/api/crm/gesellschaften', 'partner');
    expect(p.status).toBe(200);
    expect(p.d.nurLesen).toBe(true);
    expect(p.d.gesellschaften.map((g: { id: string }) => g.id)).not.toContain('kdc');
    const kdv = p.d.gesellschaften.find((g: { id: string }) => g.id === 'kdv');
    expect(Object.keys(kdv).sort()).toEqual(['id', 'kurz', 'logoDateiId', 'name']);
    expect(JSON.stringify(p.d)).not.toContain(PRIVAT);
    expect((await rufe(crmGesR.PATCH, '/api/crm/gesellschaften', 'partner', { method: 'PATCH', body: JSON.stringify({ id: 'kdv', felder: { ort: 'X' }, stand: 'x' }) })).status).toBe(403);
    expect((await rufe(crmGesR.DELETE, '/api/crm/gesellschaften?id=kdv&logo=1&stand=x', 'partner', { method: 'DELETE' })).status).toBe(403);
    const v = await rufe(crmGesR.GET, '/api/crm/gesellschaften', 'voll');
    expect(v.d.gesellschaften.find((g: { id: string }) => g.id === 'kdv')).toHaveProperty('stand');
  });

  it('/api/gesellschaften: Partner nur ?wahl=1 (ohne Privat-Einheit), Steckbrief/Suche/Schreiben 403; fremder Haushalt auch die Auswahl 403', async () => {
    const w = await rufe(gesR.GET, '/api/gesellschaften?wahl=1', 'partner');
    expect(w.status).toBe(200);
    expect(w.d.gesellschaften.map((g: { id: string }) => g.id)).toContain('kdv');
    expect(w.d.gesellschaften.map((g: { id: string }) => g.id)).not.toContain('kdc');
    expect((await rufe(gesR.GET, '/api/gesellschaften', 'partner')).status).toBe(403);
    expect((await rufe(gesR.GET, '/api/gesellschaften?suche=register&q=Beispiel', 'partner')).status).toBe(403);
    expect((await rufe(gesR.POST, '/api/gesellschaften', 'partner', { method: 'POST', body: JSON.stringify({ felder: { name: 'Neu GmbH' } }) })).status).toBe(403);
    expect((await rufe(gesR.PATCH, '/api/gesellschaften', 'partner', { method: 'PATCH', body: JSON.stringify({ id: 'kdv', stand: 'x', felder: { sitz: 'X' } }) })).status).toBe(403);
    expect((await rufe(gesR.GET, '/api/gesellschaften?wahl=1', 'fremd')).status).toBe(403);
    expect((await rufe(gesR.GET, '/api/gesellschaften?wahl=1', 'voll')).d.gesellschaften.map((g: { id: string }) => g.id)).toContain('kdc');
  });
});

describe('/api/kalender/spiegel — Event lesen ja, schreiben nur in Business-Kalender', () => {
  it('POST event: Ziel „Gemeinsam“ (kein Business-Kalender) → 403 vor jedem Aufruf an iCloud; volles Mitglied geht weiter', async () => {
    vi.stubEnv('ICLOUD_APPLE_ID', 'inh@example.invalid');
    vi.stubEnv('ICLOUD_APP_PASSWORT', 'abcd-efgh-ijkl-mnop');
    const aufrufe: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (u: string | URL, i: RequestInit = {}) => { aufrufe.push(`${i.method ?? 'GET'} ${String(u)}`); return new Response('nicht da', { status: 404 }); }));
    try {
      const r = await rufe(spiegelR.POST, '/api/kalender/spiegel', 'partner', { method: 'POST', body: JSON.stringify({ art: 'event', id: 'ev-pr' }) });
      expect(r.status).toBe(403);
      expect(r.d.fehler).toMatch(/nur den Business-Bereich/);
      expect(aufrufe.filter(a => a.startsWith('PUT'))).toEqual([]);
      expect((await rufe(spiegelR.POST, '/api/kalender/spiegel', 'partner', { method: 'POST', body: JSON.stringify({ art: 'date', id: 'd-1' }) })).status).toBe(403);
      const v = await rufe(spiegelR.POST, '/api/kalender/spiegel', 'voll', { method: 'POST', body: JSON.stringify({ art: 'event', id: 'ev-pr' }) });
      // Gegenprobe: das volle Mitglied kommt am Rollen-Riegel vorbei bis zum Kalender-Weg (hier: der Kalender fehlt im nachgebauten iCloud).
      expect(String(v.d.fehler ?? '')).not.toMatch(/nur den Business-Bereich/);
      expect(String(v.d.fehler ?? '')).toMatch(/iCloud/);
      const g = await rufe(spiegelR.GET, '/api/kalender/spiegel?art=event&id=ev-pr', 'partner');
      expect(g.status).not.toBe(403);
    } finally { vi.unstubAllEnvs(); vi.unstubAllGlobals(); }
  }, 60_000);
});
