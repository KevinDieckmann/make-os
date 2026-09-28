// ─── Aufgaben-Export (29.09., #81) — rein ───────────────────────────────────
// Umzug und Auskunft (Art. 20) für die Aufgaben: EINE JSON-Datei mit Spaces, Projekten, Gruppen, Listen, Aufgaben (samt
// Unteraufgaben über `parentId`), Serien, Abhängigkeiten, Kommentaren, eigenen Status, Vorlagen und der Dateiliste (nur
// Angaben — Name, Typ, Größe, Bezug; die Inhalte liegen verschlüsselt in der Ablage). Papierkorb und Archiv („Neu
// anfangen“) sind dabei und tragen ihre Marke. Weich entfernte Kommentare erscheinen nur als „Kommentar entfernt“. `exportEinlesen` liest
// eine solche Datei wieder ein (gesäubert wie jeder Schreibweg) — der Test prüft den Hin- und Rückweg.
// Wer exportiert, bekommt nur, was er sehen darf (Sichtfilter „nur ich“ vorher, app/api/aufgaben/export).

import type { AufgabenGruppe, AufgabenListe, AufgabenStatus, AufgabenVorlage, Project, Task, TasksState } from '@/types/tasks';
import { taskSauber, projektSauber, listeSauber, gruppeSauber, statusSauber, vorlageSauber } from './saeubern';
import { wiederholungText } from './wiederholung';
import { serieVon } from './serie';

export const EXPORT_FORMAT = 'make-os-aufgaben';
export const EXPORT_VERSION = 1;
/** Text eines weich entfernten Kommentars im Export. */
export const ENTFERNT_TEXT = 'Kommentar entfernt';

export interface ExportSpace { id: string; label: string; bereich: 'privat' | 'business'; art: string; archiv?: boolean }
export interface ExportDatei { id: string; name: string; typ?: string; groesse?: number; projektId: string; aufgabeId?: string; bereich?: string; notiz?: string; angelegt?: string }
export interface ExportSerie { serie: string; regel: string; text: string; aufgaben: string[] }

export interface AufgabenExport {
  format: typeof EXPORT_FORMAT;
  version: number;
  erstellt: string;
  von: string;
  zahlen: { spaces: number; projekte: number; gruppen: number; listen: number; aufgaben: number; unteraufgaben: number; kommentare: number; dateien: number; serien: number; abhaengigkeiten: number };
  spaces: ExportSpace[];
  projekte: Project[];
  gruppen: AufgabenGruppe[];
  listen: AufgabenListe[];
  aufgaben: Task[];
  statusEigen: AufgabenStatus[];
  vorlagen: AufgabenVorlage[];
  serien: ExportSerie[];
  abhaengigkeiten: { aufgabe: string; wartetAuf: string }[];
  dateien: ExportDatei[];
}

