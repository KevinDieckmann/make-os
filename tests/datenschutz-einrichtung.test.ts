// ─── Datenschutz-Einrichtung (05.10., Paket „DSGVO-Grundlagen im Code“) ─────
// Verantwortlicher aus EINER Quelle (Einrichtung → Umgebung → „fehlt“), nur der Inhaber ändert, kein Name im Code.
// Eigener Datenordner, erfundene Personen (@example.invalid) — nie der echte Bestand.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-dsgvo-einr-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-dsgvo-einr';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
for (const k of Object.keys(process.env)) if (k.startsWith('MAKE_OS_VERANTWORTLICHER_') || k.startsWith('MAKE_OS_DSB_')) delete process.env[k];

import {
  verantwortlicherPruefen, verantwortlicherWirksam, verantwortlicherLuecken, verantwortlichAufloesen, verantwortlicherAuskunft, verantwortlicherText,
  VERANTWORTLICHER_FEHLT, VERANTWORTLICH_EINRICHTUNG,
} from '@/lib/datenschutz/einrichtung';
import { verantwortlichHeben, verantwortlichAlt, verzeichnisVervollstaendigen, verarbeitungenStart } from '@/lib/crm/datenschutz';
import { UG_NAME } from '@/lib/einheiten';
import type { Verarbeitung } from '@/lib/crm/typen';

const BEISPIEL = { name: 'Beispiel GmbH', anschrift: 'Musterweg 1\n12345 Musterstadt', mail: 'datenschutz@example.invalid' };

describe('Verantwortlicher — Regeln (rein)', () => {
  it('Pflicht: Name, Anschrift, Kontakt-Mail; Mail muss wie eine Adresse aussehen', () => {
    expect(verantwortlicherPruefen({}).ok).toBe(false);
    expect(verantwortlicherLuecken({ name: 'X' })).toEqual(['Anschrift', 'Kontakt-Mail']);
    expect(verantwortlicherPruefen({ ...BEISPIEL, mail: 'keine-mail' }).ok).toBe(false);
    expect(verantwortlicherPruefen({ ...BEISPIEL, dsb: { mail: 'kaputt' } }).ok).toBe(false);
    const r = verantwortlicherPruefen({ ...BEISPIEL, name: '  Beispiel   GmbH ', telefon: '', dsb: { name: '', mail: '' } });
    expect(r.ok && r.v).toEqual(BEISPIEL); // gesäubert, leere optionale Felder fallen weg
  });
  it('wirksam: Einrichtung vor Umgebung; ohne beides „fehlt“ — nie ein Name aus dem Code', () => {
    expect(verantwortlicherWirksam({}, {}).v).toBeNull();
    expect(verantwortlicherText(null)).toBe(VERANTWORTLICHER_FEHLT);
    expect(verantwortlicherAuskunft(null)).toEqual({ fehlt: true, hinweis: VERANTWORTLICHER_FEHLT });
    const env = { MAKE_OS_VERANTWORTLICHER_NAME: 'Umgebung AG', MAKE_OS_VERANTWORTLICHER_ANSCHRIFT: 'Weg 2\\n10000 Ort', MAKE_OS_VERANTWORTLICHER_MAIL: 'u@example.invalid' };
    const u = verantwortlicherWirksam({}, env);
    expect(u.quelle).toBe('umgebung');
    expect(u.v?.anschrift).toBe('Weg 2\n10000 Ort');
    const e = verantwortlicherWirksam({ verantwortlicher: BEISPIEL }, env);
    expect(e.quelle).toBe('einrichtung');
    expect(verantwortlicherText(e.v)).toBe('Beispiel GmbH, Musterweg 1, 12345 Musterstadt, datenschutz@example.invalid');
    // Unvollständig eingetragen → Umgebung, sonst „fehlt“ mit Lücken
    expect(verantwortlicherWirksam({ verantwortlicher: { ...BEISPIEL, mail: '' } }, {}).luecken).toEqual(['Kontakt-Mail']);
  });
  it('Verzeichnis: Platzhalter wird aufgelöst, von Hand Eingetragenes bleibt', () => {
    expect(verantwortlichAufloesen(VERANTWORTLICH_EINRICHTUNG, null)).toBe(VERANTWORTLICHER_FEHLT);
    expect(verantwortlichAufloesen(VERANTWORTLICH_EINRICHTUNG, BEISPIEL)).toContain('Beispiel GmbH');
    expect(verantwortlichAufloesen('Andere Stelle KG', BEISPIEL)).toBe('Andere Stelle KG');
  });
});

