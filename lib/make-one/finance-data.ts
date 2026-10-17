// ─── MAKE OS — Controlling-Agent: Datenmodell & Rechenkern ──────────────────
// Du pflegst Ist-Umsatz/Kosten je Monat, Ziel & Cash. Alle Kennzahlen werden
// deterministisch gerechnet (kein KI-Raten). Die KI liefert nur den Lagebericht.

import { bereichVonFirma, istBusinessGesellschaft } from '@/lib/einheiten';
import { runwayRechnen, type RunwayIst } from '@/lib/finanzen/runway';

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

// Das Ziel trägt jede Instanz selbst ein (Controlling & Ziele; der Nordstern des Haushalts steht unter Planung › Jahr) —
// deshalb auch die Zielwerte 0 = „kein Ziel eingetragen“, nie eine feste Zielzahl im Code (gilt für Demo und Kunden-Instanzen;
// ein gespeicherter Stand bleibt unberührt, die Route nimmt nur `current ?? DEFAULT_FINANCE`).
// Ist-Zahlen bewusst 0 — trag deine echten Werte ein, dann rechnet alles live.
export const DEFAULT_FINANCE: FinanceState = {
  jahr: 2026,
  zielUmsatz: 0,
  zielGewinn: 0,
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
  /** EINE Runway (17.10., Abnahme 3 · B1, lib/finanzen/runway.ts): Kasse ÷ Ø Netto-Verbrauch der letzten drei abgeschlossenen
   *  Monate — null bei „kein Verbrauch“ (siehe `runway.keinVerbrauch`) oder ohne Kasse/Ist-Monate. Vorher Kasse ÷ Ø Kosten OHNE Umsatz. */
  runwayMonate: number | null;
  runway: RunwayIst;
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
  // Runway (17.10., B1): die abgeschlossenen Monate ab dem Start (vor dem laufenden Monat), wie der Business-Index. Die Kasse ist
  // unbekannt (null), wenn kein Konto einen Stand hat und kein Wert gepflegt ist — nie „0,0 Monate“ aus fehlenden Daten.
  const bisIdx = s.jahr < h.jahr ? 11 : s.jahr > h.jahr ? -1 : h.monat - 1;
  const abgeschlossen = months.slice(start, bisIdx + 1).filter(r => (r.umsatz || 0) > 0 || (r.kosten || 0) > 0);
  const kasseQuelle = (s as Partial<{ kasse: Kasse }>).kasse?.quelle;
  const kasseBetrag = kasseQuelle === 'keine' || (!kasseQuelle && !s.cash) ? null : s.cash;
  const runway = runwayRechnen(kasseBetrag, abgeschlossen);
  const runwayMonate = runway.monate;

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
    runway,
    aktiveMonate,
  };
}

// ─── Business-Kasse: eine Quelle ────────────────────────────────────────────
// Die Kontostände der Firmenkonten (Finanzplanung) sind die Kasse. Das alte
// Feld `cash` gilt nur, solange noch kein Firmenkonto einen Stand hat — sonst
// liefen Runway und Liquidität auf zwei verschiedenen Zahlen.
export interface Kasse { betrag: number; quelle: 'konten' | 'manuell' | 'keine'; konten: number; stand: string | null }

export function geschaeftsKasse(firmen: { id: string; kontostand?: number | null; stand?: string | null }[] | undefined, manuell: number | undefined): Kasse {
  // Bereich je Einheit (09.10., KI-Etiketten K3): nur Konten im Business-Bereich (`bereichVonFirma`) — ein Konto einer Privat-Einheit
  // (die Selbstständigkeit, wenn sie unter Privat steht) zählt nicht zur Business-Kasse; vorher zählte alles außer „privat“.
  const mitStand = (firmen ?? []).filter(f => bereichVonFirma(f.id) === 'business' && typeof f.kontostand === 'number' && isFinite(f.kontostand));
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

/**
 * Eine Wahrheit (26.09.; seit 17.10. an EINER Stelle, Abnahme 3 · B2): liegt für einen Monat ein Monatsabschluss vor, gilt er — die im
 * Controlling gepflegten Monate sind nur Rückfall. Controlling (`/api/state/finance`) und Head of Finance lesen darüber dieselben Monate.
 * Nur Abschlüsse der Business-Gesellschaften (die Selbstständigkeit gehört zu Privat, C3) — wie die Gesamtsicht des Business-Index. Rein.
 */
export function mitAbschluessen(s: FinanceState, eintraege: readonly { firma: string; monat: string; umsatz?: number; kosten?: number }[] | undefined): FinanceState {
  const biz = (eintraege ?? []).filter(e => istBusinessGesellschaft(e.firma) && (e.umsatz != null || e.kosten != null));
  if (!biz.length) return s;
  return {
    ...s,
    months: s.months.map((m, i) => {
      const key = `${s.jahr}-${String(i + 1).padStart(2, '0')}`;
      const je = biz.filter(e => e.monat === key);
      return je.length ? { ...m, umsatz: je.reduce((a, e) => a + (e.umsatz ?? 0), 0), kosten: je.reduce((a, e) => a + (e.kosten ?? 0), 0) } : m;
    }),
  };
}

/** Ziel als Satzteil — ohne eingetragenes Ziel „kein Ziel eingetragen“ statt „0 €“ (ZOE-Kontext, Lageberichte). */
export function zielAngabe(s: Pick<FinanceState, 'zielUmsatz' | 'zielGewinn'>): string {
  return (s.zielUmsatz || 0) > 0 || (s.zielGewinn || 0) > 0
    ? `Ziel ${eur(s.zielUmsatz || 0)} Umsatz / ${eur(s.zielGewinn || 0)} Gewinn`
    : 'kein Ziel eingetragen';
}

export const eur = (n: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Math.round(n || 0));
