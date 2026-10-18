// ─── Fulfillment · Prozesse — Onboarding-Strecke (C1, 10.10.; FULFILLMENT_KONZEPT.md 3.1–3.3) ──────────────────────────────────────
// Acht Schritte (Muster lib/fulfillment/muster.ts `MUSTER_ONBOARDING`), deren Stand — wo möglich — ABGELEITET wird, nie gespeichert:
//   1 Willkommen in 24 h   ← `Fall.onboarding.willkommenGesendetAm` (Uhr: Unterschrift + `willkommenStunden`, danach „überfällig“)
//   2 Kick-off terminieren ← Ritual „einmal“ (Kick-off) mit mindestens einem Termin (`Fall.rituale[].terminUids`) ODER (seit 15.10., Abnahme B3) ein
//                            Termin mit dem Kunden im Kalender ab dem Start des Falls (`kundenTermine`, lib/fulfillment/prozesse/termine-server.ts)
//   3 Vereinbarung         ← `Fall.vereinbarung.bestaetigtAm`
//   4 Kunden-Playbook      ← `KundeKurz.formularProzent` = 100 (C2) — zählt NICHT fürs „fertig“ (das Playbook darf noch laufen)
//   5 Stakeholder-Karte    ← mindestens ein Entscheider
//   6 Wert-Konto           ← alle Ziele des Mandats mit Ausgang, Ziel, Datum und „festgelegt“
//   7 Entscheidungs-Log    ← mindestens ein Eintrag
//   8 F0 bestätigt         ← `Fall.freigaben.F0` (angezeigt als „Abstimmungspunkt n“ — nie das Kürzel, 15.10., Abnahme B5)
// „entfällt“ (von Hand, mit Grund) gilt als erledigt. Fertig = alle zählenden Schritte erledigt → Fall von „onboarding“ auf „läuft“.
// Dazu die Willkommensmail aus einer Vorlage der Bibliothek (Baustein Art „mail“ mit Schlagwort `willkommen`, Instanz-Text) mit den
// Platzhaltern {{anrede}}, {{vorname}}, {{kickoff_vorschlaege}}, {{playbook_link}}, {{gruss}} — ohne Link fällt der Absatz mit dem Link weg; ohne {{gruss}}
// (ältere Texte) kommt der Gruß mit dem Vornamen der sendenden Person ans Ende.
// Rein und client-sicher.

import type { Baustein, Fall, KnotenStatus, RitualVorlage, VorlagenDatei } from '../typen';
import type { Mandat } from '@/lib/crm/typen';
import { MUSTER_ONBOARDING, MUSTER_PLAYBOOK, type OnboardingSchluessel } from '../muster';
import { ausWandzeit, tagPlus, wandzeit } from '@/lib/kalender/zeit';
import { abstimmungsNummern } from './darstellung';
import { ersterTermin } from './termine';
import { satz } from '@/lib/text/zahlwort';

export const OB_PRAEFIX = 'fk-ob-';
/** Kennung des Playbook-Formulars unter dem Schritt „Playbook“ (dieselbe wie OB_PLAYBOOK_FORMULAR_ID in fall.ts — hier ohne Import-Kreis). */
const OB_PLAYBOOK_FORMULAR = 'fk-obf-playbook';
export const obKnotenId = (s: OnboardingSchluessel) => `${OB_PRAEFIX}${s}`;
export const obSchluessel = (id: string): OnboardingSchluessel | null => {
  const s = id.startsWith(OB_PRAEFIX) ? id.slice(OB_PRAEFIX.length) : '';
  return MUSTER_ONBOARDING.some(x => x.schluessel === s) ? (s as OnboardingSchluessel) : null;
};

/**
 * Der Vermerk „Kick-off ohne eigenen Kalender-Termin“ (`Fall.onboarding.kickoffAm`, Tag) in Worten — „Kick-off vermerkt am 18.10. (Termin steht anderswo)“.
 * EIN Satz für den Schritt im Fall, „Menschen & Termine“ und das Mandat (18.10., Nachprüfung L1b N13: nach dem Vermerk stand dort weiter „Kein Termin im
 * Kalender“). Lesen: `Fall.onboarding.kickoffAm` bzw. `kickoffVermerktAm` in Cockpit-Zeile, `FallKurz` und `FallFuerTreppe`.
 */
export const kickoffVermerkText = (am: string): string => `Kick-off vermerkt am ${am.slice(8, 10)}.${am.slice(5, 7)}. (Termin steht anderswo)`;

