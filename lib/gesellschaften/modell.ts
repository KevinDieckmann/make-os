// ─── MAKE OS — Gesellschafts-Register: Modell und Regeln (rein, client-sicher, 04.10.) ─────────────────────────────
// Kevin 04.10.: „Würde dir noch etwas fehlen, damit wir sauber die ganzen Firmen planen können — vor allem jetzt sauber
// die MAKE Innovation GmbH? … Kriegen wir dort jetzt alles sauber geplant?“ Leitregel 80/20: klar, seriös,
// investor-tauglich, kein Gewusel; alles verbunden, eine Quelle.
//
// EINE Quelle: der bestehende Speicher `gesellschaften--<haushalt>` (bisher nur die Absender der Angebote,
// lib/crm/gesellschaften.ts). Jede Gesellschaft ist EIN Eintrag; alles Neue steht als OPTIONALES Feld IN diesem Eintrag
// (Steckbrief, Gesellschafter, Beteiligungen, Verträge). Warum im Eintrag und nicht daneben: der Online-Stand schreibt
// einen Eintrag als `{ ...alt, … }` zurück und behält fremde Einträge — Felder im Eintrag überleben so einen Rückweg,
// zusätzliche Schlüssel auf oberster Ebene nicht.
//   · Die drei festen Gesellschaften (kdc · kdv · ug, lib/einheiten.ts) erscheinen immer — auch ohne gespeicherten Eintrag.
//   · Weitere eigene Gesellschaften: Kennung `g-<uuid>` (offene Liste) — Namen, Beträge, HRB trägt der Haushalt ein, nie der Code.
//   · „Hält“ (Beteiligungen an eigenen Gesellschaften) wird aus den Gesellschafter-Einträgen ABGELEITET, nie doppelt gespeichert.
//     Gespeichert werden nur Beteiligungen an FREMDEN Firmen (CRM-Firma).
//   · Archivieren/Löschen wie überall (lib/eintraege/sicher.ts): Archiv = Status „ruhend“/„aufgelöst“ (Gesellschaft),
//     „ausgeschieden“ (Gesellschafter), „beendet“ (Beteiligung, Vertrag); Löschen = Papierkorb 30 Tage.
// Tests: tests/gesellschaften-register.test.ts.

import { KERN_EINHEITEN, istGesellschaft, istGesellschaftId, istRegisterKennung, type GesellschaftId, type Gesellschaftskennung } from '@/lib/einheiten';
import type { Gesellschaft as Absender } from '@/lib/crm/gesellschaften';
import { imPapierkorb, inPapierkorb, ausPapierkorb, papierkorbAbgelaufen } from '@/lib/eintraege/sicher';

// ── Wertelisten ──────────────────────────────────────────────────────────────────────────────────────────────────

export type Rechtsform = 'gmbh' | 'ug' | 'ag' | 'gmbh-co-kg' | 'kg' | 'ohg' | 'gbr' | 'einzel' | 'sonstige';
export const RECHTSFORMEN: readonly { id: Rechtsform; label: string }[] = [
  { id: 'gmbh', label: 'GmbH' }, { id: 'ug', label: 'UG (haftungsbeschränkt)' }, { id: 'ag', label: 'AG' },
  { id: 'gmbh-co-kg', label: 'GmbH & Co. KG' }, { id: 'kg', label: 'KG' }, { id: 'ohg', label: 'OHG' }, { id: 'gbr', label: 'GbR' },
  { id: 'einzel', label: 'Einzelunternehmen' }, { id: 'sonstige', label: 'Sonstige' },
];
/** Rechtsformen mit Stammkapital und Gesellschaftern (Cap-Table). */
export const MIT_STAMMKAPITAL: readonly Rechtsform[] = ['gmbh', 'ug', 'ag', 'gmbh-co-kg'];

export type GesStatus = 'geplant' | 'gruendung' | 'eingetragen' | 'ruhend' | 'aufgeloest';
export const GES_STATUS: readonly { id: GesStatus; label: string }[] = [
  { id: 'geplant', label: 'geplant' }, { id: 'gruendung', label: 'in Gründung' }, { id: 'eingetragen', label: 'eingetragen' },
  { id: 'ruhend', label: 'ruhend' }, { id: 'aufgeloest', label: 'aufgelöst' },
];
/** Archiv einer Gesellschaft = ruhend oder aufgelöst (zurückholbar). */
export const istArchiviertStatus = (s: GesStatus | undefined): boolean => s === 'ruhend' || s === 'aufgeloest';

export type BezugArt = 'person' | 'gesellschaft' | 'kontakt' | 'firma';
export const BEZUG_ARTEN: readonly { id: BezugArt; label: string }[] = [
  { id: 'gesellschaft', label: 'Eigene Gesellschaft' }, { id: 'person', label: 'Person im Haushalt' },
  { id: 'kontakt', label: 'Kontakt (CRM)' }, { id: 'firma', label: 'Firma (CRM)' },
];
/** Wer: eine Person des Haushalts (Konto), eine eigene Gesellschaft, ein CRM-Kontakt oder eine CRM-Firma — nur die Kennung. */
export interface Bezug { art: BezugArt; id: string }

export type Einlage = 'ja' | 'teil' | 'nein';
export const EINLAGEN: readonly { id: Einlage; label: string }[] = [{ id: 'ja', label: 'voll eingezahlt' }, { id: 'teil', label: 'teilweise' }, { id: 'nein', label: 'offen' }];

export interface Gesellschafter {
  /** `gs-<uuid>` */
  id: string;
  wer: Bezug;
  /** Nennbetrag des Geschäftsanteils in Cent. */
  nennbetragCent: number;
  einlage: Einlage;
  /** Bei „teilweise“: wie viel eingezahlt ist (Cent). */
  eingezahltCent?: number;
  einlageAm?: string;
  /** Ohne Stimmrecht (stimmrechtslose Anteile) — fehlt = mit Stimmrecht. */
  ohneStimmrecht?: true;
  /** Vesting, Vorkaufsrecht, Drag-/Tag-along … als Text. */
  klauseln?: string;
  eingetretenAm?: string;
  /** Archiv: ausgeschieden (zählt nicht mehr in der Cap-Table). */
  ausgeschiedenAm?: string;
  geloeschtAm?: string;
}

export interface FremdBeteiligung {
  /** `bt-<uuid>` */
  id: string;
  /** CRM-Firma (Kennung). */
  firmaId: string;
  anteilProzent?: number;
  nennbetragCent?: number;
  erwerbAm?: string;
  preisCent?: number;
  notiz?: string;
  /** Archiv: beendet (verkauft/aufgegeben). */
  beendetAm?: string;
  geloeschtAm?: string;
}

export type VertragArt = 'gesellschaftsvertrag' | 'gesellschaftervereinbarung' | 'gf-vertrag' | 'darlehen' | 'beteiligung' | 'kooperation' | 'sonstiges';
export const VERTRAG_ARTEN: readonly { id: VertragArt; label: string }[] = [
  { id: 'gesellschaftsvertrag', label: 'Gesellschaftsvertrag' }, { id: 'gesellschaftervereinbarung', label: 'Gesellschaftervereinbarung' },
  { id: 'gf-vertrag', label: 'Geschäftsführervertrag' }, { id: 'darlehen', label: 'Darlehen' }, { id: 'beteiligung', label: 'Beteiligung' },
  { id: 'kooperation', label: 'Kooperation' }, { id: 'sonstiges', label: 'Sonstiges' },
];
export type VertragStatus = 'entwurf' | 'verhandlung' | 'unterschrieben' | 'beurkundet' | 'beendet';
export const VERTRAG_STATUS: readonly { id: VertragStatus; label: string }[] = [
  { id: 'entwurf', label: 'Entwurf' }, { id: 'verhandlung', label: 'Verhandlung' }, { id: 'unterschrieben', label: 'unterschrieben' },
  { id: 'beurkundet', label: 'beurkundet' }, { id: 'beendet', label: 'beendet' },
];
/** Ein Stichtag am Vertrag (Option, Cliff, Zinstermin …) — Datum + Text, erscheint im Kalender. */
export interface VertragFrist { id: string; datum: string; text: string }
export interface Vertrag {
  /** `vt-<uuid>` */
  id: string;
  art: VertragArt;
  titel: string;
  parteien: Bezug[];
  status: VertragStatus;
  /** Status vor „beendet“ — Zurückholen stellt ihn wieder her. */
  vorArchiv?: VertragStatus;
  /** Unterlagen in der Dateiablage (Kennungen `d-…`, Bezug = diese Gesellschaft). */
  dateiIds?: string[];
  beginn?: string;
  /** Laufzeit bis (Ende). */
  ende?: string;
  /** frei, z. B. „6 Monate zum Jahresende“. */
  kuendigungsfrist?: string;
  /** Bis wann gekündigt werden muss — erscheint im Kalender. */
  kuendigenBis?: string;
  /**
   * Erinnerung vor „kündigen bis“ (04.10. Nachtrag, Kevin): so viele Tage vorher Meldung in der Glocke + Aufgabe.
   * Fehlt = `ERINNERUNG_VORGABE_TAGE`; 0 = keine Erinnerung.
   */
  erinnerungTage?: number;
  fristen?: VertragFrist[];
  notiz?: string;
  geloeschtAm?: string;
}

