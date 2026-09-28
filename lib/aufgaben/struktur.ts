// ─── MAKE OS — Aufgaben-Struktur wie Monday/ClickUp (28.09. abends) ─────────
// Kevin + Malin: „Ganz oben Privat oder Business, im Business die Firmen und die
// Mandanten, darin Projekte (Buchhaltung) → Listen (Januar, Februar) → Aufgaben →
// Unteraufgaben (der einzelne Beleg).“ Plan: AUFGABEN_PLAN.md.
//
// Hier steht alles REIN (client- und server-sicher, getestet in tests/aufgaben-struktur.test.ts):
//   · Spaces: fest `privat` · `kdc` · `kdv` · `ug`, Mandanten `m-<firmaId>` aus dem CRM (aktives Mandat),
//     sonst „Archiv“ — Aufgaben bleiben lesbar.
//   · Ableitung: `space`/`einheit` kommen aus `spaceId` (alle alten Leser verstehen weiter Privat/Business).
//   · Übernahme des Bestands (`uebernehmen`, idempotent, nie Verlust): Projekte und Aufgaben bekommen ihren
//     Space, alte `subTasks[]` werden echte Unteraufgaben, Unteraufgaben erben Space/Projekt/Liste.
//   · Baum: Projekt → Liste → Aufgabe → Unteraufgaben; ohne Projekt/Liste → „Sonstige“ (virtuell, nie gespeichert).
//   · Status: vier feste (Offen · In Arbeit · Wartend · Erledigt) + eigene je Space mit Grundstatus (`basis`).

import type { Task, TaskStatus, Project, TasksState, AufgabenListe, AufgabenStatus, AufgabenSpaceId } from '@/types/tasks';
import { einheitAusGesellschaft, FINANZ_ORTE, istFinanzOrt, istGesellschaft, finanzOrtAus } from '@/lib/einheiten';
import { EINHEIT_FARBE } from './einheit';
import { orgVon } from '@/lib/make-one/organisation-data';
import { spaceVonAufgabe, type SpaceId } from '@/lib/make-one/space-regeln';
import { abhaengigAngleichen } from './abhaengig';

// ── Spaces ─────────────────────────────────────────────────────────────────

export type SpaceArt = 'privat' | 'firma' | 'mandant';
export interface AufgabenSpace {
  id: AufgabenSpaceId;
  label: string;
  /** Privat oder Business — die alte Achse, die alle Leser kennen. */
  bereich: SpaceId;
  art: SpaceArt;
  /** Nur Mandanten: die CRM-Firma dahinter. */
  firmaId?: string;
  /** Mandat beendet (oder Firma nicht mehr im CRM) — der Space steht unter „Archiv“, Aufgaben bleiben lesbar. */
  archiv?: boolean;
  farbe: string;
}

export const MANDANT_PRAEFIX = 'm-';
/** Die Einheit, die Aufgaben in Mandanten-Spaces tragen (Standard-Werteliste lib/planung/einheiten.ts). */
export const MANDANT_EINHEIT = 'Kunden';
export const PRIVAT_FARBE = '#D9A45B';
export const MANDANT_FARBE = '#6E7EF5';

/** Die festen Spaces = die eine Liste aus lib/einheiten.ts (Privat · Selbstständigkeit · KD Ventures · MAKE OS UG). */
export const FESTE_SPACES: readonly AufgabenSpace[] = FINANZ_ORTE.map(o => (o.id === 'privat'
  ? { id: o.id, label: o.label, bereich: 'privat' as const, art: 'privat' as const, farbe: PRIVAT_FARBE }
  : { id: o.id, label: o.label, bereich: 'business' as const, art: 'firma' as const, farbe: EINHEIT_FARBE[o.id] }));

