// ─── Prozesse × Fulfillment — der Ablauf des Produkts im Fall (24.10., Bau-Test Kern; Kevin: „Prozesse · Produkte · Mandate · Fulfillment — das Modul,
// an dem wir am meisten arbeiten werden“) ───────────────────────────────────────────────────────────────────────────────────────────────────────────
// Bau-Test 24.10.: ein Produkt mit eigenem, gebundenem Werkstatt-Prozess (veröffentlicht, im Schatten) — der Fall-Dialog bot nur Pakete und war mit dem Paket
// eines ANDEREN Produkts vorbelegt; die Reise zeigte dessen Phasen. Regel seitdem: hat das Produkt des Mandats einen Prozess (`Leistung.prozessId`,
// lib/prozesse/produkt-bindung.ts), ist ER der Ablauf des Falls — auch im Schatten als Ansicht. EINE Stelle (rein, client-sicher, nur reine Regeln):
//   · `ablaufLage`          wie der Prozess gerade läuft: scharf · im Schatten · Entwurf (nie veröffentlicht) · angehalten. Die Weiche scharf/Schatten rechnet
//                           der Motor (`modusFuer`, lib/prozesse/lauf-server.ts — der Server reicht sein Ergebnis herein), hier nur die Zuordnung + Sätze.
//   · `startVorbelegung`    was „Fall starten“ vorbelegt: der Prozess des Produkts; ohne ihn das Paket DIESES Produkts (Zuordnung); sonst nichts — nie das
//                           Paket eines anderen Produkts (vorher: „der erste Ablauf, der kein Zusatzmodul ist“).
//   · `produktAblaufAnsicht` Phasen und Schritte des Prozesses für die Reise — mit dem Stand des Laufs am Mandat: scharf = erledigt · hier · offen; im Schatten
//                           gilt nichts als erledigt (ein Schatten-Lauf rechnet, schreibt nichts — dieselbe Modus-Regel wie überall).
//   · `ablaufSpalten`       dieselben Phasen als Spalten der Reise-Zeile (lib/reise/bild.ts `BildSpalte`) — gezeichnet von ReiseBild, nichts doppelt.
// Nichts Persönliches: nur Kennungen und Titel aus der Werkstatt der Instanz.

import type { ProzessDefinition, ProzessForm, ProzessKnoten, ProzessStatus } from './definition';
import type { LaufModus, LaufStatus, ProzessLauf } from './lauf-typen';
import type { BildKaestchen, BildSpalte, FlussForm, KaestchenZustand, ReiseZustand } from '@/lib/reise/bild';
import { phasen, schritteDer } from './fluss';
import { knotenStand } from './lauf-regeln';

/** Wie der Prozess eines Produkts gerade läuft. */
export type AblaufLage = 'scharf' | 'schatten' | 'entwurf' | 'angehalten';
export const ABLAUF_LAGEN = ['scharf', 'schatten', 'entwurf', 'angehalten'] as const satisfies readonly AblaufLage[];
/** Kurzform je Produkt: welcher Prozess, wie er heißt, wie er läuft. */
export interface ProduktProzessKurz { id: string; titel: string; lage: AblaufLage }

/** Der Satz, den Fall und Dialog zur Lage zeigen (EIN Wortlaut). */
export const LAGE_SATZ: Readonly<Record<AblaufLage, string>> = {
  scharf: 'Der Ablauf ist scharf — seine Aufgaben entstehen im Lauf.',
  schatten: 'Ablauf läuft im Schatten — Aufgaben entstehen, sobald er scharf ist.',
  entwurf: 'Der Ablauf ist noch ein Entwurf — Aufgaben entstehen, sobald er veröffentlicht und scharf ist.',
  angehalten: 'Der Ablauf ist angehalten — Aufgaben entstehen erst wieder, wenn er läuft.',
};
/** Das kurze Wort der Lage (Chip). */
export const LAGE_WORT: Readonly<Record<AblaufLage, string>> = { scharf: 'scharf', schatten: 'im Schatten', entwurf: 'Entwurf', angehalten: 'angehalten' };

/**
 * Die Lage eines Prozesses (rein): archiviert → null (dann gilt die Bindung nicht); ohne veröffentlichte Version bzw. im Entwurf → Entwurf; angehalten
 * (pausiert) → angehalten; sonst die Weiche des Motors (`modus`, aus `modusFuer`) — ohne Weiche bleibt es beim Entwurf.
 */