/** Vorlauf der Erinnerung vor „kündigen bis“, solange am Vertrag nichts steht. */
export const ERINNERUNG_VORGABE_TAGE = 30;

// ── Rolle, Beschlüsse, Organe (04.10. Nachtrag, Kevin: „KD Ventures = reine Holding“, „Beschlüsse & Organe als eigene Liste“) ──

/** Rolle einer Gesellschaft: operativ (Standard) oder reine Holding — für eine Holding gelten operative Kennzahlen nicht. */
export type GesRolle = 'operativ' | 'holding';
export const GES_ROLLEN: readonly { id: GesRolle; label: string }[] = [{ id: 'operativ', label: 'operativ' }, { id: 'holding', label: 'Holding' }];

export type BeschlussArt = 'gesellschafterbeschluss' | 'gf-beschluss' | 'umlaufbeschluss' | 'beiratsbeschluss' | 'sonstiges';
export const BESCHLUSS_ARTEN: readonly { id: BeschlussArt; label: string }[] = [
  { id: 'gesellschafterbeschluss', label: 'Gesellschafterbeschluss' }, { id: 'gf-beschluss', label: 'GF-Beschluss' },
  { id: 'umlaufbeschluss', label: 'Umlaufbeschluss' }, { id: 'beiratsbeschluss', label: 'Beiratsbeschluss' }, { id: 'sonstiges', label: 'Sonstiges' },
];
export type BeschlussStatus = 'entwurf' | 'gefasst' | 'eingetragen' | 'aufgehoben';
export const BESCHLUSS_STATUS: readonly { id: BeschlussStatus; label: string }[] = [
  { id: 'entwurf', label: 'Entwurf' }, { id: 'gefasst', label: 'gefasst' }, { id: 'eingetragen', label: 'eingetragen' }, { id: 'aufgehoben', label: 'aufgehoben' },
];
export interface Beschluss {
  /** `bs-<uuid>` */
  id: string;
  datum: string;
  art: BeschlussArt;
  titel: string;
  inhalt?: string;
  status: BeschlussStatus;
  /** Status vor „aufgehoben“ (Archiv) — Zurückholen stellt ihn wieder her. */
  vorArchiv?: BeschlussStatus;
  /** Unterlagen in der Dateiablage (Bezug = diese Gesellschaft). */
  dateiIds?: string[];
  geloeschtAm?: string;
}

export type OrganFunktion = 'geschaeftsfuehrung' | 'prokura' | 'beirat' | 'aufsichtsrat' | 'sonstiges';
export const ORGAN_FUNKTIONEN: readonly { id: OrganFunktion; label: string }[] = [
  { id: 'geschaeftsfuehrung', label: 'Geschäftsführung' }, { id: 'prokura', label: 'Prokura' }, { id: 'beirat', label: 'Beirat' },
  { id: 'aufsichtsrat', label: 'Aufsichtsrat' }, { id: 'sonstiges', label: 'Sonstiges' },
];
export interface Organ {
  /** `og-<uuid>` */
  id: string;
  funktion: OrganFunktion;
  /** Person im Haushalt oder CRM-Kontakt (nur Kennung). */
  wer: Bezug;
  seit?: string;
  /** Archiv: ausgeschieden bis. */
  bis?: string;
  notiz?: string;
  geloeschtAm?: string;
}

/** Ein Eintrag des Registers: die Absender-Felder (lib/crm/gesellschaften.ts) + Steckbrief + Listen — alles Neue optional. */
export interface RegisterGesellschaft extends Omit<Absender, 'id'> {
  id: GesellschaftId;
  /** Anzeigename einer Register-Gesellschaft (`g-…`). Die drei festen heißen wie in lib/einheiten.ts. */
  name?: string;
  rechtsform?: Rechtsform;
  status?: GesStatus;
  /** Rolle (operativ · Holding) — wählt der Haushalt in der Oberfläche; nie eine feste Firma im Code. */
  rolle?: GesRolle;
  /** Status vor dem Archiv — Zurückholen stellt ihn wieder her. */
  vorArchiv?: GesStatus;
  sitz?: string;
  gegruendetAm?: string;
  eingetragenAm?: string;
  stammkapitalCent?: number;
  eingezahltCent?: number;
  /** Erster Monat des Geschäftsjahres (1–12) — fehlt = Kalenderjahr. */
  geschaeftsjahrBeginn?: number;
  /** „Hervorgegangen aus“ (Umfirmierung, Umwandlung) — eine andere eigene Gesellschaft. */
  vorgaengerId?: GesellschaftId;
  notizen?: string;
  gesellschafter?: Gesellschafter[];
  beteiligungen?: FremdBeteiligung[];
  vertraege?: Vertrag[];
  beschluesse?: Beschluss[];
  organe?: Organ[];
  angelegt?: string;
  geloeschtAm?: string;
}
export interface RegisterDatei { gesellschaften: RegisterGesellschaft[] }

export type RegisterListe = 'gesellschafter' | 'beteiligungen' | 'vertraege' | 'beschluesse' | 'organe';
export const REGISTER_LISTEN: readonly RegisterListe[] = ['gesellschafter', 'beteiligungen', 'vertraege', 'beschluesse', 'organe'];
export const PRAEFIX: Record<RegisterListe, string> = { gesellschafter: 'gs', beteiligungen: 'bt', vertraege: 'vt', beschluesse: 'bs', organe: 'og' };
/** Ein Eintrag irgendeiner Liste des Registers. */
export type ListenEintrag = Gesellschafter | FremdBeteiligung | Vertrag | Beschluss | Organ;

/** Grenzen (nie still kürzen — darüber 413/400 mit Text). */
export const GRENZEN = { gesellschaften: 60, gesellschafter: 80, beteiligungen: 80, vertraege: 120, beschluesse: 300, organe: 60, parteien: 12, dateien: 20, fristen: 20 } as const;

// ── Lesen ────────────────────────────────────────────────────────────────────────────────────────────────────────

const FESTE: readonly Gesellschaftskennung[] = KERN_EINHEITEN.map(e => e.id);

/** Anzeigename: die festen aus lib/einheiten.ts (eine Quelle), Register-Gesellschaften ihr Name bzw. ihre Firmierung. */
export function anzeigeName(g: Pick<RegisterGesellschaft, 'id' | 'name' | 'firmierung'>): string {
  const fest = KERN_EINHEITEN.find(e => e.id === g.id);
  if (fest) return fest.label;
  return g.name || g.firmierung || 'Gesellschaft ohne Namen';
}

/**
 * ALLE Gesellschaften des Haushalts: die drei festen (gespeichert oder leer) in fester Reihenfolge, danach die aus dem
 * Register (`g-…`) nach Name. `mitPapierkorb` nur für Papierkorb-Ansicht und Aufräumen.
 */
export function alleGesellschaften(d: RegisterDatei | null | undefined, o: { mitPapierkorb?: boolean } = {}): RegisterGesellschaft[] {
  const l = Array.isArray(d?.gesellschaften) ? d!.gesellschaften : [];
  const feste = FESTE.map(id => l.find(g => g.id === id) ?? ({ id } as RegisterGesellschaft));
  const reg = l.filter(g => istRegisterKennung(g.id) && (o.mitPapierkorb || !imPapierkorb(g)))
    .sort((a, b) => anzeigeName(a).localeCompare(anzeigeName(b), 'de'));
  return [...feste, ...reg];
}

