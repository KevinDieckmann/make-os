// ─── CRM — Pipeline (rein, getestet) ────────────────────────────────────────
// Übernommen aus KEMARIS Operations (lib/services/pipeline.ts + dealScore.ts):
// fünf Stufen, jede endet mit einem Ereignis auf Kundenseite; bewusst
// vorsichtige Wahrscheinlichkeiten, die durch gemessene Quoten ersetzt werden,
// sobald je Stufe genug Abschlüsse da sind; volle Stufen-Historie; Ampel
// „hängt“. Neu gegenüber Operations: „geparkt“ (nur mit Wiedervorlage), der
// Wert wird je Basis normalisiert (monatlich × Laufzeit statt roher Betrag),
// und Commit/Best-Case wird tatsächlich gerechnet.

import type { Kontakt, Aktivitaet } from '@/lib/make-one/crm';
import type { Chance, ChancenStufe, CrmBestand, Kampagne, KampagnenErgebnis, PowerHourSitzung } from './typen';
import type { Welt } from './traktion';
import { TEAM, BEIDE, zustaendig } from './team';

export const STUFEN: { id: ChancenStufe; label: string; p: number; weiterWenn: string; offen: boolean }[] = [
  { id: 'qualifiziert', label: 'Qualifiziert', p: 30, weiterWenn: 'Schmerz und Entscheider bekannt, Gespräch mit dem Entscheider vereinbart.', offen: true },
  { id: 'bedarf', label: 'Bedarf', p: 45, weiterWenn: 'Moralischer Vorvertrag: höchstens drei bis fünf Prioritäten, Diagnose-Termin steht.', offen: true },
  { id: 'diagnose', label: 'Diagnose', p: 60, weiterWenn: 'Diagnose mit dem Entscheider gehalten; Wirkung, Budgetrahmen und Zeitpunkt bestätigt.', offen: true },
  { id: 'angebot', label: 'Angebot', p: 75, weiterWenn: 'Optionen live besprochen, Preis ohne Rabatt bestätigt, Entscheidungsdatum genannt.', offen: true },
  { id: 'abschluss', label: 'Abschluss', p: 90, weiterWenn: 'Ja des wirtschaftlichen Entscheiders, Vertrag raus, Zahlungsweg geklärt.', offen: true },
  { id: 'gewonnen', label: 'Gewonnen', p: 100, weiterWenn: '', offen: false },
  { id: 'verloren', label: 'Verloren', p: 0, weiterWenn: '', offen: false },
  { id: 'geparkt', label: 'Geparkt', p: 0, weiterWenn: '', offen: false },
];
export const OFFENE_STUFEN = STUFEN.filter(s => s.offen).map(s => s.id);
export const VERLUSTGRUENDE = ['Preis', 'Kein Bedarf', 'Zeitpunkt', 'Wettbewerb', 'Kein Entscheider', 'Intern gelöst', 'Keine Rückmeldung'];

export function wahrscheinlichkeit(stufe: ChancenStufe, eigene?: CrmBestand['wahrscheinlichkeiten']): number {
  const v = eigene?.[stufe];
  return typeof v === 'number' ? Math.max(0, Math.min(100, v)) : STUFEN.find(s => s.id === stufe)?.p ?? 0;
}

/** Gesamtwert einer Chance: Monatshonorar × Laufzeit (Standard 12), Jahreswert × Jahre, Einmalbetrag. */
export function gesamtwert(c: Pick<Chance, 'wert'>): number {
  const { betrag, basis, laufzeitMonate } = c.wert;
  if (!(betrag > 0)) return 0;
  if (basis === 'monat') return betrag * (laufzeitMonate && laufzeitMonate > 0 ? laufzeitMonate : 12);
  if (basis === 'jahr') return betrag * (laufzeitMonate && laufzeitMonate > 0 ? laufzeitMonate / 12 : 1);
  return betrag;
}

const tageZwischen = (a: string, b: string) => Math.round((Date.parse(`${b.slice(0, 10)}T12:00:00Z`) - Date.parse(`${a.slice(0, 10)}T12:00:00Z`)) / 864e5);

/** Wie lange ohne Bewegung (letzte Aktivität, sonst Stufenwechsel, sonst Anlage). */
export function alterTage(c: Chance, heute: string): number {
  const letzte = c.letzteAktivitaet ?? c.historie[c.historie.length - 1]?.am ?? c.angelegt;
  return Math.max(0, tageZwischen(letzte, heute));
}

