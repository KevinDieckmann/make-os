'use client';

// ─── Fulfillment · Prozesse — Oberfläche (Paket C1, 10.10.; vorher Stub aus C0; seit 17.10. vier Reiter je Fall) ────────────────────────────────────────
// FULFILLMENT_KONZEPT.md Abschnitt 10/11: Namen und Props sind fest — FulfillmentSeite (C0), ProdukteMandate/Produkte (Einhänger) und C2/C3 nutzen
// sie. Die Einhänger (`OnboardingHinweis`, `ProduktFulfillmentZeile`) zeigen ohne Fulfillment-Zugang nichts — Produkte & Mandate bleibt dann wie heute.
// Der Fall (17.10., Miro-Standard): Reise (components/os/fulfillment/reise/FallReise.tsx) · Ziele & Wirkung (`FallZiele`) · Menschen & Termine
// (`FallMenschen`) · Kunde (components/os/fulfillment/kunde). Die Bausteine der früheren Reiter (Ablauf, Überblick, Takt, Abschluss) hängen die Reiter ein.

export { Prozesse } from './Prozesse';
export { Bausteine } from './Bausteine';
export { Onboarding, OnboardingHinweis } from './Onboarding';
export { Kreislauf } from './Kreislauf';
export { Cockpit, Erfolgsmasse } from './Visualisierung';
export { ProduktFulfillmentZeile } from './ProduktZeile';
export { FallZiele } from './FallWert';
export { FallMenschen } from './FallMenschen';
