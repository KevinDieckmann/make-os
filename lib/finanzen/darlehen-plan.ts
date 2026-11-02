// ─── Finanzplanung — Zins- und Tilgungsplan eines Darlehens (02.11., rein, client-sicher, getestet) ─────────────────────────────
// Kevin 02.11.: „Ja, mit Raten und Zinsen“ — EINE Rechnung für den Rechenkern (lib/finanzen/rechenkern.ts `darlehenFluesse`), den Darlehensvertrag
// (gerechnete Platzhalter `{{darlehen_zinsen_gesamt}}`/`{{darlehen_tilgungsplan}}`), die Raten in der Liquidität und die Karte im Steckbrief.
// Regeln (rechnet in ganzen Cent, Ergebnis in Euro mit zwei Nachkommastellen):
//   Monatszins = Zinssatz p.a. ÷ 12.
//   Wartezeit (Monate ab der Auszahlung bis vor die 1. Rate): je Monat Betrag × Monatszins.
//   Ab der 1. Rate: Zins = Restschuld NACH der Rate × Monatszins. Die letzte Rate nimmt den Rest (Rate × Anzahl ≠ Betrag → letzte Rate weicht ab).
//   `gestundet` = alle Zinsen in einer Summe mit der letzten Rate · `laufend` = jeden Monat (auch in der Wartezeit) mit der Rate.
// Beispiel: 12.000 € · 6 % · 6 Monate Wartezeit · 12 × 1.000 € → Zinsen 360 + 330 = 690 €.
// Keine Beträge oder Namen im Code — die Werte trägt der Haushalt ein.

export type DarlehenZinsart = 'gestundet' | 'laufend';
export const DARLEHEN_ZINSARTEN: DarlehenZinsart[] = ['gestundet', 'laufend'];
export const istZinsart = (v: unknown): v is DarlehenZinsart => v === 'gestundet' || v === 'laufend';

export interface DarlehenPlanEingabe {
  betrag: number;          // € (Auszahlung)
  zinsProzent: number;     // % p.a. (0 = zinslos)
  wartezeit: number;       // Monate ab der Auszahlung bis vor die 1. Rate (0 = erste Rate im Monat der Auszahlung)
  ratenAnzahl: number;
  rate: number;            // € je Rate (Tilgung)
  zinsen: DarlehenZinsart;
}
/** Ein Monat des Plans; `k` = Monate ab der Auszahlung (0 = Monat der Auszahlung). Beträge in €. */
export interface DarlehenPlanMonat {
  k: number;
  /** Restschuld am Ende des Monats (nach der Tilgung). */
  restschuld: number;
  tilgung: number;
  /** In diesem Monat entstandener Zins (Aufwand beim Nehmer, Ertrag beim Geber). */
  zins: number;
  /** In diesem Monat gezahlter Zins (laufend = zins; gestundet = alles mit der letzten Rate). */
  zinsZahlung: number;
  /** Zahlung Nehmer → Geber in diesem Monat (Tilgung + gezahlter Zins). */
  zahlung: number;
  /** 1 … Anzahl für Raten-Monate, sonst fehlt (Wartezeit). */
  rateNr?: number;
}
export interface DarlehenPlan { monate: DarlehenPlanMonat[]; zinsenGesamt: number; tilgungGesamt: number; zahlungGesamt: number }

/** Grenzen, damit ein Tippfehler den Plan nicht sprengt (sonst 400 im Schreibweg). */
export const DARLEHEN_PLAN_GRENZEN = { zinsProzent: 30, wartezeit: 240, ratenAnzahl: 600 } as const;

const cent = (e: number) => Math.round(e * 100);
const euro = (c: number) => c / 100;

