// ─── ZOE an Aufgaben (Paket C4, 28.09. spät) — die reinen Regeln ────────────
// Kevin: „ZOE soll ihre eigenen Aufgaben und Stapel bekommen, die sie abarbeiten kann und wir freigeben.“
// Entscheidung: ZOE bereitet vor, ihr gebt frei; nach außen schickt sie nichts.
//
// Ablauf (Task.zoe.status): — → offen („An ZOE geben“) → in_arbeit (Lauf) → wartet_freigabe (Vorschlag im Stapel)
//   → freigegeben (Klick übernimmt) | abgelehnt (optional Grund; „nochmal“ → wieder offen, mit Hinweis).
// Auftraggeberin = `zoe.von` (seit 28.09. spät; Altbestand: Verlauf-Eintrag „zoe → offen“ ohne `durch`); sie gibt frei.
// Hinweis an ZOE = `zoe.hinweis` (Altbestand: Kommentar „Hinweis an ZOE: …“).
// `assignee` bleibt, wie es war. Diese Datei hat weder Platte noch Netz — Browser und Server nutzen sie
// (Filter für die Sicht „ZOE“ und die Überblick-Kachel, Säuberung der Modell-Antwort, Übernahme bei Freigabe).

import type { Task, TasksState, ZoeStatus, AufgabenStatus, TaskStatus } from '@/types/tasks';
import { statusTeil, grundVon } from './struktur';

export const ZOE_STATUS_LABEL: Record<ZoeStatus, string> = {
  offen: 'bei ZOE', in_arbeit: 'ZOE arbeitet', wartet_freigabe: 'wartet auf Freigabe', freigegeben: 'freigegeben', abgelehnt: 'abgelehnt',
};
/** Kennung dieser Vorschläge im Freigabe-Stapel (`Vorschlag.werkzeug`) — bewusst KEIN ausführbares Werkzeug: übernommen
 *  wird über die Stapel-Art „aufgabe“ (lib/zoe/stapel-arten.ts → lib/zoe/aufgaben-werkzeuge.ts). */
export const ZOE_AUFGABE_WERKZEUG = 'aufgabe_uebernehmen';
/** Kommentare, die die Auftraggeberin ZOE mitgibt, beginnen so. */
export const ZOE_HINWEIS = 'Hinweis an ZOE:';
/** „In Arbeit“ länger als das (abgebrochener Lauf) → wieder offen für den nächsten Lauf. */
export const ZOE_HAENGT_MIN = 30;

/** Grenzen der Vorschläge — die Modell-Antwort wird darauf gesäubert (Stapel bleibt klein, Notiz-Grenze 50 000). */
export const ZOE_VORSCHLAG_GRENZEN = { entwurf: 12_000, zusammenfassung: 600, begruendung: 600, unteraufgaben: 8, unteraufgabeTitel: 200, hinweis: 1000 } as const;

/** Was ZOE je Aufgabe vorschlagen darf — nur das. Kein Versand, kein Löschen, keine anderen Aufgaben. */
export interface ZoeVorschlagInhalt {
  aufgabeId: string;
  /** Ein bis zwei Sätze: was ZOE vorbereitet hat. */
  zusammenfassung: string;
  /** Entwurf / Recherche-Notiz (Markdown-Teilmenge) — wird bei Freigabe an die Notiz angehängt. */
  entwurf?: string;
  /** Vorgeschlagene Unteraufgaben (Titel). */
  unteraufgaben?: string[];
  /** Vorgeschlagener Grundstatus. */
  status?: Exclude<TaskStatus, 'backlog'>;
  /** Vorgeschlagene Deadline (YYYY-MM-DD). */
  deadline?: string;
  /** Warum — ZOEs eigener Satz. */
  begruendung?: string;
}

export interface ZoeSicht {
  alle: Task[];
  offen: Task[];
  inArbeit: Task[];
  wartet: Task[];
  freigegeben: Task[];
  abgelehnt: Task[];
}

