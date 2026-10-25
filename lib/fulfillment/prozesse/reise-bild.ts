// ─── Fulfillment · Fall als Bild — Kundenjourney-Zeile und Fluss einer Phase (17.10., Miro-Standard) ─────────────────────────────────
// Rückmeldung 17.10.: „So möchte ich das beim Fulfillment auch haben. Es soll nicht überladen sein, sondern sehr klar. Lieber wenig und klar … es dupliziert
// sich.“ Vorbild ist der STIL der Miro-Prozesse (nie deren Inhalte):
//   · Reise (Kundenjourney): die Phasen als EINE Zeile nebeneinander, darunter je Phase höchstens vier kurze Kästchen (Rest „+n“), zwischen den Phasen
//     der Abstimmungspunkt als Raute, unten ein Band „Kunde“ (was bei ihm liegt, was er sieht).
//   · Fluss einer Phase: von oben nach unten mit festen Formen — Start (Kreis), Schritt, Nachricht, Entscheidung (Raute mit ja/nein), Erinnerung (auf dem
//     Nein-Pfad), Termin (große Beschriftung); zwei oder mehr Teilprozesse als Karten nebeneinander.
// Gerechnet wird NUR hier (rein, client-sicher, deterministisch) — die Komponenten (components/os/ui/reise/{ReiseBild,Fluss}.tsx — seit 17.10. gemeinsam für alle Bereiche) zeichnen nur.
// Grundlage sind die vorhandenen Regeln — keine zweite Rechnung: Phasen und Zustand aus `fallReise`, Schritte aus `alleSchritte`, „hier“ aus
// `naechsterPunkt` (bzw. am Ende `abschlussSchritt`), Hänger mit DENSELBEN Regeln wie das Cockpit (`wasHaengt`: überfällig, wartet > 7 Tage).
// Was die Daten nicht hergeben, wird nicht erfunden: ohne Kundenbeteiligung keine Nein-Erinnerung, ohne Teilprozesse keine Verzweigung.

import type { BausteinArt, Fall, FallKnoten, Freigabepunkt, KnotenForm, KnotenStatus, Zustaendig } from '../typen';
import { kinderVon, tageZwischen } from '../regeln';
import { alleSchritte, fallReise, naechsterPunkt, phaseGruppen, phasenVon, type NaechsterPunkt, type PhasenZustand, type Reise, type ReisePhase, type SchrittZeile } from './reise';
import { obSchluessel } from './onboarding';
import { abschlussSchritt, schrittVerweis, type NachsorgePunkt } from './ansichten';
import { abstimmungName, abstimmungsNummern, anzeigeTitel, titelOhneZusatz, BESTAETIGUNG } from './darstellung';
import { phaseVon } from './phasen';
import { WARTET_ALT_TAGE, WARTET_ROT_TAGE } from './cockpit';

// Die festen Formen, die Zustände, `KAESTCHEN_MAX` und die Fenster-Regel `sichtbareKaestchen` sind seit 17.10. gemeinsam für alle Bereiche (lib/reise/bild.ts —
// Kreislauf, Einrichtung, Planung zeichnen dieselbe Reise); hier nur weitergereicht, damit jede bisherige Stelle unverändert bleibt.
import { FORM_NAME, KAESTCHEN_MAX, sichtbareKaestchen, type FlussForm, type KaestchenZustand } from '@/lib/reise/bild';
export { FORM_NAME, KAESTCHEN_MAX, sichtbareKaestchen, type FlussForm, type KaestchenZustand };
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
  /** Eine Entscheidung aus dem Prozess-Editor (Raute mit ja/nein) — kein Abstimmungspunkt mit dem Kunden. */
  entscheid?: true;
  /** Wartet gerade auf den Kunden (Status „wartet auf Kunde“). */
  wartetKunde?: true;
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
  /**
   * Band „Kunde“: wie viel gerade bei ihm liegt, und ob er diese Phase sieht (geteilt bzw. die laufende). `wartet` = Titel der Schritte, die auf ihn warten,
   * `macht` = offene Schritte, die er macht (17.10. Feinschliff — der Satz im Band, `bandTexte`).
   */
  band: { beimKunden: number; sieht: boolean; wartet?: string[]; macht?: string[] };
  /** Hier hängen die Analyse (Läufe, Dossier, Recht) bzw. der Abschluss (Wirkungsbericht, Nachsorge, Kreislauf). */
  analyse?: true; abschluss?: true;
  /** Phase eines angehängten Zusatzmoduls (17.10. spät, `ReisePhase.modul`) — die Darstellung markiert den Abschnitt (offen: wie, Flow-Ansicht). */
  modul?: { id: string; titel: string };
}
export interface ReiseZeile { spalten: ReiseSpalte[]; hier: { phaseId: string; id: string } | null; fertig: boolean; fortschritt: number }

