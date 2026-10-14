// ─── Fulfillment · Kunde — die Kunden-Sicht (Positivliste; rein, client-sicher; C2, 10.10.; FULFILLMENT_KONZEPT.md 5.4, 6.4) ────────────────────────
// EINE Stelle für „was sieht der Kunde“: die öffentliche Seite (`/kunde/kl-…`) UND die interne Vorschau „So sieht der Kunde es“ bekommen genau dieses
// Objekt (serverseitig gebaut, dieselbe Komponente `KundenAnsicht`). Es enthält NUR die Schlüssel aus `SICHT_SCHLUESSEL` (Wächter mit einem Fall voller
// interner Daten: tests/fulfillment-c2-sicht.test.ts). Was er NIE sieht: Stakeholder-Karte, Haltungen, Notizen, interne Knoten, Health/Ampel, Zahlungen,
// Honorar, Rechnungen, Dossier, Personenteil, Leseteil, Kosten, andere Mandate, die Liste der Dateien, Namen oder Adressen unseres Teams (außer dem
// Anzeigenamen der Ansprechperson, s. u.), Kennungen anderer Bestände (Formulare tragen einen eigenen Schlüssel `fo-…`, nie die Baustein-Kennung).
// Bausteine nur nach der EINEN Regel `fuerKundenFrei` (lib/fulfillment/prozesse/bausteine.ts, zusammengeführt 11.10.): nie „nur intern“ (Material der
// früheren Agentur), nie „vor Verkauf prüfen“ bzw. „vor Einsatz rechtlich prüfen“, solange nicht als geprüft vermerkt — das gilt für Formulare UND für
// Knoten, die auf einen solchen Baustein zeigen (Zeitstrahl, erledigt, als Nächstes).
//
// Seit 12.10. (Fulfillment extern, „ein Bild“): die Teile aus dem Fall rechnet `kundenTeile` (lib/fulfillment/kunde/bild.ts) — dieselbe Rechnung für
// Seite, 2-Wochen-Report und Präsentation. Neu in der Positivliste: Anrede (du/sie), Anbieter (Name, Logo als Bild-Daten, Kontaktweg der Gesellschaft),
// die Ansprechperson (nur ihr Anzeigename — Entscheidung 12.10.: „keine Personennamen außer Ansprechpartnern“), Lage (Ampel + drei Sätze), Fortschritt, Anteil
// und Abstimmungspunkt je Phase, Frist/Formular je „wartet“, erste Erfolge (Quick Wins), nächster Termin, Anteil je Ziel, Upload-Status (nur Zahlen —
// die Liste der Dateien bleibt intern). Freigabe-Kürzel (F0–F7) und interne Zusätze erreichen den Kunden nie (`kundenText`).

import { tagVon } from '@/lib/zeit';
import { abschnitteVon, formularProzent, formularSchluessel, formularStandVon, formulareDesFalls } from './formular';
import { offeneAnfrage } from './puls';
import { HINWEIS_VERSION } from './link';
import { fuerKundenFrei, kundenGesperrt } from '../prozesse/bausteine';
import { formularOffen, kundenTeile, tagText, type KundenAnrede, type KundenHaenger, type KundenLage, type KundenPhase, type KundenQuickWin, type KundenRitual, type KundenWartet, type KundenWert } from './bild';
import type { Baustein, Fall, FallKnoten, Frage, Freigabepunkt, KundeDatei, RitualVorlage, VorlagenDatei } from '../typen';
import type { Mandat } from '@/lib/crm/typen';

/** Taugt ein Baustein für Kunden? Nur die Regel aus C1 (`fuerKundenFrei`) — hier kein eigenes Urteil. */
export const kundeTauglich = (b: Baustein, d: Pick<VorlagenDatei, 'marken'>): boolean => fuerKundenFrei(b, d).frei;


