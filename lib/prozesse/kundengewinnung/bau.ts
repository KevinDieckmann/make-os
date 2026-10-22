// ─── Prozesse · Kundengewinnung — so werden die Vorlagen gebaut (22.10.; research/prozesse/VORLAGEN_KUNDENGEWINNUNG.md) ──────────────────────────────────
// Eine Vorlage ist eine gültige `ProzessDefinition` (dasselbe Modell wie jeder Prozess der Werkstatt) plus Steckbrief, Recht, Kennzahlen, Einstellbares und
// die offenen Punkte, die erst mit dem Lauf-Motor (C1) bzw. einer neuen Quelle kommen. Diese Datei ist das kleine Bau-Werkzeug dafür:
//   · `prozess(...)` setzt Wurzel, Phasen, Ränge und Kennungen (`<vorlage>:<schritt>`), übersetzt die Zweige auf diese Kennungen und setzt die Freigabe-Schlösser
//     über die EINE Regel (lib/prozesse/schloss.ts `schlossSetzen`) — eine Vorlage hat also nie ein fehlendes Schloss.
//   · `S.*` baut einen Schritt aus einem Baustein des Katalogs: Form, Bahn und Masken-Werte wie die Werkstatt (`katalog.werte` bzw. das eigene Feld).
// Gliederung (Feinschliff 22.10., Befund 1): höchstens `PROZESS_GRENZEN.schritteHinweis` Schritte je Phase (Schlösser zählen mit) — die Werkstatt rät sonst
// selbst „Teilprozess bilden?“. Zweige bleiben in ihrer Phase; ein Ende, das nur über einen Sprung erreicht wird, steht im Strang hinter einem Schritt, der nicht
// durchfällt (Ende bzw. eigenes „ja“) — sonst liefe der Schritt davor hinein. Wächter: tests/prozesse-vorlagen-gliederung.test.ts (derselbe Ablauf wie vorher).
// Keine Namen, keine Firmen, keine Beträge (Plattform-Regel): Personen sind Rollen (`rolle:eigner`, `rolle:zustaendig`), Postfach und Gesellschaft „des
// Falls“ bzw. „des Laufs“, Ereignisse und Felder nur Kennungen. Rein und client-sicher (die Galerie liest dieselben Daten über die Route).

import type {
  AgentSchritt, Ausloeser, Bahn, Bedingung, CrmAbfrage, DatumsFeld, FallArt, MaskenWert, PfeilText, ProzessBereich, ProzessDefinition, ProzessForm, ProzessKnoten,
  RautenRegel, ScorePruefung, SkillEreignis, VertragFeld, WartenRegel, WebhookFeld, Zweige, ModelTier, NotizZettel,
} from '../definition';
import { katalogEintrag, GESELLSCHAFT_DES_FALLS, POSTFACH_DES_LAUFS, POSTFACH_DER_NACHRICHT, ROLLE_EIGNER, ROLLE_ZUSTAENDIG } from '../baustein-katalog';
import { schlossSetzen } from '../schloss';
import { laufFremd } from '../definition-pruefen';
import { zettelObenPlatz, WS } from '../werkstatt-lage';
import type { EignerRolle } from './rollen';
import type { Temperatur } from '@/lib/crm/typen';

type K = ProzessKnoten<ProzessForm>;

/** Wer im Schritt gemeint ist — nie ein Name. */
export const EIGNER = ROLLE_EIGNER;
export const ZUSTAENDIG = ROLLE_ZUSTAENDIG;
export const GESELLSCHAFT = GESELLSCHAFT_DES_FALLS;
export const POSTFACH = POSTFACH_DES_LAUFS;
export const POSTFACH_NACHRICHT = POSTFACH_DER_NACHRICHT;
/** Empfänger aus dem Fall (Maske „An“) — nie eine Adresse aus fremdem Text. */
export const AN_KONTAKT = 'fall.kontakt';
export const AN_ANSPRECHPARTNER = 'fall.ansprechpartner';

/**
 * Ereignisse, die der Lauf-Motor (C1, 21.10.) speist (E1, E4, E8, E9 — research/prozesse/VORLAGEN_KUNDENGEWINNUNG.md › 5.1). Seit dem Zusammenführen sind sie
 * angebunden; die Namen stehen hier nur, damit die Vorlagen sie an EINER Stelle nennen.
 */
