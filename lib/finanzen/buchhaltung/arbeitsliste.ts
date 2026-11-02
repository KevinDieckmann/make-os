// ─── Buchhaltung — die Arbeitsliste der Business-Buchungen (02.11., rein: Server UND Browser) ────────────────────────────────────────
// Chronologisch, seitenweise (nie still gekürzt), Filter Gesellschaft · Konto · Monat/Zeitraum · Kategorie · „nicht zugeordnet“ · Suche.
// „Nicht zugeordnet“ hat drei Gründe — EINE Regel hier (`offenGruende`), Ansicht und Export fragen nur sie:
//   kategorie — Kategorie fehlt / „Sonstiges“, oder die Buchung trägt die Markierung „bitte zuordnen“ (Gesellschafter, Verrechnung),
//   umbuchung — Kategorie „Umbuchung“, aber keine Gegenbuchung im Business-Bestand (Gegenbetrag ±3 Tage, anderes Konto/andere Gesellschaft),
//   rechnung  — Eingang ohne Rechnung (außer Einlagen, Darlehen, Umbuchungen — die sind kein Umsatz).

import { suchPasst } from '@/lib/text/such-norm';
import { istOffeneKategorie, KAT, KEIN_UMSATZ } from './kategorien';
import type { BelegHinweis, Bewirtung, Pruefung } from './pruefung';

/** Markierung „bitte zuordnen“: Geld zwischen Gesellschaft und Privat bei einer Kapitalgesellschaft bzw. zwischen zwei Gesellschaften. */
export type Zuordnen = 'gesellschafter' | 'verrechnung';
export const ZUORDNEN_TEXT: Readonly<Record<Zuordnen, string>> = {
  gesellschafter: 'Gesellschafterdarlehen oder Ausschüttung — bitte zuordnen',
  verrechnung: 'Verrechnung/Darlehen zwischen Gesellschaften — bitte zuordnen',
};

/** Eine Business-Buchung, wie sie der Browser bekommt (Bestand `buchungen` + `stand` = Fingerabdruck, nie gespeichert). */
export interface BhBuchung {
  id: string; datum: string; wer: string; betrag: number; kategorie: string;
  zweck?: string; konto?: string; ort?: string; rechnungId?: string; auszug?: string; beleg?: string;
  /** Notiz der Buchhaltung (eigener Text). */
  notiz?: string;
  /** Mandat, zu dem die Buchung gehört (CRM-Kennung). */
  mandatId?: string;
  /** Die Kategorie hat ein Mensch gesetzt — eine Regel überschreibt sie nie. */
  kategorieHand?: true;
  /** Die Kategorie kam aus dieser Regel (`br-…`). */
  regel?: string;
  /** „bitte zuordnen“ (siehe `Zuordnen`). */
  zuordnen?: Zuordnen;
  /** Prüfmodus (lib/finanzen/buchhaltung/pruefung.ts): Vorschlag, Frage, bestätigt von/am. */
  pruefung?: Pruefung;
  /** Bewirtung: Anlass und Teilnehmer. */
  bewirtung?: Bewirtung;
  /** Gibt es einen Beleg, und wo? (anders als `beleg` = Kennung eines übernommenen Belegs) */
  belegHinweis?: BelegHinweis;
  stand?: string;
}

export type OffenGrund = 'kategorie' | 'umbuchung' | 'rechnung';
export const OFFEN_TEXT: Readonly<Record<OffenGrund, string>> = {
  kategorie: 'Kategorie fehlt',
  umbuchung: 'Umbuchung ohne Gegenbuchung',
  rechnung: 'Eingang ohne Rechnung',
};

const cent = (b: Pick<BhBuchung, 'betrag'>) => Math.round(Number(b.betrag) * 100);
const tagMs = (d: string) => Date.parse(`${d}T12:00:00Z`);
const UMBUCHUNG_TAGE = 3;

/** Die Umbuchungen, die eine Gegenbuchung im Bestand haben (Gegenbetrag, ±3 Tage, anderes Konto oder andere Gesellschaft) — jede Gegenbuchung zählt einmal. */
export function mitGegenbuchung(alle: readonly BhBuchung[]): Set<string> {
  return new Set(Array.from(gegenbuchungPaare(alle).keys()));
}

/** Wie `mitGegenbuchung`, aber mit dem Partner: Kennung → Kennung der Gegenbuchung (beide Richtungen). */
export function gegenbuchungPaare(alle: readonly BhBuchung[]): Map<string, string> {
  const umb = alle.filter(b => b.kategorie === KAT.umbuchung).sort((a, b) => a.datum.localeCompare(b.datum) || a.id.localeCompare(b.id));
  const nachCent = new Map<number, BhBuchung[]>();
  for (const b of umb) { const c = cent(b); nachCent.set(c, [...(nachCent.get(c) ?? []), b]); }
  const gepaart = new Map<string, string>();
  for (const b of umb) {
    if (gepaart.has(b.id)) continue;
    const kandidat = (nachCent.get(-cent(b)) ?? []).find(g => g.id !== b.id && !gepaart.has(g.id)
      && Math.abs(tagMs(g.datum) - tagMs(b.datum)) <= UMBUCHUNG_TAGE * 86_400_000 && ((g.konto ?? '') !== (b.konto ?? '') || (g.ort ?? '') !== (b.ort ?? '')));
    if (kandidat) { gepaart.set(b.id, kandidat.id); gepaart.set(kandidat.id, b.id); }
  }
  return gepaart;
}

