// ─── MAKE OS — Ziehen & Ablegen im Aufgaben-Baum (rein, 06.10., Malins Bauplan-Karte) ─────────────────
// Aufgaben zwischen Listen (`listeId`), Unteraufgaben zwischen Aufgaben (`parentId`), Reihenfolge innerhalb einer Liste
// (`sortOrder`). Maus und Touch (Handy: lange drücken) liefern dasselbe Ziel (`Ablage`) — Tastatur-Alternative ist das Menü
// „Verschieben nach …“ in der Zeile. Hier nur die Regel; geschrieben wird über die bestehenden Ops, der Server prüft den Ort
// noch einmal (`ortPruefen`, eingehängt in lib/aufgaben/speicher.ts) samt Eltern, Tiefe und Kreisen (`elternPruefen`).
// Tests: tests/aufgaben-ziehen.test.ts.

import type { AufgabenListe, Project, Task, TasksState } from '@/types/tasks';
import { elternPruefen, kinderKarte, nachIdKarte, nachfahren, wurzelVon } from './ebenen';
import { projektSpace, serieText, type Ergebnis } from './umwandeln';
import { serieLaeuftHier } from './umbau-gruppen';

/** Wohin eine gezogene Aufgabe fällt: vor/hinter eine Aufgabe (gleiche Ebene), in eine Aufgabe (Unteraufgabe) oder ans Ende einer Liste. */
export type Ablage =
  | { art: 'vor' | 'nach' | 'in'; zielId: string }
  | { art: 'liste'; projektId: string; listeId: string | null };

const aktiv = (x: { geloeschtAm?: string; archiviertAm?: string }) => !x.geloeschtAm && !x.archiviertAm;
const reihe = (a: Task, b: Task) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? '')) || a.id.localeCompare(b.id);
const kurz = (t: string, n = 40) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

/**
 * Eine Aufgabe ablegen (rein). Nur innerhalb ihres Space; die Liste muss zum Projekt gehören; als Unteraufgabe gelten Kreis- und
 * Tiefengrenze. Die Geschwister am Ziel bekommen eine lückenlose Reihenfolge; der Teilbaum zieht mit (Projekt/Liste).
 */
