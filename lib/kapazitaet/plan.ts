// ─── MAKE OS — Kapazität: der festgehaltene Wochenplan (rein, getestet, client-sicher) ─
// Kevin 05.10.: „Jeden Montag wird der Wochenplan festgehalten → echte Plan-Treue ‚geplant vs. Ist‘.“
//
//   Festhalten   Der Morgenlauf (montags bzw. der erste Lauf der Woche, idempotent) legt je Person den Plan der laufenden
//                Woche ab: verplante Stunden je Meilenstein/Ziel und je Zuweisung (Mandat/Kunde), dazu die verfügbare Zeit.
//                Bestand `kapazitaet-plan--<haushalt>` (Server: lib/kapazitaet/server.ts `kapaPlanFesthalten`).
//   Verfügbar    = Netto (Soll − Abwesenheit − Termine − Umschalten − Blöcke) — bewusst OHNE „Kopf & Energie“: der Faktor stammt
//                aus Gesundheitsdaten (Art. 9) und wird nie gespeichert.
//   Plan-Treue   = Σ gemessene Business-Fokuszeit ÷ Σ geplante Stunden der abgeschlossenen, festgehaltenen Wochen (letzte 4),
//                nur Personen mit Konto (nur sie können messen) und nur Tage ab dem Festhalten (`ab`). Ohne festgehaltene Woche
//                bleibt die bisherige Näherung (Ø Ist 4 Wochen ÷ Ø Plan nächste 4 Wochen) — klar als Näherung beschriftet.
//   Löschfrist   24 Monate (`PLAN_LOESCHEN_NACH_MONATEN`), Team-Personen ohne Konto mit ihren übrigen Kapazitätsdaten 30 Tage nach
//                dem Deaktivieren; Art. 15 über die Kapazitäts-Auskunft (lib/kapazitaet/aufraeumen.ts).

import { montagVon, tagPlus } from '@/lib/zeit/kalender-kern';
import type { PlanDatei, PlanPerson, PlanSchnappschuss, TreueWoche, WochenPlan } from './typen';

/** So lange bleiben festgehaltene Wochenpläne (Kevin 05.10.: „Löschfrist z. B. 24 Monate“). */
export const PLAN_LOESCHEN_NACH_MONATEN = 24;
/** Wie viele abgeschlossene Wochen die Plan-Treue zurückschaut (wie die Näherung). */
export const TREUE_WOCHEN = 4;
/** Höchstens so viele Wochen im Bestand (24 Monate ≈ 105 Wochen + Puffer) — Schutz gegen Wachstum ohne Ende. */
export const MAX_PLAN_WOCHEN = 120;

const TAG = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[A-Za-z0-9_~:.-]{1,80}$/;
const r1 = (n: number) => Math.round(n * 10) / 10;
const zahl = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? r1(Math.min(v, 10_000)) : 0);

export const LEERER_PLAN: PlanDatei = { wochen: [] };

/** Den Wochenplan des Stands als Schnappschuss — nur Personen mit Kapazität, nur Kennungen (keine Titel, keine Namen). */
export function schnappschussAus(plan: WochenPlan, erstellt: string): PlanSchnappschuss {
  return {
    woche: plan.woche, ab: plan.ab, erstellt,
    personen: plan.personen.map(p => ({
      id: p.id, quelle: p.quelle, verfuegbar: r1(p.verfuegbar), geplant: r1(p.geplant), gebunden: r1(p.gebunden),
      posten: p.posten.filter(x => x.stunden > 0).map(x => ({ art: x.art, id: x.id, stunden: r1(x.stunden) })),
      zuweisungen: p.zuweisungen.filter(x => x.stunden > 0).map(x => ({ id: x.id, stunden: r1(x.stunden) })),
    })),
  };
}

/** Säubern beim Lesen: Unbrauchbares fällt weg, je Woche höchstens ein Eintrag (der erste), sortiert nach Woche. */
export function sauberPlanDatei(roh: unknown): PlanDatei {
  const w = (roh as PlanDatei | null)?.wochen;
  if (!Array.isArray(w)) return { wochen: [] };
  const gesehen = new Set<string>();
  const wochen: PlanSchnappschuss[] = [];
  for (const s of w) {
    if (!s || typeof s !== 'object' || !TAG.test(String(s.woche)) || gesehen.has(s.woche)) continue;
    gesehen.add(s.woche);
    const personen: PlanPerson[] = (Array.isArray(s.personen) ? s.personen : []).filter(p => p && ID.test(String(p.id))).map(p => ({
      id: p.id, quelle: p.quelle === 'team' ? 'team' as const : 'konto' as const,
      verfuegbar: zahl(p.verfuegbar), geplant: zahl(p.geplant), gebunden: zahl(p.gebunden),
      posten: (Array.isArray(p.posten) ? p.posten : []).filter(x => x && ID.test(String(x.id)) && (x.art === 'meilenstein' || x.art === 'ziel')).map(x => ({ art: x.art, id: x.id, stunden: zahl(x.stunden) })),
      zuweisungen: (Array.isArray(p.zuweisungen) ? p.zuweisungen : []).filter(x => x && ID.test(String(x.id))).map(x => ({ id: x.id, stunden: zahl(x.stunden) })),
    }));
    wochen.push({ woche: s.woche, ab: TAG.test(String(s.ab)) && s.ab >= s.woche ? s.ab : s.woche, erstellt: typeof s.erstellt === 'string' ? s.erstellt : '', personen });
  }
  wochen.sort((a, b) => a.woche.localeCompare(b.woche));
  return { wochen };
}