export type Ampel = 'gruen' | 'gelb' | 'rot';
/** KEMARIS Operations dealScore.ts: überfällig oder > 30 Tage still → rot; ohne Wert oder > 14 Tage → gelb. Neu: ohne nächsten Schritt → gelb. */
export function gesundheit(c: Chance, heute: string): { ampel: Ampel; gruende: string[] } {
  if (!OFFENE_STUFEN.includes(c.stufe)) return { ampel: 'gruen', gruende: [] };
  const alter = alterTage(c, heute);
  const g: string[] = [];
  let ampel: Ampel = 'gruen';
  if (c.naechsterSchritt && c.naechsterSchritt.datum < heute) { ampel = 'rot'; g.push(`nächster Schritt überfällig seit ${tageZwischen(c.naechsterSchritt.datum, heute)} Tagen`); }
  if (alter > 30) { ampel = 'rot'; g.push(`${alter} Tage ohne Bewegung`); }
  if (ampel !== 'rot') {
    if (!(c.wert.betrag > 0)) { ampel = 'gelb'; g.push('kein Wert eingetragen'); }
    if (alter > 14) { ampel = 'gelb'; g.push(`${alter} Tage ohne Bewegung`); }
    if (!c.naechsterSchritt) { ampel = 'gelb'; g.push('kein nächster Schritt mit Datum'); }
  }
  return { ampel, gruende: g };
}

/** Stufenwechsel mit Historie. Verloren braucht einen Grund, geparkt eine Wiedervorlage. */
export function wechsleStufe(c: Chance, ziel: ChancenStufe, von: string, jetzt: string, extra: { grund?: string; wiedervorlage?: string } = {}): { ok: true; chance: Chance } | { ok: false; fehler: string } {
  if (ziel === 'verloren' && !extra.grund?.trim()) return { ok: false, fehler: 'Verloren braucht einen Grund — nur so lernt die Pipeline.' };
  if (ziel === 'geparkt' && !extra.wiedervorlage) return { ok: false, fehler: 'Geparkt nur mit Wiedervorlage — sonst ist es verloren.' };
  if (ziel === c.stufe) return { ok: true, chance: c };
  return {
    ok: true,
    chance: {
      ...c, stufe: ziel, historie: [...c.historie, { stufe: ziel, am: jetzt, von }],
      ...(extra.grund ? { grund: extra.grund.trim() } : {}), ...(extra.wiedervorlage ? { wiedervorlage: extra.wiedervorlage } : {}),
      geaendert: jetzt, letzteAktivitaet: jetzt.slice(0, 10),
    },
  };
}

export interface Prognose {
  offen: number; gewichtet: number;
  /** Commit: Stufe Abschluss. Best Case: ab Angebot. */
  commit: number; bestCase: number;
  jeStufe: { stufe: ChancenStufe; label: string; anzahl: number; wert: number; gewichtet: number; haengt: number }[];
  ohneSchritt: number;
}
export function prognose(chancen: Chance[], heute: string, eigene?: CrmBestand['wahrscheinlichkeiten']): Prognose {
  const offen = chancen.filter(c => OFFENE_STUFEN.includes(c.stufe));
  const jeStufe = STUFEN.filter(s => s.offen).map(s => {
    const l = offen.filter(c => c.stufe === s.id);
    const wert = l.reduce((a, c) => a + gesamtwert(c), 0);
    return { stufe: s.id, label: s.label, anzahl: l.length, wert, gewichtet: Math.round(wert * wahrscheinlichkeit(s.id, eigene) / 100), haengt: l.filter(c => gesundheit(c, heute).ampel === 'rot').length };
  });
  return {
    offen: jeStufe.reduce((a, s) => a + s.wert, 0),
    gewichtet: jeStufe.reduce((a, s) => a + s.gewichtet, 0),
    commit: offen.filter(c => c.stufe === 'abschluss').reduce((a, c) => a + gesamtwert(c), 0),
    bestCase: offen.filter(c => c.stufe === 'angebot' || c.stufe === 'abschluss').reduce((a, c) => a + gesamtwert(c), 0),
    jeStufe,
    ohneSchritt: offen.filter(c => !c.naechsterSchritt).length,
  };
}

/** Gewinnquote ab Stufe Angebot — erst ab 10 Entscheidungen eine Quote, vorher „G · V“ (wie in Operations). */
export function gewinnquote(chancen: Chance[]): { gewonnen: number; verloren: number; quote: number | null } {
  const warAngebot = (c: Chance) => c.historie.some(h => h.stufe === 'angebot' || h.stufe === 'abschluss');
  const g = chancen.filter(c => c.stufe === 'gewonnen' && warAngebot(c)).length;
  const v = chancen.filter(c => c.stufe === 'verloren' && warAngebot(c)).length;
  return { gewonnen: g, verloren: v, quote: g + v >= 10 ? Math.round((g / (g + v)) * 100) : null };
}

// ── Sales zu zweit (25.09.) ─────────────────────────────────────────────────
// Kevin verantwortet Sales, Malin macht auch Sales. Die Zahlen je Person
// zeigen, wo was liegt und was als Nächstes dran ist — kein Ranking. Die
// Regeln (verantwortlich je Welt, zuständig je Eintrag) stehen in team.ts.

/** Wer die Aufgabe zu einem Eintrag bekommt: die/der Zuständige — bei „beide“ die Person, die fragt. */
export function bearbeiterFuer(z: string | undefined, welt: Welt, person: string): string {
  const e = zustaendig(z, welt);
  return e === BEIDE ? person : e;
}

