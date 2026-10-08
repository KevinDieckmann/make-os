// ─── Kontoauszug einlesen — Typen (09.10., rein: Server UND Browser) ───────────────────────────────────────────────────────────────────
// Was die Leser (CAMT.053 und CSV) liefern — EINE Form für beide, damit Zuordnung, Vorschau und Übernahme nicht wissen müssen, woher ein
// Umsatz kam. Beträge immer in ganzen CENT (Summen und Saldo-Prüfung stimmen so auf den Cent; € erst beim Schreiben über `centZuEuro`).

/** Gebucht zählt; vorgemerkt (CAMT `PDNG`, CSV „vorgemerkt/pending“) und abgelehnt/storniert werden nie übernommen — nur als Hinweis. */
export type EintragStatus = 'gebucht' | 'vorgemerkt' | 'abgelehnt';

export interface AuszugEintrag {
  /** Buchungstag (JJJJ-MM-TT, Berliner Tag). */
  datum: string;
  /** Valuta (Wertstellung), wenn die Bank sie nennt. */
  valuta?: string;
  /** Cent, mit Vorzeichen: + Eingang, − Ausgang. */
  cent: number;
  /** ISO-Währung des Umsatzes (Vorgabe: die des Kontos). */
  waehrung: string;
  /** Name der Gegenseite (Auftraggeber bzw. Empfänger) — fremder Text, nur Daten. */
  gegenpartei: string;
  /** IBAN der Gegenseite in Grundform (nie ausgeliefert, nur zum Vergleichen). */
  gegenIban?: string;
  /** Verwendungszweck (zusammengefügt) — fremder Text, nur Daten. */
  zweck: string;
  /** Kategorie aus der Bank-CSV (N26, Qonto …), wenn vorhanden. */
  kategorie?: string;
  /** Kennung des Umsatzes bei der Bank (CAMT `AcctSvcrRef`/`NtryRef`, CSV „Transaktions-ID“) — Dublettenschutz. */
  externeId?: string;
  status: EintragStatus;
  /** Zeile in der CSV (1-basiert) bzw. laufende Nummer des Eintrags im CAMT — für Hinweise. */
  zeile: number;
}

export interface AuszugSaldo {
  /** Cent, mit Vorzeichen (Soll = negativ). */
  cent: number;
  /** Tag, an dem der Saldo galt. */
  datum: string;
}

/** Saldo-Prüfung: Anfangssaldo + Summe der gebuchten Umsätze = Endsaldo (nur, wenn beide Salden da sind). */
export interface Pruefsumme {
  anfang: number;
  summe: number;
  ende: number;
  stimmt: boolean;
  /** Cent: Endsaldo − (Anfang + Summe). */
  abweichung: number;
}

/** Ein Konto in der Datei (CSV: genau eins; CAMT: je IBAN + Währung, mehrere Tagesauszüge zusammengefasst). */
export interface Auszug {
  /** IBAN des Kontos, für das der Auszug gilt (Grundform) — wenn die Datei sie nennt. */
  iban?: string;
  waehrung: string;
  /** Endsaldo (CAMT `CLBD`, CSV Spalte „Saldo“ bzw. Fußzeile „Kontostand“). */
  saldo?: AuszugSaldo;
  /** Anfangssaldo (CAMT `OPBD`/`PRCD`, CSV aus der Saldo-Spalte bzw. Kopf/Fuß). */
  anfang?: AuszugSaldo;
  eintraege: AuszugEintrag[];
  hinweise: string[];
  pruefung: Pruefsumme | null;
}

/** Spaltenzuordnung einer CSV — Nummern der Spalten (0-basiert). Pflicht: `datum` und (`betrag` oder `soll`/`haben`). */
export interface Spalten {
  datum: number;
  betrag?: number;
  soll?: number;
  haben?: number;
  /** Soll/Haben-Kennzeichen („S“/„H“, „Debit“/„Credit“) bei Beträgen ohne Vorzeichen. */
  kennzeichen?: number;
  valuta?: number;
  gegenpartei?: number;
  iban?: number;
  zweck?: number[];
  saldo?: number;
  waehrung?: number;
  kennung?: number;
  status?: number;
  kategorie?: number;
  /** Gebühr je Umsatz (Revolut „Fee“) — wird vom Betrag abgezogen. */
  gebuehr?: number;
  /** IBAN des eigenen Kontos je Zeile (Sparkasse „Auftragskonto“) — ordnet den Auszug dem Konto zu. */
  eigeneIban?: number;
}
export const SPALTEN_FELDER = ['datum', 'betrag', 'soll', 'haben', 'kennzeichen', 'valuta', 'gegenpartei', 'iban', 'zweck', 'saldo', 'waehrung', 'kennung', 'status', 'kategorie', 'gebuehr', 'eigeneIban'] as const;
export type SpaltenFeld = typeof SPALTEN_FELDER[number];

export const SPALTEN_NAME: Readonly<Record<SpaltenFeld, string>> = {
  datum: 'Buchungstag', betrag: 'Betrag', soll: 'Soll (Ausgang)', haben: 'Haben (Eingang)', kennzeichen: 'Soll/Haben-Kennzeichen', valuta: 'Valuta',
  gegenpartei: 'Gegenseite (Name)', iban: 'IBAN der Gegenseite', zweck: 'Verwendungszweck', saldo: 'Saldo nach Buchung', waehrung: 'Währung',
  kennung: 'Kennung der Bank', status: 'Status (gebucht/vorgemerkt)', kategorie: 'Kategorie', gebuehr: 'Gebühr', eigeneIban: 'IBAN des eigenen Kontos',
};

export interface CsvInfo {
  trenner: string;
  zeichensatz: 'utf-8' | 'windows-1252';
  /** Zeile der Kopfzeile (1-basiert); 0 = die Datei hat keine Kopfzeile (Spalten heißen „Spalte 1 …“). */
  kopfZeile: number;
  kopf: string[];
  /** Die ersten Datenzeilen (roh) — nur für die Spaltenzuordnung im Browser. */
  beispiel: string[][];
  /** Vorschlag aus den Spaltennamen (bekannte Köpfe), ggf. unvollständig. */
  vorschlag: Partial<Spalten>;
  /** Die Zuordnung, mit der gelesen wurde (null = keine vollständige Zuordnung → erst zuordnen). */
  spalten: Spalten | null;
  /** Erkannter Aufbau einer Bank (nur Anzeige: „sieht aus wie …“). */
  bank?: string;
  zahlformat: 'komma' | 'punkt';
}

export type LeseErgebnis =
  | { ok: true; format: 'camt'; version?: string; auszuege: Auszug[]; hinweise: string[] }
  | { ok: true; format: 'csv'; auszuege: Auszug[]; csv: CsvInfo; hinweise: string[] }
  | { ok: false; status: 400 | 413 | 415; fehler: string; csv?: CsvInfo };

/** Grenzen — darüber wird abgelehnt (413), nie gekürzt. */
export const AUSZUG_GRENZEN = { bytes: 5 * 1024 * 1024, eintraege: 10_000, tiefe: 64 } as const;