/** Warum ist eine Buchung noch nicht zugeordnet? Leer = zugeordnet. */
export function offenGruende(b: BhBuchung, gegen: ReadonlySet<string>): OffenGrund[] {
  const raus: OffenGrund[] = [];
  if (istOffeneKategorie(b.kategorie) || b.zuordnen) raus.push('kategorie');
  if (b.kategorie === KAT.umbuchung && !gegen.has(b.id)) raus.push('umbuchung');
  if (Number(b.betrag) > 0 && !b.rechnungId && !KEIN_UMSATZ.has(b.kategorie) && !b.zuordnen) raus.push('rechnung');
  return raus;
}

export interface ListenFilter {
  /** Nur diese Orte (Gesellschaften). Leer/fehlt = alle, die der Liste übergeben werden. */
  orte?: readonly string[];
  konto?: string;
  /** YYYY-MM */
  monat?: string;
  /** YYYY-MM-DD, einschließlich */
  von?: string;
  bis?: string;
  kategorie?: string;
  /** „nicht zugeordnet“: alle Gründe oder genau einer. */
  offen?: 'alle' | OffenGrund;
  suche?: string;
  /** Sortierung nach Datum. Vorgabe: neueste zuerst. */
  richtung?: 'auf' | 'ab';
}

/** Filtern und sortieren (nach Datum, dann Kennung — stabil). */
export function filtern(alle: readonly BhBuchung[], f: ListenFilter, gegen: ReadonlySet<string> = mitGegenbuchung(alle)): BhBuchung[] {
  const raus = alle.filter(b => {
    if (f.orte?.length && !f.orte.includes(b.ort ?? '')) return false;
    if (f.konto && (b.konto ?? '') !== f.konto) return false;
    if (f.monat && b.datum.slice(0, 7) !== f.monat) return false;
    if (f.von && b.datum < f.von) return false;
    if (f.bis && b.datum > f.bis) return false;
    if (f.kategorie && b.kategorie !== f.kategorie) return false;
    if (f.offen) { const g = offenGruende(b, gegen); if (f.offen === 'alle' ? !g.length : !g.includes(f.offen)) return false; }
    if (f.suche && !suchPasst([b.wer, b.zweck, b.kategorie, b.notiz, b.konto], f.suche)) return false;
    return true;
  });
  const r = f.richtung === 'auf' ? 1 : -1;
  return raus.sort((a, b) => r * (a.datum.localeCompare(b.datum) || a.id.localeCompare(b.id)));
}

export const JE_SEITE = 100;

/** Eine Seite der Liste (1-basiert, geklemmt) — die Ansicht nennt immer „x–y von n“, es fällt nichts still weg. */
export function seiteVon<T>(liste: readonly T[], nr: number, je = JE_SEITE): { zeilen: T[]; seite: number; seiten: number; gesamt: number; von: number; bis: number } {
  const seiten = Math.max(1, Math.ceil(liste.length / je));
  const seite = Math.min(Math.max(1, Math.floor(nr) || 1), seiten);
  const start = (seite - 1) * je;
  const zeilen = liste.slice(start, start + je);
  return { zeilen, seite, seiten, gesamt: liste.length, von: liste.length ? start + 1 : 0, bis: start + zeilen.length };
}

/** Summen in Cent (Eingang, Ausgang als positive Zahl). */
export function summen(liste: readonly BhBuchung[]): { einCent: number; ausCent: number } {
  let einCent = 0, ausCent = 0;
  for (const b of liste) { const c = cent(b); if (c > 0) einCent += c; else ausCent -= c; }
  return { einCent, ausCent };
}

/** Monatssummen je Kategorie (Ist, nur Anzeige): Monate aufsteigend, Kategorien nach Betrag (Ein- und Ausgänge mit Vorzeichen). */
export function monatssummen(liste: readonly BhBuchung[]): { monate: string[]; zeilen: { kategorie: string; je: Record<string, number>; gesamt: number }[] } {
  const monate = Array.from(new Set(liste.map(b => b.datum.slice(0, 7)))).sort();
  const m = new Map<string, Record<string, number>>();
  for (const b of liste) {
    const k = b.kategorie || KAT.sonstiges;
    const je = m.get(k) ?? {};
    const mo = b.datum.slice(0, 7);
    je[mo] = (je[mo] ?? 0) + cent(b);
    m.set(k, je);
  }
  const zeilen = Array.from(m.entries()).map(([kategorie, je]) => ({ kategorie, je, gesamt: Object.values(je).reduce((s, x) => s + x, 0) }))
    .sort((a, b) => Math.abs(b.gesamt) - Math.abs(a.gesamt) || a.kategorie.localeCompare(b.kategorie));
  return { monate, zeilen };
}
