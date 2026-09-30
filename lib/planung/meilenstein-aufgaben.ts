// ─── MAKE OS — Meilenstein ↔ Aufgaben (rein, client- und server-sicher, 30.09.) ─
// Kevin (30.09.): „Wenn wir neue Meilensteine aufmachen, müssen darin neue Untertasks erstellt werden … und das muss
// sauber in die Struktur genommen werden.“ Entscheidung: die Aufgaben am Meilenstein sind ECHTE Aufgaben (EINE Quelle,
// der Aufgaben-Bestand `tasks`), mit Unteraufgaben wie überall (Aufgabe → Unteraufgabe).
//
// Struktur (festgelegt 30.09.):
//   Space des Meilensteins  →  Projekt „Meilensteine“ (eines je Space)  →  Liste „<Titel des Meilensteins>“  →  Aufgabe → Unteraufgabe
//   · Space: Privat → `privat`; Business → Mandant `m-<firmaId>` (Meilenstein mit Mandat), sonst die Gesellschaft der
//     Einheit (kdc · kdv · ug), sonst KD Ventures (`kdv`, wie `spaceFuerAltAufgabe`).
//   · Kennungen sind aus der Meilenstein-Kennung ABGELEITET (rein, stabil): Liste `lm-<teil>-<fnv>`, Projekt `pm-<space>`.
//     Der Verweis Meilenstein → Aufgaben ist damit nur die Kennung der Liste — kein Feld an Aufgaben, keine Kopie, und
//     nichts, was ein älterer Stand (Rückweg af4679a) beim Speichern verwerfen könnte (Listen/Projekte kennt er).
//   · Eine Aufgabe gehört zum Meilenstein, solange sie in seiner Liste liegt (Unteraufgaben erben die Liste). Verschieben
//     in eine andere Liste löst sie; „zum Meilenstein“ = in die Liste verschieben.
//   · Sortierung der Listen im Projekt: nach Fälligkeit (sortOrder = JJJJMMTT, ohne Datum ganz hinten).
//
// Fortschritt (EINE Regel): Sobald ein Meilenstein offene oder erledigte Aufgaben hat (Papierkorb, Archiv und
// „abgebrochen“ zählen nicht), gilt der ERRECHNETE Fortschritt: jede Hauptaufgabe wiegt 1 — erledigt = 1, sonst der
// Anteil ihrer erledigten Unteraufgaben. Ohne Aufgaben gilt der von Hand gepflegte Wert. Ein erledigter Meilenstein
// steht auf 100. Der Server schreibt den errechneten Wert in `fortschritt` (ältere Leser — Brain, Risiko, Business-Index,
// Gesundheits-Säule — lesen ihn unverändert, lib/planung/meilenstein-aufgaben-server.ts).
// Ziel-Fortschritt: hat ein Ziel Meilensteine (`zielId`, bzw. `abgeleitetVon` aus der Kaskade), ist er der Mittelwert
// ihrer Fortschritte — sonst der von Hand gepflegte.

import type { Meilenstein, Ziel } from './typen';
import type { AufgabenListe, Project, Task, TasksState } from '@/types/tasks';
import { meilensteinSpace } from './meilensteine';
import { finanzOrtAus, istGesellschaft } from '@/lib/einheiten';
import { istMandantSpace, mandantSpaceId, istAbgeschlossen } from '@/lib/aufgaben/struktur';

/** FNV-1a (32 Bit) als Basis 36 — stabil in Browser und Server. */
function fnv(t: string): string {
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

/** Präfixe der abgeleiteten Kennungen (Verbindungsprüfung, Tests). */
export const MS_LISTE_PRAEFIX = 'lm-';
export const MS_PROJEKT_PRAEFIX = 'pm-';
export const MS_PROJEKT_TITEL = 'Meilensteine';
export const MS_PROJEKT_FARBE = '#E0A84E';

/** Kennung der Aufgaben-Liste eines Meilensteins — rein aus der Meilenstein-Kennung (≤ 80 Zeichen, Form wie KENNUNG). */
export function meilensteinListeId(msId: string): string {
  const teil = msId.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) || 'x';
  return `${MS_LISTE_PRAEFIX}${teil}-${fnv(msId)}`;
}

