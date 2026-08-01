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

  // Aktiver Zeitraum = bis zum letzten Monat mit Umsatz ODER Kosten
  let lastActive = -1;
  months.forEach((r, i) => { if ((r.umsatz || 0) > 0 || (r.kosten || 0) > 0) lastActive = i; });
  const aktiveMonate = lastActive + 1;
  const restMonate = Math.max(0, 12 - aktiveMonate);

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
