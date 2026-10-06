// ─── Aufgaben-Ansichten Tabelle und Kalender (28.09. spät, Paket C5) ─────────
// Reine Logik (lib/aufgaben/ansichten.ts) + Render der beiden Ansichten (Server-Render, erfundene Aufgaben,
// kein Browser, kein Netz).
import { describe, it, expect, vi } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Project, Task, TasksState } from '@/types/tasks';
import {
  berlinHeute, tageZwischen, istUeberfaellig, tabellenSpalten, feldWertVon, feldText, felderMit, betragText, betragLesen, zahlLesen,
  sortWert, vergleiche, tabelleZeilen, nachVorgabe, naechsteSortierung, summen, merkerLesen, kalenderwoche, kalenderTage, ankerSchritt,
  kalenderTitel, kalenderEintraege, ohneDatum, wochenLegen, verdecktJeTag, verschiebenTeil, prioRang, type SortKontext,
} from '@/lib/aufgaben/ansichten';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/aufgaben' }));

const T0 = '2026-09-01T08:00:00.000Z';
const aufgabe = (id: string, extra: Partial<Task> = {}): Task => ({ id, projectId: 'p-mk', title: `Aufgabe ${id}`, status: 'todo', priority: 'medium', assignee: 'kevin', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: T0, updatedAt: T0, spaceId: 'kdv', ...extra });
const projekt = (id: string, title: string, extra: Partial<Project> = {}): Project => ({ id, title, category: 'business', owner: 'both', color: '#58D9CD', tags: [], archived: false, spaceId: 'kdv', createdAt: T0, updatedAt: T0, ...extra });

const P_MK = projekt('p-mk', 'Marketing', { felder: [{ id: 'budget', name: 'Budget', typ: 'betrag' }, { id: 'stueck', name: 'Stück', typ: 'zahl' }, { id: 'kanal', name: 'Kanal', typ: 'auswahl', optionen: ['Messe', 'Online', 'Brief'] }, { id: 'wer', name: 'Verantwortet', typ: 'person' }, { id: 'am', name: 'Termin', typ: 'datum' }] });
const P_OPS = projekt('p-ops', 'Operations', { felder: [{ id: 'budget', name: 'Budget', typ: 'betrag' }] });
const P_LEER = projekt('p-leer', 'Ohne Felder');

const kontext = (spalten = tabellenSpalten({ projects: [P_MK] }, [aufgabe('x')])): SortKontext => ({
  statusRang: t => ['todo', 'in-progress', 'blocked', 'done'].indexOf(t.status === 'backlog' ? 'todo' : t.status),
  person: o => (o === 'both' ? 'Beide' : o === 'kevin' ? 'Kevin' : 'Malin'),
  ort: t => (t.listeId === 'l-jan' ? 'Januar' : 'Sonstige'),
  crm: t => (t.bezug?.firmaId ? 'Muster GmbH' : ''),
  wartet: t => t.abhaengigVon?.length ?? 0,
  spalten,
});

describe('Allgemein', () => {
  it('Berliner Tag: kurz nach Mitternacht MESZ ist schon der neue Tag (UTC noch der alte)', () => {
    expect(berlinHeute(new Date('2026-09-28T22:30:00Z'))).toBe('2026-09-29');
    expect(berlinHeute(new Date('2026-12-31T22:59:00Z'))).toBe('2026-12-31');
    expect(berlinHeute(new Date('2026-12-31T23:01:00Z'))).toBe('2027-01-01');
  });
  it('Tage zwischen, überfällig, Prioritätsrang', () => {
    expect(tageZwischen('2026-03-28', '2026-03-30')).toBe(2);
    expect(tageZwischen('2026-10-05', '2026-09-28')).toBe(-7);
    expect(istUeberfaellig({ dueDate: '2026-09-27', status: 'todo' }, '2026-09-28')).toBe(true);
    expect(istUeberfaellig({ dueDate: '2026-09-27', status: 'done' }, '2026-09-28')).toBe(false);
    expect(istUeberfaellig({ dueDate: '2026-09-28', status: 'todo' }, '2026-09-28')).toBe(false);
    expect(prioRang('critical')).toBeLessThan(prioRang('low'));
  });
});