/** Ist ein Ritual das Kick-off? (Rhythmus „einmal“ — das Muster hat genau eins.) */
export const istKickoff = (r: Pick<RitualVorlage, 'rhythmus'>) => r.rhythmus === 'einmal';

export interface OnboardingAbleitung {
  ziele: Pick<Mandat['ziele'][number], 'id' | 'text' | 'ziel'>[];
  /** C2: Anteil des Playbooks in % (null = kein Link/Formular). */
  formularProzent: number | null;
  kickoffRitualIds: readonly string[];
  /** Zeitpunkt der Unterschrift (ISO oder Tag) — für die 24-h-Uhr. */
  unterschrift?: string;
  willkommenStunden: number;
  jetzt: string;
  /** Tage der Termine mit dem Kunden im Kalender (Bezug zum Mandat bzw. zur Firma) — der erste ab dem Start gilt als Kick-off-Termin. */
  kundenTermine?: readonly string[];
}

export interface OnboardingSchrittStand {
  schluessel: OnboardingSchluessel; titel: string; zaehlt: boolean;
  erfuellt: boolean; entfaellt: boolean; status: KnotenStatus | null;
  /** Woran es hängt (ein Satz). */
  text: string;
  ueberfaellig: boolean;
}
export interface WillkommenUhr { faellig?: string; gesendetAm?: string; ueberfaellig: boolean; restStunden?: number }
export interface OnboardingStand { schritte: OnboardingSchrittStand[]; fertig: boolean; offen: number; willkommen: WillkommenUhr }

/** Zeitpunkt (ms) einer Angabe „ISO oder Tag“ — ein Tag gilt ab 0 Uhr Berliner Zeit. */
export function zeitpunkt(x: string | undefined): number | null {
  if (!x) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(x)) { const d = ausWandzeit(`${x}T00:00:00`); return Number.isFinite(d.getTime()) ? d.getTime() : null; }
  const t = Date.parse(x);
  return Number.isFinite(t) ? t : null;
}

/** Die 24-Stunden-Uhr der Willkommensmail (3.1/3.2). */
export function willkommenUhr(unterschrift: string | undefined, stunden: number, gesendetAm: string | undefined, jetzt: string): WillkommenUhr {
  // Kennt die Unterschrift nur den Tag (Angebot angenommen speichert den Tag), läuft die Uhr ab dem ENDE dieses Tages (17.10., Gesamtprüfung L1 B2): vorher
  // galt 0 Uhr — wer abends annahm, hatte nur noch wenige Stunden, die Mail stand sofort rot. Mit Uhrzeit gilt die Uhrzeit.
  const nurTag = !!unterschrift && /^\d{4}-\d{2}-\d{2}$/.test(unterschrift);
  const u = nurTag ? zeitpunkt(tagPlus(unterschrift!, 1)) : zeitpunkt(unterschrift);
  const faellig = u != null ? new Date(u + stunden * 3_600_000).toISOString() : undefined;
  if (gesendetAm) return { ...(faellig ? { faellig } : {}), gesendetAm, ueberfaellig: false };
  if (!faellig) return { ueberfaellig: false };
  const rest = (Date.parse(faellig) - Date.parse(jetzt)) / 3_600_000;
  return { faellig, ueberfaellig: rest < 0, restStunden: Math.round(rest) };
}

// ── Anzeige der Frist (18.10., Nachprüfung N8) — die Regel bleibt `willkommenUhr`, hier nur, wie sie dasteht ───────────────────────────────────────────
// Endet die Uhr um 0 Uhr (Unterschrift nur mit Tag → Ende dieses Tages + 24 h), ist der Tag DAVOR der letzte, an dem die Mail rechtzeitig ist: „bis 20.10.“
// las sich wie „am 20. ist noch Zeit“ — am Morgen des 20. stand aber „überfällig“. Jede Anzeige der Uhr nimmt diese zwei Funktionen.
const WOCHENTAG_KURZ = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'] as const;
/** Der letzte Berliner Tag, an dem die Willkommensmail noch rechtzeitig ist (`faellig` ISO, z. B. aus `willkommenUhr`). Rein. */
export function willkommenLetzterTag(faellig: string): string {
  const ms = Date.parse(faellig);
  return Number.isNaN(ms) ? faellig.slice(0, 10) : wandzeit(new Date(ms - 1)).slice(0, 10);
}
/** „Mo 19.10.“ (Frist um 0 Uhr = Ende des Vortags) bzw. „Di 20.10., 14:30 Uhr“ (Frist mit Uhrzeit). Rein. */
export function willkommenBisText(faellig: string): string {
  const ms = Date.parse(faellig);
  if (Number.isNaN(ms)) return faellig;
  const w = wandzeit(new Date(ms));
  const mitternacht = w.slice(11, 16) === '00:00';
  const tag = mitternacht ? willkommenLetzterTag(faellig) : w.slice(0, 10);
  const wt = WOCHENTAG_KURZ[new Date(`${tag}T12:00:00Z`).getUTCDay()];
  return `${wt} ${tag.slice(8, 10)}.${tag.slice(5, 7)}.${mitternacht ? '' : `, ${w.slice(11, 16)} Uhr`}`;
}

