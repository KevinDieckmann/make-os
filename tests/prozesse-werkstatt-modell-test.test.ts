// ─── Prozesse · Werkstatt bau-fertig — „Modell wirklich fragen“ an einem Agenten-Schritt (22.10.) ──────────────────────────────────────────────────────────
// Eigener Datenordner, erfundene Daten, askText/askWithSearch nachgebaut (kein Netz). Geprüft: vor dem Klick die Schätzung und warum nicht (ohne KI-Schlüssel, Budget
// erschöpft, Art. 18); der Aufruf geht über den Agenten-Weg des Laufs (KI-Art „aufruf“, Person der Sitzung), „nur öffentliche Angaben“ schickt nur Name/Website/Branche
// der (erfundenen) Firma; das Ergebnis kommt NUR an die Ansicht zurück — kein Vorschlag im Stapel, keine Aufgabe, nichts an der Akte; gebucht werden nur die Kosten.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AgentSchritt, ProzessDefinition, ProzessEintrag } from '@/lib/prozesse/definition';
import { definition, fk, schritt, konto, PZ, PZ2, J } from './fixtures/prozess-bau';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-prozesse-modelltest-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-prozesse-modelltest';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.ANTHROPIC_API_KEY;

const aufrufe: { system: string; user: string; ki?: { lauf?: string; person?: string | null; kategorien?: string[] } }[] = [];
let schluessel = false;
vi.mock('@/lib/anthropic', async orig => {
  const o = await orig<typeof import('@/lib/anthropic')>();
  const antwort = async (opt: (typeof aufrufe)[number]) => { aufrufe.push(opt); return { ok: true, status: 200, text: JSON.stringify({ ergebnis: 'Passt gut zum Profil.', werte: { passt: true } }), usage: { ein: 1200, aus: 300, cacheLesen: 0, cacheSchreiben: 0 }, raw: {} }; };
  return { ...o, hasAnthropicKey: () => schluessel, guthabenLeer: () => false, askText: vi.fn(antwort), askWithSearch: vi.fn(antwort) };
});

const H = 'haus-modelltest';
const PZ3 = 'pz-00000000-0000-4000-8000-000000000003';
const sitzung = (person: string) => ({ 'x-make-user': person, 'content-type': 'application/json' });
const dienst = (person?: string) => ({ 'x-make-key': process.env.MAKE_OS_KEY!, ...(person ? { 'x-make-person': person } : {}), 'content-type': 'application/json' });
let S: typeof import('@/lib/prozesse/lauf-server');

const AGENT: AgentSchritt = { wer: { art: 'head', headId: 'sales' }, auftrag: 'Passt der Lead?', modell: 'schnell', budgetCent: 30, gedaechtnis: { brain: false, akte: true }, werkzeuge: [],
  eingabe: [], ausgabe: [{ id: 'passt', art: 'ja-nein' }], warumKeineRegel: 'Die Einschätzung braucht Sprachverständnis — eine feste Regel reicht hier nicht.' };
const RECHERCHE: AgentSchritt = { wer: { art: 'fach', agentId: 'research' }, auftrag: 'Firma anreichern', modell: 'schnell', budgetCent: 30, gedaechtnis: { brain: false, akte: false },
  werkzeuge: [], eingabe: [], ausgabe: [], warumKeineRegel: 'Öffentliche Angaben stehen nur im Web — eine Regel kennt sie nicht.', ergebnis: 'vorschlag', vorschlagFelder: ['firma.branche'], nurOeffentlich: true };
const mitAgent = (a: AgentSchritt): ProzessDefinition => definition([schritt(40, 'Einschätzen', 1, { form: 'agent', agent: a }), schritt(41, 'Ende', 2, { form: 'ende', ende: { ergebnis: 'erfolg' } })], { laeuftAls: 'pia' });
const eintrag = (id: string, def: ProzessDefinition): ProzessEintrag => ({ id, entwurf: { ...def, id }, status: 'entwurf', angelegtAm: J, angelegtVon: 'pia', entwurfAm: J, entwurfVon: 'pia', versionen: [] });
function alleDateien(): Record<string, string> {
  const raus: Record<string, string> = {};
  const geh = (d: string) => { for (const n of readdirSync(d)) { const p = path.join(d, n); if (statSync(p).isDirectory()) geh(p); else raus[path.relative(ordner, p)] = readFileSync(p, 'utf8'); } };
  geh(ordner);
  return raus;
}