const MANDANT_ID = /^m-[a-z0-9][a-z0-9-]{1,63}$/;
export const istMandantSpace = (id: unknown): id is string => typeof id === 'string' && MANDANT_ID.test(id);
/** Gültige Space-Kennung (fest oder Mandant). */
export function istSpaceId(v: unknown): v is AufgabenSpaceId {
  return istFinanzOrt(v) || istMandantSpace(v);
}
export const mandantSpaceId = (firmaId: string): string => `${MANDANT_PRAEFIX}${firmaId}`;
export const firmaVonSpace = (id: string | undefined | null): string | undefined => (istMandantSpace(id) ? id.slice(MANDANT_PRAEFIX.length) : undefined);
export const bereichVonSpace = (id: string | undefined | null): SpaceId => (id === 'privat' ? 'privat' : 'business');

/** Die Einheit eines Space: Kerneinheit bzw. „Kunden“; Privat keine. */
export function einheitVonSpace(id: string | undefined | null): string | undefined {
  if (!id || id === 'privat') return undefined;
  if (istMandantSpace(id)) return MANDANT_EINHEIT;
  return einheitAusGesellschaft(id);
}

interface CrmTeil {
  firmen?: readonly { id: string; name: string }[];
  mandate?: readonly { id: string; firmaId?: string; kunde?: string; status?: string; titel?: string }[];
}

/**
 * Mandanten-Spaces aus dem CRM: jede Firma mit aktivem Mandat = ein Space (verknüpft mit der Firma).
 * Archiv: Firma ohne aktives, aber mit beendetem/pausiertem Mandat — und jeder Mandanten-Space, in dem noch
 * Aufgaben liegen, dessen Firma kein aktives Mandat (mehr) hat oder nicht mehr im CRM steht.
 */
export function mandantenSpaces(crm: CrmTeil | null | undefined, genutzt: readonly (string | undefined)[] = []): AufgabenSpace[] {
  const firmen = crm?.firmen ?? [];
  const mandate = crm?.mandate ?? [];
  const name = new Map(firmen.map(f => [f.id, f.name]));
  const aktiv = new Set<string>();
  const frueher = new Set<string>();
  for (const m of mandate) {
    if (!m.firmaId) continue;
    if (m.status === 'aktiv') aktiv.add(m.firmaId);
    else if (m.status === 'beendet' || m.status === 'pausiert') frueher.add(m.firmaId);
  }
  for (const s of genutzt) { const f = firmaVonSpace(s); if (f && !aktiv.has(f)) frueher.add(f); }
  const raus: AufgabenSpace[] = [];
  const bau = (firmaId: string, archiv: boolean): AufgabenSpace => {
    const kunde = mandate.find(m => m.firmaId === firmaId)?.kunde;
    const label = name.get(firmaId) ?? kunde ?? 'Mandant (nicht mehr im CRM)';
    return { id: mandantSpaceId(firmaId), label, bereich: 'business', art: 'mandant', firmaId, farbe: MANDANT_FARBE, ...(archiv ? { archiv: true } : {}) };
  };
  const sortiert = (ids: Iterable<string>) => Array.from(ids).filter(id => MANDANT_ID.test(mandantSpaceId(id))).sort((a, b) => (name.get(a) ?? a).localeCompare(name.get(b) ?? b, 'de'));
  for (const id of sortiert(aktiv)) raus.push(bau(id, false));
  for (const id of sortiert(frueher)) if (!aktiv.has(id)) raus.push(bau(id, true));
  return raus;
}

/** Alle Spaces: fest + Mandanten (aktiv, dann Archiv). */
export function alleSpaces(crm: CrmTeil | null | undefined, tasks: readonly { spaceId?: string }[] = []): AufgabenSpace[] {
  return [...FESTE_SPACES, ...mandantenSpaces(crm, tasks.map(t => t.spaceId))];
}

// ── Status ─────────────────────────────────────────────────────────────────

export interface StatusAnzeige { id: string; label: string; farbe: string; basis: TaskStatus; eigen: boolean }
/**
 * Die festen Status (Kevin 28.09.): Offen · In Arbeit · Wartend · Erledigt — seit 29.09. dazu „Abgebrochen“ (`cancelled`):
 * zählt nicht als erledigt, gibt Wartende nicht frei, keine Folgeinstanz. `backlog` zählt als Offen.
 */
