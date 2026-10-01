// ─── Mehrstufige Unteraufgaben (01.10.): bis AUFGABEN_EBENEN_MAX Ebenen ──────────────────────────────────────
// Kevin 01.10.: „Wir brauchen nochmal Unteraufgaben, also bei dem HOS unter Produkten. Da müssen wir nochmal Beschreibungen
// machen können.“ Geprüft: reine Ebenen-Logik (Tiefe, Kreis, Kandidaten, Fortschritt, Ordnen), Übernahme (erben, idempotent,
// kappen), Papierkorb/Wiederherstellen mit Teilbaum, Vorlagen, Serien, ZOE-Vorschlag/-Pfad, Meilenstein-Fortschritt, Sicht
// „nur ich“, Tabelle, Verbindungsprüfung — und der Server-Schreibweg (400 zu tief, 409 Kreis, Teilbaum zieht mit, create-Route).
// Rückweg-Verträglichkeit: keine Formänderung (Kinder tragen nur bekannte Felder), der alte Stand flacht ohne Verlust ab.
// Eigener Datenordner, erfundene Konten und Aufgaben.
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { rmSync } from 'node:fs';
import type { Task, TasksState, VorlageAufgabe } from '@/types/tasks';
import {
  AUFGABEN_EBENEN_MAX, nachIdKarte, kinderKarte, vorfahren, kette, wurzelVon, ebeneVon, nachfahren, nachfahrenIn, teilbaumHoehe,
  darfUnteraufgabe, waereKreis, elternPruefen, elternKandidaten, pfadText, anteilFertig, elternOrdnen, mitVerbliebenenVorfahren, elternAusText,
} from '@/lib/aufgaben/ebenen';
import { uebernehmen, baum } from '@/lib/aufgaben/struktur';
import { aufgabeInPapierkorb, wiederherstellen, aufgabeUmfang, endgueltigEntfernen, papierkorbEintraege, aufgabenSicht } from '@/lib/aufgaben/papierkorb';
import { aufgabenAusVorlage, vorlageAusListe } from '@/lib/aufgaben/vorlagen';
import { vorlageSauber } from '@/lib/aufgaben/saeubern';
import { naechsteInstanz } from '@/lib/aufgaben/serie';
import { alsChecklisteBei, vorschlagAnwenden } from '@/lib/aufgaben/zoe';
import { darfSehen } from '@/lib/aufgaben/sicht';
import { tabelleZeilen } from '@/lib/aufgaben/ansichten';
import { fortschrittAusAufgaben } from '@/lib/planung/meilenstein-aufgaben';
import { aufgabenFuerKalender } from '@/lib/kalender/aufgaben';
import { tasksReducer } from '@/context/TasksContext';

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-aufgaben-ebenen-'));
  process.env.MAKE_OS_DATEN_DIR = o;
  process.env.MAKE_OS_KEY = 'pruef-schluessel-aufgaben-ebenen';
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  return o;
});
vi.mock('@/lib/meldungen/melden', () => ({ melde: async () => {} }));

const T0 = '2026-09-01T08:00:00.000Z';
const J = '2026-10-01T08:00:00.000Z';
const a = (id: string, extra: Partial<Task> = {}): Task => ({ id, projectId: 'p1', title: `Aufgabe ${id}`, status: 'todo', priority: 'medium', assignee: 'kevin', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: T0, updatedAt: T0, spaceId: 'privat', ...extra });
const stand = (tasks: Task[], extra: Partial<TasksState> = {}): TasksState => ({
  projects: [{ id: 'p1', title: 'Produkte', category: 'joint', owner: 'both', color: '#58D9CD', tags: [], archived: false, createdAt: T0, updatedAt: T0, spaceId: 'privat' }],
  tasks, listen: [], statusEigen: [], gruppen: [], vorlagen: [], ...extra,
});
/** Eine Kette k1 → k2 → … → k<n> (k1 = Hauptaufgabe). */
const reihe = (n: number, extra: (i: number) => Partial<Task> = () => ({})): Task[] =>
  Array.from({ length: n }, (_, i) => a(`k${i + 1}`, { ...(i ? { parentId: `k${i}` } : {}), ...extra(i + 1) }));

