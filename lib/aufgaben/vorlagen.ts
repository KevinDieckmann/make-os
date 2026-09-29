// ─── MAKE OS — Vorlagen für Projekte und Listen (rein, Paket C3, 28.09. spät) ─
// „Als Vorlage speichern“: aus einem Projekt (Gruppen, Listen, Aufgaben, Unteraufgaben, eigene Felder, Notiz) bzw.
// einer Liste NUR die Struktur — keine Verknüpfungen ins CRM (`bezug`), keine Kommentare, Dateien, Verlauf, ZOE,
// Feldwerte, Status. Deadlines werden zum Versatz in Tagen ab einem Bezugstag. Eine Vorlage DARF je Aufgabe Notiz und
// vorbelegte Feldwerte tragen (`VorlageAufgabe.notiz`/`felder`, z. B. Startvorlagen) — beim Anlegen werden sie übernommen.
// „Aus Vorlage anlegen“: Space/Projekt + Startdatum → Projekt/Gruppen/Listen/Aufgaben mit Deadline = Start + Versatz.
// Die Ergebnisse gehen im Browser über den Aufgaben-Kontext (Einzeländerungen mit Stand), serverseitig über den
// Morgenlauf der Serien (lib/aufgaben/serie.ts). Tests: tests/aufgaben-serie.test.ts.
// 29.09. (#69/#70): Listen zeigen per `gruppeIndex` auf ihre Gruppe (gleichnamige Gruppen fallen nicht mehr zusammen);
// Versatz optional in Werktagen ohne Feiertage NRW (`versatzArt: 'werktage'`, Start auf dem nächsten Werktag); Vorlagen
// tragen `version`, angelegte Aufgaben/Projekte `vorlageVersion`.

import type { Task, TasksState, Project, AufgabenListe, AufgabenGruppe, AufgabenVorlage, VorlageAufgabe, VorlageInhalt } from '@/types/tasks';
import type { Owner } from '@/types/common';
import { AUFGABEN_GRENZEN } from './saeubern';
import { bereichVonSpace, einheitVonSpace, firmaVonSpace, istSonstigeProjekt, sonstigeProjektId, SONSTIGE_PRAEFIX, nachReihe } from './struktur';
import { istTag, tagPlus, tageZwischen, titelMitPlatzhaltern } from './wiederholung';
import { istWerktag, werktagAbOder, werktagePlus } from './feiertage';
import { STARTVORLAGEN } from './vorlagen-start';

export { STARTVORLAGEN };

const OWNER: readonly string[] = ['kevin', 'malin', 'both'];
const GRUPPEN_FARBEN = ['#E27FD0', '#6E7EF5', '#58D9CD', '#FFC93C', '#3DE28B', '#FF8A5C'];
// Reihenfolge (sortOrder, createdAt, id) — eine Regel, lib/aufgaben/struktur.ts (#56, 29.09.).
const tagDer = (d: string | undefined): string | undefined => (d && istTag(d.slice(0, 10)) ? d.slice(0, 10) : undefined);

/** Werktage (Mo–Fr ohne Feiertage NRW) von `a` bis `b` — wie `werktagePlus` rückwärts: werktagePlus(a, n) = b. */
export function werktageZwischen(a: string, b: string): number {
  if (a === b) return 0;
  const r = b > a ? 1 : -1;
  let n = 0, d = a;
  for (let i = 0; i < 4000 && (r > 0 ? d < b : d > b); i++) { d = tagPlus(d, r); if (istWerktag(d, 'NRW')) n += r; }
  return n;
}
/** Deadline aus Start + Versatz — in Kalendertagen oder Werktagen (ab dem nächsten Werktag am/nach dem Start). */
export function deadlineAus(start: string, versatz: number, art: VorlageInhalt['versatzArt']): string {
  return art === 'werktage' ? werktagePlus(werktagAbOder(start, 'NRW'), versatz, 'NRW') : tagPlus(start, versatz);
}

// ── Finden ─────────────────────────────────────────────────────────────────

