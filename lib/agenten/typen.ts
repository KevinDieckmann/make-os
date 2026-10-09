// ─── Agenten-Bereich: der VERTRAG (08.10. spät, Paket 0; AGENTEN_KONZEPT.md C4 + C11) ───────────────────────
// Auftrag 08.10.: „Den ganzen Agent-Bereich im Business wie im Privaten aufs nächste Level bringen … Grundstruktur von Claude
// nehmen, aber individuell anpassen.“ Begriffe (C1): ZOE → Head → Mitarbeiter; Thread (Code: `faden`), Skill, Hintergrund-
// aufgabe (Code: `lauf`), „Als Nächstes“ (Code: `naechstes`). Antworten 1–16 in ENTSCHEIDUNGEN_FRAGEBOGEN.md gehen dem Konzept vor.
//
// Diese Datei ist die EINE Stelle für Typen, Bestandsnamen, Grenzen und die Form der Schnittstellen — die Pakete 1 (Kern),
// 2 (Oberfläche), 3 (Skills/Läufe/Als Nächstes) und 5 (Medien) bauen parallel dagegen. Regeln:
//   • nur ADDITIV ändern (neue optionale Felder, neue Union-Glieder) — nie umbenennen, nie ein Feld zur Pflicht machen;
//   • rein und client-sicher: nur Typ-Importe, keine Server-Module, keine Logik außer Namens-Funktionen und Konstanten;
//   • nichts Persönliches (Plattform-Regel): keine Namen, keine Firmen, kein fester Speichername — Personen sind Speichernamen
//     aus der Sitzung, Gesellschaften kommen aus lib/einheiten.ts bzw. dem Register.

import type { KiKategorie } from '@/lib/datenschutz/ki-einstellungen';
import type { KiKennzeichen } from '@/lib/datenschutz/ki-kennzeichnung';
import type { ModelTier } from '@/lib/make-one/agents-data';
import type { LEUCHT } from '@/lib/make-one/design';

export type { KiKategorie, ModelTier };

// ── Grundbegriffe ────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Bereich eines Heads (C1): Business gehört dem Haushalt, Privat der Person (bzw. dem Haushalt bei Familie). */
export type Bereich = 'business' | 'privat';
/**
 * Wem Einstellungen, Skills und eigene Mitarbeiter eines Heads gehören: `haushalt` (alle Business-Heads, Familie) oder `person`
 * (Privat-Heads „je Person getrennt“, Antwort 3). Threads gehören IMMER der Person (`agenten-faeden--<person>`).
 */
export type Ebene = 'haushalt' | 'person';
/** Farbe eines Heads = Name eines Tokens aus `LEUCHT` (lib/make-one/design.ts) — nie ein Farbwert im Katalog. */
export type FarbToken = keyof typeof LEUCHT;
/** Eigener Ton je Head (Antwort 10). Der Satz für den Prompt steht in `TON_SATZ`. */
export type Ton = 'sachlich' | 'knapp' | 'warm' | 'ermutigend' | 'sorgfaeltig';
export const TON_SATZ: Readonly<Record<Ton, string>> = {
  sachlich: 'Antworte sachlich und klar, ohne Ausschmückung.',
  knapp: 'Antworte knapp: erst das Ergebnis, dann höchstens drei Punkte.',
  warm: 'Antworte freundlich und zugewandt, aber ohne Floskeln.',
  ermutigend: 'Antworte ermutigend und ruhig, nie belehrend, ohne Druck.',
  sorgfaeltig: 'Antworte sorgfältig: Zahlen und Fristen mit Quelle, Annahmen offen benannt.',
};
/** Denktiefe — dieselben Werte wie `AskOptions.effort` (lib/anthropic.ts). */
export type Aufwand = 'low' | 'medium' | 'high';
/**
 * Modell-Anbieter (Antwort 14: „Andere KI für andere Sachen anbinden — z. B. Gemini für Research …“). NUR ein Feld: Das
 * Anbieter-Tor (Schnittstellen, KI-Tor, AVV) kommt später — bis dahin läuft alles über `askText` (Anthropic). Ein anderer
 * Wert als 'anthropic' wird heute NICHT ausgeführt (Paket 1 lehnt ab bzw. fällt auf Anthropic zurück, mit Hinweis).
 */
export type Anbieter = 'anthropic' | 'google' | 'openai' | 'mistral';
/** Welcher Datenpaket-Bauer den Kontext eines Heads liefert (C3). `hoi` = Lagebild aus Zählern (lib/hoi, ohne Personen). */
export type KontextArt = 'heads' | 'finanzchef' | 'hoi' | 'brain';
/** Ohne Voraussetzung erscheint der Head nicht (Liste) bzw. antwortet 403 (direkt) — auf dem SERVER (C5). */
export type Voraussetzung = 'gesundheit-ki' | 'privat-finanzen' | 'modul:markttraktion';
/** Autonomie-Stufe je Head (Antwort 12). Nach außen geht NIE etwas ohne Klick; `intern` = interne Kleinigkeiten selbst (lib/heads/autonomie.ts). */
export type AutonomieStufe = 'vorschlag' | 'intern';

// ── Katalog (Daten im Code: lib/agenten/katalog.ts) ──────────────────────────────────────────────────────────────────────

/** Verweis auf eine Kennzahl eines vorhandenen Index-Registers (Head-Kopf: „3 Kennzahlen“, Antwort 10). */
export type KennzahlIndex = 'business' | 'traktion' | 'privat' | 'gesundheit';
export interface KennzahlBezug { index: KennzahlIndex; id: string }

/** Grundausstattung eines Heads (Antwort 4: „feste Grundausstattung (Vorlagen)“). Eigene Mitarbeiter: `Mitarbeiter` unten. */
export interface MitarbeiterVorlage {
  /** Kebab, im ganzen Katalog eindeutig (`<head>-<rolle>`) — dieselbe Kennung trägt der Laufzeit-Mitarbeiter. */
  id: string;
  /** Anzeige und Ansprache per @ im Head-Chat. */
  name: string;
  /** Ein Satz: was er tut. */
  rolle: string;
  /** Werkzeuge aus lib/zoe/register.ts — Teilmenge der Werkzeuge SEINES Heads (Wächter). Arbeitet er für einen Head aus `auchFuer`, gilt die Schnittmenge mit dessen Werkzeugen (Paket 1). */
  werkzeuge: readonly string[];
  /** Vorhandener Fach-Agent (lib/zoe/agenten.ts `AUSFUEHRBAR`), den er nutzen darf — kein Systemlauf. */
  agentId?: string;
  /** Modellstufe (C3: Mitarbeiter laufen standardmäßig „schnell“ oder „ausgewogen“). */
  stufe: ModelTier;
  /** Hilft auch diesen Heads (Antwort 4: „geteilt über mehrere Heads“) — nur Heads desselben Bereichs (Wächter). */
  auchFuer?: readonly string[];
  anbieter?: Anbieter;
  /** Offene Stelle für die Bau-Agenten (z. B. „Bilder brauchen einen Bild-Anbieter“). */
  offen?: string;
}

