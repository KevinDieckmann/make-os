// ─── MAKE OS — Papierkorb für Projekte und Aufgaben (rein, 29.09., A7) ──────
// Kevin: „Alle Infos müssen immer sauber gespeichert werden.“ Löschen war endgültig: ein Projekt nahm Notiz,
// Beschreibung und eigene Felder mit, Dateien blieben verwaist. Jetzt:
//   · „Löschen“ legt in den Papierkorb (`geloeschtAm`). Ein Projekt nimmt seine Aufgaben mit (`geloeschtMit` =
//     Projekt), eine Aufgabe ihren ganzen Teilbaum (seit 01.10. alle Ebenen; `geloeschtMit` = Aufgabe). Notiz, Felder, Listen, Gruppen und Dateien
//     bleiben am Eintrag stehen.
//   · Wiederherstellen holt die ganze Kette zurück. Liegt das Projekt einer einzeln gelöschten Aufgabe selbst im
//     Papierkorb (oder ist es weg), landet sie in „Sonstige“ ihres Space; eine Unteraufgabe ohne Eltern wird eine
//     normale Aufgabe.
//   · Endgültig löschen ist ein eigener Weg (Op `delete` auf einen Papierkorb-Eintrag) — erst dann gehen auch die
//     Dateien (Server, lib/aufgaben/speicher.ts). Nach 30 Tagen räumt der Morgenlauf auf.
//   · Alle Leser sehen den Papierkorb nie: `aufgabenSicht` (Server `ladeAufgabenSicht`, GET /api/state/tasks ohne
//     `?papierkorb=1`, Browser `useTasks().state`).
// Tests: tests/aufgaben-papierkorb.test.ts.

import type { Task, TasksState } from '@/types/tasks';
import { sonstigeProjektId } from './struktur';
import { ohneArchiv } from './neustart';
import { nachfahrenIn, mitVerbliebenenVorfahren, vorfahren, nachIdKarte } from './ebenen';

export const PAPIERKORB_TAGE = 30;
const TAG_MS = 86_400_000;

export const imPapierkorb = (x: { geloeschtAm?: string } | undefined | null): boolean => !!x?.geloeschtAm;

/**
 * Der Bestand ohne Papierkorb — so sehen ihn alle Leser. Aufgaben eines Projekts im Papierkorb fallen mit weg.
 * Seit 29.09. auch ohne das Archiv von „Neu anfangen“ (`ohneArchiv`, lib/aufgaben/neustart.ts).
 */
export function aufgabenSicht<T extends TasksState>(state: T): T {
  return ohneArchiv(ohnePapierkorb(state));
}

function ohnePapierkorb<T extends TasksState>(state: T): T {
  const weg = new Set(state.projects.filter(imPapierkorb).map(p => p.id));
  if (!weg.size && !state.tasks.some(imPapierkorb)) return state;
  const tasks = state.tasks.filter(t => !imPapierkorb(t) && !weg.has(t.projectId));
  const bleibt = new Set(tasks.map(t => t.id));
  return {
    ...state,
    projects: state.projects.filter(p => !weg.has(p.id)),
    // Unteraufgaben, deren Eltern (auf irgendeiner Ebene) im Papierkorb liegen, sieht niemand (sie gehen immer mit).
    tasks: mitVerbliebenenVorfahren(tasks, bleibt),
    listen: (state.listen ?? []).filter(l => !weg.has(l.projektId)),
    gruppen: (state.gruppen ?? []).filter(g => !weg.has(g.projektId)),
  };
}

/** Was mitgeht — für die Rückfrage („3 Aufgaben, 5 Unteraufgaben, Notiz, 2 Dateien“). */
export interface Umfang { aufgaben: number; unteraufgaben: number; notiz: boolean; beschreibung: boolean; felder: number; listen: number; dateien: number }

