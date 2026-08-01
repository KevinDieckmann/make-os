// ─── MAKE OS — Prospecting-Agent: Datenmodell & CAPOS-ICP ───────────────────
// Die Zielliste + das ideale Kundenprofil (ICP) für CapOS.

export type ProspectStatus = 'neu' | 'qualifiziert' | 'kontaktiert' | 'verworfen';

export const PROSPECT_STATUS_ORDER: ProspectStatus[] = ['neu', 'qualifiziert', 'kontaktiert', 'verworfen'];
export const PROSPECT_STATUS_LABEL: Record<ProspectStatus, string> = {
  neu: 'Neu', qualifiziert: 'Qualifiziert', kontaktiert: 'Kontaktiert', verworfen: 'Verworfen',
};

export interface Prospect {
  id: string;
  company: string;
  domain?: string;
  industry?: string;
  size?: string;
  region?: string;
  status: ProspectStatus;
  score?: number;          // 0–100, vom KI-Scoring
  fit?: string;            // Begründung, warum es passt
  angle?: string;          // vorgeschlagener Aufhänger für die Ansprache
  source?: string;         // woher (z. B. "Explorium/Vibe")
  addedAt: string;         // ISO
}

export interface ProspectsState { icp: string; prospects: Prospect[]; }

// Das ideale Kundenprofil für CapOS — editierbar in der App, hier als Startwert.
export const DEFAULT_ICP = [
  'Produkt: CapOS — Controlling-/Liquiditäts-Cockpit für den Mittelstand.',
  'Zielkunde: inhaber-/familiengeführter Mittelstand in DACH, ~50–500 Mitarbeiter, spürbare Controlling-Komplexität.',
  'Branchen-Schwerpunkt: Maschinenbau, Großhandel, produzierendes Gewerbe, projektlastige Dienstleister.',
  'Schmerzpunkte: Liquidität in Excel, kein rollierender Forecast, DATEV-Daten nicht handlungsfähig, Bank/Reporting-Druck.',
  'Entscheider: Geschäftsführung, kaufmännische Leitung / CFO, Leiter Controlling/Finanzen.',
  'Auslöser (Signale): Wachstum/Neueinstellungen Finance, Finanzierungsrunde/Kredit, ERP-/DATEV-Wechsel, neue kfm. Leitung.',
].join('\n');

export const PIPELINE_HINT =
  'Neu → von der KI qualifizieren lassen (Score + Fit + Aufhänger) → beste in „Kontaktiert" ziehen (Outreach-Agent kommt später) → Rest verwerfen.';