/** Wert-Konto festgelegt (Schritt 6): jedes Ziel hat Ausgang, Ziel und Datum und ist „festgelegt“. Ohne Ziele: nicht erfüllt. */
export function wertKontoFestgelegt(fall: Pick<Fall, 'wertKonto'>, ziele: OnboardingAbleitung['ziele']): boolean {
  if (!ziele.length) return false;
  return ziele.every(z => {
    const e = fall.wertKonto[z.id];
    return !!e?.festgelegtAm && (e.ausgangZahl !== undefined || !!e.ausgang) && (e.zielZahl !== undefined || !!z.ziel) && !!e.zielBis;
  });
}

export function onboardingStand(fall: Fall, a: OnboardingAbleitung): OnboardingStand {
  // Aus einem Zusatzmodul ohne laufenden Fall gestartet (17.10. spät): kein Onboarding — nichts offen, keine 24-h-Uhr.
  if (fall.ohneOnboarding) return { schritte: [], fertig: true, offen: 0, willkommen: { ueberfaellig: false } };
  const kn = new Map(fall.knoten.map(k => [k.id, k]));
  const uhr = willkommenUhr(a.unterschrift, a.willkommenStunden, fall.onboarding.willkommenGesendetAm, a.jetzt);
  const entscheider = fall.stakeholder.some(s => s.rolle === 'entscheider');
  const kickoffRitual = fall.rituale.some(r => a.kickoffRitualIds.includes(r.ritualId) && r.terminUids.length > 0);
  const erster = ersterTermin((a.kundenTermine ?? []).map(tag => ({ tag })), fall.startAm ?? fall.gestartetAm.slice(0, 10));
  const vermerkt = fall.onboarding.kickoffAm;
  const kickoff = kickoffRitual || !!erster || !!vermerkt;
  const f0 = abstimmungsNummern(fall.knoten).get('F0');
  const f0Name = `Bestätigung${f0 ? ` ${f0}` : ''}`;
  const bed: Record<OnboardingSchluessel, [boolean, string]> = {
    willkommen: [!!fall.onboarding.willkommenGesendetAm, fall.onboarding.willkommenGesendetAm ? 'Willkommensmail gesendet.' : uhr.ueberfaellig ? 'Willkommensmail überfällig — bitte heute senden.' : 'Willkommensmail noch nicht gesendet.'],
    kickoff: [kickoff, kickoffRitual ? 'Kick-off steht im Kalender.' : vermerkt ? `${kickoffVermerkText(vermerkt)}.` : erster ? `Erster Termin mit dem Kunden steht im Kalender (${erster.slice(8, 10)}.${erster.slice(5, 7)}.) — er gilt als Kick-off.` : 'Kick-off noch nicht terminiert (Takt › Kick-off › Termin anlegen).'],
    vereinbarung: [!!fall.vereinbarung?.bestaetigtAm, fall.vereinbarung?.bestaetigtAm ? 'Vereinbarung bestätigt.' : 'Vereinbarung noch nicht bestätigt.'],
    playbook: [a.formularProzent === 100, a.formularProzent == null ? 'Playbook-Link noch nicht aktiv.' : `Playbook zu ${a.formularProzent} % ausgefüllt.`],
    stakeholder: [entscheider, entscheider ? 'Entscheider eingetragen.' : 'Noch kein Entscheider in der Stakeholder-Karte.'],
    wertkonto: [wertKontoFestgelegt(fall, a.ziele), a.ziele.length ? (wertKontoFestgelegt(fall, a.ziele) ? 'Wert-Konto festgelegt.' : 'Wert-Konto noch nicht vollständig festgelegt (Ausgang, Ziel, Datum).') : 'Am Mandat stehen noch keine Ziele.'],
    entscheidungslog: [fall.entscheidungen.length > 0, fall.entscheidungen.length ? 'Entscheidungs-Log eröffnet.' : 'Noch keine Entscheidung im Log.'],
    f0: [!!fall.freigaben.F0, fall.freigaben.F0 ? `${f0Name} vermerkt.` : `${f0Name} noch nicht vermerkt.`],
  };
  const schritte = MUSTER_ONBOARDING.map(s => {
    const k = kn.get(obKnotenId(s.schluessel));
    const entfaellt = k?.status === 'entfaellt';
    const [erfuellt, text] = bed[s.schluessel];
    return {
      schluessel: s.schluessel, titel: k?.titel ?? s.titel, zaehlt: s.zaehltFuerFertig, erfuellt, entfaellt, status: k?.status ?? null,
      text: entfaellt ? satz(`Entfällt${k?.grund ? ` — ${k.grund}` : ''}`) : text, ueberfaellig: s.schluessel === 'willkommen' && uhr.ueberfaellig,
    };
  });
  const offen = schritte.filter(s => s.zaehlt && !s.erfuellt && !s.entfaellt).length;
  return { schritte, fertig: offen === 0, offen, willkommen: uhr };
}

