// ─── Aufgaben im Browser: nichts geht verloren (29.09., A1/A4/A5/A7) ────────
// Die Regeln hinter context/TasksContext.tsx (lib/aufgaben/abgleich.ts + Reducer) als Verlust-Szenarien:
// fehlgeschlagenes Speichern bleibt ausstehend, ein Abgleich legt Ausstehendes wieder auf den neuen Serverstand,
// Konflikte ersetzen nur die betroffene Zeile, Pakete zerlegen sich bei 400/413, gemerkte Änderungen überleben
// „bitte neu laden“, Löschen landet im Papierkorb.
import { describe, it, expect } from 'vitest';
import type { Task, TasksState } from '@/types/tasks';
import {
  anzahl, aufOps, einzeln, filtern, gemerktAlsOps, gleichOhneZeit, koerper, leererStand, merkenAus, ohneStand, pakete, schluessel, schluesselVon,
  unterschied, voruebergehend, wartezeit, fassungText, type Staende,
} from '@/lib/aufgaben/abgleich';
import { tasksReducer } from '@/context/TasksContext';

const T0 = '2026-09-01T08:00:00.000Z';
const aufgabe = (id: string, extra: Partial<Task> = {}): Task => ({ id, projectId: 'p', title: `Aufgabe ${id}`, status: 'todo', priority: 'medium', assignee: 'kevin', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: T0, updatedAt: T0, spaceId: 'kdv', ...extra });
const stand = (tasks: Task[]): TasksState => ({ ...leererStand(), tasks });

describe('Warteschlange: ausstehend bis zur Bestätigung', () => {
  it('Ein fehlgeschlagenes Senden ändert den bestätigten Stand nicht — die Änderung steht weiter aus (vorher: still verloren)', () => {
    const server = stand([aufgabe('a'), aufgabe('b')]);
    const lokal = stand([aufgabe('a', { title: 'geändert' }), aufgabe('b')]);
    const st: Staende = new Map([[schluessel('tasks', 'a'), 's-a']]);
    const ops = unterschied(server, lokal, st);
    expect(anzahl(ops)).toBe(1);
    expect(ops.tasks[0]).toMatchObject({ op: 'upsert', stand: 's-a', eintrag: { id: 'a', title: 'geändert' } });
    // 502 beim Neustart: `server` bleibt → beim nächsten Versuch dieselbe Änderung, mit demselben Stand.
    expect(unterschied(server, lokal, st)).toEqual(ops);
    // Bestätigt: erst dann gilt sie als gespeichert.
    expect(anzahl(unterschied(aufOps(server, ops), lokal, st))).toBe(0);
  });

  it('Abgleich (45 s/Fokus) mit ausstehender Änderung: der neue Serverstand kommt, die eigene Änderung bleibt obendrauf', () => {
    const altServer = stand([aufgabe('a'), aufgabe('b')]);
    const lokal = stand([aufgabe('a', { notiz: 'nicht gespeichert' }), aufgabe('b')]);
    // Malin hat inzwischen b geändert und c angelegt.
    const neuServer = stand([aufgabe('a'), aufgabe('b', { title: 'von Malin' }), aufgabe('c')]);
    const n = tasksReducer(lokal, { type: 'ABGLEICH', payload: { basis: neuServer, altServer } });
    expect(n.tasks.find(t => t.id === 'a')!.notiz).toBe('nicht gespeichert');
    expect(n.tasks.find(t => t.id === 'b')!.title).toBe('von Malin');
    expect(n.tasks.map(t => t.id).sort()).toEqual(['a', 'b', 'c']);
    // Danach steht genau die eigene Änderung aus (gegen den neuen Serverstand).
    expect(schluesselVon(unterschied(neuServer, n, new Map()))).toEqual(new Set(['tasks:a']));
  });

  it('Konflikt: nur die betroffene Zeile nimmt die Fassung des Servers an, die übrigen Änderungen bleiben ausstehend', () => {
    const altServer = stand([aufgabe('a'), aufgabe('b')]);
    const lokal = stand([aufgabe('a', { title: 'meine Fassung' }), aufgabe('b', { title: 'auch meine' })]);
    const aktuell = stand([aufgabe('a', { title: 'Malins Fassung' }), aufgabe('b')]);
    const n = tasksReducer(lokal, { type: 'ABGLEICH', payload: { basis: aktuell, altServer, serverGewinnt: ['tasks:a'] } });
    expect(n.tasks.find(t => t.id === 'a')!.title).toBe('Malins Fassung');
    expect(n.tasks.find(t => t.id === 'b')!.title).toBe('auch meine');
    // „Deine Fassung übernehmen“ setzt die eigene Zeile wieder — sie geht mit dem neuen Stand raus.
    const m = tasksReducer(n, { type: 'ZEILEN_SETZEN', payload: [{ liste: 'tasks', id: 'a', eintrag: lokal.tasks[0] as unknown as Task & Record<string, unknown> }] });
    expect(m.tasks.find(t => t.id === 'a')!.title).toBe('meine Fassung');
    expect(fassungText(lokal.tasks[0] as unknown as Task & Record<string, unknown>)).toContain('meine Fassung');
  });

  it('Gleiche Fassung auf beiden Seiten ist kein Konflikt (z. B. Antwort verloren, aber gespeichert)', () => {
    expect(gleichOhneZeit(aufgabe('a', { updatedAt: T0 }), { ...aufgabe('a', { updatedAt: '2026-09-02T00:00:00.000Z' }), verlauf: [{ am: T0, von: 'kevin', was: 'angelegt' }], stand: 'x' })).toBe(true);
    expect(gleichOhneZeit(aufgabe('a'), aufgabe('a', { title: 'anders' }))).toBe(false);
  });
});

