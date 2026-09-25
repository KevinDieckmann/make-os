// ─── Markttraktion — Geführte Runden (rein, getestet) ───────────────────────
// Stand 25.09. (echte Daten): 438 von 453 Kontakten haben keinen
// Beziehungskreis — der Pflege-Takt der Power Hour greift kaum, und an Malin
// ist noch nichts verteilt. 17 Kontakte sind „im Gespräch“, aber es gibt keine
// einzige Chance — Pipeline, Prognose und Sales-Kennzahlen bleiben leer.
//
// Statt Formularen zwei geführte Runden, Karte für Karte (Oberfläche:
// components/os/crm/Runden.tsx). Hier steht, WER in welcher Reihenfolge
// drankommt und WAS vorbelegt wird — damit ein Tastendruck je Person reicht:
//   Kreis-Runde    Kontakte ohne Kreis, Wichtige zuerst (Kunden, Mandate,
//                  Chancen → im Gespräch → Prio A/B → übrige), je Karte ein
//                  kurzer Grund, warum die Person hier steht.
//   Chancen-Runde  Kontakte im Gespräch (Gespräch, Termin, Angebot) ohne
//                  offene Chance; der Vorschlag für die Chance kommt aus der
//                  Kontaktstufe, dem eigenen Leistungskatalog und dem Verlauf.
// Nichts wird erfunden: Werte stammen aus aktiven Leistungen mit Preis,
// Hinweise aus der eigenen Notizvorlage, Daten aus dem Kontakt. Gesperrte
// Personen (Werbewiderspruch) kommen in keiner Runde vor.

import { anzeigename, KREIS_TAKT, NOTIZ_FELDER, STUFE_LABEL, type Aktivitaet, type Kontakt, type Kreis, type Prio, type Stufe } from '@/lib/make-one/crm';
import type { Chance, ChancenArt, ChancenStufe, CrmBestand, Leistung, LeistungTyp, Mandat } from './typen';
import { OFFENE_STUFEN, gesamtwert, wahrscheinlichkeit } from './pipeline';
import { werktagePlus } from './heute';
import { TEAM, BEIDE, haeltBeziehung, verantwortlich } from './team';

/** Kontaktstufen, in denen es ein laufendes Gespräch gibt — hier gehört eine Chance hin. */
export const IM_GESPRAECH: readonly Stufe[] = ['gespraech', 'termin', 'angebot'];

const PRIO_RANG: Record<Prio, number> = { A: 0, B: 1, C: 2, '': 3 };
const MANDAT_STATUS: Record<Mandat['status'], string> = { angebot: 'Angebot', verhandlung: 'Verhandlung', aktiv: 'aktiv', pausiert: 'pausiert', beendet: 'beendet' };
const PHASE_TEXT: Partial<Record<NonNullable<Kontakt['lebensphase']>, string>> = { ex_kunde: 'Ex-Kunde', multiplikator: 'Multiplikator', partner: 'Partner' };

/** „24.8.“ — mit Jahr, wenn es nicht das laufende ist. */
export function kurzDatum(iso: string, heute?: string): string {
  const [j, m, t] = iso.slice(0, 10).split('-');
  return `${Number(t)}.${Number(m)}.${heute && heute.slice(0, 4) !== j ? j.slice(2) : ''}`;
}
/** Firmenname ohne Rechtsform — „ACME Venetian Products GmbH“ → „ACME Venetian Products“. */
const ohneRechtsform = (n: string) => n.replace(/\s+(GmbH|gGmbH|UG|AG|SE|KG|OHG|GbR|Limited|Ltd\.?|Inc\.?|LLC)\b.*$/i, '').trim() || n;

