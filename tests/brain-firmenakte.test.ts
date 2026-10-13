// ─── Brain-Tagesbericht und _App-Spiegel: Aufgaben der Firmen-Akte nur als Zahl (12.10., Restpunkt Sicht-Trennung) ─────────
// Das Brain liest jedes Konto des Haushalts — auch eines „nur Business“ OHNE Zugang zur Firmen-Akte. Tagesbericht und Spiegel
// sammeln aber mit der Systemsicht der Aufgaben (keine Konto-Sicht) und nannten so Klartext-Titel der Firmen-Akte-Aufgaben
// („Jahresabschluss feststellen — <Gesellschaft> …“). Jetzt: nur „n Pflichten aus der Firmen-Akte erledigt/offen“, wie beim Privat-Bereich
// (`privat: 'anzahl'`), auch bei der Stufe „voll“. Eigener Datenordner, erfundene Daten, kein Vault, kein Modell.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

const daten = await fs.mkdtemp(path.join(os.tmpdir(), 'make-os-brain-akte-'));
process.env.MAKE_OS_DATEN_DIR = daten;
process.env.MAKE_OS_DOKU_WURZEL = 'aus';
process.env.MAKE_OS_BRAIN_INDEX = path.join(daten, 'brain-index.sqlite');
process.env.MAKE_OS_EMBEDDINGS = 'aus';
process.env.MAKE_OS_KEY = 'pruef-schluessel-brain-akte';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

const { localDay } = await import('@/lib/zeit');
const H = localDay();
const J = new Date().toISOString();
const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) =>
  ({ id, speicher, email: `${speicher}@test.invalid`, name: speicher, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'haus', ...extra });
const aufgabe = (id: string, title: string, x: Record<string, unknown> = {}) => ({ id, projectId: 'p-web', title, status: 'todo', priority: 'medium', assignee: 'kevin', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: J, updatedAt: J, spaceId: 'kdv', ...x });
const GEHEIM = ['AKTE-ABSCHLUSS-GEHEIM', 'AKTE-VERTRAG-GEHEIM', 'AKTE-RECHT-GEHEIM', 'AKTE-BESCHLUSS-GEHEIM', 'AKTE-UNTER-GEHEIM', 'Gesellschaft-GEHEIM'];

type AppDaten = import('@/lib/brain/app-material').AppDaten;
let M: typeof import('@/lib/brain/app-material');
let B: typeof import('@/lib/brain/app-bericht');
let S: typeof import('@/lib/brain/app-spiegel');
let d: AppDaten;

beforeAll(async () => {
  const db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'inhaber'), konto('k2', 'fiona', 'mitglied', { finanzRecht: 'business' })], einladungen: [] });
  await db.saveJson('kontakte', { kontakte: [] });
  await db.saveJson('tasks', {
    projects: [{ id: 'p-web', title: 'Webseite Relaunch', category: 'business', owner: 'kevin', color: '#fff', tags: [], archived: false, spaceId: 'kdv', createdAt: J, updatedAt: J }],
    tasks: [
      aufgabe('t-fertig', 'Startseite abnehmen', { status: 'done', completedAt: J }),
      aufgabe('t-offen', 'Impressum ergänzen'),
      // Die Aufgaben der Firmen-Akte (Kennungen ihrer Erzeuger, lib/aufgaben/firmenakte-sicht.ts) — Klartext-Titel, in „Sonstige“ der Gesellschaft.
      aufgabe('usp-ug-abschluss-2026', 'AKTE-ABSCHLUSS-GEHEIM feststellen — Gesellschaft-GEHEIM — bis 31.12.', { projectId: 'sonstige-ug', spaceId: 'ug', status: 'done', completedAt: J }),
      aufgabe('rcw-check-1', 'AKTE-RECHT-GEHEIM prüfen', { projectId: 'sonstige-ug', spaceId: 'ug', status: 'done', completedAt: J }),
      aufgabe('vte-vertrag-1', 'AKTE-VERTRAG-GEHEIM kündigen bis 30.11.', { projectId: 'sonstige-ug', spaceId: 'ug' }),
      aufgabe('bfc-beschluss-1', 'AKTE-BESCHLUSS-GEHEIM Cap-Table anpassen', { projectId: 'sonstige-kdv', spaceId: 'kdv' }),
      // Von Hand darunter angelegt: erbt die Firmen-Akte über die Kette.
      aufgabe('u-1', 'AKTE-UNTER-GEHEIM', { projectId: 'sonstige-ug', spaceId: 'ug', parentId: 'vte-vertrag-1' }),
    ],
    listen: [], statusEigen: [], gruppen: [], vorlagen: [],
  });
  M = await import('@/lib/brain/app-material');
  B = await import('@/lib/brain/app-bericht');
  S = await import('@/lib/brain/app-spiegel');
  const geladen = await M.appDatenLaden(H);
  if (!geladen) throw new Error('Kein Haushalt des Inhabers im Test-Bestand.');
  d = geladen;
});
afterAll(async () => { await fs.rm(daten, { recursive: true, force: true }); });

