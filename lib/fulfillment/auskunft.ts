// ─── Fulfillment — Auskunft Art. 15 (Hub, Server, C0, 10.10.; FULFILLMENT_KONZEPT.md 8.1) ───────────────────────────────────────────
// `personAufzaehlen` (lib/crm/person-bestaende.ts) ruft `fulfillmentAuskunft(m)`: Stakeholder-Einträge (C1), Antworten/Puls/Unterlagen-
// Metadaten (C2) und berufliche Personenkarten (C3), die die Person betreffen — als Kopie (Art. 15 Abs. 3). Jedes Paket in eigener Hülle:
// fällt eins aus, fehlt nur sein Teil (die Auskunft scheitert nie daran). Lese-Protokoll schreibt die aufrufende Route.
// Art. 17 läuft NICHT hier, sondern über `WEITERE_SPEICHER` (lib/crm/person-weitere.ts) — vier Einträge `fulfillment-*--*`.

import type { PersonMerkmale } from '@/lib/crm/person-weitere';
import type { FulfillmentAuskunft } from './typen';

export async function fulfillmentAuskunft(m: PersonMerkmale): Promise<FulfillmentAuskunft> {
  const sicher = async <T>(f: () => Promise<T[]>): Promise<T[]> => { try { return await f(); } catch (e) { console.error('[auskunft] fulfillment:', e instanceof Error ? e.message : e); return []; } };
  const [stakeholder, kunde, personen] = await Promise.all([
    sicher(async () => (await import('./prozesse/server')).stakeholderAuskunft(m)),
    sicher(async () => (await import('./kunde/server')).kundeAuskunft(m)),
    sicher(async () => (await import('./analyse/server')).personenAuskunft(m)),
  ]);
  return { stakeholder, kunde, personen };
}
