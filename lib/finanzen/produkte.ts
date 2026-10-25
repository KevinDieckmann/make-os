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
import { neuerBaustein, RHYTHMUS_LABEL } from './szenarien';
import { planMonat } from './rechenkern';
import { zusatzName } from '@/lib/crm/mandat-zusatz';
import { festerMonatswert, geplanterMonatswert } from '@/lib/crm/pipeline';
import { preisBasisVon as kartenBasis, basisAusAltpreis, planBausteinAusProdukt, RHYTHMUS_AUS_BASIS as KARTE_RHYTHMUS, type PreisBasis as KartenPreisBasis } from '@/lib/crm/produkt-karte';

export type PreisBasis = KartenPreisBasis;

/**
 * Basis des Preises (EINE Regel in lib/crm/produkt-karte.ts, 19.10.): mit Preis-Teilen aus dem Hauptpreis-Teil, sonst wie bisher eingetragen bzw.
 * aus der Einheit („Monat netto“ → monat, „Jahr“ → jahr, sonst einmalig); null, wenn nichts erkennbar.
 */
export function preisBasisVon(l: Pick<Leistung, 'preis'> & Partial<Pick<Leistung, 'preise'>>): PreisBasis | null {
  return kartenBasis(l);
}
export const RHYTHMUS_AUS_BASIS: Record<PreisBasis, Rhythmus> = KARTE_RHYTHMUS;

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
  const ausText = basisAusAltpreis({ einheit: e });
  return ausText && ausText !== basis ? EINHEIT_VORGABE[basis] : e;
}
/** Anzeige-Einheit eines Produkts (Katalog, Angebots-Produktwahl, Liste) — mit Preis-Teilen die Einheit des Hauptpreis-Teils. */
export const produktEinheit = (l: Pick<Leistung, 'preis'> & Partial<Pick<Leistung, 'preise'>>): string => {
  const p = planBausteinAusProdukt({ preis: l.preis, preise: l.preise });
  // Die Einheit, wie das Produkt ABGERECHNET wird (Tages-/Stundensatz: „Tag/Stunde netto“) — geplant wird beim Satz monatlich (21.10., B4).
  return einheitFuerBasis(p.einheit, p.anzeigeBasis);
};

/**
 * Einheit der Planung aus der Gesellschaft des Produkts (28.09., eine Einheitenliste):
 * kdc · kdv · ug wie im CRM — die Selbstständigkeit ist eine eigene Achse im Baukasten
 * (seit dem Kern-Umbau 02.10. auch im Kern mit eigener Achse, `rechneSelbstAchse`). „offen“ bleibt bei der UG wie bisher.
 */
export function einheitAusGesellschaft(g: Leistung['gesellschaft'] | 'offen'): BausteinEinheit {
  return g === 'kdv' || g === 'kdc' ? g : 'ug';
}

/** Was dem Produkt für die Planung fehlt — leer heißt: planbar (EINE Regel: `planBausteinAusProdukt`). */
export function planungFehlt(l: Leistung): string[] {
  return planBausteinAusProdukt(l).fehlt;
}

/** Marge je Einheit aus Preis (Hauptpreis) und Aufwandsanteil — null ohne Angabe. */
export function margeVon(l: Pick<Leistung, 'preis' | 'aufwand'> & Partial<Pick<Leistung, 'preise'>>): { kosten: number; marge: number; anteil: number } | null {
  const a = l.aufwand?.anteil;
  // Je Einheit: beim Tages-/Stundensatz der Satz (nicht der geplante Monatsbetrag).
  const p = planBausteinAusProdukt({ preis: l.preis, preise: l.preise });
  const preis = p.satz?.betrag ?? p.preis;
  if (a == null || !Number.isFinite(a) || !preis) return null;
  const kosten = preis * Math.max(0, Math.min(1, a));
  return { kosten, marge: preis - kosten, anteil: a };
}

