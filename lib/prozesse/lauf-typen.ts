// ─── Prozesse · Lauf-Motor — der VERTRAG der Läufe (Etappe C1 „Laufen intern“, 21.10.; research/prozesse/ANALYSE_100.md Punkte 29, 35–50, 59, 61, 64,
// 67, 69, 88, 98) ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Entscheidung 21.10. („Laufen, aber nur intern“): ein veröffentlichter Prozess läuft im eigenen Motor (kein n8n/Temporal) — Menschen-Schritte werden
// Aufgaben (Bezug zum Lauf, Abhaken treibt weiter), alles Äußere geht als Vorschlag in den ZOE-Stapel (Stapel-Art `prozess`; Ausgänge freigegeben,
// abgelehnt, abgelaufen als Äste), Agenten-Schritte nur auf Stufe „Vorschlag“, keine Raute, über die ein Modell entscheidet. Jeder Prozess startet im
// Probelauf (Schatten: rechnen und „würde …“ zeigen, nichts schreiben) — erst ein Klick schaltet ihn scharf (mit Rückfrage „Gilt das für n bestehende
// Fälle?“ und Budget).
//
// Ein Lauf ist ein DATENSATZ (Punkt 41) im Bestand `prozess-laeufe--<haushalt>`: Version (bleibt am Lauf, Punkt 44), Fall, wo er steht, worauf er wartet,
// je besuchtem Knoten Status, Zeitpunkte, Kosten und die KENNUNGEN seiner Wirkungen — nie Inhalte (Punkt 98: Texte, Namen, Adressen stehen nur dort, wo
// sie hingehören: Aufgabe, Vorschlag, Akte). Jede Wirkung trägt die feste Kennung `<lauf>-<schritt>` (Punkt 42): ein Wiederholen nach einem Abbruch legt
// nichts doppelt an.
//
// Diese Datei ist nur Typen, Grenzen, Kennungen und Sätze — rein und client-sicher. Regeln: lib/prozesse/lauf-regeln.ts (rein), Server:
// lib/prozesse/lauf-server.ts, Stapel-Art: lib/prozesse/lauf-stapel.ts. Nur ADDITIV ändern (neue optionale Felder, neue Union-Glieder).

import type { Ausgang } from './fluss';
import type { AusloeserArt, Bedingung, FallArt, ProzessBereich, SkillEreignis, Verknuepfung } from './definition';

// ══ Kennungen und Bestand ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

/** Lauf `pl-<uuid>` (zufällig — trägt keine Kennung eines Falls, auch nicht als Fingerabdruck). */
export const LAUF_KENNUNG = /^pl-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Zurückgehaltener Start (Flutschutz) `zh-<uuid>`. */
export const ZURUECK_KENNUNG = /^zh-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Eine Wirkung eines Laufs: `<lauf>-<16 hex>` (Aufgabe, Vorschlag, Teil-Lauf …) — ≤ 80 Zeichen, gültige Aufgaben- und Anfrage-Kennung. */
export const WIRKUNG_KENNUNG = /^pl-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[0-9a-f]{16}$/;
/** Präfix der Aufgaben eines Laufs (Haken nach jedem Aufgaben-Schreiben, lib/aufgaben/speicher.ts). */
export const LAUF_AUFGABE_PRAEFIX = 'pl-';
/** Eine Kennung am Fall (wie die Säuberer der Bestände). */
export const FALL_KENNUNG = /^[A-Za-z0-9][A-Za-z0-9_:.~-]{0,119}$/;

/** Der Bestand der Läufe je Haushalt (der des Inhabers — wie Prozesse und Fulfillment). */
export const laeufeBestand = (h: string): string => `prozess-laeufe--${h}`;

// ══ Ein Lauf ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

/** Woran ein Lauf hängt: die Art des Prozesses und die Kennung des Falls (ohne Fall: keine Kennung, dafür eine Periode). */
export interface LaufFall { art: FallArt; id?: string }

