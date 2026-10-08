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
import { hauptInhaber, kontenImHaushaltDerInhaber } from '@/lib/zugang/inhaber';
import type { Task, TasksState } from '@/types/tasks';
import { uebernehmen } from './struktur';
import { aufgabenSicht } from './papierkorb';
import { istNurIch, darfSehen } from './sicht-regel';

export const AUFGABEN_BESTAND_NAME = 'tasks';
const leer = (): TasksState => ({ projects: [], tasks: [], listen: [], statusEigen: [], gruppen: [], vorlagen: [] });
export const alsStand = (roh: TasksState | null | undefined): TasksState => (roh && Array.isArray(roh.tasks) ? roh : { ...leer(), ...(roh ?? {}), tasks: [] });

// ── Sichtbarkeit „nur ich“ (29.09., Kevin) — der EINE Filter für alle Lesepfade ──────────────
// Eine Aufgabe mit `sichtbarkeit: 'nur-ich'` sieht nur ihre Anlegerin (`angelegtVon`); ihre Unteraufgaben auf allen
// Ebenen erben das (sichtbar nur, wenn alle Vorfahren es sind). Ohne Person (Systemlauf) sieht man KEINE „nur ich“-Aufgabe. Wer eine fremde
// „nur ich“-Aufgabe schreiben will, bekommt 404 (lib/aufgaben/speicher.ts) — als gäbe es sie nicht.

export { istNurIch, darfSehen, nurIchBesitzer } from './sicht-regel';

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
 * Personen des Haushalts des Inhabers (Speichername + Anzeigename), der Haupt-Inhaber zuerst — für „eine Verantwortliche“
 * (Prüfung + Auflösen von „both“) und Meldungen. Ohne Konten: leer (dann wird nichts umgewandelt und nichts geprüft).
 * Seit 09.10. (mehrere Inhaber): genau EINER steht vorn — der Haupt-Inhaber (lib/zugang/inhaber.ts), danach die übrigen Inhaber,
 * dann alle anderen, je in der Reihenfolge des Bestands. Mit einem Inhaber dieselbe Liste wie vorher.
 */
export async function haushaltsPersonen(): Promise<{ speicher: string; name: string }[]> {
  const st = await ladeKonten();
  const haupt = hauptInhaber(st);
  if (!haupt) return [];
  const rang = (k: { speicher: string; rolle: string }) => (k.speicher === haupt.speicher ? 0 : k.rolle === 'inhaber' ? 1 : 2);
  return kontenImHaushaltDerInhaber(st)
    .sort((a, b) => rang(a) - rang(b))
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
  return mitNeutralenListen(sichtFuer(aufgabenSicht(await ladeAufgaben(orgs)), person), person);
}

/**
 * Eigene Ziele nur geteilt (08.10., Gegenprüfung): die Aufgaben-Liste eines Meilensteins, der an einem nicht geteilten eigenen Ziel
 * einer anderen Person hängt (Altbestand), trägt für `person` nur einen neutralen Namen (`LISTE_NICHT_GETEILT`) — ohne Person
 * (Systemlauf) gilt das für jede Liste eines Meilensteins an einem eigenen Ziel. Kann der Bestand nicht gelesen werden, wird JEDE
 * Meilenstein-Liste neutral benannt (nie Titel auf Verdacht). Für jede Ausgabe des Aufgaben-Bestands an eine Person.
 */
export async function mitNeutralenListen<S extends TasksState>(state: S, person: string | null): Promise<S> {
  const [{ verborgeneMeilensteinListenFuer }, { listenFuerBetrachter }, { MS_LISTE_PRAEFIX }] = await Promise.all([
    import('@/lib/planung/eigene-ziele-sicht-server'), import('@/lib/planung/eigene-ziele-sicht'), import('@/lib/planung/meilenstein-aufgaben'),
  ]);
  const v = await verborgeneMeilensteinListenFuer(person);
  return listenFuerBetrachter(state, v ?? new Set((state.listen ?? []).filter(l => l.id.startsWith(MS_LISTE_PRAEFIX)).map(l => l.id)));
}

/** Bestände, von denen `mitNeutralenListen` abhängt (für ETags von Aufgaben-Antworten; Konten stehen dort schon). */
export async function neutraleListenStandNamen(): Promise<string[]> {
  const { speicherFuer } = await import('@/lib/zoe/raum');
  return ['meilensteine', 'ziele', ...(await haushaltsSpeicher()).map(p => speicherFuer('ziele-eigen', p))];
}

/**
 * Ohne Papierkorb, aber OHNE Sichtfilter — nur für Systemläufe, die je Aufgabe selbst mit `darfSehen` filtern (z. B. der
 * ZOE-Lauf im Namen der jeweiligen Auftraggeberin). Nie an eine Person oder ein Modell weitergeben, ohne zu filtern.
 */
export async function ladeAufgabenUngefiltert(orgs?: Record<string, string>): Promise<TasksState> {
  return aufgabenSicht(await ladeAufgaben(orgs));
}

/**
 * Kennungen der Aufgaben, die `person` NICHT sehen darf (fremde „nur ich“ samt Teilbaum) — auch im Papierkorb (08.10.,
 * Sicht-Prüfung Malin). Für Bestände, die per `aufgabeId` an Aufgaben hängen (Aufgaben-Dateien): ein Eintrag an einer
 * verborgenen Aufgabe gibt es für diese Person nicht (Liste ohne ihn, Einzelzugriff 404).
 */
export async function verborgeneAufgabenFuer(person: string): Promise<Set<string>> {
  const { tasks } = await ladeAufgaben();
  if (!tasks.some(istNurIch)) return new Set();
  const nachId = new Map(tasks.map(t => [t.id, t]));
  return new Set(tasks.filter(t => !darfSehen(t, person, nachId)).map(t => t.id));
}
