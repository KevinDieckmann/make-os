// ─── Checks — Ergebnis-Ansicht (24.10., Innovations-Check; drei Säulen seit 30.10.) ─────────────────────────────
// Was die Person sofort sieht (Bauanleitung Abschnitt 7, Kevin 30.10.: „Ergebnis mit nächsten Schritten“ + „Alle drei Säulen“):
// oben das Gesamtergebnis mit Stufe und den drei Säulen Sichtbarkeit · Vertrieb · Innovation, darunter die zwei nächsten Schritte
// für die schwächsten Säulen, aufklappbar die Innovation im Detail (Stufe, Netzdiagramm gegen den Branchenwert, EIN Satz
// Branchenvergleich mit Quelle und Jahr). Alles aus der Auswertung und den Daten der Vorlage — keine Zahl von woanders. Die Angebote
// zu den Schritten hängt der Server aus den Einstellungen der Instanz an (nie in der Vorlage). Rein.

import { auswerten, luecken, naechsteSchritte, profilAus, saeulenAuswerten, saeulenGenauigkeit, schrittBand } from './auswertung';
import { dimensionName, ergebnisSaetze, saeulenSaetze } from './zoe-texte';
import type { AngebotBereich, CheckAntworten, CheckBenchmarks, CheckErgebnis, CheckLuecke, CheckProfil, CheckVorlage, DimKey, SaeuleKey, SaeulenErgebnis, SchrittBand } from './typen';

export interface ErgebnisAchse { key: DimKey; name: string; wert: number; branche: number }

export interface ErgebnisSaeule { key: SaeuleKey; name: string; wert: number | null }

/** Eine Überschrift über mehreren Säulen mit ihrem Wert (Mittel der gemessenen Säulen, gerundet) — `null`, solange keine gemessen ist. */
export interface ErgebnisGruppe { key: string; name: string; frage?: string; wert: number | null; saeulen: SaeuleKey[] }

/** Rein: die Gruppen einer Vorlage aus den Säulenwerten. */
export function gruppenWerte(gruppen: readonly { key: string; name: string; saeulen: SaeuleKey[]; frage?: string }[] | undefined, werte: Partial<Record<SaeuleKey, number>>): ErgebnisGruppe[] {
  return (gruppen ?? []).map(g => {
    const w = g.saeulen.map(sk => werte[sk]).filter((x): x is number => typeof x === 'number');
    return { key: g.key, name: g.name, ...(g.frage ? { frage: g.frage } : {}), wert: w.length ? Math.round(w.reduce((a, b) => a + b, 0) / w.length) : null, saeulen: [...g.saeulen] };
  });
}

export interface ErgebnisSchritt { saeule: SaeuleKey; name: string; wert: number; band: SchrittBand; text: string; /** Bereich des Angebots der Instanz. */ angebot?: AngebotBereich }

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

/** Ein Satz, der die Gruppen gegeneinander einordnet (nur bei mindestens zwei gemessenen Gruppen). Erfindet nichts. */
export function gruppenSatz(gruppen: readonly ErgebnisGruppe[]): string | null {
  const g = gruppen.filter((x): x is ErgebnisGruppe & { wert: number } => typeof x.wert === 'number');
  if (g.length < 2) return null;
  const hoch = g.reduce((m, x) => (x.wert > m.wert ? x : m)), tief = g.reduce((m, x) => (x.wert < m.wert ? x : m));
  if (hoch.wert === tief.wert) return `${g.map(x => x.name).join(' und ')} liegen gleichauf bei ${hoch.wert} Punkten.`;
  return `Bei ${hoch.name} erreichen Sie ${hoch.wert} Punkte, bei ${tief.name} ${tief.wert}. Der größere Hebel liegt gerade bei ${tief.name}.`;
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
  /** Überschriften über den Säulen (nur Vorlagen mit `gruppen`, sonst leer). */
  gruppen: ErgebnisGruppe[];
  schritte: ErgebnisSchritt[];
  /** Die Innovation im Detail — nur im Innovations-Check (Vertriebscheck und Sichtbarkeitstest haben keine Dimensionen). */
  innovation: InnovationsDetail | null;
  zoe: string[];
  /** Innovations-Stufe ab dem Siegel-Wert UND „genau“ — ob es das Siegel gibt, entscheidet die Freigabe des Berichts (kommt später). */
  siegelMoeglich: boolean;
}

/** Der Gruppensatz steht direkt nach dem Satz zur Stufe. */
const mitGruppenSatz = (saetze: string[], gruppen: readonly ErgebnisGruppe[]): string[] => { const g = gruppenSatz(gruppen); return g ? [saetze[0], g, ...saetze.slice(1)] : saetze; };

/** Reihenfolge der Achsen im Netzdiagramm. */
export const ACHSEN: readonly DimKey[] = ['strategie', 'ki', 'automatisierung', 'daten', 'robotik', 'team'];

const GROESSE_TEXT: Readonly<Record<string, string>> = { '10-49': '10 bis 49', '50-249': '50 bis 249', '250+': '250 und mehr' };
const jahrVon = (q: { jahr_der_daten?: number; datum: string }) => q.jahr_der_daten ?? Number(q.datum.slice(0, 4));