beforeAll(async () => {
  const db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [konto('k1', 'pia', 'inhaber', { haushalt: H })], einladungen: [] });
  const { leererBestand } = await import('@/lib/crm/speicher');
  await db.saveJson('crm', { ...leererBestand(), chancen: [{ id: 'ch-gesperrt', titel: 'Probe', kontaktIds: ['c-gesperrt'], stufe: 'qualifiziert', historie: [], wert: { betrag: 1000, basis: 'einmalig' }, art: 'projekt', gesellschaft: 'ug', besitzer: 'pia', angelegt: J, geaendert: J }] });
  await db.saveJson('kontakte', { kontakte: [{ id: 'c-gesperrt', vorname: 'Max', nachname: 'Muster', email: 'max@example.invalid', stufe: 'kontakt', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01', eingeschraenkt: { seit: '2026-10-01', grund: 'Antrag', von: 'pia' } }] });
  await db.saveJson('tasks', { tasks: [], projects: [] });
  const { prozesseBestand } = await import('@/lib/prozesse/definition');
  await db.saveJson(prozesseBestand(H), { v: 1, prozesse: [eintrag(PZ, mitAgent(AGENT)), eintrag(PZ2, mitAgent(RECHERCHE)), eintrag(PZ3, definition([schritt(10, 'Anrufen', 1)]))] });
  S = await import('@/lib/prozesse/lauf-server');
});
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten().catch(() => null);
  rmSync(ordner, { recursive: true, force: true });
});

const test = (o: Partial<Parameters<typeof S.modellTesten>[0]> = {}) => S.modellTesten({ prozessId: PZ, quelle: 'entwurf', fall: 'beispiel', person: 'pia', knoten: fk(40), fragen: false, ...o });

describe('„Modell wirklich fragen“ — vor dem Klick die Schätzung, sonst der Grund', () => {
  it('ohne KI-Schlüssel: Knopf erklärt warum, ein Klick ruft nichts', async () => {
    schluessel = false;
    const s = await test();
    expect(s).toMatchObject({ ok: true, art: 'schaetzung', bereit: false });
    expect(s.ok && s.art === 'schaetzung' && s.grund).toMatch(/KI-Schlüssel/);
    expect(await test({ fragen: true })).toMatchObject({ ok: false, status: 409 });
    expect(aufrufe).toHaveLength(0);
  });
  it('nur an einem Agenten-Schritt; Art. 18 am echten Fall → nicht', async () => {
    schluessel = true;
    expect(await S.modellTesten({ prozessId: PZ3, quelle: 'entwurf', fall: 'beispiel', person: 'pia', knoten: fk(10), fragen: false })).toMatchObject({ ok: false, status: 400 });
    const a = await test({ fall: { art: 'deal', id: 'ch-gesperrt' } });
    expect(a.ok && a.art === 'schaetzung' && a.bereit).toBe(false);
    expect(a.ok && a.art === 'schaetzung' && a.grund).toMatch(/Art\. 18/);
  });
});

