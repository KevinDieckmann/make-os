// ─── MAKE OS — Aufgaben: Säuberung im Schreibweg (rein, 28.09. abends) ──────
// Eine Aufgabe von außen (Browser, ZOE, alte Fenster): nur bekannte Felder, Texte begrenzt. Listen werden NIE
// still gekürzt (CLAUDE.md „Nie abschneiden, ablehnen“) — wer über eine Grenze will, bekommt einen Fehlertext,
// die Route antwortet 413. Genutzt von /api/state/tasks und /api/tasks/create. Tests: tests/aufgaben-struktur.test.ts.

import type { Task, TaskStatus, AufgabeBezug, AufgabeKommentar, AufgabenListe, AufgabenStatus, Project, ProjectCategory } from '@/types/tasks';
import type { Owner, Priority } from '@/types/common';
import { istSpaceId, istSonstigeProjekt, TASK_STATUS } from './struktur';

/** Grenzen je Aufgabe/Bestand — darüber 413 mit Text. */
export const AUFGABEN_GRENZEN = {
  aufgaben: 20000,
  ops: 200,
  tags: 50,
  subTasks: 200,
  dependencies: 200,
  kommentare: 500,
  erwaehnt: 20,
  projekte: 1000,
  listen: 5000,
  status: 200,
} as const;

const PRIO: readonly Priority[] = ['low', 'medium', 'high', 'critical'];
const KENNUNG = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/;
const PERSON = /^[a-z0-9-]{1,40}$/;
const TAG = /^\d{4}-\d{2}-\d{2}$/;
const FARBE = /^#[0-9a-fA-F]{6}$/;
const S = (v: unknown, n: number) => (typeof v === 'string' ? v.replace(/\u0000/g, '').slice(0, n) : undefined);
const kennung = (v: unknown): string | undefined => (typeof v === 'string' && KENNUNG.test(v) ? v : undefined);

/** Fehler der Säuberung — die Route macht daraus 413. */
export class ZuGross extends Error {}
const zuViel = (liste: unknown, max: number, was: string) => {
  if (Array.isArray(liste) && liste.length > max) throw new ZuGross(`Abgelehnt: ${liste.length} ${was} an einer Aufgabe — höchstens ${max}. Nichts gespeichert.`);
};

/** CRM-Bezug: nur gültige Kennungen, leer → undefined. */
export function bezugSauber(v: unknown): AufgabeBezug | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  const b: AufgabeBezug = {};
  const k = kennung(o.kontaktId); if (k && /^c-/.test(k)) b.kontaktId = k;
  const f = kennung(o.firmaId); if (f && /^f-/.test(f)) b.firmaId = f;
  const m = kennung(o.mandatId); if (m) b.mandatId = m;
  const d = kennung(o.dealId); if (d) b.dealId = d;
  return Object.keys(b).length ? b : undefined;
}

/** Kommentare: Kennung, Person, Text (≤ 4000), Zeitpunkt, Erwähnte. Mehr als die Grenze → ZuGross. */
export function kommentareSauber(v: unknown): AufgabeKommentar[] | undefined {
  if (!Array.isArray(v)) return undefined;
  zuViel(v, AUFGABEN_GRENZEN.kommentare, 'Kommentare');
  const raus: AufgabeKommentar[] = [];
  for (const x of v as Record<string, unknown>[]) {
    if (!x || typeof x !== 'object') continue;
    const id = kennung(x.id), von = typeof x.von === 'string' && PERSON.test(x.von) ? x.von : undefined;
    const text = S(x.text, 4000)?.trim();
    if (!id || !von || !text) continue;
    zuViel(x.erwaehnt, AUFGABEN_GRENZEN.erwaehnt, 'Erwähnungen');
    const erwaehnt = Array.isArray(x.erwaehnt) ? Array.from(new Set(x.erwaehnt.filter((p): p is string => typeof p === 'string' && PERSON.test(p)))) : [];
    raus.push({ id, von, text, am: S(x.am, 40) ?? new Date().toISOString(), ...(erwaehnt.length ? { erwaehnt } : {}) });
  }
  return raus.length ? raus : undefined;
}

