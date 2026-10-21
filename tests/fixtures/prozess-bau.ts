// ─── Prozesse — Bausteine für Tests (B1, 21.10.): kleine Definitionen ohne echte Daten ────────────────────────────────────────────────────────────
import type { ProzessDefinition, ProzessForm, ProzessKnoten } from '@/lib/prozesse/definition';

type K = ProzessKnoten<ProzessForm>;
/** Kennung im Editor-Format: fk-<uuid> aus einer Zahl. */
export const fk = (n: number): string => `fk-00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const PZ = 'pz-00000000-0000-4000-8000-000000000001';
export const PZ2 = 'pz-00000000-0000-4000-8000-000000000002';
export const J = '2026-10-21T08:00:00.000Z';

/** Ein Schritt in Phase `phase` (Rang = Reihenfolge der Angabe). */
export const schritt = (n: number, titel: string, rang: number, extra: Partial<K> = {}, phase = fk(2)): K => ({ id: fk(n), elternId: phase, titel, rang, form: 'schritt', ...extra });

/** Eine Definition: Wurzel fk(1), Phase fk(2) (+ weitere Phasen), Auslöser „von Hand“ fk(3) zuerst — dann die übergebenen Schritte. */
export function definition(schritte: K[], extra: Partial<ProzessDefinition> = {}, weiterePhasen: K[] = []): ProzessDefinition {
  return {
    id: PZ, art: 'paket', titel: 'Probe', knoten: [
      { id: fk(1), titel: 'Probe', rang: 1 },
      { id: fk(2), elternId: fk(1), titel: 'Ablauf', rang: 1 },
      ...weiterePhasen,
      { id: fk(3), elternId: fk(2), titel: 'Start', rang: 0, form: 'ausloeser', ausloeser: { art: 'hand' }, katalog: { id: 'ausloeser.hand' } },
      ...schritte,
    ],
    uebergaenge: [], freigaben: [], rollen: [], fassung: 1, geaendert: J, geaendertVon: 'pia', bereich: 'sales', fallArt: 'deal', ...extra,
  };
}

/** Konten eines Probe-Haushalts (erfunden, @example.invalid). */
export const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) =>
  ({ id, speicher, email: `${speicher}@example.invalid`, name: `${speicher} Probe`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...extra });
