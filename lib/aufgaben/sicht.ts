// ─── MAKE OS — Aufgaben lesen (Server, 29.09., A7/A9) ───────────────────────
// Leichtgewichtig (nur Bestand + reine Regeln), damit jeder Leser es einbinden kann, ohne den ganzen Schreibweg
// (Meldungen, CRM, Konten) mitzuziehen. Zwei Wege:
//   · `ladeAufgaben`     — übernommen (Space, Unteraufgaben, Sonstige …) MIT Papierkorb: Schreibwege, Aufgaben-Seite.
//   · `ladeAufgabenSicht(person)` — übernommen OHNE Papierkorb und durch den Sichtfilter „nur ich“ (29.09.): ALLE Leser
//     (Listen, Heute, Glocke, Kalender, Board, Indizes, ZOE, Brain, Suche).
// Nie `loadJson('tasks')` roh lesen — dort fehlt die Übernahme, und der Papierkorb stünde mitten in den Listen.
// Ausnahmen mit Grund: Art. 15/17 (lib/crm/person-bestaende.ts — auch der Papierkorb ist personenbezogen), die
// Verbindungsprüfung (lib/crm/verbindungen-laden.ts — Dateien an Papierkorb-Einträgen sind nicht „tot“) und Server-
// Schreiber, die in der Sperre anhängen.

import { loadJson } from '@/lib/store/local-db';
import { ladeKonten } from '@/lib/zugang/konten';
import type { Task, TasksState } from '@/types/tasks';
import { uebernehmen } from './struktur';
import { aufgabenSicht } from './papierkorb';

export const AUFGABEN_BESTAND_NAME = 'tasks';
const leer = (): TasksState => ({ projects: [], tasks: [], listen: [], statusEigen: [], gruppen: [], vorlagen: [] });
export const alsStand = (roh: TasksState | null | undefined): TasksState => (roh && Array.isArray(roh.tasks) ? roh : { ...leer(), ...(roh ?? {}), tasks: [] });

// ── Sichtbarkeit „nur ich“ (29.09., Kevin) — der EINE Filter für alle Lesepfade ──────────────
// Eine Aufgabe mit `sichtbarkeit: 'nur-ich'` sieht nur ihre Anlegerin (`angelegtVon`); ihre Unteraufgaben auf allen
// Ebenen erben das (sichtbar nur, wenn alle Vorfahren es sind). Ohne Person (Systemlauf) sieht man KEINE „nur ich“-Aufgabe. Wer eine fremde
// „nur ich“-Aufgabe schreiben will, bekommt 404 (lib/aufgaben/speicher.ts) — als gäbe es sie nicht.

/** Ist die Aufgabe selbst als „nur ich“ markiert? */
export const istNurIch = (t: Pick<Task, 'sichtbarkeit'> | undefined | null): boolean => t?.sichtbarkeit === 'nur-ich';

/**
 * Darf `person` die Aufgabe sehen? `nachId` = alle Aufgaben (für die Vorfahren einer Unteraufgabe). Seit 01.10. (mehrstufige
 * Unteraufgaben) gilt die ganze Kette: liegt IRGENDEIN Vorfahre auf „nur ich“ einer anderen Person, ist auch der Enkel
 * unsichtbar. Kreisfest (gesehene Einträge, höchstens 64 Schritte).
 */
export function darfSehen(t: Pick<Task, 'sichtbarkeit' | 'angelegtVon' | 'parentId'>, person: string | null | undefined, nachId?: ReadonlyMap<string, Pick<Task, 'sichtbarkeit' | 'angelegtVon' | 'parentId'>>): boolean {
  const fremd = (x: Pick<Task, 'sichtbarkeit' | 'angelegtVon'>) => istNurIch(x) && (!person || x.angelegtVon !== person);
  if (fremd(t)) return false;
  const gesehen = new Set<string>();
  let pid = t.parentId;
  for (let n = 0; pid && n < 64 && !gesehen.has(pid); n++) {
    gesehen.add(pid);
    const e = nachId?.get(pid);
    if (!e) break;
    if (fremd(e)) return false;
    pid = e.parentId;
  }
  return true;
}

/**
 * Wer darf die Aufgabe sehen — dieselbe Regel wie `darfSehen`, nur als Antwort statt als Ja/Nein (für Leser, die ALLE
 * Aufgaben bekommen und je Betrachter maskieren, z. B. die Lichtfäden):
 *   · `undefined` — keine „nur ich“-Markierung in der Kette (Aufgabe oder ein Vorfahre): alle dürfen sie sehen.
 *   · Speichername — genau diese Person (die Anlegerin der „nur ich“-Aufgabe bzw. des „nur ich“-Vorfahren).
 *   · `null` — niemand: „nur ich“ ohne bestimmbare Anlegerin (Altaufgabe ohne `angelegtVon`) oder zwei „nur ich“ in der
 *     Kette mit verschiedenen Anlegerinnen. Solche Aufgaben gehören in keine geteilte Sicht.
 * Es gilt immer: `darfSehen(t, p, nachId) === (b === undefined || b === p)` für jede Person `p`. Kreisfest wie `darfSehen`.
 */