/** Gesellschaft nach Kennung (feste immer, auch ohne Eintrag). */
export function gesellschaftVon(d: RegisterDatei | null | undefined, id: string): RegisterGesellschaft | null {
  if (istGesellschaft(id)) return (d?.gesellschaften ?? []).find(g => g.id === id) ?? ({ id } as RegisterGesellschaft);
  return (d?.gesellschaften ?? []).find(g => g.id === id) ?? null;
}

export const statusLabel = (s?: GesStatus) => GES_STATUS.find(x => x.id === s)?.label ?? 'Status offen';
export const rechtsformLabel = (r?: Rechtsform) => RECHTSFORMEN.find(x => x.id === r)?.label;
export const vertragArtLabel = (a: VertragArt) => VERTRAG_ARTEN.find(x => x.id === a)?.label ?? 'Vertrag';
export const vertragStatusLabel = (s: VertragStatus) => VERTRAG_STATUS.find(x => x.id === s)?.label ?? s;

/** Die Einträge einer Liste, wie Leser sie sehen: ohne Papierkorb. */
export const aktiveEintraege = <T extends { geloeschtAm?: string }>(l: readonly T[] | undefined): T[] => (l ?? []).filter(x => !x.geloeschtAm);

// ── Cap-Table ────────────────────────────────────────────────────────────────────────────────────────────────────

export interface AnteilZeile { g: Gesellschafter; prozent: number }
export interface Anteile {
  zeilen: AnteilZeile[];
  /** Summe der Nennbeträge (aktive, nicht ausgeschiedene Gesellschafter). */
  summeCent: number;
  /** Summe der angezeigten Prozente (100 bei mindestens einem Gesellschafter mit Nennbetrag > 0, sonst 0). */
  summeProzent: number;
  /** Stimmt die Summe der Nennbeträge mit dem gezeichneten Stammkapital überein? `null` = kein Stammkapital hinterlegt. */
  passtZumStammkapital: boolean | null;
  /** Abweichung in Cent (Summe − Stammkapital), 0 wenn passt oder unbekannt. */
  abweichungCent: number;
  /** Ganzer Satz für die Anzeige, wenn etwas nicht stimmt. */
  hinweis?: string;
}

const eur = (cent: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: cent % 100 ? 2 : 0 }).format(cent / 100);
export const euroText = eur;

/**
 * Prozente aus den Nennbeträgen (größter Rest, auf 2 Nachkommastellen) — die Summe ist immer genau 100,00.
 * Summenprüfung: Σ Nennbeträge = gezeichnetes Stammkapital (falls hinterlegt).
 */
export function anteile(g: Pick<RegisterGesellschaft, 'gesellschafter' | 'stammkapitalCent'>): Anteile {
  const aktiv = aktiveEintraege(g.gesellschafter).filter(x => !x.ausgeschiedenAm);
  const summeCent = aktiv.reduce((s, x) => s + Math.max(0, x.nennbetragCent || 0), 0);
  let zeilen: AnteilZeile[] = aktiv.map(x => ({ g: x, prozent: 0 }));
  if (summeCent > 0) {
    // größter Rest auf Hundertstel-Prozent (10.000 Teile)
    const roh = aktiv.map(x => (Math.max(0, x.nennbetragCent || 0) * 10_000) / summeCent);
    const ganz = roh.map(Math.floor);
    let rest = 10_000 - ganz.reduce((a, b) => a + b, 0);
    const reihenfolge = roh.map((r, i) => ({ i, r: r - Math.floor(r) })).sort((a, b) => b.r - a.r || a.i - b.i);
    for (const { i } of reihenfolge) { if (rest <= 0) break; ganz[i]++; rest--; }
    zeilen = aktiv.map((x, i) => ({ g: x, prozent: ganz[i] / 100 }));
  }
  zeilen.sort((a, b) => b.prozent - a.prozent);
  const summeProzent = Math.round(zeilen.reduce((s, z) => s + z.prozent, 0) * 100) / 100;
  const sk = g.stammkapitalCent;
  const passt = typeof sk === 'number' && sk > 0 ? summeCent === sk : null;
  const abweichungCent = passt === false ? summeCent - (sk as number) : 0;
  const hinweis = passt === false
    ? `Die Nennbeträge ergeben ${eur(summeCent)}, das Stammkapital ist ${eur(sk as number)} — ${abweichungCent > 0 ? 'zu viel' : 'es fehlen'} ${eur(Math.abs(abweichungCent))}.`
    : summeCent === 0 && aktiv.length ? 'Kein Gesellschafter hat einen Nennbetrag — die Anteile lassen sich nicht berechnen.' : undefined;
  return { zeilen, summeCent, summeProzent, passtZumStammkapital: passt, abweichungCent, ...(hinweis ? { hinweis } : {}) };
}

/** Eingezahlt laut Gesellschafter-Einträgen (voll = Nennbetrag, teilweise = eingezahlter Betrag). */
export function eingezahltLautGesellschaftern(g: Pick<RegisterGesellschaft, 'gesellschafter'>): number {
  return aktiveEintraege(g.gesellschafter).filter(x => !x.ausgeschiedenAm)
    .reduce((s, x) => s + (x.einlage === 'ja' ? x.nennbetragCent : x.einlage === 'teil' ? Math.min(x.eingezahltCent ?? 0, x.nennbetragCent) : 0), 0);
}

// ── Vorgänger-Kette (ohne Kreis) ─────────────────────────────────────────────────────────────────────────────────

/** Die Kette „hervorgegangen aus“ ab `id` (ohne `id` selbst), älteste zuletzt; bricht bei einem Kreis ab. */
export function vorgaengerKette(id: string, alle: readonly Pick<RegisterGesellschaft, 'id' | 'vorgaengerId'>[]): GesellschaftId[] {
  const kette: GesellschaftId[] = [];
  const gesehen = new Set<string>([id]);
  let jetzt = alle.find(g => g.id === id)?.vorgaengerId;
  while (jetzt && !gesehen.has(jetzt)) {
    kette.push(jetzt); gesehen.add(jetzt);
    jetzt = alle.find(g => g.id === jetzt)?.vorgaengerId;
  }
  return kette;
}

/** Darf `vorgaenger` Vorgänger von `id` werden? Nicht sich selbst, nicht wenn `id` schon in der Kette von `vorgaenger` steht (Kreis). */
export function vorgaengerErlaubt(id: string, vorgaenger: string, alle: readonly Pick<RegisterGesellschaft, 'id' | 'vorgaengerId'>[]): boolean {
  if (id === vorgaenger) return false;
  return !vorgaengerKette(vorgaenger, alle).includes(id as GesellschaftId);
}

/** Wer ist aus `id` hervorgegangen (Nachfolger)? */
export const nachfolger = (id: string, alle: readonly RegisterGesellschaft[]): RegisterGesellschaft[] => alle.filter(g => g.vorgaengerId === id && !imPapierkorb(g));

// ── Beteiligungen (abgeleitet) und Struktur ──────────────────────────────────────────────────────────────────────

export interface Haltung { an: GesellschaftId; prozent: number; nennbetragCent: number }

/** Welche eigenen Gesellschaften hält `id`? Abgeleitet aus den Gesellschafter-Einträgen der anderen (eine Quelle). */
export function haelt(id: string, alle: readonly RegisterGesellschaft[]): Haltung[] {
  const raus: Haltung[] = [];
  for (const g of alle) {
    if (imPapierkorb(g) || g.id === id) continue;
    for (const z of anteile(g).zeilen) if (z.g.wer.art === 'gesellschaft' && z.g.wer.id === id) raus.push({ an: g.id, prozent: z.prozent, nennbetragCent: z.g.nennbetragCent });
  }
  return raus;
}

export interface StrukturKnoten { id: GesellschaftId; name: string; status?: GesStatus; prozent?: number; kinder: StrukturKnoten[]; fremde: { firmaId: string; anteilProzent?: number }[]; schonGezeigt?: true }

