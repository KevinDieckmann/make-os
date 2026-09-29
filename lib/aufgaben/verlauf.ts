// ─── MAKE OS — Verlauf je Aufgabe (rein, 28.09. spät) ───────────────────────
// Kevin: „Verlauf je Aufgabe — wer, wann, was.“ Der Server schreibt ihn beim Speichern (lib/aufgaben/speicher.ts,
// /api/tasks/create); was der Browser mitschickt, verwirft die Säuberung. Werte stehen nur als nicht-vertrauliche
// Kurzwerte da (Status-Name, Datum, Person, Priorität) — Titel, Beschreibung, Notiz, Kommentare, Feldwerte nie.
// Das globale Änderungsprotokoll bleibt ohne Werte (lib/store/aenderungsprotokoll.ts).
// Grenze VERLAUF_MAX: darüber werden die ältesten zu EINEM Eintrag „+N ältere Änderungen“ zusammengefasst — nie still.

import type { Task, AufgabenStatus, VerlaufEintrag, VerlaufArt } from '@/types/tasks';
import { statusVon } from './struktur';

export const VERLAUF_MAX = 200;

export interface VerlaufWer { person: string; durch?: 'zoe' | 'system' }
const gleichJson = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const PRIO_LABEL: Record<string, string> = { critical: 'Kritisch', high: 'Hoch', medium: 'Normal', low: 'Niedrig' };
const ZOE_LABEL: Record<string, string> = { offen: 'offen', in_arbeit: 'in Arbeit', wartet_freigabe: 'wartet auf Freigabe', freigegeben: 'freigegeben', abgelehnt: 'abgelehnt' };

/** Die Einträge für eine Änderung (ohne `alt` = angelegt). */
export function verlaufFuer(alt: Task | undefined, neu: Task, wer: VerlaufWer, jetzt: string, eigene: readonly AufgabenStatus[] = []): VerlaufEintrag[] {
  const e = (was: VerlaufArt, x: Partial<VerlaufEintrag> = {}): VerlaufEintrag => ({ am: jetzt, von: wer.person, ...(wer.durch ? { durch: wer.durch } : {}), was, ...x });
  if (!alt) return [e('angelegt')];
  const raus: VerlaufEintrag[] = [];
  const sa = statusVon(alt, eigene), sn = statusVon(neu, eigene);
  if (sa.id !== sn.id) raus.push(e('status', { vorher: sa.label, nachher: sn.label }));
  if (alt.assignee !== neu.assignee) raus.push(e('zustaendig', { vorher: alt.assignee, nachher: neu.assignee }));
  if (alt.priority !== neu.priority) raus.push(e('prioritaet', { vorher: PRIO_LABEL[alt.priority] ?? alt.priority, nachher: PRIO_LABEL[neu.priority] ?? neu.priority }));
  // Uhrzeit der Deadline (29.09., Kalender K1) gehört zur Deadline: „2026-10-02 14:30“.
  const dl = (t: { dueDate?: string; dueTime?: string }) => (t.dueDate ? `${t.dueDate.slice(0, 10)}${t.dueTime ? ` ${t.dueTime}` : ''}` : '');
  if ((alt.dueDate ?? '') !== (neu.dueDate ?? '') || (alt.dueTime ?? '') !== (neu.dueTime ?? '')) raus.push(e('deadline', { ...(alt.dueDate ? { vorher: dl(alt) } : {}), ...(neu.dueDate ? { nachher: dl(neu) } : {}) }));
  if ((alt.startDate ?? '') !== (neu.startDate ?? '')) raus.push(e('start', { ...(alt.startDate ? { vorher: alt.startDate } : {}), ...(neu.startDate ? { nachher: neu.startDate } : {}) }));
  if (alt.title !== neu.title) raus.push(e('titel'));
  if ((alt.description ?? '').trim() !== (neu.description ?? '').trim()) raus.push(e('beschreibung'));
  if ((alt.notiz ?? '') !== (neu.notiz ?? '')) raus.push(e('notiz'));
  if (alt.spaceId !== neu.spaceId || alt.projectId !== neu.projectId || (alt.listeId ?? '') !== (neu.listeId ?? '') || (alt.parentId ?? '') !== (neu.parentId ?? '')) raus.push(e('verschoben'));
  const ka = new Set((alt.kommentare ?? []).map(k => k.id)), kn = new Set((neu.kommentare ?? []).map(k => k.id));
  // Entfernt = fehlt jetzt ODER seit dieser Änderung weich entfernt (29.09., `entfernt`).
  const weichAlt = new Set((alt.kommentare ?? []).filter(k => k.entfernt).map(k => k.id));
  const weichNeu = (neu.kommentare ?? []).filter(k => k.entfernt && !weichAlt.has(k.id)).length;
  const kNeu = Array.from(kn).filter(id => !ka.has(id)).length, kWeg = Array.from(ka).filter(id => !kn.has(id)).length + weichNeu;
  if (kNeu) raus.push(e('kommentar', { feld: 'neu', anzahl: kNeu }));
  if (kWeg) raus.push(e('kommentar', { feld: 'entfernt', anzahl: kWeg }));
  const fa = alt.felder ?? {}, fn = neu.felder ?? {};
  for (const k of Array.from(new Set([...Object.keys(fa), ...Object.keys(fn)]))) if (!gleichJson(fa[k], fn[k])) raus.push(e('feld', { feld: k }));
  if (!gleichJson(alt.abhaengigVon ?? [], neu.abhaengigVon ?? [])) raus.push(e('abhaengigkeit', { anzahl: (neu.abhaengigVon ?? []).length }));
  if (!gleichJson(alt.bezug, neu.bezug)) raus.push(e('verknuepfung'));
  if (!gleichJson(alt.wiederholung, neu.wiederholung)) raus.push(e('wiederholung'));
  // Seit 29.09.: Beteiligte (Personen = Kurzwerte) und Sichtbarkeit.
  if (!gleichJson(alt.beteiligte ?? [], neu.beteiligte ?? [])) raus.push(e('beteiligte', { ...(alt.beteiligte?.length ? { vorher: alt.beteiligte.join(', ') } : {}), ...(neu.beteiligte?.length ? { nachher: neu.beteiligte.join(', ') } : {}) }));
  if ((alt.sichtbarkeit ?? 'haushalt') !== (neu.sichtbarkeit ?? 'haushalt')) raus.push(e('sichtbarkeit', { vorher: alt.sichtbarkeit === 'nur-ich' ? 'nur ich' : 'Haushalt', nachher: neu.sichtbarkeit === 'nur-ich' ? 'nur ich' : 'Haushalt' }));
  if ((alt.zoe?.status ?? '') !== (neu.zoe?.status ?? '')) raus.push(e('zoe', { ...(alt.zoe ? { vorher: ZOE_LABEL[alt.zoe.status] } : {}), ...(neu.zoe ? { nachher: ZOE_LABEL[neu.zoe.status] } : {}) }));
  return raus;
}

