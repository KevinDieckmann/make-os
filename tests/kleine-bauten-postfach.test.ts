// ─── Kleine Bauten · Punkt 12 (25.10.): Mails aus Fall und Prozess auch aus dem Postfach einer Arbeits-Einheit ──────────────────────────────────
// Mail-Entwurf der Werkstatt, Willkommensmail und Fall-Mails gingen nur aus Postfächern mit Business-Bereich. Jetzt auch aus dem Postfach einer Einheit
// unter Privat, deren Zeit als Arbeit zählt (Vorgabe: die Selbstständigkeit) — nur für Fälle und Prozesse DIESER Einheit. DIE Regel `postfachSendetFuer`
// (dieselbe wie beim Absender-Postfach des Angebots-Formulars). Trennung serverseitig: ein Konto „nur Business“ bekommt dieses Postfach nie.
// Business-Fälle: Ergebnis wie bisher. Eigener Datenordner, erfundene Konten @example.invalid, kein Netz.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { rmSync } from 'node:fs';

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-kleine-bauten-postfach-'));
  process.env.MAKE_OS_DATEN_DIR = o;
  process.env.MAKE_OS_KEY = 'pruef-schluessel-kleine-bauten-postfach';
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.MAKE_OS_GRABSTEINE_DIR;
  return o;
});

import { postfachSendetFuer, JEDE_ARBEITS_EINHEIT } from '@/lib/postfach/bereich';
import { formularPostfachBereichOk } from '@/lib/crm/formulare';
import { BUSINESS_GESELLSCHAFTEN, PRIVAT_GESELLSCHAFTEN, zaehltAlsArbeit, bereichVon } from '@/lib/einheiten';
import { POSTFACH_DES_LAUFS } from '@/lib/prozesse/baustein-katalog';

