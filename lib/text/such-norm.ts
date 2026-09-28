// ─── Eine Such-Normalisierung für alles (28.09., K2 #105) ───────────────────
// Vorher hatte jede Suche ihre eigene Regel: die Schnellsuche zerlegte „ü“ in
// „u“ (NFKD), die Kartei verglich nur klein geschrieben, die Dubletten wieder
// anders. „mueller“ fand „Müller“ nirgends, und ein Name aus einer macOS-Datei
// (NFD: „u“ + Trema als zwei Zeichen) fand die NFC-Schreibweise nicht.
// Ab jetzt: EINE Funktion, rein, im Browser und auf dem Server gleich.
//
//   NFC → klein → ß→ss, ä/ö/ü→ae/oe/ue → NFKD ohne Akzente (é→e, ñ→n)
//
// So finden „mueller“, „müller“ und „Müller“ (NFC wie NFD) dasselbe, und
// „strasse“ findet „Straße“. Neue Suchen nehmen `suchNorm`/`suchPasst` —
// keine eigene Regel mehr bauen.

const UMLAUT: Record<string, string> = { 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss' };

/** Text in die Suchform bringen (siehe Kopf). Leer bleibt leer. */
export function suchNorm(t: string | null | undefined): string {
  return String(t ?? '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[äöüß]/g, c => UMLAUT[c] ?? c)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '');
}

/** Die Suchwörter einer Eingabe (normalisiert, ohne Leere). */
export function suchWoerter(frage: string | null | undefined): string[] {
  return suchNorm(frage).trim().split(/\s+/).filter(Boolean);
}

/** Passen alle Wörter der Frage irgendwo in die Felder? Leere Frage passt immer. */
export function suchPasst(felder: readonly (string | null | undefined)[], frage: string | null | undefined): boolean {
  const w = suchWoerter(frage);
  if (!w.length) return true;
  const t = suchNorm(felder.filter(Boolean).join(' '));
  return w.every(x => t.includes(x));
}