/** Wer woran hängt — Mandate (alle) und offene Chancen je Kontakt. */
function bezuege(crm: CrmBestand) {
  const mandate = new Map<string, Mandat[]>();
  for (const m of crm.mandate) for (const id of m.kontaktIds) mandate.set(id, [...(mandate.get(id) ?? []), m]);
  const chancen = new Map<string, Chance[]>();
  for (const c of crm.chancen.filter(x => OFFENE_STUFEN.includes(x.stufe))) for (const id of c.kontaktIds) chancen.set(id, [...(chancen.get(id) ?? []), c]);
  return { mandate, chancen };
}
/** Jüngster letzter Kontakt zuerst, ohne Datum ans Ende, dann nach Name. */
const nachKontakt = (a: Kontakt, b: Kontakt) => (b.letzterKontakt ?? '').localeCompare(a.letzterKontakt ?? '') || anzeigename(a).localeCompare(anzeigename(b), 'de');

// ── Kreis-Runde ─────────────────────────────────────────────────────────────

/** 0 Kunde, Mandat oder Chance · 1 im Gespräch (oder Ex-Kunde, Multiplikator, Partner) · 2 Prio A/B · 3 übrige. */
export type KreisGruppe = 0 | 1 | 2 | 3;
export const KREIS_GRUPPEN: Record<KreisGruppe, string> = { 0: 'Kunde · Mandat · Chance', 1: 'Im Gespräch', 2: 'Prio A/B', 3: 'Übrige' };

export interface KreisKandidat {
  kontakt: Kontakt;
  gruppe: KreisGruppe;
  /** Gruppe 0–2: kommt in der ersten Etappe dran (dieselben Wichtigen wie im Befund „wichtige Kontakte ohne Kreis“). */
  wichtig: boolean;
  /** Warum die Person hier steht — „Kunde · Mandat ACME“, „im Gespräch · zuletzt 24.8.“. */
  grund: string;
}

/** Die vier Kreise mit Taste, Takt (lib/make-one/crm.ts KREIS_TAKT) und einem Wort, was sie bedeuten. */
export const KREIS_WAHL: { id: Kreis; taste: string; takt: number; text: string }[] = [
  { id: 'A', taste: '1', takt: KREIS_TAKT.A, text: 'eng' },
  { id: 'B', taste: '2', takt: KREIS_TAKT.B, text: 'wichtig' },
  { id: 'C', taste: '3', takt: KREIS_TAKT.C, text: 'locker' },
  { id: 'D', taste: '4', takt: KREIS_TAKT.D, text: 'Netzwerk' },
];

/**
 * Wer bekommt einen Kreis — und in welcher Reihenfolge?
 * Alle ohne Kreis und ohne Werbesperre, sortiert nach Gruppe (Kunde, Mandat
 * oder offene Chance → im Gespräch/Termin/Angebot/gewonnen → Prio A/B →
 * übrige), in der Gruppe nach Prio und dann nach dem jüngsten letzten Kontakt.
 * „zuletzt“ statt „seit“: Die Kartei protokolliert Stufenwechsel nicht immer —
 * belegt ist nur der letzte echte Kontakt.
 */
