// ─── MAKE OS — Umbau v3: die Ebene „Gruppe“ auflösen (rein, 06.10., Malins Bauplan-Karte) ─────────────
// Kevin hat „komplett nach Malins Liste“ freigegeben. Vorher: Projekt › Gruppe › Liste › Aufgabe › Unteraufgabe — vier gleich
// aussehende Eingabefelder; Malin tippte eine Aufgabe ins Listenfeld, es entstand die LISTE „2 diese Woche bezahlen, …“ in der
// GRUPPE „offene RE-Onebanking“. Ab jetzt: Projekt › Liste › Aufgabe › Unteraufgabe (Unteraufgaben intern weiter mehrstufig bis
// `AUFGABEN_EBENEN_MAX`). Regel (Kevins Wahl):
//   · jede Gruppe wird eine LISTE (Titel, Farbe, Archiv-Marke; gleiche Position im Projekt — Gruppen standen im Baum vor den
//     direkten Listen, also stehen sie auch jetzt vorne). Kennung = die der Gruppe (alte Links `&g=` führen so direkt hin).
//   · jede Liste in der Gruppe wird eine AUFGABE in dieser neuen Liste (Titel = Listentitel, Kennung = die der Liste, damit
//     `&l=`-Links weiterleiten können). Wiederholung/Titel-Muster einer Serien-Liste sind an einer Aufgabe nicht 1:1 abbildbar
//     (eine Aufgaben-Serie entsteht beim Erledigen, eine Listen-Serie nach Kalender) — sie stehen in der NOTIZ der Aufgabe; die
//     Vorlage bleibt als `vorlageId`. Archiv-Marke („Neu anfangen“) und Papierkorb des Projekts gehen mit.
//   · die Aufgaben dieser Liste werden UNTERAUFGABEN der neuen Aufgabe (`parentId`), ihre Unteraufgaben rücken eine Ebene tiefer.
//     Wäre eine Kette dann tiefer als `AUFGABEN_EBENEN_MAX`, hängt der zu tiefe Teil flach unter dem tiefsten erlaubten Vorfahren —
//     im Bericht vermerkt und in der Notiz der Aufgabe („lag vorher unter …“). Nie Daten verlieren.
//   · Meilenstein-Listen (`lm-…`, lib/planung/meilenstein-aufgaben.ts) bleiben Listen (der Meilenstein zeigt auf sie) — nur die
//     Gruppe fällt weg (Bericht).
//   · Laufende SERIEN-Aufgaben (Wiederholung, nicht beendet) bleiben Hauptaufgaben in der neuen Liste: eine Serie läuft nur an
//     Hauptaufgaben (lib/aufgaben/serie.ts) — als Unteraufgabe würde sie still aufhören. Bericht + Notiz („stand in der Liste …“).
//   · Gelöscht werden nur die aufgelösten Gruppen- und Listen-Hüllen — sie stehen in der Archiv-Kopie `tasks-vor-umbau-v3-<zeit>`
//     (lib/aufgaben/umbau.ts), der Bericht daneben (`tasks-umbau-v3-bericht-<zeit>`).
// Rein und deterministisch (keine Uhr, keine Zufallskennung): die Übernahme (`uebernehmen`, lib/aufgaben/struktur.ts) ruft es
// bei JEDEM Lesen, bis der Bestand einmal geschrieben ist — zweimal lesen muss dieselben Kennungen und Stände liefern.
// Tests: tests/aufgaben-umbau-v3.test.ts.

import type { AufgabenGruppe, AufgabenListe, Project, Task, TasksState } from '@/types/tasks';
import { AUFGABEN_EBENEN_MAX, ebeneVon, nachIdKarte, vorfahren } from './ebenen';
import { wiederholungText, langTag, istTag } from './wiederholung';

