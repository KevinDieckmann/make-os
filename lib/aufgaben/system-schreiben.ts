// ─── MAKE OS — Server-Schreiber für Aufgaben (29.09., Paket T1 #12/#13/#74) ─
// Heads, Head of Finance, Steuern, Löschfristen, Belege, Eventplanung und CRM-Events legten Aufgaben an und setzten
// sie auf „erledigt“ direkt im Bestand — ohne `completedAt`, ohne Verlauf, ohne Serien-Instanz, am Sichtfilter vorbei.
// Jetzt gehen sie über den EINEN Schreibweg `aufgabenAendern`: die Änderungen werden IN der Sperre aus dem aktuellen Stand
// berechnet (`rechnen`), der Server setzt Zeitstempel, Anlegerin, Verlauf (`durch: 'system'`), Serien, Protokoll und
// Meldungen. Ohne Änderung wird nichts geschrieben. Die Massen-Wache gilt nicht (gewollte Abgleiche).

import type { Task, TasksState } from '@/types/tasks';
import type { Wer } from '@/lib/store/aenderungsprotokoll';
import { taskSauber } from './saeubern';
import { deadlineAlsTag } from './struktur';
import { istTag } from './wiederholung';
import { haushaltsSpeicher } from './sicht';
import { aufgabenAendern, keineOps, teilOp, type AufgabenOps, type Op, type SchreibErgebnis } from './speicher';

export interface SystemAenderungen {
  /** Neue Aufgaben (roh — werden gesäubert; Kennung + Titel Pflicht). */
  neu?: Record<string, unknown>[];
  /** Teil-Änderungen bestehender Aufgaben: nur die genannten Felder (`null` leert). */
  teile?: { id: string; felder: Partial<Record<keyof Task, unknown>> }[];
}

/**
 * Aus den Änderungen die Ops bauen (rein). Unbekannte Kennungen bei `teile` fallen weg. Neue Aufgaben werden so
 * vorbereitet, dass ein einzelner schiefer Wert nicht den ganzen Abgleich blockiert: Deadline als Tag (sonst ohne),
 * Start nach der Deadline fällt weg, Verantwortliche außerhalb des Haushalts → die erste Person des Haushalts.
 */
export function systemOps(stand: TasksState, a: SystemAenderungen, personen: readonly string[] = []): AufgabenOps {
  const ops = keineOps();
  const nachId = new Map(stand.tasks.map(t => [t.id, t]));
  for (const roh of a.neu ?? []) {
    const t = taskSauber(roh);
    if (!t) continue;
    const d = deadlineAlsTag(t.dueDate);
    if (d && istTag(d)) t.dueDate = d; else delete t.dueDate;
    if (t.startDate && (!istTag(t.startDate) || (t.dueDate && t.startDate > t.dueDate))) delete t.startDate;
    if (personen.length && t.assignee !== 'both' && !personen.includes(t.assignee)) t.assignee = personen[0] as Task['assignee'];
    ops.tasks.push({ op: 'upsert', eintrag: t } as Op<Task>);
  }
  for (const { id, felder } of a.teile ?? []) {
    const alt = nachId.get(id);
    if (alt) ops.tasks.push(teilOp(id, alt, felder));
  }
  return ops;
}

/**
 * Aufgaben als Server-Schreiber ändern. `rechnen` bekommt den übernommenen Stand (mit Papierkorb) in der Sperre und
 * liefert, was neu entsteht bzw. sich ändert. `person` = in wessen Auftrag (Head-Entscheidung), sonst Systemlauf.
 */
export async function systemAufgabenAendern(rechnen: (stand: TasksState) => SystemAenderungen, o: { person?: string | null; wer?: Wer; jetzt?: string } = {}): Promise<SchreibErgebnis> {
  const person = o.person || 'system';
  const personen = await haushaltsSpeicher();
  return aufgabenAendern(stand => systemOps(stand, rechnen(stand), personen), {
    person, wer: o.wer ?? { art: 'system', ...(o.person ? { person: o.person } : {}) }, system: true, massenAenderung: true,
    ...(o.jetzt ? { jetzt: o.jetzt } : {}),
  });
}