export function kreisKandidaten(kontakte: Kontakt[], crm: CrmBestand, heute: string): KreisKandidat[] {
  const { mandate, chancen } = bezuege(crm);
  const zuletzt = (k: Kontakt) => (k.letzterKontakt ? `zuletzt ${kurzDatum(k.letzterKontakt, heute)}` : '');
  const r: KreisKandidat[] = [];
  for (const k of kontakte) {
    if (k.kreis || k.werbesperre) continue;
    const ms = mandate.get(k.id) ?? [];
    const laufend = ms.filter(m => m.status !== 'beendet');
    const offen = chancen.get(k.id) ?? [];
    let gruppe: KreisGruppe;
    const teile: string[] = [];
    if (k.lebensphase === 'kunde' || laufend.length || offen.length) {
      gruppe = 0;
      if (k.lebensphase === 'kunde') teile.push('Kunde');
      if (laufend.length) { const m = laufend[0]; teile.push(`Mandat ${ohneRechtsform(m.kunde)}${m.status !== 'aktiv' ? ` (${MANDAT_STATUS[m.status]})` : ''}${laufend.length > 1 ? ` +${laufend.length - 1}` : ''}`); }
      if (offen.length) teile.push(`Chance „${offen[0].titel}“${offen.length > 1 ? ` +${offen.length - 1}` : ''}`);
    } else if ([...IM_GESPRAECH, 'gewonnen'].includes(k.stufe) || (k.lebensphase && PHASE_TEXT[k.lebensphase]) || ms.length) {
      gruppe = 1;
      if (k.stufe !== 'neu' && k.stufe !== 'ansprechen') teile.push(k.stufe === 'gespraech' ? 'im Gespräch' : STUFE_LABEL[k.stufe]);
      if (k.lebensphase && PHASE_TEXT[k.lebensphase]) teile.push(PHASE_TEXT[k.lebensphase]!);
      if (ms.length) teile.push(`früher Mandat ${ohneRechtsform(ms[0].kunde)}`);
      if (zuletzt(k)) teile.push(zuletzt(k));
    } else if (k.prio === 'A' || k.prio === 'B') {
      gruppe = 2;
      teile.push(`Prio ${k.prio}${k.eignung ? ` · Eignung ${k.eignung}` : ''}`);
      if (zuletzt(k)) teile.push(zuletzt(k));
    } else {
      gruppe = 3;
      teile.push(k.prio ? `Prio ${k.prio}` : 'ohne Prio');
      if (zuletzt(k)) teile.push(zuletzt(k));
    }
    r.push({ kontakt: k, gruppe, wichtig: gruppe < 3, grund: teile.join(' · ') });
  }
  return r.sort((a, b) => a.gruppe - b.gruppe || PRIO_RANG[a.kontakt.prio ?? ''] - PRIO_RANG[b.kontakt.prio ?? ''] || nachKontakt(a.kontakt, b.kontakt));
}

/** Eine Entscheidung in der Kreis-Runde — kreis null = übersprungen. */
export interface KreisEntscheid { kontaktId: string; kreis: Kreis | null; besitzer: string; anrede?: 'Sie' | 'Du' }
export interface KreisBilanz { gesetzt: number; uebersprungen: number; jeKreis: Record<Kreis, number>; jePerson: Record<string, number> }

/** Zähler je Kreis und je Person (wer die Beziehung hält) — nur gesetzte Karten zählen bei den Personen. */
export function kreisBilanz(entscheide: KreisEntscheid[]): KreisBilanz {
  const jeKreis: Record<Kreis, number> = { A: 0, B: 0, C: 0, D: 0 };
  const jePerson: Record<string, number> = Object.fromEntries([...TEAM.map(t => t.id), BEIDE].map(p => [p, 0]));
  let uebersprungen = 0;
  for (const e of entscheide) {
    if (!e.kreis) { uebersprungen++; continue; }
    jeKreis[e.kreis]++;
    jePerson[e.besitzer] = (jePerson[e.besitzer] ?? 0) + 1;
  }
  return { gesetzt: entscheide.length - uebersprungen, uebersprungen, jeKreis, jePerson };
}

/** „A 8 · B 14 · C 3 · D 1 · an Malin 6 · gemeinsam 2 · 5 übersprungen“ — verteilt heißt: weg von der Sales-Verantwortung. */
export function kreisZusammenfassung(b: KreisBilanz): string {
  const teile = KREIS_WAHL.map(w => `${w.id} ${b.jeKreis[w.id]}`);
  const sales = verantwortlich('sales');
  for (const t of TEAM) if (t.id !== sales && b.jePerson[t.id]) teile.push(`an ${t.name} ${b.jePerson[t.id]}`);
  if (b.jePerson[BEIDE]) teile.push(`gemeinsam ${b.jePerson[BEIDE]}`);
  if (b.uebersprungen) teile.push(`${b.uebersprungen} übersprungen`);
  return teile.join(' · ');
}