/**
 * `scharf` = echte Wirkungen (Aufgaben, Vorschläge, Glocke); `schatten` = Probelauf: derselbe Motor rechnet den Weg mit dem echten Fall und hält nur fest,
 * was er tun WÜRDE — schreibt keine Aufgabe, keinen Vorschlag, ruft kein Modell (Punkt 48; Entscheidung 21.10.: „jeder Prozess startet im Probelauf“).
 */
export type LaufModus = 'scharf' | 'schatten';

/**
 * Status eines Laufs:
 *   laeuft       bereit für den nächsten Schritt (der Takt bzw. ein Haken schiebt ihn weiter)
 *   wartet       auf eine Aufgabe, eine Freigabe, eine Zeit, ein Ereignis, einen Teilprozess, das Takt-Fenster (Agent) oder eine Pause nach Fehler
 *   angehalten   der Prozess ist pausiert bzw. zurückgestellt — geht nach dem Fortsetzen genau dort weiter
 *   fehler       dauerhafter Fehler ohne Fehlerkante: angehalten, Glocke an den Eigner — „erneut ab hier“ startet an der Fehlerstelle (Punkt 47)
 *   fertig       am Ende angekommen (Ziel erreicht, Übergabe bzw. kein weiterer Weg)
 *   abgebrochen  Ende ohne Ziel: von Hand (mit Grund), Abbruch-Kriterium, Art. 18 / Werbesperre (fest), Fall weg, Prozess archiviert
 */
export type LaufStatus = 'laeuft' | 'wartet' | 'angehalten' | 'fehler' | 'fertig' | 'abgebrochen';
export const LAUF_STATUS = ['laeuft', 'wartet', 'angehalten', 'fehler', 'fertig', 'abgebrochen'] as const satisfies readonly LaufStatus[];
/** Läufe, die noch nicht zu Ende sind — höchstens einer je Prozess und Fall (Punkt 35). */
export const LAUF_OFFEN: readonly LaufStatus[] = ['laeuft', 'wartet', 'angehalten', 'fehler'];
export const laufOffen = (l: Pick<ProzessLauf, 'status'>): boolean => LAUF_OFFEN.includes(l.status);

/**
 * Status eines besuchten Knotens (Lauf-Ansicht, Punkt 29: grün erledigt, gelb wartet, rot Fehler, grau nicht erreicht = kein Eintrag):
 *   laeuft · wartet · erledigt · uebersprungen (z. B. Kanal rot) · fehler · abgelaufen · abgebrochen — im Schatten dazu `wuerde` (hätte gewirkt) und
 *   `freigabe` (hätte zur Freigabe vorgelegt).
 */
export type SchrittStatus = 'laeuft' | 'wartet' | 'erledigt' | 'uebersprungen' | 'fehler' | 'abgelaufen' | 'abgebrochen' | 'wuerde' | 'freigabe';
/** Über welchen Ausgang ein Knoten verlassen wurde (`eingetreten` = ein Warten hat sein Ziel erreicht). */
export type LaufAusgang = Ausgang | 'eingetreten';

/** Worauf eine Wirkung zeigt — nur die Kennung. */
export type WirkungArt = 'aufgabe' | 'vorschlag' | 'lauf' | 'meldung' | 'gesendet';
export interface Wirkung { art: WirkungArt; id: string }