describe('Konstante und reine Ebenen-Logik', () => {
  it('die eine Grenze: 5 Ebenen', () => {
    expect(AUFGABEN_EBENEN_MAX).toBe(5);
  });
  it('Ebene, Kette, Wurzel, Nachfahren, Teilbaum-Höhe', () => {
    const t = reihe(5), nachId = nachIdKarte(t), kinder = kinderKarte(t);
    expect(t.map(x => ebeneVon(x, nachId))).toEqual([1, 2, 3, 4, 5]);
    expect(kette(t[4], nachId).map(x => x.id)).toEqual(['k1', 'k2', 'k3', 'k4']);
    expect(vorfahren(t[4], nachId).map(x => x.id)).toEqual(['k4', 'k3', 'k2', 'k1']);
    expect(wurzelVon(t[4], nachId).id).toBe('k1');
    expect(wurzelVon(t[0], nachId).id).toBe('k1');
    expect(nachfahren('k2', kinder).map(x => x.id)).toEqual(['k3', 'k4', 'k5']);
    expect(nachfahrenIn('k5', t)).toEqual([]);
    expect(teilbaumHoehe('k1', kinder)).toBe(5);
    expect(teilbaumHoehe('k4', kinder)).toBe(2);
    expect(teilbaumHoehe('k5', kinder)).toBe(1);
  });
  it('Grenze: Unteraufgabe nur, solange die Ebene unter dem Maximum liegt', () => {
    const t = reihe(5), nachId = nachIdKarte(t);
    expect(t.map(x => darfUnteraufgabe(x, nachId))).toEqual([true, true, true, true, false]);
  });
  it('kreisfest: ein kaputter Bestand (A → B → A) hängt nie', () => {
    const t = [a('x', { parentId: 'y' }), a('y', { parentId: 'x' }), a('z', { parentId: 'z' })];
    const nachId = nachIdKarte(t), kinder = kinderKarte(t);
    expect(vorfahren(t[0], nachId).map(v => v.id)).toEqual(['y']);
    expect(nachfahren('x', kinder).map(v => v.id)).toEqual(['y']);
    expect(teilbaumHoehe('x', kinder)).toBe(2);
    expect(ebeneVon(t[2], nachId)).toBe(1);
  });
  it('Kreis: nicht unter sich selbst oder einem eigenen Nachfahren', () => {
    const t = reihe(4), nachId = nachIdKarte(t);
    expect(waereKreis('k1', 'k1', nachId)).toBe(true);
    expect(waereKreis('k1', 'k4', nachId)).toBe(true);
    expect(waereKreis('k2', 'k3', nachId)).toBe(true);
    expect(waereKreis('k3', 'k2', nachId)).toBe(false); // sein eigenes Elternteil: kein Kreis
    expect(waereKreis('k4', 'k1', nachId)).toBe(false);
  });
  it('elternPruefen: fehlt, Kreis, zu tief (mit Teilbaum), passt', () => {
    const t = [...reihe(3), a('lose'), a('lose2', { parentId: 'lose' }), a('weg', { geloeschtAm: J })];
    const nachId = nachIdKarte(t), kinder = kinderKarte(t);
    expect(elternPruefen(t[3], 'gibtsnicht', nachId, kinder)?.art).toBe('fehlt');
    expect(elternPruefen(t[3], 'weg', nachId, kinder)?.art).toBe('fehlt'); // Papierkorb zählt nicht
    expect(elternPruefen(t[0], 'k3', nachId, kinder)).toMatchObject({ art: 'kreis' });
    expect(elternPruefen(t[0], 'k3', nachId, kinder)!.text).toContain('Nichts gespeichert');
    expect(elternPruefen(t[0], 'k1', nachId, kinder)?.art).toBe('kreis');
    // lose (+ lose2 darunter = Höhe 2) unter k3 (Ebene 3) = 5 Ebenen → passt; unter k3 zusammen mit noch einer Ebene nicht.
    expect(elternPruefen(t[3], 'k3', nachId, kinder)).toBeNull();
    const tiefer = [...t, a('lose3', { parentId: 'lose2' })];
    const e = elternPruefen(tiefer[3], 'k3', nachIdKarte(tiefer), kinderKarte(tiefer));
    expect(e).toMatchObject({ art: 'tiefe' });
    expect(e!.text).toContain(`höchstens ${AUFGABEN_EBENEN_MAX} Ebenen`);
  });
  it('Kandidaten fürs Umhängen: gleicher Ort, offen, kein Nachfahre, Teilbaum passt unter die Grenze', () => {
    const t = [...reihe(4), a('x'), a('x2', { parentId: 'x' }), a('fremd', { projectId: 'p2' }), a('fertig', { status: 'done' })];
    // x hat Höhe 2 → darf unter Ebene ≤ 3 (k1, k2, k3), nicht unter k4 (Ebene 4), nicht unter sich/Nachfahren
    const ids = elternKandidaten(t[4], t).map(k => k.id).sort();
    expect(ids).toEqual(['k1', 'k2', 'k3']);
    // k2 samt Teilbaum (k2, k3, k4 = Höhe 3): unter x (Ebene 1) → 4 Ebenen ok; unter x2 (Ebene 2) → 5 ok
    expect(elternKandidaten(t[1], t).map(k => k.id).sort()).toEqual(['x', 'x2']);
    expect(elternKandidaten(t[0], t).map(k => k.id).sort()).toEqual(['x']); // k1 (Höhe 4): unter x 5 Ebenen ok, unter x2 (Ebene 2) 6 — zu tief
  });
  it('Pfadtext für gleichnamige Kandidaten', () => {
    const t = [a('h', { title: 'Produkte' }), a('hos', { title: 'HOS', parentId: 'h' }), a('x', { title: 'Konzept', parentId: 'hos' })];
    expect(pfadText(t[2], nachIdKarte(t))).toBe('Produkte › HOS › Konzept');
  });
});

describe('Fortschritt rekursiv (Meilenstein-Regel)', () => {
  it('erledigt = 1; sonst Mittel der zählenden Kinder; abgebrochene zählen nicht', () => {
    const t = [
      a('w'), a('u1', { parentId: 'w' }), a('u2', { parentId: 'w' }),
      a('e1', { parentId: 'u1', status: 'done' }), a('e2', { parentId: 'u1' }),
      a('abg', { parentId: 'u2', status: 'cancelled' }),
    ];
    const k = kinderKarte(t);
    expect(anteilFertig(t[3], k)).toBe(1);
    expect(anteilFertig(t[1], k)).toBe(0.5); // u1: eine von zwei fertig
    expect(anteilFertig(t[2], k)).toBe(0); // u2: nur eine abgebrochene → nichts zählt
    expect(anteilFertig(t[0], k)).toBe(0.25); // Mittel von u1 (0,5) und u2 (0)
    expect(anteilFertig({ ...t[0], status: 'done' }, k)).toBe(1);
  });
  it('Meilenstein: Hauptaufgaben gewichtet, Unteraufgaben aller Ebenen; für eine Ebene genau die alte Regel', () => {
    const t = [a('h1'), a('h2', { status: 'done' }), a('u', { parentId: 'h1' }), a('uu', { parentId: 'u', status: 'done' }), a('uu2', { parentId: 'u' })];
    // h1: u zählt 0,5 → h1 = 0,5; h2 = 1 → (0,5 + 1)/2 = 75 %
    expect(fortschrittAusAufgaben(t)).toBe(75);
    // alte Regel, eine Ebene: 1 von 2 erledigt = 50 %
    expect(fortschrittAusAufgaben([a('h'), a('x', { parentId: 'h', status: 'done' }), a('y', { parentId: 'h' })])).toBe(50);
    expect(fortschrittAusAufgaben([])).toBeNull();
  });
  it('Kreis im Bestand: kein Hängen', () => {
    const t = [a('x', { parentId: 'y' }), a('y', { parentId: 'x' }), a('h')];
    expect(fortschrittAusAufgaben(t)).toBe(0);
  });
});

