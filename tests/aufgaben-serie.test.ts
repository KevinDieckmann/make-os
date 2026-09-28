// ─── Aufgaben-Serien und Vorlagen (Paket C3, 28.09. spät) ────────────────────
// Regeln (Monatsende, Schaltjahr, Zeitumstellung), Instanz beim Erledigen (idempotent, eine offene je Serie),
// Serien-Listen im Morgenlauf (idempotent, Lawinen-Grenze), Vorlagen speichern/anlegen, Säuberung, Render.
// Eigener Datenordner, erfundene Konten/Aufgaben — nie echte Daten.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Task, TasksState, AufgabenListe, Wiederholung } from '@/types/tasks';
import {
  naechsterTermin, vorherigerTermin, ersterTermin, naechsterAbHeute, termineNach, faelligeTermine, berlinerTag, kalenderwoche,
  titelMitPlatzhaltern, grundTitel, standardMuster, wiederholungText, kurzTag,
} from '@/lib/aufgaben/wiederholung';
import { naechsteInstanz, serienBeimErledigen, serienAufgabenNachholen, serienLauf, serieVon, instanzId, wiederholungSetzen, listenSerieStarten } from '@/lib/aufgaben/serie';
import { vorlageAusProjekt, vorlageAusListe, ausVorlageAnlegen, vorlageZuGross, vorlagenFuer, STARTVORLAGEN } from '@/lib/aufgaben/vorlagen';
import { taskSauber, listeSauber, vorlageSauber } from '@/lib/aufgaben/saeubern';
import { uebernehmen } from '@/lib/aufgaben/struktur';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-aufgaben-serie-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-aufgaben-serie';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
vi.mock('@/lib/meldungen/melden', () => ({ melde: async () => {} }));
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

const T0 = '2026-09-01T08:00:00.000Z';
const JETZT = '2026-09-30T08:00:00.000Z';
const aufgabe = (id: string, extra: Partial<Task> = {}): Task => ({ id, projectId: 'p1', title: `Aufgabe ${id}`, status: 'todo', priority: 'medium', assignee: 'kevin', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: T0, updatedAt: T0, spaceId: 'kdv', ...extra });
const W = (w: Wiederholung) => w;

