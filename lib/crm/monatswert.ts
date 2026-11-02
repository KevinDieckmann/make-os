// ─── Monatswert eines Mandats (rein, client-sicher; 02.11., Prüfung R2-3 Fund 9) ──────────────────────────────────────────────────────
// EINE Regel für MRR, Kundenkonzentration, Mandatslage, Produkt-Zahlen und Business-Index — eigene Datei ohne weitere Abhängigkeiten (kein Kreis-Import über
// lib/crm/kunden.ts → team → leads).

import type { Mandat } from './typen';

// Vorher zählte nur `honorar.betrag` bei Basis „monat“: Zusatzmodule (laufend, jährlich, geplante Tages-/Stundensätze) und ein Tagessatz mit geplanten Tagen
// fehlten. Jetzt dieselbe Planung wie Liquidität und Ist-Basis (Satz × geplante Menge): Honorar je Monat (Jahreshonorar: Jahr ÷ 12 — steht so in `honorar`),
// Tagessatz × geplante Tage, Zusatzmodule monatlich, jährlich ÷ 12, Tages-/Stundensatz × geplante Menge. Einmaliges, inklusive, je Einheit: 0 (kein Monatswert).

/** Monatswert eines Zusatzmoduls (netto, Euro): laufend, jährlich ÷ 12, Satz × geplante Menge — sonst 0. */
export function zusatzMonatswert(z: NonNullable<Mandat['zusatz']>[number]): number {
  const h = z.honorar;
  if (z.inklusive || !h || !(h.betragCent > 0)) return 0;
  const cent = h.basis === 'monat' ? h.betragCent : h.basis === 'jahr' ? h.betragCent / 12 : h.basis === 'tag' ? h.betragCent * (z.tageJeMonat ?? 0) : h.basis === 'stunde' ? h.betragCent * (z.stundenJeMonat ?? 0) : 0;
  return Math.round(cent) / 100;
}
/** Monatswert des Honorars allein (netto bzw. wie am Mandat, Euro): Basis „monat“ der Betrag, Tagessatz × geplante Tage, sonst 0. */
export function honorarMonatswert(m: Pick<Mandat, 'honorar'> & Partial<Pick<Mandat, 'tageJeMonat'>>): number {
  if (!(m.honorar.betrag > 0)) return 0;
  if (m.honorar.basis === 'monat') return m.honorar.betrag;
  if (m.honorar.basis === 'tag' && m.tageJeMonat && m.tageJeMonat > 0) return Math.round(m.honorar.betrag * m.tageJeMonat * 100) / 100;
  return 0;
}
/** Monatswert eines Mandats: Honorar + alle Zusatzmodule (`honorarMonatswert` + `zusatzMonatswert`). */
export function monatswertVon(m: Pick<Mandat, 'honorar'> & Partial<Pick<Mandat, 'tageJeMonat' | 'zusatz'>>): number {
  return Math.round((honorarMonatswert(m) + (m.zusatz ?? []).reduce((a, z) => a + zusatzMonatswert(z), 0)) * 100) / 100;
}