export const C1_EREIGNIS = {
  terminVorbei: 'termin-vorbei', mandatAngelegt: 'mandat-angelegt', mandatBeendet: 'mandat-beendet', antwortGesendet: 'antwort-gesendet',
  followupErledigt: 'followup-erledigt', zielErreicht: 'ziel-erreicht',
} as const satisfies Record<string, SkillEreignis>;

/** Was eine Vorlage braucht, damit sie wirkt (Galerie: „braucht: …“). */
export type Braucht = 'postfach' | 'whatsapp' | 'kalender' | 'linkedin-profil' | 'buchungsseite' | 'ki' | 'web-recherche' | 'kampagne' | 'events' | 'mandate' | 'fulfillment';
export const BRAUCHT_TEXT: Readonly<Record<Braucht, string>> = {
  postfach: 'ein Postfach (Gmail oder IMAP) mit Business-Bereich', whatsapp: 'die WhatsApp-Business-Nummer', kalender: 'einen verbundenen Kalender',
  'linkedin-profil': 'ein LinkedIn-Profil der Person', buchungsseite: 'eine Buchungsseite', ki: 'KI (Agenten-Schritte mit Budget)',
  'web-recherche': 'Web-Recherche (Research-Agent, Ergebnis nur als Vorschlag)', kampagne: 'eine Kampagne mit Playbook', events: 'Events in der Markttraktion',
  mandate: 'Mandate', fulfillment: 'Fulfillment-Vorlagen (Produkt-Karte)',
};

/** Die Sammlungen der Galerie „Aus Vorlage anlegen“ (22.10., B2). */
export type VorlagenGruppe = 'kundengewinnung' | 'begleitung';

/** Ein offener Punkt der Vorlage (fehlender Motor-Teil, fehlende Quelle) — mit den Knoten, an denen die Prüfung deshalb „offen“ meldet. */
export interface OffenerPunkt { punkt: string; text: string; knoten?: string[] }
export interface Einstellbar { id: string; label: string; vorgabe: string | number | boolean; knoten?: string; feld?: string }

/** Ein Teilprozess der Vorlage (eigener Prozess, wird zuerst übernommen und veröffentlicht; erscheint nicht als eigene Kachel). */
export interface KgTeil { id: string; titel: string; definition: ProzessDefinition; offen: OffenerPunkt[] }

/** Eine Vorlage der Kundengewinnung. */
export interface KgVorlage {
  /** `kg-v01` … `kg-v18`. */
  id: string;
  nr: string;
  welle: 0 | 1 | 2 | 3;
  titel: string;
  zweck: string;
  bereich: ProzessBereich;
  fallArt: FallArt;
  eignerRolle: EignerRolle;
  ausloeserText: string;
  braucht: Braucht[];
  recht: string[];
  kennzahlen: string[];
  einstellbar: Einstellbar[];
  offen: OffenerPunkt[];
  demo: string;
  /** Andere Vorlagen, an die übergeben wird (Lichtfaden auf der Landkarte) — ihre Kennungen. */
  uebergabeAn: string[];
  /** Die Sammlung der Galerie (22.10., B2): fehlt = Kundengewinnung; `begleitung` = „Fulfillment · Kunden-Begleitung“ (lib/prozesse/begleitung/vorlagen.ts). */
  gruppe?: VorlagenGruppe;
  /**
   * Wiedereintritt je Fall (22.10., B3): der Motor startet je Prozess und Fall EINEN Lauf (lib/prozesse/lauf-regeln.ts `starten`), einen weiteren erst nach
   * `erneutNachTagen` (Läufe › Einstellungen). Begleit-Vorlagen, die je Mandat öfter laufen sollen (jede Etappe, jeder Report), bringen hier ihre Vorgabe mit —
   * „Aus Vorlage“ setzt sie für volle Mitglieder; fehlt = einmal je Fall.
   */
  erneutNachTagen?: number;
  definition: ProzessDefinition;
  teile: KgTeil[];
}

