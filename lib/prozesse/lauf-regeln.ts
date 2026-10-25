// ─── Prozesse · Lauf-Motor — die reinen Regeln (Etappe C1 „Laufen intern“, 21.10.; ANALYSE_100.md Punkte 29, 35–50, 59, 61, 64, 67, 98) ───────────────
// EINE Stelle für den Weg eines Laufs durch seine Version — der echte Lauf (scharf) und der Probelauf/Schatten gehen DENSELBEN Code (Punkt 48: keine zweite
// Wahrheit). Der Weg kommt aus lib/prozesse/fluss.ts `kantenVon` (dieselben Kanten, die die Werkstatt zeichnet). Je Knoten ein Plan:
//   weiter   reine Regel (Auslöser, Raute nach Regel/Score, Ende, Lesen) — sofort weiter über einen Ausgang
//   warten   Dauer, Datum, Ereignis — mit Obergrenze und Ausgang „abgelaufen“ (Punkt 46); M1: auch in Stunden und in Arbeitszeit
//   aktion   eine Wirkung mit fester Kennung `<lauf>-<schritt>` (Punkt 42): Aufgabe (Menschen-Schritt, wartet aufs Abhaken — Punkt 67), Vorschlag im
//            ZOE-Stapel (Freigabe/Entscheidung — Punkt 61, wartet auf freigegeben · abgelehnt · abgelaufen), CRM-Vorschlag, Glocke, Agent (nur
//            Vorschlag), Teilprozess
//   fehler   dauerhaft: Fehlerkante, sonst angehalten (Punkt 47)
// Im SCHATTEN wird keine Aktion ausgeführt: der Schritt steht als „würde …“ (bzw. „Freigabe“, „wartet“) im Lauf, und es geht über den positiven Ausgang
// weiter — so zeigt der Probelauf den ganzen Weg, ohne zu schreiben.
// Dazu: Start-Regeln (ein Lauf je Fall, Wiedereintritt, Flutschutz, Kette — Punkte 35, 37, 49), Ziel/Abbruch und Art. 18/Werbesperre (Punkt 40),
// Notbremse und Budget (Punkte 50, 59), Versions-Umzug (Punkt 44), Lauf-Ansicht (Punkt 29), Lage (Punkt 88), Heute-Zeile (Punkt 69), Kennzahlen (M5).
// Rein und client-sicher; alles, was nur der Server weiß (Fall, Kontakt, Kanal-Ampel, Personen, Budget), kommt über `LaufUmfeld`.
// Tests: tests/prozesse-lauf-regeln.test.ts.

import { kantenVon, startKnoten, alleSchritte, schloesser, type Kante } from './fluss';
import { bedingungenTreffen, bedingungTrifft, bedingungText } from './bedingung';
import {
  brauchtSchloss, FORM_KLASSE, katalogEintrag, klasseVonEintrag, maskeVorgaben, textvorlageFuellen, GESELLSCHAFT_DES_FALLS, POSTFACH_DES_LAUFS, POSTFACH_DER_NACHRICHT,
  KARTE_FELDER, ABFRAGE_NAME, type KatalogEintrag,
} from './baustein-katalog';
import { textGeruest } from './kundengewinnung/text-geruest';
import type { AnspracheUrteil } from './ansprache';
import { istRolle } from './kundengewinnung/rollen';
import {
  bereichVon, fallArtVon, PROZESS_GRENZEN,
  type AgentSchritt, type Befund, type Bedingung, type CrmAbfrage, type DatumsFeld, type FallArt, type MaskenWert, type ProzessDefinition, type ProzessEintrag, type ProzessForm,
  type ProzessKnoten, type SkillEreignis, type Verknuepfung,
} from './definition';
import {
  GRUND_TEXT, LAUF_GRENZEN, laufOffen, leererStand,
  type LaeufeDatei, type LaufAusgang, type LaufAusloeser, type LaufEinstellung, type LaufFall, type LaufGrund, type LaufListe, type LaufModus, type LaufSchritt, type LaufWarten,
  type ProzessLauf, type ProzessLaufStand, type SchrittStatus, type VerlaufEintrag, type WarteArt, type Wirkung, type Zurueckgehalten,
} from './lauf-typen';
import { ausWandzeit, minutenVon, tagPlus, tagVon, wandAus, wandzeit } from '@/lib/kalender/zeit';
import { istWerktag, werktagePlus } from '@/lib/zeit/kalender-kern';
import { istDatumPeriode, stichtagVon } from './datum-start';
import { istSystemSchritt, ueberfuehrbarZuSchritt, type SystemSchrittId } from './ueberfuehrung';
import { schleifeSatz, schleifenElementFall } from './teilprozess-neu';

type K = ProzessKnoten<ProzessForm>;

// ══ Kennungen ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

/** FNV-1a 64 Bit (zwei 32-Bit-Runden) als 16 hex — rein, deterministisch. */
export function kurzHash(s: string): string {
  let a = 0x811c9dc5, b = 0x01000193 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c ^ (i & 0xff), 0x01000193) >>> 0;
  }
  return `${a.toString(16).padStart(8, '0')}${b.toString(16).padStart(8, '0')}`;
}

/** Die feste Kennung einer Wirkung (Punkt 42): `<lauf>-<16 hex>` aus Knoten und Runde — dieselbe bei jeder Wiederholung. */
export const wirkungsKennung = (laufId: string, knotenId: string, runde = 0): string => `${laufId}-${kurzHash(`${knotenId}|${runde}`)}`;

/** Der Schlüssel „ein Lauf je Prozess und Fall“ (Punkt 35) — ohne Fall die Periode (Zeitplan-Slot, Ereignis, Tag des Loops …). */
export function fallSchluessel(prozessId: string, fall: LaufFall, periode?: string): string {
  return fall.art === 'keiner' || !fall.id ? `${prozessId}|keiner:${periode ?? ''}` : `${prozessId}|${fall.art}:${fall.id}`;
}

/** Der Fall eines Ereignisses für eine Fall-Art (rein): Deal → Deal, Mandat → Mandat, Firma → Firma, Lead → Firma bzw. Person. Ohne passende Kennung: null. */
export function fallAusEreignis(fallArt: FallArt, bezug: Readonly<Record<string, string | undefined>>): LaufFall | null {
  switch (fallArt) {
    case 'deal': return bezug.dealId ? { art: 'deal', id: bezug.dealId } : null;
    case 'mandat': return bezug.mandatId ? { art: 'mandat', id: bezug.mandatId } : null;
    case 'firma': return bezug.firmaId ? { art: 'firma', id: bezug.firmaId } : null;
    case 'lead': return bezug.firmaId ? { art: 'lead', id: bezug.firmaId } : bezug.kontaktId ? { art: 'lead', id: bezug.kontaktId } : null;
    case 'event': return null;
    case 'kampagne': return null;
    case 'keiner': return { art: 'keiner' };
  }
}

/** Passt ein Ereignis zum Fall eines wartenden Laufs? (rein) — dieselbe Zuordnung wie beim Start. */
export function ereignisZumFall(fall: LaufFall, bezug: Readonly<Record<string, string | undefined>>): boolean {
  if (fall.art === 'keiner' || !fall.id) return true;
  if (fall.art === 'lead') return bezug.firmaId === fall.id || bezug.kontaktId === fall.id;
  const f = fallAusEreignis(fall.art, bezug);
  return !!f && f.id === fall.id;
}

// ══ Zeit ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

/** Berliner Stunde `YYYY-MM-DDTHH` bzw. Monat `YYYY-MM` eines Zeitpunkts. */
export const stundeVon = (iso: string): string => wandzeit(new Date(iso)).slice(0, 13);
export const monatVon = (iso: string): string => wandzeit(new Date(iso)).slice(0, 7);
export const tagVonIso = (iso: string): string => wandzeit(new Date(iso)).slice(0, 10);

const naechsterWerktag = (tag: string): string => { let d = tagPlus(tag, 1); for (let i = 0; i < 30 && !istWerktag(d); i++) d = tagPlus(d, 1); return d; };

/** `stunden` Arbeitsstunden ab `start` (Werktage NRW, `arbeitVon`–`arbeitBis` Uhr Berliner Zeit) — M1 „Arbeitszeit zählen“. Rein. */
export function arbeitsstundenPlus(startIso: string, stunden: number): string {
  const von = LAUF_GRENZEN.arbeitVon * 60, bis = LAUF_GRENZEN.arbeitBis * 60;
  const w = wandzeit(new Date(startIso));
  let tag = tagVon(w), min = minutenVon(w);
  let rest = Math.max(0, Math.round(stunden * 60));
  for (let i = 0; i < 2000; i++) {
    if (!istWerktag(tag) || min >= bis) { tag = naechsterWerktag(tag); min = von; continue; }
    if (min < von) min = von;
    const frei = bis - min;
    if (rest <= frei) return ausWandzeit(wandAus(tag, min + rest)).toISOString();
    rest -= frei; tag = naechsterWerktag(tag); min = von;
  }
  return startIso;
}

/** Eine Dauer ab `start` (rein): Kalendertage + Stunden, oder in Arbeitszeit (Tage = Werktage NRW mit derselben Uhrzeit, Stunden = Arbeitsstunden). */
export function zeitPlus(startIso: string, o: { tage?: number; stunden?: number; arbeitszeit?: boolean }): string {
  const tage = Math.max(0, Math.floor(o.tage ?? 0)), stunden = Math.max(0, o.stunden ?? 0);
  if (!o.arbeitszeit) return new Date(Date.parse(startIso) + tage * 86_400_000 + stunden * 3_600_000).toISOString();
  let ab = startIso;
  if (tage) { const w = wandzeit(new Date(startIso)); ab = ausWandzeit(wandAus(werktagePlus(tagVon(w), tage), minutenVon(w))).toISOString(); }
  return stunden ? arbeitsstundenPlus(ab, stunden) : ab;
}

/** Mitternacht (Berlin) eines Tages plus `versatz` Tage als ISO. */
const tagIso = (tag: string, versatz = 0): string => ausWandzeit(wandAus(tagPlus(tag, versatz), 0)).toISOString();

// ══ Umfeld (was nur der Server weiß) ════════════════════════════════════════════════════════════════════════════════════════════════════════════

/** Ein Empfänger aus dem Fall (nie aus fremdem Text): Kontakt-Kennung, Anzeigename, Adresse bzw. Nummer. */
export interface Empfaenger { kontaktId: string; name: string; email?: string; telefon?: string }

/**
 * Darf ein Agenten-Schritt jetzt laufen? (Takt-Fenster 7–22 Uhr, Tageshöchstzahl des Heads, Budget des Prozesses und des Schritts, Hintergrund-KI). `bis` = warten
 * (Fenster, Höchstzahl, gedrosselt); `ueberspringen` = der Schritt fällt ohne Modellaufruf aus (Recherche-Frische) und der Lauf geht über „weiter“.
 */
export type AgentFreigabe = { ok: true; kostenCent: number } | { ok: false; grund: LaufGrund; bis?: string; pause?: true; kostenCent?: number; ueberspringen?: true };

export interface LaufUmfeld {
  /** Jetzt (ISO). */
  jetzt: string;
  /** Prozess-Titel (für Texte — Geschäftswissen, keine Daten Dritter). */
  titel: string;
  /** Felder für Rauten, Ziel und Abbruch: Ereignis (`ereignis.*`, `bezug.*`) und Fall (`deal.stufe`, `lead.score` …). */
  daten: Readonly<Record<string, unknown>>;
  /** Werte für Textvorlagen (`{{kontakt.vorname}}` …) — können Namen tragen; gehen nur in Aufgabe bzw. Vorschlag, nie in den Lauf. */
  platzhalter?: Readonly<Record<string, unknown>>;
  /** Datum am Fall (YYYY-MM-DD) bzw. null. */
  fallDatum?: (feld: DatumsFeld) => string | null;
  /** Empfänger zu `fall.kontakt` · `fall.ansprechpartner` — null ohne. */
  empfaenger?: (an: string) => Empfaenger | null;
  /** Kanal-Ampel für einen Baustein, der eine Person anspricht (lib/prozesse/ansprache.ts mit dem Kontakt des Falls). */
  ansprache?: (e: KatalogEintrag, werte: Readonly<Record<string, MaskenWert>>) => AnspracheUrteil | null;
  /** Wer eine Aufgabe bzw. Freigabe bekommt: Team-Kennung aus der Maske → Speichername; ohne → die zuständige Person des Falls → die Person des Laufs. */
  person?: (teamId: string | undefined) => string | null;
  /** Agenten-Schritt jetzt erlaubt? Ohne: nicht (kein Modellaufruf). */
  agent?: (a: AgentSchritt, knotenId: string) => AgentFreigabe;
  /** Teilprozess veröffentlicht und laufbar? */
  teilprozess?: (prozessId: string) => { version: number } | null;
  /** Fest (Punkt 40, R1): eine Person des Falls ist eingeschränkt (Art. 18) bzw. hat eine Werbesperre — der Lauf endet. */
  ausgenommen?: 'art18' | 'werbesperre' | null;
  /** Den Fall gibt es nicht mehr (gelöscht, Art. 17 getilgt). */
  fallFehlt?: boolean;
  /** Ziel/Abbruch des Prozesses (Einstellung). */
  einstellung?: LaufEinstellung;
  /** Frist einer Freigabe, wenn der Knoten nichts sagt (Tage). */
  freigabeFristTage?: number;
  /**
   * Rollen statt Personen (22.10. spät, Regel R8): `rolle:eigner` bzw. `rolle:zustaendig` → Speichername (Aufgabe, Freigabe, Glocke) und Team-Kennung
   * (Follow-up). null = nicht auflösbar → der Schritt hält mit Grund (nie ein Rückfall auf den Inhaber). Ohne Angabe gilt jede Rolle als nicht auflösbar.
   */
  rolle?: (wert: string) => { speicher: string; team: string } | null;
  /** Gesellschaft des Falls (`fall.gesellschaft`) — nur eine Business-Gesellschaft, sonst null (der Schritt hält). Ohne Angabe bleibt der Wert. */
  gesellschaft?: () => string | null;
  /**
   * Postfach-Platzhalter (`postfach.lauf`, `postfach.nachricht`) → Kennung eines Business-Postfachs der Person des Laufs (nie ein privates), sonst null (der
   * Schritt hält). Feste Kennungen bleiben, wie sie sind. Ohne Angabe bleibt der Wert (gesendet wird über das Postfach der freigebenden Person).
   */
  postfach?: (wert: string) => string | null;
  /**
   * „Karte ergänzen“ ohne Agent davor (22.10. spät): welche der Felder an der Firma bzw. am Kontakt des Falls noch leer sind (Kennungen der Maske).
   * `[]` = alles da (nichts zu tun), null = unbekannt (kein CRM, Probelauf) — dann gelten alle Felder als offen.
   */
  karteLuecken?: (ziel: 'firma' | 'kontakt', felder: readonly string[]) => string[] | null;
  /**
   * Werkstatt bau-fertig (22.10., Punkt 9 — „Weg annehmen“): NUR im Schatten (Probelauf) — der angenommene Ausgang einer Raute, Freigabe bzw. eines Wartens statt des
   * Hauptwegs. Unpassende Annahmen (ein Ausgang, den die Form nicht hat) wirken nicht. Scharf nie gelesen.
   */
  annahme?: (knotenId: string) => LaufAusgang | undefined;
  /** NUR im Schatten: was der Schritt täte (Aktion, Warten, Ausgang) — für „Schritt testen“ (Ausgabe als Tabelle). Schreibt nichts, gibt nichts zurück. */
  beobachte?: (b: ProbeBeobachtung) => void;
}

/** Was ein Schritt im Schatten täte (Werkstatt bau-fertig, Punkt 10) — nur für die Ansicht, nie gespeichert. */
export interface ProbeBeobachtung { knoten: string; aktion?: Aktion; warten?: Omit<LaufWarten, 'knoten'>; ausgang?: LaufAusgang; status?: SchrittStatus; grund?: LaufGrund }

// ══ Aktionen (Wirkungen) ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export interface AufgabeBezug { kontaktId?: string; firmaId?: string; dealId?: string; mandatId?: string }
/**
 * Was ein Vorschlag nach der Freigabe selbst bewirkt (22.10. spät, „Bausteine mit eigenem Weg“) — immer über den VORHANDENEN Schreibweg, als die freigebende
 * Person aus ihrer Sitzung (lib/prozesse/lauf-stapel.ts → lib/prozesse/bausteine-server.ts):
 *   crm          eine Art von `crm_vorschlag` (lib/zoe/crm-vorschlag.ts: geprüft beim Vorlegen, übernommen bei der Freigabe — Mandat aus dem Deal, Gästeliste,
 *                Kampagnen-Ergebnis, Anfrage aus dem Webhook). `gaeste`/`webhook`: was der Server beim Vorlegen ergänzt (Gäste aus `gaesteVorschlag`, Felder des
 *                Webhook-Eingangs — fremder Text, darum nur als Vorschlag).
 *   fulfillment  den Fulfillment-Fall des Mandats starten (lib/fulfillment/prozesse/fall-server.ts `fallStartenServer`, Ablauf aus der Produkt-Karte).
 *   termin       einen Termin mit Gast anlegen — die Einladung geht erst mit der Freigabe raus (Kalender-Regel: „Einladung an n Personen …?“ = der Vorschlag;
 *                `einladungBestaetigt` nur aus der Sitzung, der Dienstweg lädt nie ein). Zeit und Kalender setzt der Server beim Vorlegen (freie Zeit der Person).
 * Findet der Server keinen eigenen Weg (kein Ablauf, keine freie Zeit), gilt der Ersatz `danach` (Freigabe + Aufgabe „von Hand“) — nichts wird still übergangen.
 */
export type VorschlagWirkung =
  | { art: 'crm'; eingabe: Record<string, unknown>; gaeste?: { n: number; zielkunden: number; kunden: number }; webhook?: true }
  | { art: 'fulfillment'; mandatId?: string; dealId?: string; vorlageId?: string }
  | { art: 'termin'; titel: string; dauerMin: number; an: Empfaenger; bezug: AufgabeBezug; start?: string; ende?: string; kalender?: string; uid?: string };

