// ─── Fulfillment · Fall als Reise — Phasen, „Sie sind hier“, nächste Schritte, nächster Handgriff (11.10., Design-Überarbeitung) ─────────
// Rückmeldung 11.10.: „So ist es sehr unübersichtlich und keiner versteht, was da los ist. Denk immer 2–3 Schritte weiter, es muss einfach zu verstehen
// sein — über Visualisierungen.“ Der Fall wird als Reise durch die Phasen (Ebene 2) gezeigt: je Phase Zustand (fertig · jetzt · offen), Anteil
// erledigter Schritte, Freigabe-Punkt als Meilenstein am Ende der Phase; darunter nur die aktuelle Phase mit ihren nächsten Schritten.
// Gerechnet wird NUR hier (rein, client-sicher, deterministisch) — die Komponenten (components/os/fulfillment/reise/*) zeichnen nur.
// Grundlage sind die vorhandenen Regeln (lib/fulfillment/regeln.ts: `aktuellerKnoten`, `phaseFertig`, `fallFortschritt`) — keine zweite
// Fortschritts-Rechnung: der Anteil je Phase zählt dieselben Blätter (Knoten ohne Kinder, „entfällt“ zählt nicht).

import type { Fall, FallKnoten, Freigabepunkt, KnotenForm, KnotenStatus, Zustaendig } from '../typen';
import { MUSTER_ONBOARDING, type OnboardingSchluessel } from '../muster';
import type { FallReiter } from '../adresse';
import { abschnittVon, aktiverNeinZweig, aktuellerKnoten, fallFortschritt, inReihenfolge, jetztPhasen, kinderVon, phaseFertig, teilbaum, wartenderNeinZweig, wurzelVon } from '../regeln';
import { obKnotenId, obSchluessel } from './onboarding';
import { SAMMEL_ALLGEMEIN, SAMMEL_SCHRITT, WEITERE_BAUSTEINE } from './phasen';
import { abstimmungName, abstimmungsNummern, anzeigeTitel, titelOhneZusatz, titelZusatz, BESTAETIGUNG } from './darstellung';

const FERTIG: ReadonlySet<KnotenStatus> = new Set(['erledigt', 'entfaellt']);
const fertig = (k: Pick<FallKnoten, 'status'>) => FERTIG.has(k.status);

export type PhasenZustand = 'fertig' | 'jetzt' | 'offen';
/** Ein Freigabe-Punkt am Ende einer Phase — mit Klartext statt Kürzel; `nr` = Nummer des Abstimmungspunkts in der Anzeige (lückenlos, 14.10.). */
export interface ReiseFreigabe { id: string; titel: string; wer: Zustaendig; gegeben: boolean; am?: string; nr?: number }
export interface ReisePhase {
  /** Titel ohne internen Klammer-Zusatz (`zusatz` = die Erklärung, z. B. „nur Prozess“). */
  id: string; titel: string; zusatz?: string; nr: number; zustand: PhasenZustand;
  /**
   * Erledigte und zählende Schritte — dieselben Zeilen, die der Ablauf zeigt (`phaseGruppen`: ein Schritt mit seinen Bausteinen ist EINE Zeile;
   * ohne Kinder die Phase selbst). 15.10. (Abnahme C16): vorher zählten die Blätter („0 von 5“ über vier sichtbaren Einträgen).
   */
  erledigt: number; gesamt: number;
  /** 0 … 1 — Anteil erledigter Zeilen; ohne zählende Zeilen 1 bei fertiger, sonst 0. */
  anteil: number;
  faelligAm?: string; ueberfaellig: boolean; wartet: number; entfaellt: boolean;
  freigabe?: ReiseFreigabe;
  /**
   * Phase eines angehängten Zusatzmoduls (17.10. spät): Kennung der Vorlage und ihr Titel (ohne „(Zusatzmodul)“) — die Reise zeichnet den Abschnitt markiert.
   * Fehlt: die Phase gehört zum Paket des Falls. Ein Abschnitt läuft neben dem Paket (seine laufende Phase ist ebenfalls „jetzt“).
   */
  modul?: { id: string; titel: string };
}
/** Der Titel eines Zusatzmoduls in der Anzeige — ohne angehängtes „(Zusatzmodul)“ (die Markierung sagt es schon). */
export const modulTitel = (t: string): string => titelOhneZusatz(t).replace(/\s*\(\s*zusatzmodul\s*\)\s*$/i, '').trim() || titelOhneZusatz(t);
export interface Reise { phasen: ReisePhase[]; /** Index der Phase „jetzt“ — -1, wenn alles fertig ist. */ jetzt: number; fortschritt: number; fertig: boolean }

