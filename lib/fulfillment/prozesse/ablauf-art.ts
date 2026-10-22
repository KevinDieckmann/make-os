// ─── Fulfillment — woran ein Fall seinen Ablauf hat (22.10., Fulfillment in die Werkstatt E5, Entscheidung F3) ─────────────────────────────────────────────
// Ein Fall läuft entweder nach einem PAKET (wie bisher, Knoten im Fall) oder ist die Akte eines Mandats, dessen Produkt auf einen Prozess der WERKSTATT zeigt
// (`Fall.ablauf`, Ablauf im Motor). EINE Leseregel, rein und ohne Abhängigkeiten (auch für die Kunden-Sicht).

import type { Fall } from '../typen';

/**
 * Prozess der Werkstatt bzw. null (Paket). Das Feld `ablauf`, sonst die Kennung (`vorlageId` = `pz-…`) — so findet die Regel den Ablauf auch, wenn ein älterer
 * Stand das Feld beim Speichern verloren hat (Rückweg).
 */
export function fallAblauf(f: Pick<Fall, 'ablauf' | 'vorlageId'>): { art: 'prozess'; prozessId: string } | null {
  if (f.ablauf?.art === 'prozess') return f.ablauf;
  return /^pz-[0-9a-f-]{36}$/.test(f.vorlageId) ? { art: 'prozess', prozessId: f.vorlageId } : null;
}