/**
 * „Onboarding x von y“ — EINE Zählung für Fall (Ablauf der ersten Phase), Fulfillment › Onboarding und Cockpit: alle Schritte des Onboardings, erledigt =
 * erfüllt oder entfallen (17.10., dritte Abnahme B5: der Fall zählte „7 von 7“ ohne das Playbook, darunter standen 8 Haken, die Liste sagte „von 8“).
 * Ob das Onboarding FERTIG ist, sagt weiter `fertig` (das Playbook darf noch laufen).
 */
export function onboardingZaehlung(schritte: readonly Pick<OnboardingSchrittStand, 'erfuellt' | 'entfaellt'>[]): { erledigt: number; gesamt: number } {
  return { erledigt: schritte.filter(s => s.erfuellt || s.entfaellt).length, gesamt: schritte.length };
}

/**
 * Der Fall, wie er wirkt: Onboarding-Schritte (Knoten `fk-ob-*`) tragen den abgeleiteten Stand (erledigt, wenn erfüllt — „entfällt“,
 * „wartet“, „in Arbeit“ von Hand bleiben), und ein fertiges Onboarding steht als „läuft“. Gespeichert wird davon nichts.
 */
export function fallWirksam(fall: Fall, a: OnboardingAbleitung): Fall {
  const st = onboardingStand(fall, a);
  const erfuellt = new Map(st.schritte.map(s => [obKnotenId(s.schluessel), s.erfuellt]));
  // Der Formular-Knoten unter dem Playbook-Schritt (`fk-obf-playbook`) folgt dem Stand seines Schritts (Prüf-Fund 11.10.: er blieb sonst ewig offen —
  // die Phase „Onboarding“ wurde nie fertig). Entfällt der Schritt, entfällt das Formular mit.
  const pbSchritt = fall.knoten.find(k => k.id === obKnotenId('playbook'));
  if (pbSchritt) erfuellt.set(OB_PLAYBOOK_FORMULAR, erfuellt.get(pbSchritt.id) ?? false);
  const knoten = fall.knoten.map(k => {
    if (k.id === OB_PLAYBOOK_FORMULAR && pbSchritt?.status === 'entfaellt') return k.status === 'entfaellt' ? k : { ...k, status: 'entfaellt' as const };
    if (!erfuellt.has(k.id) || k.status === 'entfaellt') return k;
    if (erfuellt.get(k.id)) return k.status === 'erledigt' ? k : { ...k, status: 'erledigt' as const };
    return k.status === 'erledigt' ? { ...k, status: 'offen' as const } : k;
  });
  return { ...fall, knoten, status: fall.status === 'onboarding' && st.fertig ? 'laeuft' : fall.status };
}

// ── Willkommensmail ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Neutrales Gerüst (nur Struktur, kein Instanz-Inhalt) — wird erst per Klick „Vorlage aus Gerüst anlegen“ ein Baustein der Bibliothek.
 * Neu gefasst 12.10. (Fulfillment extern: „sichtbarer Erfolg, Takt, Transparenz“): kurz, warm, in drei klaren Schritten — Kick-off, Projektseite
 * mit Playbook (der Absatz mit dem Link fällt ohne Link weg), was als Nächstes passiert. Keine Namen, keine Firma, keine Preise im Gerüst.
 */