/** Feste Gründe (nie Text Dritter, nie Namen) — die Sätze stehen in `GRUND_TEXT`. */
export type LaufGrund =
  | 'vorbereitet' | 'kanal-rot' | 'kanal-gelb' | 'art18' | 'werbesperre' | 'kein-empfaenger' | 'kein-postfach' | 'schloss-fehlt'
  | 'modell-raute' | 'daten-fehlen' | 'kein-weg' | 'abgelehnt' | 'abgelaufen' | 'ziel' | 'abbruch-kriterium' | 'hand' | 'fall-weg'
  | 'archiviert' | 'knoten-fehlt' | 'version-fehlt' | 'vertrag' | 'ki-aus' | 'ki-fehler' | 'budget' | 'budget-schritt' | 'fenster' | 'hoechstzahl'
  | 'aufgabe-abgebrochen' | 'aufgabe-weg' | 'vorschlag-abgelehnt' | 'teilprozess-fehlt' | 'teilprozess-fehler' | 'kette' | 'schleife'
  | 'nicht-gebaut' | 'person-fehlt' | 'voruebergehend' | 'dauerhaft' | 'agent-fehlt' | 'notbremse' | 'erneut'
  // 22.10. (Läufe-Ansicht, C1-Frage 1): ohne KI-Schlüssel bzw. Guthaben hält ein Agenten-Schritt SOFORT an — kein Wiederholen, keine Fehlerkante.
  | 'ki-nicht-eingerichtet'
  // 22.10. spät (Motor-Rest: Schleife, CRM-Abfrage, Agent mit Feldern, Platzhalter, Nachtlauf).
  | 'rolle-fehlt' | 'gesellschaft-fehlt' | 'abfrage-rest' | 'schleife-rest' | 'liste-fehlt' | 'gedrosselt' | 'recherche-frisch' | 'agent-aus';

/** Ein besuchter Knoten. Ein Knoten kann mehrfach besucht werden (Erinnerung, „erneut ab“) — `runde` zählt mit. */
export interface LaufSchritt {
  knoten: string;
  status: SchrittStatus;
  /** Ankunft (ISO). */
  ab: string;
  /** Ende (ISO). */
  bis?: string;
  ausgang?: LaufAusgang;
  runde?: number;
  wirkung?: Wirkung[];
  /** Geschätzte bzw. gemessene Kosten (Euro-Cent) — nur Agenten-Schritte. */
  kostenCent?: number;
  /** Versuche nach vorübergehendem Fehler (Punkt 47). */
  versuch?: number;
  grund?: LaufGrund;
  /** Agenten-Schritt: welcher Head (bzw. `zoe`) — zählt in dessen Tageshöchstzahl (E-V6). */
  kopf?: string;
  /** Agenten-Schritt (22.10., Log-Baum der Läufe-Ansicht): das Modell, das wirklich gefragt wurde, und die Tokens (nur Zahlen). */
  modell?: string;
  token?: { ein: number; aus: number };
  /**
   * Motor-Rest (22.10. spät, nur Zahlen): CRM-Abfrage = Treffer im Lauf, Schleife = gestartete Teil-Läufe; `rest` = was über der Obergrenze liegt (nie still
   * gekürzt — es wartet sichtbar auf den nächsten Lauf); `uebersprungen` = Fälle, die schon einen Lauf haben (offen bzw. noch nicht wieder dran).
   */
  anzahl?: number;
  rest?: number;
  uebersprungen?: number;
  /** Der Schritt hat im Web recherchiert (Research-Agent) — Grundlage der Recherche-Frische (dieselbe Firma höchstens alle n Tage). */
  recherche?: true;
}

/**
 * Die Liste einer CRM-Abfrage im Lauf (22.10. spät, N1): nur die KENNUNGEN der Fälle in fester Reihenfolge (höchstens `hoechstens` der Abfrage) und wie viele es
 * insgesamt gab. Lebt nur, solange der Lauf offen ist (beim Ende fällt sie weg) — gelesen von der Schleife, die die Abfrage nennt (`abfrage:<Knoten>`).
 */
export interface LaufListe { faelle: LaufFall[]; gesamt: number; am: string }

