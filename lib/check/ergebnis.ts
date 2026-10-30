// ─── Checks — Ergebnis-Ansicht (24.10., Innovations-Check; drei Säulen seit 30.10.) ─────────────────────────────
// Was die Person sofort sieht (Bauanleitung Abschnitt 7, Kevin 30.10.: „Ergebnis mit nächsten Schritten“ + „Alle drei Säulen“):
// oben das Gesamtergebnis mit Stufe und den drei Säulen Sichtbarkeit · Vertrieb · Innovation, darunter die zwei nächsten Schritte
// für die schwächsten Säulen, aufklappbar die Innovation im Detail (Stufe, Netzdiagramm gegen den Branchenwert, EIN Satz
// Branchenvergleich mit Quelle und Jahr). Alles aus der Auswertung und den Daten der Vorlage — keine Zahl von woanders. Die Angebote
// zu den Schritten hängt der Server aus den Einstellungen der Instanz an (nie in der Vorlage). Rein.

import { auswerten, luecken, naechsteSchritte, profilAus, saeulenAuswerten } from './auswertung';
import { dimensionName, ergebnisSaetze, saeuleName, saeulenSaetze } from './zoe-texte';
import type { CheckAntworten, CheckBenchmarks, CheckErgebnis, CheckLuecke, CheckProfil, CheckVorlage, DimKey, SaeuleKey, SaeulenErgebnis, SchrittBand } from './typen';

export interface ErgebnisAchse { key: DimKey; name: string; wert: number; branche: number }

export interface ErgebnisSaeule { key: SaeuleKey; name: string; wert: number | null }

export interface ErgebnisSchritt { saeule: SaeuleKey; name: string; wert: number; band: SchrittBand; text: string }

export interface InnovationsDetail {
  gesamt: number;
  stufe: number;
  stufeName: string;
  stufeKurz: string;
  /** Alle Stufen der Innovation für die Skala (Nummer + Name). */
  stufen: { stufe: number; name: string }[];
  achsen: ErgebnisAchse[];
  luecken: (CheckLuecke & { name: string })[];
  branchenSatz: string;
  zoe: string[];
}

export interface ErgebnisAnsicht {
  /** Gesamtwert über die Säulen (ohne Säulen in der Vorlage: die Innovation). */
  gesamt: number;
  stufe: number;
  stufeName: string;
  stufeKurz: string;
  /** Alle Stufen des Gesamtergebnisses für die Skala (Nummer + Name). */
  stufen: { stufe: number; name: string }[];
  genauigkeit: CheckErgebnis['genauigkeit'];
  saeulen: ErgebnisSaeule[];
  schritte: ErgebnisSchritt[];
  innovation: InnovationsDetail;
  zoe: string[];
  /** Innovations-Stufe ab dem Siegel-Wert UND „genau“ — ob es das Siegel gibt, entscheidet die Freigabe des Berichts (kommt später). */
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

export function ergebnisAnsicht(v: CheckVorlage, antworten: CheckAntworten): { ergebnis: CheckErgebnis; saeulen: SaeulenErgebnis; profil: CheckProfil; ansicht: ErgebnisAnsicht } {
  const profil = profilAus(v.katalog, antworten);
  const ergebnis = auswerten(v.katalog, v.regeln, profil, antworten);
  const saeulen = saeulenAuswerten(v.katalog, v.regeln, antworten, ergebnis);
  const l = luecken(ergebnis, v.benchmarks, profil.branche);
  const werte = v.benchmarks.dimension_benchmark_start.werte_0_100;
  const bm = (profil.branche && werte[profil.branche]) || werte.default;
  const iStufe = v.regeln.stufen.find(s => s.stufe === ergebnis.stufe);
  const gStufen = v.regeln.saeulen_stufen?.length ? v.regeln.saeulen_stufen : v.regeln.stufen;
  const gStufe = gStufen.find(s => s.stufe === saeulen.stufe);
  // Achsen: die gewerteten Dimensionen; eine nicht beantwortete Dimension zeigt 0 (ehrlich), Robotik nur, wenn sie zählt.
  const achsen = ACHSEN.filter(d => d !== 'robotik' || ergebnis.robotik_gewertet)
    .map(d => ({ key: d, name: dimensionName(d), wert: ergebnis.dimensionen[d] ?? 0, branche: bm[d] }));
  const saeulenListe: ErgebnisSaeule[] = (v.regeln.saeulen ?? [{ key: 'innovation' as const }]).map(sa => ({ key: sa.key, name: saeuleName(sa.key), wert: saeulen.werte[sa.key] ?? null }));
  return {
    ergebnis,
    saeulen,
    profil,
    ansicht: {
      gesamt: saeulen.gesamt,
      stufe: saeulen.stufe,
      stufeName: saeulen.stufe_name,
      stufeKurz: gStufe?.kurz ?? '',
      stufen: gStufen.map(s => ({ stufe: s.stufe, name: s.name })),
      genauigkeit: ergebnis.genauigkeit,
      saeulen: saeulenListe,
      schritte: naechsteSchritte(v.regeln, saeulen.werte).map(x => ({ ...x, name: saeuleName(x.saeule) })),
      innovation: {
        gesamt: ergebnis.gesamt,
        stufe: ergebnis.stufe,
        stufeName: ergebnis.stufe_name,
        stufeKurz: iStufe?.kurz ?? '',
        stufen: v.regeln.stufen.map(s => ({ stufe: s.stufe, name: s.name })),
        achsen,
        luecken: l.map(x => ({ ...x, name: dimensionName(x.dimension) })),
        branchenSatz: branchenSatz(v.benchmarks, profil),
        zoe: ergebnisSaetze(ergebnis, l),
      },
      zoe: saeulenSaetze(saeulen, ergebnis.genauigkeit),
      siegelMoeglich: ergebnis.stufe >= v.regeln.siegel.ab_stufe && ergebnis.genauigkeit === 'genau',
    },
  };
}
