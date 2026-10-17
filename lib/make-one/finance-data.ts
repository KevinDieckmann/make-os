// ─── MAKE OS — Controlling-Agent: Datenmodell & Rechenkern ──────────────────
// Du pflegst Ist-Umsatz/Kosten je Monat, Ziel & Cash. Alle Kennzahlen werden
// deterministisch gerechnet (kein KI-Raten). Die KI liefert nur den Lagebericht.

import { BUSINESS_GESELLSCHAFTEN, bereichVonFirma, istBusinessGesellschaft, type Gesellschaftskennung } from '@/lib/einheiten';

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
  // Keine Runway mehr hier (17.10., L2 R1): sie hatte einen zweiten Eingangsweg (nur Controlling-Jahr, Kasse mit Rückfall auf `cash`)
  // und wich so vom Cockpit ab. EINE Runway = die des Business-Index — Server: `runwayDesIndex()` (lib/business/fuer-chef.ts),
  // Browser: `runwayIst` aus GET /api/state/finance. Gerechnet in lib/finanzen/runway.ts.
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

/** Der 0-Punkt für die Controlling-Monate — gebaut NUR von `controllingNullpunkt` (lib/business/eroeffnung.ts), hier nur die Form. */
export interface ControllingNullpunkt {
  /** Liegt dieser Monatsabschluss vor dem Stichtag seiner Gesellschaft (archiviert, zählt nicht)? */
  abschlussVor(a: { firma: string; monat: string }): boolean;
  /** Monat (JJJJ-MM), vor dem die Gesamt-Zahlen ohne Firma nicht mehr zählen — nur, wenn JEDE Business-Gesellschaft eröffnet ist. */
  abMonat: string | null;
}

/** Monatsschlüssel JJJJ-MM einer Controlling-Zeile. */
const monatSchluessel = (jahr: number, i: number) => `${jahr}-${String(i + 1).padStart(2, '0')}`;

/** Controlling-Monate vor dem 0-Punkt zählen nicht (gespeichert bleiben sie) — EINE Stelle für Index (`ladeRoh`) und `mitAbschluessen`. */
export function nullpunktMonate(s: FinanceState, abMonat: string | null | undefined): FinanceState {
  if (!abMonat || !Array.isArray(s.months)) return s;
  return { ...s, months: s.months.map((m, i) => (monatSchluessel(s.jahr, i) < abMonat ? { ...m, umsatz: 0, kosten: 0 } : m)) };
}

/**
 * Welche Business-Gesellschaften ein vollständiger Gesamt-Monat braucht (28.09., Business-Index): alle — die MAKE Innovation GmbH erst,
 * wenn sie überhaupt Monatsabschlüsse führt. EINE Stelle für den Business-Index (`istMonate`) und `mitAbschluessen` (17.10., L2 R1).
 */
export function gesamtFirmen(abschluesse: readonly { firma: string }[]): Gesellschaftskennung[] {
  return BUSINESS_GESELLSCHAFTEN.filter(f => f !== 'ug' || abschluesse.some(a => a.firma === 'ug'));
}

/** Woher ein Ist-Monat der Gesamtsicht kommt: alle Firmen mit Abschluss · sonst das gepflegte Controlling · sonst die Firmen, die es gibt. */
export type IstWahl = 'firmen' | 'controlling' | 'teil' | 'keine';
/** EINE Regel „Ist-Monat Gesamt“ (17.10., L2 R1) — Business-Index und Controlling/ZOE/Head of Finance lesen dieselben Monate. */
export function istWahlGesamt(firmenMitZahl: number, pflicht: number, controlling: { umsatz?: number; kosten?: number } | null | undefined): IstWahl {
  if (firmenMitZahl > 0 && firmenMitZahl === pflicht) return 'firmen';
  if (controlling && ((controlling.umsatz || 0) > 0 || (controlling.kosten || 0) > 0)) return 'controlling';
  return firmenMitZahl > 0 ? 'teil' : 'keine';
}

/**
 * Eine Wahrheit (26.09.; seit 17.10. an EINER Stelle, Abnahme 3 · B2): liegt für einen Monat ein Monatsabschluss vor, gilt er — die im
 * Controlling gepflegten Monate sind nur Rückfall. Controlling (`/api/state/finance`), Head of Finance, ZOE, Schilde lesen darüber dieselben
 * Monate. Nur Abschlüsse der Business-Gesellschaften (die Selbstständigkeit gehört zu Privat, C3) — wie die Gesamtsicht des Business-Index.
 * Seit 17.10. (L2 R1/R2) mit derselben Regel wie der Index (`istWahlGesamt`: fehlt einer Gesellschaft der Abschluss, gilt das gepflegte
 * Controlling, sonst die Firmen, die es gibt) und mit dem 0-Punkt (`nullpunkt`: Abschlüsse vor dem Stichtag zählen nicht, Controlling-Monate
 * vor `abMonat` auch nicht). `nullpunkt` ist Pflicht — `null` nur, wenn der Aufrufer ihn schon angewandt hat (der Business-Index). Rein.
 */
export function mitAbschluessen(
  s: FinanceState,
  eintraege: readonly { firma: string; monat: string; umsatz?: number; kosten?: number }[] | undefined,
  nullpunkt: ControllingNullpunkt | null,
): FinanceState {
  const gueltig = (eintraege ?? []).filter(e => istBusinessGesellschaft(e.firma) && !nullpunkt?.abschlussVor(e));
  const mitZahl = gueltig.filter(e => e.umsatz != null || e.kosten != null);
  const basis = nullpunktMonate(s, nullpunkt?.abMonat);
  if (!mitZahl.length) return basis;
  const pflicht = gesamtFirmen(gueltig);
  return {
    ...basis,
    months: basis.months.map((m, i) => {
      const key = monatSchluessel(s.jahr, i);
      const je = pflicht.map(f => mitZahl.find(e => e.firma === f && e.monat === key)).filter((e): e is NonNullable<typeof e> => !!e);
      const wahl = istWahlGesamt(je.length, pflicht.length, m);
      return wahl === 'firmen' || wahl === 'teil' ? { ...m, umsatz: je.reduce((a, e) => a + (e.umsatz ?? 0), 0), kosten: je.reduce((a, e) => a + (e.kosten ?? 0), 0) } : m;
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