export function ablaufLage(e: { status: ProzessStatus; versionen: { length: number } }, modus: LaufModus | null): AblaufLage | null {
  if (e.status === 'archiviert') return null;
  if (!e.versionen.length || e.status === 'entwurf') return 'entwurf';
  if (e.status === 'pausiert') return 'angehalten';
  return modus ?? 'entwurf';
}

// ══ Vorbelegung des Dialogs „Fall starten“ ═════════════════════════════════════════════════════════════════════════════════════════════════════

export type StartAblauf = ({ art: 'prozess' } & ProduktProzessKurz) | { art: 'paket'; id: string; titel: string } | null;
/**
 * Was „Fall starten“ vorbelegt (rein, EINE Regel für jede Stelle mit dem Dialog): der Prozess des Produkts (gewinnt — jedes Produkt hat genau EINEN Ablauf);
 * sonst das Paket, das DIESEM Produkt zugeordnet ist; sonst nichts (die Auswahl bleibt leer, der Dialog sagt warum). Ohne Produkt: nichts.
 */
export function startVorbelegung(leistungId: string | null | undefined, q: {
  produktProzesse?: Readonly<Record<string, ProduktProzessKurz>> | null;
  zuordnung?: Readonly<Record<string, { vorlageId: string }>> | null;
  pakete: readonly { id: string; titel: string }[];
}): StartAblauf {
  if (!leistungId) return null;
  const p = q.produktProzesse?.[leistungId];
  if (p) return { art: 'prozess', id: p.id, titel: p.titel, lage: p.lage };
  const v = q.zuordnung?.[leistungId]?.vorlageId;
  const pk = v ? q.pakete.find(x => x.id === v) : undefined;
  return pk ? { art: 'paket', id: pk.id, titel: pk.titel } : null;
}

/**
 * Der Starttag, den „Fall starten“ vorbelegt (25.10., Kern-Bau-Test 2 — vorher immer heute, auch für ein Mandat ab dem 15.11.): der Start des Mandats; liegt er in
 * der Vergangenheit (bzw. fehlt er), heute. Reine Vorgabe — der Dialog lässt jeden Tag zu.
 */
export function fallStartVorgabe(mandatStart: string | null | undefined, heute: string): string {
  return typeof mandatStart === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(mandatStart) && Number.isFinite(Date.parse(`${mandatStart}T12:00:00Z`)) && mandatStart > heute ? mandatStart : heute;
}

// ══ Die Ansicht für die Reise ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export type AblaufSchrittZustand = KaestchenZustand;
export interface AblaufSchritt { id: string; titel: string; form: ProzessForm; zustand: AblaufSchrittZustand; kunde?: true }
export interface AblaufPhase { id: string; titel: string; schritte: AblaufSchritt[] }
export interface ProduktAblaufAnsicht extends ProduktProzessKurz {
  /** Version, nach der gezeigt wird (die des Laufs, sonst die jüngste) — null = nur der Entwurf. */
  version: number | null;
  /** Der jüngste Lauf am Mandat (nicht abgebrochen) — nur Kennung, Modus, Status. */
  lauf: { id: string; modus: LaufModus; status: LaufStatus } | null;
  phasen: AblaufPhase[];
}

type K = ProzessKnoten<ProzessForm>;
/** Was in der Reise als Schritt steht: kein Auslöser, kein Ende, kein Freigabe-Schloss (das setzt die Regel selbst), nichts Ausgeschaltetes. */
const zeigbar = (k: K): boolean => k.form !== 'ausloeser' && k.form !== 'ende' && !k.schloss && !k.deaktiviert;
const OFFEN_IM_LAUF: ReadonlySet<string> = new Set(['laeuft', 'wartet', 'freigabe', 'fehler']);

/**
 * Phasen und Schritte eines Prozesses mit dem Stand des Laufs (rein). Nur ein SCHARFER Lauf setzt Zustände (erledigt · hier · bei fertigem Lauf: nicht
 * erreicht = entfällt); im Schatten bzw. ohne Lauf ist alles offen (kein „Hier“ — es arbeitet ja noch niemand daran).
 */
