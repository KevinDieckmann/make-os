// ─── MAKE OS — Serien: wiederkehrende Aufgaben und Listen (rein, Paket C3, 28.09. spät) ──
// Kevin 28.09.: „… dass es Listen gibt, die immer wieder kommen — wiederkehrende Aufgaben.“
//
// Wiederkehrende AUFGABE (`Task.wiederholung`):
//   · Beim Erledigen entsteht im Schreibweg (lib/aufgaben/speicher.ts) die nächste Instanz: neue Deadline nach der
//     Regel, Unteraufgaben zurückgesetzt (Deadlines mitverschoben), Notiz/Beschreibung/Felder/Zuständig/Bezug/Ort
//     übernommen — Kommentare, Verlauf, ZOE, Abhängigkeiten, eigener Status NICHT.
//   · Serie = `serieId` (Kennung der ersten Aufgabe; die erste trägt keine — ihre Kennung ist der Anker). Intern heißt
//     die Serie „serie:<Anker>“ (stabil für die Instanz-Kennungen); Altbestand mit `vorlageId` „serie:…“ übersetzt die
//     Übernahme (lib/aufgaben/struktur.ts). `vorlageId` bleibt die Herkunftsvorlage.
//     Instanz-Kennung `w-<fnv(serie)>-<JJJJMMTT>` → idempotent; höchstens EINE offene Instanz je Serie.
//   · Lange weg gewesen: die nächste Deadline springt auf den ersten Termin am oder nach heute (keine Lawine).
//   · Morgenlauf (/api/tagesstart, Schritt „Aufgaben-Serien“) holt nur nach, was ein anderer Schreiber beim Erledigen
//     nicht angelegt hat (Heads, ZOE, alte Fenster): letzte Instanz erledigt, keine offene, nächster Termin ≤ morgen.
//   · Seit 29.09. (Kevin, Paket T1):
//     – Die JÜNGSTE Instanz entscheidet — auch ohne `wiederholung` (dann ist die Serie beendet) bzw. mit `serieBeendet`.
//     – „abgebrochen“ (`cancelled`) löst keine Folgeinstanz aus (auch nicht im Morgenlauf).
//     – Wieder geöffnet (erledigt → offen): die gerade erzeugte, unberührte Folgeinstanz geht wieder weg (#12).
//     – „Nur diese löschen“: der Tag geht in `ausnahmen`, die nächste Instanz entsteht sofort (übersprungen, #29);
//       der Morgenlauf legt den übersprungenen Tag nie wieder an.
//     – `ab: 'erledigt'` rechnet ab dem Tag der Erledigung; `rotation` gibt die nächste Instanz der nächsten Person;
//       `feiertage: 'NRW'` schiebt einen Termin auf den nächsten Werktag (Regel „Werktage“ kennt die Feiertage immer).
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
import { werktagAbOder } from './feiertage';
import { istSonstigeProjekt, SONSTIGE_PRAEFIX, nachReihe } from './struktur';
import {
  berlinerTag, ersterTermin, faelligeTermine, grundTitel, hatPlatzhalter, istTag, naechsterAbHeute, naechsterTermin, ohneNaechste,
  standardMuster, tagPlus, tageZwischen, titelMitPlatzhaltern,
} from './wiederholung';
import { aufgabenAusVorlage, vorlageFinden } from './vorlagen';
import { kinderKarte, nachfahrenIn, AUFGABEN_EBENEN_MAX } from './ebenen';

export const SERIE_PRAEFIX = 'serie:';