export const GRUNDSTATUS: readonly StatusAnzeige[] = [
  { id: 'todo', label: 'Offen', farbe: '#6E7A7D', basis: 'todo', eigen: false },
  { id: 'in-progress', label: 'In Arbeit', farbe: '#4FC3F7', basis: 'in-progress', eigen: false },
  { id: 'blocked', label: 'Wartend', farbe: '#FFC93C', basis: 'blocked', eigen: false },
  { id: 'done', label: 'Erledigt', farbe: '#3DE28B', basis: 'done', eigen: false },
  { id: 'cancelled', label: 'Abgebrochen', farbe: '#8A8F98', basis: 'cancelled', eigen: false },
];
export const TASK_STATUS: readonly TaskStatus[] = ['backlog', 'todo', 'in-progress', 'blocked', 'done', 'cancelled'];
/** Erledigt ODER abgebrochen — nicht mehr offen (Listen, Kacheln, überfällig, Glocke, Serien). */
export const istAbgeschlossen = (t: Pick<Task, 'status'> | { status?: string }): boolean => t.status === 'done' || t.status === 'cancelled';
/** Noch zu tun: weder erledigt noch abgebrochen. */
export const istOffen = (t: Pick<Task, 'status'> | { status?: string }): boolean => !istAbgeschlossen(t);
/** Grundstatus zur Anzeige: backlog → Offen. */
export const grundVon = (s: TaskStatus | string | undefined): StatusAnzeige => GRUNDSTATUS.find(g => g.id === (s === 'backlog' ? 'todo' : s)) ?? GRUNDSTATUS[0];

/** Die Status eines Space in Reihenfolge: je Grundstatus erst der feste, dann die eigenen mit dieser Bedeutung. */
export function statusListe(spaceId: string | undefined, eigene: readonly AufgabenStatus[] = []): StatusAnzeige[] {
  const im = eigene.filter(s => s.spaceId === spaceId).sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, 'de'));
  const raus: StatusAnzeige[] = [];
  for (const g of GRUNDSTATUS) {
    raus.push(g);
    for (const s of im.filter(x => (x.basis === 'backlog' ? 'todo' : x.basis) === g.basis)) raus.push({ id: s.id, label: s.label, farbe: s.farbe, basis: s.basis, eigen: true });
  }
  return raus;
}

/** Status einer Aufgabe zur Anzeige: der eigene (wenn gesetzt und im Space), sonst der Grundstatus. */
export function statusVon(t: Pick<Task, 'status' | 'statusId' | 'spaceId'>, eigene: readonly AufgabenStatus[] = []): StatusAnzeige {
  const e = t.statusId ? eigene.find(s => s.id === t.statusId && s.spaceId === t.spaceId) : undefined;
  return e ? { id: e.id, label: e.label, farbe: e.farbe, basis: e.basis, eigen: true } : grundVon(t.status);
}

/**
 * Status setzen (fest oder eigen): `status` bekommt immer den Grundstatus — so verstehen alle Leser „erledigt“.
 * Liefert den Teil, der auf die Aufgabe gelegt wird (statusId `undefined` = entfernen).
 */
export function statusTeil(t: Pick<Task, 'status' | 'completedAt' | 'spaceId'>, id: string, eigene: readonly AufgabenStatus[] = [], jetzt = new Date().toISOString()): Pick<Task, 'status' | 'statusId' | 'completedAt'> {
  const e = eigene.find(s => s.id === id && s.spaceId === t.spaceId);
  const status: TaskStatus = e ? e.basis : (TASK_STATUS.includes(id as TaskStatus) ? (id as TaskStatus) : 'todo');
  const completedAt = status === 'done' ? (t.status === 'done' && t.completedAt ? t.completedAt : jetzt) : undefined;
  return { status, statusId: e ? e.id : undefined, completedAt };
}

// ── Sonstige ───────────────────────────────────────────────────────────────

/** „Sonstige“ ist virtuell: Projekt `sonstige-<space>` (nie gespeichert), Liste „Sonstige“ = keine Liste. */
export const SONSTIGE_PRAEFIX = 'sonstige-';
export const sonstigeProjektId = (spaceId: string): string => `${SONSTIGE_PRAEFIX}${spaceId}`;
export const istSonstigeProjekt = (id: string | undefined | null): boolean => !!id && id.startsWith(SONSTIGE_PRAEFIX) && istSpaceId(id.slice(SONSTIGE_PRAEFIX.length));
export const SONSTIGE_LISTE = '';

