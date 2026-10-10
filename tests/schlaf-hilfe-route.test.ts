// ─── Wächter: Schlaf-Hilfe, Tages-Check, Essen & Trinken — Routen, Trennung, Einwilligung, Erinnerung (09.10.) ─────────
// Sicht B bekommt nichts aus A — auch wenn A die Gesundheit mit B teilt, auch mit ?fuer=, nie über den Dienstweg. Ohne Einwilligung (a)
// rechnet und speichert nichts (Ausschalten geht). Antworten des Checks nur ins EIGENE Journal, Abhaken nur ins EIGENE Log. Die Abend-
// Erinnerung kommt einmal je Tag in die eigene Glocke, neutral. Der Wochenvorschlag nimmt Belastungstage nur mit Einwilligung (b), ohne Namen.
// Eigener Datenordner, erfundene Personen und Werte — nie der echte Bestand.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-schlaf-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-schlaf';
process.env.MAKE_OS_KI_VORGABE = 'sparsam';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.MAKE_OS_ALTBESTAND_PERSON;

const MARKE = 'r-schlaf-waechter-marke-anna';
type Handler = (r: Request) => Promise<Response>;
let alltag: { GET: Handler; PATCH: Handler };
let journal: { GET: Handler; PATCH: Handler };
let health: { GET: Handler; PATCH: Handler };
let db: typeof import('@/lib/store/local-db');
let ein: typeof import('@/lib/datenschutz/gesundheit-einwilligung');
let heute: string;
let tagePlus: (t: string, n: number) => string;

const sitzung = (p: string) => ({ 'content-type': 'application/json', 'x-make-user': p });
const dienst = (p?: string) => ({ 'content-type': 'application/json', 'x-make-key': 'pruef-schluessel-schlaf', ...(p ? { 'x-make-person': p } : {}) });
const rufe = async (h: Handler, methode: string, pfad: string, kopf: Record<string, string>, body?: unknown) => {
  const r = await h(new Request(`http://test${pfad}`, { method: methode, headers: kopf, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }));
  const text = await r.text();
  return { status: r.status, text, json: (text ? JSON.parse(text) : {}) as Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
};
const datei = (name: string) => path.join(ordner, `${name}.json`);
const roh = (name: string) => (existsSync(datei(name)) ? readFileSync(datei(name), 'utf8') : null);

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  ein = await import('@/lib/datenschutz/gesundheit-einwilligung');
  ({ tagePlus } = await import('@/lib/zeit'));
  heute = (await import('@/lib/zeit')).localDay();
  alltag = (await import('@/app/api/gesundheit/alltag/route')) as unknown as typeof alltag;
  journal = (await import('@/app/api/state/journal/route')) as unknown as typeof journal;
  health = (await import('@/app/api/state/health/route')) as unknown as typeof health;
  await db.saveJson('konten', { konten: [
    { id: '1', speicher: 'anna', email: 'anna@example.invalid', name: 'Anna Prüf', rolle: 'inhaber', hash: 'x', salz: 'x', angelegt: '2026-10-10T08:00:00.000Z', teilt: { gesundheit: ['ben'] }, haushalt: 'h-schlaf' },
    { id: '2', speicher: 'ben', email: 'ben@example.invalid', name: 'Ben Prüf', rolle: 'mitglied', hash: 'x', salz: 'x', angelegt: '2026-10-10T08:00:00.000Z', teilt: { gesundheit: ['anna'] }, haushalt: 'h-schlaf' },
    { id: '3', speicher: 'cara', email: 'cara@example.invalid', name: 'Cara Prüf', rolle: 'mitglied', hash: 'x', salz: 'x', angelegt: '2026-10-10T08:00:00.000Z', teilt: { gesundheit: [] }, haushalt: 'h-schlaf' },
  ], einladungen: [] });
  for (const p of ['anna', 'ben']) expect((await ein.gesundheitErklaeren(p, 'verarbeiten', true, ein.GESUNDHEIT_FASSUNG)).ok).toBe(true);
  // Annas Werte: 8 Nächte mit WHOOP-Bedarf, Energie und Strain; Bens Plan hat einen harten Dienstag (er hat KEINE Einwilligung (b)).
  const vitals: Record<string, unknown> = {};
  for (let i = 0; i < 8; i++) vitals[tagePlus(heute, -i)] = { sleep: 6.5, schlafBedarf: 8, phaseWach: 0.5, kcal: 2600, strain: 11, quellen: { sleep: 'whoop' } };
  await db.saveJson('vitals--anna', vitals);
  await db.saveJson('sport--anna', { woche: { do: { art: 'hyrox', dauerMin: 60 } } });
  await db.saveJson('sport--ben', { woche: { di: { art: 'hyrox', dauerMin: 60 } } });
});
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten();
  rmSync(ordner, { recursive: true, force: true });
});