describe('Übernahme: erben, idempotent, Kreise und zu tiefe Ketten', () => {
  const st = (tasks: Task[]) => stand(tasks, { projects: [{ id: 'p1', title: 'Produkte', category: 'business', owner: 'both', color: '#fff', tags: [], archived: false, createdAt: T0, updatedAt: T0, spaceId: 'kdv' }], listen: [{ id: 'l1', projektId: 'p1', titel: 'HOS', sortOrder: 0 }] });
  it('Ebene 3–5 erbt Space, Projekt und Liste der Hauptaufgabe — in EINEM Lauf, idempotent', () => {
    const t = reihe(5, i => (i === 1 ? { spaceId: 'kdv', listeId: 'l1' } : { spaceId: 'privat', projectId: 'p-x' }));
    const eins = uebernehmen(st(t));
    const nach = Object.fromEntries(eins.state.tasks.map(x => [x.id, x]));
    for (let i = 2; i <= 5; i++) expect(nach[`k${i}`], `k${i}`).toMatchObject({ parentId: `k${i - 1}`, spaceId: 'kdv', projectId: 'p1', listeId: 'l1', space: 'business' });
    const zwei = uebernehmen(eins.state);
    expect(zwei.geaendert).toBe(false);
    expect(JSON.stringify(zwei.state)).toBe(JSON.stringify(eins.state));
  });
  it('Reihenfolge im Bestand egal (Kind vor Eltern)', () => {
    const t = reihe(4, i => (i === 1 ? { spaceId: 'kdv', listeId: 'l1' } : { spaceId: 'privat' })).reverse();
    const nach = uebernehmen(st(t)).state.tasks;
    expect(nach.map(x => x.id)).toEqual(['k4', 'k3', 'k2', 'k1']); // Bestandsreihenfolge bleibt
    expect(nach.every(x => x.spaceId === 'kdv' && x.listeId === 'l1')).toBe(true);
  });
  it('Kreis A → B → A: die kleinste Kennung wird Hauptaufgabe, nichts geht verloren', () => {
    const t = [a('b', { parentId: 'a', description: 'bleibt' }), a('a', { parentId: 'b' }), a('c', { parentId: 'b' })];
    const nach = Object.fromEntries(uebernehmen(st(t)).state.tasks.map(x => [x.id, x]));
    expect(nach.a.parentId).toBeUndefined();
    expect(nach.b).toMatchObject({ parentId: 'a', description: 'bleibt' });
    expect(nach.c.parentId).toBe('b');
    expect(Object.keys(nach)).toHaveLength(3);
  });
  it('tiefer als die Grenze: gekappt am Vorfahren der vorletzten Ebene, im selben Ast', () => {
    const t = reihe(7);
    const o = elternOrdnen(t);
    // k6 und k7 lägen auf Ebene 6/7 → k6 an k4 (Ebene 4 → k6 wird Ebene 5), k7 an k6 (Ebene 5) → wieder zu tief → an k4 …
    const nach = Object.fromEntries(uebernehmen(st(t)).state.tasks.map(x => [x.id, x]));
    const nachId = nachIdKarte(Object.values(nach));
    for (const x of Object.values(nach)) expect(ebeneVon(x, nachId)).toBeLessThanOrEqual(AUFGABEN_EBENEN_MAX);
    expect(nach.k6.parentId).toBe('k4');
    expect(Object.keys(nach)).toHaveLength(7);
    expect(o.get('k6')).toBe('k4');
    expect(o.has('k5')).toBe(false); // innerhalb der Grenze: unberührt
  });
  it('fehlendes Elternteil: Hauptaufgabe (wie bisher)', () => {
    const o = elternOrdnen([a('x', { parentId: 'weg' })]);
    expect(o.has('x')).toBe(true);
    expect(o.get('x')).toBeUndefined();
  });
  it('Umhängen zieht den Teilbaum mit: die Hauptaufgabe wechselt den Ort, alle Ebenen folgen', () => {
    const t = [...reihe(3, i => (i === 1 ? { spaceId: 'kdv', listeId: 'l1' } : {})), a('anders', { spaceId: 'privat', projectId: 'p-x' })];
    // k2 (samt k3) unter „anders“ → Ort von „anders“
    const nach = Object.fromEntries(uebernehmen(st(t.map(x => (x.id === 'k2' ? { ...x, parentId: 'anders' } : x)))).state.tasks.map(x => [x.id, x]));
    expect(nach.k2).toMatchObject({ parentId: 'anders', spaceId: 'privat' });
    expect(nach.k3).toMatchObject({ parentId: 'k2', spaceId: 'privat', projectId: nach.k2.projectId });
    expect(nach.k3.listeId).toBe(nach.k2.listeId);
  });
});