// ── Übernahme des Bestands (idempotent) ────────────────────────────────────

/** Space eines alten Projekts: persönlich/gemeinsam → Privat; Business → Selbstständigkeit (per Text) sonst KD Ventures. */
export function spaceFuerAltProjekt(p: Pick<Project, 'id' | 'title' | 'description' | 'category'>): AufgabenSpaceId {
  if (p.category !== 'business') return 'privat';
  const org = orgVon({ id: p.id, title: p.title, description: p.description, projectId: p.id });
  return org === 'kdc' ? 'kdc' : 'kdv';
}

/**
 * Space einer alten Aufgabe: Privat bleibt Privat (Abweichung `space` bzw. Ort); im Business gewinnt die Einheit
 * (Kerneinheit), dann die Selbstständigkeit per Ort, dann der Space des Projekts, sonst KD Ventures.
 */
export function spaceFuerAltAufgabe(t: Pick<Task, 'id' | 'title' | 'description' | 'projectId' | 'space' | 'einheit'>, projekt: Pick<Project, 'spaceId'> | undefined, orgs: Record<string, string> = {}): AufgabenSpaceId {
  if (spaceVonAufgabe(t, orgs) === 'privat') return 'privat';
  const g = finanzOrtAus(t.einheit);
  if (g && istGesellschaft(g)) return g;
  if (orgVon(t, orgs) === 'kdc') return 'kdc';
  if (projekt?.spaceId && projekt.spaceId !== 'privat') return projekt.spaceId;
  return 'kdv';
}

/**
 * Einheit zum Space: Kerneinheit bzw. „Kunden“. Eine eigene Einheit (nicht Kern, nicht „Kunden“) bleibt im
 * Business stehen — sie ist feiner als der Space (Zeit je Einheit zählt weiter darauf). Privat: keine.
 */
export function einheitFuer(spaceId: string, alt: string | undefined): string | undefined {
  if (spaceId === 'privat') return undefined;
  if (alt && !finanzOrtAus(alt) && alt.toLocaleLowerCase('de-DE') !== MANDANT_EINHEIT.toLocaleLowerCase('de-DE')) return alt;
  return einheitVonSpace(spaceId);
}

const kennungTeil = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 30) || 'x';
/** Kennung der aus `subTasks[]` übernommenen Unteraufgabe — stabil, damit die Übernahme idempotent ist. */
export const unteraufgabeId = (taskId: string, subId: string): string => `${taskId.slice(0, 48)}--${kennungTeil(subId)}`.slice(0, 80);

export interface UebernahmeErgebnis { state: TasksState; geaendert: boolean }

/**
 * Den Bestand in das neue Modell bringen — idempotent, nie Verlust:
 *  1. Projekte ohne gültigen Space bekommen ihn (`spaceFuerAltProjekt`).
 *  2. Aufgaben ohne gültigen Space bekommen ihn (`spaceFuerAltAufgabe`).
 *  3. Alte `subTasks[]` werden echte Unteraufgaben (`parentId`), die Liste am Elternteil wird leer.
 *  4. Unteraufgaben: eine Ebene (Enkel hängen am obersten Elternteil), sie erben Space/Projekt/Liste;
 *     fehlt das Elternteil, wird sie eine normale Aufgabe.
 *  5. Liste passt nicht zum Projekt → keine Liste („Sonstige“); eigener Status fehlt, liegt in einem anderen Space
 *     oder passt nicht zum Grundstatus (jemand hat `status` direkt gesetzt) → entfernt.
 *  6. `space`/`einheit` aus dem Space.
 *  7. (28.09. spät) Gruppen/Vorlagen sind Listen im Bestand; eine Liste mit Gruppe eines anderen Projekts (oder einer
 *     gelöschten) steht wieder direkt im Projekt; `abhaengigVon` führt, `dependencies` wird daraus abgeleitet,
 *     Verweise auf nicht mehr vorhandene Aufgaben fallen weg.
 */