export function nurIchBesitzer(t: Pick<Task, 'sichtbarkeit' | 'angelegtVon' | 'parentId'>, nachId?: ReadonlyMap<string, Pick<Task, 'sichtbarkeit' | 'angelegtVon' | 'parentId'>>): string | null | undefined {
  let besitzer: string | null | undefined;
  const pruefe = (x: Pick<Task, 'sichtbarkeit' | 'angelegtVon'>): boolean => {
    if (!istNurIch(x)) return true;
    if (!x.angelegtVon || (besitzer !== undefined && besitzer !== x.angelegtVon)) { besitzer = null; return false; }
    besitzer = x.angelegtVon;
    return true;
  };
  if (!pruefe(t)) return null;
  const gesehen = new Set<string>();
  let pid = t.parentId;
  for (let n = 0; pid && n < 64 && !gesehen.has(pid); n++) {
    gesehen.add(pid);
    const e = nachId?.get(pid);
    if (!e) break;
    if (!pruefe(e)) return null;
    pid = e.parentId;
  }
  return besitzer;
}

/** Der Bestand, wie `person` ihn sehen darf (null = Systemlauf: ohne alle „nur ich“-Aufgaben). Rein. */
export function sichtFuer<T extends TasksState>(state: T, person: string | null | undefined): T {
  if (!state.tasks.some(istNurIch)) return state;
  const nachId = new Map(state.tasks.map(t => [t.id, t]));
  return { ...state, tasks: state.tasks.filter(t => darfSehen(t, person, nachId)) };
}

/** Nur die Aufgaben-Liste filtern (für Leser, die schon eine Liste haben). */
export function aufgabenFuerPerson<T extends Pick<Task, 'id' | 'sichtbarkeit' | 'angelegtVon' | 'parentId'>>(tasks: readonly T[], person: string | null | undefined): T[] {
  if (!tasks.some(istNurIch)) return [...tasks];
  const nachId = new Map(tasks.map(t => [t.id, t]));
  return tasks.filter(t => darfSehen(t, person, nachId));
}

/** Orte von Hand (Board › Ort) — entscheiden bei Altaufgaben mit, ob sie im Business liegen. */
export async function orgZuordnung(): Promise<Record<string, string>> {
  const f = await loadJson<{ orgs?: Record<string, string> }>('ordnung');
  return f?.orgs && typeof f.orgs === 'object' ? f.orgs : {};
}

/**
 * Personen des Haushalts des Inhabers (Speichername + Anzeigename), der Inhaber zuerst — für „eine Verantwortliche“
 * (Prüfung + Auflösen von „both“) und Meldungen. Ohne Konten: leer (dann wird nichts umgewandelt und nichts geprüft).
 */
export async function haushaltsPersonen(): Promise<{ speicher: string; name: string }[]> {
  const { konten } = await ladeKonten();
  const inhaber = konten.find(k => k.rolle === 'inhaber');
  if (!inhaber) return [];
  return konten
    .filter(k => k.speicher === inhaber.speicher || (!!inhaber.haushalt && k.haushalt === inhaber.haushalt))
    .sort((a, b) => Number(b.rolle === 'inhaber') - Number(a.rolle === 'inhaber'))
    .map(k => ({ speicher: k.speicher, name: k.name }));
}
/** Nur die Speichernamen (Inhaber zuerst). */
export const haushaltsSpeicher = async (): Promise<string[]> => (await haushaltsPersonen()).map(p => p.speicher);

/**
 * Den Bestand lesen — übernommen (Space, Unteraufgaben, „both“ aufgelöst …), noch nicht gespeichert. MIT Papierkorb und
 * OHNE Sichtfilter: nur Schreibwege in der Sperre und Server-Teile, die selbst je Person filtern.
 */
export async function ladeAufgaben(orgs?: Record<string, string>): Promise<TasksState> {
  const roh = await loadJson<TasksState>(AUFGABEN_BESTAND_NAME);
  return uebernehmen(alsStand(roh), orgs ?? await orgZuordnung(), await haushaltsSpeicher()).state;
}

/**
 * Die Sicht für alle LESER: übernommen, OHNE Papierkorb und durch den Sichtfilter „nur ich“ der Person (29.09.).
 * `person` ist Pflicht: `null` = Systemlauf → keine „nur ich“-Aufgabe. So kann kein Leser den Filter vergessen.
 */
export async function ladeAufgabenSicht(person: string | null, orgs?: Record<string, string>): Promise<TasksState> {
  return sichtFuer(aufgabenSicht(await ladeAufgaben(orgs)), person);
}

/**
 * Ohne Papierkorb, aber OHNE Sichtfilter — nur für Systemläufe, die je Aufgabe selbst mit `darfSehen` filtern (z. B. der
 * ZOE-Lauf im Namen der jeweiligen Auftraggeberin). Nie an eine Person oder ein Modell weitergeben, ohne zu filtern.
 */
export async function ladeAufgabenUngefiltert(orgs?: Record<string, string>): Promise<TasksState> {
  return aufgabenSicht(await ladeAufgaben(orgs));
}
