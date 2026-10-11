// ─── Heute: die Top 3 des Tages — reine Regeln (10.10., Branch `heute-top3`) ────────────────────────────────────────────────────
// Kevin 08.10. (Fragebogen): „Top-3 Prioritäten, von ZOE vorgeschlagen“ und „Täglich Top-3 festlegen; Prioritäten (Eisenhower) sichtbarer“.
// ZOE schlägt drei Aufgaben vor — als REGELWERK, ohne Modell (nichts geht an die KI, kein Aufruf je Seitenaufruf); die Person übernimmt, tauscht
// oder legt selbst fest. Festgelegt wird je Person, Tag und Bereich (Privat · Business getrennt) im Bestand `heute-top3--<person>`.
//
// Rein und client-sicher: die Rangfolge, die Gründe, die Prüfung der Wahl, die Datei-Form. Laden und Schreiben: ./top3-server.ts.
//
// Rangfolge: zuerst das Eisenhower-Feld (q1 wichtig & dringend → q2 wichtig → q3 dringend → q4), darin die Punkte (höher = weiter oben;
// ein Vorschlag braucht mindestens `VORSCHLAG_AB`):
//   überfällig 50 (+1 je Tag, höchstens +10) · heute fällig 40 · morgen 24 · in zwei Tagen 16
//   kritisch 30 · hoch 14
//   Meilenstein-Frist: überschritten/heute 26 · ≤ 3 Tage 22 · ≤ 7 Tage 16 · ≤ 14 Tage 8        (macht die Aufgabe „wichtig“ bis 7 Tage)
//   blockiert andere: 8 + 4 je wartender Aufgabe, höchstens 24                                     (macht die Aufgabe „wichtig“)
// Nie vorgeschlagen: erledigt/abgebrochen, wartend, wartet auf eine andere Aufgabe, bei ZOE in Arbeit, fremde Zuständigkeit, Archiv/Papierkorb.
// Eine Unteraufgabe nur, wenn sie selbst fällig (heute/überfällig) oder kritisch ist.

import type { Task } from '@/types/tasks';
import type { Eisenhower } from '@/lib/agenten/typen';
import { aufgabeEinordnung, quadrantRang } from '@/lib/aufgaben/eisenhower';
import { wartetAuf } from '@/lib/aufgaben/abhaengig';
import { spaceVonAufgabe } from '@/lib/make-one/space-regeln';

export const TOP3_MAX = 3;
/** So viele Aufgaben bietet „Tauschen“ an. */
export const TOP3_AUSWAHL_MAX = 24;
/** Ein Vorschlag braucht mindestens so viele Punkte — nichts Beliebiges „zur Auffüllung“. */
export const VORSCHLAG_AB = 10;
/** So lange bleiben festgelegte Tage im Bestand (danach fallen sie beim Schreiben heraus). */
export const TOP3_TAGE_BEHALTEN = 45;

export type TopBereich = 'privat' | 'business';
export const istTopBereich = (v: unknown): v is TopBereich => v === 'privat' || v === 'business';

// ── Was an den Browser geht ───────────────────────────────────────────────────────────────────────────────────────────────────

/** Eine Aufgabe in den Top 3 (Vorschlag, Festlegung, Auswahl) — nur, was die Karte zeigt. */
export interface Top3Zeile {
  id: string;
  titel: string;
  /** Titel des Projekts (nur zum Einordnen). */
  projekt?: string;
  bereich: TopBereich;
  /** Deadline YYYY-MM-DD. */
  faellig?: string;
  quadrant: Eisenhower;
  kritisch: boolean;
  /** Warum (höchstens zwei Gründe, „ · “ getrennt): „überfällig seit 2 Tagen · kritisch“. */
  grund: string;
  erledigt: boolean;
}
export interface Top3Festlegung { zeilen: Top3Zeile[]; am: string; von: 'vorschlag' | 'hand' }
export interface Top3Block {
  bereich: TopBereich;
  /** ZOEs Vorschlag — nur Offenes, höchstens drei, kann leer sein. */
  vorschlag: Top3Zeile[];
  festgelegt: Top3Festlegung | null;
  /** Aufgaben zum Auswählen/Tauschen, die beste zuerst. */
  auswahl: Top3Zeile[];
  /** Stand der Festlegung (`am`, sonst ''), kommt beim Ändern mit zurück — veraltet → 409. */
  stand: string;
}

