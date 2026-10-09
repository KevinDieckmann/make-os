// ─── Gesundheits-Module je Person (09.10., PRIVATE_INHALTE_SUCHE.md Paket 2 › C) ────────────────────────────────────────
// Symptom-Tagebuch (`haut`) und Zähler „Sauber geblieben“ (`serie`) sind Module, die jede Person für sich schaltet:
//   · Altbestand-Instanz: wer schon Einträge hat, hat das Modul an — der Index bleibt bit-gleich, Schreiben geht wie bisher;
//   · neue Person: Module aus — keine Abendfrage, keine Index-Kennzahl, Schreiben → 409;
//   · ausdrücklich aus schlägt den Altbestand (nie automatisch aus, aber von Hand);
//   · Sicht B bekommt nichts aus A: B schaltet nie As Module, sieht ein ausgeschaltetes Modul nie (auch geteilt), Dienstweg 403.
// Eigener Datenordner, erfundene Personen und Werte — nie echte Gesundheitsangaben.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-ges-module-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-module';
process.env.MAKE_OS_KI_VORGABE = 'sparsam';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.MAKE_OS_ALTBESTAND_PERSON;

type Handler = (r: Request) => Promise<Response>;
type Route = { GET?: Handler; PUT?: Handler; PATCH?: Handler };
const sitzung = (p: string) => ({ 'content-type': 'application/json', 'x-make-user': p });
const dienst = (p?: string) => ({ 'content-type': 'application/json', 'x-make-key': 'pruef-schluessel-module', ...(p ? { 'x-make-person': p } : {}) });
async function rufe(route: Route, methode: 'GET' | 'PUT' | 'PATCH', pfad: string, kopf: Record<string, string>, body?: unknown) {
  const r = await route[methode]!(new Request(`http://test${pfad}`, { method: methode, headers: kopf, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }));
  const text = await r.text();
  return { status: r.status, text, json: (text ? JSON.parse(text) : {}) as Record<string, unknown> };
}

const HEUTE_TAGE = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' }); };
const MARKE = 'MODUL-WAECHTER-AUSLOESER';

let db: typeof import('@/lib/store/local-db');
let raum: typeof import('@/lib/zoe/raum');
let koerperRoute: Route, hautRoute: Route, streakRoute: Route, standRoute: Route;

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  raum = await import('@/lib/zoe/raum');
  const ein = await import('@/lib/datenschutz/gesundheit-einwilligung');
  koerperRoute = (await import('@/app/api/gesundheit/koerper/route')) as unknown as Route;
  hautRoute = (await import('@/app/api/state/haut/route')) as unknown as Route;
  streakRoute = (await import('@/app/api/state/streak/route')) as unknown as Route;
  standRoute = (await import('@/app/api/gesundheit/stand/route')) as unknown as Route;
  // alt = Altbestand (Einträge in beiden Tagebüchern, kein Profil) · neu = frische Person · teilt = sieht alts Gesundheit
  // (alt teilt mit ihr) · ohne = keine Einwilligung (a).
  const k = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', teilt: string[] = []) =>
    ({ id, speicher, email: `${speicher}@example.invalid`, name: `${speicher} Prüf`, rolle, hash: 'x', salz: 'x', angelegt: '2026-10-01T08:00:00.000Z', teilt: { gesundheit: teilt }, haushalt: 'h-module' });
  await db.saveJson('konten', { konten: [k('1', 'alt', 'inhaber', ['teilt']), k('2', 'neu', 'mitglied'), k('3', 'teilt', 'mitglied'), k('4', 'ohne', 'mitglied')], einladungen: [] });
  for (const p of ['alt', 'neu', 'teilt']) expect((await ein.gesundheitErklaeren(p, 'verarbeiten', true, ein.GESUNDHEIT_FASSUNG)).ok).toBe(true);
  // Altbestand: 20 Tage Symptom-Tagebuch und Zähler, erfundene Werte.
  const haut: Record<string, unknown> = {}, streak: Record<string, unknown> = {};
  for (let i = 0; i < 20; i++) {
    haut[HEUTE_TAGE(i)] = { juckreiz: (i % 5) + 1, schub: i === 4, ausloeser: i === 4 ? MARKE : undefined, at: '2026-10-01T20:00:00.000Z' };
    streak[HEUTE_TAGE(i)] = { sauber: i !== 12, craving: 2, at: '2026-10-01T21:00:00.000Z' };
  }
  await db.saveJson(raum.speicherFuer('haut', 'alt'), haut);
  await db.saveJson(raum.speicherFuer('streak', 'alt'), streak);
});
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten();
  rmSync(ordner, { recursive: true, force: true });
});

