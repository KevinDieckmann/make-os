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
// Gründungsfahrplan (Abnahme 14.10., B17): seine Aufgaben haben freie Kennungen, liegen aber in den Meilenstein-Listen der Fahrplan-
// Meilensteine (`ms-fahrplan-…` → Liste `lm-ms-fahrplan-…`, lib/gesellschaften/fahrplan.ts + lib/planung/meilenstein-aufgaben.ts) — sie
// gehören zur Firmen-Akte (Register, Gründung) und erkennt man an der LISTE; die Listen selbst (Namen der Gründungsschritte) fallen mit weg.

import type { Task, TasksState } from '@/types/tasks';

/** Präfix der Beschluss-Folge „Cap-Table anpassen“ (eine Stelle — der Erzeuger liest es von hier). */
export const BESCHLUSS_CAPTABLE_PRAEFIX = 'bfc-';

/** Alle Kennungs-Präfixe der Aufgaben, die die Firmen-Akte anlegt. */
export const FIRMEN_AKTE_PRAEFIXE = ['usp-', 'usd-', 'usm-', 'usr-', 'vte-', 'rcw-', BESCHLUSS_CAPTABLE_PRAEFIX] as const;

type AufgabeKern = Pick<Task, 'id' | 'parentId'> & { listeId?: string };

/** Listen-Präfix der Meilenstein-Listen des Gründungsfahrplans (`lm-` + `ms-fahrplan-…`; Wächter prüft es gegen die Erzeuger). */
export const FAHRPLAN_LISTE_PRAEFIX = 'lm-ms-fahrplan-';
/** Ist das eine Liste des Gründungsfahrplans? */
export const istFahrplanListe = (listeId: string | null | undefined): boolean => typeof listeId === 'string' && listeId.startsWith(FAHRPLAN_LISTE_PRAEFIX);

/** Hat die Firmen-Akte diese Aufgabe angelegt? (Kennung — Tags/Titel kann man von Hand ändern, die Kennung nicht; beim Fahrplan die Liste) */
export const istFirmenAkteAufgabe = (t: (Pick<Task, 'id'> & { listeId?: string }) | null | undefined): boolean =>
  !!t && typeof t.id === 'string' && (FIRMEN_AKTE_PRAEFIXE.some(p => t.id.startsWith(p)) || istFahrplanListe(t.listeId));

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
    if (istFirmenAkteAufgabe(e)) return true;
    pid = e.parentId;
  }
  return false;
}

/** Steht im Bestand überhaupt eine Aufgabe der Firmen-Akte? (schneller Weg: sonst muss niemand den Zugang prüfen) */
export const hatFirmenAkte = (tasks: readonly AufgabeKern[]): boolean => tasks.some(t => istFirmenAkteAufgabe(t) || (!!t.parentId && FIRMEN_AKTE_PRAEFIXE.some(p => t.parentId!.startsWith(p))));

/** Trägt der Bestand etwas aus der Firmen-Akte (Aufgaben oder Listen des Gründungsfahrplans)? */
export const bestandHatFirmenAkte = (state: Pick<TasksState, 'tasks' | 'listen'>): boolean => hatFirmenAkte(state.tasks) || (state.listen ?? []).some(l => istFahrplanListe(l.id));

/** Nur die Aufgaben-Liste ohne die Firmen-Akte (samt Unteraufgaben). Rein; dieselben Objekte. */
export function aufgabenOhneFirmenAkte<T extends AufgabeKern>(tasks: readonly T[]): T[] {
  if (!hatFirmenAkte(tasks)) return [...tasks];
  const nachId = new Map(tasks.map(t => [t.id, t]));
  return tasks.filter(t => !aufgabeInFirmenAkte(t, nachId));
}

/** Der Bestand ohne die Aufgaben der Firmen-Akte — für Personen ohne Zugang. Alles andere unverändert (dieselben Objekte, Stände bleiben). */
export function ohneFirmenAkte<T extends TasksState>(state: T): T {
  const listen = state.listen ?? [];
  const fahrplanListen = listen.some(l => istFahrplanListe(l.id));
  if (!hatFirmenAkte(state.tasks) && !fahrplanListen) return state;
  return { ...state, tasks: aufgabenOhneFirmenAkte(state.tasks), ...(fahrplanListen ? { listen: listen.filter(l => !istFahrplanListe(l.id)) } : {}) };
}
