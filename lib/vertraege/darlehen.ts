// ─── Verträge · Darlehensvertrag (02.11., rein, client-sicher, getestet) ───────────────────────────────────────────────────────────
// Kevin 02.11.: Darlehen mit Raten und Zinsen — aus dem Vertrag in die Finanzen (als Vorschlag, erst der Klick übernimmt).
// Ein Vertrag ist ein Darlehensvertrag, wenn seine Felder die festen Darlehens-Schlüssel tragen (nicht über die Art: die Vertragsarten sind
// Instanz-Daten). Die Zinsen und den Zins- und Tilgungsplan rechnet NUR `darlehenPlan` (lib/finanzen/darlehen-plan.ts) — hier werden die
// Feldwerte gelesen, geprüft (Raten × Anzahl = Betrag, Enddatum = Monat der letzten Rate) und als gerechnete Platzhalter ausgegeben.
// Keine Beträge oder Namen im Code.

import { darlehenPlan, betragDeutsch, monatPlus, monateZwischen, type DarlehenPlan, type DarlehenZinsart } from '@/lib/finanzen/darlehen-plan';
import { euroAlsCent } from '@/lib/aufgaben/saeubern';

/** Feste Feld-Schlüssel eines Darlehensvertrags (die Vorlage trägt sie als eigene Felder). */
export const DARLEHEN_FELD = {
  betrag: 'darlehen_betrag', betragWorte: 'darlehen_betrag_worte', auszahlung: 'darlehen_auszahlung', zinsProzent: 'darlehen_zins_prozent',
  zinsen: 'darlehen_zinsen', ratenBeginn: 'darlehen_raten_beginn', ratenAnzahl: 'darlehen_raten_anzahl', rate: 'darlehen_rate',
  enddatum: 'darlehen_enddatum', mindestSondertilgung: 'darlehen_mindest_sondertilgung', buerge: 'buerge',
} as const;
/** Gerechnete Platzhalter (nie ein Eingabefeld). */
export const DARLEHEN_GERECHNET = { zinsenGesamt: 'darlehen_zinsen_gesamt', tilgungsplan: 'darlehen_tilgungsplan' } as const;

/** Trägt der Vertrag (bzw. die Vorlage) die Darlehens-Felder? */
export const istDarlehenVertrag = (v: { felder: readonly { schluessel: string }[] }): boolean =>
  [DARLEHEN_FELD.betrag, DARLEHEN_FELD.ratenAnzahl, DARLEHEN_FELD.rate, DARLEHEN_FELD.ratenBeginn].every(s => v.felder.some(f => f.schluessel === s));

/** Auswahl-Text → Zinsart („monatlich mit der Rate“ = laufend, sonst gestundet). */
export const zinsartAus = (t: string | undefined): DarlehenZinsart => (/monatlich|laufend/i.test(t ?? '') ? 'laufend' : 'gestundet');

const TAG = /^\d{4}-\d{2}-\d{2}$/;
const zahl = (t: string | undefined): number | null => { const s = (t ?? '').trim().replace(',', '.'); return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null; };
const euro = (t: string | undefined): number | null => { const c = euroAlsCent(t ?? ''); return c === null ? null : c / 100; };

export interface DarlehenAusVertrag {
  betrag: number; zinsProzent: number; zinsen: DarlehenZinsart; ratenAnzahl: number; rate: number;
  /** ISO-Tage aus dem Vertrag. */
  auszahlung: string; ratenBeginn: string; enddatum?: string;
  /** Monate ab der Auszahlung bis vor die 1. Rate. */
  wartezeit: number;
  plan: DarlehenPlan;
}
/**
 * Die Darlehens-Angaben eines Vertrags — `leer`, solange Pflichtangaben fehlen (die meldet `fertigstellenFehlt` als Pflichtfelder),
 * `fehler` (Sätze) bei Unplausiblem, sonst die Angaben samt Plan.
 */
