// ─── Fulfillment · Prozesse — Schnittstellen und Server-Wege (Server; Paket C1, 10.10.) ────────────────────────────────────────────────
// FULFILLMENT_KONZEPT.md Abschnitt 11 (C1): die festen Signaturen aus C0 (`fallLesen`, `faelleKurz`, `prozesseMorgenlauf`, `prozesseFristen`,
// `stakeholderAuskunft`, `PROZESSE_STAPEL`) — C2/C3 und die Hub-Dateien (morgenlauf.ts, fristen-server.ts, auskunft.ts, stapel.ts) rufen genau diese.
// Dazu: die Zeilen des Mandats-Cockpits (`cockpitDaten`), die Säule „Fulfillment“ im Business-Index (`ffKennzahlenFuerIndex` → null ohne Fall:
// der Index bleibt exakt der bisherige) und die Ansichten der Routen. Lesen schreibt nie; geschrieben wird nur über fall-server.ts bzw.
// `fulfillmentAendern`. Der Morgenlauf legt NUR Vorschläge in den Stapel (Onboarding starten, Nachsorge) — verschickt wird nichts.

import type { PersonMerkmale } from '@/lib/crm/person-weitere';
import type { StapelArtFreigabe } from '@/lib/zoe/stapel-arten';
import type { Vorschlag } from '@/lib/zoe/stapel';
import type { CrmBestand, FollowUp, Mandat } from '@/lib/crm/typen';
import type { DossierKurz, Fall, FallKurz, FristenKontext, KundeKurz, MorgenlaufTeil, StakeholderAuskunft, VorlagenDatei } from '../typen';
import type { ProduktProzessKurz } from '@/lib/prozesse/produkt-ablauf';
import { eintragStand, fulfillmentAendern, fulfillmentHaushalt, fulfillmentLesen } from '../speicher';
import { istBusinessMandat, mandatsEnde, onboardingKandidaten, unterschriftAm, wartetAufEuch, markeOnboardingAus, MARKE_FULFILLMENT_SEIT } from '../regeln';
import { STAPEL_GRUPPE } from '../grenzen';
import { localDay } from '@/lib/zeit';
import { tagPlus } from '@/lib/kalender/zeit';
import { fallUmfeld, ableitungFuer, fallStartenServer, FallFehler } from './fall-server';
import { fallFreigaben } from './fall';
import { fallWirksam, onboardingStand, onboardingZaehlung, willkommenUhr } from './onboarding';
import { cockpitZeile, handgriffKnoten, type CockpitZeile, type HaengerArt } from './cockpit';
import { ffIndexZeile, type FfIndexDaten } from './kennzahlen';
import { naechsterFallTermin } from './rituale';
import { fallStelle } from './reise';
import { kundenAmpel, type Ampel } from './darstellung';
import { nachsorgeFaellig, markeNachsorge, NACHSORGE_TEXT, type NachsorgeArt } from './wirkung';
import { vorlageFuerProdukt } from './vorlagen-anwenden';
import { fnv } from './pruefen';
import { ABLAUF_WERKZEUG_NACHRICHT, aktiveKnoten } from './ausfuehrung';
import { verwaisteFaelleOrdnen } from './verwaist';

/** Der Fall eines Mandats, wie er wirkt (Onboarding-Schritte abgeleitet) — null, wenn es keinen gibt. Nur lesend. */
export async function fallLesen(mandatId: string): Promise<Fall | null> {
  const { crm, vorlagen, faelle, kunde, termine } = await fallUmfeld([mandatId]);
  const f = faelle.faelle[mandatId];
  if (!f) return null;
  const m = crm.mandate.find(x => x.id === mandatId);
  return fallWirksam(f, ableitungFuer(f, m, crm, vorlagen, kunde[mandatId], new Date().toISOString(), termine[mandatId]));
}

/** Kurzform je Fall (Schlüssel = Mandat-Kennung). Ohne Angabe: alle Fälle. */
export async function faelleKurz(mandatIds?: readonly string[]): Promise<Record<string, FallKurz>> {
  const { crm, vorlagen, faelle, kunde, termine } = await fallUmfeld(mandatIds);
  const jetzt = new Date().toISOString(), heute = localDay();
  const raus: Record<string, FallKurz> = {};
  for (const f of Object.values(faelle.faelle)) {
    if (mandatIds && !mandatIds.includes(f.mandatId)) continue;
    const m = crm.mandate.find(x => x.id === f.mandatId);
    const abl = ableitungFuer(f, m, crm, vorlagen, kunde[f.mandatId], jetzt, termine[f.mandatId]);
    const w = fallWirksam(f, abl);
    const st = onboardingStand(f, abl);
    // Phase und „Als Nächstes“ aus der EINEN Rechnung (`fallStelle`) — wie Fall-Kopf, Cockpit, Landkarte und Kunden-Seite (14.10.).
    const stelle = fallStelle(w, fallFreigaben(f, vorlagen.prozesse), heute);
    const wa = wartetAufEuch(w, heute);
    raus[f.mandatId] = {
      mandatId: f.mandatId, status: w.status, ...(stelle.phase ? { phase: stelle.phase.titel } : {}), fortschritt: stelle.fortschritt,
      ...(stelle.naechster ? { naechster: stelle.naechster.titel, naechsterLage: { wartetAuf: stelle.naechster.wartetAuf, ...(stelle.naechster.faelligAm ? { faelligAm: stelle.naechster.faelligAm } : {}), ueberfaellig: stelle.naechster.ueberfaellig } } : {}),
      wartet: wa.length, ...(wa[0]?.tage !== undefined ? { wartetAeltesterTage: wa[0].tage } : {}),
      // EINE Zählung mit dem Fall (18.10., L1b N11): offen = alle Schritte minus erfüllte/entfallene — wie „Onboarding 3 von 8“.
      onboardingOffen: (z => z.gesamt - z.erledigt)(onboardingZaehlung(st.schritte)), onboardingErfuellt: onboardingZaehlung(st.schritte).erledigt, willkommenUeberfaellig: st.willkommen.ueberfaellig,
      ...(f.onboarding?.kickoffAm ? { kickoffVermerktAm: f.onboarding.kickoffAm } : {}),
    };
  }
  return raus;
}

