// ─── Wächter: Körper-Profil nur für die Person selbst (08.10. abends, Fragebogen Teil 3, Frage 2) ────────────────────
// Kevin: „Körper-Reiter sieht nur die Person selbst“ · „ZOE nutzt Gesundheitsinhalte nur mit Einwilligung ‚an die KI‘“.
// Sicht B bekommt nichts aus A — auch wenn A seine Gesundheit mit B teilt, auch mit ?fuer=, nie über den Dienstweg.
// Eigener Datenordner, erfundene Personen und Inhalte — nie der echte Bestand. Neue Instanz (Vorgabe „sparsam“): ohne
// Einwilligung (a) kein Schreiben.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-koerper-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-koerper';
process.env.MAKE_OS_KI_VORGABE = 'sparsam';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.MAKE_OS_ALTBESTAND_PERSON;

const MARKE = 'KOERPER-WAECHTER-MARKE-A';
type Handler = (r: Request) => Promise<Response>;
let route: { GET: Handler; PATCH: Handler };
let db: typeof import('@/lib/store/local-db');
let ein: typeof import('@/lib/datenschutz/gesundheit-einwilligung');

const sitzung = (p: string) => ({ 'content-type': 'application/json', 'x-make-user': p });
const dienst = (p?: string) => ({ 'content-type': 'application/json', 'x-make-key': 'pruef-schluessel-koerper', ...(p ? { 'x-make-person': p } : {}) });
const rufe = async (methode: 'GET' | 'PATCH', pfad: string, kopf: Record<string, string>, body?: unknown) => {
  const r = await route[methode](new Request(`http://test${pfad}`, { method: methode, headers: kopf, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }));
  const text = await r.text();
  return { status: r.status, text, json: (text ? JSON.parse(text) : {}) as Record<string, unknown> };
};
const datei = (name: string) => path.join(ordner, `${name}.json`);
const roh = (name: string) => (existsSync(datei(name)) ? readFileSync(datei(name), 'utf8') : null);

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  ein = await import('@/lib/datenschutz/gesundheit-einwilligung');
  route = (await import('@/app/api/gesundheit/koerper/route')) as unknown as { GET: Handler; PATCH: Handler };
  // A teilt seine Gesundheit mit B — trotzdem bekommt B das Körper-Profil nie. C hat keine Einwilligung.
  await db.saveJson('konten', { konten: [
    { id: '1', speicher: 'anna', email: 'anna@example.invalid', name: 'Anna Prüf', rolle: 'inhaber', hash: 'x', salz: 'x', angelegt: '2026-10-10T08:00:00.000Z', teilt: { gesundheit: ['ben'] }, haushalt: 'h-koerper' },
    { id: '2', speicher: 'ben', email: 'ben@example.invalid', name: 'Ben Prüf', rolle: 'mitglied', hash: 'x', salz: 'x', angelegt: '2026-10-10T08:00:00.000Z', teilt: { gesundheit: ['anna'] }, haushalt: 'h-koerper' },
    { id: '3', speicher: 'cara', email: 'cara@example.invalid', name: 'Cara Prüf', rolle: 'mitglied', hash: 'x', salz: 'x', angelegt: '2026-10-10T08:00:00.000Z', teilt: { gesundheit: [] }, haushalt: 'h-koerper' },
  ], einladungen: [] });
  for (const p of ['anna', 'ben']) expect((await ein.gesundheitErklaeren(p, 'verarbeiten', true, ein.GESUNDHEIT_FASSUNG)).ok).toBe(true);
  // A legt ihr Profil an (über die Route, mit Stand).
  const g = await rufe('GET', '/api/gesundheit/koerper', sitzung('anna'));
  expect(g.status).toBe(200);
  expect(g.json.koerper).toBeNull();
  const p = await rufe('PATCH', '/api/gesundheit/koerper', sitzung('anna'), { stand: g.json.stand, ops: [
    { op: 'felder', felder: { leitsatz: MARKE, hinweis: MARKE, symptom: { name: MARKE }, sauberZaehler: true } },
    { op: 'eintrag', liste: 'beschwerden', eintrag: { name: MARKE, status: 'offen', notiz: MARKE, ton: 'kritisch' } },
    { op: 'eintrag', liste: 'hebel', eintrag: { name: MARKE, notiz: '', kennzahl: 'schlaf' } },
    { op: 'eintrag', liste: 'stufen', eintrag: { phase: '1', name: MARKE, beschreibung: '', zustand: 'jetzt' } },
  ] });
  expect(p.status, p.text).toBe(200);
});
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten();
  rmSync(ordner, { recursive: true, force: true });
});

