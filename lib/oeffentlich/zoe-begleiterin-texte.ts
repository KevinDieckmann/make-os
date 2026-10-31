// ─── Zoe-Begleiterin auf den öffentlichen Seiten — feste Texte (rein, 31.10., Website-Anbau) ───────────────────────────────────────────
// Kevin 24.10. (Klickrunde) und 31.10.: zur Beta ist Zoe auf der Website eine Begleiterin mit FESTEN Texten — keine KI-Antwort an Besucher,
// kein Modellaufruf, keine Daten nach außen. Sie steht unten rechts (Knopf), sagt je Schritt, was gerade passiert, und zeigt den Weg zum
// Erstgespräch (Buchungsseite) bzw. zum Kontaktformular. Die Sätze im Gespräch des Checks bleiben in lib/check/zoe-texte.ts (nur gelesen,
// nicht geändert); hier stehen nur die Sätze der Begleiterin. Namen kommen aus der Instanz (`marke`, `gastgeber`), nie fest im Code.
// Wächter: tests/zoe-begleiterin.test.ts (keine KI-Aufrufe, jeder Schritt hat Text, Art. 50 KI-VO im ersten Satz).

/** Wo die Begleiterin steht. */
export type BegleiterOrt = 'check' | 'kontakt';
/** Schritte des Checks (aus dem Stand der Seite) bzw. des Kontaktformulars. */
export type BegleiterSchritt = 'start' | 'kurz' | 'vertiefung' | 'kontakt' | 'wahl' | 'ergebnis' | 'formular' | 'gesendet';

export interface BegleiterKontext { marke: string; gastgeber: string }

/** Erster Satz immer: wer spricht — eine KI-Assistentin mit festen Texten (Art. 50 KI-VO, Transparenz). */
export const vorstellung = (k: BegleiterKontext): string =>
  `Ich bin Zoe, die KI-Assistentin von ${k.marke}. Hier gebe ich Ihnen feste Hinweise, keine frei erzeugten Antworten.`;

/** Ohne Vornamen des Gastgebers sagt die Instanz „uns“ (lib/check/server.ts `zoeKontext`) — dann in der Wir-Form. */
const ohneName = (k: BegleiterKontext) => !k.gastgeber || k.gastgeber === 'uns';

const TEXTE: Readonly<Record<BegleiterOrt, Partial<Record<BegleiterSchritt, (k: BegleiterKontext) => string[]>>>> = {
  check: {
    start: () => ['Wählen Sie, wie ausführlich Sie antworten möchten. Die Kurzfassung dauert nur wenige Minuten.'],
    kurz: () => ['Fast alles geht per Klick. Wenn eine Frage nicht passt, wählen Sie die Antwort, die am ehesten stimmt — es gibt kein Richtig oder Falsch.'],
    vertiefung: () => ['Mit den weiteren Fragen wird Ihr Ergebnis genauer. Sie können jede Frage überspringen, die Sie nicht beantworten möchten.'],
    kontakt: k => [`Ihre Adresse brauchen wir nur für Ihren Bericht und, wenn Sie möchten, für das Gespräch mit ${k.gastgeber}. Ihr Ergebnis sehen Sie auch ohne.`],
    wahl: () => ['Sie entscheiden: jetzt das Ergebnis sehen oder ein paar Fragen mehr für einen genaueren Bericht.'],
    ergebnis: k => [`Im kostenlosen Erstgespräch gehen Sie Ihr Ergebnis mit ${k.gastgeber} durch — 30 Minuten per Video-Call, kein Verkaufsgespräch.`],
  },
  kontakt: {
    formular: k => [`Schreiben Sie kurz, worum es geht. ${ohneName(k) ? 'Wir lesen' : `${k.gastgeber} liest`} jede Nachricht selbst und ${ohneName(k) ? 'melden uns' : 'meldet sich'} persönlich.`, 'Lieber direkt einen Termin? Dann nehmen Sie das Erstgespräch.'],
    gesendet: k => [`Danke! Ihre Nachricht ist angekommen. ${ohneName(k) ? 'Wir melden uns' : `${k.gastgeber} meldet sich`} persönlich bei Ihnen.`],
  },
};

/** Die Sätze der Begleiterin für Ort und Schritt — erst die Vorstellung, dann der Hinweis zum Schritt (rein). */
export function begleiterSaetze(ort: BegleiterOrt, schritt: BegleiterSchritt, k: BegleiterKontext): string[] {
  const t = TEXTE[ort][schritt] ?? TEXTE[ort][ort === 'check' ? 'kurz' : 'formular'];
  return [vorstellung(k), ...(t ? t(k) : [])];
}

/** Beschriftung der Wege, die Zoe anbietet. */
export const WEGE_TEXT = { erstgespraech: 'Erstgespräch buchen', kontakt: 'Nachricht schreiben', schliessen: 'Schließen', oeffnen: 'Zoe fragen' } as const;

/** Welche Schritte es je Ort gibt (für den Wächter: jeder hat Text). */
export const SCHRITTE: Readonly<Record<BegleiterOrt, readonly BegleiterSchritt[]>> = {
  check: ['start', 'kurz', 'vertiefung', 'kontakt', 'wahl', 'ergebnis'],
  kontakt: ['formular', 'gesendet'],
};
