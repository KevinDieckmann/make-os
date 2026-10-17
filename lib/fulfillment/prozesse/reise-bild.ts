// ─── Fulfillment · Fall als Bild — Kundenjourney-Zeile und Fluss einer Phase (17.10., Miro-Standard) ─────────────────────────────────
// Rückmeldung 17.10.: „So möchte ich das beim Fulfillment auch haben. Es soll nicht überladen sein, sondern sehr klar. Lieber wenig und klar … es dupliziert
// sich.“ Vorbild ist der STIL der Miro-Prozesse (nie deren Inhalte):
//   · Reise (Kundenjourney): die Phasen als EINE Zeile nebeneinander, darunter je Phase höchstens vier kurze Kästchen (Rest „+n“), zwischen den Phasen
//     der Abstimmungspunkt als Raute, unten ein Band „Kunde“ (was bei ihm liegt, was er sieht).
//   · Fluss einer Phase: von oben nach unten mit festen Formen — Start (Kreis), Schritt, Nachricht, Entscheidung (Raute mit ja/nein), Erinnerung (auf dem
//     Nein-Pfad), Termin (große Beschriftung); zwei oder mehr Teilprozesse als Karten nebeneinander.
// Gerechnet wird NUR hier (rein, client-sicher, deterministisch) — die Komponenten (components/os/fulfillment/reise/{ReiseBild,Fluss}.tsx) zeichnen nur.
// Grundlage sind die vorhandenen Regeln — keine zweite Rechnung: Phasen und Zustand aus `fallReise`, Schritte aus `alleSchritte`, „hier“ aus
// `naechsterPunkt` (bzw. am Ende `abschlussSchritt`), Hänger mit DENSELBEN Regeln wie das Cockpit (`wasHaengt`: überfällig, wartet > 7 Tage).
// Was die Daten nicht hergeben, wird nicht erfunden: ohne Kundenbeteiligung keine Nein-Erinnerung, ohne Teilprozesse keine Verzweigung.

import type { BausteinArt, Fall, FallKnoten, Freigabepunkt, KnotenStatus, Zustaendig } from '../typen';
import { kinderVon, tageZwischen } from '../regeln';
import { alleSchritte, fallReise, naechsterPunkt, phaseGruppen, phasenVon, type NaechsterPunkt, type PhasenZustand, type Reise, type ReisePhase, type SchrittZeile } from './reise';
import { obSchluessel } from './onboarding';
import { abschlussSchritt, schrittVerweis, type NachsorgePunkt } from './ansichten';
import { abstimmungName, abstimmungsNummern, anzeigeTitel, titelOhneZusatz } from './darstellung';
import { phaseVon } from './phasen';
import { WARTET_ALT_TAGE, WARTET_ROT_TAGE } from './cockpit';

/** Die festen Formen (die Bedeutung hängt an der Form, die Farbe kommt dazu). */
export type FlussForm = 'schritt' | 'nachricht' | 'entscheidung' | 'erinnerung' | 'termin';
export const FORM_NAME: Record<FlussForm, string> = { schritt: 'Schritt', nachricht: 'Nachricht', entscheidung: 'Abstimmung', erinnerung: 'Erinnerung', termin: 'Termin' };
export type KaestchenZustand = 'erledigt' | 'hier' | 'offen' | 'entfaellt';
/** Die Stelle des Falls, die ein Kästchen meint — das Detail daneben zeigt dann die passende Karte. */
export type FallStelleId =
  | 'willkommen' | 'kickoff' | 'vereinbarung' | 'playbook' | 'stakeholder' | 'wertkonto' | 'entscheidungslog' | 'abstimmung'
  | 'quickwins' | 'befaehigung' | 'wirkung' | 'analyse' | 'abschliessen' | 'mandat' | 'nachsorge' | 'kreislauf';