// ── Cockpit und Business-Index ─────────────────────────────────────────────────────────────────────────────────────────────────────

async function sicher<T>(f: () => Promise<T>, ersatz: T): Promise<T> { try { return await f(); } catch { return ersatz; } }

/**
 * Die Zeilen des Mandats-Cockpits (laufende Fälle von Mandaten einer Business-Gesellschaft). Leer ohne Fall. `nur` = nur dieses Mandat (für die
 * Kunden-Seite und den Report: dieselbe Rechnung „was hängt“ wie intern, `haengerFuer`).
 */
export async function cockpitDaten(heute = localDay(), jetzt = new Date().toISOString(), nur?: string): Promise<{ zeilen: (CockpitZeile & { gesellschaft: string })[]; vorlagen: VorlagenDatei }> {
  // Zwischengespeichert (17.10., Gesamtprüfung L2 B3): das Cockpit rechnete je Anfrage mehrfach (Route + Treppe + jede Fall-Seite) — jede Schreibung über
  // local-db leert den Speicher, `jetzt` rückt höchstens 30 s nach.
  const { merken } = await import('@/lib/store/memo');
  return merken(`ff-cockpit:${await fulfillmentHaushalt()}:${heute}:${nur ?? '*'}`, 30_000, () => cockpitRechnen(heute, jetzt, nur));
}

async function cockpitRechnen(heute: string, jetzt: string, nur?: string): Promise<{ zeilen: (CockpitZeile & { gesellschaft: string })[]; vorlagen: VorlagenDatei }> {
  const { crm, vorlagen, faelle, kunde, termine: kalender } = await fallUmfeld(nur ? [nur] : undefined);
  const laufend = Object.values(faelle.faelle).filter(f => f.status !== 'abgeschlossen' && (!nur || f.mandatId === nur));
  if (!laufend.length) return { zeilen: [], vorlagen };
  const ids = laufend.map(f => f.mandatId);
  const [treppe, dossiers] = await Promise.all([
    sicher(async () => (await import('@/lib/crm/treppe-server')).ladeTreppe(heute), null),
    sicher(async () => (await import('../analyse/server')).dossierKurzFuer(ids), {} as Record<string, DossierKurz>),
  ]);
  // Der nächste Termin je Fall — EINE Regel (`naechsterFallTermin`) über die EINE Lesestelle der Termine (`fallTermine`, 15.10., Abnahme B3), auch für die
  // Health „Termine“ der Leistungstreppe (14.10., Abnahme B8).
  const termine = Object.fromEntries(laufend.map(f => [f.mandatId, naechsterFallTermin({ fallRituale: f.rituale, terminTage: kalender[f.mandatId] ?? [], heute })?.tag]).filter((x): x is [string, string] => !!x[1]));
  const { kundenZeilen } = await import('@/lib/crm/treppe');
  // Stufen aus dem Katalog (19.10., lib/crm/produkt-karte.ts) — ohne Produkt-Karten genau die gespeicherten.
  const { treppeMitKatalog } = await import('@/lib/crm/produkt-karte');
  const kz = treppe ? kundenZeilen({ datei: treppeMitKatalog(treppe, crm.leistungen), crm, heute, termine, reportTage: await (await import('@/lib/prozesse/stellschrauben-werte-server')).reportTageWirksam() }) : [];
  const { kundenGesperrt } = await import('./bausteine');
  const gesperrt = kundenGesperrt(vorlagen.bausteine, vorlagen);
  // „Heute im Fulfillment“ (17.10. spät): trägt ein Knoten einen Mail-Baustein, ist sein Handgriff „Entwurf öffnen“ — dieselbe Regel wie die Ausführung.
  const { mailBausteinVon } = await import('./ausfuehrung-server');
  const zeilen: (CockpitZeile & { gesellschaft: string })[] = [];
  for (const f of laufend) {
    const m = crm.mandate.find(x => x.id === f.mandatId && !x.geloeschtAm);
    if (!m || !istBusinessMandat(m.gesellschaft)) continue;
    const abl = ableitungFuer(f, m, crm, vorlagen, kunde[m.id], jetzt, kalender[m.id]);
    const w = fallWirksam(f, abl);
    const z = kz.find(x => x.mandatId === m.id);
    const naechster = termine[m.id];
    const v = vorlagen.prozesse.find(p => p.id === f.vorlageId);
    const zeile = cockpitZeile({
        fall: w, kunde: m.kunde, titel: m.titel, paket: v?.titel, ...(v ? { freigaben: fallFreigaben(f, vorlagen.prozesse) } : {}),
        onboarding: onboardingStand(f, abl), ...(kunde[m.id] ? { kunde2: kunde[m.id] } : {}), ...(dossiers[m.id] ? { dossier: dossiers[m.id] } : {}),
        health: z?.ampel.gesamt ?? null, report: { faellig: z?.report.faellig ?? false, ...(z?.report.gesendetAm || z?.report.letzter ? { letzter: z?.report.gesendetAm ?? z?.report.letzter } : {}) },
        ...(naechster ? { naechsterRitual: naechster } : {}), pulsSchwelle: vorlagen.einstellungen.pulsSchwelle, heute, gesperrt,
        mitMail: k => !!mailBausteinVon(k, w.knoten, vorlagen),
      });
    // Stand der gespeicherten Knoten, die die Handgriffe ändern (Schreibwege B3) — derselbe Stand, den der Schreibweg des Falls prüft.
    const ids = new Set(handgriffKnoten(zeile));
    const knotenStand = Object.fromEntries(f.knoten.filter(k => ids.has(k.id)).map(k => [k.id, { stand: eintragStand(k), status: k.status }]));
    zeilen.push({ ...zeile, ...(Object.keys(knotenStand).length ? { knotenStand } : {}), ...(m.zustaendig ? { zustaendig: m.zustaendig } : {}), gesellschaft: m.gesellschaft });
  }
  return { zeilen, vorlagen };
}

