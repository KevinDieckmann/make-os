'use client';

// ─── Fulfillment · Analyse — Oberfläche (C3, 10.10.; FULFILLMENT_KONZEPT.md Abschnitt 10/11) ──────────────────────────────────────────────────
// Namen und Props sind fest — FulfillmentSeite (C0) nutzt sie:
//   Analysen()                 Bereich „Analysen“: alle Dossiers, Kosten, Fristen (Analysen.tsx)
//   FallAnalyse({ mandatId })  Fall › Analyse: Dossier, Läufe, Freigaben F1/F2, Personenteil, Tiefenbericht (FallAnalyse.tsx)

export { Analysen } from './Analysen';
export { FallAnalyse } from './FallAnalyse';