export function darlehenAusWerten(werte: Readonly<Record<string, string>>): { leer: true } | { fehler: string[] } | DarlehenAusVertrag {
  const w = (s: string) => (werte[s] ?? '').trim();
  const roh = [DARLEHEN_FELD.betrag, DARLEHEN_FELD.auszahlung, DARLEHEN_FELD.ratenBeginn, DARLEHEN_FELD.ratenAnzahl, DARLEHEN_FELD.rate].map(w);
  if (roh.some(x => !x)) return { leer: true };
  const fehler: string[] = [];
  const betrag = euro(w(DARLEHEN_FELD.betrag)), rate = euro(w(DARLEHEN_FELD.rate)), n = zahl(w(DARLEHEN_FELD.ratenAnzahl));
  const zinsProzent = w(DARLEHEN_FELD.zinsProzent) ? zahl(w(DARLEHEN_FELD.zinsProzent)) : 0;
  const auszahlung = w(DARLEHEN_FELD.auszahlung), ratenBeginn = w(DARLEHEN_FELD.ratenBeginn), enddatum = w(DARLEHEN_FELD.enddatum);
  if (betrag === null || betrag <= 0) fehler.push('Darlehensbetrag: bitte einen Betrag in Euro.');
  if (rate === null || rate <= 0) fehler.push('Tilgungsrate: bitte einen Betrag in Euro.');
  if (n === null || !Number.isInteger(n) || n < 1) fehler.push('Anzahl der Tilgungsraten: bitte eine ganze Zahl ab 1.');
  if (zinsProzent === null || zinsProzent < 0) fehler.push('Zinssatz: bitte eine Zahl (Prozent pro Jahr).');
  if (!TAG.test(auszahlung) || !TAG.test(ratenBeginn)) fehler.push('Auszahlung und erste Rate: bitte als Datum.');
  if (fehler.length) return { fehler };
  const wartezeit = monateZwischen(auszahlung, ratenBeginn);
  if (wartezeit < 0) fehler.push('Die erste Tilgungsrate liegt vor der Auszahlung.');
  if (Math.round(rate! * 100) * n! !== Math.round(betrag! * 100))
    fehler.push(`Raten passen nicht zum Betrag: ${n} × ${betragDeutsch(rate!)} € = ${betragDeutsch(rate! * n!)} €, das Darlehen beträgt ${betragDeutsch(betrag!)} €.`);
  if (enddatum) {
    if (!TAG.test(enddatum)) fehler.push('Enddatum: bitte als Datum.');
    else if (enddatum.slice(0, 7) !== monatPlus(ratenBeginn, n! - 1)) fehler.push(`Das Enddatum muss im Monat der letzten Rate liegen (${monatPlus(ratenBeginn, n! - 1).split('-').reverse().join('/')}).`);
  }
  if (fehler.length) return { fehler };
  const zinsen = zinsartAus(w(DARLEHEN_FELD.zinsen));
  const plan = darlehenPlan({ betrag: betrag!, zinsProzent: zinsProzent!, wartezeit, ratenAnzahl: n!, rate: rate!, zinsen });
  if ('fehler' in plan) return { fehler: [plan.fehler] };
  return { betrag: betrag!, zinsProzent: zinsProzent!, zinsen, ratenAnzahl: n!, rate: rate!, auszahlung, ratenBeginn, ...(enddatum ? { enddatum } : {}), wartezeit, plan };
}

/** Monat k ab der Auszahlung als „MM/JJJJ“. */
export const planMonatText = (auszahlung: string, k: number) => { const m = monatPlus(auszahlung, k); return m ? `${m.slice(5, 7)}/${m.slice(0, 4)}` : ''; };

/**
 * Zins- und Tilgungsplan als Text — eine Zeile je Monat, Spalten mit Tabulator (das PDF und die Vorschau setzen sie als Tabelle).
 * Kopf: Monat · Restschuld · Tilgung · Zins; letzte Zeile die Summe.
 */
export function tilgungsplanText(d: DarlehenAusVertrag): string {
  const zeilen = ['Monat\tRestschuld\tTilgung\tZins'];
  for (const x of d.plan.monate) zeilen.push([planMonatText(d.auszahlung, x.k), betragDeutsch(x.restschuld), betragDeutsch(x.tilgung), betragDeutsch(x.zins)].join('\t'));
  zeilen.push(['Summe', '', betragDeutsch(d.plan.tilgungGesamt), betragDeutsch(d.plan.zinsenGesamt)].join('\t'));
  return zeilen.join('\n');
}

/** Werte der gerechneten Platzhalter (leer, wenn nicht rechenbar). Zinsen als Zahl im deutschen Format OHNE „€“ (der Text sagt „EUR …“). */
export function darlehenPlatzhalter(werte: Readonly<Record<string, string>>): Record<string, string> {
  const d = darlehenAusWerten(werte);
  if ('leer' in d || 'fehler' in d) return { [DARLEHEN_GERECHNET.zinsenGesamt]: '', [DARLEHEN_GERECHNET.tilgungsplan]: '' };
  return { [DARLEHEN_GERECHNET.zinsenGesamt]: betragDeutsch(d.plan.zinsenGesamt), [DARLEHEN_GERECHNET.tilgungsplan]: tilgungsplanText(d) };
}