describe('Papierkorb, Wiederherstellen, Archiv-Sicht mit Teilbaum', () => {
  const bestand = () => stand([...reihe(4, i => ({ description: `Beschreibung ${i}`, notiz: i === 3 ? 'Notiz 3' : undefined })), a('daneben')]);
  it('in den Papierkorb: alle Ebenen gehen mit (`geloeschtMit` = die Aufgabe), Umfang zählt alle', () => {
    const s = bestand();
    expect(aufgabeUmfang(s, 'k1').unteraufgaben).toBe(3);
    expect(aufgabeUmfang(s, 'k1').notiz).toBe(true); // Notiz in einer tiefen Ebene
    const k = aufgabeInPapierkorb(s, 'k1', J);
    expect(k.tasks.filter(t => t.geloeschtAm).map(t => t.id)).toEqual(['k1', 'k2', 'k3', 'k4']);
    for (const id of ['k2', 'k3', 'k4']) expect(k.tasks.find(t => t.id === id)).toMatchObject({ geloeschtAm: J, geloeschtMit: 'k1' });
    // Beschreibung bleibt am Eintrag
    expect(k.tasks.find(t => t.id === 'k4')!.description).toBe('Beschreibung 4');
    expect(aufgabenSicht(k).tasks.map(t => t.id)).toEqual(['daneben']);
    expect(papierkorbEintraege(k).map(e => [e.id, e.mit])).toEqual([['k1', 3]]);
  });
  it('Sicht blendet auch Enkel aus, wenn nur die MITTE im Papierkorb liegt', () => {
    const k = aufgabeInPapierkorb(bestand(), 'k2', J);
    expect(aufgabenSicht(k).tasks.map(t => t.id)).toEqual(['k1', 'daneben']);
  });
  it('Wiederherstellen holt die ganze Kette zurück; ein Enkel einzeln wird eine Hauptaufgabe', () => {
    const k = aufgabeInPapierkorb(bestand(), 'k1', J);
    const alle = wiederherstellen(k, 'aufgabe', 'k1', J);
    expect(alle.tasks.some(t => t.geloeschtAm || t.geloeschtMit)).toBe(false);
    expect(alle.tasks.find(t => t.id === 'k4')!.parentId).toBe('k3');
    const einzeln = wiederherstellen(k, 'aufgabe', 'k3', J);
    expect(einzeln.tasks.find(t => t.id === 'k3')!.geloeschtAm).toBeUndefined();
    expect(einzeln.tasks.find(t => t.id === 'k3')!.parentId).toBeUndefined(); // Vorfahren liegen im Papierkorb
    expect(einzeln.tasks.find(t => t.id === 'k1')!.geloeschtAm).toBe(J);
  });
  it('endgültig: Wurzel und alle Ebenen', () => {
    const k = aufgabeInPapierkorb(bestand(), 'k1', J);
    const r = endgueltigEntfernen(k, 'aufgabe', 'k1');
    expect(r.aufgaben.sort()).toEqual(['k1', 'k2', 'k3', 'k4']);
    expect(r.state.tasks.map(t => t.id)).toEqual(['daneben']);
  });
  it('zweimal löschen ist harmlos; eine schon gelöschte Mitte behält ihre eigene Marke', () => {
    const k1 = aufgabeInPapierkorb(bestand(), 'k2', J);
    const k2 = aufgabeInPapierkorb(k1, 'k1', '2026-10-02T08:00:00.000Z');
    expect(k2.tasks.find(t => t.id === 'k2')).toMatchObject({ geloeschtAm: J });
    expect(k2.tasks.find(t => t.id === 'k2')!.geloeschtMit).toBeUndefined();
    expect(k2.tasks.find(t => t.id === 'k3')).toMatchObject({ geloeschtAm: J, geloeschtMit: 'k2' });
    expect(aufgabeInPapierkorb(k2, 'k1', J)).toBe(k2);
  });
  it('mitVerbliebenenVorfahren (Archiv „Neu anfangen“): nur Aufgaben, deren Vorfahren alle bleiben', () => {
    const t = reihe(4);
    expect(mitVerbliebenenVorfahren(t, new Set(['k1', 'k2', 'k3', 'k4'])).map(x => x.id)).toEqual(['k1', 'k2', 'k3', 'k4']);
    expect(mitVerbliebenenVorfahren(t.filter(x => x.id !== 'k2'), new Set(['k1', 'k3', 'k4'])).map(x => x.id)).toEqual(['k1']);
  });
});

describe('Vorlagen: Teilbaum speichern und anlegen', () => {
  const tief = (n: number): VorlageAufgabe => { let x: VorlageAufgabe = { titel: `E${n}` }; for (let i = n - 1; i >= 1; i--) x = { titel: `E${i}`, beschreibung: `B${i}`, unter: [x] }; return x; };
  it('anlegen: Kennung je Ebene `<eltern>-u<n>`, Eltern gesetzt, Beschreibung bleibt, bei 5 Ebenen Schluss', () => {
    const t = aufgabenAusVorlage([tief(7)], { projectId: 'p1', spaceId: 'privat', owner: 'kevin', jetzt: J, praefix: 'v' });
    expect(t.map(x => x.id)).toEqual(['v-a1', 'v-a1-u1', 'v-a1-u1-u1', 'v-a1-u1-u1-u1', 'v-a1-u1-u1-u1-u1']);
    expect(t.map(x => x.parentId)).toEqual([undefined, 'v-a1', 'v-a1-u1', 'v-a1-u1-u1', 'v-a1-u1-u1-u1']);
    expect(t[1].description).toBe('B2');
  });
  it('speichern aus einer Liste: alle Ebenen bis zur Grenze', () => {
    const s = stand(reihe(6, i => ({ listeId: 'l1', title: `T${i}` })), { listen: [{ id: 'l1', projektId: 'p1', titel: 'Liste', sortOrder: 0 }] });
    const v = vorlageAusListe(s, 'l1', { id: 'v1', jetzt: J })!;
    let n = 0; let x: VorlageAufgabe | undefined = (v.inhalt.aufgaben ?? [])[0];
    while (x) { n++; x = x.unter?.[0]; }
    expect(n).toBe(AUFGABEN_EBENEN_MAX);
  });
  it('Säuberung: tiefer als die Grenze fällt weg', () => {
    const v = vorlageSauber({ id: 'v', art: 'liste', titel: 'T', inhalt: { aufgaben: [tief(8)] } })!;
    let n = 0; let x: VorlageAufgabe | undefined = v.inhalt.aufgaben![0];
    while (x) { n++; x = x.unter?.[0]; }
    expect(n).toBe(AUFGABEN_EBENEN_MAX);
  });
});