/** Was nach der Freigabe gesendet wird (N12) — Empfänger aus dem Fall, Text aus der Vorlage; geändert werden darf nur Betreff/Text. */
export type SendeAuftrag =
  | { kanal: 'mail'; postfach?: string; an: Empfaenger; betreff: string; text: string }
  | { kanal: 'whatsapp'; an: Empfaenger; text?: string; vorlage?: string };

export type Aktion =
  | { art: 'aufgabe'; kennung: string; knoten: string; titel: string; beschreibung: string; an: string | null; faellig?: string; prioritaet?: string; bezug: AufgabeBezug }
  | {
    art: 'vorschlag'; kennung: string; knoten: string; sorte: 'freigabe' | 'entscheidung'; titel: string; nachher: string; vorher?: string;
    fuer: string | null; bis: string; sende?: SendeAuftrag;
    /** Nach der Freigabe: eine Aufgabe für die freigebende Person (Außenwirkung ohne eigenen Weg im Motor — von Hand). */
    danach?: { titel: string; beschreibung: string; bezug: AufgabeBezug };
    /** Was die Freigabe selbst bewirkt (eigener Weg) — gewinnt vor `danach`; der Server entscheidet beim Vorlegen, welches gilt. */
    wirkung?: VorschlagWirkung;
  }
  | { art: 'crm-vorschlag'; kennung: string; knoten: string; titel: string; eingabe: Record<string, unknown> }
  | { art: 'meldung'; kennung: string; knoten: string; an: string | null; titel: string; telegram?: string }
  | { art: 'agent'; kennung: string; knoten: string; titel: string; schritt: AgentSchritt; kostenCent: number }
  | { art: 'teilprozess'; kennung: string; knoten: string; prozessId: string; warten: boolean; uebergabe?: true }
  /** CRM abfragen (22.10. spät, N1): eine Liste von Fällen — nur lesen; das Ergebnis (Kennungen) hält der Lauf in `listen[knoten]`. */
  | { art: 'abfrage'; kennung: string; knoten: string; abfrage: CrmAbfrage }
  /**
   * Schleife je Fall (22.10. spät): je Eintrag der Liste ein Teil-Lauf des veröffentlichten Teilprozesses — höchstens `hoechstens` neue je Lauf (der Rest wartet
   * sichtbar auf den nächsten Lauf), Fälle mit einem Lauf zählen nicht (ein Lauf je Prozess und Fall — so legt ein Wiederholen nichts doppelt an).
   */
  | { art: 'schleife'; kennung: string; knoten: string; prozessId: string; liste: string; hoechstens: number }
  /**
   * Fester Schritt (22.10., Paket Ü — Baustein `system.fest`): der Kern eines überführten System-Ablaufs (lib/prozesse/system-schritte-server.ts). Die Wirkungen
   * tragen die Kennungen des alten Codes (Kennungs-Brücke) — der Lauf hält sie nach dem Ausführen am Schritt fest, nicht `kennung`.
   */
  | { art: 'system'; kennung: string; knoten: string; schritt: SystemSchrittId };

/** Worauf ein Lauf nach dieser Aktion wartet — null: gleich weiter. */
export function warteArtVon(a: Aktion): WarteArt | null {
  if (a.art === 'aufgabe') return 'aufgabe';
  if (a.art === 'vorschlag') return 'freigabe';
  if (a.art === 'teilprozess') return a.warten && !a.uebergabe ? 'teilprozess' : null;
  return null;
}

/** Ergebnis einer Aktion (vom Server) — `voruebergehend` wird wiederholt (Backoff), `dauerhaft` geht über die Fehlerkante bzw. hält an. */
export type AktionErgebnis =
  | {
    ok: true; wirkung?: Wirkung[]; kostenCent?: number; /** Agenten-Schritt: das gefragte Modell und die Tokens (Log-Baum der Läufe-Ansicht). */ modell?: string; token?: { ein: number; aus: number };
    /** CRM-Abfrage: die Liste (Kennungen) für die Schleife. */
    liste?: LaufListe;
    /** Felder für die nächsten Rauten (`abfrage.*`, `schleife.*`, `agent.*`) — nur Kennungen und Zahlen (Vertrag), nie Text. */
    daten?: Record<string, string>;
    /** Zahlen am Schritt (Treffer bzw. gestartete Teil-Läufe, Rest über der Obergrenze, schon versorgt) und ein Hinweis (z. B. Rest im nächsten Lauf). */
    anzahl?: number; rest?: number; uebersprungen?: number; hinweis?: LaufGrund;
    /** Der Schritt hat im Web recherchiert (Frische) bzw. fremden Text gelesen — danach gibt es nur Vorschläge (Regel 6). */
    recherche?: true; fremd?: true;
    /** Nichts zu tun (schon erledigt, nichts vorzuschlagen — Grund in `hinweis`): der Lauf wartet nicht, der Schritt gilt als übersprungen. */
    weiter?: true;
  }
  | { ok: false; art: 'voruebergehend' | 'dauerhaft'; grund: LaufGrund; /** Kosten eines Modellaufrufs, der trotzdem bezahlt ist (z. B. Ergebnis passte nicht zum Vertrag). */ kostenCent?: number };

type Plan =
  | { art: 'weiter'; ausgang: LaufAusgang; status?: SchrittStatus; grund?: LaufGrund; sprung?: string; zaehle?: true }
  | { art: 'ende'; ergebnis: 'erfolg' | 'abbruch' | 'uebergabe'; aktion?: Aktion }
  | { art: 'warten'; warten: Omit<LaufWarten, 'knoten'>; ausgangSchatten: LaufAusgang; grund?: LaufGrund }
  | { art: 'aktion'; aktion: Aktion; schatten: SchrittStatus; ausgangSchatten: LaufAusgang }
  | { art: 'fehler'; grund: LaufGrund }
  | { art: 'pause'; grund: 'budget' };

// ══ Lauf-Grundlagen ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const kopie = (l: ProzessLauf): ProzessLauf => ({ ...l, schritte: l.schritte.map(s => ({ ...s, ...(s.wirkung ? { wirkung: [...s.wirkung] } : {}) })), ...(l.zaehler ? { zaehler: { ...l.zaehler } } : {}), ...(l.wartet ? { wartet: { ...l.wartet } } : {}), ...(l.listen ? { listen: { ...l.listen } } : {}), daten: { ...l.daten } });

/** Der offene Schritt am aktuellen Knoten (zuletzt angekommen, noch nicht verlassen). */
export function offenerSchritt(l: Pick<ProzessLauf, 'schritte' | 'aktuell'>): LaufSchritt | null {
  const s = l.schritte.at(-1);
  return s && s.knoten === l.aktuell && !s.bis ? s : null;
}

function ankommen(l: ProzessLauf, knoten: string, jetzt: string): LaufSchritt {
  const runde = l.schritte.filter(s => s.knoten === knoten).length;
  const s: LaufSchritt = { knoten, status: 'laeuft', ab: jetzt, ...(runde ? { runde } : {}) };
  l.schritte.push(s);
  l.aktuell = knoten;
  return s;
}

function beenden(l: ProzessLauf, status: 'fertig' | 'abgebrochen' | 'fehler', jetzt: string, o: { ergebnis?: ProzessLauf['ergebnis']; grund?: LaufGrund } = {}): void {
  l.status = status;
  if (status !== 'fehler') { l.ende = jetzt; l.aktuell = null; }
  delete l.wartet;
  delete l.inArbeit;
  // Die Listen der CRM-Abfragen leben nur, solange der Lauf offen ist (Kennungen — die Zahlen stehen am Schritt).
  if (status !== 'fehler') delete l.listen;
  if (o.ergebnis) l.ergebnis = o.ergebnis;
  if (o.grund) l.grund = o.grund;
  // Ein offener Schritt wird mit beendet (abgebrochen bzw. Fehler).
  const s = l.schritte.at(-1);
  if (s && !s.bis && status !== 'fertig') { s.status = status === 'fehler' ? 'fehler' : 'abgebrochen'; s.bis = jetzt; if (o.grund) s.grund = o.grund; }
}

/** Kanten als Nachschlag `von → Ausgang → nach` (undefined = kein solcher Ausgang). */
function kantenIndex(def: Pick<ProzessDefinition, 'knoten'>): Map<string, Map<LaufAusgang, string | null>> {
  const m = new Map<string, Map<LaufAusgang, string | null>>();
  for (const k of kantenVon(def) as Kante[]) {
    const x = m.get(k.von) ?? new Map<LaufAusgang, string | null>();
    if (!x.has(k.ausgang)) x.set(k.ausgang, k.nach);
    m.set(k.von, x);
  }
  return m;
}

/** Wohin es nach einer Erinnerung geht, wenn die Runden aus sind: der Strang ohne den Sprung zurück zur Entscheidung. */
function ausstiegZiel(def: Pick<ProzessDefinition, 'knoten'>, k: K): string | null {
  const ohne = { knoten: def.knoten.map(x => (x.id === k.id ? { ...x, zweige: { ...x.zweige, ja: undefined } } : x)) };
  return kantenVon(ohne).find(x => x.von === k.id && x.ausgang === 'weiter')?.nach ?? null;
}

const zahl = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const text = (v: unknown): string => (typeof v === 'string' ? v : '');
const werteVon = (k: K, e: KatalogEintrag | null): Record<string, MaskenWert> => ({ ...(e ? maskeVorgaben(e) : {}), ...(k.katalog?.werte ?? {}) });

/** Eine Textvorlage mit den Platzhaltern des Laufs füllen (fehlende Werte → leer). */
function fuellen(vorlage: unknown, u: LaufUmfeld): string {
  const v = text(vorlage);
  if (!v) return '';
  return textvorlageFuellen(v, { 'prozess.titel': u.titel, heute: tagVonIso(u.jetzt), ...(u.platzhalter ?? {}) }).text.trim();
}

/** Bezug einer Aufgabe aus Fall und Ereignis (nur Kennungen). */
export function bezugAus(l: Pick<ProzessLauf, 'fall' | 'daten'>, u?: Pick<LaufUmfeld, 'empfaenger'>): AufgabeBezug {
  const b: AufgabeBezug = {};
  const d = l.daten;
  if (l.fall.art === 'deal' && l.fall.id) b.dealId = l.fall.id; else if (d['bezug.dealid']) b.dealId = d['bezug.dealid'];
  if (l.fall.art === 'mandat' && l.fall.id) b.mandatId = l.fall.id; else if (d['bezug.mandatid']) b.mandatId = d['bezug.mandatid'];
  if ((l.fall.art === 'firma' || (l.fall.art === 'lead' && l.fall.id?.startsWith('f-'))) && l.fall.id) b.firmaId = l.fall.id; else if (d['bezug.firmaid']) b.firmaId = d['bezug.firmaid'];
  const k = u?.empfaenger?.('fall.kontakt')?.kontaktId ?? (l.fall.art === 'lead' && l.fall.id && !l.fall.id.startsWith('f-') ? l.fall.id : d['bezug.kontaktid']);
  if (k) b.kontaktId = k;
  return b;
}

// ══ Der Plan je Knoten ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const AUFGABE_BAUSTEINE = new Set(['aufgabe.anlegen', 'crm.outreach-aufgabe', 'aufgabe.an-zoe', 'kalender.block', 'crm.uebergeben', 'crm.kontakt-pflegen']);
const LESEN_BAUSTEINE = new Set(['crm.firma-akte']);
/** Bausteine, die als CRM-Vorschlag in den Stapel gehen (`crm_vorschlag`) — seit 22.10. spät auch Deal vorschlagen, nächster Schritt am Deal, Lead parken, Text-Entwurf. */
const CRM_VORSCHLAG_BAUSTEINE = new Set(['crm.kontakt-notiz', 'crm.deal-anlegen', 'crm.deal-stufe', 'crm.lead-qualifizieren', 'crm.followup', 'angebot.entwurf',
  'crm.deal-vorschlagen', 'crm.deal-schritt', 'crm.lead-parken', 'crm.entwurf-text']);
const SENDE_BAUSTEINE = new Set(['inbox.mail-entwurf', 'whatsapp.entwurf']);

/**
 * Wer ist gemeint? (rein) Eine ROLLE (`rolle:eigner`, `rolle:zustaendig`) löst das Umfeld auf — nicht auflösbar → der Schritt hält mit Grund (Regel 5: nie ein
 * Rückfall auf den Inhaber); sonst wie bisher die Person aus der Maske, die zuständige Person des Falls bzw. die Person des Laufs.
 */
function werVon(u: LaufUmfeld, l: ProzessLauf, wer: unknown): { an: string | null } | { fehler: LaufGrund } {
  if (istRolle(wer)) { const r = u.rolle?.(wer) ?? null; return r ? { an: r.speicher } : { fehler: 'rolle-fehlt' }; }
  return { an: u.person?.(typeof wer === 'string' ? wer : undefined) ?? l.person };
}
/** Ein Postfach-Platzhalter wird über das Umfeld aufgelöst (null = kein passendes Business-Postfach); feste Kennungen bleiben. */
function postfachVon(u: LaufUmfeld, wert: unknown): string | null | undefined {
  if (typeof wert !== 'string' || !wert) return undefined;
  if ((wert === POSTFACH_DES_LAUFS || wert === POSTFACH_DER_NACHRICHT) && u.postfach) return u.postfach(wert);
  return wert;
}

function bis(u: LaufUmfeld, tage: unknown): string {
  const t = zahl(tage);
  return zeitPlus(u.jetzt, { tage: t !== undefined && t >= 1 ? t : u.freigabeFristTage ?? LAUF_GRENZEN.freigabeFristTage });
}

function aufgabePlan(l: ProzessLauf, k: K, kennung: string, u: LaufUmfeld, o: { titel: string; beschreibung?: string; wer?: unknown; fristTage?: unknown; prioritaet?: unknown; hinweis?: string }): Plan {
  const frist = zahl(o.fristTage);
  const beschreibung = [o.beschreibung, `Schritt im Prozess „${u.titel}“. Hakt ihr die Aufgabe ab, geht der Prozess weiter.`, o.hinweis].filter(Boolean).join('\n\n');
  const wer = werVon(u, l, o.wer);
  if ('fehler' in wer) return { art: 'fehler', grund: wer.fehler };
  return {
    art: 'aktion', schatten: 'wuerde', ausgangSchatten: 'weiter',
    aktion: {
      art: 'aufgabe', kennung, knoten: k.id, titel: (o.titel || k.titel).slice(0, 300), beschreibung: beschreibung.slice(0, 4000),
      an: wer.an,
      ...(frist !== undefined ? { faellig: tagPlus(tagVonIso(u.jetzt), Math.max(0, Math.round(frist))) } : {}),
      ...(typeof o.prioritaet === 'string' ? { prioritaet: o.prioritaet } : {}),
      bezug: bezugAus(l, u),
    },
  };
}

/** Den Plan einer Außenwirkung vor ihrem Schloss (der Knoten selbst wirkt nie — das Schloss legt den Vorschlag). */
function aussenVorbereiten(k: K, def: ProzessDefinition, u: LaufUmfeld, e: KatalogEintrag | null): Plan {
  if (!schloesser(def.knoten).has(k.id)) return { art: 'fehler', grund: 'schloss-fehlt' };
  const urteil = e ? u.ansprache?.(e, werteVon(k, e)) ?? null : null;
  if (urteil && !urteil.erlaubt) return { art: 'weiter', ausgang: 'weiter', status: 'uebersprungen', grund: 'kanal-rot' };
  // Postfach „des Laufs“ bzw. „der Nachricht“ (Vorlagen): ohne passendes Business-Postfach hält der Schritt HIER — nie ein privates, nie eins einer anderen Person.
  if (e?.id === 'inbox.mail-entwurf' && postfachVon(u, werteVon(k, e).postfach) === null) return { art: 'fehler', grund: 'kein-postfach' };
  return { art: 'weiter', ausgang: 'weiter', status: 'erledigt', grund: 'vorbereitet' };
}

