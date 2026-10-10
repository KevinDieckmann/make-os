// ─── Wächter: Erholung — „Sicht X bekommt nichts aus Y“ (10.10., Gesundheit › Erholung) ─────────────────────────────────────────────
// /api/gesundheit/erholung: die eigene Erholung immer; eine andere Person nur, wenn sie ihre Gesundheit teilt UND beide volle Mitglieder des
// Haushalts sind — dann ohne Unterlagen- und Kalender-Verweise, ohne Stand, mit Lese-Protokoll. Ohne Teilen, Konto „nur Business“, Testkunde
// ohne Haushalt, fremder Haushalt und Dienstweg: nichts. Schreiben nur die Person selbst (kein ?fuer), Einwilligung (a) zuerst, Stand/409,
// Grenzen 413. Eigener Datenordner, erfundene Personen und Inhalte — nie der echte Bestand.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-erholung-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-erholung';
process.env.MAKE_OS_KI_VORGABE = 'sparsam';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

const MARKE = 'ERHOLUNG-WAECHTER-PROGRAMM';
const UNTERLAGE = 'gu-11111111-2222-4333-8444-555555555555';
const TERMIN = 'kal-erholung|ERHOLUNG-WAECHTER-TERMIN';
type Handler = (r: Request) => Promise<Response>;
let route: { GET: Handler; PATCH: Handler };
let db: typeof import('@/lib/store/local-db');

const sitzung = (p: string) => ({ 'content-type': 'application/json', 'x-make-user': p });
const dienst = (p?: string) => ({ 'content-type': 'application/json', 'x-make-key': 'pruef-schluessel-erholung', ...(p ? { 'x-make-person': p } : {}) });
const rufe = async (methode: 'GET' | 'PATCH', pfad: string, kopf: Record<string, string>, body?: unknown) => {
  const r = await route[methode](new Request(`http://test${pfad}`, { method: methode, headers: kopf, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }));
  const text = await r.text();
  return { status: r.status, text, json: (text ? JSON.parse(text) : {}) as Record<string, unknown> };
};
const datei = (name: string) => path.join(ordner, `${name}.json`);
const roh = (name: string) => (existsSync(datei(name)) ? readFileSync(datei(name), 'utf8') : null);
const konto = (id: string, speicher: string, extra: Record<string, unknown> = {}) => ({
  id, speicher, email: `${speicher}@example.invalid`, name: `${speicher} Prüf`, rolle: 'mitglied', hash: 'x', salz: 'x', angelegt: '2026-10-10T08:00:00.000Z', teilt: { gesundheit: [] }, haushalt: 'h-erholung', ...extra,
});

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  const ein = await import('@/lib/datenschutz/gesundheit-einwilligung');
  route = (await import('@/app/api/gesundheit/erholung/route')) as unknown as { GET: Handler; PATCH: Handler };
  // Anna teilt ihre Gesundheit mit Ben — und (zum Prüfen der Schranken) auch mit dem Partner „nur Business“, dem Testkunden und dem fremden Haushalt.
  await db.saveJson('konten', { konten: [
    konto('1', 'anna', { rolle: 'inhaber', teilt: { gesundheit: ['ben', 'partner', 'kunde', 'fremd'] } }),
    konto('2', 'ben'),
    konto('3', 'cara'),
    konto('4', 'partner', { finanzRecht: 'business' }),
    konto('5', 'kunde', { haushalt: undefined }),
    konto('6', 'fremd', { haushalt: 'anderer-haushalt' }),
  ], einladungen: [] });
  for (const p of ['anna', 'ben']) expect((await ein.gesundheitErklaeren(p, 'verarbeiten', true, ein.GESUNDHEIT_FASSUNG)).ok).toBe(true);
  const g = await rufe('GET', '/api/gesundheit/erholung', sitzung('anna'));
  expect(g.status, g.text).toBe(200);
  expect(g.json.eigene).toBe(true);
  const e1 = await rufe('PATCH', '/api/gesundheit/erholung', sitzung('anna'), { stand: g.json.stand, ops: [
    { op: 'programm', programm: { name: MARKE, art: 'mobility', proWoche: 3 } },
    { op: 'behandlung', behandlung: { art: 'Massage', geplant: 6, unterlagen: [UNTERLAGE] } },
    { op: 'fokus', text: 'Ruhe (Prüfung)' },
    { op: 'einstellungen', einstellungen: { pausen: { an: true, alleMin: 60, von: '08:00', bis: '16:00' } } },
  ] });
  expect(e1.status, e1.text).toBe(200);
  const b = (e1.json.erholung as { behandlungen: { id: string }[] }).behandlungen[0];
  const e2 = await rufe('PATCH', '/api/gesundheit/erholung', sitzung('anna'), { stand: e1.json.stand, ops: [{ op: 'behandlung-termin', id: b.id, termin: { tag: '2026-12-01', uhr: '17:00', terminId: TERMIN } }] });
  expect(e2.status, e2.text).toBe(200);
});
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten();
  rmSync(ordner, { recursive: true, force: true });
});

