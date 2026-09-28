// ─── ZOE — welche Werkzeuge Text Dritter zurückbringen (26.09.) ──────────
// Was aus diesen Quellen kommt, wird mit `fremd()` gekapselt; danach wirken
// schreibende Werkzeuge im Gespräch nur noch als Vorschlag. Ein Verwendungszweck
// auf dem Kontoauszug, eine Kontaktnotiz aus LinkedIn oder ein Kalendertitel
// darf ZOE nie etwas „befehlen“.

/** Werkzeug → Quellenname im <fremde_daten>-Rahmen. */
export const FREMD_WERKZEUGE: Record<string, string> = {
  lies_postfach: 'postfach',
  suche_kontakt: 'kontakte', finde_kontakt: 'kontakte', lies_kontakt: 'kontakte',
  crm_lage: 'crm',
  haushalt_buchungen: 'bank',
  suche_wissen: 'notizen', lies_notiz: 'notizen',
  frag_gedaechtnis: 'gedaechtnis',
  // 28.09. (C2): Projekt-/Aufgaben-Dateien und Notizen — kapseln selbst (SELBST_GEKAPSELT).
  projekt_unterlagen: 'projekt-unterlagen', datei_lesen: 'projekt-unterlagen',
};

/**
 * Werkzeuge, die ihre Antwort SELBST kapseln (eigene Kopfzeile + `fremd()`-Block, lib/zoe/aufgaben-unterlagen.ts):
 * das Gespräch gilt danach als „fremd gelesen“, die Antwort wird aber nicht ein zweites Mal eingepackt.
 * Ins ZOE-Protokoll geht von ihnen nur die Kopfzeile — nie Dateiinhalte oder Notizen.
 */
export const SELBST_GEKAPSELT: ReadonlySet<string> = new Set(['projekt_unterlagen', 'datei_lesen']);

/** Agent (run_agent) → Quellenname; Agenten mit reinen Zahlen fehlen bewusst. */
export const FREMD_AGENTEN: Record<string, string> = {
  research: 'web', content: 'web', prospect: 'web', prospecting: 'web',
  inbox: 'postfach', meeting: 'meeting',
  crm: 'crm', outreach: 'crm',
};