describe('Regeln: nächster Termin', () => {
  it('täglich, Intervall, `bis`', () => {
    expect(naechsterTermin(W({ regel: 'taeglich' }), '2026-09-28')).toBe('2026-09-29');
    expect(naechsterTermin(W({ regel: 'taeglich', intervall: 3 }), '2026-09-28')).toBe('2026-10-01');
    expect(naechsterTermin(W({ regel: 'taeglich', bis: '2026-10-01' }), '2026-09-30')).toBe('2026-10-01');
    expect(naechsterTermin(W({ regel: 'taeglich', bis: '2026-10-01' }), '2026-10-01')).toBeNull();
    expect(naechsterTermin(W({ regel: 'taeglich' }), 'quatsch')).toBeNull();
  });
  it('Zeitumstellung verschiebt keinen Tag (Kalendertage, Berliner Tag)', () => {
    expect(termineNach(W({ regel: 'taeglich' }), '2026-10-24', 2)).toEqual(['2026-10-25', '2026-10-26']);
    expect(termineNach(W({ regel: 'taeglich' }), '2026-03-28', 2)).toEqual(['2026-03-29', '2026-03-30']);
    expect(berlinerTag(new Date('2026-10-24T22:30:00Z'))).toBe('2026-10-25'); // 00:30 Sommerzeit
    expect(berlinerTag(new Date('2026-10-25T22:30:00Z'))).toBe('2026-10-25'); // 23:30 Winterzeit
    expect(berlinerTag(new Date('2026-03-28T23:30:00Z'))).toBe('2026-03-29'); // 00:30 Winterzeit
  });
  it('Werktage: Freitag → Montag, Samstag → Montag', () => {
    expect(naechsterTermin(W({ regel: 'werktage' }), '2026-10-02')).toBe('2026-10-05');
    expect(naechsterTermin(W({ regel: 'werktage' }), '2026-10-03')).toBe('2026-10-05');
    expect(naechsterTermin(W({ regel: 'werktage', intervall: 2 }), '2026-10-01')).toBe('2026-10-05');
  });
  it('wöchentlich mit Wochentagen und Intervall', () => {
    const w = W({ regel: 'woechentlich', wochentage: [1, 4] });
    expect(naechsterTermin(w, '2026-09-28')).toBe('2026-10-01');
    expect(naechsterTermin(w, '2026-10-01')).toBe('2026-10-05');
    expect(naechsterTermin({ ...w, intervall: 2 }, '2026-10-01')).toBe('2026-10-12');
    expect(naechsterTermin(W({ regel: 'woechentlich' }), '2026-09-28')).toBe('2026-10-05');
    expect(vorherigerTermin(w, '2026-10-05')).toBe('2026-10-01');
  });
  it('monatlich mit Monatsende-Kappung (31 → 30/28/29) und zurück auf 31', () => {
    const w = W({ regel: 'monatlich', monatstag: 31 });
    expect(termineNach(w, '2026-01-31', 4)).toEqual(['2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31']);
    expect(naechsterTermin(w, '2028-01-31')).toBe('2028-02-29');
    expect(naechsterTermin(W({ regel: 'monatlich', monatstag: 15 }), '2026-10-03')).toBe('2026-10-15');
    expect(naechsterTermin(W({ regel: 'monatlich', monatstag: 15, intervall: 3 }), '2026-10-15')).toBe('2027-01-15');
    expect(vorherigerTermin(W({ regel: 'monatlich', monatstag: 1 }), '2026-10-01')).toBe('2026-09-01');
  });
  it('jährlich: 29.02. im Schaltjahr, sonst 28.02.', () => {
    expect(termineNach(W({ regel: 'jaehrlich', monatstag: 29 }), '2028-02-29', 4)).toEqual(['2029-02-28', '2030-02-28', '2031-02-28', '2032-02-29']);
    expect(naechsterTermin(W({ regel: 'jaehrlich' }), '2026-09-28')).toBe('2027-09-28');
  });
  it('erster Termin, nie in der Vergangenheit, fällige Termine', () => {
    expect(ersterTermin(W({ regel: 'monatlich', monatstag: 1 }), '2026-09-29')).toBe('2026-10-01');
    expect(ersterTermin(W({ regel: 'monatlich', monatstag: 1 }), '2026-10-01')).toBe('2026-10-01');
    expect(ersterTermin(W({ regel: 'werktage' }), '2026-10-03')).toBe('2026-10-05');
    expect(ersterTermin(W({ regel: 'woechentlich', wochentage: [4] }), '2026-09-28')).toBe('2026-10-01');
    expect(naechsterAbHeute(W({ regel: 'taeglich' }), '2026-09-01', '2026-09-28')).toBe('2026-09-28');
    expect(naechsterAbHeute(W({ regel: 'monatlich', monatstag: 1 }), '2026-06-01', '2026-09-28')).toBe('2026-10-01');
    expect(faelligeTermine(W({ regel: 'monatlich', monatstag: 1 }), '2026-07-01', '2026-09-28')).toEqual({ termine: ['2026-07-01', '2026-08-01', '2026-09-01'], mehr: false });
    expect(faelligeTermine(W({ regel: 'taeglich' }), '2026-01-01', '2026-09-28', 5).mehr).toBe(true);
  });
  it('Anzeige und Platzhalter', () => {
    expect(kurzTag('2026-10-05')).toBe('Mo 05.10.');
    expect(wiederholungText(W({ regel: 'woechentlich', intervall: 2, wochentage: [0, 1] }))).toBe('alle 2 Wochen (Mo, So)');
    expect(wiederholungText(W({ regel: 'monatlich', monatstag: 31, bis: '2026-12-31' }))).toBe('monatlich am 31. (sonst Monatsende) bis 31.12.2026');
    expect(kalenderwoche('2026-09-28')).toEqual({ kw: 40, jahr: 2026 });
    expect(kalenderwoche('2027-01-01')).toEqual({ kw: 53, jahr: 2026 });
    expect(titelMitPlatzhaltern('Monatsabschluss {Monat} {Jahr}', '2026-10-01')).toBe('Monatsabschluss Oktober 2026');
    expect(titelMitPlatzhaltern('Wochenplan KW {KW} · {Datum}', '2026-10-05')).toBe('Wochenplan KW 41 · 05.10.2026');
    expect(grundTitel('Monatsabschluss September 2026')).toBe('Monatsabschluss');
    expect(grundTitel('Wochenplan KW 40/2026')).toBe('Wochenplan');
    expect(grundTitel('Januar')).toBe('Januar');
    expect(standardMuster('Abschluss', 'monatlich')).toBe('Abschluss {Monat} {Jahr}');
  });
});