/** Worauf ein Lauf wartet (Punkt 46: jedes Warten hat eine Obergrenze bzw. einen Wecker — wartende Läufe kosten nichts, nur der Takt weckt). */
export type WarteArt = 'aufgabe' | 'freigabe' | 'zeit' | 'datum' | 'ereignis' | 'teilprozess' | 'fenster' | 'fehler';
export interface LaufWarten {
  knoten: string;
  art: WarteArt;
  /** Wecker bzw. Obergrenze (ISO). Fehlt bei Aufgaben (ein Menschen-Schritt wartet, die Lage zeigt „hängt“). */
  bis?: string;
  /** Kennung der Wirkung, auf die gewartet wird (Aufgabe, Vorschlag, Teil-Lauf). */
  wirkung?: string;
  /** Warten auf ein Ereignis: welche Art (die Bedingungen stehen am Knoten der Version). */
  ereignis?: SkillEreignis;
  /** Warten auf ein Datum, das schon erreicht ist (Ausgang „eingetreten“) bzw. die Obergrenze (Ausgang „abgelaufen“). */
  ziel?: string;
}

/** Wodurch der Lauf startete — nur Art und Kennungen. */
export interface LaufAusloeser {
  /** `produkt` (22.10., Prozesse × Fulfillment): gestartet über die Bindung eines Produkts (`Leistung.prozessId`, lib/prozesse/produkt-bindung.ts). */
  art: AusloeserArt | 'teilprozess' | 'uebergabe' | 'bestehend' | 'produkt';
  /** Auslöser-Knoten der Version. */
  knoten?: string;
  /** Ereignis-Kennung (ereignisse--*), Webhook-Eingang, Zeitplan-Slot, Loop-Tag, Anfrage — was den Start eindeutig macht. */
  quelle?: string;
  /** Wer von Hand startete (Speichername). */
  von?: string;
}

export interface ProzessLauf {
  id: string;
  prozessId: string;
  /** Die Version, auf der der Lauf läuft (Punkt 44) — eine neue Version gilt nur für neue Fälle; Umzug nur ausdrücklich. */
  version: number;
  fall: LaufFall;
  /** Bereich des Prozesses (nur Business). */
  bereich: ProzessBereich;
  /** `<prozess>|<art>:<id>` bzw. `<prozess>|keiner:<periode>` — höchstens ein offener Lauf je Schlüssel (Punkt 35). */
  schluessel: string;
  /** Wiedereintritt (M2): der wievielte Lauf zu diesem Schlüssel (1, 2 …). */
  durchgang: number;
  modus: LaufModus;
  status: LaufStatus;
  /** Als wer der Lauf schreibt (Regel 5: die auslösende Person bzw. „läuft als“) — nie ein Rückfall auf den Inhaber. */
  person: string | null;
  ausloeser: LaufAusloeser;
  /** Kette (Punkt 49): von welchem Lauf er ausgelöst wurde (Teilprozess, Übergabe, Ereignis aus einer Wirkung) und wie tief. */
  herkunft?: { prozessId: string; laufId: string };
  tiefe: number;
  /** Der Lauf trägt fremden Text (Webhook) — danach gibt es nur Vorschläge (Punkt 56, Regel 6). */
  fremd?: true;
  /** Felder für Bedingungen und Kennungen des Bezugs (`ereignis.*`, `bezug.*`, `webhook.eingang`) — nur Kennungen und Arten, nie Text. */
  daten: Record<string, string>;
  start: string;
  geaendert: string;
  ende?: string;
  ergebnis?: 'erfolg' | 'abbruch' | 'uebergabe';
  grund?: LaufGrund;
  /** Der Knoten, an dem der Lauf steht (null = vor dem Auslöser bzw. am Ende). */
  aktuell: string | null;
  wartet?: LaufWarten;
  schritte: LaufSchritt[];
  kostenCent: number;
  /** Runden je Knoten („erneut ab“, Erinnerung). */
  zaehler?: Record<string, number>;
  /** Anspruch des Motors (gerade in Arbeit) — älter als `LAUF_GRENZEN.anspruchMs` gilt als verwaist. */
  inArbeit?: { seit: string; token: string };
  /** Listen der CRM-Abfragen dieses Laufs je Abfrage-Knoten (22.10. spät) — nur Kennungen, nur solange der Lauf offen ist. */
  listen?: Record<string, LaufListe>;
}