/** Erster Tag, der noch bleibt: heute − 24 Monate (Monatsende sauber: 31.03. − 1 Monat → 28./29.02.). */
export function planAufbewahrenAb(heute: string, monate = PLAN_LOESCHEN_NACH_MONATEN): string {
  const j = Number(heute.slice(0, 4)), m = Number(heute.slice(5, 7)) - 1 - monate, t = Number(heute.slice(8, 10));
  const d = new Date(Date.UTC(j, m, 1));
  const letzter = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), Math.min(t, letzter))).toISOString().slice(0, 10);
}

export interface PlanSchritt { datei: PlanDatei; neu: boolean; entfernt: number; geaendert: boolean }

/**
 * Der Morgenlauf-Schritt (rein): den Plan der laufenden Woche festhalten, falls er für diese Woche noch fehlt (idempotent —
 * ein zweiter Lauf ändert nichts, auch nicht am Mittwoch), und Wochen jenseits der Löschfrist entfernen.
 * `plan` = der Wochenplan des aktuellen Stands (`KapaStand.wochenPlan`), `null` = nichts festzuhalten.
 */
export function planFesthalten(roh: unknown, plan: WochenPlan | null, heute: string, erstellt: string): PlanSchritt {
  const alt = sauberPlanDatei(roh);
  const ab = planAufbewahrenAb(heute);
  let wochen = alt.wochen.filter(s => tagPlus(s.woche, 6) >= ab);
  const woche = montagVon(heute);
  const neu = !!plan && plan.woche === woche && plan.personen.length > 0 && !wochen.some(s => s.woche === woche);
  if (neu) wochen = [...wochen, schnappschussAus(plan as WochenPlan, erstellt)].sort((a, b) => a.woche.localeCompare(b.woche));
  if (wochen.length > MAX_PLAN_WOCHEN) wochen = wochen.slice(wochen.length - MAX_PLAN_WOCHEN);
  const entfernt = alt.wochen.length + (neu ? 1 : 0) - wochen.length;
  return { datei: { wochen }, neu, entfernt, geaendert: neu || entfernt > 0 };
}

/** Plan-Einträge dieser Personen entfernen (Löschfrist deaktivierter Team-Personen) — `teile` = wie viele Personen-Wochen wegfielen. */
export function planOhnePersonen(roh: unknown, ids: ReadonlySet<string>): { datei: PlanDatei; teile: number } {
  const d = sauberPlanDatei(roh);
  let teile = 0;
  const wochen = d.wochen.map(s => {
    const personen = s.personen.filter(p => !ids.has(p.id));
    teile += s.personen.length - personen.length;
    return personen.length === s.personen.length ? s : { ...s, personen };
  });
  return { datei: { wochen }, teile };
}

/** Die festgehaltenen Wochen einer Person (Art. 15) — nur ihre Zeilen. */
export function planFuerPerson(roh: unknown, id: string): ({ woche: string; ab: string } & Omit<PlanPerson, 'id' | 'quelle'>)[] {
  return sauberPlanDatei(roh).wochen.flatMap(s => s.personen.filter(p => p.id === id).map(({ id: _i, quelle: _q, ...rest }) => ({ woche: s.woche, ab: s.ab, ...rest })));
}

/**
 * Plan-Treue der abgeschlossenen, festgehaltenen Wochen (die letzten `TREUE_WOCHEN` vor der laufenden). Nur Personen mit Konto,
 * nur Ist-Tage ab dem Festhalten. Wochen ohne Geplantes zählen nicht.
 */
export function treueAusPlaenen(plaene: readonly PlanSchnappschuss[], ist: readonly { person: string; tag: string; stunden: number }[], heute: string): TreueWoche[] {
  const start = montagVon(heute);
  const vor = tagPlus(start, -7 * TREUE_WOCHEN);
  return plaene.filter(s => s.woche >= vor && s.woche < start).sort((a, b) => a.woche.localeCompare(b.woche)).map(s => {
    const konten = s.personen.filter(p => p.quelle === 'konto');
    const ids = new Set(konten.map(p => p.id));
    const bis = tagPlus(s.woche, 6);
    const gemessen = ist.filter(x => ids.has(x.person) && x.tag >= s.ab && x.tag <= bis).reduce((a, x) => a + x.stunden, 0);
    return { woche: s.woche, geplant: r1(konten.reduce((a, p) => a + p.geplant, 0)), ist: r1(gemessen), personen: ids.size };
  }).filter(w => w.geplant > 0);
}