export interface KundenFrage { id: string; frage: string; art: Frage['art']; optionen?: string[]; pflicht?: boolean; hilfe?: string }
export interface KundenFormular {
  schluessel: string; titel: string; zweck?: string; prozent: number; stand: string;
  abschnitte: { schluessel: string; titel: string; fertig: boolean; fragen: KundenFrage[] }[];
  antworten: Record<string, string>;
}
/** Der Anbieter (unsere Gesellschaft des Mandats) — Name, Logo (nur PNG/JPG als Bild-Daten) und der Kontaktweg der Gesellschaft, nie Personen. */
export interface KundenAnbieter { name: string; logo?: string; email?: string; telefon?: string; web?: string }
export interface KundenSicht {
  modus: 'voll' | 'puls';
  /** Du (ihr/euch) oder Sie — aus der Akte der Ansprechperson, ohne Angabe Sie. */
  anrede: KundenAnrede;
  anbieter?: KundenAnbieter;
  /** Anzeigename der zuständigen Person unseres Teams (nur sie, nur der Name). */
  ansprechperson?: string;
  firma: string;
  mandat?: string;
  paket?: string;
  stand: string;
  lage?: KundenLage;
  fortschritt?: number;
  zeitstrahl: KundenPhase[];
  erledigt: string[];
  naechstes: string[];
  wartet: KundenWartet[];
  wertKonto: KundenWert[];
  quickWins: KundenQuickWin[];
  rituale: KundenRitual[];
  naechsterTermin?: { titel: string; am: string };
  entscheidungen: { titel: string; am: string; status: 'offen' | 'entschieden' | 'verworfen'; inhalt?: string }[];
  formulare: KundenFormular[];
  upload: { erlaubt: boolean; eingegangen: number; frei: number; geprueft: number; offen: number } | null;
  puls: { offen: boolean } | null;
  datenschutz: { verantwortlich: string; seite?: string; fassung: string; absaetze: string[] };
}
/** Die erlaubten Schlüssel — Positivliste (oberste Ebene). Ein neuer Schlüssel braucht eine bewusste Änderung HIER und im Wächter. */
export const SICHT_SCHLUESSEL = [
  'modus', 'anrede', 'anbieter', 'ansprechperson', 'firma', 'mandat', 'paket', 'stand', 'lage', 'fortschritt', 'zeitstrahl', 'erledigt', 'naechstes', 'wartet',
  'wertKonto', 'quickWins', 'rituale', 'naechsterTermin', 'entscheidungen', 'formulare', 'upload', 'puls', 'datenschutz',
] as const;

export interface SichtEingabe {
  modus: 'voll' | 'puls';
  heute: string;
  mandat: Pick<Mandat, 'id' | 'titel' | 'kunde' | 'ziele'>;
  paket?: string;
  fall: Fall | null;
  bausteine: readonly Baustein[];
  /** Marken der Vorlagen-Datei (Vermerk „vor Verkauf geprüft“ = `urheber-geprueft:<id>`) — für `fuerKundenFrei`. */
  marken: VorlagenDatei['marken'];
  rituale: readonly RitualVorlage[];
  kunde: KundeDatei;
  rechte: { formular: boolean; upload: boolean; puls: boolean };
  /** Stand eines Formular-Stands (Fingerabdruck; vom Server). */
  standVon: (f: KundeDatei['formulare'][number]) => string;
  datenschutz: { verantwortlich: string; seite?: string; fassung: string; absaetze: string[] };
  /** Upload-Grenzen je Link (frei = so viele Dateien gehen noch). */
  uploadFrei: number;
  /** Mit Puls-Token: ist genau DIESE Anfrage noch offen? (sonst gilt die jüngste offene Anfrage des Mandats) */
  pulsOffen?: boolean;
  /** Du oder Sie (Akte der Ansprechperson; ohne Angabe Sie). */
  anrede?: KundenAnrede;
  anbieter?: KundenAnbieter;
  ansprechperson?: string;
  /** Abstimmungspunkte der Vorlage des Falls (Titel, wer) — für den Strahl. */
  freigaben?: readonly Pick<Freigabepunkt, 'id' | 'titel' | 'wer'>[];
  /** Tage der Termine mit Bezug zum Mandat (`kalender-bezug`) — für „Nächster Termin“. */
  terminTage?: readonly { uid: string; tag: string }[];
  /** Was intern hängt (Cockpit `wasHaengt`, nur Art/Schwere/Tage) — die Lage übersetzt es in Worte (14.10.). Geht selbst NIE an den Kunden. */
  haengt?: readonly KundenHaenger[];
}

export { formularOffen };

/** Zeigt der Knoten auf einen Baustein, der (noch) nicht an Kunden geht? Dann taucht er auf keinem Kunden-Weg auf (auch nicht unter „wartet“). */
export const knotenGesperrt = (k: Pick<FallKnoten, 'bausteinId'>, gesperrt: ReadonlySet<string>): boolean => !!k.bausteinId && gesperrt.has(k.bausteinId);

