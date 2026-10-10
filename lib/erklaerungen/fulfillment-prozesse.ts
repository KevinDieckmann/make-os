// ─── Erklärungen · Fulfillment — Prozesse, Fall, Onboarding, Wert, Wirkung (angelegt in C0, gehört Paket C1) ────────────────────────────
// FULFILLMENT_KONZEPT.md Abschnitt 10: `fulfillment.vorlageAusMuster`, `fulfillment.importRechtPruefen`, `fulfillment.fortschritt`, `fulfillment.wartetAufEuch`,
// `fulfillment.wertKonto`, `fulfillment.befaehigung`, `fulfillment.willkommen24h`, `fulfillment.freigabe` und die Kennzahlen aus 1.4 — mit erfundenem,
// neutralem Fallbeispiel (Wächter tests/erklaerungen.test.ts). Eingehängt in lib/erklaerungen/index.ts (EINSTELLUNGEN).

import type { EinstellungsText } from './typen';

export const EINSTELLUNGEN_FULFILLMENT_PROZESSE = {
} as const satisfies Record<string, EinstellungsText>;