export interface Kaestchen {
  /** Kennung des Fall-Knotens — `fg-<Freigabe>` für den Abstimmungspunkt am Ende einer Phase, `ff-…` für die Abschluss-Stellen am Ende des Falls. */
  id: string;
  titel: string;
  form: FlussForm;
  zustand: KaestchenZustand;
  /** Hängt (dieselben Regeln wie „Was hängt“ im Cockpit): rot = dringend, gelb = braucht einen Blick. */
  haengt?: 'rot' | 'gelb';
  /** Liegt beim Kunden (wartet auf ihn bzw. er macht es). */
  beimKunden?: boolean;
  stelle?: FallStelleId;
  /** Ein kurzer Satz darunter (Frist, „macht der Kunde“, „beim Kunden seit 9 Tagen“). */
  unter?: string;
  /** Ein echter Knoten des Falls (Status, Haken, Bausteine im Detail). */
  knoten?: true;
}

export interface ReiseAbstimmung { id: string; nr?: number; titel: string; wer: Zustaendig; gegeben: boolean; hier: boolean; faelligAm?: string; haengt?: 'rot' | 'gelb' }
export interface ReiseSpalte {
  id: string; nr: number; titel: string; zusatz?: string; zustand: PhasenZustand; erledigt: number; gesamt: number;
  haengt?: 'rot' | 'gelb';
  kaestchen: Kaestchen[];
  /** So viele Schritte stehen nicht als Kästchen da („+n“). */
  mehr: number;
  /** Der Abstimmungspunkt am Ende der Phase — die Raute rechts von der Spalte. */
  abstimmung?: ReiseAbstimmung;
  /** Band „Kunde“: wie viel gerade bei ihm liegt, und ob er diese Phase sieht (geteilt bzw. die laufende). */
  band: { beimKunden: number; sieht: boolean };
  /** Hier hängen die Analyse (Läufe, Dossier, Recht) bzw. der Abschluss (Wirkungsbericht, Nachsorge, Kreislauf). */
  analyse?: true; abschluss?: true;
}
export interface ReiseZeile { spalten: ReiseSpalte[]; hier: { phaseId: string; id: string } | null; fertig: boolean; fortschritt: number }

export interface ReiseBildEingabe {
  fall: Pick<Fall, 'knoten' | 'freigaben' | 'status' | 'wirkung'> & Partial<Pick<Fall, 'befaehigung'>>;
  freigaben: readonly Pick<Freigabepunkt, 'id' | 'titel' | 'wer'>[];
  heute: string;
  /** Baustein-Kennung → Art (Mail, Ritual, Freigabe …) — ohne Angabe ist jedes Kästchen ein Schritt. */
  bausteinArt?: (id: string) => BausteinArt | string | undefined;
  /** Willkommensmail überfällig (Onboarding-Uhr) — derselbe Hänger wie im Cockpit. */
  willkommenUeberfaellig?: boolean;
  /** Mandatsende und Nachsorge-Plan — für den Abschluss am Ende. */
  nachsorge?: { ende: string | null; plan: readonly NachsorgePunkt[] };
}

/** So viele Kästchen zeigt eine Phase in der Reise (Rest „+n“). */
export const KAESTCHEN_MAX = 4;
const FERTIG: ReadonlySet<KnotenStatus> = new Set(['erledigt', 'entfaellt']);
const kurz = (t: string) => `${t.slice(8, 10)}.${t.slice(5, 7)}.`;
type Haenger = 'rot' | 'gelb' | null;

// ── Hänger: dieselben Regeln wie das Cockpit (`wasHaengt`, lib/fulfillment/prozesse/cockpit.ts) ──────────────────────────────────────────

/**
 * Hängt dieser Knoten? Überfällig (Frist vor heute, nicht erledigt) — ein offener Abstimmungspunkt rot, sonst gelb (die Willkommensmail zählt über ihre
 * eigene Uhr); wartet beim Kunden länger als `WARTET_ALT_TAGE` — ab `WARTET_ROT_TAGE` rot. Das Schlimmere gewinnt. Wächter: tests/fulfillment-miro.test.ts.
 */