describe('Erholung: Sicht X bekommt nichts aus Y', () => {
  it('die Person selbst liest alles, mit Stand — der Bestand liegt mit Suffix', async () => {
    const r = await rufe('GET', '/api/gesundheit/erholung', sitzung('anna'));
    expect(r.status).toBe(200);
    expect(r.text).toContain(MARKE);
    expect(r.text).toContain(UNTERLAGE);
    expect(r.text).toContain(TERMIN);
    expect(r.json.stand).toEqual(expect.any(String));
    expect(roh('erholung--anna')).toContain(MARKE);
    expect(roh('erholung')).toBeNull();
  });

  it('mit Teilen (beide volle Mitglieder): lesen ja — ohne Unterlagen, ohne Kalender-Verweis, ohne Pausen, ohne Stand', async () => {
    const r = await rufe('GET', '/api/gesundheit/erholung?fuer=anna', sitzung('ben'));
    expect(r.status, r.text).toBe(200);
    expect(r.json).toMatchObject({ eigene: false, fuer: 'anna', ich: 'ben' });
    expect(r.text).toContain(MARKE);
    expect(r.text).not.toContain(UNTERLAGE);
    expect(r.text).not.toContain('ERHOLUNG-WAECHTER-TERMIN');
    expect(r.text).not.toContain('alleMin');
    expect(r.json.stand).toBeUndefined();
    // Lese-Protokoll (Art. 9): Bereich Gesundheit, betroffen = die angezeigte Person.
    await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten();
    const lp = JSON.stringify(await Promise.all(readdirSync(ordner).filter(f => f.startsWith('leseprotokoll--')).map(f => db.loadJson(f.replace(/\.json$/, '')))));
    expect(lp).toContain('"bereich":"gesundheit"');
    expect(lp).toContain('"betroffen":"anna"');
    expect(lp).not.toContain(MARKE);
  });

  it('ohne Teilen, Konto „nur Business“, Testkunde ohne Haushalt, fremder Haushalt: 403 und keine Marke', async () => {
    for (const p of ['cara', 'partner', 'kunde', 'fremd']) {
      const r = await rufe('GET', '/api/gesundheit/erholung?fuer=anna', sitzung(p));
      expect(r.status, p).toBe(403);
      expect(r.text, p).not.toContain(MARKE);
    }
    // Umgekehrt: Ben teilt nicht mit Anna — auch die Inhaberin bekommt nichts.
    expect((await rufe('GET', '/api/gesundheit/erholung?fuer=ben', sitzung('anna'))).status).toBe(403);
  });

  it('Dienstweg (ZOE, Takt, Skripte) und ohne Person: nie', async () => {
    for (const k of [dienst(), dienst('anna')]) {
      const r = await rufe('GET', '/api/gesundheit/erholung', k);
      expect(r.status).toBe(403);
      expect(r.text).not.toContain(MARKE);
      expect((await rufe('PATCH', '/api/gesundheit/erholung', k, { stand: 'leer', ops: [{ op: 'fokus', text: 'x' }] })).status).toBe(403);
    }
    expect((await rufe('GET', '/api/gesundheit/erholung', { 'content-type': 'application/json' })).status).toBe(401);
  });

  it('Schreiben nur in den eigenen Bestand — ?fuer= ändert nichts an Annas Erholung', async () => {
    const vorher = roh('erholung--anna');
    const g = await rufe('GET', '/api/gesundheit/erholung', sitzung('ben'));
    const r = await rufe('PATCH', '/api/gesundheit/erholung?fuer=anna', sitzung('ben'), { stand: g.json.stand, ops: [{ op: 'fokus', text: 'Bens eigener Satz' }] });
    expect(r.status, r.text).toBe(200);
    expect(roh('erholung--anna')).toBe(vorher);
    expect(roh('erholung--ben')).toContain('Bens eigener Satz');
  });

  it('ohne Einwilligung (a) wird nichts gespeichert — Entfernen bleibt erlaubt', async () => {
    const g = await rufe('GET', '/api/gesundheit/erholung', sitzung('cara'));
    expect(g.status).toBe(200);
    const r = await rufe('PATCH', '/api/gesundheit/erholung', sitzung('cara'), { stand: g.json.stand, ops: [{ op: 'fokus', text: 'nein' }] });
    expect(r.status).toBe(403);
    expect(roh('erholung--cara')).toBeNull();
    // Nur Entfernen geht an der Sperre vorbei (hier: nichts da → 404, gespeichert wird trotzdem nichts).
    expect((await rufe('PATCH', '/api/gesundheit/erholung', sitzung('cara'), { stand: g.json.stand, ops: [{ op: 'weg', liste: 'ziele', id: 'ez-x' }] })).status).toBe(404);
    expect(roh('erholung--cara')).toBeNull();
  });

  it('veralteter Stand → 409 mit dem aktuellen Bestand; zu viele Schritte → 413; nichts gespeichert', async () => {
    const vorher = roh('erholung--anna');
    const alt = await rufe('PATCH', '/api/gesundheit/erholung', sitzung('anna'), { stand: 'veraltet', ops: [{ op: 'fokus', text: 'überschrieben?' }] });
    expect(alt.status).toBe(409);
    expect(alt.json.konflikt).toBe(true);
    expect(alt.text).toContain(MARKE);
    const g = await rufe('GET', '/api/gesundheit/erholung', sitzung('anna'));
    const viel = await rufe('PATCH', '/api/gesundheit/erholung', sitzung('anna'), { stand: g.json.stand, ops: Array.from({ length: 51 }, () => ({ op: 'fokus', text: 'x' })) });
    expect(viel.status).toBe(413);
    expect(roh('erholung--anna')).toBe(vorher);
  });

  it('die Sicht rechnet heute fällig, Ziele und Behandlungen mit', async () => {
    const r = await rufe('GET', '/api/gesundheit/erholung', sitzung('anna'));
    const sicht = r.json.sicht as { faellig: { programm: { name: string } }[]; behandlungen: { text: string; naechster?: { terminId?: string } }[]; streak: { tage: number } };
    expect(sicht.faellig.map(f => f.programm.name)).toContain(MARKE);
    expect(sicht.behandlungen[0]).toMatchObject({ text: '0 von 6' });
    expect(sicht.streak.tage).toBe(0);
    // In der fremden Sicht trägt auch die gerechnete Behandlung keinen Kalender-Verweis.
    const f = await rufe('GET', '/api/gesundheit/erholung?fuer=anna', sitzung('ben'));
    expect((f.json.sicht as typeof sicht).behandlungen[0].naechster?.terminId).toBeUndefined();
  });
});