const TAG = /^\d{4}-\d{2}-\d{2}$/;
const VORSCHLAG_STATUS: readonly Exclude<TaskStatus, 'backlog'>[] = ['todo', 'in-progress', 'blocked', 'done'];

/** Die Kurzwerte, die lib/aufgaben/verlauf.ts in den Verlauf schreibt (ZOE_LABEL dort). */
export const ZOE_STATUS_LABEL_VERLAUF: Record<ZoeStatus, string> = { offen: 'offen', in_arbeit: 'in Arbeit', wartet_freigabe: 'wartet auf Freigabe', freigegeben: 'freigegeben', abgelehnt: 'abgelehnt' };

/** Wer gab die Aufgabe an ZOE? Der letzte Verlauf-Eintrag „ZOE → offen“ (ZOE schreibt immer im Namen der Auftraggeberin, nie ein Systemlauf). */
export function auftraggeberinVon(t: Pick<Task, 'verlauf' | 'zoe'>): string | null {
  if (!t.zoe) return null;
  if (t.zoe.von) return t.zoe.von;
  const v = t.verlauf ?? [];
  for (let i = v.length - 1; i >= 0; i--) {
    const e = v[i];
    if (e.was === 'zoe' && e.nachher === ZOE_STATUS_LABEL_VERLAUF.offen && e.durch !== 'system') return e.von;
  }
  return null;
}

/** Zeitpunkt, seit dem die Aufgabe im aktuellen ZOE-Status steht (letzter „zoe“-Eintrag im Verlauf). */
export function zoeSeit(t: Pick<Task, 'verlauf'>): string | null {
  const v = t.verlauf ?? [];
  for (let i = v.length - 1; i >= 0; i--) if (v[i].was === 'zoe') return v[i].am;
  return null;
}

/**
 * Die ZOE-Aufgaben eines Bestands, nach ZOE-Status — für die Sicht „ZOE“ und die Überblick-Kachel
 * („wartet auf Freigabe“ = `wartet.length`). Mit `auftraggeberin` nur die, die diese Person an ZOE gab.
 */
export function zoeAufgaben(state: Pick<TasksState, 'tasks'>, filter: { auftraggeberin?: string | null } = {}): ZoeSicht {
  const alle = state.tasks.filter(t => !!t.zoe && (!filter.auftraggeberin || auftraggeberinVon(t) === filter.auftraggeberin))
    .sort((a, b) => (zoeSeit(b) ?? b.updatedAt ?? '').localeCompare(zoeSeit(a) ?? a.updatedAt ?? ''));
  const je = (s: ZoeStatus) => alle.filter(t => t.zoe!.status === s);
  return { alle, offen: je('offen'), inArbeit: je('in_arbeit'), wartet: je('wartet_freigabe'), freigegeben: je('freigegeben'), abgelehnt: je('abgelehnt') };
}

/** Darf die Aufgabe (wieder) an ZOE gehen? Nicht, solange ZOE sie hat oder ein Vorschlag wartet; nicht erledigt. */
export function darfAnZoe(t: Pick<Task, 'zoe' | 'status'>): boolean {
  if (t.status === 'done') return false;
  return !t.zoe || t.zoe.status === 'freigegeben' || t.zoe.status === 'abgelehnt';
}

/**
 * Was der nächste Lauf abarbeitet: offen (und „in Arbeit“, die länger als `ZOE_HAENGT_MIN` hängen), nicht erledigt,
 * nur mit bekannter Auftraggeberin; mit `person` nur deren Aufträge. Älteste zuerst.
 */
export function zoeZuBearbeiten(tasks: readonly Task[], opt: { person?: string | null; jetzt: string }): Task[] {
  const grenze = Date.parse(opt.jetzt) - ZOE_HAENGT_MIN * 60_000;
  return tasks.filter(t => {
    if (!t.zoe || t.status === 'done') return false;
    const haengt = t.zoe.status === 'in_arbeit' && Date.parse(zoeSeit(t) ?? '1970-01-01') < grenze;
    if (t.zoe.status !== 'offen' && !haengt) return false;
    const a = auftraggeberinVon(t);
    return !!a && (!opt.person || a === opt.person);
  }).sort((a, b) => (zoeSeit(a) ?? '').localeCompare(zoeSeit(b) ?? ''));
}