export function projektUmfang(state: TasksState, projektId: string, dateien = 0): Umfang {
  const p = state.projects.find(x => x.id === projektId);
  const t = state.tasks.filter(x => x.projectId === projektId && !imPapierkorb(x));
  return {
    aufgaben: t.filter(x => !x.parentId).length, unteraufgaben: t.filter(x => !!x.parentId).length,
    notiz: !!p?.notiz?.trim(), beschreibung: !!p?.beschreibung?.trim(), felder: p?.felder?.length ?? 0,
    listen: (state.listen ?? []).filter(l => l.projektId === projektId).length, dateien,
  };
}

export function aufgabeUmfang(state: TasksState, taskId: string, dateien = 0): Umfang {
  const t = state.tasks.find(x => x.id === taskId);
  // Mehrstufig (01.10.): der ganze Teilbaum geht mit — gezählt werden alle Ebenen.
  const unter = nachfahrenIn(taskId, state.tasks).filter(x => !imPapierkorb(x));
  return {
    aufgaben: 0, unteraufgaben: unter.length, notiz: !!t?.notiz?.trim() || unter.some(u => !!u.notiz?.trim()), beschreibung: !!t?.description?.trim(),
    felder: Object.keys(t?.felder ?? {}).length, listen: 0, dateien,
  };
}

const zahl = (n: number, eins: string, viele: string) => `${n} ${n === 1 ? eins : viele}`;
/** „3 Aufgaben, 5 Unteraufgaben, Notiz, 2 Dateien“ — leer, wenn nichts mitgeht. */
export function umfangText(u: Umfang): string {
  return [
    u.aufgaben ? zahl(u.aufgaben, 'Aufgabe', 'Aufgaben') : '', u.unteraufgaben ? zahl(u.unteraufgaben, 'Unteraufgabe', 'Unteraufgaben') : '',
    u.listen ? zahl(u.listen, 'Liste', 'Listen') : '', u.notiz ? 'Notiz' : '', u.beschreibung ? 'Beschreibung' : '',
    u.felder ? zahl(u.felder, 'Feld', 'Felder') : '', u.dateien ? zahl(u.dateien, 'Datei', 'Dateien') : '',
  ].filter(Boolean).join(', ');
}

/**
 * Wer auf eine gelöschte Aufgabe wartete, wartet nicht mehr auf einen Geist (wie vorher beim Löschen) — beim
 * Wiederherstellen kommt dieser Verweis nicht zurück.
 */
function verweiseLoesen(tasks: Task[], ids: ReadonlySet<string>, jetzt: string): Task[] {
  return tasks.map(t => {
    const hatte = t.abhaengigVon?.some(x => ids.has(x)) || t.dependencies?.some(d => ids.has(d.blockedByTaskId));
    if (!hatte || ids.has(t.id)) return t;
    const abhaengigVon = t.abhaengigVon?.filter(x => !ids.has(x));
    const n: Task = { ...t, dependencies: (t.dependencies ?? []).filter(d => !ids.has(d.blockedByTaskId)), updatedAt: jetzt };
    if (abhaengigVon?.length) n.abhaengigVon = abhaengigVon; else delete n.abhaengigVon;
    return n;
  });
}

/** Projekt in den Papierkorb — seine Aufgaben (die nicht schon drin liegen) gehen mit. */
export function projektInPapierkorb(state: TasksState, id: string, jetzt: string): TasksState {
  const p = state.projects.find(x => x.id === id);
  if (!p || imPapierkorb(p)) return state;
  const mit = new Set(state.tasks.filter(t => t.projectId === id && !imPapierkorb(t)).map(t => t.id));
  const tasks = state.tasks.map(t => (mit.has(t.id) ? { ...t, geloeschtAm: jetzt, geloeschtMit: id, updatedAt: jetzt } : t));
  return { ...state, projects: state.projects.map(x => (x.id === id ? { ...x, geloeschtAm: jetzt, updatedAt: jetzt } : x)), tasks: verweiseLoesen(tasks, mit, jetzt) };
}

