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
  // 28.09. (C4): Titel der eigenen ZOE-Aufgaben.
  meine_aufgaben: 'aufgaben',
  // 29.09. (B3): eine Suche über Brain und App — kapselt selbst (SELBST_GEKAPSELT).
  suche_arbeit: 'arbeitsbestaende',
  // 28.09. (C7): die ganze Markttraktion — alle kapseln selbst (Kopfzeile + fremd(), SELBST_GEKAPSELT).
  crm_suche: 'markttraktion', kontakt_akte: 'markttraktion', firma_akte: 'markttraktion', pipeline: 'markttraktion', mandate_lage: 'markttraktion',
  angebote_lage: 'markttraktion', kampagnen_lage: 'markttraktion', events_lage: 'markttraktion', marketing_lage: 'markttraktion', kennzahlen: 'markttraktion',
  sales_lage: 'markttraktion', qualifizierung_lage: 'markttraktion', stammdaten_lage: 'markttraktion', datenqualitaet: 'markttraktion', crm_datei_lesen: 'crm-ablage', heads_lage: 'markttraktion',
};

/**
 * Werkzeuge, die ihre Antwort SELBST kapseln (eigene Kopfzeile + `fremd()`-Block, lib/zoe/aufgaben-unterlagen.ts):
 * das Gespräch gilt danach als „fremd gelesen“, die Antwort wird aber nicht ein zweites Mal eingepackt.
 * Ins ZOE-Protokoll geht von ihnen nur die Kopfzeile — nie Dateiinhalte oder Notizen.
 */
export const SELBST_GEKAPSELT: ReadonlySet<string> = new Set(['projekt_unterlagen', 'datei_lesen', 'suche_arbeit',
  // Markttraktion (28.09., C7, lib/zoe/crm-werkzeuge.ts) — auch die umgeleiteten suche_kontakt und crm_lage.
  'suche_kontakt', 'crm_lage', 'crm_suche', 'kontakt_akte', 'firma_akte', 'pipeline', 'mandate_lage', 'angebote_lage', 'kampagnen_lage', 'events_lage',
  'marketing_lage', 'kennzahlen', 'sales_lage', 'qualifizierung_lage', 'stammdaten_lage', 'datenqualitaet', 'crm_datei_lesen', 'heads_lage']);

/** Agent (run_agent) → Quellenname; Agenten mit reinen Zahlen fehlen bewusst. */
export const FREMD_AGENTEN: Record<string, string> = {
  research: 'web', content: 'web', prospect: 'web', prospecting: 'web',
  inbox: 'postfach', meeting: 'meeting',
  crm: 'crm', outreach: 'crm',
};
