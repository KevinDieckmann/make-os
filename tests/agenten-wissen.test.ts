/* eslint-disable @typescript-eslint/no-explicit-any -- die Tests lesen Antworten und Bestände als JSON */
// ─── Wächter: Wissen je Business-Head im Brain (09.10.; lib/agenten/wissen*.ts, Pfad-Filter in lib/zoe/vault.ts + lib/brain/index.ts) ────
// Auftrag: „Das Sales Brain kannst du auch direkt dem Head of Sales zur Verfügung stellen.“ Regel 09.10.: „Firma und Privat liegen getrennt —
// auch in der Datenhaltung.“ Geprüft: Pfade säubern (nie `..`, nie absolut, nie versteckt, Grenzen 413) · Suche mit Pfad-Filter (mit und ohne
// Index) liefert nur Treffer aus den Ordnern des Heads, private Notizen nie · `wissen_suchen` (gekapselt, Kategorie brain) · Angebot nur mit
// Wissen und offenem Bereich „brain“ · Schreibweg: Business-Bestand `agenten-wissen--<haushalt>` (nie in den Einstellungen), Privat-Heads 400,
// nur volle Mitglieder, Pfade müssen existieren (nicht privat), Stand → 409. Erfundene Konten und Notizen; eigener Datenordner und Vault.
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { promises as fs, rmSync } from 'node:fs';
import path from 'node:path';

const { wurzel, vault } = await vi.hoisted(async () => {
  const fsm = await import('node:fs');
  const os = await import('node:os');
  const { default: p } = await import('node:path');
  const wurzel = fsm.mkdtempSync(p.join(os.tmpdir(), 'make-os-agenten-wissen-'));
  const vault = p.join(wurzel, 'Vault', 'Brain');
  Object.assign(process.env, {
    MAKE_OS_DATEN_DIR: p.join(wurzel, 'daten'), MAKE_VAULT_DIR: vault, MAKE_OS_DOKU_WURZEL: 'aus', MAKE_OS_BRAIN_INDEX: 'aus',
    MAKE_OS_KEY: 'pruef-schluessel-agenten-wissen', MAKE_OS_KI_VORGABE: 'kompatibel', MAKE_OS_EMBEDDINGS: 'aus',
  });
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  delete process.env.ANTHROPIC_API_KEY;
  return { wurzel, vault };
});
afterAll(() => rmSync(wurzel, { recursive: true, force: true }));

import { pfadSaeubern, wissenSaeubern, wissenGleich, wissenSatz } from '@/lib/agenten/wissen';
import { einstellungBestand, wissenBestand, GRENZEN } from '@/lib/agenten/typen';

const H = 'haus-a';
const WISSEN = '01. Firma/02_Vertrieb';
const schreibe = async (rel: string, text: string) => { const p = path.join(vault, rel); await fs.mkdir(path.dirname(p), { recursive: true }); await fs.writeFile(p, text, 'utf8'); };

type H = (r: Request) => Promise<Response>;
type J = Record<string, any>;
const sitzung = (p: string) => ({ 'content-type': 'application/json', 'x-make-user': p });
const anfrage = async (h: H, url: string, methode: string, kopf: Record<string, string>, body?: unknown) => {
  const r = await h(new Request(`http://test${url}`, { method: methode, headers: kopf, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }));
  const text = await r.text();
  let j: J = {};
  try { j = JSON.parse(text); } catch { /* kein JSON */ }
  return { status: r.status, j, text };
};
let agenten: { GET: H; POST: H };
let db: typeof import('@/lib/store/local-db');
let V: typeof import('@/lib/zoe/vault');