describe('Verzeichnis: alte feste Verantwortliche werden gehoben, Geändertes bleibt', () => {
  // Die alten festen Texte nur zur Laufzeit zusammengesetzt — so steht kein Name im Code.
  const alt1 = ['Kevin', 'Dieckmann'].join(' ');
  const alt2 = `${alt1} (KD Ventures / ${alt1} Consulting)`;
  it('Startbestand trägt den Platzhalter; alte Fassungen (fest/UG_NAME) → Platzhalter; Hand-Eintrag bleibt', () => {
    expect(verarbeitungenStart('2026-10-05T10:00:00.000Z').every(v => v.verantwortlich === VERANTWORTLICH_EINRICHTUNG)).toBe(true);
    expect(verantwortlichAlt(alt1)).toBe(true);
    expect(verantwortlichAlt(alt2)).toBe(true);
    expect(verantwortlichAlt(UG_NAME)).toBe(true);
    expect(verantwortlichAlt('Eigene Angabe GmbH')).toBe(false);
    const basis = verarbeitungenStart('2026-10-05T10:00:00.000Z');
    const liste: Verarbeitung[] = [{ ...basis[0], verantwortlich: alt2 }, { ...basis[1], verantwortlich: UG_NAME }, { ...basis[2], verantwortlich: 'Eigene Angabe GmbH' }];
    const h = verantwortlichHeben(liste);
    expect(h.map(v => v.verantwortlich)).toEqual([VERANTWORTLICH_EINRICHTUNG, VERANTWORTLICH_EINRICHTUNG, 'Eigene Angabe GmbH']);
    expect(verantwortlichHeben(h)).toEqual(h);
  });
  it('vervollständigen ist idempotent', () => {
    const a = verzeichnisVervollstaendigen([], '2026-10-05T10:00:00.000Z');
    expect(a.geaendert).toBe(true);
    const b = verzeichnisVervollstaendigen(a.liste, '2026-10-06T10:00:00.000Z');
    expect(b.geaendert).toBe(false);
    expect(b.liste).toEqual(a.liste);
  });
});

describe('Kein fester Verantwortlicher im Code (Plattform-Regel, repo-sauber)', () => {
  it('Datenschutz-Code nennt keinen Personennamen als Verantwortlichen', () => {
    const name = ['Dieck', 'mann'].join('');
    for (const f of ['lib/crm/datenschutz.ts', 'app/api/crm/datenschutz/route.ts', 'lib/datenschutz/einrichtung.ts', 'app/api/datenschutz/einrichtung/route.ts', 'components/os/crm/Stammdaten.tsx']) {
      expect(readFileSync(f, 'utf8').includes(name), f).toBe(false);
    }
  });
});

type Mod = { GET: (r: Request) => Promise<Response>; POST: (r: Request) => Promise<Response> };
let route: Mod; let db: typeof import('@/lib/store/local-db');
const get = (person?: string, q = '') => new Request(`http://test/api/datenschutz/einrichtung${q}`, { headers: person ? { 'x-make-user': person } : {} });
const post = (person: string | null, body: unknown, kopf: Record<string, string> = {}) => new Request('http://test/api/datenschutz/einrichtung', {
  method: 'POST', headers: { 'content-type': 'application/json', ...(person ? { 'x-make-user': person } : {}), ...kopf }, body: JSON.stringify(body),
});

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  route = (await import('@/app/api/datenschutz/einrichtung/route')) as unknown as Mod;
  await db.saveJson('konten', { konten: [
    { id: '1', speicher: 'pa', email: 'pa@example.invalid', name: 'Anna Prüf', rolle: 'inhaber', hash: 'x', salz: 'x', angelegt: '2026-09-01', teilt: { gesundheit: [] }, haushalt: 'h-pruef' },
    { id: '2', speicher: 'pb', email: 'pb@example.invalid', name: 'Bert Prüf', rolle: 'mitglied', hash: 'x', salz: 'x', angelegt: '2026-09-01', teilt: { gesundheit: [] }, haushalt: 'h-pruef' },
    { id: '3', speicher: 'px', email: 'px@example.invalid', name: 'Testkunde', rolle: 'mitglied', hash: 'x', salz: 'x', angelegt: '2026-09-01', teilt: { gesundheit: [] }, haushalt: 'h-fremd' },
  ], einladungen: [] });
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Route — nur Haushalt sieht, nur Inhaber ändert, nie über den Dienstweg', () => {
  it('ohne Person und Testkunde: 403', async () => {
    expect((await route.GET(get())).status).toBe(403);
    expect((await route.GET(get('px'))).status).toBe(403);
    expect((await route.POST(post('px', { aktion: 'verantwortlicher', verantwortlicher: BEISPIEL }))).status).toBe(403);
  });
  it('Mitglied liest (darf = false), ändert nicht', async () => {
    const j = await (await route.GET(get('pb'))).json();
    expect(j.ok).toBe(true);
    expect(j.darf).toBe(false);
    expect(j.wirksam.v).toBeNull();
    expect((await route.POST(post('pb', { aktion: 'verantwortlicher', verantwortlicher: BEISPIEL }))).status).toBe(403);
  });
  it('Dienstweg (ZOE/Skript) ändert nie', async () => {
    const r = await route.POST(post('pa', { aktion: 'verantwortlicher', verantwortlicher: BEISPIEL }, { 'x-make-key': 'pruef-schluessel-dsgvo-einr', 'x-make-person': 'pa' }));
    expect(r.status).toBe(403);
  });
  it('Inhaber trägt ein; Angaben für die Danke-Mail kommen daraus; Leeren → wieder „fehlt“', async () => {
    expect((await route.POST(post('pa', { aktion: 'verantwortlicher', verantwortlicher: { ...BEISPIEL, mail: 'x' } }))).status).toBe(400);
    const r = await (await route.POST(post('pa', { aktion: 'verantwortlicher', verantwortlicher: { ...BEISPIEL, dsb: { mail: 'dsb@example.invalid' } } }))).json();
    expect(r.ok).toBe(true);
    expect(r.wirksam.quelle).toBe('einrichtung');
    const a = await (await route.GET(get('pb', '?nur=angaben'))).json();
    expect(a).toMatchObject({ ok: true, verantwortlich: 'Beispiel GmbH', mail: 'dsb@example.invalid' });
    const l = await (await route.POST(post('pa', { aktion: 'verantwortlicher-leeren' }))).json();
    expect(l.wirksam.v).toBeNull();
  });
});
