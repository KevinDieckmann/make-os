// ─── Checks — Zoes feste Texte (24.10., Innovations-Check, Beta) ────────────────────────────────────────────────
// Kevin 24.10. (Klickrunde): zur Beta ist Zoe Begleiterin mit FESTEN Texten — keine KI-Antwort an Besucher, bis AVV, Anwalt und
// Leitplanken stehen (Live-KI, Sprache, Upload Ende November). Grundlage ist der Systemprompt der Bauanleitung (erste Nachricht,
// Wahl nach dem Kurzcheck, Ergebnis in drei Sätzen, Einladung zum Gespräch). Namen kommen aus der Instanz (`marke`, `gastgeber`),
// nie fest im Code. Zahlen in den Sätzen kommen nur aus der Auswertung. Rein.

import type { CheckErgebnis, CheckLuecke, DimKey, SaeuleKey, SaeulenErgebnis } from './typen';

export interface ZoeKontext { marke: string; gastgeber: string }

/** Erste Nachricht (fest): Zoe sagt, dass sie eine KI ist und wofür die Antworten genutzt werden (Art. 50 KI-VO). */
export const begruessung = (k: ZoeKontext): string[] => [
  `Guten Tag, ich bin Zoe, die KI-Assistentin von ${k.marke}.`,
  `Ich führe Sie in rund 10 Minuten durch den Innovations-Check, in drei Bereichen: Sichtbarkeit, Vertrieb und Innovation. Ihre Antworten nutzen wir für Ihr Ergebnis und, wenn Sie möchten, für Ihren Bericht und Ihr Gespräch mit ${k.gastgeber}. Mehr dazu im Datenschutzhinweis unten.`,
  'Los geht’s: eine Frage nach der anderen, fast alles per Klick.',
];

/** Ein Satz, wenn ein neuer Abschnitt beginnt — für Besucher geschrieben (nicht die internen Intros des Katalogs). */
export const ABSCHNITT_SATZ: Readonly<Record<string, string>> = {
  A: 'Ein paar Eckdaten, damit ich Sie mit Ihrer Branche vergleichen kann.',
  S: 'Erster Bereich, Sichtbarkeit: Versteht man sofort, was Sie tun, und findet man Sie?',
  V: 'Zweiter Bereich, Vertrieb: Wie werden aus Kontakten Kunden?',
  B: 'Dritter Bereich, Innovation. Zuerst zu Strategie und Führung.',
  C: 'Jetzt wird es spannend: Wie fest steckt KI in Ihrem Alltag?',
  D: 'Weiter mit Ihren Abläufen: Was läuft schon ohne Handarbeit?',
  E: 'Kurz zu Daten und Systemen.',
  F: 'Ein paar Fragen zu Robotik und Maschinen.',
  G: 'Und zum Schluss: Ihr Team.',
  H: 'Jetzt ein paar Fragen, die genau zum Handwerk passen.',
  I: 'Jetzt ein paar Fragen, die genau zu Dienstleistern, Agenturen und Beratern passen.',
  J: 'Jetzt ein paar Fragen, die genau zu Tech und Start-ups passen.',
  X: 'Zwei offene Fragen noch — gern in Ihren eigenen Worten.',
};

/** Kurze Bestätigung nach einer Antwort — bewertet nie (keine Punkte, kein Lob, kein Tadel), wechselt ab. */
const QUITTUNG = ['Danke.', 'Notiert.', 'Gut zu wissen.', 'Verstanden.', 'Alles klar.'];
export const quittung = (nummer: number): string => QUITTUNG[Math.abs(nummer) % QUITTUNG.length];

/** Hilfe unter einer Beleg-Frage: Zoes Nachfragen aus dem Katalog als ein Satz. */
export const belegHilfe = (nachfragen: readonly string[] | undefined): string =>
  nachfragen?.length ? `Ein konkretes Beispiel reicht. Hilfreich: ${nachfragen.join(' ')}` : 'Ein konkretes Beispiel reicht.';

/** Antwort-Bausteine zum Antippen bei Beleg-Fragen (füllen nur das Textfeld, die Person kann weiterschreiben). */
export const BELEG_BAUSTEINE: Readonly<Record<string, readonly string[]>> = {
  C5: ['Noch kein fester Ablauf.', 'Wir probieren gerade aus: ', 'Fest im Einsatz: '],
  D6: ['Noch keiner.', 'Teilweise automatisch: ', 'Läuft komplett automatisch: '],
};