/** Der Vorschlag eines Schlosses für seinen Knoten `x` (Punkt 61): Mail/WhatsApp mit Empfänger und Text; sonst Freigabe + Aufgabe „von Hand“. */
function schlossPlan(l: ProzessLauf, schloss: K, x: K, kennung: string, u: LaufUmfeld): Plan {
  const e = katalogEintrag(x.katalog?.id);
  const werte = werteVon(x, e);
  // Wer freigibt: die Person der Maske am Schloss (Rolle), sonst am Knoten — sonst wie bisher.
  const schlossWerte = katalogEintrag(schloss.katalog?.id) ? werteVon(schloss, katalogEintrag(schloss.katalog?.id)) : {};
  const w = werVon(u, l, typeof schlossWerte.wer === 'string' && schlossWerte.wer ? schlossWerte.wer : werte.wer);
  if ('fehler' in w) return { art: 'fehler', grund: w.fehler };
  const fuer = w.an;
  const frist = bis(u, katalogEintrag(schloss.katalog?.id) ? schlossWerte.fristTage : undefined);
  if (e && SENDE_BAUSTEINE.has(e.id)) {
    const urteil = u.ansprache?.(e, werte) ?? null;
    if (urteil && !urteil.erlaubt) return { art: 'weiter', ausgang: 'nein', status: 'uebersprungen', grund: 'kanal-rot' };
    const an = u.empfaenger?.(typeof werte.an === 'string' ? werte.an : 'fall.kontakt') ?? null;
    if (e.id === 'inbox.mail-entwurf') {
      if (!an?.email) return { art: 'weiter', ausgang: 'nein', status: 'uebersprungen', grund: 'kein-empfaenger' };
      const betreff = fuellen(werte.betreff, u), txt = fuellen(werte.text, u);
      const postfach = postfachVon(u, werte.postfach);
      if (postfach === null) return { art: 'fehler', grund: 'kein-postfach' };
      return {
        art: 'aktion', schatten: 'freigabe', ausgangSchatten: 'ja',
        aktion: {
          art: 'vorschlag', kennung, knoten: schloss.id, sorte: 'freigabe', titel: `${x.titel}: Mail an ${an.name}`.slice(0, 200),
          nachher: `An: ${an.name} <${an.email}>\nBetreff: ${betreff}\n\n${txt}${urteil?.farbe === 'gelb' ? `\n\nHinweis Kanal-Ampel: ${urteil.grund}` : ''}`.slice(0, 8000),
          fuer, bis: frist,
          sende: { kanal: 'mail', ...(postfach ? { postfach } : {}), an, betreff, text: txt },
        },
      };
    }
    if (!an?.telefon) return { art: 'weiter', ausgang: 'nein', status: 'uebersprungen', grund: 'kein-empfaenger' };
    const txt = fuellen(werte.text, u);
    const vorlage = typeof werte.vorlage === 'string' && werte.vorlage ? werte.vorlage : undefined;
    return {
      art: 'aktion', schatten: 'freigabe', ausgangSchatten: 'ja',
      aktion: {
        art: 'vorschlag', kennung, knoten: schloss.id, sorte: 'freigabe', titel: `${x.titel}: WhatsApp an ${an.name}`.slice(0, 200),
        nachher: `An: ${an.name} (WhatsApp)\n${vorlage ? `Vorlage: ${vorlage}\n` : ''}\n${txt}`.slice(0, 8000), fuer, bis: frist,
        sende: { kanal: 'whatsapp', an, ...(txt ? { text: txt } : {}), ...(vorlage ? { vorlage } : {}) },
      },
    };
  }
  // Andere Außenwirkung (Angebot stellen, Einladung, Rechnung, Papierkorb, Agent im „tödlichen Dreieck“): erst die Freigabe, dann von Hand — außer der Baustein
  // hat seinen eigenen Weg (22.10. spät): Mandat aus dem Deal (Klasse geld, ein Klick) und Termin mit Einladung (Rückfrage „Einladung an n Personen …“).
  const vonHand = !!e && !e.agent;
  const wirkung = e ? schlossWirkung(l, x, e, werte, u) : null;
  return {
    art: 'aktion', schatten: 'freigabe', ausgangSchatten: 'ja',
    aktion: {
      ...(wirkung ? { wirkung } : {}),
      art: 'vorschlag', kennung, knoten: schloss.id, sorte: 'freigabe', titel: `Freigabe: ${x.titel}`.slice(0, 200),
      nachher: x.form === 'agent'
        // Agent im „tödlichen Dreieck“ (private Daten, fremder Text, Weg nach außen): sein Ergebnis liegt schon als Vorschlag im Stapel — hier geht es nur ums Weitermachen.
        ? `Der Agenten-Schritt „${x.titel}“ im Prozess „${u.titel}“ ist gelaufen — sein Ergebnis liegt als Vorschlag im Stapel (übernommen wird erst dort). Freigeben = der Prozess geht damit weiter.`
        : `Der Prozess „${u.titel}“ möchte: ${x.titel}.${vonHand ? ' Nach der Freigabe entsteht eine Aufgabe — ausgeführt wird von Hand.' : ''}`,
      fuer, bis: frist,
      ...(vonHand ? { danach: { titel: `Von Hand: ${x.titel}`.slice(0, 300), beschreibung: `Freigegeben im Prozess „${u.titel}“ — bitte jetzt ausführen und abhaken.`, bezug: bezugAus(l, u) } } : {}),
    },
  };
}

/** Score-Raute (rein): Lead-Score ≥ Schwelle, Temperatur, SQL-bereit, MQL — aus den Fall-Feldern (der Score bleibt abgeleitet). null = Daten fehlen. */
function scoreTrifft(r: Extract<NonNullable<K['raute']>, { art: 'score' }>, d: Readonly<Record<string, unknown>>): boolean | null {
  switch (r.pruefung) {
    case 'score': { const s = zahl(d['lead.score']); return s === undefined ? null : s >= (r.schwelle ?? 0); }
    case 'temperatur': { const t = d['lead.temperatur']; return typeof t === 'string' ? (r.temperatur ?? []).includes(t as never) : null; }
    case 'sql-bereit': { const v = d['lead.sql-bereit']; return typeof v === 'boolean' ? v : null; }
    case 'mql': { const v = d['lead.mql']; return typeof v === 'boolean' ? v : null; }
  }
}

function crmVorschlagEingabe(l: ProzessLauf, k: K, e: KatalogEintrag, u: LaufUmfeld): Record<string, unknown> | null | { fehler: LaufGrund } {
  const w = werteVon(k, e);
  const b = bezugAus(l, u);
  const heute = tagVonIso(u.jetzt);
  const in_ = (n: unknown) => tagPlus(heute, Math.max(0, Math.round(zahl(n) ?? 0)));
  const leadId = l.fall.art === 'lead' || l.fall.art === 'firma' ? l.fall.id : b.firmaId ?? b.kontaktId;
  // Zuständig als Rolle (Follow-up): die Team-Kennung der Rolle — nicht auflösbar → der Schritt hält.
  let zustaendig: string | undefined;
  if (typeof w.wer === 'string' && w.wer) {
    if (istRolle(w.wer)) { const r = u.rolle?.(w.wer) ?? null; if (!r) return { fehler: 'rolle-fehlt' }; zustaendig = r.team; } else zustaendig = w.wer;
  }
  // Ein Wert aus dem Agenten-Schritt davor (Vertrag, nur Zahlen) — z. B. „in wie vielen Tagen“ (V09a): vor der Vorgabe der Maske.
  const agentTage = zahl(Number(l.daten['agent.intagen'] ?? NaN));
  switch (e.id) {
    case 'crm.kontakt-notiz': return b.kontaktId ? { art: 'aktivitaet', kontakt: b.kontaktId, aktivitaet_art: 'notiz', text: fuellen(w.text, u) || k.titel } : null;
    case 'crm.deal-anlegen': return b.kontaktId ? { art: 'deal_anlegen', kontakt: b.kontaktId, titel: fuellen(w.titel, u) || k.titel, naechster_schritt: fuellen(w.naechsterSchritt, u) || k.titel, faellig: in_(w.inTagen) } : null;
    case 'crm.deal-stufe': return b.dealId && typeof w.stufe === 'string' ? { art: 'deal_aendern', deal: b.dealId, stufe: w.stufe, ...(text(w.grund) ? { grund: text(w.grund) } : {}) } : null;
    case 'crm.lead-qualifizieren': return leadId && typeof w.status === 'string' ? { art: 'qualifizierung', lead: leadId, lead_status: w.status } : null;
    case 'crm.followup': {
      if (!b.kontaktId && !b.firmaId && !b.dealId && !b.mandatId) return null;
      return { art: 'followup', text: fuellen(w.text, u) || k.titel, faellig: in_(w.inTagen), ...(b.kontaktId ? { kontakt: b.kontaktId } : {}), ...(b.firmaId ? { firma: b.firmaId } : {}), ...(b.dealId ? { deal: b.dealId } : {}), ...(b.mandatId ? { mandat: b.mandatId } : {}), ...(zustaendig ? { zustaendig } : {}) };
    }
    case 'angebot.entwurf': {
      if (typeof w.gesellschaft !== 'string') return null;
      // „Gesellschaft des Falls“ (Vorlagen): nur eine Business-Gesellschaft des Deals bzw. Mandats — ohne sie hält der Schritt.
      const g = w.gesellschaft === GESELLSCHAFT_DES_FALLS && u.gesellschaft ? u.gesellschaft() : w.gesellschaft;
      if (!g) return { fehler: 'gesellschaft-fehlt' };
      return { art: 'angebot_entwurf', gesellschaft: g, ...(b.kontaktId ? { kontakt: b.kontaktId } : {}), ...(b.firmaId ? { firma: b.firmaId } : {}), ...(b.dealId ? { deal: b.dealId } : {}) };
    }
    // Seit 22.10. spät (Vorlagen der Kundengewinnung): dieselben Vorschlags-Arten wie ZOE — übernommen erst per Klick.
    case 'crm.deal-vorschlagen': return b.kontaktId ? { art: 'deal_anlegen', kontakt: b.kontaktId, titel: fuellen(w.titel, u) || k.titel, naechster_schritt: fuellen(w.naechsterSchritt, u) || k.titel, faellig: in_(w.inTagen) } : null;
    case 'crm.deal-schritt': return b.dealId ? { art: 'deal_aendern', deal: b.dealId, naechster_schritt: fuellen(w.naechsterSchritt, u) || k.titel, faellig: in_(agentTage !== undefined && agentTage >= 0 && agentTage <= 365 ? agentTage : w.inTagen) } : null;
    case 'crm.lead-parken': return leadId ? { art: 'lead_parken', lead: leadId, park_tage: Math.max(1, Math.min(365, Math.round(zahl(w.parkTage) ?? 90))), ...(typeof w.grundArt === 'string' ? { grund_art: w.grundArt } : {}) } : null;
    case 'crm.entwurf-text': {
      // Ohne Text in der Maske (22.10. spät): ein Gerüst aus den Platzhaltern des Falls und dem Anlass (lib/prozesse/kundengewinnung/text-geruest.ts — kein Modell).
      const t = fuellen(w.text, u) || textGeruest({ art: w.art, kanal: w.kanal, anlass: w.anlass, titel: k.titel, p: u.platzhalter ?? {} });
      if (!b.kontaktId || !t || typeof w.art !== 'string') return null;
      return { art: w.art, kontakt: b.kontaktId, text: t, ...(typeof w.kanal === 'string' ? { kanal: w.kanal } : {}), ...(text(w.anlass) ? { begruendung: `Anlass: ${text(w.anlass)}` } : {}) };
    }
  }
  return null;
}

/** Ergebnis-Werte eines Kampagnen-Ergebnisses (dieselben wie POST /api/crm/kampagnen `ergebnis`). */
const KAMPAGNEN_ERGEBNISSE = ['angesprochen', 'reagiert', 'gespraech', 'chance', 'kein_interesse'] as const;
const zwischen = (v: unknown, min: number, max: number, vorgabe: number): number => { const z = zahl(v); return z === undefined ? vorgabe : Math.max(min, Math.min(max, Math.round(z))); };

/**
 * Ein Vorschlag, der nach der Freigabe selbst wirkt (22.10. spät) — der Lauf wartet darauf: freigegeben → weiter (die nächsten Rauten lesen den neuen Stand
 * im CRM), abgelehnt bzw. abgelaufen → ebenfalls weiter, als „übersprungen“ (die Person hat es anders gelöst; `freigabeEntschieden`). Ersatz „von Hand“
 * (`danach`), wenn der Server keinen eigenen Weg findet. Im Schatten: „würde zur Freigabe vorlegen“.
 */
function uebernahmePlan(l: ProzessLauf, k: K, kennung: string, u: LaufUmfeld, o: { titel: string; nachher: string; wirkung: VorschlagWirkung; wer?: unknown; fristTage?: unknown }): Plan {
  const w = werVon(u, l, o.wer);
  if ('fehler' in w) return { art: 'fehler', grund: w.fehler };
  return {
    art: 'aktion', schatten: 'freigabe', ausgangSchatten: 'weiter',
    aktion: {
      art: 'vorschlag', kennung, knoten: k.id, sorte: 'freigabe', titel: o.titel.slice(0, 200), nachher: o.nachher.slice(0, 8000), fuer: w.an, bis: bis(u, o.fristTage), wirkung: o.wirkung,
      danach: { titel: `Von Hand: ${k.titel}`.slice(0, 300), beschreibung: `Freigegeben im Prozess „${u.titel}“ — bitte jetzt ausführen und abhaken.`, bezug: bezugAus(l, u) },
    },
  };
}

/** Der eigene Weg eines Bausteins ohne Schloss (Fall starten, Gäste vorschlagen, Kampagnen-Ergebnis, Anfrage übernehmen) — sonst null. Rein. */
function eigenerWegPlan(l: ProzessLauf, k: K, e: KatalogEintrag | null, werte: Readonly<Record<string, MaskenWert>>, u: LaufUmfeld, kennung: string): Plan | null {
  if (!e) return null;
  const b = bezugAus(l, u);
  const fehlen: Plan = { art: 'weiter', ausgang: 'weiter', status: 'uebersprungen', grund: 'daten-fehlen' };
  const p = u.platzhalter ?? {};
  const name = (x: unknown) => (typeof x === 'string' && x.trim() ? ` · ${x.trim().slice(0, 80)}` : '');
  switch (e.id) {
    case 'fulfillment.fall-starten': {
      if (!b.mandatId && !b.dealId) return fehlen;
      return uebernahmePlan(l, k, kennung, u, {
        titel: `Fall starten${name(p['firma.name'])}`, nachher: `Der Prozess „${u.titel}“ schlägt vor, den Fulfillment-Fall des Mandats jetzt zu starten (Ablauf aus der Produkt-Karte) — statt erst im Morgenlauf.`,
        wirkung: { art: 'fulfillment', ...(b.mandatId ? { mandatId: b.mandatId } : {}), ...(b.dealId ? { dealId: b.dealId } : {}) }, wer: werte.wer,
      });
    }
    case 'event.gaeste': {
      const eventId = l.fall.art === 'event' ? l.fall.id : l.daten['bezug.eventid'];
      if (!eventId) return fehlen;
      const gaeste = { n: zwischen(werte.n, 1, 200, 12), zielkunden: zwischen(werte.mixZielkunden, 0, 100, 40), kunden: zwischen(werte.mixKunden, 0, 100, 20) };
      return uebernahmePlan(l, k, kennung, u, {
        titel: `Gäste vorschlagen${name(p['event.titel'])}`, nachher: `Bis zu ${gaeste.n} Gäste in der Mischung (Zielkunden ${gaeste.zielkunden} %, Kunden ${gaeste.kunden} %) als „vorgemerkt“ — nur zulässige Einladungswege, eingeladen wird nichts.`,
        wirkung: { art: 'crm', eingabe: { art: 'gaesteliste', event: eventId }, gaeste },
      });
    }
    case 'crm.kampagnen-ergebnis': {
      const kampagne = l.fall.art === 'kampagne' ? l.fall.id : l.daten['bezug.kampagneid'];
      if (!kampagne || !b.kontaktId) return fehlen;
      const ergebnis = (KAMPAGNEN_ERGEBNISSE as readonly unknown[]).includes(werte.ergebnis) ? werte.ergebnis as string : undefined;
      return uebernahmePlan(l, k, kennung, u, {
        titel: `Kampagnen-Ergebnis${name(p['kampagne.titel'])}`, nachher: ergebnis ? `Ergebnis „${ergebnis}“ in der Kampagne festhalten.` : 'Das Ergebnis in der Kampagne festhalten (aus dem Verlauf seit dem Start abgeleitet).',
        wirkung: { art: 'crm', eingabe: { art: 'kampagnen_ergebnis', kampagne, kontakt: b.kontaktId, ...(ergebnis ? { ergebnis } : {}) } },
      });
    }
    case 'crm.anfrage-anlegen': {
      // Nur aus einem Webhook-Eingang (fremder Text — die Felder liest erst der Server, als Vorschlag; E-V1). Ohne Eingang gibt es nichts zu übernehmen.
      if (!l.daten['bezug.eingangid']) return fehlen;
      const kanal = typeof werte.kanal === 'string' && werte.kanal ? werte.kanal : 'website';
      return uebernahmePlan(l, k, kennung, u, {
        titel: 'Anfrage übernehmen', nachher: `Aus dem Eingang des Webhooks eine Anfrage (Kanal ${kanal}) — Dublette, Art. 18 und Werbesperre prüft der Vorschlag; versendet wird nichts.`,
        wirkung: { art: 'crm', eingabe: { art: 'anfrage_anlegen', kanal }, webhook: true },
      });
    }
  }
  return null;
}

/** Der eigene Weg hinter einem Schloss (Mandat anlegen, Termin mit Einladung) — sonst null (dann Freigabe + Aufgabe „von Hand“). Rein. */
function schlossWirkung(l: ProzessLauf, x: K, e: KatalogEintrag, werte: Readonly<Record<string, MaskenWert>>, u: LaufUmfeld): VorschlagWirkung | null {
  const b = bezugAus(l, u);
  if (e.id === 'crm.mandat-anlegen') return b.dealId ? { art: 'crm', eingabe: { art: 'mandat_anlegen', deal: b.dealId } } : null;
  if (e.id === 'kalender.einladung') {
    const an = u.empfaenger?.(typeof werte.gaeste === 'string' && werte.gaeste ? werte.gaeste : 'fall.kontakt') ?? null;
    if (!an?.email) return null;
    return { art: 'termin', titel: (fuellen(werte.titel, u) || x.titel).slice(0, 300), dauerMin: zwischen(werte.dauerMin, 15, 480, 30), an, bezug: b };
  }
  return null;
}