describe('Wiederkehrende Aufgabe: Instanz beim Erledigen', () => {
  const erledigt = (extra: Partial<Task> = {}) => aufgabe('a1', {
    status: 'done', completedAt: JETZT, dueDate: '2026-09-30', startDate: '2026-09-25', wiederholung: { regel: 'monatlich', monatstag: 31 },
    notiz: '- [ ] prüfen', felder: { budget: 100 }, bezug: { firmaId: 'f-muster' }, listeId: 'l1', statusId: 'eigen-x', abhaengigVon: ['z'],
    kommentare: [{ id: 'k1', von: 'kevin', text: 'bitte bis Freitag', am: T0 }], verlauf: [{ am: T0, von: 'kevin', was: 'angelegt' }], zoe: { status: 'freigegeben' }, ...extra,
  });
  const unter = aufgabe('a1-sub', { parentId: 'a1', status: 'done', dueDate: '2026-09-28', title: 'Beleg', listeId: 'l1' });

  it('neue Deadline, Unteraufgaben zurückgesetzt und mitverschoben, Kommentare/Verlauf/ZOE nicht kopiert', () => {
    const [inst, u, ...rest] = naechsteInstanz(erledigt(), [erledigt(), unter], '2026-09-30', JETZT);
    expect(rest).toEqual([]);
    expect(inst.id).toBe(instanzId('serie:a1', '2026-10-31'));
    expect(inst).toMatchObject({ status: 'todo', dueDate: '2026-10-31', startDate: '2026-10-26', serieId: 'a1', notiz: '- [ ] prüfen', felder: { budget: 100 }, bezug: { firmaId: 'f-muster' }, listeId: 'l1', assignee: 'kevin', wiederholung: { regel: 'monatlich', monatstag: 31 } });
    for (const k of ['kommentare', 'verlauf', 'zoe', 'completedAt', 'statusId', 'abhaengigVon'] as const) expect(inst[k]).toBeUndefined();
    expect(u).toMatchObject({ id: `${inst.id}-u1`, parentId: inst.id, status: 'todo', title: 'Beleg', dueDate: '2026-10-29' });
    expect(taskSauber(inst)).toEqual(inst);
    expect(serieVon(inst)).toBe(serieVon(erledigt()));
  });
  it('idempotent: höchstens eine offene Instanz je Serie; dieselbe Kennung nie zweimal', () => {
    const erste = naechsteInstanz(erledigt(), [erledigt(), unter], '2026-09-30', JETZT);
    expect(naechsteInstanz(erledigt(), [erledigt(), unter, ...erste], '2026-09-30', JETZT)).toEqual([]);
    const fertig = { ...erste[0], status: 'done' as const };
    expect(naechsteInstanz(erledigt(), [erledigt(), fertig], '2026-09-30', JETZT)).toEqual([]); // Kennung gibt es schon
    const weiter = naechsteInstanz(fertig, [erledigt(), fertig], '2026-09-30', JETZT);
    expect(weiter[0].dueDate).toBe('2026-11-30');
  });
  it('lange weg: springt auf den ersten Termin ab heute (keine Lawine); `bis` beendet', () => {
    expect(naechsteInstanz(erledigt({ dueDate: '2026-06-30' }), [], '2026-09-28', JETZT)[0].dueDate).toBe('2026-09-30');
    expect(naechsteInstanz(erledigt({ wiederholung: { regel: 'monatlich', monatstag: 31, bis: '2026-10-15' } }), [], '2026-09-30', JETZT)).toEqual([]);
    expect(naechsteInstanz(erledigt({ status: 'todo' }), [], '2026-09-30', JETZT)).toEqual([]);
  });
  it('nur beim Übergang offen → erledigt', () => {
    const offen = { ...erledigt(), status: 'todo' as const };
    expect(serienBeimErledigen([offen], [erledigt()], ['a1'], '2026-09-30', JETZT)).toHaveLength(1);
    expect(serienBeimErledigen([erledigt()], [{ ...erledigt(), title: 'neu' }], ['a1'], '2026-09-30', JETZT)).toEqual([]);
  });
  it('Morgenlauf holt nur nach, wenn der Termin spätestens morgen ist und nichts offen ist', () => {
    const t = aufgabe('d1', { status: 'done', dueDate: '2026-09-27', wiederholung: { regel: 'taeglich' } });
    expect(serienAufgabenNachholen([t], '2026-09-28', JETZT).map(x => x.dueDate)).toEqual(['2026-09-28']);
    const m = aufgabe('m1', { status: 'done', dueDate: '2026-09-30', wiederholung: { regel: 'monatlich', monatstag: 31 } });
    expect(serienAufgabenNachholen([m], '2026-09-30', JETZT)).toEqual([]);
    const offen = aufgabe('o1', { vorlageId: 'serie:d1', dueDate: '2026-09-28', wiederholung: { regel: 'taeglich' } });
    expect(serienAufgabenNachholen([t, offen], '2026-09-28', JETZT)).toEqual([]);
  });
  it('Wiederholung setzen: ohne Deadline wird der erste Termin die Deadline', () => {
    expect(wiederholungSetzen({}, { regel: 'monatlich', monatstag: 1, naechste: '2026-01-01' }, '2026-09-28')).toEqual({ wiederholung: { regel: 'monatlich', monatstag: 1 }, dueDate: '2026-10-01' });
    expect(wiederholungSetzen({ dueDate: '2026-10-10' }, { regel: 'taeglich' }, '2026-09-28')).toEqual({ wiederholung: { regel: 'taeglich' } });
    expect(wiederholungSetzen({ dueDate: '2026-10-10' }, undefined)).toEqual({ wiederholung: undefined });
  });
});

