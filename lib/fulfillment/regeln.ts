// ─── Fulfillment — reine Regeln (C0, 10.10.; FULFILLMENT_KONZEPT.md 2.2/2.3, 3.1, 5.4/5.5, 7.4, 8.1) ──────────────────────────────────
// EINE Stelle für: Ebenen und Teilbäume (Vorlage und Fall), Kreise, Fortschritt, aktueller Knoten, „wartet auf euch“, Wert-Konto-Zeilen,
// Puls-Stufe, Mandatsende, Zeitpunkt der Unterschrift, Onboarding-Kandidaten und „welcher Kunde steht wo“. Server UND Browser rechnen nur
// hiermit (Komponenten zeichnen, sie rechnen nicht — 6.1). Rein, client-sicher, deterministisch. Tests: tests/fulfillment-fundament.test.ts.
//
// Ebenen: ein Knoten ohne `elternId` (bzw. mit unbekanntem Eltern) ist Ebene 1 (Gesamtprozess); jede Stufe der Kette zählt eins dazu.
// Höchstens `EBENEN_MAX` (5). Ein Kreis hat keine Ebene (`KREIS` = -1) — der Schreibweg lehnt ihn mit 400 ab (`kreisBei`).

import type { CrmBestand, Mandat } from '@/lib/crm/typen';
import { bereichVonGesellschaft } from '@/lib/einheiten';
import { tagVon, tagePlus } from '@/lib/zeit';
import { mandatZieleLesen } from '@/lib/crm/mandat-ziele';
import { MUSTER_ONBOARDING } from './muster';
import type {
  Fall, FallKnoten, KnotenStatus, OnboardingKandidat, ProzessVorlage, Unterschrift, WartetPunkt, WertKontoZeile,
} from './typen';

export const EBENEN_MAX = 5;
export const KREIS = -1;
/** Knoten, die als abgeschlossen gelten (erledigt oder bewusst entfallen). */
const FERTIG: ReadonlySet<KnotenStatus> = new Set(['erledigt', 'entfaellt']);

type Knotenartig = { id: string; elternId?: string; rang: number };

const nachRang = <T extends Knotenartig>(a: T, b: T) => a.rang - b.rang || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Direkte Kinder eines Knotens (bzw. die Wurzeln bei `undefined`) in Rang-Reihenfolge. Ein unbekannter Elternteil zählt als Wurzel. */
export function kinderVon<T extends Knotenartig>(elternId: string | undefined, liste: readonly T[]): T[] {
  const ids = new Set(liste.map(k => k.id));
  return liste.filter(k => (elternId === undefined ? !k.elternId || !ids.has(k.elternId) : k.elternId === elternId && k.id !== elternId)).sort(nachRang);
}

/** Die Vorfahren eines Knotens, der nächste zuerst — bricht bei einem Kreis ab. */
export function vorfahren<T extends Knotenartig>(id: string, liste: readonly T[]): string[] {
  const nach = new Map(liste.map(k => [k.id, k]));
  const raus: string[] = [];
  const gesehen = new Set([id]);
  let p = nach.get(id)?.elternId;
  while (p && nach.has(p) && !gesehen.has(p)) { raus.push(p); gesehen.add(p); p = nach.get(p)?.elternId; }
  return raus;
}

/** Ebene eines Knotens (1–n) aus der Eltern-Kette; ein Kreis ergibt `KREIS` (-1). */
export function ebeneVon(k: { id: string; elternId?: string }, liste: readonly { id: string; elternId?: string }[]): number {
  const nach = new Map(liste.map(x => [x.id, x]));
  const gesehen = new Set<string>([k.id]);
  let ebene = 1;
  let p = k.elternId;
  while (p && nach.has(p)) {
    if (gesehen.has(p)) return KREIS;
    gesehen.add(p);
    ebene++;
    p = nach.get(p)!.elternId;
  }
  return ebene;
}

/** Der erste Knoten, der in einem Kreis steht — sonst null. */
export function kreisBei(liste: readonly { id: string; elternId?: string }[]): string | null {
  for (const k of liste) if (ebeneVon(k, liste) === KREIS) return k.id;
  return null;
}

/** Der Knoten und alle Nachfahren (Tiefensuche in Rang-Reihenfolge, kreisfest). */
export function teilbaum<T extends Knotenartig>(id: string, liste: readonly T[]): string[] {
  const raus: string[] = [];
  const gesehen = new Set<string>();
  const geh = (x: string) => {
    if (gesehen.has(x)) return;
    gesehen.add(x); raus.push(x);
    for (const k of kinderVon(x, liste)) geh(k.id);
  };
  if (liste.some(k => k.id === id)) geh(id);
  return raus;
}

/** Alle Knoten in Lese-Reihenfolge (Wurzeln nach Rang, je Teilbaum Tiefensuche) — die Reihenfolge von Zeitstrahl, Ablauf und Report. */
export function inReihenfolge<T extends Knotenartig>(liste: readonly T[]): T[] {
  const nach = new Map(liste.map(k => [k.id, k]));
  return kinderVon(undefined, liste).flatMap(w => teilbaum(w.id, liste)).map(id => nach.get(id)!).filter(Boolean);
}

/** Der Wurzelknoten (Ebene 1) einer Vorlage — bei mehreren der erste nach Rang. */
export const wurzelVon = <T extends Knotenartig>(liste: readonly T[]): T | null => kinderVon(undefined, liste)[0] ?? null;

// ── Fall: Fortschritt, aktueller Knoten, „wartet auf euch“ ──────────────────────────────────────────────────────────────────────────