/** Kennung des Projekts „Meilensteine“ in einem Space. */
export const meilensteinProjektId = (spaceId: string): string => `${MS_PROJEKT_PRAEFIX}${spaceId}`.slice(0, 80);
export const istMeilensteinListe = (id: string | undefined | null): boolean => !!id && id.startsWith(MS_LISTE_PRAEFIX);

/** Der Aufgaben-Space eines Meilensteins (siehe Kopf). */
export function meilensteinAufgabenSpace(m: Pick<Meilenstein, 'space' | 'bereich' | 'firmaId' | 'einheit'>): string {
  if (meilensteinSpace(m) === 'privat') return 'privat';
  if (m.firmaId) { const s = mandantSpaceId(m.firmaId); if (istMandantSpace(s)) return s; }
  const g = finanzOrtAus(m.einheit);
  if (g && istGesellschaft(g)) return g;
  return 'kdv';
}

/** Reihenfolge der Liste im Projekt: nach Fälligkeit, ohne Datum hinten. */
export const listenReihe = (m: Pick<Meilenstein, 'faellig'>): number => (m.faellig ? Number(m.faellig.replace(/-/g, '')) : 99_999_999);

/** Titel der Liste = Titel des Meilensteins (Grenze der Listen-Titel: 80 Zeichen). */
export const listenTitel = (m: Pick<Meilenstein, 'titel'>): string => (m.titel.length > 80 ? `${m.titel.slice(0, 79)}…` : m.titel);

// ── Welche Aufgaben gehören dazu ────────────────────────────────────────────

const zaehlt = (t: Task) => !t.geloeschtAm && !t.archiviertAm;

/** Alle Aufgaben (auch Unteraufgaben) des Meilensteins — ohne Papierkorb und Archiv. */
export function aufgabenVonMeilenstein(state: Pick<TasksState, 'tasks'>, msId: string): Task[] {
  const l = meilensteinListeId(msId);
  return state.tasks.filter(t => t.listeId === l && zaehlt(t));
}

/** Zu welchem Meilenstein gehört eine Aufgabe (über ihre Liste)? — null, wenn zu keinem. */
export function meilensteinVonAufgabe<M extends Pick<Meilenstein, 'id'>>(t: Pick<Task, 'listeId'> | undefined | null, ms: readonly M[]): M | null {
  if (!t?.listeId || !istMeilensteinListe(t.listeId)) return null;
  return ms.find(m => meilensteinListeId(m.id) === t.listeId) ?? null;
}

export interface AufgabenStand { gesamt: number; erledigt: number; offen: number; unter: number; unterErledigt: number; faellig: number }

/** Zahlen der Aufgaben eines Meilensteins (abgebrochene zählen nicht). `heute` = YYYY-MM-DD für „fällig/überfällig“. */
export function aufgabenStand(aufgaben: readonly Task[], heute = ''): AufgabenStand {
  const n = aufgaben.filter(t => t.status !== 'cancelled');
  const haupt = n.filter(t => !t.parentId), unter = n.filter(t => !!t.parentId);
  return {
    gesamt: haupt.length, erledigt: haupt.filter(t => t.status === 'done').length, offen: haupt.filter(t => !istAbgeschlossen(t)).length,
    unter: unter.length, unterErledigt: unter.filter(t => t.status === 'done').length,
    faellig: heute ? n.filter(t => !istAbgeschlossen(t) && !!t.dueDate && t.dueDate <= heute).length : 0,
  };
}

/**
 * Der errechnete Fortschritt (0–100) aus den Aufgaben — null, wenn es keine zählende Aufgabe gibt (dann gilt der Wert
 * von Hand). Gewichtet: jede Hauptaufgabe 1; erledigt = 1, sonst Anteil erledigter Unteraufgaben.
 */
