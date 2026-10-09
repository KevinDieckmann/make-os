// ─── ZOE / Gesundheits-Agent: Trainingsplan lesen und VORSCHLAGEN — nur mit Einwilligung (b), gespeichert erst nach Freigabe (09.10.) ──
// Erfundene Personen und Pläne, eigener Datenordner; kein Modellaufruf (die Werkzeuge rechnen ohne KI).
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { rmSync } from 'node:fs';

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs'); const os = await import('node:os'); const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-zoe-sport-'));
  process.env.MAKE_OS_DATEN_DIR = o;
  process.env.MAKE_VAULT_DIR = p.join(o, 'vault');
  process.env.MAKE_OS_DOKU_WURZEL = 'aus';
  process.env.MAKE_OS_KEY = 'pruef-schluessel-zoe-sport';
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  delete process.env.MAKE_OS_KI_ANBIETER_TOR;
  return o;
});
vi.mock('@/lib/meldungen/melden', () => ({ melde: async () => {} }));

import { localDay } from '@/lib/zeit';
import { tagPlus } from '@/lib/sport/pace';
import { leererStand, type SportStand } from '@/lib/sport/modell';
import { tagAus } from '@/lib/sport/plan-bau';

const HEUTE = localDay();
const STAND: SportStand = {
  ...leererStand(), einstieg: { fertig: true },
  ziele: [{ id: 'z-hm', art: 'lauf', titel: 'Halbmarathon Prüfstadt', datum: tagPlus(HEUTE, 8), distanzKm: 21.1, zielzeitSek: 7200, angelegt: 'x', referenz: { distanzKm: 10, sek: 3450 } }],
  tage: { [HEUTE]: tagAus([{ id: 'h-1', sparte: 'lauf', typ: 'intervall', dauerMin: 45, notiz: 'GEHEIME-NOTIZ-MARKE' }]) },
};
const VORSCHLAG = { name: 'Aufbauwoche', hinweis: 'Zwei Läufe, eine Kraft, eine Simulation.', tage: { di: [{ sparte: 'lauf', typ: 'intervall', dauerMin: 45 }], do: [{ sparte: 'gym', typ: 'kraft', dauerMin: 60 }], sa: [{ sparte: 'hyrox', typ: 'simulation', dauerMin: 75 }], so: [{ sparte: 'lauf', typ: 'longrun', dauerMin: 90 }] }, ruhe: ['mo'] };

let W: typeof import('@/lib/zoe/werkzeuge');
let A: typeof import('@/lib/zoe/ausfuehren');
let db: typeof import('@/lib/store/local-db');
let raum: typeof import('@/lib/zoe/raum');

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  raum = await import('@/lib/zoe/raum');
  const k = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied') => ({ id, speicher, email: `${speicher}@example.invalid`, name: speicher, rolle, hash: 'x', salz: 'y', angelegt: '2026-10-01', teilt: { gesundheit: [] }, haushalt: 'h-zs' });
  await db.saveJson('konten', { konten: [k('1', 'pia', 'inhaber'), k('2', 'olaf', 'mitglied')], einladungen: [] });
  const e = await import('@/lib/datenschutz/gesundheit-einwilligung');
  for (const p of ['pia', 'olaf']) await e.gesundheitErklaeren(p, 'verarbeiten', true, e.GESUNDHEIT_FASSUNG);
  await e.gesundheitErklaeren('pia', 'ki', true, e.GESUNDHEIT_FASSUNG); // nur Pia gibt ihre Gesundheit an die KI
  await db.saveJson(raum.speicherFuer('sport', 'pia'), STAND);
  await db.saveJson(raum.speicherFuer('sport', 'olaf'), STAND);
  await db.saveJson(raum.speicherFuer('vitals', 'pia'), { [HEUTE]: { rec: 35 } });
  W = await import('@/lib/zoe/werkzeuge');
  A = await import('@/lib/zoe/ausfuehren');
});
afterAll(() => rmSync(ordner, { recursive: true, force: true }));

describe('Register und Tor', () => {
  it('lesen frei, vorschlagen nur mit Freigabe; beide in der Gruppe „gesundheit“ (Einwilligung (a)+(b))', async () => {
    const { risikoVon, gruppeVon } = await import('@/lib/zoe/register');
    expect(risikoVon('trainingsplan_lesen')).toBe('frei');
    expect(risikoVon('trainingsplan_vorschlagen')).toBe('freigabe');
    expect(gruppeVon('trainingsplan_vorschlagen')).toBe('gesundheit');
    const { werkzeugSperreFuer } = await import('@/lib/datenschutz/ki-werkzeuge');
    expect(await werkzeugSperreFuer('gesundheit', 'olaf')).toMatch(/Einwilligung/);
    expect(await werkzeugSperreFuer('gesundheit', null)).toMatch(/Einwilligung/);
    expect(await werkzeugSperreFuer('gesundheit', 'pia')).toBeNull();
  });
});

