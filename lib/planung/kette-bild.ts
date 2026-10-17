// ─── Planung · Ziel — die Meilenstein-Kette als Reise + Fluss (17.10., Kevins Miro-Standard für das ganze System) ─────────────────────────────────
// Kevin 17.10.: „Markttraktion-Kreislauf, Onboarding und Planung bekommen dieselbe Reise- und Ablauf-Darstellung.“ Ein Ziel öffnen → seine Meilensteine als
// EINE Zeile (components/os/ui/reise `ReiseBild`) in der Reihenfolge der Kette (`ketteOrdnen`: jeder nach seinen Vorgängern, bei Gleichstand nach Rang), darunter
// je Meilenstein höchstens vier Aufgaben als Kästchen (Rest „+n“), „Hier“ = der erste offene. Zwischen zwei Meilensteinen steht eine Raute, wenn der zweite auf
// den ersten wartet (Abhängigkeit, `wartetAuf`), sonst ein Pfeil. Ein Tipp auf einen Meilenstein zeigt seine Aufgaben als Fluss (oben → unten) bis zur Raute
// „erreicht?“. Das Seil bleibt im Jahr.
// Rein, client-sicher, NUR Darstellung: die Kette rechnet weiter lib/planung/meilenstein-kette.ts, die Aufgaben kommen über `aufgabenVonMeilenstein` (dieselbe
// Liste wie der Meilenstein selbst), gezählt wird mit `aufgabenStand`, abgeschlossen ist, was `istAbgeschlossen` sagt. Nichts wird gespeichert.

import { sichtbareKaestchen, type BildKaestchen, type BildSpalte, type FlussBild, type FlussKnotenBild, type KaestchenZustand, type ReiseZustand } from '@/lib/reise/bild';
import type { Meilenstein } from './typen';
import type { Task, TasksState } from '@/types/tasks';
import { aufgabenStand, aufgabenVonMeilenstein } from './meilenstein-aufgaben';
import { istAbgeschlossen, nachReihe } from '@/lib/aufgaben/struktur';
import { zieheInKette, wartet } from './meilenstein-kette';

/** Kennung der Raute „erreicht?“ am Ende des Flusses eines Meilensteins (das Detail ist dann der Meilenstein selbst). */
export const ERREICHT_PRAEFIX = 'ms-';
export const erreichtId = (msId: string) => `${ERREICHT_PRAEFIX}${msId}`;

export type KettenKnoten = FlussKnotenBild<KettenKnoten>;
export interface MeilensteinFluss extends FlussBild<KettenKnoten> { msId: string; naechster?: string }

const kurz = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;
const STATUS_TEXT: Partial<Record<Task['status'], string>> = { 'in-progress': 'in Arbeit', blocked: 'wartet', backlog: 'später' };

/** Die Hauptaufgaben eines Meilensteins in der Reihenfolge der Liste (Unteraufgaben zählen über ihre Hauptaufgabe). */
export function hauptaufgaben(state: Pick<TasksState, 'tasks'> | null, msId: string): Task[] {
  return state ? aufgabenVonMeilenstein(state, msId).filter(t => !t.parentId).sort(nachReihe) : [];
}

/**
 * Der erste offene Meilenstein der Kette, der auf nichts Offenes mehr wartet — „Hier“ (17.10., L2 C: vorher der erste offene, auch wenn er
 * laut `wartetAuf` noch auf einen anderen offenen wartete; dieselbe Regel `wartet` wie Glocke und Kalender). Wartet jeder, der erste offene.
 */
export const ersterOffener = (reihe: readonly Pick<Meilenstein, 'id' | 'erledigt' | 'wartetAuf'>[]): string | null =>
  (reihe.find(m => !m.erledigt && !wartet(m, reihe)) ?? reihe.find(m => !m.erledigt))?.id ?? null;

function aufgabeZustand(t: Task, hier: boolean): KaestchenZustand {
  if (t.status === 'cancelled') return 'entfaellt';
  if (t.status === 'done') return 'erledigt';
  return hier ? 'hier' : 'offen';
}
const ueberfaellig = (t: Task, heute: string) => !istAbgeschlossen(t) && !!t.dueDate && t.dueDate < heute;
const aufgabeUnter = (t: Task, heute: string): string | undefined => {
  if (ueberfaellig(t, heute)) return `überfällig seit ${kurz(t.dueDate!)}`;
  const s = [STATUS_TEXT[t.status], t.dueDate && !istAbgeschlossen(t) ? `bis ${kurz(t.dueDate)}` : null].filter(Boolean).join(' · ');
  return s || undefined;
};

/** Die Aufgaben eines Meilensteins als Kästchen bzw. Knoten — „hier“ = die erste offene im laufenden Meilenstein. */
function aufgabenKnoten(aufgaben: readonly Task[], laufend: boolean, heute: string): KettenKnoten[] {
  const erste = laufend ? aufgaben.find(t => !istAbgeschlossen(t))?.id : undefined;
  return aufgaben.map((t): KettenKnoten => {
    const unter = aufgabeUnter(t, heute);
    return { id: t.id, titel: t.title, form: 'schritt', zustand: aufgabeZustand(t, t.id === erste), ...(ueberfaellig(t, heute) ? { haengt: 'gelb' as const } : {}), ...(unter ? { unter } : {}) };
  });
}

/**
 * Die Kette als Reise-Zeile. `reihe` = `ketteOrdnen(…).reihe` (die Reihenfolge rechnet die Kette). Die Raute steht nur zwischen zwei Nachbarn der Kette,
 * die wirklich aufeinander warten — Vorgänger außerhalb des Ziels nennt der Fluss („Nach …“).
 */