/** Präfix der Meilenstein-Listen — dieselbe Zeichenkette wie `MS_LISTE_PRAEFIX` (lib/planung/meilenstein-aufgaben.ts; Import wäre ein Kreis). */
export const MEILENSTEIN_LISTE_PRAEFIX = 'lm-';
/** Zeitstempel für neue Aufgaben, wenn nichts Besseres da ist (deterministisch — der Tag des Umbaus). */
export const UMBAU_V3_ZEIT = '2026-10-06T00:00:00.000Z';
/** Grenze der Notiz (= AUFGABEN_GRENZEN.notiz) — darüber hängt der Umbau keinen Hinweis an (er steht dann nur im Bericht). */
const NOTIZ_MAX = 50_000;

/** Ein Eintrag im Umbau-Bericht (nur Kennungen + Titel — der Bericht liegt verschlüsselt im Archiv, nie im Log). */
export type UmbauBerichtEintrag =
  | { art: 'gruppe-liste'; gruppeId: string; listeId: string; titel: string; projektId: string; listen: number }
  | { art: 'liste-aufgabe'; listeId: string; aufgabeId: string; titel: string; inListe: string; unteraufgaben: number }
  | { art: 'zu-tief'; aufgabeId: string; titel: string; vorherUnter: string; jetztUnter: string }
  | { art: 'serie-notiz'; aufgabeId: string; titel: string; text: string }
  | { art: 'meilenstein-liste-bleibt'; listeId: string; titel: string }
  | { art: 'serie-bleibt-aufgabe'; aufgabeId: string; titel: string; ausListe: string }
  | { art: 'abgelegte-liste'; aufgabeId: string; titel: string };

export interface GruppenUmbau { state: TasksState; bericht: UmbauBerichtEintrag[]; geaendert: boolean }

/** Reihenfolge wie im Baum (sortOrder, Kennung) — ohne Uhr, damit es rein bleibt. */
const reihe = (a: { sortOrder?: number; id: string }, b: { sortOrder?: number; id: string }) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id.localeCompare(b.id);

/** Eine freie Kennung: die Wunsch-Kennung, sonst mit Nachsatz (deterministisch). */
function frei(wunsch: string, belegt: Set<string>, nachsatz: string): string {
  let id = wunsch;
  for (let n = 1; belegt.has(id); n++) id = `${wunsch.slice(0, 70)}-${nachsatz}${n > 1 ? n : ''}`;
  belegt.add(id);
  return id;
}

/** Space eines Projekts (gespeichert bzw. aus „Sonstige“ abgeleitet). */
function spaceVonProjekt(projektId: string, p: Project | undefined): string | undefined {
  if (p?.spaceId) return p.spaceId;
  if (projektId.startsWith('sonstige-')) return projektId.slice('sonstige-'.length);
  return undefined;
}

/** Häufigste Verantwortliche der Kinder (bei Gleichstand die erste) — sonst der Projekt-Besitz bzw. die erste Person des Haushalts („both“ löst die Übernahme danach auf). */
function zustaendigFuer(kinder: readonly Task[], personen: readonly string[], p: Project | undefined): Task['assignee'] {
  const n = new Map<string, number>();
  for (const k of kinder) if (k.assignee) n.set(k.assignee, (n.get(k.assignee) ?? 0) + 1);
  let best: string | undefined, max = 0;
  for (const k of kinder) { const z = n.get(k.assignee) ?? 0; if (z > max) { best = k.assignee; max = z; } }
  return (best ?? p?.owner ?? personen[0] ?? 'both') as Task['assignee'];
}

const notizAnhaengen = (alt: string | undefined, zeilen: readonly string[]): string | undefined => {
  if (!zeilen.length) return alt;
  const neu = [alt?.trim() ? alt.trimEnd() : '', ...zeilen].filter(Boolean).join('\n\n');
  return neu.length <= NOTIZ_MAX ? neu : alt;
};

/**
 * Gruppen auflösen (siehe Kopf). `personen` (Speichernamen des Haushalts, Inhaber zuerst) nur für die Verantwortliche einer neuen
 * Aufgabe, wenn keine Unteraufgabe eine trägt. Ohne Gruppen: der Stand unverändert (`geaendert: false`).
 */
