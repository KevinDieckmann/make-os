// ─── Heute (10.10., Branch `heute-top3`): Top 3 des Tages, Tages-Briefing, Freigaben-Karte, Eisenhower-Zeichen ────────────────────────────
// Kevin 08.10. (Fragebogen): „Top-3 Prioritäten, von ZOE vorgeschlagen; kurzes Tages-Briefing als Text; offene Freigaben von ZOE; Fortschritt der
// Jahresziele“ und „Täglich Top-3 festlegen; Prioritäten (Eisenhower) sichtbarer“. Hier: die reinen Regeln (Rangfolge, Gründe, Ausschlüsse, Eisenhower),
// die Route (Tor, Bereich serverseitig, Festlegen mit Stand/409) und die Wächter der Plattform-Regel:
//   · „Sicht Business bekommt nichts aus Privat“ (Top 3 UND Briefing, auch mit einem Konto „nur Business“),
//   · „Person B sieht Top 3 und Briefing von A nicht“ (eigener Bestand je Person, „nur ich“ anderer nie).
// Erfundene Aufgaben in einem Temp-Ordner; kein Modell, kein Netz.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { localDay } from '@/lib/zeit';
import { tagPlus } from '@/lib/kalender/zeit';
import { meilensteinListeId } from '@/lib/planung/meilenstein-aufgaben';
import type { Task } from '@/types/tasks';
import {
  VORSCHLAG_AB, TOP3_MAX, alsZeile, aufgabenZaehler, blockiertJeAufgabe, top3Kandidaten, top3Pruefen, top3Saeubern, top3Setzen, top3Vorschlag, tageZwischen,
  type Top3Block, type Top3Kontext,
} from '@/lib/heute/top3';
import { briefingSaetze, type BriefingZahlen } from '@/lib/heute/briefing';
import { aufgabeEinordnung, quadrantVon, quadrantRang, EISENHOWER_NAME, FRIST_DRINGEND_TAGE } from '@/lib/aufgaben/eisenhower';

// Für die Render-Tests der Karten: kein Router, keine Aufgaben-Quelle (die Karten laden im Betrieb selbst).
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os' }));
vi.mock('@/context/TasksContext', () => ({ useTasks: () => ({ state: { tasks: [], projects: [] }, dispatch: () => {} }) }));

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-heute-top3-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-heute-top3';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
const wurzel = path.resolve(__dirname, '..');
const lies = (p: string) => readFileSync(path.join(wurzel, p), 'utf8');

const HEUTE = localDay();
const T0 = '2026-09-01T08:00:00.000Z';
const LM = meilensteinListeId('m-ms');

// ── Reine Regeln ────────────────────────────────────────────────────────────────────────────────────────────────────────────

const aufgabe = (id: string, x: Partial<Task> = {}): Task => ({
  id, projectId: 'p-x', title: `Aufgabe ${id}`, status: 'todo', priority: 'medium', assignee: 'kevin', tags: [], subTasks: [], dependencies: [], sortOrder: 0,
  createdAt: T0, updatedAt: T0, spaceId: 'kdv', ...x,
} as Task);
const kontext = (x: Partial<Top3Kontext> = {}): Top3Kontext => ({ heute: HEUTE, person: 'kevin', blockiert: new Map(), msFrist: new Map(), orgs: {}, ...x });

describe('Eisenhower: eine Regel für Top 3, Aufgaben-Karte und „Geplant“', () => {
  it('vier Felder aus wichtig und dringend', () => {
    expect(quadrantVon(true, true)).toBe('q1');
    expect(quadrantVon(true, false)).toBe('q2');
    expect(quadrantVon(false, true)).toBe('q3');
    expect(quadrantVon(false, false)).toBe('q4');
    expect(['q3', 'q1', 'q4', 'q2'].sort((a, b) => quadrantRang(a as 'q1') - quadrantRang(b as 'q1'))).toEqual(['q1', 'q2', 'q3', 'q4']);
    expect(Object.keys(EISENHOWER_NAME)).toEqual(['q1', 'q2', 'q3', 'q4']);
  });
  it('wichtig = hohe/kritische Priorität; dringend = fällig in höchstens zwei Tagen (überfällig eingeschlossen)', () => {
    expect(FRIST_DRINGEND_TAGE).toBe(2);
    expect(aufgabeEinordnung({ priority: 'high', dueDate: tagPlus(HEUTE, 2) }, HEUTE).quadrant).toBe('q1');
    expect(aufgabeEinordnung({ priority: 'high', dueDate: tagPlus(HEUTE, 3) }, HEUTE).quadrant).toBe('q2');
    expect(aufgabeEinordnung({ priority: 'high' }, HEUTE).quadrant).toBe('q2');
    expect(aufgabeEinordnung({ priority: 'medium', dueDate: tagPlus(HEUTE, -5) }, HEUTE).quadrant).toBe('q3');
    expect(aufgabeEinordnung({ priority: 'low' }, HEUTE).quadrant).toBe('q4');
    // ein Grund von außen (Meilenstein-Frist, blockiert andere) macht eine mittlere Aufgabe wichtig
    expect(aufgabeEinordnung({ priority: 'medium', dueDate: tagPlus(HEUTE, 1) }, HEUTE, true).quadrant).toBe('q1');
  });
  it('nur „kritisch“ pulsiert', () => {
    expect(aufgabeEinordnung({ priority: 'critical' }, HEUTE).kritisch).toBe(true);
    expect(aufgabeEinordnung({ priority: 'high', dueDate: HEUTE }, HEUTE).kritisch).toBe(false);
  });
  it('„Geplant“ im Agenten-Bereich nutzt dieselbe Regel', async () => {
    const n = await import('@/lib/agenten/naechstes');
    expect(n.quadrantVon).toBe(quadrantVon);
    expect(n.FRIST_DRINGEND_TAGE).toBe(FRIST_DRINGEND_TAGE);
    const r = await import('@/components/os/agenten/regeln');
    expect(r.QUADRANT_NAME).toBe(EISENHOWER_NAME);
  });
});