export function uebernehmen(roh: TasksState, orgs: Record<string, string> = {}): UebernahmeErgebnis {
  let geaendert = false;
  const projects = (Array.isArray(roh.projects) ? roh.projects : []).map(p => {
    if (istSpaceId(p.spaceId)) return p;
    geaendert = true;
    return { ...p, spaceId: spaceFuerAltProjekt(p) };
  });
  const projektNach = new Map(projects.map(p => [p.id, p]));
  const gruppen = Array.isArray(roh.gruppen) ? roh.gruppen : [];
  const gruppeNach = new Map(gruppen.map(g => [g.id, g]));
  const listen = (Array.isArray(roh.listen) ? roh.listen : []).map(l => {
    if (!l.gruppeId) return l;
    const g = gruppeNach.get(l.gruppeId);
    if (g && g.projektId === l.projektId) return l;
    geaendert = true;
    const { gruppeId: _g, ...rest } = l;
    return rest;
  });
  const listeNach = new Map(listen.map(l => [l.id, l]));
  const statusEigen = Array.isArray(roh.statusEigen) ? roh.statusEigen : [];

  // 1–3: Space je Aufgabe, alte Unteraufgaben herauslösen.
  const alle: Task[] = [];
  const rohTasks = Array.isArray(roh.tasks) ? roh.tasks : [];
  const ids = new Set<string>(rohTasks.map(t => t.id));
  for (const t0 of rohTasks) {
    let t = t0;
    if (!istSpaceId(t.spaceId)) { t = { ...t, spaceId: spaceFuerAltAufgabe(t, projektNach.get(t.projectId), orgs) }; geaendert = true; }
    if (Array.isArray(t.subTasks) && t.subTasks.length) {
      for (const st of t.subTasks) {
        if (!st || typeof st !== 'object') continue;
        const id = unteraufgabeId(t.id, String(st.id ?? ''));
        if (ids.has(id)) continue; // schon übernommen
        ids.add(id);
        alle.push({
          id, projectId: t.projectId, title: String(st.title ?? '').trim() || 'Unteraufgabe', status: st.completed ? 'done' : 'todo',
          priority: 'medium', assignee: t.assignee, tags: [], subTasks: [], dependencies: [], sortOrder: Number(st.sortOrder) || 0,
          createdAt: st.createdAt ?? t.createdAt, updatedAt: st.updatedAt ?? t.updatedAt, parentId: t.id, spaceId: t.spaceId,
          ...(t.listeId ? { listeId: t.listeId } : {}), ...(st.completed ? { completedAt: st.updatedAt ?? t.updatedAt } : {}),
        });
      }
      t = { ...t, subTasks: [] };
      geaendert = true;
    }
    alle.push(t);
  }

  // 4–7: Unteraufgaben ordnen, Felder ableiten.
  const nachId = new Map(alle.map(t => [t.id, t]));
  const vorhanden = new Set(nachId.keys());
  const oberster = (t: Task): Task | undefined => {
    let p = t.parentId ? nachId.get(t.parentId) : undefined;
    const gesehen = new Set<string>([t.id]);
    while (p?.parentId && !gesehen.has(p.id)) { gesehen.add(p.id); const n = nachId.get(p.parentId); if (!n) break; p = n; }
    return p && p.id !== t.id ? p : undefined;
  };
  const tasks = alle.map(t0 => {
    let t = t0;
    const setze = (teil: Partial<Task>) => {
      const n = { ...t, ...teil };
      for (const k of Object.keys(teil) as (keyof Task)[]) if (teil[k] === undefined) delete n[k];
      if (JSON.stringify(n) !== JSON.stringify(t)) { t = n; geaendert = true; }
    };
    if (t.parentId) {
      const eltern = oberster(t);
      if (!eltern) setze({ parentId: undefined });
      else setze({ parentId: eltern.id, spaceId: eltern.spaceId, projectId: eltern.projectId, listeId: eltern.listeId });
    }
    const spaceId = t.spaceId as string;
    // Projekt „Sonstige“ eines anderen Space → Sonstige des eigenen.
    if (istSonstigeProjekt(t.projectId) && t.projectId !== sonstigeProjektId(spaceId)) setze({ projectId: sonstigeProjektId(spaceId) });
    if (!t.projectId) setze({ projectId: sonstigeProjektId(spaceId) });
    if (t.listeId) { const l = listeNach.get(t.listeId); if (!l || l.projektId !== t.projectId) setze({ listeId: undefined }); }
    if (t.statusId) {
      // Passt der Grundstatus nicht (mehr) zum eigenen Status, gewinnt `status` — den schreiben alle (Heads, Board,
      // Abhaken); der eigene Status fällt weg. Wer einen eigenen Status SETZT, setzt die basis mit (statusTeil / Schreibweg).
      const s = statusEigen.find(x => x.id === t.statusId && x.spaceId === spaceId);
      if (!s || (t.status === 'backlog' ? 'todo' : t.status) !== (s.basis === 'backlog' ? 'todo' : s.basis)) setze({ statusId: undefined });
    }
    const bereich = bereichVonSpace(spaceId);
    setze({ space: bereich, einheit: einheitFuer(spaceId, t.einheit) });
    // Serie (Paket C3): früher `vorlageId` „serie:<Anker>“ — jetzt `serieId`; die Herkunftsvorlage bleibt frei.
    if (t.vorlageId?.startsWith('serie:')) setze({ serieId: t.serieId ?? t.vorlageId.slice('serie:'.length), vorlageId: undefined });
    if (t.abhaengigVon?.length || t.dependencies?.length || !Array.isArray(t.dependencies)) {
      const a = abhaengigAngleichen(t, null, vorhanden);
      setze({ dependencies: a.dependencies, abhaengigVon: a.abhaengigVon });
    }
    return t;
  });
  const vorlagen = Array.isArray(roh.vorlagen) ? roh.vorlagen : [];
  const state: TasksState = { ...roh, projects, tasks, listen, statusEigen, gruppen, vorlagen };
  if (!Array.isArray(roh.listen) || !Array.isArray(roh.statusEigen) || !Array.isArray(roh.gruppen) || !Array.isArray(roh.vorlagen)) geaendert = true;
  return { state, geaendert };
}