/**
 * Was an EINEM Fall hängt — dieselbe Rechnung wie das Cockpit (`wasHaengt`), für die Kunden-Seite und den Report: dort nur in Worten übersetzt
 * (lib/fulfillment/kunde/bild.ts `kundenLage`), nie die Texte selbst. Je Hänger Art, Schwere und wie viele Tage er schon hängt. Fehler → null.
 */
export async function haengerFuer(mandatId: string, heute = localDay()): Promise<{ art: HaengerArt; schwere: 'rot' | 'gelb'; tage?: number; kundeSieht?: boolean }[] | null> {
  try {
    const { tageZwischen } = await import('../regeln');
    const { zeilen } = await cockpitDaten(heute, new Date().toISOString(), mandatId);
    const z = zeilen.find(x => x.mandatId === mandatId);
    if (!z) return null;
    return z.haengt.map(h => { const t = h.seit ? tageZwischen(h.seit, heute) : undefined; return { art: h.art, schwere: h.schwere, ...(t !== undefined ? { tage: t } : {}), ...(h.kundeSieht !== undefined ? { kundeSieht: h.kundeSieht } : {}) }; });
  } catch { return null; }
}

/** Was die Leistungstreppe je Mandat aus dem Fall übernimmt (15.10., Abnahme B1) — Ampel, was der Kunde sieht, Phase, nächster Schritt. */
export interface FallFuerTreppe {
  ampel: Ampel; kundeSieht?: CockpitZeile['kundeSieht']; phase?: string; phaseNr?: number; phasenAnzahl?: number; schritt?: string;
  /** Kick-off vermerkt ohne eigenen Kalender-Termin (Tag; `Fall.onboarding.kickoffAm`) — Text über `kickoffVermerkText` (18.10., L1b N13). */
  kickoffVermerktAm?: string;
}
/**
 * Für die Leistungstreppe: je laufendem Fall die Ampel (Hänger + Health — dieselbe wie Fall-Kopf und Landkarte), was der Kunde sieht, und der nächste
 * Schritt (`naechsterPunkt` — derselbe wie Fall-Kopf, Kunden-Seite und Report). Ohne Fall fehlt das Mandat. Fehler → {}.
 */
export async function fallFuerTreppe(heute = localDay()): Promise<Record<string, FallFuerTreppe>> {
  try {
    const { zeilen } = await cockpitDaten(heute);
    return Object.fromEntries(zeilen.map(z => [z.mandatId, { ampel: kundenAmpel(z), ...(z.kundeSieht ? { kundeSieht: z.kundeSieht } : {}), ...(z.phase ? { phase: z.phase, ...(z.phaseNr ? { phaseNr: z.phaseNr } : {}), ...(z.phasenAnzahl ? { phasenAnzahl: z.phasenAnzahl } : {}) } : {}), ...(z.schritt ? { schritt: z.schritt } : {}), ...(z.kickoffVermerktAm ? { kickoffVermerktAm: z.kickoffVermerktAm } : {}) }]));
  } catch { return {}; }
}

/** Der nächste Termin je laufendem Fall (Mandat → Tag) — EINE Regel `naechsterFallTermin`; für die Health „Termine“ der Leistungstreppe. Fehler → {}. */
export async function naechsteFallTermine(heute = localDay()): Promise<Record<string, string>> {
  try {
    const faelle = await fulfillmentLesen('faelle');
    const laufend = Object.values(faelle.faelle).filter(f => f.status !== 'abgeschlossen');
    const { ladeCrm } = await import('@/lib/crm/speicher');
    const crm = await ladeCrm();
    const mandate = laufend.map(f => crm.mandate.find(m => m.id === f.mandatId)).filter((m): m is Mandat => !!m).map(m => ({ id: m.id, firmaId: m.firmaId ?? null }));
    const kalender = await (await import('./termine-server')).fallTermine(mandate, heute);
    return Object.fromEntries(laufend.map(f => [f.mandatId, naechsterFallTermin({ fallRituale: f.rituale, terminTage: kalender[f.mandatId] ?? [], heute })?.tag])
      .filter((x): x is [string, string] => !!x[1]));
  } catch { return {}; }
}

/**
 * Die Säule „Fulfillment“ des Business-Index: je laufendem Fall nur Summen (Health-Ampel, Hänger, letzter Puls, Wert-Konto). Ohne Fall
 * (oder bei einem Lesefehler) null — dann zählt die Säule nicht und der Index ist exakt der bisherige.
 */
export async function ffKennzahlenFuerIndex(heute = localDay()): Promise<FfIndexDaten | null> {
  try {
    const { zeilen } = await cockpitDaten(heute);
    if (!zeilen.length) return null;
    const faelle = await fulfillmentLesen('faelle');
    return {
      heute,
      zeilen: zeilen.map(z => ffIndexZeile({
        // 17.10. (dritte Abnahme B3): „Lage der Fälle“ = DIESELBE Ampel wie Landkarte, Lage-Zeile und Fall-Kopf (`kundenAmpel`: was hängt + Kunden-Gesundheit) —
        // vorher die Gesundheits-Ampel der Leistungstreppe allein (Index „grün“, Fulfillment „braucht Aufmerksamkeit“).
        fall: faelle.faelle[z.mandatId], gesellschaft: z.gesellschaft, kunde: z.kunde, health: kundenAmpel(z), haengt: z.haengt.map(h => h.text),
        ...(z.puls ? { puls: z.puls } : {}),
      })),
    };
  } catch { return null; }
}