describe('Rangfolge der Top 3 (Regelwerk, ohne Modell)', () => {
  const lage = () => [
    aufgabe('ueber', { title: 'Überfällig', dueDate: tagPlus(HEUTE, -3) }),
    aufgabe('heute', { title: 'Heute fällig', dueDate: HEUTE }),
    aufgabe('krit', { title: 'Kritisch ohne Termin', priority: 'critical' }),
    aufgabe('hoch', { title: 'Hoch', priority: 'high' }),
    aufgabe('ruhig', { title: 'Ruhige Aufgabe', dueDate: tagPlus(HEUTE, 30) }),
  ];
  it('erst das Eisenhower-Feld, dann die Punkte: wichtig (kritisch, hoch) vor nur dringend (überfällig, heute); wer nichts hat, bekommt keine Punkte', () => {
    const k = top3Kandidaten(lage(), 'business', kontext());
    // Prüf-Fund 11.10.: vorher Punkte zuerst (überfällig, heute, kritisch, hoch) — q3 stand vor q2.
    expect(k.map(x => x.id)).toEqual(['krit', 'hoch', 'ueber', 'heute', 'ruhig']);
    expect(k.find(x => x.id === 'ueber')!.gruende[0]).toBe('überfällig seit 3 Tagen');
    expect(k.find(x => x.id === 'heute')!.gruende).toEqual(['heute fällig']);
    expect(k.find(x => x.id === 'ruhig')!.punkte).toBe(0);
  });
  it('ein Vorschlag sind höchstens drei und nur ab VORSCHLAG_AB — nie „zur Auffüllung“', () => {
    const v = top3Vorschlag(top3Kandidaten(lage(), 'business', kontext()));
    expect(v.map(x => x.id)).toEqual(['krit', 'hoch', 'ueber']);
    expect(v.length).toBeLessThanOrEqual(TOP3_MAX);
    expect(top3Vorschlag(top3Kandidaten([aufgabe('nix', { dueDate: tagPlus(HEUTE, 30) })], 'business', kontext()))).toEqual([]);
    expect(VORSCHLAG_AB).toBeGreaterThan(0);
  });
  it('kritisch in 5 Tagen schlägt „niedrig, heute fällig“ (Prüf-Fund 11.10.)', () => {
    const k = top3Kandidaten([
      aufgabe('niedrig-heute', { title: 'Niedrig heute', priority: 'low', dueDate: HEUTE }),
      aufgabe('krit-5', { title: 'Kritisch in 5 Tagen', priority: 'critical', dueDate: tagPlus(HEUTE, 5) }),
    ], 'business', kontext());
    expect(k.map(x => x.id)).toEqual(['krit-5', 'niedrig-heute']);
    expect(k.map(x => x.quadrant)).toEqual(['q2', 'q3']);
    expect(top3Vorschlag(k)[0].id).toBe('krit-5');
  });
  it('Gründe: höchstens zwei in der Zeile, die wichtigsten zuerst', () => {
    const z = alsZeile(top3Kandidaten([aufgabe('x', { priority: 'critical', dueDate: HEUTE })], 'business', kontext())[0]);
    expect(z.grund).toBe('heute fällig · kritisch');
    expect(z.quadrant).toBe('q1');
    expect(z.kritisch).toBe(true);
    expect(z.erledigt).toBe(false);
  });
  it('Meilenstein-Frist und „blockiert andere“ heben eine Aufgabe ohne Priorität und Termin', () => {
    const tasks = [
      aufgabe('ms', { title: 'Im Meilenstein', listeId: LM }),
      aufgabe('block', { title: 'Blockiert zwei' }),
      aufgabe('f1', { abhaengigVon: ['block'] }), aufgabe('f2', { abhaengigVon: ['block'] }),
    ];
    const k = top3Kandidaten(tasks, 'business', kontext({ blockiert: blockiertJeAufgabe(tasks), msFrist: new Map([[LM, tagPlus(HEUTE, 3)]]) }));
    expect(k.find(x => x.id === 'ms')!.gruende).toEqual(['Meilenstein-Frist in 3 Tagen']);
    expect(k.find(x => x.id === 'ms')!.quadrant).toBe('q2'); // wichtig (Frist ≤ 7 Tage), noch nicht dringend
    expect(k.find(x => x.id === 'block')!.gruende).toEqual(['blockiert 2 andere Aufgaben']);
    // eine ferne Frist (über 14 Tage) zählt nicht
    expect(top3Kandidaten([aufgabe('weit', { listeId: LM })], 'business', kontext({ msFrist: new Map([[LM, tagPlus(HEUTE, 20)]]) }))[0].punkte).toBe(0);
  });
  it('nie vorgeschlagen: erledigt, abgebrochen, wartend, wartet auf andere, bei ZOE, fremde Zuständigkeit, anderer Bereich, Archiv', () => {
    const tasks = [
      aufgabe('ok', { dueDate: HEUTE }),
      aufgabe('fertig', { dueDate: HEUTE, status: 'done' }),
      aufgabe('abgebrochen', { dueDate: HEUTE, status: 'cancelled' }),
      aufgabe('wartend', { dueDate: HEUTE, status: 'blocked' }),
      aufgabe('wartetAuf', { dueDate: HEUTE, abhaengigVon: ['ok'] }),
      aufgabe('beiZoe', { dueDate: HEUTE, zoe: { status: 'offen', von: 'kevin' } } as Partial<Task>),
      aufgabe('fremd', { dueDate: HEUTE, assignee: 'malin' }),
      aufgabe('privat', { dueDate: HEUTE, spaceId: 'privat' }),
      aufgabe('archiv', { dueDate: HEUTE, archiviertAm: T0 }),
      aufgabe('papierkorb', { dueDate: HEUTE, geloeschtAm: T0 }),
    ];
    expect(top3Kandidaten(tasks, 'business', kontext()).map(x => x.id)).toEqual(['ok']);
    expect(top3Kandidaten(tasks, 'privat', kontext()).map(x => x.id)).toEqual(['privat']);
  });
  it('eine Unteraufgabe nur, wenn sie selbst drängt (heute/überfällig oder kritisch)', () => {
    const tasks = [
      aufgabe('haupt', { dueDate: tagPlus(HEUTE, 1) }),
      aufgabe('unter-bald', { parentId: 'haupt', dueDate: tagPlus(HEUTE, 1) }),
      aufgabe('unter-heute', { parentId: 'haupt', dueDate: HEUTE }),
      aufgabe('unter-krit', { parentId: 'haupt', priority: 'critical' }),
    ];
    expect(top3Kandidaten(tasks, 'business', kontext()).map(x => x.id).sort()).toEqual(['haupt', 'unter-heute', 'unter-krit']);
  });
  it('Zähler fürs Briefing: überfällig, heute fällig, kritisch — nur eigene, nur dieser Bereich', () => {
    const tasks = [aufgabe('a', { dueDate: tagPlus(HEUTE, -1) }), aufgabe('b', { dueDate: HEUTE, priority: 'critical' }), aufgabe('c', { assignee: 'malin', dueDate: HEUTE }), aufgabe('d', { spaceId: 'privat', dueDate: HEUTE }), aufgabe('e', { status: 'done', dueDate: HEUTE })];
    expect(aufgabenZaehler(tasks, 'kevin', 'business', HEUTE)).toEqual({ ueberfaellig: 1, heuteFaellig: 1, kritisch: 1 });
    expect(aufgabenZaehler(tasks, 'kevin', 'privat', HEUTE)).toEqual({ ueberfaellig: 0, heuteFaellig: 1, kritisch: 0 });
  });
  it('tageZwischen rechnet in Kalendertagen', () => {
    expect(tageZwischen('2026-10-10', '2026-10-13')).toBe(3);
    expect(tageZwischen('2026-10-10', '2026-10-09')).toBe(-1);
  });
});

