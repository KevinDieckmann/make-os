// ─── Kalender — Aufgaben im Kalender (rein, client-sicher, getestet, 30.09., Paket K3) ─
// Kevin 29.09.: „Aufgaben im Kalender abhaken und per Ziehen einplanen“ (Verbindungskarte Befund 9). Eine Aufgabe im
// Kalender ist DIESELBE Aufgabe (K1) — nie eine Kopie, nie ein iCloud-Termin. Hier die reinen Regeln; geschrieben wird
// nur über den Aufgaben-Schreibweg (TasksContext → /api/state/tasks: Serien, Follow-up-Abgleich, Verlauf) mit
// „Rückgängig“ aus dem HandlungProvider (components/os/kalender/aufgaben.tsx).
//
//   Anzeige    offen, nicht abgebrochen, nicht im Papierkorb/Archiv, keine fremde „nur ich“-Aufgabe (der Server filtert sie
//              schon — hier doppelt, falls ein Stand sie noch trägt); sichtbar vom Start (`startDate`) bis zur Deadline
//              als Balken, mit Uhrzeit (`dueTime`) als Block an ihrer Zeit; Unteraufgaben gekennzeichnet.
//   Ziehen     ändert `dueDate` (+ `dueTime`, eine Quelle) — der Start wandert um dieselbe Zahl Tage mit (`verschiebenTeil`);
//              in die Ganztags-Zeile ohne Uhrzeit, ins Raster mit Uhrzeit (15-Minuten-Raster).
//   Ohne Termin offene Aufgaben ohne Deadline — Seitenliste, per Ziehen ins Raster einplanen (setzt `dueDate` + `dueTime`).

import type { Task } from '@/types/tasks';
import { spaceVonAufgabe } from '@/lib/make-one/space-regeln';
import { suchPasst } from '@/lib/text/such-norm';
import { istTag, tageZwischen } from '@/lib/aufgaben/ansichten';
import { tagPlus } from './zeit';
import { vorfahren } from '@/lib/aufgaben/ebenen';

export type Sicht = 'alle' | 'kevin' | 'malin' | 'beide';
export type Bereich = 'alle' | 'privat' | 'business';

/** Eine Aufgabe, wie Raster, Monat und Termine sie zeigen. `tag` = Deadline, `start` = Start (nur wenn früher). */
export interface KalenderAufgabe {
  id: string; title: string; done: boolean; priority?: string;
  /** Deadline (YYYY-MM-DD). */
  tag: string;
  /** Uhrzeit der Deadline „HH:MM“ — dann ein Block im Raster. */
  zeit?: string;
  /** Start (YYYY-MM-DD) vor der Deadline → Balken vom Start bis zur Deadline. */
  start?: string;
  /** Unteraufgabe: Titel der übergeordneten Aufgabe (Kennzeichnung „↳“). */
  eltern?: string;
  wiederkehrend?: boolean;
}

/** Ein Abschnitt eines Balkens an einem Tag. */
export type Abschnitt = 'einzel' | 'start' | 'mitte' | 'ende';

/** Gehört eine Aufgabe in die Sicht? Kevin/Malin: verantwortlich oder beteiligt; Gemeinsam: mehr als eine Person. */
export function aufgabeInSicht(t: Pick<Task, 'assignee' | 'beteiligte'>, sicht: Sicht): boolean {
  if (sicht === 'alle') return true;
  const mehrere = t.assignee === 'both' || (t.beteiligte?.length ?? 0) > 0;
  if (sicht === 'beide') return mehrere;
  return t.assignee === sicht || t.assignee === 'both' || (t.beteiligte ?? []).includes(sicht);
}

/** Darf die Aufgabe überhaupt im Kalender stehen (offen, nicht abgebrochen, nicht weggelegt, nicht fremd „nur ich“)? */
export function imKalenderSichtbar(t: Pick<Task, 'status' | 'geloeschtAm' | 'archiviertAm' | 'sichtbarkeit' | 'angelegtVon'>, ich?: string): boolean {
  if (t.status === 'done' || t.status === 'cancelled' || t.geloeschtAm || t.archiviertAm) return false;
  if (t.sichtbarkeit === 'nur-ich' && (!ich || t.angelegtVon !== ich)) return false;
  return true;
}

export interface AufgabenFilter { sicht: Sicht; bereich: Bereich; suche?: string; ich?: string }
const imBereich = (t: Task, b: Bereich) => b === 'alle' || spaceVonAufgabe(t) === b;

