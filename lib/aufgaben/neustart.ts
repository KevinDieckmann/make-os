// ─── MAKE OS — „Neu anfangen“: Aufgaben archivieren und zurückholen (rein, 29.09.) ─────
// Kevin 29.09.: „Morgen alle Ziele und Aufgaben rausnehmen und neu planen.“ Nichts wird gelöscht:
//   · Projekte, Gruppen, Listen und Aufgaben (auch erledigte, samt Unteraufgaben) bekommen `archiviertAm` + `archivId`
//     (die Kennung des Laufs). Sie bleiben im Bestand „tasks“ — Dateien, Zeiten, Follow-ups und Verbindungsprüfung
//     zeigen weiter auf etwas, das es gibt. Alle Leser blenden sie aus (`ohneArchiv`, eingehängt in `aufgabenSicht`).
//   · Serien ruhen: wer `wiederholung` trägt (Aufgabe oder Liste), gibt sie für die Zeit im Archiv ab — der Lauf
//     merkt sie sich (`pausiert`), der Morgenlauf findet so nichts, was er nachholen müsste. Zurück = Serie läuft weiter.
//   · Was bleibt: der Papierkorb (läuft ab wie immer), Vorlagen, eigene Status und offene Fristen-Aufgaben der Module
//     (Steuern, Belege, Löschfristen, Event-Pläne) — die Module erkennen sie an der festen Kennung und legten sie im
//     Archiv nie wieder an (`bleibtBeimNeustart`).
//   · Zurückholen ganz oder einzeln: ein Projekt samt allem, was mit diesem Lauf ging; eine Aufgabe samt Unteraufgaben
//     und — liegt ihr Projekt/ihre Liste/Gruppe noch im Archiv — mit deren Hülle (ohne die übrigen Aufgaben).
//     Archivieren → alles zurück ergibt denselben Bestand (Test tests/neustart.test.ts).
// Ziele und Meilensteine: lib/planung/neustart.ts. Der Server-Weg (eine Sperre je Bestand, Archiv-Kopie vorab):
// lib/aufgaben/neustart-server.ts.

import type { AufgabenGruppe, AufgabenListe, Project, Task, TasksState, Wiederholung } from '@/types/tasks';

type Archivierbar = { archiviertAm?: string; archivId?: string };
export const imArchiv = (x: Archivierbar | null | undefined): boolean => !!x?.archiviertAm;

/** Kennungen der Lauf-Protokolle: `na-<uuid>` (Browser erzeugt sie beim Öffnen des Dialogs — Wiederholen = derselbe Lauf). */
export const LAUF_ID = /^na-[a-z0-9-]{6,60}$/;
/** Was zum Bestätigen getippt werden muss (Dialog und Server). */
export const NEUSTART_BESTAETIGUNG = 'NEU ANFANGEN';

/** Offene Fristen-Aufgaben, die ein Modul selbst verwaltet (feste Kennung) — sie bleiben beim Neustart stehen. */
const MODUL_KENNUNGEN: readonly RegExp[] = [/^steuer-/, /^beleg-/, /^loeschfrist-kontakte$/, /^ev-/];
export const istModulAufgabe = (t: Pick<Task, 'id'>): boolean => MODUL_KENNUNGEN.some(r => r.test(t.id));
const offen = (t: Pick<Task, 'status'>) => t.status !== 'done' && t.status !== 'cancelled';
/** Bleibt diese Aufgabe beim Neustart stehen? (Papierkorb ohnehin; offene Modul-Aufgaben samt ihren Unteraufgaben.) */
export function bleibtBeimNeustart(t: Task, nachId: ReadonlyMap<string, Task>): boolean {
  if (t.geloeschtAm) return true;
  const eltern = t.parentId ? nachId.get(t.parentId) : undefined;
  const wurzel = eltern ?? t;
  return istModulAufgabe(wurzel) && offen(wurzel);
}