describe('Prüfung und Datei', () => {
  it('top3Pruefen: 1 bis 3 gültige, verschiedene Kennungen — sonst Text, nichts wird gekürzt', () => {
    expect(top3Pruefen(['a', 'b'])).toEqual({ ok: true, ids: ['a', 'b'] });
    expect(top3Pruefen([])).toMatchObject({ ok: false });
    expect(top3Pruefen(['a', 'b', 'c', 'd'])).toMatchObject({ ok: false, fehler: expect.stringContaining('höchstens 3') });
    expect(top3Pruefen(['a', 'a'])).toMatchObject({ ok: false, fehler: expect.stringContaining('doppelt') });
    expect(top3Pruefen(['a b'])).toMatchObject({ ok: false });
    expect(top3Pruefen('a')).toMatchObject({ ok: false });
  });
  it('top3Saeubern lässt nichts Fremdes durch', () => {
    const d = top3Saeubern({ tage: { '2026-10-10': { business: { ids: ['a', 'a', 'b', 'c', 'd', 5, '<x>'], am: 'jetzt', von: 'vorschlag' }, privat: { ids: [], am: 'x' }, anders: { ids: ['z'], am: 'x' } }, kaputt: { business: { ids: ['a'], am: 'x' } } } });
    expect(d.tage['2026-10-10']).toEqual({ business: { ids: ['a', 'b', 'c'], am: 'jetzt', von: 'vorschlag' } });
    expect(Object.keys(d.tage)).toEqual(['2026-10-10']);
    expect(top3Saeubern(null)).toEqual({ v: 1, tage: {} });
  });
  it('top3Setzen: festlegen, zurücksetzen, alte Tage fallen heraus', () => {
    let d = top3Saeubern(null);
    d = top3Setzen(d, '2026-08-01', 'business', { ids: ['alt'], am: 'x', von: 'hand' });
    d = top3Setzen(d, '2026-10-10', 'business', { ids: ['a'], am: 'y', von: 'hand' });
    expect(Object.keys(d.tage)).toEqual(['2026-10-10']); // 2026-08-01 liegt über 45 Tage zurück
    d = top3Setzen(d, '2026-10-10', 'privat', { ids: ['p'], am: 'z', von: 'vorschlag' });
    expect(Object.keys(d.tage['2026-10-10'])).toEqual(['business', 'privat']);
    d = top3Setzen(d, '2026-10-10', 'business', null);
    expect(Object.keys(d.tage['2026-10-10'])).toEqual(['privat']);
    d = top3Setzen(d, '2026-10-10', 'privat', null);
    expect(d.tage).toEqual({});
  });
});

describe('Briefing: 3 bis 5 Sätze aus Zahlen, kein Modell', () => {
  const basis: BriefingZahlen = {
    sicht: 'business', termine: { anzahl: 3, erster: { uhr: '09:30', titel: 'Kennzahlen-Review' } }, ueberfaellig: 2, heuteFaellig: 1, kritisch: 1, followups: 4, freigaben: 2,
    top3: { art: 'festgelegt', titel: ['Angebot senden', 'Review vorbereiten', 'Rechnung prüfen'], erledigt: 1 }, fokus: { text: 'Zwei Pilotkunden gewinnen', wann: 'woche' },
  };
  it('alles da: fünf Sätze, jeder Baustein genannt', () => {
    const s = briefingSaetze(basis);
    expect(s).toHaveLength(5);
    expect(s[0]).toBe('Heute stehen 3 Termine an, der erste um 09:30.');
    expect(s[1]).toBe('Bei den Aufgaben: 2 überfällig, 1 heute fällig, 1 kritisch; dazu 4 fällige Follow-ups.');
    expect(s[2]).toBe('2 Vorschläge von ZOE warten auf deine Freigabe.');
    expect(s[3]).toContain('Deine Top 3: „Angebot senden“, „Review vorbereiten“ und „Rechnung prüfen“ — 1 davon schon geschafft.');
    expect(s[4]).toBe('Dein Fokus diese Woche: „Zwei Pilotkunden gewinnen“.');
  });
  it('ruhiger Tag: vier Sätze, ehrlich leer', () => {
    const s = briefingSaetze({ ...basis, termine: { anzahl: 0 }, ueberfaellig: 0, heuteFaellig: 0, kritisch: 0, followups: 0, freigaben: 0, top3: { art: 'keine', titel: [], erledigt: 0 }, fokus: null });
    expect(s).toEqual([
      'Heute steht kein Termin mehr an.', 'Bei den Aufgaben brennt nichts.',
      'Noch keine Top 3: nichts drängt von allein — leg dir selbst bis zu drei Aufgaben fest.', 'Noch kein Fokus gesetzt — ein Satz unter „Fokus“ genügt.',
    ]);
  });
  it('Vorschlag, ein Termin, ein Vorschlag von ZOE (Einzahl), alle Top 3 erledigt', () => {
    expect(briefingSaetze({ ...basis, termine: { anzahl: 1, erster: { uhr: '14:00', titel: 'Workshop' } }, freigaben: 1, followups: 0, top3: { art: 'vorschlag', titel: ['A', 'B'], erledigt: 0 } }).join(' ')).toContain('Heute steht ein Termin an: „Workshop“ um 14:00. ');
    expect(briefingSaetze({ ...basis, freigaben: 1 })[2]).toBe('1 Vorschlag von ZOE wartet auf deine Freigabe.');
    expect(briefingSaetze({ ...basis, top3: { art: 'vorschlag', titel: ['A', 'B', 'C'], erledigt: 0 } })[3]).toBe('ZOE schlägt als Top 3 vor: „A“, „B“ und „C“ — übernimm sie oder tausch eine aus.');
    expect(briefingSaetze({ ...basis, top3: { art: 'festgelegt', titel: ['A', 'B', 'C'], erledigt: 3 } })[3]).toBe('Deine Top 3 sind erledigt.');
  });
  it('lange Fokus-Sätze werden gekürzt, nie mitten im Wort ohne Zeichen', () => {
    const s = briefingSaetze({ ...basis, fokus: { text: 'x'.repeat(300), wann: 'monat' } });
    expect(s[s.length - 1].length).toBeLessThan(160);
    expect(s[s.length - 1]).toContain('…');
  });
});

// ── Route, Bereich, Person ──────────────────────────────────────────────────────────────────────────────────────────────

