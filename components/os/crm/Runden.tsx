'use client';

// ─── Markttraktion · Geführte Runden (Platzhalter, wird gebaut) ─────────────
import type { CrmApi } from './daten';

export type RundenArt = 'kreis' | 'chancen';
export function Runden(_: { api: CrmApi; art: RundenArt; name: (p: string) => string; zuKontakt: (id: string) => void; zurueck: () => void }) { return null; }
