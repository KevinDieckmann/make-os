'use client';

// ─── Fulfillment · Kunde — Oberfläche (C2, 10.10.; FULFILLMENT_KONZEPT.md Abschnitt 10/11) ──────────────────────────────────────────────────────
// Namen und Props sind fest (C0-Stub) — FulfillmentSeite (C0) und C1 (Visualisierung) nutzen sie:
//   `FallKunde({ mandatId })`              Fall › Kunde & Reports (Link, Formulare, Unterlagen, Puls, Vorschau)
//   `KundenAnsichtVorschau({ mandatId? })` „So sieht der Kunde es“ — ohne Mandat die Vorlage der Kunden-Ansicht
// Die öffentliche Seite (`/kunde/kl-…`) nutzt `KundenSeite` → `KundenAnsicht` — dieselbe Komponente wie die Vorschau.

export { FallKunde } from './FallKunde';
export { KundenAnsichtVorschau } from './KundenAnsichtVorschau';