/** Die Kunden-Sicht bauen — nur die Schlüssel der Positivliste, nur geteilte Inhalte. Mit `modus: 'puls'` nur Kopf + Puls + Hinweis. */
export function kundenSicht(e: SichtEingabe): KundenSicht {
  const anrede = e.anrede ?? 'sie';
  const basis = {
    anrede, ...(e.anbieter ? { anbieter: { ...e.anbieter } } : {}), ...(e.ansprechperson ? { ansprechperson: e.ansprechperson } : {}),
    firma: e.mandat.kunde, stand: tagText(e.heute), datenschutz: { ...e.datenschutz, absaetze: [...e.datenschutz.absaetze] },
  };
  const pulsOffen = e.pulsOffen ?? !!offeneAnfrage(e.kunde, e.mandat.id, e.heute);
  if (e.modus === 'puls') {
    return { modus: 'puls', ...basis, zeitstrahl: [], erledigt: [], naechstes: [], wartet: [], wertKonto: [], quickWins: [], rituale: [], entscheidungen: [], formulare: [], upload: null, puls: { offen: pulsOffen } };
  }
  const f = e.fall;
  const gesperrt = kundenGesperrt(e.bausteine, { marken: e.marken });
  const formularBausteine = e.rechte.formular ? formulareDesFalls(f, e.bausteine).filter(b => b.kundeFuellt === true && kundeTauglich(b, { marken: e.marken })) : [];
  const formulare: KundenFormular[] = formularBausteine.map(b => {
    const st = formularStandVon(e.kunde, e.mandat.id, b.id);
    return {
      schluessel: formularSchluessel(e.mandat.id, b.id), titel: b.titel, ...(b.zweck ? { zweck: b.zweck } : {}), prozent: formularProzent(b, st), stand: st ? e.standVon(st) : 'neu',
      abschnitte: abschnitteVon(b).map(a => ({ schluessel: a.schluessel, titel: a.titel, fertig: !!st?.fertig.includes(a.schluessel), fragen: a.fragen.map(q => ({ id: q.id, frage: q.frage, art: q.art, ...(q.optionen?.length ? { optionen: [...q.optionen] } : {}), ...(q.pflicht ? { pflicht: true } : {}), ...(q.hilfe ? { hilfe: q.hilfe } : {}) })) })),
      antworten: Object.fromEntries(Object.entries(st?.antworten ?? {}).filter(([k]) => (b.fragen ?? []).some(q => q.id === k))),
    };
  });
  const t = kundenTeile({
    fall: f, mandat: e.mandat, heute: e.heute, anrede, gesperrt, ...(e.freigaben ? { freigaben: e.freigaben } : {}), rituale: e.rituale,
    formulare: new Map(formularBausteine.map(b => [b.id, formularSchluessel(e.mandat.id, b.id)])), ...(e.terminTage ? { terminTage: e.terminTage } : {}),
    // 14.10.: offene Formulare zählen in der Lage mit (wie in der Karte), und die Ampel folgt dem, was intern hängt.
    formulareOffen: formulare.filter(formularOffen).map(x => x.schluessel), ...(e.haengt ? { haengt: e.haengt } : {}),
  });
  // Nur geteilte Entscheidungen (Prüf-Fund 11.10.: ungeteilte erschienen hier mit Titel).
  const entscheidungen = (f?.entscheidungen ?? []).filter(x => x.geteilt).sort((a, b) => (a.am < b.am ? 1 : -1))
    .map(x => ({ titel: x.titel, am: tagText(tagVon(x.am)), status: x.status, ...(x.inhalt ? { inhalt: x.inhalt } : {}) }));
  const vomKunden = e.kunde.unterlagen.filter(u => u.mandatId === e.mandat.id && u.herkunft === 'kunde');
  return {
    modus: 'voll', ...basis, mandat: e.mandat.titel, ...(e.paket ? { paket: e.paket } : {}),
    ...(f ? { lage: t.lage } : {}), ...(t.fortschritt ? { fortschritt: t.fortschritt } : {}),
    zeitstrahl: t.phasen, erledigt: t.erledigt, naechstes: t.naechstes, wartet: t.wartet, wertKonto: t.wertKonto, quickWins: t.quickWins, rituale: t.rituale,
    ...(t.naechsterTermin ? { naechsterTermin: t.naechsterTermin } : {}), entscheidungen, formulare,
    upload: e.rechte.upload ? {
      erlaubt: e.uploadFrei > 0, eingegangen: vomKunden.length, frei: e.uploadFrei,
      geprueft: vomKunden.filter(u => u.status === 'freigegeben').length, offen: vomKunden.filter(u => u.status === 'ungeprueft').length,
    } : null,
    puls: e.rechte.puls ? { offen: pulsOffen } : null,
  };
}