/**
 * Eine Aufgabe von außen säubern — null, wenn Kennung oder Titel fehlen; wirft `ZuGross` bei zu langen Listen.
 * `space`/`einheit` werden danach aus `spaceId` abgeleitet (lib/aufgaben/struktur.ts `uebernehmen`).
 */
export function taskSauber(o: unknown): Task | null {
  if (!o || typeof o !== 'object') return null;
  const t = o as Record<string, unknown>;
  const id = S(t.id, 80), title = S(t.title, 300)?.trim();
  if (!id || !title) return null;
  zuViel(t.tags, AUFGABEN_GRENZEN.tags, 'Schlagworte');
  zuViel(t.subTasks, AUFGABEN_GRENZEN.subTasks, 'Unteraufgaben (alt)');
  zuViel(t.dependencies, AUFGABEN_GRENZEN.dependencies, 'Abhängigkeiten');
  const jetzt = new Date().toISOString();
  const raus: Task = {
    id, title, projectId: S(t.projectId, 80) ?? '', description: S(t.description, 4000),
    status: TASK_STATUS.includes(t.status as TaskStatus) ? (t.status as TaskStatus) : 'todo',
    priority: PRIO.includes(t.priority as Priority) ? (t.priority as Priority) : 'medium',
    assignee: (S(t.assignee, 40) ?? 'kevin') as Owner,
    tags: Array.isArray(t.tags) ? (t.tags.map(x => String(x).slice(0, 40)) as unknown as Task['tags']) : [],
    dueDate: S(t.dueDate, 40), completedAt: S(t.completedAt, 40),
    // Space (26.09.): Abweichung vom Ort — nur privat|business, sonst weg (wird aus spaceId abgeleitet, wenn gesetzt).
    space: t.space === 'privat' || t.space === 'business' ? t.space : undefined,
    subTasks: Array.isArray(t.subTasks) ? (t.subTasks as Record<string, unknown>[]).filter(x => x && typeof x === 'object').map(x => ({ id: String(x.id ?? '').slice(0, 80), taskId: id, title: String(x.title ?? '').slice(0, 300), completed: x.completed === true, sortOrder: Number(x.sortOrder) || 0, createdAt: S(x.createdAt, 40) ?? jetzt, updatedAt: S(x.updatedAt, 40) ?? jetzt })) : [],
    dependencies: Array.isArray(t.dependencies) ? (t.dependencies as Record<string, unknown>[]).filter(x => x && typeof x === 'object' && typeof x.blockedByTaskId === 'string').map(x => ({ blockedByTaskId: String(x.blockedByTaskId).slice(0, 80), ...(typeof x.resolvedAt === 'string' ? { resolvedAt: x.resolvedAt.slice(0, 40) } : {}) })) : [],
    sortOrder: Number(t.sortOrder) || 0,
    createdAt: S(t.createdAt, 40) ?? jetzt, updatedAt: S(t.updatedAt, 40) ?? jetzt,
    einheit: S(t.einheit, 40),
    spaceId: istSpaceId(t.spaceId) ? t.spaceId : undefined,
    listeId: kennung(t.listeId),
    parentId: kennung(t.parentId),
    statusId: kennung(t.statusId),
    bezug: bezugSauber(t.bezug),
    kommentare: kommentareSauber(t.kommentare),
    startDate: typeof t.startDate === 'string' && TAG.test(t.startDate) ? t.startDate : undefined,
  };
  if (raus.parentId === id) delete raus.parentId;
  for (const k of Object.keys(raus) as (keyof Task)[]) if (raus[k] === undefined) delete raus[k];
  return raus;
}

