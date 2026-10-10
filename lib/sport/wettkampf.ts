// ─── Sport · Wettkampf-Rechner: Ziel ehrlich neben die Prognose, Pacing, Taper-Tage (rein, getestet, 09.10.2026) ──────────
// Wunsch der trainierenden Person (09.10.): Wettkampf-Ziel mit Datum, Distanz, Zielzeit → Ziel-Pace und Countdown; aus einer Referenzzeit
// (z. B. 10 km) eine realistische Prognose — „Ziel und Prognose ehrlich nebeneinander“ —, ein Pacing-Hinweis (gleichmäßig starten, negativer
// Split) und eine Taper-Woche für die letzten 7 Tage.
//
// Prognose = Riegel-Hochrechnung (lib/sport/pace.ts `riegel`) als SPANNE: Exponent 1,06 (Riegel 1981, gut ausdauertrainiert) bis 1,09 (vorsichtig
// bei weniger Umfang) — die Spanne ist eine eigene Annahme. Referenz: eigene Angabe am Ziel → Bestzeit der letzten 180 Tage (5/10/21,1 km,
// die zur Zieldistanz nächste) → Ausgangswert aus dem Einstieg. Taper-Tage sind ein allgemeiner Vorschlag (Umfang runter, ein paar kurze
// Reize im Renntempo, Ruhe am Vortag-Vortag) — keine Trainingsberatung, die Person ändert jeden Tag.

import type { PlanEinheit, PlanTag, SportStand, Ziel } from './modell';
import { saeuberePlanTag } from './modell';
import { bestzeiten, formatPace, formatZeit, paceSekProKm, riegel, tagPlus, zielPace } from './pace';
import { tagAus } from './plan-bau';

export const RIEGEL_SPANNE = { von: 1.06, bis: 1.09 } as const;

export interface Referenz { distanzKm: number; sek: number; quelle: 'eingabe' | 'bestzeit' | 'ausgang'; datum?: string }

/** Die Referenz für die Prognose eines Lauf-Ziels (siehe Kopf) — null ohne jede Zeit. */
export function referenzFuer(stand: Pick<SportStand, 'laeufe' | 'ausgang'>, ziel: Pick<Ziel, 'distanzKm' | 'referenz'>, heute: string): Referenz | null {
  if (ziel.referenz) return { ...ziel.referenz, quelle: 'eingabe' };
  const d = ziel.distanzKm ?? 10;
  const frisch = stand.laeufe.filter(l => l.datum >= tagPlus(heute, -180));
  const best = bestzeiten(frisch).filter(b => b.distanzKm <= d + 0.05);
  if (best.length) { const b = best.sort((x, y) => Math.abs(d - x.distanzKm) - Math.abs(d - y.distanzKm))[0]; return { distanzKm: b.distanzKm, sek: b.sek, quelle: 'bestzeit', datum: b.datum }; }
  if (stand.ausgang.lauf10kSek && d >= 10) return { distanzKm: 10, sek: stand.ausgang.lauf10kSek, quelle: 'ausgang' };
  if (stand.ausgang.lauf5kSek) return { distanzKm: 5, sek: stand.ausgang.lauf5kSek, quelle: 'ausgang' };
  return null;
}

export type Einschaetzung = 'vorsichtig' | 'realistisch' | 'ambitioniert' | 'sehr-ambitioniert' | 'offen';
export const EINSCHAETZUNG_LABEL: Record<Einschaetzung, string> = {
  vorsichtig: 'vorsichtig', realistisch: 'realistisch', ambitioniert: 'ambitioniert', 'sehr-ambitioniert': 'sehr ambitioniert', offen: 'ohne Prognose',
};

export interface Split { km: number; sek: number }
export interface WettkampfRechnung {
  distanzKm: number;
  ziel?: { sek: number; pace: number };
  referenz?: Referenz;
  prognose?: { von: number; bis: number; paceVon: number; paceBis: number };
  einschaetzung: Einschaetzung;
  /** Empfohlene Pace für die erste Hälfte (gleichmäßig, eher etwas langsamer) und die Splits danach. */
  startPace?: number;
  splits: Split[];
  /** Kurze, ehrliche Sätze für die Oberfläche. */
  saetze: string[];
}

const SPLIT_KM = (d: number) => [5, 10, 15, 20, 25, 30, 35, 40].filter(k => k < d - 0.05).concat([d]);