export interface HeadDef {
  /** Kebab, eindeutig. `sales`/`marketing`/`event` = dieselben Kennungen wie lib/heads (`HeadId`). */
  id: string;
  /** Anzeige („Head of Sales“). */
  name: string;
  /** Kurzname für Liste und @-Ansprache — im Katalog eindeutig. */
  kurz: string;
  /** Ein Satz: wofür der Head da ist. */
  auftrag: string;
  bereich: Bereich;
  ebene: Ebene;
  ton: Ton;
  farbe: FarbToken;
  /** KI-Tor-Kategorien (lib/datenschutz/ki-tor.ts) — jede Werkzeug-Kategorie muss hier stehen (Wächter). Business nie `gesundheit`. */
  kategorien: readonly KiKategorie[];
  /** Kategorien, die NUR mit Einwilligung (b) der Person dazukommen (heute: `gesundheit`, z. B. Ernährung) — Business nie. */
  kategorienMitEinwilligung?: readonly KiKategorie[];
  /** Gruppen aus lib/zoe/register.ts — genau die Gruppen seiner `werkzeuge` (Wächter). */
  werkzeugGruppen: readonly string[];
  /**
   * Werkzeuge aus lib/zoe/register.ts — bewusst ausgewählt, nicht die ganze Gruppe (Copilot-Grenze 30–40, B3). Zusammen mit den
   * `HEAD_WERKZEUGE` höchstens `GRENZEN.werkzeugeJeHead`. Die Stufe (frei/freigabe) kommt IMMER aus dem Register.
   */
  werkzeuge: readonly string[];
  kontext: KontextArt;
  /** Eingebaute Skills = die vorhandenen Modi (lib/heads/prompt.ts `MODI`, lib/finanzen/chef/prompt.ts `MODI`) — sichtbar, nicht änderbar. */
  eingebaut?: { quelle: 'heads' | 'finanzchef'; modi: readonly string[] };
  voraussetzung?: Voraussetzung;
  /** 0–5 Kennzahlen für den Kopf des Heads. Gesundheits-Kennzahlen nur bei Heads mit Kategorie `gesundheit`. */
  kennzahlen: readonly KennzahlBezug[];
  /** Vorgaben — je Haushalt bzw. Person überschreibbar (`HeadEinstellung`). */
  stufe: ModelTier;
  aufwand: Aufwand;
  /** Fester Hinweis (z. B. „Hinweis, keine Rechtsberatung.“) — Kopf UND Prompt. */
  hinweis?: string;
  mitarbeiter: readonly MitarbeiterVorlage[];
  offen?: string;
}

/**
 * Werkzeuge, die es nur im Agenten-Bereich gibt (nicht im ZOE-Register) — Namen hier, damit Paket 1 (baut sie) und Paket 3
 * (Stapel-Arten, Skills) dasselbe meinen. Sie zählen in die Grenze `werkzeugeJeHead`. Wirkung nur über den Stapel bzw. die
 * Warteschlange — nie direkt.
 */
export const HEAD_WERKZEUGE = ['skill_laden', 'an_mitarbeiter', 'merksatz_vorschlagen', 'skill_vorschlagen', 'mitarbeiter_vorschlagen'] as const;
/** Mitarbeiter delegieren nicht weiter (Tiefe ≤ 2, C1) — sie laden nur Skills und schlagen Merksätze vor. */
export const MITARBEITER_WERKZEUGE = ['skill_laden', 'merksatz_vorschlagen'] as const;
export type AgentenWerkzeug = typeof HEAD_WERKZEUGE[number];

// ── Wer spricht: ZOE, Head, Mitarbeiter ──────────────────────────────────────────────────────────────────────────────────

/**
 * Der Agent eines Threads. Ein Mitarbeiter, der über `auchFuer` einem anderen Head hilft, trägt DESSEN `headId` — Daten,
 * Kategorien und Werkzeuge sind dann die dieses Heads (Schnittmenge, Paket 1).
 */
export type AgentRef =
  | { art: 'zoe' }
  | { art: 'head'; headId: string }
  | { art: 'mitarbeiter'; headId: string; mitarbeiterId: string };
/** Schlüssel eines Agenten als Text (Gedächtnis, `Nachricht.von`): `zoe` · `head:<id>` · `mitarbeiter:<head>:<id>`. */
export const agentSchluessel = (a: AgentRef): string =>
  a.art === 'zoe' ? 'zoe' : a.art === 'head' ? `head:${a.headId}` : `mitarbeiter:${a.headId}:${a.mitarbeiterId}`;

/** Wessen Daten ein Aufruf betrifft — Person aus der SITZUNG (bzw. dem Auftrag), Haushalt über `haushaltVon`; nie geraten. */
export interface Umfang { person: string; haushalt: string | null }

// ── Threads (Bestand `agenten-faeden--<person>`, Paket 1) ────────────────────────────────────────────────────────────────

export type FadenStatus = 'offen' | 'wartet' | 'laeuft' | 'fertig' | 'fehler' | 'abgebrochen';

export interface Anhang {
  art: 'medium' | 'datei';
  /** `md-…` (Medien, Paket 5) bzw. `d-…` (Aufgaben-Ablage) — nie ein Pfad, nie eine Adresse. */
  id: string;
  name?: string;
}

export interface Nachricht {
  /** `nr-<uuid>` (neueKennung). */
  id: string;
  rolle: 'person' | 'agent' | 'system';
  /** person → Speichername · agent → `agentSchluessel` · system → 'system'. */
  von: string;
  /** ≤ `GRENZEN.nachrichtZeichen` — darüber 413, nie gekürzt. */
  text: string;
  zeit: string;
  werkzeuge?: { name: string; ok: boolean; gestapelt?: boolean; vorschlagId?: string }[];
  /** „An Thread … gesendet ›“ bzw. „◂ Bericht aus Thread …“ (C3). */
  verweis?: { art: 'gesendet' | 'bericht'; fadenId: string; titel?: string };
  /** Dateien/Bilder in den Chat (Antwort 10). */
  anhaenge?: Anhang[];
  /** KI-VO Art. 50: Text ist von einem KI-System erzeugt (Oberfläche: `<KiMarke />`). */
  ki?: true;
  /** Gemessene Kosten dieser Antwort in US-CENT (wie `ki-verbrauch`) — angezeigt und verglichen nur über `inEuroCent` (lib/ki/kosten.ts). */
  kosten?: { cent: number };
  /**
   * Daumen der Besitzerin (Paket 4b, Aktion `bewerten` der Thread-Route) — an Agenten-Antworten und Berichten. Nur Metadaten:
   * Wert, Zeit, optional ein Grund aus `ABLEHNGRUENDE` der Heads (nie Freitext). Fließt in die Leistung des Heads (lib/agenten/leistung.ts).
   */
  daumen?: Daumen;
}