describe('Regel rein (lib/gesundheit/module.ts)', () => {
  it('ausdrücklich gewinnt; sonst frühere Anzeige-Einstellung oder Einträge → an; sonst aus', async () => {
    const { moduleWirksam } = await import('@/lib/gesundheit/module');
    expect(moduleWirksam(null)).toEqual({ haut: false, serie: false });
    expect(moduleWirksam(null, { haut: true, serie: true })).toEqual({ haut: true, serie: true });
    expect(moduleWirksam({ symptom: { name: 'Regler X' }, sauberZaehler: true })).toEqual({ haut: true, serie: true });
    expect(moduleWirksam({ symptom: { name: '  ' }, sauberZaehler: false })).toEqual({ haut: false, serie: false });
    expect(moduleWirksam({ module: { haut: false }, symptom: { name: 'Regler X' } }, { haut: true, serie: true })).toEqual({ haut: false, serie: true });
    expect(moduleWirksam({ module: { serie: true } })).toEqual({ haut: false, serie: true });
  });

  it('zählt nur an UND in 60 Tagen geführt; ohne bekannten Stand wie bisher allein „geführt“', async () => {
    const { modulZaehlt } = await import('@/lib/gesundheit/module');
    const heute = '2026-10-09';
    const log = { '2026-09-01': { x: 1 } };
    expect(modulZaehlt(true, log, heute)).toBe(true);
    expect(modulZaehlt(undefined, log, heute)).toBe(true);
    expect(modulZaehlt(false, log, heute)).toBe(false);
    expect(modulZaehlt(true, { '2026-07-01': { x: 1 } }, heute)).toBe(false);
    expect(modulZaehlt(true, {}, heute)).toBe(false);
  });

  it('Körper-Schritt `modul`: schaltet, `serie` stellt den Zähler mit; Unbekanntes → 400; „nur aus“ erkannt; Säubern kennt nur Module', async () => {
    const { koerperAnwenden, koerperSaeubern, nurModuleAus, KoerperFehler } = await import('@/lib/gesundheit/koerper');
    let k = koerperAnwenden(null, [{ op: 'modul', modul: 'serie', an: true }]);
    expect(k.module).toEqual({ serie: true });
    expect(k.sauberZaehler).toBe(true);
    k = koerperAnwenden(k, [{ op: 'modul', modul: 'haut', an: false }, { op: 'modul', modul: 'serie', an: false }]);
    expect(k.module).toEqual({ haut: false, serie: false });
    expect(k.sauberZaehler).toBe(false);
    for (const ops of [[{ op: 'modul', modul: 'fremd', an: true }], [{ op: 'modul', modul: 'haut', an: 'ja' }]]) {
      expect(() => koerperAnwenden(k, ops)).toThrow(KoerperFehler);
    }
    expect(nurModuleAus([{ op: 'modul', modul: 'haut', an: false }])).toBe(true);
    expect(nurModuleAus([{ op: 'modul', modul: 'haut', an: true }])).toBe(false);
    expect(nurModuleAus([{ op: 'modul', modul: 'haut', an: false }, { op: 'felder', felder: { leitsatz: 'x' } }])).toBe(false);
    expect(nurModuleAus([])).toBe(false);
    expect(koerperSaeubern({ module: { haut: true, fremd: true, serie: 'ja' } })!.module).toEqual({ haut: true });
    expect(koerperSaeubern({})!.module).toBeUndefined();
  });

  it('Altbestand-Übernahme: ausdrücklich geschaltete Module der Person gewinnen', async () => {
    const { koerperEinstellungenZusammen } = await import('@/lib/gesundheit/koerper-server');
    const { leererKoerper } = await import('@/lib/gesundheit/koerper');
    const neu = { ...leererKoerper(), sauberZaehler: true };
    const alt = { ...leererKoerper(), module: { serie: false } };
    const z = koerperEinstellungenZusammen(neu, alt);
    expect(z.module).toEqual({ serie: false });
    expect(z.sauberZaehler).toBe(false);
  });
});