/**
 * „Wer hält wen“ als Baum: Wurzeln sind eigene Gesellschaften, die keine andere eigene Gesellschaft hält; darunter, was sie
 * halten (mit Prozent), am Ende die fremden Beteiligungen. Wechselseitige Beteiligungen laufen nicht im Kreis
 * (zweites Auftreten = `schonGezeigt`). Archivierte zählen mit (eine ruhende Holding hält weiter), Papierkorb nicht.
 */
export function strukturBaum(alle: readonly RegisterGesellschaft[]): StrukturKnoten[] {
  const da = alle.filter(g => !imPapierkorb(g));
  const gehalten = new Set(da.flatMap(g => anteile(g).zeilen.filter(z => z.g.wer.art === 'gesellschaft' && da.some(x => x.id === z.g.wer.id)).map(() => g.id)));
  const knoten = (g: RegisterGesellschaft, prozent: number | undefined, pfad: Set<string>): StrukturKnoten => {
    const basis = { id: g.id, name: anzeigeName(g), ...(g.status ? { status: g.status } : {}), ...(prozent !== undefined ? { prozent } : {}) };
    if (pfad.has(g.id)) return { ...basis, kinder: [], fremde: [], schonGezeigt: true };
    const weiter = new Set(pfad).add(g.id);
    const kinder = haelt(g.id, da).map(h => { const k = da.find(x => x.id === h.an); return k ? knoten(k, h.prozent, weiter) : null; }).filter((x): x is StrukturKnoten => !!x);
    const fremde = aktiveEintraege(g.beteiligungen).filter(b => !b.beendetAm).map(b => ({ firmaId: b.firmaId, ...(b.anteilProzent !== undefined ? { anteilProzent: b.anteilProzent } : {}) }));
    return { ...basis, kinder, fremde };
  };
  const wurzeln = da.filter(g => !gehalten.has(g.id));
  // Jede Gesellschaft ist nur gehalten (Kreis ohne Wurzel)? Dann die erste als Wurzel, damit nichts verschwindet.
  return (wurzeln.length ? wurzeln : da.slice(0, 1)).map(g => knoten(g, undefined, new Set()));
}

/** Kurzform „KD Ventures 100 %“ bzw. „3 Gesellschafter“ für die Karte (Namen kommen über `name`). */
export function gesellschafterKurz(g: RegisterGesellschaft, name: (b: Bezug) => string): string | undefined {
  const z = anteile(g).zeilen;
  if (!z.length) return undefined;
  if (z.length <= 2) return z.map(x => `${name(x.g.wer)} ${x.prozent.toLocaleString('de-DE', { maximumFractionDigits: 2 })} %`).join(' · ');
  return `${z.length} Gesellschafter`;
}

// ── Verweise (vor dem Löschen) ───────────────────────────────────────────────────────────────────────────────────

export interface Verweise { deals: number; mandate: number; produkte: number; gesellschafter: number; vertraege: number; nachfolger: number }
export interface CrmVerweisTeil {
  chancen?: readonly { gesellschaft?: string; stufe?: string }[];
  mandate?: readonly { gesellschaft?: string; status?: string }[];
  leistungen?: readonly { gesellschaft?: string; geloeschtAm?: string }[];
}

/** Was hängt an einer Gesellschaft? Deals/Mandate/Produkte (CRM), Gesellschafter-/Vertrags-Verweise, Nachfolger. */
export function gesellschaftVerweise(id: string, alle: readonly RegisterGesellschaft[], crm: CrmVerweisTeil = {}): Verweise {
  const da = alle.filter(g => g.id !== id && !imPapierkorb(g));
  return {
    deals: (crm.chancen ?? []).filter(c => c.gesellschaft === id).length,
    mandate: (crm.mandate ?? []).filter(m => m.gesellschaft === id).length,
    produkte: (crm.leistungen ?? []).filter(l => l.gesellschaft === id && !l.geloeschtAm).length,
    gesellschafter: da.filter(g => aktiveEintraege(g.gesellschafter).some(x => x.wer.art === 'gesellschaft' && x.wer.id === id)).length,
    vertraege: da.filter(g => aktiveEintraege(g.vertraege).some(v => v.parteien.some(p => p.art === 'gesellschaft' && p.id === id))).length,
    nachfolger: da.filter(g => g.vorgaengerId === id).length,
  };
}
export const verweiseAnzahl = (v: Verweise) => v.deals + v.mandate + v.produkte + v.gesellschafter + v.vertraege + v.nachfolger;
/** Ganzer Satz: „Daran hängen 2 Deals, 1 Mandat und 1 Gesellschafter-Eintrag.“ — leer, wenn nichts hängt. */
export function verweiseSatz(v: Verweise): string {
  const teile = ([
    [v.deals, 'Deal', 'Deals'], [v.mandate, 'Mandat', 'Mandate'], [v.produkte, 'Produkt', 'Produkte'],
    [v.gesellschafter, 'Gesellschafter-Eintrag', 'Gesellschafter-Einträge'], [v.vertraege, 'Vertrag', 'Verträge'], [v.nachfolger, 'Nachfolger', 'Nachfolger'],
  ] as const).filter(([n]) => n > 0).map(([n, e, m]) => `${n} ${n === 1 ? e : m}`);
  if (!teile.length) return '';
  return `Daran ${teile.length === 1 && teile[0].startsWith('1 ') ? 'hängt' : 'hängen'} ${teile.length > 1 ? `${teile.slice(0, -1).join(', ')} und ${teile[teile.length - 1]}` : teile[0]}.`;
}

// ── Vertragsfristen (Kalender) ───────────────────────────────────────────────────────────────────────────────────

export interface VertragsStichtag { id: string; tag: string; titel: string; unter?: string; gesellschaftId: GesellschaftId; vertragId: string; kuendigung?: true }

/** Stichtage aller laufenden Verträge (nicht beendet, nicht im Papierkorb, Gesellschaft nicht im Papierkorb). */
export function vertragsStichtage(alle: readonly RegisterGesellschaft[]): VertragsStichtag[] {
  const raus: VertragsStichtag[] = [];
  for (const g of alle) {
    if (imPapierkorb(g)) continue;
    const gn = anzeigeName(g);
    for (const v of aktiveEintraege(g.vertraege)) {
      if (v.status === 'beendet') continue;
      const basis = { gesellschaftId: g.id, vertragId: v.id };
      const name = v.titel || vertragArtLabel(v.art);
      if (v.beginn) raus.push({ ...basis, id: `vt-beginn-${v.id}`, tag: v.beginn, titel: `Vertrag beginnt: ${name}`, unter: gn });
      if (v.ende) raus.push({ ...basis, id: `vt-ende-${v.id}`, tag: v.ende, titel: `Vertrag endet: ${name}`, unter: gn });
      if (v.kuendigenBis) raus.push({ ...basis, id: `vt-kuendigen-${v.id}`, tag: v.kuendigenBis, titel: `Kündigen bis: ${name}`, unter: [gn, v.kuendigungsfrist].filter(Boolean).join(' · '), kuendigung: true });
      for (const f of v.fristen ?? []) raus.push({ ...basis, id: `vt-frist-${v.id}-${f.id}`, tag: f.datum, titel: `${f.text}: ${name}`, unter: gn });
    }
  }
  return raus;
}

// ── Lücken (seriös, investor-tauglich — nur Hinweise, keine Rechtsberatung) ─────────────────────────────────────

export function registerLuecken(g: RegisterGesellschaft): string[] {
  const f: string[] = [];
  const kap = g.rechtsform && MIT_STAMMKAPITAL.includes(g.rechtsform);
  if (!g.rechtsform) f.push('Rechtsform');
  if (!g.status) f.push('Status');
  if (kap && !g.stammkapitalCent) f.push('Stammkapital');
  if (kap && !aktiveEintraege(g.gesellschafter).length) f.push('Gesellschafter');
  if (g.status === 'eingetragen' && kap && !g.register) f.push('Registergericht/HRB');
  if (kap && g.status !== 'geplant' && !g.geschaeftsfuehrung) f.push('Geschäftsführung');
  return f;
}

// ── Säubern (Eingaben aus dem Netz) ──────────────────────────────────────────────────────────────────────────────

export interface RegisterFehler { feld: string; text: string }

