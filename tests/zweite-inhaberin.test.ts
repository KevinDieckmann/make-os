// ─── Zweite gleichwertige Inhaberin (09.10., R9 — ONBOARDING_PLAN.md L35) ─────────────────────────────────────────────────
// Kevin 08.10.: „Malin wird gleichwertige zweite Inhaberin · Server-Zugang (SSH) auch für Malin.“ Wächter:
//   (1) Regeln rein (lib/zugang/inhaber.ts): mehrere Inhaber, EIN Haupt-Inhaber (Einstellung, sonst das älteste Konto), Haushalt der
//       Inhaber, Ernennen/Abgeben (selber Haushalt, zweiter Faktor, nie der letzte, nie der Haupt-Inhaber), Konto löschen.
//   (2) Route POST /api/konto/haushalt: nur ein Inhaber per Sitzung, Dienstweg 403, Passwort + zweiter Faktor, 400/409 mit Grund,
//       Rolle + festgeschriebener Haupt-Inhaber, Glocke an alle Inhaber, Anmeldeprotokoll; Haushalt mehrerer Inhaber bleibt fest.
//   (3) Routen-Register: der zweite Inhaber darf alles, was der erste darf (jede Methode der Klasse `inhaber`); ein Mitglied bleibt 403;
//       das Mac-Adressbuch bleibt beim Haupt-Inhaber (Inhaber heißt Verwaltung, nicht Einsicht).
//   (4) deploy/ssh-schluessel-hinzufuegen.sh: eigener Schlüssel, kein Doppel, keine Optionen, Ausroll-Schlüssel unberührt, nie der letzte.
// Eigener Datenordner, erfundene Konten (@example.invalid), kein Netz, kein Modell.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-zweite-inhaberin-'));
process.env.MAKE_OS_DATEN_DIR = path.join(ordner, 'daten');
process.env.MAKE_OS_KEY = 'pruef-schluessel-zweite-inhaberin';
process.env.MAKE_VAULT_DIR = path.join(ordner, 'vault');
process.env.MAKE_OS_DOKU_WURZEL = 'aus';
process.env.MAKE_OS_BRAIN_INDEX = 'aus';
process.env.MAKE_OS_ZULIEFERER = 'an'; // das Mac-Adressbuch (Spiegel) wird gelesen — nur der Haupt-Inhaber bekommt es
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.ANTHROPIC_API_KEY;
delete process.env.ICLOUD_APPLE_ID;
delete process.env.ICLOUD_APP_PASSWORT;
mkdirSync(process.env.MAKE_OS_DATEN_DIR, { recursive: true });
mkdirSync(process.env.MAKE_VAULT_DIR, { recursive: true });

const I = await import('@/lib/zugang/inhaber');
const WURZEL = path.resolve(__dirname, '..');

type K = { speicher: string; rolle: 'inhaber' | 'mitglied'; haushalt?: string; zweiterFaktor?: { geheimnis: string; seit: string; wiederherstellung: [] }; finanzRecht?: 'business' };
const k = (speicher: string, rolle: K['rolle'], extra: Partial<K> = {}): K => ({ speicher, rolle, haushalt: 'haus', ...extra });
const FAKTOR: NonNullable<K['zweiterFaktor']> = { geheimnis: 'x', seit: '2026-10-01', wiederherstellung: [] };

