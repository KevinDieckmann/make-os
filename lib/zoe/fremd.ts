// ─── ZOE — welche Werkzeuge Text Dritter zurückbringen (26.09.) ──────────
// Was aus diesen Quellen kommt, wird mit `fremd()` gekapselt; danach wirken
// schreibende Werkzeuge im Gespräch nur noch als Vorschlag. Ein Verwendungszweck
// auf dem Kontoauszug, eine Kontaktnotiz aus LinkedIn oder ein Kalendertitel
// darf ZOE nie etwas „befehlen“.

import { FREMD_ABGELEITET, GEKAPSELT_ABGELEITET } from '@/lib/werkzeuge/einordnung';

/**
 * Werkzeug → Quellenname im <fremde_daten>-Rahmen. Seit V3 (10.10.) ABGELEITET aus der einen Einordnung je Werkzeug
 * (lib/werkzeuge/einordnung.ts, Feld `fremd`, inkl. früherer Namen für alte Verläufe) — dort steht je Werkzeug die Begründung.
 */
export const FREMD_WERKZEUGE: Record<string, string> = { ...FREMD_ABGELEITET };

/**
 * Der Kalender ist eine Fremdquelle (29.09., #K1): Termintitel, Orte und Notizen können aus Einladungen Dritter stammen.
 * Stehen Termine im ZOE-Prompt (lib/brain.ts `kalenderImPrompt`), gilt das Gespräch von Anfang an als „fremd gelesen“.
 */
export const KALENDER_QUELLE = 'kalender';

/**
 * Werkzeuge, die ihre Antwort SELBST kapseln (eigene Kopfzeile + `fremd()`-Block, lib/zoe/aufgaben-unterlagen.ts):
 * das Gespräch gilt danach als „fremd gelesen“, die Antwort wird aber nicht ein zweites Mal eingepackt.
 * Ins ZOE-Protokoll geht von ihnen nur die Kopfzeile — nie Dateiinhalte oder Notizen.
 * Seit V3 (10.10.) ABGELEITET aus lib/werkzeuge/einordnung.ts (Feld `gekapselt`).
 */
export const SELBST_GEKAPSELT: ReadonlySet<string> = GEKAPSELT_ABGELEITET;

/** Agent (run_agent) → Quellenname; Agenten mit reinen Zahlen fehlen bewusst. */
export const FREMD_AGENTEN: Record<string, string> = {
  research: 'web', content: 'web', prospect: 'web', prospecting: 'web',
  inbox: 'postfach', meeting: 'meeting',
  crm: 'crm', outreach: 'crm',
  // 29.09. (#K1): die Kalender-Analyse fasst Termintitel zusammen.
  kalender: 'kalender',
};