/** Der Bestand ohne Archiv — so sehen ihn alle Leser (über `aufgabenSicht`). Aufgaben eines archivierten Projekts fallen mit weg. */
export function ohneArchiv<T extends TasksState>(state: T): T {
  const projekte = new Set(state.projects.filter(imArchiv).map(p => p.id));
  const listen = state.listen ?? [], gruppen = state.gruppen ?? [];
  if (!projekte.size && !state.tasks.some(imArchiv) && !listen.some(imArchiv) && !gruppen.some(imArchiv)) return state;
  const tasks = state.tasks.filter(t => !imArchiv(t) && !projekte.has(t.projectId));
  const bleibt = new Set(tasks.map(t => t.id));
  return {
    ...state,
    projects: state.projects.filter(p => !projekte.has(p.id)),
    tasks: tasks.filter(t => !t.parentId || bleibt.has(t.parentId)),
    listen: listen.filter(l => !imArchiv(l) && !projekte.has(l.projektId)),
    gruppen: gruppen.filter(g => !imArchiv(g) && !projekte.has(g.projektId)),
  };
}

/** Eine abgegebene Serie: an welcher Aufgabe/Liste sie hing und wie sie lief. */
export interface PausierteSerie { art: 'aufgabe' | 'liste'; id: string; titel: string; wiederholung: Wiederholung }

/** Was ein Lauf im Aufgaben-Bestand archiviert hat (nur Kennungen + pausierte Serien). */
export interface AufgabenErfasst {
  projekte: string[];
  gruppen: string[];
  listen: string[];
  aufgaben: string[];
  pausiert: PausierteSerie[];
}
export const leerErfasst = (): AufgabenErfasst => ({ projekte: [], gruppen: [], listen: [], aufgaben: [], pausiert: [] });

const marke = <X extends Archivierbar>(x: X, laufId: string, jetzt: string): X => ({ ...x, archiviertAm: jetzt, archivId: laufId });
function ohneMarke<X extends Archivierbar>(x: X): X {
  const n = { ...x };
  delete n.archiviertAm; delete n.archivId;
  return n;
}
function ohneSerie<X extends { wiederholung?: Wiederholung }>(x: X): X {
  const n = { ...x };
  delete n.wiederholung;
  return n;
}

/**
 * Alles Sichtbare archivieren (Papierkorb und offene Modul-Aufgaben bleiben). `updatedAt` bleibt unberührt — es ist
 * keine inhaltliche Änderung, und so ist „zurückholen“ exakt der alte Stand. Idempotent: schon Archiviertes zählt nicht neu.
 */
export function aufgabenArchivieren(state: TasksState, laufId: string, jetzt: string): { state: TasksState; erfasst: AufgabenErfasst } {
  const erfasst = leerErfasst();
  const korb = new Set(state.projects.filter(p => p.geloeschtAm).map(p => p.id));
  const nachId = new Map(state.tasks.map(t => [t.id, t]));
  // Projekte mit bleibenden Aufgaben (offene Steuer-Aufgabe in einem Projekt) bleiben selbst stehen — sonst wären sie unsichtbar.
  const projektBleibt = new Set(state.tasks.filter(t => !t.geloeschtAm && !imArchiv(t) && bleibtBeimNeustart(t, nachId)).map(t => t.projectId));
  const listeBleibt = new Set(state.tasks.filter(t => !t.geloeschtAm && !imArchiv(t) && bleibtBeimNeustart(t, nachId) && t.listeId).map(t => t.listeId!));
  const projects = state.projects.map((p): Project => {
    if (imArchiv(p) || p.geloeschtAm || projektBleibt.has(p.id)) return p;
    erfasst.projekte.push(p.id);
    return marke(p, laufId, jetzt);
  });
  const gruppenBleiben = new Set((state.listen ?? []).filter(l => listeBleibt.has(l.id) && l.gruppeId).map(l => l.gruppeId!));
  const gruppen = (state.gruppen ?? []).map((g): AufgabenGruppe => {
    if (imArchiv(g) || korb.has(g.projektId) || gruppenBleiben.has(g.id)) return g;
    erfasst.gruppen.push(g.id);
    return marke(g, laufId, jetzt);
  });
  const listen = (state.listen ?? []).map((l): AufgabenListe => {
    if (imArchiv(l) || korb.has(l.projektId) || listeBleibt.has(l.id)) return l;
    erfasst.listen.push(l.id);
    let n = marke(l, laufId, jetzt);
    if (n.wiederholung) { erfasst.pausiert.push({ art: 'liste', id: l.id, titel: l.titel, wiederholung: n.wiederholung }); n = ohneSerie(n); }
    return n;
  });
  const tasks = state.tasks.map((t): Task => {
    if (imArchiv(t) || bleibtBeimNeustart(t, nachId)) return t;
    erfasst.aufgaben.push(t.id);
    let n = marke(t, laufId, jetzt);
    if (n.wiederholung) { erfasst.pausiert.push({ art: 'aufgabe', id: t.id, titel: t.title, wiederholung: n.wiederholung }); n = ohneSerie(n); }
    return n;
  });
  const nichts = !erfasst.projekte.length && !erfasst.gruppen.length && !erfasst.listen.length && !erfasst.aufgaben.length;
  return { state: nichts ? state : { ...state, projects, gruppen, listen, tasks }, erfasst };
}