/** Der Hinweis, den die Auftraggeberin mit der letzten Übergabe an ZOE mitgab (Kommentar „Hinweis an ZOE: …“). */
export function zoeHinweis(t: Pick<Task, 'kommentare' | 'verlauf' | 'zoe'>): string | null {
  if (t.zoe?.hinweis) return t.zoe.hinweis.slice(0, ZOE_VORSCHLAG_GRENZEN.hinweis);
  if (t.zoe?.von) return null; // neues Modell: kein Hinweis gesetzt
  const a = auftraggeberinVon(t);
  if (!a) return null;
  const v = t.verlauf ?? [];
  let seit = '';
  // Die Übergabe selbst — nicht das Zurücksetzen nach einem abgebrochenen Lauf („in Arbeit“ → offen).
  for (let i = v.length - 1; i >= 0; i--) if (v[i].was === 'zoe' && v[i].nachher === ZOE_STATUS_LABEL_VERLAUF.offen && v[i].vorher !== ZOE_STATUS_LABEL_VERLAUF.in_arbeit && v[i].durch !== 'system') { seit = v[i].am; break; }
  const k = (t.kommentare ?? []).filter(x => x.von === a && x.am >= seit && x.text.startsWith(ZOE_HINWEIS)).pop();
  const text = k?.text.slice(ZOE_HINWEIS.length).trim();
  return text ? text.slice(0, ZOE_VORSCHLAG_GRENZEN.hinweis) : null;
}

const text = (v: unknown, n: number): string => (typeof v === 'string' ? v.replace(/\u0000/g, '').trim().slice(0, n) : '');

/**
 * Die Modell-Antwort (oder eine Stapel-Eingabe) säubern — nur die fünf erlaubten Arten von Vorschlag, begrenzt.
 * `null`, wenn nichts Brauchbares darin steht (keine leeren Vorschläge in den Stapel).
 */
export function vorschlagSauber(roh: unknown, aufgabeId: string): ZoeVorschlagInhalt | null {
  if (!roh || typeof roh !== 'object') return null;
  const o = roh as Record<string, unknown>;
  const G = ZOE_VORSCHLAG_GRENZEN;
  const entwurf = text(o.entwurf, G.entwurf);
  const unteraufgaben = Array.from(new Set((Array.isArray(o.unteraufgaben) ? o.unteraufgaben : [])
    .map(x => text(x, G.unteraufgabeTitel)).filter(Boolean))).slice(0, G.unteraufgaben);
  const status = VORSCHLAG_STATUS.includes(o.status as Exclude<TaskStatus, 'backlog'>) ? (o.status as Exclude<TaskStatus, 'backlog'>) : undefined;
  const deadline = typeof o.deadline === 'string' && TAG.test(o.deadline) && !Number.isNaN(Date.parse(o.deadline)) ? o.deadline : undefined;
  const zusammenfassung = text(o.zusammenfassung, G.zusammenfassung);
  const begruendung = text(o.begruendung, G.begruendung);
  if (!entwurf && !unteraufgaben.length && !status && !deadline) return null;
  return {
    aufgabeId, zusammenfassung: zusammenfassung || 'ZOE hat einen Vorschlag vorbereitet.',
    ...(entwurf ? { entwurf } : {}), ...(unteraufgaben.length ? { unteraufgaben } : {}),
    ...(status ? { status } : {}), ...(deadline ? { deadline } : {}), ...(begruendung ? { begruendung } : {}),
  };
}