export function knotenHaengt(k: Pick<FallKnoten, 'id' | 'status' | 'faelligAm' | 'freigabe' | 'seit'>, f: Pick<Fall, 'freigaben'>, heute: string): Haenger {
  if (FERTIG.has(k.status)) return null;
  let h: Haenger = null;
  if (k.faelligAm && k.faelligAm < heute) {
    if (k.freigabe && !f.freigaben[k.freigabe]) h = 'rot';
    else if (!k.id.startsWith('fk-ob-willkommen')) h = 'gelb';
  }
  if (k.status === 'wartet_kunde') {
    const t = tageZwischen(k.seit, heute) ?? 0;
    if (t > WARTET_ALT_TAGE) h = t >= WARTET_ROT_TAGE || h === 'rot' ? 'rot' : 'gelb';
  }
  return h;
}
const schlimmer = (a: Haenger | undefined, b: Haenger | undefined): Haenger => (a === 'rot' || b === 'rot' ? 'rot' : a ?? b ?? null);

// ── Form und Stelle eines Schritts ───────────────────────────────────────────────────────────────────────────────────────────────────

/** Die Form eines Schritts aus seinen Daten: Abstimmungspunkt → Raute, Willkommensmail/Mail-Baustein → Nachricht, Kick-off/Ritual → Termin. */
export function knotenForm(k: Pick<FallKnoten, 'id' | 'titel' | 'freigabe' | 'bausteinId'>, bausteine: readonly Pick<FallKnoten, 'bausteinId'>[], art?: ReiseBildEingabe['bausteinArt']): FlussForm {
  if (k.freigabe) return 'entscheidung';
  const ob = obSchluessel(k.id);
  if (ob === 'willkommen') return 'nachricht';
  if (ob === 'kickoff') return 'termin';
  const arten = [k.bausteinId, ...bausteine.map(b => b.bausteinId)].filter((x): x is string => !!x).map(id => art?.(id)).filter((x): x is string => !!x);
  if (arten.includes('freigabe')) return 'entscheidung';
  if (arten.includes('ritual')) return 'termin';
  if (arten.length && arten.every(a => a === 'mail')) return 'nachricht';
  if (schrittVerweis(k) === 'wirkung') return 'nachricht';
  return 'schritt';
}

/** Welche Stelle des Falls ein Schritt meint (Onboarding-Schritt, Quick Wins, Diagnose/Dossier, Befähigung, Wirkungsbericht) — sonst keine. */
export function knotenStelle(k: Pick<FallKnoten, 'id' | 'titel' | 'freigabe'>): FallStelleId | undefined {
  const ob = obSchluessel(k.id);
  if (ob) return ob === 'f0' ? 'abstimmung' : ob;
  if (k.freigabe) return 'abstimmung';
  const v = schrittVerweis(k);
  if (v === 'diagnose' || v === 'dossier') return 'analyse';
  return v ?? undefined;
}

// ── Wo die Analyse und der Abschluss hängen ──────────────────────────────────────────────────────────────────────────────────────────

const unter = (fall: Pick<Fall, 'knoten'>, phaseId: string): FallKnoten[] => {
  const raus: FallKnoten[] = [];
  const geh = (id: string) => { for (const k of kinderVon(id, fall.knoten)) { raus.push(k); geh(k.id); } };
  geh(phaseId);
  return raus;
};

/**
 * Die Phase, an der die Analyse hängt (Läufe A0–A13, Dossier, Recht): die Phase „Analyse“, sonst „Diagnose“ (kanonische Wörter, lib/fulfillment/prozesse/
 * phasen.ts), sonst die Phase mit dem Schritt „Dossier“/„Diagnosebericht“, sonst die erste Phase. Ohne Phasen null.
 */
export function analysePhaseId(fall: Pick<Fall, 'knoten'>): string | null {
  const phasen = phasenVon(fall);
  if (!phasen.length) return null;
  const nachWort = (id: 'analyse' | 'diagnose') => phasen.find(p => { const x = phaseVon(p.titel); return x?.id === id && !x.dach; });
  const mitSchritt = phasen.find(p => unter(fall, p.id).some(k => { const v = schrittVerweis(k); return v === 'dossier' || v === 'diagnose'; }));
  return (nachWort('analyse') ?? nachWort('diagnose') ?? mitSchritt ?? phasen[0]).id;
}
/** Die Phase, an der der Abschluss hängt (Wirkungsbericht, Fall abschließen, Nachsorge, zurück in den Kreislauf): die letzte echte Phase. */
export function abschlussPhaseId(fall: Pick<Fall, 'knoten'>): string | null {
  const phasen = phasenVon(fall);
  const echt = phasen.filter(p => titelOhneZusatz(p.titel).toLowerCase() !== 'weitere bausteine');
  return (echt.at(-1) ?? phasen.at(-1))?.id ?? null;
}

