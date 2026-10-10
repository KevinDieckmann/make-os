'use client';

// ─── Fulfillment · Kunde — Oberfläche (STUB aus C0; gehört ab jetzt Paket C2) ──────────────────────────────────────────────────────────
// FULFILLMENT_KONZEPT.md Abschnitt 10/11: Namen und Props sind fest — FulfillmentSeite (C0) und C1 (Visualisierung) nutzen sie. C2 ersetzt die Rümpfe
// (und darf Dateien unter components/os/fulfillment/kunde/** anlegen, u. a. `KundenAnsicht` für die öffentliche Seite UND die Vorschau).

import { KommtMit } from '../KommtMit';

/** Fall › Kunde & Reports (Link, Formulare, Unterlagen, Puls, Report-Zusatz). */
export function FallKunde(_p: { mandatId: string }) { return <KommtMit paket="C2" was="Kunde & Reports" />; }
/** „So sieht der Kunde es“ — ohne Mandat die Vorlage der Kunden-Ansicht (Visualisierung). */
export function KundenAnsichtVorschau(_p: { mandatId?: string }) { return <KommtMit paket="C2" was="Kunden-Ansicht" />; }