/** Die jüngste Notiz aus dem Verlauf (Notizvorlage oder Text) — Systemeinträge zählen nicht. */
export function letzteNotiz(k: Pick<Kontakt, 'aktivitaeten'>): { am: string; von: string; text: string } | null {
  const l = (k.aktivitaeten ?? []).filter(a => a.art !== 'system' && (a.notiz || a.text)).sort((a, b) => a.am.localeCompare(b.am));
  const a = l[l.length - 1];
  if (!a) return null;
  const vorlage = a.notiz ? NOTIZ_FELDER.filter(f => a.notiz?.[f.id]).map(f => `${f.label}: ${a.notiz![f.id]}`).join(' · ') : '';
  return { am: a.am, von: a.von, text: vorlage || a.text || '' };
}

// ── Chancen-Runde ───────────────────────────────────────────────────────────

/** Kontaktstufe → Chancenstufe: ein Angebot ist ein Angebot, ein Termin die Diagnose, ein Gespräch der Bedarf. */
export const STUFE_ZU_CHANCE: Record<'gespraech' | 'termin' | 'angebot', ChancenStufe> = { angebot: 'angebot', termin: 'diagnose', gespraech: 'bedarf' };
export const CHANCEN_ARTEN: { id: ChancenArt; label: string }[] = [
  { id: 'retainer', label: 'Retainer' }, { id: 'projekt', label: 'Projekt' }, { id: 'workshop', label: 'Workshop' },
  { id: 'vermittlung', label: 'Vermittlung' }, { id: 'software', label: 'Software' },
];
/** Ein Klick statt Tippen — typische nächste Schritte je Stufe. */
export const SCHRITT_VORSCHLAEGE: Partial<Record<ChancenStufe, string[]>> = {
  qualifiziert: ['Gespräch mit dem Entscheider vereinbaren'],
  bedarf: ['Bedarf im Gespräch klären', 'Diagnose-Termin vereinbaren'],
  diagnose: ['Diagnose vorbereiten', 'Termin bestätigen'],
  angebot: ['Angebot nachfassen', 'Entscheidungstermin erfragen'],
  abschluss: ['Vertrag nachhalten'],
};

const ART_ZU_TYP: Record<ChancenArt, LeistungTyp[]> = { retainer: ['retainer'], projekt: ['sprint', 'diagnose'], workshop: ['workshop'], vermittlung: ['vermittlung'], software: ['software'] };
const LEISTUNG_RANG: Record<Leistung['stufe'], number> = { kern: 0, einstieg: 1, premium: 2 };

export interface WertVorschlag { betrag: number; basis: 'monat' | 'einmalig'; leistungId?: string; leistung?: string }
/**
 * Wert aus dem eigenen Leistungskatalog: aktive Leistung dieser Art mit Preis
 * (Kern vor Einstieg vor Premium); Prozent-Provisionen zählen nicht als Betrag.
 * Ohne passende Leistung bleibt der Wert leer — lieber gelb in der Pipeline
 * als eine erfundene Zahl.
 */
export function wertFuerArt(art: ChancenArt, leistungen: Leistung[]): WertVorschlag {
  const l = leistungen
    .filter(x => x.status === 'aktiv' && ART_ZU_TYP[art].includes(x.typ) && x.preis.betrag > 0 && !x.preis.einheit.includes('%'))
    .sort((a, b) => LEISTUNG_RANG[a.stufe] - LEISTUNG_RANG[b.stufe] || a.preis.betrag - b.preis.betrag)[0];
  if (!l) return { betrag: 0, basis: art === 'retainer' ? 'monat' : 'einmalig' };
  return { betrag: l.preis.betrag, basis: /monat/i.test(l.preis.einheit) ? 'monat' : 'einmalig', leistungId: l.id, leistung: l.name };
}

