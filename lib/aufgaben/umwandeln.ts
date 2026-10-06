// ─── MAKE OS — Umwandeln: Liste ↔ Aufgabe, Aufgabe ↔ Unteraufgabe (rein, 06.10., Malins Bauplan-Karte) ─────
// Malin tippte eine Aufgabe ins Listenfeld — so etwas soll man mit zwei Klicks richtig stellen können (Menü „…“ in der Zeile):
//   · Liste → Aufgabe: die Liste wird eine Aufgabe in einer wählbaren Liste DESSELBEN Projekts (oder „Sonstige“), ihre Aufgaben
//     deren Unteraufgaben (alles rückt eine Ebene tiefer — wäre etwas tiefer als `AUFGABEN_EBENEN_MAX`, wird abgelehnt, mit Name).
//     Kennung der Aufgabe = die der Liste (wie im Umbau v3). Serie/Titel-Muster einer Serien-Liste → Notiz (nicht abbildbar).
//     Meilenstein-Listen bleiben Listen (der Meilenstein zeigt auf sie).
//   · Aufgabe → Liste: eine Hauptaufgabe wird Liste im Projekt (gleich hinter ihrer bisherigen Liste), ihre direkten Unteraufgaben
//     deren Aufgaben. Die Aufgabe selbst (Notiz, Kommentare, Dateien, Verlauf) geht ins ARCHIV (Einzel-Archiv, `ea-…`) — nicht in
//     den Papierkorb, damit nach 30 Tagen nichts verloren geht; „Rückgängig“ holt sie zurück.
//   · Aufgabe ↔ Unteraufgabe: `umhaengen` (dieselben Regeln wie im Detail und beim Ziehen, `elternPruefen`).
// Alles liefert einen NEUEN Stand (oder `fehler`); `zeilenAenderungen` macht daraus die Zeilen für den Aufgaben-Kontext
// (`ZEILEN_SETZEN`) und die Zeilen für „Rückgängig“. Geschrieben wird über die bestehenden Ops (Server prüft Eltern, Tiefe, Kreise,
// Ort — lib/aufgaben/speicher.ts). Tests: tests/aufgaben-umwandeln.test.ts.

import type { AufgabenListe, Task, TasksState } from '@/types/tasks';
import { AUFGABEN_EBENEN_MAX, elternPruefen, kinderKarte, nachIdKarte, nachfahren, teilbaumHoehe, wurzelVon } from './ebenen';
import { aufgabeArchivieren } from './archiv-einzeln';
import { MEILENSTEIN_LISTE_PRAEFIX, serieLaeuftHier } from './umbau-gruppen';
import { wiederholungText, langTag, istTag } from './wiederholung';

export type Ergebnis = { state: TasksState; text: string } | { fehler: string };
export const istFehler = (r: Ergebnis): r is { fehler: string } => 'fehler' in r;

const titelKurz = (t: string, n = 60) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);
/** Eine Serie läuft nur an Hauptaufgaben — der Text, wenn sie Unteraufgabe werden soll. */
export const serieText = (titel: string): string => `„${titelKurz(titel, 50)}“ wiederholt sich — eine Serie läuft nur an Hauptaufgaben. Erst die Serie beenden (Detail › Wiederholt) oder die Aufgabe woanders hinlegen. Nichts geändert.`;
const aktiv = (x: { geloeschtAm?: string; archiviertAm?: string }) => !x.geloeschtAm && !x.archiviertAm;

/** Space eines Projekts (gespeichert bzw. aus „Sonstige“ abgeleitet). */
export function projektSpace(state: TasksState, projektId: string): string | undefined {
  const p = state.projects.find(x => x.id === projektId);
  if (p?.spaceId) return p.spaceId;
  return projektId.startsWith('sonstige-') ? projektId.slice('sonstige-'.length) : undefined;
}

/** Die Unteraufgaben-Kette unter `id` zieht mit (Projekt/Liste/Space der Hauptaufgabe). */
function teilbaumMit(tasks: Task[], id: string, ort: Pick<Task, 'projectId' | 'listeId' | 'spaceId'>, jetzt: string): Task[] {
  const mit = new Set(nachfahren(id, kinderKarte(tasks)).map(t => t.id));
  if (!mit.size) return tasks;
  return tasks.map(t => {
    if (!mit.has(t.id)) return t;
    const n: Task = { ...t, projectId: ort.projectId, ...(ort.spaceId ? { spaceId: ort.spaceId } : {}), updatedAt: jetzt };
    if (ort.listeId) n.listeId = ort.listeId; else delete n.listeId;
    return JSON.stringify(n) === JSON.stringify({ ...t, updatedAt: jetzt }) ? t : n;
  });
}

