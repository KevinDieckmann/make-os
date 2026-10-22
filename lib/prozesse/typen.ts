// ─── Prozesse — das gemeinsame Modell (Etappe A „Sehen“, 21.10.; research/prozesse/ANALYSE_100.md Punkte 1–5, 7, 9, 30) ─────────────────────
// Entscheidung 21.10.: „Prozesse“ wird ein eigener Punkt in der Business-Leiste — der EINE Ort, an dem alle Abläufe von Marketing über Sales bis Fulfillment zu
// sehen sind. Entscheidungen: E1 die Landkarte der ganzen Firma ist eine Fliege (Bowtie) links → rechts (Marketing → Sales → Übergabe → Fulfillment →
// Ausbau) mit den Bändern „Führung“ oben und „Unterstützung“ unten; das Hochhaus bleibt der Drill-down IM Fulfillment. E3 Prozesse, die heute schon im
// Code laufen, erscheinen als „System“-Kacheln und sind nur lesbar.
// Hier steht NUR das Modell (rein, client-sicher, ohne Daten-Importe): Bänder, Stufen der Fliege, ein Prozess mit Steckbrief (Punkt 7), Phasen (Ebene 2),
// Schritten (Ebene 3, feste Formen des Miro-Stils), Übergaben (Punkt 9) und die Zahl der Fälle (Punkt 27). Dasselbe Modell speist Bild UND Liste (Punkt 30).

import type { FlussForm } from '@/lib/reise/bild';
import type { ProzessStatus } from './definition';

/** Die drei Bänder der Landkarte (Punkt 3): Führung oben, Kern (die Fliege) in der Mitte, Unterstützung unten. */
export type Band = 'fuehrung' | 'kern' | 'unterstuetzung';
export const BAENDER: readonly { id: Band; titel: string; satz: string }[] = [
  { id: 'fuehrung', titel: 'Führung', satz: 'Ziele, Planung und Steuerung' },
  { id: 'kern', titel: 'Kern', satz: 'Kunden gewinnen, übergeben, liefern und ausbauen' },
  { id: 'unterstuetzung', titel: 'Unterstützung', satz: 'Finanzen, Recht und Betrieb' },
];

/** Die Stufen der Fliege im Kern-Band, von links nach rechts (Punkt 2 — Bowtie: gewinnen · Übergabe · liefern und ausbauen). */
export type KernStufe = 'marketing' | 'sales' | 'uebergabe' | 'fulfillment' | 'ausbau';
export const KERN_STUFEN: readonly { id: KernStufe; titel: string; seite: 'gewinnen' | 'knoten' | 'liefern' }[] = [
  { id: 'marketing', titel: 'Marketing', seite: 'gewinnen' },
  { id: 'sales', titel: 'Sales', seite: 'gewinnen' },
  { id: 'uebergabe', titel: 'Übergabe', seite: 'knoten' },
  { id: 'fulfillment', titel: 'Fulfillment', seite: 'liefern' },
  { id: 'ausbau', titel: 'Ausbau', seite: 'liefern' },
];

/**
 * Woher ein Prozess kommt: im Code gebaut („System“, nur lesbar — E3), eine Vorlage aus dem Fulfillment-Bestand (im Editor bearbeitbar) oder in der Werkstatt
 * gebaut (Etappe B2, Bestand `prozesse--<haushalt>`, lib/prozesse/werkstatt-landkarte.ts).
 */
export type ProzessQuelle = 'system' | 'vorlage' | 'werkstatt';

/**
 * Ein Schritt (Ebene 3) in seiner festen Form (Miro-Stil: Schritt grün, Nachricht gelb, Entscheidung Raute, Erinnerung orange, Termin). An einer Entscheidung
 * zeigt `nein` auf den Schritt des Nein-Zweigs (derselben Phase), `ja` optional auf den Ja-Zweig (sonst der nächste). Ein Nein-Zweig mit `zurueck` führt danach
 * zurück zur Entscheidung (die typische Schleife: Erinnerung → wieder fragen); mit `ende` endet dort dieser Weg (z. B. „Verloren mit Grund“) — sonst läuft er
 * nach der Entscheidung weiter wie im Fulfillment-Modell. `was` = was in diesem Schritt passiert (Ebene 4), `wer` = die Rolle.
 */
