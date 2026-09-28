// ─── MAKE OS — Serien: wiederkehrende Aufgaben und Listen (rein, Paket C3, 28.09. spät) ──
// Kevin 28.09.: „… dass es Listen gibt, die immer wieder kommen — wiederkehrende Aufgaben.“
//
// Wiederkehrende AUFGABE (`Task.wiederholung`):
//   · Beim Erledigen entsteht im Schreibweg (lib/aufgaben/speicher.ts) die nächste Instanz: neue Deadline nach der
//     Regel, Unteraufgaben zurückgesetzt (Deadlines mitverschoben), Notiz/Beschreibung/Felder/Zuständig/Bezug/Ort
//     übernommen — Kommentare, Verlauf, ZOE, Abhängigkeiten, eigener Status NICHT.
//   · Serie = `vorlageId` „serie:<Kennung der ersten Aufgabe>“ (die erste trägt keine — ihre Kennung ist der Anker).
//     Instanz-Kennung `w-<fnv(serie)>-<JJJJMMTT>` → idempotent; höchstens EINE offene Instanz je Serie.
//   · Lange weg gewesen: die nächste Deadline springt auf den ersten Termin am oder nach heute (keine Lawine).
//   · Morgenlauf (/api/tagesstart, Schritt „Aufgaben-Serien“) holt nur nach, was ein anderer Schreiber beim Erledigen
//     nicht angelegt hat (Heads, ZOE, alte Fenster): letzte Instanz erledigt, keine offene, nächster Termin ≤ morgen.
//
// Wiederkehrende LISTE (`AufgabenListe.wiederholung` + `vorlageId`):
//   · Die jeweils NEUESTE Liste der Serie trägt `wiederholung` mit `naechste` (Start der nächsten Periode).
//   · Morgenlauf: `naechste` ≤ heute → neue Liste „<Muster>“ (Platzhalter {Monat} {Jahr} {KW} {Datum}) mit den Aufgaben
//     der Vorlage (Deadline = Listenstart + `versatzTage`); `wiederholung` wandert an die neue Liste. Muster = Titel der
//     Vorlage (mit Platzhalter) bzw. Grundtitel + Standard je Regel.
//   · Kennung `ls-<fnv(Projekt|Gruppe|Vorlage|Regel)>-<JJJJMMTT>` → eine Liste je Periode (idempotent).
//   · Lawinen-Grenze: höchstens EINE neue Liste je Serie und Lauf. Mehrere Perioden verpasst → monatlich/jährlich die
//     älteste zuerst (jede Periode will abgeschlossen werden, der nächste Lauf holt die nächste), täglich/Werktage/
//     wöchentlich nur die jüngste (ältere übersprungen) — beides mit Hinweis.

import type { Task, TasksState, AufgabenListe, AufgabenVorlage, Wiederholung } from '@/types/tasks';
import type { Owner } from '@/types/common';
import { istSonstigeProjekt, SONSTIGE_PRAEFIX } from './struktur';
import {
  berlinerTag, ersterTermin, faelligeTermine, grundTitel, hatPlatzhalter, istTag, naechsterAbHeute, naechsterTermin, ohneNaechste,
  standardMuster, tagPlus, tageZwischen, titelMitPlatzhaltern,
} from './wiederholung';
import { aufgabenAusVorlage, vorlageFinden } from './vorlagen';

export const SERIE_PRAEFIX = 'serie:';

/** Kurzer, stabiler Fingerabdruck (FNV-1a, 8 Hex-Zeichen) für Kennungen. */
export function kurzHash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Die Serie einer Aufgabe: ihre `vorlageId`, wenn sie „serie:…“ ist, sonst sie selbst als Anker. */
export function serieVon(t: Pick<Task, 'id' | 'vorlageId'>): string {
  if (t.vorlageId?.startsWith(SERIE_PRAEFIX)) return t.vorlageId;
  return `${SERIE_PRAEFIX}${t.id.length <= 74 ? t.id : kurzHash(t.id)}`;
}
const ohneStriche = (tag: string) => tag.replace(/-/g, '');
/** Kennung der Instanz einer Serie an einem Tag (idempotent). */
export const instanzId = (serie: string, tag: string): string => `w-${kurzHash(serie)}-${ohneStriche(tag)}`;

const tagDer = (d: string | undefined): string | undefined => (d && istTag(d.slice(0, 10)) ? d.slice(0, 10) : undefined);
const verschoben = (d: string | undefined, delta: number): string | undefined => { const t = tagDer(d); return t ? tagPlus(t, delta) : undefined; };