describe('Der Aufruf — derselbe Agenten-Weg, Ergebnis nur in der Ansicht, gebucht nur die Kosten', () => {
  it('mit Schlüssel: Schätzung ca. x ct, dann EIN Aufruf als „aufruf“ der Person — kein Vorschlag, keine Aufgabe, an der Akte nichts', async () => {
    schluessel = true;
    const s = await test();
    expect(s).toMatchObject({ ok: true, art: 'schaetzung', bereit: true });
    expect(s.ok && s.art === 'schaetzung' && s.kostenCent).toBeGreaterThan(0);
    const vorher = alleDateien();
    const r = await test({ fragen: true });
    expect(r).toMatchObject({ ok: true, art: 'ergebnis', ergebnis: 'Passt gut zum Profil.', werte: { passt: true } });
    expect(aufrufe).toHaveLength(1);
    expect(aufrufe[0].ki).toMatchObject({ lauf: 'aufruf', person: 'pia' });
    const nachher = alleDateien();
    const geaendert = Object.keys(nachher).filter(k => nachher[k] !== vorher[k]);
    // Nur der Laufzeit-Stand des Prozesses (Monatskosten, Verlauf „modell-test“) — und das KI-Protokoll schreibt askText (hier nachgebaut).
    expect(geaendert.every(k => /prozess-laeufe--/.test(k))).toBe(true);
    for (const b of ['zoe-stapel', 'tasks', 'kontakte', 'crm']) expect(Object.keys(nachher).filter(k => k.startsWith(b) && nachher[k] !== vorher[k])).toEqual([]);
    const st = (await S.laeufeLesen(H)).prozesse[PZ];
    expect(st?.monat?.kostenCent).toBeGreaterThan(0);
    expect(st?.verlauf.at(-1)).toMatchObject({ was: 'modell-test', von: 'pia' });
    expect(JSON.stringify(st)).not.toContain('Passt gut');
  });
  it('Budget je Prozess erschöpft (ohne scharfes Budget das Test-Budget) → klare Meldung, kein Aufruf', async () => {
    const { LAUF_GRENZEN } = await import('@/lib/prozesse/lauf-typen');
    await S.laeufeAendern(d => ({ datei: { ...d, prozesse: { ...d.prozesse, [PZ]: { ...d.prozesse[PZ]!, monat: { monat: S.monatVon(new Date().toISOString()), kostenCent: LAUF_GRENZEN.modellTestBudgetCent } } } }, r: null }), H);
    const n = aufrufe.length;
    const s = await S.modellTesten({ prozessId: PZ, quelle: 'entwurf', fall: 'beispiel', person: 'pia', knoten: fk(40), fragen: false });
    expect(s.ok && s.art === 'schaetzung' && s.grund).toMatch(/erschöpft/);
    expect(await S.modellTesten({ prozessId: PZ, quelle: 'entwurf', fall: 'beispiel', person: 'pia', knoten: fk(40), fragen: true })).toMatchObject({ ok: false, status: 409 });
    expect(aufrufe.length).toBe(n);
  });
  it('„nur öffentliche Angaben“: an das Modell nur Name/Website/Branche der erfundenen Firma — nie der Fall', async () => {
    schluessel = true;
    const n = aufrufe.length;
    const r = await S.modellTesten({ prozessId: PZ2, quelle: 'entwurf', fall: 'beispiel', person: 'pia', knoten: fk(40), fragen: true });
    expect(r.ok).toBe(true);
    const a = aufrufe[n];
    expect(a.user).toContain('<daten quelle="firma">');
    expect(a.user).toContain('Beispiel GmbH');
    expect(a.user).not.toContain('quelle="fall"');
    expect(a.ki?.kategorien).toEqual(expect.arrayContaining(['web']));
    expect(a.ki?.kategorien).not.toContain('crm');
  });
});

describe('Route — nur auf eigenen Klick einer angemeldeten Person', () => {
  const probe = async (kopf: Record<string, string>, body: Record<string, unknown>) => {
    const { POST } = await import('@/app/api/prozesse/probelauf/route');
    const r = await POST(new Request('http://test/api/prozesse/probelauf?space=business', { method: 'POST', headers: kopf, body: JSON.stringify(body) }));
    return { status: r.status, j: await r.json() as Record<string, unknown> };
  };
  it('Dienstweg 403; ohne „nur“ bzw. unbekannte Art 400; Schätzung per Sitzung 200', async () => {
    expect((await probe(dienst('pia'), { prozessId: PZ, nur: fk(40), modell: 'fragen' })).status).toBe(403);
    expect((await probe(sitzung('pia'), { prozessId: PZ, modell: 'fragen' })).status).toBe(400);
    expect((await probe(sitzung('pia'), { prozessId: PZ, nur: fk(40), modell: 'immer' })).status).toBe(400);
    const s = await probe(sitzung('pia'), { prozessId: PZ, quelle: 'entwurf', fall: 'beispiel', nur: fk(40), modell: 'schaetzen' });
    expect(s.status).toBe(200);
    expect(s.j).toMatchObject({ ok: true, art: 'schaetzung' });
  });
});