export interface ProzessSchritt {
  id: string; titel: string; form: FlussForm;
  was?: string; wer?: string;
  ja?: string; nein?: string; zurueck?: true; ende?: true;
}
/** Eine Phase (Ebene 2) mit ihren Schritten; `abstimmung` = der Abstimmungspunkt am Ende (Raute, Fulfillment). */
export interface ProzessPhase { id: string; titel: string; schritte: ProzessSchritt[]; abstimmung?: string }

/** Der Steckbrief (Punkt 7, SIPOC): Grenze und Zweck eines Prozesses auf einen Blick. Die Phasen kommen aus dem Prozess selbst. */
export interface Steckbrief { ausloeser: string; eingang: string; ergebnis: string; empfaenger: string; eigner: string }
export const STECKBRIEF_FELDER: readonly { id: keyof Steckbrief | 'phasen'; titel: string }[] = [
  { id: 'ausloeser', titel: 'Auslöser' },
  { id: 'eingang', titel: 'Eingang' },
  { id: 'phasen', titel: 'Phasen' },
  { id: 'ergebnis', titel: 'Ergebnis' },
  { id: 'empfaenger', titel: 'Empfänger' },
  { id: 'eigner', titel: 'Eigner' },
];

/** Was die Zahl einer Kachel zählt — der Server rechnet sie aus den vorhandenen Lesewegen (lib/prozesse/server.ts). */
export type ZaehlerArt = 'leads' | 'deals' | 'followup' | 'nachher' | 'event-nachfassen' | 'onboarding' | 'faelle';

/** Eine Übergabe an einen anderen Prozess (Punkt 9): die Landkarte zieht daraus einen beschrifteten Lichtfaden. */
export interface Uebergabe { nach: string; text: string }

export interface ProzessDef {
  id: string; titel: string; quelle: ProzessQuelle;
  band: Band;
  /** Nur im Kern-Band: die Stufe der Fliege. */
  stufe?: KernStufe;
  steckbrief: Steckbrief;
  phasen: ProzessPhase[];
  /** Wo der Prozess in MAKE OS läuft (eine vorhandene Seite, nur über WEG). */
  link?: { href: string; text: string };
  /** Vorlage aus dem Fulfillment: Adresse des Editors (`WEG.fulfillment('prozesse', { e })`). */
  editor?: string;
  /** Die Landkarte des Fulfillments (Hochhaus) — der Drill-down führt dorthin (E1). */
  hochhaus?: true;
  uebergaben?: Uebergabe[];
  zaehler?: ZaehlerArt;
  /**
   * Stellschrauben (22.10., nur System-Prozesse): die Einstellungen, die dieser Ablauf heute schon liest — Wert, Vorgabe, Grenzen, wo gespeichert und wie
   * geändert (lib/prozesse/stellschrauben.ts). Der Server füllt sie aus den VORHANDENEN Beständen (lib/prozesse/stellschrauben-server.ts), wie `zaehler`.
   * Fehlt = keine.
   */
  stellschrauben?: import('./stellschrauben').Stellschraube[];
  /** Nur Werkstatt: Status, jüngste veröffentlichte Version (null = nur Entwurf), Zahl der Schritte. */
  werkstatt?: { status: ProzessStatus; version: number | null; schritte: number };
  /**
   * Prozesse × Fulfillment (22.10.): die Produkte, die auf diesen Prozess zeigen (Werkstatt: `Leistung.prozessId`; Paket: Zuordnung des Fulfillments) — der Server
   * hängt sie an (lib/prozesse/server.ts), die Kachel nennt sie, der Steckbrief verlinkt sie („gehört zu Produkt …“, `WEG.produkt`). Fehlt = an keinem Produkt.
   */
  produkte?: { id: string; name: string; href: string }[];
  /**
   * Landkarte anpassen (22.10., lib/prozesse/landkarte-anpassung.ts `landkarteAnsicht`) — NUR für die Anzeige gesetzt, nie gespeichert: eigene Beschriftung der
   * Kachel (der Titel des Prozesses bleibt), der Ton des Bereichs (ein Wert aus `LANDKARTE_TOENE`), ein eigener Bereich (`lb-…`, steht als Band), ausgeblendet.
   */
  beschriftung?: string;
  ton?: string;
  bereichEigen?: string;
  aus?: true;
}