// ── Kandidaten ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface Top3Kontext {
  heute: string;
  person: string;
  /** Kennung → Zahl offener Aufgaben, die auf sie warten. */
  blockiert: ReadonlyMap<string, number>;
  /** Kennung der Meilenstein-Liste (`lm-…`) → Frist (YYYY-MM-DD) des offenen Meilensteins. */
  msFrist: ReadonlyMap<string, string>;
  /** Orte von Hand (lib/aufgaben/sicht.ts `orgZuordnung`) — für den Bereich einer Altaufgabe. */
  orgs?: Record<string, string>;
}
export interface Top3Kandidat extends Omit<Top3Zeile, 'grund' | 'erledigt'> { punkte: number; gruende: string[]; erledigt: false }

const TAG = /^\d{4}-\d{2}-\d{2}$/;
/** Tage von `von` bis `bis` (negativ = `bis` liegt davor). Beide YYYY-MM-DD. */
export const tageZwischen = (von: string, bis: string): number => Math.round((Date.parse(`${bis}T12:00:00Z`) - Date.parse(`${von}T12:00:00Z`)) / 864e5);
const mehrzahl = (n: number, e: string, m: string) => `${n} ${n === 1 ? e : m}`;

export const istOffen = (t: Pick<Task, 'status' | 'archiviertAm' | 'geloeschtAm'>): boolean => t.status !== 'done' && t.status !== 'cancelled' && !t.archiviertAm && !t.geloeschtAm;

/** Die Kennzahlen jeder Aufgabe der Person (auch der wartenden) für das Tages-Briefing: überfällig, heute fällig, kritisch. */
export function aufgabenZaehler(tasks: readonly Task[], person: string, bereich: TopBereich, heute: string, orgs: Record<string, string> = {}): { ueberfaellig: number; heuteFaellig: number; kritisch: number } {
  let ueberfaellig = 0, heuteFaellig = 0, kritisch = 0;
  for (const t of tasks) {
    if (!istOffen(t) || t.assignee !== person || spaceVonAufgabe(t, orgs) !== bereich) continue;
    const f = t.dueDate && TAG.test(t.dueDate.slice(0, 10)) ? t.dueDate.slice(0, 10) : '';
    if (f && f < heute) ueberfaellig++;
    else if (f === heute) heuteFaellig++;
    if (t.priority === 'critical') kritisch++;
  }
  return { ueberfaellig, heuteFaellig, kritisch };
}

/** Wie viele offene Aufgaben auf jede andere warten (nur das, was in `tasks` steht — die Sicht der Person). */
export function blockiertJeAufgabe(tasks: readonly Pick<Task, 'id' | 'status' | 'abhaengigVon' | 'archiviertAm' | 'geloeschtAm'>[]): Map<string, number> {
  const offen = new Set(tasks.filter(istOffen).map(t => t.id));
  const m = new Map<string, number>();
  for (const t of tasks) {
    if (!istOffen(t)) continue;
    for (const id of t.abhaengigVon ?? []) if (offen.has(id)) m.set(id, (m.get(id) ?? 0) + 1);
  }
  return m;
}

interface Grund { text: string; gewicht: number }

/** Punkte und Gründe einer Aufgabe; `wichtigWeil` = ein Grund jenseits der Priorität (Meilenstein-Frist, blockiert andere). */
function bewerten(t: Task, k: Top3Kontext): { punkte: number; gruende: Grund[]; wichtigWeil: boolean } {
  const g: Grund[] = [];
  let wichtigWeil = false;
  const f = t.dueDate && TAG.test(t.dueDate.slice(0, 10)) ? t.dueDate.slice(0, 10) : '';
  if (f) {
    const d = tageZwischen(k.heute, f);
    if (d < 0) g.push({ gewicht: 50 + Math.min(-d, 10), text: d === -1 ? 'überfällig seit gestern' : `überfällig seit ${-d} Tagen` });
    else if (d === 0) g.push({ gewicht: 40, text: 'heute fällig' });
    else if (d === 1) g.push({ gewicht: 24, text: 'morgen fällig' });
    else if (d === 2) g.push({ gewicht: 16, text: 'in 2 Tagen fällig' });
  }
  if (t.priority === 'critical') g.push({ gewicht: 30, text: 'kritisch' });
  else if (t.priority === 'high') g.push({ gewicht: 14, text: 'hohe Priorität' });
  const ms = t.listeId ? k.msFrist.get(t.listeId) : undefined;
  if (ms) {
    const d = tageZwischen(k.heute, ms);
    if (d <= 14) {
      g.push({ gewicht: d <= 0 ? 26 : d <= 3 ? 22 : d <= 7 ? 16 : 8, text: d < 0 ? 'Meilenstein-Frist überschritten' : d === 0 ? 'Meilenstein-Frist heute' : `Meilenstein-Frist in ${d} Tagen` });
      if (d <= 7) wichtigWeil = true;
    }
  }
  const n = k.blockiert.get(t.id) ?? 0;
  if (n > 0) { g.push({ gewicht: Math.min(8 + 4 * n, 24), text: `blockiert ${mehrzahl(n, 'andere Aufgabe', 'andere Aufgaben')}` }); wichtigWeil = true; }
  return { punkte: g.reduce((s, x) => s + x.gewicht, 0), gruende: g.sort((a, b) => b.gewicht - a.gewicht), wichtigWeil };
}