/** Daumen je Antwort (Fragerunde 17). */
export interface Daumen { wert: 'hoch' | 'runter'; am: string; grund?: string }

/** Fortschritt eines Hintergrund-Laufs in Schritten (Antwort 8). */
export interface LaufSchritt {
  id: string;
  titel: string;
  status: 'offen' | 'laeuft' | 'fertig' | 'fehler' | 'uebersprungen';
  start?: string;
  ende?: string;
}
export type LaufStatus = 'wartet' | 'laeuft' | 'fertig' | 'fehler' | 'abgebrochen';
/** Zustand des (letzten) Hintergrund-Laufs eines Threads — am Thread gespeichert, Lesemodell `Lauf` daraus. */
export interface LaufZustand {
  /** Kennung des Auftrags in `zoe-auftraege` (Warteschlange) — kein zweiter Hintergrund-Mechanismus (C7). */
  auftragId?: string;
  status: LaufStatus;
  schritte: LaufSchritt[];
  start: string;
  ende?: string;
  /**
   * Gemessene Kosten des Laufs in US-CENT (die Schleife misst wie `ki-verbrauch`). Einheiten seit dem Feinschliff 09.10. ausdrücklich:
   * Grenzen/Budgets sind Euro-Cent — umgerechnet NUR über lib/ki/kosten.ts (`inEuroCent` / `inUsdCent`, Kurs der Instanz).
   */
  kostenCent: number;
  /** Kostengrenze je Aufgabe (Antwort 8) in EURO-Cent — erreicht → Lauf hält an, Status `fehler` mit Grund. */
  kostenGrenzeCent?: number;
  fehler?: string;
  /** Wer abgebrochen hat (Speichername aus der Sitzung). */
  abgebrochenVon?: string;
  /**
   * Worauf ein Lauf mit Status `wartet` wartet (Paket 4b, additiv): `business-frei` = der Takt holt ihn nach dem Ende des Rahmens
   * EINMAL nach (lib/agenten/zeitplan.ts `businessFreiNachholen`); `not-aus` = erst nach dem Lösen und von Hand. Fehlt das Feld,
   * erkennt der Takt „Business-frei“ zusätzlich am Grund (`fehler`), den der Kern schreibt.
   */
  wartetAuf?: 'business-frei' | 'not-aus' | 'plan';
}

/**
 * Nur eingereiht (Rundgang 09.10. „Agenten live“): der Lauf steht in der Warteschlange und hat noch nicht begonnen — kein Grund, keine Schritte,
 * kein „wartet auf …“. Der Thread trägt dann den Status `wartet`, braucht aber NIEMANDEN: vorher stand jeder frisch beauftragte Mitarbeiter als
 * „⚑ … fragt“ mit Antwortfeld unter „Wartet auf dich“, bis der Arbeiter ihn nahm. Rein.
 */
export const laufEingereiht = (f: { status: FadenStatus; lauf?: Pick<LaufZustand, 'status' | 'fehler' | 'wartetAuf' | 'schritte'> }): boolean =>
  f.status === 'wartet' && !!f.lauf && f.lauf.status === 'wartet' && !f.lauf.fehler && !f.lauf.wartetAuf && !(f.lauf.schritte?.length);

// ── Arbeitsstand, Aufträge an Mitarbeiter, Plan-Freigabe (Paket 1 in faeden.ts erweitert; seit Paket 4b im Vertrag) ────────

/** Auftrag an einen Mitarbeiter (R10): Ziel, Format, Grenzen, Quellen — Pflicht, vom Werkzeug-Schema erzwungen. */
export interface AuftragKarte { ziel: string; format: string; grenzen: string; quellen: string }

/** Ein Eintrag im gemeinsamen Arbeitsstand („Brett“) eines Auftrags — Herkunft und Fremdtext-Marke immer dabei (R9). */
export interface BrettEintrag {
  id: string;
  art: 'aufgabe' | 'fund' | 'frage' | 'antwort' | 'entscheidung';
  text: string;
  /** `agentSchluessel` bzw. Speichername (Mensch im Head-Chat). */
  von: string;
  /** Aus welchem Thread. */
  fadenId: string;
  fremd: boolean;
  am: string;
  /** Bei `antwort`: auf welche Frage. Bei `frage`: offen/beantwortet. */
  frageId?: string;
  status?: 'offen' | 'beantwortet';
  /** Fingerabdruck der Frage — dieselbe Frage wird nicht zweimal gestellt (R3). */
  abdruck?: string;
}
/** Brett je Auftrag im Thread des Heads (Entscheidung, Fragerunde Teil 1 Nr. 9). `schreiber` = der EINE Thread, der Wirkung vorschlagen darf. */
export interface Brett { id: string; ziel: string; schreiber: string; fadenIds: string[]; eintraege: BrettEintrag[]; erstellt: string }

/** Plan-Freigabe vor großen Aufträgen (R14): mehr als 2 Mitarbeiter in einem Zug oder Schätzung über der Schwelle. */
export interface PlanFreigabe {
  id: string;
  status: 'offen' | 'freigegeben' | 'abgelehnt';
  grund: string;
  auftraege: { mitarbeiterId: string; auftrag: AuftragKarte }[];
  schaetzungCent?: number;
  am: string;
  entschiedenAm?: string;
  /** Nur aus der Sitzung — nie aus einer Agenten-Nachricht. */
  entschiedenVon?: string;
}

export interface Faden {
  /** `fd-<uuid>` (neueKennung). */
  id: string;
  /** Speichername — Threads gehören immer der Person (Antwort 13), auch Business-Threads. */
  besitzer: string;
  agent: AgentRef;
  /** Bereich des Agenten beim Anlegen (ZOE: der Bereich der Wahl, sonst der des Heads) — für den Filter auf dem Server. */
  bereich: Bereich;
  /** Eltern-Thread (Delegation „gesendet aus …“). */
  elternId?: string;
  titel: string;
  status: FadenStatus;
  /** Ab dem ersten fremden Text gilt „nur Vorschlag“ (lib/zoe/gespraech-schutz.ts) — steht am Thread auf dem SERVER, nie vom Browser. */
  fremdGelesen: boolean;
  vertraulich: boolean;
  nachrichten: Nachricht[];
  /** Auf dem Server gerechnete Kurzfassung älterer Züge (Prompt = letzte `promptNachrichten` + diese). */
  kurzfassung?: string;
  lauf?: LaufZustand;
  /** Woher der Thread kam (Skill-Lauf, geplante Hintergrundaufgabe). */
  skillId?: string;
  planId?: string;
  erstellt: string;
  aktualisiert: string;
  // Seit Paket 4b im Vertrag (Paket 1 hatte sie lokal in faeden.ts — alle optional, Bedeutung unverändert):
  /** Per Knopf geteilt (nur Business): das Team liest mit. */
  geteilt?: { am: string; von: string } | null;
  /** Head-Thread: Bretter (Arbeitsstand) je Auftrag. */
  bretter?: Brett[];
  /** Offene und entschiedene Plan-Freigaben (Head-Thread) — auch als Stapel-Art `plan` (lib/agenten/plan-stapel.ts). */
  plaene?: PlanFreigabe[];
  /** Agenten-Kette von oben nach unten — kein Agent zweimal (R3). */
  kette?: string[];
  /** Löschfrist in Monaten nach der letzten Nachricht — ohne Angabe die Vorgabe (12). */
  loeschfristMonate?: number;
}

