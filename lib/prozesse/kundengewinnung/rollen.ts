// ─── Prozesse · Kundengewinnung — Rollen statt Personen (22.10.; research/prozesse/VORLAGEN_KUNDENGEWINNUNG.md › 3, Regel R8) ───────────────────────────
// Vorlagen nennen nie eine Person: die Eigner-ROLLE (Verantwortlich Sales, Marketing, Event, Kundenerfolg) wird beim Übernehmen aus dem Team gewählt, und
// Masken mit Personen tragen `rolle:eigner` bzw. `rolle:zustaendig` (lib/prozesse/baustein-katalog.ts `ROLLEN_WERTE`). EINE Stelle, die sie auflöst — der Motor
// (Etappe C) ruft sie je Schritt mit dem Eigner des Prozesses und der zuständigen Person des Falls (lib/crm/team.ts `zustaendig`). Nie Rückfall auf den Inhaber.
// Rein und client-sicher.

import { ROLLE_EIGNER, ROLLE_ZUSTAENDIG } from '../baustein-katalog';

/** Die Eigner-Rollen der Vorlagen — die Welt, deren Verantwortliche den Prozess trägt (lib/crm/team.ts `verantwortlich(welt)`). */
export type EignerRolle = 'sales' | 'marketing' | 'event' | 'kundenerfolg';
export const EIGNER_ROLLE_NAME: Readonly<Record<EignerRolle, string>> = {
  sales: 'Verantwortlich Sales', marketing: 'Verantwortlich Marketing', event: 'Verantwortlich Event', kundenerfolg: 'Verantwortlich Kundenerfolg',
};

export const istRolle = (v: unknown): v is string => v === ROLLE_EIGNER || v === ROLLE_ZUSTAENDIG;

/**
 * Wer ist gemeint? (rein) — eine Team-Kennung bleibt, `rolle:eigner` wird der Eigner, `rolle:zustaendig` die zuständige Person des Falls, ohne sie der
 * Eigner. Ohne Eigner: null (der Schritt wartet bzw. endet über seine Fehlerkante — nie ein Rückfall auf den Inhaber).
 */
export function personAusRolle(wert: unknown, k: { eigner?: string | null; zustaendig?: string | null }): string | null {
  if (wert === ROLLE_EIGNER) return k.eigner ?? null;
  if (wert === ROLLE_ZUSTAENDIG) return k.zustaendig ?? k.eigner ?? null;
  return typeof wert === 'string' && wert ? wert : null;
}
