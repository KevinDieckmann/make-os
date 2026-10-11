// ─── Fulfillment · Fall als Reise — Phasen, „Sie sind hier“, nächste Schritte, nächster Handgriff (11.10., Design-Überarbeitung) ─────────
// Rückmeldung 11.10.: „So ist es sehr unübersichtlich und keiner versteht, was da los ist. Denk immer 2–3 Schritte weiter, es muss einfach zu verstehen
// sein — über Visualisierungen.“ Der Fall wird als Reise durch die Phasen (Ebene 2) gezeigt: je Phase Zustand (fertig · jetzt · offen), Anteil
// erledigter Schritte, Freigabe-Punkt als Meilenstein am Ende der Phase; darunter nur die aktuelle Phase mit ihren nächsten Schritten.
// Gerechnet wird NUR hier (rein, client-sicher, deterministisch) — die Komponenten (components/os/fulfillment/reise/*) zeichnen nur.
// Grundlage sind die vorhandenen Regeln (lib/fulfillment/regeln.ts: `aktuellerKnoten`, `phaseFertig`, `fallFortschritt`) — keine zweite
// Fortschritts-Rechnung: der Anteil je Phase zählt dieselben Blätter (Knoten ohne Kinder, „entfällt“ zählt nicht).

import type { Fall, FallKnoten, Freigabepunkt, KnotenStatus, Zustaendig } from '../typen';
import type { OnboardingSchluessel } from '../muster';
import type { FallReiter } from '../adresse';
import { aktuellerKnoten, fallFortschritt, inReihenfolge, kinderVon, phaseFertig, teilbaum, wurzelVon } from '../regeln';
import { obSchluessel, type OnboardingStand } from './onboarding';

const FERTIG: ReadonlySet<KnotenStatus> = new Set(['erledigt', 'entfaellt']);
const fertig = (k: Pick<FallKnoten, 'status'>) => FERTIG.has(k.status);

export type PhasenZustand = 'fertig' | 'jetzt' | 'offen';
/** Ein Freigabe-Punkt am Ende einer Phase — mit Klartext statt Kürzel. */
export interface ReiseFreigabe { id: string; titel: string; wer: Zustaendig; gegeben: boolean; am?: string }
export interface ReisePhase {
  id: string; titel: string; nr: number; zustand: PhasenZustand;
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
  const raus: ReisePhase[] = phasen.map((p, i) => {
    const b = blaetter(p.id, l);
    const zaehlend = (b.length ? b : [p]).filter(k => k.status !== 'entfaellt');
    const erledigt = zaehlend.filter(k => k.status === 'erledigt').length;
    const istFertig = phaseFertig(p, l);
    const darin = teilbaum(p.id, l).map(id => l.find(k => k.id === id)!).filter(Boolean);
    const fg = p.freigabe ? freigaben.find(f => f.id === p.freigabe) : undefined;
    const gegeben = p.freigabe ? fall.freigaben[p.freigabe] : undefined;
    return {
      id: p.id, titel: p.titel, nr: i + 1,
      zustand: istFertig ? 'fertig' : p.id === aktuell ? 'jetzt' : 'offen',
      erledigt, gesamt: zaehlend.length,
      anteil: zaehlend.length ? erledigt / zaehlend.length : istFertig ? 1 : 0,
      ...(p.faelligAm ? { faelligAm: p.faelligAm } : {}),
      ueberfaellig: !istFertig && darin.some(k => !fertig(k) && !!k.faelligAm && k.faelligAm < heute),
      wartet: darin.filter(k => k.status === 'wartet_kunde').length,
      entfaellt: p.status === 'entfaellt',
      ...(p.freigabe ? { freigabe: { id: p.freigabe, titel: fg?.titel ?? p.freigabe, wer: fg?.wer ?? 'beide', gegeben: !!gegeben, ...(gegeben ? { am: gegeben.am } : {}) } } : {}),
    } satisfies ReisePhase;
  });
  const jetzt = raus.findIndex(p => p.zustand === 'jetzt');
  return { phasen: raus, jetzt, fortschritt: fallFortschritt(fall), fertig: raus.length > 0 && raus.every(p => p.zustand === 'fertig') };
}