/** Auswahl beim Zurückholen: alles, ein Projekt (samt allem, was mit dem Lauf ging) oder eine Aufgabe (samt Unteraufgaben). */
export type AufgabenAuswahl = { art: 'alles' } | { art: 'projekt'; id: string } | { art: 'aufgabe'; id: string };

export interface ZurueckErgebnis { state: TasksState; projekte: string[]; gruppen: string[]; listen: string[]; aufgaben: string[] }

/**
 * Zurückholen (rein). Nur Einträge mit genau dieser Lauf-Kennung; pausierte Serien bekommen ihre `wiederholung` zurück
 * (nur, wenn inzwischen keine neue gesetzt wurde). Idempotent: schon Zurückgeholtes bleibt, wie es ist.
 */
export function aufgabenZurueck(state: TasksState, laufId: string, auswahl: AufgabenAuswahl, pausiert: readonly PausierteSerie[] = []): ZurueckErgebnis {
  const vomLauf = (x: Archivierbar) => imArchiv(x) && x.archivId === laufId;
  const p = new Set<string>(), g = new Set<string>(), l = new Set<string>(), a = new Set<string>();
  const listeNach = new Map((state.listen ?? []).map(x => [x.id, x]));
  if (auswahl.art === 'alles') {
    for (const x of state.projects) if (vomLauf(x)) p.add(x.id);
    for (const x of state.gruppen ?? []) if (vomLauf(x)) g.add(x.id);
    for (const x of state.listen ?? []) if (vomLauf(x)) l.add(x.id);
    for (const x of state.tasks) if (vomLauf(x)) a.add(x.id);
  } else if (auswahl.art === 'projekt') {
    p.add(auswahl.id);
    for (const x of state.gruppen ?? []) if (x.projektId === auswahl.id && vomLauf(x)) g.add(x.id);
    for (const x of state.listen ?? []) if (x.projektId === auswahl.id && vomLauf(x)) l.add(x.id);
    for (const x of state.tasks) if (x.projectId === auswahl.id && vomLauf(x)) a.add(x.id);
  } else {
    const t0 = state.tasks.find(x => x.id === auswahl.id);
    if (t0) {
      // Eine Unteraufgabe kommt nur mit ihrer Hauptaufgabe (sonst hinge sie an etwas Unsichtbarem).
      const wurzel = t0.parentId ? state.tasks.find(x => x.id === t0.parentId) ?? t0 : t0;
      a.add(wurzel.id);
      for (const x of state.tasks) if (x.parentId === wurzel.id && vomLauf(x)) a.add(x.id);
      // Die Hülle: Projekt, Liste und Gruppe, falls sie noch im Archiv liegen — ohne deren übrige Aufgaben.
      p.add(wurzel.projectId);
      const liste = wurzel.listeId ? listeNach.get(wurzel.listeId) : undefined;
      if (liste) { l.add(liste.id); if (liste.gruppeId) g.add(liste.gruppeId); }
    }
  }
  const zurueck: Omit<ZurueckErgebnis, 'state'> = { projekte: [], gruppen: [], listen: [], aufgaben: [] };
  const serieVon = new Map(pausiert.map(s => [`${s.art}:${s.id}`, s.wiederholung]));
  const projects = state.projects.map(x => { if (!p.has(x.id) || !vomLauf(x)) return x; zurueck.projekte.push(x.id); return ohneMarke(x); });
  const gruppen = (state.gruppen ?? []).map(x => { if (!g.has(x.id) || !vomLauf(x)) return x; zurueck.gruppen.push(x.id); return ohneMarke(x); });
  const listen = (state.listen ?? []).map(x => {
    if (!l.has(x.id) || !vomLauf(x)) return x;
    zurueck.listen.push(x.id);
    const w = serieVon.get(`liste:${x.id}`);
    return w && !x.wiederholung ? { ...ohneMarke(x), wiederholung: w } : ohneMarke(x);
  });
  const tasks = state.tasks.map(x => {
    if (!a.has(x.id) || !vomLauf(x)) return x;
    zurueck.aufgaben.push(x.id);
    const w = serieVon.get(`aufgabe:${x.id}`);
    return w && !x.wiederholung ? { ...ohneMarke(x), wiederholung: w } : ohneMarke(x);
  });
  const nichts = !zurueck.projekte.length && !zurueck.gruppen.length && !zurueck.listen.length && !zurueck.aufgaben.length;
  return { state: nichts ? state : { ...state, projects, gruppen, listen, tasks }, ...zurueck };
}

