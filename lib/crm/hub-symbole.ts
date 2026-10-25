// ─── Markttraktion · die Symbole des Hubs (22.10.) ───────────────────────────────────────────────────────────────────────────────────────
// `HUB_MENUE` (./adresse.ts) nennt je Punkt sein lucide-Symbol nur als Namen (adresse.ts bleibt ohne React). Hier wird der Name EINMAL aufgelöst —
// rein und client-sicher, damit die Werkzeug-Konfiguration (lib/make-one/werkzeuge.ts `MARKTTRAKTION_WERKZEUG`) sie importieren darf. Neues Symbol
// = Name in `HubSymbol` + Zeile hier (der Wächter tests/markttraktion-hub.test.ts prüft, dass jedes Symbol ein Bild hat).

import type { LucideIcon } from 'lucide-react';
import { LayoutDashboard, Users, Building2, Funnel, SquareKanban, FileSignature, PhoneCall, Megaphone, CalendarDays, Handshake, Goal, ChartNoAxesCombined, Bot, Settings, ClipboardList } from 'lucide-react';
import type { HubSymbol } from './adresse';

/** Das Symbol je Punkt (Namen aus `HUB_MENUE`). */
export const HUB_SYMBOLE: Record<HubSymbol, LucideIcon> = {
  LayoutDashboard, Users, Building2, Funnel, SquareKanban, FileSignature, PhoneCall, Megaphone, CalendarDays, Handshake, Goal, ChartNoAxesCombined, Bot, Settings, ClipboardList,
};