/** Kurzform für das Cockpit (eine Zeile je Kunde): nur, was der Mini-Strahl braucht. */
export interface ReiseKurzPhase { titel: string; zustand: PhasenZustand; anteil: number; freigabe?: { id: string; gegeben: boolean } }
export function reiseKurz(r: Reise): ReiseKurzPhase[] {
  return r.phasen.map(p => ({ titel: p.titel, zustand: p.zustand, anteil: Math.round(p.anteil * 100) / 100, ...(p.freigabe ? { freigabe: { id: p.freigabe.id, gegeben: p.freigabe.gegeben } } : {}) }));
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
  for (const t of teile) {
    const schritte = kinderVon(t.id, l);
    if (!schritte.length) {
      const z = zeile(t, l, heute);
      const letzte = raus.at(-1);
      if (letzte && !letzte.teil) raus[raus.length - 1] = gruppe(null, [...letzte.zeilen, z]);
      else raus.push(gruppe(null, [z]));
      continue;
    }
    raus.push(gruppe(t, schritte.map(s => zeile(s, l, heute))));
  }
  return raus;
}
const gruppe = (teil: FallKnoten | null, zeilen: SchrittZeile[]): SchrittGruppe => ({ teil, zeilen, erledigt: zeilen.filter(z => z.zustand === 'erledigt').length, gesamt: zeilen.filter(z => z.zustand !== 'entfaellt').length });

/** Die nächsten offenen Schritte der Phase „jetzt“ (höchstens `n`) — in der Reihenfolge des Ablaufs. */
export function naechsteSchritte(fall: Pick<Fall, 'knoten'>, heute: string, n = 5): (SchrittZeile & { phase: string })[] {
  const p = aktuellerKnoten(fall).phase;
  if (!p) return [];
  return phaseGruppen(fall, p.id, heute).flatMap(g => g.zeilen).filter(z => !z.fertig).slice(0, n).map(z => ({ ...z, phase: p.titel }));
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
  f0: { reiter: 'ablauf', text: 'Freigabe F0 vermerken' },
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
    if (ob.schluessel === 'f0') return { art: 'freigabe', id: 'F0', text: freigabeText('F0', freigaben) };
    return { art: 'onboarding', schluessel: ob.schluessel, reiter: ONBOARDING_SPRUNG[ob.schluessel].reiter, text: ONBOARDING_SPRUNG[ob.schluessel].text };
  }
  // Eine Phase ist durch (alle Schritte erledigt), aber ihre Freigabe fehlt noch → das ist der nächste Handgriff (vor dem Weitermachen).
  const ohneFreigabeDurch = phasenVon(fall).find(ph => ph.freigabe && !fall.freigaben[ph.freigabe] && ph.status !== 'entfaellt' && phaseFertig(ph, fall.knoten));
  if (ohneFreigabeDurch?.freigabe) return { art: 'freigabe', id: ohneFreigabeDurch.freigabe, text: freigabeText(ohneFreigabeDurch.freigabe, freigaben) };
  const p = aktuellerKnoten(fall).phase;
  if (!p) return { art: 'fertig', text: 'Alle Phasen sind erledigt.' };
  const offen = phaseGruppen(fall, p.id, heute).flatMap(g => g.zeilen).filter(z => !z.fertig);
  const ohneFreigabe = offen.filter(z => !z.knoten.freigabe);
  // Freigabe als nächster Handgriff: die Phase trägt einen offenen Freigabe-Punkt und sonst ist alles erledigt (bzw. nur noch der Freigabe-Schritt offen).
  const fg = p.freigabe && !fall.freigaben[p.freigabe] ? p.freigabe : offen.find(z => z.knoten.freigabe && !fall.freigaben[z.knoten.freigabe])?.knoten.freigabe;
  if (fg && !ohneFreigabe.length) return { art: 'freigabe', id: fg, text: freigabeText(fg, freigaben) };
  const s = ohneFreigabe[0] ?? offen[0];
  if (!s) return fg ? { art: 'freigabe', id: fg, text: freigabeText(fg, freigaben) } : { art: 'fertig', text: 'Alle Phasen sind erledigt.' };
  const wartetKunde = s.zustand === 'wartet_kunde';
  return { art: 'schritt', id: s.knoten.id, text: wartetKunde ? `Beim Kunden nachfassen: ${s.knoten.titel}` : `Als Nächstes: ${s.knoten.titel}`, wartetKunde };
}

const freigabeText = (id: string, freigaben: readonly Pick<Freigabepunkt, 'id' | 'titel'>[]) => {
  const f = freigaben.find(x => x.id === id);
  return `Freigabe ${id} vermerken${f ? ` (${f.titel})` : ''}`;
};

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