export const WILLKOMMEN_GERUEST: Record<'Du' | 'Sie', string> = {
  Sie: [
    'Betreff: Willkommen — so starten wir gemeinsam',
    '',
    '{{anrede}},',
    '',
    'vielen Dank für Ihr Vertrauen — wir freuen uns sehr auf die Zusammenarbeit. Damit Sie wissen, was jetzt passiert:',
    '',
    'Zuerst das Kick-off: Wir lernen Ihr Team kennen und legen gemeinsam fest, woran wir den Erfolg messen. Passt Ihnen einer dieser Termine?',
    '{{kickoff_vorschlaege}}',
    '',
    'Ihre Projektseite: Dort sehen Sie jederzeit, wo wir stehen, was als Nächstes kommt und was wir von Ihnen brauchen. Vorab beantworten Sie dort ein paar Fragen zu Ihrem Unternehmen (Playbook) — in Ihrem Tempo, Zwischenspeichern geht jederzeit:',
    '{{playbook_link}}',
    '',
    'Danach: Erste Erfolge planen wir für die ersten 30 Tage, und alle zwei Wochen erhalten Sie einen kurzen Bericht zum Stand.',
    '',
    'Bei Fragen antworten Sie einfach auf diese Mail. Wir freuen uns auf den Start!',
    '',
    '{{gruss}}',
  ].join('\n'),
  Du: [
    'Betreff: Willkommen — so starten wir gemeinsam',
    '',
    '{{anrede}},',
    '',
    'danke für dein Vertrauen — ich freue mich sehr auf die Zusammenarbeit. Damit du weißt, was jetzt passiert:',
    '',
    'Zuerst das Kick-off: Wir lernen dein Team kennen und legen gemeinsam fest, woran wir den Erfolg messen. Passt dir einer dieser Termine?',
    '{{kickoff_vorschlaege}}',
    '',
    'Eure Projektseite: Dort siehst du jederzeit, wo wir stehen, was als Nächstes kommt und was wir von euch brauchen. Vorab beantwortest du dort ein paar Fragen zu eurem Unternehmen (Playbook) — in deinem Tempo, Zwischenspeichern geht jederzeit:',
    '{{playbook_link}}',
    '',
    'Danach: Erste Erfolge planen wir für die ersten 30 Tage, und alle zwei Wochen bekommst du einen kurzen Bericht zum Stand.',
    '',
    'Bei Fragen antworte einfach auf diese Mail. Ich freue mich auf den Start!',
    '',
    '{{gruss}}',
  ].join('\n'),
};
export const TAG_WILLKOMMEN = 'willkommen';

/** Die passende Vorlage der Bibliothek: Schlagwort `willkommen` und (wenn vorhanden) `du` bzw. `sie`. */
/**
 * Das Kunden-Playbook der Bibliothek, das ein neuer Fall unter „Kunden-Playbook“ einhängt: der aus dem Muster angelegte Baustein (Marke
 * `muster:fb-muster-playbook`), sonst ein Formular/Workbook mit Schlagwort „playbook“, das der Kunde ausfüllt. Ohne: null (Start ohne Formular).
 */
export function playbookBaustein(d: Pick<VorlagenDatei, 'bausteine' | 'marken'>): Baustein | null {
  const ausMuster = d.marken[`muster:${MUSTER_PLAYBOOK.id}`];
  const passt = (b: Baustein) => (b.art === 'formular' || b.art === 'workbook') && b.kundeFuellt === true && !!b.fragen?.length;
  return d.bausteine.find(b => b.id === ausMuster && passt(b)) ?? d.bausteine.find(b => passt(b) && b.tags.includes('playbook')) ?? null;
}

/**
 * Läuft der Baustein im Onboarding JEDES Falls (das Kunden-Playbook, eine Willkommensmail-Vorlage)? Dann steckt er in keiner Paket-Vorlage und ist trotzdem
 * im Einsatz — die Bibliothek sagt „im Onboarding jedes Falls“ statt „noch in keiner Vorlage“ (15.10., Abnahme C8).
 */
export function imOnboarding(b: Pick<Baustein, 'id' | 'art' | 'tags'>, d: Pick<VorlagenDatei, 'bausteine' | 'marken'>): boolean {
  return playbookBaustein(d)?.id === b.id || (b.art === 'mail' && b.tags.includes(TAG_WILLKOMMEN));
}

export function willkommenVorlage(bausteine: readonly Baustein[], anrede: 'Du' | 'Sie'): Baustein | null {
  const l = bausteine.filter(b => b.art === 'mail' && b.tags.includes(TAG_WILLKOMMEN) && !!b.text);
  return l.find(b => b.tags.includes(anrede.toLowerCase())) ?? l.find(b => !b.tags.includes('du') && !b.tags.includes('sie')) ?? l[0] ?? null;
}