/** Aufgabe in den Papierkorb — ihr ganzer Teilbaum (alle Ebenen, 01.10.) geht mit (`geloeschtMit` = diese Aufgabe). */
export function aufgabeInPapierkorb(state: TasksState, id: string, jetzt: string): TasksState {
  const t0 = state.tasks.find(x => x.id === id);
  if (!t0 || imPapierkorb(t0)) return state;
  const unter = new Set(nachfahrenIn(id, state.tasks).filter(t => !imPapierkorb(t)).map(t => t.id));
  const tasks = state.tasks.map(t => {
    if (t.id === id) { const n: Task = { ...t, geloeschtAm: jetzt, updatedAt: jetzt }; delete n.geloeschtMit; return n; }
    return unter.has(t.id) ? { ...t, geloeschtAm: jetzt, geloeschtMit: id, updatedAt: jetzt } : t;
  });
  return { ...state, tasks: verweiseLoesen(tasks, new Set([id, ...unter]), jetzt) };
}

const ohneMarke = <T extends { geloeschtAm?: string; geloeschtMit?: string }>(x: T, jetzt: string): T => {
  const n = { ...x, updatedAt: jetzt } as T;
  delete n.geloeschtAm; delete n.geloeschtMit;
  return n;
};

/** Aus dem Papierkorb holen — samt Kette. Unbekannt oder nicht im Papierkorb → unverändert. */
export function wiederherstellen(state: TasksState, art: 'projekt' | 'aufgabe', id: string, jetzt: string): TasksState {
  if (art === 'projekt') {
    const p = state.projects.find(x => x.id === id);
    if (!p || !imPapierkorb(p)) return state;
    return {
      ...state,
      projects: state.projects.map(x => (x.id === id ? ohneMarke(x, jetzt) : x)),
      tasks: state.tasks.map(t => (t.geloeschtMit === id && imPapierkorb(t) ? ohneMarke(t, jetzt) : t)),
    };
  }
  const t0 = state.tasks.find(x => x.id === id);
  if (!t0 || !imPapierkorb(t0)) return state;
  const projekt = state.projects.find(p => p.id === t0.projectId);
  const projektWeg = !!projekt && imPapierkorb(projekt);
  const eltern = t0.parentId ? state.tasks.find(x => x.id === t0.parentId) : undefined;
  // Mehrstufig (01.10.): liegt das Elternteil ODER ein weiterer Vorfahre im Papierkorb, wird sie eine Hauptaufgabe.
  const elternWeg = !!t0.parentId && (!eltern || imPapierkorb(eltern) || vorfahren(eltern, nachIdKarte(state.tasks)).some(imPapierkorb));
  return {
    ...state,
    tasks: state.tasks.map(t => {
      if (t.id !== id && !(t.geloeschtMit === id && imPapierkorb(t))) return t;
      let n = ohneMarke(t, jetzt);
      // Das Projekt liegt noch im Papierkorb → die Aufgabe (und ihre Unteraufgaben) nach „Sonstige“ ihres Space.
      if (projektWeg) { n = { ...n, projectId: sonstigeProjektId(n.spaceId ?? 'privat') }; delete n.listeId; }
      if (t.id === id && elternWeg) delete n.parentId;
      return n;
    }),
  };
}

