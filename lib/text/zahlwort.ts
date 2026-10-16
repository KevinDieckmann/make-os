// ─── Zahl + Wort — Einzahl/Mehrzahl und Satzende an EINER Stelle (16.10., Abnahme 2 · C6, rein, client-sicher) ─────────
// Vorher stand je Ort ein eigenes `n === 1 ? … : …` — oder keins: „1 Mandate mit offenen Punkten“, „1 Widersprüche“, „1 offenen
// Rechnungen“, „3 Kontoen“. Neue Zähltexte nehmen `anzahl(n, einzahl, mehrzahl)`; ein Satz, der auf ein Datum endet („… 12.10.“),
// bekommt seinen Punkt über `satz()` — nie „12.10..“. Wächter: tests/zahlwort.test.ts.

/** „1 Mandat“ · „2 Mandate“ · „0 Mandate“ (Zahl deutsch formatiert). */
export function anzahl(n: number, einzahl: string, mehrzahl: string): string {
  return `${Number.isFinite(n) ? n.toLocaleString('de-DE') : '—'} ${n === 1 ? einzahl : mehrzahl}`;
}

/** Nur das Wort in der richtigen Zahl („Mandat“ bzw. „Mandate“). */
export const wort = (n: number, einzahl: string, mehrzahl: string): string => (n === 1 ? einzahl : mehrzahl);

/** Ein Satz mit genau einem Schlusszeichen: endet er schon auf „.“, „!“, „?“ oder „…“ (etwa nach „12.10.“), kommt keins dazu. */
export function satz(t: string): string {
  const s = t.trimEnd();
  return /[.!?…]$/.test(s) ? s : `${s}.`;
}