// ── Kästchen ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

function kaestchenAus(z: SchrittZeile, e: ReiseBildEingabe, hierId: string | null, nummern: ReadonlyMap<string, number>): Kaestchen {
  const k = z.knoten;
  const alle = [k, ...z.bausteine];
  const fertig = z.zustand === 'erledigt';
  const haengt = schlimmer(alle.reduce<Haenger>((a, x) => schlimmer(a, knotenHaengt(x, e.fall, e.heute)), null),
    obSchluessel(k.id) === 'willkommen' && !fertig && e.willkommenUeberfaellig ? 'rot' : null);
  const w = alle.find(x => x.status === 'wartet_kunde');
  const tage = w ? tageZwischen(w.seit, e.heute) : undefined;
  const kunde = !z.fertig && k.zustaendig === 'kunde';
  const frist = alle.filter(x => !FERTIG.has(x.status) && x.faelligAm).map(x => x.faelligAm!).sort()[0];
  const unterText = z.zustand === 'entfaellt' ? 'entfällt'
    : w && !z.fertig ? (tage !== undefined ? `beim Kunden ${tage <= 0 ? 'seit heute' : `seit ${tage} Tag${tage === 1 ? '' : 'en'}`}` : 'beim Kunden')
      : !z.fertig && frist ? `${frist < e.heute ? 'überfällig seit' : 'bis'} ${kurz(frist)}`
        : kunde ? 'macht der Kunde' : undefined;
  const stelle = knotenStelle(k);
  return {
    id: k.id, titel: anzeigeTitel(k.titel, nummern), form: knotenForm(k, z.bausteine, e.bausteinArt),
    zustand: z.zustand === 'entfaellt' ? 'entfaellt' : k.id === hierId ? 'hier' : fertig ? 'erledigt' : 'offen',
    ...(haengt ? { haengt } : {}), ...((w && !z.fertig) || kunde ? { beimKunden: true } : {}), ...(stelle ? { stelle } : {}), ...(unterText ? { unter: unterText } : {}), knoten: true,
  };
}

/**
 * Die Abschluss-Stellen am Ende des Falls (nur, was der Fall führt): Befähigung und Wirkungsbericht (nur, wenn die Vorlage keinen eigenen Schritt dafür hat),
 * Fall abschließen, Mandat beenden, Nachsorge. `hier` = die Stelle des Handgriffs am Ende (`abschlussSchritt`) — `wirkungId` ist der eigene Schritt der Vorlage.
 */
export function abschlussKaestchen(e: ReiseBildEingabe, reise: Pick<Reise, 'fertig'>, wirkungId: string | null, befaehigungId: string | null = null): { kaestchen: Kaestchen[]; hier: string | null } {
  const f = e.fall;
  const plan = e.nachsorge?.plan ?? [];
  const ende = e.nachsorge?.ende ?? null;
  const a = abschlussSchritt({ fall: f, allePhasenFertig: reise.fertig, mandatEnde: ende, nachsorge: plan });
  const hier = !a ? null
    : a.art === 'abschliessen' ? (!f.wirkung && !wirkungId ? 'ff-wirkung' : 'ff-abschliessen')
      : a.art === 'wirkung' ? (wirkungId ?? 'ff-wirkung') : a.art === 'mandat-beenden' ? 'ff-mandat' : 'ff-nachsorge';
  const z = (id: string, erledigt: boolean): KaestchenZustand => (id === hier ? 'hier' : erledigt ? 'erledigt' : 'offen');
  const vorgeschlagen = plan.filter(p => p.zustand === 'vorgeschlagen').length;
  const faellig = plan.some(p => p.zustand === 'faellig');
  const bef = f.befaehigung ?? [];
  const kaestchen: Kaestchen[] = [
    ...(!befaehigungId ? [{ id: 'ff-befaehigung', titel: 'Befähigung', form: 'schritt' as const, zustand: z('ff-befaehigung', bef.length > 0 && bef.every(b => b.erfuellt)), stelle: 'befaehigung' as const, unter: bef.length ? `${bef.filter(b => b.erfuellt).length} von ${bef.length} erfüllt` : 'läuft es ohne uns?' }] : []),
    ...(!wirkungId ? [{ id: 'ff-wirkung', titel: 'Wirkungsbericht', form: 'nachricht' as const, zustand: z('ff-wirkung', !!f.wirkung), stelle: 'wirkung' as const, unter: f.wirkung ? `erstellt ${kurz(f.wirkung.erstelltAm)}` : 'vorher → jetzt' }] : []),
    { id: 'ff-abschliessen', titel: 'Fall abschließen', form: 'schritt', zustand: z('ff-abschliessen', f.status === 'abgeschlossen'), stelle: 'abschliessen' },
    { id: 'ff-mandat', titel: 'Mandat beenden', form: 'schritt', zustand: z('ff-mandat', !!ende), stelle: 'mandat', ...(ende ? { unter: `beendet ${kurz(ende)}` } : {}) },
    {
      id: 'ff-nachsorge', titel: 'Nachsorge', form: 'erinnerung', zustand: z('ff-nachsorge', plan.length > 0 && vorgeschlagen === plan.length), stelle: 'nachsorge',
      ...(faellig ? { haengt: 'gelb' as const } : {}),
      unter: plan.length ? `Tag ${plan.map(p => p.tag).join(' · ')}${ende ? '' : ' nach Mandatsende'}` : 'nach Mandatsende',
    },
  ];
  return { kaestchen, hier };
}