/** Die Liste einer CRM-Abfrage dieses Prozesses für eine Schleife (`abfrage:<Knoten>`). */
export const abfrageListe = (vorlage: string, schritt: string): string => `abfrage:${knotenKennung(vorlage, schritt)}`;

/** Platzhalter für den Aufruf eines anderen Prozesses der Bibliothek (Teilprozess, Übergabe) — `Übernehmen` ersetzt ihn durch die echte Kennung. */
export const vorlageRef = (id: string): string => `vorlage:${id}`;
export const istVorlageRef = (v: unknown): v is string => typeof v === 'string' && v.startsWith('vorlage:');
export const vorlageAusRef = (v: string): string => v.slice('vorlage:'.length);

// ── Schritte ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Ein Schritt im Bau: lokale Kennung, Titel, Baustein, Werte der Maske bzw. das eigene Feld, Zweige auf lokale Kennungen. */
export interface Schritt {
  id: string; titel: string; baustein: string;
  werte?: Record<string, MaskenWert>;
  feld?: Partial<Pick<K, 'ausloeser' | 'agent' | 'raute' | 'warten' | 'schleife' | 'teilprozess' | 'ende' | 'abfrage' | 'erneut'>>;
  zweige?: Zweige; pfeil?: PfeilText; bahn?: Bahn; frist?: number; versuche?: number; ziel?: string; kennzahl?: string;
  /** Wohin „abgelehnt“ bzw. „abgelaufen“ am Freigabe-Schloss hinter diesem Schritt führen (lokale Kennungen) — das Schloss selbst setzt die Regel. */
  schloss?: { nein?: string; abgelaufen?: string };
}
type Opt = Pick<Schritt, 'zweige' | 'pfeil' | 'frist' | 'ziel' | 'kennzahl' | 'versuche' | 'schloss'>;
const sch = (id: string, titel: string, baustein: string, x: Omit<Schritt, 'id' | 'titel' | 'baustein'> = {}): Schritt => ({ id, titel, baustein, ...x });

/** Bedingung kurz. */
export const B = {
  ist: (feld: string, wert: string | number | boolean): Bedingung => ({ feld, op: 'gleich', wert }),
  nicht: (feld: string, wert: string | number | boolean): Bedingung => ({ feld, op: 'ungleich', wert }),
  einer: (feld: string, werte: string[]): Bedingung => ({ feld, op: 'einer-von', wert: werte }),
  groesser: (feld: string, wert: number): Bedingung => ({ feld, op: 'groesser', wert }),
  kleiner: (feld: string, wert: number): Bedingung => ({ feld, op: 'kleiner', wert }),
  gesetzt: (feld: string): Bedingung => ({ feld, op: 'gesetzt' }),
  leer: (feld: string): Bedingung => ({ feld, op: 'leer' }),
};

/** Ein Vertragsfeld (nur Kennung, Zahl, Tag, ja/nein, Auswahl). */
export const V = {
  zahl: (id: string, pflicht = false): VertragFeld => ({ id, art: 'zahl', ...(pflicht ? { pflicht } : {}) }),
  janein: (id: string): VertragFeld => ({ id, art: 'ja-nein' }),
  tag: (id: string): VertragFeld => ({ id, art: 'datum' }),
  wahl: (id: string, optionen: string[], pflicht = false): VertragFeld => ({ id, art: 'auswahl', optionen, ...(pflicht ? { pflicht } : {}) }),
  kennung: (id: string, kennung: VertragFeld['kennung'], liste = false): VertragFeld => ({ id, art: 'kennung', kennung, ...(liste ? { liste } : {}) }),
};

const agent = (wer: AgentSchritt['wer'], a: { auftrag: string; warum: string; budgetCent: number; modell?: ModelTier; werkzeuge?: string[]; ausgabe?: VertragFeld[]; eingabe?: VertragFeld[]; brain?: boolean; vorschlagFelder?: string[] }): AgentSchritt => ({
  wer, auftrag: a.auftrag, modell: a.modell ?? (wer.art === 'fach' || wer.art === 'skill' ? 'schnell' : 'ausgewogen'), budgetCent: a.budgetCent,
  gedaechtnis: { brain: a.brain ?? false, akte: true }, werkzeuge: a.werkzeuge ?? [], eingabe: a.eingabe ?? [], ausgabe: a.ausgabe ?? [], warumKeineRegel: a.warum,
  ...(a.vorschlagFelder ? { ergebnis: 'vorschlag' as const, vorschlagFelder: a.vorschlagFelder } : {}),
});

