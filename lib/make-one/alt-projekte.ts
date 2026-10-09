// ─── MAKE OS — Projekt-Kennungen des ersten Startbestands (Altbestand, NUR Lesen; 09.10., Paket „neutral-rest“) ──────
// Bis zum Aufgaben-Umbau (28.09.) kamen Aufgaben mit festen Projekt-Kennungen aus einem Startbestand. Diese Kennungen
// stehen noch in alten Aufgaben und Projekten einer gewachsenen Instanz — sie sind DATEN-SCHLÜSSEL, keine Anzeigenamen
// (nirgends werden sie als Name gezeigt oder an ein Modell gegeben). Neue Projekte tragen ihren Space selbst (`spaceId`)
// und brauchen diese Liste nie. Eine neue Instanz hat keine dieser Kennungen — die Liste greift dort nie.
//
// EINE Stelle für Fokus-Säule, Thema und Ort dieser Altprojekte (vorher je eine Liste in fokus-data, ordnung-data und
// organisation-data). Wächter: tests/neutral-rest.test.ts (keine Anzeigenamen hier, Kennungen nur hier).
//
// Client-safe: keine Server-Importe.

export interface AltProjekt {
  /** Säule des Fokus-Reglers. */
  saeule: 'health' | 'business' | 'finance' | 'social';
  /** Bahn (Thema), wenn das Projekt fest eine hatte. */
  thema?: 'leben' | 'produkt';
  /** Gehörte das Projekt zu Privat? (sonst Business) */
  privat: boolean;
}

export const ALT_PROJEKTE: Readonly<Record<string, AltProjekt>> = {
  'proj-health': { saeule: 'health', thema: 'leben', privat: true },
  'proj-privat': { saeule: 'finance', thema: 'leben', privat: true },
  'proj-make': { saeule: 'social', thema: 'produkt', privat: true },
  'proj-capos': { saeule: 'business', thema: 'produkt', privat: false },
  'proj-ig': { saeule: 'business', privat: false },
  'proj-kdm': { saeule: 'business', privat: false },
};

export const altProjekt = (projectId: string | null | undefined): AltProjekt | undefined =>
  projectId ? ALT_PROJEKTE[projectId] : undefined;
