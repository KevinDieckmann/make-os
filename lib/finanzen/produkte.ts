// ─── Finanzplanung jetzt — Produkte als die eine Quelle der Umsatzbausteine ──
// Kevin 27.09.: „… nochmal über die Produktseite gehen, damit wir das Ganze
// einmal sauber haben — clean von vorne bis hinten.“ Datenfluss:
//   Produkt (CRM-Katalog, /os/mandate?s=produkte) → Deal (leistungId) → Mandat
//   (leistungId, honorar) → Planung: Umsatzbaustein = Produkt × Menge × Preis ×
//   Start × Laufzeit. Diese Datei liest nur (Typen aus lib/crm/typen.ts) und
//   schreibt nie ins CRM. Die Planung funktioniert auch ohne Produkt — dann
//   heißt der Baustein „ohne Produkt“.

import type { Chance, CrmBestand, Leistung, Mandat } from '@/lib/crm/typen';
import type { Baustein, BausteinEinheit, Rhythmus } from './szenarien';
import { neuerBaustein } from './szenarien';
import { planMonat } from './rechenkern';

export type PreisBasis = NonNullable<Leistung['preis']['basis']>;

/** Basis des Preises: eingetragen, sonst aus der Einheit („Monat netto“ → monat, „Jahr“ → jahr, sonst einmalig); null, wenn nichts erkennbar. */
export function preisBasisVon(l: Pick<Leistung, 'preis'>): PreisBasis | null {
  if (l.preis.basis) return l.preis.basis;
  const e = (l.preis.einheit ?? '').toLowerCase();
  if (/monat|mtl|\/m\b|month/.test(e)) return 'monat';
  if (/jahr|jährlich|jaehrlich|p\.\s*a\.|year/.test(e)) return 'jahr';
  if (/einmal|pauschal|projekt|tag|stunde|workshop|festpreis|one/.test(e)) return 'einmalig';
  return null;
}
export const RHYTHMUS_AUS_BASIS: Record<PreisBasis, Rhythmus> = { monat: 'monatlich', jahr: 'jaehrlich', einmalig: 'einmalig' };

/** Einheit, die zur Basis passt (29.09., Sichtprüfung): „Monat netto“ · „Jahr netto“ · „pauschal netto“. */
export const EINHEIT_VORGABE: Record<PreisBasis, string> = { monat: 'Monat netto', jahr: 'Jahr netto', einmalig: 'pauschal netto' };

/**
 * Die Einheit zur Basis: eine eingetragene Einheit bleibt, solange sie nicht einer ANDEREN Basis widerspricht — ein Produkt
 * „einmalig“ mit „Monat netto“ (die Vorgabe beim Anlegen) zeigt „pauschal netto“. Leer → Vorgabe der Basis.
 */
export function einheitFuerBasis(einheit: string | undefined, basis: PreisBasis | null): string {
  const e = (einheit ?? '').trim();
  if (!basis) return e;
  if (!e) return EINHEIT_VORGABE[basis];
  const ausText = preisBasisVon({ preis: { betrag: 0, einheit: e } });
  return ausText && ausText !== basis ? EINHEIT_VORGABE[basis] : e;
}
/** Anzeige-Einheit eines Produkts (Katalog, Angebots-Produktwahl, Liste). */
export const produktEinheit = (l: Pick<Leistung, 'preis'>): string => einheitFuerBasis(l.preis.einheit, preisBasisVon(l));

/**
 * Einheit der Planung aus der Gesellschaft des Produkts (28.09., eine Einheitenliste):
 * kdc · kdv · ug wie im CRM — die Selbstständigkeit ist eine eigene Achse im Baukasten
 * (seit dem Kern-Umbau 02.10. auch im Kern mit eigener Achse, `rechneSelbstAchse`). „offen“ bleibt bei der UG wie bisher.
 */
export function einheitAusGesellschaft(g: Leistung['gesellschaft'] | 'offen'): BausteinEinheit {
  return g === 'kdv' || g === 'kdc' ? g : 'ug';
}

/** Was dem Produkt für die Planung fehlt — leer heißt: planbar. */
export function planungFehlt(l: Leistung): string[] {
  const f: string[] = [];
  if (!l.preis.betrag) f.push('Preis');
  if (!preisBasisVon(l)) f.push('Basis (Monat · Jahr · einmalig)');
  if (preisBasisVon(l) !== 'einmalig' && !l.laufzeitMonate) f.push('Laufzeit');
  if (l.gesellschaft === 'offen') f.push('Gesellschaft');
  return f;
}

/** Marge je Einheit aus Preis und Aufwandsanteil — null ohne Angabe. */
export function margeVon(l: Pick<Leistung, 'preis' | 'aufwand'>): { kosten: number; marge: number; anteil: number } | null {
  const a = l.aufwand?.anteil;
  if (a == null || !Number.isFinite(a) || !l.preis.betrag) return null;
  const kosten = l.preis.betrag * Math.max(0, Math.min(1, a));
  return { kosten, marge: l.preis.betrag - kosten, anteil: a };
}