export function produktAblaufAnsicht(kurz: ProduktProzessKurz, def: Pick<ProzessDefinition, 'knoten'>, version: number | null, lauf?: Pick<ProzessLauf, 'id' | 'modus' | 'status' | 'schritte'> | null): ProduktAblaufAnsicht {
  const scharf = lauf && lauf.modus === 'scharf' ? lauf : null;
  const stand = scharf ? knotenStand(scharf as ProzessLauf) : {};
  const fertig = scharf?.status === 'fertig';
  const zustand = (id: string): AblaufSchrittZustand => {
    const s = stand[id]?.status;
    if (s === 'erledigt') return 'erledigt';
    if (s === 'uebersprungen' || s === 'abgebrochen' || s === 'abgelaufen') return 'entfaellt';
    if (s && OFFEN_IM_LAUF.has(s)) return 'hier';
    return fertig ? 'entfaellt' : 'offen';
  };
  const ph: AblaufPhase[] = phasen(def).map(p => ({
    id: p.id, titel: p.titel,
    schritte: schritteDer(def, p.id).filter(zeigbar).map(s => ({ id: s.id, titel: s.titel, form: s.form ?? 'schritt', zustand: zustand(s.id), ...(s.kundeSichtbar === true ? { kunde: true as const } : {}) })),
  }));
  return { ...kurz, version, lauf: lauf ? { id: lauf.id, modus: lauf.modus, status: lauf.status } : null, phasen: ph };
}

const FLUSS_FORMEN: ReadonlySet<string> = new Set(['schritt', 'nachricht', 'entscheidung', 'erinnerung', 'termin']);
const flussForm = (f: ProzessForm): FlussForm | undefined => (FLUSS_FORMEN.has(f) ? f as FlussForm : f === 'abstimmung' ? 'entscheidung' : undefined);
/** Höchstens so viele Kästchen je Phase (wie die Reise des Falls — Rest „+n“). */
const KAESTCHEN = 4;

/** Kennung einer Phase des Ablaufs in der Reise des Falls (die Kennungen des Falls und der Werkstatt kommen sich so nie in die Quere). */
export const ablaufPhasenKennung = (phaseId: string): string => `pz:${phaseId}`;
export const istAblaufPhase = (id: string | null | undefined): boolean => !!id && id.startsWith('pz:');

/**
 * Die Phasen des Ablaufs als Spalten der Reise-Zeile (rein): fortlaufend ab `abNr`, Zustand fertig/jetzt/offen aus den Schritten. `nebenher` = die Reise des Falls
 * hat ihr „Hier“ schon (Onboarding läuft) — dann steht eine begonnene Phase des Ablaufs als „läuft“ daneben, nie als zweites „Hier“. Band: intern (der Kunde
 * sieht seine Etappen über den Kunden-Link, lib/prozesse/kunden-etappen.ts).
 */
export function ablaufSpalten(a: Pick<ProduktAblaufAnsicht, 'phasen'> & Partial<Pick<ProduktAblaufAnsicht, 'lage'>>, abNr: number, nebenher: boolean): BildSpalte[] {
  // 25.10. (Kern-Bau-Test 2): läuft der Ablauf nicht scharf, trägt jede seiner Phasen das Kennzeichen („im Schatten“) — sie zählen mit (`phasenZaehlung`).
  const kennzeichen = a.lage && a.lage !== 'scharf' ? ` · ${LAGE_WORT[a.lage]}` : '';
  return a.phasen.map((p, i): BildSpalte => {
    const { zaehlend, erledigt, zustand } = phaseStand(p, nebenher);
    const kaestchen: BildKaestchen[] = p.schritte.map(s => {
      const f = flussForm(s.form);
      return { id: s.id, titel: s.titel, ...(f ? { form: f } : {}), zustand: nebenher && s.zustand === 'hier' ? 'offen' : s.zustand };
    });
    const anker = Math.max(0, kaestchen.findIndex(k => k.zustand === 'hier' || k.zustand === 'offen'));
    const von = kaestchen.length > KAESTCHEN ? Math.min(anker, kaestchen.length - KAESTCHEN) : 0;
    const zeigen = kaestchen.slice(von, von + KAESTCHEN);
    return {
      id: ablaufPhasenKennung(p.id), nr: abNr + i, titel: p.titel, zustand,
      unter: `${zustand === 'fertig' ? 'erledigt' : zaehlend ? `${erledigt} von ${zaehlend}` : 'noch ohne Schritte'}${kennzeichen}`,
      kaestchen: zeigen, mehr: kaestchen.length - zeigen.length, band: { intern: true },
    };
  });
}