function planFuer(l: ProzessLauf, k: K, def: ProzessDefinition, u: LaufUmfeld, kennung: string): Plan {
  const form: ProzessForm = k.form ?? 'schritt';
  const e = katalogEintrag(k.katalog?.id);
  const werte = werteVon(k, e);
  // Werkstatt bau-fertig (Punkt 14): ausgeschaltet → übersprungen, weiter über den Hauptweg (Raute „ja“, Freigabe „freigegeben“). Ein Schloss dahinter wird mit
  // übersprungen (unten bei `freigabe`). Auslöser, Ende und Schloss lassen sich nicht ausschalten — dort wirkt das Feld nicht.
  if (k.deaktiviert && form !== 'ausloeser' && form !== 'ende' && !k.schloss) return { art: 'weiter', ausgang: form === 'entscheidung' || form === 'freigabe' ? 'ja' : 'weiter', status: 'uebersprungen', grund: 'deaktiviert' };
  switch (form) {
    case 'ausloeser': return { art: 'weiter', ausgang: 'weiter', status: 'erledigt' };
    case 'ende': {
      const ergebnis = k.ende?.ergebnis ?? 'erfolg';
      if (ergebnis === 'uebergabe' && k.ende?.uebergabeAn) {
        if (!u.teilprozess?.(k.ende.uebergabeAn)) return { art: 'fehler', grund: 'teilprozess-fehlt' };
        if (l.tiefe + 1 > LAUF_GRENZEN.kettenTiefe) return { art: 'fehler', grund: 'kette' };
        return { art: 'ende', ergebnis, aktion: { art: 'teilprozess', kennung, knoten: k.id, prozessId: k.ende.uebergabeAn, warten: false, uebergabe: true } };
      }
      return { art: 'ende', ergebnis };
    }
    case 'entscheidung': {
      const r = k.raute;
      // Die Felder des Laufs (abfrage.*, schleife.*, agent.* — Ergebnisse der Schritte davor) und des Falls bzw. Ereignisses.
      const felder = { ...l.daten, ...u.daten };
      if (r?.art === 'regel') return { art: 'weiter', ausgang: bedingungenTreffen(r.bedingungen, felder, r.verknuepfung) ? 'ja' : 'nein', status: 'erledigt' };
      if (r?.art === 'score') { const t = scoreTrifft(r, felder); return { art: 'weiter', ausgang: t ? 'ja' : 'nein', status: 'erledigt', ...(t === null ? { grund: 'daten-fehlen' as const } : {}) }; }
      // Entscheidung 21.10.: keine Rauten, über die ein Modell entscheidet — in C1 hält so ein Lauf an (Fehlerkante, sonst angehalten).
      if (r?.art === 'modell') return { art: 'fehler', grund: 'modell-raute' };
      const frage = text(werte.frage) || k.titel;
      const wer = werVon(u, l, werte.wer);
      if ('fehler' in wer) return { art: 'fehler', grund: wer.fehler };
      return {
        art: 'aktion', schatten: 'freigabe', ausgangSchatten: 'ja',
        aktion: {
          art: 'vorschlag', kennung, knoten: k.id, sorte: 'entscheidung', titel: `Entscheidung: ${frage}`.slice(0, 200),
          nachher: `${frage}\n\nFreigeben = ja · Ablehnen = nein (Prozess „${u.titel}“).`, fuer: wer.an,
          // Die Frist aus der Maske; übernommene Vorlagen bis 22.10. trugen sie nur am Knoten (`frist`).
          bis: bis(u, werte.fristTage ?? k.frist),
        },
      };
    }
    case 'freigabe': {
      if (k.schloss?.fuer) {
        const x = def.knoten.find(y => y.id === k.schloss!.fuer);
        if (!x) return { art: 'fehler', grund: 'knoten-fehlt' };
        // Wurde der Schritt hinter dem Schloss übersprungen (Kanal rot, Recherche frisch …), gibt es nichts freizugeben: ein Agent geht weiter („ja“ — sein Ergebnis
        // fehlt nur), eine Außenwirkung nicht („nein“ — wie bei Mail/WhatsApp; nie eine Aufgabe „von Hand“ für etwas, das nicht sein darf).
        const vorher = [...l.schritte].reverse().find(y => y.knoten === x.id);
        // Ausgeschaltet (Punkt 14): das Schloss wird mit übersprungen und der Lauf geht weiter wie freigegeben — es war nichts freizugeben, nichts ist nach außen gegangen.
        if (vorher?.status === 'uebersprungen') return { art: 'weiter', ausgang: x.form === 'agent' || vorher.grund === 'deaktiviert' ? 'ja' : 'nein', status: 'uebersprungen', grund: vorher.grund ?? 'kein-weg' };
        return schlossPlan(l, k, x, kennung, u);
      }
      const wer = werVon(u, l, werte.wer);
      if ('fehler' in wer) return { art: 'fehler', grund: wer.fehler };
      return {
        art: 'aktion', schatten: 'freigabe', ausgangSchatten: 'ja',
        aktion: {
          art: 'vorschlag', kennung, knoten: k.id, sorte: 'freigabe', titel: `Freigabe: ${k.titel}`.slice(0, 200), nachher: `Der Prozess „${u.titel}“ wartet auf deine Freigabe: ${k.titel}.`,
          fuer: wer.an, bis: bis(u, werte.fristTage),
        },
      };
    }
    case 'warten': {
      const w = k.warten;
      if (!w) return { art: 'fehler', grund: 'daten-fehlen' };
      if (w.art === 'dauer') return { art: 'warten', ausgangSchatten: 'weiter', warten: { art: 'zeit', bis: zeitPlus(u.jetzt, { tage: w.tage, stunden: w.stunden, arbeitszeit: w.arbeitszeit }) } };
      if (w.art === 'datum') {
        // Stichtag wie beim Datums-Auslöser (lib/prozesse/datum-start.ts): Kalendertage bzw. — mit `werktage` — Werktage NRW über den Kalender-Kern.
        const d = u.fallDatum?.(w.feld) ?? null;
        const stichtag = d ? stichtagVon(d, { versatzTage: w.versatzTage ?? 0, ...(w.werktage ? { werktage: true } : {}) }) : null;
        const ziel = stichtag ? tagIso(stichtag) : undefined;
        const ober = zeitPlus(u.jetzt, { tage: Math.max(1, w.hoechstensTage) });
        if (ziel && ziel <= u.jetzt) return { art: 'weiter', ausgang: 'eingetreten', status: 'erledigt' };
        return { art: 'warten', ausgangSchatten: 'eingetreten', warten: { art: 'datum', bis: ziel && ziel < ober ? ziel : ober, ...(ziel ? { ziel } : {}) } };
      }
      const ober = w.hoechstensStunden ? (w.arbeitszeit ? arbeitsstundenPlus(u.jetzt, w.hoechstensStunden) : zeitPlus(u.jetzt, { stunden: w.hoechstensStunden }))
        : zeitPlus(u.jetzt, { tage: Math.max(1, w.hoechstensTage), arbeitszeit: w.arbeitszeit });
      return { art: 'warten', ausgangSchatten: 'eingetreten', warten: { art: 'ereignis', ereignis: w.ereignis, bis: ober } };
    }
    case 'agent': {
      const a = k.agent;
      if (!a) return { art: 'fehler', grund: 'agent-fehlt' };
      const f: AgentFreigabe = u.agent?.(a, k.id) ?? { ok: false, grund: 'ki-aus' };
      if (f.ok) return { art: 'aktion', schatten: 'wuerde', ausgangSchatten: 'weiter', aktion: { art: 'agent', kennung, knoten: k.id, titel: k.titel, schritt: a, kostenCent: f.kostenCent } };
      // Recherche-Frische (M6): ohne Modellaufruf weiter — der Lauf nimmt den Weg „weiter“, der Grund steht am Schritt.
      if (f.ueberspringen) return { art: 'weiter', ausgang: 'weiter', status: 'uebersprungen', grund: f.grund };
      if (f.pause) return { art: 'pause', grund: 'budget' };
      // Warten: Takt-Fenster (Nachtlauf, E-V5), Tageshöchstzahl des Heads (E-V6) bzw. gedrosselt — derselbe Schritt kommt danach wieder dran.
      if (f.bis) return { art: 'warten', ausgangSchatten: 'weiter', warten: { art: 'fenster', bis: f.bis }, grund: f.grund };
      return { art: 'fehler', grund: f.grund };
    }
    case 'teilprozess': {
      const t = k.teilprozess;
      if (!t?.prozessId || !u.teilprozess?.(t.prozessId)) return { art: 'fehler', grund: 'teilprozess-fehlt' };
      if (l.tiefe + 1 > LAUF_GRENZEN.kettenTiefe) return { art: 'fehler', grund: 'kette' };
      const warten = t.warten !== false;
      return { art: 'aktion', schatten: 'wuerde', ausgangSchatten: 'weiter', aktion: { art: 'teilprozess', kennung, knoten: k.id, prozessId: t.prozessId, warten } };
    }
    case 'schleife': {
      // Schleife je Fall (22.10. spät): je Eintrag der Liste ein Teil-Lauf des veröffentlichten Teilprozesses. Der Lauf wartet nicht darauf (Abendbericht,
      // Auswertung und Uhren modellieren die Vorlagen selbst); die Obergrenze gilt je Lauf, der Rest wartet sichtbar auf den nächsten Lauf.
      const sl = k.schleife;
      if (!sl?.prozessId || !sl.liste) return { art: 'fehler', grund: 'liste-fehlt' };
      if (!u.teilprozess?.(sl.prozessId)) return { art: 'fehler', grund: 'teilprozess-fehlt' };
      if (l.tiefe + 1 > LAUF_GRENZEN.kettenTiefe) return { art: 'fehler', grund: 'kette' };
      if (sl.liste.startsWith('abfrage:') && !def.knoten.some(x => x.id === sl.liste.slice(8) && x.abfrage)) return { art: 'fehler', grund: 'liste-fehlt' };
      const hoechstens = Math.max(1, Math.min(PROZESS_GRENZEN.schleifeHoechstens, Math.round(sl.hoechstens || 1)));
      return { art: 'aktion', schatten: 'wuerde', ausgangSchatten: 'weiter', aktion: { art: 'schleife', kennung, knoten: k.id, prozessId: sl.prozessId, liste: sl.liste, hoechstens } };
    }
    case 'erinnerung': {
      const runden = l.zaehler?.[k.id] ?? 0;
      const versuche = zahl(werte.versuche) ?? k.versuche ?? 5;
      if (runden >= versuche) return { art: 'weiter', ausgang: 'weiter', status: 'abgelaufen', grund: 'abgelaufen', sprung: ausstiegZiel(def, k) ?? '' };
      return aufgabePlan(l, k, kennung, u, { titel: `Erinnerung: ${k.titel}`, fristTage: werte.fristTage, beschreibung: `Runde ${runden + 1} von ${versuche}. Nachfassen, dann abhaken — danach fragt der Prozess wieder.` });
    }
    default: break; // schritt, termin, nachricht, abstimmung
  }
  // „Erneut ab Schritt …“ (höchstens n-mal je Lauf, danach weiter).
  if (k.erneut?.ab) {
    const n = l.zaehler?.[k.id] ?? 0;
    if (n < k.erneut.hoechstens && def.knoten.some(x => x.id === k.erneut!.ab)) return { art: 'weiter', ausgang: 'weiter', status: 'erledigt', grund: 'erneut', sprung: k.erneut.ab, zaehle: true };
    return { art: 'weiter', ausgang: 'weiter', status: 'erledigt' };
  }
  // Fester Schritt (Paket Ü): der Kern des alten Ablaufs — ob der Prozess ihn wirklich ersetzt (sonst hält der Lauf), prüft der Server beim Ausführen.
  if (e?.id === 'system.fest') {
    if (!istSystemSchritt(werte.schritt)) return { art: 'fehler', grund: 'nicht-gebaut' };
    return { art: 'aktion', schatten: 'wuerde', ausgangSchatten: 'weiter', aktion: { art: 'system', kennung, knoten: k.id, schritt: werte.schritt } };
  }
  // CRM abfragen (N1): eine Liste von Fällen — nur lesen (der Server liest über die vorhandenen Leser, Art. 18 ausgeblendet, nur Business).
  if (k.abfrage) return { art: 'aktion', schatten: 'wuerde', ausgangSchatten: 'weiter', aktion: { art: 'abfrage', kennung, knoten: k.id, abfrage: k.abfrage } };
  if (e && LESEN_BAUSTEINE.has(e.id)) return { art: 'weiter', ausgang: 'weiter', status: 'erledigt' };
  if (e?.id === 'glocke.melden') {
    const wer = werVon(u, l, werte.wer);
    if ('fehler' in wer) return { art: 'fehler', grund: wer.fehler };
    return { art: 'aktion', schatten: 'wuerde', ausgangSchatten: 'weiter', aktion: { art: 'meldung', kennung, knoten: k.id, an: wer.an, titel: (fuellen(werte.text, u) || k.titel).slice(0, 280) } };
  }
  // Karte ergänzen (N4): hat ein Agenten-Schritt davor Felder vorgeschlagen (Häkchen je Feld im Stapel), ist hier nichts mehr zu tun. Ohne Agent davor
  // (22.10. spät): die frische Recherche eines anderen Laufs gilt (ihr Vorschlag liegt schon im Stapel); stehen alle Felder schon in der Akte, ist nichts zu tun;
  // sonst ergänzt ein Mensch genau die Felder, die fehlen (es gibt keine andere Quelle — nie erfundene Werte).
  if (e?.id === 'crm.karte-ergaenzen') {
    if (Number(l.daten['agent.felder'] ?? 0) > 0) return { art: 'weiter', ausgang: 'weiter', status: 'erledigt', grund: 'vorbereitet' };
    if (l.schritte.some(x => x.grund === 'recherche-frisch')) return { art: 'weiter', ausgang: 'weiter', status: 'uebersprungen', grund: 'recherche-frisch' };
    const felder = Array.isArray(werte.felder) ? (werte.felder as string[]).filter((x): x is string => typeof x === 'string') : [];
    const luecken = u.karteLuecken?.(werte.ziel === 'kontakt' ? 'kontakt' : 'firma', felder) ?? null;
    if (luecken && !luecken.length) return { art: 'weiter', ausgang: 'weiter', status: 'uebersprungen', grund: 'schon-erledigt' };
    const namen = (luecken ?? felder).map(f => KARTE_FELDER.find(x => x.id === f)?.label ?? f).join(', ');
    return aufgabePlan(l, k, kennung, u, { titel: `Karte ergänzen: ${k.titel}`, beschreibung: namen ? `Es fehlen: ${namen}` : '' });
  }
  // Bausteine mit eigenem Weg (22.10. spät): ein Vorschlag, der nach der Freigabe selbst wirkt — über den vorhandenen Schreibweg (siehe `VorschlagWirkung`).
  const eigen = eigenerWegPlan(l, k, e, werte, u, kennung);
  if (eigen) return eigen;
  if (e?.id === 'telegram.hinweis') return { art: 'aktion', schatten: 'wuerde', ausgangSchatten: 'weiter', aktion: { art: 'meldung', kennung, knoten: k.id, an: typeof werte.an === 'string' ? werte.an : l.person, titel: k.titel.slice(0, 280), telegram: typeof werte.hinweis === 'string' ? werte.hinweis : 'wartet' } };
  if (e && CRM_VORSCHLAG_BAUSTEINE.has(e.id)) {
    if (e.ansprache) { const urteil = u.ansprache?.(e, werte) ?? null; if (urteil && !urteil.erlaubt) return { art: 'weiter', ausgang: 'weiter', status: 'uebersprungen', grund: 'kanal-rot' }; }
    const ein = crmVorschlagEingabe(l, k, e, u);
    if (ein && 'fehler' in ein) return { art: 'fehler', grund: ein.fehler as LaufGrund };
    if (!ein) return { art: 'weiter', ausgang: 'weiter', status: 'uebersprungen', grund: 'daten-fehlen' };
    return { art: 'aktion', schatten: 'freigabe', ausgangSchatten: 'weiter', aktion: { art: 'crm-vorschlag', kennung, knoten: k.id, titel: k.titel, eingabe: ein } };
  }
  if (e && AUFGABE_BAUSTEINE.has(e.id)) {
    if (e.ansprache) {
      const urteil = u.ansprache?.(e, werte) ?? null;
      if (urteil && !urteil.erlaubt) return { art: 'weiter', ausgang: 'weiter', status: 'uebersprungen', grund: 'kanal-rot' };
      return aufgabePlan(l, k, kennung, u, { titel: fuellen(werte.titel, u), wer: werte.wer, fristTage: werte.fristTage, prioritaet: werte.prioritaet, ...(urteil?.anlassPflicht ? { hinweis: 'Gelbe Telefon-Ampel: beim Anruf ist ein konkreter Anlass aus der Beziehung Pflicht.' } : urteil?.farbe === 'gelb' ? { hinweis: `Kanal-Ampel gelb: ${urteil.grund}` } : {}) });
    }
    if (e.id === 'crm.uebergeben') return aufgabePlan(l, k, kennung, u, { titel: `Übernehmen: ${k.titel}`, wer: werte.wer, beschreibung: fuellen(werte.notiz, u) });
    if (e.id === 'crm.kontakt-pflegen') return aufgabePlan(l, k, kennung, u, { titel: `Kontakt pflegen: ${k.titel}`, beschreibung: Array.isArray(werte.felder) ? `Felder: ${(werte.felder as string[]).join(', ')}` : '' });
    if (e.id === 'kalender.block') return aufgabePlan(l, k, kennung, u, { titel: `Block einplanen: ${fuellen(werte.titel, u) || k.titel}`, wer: werte.wer });
    if (e.id === 'aufgabe.an-zoe') return aufgabePlan(l, k, kennung, u, { titel: k.titel, beschreibung: [fuellen(werte.hinweis, u), 'Diese Aufgabe kann an ZOE gegeben werden — ZOE bereitet einen Vorschlag vor.'].filter(Boolean).join('\n\n') });
    return aufgabePlan(l, k, kennung, u, { titel: fuellen(werte.titel, u), beschreibung: fuellen(werte.beschreibung, u), wer: werte.wer, fristTage: werte.fristTage, prioritaet: werte.prioritaet });
  }
  // Außenwirkung (Mail, WhatsApp, Einladung, Angebot stellen, Rechnung, Papierkorb) bzw. ein Knoten ohne Baustein, dessen Form nach außen wirkt.
  const klasse = e ? klasseVonEintrag(e) : FORM_KLASSE[form];
  if (brauchtSchloss(klasse)) return aussenVorbereiten(k, def, u, e);
  // Ohne Baustein bzw. ein unbekannter: ein Menschen-Schritt (Punkt 67) — die Aufgabe trägt den Bezug zum Lauf.
  return aufgabePlan(l, k, kennung, u, { titel: k.titel });
}

// ══ Der Gang ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export interface VoranErgebnis {
  lauf: ProzessLauf;
  /** Eine Wirkung, die der Server jetzt ausführen soll (nur scharf) — danach `nachAktion`. */
  aktion: Aktion | null;
  /** Der Prozess soll pausieren (Budget erreicht) — der Lauf ist angehalten. */
  pause?: 'budget';
}

function abschliessen(s: LaufSchritt, status: SchrittStatus, ausgang: LaufAusgang | undefined, jetzt: string, grund?: LaufGrund): void {
  s.status = status;
  s.bis = jetzt;
  if (ausgang) s.ausgang = ausgang;
  if (grund) s.grund = grund;
}

