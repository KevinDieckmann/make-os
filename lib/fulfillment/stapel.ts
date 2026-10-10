// ─── Fulfillment — Art im Freigabe-Stapel (Hub, Server, C0, 10.10.) ───────────────────────────────────────────────────────────────
// Vorschläge mit `bezug: { art: 'fulfillment', id }` (lib/zoe/stapel.ts `StapelArt`) laufen nie über ein Werkzeug, sondern über diese Art
// (lib/zoe/stapel-arten.ts `ARTEN.fulfillment`). Verteilt wird nach dem Präfix der Kennung:
//   p:…  Prozesse (C1: Onboarding starten `p:onboarding:<mandat>`, Nachsorge `p:nachsorge:<mandat>:<tag>`)
//   k:…  Kunde (C2: Puls schlecht → Gespräch anbieten)
//   a:…  Analyse (C3: Art.-14-Uhr, Hinweise — nie ein Lauf ohne Klick auf genau diesen Lauf)
// Unbekanntes Präfix → 409 (nichts ausgeführt). Die Pakete legen ihre Vorschläge mit `gruppe: STAPEL_GRUPPE` (lib/fulfillment/grenzen.ts) ab —
// damit gehören sie immer zum Business (lib/zoe/bereich.ts `BUSINESS_GRUPPEN`). Diese Datei gehört C0.

import type { StapelArtFreigabe } from '@/lib/zoe/stapel-arten';

const UNBEKANNT = { ok: false as const, status: 409 as const, fehler: 'Diese Art von Fulfillment-Vorschlag kennt der Stapel nicht.' };

async function paketFuer(id: string | undefined): Promise<StapelArtFreigabe | null> {
  if (id?.startsWith('p:')) return (await import('./prozesse/server')).PROZESSE_STAPEL;
  if (id?.startsWith('k:')) return (await import('./kunde/server')).KUNDE_STAPEL;
  if (id?.startsWith('a:')) return (await import('./analyse/server')).ANALYSE_STAPEL;
  return null;
}

export const FULFILLMENT_STAPEL_ART: StapelArtFreigabe = {
  freigeben: async (v, person, opt) => {
    const p = await paketFuer(v.bezug?.id);
    return p ? p.freigeben(v, person, opt) : UNBEKANNT;
  },
  nachAblehnen: async (v, person) => {
    const p = await paketFuer(v.bezug?.id);
    return p?.nachAblehnen ? p.nachAblehnen(v, person) : undefined;
  },
};