describe('Pakete, Ablehnung, erneuter Versuch', () => {
  it('Pakete zu 150 Aufgaben, Struktur im ersten; nach 400/413 in Einzeländerungen zerlegt', () => {
    const lokal = stand(Array.from({ length: 320 }, (_, i) => aufgabe(`t${i}`)));
    lokal.projects = [{ id: 'p', title: 'P', category: 'business', owner: 'both', color: '#000000', tags: [], archived: false, createdAt: T0, updatedAt: T0 }];
    const ops = unterschied(leererStand(), lokal, new Map());
    const p = pakete(ops);
    expect(p.map(x => x.tasks.length)).toEqual([150, 150, 20]);
    expect(p[0].projects).toHaveLength(1);
    expect(p[1].projects).toHaveLength(0);
    expect(koerper(p[0])).toMatchObject({ struktur: { projekte: [{ op: 'upsert' }] } });
    expect(koerper(p[1]).struktur).toBeUndefined();
    const e = einzeln(p[2]);
    expect(e).toHaveLength(20);
    expect(e.every(x => anzahl(x) === 1)).toBe(true);
    // Die abgelehnte Zeile wird herausgefiltert, der Rest geht weiter.
    expect(anzahl(filtern(p[2], k => k !== 'tasks:t300'))).toBe(19);
  });

  it('Erneut versuchen nur bei Vorübergehendem (Netz, 5xx, 429, abgelaufene Sitzung) — mit wachsendem Abstand bis 60 s', () => {
    for (const s of [0, 401, 429, 500, 502, 503]) expect(voruebergehend(s)).toBe(true);
    for (const s of [400, 403, 409, 413]) expect(voruebergehend(s)).toBe(false);
    expect([0, 1, 2, 3, 4, 5, 9].map(wartezeit)).toEqual([2000, 4000, 8000, 16000, 32000, 60000, 60000]);
  });
});

