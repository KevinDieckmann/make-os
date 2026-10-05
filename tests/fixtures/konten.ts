// Konten für Routen-Tests (05.10., Routen-Register): gemeinsame Bestände (Ziele, Meilensteine, Routinen, Finanzen …)
// öffnen sich nur dem Haushalt des Inhabers. Erfundene Konten — Inhaber „kevin“ und Mitglied „malin“ im Test-Haushalt.
import type { saveJson } from '@/lib/store/local-db';

const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', haushalt = 'test-haus') =>
  ({ id, speicher, email: `${speicher}@example.invalid`, name: `${speicher} Test`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] as string[] }, haushalt });

/** Legt Inhaber und Mitglied im selben Haushalt an (überschreibt `konten`). */
export async function haushaltKonten(db: { saveJson: typeof saveJson }): Promise<void> {
  await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'inhaber'), konto('k2', 'malin', 'mitglied')], einladungen: [] });
}