/** Bestand `agenten-faeden--<person>`. */
export interface FadenBestand { v: 1; faeden: Faden[] }

// ── Werkstatt: Skills, eigene Mitarbeiter, Gedächtnis (Bestände `agenten-skills--<haushalt>` / `agenten-skills-privat--<person>`, Paket 3) ─

export type Rhythmus = 'taeglich' | 'werktags' | 'woechentlich' | 'monatlich';
/** Ereignisse, die einen Skill auslösen (Antwort 7). Neue Ereignisse additiv; ausgelöst wird nur, was Paket 3 anbindet. */
export type SkillEreignis = 'neue-mail' | 'neuer-lead' | 'zahlungseingang' | 'neue-aufgabe' | 'termin-vorbei' | 'frist-naht' | 'neues-medium';
export type SkillAusloeser =
  | { art: 'hand' }
  | { art: 'zeitplan'; rhythmus: Rhythmus; /** „HH:MM“ Berliner Zeit */ uhrzeit: string; /** 1 = Montag … 7 = Sonntag (woechentlich) bzw. Monatstag (monatlich) */ tage?: number[] }
  | { art: 'ereignis'; ereignis: SkillEreignis; /** Bedingung als Satz (z. B. „nur Leads aus Events“) — Daten, keine Anweisung */ filter?: string };
export interface SkillEingabeFeld {
  /** Kebab, eindeutig im Skill. */
  id: string;
  label: string;
  art: 'text' | 'zahl' | 'datum' | 'auswahl' | 'kontakt' | 'firma';
  pflicht?: boolean;
  optionen?: string[];
}
export interface SkillTest { eingabe: string; erwartet: string[] }
export interface SkillBeispiel { eingabe: string; ergebnis: string }
/** Erfolgsquote (Antwort 7) — Zähler, vom Server gepflegt. */
export interface SkillErfolg { laeufe: number; angenommen: number; abgelehnt: number; fehler: number; zuletzt?: string }
/** Letzter Testlauf vor dem Einschalten (Antwort 7) — ohne Wirkung, alles nur Vorschau. */
export interface SkillTestlauf { am: string; von: string; ok: boolean; ergebnisse: { test: number; ok: boolean; notiz?: string }[] }

export interface Skill {
  /** `sk-<uuid>`. */
  id: string;
  headId: string;
  mitarbeiterId?: string;
  /** ≤ `GRENZEN.skillName`, nur [a-z0-9-] (wie SKILL.md). */
  name: string;
  /** Was und wann, dritte Person — ≤ `GRENZEN.skillBeschreibung`. Steht IMMER im Prompt (schrittweise Offenlegung). */
  beschreibung: string;
  /** Die Anleitung — nur bei Bedarf geladen (`skill_laden`). ≤ `GRENZEN.skillAnleitung`, sonst 413. */
  anleitung: string;
  beispiele?: SkillBeispiel[];
  /** ⊆ Werkzeuge des Heads (bzw. des Mitarbeiters) — ein Skill lockert NIE eine Stufe (C5). */
  werkzeuge: string[];
  ausloeser: SkillAusloeser;
  eingabeFelder: SkillEingabeFeld[];
  /** true = jede Wirkung als Vorschlag in den Stapel, auch wenn das Werkzeug frei wäre (verschärft nur). */
  freigabePflicht: boolean;
  ergebnis: 'faden' | 'stapel';
  stufe: ModelTier;
  aufwand?: Aufwand;
  kostenGrenzeCent?: number;
  /** ≥ `GRENZEN.skillTestsMin` zum Aktivieren. */
  tests: SkillTest[];
  testlauf?: SkillTestlauf;
  erfolg: SkillErfolg;
  aktiv: boolean;
  version: number;
  /** hand · vorschlag (Agent → Stapel-Art `skill`, aktiv erst nach Klick) · gespraech („Das als Skill speichern“) · import (SKILL.md). */
  quelle: 'hand' | 'vorschlag' | 'gespraech' | 'import';
  angelegtVon: string;
  freigegebenVon?: string;
  geaendertAm?: string;
  /**
   * Nahtstellen-Prüfung 09.10. (Punkt 8): Inhalt entstand (auch) aus fremd gelesenem Text — Vorschlag eines Agenten in einem Thread mit Text
   * Dritter oder „Als Skill speichern“ aus so einem Thread. Setzt NUR der Server; der Prompt kapselt Anleitung/Rolle/Beschreibung dann mit
   * `fremd()` und nennt sie nie „von einem Menschen geschrieben“, ein Lauf damit gilt als „fremd gelesen“. Bleibt auch nach Änderungen stehen.
   */
  ausFremdemText?: true;
}
/** Was immer im Prompt steht (Name + Beschreibung) und was Listen zeigen. Eingebaute Skills: `id` = `eingebaut:<quelle>:<modus>`. */
export interface SkillKurz {
  id: string;
  headId: string;
  mitarbeiterId?: string;
  name: string;
  beschreibung: string;
  ausloeser: SkillAusloeser;
  aktiv: boolean;
  eingebaut?: true;
  erfolg?: SkillErfolg;
  /** Aus fremd gelesenem Text entstanden (siehe `Skill.ausFremdemText`) — die Beschreibung steht im Prompt gekapselt. */
  ausFremdemText?: true;
}

/** Ein Merksatz im Gedächtnis eines Heads oder Mitarbeiters (Antwort 4/10) — kurze Regel, immer im Prompt. */
export interface Merksatz {
  /** `ms-<uuid>`. */
  id: string;
  text: string;
  am: string;
  /** Speichername (von Hand) bzw. `agentSchluessel` (Vorschlag). */
  von: string;
  quelle: 'hand' | 'vorschlag';
  /** Bei `vorschlag`: wer per Klick freigegeben hat (Sitzung). */
  freigegebenVon?: string;
}