describe('(1) Regeln rein — lib/zugang/inhaber.ts', () => {
  it('ein Inhaber: alles wie bisher (Haupt = der eine, Haushalt = seiner)', () => {
    const st = { konten: [k('a', 'inhaber'), k('b', 'mitglied'), k('c', 'mitglied', { haushalt: 'anders' })] };
    expect(I.hauptInhaber(st)?.speicher).toBe('a');
    expect(I.haushaltDerInhaber(st)).toBe('haus');
    expect(I.kontenImHaushaltDerInhaber(st).map(x => x.speicher)).toEqual(['a', 'b']);
    expect(I.istWirksamerInhaber(st, 'a')).toBe(true);
    expect(I.istWirksamerInhaber(st, 'b')).toBe(false);
  });

  it('mehrere Inhaber: jeder hat Rechte; Haupt = ältestes Konto (Reihenfolge des Bestands) bzw. die ausdrückliche Einstellung', () => {
    const konten = [k('a', 'inhaber'), k('b', 'inhaber'), k('c', 'mitglied')];
    expect(I.hauptInhaber({ konten })?.speicher).toBe('a');
    expect(I.hauptInhaber({ konten, einstellungen: { hauptInhaber: 'b' } })?.speicher).toBe('b');
    // Eine Einstellung auf ein Konto, das nicht (mehr) Inhaber ist, gilt nicht.
    expect(I.hauptInhaber({ konten, einstellungen: { hauptInhaber: 'c' } })?.speicher).toBe('a');
    for (const p of ['a', 'b']) expect(I.istWirksamerInhaber({ konten }, p), p).toBe(true);
    expect(I.wirksameInhaber({ konten, einstellungen: { hauptInhaber: 'b' } }).map(x => x.speicher)).toEqual(['b', 'a']);
    expect(I.istHauptInhaber({ konten }, 'b')).toBe(false);
  });

  it('ein Inhaber-Konto außerhalb des Haushalts der Inhaber hat keine Rechte (nie zwei Haushalte)', () => {
    const st = { konten: [k('a', 'inhaber'), k('x', 'inhaber', { haushalt: 'fremd' })] };
    expect(I.istWirksamerInhaber(st, 'x')).toBe(false);
    expect(I.imHaushaltDerInhaber(st, 'x')).toBe(false);
  });

  it('ernennen: nur Inhaber, Ziel im selben Haushalt, mit zweitem Faktor, kein „nur Business“; Haupt wird festgeschrieben', () => {
    const st = { konten: [k('a', 'inhaber', { zweiterFaktor: FAKTOR }), k('b', 'mitglied', { zweiterFaktor: FAKTOR }), k('c', 'mitglied'), k('d', 'mitglied', { haushalt: 'anders', zweiterFaktor: FAKTOR }), k('e', 'mitglied', { finanzRecht: 'business', zweiterFaktor: FAKTOR })] };
    expect(I.zumInhaberPruefen(st, 'b', 'c')).toMatchObject({ ok: false, status: 403 });
    expect(I.zumInhaberPruefen(st, 'a', 'zz')).toMatchObject({ ok: false, status: 404 });
    expect(I.zumInhaberPruefen(st, 'a', 'c')).toMatchObject({ ok: false, status: 409 });
    expect(I.zumInhaberPruefen(st, 'a', 'd')).toMatchObject({ ok: false, status: 400 });
    expect(I.zumInhaberPruefen(st, 'a', 'e')).toMatchObject({ ok: false, status: 409 });
    expect(I.zumInhaberPruefen(st, 'a', 'b')).toEqual({ ok: true });
    expect(I.zumInhaberPruefen({ konten: [k('a', 'inhaber', { haushalt: undefined }), k('b', 'mitglied', { zweiterFaktor: FAKTOR })] }, 'a', 'b')).toMatchObject({ ok: false, status: 409 });
    const neu = I.zumInhaberMachen({ ...st, einladungen: [] } as never, 'b');
    expect(neu.konten.find(x => x.speicher === 'b')?.rolle).toBe('inhaber');
    expect(neu.einstellungen?.hauptInhaber).toBe('a');
    expect(I.zumInhaberPruefen(neu, 'b', 'a')).toMatchObject({ ok: false, status: 409 }); // schon Inhaber
  });

  it('abgeben: nie der letzte, nie der Haupt-Inhaber; ein weiterer schon', () => {
    expect(I.abgebenPruefen({ konten: [k('a', 'inhaber'), k('b', 'mitglied')] }, 'a')).toMatchObject({ ok: false, status: 409 });
    const zwei = { konten: [k('a', 'inhaber'), k('b', 'inhaber')], einstellungen: { hauptInhaber: 'a' } };
    expect(I.abgebenPruefen(zwei, 'a')).toMatchObject({ ok: false, status: 409 });
    expect(I.abgebenPruefen(zwei, 'b')).toEqual({ ok: true });
    expect(I.abgebenPruefen(zwei, 'c')).toMatchObject({ ok: false, status: 404 });
    expect(I.rolleAbgeben({ ...zwei, einladungen: [] } as never, 'b').konten.find(x => x.speicher === 'b')?.rolle).toBe('mitglied');
  });

  it('Konto löschen: der Haupt-Inhaber nur allein, ein weiterer Inhaber gibt zuerst die Rolle ab', async () => {
    const { loeschenErlaubt } = await import('@/lib/datenschutz/konto-daten');
    const alle = [k('a', 'inhaber'), k('b', 'inhaber'), k('c', 'mitglied')];
    expect(loeschenErlaubt(alle[0], alle).ok).toBe(false);
    expect(loeschenErlaubt(alle[1], alle)).toMatchObject({ ok: false, fehler: expect.stringContaining('Inhaber-Rolle ab') });
    expect(loeschenErlaubt(alle[2], alle).ok).toBe(true);
    expect(loeschenErlaubt(alle[0], [alle[0]]).ok).toBe(true);
  });

  it('keine Namen in den Regeln (Plattform-Regel)', () => {
    const q = readFileSync(path.join(WURZEL, 'lib/zugang/inhaber.ts'), 'utf8').split('\n').filter(z => !/^\s*\/\//.test(z)).join('\n');
    expect(q).not.toMatch(/'(kevin|malin)'/);
  });
});

// ── Laufzeit ─────────────────────────────────────────────────────────────────────────────────────────────────────────
type Methode = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type H = (r: Request, ctx?: unknown) => Promise<Response>;
const PW = 'TESTPASSWORT-zweite-inhaberin';
const G = { erste: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP', zweite: 'KRUGS4ZANFZSAYJAORSXG5BAMNXWIZJA', partner: 'MFRGGZDFMZTWQ2LKNNWG23TPOBYXE43U', fremd: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ' };
const sitzung = (p: string) => ({ 'content-type': 'application/json', 'x-make-user': p });
const dienst = (p?: string) => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, ...(p ? { 'x-make-person': p } : {}) });
const anfrage = (pfad: string, kopf: Record<string, string>, m: Methode = 'GET', body?: unknown) =>
  new Request(`http://test/api/${pfad}`, { method: m, headers: kopf, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const route = async (pfad: string) => (await import(`@/app/api/${pfad}/route`)) as unknown as Partial<Record<Methode, H>>;
async function rufe(pfad: string, kopf: Record<string, string>, m: Methode = 'GET', body?: unknown): Promise<{ status: number; d: Record<string, unknown> }> {
  const r = await (await route(pfad))[m]!(anfrage(pfad, kopf, m, body));
  const text = await r.text();
  let d: Record<string, unknown> = {};
  try { d = JSON.parse(text); } catch { /* kein JSON */ }
  return { status: r.status, d };
}

let db: typeof import('@/lib/store/local-db');
let totp: typeof import('@/lib/zugang/totp');
const echtesFetch = globalThis.fetch;
/** Ein frischer Code (die nächste Zeitstufe, falls die laufende schon benutzt ist — Fenster ±1). */
const code = (wer: keyof typeof G, plus = 0) => totp.codeFuer(G[wer], totp.stufeVon() + plus);

beforeAll(async () => {
  globalThis.fetch = (async () => { throw new Error('Netz im Test gesperrt'); }) as typeof fetch;
  db = await import('@/lib/store/local-db');
  totp = await import('@/lib/zugang/totp');
  const K = await import('@/lib/zugang/konten');
  const konto = async (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) => ({
    id, speicher, email: `${speicher}@example.invalid`, name: `${speicher[0].toUpperCase()}${speicher.slice(1)} Probe`, rolle, ...(await K.passwortHashen(PW, K.KDF_STANDARD)),
    angelegt: '2026-01-01', teilt: { gesundheit: [] as string[] }, haushalt: 'haus-probe', ...extra,
  });
  const faktor = (g: string) => ({ zweiterFaktor: { geheimnis: g, seit: '2026-10-01', wiederherstellung: [] } });
  await db.saveJson('konten', { konten: [
    await konto('k1', 'erste', 'inhaber', faktor(G.erste)),
    await konto('k2', 'zweite', 'mitglied', { ...faktor(G.zweite), eingeladenVon: 'erste' }),
    await konto('k3', 'dritte', 'mitglied', { eingeladenVon: 'erste' }),
    await konto('k4', 'partner', 'mitglied', { ...faktor(G.partner), finanzRecht: 'business' }),
    await konto('k5', 'fremd', 'mitglied', { ...faktor(G.fremd), haushalt: 'anderer-haus' }),
    await konto('k6', 'kunde', 'mitglied', { haushalt: undefined }),
  ], einladungen: [] });
  // Das Mac-Adressbuch des Haupt-Inhabers (Spiegel vom Zulieferer) — darf beim zweiten Inhaber nie ankommen.
  await db.saveJson('apple-contacts-cache', { daten: { kontakte: [{ id: 'mac-0', name: 'MARKE-ADRESSBUCH-HAUPT' }], anzahl: 1 }, at: new Date().toISOString(), quelle: 'zulieferung' });
}, 60_000);
afterAll(async () => {
  globalThis.fetch = echtesFetch;
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten();
  rmSync(ordner, { recursive: true, force: true });
});

const kontenStand = async () => (await db.loadJson<{ konten: { speicher: string; rolle: string; haushalt?: string }[]; einstellungen?: { hauptInhaber?: string } }>('konten'))!;

describe('(2) Route POST /api/konto/haushalt — ernennen und abgeben', () => {
  it('Dienstweg (auch „im Auftrag“) → 403, Mitglied → 403, ohne Aktion → 400', async () => {
    expect((await rufe('konto/haushalt', dienst('erste'), 'POST', { aktion: 'inhaber', speicher: 'zweite', passwort: PW })).status).toBe(403);
    expect((await rufe('konto/haushalt', dienst(), 'POST', { aktion: 'inhaber', speicher: 'zweite', passwort: PW })).status).toBe(403);
    expect((await rufe('konto/haushalt', sitzung('zweite'), 'POST', { aktion: 'inhaber', speicher: 'dritte', passwort: PW })).status).toBe(403);
    expect((await rufe('konto/haushalt', sitzung('erste'), 'POST', {})).status).toBe(400);
  });

  it('Regeln vor dem Passwort: ohne zweiten Faktor 409, anderer Haushalt 400, „nur Business“ 409 — nichts geändert', async () => {
    const vorher = JSON.stringify(await kontenStand());
    expect(await rufe('konto/haushalt', sitzung('erste'), 'POST', { aktion: 'inhaber', speicher: 'dritte' })).toMatchObject({ status: 409, d: { fehler: expect.stringContaining('zweiten Faktor') } });
    expect((await rufe('konto/haushalt', sitzung('erste'), 'POST', { aktion: 'inhaber', speicher: 'fremd' })).status).toBe(400);
    expect((await rufe('konto/haushalt', sitzung('erste'), 'POST', { aktion: 'inhaber', speicher: 'partner' })).status).toBe(409);
    expect((await rufe('konto/haushalt', sitzung('erste'), 'POST', { aktion: 'abgeben', passwort: PW })).status).toBe(409); // letzter Inhaber
    expect(JSON.stringify(await kontenStand())).toBe(vorher);
  });

  it('erst nach Passwort UND Code; dann Rolle, festgeschriebener Haupt-Inhaber, Glocke an beide Inhaber, Anmeldeprotokoll', async () => {
    expect((await rufe('konto/haushalt', sitzung('erste'), 'POST', { aktion: 'inhaber', speicher: 'zweite', passwort: 'falsch-falsch' })).status).toBe(403);
    expect(await rufe('konto/haushalt', sitzung('erste'), 'POST', { aktion: 'inhaber', speicher: 'zweite', passwort: PW })).toMatchObject({ status: 403, d: { zweiterFaktor: true } });
    expect((await kontenStand()).konten.find(x => x.speicher === 'zweite')?.rolle).toBe('mitglied');
    const r = await rufe('konto/haushalt', sitzung('erste'), 'POST', { aktion: 'inhaber', speicher: 'zweite', passwort: PW, code: code('erste') });
    expect(r.status, JSON.stringify(r.d)).toBe(200);
    expect(r.d.inhaber).toEqual(['erste', 'zweite']);
    const st = await kontenStand();
    expect(st.konten.find(x => x.speicher === 'zweite')?.rolle).toBe('inhaber');
    expect(st.einstellungen?.hauptInhaber).toBe('erste');
    for (const p of ['erste', 'zweite']) expect(JSON.stringify(await db.loadJson(`meldungen--${p}`)), p).toContain('hat jetzt die Inhaber-Rolle');
    expect(JSON.stringify(await db.loadJson('meldungen--dritte'))).not.toContain('Inhaber-Rolle');
    expect(JSON.stringify(await db.loadJson('anmeldungen'))).toContain('inhaber-ernennen');
  });

  it('GET zeigt beide Inhaber, den Haupt-Inhaber und den Haushalt; der Haushalt mehrerer Inhaber bleibt fest (409)', async () => {
    const g = await rufe('konto/haushalt', sitzung('zweite'));
    expect(g.status).toBe(200);
    expect(g.d.haushalt).toBe('haus-probe');
    const konten = g.d.konten as { speicher: string; rolle: string; hauptInhaber?: boolean; zweiterFaktorAn: boolean }[];
    expect(konten.filter(x => x.rolle === 'inhaber').map(x => x.speicher)).toEqual(['erste', 'zweite']);
    expect(konten.find(x => x.hauptInhaber)?.speicher).toBe('erste');
    expect(JSON.stringify(g.d)).not.toMatch(/hash|salz|geheimnis/);
    expect((await rufe('konto/haushalt', sitzung('zweite'), 'PUT', { speicher: 'erste', haushalt: null })).status).toBe(409);
    expect((await rufe('konto/haushalt', sitzung('erste'), 'PUT', { speicher: 'zweite', haushalt: 'anderer-haus' })).status).toBe(409);
    expect((await kontenStand()).konten.find(x => x.speicher === 'zweite')?.haushalt).toBe('haus-probe');
  });

  it('konto/ich nennt Inhaber-Recht und Haupt-Inhaber', async () => {
    expect((await rufe('konto/ich', sitzung('zweite'))).d).toMatchObject({ inhaber: true, hauptInhaber: false });
    expect((await rufe('konto/ich', sitzung('erste'))).d).toMatchObject({ inhaber: true, hauptInhaber: true });
    expect((await rufe('konto/ich', sitzung('dritte'))).d).toMatchObject({ inhaber: false, hauptInhaber: false });
  });
});

/** Methoden der Klasse `inhaber` aus dem Routen-Register. */
async function inhaberMethoden(): Promise<[string, Methode][]> {
  const { ROUTEN_REGISTER, basisVon } = await import('@/lib/zugang/routen-register');
  return Object.entries(ROUTEN_REGISTER).flatMap(([pfad, e]) => (Object.entries(e.methoden) as [Methode, string][]).filter(([, kl]) => basisVon(kl as never) === 'inhaber').map(([m]) => [pfad, m] as [string, Methode]));
}
/** Bewusst nur beim Haupt-Inhaber (Persönliches an seinem Gerät). */
const NUR_HAUPT: Record<string, string> = {
  'apple-contacts': 'Mac-Adressbuch des Haupt-Inhabers (auch Privates)',
  zulieferer: 'Mac-Zulieferer: Erinnerungen und Adressbuch vom Gerät des Haupt-Inhabers, Übernahme als seine Aufgaben',
};
/** Schon vorher nicht nur für Inhaber (die Route prüft nur das Erzwingen) — Befund, nicht Teil dieses Pakets. */
const LOSE: Record<string, string> = { 'loop/verbesserung POST': 'ohne ?jetzt=1 für jede Person im Haushalt offen' };

describe('(3) Routen-Register: der zweite Inhaber darf alles, was der erste darf — ein Mitglied nicht', () => {
  it('jede Methode der Klasse „inhaber“: gleicher Status wie beim ersten bzw. nie 401/403; Mitglied 401/403', async () => {
    const liste = await inhaberMethoden();
    expect(liste.length).toBeGreaterThan(20);
    const abweichend: string[] = [];
    for (const [pfad, m] of liste) {
      const body = m === 'GET' ? undefined : {};
      const s1 = (await rufe(pfad, sitzung('erste'), m, body)).status;
      const s2 = (await rufe(pfad, sitzung('zweite'), m, body)).status;
      const s3 = (await rufe(pfad, sitzung('dritte'), m, body)).status;
      if (NUR_HAUPT[pfad]) {
        if (!(s1 !== 401 && s1 !== 403 && s2 === 403 && s3 === 403)) abweichend.push(`${pfad} ${m}: nur Haupt erwartet — ${s1}/${s2}/${s3}`);
        continue;
      }
      if (!(s2 === s1 || (s2 !== 401 && s2 !== 403))) abweichend.push(`${pfad} ${m}: erste ${s1}, zweite ${s2}`);
      // 404 für alle = die Route gibt es auf dieser Instanz nicht (Demo-Riegel ohne MAKE_OS_DEMO) — kein Zugang für irgendwen.
      if (!LOSE[`${pfad} ${m}`] && ![401, 403].includes(s3) && !(s1 === 404 && s3 === 404)) abweichend.push(`${pfad} ${m}: Mitglied ${s3}`);
    }
    expect(abweichend).toEqual([]);
  }, 300_000);

  it('Inhaber-Routen (Stichprobe) antworten der zweiten Inhaberin wirklich (200)', async () => {
    for (const [pfad, m] of [['konto/haushalt', 'GET'], ['konto/einstellungen', 'GET'], ['datenschutz/pannen', 'GET'], ['datenschutz/nachweise', 'GET'], ['client-fehler', 'GET'], ['intern/absichten', 'GET']] as [string, Methode][]) {
      expect((await rufe(pfad, sitzung('zweite'), m)).status, pfad).toBe(200);
    }
    expect((await rufe('konto/einladen', sitzung('zweite'), 'POST', {})).status).toBe(200);
    const mac = await rufe('apple-contacts', sitzung('zweite'));
    expect(JSON.stringify(mac.d)).not.toContain('MARKE-ADRESSBUCH-HAUPT');
  });

  it('Einzel-Wiederherstellung: kein Inhaber liest persönliche Bestände einer anderen Person (Verwaltung, nicht Einsicht)', async () => {
    const pfad = (b: string) => `intern/wiederherstellen?bestand=${b}`;
    const hol = async (p: string, b: string) => (await (await route('intern/wiederherstellen')).GET!(new Request(`http://test/api/${pfad(b)}`, { headers: sitzung(p) }))).status;
    expect(await hol('zweite', 'vitals--erste')).toBe(403);
    expect(await hol('zweite', 'gesundheit-koerper--erste')).toBe(403);
    expect(await hol('erste', 'vitals--zweite')).toBe(403);
    expect(await hol('erste', 'vitals--erste')).toBe(200);
    expect(await hol('zweite', 'zeit--zweite')).toBe(200);
    expect(await hol('zweite', 'tasks')).toBe(200);
    const post = await (await route('intern/wiederherstellen')).POST!(anfrage('intern/wiederherstellen', sitzung('zweite'), 'POST', { bestand: 'zeit--erste', tag: '2026-10-01', liste: 'bloecke', auswahl: {} }));
    expect(post.status).toBe(403);
  });

  it('Haushalt des Inhabers: Partner („nur Business“) und fremder Haushalt bleiben draußen', async () => {
    expect((await rufe('konto/haushalt', sitzung('partner'))).status).toBe(403);
    expect((await rufe('konto/haushalt', sitzung('fremd'))).status).toBe(403);
    expect((await rufe('state/buchungen', sitzung('partner'))).status).toBe(403);
  });
});

describe('(2b) Abgeben', () => {
  it('der Haupt-Inhaber nie (409); der weitere Inhaber mit Passwort + Code; danach wieder Mitglied ohne Inhaber-Rechte', async () => {
    expect(await rufe('konto/haushalt', sitzung('erste'), 'POST', { aktion: 'abgeben', passwort: PW, code: code('erste', 1) })).toMatchObject({ status: 409, d: { fehler: expect.stringContaining('Haupt-Inhaber') } });
    expect((await rufe('konto/haushalt', sitzung('zweite'), 'POST', { aktion: 'abgeben', passwort: PW })).status).toBe(403);
    const r = await rufe('konto/haushalt', sitzung('zweite'), 'POST', { aktion: 'abgeben', passwort: PW, code: code('zweite') });
    expect(r.status, JSON.stringify(r.d)).toBe(200);
    expect((await kontenStand()).konten.find(x => x.speicher === 'zweite')?.rolle).toBe('mitglied');
    expect((await rufe('konto/haushalt', sitzung('zweite'))).status).toBe(403);
    expect(JSON.stringify(await db.loadJson('meldungen--zweite'))).toContain('hat die Inhaber-Rolle abgegeben');
    expect(JSON.stringify(await db.loadJson('anmeldungen'))).toContain('inhaber-abgeben');
    expect((await rufe('konto/haushalt', sitzung('erste'), 'POST', { aktion: 'abgeben', passwort: PW, code: code('erste', 1) })).status).toBe(409); // letzter
  });
});

describe('Haupt-Inhaber an den Stellen, die genau einen brauchen', () => {
  it('Systemlauf-Person, Altbestand ohne Suffix, Kalender-Haupt-Person: der Haupt-Inhaber — auch mit einer zweiten Inhaberin', async () => {
    const st = await kontenStand();
    await db.saveJson('konten', { ...st, konten: st.konten.map(x => (x.speicher === 'zweite' ? { ...x, rolle: 'inhaber' } : x)) });
    try {
      const { inhaberSpeicher, alleInhaberSpeicher, haushaltDesInhabers } = await import('@/lib/zugang/haushalt-inhaber');
      expect(await inhaberSpeicher()).toBe('erste');
      expect(await alleInhaberSpeicher()).toEqual(['erste', 'zweite']);
      expect(await haushaltDesInhabers()).toBe('haus-probe');
      const { laufPerson } = await import('@/lib/finanzen/haushalt/zugriff');
      expect(await laufPerson(new Request('http://test/', { headers: dienst() }))).toBe('erste');
      const { hauptPerson } = await import('@/lib/kalender/icloud-person');
      delete process.env.ICLOUD_PERSON;
      expect(await hauptPerson()).toBe('erste');
      const { haushaltsPersonen } = await import('@/lib/aufgaben/sicht');
      expect((await haushaltsPersonen()).map(p => p.speicher).slice(0, 2)).toEqual(['erste', 'zweite']);
      const { kontenDesHaushalts } = await import('@/lib/make-one/team-speicher');
      const { teamZusammen, delegierbar } = await import('@/lib/make-one/team-typen');
      // Delegation: nur der Haupt-Inhaber delegiert — die zweite Inhaberin bleibt delegierbar wie vorher als Mitglied.
      const team = teamZusammen(await kontenDesHaushalts('haus-probe'), []).team;
      expect(delegierbar(team).some(p => p.speicher === 'zweite')).toBe(true);
      expect(delegierbar(team).some(p => p.speicher === 'erste')).toBe(false);
    } finally { await db.saveJson('konten', st); }
  });
});

describe('(4) deploy/ssh-schluessel-hinzufuegen.sh', () => {
  const skript = path.join(WURZEL, 'deploy/ssh-schluessel-hinzufuegen.sh');
  const ssh = path.join(ordner, 'ssh');
  const datei = path.join(ssh, 'home', '.ssh', 'authorized_keys');
  const lauf = (...args: string[]) => spawnSync('bash', [skript, ...args], { env: { ...process.env, AUTHORIZED_KEYS: datei }, encoding: 'utf8' });
  const schluessel = (name: string) => {
    spawnSync('ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-f', path.join(ssh, name), '-C', `${name}-test`]);
    return readFileSync(path.join(ssh, `${name}.pub`), 'utf8').trim();
  };
  const hatKeygen = spawnSync('ssh-keygen', ['-?']).error === undefined;

  it('ist gültiges Bash und trägt keine Werte im Repo', () => {
    expect(spawnSync('bash', ['-n', skript]).status).toBe(0);
    const q = readFileSync(skript, 'utf8');
    expect(q).not.toMatch(/AAAA[A-Za-z0-9+/]{20,}/);
    expect(q).not.toMatch(/\d+\.\d+\.\d+\.\d+|sslip|makeinnovation/);
    expect(q).toMatch(/AUTHORIZED_KEYS:-\/home\/make\/\.ssh\/authorized_keys/);
  });

  it.skipIf(!hatKeygen)('trägt einen eigenen Schlüssel ein — kein Doppel, keine Optionen, Ausroll-Schlüssel unberührt, nie der letzte', () => {
    mkdirSync(path.dirname(datei), { recursive: true });
    const a = schluessel('a'), b = schluessel('b'), c = schluessel('c');
    const ausrollen = `command="/srv/make-os/app/deploy/ausrollen.sh",restrict ${c}`;
    writeFileSync(datei, `${a}\n${ausrollen}\n`);
    expect(lauf(b).status).toBe(0);
    let inhalt = readFileSync(datei, 'utf8');
    expect(inhalt.split('\n').filter(Boolean)).toEqual([a, ausrollen, b]);
    // Kein Doppel — auch nicht mit anderem Kommentar.
    expect(lauf(b).stdout).toMatch(/Schon eingetragen/);
    expect(lauf(b.replace('b-test', 'anderer-kommentar')).status).toBe(0);
    expect(readFileSync(datei, 'utf8')).toBe(inhalt);
    // Optionen davor, kaputte Zeilen, der Ausroll-Schlüssel als Admin → Abbruch, nichts geändert.
    for (const falsch of [`command="x" ${b}`, 'kaputt', c, `${a}\n${b}`]) expect(lauf(falsch).status, falsch.slice(0, 30)).not.toBe(0);
    expect(readFileSync(datei, 'utf8')).toBe(inhalt);
    expect(lauf('--liste').stdout).toMatch(/2 Admin-Schlüssel/);
    // Entfernen: genau diesen; nie den Ausroll-Schlüssel; nie den letzten Admin-Schlüssel.
    expect(lauf('--entfernen', c).status).not.toBe(0);
    expect(lauf('--entfernen', b).status).toBe(0);
    inhalt = readFileSync(datei, 'utf8');
    expect(inhalt.split('\n').filter(Boolean)).toEqual([a, ausrollen]);
    expect(lauf('--entfernen', a).status).not.toBe(0);
    expect(readFileSync(datei, 'utf8')).toBe(inhalt);
  });
});
