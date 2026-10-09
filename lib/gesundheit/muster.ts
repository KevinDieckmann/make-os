// ─── Gesundheit: Erkennungsmuster für Termine und Blöcke (rein, Server UND Browser) ─────────────────────────────────────
// EINE Stelle für Index (lib/gesundheit/index.ts) und Energie-Ansicht (components/os/EnergieView.tsx) — vorher zwei Kopien.
// Seit 09.10. (PRIVATE_INHALTE_SUCHE.md Paket 2 › C) nur ALLGEMEINE Begriffe: keine Fachrichtung, Behandlungsart oder
// Körperstelle, die auf die Beschwerden einer bestimmten Person schließen lässt. Fachärztinnen und Fachärzte erkennt das
// allgemeine Muster „-loge/-login“ bzw. „Praxis“, „Dr.“, „Arzt“.

/** Ein Gesundheitstermin im Kalender (Titel): Arzt, Praxis, Therapie, Training … */
export const GES_TERMIN = /arzt|ärzt|dr\.|praxis|physio|reha|untersuchung|behandlung|vorsorge|klinik|krankenhaus|facharzt|olog(e|in|en)\b|therapie|massage|training|sport|gym|fitness|schwimm/i;

/** Ein Bewegungs-Block im Wochenplan (Titel). */
export const GES_BLOCK = /sport|train|gym|lauf|schwimm|spazier|bewegung|yoga|dehn|reha|physio/i;
