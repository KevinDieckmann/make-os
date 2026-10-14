// ─── Fulfillment · Fall als Reise — Phasen, „Sie sind hier“, nächste Schritte, nächster Handgriff (11.10., Design-Überarbeitung) ─────────
// Rückmeldung 11.10.: „So ist es sehr unübersichtlich und keiner versteht, was da los ist. Denk immer 2–3 Schritte weiter, es muss einfach zu verstehen
// sein — über Visualisierungen.“ Der Fall wird als Reise durch die Phasen (Ebene 2) gezeigt: je Phase Zustand (fertig · jetzt · offen), Anteil
// erledigter Schritte, Freigabe-Punkt als Meilenstein am Ende der Phase; darunter nur die aktuelle Phase mit ihren nächsten Schritten.
// Gerechnet wird NUR hier (rein, client-sicher, deterministisch) — die Komponenten (components/os/fulfillment/reise/*) zeichnen nur.
// Grundlage sind die vorhandenen Regeln (lib/fulfillment/regeln.ts: `aktuellerKnoten`, `phaseFertig`, `fallFortschritt`) — keine zweite
// Fortschritts-Rechnung: der Anteil je Phase zählt dieselben Blätter (Knoten ohne Kinder, „entfällt“ zählt nicht).

import type { Fall, FallKnoten, Freigabepunkt, KnotenStatus, Zustaendig } from '../typen';
import { MUSTER_ONBOARDING, type OnboardingSchluessel } from '../muster';
import type { FallReiter } from '../adresse';
import { aktuellerKnoten, fallFortschritt, inReihenfolge, kinderVon, phaseFertig, teilbaum, wurzelVon } from '../regeln';
import { obKnotenId, obSchluessel, type OnboardingStand } from './onboarding';
import { SAMMEL_ALLGEMEIN, SAMMEL_SCHRITT, WEITERE_BAUSTEINE } from './phasen';
import { abstimmungName, abstimmungsNummern, anzeigeTitel, titelOhneZusatz, titelZusatz } from './darstellung';

const FERTIG: ReadonlySet<KnotenStatus> = new Set(['erledigt', 'entfaellt']);
const fertig = (k: Pick<FallKnoten, 'status'>) => FERTIG.has(k.status);

export type PhasenZustand = 'fertig' | 'jetzt' | 'offen';
/** Ein Freigabe-Punkt am Ende einer Phase — mit Klartext statt Kürzel; `nr` = Nummer des Abstimmungspunkts in der Anzeige (lückenlos, 14.10.). */
export interface ReiseFreigabe { id: string; titel: string; wer: Zustaendig; gegeben: boolean; am?: string; nr?: number }
export interface ReisePhase {
  /** Titel ohne internen Klammer-Zusatz (`zusatz` = die Erklärung, z. B. „nur Prozess“). */
  id: string; titel: string; zusatz?: string; nr: number; zustand: PhasenZustand;
  /** Erledigte und zählende Schritte (Blätter unter der Phase; ohne Blätter die Phase selbst). */
  erledigt: number; gesamt: number;
  /** 0 … 1 — ohne zählende Schritte 1 bei fertiger, sonst 0. */
  anteil: number;
  faelligAm?: string; ueberfaellig: boolean; wartet: number; entfaellt: boolean;
  freigabe?: ReiseFreigabe;
}
export interface Reise { phasen: ReisePhase[]; /** Index der Phase „jetzt“ — -1, wenn alles fertig ist. */ jetzt: number; fortschritt: number; fertig: boolean }

/** Wer eine Freigabe gibt — in Worten. */
export const FREIGABE_WER: Record<Zustaendig, string> = { kunde: 'der Kunde bestätigt', intern: 'ihr bestätigt intern', beide: 'Kunde und ihr bestätigen gemeinsam' };

const blaetter = (id: string, l: readonly FallKnoten[]) => {
  const nach = new Map(l.map(k => [k.id, k]));
  return teilbaum(id, l).filter(x => x !== id && kinderVon(x, l).length === 0).map(x => nach.get(x)!).filter(Boolean);
};