/**
 * Alle Aufgaben, die als Top 3 in Frage kommen — in diesem Bereich, der Person zugewiesen, offen und machbar —, die beste zuerst
 * (Feld der Eisenhower-Matrix q1 → q4, dann Punkte, dann Deadline, dann Titel — seit 11.10.). Aufgaben ohne jeden Grund stehen mit 0 Punkten am Ende
 * (zum Selbst-Auswählen); vorgeschlagen werden nur welche ab `VORSCHLAG_AB`.
 */
export function top3Kandidaten(tasks: readonly Task[], bereich: TopBereich, k: Top3Kontext, projektTitel: (id: string) => string | undefined = () => undefined): Top3Kandidat[] {
  const aus: Top3Kandidat[] = [];
  for (const t of tasks) {
    if (!istOffen(t) || t.assignee !== k.person || spaceVonAufgabe(t, k.orgs ?? {}) !== bereich) continue;
    if (t.status === 'blocked' || wartetAuf(t, tasks).length) continue; // Wartendes kann man heute nicht tun
    if (t.zoe && (t.zoe.status === 'offen' || t.zoe.status === 'in_arbeit')) continue; // liegt bei ZOE
    const b = bewerten(t, k);
    // Eine Unteraufgabe nur, wenn sie selbst drängt.
    if (t.parentId) {
      const f = t.dueDate ? t.dueDate.slice(0, 10) : '';
      if (!(t.priority === 'critical' || (f && f <= k.heute))) continue;
    }
    const e = aufgabeEinordnung(t, k.heute, b.wichtigWeil);
    aus.push({
      id: t.id, titel: t.title, ...(projektTitel(t.projectId) ? { projekt: projektTitel(t.projectId) } : {}), bereich,
      ...(t.dueDate && TAG.test(t.dueDate.slice(0, 10)) ? { faellig: t.dueDate.slice(0, 10) } : {}),
      quadrant: e.quadrant, kritisch: e.kritisch, punkte: b.punkte, gruende: b.gruende.map(x => x.text), erledigt: false,
    });
  }
  // Prüf-Fund 11.10.: ZUERST das Feld der Eisenhower-Matrix (q1 → q4), DANN die Punkte — sonst stand eine nur dringende Aufgabe (q3,
  // „heute fällig“) vor einer kritischen in fünf Tagen (q2).
  return aus.sort((a, b) => quadrantRang(a.quadrant) - quadrantRang(b.quadrant) || b.punkte - a.punkte || (a.faellig ?? '9').localeCompare(b.faellig ?? '9') || a.titel.localeCompare(b.titel, 'de') || a.id.localeCompare(b.id));
}

/** ZOEs Vorschlag: die besten drei ab `VORSCHLAG_AB`. */
export const top3Vorschlag = (kandidaten: readonly Top3Kandidat[]): Top3Kandidat[] => kandidaten.filter(k => k.punkte >= VORSCHLAG_AB).slice(0, TOP3_MAX);

/** Ein Kandidat als Zeile für den Browser (höchstens zwei Gründe). */
export const alsZeile = (k: Top3Kandidat): Top3Zeile => ({
  id: k.id, titel: k.titel, ...(k.projekt ? { projekt: k.projekt } : {}), bereich: k.bereich, ...(k.faellig ? { faellig: k.faellig } : {}),
  quadrant: k.quadrant, kritisch: k.kritisch, grund: k.gruende.slice(0, 2).join(' · '), erledigt: false,
});

