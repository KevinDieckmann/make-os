// ─── Checks — Zoes feste Texte (24.10., Innovations-Check, Beta) ────────────────────────────────────────────────
// Kevin 24.10. (Klickrunde): zur Beta ist Zoe Begleiterin mit FESTEN Texten — keine KI-Antwort an Besucher, bis AVV, Anwalt und
// Leitplanken stehen (Live-KI, Sprache, Upload Ende November). Grundlage ist der Systemprompt der Bauanleitung (erste Nachricht,
// Wahl nach dem Kurzcheck, Ergebnis in drei Sätzen, Einladung zum Gespräch). Namen kommen aus der Instanz (`marke`, `gastgeber`),
// nie fest im Code. Zahlen in den Sätzen kommen nur aus der Auswertung. Rein.

import type { CheckErgebnis, CheckLuecke, DimKey } from './typen';

export interface ZoeKontext { marke: string; gastgeber: string }

/** Erste Nachricht (fest): Zoe sagt, dass sie eine KI ist und wofür die Antworten genutzt werden (Art. 50 KI-VO). */
export const begruessung = (k: ZoeKontext): string[] => [
  `Hi, ich bin Zoe, die KI-Assistentin von ${k.marke}.`,
  `Ich führe dich in rund 10 Minuten durch den Innovations-Check. Deine Antworten nutzen wir für dein Ergebnis und, wenn du willst, für deinen Bericht und dein Gespräch mit ${k.gastgeber}. Mehr dazu im Datenschutzhinweis unten.`,
  'Los geht’s — eine Frage nach der anderen, fast alles per Klick.',
];

/** Ein Satz, wenn ein neuer Abschnitt beginnt — für Besucher geschrieben (nicht die internen Intros des Katalogs). */
export const ABSCHNITT_SATZ: Readonly<Record<string, string>> = {
  A: 'Ein paar Eckdaten, damit ich dich mit deiner Branche vergleichen kann.',
  B: 'Jetzt geht es um Strategie und Führung.',
  C: 'Jetzt wird es spannend: Wie fest steckt KI in eurem Alltag?',
  D: 'Weiter mit euren Abläufen: Was läuft schon ohne Handarbeit?',
  E: 'Kurz zu Daten und Systemen.',
  F: 'Ein paar Fragen zu Robotik und Maschinen.',
  G: 'Und zum Schluss: dein Team.',
  H: 'Jetzt ein paar Fragen, die genau zum Handwerk passen.',
  I: 'Jetzt ein paar Fragen, die genau zu Dienstleistern, Agenturen und Beratern passen.',
  J: 'Jetzt ein paar Fragen, die genau zu Tech und Start-ups passen.',
  X: 'Zwei offene Fragen noch — gern in deinen eigenen Worten.',
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
  `Wohin soll ich deinen Bericht schicken? Mit deiner Adresse kannst du danach auch das kostenlose 90-Tage-Umsetzungsgespräch mit ${k.gastgeber} buchen.`,
  'Dein Ergebnis siehst du gleich hier, egal wie du dich entscheidest.',
];

export const WAHL_SATZ = 'Willst du dein Ergebnis jetzt sehen oder noch ein paar Fragen mehr beantworten? Dann wird dein Bericht genauer.';

const DIM_NAME: Readonly<Record<DimKey, string>> = {
  strategie: 'Strategie und Führung', ki: 'KI im Alltag', automatisierung: 'Automatisierung', daten: 'Daten und Systeme', robotik: 'Robotik', team: 'Team und Kompetenz',
};
export const dimensionName = (d: DimKey): string => DIM_NAME[d];

/** Zoe erklärt das Ergebnis in drei Sätzen: Stufe, stärkste Dimension, größte Lücke zur Branche. Erfindet nichts. */
export function ergebnisSaetze(e: Pick<CheckErgebnis, 'stufe' | 'stufe_name' | 'gesamt' | 'dimensionen' | 'genauigkeit'>, l: readonly CheckLuecke[]): string[] {
  const dims = Object.entries(e.dimensionen) as [DimKey, number][];
  const staerkste = dims.reduce<[DimKey, number] | null>((m, x) => (!m || x[1] > m[1] ? x : m), null);
  const gleichauf = dims.length > 1 && dims.every(x => x[1] === dims[0][1]);
  const s = [`Du stehst auf Stufe ${e.stufe}: ${e.stufe_name} (${e.gesamt} von 100 Punkten).`];
  if (gleichauf) s.push(`In allen Bereichen liegst du gleichauf bei ${dims[0][1]} Punkten.`);
  else if (staerkste) s.push(`Am stärksten bist du bei ${DIM_NAME[staerkste[0]]} mit ${staerkste[1]} Punkten.`);
  const groesste = l.find(x => x.abstand > 0);
  s.push(groesste
    ? `Die größte Lücke zu deiner Branche liegt bei ${DIM_NAME[groesste.dimension]}: ${groesste.wert} gegenüber ${groesste.branche} Punkten.`
    : 'In keinem Bereich liegst du unter dem Branchenwert.');
  if (e.genauigkeit === 'vorlaeufig') s.push('Das ist eine vorläufige Stufe. Mit den weiteren Fragen wird dein Bericht genauer.');
  return s;
}

export const gespraechSatz = (k: ZoeKontext): string =>
  `Im kostenlosen 90-Tage-Umsetzungsgespräch legst du mit ${k.gastgeber} deine Top 3 für die nächsten 90 Tage fest: 60 Minuten per Video-Call, kein Verkaufsgespräch.`;
