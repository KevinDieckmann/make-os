// ─── Gesamt: die Brücke zwischen Privat und Business ────────────────────────
// Malins Frage aus ihrem Fixkosten-Reiter — „daraus folgt, wie viel Umsatz ihr
// mindestens braucht“ — zu Ende gerechnet:
//
//   privater Sockel (Fixkosten + Raten)
// − planbares Einkommen ohne Kevins Entnahme (z. B. Malins Gehalt)
// = nötige Entnahme aus der Selbstständigkeit
// ÷ (1 − Steuerrücklage)            ← ANNAHME, einstellbar, steht dabei
// = nötiger Gewinn
// + Betriebs-Fixkosten (aus dem Business)
// = Mindestumsatz pro Monat
//
// Jede Zahl trägt ihre Quelle. Fehlt eine Zutat, gibt es keine Zahl statt einer
// geschätzten (Malins wichtigster Satz).

import type { Haushalt } from './typen';
import { katNamen, einordnen } from './einordnung';
import { luft } from './fixkosten';
import { inMonaten } from './kennzahlen';
import { vollMonate, heuteBerlin } from './monat';

export const ENTNAHME_KATEGORIEN = ['Entnahme Kevin (Selbstständigkeit)', 'Selbstständigkeit'];

export interface BusinessZahlen { umsatzProMonat: number; fixkostenMonatBrutto: number; bisMonat: string; monate: number } // Euro (aus der Grundlage)

export interface Bruecke {
  sockel: number; planbarOhneEntnahme: number; entnahmeIst: number; noetigeEntnahme: number;
  steuerquote: number | null; noetigerGewinn: number | null;
  betriebsFix: number | null; mindestUmsatz: number | null; umsatzIst: number | null; deckung: number | null;
  fehlt: string[];
}

/** Cent. `business` in Euro, wie die Grundlage sie liefert. */
export function bruecke(h: Haushalt, business: BusinessZahlen | null, steuerquote: number | null, heute: string = heuteBerlin()): Bruecke {
  const katName = katNamen(h.stamm);
  const privat = h.buchungen.filter(b => b.einheit === 'privat');
  const schulden = h.schulden.filter(s => s.einheit === 'privat');
  const sockel = luft(privat, schulden, katName, heute).sockel.gesamt;
  const drei = inMonaten(privat, vollMonate(3, 0, heute));
  let planbar = 0, entnahme = 0;
  for (const b of drei) {
    if (einordnen(b, katName) !== 'einnahme-planbar') continue;
    if (ENTNAHME_KATEGORIEN.includes(katName(b.kategorie_id))) entnahme += b.betrag; else planbar += b.betrag;
  }
  const planbarOhneEntnahme = planbar / 3, entnahmeIst = entnahme / 3;
  const noetigeEntnahme = Math.max(0, sockel - planbarOhneEntnahme);
  const fehlt: string[] = [];
  if (!privat.length) fehlt.push('Haushaltsbuchungen');
  if (steuerquote === null) fehlt.push('Annahme zur Steuerrücklage');
  if (!business) fehlt.push('Business-Zahlen (Grundlage)');
  const noetigerGewinn = steuerquote !== null && steuerquote < 100 ? noetigeEntnahme / (1 - steuerquote / 100) : null;
  const betriebsFix = business ? Math.round(business.fixkostenMonatBrutto * 100) : null;
  const mindestUmsatz = noetigerGewinn !== null && betriebsFix !== null ? noetigerGewinn + betriebsFix : null;
  const umsatzIst = business && business.monate > 0 ? Math.round(business.umsatzProMonat * 100) : null;
  return {
    sockel, planbarOhneEntnahme, entnahmeIst, noetigeEntnahme, steuerquote, noetigerGewinn, betriebsFix, mindestUmsatz, umsatzIst,
    deckung: mindestUmsatz && umsatzIst !== null ? umsatzIst / mindestUmsatz * 100 : null, fehlt,
  };
}