/** Ein zurückgehaltener Start (Flutschutz, Punkt 37) — „starten“ oder „verwerfen“ per Klick; nie still gekürzt. */
export interface Zurueckgehalten {
  id: string;
  prozessId: string;
  fall: LaufFall;
  ausloeser: LaufAusloeser;
  person: string | null;
  daten: Record<string, string>;
  tiefe: number;
  herkunft?: { prozessId: string; laufId: string };
  fremd?: true;
  am: string;
}

// ══ Einstellungen und Laufzeit je Prozess ═══════════════════════════════════════════════════════════════════════════════════════════════════════

/** Wie mit den Fällen umgegangen wird, die es beim Scharfschalten schon gibt (Punkt 36 — Vorgabe „nur neue Fälle“). */
export type Bestehende = 'nur-neue' | 'alle';

/** Einstellungen der Läufe eines Prozesses (Feld mit Vorgabe — nie eine Konstante im Code). */
export interface LaufEinstellung {
  /** Scharf geschaltet (Punkte 36, 59): wer, wann, welche Version, Budget je Monat und Schätzung, Antwort auf die Rückfrage. */
  scharf?: { am: string; von: string; version: number; budgetCent: number; schaetzungCent: number; bestehende: Bestehende; bestehendeAnzahl: number };
  /** Flutschutz: automatische Starts je Prozess und Stunde (Vorgabe `LAUF_GRENZEN.flutJeStunde`). */
  flutJeStunde?: number;
  /** Notbremse: Wirkungen je Prozess und Stunde — darüber pausiert sich nur dieser Prozess (Vorgabe `LAUF_GRENZEN.notbremseJeStunde`). */
  notbremseJeStunde?: number;
  /** Wiedereintritt je Fall (M2): ein beendeter Lauf darf nach so vielen Tagen erneut starten — fehlt = nie automatisch (nur von Hand mit Grund). */
  erneutNachTagen?: number;
  /** „Ziel erreicht, wenn …“ bzw. „Abbrechen, wenn …“ (Punkt 40) — Bedingungen über Felder des Falls. Art. 18 und Werbesperre beenden IMMER (fest). */
  ziel?: { bedingungen: Bedingung[]; verknuepfung?: Verknuepfung };
  abbruch?: { bedingungen: Bedingung[]; verknuepfung?: Verknuepfung };
  /**
   * Recherche-Frische (22.10. spät, M6): dieselbe Firma bzw. derselbe Lead wird höchstens alle n Tage im Web recherchiert (Vorgabe
   * `LAUF_GRENZEN.rechercheFrischeTage`) — über alle Prozesse; jünger → der Schritt wird übersprungen (kein Modellaufruf, keine Kosten).
   */
  rechercheFrischeTage?: number;
  /** Höchstens so viele Web-Suchen je Recherche eines Leads (Vorgabe `LAUF_GRENZEN.rechercheSuchen`). */
  rechercheSuchen?: number;
}

export type VerlaufWas = 'scharf' | 'bestehende' | 'budget' | 'einstellung' | 'pause' | 'fortgesetzt' | 'notbremse' | 'budget-80' | 'budget-grenze'
  | 'zurueckgehalten' | 'gestartet' | 'verworfen' | 'umzug' | 'abgebrochen' | 'erneut';
/** Ein Eintrag im Verlauf des Prozesses (Punkt 36: „die Antwort steht im Verlauf“) — nur Zahlen und Kennungen. */
export interface VerlaufEintrag {
  am: string; von: string; was: VerlaufWas; n?: number; version?: number; wert?: number;
  /** Grund von Hand („erneut starten“, „abbrechen“ — Punkte 35, 50): von einem Menschen aus dem Team geschrieben, höchstens 300 Zeichen. */
  notiz?: string;
}