export function fortschrittAusAufgaben(aufgaben: readonly Task[]): number | null {
  const n = aufgaben.filter(t => t.status !== 'cancelled');
  const haupt = n.filter(t => !t.parentId || !n.some(x => x.id === t.parentId));
  if (!haupt.length) return null;
  let summe = 0;
  for (const h of haupt) {
    if (h.status === 'done') { summe += 1; continue; }
    const u = n.filter(t => t.parentId === h.id);
    if (u.length) summe += u.filter(t => t.status === 'done').length / u.length;
  }
  return Math.round((100 * summe) / haupt.length);
}

/** Wirksamer Fortschritt eines Meilensteins: erledigt → 100, sonst errechnet (wenn Aufgaben), sonst von Hand. */
export function wirksamerFortschritt(m: Pick<Meilenstein, 'id' | 'fortschritt' | 'erledigt'>, state: Pick<TasksState, 'tasks'> | null): number {
  if (m.erledigt) return 100;
  const r = state ? fortschrittAusAufgaben(aufgabenVonMeilenstein(state, m.id)) : null;
  return r ?? m.fortschritt;
}

/** Kommt der Fortschritt aus den Aufgaben? (Schieberegler aus, Hinweis „aus n Aufgaben“.) */
export const fortschrittErrechnet = (msId: string, state: Pick<TasksState, 'tasks'> | null): boolean => !!state && fortschrittAusAufgaben(aufgabenVonMeilenstein(state, msId)) !== null;

/**
 * Den gespeicherten `fortschritt` aller Meilensteine mit Aufgaben nachziehen (rein) — geändert nur, wo der errechnete
 * Wert abweicht. Erledigte bleiben, wie sie sind.
 */
export function fortschrittAnwenden<M extends Meilenstein>(ms: readonly M[], state: Pick<TasksState, 'tasks'>): { liste: M[]; geaendert: string[] } {
  const geaendert: string[] = [];
  const liste = ms.map(m => {
    if (m.erledigt) return m;
    const r = fortschrittAusAufgaben(aufgabenVonMeilenstein(state, m.id));
    if (r === null || r === m.fortschritt) return m;
    geaendert.push(m.id);
    return { ...m, fortschritt: r };
  });
  return { liste, geaendert };
}

// ── Ziele ───────────────────────────────────────────────────────────────────

/** Auf welches Ziel zahlt der Meilenstein ein? `zielId`, sonst das Termin-Ziel, aus dem er abgeleitet ist. */
export const zielVonMeilenstein = (m: Pick<Meilenstein, 'zielId' | 'abgeleitetVon'>): string | undefined => m.zielId || m.abgeleitetVon || undefined;

/** Die Meilensteine eines Ziels. */
export function meilensteineVonZiel<M extends Meilenstein>(zielId: string, ms: readonly M[]): M[] {
  return ms.filter(m => zielVonMeilenstein(m) === zielId);
}

/** Ziel-Fortschritt aus seinen Meilensteinen (Mittelwert, erledigt = 100) — null ohne Meilensteine. */
export function zielFortschrittAusMeilensteinen(zielId: string, ms: readonly Meilenstein[]): number | null {
  const l = meilensteineVonZiel(zielId, ms);
  if (!l.length) return null;
  return Math.round(l.reduce((s, m) => s + (m.erledigt ? 100 : m.fortschritt), 0) / l.length);
}

/** Ziele nachziehen (rein): offene Ziele mit Meilensteinen tragen den Mittelwert. */
export function zieleFortschrittAnwenden<Z extends Ziel>(ziele: readonly Z[], ms: readonly Meilenstein[]): { liste: Z[]; geaendert: number } {
  let geaendert = 0;
  const liste = ziele.map(z => {
    if (z.erledigt) return z;
    const r = zielFortschrittAusMeilensteinen(z.id, ms);
    if (r === null || r === z.fortschritt) return z;
    geaendert++;
    return { ...z, fortschritt: r };
  });
  return { liste, geaendert };
}

// ── Struktur im Aufgaben-Bestand ────────────────────────────────────────────