// ── Morgenlauf: Onboarding-Vorschläge und Nachsorge (3.1, 5.3) ─────────────────────────────────────────────────────────────────────

export const markeOnboardingVorschlag = (mandatId: string) => `onboarding-vorschlag:${mandatId}`;
export const WERKZEUG = { onboarding: 'fulfillment_onboarding', nachsorge: 'fulfillment_nachsorge', nachricht: ABLAUF_WERKZEUG_NACHRICHT } as const;

/** Für wen ein Vorschlag ist: die zuständige Person des Mandats, wenn sie im Haushalt ist — sonst ohne Person (der Haushalt sieht ihn). */
async function zustaendigePerson(m: Pick<Mandat, 'zustaendig'>): Promise<string | undefined> {
  const { haushaltsPersonen } = await import('@/lib/aufgaben/sicht');
  const p = (await haushaltsPersonen()).map(x => x.speicher);
  return m.zustaendig && p.includes(m.zustaendig) ? m.zustaendig : undefined;
}
async function empfaenger(m: Pick<Mandat, 'zustaendig'>): Promise<string[]> {
  const p = await zustaendigePerson(m);
  if (p) return [p];
  const { haushaltsPersonen } = await import('@/lib/aufgaben/sicht');
  return (await haushaltsPersonen()).map(x => x.speicher);
}

/** Was die Prozesse (Lauf-Motor) von einem Fall wissen dürfen (22.10., Begleit-Prozesse B1): nur Kennung des Pakets, Status und der nächste Termin mit dem Kunden. */
export interface FallFuerProzesse {
  paket: string; status: Fall['status']; termin?: string;
  /**
   * Begleit-Vorlagen (22.10., B2) — die Lage des Falls für die Rauten der Kunden-Begleitung, ALLES aus derselben Cockpit-Zeile (keine zweite Rechnung): aktuelle
   * Etappe (fehlt = keine Etappe mehr offen), Punkte, die auf den Kunden warten, und ob eine Bestätigung / die Willkommensmail überfällig bzw. der Report fällig
   * ist (dieselben Hänger wie „Heute im Fulfillment“), Puls kritisch und ob das Puls-Gespräch des Fulfillments (`k:puls:`) noch offen im Stapel liegt.
   */
  phase?: string; wartetKunde: number; bestaetigungOffen: boolean; willkommenOffen: boolean; reportFaellig: boolean; pulsKritisch: boolean; pulsGespraechOffen: boolean;
}
/**
 * Je laufendem Fall eines Business-Mandats Paket, Status und nächster Termin mit dem Kunden — aus DERSELBEN Rechnung wie das Cockpit (`cockpitDaten`:
 * `naechsterFallTermin`), keine zweite Fristen- oder Terminrechnung. Gelesen vom Motor (Fall-Felder `fall.paket`/`fall.status`, Datums-Auslöser `fall.termin`).
 */
export async function faelleFuerProzesse(heute = localDay()): Promise<Record<string, FallFuerProzesse>> {
  const [{ zeilen }, faelle, puls] = await Promise.all([cockpitDaten(heute), fulfillmentLesen('faelle'), pulsGespraecheOffen()]);
  return Object.fromEntries(zeilen.map(z => [z.mandatId, {
    paket: faelle.faelle[z.mandatId]?.vorlageId ?? '', status: z.status, ...(z.naechsterRitual ? { termin: z.naechsterRitual } : {}),
    ...(z.phase ? { phase: z.phase } : {}), wartetKunde: z.wartet, bestaetigungOffen: z.haengt.some(h => h.art === 'freigabe'),
    willkommenOffen: z.onboarding.willkommenUeberfaellig, reportFaellig: z.haengt.some(h => h.art === 'report'), pulsKritisch: z.pulsKritisch, pulsGespraechOffen: puls.has(z.mandatId),
  } satisfies FallFuerProzesse]));
}
/** Mandate mit offenem Puls-Gespräch im Stapel (Vorschlag `k:puls:` aus lib/fulfillment/kunde/server.ts) — ohne Stapel leer, wirft nie. */
async function pulsGespraecheOffen(): Promise<Set<string>> {
  try {
    const { lies } = await import('@/lib/zoe/stapel');
    return new Set((await lies('offen')).filter(v => v.bezug?.art === 'fulfillment' && v.bezug.id.startsWith('k:puls:') && typeof v.eingabe?.mandatId === 'string').map(v => v.eingabe.mandatId as string));
  } catch { return new Set(); }
}

/** Begleit-Prozesse (22.10., B1): jeder Hänger eines laufenden Falls als Ereignis `fall-haengt` — DIESELBE Rechnung wie Cockpit und „Heute im Fulfillment“ (`wasHaengt`). */
async function begleitHaenger(heute: string): Promise<number> {
  const [{ zeilen }, faelle, { ladeCrm }, { fallHaengtEreignisse }] = await Promise.all([cockpitDaten(heute), fulfillmentLesen('faelle'), import('@/lib/crm/speicher'), import('@/lib/ereignisse/quellen')]);
  if (!zeilen.some(z => z.haengt.length)) return 0;
  const crm = await ladeCrm();
  return fallHaengtEreignisse(zeilen.flatMap(z => {
    const m = crm.mandate.find(x => x.id === z.mandatId);
    const vorlageId = faelle.faelle[z.mandatId]?.vorlageId;
    return m && z.haengt.length ? [{ m, ...(vorlageId ? { vorlageId } : {}), haengt: z.haengt.map(x => ({ art: x.art, ...(x.knotenId ? { knotenId: x.knotenId } : {}), ...(x.seit ? { seit: x.seit } : {}) })) }] : [];
  }));
}