describe('Körper-Profil: Sicht B bekommt nichts aus A', () => {
  it('A liest das eigene Profil (Gegenprobe: der Bestand liegt wirklich da)', async () => {
    const r = await rufe('GET', '/api/gesundheit/koerper', sitzung('anna'));
    expect(r.status).toBe(200);
    expect(r.text).toContain(MARKE);
    expect(roh('gesundheit-koerper--anna')).toContain(MARKE);
  });

  it('B bekommt nichts — auch nicht geteilt, auch nicht mit ?fuer=/person= (immer nur das eigene, leere Profil)', async () => {
    for (const q of ['', '?fuer=anna', '?fuer=anna&person=anna&wer=anna&von=anna']) {
      const r = await rufe('GET', `/api/gesundheit/koerper${q}`, sitzung('ben'));
      expect(r.status, q).toBe(200);
      expect(r.text, q).not.toContain(MARKE);
      expect(r.json.koerper, q).toBeNull();
    }
  });

  it('auch der geteilte Gesundheits-Stand trägt nichts aus dem Körper-Profil', async () => {
    const stand = (await import('@/app/api/gesundheit/stand/route')) as unknown as { GET: Handler };
    const r = await stand.GET(new Request('http://test/api/gesundheit/stand?fuer=anna', { headers: sitzung('ben') }));
    expect(r.status).toBe(200); // geteilt → der Stand selbst kommt an
    expect(await r.text()).not.toContain(MARKE);
  });

  it('B schreibt nie in As Profil — ?fuer wird ignoriert, es entsteht nur Bs eigenes', async () => {
    const vorher = roh('gesundheit-koerper--anna');
    const g = await rufe('GET', '/api/gesundheit/koerper?fuer=anna', sitzung('ben'));
    const r = await rufe('PATCH', '/api/gesundheit/koerper?fuer=anna', sitzung('ben'), { stand: g.json.stand, ops: [{ op: 'felder', felder: { leitsatz: 'Bs eigener Satz' } }] });
    expect(r.status, r.text).toBe(200);
    expect(r.text).not.toContain(MARKE);
    expect(roh('gesundheit-koerper--anna')).toBe(vorher);
    expect(roh('gesundheit-koerper--ben')).toContain('Bs eigener Satz');
  });

  it('Dienstweg → 403, auch mit benannter Person; ohne Person → 401', async () => {
    for (const kopf of [dienst(), dienst('anna')]) {
      const g = await rufe('GET', '/api/gesundheit/koerper', kopf);
      expect(g.status).toBe(403);
      expect(g.text).not.toContain(MARKE);
      const p = await rufe('PATCH', '/api/gesundheit/koerper', kopf, { stand: 'x', ops: [{ op: 'anlegen' }] });
      expect(p.status).toBe(403);
    }
    expect((await rufe('GET', '/api/gesundheit/koerper', { 'content-type': 'application/json' })).status).toBe(401);
  });

  it('ohne Einwilligung (a) kein Schreiben — 403, kein Bestand', async () => {
    const r = await rufe('PATCH', '/api/gesundheit/koerper', sitzung('cara'), { stand: 'leer', ops: [{ op: 'felder', felder: { leitsatz: 'Versuch' } }] });
    expect(r.status).toBe(403);
    expect(r.json.einwilligung).toBe('gesundheit');
    expect(roh('gesundheit-koerper--cara')).toBeNull();
  });

  it('veralteter Stand → 409 mit dem aktuellen Profil; über einer Grenze → 413, nichts gekürzt, nichts geschrieben', async () => {
    const vorher = roh('gesundheit-koerper--anna');
    const alt = await rufe('PATCH', '/api/gesundheit/koerper', sitzung('anna'), { stand: 'veraltet', ops: [{ op: 'felder', felder: { leitsatz: 'neu' } }] });
    expect(alt.status).toBe(409);
    expect(alt.json.konflikt).toBe(true);
    expect(JSON.stringify(alt.json.koerper)).toContain(MARKE);
    const stand = (await rufe('GET', '/api/gesundheit/koerper', sitzung('anna'))).json.stand;
    const lang = await rufe('PATCH', '/api/gesundheit/koerper', sitzung('anna'), { stand, ops: [{ op: 'felder', felder: { leitsatz: 'x'.repeat(301) } }] });
    expect(lang.status).toBe(413);
    const halb = await rufe('PATCH', '/api/gesundheit/koerper', sitzung('anna'), { stand, ops: [{ op: 'felder', felder: { leitsatz: 'gültig' } }, { op: 'weg', liste: 'hebel', id: 'kh-gibt-es-nicht' }] });
    expect(halb.status).toBe(404); // ein ungültiger Schritt → der ganze Stapel bleibt liegen
    expect(roh('gesundheit-koerper--anna')).toBe(vorher);
  });
});