describe('trainingsplan_lesen', () => {
  it('ohne Person und ohne Einwilligung (b): nichts', async () => {
    expect(await W.WERKZEUGE.trainingsplan_lesen.lauf({}, 'http://test', undefined)).toMatch(/^Nicht ausgeführt/);
    expect(await W.WERKZEUGE.trainingsplan_lesen.lauf({}, 'http://test', 'olaf')).toMatch(/Einwilligung/);
    const ueberTor = await A.fuehreAus('trainingsplan_lesen', {}, 'http://test', { person: 'olaf' });
    expect(ueberTor.ok).toBe(false);
  });
  it('mit (b): heute geplant mit dem Hinweis der Tagesform-Regel, Woche, Wettkampf mit Prognose — keine Notizen', async () => {
    const t = await W.WERKZEUGE.trainingsplan_lesen.lauf({}, 'http://test', 'pia');
    expect(t).toMatch(/Recovery 35 %/);
    expect(t).toMatch(/Heute geplant: Lauf · Intervall · 45 min — offen — Regel: Recovery rot/);
    expect(t).toMatch(/Halbmarathon Prüfstadt in 8 Tagen/);
    expect(t).toMatch(/Prognose 2:06:53/);
    expect(t).toMatch(/Taper noch nicht übernommen/);
    expect(t).not.toContain('GEHEIME-NOTIZ-MARKE');
  });
});

describe('trainingsplan_vorschlagen — ZOE speichert nie selbst', () => {
  it('ein Aufruf legt in den Stapel der Person, gespeichert ist nichts', async () => {
    const r = await A.fuehreAus('trainingsplan_vorschlagen', VORSCHLAG, 'http://test', { person: 'pia' });
    expect(r.gestapelt).toBe(true);
    const { hole } = await import('@/lib/zoe/stapel');
    const v = await hole(r.vorschlagId!);
    expect(v).toMatchObject({ person: 'pia', gruppe: 'gesundheit' });
    expect(v!.nachher).toMatch(/„Aufbauwoche“: Di Lauf · Intervall · 45 min/);
    const s = await db.loadJson<SportStand>(raum.speicherFuer('sport', 'pia'));
    expect(s!.planVorlagen).toBeUndefined();
  });
  it('ohne Freigabe direkt aufgerufen: nichts; ohne Person: nichts', async () => {
    expect(await W.WERKZEUGE.trainingsplan_vorschlagen.lauf(VORSCHLAG, 'http://test', 'pia')).toMatch(/^Nicht ausgeführt/);
    expect(await W.WERKZEUGE.trainingsplan_vorschlagen.lauf(VORSCHLAG, 'http://test', undefined)).toMatch(/^Nicht ausgeführt/);
    expect(await W.WERKZEUGE.trainingsplan_vorschlagen.lauf(VORSCHLAG, 'http://test', 'pia', { freigegebenVon: 'olaf' })).toMatch(/^Nicht ausgeführt/);
  });
  it('nach Freigabe der Person: EIGENE Vorlage (nicht aktiviert), gekennzeichnet; dieselbe Freigabe zweimal → eine', async () => {
    const r = await A.fuehreAus('trainingsplan_vorschlagen', VORSCHLAG, 'http://test', { person: 'pia', erzwingen: true, freigegebenVon: 'pia', vorschlagId: 'v-test-1' });
    expect(r.ok).toBe(true);
    await A.fuehreAus('trainingsplan_vorschlagen', VORSCHLAG, 'http://test', { person: 'pia', erzwingen: true, freigegebenVon: 'pia', vorschlagId: 'v-test-1' });
    const s = await db.loadJson<SportStand>(raum.speicherFuer('sport', 'pia'));
    expect(s!.planVorlagen).toHaveLength(1);
    expect(s!.planVorlagen![0]).toMatchObject({ id: 'zoe-v-test-1', name: 'Aufbauwoche', vonZoe: true });
    expect(s!.planVorlagen![0].woche.mo.art).toBe('ruhe');
    expect(s!.planVorlagen![0].woche.so.einheiten![0].typ).toBe('longrun');
    expect(s!.woche).toEqual(STAND.woche); // die Standardwoche bleibt — aktivieren tut die Person
  });
  it('Freigabe für eine Person ohne (b): das Tor sperrt auch beim Übernehmen', async () => {
    const r = await A.fuehreAus('trainingsplan_vorschlagen', VORSCHLAG, 'http://test', { person: 'olaf', erzwingen: true, freigegebenVon: 'olaf', vorschlagId: 'v-test-2' });
    expect(r.ok).toBe(false);
    const s = await db.loadJson<SportStand>(raum.speicherFuer('sport', 'olaf'));
    expect(s!.planVorlagen).toBeUndefined();
  });
  it('mehr als vier Einheiten an einem Tag → abgelehnt', async () => {
    const zuViel = { ...VORSCHLAG, tage: { mo: Array.from({ length: 5 }, () => ({ sparte: 'lauf', dauerMin: 10 })) } };
    expect(await W.WERKZEUGE.trainingsplan_vorschlagen.lauf(zuViel, 'http://test', 'pia', { freigegebenVon: 'pia', vorschlagId: 'v-x' })).toMatch(/Höchstens 4/);
  });
});
