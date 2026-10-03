// ─── Gmail in der Inbox — Typen (03.10.2026) ─────────────────────────────────
// Kevin 03.10.: „Google ist nur die Verlängerung. Am Ende soll alles bei uns online laufen.“ — Gmail (Google Workspace,
// Domain makeinnovation.de) liefert die Post; gelesen, zugeordnet, beantwortet und zu Aufgaben gemacht wird in MAKE OS.
// Je Person ein eigener Spiegel (`gmail-stand--<person>` = Köpfe + Zustand, `gmail-text--<person>` = Textkörper) — Wahrheit
// ist Gmail (Löschen/Art. 17 im Spiegel, das Original bleibt bei Google; Speicher-Register).

/** Eine Adresse: Anzeigename (optional) + E-Mail (klein, NFC). */
export interface Adr { name?: string; email: string }

/** Ein Anhang — NUR Metadaten (der Inhalt wird auf Klick über die geschützte Route aus Gmail geholt). */
export interface Anhang {
  /** Teil-Kennung im Nachrichtenbaum („1.2“) — die `attachmentId` von Google ändert sich, die Teil-Kennung nicht. */
  teil: string;
  name: string;
  typ: string;
  groesse: number;
  /** Eingebettetes Bild (Content-ID) — wird nie angezeigt oder automatisch geladen. */
  eingebettet?: boolean;
}

/** Der Kopf einer Nachricht im Spiegel — ohne Textkörper. */
export interface GmailKopf {
  id: string;
  threadId: string;
  /** Eingang bzw. Versand (ISO) — aus `internalDate`. */
  am: string;
  von: Adr;
  an: Adr[];
  cc: Adr[];
  /** `Reply-To`, falls abweichend. */
  antwortAn?: Adr;
  betreff: string;
  ausschnitt: string;
  /** RFC-5322-`Message-ID` (mit spitzen Klammern) — für `In-Reply-To`/`References` der Antwort. */
  messageId?: string;
  inReplyTo?: string;
  references?: string[];
  /** Gmail-Labels (`INBOX`, `UNREAD`, `SENT`, `CATEGORY_PROMOTIONS` …). */
  labels: string[];
  anhaenge: Anhang[];
  /** Newsletter/Rundmail (List-Unsubscribe, Precedence: bulk). */
  liste?: boolean;
  /** Wie viele Bilder im HTML standen — nie geladen (Tracking-Pixel). */
  bilder?: number;
  /** Der Text wurde gekürzt (Größengrenze). */
  gekuerzt?: boolean;
  /** Größe in Byte (Schätzung von Google). */
  groesse?: number;
}

export interface GmailAlias { email: string; name?: string; standard?: boolean; verifiziert: boolean }

/** Bestand je Person `gmail-stand--<person>`. */
export interface GmailStand {
  v: 1;
  person: string;
  /** Adresse des Google-Kontos (Postfach). */
  email: string;
  /** Wahrheit: der Zähler von Google (`historyId`) — ab hier fragt der nächste inkrementelle Lauf. */
  historyId?: string;
  koepfe: Record<string, GmailKopf>;
  /** Beginn des Erstabgleichs (Tag) und Zeitpunkt des letzten vollen Laufs. */
  fensterAb?: string;
  letzterVoll?: string;
  /** Letzter GELUNGENER Abgleich. */
  at?: string;
  fehler?: string;
  fehlerAt?: string;
  fehlerAnmeldung?: boolean;
  fehlerFolge?: number;
  pauseBis?: string;
  getrenntGemeldet?: boolean;
  /** Push (users.watch): Ablauf in ms. */
  watch?: { ablauf: number; angelegt: string };
  /** „Senden als“-Adressen (Cache, `sendAs.list`). */
  aliase?: GmailAlias[];
  aliaseAt?: string;
  /** Letzter Lauf: neue Nachrichten, geänderte Labels, entfernte. */
  zuletzt?: { neu: number; geaendert: number; entfernt: number; voll: boolean };
}

/** Bestand je Person `gmail-text--<person>`: Textkörper (nur Text, nie HTML). */
export interface GmailTexte {
  v: 1;
  /** `adressen` trägt die Adressen der Nachricht — damit Art. 15/17 den Text auch ohne den Kopf der Person zuordnen kann. */
  texte: Record<string, { adressen: string; t: string }>;
}

/** Wie eine Mail zu einer Person/Firma/einem Deal gehört (Anzeige in der Inbox). */
export interface Zuordnung {
  kontaktId: string;
  name: string;
  firma?: string;
  firmaId?: string;
  dealId?: string;
  dealTitel?: string;
  /** Werbesperre bzw. Einschränkung (Art. 18): Anzeige ja, keine Weiterverarbeitung (kein ZOE, kein Verlauf). */
  sperre?: 'werbesperre' | 'eingeschraenkt';
  /** Mail-Ampel nach § 7 UWG (grün/gelb/rot) — für den Hinweis beim Antworten. */
  mailAmpel?: 'gruen' | 'gelb' | 'rot';
  /** Anrede der Person (Du/Sie) — für den Entwurf. */
  anrede?: 'Du' | 'Sie';
}

/** Grenzen — nie still überschritten. */
export const GMAIL_GRENZEN = {
  /** Erstabgleich: so viele Tage zurück. */
  erstTage: 30,
  /** Textkörper je Nachricht (Zeichen). */
  textMax: 40_000,
  /** Nachrichten im Spiegel je Person. */
  koepfeMax: 1500,
  /** Ausschnitt (Zeichen). */
  ausschnittMax: 300,
  betreffMax: 300,
  /** Empfänger je Nachricht, die der Spiegel behält. */
  adressenMax: 50,
  /** Anhänge je Nachricht (Metadaten). */
  anhaengeMax: 30,
  /** Größe eines Anhangs, den die Route ausliefert (Byte). */
  anhangMax: 25 * 1024 * 1024,
  /** Nachrichten, die ein Lauf höchstens nachlädt (der Rest folgt im nächsten). */
  proLauf: 600,
} as const;

/** Bestandsnamen je Person (kein Sonderfall für „kevin“). */
export const gmailStandName = (person: string) => `gmail-stand--${person}`;
export const gmailTextName = (person: string) => `gmail-text--${person}`;

export const PERSON_OK = /^[a-z0-9-]{1,40}$/;