describe('Serien: der ganze Teilbaum kommt zurückgesetzt mit', () => {
  it('nächste Instanz: Ebene 2 wie bisher `<instanz>-u1`, Ebene 3 `<instanz>-u1-u1`; Fristen verschoben, nichts doppelt', () => {
    const w = a('s1', { status: 'done', completedAt: J, dueDate: '2026-09-30', wiederholung: { regel: 'monatlich', monatstag: 31 } });
    const u = a('s1-a', { parentId: 's1', status: 'done', dueDate: '2026-09-28', title: 'Beleg' });
    const uu = a('s1-b', { parentId: 's1-a', status: 'done', dueDate: '2026-09-27', title: 'Quittung', description: 'Original' });
    const [inst, i2, i3, ...rest] = naechsteInstanz(w, [w, u, uu], '2026-09-30', J);
    expect(rest).toEqual([]);
    expect(i2).toMatchObject({ id: `${inst.id}-u1`, parentId: inst.id, status: 'todo', dueDate: '2026-10-29' });
    expect(i3).toMatchObject({ id: `${inst.id}-u1-u1`, parentId: i2.id, status: 'todo', title: 'Quittung', description: 'Original', dueDate: '2026-10-28' });
    expect(naechsteInstanz(w, [w, u, uu, inst, i2, i3], '2026-09-30', J)).toEqual([]);
  });
});

describe('Sicht „nur ich“ vererbt sich über alle Ebenen', () => {
  it('Enkel einer fremden „nur ich“-Aufgabe ist unsichtbar; für die Anlegerin sichtbar; Kreis hängt nicht', () => {
    const t = [a('g', { sichtbarkeit: 'nur-ich', angelegtVon: 'kevin' }), a('g2', { parentId: 'g' }), a('g3', { parentId: 'g2' }), a('g4', { parentId: 'g3' })];
    const nachId = nachIdKarte(t);
    expect(darfSehen(t[3], 'malin', nachId)).toBe(false);
    expect(darfSehen(t[3], null, nachId)).toBe(false);
    expect(darfSehen(t[3], 'kevin', nachId)).toBe(true);
    const kreis = [a('x', { parentId: 'y' }), a('y', { parentId: 'x' })];
    expect(darfSehen(kreis[0], 'malin', nachIdKarte(kreis))).toBe(true);
  });
  it('Kalender: Aufgabe unter einer Vorfahrin im Papierkorb oder „nur ich“ (fremd) erscheint nicht — auf jeder Ebene', () => {
    const t = [a('g', { sichtbarkeit: 'nur-ich', angelegtVon: 'kevin' }), a('g2', { parentId: 'g' }), a('g3', { parentId: 'g2', dueDate: '2026-10-05' }), a('f', { dueDate: '2026-10-05' }), a('f2', { parentId: 'f', geloeschtAm: J }), a('f3', { parentId: 'f2', dueDate: '2026-10-05' })];
    const ids = (ich?: string) => aufgabenFuerKalender(t, '2026-10-01', '2026-11-01', { sicht: 'alle' as never, bereich: 'alle', ...(ich ? { ich } : {}) }).map(x => x.id);
    expect(ids('malin')).toEqual(['f']);
    expect(ids('kevin')).toEqual(['g3', 'f']);
  });
});

describe('Tabelle: Zeilen rekursiv, aufklappbar je Ebene', () => {
  it('Tiefe wächst je Ebene; zugeklappt zeigt nur die obere; Kreis hängt nicht', () => {
    const t = reihe(3);
    const s = { richtung: 'auf' as const, feld: 'titel' as never };
    expect(tabelleZeilen(t, null, {} as never, new Set()).map(z => [z.task.id, z.tiefe, z.unter])).toEqual([['k1', 0, 1]]);
    expect(tabelleZeilen(t, null, {} as never, new Set(['k1'])).map(z => [z.task.id, z.tiefe])).toEqual([['k1', 0], ['k2', 1]]);
    expect(tabelleZeilen(t, null, {} as never, new Set(['k1', 'k2'])).map(z => [z.task.id, z.tiefe, z.unter])).toEqual([['k1', 0, 1], ['k2', 1, 1], ['k3', 2, 0]]);
    void s;
    const kreis = [a('x', { parentId: 'x' })];
    expect(tabelleZeilen(kreis, null, {} as never, new Set(['x'])).map(z => z.task.id)).toEqual(['x']);
  });
});

describe('Baum eines Space: Aufgabe erscheint, wenn irgendein Nachfahre passt (Suche)', () => {
  it('Treffer in Ebene 4 holt die Hauptaufgabe in den Baum', () => {
    const t = reihe(4, i => ({ title: i === 4 ? 'Nadel' : `Heu ${i}` }));
    const treffer = baum(stand(t), 'privat', x => x.title === 'Nadel', false);
    const haupt = treffer.flatMap(p => p.listen.flatMap(l => l.aufgaben)).map(x => x.task.id);
    expect(haupt).toEqual(['k1']);
    const keine = baum(stand(t), 'privat', x => x.title === 'gibtsnicht', false);
    expect(keine.flatMap(p => p.listen.flatMap(l => l.aufgaben))).toEqual([]);
  });
});