const fertig = (k: FallKnoten) => FERTIG.has(k.status);
const blaetterUnter = (id: string, liste: readonly FallKnoten[]) => {
  const nach = new Map(liste.map(k => [k.id, k]));
  return teilbaum(id, liste).filter(x => x !== id && kinderVon(x, liste).length === 0).map(x => nach.get(x)!);
};

/**
 * Fortschritt eines Falls in Prozent (0–100, gerundet): Anteil der erledigten BLÄTTER ab Ebene 2 (Knoten ohne Kinder); „entfällt“ zählt nicht (7.4).
 * Bis 11.10. zählten nur Ebene 4/5, sobald es sie gab — in einem Fall aus Muster bis Ebene 3 + Onboarding-Schritten (Ebene 4) zählte dann nur
 * das Onboarding (Prüf-Fund: nach dem Onboarding 89 %, sonst 0 %). Jetzt zählt jedes Blatt gleich, egal auf welcher Ebene.
 */
export function fallFortschritt(fall: Pick<Fall, 'knoten'>): number {
  const l = fall.knoten;
  const zaehlend = l.filter(k => ebeneVon(k, l) >= 2 && kinderVon(k.id, l).length === 0 && k.status !== 'entfaellt');
  if (!zaehlend.length) return 0;
  return Math.round((zaehlend.filter(k => k.status === 'erledigt').length / zaehlend.length) * 100);
}

/** Ist eine Phase (Ebene 2) abgeschlossen? Eigener Status fertig — oder sie hat Blätter, und alle sind fertig. (Exportiert seit 11.10. für die Reise, lib/fulfillment/prozesse/reise.ts.) */
export function phaseFertig(p: FallKnoten, liste: readonly FallKnoten[]): boolean {
  if (fertig(p)) return true;
  const b = blaetterUnter(p.id, liste);
  return b.length > 0 && b.every(fertig);
}

// ── Was den Ablauf anhält — und was nebenher läuft (18.10., Nachprüfung L1b N2) ──────────────────────────────────────────────────────────
// Fund: ein neuer Fall bekam keine einzige Ablauf-Aufgabe, bis die GANZE Phase 1 fertig war — auch das Kunden-Playbook (macht der Kunde, darf laut
// Onboarding-Regel noch laufen) und Bausteine ohne Form („Kick-off-Agenda“), die nie eine Aufgabe bekommen. Im echten Fall lag die Lieferung still, solange
// der Kunde sein Playbook nicht ausfüllte. EINE Regel für Ausführung, „hier“ (`aktuellerKnoten`, `naechsterPunkt`), Reise, Cockpit und Kunden-Seite:
//   · Das Kunden-Playbook (der Onboarding-Schritt, der fürs „fertig“ nicht zählt) und alles darunter läuft nebenher — in jedem Fall.
//   · In einem Fall mit Ausführung (mindestens ein Knoten mit ausführbarer Form) zusätzlich: ein Knoten OHNE Form, der ein Baustein ist (Material) oder den
//     der Kunde macht — außer er hängt unter einem ausgeführten Schritt (dann gehört er zu dessen Schritt) bzw. ist ein Onboarding-Schritt oder trägt eine
//     Bestätigung. Er bekommt nie eine Aufgabe, also hält er nie an.
// Ein Fall ohne Ausführung und ohne offenes Playbook nach fertigem Onboarding rechnet Byte für Byte wie vorher (`phaseDurch` = `phaseFertig`).

/** Kennungen der abgeleiteten Onboarding-Schritte im Fall (`fk-ob-<schlüssel>` — lib/fulfillment/prozesse/onboarding.ts `obKnotenId`; hier ohne Import-Kreis). */
const OB_SCHRITTE: ReadonlySet<string> = new Set(MUSTER_ONBOARDING.map(s => `fk-ob-${s.schluessel}`));
/** Onboarding-Schritte, die fürs „fertig“ nicht zählen (das Kunden-Playbook) — sie und alles darunter laufen nebenher. */
const OB_NEBENHER: ReadonlySet<string> = new Set(MUSTER_ONBOARDING.filter(s => !s.zaehltFuerFertig).map(s => `fk-ob-${s.schluessel}`));

/** Trägt ein Knoten eine Form, die die Ausführung ausführt (Schritt, Termin, Nachricht, Entscheidung, Erinnerung)? EINE Regel mit `ausfuehrungsArt`. */
export const ausfuehrbar = (k: Pick<FallKnoten, 'id' | 'form' | 'freigabe'>): boolean => !!k.form && k.form !== 'abstimmung' && !k.freigabe && !OB_SCHRITTE.has(k.id);
/** Läuft in diesem Fall eine Ausführung? (dieselbe Regel wie `ablaufAktiv`, lib/fulfillment/prozesse/ausfuehrung.ts) */
export const mitAusfuehrung = (liste: readonly Pick<FallKnoten, 'id' | 'form' | 'freigabe'>[]): boolean => liste.some(ausfuehrbar);

/**
 * Läuft ein offener Knoten nebenher — hält er weder den Ablauf noch „hier“ an? (Regel oben.) `ablauf` = der Fall hat eine Ausführung (ohne Angabe aus den
 * Knoten). Ein fertiger Knoten läuft nie nebenher (er ist schon durch).
 */
export function laeuftNebenher(k: FallKnoten, liste: readonly FallKnoten[], ablauf: boolean = mitAusfuehrung(liste)): boolean {
  if (fertig(k)) return false;
  const vor = vorfahren(k.id, liste);
  if (OB_NEBENHER.has(k.id) || vor.some(id => OB_NEBENHER.has(id))) return true;
  if (!ablauf || k.form || k.freigabe || OB_SCHRITTE.has(k.id)) return false;
  if (!k.bausteinId && k.zustaendig !== 'kunde') return false;
  const nach = new Map(liste.map(x => [x.id, x]));
  return !vor.some(id => { const v = nach.get(id); return !!v && ausfuehrbar(v); });
}

