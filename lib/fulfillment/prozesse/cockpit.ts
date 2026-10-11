// ─── Fulfillment · Prozesse — Mandats-Cockpit und „Was hängt“ (C1, 10.10.; FULFILLMENT_KONZEPT.md 6.3) ──────────────────────────────
// Je laufendem Fall: Kunde, Paket, aktuelle Phase, Fortschritt, nächster Schritt, „wartet auf euch“ (Anzahl, ältester), Health-Ampel (die
// vorhandene `kundenAmpel` der Leistungstreppe), Report fällig, Puls (C2 `kundeKurzFuer`), Analyse-Stand (C3 `dossierKurzFuer`), Onboarding,
// nächster Ritual-Termin (nur `kalender-bezug`). „Was hängt“ zuerst: überfällige Willkommensmails, überfällige Freigaben, „wartet auf euch“
// über 7 Tage, Puls an oder unter der Schwelle, Report über 14 Tage, Art.-14-Frist bald, überfällige Schritte. Rein und client-sicher.

import type { DossierKurz, Fall, KundeKurz } from '../typen';
import { aktuellerKnoten, fallFortschritt, tageZwischen, wartetAufEuch, pulsStufe } from '../regeln';
import type { OnboardingStand } from './onboarding';
import { fallReise, reiseKurz, type ReiseKurzPhase } from './reise';
import { wertDurchschnitt } from './wert';
import { WEG } from '@/lib/wege';

export type HaengerArt = 'willkommen' | 'freigabe' | 'wartet' | 'puls' | 'report' | 'art14' | 'faellig';
export interface Haenger { art: HaengerArt; mandatId: string; kunde: string; text: string; schwere: 'rot' | 'gelb'; href: string; seit?: string }
export interface CockpitZeile {
  mandatId: string; kunde: string; titel: string; paket?: string; status: Fall['status'];
  phase?: string; schritt?: string; fortschritt: number;
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
}
export interface CockpitEingabe {
  fall: Fall; kunde: string; titel: string; paket?: string;
  onboarding: OnboardingStand;
  kunde2?: KundeKurz; dossier?: DossierKurz;
  health: 'gruen' | 'gelb' | 'rot' | null;
  report: { faellig: boolean; letzter?: string };
  naechsterRitual?: string;
  pulsSchwelle: number; heute: string;
}

export const WARTET_ALT_TAGE = 7;
export const REPORT_ALT_TAGE = 14;

/** Was an einem Fall hängt — die Regeln aus 6.3, je mit Sprung in den passenden Reiter. */
export function wasHaengt(e: CockpitEingabe): Haenger[] {
  const { fall: f, heute } = e;
  const raus: Haenger[] = [];
  const h = (art: HaengerArt, text: string, schwere: 'rot' | 'gelb', href: string, seit?: string) => raus.push({ art, mandatId: f.mandatId, kunde: e.kunde, text, schwere, href, ...(seit ? { seit } : {}) });
  if (f.status !== 'abgeschlossen' && e.onboarding.willkommen.ueberfaellig) h('willkommen', 'Willkommensmail überfällig (24 Stunden nach der Unterschrift)', 'rot', WEG.fall(f.mandatId), e.onboarding.willkommen.faellig?.slice(0, 10));
  for (const k of f.knoten) {
    if (k.status === 'erledigt' || k.status === 'entfaellt' || !k.faelligAm || k.faelligAm >= heute) continue;
    if (k.freigabe && !f.freigaben[k.freigabe]) h('freigabe', `Freigabe ${k.freigabe} „${k.titel}“ überfällig`, 'rot', WEG.fall(f.mandatId, 'ablauf'), k.faelligAm);
    else if (!k.id.startsWith('fk-ob-willkommen')) h('faellig', `„${k.titel}“ überfällig`, 'gelb', WEG.fall(f.mandatId, 'ablauf'), k.faelligAm);
  }
  for (const w of wartetAufEuch(f, heute)) if ((w.tage ?? 0) > WARTET_ALT_TAGE) h('wartet', `Wartet seit ${w.tage} Tagen auf den Kunden: ${w.titel}`, 'gelb', WEG.fall(f.mandatId), w.seit);
  const p = e.kunde2?.letzterPuls;
  if (p && pulsStufe(p.wert, e.pulsSchwelle) === 'kritisch') h('puls', `Kunden-Puls ${p.wert} von 10 — Gespräch anbieten`, 'rot', WEG.fall(f.mandatId, 'kunde'), p.am);
  if (e.report.faellig && f.status !== 'abgeschlossen') {
    const t = e.report.letzter ? tageZwischen(e.report.letzter, heute) : undefined;
    if (t === undefined || t > REPORT_ALT_TAGE) h('report', t === undefined ? 'Noch kein Report gesendet' : `Letzter Report vor ${t} Tagen`, 'gelb', WEG.fall(f.mandatId, 'kunde'), e.report.letzter);
  }
  if ((e.dossier?.art14Bald ?? 0) > 0) h('art14', `Art.-14-Hinweis bald fällig (${e.dossier!.art14Bald})`, 'rot', WEG.fall(f.mandatId, 'analyse'));
  return raus.sort((a, b) => (a.schwere === b.schwere ? (a.seit ?? '9') < (b.seit ?? '9') ? -1 : 1 : a.schwere === 'rot' ? -1 : 1));
}

export function cockpitZeile(e: CockpitEingabe): CockpitZeile {
  const a = aktuellerKnoten(e.fall);
  const w = wartetAufEuch(e.fall, e.heute);
  const p = e.kunde2?.letzterPuls;
  return {
    mandatId: e.fall.mandatId, kunde: e.kunde, titel: e.titel, ...(e.paket ? { paket: e.paket } : {}), status: e.fall.status,
    ...(a.phase ? { phase: a.phase.titel } : {}), ...(a.schritt ? { schritt: a.schritt.titel } : {}), fortschritt: fallFortschritt(e.fall),
    wartet: w.length, ...(w[0]?.tage !== undefined ? { wartetAeltesterTage: w[0].tage } : {}),
    health: e.health, report: e.report,
    ...(p ? { puls: p } : {}), pulsKritisch: !!p && pulsStufe(p.wert, e.pulsSchwelle) === 'kritisch', pulsOffen: !!e.kunde2?.pulsOffen, link: e.kunde2?.link ?? 'aus',
    analyse: e.dossier ?? null,
    onboarding: { offen: e.onboarding.offen, fertig: e.onboarding.fertig, willkommenUeberfaellig: e.onboarding.willkommen.ueberfaellig },
    ...(e.naechsterRitual ? { naechsterRitual: e.naechsterRitual } : {}),
    haengt: wasHaengt(e),
    phasen: reiseKurz(fallReise(e.fall, [], e.heute)),
    wert: wertDurchschnitt(e.fall.wertKonto ?? {}),
  };
}

/** Alle Hänger über alle Fälle — rot zuerst, älteste zuerst. */
export const allesWasHaengt = (zeilen: readonly CockpitZeile[]): Haenger[] =>
  zeilen.flatMap(z => z.haengt).sort((a, b) => (a.schwere === b.schwere ? (a.seit ?? '9') < (b.seit ?? '9') ? -1 : 1 : a.schwere === 'rot' ? -1 : 1));
