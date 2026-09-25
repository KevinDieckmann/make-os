// ─── Produkte & Mandate (rein, getestet) ────────────────────────────────────
// Kevin 25.09.: „Das Mandaten-Abteil auf die linke Seite unter Aufgaben — da
// ist das Thema Produkte und Mandate abgebildet.“ Entscheidungen: eigener
// Bereich (/os/mandate), Sales verlinkt dorthin; je Produkt Zahlen,
// Unterlagen, Produktlinie und Ablauf in Phasen.
// Ein Produkt ist eine Leistung aus dem Katalog (CRM-Liste „leistungen“);
// Mandate und Deals zeigen über leistungId darauf.

import type { CrmBestand, Leistung, Mandat, ChancenStufe } from './typen';

/** Die Linien in ihrer Reihenfolge — weitere (frei eingetragene) folgen alphabetisch. */
export const LINIEN = ['Beratung & Begleitung', 'Workshops & Formate', 'Vermittlung & Provision', 'Software'] as const;
const LINIE_AUS_TYP: Record<Leistung['typ'], string> = {
  retainer: 'Beratung & Begleitung', diagnose: 'Beratung & Begleitung', sprint: 'Beratung & Begleitung',
  workshop: 'Workshops & Formate', vermittlung: 'Vermittlung & Provision', software: 'Software',
};
const STUFE_RANG = { einstieg: 0, kern: 1, premium: 2 } as const;
const STATUS_RANG = { aktiv: 0, entwurf: 1, eingestellt: 2 } as const;
const OFFEN: ChancenStufe[] = ['qualifiziert', 'bedarf', 'diagnose', 'angebot', 'abschluss'];

/** Linie eines Produkts: eingetragen, sonst aus dem Typ. */
export function linieVon(l: Pick<Leistung, 'linie' | 'typ'>): string {
  return l.linie?.trim() || LINIE_AUS_TYP[l.typ] || 'Weitere';
}

/** Produkte nach Linie: bekannte Linien zuerst, darin aktiv vor Entwurf, Einstieg → Kern → Premium. */
export function linienGruppen(leistungen: Leistung[]): { linie: string; produkte: Leistung[] }[] {
  const je = new Map<string, Leistung[]>();
  for (const l of leistungen) je.set(linieVon(l), [...(je.get(linieVon(l)) ?? []), l]);
  const rang = (x: string) => { const i = (LINIEN as readonly string[]).indexOf(x); return i < 0 ? 100 : i; };
  return Array.from(je.entries())
    .sort(([a], [b]) => rang(a) - rang(b) || a.localeCompare(b))
    .map(([linie, produkte]) => ({ linie, produkte: [...produkte].sort((a, b) => STATUS_RANG[a.status] - STATUS_RANG[b.status] || STUFE_RANG[a.stufe] - STUFE_RANG[b.stufe] || a.name.localeCompare(b.name)) }));
}

export interface ProduktZahlen {
  mandateAktiv: number; mandateGesamt: number;
  /** Monatliche Honorare der aktiven Mandate (netto). */
  mrr: number;
  /** Einmalige Honorare aller nicht verworfenen Mandate. */
  einmalig: number;
  dealsOffen: number; pipelineWert: number;
  gewonnen: number; verloren: number;
  /** Gewonnen ÷ (gewonnen + verloren) — null ohne abgeschlossenen Deal. */
  quote: number | null;
}

/** Monatswert eines Deals (einmalig zählt einmal, Jahr ÷ 12). */
const dealMonat = (w: { betrag: number; basis: 'monat' | 'jahr' | 'einmalig' }) => (w.basis === 'jahr' ? w.betrag / 12 : w.betrag);

export function produktZahlen(l: Pick<Leistung, 'id'>, crm: Pick<CrmBestand, 'mandate' | 'chancen'>): ProduktZahlen {
  const m = crm.mandate.filter(x => x.leistungId === l.id);
  const aktiv = m.filter(x => x.status === 'aktiv');
  const c = crm.chancen.filter(x => x.leistungId === l.id);
  const offen = c.filter(x => OFFEN.includes(x.stufe));
  const gewonnen = c.filter(x => x.stufe === 'gewonnen').length;
  const verloren = c.filter(x => x.stufe === 'verloren').length;
  return {
    mandateAktiv: aktiv.length, mandateGesamt: m.length,
    mrr: aktiv.filter(x => x.honorar.basis === 'monat').reduce((s, x) => s + x.honorar.betrag, 0),
    einmalig: m.filter(x => x.status !== 'beendet' || x.honorar.basis === 'einmalig').filter(x => x.honorar.basis === 'einmalig').reduce((s, x) => s + x.honorar.betrag, 0),
    dealsOffen: offen.length, pipelineWert: Math.round(offen.reduce((s, x) => s + dealMonat(x.wert), 0)),
    gewonnen, verloren, quote: gewonnen + verloren ? gewonnen / (gewonnen + verloren) : null,
  };
}

/** Kennzahlen des ganzen Bestands für den Kopf der Seite. */
export function portfolio(crm: Pick<CrmBestand, 'mandate' | 'leistungen'>): { aktiv: number; mrr: number; ohneProdukt: number; produkteAktiv: number; groessterKunde: { kunde: string; anteil: number } | null } {
  const aktiv = crm.mandate.filter(m => m.status === 'aktiv');
  const mrr = aktiv.filter(m => m.honorar.basis === 'monat').reduce((s, m) => s + m.honorar.betrag, 0);
  const jeKunde = new Map<string, number>();
  for (const m of aktiv) if (m.honorar.basis === 'monat') jeKunde.set(m.kunde, (jeKunde.get(m.kunde) ?? 0) + m.honorar.betrag);
  const top = Array.from(jeKunde.entries()).sort((a, b) => b[1] - a[1])[0];
  return {
    aktiv: aktiv.length, mrr,
    ohneProdukt: crm.mandate.filter(m => m.status !== 'beendet' && !m.leistungId).length,
    produkteAktiv: crm.leistungen.filter(l => l.status === 'aktiv').length,
    groessterKunde: top && mrr ? { kunde: top[0], anteil: top[1] / mrr } : null,
  };
}

/** Wo steht ein Mandat im Ablauf seines Produkts? null ohne Produkt oder Phasen. */
export function mandatPhase(m: Pick<Mandat, 'phase'>, l: Pick<Leistung, 'phasen'> | undefined): { nr: number; von: number; name: string; naechste?: string } | null {
  const ph = l?.phasen ?? [];
  if (!ph.length) return null;
  const i = Math.max(0, ph.findIndex(p => p.id === m.phase));
  return { nr: i + 1, von: ph.length, name: ph[i].name, ...(ph[i + 1] ? { naechste: ph[i + 1].name } : {}) };
}

/** Neue Phase-Id, die es im Produkt noch nicht gibt. */
export function neuePhasenId(l: Pick<Leistung, 'phasen'>): string {
  const da = new Set((l.phasen ?? []).map(p => p.id));
  let i = (l.phasen ?? []).length + 1;
  while (da.has(`p${i}`)) i++;
  return `p${i}`;
}