describe('Einstellen und rechnen — nur die eigene Person', () => {
  it('A: ohne Einstellung sagt der Tipp, was fehlt; mit Aufstehzeit kommt die Schlafenszeit (Stand/409)', async () => {
    const g = await rufe(alltag.GET, 'GET', '/api/gesundheit/alltag', sitzung('anna'));
    expect(g.status, g.text).toBe(200);
    expect(g.json.einwilligung).toBe(true);
    expect(g.json.stand).toBe('leer');
    expect(g.json.sicht.schlaf.tipp).toContain('Aufstehzeit');
    expect(g.json.sicht.check.fragen.length).toBe(5);
    const p = await rufe(alltag.PATCH, 'PATCH', '/api/gesundheit/alltag', sitzung('anna'), { stand: 'leer', ops: [
      { op: 'schlaf', felder: { aufstehen: '07:30', aufstehenZiel: '06:45', erinnerung: true, vorlaufMin: 30 } },
      { op: 'ergaenzung', routine: MARKE, vorlage: 'kreatin' },
    ] });
    expect(p.status, p.text).toBe(200);
    expect(p.json.einstellung.schlaf).toMatchObject({ aufstehen: '07:30', aufstehenZiel: '06:45', ab: heute, erinnerung: true });
    const g2 = await rufe(alltag.GET, 'GET', '/api/gesundheit/alltag', sitzung('anna'));
    const l = g2.json.sicht.schlaf;
    // Bedarf 8 h gesamt (ohne Spiegel → kein Ausgleich), Puffer 30 Min. aus „wach im Bett“: 07:30 − 8:00 − 0:30 = 23:00.
    expect(l.schlafenszeit).toBe('23:00');
    expect(l.erinnerungUm).toBe('22:30');
    expect(l.schuld).toEqual({ stunden: 10.5, naechte: 7 });
    const alt = await rufe(alltag.PATCH, 'PATCH', '/api/gesundheit/alltag', sitzung('anna'), { stand: 'leer', ops: [{ op: 'essen', orientierung: false }] });
    expect(alt.status).toBe(409);
    expect(alt.json.konflikt).toBe(true);
  });

  it('B bekommt nichts aus A — auch geteilt, auch mit ?fuer=/person=; B schreibt nur sein Eigenes', async () => {
    for (const q of ['', '?fuer=anna', '?fuer=anna&person=anna&wer=anna&von=anna']) {
      const r = await rufe(alltag.GET, 'GET', `/api/gesundheit/alltag${q}`, sitzung('ben'));
      expect(r.status, q).toBe(200);
      expect(r.text, q).not.toContain(MARKE);
      expect(r.text, q).not.toContain('07:30');
      expect(r.json.stand, q).toBe('leer');
    }
    const vorher = roh('gesundheit-alltag--anna');
    const p = await rufe(alltag.PATCH, 'PATCH', '/api/gesundheit/alltag?fuer=anna', sitzung('ben'), { stand: 'leer', ops: [{ op: 'schlaf', felder: { aufstehen: '06:00' } }] });
    expect(p.status, p.text).toBe(200);
    expect(roh('gesundheit-alltag--anna')).toBe(vorher);
    expect(roh('gesundheit-alltag--ben')).toContain('06:00');
  });

  it('Dienstweg → 403 (auch mit benannter Person), ohne Person → 401', async () => {
    for (const kopf of [dienst(), dienst('anna')]) {
      const g = await rufe(alltag.GET, 'GET', '/api/gesundheit/alltag', kopf);
      expect(g.status).toBe(403);
      expect(g.text).not.toContain(MARKE);
      expect((await rufe(alltag.PATCH, 'PATCH', '/api/gesundheit/alltag', kopf, { stand: 'leer', ops: [{ op: 'essen', orientierung: false }] })).status).toBe(403);
    }
    expect((await rufe(alltag.GET, 'GET', '/api/gesundheit/alltag', { 'content-type': 'application/json' })).status).toBe(401);
  });

  it('ohne Einwilligung (a): keine Rechnung, Einschalten 403 — Ausschalten geht', async () => {
    const g = await rufe(alltag.GET, 'GET', '/api/gesundheit/alltag', sitzung('cara'));
    expect(g.status).toBe(200);
    expect(g.json.einwilligung).toBe(false);
    expect(g.json.sicht).toBeNull();
    const an = await rufe(alltag.PATCH, 'PATCH', '/api/gesundheit/alltag', sitzung('cara'), { stand: 'leer', ops: [{ op: 'schlaf', felder: { aufstehen: '07:00' } }] });
    expect(an.status).toBe(403);
    expect(an.json.einwilligung).toBe('gesundheit');
    const aus = await rufe(alltag.PATCH, 'PATCH', '/api/gesundheit/alltag', sitzung('cara'), { stand: 'leer', ops: [{ op: 'schlaf', felder: { erinnerung: false } }] });
    expect(aus.status, aus.text).toBe(200);
  });

  it('ungültig → 400, zu viele Fragen → 413, nichts geschrieben', async () => {
    const vorher = roh('gesundheit-alltag--anna');
    const stand = (await rufe(alltag.GET, 'GET', '/api/gesundheit/alltag', sitzung('anna'))).json.stand;
    expect((await rufe(alltag.PATCH, 'PATCH', '/api/gesundheit/alltag', sitzung('anna'), { stand, ops: [{ op: 'schlaf', felder: { aufstehen: 'früh' } }] })).status).toBe(400);
    expect((await rufe(alltag.PATCH, 'PATCH', '/api/gesundheit/alltag', sitzung('anna'), { stand, ops: [{ op: 'check', fragen: ['koffein-spaet', 'alkohol', 'getrunken', 'bildschirm-spaet', 'spaet-gegessen', 'stress', 'draussen'] }] })).status).toBe(413);
    expect(roh('gesundheit-alltag--anna')).toBe(vorher);
  });
});