/** Eine einzelne Aufgabe gegen den Bestand ableiten (Schreibweg, neue Aufgaben) — dieselben Regeln wie `uebernehmen`. */
export function aufgabeAbleiten(t: Task, state: TasksState, orgs: Record<string, string> = {}): Task {
  const r = uebernehmen({ ...state, tasks: [...state.tasks.filter(x => x.id !== t.id), t] }, orgs);
  return r.state.tasks.find(x => x.id === t.id) ?? t;
}

// ── Baum ───────────────────────────────────────────────────────────────────

export interface BaumAufgabe { task: Task; unter: Task[] }
export interface BaumListe { id: string; titel: string; virtuell: boolean; aufgaben: BaumAufgabe[]; offen: number; /** Gruppe im Projekt (28.09. spät) — fehlt = direkt im Projekt. */ gruppeId?: string }
/** Gruppe im Baum (28.09. spät): ihre Listen stehen in `BaumProjekt.listen` mit `gruppeId`. */
export interface BaumGruppe { id: string; titel: string; farbe: string; eingeklappt: boolean; offen: number }
export interface BaumProjekt {
  id: string; titel: string; farbe: string; virtuell: boolean; /** Projekt gehört zu einem anderen Space, trägt aber Aufgaben dieses Space. */ fremd: boolean;
  /** Alle Listen (auch die in Gruppen — `gruppeId`), dann „Sonstige“. */ listen: BaumListe[]; offen: number;
  /** Gruppen des Projekts in Reihenfolge (auch leere). */ gruppen: BaumGruppe[];
}

const nachReihe = (a: { sortOrder?: number; createdAt?: string }, b: { sortOrder?: number; createdAt?: string }) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? ''));

/**
 * Der Baum eines Space: Projekte (eigene, dann fremde mit Aufgaben hier, zuletzt „Sonstige“) → Listen (in
 * Reihenfolge, dann „Sonstige“) → Aufgaben → Unteraufgaben. `zeigen` filtert die Aufgaben; eine Aufgabe erscheint,
 * wenn sie selbst oder eine Unteraufgabe passt. Leere Listen/Projekte bleiben stehen (man legt sie ja zum Füllen an),
 * außer „Sonstige“ und fremde Projekte.
 */