/**
 * Die Kästchen einer Phase für die Reise: höchstens `KAESTCHEN_MAX`, als zusammenhängendes Stück des Flusses — mit „hier“ (ein erledigter davor als
 * Anschluss), in der laufenden Phase ab dem ersten offenen, sonst die ersten. Der Rest steht als „+n“.
 */
export function sichtbareKaestchen(alle: readonly Kaestchen[], zustand: PhasenZustand): Kaestchen[] {
  if (alle.length <= KAESTCHEN_MAX) return [...alle];
  const hier = alle.findIndex(k => k.zustand === 'hier');
  const offen = alle.findIndex(k => k.zustand === 'offen');
  const anker = hier >= 0 ? hier : zustand === 'jetzt' && offen >= 0 ? offen : 0;
  const start = Math.max(0, Math.min(anker - 1, alle.length - KAESTCHEN_MAX));
  return alle.slice(start, start + KAESTCHEN_MAX);
}

const istPhasenAbstimmung = (hp: NaechsterPunkt | null): boolean => !!hp && hp.art === 'freigabe' && hp.id === hp.phaseId;

/** Alle Kästchen einer Phase in der Reihenfolge des Flusses (Schritte, an der letzten Phase der Abschluss) — „hier“ an höchstens einer Stelle. */
function phasenKaestchen(e: ReiseBildEingabe, reise: Reise, p: ReisePhase, hp: NaechsterPunkt | null, abschlussId: string | null, nummern: ReadonlyMap<string, number>): { zeilen: SchrittZeile[]; kaestchen: Kaestchen[]; hier: string | null; abHier: boolean } {
  // Ein Schritt, der den Abstimmungspunkt der Phase selbst trägt (z. B. „Abstimmungspunkt 1 bestätigt“ im Onboarding), IST die Raute am Ende der Phase —
  // er steht nicht noch einmal als Kästchen bzw. Knoten da (nichts doppelt).
  const zeilen = alleSchritte(e.fall, p.id, e.heute).filter(z => z.knoten.id !== p.id && !(p.freigabe && z.knoten.freigabe === p.freigabe.id));
  const abHier = !!hp && hp.phaseId === p.id && !!p.freigabe && (istPhasenAbstimmung(hp) || (hp.art === 'freigabe' && hp.freigabe === p.freigabe.id));
  const hierSchritt = hp && !abHier && hp.phaseId === p.id && zeilen.some(z => z.knoten.id === hp.id) ? hp.id : null;
  let kaestchen = zeilen.map(z => kaestchenAus(z, e, hierSchritt, nummern));
  let hier = hierSchritt;
  if (p.id === abschlussId) {
    const wirkungId = zeilen.find(z => schrittVerweis(z.knoten) === 'wirkung')?.knoten.id ?? null;
    const befaehigungId = zeilen.find(z => schrittVerweis(z.knoten) === 'befaehigung')?.knoten.id ?? null;
    const ab = abschlussKaestchen(e, reise, wirkungId, befaehigungId);
    kaestchen = [...kaestchen, ...ab.kaestchen];
    // Am Ende (kein nächster Punkt mehr): der Handgriff des Abschlusses ist „hier“ — auch am eigenen Schritt „Wirkungsbericht“ der Vorlage.
    if (!hp && ab.hier) { hier = ab.hier; kaestchen = kaestchen.map(k => (k.id === ab.hier ? { ...k, zustand: 'hier' as const } : k)); }
  }
  return { zeilen, kaestchen, hier, abHier };
}