/**
 * Hält ein Knoten (mit allem darunter) den Ablauf an? Ja, solange in seinem Teilbaum ein offenes Blatt steht, das nicht nebenher läuft. Für einen Schritt
 * im Ablauf, eine Zeile der Reise und das „hier“ — dieselbe Frage.
 */
export function haeltAn(k: FallKnoten, liste: readonly FallKnoten[], ablauf: boolean = mitAusfuehrung(liste)): boolean {
  const nach = new Map(liste.map(x => [x.id, x]));
  return teilbaum(k.id, liste).some(id => { const x = nach.get(id)!; return kinderVon(id, liste).length === 0 && !fertig(x) && !laeuftNebenher(x, liste, ablauf); });
}

/**
 * Ist eine Phase durch — hält sie den Ablauf nicht mehr an? Fertig (`phaseFertig`) — oder sie hat Blätter, und jedes ist fertig oder läuft nebenher. Was noch
 * nebenher läuft, bleibt offen sichtbar (Reise, Kunden-Seite), aber der Fall rückt weiter. EINE Regel für Ausführung, „hier“, Reise und Kunden-Seite.
 */
export function phaseDurch(p: FallKnoten, liste: readonly FallKnoten[], ablauf: boolean = mitAusfuehrung(liste)): boolean {
  if (phaseFertig(p, liste)) return true;
  const b = blaetterUnter(p.id, liste);
  return b.length > 0 && b.every(x => fertig(x) || laeuftNebenher(x, liste, ablauf));
}

/**
 * Wie der Ablauf durch die Phasen geht (EINE Regel für die Ausführung und „hier“ — 18.10., L1b N2): die Phasen der Reihe nach; eine entfallene zählt nicht;
 * eine Phase, die durch ist, aber deren Bestätigung noch fehlt, hält an (`bestaetigung`); sonst die erste, die nicht durch ist (`phase`). Beides null: alles
 * durch. Ohne `freigaben` (ein Aufrufer, der sie nicht kennt) hält keine Bestätigung an.
 */
export function phasenGang(fall: Pick<Fall, 'knoten'> & Partial<Pick<Fall, 'freigaben'>>, phasen: readonly FallKnoten[]): { phase: FallKnoten | null; bestaetigung: FallKnoten | null } {
  const ablauf = mitAusfuehrung(fall.knoten);
  for (const p of phasen) {
    if (p.status === 'entfaellt') continue;
    if (!phaseDurch(p, fall.knoten, ablauf)) return { phase: p, bestaetigung: null };
    if (p.freigabe && fall.freigaben && !fall.freigaben[p.freigabe]) return { phase: null, bestaetigung: p };
  }
  return { phase: null, bestaetigung: null };
}

/**
 * Der aktuelle Knoten eines Falls (7.4): die Phase (Ebene 2), an der der Gang durch die Phasen steht (`phasenGang` — dieselbe Stelle wie die Ausführung):
 * die erste, die nicht durch ist (was nebenher läuft, hält sie nicht an), bzw. davor eine durchlaufene, deren Bestätigung noch fehlt (18.10., L1b N2 — vorher
 * stand „jetzt“ schon in der nächsten Phase, während die Ausführung auf die Bestätigung wartete). Darin der erste offene Einzelschritt, der anhält (Ebene 4;
 * gibt es keinen, der erste offene Teilprozess auf Ebene 3). Alles durch → beides null.
 * Mit `abschnitt` (17.10. spät, Zusatzmodule): nur in diesem Abschnitt — `null` = das Paket des Falls, sonst die Kennung des Zusatzmoduls (`abschnittVon`).
 */
export function aktuellerKnoten(fall: Pick<Fall, 'knoten'> & Partial<Pick<Fall, 'freigaben'>>, abschnitt?: string | null): { phase: FallKnoten | null; schritt: FallKnoten | null } {
  const l = fall.knoten;
  const ablauf = mitAusfuehrung(l);
  const reihenfolge = inReihenfolge(l);
  const gang = phasenGang(fall, reihenfolge.filter(k => ebeneVon(k, l) === 2 && (abschnitt === undefined || abschnittVon(k) === abschnitt)));
  const phase = gang.phase ?? gang.bestaetigung;
  if (!phase) return { phase: null, schritt: null };
  const darin = new Set(teilbaum(phase.id, l));
  const offen = (ebene: number) => reihenfolge.find(k => darin.has(k.id) && ebeneVon(k, l) === ebene && !fertig(k) && !(kinderVon(k.id, l).length && blaetterUnter(k.id, l).every(fertig)) && haeltAn(k, l, ablauf)) ?? null;
  return { phase, schritt: offen(4) ?? offen(3) };
}

// ── „Angebot angenommen?“ bei aktivem Mandat (19.10., Rundgang B13) ──────────────────────────────────────────────────────────────────
// Fund: Bei einem Kunden mit aktivem Mandat fragte das Fulfillment „Angebot angenommen? Ja/Nein“ (Entscheidung aus dem Ablauf). Mit aktivem Mandat bzw.
// angenommenem Angebot ist diese Entscheidung erledigt — der Fall rechnet sie wirksam als „ja“ (`fallWirksam`, lib/fulfillment/prozesse/onboarding.ts), gespeichert
// wird davon nichts. Erkannt am Titel, wie die anderen Schritte mit fester Bedeutung (`schrittVerweis`): genau die Frage, ob DAS Angebot angenommen ist —
// „Angebot für Phase 2 angenommen?“ (ein Nachtrag im laufenden Mandat) bleibt eine offene Entscheidung.