const zeile = (v: unknown, n: number) => { const t = String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim(); return t ? t.slice(0, n) : undefined; };
const block = (v: unknown, n: number) => { const t = String(v ?? '').replace(/\u0000/g, '').replace(/\r\n?/g, '\n').trim(); return t ? t.slice(0, n) : undefined; };
const TAG = /^\d{4}-\d{2}-\d{2}$/;
const tag = (v: unknown) => (typeof v === 'string' && TAG.test(v) && Number.isFinite(Date.parse(v)) ? v : undefined);
const KENNUNG = /^[a-z0-9][a-z0-9_-]{1,79}$/i;
/** Wie `GELOESCHT` in lib/crm/person-weitere.ts (dort nicht importierbar: Server-Modul) — Wächter im Test. */
export const GETILGT = '[gelöscht]';
const PERSON = /^[a-z0-9-]{1,40}$/;
const UNTER_ID = (p: string) => new RegExp(`^${p}-[a-z0-9][a-z0-9-]{3,62}$`);

/** Betrag in Cent aus einer Eingabe: Zahl (Cent) bzw. Text in Euro („25.000“, „12.500,50“). Negativ/unlesbar → Fehler. */
export function centAus(v: unknown): number | undefined | 'fehler' {
  if (v === null || v === undefined || v === '') return undefined;
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 && v <= 1e13 ? Math.round(v) : 'fehler';
  const t = String(v).replace(/\s|€/g, '');
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$|^\d+(\.\d{1,2})?$/.test(t)) return 'fehler';
  // Punkt als Tausender (1.500) außer bei genau einer Stelle mit 1–2 Ziffern dahinter ohne Komma (12.5) — dann Dezimal.
  const dezimalPunkt = !t.includes(',') && /^\d+\.\d{1,2}$/.test(t);
  const zahl = Number(dezimalPunkt ? t : t.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(zahl) ? Math.round(zahl * 100) : 'fehler';
}

function bezugAus(v: unknown): Bezug | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const art = BEZUG_ARTEN.some(a => a.id === o.art) ? o.art as BezugArt : null;
  const id = typeof o.id === 'string' ? o.id : '';
  if (!art) return null;
  if (art === 'person' && PERSON.test(id)) return { art, id };
  if (art === 'gesellschaft' && istGesellschaftId(id)) return { art, id };
  if ((art === 'kontakt' || art === 'firma') && KENNUNG.test(id)) return { art, id };
  // Art. 17 (DSGVO-Prüfung 04.10.): eine gelöschte Person steht als „[gelöscht]“ im Eintrag (person-weitere `tilgen`) — der
  // Eintrag bleibt änderbar (Cap-Table, Vertrag sind eigene Geschäftsunterlagen), die Kennung kommt nie zurück.
  if ((art === 'kontakt' || art === 'firma') && id === GETILGT) return { art, id };
  return null;
}

/** Steckbrief-Felder auf den Eintrag legen. Fehler werden gemeldet (400), nie still verworfen. */
export function steckbriefAnwenden(alt: RegisterGesellschaft, roh: Record<string, unknown>, alle: readonly RegisterGesellschaft[]): { g: RegisterGesellschaft; fehler: RegisterFehler[] } {
  const fehler: RegisterFehler[] = [];
  const n: RegisterGesellschaft = { ...alt };
  const hat = (k: string) => Object.prototype.hasOwnProperty.call(roh, k);
  const setze = <K extends keyof RegisterGesellschaft>(k: K, v: RegisterGesellschaft[K] | undefined) => { if (v === undefined) delete n[k]; else n[k] = v; };
  if (hat('name')) {
    if (istGesellschaft(alt.id)) { if (roh.name) fehler.push({ feld: 'name', text: 'Die drei festen Gesellschaften heißen wie in den Einstellungen — die genaue Firmierung steht im Feld „Firmierung“.' }); }
    else { const t = zeile(roh.name, 120); if (!t || t.length < 2) fehler.push({ feld: 'name', text: 'Name: mindestens 2 Zeichen.' }); else setze('name', t); }
  }
  if (hat('rechtsform')) { const r = roh.rechtsform; if (r === null || r === '') setze('rechtsform', undefined); else if (RECHTSFORMEN.some(x => x.id === r)) setze('rechtsform', r as Rechtsform); else fehler.push({ feld: 'rechtsform', text: 'Unbekannte Rechtsform.' }); }
  if (hat('status')) { const s = roh.status; if (s === null || s === '') setze('status', undefined); else if (GES_STATUS.some(x => x.id === s)) { setze('status', s as GesStatus); if (!istArchiviertStatus(s as GesStatus)) setze('vorArchiv', undefined); } else fehler.push({ feld: 'status', text: 'Unbekannter Status.' }); }
  if (hat('rolle')) { const r = roh.rolle; if (r === null || r === '' || r === 'operativ') setze('rolle', undefined); else if (r === 'holding') setze('rolle', 'holding'); else fehler.push({ feld: 'rolle', text: 'Rolle: operativ oder Holding.' }); }
  if (hat('sitz')) setze('sitz', zeile(roh.sitz, 80));
  for (const k of ['gegruendetAm', 'eingetragenAm'] as const) if (hat(k)) { const t = tag(roh[k]); if (roh[k] && !t) fehler.push({ feld: k, text: 'Datum bitte als JJJJ-MM-TT.' }); else setze(k, t); }
  for (const k of ['stammkapitalCent', 'eingezahltCent'] as const) if (hat(k)) { const c = centAus(roh[k]); if (c === 'fehler') fehler.push({ feld: k, text: 'Betrag nicht lesbar (z. B. 25.000 oder 12.500,50).' }); else setze(k, c); }
  if (n.stammkapitalCent !== undefined && n.eingezahltCent !== undefined && n.eingezahltCent > n.stammkapitalCent) fehler.push({ feld: 'eingezahltCent', text: 'Eingezahlt kann nicht höher sein als das Stammkapital.' });
  if (hat('geschaeftsjahrBeginn')) { const m = Number(roh.geschaeftsjahrBeginn); if (roh.geschaeftsjahrBeginn === null || roh.geschaeftsjahrBeginn === '' || m === 1) setze('geschaeftsjahrBeginn', undefined); else if (Number.isInteger(m) && m >= 2 && m <= 12) setze('geschaeftsjahrBeginn', m); else fehler.push({ feld: 'geschaeftsjahrBeginn', text: 'Geschäftsjahr beginnt in einem Monat 1–12.' }); }
  if (hat('vorgaengerId')) {
    const v = roh.vorgaengerId;
    if (v === null || v === '') setze('vorgaengerId', undefined);
    else if (!istGesellschaftId(v) || !alle.some(g => g.id === v && !imPapierkorb(g))) fehler.push({ feld: 'vorgaengerId', text: 'Vorgänger nicht gefunden.' });
    else if (!vorgaengerErlaubt(alt.id, v, alle)) fehler.push({ feld: 'vorgaengerId', text: 'Das ergäbe einen Kreis — eine Gesellschaft kann nicht aus sich selbst (oder ihrem Nachfolger) hervorgehen.' });
    else setze('vorgaengerId', v);
  }
  if (hat('notizen')) setze('notizen', block(roh.notizen, 4000));
  return { g: n, fehler };
}