export interface WillkommenWerte {
  anrede: 'Du' | 'Sie'; vorname?: string; nachname?: string; kickoffVorschlaege: string[]; playbookLink?: string;
  /** Vorname der SENDENDEN Person (aus ihrem Konto, `vornameVon`) — steht unter dem Gruß; nie ein fester Name. */
  absender?: string;
}

/**
 * Der Gruß am Ende, darunter der Vorname der sendenden Person (18.10., Nachprüfung C7: die Mail endete ohne Gruß und Absender) — dieselben Worte wie die
 * Nachrichten der Ausführung (`nachrichtEntwurf`): Du „Viele Grüße“, Sie „Freundliche Grüße“.
 */
export function willkommenGruss(anrede: 'Du' | 'Sie', absender?: string): string {
  const satz = anrede === 'Du' ? 'Viele Grüße' : 'Freundliche Grüße';
  const n = absender?.trim();
  return n ? `${satz}\n${n}` : satz;
}
/** Steht am Ende schon ein Gruß („Viele Grüße“, „Mit freundlichen Grüßen“ …)? Dann kommt keiner dazu — nie doppelt. */
const GRUSS_ZEILE = /^\s*(viele|liebe|beste|herzlichen?|freundliche|mit freundlichen|mit besten)?\s*gr(ü|ue)(ß|ss)/im;

/** Die Mail aus der Vorlage: Betreff (erste Zeile „Betreff: …“), Text mit gefüllten Platzhaltern; ohne Playbook-Link fällt der Absatz weg. */
export function willkommenMail(vorlage: string, w: WillkommenWerte): { betreff: string; text: string } {
  const zeilen = vorlage.replace(/\r\n/g, '\n').split('\n');
  let betreff = 'Willkommen';
  if (/^betreff:/i.test(zeilen[0] ?? '')) { betreff = zeilen.shift()!.replace(/^betreff:\s*/i, '').trim() || betreff; while (zeilen[0] === '') zeilen.shift(); }
  const name = [w.vorname, w.nachname].filter(Boolean).join(' ').trim();
  const anrede = w.anrede === 'Du' ? (w.vorname ? `Hallo ${w.vorname}` : 'Hallo') : name ? `Guten Tag ${name}` : 'Guten Tag';
  const vorschlaege = w.kickoffVorschlaege.length ? w.kickoffVorschlaege.map(x => `– ${x}`).join('\n') : '– (Terminvorschläge folgen)';
  const absaetze = zeilen.join('\n').split(/\n{2,}/).filter(a => w.playbookLink || !a.includes('{{playbook_link}}'));
  const gruss = willkommenGruss(w.anrede, w.absender);
  let text = absaetze.join('\n\n')
    .replace(/\{\{anrede\}\}/g, anrede).replace(/\{\{vorname\}\}/g, w.vorname ?? '').replace(/\{\{nachname\}\}/g, w.nachname ?? '')
    .replace(/\{\{kickoff_vorschlaege\}\}/g, vorschlaege).replace(/\{\{playbook_link\}\}/g, w.playbookLink ?? '')
    .replace(/\{\{gruss\}\}/g, gruss).replace(/\{\{absender\}\}/g, w.absender?.trim() ?? '')
    .replace(/\n{3,}/g, '\n\n').trim();
  // Ältere Texte ohne {{gruss}} (in der Bibliothek schon angelegt) bekommen den Gruß ans Ende — außer, ihr letzter Absatz grüßt schon.
  if (!/\{\{gruss\}\}/.test(vorlage) && !GRUSS_ZEILE.test(text.split(/\n{2,}/).pop() ?? '')) text = `${text}\n\n${gruss}`;
  return { betreff: betreff.slice(0, 200), text };
}

/** Ein Terminvorschlag als Text: „Di, 14.10., 10:00–11:30 Uhr“ (Wandzeit „YYYY-MM-DDTHH:mm“). */
export function vorschlagText(von: string, bis: string): string {
  const tag = von.slice(0, 10);
  const [j, m, t] = tag.split('-').map(Number);
  const wt = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][new Date(Date.UTC(j, m - 1, t)).getUTCDay()];
  return `${wt}, ${String(t).padStart(2, '0')}.${String(m).padStart(2, '0')}., ${von.slice(11, 16)}–${bis.slice(11, 16)} Uhr`;
}