/** EIN Satz zum Branchenvergleich mit Quelle und Jahr — nach Größe (Destatis) bzw. allgemein (Bitkom). */
export function branchenSatz(b: CheckBenchmarks, p: CheckProfil): string {
  // Die jüngste Destatis-Tabelle nach Größe (30.10.: 2025 statt 2024; ab 2025 mit dem EU-Unternehmensbegriff).
  const groesse = b.quellen.filter(q => /^destatis_\d{4}_groesse$/.test(q.id)).sort((x, y) => y.datum.localeCompare(x.datum))[0];
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
  // Achsen: nur die beantworteten Dimensionen (30.10.: der Kurzcheck fragt nicht jede ab — eine „0“ für Ungefragtes wäre falsch),
  // Robotik nur, wenn sie zählt. Unter drei Achsen zeigt die Seite kein Netzdiagramm.
  const achsen = ACHSEN.filter(d => ergebnis.dimensionen[d] !== undefined && (d !== 'robotik' || ergebnis.robotik_gewertet))
    .map(d => ({ key: d, name: dimensionName(d), wert: ergebnis.dimensionen[d] ?? 0, branche: bm[d] }));
  const defs = v.regeln.saeulen ?? [{ key: 'innovation', name: 'Innovation', abschnitt: 'B bis G', gewicht: 1, angebot: 'innovation' as const }];
  const namen: Record<SaeuleKey, string> = Object.fromEntries(defs.map(sa => [sa.key, sa.name]));
  const saeulenListe: ErgebnisSaeule[] = defs.map(sa => ({ key: sa.key, name: sa.name, wert: saeulen.werte[sa.key] ?? null }));
  const mitInnovation = Object.keys(ergebnis.dimensionen).length > 0;
  const genauigkeit = defs.some(sa => sa.key === 'innovation') ? ergebnis.genauigkeit : saeulenGenauigkeit(v.katalog, antworten);
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
      genauigkeit,
      saeulen: saeulenListe,
      gruppen: gruppenWerte(v.regeln.gruppen, saeulen.werte),
      // Ohne Säulen (Innovations-Check seit 30.10. abends): die zwei größten Lücken zum Branchenwert, je mit einem Schritt für diese Woche;
      // das Angebot hängt nur am ersten (sonst stünde dasselbe Angebot zweimal da).
      schritte: !v.regeln.saeulen?.length && v.regeln.dimension_schritte
        ? l.filter(x => !!v.regeln.dimension_schritte?.[x.dimension]).slice(0, 2).map((x, i) => {
          const band = schrittBand(x.wert);
          return { saeule: 'innovation' as SaeuleKey, name: dimensionName(x.dimension), wert: x.wert, band, text: v.regeln.dimension_schritte![x.dimension]![band], ...(i === 0 ? { angebot: 'innovation' as AngebotBereich } : {}) };
        })
        : naechsteSchritte(v.regeln, saeulen.werte).map(x => {
          const angebot = defs.find(sa => sa.key === x.saeule)?.angebot;
          return { ...x, name: namen[x.saeule] ?? x.saeule, ...(angebot ? { angebot } : {}) };
        }),
      innovation: !mitInnovation ? null : {
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
      zoe: !v.regeln.saeulen?.length && mitInnovation ? ergebnisSaetze(ergebnis, l) : mitGruppenSatz(saeulenSaetze(saeulen, genauigkeit, namen), gruppenWerte(v.regeln.gruppen, saeulen.werte)),
      siegelMoeglich: ergebnis.stufe >= v.regeln.siegel.ab_stufe && ergebnis.genauigkeit === 'genau',
    },
  };
}

// ── Vorschau ohne Kontakt (31.10., Kevin: „die größeren brauchen eine e-mail damit wir denen das ganze zuschicken können“) ──────────────
// Der AUSFÜHRLICHE Check (`umfang: 'lang'`) zeigt ohne Kontaktdaten nur die Vorschau: Gesamtzahl, Stufe und Skala, die Namen der Bereiche — keine
// Werte je Bereich, kein Branchenwert und -satz, kein Netzdiagramm, keine Schritte und Angebote, keine Einordnung über die Stufe hinaus. Die Trennung
// macht der SERVER (app/api/check/route.ts, Aktion `ergebnis`) mit dieser Funktion — der Browser bekommt den Rest gar nicht erst. Rein.

export interface ErgebnisVorschau {
  gesperrt: true;
  gesamt: number;
  stufe: number;
  stufeName: string;
  stufeKurz: string;
  stufen: { stufe: number; name: string }[];
  genauigkeit: CheckErgebnis['genauigkeit'];
  /** Nur die Namen der Bereiche, die der Bericht enthält — ohne Werte. */
  bereiche: string[];
  zoe: string[];
}

/**
 * Braucht diese Sitzung für den ganzen Bericht erst die Kontaktdaten? Ohne erfassten Kontakt: ausführlich gewählt — ODER (31.10., Gesamtcheck)
 * bei einem Check mit Wahl kurz/ausführlich über „Ausführlich weitermachen“ zum genauen Ergebnis gekommen (sonst wäre der ausführliche Bericht
 * über den kurzen Weg ohne E-Mail zu haben). Der kurze Check (vorläufig) und Checks ohne diese Wahl bleiben frei. Rein.
 */
export const berichtGesperrt = (s: { umfang?: string; kontaktStand: string }, o: { umfangWahl?: boolean; genauigkeit?: 'genau' | 'vorlaeufig' } = {}): boolean =>
  s.kontaktStand !== 'erfasst' && (s.umfang === 'lang' || (!!o.umfangWahl && o.genauigkeit === 'genau'));

export function ergebnisVorschau(a: ErgebnisAnsicht, zoe: string[]): ErgebnisVorschau {
  const bereiche = a.innovation?.achsen.length ? a.innovation.achsen.map(x => x.name) : a.saeulen.map(x => x.name);
  return { gesperrt: true, gesamt: a.gesamt, stufe: a.stufe, stufeName: a.stufeName, stufeKurz: a.stufeKurz, stufen: a.stufen, genauigkeit: a.genauigkeit, bereiche, zoe };
}