/** Einen Gesellschafter säubern (neu oder geändert). `selbst` = die Gesellschaft, an der er beteiligt ist. */
export function gesellschafterSaeubern(roh: unknown, selbst: GesellschaftId, alt?: Gesellschafter): { e?: Gesellschafter; fehler: RegisterFehler[] } {
  const fehler: RegisterFehler[] = [];
  const o = (roh && typeof roh === 'object' ? roh : {}) as Record<string, unknown>;
  const wer = o.wer !== undefined ? bezugAus(o.wer) : alt?.wer ?? null;
  if (!wer) fehler.push({ feld: 'wer', text: 'Wer hält den Anteil? Bitte eine Person, Gesellschaft, einen Kontakt oder eine Firma wählen.' });
  if (wer?.art === 'gesellschaft' && wer.id === selbst) fehler.push({ feld: 'wer', text: 'Eine Gesellschaft kann nicht ihr eigener Gesellschafter sein.' });
  const nb = o.nennbetragCent !== undefined ? centAus(o.nennbetragCent) : alt?.nennbetragCent;
  if (nb === 'fehler' || nb === undefined) fehler.push({ feld: 'nennbetragCent', text: 'Nennbetrag bitte als Betrag (z. B. 25.000).' });
  const einlage = (o.einlage !== undefined ? o.einlage : alt?.einlage) as Einlage;
  if (!EINLAGEN.some(e => e.id === einlage)) fehler.push({ feld: 'einlage', text: 'Einlage: voll, teilweise oder offen.' });
  const ez = o.eingezahltCent !== undefined ? centAus(o.eingezahltCent) : alt?.eingezahltCent;
  if (ez === 'fehler') fehler.push({ feld: 'eingezahltCent', text: 'Eingezahlter Betrag nicht lesbar.' });
  if (einlage === 'teil' && typeof ez === 'number' && typeof nb === 'number' && ez > nb) fehler.push({ feld: 'eingezahltCent', text: 'Eingezahlt kann nicht höher sein als der Nennbetrag.' });
  const datum = (k: 'einlageAm' | 'eingetretenAm') => { const v = o[k] !== undefined ? o[k] : alt?.[k]; const t = tag(v); if (v && !t) fehler.push({ feld: k, text: 'Datum bitte als JJJJ-MM-TT.' }); return t; };
  const einlageAm = datum('einlageAm'), eingetretenAm = datum('eingetretenAm');
  const ohneStimmrecht = (o.ohneStimmrecht !== undefined ? o.ohneStimmrecht === true : alt?.ohneStimmrecht) ? true as const : undefined;
  const klauseln = o.klauseln !== undefined ? block(o.klauseln, 2000) : alt?.klauseln;
  const id = alt?.id ?? (typeof o.id === 'string' && UNTER_ID('gs').test(o.id) ? o.id : undefined);
  if (!id) fehler.push({ feld: 'id', text: 'Kennung fehlt.' });
  if (fehler.length) return { fehler };
  return {
    fehler, e: {
      id: id!, wer: wer!, nennbetragCent: nb as number, einlage,
      ...(einlage === 'teil' && typeof ez === 'number' ? { eingezahltCent: ez } : {}),
      ...(einlageAm ? { einlageAm } : {}), ...(ohneStimmrecht ? { ohneStimmrecht } : {}), ...(klauseln ? { klauseln } : {}),
      ...(eingetretenAm ? { eingetretenAm } : {}),
      ...(alt?.ausgeschiedenAm ? { ausgeschiedenAm: alt.ausgeschiedenAm } : {}), ...(alt?.geloeschtAm ? { geloeschtAm: alt.geloeschtAm } : {}),
    },
  };
}

export function beteiligungSaeubern(roh: unknown, alt?: FremdBeteiligung): { e?: FremdBeteiligung; fehler: RegisterFehler[] } {
  const fehler: RegisterFehler[] = [];
  const o = (roh && typeof roh === 'object' ? roh : {}) as Record<string, unknown>;
  const firmaId = o.firmaId !== undefined ? (typeof o.firmaId === 'string' && KENNUNG.test(o.firmaId) ? o.firmaId : undefined) : alt?.firmaId;
  if (!firmaId) fehler.push({ feld: 'firmaId', text: 'An welcher Firma? Bitte eine Firma aus dem CRM wählen.' });
  let anteilProzent = alt?.anteilProzent;
  if (o.anteilProzent !== undefined) {
    if (o.anteilProzent === null || o.anteilProzent === '') anteilProzent = undefined;
    else { const p = Number(String(o.anteilProzent).replace(',', '.')); if (!Number.isFinite(p) || p <= 0 || p > 100) fehler.push({ feld: 'anteilProzent', text: 'Anteil in Prozent (über 0 bis 100).' }); else anteilProzent = Math.round(p * 100) / 100; }
  }
  const betrag = (k: 'nennbetragCent' | 'preisCent') => { const c = o[k] !== undefined ? centAus(o[k]) : alt?.[k]; if (c === 'fehler') { fehler.push({ feld: k, text: 'Betrag nicht lesbar.' }); return undefined; } return c; };
  const nennbetragCent = betrag('nennbetragCent'), preisCent = betrag('preisCent');
  const ev = o.erwerbAm !== undefined ? o.erwerbAm : alt?.erwerbAm; const erwerbAm = tag(ev); if (ev && !erwerbAm) fehler.push({ feld: 'erwerbAm', text: 'Datum bitte als JJJJ-MM-TT.' });
  const notiz = o.notiz !== undefined ? block(o.notiz, 1000) : alt?.notiz;
  const id = alt?.id ?? (typeof o.id === 'string' && UNTER_ID('bt').test(o.id) ? o.id : undefined);
  if (!id) fehler.push({ feld: 'id', text: 'Kennung fehlt.' });
  if (fehler.length) return { fehler };
  return { fehler, e: { id: id!, firmaId: firmaId!, ...(anteilProzent !== undefined ? { anteilProzent } : {}), ...(nennbetragCent !== undefined ? { nennbetragCent } : {}), ...(erwerbAm ? { erwerbAm } : {}), ...(preisCent !== undefined ? { preisCent } : {}), ...(notiz ? { notiz } : {}), ...(alt?.beendetAm ? { beendetAm: alt.beendetAm } : {}), ...(alt?.geloeschtAm ? { geloeschtAm: alt.geloeschtAm } : {}) } };
}

export function vertragSaeubern(roh: unknown, alt?: Vertrag): { e?: Vertrag; fehler: RegisterFehler[] } {
  const fehler: RegisterFehler[] = [];
  const o = (roh && typeof roh === 'object' ? roh : {}) as Record<string, unknown>;
  const art = (o.art !== undefined ? o.art : alt?.art) as VertragArt;
  if (!VERTRAG_ARTEN.some(a => a.id === art)) fehler.push({ feld: 'art', text: 'Welche Art von Vertrag?' });
  const titel = o.titel !== undefined ? zeile(o.titel, 160) : alt?.titel;
  const status = (o.status !== undefined ? o.status : alt?.status ?? 'entwurf') as VertragStatus;
  if (!VERTRAG_STATUS.some(s => s.id === status)) fehler.push({ feld: 'status', text: 'Unbekannter Status.' });
  let parteien = alt?.parteien ?? [];
  if (o.parteien !== undefined) {
    const l = Array.isArray(o.parteien) ? o.parteien : [];
    if (l.length > GRENZEN.parteien) fehler.push({ feld: 'parteien', text: `Höchstens ${GRENZEN.parteien} Parteien.` });
    const sauber = l.map(bezugAus);
    if (sauber.some(x => !x)) fehler.push({ feld: 'parteien', text: 'Eine Partei ist nicht lesbar.' });
    parteien = sauber.filter((x): x is Bezug => !!x).filter((x, i, a) => a.findIndex(y => y.art === x.art && y.id === x.id) === i);
  }
  let dateiIds = alt?.dateiIds;
  if (o.dateiIds !== undefined) {
    const l = Array.isArray(o.dateiIds) ? o.dateiIds : [];
    if (l.length > GRENZEN.dateien) fehler.push({ feld: 'dateiIds', text: `Höchstens ${GRENZEN.dateien} Unterlagen je Vertrag.` });
    const ok = l.filter((x): x is string => typeof x === 'string' && /^d-[a-z0-9-]{4,60}$/.test(x));
    if (ok.length !== l.length) fehler.push({ feld: 'dateiIds', text: 'Eine Unterlage ist nicht lesbar.' });
    dateiIds = [...new Set(ok)];
  }
  const datum = (k: 'beginn' | 'ende' | 'kuendigenBis') => { const v = o[k] !== undefined ? o[k] : alt?.[k]; const t = tag(v); if (v && !t) fehler.push({ feld: k, text: 'Datum bitte als JJJJ-MM-TT.' }); return t; };
  const beginn = datum('beginn'), ende = datum('ende'), kuendigenBis = datum('kuendigenBis');
  if (beginn && ende && ende < beginn) fehler.push({ feld: 'ende', text: 'Das Ende liegt vor dem Beginn.' });
  const kuendigungsfrist = o.kuendigungsfrist !== undefined ? zeile(o.kuendigungsfrist, 120) : alt?.kuendigungsfrist;
  let erinnerungTage = alt?.erinnerungTage;
  if (o.erinnerungTage !== undefined) {
    if (o.erinnerungTage === null || o.erinnerungTage === '') erinnerungTage = undefined;
    else { const n = Number(o.erinnerungTage); if (!Number.isInteger(n) || n < 0 || n > 365) fehler.push({ feld: 'erinnerungTage', text: 'Erinnerung: 0 bis 365 Tage vorher (0 = keine).' }); else erinnerungTage = n === ERINNERUNG_VORGABE_TAGE ? undefined : n; }
  }
  let fristen = alt?.fristen;
  if (o.fristen !== undefined) {
    const l = Array.isArray(o.fristen) ? o.fristen : [];
    if (l.length > GRENZEN.fristen) fehler.push({ feld: 'fristen', text: `Höchstens ${GRENZEN.fristen} Stichtage je Vertrag.` });
    fristen = [];
    for (const x of l) {
      const f = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
      const d = tag(f.datum), t = zeile(f.text, 120), fid = typeof f.id === 'string' && /^[a-z0-9-]{1,64}$/.test(f.id) ? f.id : undefined;
      if (!d || !t || !fid) { fehler.push({ feld: 'fristen', text: 'Jeder Stichtag braucht Datum und Text.' }); continue; }
      fristen.push({ id: fid, datum: d, text: t });
    }
  }
  const notiz = o.notiz !== undefined ? block(o.notiz, 2000) : alt?.notiz;
  const id = alt?.id ?? (typeof o.id === 'string' && UNTER_ID('vt').test(o.id) ? o.id : undefined);
  if (!id) fehler.push({ feld: 'id', text: 'Kennung fehlt.' });
  if (fehler.length) return { fehler };
  return {
    fehler, e: {
      id: id!, art, titel: titel || vertragArtLabel(art), parteien, status,
      ...(status === 'beendet' && alt?.vorArchiv ? { vorArchiv: alt.vorArchiv } : {}),
      ...(dateiIds?.length ? { dateiIds } : {}), ...(beginn ? { beginn } : {}), ...(ende ? { ende } : {}),
      ...(kuendigungsfrist ? { kuendigungsfrist } : {}), ...(kuendigenBis ? { kuendigenBis } : {}), ...(erinnerungTage !== undefined ? { erinnerungTage } : {}), ...(fristen?.length ? { fristen } : {}),
      ...(notiz ? { notiz } : {}), ...(alt?.geloeschtAm ? { geloeschtAm: alt.geloeschtAm } : {}),
    },
  };
}