const KATEGORIEN: readonly ProjectCategory[] = ['personal-malin', 'personal-kevin', 'joint', 'business'];
/** Ein Projekt von außen. Kennung, Titel und Space sind Pflicht (der Space entscheidet Privat/Business). */
export function projektSauber(o: unknown): Project | null {
  if (!o || typeof o !== 'object') return null;
  const p = o as Record<string, unknown>;
  const id = kennung(p.id), title = S(p.title, 120)?.trim();
  if (!id || !title || istSonstigeProjekt(id)) return null;
  const spaceId = istSpaceId(p.spaceId) ? p.spaceId : undefined;
  const jetzt = new Date().toISOString();
  const category = KATEGORIEN.includes(p.category as ProjectCategory) ? (p.category as ProjectCategory) : spaceId === 'privat' ? 'joint' : 'business';
  const raus: Project = {
    id, title, description: S(p.description, 2000), category, owner: (p.owner === 'malin' || p.owner === 'kevin' ? p.owner : 'both') as Owner,
    color: typeof p.color === 'string' && FARBE.test(p.color) ? p.color : '#58D9CD',
    tags: Array.isArray(p.tags) ? (p.tags.slice(0, AUFGABEN_GRENZEN.tags) as Project['tags']) : [],
    archived: p.archived === true, dueDate: typeof p.dueDate === 'string' && TAG.test(p.dueDate) ? p.dueDate : undefined,
    createdAt: S(p.createdAt, 40) ?? jetzt, updatedAt: S(p.updatedAt, 40) ?? jetzt, spaceId,
  };
  for (const k of Object.keys(raus) as (keyof Project)[]) if (raus[k] === undefined) delete raus[k];
  return raus;
}

/** Eine Liste im Projekt (Januar, Februar …). */
export function listeSauber(o: unknown): AufgabenListe | null {
  if (!o || typeof o !== 'object') return null;
  const l = o as Record<string, unknown>;
  const id = kennung(l.id), projektId = kennung(l.projektId), titel = S(l.titel, 80)?.trim();
  if (!id || !projektId || !titel) return null;
  return { id, projektId, titel, sortOrder: Number(l.sortOrder) || 0, ...(l.archiviert === true ? { archiviert: true } : {}) };
}

/** Ein eigener Status je Space: Name, Farbe, Grundstatus (Bedeutung). */
export function statusSauber(o: unknown): AufgabenStatus | null {
  if (!o || typeof o !== 'object') return null;
  const s = o as Record<string, unknown>;
  const id = kennung(s.id), label = S(s.label, 30)?.trim();
  if (!id || !label || !istSpaceId(s.spaceId) || TASK_STATUS.includes(id as TaskStatus)) return null;
  const basis = TASK_STATUS.includes(s.basis as TaskStatus) ? (s.basis as TaskStatus) : 'todo';
  return { id, spaceId: s.spaceId, label, farbe: typeof s.farbe === 'string' && FARBE.test(s.farbe) ? s.farbe : '#6E7A7D', basis, sortOrder: Number(s.sortOrder) || 0 };
}

/**
 * Kommentare zusammenführen (Server): Vorhandene bleiben so, wie sie gespeichert sind (niemand ändert fremde
 * Kommentare); neue tragen die schreibende Person und den Zeitpunkt des Servers; löschen darf man nur eigene.
 * Liefert auch die neu hinzugekommenen (für die Meldungen).
 */
export function kommentareVereinen(alt: readonly AufgabeKommentar[] | undefined, neu: readonly AufgabeKommentar[] | undefined, person: string | null, jetzt = new Date().toISOString()): { kommentare: AufgabeKommentar[] | undefined; neue: AufgabeKommentar[] } {
  const vorher = new Map((alt ?? []).map(k => [k.id, k]));
  const kommen = new Map((neu ?? []).map(k => [k.id, k]));
  const raus: AufgabeKommentar[] = [];
  const neue: AufgabeKommentar[] = [];
  for (const k of alt ?? []) {
    if (kommen.has(k.id) || !person || k.von !== person) raus.push(k); // bleibt (unverändert) — fremde nie löschen
  }
  for (const k of neu ?? []) {
    if (vorher.has(k.id) || !person) continue;
    const n: AufgabeKommentar = { ...k, von: person, am: jetzt };
    raus.push(n); neue.push(n);
  }
  raus.sort((a, b) => a.am.localeCompare(b.am));
  return { kommentare: raus.length ? raus : undefined, neue };
}
