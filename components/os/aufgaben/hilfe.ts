'use client';
// ─── Aufgaben-Seite: kleine Helfer im Browser (28.09. abends) ───────────────
// Personen (aus dem Team, Namen nie im Code), die angemeldete Person, CRM-Verweise (einmal je Seite geladen),
// neue Kennungen und das Anlegen von Aufgaben/Projekten/Listen über den einen Aufgaben-Kontext.

import { useEffect, useMemo, useState, type Dispatch } from 'react';
import { useTeam } from '@/hooks/useTeam';
import { personLesen } from '@/lib/make-one/arbeitsplatz-browser';
import type { CrmVerweise } from '@/lib/aufgaben/crm-verweise';
import { einheitVonSpace, firmaVonSpace, sonstigeProjektId, istSonstigeProjekt, FESTE_SPACES, type AufgabenSpace } from '@/lib/aufgaben/struktur';
import type { Task, TasksState, AufgabeBezug, Project } from '@/types/tasks';
import type { Owner, Priority } from '@/types/common';
import type { AufgabenAktion } from '@/context/TasksContext';

export const neueKennung = (p: string): string => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export interface Person { speicher: string; name: string; namen: string[] }

/**
 * Die Personen des Haushalts mit Konto (aus dem Team, Namen nie im Code — Regel 11). Solange das Team nicht geladen ist
 * (oder ohne Konten), gelten die Speichernamen der beiden Konten, auf die `Owner` zeigt.
 */
export function usePersonen(): Person[] {
  const { team } = useTeam();
  return useMemo(() => {
    const konten = team.filter(p => p.quelle === 'konto' && p.speicher && p.aktiv !== false);
    const speicher = konten.length ? konten.map(p => p.speicher!) : ['kevin', 'malin'];
    return speicher.map(s => {
      const p = team.find(x => x.speicher === s);
      const vorname = (p?.name ?? '').trim().split(/\s+/)[0] || s.charAt(0).toUpperCase() + s.slice(1);
      return { speicher: s, name: vorname, namen: Array.from(new Set([vorname, p?.kurz ?? '', s].filter(Boolean))) };
    });
  }, [team]);
}

/** Die angemeldete Person (Speichername) — erst nach dem Laden bekannt. */
export function useIch(): string {
  const [ich, setIch] = useState('');
  useEffect(() => { setIch(personLesen()); }, []);
  return ich;
}

export const ownerLabel = (o: Owner | string, personen: readonly Person[]): string => (o === 'both' ? 'Beide' : personen.find(p => p.speicher === o)?.name ?? (o ? o.charAt(0).toUpperCase() + o.slice(1) : '—'));

// ── CRM-Verweise (einmal je Seite) ──────────────────────────────────────────
let ladung: Promise<CrmVerweise | null> | null = null;
export function useCrmVerweise(an = true): CrmVerweise | null {
  const [v, setV] = useState<CrmVerweise | null>(null);
  useEffect(() => {
    if (!an) return;
    let lebt = true;
    if (!ladung) ladung = fetch('/api/aufgaben/crm', { cache: 'no-store' }).then(r => (r.ok ? (r.json() as Promise<CrmVerweise>) : null)).catch(() => null);
    void ladung.then(d => { if (lebt) setV(d); if (!d) ladung = null; });
    return () => { lebt = false; };
  }, [an]);
  return v;
}

// ── Spaces ──────────────────────────────────────────────────────────────────
export const spacesOderFest = (s: readonly AufgabenSpace[]): AufgabenSpace[] => (s.length ? [...s] : [...FESTE_SPACES]);
export const spaceLabel = (spaces: readonly AufgabenSpace[], id: string | undefined): string => spacesOderFest(spaces).find(s => s.id === id)?.label ?? (id ?? '');

/** Projekte eines Space (ohne archivierte), alphabetisch — „Sonstige“ ist virtuell und kommt dazu. */
export function projekteImSpace(state: TasksState, spaceId: string): Project[] {
  return state.projects.filter(p => p.spaceId === spaceId && !p.archived).sort((a, b) => a.title.localeCompare(b.title, 'de'));
}
export const projektTitel = (state: TasksState, id: string | undefined): string => (!id || istSonstigeProjekt(id) ? 'Sonstige' : state.projects.find(p => p.id === id)?.title ?? 'Sonstige');
export const listeTitel = (state: TasksState, id: string | undefined): string => (id ? (state.listen ?? []).find(l => l.id === id)?.titel ?? 'Sonstige' : 'Sonstige');

// ── Anlegen ─────────────────────────────────────────────────────────────────
export interface Ziel { spaceId: string; projectId?: string; listeId?: string; parentId?: string }
export interface Neu { title: string; priority?: Priority; assignee?: Owner; dueDate?: string; bezug?: AufgabeBezug; description?: string }

