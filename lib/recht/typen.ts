// ─── Head of Recht: Grundbegriffe, Hinweistexte, Bestand (rein, client-sicher, 10.10.) ─────────────────────────────────────────────────
// Entscheidungen 10.10. (Kevin): ein eigener Business-Head „Head of Recht“ (Katalog-Kennung `recht`, lib/agenten/katalog.ts) — Chat auf der Seite
// Unternehmen und unter System › Datenschutz (Business-Sicht); von sich aus: wöchentlicher Recht-Check, Quartals-Risikorunde vorbereiten, neuer
// Vertrag → Checkliste, Anwalts-Mappe auf Knopfdruck. Grundlage: research/unternehmen/FAKTEN_UNTERNEHMEN_RECHT.md › 6 (Aufgaben, Grenzen, Hinweistexte).
//
// GRENZEN (fest, research › 6a): für die EIGENEN Gesellschaften ist der Head ein Werkzeug der Geschäftsleitung (§ 2 Abs. 1, Abs. 3 Nr. 6 RDG) — er
// gibt KEINE rechtliche Bewertung, nur Checklisten, Fundstellen, Vorlagen und Fristen; nichts wird eingereicht, versandt oder unterschrieben; jede
// Wirkung geht als Vorschlag in den Freigabe-Stapel; Text Dritter (Verträge) nur gekapselt; jede Aussage mit Regel-Stand. Hinweis überall:
// „keine Rechtsberatung — anwaltlich prüfen“. Keine Namen, keine Firmen, keine Beträge im Code — alles kommt aus den Beständen der Instanz.

import type { GesellschaftId } from '@/lib/einheiten';

/** Kennung des Heads im Katalog (lib/agenten/katalog.ts) — eine Stelle für Takt, Werkzeuge und Stapel. */
export const RECHT_HEAD = 'recht' as const;

/** Bestand je Haushalt (Speicher-Register `recht-check--*`, Bereich Business). */
export const rechtName = (haushalt: string) => `recht-check--${haushalt}`;

// ── Hinweistexte (research › 6b, neutral, ohne Namen) ───────────────────────────────────────────────────────────────────────

/** Unter allem, was der Head sagt. */
export const RECHT_HINWEIS = 'Hinweis, keine Rechtsberatung — anwaltlich prüfen.';
/** Banner im Bereich. */
export const RECHT_BANNER = 'Der Head of Recht ist ein Werkzeug zur Organisation eurer Pflichten. Er ersetzt keine Rechts- oder Steuerberatung. Prüft Entscheidungen mit rechtlicher Tragweite mit eurer Kanzlei bzw. eurem Steuerbüro.';
/** Unter jedem Vorschlag. */
export const vorschlagFuss = (stand: string) => `Vorschlag des Head of Recht · Stand der Regeln: ${stand}. Keine Rechtsberatung — anwaltlich prüfen.`;
/** Vertragsprüfung. */
export const CHECKLISTE_HINWEIS = 'Diese Checkliste zeigt Stellen, die üblicherweise geprüft werden. Sie ist keine rechtliche Bewertung dieses Vertrags — anwaltlich prüfen.';
/** Eskalation (research › 6a Nr. 4). */
export const eskalationText = (grund: string) => `Hier lohnt eine anwaltliche Einschätzung, bevor ihr handelt: ${grund}. Möchtest du die Unterlagen als Anwalts-Mappe zusammenstellen?`;
/** Anwalts-Mappe. */
export const MAPPE_HINWEIS = 'Zusammenstellung aus MAKE OS für das Gespräch mit eurer Kanzlei — keine rechtliche Bewertung. Verlässt das System erst, wenn ihr sie herunterladet und weitergebt.';

// ── Eingebaute Abläufe (sichtbar als „eingebaute Skills“, lib/agenten/skills.ts) ──────────────────────────────────────────────

/** Die festen Abläufe des Head of Recht — Kennungen nie ändern (Skills, „Als Nächstes“, Erklärungen hängen daran). */
export const RECHT_MODI = ['recht_check', 'risikorunde', 'vertrag_checkliste', 'anwalts_mappe'] as const;
export type RechtModus = (typeof RECHT_MODI)[number];

