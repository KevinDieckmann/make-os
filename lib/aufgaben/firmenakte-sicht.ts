// ─── Aufgaben aus der Firmen-Akte: nur für Personen mit Zugang zur Firmen-Akte (rein, 12.10.) ──────────────────────────────────────────
// Kevin (CLAUDE.md „Trennung serverseitig, nie nur versteckt“): Aufgaben, die die Firmen-Akte selbst anlegt, tragen wieder Klartext-Titel
// („Jahresabschluss feststellen — <Gesellschaft> — bis …“). Zugewiesen werden sie nur Personen mit Zugang zur Firmen-Akte (`rechtPersonen`) —
// ein Konto „nur Business“ (`finanzRecht: 'business'`, Unternehmen › Schild/Register → 403) sah sie aber weiter in seiner Business-Liste.
// Dritter Filter neben „nur ich“ (./sicht-regel.ts) und dem Privat-Bereich (./bereich-sicht.ts), angewandt in `sichtFuerKonto` (./sicht.ts) —
// damit kommt er bei JEDEM Leser an (Liste, Heute/Top 3, Glocke, Kalender, Briefing, ZOE, Suche …); Schreiben → 404 (./speicher.ts).
// WER ausgeblendet wird, entscheidet NUR die Zugangsregel der Firmen-Akte (`rechtZugangFuer`, lib/recht/server.ts — über
// `firmenAkteAusgeblendetFuer` in ./sicht.ts); hier steht nur, WAS eine Firmen-Akte-Aufgabe ist: die festen Kennungen ihrer Erzeuger.
//   · `usp-` `usd-` `usm-` `usr-` — Erinnerungen des Schilds (lib/gesellschaften/schild/ampel.ts `SCHILD_AUFGABEN_PRAEFIXE`)
//   · `vte-` — Vertrags-Erinnerung vor „kündigen bis“ (lib/gesellschaften/modell.ts `erinnerungAufgabeId`)
//   · `rcw-` — Aufgabe aus dem Recht-Check / Recht-Stapel (lib/recht/server.ts `checkAufgabeId`)
//   · `bfc-` — Beschluss-Folge „Cap-Table anpassen“ (lib/gesellschaften/beschluss-server.ts, `BESCHLUSS_CAPTABLE_PRAEFIX`)
// Unteraufgaben (von Hand darunter angelegt) erben das über die Kette — wie beim Privat-Bereich. Projekte/Listen gehören nicht dazu (die
// Aufgaben liegen in „Sonstige“ der Gesellschaft). Neuer Erzeuger in der Firmen-Akte → Präfix HIER eintragen (Wächter
// tests/aufgaben-firmenakte-sicht.test.ts prüft die Erzeuger gegen diese Liste).

import type { Task, TasksState } from '@/types/tasks';

/** Präfix der Beschluss-Folge „Cap-Table anpassen“ (eine Stelle — der Erzeuger liest es von hier). */
export const BESCHLUSS_CAPTABLE_PRAEFIX = 'bfc-';

/** Alle Kennungs-Präfixe der Aufgaben, die die Firmen-Akte anlegt. */
export const FIRMEN_AKTE_PRAEFIXE = ['usp-', 'usd-', 'usm-', 'usr-', 'vte-', 'rcw-', BESCHLUSS_CAPTABLE_PRAEFIX] as const;

type AufgabeKern = Pick<Task, 'id' | 'parentId'>;

/** Hat die Firmen-Akte diese Aufgabe angelegt? (nur die Kennung — Tags/Titel kann man von Hand ändern, die Kennung nicht) */
export const istFirmenAkteAufgabe = (t: Pick<Task, 'id'> | null | undefined): boolean =>
  !!t && typeof t.id === 'string' && FIRMEN_AKTE_PRAEFIXE.some(p => t.id.startsWith(p));

/** Liegt die Aufgabe (oder ein Vorfahre) in der Firmen-Akte? `nachId` = alle Aufgaben (für die Kette). Kreisfest. */
export function aufgabeInFirmenAkte(t: AufgabeKern, nachId?: ReadonlyMap<string, AufgabeKern>): boolean {
  if (istFirmenAkteAufgabe(t)) return true;
  const gesehen = new Set<string>();
  let pid = t.parentId;
  for (let n = 0; pid && n < 64 && !gesehen.has(pid); n++) {
    gesehen.add(pid);
    if (FIRMEN_AKTE_PRAEFIXE.some(p => pid!.startsWith(p))) return true;
    const e = nachId?.get(pid);
    if (!e) break;
    pid = e.parentId;
  }
  return false;
}

/** Steht im Bestand überhaupt eine Aufgabe der Firmen-Akte? (schneller Weg: sonst muss niemand den Zugang prüfen) */
export const hatFirmenAkte = (tasks: readonly AufgabeKern[]): boolean => tasks.some(t => istFirmenAkteAufgabe(t) || (!!t.parentId && FIRMEN_AKTE_PRAEFIXE.some(p => t.parentId!.startsWith(p))));

/** Nur die Aufgaben-Liste ohne die Firmen-Akte (samt Unteraufgaben). Rein; dieselben Objekte. */
export function aufgabenOhneFirmenAkte<T extends AufgabeKern>(tasks: readonly T[]): T[] {
  if (!hatFirmenAkte(tasks)) return [...tasks];
  const nachId = new Map(tasks.map(t => [t.id, t]));
  return tasks.filter(t => !aufgabeInFirmenAkte(t, nachId));
}

/** Der Bestand ohne die Aufgaben der Firmen-Akte — für Personen ohne Zugang. Alles andere unverändert (dieselben Objekte, Stände bleiben). */
export function ohneFirmenAkte<T extends TasksState>(state: T): T {
  if (!hatFirmenAkte(state.tasks)) return state;
  return { ...state, tasks: aufgabenOhneFirmenAkte(state.tasks) };
}