describe('Körper-Profil an die KI nur mit Einwilligung (b) — nie für die andere Person', () => {
  it('ohne (b) nichts, mit (b) das EIGENE Profil; B bekommt As Profil nie, auch mit (b)+(c) und Teilen', async () => {
    const { eigenerGesundheitsKontext } = await import('@/lib/gesundheit/kontext');
    expect(await eigenerGesundheitsKontext('anna')).not.toContain(MARKE);
    expect((await ein.gesundheitErklaeren('anna', 'ki', true, ein.GESUNDHEIT_FASSUNG)).ok).toBe(true);
    expect((await ein.gesundheitErklaeren('anna', 'partner', true, ein.GESUNDHEIT_FASSUNG)).ok).toBe(true);
    expect((await ein.gesundheitErklaeren('ben', 'ki', true, ein.GESUNDHEIT_FASSUNG)).ok).toBe(true);
    const a = await eigenerGesundheitsKontext('anna');
    expect(a).toContain(MARKE);
    expect(a).toContain('<eigene_angaben quelle="koerper">');
    expect(await eigenerGesundheitsKontext('ben')).not.toContain(MARKE);
    expect(await eigenerGesundheitsKontext(null)).toBe('');
  });
});

describe('Körper-Profil rein: Schritte, Grenzen, Säubern', () => {
  it('Schritte: neu, ändern, entfernen; Unbekanntes → 400/404; volle Liste → 413', async () => {
    const { koerperAnwenden, KoerperFehler, KOERPER_GRENZEN } = await import('@/lib/gesundheit/koerper');
    let n = 0;
    const id = () => `kz-test-${++n}`;
    let k = koerperAnwenden(null, [{ op: 'eintrag', liste: 'zusammenhaenge', eintrag: { text: 'a → b' } }], id);
    expect(k.zusammenhaenge).toEqual([{ id: 'kz-test-1', text: 'a → b' }]);
    k = koerperAnwenden(k, [{ op: 'eintrag', liste: 'zusammenhaenge', eintrag: { id: 'kz-test-1', text: 'a → c' } }], id);
    expect(k.zusammenhaenge[0].text).toBe('a → c');
    k = koerperAnwenden(k, [{ op: 'weg', liste: 'zusammenhaenge', id: 'kz-test-1' }], id);
    expect(k.zusammenhaenge).toEqual([]);
    const fehler = (ops: unknown) => { try { koerperAnwenden(k, ops, id); return 0; } catch (e) { return e instanceof KoerperFehler ? e.status : -1; } };
    expect(fehler([{ op: 'unbekannt' }])).toBe(400);
    expect(fehler([{ op: 'felder', felder: { fremd: 1 } }])).toBe(400);
    expect(fehler([{ op: 'eintrag', liste: 'hebel', eintrag: { name: 'x', kennzahl: 'Ungültig!' } }])).toBe(400);
    expect(fehler([{ op: 'eintrag', liste: 'beschwerden', eintrag: { name: '' } }])).toBe(400);
    expect(fehler([{ op: 'eintrag', liste: 'beschwerden', eintrag: { id: 'kb-fehlt', name: 'x' } }])).toBe(404);
    expect(fehler([])).toBe(400);
    expect(fehler(Array.from({ length: KOERPER_GRENZEN.ops + 1 }, () => ({ op: 'anlegen' })))).toBe(413);
    const voll = koerperAnwenden(null, Array.from({ length: KOERPER_GRENZEN.eintraege }, (_, i) => ({ op: 'eintrag', liste: 'zusammenhaenge', eintrag: { text: `z${i}` } })), id);
    expect(() => koerperAnwenden(voll, [{ op: 'eintrag', liste: 'zusammenhaenge', eintrag: { text: 'zu viel' } }], id)).toThrow(KoerperFehler);
  });

  it('Säubern beim Lesen kürzt nie und kennt keine fremden Felder', async () => {
    const { koerperSaeubern } = await import('@/lib/gesundheit/koerper');
    const lang = 'y'.repeat(5000);
    const k = koerperSaeubern({ leitsatz: lang, zusammenhaenge: Array.from({ length: 80 }, (_, i) => ({ id: `kz-${i}`, text: lang })), fremd: 'weg', symptom: { name: '' } })!;
    expect(k.leitsatz).toHaveLength(5000);
    expect(k.zusammenhaenge).toHaveLength(80);
    expect(k.symptom).toBeNull();
    expect(JSON.stringify(k)).not.toContain('fremd');
    expect(koerperSaeubern(null)).toBeNull();
  });
});