describe('Tages-Check im eigenen Journal, Abhaken im eigenen Log', () => {
  it('Antwort ins Journal (Feld check), null nimmt zurück, unbekannte Frage → 400; die Karte zeigt die Antwort', async () => {
    const g = await rufe(alltag.GET, 'GET', '/api/gesundheit/alltag', sitzung('anna'));
    const tag = g.json.sicht.check.tag as string;
    const p = await rufe(journal.PATCH, 'PATCH', '/api/state/journal', sitzung('anna'), { datum: tag, eintrag: { check: { alkohol: true, getrunken: false } } });
    expect(p.status, p.text).toBe(200);
    expect(p.json.eintrag.check).toEqual({ alkohol: true, getrunken: false });
    const z = await rufe(journal.PATCH, 'PATCH', '/api/state/journal', sitzung('anna'), { datum: tag, eintrag: { check: { getrunken: null } } });
    expect(z.json.eintrag.check).toEqual({ alkohol: true });
    expect((await rufe(journal.PATCH, 'PATCH', '/api/state/journal', sitzung('anna'), { datum: tag, eintrag: { check: { erfunden: true } } })).status).toBe(400);
    const g2 = await rufe(alltag.GET, 'GET', '/api/gesundheit/alltag', sitzung('anna'));
    expect(g2.json.sicht.check.antworten).toEqual({ alkohol: true });
    // Cara ohne Einwilligung: 403, kein Journal.
    expect((await rufe(journal.PATCH, 'PATCH', '/api/state/journal', sitzung('cara'), { datum: tag, eintrag: { check: { alkohol: true } } })).status).toBe(403);
    expect(roh('journal--cara')).toBeNull();
  });

  it('PATCH /api/state/health hakt EINE Routine ab bzw. löst sie — nur im eigenen Log', async () => {
    const a = await rufe(health.PATCH, 'PATCH', '/api/state/health', sitzung('anna'), { routine: MARKE, erledigt: true });
    expect(a.status, a.text).toBe(200);
    expect(a.json.erledigt).toEqual([MARKE]);
    expect(roh('health-log--anna')).toContain(MARKE);
    const b = await rufe(health.PATCH, 'PATCH', '/api/state/health?fuer=anna', sitzung('ben'), { routine: 'r-ben', erledigt: true });
    expect(b.status).toBe(200);
    expect(roh('health-log--anna')).not.toContain('r-ben');
    expect(roh('health-log--ben')).toContain('r-ben');
    const weg = await rufe(health.PATCH, 'PATCH', '/api/state/health', sitzung('anna'), { routine: MARKE, erledigt: false });
    expect(weg.json.erledigt).toEqual([]);
    expect((await rufe(health.PATCH, 'PATCH', '/api/state/health', sitzung('anna'), { routine: MARKE, erledigt: 'ja' })).status).toBe(400);
    expect((await rufe(health.PATCH, 'PATCH', '/api/state/health', sitzung('cara'), { routine: 'r-x', erledigt: true })).status).toBe(403);
  });
});

