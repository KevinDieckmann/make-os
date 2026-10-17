// ─── Datenschutz-Prüfung 11.10. (M1, N4): Kapazität — Sicht Business ohne Kopf & Energie, Sicht Privat ohne Mandats-Namen ──────────────
// Wächter „Sicht Business bekommt nichts aus Gesundheit“: weder `kennzahlen.erholung`, noch `team.kopf.faktor` ≠ 1, noch `belastbar` ≠ `netto`
// (= netto × Kopf-Faktor, eine Art.-9-Ableitung) — für `?space=business` UND für ein Konto „nur Business“. Sicht Privat: Zuweisungen ohne Namen.
// Eigener Datenordner, erfundene Personen (@example.invalid), erfundene Werte.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-kapa-sicht-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-kapa-sicht';
process.env.MAKE_OS_OHNE_APPLE = '1';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

type Mod = { GET: (r: Request) => Promise<Response> };
let route: Mod;
const get = (person: string, q = '') => new Request(`http://test/api/kapazitaet${q}`, { headers: { 'x-make-user': person } });
const tag = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' }); };
type Stand = {
  personen: { id: string; erholung?: unknown; erholungAm?: unknown; wochen: { netto: number; belastbar: number }[] }[];
  team: { kopf: { faktor: number; personen: number }; wochen: { netto: number; belastbar: number }[] };
  kennzahlen: { erholung: number | null; erholungPersonen: number };
  zuweisungen: { bezugId: string; label: string }[];
};

