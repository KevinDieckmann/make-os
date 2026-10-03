// ─── „So würden deine aktuellen Leads eingestuft“ — die Live-Vorschau der Einstellungen (rein, 03.10.) ────
// Kevin will mit den Werten spielen: bevor etwas gespeichert wird, zeigt diese Rechnung, was sich an den vorhandenen Leads
// ändern würde — MQL und SQL-bereit vorher/nachher, die Temperatur-Verteilung, wie viele Leads die Stufe wechseln und
// ein paar Beispiele. Dieselbe `leads()`-Rechnung wie überall, nur mit den Einstellungen des Entwurfs.

import type { Kontakt } from '@/lib/make-one/crm';
import type { CrmBestand, Temperatur } from './typen';
import { leads, type LeadZeile } from './leads';
import { standardZumRechnen, type ScoringEinstellungen } from './scoring';

export interface VorschauLead { id: string; name: string; punkte: number; temperatur: Temperatur; mql: boolean; sql: boolean }
export interface Vorschau {
  anzahl: number;
  /** Je Kennzahl: [vorher, nachher]. */
  mql: [number, number]; sql: [number, number];
  temperatur: Record<Temperatur, [number, number]>;
  /** Leads, deren Score, Temperatur, MQL oder SQL-Stand sich ändert. */
  wechsler: number;
  beispiele: { vorher: VorschauLead; nachher: VorschauLead }[];
}

const kurz = (z: LeadZeile): VorschauLead => ({ id: z.id, name: z.name, punkte: z.score.punkte, temperatur: z.score.temperatur, mql: !!z.score.scoring?.marketing.erreicht, sql: !!z.score.scoring?.sales.erreicht });
const TEMPERATUREN: Temperatur[] = ['kalt', 'lau', 'warm', 'heiss'];

/** Vorher (die gespeicherten Einstellungen) gegen nachher (der Entwurf) über alle Leads. */
export function scoringVorschau(kontakte: Kontakt[], crm: CrmBestand, heute: string, vorher: ScoringEinstellungen | undefined, nachher: ScoringEinstellungen, beispiele = 8): Vorschau {
  const alt = leads(kontakte, { ...crm, scoring: vorher ?? standardZumRechnen() }, heute);
  const neu = leads(kontakte, { ...crm, scoring: nachher }, heute);
  const jeId = new Map(alt.map(z => [z.id, z]));
  const paare = neu.flatMap(n => { const a = jeId.get(n.id); return a ? [{ vorher: kurz(a), nachher: kurz(n) }] : []; });
  const anders = paare.filter(p => p.vorher.punkte !== p.nachher.punkte || p.vorher.temperatur !== p.nachher.temperatur || p.vorher.mql !== p.nachher.mql || p.vorher.sql !== p.nachher.sql);
  const zaehle = (l: VorschauLead[], f: (x: VorschauLead) => boolean) => l.filter(f).length;
  const v = paare.map(p => p.vorher), n = paare.map(p => p.nachher);
  const temperatur = Object.fromEntries(TEMPERATUREN.map(t => [t, [zaehle(v, x => x.temperatur === t), zaehle(n, x => x.temperatur === t)]])) as Vorschau['temperatur'];
  // Beispiele: die größten Sprünge zuerst (Stufenwechsel vor reinen Punktänderungen).
  const gewicht = (p: { vorher: VorschauLead; nachher: VorschauLead }) => (p.vorher.sql !== p.nachher.sql ? 1000 : 0) + (p.vorher.mql !== p.nachher.mql ? 500 : 0) + (p.vorher.temperatur !== p.nachher.temperatur ? 200 : 0) + Math.abs(p.vorher.punkte - p.nachher.punkte);
  return {
    anzahl: paare.length, mql: [zaehle(v, x => x.mql), zaehle(n, x => x.mql)], sql: [zaehle(v, x => x.sql), zaehle(n, x => x.sql)], temperatur, wechsler: anders.length,
    beispiele: [...anders].sort((a, b) => gewicht(b) - gewicht(a) || a.vorher.name.localeCompare(b.vorher.name)).slice(0, beispiele),
  };
}