type Handler = (r: Request) => Promise<Response>;
let top3: { GET: Handler; PUT: Handler };
let briefing: { GET: Handler };
const sitzung = (p: string) => ({ 'x-make-user': p, 'content-type': 'application/json' });
const dienst = { 'x-make-key': 'pruef-schluessel-heute-top3', 'x-make-person': 'kevin', 'content-type': 'application/json' };
const getTop3 = async (q: string, h: Record<string, string>) => { const r = await top3.GET(new Request(`http://test/api/heute/top3${q}`, { headers: h })); return { status: r.status, d: await r.json() as { ok?: boolean; tag?: string; space?: string; bereiche?: Partial<Record<'privat' | 'business', Top3Block>>; error?: string } }; };
const putTop3 = async (body: unknown, h: Record<string, string>) => { const r = await top3.PUT(new Request('http://test/api/heute/top3', { method: 'PUT', headers: h, body: JSON.stringify(body) })); return { status: r.status, d: await r.json() as { ok?: boolean; block?: Top3Block; error?: string } }; };
const getBriefing = async (q: string, h: Record<string, string>) => { const r = await briefing.GET(new Request(`http://test/api/heute/briefing${q}`, { headers: h })); return { status: r.status, d: await r.json() as { ok?: boolean; saetze?: string[]; text?: string; error?: string } }; };

const GEHEIM_PRIVAT = ['Steuererklärung abgeben', 'Zahnarzt anrufen', 'Dach reparieren lassen', 'Urlaub planen', 'Familienfest'];
const GEHEIM_MALIN = ['MALIN-BIZ-AUFGABE', 'MALIN-PRIVAT-AUFGABE', 'MALIN-NURICH-GEHEIM'];

beforeAll(async () => {
  const db = await import('@/lib/store/local-db');
  const k = (id: string, speicher: string, rolle: string, haushalt: string, extra: Record<string, unknown> = {}) => ({ id, speicher, email: `${speicher}@example.invalid`, name: speicher, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt, ...extra });
  await db.saveJson('konten', { konten: [k('k1', 'kevin', 'inhaber', 'haus'), k('k2', 'malin', 'mitglied', 'haus'), k('k3', 'partner', 'mitglied', 'haus', { finanzRecht: 'business' }), k('k4', 'gast', 'mitglied', 'anderes-haus')], einladungen: [] });
  const t = (id: string, x: Record<string, unknown>) => ({ id, projectId: 'p-biz', title: `Aufgabe ${id}`, status: 'todo', priority: 'medium', assignee: 'kevin', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: T0, updatedAt: T0, spaceId: 'kdv', ...x });
  const projekt = (id: string, title: string, spaceId: string) => ({ id, title, category: spaceId === 'privat' ? 'joint' : 'business', owner: 'both', color: '#58D9CD', tags: [], archived: false, createdAt: T0, updatedAt: T0, spaceId });
  await db.saveJson('meilensteine', { meilensteine: [{ id: 'm-ms', titel: 'Meilenstein Web', faellig: tagPlus(HEUTE, 3), space: 'business', bereich: 'business', fortschritt: 0, erledigt: false }] });
  await db.saveJson('tasks', {
    projects: [projekt('p-biz', 'Vertrieb', 'kdv'), projekt('p-haus', 'Zuhause', 'privat'), projekt('pm-kdv', 'Meilensteine', 'kdv')],
    listen: [{ id: LM, projektId: 'pm-kdv', titel: 'Meilenstein Web', sortOrder: 1 }],
    tasks: [
      // Business (Kevin)
      t('b-krit', { title: 'Angebot Nordwerk finalisieren', priority: 'critical', dueDate: tagPlus(HEUTE, 1) }),
      t('b-block', { title: 'Konzept freigeben' }),
      t('b-folge1', { title: 'Folge eins', abhaengigVon: ['b-block'], dueDate: tagPlus(HEUTE, 20) }),
      t('b-folge2', { title: 'Folge zwei', abhaengigVon: ['b-block'], dueDate: tagPlus(HEUTE, 20) }),
      t('b-wartet', { title: 'Entwurf prüfen', abhaengigVon: ['b-folge1'], dueDate: HEUTE }),
      t('b-fertig', { title: 'Schon erledigt', status: 'done', dueDate: HEUTE }),
      t('b-zoe', { title: 'Liegt bei ZOE', dueDate: HEUTE, zoe: { status: 'offen', von: 'kevin' } }),
      t('b-ms', { title: 'Aufgabe im Meilenstein', projectId: 'pm-kdv', listeId: LM }),
      t('b-malin', { title: 'MALIN-BIZ-AUFGABE', assignee: 'malin', angelegtVon: 'malin', priority: 'critical', dueDate: HEUTE }),
      // Privat (Kevin)
      t('p-ueber', { title: 'Steuererklärung abgeben', projectId: 'p-haus', spaceId: 'privat', dueDate: tagPlus(HEUTE, -3) }),
      t('p-heute', { title: 'Zahnarzt anrufen', projectId: 'p-haus', spaceId: 'privat', dueDate: HEUTE }),
      t('p-krit', { title: 'Dach reparieren lassen', projectId: 'p-haus', spaceId: 'privat', priority: 'critical', dueDate: tagPlus(HEUTE, 10) }),
      t('p-spaeter', { title: 'Urlaub planen', projectId: 'p-haus', spaceId: 'privat', dueDate: tagPlus(HEUTE, 30) }),
      // Malin
      t('m-privat', { title: 'MALIN-PRIVAT-AUFGABE', projectId: 'p-haus', spaceId: 'privat', assignee: 'malin', dueDate: HEUTE, priority: 'high' }),
      t('m-nurich', { title: 'MALIN-NURICH-GEHEIM', projectId: 'p-haus', spaceId: 'privat', assignee: 'malin', angelegtVon: 'malin', sichtbarkeit: 'nur-ich', dueDate: HEUTE, priority: 'critical' }),
    ],
    gruppen: [], statusEigen: [], vorlagen: [], umbauVersion: 3,
  });
  top3 = (await import('@/app/api/heute/top3/route')) as unknown as typeof top3;
  briefing = (await import('@/app/api/heute/briefing/route')) as unknown as typeof briefing;
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Tor: nur die Person selbst', () => {
  it('ohne Sitzung, fremder Haushalt, Dienstweg → 403; ungültiger Bereich → 400', async () => {
    for (const h of [{}, sitzung('gast'), dienst]) {
      expect((await getTop3('?space=business', h)).status).toBe(403);
      expect((await putTop3({ aktion: 'zuruecksetzen', space: 'business' }, h)).status).toBe(403);
      expect((await getBriefing('?space=business', h)).status).toBe(403);
    }
    expect((await getTop3('?space=alles-moegliche', sitzung('kevin'))).status).toBe(400);
    expect((await putTop3({ aktion: 'festlegen', ids: ['b-krit'] }, sitzung('kevin'))).status).toBe(400);
    expect((await putTop3({ aktion: 'loeschen', space: 'business' }, sitzung('kevin'))).status).toBe(400);
    expect((await getBriefing('', sitzung('kevin'))).status).toBe(400);
    expect((await getBriefing('?space=beides', sitzung('kevin'))).status).toBe(400);
  });
  it('sie sind im Routen-Register als „person“ geführt', async () => {
    const { ROUTEN_REGISTER } = await import('@/lib/zugang/routen-register');
    expect(ROUTEN_REGISTER['heute/top3'].methoden).toEqual({ GET: 'person', PUT: 'person' });
    expect(ROUTEN_REGISTER['heute/briefing'].methoden).toEqual({ GET: 'person' });
  });
});