/** Die Exportdatei bauen (rein). `state` ist schon nach der Sicht der Person gefiltert. */
export function exportBauen(state: TasksState, o: { spaces: readonly ExportSpace[]; dateien: readonly ExportDatei[]; von: string; jetzt: string }): AufgabenExport {
  const aufgaben = state.tasks.map(t => {
    const n: Task = { ...t };
    // Weich entfernte Kommentare (#76): für die Person entfernt — statt des Textes nur der Hinweis.
    if (n.kommentare?.length) n.kommentare = n.kommentare.map(k => (k.entfernt ? { ...k, text: ENTFERNT_TEXT } : k));
    return n;
  });
  const ids = new Set(aufgaben.map(t => t.id));
  const projektIds = new Set([...state.projects.map(p => p.id), ...aufgaben.map(t => t.projectId)]);
  const dateien = o.dateien.filter(d => projektIds.has(d.projektId) && (!d.aufgabeId || ids.has(d.aufgabeId)));
  const serienMap = new Map<string, ExportSerie>();
  for (const t of aufgaben) {
    if (t.parentId || (!t.wiederholung && !t.serieId)) continue;
    const s = serieVon(t);
    const e = serienMap.get(s) ?? { serie: s, regel: t.wiederholung?.regel ?? '', text: t.wiederholung ? wiederholungText(t.wiederholung) : '', aufgaben: [] };
    if (t.wiederholung && !e.regel) { e.regel = t.wiederholung.regel; e.text = wiederholungText(t.wiederholung); }
    e.aufgaben.push(t.id);
    serienMap.set(s, e);
  }
  const abhaengigkeiten = aufgaben.flatMap(t => (t.abhaengigVon ?? []).filter(x => ids.has(x)).map(x => ({ aufgabe: t.id, wartetAuf: x })));
  const serien = Array.from(serienMap.values());
  return {
    format: EXPORT_FORMAT, version: EXPORT_VERSION, erstellt: o.jetzt, von: o.von,
    zahlen: {
      spaces: o.spaces.length, projekte: state.projects.length, gruppen: (state.gruppen ?? []).length, listen: (state.listen ?? []).length,
      aufgaben: aufgaben.filter(t => !t.parentId).length, unteraufgaben: aufgaben.filter(t => !!t.parentId).length,
      kommentare: aufgaben.reduce((n, t) => n + (t.kommentare?.length ?? 0), 0), dateien: dateien.length, serien: serien.length, abhaengigkeiten: abhaengigkeiten.length,
    },
    spaces: [...o.spaces], projekte: state.projects, gruppen: state.gruppen ?? [], listen: state.listen ?? [], aufgaben,
    statusEigen: state.statusEigen ?? [], vorlagen: state.vorlagen ?? [], serien, abhaengigkeiten, dateien,
  };
}

export class ExportUngueltig extends Error {}

/**
 * Eine Exportdatei wieder einlesen → ein Aufgaben-Bestand (gesäubert wie jeder Schreibweg; Unbrauchbares fällt weg).
 * Wirft `ExportUngueltig`, wenn es keine MAKE-OS-Aufgaben-Datei ist. Der Verlauf kommt mit (er ist Teil der Auskunft),
 * wird aber — wie immer — nur vom Server fortgeschrieben.
 */
export function exportEinlesen(roh: unknown): TasksState {
  if (!roh || typeof roh !== 'object') throw new ExportUngueltig('Keine Exportdatei.');
  const o = roh as Record<string, unknown>;
  if (o.format !== EXPORT_FORMAT || typeof o.version !== 'number' || o.version > EXPORT_VERSION) throw new ExportUngueltig('Unbekanntes Format oder zu neue Version.');
  // Die Archiv-Marke von „Neu anfangen“ kommt mit (die Säuberung der Schreibwege kennt sie nicht — Browser setzen sie nie).
  const ISO = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/, KENNUNG = /^na-[a-z0-9-]{6,60}$/;
  const mitArchiv = <T extends object>(x: T | null, r: unknown): T | null => {
    const q = r as { archiviertAm?: unknown; archivId?: unknown } | null;
    return x && q && typeof q.archiviertAm === 'string' && ISO.test(q.archiviertAm) && typeof q.archivId === 'string' && KENNUNG.test(q.archivId) ? { ...x, archiviertAm: q.archiviertAm, archivId: q.archivId } : x;
  };
  const liste = <T extends object>(v: unknown, sauber: (x: unknown) => T | null): T[] => (Array.isArray(v) ? v.map(r => mitArchiv(sauber(r), r)).filter((x): x is T => !!x) : []);
  const verlauf = new Map((Array.isArray(o.aufgaben) ? o.aufgaben as Record<string, unknown>[] : []).filter(t => t && Array.isArray(t.verlauf)).map(t => [String(t.id), t.verlauf as Task['verlauf']]));
  const tasks = liste(o.aufgaben, taskSauber).map(t => (verlauf.has(t.id) ? { ...t, verlauf: verlauf.get(t.id) } : t));
  return {
    projects: liste(o.projekte, projektSauber), tasks, listen: liste(o.listen, listeSauber), gruppen: liste(o.gruppen, gruppeSauber),
    statusEigen: liste(o.statusEigen, statusSauber), vorlagen: liste(o.vorlagen, vorlageSauber),
  };
}