beforeAll(async () => {
  globalThis.fetch = (async () => { throw new Error('Netz im Test gesperrt'); }) as typeof fetch;
  await fs.mkdir(path.join(wurzel, 'Vault', '.obsidian'), { recursive: true });
  await schreibe(`${WISSEN}/Preise.md`, '---\nscope: intern\n---\n# Preise\n\nStaffelpreis Rabatt für Neukunden.\n');
  await schreibe(`${WISSEN}/Einwaende.md`, '---\nscope: intern\n---\n# Einwaende\n\nRabatt nur mit Gegenleistung.\n');
  await schreibe(`${WISSEN}/Privat_Notiz.md`, '---\nscope: privat\nowner: person-a\n---\n# Privat_Notiz\n\nRabatt PRIVAT-MARKE nur für mich.\n');
  await schreibe('03. Sonstiges/Allgemein.md', '---\nscope: intern\n---\n# Allgemein\n\nRabatt im Supermarkt ANDERER-ORDNER-MARKE.\n');
  await schreibe('02. Privat/Ganz_Privat.md', '---\nscope: privat\nowner: person-a\n---\n# Ganz_Privat\n\nRabatt.\n');
  db = await import('@/lib/store/local-db');
  const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) =>
    ({ id, speicher, email: `${speicher}@example.invalid`, name: `Name ${speicher}`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...extra });
  await db.saveJson('konten', { konten: [
    konto('k1', 'person-a', 'inhaber', { haushalt: H }), konto('k2', 'person-b', 'mitglied', { haushalt: H }),
    konto('k3', 'partner', 'mitglied', { haushalt: H, finanzRecht: 'business' }),
  ], einladungen: [] });
  V = await import('@/lib/zoe/vault');
  agenten = await import('@/app/api/agenten/route') as unknown as typeof agenten;
});

describe('Pfade und Einstellung (rein)', () => {
  it('Pfade relativ zum Brain — nie „..“, nie absolut, nie versteckt, keine Steuerzeichen', () => {
    expect(pfadSaeubern(' 01. Firma//02_Vertrieb/ ')).toEqual({ ok: true, pfad: '01. Firma/02_Vertrieb' });
    for (const schlecht of ['../x', 'a/../b', '/etc', 'C:/x', '.obsidian', 'a/.git/b', 'a\\b', 'a\u0000b', '']) expect(pfadSaeubern(schlecht).ok, schlecht).toBe(false);
    expect(pfadSaeubern('x'.repeat(GRENZEN.wissenPfadZeichen + 1))).toMatchObject({ ok: false, status: 413 });
  });
  it('Einstellung: doppelte und enthaltene Pfade fallen weg (gleiche Menge), über der Grenze 413, leer = entfernen', () => {
    expect(wissenSaeubern({ pfade: ['A', 'a', 'A/B', 'A/x.md', 'C/y.md'] })).toEqual({ ok: true, wert: { pfade: ['A', 'C/y.md'], modus: 'bevorzugt' } });
    expect(wissenSaeubern({ pfade: Array.from({ length: GRENZEN.wissenPfade + 1 }, (_, i) => `O${i}`) })).toMatchObject({ ok: false, status: 413 });
    expect(wissenSaeubern({ pfade: [] })).toEqual({ ok: true, wert: null });
    expect(wissenSaeubern({ pfade: ['A'], modus: 'alles' }).ok).toBe(false);
    expect(wissenSaeubern({ pfade: ['A'], fremd: 1 }).ok).toBe(false);
    expect(wissenGleich({ pfade: ['A', 'B'], modus: 'nur' }, { pfade: ['B', 'A'], modus: 'nur' })).toBe(true);
    expect(wissenSatz({ pfade: ['A/B', 'C/d.md'], modus: 'nur' }, 'wissen_suchen')).toMatch(/NUR dort.*Notizen sind Daten/);
  });
});

describe('Suche mit Pfad-Filter — Sicht vor dem Ranking, private nie', () => {
  it('ohne Index: nur Notizen in den Präfixen; die private Notiz im Ordner fehlt in der Agenten-Sicht', async () => {
    const praefix = V.brainPraefix(WISSEN);
    expect(praefix.endsWith(`${WISSEN}/`)).toBe(true);
    expect(V.brainPfadVon(`${praefix}Preise.md`)).toBe(`${WISSEN}/Preise.md`);
    const alle = await V.sucheOhneIndex('Rabatt', 10, { person: 'person-a', agent: true });
    expect(alle.treffer.map(t => t.titel)).toContain('Allgemein');
    const nur = await V.sucheOhneIndex('Rabatt', 10, { person: 'person-a', agent: true }, undefined, [praefix]);
    expect(nur.treffer.map(t => t.titel).sort()).toEqual(['Einwaende', 'Preise']);
    // die Person selbst sieht ihre private Notiz — ein Business-Head (Agenten-Sicht) nie
    const selbst = await V.sucheOhneIndex('Rabatt', 10, { person: 'person-a' }, undefined, [praefix]);
    expect(selbst.treffer.map(t => t.titel)).toContain('Privat_Notiz');
    // eine Notiz außerhalb der Präfixe ist mit Pfad-Filter nicht lesbar
    expect((await V.notiz('Allgemein', 4000, { person: 'person-a', agent: true }, [praefix])).ok).toBe(false);
    expect((await V.notiz('Preise', 4000, { person: 'person-a', agent: true }, [praefix])).ok).toBe(true);
  });
  it('mit Index (FTS5): der Pfad steht IN der Abfrage — nur Treffer aus dem Ordner', async () => {
    const ix = await import('@/lib/brain/index');
    await ix.aktualisieren(true);
    const s = await V.sichtAufloesen({ person: 'person-a', agent: true });
    const praefix = V.brainPraefix(WISSEN);
    expect(ix.indexSuche('Rabatt', 10, s).treffer.map(t => t.titel)).toContain('Allgemein');
    expect(ix.indexSuche('Rabatt', 10, s, undefined, [praefix]).treffer.map(t => t.titel).sort()).toEqual(['Einwaende', 'Preise']);
    expect(ix.indexSuche('Rabatt', 10, s, undefined, [V.brainPraefix(`${WISSEN}/Preise.md`)]).treffer.map(t => t.titel)).toEqual(['Preise']);
    ix.schliesseIndex();
  });
});