/**
 * Die Reise eines Falls als Kundenjourney-Zeile: je Phase Zustand, Zähler, höchstens vier Kästchen (Rest „+n“), Abstimmungspunkt als Raute, Band „Kunde“.
 * Die letzte Phase trägt den Abschluss (Wirkungsbericht, Fall abschließen, Mandat beenden, Nachsorge), die Analyse-Phase die Analyse.
 */
export function reiseZeile(e: ReiseBildEingabe): ReiseZeile {
  const reise = fallReise(e.fall, e.freigaben, e.heute);
  const nummern = abstimmungsNummern(e.fall.knoten);
  const hp = naechsterPunkt(e.fall, e.freigaben, e.heute);
  const analyse = analysePhaseId(e.fall);
  const abschluss = abschlussPhaseId(e.fall);
  const phasenKnoten = new Map(phasenVon(e.fall).map(p => [p.id, p]));
  let hier: ReiseZeile['hier'] = null;
  const spalten = reise.phasen.map((p): ReiseSpalte => {
    const pk = phasenKaestchen(e, reise, p, hp, abschluss, nummern);
    if (pk.hier) hier = { phaseId: p.id, id: pk.hier };
    const fg = p.freigabe;
    const phk = phasenKnoten.get(p.id);
    const abHier = pk.abHier;
    if (abHier) hier = { phaseId: p.id, id: `fg-${fg!.id}` };
    const abHaengt = fg && phk ? knotenHaengt(phk, e.fall, e.heute) : null;
    const eigen = phk && !fg ? knotenHaengt(phk, e.fall, e.heute) : null;
    const haengt = pk.kaestchen.reduce<Haenger>((a, k) => schlimmer(a, k.haengt), schlimmer(eigen, abHaengt));
    const zeigen = sichtbareKaestchen(pk.kaestchen, p.zustand);
    return {
      id: p.id, nr: p.nr, titel: p.titel, ...(p.zusatz ? { zusatz: p.zusatz } : {}), zustand: p.zustand, erledigt: p.erledigt, gesamt: p.gesamt,
      ...(haengt ? { haengt } : {}),
      kaestchen: zeigen, mehr: pk.kaestchen.length - zeigen.length,
      ...(fg ? { abstimmung: { id: fg.id, ...(fg.nr ? { nr: fg.nr } : {}), titel: fg.titel, wer: fg.wer, gegeben: fg.gegeben, hier: abHier, ...(phk?.faelligAm ? { faelligAm: phk.faelligAm } : {}), ...(abHaengt ? { haengt: abHaengt } : {}) } } : {}),
      band: { beimKunden: pk.kaestchen.filter(k => k.beimKunden && k.zustand !== 'erledigt' && k.zustand !== 'entfaellt').length, sieht: phk?.kundeSichtbar === true || p.zustand === 'jetzt' },
      ...(p.id === analyse ? { analyse: true as const } : {}), ...(p.id === abschluss ? { abschluss: true as const } : {}),
    };
  });
  return { spalten, hier, fertig: reise.fertig, fortschritt: reise.fortschritt };
}

