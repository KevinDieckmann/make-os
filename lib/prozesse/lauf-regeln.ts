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
import { bedingungenTreffen } from './bedingung';
import { brauchtSchloss, FORM_KLASSE, katalogEintrag, klasseVonEintrag, maskeVorgaben, textvorlageFuellen, type KatalogEintrag } from './baustein-katalog';
import type { AnspracheUrteil } from './ansprache';
import {
  bereichVon, fallArtVon,
  type AgentSchritt, type Befund, type Bedingung, type DatumsFeld, type FallArt, type MaskenWert, type ProzessDefinition, type ProzessEintrag, type ProzessForm,
  type ProzessKnoten, type SkillEreignis, type Verknuepfung,
} from './definition';
import {
  GRUND_TEXT, LAUF_GRENZEN, laufOffen, leererStand,
  type LaeufeDatei, type LaufAusgang, type LaufAusloeser, type LaufEinstellung, type LaufFall, type LaufGrund, type LaufModus, type LaufSchritt, type LaufWarten,
  type ProzessLauf, type ProzessLaufStand, type SchrittStatus, type VerlaufEintrag, type WarteArt, type Wirkung, type Zurueckgehalten,
} from './lauf-typen';
import { ausWandzeit, minutenVon, tagPlus, tagVon, wandAus, wandzeit } from '@/lib/kalender/zeit';
import { istWerktag, werktagePlus } from '@/lib/aufgaben/feiertage';

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

/** Darf ein Agenten-Schritt jetzt laufen? (Takt-Fenster 7–22 Uhr, Tageshöchstzahl des Heads, Budget des Prozesses und des Schritts, Hintergrund-KI). */
export type AgentFreigabe = { ok: true; kostenCent: number } | { ok: false; grund: LaufGrund; bis?: string; pause?: true; kostenCent?: number };

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
}

// ══ Aktionen (Wirkungen) ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export interface AufgabeBezug { kontaktId?: string; firmaId?: string; dealId?: string; mandatId?: string }
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
  }
  | { art: 'crm-vorschlag'; kennung: string; knoten: string; titel: string; eingabe: Record<string, unknown> }
  | { art: 'meldung'; kennung: string; knoten: string; an: string | null; titel: string; telegram?: string }
  | { art: 'agent'; kennung: string; knoten: string; titel: string; schritt: AgentSchritt; kostenCent: number }
  | { art: 'teilprozess'; kennung: string; knoten: string; prozessId: string; warten: boolean; uebergabe?: true };

/** Worauf ein Lauf nach dieser Aktion wartet — null: gleich weiter. */
export function warteArtVon(a: Aktion): WarteArt | null {
  if (a.art === 'aufgabe') return 'aufgabe';
  if (a.art === 'vorschlag') return 'freigabe';
  if (a.art === 'teilprozess') return a.warten && !a.uebergabe ? 'teilprozess' : null;
  return null;
}

/** Ergebnis einer Aktion (vom Server) — `voruebergehend` wird wiederholt (Backoff), `dauerhaft` geht über die Fehlerkante bzw. hält an. */
export type AktionErgebnis =
  | { ok: true; wirkung?: Wirkung[]; kostenCent?: number; /** Agenten-Schritt: das gefragte Modell und die Tokens (Log-Baum der Läufe-Ansicht). */ modell?: string; token?: { ein: number; aus: number } }
  | { ok: false; art: 'voruebergehend' | 'dauerhaft'; grund: LaufGrund };

type Plan =
  | { art: 'weiter'; ausgang: LaufAusgang; status?: SchrittStatus; grund?: LaufGrund; sprung?: string; zaehle?: true }
  | { art: 'ende'; ergebnis: 'erfolg' | 'abbruch' | 'uebergabe'; aktion?: Aktion }
  | { art: 'warten'; warten: Omit<LaufWarten, 'knoten'>; ausgangSchatten: LaufAusgang }
  | { art: 'aktion'; aktion: Aktion; schatten: SchrittStatus; ausgangSchatten: LaufAusgang }
  | { art: 'fehler'; grund: LaufGrund }
  | { art: 'pause'; grund: 'budget' };

