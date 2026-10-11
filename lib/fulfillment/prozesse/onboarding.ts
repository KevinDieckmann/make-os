// ─── Fulfillment · Prozesse — Onboarding-Strecke (C1, 10.10.; FULFILLMENT_KONZEPT.md 3.1–3.3) ──────────────────────────────────────
// Acht Schritte (Muster lib/fulfillment/muster.ts `MUSTER_ONBOARDING`), deren Stand — wo möglich — ABGELEITET wird, nie gespeichert:
//   1 Willkommen in 24 h   ← `Fall.onboarding.willkommenGesendetAm` (Uhr: Unterschrift + `willkommenStunden`, danach „überfällig“)
//   2 Kick-off terminieren ← Ritual „einmal“ (Kick-off) mit mindestens einem Termin (`Fall.rituale[].terminUids`)
//   3 Vereinbarung         ← `Fall.vereinbarung.bestaetigtAm`
//   4 Kunden-Playbook      ← `KundeKurz.formularProzent` = 100 (C2) — zählt NICHT fürs „fertig“ (das Playbook darf noch laufen)
//   5 Stakeholder-Karte    ← mindestens ein Entscheider
//   6 Wert-Konto           ← alle Ziele des Mandats mit Ausgang, Ziel, Datum und „festgelegt“
//   7 Entscheidungs-Log    ← mindestens ein Eintrag
//   8 F0 bestätigt         ← `Fall.freigaben.F0`
// „entfällt“ (von Hand, mit Grund) gilt als erledigt. Fertig = alle zählenden Schritte erledigt → Fall von „onboarding“ auf „läuft“.
// Dazu die Willkommensmail aus einer Vorlage der Bibliothek (Baustein Art „mail“ mit Schlagwort `willkommen`, Instanz-Text) mit den
// Platzhaltern {{anrede}}, {{vorname}}, {{kickoff_vorschlaege}}, {{playbook_link}} — ohne Link fällt der Absatz mit dem Link weg.
// Rein und client-sicher.

import type { Baustein, Fall, KnotenStatus, RitualVorlage, VorlagenDatei } from '../typen';
import type { Mandat } from '@/lib/crm/typen';
import { MUSTER_ONBOARDING, MUSTER_PLAYBOOK, type OnboardingSchluessel } from '../muster';
import { ausWandzeit } from '@/lib/kalender/zeit';

export const OB_PRAEFIX = 'fk-ob-';
/** Kennung des Playbook-Formulars unter dem Schritt „Playbook“ (dieselbe wie OB_PLAYBOOK_FORMULAR_ID in fall.ts — hier ohne Import-Kreis). */
const OB_PLAYBOOK_FORMULAR = 'fk-obf-playbook';
export const obKnotenId = (s: OnboardingSchluessel) => `${OB_PRAEFIX}${s}`;
export const obSchluessel = (id: string): OnboardingSchluessel | null => {
  const s = id.startsWith(OB_PRAEFIX) ? id.slice(OB_PRAEFIX.length) : '';
  return MUSTER_ONBOARDING.some(x => x.schluessel === s) ? (s as OnboardingSchluessel) : null;
};

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
  const u = zeitpunkt(unterschrift);
  const faellig = u != null ? new Date(u + stunden * 3_600_000).toISOString() : undefined;
  if (gesendetAm) return { ...(faellig ? { faellig } : {}), gesendetAm, ueberfaellig: false };
  if (!faellig) return { ueberfaellig: false };
  const rest = (Date.parse(faellig) - Date.parse(jetzt)) / 3_600_000;
  return { faellig, ueberfaellig: rest < 0, restStunden: Math.round(rest) };
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
  const kn = new Map(fall.knoten.map(k => [k.id, k]));
  const uhr = willkommenUhr(a.unterschrift, a.willkommenStunden, fall.onboarding.willkommenGesendetAm, a.jetzt);
  const entscheider = fall.stakeholder.some(s => s.rolle === 'entscheider');
  const kickoff = fall.rituale.some(r => a.kickoffRitualIds.includes(r.ritualId) && r.terminUids.length > 0);
  const bed: Record<OnboardingSchluessel, [boolean, string]> = {
    willkommen: [!!fall.onboarding.willkommenGesendetAm, fall.onboarding.willkommenGesendetAm ? 'Willkommensmail gesendet.' : uhr.ueberfaellig ? 'Willkommensmail überfällig — bitte heute senden.' : 'Willkommensmail noch nicht gesendet.'],
    kickoff: [kickoff, kickoff ? 'Kick-off steht im Kalender.' : 'Kick-off noch nicht terminiert (Takt › Kick-off › Termin anlegen).'],
    vereinbarung: [!!fall.vereinbarung?.bestaetigtAm, fall.vereinbarung?.bestaetigtAm ? 'Vereinbarung bestätigt.' : 'Vereinbarung noch nicht bestätigt.'],
    playbook: [a.formularProzent === 100, a.formularProzent == null ? 'Playbook-Link noch nicht aktiv.' : `Playbook zu ${a.formularProzent} % ausgefüllt.`],
    stakeholder: [entscheider, entscheider ? 'Entscheider eingetragen.' : 'Noch kein Entscheider in der Stakeholder-Karte.'],
    wertkonto: [wertKontoFestgelegt(fall, a.ziele), a.ziele.length ? (wertKontoFestgelegt(fall, a.ziele) ? 'Wert-Konto festgelegt.' : 'Wert-Konto noch nicht vollständig festgelegt (Ausgang, Ziel, Datum).') : 'Am Mandat stehen noch keine Ziele.'],
    entscheidungslog: [fall.entscheidungen.length > 0, fall.entscheidungen.length ? 'Entscheidungs-Log eröffnet.' : 'Noch keine Entscheidung im Log.'],
    f0: [!!fall.freigaben.F0, fall.freigaben.F0 ? 'F0 vermerkt.' : 'F0 noch nicht vermerkt.'],
  };
  const schritte = MUSTER_ONBOARDING.map(s => {
    const k = kn.get(obKnotenId(s.schluessel));
    const entfaellt = k?.status === 'entfaellt';
    const [erfuellt, text] = bed[s.schluessel];
    return {
      schluessel: s.schluessel, titel: k?.titel ?? s.titel, zaehlt: s.zaehltFuerFertig, erfuellt, entfaellt, status: k?.status ?? null,
      text: entfaellt ? `Entfällt${k?.grund ? ` — ${k.grund}` : ''}.` : text, ueberfaellig: s.schluessel === 'willkommen' && uhr.ueberfaellig,
    };
  });
  const offen = schritte.filter(s => s.zaehlt && !s.erfuellt && !s.entfaellt).length;
  return { schritte, fertig: offen === 0, offen, willkommen: uhr };
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

