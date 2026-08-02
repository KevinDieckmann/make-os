// ─── MAKE OS — Liquiditäts-Vorschau ─────────────────────────────────────────
// Die Frage, die zählt: Wie viel Geld ist wann da — und wann wird es eng?
//
// Gerechnet wird aus dem, was schon im System steht: Kontostände, gestellte
// und geplante Rechnungen, fällige Zahlungen, wiederkehrende Fixkosten.
// Deterministisch, damit man jeder Zahl ansehen kann, woher sie kommt.
//
// Client-safe: keine Server-Importe.

export interface Firma { id: string; name: string; kontostand: number | null; stand: string | null }
export interface Rechnung { id: string; kunde: string; titel: string; betrag: number; status: string; faellig?: string }
export interface Zahlung { id: string; an: string; titel: string; betrag: number; status: string; faellig?: string }
export interface Merkposten { id: string; titel: string; betrag: number; art: string; notiz?: string }

export interface Bewegung {
  datum: string;
  text: string;
  betrag: number;
  art: 'eingang' | 'ausgang' | 'fix';
  /** Wie sicher ist das Geld? Gestellte Rechnungen sind belastbarer als geplante. */
  sicher: boolean;
}

export interface Woche {
  von: string;
  bis: string;
  label: string;
  eingang: number;
  ausgang: number;
  /** Kontostand am Ende der Woche. */
  stand: number;
  bewegungen: Bewegung[];
}

export interface Vorschau {
  start: number;
  wochen: Woche[];
  /** Erste Woche, in der der Stand negativ wird — null wenn es hält. */
  engpass: Woche | null;
  /** Tiefster Punkt im Zeitraum. */
  tiefpunkt: { stand: number; label: string };
  summeEin: number;
  summeAus: number;
  /** Wie viel davon nur geplant und nicht belastbar ist. */
  unsicher: number;
}

const tage = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Monatlich wiederkehrende Belastung aus den Merkposten herauslesen. */
export function monatlicheLast(merkposten: Merkposten[]): { text: string; betrag: number }[] {
  const raus: { text: string; betrag: number }[] = [];
  for (const m of merkposten) {
    // Fixkosten stehen als negativer Merkposten mit „monatlich" in der Notiz.
    if (/monatlich/i.test(m.notiz ?? '') && m.betrag < 0) {
      raus.push({ text: m.titel.replace(/^Fixkosten:\s*/i, ''), betrag: Math.abs(m.betrag) });
      continue;
    }
    // Kredite tragen ihre Rate in der Notiz: „Rate 90 €/Monat".
    const rate = (m.notiz ?? '').match(/Rate\s+([\d.]+)\s*€?\s*\/?\s*Monat/i);
    if (rate && m.betrag < 0) raus.push({ text: `${m.titel} (Rate)`, betrag: Math.round(Number(rate[1])) });
  }
  return raus;
}

/**
 * Vorschau über N Wochen. „geplant" zählt nur mit, wenn optimistisch=true —
 * sonst rechnen wir nur mit dem, was wirklich gestellt ist.
 */
export type Rhythmus = 'einmalig' | 'monatlich' | 'quartal' | 'jaehrlich';
export interface Planposten {
  id: string; titel: string; betrag: number; rhythmus: Rhythmus;
  ab: string; bis?: string; sicher: boolean; notiz?: string;
}

/** Fällt der Posten in dieser Woche an? Liefert das Datum oder null. */
function faelligIn(p: Planposten, vonISO: string, bisISO: string): string | null {
  if (p.ab > bisISO) return null;
  if (p.bis && p.bis < vonISO) return null;
  if (p.rhythmus === 'einmalig') return p.ab >= vonISO && p.ab <= bisISO ? p.ab : null;

  // Wiederkehrend: am selben Tag des Monats wie im Startdatum.
  const tag = Number(p.ab.slice(8, 10));
  const von = new Date(`${vonISO}T00:00:00`);
  const bis = new Date(`${bisISO}T00:00:00`);
  for (let d = new Date(von); d <= bis; d.setDate(d.getDate() + 1)) {
    if (d.getDate() !== tag) continue;
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (iso < p.ab) continue;
    const monateSeitStart = (d.getFullYear() - Number(p.ab.slice(0, 4))) * 12 + (d.getMonth() - (Number(p.ab.slice(5, 7)) - 1));
    if (p.rhythmus === 'monatlich') return iso;
    if (p.rhythmus === 'quartal' && monateSeitStart % 3 === 0) return iso;
    if (p.rhythmus === 'jaehrlich' && monateSeitStart % 12 === 0) return iso;
  }
  return null;
}