// ── Fluss einer Phase ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Ein Knoten im Fluss: ein Kästchen, bei einer Raute mit ja/nein, bei einem wartenden Schritt mit der Erinnerung daneben. */
export interface FlussKnoten extends Kaestchen {
  /** Raute: wohin „ja“ führt (Klartext). */
  ja?: string;
  /** Raute: der Nein-Pfad — eine Erinnerung (nur, wenn der Kunde beteiligt ist; mit Frist, wenn es eine gibt). */
  nein?: { titel: string; unter?: string };
  /** Wartender Schritt beim Kunden: die Erinnerung der Regel „wartet länger als 7 Tage = hängt“. */
  erinnerung?: { titel: string; unter?: string };
  /** Abstimmungspunkt (Freigabe-Kennung) — „vermerken“ im Detail. */
  freigabe?: string;
}
export type FlussTeil =
  | { art: 'linie'; titel?: string; knoten: FlussKnoten[] }
  | { art: 'gruppen'; gruppen: { id: string; titel: string; erledigt: number; gesamt: number; knoten: FlussKnoten[] }[] };
export interface PhasenFluss {
  phaseId: string; nr: number; titel: string; zustand: PhasenZustand;
  /** Der Startpunkt (Kreis): womit die Phase beginnt. */
  start: { titel: string; unter?: string };
  teile: FlussTeil[];
  /** Der Abstimmungspunkt am Ende der Phase (Raute mit ja/nein). */
  abstimmung?: FlussKnoten;
  /** Abschluss-Stellen (nur an der letzten Phase). */
  abschluss: FlussKnoten[];
  /** Wohin der Fluss danach geht: die nächste Phase — bzw. am Ende zurück in den Kreislauf. */
  ende: { titel: string; phaseId?: string; stelle?: 'kreislauf' };
  analyse?: true;
}

const erinnerungFuer = (k: Kaestchen, z: SchrittZeile, heute: string): FlussKnoten['erinnerung'] | undefined => {
  if (k.zustand === 'erledigt' || k.zustand === 'entfaellt') return undefined;
  // Nur, was WIRKLICH beim Kunden wartet (Status „wartet auf Kunde“) — erst dann läuft die Uhr der Regel „> 7 Tage = hängt“.
  const w = [z.knoten, ...z.bausteine].find(x => x.status === 'wartet_kunde');
  if (!w) return undefined;
  const tage = tageZwischen(w.seit, heute);
  return tage !== undefined && tage > WARTET_ALT_TAGE
    ? { titel: 'Beim Kunden nachfassen', unter: `seit ${tage} Tagen — hängt` }
    : { titel: 'Beim Kunden nachfassen', unter: `nach ${WARTET_ALT_TAGE} Tagen` };
};

/** Die Raute eines Abstimmungspunkts: ja → weiter; nein → Erinnerung beim Kunden (nur mit Kundenbeteiligung, mit Frist, wenn es eine gibt). */
function rauteAus(basis: Kaestchen, fg: { id: string; titel: string; wer: Zustaendig }, nummern: ReadonlyMap<string, number>, ja: string, frist?: string): FlussKnoten {
  return {
    ...basis, form: 'entscheidung', titel: abstimmungName(fg.id, nummern, fg.titel), freigabe: fg.id, stelle: 'abstimmung', ja,
    ...(fg.wer !== 'intern' ? { nein: { titel: 'Beim Kunden nachfassen', ...(frist ? { unter: `Frist ${kurz(frist)}` } : {}) } } : {}),
  };
}