/** Eigene Vorlagen des Bestands + die mitgelieferten (eigene zuerst, gleiche Kennung gewinnt die eigene). */
export function alleVorlagen(eigene: readonly AufgabenVorlage[] | undefined): AufgabenVorlage[] {
  const e = eigene ?? [];
  return [...e, ...STARTVORLAGEN.filter(s => !e.some(x => x.id === s.id))];
}
export const vorlageFinden = (eigene: readonly AufgabenVorlage[] | undefined, id: string | undefined): AufgabenVorlage | undefined => (id ? alleVorlagen(eigene).find(v => v.id === id) : undefined);
export const istStartvorlage = (id: string): boolean => STARTVORLAGEN.some(v => v.id === id);

/** Vorlagen einer Art für einen Space: ohne Space-Bindung überall, sonst nur dort. */
export function vorlagenFuer(eigene: readonly AufgabenVorlage[] | undefined, art: AufgabenVorlage['art'], spaceId?: string): AufgabenVorlage[] {
  return alleVorlagen(eigene).filter(v => v.art === art && (!v.spaceId || !spaceId || v.spaceId === spaceId));
}

/** Kennzahlen einer Vorlage (Vorschau im Dialog). */
export function vorlageUmfang(v: Pick<AufgabenVorlage, 'inhalt'>): { gruppen: number; listen: number; aufgaben: number; unter: number; letzterVersatz: number | null } {
  const alle = [...(v.inhalt.aufgaben ?? []), ...(v.inhalt.listen ?? []).flatMap(l => l.aufgaben)];
  const unter = alle.reduce((s, a) => s + (a.unter?.length ?? 0), 0);
  const versatz = [...alle, ...alle.flatMap(a => a.unter ?? [])].map(a => a.versatzTage).filter((x): x is number => typeof x === 'number');
  return { gruppen: v.inhalt.gruppen?.length ?? 0, listen: v.inhalt.listen?.length ?? 0, aufgaben: alle.length, unter, letzterVersatz: versatz.length ? Math.max(...versatz) : null };
}

/** Passt die Vorlage unter die Grenzen des Servers (sonst 413)? Liefert den Grund oder null. */
export function vorlageZuGross(v: Pick<AufgabenVorlage, 'inhalt'>): string | null {
  const u = vorlageUmfang(v);
  if (u.aufgaben + u.unter > AUFGABEN_GRENZEN.vorlageAufgaben) return `Zu groß: ${u.aufgaben + u.unter} Aufgaben — eine Vorlage fasst höchstens ${AUFGABEN_GRENZEN.vorlageAufgaben}.`;
  const zeichen = JSON.stringify(v.inhalt).length;
  if (zeichen > AUFGABEN_GRENZEN.vorlageZeichen) return `Zu groß: ${zeichen} Zeichen — höchstens ${AUFGABEN_GRENZEN.vorlageZeichen}.`;
  return null;
}

// ── Als Vorlage speichern ──────────────────────────────────────────────────

/** Bezugstag für den Versatz: frühester Start/Deadline der Aufgaben (oder `rueckfall`). */
export function bezugsTagVon(tasks: readonly Pick<Task, 'startDate' | 'dueDate'>[], rueckfall?: string): string | undefined {
  const tage = tasks.flatMap(t => [tagDer(t.startDate), tagDer(t.dueDate)]).filter((x): x is string => !!x).sort();
  return tage[0] ?? rueckfall;
}

function alsVorlageAufgabe(t: Task, kinder: Map<string, Task[]>, bezug: string | undefined, tiefe: number, werktage = false): VorlageAufgabe {
  const r: VorlageAufgabe = { titel: t.title };
  const b = (t.description ?? '').trim();
  if (b) r.beschreibung = b.slice(0, 4000);
  if (t.priority && t.priority !== 'medium') r.prioritaet = t.priority;
  if (OWNER.includes(t.assignee)) r.zustaendig = t.assignee;
  const due = tagDer(t.dueDate);
  if (bezug && due) { const v = werktage ? werktageZwischen(werktagAbOder(bezug, 'NRW'), due) : tageZwischen(bezug, due); if (Math.abs(v) <= 3650) r.versatzTage = v; }
  if (tiefe === 0) {
    const u = (kinder.get(t.id) ?? []).sort(nachReihe).map(k => alsVorlageAufgabe(k, kinder, bezug, 1, werktage));
    if (u.length) r.unter = u;
  }
  return r;
}

