// ─── Art.-9-Einwilligung Gesundheit (05.10., DSGVO-Paket „KI, Gesundheit, Telegram“) ───────────────────────────────
// Gesundheitsdaten sind besondere Kategorien (Art. 9 DSGVO) — verarbeitet werden sie nur mit AUSDRÜCKLICHER Einwilligung
// der Person (Art. 9 Abs. 2 lit. a), getrennt je Zweck, jederzeit widerrufbar (Art. 7 Abs. 3), mit Nachweis (Art. 7 Abs. 1).
// Muster wie `erholungAm` (Kapazität) und der Einwilligungs-Nachweis im CRM (lib/crm/einwilligung.ts):
//
//   (a) verarbeiten  Gesundheitsdaten in MAKE OS erfassen und speichern
//   (b) ki           sie an die KI geben (ZOE, automatische Läufe — Anthropic PBC, USA = Drittland)
//   (c) partner      sie mit den Personen teilen, mit denen die Person ihre Gesundheit teilt (Konto › teilt.gesundheit),
//                    EINSCHLIESSLICH der Weitergabe an deren ZOE (also auch an die KI)
//
// Vorgaben: (b) und (c) AUS. (a) für Bestands-Konten einer kompatiblen Instanz (vor der Einführung angelegt): einmaliger
// Hinweis „bitte bestätigen“ — bis dahin wird wie bisher verarbeitet, aber nichts geht an die KI oder an Partner. Neue
// Konten: ohne (a) keine Erfassung (die Schreibwege antworten 403 mit `einwilligung: 'gesundheit'`).
// (b) und (c) setzen ein ausdrückliches (a) voraus; der Widerruf von (a) widerruft (b) und (c) mit.
//
// Nachweis UNVERÄNDERLICH: jede Erklärung ist ein Ereignis (Zeitpunkt, Zweck, an/aus, Fassung, Fingerabdruck des
// Wortlauts, wer) in einer Liste, die nur wächst. Der Stand ergibt sich aus dem letzten Ereignis je Zweck. Nur die Person
// selbst erklärt (Route `app/api/datenschutz/gesundheit`: Dienstweg und fremde Personen → 403) — auch der Inhaber nicht.
// Hinweis, keine Rechtsberatung — Wortlaut einmal anwaltlich gegenlesen.

import { createHash } from 'crypto';
import { loadJson, updateJson } from '@/lib/store/local-db';

export type GesundheitZweck = 'verarbeiten' | 'ki' | 'partner';
export const GESUNDHEIT_ZWECKE: readonly GesundheitZweck[] = ['verarbeiten', 'ki', 'partner'];
export const GESUNDHEIT_EINWILLIGUNG = 'gesundheit-einwilligungen';
/** Fassung der Texte unten — ändert sich der Wortlaut, ändert sich die Fassung (alte Erklärungen bleiben mit ihrer Fassung gültig). */
export const GESUNDHEIT_FASSUNG = 'gesundheit-2026-10-05';

export const GESUNDHEIT_TEXTE: Record<GesundheitZweck, { titel: string; text: string }> = {
  verarbeiten: {
    titel: 'Gesundheitsdaten in MAKE OS verarbeiten',
    text: 'Ich willige ausdrücklich ein, dass MAKE OS meine Gesundheitsdaten (z. B. Erholung, Schlaf, Herzfrequenz, Sport, Ernährung, Haut- und Journal-Einträge, Routinen) speichert und für meine eigenen Auswertungen verarbeitet (Art. 9 Abs. 2 lit. a DSGVO). Die Daten liegen verschlüsselt auf dem Server dieser Instanz. Ich kann die Einwilligung jederzeit hier widerrufen; danach wird nichts Neues mehr erfasst, und meine KI- und Partner-Freigaben enden mit.',
  },
  ki: {
    titel: 'An die KI geben (ZOE, Anthropic — USA)',
    text: 'Ich willige ausdrücklich ein, dass meine Gesundheitsdaten an die KI-Funktionen von MAKE OS gehen (ZOE im Gespräch und automatische Läufe). Anbieter des Modells ist Anthropic PBC in den USA (Drittland; Übermittlung auf Grundlage des EU-US Data Privacy Framework bzw. Standardvertragsklauseln). Ohne diese Einwilligung bekommt keine KI meine Gesundheitswerte. Widerruf jederzeit hier.',
  },
  partner: {
    titel: 'Mit meinem Partner teilen — auch an dessen ZOE',
    text: 'Ich willige ausdrücklich ein, dass die Personen, mit denen ich meine Gesundheit teile (Konto › Gesundheit teilen), meine Gesundheitsdaten über ihre ZOE abfragen können — dabei gehen sie an die KI (Anthropic PBC, USA). Setzt die Einwilligung „An die KI geben“ voraus. Widerruf jederzeit hier.',
  },
};

