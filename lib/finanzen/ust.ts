// ─── MAKE OS — Umsatzsteuer: EINE Funktion für brutto/netto (28.09., K3) ────
// Prüfbericht #79/#80: brutto/netto wurde an drei Stellen je eigen gerechnet
// (Mandat → Rechnung auf ganze Euro gerundet, Steuer-Voranmeldung ungerundet,
// Finanzplanung „netto = brutto / 1,19“). Hier einmal, kaufmännisch je Rechnung
// auf den Cent: erst die Steuer runden, netto = brutto − Steuer — so ergeben
// netto + Steuer immer genau den Rechnungsbetrag.
//
// Gerechnet wird in Cent (ganze Zahlen), damit 0,1 + 0,2 kein Thema ist.
// Kevins Rechenkern v3 (`rechenkern.ts`) bleibt davon unberührt.

/** Regelsatz, wenn an der Rechnung keiner steht. */
export const UST_REGEL = 19;

/** Euro → ganze Cent (kaufmännisch). */
export const inCent = (euro: number): number => kaufmaennisch(euro * 100);
/** Cent → Euro. */
export const ausCent = (cent: number): number => cent / 100;

/** Kaufmännisch runden: ab ,5 weg von der Null (Math.round rundet −0,5 zur Null hin). Das Epsilon fängt 1,005 × 100 = 100,49999… ab. */
export function kaufmaennisch(x: number): number {
  if (!Number.isFinite(x)) return 0;
  const r = Math.round(Math.abs(x) + 1e-7);
  return x < 0 ? -r : r;
}

/** Betrag auf den Cent (kaufmännisch). */
export const aufCent = (euro: number): number => ausCent(inCent(euro));

const satzVon = (satz: number | null | undefined): number => (satz == null || !Number.isFinite(satz) || satz < 0 ? UST_REGEL : satz);

/** Steuer aus einem Nettobetrag, auf den Cent. */
export function ustAusNetto(netto: number, satz?: number | null): number {
  return ausCent(kaufmaennisch((inCent(netto) * satzVon(satz)) / 100));
}

/** Brutto aus netto: netto (auf Cent) + Steuer (auf Cent). */
export function bruttoAusNetto(netto: number, satz?: number | null): number {
  return ausCent(inCent(netto) + inCent(ustAusNetto(netto, satz)));
}

/** Steuer, die in einem Bruttobetrag steckt, auf den Cent. */
export function ustAusBrutto(brutto: number, satz?: number | null): number {
  const s = satzVon(satz);
  return ausCent(kaufmaennisch((inCent(brutto) * s) / (100 + s)));
}

/** Netto aus brutto = brutto − Steuer (beide auf den Cent) — netto + ustAusBrutto ergibt immer brutto. */
export function nettoAusBrutto(brutto: number, satz?: number | null): number {
  return ausCent(inCent(brutto) - inCent(ustAusBrutto(brutto, satz)));
}