/** Kurzer, stabiler Fingerabdruck (FNV-1a, 8 Hex-Zeichen) für Kennungen. */
export function kurzHash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Die Serie einer Aufgabe: `serieId` (bzw. alt `vorlageId` „serie:…“), sonst sie selbst als Anker. */
export function serieVon(t: Pick<Task, 'id' | 'vorlageId' | 'serieId'>): string {
  if (t.serieId) return `${SERIE_PRAEFIX}${t.serieId}`;
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

/** Gibt es in der Serie eine offene Instanz (ohne `ausser`)? Unteraufgaben zählen nicht, erledigte/abgebrochene nicht. */
function offeneInstanz(alle: readonly Task[], serie: string, ausser?: string): boolean {
  return alle.some(x => x.id !== ausser && !x.parentId && x.status !== 'done' && x.status !== 'cancelled' && !x.geloeschtAm && serieVon(x) === serie);
}

/** Läuft die Serie an dieser Instanz weiter? Ohne `wiederholung` oder mit `serieBeendet` ist sie beendet. */
export const serieLaeuft = (t: Pick<Task, 'wiederholung'>): boolean => !!t.wiederholung && !t.wiederholung.serieBeendet;

/**
 * Der nächste Termin einer Serie nach `basis` (nie vor heute): übersprungene Tage (`ausnahmen`) fallen aus, mit
 * `feiertage: 'NRW'` rückt ein Termin auf den nächsten Werktag. null = Serie zu Ende (`bis`).
 */
export function serienTermin(w: Wiederholung, basis: string, heute: string): string | null {
  const aus = new Set(w.ausnahmen ?? []);
  let b = basis;
  for (let i = 0; i < 1000; i++) {
    let d = naechsterAbHeute(w, b, heute);
    if (!d) return null;
    if (w.feiertage === 'NRW' && w.regel !== 'werktage') {
      d = werktagAbOder(d, 'NRW');
      if (w.bis && d > w.bis) return null;
    }
    if (!aus.has(d)) return d;
    b = d;
  }
  return null;
}

/** Die nächste Person im Wechsel (`rotation`) nach `aktuell` — nicht in der Liste: die erste. */
export function naechstePerson(rotation: readonly string[] | undefined, aktuell: string): string | undefined {
  if (!rotation?.length) return undefined;
  const i = rotation.indexOf(aktuell);
  return rotation[(i + 1) % rotation.length];
}

/** Basis-Tag für den nächsten Termin: die Fälligkeit — oder bei „ab Erledigung“ der Berliner Tag der Erledigung. */
function basisTag(t: Task, heute: string): string {
  if (t.wiederholung?.ab === 'erledigt' && t.completedAt) return berlinerTag(new Date(t.completedAt));
  return tagDer(t.dueDate) ?? (t.completedAt ? berlinerTag(new Date(t.completedAt)) : heute);
}

/**
 * Die nächste Instanz zu einer ERLEDIGTEN wiederkehrenden Aufgabe (+ ihre zurückgesetzten Unteraufgaben).
 * Leer, wenn: keine Wiederholung, nicht erledigt, Unteraufgabe, Serie zu Ende (`bis`), schon eine offene Instanz,
 * oder die Instanz für den Tag gibt es schon.
 */
export function naechsteInstanz(t: Task, alle: readonly Task[], heute: string, jetzt: string): Task[] {
  if (!serieLaeuft(t) || t.status !== 'done' || t.parentId) return [];
  const serie = serieVon(t);
  if (offeneInstanz(alle, serie, t.id)) return [];
  const basis = basisTag(t, heute);
  const tag = serienTermin(t.wiederholung!, basis, heute);
  if (!tag) return [];
  return instanzAm(t, alle, serie, basis, tag, jetzt);
}

/** Die Instanz der Serie am Tag `tag` aus der Vorgängerin `t` (+ zurückgesetzte Unteraufgaben). Leer, wenn es sie gibt. */
function instanzAm(t: Task, alle: readonly Task[], serie: string, basis: string, tag: string, jetzt: string): Task[] {
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
  const herkunft = t.vorlageId && !t.vorlageId.startsWith(SERIE_PRAEFIX) ? t.vorlageId : undefined;
  const w = ohneNaechste(t.wiederholung!);
  // Übersprungene Tage vor dem neuen Termin braucht die Serie nicht mehr (die Liste wächst nicht ohne Ende).
  const ausnahmen = (w.ausnahmen ?? []).filter(d => d > tag);
  const wNeu: Wiederholung = { ...w };
  if (ausnahmen.length) wNeu.ausnahmen = ausnahmen; else delete wNeu.ausnahmen;
  // Wechsel (29.09.): die nächste Person der Liste wird verantwortlich; wer es vorher war, ist nicht mehr beteiligt-pflichtig.
  const wer = naechstePerson(w.rotation, t.assignee);
  const person: Partial<Task> = wer ? { assignee: wer as Owner, ...(t.beteiligte?.length ? { beteiligte: t.beteiligte.filter(p => p !== wer) } : {}) } : {};
  const inst = kopie(t, id, {
    dueDate: tag, startDate: verschoben(t.startDate, delta), serieId: serie.slice(SERIE_PRAEFIX.length), vorlageId: herkunft, wiederholung: wNeu,
    ...(t.beteiligte?.length && !wer ? { beteiligte: [...t.beteiligte] } : {}), ...person,
    ...(t.sichtbarkeit ? { sichtbarkeit: t.sichtbarkeit } : {}), ...(t.angelegtVon ? { angelegtVon: t.angelegtVon } : {}),
  });
  if (inst.beteiligte && !inst.beteiligte.length) delete inst.beteiligte;
  // Mehrstufig (01.10.): der ganze Teilbaum kommt mit, zurückgesetzt. Kennungen je Ebene `<eltern>-u<n>` (Ebene 2 wie
  // bisher `<instanz>-u1`, Ebene 3 `<instanz>-u1-u1` …) — fest, damit ein zweiter Lauf nichts doppelt anlegt.
  const kinder = kinderKarte(alle.filter(x => !x.geloeschtAm || x.geloeschtMit === t.id));
  const unter: Task[] = [];
  const kopiere = (altId: string, neuId: string, tiefe: number) => {
    if (tiefe > AUFGABEN_EBENEN_MAX) return;
    [...(kinder.get(altId) ?? [])].sort(nachReihe).forEach((u, i) => {
      const nid = `${neuId}-u${i + 1}`;
      unter.push(kopie(u, nid, { parentId: neuId, dueDate: verschoben(u.dueDate, delta), startDate: verschoben(u.startDate, delta) }));
      kopiere(u.id, nid, tiefe + 1);
    });
  };
  kopiere(t.id, id, 2);
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
    if (!n || !a || a.status === 'done' || n.status !== 'done' || !serieLaeuft(n) || n.parentId) continue;
    neu.push(...naechsteInstanz(n, [...nachher, ...neu], heute, jetzt));
  }
  return neu;
}