export interface EinwilligungsEreignis {
  /** Zeitpunkt (ISO, Server). */
  zeit: string;
  person: string;
  zweck: GesundheitZweck;
  an: boolean;
  fassung: string;
  /** SHA-256 (gekürzt) des Wortlauts, dem zugestimmt bzw. der widerrufen wurde. */
  wortlaut: string;
  /** Wer erklärt hat — immer die Person selbst (Sitzung). */
  von: string;
  /** Folge-Widerruf: (b)/(c) endeten, weil die Person (a) bzw. (b) widerrufen hat. */
  folge?: 'widerruf-verarbeiten';
}
export interface EinwilligungsDatei { ereignisse: EinwilligungsEreignis[] }

export interface ZweckStand { an: boolean; seit?: string; fassung?: string }
export interface GesundheitStand {
  verarbeiten: ZweckStand; ki: ZweckStand; partner: ZweckStand;
  /** Bestands-Konto ohne eigene Erklärung zu (a): Verarbeitung wie bisher, Hinweis „bitte bestätigen“. */
  hinweisOffen: boolean;
  /** Darf überhaupt erfasst/gespeichert werden? (a) erklärt — oder Bestand ohne Erklärung. */
  verarbeitungErlaubt: boolean;
}

export const wortlautFingerabdruck = (zweck: GesundheitZweck, fassung = GESUNDHEIT_FASSUNG): string =>
  createHash('sha256').update(`${fassung}|${zweck}|${GESUNDHEIT_TEXTE[zweck].titel}|${GESUNDHEIT_TEXTE[zweck].text}`).digest('hex').slice(0, 16);

/** Der Stand einer Person aus der Ereignisliste (rein). `bestand` = Konto von vor der Einführung in einer kompatiblen Instanz. */
export function gesundheitStand(ereignisse: readonly EinwilligungsEreignis[], person: string, bestand: boolean): GesundheitStand {
  const letzte = (z: GesundheitZweck) => [...ereignisse].filter(e => e.person === person && e.zweck === z).sort((a, b) => a.zeit.localeCompare(b.zeit)).pop();
  const stand = (z: GesundheitZweck): ZweckStand => { const e = letzte(z); return e?.an ? { an: true, seit: e.zeit, fassung: e.fassung } : { an: false }; };
  const a = stand('verarbeiten');
  const erklaertA = !!letzte('verarbeiten');
  // (b) und (c) zählen nur mit ausdrücklichem (a) — und (c) nur mit (b) (die Weitergabe an die ZOE des Partners ist KI).
  const b = a.an ? stand('ki') : { an: false };
  const c = a.an && b.an ? stand('partner') : { an: false };
  return { verarbeiten: a, ki: b, partner: c, hinweisOffen: bestand && !erklaertA, verarbeitungErlaubt: a.an || (bestand && !erklaertA) };
}