/** Über einen Ausgang weiter (bzw. ans Ende). */
function geh(l: ProzessLauf, idx: Map<string, Map<LaufAusgang, string | null>>, von: string, ausgang: LaufAusgang, jetzt: string, sprung?: string): void {
  if (sprung !== undefined) {
    if (sprung) { ankommen(l, sprung, jetzt); return; }
    beenden(l, 'fertig', jetzt, { ergebnis: 'erfolg' });
    return;
  }
  const aus = idx.get(von);
  let ziel = aus?.get(ausgang);
  if (ziel === undefined && ausgang === 'eingetreten') ziel = aus?.get('weiter');
  if (ziel === undefined && ausgang === 'ja') ziel = aus?.get('weiter');
  if (ziel === undefined || ziel === null) {
    const grund: LaufGrund | undefined = ausgang === 'nein' ? 'abgelehnt' : ausgang === 'abgelaufen' ? 'abgelaufen' : ziel === undefined ? 'kein-weg' : undefined;
    beenden(l, 'fertig', jetzt, { ...(ausgang === 'weiter' || ausgang === 'ja' || ausgang === 'eingetreten' ? { ergebnis: 'erfolg' as const } : {}), ...(grund && ausgang !== 'weiter' && ausgang !== 'eingetreten' ? { grund } : {}) });
    return;
  }
  ankommen(l, ziel, jetzt);
}

/** Ziel/Abbruch des Prozesses und die festen Regeln (Art. 18, Werbesperre, Fall weg) — vor jedem Schritt. Rein. */
function wache(l: ProzessLauf, u: LaufUmfeld): boolean {
  if (u.ausgenommen) { beenden(l, 'abgebrochen', u.jetzt, { ergebnis: 'abbruch', grund: u.ausgenommen }); return true; }
  if (u.fallFehlt) { beenden(l, 'abgebrochen', u.jetzt, { ergebnis: 'abbruch', grund: 'fall-weg' }); return true; }
  const z = u.einstellung?.ziel, a = u.einstellung?.abbruch;
  if (a?.bedingungen.length && bedingungenTreffen(a.bedingungen, u.daten, a.verknuepfung)) { beenden(l, 'abgebrochen', u.jetzt, { ergebnis: 'abbruch', grund: 'abbruch-kriterium' }); return true; }
  if (z?.bedingungen.length && bedingungenTreffen(z.bedingungen, u.daten, z.verknuepfung)) { beenden(l, 'fertig', u.jetzt, { ergebnis: 'erfolg', grund: 'ziel' }); return true; }
  return false;
}

/** Der Start-Knoten eines Laufs: der Auslöser, der ihn startete, sonst der erste Auslöser, sonst der erste Schritt. */
function startVon(l: ProzessLauf, def: ProzessDefinition): string | null {
  const st = startKnoten(def);
  return (l.ausloeser.knoten && st.some(s => s.id === l.ausloeser.knoten) ? l.ausloeser.knoten : st[0]?.id) ?? alleSchritte(def)[0]?.schritt.id ?? null;
}

/** Welche angenommenen Ausgänge eine Form im Probelauf nehmen darf (Werkstatt bau-fertig, Punkt 9) — sonst wirkt die Annahme nicht. */
function annahmeFuer(k: K, u: LaufUmfeld, modus: LaufModus): LaufAusgang | undefined {
  if (modus !== 'schatten') return undefined;
  const a = u.annahme?.(k.id);
  if (!a) return undefined;
  const f = k.form ?? 'schritt';
  const erlaubt: readonly LaufAusgang[] = f === 'entscheidung' ? ['ja', 'nein'] : f === 'freigabe' ? ['ja', 'nein', 'abgelaufen'] : f === 'warten' ? (k.warten?.art === 'dauer' ? [] : ['eingetreten', 'abgelaufen']) : [];
  return erlaubt.includes(a) ? a : undefined;
}

/**
 * Den Lauf so weit voranbringen, wie es ohne Wirkung geht (rein). Scharf: endet an der nächsten Wirkung (`aktion` — der Schritt steht auf „läuft“
 * mit der festen Kennung), an einem Warten oder am Ende. Schatten: geht ohne Wirkung den ganzen Weg (höchstens `schritteJeAnstoss`).
 * Ein Abbruch zwischen zwei Aufrufen ist ungefährlich: der offene Schritt bekommt beim nächsten Mal dieselbe Kennung (Punkt 42).
 */
export function voran(laufEin: ProzessLauf, def: ProzessDefinition, u: LaufUmfeld, modus: LaufModus = laufEin.modus): VoranErgebnis {
  const l = kopie(laufEin);
  l.geaendert = u.jetzt;
  if (l.status !== 'laeuft') return { lauf: l, aktion: null };
  if (wache(l, u)) return { lauf: l, aktion: null };
  const idx = kantenIndex(def);
  const nach = new Map(def.knoten.map(k => [k.id, k]));
  if (l.aktuell === null && !l.schritte.length) {
    const s = startVon(l, def);
    if (!s) { beenden(l, 'fertig', u.jetzt, { grund: 'kein-weg' }); return { lauf: l, aktion: null }; }
    ankommen(l, s, u.jetzt);
  }
  for (let n = 0; n < LAUF_GRENZEN.schritteJeAnstoss; n++) {
    if (l.status !== 'laeuft' || !l.aktuell) return { lauf: l, aktion: null };
    if (l.schritte.length > LAUF_GRENZEN.schritteJeLauf) { beenden(l, 'fehler', u.jetzt, { grund: 'schleife' }); return { lauf: l, aktion: null }; }
    const k = nach.get(l.aktuell);
    const s = offenerSchritt(l) ?? ankommen(l, l.aktuell, u.jetzt);
    if (!k) { beenden(l, 'fehler', u.jetzt, { grund: 'knoten-fehlt' }); return { lauf: l, aktion: null }; }
    const kennung = wirkungsKennung(l.id, k.id, s.runde ?? 0);
    const plan = planFuer(l, k, def, u, kennung);
    // Werkstatt bau-fertig (Punkt 9): im Schatten der angenommene Weg statt des Hauptwegs (Raute, Freigabe, Warten) — scharf nie.
    const annahme = annahmeFuer(k, u, modus);
    if (modus === 'schatten' && u.beobachte) {
      u.beobachte({
        knoten: k.id, ...(plan.art === 'aktion' ? { aktion: plan.aktion, status: plan.schatten, ausgang: annahme ?? plan.ausgangSchatten } : {}),
        ...(plan.art === 'warten' ? { warten: plan.warten, status: 'wartet' as const, ausgang: annahme ?? plan.ausgangSchatten } : {}),
        ...(plan.art === 'weiter' ? { ausgang: k.form === 'entscheidung' && annahme ? annahme : plan.ausgang, status: plan.status ?? 'erledigt', ...(plan.grund ? { grund: plan.grund } : {}) } : {}),
        ...(plan.art === 'fehler' ? { status: 'fehler' as const, grund: plan.grund } : {}),
        ...(plan.art === 'ende' ? { status: 'erledigt' as const, ...(plan.aktion ? { aktion: plan.aktion } : {}) } : {}),
      });
    }
    switch (plan.art) {
      case 'weiter':
        if (annahme && k.form === 'entscheidung' && plan.status !== 'uebersprungen') { abschliessen(s, plan.status ?? 'erledigt', annahme, u.jetzt, plan.grund); geh(l, idx, k.id, annahme, u.jetzt); continue; }
        abschliessen(s, plan.status ?? 'erledigt', plan.ausgang, u.jetzt, plan.grund);
        if (plan.zaehle) l.zaehler = { ...(l.zaehler ?? {}), [k.id]: (l.zaehler?.[k.id] ?? 0) + 1 };
        geh(l, idx, k.id, plan.ausgang, u.jetzt, plan.sprung);
        continue;
      case 'ende':
        if (plan.aktion && modus === 'scharf') { s.wirkung = [{ art: 'lauf', id: plan.aktion.kennung }]; return { lauf: l, aktion: plan.aktion }; }
        abschliessen(s, plan.aktion ? 'wuerde' : 'erledigt', undefined, u.jetzt);
        beenden(l, 'fertig', u.jetzt, { ergebnis: plan.ergebnis });
        return { lauf: l, aktion: null };
      case 'fehler':
        if (k.zweige?.fehler && idx.get(k.id)?.has('fehler')) { abschliessen(s, 'fehler', 'fehler', u.jetzt, plan.grund); geh(l, idx, k.id, 'fehler', u.jetzt); continue; }
        s.status = 'fehler'; s.grund = plan.grund; // der Schritt bleibt offen — „erneut ab hier“ setzt dort an
        l.status = 'fehler'; l.grund = plan.grund;
        return { lauf: l, aktion: null };
      case 'pause':
        if (modus === 'schatten') { abschliessen(s, 'wuerde', 'weiter', u.jetzt, 'budget'); geh(l, idx, k.id, 'weiter', u.jetzt); continue; }
        s.status = 'wartet'; s.grund = 'budget';
        l.status = 'angehalten'; l.grund = 'budget';
        return { lauf: l, aktion: null, pause: 'budget' };
      case 'warten':
        if (modus === 'schatten') { const a = annahme ?? plan.ausgangSchatten; abschliessen(s, 'wartet', a, u.jetzt); geh(l, idx, k.id, a, u.jetzt); continue; }
        s.status = 'wartet';
        if (plan.warten.art === 'fenster') s.grund = plan.grund ?? 'fenster';
        l.status = 'wartet'; l.wartet = { knoten: k.id, ...plan.warten };
        return { lauf: l, aktion: null };
      case 'aktion': {
        if (modus === 'schatten') {
          if (plan.aktion.art === 'agent') s.kostenCent = plan.aktion.kostenCent;
          // Eine Erinnerung im Schatten: einmal „würde erinnern“, dann wie nach der letzten Runde weiter (sonst kreiste der Probelauf).
          if (k.form === 'erinnerung') { abschliessen(s, plan.schatten, 'weiter', u.jetzt); geh(l, idx, k.id, 'weiter', u.jetzt, ausstiegZiel(def, k) ?? ''); continue; }
          const a = annahme ?? plan.ausgangSchatten;
          abschliessen(s, plan.schatten, a, u.jetzt);
          geh(l, idx, k.id, a, u.jetzt);
          continue;
        }
        // Abfrage und Schleife haben keine eigene Wirkung mit dieser Kennung — die Schleife trägt nach dem Ausführen die Kennungen ihrer Teil-Läufe.
        // Ein fester Schritt (Paket Ü) trägt nach dem Ausführen die Kennungen des alten Codes (Aufgaben, Vorschläge) — nicht seine eigene.
        if (plan.aktion.art !== 'abfrage' && plan.aktion.art !== 'schleife' && plan.aktion.art !== 'system') s.wirkung = [{ art: wirkungArtVon(plan.aktion), id: plan.aktion.kennung }];
        return { lauf: l, aktion: plan.aktion };
      }
    }
  }
  return { lauf: l, aktion: null };
}

export const wirkungArtVon = (a: Aktion): Wirkung['art'] =>
  a.art === 'aufgabe' ? 'aufgabe' : a.art === 'teilprozess' || a.art === 'schleife' ? 'lauf' : a.art === 'meldung' ? 'meldung' : 'vorschlag';

/** Listen am Fall, über die eine Schleife laufen kann (außer `abfrage:<Knoten>`): die vorgemerkten Gäste eines eigenen Abends (V18). */
export const SCHLEIFE_LISTEN = ['event.gaeste'] as const;

/** Welche Felder eine Wirkung in die Daten des Laufs schreiben darf (nur für Rauten — Kennungen und Zahlen nach dem Vertrag, nie Text). */
const DATEN_SCHLUESSEL = /^(abfrage|schleife|agent)\.[a-z0-9_.-]{1,40}$/;


/**
 * Das Ergebnis einer Wirkung eintragen (rein): ok → warten (Aufgabe, Freigabe, Teilprozess) bzw. weiter; vorübergehend → Pause mit Backoff (höchstens
 * `versuche`), dann wie dauerhaft; dauerhaft → Fehlerkante, sonst angehalten (Glocke an den Eigner, „erneut ab hier“).
 */
export function nachAktion(laufEin: ProzessLauf, def: ProzessDefinition, a: Aktion, e: AktionErgebnis, jetzt: string): ProzessLauf {
  const l = kopie(laufEin);
  l.geaendert = jetzt;
  const s = offenerSchritt(l);
  if (!s || s.knoten !== a.knoten || l.status !== 'laeuft') return l; // inzwischen anders weitergegangen — nichts doppelt
  const idx = kantenIndex(def);
  if (e.ok) {
    if (e.wirkung?.length) s.wirkung = [...(s.wirkung ?? []).filter(w => !e.wirkung!.some(x => x.id === w.id)), ...e.wirkung];
    if (e.kostenCent) { s.kostenCent = (s.kostenCent ?? 0) + e.kostenCent; l.kostenCent += e.kostenCent; }
    if (e.modell) s.modell = e.modell;
    if (e.token) s.token = { ein: (s.token?.ein ?? 0) + e.token.ein, aus: (s.token?.aus ?? 0) + e.token.aus };
    // Motor-Rest (22.10. spät): Liste der Abfrage, Felder für die nächsten Rauten (nur `abfrage.*`, `schleife.*`, `agent.*` — Kennungen und Zahlen), Zahlen am Schritt.
    if (e.liste && a.art === 'abfrage') l.listen = { ...(l.listen ?? {}), [a.knoten]: { faelle: e.liste.faelle.slice(0, LAUF_GRENZEN.listeMax), gesamt: e.liste.gesamt, am: e.liste.am } };
    for (const [x, v] of Object.entries(e.daten ?? {})) if (DATEN_SCHLUESSEL.test(x) && typeof v === 'string' && v.length <= 120) l.daten[x] = v;
    if (e.anzahl !== undefined) s.anzahl = e.anzahl;
    if (e.rest) s.rest = e.rest;
    if (e.uebersprungen) s.uebersprungen = e.uebersprungen;
    if (e.hinweis) s.grund = e.hinweis;
    if (e.recherche) s.recherche = true;
    if (e.fremd) l.fremd = true;
    delete s.versuch;
    if (a.art === 'teilprozess' && a.uebergabe) { abschliessen(s, 'erledigt', undefined, jetzt); beenden(l, 'fertig', jetzt, { ergebnis: 'uebergabe' }); return l; }
    // Nichts zu tun (22.10. spät — schon erledigt, nichts vorzuschlagen): nicht warten, weiter über den positiven Ausgang (am Schloss „ja“).
    if (e.weiter) {
      const form = def.knoten.find(x => x.id === a.knoten)?.form;
      const aus: LaufAusgang = form === 'freigabe' || form === 'entscheidung' ? 'ja' : 'weiter';
      abschliessen(s, 'uebersprungen', aus, jetzt, e.hinweis ?? 'schon-erledigt');
      geh(l, idx, a.knoten, aus, jetzt);
      return l;
    }
    const w = warteArtVon(a);
    if (w) {
      s.status = 'wartet';
      l.status = 'wartet';
      l.wartet = { knoten: a.knoten, art: w, wirkung: a.kennung, ...(a.art === 'vorschlag' ? { bis: a.bis } : {}) };
      return l;
    }
    abschliessen(s, 'erledigt', 'weiter', jetzt, e.hinweis);
    geh(l, idx, a.knoten, 'weiter', jetzt);
    return l;
  }
  if (e.kostenCent) { s.kostenCent = (s.kostenCent ?? 0) + e.kostenCent; l.kostenCent += e.kostenCent; }
  if (e.art === 'voruebergehend') {
    const v = (s.versuch ?? 0) + 1;
    s.versuch = v;
    if (v < LAUF_GRENZEN.versuche) {
      s.grund = 'voruebergehend';
      l.status = 'wartet';
      l.wartet = { knoten: a.knoten, art: 'fehler', bis: new Date(Date.parse(jetzt) + Math.min(5 * 3 ** (v - 1), 180) * 60_000).toISOString() };
      return l;
    }
  }
  const k = def.knoten.find(x => x.id === a.knoten);
  // Ohne KI-Schlüssel bzw. Guthaben (22.10., C1-Frage 1) ist das kein Fehler des Falls, sondern der Einrichtung: SOFORT anhalten, auch mit Fehlerkante —
  // „erneut ab hier“ setzt an derselben Stelle an, sobald die KI eingerichtet ist.
  if (e.grund !== 'ki-nicht-eingerichtet' && k?.zweige?.fehler && idx.get(k.id)?.has('fehler')) { abschliessen(s, 'fehler', 'fehler', jetzt, e.grund); geh(l, idx, k.id, 'fehler', jetzt); return l; }
  s.status = 'fehler'; s.grund = e.grund;
  l.status = 'fehler'; l.grund = e.grund;
  return l;
}

// ══ Wecken ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

/** Den wartenden Schritt mit einem Ausgang verlassen und weiter (rein). */
function verlassen(laufEin: ProzessLauf, def: ProzessDefinition, ausgang: LaufAusgang, jetzt: string, o: { status?: SchrittStatus; grund?: LaufGrund; zaehle?: string; sprung?: string } = {}): ProzessLauf {
  const l = kopie(laufEin);
  l.geaendert = jetzt;
  const w = l.wartet;
  const s = offenerSchritt(l);
  if (!w || !s || s.knoten !== w.knoten) return l;
  delete l.wartet;
  l.status = 'laeuft';
  delete l.grund;
  abschliessen(s, o.status ?? (ausgang === 'abgelaufen' ? 'abgelaufen' : 'erledigt'), ausgang, jetzt, o.grund);
  if (o.zaehle) l.zaehler = { ...(l.zaehler ?? {}), [o.zaehle]: (l.zaehler?.[o.zaehle] ?? 0) + 1 };
  geh(l, kantenIndex(def), w.knoten, ausgang, jetzt, o.sprung);
  return l;
}

/** Fällige Wecker (rein): Zeit/Datum erreicht, Obergrenze eines Ereignisses, Fenster bzw. Pause nach Fehler vorbei. Sonst unverändert. */
export function weckenZeit(l: ProzessLauf, def: ProzessDefinition, jetzt: string): ProzessLauf {
  const w = l.wartet;
  if (l.status !== 'wartet' || !w?.bis || w.bis > jetzt) return l;
  if (w.art === 'zeit') return verlassen(l, def, 'weiter', jetzt);
  if (w.art === 'datum') return verlassen(l, def, w.ziel && w.ziel <= jetzt ? 'eingetreten' : 'abgelaufen', jetzt, w.ziel && w.ziel <= jetzt ? {} : { grund: 'abgelaufen' });
  if (w.art === 'ereignis') return verlassen(l, def, 'abgelaufen', jetzt, { grund: 'abgelaufen' });
  if (w.art === 'fenster' || w.art === 'fehler') {
    // Noch einmal an derselben Stelle (dieselbe Kennung — nichts doppelt).
    const n = kopie(l);
    delete n.wartet; n.status = 'laeuft'; delete n.grund; n.geaendert = jetzt;
    const s = offenerSchritt(n);
    if (s) { s.status = 'laeuft'; delete s.grund; }
    return n;
  }
  return l;
}

