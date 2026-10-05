// ─── KI-VO Art. 50: KI-erzeugte Inhalte erkennbar machen (05.10.) ───────────────────────────────────────────────────
// Wo ein Text von ZOE stammt und an Dritte gehen KANN (Mail-Antworten, Ansprachen, LinkedIn-/Content-Entwürfe, ZOE-
// Antworten), trägt die Antwort der Route ein maschinenlesbares Kennzeichen `ki` und die Oberfläche eine dezente Marke
// („KI-Entwurf“, components/os/KiMarke.tsx). Versendet wird ohnehin nur nach Prüfung durch einen Menschen (Human-in-the-
// Loop, Eiserne Regel 3) — Art. 50 Abs. 4 UAbs. 2 nimmt menschlich geprüfte/redigierte Texte aus; die Marke erinnert
// genau daran. Rein, ohne Abhängigkeiten.

export interface KiKennzeichen {
  /** Immer true — der Text ist (ganz oder teilweise) von einem KI-System erzeugt. */
  erzeugt: true;
  /** Wer: ZOE (Modell eines Drittanbieters). */
  durch: string;
  /** Kurzer Hinweis für die Oberfläche. */
  hinweis: string;
  /** Wann (ISO). */
  zeit: string;
}

export const KI_HINWEIS = 'KI-Entwurf — vor dem Weitergeben prüfen und anpassen';

export function kiKennzeichen(jetzt = new Date()): KiKennzeichen {
  return { erzeugt: true, durch: 'ZOE (KI-Modell von Anthropic)', hinweis: KI_HINWEIS, zeit: jetzt.toISOString() };
}