describe('Top 3 · Vorschlag je Bereich', () => {
  it('Business: kritisch zuerst, dann Meilenstein-Frist und „blockiert zwei“; nichts Wartendes, Erledigtes oder bei ZOE', async () => {
    const { status, d } = await getTop3('?space=business', sitzung('kevin'));
    expect(status).toBe(200);
    expect(Object.keys(d.bereiche!)).toEqual(['business']);
    const b = d.bereiche!.business!;
    expect(b.vorschlag.map(z => z.id)).toEqual(['b-krit', 'b-ms', 'b-block']);
    expect(b.vorschlag[0]).toMatchObject({ quadrant: 'q1', kritisch: true, bereich: 'business', erledigt: false, projekt: 'Vertrieb' });
    expect(b.vorschlag[0].grund).toBe('kritisch · morgen fällig');
    expect(b.vorschlag[1].grund).toBe('Meilenstein-Frist in 3 Tagen');
    expect(b.vorschlag[2].grund).toBe('blockiert 2 andere Aufgaben');
    const ids = b.auswahl.map(z => z.id);
    for (const nie of ['b-wartet', 'b-fertig', 'b-zoe', 'b-malin']) expect(ids).not.toContain(nie);
    expect(b.festgelegt).toBeNull();
    expect(b.stand).toBe('');
  });
  it('Privat: kritisch (wichtig) vor überfällig vor heute (nur dringend) — Eisenhower zuerst (11.10.)', async () => {
    const b = (await getTop3('?space=privat', sitzung('kevin'))).d.bereiche!.privat!;
    expect(b.vorschlag.map(z => z.id)).toEqual(['p-krit', 'p-ueber', 'p-heute']);
    expect(b.vorschlag[1].grund).toBe('überfällig seit 3 Tagen');
    expect(b.auswahl.map(z => z.id)).toContain('p-spaeter'); // zum Selbst-Wählen, vorgeschlagen wird sie nicht
  });
  it('ohne `space` beide Bereiche der Person — mit `space` nur dieser', async () => {
    const beide = (await getTop3('', sitzung('kevin'))).d;
    expect(beide.space).toBe('alles');
    expect(Object.keys(beide.bereiche!).sort()).toEqual(['business', 'privat']);
    const nur = (await getTop3('?space=business', sitzung('kevin'))).d;
    expect(Object.keys(nur.bereiche!)).toEqual(['business']);
  });
});

describe('Wächter: Sicht Business bekommt nichts aus Privat', () => {
  it('Top 3 und Briefing im Business enthalten keinen privaten Titel', async () => {
    const text = JSON.stringify((await getTop3('?space=business', sitzung('kevin'))).d) + JSON.stringify((await getBriefing('?space=business', sitzung('kevin'))).d);
    for (const p of GEHEIM_PRIVAT) expect(text, p).not.toContain(p);
    expect(text).toContain('Angebot Nordwerk finalisieren'); // Gegenprobe: Business ist da
  });
  it('umgekehrt zeigt Privat keine Business-Aufgabe', async () => {
    const text = JSON.stringify((await getTop3('?space=privat', sitzung('kevin'))).d);
    for (const b of ['Angebot Nordwerk', 'Konzept freigeben', 'Aufgabe im Meilenstein']) expect(text, b).not.toContain(b);
  });
  it('ein Konto „nur Business“ bekommt Privat nie — nicht als Vorschlag, nicht festgelegt, nicht im Briefing', async () => {
    const g = await getTop3('?space=privat', sitzung('partner'));
    expect(g.status).toBe(200);
    expect(g.d.bereiche).toEqual({});
    expect((await getTop3('', sitzung('partner'))).d.bereiche).not.toHaveProperty('privat');
    expect((await putTop3({ aktion: 'festlegen', space: 'privat', ids: ['p-ueber'], stand: '' }, sitzung('partner'))).status).toBe(403);
    expect((await getBriefing('?space=privat', sitzung('partner'))).status).toBe(403);
    // Business sieht es voll — aber nur die eigenen (dem Konto zugewiesenen) Aufgaben: keine
    expect((await getBriefing('?space=business', sitzung('partner'))).status).toBe(200);
  });
});

describe('Wächter: Person B sieht Top 3 und Briefing von A nicht', () => {
  it('Malin bekommt weder Kevins Aufgaben noch seine Festlegung — und Kevin nicht ihre (auch nicht „nur ich“)', async () => {
    // Kevin legt fest.
    const kv = (await getTop3('?space=business', sitzung('kevin'))).d.bereiche!.business!;
    const f = await putTop3({ aktion: 'festlegen', space: 'business', ids: kv.vorschlag.map(z => z.id), stand: kv.stand }, sitzung('kevin'));
    expect(f.status).toBe(200);
    expect(f.d.block!.festgelegt!.zeilen.map(z => z.id)).toEqual(['b-krit', 'b-ms', 'b-block']);
    expect(f.d.block!.festgelegt!.von).toBe('vorschlag');

    for (const bereich of ['business', 'privat']) {
      const m = JSON.stringify((await getTop3(`?space=${bereich}`, sitzung('malin'))).d) + JSON.stringify((await getBriefing(`?space=${bereich}`, sitzung('malin'))).d);
      for (const x of ['Angebot Nordwerk', 'Konzept freigeben', 'Aufgabe im Meilenstein', ...GEHEIM_PRIVAT.slice(0, 4)]) expect(m, `${bereich}: ${x}`).not.toContain(x);
    }
    const malinBiz = (await getTop3('?space=business', sitzung('malin'))).d.bereiche!.business!;
    expect(malinBiz.festgelegt).toBeNull();
    expect(malinBiz.vorschlag.map(z => z.titel)).toEqual(['MALIN-BIZ-AUFGABE']);

    const kevinAlles = JSON.stringify((await getTop3('', sitzung('kevin'))).d) + JSON.stringify((await getBriefing('?space=business', sitzung('kevin'))).d) + JSON.stringify((await getBriefing('?space=privat', sitzung('kevin'))).d);
    for (const x of GEHEIM_MALIN) expect(kevinAlles, x).not.toContain(x);
    // Malins „nur ich“ sieht sie selbst
    expect(JSON.stringify((await getTop3('?space=privat', sitzung('malin'))).d)).toContain('MALIN-NURICH-GEHEIM');
  });
  it('Bestand je Person: nur Kennungen, nie ein Titel; der Name trägt die Person', async () => {
    const db = await import('@/lib/store/local-db');
    const { top3Name } = await import('@/lib/heute/top3-server');
    expect(top3Name('kevin')).toBe('heute-top3--kevin');
    const kevin = JSON.stringify(await db.loadJson(top3Name('kevin')));
    expect(kevin).toContain('b-krit');
    expect(kevin).not.toContain('Angebot Nordwerk');
    expect(await db.loadJson(top3Name('malin'))).toBeNull();
  });
  it('Malin kann nicht auf Kevins Aufgaben festlegen (400, ohne den Titel zu nennen)', async () => {
    for (const id of ['b-krit', 'p-ueber']) {
      const r = await putTop3({ aktion: 'festlegen', space: id.startsWith('p') ? 'privat' : 'business', ids: [id], stand: '' }, sitzung('malin'));
      expect(r.status, id).toBe(400);
      expect(JSON.stringify(r.d)).not.toContain('Angebot Nordwerk');
    }
  });
});