beforeAll(async () => {
  const db = await import('@/lib/store/local-db');
  route = (await import('@/app/api/kapazitaet/route')) as unknown as Mod;
  await db.saveJson('konten', { konten: [
    { id: '1', speicher: 'pa', email: 'pa@example.invalid', name: 'Anna Prüf', rolle: 'inhaber', hash: 'x', salz: 'x', angelegt: '2026-09-01', teilt: { gesundheit: ['pb', 'pd'] }, haushalt: 'h-pruef' },
    { id: '2', speicher: 'pb', email: 'pb@example.invalid', name: 'Bert Prüf', rolle: 'mitglied', hash: 'x', salz: 'x', angelegt: '2026-09-01', teilt: { gesundheit: [] }, haushalt: 'h-pruef' },
    { id: '4', speicher: 'pd', email: 'pd@example.invalid', name: 'Dora Prüf', rolle: 'mitglied', hash: 'x', salz: 'x', angelegt: '2026-09-01', teilt: { gesundheit: [] }, haushalt: 'h-pruef', finanzRecht: 'business' },
  ], einladungen: [] });
  // pa teilt ihre Gesundheit mit allen Konten und hat eingewilligt → ihre Erholung (rot) wirkt im Team-Faktor (0,75).
  await db.saveJson('vitals--pa', Object.fromEntries([0, 1, 2, 3].map(i => [tag(-i), { rec: 21 }])));
  await db.saveJson('kapazitaet--h-pruef', {
    personen: { 'konto-pa': { erholungAm: '2026-10-01T10:00:00.000Z', stundenWoche: 40 }, 'konto-pb': { stundenWoche: 40 } },
    zuweisungen: [{ id: 'kz-1', person: 'konto-pa', art: 'mandat', bezugId: 'm-geheim', stundenWoche: 5 }],
  });
  await db.saveJson('crm', { mandate: [{ id: 'm-geheim', kunde: 'GEHEIMKUNDE Prüf GmbH', status: 'aktiv', start: '2026-01-01' }] });
  await db.saveJson('meilensteine', { meilensteine: [] });
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

const ohneKopf = (s: Stand) => {
  expect(s.kennzahlen.erholung).toBeNull();
  expect(s.kennzahlen.erholungPersonen).toBe(0);
  expect(s.team.kopf).toMatchObject({ faktor: 1, personen: 0 });
  for (const w of s.team.wochen) expect(w.belastbar).toBe(w.netto);
  for (const p of s.personen) {
    expect(p).not.toHaveProperty('erholung');
    expect(p).not.toHaveProperty('erholungAm');
    for (const w of p.wochen) expect(w.belastbar).toBe(w.netto);
  }
};

describe('M1: Sicht Business ohne Kopf & Energie', () => {
  it('Kontrolle: in Privat wirkt der Team-Faktor (sonst prüfte der Wächter nichts)', async () => {
    const s = (await (await route.GET(get('pa', '?space=privat'))).json()).stand as Stand;
    expect(s.team.kopf).toMatchObject({ faktor: 0.75, personen: 1 });
    expect(s.team.wochen.some(w => w.belastbar < w.netto)).toBe(true);
  });
  it('?space=business: keine Erholung, Kopf neutral, belastbar = netto — auch für die Person, die teilt', async () => {
    for (const wer of ['pa', 'pb']) ohneKopf((await (await route.GET(get(wer, '?space=business'))).json()).stand as Stand);
  });
  it('Konto „nur Business“ (ohne Space): dasselbe', async () => {
    ohneKopf((await (await route.GET(get('pd'))).json()).stand as Stand);
  });
  it('Oberfläche: „Kopf & Energie“ nur in Privat', () => {
    const q = readFileSync(path.join(process.cwd(), 'components/os/kapazitaet/KapazitaetAnsicht.tsx'), 'utf8');
    expect(q).toContain("{privat && <Zahl erklaerung={kennzahlTextVon('kapazitaet.kopf')}");
    expect(q).toContain("privat={space === 'privat'} />");
  });
});

describe('N4: Sicht Privat ohne Mandats-/Firmennamen an Zuweisungen', () => {
  it('?space=privat: „Business (belegt)“, keine Kennung; ohne Sicht wie bisher', async () => {
    const txt = await (await route.GET(get('pa', '?space=privat'))).text();
    expect(txt).not.toContain('GEHEIMKUNDE');
    const s = JSON.parse(txt).stand as Stand;
    expect(s.zuweisungen).toEqual([expect.objectContaining({ bezugId: '', label: 'Business (belegt)' })]);
    const biz = (await (await route.GET(get('pa', '?space=business'))).json()).stand as Stand;
    expect(biz.zuweisungen[0].bezugId).toBe('m-geheim');
    expect(biz.zuweisungen[0].label).toContain('GEHEIMKUNDE'); // Kontrolle: im Business steht der Name
  });
});

// Gesamtprüfung 18.10. (L3 B2 / L2 Zählungen B7): die Markttraktion-Planung („frei“ je Team-Person) ist Business — sie rechnete mit `belastbar`
// (Kopf & Energie aus der geteilten Erholung). Jetzt: netto − Bedarf aus der Sicht Business, dieselbe Zahl wie die Leistungstreppe.
describe('Markttraktion-Planung: „frei“ ohne Kopf & Energie', () => {
  it('frei = Ø (netto − bedarf) der nächsten vier Wochen — nicht belastbar (die geteilte rote Erholung wirkt nicht)', async () => {
    const { ladeKonten } = await import('@/lib/zugang/konten');
    await ladeKonten(); // setzt das CRM-Team aus den Konten (lib/crm/team-liste.ts)
    const { freieStunden } = await import('@/lib/crm/planung-server');
    const heute = tag(0);
    const frei = await freieStunden('pa', heute);
    const s = (await (await route.GET(get('pa', '?space=privat'))).json()).stand as { personen: { id: string; wochen: { netto: number; belastbar: number; bedarf: number }[] }[] };
    const w = s.personen.find(p => p.id === 'konto-pa')!.wochen.slice(0, 4);
    const schnitt = (f: (x: { netto: number; belastbar: number; bedarf: number }) => number) => Math.round((w.reduce((a, x) => a + f(x), 0) / w.length) * 10) / 10;
    // Kontrolle: in Privat wirkt der Faktor (sonst prüfte der Wächter nichts).
    expect(schnitt(x => x.belastbar - x.bedarf)).toBeLessThan(schnitt(x => x.netto - x.bedarf));
    expect(frei?.pa).toBe(schnitt(x => x.netto - x.bedarf));
    const q = readFileSync(path.join(process.cwd(), 'lib/crm/planung-server.ts'), 'utf8');
    expect(q).toContain("kapaStandFuer(person, heute, 'business')");
    expect(q).not.toContain('x.belastbar - x.bedarf');
  });
});

describe('Business-Index, Säule Kapazität: ohne Kopf & Energie', () => {
  it('Last/Puffer der Säule rechnen mit netto — dieselben Zahlen wie die Sicht Business, nicht wie Privat', async () => {
    const { kapaKennzahlenFuerIndex } = await import('@/lib/kapazitaet/server');
    const k = await kapaKennzahlenFuerIndex(tag(0));
    const biz = (await (await route.GET(get('pa', '?space=business'))).json()).stand as { kennzahlen: { belastbar4: number; last4: number | null } };
    const priv = (await (await route.GET(get('pa', '?space=privat'))).json()).stand as { kennzahlen: { belastbar4: number } };
    expect(priv.kennzahlen.belastbar4).toBeLessThan(biz.kennzahlen.belastbar4); // Kontrolle: in Privat wirkt der Faktor
    expect(k?.belastbar4).toBe(biz.kennzahlen.belastbar4);
    expect(k?.erholung).toBeNull();
  });
});

// Gesamtprüfung 18.10. (L4 B5/B6): mit einem Konto „nur Business“ lässt sich Gesundheit nicht mehr teilen — „teilt mit allen“ heißt deshalb: mit allen
// VOLLEN Mitgliedern des Haushalts (sonst zählte die Erholung in keinem Haushalt mit einem Business-Partner).
describe('Erholung im Team-Faktor: „teilt mit allen vollen Mitgliedern“', () => {
  it('pa teilt nur mit pb (nicht mit dem Konto „nur Business“) — der Faktor wirkt in Privat trotzdem', async () => {
    const db = await import('@/lib/store/local-db');
    const vorher = await db.loadJson<{ konten: { speicher: string; teilt: { gesundheit: string[] } }[] }>('konten');
    await db.saveJson('konten', { ...vorher!, konten: vorher!.konten.map(k => (k.speicher === 'pa' ? { ...k, teilt: { gesundheit: ['pb'] } } : k)) });
    try {
      const s = (await (await route.GET(get('pa', '?space=privat'))).json()).stand as Stand;
      expect(s.team.kopf).toMatchObject({ faktor: 0.75, personen: 1 });
    } finally { await db.saveJson('konten', vorher); }
  });
});