/**
 * Wiederholung an einer Aufgabe setzen (Oberfläche): ohne Deadline bekommt die Aufgabe den ersten Termin ab heute —
 * sie ist die erste Instanz. `undefined` beendet die Serie (bestehende Instanzen bleiben).
 */
export function wiederholungSetzen(t: Pick<Task, 'dueDate'>, w: Wiederholung | undefined, heute = berlinerTag()): Partial<Task> {
  if (!w) return { wiederholung: undefined };
  const rein = ohneNaechste(w);
  if (tagDer(t.dueDate)) return { wiederholung: rein };
  const erster = ersterTermin(rein, heute);
  return { wiederholung: rein, ...(erster ? { dueDate: erster } : {}) };
}

/** Gibt es in der Serie eine offene Instanz (ohne `ausser`)? Unteraufgaben zählen nicht. */
function offeneInstanz(alle: readonly Task[], serie: string, ausser?: string): boolean {
  return alle.some(x => x.id !== ausser && !x.parentId && x.status !== 'done' && serieVon(x) === serie);
}

/**
 * Die nächste Instanz zu einer ERLEDIGTEN wiederkehrenden Aufgabe (+ ihre zurückgesetzten Unteraufgaben).
 * Leer, wenn: keine Wiederholung, nicht erledigt, Unteraufgabe, Serie zu Ende (`bis`), schon eine offene Instanz,
 * oder die Instanz für den Tag gibt es schon.
 */
export function naechsteInstanz(t: Task, alle: readonly Task[], heute: string, jetzt: string): Task[] {
  if (!t.wiederholung || t.status !== 'done' || t.parentId) return [];
  const serie = serieVon(t);
  if (offeneInstanz(alle, serie, t.id)) return [];
  const basis = tagDer(t.dueDate) ?? (t.completedAt ? berlinerTag(new Date(t.completedAt)) : heute);
  const tag = naechsterAbHeute(t.wiederholung, basis, heute);
  if (!tag) return [];
  const id = instanzId(serie, tag);
  if (alle.some(x => x.id === id)) return [];
  const delta = tageZwischen(basis, tag);
  const ort = {
    projectId: t.projectId, spaceId: t.spaceId,
    ...(t.space ? { space: t.space } : {}), ...(t.einheit ? { einheit: t.einheit } : {}), ...(t.listeId ? { listeId: t.listeId } : {}),
  };
  const kopie = (q: Task, neueId: string, extra: Partial<Task>): Task => {
    const n: Task = {
      id: neueId, title: q.title, status: 'todo', priority: q.priority, assignee: q.assignee, tags: [...(q.tags ?? [])],
      subTasks: [], dependencies: [], sortOrder: q.sortOrder ?? 0, createdAt: jetzt, updatedAt: jetzt, ...ort,
      ...(q.description ? { description: q.description } : {}),
      ...(q.notiz ? { notiz: q.notiz } : {}),
      ...(q.felder ? { felder: { ...q.felder } } : {}),
      ...(q.bezug ? { bezug: { ...q.bezug } } : {}),
      ...extra,
    };
    for (const k of Object.keys(n) as (keyof Task)[]) if (n[k] === undefined) delete n[k];
    return n;
  };
  const inst = kopie(t, id, { dueDate: tag, startDate: verschoben(t.startDate, delta), vorlageId: serie, wiederholung: ohneNaechste(t.wiederholung) });
  const unter = alle.filter(x => x.parentId === t.id).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((u, i) => kopie(u, `${id}-u${i + 1}`, { parentId: id, dueDate: verschoben(u.dueDate, delta), startDate: verschoben(u.startDate, delta) }));
  return [inst, ...unter];
}

/**
 * Im Schreibweg: für jede Aufgabe aus `ids`, die gerade erledigt wurde (vorher offen, jetzt erledigt) und
 * wiederkehrt, die nächste Instanz. Liefert nur die NEUEN Aufgaben.
 */
export function serienBeimErledigen(vorher: readonly Task[], nachher: readonly Task[], ids: readonly string[], heute: string, jetzt: string): Task[] {
  const alt = new Map(vorher.map(t => [t.id, t]));
  const jetztNach = new Map(nachher.map(t => [t.id, t]));
  const neu: Task[] = [];
  for (const id of ids) {
    const n = jetztNach.get(id);
    const a = alt.get(id);
    if (!n || !a || a.status === 'done' || n.status !== 'done' || !n.wiederholung || n.parentId) continue;
    neu.push(...naechsteInstanz(n, [...nachher, ...neu], heute, jetzt));
  }
  return neu;
}

