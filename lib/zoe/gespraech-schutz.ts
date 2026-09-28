// ─── ZOE-Gespräch: wann ein Werkzeug nur als Vorschlag wirkt (rein, getestet) ──
// Prompt-Injection-Schutz (26.09., erweitert 28.09. K1 #98): Sobald in einem Gespräch Text Dritter
// im Spiel ist, wirken schreibende Werkzeuge nur noch als Vorschlag (Stapel, Freigabe durch Kevin
// oder Malin). Text Dritter ist auch der Kontext, den der Browser mitschickt (`payload.context` —
// z. B. die geöffnete Kontaktkarte mit Notizen, eine Mail in der Inbox): ist er nicht leer, gilt das
// Gespräch von Anfang an als „fremd gelesen“.
// Dauerhaftes Gedächtnis (`fakt_merken`) und Notizen im Vault (`notiz_anlegen`) gehen im Gespräch
// IMMER über den Stapel — ein eingeschleuster Satz darf sich nicht selbst ins Gedächtnis schreiben.

/** Werkzeuge, die nur lesen — sie laufen auch nach Fremdtext frei. */
export const LESEND = new Set(['lies_postfach', 'suche_wissen', 'lies_notiz', 'frag_gedaechtnis', 'business_index', 'crm_lage', 'haushalt_stand', 'haushalt_buchungen', 'gesundheits_index', 'finde_kontakt', 'lies_kontakt', 'suche_kontakt', 'projekt_unterlagen', 'datei_lesen', 'meine_aufgaben', 'suche_arbeit',
  // Markttraktion lesen (28.09., C7) — und crm_vorschlag: legt NUR in den Stapel (Art „crm“), übernommen wird erst per Klick.
  'crm_suche', 'kontakt_akte', 'firma_akte', 'pipeline', 'mandate_lage', 'angebote_lage', 'kampagnen_lage', 'events_lage', 'marketing_lage',
  'kennzahlen', 'sales_lage', 'qualifizierung_lage', 'stammdaten_lage', 'datenqualitaet', 'crm_datei_lesen', 'heads_lage', 'crm_vorschlag']);
/** Im Gespräch immer nur Vorschlag. */
export const IMMER_VORSCHLAG = new Set(['fakt_merken', 'notiz_anlegen']);

/** Bringt der Browser-Kontext Text mit? Dann ist das Gespräch ab dem ersten Zug „fremd gelesen“. */
export function kontextIstFremd(kontext: unknown): boolean {
  return typeof kontext === 'string' && kontext.trim().length > 0;
}

/** Soll dieser Werkzeug-Aufruf nur in den Stapel (statt ausgeführt zu werden)? */
export function nurVorschlag(name: string, input: Record<string, unknown> | undefined, fremdGelesen: boolean): boolean {
  // Eine Werbesperre ist dauerhaft — sie geht immer über den Stapel.
  if (name === 'notiere_kontakt' && String(input?.ergebnis ?? '') === 'sperre') return true;
  if (IMMER_VORSCHLAG.has(name)) return true;
  return fremdGelesen && !LESEND.has(name);
}