describe('Client-Zustand: Umzug zieht den Teilbaum mit, Löschen nimmt ihn mit', () => {
  it('UPDATE_TASK mit neuem Ort: alle Ebenen darunter folgen', () => {
    const s: TasksState = stand(reihe(4));
    const n = tasksReducer(s, { type: 'UPDATE_TASK', payload: { id: 'k1', spaceId: 'kdv', projectId: 'p9', listeId: 'l9' } });
    for (const x of n.tasks) expect(x, x.id).toMatchObject({ spaceId: 'kdv', projectId: 'p9', listeId: 'l9' });
  });
  it('UPDATE_TASK eines Kindes zieht dessen Nachfahren, nicht die Geschwister', () => {
    const s: TasksState = stand([...reihe(4), a('k2b', { parentId: 'k1' })]);
    const n = tasksReducer(s, { type: 'UPDATE_TASK', payload: { id: 'k2', spaceId: 'kdv' } });
    expect(n.tasks.filter(x => x.spaceId === 'kdv').map(x => x.id).sort()).toEqual(['k2', 'k3', 'k4']);
  });
  it('DELETE_TASK: ganzer Teilbaum im Papierkorb', () => {
    const n = tasksReducer(stand(reihe(4)), { type: 'DELETE_TASK', payload: { id: 'k2' } } as never);
    expect(n.tasks.filter(x => x.geloeschtAm).map(x => x.id)).toEqual(['k2', 'k3', 'k4']);
  });
});

describe('ZOE: Pfad zum Elternteil, Vorschlag auf der untersten Ebene', () => {
  const t = [a('p', { title: 'Produkte' }), a('hos', { title: 'HOS', parentId: 'p' }), a('x', { title: 'Konzept', parentId: 'hos' }), a('p2', { title: 'Produkte' }), a('hos2', { title: 'HOS', parentId: 'p2' })];
  it('Kennung, Titel, Pfad („›“, „>“, „/“); mehrdeutig → Fehler mit den Pfaden', () => {
    expect(elternAusText(t, 'x')).toEqual({ id: 'x' });
    expect(elternAusText(t, 'Konzept')).toEqual({ id: 'x' });
    const m = elternAusText(t, 'HOS');
    expect('fehler' in m && m.fehler).toContain('Mehrdeutig');
    expect('fehler' in m && m.fehler).toContain('Produkte › HOS');
    const nachbar = [...t.slice(0, 3), a('p3', { title: 'Marketing' }), a('hos3', { title: 'HOS', parentId: 'p3' })];
    expect(elternAusText(nachbar, 'Produkte › HOS')).toEqual({ id: 'hos' });
    expect(elternAusText(nachbar, 'Marketing > HOS')).toEqual({ id: 'hos3' });
    expect(elternAusText(nachbar, 'Produkte/HOS/Konzept')).toEqual({ id: 'x' });
    expect(elternAusText(t, 'Nichts')).toHaveProperty('fehler');
    expect(elternAusText(t, '  ')).toHaveProperty('fehler');
  });
  it('erledigte Aufgaben sind keine Eltern-Treffer', () => {
    expect(elternAusText([a('z', { title: 'Alt', status: 'done' })], 'Alt')).toHaveProperty('fehler');
  });
  it('Freigabe: Unteraufgaben-Vorschläge werden erst auf der untersten Ebene zur Checkliste', () => {
    const k = reihe(5);
    expect(alsChecklisteBei(k[0], k)).toBe(false);
    expect(alsChecklisteBei(k[3], k)).toBe(false); // Ebene 4: darunter ist noch Platz
    expect(alsChecklisteBei(k[4], k)).toBe(true); // Ebene 5
    expect(alsChecklisteBei(k[1])).toBe(true); // ohne Bestand wie früher
    const v = { aufgabeId: 'k5', unteraufgaben: ['eins', 'zwei'] };
    const r = vorschlagAnwenden(k[4], v as never, { stapelId: 's', jetzt: J, tag: '2026-10-01', geschwister: k, neueId: i => `n${i}` });
    expect(r.ok && r.neue).toEqual([]);
    expect(r.ok && r.task.notiz).toContain('- [ ] eins');
    const r4 = vorschlagAnwenden(k[3], { aufgabeId: 'k4', unteraufgaben: ['eins'] } as never, { stapelId: 's', jetzt: J, tag: '2026-10-01', geschwister: k, neueId: i => `n${i}` });
    expect(r4.ok && r4.neue.map(x => x.parentId)).toEqual(['k4']);
  });
});