export interface ProduktVorschlag {
  id: string; name: string; typ: Leistung['typ']; stufe: Leistung['stufe']; status: Leistung['status'];
  preis: number; einheit: string; basis: PreisBasis | null; laufzeit: number | null; gesellschaft: Leistung['gesellschaft'];
  fehlt: string[]; planEinheit: BausteinEinheit;
  /** Kostenlos (21.10., B4) — die Planung sagt „kostenlos“ statt „Preis offen“. */
  kostenlos?: boolean;
  /** Tages-/Stundensatz (21.10., B4): Satz, geplante Menge je Monat, Einheit — `preis` ist dann Satz × Menge je Monat. */
  satz?: { betrag: number; menge: number; einheit: string };
}
/** Produkte des Katalogs, wie die Planung sie braucht (aktiv zuerst, eingestellte nicht). */
export function produktVorschlaege(crm: Pick<CrmBestand, 'leistungen'>): ProduktVorschlag[] {
  const rang = { aktiv: 0, entwurf: 1, eingestellt: 2 } as const;
  return crm.leistungen.filter(l => l.status !== 'eingestellt' && !l.geloeschtAm).sort((a, b) => rang[a.status] - rang[b.status] || a.name.localeCompare(b.name)).map(l => {
    // EINE Stelle (lib/crm/produkt-karte.ts, 19.10.): Hauptpreis, Basis, Laufzeit (Mindestlaufzeit), Lücken — ohne Preis-Teile wie bisher.
    const p = planBausteinAusProdukt(l);
    return {
      id: l.id, name: l.name, typ: l.typ, stufe: l.stufe, status: l.status, preis: p.preis, einheit: p.einheit,
      basis: p.basis, laufzeit: p.laufzeit, gesellschaft: l.gesellschaft, fehlt: p.fehlt, planEinheit: einheitAusGesellschaft(l.gesellschaft),
      ...(p.kostenlos ? { kostenlos: true } : {}), ...(p.satz ? { satz: p.satz } : {}),
    };
  });
}

const euroText = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 });
/**
 * Wie die Planung den Preis eines Produkts nennt (21.10., Rundgang B4): „kostenlos“ (vorher „Preis offen“), beim Tages-/Stundensatz der geplante Monat
 * „2.400 € monatlich (15 Std. × 160 €)“ (vorher „160 € einmalig“), sonst „Betrag Rhythmus“ bzw. „Preis offen“.
 */
export function produktPlanText(p: Pick<ProduktVorschlag, 'preis' | 'basis'> & Partial<Pick<ProduktVorschlag, 'kostenlos' | 'satz'>>): string {
  if (p.kostenlos) return 'kostenlos';
  if (p.satz) {
    const je = p.satz.einheit === 'Std.' ? 'Stunde' : 'Tag';
    if (!p.satz.betrag) return 'Preis offen';
    return p.satz.menge ? `${euroText(p.preis)} € monatlich (${euroText(p.satz.menge)} ${p.satz.einheit} × ${euroText(p.satz.betrag)} €)` : `${euroText(p.satz.betrag)} € je ${je} · geplante Menge je Monat offen`;
  }
  if (!p.preis) return 'Preis offen';
  return `${euroText(p.preis)} € ${p.basis ? RHYTHMUS_LABEL[RHYTHMUS_AUS_BASIS[p.basis]] : ''}`.trim();
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
  /**
   * Ein Teil neben dem Hauptpreis (25.10., Kern-Reste 3): ein Zusatzmodul des Mandats (`zusatz:<mz-…>`) bzw. der Einmal-Anteil eines gewonnenen Deals (`einmal`).
   * Fehlt beim Hauptpreis. Ein eigener Preis-Teil des Produkts trägt kein `produktId` — das Produkt stünde sonst zweimal im Plan.
   */
  teil?: string;
  /** Name des Bausteins für einen Teil („<Produkt> · Festpreis“) — sonst Produkt bzw. Titel. */
  name?: string;
}
const monateZwischen = (von: string, bis: string) => Math.max(1, Math.round((Date.parse(bis) - Date.parse(von)) / (30.44 * 864e5)));
/** Betrag und Rhythmus eines Zusatzmoduls im Plan — je Einheit bzw. Satz ohne geplante Menge nur nach Abrechnung (dann null), inklusive nie. */
function zusatzImPlan(z: NonNullable<Mandat['zusatz']>[number]): { betrag: number; rhythmus: Rhythmus } | null {
  const h = z.honorar;
  if (z.inklusive || !h || !(h.betragCent > 0)) return null;
  const satz = h.betragCent / 100;
  switch (h.basis) {
    case 'monat': return { betrag: satz, rhythmus: 'monatlich' };
    case 'jahr': return { betrag: satz, rhythmus: 'jaehrlich' };
    case 'einmalig': return { betrag: satz, rhythmus: 'einmalig' };
    // Tages-/Stundensatz wie die Liquidität: Satz × geplante Menge je Monat.
    case 'tag': return z.tageJeMonat ? { betrag: Math.round(satz * z.tageJeMonat * 100) / 100, rhythmus: 'monatlich' } : null;
    case 'stunde': return z.stundenJeMonat ? { betrag: Math.round(satz * z.stundenJeMonat * 100) / 100, rhythmus: 'monatlich' } : null;
    default: return null;
  }
}
/**
 * Aktive Mandate und gewonnene Deals mit Produkt — als Ist-Basis für Umsatzbausteine (lesend). Seit 25.10. (Kern-Reste 3) auch die Teile neben dem Hauptpreis:
 * je Zusatzmodul ein Eintrag (eigene Preis-Teile „<Produkt> · <Teil>“, andere Produkte mit ihrem Produkt) und der Einmal-Anteil eines gewonnenen Deals
 * (`wert.einmalBetrag`) — vorher fehlten beide in der Planung.
 */