describe('Wiederkehrende Liste im Morgenlauf', () => {
  const projekt = { id: 'p1', title: 'Buchhaltung', category: 'business' as const, owner: 'kevin' as const, color: '#58D9CD', tags: [], archived: false, createdAt: T0, updatedAt: T0, spaceId: 'kdv' };
  const eigene = { id: 'v-abschluss', art: 'liste' as const, titel: 'Monatsabschluss {Monat} {Jahr}', inhalt: STARTVORLAGEN[0].inhalt };
  const stand = (l: Partial<AufgabenListe> = {}): TasksState => ({
    projects: [projekt], tasks: [], statusEigen: [], gruppen: [], vorlagen: [eigene],
    listen: [{ id: 'l-sep', projektId: 'p1', titel: 'Monatsabschluss September 2026', sortOrder: 0, wiederholung: { regel: 'monatlich', monatstag: 1, naechste: '2026-10-01' }, vorlageId: 'v-abschluss', ...l }],
  });

  it('noch nicht fällig → nichts', () => {
    expect(serienLauf(stand(), '2026-09-30', JETZT).geaendert).toBe(false);
  });
  it('fällig → neue Liste mit Aufgaben (Deadline = Start + Versatz), Zeiger wandert; zweiter Lauf ändert nichts', () => {
    const r = serienLauf(stand(), '2026-10-01', JETZT);
    expect(r.neueListen).toHaveLength(1);
    const neu = r.neueListen[0];
    expect(neu).toMatchObject({ titel: 'Monatsabschluss Oktober 2026', projektId: 'p1', sortOrder: 1, vorlageId: 'v-abschluss', wiederholung: { regel: 'monatlich', monatstag: 1, naechste: '2026-11-01' } });
    expect(r.state.listen!.find(l => l.id === 'l-sep')!.wiederholung).toBeUndefined();
    const oben = r.neueAufgaben.filter(t => !t.parentId);
    expect(oben.map(t => [t.title, t.dueDate])).toEqual([['Belege sammeln', '2026-10-03'], ['Kontoauszüge abrufen', '2026-10-04'], ['Rechnungen prüfen', '2026-10-06'], ['An Steuerberater übergeben', '2026-10-09']]);
    expect(r.neueAufgaben).toHaveLength(9);
    expect(r.neueAufgaben.every(t => t.listeId === neu.id && t.spaceId === 'kdv' && t.status === 'todo' && t.assignee === 'kevin')).toBe(true);
    for (const t of r.neueAufgaben) expect(taskSauber(t)).not.toBeNull();
    expect(listeSauber(neu)).toEqual(neu);
    const zwei = serienLauf(r.state, '2026-10-01', JETZT);
    expect(zwei.geaendert).toBe(false);
    expect(uebernehmen(r.state).state.tasks).toHaveLength(9);
  });
  it('Liste der Periode gibt es schon (alter Zeiger zurückgeschrieben) → keine zweite', () => {
    const r = serienLauf(stand(), '2026-10-01', JETZT);
    const zurueck: TasksState = { ...r.state, listen: r.state.listen!.map(l => (l.id === 'l-sep' ? stand().listen![0] : l)) };
    const zwei = serienLauf(zurueck, '2026-10-01', JETZT);
    expect(zwei.neueListen).toEqual([]);
    expect(zwei.neueAufgaben).toEqual([]);
    expect(zwei.state.listen!.filter(l => l.wiederholung)).toHaveLength(1);
  });
  it('Lawinen-Grenze: monatlich die älteste verpasste zuerst (eine je Lauf), mit Hinweis', () => {
    const r = serienLauf(stand({ wiederholung: { regel: 'monatlich', monatstag: 1, naechste: '2026-07-01' } }), '2026-09-28', JETZT);
    expect(r.neueListen.map(l => l.titel)).toEqual(['Monatsabschluss Juli 2026']);
    expect(r.neueListen[0].wiederholung!.naechste).toBe('2026-08-01');
    expect(r.hinweise.join(' ')).toMatch(/noch 2 weitere Perioden offen/);
  });
  it('Lawinen-Grenze: Werktage nur die jüngste, ältere übersprungen', () => {
    const r = serienLauf(stand({ titel: 'Tagesplan 31.08.2026', vorlageId: undefined, wiederholung: { regel: 'werktage', naechste: '2026-09-01' } }), '2026-09-28', JETZT);
    expect(r.neueListen).toHaveLength(1);
    expect(r.neueListen[0].titel).toBe('Tagesplan 28.09.2026');
    expect(r.neueListen[0].wiederholung!.naechste).toBe('2026-09-29');
    expect(r.hinweise.join(' ')).toMatch(/übersprungen/);
    expect(r.hinweise.join(' ')).toMatch(/keine Vorlage/);
  });
  it('ohne Zeiger: nur den Zeiger setzen; `bis` vorbei: Serie endet', () => {
    const ohne = serienLauf(stand({ wiederholung: { regel: 'monatlich', monatstag: 1 } }), '2026-09-28', JETZT);
    expect(ohne.neueListen).toEqual([]);
    expect(ohne.state.listen![0].wiederholung!.naechste).toBe('2026-10-01');
    const ende = serienLauf(stand({ wiederholung: { regel: 'monatlich', monatstag: 1, naechste: '2026-10-01', bis: '2026-09-30' } }), '2026-10-01', JETZT);
    expect(ende.neueListen).toEqual([]);
    expect(ende.state.listen![0].wiederholung).toBeUndefined();
    expect(listenSerieStarten({ regel: 'monatlich', monatstag: 1 }, '2026-09-28')).toEqual({ regel: 'monatlich', monatstag: 1, naechste: '2026-10-01' });
  });
});

