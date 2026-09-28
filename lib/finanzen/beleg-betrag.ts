// ─── MAKE OS — Beträge eines gelesenen Belegs (28.09., K3) ──────────────────
// /api/beleg liest brutto, netto und USt-Satz; /api/beleg/uebernehmen schreibt
// daraus eine Rechnung oder Buchung. Vorher wurde der Rechnungsbetrag auf ganze
// Euro gerundet und ein reiner Nettobetrag als brutto übernommen. Jetzt:
// auf den Cent, brutto/netto nur über lib/finanzen/ust.ts.
//
// Rein (keine Server-Importe) — getestet in tests/beleg-betrag.test.ts.

import { aufCent, bruttoAusNetto, nettoAusBrutto, UST_REGEL } from './ust';

export interface BelegBetragEingabe {
  /** Bruttobetrag vom Beleg (bevorzugt). */
  betragBrutto?: unknown;
  /** Nettobetrag vom Beleg (nur, wenn kein brutto gelesen wurde). */
  betragNetto?: unknown;
  /** USt-Satz vom Beleg in Prozent (0–30). */
  ustSatz?: unknown;
  /** Altes Feld: ein Betrag ohne Angabe — gilt als brutto. */
  betrag?: unknown;
}

export interface BelegBetrag {
  /** Rechnungsbetrag brutto in €, auf den Cent. */
  brutto: number;
  /** Netto in €, auf den Cent — nur mit bekanntem Satz (Nettobetrag ist ab „gestellt“ festgeschrieben, nie raten). */
  netto?: number;
  /** Der USt-Satz, auf dem netto beruht. */
  ustSatz?: number;
}

const positiv = (v: unknown): number | undefined => {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 && n < 1e9 ? n : undefined;
};
const satzAus = (v: unknown): number | undefined => {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 30 ? n : undefined;
};

/**
 * Brutto (auf den Cent) und — wo belastbar — netto + Satz aus den gelesenen Werten.
 * brutto gelesen → brutto; netto nur mit Satz vom Beleg.
 * nur netto gelesen → brutto = bruttoAusNetto(netto, Satz; ohne Satz Regelsatz), netto + Satz werden mitgeführt.
 * Nichts Plausibles → null.
 */
export function belegBetrag(e: BelegBetragEingabe): BelegBetrag | null {
  const satz = satzAus(e.ustSatz);
  const brutto = positiv(e.betragBrutto) ?? positiv(e.betrag);
  if (brutto !== undefined) {
    const b = aufCent(brutto);
    if (b <= 0) return null;
    return satz === undefined ? { brutto: b } : { brutto: b, netto: nettoAusBrutto(b, satz), ustSatz: satz };
  }
  const netto = positiv(e.betragNetto);
  if (netto === undefined) return null;
  const n = aufCent(netto);
  if (n <= 0) return null;
  const s = satz ?? UST_REGEL;
  return { brutto: bruttoAusNetto(n, s), netto: n, ustSatz: s };
}

/** Anzeige „1.190,50 €“ für Rückmeldungen. */
export const euroText = (euro: number): string => `${euro.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
