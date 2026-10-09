// ─── KI-Kosten in Euro, Schätzung vor großen Aufträgen (09.10.2026, Paket 6a) — rein, Server UND Browser ──────────────────
// Kevin 08.10. spät (Antwort 16): „erster Monat nur messen · Grenze je Lauf · Schätzung vor großen Aufträgen mit Klick · Euro ·
// bei 100 % Regelwerk + Glocke · Budget-Balken“. Preise kommen aus lib/ki/modelle.ts (US-Dollar mit Stand und Quelle); hier wird
// gerechnet: Einheiten × Preis × Aufschlag des Zugangs (Vertex EU +10 %) → US-Cent → Euro-Cent über den Kurs der Instanz.
//
// Kurs: Vorgabe 0,86 € je US-Dollar — ANNAHME (nicht belegt), je Instanz über `MAKE_OS_KI_USD_EUR` einstellbar. Die Anzeige rundet
// auf ganze Cent und schreibt bei geschätzten Preisen „ca.“.

import { preiseFuer, modellVon, TOKEN_EINHEITEN, type Einheit } from './modelle';
import type { AnbieterId, Faehigkeit } from './anbieter';

export const USD_EUR_VORGABE = 0.86;
/** Aufschlag je Zugang (MODELLE.md 2.1: Claude über Vertex in der EU-Region +10 %). */
export const AUFSCHLAG: Partial<Record<AnbieterId, number>> = { 'anthropic-vertex-eu': 1.1 };

export function usdEurKurs(env: Record<string, string | undefined> = process.env): number {
  const k = Number(String(env.MAKE_OS_KI_USD_EUR ?? '').replace(',', '.'));
  return Number.isFinite(k) && k > 0.3 && k < 3 ? k : USD_EUR_VORGABE;
}

export type Mengen = Partial<Record<Einheit, number>>;

/** Kosten in US-Cent (ungerundet). Token-Einheiten sind Stückzahlen (der Preis gilt je Million). */
export function kostenUsdCent(modell: string, mengen: Mengen, opt: { faehigkeit?: Faehigkeit; anbieter?: AnbieterId } = {}): number {
  const preise = preiseFuer(modell, opt.faehigkeit ?? modellVon(modell)?.faehigkeit ?? 'text', mengen['token-ein'] ?? 0);
  let usd = 0;
  for (const [e, n] of Object.entries(mengen) as [Einheit, number][]) {
    if (!n || !Number.isFinite(n) || n < 0) continue;
    const p = preise[e] ?? 0;
    usd += (TOKEN_EINHEITEN as readonly string[]).includes(e) ? (n / 1e6) * p : n * p;
  }
  return usd * 100 * (opt.anbieter ? AUFSCHLAG[opt.anbieter] ?? 1 : 1);
}

export const inEuroCent = (usdCent: number, kurs: number = usdEurKurs()): number => usdCent * kurs;
/**
 * Euro-Cent → US-Cent — die Gegenrichtung von `inEuroCent` mit DEMSELBEN Kurs (Feinschliff 09.10.). Gemessen wird in US-Cent (Katalogpreise,
 * `ki-verbrauch`, Thread-Kosten `LaufZustand.kostenCent`/`Nachricht.kosten.cent`); Grenzen und Budgets setzt die Person in Euro-Cent. Wer beides
 * vergleicht, rechnet NUR hierüber um — nie mit einem eigenen Kurs.
 */
export const inUsdCent = (euroCent: number, kurs: number = usdEurKurs()): number => euroCent / kurs;

/** „1,30 €“ bzw. „ca. 1,30 €“ (auf ganze Cent gerundet; unter einem Cent „< 0,01 €“). */
export function euroText(euroCent: number, ca = false): string {
  if (euroCent > 0 && euroCent < 1) return `${ca ? 'ca. ' : ''}< 0,01 €`;
  const t = (Math.round(euroCent) / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${ca ? 'ca. ' : ''}${t} €`;
}

/** Ein Auftrag, dessen Kosten VOR dem Klick geschätzt werden (Oberfläche, Stapel-Vorschlag, Tor). */
export type KostenAuftrag =
  | { faehigkeit: 'bild'; modell: string; anzahl?: number; aufloesung?: '1k' | '2k' | '4k' }
  | { faehigkeit: 'video'; modell: string; sekunden: number; aufloesung?: '720p' | '1080p' | '4k' }
  | { faehigkeit: 'tiefenbericht'; modell: string }
  | { faehigkeit: 'transkript'; modell: string; minuten: number }
  | { faehigkeit: 'text'; modell: string; tokenEin: number; tokenAus: number; anbieter?: AnbieterId };

export interface Schaetzung { euroCent: number; usdCent: number; text: string; ca: boolean; mengen: Mengen; modell: string }

/** Die Schätzung (rein): Einheiten des Auftrags × Katalogpreis. Geschätzte Katalogpreise und Text-Aufträge schreiben „ca.“. */
export function kostenSchaetzen(a: KostenAuftrag, kurs: number = usdEurKurs()): Schaetzung {
  const mengen: Mengen = {};
  if (a.faehigkeit === 'bild') mengen[`bild@${a.aufloesung ?? '1k'}`] = Math.max(1, Math.round(a.anzahl ?? 1));
  else if (a.faehigkeit === 'video') mengen[`sekunde@${a.aufloesung ?? '1080p'}`] = Math.max(1, Math.ceil(a.sekunden));
  else if (a.faehigkeit === 'tiefenbericht') mengen.aufgabe = 1;
  else if (a.faehigkeit === 'transkript') mengen.minute = Math.max(0, a.minuten);
  else { mengen['token-ein'] = Math.max(0, a.tokenEin); mengen['token-aus'] = Math.max(0, a.tokenAus); }
  const usdCent = kostenUsdCent(a.modell, mengen, { faehigkeit: a.faehigkeit, ...(a.faehigkeit === 'text' && a.anbieter ? { anbieter: a.anbieter } : {}) });
  const ca = a.faehigkeit === 'text' || !!modellVon(a.modell)?.geschaetzt || !modellVon(a.modell);
  const euroCent = inEuroCent(usdCent, kurs);
  return { euroCent, usdCent, text: euroText(euroCent, ca), ca, mengen, modell: a.modell };
}

/** Fähigkeiten, die nur nach Schätzung + Klick starten (Kevin 08.10.: Video und Tiefenbericht; Bilder frei bis zum Budget). */
export const NUR_MIT_KLICK: readonly Faehigkeit[] = ['video', 'tiefenbericht'];