export interface ReiseBildEingabe {
  fall: Pick<Fall, 'knoten' | 'freigaben' | 'status' | 'wirkung'> & Partial<Pick<Fall, 'befaehigung' | 'zusaetze'>>;
  freigaben: readonly Pick<Freigabepunkt, 'id' | 'titel' | 'wer'>[];
  heute: string;
  /** Baustein-Kennung → Art (Mail, Ritual, Freigabe …) — ohne Angabe ist jedes Kästchen ein Schritt. */
  bausteinArt?: (id: string) => BausteinArt | string | undefined;
  /** Willkommensmail überfällig (Onboarding-Uhr) — derselbe Hänger wie im Cockpit. */
  willkommenUeberfaellig?: boolean;
  /** Mandatsende und Nachsorge-Plan — für den Abschluss am Ende. */
  nachsorge?: { ende: string | null; plan: readonly NachsorgePunkt[] };
}

const FERTIG: ReadonlySet<KnotenStatus> = new Set(['erledigt', 'entfaellt']);
const kurz = (t: string) => `${t.slice(8, 10)}.${t.slice(5, 7)}.`;
type Haenger = 'rot' | 'gelb' | null;

// ── Hänger: dieselben Regeln wie das Cockpit (`wasHaengt`, lib/fulfillment/prozesse/cockpit.ts) ──────────────────────────────────────────

/**
 * Hängt dieser Knoten? Überfällig (Frist vor heute, nicht erledigt) — ein offener Abstimmungspunkt rot, sonst gelb (die Willkommensmail zählt über ihre
 * eigene Uhr); wartet beim Kunden länger als `WARTET_ALT_TAGE` — ab `WARTET_ROT_TAGE` rot. Das Schlimmere gewinnt. Wächter: tests/fulfillment-miro.test.ts.
 */