// ══ Lauf-Grundlagen ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const kopie = (l: ProzessLauf): ProzessLauf => ({ ...l, schritte: l.schritte.map(s => ({ ...s, ...(s.wirkung ? { wirkung: [...s.wirkung] } : {}) })), ...(l.zaehler ? { zaehler: { ...l.zaehler } } : {}), ...(l.wartet ? { wartet: { ...l.wartet } } : {}), daten: { ...l.daten } });

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
const LESEN_BAUSTEINE = new Set(['crm.firma-akte', 'crm.abfragen']);
const CRM_VORSCHLAG_BAUSTEINE = new Set(['crm.kontakt-notiz', 'crm.deal-anlegen', 'crm.deal-stufe', 'crm.lead-qualifizieren', 'crm.followup', 'angebot.entwurf']);
const SENDE_BAUSTEINE = new Set(['inbox.mail-entwurf', 'whatsapp.entwurf']);

function bis(u: LaufUmfeld, tage: unknown): string {
  const t = zahl(tage);
  return zeitPlus(u.jetzt, { tage: t !== undefined && t >= 1 ? t : u.freigabeFristTage ?? LAUF_GRENZEN.freigabeFristTage });
}

function aufgabePlan(l: ProzessLauf, k: K, kennung: string, u: LaufUmfeld, o: { titel: string; beschreibung?: string; wer?: unknown; fristTage?: unknown; prioritaet?: unknown; hinweis?: string }): Plan {
  const frist = zahl(o.fristTage);
  const beschreibung = [o.beschreibung, `Schritt im Prozess „${u.titel}“. Hakt ihr die Aufgabe ab, geht der Prozess weiter.`, o.hinweis].filter(Boolean).join('\n\n');
  return {
    art: 'aktion', schatten: 'wuerde', ausgangSchatten: 'weiter',
    aktion: {
      art: 'aufgabe', kennung, knoten: k.id, titel: (o.titel || k.titel).slice(0, 300), beschreibung: beschreibung.slice(0, 4000),
      an: u.person?.(typeof o.wer === 'string' ? o.wer : undefined) ?? l.person,
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
  return { art: 'weiter', ausgang: 'weiter', status: 'erledigt', grund: 'vorbereitet' };
}

/** Der Vorschlag eines Schlosses für seinen Knoten `x` (Punkt 61): Mail/WhatsApp mit Empfänger und Text; sonst Freigabe + Aufgabe „von Hand“. */
function schlossPlan(l: ProzessLauf, schloss: K, x: K, kennung: string, u: LaufUmfeld): Plan {
  const e = katalogEintrag(x.katalog?.id);
  const werte = werteVon(x, e);
  const fuer = u.person?.(typeof werte.wer === 'string' ? werte.wer : undefined) ?? l.person;
  const frist = bis(u, katalogEintrag(schloss.katalog?.id) ? werteVon(schloss, katalogEintrag(schloss.katalog?.id)).fristTage : undefined);
  if (e && SENDE_BAUSTEINE.has(e.id)) {
    const urteil = u.ansprache?.(e, werte) ?? null;
    if (urteil && !urteil.erlaubt) return { art: 'weiter', ausgang: 'nein', status: 'uebersprungen', grund: 'kanal-rot' };
    const an = u.empfaenger?.(typeof werte.an === 'string' ? werte.an : 'fall.kontakt') ?? null;
    if (e.id === 'inbox.mail-entwurf') {
      if (!an?.email) return { art: 'weiter', ausgang: 'nein', status: 'uebersprungen', grund: 'kein-empfaenger' };
      const betreff = fuellen(werte.betreff, u), txt = fuellen(werte.text, u);
      return {
        art: 'aktion', schatten: 'freigabe', ausgangSchatten: 'ja',
        aktion: {
          art: 'vorschlag', kennung, knoten: schloss.id, sorte: 'freigabe', titel: `${x.titel}: Mail an ${an.name}`.slice(0, 200),
          nachher: `An: ${an.name} <${an.email}>\nBetreff: ${betreff}\n\n${txt}${urteil?.farbe === 'gelb' ? `\n\nHinweis Kanal-Ampel: ${urteil.grund}` : ''}`.slice(0, 8000),
          fuer, bis: frist,
          sende: { kanal: 'mail', ...(typeof werte.postfach === 'string' && werte.postfach ? { postfach: werte.postfach } : {}), an, betreff, text: txt },
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
  // Andere Außenwirkung (Angebot stellen, Einladung, Rechnung, Papierkorb, Agent im „tödlichen Dreieck“): erst die Freigabe, dann von Hand.
  const vonHand = !!e && !e.agent;
  return {
    art: 'aktion', schatten: 'freigabe', ausgangSchatten: 'ja',
    aktion: {
      art: 'vorschlag', kennung, knoten: schloss.id, sorte: 'freigabe', titel: `Freigabe: ${x.titel}`.slice(0, 200),
      nachher: `Der Prozess „${u.titel}“ möchte: ${x.titel}.${vonHand ? ' Nach der Freigabe entsteht eine Aufgabe — ausgeführt wird von Hand.' : ''}`, fuer, bis: frist,
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

function crmVorschlagEingabe(l: ProzessLauf, k: K, e: KatalogEintrag, u: LaufUmfeld): Record<string, unknown> | null {
  const w = werteVon(k, e);
  const b = bezugAus(l, u);
  const heute = tagVonIso(u.jetzt);
  const in_ = (n: unknown) => tagPlus(heute, Math.max(0, Math.round(zahl(n) ?? 0)));
  const leadId = l.fall.art === 'lead' || l.fall.art === 'firma' ? l.fall.id : b.firmaId ?? b.kontaktId;
  switch (e.id) {
    case 'crm.kontakt-notiz': return b.kontaktId ? { art: 'aktivitaet', kontakt: b.kontaktId, aktivitaet_art: 'notiz', text: fuellen(w.text, u) || k.titel } : null;
    case 'crm.deal-anlegen': return b.kontaktId ? { art: 'deal_anlegen', kontakt: b.kontaktId, titel: fuellen(w.titel, u) || k.titel, naechster_schritt: fuellen(w.naechsterSchritt, u) || k.titel, faellig: in_(w.inTagen) } : null;
    case 'crm.deal-stufe': return b.dealId && typeof w.stufe === 'string' ? { art: 'deal_aendern', deal: b.dealId, stufe: w.stufe, ...(text(w.grund) ? { grund: text(w.grund) } : {}) } : null;
    case 'crm.lead-qualifizieren': return leadId && typeof w.status === 'string' ? { art: 'qualifizierung', lead: leadId, lead_status: w.status } : null;
    case 'crm.followup': {
      if (!b.kontaktId && !b.firmaId && !b.dealId && !b.mandatId) return null;
      return { art: 'followup', text: fuellen(w.text, u) || k.titel, faellig: in_(w.inTagen), ...(b.kontaktId ? { kontakt: b.kontaktId } : {}), ...(b.firmaId ? { firma: b.firmaId } : {}), ...(b.dealId ? { deal: b.dealId } : {}), ...(b.mandatId ? { mandat: b.mandatId } : {}), ...(typeof w.wer === 'string' && w.wer ? { zustaendig: w.wer } : {}) };
    }
    case 'angebot.entwurf': return typeof w.gesellschaft === 'string' ? { art: 'angebot_entwurf', gesellschaft: w.gesellschaft, ...(b.kontaktId ? { kontakt: b.kontaktId } : {}), ...(b.firmaId ? { firma: b.firmaId } : {}), ...(b.dealId ? { deal: b.dealId } : {}) } : null;
  }
  return null;
}

function planFuer(l: ProzessLauf, k: K, def: ProzessDefinition, u: LaufUmfeld, kennung: string): Plan {
  const form: ProzessForm = k.form ?? 'schritt';
  const e = katalogEintrag(k.katalog?.id);
  const werte = werteVon(k, e);
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
      if (r?.art === 'regel') return { art: 'weiter', ausgang: bedingungenTreffen(r.bedingungen, u.daten, r.verknuepfung) ? 'ja' : 'nein', status: 'erledigt' };
      if (r?.art === 'score') { const t = scoreTrifft(r, u.daten); return { art: 'weiter', ausgang: t ? 'ja' : 'nein', status: 'erledigt', ...(t === null ? { grund: 'daten-fehlen' as const } : {}) }; }
      // Entscheidung 21.10.: keine Rauten, über die ein Modell entscheidet — in C1 hält so ein Lauf an (Fehlerkante, sonst angehalten).
      if (r?.art === 'modell') return { art: 'fehler', grund: 'modell-raute' };
      const frage = text(werte.frage) || k.titel;
      return {
        art: 'aktion', schatten: 'freigabe', ausgangSchatten: 'ja',
        aktion: {
          art: 'vorschlag', kennung, knoten: k.id, sorte: 'entscheidung', titel: `Entscheidung: ${frage}`.slice(0, 200),
          nachher: `${frage}\n\nFreigeben = ja · Ablehnen = nein (Prozess „${u.titel}“).`, fuer: u.person?.(typeof werte.wer === 'string' ? werte.wer : undefined) ?? l.person,
          bis: bis(u, werte.fristTage),
        },
      };
    }
    case 'freigabe': {
      if (k.schloss?.fuer) {
        const x = def.knoten.find(y => y.id === k.schloss!.fuer);
        if (!x) return { art: 'fehler', grund: 'knoten-fehlt' };
        return schlossPlan(l, k, x, kennung, u);
      }
      return {
        art: 'aktion', schatten: 'freigabe', ausgangSchatten: 'ja',
        aktion: {
          art: 'vorschlag', kennung, knoten: k.id, sorte: 'freigabe', titel: `Freigabe: ${k.titel}`.slice(0, 200), nachher: `Der Prozess „${u.titel}“ wartet auf deine Freigabe: ${k.titel}.`,
          fuer: u.person?.(typeof werte.wer === 'string' ? werte.wer : undefined) ?? l.person, bis: bis(u, werte.fristTage),
        },
      };
    }
    case 'warten': {
      const w = k.warten;
      if (!w) return { art: 'fehler', grund: 'daten-fehlen' };
      if (w.art === 'dauer') return { art: 'warten', ausgangSchatten: 'weiter', warten: { art: 'zeit', bis: zeitPlus(u.jetzt, { tage: w.tage, stunden: w.stunden, arbeitszeit: w.arbeitszeit }) } };
      if (w.art === 'datum') {
        const d = u.fallDatum?.(w.feld) ?? null;
        const ziel = d ? tagIso(d, w.versatzTage ?? 0) : undefined;
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
      const f = u.agent?.(a, k.id) ?? { ok: false as const, grund: 'ki-aus' as const };
      if (f.ok) return { art: 'aktion', schatten: 'wuerde', ausgangSchatten: 'weiter', aktion: { art: 'agent', kennung, knoten: k.id, titel: k.titel, schritt: a, kostenCent: f.kostenCent } };
      if (f.pause) return { art: 'pause', grund: 'budget' };
      if (f.bis) return { art: 'warten', ausgangSchatten: 'weiter', warten: { art: 'fenster', bis: f.bis } };
      return { art: 'fehler', grund: f.grund };
    }
    case 'teilprozess': {
      const t = k.teilprozess;
      if (!t?.prozessId || !u.teilprozess?.(t.prozessId)) return { art: 'fehler', grund: 'teilprozess-fehlt' };
      if (l.tiefe + 1 > LAUF_GRENZEN.kettenTiefe) return { art: 'fehler', grund: 'kette' };
      const warten = t.warten !== false;
      return { art: 'aktion', schatten: 'wuerde', ausgangSchatten: 'weiter', aktion: { art: 'teilprozess', kennung, knoten: k.id, prozessId: t.prozessId, warten } };
    }
    case 'schleife': return { art: 'fehler', grund: 'nicht-gebaut' };
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
  if (e && LESEN_BAUSTEINE.has(e.id)) return { art: 'weiter', ausgang: 'weiter', status: 'erledigt' };
  if (k.abfrage) return { art: 'weiter', ausgang: 'weiter', status: 'erledigt' };
  if (e?.id === 'glocke.melden') return { art: 'aktion', schatten: 'wuerde', ausgangSchatten: 'weiter', aktion: { art: 'meldung', kennung, knoten: k.id, an: u.person?.(typeof werte.wer === 'string' ? werte.wer : undefined) ?? l.person, titel: (fuellen(werte.text, u) || k.titel).slice(0, 280) } };
  if (e?.id === 'telegram.hinweis') return { art: 'aktion', schatten: 'wuerde', ausgangSchatten: 'weiter', aktion: { art: 'meldung', kennung, knoten: k.id, an: typeof werte.an === 'string' ? werte.an : l.person, titel: k.titel.slice(0, 280), telegram: typeof werte.hinweis === 'string' ? werte.hinweis : 'wartet' } };
  if (e && CRM_VORSCHLAG_BAUSTEINE.has(e.id)) {
    const ein = crmVorschlagEingabe(l, k, e, u);
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
    switch (plan.art) {
      case 'weiter':
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
        if (modus === 'schatten') { abschliessen(s, 'wartet', plan.ausgangSchatten, u.jetzt); geh(l, idx, k.id, plan.ausgangSchatten, u.jetzt); continue; }
        s.status = 'wartet';
        if (plan.warten.art === 'fenster') s.grund = 'fenster';
        l.status = 'wartet'; l.wartet = { knoten: k.id, ...plan.warten };
        return { lauf: l, aktion: null };
      case 'aktion': {
        if (modus === 'schatten') {
          if (plan.aktion.art === 'agent') s.kostenCent = plan.aktion.kostenCent;
          // Eine Erinnerung im Schatten: einmal „würde erinnern“, dann wie nach der letzten Runde weiter (sonst kreiste der Probelauf).
          if (k.form === 'erinnerung') { abschliessen(s, plan.schatten, 'weiter', u.jetzt); geh(l, idx, k.id, 'weiter', u.jetzt, ausstiegZiel(def, k) ?? ''); continue; }
          abschliessen(s, plan.schatten, plan.ausgangSchatten, u.jetzt);
          geh(l, idx, k.id, plan.ausgangSchatten, u.jetzt);
          continue;
        }
        s.wirkung = [{ art: wirkungArtVon(plan.aktion), id: plan.aktion.kennung }];
        return { lauf: l, aktion: plan.aktion };
      }
    }
  }
  return { lauf: l, aktion: null };
}

export const wirkungArtVon = (a: Aktion): Wirkung['art'] =>
  a.art === 'aufgabe' ? 'aufgabe' : a.art === 'teilprozess' ? 'lauf' : a.art === 'meldung' ? 'meldung' : 'vorschlag';

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
    delete s.versuch;
    if (a.art === 'teilprozess' && a.uebergabe) { abschliessen(s, 'erledigt', undefined, jetzt); beenden(l, 'fertig', jetzt, { ergebnis: 'uebergabe' }); return l; }
    const w = warteArtVon(a);
    if (w) {
      s.status = 'wartet';
      l.status = 'wartet';
      l.wartet = { knoten: a.knoten, art: w, wirkung: a.kennung, ...(a.art === 'vorschlag' ? { bis: a.bis } : {}) };
      return l;
    }
    abschliessen(s, 'erledigt', 'weiter', jetzt);
    geh(l, idx, a.knoten, 'weiter', jetzt);
    return l;
  }
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
export function wartetAuf(l: ProzessLauf, def: ProzessDefinition, e: { art: SkillEreignis; bezug: Readonly<Record<string, string | undefined>>; bereich: 'privat' | 'business' | null }, daten: Readonly<Record<string, unknown>>): boolean {
  if (l.status !== 'wartet' || l.wartet?.art !== 'ereignis' || l.wartet.ereignis !== e.art || e.bereich === 'privat') return false;
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
  const letzter = gleiche.sort((x, y) => (x.start < y.start ? -1 : 1)).at(-1);
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
export interface ProbeZeile { knotenId: string; status: 'wuerde' | 'uebersprungen' | 'wartet' | 'freigabe' | 'fehler'; text: string; kostenCent?: number }
export function probeZeilen(l: ProzessLauf, def: ProzessDefinition): { schritte: ProbeZeile[]; kostenSchaetzungCent: number } {
  const nach = new Map(def.knoten.map(k => [k.id, k]));
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
              : k?.form === 'ausloeser' ? `startet: ${titel}`
                : k?.form === 'ende' ? `endet: ${titel}`
                  : k?.form === 'entscheidung' ? `entscheidet: ${titel} → ${s.ausgang === 'nein' ? 'nein' : 'ja'}${s.grund === 'daten-fehlen' ? ` (${GRUND_TEXT['daten-fehlen']})` : ''}`
                    : s.grund === 'vorbereitet' ? `bereitet vor: ${titel}`
                      : `würde: ${titel}`;
    schritte.push({ knotenId: s.knoten, status: st, text: satz, ...(s.kostenCent ? { kostenCent: Math.round(s.kostenCent) } : {}) });
  }
  return { schritte, kostenSchaetzungCent: Math.round(l.schritte.reduce((n, s) => n + (s.kostenCent ?? 0), 0)) };
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
    if (schritt.form === 'schleife') raus.push({ stufe: 'hinweis', knotenId: schritt.id, text: `„${schritt.titel}“: die Schleife läuft im Motor noch nicht — der Lauf hält dort an.` });
  }
  return [...raus, ...schleifenBefunde(d)];
}

/** Die veröffentlichte Version eines Eintrags (bzw. null). */
export const versionVon = (e: Pick<ProzessEintrag, 'versionen'>, nr: number) => e.versionen.find(v => v.nr === nr) ?? null;
export const juengsteNr = (e: Pick<ProzessEintrag, 'versionen'>): number | null => (e.versionen.length ? Math.max(...e.versionen.map(v => v.nr)) : null);
export { fallArtVon };