/** Eine Aufgabe anlegen (Kennung vorab, damit die Seite sie gleich öffnen kann). In Mandanten-Spaces ist die Firma vorbelegt. */
export function aufgabeAnlegen(dispatch: Dispatch<AufgabenAktion>, state: TasksState, ziel: Ziel, neu: Neu): string {
  const id = neueKennung('t');
  const eltern = ziel.parentId ? state.tasks.find(t => t.id === ziel.parentId) : undefined;
  const spaceId = eltern?.spaceId ?? ziel.spaceId;
  const firmaId = firmaVonSpace(spaceId);
  const bezug: AufgabeBezug | undefined = neu.bezug ?? (firmaId ? { firmaId } : undefined);
  const imOrt = state.tasks.filter(t => t.spaceId === spaceId);
  const task: Omit<Task, 'createdAt' | 'updatedAt'> = {
    id, title: neu.title, description: neu.description ?? '', status: 'todo', priority: neu.priority ?? 'medium', assignee: neu.assignee ?? 'kevin',
    tags: [], subTasks: [], dependencies: [], sortOrder: imOrt.reduce((m, t) => Math.max(m, t.sortOrder ?? 0), -1) + 1,
    spaceId, projectId: eltern?.projectId ?? ziel.projectId ?? sonstigeProjektId(spaceId), space: spaceId === 'privat' ? 'privat' : 'business',
    ...(einheitVonSpace(spaceId) ? { einheit: einheitVonSpace(spaceId) } : {}),
    ...((eltern?.listeId ?? ziel.listeId) ? { listeId: eltern?.listeId ?? ziel.listeId } : {}),
    ...(eltern ? { parentId: eltern.id } : {}),
    ...(bezug ? { bezug } : {}),
    ...(neu.dueDate ? { dueDate: neu.dueDate } : {}),
  };
  dispatch({ type: 'ADD_TASK_MIT_ID', payload: task });
  return id;
}

export function projektAnlegen(dispatch: Dispatch<AufgabenAktion>, spaceId: string, titel: string, farbe: string): string {
  const id = neueKennung('p');
  dispatch({ type: 'ADD_PROJECT_MIT_ID', payload: { id, title: titel, category: spaceId === 'privat' ? 'joint' : 'business', owner: 'both', color: farbe, tags: [], archived: false, spaceId } });
  return id;
}

export function listeAnlegen(dispatch: Dispatch<AufgabenAktion>, state: TasksState, projektId: string, titel: string, gruppeId?: string): string {
  const id = neueKennung('l');
  const n = (state.listen ?? []).filter(l => l.projektId === projektId).reduce((m, l) => Math.max(m, l.sortOrder), -1) + 1;
  dispatch({ type: 'ADD_LISTE', payload: { id, projektId, titel, sortOrder: n, ...(gruppeId ? { gruppeId } : {}) } });
  return id;
}

/** Farben für Gruppen (Marketing, Sales, Operations …) — der Reihe nach vergeben. */
export const GRUPPEN_FARBEN = ['#FF7EB6', '#FF9F43', '#4FC3F7', '#3DE28B', '#C77DFF', '#FFC93C', '#58D9CD', '#8F86FF'] as const;

/** Eine Gruppe im Projekt anlegen (Farbe der Reihe nach). */
export function gruppeAnlegen(dispatch: Dispatch<AufgabenAktion>, state: TasksState, projektId: string, titel: string, farbe?: string): string {
  const id = neueKennung('g');
  const im = (state.gruppen ?? []).filter(g => g.projektId === projektId);
  const n = im.reduce((m, g) => Math.max(m, g.sortOrder), -1) + 1;
  dispatch({ type: 'ADD_GRUPPE', payload: { id, projektId, titel: titel.slice(0, 60), farbe: farbe ?? GRUPPEN_FARBEN[im.length % GRUPPEN_FARBEN.length], sortOrder: n } });
  return id;
}

/** Datum kurz: 2026-10-03 → 03.10. */
export const tagKurz = (d?: string): string => (d ? `${d.slice(8, 10)}.${d.slice(5, 7)}.` : '');
/** Zeitpunkt kurz: 03.10., 14:05 */
export const zeitKurz = (iso: string): string => { try { return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };

/**
 * Eine Aufgabe umziehen (Space/Projekt/Liste): anderer Space → Projekt „Sonstige“ dort (wenn das Projekt nicht dazugehört),
 * Liste nur, wenn sie zum Projekt gehört; Einheit folgt dem Space. Unteraufgaben ziehen mit (Kontext + Server).
 */
export function umzugTeil(state: TasksState, t: Task, ziel: { spaceId?: string; projectId?: string; listeId?: string | null }): Partial<Task> {
  const spaceId = ziel.spaceId ?? t.spaceId ?? 'privat';
  let projectId = ziel.projectId ?? t.projectId;
  const projekt = state.projects.find(p => p.id === projectId);
  if (spaceId !== t.spaceId && (!projekt || projekt.spaceId !== spaceId) && ziel.projectId === undefined) projectId = sonstigeProjektId(spaceId);
  if (istSonstigeProjekt(projectId)) projectId = sonstigeProjektId(spaceId);
  let listeId: string | undefined = ziel.listeId === null ? undefined : (ziel.listeId ?? t.listeId);
  if (listeId && (state.listen ?? []).find(l => l.id === listeId)?.projektId !== projectId) listeId = undefined;
  const statusFremd = spaceId !== t.spaceId && t.statusId;
  return {
    spaceId, projectId, listeId, space: spaceId === 'privat' ? 'privat' : 'business', einheit: einheitVonSpace(spaceId),
    ...(statusFremd ? { statusId: undefined } : {}),
  };
}