describe('Firmen-Akte im Brain: nur Zahlen', () => {
  it('die Systemsicht enthält die Akte-Aufgaben noch (Ausgangslage) — die Kette erkennt auch Unteraufgaben', () => {
    expect(d.state.tasks.map(t => t.id)).toEqual(expect.arrayContaining(['usp-ug-abschluss-2026', 'vte-vertrag-1', 'u-1']));
    const ids = M.firmenAkteIds(d.state);
    expect([...ids].sort()).toEqual(['bfc-beschluss-1', 'rcw-check-1', 'u-1', 'usp-ug-abschluss-2026', 'vte-vertrag-1']);
    expect(M.firmenAkteAufgabe({ id: 't-fertig' }, d)).toBe(false);
  });

  it('Tagesbericht: kein Titel der Firmen-Akte, dafür „2 Pflichten aus der Firmen-Akte erledigt“; normale Aufgaben bleiben', () => {
    const text = B.berichtText(d, H)!;
    expect(text).toContain('Startseite abnehmen');
    expect(text).toContain('2 Pflichten aus der Firmen-Akte erledigt (nur als Anzahl)');
    for (const geheim of GEHEIM) expect(text, geheim).not.toContain(geheim);
    expect(text).not.toContain('usp-ug');
    expect(text).not.toContain('sonstige-ug');
    // Sie zählen nicht als „ausgeblendet wegen Art. 18 / nur ich“.
    expect(text).not.toContain('ausgeblendet');
  });

  it('ein Tag nur mit Pflichten der Firmen-Akte ergibt trotzdem einen Bericht — mit der Zahl, ohne Titel', () => {
    const nurAkte: AppDaten = { ...d, state: { ...d.state, tasks: d.state.tasks.filter(t => t.id === 'usp-ug-abschluss-2026') } };
    const m = M.material(nurAkte, H, H, null);
    expect(m.akteErledigt).toBe(1);
    expect(M.materialLeer(m)).toBe(false);
    const text = B.berichtText(nurAkte, H)!;
    expect(text).toContain('1 Pflicht aus der Firmen-Akte erledigt');
    expect(text).not.toContain('AKTE-ABSCHLUSS-GEHEIM');
  });

  it('Spiegel: keine Datei nennt Titel, Kennung oder Link einer Akte-Aufgabe; „Projekte/Firmen-Akte.md“ trägt nur Zahlen', () => {
    const dateien = S.spiegelDateien(d);
    const alle = [...dateien.values()].join('\n');
    for (const geheim of GEHEIM) expect(alle, geheim).not.toContain(geheim);
    for (const kennung of ['usp-', 'rcw-', 'vte-', 'bfc-', 'u-1']) expect(alle, kennung).not.toContain(kennung);
    const akte = dateien.get('Projekte/Firmen-Akte.md')!;
    expect(akte).toContain('type: app-spiegel');
    expect(akte).toContain('offene Pflichten: 2');   // vte (ohne die Unteraufgabe) + bfc
    expect(akte).toContain('erledigte Pflichten: 2'); // usp + rcw
    // Die normalen Aufgaben stehen weiter in ihrem Projekt.
    const projekt = [...dateien.entries()].find(([pfad]) => pfad.endsWith('Webseite Relaunch.md'))![1];
    expect(projekt).toContain('Impressum ergänzen');
    // Für die Gesellschaft, in deren „Sonstige“ nur Akte-Aufgaben lagen, entsteht keine Projekt-Datei mehr.
    expect([...dateien.keys()].filter(p => p.startsWith('Projekte/') && p.endsWith('Sonstige.md'))).toEqual([]);
  });

  it('auch mit der Privat-Stufe „voll“ bleibt es bei der Zahl (es gibt keine Stufe „voll“ für die Firmen-Akte)', () => {
    const voll: AppDaten = { ...d, einstellung: { ...d.einstellung, privat: 'voll' } };
    const alle = [...S.spiegelDateien(voll).values()].join('\n') + B.berichtText(voll, H);
    for (const geheim of GEHEIM) expect(alle, geheim).not.toContain(geheim);
  });

  it('ohne Aufgaben der Firmen-Akte entsteht keine Datei und keine Zeile (Instanz ohne Firmen-Akte unverändert)', () => {
    const ohne: AppDaten = { ...d, state: { ...d.state, tasks: d.state.tasks.filter(t => !M.firmenAkteAufgabe(t, d)) } };
    expect(S.spiegelDateien(ohne).has('Projekte/Firmen-Akte.md')).toBe(false);
    expect(B.berichtText(ohne, H)).not.toContain('Firmen-Akte');
  });

  it('ZOE-Entscheidungen zu Recht-Vorschlägen: ohne Titel (er nennt Vertrag und Gesellschaft), Art und Werkzeug bleiben', () => {
    const e = { at: J, typ: 'entscheidung' as const, quelleId: 'v-1', werkzeug: 'recht_checkliste', gruppe: 'business', entscheidung: 'freigegeben' as const, bezug: { art: 'recht', id: 'checkliste-abc' }, titel: 'Checkliste zum Vertrag „AKTE-VERTRAG-GEHEIM“', person: 'kevin' };
    const zeile = M.entscheidungZeile(e);
    expect(zeile).toContain('Recht-Vorschlag (recht_checkliste)');
    expect(zeile).not.toContain('GEHEIM');
    // Andere Titel bleiben wie bisher.
    expect(M.entscheidungZeile({ ...e, werkzeug: 'plan_block', bezug: undefined, titel: 'Fokusblock Mittwoch' })).toContain('„Fokusblock Mittwoch“');
  });
});
