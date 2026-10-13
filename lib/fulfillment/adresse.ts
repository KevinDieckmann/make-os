// ─── Fulfillment — Adressen (C0, 10.10.; FULFILLMENT_KONZEPT.md Abschnitt 10) ────────────────────────────────────────────────────────
// Die Fulfillment-Seite liegt unter Produkte & Mandate: `/os/mandate/fulfillment` (Segment „Fulfillment“, kein eigener Leistenpunkt).
//   u   Unternavigation: prozesse (Standard, weggelassen) · bausteine · onboarding · analysen · kreislauf · visualisierung
//   k   ein Knoten im Drill-down (nur unter Prozesse) · b ein Baustein (nur unter Bausteine)
//   m   ein Fall (Mandat-Kennung) — dann `r` = Reiter des Falls: ueberblick (Standard) · ablauf · wert · menschen · takt · kunde · analyse · kreislauf
// Links nur über `WEG.fulfillment` / `WEG.fall` / `WEG.dossier` (lib/wege.ts); gelesen nur über `fulfillmentAusAdresse` (ungültige Werte fallen weg).
// Alte Links gibt es nicht. Rein und client-sicher — keine Importe aus lib/wege.ts (WEG importiert DIESE Datei).

export const FULFILLMENT_PFAD = '/os/mandate/fulfillment';

export type FulfillmentBereich = 'prozesse' | 'bausteine' | 'onboarding' | 'analysen' | 'kreislauf' | 'visualisierung';
export const FULFILLMENT_BEREICHE: readonly { id: FulfillmentBereich; label: string }[] = [
  { id: 'prozesse', label: 'Prozesse' },
  { id: 'bausteine', label: 'Bausteine' },
  { id: 'onboarding', label: 'Onboarding' },
  { id: 'analysen', label: 'Analysen' },
  { id: 'kreislauf', label: 'Kreislauf' },
  { id: 'visualisierung', label: 'Visualisierung' },
];

export type FallReiter = 'ueberblick' | 'ablauf' | 'wert' | 'menschen' | 'takt' | 'kunde' | 'analyse' | 'kreislauf';
export const FALL_REITER: readonly { id: FallReiter; label: string; paket: 'C1' | 'C2' | 'C3' }[] = [
  { id: 'ueberblick', label: 'Überblick', paket: 'C1' },
  { id: 'ablauf', label: 'Ablauf', paket: 'C1' },
  { id: 'wert', label: 'Wert-Konto', paket: 'C1' },
  { id: 'menschen', label: 'Menschen & Entscheidungen', paket: 'C1' },
  { id: 'takt', label: 'Takt', paket: 'C1' },
  { id: 'kunde', label: 'Kunde & Reports', paket: 'C2' },
  { id: 'analyse', label: 'Analyse', paket: 'C3' },
  // 12.10.: das Ende der Reise — Befähigung, Wirkungsbericht, Nachsorge und „wo steht dieser Kunde im Kreislauf“ (vorher unter Takt).
  { id: 'kreislauf', label: 'Abschluss & Kreislauf', paket: 'C1' },
];

const BEREICH_IDS = FULFILLMENT_BEREICHE.map(b => b.id) as readonly string[];
const REITER_IDS = FALL_REITER.map(r => r.id) as readonly string[];
const KNOTEN = /^fk-[a-z0-9][a-z0-9-]{0,99}$/;
const BAUSTEIN = /^fb-[a-z0-9][a-z0-9-]{0,99}$/;
const MANDAT = /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/;

const mitQuery = (p: Record<string, string | undefined>) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v) q.set(k, v);
  const t = q.toString();
  return t ? `${FULFILLMENT_PFAD}?${t}` : FULFILLMENT_PFAD;
};

/** Ein Bereich der Unternavigation, optional mit Knoten (`k`, nur Prozesse) bzw. Baustein (`b`, nur Bausteine). */
export function fulfillmentLink(u?: FulfillmentBereich, p: { k?: string; b?: string } = {}): string {
  const bereich = u && u !== 'prozesse' ? u : undefined;
  return mitQuery({
    u: bereich,
    k: (!u || u === 'prozesse') && p.k && KNOTEN.test(p.k) ? p.k : undefined,
    b: u === 'bausteine' && p.b && BAUSTEIN.test(p.b) ? p.b : undefined,
  });
}

/** Ein Fall (Mandat) mit Reiter — ohne gültige Kennung die Fulfillment-Seite. */
export function fallLink(mandatId: string, r?: FallReiter): string {
  if (!MANDAT.test(mandatId)) return FULFILLMENT_PFAD;
  return mitQuery({ m: mandatId, r: r && r !== 'ueberblick' ? r : undefined });
}

export interface FulfillmentAdresse { u: FulfillmentBereich; k?: string; b?: string; m?: string; r: FallReiter }

/** Die Adresse lesen — ungültige Werte fallen weg (Unbekanntes in `u` = Prozesse, in `r` = Überblick). */
export function fulfillmentAusAdresse(q: { get(name: string): string | null }): FulfillmentAdresse {
  const u = q.get('u');
  const bereich: FulfillmentBereich = u && BEREICH_IDS.includes(u) ? (u as FulfillmentBereich) : 'prozesse';
  const r = q.get('r');
  const k = q.get('k'), b = q.get('b'), m = q.get('m');
  return {
    u: bereich,
    r: r && REITER_IDS.includes(r) ? (r as FallReiter) : 'ueberblick',
    ...(bereich === 'prozesse' && k && KNOTEN.test(k) ? { k } : {}),
    ...(bereich === 'bausteine' && b && BAUSTEIN.test(b) ? { b } : {}),
    ...(m && MANDAT.test(m) ? { m } : {}),
  };
}