/** Die Schritte — je Baustein des Katalogs ein Bauer (Masken-Werte wie die Werkstatt). */
export const S = {
  // Auslöser
  hand: (id: string, titel = 'Von Hand starten'): Schritt => sch(id, titel, 'ausloeser.hand', { feld: { ausloeser: { art: 'hand' } } }),
  zeitplan: (id: string, titel: string, rhythmus: 'taeglich' | 'werktags' | 'woechentlich' | 'monatlich', uhrzeit: string, tage?: number[]): Schritt =>
    sch(id, titel, 'ausloeser.zeitplan', { feld: { ausloeser: { art: 'zeitplan', rhythmus, uhrzeit, ...(tage ? { tage } : {}) } } }),
  ereignis: (id: string, titel: string, ereignis: SkillEreignis, bedingungen?: Bedingung[]): Schritt =>
    sch(id, titel, 'ausloeser.ereignis', { feld: { ausloeser: { art: 'ereignis', ereignis, ...(bedingungen?.length ? { bedingungen } : {}) } as Ausloeser } }),
  /** Datum am Fall (22.10.: der Motor startet ihn im Takt — lib/prozesse/datum-start.ts); `bedingungen` = „nur wenn …“ über die Felder des Falls. */
  datum: (id: string, titel: string, feld: DatumsFeld, versatzTage: number, uhrzeit?: string, werktage?: boolean, bedingungen?: Bedingung[]): Schritt =>
    sch(id, titel, 'ausloeser.datum', { feld: { ausloeser: { art: 'datum', feld, versatzTage, ...(werktage ? { werktage } : {}), ...(uhrzeit ? { uhrzeit } : {}), ...(bedingungen?.length ? { bedingungen } : {}) } } }),
  webhook: (id: string, titel: string, felder: WebhookFeld[]): Schritt => sch(id, titel, 'ausloeser.webhook', { feld: { ausloeser: { art: 'webhook', felder } } }),
  // CRM lesen
  abfrage: (id: string, titel: string, q: CrmAbfrage, o: Opt = {}): Schritt => sch(id, titel, 'crm.abfragen', { feld: { abfrage: q }, ...o }),
  akte: (id: string, titel: string, o: Opt = {}): Schritt => sch(id, titel, 'crm.firma-akte', o),
  // Entscheidungen
  regel: (id: string, titel: string, bedingungen: Bedingung[], o: Opt & { oder?: boolean } = {}): Schritt => {
    const { oder, ...rest } = o;
    return sch(id, titel, 'entscheidung.regel', { feld: { raute: { art: 'regel', bedingungen, ...(oder && bedingungen.length > 1 ? { verknuepfung: 'oder' as const } : {}) } as RautenRegel }, ...rest });
  },
  score: (id: string, titel: string, pruefung: ScorePruefung, o: Opt & { schwelle?: number; temperatur?: Temperatur[] } = {}): Schritt => {
    const { schwelle, temperatur, ...rest } = o;
    return sch(id, titel, 'entscheidung.score', { feld: { raute: { art: 'score', pruefung, ...(schwelle !== undefined ? { schwelle } : {}), ...(temperatur ? { temperatur } : {}) } }, ...rest });
  },
  mensch: (id: string, titel: string, frage: string, wer = ZUSTAENDIG, o: Opt = {}): Schritt => sch(id, titel, 'entscheidung.mensch', { werte: { frage, wer }, ...o }),
  // Aufgaben, Glocke, Erinnerung
  aufgabe: (id: string, titel: string, a: { titel: string; wer?: string; fristTage?: number; beschreibung?: string; prioritaet?: 'low' | 'medium' | 'high' | 'critical' }, o: Opt = {}): Schritt =>
    sch(id, titel, 'aufgabe.anlegen', { werte: { titel: a.titel, wer: a.wer ?? ZUSTAENDIG, ...(a.fristTage !== undefined ? { fristTage: a.fristTage } : {}), prioritaet: a.prioritaet ?? 'medium', ...(a.beschreibung ? { beschreibung: a.beschreibung } : {}) }, ...o }),
  glocke: (id: string, titel: string, text: string, wer = EIGNER, o: Opt = {}): Schritt => sch(id, titel, 'glocke.melden', { werte: { wer, text }, ...o }),
  erinnerung: (id: string, titel: string, versuche: number, fristTage: number, o: Opt = {}): Schritt => sch(id, titel, 'erinnerung.runde', { werte: { versuche, fristTage }, ...o }),
  // Nachrichten (nur Entwürfe — gesendet wird erst nach dem Schloss)
  mail: (id: string, titel: string, m: { betreff: string; text: string; an?: string; postfach?: string }, o: Opt = {}): Schritt =>
    sch(id, titel, 'inbox.mail-entwurf', { werte: { postfach: m.postfach ?? POSTFACH, an: m.an ?? AN_KONTAKT, betreff: m.betreff, text: m.text }, ...o }),
  whatsapp: (id: string, titel: string, text: string, o: Opt = {}): Schritt => sch(id, titel, 'whatsapp.entwurf', { werte: { an: AN_KONTAKT, text }, ...o }),
  einladung: (id: string, titel: string, m: { titel: string; dauerMin?: number; gaeste?: string }, o: Opt = {}): Schritt =>
    sch(id, titel, 'kalender.einladung', { werte: { titel: m.titel, gaeste: m.gaeste ?? AN_KONTAKT, dauerMin: m.dauerMin ?? 60 }, ...o }),
  block: (id: string, titel: string, m: { titel: string; wer?: string; dauerMin?: number }, o: Opt = {}): Schritt =>
    sch(id, titel, 'kalender.block', { werte: { titel: m.titel, wer: m.wer ?? ZUSTAENDIG, dauerMin: m.dauerMin ?? 60 }, ...o }),
  text: (id: string, titel: string, m: { art: 'nachricht_entwurf' | 'anruf_leitfaden' | 'einladung_entwurf' | 'danke_entwurf'; kanal: 'linkedin' | 'mail' | 'telefon' | 'einladung'; text?: string; anlass?: string }, o: Opt = {}): Schritt =>
    sch(id, titel, 'crm.entwurf-text', { werte: { art: m.art, kanal: m.kanal, ...(m.text ? { text: m.text } : {}), ...(m.anlass ? { anlass: m.anlass } : {}) }, ...o }),
  // CRM schreiben (Vorschläge)
  followup: (id: string, titel: string, m: { text: string; inTagen: number; wer?: string }, o: Opt = {}): Schritt => sch(id, titel, 'crm.followup', { werte: { text: m.text, inTagen: m.inTagen, ...(m.wer ? { wer: m.wer } : {}) }, ...o }),
  dealVorschlag: (id: string, titel: string, m: { naechsterSchritt: string; inTagen: number; titel?: string }, o: Opt = {}): Schritt =>
    sch(id, titel, 'crm.deal-vorschlagen', { werte: { naechsterSchritt: m.naechsterSchritt, inTagen: m.inTagen, ...(m.titel ? { titel: m.titel } : {}) }, ...o }),
  dealStufe: (id: string, titel: string, stufe: string, grund?: string, o: Opt = {}): Schritt => sch(id, titel, 'crm.deal-stufe', { werte: { stufe, ...(grund ? { grund } : {}) }, ...o }),
  dealSchritt: (id: string, titel: string, inTagen: number, naechsterSchritt?: string, o: Opt = {}): Schritt =>
    sch(id, titel, 'crm.deal-schritt', { werte: { inTagen, ...(naechsterSchritt ? { naechsterSchritt } : {}) }, ...o }),
  kontaktPflegen: (id: string, titel: string, felder: string[], o: Opt = {}): Schritt => sch(id, titel, 'crm.kontakt-pflegen', { werte: { felder }, ...o }),
  karte: (id: string, titel: string, ziel: 'firma' | 'kontakt', felder: string[], uebernahme: 'je-feld' | 'sammel' = 'je-feld', o: Opt = {}): Schritt =>
    sch(id, titel, 'crm.karte-ergaenzen', { werte: { ziel, felder, uebernahme }, ...o }),
  qualifizieren: (id: string, titel: string, status: string, o: Opt = {}): Schritt => sch(id, titel, 'crm.lead-qualifizieren', { werte: { status }, ...o }),
  parken: (id: string, titel: string, parkTage: number, grundArt = 'spaeter', o: Opt = {}): Schritt => sch(id, titel, 'crm.lead-parken', { werte: { parkTage, grundArt }, ...o }),
  notiz: (id: string, titel: string, text: string, o: Opt = {}): Schritt => sch(id, titel, 'crm.kontakt-notiz', { werte: { text }, ...o }),
  mandat: (id: string, titel: string, o: Opt = {}): Schritt => sch(id, titel, 'crm.mandat-anlegen', o),
  fallStarten: (id: string, titel: string, o: Opt = {}): Schritt => sch(id, titel, 'fulfillment.fall-starten', o),
  gaeste: (id: string, titel: string, n: number, mixZielkunden: number, mixKunden: number, o: Opt = {}): Schritt => sch(id, titel, 'event.gaeste', { werte: { n, mixZielkunden, mixKunden }, ...o }),
  kampagnenErgebnis: (id: string, titel: string, o: Opt = {}): Schritt => sch(id, titel, 'crm.kampagnen-ergebnis', o),
  anfrage: (id: string, titel: string, kanal: string, o: Opt = {}): Schritt => sch(id, titel, 'crm.anfrage-anlegen', { werte: { kanal }, ...o }),
  angebotEntwurf: (id: string, titel: string, o: Opt = {}): Schritt => sch(id, titel, 'angebot.entwurf', { werte: { gesellschaft: GESELLSCHAFT }, ...o }),
  // Warten (jedes mit Obergrenze und Ausgang „abgelaufen“)
  /** Warten eine Dauer — `arbeitszeit` zählt Werktage (Mo–Fr ohne Feiertage NRW; Entscheidung E-V7 „48 Stunden = Werktage“). */
  wartenDauer: (id: string, titel: string, tage: number, o: Opt & { stunden?: number; arbeitszeit?: boolean } = {}): Schritt => {
    const { stunden, arbeitszeit, ...rest } = o;
    return sch(id, titel, 'warten.dauer', { feld: { warten: { art: 'dauer', tage, ...(stunden ? { stunden } : {}), ...(arbeitszeit ? { arbeitszeit } : {}) } }, ...rest });
  },
  /** Warten auf ein Ereignis zum Fall — Obergrenze in Tagen bzw. (M1) in Stunden, optional in Arbeitszeit (Werktage, 9–18 Uhr). */
  wartenEreignis: (id: string, titel: string, ereignis: SkillEreignis, hoechstensTage: number, o: Opt & { stunden?: number; arbeitszeit?: boolean } = {}): Schritt => {
    const { stunden, arbeitszeit, ...rest } = o;
    return sch(id, titel, 'warten.ereignis', { feld: { warten: { art: 'ereignis', ereignis, hoechstensTage, ...(stunden ? { hoechstensStunden: stunden } : {}), ...(arbeitszeit ? { arbeitszeit } : {}) } as WartenRegel }, ...rest });
  },
  wartenDatum: (id: string, titel: string, feld: DatumsFeld, versatzTage: number, hoechstensTage: number, o: Opt = {}): Schritt =>
    sch(id, titel, 'warten.datum', { feld: { warten: { art: 'datum', feld, versatzTage, hoechstensTage } }, ...o }),
  // Agenten (ein Schritt, Vertrag nur Kennungen/Zahlen/Auswahl, Budget, Pflichtsatz)
  head: (id: string, titel: string, headId: string, a: Parameters<typeof agent>[1], o: Opt = {}): Schritt => sch(id, titel, 'agent.head', { feld: { agent: agent({ art: 'head', headId }, a) }, ...o }),
  zoe: (id: string, titel: string, a: Parameters<typeof agent>[1], o: Opt = {}): Schritt => sch(id, titel, 'agent.zoe', { feld: { agent: agent({ art: 'zoe' }, a) }, ...o }),
  /**
   * Research (Web) — Vorgabe seit 22.10. nachts (Entscheidung „Nur öffentliche Angaben“): an das Modell gehen nur Firmenname, Website und Branche, Akte und Brain
   * sind aus → kein Dreieck, kein Schloss dahinter; die gefundenen Felder bestätigt man im Stapel. `akteLesen: true` = wie vorher (mit Akte, mit Schloss).
   */
  research: (id: string, titel: string, a: Parameters<typeof agent>[1] & { vorschlagFelder: string[]; akteLesen?: true }, o: Opt = {}): Schritt => {
    const basis = agent({ art: 'fach', agentId: 'research' }, a);
    const oeffentlich = !a.akteLesen;
    return sch(id, titel, 'agent.research', { feld: { agent: {
      ...basis, ergebnis: 'vorschlag', vorschlagFelder: a.vorschlagFelder,
      ...(oeffentlich ? { nurOeffentlich: true as const, gedaechtnis: { brain: false, akte: false } } : {}),
    } }, ...o });
  },
  // Ablauf
  schleife: (id: string, titel: string, liste: string, teil: string, hoechstens: number, o: Opt = {}): Schritt =>
    sch(id, titel, 'schleife.je-eintrag', { feld: { schleife: { liste, prozessId: vorlageRef(teil), hoechstens } }, ...o }),
  ziel: (id: string, titel = 'Ziel erreicht'): Schritt => sch(id, titel, 'ende.ziel', { feld: { ende: { ergebnis: 'erfolg' } } }),
  abbruch: (id: string, titel: string): Schritt => sch(id, titel, 'ende.abbruch', { feld: { ende: { ergebnis: 'abbruch' } } }),
  uebergabe: (id: string, titel: string, an: string): Schritt => sch(id, titel, 'ende.uebergabe', { feld: { ende: { ergebnis: 'uebergabe', uebergabeAn: vorlageRef(an) } } }),
};