/**
 * Zahlen für den Filter „Alle · Meins · Malin“ (components/os/crm/team.tsx):
 * je Wahl, wie viele Einträge passen — Gemeinsames („beide“) zählt bei beiden,
 * genau wie passtWer() filtert.
 */
export function werZahlen<T>(liste: T[], z: (x: T) => string | undefined, welt: Welt, ich: string | null): Record<string, number> {
  const zaehl = (p: string) => liste.filter(x => { const e = zustaendig(z(x), welt); return e === p || e === BEIDE; }).length;
  const r: Record<string, number> = { alle: liste.length };
  for (const t of TEAM) r[t.id] = zaehl(t.id);
  if (ich) r.ich = r[ich] ?? zaehl(ich);
  return r;
}

export interface PersonPrognose { person: string; anzahl: number; offen: number; gewichtet: number; commit: number; haengt: number; ohneSchritt: number }
/** Prognose je Besitzer der Chance (ohne Eintrag: Sales-Verantwortung). „Beide“ nur, wenn es gemeinsame Chancen gibt. */
export function prognoseJePerson(chancen: Chance[], heute: string, eigene?: CrmBestand['wahrscheinlichkeiten']): PersonPrognose[] {
  return [...TEAM.map(t => t.id), BEIDE].map(person => {
    const p = prognose(chancen.filter(c => zustaendig(c.besitzer, 'sales') === person), heute, eigene);
    return {
      person, anzahl: p.jeStufe.reduce((a, s) => a + s.anzahl, 0), offen: p.offen, gewichtet: p.gewichtet, commit: p.commit,
      haengt: p.jeStufe.reduce((a, s) => a + s.haengt, 0), ohneSchritt: p.ohneSchritt,
    };
  }).filter(x => x.person !== BEIDE || x.anzahl > 0);
}

/** Ein echtes Gespräch: Ergebnis Gespräch oder Termin — oder ein Gespräch ohne Ergebnis-Knopf (z. B. aus einer Kampagne). */
export const echtesGespraech = (a: Pick<Aktivitaet, 'art' | 'ergebnis'>) => a.ergebnis === 'gespraech' || a.ergebnis === 'termin' || (!a.ergebnis && a.art === 'gespraech');

export interface TeamTag { person: string; powerHours: { heute: number; woche: number }; gespraeche: { heute: number; woche: number } }
const tagPlus = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
/**
 * Team-Zeile in der Power Hour: abgeschlossene Power Hours (Sitzungen je
 * Person) und echte Gespräche (Verlauf, „von“) — heute und in den letzten
 * sieben Tagen einschließlich heute. System, Jarvis und Signale zählen nicht.
 */
export function teamZahlen(kontakte: Pick<Kontakt, 'aktivitaeten'>[], sitzungen: Pick<PowerHourSitzung, 'person' | 'datum'>[], heute: string): TeamTag[] {
  const ab = tagPlus(heute, -6);
  const inWoche = (d: string) => d >= ab && d <= heute;
  const gespraeche = new Map<string, string[]>();
  for (const k of kontakte) for (const a of k.aktivitaeten ?? []) if (echtesGespraech(a)) gespraeche.set(a.von, [...(gespraeche.get(a.von) ?? []), a.am.slice(0, 10)]);
  return TEAM.map(t => {
    const s = sitzungen.filter(x => x.person === t.id).map(x => x.datum);
    const g = gespraeche.get(t.id) ?? [];
    return { person: t.id, powerHours: { heute: s.filter(d => d === heute).length, woche: s.filter(inWoche).length }, gespraeche: { heute: g.filter(d => d === heute).length, woche: g.filter(inWoche).length } };
  });
}

export interface KampagnenBeitrag { person: string; angesprochen: number; gespraeche: number; chancen: number }
/**
 * Wer in einer Kampagne wen angesprochen hat (Ergebnisse mit „von“): je Person
 * die Zahl der Personen, mit denen sie etwas festgehalten hat, und wie viele
 * davon zum Gespräch oder zur Chance wurden. Ohne „von“ (ältere Einträge):
 * person = ''.
 */
export function kampagneJePerson(k: Pick<Kampagne, 'ergebnisse'>): KampagnenBeitrag[] {
  const je = new Map<string, Map<string, Set<KampagnenErgebnis>>>();
  for (const e of k.ergebnisse) {
    const p = e.von ?? '';
    const m = je.get(p) ?? new Map<string, Set<KampagnenErgebnis>>();
    m.set(e.kontaktId, (m.get(e.kontaktId) ?? new Set<KampagnenErgebnis>()).add(e.ergebnis));
    je.set(p, m);
  }
  const rang = (p: string) => { const i = TEAM.findIndex(t => t.id === p); return i < 0 ? TEAM.length + (p ? 0 : 1) : i; };
  return Array.from(je.entries()).sort((a, b) => rang(a[0]) - rang(b[0])).map(([person, m]) => {
    const l = Array.from(m.values());
    return { person, angesprochen: m.size, gespraeche: l.filter(s => s.has('gespraech')).length, chancen: l.filter(s => s.has('chance')).length };
  });
}