// ── Wochen-Check ────────────────────────────────────────────────────────────────────────────────────────────────────────

export type Ampel = 'rot' | 'gelb' | 'gruen';
/** Wie weit der Check vorausschaut (Fristen der nächsten vier Wochen). */
export const CHECK_TAGE = 28;
/** So oft je Woche höchstens neue Vorschläge — mehr hilft niemandem. */
export const VORSCHLAEGE_JE_WOCHE = 8;
/** Ein abgelehnter bzw. noch offener Vorschlag kommt frühestens nach so vielen Tagen wieder. */
export const WIEDER_NACH_TAGEN = 28;

export interface CheckFrist {
  tag: string;
  /** Tage bis zum Stichtag (negativ = überfällig). */
  inTagen: number;
  titel: string;
  /** Gesellschaft · Norm bzw. Herkunft. */
  unter: string;
  art: 'pflicht' | 'dokument' | 'schutz' | 'vertrag';
  href: string;
  eskalation?: true;
}
export type FehltArt = 'dokument' | 'meldung' | 'profil' | 'schwelle' | 'risiko' | 'schutz' | 'datenschutz';
export interface CheckFehlt { gesellschaftId?: GesellschaftId; gesellschaft?: string; art: FehltArt; text: string; weg: string; schwere: 'rot' | 'gelb' }
export interface CheckGesellschaft {
  id: GesellschaftId;
  name: string;
  ampel: Ampel;
  teile: { dokumente: Ampel; pflichten: Ampel; risiken: Ampel; schutz: Ampel };
  /** Zahl der offenen Punkte (was fehlt). */
  offen: number;
}
/** Datenschutz & Compliance — NUR Zähler und Status (System › Datenschutz), nie Inhalte oder Betroffene. */
export interface DatenschutzZahlen {
  erfuellt: number;
  gesamt: number;
  /** Titel der offenen Punkte der Selbstprüfung (Norm-Titel, keine Personen). */
  offen: string[];
  empfaenger: number;
  avvOffen: number;
  drittlandOhneGarantie: number;
  verzeichnis: number;
  /** Pannen-Register (Art. 33): nur Zahlen — und nur, wenn die Sicht sie sehen darf (sonst null). */
  pannen: { offen: number; dringend: number } | null;
}

/** Ein Vorschlag, den der Check in den Stapel legen möchte (der Server prüft „schon da?“ und Marken). */
export interface CheckVorschlag {
  /** Stabiler Schlüssel (idempotent je Gegenstand). */
  schluessel: string;
  art: 'aufgabe' | 'mappe';
  gesellschaftId?: GesellschaftId;
  titel: string;
  text: string;
  weg: string;
  frist?: string;
}

export interface WochenCheck {
  /** ISO-Woche `JJJJ-Www`. */
  kw: string;
  heute: string;
  /** Stand der Regeln (lib/gesellschaften/schild/typen.ts `REGEL_STAND`). */
  stand: string;
  ampel: Ampel;
  gesellschaften: CheckGesellschaft[];
  fristen: CheckFrist[];
  fehlt: CheckFehlt[];
  /** Sätze nach research › 6b „Eskalation“ — Anzeichen, bei denen eine anwaltliche Einschätzung lohnt. */
  eskalation: string[];
  datenschutz: DatenschutzZahlen | null;
  vorschlaege: CheckVorschlag[];
  /** Der Bericht als Text (Glocke, Head, Oberfläche) — ohne Namen von Personen, mit Hinweis. */
  text: string;
}

// ── Quartals-Risikorunde ───────────────────────────────────────────────────────────────────────────────────────────────

