// ─── MAKE OS — Mandat an Zielen und Zeit: Laden auf dem Server (28.09.) ─────
// Die Schreibwege von Zielen, Meilensteinen und Fokus-Blöcken leiten Firma und
// Einheit aus dem Mandat ab (lib/planung/mandat.ts `mitMandatBezug`). Das CRM
// wird dafür nur gelesen, und nur, wenn die Anfrage überhaupt ein Mandat nennt.

import { ladeCrm } from '@/lib/crm/speicher';
import { mandatKurzListe, hatMandatKennung, type MandatKurz } from './mandat';

/** Alle Mandate als Kurzform (Karte nach Kennung). */
export async function mandateKurz(): Promise<Map<string, MandatKurz>> {
  return new Map(mandatKurzListe(await ladeCrm()).map(m => [m.id, m]));
}

/** Die Mandate — aber nur, wenn `roh` irgendwo eine `mandatId` trägt; sonst null (kein CRM-Lesen). */
export async function mandateFuerBezug(roh: unknown): Promise<Map<string, MandatKurz> | null> {
  return hatMandatKennung(roh) ? mandateKurz() : null;
}
