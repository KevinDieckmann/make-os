// ─── Erklärungen · Fulfillment — Kunden-Link, Formulare, Upload, Puls (angelegt in C0, gehört Paket C2) ─────────────────────────────────
// FULFILLMENT_KONZEPT.md Abschnitt 10: `fulfillment.kundenLink` (an/aus, Datenweg), `fulfillment.kundenLinkFormular`, `fulfillment.kundenLinkUpload`,
// `fulfillment.kundenLinkPuls`, `fulfillment.pulsSchwelle`, `fulfillment.pulsInHealth` — mit erfundenem, neutralem Fallbeispiel (Wächter
// tests/erklaerungen.test.ts). Eingehängt in lib/erklaerungen/index.ts (EINSTELLUNGEN).

import type { EinstellungsText } from './typen';

export const EINSTELLUNGEN_FULFILLMENT_KUNDE = {
} as const satisfies Record<string, EinstellungsText>;