/**
 * Die Zahl an einer Kachel bzw. einem Knoten (Punkt 27): eine Zahl mit Wort, optional eine zweite (rot nur bei einer Frist). `href` = wo die Fälle stehen.
 * Fehlt sie, gibt es keine echten Daten — nie eine erfundene Null.
 */
export interface Zahl { wert: number; wort: string; zweite?: { wert: number; wort: string; rot?: true }; href?: string }

/** Antwort von GET /api/prozesse/landkarte (nur Business, serverseitig gebaut). Schlüssel der Zahlen: `p` · `p/phase` · `p/phase/schritt`. */
export interface LandkarteDaten {
  ok: true; prozesse: ProzessDef[]; zahlen: Record<string, Zahl>; stand: string;
  /** Landkarte anpassen (22.10.): die gespeicherten Abweichungen von der Vorgabe (nie die Vorgabe selbst) und ihr Stand (für 409). Fehlt = Vorgabe. */
  anpassung?: import('./landkarte-anpassung').LandkarteAnpassung;
  anpassungStand?: string;
  /**
   * Stellschrauben (22.10.): was die angemeldete Person je Weg ändern darf (dieselben Regeln wie die jeweilige Route — die prüft beim Schreiben noch einmal)
   * und der Stand des Bestands `prozesse-stellschrauben--<h>` (für 409). Fehlt = nur ansehen.
   */
  stellschraubenRechte?: import('./stellschrauben').StellschraubenRechte;
  stellschraubenStand?: string;
}

/** Ein Ort im Modell — die Ebenen (Punkt 5): 1 Landkarte (leer), 2 Prozess (`p`), 3 Ablauf einer Phase (`ph`), 4 Schritt-Detail (`s`). */
export interface ProzessPfad { p?: string; ph?: string; s?: string }
export type Ebene = 1 | 2 | 3 | 4;
export const EBENE_NAME: Record<Ebene, string> = { 1: 'Landkarte', 2: 'Prozess', 3: 'Ablauf', 4: 'Schritt' };
export const ebeneVon = (p: ProzessPfad): Ebene => (p.s ? 4 : p.ph ? 3 : p.p ? 2 : 1);

/**
 * Die Darstellungen DESSELBEN Modells (Punkt 30) — EINE Liste, nie ein festes Zwei-Wege-Paar (Entscheidung 21.10.: in Etappe B kommt „Werkstatt“ im Stil eines
 * n8n-Editors dazu; Landkarte und Prozessbilder bleiben Miro-/Flow-Stil). Neue Darstellung = eine Zeile hier (+ ihre Zeichnung), sonst nichts.
 */
export const PROZESS_ANSICHTEN = [
  { id: 'bild', titel: 'Bild', satz: 'Die Fliege und die Abläufe als Bild im Flow-Stil' },
  { id: 'liste', titel: 'Liste', satz: 'Dasselbe als verschachtelte Liste — für das Handy, zum Vorlesen und als Text' },
  { id: 'werkstatt', titel: 'Werkstatt', satz: 'Prozesse bauen — wie ein n8n-Editor, mit unseren Formen und dem Flow' },
] as const;
export type ProzessAnsicht = (typeof PROZESS_ANSICHTEN)[number]['id'];
export const istProzessAnsicht = (v: unknown): v is ProzessAnsicht => PROZESS_ANSICHTEN.some(a => a.id === v);
/** Unter dieser Breite startet die Liste (Punkt 20 — am Handy Liste und Ansehen, die Fläche nur zoomen). */
export const LISTE_UNTER_PX = 720;
/** Welche Darstellung gilt: die aus der Adresse, sonst am Handy die Liste, am Rechner das Bild. */
export const ansichtVorgabe = (adresse: ProzessAnsicht | null | undefined, handy: boolean): ProzessAnsicht => adresse ?? (handy ? 'liste' : 'bild');