/**
 * Der Datenschutzhinweis (Art. 13) der Kunden-Seite — Verantwortlicher aus der Einrichtung, Fristen aus der Löschfristen-Tabelle. Hinweis, keine
 * Rechtsberatung. `anrede` (seit 12.10.): derselbe Inhalt in der Anrede der Seite (ohne Angabe wie bisher „ihr/euch“); die Fassung zählt den Inhalt.
 */
export function kundeHinweis(e: { verantwortlich: string | null; seite: string | null; mandatsdatenMonate: number; unterlagenTage: number; anrede?: KundenAnrede }): { verantwortlich: string; seite?: string; fassung: string; absaetze: string[] } {
  const sie = e.anrede === 'sie';
  const absaetze = sie ? [
    'Diese Seite gehört zu Ihrem Projekt mit uns. Hier sehen Sie den Stand, beantworten Fragen (Playbook) und können Unterlagen hochladen.',
    'Zweck und Grundlage: Durchführung unseres Vertrags mit Ihnen (Art. 6 Abs. 1 lit. b DSGVO). Wir speichern Ihre Antworten, hochgeladene Dateien und Ihre Rückmeldung (Kunden-Puls) — verschlüsselt auf unserem Server in Deutschland. Kein Tracking, keine Cookies für Werbung.',
    `Speicherdauer: Antworten und Rückmeldungen bis ${e.mandatsdatenMonate} Monate nach Ende der Zusammenarbeit, Dateien bis ${e.unterlagenTage} Tage danach — außer, wir müssen sie als Beleg aufbewahren.`,
    'Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Widerspruch sowie auf Beschwerde bei einer Aufsichtsbehörde. Schreiben Sie uns einfach.',
    'Bitte laden Sie keine Gesundheitsdaten oder Unterlagen über Dritte hoch, die wir für das Projekt nicht brauchen.',
  ] : [
    'Diese Seite gehört zu eurem Projekt mit uns. Hier seht ihr den Stand, beantwortet Fragen (Playbook) und könnt Unterlagen hochladen.',
    'Zweck und Grundlage: Durchführung unseres Vertrags mit euch (Art. 6 Abs. 1 lit. b DSGVO). Wir speichern eure Antworten, hochgeladene Dateien und eure Rückmeldung (Kunden-Puls) — verschlüsselt auf unserem Server in Deutschland. Kein Tracking, keine Cookies für Werbung.',
    `Speicherdauer: Antworten und Rückmeldungen bis ${e.mandatsdatenMonate} Monate nach Ende der Zusammenarbeit, Dateien bis ${e.unterlagenTage} Tage danach — außer, wir müssen sie als Beleg aufbewahren.`,
    'Ihr habt das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Widerspruch sowie auf Beschwerde bei einer Aufsichtsbehörde. Schreibt uns einfach.',
    'Bitte ladet keine Gesundheitsdaten oder Unterlagen über Dritte hoch, die wir für das Projekt nicht brauchen.',
  ];
  return {
    verantwortlich: e.verantwortlich ?? (sie ? 'Der Verantwortliche ist noch nicht eingetragen — bitte fragen Sie Ihre Ansprechperson.' : 'Der Verantwortliche ist noch nicht eingetragen — bitte fragt eure Ansprechperson.'),
    ...(e.seite ? { seite: e.seite } : {}),
    fassung: `k${HINWEIS_VERSION}-${e.mandatsdatenMonate}m-${e.unterlagenTage}t`,
    absaetze,
  };
}

/** Zum Wächter: alle Schlüssel (tief) eines Objekts als Pfade (Listen ohne Index). */
export function schluesselPfade(x: unknown, pfad = ''): string[] {
  if (Array.isArray(x)) return Array.from(new Set(x.flatMap(y => schluesselPfade(y, `${pfad}[]`))));
  if (!x || typeof x !== 'object') return [];
  return Object.entries(x as Record<string, unknown>).flatMap(([k, v]) => {
    const p = pfad ? `${pfad}.${k}` : k;
    if (/^(antworten)$/.test(k) && v && typeof v === 'object' && !Array.isArray(v)) return [p];
    return [p, ...schluesselPfade(v, p)];
  });
}