// ── Archiv / Papierkorb je Eintrag (eine Logik, lib/eintraege/sicher.ts) ─────────────────────────────────────────

export type EintragAktion = 'archivieren' | 'zurueckholen' | 'loeschen' | 'wiederherstellen';
export const EINTRAG_AKTIONEN: readonly EintragAktion[] = ['archivieren', 'zurueckholen', 'loeschen', 'wiederherstellen'];

/** Archiv-/Papierkorb-Aktion auf einen Listeneintrag. `heute` = Berliner Tag, `jetzt` = Server-Zeit (Marke). */
export function eintragAktion<T extends ListenEintrag>(liste: RegisterListe, e: T, aktion: EintragAktion, heute: string, jetzt: string): T {
  if (aktion === 'loeschen') return inPapierkorb(e, jetzt);
  if (aktion === 'wiederherstellen') return ausPapierkorb(e);
  if (liste === 'organe') {
    const o = { ...(e as Organ) };
    if (aktion === 'archivieren') o.bis = o.bis && o.bis <= heute ? o.bis : heute; else delete o.bis;
    return o as T;
  }
  if (liste === 'beschluesse') {
    const b = { ...(e as Beschluss) };
    if (aktion === 'archivieren') { if (b.status !== 'aufgehoben') { b.vorArchiv = b.status; b.status = 'aufgehoben'; } }
    else if (b.status === 'aufgehoben') { b.status = b.vorArchiv ?? 'gefasst'; delete b.vorArchiv; }
    return b as T;
  }
  if (liste === 'gesellschafter') {
    const g = { ...(e as Gesellschafter) };
    if (aktion === 'archivieren') g.ausgeschiedenAm = g.ausgeschiedenAm ?? heute; else delete g.ausgeschiedenAm;
    return g as T;
  }
  if (liste === 'beteiligungen') {
    const b = { ...(e as FremdBeteiligung) };
    if (aktion === 'archivieren') b.beendetAm = b.beendetAm ?? heute; else delete b.beendetAm;
    return b as T;
  }
  const v = { ...(e as Vertrag) };
  if (aktion === 'archivieren') { if (v.status !== 'beendet') { v.vorArchiv = v.status; v.status = 'beendet'; } }
  else if (v.status === 'beendet') { v.status = v.vorArchiv ?? 'unterschrieben'; delete v.vorArchiv; }
  return v as T;
}

/** Ist ein Listeneintrag archiviert (ausgeschieden/beendet)? */
export function eintragArchiviert(liste: RegisterListe, e: ListenEintrag, heute = '9999-12-31'): boolean {
  if (liste === 'organe') return !!(e as Organ).bis && (e as Organ).bis! <= heute;
  if (liste === 'beschluesse') return (e as Beschluss).status === 'aufgehoben';
  if (liste === 'gesellschafter') return !!(e as Gesellschafter).ausgeschiedenAm;
  if (liste === 'beteiligungen') return !!(e as FremdBeteiligung).beendetAm;
  return (e as Vertrag).status === 'beendet';
}

/** Gesellschaft archivieren (ruhend/aufgelöst) bzw. zurückholen (vorheriger Status, sonst „eingetragen“/„geplant“). */
export function gesellschaftArchiv(g: RegisterGesellschaft, aktion: 'archivieren' | 'zurueckholen', ziel: 'ruhend' | 'aufgeloest' = 'ruhend'): RegisterGesellschaft {
  const n = { ...g };
  if (aktion === 'archivieren') { if (!istArchiviertStatus(n.status)) { if (n.status) n.vorArchiv = n.status; else delete n.vorArchiv; } n.status = ziel; return n; }
  if (!istArchiviertStatus(n.status)) return n;
  n.status = n.vorArchiv ?? (n.eingetragenAm || n.register ? 'eingetragen' : 'geplant');
  delete n.vorArchiv;
  return n;
}

/**
 * Morgenlauf: was länger als 30 Tage im Papierkorb liegt, geht endgültig — Listeneinträge immer, eine Gesellschaft nur,
 * wenn nichts mehr an ihr hängt (sonst bleibt sie im Papierkorb). Gibt den neuen Stand und die Zahl zurück (n = 0 → unverändert).
 */
export function registerAufraeumen(d: RegisterDatei | null, crm: CrmVerweisTeil, jetzt: string): { d: RegisterDatei | null; n: number } {
  if (!d?.gesellschaften?.length) return { d, n: 0 };
  let n = 0;
  const alle = d.gesellschaften;
  const raus: RegisterGesellschaft[] = [];
  for (const g of alle) {
    if (istRegisterKennung(g.id) && papierkorbAbgelaufen(g, jetzt) && verweiseAnzahl(gesellschaftVerweise(g.id, alle, crm)) === 0) { n++; continue; }
    let neu = g;
    for (const l of REGISTER_LISTEN) {
      const liste = (g[l] ?? []) as { geloeschtAm?: string }[];
      const bleibt = liste.filter(e => !papierkorbAbgelaufen(e, jetzt));
      if (bleibt.length !== liste.length) { n += liste.length - bleibt.length; neu = { ...neu, [l]: bleibt }; }
    }
    raus.push(neu);
  }
  return n ? { d: { ...d, gesellschaften: raus }, n } : { d, n: 0 };
}

// ── Planung: Einheiten aus dem Register ──────────────────────────────────────────────────────────────────────────

/**
 * Namen der Register-Gesellschaften als Planungs-Einheiten (lib/planung/einheiten.ts): nur `g-…`, nicht ruhend/aufgelöst,
 * nicht im Papierkorb — die drei festen stehen dort schon als Standard.
 */
export function registerEinheitenNamen(d: RegisterDatei | null | undefined): string[] {
  return alleGesellschaften(d).filter(g => istRegisterKennung(g.id) && !istArchiviertStatus(g.status)).map(anzeigeName);
}

// ── Beschlüsse und Organe säubern (04.10. Nachtrag) ──────────────────────────────────────────────────────────────

