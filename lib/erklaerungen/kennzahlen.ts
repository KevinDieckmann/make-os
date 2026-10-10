// ─── Erklärungen · Kennzahlen (10.10.) ────────────────────────────────────────────────────────────────────────────────────────
// Zwei Wege:
//   1. Kennzahlen der Index-Register (Business, Privat, Gesundheit, Traktion, Fokus & Zeit, Kapazität): „Wie gerechnet · Beispiel · Was ihr tun
//      könnt“ wird AUS dem Register gebaut (Formel, Einheit, Schwellen, Quelle, Pflege-Weg) — nichts davon ist neu erfunden. Das Beispiel
//      rechnet die Kennzahl mit der Mitte zwischen roter und grüner Schwelle durch (dieselben Funktionen wie der Index: punkte/ampel).
//   2. Zahlen außerhalb der Register (Kapazität-Kacheln, Wirkung, Scoreboard …): von Hand geschriebene Texte in KENNZAHL_TEXTE.
// Rein und client-sicher (nur Typen und die reinen Rechenfunktionen aus lib/kennzahlen/kern.ts und lib/business/text.ts).

import { punkte, ampel, type Ampel, type Einheit, type Richtung } from '@/lib/kennzahlen/kern';
import { schwelle, schwellenText } from '@/lib/business/text';
import { KOPF, kennzahlTextAbschnitte, type ErklaerAbschnitt, type KennzahlText } from './typen';

/** Was die Erklärung einer Register-Kennzahl braucht — passt auf `KennzahlDefBasis` und auf `KennzahlStand` (dann mit Messung). */
export interface KennzahlQuelle {
  label: string;
  einheit: Einheit;
  richtung: Richtung;
  gruen: number;
  rot: number;
  formel: string;
  pflegen?: { text: string; href: string };
  /** Satz der Lücke („es fehlt …“) — aus der Definition (`luecke`) oder, bei einem Stand ohne Messung, `quelle`. */
  luecke?: string;
  /** Mit Stand: ist die Kennzahl gemessen? Fehlt das Feld, ist nur die Definition bekannt. */
  gemessen?: boolean;
}

const AMPEL_WORT: Record<Ampel, string> = { gruen: 'grün', gelb: 'gelb', rot: 'rot', grau: 'grau' };

/** Rundet einen Beispielwert so, wie man ihn in dieser Einheit schreiben würde. */
function runde(w: number, einheit: Einheit, breite: number): number {
  switch (einheit) {
    case 'tage': case 'punkte': return Math.round(w);
    case 'eur': return Math.round(w / (breite >= 1000 ? 100 : breite >= 100 ? 10 : 1)) * (breite >= 1000 ? 100 : breite >= 100 ? 10 : 1);
    case 'faktor': return Math.round(w * 100) / 100;
    case 'anzahl': return breite >= 10 ? Math.round(w) : Math.round(w * 10) / 10;
    default: return Math.round(w * 10) / 10;
  }
}

/** Der gerechnete Beispielfall: ein Wert zwischen roter und grüner Schwelle, mit Ampel und Punkten — dieselbe Rechnung wie im Index. */
export function kennzahlBeispiel(k: Pick<KennzahlQuelle, 'label' | 'einheit' | 'richtung' | 'gruen' | 'rot'>): string {
  const breite = Math.abs(k.gruen - k.rot);
  const w = runde(k.rot + (k.gruen - k.rot) / 2, k.einheit, breite);
  const def = { richtung: k.richtung, gruen: k.gruen, rot: k.rot, direkt: k.einheit === 'punkte' };
  const p = punkte(w, def);
  const a = ampel(w, def);
  const wert = schwelle(w, k.einheit);
  const ende = k.richtung === 'hoch'
    ? `Ab ${schwelle(k.gruen, k.einheit)} wäre sie grün (100 Punkte), unter ${schwelle(k.rot, k.einheit)} rot.`
    : `Bis ${schwelle(k.gruen, k.einheit)} wäre sie grün (100 Punkte), über ${schwelle(k.rot, k.einheit)} rot.`;
  return `Steht „${k.label}“ bei ${wert}, zeigt die Ampel ${AMPEL_WORT[a]} und die Kennzahl zählt ${p} von 100 Punkten. ${ende}`;
}

/** „Wie gerechnet“: die Formel des Registers, die Schwellen und die Umrechnung in Punkte. */
export function kennzahlWieGerechnet(k: Pick<KennzahlQuelle, 'einheit' | 'richtung' | 'gruen' | 'rot' | 'formel'>): string {
  const formel = k.formel.trim().replace(/[.\s]+$/, '');
  const punkteText = k.einheit === 'punkte'
    ? 'Der Wert ist schon ein Score von 0 bis 100 und zählt so, wie er ist.'
    : 'An der roten Schwelle zählt sie 20 von 100 Punkten, an der grünen 100, dazwischen linear.';
  return `${formel}. ${schwellenText(k)}. ${punkteText}`;
}