/** Laufzeit-Stand eines Prozesses (nicht die Definition — die steht in `prozesse--<h>`). */
export interface ProzessLaufStand {
  einstellung: LaufEinstellung;
  /** Zähler der laufenden Berliner Stunde: automatische Starts (Flutschutz) und Wirkungen (Notbremse). */
  zaehlung?: { stunde: string; starts: number; wirkungen: number; gemeldet?: true };
  /** Kosten des laufenden Monats (Euro-Cent) — 80 % Hinweis, an der Grenze Pause. */
  monat?: { monat: string; kostenCent: number; hinweis80?: true; grenze?: true };
  /** Selbst pausiert (Budget, Notbremse) — Status `pausiert` steht in der Werkstatt, der Grund hier. */
  pause?: { grund: 'budget' | 'notbremse'; am: string };
  /** Zeitplan: zuletzt gestarteter Slot je Auslöser-Knoten (Berliner Wandzeit). */
  zeitplan?: Record<string, string>;
  /** Loop: zuletzt gestarteter Tag je Loop-Art. */
  loop?: Record<string, string>;
  verlauf: VerlaufEintrag[];
  /** Nur Zähler (Lage, Head of IT): nie gestartete Läufe — ohne Person, Kette zu tief, eigene Wirkung, Bestand voll, Probeläufe über der Schwelle. */
  nicht?: { ohnePerson?: number; kette?: number; eigen?: number; voll?: number; schatten?: number };
  /** Testfälle (22.10., Reiter „Tests“ der Werkstatt, Punkt 48) — nur Kennungen und die erwartete Statusfolge, nie Inhalte oder Namen. */
  tests?: Testfall[];
}

// ══ Testfälle (22.10., Reiter „Tests“; Kevins Bild n8n „Copy to editor“) ════════════════════════════════════════════════════════════════════════

/** Status eines Schritts im Probelauf (dieselben Wörter wie `ProbeZeile` in lib/prozesse/lauf-regeln.ts). */
export type TestStatus = 'wuerde' | 'uebersprungen' | 'wartet' | 'freigabe' | 'fehler';
export const TEST_STATUS = ['wuerde', 'uebersprungen', 'wartet', 'freigabe', 'fehler'] as const satisfies readonly TestStatus[];
/** Testfall `tf-<uuid>`. */
export const TESTFALL_KENNUNG = /^tf-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/**
 * Ein gespeicherter Testfall: ein Fall (Kennung) bzw. der erfundene Beispiel-Fall und die Statusfolge, die der Probelauf damals ergab. „Alle prüfen“ spielt
 * jeden Testfall erneut als Probelauf (schreibt nichts) und vergleicht — grün = gleiche Folge. Kein `von`, kein Name, kein Inhalt (Punkt 98); die Kennung des
 * Falls tilgt Art. 17 mit dem ganzen Bestand (`tilgen`).
 */
export interface Testfall {
  id: string;
  /** Laufende Nummer je Prozess („Testfall 3“) — der Name entsteht daraus, nie aus Freitext. */
  nr: number;
  fall: LaufFall | 'beispiel';
  erwartet: { knotenId: string; status: TestStatus }[];
  am: string;
  /** Aus einem Lauf übernommen (Kennung und Version) bzw. aus welcher Version gerechnet. */
  aus?: { lauf?: string; version?: number };
}

export interface LaeufeDatei {
  v: 1;
  laeufe: ProzessLauf[];
  zurueckgehalten: Zurueckgehalten[];
  prozesse: Record<string, ProzessLaufStand>;
  /** Ereignis-Cursor des Motors (eigener — der der Agenten in `ereignisse--*` bleibt unberührt). */
  cursor?: { nr: number; am: string };
}
export const leereLaeufe = (): LaeufeDatei => ({ v: 1, laeufe: [], zurueckgehalten: [], prozesse: {} });
export const leererStand = (): ProzessLaufStand => ({ einstellung: {}, verlauf: [] });

// ══ Grenzen (über einer Grenze wird ABGELEHNT bzw. angehalten — nie still gekürzt) ══════════════════════════════════════════════════════════════

