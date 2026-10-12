'use client';

// ─── Fulfillment · Prozesse — Oberfläche (Paket C1, 10.10.; vorher Stub aus C0) ────────────────────────────────────────────────────────
// FULFILLMENT_KONZEPT.md Abschnitt 10/11: Namen und Props sind fest — FulfillmentSeite (C0), ProdukteMandate/Produkte (Einhänger) und C2/C3 nutzen
// sie. Die Einhänger (`OnboardingHinweis`, `ProduktFulfillmentZeile`) zeigen ohne Fulfillment-Zugang nichts — Produkte & Mandate bleibt dann wie heute.

export { Prozesse } from './Prozesse';
export { Bausteine } from './Bausteine';
export { Onboarding, OnboardingHinweis } from './Onboarding';
export { Kreislauf } from './Kreislauf';
export { Visualisierung, Cockpit } from './Visualisierung';
export { ProduktFulfillmentZeile } from './ProduktZeile';
export { FallUeberblick } from './FallUeberblick';
export { FallAblauf } from './FallAblauf';
export { FallWert } from './FallWert';
export { FallMenschen } from './FallMenschen';
export { FallTakt } from './FallTakt';
export { FallKreislauf } from './FallKreislauf';