/** Neutrales Gerüst (nur Struktur, kein Instanz-Inhalt) — wird erst per Klick „Vorlage aus Gerüst anlegen“ ein Baustein der Bibliothek. */
export const WILLKOMMEN_GERUEST: Record<'Du' | 'Sie', string> = {
  Sie: [
    'Betreff: Willkommen — unsere nächsten Schritte',
    '',
    '{{anrede}},',
    '',
    'vielen Dank für Ihr Vertrauen. Damit wir gut starten, schlagen wir für das Kick-off diese Termine vor:',
    '{{kickoff_vorschlaege}}',
    '',
    'Vorab bitten wir Sie, das Playbook auszufüllen:',
    '{{playbook_link}}',
    '',
    'Wir freuen uns auf die Zusammenarbeit.',
  ].join('\n'),
  Du: [
    'Betreff: Willkommen — unsere nächsten Schritte',
    '',
    '{{anrede}},',
    '',
    'danke für dein Vertrauen. Damit wir gut starten, schlage ich für das Kick-off diese Termine vor:',
    '{{kickoff_vorschlaege}}',
    '',
    'Vorab bitte ich dich, das Playbook auszufüllen:',
    '{{playbook_link}}',
    '',
    'Ich freue mich auf die Zusammenarbeit.',
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

export function willkommenVorlage(bausteine: readonly Baustein[], anrede: 'Du' | 'Sie'): Baustein | null {
  const l = bausteine.filter(b => b.art === 'mail' && b.tags.includes(TAG_WILLKOMMEN) && !!b.text);
  return l.find(b => b.tags.includes(anrede.toLowerCase())) ?? l.find(b => !b.tags.includes('du') && !b.tags.includes('sie')) ?? l[0] ?? null;
}

export interface WillkommenWerte { anrede: 'Du' | 'Sie'; vorname?: string; nachname?: string; kickoffVorschlaege: string[]; playbookLink?: string }

/** Die Mail aus der Vorlage: Betreff (erste Zeile „Betreff: …“), Text mit gefüllten Platzhaltern; ohne Playbook-Link fällt der Absatz weg. */
export function willkommenMail(vorlage: string, w: WillkommenWerte): { betreff: string; text: string } {
  const zeilen = vorlage.replace(/\r\n/g, '\n').split('\n');
  let betreff = 'Willkommen';
  if (/^betreff:/i.test(zeilen[0] ?? '')) { betreff = zeilen.shift()!.replace(/^betreff:\s*/i, '').trim() || betreff; while (zeilen[0] === '') zeilen.shift(); }
  const name = [w.vorname, w.nachname].filter(Boolean).join(' ').trim();
  const anrede = w.anrede === 'Du' ? (w.vorname ? `Hallo ${w.vorname}` : 'Hallo') : name ? `Guten Tag ${name}` : 'Guten Tag';
  const vorschlaege = w.kickoffVorschlaege.length ? w.kickoffVorschlaege.map(x => `– ${x}`).join('\n') : '– (Terminvorschläge folgen)';
  const absaetze = zeilen.join('\n').split(/\n{2,}/).filter(a => w.playbookLink || !a.includes('{{playbook_link}}'));
  const text = absaetze.join('\n\n')
    .replace(/\{\{anrede\}\}/g, anrede).replace(/\{\{vorname\}\}/g, w.vorname ?? '').replace(/\{\{nachname\}\}/g, w.nachname ?? '')
    .replace(/\{\{kickoff_vorschlaege\}\}/g, vorschlaege).replace(/\{\{playbook_link\}\}/g, w.playbookLink ?? '')
    .replace(/\n{3,}/g, '\n\n').trim();
  return { betreff: betreff.slice(0, 200), text };
}

/** Ein Terminvorschlag als Text: „Di, 14.10., 10:00–11:30 Uhr“ (Wandzeit „YYYY-MM-DDTHH:mm“). */
export function vorschlagText(von: string, bis: string): string {
  const tag = von.slice(0, 10);
  const [j, m, t] = tag.split('-').map(Number);
  const wt = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][new Date(Date.UTC(j, m - 1, t)).getUTCDay()];
  return `${wt}, ${String(t).padStart(2, '0')}.${String(m).padStart(2, '0')}., ${von.slice(11, 16)}–${bis.slice(11, 16)} Uhr`;
}