/** Ein Ereignis ist eingetreten, auf das der Lauf wartet (rein) — Art, Fall und „nur wenn …“ prüft der Aufrufer über `wartetAuf`. */
export function ereignisEingetreten(l: ProzessLauf, def: ProzessDefinition, jetzt: string): ProzessLauf {
  return l.status === 'wartet' && l.wartet?.art === 'ereignis' ? verlassen(l, def, 'eingetreten', jetzt) : l;
}

/** Wartet der Lauf auf genau dieses Ereignis? (rein) — Art, derselbe Fall, „nur wenn …“ des Knotens über `daten`. */
export function wartetAuf(l: ProzessLauf, def: ProzessDefinition, e: { art: SkillEreignis; bezug: Readonly<Record<string, string | undefined>>; bereich: 'privat' | 'business' | null; arbeit?: true }, daten: Readonly<Record<string, unknown>>): boolean {
  // Privat nie — außer Arbeit (25.10.): ein Ereignis mit Arbeits-Marke weckt einen Lauf, dessen Fall DIESES Mandat ist (`ereignisZumFall` unten); den Lauf gibt es
  // nur, wenn der Prozess für das Mandat der Privat-Arbeits-Einheit freigegeben war (Produkt-Bindung, Begleitung) bzw. ein Mensch ihn für den Fall startete.
  if (l.status !== 'wartet' || l.wartet?.art !== 'ereignis' || l.wartet.ereignis !== e.art || (e.bereich === 'privat' && !(e.arbeit === true && l.fall.art === 'mandat'))) return false;
  const k = def.knoten.find(x => x.id === l.wartet!.knoten);
  if (k?.warten?.art !== 'ereignis') return false;
  if (!ereignisZumFall(l.fall, e.bezug)) return false;
  return bedingungenTreffen(k.warten.bedingungen, daten, k.warten.verknuepfung);
}

/** Eine Aufgabe des Laufs ist fertig (rein): erledigt → weiter (Erinnerung: zurück zur Entscheidung, Runde gezählt); abgebrochen/gelöscht → Fehlerkante bzw. angehalten. */
export function aufgabeFertig(l: ProzessLauf, def: ProzessDefinition, aufgabeId: string, ergebnis: 'erledigt' | 'abgebrochen' | 'weg', jetzt: string): ProzessLauf {
  if (l.status !== 'wartet' || l.wartet?.art !== 'aufgabe' || l.wartet.wirkung !== aufgabeId) return l;
  const k = def.knoten.find(x => x.id === l.wartet!.knoten);
  if (ergebnis === 'erledigt') {
    // Nach der Freigabe einer Außenwirkung (Schloss) wartet der Lauf auf die Aufgabe „von Hand“ — erledigt heißt dann: freigegeben und getan.
    if (k?.form === 'freigabe') return verlassen(l, def, 'ja', jetzt);
    return verlassen(l, def, 'weiter', jetzt, k?.form === 'erinnerung' ? { zaehle: k.id } : {});
  }
  const grund: LaufGrund = ergebnis === 'weg' ? 'aufgabe-weg' : 'aufgabe-abgebrochen';
  if (k?.zweige?.fehler) return verlassen(l, def, 'fehler', jetzt, { status: 'fehler', grund });
  const n = kopie(l);
  delete n.wartet;
  n.geaendert = jetzt;
  const s = offenerSchritt(n);
  if (s) { s.status = 'fehler'; s.grund = grund; }
  n.status = 'fehler'; n.grund = grund;
  return n;
}

/** Eine Freigabe bzw. Entscheidung im Stapel ist gefallen (rein): freigegeben → ja, abgelehnt → nein, abgelaufen → abgelaufen (Entscheidung: nein). */
export function freigabeEntschieden(l: ProzessLauf, def: ProzessDefinition, kennung: string, wie: 'ja' | 'nein' | 'abgelaufen', jetzt: string, o: { danachAufgabe?: string } = {}): ProzessLauf {
  if (l.status !== 'wartet' || l.wartet?.art !== 'freigabe' || l.wartet.wirkung !== kennung) return l;
  const k = def.knoten.find(x => x.id === l.wartet!.knoten);
  if (wie === 'ja' && o.danachAufgabe) {
    // Erst freigegeben, dann von Hand: der Lauf wartet weiter — jetzt auf die Aufgabe.
    const n = kopie(l);
    n.geaendert = jetzt;
    n.wartet = { knoten: l.wartet.knoten, art: 'aufgabe', wirkung: o.danachAufgabe };
    const s = offenerSchritt(n);
    if (s) s.wirkung = [...(s.wirkung ?? []).filter(w => w.id !== o.danachAufgabe), { art: 'aufgabe', id: o.danachAufgabe }];
    return n;
  }
  // Ein Übernahme-Vorschlag eines Schritts (22.10. spät — kein Schloss, keine Entscheidung: Fall starten, Gäste, Kampagnen-Ergebnis, Anfrage): abgelehnt bzw.
  // abgelaufen heißt „nicht über diesen Vorschlag“ — der Lauf geht weiter (Schritt übersprungen), die nächsten Rauten lesen den echten Stand im CRM.
  if (wie !== 'ja' && k && k.form !== 'entscheidung' && k.form !== 'freigabe') return verlassen(l, def, 'weiter', jetzt, { status: 'uebersprungen', grund: wie === 'nein' ? 'abgelehnt' : 'abgelaufen' });
  const ausgang: LaufAusgang = wie === 'ja' ? 'ja' : wie === 'nein' ? 'nein' : k?.form === 'entscheidung' ? 'nein' : 'abgelaufen';
  return verlassen(l, def, ausgang, jetzt, wie === 'nein' ? { grund: 'abgelehnt' } : wie === 'abgelaufen' ? { status: 'abgelaufen', grund: 'abgelaufen' } : {});
}

/** Ein Teilprozess, auf den der Lauf wartet, ist zu Ende (rein): mit Ziel → weiter, sonst Fehlerkante bzw. angehalten. */
export function teilprozessFertig(l: ProzessLauf, def: ProzessDefinition, kindKennung: string, erfolg: boolean, jetzt: string): ProzessLauf {
  if (l.status !== 'wartet' || l.wartet?.art !== 'teilprozess' || l.wartet.wirkung !== kindKennung) return l;
  if (erfolg) return verlassen(l, def, 'weiter', jetzt);
  const k = def.knoten.find(x => x.id === l.wartet!.knoten);
  if (k?.zweige?.fehler) return verlassen(l, def, 'fehler', jetzt, { status: 'fehler', grund: 'teilprozess-fehler' });
  const n = kopie(l);
  delete n.wartet; n.geaendert = jetzt;
  const s = offenerSchritt(n);
  if (s) { s.status = 'fehler'; s.grund = 'teilprozess-fehler'; }
  n.status = 'fehler'; n.grund = 'teilprozess-fehler';
  return n;
}

/** „Erneut ab hier“ (Punkt 47): ein Lauf im Fehler versucht den offenen Schritt noch einmal — dieselbe Kennung, Erfolgreiches wird nie wiederholt. */
export function erneutAbHier(l: ProzessLauf, jetzt: string): ProzessLauf | null {
  if (l.status !== 'fehler') return null;
  const n = kopie(l);
  delete n.wartet; delete n.grund; n.status = 'laeuft'; n.geaendert = jetzt;
  const s = offenerSchritt(n);
  if (s) { s.status = 'laeuft'; delete s.grund; delete s.versuch; delete s.bis; }
  else if (n.aktuell) ankommen(n, n.aktuell, jetzt);
  return n;
}

/** Von Hand abbrechen (Punkt 50: „Abbrechen mit Grund“ — der Grund steht im Verlauf des Prozesses, nicht im Lauf). */
export function abbrechen(l: ProzessLauf, jetzt: string, grund: LaufGrund = 'hand'): ProzessLauf | null {
  if (!laufOffen(l)) return null;
  const n = kopie(l);
  beenden(n, 'abgebrochen', jetzt, { ergebnis: 'abbruch', grund });
  return n;
}

/** Prozess pausiert/zurückgestellt → offene Läufe halten an; fortgesetzt → sie gehen dort weiter (rein). */
export function anhalten(l: ProzessLauf, jetzt: string): ProzessLauf {
  if (l.status !== 'laeuft' && l.status !== 'wartet') return l;
  return { ...kopie(l), status: 'angehalten', geaendert: jetzt, daten: { ...l.daten, 'lauf.vorher': l.status } };
}
export function fortsetzen(l: ProzessLauf, jetzt: string): ProzessLauf {
  if (l.status !== 'angehalten') return l;
  const n = kopie(l);
  const vorher = n.daten['lauf.vorher'];
  delete n.daten['lauf.vorher'];
  n.status = vorher === 'wartet' && n.wartet ? 'wartet' : 'laeuft';
  if (n.status === 'laeuft') { delete n.grund; const s = offenerSchritt(n); if (s && s.status === 'wartet' && s.grund === 'budget') { s.status = 'laeuft'; delete s.grund; } }
  n.geaendert = jetzt;
  return n;
}

// ══ Starten (Punkte 35, 37, 49) ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export interface StartAnfrage {
  /** Neue Kennung (`pl-<uuid>`) — der Aufrufer zieht sie (Server: `neueKennung('pl')`). */
  id: string;
  prozessId: string;
  version: number;
  def: Pick<ProzessDefinition, 'bereich' | 'fallArt'>;
  fall: LaufFall;
  modus: LaufModus;
  person: string | null;
  ausloeser: LaufAusloeser;
  daten?: Record<string, string>;
  tiefe?: number;
  herkunft?: { prozessId: string; laufId: string };
  fremd?: boolean;
  /** Automatisch gestartet (Ereignis, Webhook, Zeitplan, Loop, bestehende Fälle) — dann gilt der Flutschutz. */
  automatisch: boolean;
  /** Von Hand „erneut starten“ (mit Grund im Verlauf) — übergeht den Wiedereintritt, nie einen offenen Lauf. */
  erneut?: boolean;
  /** Ohne Fall: was den Start eindeutig macht (Zeitplan-Slot, Ereignis, Tag des Loops, Anfrage). */
  periode?: string;
  jetzt: string;
}
export type StartGrund = 'offen' | 'schon' | 'kette' | 'voll' | 'ohne-person' | 'flut' | 'flut-voll' | 'schatten-voll';
export type StartErgebnis =
  | { ok: true; datei: LaeufeDatei; lauf: ProzessLauf }
  | { ok: false; datei: LaeufeDatei; grund: StartGrund; lauf?: ProzessLauf; zurueck?: Zurueckgehalten };

const standVon = (d: LaeufeDatei, id: string): ProzessLaufStand => d.prozesse[id] ?? leererStand();

/**
 * Hat dieser Fall schon einen Lauf des Prozesses, der einen neuen Start verhindert? (rein — dieselbe Regel wie `starten`: offen bzw. beendet und der Wiedereintritt
 * ist nicht fällig). Die CRM-Abfrage einer Schleife nimmt solche Fälle gar nicht erst in ihre Liste — so kommt der Rest im nächsten Lauf dran.
 */
export function startGesperrt(datei: LaeufeDatei, prozessId: string, fall: LaufFall, jetzt: string): 'offen' | 'schon' | null {
  const schluessel = fallSchluessel(prozessId, fall);
  const gleiche = datei.laeufe.filter(l => l.schluessel === schluessel);
  if (gleiche.some(laufOffen)) return 'offen';
  const letzter = [...gleiche].sort((x, y) => (x.start < y.start ? -1 : 1)).at(-1);
  if (!letzter) return null;
  const tage = standVon(datei, prozessId).einstellung.erneutNachTagen;
  const seit = letzter.ende ? (Date.parse(jetzt) - Date.parse(letzter.ende)) / 86_400_000 : 0;
  return !tage || seit < tage ? 'schon' : null;
}

/**
 * Datum am Fall (22.10., lib/prozesse/datum-start.ts): gibt es für diesen Fall und diese Periode (Auslöser-Knoten + Stichtag) schon einen Lauf, einen offenen Lauf oder
 * einen zurückgehaltenen Start? (rein — der Takt überspringt solche Fälle, ohne den Fall zu lesen; die Sperre selbst liegt in `starten`.)
 */
export function datumSchonGestartet(datei: LaeufeDatei, prozessId: string, fall: LaufFall, periode: string): boolean {
  const schluessel = fallSchluessel(prozessId, fall);
  return datei.laeufe.some(l => l.schluessel === schluessel && (laufOffen(l) || l.ausloeser.quelle === periode))
    || datei.zurueckgehalten.some(z => z.prozessId === prozessId && fallSchluessel(z.prozessId, z.fall, z.ausloeser.quelle) === schluessel);
}

/**
 * Recherche-Frische (rein, M6): vor wie vielen Tagen wurde dieser Fall (Firma bzw. Lead — dieselbe Kennung) zuletzt im Web recherchiert? Über alle scharfen
 * Läufe aller Prozesse; null = nie (bzw. die Läufe sind nach ihrer Frist weg).
 */
export function rechercheVorTagen(datei: LaeufeDatei, fallId: string | undefined, jetzt: string): number | null {
  if (!fallId) return null;
  let juengste: string | null = null;
  for (const l of datei.laeufe) {
    if (l.modus !== 'scharf' || l.fall.id !== fallId) continue;
    for (const s of l.schritte) if (s.recherche && s.bis && (!juengste || s.bis > juengste)) juengste = s.bis;
  }
  return juengste ? Math.max(0, (Date.parse(jetzt) - Date.parse(juengste)) / 86_400_000) : null;
}
const nichtZaehlen = (st: ProzessLaufStand, art: keyof NonNullable<ProzessLaufStand['nicht']>): ProzessLaufStand => ({ ...st, nicht: { ...(st.nicht ?? {}), [art]: (st.nicht?.[art] ?? 0) + 1 } });

/**
 * Einen Lauf starten (rein, in der Sperre des Bestands): Kette (höchstens 3 tief), Person (scharf nur mit Person — Regel 5), ein offener Lauf je Fall,
 * Wiedereintritt nur nach `erneutNachTagen` bzw. von Hand, Bestand voll (abgelehnt, gezählt), Flutschutz (scharf: zurückgehalten mit „starten/verwerfen“;
 * Schatten: nicht gerechnet, gezählt). Nie still.
 */
export function starten(datei: LaeufeDatei, a: StartAnfrage): StartErgebnis {
  let st = standVon(datei, a.prozessId);
  const mit = (s: ProzessLaufStand): LaeufeDatei => ({ ...datei, prozesse: { ...datei.prozesse, [a.prozessId]: s } });
  const tiefe = a.tiefe ?? 0;
  if (tiefe > LAUF_GRENZEN.kettenTiefe) return { ok: false, datei: mit(nichtZaehlen(st, 'kette')), grund: 'kette' };
  if (a.modus === 'scharf' && !a.person) return { ok: false, datei: mit(nichtZaehlen(st, 'ohnePerson')), grund: 'ohne-person' };
  const schluessel = fallSchluessel(a.prozessId, a.fall, a.periode);
  const gleiche = datei.laeufe.filter(l => l.schluessel === schluessel);
  const offen = gleiche.find(laufOffen);
  if (offen) return { ok: false, datei, grund: 'offen', lauf: offen };
  // Datum am Fall (22.10., lib/prozesse/datum-start.ts): je Fall und Stichtag höchstens EIN Lauf (die Periode steht im Lauf als `ausloeser.quelle`) — ein Lauf
  // einer früheren Periode (voriges Ende, alte Wiedervorlage) sperrt eine neue nicht (Wiedereintritt je Periode, M2).
  const periode = a.fall.art !== 'keiner' && a.fall.id && istDatumPeriode(a.periode) ? a.periode : null;
  if (periode) {
    const schon = gleiche.find(l => l.ausloeser.quelle === periode);
    if (schon && !a.erneut) return { ok: false, datei, grund: 'schon', lauf: schon };
  }
  const letzter = periode ? undefined : gleiche.sort((x, y) => (x.start < y.start ? -1 : 1)).at(-1);
  if (letzter && !a.erneut) {
    const tage = st.einstellung.erneutNachTagen;
    const seit = letzter.ende ? (Date.parse(a.jetzt) - Date.parse(letzter.ende)) / 86_400_000 : 0;
    if (!tage || seit < tage) return { ok: false, datei, grund: 'schon', lauf: letzter };
  }
  if (datei.laeufe.length >= LAUF_GRENZEN.laeufe) return { ok: false, datei: mit(nichtZaehlen(st, 'voll')), grund: 'voll' };
  const stunde = stundeVon(a.jetzt);
  const z = st.zaehlung?.stunde === stunde ? st.zaehlung : { stunde, starts: 0, wirkungen: 0 };
  const flut = st.einstellung.flutJeStunde ?? LAUF_GRENZEN.flutJeStunde;
  if (a.automatisch && z.starts >= flut) {
    if (a.modus === 'schatten') return { ok: false, datei: mit(nichtZaehlen(st, 'schatten')), grund: 'schatten-voll' };
    if (datei.zurueckgehalten.length >= LAUF_GRENZEN.zurueckgehalten) return { ok: false, datei: mit(nichtZaehlen(st, 'voll')), grund: 'flut-voll' };
    if (datei.zurueckgehalten.some(x => x.prozessId === a.prozessId && fallSchluessel(x.prozessId, x.fall, x.ausloeser.quelle) === schluessel)) return { ok: false, datei, grund: 'flut' };
    const zurueck: Zurueckgehalten = {
      id: `zh-${a.id.slice(3)}`, prozessId: a.prozessId, fall: a.fall, ausloeser: { ...a.ausloeser, ...(a.periode ? { quelle: a.periode } : {}) }, person: a.person, daten: a.daten ?? {}, tiefe,
      ...(a.herkunft ? { herkunft: a.herkunft } : {}), ...(a.fremd ? { fremd: true as const } : {}), am: a.jetzt,
    };
    st = { ...st, zaehlung: z };
    return { ok: false, datei: { ...mit(st), zurueckgehalten: [...datei.zurueckgehalten, zurueck] }, grund: 'flut', zurueck };
  }
  const lauf: ProzessLauf = {
    id: a.id, prozessId: a.prozessId, version: a.version, fall: a.fall, bereich: bereichVon(a.def), schluessel, durchgang: gleiche.length + 1,
    modus: a.modus, status: 'laeuft', person: a.person, ausloeser: a.ausloeser, ...(a.herkunft ? { herkunft: a.herkunft } : {}), tiefe,
    ...(a.fremd ? { fremd: true as const } : {}), daten: a.daten ?? {}, start: a.jetzt, geaendert: a.jetzt, aktuell: null, schritte: [], kostenCent: 0,
  };
  st = { ...st, zaehlung: a.automatisch ? { ...z, starts: z.starts + 1 } : z };
  return { ok: true, datei: { ...mit(st), laeufe: [...datei.laeufe, lauf] }, lauf };
}