describe('Altbestand-Instanz: Module bleiben an, Index unverändert', () => {
  it('ohne Profil, mit Einträgen: beide Module an (GET Körper, Stand)', async () => {
    const g = await rufe(koerperRoute, 'GET', '/api/gesundheit/koerper', sitzung('alt'));
    expect(g.status).toBe(200);
    expect(g.json.koerper).toBeNull();
    expect(g.json.module).toEqual({ haut: true, serie: true });
    const s = await rufe(standRoute, 'GET', '/api/gesundheit/stand', sitzung('alt'));
    expect(s.json.module).toEqual({ haut: true, serie: true });
    expect((s.json.haut as { trend: { tage: number } }).trend.tage).toBe(20);
  });

  it('Index: mit Modul-Stand bit-gleich zum Index ohne Modul-Regel (Haut, Schübe, Streak zählen)', async () => {
    const { ladeGesundheitBestand } = await import('@/lib/gesundheit/speicher');
    const { berechneGesundheit, kennzahlenFuer } = await import('@/lib/gesundheit/index');
    const b = await ladeGesundheitBestand('alt');
    expect(b.module).toEqual({ haut: true, serie: true });
    const mit = berechneGesundheit(b);
    const ohne = berechneGesundheit({ ...b, module: undefined });
    expect(mit).toEqual(ohne);
    expect(kennzahlenFuer(b).map(k => k.id)).toEqual(expect.arrayContaining(['haut', 'schuebe', 'streak']));
  });

  it('Schreiben geht wie bisher; die Abendnachricht fragt beide Module ab', async () => {
    expect((await rufe(hautRoute, 'PUT', '/api/state/haut', sitzung('alt'), { eintrag: { juckreiz: 3 } })).status).toBe(200);
    expect((await rufe(streakRoute, 'PUT', '/api/state/streak', sitzung('alt'), { eintrag: { sauber: true } })).status).toBe(200);
    const { nachrichtFuer } = await import('@/lib/gesundheit/lauf');
    const abend = await nachrichtFuer('alt', 'abend', 'http://test', { voll: true });
    expect(abend).toContain('Symptom-Tagebuch: 0–10');
    expect(abend).toContain('Sauber geblieben?');
    const woche = await nachrichtFuer('alt', 'woche', 'http://test', { voll: true });
    expect(woche).toContain('Symptom-Tagebuch: Ø');
    expect(woche).toMatch(/Sauber seit \d+ Tag/);
  });
});