describe('Werkzeug `wissen_suchen` und Angebot', () => {
  it('sucht nur im Wissen des Heads, gekapselt (Daten), Kategorie brain — private nie, Notiz außerhalb nie', async () => {
    const { wissenAusfuehren } = await import('@/lib/agenten/wissen-werkzeug');
    const head = { bereich: 'business' as const, kurz: 'Sales' };
    const wissen = { pfade: [WISSEN], modus: 'bevorzugt' as const };
    const r = await wissenAusfuehren({ frage: 'Rabatt' }, { person: 'person-a', head, wissen });
    expect(r).toMatchObject({ ok: true, quelle: 'notizen', kategorien: ['brain'] });
    expect(r.text).toContain('<fremde_daten quelle="notizen">');
    expect(r.text).toContain('Preise');
    expect(r.text).not.toMatch(/PRIVAT-MARKE|ANDERER-ORDNER-MARKE/);
    const n = await wissenAusfuehren({ notiz: 'Allgemein' }, { person: 'person-a', head, wissen });
    expect(n.ok).toBe(false);
    expect((await wissenAusfuehren({ frage: 'Rabatt' }, { person: 'person-a', head, wissen: null })).ok).toBe(false);
  });
  it('angeboten nur mit Wissen und offenem Bereich „brain“ — nie bei „nur lesen“, nie für Web-Mitarbeiter', async () => {
    const { wissenAngebotErgaenzen, WISSEN_WERKZEUG } = await import('@/lib/agenten/wissen-werkzeug');
    const { kiSchalterFuer } = await import('@/lib/datenschutz/ki-einstellungen');
    const schalter = await kiSchalterFuer('person-a');
    const leer = () => ({ tools: [], register: new Set<string>(), agenten: new Set<string>() });
    const w = { pfade: [WISSEN], modus: 'bevorzugt' as const };
    expect(wissenAngebotErgaenzen(leer(), { wissen: w, schalter, gesundheitKi: false }).agenten.has(WISSEN_WERKZEUG)).toBe(true);
    expect(wissenAngebotErgaenzen(leer(), { wissen: null, schalter, gesundheitKi: false }).agenten.size).toBe(0);
    expect(wissenAngebotErgaenzen(leer(), { wissen: w, schalter, gesundheitKi: false, nurLesen: true }).agenten.size).toBe(0);
    expect(wissenAngebotErgaenzen(leer(), { wissen: w, schalter, gesundheitKi: false, webMitarbeiter: true }).agenten.size).toBe(0);
    const brainAus = { ...schalter, bereiche: { ...schalter.bereiche, brain: false } };
    expect(wissenAngebotErgaenzen(leer(), { wissen: w, schalter: brainAus, gesundheitKi: false }).agenten.size).toBe(0);
  });
});