export interface ChancenVorschlag {
  titel: string; firma?: string; art: ChancenArt; wert: WertVorschlag; stufe: ChancenStufe;
  /** Aus dem Kontakt (zugesagter Schritt) oder der letzten Notiz; sonst leer — der Schritt ist Pflicht. */
  naechsterSchritt: { text: string; datum: string };
  erwartetAm?: string;
}
export interface ChancenKandidat {
  kontakt: Kontakt;
  /** „Angebot · zuletzt 23.2. · Prio B“. */
  grund: string;
  /** Aus dem Verlauf und dem Bestand: Bedarf, Zusage, laufendes Mandat, frühere Chance. */
  hinweise: string[];
  /** Die letzten drei Einträge im Verlauf (ohne System), älteste zuerst. */
  auszug: Aktivitaet[];
  vorschlag: ChancenVorschlag;
  /** Welche Stufe „kein Bedarf“ setzt: bei laufendem Mandat bleibt die Person Kunde (gewonnen), sonst ruht sie. */
  keinBedarf: Extract<Stufe, 'ruht' | 'gewonnen'>;
}

/**
 * Wer ist im Gespräch, hat aber keine offene Chance? Kontakte in Stufe
 * Gespräch, Termin oder Angebot, ohne Werbesperre — Angebote zuerst, dann
 * Termine, dann Gespräche, jeweils jüngster Kontakt zuerst. Eine verlorene
 * oder geparkte Chance zählt nicht als offen (steht aber als Hinweis da).
 */
export function chancenKandidaten(kontakte: Kontakt[], crm: CrmBestand, heute?: string): ChancenKandidat[] {
  const { mandate, chancen } = bezuege(crm);
  const firmaVon = new Map(crm.firmen.map(f => [f.id, f.name]));
  const rang: Record<string, number> = { angebot: 0, termin: 1, gespraech: 2 };
  const standardDatum = heute ? werktagePlus(heute, 3) : '';
  const wert = wertFuerArt('retainer', crm.leistungen);
  return kontakte
    .filter(k => IM_GESPRAECH.includes(k.stufe) && !k.werbesperre && !(chancen.get(k.id) ?? []).length)
    .sort((a, b) => rang[a.stufe] - rang[b.stufe] || nachKontakt(a, b))
    .map(k => {
      const firma = (k.firmaId && firmaVon.get(k.firmaId)) || k.firma || undefined;
      const verlauf = (k.aktivitaeten ?? []).filter(a => a.art !== 'system').sort((a, b) => a.am.localeCompare(b.am));
      const mitNotiz = [...verlauf].reverse().find(a => a.notiz);
      const hinweise: string[] = [];
      if (k.naechsterSchritt) hinweise.push(`Zugesagt: ${k.naechsterSchritt.text} (${kurzDatum(k.naechsterSchritt.datum, heute)})`);
      if (mitNotiz?.notiz?.bedarf) hinweise.push(`Bedarf: ${mitNotiz.notiz.bedarf}`);
      if (mitNotiz?.notiz?.zusage) hinweise.push(`Unsere Zusage: ${mitNotiz.notiz.zusage}`);
      if (mitNotiz?.notiz?.signale) hinweise.push(`Signale: ${mitNotiz.notiz.signale}`);
      const alleMandate = mandate.get(k.id) ?? [];
      const laufend = alleMandate.filter(m => m.status !== 'beendet');
      for (const m of laufend) hinweise.push(`Mandat ${ohneRechtsform(m.kunde)} (${MANDAT_STATUS[m.status]}) — Chance nur für etwas Zusätzliches anlegen`);
      for (const m of alleMandate.filter(m => m.status === 'beendet')) hinweise.push(`Früheres Mandat ${ohneRechtsform(m.kunde)} (beendet)`);
      for (const c of crm.chancen.filter(c => c.kontaktIds.includes(k.id) && !OFFENE_STUFEN.includes(c.stufe))) hinweise.push(`Frühere Chance „${c.titel}“: ${c.stufe}${c.grund ? ` (${c.grund})` : ''}`);
      // Zugesagter Schritt vor der Notiz; ein überfälliges Datum rückt auf heute, sonst wäre die Chance ab der ersten Minute rot.
      const ns = k.naechsterSchritt ?? (mitNotiz?.notiz?.naechster ? { text: mitNotiz.notiz.naechster, datum: standardDatum } : { text: '', datum: standardDatum });
      const datum = heute && ns.datum && ns.datum < heute ? heute : ns.datum;
      return {
        kontakt: k,
        grund: [STUFE_LABEL[k.stufe], k.letzterKontakt ? `zuletzt ${kurzDatum(k.letzterKontakt, heute)}` : 'noch kein Kontakt vermerkt', k.prio ? `Prio ${k.prio}` : ''].filter(Boolean).join(' · '),
        hinweise,
        auszug: verlauf.slice(-3),
        vorschlag: {
          titel: firma ?? anzeigename(k), ...(firma ? { firma } : {}), art: 'retainer' as ChancenArt, wert,
          stufe: STUFE_ZU_CHANCE[k.stufe as keyof typeof STUFE_ZU_CHANCE], naechsterSchritt: { text: ns.text, datum },
        },
        keinBedarf: laufend.some(m => m.status === 'aktiv') ? 'gewonnen' as const : 'ruht' as const,
      };
    });
}

