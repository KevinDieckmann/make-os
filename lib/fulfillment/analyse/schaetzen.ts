// ─── Fulfillment · Analyse — Kostenschätzung je Lauf (C3, 10.10.; FULFILLMENT_KONZEPT.md 4.2) — rein ──────────────────────────────────────
// Kevin 22:30: „JEDER Lauf wird einzeln bestätigt — je Lauf Kostenschätzung anzeigen, Start erst nach Klick auf genau diesen Lauf.“
//   · Token über `kostenSchaetzen` (lib/ki/kosten.ts, Katalogpreise × Kurs der Instanz), Suchen 10 US-Dollar je 1.000 Suchen (MODELLE.md).
//   · Liegen ≥ 3 gemessene Läufe desselben Agenten vor (Instanz, alle Dossiers), gilt ihr MEDIAN statt der Vorgabe — „die Schätzung lernt“.
//   · Angezeigt: „ca. x“ und „höchstens y“ mit y = 1,5 × bestätigter Betrag — die harte Kostengrenze des Laufs.
// Alle Beträge in EURO-Cent (die Person bestätigt in Euro); die Schleife misst in US-Cent → `inUsdCent`/`inEuroCent` (EINE Umrechnung).

import { kostenSchaetzen, inEuroCent, euroText, usdEurKurs } from '@/lib/ki/kosten';
import type { AnalyseAgentId } from '../typen';
import { AGENTEN } from './agenten';

/** Suchen: 10 US-Dollar je 1.000 Suchen = 1 US-Cent je Suche (MODELLE.md, P-Repo). */
export const SUCHE_USD_CENT = 1;
/** Die Grenze des Laufs ist das 1,5-fache des bestätigten Betrags. */
export const GRENZE_FAKTOR = 1.5;
/** Ab so vielen gemessenen Läufen zählt der Median statt der Vorgabe. */
export const MESSUNGEN_AB = 3;
/** Untergrenze der Grenze (ein sehr billiger Lauf soll nicht an Rundungen scheitern). */
export const GRENZE_MIN_CENT = 5;

export interface LaufSchaetzung {
  agent: AnalyseAgentId;
  /** Euro-Cent (ungerundet, für die Rechnung). */
  euroCent: number;
  /** Ganze Euro-Cent, die die Person bestätigt (aufgerundet). */
  cent: number;
  /** Höchstens (Grenze) in ganzen Euro-Cent. */
  hoechstensCent: number;
  text: string;
  hoechstensText: string;
  quelle: 'vorgabe' | 'gemessen' | 'ohne-kosten';
  modell?: string;
  messungen: number;
}

/** Median (rein). */
export function median(x: readonly number[]): number {
  const s = [...x].filter(n => Number.isFinite(n) && n >= 0).sort((a, b) => a - b);
  if (!s.length) return 0;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Die Grenze zu einem bestätigten Betrag (ganze Euro-Cent). */
export const grenzeCent = (bestaetigtCent: number): number => Math.max(GRENZE_MIN_CENT, Math.ceil(Math.max(0, bestaetigtCent) * GRENZE_FAKTOR));

/**
 * Die Schätzung eines Laufs (rein). `messungen` = gemessene Kosten (Euro-Cent) früherer, abgeschlossener Läufe DESSELBEN Agenten;
 * `modelle` = wirksames Modell je Stufe (lib/ki/modelle.ts `stufenModelle`), `tiefenberichtModell` für den Tiefenbericht.
 */
export function schaetzen(agent: AnalyseAgentId, o: { messungen: readonly number[]; modelle: Record<'schnell' | 'ausgewogen' | 'stark', string>; tiefenberichtModell?: string; kurs?: number }): LaufSchaetzung {
  const a = AGENTEN[agent];
  const kurs = o.kurs ?? usdEurKurs();
  const fertig = (euroCent: number, quelle: LaufSchaetzung['quelle'], modell?: string): LaufSchaetzung => {
    const cent = Math.ceil(Math.max(0, euroCent));
    const hoechstensCent = quelle === 'ohne-kosten' ? 0 : grenzeCent(cent);
    return {
      agent, euroCent, cent, hoechstensCent, quelle, messungen: o.messungen.length, ...(modell ? { modell } : {}),
      text: quelle === 'ohne-kosten' ? 'ohne Kosten' : euroText(cent, true), hoechstensText: quelle === 'ohne-kosten' ? 'ohne Kosten' : euroText(hoechstensCent),
    };
  };
  if (a.art === 'regel') return fertig(0, 'ohne-kosten');
  if (a.art === 'tiefenbericht') {
    const modell = o.tiefenberichtModell ?? 'deep-research-preview-04-2026';
    return fertig(kostenSchaetzen({ faehigkeit: 'tiefenbericht', modell }, kurs).euroCent, 'vorgabe', modell);
  }
  const modell = o.modelle[a.stufe ?? 'ausgewogen'];
  if (o.messungen.length >= MESSUNGEN_AB) return fertig(median(o.messungen), 'gemessen', modell);
  const token = kostenSchaetzen({ faehigkeit: 'text', modell, tokenEin: a.schaetzung.tokenEin, tokenAus: a.schaetzung.tokenAus }, kurs).euroCent;
  const suchen = inEuroCent(a.schaetzung.suchen * SUCHE_USD_CENT, kurs);
  return fertig(token + suchen, 'vorgabe', modell);
}
