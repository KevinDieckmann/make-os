// ─── MAKE OS — Kostenschutz für Modellaufrufe (26.09.) ──────────────────────
// Jede Route, die ein Sprachmodell erreicht (Jarvis, Köpfe, Beleg, Aufträge),
// fragt vorher hier nach: je Person höchstens `max` Aufrufe je Fenster. Ein
// benutztes Konto oder ein Skript im Browser kann so keine Rechnung auftürmen.
// Im Speicher des Prozesses — nach einem Neustart beginnt das Fenster neu,
// das ist hier bewusst so (kein Bestand für Zähler).

const fenster = new Map<string, number[]>();

export function modellErlaubt(person: string, max = 40, fensterMs = 10 * 60_000): { ok: true } | { ok: false; warteSek: number } {
  const jetzt = Date.now();
  const l = (fenster.get(person) ?? []).filter(t => t > jetzt - fensterMs);
  if (l.length >= max) { fenster.set(person, l); return { ok: false, warteSek: Math.max(1, Math.ceil((l[0] + fensterMs - jetzt) / 1000)) }; }
  l.push(jetzt); fenster.set(person, l);
  return { ok: true };
}

/** Antworttext für 429 — ein Satz, keine Technik. */
export const MODELL_ZU_VIEL = (warteSek: number) => `Zu viele Anfragen an das Modell — bitte in ${warteSek > 90 ? `${Math.ceil(warteSek / 60)} Minuten` : `${warteSek} Sekunden`} noch einmal.`;

/** Für Tests. */
export function modellDrosselZuruecksetzen() { fenster.clear(); }
