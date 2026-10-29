// ─── Prozesse — die Werkstatt steuert das Geld (29.10., Kreislauf P4: W-B1, W-B2; rein, Server UND Browser) ───────────────────────────────────────────
// Kevin 29.10.: „Alle Automatisierungen kommen aus der Werkstatt“ — der Geld-Kreislauf soll aus Prozessen steuerbar sein. EINE Stelle für die Regeln der
// Geld-Bausteine, die der Motor (lib/prozesse/lauf-regeln.ts `schlossWirkung`) und der Server (lib/prozesse/bausteine-server.ts) teilen:
//   · `angebotPositionenFuerFall`  (eigene Datei ./geld-positionen.ts — zieht das Angebots-Modul, nur der Server lädt sie) Positionen eines Angebots-Entwurfs aus dem Fall (W-B1 — vorher schickte der Baustein keine, `crm_vorschlag` lehnte immer ab):
//                                  zuerst die Positionen des jüngsten Angebots am Deal bzw. Mandat (neue Version, Verlängerung), sonst das Produkt des Deals
//                                  bzw. Mandats — DIESELBE Regel wie „Angebot erstellen“ am Deal (`positionenAusDeal`: Kombination = jeder Preis-Teil, sonst der
//                                  Wert des Deals). Nichts gefunden → null (dann bleibt der Schritt wie bisher ohne Vorschlag stehen).
//   · `GELD_BAUSTEINE`             die drei Bausteine mit eigenem Weg hinter dem Schloss (Klasse geld bzw. außen = IMMER Freigabe, EIN Klick im Stapel führt aus):
//                                  „Rechnung für Mandat erstellen“ (Entwurf, je Mandat und Leistungsmonat höchstens einer — `entwurfNeu` quelle mandat),
//                                  „Rechnung stellen“ (`rechnungStellen`), „Angebot stellen“ (`angebotStellen`). Versand der Mail bleibt ein Mail-Entwurf-Baustein.
//   · `rechnungZumStellen` / `angebotZumStellen`  welcher Entwurf gemeint ist (der jüngste des Falls) — nie raten: keiner → nichts vorzuschlagen.
// Nur Kennungen; Beträge kommen aus den Beständen, nie aus dem Prozess.

import type { Angebot } from '@/lib/crm/typen';
import type { Rechnung } from '@/lib/finanzen/finanzplan-bestand';

/** Die Geld-Bausteine mit eigenem Weg (Kennungen des Katalogs). */
export const GELD_BAUSTEINE = { rechnungEntwurf: 'rechnung.mandat-entwurf', rechnungStellen: 'rechnung.stellen', angebotStellen: 'angebot.stellen' } as const;
export type GeldAktion = 'rechnung-entwurf' | 'rechnung-stellen' | 'angebot-stellen';
export const GELD_AKTION_VON: Readonly<Record<string, GeldAktion>> = {
  [GELD_BAUSTEINE.rechnungEntwurf]: 'rechnung-entwurf', [GELD_BAUSTEINE.rechnungStellen]: 'rechnung-stellen', [GELD_BAUSTEINE.angebotStellen]: 'angebot-stellen',
};
/** Was der Stapel über die Wirkung sagt (EIN Wortlaut). */
export const GELD_TEXT: Readonly<Record<GeldAktion, string>> = {
  'rechnung-entwurf': 'legt den Rechnungsentwurf des Mandats für den Leistungsmonat an (je Monat höchstens einer)',
  'rechnung-stellen': 'stellt die Rechnung (Nummer, PDF) — die Mail an den Kunden bereitet ein eigener Schritt vor',
  'angebot-stellen': 'stellt das Angebot (Nummer, PDF, Nachfass-Follow-up) — die Mail an den Kunden bereitet ein eigener Schritt vor',
};

/** Der Rechnungsentwurf, den „Rechnung stellen“ meint: der jüngste geplante des Mandats (Fall). Keiner → null. Rein. */
export function rechnungZumStellen(rechnungen: readonly Pick<Rechnung, 'id' | 'mandatId' | 'status' | 'datum'>[], mandatId: string | undefined): string | null {
  if (!mandatId) return null;
  const offen = rechnungen.filter(r => r.mandatId === mandatId && r.status === 'geplant').sort((a, b) => ((a.datum ?? '') < (b.datum ?? '') ? 1 : -1));
  return offen[0]?.id ?? null;
}

/** Das Angebot, das „Angebot stellen“ meint: der jüngste Entwurf am Deal bzw. Mandat des Falls. Keiner → null. Rein. */
export function angebotZumStellen(angebote: readonly Pick<Angebot, 'id' | 'status' | 'dealId' | 'mandatId' | 'geaendert'>[], b: { dealId?: string; mandatId?: string }): string | null {
  const e = angebote.filter(a => a.status === 'entwurf' && ((b.dealId && a.dealId === b.dealId) || (b.mandatId && a.mandatId === b.mandatId)))
    .sort((x, y) => (x.geaendert < y.geaendert ? 1 : -1));
  return e[0]?.id ?? null;
}

/** Ein Leistungsmonat für „Rechnung für Mandat erstellen“: `vormonat` bzw. ohne Angabe (die Regel der Rechnung wählt: nächste offene Zahlung bzw. laufender Monat). */
export function geldMonat(wahl: unknown, heute: string): string | undefined {
  if (wahl !== 'vormonat') return undefined;
  const [j, m] = heute.slice(0, 7).split('-').map(Number);
  return m === 1 ? `${j - 1}-12` : `${j}-${String(m - 1).padStart(2, '0')}`;
}