/** Laufzeit-Mitarbeiter: Vorlage (gleiche Kennung) mit Überschreibungen ODER eigener Mitarbeiter (`ma-<uuid>`, Antwort 4). */
export interface Mitarbeiter {
  id: string;
  /** Heimat-Head. */
  headId: string;
  vorlageId?: string;
  name: string;
  rolle: string;
  /** Eigene Anleitung (selbst angelegte Mitarbeiter) — Anweisung, also nur von Menschen bzw. per Klick freigegeben. */
  anleitung?: string;
  werkzeuge: string[];
  auchFuer: string[];
  agentId?: string;
  stufe: ModelTier;
  aufwand?: Aufwand;
  anbieter?: Anbieter;
  aktiv: boolean;
  /** Eigenes Gedächtnis (Antwort 4). */
  gedaechtnis: Merksatz[];
  quelle: 'vorlage' | 'hand' | 'vorschlag';
  angelegtVon?: string;
  freigegebenVon?: string;
  /**
   * Nahtstellen-Prüfung 09.10. (Punkt 8): Inhalt entstand (auch) aus fremd gelesenem Text — Vorschlag eines Agenten in einem Thread mit Text
   * Dritter oder „Als Skill speichern“ aus so einem Thread. Setzt NUR der Server; der Prompt kapselt Anleitung/Rolle/Beschreibung dann mit
   * `fremd()` und nennt sie nie „von einem Menschen geschrieben“, ein Lauf damit gilt als „fremd gelesen“. Bleibt auch nach Änderungen stehen.
   */
  ausFremdemText?: true;
}

/**
 * Bestand `agenten-skills--<haushalt>` (Heads der Ebene Haushalt) bzw. `agenten-skills-privat--<person>` (Ebene Person).
 * `mitarbeiter` enthält nur EIGENE und GEÄNDERTE (eine Vorlage ohne Änderung wird nie gespeichert — wie „Standard“ bei Flächen).
 */
export interface WerkstattBestand {
  v: 1;
  skills: Skill[];
  mitarbeiter: Mitarbeiter[];
  /** Gedächtnis der Heads (Schlüssel = headId). Das der Mitarbeiter steht am Mitarbeiter. */
  gedaechtnis: Partial<Record<string, Merksatz[]>>;
}

// ── Einstellungen je Head (Bestand `agenten-einstellung--<haushalt>`; lesen Paket 3, schreiben Paket 4) ──────────────────

export interface HeadEinstellung {
  aktiv?: boolean;
  stufe?: ModelTier;
  aufwand?: Aufwand;
  anbieter?: Anbieter;
  /** Monatsgrenze in Cent (Antwort 12/14) — erreicht: Warnung, dann nur Regelwerk bzw. „pausiert“. Ohne = nur anzeigen. */
  budgetCentMonat?: number;
  autonomie?: AutonomieStufe;
  /** Zuständige Person (Speichername) — z. B. Beauftragte für Gesundheit (C10 Frage 10). Nie im Code, nur hier. */
  zustaendig?: string;
  /** Mitarbeiter-Kennungen, die aus sind. */
  mitarbeiterAus?: string[];
  /** Not-Aus je Head (Paket 4b): Läufe dieses Heads halten an, der Takt reiht nichts ein; Chats bleiben möglich. */
  notAus?: { seit: string; von: string };
  /** Foto-Avatar (Paket 4b): Kennung eines Bilds aus „Medien unterwegs“ (`md-…`) — gezeigt nur, wer das Medium sieht. Kein Upload-Zwang. */
  foto?: string;
  /** Letzte Änderung (vom Server gestempelt). */
  geaendertAm?: string;
  geaendertVon?: string;
}
export interface AgentenEinstellung {
  v: 1;
  /** Not-Aus (Antwort 6/12): alle Agenten-Läufe des Haushalts halten an — der Chat zeigt einen ruhigen Hinweis. */
  notAus?: { seit: string; von: string };
  heads: Partial<Record<string, HeadEinstellung>>;
  /**
   * Paket 4b: Einstellungen der Privat-Heads der Ebene Person — je Person (Schlüssel = Speichername). Nur sie selbst liest und schreibt
   * sie (serverseitig gefiltert, nie in einer fremden Antwort). Wirksam gelesen über `einstellungFuer(haushalt, person)`.
   */
  personen?: Partial<Record<string, { heads: Partial<Record<string, HeadEinstellung>> }>>;
  geaendertAm?: string;
  geaendertVon?: string;
}

/** Welche Felder `POST /api/agenten { aktion: 'einstellung' }` je Head setzt (`null` = zurück auf die Vorgabe). Paket 4b. */
export const EINSTELLUNG_FELDER = ['aktiv', 'stufe', 'aufwand', 'budgetCentMonat', 'autonomie', 'zustaendig', 'foto', 'mitarbeiterAus'] as const;
export type EinstellungFeld = typeof EINSTELLUNG_FELDER[number];

/** Was die Seite je Head über seine Einstellungen erfährt (GET /api/agenten, Paket 4b) — nur für Heads, die die Person sieht. */
export interface HeadEinstellungSicht {
  /** Wirksam (gesetzt, sonst Vorgabe des Katalogs bzw. der Boden der Autonomie). */
  stufe: ModelTier;
  aufwand: Aufwand;
  autonomie: AutonomieStufe;
  vorgabe: { stufe: ModelTier; aufwand: Aufwand; autonomie: AutonomieStufe };
  /** Modell hinter jeder Stufe (aus lib/ki/modelle.ts, Name) — zum Wählen. */
  modelle: Record<ModelTier, string>;
  /** Monatsgrenze des Heads in Euro-Cent (null = nur messen). */
  budgetCentMonat: number | null;
  /** Kosten in diesem Monat (Euro-Cent): Haushalts-Heads aus der Kostenmessung, Privat-Heads nur aus den EIGENEN Threads. */
  kostenCentMonat: number;
  zustaendig: string | null;
  notAus: { seit: string } | null;
  foto: string | null;
  /** Darf die Person diese Einstellungen ändern? (Serverregel — die Seite zeigt sonst nur an.) */
  aendern: boolean;
  /** Stand dieses Heads (409 bei veraltetem Stand). */
  stand: string;
}

/** Instanz-Budget für den Kopf-Balken (Paket 4b, aus lib/ki/tor.ts). */
export interface BudgetTeil { verbrauchtCent: number; grenzeCent: number | null; prozent: number | null; stufe: 0 | 80 | 95 | 100; text: string }
export interface BudgetAnzeige {
  /** Grenze je Kalendermonat (Berlin). Ohne Grenze: nur gemessen. */
  monat: BudgetTeil;
  /** Gesamt-Grenze ab `ab` (z. B. ein Test-Budget) — fehlt ohne Grenze. */
  gesamt?: BudgetTeil & { ab: string };
  /** Die strengere Stufe von beiden. */
  stufe: 0 | 80 | 95 | 100;
  /** Darf die Person die Grenzen setzen (nur der Inhaber)? */
  setzen: boolean;
}

/** POST /api/agenten (Paket 4b). */
export type EinstellungAnfrage =
  | { aktion: 'einstellung'; headId: string; teil: Partial<Record<EinstellungFeld, unknown>>; stand: string }
  | { aktion: 'not-aus'; an: boolean; headId?: string };
export const EINSTELLUNG_VORGABE: AgentenEinstellung = { v: 1, heads: {} };

// ── Hintergrundaufgaben (Bestand `agenten-plan--<person>`, Paket 3) und Warteschlange ──────────────────────────────────

