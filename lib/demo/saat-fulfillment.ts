// ─── MAKE OS — Demo-Instanz: Fulfillment (Hub, Server, C0, 10.10.; FULFILLMENT_KONZEPT.md 12.7) ─────────────────────────────────────────
// Teil der Saat (lib/demo/saat.ts ruft `fulfillmentSaeen`). Jedes Paket sät seinen Teil in SEINER Datei — lib/demo/fulfillment-prozesse.ts (C1),
// fulfillment-kunde.ts (C2), fulfillment-analyse.ts (C3) —, über die ROUTEN in-process (`rufe`, wie die übrige Saat), erfunden und neutral
// (Wächter tests/demo.test.ts liest jede Datei). Der Kontext bringt alles mit, was die Pakete brauchen, damit KEIN Paket lib/demo/saat.ts ändern muss.
// Reihenfolge: Prozesse (Vorlagen, Bausteine, Fälle) → Kunde (Link-Schalter aus, Antworten, Puls) → Analyse (Dossier, Läufe ohne Modell).

export type DemoModul = Record<string, unknown>;
/** `rufe` aus lib/demo/saat.ts: eine Route in-process mit der Person im Kopf `x-make-user` (+ Bau-Kennung); wirft bei Fehler. */
export type DemoRufe = (modul: Promise<DemoModul>, methode: 'GET' | 'POST' | 'PUT' | 'PATCH', pfad: string, person: string, body?: unknown) => Promise<Record<string, unknown>>;
export interface SaatSchritt { name: string; anzahl: number }

/** Die Routen von Fulfillment (lazy importiert). */
export const FULFILLMENT_ROUTEN = {
  fulfillment: () => import('@/app/api/fulfillment/route') as Promise<DemoModul>,
  import: () => import('@/app/api/fulfillment/import/route') as Promise<DemoModul>,
  fall: () => import('@/app/api/fulfillment/fall/route') as Promise<DemoModul>,
  cockpit: () => import('@/app/api/fulfillment/cockpit/route') as Promise<DemoModul>,
  wirkung: () => import('@/app/api/fulfillment/wirkung/route') as Promise<DemoModul>,
  kunde: () => import('@/app/api/fulfillment/kunde/route') as Promise<DemoModul>,
  kundeVorschau: () => import('@/app/api/fulfillment/kunde/vorschau/route') as Promise<DemoModul>,
  dossier: () => import('@/app/api/fulfillment/dossier/route') as Promise<DemoModul>,
  analyse: () => import('@/app/api/fulfillment/analyse/route') as Promise<DemoModul>,
  personen: () => import('@/app/api/fulfillment/personen/route') as Promise<DemoModul>,
};

export interface FulfillmentSaatKontext {
  /** Speichernamen der Demo-Konten: Inhaberin, Mitglied, Partner („nur Business“). */
  inhaber: string; mitglied: string; partner: string;
  haushalt: string; heute: string; jetzt: Date;
  rufe: DemoRufe;
  routen: typeof FULFILLMENT_ROUTEN;
  /** Die Mandate der Demo (erfunden) — Kennung, Produkt, Firma, Kontakte. */
  mandate: readonly { id: string; leistungId?: string; firmaId?: string; kontaktIds: readonly string[] }[];
  /** Die Produkte der Demo (Kennungen). */
  leistungen: readonly string[];
  /** Kontakt-Kennung aus dem Schlüssel der Saat (deterministisch). */
  kontaktId: (schluessel: string) => string;
}

export async function fulfillmentSaeen(k: FulfillmentSaatKontext): Promise<SaatSchritt[]> {
  const { prozesseSaeen } = await import('./fulfillment-prozesse');
  const { kundeSaeen } = await import('./fulfillment-kunde');
  const { analyseSaeen } = await import('./fulfillment-analyse');
  return [...await prozesseSaeen(k), ...await kundeSaeen(k), ...await analyseSaeen(k)];
}