/**
 * Liste → Aufgabe. `zielListeId` = Liste desselben Projekts (null = „Sonstige“ des Projekts). `ich` = verantwortlich, wenn
 * die Liste leer ist. Liefert den neuen Stand oder einen Fehler (nichts geändert).
 */
export function listeZuAufgabe(state: TasksState, listeId: string, zielListeId: string | null, o: { jetzt: string; ich?: string; neueId?: string }): Ergebnis {
  const listen = state.listen ?? [];
  const l = listen.find(x => x.id === listeId);
  if (!l) return { fehler: 'Die Liste gibt es nicht (mehr).' };
  if (l.id.startsWith(MEILENSTEIN_LISTE_PRAEFIX)) return { fehler: 'Meilenstein-Listen bleiben Listen — der Meilenstein zeigt auf sie.' };
  if (zielListeId === l.id) return { fehler: 'Eine Liste kann nicht in sich selbst liegen — bitte eine andere Liste wählen.' };
  const ziel = zielListeId ? listen.find(x => x.id === zielListeId) : undefined;
  if (zielListeId && (!ziel || ziel.projektId !== l.projektId)) return { fehler: 'Die Ziel-Liste gehört nicht zu diesem Projekt.' };
  const nachId = nachIdKarte(state.tasks);
  const kinder = state.tasks.filter(t => t.listeId === l.id && t.projectId === l.projektId && (!t.parentId || !nachId.has(t.parentId)));
  const kinderK = kinderKarte(state.tasks);
  // Eine laufende Serie läuft nur an Hauptaufgaben (lib/aufgaben/serie.ts) — als Unteraufgabe hörte sie still auf.
  const serie = kinder.find(serieLaeuftHier);
  if (serie) return { fehler: serieText(serie.title) };
  // Tiefe: die neue Aufgabe ist Ebene 1, ihre Aufgaben Ebene 2 — jeder Teilbaum muss darunter passen.
  for (const k of kinder) {
    if (1 + teilbaumHoehe(k.id, kinderK) > AUFGABEN_EBENEN_MAX) {
      return { fehler: `Abgelehnt: „${titelKurz(k.title)}“ hat zu viele Ebenen — als Unteraufgabe wären es mehr als ${AUFGABEN_EBENEN_MAX}. Bitte dort erst eine Ebene auflösen. Nichts geändert.` };
    }
  }
  const id = o.neueId ?? (nachId.has(l.id) ? `${l.id.slice(0, 70)}-a` : l.id);
  if (nachId.has(id)) return { fehler: 'Kennung schon vergeben — bitte noch einmal versuchen.' };
  const spaceId = projektSpace(state, l.projektId) ?? kinder[0]?.spaceId;
  const zaehlen = kinder.filter(aktiv);
  const fertig = zaehlen.length > 0 && zaehlen.every(k => k.status === 'done' || k.status === 'cancelled') && zaehlen.some(k => k.status === 'done');
  const notiz: string[] = [];
  if (l.wiederholung) notiz.push(`Wiederkehrende Liste (bis zum Umwandeln): ${wiederholungText(l.wiederholung)}${istTag(l.wiederholung.naechste) ? `, nächste ${langTag(l.wiederholung.naechste!)}` : ''}${l.titelMuster ? `, Titel „${l.titelMuster}“` : ''}. Als Serie neu einstellen: Feld „Wiederholt“.`);
  else if (l.titelMuster) notiz.push(`Titel-Muster der früheren Liste: „${l.titelMuster}“.`);
  const imZiel = state.tasks.filter(t => !t.parentId && t.projectId === l.projektId && (zielListeId ? t.listeId === zielListeId : !t.listeId));
  const neu: Task = {
    id, projectId: l.projektId, title: l.titel, status: fertig ? 'done' : 'todo', priority: 'medium',
    assignee: (zaehlen[0]?.assignee ?? o.ich ?? kinder[0]?.assignee ?? 'both') as Task['assignee'], tags: [], subTasks: [], dependencies: [],
    sortOrder: imZiel.reduce((m, t) => Math.max(m, t.sortOrder ?? 0), -1) + 1, createdAt: o.jetzt, updatedAt: o.jetzt,
    ...(spaceId ? { spaceId } : {}), ...(zielListeId ? { listeId: zielListeId } : {}),
    ...(fertig ? { completedAt: o.jetzt } : {}),
    ...(l.vorlageId ? { vorlageId: l.vorlageId } : {}),
    ...(notiz.length ? { notiz: notiz.join('\n\n') } : {}),
  };
  const kinderIds = new Set(kinder.map(k => k.id));
  let tasks: Task[] = [neu, ...state.tasks.map(t => {
    if (!kinderIds.has(t.id)) return t;
    const n: Task = { ...t, parentId: id, updatedAt: o.jetzt };
    if (zielListeId) n.listeId = zielListeId; else delete n.listeId;
    return n;
  })];
  for (const k of kinder) tasks = teilbaumMit(tasks, k.id, { projectId: l.projektId, listeId: zielListeId ?? undefined, spaceId }, o.jetzt);
  // Neue Aufgabe zuerst im Stand: so reist sie im ersten Paket an den Server, vor ihren Unteraufgaben (lib/aufgaben/abgleich.ts `pakete`).
  const state2: TasksState = { ...state, listen: listen.filter(x => x.id !== l.id), tasks };
  return { state: state2, text: `Liste „${titelKurz(l.titel, 40)}“ ist jetzt eine Aufgabe${ziel ? ` in „${titelKurz(ziel.titel, 30)}“` : ''}${kinder.length ? ` mit ${kinder.length} Unteraufgabe${kinder.length === 1 ? '' : 'n'}` : ''}` };
}