export interface ProduktVorschlag {
  id: string; name: string; typ: Leistung['typ']; stufe: Leistung['stufe']; status: Leistung['status'];
  preis: number; einheit: string; basis: PreisBasis | null; laufzeit: number | null; gesellschaft: Leistung['gesellschaft'];
  fehlt: string[]; planEinheit: BausteinEinheit;
}
/** Produkte des Katalogs, wie die Planung sie braucht (aktiv zuerst, eingestellte nicht). */
export function produktVorschlaege(crm: Pick<CrmBestand, 'leistungen'>): ProduktVorschlag[] {
  const rang = { aktiv: 0, entwurf: 1, eingestellt: 2 } as const;
  return crm.leistungen.filter(l => l.status !== 'eingestellt' && !l.geloeschtAm).sort((a, b) => rang[a.status] - rang[b.status] || a.name.localeCompare(b.name)).map(l => ({
    id: l.id, name: l.name, typ: l.typ, stufe: l.stufe, status: l.status, preis: l.preis.betrag, einheit: l.preis.einheit,
    basis: preisBasisVon(l), laufzeit: l.laufzeitMonate ?? null, gesellschaft: l.gesellschaft, fehlt: planungFehlt(l), planEinheit: einheitAusGesellschaft(l.gesellschaft),
  }));
}

/** Umsatzbaustein aus einem Produkt — Preis, Rhythmus, Laufzeit und Einheit vorbelegt, alles überschreibbar. */
export function bausteinAusProdukt(id: string, p: ProduktVorschlag, teil: Partial<Baustein> = {}): Baustein {
  const basis = p.basis ?? 'monat';
  return neuerBaustein(id, {
    art: 'umsatz', einheit: p.planEinheit, name: p.name, produkt: p.name, produktId: p.id, preis: p.preis, menge: 1,
    rhythmus: RHYTHMUS_AUS_BASIS[basis], start: 1, ...(basis !== 'einmalig' && p.laufzeit ? { laufzeit: p.laufzeit } : {}), ...teil,
  });
}

export interface IstBasisVorschlag {
  /** Woher: aktives Mandat oder gewonnener Deal. */
  quelle: 'mandat' | 'deal'; quelleId: string; kunde: string; titel: string;
  produktId?: string; produkt?: string; betrag: number; rhythmus: Rhythmus; laufzeit: number | null; start: number; gesellschaft: Leistung['gesellschaft'] | 'offen';
}
/** Aktive Mandate und gewonnene Deals mit Produkt — als Ist-Basis für Umsatzbausteine (lesend). */
export function istBasisVorschlaege(crm: Pick<CrmBestand, 'mandate' | 'chancen' | 'leistungen'>, heute: string): IstBasisVorschlag[] {
  const produkt = (id?: string) => (id ? crm.leistungen.find(l => l.id === id) : undefined);
  const startAus = (datum?: string) => (datum ? Math.max(1, planMonat(`${datum.slice(0, 7)}-01`)) : Math.max(1, planMonat(`${heute.slice(0, 7)}-01`)));
  const out: IstBasisVorschlag[] = [];
  const mandate = crm.mandate.filter((m): m is Mandat => m.status === 'aktiv' && m.honorar.betrag > 0);
  for (const m of mandate) {
    const l = produkt(m.leistungId);
    const laufzeit = m.ende && m.start ? Math.max(1, Math.round((Date.parse(m.ende) - Date.parse(m.start)) / (30.44 * 864e5))) : m.mindestlaufzeitMonate ?? l?.laufzeitMonate ?? null;
    out.push({ quelle: 'mandat', quelleId: m.id, kunde: m.kunde, titel: m.titel, produktId: l?.id, produkt: l?.name, betrag: m.honorar.betrag, rhythmus: m.honorar.basis === 'monat' ? 'monatlich' : 'einmalig', laufzeit, start: startAus(m.start), gesellschaft: m.gesellschaft });
  }
  const gewonnen = crm.chancen.filter((c): c is Chance => c.stufe === 'gewonnen' && c.wert.betrag > 0 && !crm.mandate.some(m => m.chanceId === c.id));
  for (const c of gewonnen) {
    const l = produkt(c.leistungId);
    out.push({ quelle: 'deal', quelleId: c.id, kunde: c.firma ?? c.titel, titel: c.titel, produktId: l?.id, produkt: l?.name, betrag: c.wert.betrag, rhythmus: c.wert.basis === 'monat' ? 'monatlich' : c.wert.basis === 'jahr' ? 'jaehrlich' : 'einmalig', laufzeit: c.wert.laufzeitMonate ?? l?.laufzeitMonate ?? null, start: startAus(), gesellschaft: c.gesellschaft });
  }
  return out;
}

/** In welchen Planszenarien ein Produkt steckt — für die Produktseite (lesend). */
export function produktInSzenarien(planszenarien: { id: string; name: string; bausteine: Baustein[] }[], arbeitsplan: string | null | undefined): Record<string, { id: string; name: string; arbeitsplan: boolean; menge: number }[]> {
  const out: Record<string, { id: string; name: string; arbeitsplan: boolean; menge: number }[]> = {};
  for (const ps of planszenarien) {
    const je = new Map<string, number>();
    for (const b of ps.bausteine) if (b.art === 'umsatz' && b.produktId && b.an) je.set(b.produktId, (je.get(b.produktId) ?? 0) + b.menge);
    for (const [pid, menge] of je) (out[pid] ??= []).push({ id: ps.id, name: ps.name, arbeitsplan: ps.id === arbeitsplan, menge });
  }
  return out;
}