export type Zeitplan =
  | { art: 'einmalig'; /** Berliner Wandzeit `YYYY-MM-DDTHH:mm:ss` */ wann: string }
  | { art: 'wiederkehrend'; rhythmus: Rhythmus; uhrzeit: string; tage?: number[] };
/** „+ Hintergrundaufgabe“ geplant oder wiederkehrend (Antwort 6/8). „Jetzt“ legt direkt einen Thread an (POST /api/agenten/faden). */
export interface Hintergrundaufgabe {
  /** `hg-<uuid>`. */
  id: string;
  besitzer: string;
  agent: AgentRef;
  titel: string;
  /** Auftrag (Ziel, Format, Grenzen, Quellen — C3) ≤ `GRENZEN.auftragZeichen`. */
  auftrag: string;
  zeitplan: Zeitplan;
  kostenGrenzeCent?: number;
  aktiv: boolean;
  erstellt: string;
  letzterLauf?: string;
}
export interface PlanBestand { v: 1; aufgaben: Hintergrundaufgabe[] }

/** Name des Laufs in der Warteschlange (`zoe-auftraege`, art `agent`) — EIN Weg für alle Agenten-Läufe → POST /api/agenten/faden/lauf. */
export const LAUF_AGENT = 'faden';
/**
 * Was ein Auftrag `LAUF_AGENT` trägt. Eingereiht als `reihe([{ art: 'agent', name: LAUF_AGENT, auftrag: JSON.stringify(x), eingabe: x,
 * person, anlass }])` — der Arbeiter reicht einem Agenten nur `auftrag` (Text) weiter (app/api/zoe/auftraege/lauf), `eingabe` macht den
 * Schlüssel eindeutig. `anlass` beginnt mit „Takt:“, wenn der Takt einreiht (dann ruht der Lauf bei ausgeschalteter Hintergrund-KI).
 * Der Lauf legt den Thread selbst an, wo keiner ist, und prüft, dass Thread/Skill/Plan der Person gehören — ZOE kann `faden` über
 * `run_agent` sehen, ein freier Text wird abgelehnt (Paket 1). Person = `Auftrag.person`, nie ein Systemlauf.
 */
export type LaufAuftrag =
  | { art: 'faden'; fadenId: string }
  | { art: 'skill'; skillId: string; headId: string; ausloeser: 'hand' | 'zeitplan' | 'ereignis'; eingaben?: Record<string, string>; ereignisId?: string }
  | { art: 'plan'; planId: string };

/** Lesemodell „Läuft / Fertig / Fehler“ (Antwort 8) — nie gespeichert, aus Warteschlange, Threads, Head- und Finanzchef-Berichten, Takt. */
export type LaufQuelle = 'auftrag' | 'faden' | 'head' | 'finanzchef' | 'skill' | 'plan' | 'takt';
export interface Lauf {
  id: string;
  quelle: LaufQuelle;
  art: 'einmalig' | 'geplant' | 'wiederkehrend';
  titel: string;
  headId?: string;
  mitarbeiterId?: string;
  status: LaufStatus;
  start: string;
  ende?: string;
  dauerMs?: number;
  schritte?: { gesamt: number; fertig: number; aktuell?: string };
  /** Beides EURO-Cent (das Lesemodell rechnet die gemessenen US-Cent des Threads um, lib/agenten/laeufe.ts). */
  kosten?: { cent: number; grenzeCent?: number };
  /** Über `WEG` gebaut, nie von Hand. */
  link: string;
  fadenId?: string;
  /** Was die Person damit tun darf (nur eigene Läufe). */
  aktionen: ('abbrechen' | 'neu-starten')[];
}

/** „Als Nächstes“ (Antwort 9): geplante Läufe mit Uhrzeit, offene Freigaben, Fristen — nach Eisenhower sortiert. */
export type NaechstesArt = 'zeitplan' | 'skill' | 'plan' | 'frist' | 'freigabe' | 'zoe-aufgabe' | 'termin';
/** q1 wichtig + dringend · q2 wichtig · q3 dringend · q4 weder noch. */
export type Eisenhower = 'q1' | 'q2' | 'q3' | 'q4';
export const EISENHOWER_REIHE: readonly Eisenhower[] = ['q1', 'q2', 'q3', 'q4'];
export interface Naechstes {
  id: string;
  art: NaechstesArt;
  titel: string;
  /** ISO-Zeit bzw. Berliner Tag. */
  wann: string;
  headId?: string;
  link: string;
  wichtig: boolean;
  dringend: boolean;
  quadrant: Eisenhower;
  /** Kritisch pulsiert (Leitbild). */
  kritisch?: boolean;
  /** Freigaben als EINE Zeile mit Zahl (C2). */
  anzahl?: number;
  /**
   * Serie eines wiederkehrenden Laufs (Zeitplan, Skill, Hintergrundaufgabe; Rundgang 09.10.) — dieselbe Kennung an jedem Vorkommen.
   * Die Antwort von GET /api/agenten/laeufe zeigt je Serie nur das NÄCHSTE Vorkommen (`naechstesVerdichten`, lib/agenten/naechstes.ts).
   */
  serie?: string;
  /** Nur am verdichteten Eintrag: so viele Vorkommen folgen im Zeitraum noch … */
  weitere?: number;
  /** … das letzte davon (ISO-Zeit bzw. Berliner Tag) … */
  bis?: string;
  /** … und ihr Takt, wenn er sich erkennen lässt: an jedem Tag bzw. an jedem Werktag genau eins. */
  wiederholt?: 'taeglich' | 'werktags';
}

// ── Stapel-Arten des Agenten-Bereichs (lib/zoe/stapel.ts `StapelArt`; Freigabe baut Paket 3 in stapel-arten.ts) ────────

/** Vorschläge von Agenten, die erst ein Klick wirksam macht: neuer Skill, neuer Mitarbeiter, Merksatz (C5). */
export type AgentenStapelArt = 'skill' | 'mitarbeiter' | 'merksatz' | 'plan';
/** `plan` (Paket 4b): Plan-Freigabe vor großen Aufträgen auch über den Stapel — Bezug `<fadenId>:<planId>` (lib/agenten/plan-stapel.ts). */
export const AGENTEN_STAPEL_ARTEN: readonly AgentenStapelArt[] = ['skill', 'mitarbeiter', 'merksatz', 'plan'];

// ── Medien unterwegs (Bestände `medien--<haushalt>` / `medien-privat--<person>`, Paket 5) — ENTWURF, Richtungsfragen offen ─