/** Die Reise eines Falls: Phasen in Rang-Reihenfolge mit Zustand, Anteil, Freigabe-Punkt; `jetzt` = die Phase von `aktuellerKnoten`. */
export function fallReise(fall: Pick<Fall, 'knoten' | 'freigaben'>, freigaben: readonly Pick<Freigabepunkt, 'id' | 'titel' | 'wer'>[], heute: string): Reise {
  const l = fall.knoten;
  const wurzel = wurzelVon(l);
  const phasen = wurzel ? kinderVon(wurzel.id, l) : [];
  const aktuell = aktuellerKnoten(fall).phase?.id;
  const nummern = abstimmungsNummern(l);
  const raus: ReisePhase[] = phasen.map((p, i) => {
    const b = blaetter(p.id, l);
    const zaehlend = (b.length ? b : [p]).filter(k => k.status !== 'entfaellt');
    const erledigt = zaehlend.filter(k => k.status === 'erledigt').length;
    const istFertig = phaseFertig(p, l);
    const darin = teilbaum(p.id, l).map(id => l.find(k => k.id === id)!).filter(Boolean);
    const fg = p.freigabe ? freigaben.find(f => f.id === p.freigabe) : undefined;
    const gegeben = p.freigabe ? fall.freigaben[p.freigabe] : undefined;
    const zusatz = titelZusatz(p.titel);
    return {
      id: p.id, titel: titelOhneZusatz(p.titel), ...(zusatz ? { zusatz } : {}), nr: i + 1,
      zustand: istFertig ? 'fertig' : p.id === aktuell ? 'jetzt' : 'offen',
      erledigt, gesamt: zaehlend.length,
      anteil: zaehlend.length ? erledigt / zaehlend.length : istFertig ? 1 : 0,
      ...(p.faelligAm ? { faelligAm: p.faelligAm } : {}),
      ueberfaellig: !istFertig && darin.some(k => !fertig(k) && !!k.faelligAm && k.faelligAm < heute),
      wartet: darin.filter(k => k.status === 'wartet_kunde').length,
      entfaellt: p.status === 'entfaellt',
      ...(p.freigabe ? { freigabe: { id: p.freigabe, titel: fg?.titel ?? '', wer: fg?.wer ?? 'beide', gegeben: !!gegeben, ...(gegeben ? { am: gegeben.am } : {}), ...(nummern.get(p.freigabe) ? { nr: nummern.get(p.freigabe)! } : {}) } } : {}),
    } satisfies ReisePhase;
  });
  const jetzt = raus.findIndex(p => p.zustand === 'jetzt');
  return { phasen: raus, jetzt, fortschritt: fallFortschritt(fall), fertig: raus.length > 0 && raus.every(p => p.zustand === 'fertig') };
}

/** Kurzform für das Cockpit (eine Zeile je Kunde): nur, was der Mini-Strahl braucht. */
export interface ReiseKurzPhase { titel: string; zustand: PhasenZustand; anteil: number; freigabe?: { id: string; gegeben: boolean; nr?: number } }
export function reiseKurz(r: Reise): ReiseKurzPhase[] {
  return r.phasen.map(p => ({ titel: p.titel, zustand: p.zustand, anteil: Math.round(p.anteil * 100) / 100, ...(p.freigabe ? { freigabe: { id: p.freigabe.id, gegeben: p.freigabe.gegeben, ...(p.freigabe.nr ? { nr: p.freigabe.nr } : {}) } } : {}) }));
}

// ── Schritte einer Phase (Ablauf) ───────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Eine Zeile im Ablauf: ein Schritt (Ebene 3 ohne Kinder oder Ebene 4) — die Bausteine darunter (Ebene 5) hängen als Chips am Schritt statt
 * als eigene, doppelte Zeile. `zustand` ist der wirksame Stand: hat der Schritt Bausteine und sind alle fertig, gilt er als erledigt.
 */
export interface SchrittZeile {
  knoten: FallKnoten; bausteine: FallKnoten[];
  zustand: KnotenStatus; fertig: boolean; ueberfaellig: boolean;
  /** Onboarding-Schritt — sein Stand wird abgeleitet, nie von Hand gesetzt. */
  abgeleitet: boolean;
}
/** Ein Teilprozess (Ebene 3) mit seinen Schritten — `teil` null für einzelne Schritte ohne Teilprozess. */
export interface SchrittGruppe { teil: FallKnoten | null; zeilen: SchrittZeile[]; erledigt: number; gesamt: number }