export function beschlussSaeubern(roh: unknown, alt?: Beschluss): { e?: Beschluss; fehler: RegisterFehler[] } {
  const fehler: RegisterFehler[] = [];
  const o = (roh && typeof roh === 'object' ? roh : {}) as Record<string, unknown>;
  const dv = o.datum !== undefined ? o.datum : alt?.datum; const datum = tag(dv);
  if (!datum) fehler.push({ feld: 'datum', text: 'Datum bitte als JJJJ-MM-TT.' });
  const art = (o.art !== undefined ? o.art : alt?.art) as BeschlussArt;
  if (!BESCHLUSS_ARTEN.some(a => a.id === art)) fehler.push({ feld: 'art', text: 'Welche Art von Beschluss?' });
  const titel = o.titel !== undefined ? zeile(o.titel, 160) : alt?.titel;
  if (!titel) fehler.push({ feld: 'titel', text: 'Worum geht es? Bitte einen Titel.' });
  const status = (o.status !== undefined ? o.status : alt?.status ?? 'gefasst') as BeschlussStatus;
  if (!BESCHLUSS_STATUS.some(x => x.id === status)) fehler.push({ feld: 'status', text: 'Unbekannter Status.' });
  const inhalt = o.inhalt !== undefined ? block(o.inhalt, 4000) : alt?.inhalt;
  let dateiIds = alt?.dateiIds;
  if (o.dateiIds !== undefined) {
    const l = Array.isArray(o.dateiIds) ? o.dateiIds : [];
    const ok = l.filter((x): x is string => typeof x === 'string' && /^d-[a-z0-9-]{4,60}$/.test(x));
    if (ok.length !== l.length || l.length > GRENZEN.dateien) fehler.push({ feld: 'dateiIds', text: `Höchstens ${GRENZEN.dateien} lesbare Unterlagen.` });
    dateiIds = [...new Set(ok)];
  }
  const id = alt?.id ?? (typeof o.id === 'string' && UNTER_ID('bs').test(o.id) ? o.id : undefined);
  if (!id) fehler.push({ feld: 'id', text: 'Kennung fehlt.' });
  if (fehler.length) return { fehler };
  return { fehler, e: { id: id!, datum: datum!, art, titel: titel!, status, ...(status === 'aufgehoben' && alt?.vorArchiv ? { vorArchiv: alt.vorArchiv } : {}), ...(inhalt ? { inhalt } : {}), ...(dateiIds?.length ? { dateiIds } : {}), ...(alt?.geloeschtAm ? { geloeschtAm: alt.geloeschtAm } : {}) } };
}

export function organSaeubern(roh: unknown, alt?: Organ): { e?: Organ; fehler: RegisterFehler[] } {
  const fehler: RegisterFehler[] = [];
  const o = (roh && typeof roh === 'object' ? roh : {}) as Record<string, unknown>;
  const funktion = (o.funktion !== undefined ? o.funktion : alt?.funktion) as OrganFunktion;
  if (!ORGAN_FUNKTIONEN.some(f => f.id === funktion)) fehler.push({ feld: 'funktion', text: 'Welche Funktion?' });
  const wer = o.wer !== undefined ? bezugAus(o.wer) : alt?.wer ?? null;
  if (!wer || (wer.art !== 'person' && wer.art !== 'kontakt')) fehler.push({ feld: 'wer', text: 'Wer? Bitte eine Person im Haushalt oder einen Kontakt wählen.' });
  const datum = (k: 'seit' | 'bis') => { const v = o[k] !== undefined ? o[k] : alt?.[k]; const t = tag(v); if (v && !t) fehler.push({ feld: k, text: 'Datum bitte als JJJJ-MM-TT.' }); return t; };
  const seit = datum('seit'), bis = datum('bis');
  if (seit && bis && bis < seit) fehler.push({ feld: 'bis', text: '„Bis“ liegt vor „seit“.' });
  const notiz = o.notiz !== undefined ? block(o.notiz, 1000) : alt?.notiz;
  const id = alt?.id ?? (typeof o.id === 'string' && UNTER_ID('og').test(o.id) ? o.id : undefined);
  if (!id) fehler.push({ feld: 'id', text: 'Kennung fehlt.' });
  if (fehler.length) return { fehler };
  return { fehler, e: { id: id!, funktion, wer: wer!, ...(seit ? { seit } : {}), ...(bis ? { bis } : {}), ...(notiz ? { notiz } : {}), ...(alt?.geloeschtAm ? { geloeschtAm: alt.geloeschtAm } : {}) } };
}

export const beschlussArtLabel = (a: BeschlussArt) => BESCHLUSS_ARTEN.find(x => x.id === a)?.label ?? 'Beschluss';
export const organLabel = (f: OrganFunktion) => ORGAN_FUNKTIONEN.find(x => x.id === f)?.label ?? 'Organ';

// ── Holding (Business-Index) ─────────────────────────────────────────────────────────────────────────────────────

/**
 * Welche der drei festen Gesellschaften sind laut Register eine Holding? `null`, solange KEINE feste Gesellschaft eine Rolle
 * trägt (Altbestand) — dann gilt im Business-Index die bisherige Vorgabe (lib/business/register.ts `HOLDING_VORGABE`).
 * Register-Gesellschaften (`g-…`) haben keine eigene Index-Sicht (nur Grunddaten).
 */
export function holdingSichten(d: RegisterDatei | null | undefined): Gesellschaftskennung[] | null {
  const feste = (d?.gesellschaften ?? []).filter(g => istGesellschaft(g.id) && !imPapierkorb(g));
  if (!feste.some(g => g.rolle !== undefined)) return null;
  return feste.filter(g => g.rolle === 'holding').map(g => g.id as Gesellschaftskennung);
}

// ── Erinnerung vor „kündigen bis“ ────────────────────────────────────────────────────────────────────────────────

export interface Erinnerung { aufgabeId: string; gesellschaftId: GesellschaftId; vertragId: string; kuendigenBis: string; titel: string; beschreibung: string }

/** Kennung der Erinnerungs-Aufgabe — fest je Vertrag und Stichtag (idempotent; ein neuer Stichtag = eine neue Erinnerung). */
export const erinnerungAufgabeId = (vertragId: string, kuendigenBis: string) => `vte-${vertragId.replace(/^vt-/, '').slice(0, 40)}-${kuendigenBis.replace(/-/g, '')}`;

/**
 * Welche Erinnerungen sind heute fällig? Laufende Verträge (nicht beendet, nicht im Papierkorb, Gesellschaft nicht im
 * Papierkorb) mit „kündigen bis“ ≥ heute und heute ≥ kündigen bis − Vorlauf. Vorlauf 0 = keine.
 */
export function faelligeErinnerungen(alle: readonly RegisterGesellschaft[], heute: string): Erinnerung[] {
  const raus: Erinnerung[] = [];
  for (const g of alle) {
    if (imPapierkorb(g)) continue;
    for (const v of aktiveEintraege(g.vertraege)) {
      if (v.status === 'beendet' || !v.kuendigenBis || v.kuendigenBis < heute) continue;
      const vorlauf = v.erinnerungTage ?? ERINNERUNG_VORGABE_TAGE;
      if (vorlauf <= 0) continue;
      const ab = new Date(Date.parse(`${v.kuendigenBis}T12:00:00Z`) - vorlauf * 86_400_000).toISOString().slice(0, 10);
      if (heute < ab) continue;
      const name = v.titel || vertragArtLabel(v.art);
      raus.push({
        aufgabeId: erinnerungAufgabeId(v.id, v.kuendigenBis), gesellschaftId: g.id, vertragId: v.id, kuendigenBis: v.kuendigenBis,
        titel: `Kündigen oder verlängern? ${name} (${anzeigeName(g)}) — bis ${v.kuendigenBis.slice(8, 10)}.${v.kuendigenBis.slice(5, 7)}.${v.kuendigenBis.slice(0, 4)}`,
        beschreibung: `Erinnerung aus dem Gesellschafts-Register: „kündigen bis“ ${v.kuendigenBis}${v.kuendigungsfrist ? ` (${v.kuendigungsfrist})` : ''}. Entscheiden, ob gekündigt oder verlängert wird. Hinweis, keine Rechtsberatung.`,
      });
    }
  }
  return raus;
}
