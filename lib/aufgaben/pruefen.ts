// ─── MAKE OS — Aufgaben: Prüfregeln im Schreibweg (rein, 29.09., Paket T1) ──
// Was der Server an einer geänderten Aufgabe prüft, bevor er schreibt (lib/aufgaben/speicher.ts `aufgabenAendern`).
// Geprüft wird nur, was sich gegenüber dem gespeicherten Stand ÄNDERT — ein alter, unveränderter Wert (z. B. ein
// Zeitstempel als Deadline aus früheren Ständen) blockiert keine andere Änderung an derselben Aufgabe.
//   · `dueDate`/`startDate` nur „YYYY-MM-DD“ und ein gültiger Kalendertag (#14/#78) — sonst 400.
//   · Start ≤ Deadline (#22) — sonst 400.
//   · Monatlich braucht `monatstag` (#23) — sonst 400.
//   · `assignee` genau eine Person des Haushalts, `beteiligte` und `rotation` nur Personen des Haushalts (#40) — sonst 400.
//   · „nur ich“: gehört der Anlegerin; Zuständig, Beteiligte und Wechsel dürfen keine andere Person nennen — sonst 400.
// Tests: tests/aufgaben-t1-server.test.ts.

import type { Task } from '@/types/tasks';
import { istTag } from './wiederholung';

export interface PruefKontext {
  /** Personen des Haushalts (Speichernamen). Leer = unbekannt (keine Konten) → die Personen-Prüfung entfällt. */
  personen: readonly string[];
}

const gleich = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const ein = (p: string, personen: readonly string[]) => !personen.length || personen.includes(p);
const datumText = (was: string, v: string) => `Abgelehnt: ${was} „${v.slice(0, 40)}“ ist kein gültiger Tag (JJJJ-MM-TT). Nichts gespeichert.`;

/** null = in Ordnung, sonst der Grund (400). */
export function aufgabePruefen(n: Task, alt: Task | undefined, k: PruefKontext): string | null {
  const neuDue = (n.dueDate ?? '') !== (alt?.dueDate ?? '');
  const neuStart = (n.startDate ?? '') !== (alt?.startDate ?? '');
  if (neuDue && n.dueDate && !istTag(n.dueDate)) return datumText('Die Deadline', n.dueDate);
  if (neuStart && n.startDate && !istTag(n.startDate)) return datumText('Der Start', n.startDate);
  if ((neuDue || neuStart) && n.startDate && n.dueDate && istTag(n.startDate) && istTag(n.dueDate) && n.startDate > n.dueDate) {
    return `Abgelehnt: der Start (${n.startDate}) liegt nach der Deadline (${n.dueDate}). Nichts gespeichert.`;
  }
  const w = n.wiederholung;
  if (w && !gleich(w, alt?.wiederholung)) {
    if (w.regel === 'monatlich' && !w.monatstag) return 'Abgelehnt: eine monatliche Wiederholung braucht den Tag im Monat (1–31). Nichts gespeichert.';
    for (const p of w.rotation ?? []) if (!ein(p, k.personen)) return `Abgelehnt: „${p}“ gehört nicht zum Haushalt (Wechsel). Nichts gespeichert.`;
  }
  if (n.assignee !== alt?.assignee) {
    // „both“ kommt hier nur an, wenn keine Personen bekannt sind (der Schreibweg löst es vorher auf).
    if (!n.assignee || (n.assignee === 'both' && k.personen.length)) return 'Abgelehnt: genau eine Person ist verantwortlich — weitere als Beteiligte. Nichts gespeichert.';
    if (n.assignee !== 'both' && !ein(n.assignee, k.personen)) return `Abgelehnt: „${n.assignee}“ gehört nicht zum Haushalt. Nichts gespeichert.`;
  }
  const altB = new Set(alt?.beteiligte ?? []);
  for (const p of n.beteiligte ?? []) if (!altB.has(p) && !ein(p, k.personen)) return `Abgelehnt: „${p}“ gehört nicht zum Haushalt (Beteiligte). Nichts gespeichert.`;
  if (n.sichtbarkeit === 'nur-ich') {
    const besitzer = n.angelegtVon;
    if (besitzer && n.assignee !== besitzer && (n.assignee !== alt?.assignee || n.sichtbarkeit !== alt?.sichtbarkeit)) return '„Nur ich“-Aufgaben gehören der Anlegerin — zuständig kann nur sie sein. Nichts gespeichert.';
    if ((n.beteiligte ?? []).some(p => p !== besitzer)) return '„Nur ich“-Aufgaben haben keine Beteiligten — sonst sähen sie sie nicht. Nichts gespeichert.';
    if ((n.wiederholung?.rotation ?? []).some(p => p !== besitzer)) return '„Nur ich“-Aufgaben wechseln nicht zwischen Personen. Nichts gespeichert.';
  }
  return null;
}
