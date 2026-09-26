// ─── MAKE OS — Space-Regeln (26.09., Kevin: „die Aufteilung muss überall greifen“) ──
// Jeder Eintrag gehört zu Privat oder Business. Aufgaben: der Ort (Organisation)
// gibt den Space vor — Privat ist Privat, alles andere (KD Ventures, Consulting,
// KEMARIS) ist Business; eine Aufgabe kann per Klick abweichen (`space`).
// Client-safe, keine Server-Importe.

import { orgVon } from './organisation-data';

export type SpaceId = 'privat' | 'business';
export const SPACE_LABEL: Record<SpaceId, string> = { privat: 'Privat', business: 'Business' };
/** Tiefe Akzente (Kevin 25.09.: „nicht diese Neonfarben“): Privat warm (Bernstein), Business Indigo wie in Malins Bild. */
export const SPACE_FARBE: Record<SpaceId, string> = { privat: '#D9A45B', business: '#6E7EF5' };
export const istSpace = (v: unknown): v is SpaceId => v === 'privat' || v === 'business';

/** Organisation → Space: nur „privat“ ist Privat. */
export const spaceVonOrg = (org: string): SpaceId => (org === 'privat' ? 'privat' : 'business');

/** Der Space einer Aufgabe: die eigene Abweichung, sonst der Ort (Text schlägt Projekt, wie bei orgVon). */
export function spaceVonAufgabe(t: { id: string; title: string; description?: string; projectId: string; space?: SpaceId }, orgZuordnung: Record<string, string> = {}): SpaceId {
  return t.space ?? spaceVonOrg(orgVon(t, orgZuordnung));
}

// ── Fokus je Space (26.09., Kevin: „Privat und Business separat aufbauen“) ──
// Der Fokus-Satz je Horizont liegt gemeinsam (Schlüssel „jahr“) und je Space
// („privat:jahr“, „business:jahr“). Sichten in einem Space zeigen den Space-
// Fokus und fallen auf den gemeinsamen zurück, wenn er leer ist.
export const FOKUS_HORIZONTE = ['tag', 'woche', 'monat', 'quartal', 'jahr'] as const;
export const fokusSchluessel = (h: string, space: SpaceId | null | undefined): string => (space ? `${space}:${h}` : h);
export function fokusFuerSpace(alle: Record<string, string> | null | undefined, space: SpaceId | null | undefined): Record<string, string> {
  const a = alle ?? {};
  if (!space) return a;
  const aus: Record<string, string> = { ...a };
  for (const h of FOKUS_HORIZONTE) { const v = a[`${space}:${h}`]; if (v && v.trim()) aus[h] = v; }
  return aus;
}