/** Die Fall-Art eines Prozesses (Fulfillment-Vorlage ohne Angabe: Mandat). */
export const fallArtDes = (d: Pick<ProzessDefinition, 'fallArt'>): FallArt => fallArtVon(d);

// ══ Notbremse und Budget (Punkte 50, 59) ════════════════════════════════════════════════════════════════════════════════════════════════════════

/** Eine Wirkung zählen (Notbremse) — liefert, ob der Prozess jetzt über der Grenze ist (dann pausiert er sich selbst). Rein. */
export function wirkungZaehlen(st: ProzessLaufStand, jetzt: string): { stand: ProzessLaufStand; notbremse: boolean } {
  const stunde = stundeVon(jetzt);
  const z = st.zaehlung?.stunde === stunde ? st.zaehlung : { stunde, starts: 0, wirkungen: 0 };
  const n = { ...z, wirkungen: z.wirkungen + 1 };
  return { stand: { ...st, zaehlung: n }, notbremse: n.wirkungen > (st.einstellung.notbremseJeStunde ?? LAUF_GRENZEN.notbremseJeStunde) };
}

/** Kosten des Monats fortschreiben (rein): 80 % → einmal Hinweis, an der Grenze → Pause (einmal je Monat gemeldet). */
export function kostenBuchen(st: ProzessLaufStand, cent: number, jetzt: string): { stand: ProzessLaufStand; hinweis80: boolean; grenze: boolean } {
  const monat = monatVon(jetzt);
  const m = st.monat?.monat === monat ? st.monat : { monat, kostenCent: 0 };
  const neu = { ...m, kostenCent: m.kostenCent + Math.max(0, cent) };
  const budget = st.einstellung.scharf?.budgetCent ?? 0;
  const h80 = budget > 0 && !m.hinweis80 && neu.kostenCent >= budget * 0.8;
  const gr = budget > 0 && !m.grenze && neu.kostenCent >= budget;
  return { stand: { ...st, monat: { ...neu, ...(h80 || m.hinweis80 ? { hinweis80: true as const } : {}), ...(gr || m.grenze ? { grenze: true as const } : {}) } }, hinweis80: h80, grenze: gr };
}

/** Passt ein Agenten-Schritt noch ins Budget des Monats? (rein) — ohne Budget (nicht scharf geschaltet) nie. */
export function budgetReicht(st: ProzessLaufStand, cent: number, jetzt: string): boolean {
  const budget = st.einstellung.scharf?.budgetCent ?? 0;
  const m = st.monat?.monat === monatVon(jetzt) ? st.monat.kostenCent : 0;
  return budget > 0 && m + cent <= budget;
}

/**
 * Kostenschätzung beim Scharfschalten (Punkt 59: Läufe × Agenten-Schritte × Modellstufe) — `jeStufeCent` = Kosten eines Schritts je Stufe (Server: über das
 * KI-Tor, lib/agenten/leistung.ts). Der Schritt-Budget-Deckel zählt. Rein.
 */
export function kostenSchaetzung(def: Pick<ProzessDefinition, 'knoten'>, laeufeJeMonat: number, jeStufeCent: (stufe: AgentSchritt['modell']) => number): { schritte: number; jeLaufCent: number; monatCent: number } {
  const agenten = alleSchritte(def).map(x => x.schritt).filter(k => k.form === 'agent' && k.agent);
  const jeLauf = agenten.reduce((n, k) => n + Math.min(k.agent!.budgetCent || Infinity, jeStufeCent(k.agent!.modell)), 0);
  return { schritte: agenten.length, jeLaufCent: Math.round(jeLauf), monatCent: Math.round(jeLauf * Math.max(0, laeufeJeMonat)) };
}

// ══ Versionen (Punkt 44) ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export interface UmzugZeile { laufId: string; knoten: string | null; nach: string | null; ok: boolean; grund?: string }
/**
 * Vorschau eines Umzugs alt → neu (rein): je offenem Lauf, wo er stünde — derselbe Knoten (gleiche Kennung) bzw. die ausdrückliche Zuordnung `zuordnung[alt] = neu`.
 * Ohne Ziel kein Umzug (der Lauf bleibt auf seiner Version).
 */
export function umzugVorschau(laeufe: readonly ProzessLauf[], neu: Pick<ProzessDefinition, 'knoten'>, zuordnung: Readonly<Record<string, string>> = {}): UmzugZeile[] {
  const ids = new Set(neu.knoten.map(k => k.id));
  return laeufe.filter(laufOffen).map(l => {
    if (!l.aktuell) return { laufId: l.id, knoten: null, nach: null, ok: true };
    const ziel = zuordnung[l.aktuell] ?? (ids.has(l.aktuell) ? l.aktuell : null);
    return ziel && ids.has(ziel) ? { laufId: l.id, knoten: l.aktuell, nach: ziel, ok: true } : { laufId: l.id, knoten: l.aktuell, nach: null, ok: false, grund: 'Diesen Schritt gibt es in der neuen Version nicht — bitte zuordnen.' };
  });
}
/** Einen Lauf umziehen (rein) — nur mit gültiger Zeile; ein wartender Lauf wartet am neuen Knoten weiter. */
export function umziehen(l: ProzessLauf, version: number, z: UmzugZeile, jetzt: string): ProzessLauf {
  if (!z.ok || !laufOffen(l)) return l;
  const n = kopie(l);
  n.version = version; n.geaendert = jetzt;
  if (z.knoten && z.nach && z.nach !== z.knoten) {
    n.aktuell = z.nach;
    const s = offenerSchritt({ schritte: n.schritte, aktuell: z.knoten });
    if (s) s.knoten = z.nach;
    if (n.wartet) n.wartet = { ...n.wartet, knoten: z.nach };
  }
  return n;
}

// ══ Schleifenschutz beim Veröffentlichen (Punkt 49) ═════════════════════════════════════════════════════════════════════════════════════════════

/** Ereignisse, die ein Baustein selbst auslösen kann (nach der Freigabe bzw. als Wirkung). */
const AUSLOEST: Readonly<Record<string, readonly SkillEreignis[]>> = {
  'inbox.mail-entwurf': ['antwort-gesendet'], 'whatsapp.entwurf': ['antwort-gesendet'], 'crm.deal-stufe': ['deal-stufe'], 'crm.deal-anlegen': ['deal-stufe'],
  'crm.lead-qualifizieren': ['lead-sql'], 'crm.followup': ['followup-erledigt'], 'rechnung.erfassen': ['rechnung-gestellt'],
};
/** Ein Prozess, der auf ein Ereignis hört, das er selbst auslösen kann: Hinweis (die eigene Wirkung startet ihn nie wieder — der Motor prüft die Herkunft). */
export function schleifenBefunde(d: Pick<ProzessDefinition, 'knoten'>): Befund[] {
  const hoert = new Set(startKnoten(d).map(s => (s.ausloeser?.art === 'ereignis' ? s.ausloeser.ereignis : null)).filter((x): x is SkillEreignis => !!x));
  const raus: Befund[] = [];
  for (const { schritt } of alleSchritte(d)) {
    const l = AUSLOEST[schritt.katalog?.id ?? ''] ?? [];
    const t = l.find(e => hoert.has(e));
    if (t) raus.push({ stufe: 'hinweis', knotenId: schritt.id, text: `„${schritt.titel}“ kann das Ereignis auslösen, auf das der Prozess hört — die eigene Wirkung startet ihn nicht erneut (Schleifenschutz), andere Prozesse schon.` });
  }
  return raus;
}

// ══ Lauf-Ansicht, Probelauf, Lage, Heute, Kennzahlen ════════════════════════════════════════════════════════════════════════════════════════════

/** Ein Lauf in der Liste (Punkt 29, Läufe-Reiter): Status, Dauer, Version, Kosten — nur Kennungen und Zahlen. */
export interface LaufKurz { id: string; prozessId: string; version: number; modus: LaufModus; status: ProzessLauf['status']; fall: LaufFall; start: string; ende?: string; dauerMin: number; kostenCent: number; aktuell: string | null; wartet?: ProzessLauf['wartet']; grund?: LaufGrund; ergebnis?: ProzessLauf['ergebnis']; durchgang: number }
export function laufKurz(l: ProzessLauf, jetzt: string): LaufKurz {
  return {
    id: l.id, prozessId: l.prozessId, version: l.version, modus: l.modus, status: l.status, fall: l.fall, start: l.start, ...(l.ende ? { ende: l.ende } : {}),
    dauerMin: Math.max(0, Math.round((Date.parse(l.ende ?? jetzt) - Date.parse(l.start)) / 60_000)), kostenCent: l.kostenCent, aktuell: l.aktuell,
    ...(l.wartet ? { wartet: l.wartet } : {}), ...(l.grund ? { grund: l.grund } : {}), ...(l.ergebnis ? { ergebnis: l.ergebnis } : {}), durchgang: l.durchgang,
  };
}
/** Je Knoten der Stand im Lauf (Punkt 29: grün erledigt · gelb wartet · rot Fehler · grau nicht erreicht = fehlt) — der jüngste Besuch zählt. */
export function knotenStand(l: ProzessLauf): Record<string, { status: SchrittStatus; ab: string; bis?: string; runden: number; wirkung: Wirkung[]; kostenCent: number; grund?: LaufGrund; ausgang?: LaufAusgang }> {
  const raus: ReturnType<typeof knotenStand> = {};
  for (const s of l.schritte) {
    const alt = raus[s.knoten];
    raus[s.knoten] = {
      status: s.status, ab: s.ab, ...(s.bis ? { bis: s.bis } : {}), runden: (alt?.runden ?? 0) + 1, wirkung: [...(alt?.wirkung ?? []), ...(s.wirkung ?? [])],
      kostenCent: (alt?.kostenCent ?? 0) + (s.kostenCent ?? 0), ...(s.grund ? { grund: s.grund } : {}), ...(s.ausgang ? { ausgang: s.ausgang } : {}),
    };
  }
  return raus;
}

/** Der Probelauf als Zeilen (Vertrag der Werkstatt, B2): je besuchtem Knoten Status und Satz — „würde …“, nie etwas geschrieben. */
export interface ProbeZeile { knotenId: string; status: 'wuerde' | 'uebersprungen' | 'wartet' | 'freigabe' | 'fehler'; text: string; kostenCent?: number; /** „Schritt testen“ (22.10.): was der Schritt täte. */ ausgabe?: ProbeAusgabe }
/**
 * Was der Probelauf zusätzlich weiß (Runde 3, Server): der Name eines Teilprozesses und die Zahl der Einträge einer Liste (CRM-Abfrage davor, nur gelesen). Ohne
 * Angabe: der Satz ohne diese Teile.
 */
export interface ProbeWissen { teilTitel?: (prozessId: string) => string | null; listeAnzahl?: (liste: string) => number | null }
export function probeZeilen(l: ProzessLauf, def: ProzessDefinition, o: ProbeWissen = {}): { schritte: ProbeZeile[]; kostenSchaetzungCent: number } {
  const nach = new Map(def.knoten.map(k => [k.id, k]));
  // Die Zahl einer Liste: aus der Abfrage (Server) bzw. aus dem Probelauf-Fall („abfrage.anzahl“ der Testdaten).
  const anzahlAusDaten = (() => { const v = Number(l.daten?.['abfrage.anzahl']); return l.daten?.['abfrage.anzahl'] !== undefined && Number.isFinite(v) ? v : null; })();
  const schleife = (k: K, titel: string) => schleifeSatz({
    anzahl: (k.schleife ? o.listeAnzahl?.(k.schleife.liste) ?? null : null) ?? anzahlAusDaten, element: schleifenElementFall(def, k),
    teil: k.schleife ? o.teilTitel?.(k.schleife.prozessId) ?? null : null, hoechstens: k.schleife?.hoechstens ?? 0, titel,
  });
  const schritte: ProbeZeile[] = [];
  for (const s of l.schritte) {
    const k = nach.get(s.knoten);
    const titel = k?.titel ?? s.knoten;
    const st: ProbeZeile['status'] = s.status === 'fehler' ? 'fehler' : s.status === 'uebersprungen' ? 'uebersprungen' : s.status === 'freigabe' ? 'freigabe' : s.status === 'wartet' ? 'wartet' : 'wuerde';
    const satz = s.status === 'fehler' ? `hält an: ${GRUND_TEXT[s.grund ?? 'dauerhaft']}`
      : s.status === 'uebersprungen' ? `übersprungen: ${GRUND_TEXT[s.grund ?? 'kein-weg']}`
        : s.status === 'freigabe' ? `würde zur Freigabe vorlegen: ${titel}`
          : s.status === 'wartet' ? `würde warten: ${titel}`
            : k?.form === 'agent' ? `würde ${k.agent?.wer.art === 'zoe' ? 'ZOE' : 'den Agenten'} fragen${s.kostenCent ? `, ca. ${Math.max(1, Math.round(s.kostenCent))} ct` : ''}`
              : k?.form === 'schleife' ? schleife(k, titel)
              : k?.abfrage ? `würde im CRM abfragen: ${titel} (höchstens ${k.abfrage.hoechstens})`
              : k?.katalog?.id === 'system.fest' ? `würde den festen Schritt ausführen: ${titel}`
              : k?.form === 'ausloeser' ? `startet: ${titel}`
                : k?.form === 'ende' ? `endet: ${titel}`
                  : k?.form === 'entscheidung' ? `entscheidet: ${titel} → ${s.ausgang === 'nein' ? 'nein' : 'ja'}${s.grund === 'daten-fehlen' ? ` (${GRUND_TEXT['daten-fehlen']})` : ''}`
                    : s.grund === 'vorbereitet' ? `bereitet vor: ${titel}`
                      : `würde: ${titel}`;
    schritte.push({ knotenId: s.knoten, status: st, text: satz, ...(s.kostenCent ? { kostenCent: Math.round(s.kostenCent) } : {}) });
  }
  return { schritte, kostenSchaetzungCent: Math.round(l.schritte.reduce((n, s) => n + (s.kostenCent ?? 0), 0)) };
}

// ══ „Schritt testen“ (Werkstatt bau-fertig, 22.10., Punkt 10): was ein Schritt täte — als Tabelle (Inhalte) und als JSON (nur Kennungen) ═══════════════

/** Eine Zeile der Ausgabe: Feld und Wert (Text für Menschen — Inhalte nur aus Beispiel bzw. live mit den Rechten der Person). */
export interface AusgabeZeile { feld: string; wert: string }
/**
 * Die Ausgabe eines Schritts: Tabelle für Menschen, JSON nur mit Kennungen, Arten und Zahlen (nie Namen, Adressen, Texte). `treffer` (Bau-Test 2, 24.10.): an einer
 * CRM-Abfrage die ersten Treffer zum Ansehen — nur Kennung, Name und Link (lib/prozesse/kundengewinnung/abfrage.ts `abfrageTreffer`), nie im JSON.
 */
export interface ProbeAusgabe { zeilen: AusgabeZeile[]; json: Record<string, string | number | boolean | null>; treffer?: { art: string; id: string; name: string; href: string }[] }

const zeit = (iso: string | undefined): string => {
  if (!iso) return '';
  const t = new Date(iso);
  return Number.isFinite(t.getTime()) ? t.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Berlin' }) : iso;
};
const kurz = (t: string, n = 600) => (t.length > n ? `${t.slice(0, n)} …` : t);

/**
 * Die Ausgabe eines beobachteten Schritts (rein) — „würde senden: … an …“ steht ausdrücklich da, das Freigabe-Schloss bleibt sichtbar; gesendet, angelegt, gefragt wird
 * NIE (der Probelauf läuft im Schatten). `felder` = die Felder für Rauten (Beispiel bzw. Fall), `feldName` = wie ein Feld heißt.
 */