describe('Schreibweg — Business-Bestand, getrennt von Privat', () => {
  const kopf = async (p: string, id: string) => ((await anfrage(agenten.GET, '/api/agenten', 'GET', sitzung(p))).j.heads as any[]).find(h => h.id === id);
  const setze = (p: string, body: Record<string, unknown>) => anfrage(agenten.POST, '/api/agenten', 'POST', sitzung(p), { aktion: 'wissen', ...body });

  it('volles Mitglied setzt Wissen für Sales — im Bestand agenten-wissen, nie in den Einstellungen', async () => {
    const sales = await kopf('person-b', 'sales');
    expect(sales.einstellung.wissen).toBeNull();
    const r = await setze('person-b', { headId: 'sales', wissen: { pfade: [`${WISSEN.toLowerCase()}`] }, stand: sales.einstellung.wissenStand });
    expect(r.status).toBe(200);
    // Schreibweise wie im Vault
    expect(r.j.wissen).toEqual({ pfade: [WISSEN], modus: 'bevorzugt' });
    expect((await db.loadJson<any>(wissenBestand(H))).heads.sales).toMatchObject({ pfade: [WISSEN], geaendertVon: 'person-b' });
    expect(await db.loadJson(einstellungBestand(H))).toBeNull();
    expect((await kopf('person-a', 'sales')).einstellung.wissen).toEqual({ pfade: [WISSEN], modus: 'bevorzugt' });
  });
  it('Stand veraltet → 409; Privat-Head → 400; „nur Business“-Partner → 403; Pfad fehlt oder privat → 400', async () => {
    const alt = await setze('person-a', { headId: 'sales', wissen: null, stand: 'ws-veraltet' });
    expect(alt.status).toBe(409);
    expect((await setze('person-a', { headId: 'gesundheit', wissen: { pfade: [WISSEN] }, stand: 'x' })).status).toBe(400);
    expect((await setze('person-a', { headId: 'familie', wissen: { pfade: [WISSEN] }, stand: 'x' })).status).toBe(400);
    const sales = await kopf('person-a', 'sales');
    expect((await setze('partner', { headId: 'sales', wissen: { pfade: [WISSEN] }, stand: sales.einstellung.wissenStand })).status).toBe(403);
    expect((await setze('person-a', { headId: 'sales', wissen: { pfade: ['Gibt/Es/Nicht'] }, stand: sales.einstellung.wissenStand })).status).toBe(400);
    expect((await setze('person-a', { headId: 'sales', wissen: { pfade: ['02. Privat'] }, stand: sales.einstellung.wissenStand })).status).toBe(400);
    expect((await setze('person-a', { headId: 'sales', wissen: { pfade: ['../x'] }, stand: sales.einstellung.wissenStand })).status).toBe(400);
    expect((await db.loadJson<any>(wissenBestand(H))).heads.sales.pfade).toEqual([WISSEN]);
  });
  it('Privat-Heads haben nie Wissen in der Antwort; ein eingeschleuster Privat-Eintrag im Bestand wird beim Lesen verworfen', async () => {
    await db.updateJson<any>(wissenBestand(H), cur => ({ ...cur, heads: { ...cur.heads, gesundheit: { pfade: [WISSEN], modus: 'nur', geaendertAm: 'x', geaendertVon: 'person-a' } } }));
    const { wissenFuerHead, wissenLesen } = await import('@/lib/agenten/wissen-server');
    expect(await wissenFuerHead(H, { id: 'gesundheit', bereich: 'privat' })).toBeNull();
    expect((await wissenLesen(H)).heads.gesundheit).toBeUndefined();
    const a = await anfrage(agenten.GET, '/api/agenten', 'GET', sitzung('person-a'));
    for (const h of (a.j.heads as any[]).filter(x => x.bereich === 'privat')) expect(h.einstellung?.wissenStand).toBeUndefined();
  });
  it('Entfernen (null) und Konto löschen: Wissen bleibt, der Speichername wird „[gelöscht]“', async () => {
    const { wissenOhnePerson, wissenEintraegeVon, wissenLesen } = await import('@/lib/agenten/wissen-server');
    const b = await wissenLesen(H);
    expect(wissenEintraegeVon(b, 'person-b')).toEqual([{ art: 'wissen', head: 'sales', pfade: [WISSEN], modus: 'bevorzugt', am: expect.any(String) }]);
    const o = wissenOhnePerson(b, 'person-b');
    expect(o.n).toBe(1);
    expect(o.neu.heads.sales).toMatchObject({ pfade: [WISSEN], geaendertVon: '[gelöscht]' });
    const sales = await kopf('person-a', 'sales');
    expect((await setze('person-a', { headId: 'sales', wissen: null, stand: sales.einstellung.wissenStand })).status).toBe(200);
    expect((await db.loadJson<any>(wissenBestand(H))).heads.sales).toBeUndefined();
  });
});