/** Wie viele Serien laufen weiter, wenn … — zählt verschiedene Serien (Aufgaben einer Serie = eine). */
export function serienZaehlen(pausiert: readonly PausierteSerie[], tasks: readonly Pick<Task, 'id' | 'serieId'>[]): number {
  const nachId = new Map(tasks.map(t => [t.id, t]));
  return new Set(pausiert.map(s => (s.art === 'liste' ? `l:${s.id}` : `a:${nachId.get(s.id)?.serieId ?? s.id}`))).size;
}

/** Zahlen für die Vorschau („n Projekte, n Aufgaben werden archiviert“) — rechnet genau wie `aufgabenArchivieren`. */
export interface AufgabenVorschau {
  projekte: number; gruppen: number; listen: number; aufgaben: number; unteraufgaben: number; erledigt: number;
  serien: { art: 'aufgabe' | 'liste'; titel: string; regel: Wiederholung['regel'] }[];
  bleiben: { titel: string; id: string }[];
}
export function aufgabenVorschau(state: TasksState): AufgabenVorschau {
  const r = aufgabenArchivieren(state, 'na-vorschau', '1970-01-01T00:00:00.000Z');
  const nachId = new Map(state.tasks.map(t => [t.id, t]));
  const archiviert = r.erfasst.aufgaben.map(id => nachId.get(id)!).filter(Boolean);
  // Eine Serie einmal nennen (die jüngste Aufgabe mit Rhythmus steht für sie).
  const gesehen = new Set<string>();
  const serien: AufgabenVorschau['serien'] = [];
  for (const s of r.erfasst.pausiert) {
    const k = s.art === 'liste' ? `l:${s.id}` : `a:${nachId.get(s.id)?.serieId ?? s.id}`;
    if (gesehen.has(k)) continue;
    gesehen.add(k);
    serien.push({ art: s.art, titel: s.titel, regel: s.wiederholung.regel });
  }
  return {
    projekte: r.erfasst.projekte.length, gruppen: r.erfasst.gruppen.length, listen: r.erfasst.listen.length,
    aufgaben: archiviert.filter(t => !t.parentId).length, unteraufgaben: archiviert.filter(t => !!t.parentId).length,
    erledigt: archiviert.filter(t => t.status === 'done' || t.status === 'cancelled').length,
    serien,
    bleiben: state.tasks.filter(t => !t.geloeschtAm && !t.parentId && !imArchiv(t) && bleibtBeimNeustart(t, nachId)).map(t => ({ id: t.id, titel: t.title })),
  };
}

// ── Archiv-Ansicht (rein, 29.09. abends — Sichtprüfung F6) ────────────────
export interface ArchivAufgabe { id: string; titel: string; spaceId?: string; projektId: string; erledigt: boolean; unter: number; zurueck: boolean }
export interface ArchivProjekt { id: string; titel: string; spaceId?: string; farbe?: string; aufgaben: number; zurueck: boolean }
export interface ArchivSerie { art: 'aufgabe' | 'liste'; titel: string; regel: string; zurueck: boolean }