export const LAUF_GRENZEN = {
  /** Läufe im Bestand — darüber werden NEUE abgelehnt und gezählt (HOI rot), nie ein vorhandener gekürzt. Beendete fallen nach der Frist weg. */
  laeufe: 5000,
  zurueckgehalten: 2000,
  /** Besuchte Knoten je Lauf — darüber endet der Lauf mit „Schleife“ (Wache gegen Kreise). */
  schritteJeLauf: 400,
  /** So viele Knoten rechnet ein Anstoß höchstens — der Rest folgt im nächsten Takt (1 vCPU). */
  schritteJeAnstoss: 40,
  /** Läufe je Takt-Anstoß. */
  laeufeJeTakt: 25,
  /** Kette höchstens so tief (Punkt 49): Teilprozess → Teilprozess → Teilprozess. */
  kettenTiefe: 3,
  /** Flutschutz: automatische Starts je Prozess und Stunde (Vorgabe, Punkt 37). */
  flutJeStunde: 20,
  /** Notbremse: Wirkungen je Prozess und Stunde (Vorgabe, Punkt 50). */
  notbremseJeStunde: 120,
  /** Wiederholungen bei vorübergehendem Fehler (Punkt 47) — Pause 5 · 3^(n−1) min, höchstens 3 h (wie der Takt). */
  versuche: 5,
  /** Frist einer Freigabe bzw. Entscheidung im Stapel, wenn der Knoten nichts sagt (Tage). */
  freigabeFristTage: 7,
  /** Ab so vielen Tagen ohne Bewegung gilt ein wartender Lauf als „hängt“ (Lage, HOI). */
  haengtTage: 7,
  /** Anspruch des Motors (ms) — danach gilt er als verwaist. */
  anspruchMs: 10 * 60_000,
  verlauf: 1000,
  /** Höchstes Budget je Prozess und Monat (Cent). */
  budgetCentMax: 100_000,
  /** Ereignisse, die älter sind, starten nichts mehr (wie die Agenten). */
  ereignisAlterStunden: 72,
  /** Testfälle je Prozess (22.10.) — darüber 413, nie gekürzt. */
  testfaelle: 20,
  /** Arbeitszeit (M1 „Arbeitszeit zählen“): Werktage NRW, von … bis (Berliner Stunden). */
  arbeitVon: 9,
  arbeitBis: 18,
  /** Agenten-Schritte je Takt-Anstoß (22.10. spät, E-V5): nach 7 Uhr starten die gesammelten Agenten-Schritte gedrosselt — der Rest im nächsten Takt. */
  agentenJeTakt: 4,
  /** So lange wartet ein gedrosselter Agenten-Schritt (Minuten). */
  drosselMinuten: 2,
  /** Recherche-Frische (Vorgabe, Tage) und Web-Suchen je Recherche (Vorgabe) — Felder je Prozess in `LaufEinstellung`. */
  rechercheFrischeTage: 90,
  rechercheSuchen: 3,
  /** Kennungen einer CRM-Abfrage im Lauf (wie `PROZESS_GRENZEN.abfrageHoechstens`). */
  listeMax: 1000,
} as const;

