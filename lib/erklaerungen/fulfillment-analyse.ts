// ─── Erklärungen · Fulfillment — Analyse-Strecke (angelegt in C0, gehört Paket C3) ───────────────────────────────────────────────────────
// FULFILLMENT_KONZEPT.md Abschnitt 10: je Agent ein `AgentText` (tut · nie · Beispiel) in `FULFILLMENT_AGENT_TEXTE`, dazu `fulfillment.laufBestaetigen`
// (Kosten und Datenweg), `fulfillment.f1`, `fulfillment.f2`, `fulfillment.tiefenbericht` (Google, nur für dich), `fulfillment.personenteil`,
// `fulfillment.loeschfristPersonen` — mit erfundenem, neutralem Fallbeispiel (Wächter tests/erklaerungen.test.ts). Eingehängt in lib/erklaerungen/index.ts.

import type { AgentText, EinstellungsText } from './typen';
import type { AnalyseAgentId } from '@/lib/fulfillment/typen';

export const EINSTELLUNGEN_FULFILLMENT_ANALYSE = {
} as const satisfies Record<string, EinstellungsText>;

/** Je Analyse-Agent: was er tut · was er nie tut · ein erfundener Beispiel-Vorschlag (C3 füllt). */
export const FULFILLMENT_AGENT_TEXTE: Partial<Record<AnalyseAgentId, AgentText>> = {};