/**
 * Einträge anhängen; über `max` werden die ältesten zu einem Eintrag „zusammengefasst“ (mit Anzahl) — ein schon
 * vorhandener Sammel-Eintrag am Anfang zählt weiter. Nichts verschwindet ohne Spur.
 */
export function verlaufAnhaengen(alt: readonly VerlaufEintrag[] | undefined, neu: readonly VerlaufEintrag[], max = VERLAUF_MAX): VerlaufEintrag[] | undefined {
  const alle = [...(alt ?? []), ...neu];
  if (alle.length <= max) return alle.length ? alle : undefined;
  const sammel = alle[0]?.was === 'zusammengefasst' ? alle[0] : null;
  const rest = sammel ? alle.slice(1) : alle;
  const behalten = rest.slice(rest.length - (max - 1));
  const weg = rest.slice(0, rest.length - (max - 1));
  const anzahl = (sammel?.anzahl ?? 0) + weg.length;
  const letzter = weg[weg.length - 1] ?? sammel!;
  return [{ am: letzter.am, von: 'system', durch: 'system', was: 'zusammengefasst', anzahl }, ...behalten];
}

/** Anzeige-Text eines Eintrags (ohne Person/Zeit). */
export function verlaufText(v: VerlaufEintrag, feldName: (id: string) => string | undefined = () => undefined, person: (s: string) => string = s => s): string {
  const pfeil = v.vorher || v.nachher ? `: ${v.vorher ?? '—'} → ${v.nachher ?? '—'}` : '';
  switch (v.was) {
    case 'angelegt': return 'hat die Aufgabe angelegt';
    case 'status': return `Status${pfeil}`;
    case 'zustaendig': return `Zuständig: ${v.vorher ? (v.vorher === 'both' ? 'Beide' : person(v.vorher)) : '—'} → ${v.nachher ? (v.nachher === 'both' ? 'Beide' : person(v.nachher)) : '—'}`;
    case 'prioritaet': return `Priorität${pfeil}`;
    case 'deadline': return `Deadline${pfeil}`;
    case 'start': return `Start${pfeil}`;
    case 'titel': return 'Titel geändert';
    case 'beschreibung': return 'Beschreibung geändert';
    case 'notiz': return 'Notiz geändert';
    case 'verschoben': return 'verschoben';
    case 'kommentar': return v.feld === 'entfernt' ? `${v.anzahl ?? 1} Kommentar${(v.anzahl ?? 1) === 1 ? '' : 'e'} entfernt` : `${v.anzahl ?? 1} Kommentar${(v.anzahl ?? 1) === 1 ? '' : 'e'} geschrieben`;
    case 'datei': return v.feld === 'entfernt' ? 'Datei entfernt' : 'Datei hinzugefügt';
    case 'feld': return `Feld „${(v.feld && feldName(v.feld)) ?? 'Feld'}“ geändert`;
    case 'abhaengigkeit': return v.anzahl ? `wartet jetzt auf ${v.anzahl} Aufgabe${v.anzahl === 1 ? '' : 'n'}` : 'wartet auf nichts mehr';
    case 'verknuepfung': return 'CRM-Verknüpfung geändert';
    case 'wiederholung': return 'Wiederholung geändert';
    case 'beteiligte': return `Beteiligte: ${v.vorher ? v.vorher.split(', ').map(person).join(', ') : '—'} → ${v.nachher ? v.nachher.split(', ').map(person).join(', ') : '—'}`;
    case 'sichtbarkeit': return `Sichtbar${pfeil}`;
    case 'zoe': return `ZOE${pfeil}`;
    case 'zusammengefasst': return `+${v.anzahl ?? 0} ältere Änderungen`;
    default: return 'geändert';
  }
}