function zeile(k: FallKnoten, l: readonly FallKnoten[], heute: string): SchrittZeile {
  const bausteine = kinderVon(k.id, l);
  const alleFertig = bausteine.length > 0 && bausteine.every(fertig);
  const zustand: KnotenStatus = k.status === 'entfaellt' ? 'entfaellt' : alleFertig && !fertig(k) ? 'erledigt' : k.status;
  const istFertig = FERTIG.has(zustand);
  const faellig = [k, ...bausteine].filter(x => !fertig(x) && x.faelligAm).map(x => x.faelligAm!).sort()[0];
  return { knoten: k, bausteine, zustand, fertig: istFertig, ueberfaellig: !istFertig && !!faellig && faellig < heute, abgeleitet: !!obSchluessel(k.id) };
}

/**
 * Die Schritte einer Phase, gruppiert nach Teilprozess (Ebene 3). Ebene 3 ohne Kinder ist selbst ein Schritt (aufeinanderfolgende landen in
 * einer Gruppe ohne Titel); Ebene 4 sind Schritte; Ebene 5 hängt als Baustein am Schritt. Ohne Kinder ist die Phase selbst der einzige Schritt.
 */
export function phaseGruppen(fall: Pick<Fall, 'knoten'>, phaseId: string, heute: string): SchrittGruppe[] {
  const l = fall.knoten;
  const phase = l.find(k => k.id === phaseId);
  if (!phase) return [];
  const teile = kinderVon(phaseId, l);
  if (!teile.length) return [gruppe(null, [zeile({ ...phase }, [], heute)])];
  const raus: SchrittGruppe[] = [];
  const ohneTitel = (z: SchrittZeile[]) => {
    const letzte = raus.at(-1);
    if (letzte && !letzte.teil) raus[raus.length - 1] = gruppe(null, [...letzte.zeilen, ...z]);
    else raus.push(gruppe(null, z));
  };
  for (const t of teile) {
    const schritte = kinderVon(t.id, l);
    if (!schritte.length) { ohneTitel([zeile(t, l, heute)]); continue; }
    // Ein Sammel-Teilprozess („Weitere Bausteine“ aus dem Import, bzw. einer, der wie seine Phase heißt) ist keine eigene Gruppe — seine Schritte
    // stehen direkt in der Phase (12.10., Fund aus dem Ende-zu-Ende-Test: „Weitere Bausteine“ stand je Phase als doppelte Überschrift).
    if (istSammelTeil(t, phase)) { ohneTitel(schritte.map(s => zeile(s, l, heute))); continue; }
    raus.push(gruppe(t, schritte.map(s => zeile(s, l, heute))));
  }
  return raus;
}
const titelVergleich = (t: string) => t.normalize('NFC').toLowerCase().replace(/[^a-z0-9äöüß]+/g, ' ').trim();
/**
 * Sammel-Teilprozess: „Weitere Bausteine“ (Titel des Imports für Bausteine ohne Unterphase), gleichnamig mit seiner Phase (ältere Importe) oder „Allgemein“
 * in der Sammel-Phase „Weitere Bausteine“ (Import seit 13.10.).
 */
export const istSammelTeil = (t: Pick<FallKnoten, 'titel'>, phase: Pick<FallKnoten, 'titel'>): boolean =>
  titelVergleich(t.titel) === titelVergleich(WEITERE_BAUSTEINE) || titelVergleich(t.titel) === titelVergleich(phase.titel)
  || (titelVergleich(t.titel) === titelVergleich(SAMMEL_ALLGEMEIN) && titelVergleich(phase.titel) === titelVergleich(WEITERE_BAUSTEINE));
const gruppe = (teil: FallKnoten | null, zeilen: SchrittZeile[]): SchrittGruppe => ({ teil, zeilen, erledigt: zeilen.filter(z => z.zustand === 'erledigt').length, gesamt: zeilen.filter(z => z.zustand !== 'entfaellt').length });