export function istBasisVorschlaege(crm: Pick<CrmBestand, 'mandate' | 'chancen' | 'leistungen'>, heute: string): IstBasisVorschlag[] {
  const produkt = (id?: string) => (id ? crm.leistungen.find(l => l.id === id) : undefined);
  const startAus = (datum?: string) => (datum ? Math.max(1, planMonat(`${datum.slice(0, 7)}-01`)) : Math.max(1, planMonat(`${heute.slice(0, 7)}-01`)));
  const out: IstBasisVorschlag[] = [];
  const mandate = crm.mandate.filter((m): m is Mandat => m.status === 'aktiv');
  for (const m of mandate) {
    const l = produkt(m.leistungId);
    const laufzeit = m.ende && m.start ? monateZwischen(m.start, m.ende) : m.mindestlaufzeitMonate ?? l?.laufzeitMonate ?? null;
    if (m.honorar.betrag > 0) {
      // Tagessatz mit geplanten Tagen (21.10., B4): Satz × Tage je Monat — sonst wie bisher.
      const tage = m.honorar.basis === 'tag' && m.tageJeMonat ? m.tageJeMonat : 0;
      const betrag = tage ? Math.round(m.honorar.betrag * tage * 100) / 100 : m.honorar.betrag;
      out.push({ quelle: 'mandat', quelleId: m.id, kunde: m.kunde, titel: m.titel, produktId: l?.id, produkt: l?.name, betrag, rhythmus: m.honorar.basis === 'monat' || tage ? 'monatlich' : 'einmalig', laufzeit, start: startAus(m.start), gesellschaft: m.gesellschaft });
    }
    for (const z of m.zusatz ?? []) {
      const p = zusatzImPlan(z);
      if (!p) continue;
      const zl = z.preisTeilId ? undefined : produkt(z.leistungId);
      const ab = z.ab ?? m.start;
      const zLaufzeit = z.bis && ab ? monateZwischen(ab, z.bis) : laufzeit;
      out.push({
        quelle: 'mandat', quelleId: m.id, teil: `zusatz:${z.id}`, name: zusatzName(z, crm.leistungen), kunde: m.kunde, titel: m.titel, ...(zl ? { produktId: zl.id, produkt: zl.name } : {}),
        betrag: p.betrag, rhythmus: p.rhythmus, laufzeit: p.rhythmus === 'einmalig' ? null : zLaufzeit, start: startAus(ab), gesellschaft: m.gesellschaft,
      });
    }
  }
  const einmalVon = (c: Chance) => (typeof c.wert.einmalBetrag === 'number' && c.wert.einmalBetrag > 0 ? c.wert.einmalBetrag : 0);
  const gewonnen = crm.chancen.filter((c): c is Chance => c.stufe === 'gewonnen' && (c.wert.betrag > 0 || einmalVon(c) > 0) && !crm.mandate.some(m => m.chanceId === c.id));
  for (const c of gewonnen) {
    const l = produkt(c.leistungId);
    // 25.10.: geplante Tages-/Stundensätze (`wert.geplantBetrag`) als eigener Eintrag — der Hauptpreis ist nur das feste Honorar (`festerMonatswert`).
    const geplant = geplanterMonatswert(c);
    const fest = geplant ? festerMonatswert(c) : c.wert.betrag;
    const rhythmus: Rhythmus = c.wert.basis === 'monat' ? 'monatlich' : c.wert.basis === 'jahr' ? 'jaehrlich' : 'einmalig';
    const laufzeit = c.wert.laufzeitMonate ?? l?.laufzeitMonate ?? null;
    if (fest > 0) out.push({ quelle: 'deal', quelleId: c.id, kunde: c.firma ?? c.titel, titel: c.titel, produktId: l?.id, produkt: l?.name, betrag: fest, rhythmus, laufzeit, start: startAus(), gesellschaft: c.gesellschaft });
    if (geplant) out.push({ quelle: 'deal', quelleId: c.id, teil: 'geplant', name: `${l?.name ?? c.titel} · ${c.wert.geplantSatz === 'stunde' ? 'Stundensätze' : c.wert.geplantSatz === 'tag' ? 'Tagessätze' : 'Sätze'} (geplant)`, kunde: c.firma ?? c.titel, titel: c.titel, betrag: geplant, rhythmus: 'monatlich', laufzeit, start: startAus(), gesellschaft: c.gesellschaft });
    const einmal = einmalVon(c);
    if (einmal) out.push({ quelle: 'deal', quelleId: c.id, teil: 'einmal', name: `${l?.name ?? c.titel} · einmalig`, kunde: c.firma ?? c.titel, titel: c.titel, betrag: einmal, rhythmus: 'einmalig', laufzeit: null, start: startAus(), gesellschaft: c.gesellschaft });
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