export function knotenHaengt(k: Pick<FallKnoten, 'id' | 'status' | 'faelligAm' | 'freigabe' | 'seit' | 'eskaliertAm'>, f: Pick<Fall, 'freigaben'>, heute: string): Haenger {
  if (FERTIG.has(k.status)) return null;
  // Ausführung (17.10. abends): ausgeschöpfte Runden an einer Entscheidung — rot, wie im Cockpit.
  if (k.eskaliertAm) return 'rot';
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

/** Die Zeichenform einer gespeicherten Form (Prozess-Editor): Abstimmung und Entscheidung sind beide eine Raute. */
export const flussFormVon = (f: KnotenForm): FlussForm => (f === 'abstimmung' ? 'entscheidung' : f);

/**
 * Die Form eines Schritts: die im Editor gesetzte (`form`, 17.10.) — sonst aus seinen Daten: Abstimmungspunkt → Raute, Willkommensmail/Mail-Baustein →
 * Nachricht, Kick-off/Ritual → Termin.
 */
export function knotenForm(k: Pick<FallKnoten, 'id' | 'titel' | 'freigabe' | 'bausteinId'> & { form?: KnotenForm }, bausteine: readonly Pick<FallKnoten, 'bausteinId'>[], art?: ReiseBildEingabe['bausteinArt']): FlussForm {
  if (k.form) return flussFormVon(k.form);
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
  // Nur Phasen des Pakets — ein angehängtes Zusatzmodul (17.10. spät) trägt nie die Analyse.
  const phasen = phasenVon(fall).filter(p => !p.zusatz);
  if (!phasen.length) return null;
  const nachWort = (id: 'analyse' | 'diagnose') => phasen.find(p => { const x = phaseVon(p.titel); return x?.id === id && !x.dach; });
  const mitSchritt = phasen.find(p => unter(fall, p.id).some(k => { const v = schrittVerweis(k); return v === 'dossier' || v === 'diagnose'; }));
  return (nachWort('analyse') ?? nachWort('diagnose') ?? mitSchritt ?? phasen[0]).id;
}
/** Die Phase, an der der Abschluss hängt (Wirkungsbericht, Fall abschließen, Nachsorge, zurück in den Kreislauf): die letzte echte Phase. */
export function abschlussPhaseId(fall: Pick<Fall, 'knoten'>): string | null {
  // Nur Phasen des Pakets — der Abschluss des Mandats hängt nie an einem angehängten Zusatzmodul (17.10. spät).
  const phasen = phasenVon(fall).filter(p => !p.zusatz);
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
  // Ausführung (17.10. abends): an einer Entscheidung, was gerade läuft („nein · Erinnerung läuft“, „eskaliert“); ein wartender Nein-Zweig „nur bei nein“.
  const zweigLaeuft = k.form === 'entscheidung' && !z.fertig && k.antwort === 'nein' && !!k.zweige?.nein && e.fall.knoten.some(x => x.id === k.zweige!.nein && !FERTIG.has(x.status) && (x.runden ?? 0) < (k.runden ?? 0));
  const unterText = z.zustand === 'entfaellt' ? 'entfällt'
    : k.eskaliertAm && !z.fertig ? 'eskaliert — bitte entscheiden'
    : zweigLaeuft ? `nein · Erinnerung läuft${k.runden ? ` (Runde ${k.runden})` : ''}`
    : w && !z.fertig ? (tage !== undefined ? `beim Kunden ${tage <= 0 ? 'seit heute' : `seit ${tage} Tag${tage === 1 ? '' : 'en'}`}` : 'beim Kunden')
      : !z.fertig && frist ? `${frist < e.heute ? 'überfällig seit' : 'bis'} ${kurz(frist)}`
        : kunde ? 'macht der Kunde' : undefined;
  const stelle = knotenStelle(k);
  return {
    id: k.id, titel: anzeigeTitel(k.titel, nummern), form: knotenForm(k, z.bausteine, e.bausteinArt), ...(k.form === 'entscheidung' && !k.freigabe ? { entscheid: true as const } : {}),
    zustand: z.zustand === 'entfaellt' ? 'entfaellt' : k.id === hierId ? 'hier' : fertig ? 'erledigt' : 'offen',
    ...(haengt ? { haengt } : {}), ...((w && !z.fertig) || kunde ? { beimKunden: true } : {}), ...(w && !z.fertig ? { wartetKunde: true as const } : {}), ...(stelle ? { stelle } : {}), ...(unterText ? { unter: unterText } : {}), knoten: true,
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
 * „+n“ unter einer Phase der Reise (25.10., Kern-Bau-Test 2 — vorher „0 von 8“ mit vier Kästchen und „+9“, weil die Abschluss-Stellen mitzählten): die SCHRITTE der
 * Phase, die die Kästchen nicht zeigen — dieselbe Menge wie der Zähler „x von n“ und wie der Fluss („+n weitere Schritte“): gezeigte Schritte + n = alle Schritte.
 * Die Abschluss-Stellen (Befähigung, Fall abschließen …) sind keine Schritte; sie stehen im Fluss der Phase unter „Abschluss“.
 */
export function verborgeneSchritte(schritte: readonly Pick<SchrittZeile, 'knoten'>[], gezeigt: readonly { id: string }[]): number {
  const ids = new Set(gezeigt.map(k => k.id));
  return schritte.filter(z => !ids.has(z.knoten.id)).length;
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
      kaestchen: zeigen, mehr: verborgeneSchritte(pk.zeilen, zeigen),
      ...(fg ? { abstimmung: { id: fg.id, ...(fg.nr ? { nr: fg.nr } : {}), titel: fg.titel, wer: fg.wer, gegeben: fg.gegeben, hier: abHier, ...(phk?.faelligAm ? { faelligAm: phk.faelligAm } : {}), ...(abHaengt ? { haengt: abHaengt } : {}) } } : {}),
      band: (() => {
        const offen = pk.kaestchen.filter(k => k.beimKunden && k.zustand !== 'erledigt' && k.zustand !== 'entfaellt');
        const wartet = offen.filter(k => k.wartetKunde).map(k => k.titel);
        const macht = offen.filter(k => !k.wartetKunde).map(k => k.titel);
        return { beimKunden: offen.length, sieht: phk?.kundeSichtbar === true || p.zustand === 'jetzt', ...(wartet.length ? { wartet } : {}), ...(macht.length ? { macht } : {}) };
      })(),
      ...(p.id === analyse ? { analyse: true as const } : {}), ...(p.id === abschluss ? { abschluss: true as const } : {}),
      ...(p.modul ? { modul: p.modul } : {}),
    };
  });
  return { spalten, hier, fertig: reise.fertig, fortschritt: reise.fortschritt };
}

/** Was im Band „Kunde“ steht, wenn nichts beim Kunden liegt (in der laufenden Phase). */
export const BAND_NICHTS = 'nichts offen beim Kunden';

/**
 * Der Satz im Band „Kunde“ je Phase (17.10. Feinschliff — vorher war das Band leer): was gerade beim Kunden liegt — „wartet: …“ (Status wartet auf Kunde),
 * sonst „beim Kunden: …“ (er macht den Schritt), sonst ein offener Abstimmungspunkt mit ihm in der laufenden Phase („Abstimmungspunkt 2 offen“). Liegt
 * nirgends etwas, steht unter der laufenden Phase (bzw. der ersten) „nichts offen beim Kunden“ — sonst bleibt das Band leer. Mehrere: „+n“.
 */