/** Endgültig: Wurzel + Kette aus dem Bestand. Liefert die Kennungen (für die Dateien). Nur für Papierkorb-Einträge. */
export function endgueltigEntfernen(state: TasksState, art: 'projekt' | 'aufgabe', id: string): { state: TasksState; aufgaben: string[]; projekte: string[] } {
  if (art === 'projekt') {
    const p = state.projects.find(x => x.id === id);
    if (!p || !imPapierkorb(p)) return { state, aufgaben: [], projekte: [] };
    const weg = state.tasks.filter(t => t.geloeschtMit === id || (t.projectId === id && imPapierkorb(t))).map(t => t.id);
    const w = new Set(weg);
    return {
      state: {
        ...state, projects: state.projects.filter(x => x.id !== id), tasks: state.tasks.filter(t => !w.has(t.id)),
        listen: (state.listen ?? []).filter(l => l.projektId !== id), gruppen: (state.gruppen ?? []).filter(g => g.projektId !== id),
      },
      aufgaben: weg, projekte: [id],
    };
  }
  const t0 = state.tasks.find(x => x.id === id);
  if (!t0 || !imPapierkorb(t0)) return { state, aufgaben: [], projekte: [] };
  const weg = [id, ...state.tasks.filter(t => t.geloeschtMit === id && imPapierkorb(t)).map(t => t.id)];
  const w = new Set(weg);
  return { state: { ...state, tasks: state.tasks.filter(t => !w.has(t.id)) }, aufgaben: weg, projekte: [] };
}

export interface PapierkorbEintrag { art: 'projekt' | 'aufgabe'; id: string; titel: string; geloeschtAm: string; spaceId?: string; /** Mitgegangen (Aufgaben/Unteraufgaben). */ mit: number; bisTag: string }

/** Die Wurzeln im Papierkorb (was man einzeln wiederherstellen kann), neueste zuerst. */
export function papierkorbEintraege(state: TasksState): PapierkorbEintrag[] {
  const bis = (am: string) => new Date(Date.parse(am) + PAPIERKORB_TAGE * TAG_MS).toISOString().slice(0, 10);
  const raus: PapierkorbEintrag[] = [];
  for (const p of state.projects) if (p.geloeschtAm) raus.push({ art: 'projekt', id: p.id, titel: p.title, geloeschtAm: p.geloeschtAm, ...(p.spaceId ? { spaceId: p.spaceId } : {}), mit: state.tasks.filter(t => t.geloeschtMit === p.id && imPapierkorb(t)).length, bisTag: bis(p.geloeschtAm) });
  for (const t of state.tasks) if (t.geloeschtAm && !t.geloeschtMit) raus.push({ art: 'aufgabe', id: t.id, titel: t.title, geloeschtAm: t.geloeschtAm, ...(t.spaceId ? { spaceId: t.spaceId } : {}), mit: state.tasks.filter(x => x.geloeschtMit === t.id && imPapierkorb(x)).length, bisTag: bis(t.geloeschtAm) });
  return raus.sort((a, b) => b.geloeschtAm.localeCompare(a.geloeschtAm));
}

/** Wurzeln, die länger als 30 Tage im Papierkorb liegen (Morgenlauf). Kette-Mitglieder ohne Wurzel zählen selbst. */
export function papierkorbAbgelaufen(state: TasksState, jetzt: string, tage = PAPIERKORB_TAGE): { art: 'projekt' | 'aufgabe'; id: string }[] {
  const grenze = Date.parse(jetzt) - tage * TAG_MS;
  const alt = (am?: string) => !!am && Date.parse(am) < grenze;
  const projekte = new Set(state.projects.filter(p => alt(p.geloeschtAm)).map(p => p.id));
  const raus: { art: 'projekt' | 'aufgabe'; id: string }[] = Array.from(projekte).map(id => ({ art: 'projekt' as const, id }));
  const wurzeln = new Set([...state.tasks.filter(t => t.geloeschtAm).map(t => t.id), ...state.projects.filter(p => p.geloeschtAm).map(p => p.id)]);
  for (const t of state.tasks) {
    if (!alt(t.geloeschtAm)) continue;
    // Mitglied einer Kette, deren Wurzel noch im Papierkorb liegt → geht mit der Wurzel (oder kommt mit ihr zurück).
    if (t.geloeschtMit && wurzeln.has(t.geloeschtMit)) continue;
    raus.push({ art: 'aufgabe', id: t.id });
  }
  return raus;
}
