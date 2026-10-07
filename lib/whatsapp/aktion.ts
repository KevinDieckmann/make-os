// ─── WhatsApp — Gelesen/Ungelesen aus der Inbox (Server, 07.10.2026) ───────────────────────────────────────────────────
// Die Business-Nummer ist ein geteiltes Postfach (Team-Postfach): „gelesen bis“ gilt für alle mit Zugang. Es geht KEINE
// Lesebestätigung an die Person (die Cloud API könnte das — bewusst nicht, Kevin: nichts verlässt das System ohne Klick).

import { whatsappFuer } from './server';
import { aendereWaSpiegel, gelesenSetzen } from './spiegel';
import { WA_NUMMER } from './typen';

export async function whatsappGelesen(person: string, nummer: string, gelesen: boolean): Promise<void> {
  if (!WA_NUMMER.test(nummer) || !(await whatsappFuer(person))) return;
  const jetzt = new Date().toISOString();
  await aendereWaSpiegel(s => { const neu = gelesenSetzen(s, nummer, gelesen, jetzt); return neu === s ? null : neu; });
}