/**
 * Morgenlauf, Teil Aufgaben: Serien ohne offene Instanz, deren letzte Instanz erledigt ist und deren nächster Termin
 * spätestens morgen liegt — eine Instanz je Serie. Liefert nur die NEUEN Aufgaben.
 */
export function serienAufgabenNachholen(tasks: readonly Task[], heute: string, jetzt: string): Task[] {
  const letzte = new Map<string, Task>();
  const zeit = (t: Task) => tagDer(t.dueDate) ?? tagDer(t.completedAt) ?? tagDer(t.createdAt) ?? '';
  for (const t of tasks) {
    if (t.parentId || !t.wiederholung) continue;
    const s = serieVon(t);
    const l = letzte.get(s);
    if (!l || zeit(t) > zeit(l)) letzte.set(s, t);
  }
  const morgen = tagPlus(heute, 1);
  const neu: Task[] = [];
  for (const [serie, t] of Array.from(letzte.entries())) {
    if (t.status !== 'done' || offeneInstanz([...tasks, ...neu], serie)) continue;
    const basis = tagDer(t.dueDate) ?? (t.completedAt ? berlinerTag(new Date(t.completedAt)) : heute);
    const tag = naechsterAbHeute(t.wiederholung!, basis, heute);
    if (!tag || tag > morgen) continue;
    neu.push(...naechsteInstanz(t, [...tasks, ...neu], heute, jetzt));
  }
  return neu;
}

// ── Wiederkehrende Listen ──────────────────────────────────────────────────

/** Regeln mit kurzen Perioden: verpasste ältere werden übersprungen (nur die jüngste entsteht). */
const KURZ = new Set<Wiederholung['regel']>(['taeglich', 'werktage', 'woechentlich']);

/** Titel-Muster einer Serien-Liste: Vorlagen-Titel mit Platzhalter, sonst Grundtitel + Standard je Regel. */
export function listenMuster(liste: Pick<AufgabenListe, 'titel'>, w: Wiederholung, vorlage?: Pick<AufgabenVorlage, 'titel'>): string {
  if (vorlage && hatPlatzhalter(vorlage.titel)) return vorlage.titel;
  return standardMuster(vorlage?.titel ?? grundTitel(liste.titel), w.regel);
}

/** Kennung der Liste einer Periode — stabil über die ganze Serie (Projekt, Gruppe, Vorlage/Grundtitel, Regel). */
export function listenInstanzId(l: Pick<AufgabenListe, 'projektId' | 'gruppeId' | 'vorlageId' | 'titel'>, w: Wiederholung, tag: string): string {
  return `ls-${kurzHash(`${l.projektId}|${l.gruppeId ?? ''}|${l.vorlageId ?? grundTitel(l.titel)}|${w.regel}`)}-${ohneStriche(tag)}`;
}

/** Den Zeiger einer frisch eingestellten Serie setzen: nächster Start ab morgen (die laufende Liste IST die aktuelle Periode). */
export function listenSerieStarten(w: Wiederholung, heute = berlinerTag()): Wiederholung | null {
  const rein = ohneNaechste(w);
  const n = ersterTermin(rein, tagPlus(heute, 1));
  return n ? { ...rein, naechste: n } : null;
}

export interface SerienLaufErgebnis {
  /** Der ganze neue Bestand (unverändert, wenn nichts fällig war). */
  state: TasksState;
  neueListen: AufgabenListe[];
  neueAufgaben: Task[];
  hinweise: string[];
  geaendert: boolean;
}

/**
 * Morgenlauf (rein): fällige Serien-Listen anlegen + Serien-Aufgaben nachholen. Idempotent — ein zweiter Lauf am
 * selben Tag ändert nichts. `vorlagen` = eigene des Bestands (die mitgelieferten findet `vorlageFinden` selbst).
 */
