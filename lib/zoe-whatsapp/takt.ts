// ─── ZOE auf WhatsApp im Takt (Server, 08.10.2026) ───────────────────────────────────────────────────────────────────────
// Der Webhook verarbeitet Nachrichten gleich im Hintergrund (`after`). Was dabei liegen blieb (Neustart, Fehler, Meta kurz weg), holt der
// Takt nach — je Person ihr Eingang (höchstens drei Versuche je Nachricht). Dazu die Aufbewahrung der Sprachnachrichten (30 Tage) und
// Dateien ohne Verweis. Nie blockierend, Fehler als eine Zeile `[zoe-whatsapp] …`. Ohne Einrichtung: nichts.

import { zoeWhatsappKonfig } from './konfig';
import { alleKanaele } from './speicher';
import { eingangVerarbeiten } from './eingang';
import { sprachnachrichtenAufraeumen } from './medien';

let laeuft = false;

export async function zoeWhatsappJobsImTakt(jetzt = Date.now()): Promise<void> {
  if (!zoeWhatsappKonfig() || laeuft) return;
  laeuft = true;
  try {
    for (const { person, kanal } of await alleKanaele()) if ((kanal.eingang ?? []).length) await eingangVerarbeiten(person);
    await sprachnachrichtenAufraeumen(jetzt);
  } catch (e) {
    console.warn(`[zoe-whatsapp] Takt: ${e instanceof Error ? e.message.slice(0, 120) : 'Fehler'}`);
  } finally { laeuft = false; }
}