describe('neue Person: Module aus — keine Abendfragen, keine Kennzahlen, kein Schreiben', () => {
  it('Stand und Körper: aus; Index ohne Tagebücher', async () => {
    expect((await rufe(koerperRoute, 'GET', '/api/gesundheit/koerper', sitzung('neu'))).json.module).toEqual({ haut: false, serie: false });
    expect((await rufe(standRoute, 'GET', '/api/gesundheit/stand', sitzung('neu'))).json.module).toEqual({ haut: false, serie: false });
    const { ladeGesundheitBestand } = await import('@/lib/gesundheit/speicher');
    const { kennzahlenFuer } = await import('@/lib/gesundheit/index');
    const ids = kennzahlenFuer(await ladeGesundheitBestand('neu')).map(k => k.id);
    for (const id of ['haut', 'schuebe', 'streak']) expect(ids).not.toContain(id);
  });

  it('Schreiben in ein ausgeschaltetes Modul → 409, kein Bestand', async () => {
    for (const [route, pfad, body, bestand] of [[hautRoute, '/api/state/haut', { eintrag: { juckreiz: 4 } }, 'haut'], [streakRoute, '/api/state/streak', { eintrag: { sauber: true } }, 'streak']] as const) {
      const r = await rufe(route, 'PUT', pfad, sitzung('neu'), body);
      expect(r.status, pfad).toBe(409);
      expect(r.json.modul, pfad).toBeTruthy();
      expect(await db.loadJson(raum.speicherFuer(bestand, 'neu')), pfad).toBeNull();
    }
  });

  it('Abendnachricht ohne Symptom- und Zählerfrage (auch mit erlaubten Inhalten)', async () => {
    const { nachrichtFuer } = await import('@/lib/gesundheit/lauf');
    const abend = await nachrichtFuer('neu', 'abend', 'http://test', { voll: true });
    expect(abend).not.toMatch(/0–10/);
    expect(abend).not.toContain('Sauber');
    const woche = await nachrichtFuer('neu', 'woche', 'http://test', { voll: true });
    expect(woche).not.toMatch(/Symptom|Sauber seit/);
  });

  it('einschalten (nur die Person selbst) → Schreiben geht, die Abendfrage kommt', async () => {
    const g = await rufe(koerperRoute, 'GET', '/api/gesundheit/koerper', sitzung('neu'));
    const p = await rufe(koerperRoute, 'PATCH', '/api/gesundheit/koerper', sitzung('neu'), { stand: g.json.stand, ops: [{ op: 'modul', modul: 'haut', an: true }] });
    expect(p.status, p.text).toBe(200);
    expect(p.json.module).toEqual({ haut: true, serie: false });
    expect((await rufe(hautRoute, 'PUT', '/api/state/haut', sitzung('neu'), { eintrag: { juckreiz: 2 } })).status).toBe(200);
    expect((await rufe(streakRoute, 'PUT', '/api/state/streak', sitzung('neu'), { eintrag: { sauber: true } })).status).toBe(409);
    const { nachrichtFuer } = await import('@/lib/gesundheit/lauf');
    const abend = await nachrichtFuer('neu', 'abend', 'http://test', { voll: true });
    expect(abend).toContain('Symptom-Tagebuch: 0–10');
    expect(abend).not.toContain('Sauber');
  });
});

describe('ausdrücklich aus schlägt den Altbestand — und andere sehen nichts', () => {
  beforeAll(async () => {
    const g = await rufe(koerperRoute, 'GET', '/api/gesundheit/koerper', sitzung('alt'));
    const p = await rufe(koerperRoute, 'PATCH', '/api/gesundheit/koerper', sitzung('alt'), { stand: g.json.stand, ops: [{ op: 'modul', modul: 'haut', an: false }] });
    expect(p.status, p.text).toBe(200);
    expect(p.json.module).toEqual({ haut: false, serie: true });
  });

  it('Index ohne Symptom-Kennzahlen, obwohl Einträge da sind; der Zähler zählt weiter', async () => {
    const { ladeGesundheitBestand } = await import('@/lib/gesundheit/speicher');
    const { kennzahlenFuer } = await import('@/lib/gesundheit/index');
    const ids = kennzahlenFuer(await ladeGesundheitBestand('alt')).map(k => k.id);
    expect(ids).not.toContain('haut');
    expect(ids).not.toContain('schuebe');
    expect(ids).toContain('streak');
  });

  it('Stand: das ausgeschaltete Modul kommt leer an — für die Person selbst UND die geteilte Ansicht', async () => {
    for (const [kopf, q] of [[sitzung('alt'), ''], [sitzung('teilt'), '?fuer=alt']] as const) {
      const r = await rufe(standRoute, 'GET', `/api/gesundheit/stand${q}`, kopf);
      expect(r.status, q).toBe(200);
      expect(r.json.module, q).toEqual({ haut: false, serie: true });
      expect((r.json.haut as { trend: { tage: number } }).trend.tage, q).toBe(0);
      expect(r.text, q).not.toContain(MARKE);
    }
  });

  it('Symptom-Tagebuch: die geteilte Ansicht bekommt nichts, die eigene Person ihre Einträge; Schreiben → 409', async () => {
    const fremd = await rufe(hautRoute, 'GET', '/api/state/haut?fuer=alt', sitzung('teilt'));
    expect(fremd.status).toBe(200);
    expect(fremd.json.modul).toBe(false);
    expect(fremd.json.log).toEqual({});
    expect(fremd.text).not.toContain(MARKE);
    const eigen = await rufe(hautRoute, 'GET', '/api/state/haut', sitzung('alt'));
    expect(eigen.text).toContain(MARKE);
    expect((await rufe(hautRoute, 'PUT', '/api/state/haut', sitzung('alt'), { eintrag: { juckreiz: 1 } })).status).toBe(409);
  });

  it('Takt: keine Symptomfrage, keine Wochenzeile; der Zähler bleibt', async () => {
    const { nachrichtFuer } = await import('@/lib/gesundheit/lauf');
    const abend = await nachrichtFuer('alt', 'abend', 'http://test', { voll: true });
    expect(abend).not.toMatch(/0–10, Schub/);
    expect(abend).toContain('Sauber geblieben?');
    expect(await nachrichtFuer('alt', 'woche', 'http://test', { voll: true })).not.toMatch(/Symptom|Auslöser/);
  });
});