describe('Festlegen · Tauschen · Zurücksetzen', () => {
  it('Stand veraltet → 409 mit dem aktuellen Block, nichts überschrieben', async () => {
    const r = await putTop3({ aktion: 'festlegen', space: 'business', ids: ['b-krit'], stand: '' }, sitzung('kevin'));
    expect(r.status).toBe(409);
    expect(r.d.block!.festgelegt!.zeilen).toHaveLength(3);
    expect(r.d.error).toContain('woanders geändert');
  });
  it('eigene Wahl (Tausch): „von dir gewählt“, Stand wandert weiter', async () => {
    const vorher = (await getTop3('?space=business', sitzung('kevin'))).d.bereiche!.business!;
    const r = await putTop3({ aktion: 'festlegen', space: 'business', ids: ['b-krit', 'b-folge1'], stand: vorher.stand }, sitzung('kevin'));
    expect(r.status).toBe(200);
    expect(r.d.block!.festgelegt).toMatchObject({ von: 'hand' });
    expect(r.d.block!.festgelegt!.zeilen.map(z => z.id)).toEqual(['b-krit', 'b-folge1']);
    expect(r.d.block!.stand).not.toBe(vorher.stand);
  });
  it('Prüfungen: mehr als drei, doppelt, unbekannt, wartend, erledigt, anderer Bereich → 400', async () => {
    const s = (await getTop3('?space=business', sitzung('kevin'))).d.bereiche!.business!.stand;
    const falsch = async (ids: unknown) => (await putTop3({ aktion: 'festlegen', space: 'business', ids, stand: s }, sitzung('kevin'))).status;
    expect(await falsch(['b-krit', 'b-block', 'b-ms', 'b-folge1'])).toBe(400);
    expect(await falsch(['b-krit', 'b-krit'])).toBe(400);
    expect(await falsch(['gibt-es-nicht'])).toBe(400);
    expect(await falsch(['b-fertig'])).toBe(400);
    expect(await falsch(['p-ueber'])).toBe(400);
    expect(await falsch(['b-malin'])).toBe(400);
    expect(await falsch([])).toBe(400);
    expect(await falsch('b-krit')).toBe(400);
  });
  it('eine schon festgelegte Aufgabe darf bleiben, auch wenn sie inzwischen erledigt ist — sie steht dann als Haken da', async () => {
    const db = await import('@/lib/store/local-db');
    await db.updateJson<{ tasks: { id: string; status: string }[] }>('tasks', cur => ({ ...cur!, tasks: cur!.tasks.map(t => (t.id === 'b-krit' ? { ...t, status: 'done' } : t)) }));
    const b = (await getTop3('?space=business', sitzung('kevin'))).d.bereiche!.business!;
    expect(b.festgelegt!.zeilen.find(z => z.id === 'b-krit')).toMatchObject({ erledigt: true });
    expect(b.vorschlag.map(z => z.id)).not.toContain('b-krit');
    const r = await putTop3({ aktion: 'festlegen', space: 'business', ids: ['b-krit', 'b-folge1', 'b-ms'], stand: b.stand }, sitzung('kevin'));
    expect(r.status).toBe(200);
    expect(r.d.block!.festgelegt!.zeilen.map(z => z.erledigt)).toEqual([true, false, false]);
    // …aber neu festlegen darf man sie nicht, wenn sie nicht schon drin war
    const neu = await putTop3({ aktion: 'festlegen', space: 'business', ids: ['b-fertig'], stand: r.d.block!.stand }, sitzung('kevin'));
    expect(neu.status).toBe(400);
  });
  it('Zurücksetzen: ZOEs Vorschlag gilt wieder; Privat blieb unberührt', async () => {
    const privatVorher = (await getTop3('?space=privat', sitzung('kevin'))).d.bereiche!.privat!;
    expect(privatVorher.festgelegt).toBeNull();
    const s = (await getTop3('?space=business', sitzung('kevin'))).d.bereiche!.business!.stand;
    const r = await putTop3({ aktion: 'zuruecksetzen', space: 'business', stand: s }, sitzung('kevin'));
    expect(r.status).toBe(200);
    expect(r.d.block!.festgelegt).toBeNull();
    expect(r.d.block!.stand).toBe('');
    const db = await import('@/lib/store/local-db');
    const { top3Name } = await import('@/lib/heute/top3-server');
    expect(JSON.stringify(await db.loadJson(top3Name('kevin')))).not.toContain('b-krit');
  });
});

describe('Briefing · Route', () => {
  it('Business: vier bis fünf Sätze, mit Top 3 und Fokus-Hinweis; Freigaben nur, wenn welche warten', async () => {
    const r = await getBriefing('?space=business', sitzung('kevin'));
    expect(r.status).toBe(200);
    expect(r.d.saetze!.length).toBeGreaterThanOrEqual(4);
    expect(r.d.saetze!.length).toBeLessThanOrEqual(5);
    expect(r.d.text).toBe(r.d.saetze!.join(' '));
    expect(r.d.saetze![0]).toMatch(/^Heute (steht|stehen)/);
    // b-krit ist erledigt; heute fällig sind noch zwei offene Aufgaben (eine wartet, eine liegt bei ZOE — sie gehören trotzdem der Person)
    expect(r.d.saetze![1]).toBe('Bei den Aufgaben: 2 heute fällig.');
  });
  it('mit Vorschlag im Stapel nennt es die Freigabe; ZOEs Vorschlag der Top 3 steht drin', async () => {
    const { lege } = await import('@/lib/zoe/stapel');
    await lege({ werkzeug: 'create_task', gruppe: 'aufgaben', titel: 'Aufgabe anlegen', nachher: 'Aufgabe „Nachfassen“ anlegen', eingabe: { title: 'Nachfassen' }, person: 'kevin', quelle: 'lauf' } as Parameters<typeof lege>[0], { gespraech: 'business' });
    const r = await getBriefing('?space=business', sitzung('kevin'));
    expect(r.d.text).toMatch(/Vorschlag von ZOE wartet auf deine Freigabe\./);
    expect(r.d.text).toContain('ZOE schlägt als Top');
    // …und Malin sieht Kevins Vorschlag nicht
    expect((await getBriefing('?space=business', sitzung('malin'))).d.text).not.toContain('Freigabe');
  });
  it('mit festgelegten Top 3 steht „Deine Top …“ im Text', async () => {
    const s = (await getTop3('?space=privat', sitzung('kevin'))).d.bereiche!.privat!.stand;
    await putTop3({ aktion: 'festlegen', space: 'privat', ids: ['p-ueber', 'p-heute'], stand: s }, sitzung('kevin'));
    expect((await getBriefing('?space=privat', sitzung('kevin'))).d.text).toContain('Deine Top 2: „Steuererklärung abgeben“ und „Zahnarzt anrufen“.');
    // Business-Briefing kennt die privaten Top 3 nicht
    expect((await getBriefing('?space=business', sitzung('kevin'))).d.text).not.toContain('Zahnarzt');
  });
});