export function ketteSpalten(reihe: readonly Meilenstein[], state: Pick<TasksState, 'tasks'> | null, heute: string): BildSpalte[] {
  const hier = ersterOffener(reihe);
  return reihe.map((m, i): BildSpalte => {
    const zustand: ReiseZustand = m.erledigt ? 'fertig' : m.id === hier ? 'jetzt' : 'offen';
    const aufgaben = hauptaufgaben(state, m.id);
    const alle: BildKaestchen[] = aufgabenKnoten(aufgaben, zustand === 'jetzt', heute).map(k => ({ id: k.id, titel: k.titel, zustand: k.zustand, ...(k.haengt ? { haengt: k.haengt } : {}), ...(k.unter ? { unter: k.unter } : {}) }));
    const zeigen = sichtbareKaestchen(alle, zustand);
    const st = aufgabenStand(aufgaben);
    const spaet = !m.erledigt && !!m.faellig && m.faellig < heute;
    const naechster = reihe[i + 1];
    const wartet = !!naechster && (naechster.wartetAuf ?? []).includes(m.id);
    const unter = m.erledigt ? 'erledigt' : [m.faellig ? `${spaet ? 'überfällig · ' : 'bis '}${kurz(m.faellig)}` : null, st.gesamt ? `${st.erledigt}/${st.gesamt}` : null].filter(Boolean).join(' · ') || undefined;
    return {
      id: m.id, nr: i + 1, titel: m.titel, zustand, kaestchen: zeigen, mehr: alle.length - zeigen.length, ...(unter ? { unter } : {}),
      ...(spaet ? { haengt: 'rot' as const } : alle.some(k => k.haengt) ? { haengt: 'gelb' as const } : {}),
      ...(wartet ? { raute: { titel: `„${naechster.titel}“ wartet darauf`, gegeben: !!m.erledigt, hier: zustand === 'jetzt', gegebenText: 'erledigt' } } : {}),
    };
  });
}

/** Die Aufgaben EINES Meilensteins als Fluss: Start (wonach er kommt), die Aufgaben, die Raute „erreicht?“, dann der nächste Meilenstein bzw. das Ziel. */
export function meilensteinFluss(reihe: readonly Meilenstein[], alle: readonly Pick<Meilenstein, 'id' | 'titel'>[], state: Pick<TasksState, 'tasks'> | null, heute: string, msId: string): MeilensteinFluss | null {
  const i = reihe.findIndex(m => m.id === msId);
  if (i < 0) return null;
  const m = reihe[i], nach = reihe[i + 1];
  const laufend = m.id === ersterOffener(reihe);
  const knoten = aufgabenKnoten(hauptaufgaben(state, m.id), laufend, heute);
  const vor = (m.wartetAuf ?? []).map(id => alle.find(x => x.id === id)?.titel).filter((t): t is string => !!t);
  const offenNoch = knoten.some(k => k.zustand === 'hier' || k.zustand === 'offen');
  const erreicht: KettenKnoten = {
    id: erreichtId(m.id), titel: `„${m.titel}“ erreicht?`, form: 'entscheidung', entscheid: true,
    zustand: m.erledigt ? 'erledigt' : laufend && !offenNoch ? 'hier' : 'offen',
    ...(m.faellig && !m.erledigt ? { unter: `${m.faellig < heute ? 'überfällig seit' : 'bis'} ${kurz(m.faellig)}` } : {}),
    ...(!m.erledigt && !!m.faellig && m.faellig < heute ? { haengt: 'rot' as const } : {}),
  };
  return {
    msId: m.id, nr: i + 1, titel: m.titel,
    start: vor.length ? { titel: 'Nach', unter: vor.map(t => `„${t}“`).join(', ') } : { titel: 'Start' },
    teile: knoten.length ? [{ art: 'linie', knoten }] : [], abstimmung: erreicht, abschluss: [],
    ende: nach ? { titel: nach.titel } : { titel: 'Ziel erreicht' },
    ...(nach ? { naechster: nach.id } : {}),
  };
}

// ── Ziehen in der Reise (17.10. Nachbesserung: „keine Funktion darf verloren gehen“) ─────────────────────────────────────────────────────────

/**
 * Wohin ein Meilenstein in der Reise gezogen wird — „hinter `nach`“ (null = an den Anfang) — als Ziel der Kette: die Kennung, an deren Platz er rückt
 * (`zieheInKette(…, aufId)`). Null, wenn er dort schon steht. Rein.
 */
export function kettenZiel(reihe: readonly Pick<Meilenstein, 'id'>[], id: string, nach: string | null): string | null {
  const von = reihe.findIndex(m => m.id === id);
  if (von < 0) return null;
  const ohne = reihe.filter(m => m.id !== id);
  const t = nach === null ? 0 : ohne.findIndex(m => m.id === nach) + 1;
  if ((nach !== null && t === 0) || t === von) return null;
  return reihe[t]?.id ?? null;
}

/**
 * Ziehen in der Reise: den Meilenstein `id` hinter `nach` setzen — über DIESELBE Regel wie bisher (`zieheInKette`, lib/planung/meilenstein-kette.ts: eine
 * Abhängigkeit geht vor, sonst null). Zurück kommt die ganze Liste mit neuen Rängen (für den vorhandenen Schreibweg `persistMs`).
 */
export function ziehInReise<M extends Pick<Meilenstein, 'id' | 'wartetAuf'> & { rang?: number }>(alle: readonly M[], reihe: readonly M[], id: string, nach: string | null): M[] | null {
  const auf = kettenZiel(reihe, id, nach);
  return auf ? zieheInKette(alle, reihe, id, auf) : null;
}