describe('Tabelle', () => {
  it('Spalten: feste + eigene Felder der Projekte im Kontext; bei zwei Projekten mit Projektnamen', () => {
    const eins = tabellenSpalten({ projects: [P_MK, P_OPS, P_LEER] }, [aufgabe('a')]);
    expect(eins.map(s => s.id).slice(0, 8)).toEqual(['titel', 'status', 'zustaendig', 'deadline', 'prioritaet', 'ort', 'crm', 'wartet']);
    expect(eins.filter(s => s.feld).map(s => s.label)).toEqual(['Budget', 'Stück', 'Kanal', 'Verantwortet', 'Termin']);
    expect(eins.find(s => s.id === 'feld:p-mk:budget')?.summe).toBe(true);
    expect(eins.find(s => s.id === 'feld:p-mk:kanal')?.summe).toBeFalsy();
    const zwei = tabellenSpalten({ projects: [P_MK, P_OPS] }, [aufgabe('a'), aufgabe('b', { projectId: 'p-ops' })]);
    expect(zwei.filter(s => s.feld).map(s => s.id)).toContain('feld:p-ops:budget');
    expect(zwei.find(s => s.id === 'feld:p-ops:budget')?.label).toBe('Budget · Operations');
  });
  it('Feldwert nur im eigenen Projekt; Anzeige typgerecht (Betrag aus Cent)', () => {
    const s = tabellenSpalten({ projects: [P_MK, P_OPS] }, [aufgabe('a'), aufgabe('b', { projectId: 'p-ops' })]);
    const mk = s.find(x => x.id === 'feld:p-mk:budget')!;
    expect(feldWertVon(aufgabe('a', { felder: { budget: 123456 } }), mk)).toBe(123456);
    expect(feldWertVon(aufgabe('b', { projectId: 'p-ops', felder: { budget: 99 } }), mk)).toBeUndefined();
    expect(feldText({ typ: 'betrag' }, 123456)).toBe(betragText(123456));
    expect(betragText(123456)).toMatch(/1\.234,56\s€/);
    expect(feldText({ typ: 'zahl' }, 1234.5)).toBe('1.234,5');
    expect(feldText({ typ: 'datum' }, '2026-10-03')).toBe('03.10.2026');
    expect(feldText({ typ: 'person' }, 'malin', p => (p === 'malin' ? 'Malin' : p))).toBe('Malin');
    expect(feldText({ typ: 'text' }, undefined)).toBe('');
  });
  it('Betrag und Zahl lesen: deutsch/englisch, Euro-Zeichen, leer = null, Unsinn = NaN', () => {
    expect(betragLesen('1.234,56')).toBe(123456);
    expect(betragLesen('1234,5 €')).toBe(123450);
    expect(betragLesen('1234.56')).toBe(123456);
    expect(betragLesen('1.234.567')).toBe(123456700);
    expect(betragLesen('-3,20')).toBe(-320);
    expect(betragLesen('  ')).toBeNull();
    expect(betragLesen('zwölf')).toBeNaN();
    expect(zahlLesen('2,5')).toBe(2.5);
    expect(zahlLesen('')).toBeNull();
    expect(zahlLesen('x1')).toBeNaN();
  });
  it('Feldwerte setzen/leeren — ohne Werte keine leere Hülle', () => {
    expect(felderMit(undefined, 'budget', 500)).toEqual({ budget: 500 });
    expect(felderMit({ budget: 500, kanal: 'Messe' }, 'budget', null)).toEqual({ kanal: 'Messe' });
    expect(felderMit({ budget: 500 }, 'budget', null)).toBeUndefined();
    expect(felderMit({ budget: 500 }, 'budget', Number.NaN)).toBeUndefined();
  });
  it('Sortieren: leere Werte immer unten, beide Richtungen; Zahlen numerisch; Text deutsch', () => {
    expect(vergleiche(null, 3, 'auf')).toBe(1);
    expect(vergleiche(null, 3, 'ab')).toBe(1);
    expect(vergleiche(2, 10, 'auf')).toBeLessThan(0);
    expect(vergleiche('äpfel', 'birnen', 'auf')).toBeLessThan(0);
    const k = kontext();
    const a = aufgabe('a', { dueDate: '2026-10-05', priority: 'low', felder: { budget: 5000, kanal: 'Brief' } });
    const b = aufgabe('b', { dueDate: '2026-09-30', priority: 'critical', felder: { kanal: 'Messe' } });
    const c = aufgabe('c', { priority: 'high', felder: { budget: 100 } });
    const nach = (spalte: string, r: 'auf' | 'ab') => tabelleZeilen([a, b, c], { spalte, richtung: r }, k, new Set()).map(z => z.task.id);
    expect(nach('deadline', 'auf')).toEqual(['b', 'a', 'c']);
    expect(nach('deadline', 'ab')).toEqual(['a', 'b', 'c']);
    expect(nach('prioritaet', 'auf')).toEqual(['b', 'c', 'a']);
    expect(nach('feld:p-mk:budget', 'auf')).toEqual(['c', 'a', 'b']);
    expect(nach('feld:p-mk:budget', 'ab')).toEqual(['a', 'c', 'b']);
    // Auswahl nach der Reihenfolge der Optionen (Messe · Online · Brief), nicht alphabetisch.
    expect(nach('feld:p-mk:kanal', 'auf')).toEqual(['b', 'a', 'c']);
    expect(sortWert(aufgabe('x', { assignee: 'both' }), 'zustaendig', k)).toBe('beide');
  });
  it('Zeilen: Unteraufgaben unter ihrer Aufgabe (nur aufgeklappt), gleich sortiert; ohne Sortierung die Vorgabe', () => {
    const k = kontext();
    const a = aufgabe('a', { dueDate: '2026-10-09' });
    const a1 = aufgabe('a1', { parentId: 'a', dueDate: '2026-10-08' });
    const a2 = aufgabe('a2', { parentId: 'a', dueDate: '2026-10-01' });
    const b = aufgabe('b', { dueDate: '2026-10-02' });
    const waise = aufgabe('w', { parentId: 'fehlt' });
    const zu = tabelleZeilen([a, a1, a2, b, waise], null, k, new Set());
    expect(zu.map(z => [z.task.id, z.tiefe, z.unter])).toEqual([['a', 0, 2], ['b', 0, 0], ['w', 0, 0]]);
    const offen = tabelleZeilen([a, a1, a2, b], { spalte: 'deadline', richtung: 'auf' }, k, new Set(['a']));
    expect(offen.map(z => `${z.task.id}:${z.tiefe}`)).toEqual(['b:0', 'a:0', 'a2:1', 'a1:1']);
  });
  it('Vorgabe-Reihenfolge, Kopfklick-Kreislauf, Summen über alle (auch Unteraufgaben)', () => {
    expect(nachVorgabe([aufgabe('c'), aufgabe('a'), aufgabe('x'), aufgabe('b')], ['a', 'b', 'c']).map(t => t.id)).toEqual(['a', 'b', 'c', 'x']);
    expect(naechsteSortierung(null, 'deadline')).toEqual({ spalte: 'deadline', richtung: 'auf' });
    expect(naechsteSortierung({ spalte: 'deadline', richtung: 'auf' }, 'deadline')).toEqual({ spalte: 'deadline', richtung: 'ab' });
    expect(naechsteSortierung({ spalte: 'deadline', richtung: 'ab' }, 'deadline')).toBeNull();
    expect(naechsteSortierung({ spalte: 'deadline', richtung: 'ab' }, 'titel')).toEqual({ spalte: 'titel', richtung: 'auf' });
    const spalten = tabellenSpalten({ projects: [P_MK, P_OPS] }, [aufgabe('a'), aufgabe('o', { projectId: 'p-ops' })]);
    const s = summen([
      aufgabe('a', { felder: { budget: 150000, stueck: 2 } }), aufgabe('a1', { parentId: 'a', felder: { budget: 2550, stueck: 1.5 } }),
      aufgabe('b', { felder: { kanal: 'Messe' } }), aufgabe('o', { projectId: 'p-ops', felder: { budget: 999 } }),
    ], spalten);
    expect(s['feld:p-mk:budget']).toEqual({ summe: 152550, anzahl: 2 });
    expect(s['feld:p-mk:stueck']).toEqual({ summe: 3.5, anzahl: 2 });
    expect(s['feld:p-ops:budget']).toEqual({ summe: 999, anzahl: 1 });
    expect(s['feld:p-mk:kanal']).toBeUndefined();
  });
  it('Merker: nur Gültiges, Titel nie ausblendbar, kaputtes JSON → Standard', () => {
    expect(merkerLesen('{"aus":["crm","titel",3],"sort":{"spalte":"deadline","richtung":"ab"}}')).toEqual({ aus: ['crm'], sort: { spalte: 'deadline', richtung: 'ab' } });
    expect(merkerLesen('{"sort":{"spalte":"x","richtung":"quer"}}')).toEqual({ aus: [], sort: null });
    expect(merkerLesen('{kaputt')).toEqual({ aus: [], sort: null });
    expect(merkerLesen(null)).toEqual({ aus: [], sort: null });
  });
});