/**
 * Aufgabe → Liste. Nur eine Hauptaufgabe. Die neue Liste steht gleich hinter der bisherigen Liste der Aufgabe (ganz hinten, wenn sie
 * unter „Sonstige“ lag); die direkten Unteraufgaben werden ihre Aufgaben; die Aufgabe selbst geht ins Einzel-Archiv.
 */
export function aufgabeZuListe(state: TasksState, taskId: string, o: { jetzt: string; neueId?: string }): Ergebnis {
  const nachId = nachIdKarte(state.tasks);
  const t = nachId.get(taskId);
  if (!t) return { fehler: 'Die Aufgabe gibt es nicht (mehr).' };
  if (t.parentId && nachId.has(t.parentId)) return { fehler: 'Nur eine Hauptaufgabe kann eine Liste werden — erst „zur Hauptaufgabe machen“.' };
  if (t.geloeschtAm || t.archiviertAm) return { fehler: 'Die Aufgabe liegt im Papierkorb oder Archiv.' };
  const listen = state.listen ?? [];
  const belegt = new Set(listen.map(l => l.id));
  const id = o.neueId ?? (belegt.has(t.id) ? `${t.id.slice(0, 70)}-l` : t.id);
  if (belegt.has(id)) return { fehler: 'Kennung schon vergeben — bitte noch einmal versuchen.' };
  const imProjekt = listen.filter(l => l.projektId === t.projectId).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id.localeCompare(b.id));
  const nach = imProjekt.findIndex(l => l.id === t.listeId);
  const neueListe: AufgabenListe = { id, projektId: t.projectId, titel: t.title.length > 80 ? `${t.title.slice(0, 79)}…` : t.title, sortOrder: 0 };
  const reihe = nach >= 0 ? [...imProjekt.slice(0, nach + 1), neueListe, ...imProjekt.slice(nach + 1)] : [...imProjekt, neueListe];
  const position = new Map(reihe.map((l, i) => [l.id, i]));
  const listen2 = [...listen.map(l => (position.has(l.id) && l.sortOrder !== position.get(l.id) ? { ...l, sortOrder: position.get(l.id)! } : l)), { ...neueListe, sortOrder: position.get(id)! }];
  const kinder = state.tasks.filter(x => x.parentId === t.id);
  const kinderIds = new Set(kinder.map(k => k.id));
  let tasks: Task[] = state.tasks.map(x => {
    if (!kinderIds.has(x.id)) return x;
    const n: Task = { ...x, listeId: id, projectId: t.projectId, updatedAt: o.jetzt };
    delete n.parentId;
    if (t.spaceId) n.spaceId = t.spaceId;
    return n;
  });
  for (const k of kinder) tasks = teilbaumMit(tasks, k.id, { projectId: t.projectId, listeId: id, spaceId: t.spaceId }, o.jetzt);
  // Die Hülle ins Einzel-Archiv: Notiz, Kommentare, Dateien und Verlauf bleiben erhalten und zurückholbar (nie Papierkorb-Frist).
  const state2 = aufgabeArchivieren({ ...state, listen: listen2, tasks }, t.id, o.jetzt);
  return { state: state2, text: `„${titelKurz(t.title, 40)}“ ist jetzt eine Liste${kinder.length ? ` mit ${kinder.length} Aufgabe${kinder.length === 1 ? '' : 'n'}` : ''} — die Aufgabe selbst liegt im Archiv` };
}