/** Eine Zeile für den Stapel: was bei Freigabe passiert. */
export function vorschlagZeile(v: ZoeVorschlagInhalt): string {
  const teile: string[] = [];
  if (v.entwurf) teile.push('Entwurf an die Notiz');
  if (v.unteraufgaben?.length) teile.push(`${v.unteraufgaben.length} Unteraufgabe${v.unteraufgaben.length === 1 ? '' : 'n'}`);
  if (v.status) teile.push(`Status → ${grundVon(v.status).label}`);
  if (v.deadline) teile.push(`Deadline → ${v.deadline.slice(8, 10)}.${v.deadline.slice(5, 7)}.${v.deadline.slice(0, 4)}`);
  return teile.join(' · ') || 'ohne Änderung';
}

export type AnwendenErgebnis = { ok: true; task: Task; neue: Task[] } | { ok: false; fehler: string };

/**
 * Freigabe (rein): die Vorschläge in die Aufgabe übernehmen — Entwurf an die Notiz anhängen, Unteraufgaben anlegen
 * (bei einer Unteraufgabe als Checkliste in der Notiz, es gibt nur eine Ebene), Status/Deadline setzen,
 * `zoe.status = freigegeben`. Nichts wird gelöscht oder überschrieben außer Status und Deadline.
 */
export function vorschlagAnwenden(t: Task, v: ZoeVorschlagInhalt, opt: {
  stapelId: string; jetzt: string; tag: string; eigene?: readonly AufgabenStatus[]; geschwister?: readonly Task[]; neueId: (i: number) => string; notizMax?: number;
}): AnwendenErgebnis {
  if (v.aufgabeId !== t.id) return { ok: false, fehler: 'Der Vorschlag gehört zu einer anderen Aufgabe.' };
  let notiz = t.notiz ?? '';
  const block: string[] = [];
  const alsCheckliste = !!t.parentId && !!v.unteraufgaben?.length;
  if (v.entwurf) block.push(v.entwurf);
  if (alsCheckliste) block.push(v.unteraufgaben!.map(u => `- [ ] ${u}`).join('\n'));
  if (block.length) {
    const kopf = `**ZOE · ${opt.tag.slice(8, 10)}.${opt.tag.slice(5, 7)}.${opt.tag.slice(0, 4)}** — freigegeben`;
    notiz = `${notiz.trimEnd()}${notiz.trim() ? '\n\n---\n\n' : ''}${kopf}\n\n${block.join('\n\n')}`;
    if (notiz.length > (opt.notizMax ?? 50_000)) return { ok: false, fehler: `Abgelehnt: die Notiz würde länger als ${(opt.notizMax ?? 50_000).toLocaleString('de-DE')} Zeichen. Nichts übernommen — bitte die Notiz kürzen oder den Vorschlag ablehnen.` };
  }
  let task: Task = { ...t, updatedAt: opt.jetzt, zoe: { ...(t.zoe?.von ? { von: t.zoe.von } : {}), status: 'freigegeben', stapelId: opt.stapelId } };
  if (block.length) task.notiz = notiz;
  if (v.status) task = { ...task, ...statusTeil(t, v.status, opt.eigene ?? [], opt.jetzt) };
  for (const k of ['statusId', 'completedAt'] as const) if (task[k] === undefined) delete task[k];
  if (v.deadline) task.dueDate = v.deadline;
  const neue: Task[] = [];
  if (!alsCheckliste && v.unteraufgaben?.length) {
    const start = Math.max(-1, ...(opt.geschwister ?? []).filter(x => x.parentId === t.id).map(x => x.sortOrder ?? 0)) + 1;
    v.unteraufgaben.forEach((titel, i) => neue.push({
      id: opt.neueId(i), projectId: t.projectId, title: titel, status: 'todo', priority: 'medium', assignee: t.assignee, tags: [], subTasks: [],
      dependencies: [], sortOrder: start + i, createdAt: opt.jetzt, updatedAt: opt.jetzt, parentId: t.id,
      ...(t.spaceId ? { spaceId: t.spaceId } : {}), ...(t.listeId ? { listeId: t.listeId } : {}),
    }));
  }
  return { ok: true, task, neue };
}
