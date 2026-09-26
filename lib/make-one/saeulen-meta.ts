// ─── Die sechs Säulen: Titel, Anspruch, Hinweis ────────────────────────────
// Eigenes, „reines“ Modul (26.09.): die Seite app/os/saeule/[key] ist eine
// Server-Komponente — aus einer 'use client'-Datei bekäme sie unter Next 15 nur
// einen Client-Verweis statt des Objekts (jede Säule wäre dann „nicht gefunden“).

export const SAEULEN_META: Record<string, { titel: string; claim: string; hin: string }> = {
  health: { titel: 'Gesundheit & Energie', claim: 'Der Körper trägt alles andere.', hin: 'Recovery, Schlaf, Routinen, Journal' },
  business: { titel: 'Business-Performance', claim: 'Der Weg auf 1 Mio.', hin: 'Umsatz-Kurs und Pipeline' },
  planning: { titel: 'Planung & Execution', claim: 'Ob aus Vorhaben Erledigtes wird.', hin: 'Aufgabenlage und Fluss' },
  finance: { titel: 'Finanzen', claim: 'Wie lange du durchhältst.', hin: 'Runway, Gewinn, Marge' },
  social: { titel: 'Familie & Partnerschaft', claim: 'Wer mitträgt — und wer zu kurz kommt.', hin: 'Rituale, Delegation, Stimmung' },
  agents: { titel: 'Agenten', claim: 'Was Jarvis und die Agenten dir abnehmen.', hin: 'Läufe, Aufträge, Stapel, Bote' },
};
