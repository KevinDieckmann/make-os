// ─── Fulfillment · Prozesse — Mandats-Cockpit und „Was hängt“ (C1, 10.10.; FULFILLMENT_KONZEPT.md 6.3) ──────────────────────────────
// Je laufendem Fall: Kunde, Paket, aktuelle Phase, Fortschritt, nächster Schritt, „wartet auf euch“ (Anzahl, ältester), Health-Ampel (die
// vorhandene `kundenAmpel` der Leistungstreppe), Report fällig, Puls (C2 `kundeKurzFuer`), Analyse-Stand (C3 `dossierKurzFuer`), Onboarding,
// nächster Ritual-Termin (nur `kalender-bezug`). „Was hängt“ zuerst: überfällige Willkommensmails, überfällige Freigaben, „wartet auf euch“
// über 7 Tage, Puls an oder unter der Schwelle, Report über 14 Tage, Art.-14-Frist bald, überfällige Schritte. Rein und client-sicher.

import type { DossierKurz, Fall, Freigabepunkt, KundeKurz } from '../typen';
import { tageZwischen, wartetAufEuch, pulsStufe } from '../regeln';
import type { OnboardingStand } from './onboarding';
import { fallReise, fallStelle, reiseKurz, type ReiseKurzPhase, type WartetAuf } from './reise';
import { abstimmungName, abstimmungsNummern, anzeigeTitel, kundeSiehtLage, type Ampel, type KundenLageArt } from './darstellung';
import { wertDurchschnitt } from './wert';
import { WEG } from '@/lib/wege';
import { anzahl } from '@/lib/text/zahlwort';
import { tagVon } from '@/lib/zeit';

export type HaengerArt = 'willkommen' | 'freigabe' | 'wartet' | 'puls' | 'report' | 'art14' | 'faellig';
export interface Haenger {
  art: HaengerArt; mandatId: string; kunde: string; text: string; schwere: 'rot' | 'gelb'; href: string; seit?: string;
  /**
   * Nur bei „wartet“: sieht der Kunde den wartenden Punkt selbst (geteilte Entscheidung bzw. Knoten an einem freigegebenen Baustein — dieselbe Regel wie
   * seine Liste „Das brauchen wir von Ihnen“)? Dann hat der Hänger Kundenbezug (`kundenLageAus`, 15.10., Abnahme B1).
   */
  kundeSieht?: boolean;
}
export interface CockpitZeile {
  mandatId: string; kunde: string; titel: string; paket?: string; status: Fall['status'];
  /** Phase und „Als Nächstes“ aus `fallStelle` (lib/fulfillment/prozesse/reise.ts) — dieselbe Rechnung wie Fall-Kopf, Landkarte, Kunden-Seite. */
  phase?: string; phaseNr?: number; phasenAnzahl?: number; schritt?: string; fortschritt: number;
  /**
   * Live-Lage des nächsten Punkts (17.10. abends, Ausführung): worauf gewartet wird, bis wann, ob er überfällig ist — aus DEMSELBEN `naechsterPunkt`
   * (Fall-Kopf, Reise „hier“, Landkarte). Fehlt ohne nächsten Punkt.
   */
  schrittLage?: { wartetAuf: WartetAuf; faelligAm?: string; ueberfaellig: boolean };
  wartet: number; wartetAeltesterTage?: number;
  health: 'gruen' | 'gelb' | 'rot' | null;
  report: { faellig: boolean; letzter?: string };
  puls?: { wert: number; am: string }; pulsKritisch: boolean; pulsOffen: boolean; link: KundeKurz['link'];
  analyse: DossierKurz | null;
  onboarding: { offen: number; fertig: boolean; willkommenUeberfaellig: boolean };
  naechsterRitual?: string;
  haengt: Haenger[];
  /** Die Phasen als Mini-Strahl (11.10., Design: „wo steht der Kunde“ als Bild) — Zustand, Anteil, Freigabe-Punkt. Nur lesen. */
  phasen?: ReiseKurzPhase[];
  /** Ø Zielerreichung des Wert-Kontos (vorher → jetzt → Ziel, 0–100) über die messbaren Ziele — null ohne Messung. */
  wert?: { wert: number; ziele: number } | null;
  /** Was der Kunde als Lage sieht — dieselbe Rechnung übersetzt (`kundeSiehtLage`), mit Grund, wenn es von der internen Ampel abweicht (15.10.). */
  kundeSieht?: { ampel: Ampel; art: KundenLageArt; titel: string; grund?: string };
}
export interface CockpitEingabe {
  fall: Fall; kunde: string; titel: string; paket?: string;
  onboarding: OnboardingStand;
  kunde2?: KundeKurz; dossier?: DossierKurz;
  health: 'gruen' | 'gelb' | 'rot' | null;
  report: { faellig: boolean; letzter?: string };
  naechsterRitual?: string;
  pulsSchwelle: number; heute: string;
  /** Abstimmungspunkte der Vorlage (Titel) — für „Als Nächstes“ in Klartext; ohne: nur die Nummer. */
  freigaben?: readonly Pick<Freigabepunkt, 'id' | 'titel' | 'wer'>[];
  /** Bausteine, die (noch) nicht an Kunden gehen (`kundenGesperrt`) — ein wartender Knoten daran hat keinen Kundenbezug. */
  gesperrt?: ReadonlySet<string>;
}

