// ─── Fulfillment — Fachbegriffe, die intern nicht mehr sichtbar sind (17.10. spät, Branch `ff-einfach`) ─────────────────────────────────────────
// Rückmeldung 17.10.: „Ich will, dass das Fulfillment wirklich maximal einfach für uns ist.“ Die Oberfläche spricht schlicht: eine Bestätigung statt eines
// „Abstimmungspunkts“, ein Schritt statt eines „Knotens“, der Name einer Analyse statt „A1“ … „A13“, ein Ablauf statt einer „Paket-Vorlage“.
// Die Kennungen im Code und in den Daten bleiben (F0 …, `freigabe`, `abstimmung`, `a1`, `knoten`, `art: 'paket'`) — nur sichtbare Texte sprechen so.
// Wächter: tests/fulfillment-heute.test.ts (Texte der internen Fulfillment-Oberfläche, der Kunden-Seite und gerenderte Ansichten). Seit 18.10. spricht auch die
// Kunden-Seite (components/os/fulfillment/kunde, lib/fulfillment/kunde) so — „Bestätigung“ statt „Abstimmungspunkt“ (Nachprüfung L1b: „maximal einfach“);
// „Vorlage“/„Paket“ heißen sichtbar „Ablauf“. „Freigabe“ steht nicht auf der Liste: es meint in MAKE OS die Vorschläge von ZOE (Freigabe-Stapel). Rein.

export interface Fachbegriff { wort: string; muster: RegExp; statt: string }

export const FACHBEGRIFFE: readonly Fachbegriff[] = [
  { wort: 'Abstimmungspunkt', muster: /Abstimmungspunkt/, statt: 'Bestätigung' },
  { wort: 'Knoten', muster: /\bKnoten\b/, statt: 'Schritt' },
  { wort: 'A0–A13', muster: /\bA(?:1[0-3]|[0-9])\b/, statt: 'den Namen der Analyse' },
  { wort: 'Vorlage', muster: /Vorlage/, statt: 'Ablauf' },
  { wort: 'Paket', muster: /\bPaket\b/, statt: 'Ablauf' },
];

/** Welche Fachbegriffe stehen in diesem Text? (leer = keiner) */
export const fachbegriffeIn = (text: string): string[] => FACHBEGRIFFE.filter(f => f.muster.test(text)).map(f => f.wort);