/** Sätze zu den Gründen (Lauf-Ansicht, Probelauf, Glocke) — ohne Namen, ohne Inhalte. */
export const GRUND_TEXT: Readonly<Record<LaufGrund, string>> = {
  vorbereitet: 'vorbereitet — wirkt erst nach der Freigabe',
  'kanal-rot': 'Kanal-Ampel rot (keine zulässige Ansprache) — nichts angelegt',
  'kanal-gelb': 'Kanal-Ampel gelb — mit Hinweis',
  art18: 'Verarbeitung eingeschränkt (Art. 18 DSGVO) — der Lauf endet',
  werbesperre: 'Werbesperre — der Lauf endet',
  'kein-empfaenger': 'kein Empfänger im Fall (Mail bzw. Nummer fehlt)',
  'kein-postfach': 'kein eigenes Postfach zum Senden',
  'schloss-fehlt': 'Außenwirkung ohne Freigabe-Schloss — nichts ausgeführt',
  'modell-raute': 'Entscheidungen durch ein Modell laufen (noch) nicht — bitte als Regel bauen',
  'daten-fehlen': 'Daten des Falls fehlen für diese Entscheidung',
  'kein-weg': 'kein weiterer Weg — der Lauf endet hier',
  abgelehnt: 'abgelehnt',
  abgelaufen: 'Frist abgelaufen',
  ziel: 'Ziel erreicht',
  'abbruch-kriterium': 'Abbruch-Kriterium erfüllt',
  hand: 'von Hand abgebrochen',
  'fall-weg': 'den Fall gibt es nicht mehr',
  archiviert: 'Prozess archiviert',
  'knoten-fehlt': 'den Schritt gibt es in dieser Version nicht',
  'version-fehlt': 'diese Version gibt es nicht',
  vertrag: 'Ergebnis passt nicht zum Vertrag des Schritts',
  'ki-aus': 'KI im Hintergrund ist aus (Einstellungen › Datenschutz)',
  'ki-fehler': 'Modell nicht erreichbar',
  budget: 'Budget des Prozesses erreicht — pausiert',
  'budget-schritt': 'Schätzung über dem Budget des Schritts',
  fenster: 'Agenten-Schritte warten bis 7 Uhr (Takt-Fenster)',
  hoechstzahl: 'Tageshöchstzahl des Heads erreicht — morgen weiter',
  'aufgabe-abgebrochen': 'Aufgabe abgebrochen',
  'aufgabe-weg': 'Aufgabe gelöscht',
  'vorschlag-abgelehnt': 'Vorschlag nicht angenommen (Prüfung)',
  'teilprozess-fehlt': 'Teilprozess nicht veröffentlicht bzw. nicht aktiv',
  'teilprozess-fehler': 'Teilprozess ohne Ziel beendet',
  kette: 'Kette zu tief (höchstens 3 Prozesse hintereinander)',
  schleife: 'zu viele Schritte — Schleife angehalten',
  'nicht-gebaut': 'dieser Baustein läuft im Motor noch nicht',
  'person-fehlt': 'keine Person, als die der Lauf schreibt',
  voruebergehend: 'vorübergehender Fehler — wird wiederholt',
  dauerhaft: 'Fehler — angehalten',
  'agent-fehlt': 'Agenten-Schritt ohne Einstellungen',
  notbremse: 'Notbremse: zu viele Wirkungen in einer Stunde — Prozess pausiert',
  erneut: 'erneut ab diesem Schritt',
  'ki-nicht-eingerichtet': 'KI nicht eingerichtet (kein Schlüssel bzw. kein Guthaben) — angehalten, „erneut ab hier“, sobald sie eingerichtet ist',
  'rolle-fehlt': 'die Rolle (Eigner bzw. Zuständig) ist keiner Person mit Konto zugeordnet — bitte im Prozess den Eigner bzw. am Fall die Zuständige setzen',
  'gesellschaft-fehlt': 'der Fall hat keine Business-Gesellschaft (Deal bzw. Mandat) — bitte am Fall setzen',
  'abfrage-rest': 'mehr Treffer als „höchstens“ — der Rest kommt sichtbar im nächsten Lauf',
  'schleife-rest': 'Obergrenze je Lauf erreicht — die übrigen Fälle warten sichtbar auf den nächsten Lauf',
  'liste-fehlt': 'die Liste der Schleife fehlt (Abfrage nicht gelaufen bzw. unbekannte Liste)',
  gedrosselt: 'Agenten-Schritte laufen gedrosselt — weiter im nächsten Takt',
  'recherche-frisch': 'diese Firma wurde vor Kurzem recherchiert (Recherche-Frische) — übersprungen, ohne Kosten',
  'agent-aus': 'der Agent ist unter ZOE › Agenten ausgeschaltet',
};