export function serienLauf(state: TasksState, heute: string, jetzt: string): SerienLaufErgebnis {
  const hinweise: string[] = [];
  let listen = [...(state.listen ?? [])];
  const tasks = [...state.tasks];
  const neueListen: AufgabenListe[] = [];
  const neueAufgaben: Task[] = [];
  let geaendert = false;
  const setzeListe = (l: AufgabenListe) => { listen = listen.map(x => (x.id === l.id ? l : x)); geaendert = true; };
  const ohneSerie = (l: AufgabenListe): AufgabenListe => { const { wiederholung: _w, ...rest } = l; return rest; };

  for (const l of (state.listen ?? []).filter(x => x.wiederholung && !x.archiviert)) {
    const w = l.wiederholung!;
    // Neu eingestellt, aber ohne Zeiger → Zeiger setzen (die laufende Liste ist die aktuelle Periode), nichts anlegen.
    if (!istTag(w.naechste)) {
      const s = listenSerieStarten(w, heute);
      setzeListe(s ? { ...l, wiederholung: s } : ohneSerie(l));
      continue;
    }
    if (w.naechste > heute) continue;
    const { termine, mehr } = faelligeTermine(w, w.naechste, heute);
    if (!termine.length) { setzeListe(ohneSerie(l)); hinweise.push(`„${l.titel}“: Serie beendet (bis ${w.bis}).`); continue; }
    const kurz = KURZ.has(w.regel);
    const tag = kurz ? termine[termine.length - 1] : termine[0];
    const rest = termine.length - 1;
    if (rest > 0 || mehr) hinweise.push(kurz
      ? `„${l.titel}“: ${rest}${mehr ? '+' : ''} ältere Termine übersprungen — nur die aktuelle Liste angelegt.`
      : `„${l.titel}“: noch ${rest}${mehr ? '+' : ''} weitere Periode${rest === 1 && !mehr ? '' : 'n'} offen — der nächste Lauf holt die nächste.`);
    const vorlage = vorlageFinden(state.vorlagen, l.vorlageId);
    const id = listenInstanzId(l, w, tag);
    const weiter = naechsterTermin(w, tag);
    const alt = listen.find(x => x.id === id);
    if (alt) {
      // Die Liste dieser Periode gibt es schon — nur den Zeiger weitergeben (keine zweite Liste).
      if (alt.id !== l.id) setzeListe(ohneSerie(l));
      setzeListe(weiter ? { ...alt, wiederholung: { ...ohneNaechste(w), naechste: weiter } } : ohneSerie(alt));
      continue;
    }
    const sortOrder = listen.filter(x => x.projektId === l.projektId).reduce((m, x) => Math.max(m, x.sortOrder), -1) + 1;
    const neu: AufgabenListe = {
      id, projektId: l.projektId, titel: titelMitPlatzhaltern(listenMuster(l, w, vorlage), tag).slice(0, 80), sortOrder,
      ...(l.gruppeId ? { gruppeId: l.gruppeId } : {}), ...(l.vorlageId ? { vorlageId: l.vorlageId } : {}),
      ...(weiter ? { wiederholung: { ...ohneNaechste(w), naechste: weiter } } : {}),
    };
    setzeListe(ohneSerie(l));
    listen.push(neu);
    neueListen.push(neu);
    if (!weiter) hinweise.push(`„${neu.titel}“: letzte Liste der Serie (bis ${w.bis}).`);
    const projekt = state.projects.find(p => p.id === l.projektId);
    const spaceId = projekt?.spaceId ?? (istSonstigeProjekt(l.projektId) ? l.projektId.slice(SONSTIGE_PRAEFIX.length) : 'privat');
    const inhalt = vorlage?.inhalt.aufgaben ?? vorlage?.inhalt.listen?.[0]?.aufgaben ?? [];
    if (!vorlage) hinweise.push(`„${neu.titel}“: keine Vorlage gefunden — Liste ohne Aufgaben angelegt.`);
    const owner: Owner = projekt?.owner ?? 'kevin';
    const sortStart = tasks.filter(t => t.spaceId === spaceId).reduce((m, t) => Math.max(m, t.sortOrder ?? 0), -1) + 1;
    neueAufgaben.push(...aufgabenAusVorlage(inhalt, { spaceId, projectId: l.projektId, listeId: id, start: tag, praefix: id, owner, jetzt, ...(vorlage ? { vorlageId: vorlage.id } : {}), sortStart }));
  }

  // Wiederkehrende Aufgaben: nur nachholen, was beim Erledigen nicht entstand.
  const nachgeholt = serienAufgabenNachholen([...tasks, ...neueAufgaben], heute, jetzt);
  neueAufgaben.push(...nachgeholt);
  if (neueAufgaben.length) geaendert = true;
  return {
    state: geaendert ? { ...state, listen, tasks: [...tasks, ...neueAufgaben] } : state,
    neueListen, neueAufgaben, hinweise, geaendert,
  };
}
