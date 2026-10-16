// ─── Zahlenziel ↔ gemessener Ist-Wert (16.10., Abnahme 2 · C17, rein, client-sicher) ───────────────────────────────────
// „Wiederkehrender Umsatz 25.000 € je Monat: 33 %“ stand da, während die Mandate schon 5.950 € MRR tragen (≈ 24 %). Der Fortschritt eines
// Ziels bleibt EINE Regel (Meilensteine + Unterziele, lib/planung/meilenstein-aufgaben.ts `zielFortschrittAusTeilen`) — keine neue Formel. Ein
// Zahlenziel kann zusätzlich eine Messgröße tragen (`Ziel.messgroesse`); dann steht der gemessene Ist-Wert DANEBEN: „Ist 5.950 € = 24 %“.
// Neue Messgröße = Zeile in MESSGROESSEN + Wert im Server (lib/lichtfaeden/seil-server.ts `istWerte`).

export const MESSGROESSEN = {
  mrr: { label: 'Wiederkehrender Umsatz je Monat (aktive Mandate, netto)', einheit: 'euro' as const },
} as const;
export type Messgroesse = keyof typeof MESSGROESSEN;
export const istMessgroesse = (v: unknown): v is Messgroesse => typeof v === 'string' && Object.prototype.hasOwnProperty.call(MESSGROESSEN, v);

export type IstWerte = Partial<Record<Messgroesse, number | null>>;

const euro = (n: number) => `${Math.round(n).toLocaleString('de-DE')} €`;

/** Ist eines Zahlenziels: Wert, Anteil am Zielwert (0–100, gerundet) und der Satz „Ist 5.950 € = 24 %“ — null ohne Messgröße, Zielwert oder Messung. */
export function zielIst(z: { messgroesse?: string; zielwert?: number }, werte: IstWerte): { wert: number; anteil: number; text: string } | null {
  if (!istMessgroesse(z.messgroesse) || !(typeof z.zielwert === 'number' && z.zielwert > 0)) return null;
  const w = werte[z.messgroesse];
  if (typeof w !== 'number' || !Number.isFinite(w)) return null;
  const anteil = Math.max(0, Math.round((100 * w) / z.zielwert));
  return { wert: w, anteil, text: `Ist ${euro(w)} = ${anteil} %` };
}
