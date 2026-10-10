// ─── Die Werkzeug-Listen WÖRTLICH vor V3 (6086ee72, 10.10.) — Wächter-Fixture ─────────────────────────────────────────────────
// Seit V3 werden LESEND, FREMD_WERKZEUGE, SELBST_GEKAPSELT und WERKZEUG_KATEGORIE aus lib/werkzeuge/einordnung.ts ABGELEITET. Der Wächter
// (tests/werkzeug-vertraege.test.ts › „abgeleitete Listen“) prüft, dass die Ableitung bit-gleich zum alten Stand ist — so hat der Umzug
// nichts verschoben. Ändert sich eine Einordnung bewusst (neues Werkzeug, neue Quelle), wird diese Liste NICHT angepasst: der Test
// vergleicht nur den Altbestand (alte Namen müssen gleich eingeordnet bleiben), neue Werkzeuge kommen hinzu.

export const LESEND_VOR_V3 = ['trainingsplan_lesen', 'lies_postfach', 'suche_wissen', 'lies_notiz', 'frag_gedaechtnis', 'business_index', 'gesellschaften_lesen', 'crm_lage', 'haushalt_stand', 'haushalt_buchungen', 'gesundheits_index', 'finde_kontakt', 'lies_kontakt', 'suche_kontakt', 'projekt_unterlagen', 'datei_lesen', 'meine_aufgaben', 'suche_arbeit',
  'crm_suche', 'kontakt_akte', 'firma_akte', 'pipeline', 'mandate_lage', 'angebote_lage', 'kampagnen_lage', 'events_lage', 'besuche_lage', 'marketing_lage',
  'kennzahlen', 'sales_lage', 'qualifizierung_lage', 'stammdaten_lage', 'datenqualitaet', 'crm_datei_lesen', 'heads_lage', 'crm_vorschlag',
  'freie_zeit', 'head_fragen'];

export const FREMD_VOR_V3: Record<string, string> = {
  lies_postfach: 'postfach',
  suche_kontakt: 'kontakte', finde_kontakt: 'kontakte', lies_kontakt: 'kontakte',
  crm_lage: 'crm',
  haushalt_buchungen: 'bank',
  suche_wissen: 'notizen', lies_notiz: 'notizen',
  frag_gedaechtnis: 'gedaechtnis',
  projekt_unterlagen: 'projekt-unterlagen', datei_lesen: 'projekt-unterlagen',
  meine_aufgaben: 'aufgaben',
  suche_arbeit: 'arbeitsbestaende',
  crm_suche: 'markttraktion', kontakt_akte: 'markttraktion', firma_akte: 'markttraktion', pipeline: 'markttraktion', mandate_lage: 'markttraktion',
  angebote_lage: 'markttraktion', kampagnen_lage: 'markttraktion', events_lage: 'markttraktion', besuche_lage: 'markttraktion', marketing_lage: 'markttraktion', kennzahlen: 'markttraktion',
  sales_lage: 'markttraktion', qualifizierung_lage: 'markttraktion', stammdaten_lage: 'markttraktion', datenqualitaet: 'markttraktion', crm_datei_lesen: 'crm-ablage', heads_lage: 'markttraktion',
  plan_block: 'kalender',
  head_fragen: 'agent',
};

export const GEKAPSELT_VOR_V3 = ['projekt_unterlagen', 'datei_lesen', 'suche_arbeit',
  'suche_kontakt', 'crm_lage', 'crm_suche', 'kontakt_akte', 'firma_akte', 'pipeline', 'mandate_lage', 'angebote_lage', 'kampagnen_lage', 'events_lage', 'besuche_lage',
  'marketing_lage', 'kennzahlen', 'sales_lage', 'qualifizierung_lage', 'stammdaten_lage', 'datenqualitaet', 'crm_datei_lesen', 'heads_lage',
  'medien_suchen', 'gesundheit_unterlagen'];

export const KATEGORIE_VOR_V3: Record<string, string | null> = {
  einkauf_setzen: null, an_head: null, head_fragen: null,
  hake_routine: null,
  medien_suchen: null, medien_vorschlagen: null, bild_erzeugen: null, video_starten: null, bild_bearbeiten: 'medien',
};
