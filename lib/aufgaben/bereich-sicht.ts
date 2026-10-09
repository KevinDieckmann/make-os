// ─── Aufgaben: Privat-Bereich für Konten „nur Business“ ausblenden (rein, 09.10., E4 — Kevin: „Ja, Privates bleibt privat“) ────────
// Zweiter Filter neben „nur ich“ (./sicht-regel.ts), angewandt in `ladeAufgabenSicht`/`sichtFuerKonto` (./sicht.ts) — damit kommt er
// bei JEDEM Leser an (Aufgaben-Route, Überblick, Kalender, Export, Glocke/Heute, Seil, ZOE-Kontext, `meine_aufgaben`, Unterlagen …).
// Ob ausgeblendet wird, entscheidet NUR die Konto-Sicht (lib/zugang/konto-sicht.ts `privatAusblenden`) — hier steht nur, WAS privat ist:
//   · Aufgabe   — Bereich ihres Space (`bereichVonSpace`: Privat und Privat-Einheiten wie die Selbstständigkeit → privat). Unteraufgaben
//                 tragen nach der Übernahme den Space ihrer Hauptaufgabe; zur Sicherheit zählt auch jeder Vorfahre (privat → privat).
//   · Projekt   — Bereich seines Space.
//   · Liste     — Bereich ihres Projekts; „Sonstige“ eines Space → dessen Bereich; Projekt unbekannt → ausgeblendet (nie auf Verdacht zeigen).
//   · Status    — eigener Status eines Privat-Space.
//   · Vorlage   — nur mit Privat-Space (ohne Space gilt sie überall, wie bisher).
// Geschrieben wird darauf ebenso wenig: der Schreibweg (./speicher.ts) antwortet 404 (vorhanden, privat) bzw. 403 (neu nach Privat).

import type { AufgabenListe, AufgabenStatus, AufgabenVorlage, Project, Task, TasksState } from '@/types/tasks';
import { bereichVonSpace, istSonstigeProjekt, SONSTIGE_PRAEFIX } from './struktur';

type AufgabeKern = Pick<Task, 'id' | 'spaceId' | 'parentId'>;

/** Liegt die Aufgabe (oder ein Vorfahre) im Privat-Bereich? `nachId` = alle Aufgaben (für die Kette). Kreisfest. Ohne Space: Business. */
export function aufgabeImPrivat(t: AufgabeKern, nachId?: ReadonlyMap<string, AufgabeKern>): boolean {
  if (t.spaceId && bereichVonSpace(t.spaceId) === 'privat') return true;
  const gesehen = new Set<string>();
  let pid = t.parentId;
  for (let n = 0; pid && n < 64 && !gesehen.has(pid); n++) {
    gesehen.add(pid);
    const e = nachId?.get(pid);
    if (!e) break;
    if (e.spaceId && bereichVonSpace(e.spaceId) === 'privat') return true;
    pid = e.parentId;
  }
  return false;
}

export const projektImPrivat = (p: Pick<Project, 'spaceId'>): boolean => !!p.spaceId && bereichVonSpace(p.spaceId) === 'privat';

/** Liste im Privat-Bereich? Projekt bekannt → dessen Bereich; „Sonstige“ → Bereich des Space; sonst unbekannt → ja (ausblenden). */
export function listeImPrivat(l: Pick<AufgabenListe, 'projektId'>, projekte: ReadonlyMap<string, Pick<Project, 'spaceId'>>): boolean {
  const p = projekte.get(l.projektId);
  if (p) return projektImPrivat(p);
  if (istSonstigeProjekt(l.projektId)) return bereichVonSpace(l.projektId.slice(SONSTIGE_PRAEFIX.length)) === 'privat';
  return true;
}

export const statusImPrivat = (s: Pick<AufgabenStatus, 'spaceId'>): boolean => bereichVonSpace(s.spaceId) === 'privat';
export const vorlageImPrivat = (v: Pick<AufgabenVorlage, 'spaceId'>): boolean => !!v.spaceId && bereichVonSpace(v.spaceId) === 'privat';

/**
 * Der Bestand ohne den Privat-Bereich (rein) — für Konten „nur Business“. Projekte, die nicht privat sind, deren Listen, Aufgaben und
 * Status bleiben unverändert (dieselben Objekte, damit `stand`/Fingerabdrücke gleich bleiben).
 */
export function ohnePrivatBereich<T extends TasksState>(state: T): T {
  const nachId = new Map(state.tasks.map(t => [t.id, t]));
  const projekte = new Map(state.projects.map(p => [p.id, p]));
  return {
    ...state,
    tasks: state.tasks.filter(t => !aufgabeImPrivat(t, nachId)),
    projects: state.projects.filter(p => !projektImPrivat(p)),
    ...(state.listen ? { listen: state.listen.filter(l => !listeImPrivat(l, projekte)) } : {}),
    ...(state.statusEigen ? { statusEigen: state.statusEigen.filter(s => !statusImPrivat(s)) } : {}),
    ...(state.vorlagen ? { vorlagen: state.vorlagen.filter(v => !vorlageImPrivat(v)) } : {}),
    // Gruppen (nur Altbestand, Umbau v3): wie Listen über das Projekt.
    ...(state.gruppen ? { gruppen: state.gruppen.filter(g => !listeImPrivat({ projektId: g.projektId }, projekte)) } : {}),
  };
}

/** Nur die Aufgaben-Liste (für Leser, die schon eine Liste haben). */
export function aufgabenOhnePrivat<T extends AufgabeKern>(tasks: readonly T[]): T[] {
  const nachId = new Map(tasks.map(t => [t.id, t]));
  return tasks.filter(t => !aufgabeImPrivat(t, nachId));
}

/** Spaces ohne den Privat-Bereich (Leiste, Überblick, Export). */
export const spacesOhnePrivat = <S extends { bereich: string }>(spaces: readonly S[]): S[] => spaces.filter(s => s.bereich !== 'privat');