export interface RundeRisiko {
  risikoId: string;
  titel: string;
  ampel: 'rot' | 'gelb' | 'gruen' | 'offen';
  /** Letzte maßgebliche Bewertung (Eintritt × Wirkung) — die Bewertung macht ein Mensch im Schild. */
  letzte?: { am: string; eintritt: number; wirkung: number; art: 'brutto' | 'netto' };
  /** Was sich seit der letzten Bewertung verändert hat (Anlässe). */
  anlaesse: string[];
  /** Prüffrage bzw. Vorschlag für die Runde — nie eine Bewertung. */
  vorschlag: string;
}
export interface RundeNeu { katalogId: string; titel: string; grund: string }
export interface RundeVorbereitung {
  gesellschaftId: GesellschaftId;
  name: string;
  /** `JJJJ-Qn` — eine Vorbereitung je Gesellschaft und Quartal. */
  quartal: string;
  /** Tag der letzten Bewertung (leer = noch nie bewertet). */
  seit: string;
  veraenderungen: { am: string; text: string }[];
  neueRisiken: RundeNeu[];
  jeRisiko: RundeRisiko[];
  text: string;
}

// ── Vertrags-Checkliste ────────────────────────────────────────────────────────────────────────────────────────────────

export type ChecklistePunktId = 'laufzeit' | 'kuendigung' | 'haftung' | 'datenschutz' | 'gerichtsstand' | 'ip';
export interface Fundstelle {
  /** Wörtliches Zitat (gekürzt, mit „…“). */
  zitat: string;
  /** „§ 5“, „Nr. 3“ bzw. „Seite 2“ — wenn erkennbar. */
  stelle?: string;
}
export interface ChecklistePunkt { id: ChecklistePunktId; titel: string; frage: string; fundstellen: Fundstelle[] }
export interface ErkannteFrist { datum: string; art: 'kuendigung' | 'ende' | 'beginn' | 'sonstig'; zitat: string }
export interface Checkliste {
  punkte: ChecklistePunkt[];
  fristen: ErkannteFrist[];
  /** Kündigungsfrist als Text (z. B. „3 Monate zum Jahresende“), wenn erkennbar. */
  kuendigungsfrist?: string;
  /** Hinweis (Scan ohne Text, nur Teil gelesen). */
  hinweis?: string;
  zeichen: number;
}

// ── Anwalts-Mappe ──────────────────────────────────────────────────────────────────────────────────────────────────────

export type MappeThema =
  | { art: 'gesellschaft'; gesellschaftId: GesellschaftId }
  | { art: 'vertrag'; gesellschaftId: GesellschaftId; vertragId: string }
  | { art: 'risiko'; gesellschaftId: GesellschaftId; risikoId: string };
export interface MappeAbschnitt { titel: string; zeilen: string[] }
export interface MappeDokument {
  titel: string;
  untertitel: string;
  stand: string;
  hinweis: string;
  abschnitte: MappeAbschnitt[];
  /** Unterlagen aus der verschlüsselten Ablage, die als Anlage angehängt werden (nur Kennungen + Anzeige). */
  anlagen: { dateiId: string; titel: string; datum?: string }[];
}
/** Grenzen der Mappe (nie still kürzen — darüber steht im PDF, was fehlt). */
export const MAPPE_GRENZEN = { fragen: 20, frageZeichen: 500, anlagen: 20, bytes: 25 * 1024 * 1024 } as const;

// ── Bestand ────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface RechtStand {
  v: 1;
  /** Der letzte Wochen-Check (Riegel = `kw`). */
  woche?: { kw: string; am: string; check: WochenCheck };
  /** Vorbereitete Risikorunden je Gesellschaft (Riegel = Quartal). */
  runden?: Partial<Record<string, { quartal: string; am: string; vorbereitung: RundeVorbereitung }>>;
  /** Vorschlag-Schlüssel → Tag, an dem er zuletzt in den Stapel ging (Marken gegen Wiederholung). */
  marken?: Record<string, string>;
  /** Checklisten je Datei der Ablage (Riegel: eine Checkliste je hochgeladenem Vertrag). */
  vertraege?: Record<string, { am: string; gesellschaftId: string }>;
  /** Erstellte Anwalts-Mappen (nur Kennungen und Tag — der Inhalt liegt verschlüsselt in der Ablage). */
  mappen?: { dateiId: string; am: string; thema: MappeThema }[];
}
export const RECHT_GRENZEN = { marken: 500, vertraege: 500, mappen: 100 } as const;
