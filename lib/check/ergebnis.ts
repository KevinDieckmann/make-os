// ─── Checks — Ergebnis-Ansicht (24.10., Innovations-Check) ──────────────────────────────────────────────────────
// Was die Person sofort sieht (Bauanleitung Abschnitt 7): Stufe mit Name, Netzdiagramm (eigener Wert gegen Branchenwert),
// EIN Satz Branchenvergleich mit Quelle und Jahr, Hinweis bei „vorläufig“, Lücken für Zoes Erklärung. Alles aus der Auswertung
// und den Benchmark-Daten der Vorlage — keine Zahl von woanders. Rein.

import { auswerten, luecken, profilAus } from './auswertung';
import { dimensionName, ergebnisSaetze } from './zoe-texte';
import type { CheckAntworten, CheckBenchmarks, CheckErgebnis, CheckLuecke, CheckProfil, CheckVorlage, DimKey } from './typen';

export interface ErgebnisAchse { key: DimKey; name: string; wert: number; branche: number }

export interface ErgebnisAnsicht {
  gesamt: number;
  stufe: number;
  stufeName: string;
  stufeKurz: string;
  /** Alle Stufen für die Skala (Nummer + Name). */
  stufen: { stufe: number; name: string }[];
  genauigkeit: CheckErgebnis['genauigkeit'];
  achsen: ErgebnisAchse[];
  luecken: (CheckLuecke & { name: string })[];
  branchenSatz: string;
  zoe: string[];
  /** Stufe ab dem Siegel-Wert UND „genau“ — ob es das Siegel gibt, entscheidet die Freigabe des Berichts (kommt später). */
  siegelMoeglich: boolean;
}

/** Reihenfolge der Achsen im Netzdiagramm. */
export const ACHSEN: readonly DimKey[] = ['strategie', 'ki', 'automatisierung', 'daten', 'robotik', 'team'];

const GROESSE_TEXT: Readonly<Record<string, string>> = { '10-49': '10 bis 49', '50-249': '50 bis 249', '250+': '250 und mehr' };
const jahrVon = (q: { jahr_der_daten?: number; datum: string }) => q.jahr_der_daten ?? Number(q.datum.slice(0, 4));

/** EIN Satz zum Branchenvergleich mit Quelle und Jahr — nach Größe (Destatis) bzw. allgemein (Bitkom). */
export function branchenSatz(b: CheckBenchmarks, p: CheckProfil): string {
  const groesse = b.quellen.find(q => q.id === 'destatis_2024_groesse');
  if (groesse && p.groesse && GROESSE_TEXT[p.groesse] && typeof groesse.werte[p.groesse] === 'number') {
    return `${groesse.werte[p.groesse]} % der Unternehmen mit ${GROESSE_TEXT[p.groesse]} Beschäftigten nutzen KI (${groesse.quelle}, Daten ${jahrVon(groesse)}).`;
  }
  const bitkom = b.quellen.find(q => q.id === 'bitkom_2026');
  if (bitkom && typeof bitkom.werte.nutzen === 'number') return `${bitkom.werte.nutzen} % der Unternehmen ab 20 Beschäftigten setzen KI ein (${bitkom.quelle}, ${jahrVon(bitkom)}).`;
  return '';
}

export function ergebnisAnsicht(v: CheckVorlage, antworten: CheckAntworten): { ergebnis: CheckErgebnis; profil: CheckProfil; ansicht: ErgebnisAnsicht } {
  const profil = profilAus(v.katalog, antworten);
  const ergebnis = auswerten(v.katalog, v.regeln, profil, antworten);
  const l = luecken(ergebnis, v.benchmarks, profil.branche);
  const werte = v.benchmarks.dimension_benchmark_start.werte_0_100;
  const bm = (profil.branche && werte[profil.branche]) || werte.default;
  const stufe = v.regeln.stufen.find(s => s.stufe === ergebnis.stufe);
  // Achsen: die gewerteten Dimensionen; eine nicht beantwortete Dimension zeigt 0 (ehrlich), Robotik nur, wenn sie zählt.
  const achsen = ACHSEN.filter(d => d !== 'robotik' || ergebnis.robotik_gewertet)
    .map(d => ({ key: d, name: dimensionName(d), wert: ergebnis.dimensionen[d] ?? 0, branche: bm[d] }));
  return {
    ergebnis,
    profil,
    ansicht: {
      gesamt: ergebnis.gesamt,
      stufe: ergebnis.stufe,
      stufeName: ergebnis.stufe_name,
      stufeKurz: stufe?.kurz ?? '',
      stufen: v.regeln.stufen.map(s => ({ stufe: s.stufe, name: s.name })),
      genauigkeit: ergebnis.genauigkeit,
      achsen,
      luecken: l.map(x => ({ ...x, name: dimensionName(x.dimension) })),
      branchenSatz: branchenSatz(v.benchmarks, profil),
      zoe: ergebnisSaetze(ergebnis, l),
      siegelMoeglich: ergebnis.stufe >= v.regeln.siegel.ab_stufe && ergebnis.genauigkeit === 'genau',
    },
  };
}