/** „Was ihr tun könnt“: der Weg aus dem Register (`pflegen`), die Lücke, falls nicht gemessen, und in welche Richtung der Wert muss. */
export function kennzahlWasTun(k: Pick<KennzahlQuelle, 'einheit' | 'richtung' | 'gruen' | 'pflegen' | 'luecke' | 'gemessen' | 'label'>): string {
  const teile: string[] = [];
  if (k.gemessen === false && k.luecke) teile.push(`Noch nicht gemessen — es fehlt: ${k.luecke.replace(/[.\s]+$/, '')}.`);
  if (k.pflegen) teile.push(`${k.pflegen.text.replace(/[.\s]+$/, '')} — der Link steht in der Kennzahl.`);
  else teile.push('Die Punkte unter der Kennzahl zeigen, woraus sie besteht; jeder führt dorthin, wo man etwas ändern kann.');
  teile.push(k.richtung === 'hoch'
    ? `Der Wert soll steigen: Grün beginnt bei ${schwelle(k.gruen, k.einheit)}.`
    : `Der Wert soll sinken: Grün gilt bis ${schwelle(k.gruen, k.einheit)}.`);
  teile.push('Passen die Schwellen nicht zu euch, lassen sie sich im Fenster der Kennzahl unter „Schwellen anpassen“ ändern.');
  return teile.join(' ');
}

/** Die Erklärung einer Register-Kennzahl: Wie gerechnet · Beispiel · Was ihr tun könnt. */
export function kennzahlAbschnitte(k: KennzahlQuelle): ErklaerAbschnitt[] {
  return [
    { kopf: KOPF.wie, text: kennzahlWieGerechnet(k) },
    { kopf: KOPF.beispiel, text: kennzahlBeispiel(k) },
    { kopf: KOPF.tun, text: kennzahlWasTun(k) },
  ];
}

// ── Kennzahlen außerhalb der Register ──────────────────────────────────────────────────────────────────────────────────────