export function baum(state: TasksState, spaceId: string, zeigen: (t: Task) => boolean = () => true, leereZeigen = true): BaumProjekt[] {
  const imSpace = state.tasks.filter(t => t.spaceId === spaceId);
  const kinder = new Map<string, Task[]>();
  for (const t of imSpace) if (t.parentId) kinder.set(t.parentId, [...(kinder.get(t.parentId) ?? []), t]);
  const oben = imSpace.filter(t => !t.parentId || !imSpace.some(x => x.id === t.parentId));
  const sichtbar = oben.filter(t => zeigen(t) || (kinder.get(t.id) ?? []).some(zeigen));
  const offen = (l: BaumAufgabe[]) => l.filter(a => a.task.status !== 'done').length;
  const projekte = state.projects.filter(p => p.spaceId === spaceId && !p.archived);
  const eigeneIds = new Set(projekte.map(p => p.id));
  const fremdeIds = new Set(sichtbar.map(t => t.projectId).filter(id => !eigeneIds.has(id) && state.projects.some(p => p.id === id)));
  const fremde = state.projects.filter(p => fremdeIds.has(p.id));
  const projektIds = new Set([...eigeneIds, ...fremdeIds]);
  const listenAlle = (state.listen ?? []).filter(l => !l.archiviert);

  const baueListen = (projektId: string, aufgaben: Task[]): BaumListe[] => {
    const eigene = listenAlle.filter(l => l.projektId === projektId).sort(nachReihe);
    const listenIds = new Set(eigene.map(l => l.id));
    const zu = (l: Task[]) => l.sort(nachReihe).map(task => ({ task, unter: (kinder.get(task.id) ?? []).sort(nachReihe) }));
    const gruppenIds = new Set((state.gruppen ?? []).filter(g => g.projektId === projektId).map(g => g.id));
    const raus: BaumListe[] = eigene.map(l => { const a = zu(aufgaben.filter(t => t.listeId === l.id)); return { id: l.id, titel: l.titel, virtuell: false, aufgaben: a, offen: offen(a), ...(l.gruppeId && gruppenIds.has(l.gruppeId) ? { gruppeId: l.gruppeId } : {}) }; });
    const rest = zu(aufgaben.filter(t => !t.listeId || !listenIds.has(t.listeId)));
    if (rest.length || !raus.length) raus.push({ id: SONSTIGE_LISTE, titel: 'Sonstige', virtuell: true, aufgaben: rest, offen: offen(rest) });
    return raus;
  };
  const gruppenVon = (projektId: string, listen: BaumListe[]): BaumGruppe[] => (state.gruppen ?? []).filter(g => g.projektId === projektId).sort(nachReihe)
    .map(g => ({ id: g.id, titel: g.titel, farbe: g.farbe, eingeklappt: !!g.eingeklappt, offen: listen.filter(l => l.gruppeId === g.id).reduce((s, l) => s + l.offen, 0) }));
  const raus: BaumProjekt[] = [];
  for (const p of [...projekte.sort((a, b) => a.title.localeCompare(b.title, 'de')), ...fremde]) {
    const listen = baueListen(p.id, sichtbar.filter(t => t.projectId === p.id));
    const n = listen.reduce((s, l) => s + l.offen, 0);
    const leer = listen.every(l => !l.aufgaben.length);
    if (leer && (fremdeIds.has(p.id) || !leereZeigen)) continue;
    raus.push({ id: p.id, titel: p.title, farbe: p.color, virtuell: false, fremd: fremdeIds.has(p.id), listen, offen: n, gruppen: fremdeIds.has(p.id) ? [] : gruppenVon(p.id, listen) });
  }
  const sonst = sichtbar.filter(t => !projektIds.has(t.projectId));
  const sid = sonstigeProjektId(spaceId);
  const sonstListen = (state.listen ?? []).some(l => l.projektId === sid && !l.archiviert);
  if (sonst.length || sonstListen || !raus.length) {
    const listen = baueListen(sid, sonst);
    raus.push({ id: sid, titel: 'Sonstige', farbe: '#6E7A7D', virtuell: true, fremd: false, listen, offen: listen.reduce((s, l) => s + l.offen, 0), gruppen: gruppenVon(sid, listen) });
  }
  return raus;
}

