// ─── Geschäftsmodell (rein, getestet) ───────────────────────────────────────
// Kevin (25.09.): „das ganze Business-Modell maximal überarbeiten“. Woraus
// das Geld kommt — je Produktlinie und Produkt —, wie viel davon wiederkehrt
// und wie weit jedes Mandat die Fixkosten der Sicht trägt. Jede Zeile
// verlinkt auf das Produkt bzw. Mandat, wo man es ändert.

import type { Leistung, Mandat } from '@/lib/crm/typen';
import { linieVon } from '@/lib/crm/produkte';
import { WEG } from '@/lib/wege';
import type { Scope } from './register';

export interface ModellZeile { id: string; titel: string; unter?: string; mrr: number; einmalig: number; anteil: number; href: string }
export interface Geschaeftsmodell {
  mrr: number;
  /** Einmalige Honorare laufender Mandate (Workshops, Diagnosen …). */
  einmalig: number;
  linien: (ModellZeile & { produkte: ModellZeile[] })[];
  /** Mandate mit Monatshonorar: Anteil am MRR und Deckung der Fixkosten. */
  mandate: (ModellZeile & { fixDeckung: number | null })[];
  fixkosten: number | null;
  /** MRR ÷ Fixkosten — über 100 % trägt der wiederkehrende Umsatz den Betrieb. */
  fixDeckung: number | null;
  ohneProdukt: number;
}

const OHNE = '__ohne';
const laufend = (m: Mandat) => m.status === 'aktiv' || m.status === 'pausiert';

export function geschaeftsmodell(mandate: Mandat[], leistungen: Leistung[], scope: Scope, fixkosten: number | null): Geschaeftsmodell {
  const inSicht = mandate.filter(m => (scope === 'gesamt' || m.gesellschaft === scope) && laufend(m) && m.honorar.betrag > 0);
  const mrrVon = (m: Mandat) => (m.status === 'aktiv' && m.honorar.basis === 'monat' ? m.honorar.betrag : 0);
  const einmaligVon = (m: Mandat) => (m.honorar.basis === 'einmalig' ? m.honorar.betrag : 0);
  const mrr = inSicht.reduce((s, m) => s + mrrVon(m), 0);
  const einmalig = inSicht.reduce((s, m) => s + einmaligVon(m), 0);
  const basis = mrr + einmalig / 12 || 1;

  const jeProdukt = new Map<string, Mandat[]>();
  for (const m of inSicht) { const k = m.leistungId && leistungen.some(l => l.id === m.leistungId) ? m.leistungId : OHNE; jeProdukt.set(k, [...(jeProdukt.get(k) ?? []), m]); }
  const zeile = (id: string, titel: string, l: Mandat[], href: string, unter?: string): ModellZeile => {
    const r = l.reduce((s, m) => s + mrrVon(m), 0), e = l.reduce((s, m) => s + einmaligVon(m), 0);
    return { id, titel, ...(unter ? { unter } : {}), mrr: r, einmalig: e, anteil: (r + e / 12) / basis, href };
  };
  const produkte = Array.from(jeProdukt.entries()).map(([id, l]) => {
    const p = leistungen.find(x => x.id === id);
    return { linie: p ? linieVon(p) : 'Ohne Produkt', z: zeile(id, p?.name ?? 'Ohne Produkt', l, id === OHNE ? WEG.mandat() : WEG.produkt(id), `${l.length} Mandat${l.length === 1 ? '' : 'e'}`) };
  });
  const linienNamen = Array.from(new Set(produkte.map(p => p.linie)));
  const linien = linienNamen.map(n => {
    const ps = produkte.filter(p => p.linie === n).map(p => p.z).sort((a, b) => b.anteil - a.anteil);
    const r = ps.reduce((s, p) => s + p.mrr, 0), e = ps.reduce((s, p) => s + p.einmalig, 0);
    return { id: n, titel: n, mrr: r, einmalig: e, anteil: (r + e / 12) / basis, href: n === 'Ohne Produkt' ? WEG.mandat() : WEG.produkt(), produkte: ps };
  }).sort((a, b) => b.anteil - a.anteil);

  const mandatZeilen = inSicht.filter(m => mrrVon(m) > 0).map(m => ({
    ...zeile(m.id, m.kunde, [m], WEG.mandat(m.id), m.titel),
    fixDeckung: fixkosten && fixkosten > 0 ? mrrVon(m) / fixkosten : null,
  })).sort((a, b) => b.mrr - a.mrr);

  return {
    mrr, einmalig, linien, mandate: mandatZeilen, fixkosten,
    fixDeckung: fixkosten && fixkosten > 0 ? mrr / fixkosten : null,
    ohneProdukt: inSicht.filter(m => !m.leistungId).length,
  };
}