describe('Kalender / Zeitachse', () => {
  it('Kalenderwoche, Tage der Ansicht, Schritt und Titel', () => {
    expect(kalenderwoche('2026-09-28')).toBe(40);
    expect(kalenderwoche('2027-01-01')).toBe(53);
    expect(kalenderwoche('2026-01-01')).toBe(1);
    const m = kalenderTage('monat', '2026-09-15');
    expect(m).toHaveLength(42);
    expect(m[0]).toBe('2026-08-31');
    expect(kalenderTage('woche', '2026-10-01')).toEqual(['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
    expect(ankerSchritt('monat', '2026-12-15', 1)).toBe('2027-01-01');
    expect(ankerSchritt('monat', '2026-01-31', -1)).toBe('2025-12-01');
    expect(ankerSchritt('woche', '2026-10-01', -1)).toBe('2026-09-24');
    expect(kalenderTitel('monat', '2026-09-15')).toBe('September 2026');
    expect(kalenderTitel('woche', '2026-10-01')).toBe('KW 40 · 28.09.–04.10.2026');
  });
  it('Einträge: Start → Deadline (Start nach Deadline zählt nicht), überfällig, wiederkehrend; ohne Datum extra', () => {
    const e = kalenderEintraege([
      aufgabe('a', { startDate: '2026-09-25', dueDate: '2026-10-02' }),
      aufgabe('b', { startDate: '2026-10-09', dueDate: '2026-10-02' }),
      aufgabe('c', { dueDate: '2026-09-20', wiederholung: { regel: 'monatlich' } }),
      aufgabe('d'), aufgabe('e', { dueDate: 'morgen' }),
    ], '2026-09-28');
    expect(e.map(x => [x.task.id, x.start, x.ende, x.ueberfaellig, x.wiederkehrend])).toEqual([
      ['a', '2026-09-25', '2026-10-02', false, false], ['b', '2026-10-02', '2026-10-02', false, false], ['c', '2026-09-20', '2026-09-20', true, true],
    ]);
    expect(ohneDatum([aufgabe('z', { title: 'Zebra' }), aufgabe('y', { title: 'Affe', status: 'done' }), aufgabe('x', { title: 'Bär' }), aufgabe('w', { dueDate: '2026-10-01' })]).map(t => t.id)).toEqual(['x', 'z', 'y']);
  });
  it('Balken je Woche: über Wochengrenzen geteilt, Bahnen ohne Überlappung, verdeckt je Tag', () => {
    const tage = kalenderTage('monat', '2026-09-15');
    const e = kalenderEintraege([
      aufgabe('lang', { startDate: '2026-09-02', dueDate: '2026-09-09' }),
      aufgabe('mi', { dueDate: '2026-09-02' }),
      aufgabe('mi2', { dueDate: '2026-09-02' }),
      aufgabe('mi3', { dueDate: '2026-09-02' }),
      aufgabe('fr', { dueDate: '2026-09-04' }),
    ], '2026-09-01');
    const w = wochenLegen(tage, e);
    expect(w).toHaveLength(6);
    const w1 = w[0]; // 31.08.–06.09.
    const lang1 = w1.balken.find(b => b.eintrag.task.id === 'lang')!;
    expect([lang1.von, lang1.bis, lang1.bahn, lang1.anfang, lang1.ende]).toEqual([2, 6, 0, true, false]);
    const lang2 = w[1].balken.find(b => b.eintrag.task.id === 'lang')!;
    expect([lang2.von, lang2.bis, lang2.anfang, lang2.ende]).toEqual([0, 2, false, true]);
    // Keine zwei Balken derselben Bahn überlappen sich.
    for (const z of w) for (const a of z.balken) for (const b of z.balken) if (a !== b && a.bahn === b.bahn) expect(a.bis < b.von || b.bis < a.von).toBe(true);
    expect(w1.bahnen).toBe(4);
    expect(verdecktJeTag(w1, 3)).toEqual([0, 0, 1, 0, 0, 0, 0]);
    // „fr“ passt in eine freie Bahn neben den Mittwochs-Einträgen.
    expect(w1.balken.find(b => b.eintrag.task.id === 'fr')!.bahn).toBeLessThan(3);
  });
  it('Verschieben: Deadline auf den Tag, Start wandert mit; gleicher Tag/ungültig → nichts', () => {
    expect(verschiebenTeil({ dueDate: '2026-10-02' }, '2026-10-05')).toEqual({ dueDate: '2026-10-05' });
    expect(verschiebenTeil({ dueDate: '2026-10-02', startDate: '2026-09-28' }, '2026-10-05')).toEqual({ dueDate: '2026-10-05', startDate: '2026-10-01' });
    expect(verschiebenTeil({ dueDate: '2026-03-30', startDate: '2026-03-27' }, '2026-03-26')).toEqual({ dueDate: '2026-03-26', startDate: '2026-03-23' });
    expect(verschiebenTeil({}, '2026-10-05')).toEqual({ dueDate: '2026-10-05' });
    expect(verschiebenTeil({ dueDate: '2026-10-05' }, '2026-10-05')).toBeNull();
    expect(verschiebenTeil({ dueDate: '2026-10-05' }, '5.10.')).toBeNull();
  });
});

// ── Render ───────────────────────────────────────────────────────────────────
const PERSONEN = [{ speicher: 'kevin', name: 'Kevin', namen: ['Kevin', 'kevin'] }, { speicher: 'malin', name: 'Malin', namen: ['Malin', 'malin'] }];
const STATE: TasksState = {
  projects: [P_MK],
  // Vorher (bis 06.10.): Liste „Januar“ in der Gruppe „Sales“ → Ort „Sales › Januar“. Seit dem Umbau v3 gibt es keine Gruppen; die
  // Liste trägt die Farbe selbst, der Ort ist nur noch die Liste.
  listen: [{ id: 'l-jan', projektId: 'p-mk', titel: 'Januar', sortOrder: 0, farbe: '#FF9F43' }],
  statusEigen: [{ id: 's-pruef', spaceId: 'kdv', label: 'In Prüfung', farbe: '#C77DFF', basis: 'in-progress', sortOrder: 0 }],
  vorlagen: [],
  tasks: [
    aufgabe('t-messe', { title: 'Messestand buchen', listeId: 'l-jan', dueDate: '2026-09-25', startDate: '2026-09-21', priority: 'high', felder: { budget: 250000, kanal: 'Messe', wer: 'malin', am: '2026-10-03' }, bezug: { firmaId: 'f-muster' } }),
    aufgabe('t-flyer', { title: 'Flyer drucken', listeId: 'l-jan', dueDate: '2026-10-02', statusId: 's-pruef', status: 'in-progress', abhaengigVon: ['t-messe'], felder: { budget: 4990, stueck: 500 }, wiederholung: { regel: 'monatlich' } }),
    aufgabe('t-beleg', { title: 'Beleg Standmiete', parentId: 't-messe', listeId: 'l-jan', felder: { budget: 1000 } }),
    aufgabe('t-idee', { title: 'Newsletter-Idee' }),
  ],
};

describe('Ansichten zeichnen', () => {
  it('Tabelle: Kopf sortierbar, Status/Zuständig/Priorität als Wahl, Deadline-Feld, Felder typgerecht, wartet auf, Summenzeile, eigener Querlauf', async () => {
    const { AnsichtTabelle } = await import('@/components/os/aufgaben/AnsichtTabelle');
    const html = renderToStaticMarkup(h(AnsichtTabelle, { state: STATE, dispatch: () => {}, spaceId: 'kdv', aufgaben: STATE.tasks, personen: PERSONEN, heute: '2026-09-28', ich: 'kevin', offenId: null, onOeffnen: () => {} }));
    for (const k of ['Aufgabe', 'Status', 'Zuständig', 'Deadline', 'Priorität', 'Liste', 'CRM-Bezug', 'Wartet auf', 'Budget', 'Stück', 'Kanal', 'Verantwortet', 'Termin']) expect(html).toContain(`>${k}<`);
    expect(html).toContain('aria-sort="none"');
    expect(html).toContain('Messestand buchen');
    expect(html).toContain('>Januar<'); // Vorher: 'Sales › Januar' (Gruppe › Liste)
    expect(html).not.toContain('Sales');
    expect(html).toContain('In Prüfung');
    expect(html).toContain('Status: In Prüfung — ändern');
    expect(html).toContain('Zuständig: Kevin — ändern');
    expect(html).toContain('Priorität: Hoch — ändern');
    expect(html).toContain('value="2026-09-25"');
    expect(html).toMatch(/2\.500,00\s€/);
    expect(html).toContain('Kanal: Messe — ändern');
    expect(html).toContain('Verantwortet: Malin — ändern');
    expect(html).toContain('value="2026-10-03"');
    expect(html).toContain('⧗ Messestand buchen');
    // Summe Budget: 2.500,00 + 49,90 + 10,00 (Beleg als Unteraufgabe, zugeklappt) = 2.559,90 €
    expect(html).toContain('>Summe<');
    expect(html).toMatch(/2\.559,90\s€/);
    expect(html).toContain('>500<');
    // Unteraufgabe zugeklappt, aber aufklappbar.
    expect(html).toContain('1 Unteraufgaben von „Messestand buchen“ aufklappen');
    expect(html).not.toContain('>Beleg Standmiete<');
    expect(html).toContain('overflow-x:auto');
    expect(html).toContain('position:sticky');
  });
  it('Tabelle: leerer Kontext zeigt einen Hinweis statt einer leeren Tabelle', async () => {
    const { AnsichtTabelle } = await import('@/components/os/aufgaben/AnsichtTabelle');
    const html = renderToStaticMarkup(h(AnsichtTabelle, { state: STATE, dispatch: () => {}, spaceId: 'kdv', aufgaben: [], personen: PERSONEN, heute: '2026-09-28', ich: 'kevin', offenId: null, onOeffnen: () => {} }));
    expect(html).toContain('Nichts passt zum Filter.');
    expect(html).not.toContain('<table');
  });
  it('Kalender: Monat mit Balken Start → Deadline, überfällig, ↻, ohne Datum als Seitenliste, Verschieben-Leiste an der offenen Aufgabe', async () => {
    const { AnsichtKalender } = await import('@/components/os/aufgaben/AnsichtKalender');
    const html = renderToStaticMarkup(h(AnsichtKalender, { state: STATE, dispatch: () => {}, aufgaben: STATE.tasks, heute: '2026-09-28', offenId: 't-flyer', onOeffnen: () => {} }));
    expect(html).toContain('September 2026');
    expect(html).toContain('>Monat<');
    expect(html).toContain('>Woche<');
    expect(html).toContain('data-tag="2026-09-28"');
    expect(html).toContain('Messestand buchen · Deadline 25.09.2026 · Start 21.09.2026 · Offen · überfällig');
    expect(html).toContain('Flyer drucken · Deadline 02.10.2026 · In Prüfung · wiederkehrend');
    expect(html).toContain('Ohne Datum · 2');
    expect(html).toContain('Newsletter-Idee');
    expect(html).toContain('verschieben auf …');
    expect(html).toContain('draggable="true"');
  });
  it('Kalender: Anker in einem anderen Monat zeigt dessen Titel, leer mit Hinweis', async () => {
    const { AnsichtKalender } = await import('@/components/os/aufgaben/AnsichtKalender');
    const html = renderToStaticMarkup(h(AnsichtKalender, { state: STATE, dispatch: () => {}, aufgaben: [], heute: '2026-09-28', anker: '2026-12-10', offenId: null, onOeffnen: () => {} }));
    expect(html).toContain('Dezember 2026');
    expect(html).toContain('Ohne Datum · 0');
    expect(html).toContain('Keine Aufgabe mit Deadline');
  });
});