describe('Gemerkt im Tab: „bitte neu laden“ verliert nichts', () => {
  it('Ausstehendes wird mit Stand gemerkt und nach dem Neuladen wieder angewandt — nur für dieselbe Person, höchstens 7 Tage', () => {
    const server = stand([aufgabe('a'), aufgabe('b')]);
    const lokal = stand([aufgabe('a', { notiz: 'offen' })]);
    const st: Staende = new Map([['tasks:a', 's-a'], ['tasks:b', 's-b']]);
    const g = merkenAus(unterschied(server, lokal, st), 'kevin', '2026-09-29T10:00:00.000Z');
    const zurueck = gemerktAlsOps(JSON.parse(JSON.stringify(g)), 'kevin', Date.parse('2026-09-29T11:00:00.000Z'))!;
    expect(zurueck.staende).toEqual([['tasks:a', 's-a'], ['tasks:b', 's-b']]);
    const neu = aufOps(server, zurueck.ops);
    expect(neu.tasks).toEqual([aufgabe('a', { notiz: 'offen' })]);
    expect(gemerktAlsOps(g, 'malin', Date.parse('2026-09-29T11:00:00.000Z'))).toBeNull();
    expect(gemerktAlsOps(g, 'kevin', Date.parse('2026-10-09T11:00:00.000Z'))).toBeNull();
    expect(gemerktAlsOps({ ...g, zeilen: [{ liste: 'quatsch', id: 'x', eintrag: null }] }, 'kevin', Date.parse('2026-09-29T11:00:00.000Z'))).toBeNull();
  });

  it('ohneStand trennt den Stand von der Sicht (nie `stand` im Zustand)', () => {
    const st: Staende = new Map();
    const s = ohneStand({ ...leererStand(), tasks: [{ ...aufgabe('a'), stand: 'fp-a' } as unknown as Task] }, st);
    expect('stand' in s.tasks[0]).toBe(false);
    expect(st.get('tasks:a')).toBe('fp-a');
  });
});

describe('Löschen im Browser = Papierkorb', () => {
  it('DELETE_TASK legt Aufgabe + Unteraufgaben hinein, WIEDERHERSTELLEN holt beides, ENDGUELTIG_LOESCHEN entfernt', () => {
    const s = stand([aufgabe('a', { notiz: 'bleibt' }), aufgabe('u', { parentId: 'a' }), aufgabe('w', { abhaengigVon: ['a'], dependencies: [{ blockedByTaskId: 'a' }] })]);
    const k = tasksReducer(s, { type: 'DELETE_TASK', payload: { id: 'a' } });
    expect(k.tasks.find(t => t.id === 'a')!.geloeschtAm).toBeTruthy();
    expect(k.tasks.find(t => t.id === 'a')!.notiz).toBe('bleibt');
    expect(k.tasks.find(t => t.id === 'u')!.geloeschtMit).toBe('a');
    // Wer darauf wartete, wartet nicht mehr auf einen Geist.
    expect(k.tasks.find(t => t.id === 'w')!.abhaengigVon).toBeUndefined();
    const w = tasksReducer(k, { type: 'WIEDERHERSTELLEN', payload: { art: 'aufgabe', id: 'a' } });
    expect(w.tasks.filter(t => t.geloeschtAm)).toEqual([]);
    const e = tasksReducer(k, { type: 'ENDGUELTIG_LOESCHEN', payload: { art: 'aufgabe', id: 'a' } });
    expect(e.tasks.map(t => t.id)).toEqual(['w']);
  });

  it('DELETE_PROJECT: Projekt samt Aufgaben in den Papierkorb (vorher: Notiz/Felder weg, Aufgaben nach „Sonstige“)', () => {
    const s: TasksState = { ...stand([aufgabe('a'), aufgabe('b')]), projects: [{ id: 'p', title: 'P', category: 'business', owner: 'both', color: '#000000', tags: [], archived: false, createdAt: T0, updatedAt: T0, notiz: 'Projektnotiz', felder: [{ id: 'f', name: 'F', typ: 'text' }] }] };
    const k = tasksReducer(s, { type: 'DELETE_PROJECT', payload: { id: 'p' } });
    expect(k.projects[0]).toMatchObject({ notiz: 'Projektnotiz', felder: [{ id: 'f' }] });
    expect(k.projects[0].geloeschtAm).toBeTruthy();
    expect(k.tasks.every(t => t.geloeschtMit === 'p' && t.projectId === 'p')).toBe(true);
    const w = tasksReducer(k, { type: 'WIEDERHERSTELLEN', payload: { art: 'projekt', id: 'p' } });
    expect(w.projects[0].geloeschtAm).toBeUndefined();
    expect(w.tasks.every(t => !t.geloeschtAm && t.projectId === 'p')).toBe(true);
  });
});