export const KENNZAHL_TEXTE: Readonly<Record<string, KennzahlText>> = {
  'kapazitaet.last4': {
    wie: 'Verplante Stunden (Zuweisungen plus Aufwand bis zum Termin) geteilt durch die belastbaren Stunden des Teams in den nächsten vier Wochen. Grün bis 85 %, rot über 100 %.',
    beispiel: 'Verplant 60 Stunden, belastbar 80 Stunden: Last 75 %. Bei 110 verplanten Stunden wären es 138 % — jemand müsste Überstunden machen.',
    tun: 'Ziele verschieben, Aufwand anpassen, Aufgaben abgeben oder Termine absagen. Die Liste „Machbarkeit“ zeigt, was zuerst wackelt.',
  },
  'kapazitaet.machbar': {
    wie: 'Machbare Meilensteine und Ziele (eng zählt halb) geteilt durch alle bewerteten mit Aufwand und Termin. Machbar sind sie bis 70 % der freien Zeit bis zum Termin, eng bis 90 %, darüber nicht machbar. Die Kachel zeigt „machbar / bewertet“.',
    beispiel: '5 / 7 heißt: Von sieben bewerteten Posten sind fünf machbar; die beiden anderen sind eng oder nicht machbar.',
    tun: 'Bei „nicht machbar“ Aufwand prüfen, Termin verschieben oder jemanden dazunehmen. Ohne Aufwand oder Termin gibt es keine Aussage — beides am Meilenstein eintragen.',
  },
  'kapazitaet.puffer': {
    wie: 'Durchschnitt der belastbaren minus verplanten Stunden je Woche, nächste vier Wochen, für das ganze Team. Grün ab 8 Stunden, rot unter 0 (überbucht).',
    beispiel: 'Belastbar 32 Stunden, verplant 26: Puffer 6 Stunden — das trägt eine kleine Störung, aber keinen Ausfall.',
    tun: 'Liegt der Puffer unter 8 Stunden, Zuweisungen prüfen oder Urlaube und feste Blöcke ansehen.',
  },
  'kapazitaet.planTreue': {
    wie: 'Gemessene Business-Fokuszeit geteilt durch die geplanten Stunden der abgeschlossenen Wochen, deren Plan montags festgehalten wurde (die letzten vier). Ohne festgehaltene Woche eine Näherung — das steht dann daneben. Grün ab 80 %, rot unter 50 %.',
    beispiel: 'Geplant 30 Stunden, tatsächlich 24: Plan-Treue 80 %. Das ist kein Vorwurf — es sagt, wie realistisch geplant wird.',
    tun: 'Liegt sie dauerhaft unter 80 %, plant weniger ein oder lasst Raum für Unvorhergesehenes. Fokus-Zeit misst der Fokus-Zähler oben im Kopf.',
  },
  'kapazitaet.kopf': {
    wie: 'Der Team-Faktor aus der geteilten Erholung: Grün 100 %, Gelb 90 %, Rot 75 % der belastbaren Zeit, nur für die nächsten 14 Tage. Er rechnet nur mit, wenn Personen ihre Erholung ausdrücklich teilen.',
    beispiel: 'Zwei Personen teilen ihre Erholung, eine steht auf Gelb: Der Faktor sinkt leicht, und die nächsten zwei Wochen werden etwas vorsichtiger geplant.',
    tun: 'Nichts — niemand muss etwas teilen. Einzelwerte sieht nur die Person selbst, im Team zählt nur der Faktor.',
  },
  'fokus.wirkung.abdeckung': {
    wie: 'Anteil der Messpunkte der Wirkung, die auf echten Daten beruhen. Der Rest ist noch nicht gemessen.',
    beispiel: '55 % heißt: Gut die Hälfte der Faktoren hat eine Messung. Die Zahl ist ein guter Hinweis, aber noch kein Urteil.',
    tun: 'Unter „Säulen“ aufklappen: Die grauen Faktoren führen zu der Stelle, an der du sie erfassen kannst.',
  },
  'fokus.wirkung.bestwert': {
    wie: 'Der höchste Wert der Wirkung in den gespeicherten Tagen — als Vergleichsmarke.',
    beispiel: 'Bestwert 81 am 12.09., heute 74: Es ging schon besser, und der Verlauf darunter zeigt, wann.',
    tun: 'Schau im Verlauf, was um den Bestwert herum anders war, und mach das wieder.',
  },
  'agent.annahmequote': {
    wie: 'Angenommene Vorschläge der Skills dieses Heads geteilt durch alle entschiedenen (angenommen plus abgelehnt). Offene Vorschläge zählen nicht.',
    beispiel: '8 angenommen, 2 abgelehnt: 80 %. Gemessen werden Agenten, nie Menschen.',
    tun: 'Sinkt die Quote, prüfe den Auftrag und die Merksätze des Heads. Wer beim Ablehnen einen Grund nennt, hilft ihm am meisten.',
  },
  'agent.laeufe': {
    wie: 'Wie viele Läufe (Hintergrundaufgaben und Skills) dieser Head insgesamt hatte.',
    beispiel: '12 Läufe in einem Monat heißt: Der Head hat zwölfmal im Takt oder auf Auftrag gearbeitet — jeder Lauf kostet etwas.',
    tun: 'Läuft er häufiger, als du Ergebnisse brauchst, stelle den Zeitplan seltener oder schalte die Hintergrund-KI ein Stück zurück.',
  },
  'agent.kostenErgebnis': {
    wie: 'Alle Kosten der Läufe dieses Heads geteilt durch die Zahl der fertigen Läufe.',
    beispiel: '3,60 € Kosten bei 12 fertigen Läufen: 0,30 € je Ergebnis. Ein Lauf, der nur ein Ergebnis zeigt, aber 2 € kostet, lohnt den Blick.',
    tun: 'Hoch? Modellstufe oder Aufwand senken, Kostengrenze je Lauf setzen oder das Budget des Heads begrenzen.',
  },
  'scoreboard.wochen': {
    wie: 'Wenige Kennzahlen, Woche für Woche mit einem Ziel: die laufende Woche und die sieben davor. Ein Klick auf den Namen öffnet die Kennzahl im Traktions-Index.',
    beispiel: 'Ziel 5 Gespräche pro Woche. Die Zeile zeigt 3, 6, 5, 4 — zwei Wochen haben das Ziel erreicht, zwei nicht.',
    tun: 'Setze die Ziele realistisch; liegen alle Wochen darunter, ist das Ziel zu hoch oder der Rhythmus zu schwach.',
  },
};

/** Die Erklärung einer Zahl ohne Register (`KENNZAHL_TEXTE`) — keine Abschnitte, wenn es sie nicht gibt. */
export function kennzahlTextVon(schluessel: string): ErklaerAbschnitt[] {
  const t = KENNZAHL_TEXTE[schluessel];
  return t ? kennzahlTextAbschnitte(t) : [];
}