/**
 * Aufgabe ↔ Unteraufgabe: unter `elternId` hängen (null = zur Hauptaufgabe machen, der Ort bleibt). Gleiche Regeln wie im Detail:
 * Elternteil im selben Space, kein Kreis, höchstens `AUFGABEN_EBENEN_MAX` Ebenen samt eigenem Teilbaum.
 */
export function umhaengen(state: TasksState, taskId: string, elternId: string | null, jetzt: string): Ergebnis {
  const nachId = nachIdKarte(state.tasks);
  const t = nachId.get(taskId);
  if (!t) return { fehler: 'Die Aufgabe gibt es nicht (mehr).' };
  if (!elternId) {
    if (!t.parentId) return { fehler: 'Das ist schon eine Hauptaufgabe.' };
    const n: Task = { ...t, updatedAt: jetzt };
    delete n.parentId;
    return { state: { ...state, tasks: state.tasks.map(x => (x.id === t.id ? n : x)) }, text: `„${titelKurz(t.title, 40)}“ ist jetzt eine Hauptaufgabe` };
  }
  const f = elternPruefen(t, elternId, nachId, kinderKarte(state.tasks), aktiv);
  if (f) return { fehler: f.text };
  if (!t.parentId && serieLaeuftHier(t)) return { fehler: serieText(t.title) };
  const e = nachId.get(elternId)!;
  const w = wurzelVon(e, nachId);
  if (t.spaceId && w.spaceId && w.spaceId !== t.spaceId) return { fehler: 'Unteraufgaben bleiben im selben Space — erst die Aufgabe umziehen (Detail › Ort). Nichts geändert.' };
  const ort = { projectId: w.projectId, listeId: w.listeId, spaceId: w.spaceId };
  const n: Task = { ...t, parentId: elternId, projectId: ort.projectId, updatedAt: jetzt, ...(ort.spaceId ? { spaceId: ort.spaceId } : {}) };
  if (ort.listeId) n.listeId = ort.listeId; else delete n.listeId;
  const kinderVonE = state.tasks.filter(x => x.parentId === elternId && x.id !== t.id);
  n.sortOrder = kinderVonE.reduce((m, x) => Math.max(m, x.sortOrder ?? 0), -1) + 1;
  const tasks = teilbaumMit(state.tasks.map(x => (x.id === t.id ? n : x)), t.id, ort, jetzt);
  return { state: { ...state, tasks }, text: `„${titelKurz(t.title, 40)}“ ist jetzt Unteraufgabe von „${titelKurz(e.title, 30)}“` };
}

// ── Zeilen für den Aufgaben-Kontext + „Rückgängig“ ───────────────────────────

export type ZeilenArt = 'tasks' | 'listen' | 'projects';
export interface ZeilenSetzen { liste: ZeilenArt; id: string; eintrag: ({ id: string } & Record<string, unknown>) | null }

/**
 * Was sich zwischen zwei Ständen geändert hat (Aufgaben, Listen, Projekte): `zeilen` setzt den neuen Stand, `rueck` den alten
 * (für „Rückgängig“). Neue Aufgaben stehen vorne (sie reisen so vor ihren Unteraufgaben).
 */
export function zeilenAenderungen(vorher: TasksState, nachher: TasksState): { zeilen: ZeilenSetzen[]; rueck: ZeilenSetzen[] } {
  const zeilen: ZeilenSetzen[] = [];
  const rueck: ZeilenSetzen[] = [];
  const je = (art: ZeilenArt, a: readonly { id: string }[], b: readonly { id: string }[]) => {
    const alt = new Map(a.map(x => [x.id, x]));
    const neu = new Map(b.map(x => [x.id, x]));
    for (const x of b) {
      const v = alt.get(x.id);
      if (v && JSON.stringify(v) === JSON.stringify(x)) continue;
      zeilen.push({ liste: art, id: x.id, eintrag: x as ZeilenSetzen['eintrag'] });
      rueck.push({ liste: art, id: x.id, eintrag: (v ?? null) as ZeilenSetzen['eintrag'] });
    }
    for (const v of a) if (!neu.has(v.id)) { zeilen.push({ liste: art, id: v.id, eintrag: null }); rueck.push({ liste: art, id: v.id, eintrag: v as ZeilenSetzen['eintrag'] }); }
  };
  je('listen', vorher.listen ?? [], nachher.listen ?? []);
  je('projects', vorher.projects, nachher.projects);
  je('tasks', vorher.tasks, nachher.tasks);
  return { zeilen, rueck };
}