/** Fehler der Eingabe als Satz — oder null. */
export function darlehenPlanFehler(e: DarlehenPlanEingabe): string | null {
  if (!Number.isFinite(e.betrag) || e.betrag <= 0) return 'Darlehensbetrag fehlt.';
  if (!Number.isFinite(e.zinsProzent) || e.zinsProzent < 0 || e.zinsProzent > DARLEHEN_PLAN_GRENZEN.zinsProzent) return `Zinssatz zwischen 0 und ${DARLEHEN_PLAN_GRENZEN.zinsProzent} % p.a.`;
  if (!Number.isInteger(e.wartezeit) || e.wartezeit < 0 || e.wartezeit > DARLEHEN_PLAN_GRENZEN.wartezeit) return 'Der Ratenbeginn liegt vor der Auszahlung oder zu weit danach.';
  if (!Number.isInteger(e.ratenAnzahl) || e.ratenAnzahl < 1 || e.ratenAnzahl > DARLEHEN_PLAN_GRENZEN.ratenAnzahl) return `Anzahl der Raten zwischen 1 und ${DARLEHEN_PLAN_GRENZEN.ratenAnzahl}.`;
  if (!Number.isFinite(e.rate) || e.rate <= 0) return 'Rate fehlt.';
  if (!istZinsart(e.zinsen)) return 'Zinsen: gestundet oder laufend.';
  return null;
}

/** Der Plan — oder `{ fehler }`. Die Summe der Tilgungen ist immer genau der Betrag (die letzte Rate nimmt den Rest). */
export function darlehenPlan(e: DarlehenPlanEingabe): DarlehenPlan | { fehler: string } {
  const f = darlehenPlanFehler(e);
  if (f) return { fehler: f };
  const monatsZins = e.zinsProzent / 1200;
  const rateC = cent(e.rate);
  let rest = cent(e.betrag);
  const roh: { k: number; rest: number; tilg: number; zins: number; nr?: number }[] = [];
  for (let k = 0; k < e.wartezeit; k++) roh.push({ k, rest, tilg: 0, zins: Math.round(rest * monatsZins) });
  for (let j = 0; j < e.ratenAnzahl; j++) {
    const letzte = j === e.ratenAnzahl - 1;
    const tilg = letzte ? rest : Math.min(rateC, rest);
    rest -= tilg;
    roh.push({ k: e.wartezeit + j, rest, tilg, zins: Math.round(rest * monatsZins), nr: j + 1 });
  }
  const zinsSumme = roh.reduce((s, r) => s + r.zins, 0);
  const monate = roh.map((r, i): DarlehenPlanMonat => {
    const zz = e.zinsen === 'laufend' ? r.zins : (i === roh.length - 1 ? zinsSumme : 0);
    return { k: r.k, restschuld: euro(r.rest), tilgung: euro(r.tilg), zins: euro(r.zins), zinsZahlung: euro(zz), zahlung: euro(r.tilg + zz), ...(r.nr ? { rateNr: r.nr } : {}) };
  });
  const tilgC = roh.reduce((s, r) => s + r.tilg, 0);
  return { monate, zinsenGesamt: euro(zinsSumme), tilgungGesamt: euro(tilgC), zahlungGesamt: euro(tilgC + zinsSumme) };
}

/** Kalendermonate zwischen zwei ISO-Tagen (JJJJ-MM-TT), nur Jahr und Monat — 2026-11-15 → 2027-05-01 = 6. */
export function monateZwischen(von: string, bis: string): number {
  const a = /^(\d{4})-(\d{2})/.exec(von), b = /^(\d{4})-(\d{2})/.exec(bis);
  if (!a || !b) return NaN;
  return (Number(b[1]) - Number(a[1])) * 12 + (Number(b[2]) - Number(a[2]));
}
/** ISO-Tag + n Kalendermonate → „JJJJ-MM“. */
export function monatPlus(tag: string, n: number): string {
  const a = /^(\d{4})-(\d{2})/.exec(tag);
  if (!a) return '';
  const t = Number(a[1]) * 12 + Number(a[2]) - 1 + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}

/** Betrag im deutschen Format ohne Währungszeichen: 1234.5 → „1.234,50“. */
export function betragDeutsch(e: number): string {
  const neg = e < 0;
  const [g, n] = Math.abs(Math.round(e * 100) / 100).toFixed(2).split('.');
  return `${neg ? '-' : ''}${g.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${n}`;
}