export async function prozesseMorgenlauf(h: string, heute: string): Promise<MorgenlaufTeil> {
  // Ausführung der Abläufe (17.10. abends) zuerst — Erinnerungen nach ihrer Frist, Glocken bei offenen Entscheidungen, Aufgaben der Schritte. Idempotent
  // (Marken im Fall), wirft nie; ohne Fall mit Ablauf passiert nichts. Danach Onboarding-Vorschläge und Nachsorge wie bisher.
  const ablauf = await (await import('./ausfuehrung-server')).ablaufMorgenlauf(heute);
  // Begleit-Prozesse (22.10., B1): die Hänger als Ereignisse — nur gemeldet (nur Kennungen), wirkt nur, wenn ein Begleit-Prozess darauf hört. Wirft nie.
  await begleitHaenger(heute).catch(() => 0);
  // Ablöse-Weiche (22.10., Paket Ü): den Onboarding-Vorschlag „Fall starten“ kann ein überführter Prozess der Werkstatt übernehmen (`sp-uebergabe`) — hier wird
  // die Weiche GENAU EINMAL gefragt; arbeitet der neue Weg, bleibt hier nur die Nachsorge. Ohne Überführung bit-gleich wie vorher.
  const weg = await (await import('@/lib/prozesse/ueberfuehrung-server')).wegFuer('sp-uebergabe');
  const plus = (t: MorgenlaufTeil): MorgenlaufTeil => ({ vorschlaege: t.vorschlaege + ablauf.nachrichten, ...(ablauf.aufgaben || ablauf.glocken ? { info: `Ablauf: ${ablauf.aufgaben} Aufgaben, ${ablauf.glocken} Glocken` } : {}) });
  return plus(await prozesseMorgenlaufRest(h, heute, weg));
}

/** Ein fälliger Onboarding-Vorschlag (Paket Ü, Wirkungsbild des Schatten-Vergleichs): nur Kennungen — Mandat und für wen (der Vergleich speichert nur einen Fingerabdruck). */
export interface OnboardingSoll { mandatId: string; fuer: string }
type MorgenDaten = { crm: CrmBestand; vorlagen: VorlagenDatei; faelle: { faelle: Record<string, Fall> } };

/**
 * Der Kern „Onboarding-Vorschlag“ (Paket Ü — der Morgenlauf und der feste Schritt `fall-vorschlag` rechnen hiermit): je Kandidat (`onboardingKandidaten`, ohne
 * Bestand) EIN Vorschlag „Fall starten“ + Glocke + Marke `onboarding-vorschlag:<mandat>` (die Kennungs-Brücke — idempotent). `schreiben: false` = nur rechnen.
 * Ohne `daten` (fester Schritt) liest er selbst und schlägt nichts vor, solange das Fulfillment nicht eingerichtet ist oder es erst heute wurde — wie der Morgenlauf
 * am ersten Tag. Das Soll zählt eine Marke von HEUTE nicht als „schon vorgeschlagen“ (wer heute vorschlug, war heute dran).
 */
export async function onboardingVorschlaegeKern(h: string, heute: string, o: { schreiben: boolean; daten?: MorgenDaten }): Promise<{ vorschlaege: string[]; soll: OnboardingSoll[] }> {
  let d = o.daten;
  if (!d) {
    const { ladeCrm } = await import('@/lib/crm/speicher');
    const [crm, vorlagen, faelle] = await Promise.all([ladeCrm(), fulfillmentLesen('vorlagen', h), fulfillmentLesen('faelle', h)]);
    const seit = vorlagen.marken[MARKE_FULFILLMENT_SEIT];
    if (!seit || seit >= heute) return { vorschlaege: [], soll: [] };
    d = { crm, vorlagen, faelle };
  }
  const { crm, vorlagen, faelle } = d;
  // Prozesse × Fulfillment (22.10.): ein Mandat, dessen Ablauf ein laufender Werkstatt-Prozess ist, bekommt keinen Vorschlag und keine Glocke „Fall starten“.
  const { mandateMitProduktLaufLesen } = await import('@/lib/prozesse/produkt-laeufe-server');
  const alle = onboardingKandidaten(crm, faelle.faelle, vorlagen.marken, heute, await mandateMitProduktLaufLesen(crm)).filter(k => !k.bestand);
  const vorgeschlagen = (id: string) => vorlagen.marken[markeOnboardingVorschlag(id)];
  const soll: OnboardingSoll[] = [];
  for (const k of alle) {
    const am = vorgeschlagen(k.mandatId);
    if (am && am !== heute) continue;
    const m = crm.mandate.find(x => x.id === k.mandatId)!;
    soll.push({ mandatId: m.id, fuer: (await zustaendigePerson(m)) ?? 'haushalt' });
  }
  const kandidaten = alle.filter(k => !vorgeschlagen(k.mandatId));
  if (!o.schreiben || !kandidaten.length) return { vorschlaege: [], soll };
  const { lege } = await import('@/lib/zoe/stapel');
  const { melde } = await import('@/lib/meldungen/melden');
  const { WEG } = await import('@/lib/wege');
  const vorschlaege: string[] = [];
  const neueMarken: Record<string, string> = {};
  for (const k of kandidaten) {
    const m = crm.mandate.find(x => x.id === k.mandatId)!;
    const person = await zustaendigePerson(m);
    const v = vorlageFuerProdukt(vorlagen, m.leistungId);
    const x = await lege({
      werkzeug: WERKZEUG.onboarding, gruppe: STAPEL_GRUPPE, titel: `Fall starten: ${m.kunde}`.slice(0, 200),
      nachher: v ? `Fall nach „${v.titel}“ anlegen — die Willkommensmail bereitest du danach vor, gesendet wird erst per Klick` : 'Fall anlegen — vorher dem Produkt einen Ablauf zuordnen (Produkte & Mandate › Produkte)',
      eingabe: { mandatId: m.id, ...(v ? { vorlageId: v.id } : {}) }, anlass: k.grund === 'vertrag' ? 'Vertrag unterschrieben' : k.grund === 'angebot' ? 'Angebot angenommen' : 'Deal gewonnen',
      quelle: 'lauf', bezug: { art: 'fulfillment', id: `p:onboarding:${m.id}` }, ...(person ? { person } : {}),
    });
    for (const an of await empfaenger(m)) await melde({ an, art: 'produkte', titel: 'Ein neuer Kunde ist bereit fürs Onboarding — Vorschlag im Stapel', link: WEG.fulfillment('onboarding') });
    neueMarken[markeOnboardingVorschlag(m.id)] = heute;
    vorschlaege.push(x.id);
  }
  if (Object.keys(neueMarken).length) await fulfillmentAendern('vorlagen', dd => ({ ok: true, datei: { ...dd, marken: { ...dd.marken, ...neueMarken } }, geaendert: Object.keys(neueMarken) }), { art: 'system' }, h);
  return { vorschlaege, soll };
}