// ── Filter ─────────────────────────────────────────────────────────────────

export type FaelligFilter = 'alle' | 'ueberfaellig' | 'heute' | 'woche' | 'ohne';
export interface AufgabenFilter { wer: 'meine' | 'beteiligt' | 'alle'; ich?: string | null; status: 'offen' | 'alle' | string; faellig: FaelligFilter }
export const FILTER_STANDARD: AufgabenFilter = { wer: 'alle', status: 'offen', faellig: 'alle' };

const plusTage = (tag: string, n: number) => { const d = new Date(`${tag}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/** Passt eine Aufgabe zum Filter? `status` = „offen“ (nicht erledigt), „alle“ oder eine Status-Kennung (fest/eigen). */
export function passtFilter(t: Task, f: AufgabenFilter, heute: string): boolean {
  // „Meine“ = verantwortlich (29.09.); „beteiligt“ = unter den Beteiligten. Altbestand „both“ zählt bis zur Übernahme als meine.
  if (f.wer === 'meine' && f.ich && !(t.assignee === f.ich || t.assignee === 'both')) return false;
  if (f.wer === 'beteiligt' && f.ich && !(t.beteiligte ?? []).includes(f.ich)) return false;
  if (f.status === 'offen' && istAbgeschlossen(t)) return false;
  if (f.status !== 'offen' && f.status !== 'alle') {
    if (GRUNDSTATUS.some(g => g.id === f.status)) { if (t.statusId || grundVon(t.status).id !== f.status) return false; }
    else if (t.statusId !== f.status) return false;
  }
  const d = t.dueDate;
  switch (f.faellig) {
    case 'ueberfaellig': return !!d && d < heute && !istAbgeschlossen(t);
    case 'heute': return !!d && d <= heute;
    case 'woche': return !!d && d <= plusTage(heute, 7);
    case 'ohne': return !d;
    default: return true;
  }
}

// ── Kommentare / Erwähnungen ───────────────────────────────────────────────

/**
 * @-Erwähnungen aus einem Kommentar: `@kevin`, `@Malin`, auch der Vorname aus dem Team („@Kevin“).
 * `personen` = Speichername + Namen (Vorname, Kurzwort). Liefert Speichernamen, ohne Doppelte.
 */
export function erwaehnungen(text: string, personen: readonly { speicher: string; namen: readonly string[] }[]): string[] {
  const woerter = Array.from(String(text ?? '').matchAll(/(^|[\s(,;])@([\p{L}\p{N}_-]{2,40})/gu)).map(m => m[2].toLocaleLowerCase('de-DE'));
  const raus: string[] = [];
  for (const w of woerter) {
    const p = personen.find(x => x.speicher.toLocaleLowerCase('de-DE') === w || x.namen.some(n => n.toLocaleLowerCase('de-DE') === w));
    if (p && !raus.includes(p.speicher)) raus.push(p.speicher);
  }
  return raus;
}

/** Wer eine Aufgabe „hat“: Speichernamen aus `assignee` (both = beide Personen). */
export function zustaendigeVon(assignee: string | undefined, beide: readonly string[] = ['kevin', 'malin']): string[] {
  if (!assignee) return [];
  return assignee === 'both' ? [...beide] : [assignee];
}

/** Anzeige-Hilfe: Fortschritt der Unteraufgaben (erledigt/gesamt) — abgebrochene zählen weder als fertig noch mit (29.09.). */
export function fortschritt(unter: readonly Pick<Task, 'status'>[]): { fertig: number; gesamt: number } {
  const zaehlt = unter.filter(u => u.status !== 'cancelled');
  return { fertig: zaehlt.filter(u => u.status === 'done').length, gesamt: zaehlt.length };
}

export type { AufgabenListe, AufgabenStatus };