/** Wer eine Freigabe gibt — in Worten. */
export const FREIGABE_WER: Record<Zustaendig, string> = { kunde: 'der Kunde bestätigt', intern: 'ihr bestätigt intern', beide: 'Kunde und ihr bestätigen gemeinsam' };

/** Die Reise eines Falls: Phasen in Rang-Reihenfolge mit Zustand, Anteil, Freigabe-Punkt; `jetzt` = die Phase von `aktuellerKnoten`. */
export function fallReise(fall: Pick<Fall, 'knoten' | 'freigaben'> & Partial<Pick<Fall, 'zusaetze'>>, freigaben: readonly Pick<Freigabepunkt, 'id' | 'titel' | 'wer'>[], heute: string): Reise {
  const l = fall.knoten;
  const wurzel = wurzelVon(l);
  const phasen = wurzel ? kinderVon(wurzel.id, l) : [];
  // „jetzt“: die Phase von `aktuellerKnoten` und je angehängtem Zusatzmodul seine laufende Phase (17.10. spät — die Abschnitte laufen nebeneinander).
  const aktuell = jetztPhasen(fall);
  const nummern = abstimmungsNummern(l);
  const raus: ReisePhase[] = phasen.map((p, i) => {
    const zeilen = phaseGruppen(fall, p.id, heute).flatMap(g => g.zeilen);
    const zaehlend = zeilen.filter(z => z.zustand !== 'entfaellt');
    const erledigt = zaehlend.filter(z => z.zustand === 'erledigt').length;
    const istFertig = phaseFertig(p, l);
    const darin = teilbaum(p.id, l).map(id => l.find(k => k.id === id)!).filter(Boolean);
    const fg = p.freigabe ? freigaben.find(f => f.id === p.freigabe) : undefined;
    const gegeben = p.freigabe ? fall.freigaben[p.freigabe] : undefined;
    const zusatz = titelZusatz(p.titel);
    return {
      id: p.id, titel: titelOhneZusatz(p.titel), ...(zusatz ? { zusatz } : {}), nr: i + 1,
      zustand: istFertig ? 'fertig' : aktuell.has(p.id) ? 'jetzt' : 'offen',
      erledigt, gesamt: zaehlend.length,
      anteil: zaehlend.length ? erledigt / zaehlend.length : istFertig ? 1 : 0,
      ...(p.faelligAm ? { faelligAm: p.faelligAm } : {}),
      ueberfaellig: !istFertig && darin.some(k => !fertig(k) && !!k.faelligAm && k.faelligAm < heute),
      wartet: darin.filter(k => k.status === 'wartet_kunde').length,
      entfaellt: p.status === 'entfaellt',
      ...(p.freigabe ? { freigabe: { id: p.freigabe, titel: fg?.titel ?? '', wer: fg?.wer ?? 'beide', gegeben: !!gegeben, ...(gegeben ? { am: gegeben.am } : {}), ...(nummern.get(p.freigabe) ? { nr: nummern.get(p.freigabe)! } : {}) } } : {}),
      ...(p.zusatz ? { modul: { id: p.zusatz, titel: modulTitel(fall.zusaetze?.find(z => z.vorlageId === p.zusatz)?.titel ?? 'Zusatzmodul') } } : {}),
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
  return alleSchritte(fall, phaseId, heute).filter(z => !z.fertig);
}

/**
 * ALLE Schritte einer Phase in der Reihenfolge des Ablaufs, Sammel-Schritte aufgelöst (jeder ihrer Bausteine ein eigener Schritt) — die Kästchen der
 * Reise und die Knoten des Flusses (17.10., lib/fulfillment/prozesse/reise-bild.ts). `offeneSchritte` ist genau diese Liste ohne die fertigen.
 */
export function alleSchritte(fall: Pick<Fall, 'knoten'>, phaseId: string, heute: string): SchrittZeile[] {
  const l = fall.knoten;
  return phaseGruppen(fall, phaseId, heute).flatMap(g => g.zeilen)
    .flatMap(z => (istSammelSchritt(z.knoten) && z.bausteine.length ? z.bausteine.map(b => zeile(b, l, heute)) : [z]));
}

/** Die nächsten offenen Schritte der Phase „jetzt“ (höchstens `n`) — in der Reihenfolge des Ablaufs, Sammel-Schritte aufgelöst. */
export function naechsteSchritte(fall: Pick<Fall, 'knoten'>, heute: string, n = 5): (SchrittZeile & { phase: string })[] {
  const p = aktuellerKnoten(fall).phase;
  if (!p) return [];
  return offeneSchritte(fall, p.id, heute).slice(0, n).map(z => ({ ...z, phase: titelOhneZusatz(p.titel) }));
}

// ── Die EINE Stelle: wo steht der Fall, was ist als Nächstes (14.10., Abnahme „eine Rechnung je Größe“) ────────────────────────────────

/**
 * Worauf der Fall an seinem nächsten Punkt wartet (17.10. abends, Ausführung — „man sieht live, wo jeder Kunde hängt“): auf uns (intern), auf den Kunden
 * (er macht den Schritt bzw. er wartet bei ihm), auf eine Antwort (Entscheidung offen) oder auf einen Abstimmungspunkt.
 */
export type WartetAuf = 'intern' | 'kunde' | 'entscheidung' | 'abstimmung';
export const WARTET_AUF_TEXT: Record<WartetAuf, string> = { intern: 'bei uns', kunde: 'wartet auf den Kunden', entscheidung: 'Entscheidung offen', abstimmung: `${BESTAETIGUNG} offen` };

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
  /** Worauf gewartet wird (17.10. abends) — dieselbe Rechnung für Fall-Kopf, Cockpit und Landkarte. */
  wartetAuf: WartetAuf;
  /** Die Form des Knotens aus dem Ablauf (Prozess-Editor), wenn er eine trägt. */
  form?: KnotenForm;
}

/** Onboarding-Schritte in der Reihenfolge des Musters: erst die zählenden (ohne den Abstimmungspunkt am Ende), dann dieser — wie der Handgriff. */
const OB_REIHE: readonly OnboardingSchluessel[] = [
  ...MUSTER_ONBOARDING.filter(s => s.zaehltFuerFertig && !s.freigabe).map(s => s.schluessel),
  ...MUSTER_ONBOARDING.filter(s => s.zaehltFuerFertig && s.freigabe).map(s => s.schluessel),
];

/**
 * Der nächste Punkt eines (wirksamen, `fallWirksam`) Falls — EINE Regel für „Als Nächstes“ (die frühere zweite, `naechsterHandgriff`, ist seit 18.10. weg): offene Onboarding-Schritte, dann ein
 * Abstimmungspunkt einer Phase, die sonst durch ist, dann der erste offene Schritt der laufenden Phase (Sammel-Schritte aufgelöst; Schritte ohne
 * Abstimmungspunkt zuerst), zuletzt ihr Abstimmungspunkt. Abgeschlossen oder alles erledigt → null.
 */
export function naechsterPunkt(fall: Pick<Fall, 'knoten' | 'freigaben' | 'status'>, freigaben: readonly (Pick<Freigabepunkt, 'id' | 'titel'> & { wer?: Zustaendig })[], heute: string, abschnitt?: string): NaechsterPunkt | null {
  if (fall.status === 'abgeschlossen') return null;
  const l = fall.knoten;
  const nach = new Map(l.map(k => [k.id, k]));
  const nummern = abstimmungsNummern(l);
  const phasenAlle = phasenVon(fall);
  // Ein Zusatzmodul (17.10., Gesamtprüfung L2 B1): nur seine Phasen, kein Onboarding — so steht sein nächster Punkt neben dem des Pakets (Heute, Cockpit).
  const phasen = abschnitt === undefined ? phasenAlle : phasenAlle.filter(ph => abschnittVon(ph) === abschnitt);
  const ueber = (k: FallKnoten) => !fertig(k) && !!k.faelligAm && k.faelligAm < heute;
  const ort = (k: FallKnoten) => {
    const ph = phasen.find(x => x.id === k.id || teilbaum(x.id, l).includes(k.id));
    return { zustand: k.status, ueberfaellig: ueber(k), ...(k.faelligAm ? { faelligAm: k.faelligAm } : {}), ...(ph ? { phase: titelOhneZusatz(ph.titel), phaseId: ph.id } : {}), ...(k.form ? { form: k.form } : {}) };
  };
  const fgTitel = (id: string) => abstimmungName(id, nummern, freigaben.find(x => x.id === id)?.titel);
  // Worauf gewartet wird (17.10. abends): ein Abstimmungspunkt ohne Kunden ist intern; ein Schritt beim bzw. vom Kunden wartet auf ihn; eine Entscheidung
  // (Prozess-Editor) auf eine Antwort.
  const fgWartet = (id: string): WartetAuf => (freigaben.find(x => x.id === id)?.wer === 'intern' ? 'intern' : 'abstimmung');
  const schrittWartet = (k: FallKnoten): WartetAuf => (k.status === 'wartet_kunde' || k.zustaendig === 'kunde' ? 'kunde' : k.form === 'entscheidung' && !k.freigabe ? 'entscheidung' : 'intern');
  for (const s of abschnitt === undefined ? OB_REIHE : []) {
    const k = nach.get(obKnotenId(s));
    if (!k || fertig(k)) continue;
    if (k.freigabe && !fall.freigaben[k.freigabe]) return { art: 'freigabe', id: k.id, titel: fgTitel(k.freigabe), freigabe: k.freigabe, schluessel: s, ...ort(k), wartetAuf: fgWartet(k.freigabe) };
    if (k.freigabe) continue;
    return { art: 'onboarding', id: k.id, titel: anzeigeTitel(k.titel, nummern), schluessel: s, ...ort(k), wartetAuf: schrittWartet(k) };
  }
  const durch = phasen.find(ph => ph.freigabe && !fall.freigaben[ph.freigabe] && ph.status !== 'entfaellt' && phaseFertig(ph, l));
  if (durch?.freigabe) return { art: 'freigabe', id: durch.id, titel: fgTitel(durch.freigabe), freigabe: durch.freigabe, ...ort(durch), wartetAuf: fgWartet(durch.freigabe) };
  const p = aktuellerKnoten(fall, abschnitt).phase;
  if (!p) return null;
  // Nie die Phase selbst (15.10., Abnahme B1: „Als Nächstes: Diagnose“ neben „Phase 3: Diagnose“) — eine Phase ohne Schritte hat keinen eigenen nächsten Schritt.
  // Ein Nein-Zweig, der gerade nicht läuft, ist nie „als Nächstes“ (17.10. abends, Ausführung) — er kommt erst mit einem „nein“.
  const zeilen = offeneSchritte(fall, p.id, heute).filter(z => z.knoten.id !== p.id && !wartenderNeinZweig(l, z.knoten.id));
  let s = zeilen.find(z => !(z.knoten.freigabe && !fall.freigaben[z.knoten.freigabe]));
  // An einer Entscheidung mit „nein“ läuft ihr Nein-Zweig (die Erinnerung) — DER ist dann hier.
  const zweig = s && s.knoten.form === 'entscheidung' ? aktiverNeinZweig(l, s.knoten) : null;
  if (zweig) s = alleSchritte(fall, p.id, heute).find(z => z.knoten.id === zweig.id) ?? s;
  if (s) return { art: 'schritt', id: s.knoten.id, titel: anzeigeTitel(s.knoten.titel, nummern), ...ort(s.knoten), zustand: s.zustand, ueberfaellig: s.ueberfaellig, wartetAuf: zweig ? 'entscheidung' : schrittWartet(s.knoten) };
  const fgKnoten = p.freigabe && !fall.freigaben[p.freigabe] ? p : zeilen.map(z => z.knoten).find(k => k.freigabe && !fall.freigaben[k.freigabe]);
  if (fgKnoten?.freigabe) return { art: 'freigabe', id: fgKnoten.id, titel: fgTitel(fgKnoten.freigabe), freigabe: fgKnoten.freigabe, ...ort(fgKnoten), wartetAuf: fgWartet(fgKnoten.freigabe) };
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
/** 17.10.: die vier Reiter des Falls (Reise · Ziele & Wirkung · Menschen & Termine · Kunde) — `stelle` = Karte im Reiter (Sprung `#stelle-…`). */
export const ONBOARDING_SPRUNG: Record<OnboardingSchluessel, { reiter: FallReiter; text: string; stelle?: string }> = {
  willkommen: { reiter: 'reise', text: 'Willkommensmail vorbereiten' },
  kickoff: { reiter: 'menschen', text: 'Kick-off terminieren', stelle: 'takt-leiste' },
  vereinbarung: { reiter: 'menschen', text: 'Vereinbarung festhalten', stelle: 'menschen-vereinbarung' },
  playbook: { reiter: 'kunde', text: 'Kunden-Link fürs Playbook anlegen', stelle: 'kunde-link' },
  stakeholder: { reiter: 'menschen', text: 'Stakeholder eintragen', stelle: 'menschen-stakeholder' },
  wertkonto: { reiter: 'ziele', text: 'Wert-Konto festlegen' },
  entscheidungslog: { reiter: 'menschen', text: 'Erste Entscheidung festhalten', stelle: 'menschen-entscheidung' },
  f0: { reiter: 'reise', text: `Erste ${BESTAETIGUNG} vermerken` },
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