// ── Oberfläche und Register ─────────────────────────────────────────────────────────────────────────────────────────────

describe('Oberfläche: Karten, Standard, Eisenhower-Zeichen', () => {
  it('Eisenhower-Zeichen: Feld als Text und Lage, kritisch pulsiert, die anderen nicht', async () => {
    const { EisenhowerZeichen } = await import('@/components/os/aufgaben/Zeichen');
    const q1 = renderToStaticMarkup(createElement(EisenhowerZeichen, { q: 'q1', kritisch: true }));
    expect(q1).toContain('aria-label="Eisenhower: Wichtig &amp; dringend · kritisch"');
    expect(q1).toContain('krit-puls');
    const q4 = renderToStaticMarkup(createElement(EisenhowerZeichen, { q: 'q4' }));
    expect(q4).toContain('Eisenhower: Später');
    expect(q4).not.toContain('krit-puls');
    // genau ein Feld gefüllt
    expect((q1.match(/fill="none"/g) ?? []).length).toBe(3);
    expect((q4.match(/fill="none"/g) ?? []).length).toBe(3);
  });
  it('Heute: Briefing, Top 3, Freigaben und Jahresziele in beiden Sichten; alles passt in seine Sicht', async () => {
    const { HEUTE_STANDARD, HEUTE_FLAECHE } = await import('@/components/os/HeuteView');
    const { widgetPasst } = await import('@/lib/flaeche/sicht');
    for (const s of ['privat', 'business'] as const) {
      const arten = HEUTE_STANDARD[s].map(p => p.art);
      for (const a of ['briefing', 'top3', 'zoe', 'ziele', 'aufgaben']) expect(arten, `${s}: ${a}`).toContain(a);
      expect(arten.indexOf('briefing'), s).toBeLessThan(arten.indexOf('top3'));
      for (const p of HEUTE_STANDARD[s]) expect(widgetPasst(HEUTE_FLAECHE[s], p.art ?? 'seite', p.einstellungen ?? {}), `${s}: ${p.id}`).toBe(true);
    }
    // Business bekommt keine Privat-Karte dazu
    expect(HEUTE_STANDARD.business.map(p => p.art)).not.toContain('score');
  });
  it('neue Karten rutschen in ein gespeichertes Layout, die Kennungen bleiben', async () => {
    const { anwenden } = await import('@/lib/flaeche/modell');
    const { HEUTE_STANDARD } = await import('@/components/os/HeuteView');
    const alt: import('@/lib/flaeche/modell').Layout = { plaetze: [{ id: 'anstehend', art: 'anstehend', breite: 4, einstellungen: {} }, { id: 'zoe', art: 'zoe', breite: 2, einstellungen: { inbox: true } }, { id: 'aufgaben', art: 'aufgaben', breite: 4, einstellungen: { space: 'business', nur: 'dran' } }], versteckt: [], stand: 'x' };
    const neu = anwenden(HEUTE_STANDARD.business, alt).plaetze.map(p => p.id);
    expect(neu).toEqual(expect.arrayContaining(['briefing', 'top3', 'anstehend', 'zoe', 'aufgaben']));
    expect(neu.indexOf('briefing')).toBeLessThan(neu.indexOf('top3'));
    expect(neu).toContain('zoe'); // die gespeicherte Karte bleibt
  });
  it('Katalog und Register der Widgets', async () => {
    const { WIDGETS, KATALOG } = await import('@/components/os/flaeche/widgets');
    for (const a of ['top3', 'briefing']) {
      expect(WIDGETS[a]).toBeTruthy();
      expect(KATALOG.some(k => k.art === a)).toBe(true);
    }
    expect(WIDGETS.zoe.label).toBe('Freigaben von ZOE & Inbox');
    expect(WIDGETS.ziele.label).toBe('Jahresziele · Fortschritt');
  });
  it('Aufgaben-Karte zeigt das Eisenhower-Zeichen und sortiert danach; Jahresziele verlinken WEG.ziel; Freigaben zeigen die ersten drei', () => {
    const w = lies('components/os/flaeche/widgets.tsx');
    expect(w).toContain('<EisenhowerZeichen q={einord(t).quadrant}');
    expect(w).toContain('quadrantRang(einord(a).quadrant)');
    expect(w).toContain('href={WEG.ziel(z.id)}');
    expect(w).toContain('offen.slice(0, 3)');
    expect(w).toContain('erklaerung="heute.eisenhower"');
    expect(w).toContain('erklaerung="heute.jahresziele"');
    expect(w).toContain('erklaerung="heute.freigaben"');
  });
  it('Karten: eigene Daten ohne Modell — kein Modellaufruf in Top 3 und Briefing', () => {
    for (const f of ['lib/heute/top3.ts', 'lib/heute/top3-server.ts', 'lib/heute/briefing.ts', 'lib/heute/briefing-server.ts', 'app/api/heute/top3/route.ts', 'app/api/heute/briefing/route.ts']) {
      const q = lies(f);
      expect(q, f).not.toMatch(/askText|askJson|anthropic/i);
    }
  });
  it('nichts Persönliches fest eingebaut', () => {
    for (const f of ['lib/heute/top3.ts', 'lib/heute/top3-server.ts', 'lib/heute/briefing.ts', 'lib/heute/briefing-server.ts', 'lib/aufgaben/eisenhower.ts', 'components/os/heute/Top3.tsx', 'components/os/heute/Briefing.tsx']) {
      expect(lies(f), f).not.toMatch(new RegExp(["'kevin'", "'malin'", 'Dieck' + 'mann', 'KEMA' + 'RIS', 'Witt' + 'ner', 'Hy' + 'rox'].join('|'))); // in Teilstücken (Wächter repo-sauber)
    }
  });
});

