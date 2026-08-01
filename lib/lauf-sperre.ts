// ─── MAKE OS — Doppellauf-Sperre ────────────────────────────────────────────
// Teure Agenten-Ketten (Tageslauf, Loops, Delegation) dürfen nicht doppelt
// feuern, wenn zwei Fenster offen sind oder Kevin & Malin gleichzeitig
// klicken: doppelte Kosten, doppelte Log-Einträge, Schreib-Rennen.
// In-Memory je Dev-Server-Prozess — genau das richtige Fenster für „gerade
// eben schon gestartet". Kein Store nötig.

const laufend = new Map<string, number>();

/**
 * true = Lauf darf starten (und ist ab jetzt gesperrt).
 * false = derselbe Lauf ist vor < fensterMs gestartet — Finger weg.
 */
export function sperren(key: string, fensterMs = 90_000): boolean {
  const jetzt = Date.now();
  const seit = laufend.get(key);
  if (seit && jetzt - seit < fensterMs) return false;
  laufend.set(key, jetzt);
  // Alte Einträge räumen, damit die Map nicht wächst.
  laufend.forEach((t, k) => { if (jetzt - t > 10 * 60_000) laufend.delete(k); });
  return true;
}

/** Sperre vorzeitig lösen (z. B. wenn der Lauf sofort scheitert). */
export function entsperren(key: string): void {
  laufend.delete(key);
}