export type ErklaerFehler = 'zweck' | 'fassung' | 'voraussetzung';
/**
 * Eine Erklärung anhängen (rein). Liefert die NEUEN Ereignisse (bestehende werden nie verändert) oder einen Fehler:
 * `fassung` — der Browser zeigte einen anderen Wortlaut; `voraussetzung` — (b)/(c) ohne (a) bzw. (c) ohne (b).
 * Ein Widerruf von (a) widerruft (b) und (c) mit (Folge-Ereignisse). Unveränderte Stände erzeugen kein Ereignis.
 */
export function erklaeren(ereignisse: readonly EinwilligungsEreignis[], person: string, bestand: boolean, zweck: unknown, an: unknown, fassung: unknown, jetzt: string):
  { neu: EinwilligungsEreignis[] } | { fehler: ErklaerFehler } {
  if (!(GESUNDHEIT_ZWECKE as readonly unknown[]).includes(zweck) || typeof an !== 'boolean') return { fehler: 'zweck' };
  const z = zweck as GesundheitZweck;
  if (fassung !== GESUNDHEIT_FASSUNG) return { fehler: 'fassung' };
  const s = gesundheitStand(ereignisse, person, bestand);
  if (an && z === 'ki' && !s.verarbeiten.an) return { fehler: 'voraussetzung' };
  if (an && z === 'partner' && !(s.verarbeiten.an && s.ki.an)) return { fehler: 'voraussetzung' };
  const ev = (zz: GesundheitZweck, wert: boolean, folge?: EinwilligungsEreignis['folge']): EinwilligungsEreignis =>
    ({ zeit: jetzt, person, zweck: zz, an: wert, fassung: GESUNDHEIT_FASSUNG, wortlaut: wortlautFingerabdruck(zz), von: person, ...(folge ? { folge } : {}) });
  const neu: EinwilligungsEreignis[] = [];
  // (a) ausdrücklich erklären — auch „aus“ ist eine Erklärung (Bestand: Hinweis erledigt, Verarbeitung endet).
  const erklaertA = ereignisse.some(e => e.person === person && e.zweck === 'verarbeiten');
  if (z === 'verarbeiten') {
    if (s.verarbeiten.an !== an || !erklaertA) neu.push(ev('verarbeiten', an));
    if (!an) {
      if (s.ki.an) neu.push(ev('ki', false, 'widerruf-verarbeiten'));
      if (s.partner.an) neu.push(ev('partner', false, 'widerruf-verarbeiten'));
    }
    return { neu };
  }
  if (z === 'ki') {
    if (s.ki.an !== an) neu.push(ev('ki', an));
    if (!an && s.partner.an) neu.push(ev('partner', false, 'widerruf-verarbeiten'));
    return { neu };
  }
  if (s.partner.an !== an) neu.push(ev('partner', an));
  return { neu };
}

// ── Server ──────────────────────────────────────────────────────────────────

async function ereignisseLaden(): Promise<EinwilligungsEreignis[]> {
  const d = await loadJson<EinwilligungsDatei>(GESUNDHEIT_EINWILLIGUNG);
  return Array.isArray(d?.ereignisse) ? d.ereignisse : [];
}

async function bestandFuer(person: string): Promise<boolean> {
  const [{ ladeKiEinstellungen, istBestandsKonto }, { kontoFuerSpeicher }] = await Promise.all([import('./ki-einstellungen'), import('@/lib/zugang/konten')]);
  const [d, k] = await Promise.all([ladeKiEinstellungen(), kontoFuerSpeicher(person)]);
  return !!k && istBestandsKonto(d, k.angelegt);
}

/** Stand einer Person (Server). Ohne Konto: alles aus, keine Verarbeitung. */
export async function gesundheitStandFuer(person: string | null | undefined): Promise<GesundheitStand> {
  if (!person || !/^[a-z0-9-]{1,40}$/.test(person)) return gesundheitStand([], '', false);
  const [ev, bestand] = await Promise.all([ereignisseLaden(), bestandFuer(person)]);
  return gesundheitStand(ev, person, bestand);
}

