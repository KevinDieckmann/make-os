// ─── Kalender — Modus Kalender · Planen · Aufgaben (rein, getestet, 29.09., K5) ─
// Kevin 29.09. (Google-Kalender-Vorbild): rechts im Kopf ein Umschalter mit zwei Symbolen — Kalender | Aufgaben.
// Entscheidung: „Planen“ ist ein Unter-Modus des KALENDERS (dasselbe Zeitraster, Blöcke platzieren); „Aufgaben“ ist die
// andere Seite des Umschalters (Aufgaben nach Fälligkeit, wie Google Tasks). Aufgaben und Planen schließen sich also aus:
//   ?modus=planen    Kalender-Symbol aktiv, Planen an
//   ?modus=aufgaben  Aufgaben-Symbol aktiv (Planen aus)
//   (ohne)           Kalender
// Aufgaben-Filter in der Adresse (auch aus der Gegenrichtung, /os/aufgaben → Kalender): `as` Space, `ap` Projekt,
// `al` Liste, `wer` meine|beteiligt|alle; Bereich wie im Kalender über `space` (privat|business).
// Die Aufgaben selbst sind dieselben wie überall: Sichtbarkeit/Sicht/Bereich/Suche aus K3 (lib/kalender/aufgaben.ts),
// Abhaken/Einplanen/Öffnen über `useAufgabenImKalender` (Aufgaben-Schreibweg + Rückgängig) — hier nur Vorfilter und Gruppen.

import type { Task } from '@/types/tasks';
import { istTag, prioRang } from '@/lib/aufgaben/ansichten';
import { montagVon, tagPlus } from '@/lib/zeit/kalender-kern';

export type Modus = 'kalender' | 'planen' | 'aufgaben';

/** Die Ansichten des Kalenders (Kürzel d/x/w/m/y/a). */
export const KALENDER_ANSICHTEN = ['tag', 'vier', 'woche', 'monat', 'jahr', 'agenda'] as const;
export type KalenderAnsicht = (typeof KALENDER_ANSICHTEN)[number];

/**
 * Ansicht beim Öffnen: die gemerkte Wahl, sonst Woche am Rechner und Tag am Handy (Gesamtprüfung 29.09.: vorher blieb
 * ohne gemerkte Wahl auch am Rechner „Tag“ stehen — `useBreit` meldet beim ersten Zeichnen immer „schmal“).
 */
export function startAnsicht(gemerkt: string | null | undefined, breit: boolean): KalenderAnsicht {
  return (KALENDER_ANSICHTEN as readonly string[]).includes(gemerkt ?? '') ? (gemerkt as KalenderAnsicht) : breit ? 'woche' : 'tag';
}
export type WerFilter = 'alle' | 'meine' | 'beteiligt';

export interface ModusAdresse { modus: Modus; as?: string; ap?: string; al?: string; wer?: WerFilter; space?: 'privat' | 'business'; tag?: string }

const KENNUNG = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/;
/** Ein echter Kalendertag (nicht nur das Muster: 2026-13-99 fällt weg). */
const echterTag = (v: string | null): v is string => { if (!v || !istTag(v)) return false; const t = Date.parse(`${v}T12:00:00Z`); return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === v; };
const k = (v: string | null): string | undefined => (v && KENNUNG.test(v) ? v : undefined);

/** Adresse lesen (URLSearchParams oder ?…-Text). Unbekanntes fällt weg. */
export function modusAusAdresse(q: URLSearchParams | string): ModusAdresse {
  const p = typeof q === 'string' ? new URLSearchParams(q.startsWith('?') ? q.slice(1) : q) : q;
  const m = p.get('modus');
  const wer = p.get('wer');
  const space = p.get('space');
  const tag = p.get('tag');
  return {
    modus: m === 'planen' || m === 'aufgaben' ? m : 'kalender',
    ...(k(p.get('as')) ? { as: k(p.get('as')) } : {}), ...(k(p.get('ap')) ? { ap: k(p.get('ap')) } : {}), ...(k(p.get('al')) ? { al: k(p.get('al')) } : {}),
    ...(wer === 'meine' || wer === 'beteiligt' || wer === 'alle' ? { wer } : {}),
    ...(space === 'privat' || space === 'business' ? { space } : {}),
    ...(echterTag(tag) ? { tag } : {}),
  };
}