/**
 * Wieder geöffnet (#12): eine Serien-Aufgabe geht von „erledigt“ zurück auf offen → die Folgeinstanz, die beim Erledigen
 * entstand und seither niemand angefasst hat (Verlauf nur „angelegt“, `updatedAt` = `createdAt`, nicht vor der Erledigung
 * angelegt), fällt wieder weg — samt Unteraufgaben. So gibt es nie zwei offene Instanzen. Liefert die Kennungen.
 */
export function folgeinstanzenBeimOeffnen(vorher: readonly Task[], nachher: readonly Task[], ids: readonly string[]): string[] {
  const alt = new Map(vorher.map(t => [t.id, t]));
  const jetztNach = new Map(nachher.map(t => [t.id, t]));
  const weg = new Set<string>();
  for (const id of ids) {
    const a = alt.get(id), n = jetztNach.get(id);
    if (!a || !n || a.status !== 'done' || n.status === 'done' || n.parentId || !a.wiederholung) continue;
    const serie = serieVon(n);
    const seit = a.completedAt ?? a.updatedAt;
    for (const x of nachher) {
      if (x.id === id || x.parentId || x.geloeschtAm || serieVon(x) !== serie || x.status !== 'todo') continue;
      const unberuehrt = (x.verlauf ?? []).every(v => v.was === 'angelegt') && x.updatedAt === x.createdAt && (!seit || x.createdAt >= seit);
      if (!unberuehrt || x.kommentare?.length) continue;
      weg.add(x.id);
      for (const u of nachfahrenIn(x.id, nachher)) weg.add(u.id);
    }
  }
  return Array.from(weg);
}

/**
 * „Nur diese löschen“ (#29): eine OFFENE Instanz einer laufenden Serie geht in den Papierkorb → ihr Tag kommt in
 * `ausnahmen` (an der gelöschten Instanz — sie bleibt die jüngste, bis die nächste da ist) und die nächste Instanz entsteht
 * sofort. Liefert die geänderte gelöschte Instanz (mit Ausnahme) und die neuen Aufgaben.
 */
export function serieUeberspringen(t: Task, alle: readonly Task[], heute: string, jetzt: string): { geloescht: Task; neu: Task[] } | null {
  if (!serieLaeuft(t) || t.parentId || t.status === 'done' || t.status === 'cancelled') return null;
  const tag = tagDer(t.dueDate);
  if (!tag) return null;
  const w = t.wiederholung!;
  const ausnahmen = Array.from(new Set([...(w.ausnahmen ?? []), tag])).sort();
  const geloescht: Task = { ...t, wiederholung: { ...w, ausnahmen } };
  const serie = serieVon(t);
  if (offeneInstanz(alle.filter(x => x.id !== t.id), serie)) return { geloescht, neu: [] };
  const naechster = serienTermin(geloescht.wiederholung!, tag, heute);
  if (!naechster) return { geloescht, neu: [] };
  return { geloescht, neu: instanzAm(geloescht, alle, serie, tag, naechster, jetzt) };
}

