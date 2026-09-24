// ─── Die EINE Einordnung jeder Buchung ──────────────────────────────────────
// In Malins Cockpit war „Einnahmen“ an drei Stellen verschieden gemeint: die
// Analyse ließ Kredite und Rückzahlungen korrekt draußen, „Luft pro Monat“ und
// „Ist gegen Soll“ zählten sie mit. Hier entscheidet eine Funktion für alle
// Ansichten, was eine Buchung ist. Die fachlichen Regeln sind Malins:
//
//   Umbuchung   zwischen den eigenen Konten / aufs Sparziel — zählt nie
//   Durchlauf   ausgelegtes Geld, das zurückkam — weder Einnahme noch Ausgabe
//   Geliehen    ein erhaltener Kredit — Geld auf dem Konto, gehört anderen
//   Einnahme    planbar | einmalig | offen (noch ohne Art)
//   Ausgabe     fix | variabel

import type { Buchung, Kategorie, Stamm } from './typen';

export type Topf = 'planbar' | 'einmalig' | 'durchlauf' | 'schuld' | 'offen';

/** Malins Tabelle (ansicht-einnahmen.js), samt der alten Namen. */
export const ART: Record<string, Topf> = {
  'Gehalt': 'planbar',
  'Entnahme Kevin (Selbstständigkeit)': 'planbar',
  'Selbstständigkeit': 'planbar',
  'Mieteinnahme': 'planbar',
  'Kindergeld & Sozialleistung': 'planbar',
  'Aktien & Krypto': 'einmalig',
  'Zinsen': 'einmalig',
  'Bonus & Prämie': 'einmalig',
  'Verkauf privat': 'einmalig',
  'Geschenk & Familie': 'einmalig',
  'Geschenk': 'einmalig',
  'Steuererstattung': 'einmalig',
  'Sonstige Einnahme': 'einmalig',
  // Altbestand aus der Zeit mit nur einer Einnahme-Kategorie: bewusst OFFEN,
  // sonst sähe die Aufteilung vollständig aus, obwohl sie geraten ist.
  'Noch einzuordnen': 'offen',
  'Einnahmen': 'offen',
  'Rücküberweisung / Auslage': 'durchlauf',
  'Erstattung / Retoure': 'durchlauf',
  'Erstattung': 'durchlauf',
  'Kredit erhalten': 'schuld',
};
export const KREDIT = 'Kredit erhalten';

/** Unbekanntes fällt auf „einmalig“ — echtes Geld, aber nicht planbar. */
export function artVon(name: string | null | undefined): Topf {
  return ART[String(name ?? '')] ?? 'einmalig';
}
export const istRegelmaessig = (name: string) => artVon(name) === 'planbar';

/** Tilgung: beide Namen, die es im Bestand gibt. Die Analyse kannte nur „Tilgung“. */
export const TILGUNG = ['Tilgung', 'Kredit & Raten'];
export const SPAREN = ['Sparen'];

export type Einordnung =
  | 'umbuchung' | 'durchlauf' | 'geliehen'
  | 'einnahme-planbar' | 'einnahme-einmalig' | 'einnahme-offen'
  | 'ausgabe-fix' | 'ausgabe-variabel';

export type KatName = (id: string | null | undefined) => string;

/** Name einer Kategorie-Kennung — über Aliase (Aufräumen) aufgelöst. */
export function katNamen(stamm: Pick<Stamm, 'kategorien' | 'aliase'>): KatName {
  const nachId = new Map(stamm.kategorien.map(k => [k.id, k.name]));
  return id => {
    if (!id) return '';
    const echt = stamm.aliase?.[id] ?? id;
    return nachId.get(echt) ?? nachId.get(id) ?? '';
  };
}

export function einordnen(b: Pick<Buchung, 'betrag' | 'ist_umbuchung' | 'ist_fixkosten' | 'kategorie_id'>, katName: KatName): Einordnung {
  if (b.ist_umbuchung) return 'umbuchung';
  const name = b.kategorie_id ? katName(b.kategorie_id) : '';
  const art = name ? artVon(name) : null;
  if (art === 'durchlauf') return 'durchlauf';
  if (b.betrag > 0) {
    if (art === 'schuld') return 'geliehen';
    if (!name || art === 'offen') return 'einnahme-offen';
    return art === 'planbar' ? 'einnahme-planbar' : 'einnahme-einmalig';
  }
  return b.ist_fixkosten ? 'ausgabe-fix' : 'ausgabe-variabel';
}

export const istEinkommen = (e: Einordnung) => e === 'einnahme-planbar' || e === 'einnahme-einmalig' || e === 'einnahme-offen';
export const istAusgabe = (e: Einordnung) => e === 'ausgabe-fix' || e === 'ausgabe-variabel';

export interface Summen {
  ein: number; einPlanbar: number; einEinmalig: number; einOffen: number;
  geliehen: number; durchlauf: number;
  ausFix: number; ausVar: number; aus: number;
  saldo: number;
  /** Buchungen, die gezählt wurden (ohne Umbuchungen). */
  anzahl: number;
}

/** Alle Summen einer Buchungsliste nach der einen Einordnung — Cent. */
export function summen(liste: Buchung[], katName: KatName): Summen {
  const s: Summen = { ein: 0, einPlanbar: 0, einEinmalig: 0, einOffen: 0, geliehen: 0, durchlauf: 0, ausFix: 0, ausVar: 0, aus: 0, saldo: 0, anzahl: 0 };
  for (const b of liste) {
    const e = einordnen(b, katName);
    if (e === 'umbuchung') continue;
    s.anzahl++;
    const betrag = Number(b.betrag) || 0;
    switch (e) {
      case 'durchlauf': s.durchlauf += Math.abs(betrag); break;
      case 'geliehen': s.geliehen += betrag; break;
      case 'einnahme-planbar': s.ein += betrag; s.einPlanbar += betrag; break;
      case 'einnahme-einmalig': s.ein += betrag; s.einEinmalig += betrag; break;
      case 'einnahme-offen': s.ein += betrag; s.einOffen += betrag; break;
      case 'ausgabe-fix': s.ausFix += Math.abs(betrag); break;
      case 'ausgabe-variabel': s.ausVar += Math.abs(betrag); break;
    }
  }
  s.aus = s.ausFix + s.ausVar;
  s.saldo = s.ein - s.aus;
  return s;
}

/** Jeder Wert, den die Logik erzeugen kann, muss auswählbar sein (Malins Fallstrick). */
export function einnahmeKategorien(kategorien: Kategorie[]): Kategorie[] {
  return kategorien.filter(k => k.typ === 'einnahme');
}