const ANGEBOT_ANGENOMMEN = /^(?:(?:ist|wurde) )?(?:das |unser |ihr )?angebot (?:(?:ist|wurde) )?angenommen$/;
/** Ist dieser Knoten die Entscheidung „Angebot angenommen?“ (eine Entscheidung, kein Abstimmungspunkt)? */
export function istAngebotsEntscheidung(k: Pick<FallKnoten, 'form' | 'freigabe' | 'titel'>): boolean {
  if (k.form !== 'entscheidung' || k.freigabe) return false;
  return ANGEBOT_ANGENOMMEN.test(k.titel.normalize('NFC').toLowerCase().replace(/[?!.:]+/g, ' ').replace(/\s+/g, ' ').trim());
}
export const ANGEBOT_ANGENOMMEN_GRUND = 'Angebot angenommen — das Mandat läuft';

/**
 * Die Entscheidungen „Angebot angenommen?“ eines Falls, wie sie wirken, wenn das Angebot angenommen ist bzw. das Mandat läuft (`am` = der Tag dafür): erledigt mit
 * „ja“ — wie ein Klick auf „ja“ (lib/fulfillment/prozesse/ausfuehrung.ts `antwortAnwenden`): der Nein-Zweig (die Erinnerung) entfällt, was der Ja-Zweig
 * überspringt, ebenso. Der Tag ist frühestens der des letzten fertigen Schritts davor (sonst stünde der nächste Schritt mit einer alten Ankunft sofort als überfällig da).
 * Rein; ohne passende Entscheidung dieselbe Liste.
 */
export function angebotAngenommenWirksam(kn: readonly FallKnoten[], am: string): FallKnoten[] {
  const offen = kn.filter(k => istAngebotsEntscheidung(k) && !FERTIG.has(k.status));
  if (!offen.length) return kn as FallKnoten[];
  let raus = [...kn];
  const setze = (id: string, f: (k: FallKnoten) => FallKnoten) => { raus = raus.map(k => (k.id === id ? f(k) : k)); };
  const entfallen = (k: FallKnoten): FallKnoten => (FERTIG.has(k.status) ? k : { ...k, status: 'entfaellt', grund: ANGEBOT_ANGENOMMEN_GRUND });
  for (const e of offen) {
    const geschwister = kinderVon(e.elternId, raus);
    const i = geschwister.findIndex(x => x.id === e.id);
    const vorher = geschwister.slice(0, Math.max(0, i)).filter(x => x.id !== e.zweige?.nein && x.status === 'erledigt').map(x => (x.erledigtAm ?? x.seit ?? '').slice(0, 10)).filter(Boolean);
    const tag = [tagVon(am), ...vorher].sort().at(-1)!;
    const { grund: _g, faelligAm: _f, eskaliertAm: _x, ...r } = e;
    setze(e.id, () => ({ ...r, status: 'erledigt', seit: tag, erledigtAm: tag, antwort: 'ja', antwortAm: tag }));
    if (e.zweige?.nein) setze(e.zweige.nein, entfallen);
    // Ja-Zweig: was im Strang zwischen der Entscheidung und ihrem Ziel steht, wird übersprungen (wie `nachErledigung`).
    const ziel = e.zweige?.ja ? geschwister.findIndex(x => x.id === e.zweige!.ja) : -1;
    if (ziel > i) for (const x of geschwister.slice(i + 1, ziel)) if (x.id !== e.zweige?.nein) setze(x.id, entfallen);
  }
  return raus;
}

// ── Zusatzmodule: Abschnitte eines Falls (17.10. spät; lib/fulfillment/prozesse/fall.ts `zusatzAnhaengen`) ─────────────────────────────

/** Der Abschnitt einer Phase (Ebene 2): null = das Paket des Falls, sonst die Kennung der Vorlage des angehängten Zusatzmoduls. */
export const abschnittVon = (p: Pick<FallKnoten, 'zusatz'>): string | null => p.zusatz ?? null;
/** Die Abschnitte eines Falls: zuerst das Paket (null), dann die Zusatzmodule in der Reihenfolge ihrer Phasen. Ohne Zusatzmodul: nur `[null]`. */
export function abschnitteDes(fall: Pick<Fall, 'knoten'>): (string | null)[] {
  const w = wurzelVon(fall.knoten);
  const raus: (string | null)[] = [null];
  for (const p of w ? kinderVon(w.id, fall.knoten) : []) { const a = abschnittVon(p); if (a && !raus.includes(a)) raus.push(a); }
  return raus;
}
/** Je Knoten das Zusatzmodul, in dessen Abschnitt er steht (Teilbaum einer Phase mit `zusatz`) — Knoten des Pakets fehlen in der Liste. */
export function zusatzJeKnoten(liste: readonly FallKnoten[]): Map<string, string> {
  const raus = new Map<string, string>();
  const w = wurzelVon(liste);
  for (const p of w ? kinderVon(w.id, liste) : []) if (p.zusatz) for (const id of teilbaum(p.id, liste)) raus.set(id, p.zusatz);
  return raus;
}
/**
 * Die Phasen „jetzt“ eines Falls: die des Pakets (bzw. die erste offene überhaupt — `aktuellerKnoten`) und je angehängtem Zusatzmodul seine erste offene Phase —
 * die Abschnitte laufen nebeneinander (die Ausführung arbeitet dort parallel). EINE Regel für Reise, Kunden-Sicht und Ausführung.
 * Ein abgeschlossener Fall hat kein „jetzt“ (18.10., Nachprüfung L1b N9: der Kopf sagte „Der Fall ist abgeschlossen“, die Reise weiter „HIER · Phase 2“).
 */