/**
 * Morgenlauf, Teil Aufgaben: Serien ohne offene Instanz, deren letzte Instanz erledigt ist und deren nächster Termin
 * spätestens morgen liegt — eine Instanz je Serie. Liefert nur die NEUEN Aufgaben.
 */
export function serienAufgabenNachholen(tasks: readonly Task[], heute: string, jetzt: string): Task[] {
  const letzte = new Map<string, Task>();
  const zeit = (t: Task) => tagDer(t.dueDate) ?? tagDer(t.completedAt) ?? tagDer(t.createdAt) ?? '';
  // Die JÜNGSTE Instanz entscheidet (29.09., #29) — auch eine ohne `wiederholung` (dann ist die Serie beendet). Nur Serien,
  // in denen irgendeine Instanz je wiederholt hat, zählen.
  const mitSerie = new Set(tasks.filter(t => !t.parentId && t.wiederholung).map(serieVon));
  for (const t of tasks) {
    if (t.parentId || !mitSerie.has(serieVon(t))) continue;
    const s = serieVon(t);
    const l = letzte.get(s);
    if (!l || zeit(t) > zeit(l)) letzte.set(s, t);
  }
  const morgen = tagPlus(heute, 1);
  const neu: Task[] = [];
  for (const [serie, t] of Array.from(letzte.entries())) {
    if (!serieLaeuft(t) || offeneInstanz([...tasks, ...neu], serie)) continue;
    // Die jüngste Instanz liegt im Papierkorb: übersprungen („nur diese“, ihr Tag steht in `ausnahmen`) → weiter nach dem
    // Tag; sonst ruht die Serie — gelöscht heißt „nicht mehr“, nicht „die nächste bitte“.
    if (t.geloeschtAm) {
      const tag0 = tagDer(t.dueDate);
      if (!tag0 || !(t.wiederholung!.ausnahmen ?? []).includes(tag0)) continue;
      const tag = serienTermin(t.wiederholung!, tag0, heute);
      if (!tag || tag > morgen) continue;
      neu.push(...instanzAm(t, [...tasks, ...neu], serie, tag0, tag, jetzt));
      continue;
    }
    // Abgebrochen: keine Folgeinstanz (Kevin 29.09.).
    if (t.status !== 'done') continue;
    const tag = serienTermin(t.wiederholung!, basisTag(t, heute), heute);
    if (!tag || tag > morgen) continue;
    neu.push(...naechsteInstanz(t, [...tasks, ...neu], heute, jetzt));
  }
  return neu;
}

// ── Wiederkehrende Listen ──────────────────────────────────────────────────

/** Regeln mit kurzen Perioden: verpasste ältere werden übersprungen (nur die jüngste entsteht). */
const KURZ = new Set<Wiederholung['regel']>(['taeglich', 'werktage', 'woechentlich']);

/** Titel-Muster einer Serien-Liste: `titelMuster` der Liste, sonst Vorlagen-Titel mit Platzhalter, sonst Grundtitel + Standard je Regel. */
export function listenMuster(liste: Pick<AufgabenListe, 'titel' | 'titelMuster'>, w: Wiederholung, vorlage?: Pick<AufgabenVorlage, 'titel'>): string {
  if (liste.titelMuster?.trim()) return liste.titelMuster.trim();
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

  // Listen eines Projekts im Papierkorb (29.09.) wiederholen sich nicht — kommt das Projekt zurück, läuft die Serie weiter.
  const imKorb = new Set(state.projects.filter(p => p.geloeschtAm).map(p => p.id));
  for (const l of (state.listen ?? []).filter(x => x.wiederholung && !x.archiviert && !imKorb.has(x.projektId))) {
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
      ...(l.gruppeId ? { gruppeId: l.gruppeId } : {}), ...(l.vorlageId ? { vorlageId: l.vorlageId } : {}), ...(l.titelMuster ? { titelMuster: l.titelMuster } : {}),
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
    neueAufgaben.push(...aufgabenAusVorlage(inhalt, { spaceId, projectId: l.projektId, listeId: id, start: tag, praefix: id, owner, jetzt, ...(vorlage ? { vorlageId: vorlage.id, vorlageVersion: vorlage.version ?? 1, versatzArt: vorlage.inhalt.versatzArt } : {}), sortStart }));
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
