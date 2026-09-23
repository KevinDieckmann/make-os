// ─── Empfang: die Regeln hinter dem Startbildschirm ─────────────────────────
// Bewusst hier und nicht in der .tsx: vitest übersetzt in diesem Projekt kein
// JSX (jsx: preserve), Logik in einer Komponente wäre also ungetestet. Alles,
// was eine Regel ist, steht deshalb in einer .ts-Datei.

export type Zustand = 'ruht' | 'hoert' | 'denkt' | 'spricht';

/**
 * Welcher Zustand gilt, wenn mehrere gleichzeitig wahr sind.
 *
 * Die Reihenfolge ist eine Entscheidung, keine Zufälligkeit: Zuhören schlägt
 * alles, weil Kevin in dem Moment etwas tut und sofortige Rückmeldung braucht.
 * Sprechen schlägt Denken, weil man den ersten Satz schon hört, während im
 * Hintergrund noch gerechnet wird.
 */
export function zustandVon(s: { hoert: boolean; spricht: boolean; denkt: boolean }): Zustand {
  if (s.hoert) return 'hoert';
  if (s.spricht) return 'spricht';
  if (s.denkt) return 'denkt';
  return 'ruht';
}

/**
 * Text in Wörter zerlegen, Trennzeichen behalten.
 *
 * Warum die Zwischenräume mitkommen: sie werden mit ausgegeben und tragen die
 * Zeilenumbrüche. Wer nur an Leerzeichen trennt und mit einem festen Abstand
 * wieder zusammensetzt, verliert jeden Absatz.
 */
export function inWorte(text: string): string[] {
  return text.split(/(\s+)/).filter(t => t.length > 0);
}

/** Verzögerung für das i-te Wort in Sekunden — 45 ms Versatz, bei 2,2 s Deckel.
 *  Ohne Deckel bräuchte ein langer Absatz eine halbe Minute, bis er dasteht. */
export function wortVerzug(i: number): number {
  return Math.round(Math.min(2.2, i * 0.045) * 1000) / 1000;
}

/**
 * Vier Einstiege, passend zur Tageszeit. Sie sind kein Menü, sondern ein
 * Angebot: ein leeres Eingabefeld ist die unfreundlichste Oberfläche, die es
 * gibt — man weiß nicht, was das Ding kann.
 */
export function vorschlaege(stunde: number): string[] {
  if (stunde < 11) return ['Was steht heute an?', 'Wie war meine Nacht?', 'Was ist über Nacht reingekommen?', 'Womit fange ich an?'];
  if (stunde < 17) return ['Wie stehe ich gerade?', 'Was ist heute liegen geblieben?', 'Zeig mir die Zahlen', 'Woran arbeiten die Agenten?'];
  if (stunde < 22) return ['Wie war der Tag?', 'Was muss morgen früh raus?', 'Was liegt in meinem Stapel?', 'Zeig mir die Woche'];
  return ['Was ist morgen wichtig?', 'Fasse den Tag zusammen', 'Was liegt in meinem Stapel?', 'Wie stehen die Zahlen?'];
}

/** Tageszeit als Wort — für die Zeile unter dem Hirn. */
export function tagesWort(stunde: number): string {
  if (stunde < 5) return 'Nacht';
  if (stunde < 11) return 'Morgen';
  if (stunde < 14) return 'Mittag';
  if (stunde < 18) return 'Nachmittag';
  if (stunde < 22) return 'Abend';
  return 'Nacht';
}