/** Sammel-Schritt des Imports („Zugeordnete Bausteine“) — ein Behälter, nie selbst „als Nächstes“ (14.10., Abnahme B6). */
export const istSammelSchritt = (k: Pick<FallKnoten, 'titel'>): boolean => titelVergleich(k.titel) === titelVergleich(SAMMEL_SCHRITT);

/**
 * Die offenen Schritte einer Phase in der Reihenfolge des Ablaufs — ein Sammel-Schritt steht dabei nie selbst da, sondern seine offenen Bausteine
 * (jeder als eigener Schritt). EINE Liste für „Als Nächstes“ (Fall-Kopf, Lage, Cockpit, Landkarte) und den nächsten Handgriff.
 */
export function offeneSchritte(fall: Pick<Fall, 'knoten'>, phaseId: string, heute: string): SchrittZeile[] {
  const l = fall.knoten;
  return phaseGruppen(fall, phaseId, heute).flatMap(g => g.zeilen).filter(z => !z.fertig)
    .flatMap(z => (istSammelSchritt(z.knoten) && z.bausteine.length ? z.bausteine.map(b => zeile(b, l, heute)).filter(x => !x.fertig) : [z]));
}

/** Die nächsten offenen Schritte der Phase „jetzt“ (höchstens `n`) — in der Reihenfolge des Ablaufs, Sammel-Schritte aufgelöst. */
export function naechsteSchritte(fall: Pick<Fall, 'knoten'>, heute: string, n = 5): (SchrittZeile & { phase: string })[] {
  const p = aktuellerKnoten(fall).phase;
  if (!p) return [];
  return offeneSchritte(fall, p.id, heute).slice(0, n).map(z => ({ ...z, phase: titelOhneZusatz(p.titel) }));
}

// ── Die EINE Stelle: wo steht der Fall, was ist als Nächstes (14.10., Abnahme „eine Rechnung je Größe“) ────────────────────────────────

/** Was als Nächstes dran ist — ein Onboarding-Schritt, ein Abstimmungspunkt oder ein Schritt der laufenden Phase. */
export interface NaechsterPunkt {
  art: 'onboarding' | 'freigabe' | 'schritt';
  /** Kennung des Knotens (beim Abstimmungspunkt: die Phase bzw. der Schritt, der ihn trägt). */
  id: string;
  /** In der Anzeige (Kürzel F0–F7 als „Abstimmungspunkt n“, ohne internen Zusatz). */
  titel: string;
  phase?: string; phaseId?: string;
  zustand: KnotenStatus; faelligAm?: string; ueberfaellig: boolean;
  schluessel?: OnboardingSchluessel;
  /** Freigabe-Kennung (nur `art: 'freigabe'`). */
  freigabe?: string;
}

/** Onboarding-Schritte in der Reihenfolge des Musters: erst die zählenden (ohne den Abstimmungspunkt am Ende), dann dieser — wie der Handgriff. */
const OB_REIHE: readonly OnboardingSchluessel[] = [
  ...MUSTER_ONBOARDING.filter(s => s.zaehltFuerFertig && !s.freigabe).map(s => s.schluessel),
  ...MUSTER_ONBOARDING.filter(s => s.zaehltFuerFertig && s.freigabe).map(s => s.schluessel),
];

/**
 * Der nächste Punkt eines (wirksamen, `fallWirksam`) Falls — dieselbe Reihenfolge wie `naechsterHandgriff`: offene Onboarding-Schritte, dann ein
 * Abstimmungspunkt einer Phase, die sonst durch ist, dann der erste offene Schritt der laufenden Phase (Sammel-Schritte aufgelöst; Schritte ohne
 * Abstimmungspunkt zuerst), zuletzt ihr Abstimmungspunkt. Abgeschlossen oder alles erledigt → null.
 */
