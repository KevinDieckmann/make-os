// ─── Kleine Texthelfer für Vorschau und Ergebnis der ZOE-Werkzeuge (09.10.2026, „Agenten live durchgeklickt“) ──────────────
// Was im Freigabe-Stapel steht (Vorschau „nachher“, Ergebnis nach der Freigabe), liest ein Mensch: deutsche Priorität, Tag als „TT.MM.JJJJ“.
// Rein, ohne Abhängigkeiten — lib/zoe/register.ts und lib/zoe/werkzeuge.ts nutzen beide diese EINE Stelle (kein Kreis-Import).

/** Priorität in Worten (vorher stand im Stapel „(high)“). */
export const PRIO_NAME: Readonly<Record<string, string>> = { low: 'niedrig', medium: 'mittel', high: 'hoch', critical: 'kritisch' };

/** Ein Tag „JJJJ-MM-TT“ als „TT.MM.JJJJ“ — alles andere unverändert (höchstens 10 Zeichen, wie bisher in den Vorschauen). */
export const tagDe = (v: unknown): string => {
  const t = String(v ?? '').trim().slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : t;
};
