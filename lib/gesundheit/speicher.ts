// ─── Gesundheits-Index — Laden (Server) ─────────────────────────────────────
// Die persönlichen Bestände einer Person (vitals, health-log, journal, haut,
// streak) plus die geteilten (Routinen, Wochenplan, Kalender, Meilensteine,
// Ernährung) zu einem Bestand; eigene Schwellen und Schnappschuss je Tag in
// `gesundheit-index[--person]` (lib/kennzahlen/speicher).

import { loadJson } from '@/lib/store/local-db';
import { speicherFuer } from '@/lib/jarvis/raum';
import { localDay } from '@/lib/zeit';
import type { VitalsLog } from '@/lib/vitals';
import type { PlanBlock } from '@/types/planer';
import type { ErnaehrungFile } from '@/lib/make-one/ernaehrung-data';
import { ladeIndexDatei, fortschreiben, speichereSchwelle, type IndexVerlauf } from '@/lib/kennzahlen/speicher';
import { berechneGesundheit, GESUNDHEIT_KENNZAHLEN, type GesundheitBestand, type GesundheitsIndex } from './index';
import type { HautLog, StreakLog, RoutinenLog } from './eintraege';

const name = (person: string) => speicherFuer('gesundheit-index', person);
const tagPlus = (t: string, n: number) => { const d = new Date(`${t}T12:00:00`); d.setDate(d.getDate() + n); return localDay(d); };

export async function ladeGesundheitBestand(person: string, heute = localDay()): Promise<GesundheitBestand> {
  const [vitals, log, journal, haut, streak, routinenF, plan, cal, ms, ern, datei] = await Promise.all([
    loadJson<VitalsLog>(speicherFuer('vitals', person)),
    loadJson<RoutinenLog>(speicherFuer('health-log', person)),
    loadJson<GesundheitBestand['journal']>(speicherFuer('journal', person)),
    loadJson<HautLog>(speicherFuer('haut', person)),
    loadJson<StreakLog>(speicherFuer('streak', person)),
    loadJson<{ routinen?: { id: string; label: string; wann?: string; aktiv: boolean; kategorie?: string }[] }>('routinen'),
    loadJson<Record<string, PlanBlock[]>>('wochenplan'),
    loadJson<{ events?: { title?: string; startDate?: string; endDate?: string; allDay?: boolean; owner?: string }[]; at?: string; quelle?: string }>('calendar-cache'),
    loadJson<{ meilensteine?: GesundheitBestand['meilensteine'] }>('meilensteine'),
    loadJson<ErnaehrungFile>('ernaehrung'),
    ladeIndexDatei(name(person)),
  ]);
  const ab = tagPlus(heute, -35);
  return {
    heute, person,
    vitals: vitals ?? {},
    // Gesundheits-Routinen der Person: aktiv und (ohne Kategorie = alt) oder Kategorie „gesundheit“.
    routinen: (routinenF?.routinen ?? []).filter(r => r.aktiv && (!r.kategorie || r.kategorie === 'gesundheit')).map(r => ({ id: r.id, label: r.label, wann: r.wann, kategorie: r.kategorie })),
    log: log ?? {},
    journal: journal ?? {},
    haut: haut ?? {},
    streak: streak ?? {},
    bloecke: Object.entries(plan ?? {}).filter(([woche]) => woche >= tagPlus(ab, -7)).flatMap(([, l]) => (l ?? []).filter(x => x.date >= ab)).map(x => ({ date: x.date, dauerMin: x.dauerMin, art: x.art, titel: x.titel })),
    termine: (cal?.events ?? []).filter(e => e.startDate && !e.allDay).map(e => ({ start: e.startDate!, ende: e.endDate, title: e.title, owner: e.owner })),
    kalenderFrisch: !!cal?.at && (Date.now() - new Date(cal.at).getTime()) / 3_600_000 < 48,
    meilensteine: ms?.meilensteine ?? [],
    ernaehrung: ern ?? null,
    schwellen: datei.schwellen,
  };
}

export interface GesundheitStand extends IndexVerlauf { pi: GesundheitsIndex; person: string }

/** Rechnen, Schnappschuss des Tages festhalten (nur wenn es Werte gibt), Verlauf liefern. */
export async function gesundheitStand(person: string, heute = localDay()): Promise<GesundheitStand> {
  const [b, d] = await Promise.all([ladeGesundheitBestand(person, heute), ladeIndexDatei(name(person))]);
  const pi = berechneGesundheit(b);
  const hatWerte = Object.keys(b.vitals).length > 0 || Object.keys(b.log).length > 0 || Object.keys(b.journal).length > 0;
  const v = await fortschreiben(name(person), d, pi, heute, hatWerte);
  return { pi, person, ...v };
}

/** Nur rechnen — für den Wachstums-Score. */
export async function gesundheitsIndexFuer(person: string, heute = localDay()): Promise<GesundheitsIndex> {
  return berechneGesundheit(await ladeGesundheitBestand(person, heute));
}

export function speichereGesundheitSchwelle(person: string, roh: Record<string, unknown>) {
  return speichereSchwelle(name(person), GESUNDHEIT_KENNZAHLEN, roh);
}