async function prozesseMorgenlaufRest(h: string, heute: string, weg: import('@/lib/prozesse/ueberfuehrung').WegEntscheidung): Promise<MorgenlaufTeil> {
  const { ladeCrm } = await import('@/lib/crm/speicher');
  const [crm, vorlagen, faelle] = await Promise.all([ladeCrm(), fulfillmentLesen('vorlagen', h), fulfillmentLesen('faelle', h)]);
  // Prüf-Fund 11.10.: der ERSTE Lauf nach der Einrichtung merkt sich nur den Tag (Stichtag für „Bestand“) und legt nichts an — sonst bekäme jedes
  // laufende Mandat am ersten Morgen einen Vorschlag, eine Glocke und „Willkommensmail überfällig“.
  // Eine leere Instanz (kein Business-Mandat) schreibt nichts — die Marke entsteht beim ersten Lauf mit Mandaten.
  if (!vorlagen.marken[MARKE_FULFILLMENT_SEIT]) {
    if (crm.mandate.some(m => !m.geloeschtAm && istBusinessMandat(m.gesellschaft))) {
      await fulfillmentAendern('vorlagen', d => (d.marken[MARKE_FULFILLMENT_SEIT] ? { ok: true, datei: d, geaendert: [] } : { ok: true, datei: { ...d, marken: { ...d.marken, [MARKE_FULFILLMENT_SEIT]: heute } }, geaendert: [MARKE_FULFILLMENT_SEIT] }), { art: 'system' }, h);
    }
    return { vorschlaege: 0 };
  }
  // Onboarding-Vorschläge (Kern, Paket Ü) — nur, solange der alte Weg arbeitet; rechnet der neue im Schatten mit, meldet dieser Lauf sein Wirkungsbild.
  const ob = await onboardingVorschlaegeKern(h, heute, { schreiben: weg.weg === 'alt', daten: { crm, vorlagen, faelle } });
  if (weg.schatten) {
    const [ue, { onboardingBild }] = await Promise.all([import('@/lib/prozesse/ueberfuehrung-server'), import('@/lib/prozesse/system-schritte-server')]);
    await ue.vergleichMeldenServer('sp-uebergabe', 'alt', heute, onboardingBild(ob.soll, heute));
  }
  const enden: Record<string, string | null> = Object.fromEntries(crm.mandate.map(m => [m.id, mandatsEnde(m)]));
  const nachsorge = nachsorgeFaellig({ faelle: Object.values(faelle.faelle), enden, tage: vorlagen.einstellungen.nachsorgeTage, heute });
  let n = ob.vorschlaege.length;
  if (!nachsorge.length) return { vorschlaege: n };
  const { lege } = await import('@/lib/zoe/stapel');
  const { melde } = await import('@/lib/meldungen/melden');
  const { WEG } = await import('@/lib/wege');
  const fallMarken: Record<string, Record<string, string>> = {};
  for (const x of nachsorge) {
    const m = crm.mandate.find(y => y.id === x.mandatId);
    if (!m) continue;
    const person = await zustaendigePerson(m);
    await lege({
      werkzeug: WERKZEUG.nachsorge, gruppe: STAPEL_GRUPPE, titel: `${NACHSORGE_TEXT[x.art]}: ${m.kunde}`.slice(0, 200), vorher: `Mandat beendet (Tag +${x.tag})`,
      nachher: 'Follow-up am Mandat anlegen — gesprochen bzw. geschrieben wird erst per Klick', eingabe: { mandatId: m.id, tag: x.tag, art: x.art },
      anlass: `Nachsorge ${x.tag} Tage nach dem Mandatsende`, quelle: 'lauf', bezug: { art: 'fulfillment', id: `p:nachsorge:${m.id}:${x.tag}` }, ...(person ? { person } : {}),
    });
    // 12.10.: der Link führt dorthin, wo die Nachsorge steht (Abschluss & Kreislauf) — vorher in den Überblick, der sie nicht zeigte.
    for (const an of await empfaenger(m)) await melde({ an, art: 'produkte', titel: 'Nachsorge für einen früheren Kunden — Vorschlag im Stapel', link: WEG.fall(m.id, 'reise', 'stelle-abschluss') });
    (fallMarken[m.id] ??= {})[markeNachsorge(m.id, x.tag)] = heute;
    n++;
  }
  if (Object.keys(fallMarken).length) {
    await fulfillmentAendern('faelle', d => {
      const neu = { ...d.faelle };
      for (const [mid, mk] of Object.entries(fallMarken)) if (neu[mid]) neu[mid] = { ...neu[mid], marken: { ...neu[mid].marken, ...mk } };
      return { ok: true, datei: { ...d, faelle: neu }, geaendert: Object.keys(fallMarken) };
    }, { art: 'system' }, h);
  }
  return { vorschlaege: n };
}