export function jetztPhasen(fall: Pick<Fall, 'knoten'> & Partial<Pick<Fall, 'status' | 'freigaben'>>): Set<string> {
  const raus = new Set<string>();
  if (fall.status === 'abgeschlossen') return raus;
  const a = aktuellerKnoten(fall).phase;
  if (a) raus.add(a.id);
  for (const z of abschnitteDes(fall)) { if (!z) continue; const p = aktuellerKnoten(fall, z).phase; if (p) raus.add(p.id); }
  return raus;
}

/**
 * Wie eine Phase (Ebene 2) dasteht — EINE Regel für die Darstellung (Reise intern, Cockpit, Kunden-Seite):
 *   · `jetzt`  — die Phase „hier“ (`jetztPhasen`, je Abschnitt eine).
 *   · `fertig` — wirklich fertig (`phaseFertig`: eigener Status fertig bzw. jedes Blatt darunter erledigt/entfällt).
 *   · `laeuft` — der Gang durch die Phasen ist an ihr vorbei (sie liegt in ihrem Abschnitt vor der Phase „jetzt“ bzw. der Abschnitt hat keine mehr) und
 *                sie ist durch (`phaseDurch`), aber darin ist noch etwas offen, das nur nebenher läuft (Kunden-Playbook, Bausteine ohne Form).
 *   · `offen`  — sonst: der Gang ist noch nicht dort (auch, wenn sie nur aus Bausteinen besteht und deshalb später nicht anhält).
 * Rundgang 19.10. (A4): `fallReise` nahm `phaseDurch` für „fertig“ — ein neuer Fall zeigte Phasen nur aus Bausteinen („Umsetzung“, „Führung“) am ersten Tag
 * als „✓ erledigt“ bei 0 %. „Durch“ sagt nur, dass die Phase den Ablauf nicht anhält; die Regel für „hier“ und die Ausführung (`phasenGang`) bleibt.
 */
export type PhasenStand = 'fertig' | 'jetzt' | 'laeuft' | 'offen';
export function phasenStaende(fall: Pick<Fall, 'knoten'> & Partial<Pick<Fall, 'status' | 'freigaben'>>): Map<string, PhasenStand> {
  const l = fall.knoten;
  const w = wurzelVon(l);
  const phasen = w ? kinderVon(w.id, l) : [];
  const jetzt = jetztPhasen(fall);
  const ablauf = mitAusfuehrung(l);
  // Je Abschnitt (Paket bzw. Zusatzmodul): die Stelle der Phase „jetzt“ in der Reihenfolge seiner Phasen — keine = der Gang ist dort ganz durch.
  const imAbschnitt = new Map<string, FallKnoten[]>();
  for (const p of phasen) { const a = abschnittVon(p) ?? ''; imAbschnitt.set(a, [...(imAbschnitt.get(a) ?? []), p]); }
  const raus = new Map<string, PhasenStand>();
  for (const liste of imAbschnitt.values()) {
    const j = liste.findIndex(p => jetzt.has(p.id));
    liste.forEach((p, i) => {
      const vorbei = j < 0 || i < j;
      raus.set(p.id, jetzt.has(p.id) ? 'jetzt' : phaseFertig(p, l) ? 'fertig' : vorbei && phaseDurch(p, l, ablauf) ? 'laeuft' : 'offen');
    });
  }
  return raus;
}

// ── Ausführung: der Nein-Zweig einer Entscheidung (17.10. abends; lib/fulfillment/prozesse/ausfuehrung.ts) ─────────────────────────────

type ZweigKnoten = Pick<FallKnoten, 'id' | 'status' | 'form' | 'zweige' | 'antwort' | 'runden'>;
/**
 * Der Nein-Zweig einer Entscheidung, wenn er GERADE läuft — die Antwort war „nein“ und seine Runde ist noch offen (er hat weniger Runden erledigt, als
 * „nein“ kam). Sonst null. EINE Regel für „hier“ (`naechsterPunkt`), die Ausführung und die Reise.
 */
export function aktiverNeinZweig<T extends ZweigKnoten>(liste: readonly T[], e: ZweigKnoten): T | null {
  if (e.form !== 'entscheidung' || e.antwort !== 'nein' || !e.zweige?.nein || FERTIG.has(e.status)) return null;
  const r = liste.find(x => x.id === e.zweige!.nein);
  if (!r || FERTIG.has(r.status) || (r.runden ?? 0) >= (e.runden ?? 0)) return null;
  return r;
}
/** Ist dieser Knoten der Nein-Zweig einer Entscheidung, der gerade NICHT läuft (er wartet auf ein „nein“)? Dann ist er nie „als Nächstes“. */
export function wartenderNeinZweig(liste: readonly ZweigKnoten[], id: string): boolean {
  const e = liste.find(x => x.form === 'entscheidung' && x.zweige?.nein === id);
  return !!e && aktiverNeinZweig(liste, e)?.id !== id;
}

/** Tage zwischen zwei Tagen (YYYY-MM-DD bzw. ISO) — `bis` minus `von`, nie negativ; unlesbar → undefined. */
export function tageZwischen(von: string | undefined, bis: string): number | undefined {
  if (!von) return undefined;
  const t = (x: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(tagVon(x)); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN; };
  const d = (t(bis) - t(von)) / 86_400_000;
  return Number.isFinite(d) ? Math.max(0, Math.round(d)) : undefined;
}