export function ablegen(state: TasksState, quelleId: string, ablage: Ablage, jetzt: string): Ergebnis {
  const nachId = nachIdKarte(state.tasks);
  const q = nachId.get(quelleId);
  if (!q) return { fehler: 'Die Aufgabe gibt es nicht (mehr).' };
  let parentId: string | undefined;
  let projectId: string;
  let listeId: string | undefined;
  let spaceId: string | undefined;
  let zielText: string;
  if (ablage.art === 'liste') {
    const l = ablage.listeId ? (state.listen ?? []).find(x => x.id === ablage.listeId) : undefined;
    if (ablage.listeId && (!l || l.projektId !== ablage.projektId)) return { fehler: 'Diese Liste gehört nicht zu dem Projekt.' };
    projectId = ablage.projektId;
    listeId = l?.id;
    spaceId = projektSpace(state, projectId);
    zielText = l ? `Liste „${kurz(l.titel, 30)}“` : '„Sonstige“';
  } else {
    const z = nachId.get(ablage.zielId);
    if (!z) return { fehler: 'Das Ziel gibt es nicht (mehr).' };
    if (z.id === q.id) return { fehler: 'Eine Aufgabe kann nicht auf sich selbst abgelegt werden.' };
    parentId = ablage.art === 'in' ? z.id : (z.parentId && nachId.has(z.parentId) ? z.parentId : undefined);
    const wurzel = parentId ? wurzelVon(nachId.get(parentId)!, nachId) : z;
    projectId = wurzel.projectId;
    listeId = wurzel.listeId;
    spaceId = wurzel.spaceId;
    zielText = ablage.art === 'in' ? `in „${kurz(z.title, 30)}“` : `${ablage.art === 'vor' ? 'vor' : 'hinter'} „${kurz(z.title, 30)}“`;
  }
  if (q.spaceId && spaceId && q.spaceId !== spaceId) return { fehler: 'Ziehen geht nur innerhalb eines Space — für einen anderen Space: Detail › Ort.' };
  if (parentId && parentId !== q.parentId) {
    const f = elternPruefen(q, parentId, nachId, kinderKarte(state.tasks), aktiv);
    if (f) return { fehler: f.text };
    if (serieLaeuftHier(q)) return { fehler: serieText(q.title) };
  }
  // Geschwister am Ziel (ohne die Quelle) in Reihenfolge — dann die Quelle an ihre Stelle.
  const listenDesProjekts = new Set((state.listen ?? []).filter(l => l.projektId === projectId).map(l => l.id));
  const inListe = (t: Task) => (listeId ? t.listeId === listeId : !t.listeId || !listenDesProjekts.has(t.listeId));
  const geschwister = state.tasks
    .filter(t => t.id !== q.id && aktiv(t) && (parentId ? t.parentId === parentId : (!t.parentId || !nachId.has(t.parentId)) && t.projectId === projectId && inListe(t)))
    .sort(reihe);
  let pos = geschwister.length;
  if (ablage.art === 'vor' || ablage.art === 'nach') { const i = geschwister.findIndex(t => t.id === ablage.zielId); if (i >= 0) pos = ablage.art === 'vor' ? i : i + 1; }
  const neueReihe = [...geschwister.slice(0, pos), q, ...geschwister.slice(pos)];
  const sort = new Map(neueReihe.map((t, i) => [t.id, i]));
  const mit = new Set(nachfahren(q.id, kinderKarte(state.tasks)).map(t => t.id));
  let geaendert = false;
  const tasks = state.tasks.map(t => {
    if (t.id === q.id) {
      if (t.parentId === parentId && t.projectId === projectId && t.listeId === listeId && (t.sortOrder ?? 0) === sort.get(t.id) && (!spaceId || t.spaceId === spaceId)) return t;
      geaendert = true;
      const n: Task = { ...t, projectId, sortOrder: sort.get(t.id)!, updatedAt: jetzt, ...(spaceId ? { spaceId } : {}) };
      if (parentId) n.parentId = parentId; else delete n.parentId;
      if (listeId) n.listeId = listeId; else delete n.listeId;
      return n;
    }
    if (mit.has(t.id) && (t.projectId !== projectId || t.listeId !== listeId || (spaceId && t.spaceId !== spaceId))) {
      geaendert = true;
      const n: Task = { ...t, projectId, updatedAt: jetzt, ...(spaceId ? { spaceId } : {}) };
      if (listeId) n.listeId = listeId; else delete n.listeId;
      return n;
    }
    if (sort.has(t.id) && (t.sortOrder ?? 0) !== sort.get(t.id)) { geaendert = true; return { ...t, sortOrder: sort.get(t.id)!, updatedAt: jetzt }; }
    return t;
  });
  // Nichts bewegt (z. B. auf den eigenen Platz gezogen): leerer Fehler = still nichts tun.
  if (!geaendert) return { fehler: '' };
  return { state: { ...state, tasks }, text: `„${kurz(q.title)}“ ${ablage.art === 'in' ? 'ist jetzt Unteraufgabe' : 'verschoben'} ${ablage.art === 'in' ? zielText : `nach ${zielText}`}` };
}

/**
 * Server-Prüfung des Ortes (06.10.): nur wenn sich Liste, Projekt oder Elternteil ÄNDERN — eine Liste gehört zum Projekt der
 * Hauptaufgabe; ein Projekt (das es gibt) liegt im Space der Aufgabe; eine umgehängte Unteraufgabe bleibt im Space. Liefert den
 * Grund (400) oder null. Fehlende Liste/fehlendes Projekt bleiben erlaubt (die Übernahme legt sie unter „Sonstige“ — ein Rennen
 * mit einer gerade gelöschten Liste soll keine Eingabe verlieren).
 */
export function ortPruefen(t: Task, alt: Task | undefined, s: { projekte: readonly Project[]; listen: readonly AufgabenListe[]; nachId: ReadonlyMap<string, Task> }): string | null {
  const neu = (k: 'listeId' | 'projectId' | 'parentId' | 'spaceId') => !alt || alt[k] !== t[k];
  const hauptaufgabe = !t.parentId || !s.nachId.has(t.parentId);
  if (hauptaufgabe) {
    if (t.listeId && (neu('listeId') || neu('projectId'))) {
      const l = s.listen.find(x => x.id === t.listeId);
      if (l && l.projektId !== t.projectId) return `Abgelehnt: die Liste „${kurz(l.titel)}“ gehört zu einem anderen Projekt. Nichts gespeichert.`;
    }
    if (alt && t.spaceId && neu('projectId')) {
      const p = s.projekte.find(x => x.id === t.projectId);
      if (p?.spaceId && p.spaceId !== t.spaceId) return `Abgelehnt: das Projekt „${kurz(p.title)}“ liegt in einem anderen Space. Nichts gespeichert.`;
    }
    return null;
  }
  if (alt && neu('parentId') && alt.spaceId) {
    const w = wurzelVon(t, s.nachId as Map<string, Task>);
    if (w.spaceId && w.spaceId !== alt.spaceId) return 'Abgelehnt: Unteraufgaben bleiben im selben Space — erst die Aufgabe umziehen (Detail › Ort). Nichts gespeichert.';
  }
  return null;
}