export function naechsterPunkt(fall: Pick<Fall, 'knoten' | 'freigaben' | 'status'>, freigaben: readonly Pick<Freigabepunkt, 'id' | 'titel'>[], heute: string): NaechsterPunkt | null {
  if (fall.status === 'abgeschlossen') return null;
  const l = fall.knoten;
  const nach = new Map(l.map(k => [k.id, k]));
  const nummern = abstimmungsNummern(l);
  const phasen = phasenVon(fall);
  const ueber = (k: FallKnoten) => !fertig(k) && !!k.faelligAm && k.faelligAm < heute;
  const ort = (k: FallKnoten) => {
    const ph = phasen.find(x => x.id === k.id || teilbaum(x.id, l).includes(k.id));
    return { zustand: k.status, ueberfaellig: ueber(k), ...(k.faelligAm ? { faelligAm: k.faelligAm } : {}), ...(ph ? { phase: titelOhneZusatz(ph.titel), phaseId: ph.id } : {}) };
  };
  const fgTitel = (id: string) => abstimmungName(id, nummern, freigaben.find(x => x.id === id)?.titel);
  for (const s of OB_REIHE) {
    const k = nach.get(obKnotenId(s));
    if (!k || fertig(k)) continue;
    if (k.freigabe && !fall.freigaben[k.freigabe]) return { art: 'freigabe', id: k.id, titel: fgTitel(k.freigabe), freigabe: k.freigabe, schluessel: s, ...ort(k) };
    if (k.freigabe) continue;
    return { art: 'onboarding', id: k.id, titel: anzeigeTitel(k.titel, nummern), schluessel: s, ...ort(k) };
  }
  const durch = phasen.find(ph => ph.freigabe && !fall.freigaben[ph.freigabe] && ph.status !== 'entfaellt' && phaseFertig(ph, l));
  if (durch?.freigabe) return { art: 'freigabe', id: durch.id, titel: fgTitel(durch.freigabe), freigabe: durch.freigabe, ...ort(durch) };
  const p = aktuellerKnoten(fall).phase;
  if (!p) return null;
  const zeilen = offeneSchritte(fall, p.id, heute);
  const s = zeilen.find(z => !(z.knoten.freigabe && !fall.freigaben[z.knoten.freigabe]));
  if (s) return { art: 'schritt', id: s.knoten.id, titel: anzeigeTitel(s.knoten.titel, nummern), ...ort(s.knoten), zustand: s.zustand, ueberfaellig: s.ueberfaellig };
  const fgKnoten = p.freigabe && !fall.freigaben[p.freigabe] ? p : zeilen.map(z => z.knoten).find(k => k.freigabe && !fall.freigaben[k.freigabe]);
  if (fgKnoten?.freigabe) return { art: 'freigabe', id: fgKnoten.id, titel: fgTitel(fgKnoten.freigabe), freigabe: fgKnoten.freigabe, ...ort(fgKnoten) };
  return null;
}

/** Wo der Fall steht — EINE Rechnung für Lage, Landkarte, Cockpit, Fall-Kopf, Kunden-Seite und Report. */
export interface FallStelle {
  /** Die laufende Phase (`aktuellerKnoten`) mit Nummer und Zahl der Phasen — null, wenn alle erledigt sind. */
  phase: { id: string; titel: string; nr: number; von: number } | null;
  fortschritt: number;
  /** Onboarding läuft noch (wirksamer Status „onboarding“) — dann steht der Kunde auf der Etage „Onboarding“. */
  imOnboarding: boolean;
  fertig: boolean;
  naechster: NaechsterPunkt | null;
}
export function fallStelle(fall: Pick<Fall, 'knoten' | 'freigaben' | 'status'>, freigaben: readonly Pick<Freigabepunkt, 'id' | 'titel' | 'wer'>[], heute: string): FallStelle {
  const r = fallReise(fall, freigaben, heute);
  const j = r.jetzt >= 0 ? r.phasen[r.jetzt] : null;
  return {
    phase: j ? { id: j.id, titel: j.titel, nr: j.nr, von: r.phasen.length } : null,
    fortschritt: r.fortschritt, imOnboarding: fall.status === 'onboarding', fertig: r.fertig,
    naechster: naechsterPunkt(fall, freigaben, heute),
  };
}