/**
 * „Wartet auf euch“ (1.3, 5.2): was beim Kunden liegt — Knoten im Status „wartet_kunde“ (mit Freigabe-Punkt als `freigabe`) und offene
 * Entscheidungen, die der Kunde trifft. Ältester zuerst (ohne Datum zuletzt).
 */
export function wartetAufEuch(fall: Pick<Fall, 'knoten' | 'entscheidungen' | 'freigaben'>, heute: string): WartetPunkt[] {
  const raus: WartetPunkt[] = [];
  for (const k of fall.knoten) {
    if (k.status !== 'wartet_kunde') continue;
    const art = k.freigabe && !fall.freigaben[k.freigabe] ? 'freigabe' as const : 'knoten' as const;
    const tage = tageZwischen(k.seit, heute);
    raus.push({ art, id: k.id, titel: k.titel, ...(k.seit ? { seit: k.seit } : {}), ...(tage !== undefined ? { tage } : {}) });
  }
  for (const e of fall.entscheidungen) {
    if (e.status !== 'offen' || e.wer !== 'kunde') continue;
    const tage = tageZwischen(e.am, heute);
    raus.push({ art: 'entscheidung', id: e.id, titel: e.titel, seit: e.am, ...(tage !== undefined ? { tage } : {}) });
  }
  return raus.sort((a, b) => (b.tage ?? -1) - (a.tage ?? -1) || a.titel.localeCompare(b.titel, 'de'));
}

// ── Wert-Konto (7.5) ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const zahlText = (n: number, einheit?: string) => `${n.toLocaleString('de-DE')}${einheit ? ` ${einheit}` : ''}`;

/**
 * Eine Zeile „vorher → jetzt → Ziel“ je Ziel des Mandats (`Mandat.ziele` bleibt die Wahrheit für „was ist das Ziel“). Jetzt = letzte Messung
 * des Falls, sonst `ziele[].ist`; fehlt etwas: „—“. Ohne Fall nur die Werte des Mandats.
 */
export function wertKontoZeilen(fall: Pick<Fall, 'wertKonto'> | null | undefined, mandat: Pick<Mandat, 'ziele'>): WertKontoZeile[] {
  // Roh gelesen (ladeCrm säubert nicht) — auch Ziele in der alten Text-Form zählen (EINE Stelle lib/crm/mandat-ziele.ts).
  return mandatZieleLesen(mandat.ziele).map(z => {
    const e = fall?.wertKonto?.[z.id];
    const letzte = e?.messungen?.length ? [...e.messungen].sort((a, b) => (a.am < b.am ? -1 : a.am > b.am ? 1 : 0)).at(-1)! : null;
    const vorher = e?.ausgangZahl !== undefined ? zahlText(e.ausgangZahl, e.einheit) : e?.ausgang ?? '—';
    const jetzt = letzte ? zahlText(letzte.wert, e?.einheit) : z.ist?.trim() || '—';
    const ziel = e?.zielZahl !== undefined ? zahlText(e.zielZahl, e.einheit) : z.ziel?.trim() || '—';
    return { zielId: z.id, name: z.text, vorher, jetzt, ziel, ...(e?.zielBis ? { bis: e.zielBis } : {}), festgelegt: !!e?.festgelegtAm };
  });
}

// ── Puls (5.5) ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type PulsStufe = 'gut' | 'neutral' | 'kritisch';
/** 0–10: bis zur Schwelle (Vorgabe 6) „kritisch“ (Hinweis an die zuständige Person), ab 9 „gut“, dazwischen „neutral“. */
export function pulsStufe(wert: number, schwelle = 6): PulsStufe {
  if (wert <= schwelle) return 'kritisch';
  return wert >= 9 ? 'gut' : 'neutral';
}

// ── Business-Mandat: EIN Prädikat (18.10.: „alle Business-Mandate ins Fulfillment“) ─────────────────────────────────────────────

/**
 * Bekommt ein Mandat Fulfillment? Jede Business-Gesellschaft — auch eine aus dem Register (`g-…`) und „offen“ —, nur Privat-Einheiten (die
 * Selbstständigkeit) nicht. DIESELBE Regel wie das CRM (`bereichVonGesellschaft`, lib/crm/treppe.ts `imBusiness`); vorher nahm das Fulfillment nur die
 * festen Gesellschaften, das CRM zählte mehr — zwei Zahlen für „Kunden in Lieferung“ (Gesamtprüfung L2 Zählungen B1). Rechnungen für Register-
 * Gesellschaften laufen weiter über `finanzFirmaFuer` (sonst `NUR_GRUNDDATEN`).
 */
export const istBusinessMandat = (g: unknown): boolean => bereichVonGesellschaft(typeof g === 'string' ? g : null) === 'business';

// ── Mandat: Ende, Unterschrift, Onboarding-Kandidaten (3.1, 8.1) ─────────────────────────────────────────────────────────────────────

/**
 * Ende eines Mandats als Tag (Löschfristen 8.1): „beendet“ → `ende` (fehlt es: der Tag der letzten Änderung — nie früher als das echte Ende);
 * sonst im Papierkorb → Tag des Löschens; sonst null (läuft noch).
 */
export function mandatsEnde(m: Pick<Mandat, 'status' | 'ende' | 'geloeschtAm' | 'geaendert'>): string | null {
  if (m.status === 'beendet') return m.ende ? tagVon(m.ende) : m.geaendert ? tagVon(m.geaendert) : null;
  if (m.geloeschtAm) return tagVon(m.geloeschtAm);
  return null;
}