describe('Rückweg-Verträglichkeit (Kompatibilitätsmodus): keine Formänderung, der alte Stand flacht ohne Verlust ab', () => {
  /** Die Regel des Online-Stands (6111e71 `uebernehmen`, `oberster`): jede Unteraufgabe hängt am OBERSTEN Elternteil. */
  const altFlach = (tasks: Task[]): Task[] => {
    const nachId = new Map(tasks.map(t => [t.id, t]));
    const oberster = (t: Task): Task | undefined => {
      let p = t.parentId ? nachId.get(t.parentId) : undefined;
      const gesehen = new Set<string>([t.id]);
      while (p?.parentId && !gesehen.has(p.id)) { gesehen.add(p.id); const n = nachId.get(p.parentId); if (!n) break; p = n; }
      return p && p.id !== t.id ? p : undefined;
    };
    return tasks.map(t => { const e = oberster(t); return t.parentId && e ? { ...t, parentId: e.id, spaceId: e.spaceId, projectId: e.projectId } : t; });
  };
  it('Kinder tiefer Ebenen tragen nur Felder, die auch eine flache Unteraufgabe trägt (Vorlage, Serie, Anlegen)', () => {
    const v = aufgabenAusVorlage([{ titel: 'a', unter: [{ titel: 'b', unter: [{ titel: 'c', beschreibung: 'd', notiz: 'n' }] }] }], { projectId: 'p1', spaceId: 'privat', owner: 'kevin', jetzt: J, praefix: 'v' });
    const felder = (t: Task) => Object.keys(t).sort();
    const ebene2 = felder(v[1]).filter(k => k !== 'description' && k !== 'notiz'), ebene3 = felder(v[2]).filter(k => k !== 'description' && k !== 'notiz');
    expect(ebene3).toEqual(ebene2);
  });
  it('der alte Stand behält jede Aufgabe samt Beschreibung, Notiz und Status; nur die Zwischenebene fällt weg', () => {
    const t = reihe(5, i => ({ description: `Beschreibung ${i}`, notiz: `Notiz ${i}`, status: i % 2 ? 'todo' : 'done' }));
    const flach = altFlach(t);
    expect(flach).toHaveLength(5);
    for (const [i, x] of flach.entries()) expect(x).toMatchObject({ id: t[i].id, description: t[i].description, notiz: t[i].notiz, status: t[i].status });
    expect(flach.slice(1).every(x => x.parentId === 'k1')).toBe(true);
    // Und die neue Version legt es danach flach wieder ab, ohne Fehler (nichts wird von selbst wieder tief).
    expect(uebernehmen(stand(flach)).state.tasks.map(x => x.parentId)).toEqual([undefined, 'k1', 'k1', 'k1', 'k1']);
  });
});

// ── Server: Schreibweg ────────────────────────────────────────────────────────────────────────────────────
type Handler = (r: Request) => Promise<Response>;
let route: { GET: Handler; PATCH: Handler };
let anlegen: { POST: Handler };
let db: typeof import('@/lib/store/local-db');
const konto = (id: string, speicher: string, name: string, rolle: 'inhaber' | 'mitglied') => ({ id, speicher, email: `${speicher}@test.invalid`, name, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'haus' });
const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
const anfrage = (kopf: Record<string, string>, method = 'GET', body?: unknown, pfad = '/api/state/tasks') => new Request(`http://test${pfad}`, { method, headers: kopf, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
const patch = (person: string, body: unknown) => route.PATCH(anfrage(sitzung(person), 'PATCH', body));
const upsert = (...ts: (Partial<Task> & { id: string })[]) => ({ ops: ts.map(t => ({ op: 'upsert', task: t })) });
const gespeichert = async () => (await db.loadJson<TasksState>('tasks'))!;
const gespeichertTask = async (id: string) => (await gespeichert()).tasks.find(t => t.id === id);
const erstelle = async (person: string, body: Record<string, unknown>) => { const r = await anlegen.POST(anfrage(sitzung(person), 'POST', body, '/api/tasks/create')); return { status: r.status, d: await r.json() as { ok: boolean; id: string; duplikat?: boolean; error?: string } }; };

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'Kevin Beispiel', 'inhaber'), konto('k2', 'malin', 'Malin Beispiel', 'mitglied')], einladungen: [] });
  await db.saveJson('crm', { firmen: [], mandate: [] });
  route = (await import('@/app/api/state/tasks/route')) as unknown as typeof route;
  anlegen = (await import('@/app/api/tasks/create/route')) as unknown as typeof anlegen;
});
beforeEach(async () => {
  await db.saveJson('tasks', {
    projects: [
      { id: 'p1', title: 'Produkte', category: 'joint', owner: 'both', color: '#58D9CD', tags: [], archived: false, createdAt: T0, updatedAt: T0, spaceId: 'privat' },
      { id: 'p2', title: 'Anderes', category: 'joint', owner: 'both', color: '#58D9CD', tags: [], archived: false, createdAt: T0, updatedAt: T0, spaceId: 'privat' },
    ],
    tasks: [a('h', { title: 'Produkte' }), a('h2', { projectId: 'p2', title: 'Andere Hauptaufgabe' }), a('geheim', { sichtbarkeit: 'nur-ich', angelegtVon: 'kevin' }), a('geheim-kind', { parentId: 'geheim' })],
    listen: [], statusEigen: [], gruppen: [], vorlagen: [], umbauVersion: 2,
  });
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Server-Schreibweg: Tiefe, Kreis, Ort, Teilbaum', () => {
  it('Kette bis Ebene 5 wird gespeichert, Ort und Beschreibung bleiben; Ebene 6 → 400 mit klarer Meldung, nichts gespeichert', async () => {
    for (let i = 2; i <= 5; i++) {
      const r = await patch('kevin', upsert(a(`e${i}`, { parentId: i === 2 ? 'h' : `e${i - 1}`, description: `Beschreibung ${i}`, projectId: 'p2', spaceId: 'privat' })));
      expect(r.status, `Ebene ${i}`).toBe(200);
    }
    const e5 = (await gespeichertTask('e5'))!;
    expect(e5).toMatchObject({ parentId: 'e4', projectId: 'p1', spaceId: 'privat', description: 'Beschreibung 5' }); // Ort von der Hauptaufgabe
    const r6 = await patch('kevin', upsert(a('e6', { parentId: 'e5' })));
    expect(r6.status).toBe(400);
    const d = await r6.json() as { error: string };
    expect(d.error).toContain(`höchstens ${AUFGABEN_EBENEN_MAX} Ebenen`);
    expect(d.error).toContain('Nichts gespeichert');
    expect(await gespeichertTask('e6')).toBeUndefined();
  });
  it('Kreis → 409 mit Kennungen; unbekanntes Elternteil → 400; sich selbst wird verworfen', async () => {
    await patch('kevin', upsert(a('e2', { parentId: 'h' }), a('e3', { parentId: 'e2' })));
    const kreis = await patch('kevin', upsert(a('h', { parentId: 'e3' })));
    expect(kreis.status).toBe(409);
    const k = await kreis.json() as { error: string; kreis: string[] };
    expect(k.error).toContain('Abgelehnt');
    expect(k.kreis).toContain('h');
    expect((await gespeichertTask('h'))!.parentId).toBeUndefined();
    // sich selbst als Elternteil: die Säuberung verwirft es (nie ein Kreis aus einem Zug) — Hauptaufgabe bleibt Hauptaufgabe
    expect((await patch('kevin', upsert(a('h', { parentId: 'h' })))).status).toBe(200);
    expect((await gespeichertTask('h'))!.parentId).toBeUndefined();
    expect((await patch('kevin', upsert(a('x', { parentId: 'gibtsnicht' })))).status).toBe(400);
  });
  it('Umhängen: eine Ebene-2-Aufgabe samt Kindern unter eine Hauptaufgabe in anderem Projekt — Teilbaum zieht mit', async () => {
    await patch('kevin', upsert(a('e2', { parentId: 'h' }), a('e3', { parentId: 'e2' }), a('e4', { parentId: 'e3' })));
    expect((await patch('kevin', upsert(a('e2', { parentId: 'h2' })))).status).toBe(200);
    for (const id of ['e2', 'e3', 'e4']) expect(await gespeichertTask(id), id).toMatchObject({ projectId: 'p2' });
    expect((await gespeichertTask('e4'))!.parentId).toBe('e3');
  });
  it('Umhängen mit Teilbaum, der unter dem Ziel zu tief würde → 400, nichts geändert', async () => {
    await patch('kevin', upsert(a('e2', { parentId: 'h' }), a('e3', { parentId: 'e2' }), a('e4', { parentId: 'e3' })));
    await patch('kevin', upsert(a('f2', { parentId: 'h2' }), a('f3', { parentId: 'f2' })));
    // h (Höhe 4) unter f3 (Ebene 3) → 7 Ebenen
    const r = await patch('kevin', upsert(a('h', { parentId: 'f3' })));
    expect(r.status).toBe(400);
    expect((await gespeichertTask('h'))!.parentId).toBeUndefined();
  });
  it('zur Hauptaufgabe machen: parentId entfernen, Teilbaum bleibt darunter', async () => {
    await patch('kevin', upsert(a('e2', { parentId: 'h' }), a('e3', { parentId: 'e2' })));
    const r = await patch('kevin', { ops: [{ op: 'upsert', task: { ...a('e2'), parentId: null } }] });
    expect(r.status).toBe(200);
    expect((await gespeichertTask('e2'))!.parentId).toBeUndefined();
    expect((await gespeichertTask('e3'))!.parentId).toBe('e2');
  });
  it('„nur ich“: Malin kann unter einer Enkelin einer fremden Aufgabe nichts anlegen (404), Kevin schon', async () => {
    await patch('kevin', upsert(a('g3', { parentId: 'geheim-kind' })));
    expect((await patch('malin', upsert(a('m', { parentId: 'g3' })))).status).toBe(404);
    expect((await patch('kevin', upsert(a('k', { parentId: 'g3' })))).status).toBe(200);
  });
});

