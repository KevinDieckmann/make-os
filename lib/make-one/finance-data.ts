// ─── MAKE OS — Controlling-Agent: Datenmodell & Rechenkern ──────────────────
// Du pflegst Ist-Umsatz/Kosten je Monat, Ziel & Cash. Alle Kennzahlen werden
// deterministisch gerechnet (kein KI-Raten). Die KI liefert nur den Lagebericht.

export interface MonthRow { m: string; umsatz: number; kosten: number; }
export interface FinanceState {
  jahr: number;
  zielUmsatz: number;
  zielGewinn: number;
  cash: number;
  months: MonthRow[];
  /** Ab welchem Monat wirklich gearbeitet wird (0 = Januar). Ohne diesen
   *  Wert zählt das System ab Jahresanfang und rechnet den Schnitt kaputt. */
  startMonat?: number;
}

export const MONTHS_DE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

// Bekannt: 1 Mio € Umsatz bei KD Ventures → min. 300k Gewinn (Kevin & Malin).
// Ist-Zahlen bewusst 0 — trag deine echten Werte ein, dann rechnet alles live.
export const DEFAULT_FINANCE: FinanceState = {
  jahr: 2026,
  zielUmsatz: 1_000_000,
  zielGewinn: 300_000,
  cash: 0,
  months: MONTHS_DE.map(m => ({ m, umsatz: 0, kosten: 0 })),
};

export interface FinanceMetrics {
  istUmsatz: number;
  istKosten: number;
  istGewinn: number;
  fortschritt: number;        // 0..1 Umsatz gg. Ziel
  gewinnFortschritt: number;  // 0..1 Gewinn gg. Zielgewinn
  verbleibend: number;        // Umsatz bis Ziel
  aktMonatIdx: number;        // 0..11 (letzter Monat mit Ist-Umsatz)
  restMonate: number;         // Monate bis Jahresende
  runRateNoetig: number;      // €/Monat, um Ziel bis Dez zu treffen
  runRateAktuell: number;     // Ø Umsatz der aktiven Monate
  avgBurn: number;            // Ø Kosten der aktiven Monate
  runwayMonate: number | null;// Cash / Burn (null wenn kein Burn)
  aktiveMonate: number;
}

export function computeMetrics(s: FinanceState): FinanceMetrics {
  const months = s.months ?? [];
  const istUmsatz = months.reduce((a, r) => a + (r.umsatz || 0), 0);
  const istKosten = months.reduce((a, r) => a + (r.kosten || 0), 0);
  const istGewinn = istUmsatz - istKosten;

  // Aktiver Zeitraum = vom Startmonat bis zum letzten Monat mit Zahlen.
  // OHNE Startmonat würde ab Januar gezählt — wer im Juni loslegt, hätte
  // dann sieben statt zwei Monate und einen viel zu niedrigen Schnitt.
  let lastActive = -1;
  months.forEach((r, i) => { if ((r.umsatz || 0) > 0 || (r.kosten || 0) > 0) lastActive = i; });
  // Kein Startmonat gesetzt? Dann gilt der erste Monat mit Zahlen als Start.
  let ersterMitZahlen = -1;
  months.forEach((r, i) => { if (ersterMitZahlen < 0 && ((r.umsatz || 0) > 0 || (r.kosten || 0) > 0)) ersterMitZahlen = i; });
  const start = typeof s.startMonat === 'number' ? Math.max(0, Math.min(11, s.startMonat)) : Math.max(0, ersterMitZahlen);
  const aktiveMonate = lastActive < 0 ? 0 : Math.max(1, lastActive - start + 1);
  const restMonate = Math.max(0, 12 - (lastActive + 1));

  const verbleibend = Math.max(0, s.zielUmsatz - istUmsatz);
  const runRateNoetig = restMonate > 0 ? verbleibend / restMonate : verbleibend;
  const runRateAktuell = aktiveMonate > 0 ? istUmsatz / aktiveMonate : 0;
  const avgBurn = aktiveMonate > 0 ? istKosten / aktiveMonate : 0;
  const runwayMonate = avgBurn > 0 ? s.cash / avgBurn : null;

  return {
    istUmsatz, istKosten, istGewinn,
    fortschritt: s.zielUmsatz > 0 ? istUmsatz / s.zielUmsatz : 0,
    gewinnFortschritt: s.zielGewinn > 0 ? istGewinn / s.zielGewinn : 0,
    verbleibend,
    aktMonatIdx: lastActive,
    restMonate,
    runRateNoetig,
    runRateAktuell,
    avgBurn,
    runwayMonate,
    aktiveMonate,
  };
}

export const eur = (n: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Math.round(n || 0));