export const WARTET_ALT_TAGE = 7;
/** Ab so vielen Tagen ist „wartet auf den Kunden“ rot (14.10.: dieselbe Grenze wie die Kunden-Seite „Wir kommen gerade nur mit Ihnen weiter“). */
export const WARTET_ROT_TAGE = 21;
export const REPORT_ALT_TAGE = 14;

/** Was an einem Fall hängt — die Regeln aus 6.3, je mit Sprung in den passenden Reiter. */
export function wasHaengt(e: CockpitEingabe): Haenger[] {
  const { fall: f, heute } = e;
  const raus: Haenger[] = [];
  const h = (art: HaengerArt, text: string, schwere: 'rot' | 'gelb', href: string, seit?: string) => raus.push({ art, mandatId: f.mandatId, kunde: e.kunde, text, schwere, href, ...(seit ? { seit } : {}) });
  if (f.status !== 'abgeschlossen' && e.onboarding.willkommen.ueberfaellig) h('willkommen', 'Willkommensmail überfällig (24 Stunden nach der Unterschrift)', 'rot', WEG.fall(f.mandatId, 'reise', 'willkommen'),
    // 17.10. (dritte Abnahme B4): der Berliner Tag der Frist — `.slice(0, 10)` nahm den UTC-Tag („seit 13.10.“ statt 14.10.).
    e.onboarding.willkommen.faellig ? tagVon(e.onboarding.willkommen.faellig) : undefined);
  const nummern = abstimmungsNummern(f.knoten);
  for (const k of f.knoten) {
    // Ausführung (17.10. abends): eine Entscheidung, deren Runden ausgeschöpft sind, hängt rot — bis jemand entscheidet (ja, entfällt oder pausieren).
    if (k.eskaliertAm && k.status !== 'erledigt' && k.status !== 'entfaellt') {
      h('faellig', `„${anzeigeTitel(k.titel, nummern)}“ eskaliert — alle Erinnerungen ohne Antwort`, 'rot', WEG.fall(f.mandatId, 'reise', `schritt-${k.id}`), k.eskaliertAm);
      continue;
    }
    if (k.status === 'erledigt' || k.status === 'entfaellt' || !k.faelligAm || k.faelligAm >= heute) continue;
    if (k.freigabe && !f.freigaben[k.freigabe]) h('freigabe', `${abstimmungName(k.freigabe, nummern)} „${anzeigeTitel(k.titel, nummern)}“ überfällig`, 'rot', WEG.fall(f.mandatId, 'reise', `freigabe-${k.freigabe}`), k.faelligAm);
    else if (!k.id.startsWith('fk-ob-willkommen')) h('faellig', `„${anzeigeTitel(k.titel, nummern)}“ überfällig`, 'gelb', WEG.fall(f.mandatId), k.faelligAm);
  }
  for (const w of wartetAufEuch(f, heute)) {
    if ((w.tage ?? 0) <= WARTET_ALT_TAGE) continue;
    h('wartet', `Wartet seit ${anzahl(w.tage ?? 0, 'Tag', 'Tagen')} auf den Kunden: ${anzeigeTitel(w.titel, nummern)}`, (w.tage ?? 0) >= WARTET_ROT_TAGE ? 'rot' : 'gelb', WEG.fall(f.mandatId), w.seit);
    raus[raus.length - 1].kundeSieht = kundeSiehtWartend(f, w, e.gesperrt);
  }
  const p = e.kunde2?.letzterPuls;
  if (p && pulsStufe(p.wert, e.pulsSchwelle) === 'kritisch') h('puls', `Kunden-Puls ${p.wert} von 10 — Gespräch anbieten`, 'rot', WEG.fall(f.mandatId, 'kunde'), p.am);
  if (e.report.faellig && f.status !== 'abgeschlossen') {
    const t = e.report.letzter ? tageZwischen(e.report.letzter, heute) : undefined;
    if (t === undefined || t > REPORT_ALT_TAGE) h('report', t === undefined ? 'Noch kein Report gesendet' : `Letzter Report vor ${t} Tagen`, 'gelb', WEG.fall(f.mandatId, 'kunde'), e.report.letzter);
  }
  if ((e.dossier?.art14Bald ?? 0) > 0) h('art14', `Art.-14-Hinweis bald fällig (${e.dossier!.art14Bald})`, 'rot', WEG.dossier(f.mandatId));
  return raus.sort((a, b) => (a.schwere === b.schwere ? (a.seit ?? '9') < (b.seit ?? '9') ? -1 : 1 : a.schwere === 'rot' ? -1 : 1));
}