describe('Vorlagen speichern und anlegen', () => {
  const stand = (): TasksState => ({
    projects: [{ id: 'p-launch', title: 'Launch', category: 'business', owner: 'both', color: '#DE9E63', tags: [], archived: false, createdAt: T0, updatedAt: T0, spaceId: 'kdv', start: '2026-10-01', notiz: '## Plan', felder: [{ id: 'budget', name: 'Budget', typ: 'betrag' }] }],
    gruppen: [{ id: 'g1', projektId: 'p-launch', titel: 'Marketing', farbe: '#E27FD0', sortOrder: 0 }],
    listen: [{ id: 'l1', projektId: 'p-launch', titel: 'Woche 1', sortOrder: 0, gruppeId: 'g1' }, { id: 'l2', projektId: 'p-launch', titel: 'Woche 2', sortOrder: 1 }],
    statusEigen: [], vorlagen: [],
    tasks: [
      aufgabe('t1', { projectId: 'p-launch', listeId: 'l1', dueDate: '2026-10-04', bezug: { kontaktId: 'c-anna1' }, kommentare: [{ id: 'k', von: 'kevin', text: 'geheim', am: T0 }], felder: { budget: 5000 }, zoe: { status: 'offen' } }),
      aufgabe('t1a', { projectId: 'p-launch', listeId: 'l1', parentId: 't1', dueDate: '2026-10-02', title: 'Entwurf' }),
      aufgabe('t2', { projectId: 'p-launch', listeId: 'l2', description: 'Kurz beschrieben' }),
      aufgabe('t3', { projectId: 'p-launch', dueDate: '2026-10-11', priority: 'high', assignee: 'malin' }),
    ],
  });

  it('Projekt → Vorlage: Struktur vollständig, ohne CRM-Bezug, Kommentare, Feldwerte, ZOE; übersteht die Säuberung', () => {
    const v = vorlageAusProjekt(stand(), 'p-launch', { id: 'v-1', jetzt: JETZT })!;
    expect(v).toEqual({
      id: 'v-1', art: 'projekt', titel: 'Launch', angelegt: JETZT,
      inhalt: {
        gruppen: [{ titel: 'Marketing', farbe: '#E27FD0' }],
        listen: [
          { titel: 'Woche 1', gruppe: 'Marketing', aufgaben: [{ titel: 'Aufgabe t1', zustaendig: 'kevin', versatzTage: 3, unter: [{ titel: 'Entwurf', zustaendig: 'kevin', versatzTage: 1 }] }] },
          { titel: 'Woche 2', aufgaben: [{ titel: 'Aufgabe t2', beschreibung: 'Kurz beschrieben', zustaendig: 'kevin' }] },
        ],
        aufgaben: [{ titel: 'Aufgabe t3', prioritaet: 'high', zustaendig: 'malin', versatzTage: 10 }],
        felder: [{ id: 'budget', name: 'Budget', typ: 'betrag' }],
        notiz: '## Plan',
      },
    });
    expect(JSON.stringify(v)).not.toMatch(/c-anna1|geheim|5000|zoe/);
    expect(vorlageSauber(v)).toEqual(v);
    expect(vorlageZuGross(v)).toBeNull();
  });
  it('Liste → Vorlage: Versatz ab Bezugstag', () => {
    const v = vorlageAusListe(stand(), 'l1', { id: 'v-2', bezugsTag: '2026-10-01', jetzt: JETZT })!;
    expect(v.inhalt).toEqual({ aufgaben: [{ titel: 'Aufgabe t1', zustaendig: 'kevin', versatzTage: 3, unter: [{ titel: 'Entwurf', zustaendig: 'kevin', versatzTage: 1 }] }] });
  });
  it('Vorlage → Projekt im Mandanten-Space: Gruppen, Listen, Aufgaben, Deadlines ab Start, Firma vorbelegt', () => {
    const v = vorlageAusProjekt(stand(), 'p-launch', { id: 'v-1', jetzt: JETZT })!;
    const r = ausVorlageAnlegen(v, stand(), { spaceId: 'm-f-muster', start: '2026-11-02', praefix: 'p-neu', owner: 'kevin', jetzt: JETZT, titel: 'Launch {Monat}' });
    expect(r.projekt).toMatchObject({ id: 'p-neu', title: 'Launch November', spaceId: 'm-f-muster', start: '2026-11-02', vorlageId: 'v-1', notiz: '## Plan', felder: [{ id: 'budget', name: 'Budget', typ: 'betrag' }] });
    expect(r.gruppen).toEqual([{ id: 'p-neu-g1', projektId: 'p-neu', titel: 'Marketing', farbe: '#E27FD0', sortOrder: 0 }]);
    expect(r.listen.map(l => [l.id, l.titel, l.gruppeId])).toEqual([['p-neu-l1', 'Woche 1', 'p-neu-g1'], ['p-neu-l2', 'Woche 2', undefined]]);
    expect(r.tasks.map(t => [t.id, t.parentId, t.dueDate, t.assignee])).toEqual([
      ['p-neu-l1-a1', undefined, '2026-11-05', 'kevin'], ['p-neu-l1-a1-u1', 'p-neu-l1-a1', '2026-11-03', 'kevin'],
      ['p-neu-l2-a1', undefined, undefined, 'kevin'], ['p-neu-s-a1', undefined, '2026-11-12', 'malin'],
    ]);
    expect(r.tasks.every(t => t.bezug?.firmaId === 'f-muster' && t.spaceId === 'm-f-muster')).toBe(true);
    const s: TasksState = { ...stand(), projects: [...stand().projects, r.projekt!], gruppen: [...stand().gruppen!, ...r.gruppen], listen: [...stand().listen!, ...r.listen], tasks: [...stand().tasks, ...r.tasks] };
    const ueb = uebernehmen(s);
    expect(ueb.state.tasks.filter(t => t.projectId === 'p-neu')).toHaveLength(4);
    expect(ueb.state.listen!.find(l => l.id === 'p-neu-l1')!.gruppeId).toBe('p-neu-g1');
    for (const t of r.tasks) expect(taskSauber(t)).not.toBeNull();
  });
  it('mitgelieferte Startvorlagen: sauber, ohne echte Daten; Listen-Vorlage in ein Projekt', () => {
    expect(STARTVORLAGEN.map(v => v.titel)).toEqual(['Monatsabschluss Buchhaltung', 'Mandats-Onboarding', 'Launch-Projekt']);
    for (const v of STARTVORLAGEN) expect(vorlageSauber(v)).toEqual(v);
    expect(STARTVORLAGEN[2].inhalt.gruppen!.map(g => g.titel)).toEqual(['Marketing', 'Sales', 'Operations']);
    const r = ausVorlageAnlegen(STARTVORLAGEN[0], stand(), { spaceId: 'kdv', projektId: 'p-launch', start: '2026-10-01', titel: 'Monatsabschluss {Monat} {Jahr}', praefix: 'l-neu', owner: 'malin', jetzt: JETZT });
    expect(r.listen).toEqual([{ id: 'l-neu', projektId: 'p-launch', titel: 'Monatsabschluss Oktober 2026', sortOrder: 2 }]);
    expect(r.tasks).toHaveLength(9);
    expect(r.tasks.every(t => t.assignee === 'malin' && t.listeId === 'l-neu')).toBe(true);
    expect(vorlagenFuer([{ id: 'v-x', art: 'liste', titel: 'Nur UG', spaceId: 'ug', inhalt: {} }], 'liste', 'kdv').map(v => v.id)).toEqual(['start-monatsabschluss']);
  });
});

