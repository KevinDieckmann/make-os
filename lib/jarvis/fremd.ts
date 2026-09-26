// ─── Jarvis — welche Werkzeuge Text Dritter zurückbringen (26.09.) ──────────
// Was aus diesen Quellen kommt, wird mit `fremd()` gekapselt; danach wirken
// schreibende Werkzeuge im Gespräch nur noch als Vorschlag. Ein Verwendungszweck
// auf dem Kontoauszug, eine Kontaktnotiz aus LinkedIn oder ein Kalendertitel
// darf Jarvis nie etwas „befehlen“.

/** Werkzeug → Quellenname im <fremde_daten>-Rahmen. */
export const FREMD_WERKZEUGE: Record<string, string> = {
  lies_postfach: 'postfach',
  suche_kontakt: 'kontakte', finde_kontakt: 'kontakte', lies_kontakt: 'kontakte',
  crm_lage: 'crm',
  haushalt_buchungen: 'bank',
  suche_wissen: 'notizen', lies_notiz: 'notizen',
  frag_gedaechtnis: 'gedaechtnis',
};

/** Agent (run_agent) → Quellenname; Agenten mit reinen Zahlen fehlen bewusst. */
export const FREMD_AGENTEN: Record<string, string> = {
  research: 'web', content: 'web', prospecting: 'web',
  inbox: 'postfach', meeting: 'meeting',
  crm: 'crm', outreach: 'crm',
};