// ── Löschfristen (8.1) ────────────────────────────────────────────────────────────────────────────────────────────────────────────

const plusMonate = (t: string, n: number) => { const d = new Date(`${t.slice(0, 10)}T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); };

/**
 * Stakeholder-Haltung und -Notiz 12 Monate (einstellbar) nach Mandatsende entfernen; Fälle endgültig gelöschter Mandate entfernen —
 * erst 30 Tage nach der ersten Sichtung, nie ohne ein einziges Mandat, nie mehr als die Hälfte auf einmal (`./verwaist.ts`).
 * Nur Zähler, keine Namen. Liest das CRM mit Papierkorb — ist der CRM-Bestand nicht lesbar oder fehlt er, wird nichts entfernt.
 */
export async function prozesseFristen(k: FristenKontext): Promise<Record<string, number>> {
  const { loadJson } = await import('@/lib/store/local-db');
  if ((await loadJson<unknown>('crm')) === null) return {};
  const { ladeCrmMitPapierkorb } = await import('@/lib/crm/speicher');
  const crm = await ladeCrmMitPapierkorb();
  const h = await fulfillmentHaushalt();
  let haltung = 0, weg = 0;
  await fulfillmentAendern('faelle', d => {
    // Verwaiste Fälle (17.10., L2 B5): erst markieren, nach `VERWAIST_TAGE` entfernen, Bremse ohne Mandate bzw. bei zu vielen auf einmal.
    const v = verwaisteFaelleOrdnen(d.faelle, new Set(crm.mandate.map(x => x.id)), k.heute);
    if (v.gebremst) console.error(`[loeschfristen] fulfillment-faelle: gebremst (${v.gebremst}) — kein Fall entfernt`);
    weg = v.weg;
    const neu: typeof d.faelle = {};
    for (const [mid, f] of Object.entries(v.faelle)) {
      const m = crm.mandate.find(x => x.id === mid);
      const ende = m ? mandatsEnde(m) : null;
      if (ende && plusMonate(ende, k.fristen.mandatsdatenMonate) <= k.heute && f.stakeholder.some(s => s.haltung || s.notiz)) {
        neu[mid] = { ...f, stakeholder: f.stakeholder.map(s => { if (!s.haltung && !s.notiz) return s; haltung++; const { haltung: _h, notiz: _n, ...r } = s; return r; }) };
      } else neu[mid] = f;
    }
    return { ok: true, datei: { ...d, faelle: neu }, geaendert: [] };
  }, { art: 'system' }, h);
  return { ...(haltung ? { 'fulfillment-stakeholder-haltung': haltung } : {}), ...(weg ? { 'fulfillment-faelle-verwaist': weg } : {}) };
}

/** Art. 15: Stakeholder-Einträge, die die Person (Kontakt-Kennung) betreffen. */
export async function stakeholderAuskunft(m: PersonMerkmale): Promise<StakeholderAuskunft[]> {
  const faelle = await fulfillmentLesen('faelle');
  return Object.values(faelle.faelle).flatMap(f => f.stakeholder.filter(s => s.kontaktId === m.id).map(s => ({
    mandatId: f.mandatId, rolle: s.rolle, einfluss: s.einfluss, ...(s.haltung ? { haltung: s.haltung } : {}), ...(s.notiz ? { notiz: s.notiz } : {}),
  })));
}

// ── Freigabe-Stapel, Präfix `p:` ─────────────────────────────────────────────────────────────────────────────────────────────────

type Erg = Awaited<ReturnType<StapelArtFreigabe['freigeben']>>;
const NACHSORGE_ARTEN: readonly NachsorgeArt[] = ['checkin', 'empfehlung', 'stufe'];

/** Follow-up der Nachsorge am Mandat (idempotent über die Kennung). */
function nachsorgeFollowup(b: CrmBestand, m: Mandat, art: NachsorgeArt, tag: number, person: string, jetzt: Date): CrmBestand {
  const id = `fu-ff-${fnv(`${m.id}|${tag}`)}`;
  if ((b.followups ?? []).some(f => f.id === id)) return b;
  const iso = jetzt.toISOString();
  const fu = {
    id, bezug: { art: 'mandat', id: m.id }, ...(m.kontaktIds[0] ? { kontaktId: m.kontaktIds[0] } : {}), art: art === 'checkin' ? 'anruf' : 'termin',
    text: NACHSORGE_TEXT[art], faellig: tagPlus(localDay(jetzt), 2), zustaendig: m.zustaendig ?? person, status: 'offen', quelle: 'head',
    angelegt: iso, geaendert: iso, geaendertVon: person,
  } as unknown as FollowUp;
  return { ...b, followups: [...(b.followups ?? []), fu] };
}

export const PROZESSE_STAPEL: StapelArtFreigabe = {
  freigeben: async (vIn, person, opt): Promise<Erg> => {
    const { personImHaushaltDesInhabers } = await import('@/lib/zugang/haushalt-inhaber');
    if (!(await personImHaushaltDesInhabers(person))) return { ok: false, status: 403, fehler: 'Nur im Haushalt des Inhabers.' };
    const { beanspruche, entscheide, loslassen } = await import('@/lib/zoe/stapel');
    const a = await beanspruche(vIn.id, person, v => {
      if (v.bezug?.art !== 'fulfillment' || !v.bezug.id.startsWith('p:') || !Object.values(WERKZEUG).includes(v.werkzeug as typeof WERKZEUG[keyof typeof WERKZEUG])) return { status: 404, fehler: 'Vorschlag nicht gefunden.' };
      if (v.person && v.person !== person) return { status: 403, fehler: 'Nur die Person, für die der Vorschlag vorbereitet wurde, gibt ihn frei.' };
      return null;
    });
    if (!a.ok) return { ok: false, status: a.status, fehler: a.fehler };
    const v: Vorschlag = a.v;
    try {
      const mandatId = String(v.eingabe.mandatId ?? '');
      let text = '';
      if (v.werkzeug === WERKZEUG.nachricht) {
        // Ausführung (17.10. abends): „freigeben“ heißt „Entwurf geprüft“ — gesendet wird NIE hier, nur im Fall per Klick (Senden über /api/inbox/senden).
        const f = await fallLesen(mandatId); // wie er wirkt (Onboarding abgeleitet) — sonst stünde die Ausführung noch im Onboarding
        const knotenId = String(v.eingabe.knotenId ?? '');
        const runde = Number(v.eingabe.runde) || 0;
        const laeuft = !!f && aktiveKnoten(f).some(x => x.knoten.id === knotenId && (x.art === 'nachricht' ? runde === 0 : x.runde === runde));
        const { WEG } = await import('@/lib/wege');
        text = laeuft
          ? `Entwurf geprüft — im Fall öffnen und mit „Senden“ verschicken (${WEG.fall(mandatId, 'reise', `schritt-${knotenId}`)}). Gesendet wird nur dort per Klick.`
          : 'Der Schritt ist im Fall schon erledigt bzw. entfällt — nichts mehr zu tun.';
        await entscheide(v.id, 'freigegeben', { ergebnis: text, von: person, ausArbeit: true });
        return { ok: true, text };
      }
      if (v.werkzeug === WERKZEUG.onboarding) {
        const faelle = await fulfillmentLesen('faelle');
        if (faelle.faelle[mandatId]) text = 'Für dieses Mandat läuft schon ein Fall — nichts doppelt angelegt.';
        else {
          const vorlageId = (typeof opt.eingabe?.vorlageId === 'string' ? opt.eingabe.vorlageId : undefined) ?? (typeof v.eingabe.vorlageId === 'string' ? v.eingabe.vorlageId : undefined) ?? await (async () => {
            const { ladeCrm } = await import('@/lib/crm/speicher');
            const m = (await ladeCrm()).mandate.find(x => x.id === mandatId);
            return vorlageFuerProdukt(await fulfillmentLesen('vorlagen'), m?.leistungId)?.id;
          })();
          if (!vorlageId) { await loslassen(v.id); return { ok: false, status: 409, fehler: 'Erst dem Produkt einen Ablauf zuordnen (Produkte & Mandate › Produkte) — oder in „Heute im Fulfillment“ bzw. am Deal „Fall starten“ und den Ablauf wählen.' }; }
          await fallStartenServer({ mandatId, vorlageId, person });
          text = 'Fall angelegt — unter Fulfillment › Fall: Willkommensmail vorbereiten (gesendet wird erst per Klick).';
        }
      } else {
        const art = NACHSORGE_ARTEN.includes(v.eingabe.art as NachsorgeArt) ? v.eingabe.art as NachsorgeArt : 'checkin';
        const tag = Number(v.eingabe.tag) || 0;
        const { ladeCrm, aendereCrm } = await import('@/lib/crm/speicher');
        const m = (await ladeCrm()).mandate.find(x => x.id === mandatId);
        if (!m) { await loslassen(v.id); return { ok: false, status: 404, fehler: 'Dieses Mandat gibt es nicht (mehr).' }; }
        const jetzt = new Date();
        await aendereCrm(b => nachsorgeFollowup(b, m, art, tag, person, jetzt), { art: 'person', person });
        text = `Follow-up „${NACHSORGE_TEXT[art]}“ am Mandat angelegt (in zwei Tagen fällig).`;
      }
      await entscheide(v.id, 'freigegeben', { ergebnis: text, von: person, ausArbeit: true });
      return { ok: true, text };
    } catch (e) {
      await loslassen(v.id);
      if (e instanceof FallFehler) return { ok: false, status: e.status, fehler: e.message };
      throw e;
    }
  },
};

// ── Ansichten der Routen ───────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Onboarding-Kandidaten mit Uhr und vorgeschlagener Vorlage (für Produkte & Mandate und Fulfillment › Onboarding). `mitProzessLauf` (22.10.): Mandate, deren Ablauf
 * ein laufender Prozess der Werkstatt ist (`mandateMitProduktLaufLesen`) — sie fehlen; ohne Angabe wie vorher.
 */
export function kandidatenAnsicht(crm: Pick<CrmBestand, 'mandate' | 'angebote' | 'chancen'>, vorlagen: VorlagenDatei, faelle: Record<string, Fall>, heute: string, jetzt: string, mitProzessLauf?: ReadonlySet<string>,
  /** 24.10. (Bau-Test Kern): je Produkt sein Werkstatt-Prozess (`produktProzesseLesen`) — er ist der Ablauf des Falls (Vorbelegung `prozess`, lib/prozesse/produkt-ablauf.ts). */
  produktProzesse?: Readonly<Record<string, ProduktProzessKurz>>) {
  return onboardingKandidaten(crm, faelle, vorlagen.marken, heute, mitProzessLauf).map(k => {
    const m = crm.mandate.find(x => x.id === k.mandatId)!;
    const pz = m.leistungId ? produktProzesse?.[m.leistungId] : undefined;
    const v = pz ? null : vorlageFuerProdukt(vorlagen, m.leistungId);
    // Bestand: keine 24-h-Uhr (kein „überfällig“) — die Uhr beginnt erst mit dem Start des Falls (`ableitungFuer`).
    return { ...k, uhr: k.bestand ? { ueberfaellig: false } : willkommenUhr(k.unterschrift?.am, vorlagen.einstellungen.willkommenStunden, undefined, jetzt), ...(v ? { vorlage: { id: v.id, titel: v.titel } } : {}), ...(pz ? { prozess: pz } : {}), vorgeschlagen: !!vorlagen.marken[markeOnboardingVorschlag(k.mandatId)] };
  });
}
export { markeOnboardingAus, unterschriftAm };
export type { KundeKurz };
