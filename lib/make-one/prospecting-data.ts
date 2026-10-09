// ─── MAKE OS — Prospecting-Agent: Datenmodell & CAPOS-ICP ───────────────────
// Die Zielliste + das ideale Kundenprofil (ICP) der Instanz.

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

// Das ideale Kundenprofil (ICP) pflegt jede Instanz selbst (in der App, Bestand `prospects`). Startwert LEER (09.10., Plattform-
// Regel: kein Produkt, keine Zielgruppe einer bestimmten Firma im Code) — die Vorlage zeigt nur die Gliederung.
export const DEFAULT_ICP = '';
export const ICP_VORLAGE = [
  'Produkt: … (was ihr anbietet, ein Satz)',
  'Zielkunde: … (Art, Größe, Region)',
  'Branchen-Schwerpunkt: …',
  'Schmerzpunkte: …',
  'Entscheider: …',
  'Auslöser (Signale): …',
].join('\n');

export const PIPELINE_HINT =
  'Neu → von der KI qualifizieren lassen (Score + Fit + Aufhänger) → beste in „Kontaktiert" ziehen (Outreach-Agent kommt später) → Rest verwerfen.';