const H = 'haus-postfach';
const J = '2026-10-01T08:00:00.000Z';
const pf = (n: number) => `pf-00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const echtesFetch = globalThis.fetch;
afterAll(() => { globalThis.fetch = echtesFetch; rmSync(ordner, { recursive: true, force: true }); });

// Die Einheit unter Privat, deren Zeit als Arbeit zählt — aus der Zuordnung der Instanz, nie eine feste Kennung im Test.
const ARBEIT = PRIVAT_GESELLSCHAFTEN.find(g => zaehltAlsArbeit(g))!;
const BUSINESS = BUSINESS_GESELLSCHAFTEN[0];

beforeAll(async () => {
  globalThis.fetch = (async () => { throw new Error('Netz im Test gesperrt'); }) as typeof fetch;
  const d = await import('@/lib/store/local-db');
  const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) =>
    ({ id, speicher, email: `${speicher}@example.invalid`, name: `${speicher} Probe`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: H, ...extra });
  await d.saveJson('konten', { konten: [konto('k1', 'pia', 'inhaber'), konto('k2', 'nora', 'mitglied', { finanzRecht: 'business' })], einladungen: [] });
  const { leererBestand } = await import('@/lib/crm/speicher');
  const mandat = (id: string, gesellschaft: string) => ({
    id, kunde: 'Probe Kunde', kontaktIds: ['c-probe'], titel: `Mandat ${id}`, art: 'retainer', gesellschaft, status: 'aktiv', zustaendig: 'pia',
    vertragUnterschrieben: true, start: '2026-09-20', verlaengerung: 'manuell', honorar: { betrag: 1, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14,
    ziele: [], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: J,
  });
  await d.saveJson('crm', { ...leererBestand(), mandate: [mandat('m-business', BUSINESS), mandat('m-arbeit', ARBEIT)] });
  await d.saveJson('kontakte', { kontakte: [{ id: 'c-probe', vorname: 'Testa', nachname: 'Probe', anrede: 'Sie', email: 'testa@example.invalid', stufe: 'kontakt', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01' }] });
  const box = (n: number, bereich: string, adresse: string) => ({ id: pf(n), quelle: 'imap', bereich, anzeigename: `Probe ${n}`, adresse });
  await d.saveJson('postfaecher--pia', { v: 1, postfaecher: [box(1, BUSINESS, 'pia-b@example.invalid'), box(2, ARBEIT, 'pia-a@example.invalid'), box(3, 'privat', 'pia-p@example.invalid')] });
  await d.saveJson('postfaecher--nora', { v: 1, postfaecher: [box(4, ARBEIT, 'nora-a@example.invalid'), box(5, BUSINESS, 'nora-b@example.invalid')] });
});

describe('DIE Regel (rein)', () => {
  it('Business immer; Arbeits-Einheit unter Privat nur für ihre eigenen Fälle bzw. Auswahl ohne Fall; Privat und ohne Bereich nie', () => {
    expect(ARBEIT && bereichVon(ARBEIT)).toBe('privat');
    expect(postfachSendetFuer(BUSINESS, BUSINESS)).toBe(true);
    expect(postfachSendetFuer(BUSINESS, ARBEIT)).toBe(true);
    expect(postfachSendetFuer(BUSINESS)).toBe(true);
    expect(postfachSendetFuer('m-f-probe', BUSINESS)).toBe(true);
    expect(postfachSendetFuer(ARBEIT, ARBEIT)).toBe(true);
    expect(postfachSendetFuer(ARBEIT, BUSINESS)).toBe(false);
    expect(postfachSendetFuer(ARBEIT)).toBe(false);
    expect(postfachSendetFuer(ARBEIT, JEDE_ARBEITS_EINHEIT)).toBe(true);
    for (const b of ['privat', null, undefined, '']) expect(postfachSendetFuer(b as string | null, JEDE_ARBEITS_EINHEIT)).toBe(false);
    // Das Formular nutzt dieselbe Regel (Punkt 9).
    for (const b of [BUSINESS, ARBEIT, 'privat', null]) expect(formularPostfachBereichOk(b)).toBe(postfachSendetFuer(b, JEDE_ARBEITS_EINHEIT));
  });
});

describe('Werkstatt-Motor: Postfach des Laufs je Fall', () => {
  const lauf = (mandatId: string, person: string) => ({
    id: 'pl-00000000-0000-4000-8000-000000000020', prozessId: 'pz-00000000-0000-4000-8000-000000000020', version: 1, fall: { art: 'mandat' as const, id: mandatId }, bereich: 'fulfillment' as const,
    schluessel: 'x', durchgang: 1, modus: 'scharf' as const, status: 'laeuft' as const, person, ausloeser: { art: 'hand' as const }, tiefe: 0, daten: { 'bezug.mandatid': mandatId },
    start: J, geaendert: J, aktuell: null, schritte: [], kostenCent: 0,
  });
  const umfeld = async (mandatId: string, person: string) => {
    const S = await import('@/lib/prozesse/lauf-server');
    const { BEGLEIT_VORLAGEN } = await import('@/lib/prozesse/begleitung/vorlagen');
    const def = BEGLEIT_VORLAGEN.find(v => JSON.stringify(v.definition).includes('inbox.mail-entwurf'))!.definition;
    return S.umfeldFuer(lauf(mandatId, person) as never, def, await S.kontextLaden(new Date(), H));
  };
  it('Business-Fall: wie bisher das Business-Postfach; das der Arbeits-Einheit und ein privates hält der Schritt (nie dafür gedacht)', async () => {
    const u = await umfeld('m-business', 'pia');
    expect(u.postfach!(POSTFACH_DES_LAUFS)).toBe(pf(1));
    expect(u.postfach!(pf(1))).toBe(pf(1));
    expect(u.postfach!(pf(2))).toBeNull();
    expect(u.postfach!(pf(3))).toBeNull();
  });
  it('Fall der Arbeits-Einheit: ihr eigenes Postfach zuerst; ein Business-Postfach darf weiter', async () => {
    const u = await umfeld('m-arbeit', 'pia');
    expect(u.postfach!(POSTFACH_DES_LAUFS)).toBe(pf(2));
    expect(u.postfach!(pf(2))).toBe(pf(2));
    expect(u.postfach!(pf(1))).toBe(pf(1));
    expect(u.postfach!(pf(3))).toBeNull();
  });
  it('Konto „nur Business“: das Postfach der Arbeits-Einheit nie — auch nicht im Fall dieser Einheit', async () => {
    const u = await umfeld('m-arbeit', 'nora');
    expect(u.postfach!(POSTFACH_DES_LAUFS)).toBe(pf(5));
    expect(u.postfach!(pf(4))).toBeNull();
  });
});

describe('Auswahl der Werkstatt und Postfächer zum Senden (Willkommensmail, Fall-Mails) — serverseitig', () => {
  type Hd = (r: Request) => Promise<Response>;
  const get = async (person: string, suche: string) => {
    const m = await import('@/app/api/inbox/postfaecher/route') as unknown as { GET: Hd };
    const r = await m.GET(new Request(`http://test/api/inbox/postfaecher${suche}`, { headers: { 'x-make-user': person } }));
    return { status: r.status, j: await r.json() as { postfaecher?: { id: string }[]; fehler?: string } };
  };
  const ids = (j: { postfaecher?: { id: string }[] }) => (j.postfaecher ?? []).map(p => p.id).sort();
  it('Werkstatt: das Postfach der Arbeits-Einheit mit Hinweis „nur für Fälle von …“; ein Konto „nur Business“ sieht es nicht', async () => {
    const { auswahlListen } = await import('@/lib/prozesse/werkstatt-server');
    // Die Platzhalter („Postfach des Laufs“ …) stehen immer dabei — hier zählen die echten Postfächer.
    const echte = (l: { id: string }[] | undefined) => (l ?? []).filter(p => p.id.startsWith('pf-'));
    const pia = echte((await auswahlListen(H, 'pia')).postfach) as { id: string; hinweis?: string }[];
    expect(pia.map(p => p.id)).toEqual([pf(1), pf(2)]);
    expect(pia.find(p => p.id === pf(2))?.hinweis).toMatch(/^nur für Fälle von /);
    expect(pia.find(p => p.id === pf(1))?.hinweis).toBeUndefined();
    expect(echte((await auswahlListen(H, 'nora')).postfach).map(p => p.id)).toEqual([pf(5)]);
  });
  it('GET /api/inbox/postfaecher?space=business&einheit=…: das eigene Postfach der Einheit des Falls dazu; Business-Fall und „nur Business“ unverändert', async () => {
    const ohne = await get('pia', '?space=business');
    expect(ohne.status).toBe(200);
    expect(ids(ohne.j)).toEqual([pf(1)]);
    expect(ids((await get('pia', `?space=business&einheit=${ARBEIT}`)).j)).toEqual([pf(1), pf(2)]);
    expect(ids((await get('pia', `?space=business&einheit=${BUSINESS}`)).j)).toEqual([pf(1)]);
    expect(ids((await get('nora', `?space=business&einheit=${ARBEIT}`)).j)).toEqual([pf(5)]);
    expect((await get('pia', '?space=business&einheit=unsinn')).status).toBe(400);
  });
});