describe('Karten gerendert: Vorschlag · Festgelegt · leer', () => {
  const zeile = (id: string, titel: string, x: Partial<import('@/lib/heute/top3').Top3Zeile> = {}): import('@/lib/heute/top3').Top3Zeile => ({ id, titel, bereich: 'business', quadrant: 'q1', kritisch: false, grund: 'heute fällig', erledigt: false, ...x });
  const block = (x: Partial<Top3Block> = {}): Top3Block => ({ bereich: 'business', vorschlag: [], festgelegt: null, auswahl: [], stand: '', ...x });
  const rendern = async (b: Top3Block, sicht: 'privat' | 'business' = 'business') => {
    const { Top3Karte } = await import('@/components/os/heute/Top3');
    return renderToStaticMarkup(createElement(Top3Karte, { i: 0, sicht, vorgabe: b }));
  };
  it('Vorschlag: drei Zeilen mit Nummer, Grund und Eisenhower-Zeichen; „übernehmen“ und „Anpassen“; Erklärung am Titel', async () => {
    const html = await rendern(block({ vorschlag: [zeile('a', 'Angebot senden', { kritisch: true, grund: 'kritisch · morgen fällig' }), zeile('b', 'Review vorbereiten', { quadrant: 'q2', grund: 'Meilenstein-Frist in 3 Tagen' }), zeile('c', 'Rechnung prüfen', { quadrant: 'q3' })] }));
    expect(html).toContain('Top 3 heute · Business');
    for (const t of ['Angebot senden', 'Review vorbereiten', 'Rechnung prüfen', 'kritisch · morgen fällig', 'Meilenstein-Frist in 3 Tagen']) expect(html).toContain(t);
    expect(html).toContain('Top 3 übernehmen');
    expect(html).toContain('Anpassen');
    expect(html).toContain('Vorschlag von ZOE');
    expect(html).toContain('Eisenhower: Wichtig &amp; dringend · kritisch');
    expect(html).toContain('Eisenhower: Wichtig"');
    expect(html).toContain('Eisenhower: Dringend"');
    expect(html).toContain('krit-puls');
    expect(html).toContain('Was bedeutet'); // das „i“ an der Überschrift (heute.top3)
  });
  it('Festgelegt: Haken, durchgestrichen was erledigt ist, „Festgelegt um“, Ändern und Zurücksetzen', async () => {
    const am = '2026-10-10T06:30:00.000Z';
    const html = await rendern(block({ stand: am, festgelegt: { am, von: 'vorschlag', zeilen: [zeile('a', 'Angebot senden', { erledigt: true }), zeile('b', 'Review vorbereiten')] } }));
    expect(html).toContain('Festgelegt um 08:30');
    expect(html).toContain('Vorschlag von ZOE übernommen');
    expect(html).toContain('Ändern');
    expect(html).toContain('Zurücksetzen');
    expect(html).toContain('line-through');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).not.toContain('Top 3 übernehmen');
    const hand = await rendern(block({ stand: am, festgelegt: { am, von: 'hand', zeilen: [zeile('a', 'Eigene Wahl')] } }));
    expect(hand).toContain('von dir gewählt');
  });
  it('alle erledigt: ein Hinweis in Grün statt Alarm', async () => {
    const am = '2026-10-10T06:30:00.000Z';
    const html = await rendern(block({ stand: am, festgelegt: { am, von: 'hand', zeilen: [zeile('a', 'A', { erledigt: true }), zeile('b', 'B', { erledigt: true }), zeile('c', 'C', { erledigt: true })] } }));
    // Ohne Aufgaben-Quelle (hier leer) gilt der Stand der Antwort; im Betrieb kommt „erledigt“ live aus den Aufgaben.
    expect(html).toContain('Alle drei erledigt');
    expect(html).toContain('Festgelegt um');
  });
  it('leer: ohne Vorschlag der Weg „Selbst festlegen“; ohne jede Aufgabe der Weg zu den Aufgaben', async () => {
    const mit = await rendern(block({ auswahl: [zeile('x', 'Ruhige Aufgabe', { grund: '' })] }), 'privat');
    expect(mit).toContain('ZOE hat keinen Vorschlag');
    expect(mit).toContain('Selbst festlegen');
    expect(mit).toContain('Top 3 heute · Privat');
    const ohne = await rendern(block());
    expect(ohne).toContain('Keine offene Aufgabe in Business');
    expect(ohne).not.toContain('Selbst festlegen');
  });
  it('Briefing: die Sätze als ein Absatz, Erklärung am Titel; ohne Antwort keine leere Karte', async () => {
    const { BriefingKarte } = await import('@/components/os/heute/Briefing');
    const html = renderToStaticMarkup(createElement(BriefingKarte, { i: 0, sicht: 'privat', vorgabe: ['Heute steht kein Termin im Kalender.', 'Bei den Aufgaben brennt nichts.'] }));
    expect(html).toContain('Tages-Briefing · Privat');
    expect(html).toContain('Heute steht kein Termin im Kalender. Bei den Aufgaben brennt nichts.');
    expect(html).toContain('Was bedeutet');
  });
});

describe('Register: Bestand je Person, Routen, Erklärungen', () => {
  it('heute-top3--* steht im Speicher-Register (Bereich „person“, mit Angaben), bei den Konto-Beständen und ist immer mit Suffix', async () => {
    const { registerEintrag, bereichVonBestand } = await import('@/lib/crm/speicher-register');
    const e = registerEintrag('heute-top3--kevin');
    expect(e?.rechtsgrundlage).toMatch(/Art\. 6/);
    expect(e?.art15?.length).toBeGreaterThan(10);
    expect(e?.loeschfrist).toContain('45 Tage');
    expect(bereichVonBestand('heute-top3--kevin')).toBe('person');
    const kd = await import('@/lib/datenschutz/konto-daten');
    expect(kd.PERSON_BESTAENDE.find(b => b.basis === 'heute-top3')?.nurMitSuffix).toBe(true);
    expect(kd.personBestandNamen('kevin', ['heute-top3', 'heute-top3--kevin', 'heute-top3--malin'])).toEqual([{ name: 'heute-top3--kevin', export: true }]);
  });
  it('Erklärungen mit Fallbeispiel für Top 3, Briefing, Freigaben, Jahresziele und Eisenhower', async () => {
    const { erklaerungFuer } = await import('@/lib/erklaerungen');
    for (const k of ['heute.top3', 'heute.briefing', 'heute.freigaben', 'heute.jahresziele', 'heute.eisenhower']) {
      const t = erklaerungFuer(k);
      expect(t?.was.length, k).toBeGreaterThan(80);
      expect(t?.beispiel.length, k).toBeGreaterThan(80);
    }
    expect(erklaerungFuer('heute.top3')?.daten).toMatch(/ohne KI/);
  });
  it('Demo-Saat zeigt Freigaben und Top 3', () => {
    const s = lies('lib/demo/saat.ts');
    expect(s).toContain("R.top3(), 'PUT', '/api/heute/top3'");
    expect(s).toContain("await lege({ werkzeug: 'create_task'");
  });
});