/** Der Fluss EINER Phase (oben → unten): Start, Schritte (Teilprozesse nebeneinander), Abstimmungspunkt, an der letzten Phase der Abschluss, Ende. */
export function phasenFluss(e: ReiseBildEingabe, phaseId: string, unterschrift?: string | null): PhasenFluss | null {
  const reise = fallReise(e.fall, e.freigaben, e.heute);
  const i = reise.phasen.findIndex(x => x.id === phaseId);
  if (i < 0) return null;
  const zeile = reiseZeile(e);
  const sp = zeile.spalten[i];
  const p = reise.phasen[i];
  const nummern = abstimmungsNummern(e.fall.knoten);
  const hp = naechsterPunkt(e.fall, e.freigaben, e.heute);
  const pk = phasenKaestchen(e, reise, p, hp, abschlussPhaseId(e.fall), nummern);
  const kaestchen = new Map(pk.kaestchen.map(k => [k.id, k]));
  const zeilen = new Map(pk.zeilen.map(z => [z.knoten.id, z]));
  const naechste = zeile.spalten[i + 1];
  const vorher = zeile.spalten[i - 1];
  const zuKnoten = (id: string): FlussKnoten | null => {
    const k = kaestchen.get(id), z = zeilen.get(id);
    if (!k || !z) return null;
    if (z.knoten.freigabe) {
      const fg = e.freigaben.find(x => x.id === z.knoten.freigabe) ?? { id: z.knoten.freigabe, titel: '', wer: 'beide' as const };
      return rauteAus(k, fg, nummern, 'weiter', z.knoten.faelligAm);
    }
    const er = erinnerungFuer(k, z, e.heute);
    return { ...k, ...(er ? { erinnerung: er } : {}) };
  };
  // Dieselben Schritte wie die Reise (`alleSchritte`, Sammel-Schritte aufgelöst), gruppiert nach Teilprozess (`phaseGruppen`): zwei oder mehr
  // Teilprozesse stehen als Karten nebeneinander (Verzweigung in Gruppen), sonst ein Strang.
  const gruppen = phaseGruppen(e.fall, phaseId, e.heute);
  const benannt = gruppen.filter(g => g.teil).length;
  const ids = (g: (typeof gruppen)[number]) => g.zeilen.flatMap(z => (zeilen.has(z.knoten.id) ? [z.knoten.id] : z.bausteine.map(b => b.id).filter(b => zeilen.has(b))));
  const teile: FlussTeil[] = [];
  for (const g of gruppen) {
    const knoten = ids(g).map(zuKnoten).filter((x): x is FlussKnoten => !!x);
    if (!knoten.length) continue;
    if (g.teil && benannt >= 2) {
      const gr = { id: g.teil.id, titel: titelOhneZusatz(g.teil.titel), erledigt: g.erledigt, gesamt: g.gesamt, knoten };
      const letzte = teile.at(-1);
      if (letzte?.art === 'gruppen') letzte.gruppen.push(gr); else teile.push({ art: 'gruppen', gruppen: [gr] });
    } else teile.push({ art: 'linie', ...(g.teil ? { titel: titelOhneZusatz(g.teil.titel) } : {}), knoten });
  }
  const a = sp.abstimmung;
  const abstimmung = a
    ? rauteAus({ id: `fg-${a.id}`, titel: '', form: 'entscheidung', zustand: a.hier ? 'hier' : a.gegeben ? 'erledigt' : 'offen', ...(a.haengt ? { haengt: a.haengt } : {}) },
      { id: a.id, titel: a.titel, wer: a.wer }, nummern, naechste ? `weiter zu Phase ${naechste.nr} · ${naechste.titel}` : 'weiter zum Abschluss', a.faelligAm)
    : undefined;
  const abschluss: FlussKnoten[] = sp.abschluss ? pk.kaestchen.filter(k => k.id.startsWith('ff-')) : [];
  const start = i === 0
    ? { titel: unterschrift ? 'Mandat unterschrieben' : 'Fall gestartet', ...(unterschrift ? { unter: kurz(unterschrift.slice(0, 10)) } : {}) }
    : { titel: vorher?.abstimmung ? `Nach ${abstimmungName(vorher.abstimmung.id, nummern, vorher.abstimmung.titel)}` : `Nach Phase ${vorher!.nr} · ${vorher!.titel}` };
  return {
    phaseId, nr: p.nr, titel: p.titel, zustand: p.zustand, start, teile, ...(abstimmung ? { abstimmung } : {}), abschluss,
    ende: sp.abschluss ? { titel: 'Zurück in den Kreislauf', stelle: 'kreislauf' } : naechste ? { titel: `Phase ${naechste.nr} · ${naechste.titel}`, phaseId: naechste.id } : { titel: 'Ende der Reise' },
    ...(sp.analyse ? { analyse: true as const } : {}),
  };
}

/** Alle Knoten eines Flusses der Reihe nach (für Auswahl und Sprünge). */
export function flussKnoten(f: PhasenFluss): FlussKnoten[] {
  return [
    ...f.teile.flatMap(t => (t.art === 'linie' ? t.knoten : t.gruppen.flatMap(g => g.knoten))),
    ...(f.abstimmung ? [f.abstimmung] : []),
    ...f.abschluss,
  ];
}
