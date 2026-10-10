// ─── Fulfillment — Löschfristen (Hub, Server, C0, 10.10.; FULFILLMENT_KONZEPT.md 8.1) ───────────────────────────────────────────────
// Ein Schritt „Fulfillment“ im täglichen Löschfristen-Lauf (lib/crm/loeschfristen-lauf.ts) ruft die drei Pakete mit den WIRKSAMEN Fristen
// (`fulfillment-personen` Tage, `fulfillment-unterlagen` Tage, `fulfillment-mandatsdaten` Monate — Tabelle `LOESCHFRISTEN`, einstellbar).
// Gezählt wird nur (keine Namen, keine Kennungen); jedes Paket in eigener Fehlerhülle. Diese Datei gehört C0 — die Pakete füllen ihre Teile.

import type { FristenKontext } from './typen';

export async function fulfillmentFristen(k: FristenKontext): Promise<Record<string, number>> {
  const raus: Record<string, number> = {};
  const dazu = (r: Record<string, number>) => { for (const [n, z] of Object.entries(r)) if (z) raus[n] = (raus[n] ?? 0) + z; };
  const teile: [string, () => Promise<Record<string, number>>][] = [
    ['prozesse', async () => (await import('./prozesse/server')).prozesseFristen(k)],
    ['kunde', async () => (await import('./kunde/server')).kundeFristen(k)],
    ['personen', async () => (await import('./analyse/server')).personenFristen(k)],
  ];
  for (const [name, f] of teile) {
    try { dazu(await f()); } catch (e) { console.error(`[loeschfristen] fulfillment-${name}:`, e instanceof Error ? e.message : e); }
  }
  return raus;
}