/** Rechnung für ein Lauf-Ziel (Distanz nötig). `startAufschlag` = Sekunden je km, die die erste Hälfte langsamer läuft (Vorgabe 5). */
export function wettkampfRechnung(stand: Pick<SportStand, 'laeufe' | 'ausgang'>, ziel: Ziel, heute: string, startAufschlag = 5): WettkampfRechnung | null {
  if (ziel.art !== 'lauf' || !ziel.distanzKm) return null;
  const d = ziel.distanzKm;
  const zp = zielPace(ziel);
  const ref = referenzFuer(stand, ziel, heute);
  const prognose = ref ? (() => {
    const von = riegel(ref.sek, ref.distanzKm, d, RIEGEL_SPANNE.von), bis = riegel(ref.sek, ref.distanzKm, d, RIEGEL_SPANNE.bis);
    return { von, bis, paceVon: von / d, paceBis: bis / d };
  })() : undefined;
  let e: Einschaetzung = 'offen';
  if (prognose && ziel.zielzeitSek) {
    const z = ziel.zielzeitSek;
    e = z > prognose.bis ? 'vorsichtig' : z >= prognose.von ? 'realistisch' : z >= prognose.von * 0.97 ? 'ambitioniert' : 'sehr-ambitioniert';
  }
  // Wonach die erste Hälfte läuft: das Ziel, wenn es realistisch/vorsichtig ist; sonst das schnelle Ende der Prognose — „gleichmäßig starten“.
  const ambitioniert = e === 'ambitioniert' || e === 'sehr-ambitioniert';
  const basis = ambitioniert && prognose ? prognose.paceVon : (zp ?? prognose?.paceVon);
  const startPace = basis ? basis + startAufschlag : undefined;
  // Splits: erste Hälfte mit Start-Pace, zweite Hälfte so, dass die Endzeit das Ziel (bzw. das schnelle Ende der Prognose) trifft — negativer Split.
  const endZeit = ambitioniert && prognose ? prognose.von : (ziel.zielzeitSek ?? prognose?.von);
  const splits: Split[] = [];
  if (startPace && endZeit) {
    const haelfte = d / 2;
    const zweite = Math.max(1, (endZeit - startPace * haelfte) / (d - haelfte));
    for (const km of SPLIT_KM(d)) splits.push({ km, sek: Math.round(km <= haelfte ? km * startPace : haelfte * startPace + (km - haelfte) * zweite) });
  }
  const saetze: string[] = [];
  if (ziel.zielzeitSek && zp) saetze.push(`Ziel ${formatZeit(ziel.zielzeitSek)} = ${formatPace(zp)} min/km.`);
  if (prognose && ref) saetze.push(`Prognose ${formatZeit(prognose.von)}–${formatZeit(prognose.bis)} (${formatPace(prognose.paceVon)}–${formatPace(prognose.paceBis)} min/km) aus ${ref.distanzKm.toLocaleString('de-DE')} km in ${formatZeit(ref.sek)}.`);
  if (!prognose) saetze.push('Für eine Prognose fehlt eine Referenzzeit — trag am Ziel z. B. deine aktuelle 10-km-Zeit ein.');
  if (e === 'ambitioniert' || e === 'sehr-ambitioniert') saetze.push(`Das Ziel liegt ${formatZeit(prognose!.von - ziel.zielzeitSek!)} unter der schnellen Prognose — ${EINSCHAETZUNG_LABEL[e]}. Gleichmäßig starten und erst ab der zweiten Hälfte zulegen, wenn es läuft.`);
  if (e === 'realistisch') saetze.push('Das Ziel passt zur Prognose — gleichmäßig laufen, zweite Hälfte gleich schnell oder schneller.');
  if (e === 'vorsichtig') saetze.push('Das Ziel liegt über der Prognose — Luft für eine schnellere zweite Hälfte.');
  if (startPace) saetze.push(`Erste Hälfte nicht schneller als ${formatPace(startPace)} min/km — die meisten Rennen gehen am Anfang zu schnell verloren.`);
  return {
    distanzKm: d, ...(ziel.zielzeitSek && zp ? { ziel: { sek: ziel.zielzeitSek, pace: zp } } : {}), ...(ref ? { referenz: ref } : {}), ...(prognose ? { prognose } : {}),
    einschaetzung: e, ...(startPace ? { startPace } : {}), splits, saetze,
  };
}