/**
 * Zeitpunkt der Unterschrift (3.1): `angenommenAm` des verknüpften Angebots (Mandat oder Deal) → Tag des Deal-Wechsels auf „gewonnen“
 * (Historie, der letzte) → `Mandat.start` → Tag, an dem der Fall angelegt wurde. Sonst null.
 */
export function unterschriftAm(
  m: Pick<Mandat, 'id' | 'chanceId' | 'start'>,
  crm: Pick<CrmBestand, 'angebote' | 'chancen'>,
  fallAngelegt?: string,
): Unterschrift | null {
  const angenommen = (crm.angebote ?? [])
    .filter(a => a.status === 'angenommen' && a.angenommenAm && (a.mandatId === m.id || (!!m.chanceId && a.dealId === m.chanceId)))
    .map(a => a.angenommenAm!).sort();
  if (angenommen.length) return { am: angenommen[0], quelle: 'angebot' };
  const deal = m.chanceId ? (crm.chancen ?? []).find(c => c.id === m.chanceId) : undefined;
  const gewonnen = (deal?.historie ?? []).filter(h => h.stufe === 'gewonnen' && h.am).map(h => h.am).sort().at(-1);
  if (gewonnen) return { am: gewonnen, quelle: 'deal' };
  if (m.start) return { am: m.start, quelle: 'start' };
  return fallAngelegt ? { am: fallAngelegt, quelle: 'fall' } : null;
}

/** Marke „nicht mehr vorschlagen“ für ein Mandat (Ausblenden der Onboarding-Karte). */
export const markeOnboardingAus = (mandatId: string) => `onboarding-aus:${mandatId}`;

/**
 * Wo eine Aufgabe zu einem Fall liegt und wie sie heißt (15.10., Abnahme C20: „Registerauszug … ablegen“ lag ohne Kunden unter „Sonstige“ der eigenen
 * Gesellschaft und las sich wie eine Gründungsaufgabe): im Space des Mandanten (`m-<Firma>`, sonst die Gesellschaft des Mandats), mit Bezug zum Mandat
 * und dem Kunden im Titel. EINE Regel für jede Aufgabe, die Fulfillment anlegt.
 */
export function fallAufgabeOrt(m: Pick<Mandat, 'id' | 'kunde' | 'gesellschaft' | 'firmaId'>): { space: 'business'; spaceId?: string; bezug: { mandatId: string; firmaId?: string }; titel: (t: string) => string } {
  const spaceId = m.firmaId ? `m-${m.firmaId}` : ['kdc', 'kdv', 'ug'].includes(m.gesellschaft) ? m.gesellschaft : undefined;
  return {
    space: 'business', ...(spaceId ? { spaceId } : {}), bezug: { mandatId: m.id, ...(m.firmaId ? { firmaId: m.firmaId } : {}) },
    titel: (t: string) => `${t} — ${m.kunde}`.slice(0, 280),
  };
}

/** Marke (in `vorlagen.marken`): Tag, an dem Fulfillment eingerichtet wurde — setzt der erste Morgenlauf (der legt dabei nichts an). */
export const MARKE_FULFILLMENT_SEIT = 'fulfillment-eingerichtet';
/** So viele Tage nach der Unterschrift gilt ein Mandat noch als „neu“ (sonst Bestand, wenn es vor der Einrichtung unterschrieben wurde). */
export const BESTAND_TAGE = 14;
/**
 * Bestandsmandat (Prüf-Fund 11.10.: am ersten Morgen nach dem Update bekam JEDES aktive Mandat einen Vorschlag, eine Glocke und „Willkommensmail
 * überfällig“)? Neu ist, was NACH der Einrichtung (`stichtag`) unterschrieben wurde oder höchstens `BESTAND_TAGE` vor `bezugTag` (heute bzw. Start des
 * Falls). Ohne Tag der Unterschrift: Bestand. Rein.
 */
export function istBestand(unterschrift: string | null | undefined, stichtag: string | undefined, bezugTag: string): boolean {
  if (!unterschrift) return true;
  const u = tagVon(unterschrift);
  if (stichtag && u >= tagVon(stichtag)) return false;
  return u < tagePlus(tagVon(bezugTag), -BESTAND_TAGE);
}

/**
 * Mandate, für die „Kundenonboarding starten“ angeboten wird (3.1): Status aktiv oder Angebot, Business-Gesellschaft, nicht gelöscht, noch
 * kein Fall, nicht ausgeblendet — UND unterschrieben, Angebot angenommen oder Deal gewonnen. Älteste Unterschrift zuerst.
 * `bestand: true` (Regel `istBestand`, Stichtag aus `marken`): nur ruhig „Fall starten?“ — kein Vorschlag, keine Glocke, keine Uhr.
 */
export function onboardingKandidaten(
  crm: Pick<CrmBestand, 'mandate' | 'angebote' | 'chancen'>,
  faelle: Readonly<Record<string, unknown>>,
  marken: Readonly<Record<string, string>>,
  heute: string,
): OnboardingKandidat[] {
  const raus: OnboardingKandidat[] = [];
  for (const m of crm.mandate ?? []) {
    if (m.status !== 'aktiv' && m.status !== 'angebot') continue;
    if (!istBusinessMandat(m.gesellschaft) || m.geloeschtAm || faelle[m.id] || marken[markeOnboardingAus(m.id)]) continue;
    const angebot = (crm.angebote ?? []).some(a => a.status === 'angenommen' && (a.mandatId === m.id || (!!m.chanceId && a.dealId === m.chanceId)));
    const deal = !!m.chanceId && (crm.chancen ?? []).some(c => c.id === m.chanceId && c.stufe === 'gewonnen');
    const grund = m.vertragUnterschrieben ? 'vertrag' as const : angebot ? 'angebot' as const : deal ? 'deal' as const : null;
    if (!grund) continue;
    const unterschrift = unterschriftAm(m, crm);
    raus.push({
      mandatId: m.id, titel: m.titel, kunde: m.kunde, grund, unterschrift, ...(istBestand(unterschrift?.am, marken[MARKE_FULFILLMENT_SEIT], heute) ? { bestand: true as const } : {}),
      ...(m.leistungId ? { leistungId: m.leistungId } : {}), ...(m.zustaendig ? { zustaendig: m.zustaendig } : {}),
    });
  }
  const zeit = (k: OnboardingKandidat) => k.unterschrift?.am ?? '9999';
  return raus.sort((a, b) => (zeit(a) < zeit(b) ? -1 : zeit(a) > zeit(b) ? 1 : a.mandatId.localeCompare(b.mandatId)));
}

