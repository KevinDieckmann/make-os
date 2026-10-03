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
  'crm_suche', 'kontakt_akte', 'firma_akte', 'pipeline', 'mandate_lage', 'angebote_lage', 'kampagnen_lage', 'events_lage', 'besuche_lage', 'marketing_lage',
  'kennzahlen', 'sales_lage', 'qualifizierung_lage', 'stammdaten_lage', 'datenqualitaet', 'crm_datei_lesen', 'heads_lage', 'crm_vorschlag',
  // K6a (29.09.): freie Zeit — nur Zeiten, nichts wird angelegt.
  'freie_zeit']);
/**
 * Im Gespräch immer nur Vorschlag. `notiz_ergaenzen` seit S1 #12 (29.09.): es schreibt wie `notiz_anlegen` dauerhaft in
 * den Vault (Offene Fragen, Taskmanagement, Zoe-Log) — ein eingeschleuster Satz darf sich dort nicht selbst anhängen.
 */
export const IMMER_VORSCHLAG = new Set(['fakt_merken', 'notiz_anlegen', 'notiz_ergaenzen']);

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

// ── Agenten im Gespräch (29.09., Paket D-B #90/#91) ──────────────────────────
// `run_agent` lief bisher an `nurVorschlag` vorbei: nach Fremdtext konnte ein eingeschleuster Satz einen Agenten
// starten, der schreibt oder Text nach außen trägt. Ab jetzt gilt für Agenten dieselbe Regel wie für Werkzeuge —
// statt zu laufen, landet der Auftrag als Vorschlag im Stapel (über `starte_auftraege`, Freigabe per Klick).

/** Agenten, die nur lesen und rechnen (keine Wirkung, nichts nach außen) — sie laufen auch nach Fremdtext. */
// „kalender“ seit 29.09. (#K2): der Kalender-Agent schreibt nie mehr selbst — seine Vorschläge landen im Freigabe-Stapel.
export const AGENTEN_LESEND = new Set(['board', 'okr', 'controlling', 'fokus', 'crm', 'kalender']);
/** Agenten, die Text an eine Websuche oder ein fremdes Verzeichnis geben (Drittdienst). */
export const WEB_AGENTEN = new Set(['research', 'content', 'prospect', 'prospecting']);
/**
 * Leser, deren Ergebnis vertraulich ist (CRM, Kartei, Postfach, Bank, Notizen, Dateien, Gedächtnis): hat das Gespräch
 * einen davon benutzt, darf danach kein Web-Agent mehr ohne Freigabe laufen — sonst könnten CRM-Inhalte in einer
 * Suchanfrage bei einem Drittdienst landen (#91).
 */
export const VERTRAULICHE_QUELLEN = new Set(['postfach', 'kontakte', 'crm', 'bank', 'notizen', 'gedaechtnis', 'projekt-unterlagen', 'aufgaben', 'arbeitsbestaende', 'markttraktion', 'crm-ablage', 'meeting',
  // 29.09. (#K1/#K4): Termine (Arzt, Reha, Mandanten) sind vertraulich.
  'kalender']);

/** Soll dieser Agent nur als Vorschlag (Stapel) gestartet werden statt zu laufen? */
export function agentNurVorschlag(agent: string, fremdGelesen: boolean, vertraulich: boolean): boolean {
  if (WEB_AGENTEN.has(agent) && vertraulich) return true;
  return fremdGelesen && !AGENTEN_LESEND.has(agent);
}

/**
 * Hat ein früherer Zug DIESES Gesprächs einen vertraulichen Leser benutzt? Der Verlauf trägt je Antwort von ZOE die
 * gelaufenen Werkzeuge/Agenten (`ran`, lib/make-one/zoe-verlauf.ts). `quelleVon` bildet einen Namen auf seine Quelle ab.
 */
export function verlaufVertraulich(verlauf: unknown, quelleVon: (name: string) => string | null): boolean {
  if (!Array.isArray(verlauf)) return false;
  return verlauf.some(n => Array.isArray((n as { ran?: unknown })?.ran) && ((n as { ran: { agent?: unknown }[] }).ran).some(r => {
    const q = typeof r?.agent === 'string' ? quelleVon(r.agent) : null;
    return !!q && VERTRAULICHE_QUELLEN.has(q);
  }));
}

/**
 * Hat ein früherer Zug DIESES Gesprächs einen Leser mit Text Dritter benutzt (S1 #4, 29.09.)? Dann steht dieser Text im
 * Verlauf, den das Modell wieder bekommt — das Gespräch bleibt „fremd gelesen“, schreibende Werkzeuge nur als Vorschlag.
 * `quelleVon` bildet einen Werkzeug-/Agentennamen auf seine Fremd-Quelle ab (lib/zoe/fremd.ts); jede Quelle zählt, auch
 * ein gescheiterter Lauf (sein Fehlertext kann Fremdtext tragen).
 */
export function verlaufFremd(verlauf: unknown, quelleVon: (name: string) => string | null): boolean {
  if (!Array.isArray(verlauf)) return false;
  return verlauf.some(n => Array.isArray((n as { ran?: unknown })?.ran) && ((n as { ran: { agent?: unknown }[] }).ran).some(r => typeof r?.agent === 'string' && !!quelleVon(r.agent)));
}
