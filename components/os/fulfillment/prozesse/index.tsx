'use client';

// ─── Fulfillment · Prozesse — Oberfläche (STUB aus C0; gehört ab jetzt Paket C1) ───────────────────────────────────────────────────────
// FULFILLMENT_KONZEPT.md Abschnitt 10/11: Die Namen und Props sind fest — FulfillmentSeite (C0), ProdukteMandate/Produkte (Einhänger) und C2/C3 nutzen sie.
// C1 ersetzt die Rümpfe (und darf Dateien unter components/os/fulfillment/prozesse/** anlegen). Die zwei Einhänger in bestehenden Seiten
// (`OnboardingHinweis`, `ProduktFulfillmentZeile`) zeigen bis dahin NICHTS — Produkte & Mandate bleibt so, wie es heute ist.

import type { CrmApi } from '../../crm/daten';
import { KommtMit } from '../KommtMit';

/** Prozesse: Landkarte + Paket-Vorlagen + Drill-down (`k` = Knoten). */
export function Prozesse(_p: { k?: string }) { return <KommtMit paket="C1" was="Prozesse — Landkarte und Paket-Vorlagen" />; }
/** Bausteine: Bibliothek, Import (`b` = ein Baustein). */
export function Bausteine(_p: { b?: string }) { return <KommtMit paket="C1" was="Bausteine — Bibliothek und Import" />; }
/** Onboarding: Kandidaten und laufende Onboardings. */
export function Onboarding() { return <KommtMit paket="C1" was="Onboarding" />; }
/** Kreislauf: heutiger Sales-Kreislauf + gezeichnete Abläufe, Zuordnung der Etagen. */
export function Kreislauf() { return <KommtMit paket="C1" was="Kreislauf und Abläufe" />; }
/** Visualisierung: Landkarte groß, Cockpit, Kunden-Ansicht-Vorlage. */
export function Visualisierung() { return <KommtMit paket="C1" was="Visualisierung" />; }
/** Mandats-Cockpit („was hängt“ zuerst). */
export function Cockpit() { return <KommtMit paket="C1" was="Cockpit" />; }

/** Einhänger in Produkte & Mandate › Mandate: Karte „Kundenonboarding starten“ (Stub: nichts). */
export function OnboardingHinweis(_p: { api: CrmApi }) { return null; }
/** Einhänger im Produkt-Detail: „Fulfillment: <Vorlage> ›“ (Stub: nichts). */
export function ProduktFulfillmentZeile(_p: { leistungId: string }) { return null; }

/** Fall › Überblick. */
export function FallUeberblick(_p: { mandatId: string }) { return <KommtMit paket="C1" was="Überblick des Falls" />; }
/** Fall › Ablauf. */
export function FallAblauf(_p: { mandatId: string }) { return <KommtMit paket="C1" was="Ablauf des Falls" />; }
/** Fall › Wert-Konto. */
export function FallWert(_p: { mandatId: string }) { return <KommtMit paket="C1" was="Wert-Konto" />; }
/** Fall › Menschen & Entscheidungen. */
export function FallMenschen(_p: { mandatId: string }) { return <KommtMit paket="C1" was="Menschen & Entscheidungen" />; }
/** Fall › Takt (Rituale, Mitschriften). */
export function FallTakt(_p: { mandatId: string }) { return <KommtMit paket="C1" was="Takt" />; }