/** Aufgaben mit Deadline, deren Zeitraum [Start, Deadline] den Zeitraum [von, bis) berührt. */
export function aufgabenFuerKalender(tasks: readonly Task[], von: string, bis: string, f: AufgabenFilter): KalenderAufgabe[] {
  const nachId = new Map(tasks.map(t => [t.id, t]));
  const raus: KalenderAufgabe[] = [];
  for (const t of tasks) {
    const due = t.dueDate?.slice(0, 10);
    if (!istTag(due) || !imKalenderSichtbar(t, f.ich)) continue;
    // Eltern im Papierkorb/„nur ich“ fremd → die Unteraufgabe auch nicht — auf jeder Ebene (mehrstufig, 01.10.): ein Vorfahre genügt.
    const eltern = t.parentId ? nachId.get(t.parentId) : undefined;
    if (t.parentId && vorfahren(t, nachId).some(v => v.geloeschtAm || v.archiviertAm || (v.sichtbarkeit === 'nur-ich' && v.angelegtVon !== f.ich))) continue;
    const start = istTag(t.startDate) && t.startDate < due ? t.startDate : undefined;
    if ((start ?? due) >= bis || due < von) continue;
    if (!aufgabeInSicht(t, f.sicht) || !imBereich(t, f.bereich)) continue;
    if (f.suche && !suchPasst([t.title], f.suche)) continue;
    raus.push({
      id: t.id, title: t.title, done: false, ...(t.priority ? { priority: t.priority } : {}), tag: due,
      ...(t.dueTime && /^\d{2}:\d{2}$/.test(t.dueTime) ? { zeit: t.dueTime } : {}), ...(start ? { start } : {}),
      ...(t.parentId ? { eltern: eltern?.title ?? 'Aufgabe' } : {}), ...(t.wiederholung && !t.wiederholung.serieBeendet ? { wiederkehrend: true } : {}),
    });
  }
  return raus;
}

/** Welcher Abschnitt des Balkens liegt an `tag`? null = nicht an diesem Tag. */
export function abschnittAm(a: Pick<KalenderAufgabe, 'tag' | 'start'>, tag: string): Abschnitt | null {
  const von = a.start ?? a.tag;
  if (tag < von || tag > a.tag) return null;
  if (von === a.tag) return 'einzel';
  return tag === von ? 'start' : tag === a.tag ? 'ende' : 'mitte';
}

/**
 * Ganztags an einem Tag: Aufgaben ohne Uhrzeit an ihrer Deadline und — als Balken — jede Aufgabe mit Start an den Tagen
 * davor (auch die mit Uhrzeit: der Block steht am Deadline-Tag im Raster).
 */
export function ganztagsAm(liste: readonly KalenderAufgabe[], tag: string): (KalenderAufgabe & { abschnitt: Abschnitt })[] {
  const raus: (KalenderAufgabe & { abschnitt: Abschnitt })[] = [];
  for (const a of liste) {
    const ab = abschnittAm(a, tag);
    if (!ab || (a.zeit && tag === a.tag)) continue;
    raus.push({ ...a, abschnitt: ab });
  }
  return raus;
}

/** Aufgaben mit Uhrzeit, deren Deadline `tag` ist (Blöcke im Raster). */
export const mitZeitAm = (liste: readonly KalenderAufgabe[], tag: string): KalenderAufgabe[] => liste.filter(a => a.tag === tag && !!a.zeit);

/** Minuten → „HH:MM“ im 15-Minuten-Raster (0 … 23:45). */
export function zeitAusMinuten(min: number, raster = 15): string {
  const m = Math.max(0, Math.min(24 * 60 - raster, Math.floor(min / raster) * raster));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/**
 * Einplanen/Verschieben (rein): Deadline auf `tag`, Uhrzeit setzen (`zeit`) oder entfernen (`null` → Ganztags-Zeile);
 * ein Start wandert um dieselbe Zahl Tage mit. Liefert null, wenn sich nichts ändert.
 */
export function einplanenTeil(t: Pick<Task, 'dueDate' | 'dueTime' | 'startDate'>, tag: string, zeit: string | null): Partial<Pick<Task, 'dueDate' | 'dueTime' | 'startDate'>> | null {
  if (!istTag(tag) || (zeit !== null && !/^\d{2}:\d{2}$/.test(zeit))) return null;
  const altTag = t.dueDate?.slice(0, 10);
  const teil: Partial<Pick<Task, 'dueDate' | 'dueTime' | 'startDate'>> = {};
  if (altTag !== tag) {
    teil.dueDate = tag;
    if (istTag(altTag) && istTag(t.startDate)) teil.startDate = tagPlus(t.startDate, tageZwischen(altTag, tag));
  }
  if ((t.dueTime ?? null) !== zeit) teil.dueTime = zeit ?? undefined;
  return Object.keys(teil).length ? teil : null;
}

/** Offene Aufgaben ohne Deadline (Seitenliste „Ohne Termin“) — kritisch zuerst, dann die jüngsten. */
export function ohneTermin(tasks: readonly Task[], f: AufgabenFilter, max = 40): Task[] {
  const rang: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return tasks.filter(t => !t.dueDate && imKalenderSichtbar(t, f.ich) && aufgabeInSicht(t, f.sicht) && imBereich(t, f.bereich) && (!f.suche || suchPasst([t.title], f.suche)))
    .sort((a, b) => (rang[a.priority] ?? 4) - (rang[b.priority] ?? 4) || (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
    .slice(0, max);
}