// ── Landkarte: welcher Kunde steht wo (2.2) ──────────────────────────────────────────────────────────────────────────────────────────

/** Der Ort der Landkarte, an dem ein Fall im Onboarding steht (Etage „Onboarding“ des Musters). */
export const ORT_ONBOARDING = 'fulfillment.onboarding';

/**
 * Je Knoten einer Vorlage die Mandate, deren aktueller Knoten (`aktuellerKnoten`) in seinem Teilbaum liegt. Ein Verweis auf eine Paket-Vorlage
 * (`verweis: fp-…`) zählt deren Fälle mit (und damit auch seine Vorfahren). Nur laufende Fälle (nicht „abgeschlossen“), wirksam (`fallWirksam`).
 * 14.10. (Abnahme B6): ein Fall im Onboarding (wirksamer Status „onboarding“ — dieselbe Regel wie Lage und Fall-Kopf) steht auf der Etage mit dem Ort
 * „Onboarding“, nicht schon auf der Etage seines Pakets; fehlt sie (eigene Landkarte), bleibt es beim Verweis.
 */
export function kundenJeKnoten(vorlage: Pick<ProzessVorlage, 'id' | 'knoten'>, faelle: readonly Fall[]): Record<string, string[]> {
  const raus: Record<string, Set<string>> = {};
  const dazu = (knotenId: string, mandatId: string) => {
    for (const k of [knotenId, ...vorfahren(knotenId, vorlage.knoten)]) (raus[k] ??= new Set()).add(mandatId);
  };
  const ids = new Set(vorlage.knoten.map(k => k.id));
  const onboardingEtage = vorlage.knoten.find(k => k.ort === ORT_ONBOARDING && !k.verweis);
  for (const f of faelle) {
    if (f.status === 'abgeschlossen') continue;
    if (f.vorlageId === vorlage.id) {
      const a = aktuellerKnoten(f, f.zusaetze?.length ? null : undefined);
      const hier = [a.schritt?.id, a.phase?.id].find(x => x && ids.has(x));
      if (hier) dazu(hier, f.mandatId);
    }
    // Ein angehängtes Zusatzmodul (17.10. spät): der Fall steht auch in dessen Vorlage — an seinem Punkt im Abschnitt (dieselben Kennungen wie die Vorlage).
    if (f.zusaetze?.some(z => z.vorlageId === vorlage.id)) {
      const a = aktuellerKnoten(f, vorlage.id);
      const hier = [a.schritt?.id, a.phase?.id].find(x => x && ids.has(x));
      if (hier) dazu(hier, f.mandatId);
    }
    const verweise = vorlage.knoten.filter(k => k.verweis && k.verweis === f.vorlageId);
    if (verweise.length && f.status === 'onboarding' && onboardingEtage) { dazu(onboardingEtage.id, f.mandatId); continue; }
    for (const k of verweise) dazu(k.id, f.mandatId);
  }
  return Object.fromEntries(Object.entries(raus).map(([k, v]) => [k, Array.from(v).sort()]));
}

// ── Konto löschen: Speichername tilgen (lib/datenschutz/konto-daten.ts) ──────────────────────────────────────────────────────────────

/** Felder, die in Fulfillment-Beständen einen Speichernamen (Person des Haushalts) tragen. */
// `angehaengtVon` (Zusatzmodule am Fall, 18.10. — Gesamtprüfung L3 C2): sonst bliebe der Speichername stehen, und ein neu vergebenes Konto gleichen
// Namens erschiene als „hat angehängt“.
export const PERSONEN_FELDER: ReadonlySet<string> = new Set(['geaendertVon', 'gestartetVon', 'erledigtVon', 'willkommenVon', 'erstelltVon', 'angehaengtVon', 'von', 'person']);
/**
 * Den Speichernamen einer gelöschten Kontoperson in allen Personen-Feldern durch „[gelöscht]“ ersetzen — die Einträge bleiben (Geschäftsunterlagen).
 * Liefert den neuen Wert und die Zahl der Ersetzungen (0 = nichts geändert, dann derselbe Wert).
 */
export function speichernameTilgen<T>(wert: T, speicher: string, ersatz = '[gelöscht]'): { wert: T; n: number } {
  let n = 0;
  const geh = (x: unknown): unknown => {
    if (Array.isArray(x)) { let anders = false; const l = x.map(y => { const z = geh(y); if (z !== y) anders = true; return z; }); return anders ? l : x; }
    if (!x || typeof x !== 'object') return x;
    let anders = false;
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
      if (PERSONEN_FELDER.has(k) && v === speicher) { o[k] = ersatz; n++; anders = true; continue; }
      const w = geh(v);
      if (w !== v) anders = true;
      o[k] = w;
    }
    return anders ? o : x;
  };
  const neu = geh(wert) as T;
  return { wert: n ? neu : wert, n };
}
