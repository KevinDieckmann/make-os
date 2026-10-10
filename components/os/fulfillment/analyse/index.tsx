'use client';

// ─── Fulfillment · Analyse — Oberfläche (STUB aus C0; gehört ab jetzt Paket C3) ────────────────────────────────────────────────────────
// FULFILLMENT_KONZEPT.md Abschnitt 10/11: Namen und Props sind fest — FulfillmentSeite (C0) nutzt sie. C3 ersetzt die Rümpfe (und darf Dateien unter
// components/os/fulfillment/analyse/** anlegen).

import { KommtMit } from '../KommtMit';

/** Analysen: alle Dossiers, Kosten, Fristen. */
export function Analysen() { return <KommtMit paket="C3" was="Analysen — Dossiers, Kosten, Fristen" />; }
/** Fall › Analyse (Dossier, Läufe, Freigaben F1/F2, Personenteil, Tiefenbericht). */
export function FallAnalyse(_p: { mandatId: string }) { return <KommtMit paket="C3" was="Analyse des Falls" />; }