describe('Serien-Liste mit titelMuster, Vorlage mit Notiz/Feldern (28.09. spät)', () => {
  it('listenMuster nimmt das Muster der Liste; aufgabenAusVorlage übernimmt Notiz und Felder', async () => {
    const { listenMuster } = await import('@/lib/aufgaben/serie');
    const { aufgabenAusVorlage } = await import('@/lib/aufgaben/vorlagen');
    expect(listenMuster({ titel: 'Abschluss September', titelMuster: 'Abschluss {Monat} {Jahr}' }, { regel: 'monatlich' }, { titel: 'Anders {Monat}' })).toBe('Abschluss {Monat} {Jahr}');
    const t = aufgabenAusVorlage([{ titel: 'Belege', notiz: '- [ ] Bank', felder: { budget: 100 } }], { spaceId: 'kdv', projectId: 'p1', praefix: 'x', owner: 'kevin', jetzt: JETZT });
    expect(t[0]).toMatchObject({ notiz: '- [ ] Bank', felder: { budget: 100 } });
  });
});

describe('Säuberung der Serienfelder', () => {
  it('Serien-Kennung an der Aufgabe, Zeiger an der Liste bleiben', () => {
    expect(taskSauber(aufgabe('a', { vorlageId: 'serie:a1', wiederholung: { regel: 'taeglich', naechste: '2026-10-01' } }))!.vorlageId).toBe('serie:a1');
    expect(listeSauber({ id: 'l', projektId: 'p', titel: 'X', sortOrder: 0, wiederholung: { regel: 'monatlich', monatstag: 31, naechste: '2026-10-31', bis: 'morgen' }, vorlageId: 'start-monatsabschluss' }))
      .toEqual({ id: 'l', projektId: 'p', titel: 'X', sortOrder: 0, wiederholung: { regel: 'monatlich', monatstag: 31, naechste: '2026-10-31' }, vorlageId: 'start-monatsabschluss' });
  });
});