export function probeAusgabe(b: ProbeBeobachtung, def: Pick<ProzessDefinition, 'knoten'>, o: { felder?: Readonly<Record<string, unknown>>; feldName?: (id: string) => string } = {}): ProbeAusgabe {
  const k = def.knoten.find(x => x.id === b.knoten);
  const z: AusgabeZeile[] = [];
  const j: ProbeAusgabe['json'] = { knoten: b.knoten, ...(b.status ? { status: b.status } : {}), ...(b.ausgang ? { ausgang: b.ausgang } : {}), ...(b.grund ? { grund: b.grund } : {}) };
  const a = b.aktion;
  if (a) {
    j.art = a.art;
    switch (a.art) {
      case 'aufgabe':
        z.push({ feld: 'Wirkung', wert: 'würde eine Aufgabe anlegen (Abhaken treibt den Lauf weiter)' }, { feld: 'Titel', wert: a.titel }, { feld: 'Für', wert: a.an ?? 'die zuständige Person des Falls' });
        if (a.faellig) z.push({ feld: 'Fällig', wert: a.faellig });
        if (a.prioritaet) z.push({ feld: 'Priorität', wert: a.prioritaet });
        if (a.beschreibung) z.push({ feld: 'Beschreibung', wert: kurz(a.beschreibung) });
        Object.assign(j, { an: a.an, faellig: a.faellig ?? null, ...Object.fromEntries(Object.entries(a.bezug).map(([x, y]) => [x, y ?? null])) });
        break;
      case 'vorschlag':
        if (a.sende) {
          const an = a.sende.an;
          z.push({ feld: 'Wirkung', wert: `würde senden (${a.sende.kanal === 'mail' ? 'Mail' : 'WhatsApp'}) — erst nach der Freigabe im Stapel (Schloss)` });
          z.push({ feld: 'An', wert: a.sende.kanal === 'mail' ? `${an.name} <${an.email ?? ''}>` : `${an.name} (${an.telefon ?? ''})` });
          if (a.sende.kanal === 'mail') z.push({ feld: 'Betreff', wert: a.sende.betreff }, { feld: 'Text', wert: kurz(a.sende.text, 2000) });
          else { if (a.sende.vorlage) z.push({ feld: 'Vorlage', wert: a.sende.vorlage }); if (a.sende.text) z.push({ feld: 'Text', wert: kurz(a.sende.text, 2000) }); }
          Object.assign(j, { kanal: a.sende.kanal, an: an.kontaktId, ...(a.sende.kanal === 'mail' && a.sende.postfach ? { postfach: a.sende.postfach } : {}) });
        } else {
          z.push({ feld: 'Wirkung', wert: a.sorte === 'entscheidung' ? 'würde eine Person entscheiden lassen (Stapel: freigeben = ja, ablehnen = nein)' : 'würde zur Freigabe in den Stapel legen' }, { feld: 'Titel', wert: a.titel });
          if (a.nachher) z.push({ feld: 'Text', wert: kurz(a.nachher) });
          if (a.wirkung) z.push({ feld: 'Nach der Freigabe', wert: a.wirkung.art === 'crm' ? 'über den CRM-Vorschlag (vorhandener Schreibweg)' : a.wirkung.art === 'fulfillment' ? 'startet den Fulfillment-Fall' : `Termin mit Einladung an ${a.wirkung.an.name} (erst nach der Rückfrage)` });
          else if (a.danach) z.push({ feld: 'Nach der Freigabe', wert: `Aufgabe „${a.danach.titel}“ (von Hand)` });
        }
        z.push({ feld: 'Freigabe durch', wert: a.fuer ?? 'die zuständige Person des Falls' }, { feld: 'Frist', wert: zeit(a.bis) });
        Object.assign(j, { sorte: a.sorte, fuer: a.fuer, bis: a.bis.slice(0, 10), schloss: true });
        break;
      case 'crm-vorschlag':
        z.push({ feld: 'Wirkung', wert: 'würde einen CRM-Vorschlag in den Stapel legen (übernommen erst per Klick)' }, { feld: 'Art', wert: String(a.eingabe.art ?? '') });
        Object.assign(j, { vorschlag: String(a.eingabe.art ?? '') });
        break;
      case 'meldung':
        z.push({ feld: 'Wirkung', wert: a.telegram ? 'würde einen neutralen Telegram-Hinweis schicken (ohne Inhalte)' : 'würde in der Glocke melden (nur intern)' }, { feld: 'An', wert: a.an ?? 'die Person des Laufs' }, { feld: 'Text', wert: a.titel });
        Object.assign(j, { an: a.an, ...(a.telegram ? { telegram: a.telegram } : {}) });
        break;
      case 'agent':
        z.push({ feld: 'Wirkung', wert: 'würde den Agenten fragen — das Ergebnis wäre nur ein Vorschlag' }, { feld: 'Stufe', wert: a.schritt.modell }, { feld: 'Kosten (Schätzung)', wert: `ca. ${Math.max(1, Math.round(a.kostenCent))} ct` });
        if (a.schritt.werkzeuge.length) z.push({ feld: 'Werkzeuge', wert: a.schritt.werkzeuge.join(', ') });
        Object.assign(j, { stufe: a.schritt.modell, kostenCent: Math.round(a.kostenCent), wer: a.schritt.wer.art });
        break;
      case 'teilprozess':
        z.push({ feld: 'Wirkung', wert: a.uebergabe ? 'würde den Fall an einen anderen Prozess übergeben' : a.warten ? 'würde einen Teilprozess starten und auf ihn warten' : 'würde einen anderen Prozess starten (ohne zu warten)' });
        Object.assign(j, { prozessId: a.prozessId, warten: a.warten });
        break;
      case 'abfrage':
        z.push({ feld: 'Wirkung', wert: 'würde im CRM abfragen (nur lesen)' }, { feld: 'Was', wert: ABFRAGE_NAME[a.abfrage.art] ?? a.abfrage.art }, { feld: 'Höchstens', wert: String(a.abfrage.hoechstens) });
        Object.assign(j, { abfrage: a.abfrage.art, hoechstens: a.abfrage.hoechstens });
        break;
      case 'schleife':
        z.push({ feld: 'Wirkung', wert: 'würde je Eintrag einen Teil-Lauf starten' }, { feld: 'Höchstens je Lauf', wert: String(a.hoechstens) });
        Object.assign(j, { prozessId: a.prozessId, liste: a.liste, hoechstens: a.hoechstens });
        break;
      case 'system': {
        const u = ueberfuehrbarZuSchritt(a.schritt);
        z.push({ feld: 'Wirkung', wert: `würde den festen Schritt „${u.teil}“ ausführen — wie der alte Ablauf im Code` }, { feld: 'Was', wert: u.satz }, { feld: 'Kennungen', wert: u.kennung });
        Object.assign(j, { schritt: a.schritt, ersetzt: u.sp });
        break;
      }
    }
  } else if (b.warten) {
    z.push({ feld: 'Wirkung', wert: b.warten.art === 'ereignis' ? 'würde auf ein Ereignis warten' : b.warten.art === 'datum' ? 'würde bis zu einem Datum am Fall warten' : 'würde warten' }, { feld: 'Höchstens bis', wert: zeit(b.warten.bis) });
    Object.assign(j, { warten: b.warten.art, bis: b.warten.bis?.slice(0, 16) ?? null });
  } else if (k?.form === 'entscheidung' && k.raute?.art === 'regel') {
    const felder = o.felder ?? {};
    for (const x of k.raute.bedingungen) z.push({ feld: bedingungText(x, o.feldName), wert: bedingungTrifft(x, felder) ? 'erfüllt' : 'nicht erfüllt' });
    z.push({ feld: 'Ergebnis', wert: b.ausgang === 'nein' ? 'nein' : 'ja' });
  } else if (k?.form === 'entscheidung' && k.raute?.art === 'score') {
    z.push({ feld: 'Prüfung', wert: k.raute.pruefung }, { feld: 'Ergebnis', wert: b.ausgang === 'nein' ? 'nein' : 'ja' });
  } else if (b.status === 'fehler' || b.status === 'uebersprungen') {
    z.push({ feld: b.status === 'fehler' ? 'Hält an' : 'Übersprungen', wert: GRUND_TEXT[b.grund ?? (b.status === 'fehler' ? 'dauerhaft' : 'kein-weg')] });
  } else {
    z.push({ feld: 'Wirkung', wert: b.grund === 'vorbereitet' ? 'bereitet vor — die Wirkung geschieht erst nach der Freigabe (Schloss dahinter)' : k?.form === 'ausloeser' ? 'startet den Lauf' : k?.form === 'ende' ? 'beendet den Lauf' : 'geht weiter' });
  }
  if (b.ausgang && !z.some(x => x.feld === 'Ergebnis')) z.push({ feld: 'Weiter über', wert: b.ausgang });
  return { zeilen: z, json: j };
}

/** Lage der Prozesse (Punkt 88, Head of IT) — nur Zähler. */
export interface ProzessLage { laeufe: number; offen: number; wartend: number; fehler: number; haengend: number; freigabenUeberfaellig: number; zurueckgehalten: number; abgelehnt: number; laeufe7d: number; fehler7d: number; pausiertNotbremse: number; pausiertBudget: number }
export function laufLage(d: LaeufeDatei, jetzt: string): ProzessLage {
  const vor7 = new Date(Date.parse(jetzt) - 7 * 86_400_000).toISOString();
  const haengt = new Date(Date.parse(jetzt) - LAUF_GRENZEN.haengtTage * 86_400_000).toISOString();
  const scharf = d.laeufe.filter(l => l.modus === 'scharf');
  const st = Object.values(d.prozesse);
  return {
    laeufe: scharf.length,
    offen: scharf.filter(laufOffen).length,
    wartend: scharf.filter(l => l.status === 'wartet').length,
    fehler: scharf.filter(l => l.status === 'fehler').length,
    haengend: scharf.filter(l => (l.status === 'wartet' || l.status === 'laeuft') && l.geaendert < haengt).length,
    freigabenUeberfaellig: scharf.filter(l => l.status === 'wartet' && l.wartet?.art === 'freigabe' && !!l.wartet.bis && l.wartet.bis < jetzt).length,
    zurueckgehalten: d.zurueckgehalten.length,
    abgelehnt: st.reduce((n, s) => n + (s.nicht?.voll ?? 0), 0),
    laeufe7d: scharf.filter(l => l.start >= vor7).length,
    fehler7d: scharf.filter(l => l.start >= vor7 && (l.status === 'fehler' || l.schritte.some(s => s.status === 'fehler'))).length,
    pausiertNotbremse: st.filter(s => s.pause?.grund === 'notbremse').length,
    pausiertBudget: st.filter(s => s.pause?.grund === 'budget').length,
  };
}

/** Heute-Zeile (Punkt 69: „Prozesse heute: n gelaufen, m warten“) — nur Läufe, die die Person betreffen bzw. ohne Person; nur scharf. */
export function heuteZeile(d: LaeufeDatei, person: string, jetzt: string): { gelaufen: number; warten: number; aufDich: number } {
  const heute = tagVonIso(jetzt);
  const l = d.laeufe.filter(x => x.modus === 'scharf');
  return {
    gelaufen: l.filter(x => tagVonIso(x.geaendert) === heute && x.schritte.some(s => s.bis && tagVonIso(s.bis) === heute)).length,
    warten: l.filter(x => x.status === 'wartet').length,
    aufDich: l.filter(x => x.status === 'wartet' && (x.wartet?.art === 'freigabe' || x.wartet?.art === 'aufgabe') && x.person === person).length,
  };
}

/**
 * Kennzahlen eines Prozesses (M5 „Zeit bis zur ersten Reaktion“, Befolgung): Median der Wartezeit bis „eingetreten“ an einem Warten auf ein Ereignis, Anteil
 * innerhalb der Obergrenze („in der Uhr“), Anteil der Läufe mit Ziel. Nur scharf, nur aus den Läufen — ohne Messung null (nie eine Null). Rein.
 */
export function laufKennzahlen(laeufe: readonly ProzessLauf[], prozessId: string): { laeufe: number; ziel: number | null; reaktionMedianMin: number | null; inDerUhr: number | null } {
  const l = laeufe.filter(x => x.prozessId === prozessId && x.modus === 'scharf');
  const fertig = l.filter(x => !laufOffen(x));
  const zeiten: number[] = [], inUhr: boolean[] = [];
  for (const x of l) for (const s of x.schritte) {
    if (!s.bis || (s.ausgang !== 'eingetreten' && s.ausgang !== 'abgelaufen')) continue;
    if (s.ausgang === 'eingetreten') zeiten.push((Date.parse(s.bis) - Date.parse(s.ab)) / 60_000);
    inUhr.push(s.ausgang === 'eingetreten');
  }
  zeiten.sort((a, b) => a - b);
  return {
    laeufe: l.length,
    ziel: fertig.length ? Math.round((fertig.filter(x => x.ergebnis === 'erfolg' || x.ergebnis === 'uebergabe').length / fertig.length) * 100) : null,
    reaktionMedianMin: zeiten.length ? Math.round(zeiten[Math.floor((zeiten.length - 1) / 2)]) : null,
    inDerUhr: inUhr.length ? Math.round((inUhr.filter(Boolean).length / inUhr.length) * 100) : null,
  };
}

// ══ Bestand säubern (robust, nie gekürzt) ═══════════════════════════════════════════════════════════════════════════════════════════════════════

type O = Record<string, unknown>;
const obj = (v: unknown): O | null => (v && typeof v === 'object' && !Array.isArray(v) ? v as O : null);
const istLauf = (v: unknown): v is ProzessLauf => {
  const o = obj(v);
  return !!o && typeof o.id === 'string' && typeof o.prozessId === 'string' && typeof o.version === 'number' && !!obj(o.fall) && typeof o.status === 'string' && Array.isArray(o.schritte) && typeof o.schluessel === 'string';
};

/** Den Bestand lesen (robust): Unlesbares fällt weg, nie ein Absturz; Listen nie gekürzt. */
export function laeufeAus(roh: unknown): LaeufeDatei {
  const o = obj(roh);
  if (!o) return { v: 1, laeufe: [], zurueckgehalten: [], prozesse: {} };
  const laeufe = (Array.isArray(o.laeufe) ? o.laeufe : []).filter(istLauf).map(l => ({ ...l, daten: obj(l.daten) ? l.daten : {}, kostenCent: typeof l.kostenCent === 'number' ? l.kostenCent : 0, tiefe: typeof l.tiefe === 'number' ? l.tiefe : 0, durchgang: typeof l.durchgang === 'number' ? l.durchgang : 1 }));
  const zurueckgehalten = (Array.isArray(o.zurueckgehalten) ? o.zurueckgehalten : []).filter((z): z is Zurueckgehalten => !!obj(z) && typeof (z as O).id === 'string' && typeof (z as O).prozessId === 'string' && !!obj((z as O).fall));
  const prozesse: Record<string, ProzessLaufStand> = {};
  for (const [id, st] of Object.entries(obj(o.prozesse) ?? {})) {
    const s = obj(st);
    if (!s) continue;
    prozesse[id] = { ...(s as unknown as ProzessLaufStand), einstellung: (obj(s.einstellung) ?? {}) as LaufEinstellung, verlauf: Array.isArray(s.verlauf) ? s.verlauf as VerlaufEintrag[] : [] };
  }
  const c = obj(o.cursor);
  return { v: 1, laeufe, zurueckgehalten, prozesse, ...(c && typeof c.nr === 'number' && typeof c.am === 'string' ? { cursor: { nr: c.nr, am: c.am } } : {}) };
}

/** Einen Eintrag im Verlauf des Prozesses anhängen (über der Grenze fällt der älteste weg — gezählt im Eintrag `n` der Grenze nicht nötig: Frist räumt). */
export function verlaufAnhaengen(st: ProzessLaufStand, e: VerlaufEintrag): ProzessLaufStand {
  const v = [...st.verlauf, e];
  return { ...st, verlauf: v.length > LAUF_GRENZEN.verlauf ? v.slice(v.length - LAUF_GRENZEN.verlauf) : v };
}

// ══ Einstellungen prüfen (Route) ════════════════════════════════════════════════════════════════════════════════════════════════════════════════

/** Bedingungen von Ziel/Abbruch säubern (nur die Form — die Felder prüft die Werkstatt): höchstens 20, nur bekannte Ops. */
export function zielAbbruchAus(roh: unknown): { bedingungen: Bedingung[]; verknuepfung?: Verknuepfung } | null | 'fehler' {
  if (roh === null) return null;
  const o = obj(roh);
  if (!o || !Array.isArray(o.bedingungen)) return 'fehler';
  if (o.bedingungen.length > 20) return 'fehler';
  const OPS = ['gleich', 'ungleich', 'enthaelt', 'beginnt', 'groesser', 'kleiner', 'gesetzt', 'leer', 'einer-von'];
  const b: Bedingung[] = [];
  for (const x of o.bedingungen) {
    const y = obj(x);
    if (!y || typeof y.feld !== 'string' || !/^[a-z][a-z0-9_.-]{0,59}$/.test(y.feld) || typeof y.op !== 'string' || !OPS.includes(y.op)) return 'fehler';
    const w = y.wert;
    if (w !== undefined && typeof w !== 'string' && typeof w !== 'number' && typeof w !== 'boolean' && !(Array.isArray(w) && w.every(z => typeof z === 'string'))) return 'fehler';
    b.push({ feld: y.feld, op: y.op as Bedingung['op'], ...(w !== undefined ? { wert: w as Bedingung['wert'] } : {}) });
  }
  if (!b.length) return null;
  return { bedingungen: b, ...(o.verknuepfung === 'oder' ? { verknuepfung: 'oder' as const } : {}) };
}

/** Prüft, ob eine Version laufen kann (rein) — dieselbe Prüfung im Probelauf und beim Scharfschalten: Modell-Rauten laufen in C1 nicht. */
export function laufBefunde(d: Pick<ProzessDefinition, 'knoten'>): Befund[] {
  const raus: Befund[] = [];
  for (const { schritt } of alleSchritte(d)) {
    if (schritt.form === 'entscheidung' && schritt.raute?.art === 'modell') raus.push({ stufe: 'offen', knotenId: schritt.id, text: `„${schritt.titel}“: ${GRUND_TEXT['modell-raute']}.` });
    // Seit 22.10. spät läuft die Schleife — nur über eine CRM-Abfrage dieses Prozesses bzw. eine Liste am Fall, die der Motor kennt.
    const liste = schritt.form === 'schleife' ? schritt.schleife?.liste : undefined;
    if (liste && !liste.startsWith('abfrage:') && !(SCHLEIFE_LISTEN as readonly string[]).includes(liste)) raus.push({ stufe: 'hinweis', knotenId: schritt.id, text: `„${schritt.titel}“: die Liste „${liste}“ kennt der Motor nicht — der Lauf hält dort an (${GRUND_TEXT['liste-fehlt']}).` });
  }
  return [...raus, ...schleifenBefunde(d)];
}

/** Die veröffentlichte Version eines Eintrags (bzw. null). */
export const versionVon = (e: Pick<ProzessEintrag, 'versionen'>, nr: number) => e.versionen.find(v => v.nr === nr) ?? null;
export const juengsteNr = (e: Pick<ProzessEintrag, 'versionen'>): number | null => (e.versionen.length ? Math.max(...e.versionen.map(v => v.nr)) : null);
export { fallArtVon };