export function gruppenAufloesen(roh: TasksState, personen: readonly string[] = []): GruppenUmbau {
  const gruppenAlle = (Array.isArray(roh.gruppen) ? roh.gruppen : []).filter((g): g is AufgabenGruppe => !!g && typeof g.id === 'string' && typeof g.projektId === 'string');
  if (!gruppenAlle.length) return { state: roh, bericht: [], geaendert: false };
  const projekte = Array.isArray(roh.projects) ? roh.projects : [];
  const projektNach = new Map(projekte.map(p => [p.id, p]));
  let listen: AufgabenListe[] = Array.isArray(roh.listen) ? [...roh.listen] : [];
  let tasks: Task[] = Array.isArray(roh.tasks) ? [...roh.tasks] : [];
  const bericht: UmbauBerichtEintrag[] = [];
  const listenIds = new Set(listen.map(l => l.id));
  const taskIds = new Set(tasks.map(t => t.id));
  const nachIdAlt = nachIdKarte(tasks);
  const ebeneAlt = new Map(tasks.map(t => [t.id, ebeneVon(t, nachIdAlt)]));
  const aenderung = new Map<string, Task>();
  const neueTasks: Task[] = [];
  const gruppeGueltig = new Map(gruppenAlle.map(g => [g.id, g]));

  const projektIds = Array.from(new Set(gruppenAlle.map(g => g.projektId))).sort();
  for (const pid of projektIds) {
    const p = projektNach.get(pid);
    const spaceId = spaceVonProjekt(pid, p);
    const gruppen = gruppenAlle.filter(g => g.projektId === pid).sort(reihe);
    const imProjekt = listen.filter(l => l.projektId === pid);
    const inGruppe = (l: AufgabenListe) => !!l.gruppeId && gruppeGueltig.get(l.gruppeId)?.projektId === pid;
    const direkt = imProjekt.filter(l => !inGruppe(l)).sort(reihe);
    const neueReihe: AufgabenListe[] = [];
    for (const g of gruppen) {
      const neueListeId = frei(g.id, listenIds, 'g3');
      const neueListe: AufgabenListe = {
        id: neueListeId, projektId: pid, titel: g.titel.slice(0, 80), sortOrder: 0,
        ...(g.farbe ? { farbe: g.farbe } : {}),
        ...(g.archiviertAm ? { archiviertAm: g.archiviertAm, ...(g.archivId ? { archivId: g.archivId } : {}) } : {}),
      };
      neueReihe.push(neueListe);
      const glisten = imProjekt.filter(l => l.gruppeId === g.id).sort(reihe);
      const bleiben: AufgabenListe[] = [];
      let aufgabenReihe = 0;
      for (const l of glisten) {
        if (l.id.startsWith(MEILENSTEIN_LISTE_PRAEFIX)) {
          // Der Meilenstein zeigt auf genau diese Liste — sie bleibt Liste (direkt im Projekt, gleich hinter der Gruppe).
          const { gruppeId: _g, ...rest } = l;
          bleiben.push(rest);
          bericht.push({ art: 'meilenstein-liste-bleibt', listeId: l.id, titel: l.titel });
          continue;
        }
        const aufgabeId = frei(l.id, taskIds, 'l3');
        // Die Hauptaufgaben dieser Liste (Unteraufgaben hängen an ihnen und kommen über `parentId` mit). Laufende Serien bleiben
        // Hauptaufgaben in der neuen Liste (eine Serie läuft nur an Hauptaufgaben) — direkt hinter der neuen Aufgabe.
        const alleOben = tasks.filter(t => t.listeId === l.id && t.projectId === pid && (!t.parentId || !nachIdAlt.has(t.parentId))).sort(reihe);
        const serien = alleOben.filter(serieLaeuftHier);
        const kinder = alleOben.filter(t => !serieLaeuftHier(t));
        const zaehlen = kinder.filter(k => !k.geloeschtAm);
        const fertig = zaehlen.length > 0 && zaehlen.every(k => k.status === 'done' || k.status === 'cancelled') && zaehlen.some(k => k.status === 'done');
        const zeiten = kinder.map(k => k.createdAt).filter((x): x is string => typeof x === 'string' && !!x).sort();
        const zeit = zeiten[0] ?? p?.createdAt ?? UMBAU_V3_ZEIT;
        const notiz: string[] = [];
        if (l.wiederholung) {
          const w = l.wiederholung;
          const text = `Wiederkehrende Liste (bis zum Umbau am 06.10.): ${wiederholungText(w)}${istTag(w.naechste) ? `, nächste ${langTag(w.naechste!)}` : ''}${l.titelMuster ? `, Titel „${l.titelMuster}“` : ''}. Als Serie neu einstellen: Feld „Wiederholt“ an dieser Aufgabe.`;
          notiz.push(text);
          bericht.push({ art: 'serie-notiz', aufgabeId, titel: l.titel, text });
        } else if (l.titelMuster) notiz.push(`Titel-Muster der früheren Liste: „${l.titelMuster}“.`);
        if (l.archiviert) {
          notiz.push('Die frühere Liste war abgelegt (archiviert).');
          bericht.push({ art: 'abgelegte-liste', aufgabeId, titel: l.titel });
        }
        const completed = fertig ? zaehlen.map(k => k.completedAt).filter((x): x is string => !!x).sort().pop() ?? zeit : undefined;
        const neu: Task = {
          id: aufgabeId, projectId: pid, title: l.titel, status: fertig ? 'done' : 'todo', priority: 'medium',
          assignee: zustaendigFuer(zaehlen.length ? zaehlen : kinder, personen, p), tags: [], subTasks: [], dependencies: [],
          sortOrder: aufgabenReihe++, createdAt: zeit, updatedAt: zeit, listeId: neueListeId,
          ...(spaceId ? { spaceId } : kinder[0]?.spaceId ? { spaceId: kinder[0].spaceId } : {}),
          ...(completed ? { completedAt: completed } : {}),
          ...(l.vorlageId ? { vorlageId: l.vorlageId } : {}),
          ...(notiz.length ? { notiz: notiz.join('\n\n') } : {}),
          ...(l.archiviertAm ? { archiviertAm: l.archiviertAm, ...(l.archivId ? { archivId: l.archivId } : {}) } : {}),
          ...(p?.geloeschtAm ? { geloeschtAm: p.geloeschtAm, geloeschtMit: pid } : {}),
        };
        neueTasks.push(neu);
        for (const sAufgabe of serien) {
          const hinweis = `Umbau 06.10. (Gruppen → Listen): stand in der Liste „${l.titel}“ — als laufende Serie bleibt sie eine eigene Aufgabe (eine Serie läuft nur an Hauptaufgaben).`;
          const notizNeu = notizAnhaengen(sAufgabe.notiz, [hinweis]);
          aenderung.set(sAufgabe.id, { ...sAufgabe, listeId: neueListeId, sortOrder: aufgabenReihe++, ...(notizNeu !== undefined ? { notiz: notizNeu } : {}) });
          bericht.push({ art: 'serie-bleibt-aufgabe', aufgabeId: sAufgabe.id, titel: sAufgabe.title, ausListe: l.titel });
        }
        let unter = 0;
        for (const k of kinder) {
          aenderung.set(k.id, { ...(aenderung.get(k.id) ?? k), parentId: aufgabeId, listeId: neueListeId });
          unter++;
        }
        // Tiefe: jede Aufgabe unter diesen Hauptaufgaben rückt eine Ebene tiefer. Zu tief → unter den tiefsten erlaubten Vorfahren.
        const inDieserListe = new Set(kinder.map(k => k.id));
        for (const t of tasks) {
          if (inDieserListe.has(t.id) || !t.parentId) continue;
          const kette = vorfahren(t, nachIdAlt);
          const wurzel = kette[kette.length - 1];
          if (!wurzel || !inDieserListe.has(wurzel.id)) continue;
          unter++;
          const neueEbene = (ebeneAlt.get(t.id) ?? 1) + 1;
          if (neueEbene <= AUFGABEN_EBENEN_MAX) continue;
          // Vorfahre auf der neuen Ebene MAX-1 = alte Ebene MAX-2 (kette: Eltern zuerst, Wurzel zuletzt).
          const ziel = kette.find(v => (ebeneAlt.get(v.id) ?? 1) === AUFGABEN_EBENEN_MAX - 2) ?? wurzel;
          const vorher = nachIdAlt.get(t.parentId);
          const basis = aenderung.get(t.id) ?? t;
          const hinweis = `Umbau 06.10. (Gruppen → Listen): lag vorher unter „${vorher?.title ?? t.parentId}“ — dort wäre es eine Ebene zu tief gewesen, deshalb hier eingehängt.`;
          aenderung.set(t.id, { ...basis, parentId: ziel.id, ...(notizAnhaengen(basis.notiz, [hinweis]) !== undefined ? { notiz: notizAnhaengen(basis.notiz, [hinweis]) } : {}) });
          bericht.push({ art: 'zu-tief', aufgabeId: t.id, titel: t.title, vorherUnter: t.parentId, jetztUnter: ziel.id });
        }
        bericht.push({ art: 'liste-aufgabe', listeId: l.id, aufgabeId, titel: l.titel, inListe: neueListeId, unteraufgaben: unter });
      }
      neueReihe.push(...bleiben);
      bericht.push({ art: 'gruppe-liste', gruppeId: g.id, listeId: neueListeId, titel: g.titel, projektId: pid, listen: glisten.length });
    }
    // Neue Reihenfolge im Projekt: erst die (ehemaligen) Gruppen, dann die direkten Listen — wie der Baum sie zeigte.
    const reihenfolge = [...neueReihe, ...direkt].map((l, i): AufgabenListe => { const { gruppeId: _g, ...rest } = l; return { ...rest, sortOrder: i }; });
    listen = [...listen.filter(l => l.projektId !== pid), ...reihenfolge];
  }
  // Listen, deren Gruppe es nicht (mehr) gibt oder die in einem anderen Projekt liegt: direkt im Projekt (wie bisher).
  listen = listen.map(l => { if (!l.gruppeId) return l; const { gruppeId: _g, ...rest } = l; return rest; });
  tasks = [...neueTasks, ...tasks.map(t => aenderung.get(t.id) ?? t)];
  return { state: { ...roh, listen, tasks, gruppen: [] }, bericht, geaendert: true };
}