function kinderVon(tasks: readonly Task[]): Map<string, Task[]> {
  const m = new Map<string, Task[]>();
  for (const t of tasks) if (t.parentId) m.set(t.parentId, [...(m.get(t.parentId) ?? []), t]);
  return m;
}

export interface SpeichernOptionen { id: string; titel?: string; bezugsTag?: string; spaceId?: string; jetzt?: string; /** Versatz in Werktagen ohne Feiertage NRW (#70). */ werktage?: boolean }

/** Ein Projekt als Vorlage (Struktur): Gruppen, Listen (nicht archiviert), Aufgaben + Unteraufgaben, Felder, Notiz. */
export function vorlageAusProjekt(state: TasksState, projektId: string, o: SpeichernOptionen): AufgabenVorlage | null {
  const p = state.projects.find(x => x.id === projektId);
  if (!p) return null;
  const tasks = state.tasks.filter(t => t.projectId === p.id);
  const kinder = kinderVon(tasks);
  const oben = tasks.filter(t => !t.parentId || !tasks.some(x => x.id === t.parentId)).sort(nachReihe);
  const bezug = o.bezugsTag ?? tagDer(p.start) ?? bezugsTagVon(tasks);
  const gruppen = (state.gruppen ?? []).filter(g => g.projektId === p.id).sort(nachReihe);
  const listen = (state.listen ?? []).filter(l => l.projektId === p.id && !l.archiviert).sort(nachReihe);
  const listenIds = new Set(listen.map(l => l.id));
  const inhalt: VorlageInhalt = {};
  if (gruppen.length) inhalt.gruppen = gruppen.map(g => ({ titel: g.titel, farbe: g.farbe }));
  if (o.werktage) inhalt.versatzArt = 'werktage';
  if (listen.length) inhalt.listen = listen.map(l => {
    const gi = l.gruppeId ? gruppen.findIndex(x => x.id === l.gruppeId) : -1;
    return { titel: l.titel, ...(gi >= 0 ? { gruppe: gruppen[gi].titel, gruppeIndex: gi } : {}), aufgaben: oben.filter(t => t.listeId === l.id).map(t => alsVorlageAufgabe(t, kinder, bezug, 0, o.werktage)) };
  });
  const ohneListe = oben.filter(t => !t.listeId || !listenIds.has(t.listeId)).map(t => alsVorlageAufgabe(t, kinder, bezug, 0, o.werktage));
  if (ohneListe.length) inhalt.aufgaben = ohneListe;
  if (p.felder?.length) inhalt.felder = p.felder.map(f => ({ ...f, ...(f.optionen ? { optionen: [...f.optionen] } : {}) }));
  if (p.notiz?.trim()) inhalt.notiz = p.notiz;
  return { id: o.id, art: 'projekt', titel: (o.titel ?? p.title).trim().slice(0, 120) || p.title, inhalt, ...(o.spaceId ? { spaceId: o.spaceId } : {}), angelegt: o.jetzt ?? new Date().toISOString(), version: 1 };
}

/** Eine Liste als Vorlage: ihre Aufgaben + Unteraufgaben (Versatz ab `bezugsTag`, sonst ab der frühesten Deadline). */
export function vorlageAusListe(state: TasksState, listeId: string, o: SpeichernOptionen): AufgabenVorlage | null {
  const l = (state.listen ?? []).find(x => x.id === listeId);
  if (!l) return null;
  const inListe = state.tasks.filter(t => t.listeId === l.id && t.projectId === l.projektId);
  const kinder = kinderVon(state.tasks.filter(t => t.projectId === l.projektId));
  const oben = inListe.filter(t => !t.parentId).sort(nachReihe);
  const bezug = o.bezugsTag ?? bezugsTagVon([...oben, ...oben.flatMap(t => kinder.get(t.id) ?? [])]);
  const aufgaben = oben.map(t => alsVorlageAufgabe(t, kinder, bezug, 0, o.werktage));
  return { id: o.id, art: 'liste', titel: (o.titel ?? l.titel).trim().slice(0, 120) || l.titel, inhalt: aufgaben.length ? { aufgaben, ...(o.werktage ? { versatzArt: 'werktage' as const } : {}) } : {}, ...(o.spaceId ? { spaceId: o.spaceId } : {}), angelegt: o.jetzt ?? new Date().toISOString(), version: 1 };
}