/** Wem die neue Chance gehört: wer die Beziehung hält — bei „beide“ die Person, die sie anlegt. */
export function chanceBesitzer(k: Pick<Kontakt, 'besitzer'>, ich?: string | null): string {
  const h = haeltBeziehung(k);
  return h === BEIDE ? ich || verantwortlich('sales') : h;
}

/** Nächster Schritt ist Pflicht: Text und gültiges Datum. */
export const schrittOk = (s: { text: string; datum: string }) => !!s.text.trim() && /^\d{4}-\d{2}-\d{2}$/.test(s.datum);

export interface ChancenEingabe {
  titel: string; firma?: string; art: ChancenArt; betrag: number; basis: 'monat' | 'einmalig'; stufe: ChancenStufe;
  naechsterSchritt: { text: string; datum: string }; erwartetAm?: string; besitzer: string; leistungId?: string;
}
/**
 * Die Chance, wie sie gespeichert wird — Felder nach lib/crm/typen.ts, so dass
 * der Säuberer (lib/crm/speicher.ts) nichts verwirft. Historie beginnt mit der
 * Anlage durch `von`; Qualifizierung „unklar“, bis jemand sie klärt.
 */
export function chanceAnlegen(id: string, k: Kontakt, e: ChancenEingabe, jetzt: string, von: string): Chance {
  const erwartet = e.erwartetAm && /^\d{4}-\d{2}-\d{2}$/.test(e.erwartetAm) ? e.erwartetAm : undefined;
  return {
    id, titel: e.titel.trim() || anzeigename(k), kontaktIds: [k.id], ...(e.firma ? { firma: e.firma } : {}),
    art: e.art, ...(e.leistungId ? { leistungId: e.leistungId } : {}),
    wert: { betrag: Math.max(0, Math.round(Number.isFinite(e.betrag) ? e.betrag : 0)), basis: e.basis },
    stufe: e.stufe, historie: [{ stufe: e.stufe, am: jetzt, von }],
    naechsterSchritt: { text: e.naechsterSchritt.text.trim(), datum: e.naechsterSchritt.datum },
    qualifizierung: { schmerz: 'unklar', entscheider: 'unklar', budget: 'unklar', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' },
    ...(erwartet ? { erwartetAm: erwartet } : {}),
    gesellschaft: 'offen', besitzer: e.besitzer, angelegt: jetzt, geaendert: jetzt,
  };
}

/** Anzahl, Summe (Gesamtwert, Monatshonorar × 12) und gewichtete Summe (× Wahrscheinlichkeit der Stufe). */
export function chancenBilanz(chancen: Pick<Chance, 'wert' | 'stufe'>[], eigene?: CrmBestand['wahrscheinlichkeiten']): { anzahl: number; summe: number; gewichtet: number } {
  return chancen.reduce((a, c) => {
    const w = gesamtwert(c);
    return { anzahl: a.anzahl + 1, summe: a.summe + w, gewichtet: a.gewichtet + Math.round(w * wahrscheinlichkeit(c.stufe, eigene) / 100) };
  }, { anzahl: 0, summe: 0, gewichtet: 0 });
}