/** Kurzfassung des Berichts für das Server-Log — nur Zahlen, nie Titel (die stehen verschlüsselt im Archiv). */
export function berichtZahlen(b: readonly UmbauBerichtEintrag[]): string {
  const n = (a: UmbauBerichtEintrag['art']) => b.filter(x => x.art === a).length;
  return `${n('gruppe-liste')} Gruppen → Listen, ${n('liste-aufgabe')} Listen → Aufgaben, ${n('zu-tief')} zu tief eingehängt, ${n('serie-notiz')} Serien-Listen in der Notiz, ${n('serie-bleibt-aufgabe')} Serien-Aufgaben als Hauptaufgabe, ${n('meilenstein-liste-bleibt')} Meilenstein-Listen geblieben`;
}

/** Läuft an dieser Aufgabe eine Serie (Wiederholung, nicht beendet, nicht im Papierkorb)? Dann muss sie Hauptaufgabe bleiben. */
export const serieLaeuftHier = (t: Pick<Task, 'wiederholung' | 'geloeschtAm'>): boolean => !!t.wiederholung && !t.wiederholung.serieBeendet && !t.geloeschtAm;

/** Alte Gruppen-Kennung → die Liste, die daraus wurde (gleiche Kennung bzw. mit Nachsatz). */
export function listeAusGruppe(gruppeId: string, listen: readonly Pick<AufgabenListe, 'id'>[]): string | undefined {
  return listen.find(l => l.id === gruppeId)?.id ?? listen.find(l => l.id.startsWith(`${gruppeId.slice(0, 70)}-g3`))?.id;
}
/** Alte Listen-Kennung (Liste in einer Gruppe) → die Aufgabe, die daraus wurde. */
export function aufgabeAusListe(listeId: string, tasks: readonly Pick<Task, 'id'>[]): string | undefined {
  return tasks.find(t => t.id === listeId)?.id ?? tasks.find(t => t.id.startsWith(`${listeId.slice(0, 70)}-l3`))?.id;
}