// ── Aus Vorlage anlegen ────────────────────────────────────────────────────

export interface AufgabenZiel {
  spaceId: string;
  projectId: string;
  listeId?: string;
  /** Startdatum (YYYY-MM-DD) — Deadline = Start + Versatz. Ohne Start keine Deadlines. */
  start?: string;
  /** Kennungs-Präfix: Aufgaben `<praefix>-a<n>`, Unteraufgaben `<praefix>-a<n>-u<m>` (deterministisch → idempotent). */
  praefix: string;
  /** Zuständig, wenn die Vorlage niemanden nennt. */
  owner: Owner;
  jetzt: string;
  vorlageId?: string;
  sortStart?: number;
  /** Versatz in Werktagen (NRW) statt Kalendertagen (#70). */
  versatzArt?: VorlageInhalt['versatzArt'];
  /** Fassung der Vorlage (#70). */
  vorlageVersion?: number;
}

/** Aufgaben (mit Unteraufgaben) aus Vorlage-Aufgaben. In Mandanten-Spaces ist die Firma vorbelegt (wie beim Anlegen). */
export function aufgabenAusVorlage(liste: readonly VorlageAufgabe[], z: AufgabenZiel): Task[] {
  const raus: Task[] = [];
  const firmaId = firmaVonSpace(z.spaceId);
  const einheit = einheitVonSpace(z.spaceId);
  const basis = (a: VorlageAufgabe, id: string, sortOrder: number): Task => ({
    id, projectId: z.projectId, title: a.titel.slice(0, 300), status: 'todo', priority: a.prioritaet ?? 'medium',
    assignee: (a.zustaendig && OWNER.includes(a.zustaendig) ? a.zustaendig : z.owner) as Owner,
    tags: [], subTasks: [], dependencies: [], sortOrder, createdAt: z.jetzt, updatedAt: z.jetzt,
    spaceId: z.spaceId, space: bereichVonSpace(z.spaceId),
    ...(einheit ? { einheit } : {}),
    ...(z.listeId ? { listeId: z.listeId } : {}),
    ...(a.beschreibung ? { description: a.beschreibung } : {}),
    ...(a.notiz ? { notiz: a.notiz } : {}),
    ...(a.felder && Object.keys(a.felder).length ? { felder: { ...a.felder } } : {}),
    ...(z.start && typeof a.versatzTage === 'number' ? { dueDate: deadlineAus(z.start, a.versatzTage, z.versatzArt) } : {}),
    ...(firmaId ? { bezug: { firmaId } } : {}),
    ...(z.vorlageId ? { vorlageId: z.vorlageId } : {}),
    ...(z.vorlageId && z.vorlageVersion ? { vorlageVersion: z.vorlageVersion } : {}),
  });
  liste.forEach((a, i) => {
    const id = `${z.praefix}-a${i + 1}`;
    raus.push(basis(a, id, (z.sortStart ?? 0) + i));
    (a.unter ?? []).forEach((u, k) => raus.push({ ...basis(u, `${id}-u${k + 1}`, k), parentId: id }));
  });
  return raus;
}

export interface AnlageZiel {
  spaceId: string;
  /** Nur Listen-Vorlagen: das Projekt (fehlt = „Sonstige“ des Space). */
  projektId?: string;
  gruppeId?: string;
  start?: string;
  /** Titel des neuen Projekts bzw. der neuen Liste (Platzhalter {Monat} … werden zum Start ausgefüllt). */
  titel?: string;
  owner: Owner;
  /** Kennung des neuen Projekts bzw. der neuen Liste — daraus leiten sich alle weiteren ab. */
  praefix: string;
  jetzt: string;
  farbe?: string;
}
export interface AnlageErgebnis { projekt?: Project; gruppen: AufgabenGruppe[]; listen: AufgabenListe[]; tasks: Task[] }