// ── Schreibweg + Morgenlauf gegen einen eigenen Datenordner ────────────────
type Handler = (r: Request) => Promise<Response>;
let route: { GET: Handler; PATCH: Handler };
let db: typeof import('@/lib/store/local-db');
const konto = (id: string, speicher: string, name: string, rolle: 'inhaber' | 'mitglied', haushalt?: string) => ({ id, speicher, email: `${speicher}@test.invalid`, name, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...(haushalt ? { haushalt } : {}) });
const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
const anfrage = (kopf: Record<string, string>, method = 'GET', body?: unknown) => new Request('http://test/api/state/tasks', { method, headers: kopf, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
type Zeile = Task & { stand: string };
const lesen = async () => (await (await route.GET(anfrage(sitzung('kevin')))).json()) as { state: { tasks: Zeile[] } };
const gespeichert = async () => (await db.loadJson<TasksState>('tasks'))!;

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'Kevin Beispiel', 'inhaber', 'haus'), konto('k2', 'malin', 'Malin Beispiel', 'mitglied', 'haus')], einladungen: [] });
  await db.saveJson('crm', { firmen: [], mandate: [] });
  route = (await import('@/app/api/state/tasks/route')) as unknown as typeof route;
});

describe('Schreibweg: Erledigen erzeugt die nächste Instanz', () => {
  it('PATCH erledigt → Instanz mit Verlauf „angelegt“ durch System, Antwort `serien`; wieder öffnen nimmt die unberührte Instanz zurück (T1, #12) → erledigen legt sie neu an, genau eine offene', async () => {
    const heute = berlinerTag();
    await db.saveJson('tasks', { projects: [], listen: [], statusEigen: [], gruppen: [], vorlagen: [], tasks: [aufgabe('r1', { dueDate: heute, wiederholung: { regel: 'taeglich' } })] });
    const zeile = () => lesen().then(s => s.state.tasks.find(t => t.id === 'r1')!);
    const r1 = await zeile();
    const res = await route.PATCH(anfrage(sitzung('kevin'), 'PATCH', { ops: [{ op: 'upsert', task: { ...r1, status: 'done', completedAt: JETZT }, stand: r1.stand }] }));
    const d = (await res.json()) as { ok: boolean; serien?: string[] };
    expect(d.ok).toBe(true);
    expect(d.serien).toHaveLength(1);
    const inst = (await gespeichert()).tasks.find(t => t.id === d.serien![0])!;
    expect(inst).toMatchObject({ status: 'todo', dueDate: naechsterTermin({ regel: 'taeglich' }, heute), serieId: 'r1' });
    expect(inst.vorlageId).toBeUndefined();
    expect(inst.verlauf).toEqual([expect.objectContaining({ was: 'angelegt', von: 'kevin', durch: 'system' })]);
    const r2 = await zeile();
    await route.PATCH(anfrage(sitzung('kevin'), 'PATCH', { ops: [{ op: 'upsert', task: { ...r2, status: 'todo', completedAt: undefined }, stand: r2.stand }] }));
    // Wieder offen: die gerade erzeugte, unberührte Folgeinstanz ist weg — nur r1 ist offen.
    expect((await gespeichert()).tasks.filter(t => serieVon(t) === 'serie:r1' && t.status !== 'done').map(t => t.id)).toEqual(['r1']);
    const r3 = await zeile();
    const res2 = await route.PATCH(anfrage(sitzung('kevin'), 'PATCH', { ops: [{ op: 'upsert', task: { ...r3, status: 'done', completedAt: JETZT }, stand: r3.stand }] }));
    expect(((await res2.json()) as { serien?: string[] }).serien).toEqual(d.serien);
    expect((await gespeichert()).tasks.filter(t => serieVon(t) === 'serie:r1' && t.status !== 'done')).toHaveLength(1);
  });
});