// ── Der Prozess ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface ProzessBau {
  id: string; titel: string; beschreibung: string; bereich: ProzessBereich; fallArt: FallArt;
  startKriterium: string; endKriterium: string;
  phasen: { titel: string; schritte: Schritt[] }[];
  /** Ein Notiz-Zettel auf der Fläche (Recht, Standard-Abbruch) — keine Wirkung. */
  zettel?: string;
}

/** Feste Kennung eines Knotens der Vorlage (`<vorlage>:<schritt>`) — `Übernehmen` vergibt neue `fk-<uuid>`. */
export const knotenKennung = (vorlage: string, schritt: string): string => `${vorlage}:${schritt}`;

/** Aus dem Bau eine Definition (rein): Wurzel, Phasen, Ränge, Zweige auf volle Kennungen, Freigabe-Schlösser nach der EINEN Regel. */
export function prozess(p: ProzessBau): ProzessDefinition {
  const id = (s: string) => knotenKennung(p.id, s);
  // Wurzel, Phasen und Zettel mit „~“ — so stoßen sie nie mit einer lokalen Schritt-Kennung zusammen.
  const wurzel = id('~w');
  const knoten: K[] = [{ id: wurzel, titel: p.titel, rang: 1 }];
  const lokal = new Set(p.phasen.flatMap(ph => ph.schritte.map(s => s.id)));
  const ziel = (z: string | undefined, von: string): string | undefined => {
    if (!z) return undefined;
    if (!lokal.has(z)) throw new Error(`Vorlage ${p.id}: Schritt „${von}“ zeigt auf „${z}“ — den gibt es nicht.`);
    return id(z);
  };
  p.phasen.forEach((ph, i) => {
    const phaseId = id(`~p${i + 1}`);
    knoten.push({ id: phaseId, elternId: wurzel, titel: ph.titel, rang: i + 1 });
    ph.schritte.forEach((s, j) => {
      const e = katalogEintrag(s.baustein);
      if (!e) throw new Error(`Vorlage ${p.id}: Baustein „${s.baustein}“ gibt es nicht.`);
      const zw: Zweige = {};
      for (const a of ['ja', 'nein', 'fehler', 'abgelaufen'] as const) { const z = ziel(s.zweige?.[a], s.id); if (z) zw[a] = z; }
      // Die Frist eines Schritts (z. B. „entscheiden in 3 Tagen“) steht auch in der Maske (`fristTage`) — dort ist sie in der Werkstatt änderbar und dort liest
      // sie der Motor (22.10.); `frist` am Knoten bleibt wie bisher.
      const werte = !e.feld && s.frist !== undefined && s.werte?.fristTage === undefined && e.maske.some(f => f.id === 'fristTage') ? { ...(s.werte ?? {}), fristTage: s.frist } : s.werte;
      const k: K = {
        id: id(s.id), elternId: phaseId, titel: s.titel, rang: j + 1, form: e.form, bahn: s.bahn ?? e.bahn,
        katalog: e.feld || !werte || !Object.keys(werte).length ? { id: e.id } : { id: e.id, werte },
        ...(s.feld ?? {}),
        ...(Object.keys(zw).length ? { zweige: zw } : {}), ...(s.pfeil ? { pfeilText: s.pfeil } : {}),
        ...(s.frist !== undefined ? { frist: s.frist } : {}), ...(s.versuche !== undefined ? { versuche: s.versuche } : {}),
        ...(s.ziel ? { ziel: s.ziel } : {}), ...(s.kennzahl ? { kennzahl: s.kennzahl } : {}),
      };
      knoten.push(k);
    });
  });
  // Der Zettel liegt über dem ersten Rahmen (Befund 3, 22.10.) — vorher bei 40/40 über dem Kopf der ersten Phase und den Namen der Bahnen.
  // Die Höhe reicht für den ganzen Text (grob ≈ 0,56 · 13 px je Zeichen auf 212 px Breite, eine Zeile Reserve für Umbrüche an Wortgrenzen).
  const zettelH = p.zettel ? Math.max(WS.zettel.h, 36 + 18 * (Math.ceil((p.zettel.length * 13 * 0.56) / (WS.zettel.b - 28)) + 1)) : 0;
  const zettel: NotizZettel[] | undefined = p.zettel ? [{ id: id('~zettel'), text: p.zettel, pos: { ...zettelObenPlatz(0, { h: zettelH }), b: WS.zettel.b, h: zettelH }, farbe: 'gelb' }] : undefined;
  const d: ProzessDefinition = {
    id: p.id, art: 'paket', titel: p.titel, beschreibung: p.beschreibung, knoten, uebergaenge: [], freigaben: [], rollen: [], fassung: 1,
    geaendert: '', geaendertVon: '', bereich: p.bereich, fallArt: p.fallArt, startKriterium: p.startKriterium, endKriterium: p.endKriterium,
    ...(zettel ? { zettel } : {}),
    herkunft: { art: 'muster', quelleIds: [p.id], am: '' },
  };
  const mitSchloss = schlossSetzen(d, { laufFremd: laufFremd(d) }).definition;
  // Ausgänge der Schlösser (abgelehnt, abgelaufen) — nur dort, wo die Vorlage sie nennt; ein Schritt ohne Schloss darf keine nennen.
  const ausgaenge = p.phasen.flatMap(ph => ph.schritte).filter(s => s.schloss);
  if (!ausgaenge.length) return mitSchloss;
  const knotenNeu = mitSchloss.knoten.map(k => {
    const s = ausgaenge.find(x => k.schloss?.fuer === id(x.id));
    if (!s) return k;
    const zw: Zweige = { ...(k.zweige ?? {}) };
    if (s.schloss?.nein) zw.nein = ziel(s.schloss.nein, s.id);
    if (s.schloss?.abgelaufen) zw.abgelaufen = ziel(s.schloss.abgelaufen, s.id);
    return { ...k, zweige: zw };
  });
  for (const s of ausgaenge) if (!knotenNeu.some(k => k.schloss?.fuer === id(s.id))) throw new Error(`Vorlage ${p.id}: hinter „${s.id}“ steht kein Schloss — dort gibt es keine Ausgänge „abgelehnt“/„abgelaufen“.`);
  return { ...mitSchloss, knoten: knotenNeu };
}

/** Der feste Zettel jeder Vorlage (Regel R1, nicht abwählbar — der Motor setzt ihn durch). */
export const STANDARD_ABBRUCH = 'Standard-Abbruch (fest): Ist eine Person des Falls in der Verarbeitung eingeschränkt (Art. 18) oder hat sie eine Werbesperre, enden alle Läufe zu ihr — auch mitten im Warten.';