/** Adresse des Kalenders (Pfad + Parameter) — auch für den Schalter in den Aufgaben. */
export function kalenderLink(a: Partial<ModusAdresse> = {}): string {
  const q = new URLSearchParams();
  if (a.modus && a.modus !== 'kalender') q.set('modus', a.modus);
  if (a.tag) q.set('tag', a.tag);
  if (a.space) q.set('space', a.space);
  if (a.as) q.set('as', a.as);
  if (a.ap) q.set('ap', a.ap);
  if (a.al) q.set('al', a.al);
  if (a.wer && a.wer !== 'alle') q.set('wer', a.wer);
  const t = q.toString();
  return `/os/kalender${t ? `?${t}` : ''}`;
}

export interface Vorfilter { as?: string; ap?: string; al?: string; wer: WerFilter; ich: string }

/**
 * Die Filter, die NUR der Aufgaben-Modus hat (Space, Projekt, Liste, meine/beteiligt) — vor den gemeinsamen Regeln von
 * K3 (lib/kalender/aufgaben.ts `aufgabenFuerKalender`/`ohneTermin`: offen, Sicht, Bereich, Suche, Papierkorb, „nur ich“).
 */
export function aufgabenVorfiltern(tasks: readonly Task[], f: Vorfilter): Task[] {
  return tasks.filter(t => (!f.as || t.spaceId === f.as)
    && (!f.ap || t.projectId === f.ap)
    && (!f.al || t.listeId === f.al)
    && (f.wer === 'alle' || (f.wer === 'meine' ? !!f.ich && (t.assignee === f.ich || t.assignee === 'both') : !!f.ich && (t.beteiligte ?? []).includes(f.ich))));
}

export type FaelligGruppe = 'ueberfaellig' | 'heute' | 'woche' | 'spaeter' | 'ohne';
export const FAELLIG_GRUPPEN: readonly { id: FaelligGruppe; label: string }[] = [
  { id: 'ueberfaellig', label: 'Überfällig' }, { id: 'heute', label: 'Heute' }, { id: 'woche', label: 'Diese Woche' }, { id: 'spaeter', label: 'Später' }, { id: 'ohne', label: 'Ohne Datum' },
];

/** In welche Gruppe gehört eine Deadline? „Diese Woche“ = nach heute bis Sonntag dieser (Berliner) Woche. */
export function faelligGruppe(tag: string | undefined | null, heute: string): FaelligGruppe {
  const d = tag?.slice(0, 10);
  if (!d || !istTag(d)) return 'ohne';
  if (d < heute) return 'ueberfaellig';
  if (d === heute) return 'heute';
  return d <= tagPlus(montagVon(heute), 6) ? 'woche' : 'spaeter';
}

/** Gruppen nach Fälligkeit (Aufgaben mit Deadline aus `aufgabenFuerKalender`, ohne aus `ohneTermin`), je Gruppe nach Tag, Uhrzeit, Priorität, Titel. */
export function faelligGruppen<A extends { id: string; title: string; tag?: string; zeit?: string; priority?: string }>(mitDeadline: readonly A[], ohne: readonly A[], heute: string): Record<FaelligGruppe, A[]> {
  const r: Record<FaelligGruppe, A[]> = { ueberfaellig: [], heute: [], woche: [], spaeter: [], ohne: [...ohne] };
  for (const a of mitDeadline) r[faelligGruppe(a.tag, heute)].push(a);
  const ordnen = (a: A, b: A) => (a.tag ?? '9999').localeCompare(b.tag ?? '9999') || (a.zeit ?? '99').localeCompare(b.zeit ?? '99') || prioRang(a.priority) - prioRang(b.priority) || a.title.localeCompare(b.title, 'de') || a.id.localeCompare(b.id);
  for (const g of ['ueberfaellig', 'heute', 'woche', 'spaeter'] as const) r[g].sort(ordnen);
  return r;
}