export const kontaktSatz = (k: ZoeKontext): string[] => [
  'Geschafft — das war der Kurzcheck.',
  `Wohin soll ich Ihren Bericht schicken? Mit Ihrer Adresse können Sie danach auch das kostenlose Erstgespräch mit ${k.gastgeber} buchen.`,
  'Ihr Ergebnis sehen Sie gleich hier, egal wie Sie sich entscheiden.',
];

export const WAHL_SATZ = 'Möchten Sie Ihr Ergebnis jetzt sehen oder noch ein paar Fragen mehr beantworten? Dann wird Ihr Bericht genauer.';

const DIM_NAME: Readonly<Record<DimKey, string>> = {
  strategie: 'Strategie und Führung', ki: 'KI im Alltag', automatisierung: 'Automatisierung', daten: 'Daten und Systeme', robotik: 'Robotik', team: 'Team und Kompetenz',
};
export const dimensionName = (d: DimKey): string => DIM_NAME[d];

const SAEULE_NAME: Readonly<Record<SaeuleKey, string>> = { sichtbarkeit: 'Sichtbarkeit', vertrieb: 'Vertrieb', innovation: 'Innovation' };
export const saeuleName = (sk: SaeuleKey): string => SAEULE_NAME[sk];

/**
 * Zoe erklärt das Gesamtergebnis (30.10.) in drei Sätzen: Stufe, stärkste Säule, größter Hebel. Erfindet nichts — alle Zahlen kommen
 * aus der Auswertung. Die Innovations-Details (Dimensionen, Branchenvergleich) erklärt `ergebnisSaetze` im aufklappbaren Teil.
 */
export function saeulenSaetze(e: SaeulenErgebnis, genauigkeit: CheckErgebnis['genauigkeit']): string[] {
  const werte = Object.entries(e.werte) as [SaeuleKey, number][];
  const s = [`Sie stehen auf Stufe ${e.stufe}: ${e.stufe_name} (${e.gesamt} von 100 Punkten).`];
  if (werte.length > 1) {
    const hoch = werte.reduce((m, x) => (x[1] > m[1] ? x : m));
    const tief = werte.reduce((m, x) => (x[1] < m[1] ? x : m));
    if (hoch[1] === tief[1]) s.push(`Alle Bereiche liegen gleichauf bei ${hoch[1]} Punkten.`);
    else {
      s.push(`Am stärksten sind Sie bei ${SAEULE_NAME[hoch[0]]} mit ${hoch[1]} Punkten.`);
      s.push(`Den größten Hebel hat ${SAEULE_NAME[tief[0]]} mit ${tief[1]} Punkten. Dazu finden Sie unten Ihren nächsten Schritt.`);
    }
  }
  if (genauigkeit === 'vorlaeufig') s.push('Das ist ein vorläufiges Ergebnis. Mit den weiteren Fragen wird Ihr Bericht genauer.');
  return s;
}

/** Zoe erklärt die Innovation im Detail in drei Sätzen: Stufe, stärkste Dimension, größte Lücke zur Branche. Erfindet nichts. */
export function ergebnisSaetze(e: Pick<CheckErgebnis, 'stufe' | 'stufe_name' | 'gesamt' | 'dimensionen' | 'genauigkeit'>, l: readonly CheckLuecke[]): string[] {
  const dims = Object.entries(e.dimensionen) as [DimKey, number][];
  const staerkste = dims.reduce<[DimKey, number] | null>((m, x) => (!m || x[1] > m[1] ? x : m), null);
  const gleichauf = dims.length > 1 && dims.every(x => x[1] === dims[0][1]);
  const s = [`Bei der Innovation stehen Sie auf Stufe ${e.stufe}: ${e.stufe_name} (${e.gesamt} von 100 Punkten).`];
  if (gleichauf) s.push(`In allen Bereichen liegen Sie gleichauf bei ${dims[0][1]} Punkten.`);
  else if (staerkste) s.push(`Am stärksten sind Sie bei ${DIM_NAME[staerkste[0]]} mit ${staerkste[1]} Punkten.`);
  const groesste = l.find(x => x.abstand > 0);
  s.push(groesste
    ? `Die größte Lücke zu Ihrer Branche liegt bei ${DIM_NAME[groesste.dimension]}: ${groesste.wert} gegenüber ${groesste.branche} Punkten.`
    : 'In keinem Bereich liegen Sie unter dem Branchenwert.');
  return s;
}

export const gespraechSatz = (k: ZoeKontext): string =>
  `Im kostenlosen Erstgespräch legen Sie mit ${k.gastgeber} Ihre drei wichtigsten Schritte für die nächsten 90 Tage fest: 60 Minuten per Video-Call, kein Verkaufsgespräch.`;