/** Aus einer Vorlage anlegen (rein): Projekt-Vorlage → neues Projekt im Space; Listen-Vorlage → neue Liste im Projekt. */
export function ausVorlageAnlegen(v: AufgabenVorlage, state: TasksState, z: AnlageZiel): AnlageErgebnis {
  const start = z.start && istTag(z.start) ? z.start : undefined;
  const titel = titelMitPlatzhaltern((z.titel ?? v.titel).trim() || v.titel, start ?? '');
  if (v.art === 'liste') {
    const projektId = z.projektId && (state.projects.some(p => p.id === z.projektId) || istSonstigeProjekt(z.projektId)) ? z.projektId : sonstigeProjektId(z.spaceId);
    const spaceId = state.projects.find(p => p.id === projektId)?.spaceId ?? (istSonstigeProjekt(projektId) ? projektId.slice(SONSTIGE_PRAEFIX.length) : z.spaceId);
    const gruppe = z.gruppeId ? (state.gruppen ?? []).find(g => g.id === z.gruppeId && g.projektId === projektId) : undefined;
    const sortOrder = (state.listen ?? []).filter(l => l.projektId === projektId).reduce((m, l) => Math.max(m, l.sortOrder), -1) + 1;
    const liste: AufgabenListe = { id: z.praefix, projektId, titel: titel.slice(0, 80), sortOrder, ...(gruppe ? { gruppeId: gruppe.id } : {}) };
    const tasks = aufgabenAusVorlage(v.inhalt.aufgaben ?? [], { spaceId, projectId: projektId, listeId: liste.id, start, praefix: z.praefix, owner: z.owner, jetzt: z.jetzt, vorlageId: v.id, versatzArt: v.inhalt.versatzArt, vorlageVersion: v.version ?? 1 });
    return { gruppen: [], listen: [liste], tasks };
  }
  const projektId = z.praefix;
  const projekt: Project = {
    id: projektId, title: titel.slice(0, 120), category: z.spaceId === 'privat' ? 'joint' : 'business', owner: 'both', color: z.farbe ?? '#58D9CD',
    tags: [], archived: false, spaceId: z.spaceId, createdAt: z.jetzt, updatedAt: z.jetzt, status: 'aktiv', vorlageId: v.id, vorlageVersion: v.version ?? 1,
    ...(start ? { start } : {}),
    ...(v.inhalt.notiz ? { notiz: v.inhalt.notiz } : {}),
    ...(v.inhalt.felder?.length ? { felder: v.inhalt.felder.map(f => ({ ...f, ...(f.optionen ? { optionen: [...f.optionen] } : {}) })) } : {}),
  };
  const gruppen: AufgabenGruppe[] = (v.inhalt.gruppen ?? []).map((g, i) => ({ id: `${projektId}-g${i + 1}`, projektId, titel: g.titel.slice(0, 60), farbe: g.farbe ?? GRUPPEN_FARBEN[i % GRUPPEN_FARBEN.length], sortOrder: i }));
  const listen: AufgabenListe[] = [];
  const tasks: Task[] = [];
  (v.inhalt.listen ?? []).forEach((l, i) => {
    // Gruppe per Index (#69) — Titel nur noch für Vorlagen von vor dem 29.09.
    const g = typeof l.gruppeIndex === 'number' && gruppen[l.gruppeIndex] ? gruppen[l.gruppeIndex] : l.gruppe ? gruppen.find(x => x.titel === l.gruppe) : undefined;
    const liste: AufgabenListe = { id: `${projektId}-l${i + 1}`, projektId, titel: titelMitPlatzhaltern(l.titel, start ?? '').slice(0, 80), sortOrder: i, ...(g ? { gruppeId: g.id } : {}) };
    listen.push(liste);
    tasks.push(...aufgabenAusVorlage(l.aufgaben, { spaceId: z.spaceId, projectId: projektId, listeId: liste.id, start, praefix: liste.id, owner: z.owner, jetzt: z.jetzt, vorlageId: v.id, versatzArt: v.inhalt.versatzArt, vorlageVersion: v.version ?? 1 }));
  });
  tasks.push(...aufgabenAusVorlage(v.inhalt.aufgaben ?? [], { spaceId: z.spaceId, projectId: projektId, start, praefix: `${projektId}-s`, owner: z.owner, jetzt: z.jetzt, vorlageId: v.id, sortStart: tasks.length, versatzArt: v.inhalt.versatzArt, vorlageVersion: v.version ?? 1 }));
  return { projekt, gruppen, listen, tasks };
}