/** Nachtrag 08.10. spät: Bilder/Videos über die Kamera, geordnet (z. B. über ein Event), Business oder Privat, Freigabe fürs Marketing, auf Wunsch an einen Head. */
export interface Medium {
  /** `md-<uuid>`. */
  id: string;
  art: 'bild' | 'video';
  bereich: Bereich;
  /** Wer aufgenommen/hochgeladen hat (Speichername). */
  von: string;
  aufgenommen?: string;
  hochgeladen: string;
  /** Inhaltstyp aus dem INHALT erkannt (nie aus der Endung). */
  typ: string;
  groesse: number;
  name?: string;
  /** Ordnung (Antwort: „z. B. über ein Event“). */
  bezug?: { art: 'event' | 'kontakt' | 'firma' | 'projekt' | 'aufgabe'; id: string };
  /** Freigabe für das Marketing — nur per Klick einer Person (Recht am Bild offen). */
  freigabe?: { marketing: boolean; am?: string; von?: string };
  /** An diese Heads zur Bearbeitung („das müssen wir auswählen können“). */
  anHeads?: string[];
  notiz?: string;
}
export interface MedienBestand { v: 1; medien: Medium[] }

// ── Bestandsnamen (EINE Stelle — der Datenschutz-Wächter löst diese Funktionen auf) ────────────────────────────────────

export const fadenBestand = (person: string) => `agenten-faeden--${person}`;
export const skillsHaushaltBestand = (haushalt: string) => `agenten-skills--${haushalt}`;
export const skillsPersonBestand = (person: string) => `agenten-skills-privat--${person}`;
export const planBestand = (person: string) => `agenten-plan--${person}`;
export const einstellungBestand = (haushalt: string) => `agenten-einstellung--${haushalt}`;
export const medienBestand = (haushalt: string) => `medien--${haushalt}`;
export const medienPrivatBestand = (person: string) => `medien-privat--${person}`;
/** Werkstatt eines Heads: Ebene `person` → Bestand der Person, sonst der des Haushalts (ohne Haushalt: keiner). */
export function werkstattBestandFuer(ebene: Ebene, u: Umfang): string | null {
  if (ebene === 'person') return skillsPersonBestand(u.person);
  return u.haushalt ? skillsHaushaltBestand(u.haushalt) : null;
}

// ── Grenzen (nie still kürzen: darüber 413 mit Text, CLAUDE.md „Nie abschneiden, ablehnen“) ─────────────────────────────

export const GRENZEN = {
  /** Werkzeuge je Head inkl. `HEAD_WERKZEUGE` (C6, B3). */
  werkzeugeJeHead: 20,
  nachrichtZeichen: 8_000,
  fadenNachrichten: 400,
  faedenJePerson: 2_000,
  /** Prompt = die letzten n Nachrichten + Kurzfassung (C4). */
  promptNachrichten: 16,
  headRunden: 3,
  mitarbeiterRunden: 6,
  mitarbeiterWerkzeugAufrufe: 14,
  /** Höchstens n offene Mitarbeiter-Läufe je Person (C3). */
  offeneLaeufeJePerson: 3,
  /** ZOE → Head → Mitarbeiter (C1). */
  tiefe: 2,
  skillName: 64,
  skillBeschreibung: 1_024,
  skillAnleitung: 20_000,
  skillTestsMin: 3,
  skillTestsMax: 20,
  skillEingabeFelder: 12,
  skillsJeHead: 50,
  mitarbeiterJeHead: 20,
  mitarbeiterAnleitung: 20_000,
  merksaetzeJeAgent: 100,
  merksatzZeichen: 300,
  planAufgabenJePerson: 100,
  auftragZeichen: 4_000,
  /** „Als Nächstes“ zeigt die nächsten n Tage (C2). */
  naechsteTage: 7,
} as const;

// ── Schnittstellen (Antworten der Routen; Fixture: tests/fixtures/agenten-api.ts) ──────────────────────────────────────

/** 403 der Agenten-Routen (über `eigenePerson`): nur die angemeldete Person selbst, nie der Dienstweg, kein Personen-Parameter. */
export const AGENTEN_NUR_SELBST = { ok: false, fehler: 'Den Agenten-Bereich sieht nur die angemeldete Person selbst — nie über den Dienstweg.' } as const;
/** 403 der Medien-Route (Paket 5). */
export const MEDIEN_NUR_SELBST = { ok: false, fehler: 'Medien lädt und sieht nur die angemeldete Person selbst — nie über den Dienstweg.' } as const;

export interface FadenKurz {
  id: string;
  titel: string;
  agent: AgentRef;
  status: FadenStatus;
  aktualisiert: string;
  elternId?: string;
  ungelesen?: boolean;
  /** `status: 'wartet'`, aber nur eingereiht (`laufEingereiht`) — wartet auf den Arbeiter, nicht auf die Person. */
  eingereiht?: boolean;
}
/**
 * Eine Kennzahl im Kopf eines Heads. `hinweis` (Rundgang 09.10.): warum der Index (noch) keinen Wert hat — der Satz der Lücke aus dem
 * gemeinsamen Kern (z. B. „erst ab 10 Entscheidungen (2 gewonnen · 1 verloren)“), damit der Kopf nie ein stummes „—“ zeigt.
 */