// ── Taper-Tage ───────────────────────────────────────────────────────────────

const E = (id: string, sparte: PlanEinheit['sparte'], typ: PlanEinheit['typ'], dauerMin: number, extra: Partial<PlanEinheit> = {}): PlanEinheit => ({ id, sparte, ...(typ ? { typ } : {}), dauerMin, ...extra });

/**
 * Die letzten Tage vor einem Wettkampf als Vorschlag (k = Tage bis zum Wettkampf): Lauf-Ziel bzw. Hyrox. Tage vor `heute` bleiben weg (die
 * Vergangenheit wird nie umgeplant); der Tag danach ist Ruhe. Rückgabe: Datum → Plan-Tag — übernommen mit dem Schritt `plan-tage`.
 */
export function taperTage(ziel: Pick<Ziel, 'id' | 'art' | 'datum' | 'zielzeitSek' | 'titel'>, heute: string): Record<string, PlanTag> {
  if (!ziel.datum) return {};
  const wk = Math.max(20, Math.round((ziel.zielzeitSek ?? 0) / 60) || (ziel.art === 'hyrox' ? 90 : 60));
  const lauf = ziel.art !== 'hyrox';
  const vorschlag: Record<number, PlanTag> = lauf ? {
    6: tagAus([E('tp-6', 'lauf', 'locker', 40, { zone: 2 })]),
    5: tagAus([E('tp-5', 'lauf', 'tempo', 35, { notiz: 'kurze Abschnitte im Renntempo, z. B. 3 × 1 km' })]),
    4: tagAus([E('tp-4', 'mobility', 'mobility', 20)]),
    3: tagAus([E('tp-3', 'lauf', 'locker', 30, { notiz: 'mit 3–4 kurzen Steigerungen' })]),
    2: { art: 'ruhe' },
    1: tagAus([E('tp-1', 'lauf', 'locker', 20, { notiz: 'locker, 2–3 Steigerungen' })]),
    0: tagAus([E('tp-0', 'lauf', 'wettkampf', wk, { notiz: ziel.titel.slice(0, 200) })]),
    [-1]: tagAus([E('tp-n1', 'mobility', 'erholung', 20)]),
  } : {
    6: tagAus([E('tp-6', 'lauf', 'locker', 40, { zone: 2 })]),
    5: tagAus([E('tp-5', 'hyrox', 'technik', 30, { notiz: 'Stationen kurz und sauber, kein Maximaltempo' })]),
    4: { art: 'ruhe' },
    3: tagAus([E('tp-3', 'lauf', 'locker', 30, { notiz: 'mit 3–4 kurzen Steigerungen' })]),
    2: tagAus([E('tp-2', 'mobility', 'mobility', 20)]),
    1: tagAus([E('tp-1', 'hyrox', 'technik', 20, { notiz: 'Aktivierung: locker + 2–3 Stationen kurz' })]),
    0: tagAus([E('tp-0', 'hyrox', 'wettkampf', wk, { notiz: ziel.titel.slice(0, 200) })]),
    [-1]: tagAus([E('tp-n1', 'mobility', 'erholung', 20)]),
  };
  const r: Record<string, PlanTag> = {};
  for (const [k, t] of Object.entries(vorschlag)) {
    const datum = tagPlus(ziel.datum, -Number(k));
    if (datum >= heute) r[datum] = t;
  }
  return r;
}

/** Ist der Taper dieses Ziels schon übernommen? (alle vorgeschlagenen Tage ab heute stehen so im Plan) */
export function taperUebernommen(stand: Pick<SportStand, 'tage'>, ziel: Parameters<typeof taperTage>[0], heute: string): boolean {
  const t = taperTage(ziel, heute);
  const tage = Object.keys(t);
  const gleich = (a: PlanTag | undefined, b: PlanTag) => !!a && JSON.stringify(saeuberePlanTag(a)) === JSON.stringify(saeuberePlanTag(b));
  return tage.length > 0 && tage.every(d => gleich(stand.tage?.[d], t[d]));
}

/** Pace-Text für eine Zeit über eine Distanz (für Splits/Anzeige). */
export const paceText = (sek: number, km: number) => formatPace(paceSekProKm(km, sek));