/**
 * Status-Änderungen für eine Zeile im Ablauf — der Schritt UND seine Bausteine bekommen denselben Status (vorher standen beide als eigene
 * Zeile da und mussten einzeln gesetzt werden; der Fortschritt zählt die Bausteine). Abgeleitete Onboarding-Schritte und Freigabe-Schritte
 * („erledigt“ nur über „Freigabe vermerken“) bleiben, wie sie sind; Knoten mit dem Status schon gesetzt fallen weg. Nur vorhandene Fall-Ops.
 */
export function statusOps(z: Pick<SchrittZeile, 'knoten' | 'bausteine'>, status: KnotenStatus, grund?: string, standVon: (k: FallKnoten) => string | undefined = () => undefined): Record<string, unknown>[] {
  const setzbar = (k: FallKnoten) => !obSchluessel(k.id) && k.status !== status && !(status === 'erledigt' && k.freigabe);
  return [z.knoten, ...z.bausteine].filter(setzbar).map(k => {
    const stand = standVon(k);
    return { op: 'knoten-status', id: k.id, status, ...(status === 'entfaellt' && grund ? { grund } : {}), ...(stand ? { stand } : {}) };
  });
}

// ── Der nächste Handgriff (eine Hauptaktion je Ansicht) ─────────────────────────────────────────────────────────────────────────────

/** Wohin ein Onboarding-Schritt führt, wenn er noch fehlt (Reiter des Falls + Wortlaut des Knopfs). */
export const ONBOARDING_SPRUNG: Record<OnboardingSchluessel, { reiter: FallReiter; text: string }> = {
  willkommen: { reiter: 'ueberblick', text: 'Willkommensmail vorbereiten' },
  kickoff: { reiter: 'takt', text: 'Kick-off terminieren' },
  vereinbarung: { reiter: 'menschen', text: 'Vereinbarung festhalten' },
  playbook: { reiter: 'kunde', text: 'Kunden-Link fürs Playbook anlegen' },
  stakeholder: { reiter: 'menschen', text: 'Stakeholder eintragen' },
  wertkonto: { reiter: 'wert', text: 'Wert-Konto festlegen' },
  entscheidungslog: { reiter: 'menschen', text: 'Erste Entscheidung festhalten' },
  f0: { reiter: 'ablauf', text: 'Ersten Abstimmungspunkt vermerken' },
};

export type Handgriff =
  | { art: 'willkommen'; text: string; dringend: boolean }
  | { art: 'onboarding'; schluessel: OnboardingSchluessel; reiter: FallReiter; text: string }
  | { art: 'freigabe'; id: string; text: string }
  | { art: 'schritt'; id: string; text: string; wartetKunde: boolean }
  | { art: 'fertig'; text: string };

/**
 * Der eine nächste Handgriff eines Falls — zwei, drei Schritte weiter gedacht: erst die Willkommensmail (24 h), dann das Onboarding, dann die
 * Freigabe der laufenden Phase (wenn sonst alles erledigt ist), sonst der nächste offene Schritt. Ein Fall ohne offene Schritte ist „fertig“.
 */
