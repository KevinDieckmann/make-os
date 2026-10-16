// ─── MAKE OS — Demo-Instanz: „Beispiel“-Ergebnisse der KI (rein, client-sicher, 15.10.) ─────────────────────────────────────────────
// Kevin 15.10. (Abnahme 2 B13: „Die Demo zeigt keine KI“): „Beispiel-Ergebnisse säen.“ Ohne KI-Schlüssel zeigt die Demo-Instanz erfundene Ergebnisse
// der Heads, des Head of Finance, von ZOE (Stapel, Gespräch) und der Analyse — sichtbar als „Beispiel“ markiert. Die Marke sitzt AN DEN DATEN
// (`beispiel: true` am Bericht, Vorschlag, Lauf, an der Nachricht); die Oberfläche zeigt sie als kleinen Chip (components/os/BeispielMarke.tsx).
// Gesät wird nur in einer Demo-Instanz (`beispieleErlaubt`: `MAKE_OS_DEMO=1` UND Demo-Marke im Datenordner) — eine Live-Instanz bekommt nie Beispiele.

/** Der kurze Satz am Chip (Tooltip): was „Beispiel“ heißt. */
export const BEISPIEL_HINWEIS = 'Erfundenes Beispiel der Demo — so sieht ein Ergebnis der KI aus; kein echter Lauf.';

/** Trägt ein Eintrag die Marke „Beispiel“? */
export const istBeispiel = (x: unknown): boolean => !!x && typeof x === 'object' && (x as { beispiel?: unknown }).beispiel === true;

/**
 * Dürfen Beispiele gesät werden? Nur in einer Demo-Instanz: Schalter `MAKE_OS_DEMO=1` UND die Demo-Marke (Bestand `demo-instanz`, nur die Saat
 * legt sie an) ist da. Fehlt eins davon, gibt es nie Beispiele — auch nicht, wenn jemand die Saat-Funktion versehentlich aufruft.
 */
export function beispieleErlaubt(o: { env: Record<string, string | undefined>; marke: unknown }): boolean {
  const m = o.marke as { saat?: unknown } | null;
  return o.env.MAKE_OS_DEMO === '1' && !!m && typeof m === 'object' && typeof m.saat === 'number';
}