/** Die eigenen Ereignisse einer Person (Nachweis, Art. 15) — nie die anderer. */
export async function gesundheitNachweis(person: string): Promise<EinwilligungsEreignis[]> {
  return (await ereignisseLaden()).filter(e => e.person === person);
}

/** Erklärung speichern (unter der Sperre des Bestands) — nur anhängen. */
export async function gesundheitErklaeren(person: string, zweck: unknown, an: unknown, fassung: unknown): Promise<{ ok: true; stand: GesundheitStand; neu: number } | { ok: false; fehler: ErklaerFehler }> {
  const bestand = await bestandFuer(person);
  let fehler: ErklaerFehler | null = null; let neu = 0;
  await updateJson<EinwilligungsDatei>(GESUNDHEIT_EINWILLIGUNG, cur => {
    const liste = Array.isArray(cur?.ereignisse) ? cur.ereignisse : [];
    const r = erklaeren(liste, person, bestand, zweck, an, fassung, new Date().toISOString());
    if ('fehler' in r) { fehler = r.fehler; return cur ?? { ereignisse: [] }; }
    neu = r.neu.length;
    return { ereignisse: [...liste, ...r.neu] };
  });
  if (fehler) return { ok: false, fehler };
  return { ok: true, stand: await gesundheitStandFuer(person), neu };
}

/** Darf diese Person Gesundheitsdaten erfassen (Schreibwege)? */
export async function gesundheitVerarbeitungErlaubt(person: string | null | undefined): Promise<boolean> {
  return (await gesundheitStandFuer(person)).verarbeitungErlaubt;
}

/** Dürfen Gesundheitswerte dieser Person an die KI (b)? */
export async function gesundheitAnKi(person: string | null | undefined): Promise<boolean> {
  return (await gesundheitStandFuer(person)).ki.an;
}

/**
 * Darf die ZOE von `betrachter` die Gesundheitsdaten von `eigentuemer` lesen? Eigene: (b). Fremde: der Eigentümer hat
 * (b) UND (c) erklärt UND teilt seine Gesundheit mit dem Betrachter (Konto › teilt.gesundheit) — und der Betrachter
 * selbst hat (b), denn die Antwort geht durch sein Modell-Gespräch.
 */
export async function gesundheitFuerZoe(eigentuemer: string, betrachter: string): Promise<boolean> {
  if (eigentuemer === betrachter) return gesundheitAnKi(betrachter);
  const s = await gesundheitStandFuer(eigentuemer);
  if (!s.ki.an || !s.partner.an) return false;
  const { kontoFuerSpeicher } = await import('@/lib/zugang/konten');
  const k = await kontoFuerSpeicher(eigentuemer);
  return !!k?.teilt?.gesundheit?.includes(betrachter);
}

/** Antwort der Schreibwege ohne Einwilligung (a) — ein Satz überall. */
export const GESUNDHEIT_OHNE_EINWILLIGUNG = { ok: false, error: 'Gesundheitsdaten werden erst nach deiner Einwilligung erfasst (System › Datenschutz).', einwilligung: 'gesundheit' } as const;

/**
 * Tor der Schreibwege für Gesundheitsdaten (Vitalwerte, Haut, Journal, Streak, Routinen-Log, Sport, Whoop): ohne
 * Einwilligung (a) → 403 mit `einwilligung: 'gesundheit'` (die Oberfläche zeigt dann den Einwilligungs-Dialog).
 * Bestands-Konten ohne Erklärung schreiben wie bisher (Hinweis „bitte bestätigen“). Null = darf.
 */
export async function gesundheitSchreibSperre(person: string | null | undefined): Promise<Response | null> {
  if (await gesundheitVerarbeitungErlaubt(person)) return null;
  const { NextResponse } = await import('next/server');
  return NextResponse.json(GESUNDHEIT_OHNE_EINWILLIGUNG, { status: 403 });
}