export function naechsterHandgriff(fall: Pick<Fall, 'knoten' | 'freigaben' | 'status'>, onboarding: Pick<OnboardingStand, 'schritte' | 'willkommen'> | undefined, freigaben: readonly Pick<Freigabepunkt, 'id' | 'titel'>[], heute: string): Handgriff {
  if (fall.status === 'abgeschlossen') return { art: 'fertig', text: 'Der Fall ist abgeschlossen.' };
  const offenOb = (onboarding?.schritte ?? []).filter(s => !s.erfuellt && !s.entfaellt);
  const willkommen = offenOb.find(s => s.schluessel === 'willkommen');
  if (willkommen) return { art: 'willkommen', text: 'Willkommensmail vorbereiten', dringend: !!onboarding?.willkommen.ueberfaellig };
  const ob = offenOb.find(s => s.zaehlt && s.schluessel !== 'f0') ?? offenOb.find(s => s.zaehlt);
  if (ob) {
    if (ob.schluessel === 'f0') return { art: 'freigabe', id: 'F0', text: freigabeText('F0', freigaben, fall.knoten) };
    return { art: 'onboarding', schluessel: ob.schluessel, reiter: ONBOARDING_SPRUNG[ob.schluessel].reiter, text: ONBOARDING_SPRUNG[ob.schluessel].text };
  }
  // Eine Phase ist durch (alle Schritte erledigt), aber ihre Freigabe fehlt noch → das ist der nächste Handgriff (vor dem Weitermachen).
  const ohneFreigabeDurch = phasenVon(fall).find(ph => ph.freigabe && !fall.freigaben[ph.freigabe] && ph.status !== 'entfaellt' && phaseFertig(ph, fall.knoten));
  if (ohneFreigabeDurch?.freigabe) return { art: 'freigabe', id: ohneFreigabeDurch.freigabe, text: freigabeText(ohneFreigabeDurch.freigabe, freigaben, fall.knoten) };
  const p = aktuellerKnoten(fall).phase;
  if (!p) return { art: 'fertig', text: 'Alle Phasen sind erledigt.' };
  // Dieselbe Liste wie „Als Nächstes“ (`offeneSchritte`): ein Sammel-Schritt ist nie selbst der Handgriff, sondern sein erster offener Baustein.
  const offen = offeneSchritte(fall, p.id, heute);
  const ohneFreigabe = offen.filter(z => !z.knoten.freigabe);
  // Freigabe als nächster Handgriff: die Phase trägt einen offenen Freigabe-Punkt und sonst ist alles erledigt (bzw. nur noch der Freigabe-Schritt offen).
  const fg = p.freigabe && !fall.freigaben[p.freigabe] ? p.freigabe : offen.find(z => z.knoten.freigabe && !fall.freigaben[z.knoten.freigabe])?.knoten.freigabe;
  if (fg && !ohneFreigabe.length) return { art: 'freigabe', id: fg, text: freigabeText(fg, freigaben, fall.knoten) };
  const s = ohneFreigabe[0] ?? offen[0];
  if (!s) return fg ? { art: 'freigabe', id: fg, text: freigabeText(fg, freigaben, fall.knoten) } : { art: 'fertig', text: 'Alle Phasen sind erledigt.' };
  const wartetKunde = s.zustand === 'wartet_kunde';
  const titel = anzeigeTitel(s.knoten.titel, abstimmungsNummern(fall.knoten));
  return { art: 'schritt', id: s.knoten.id, text: wartetKunde ? `Beim Kunden nachfassen: ${titel}` : `Als Nächstes: ${titel}`, wartetKunde };
}

/** „Abstimmungspunkt 3 vermerken (Diagnose-Abnahme)“ — „Freigabe“ meint in MAKE OS die Vorschläge von ZOE (14.10., Abnahme B19). */
const freigabeText = (id: string, freigaben: readonly Pick<Freigabepunkt, 'id' | 'titel'>[], knoten: readonly FallKnoten[] = []) => {
  const f = freigaben.find(x => x.id === id);
  const n = abstimmungsNummern(knoten).get(id);
  return `Abstimmungspunkt${n ? ` ${n}` : ''} vermerken${f ? ` (${titelOhneZusatz(f.titel)})` : ''}`;
};

/** „seit heute“ · „seit 1 Tag“ · „seit 9 Tagen“ — Wartezeit in Worten. */
export const seitTagen = (tage: number): string => (tage <= 0 ? 'seit heute' : `seit ${tage} Tag${tage === 1 ? '' : 'en'}`);

/** Die Phasen eines Falls in Rang-Reihenfolge (nur Ebene 2) — für Auswahl-Listen („Zusatz-Schritt in …“). */
export function phasenVon(fall: Pick<Fall, 'knoten'>): FallKnoten[] {
  const w = wurzelVon(fall.knoten);
  return w ? kinderVon(w.id, fall.knoten) : [];
}

/** Reihenfolge-Hilfe für Tests und Zeichner: alle Knoten unter einer Phase in Lese-Reihenfolge. */
export const unterPhase = (fall: Pick<Fall, 'knoten'>, phaseId: string): FallKnoten[] => {
  const darin = new Set(teilbaum(phaseId, fall.knoten));
  return inReihenfolge(fall.knoten).filter(k => darin.has(k.id) && k.id !== phaseId);
};
