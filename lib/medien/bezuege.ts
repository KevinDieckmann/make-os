// ─── Medien — Bezüge für Alben: Events und Mandate (09.10., Paket 5) ─────────────────────────────────────────────────────────
// Nur Kennung, Titel, Tag — nie Gäste, Notizen oder Beträge. Events: 365 Tage zurück bis 60 Tage voraus, abgesagte nicht (Netzwerken-Events
// und eigene Abende gleich — ein Album ist ein Album). Die Alben selbst tragen den Titel; der Bezug ist nur die Kennung.

import { localDay, tagePlus } from '@/lib/zeit';

export interface EventKurz { id: string; titel: string; datum: string }

export async function mediumEvents(heute = localDay()): Promise<EventKurz[]> {
  const { ladeCrm } = await import('@/lib/crm/speicher');
  const von = tagePlus(heute, -365), bis = tagePlus(heute, 60);
  return (await ladeCrm()).events
    .filter(e => e.status !== 'abgesagt' && e.datum >= von && e.datum <= bis && /^[a-z0-9][a-z0-9-]{0,80}$/.test(e.id))
    .sort((a, b) => b.datum.localeCompare(a.datum))
    .map(e => ({ id: e.id, titel: e.titel, datum: e.datum }));
}