/** Sieht der Kunde einen wartenden Punkt? Entscheidung nur, wenn geteilt; Knoten nur, wenn sein Baustein an Kunden geht (wie `kundenTeile` „wartet“). */
export function kundeSiehtWartend(f: Pick<Fall, 'knoten' | 'entscheidungen'>, w: { art: string; id: string }, gesperrt: ReadonlySet<string> = new Set()): boolean {
  if (w.art === 'entscheidung') return !!f.entscheidungen.find(x => x.id === w.id)?.geteilt;
  const k = f.knoten.find(x => x.id === w.id);
  return !!k && !(k.bausteinId && gesperrt.has(k.bausteinId));
}

export function cockpitZeile(e: CockpitEingabe): CockpitZeile {
  const st = fallStelle(e.fall, e.freigaben ?? [], e.heute);
  const w = wartetAufEuch(e.fall, e.heute);
  const p = e.kunde2?.letzterPuls;
  const haengt = wasHaengt(e);
  return {
    mandatId: e.fall.mandatId, kunde: e.kunde, titel: e.titel, ...(e.paket ? { paket: e.paket } : {}), status: e.fall.status,
    ...(st.phase ? { phase: st.phase.titel, phaseNr: st.phase.nr, phasenAnzahl: st.phase.von } : {}), ...(st.naechster ? { schritt: st.naechster.titel } : {}), fortschritt: st.fortschritt,
    ...(st.naechster ? { schrittLage: { wartetAuf: st.naechster.wartetAuf, ...(st.naechster.faelligAm ? { faelligAm: st.naechster.faelligAm } : {}), ueberfaellig: st.naechster.ueberfaellig } } : {}),
    wartet: w.length, ...(w[0]?.tage !== undefined ? { wartetAeltesterTage: w[0].tage } : {}),
    health: e.health, report: e.report,
    ...(p ? { puls: p } : {}), pulsKritisch: !!p && pulsStufe(p.wert, e.pulsSchwelle) === 'kritisch', pulsOffen: !!e.kunde2?.pulsOffen, link: e.kunde2?.link ?? 'aus',
    analyse: e.dossier ?? null,
    onboarding: { offen: e.onboarding.offen, fertig: e.onboarding.fertig, willkommenUeberfaellig: e.onboarding.willkommen.ueberfaellig },
    ...(e.naechsterRitual ? { naechsterRitual: e.naechsterRitual } : {}),
    haengt,
    phasen: reiseKurz(fallReise(e.fall, e.freigaben ?? [], e.heute)),
    wert: wertDurchschnitt(e.fall.wertKonto ?? {}),
    kundeSieht: kundeSiehtLage({ health: e.health, haengt }, st.fertig),
  };
}

/** Alle Hänger über alle Fälle — rot zuerst, älteste zuerst. */
export const allesWasHaengt = (zeilen: readonly CockpitZeile[]): Haenger[] =>
  zeilen.flatMap(z => z.haengt).sort((a, b) => (a.schwere === b.schwere ? (a.seit ?? '9') < (b.seit ?? '9') ? -1 : 1 : a.schwere === 'rot' ? -1 : 1));