export interface StrukturAenderungen {
  projekte: Project[];
  listen: AufgabenListe[];
  /** Aufgaben, die mit ihrer Liste in ein anderes Projekt/einen anderen Space umziehen (nur die geänderten Felder). */
  umzug: { id: string; felder: Partial<Task> }[];
}

/**
 * Was im Aufgaben-Bestand fehlt oder abweicht, damit jeder genannte Meilenstein seine Liste hat (rein, idempotent):
 *  · Projekt „Meilensteine“ im Space fehlt → anlegen (im Papierkorb/Archiv → nicht anfassen, Liste dann nicht anlegen).
 *  · Liste fehlt → anlegen; Titel/Reihenfolge weichen ab → nachziehen; liegt sie in einem anderen Projekt (Space des
 *    Meilensteins hat sich geändert) → umziehen samt ihrer Aufgaben (Projekt + Space).
 *  · Von Hand archivierte Liste (`archiviert`) eines lebenden Meilensteins → wieder aktiv (Meilenstein wiederhergestellt).
 *  · „Neu anfangen“-Archiv (`archiviertAm`) bleibt unberührt.
 */
export function strukturFuer(ms: readonly Meilenstein[], state: TasksState, jetzt = new Date().toISOString()): StrukturAenderungen {
  const raus: StrukturAenderungen = { projekte: [], listen: [], umzug: [] };
  const projekte = new Map(state.projects.map(p => [p.id, p]));
  const listen = new Map((state.listen ?? []).map(l => [l.id, l]));
  for (const m of ms) {
    const spaceId = meilensteinAufgabenSpace(m);
    const pid = meilensteinProjektId(spaceId);
    const p = projekte.get(pid);
    if (p && (p.geloeschtAm || p.archiviertAm)) continue;
    if (!p) {
      const neu: Project = {
        id: pid, title: MS_PROJEKT_TITEL, description: '', category: spaceId === 'privat' ? 'joint' : 'business', owner: 'both',
        color: MS_PROJEKT_FARBE, tags: [], archived: false, spaceId, createdAt: jetzt, updatedAt: jetzt,
      };
      projekte.set(pid, neu);
      raus.projekte.push(neu);
    }
    const lid = meilensteinListeId(m.id);
    const l = listen.get(lid);
    if (l?.archiviertAm) continue;
    const soll: AufgabenListe = { id: lid, projektId: pid, titel: listenTitel(m), sortOrder: listenReihe(m) };
    if (!l) { listen.set(lid, soll); raus.listen.push(soll); continue; }
    if (l.projektId !== pid || l.titel !== soll.titel || l.sortOrder !== soll.sortOrder || l.archiviert) {
      const { archiviert: _a, ...rest } = l;
      raus.listen.push({ ...rest, projektId: pid, titel: soll.titel, sortOrder: soll.sortOrder });
    }
    if (l.projektId !== pid) {
      for (const t of state.tasks) if (t.listeId === lid && (t.projectId !== pid || t.spaceId !== spaceId)) raus.umzug.push({ id: t.id, felder: { projectId: pid, spaceId } });
    }
  }
  return raus;
}

/** Die Liste eines gelöschten Meilensteins: von Hand archivieren (Aufgaben bleiben lesbar; kommt der Meilenstein zurück, wird sie wieder aktiv). */
export function listeArchivieren(msId: string, state: TasksState): AufgabenListe | null {
  const l = (state.listen ?? []).find(x => x.id === meilensteinListeId(msId));
  return l && !l.archiviert && !l.archiviertAm ? { ...l, archiviert: true } : null;
}

/** Verbindungsprüfung: Meilenstein-Listen, deren Meilenstein es nicht mehr gibt (und die noch aktiv sind). */
export function listenOhneMeilenstein(state: TasksState, ms: readonly Pick<Meilenstein, 'id'>[]): AufgabenListe[] {
  const lebend = new Set(ms.map(m => meilensteinListeId(m.id)));
  return (state.listen ?? []).filter(l => istMeilensteinListe(l.id) && !lebend.has(l.id) && !l.archiviert && !l.archiviertAm);
}