/** Eine festgelegte Aufgabe als Zeile — auch eine erledigte (sie bleibt als Haken stehen) und auch ohne Grund. */
export function festgelegteZeile(t: Task, bereich: TopBereich, k: Top3Kontext, projektTitel: (id: string) => string | undefined = () => undefined): Top3Zeile {
  const b = bewerten(t, k);
  const e = aufgabeEinordnung(t, k.heute, b.wichtigWeil);
  return {
    id: t.id, titel: t.title, ...(projektTitel(t.projectId) ? { projekt: projektTitel(t.projectId) } : {}), bereich,
    ...(t.dueDate && TAG.test(t.dueDate.slice(0, 10)) ? { faellig: t.dueDate.slice(0, 10) } : {}),
    quadrant: e.quadrant, kritisch: e.kritisch, grund: b.gruende.slice(0, 2).map(x => x.text).join(' · '), erledigt: t.status === 'done',
  };
}

// ── Die Datei `heute-top3--<person>` ─────────────────────────────────────────────────────────────────────────────────────────

export interface Top3Wahl { ids: string[]; am: string; von: 'vorschlag' | 'hand' }
export interface Top3Datei { v: 1; tage: Record<string, Partial<Record<TopBereich, Top3Wahl>>> }

const ID = /^[\w.:~-]{1,120}$/;
export const leereTop3Datei = (): Top3Datei => ({ v: 1, tage: {} });

/** Säubert eine gelesene Datei (nichts Fremdes durchlassen, keine Doppelten, höchstens drei je Tag) — verwirft nie einen gültigen Tag. */
export function top3Saeubern(roh: unknown): Top3Datei {
  const aus = leereTop3Datei();
  const tage = (roh && typeof roh === 'object' ? (roh as { tage?: unknown }).tage : null);
  if (!tage || typeof tage !== 'object') return aus;
  for (const [tag, v] of Object.entries(tage as Record<string, unknown>)) {
    if (!TAG.test(tag) || !v || typeof v !== 'object') continue;
    for (const b of ['privat', 'business'] as const) {
      const w = (v as Record<string, unknown>)[b] as Partial<Top3Wahl> | undefined;
      if (!w || typeof w !== 'object' || !Array.isArray(w.ids)) continue;
      const ids = Array.from(new Set(w.ids.filter((x): x is string => typeof x === 'string' && ID.test(x)))).slice(0, TOP3_MAX);
      if (!ids.length || typeof w.am !== 'string') continue;
      (aus.tage[tag] ??= {})[b] = { ids, am: w.am.slice(0, 40), von: w.von === 'vorschlag' ? 'vorschlag' : 'hand' };
    }
  }
  return aus;
}

/** Prüft die Kennungen einer Wahl (Browser → Server): ein bis drei, keine Doppelten, gültige Form — sonst 400 mit Text (nichts wird gekürzt). */
export function top3Pruefen(ids: unknown): { ok: true; ids: string[] } | { ok: false; fehler: string } {
  if (!Array.isArray(ids)) return { ok: false, fehler: 'ids muss eine Liste sein.' };
  if (ids.length === 0) return { ok: false, fehler: 'Mindestens eine Aufgabe festlegen — oder zurücksetzen.' };
  if (ids.length > TOP3_MAX) return { ok: false, fehler: `Abgelehnt: höchstens ${TOP3_MAX} Aufgaben (es waren ${ids.length}).` };
  if (!ids.every(x => typeof x === 'string' && ID.test(x))) return { ok: false, fehler: 'Eine Kennung hat keine gültige Form.' };
  if (new Set(ids as string[]).size !== ids.length) return { ok: false, fehler: 'Eine Aufgabe steht doppelt in der Liste.' };
  return { ok: true, ids: ids as string[] };
}

/** Festlegen (`wahl`) oder zurücksetzen (`null`) für einen Tag und Bereich; Tage jenseits von `TOP3_TAGE_BEHALTEN` fallen heraus. Rein. */
export function top3Setzen(d: Top3Datei, tag: string, bereich: TopBereich, wahl: Top3Wahl | null): Top3Datei {
  const grenze = new Date(Date.parse(`${tag}T12:00:00Z`) - TOP3_TAGE_BEHALTEN * 864e5).toISOString().slice(0, 10);
  const tage: Top3Datei['tage'] = {};
  for (const [t, v] of Object.entries(d.tage)) if (t >= grenze) tage[t] = { ...v };
  const heute = { ...(tage[tag] ?? {}) };
  if (wahl) heute[bereich] = wahl; else delete heute[bereich];
  if (Object.keys(heute).length) tage[tag] = heute; else delete tage[tag];
  return { v: 1, tage };
}