/**
 * Projekte, Aufgaben ohne Projekt und ruhende Serien EINES Laufs für die Ansicht „Archiv“ — Titel aus dem aktuellen Bestand.
 *  · Eine Aufgabe gehört zu ihrem Projekt, wenn der Lauf das Projekt mitgenommen hat — auch nachdem alles wiederhergestellt
 *    ist (vorher rutschten nach „Alles wiederherstellen“ alle Projekt-Aufgaben nach „Aufgaben ohne Projekt“). Lose steht sie
 *    nur, wenn ihr Projekt nicht mit diesem Lauf ging ODER die Hülle schon zurück ist, sie selbst aber noch im Archiv liegt
 *    (dann ist sie nur einzeln zurückzuholen).
 *  · Serien: eine Serie einmal (Schlüssel = Serien-Kennung, wie die Vorschau) — das erledigte Original und die neue Instanz
 *    derselben Serie sind EINE Serie. „läuft wieder“, sobald keine ihrer Aufgaben mehr im Archiv liegt.
 * `sichtbar` = Sichtfilter „nur ich“ (fremde „nur ich“-Aufgaben erscheinen nicht).
 */
export function archivSicht(state: Pick<TasksState, 'projects' | 'tasks' | 'listen'>, laufId: string, erfasst: AufgabenErfasst, sichtbar: (t: Task) => boolean = () => true): { projekte: ArchivProjekt[]; aufgaben: ArchivAufgabe[]; serien: ArchivSerie[] } {
  const vomLauf = (x: Archivierbar | undefined) => !!x && imArchiv(x) && x.archivId === laufId;
  const projektNach = new Map(state.projects.map(p => [p.id, p]));
  const nachId = new Map(state.tasks.map(t => [t.id, t]));
  const listeNach = new Map((state.listen ?? []).map(x => [x.id, x]));
  const archivierteProjekte = new Set(erfasst.projekte);
  const inLauf = new Set(erfasst.aufgaben);
  const haupt = state.tasks.filter(t => inLauf.has(t.id) && !t.parentId && sichtbar(t));
  const lose = (t: Task) => !archivierteProjekte.has(t.projectId) || (!vomLauf(projektNach.get(t.projectId)) && vomLauf(t));
  const projekte: ArchivProjekt[] = erfasst.projekte.map(id => projektNach.get(id)).filter((p): p is Project => !!p).map(p => ({
    id: p.id, titel: p.title, ...(p.spaceId ? { spaceId: p.spaceId } : {}), farbe: p.color,
    aufgaben: haupt.filter(t => t.projectId === p.id && !lose(t)).length, zurueck: !vomLauf(p),
  }));
  const aufgaben: ArchivAufgabe[] = haupt.filter(lose).map(t => ({
    id: t.id, titel: t.title, ...(t.spaceId ? { spaceId: t.spaceId } : {}), projektId: t.projectId, erledigt: t.status === 'done' || t.status === 'cancelled',
    unter: state.tasks.filter(u => u.parentId === t.id && inLauf.has(u.id)).length, zurueck: !vomLauf(t),
  }));
  const je = new Map<string, { eintraege: PausierteSerie[] }>();
  for (const s of erfasst.pausiert) {
    if (s.art === 'aufgabe') { const t = nachId.get(s.id); if (!t || !sichtbar(t)) continue; }
    const k = s.art === 'liste' ? `l:${s.id}` : `a:${nachId.get(s.id)?.serieId ?? s.id}`;
    const e = je.get(k) ?? { eintraege: [] };
    e.eintraege.push(s);
    je.set(k, e);
  }
  const serien: ArchivSerie[] = Array.from(je.values()).map(({ eintraege }) => {
    // Für die Anzeige steht die offene Instanz (sonst die erste) — ihr Titel, ihre Regel.
    const offenAm = eintraege.find(s => s.art === 'aufgabe' && (() => { const t = nachId.get(s.id); return !!t && t.status !== 'done' && t.status !== 'cancelled'; })());
    const s = offenAm ?? eintraege[0];
    const ruht = eintraege.some(x => (x.art === 'liste' ? vomLauf(listeNach.get(x.id)) : vomLauf(nachId.get(x.id))));
    return { art: s.art, titel: s.art === 'aufgabe' ? nachId.get(s.id)?.title ?? s.titel : listeNach.get(s.id)?.titel ?? s.titel, regel: s.wiederholung.regel, zurueck: !ruht };
  });
  return { projekte, aufgaben, serien };
}