describe('Morgenlauf: aufgabenSerienNachziehen', () => {
  it('legt die fällige Liste einmal an (Verlauf durch System), zweiter Lauf schreibt nichts', async () => {
    const { aufgabenSerienNachziehen } = await import('@/lib/aufgaben/serie-server');
    await db.saveJson('tasks', {
      projects: [{ id: 'p1', title: 'Buchhaltung', category: 'business', owner: 'kevin', color: '#58D9CD', tags: [], archived: false, createdAt: T0, updatedAt: T0, spaceId: 'kdv' }],
      listen: [{ id: 'l-sep', projektId: 'p1', titel: 'Monatsabschluss September 2026', sortOrder: 0, wiederholung: { regel: 'monatlich', monatstag: 1, naechste: '2026-10-01' }, vorlageId: 'start-monatsabschluss' }],
      tasks: [], statusEigen: [], gruppen: [], vorlagen: [],
    });
    const lauf = await aufgabenSerienNachziehen(new Date('2026-09-30T22:30:00Z')); // 01.10. 00:30 in Berlin
    expect(lauf).toMatchObject({ listen: 1, aufgaben: 9 });
    const s = await gespeichert();
    expect(s.listen!.map(l => l.titel)).toEqual(['Monatsabschluss September 2026', 'Monatsabschluss Buchhaltung Oktober 2026']);
    expect(s.tasks.every(t => t.verlauf?.[0]?.durch === 'system')).toBe(true);
    const vorher = JSON.stringify(s);
    expect(await aufgabenSerienNachziehen(new Date('2026-10-01T06:00:00Z'))).toEqual({ listen: 0, aufgaben: 0, hinweise: [] });
    expect(JSON.stringify(await gespeichert())).toBe(vorher);
  });
});

describe('Oberfläche (Render)', () => {
  it('Wiederholung mit Vorschau, ↻, Vorlagen-Dialog mit den Startvorlagen', async () => {
    const { WiederholungWahl, SerienZeichen } = await import('@/components/os/aufgaben/WiederholungWahl');
    const { VorlagenDialog } = await import('@/components/os/aufgaben/VorlagenDialog');
    const { TasksProvider } = await import('@/context/TasksContext');
    const wahl = renderToStaticMarkup(h(WiederholungWahl, { wert: { regel: 'monatlich', monatstag: 31 }, basis: '2026-10-31', onChange: () => {} }));
    expect(wahl).toContain('nächste: Mo 30.11.');
    expect(renderToStaticMarkup(h(SerienZeichen, { w: { regel: 'taeglich' } }))).toContain('↻');
    expect(renderToStaticMarkup(h(SerienZeichen, {}))).toBe('');
    const dialog = renderToStaticMarkup(h(TasksProvider, null, h(VorlagenDialog, { auftrag: { modus: 'anlegen', spaceId: 'kdv' }, onSchliessen: () => {} })));
    expect(dialog).toContain('Aus Vorlage anlegen');
    expect(dialog).toContain('Launch-Projekt');
    expect(dialog).toContain('Mandats-Onboarding');
  });
});