export function vorschau(
  firmen: Firma[],
  rechnungen: Rechnung[],
  zahlungen: Zahlung[],
  merkposten: Merkposten[],
  heute: string,
  wochenAnzahl = 12,
  optimistisch = false,
  planposten: Planposten[] = [],
): Vorschau {
  const start = firmen.reduce((s, f) => s + (f.kontostand ?? 0), 0);
  const fix = monatlicheLast(merkposten);
  const fixSumme = fix.reduce((s, f) => s + f.betrag, 0);

  const heuteD = new Date(`${heute}T00:00:00`);
  const wochen: Woche[] = [];
  let stand = start;
  let summeEin = 0, summeAus = 0, unsicher = 0;

  for (let i = 0; i < wochenAnzahl; i++) {
    const von = tage(heuteD, i * 7);
    const bis = tage(heuteD, i * 7 + 6);
    const vonISO = iso(von), bisISO = iso(bis);
    const bewegungen: Bewegung[] = [];

    // Eingänge: offene Rechnungen mit Fälligkeit in dieser Woche.
    for (const r of rechnungen) {
      if (r.status === 'bezahlt' || !r.betrag) continue;
      const geplant = r.status === 'geplant';
      if (geplant && !optimistisch) continue;
      // Ohne Fälligkeit: gestellte in der ersten Woche, geplante in der vierten.
      const faellig = r.faellig ?? iso(tage(heuteD, geplant ? 28 : 7));
      if (faellig < vonISO || faellig > bisISO) continue;
      // Überfälliges landet in der laufenden Woche, nicht in der Vergangenheit.
      bewegungen.push({ datum: faellig, text: `${r.kunde}: ${r.titel}`.slice(0, 60), betrag: r.betrag, art: 'eingang', sicher: !geplant });
      if (geplant) unsicher += r.betrag;
    }
    // Überfällige Rechnungen in Woche 1 mitnehmen.
    if (i === 0) {
      for (const r of rechnungen) {
        if (r.status === 'bezahlt' || !r.betrag || !r.faellig || r.faellig >= vonISO) continue;
        if (r.status === 'geplant' && !optimistisch) continue;
        bewegungen.push({ datum: r.faellig, text: `${r.kunde}: ${r.titel} (überfällig)`.slice(0, 60), betrag: r.betrag, art: 'eingang', sicher: false });
        unsicher += r.betrag;
      }
    }

    // Ausgänge: offene Zahlungen.
    for (const z of zahlungen) {
      if (z.status !== 'offen' || !z.betrag) continue;
      const faellig = z.faellig ?? iso(tage(heuteD, 14));
      const inWoche = faellig >= vonISO && faellig <= bisISO;
      const ueberfaellig = i === 0 && faellig < vonISO;
      if (!inWoche && !ueberfaellig) continue;
      bewegungen.push({ datum: faellig, text: `${z.an}${ueberfaellig ? ' (überfällig)' : ''}`.slice(0, 60), betrag: -z.betrag, art: 'ausgang', sicher: true });
    }

    // Geplante Posten — wiederkehrend oder einmalig.
    for (const p of planposten) {
      const datum = faelligIn(p, vonISO, bisISO);
      if (!datum) continue;
      if (!p.sicher && !optimistisch && p.betrag > 0) { unsicher += p.betrag; continue; }
      bewegungen.push({
        datum, text: p.titel.slice(0, 60), betrag: p.betrag,
        art: p.betrag > 0 ? 'eingang' : 'fix', sicher: p.sicher,
      });
      if (!p.sicher && p.betrag > 0) unsicher += p.betrag;
    }

    // Fixkosten aus den Merkposten — nur, solange es keine eigenen Planposten
    // gibt. Sonst würde dasselbe Geld zweimal abgezogen.
    if (fixSumme && i % 4 === 0 && !planposten.length) {
      bewegungen.push({ datum: vonISO, text: `Fixkosten (${fix.map(f => f.text).join(', ')})`.slice(0, 60), betrag: -fixSumme, art: 'fix', sicher: true });
    }

    const eingang = bewegungen.filter(b => b.betrag > 0).reduce((s, b) => s + b.betrag, 0);
    const ausgang = bewegungen.filter(b => b.betrag < 0).reduce((s, b) => s + Math.abs(b.betrag), 0);
    stand = stand + eingang - ausgang;
    summeEin += eingang; summeAus += ausgang;

    wochen.push({
      von: vonISO, bis: bisISO,
      label: i === 0 ? 'diese Woche' : `KW +${i}`,
      eingang, ausgang, stand,
      bewegungen: bewegungen.sort((a, b) => a.datum.localeCompare(b.datum)),
    });
  }

  const engpass = wochen.find(w => w.stand < 0) ?? null;
  const tief = wochen.reduce((min, w) => (w.stand < min.stand ? { stand: w.stand, label: w.label } : min), { stand: start, label: 'heute' });

  return { start, wochen, engpass, tiefpunkt: tief, summeEin, summeAus, unsicher };
}