describe('Sicht B bekommt nichts aus A: schalten nur die Person selbst', () => {
  it('B (teilt die Gesundheit) liest und schaltet nur die EIGENEN Module — ?fuer wird ignoriert', async () => {
    const g = await rufe(koerperRoute, 'GET', '/api/gesundheit/koerper?fuer=alt', sitzung('teilt'));
    expect(g.json.module).toEqual({ haut: false, serie: false });
    const p = await rufe(koerperRoute, 'PATCH', '/api/gesundheit/koerper?fuer=alt', sitzung('teilt'), { stand: g.json.stand, ops: [{ op: 'modul', modul: 'haut', an: true }] });
    expect(p.status, p.text).toBe(200);
    expect(p.json.module).toEqual({ haut: true, serie: false });
    // As Einstellung unverändert: Symptom-Tagebuch weiter aus.
    expect((await rufe(koerperRoute, 'GET', '/api/gesundheit/koerper', sitzung('alt'))).json.module).toEqual({ haut: false, serie: true });
  });

  it('Dienstweg → 403 (auch mit benannter Person); ohne Person → 401', async () => {
    for (const kopf of [dienst(), dienst('alt')]) {
      expect((await rufe(koerperRoute, 'GET', '/api/gesundheit/koerper', kopf)).status).toBe(403);
      expect((await rufe(koerperRoute, 'PATCH', '/api/gesundheit/koerper', kopf, { stand: 'leer', ops: [{ op: 'modul', modul: 'haut', an: true }] })).status).toBe(403);
    }
    expect((await rufe(koerperRoute, 'PATCH', '/api/gesundheit/koerper', { 'content-type': 'application/json' }, { stand: 'leer', ops: [{ op: 'modul', modul: 'haut', an: true }] })).status).toBe(401);
  });

  it('ohne Einwilligung (a): einschalten 403, ausschalten geht (verarbeitet nichts)', async () => {
    const an = await rufe(koerperRoute, 'PATCH', '/api/gesundheit/koerper', sitzung('ohne'), { stand: 'leer', ops: [{ op: 'modul', modul: 'serie', an: true }] });
    expect(an.status).toBe(403);
    expect(an.json.einwilligung).toBe('gesundheit');
    const aus = await rufe(koerperRoute, 'PATCH', '/api/gesundheit/koerper', sitzung('ohne'), { stand: 'leer', ops: [{ op: 'modul', modul: 'serie', an: false }] });
    expect(aus.status, aus.text).toBe(200);
    expect(aus.json.module).toEqual({ haut: false, serie: false });
  });

  it('Konto-Export/-Löschen kennen die Modul-Einstellung (sie liegt im Körper-Profil, einem Bestand je Person)', async () => {
    const { PERSON_BESTAENDE } = await import('@/lib/datenschutz/konto-daten');
    const { KOERPER_BASIS } = await import('@/lib/gesundheit/koerper');
    const eintrag = PERSON_BESTAENDE.find(b => b.basis === KOERPER_BASIS);
    expect(eintrag).toBeTruthy();
    expect(eintrag?.export).not.toBe(false);
    expect(JSON.stringify(await db.loadJson(raum.speicherFuer(KOERPER_BASIS, 'alt')))).toContain('"module"');
  });
});
