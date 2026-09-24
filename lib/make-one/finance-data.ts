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

/** Monat (0..11) und Jahr in deutscher Zeit — ein UTC-Server läge sonst
 *  am Monatsersten nachts im Vormonat. */
function heuteBerlin(jetzt: Date): { jahr: number; monat: number } {
  const [j, m] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit' }).format(jetzt).split('-');
  return { jahr: Number(j), monat: Number(m) - 1 };
}

export function computeMetrics(s: FinanceState, jetzt: Date = new Date()): FinanceMetrics {
  const months = s.months ?? [];

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
  // Ist zählt ab dem Startmonat — dieselbe Spanne wie der Schnitt.
  const imZeitraum = months.slice(start);
  const istUmsatz = imZeitraum.reduce((a, r) => a + (r.umsatz || 0), 0);
  const istKosten = imZeitraum.reduce((a, r) => a + (r.kosten || 0), 0);
  const istGewinn = istUmsatz - istKosten;
  // Rest-Monate zählen ab heute, nicht ab dem letzten gepflegten Monat: wer
  // im September noch bei Juli steht, hat nicht fünf Monate Zeit, sondern vier.
  const h = heuteBerlin(jetzt);
  const restMonate = s.jahr < h.jahr ? 0
    : s.jahr > h.jahr ? 12 - start
    : Math.max(0, 12 - Math.max(lastActive + 1, h.monat));

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

// ─── Business-Kasse: eine Quelle ────────────────────────────────────────────
// Die Kontostände der Firmenkonten (Finanzplanung) sind die Kasse. Das alte
// Feld `cash` gilt nur, solange noch kein Firmenkonto einen Stand hat — sonst
// liefen Runway und Liquidität auf zwei verschiedenen Zahlen.
export interface Kasse { betrag: number; quelle: 'konten' | 'manuell' | 'keine'; konten: number; stand: string | null }

export function geschaeftsKasse(firmen: { id: string; kontostand?: number | null; stand?: string | null }[] | undefined, manuell: number | undefined): Kasse {
  const mitStand = (firmen ?? []).filter(f => f.id !== 'privat' && typeof f.kontostand === 'number' && isFinite(f.kontostand));
  if (mitStand.length) {
    const staende = mitStand.map(f => f.stand).filter((x): x is string => !!x).sort();
    return { betrag: mitStand.reduce((a, f) => a + (f.kontostand as number), 0), quelle: 'konten', konten: mitStand.length, stand: staende[0] ?? null };
  }
  if (manuell) return { betrag: manuell, quelle: 'manuell', konten: 0, stand: null };
  return { betrag: 0, quelle: 'keine', konten: 0, stand: null };
}

/** Finanzstand mit der Kasse aus den Konten — so rechnen Runway, Brain und Schilde gleich. */
export function mitKasse(s: FinanceState, firmen: Parameters<typeof geschaeftsKasse>[0]): FinanceState & { kasse: Kasse } {
  const kasse = geschaeftsKasse(firmen, s.cash);
  return { ...s, cash: kasse.betrag, kasse };
}

export const eur = (n: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Math.round(n || 0));