describe('/api/tasks/create mit Elternteil auf jeder Ebene', () => {
  it('Unteraufgabe unter einer Unteraufgabe: Ort geerbt, Duplikat-Schutz nur unter DIESEM Elternteil, Tiefe geprüft', async () => {
    const u2 = await erstelle('kevin', { title: 'Ebene 2', owner: 'kevin', parentId: 'h' });
    expect(u2.d.ok).toBe(true);
    const u3 = await erstelle('kevin', { title: 'Ebene 3', owner: 'kevin', parentId: u2.d.id, description: 'Mit Beschreibung', spaceId: 'ug', projectId: 'p2' });
    expect(u3.d.ok).toBe(true);
    expect(await gespeichertTask(u3.d.id)).toMatchObject({ parentId: u2.d.id, spaceId: 'privat', projectId: 'p1', description: 'Mit Beschreibung' });
    const nochmal = await erstelle('kevin', { title: 'ebene 3 ', owner: 'kevin', parentId: u2.d.id });
    expect(nochmal.d).toMatchObject({ ok: true, duplikat: true, id: u3.d.id });
    // gleicher Titel unter anderem Elternteil ist KEIN Duplikat
    const anders = await erstelle('kevin', { title: 'Ebene 3', owner: 'kevin', parentId: 'h' });
    expect(anders.d.duplikat).toBeUndefined();
    let eltern = u3.d.id;
    for (const t of ['E4', 'E5']) { const r = await erstelle('kevin', { title: t, owner: 'kevin', parentId: eltern }); expect(r.status).toBe(200); eltern = r.d.id; }
    const zu = await erstelle('kevin', { title: 'E6', owner: 'kevin', parentId: eltern });
    expect(zu.status).toBe(400);
    expect(zu.d.error).toContain('Ebenen');
  });
  it('unbekanntes Elternteil → 404 (nicht mehr still als Hauptaufgabe)', async () => {
    const r = await erstelle('kevin', { title: 'Waise', owner: 'kevin', parentId: 'gibtsnicht' });
    expect(r.status).toBe(404);
    expect((await gespeichert()).tasks.some(t => t.title === 'Waise')).toBe(false);
  });
});