export function bandTexte(z: Pick<ReiseZeile, 'spalten'>): (string | undefined)[] {
  const mehr = (l: readonly string[]) => `${l[0]}${l.length > 1 ? ` +${l.length - 1}` : ''}`;
  const texte = z.spalten.map(s => {
    if (s.band.wartet?.length) return `wartet: ${mehr(s.band.wartet)}`;
    if (s.band.macht?.length && s.zustand !== 'fertig') return `beim Kunden: ${mehr(s.band.macht)}`;
    const a = s.abstimmung;
    if (a && !a.gegeben && a.wer !== 'intern' && (a.hier || s.zustand === 'jetzt')) return `${BESTAETIGUNG}${a.nr ? ` ${a.nr}` : ''} offen`;
    return undefined;
  });
  if (z.spalten.length && texte.every(t => !t)) {
    const i = Math.max(0, z.spalten.findIndex(s => s.zustand === 'jetzt'));
    texte[i] = BAND_NICHTS;
  }
  return texte;
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
  /** Entscheidung aus dem Prozess-Editor: ihr Nein-Zweig als echter Knoten (steht neben ihr, nicht noch einmal im Strang). */
  neinKnoten?: FlussKnoten;
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
  const zuKnoten = (id: string, tiefe = 0): FlussKnoten | null => {
    const k = kaestchen.get(id), z = zeilen.get(id);
    if (!k || !z) return null;
    if (z.knoten.freigabe) {
      const fg = e.freigaben.find(x => x.id === z.knoten.freigabe) ?? { id: z.knoten.freigabe, titel: '', wer: 'beide' as const };
      return rauteAus(k, fg, nummern, 'weiter', z.knoten.faelligAm);
    }
    const er = erinnerungFuer(k, z, e.heute);
    // Entscheidung aus dem Editor: „ja“ führt weiter (bzw. zu ihrem Ja-Zweig), „nein“ zu ihrem Nein-Zweig — der steht als Knoten daneben.
    if (k.entscheid && tiefe < 3) {
      const ja = z.knoten.zweige?.ja ? kaestchen.get(z.knoten.zweige.ja)?.titel : undefined;
      const nz = z.knoten.zweige?.nein && kaestchen.has(z.knoten.zweige.nein) ? z.knoten.zweige.nein : undefined;
      const nk = nz ? zuKnoten(nz, tiefe + 1) : null;
      const zurueck = nz ? e.fall.knoten.find(x => x.id === nz)?.zweige?.ja === z.knoten.id : false;
      return {
        ...k, ...(er ? { erinnerung: er } : {}), ja: ja ? `weiter zu „${ja}“` : 'weiter',
        ...(nk ? { neinKnoten: nk, nein: { titel: nk.titel, unter: zurueck ? 'danach zurück zur Entscheidung' : 'danach weiter' } } : {}),
      };
    }
    return { ...k, ...(er ? { erinnerung: er } : {}) };
  };
  // Nein-Zweige von Entscheidungen dieser Phase stehen neben ihrer Entscheidung — nicht noch einmal im Strang (nichts doppelt).
  const neben = new Set(pk.zeilen.filter(z => z.knoten.form === 'entscheidung' && !z.knoten.freigabe && z.knoten.zweige?.nein && zeilen.has(z.knoten.zweige.nein)).map(z => z.knoten.zweige!.nein!));
  // Dieselben Schritte wie die Reise (`alleSchritte`, Sammel-Schritte aufgelöst), gruppiert nach Teilprozess (`phaseGruppen`): zwei oder mehr
  // Teilprozesse stehen als Karten nebeneinander (Verzweigung in Gruppen), sonst ein Strang.
  const gruppen = phaseGruppen(e.fall, phaseId, e.heute);
  const benannt = gruppen.filter(g => g.teil).length;
  const ids = (g: (typeof gruppen)[number]) => g.zeilen.flatMap(z => (zeilen.has(z.knoten.id) ? [z.knoten.id] : z.bausteine.map(b => b.id).filter(b => zeilen.has(b))));
  const teile: FlussTeil[] = [];
  for (const g of gruppen) {
    const knoten = ids(g).filter(id => !neben.has(id)).map(id => zuKnoten(id)).filter((x): x is FlussKnoten => !!x);
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
    ...f.teile.flatMap(t => (t.art === 'linie' ? t.knoten : t.gruppen.flatMap(g => g.knoten))).flatMap(k => (k.neinKnoten ? [k, k.neinKnoten] : [k])),
    ...(f.abstimmung ? [f.abstimmung] : []),
    ...f.abschluss,
  ];
}