/** Stand einer Phase des Ablaufs aus ihren Schritten (EINE Regel für Spalten, Zähler und Strahl): fertig · jetzt (bzw. „läuft“ neben dem Onboarding) · offen. */
function phaseStand(p: Pick<AblaufPhase, 'schritte'>, nebenher: boolean): { zaehlend: number; erledigt: number; zustand: ReiseZustand } {
  const zaehlend = p.schritte.filter(s => s.zustand !== 'entfaellt');
  const erledigt = zaehlend.filter(s => s.zustand === 'erledigt').length;
  const hier = p.schritte.some(s => s.zustand === 'hier');
  return { zaehlend: zaehlend.length, erledigt, zustand: zaehlend.length && erledigt === zaehlend.length ? 'fertig' : hier ? (nebenher ? 'laeuft' : 'jetzt') : 'offen' };
}

/** Die Phasen des Ablaufs in Kurzform (Titel, Zustand, Anteil) — für Strahl und Zähler außerhalb der Reise (Cockpit, Mandat), dieselbe Regel wie die Spalten. */
export function ablaufPhasenKurz(a: Pick<ProduktAblaufAnsicht, 'phasen'>, nebenher: boolean): { titel: string; zustand: ReiseZustand; anteil: number }[] {
  return a.phasen.map(p => {
    const st = phaseStand(p, nebenher);
    return { titel: p.titel, zustand: st.zustand, anteil: st.zaehlend ? Math.round((st.erledigt / st.zaehlend) * 100) / 100 : st.zustand === 'fertig' ? 1 : 0 };
  });
}

// ══ EINE Zählung der Phasen (Reise, Mandat, Cockpit) ═══════════════════════════════════════════════════════════════════════════════════════════

/** Wo ein Fall steht: „Phase n von m · Titel“ — `ablauf` = Lage des Ablaufs, wenn er NICHT scharf läuft (dann zählen seine Phasen mit, gekennzeichnet). */
export interface PhasenZahl { nr: number; von: number; titel: string; ablauf?: Exclude<AblaufLage, 'scharf'> }
/**
 * EINE Zählung der Phasen eines Falls (25.10., Kern-Bau-Test 2: die Reise zeigte Onboarding + die Phasen des Produkt-Ablaufs, Mandat und Kunden-Ansicht sagten
 * „Phase 1 von 1 · Onboarding“): die Phasen des Falls (`fallStelle`: nr/von) und dahinter die Phasen des Ablaufs eines Werkstatt-Prozesses — auch im Schatten
 * (dann mit Kennzeichen). Steht der Fall in keiner Phase mehr (Onboarding durch), zählt die laufende Phase des Ablaufs („jetzt“), sonst keine. Ohne Ablauf genau
 * wie bisher. Die Reise zeichnet dieselben Phasen (`ablaufSpalten` ab Nummer `fallPhasen + 1`).
 */
export function phasenZaehlung(fall: { titel: string; nr: number; von: number } | null, fallPhasen: number, ablauf: Pick<ProduktAblaufAnsicht, 'phasen' | 'lage'> | null): PhasenZahl | null {
  const kennzeichen = ablauf && ablauf.lage !== 'scharf' ? { ablauf: ablauf.lage } : {};
  const extra = ablauf?.phasen.length ?? 0;
  if (fall) return { nr: fall.nr, von: fall.von + extra, titel: fall.titel, ...kennzeichen };
  if (!ablauf) return null;
  const kurz = ablaufPhasenKurz(ablauf, false);
  const j = kurz.findIndex(p => p.zustand === 'jetzt');
  return j < 0 ? null : { nr: fallPhasen + j + 1, von: fallPhasen + extra, titel: kurz[j].titel, ...kennzeichen };
}
/** „Phase 1 von 3 · Onboarding“ (+ „· Ablauf im Schatten“) — EIN Wortlaut für Mandat und Cockpit. */
export const phasenText = (z: PhasenZahl): string => `Phase ${z.nr} von ${z.von} · ${z.titel}${z.ablauf ? ` · Ablauf ${LAGE_WORT[z.ablauf]}` : ''}`;