describe('Abend-Erinnerung (Takt)', () => {
  it('zur Erinnerungszeit EINE neutrale Meldung in die eigene Glocke — einmal je Tag, nur wer sie eingeschaltet hat', async () => {
    const { schlafJobsImTakt, schlafMerkerLeeren } = await import('@/lib/gesundheit/alltag-server');
    const { ausWandzeit } = await import('@/lib/kalender/zeit');
    schlafMerkerLeeren();
    const vorher = await schlafJobsImTakt(ausWandzeit(`${heute}T22:10:00`));
    expect(vorher.erinnert).toBe(0);
    const r = await schlafJobsImTakt(ausWandzeit(`${heute}T22:35:00`));
    expect(r.erinnert).toBe(1);
    const glocke = JSON.parse(roh('meldungen--anna') ?? '{}') as { eintraege?: { art: string; titel: string; link: string }[] };
    const m = (glocke.eintraege ?? []).filter(e => e.art === 'gesundheit');
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ titel: 'Zeit, den Tag ausklingen zu lassen', link: '/os/gesundheit' }); // keine Uhrzeit, kein Wert
    expect(roh('meldungen--ben')).toBeNull();
    const noch = await schlafJobsImTakt(ausWandzeit(`${heute}T22:50:00`));
    expect(noch.erinnert).toBe(0);
    expect(JSON.parse(roh('gesundheit-alltag--anna')!).erinnert).toBe(heute);
  });

  it('der Riegel ändert den Stand der Einstellungen nicht (kein 409 nach einer Erinnerung)', async () => {
    const g = await rufe(alltag.GET, 'GET', '/api/gesundheit/alltag', sitzung('anna'));
    const p = await rufe(alltag.PATCH, 'PATCH', '/api/gesundheit/alltag', sitzung('anna'), { stand: g.json.stand, ops: [{ op: 'schlaf', felder: { vorlaufMin: 45 } }] });
    expect(p.status, p.text).toBe(200);
  });
});

describe('Essen & Trinken', () => {
  it('Orientierung aus den eigenen WHOOP-Werten, Ergänzungen nur aus eigenen Routinen', async () => {
    await db.saveJson('routinen', { routinen: [
      { id: MARKE, label: 'Kreatin · eigene Menge', wann: 'tag', kategorie: 'gesundheit', dauerMin: 5, aktiv: true, owner: 'anna', space: 'privat' },
      { id: 'r-ben-fremd', label: 'Fremd', wann: 'tag', kategorie: 'gesundheit', dauerMin: 5, aktiv: true, owner: 'ben', space: 'privat' },
    ], bloecke: [] });
    const g = await rufe(alltag.GET, 'GET', '/api/gesundheit/alltag', sitzung('anna'));
    const e = g.json.sicht.essen;
    expect(e.orientierung).toMatchObject({ kcal7: 2600, kcalTage: 7 });
    expect(e.ergaenzungen).toEqual([{ routine: MARKE, label: 'Kreatin · eigene Menge', vorlage: 'kreatin', erledigt: false }]);
    expect(JSON.stringify(e)).not.toContain('r-ben-fremd');
  });

  it('Belastungstage für den Wochenvorschlag nur mit Einwilligung (b), nur Wochentage, keine Namen', async () => {
    const { belastungFuerHaushalt } = await import('@/lib/ernaehrung/orientierung-server');
    const { belastungsZeile } = await import('@/lib/ernaehrung/orientierung');
    expect(await belastungFuerHaushalt(['anna', 'ben'], heute)).toEqual({ tage: [], mitGesundheit: false });
    expect((await ein.gesundheitErklaeren('anna', 'ki', true, ein.GESUNDHEIT_FASSUNG)).ok).toBe(true);
    const b = await belastungFuerHaushalt(['anna', 'ben'], heute);
    expect(b).toEqual({ tage: ['do'], mitGesundheit: true }); // Bens harter Dienstag zählt nicht — er hat (b) nicht erklärt
    const z = belastungsZeile(b.tage);
    for (const n of ['anna', 'ben']) expect(z).not.toMatch(new RegExp(`\\b${n}\\b`, 'i'));
  });
});

describe('Bausteine im Browser ziehen keine Datenschicht', () => {
  it('die reinen Regeln importieren weder lib/vitals noch lib/whoop noch local-db zur Laufzeit', () => {
    for (const f of ['lib/gesundheit/schlaf.ts', 'lib/gesundheit/tages-check.ts', 'lib/gesundheit/alltag.ts', 'lib/ernaehrung/orientierung.ts', 'components/os/gesundheit/alltag-daten.ts']) {
      const t = readFileSync(path.join(process.cwd(), f), 'utf8');
      const laufzeit = t.split('\n').filter(z => /^import (?!type)/.test(z));
      expect(laufzeit.filter(z => /lib\/vitals'|lib\/whoop|local-db|alltag-server/.test(z)), f).toEqual([]);
    }
  });
});