export interface KennzahlWert { id: string; label: string; wert: string | null; ampel?: 'gruen' | 'gelb' | 'rot' | 'grau'; hinweis?: string }
export type HeadGesperrt = 'aus' | 'not-aus' | 'budget' | 'business-frei' | 'einwilligung' | 'modul';
export interface HeadKarte {
  id: string;
  name: string;
  kurz: string;
  auftrag: string;
  bereich: Bereich;
  ebene: Ebene;
  farbe: FarbToken;
  hinweis?: string;
  aktiv: boolean;
  /** Warum der Head gerade nicht arbeitet (ruhiger Hinweis, kein Fehler). */
  gesperrt?: { grund: HeadGesperrt; text: string };
  kennzahlen: KennzahlWert[];
  mitarbeiter: { id: string; name: string; rolle: string; aktiv: boolean; auchFuer: string[]; /** hilft hier aus (Heimat woanders) */ aushilfe?: true }[];
  skills: SkillKurz[];
  zaehler: { freigaben: number; laufend: number; faeden: number };
  letzteFaeden: FadenKurz[];
  /** Foto-Avatar (Paket 4b) — eine eigene Route (`/api/medien/inhalt?…`), nur wenn die Person das Bild sieht; sonst das Kürzel. */
  foto?: string;
  /** Einstellungen des Heads (Paket 4b). */
  einstellung?: HeadEinstellungSicht;
}
export interface UeberblickZeile { id: string; text: string; zeit?: string; headId?: string; link?: string }
/** Überblick über dem ZOE-Chat (Antwort 1). „Nächste Tage“ kommen aus GET /api/agenten/laeufe (`naechstes`). */
export interface Ueberblick {
  /** Kurz-Briefing als Text von ZOE (KI — `ki` in der Antwort). */
  briefing?: string;
  /** Seit dem letzten Besuch. */
  seit?: string;
  passiert: UeberblickZeile[];
  inArbeit: UeberblickZeile[];
  freigaben: { anzahl: number; link: string };
  ziele: { id: string; titel: string; fortschritt: number | null; link: string }[];
}
/** GET /api/agenten (Paket 1) — nur, was die Person sehen darf. */
export interface AgentenAntwort {
  ok: true;
  zoe: { letzteFaeden: FadenKurz[] };
  heads: HeadKarte[];
  ueberblick: Ueberblick;
  notAus: boolean;
  ki?: KiKennzeichen;
  /** Paket 4b: Instanz-Budget (Kopf-Balken). */
  budget?: BudgetAnzeige;
  /** Paket 4b: darf die Person den Not-Aus für ALLE setzen bzw. lösen (volle Mitglieder)? */
  notAusAendern?: boolean;
  /** Paket 4b: wählbare zuständige Personen (Konten im Haushalt des Inhabers: Speichername + Anzeigename). */
  personen?: { id: string; name: string }[];
  /** Härtetest 09.10.: Kurs Euro je US-Dollar der Instanz (lib/ki/kosten.ts) — die Oberfläche rechnet gemessene US-Cent damit in Euro um. */
  kurs?: number;
}
/** GET /api/agenten/faden (Paket 1): `?id=` ein Thread, sonst Liste (`?agent=head:<id>` filtert). */
export interface FadenAntwort { ok: true; faden: Faden; stand: string; kinder: FadenKurz[] }
export interface FadenListeAntwort { ok: true; faeden: FadenKurz[] }
/** POST /api/agenten/faden (Paket 1). Wiederholbares anlegen trägt `anfrageId` (`einmalig`). */
export type FadenAnfrage =
  | { aktion: 'senden'; agent: AgentRef; text: string; fadenId?: string; stand?: string; anhaenge?: Anhang[]; anfrageId?: string; /** „+ Hintergrundaufgabe jetzt“: Thread + Lauf in der Warteschlange */ hintergrund?: boolean; kostenGrenzeCent?: number }
  | { aktion: 'umbenennen'; fadenId: string; titel: string; stand: string }
  | { aktion: 'gelesen'; fadenId: string }
  | { aktion: 'loeschen'; fadenId: string; stand: string }
  /** Paket 4b: Daumen an einer Agenten-Antwort bzw. einem Bericht (`null` nimmt ihn zurück); nur die Besitzerin des Threads. */
  | { aktion: 'bewerten'; fadenId: string; nachrichtId: string; wert: 'hoch' | 'runter' | null; grund?: string };
export interface FadenSendenAntwort { ok: true; faden: Faden; stand: string; antwort?: Nachricht; stapelOffen: number; lauf?: { auftragId: string }; ki?: KiKennzeichen }
/** GET /api/agenten/skills (Paket 3): `?head=<id>` (sonst alle sichtbaren), `?id=` ein Skill mit Anleitung. */
export interface SkillsAntwort { ok: true; skills: SkillKurz[]; mitarbeiter: Mitarbeiter[]; gedaechtnis?: Merksatz[] }
export interface SkillAntwort { ok: true; skill: Skill; stand: string }
/** POST /api/agenten/skills (Paket 3). */
export type SkillAnfrage =
  | { aktion: 'anlegen'; skill: Omit<Skill, 'id' | 'version' | 'erfolg' | 'aktiv' | 'angelegtVon' | 'freigegebenVon' | 'testlauf' | 'geaendertAm'>; anfrageId?: string }
  | { aktion: 'aendern'; id: string; teil: Partial<Skill>; stand: string }
  /** `kostenBestaetigt` nach der Rückfrage (409 `kostenBestaetigen` mit Schätzung), `nachts` = nur vormerken (Gegenprüfung 09.10.: im Vertrag nachgetragen). */
  | { aktion: 'testlauf'; id: string; kostenBestaetigt?: boolean; nachts?: boolean }
  | { aktion: 'aktivieren' | 'deaktivieren' | 'loeschen'; id: string; stand: string }
  | { aktion: 'import'; headId: string; skillMd: string }
  | { aktion: 'mitarbeiter-anlegen'; headId: string; mitarbeiter: Pick<Mitarbeiter, 'name' | 'rolle' | 'anleitung' | 'werkzeuge' | 'auchFuer' | 'stufe'>; anfrageId?: string }
  | { aktion: 'mitarbeiter-aendern'; headId: string; id: string; teil: Partial<Mitarbeiter>; stand: string }
  | { aktion: 'merksatz'; agent: AgentRef; text: string }
  | { aktion: 'merksatz-weg'; agent: AgentRef; id: string }
  /**
   * Paket 4b: Probelauf eines Mitarbeiters — ein Lauf mit Testeingabe, ohne Wirkung (keine Werkzeuge), Ergebnis nur in einem eigenen
   * Thread. Vorhandener Mitarbeiter (`id`) oder ein Entwurf aus dem Dialog (`entwurf`).
   */
  | { aktion: 'mitarbeiter-probelauf'; headId: string; id?: string; entwurf?: Pick<Mitarbeiter, 'name' | 'rolle' | 'anleitung' | 'werkzeuge' | 'stufe'>; eingabe: string; kostenBestaetigt?: boolean };
/** GET /api/agenten/laeufe (Paket 3). */
export interface LaeufeAntwort { ok: true; laeufe: Lauf[]; naechstes: Naechstes[]; plan: Hintergrundaufgabe[]; /** Stand je geplanter Aufgabe (Pausieren/Löschen mit Stand, Paket 4b im Vertrag). */ planStaende?: Record<string, string>;
  /**
   * Ist die Hintergrund-KI für diese Person an (Instanz UND Person, lib/datenschutz/ki-einstellungen.ts)? Ohne sie reiht der Takt KEINE geplante Aufgabe
   * ein (lib/agenten/zeitplan.ts) — Rundgang 09.10. „Agenten live“: eine geplante Aufgabe blieb still liegen, das Fenster „Geplant“ sagte „an“.
   */
  hintergrundKi?: boolean }
/** POST /api/agenten/laeufe (Paket 3). */
export type LaeufeAnfrage =
  // `kostenBestaetigt` nach der Rückfrage (409 `kostenBestaetigen`), `trotzdem` in einer Business-freien Zeit (409 `businessFrei`) — die Route
  // nahm beides schon an, der Vertrag nennt es seit der Gegenprüfung 09.10. (sonst konnte die Oberfläche teure Läufe nie bestätigen).
  | { aktion: 'planen'; aufgabe: Pick<Hintergrundaufgabe, 'agent' | 'titel' | 'auftrag' | 'zeitplan' | 'kostenGrenzeCent'>; anfrageId?: string; kostenBestaetigt?: boolean }
  | { aktion: 'plan-aendern'; id: string; teil: Partial<Hintergrundaufgabe>; stand: string; kostenBestaetigt?: boolean }
  | { aktion: 'plan-loeschen'; id: string; stand: string }
  | { aktion: 'abbrechen'; laufId: string }
  | { aktion: 'neu-starten'; laufId: string; kostenBestaetigt?: boolean; trotzdem?: boolean };
/** GET /api/medien (Paket 5). */
export interface MedienAntwort { ok: true; medien: Medium[] }
