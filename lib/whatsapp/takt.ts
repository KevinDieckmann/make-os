// ─── WhatsApp im Takt (Server, 07.10.2026) ─────────────────────────────────────────────────────────────────────────────
// Der Webhook lädt Medien gleich im Hintergrund; was dabei scheitert (Netz, Meta kurz weg), holt der Takt nach (höchstens
// `WA_GRENZEN.medienJeLauf` je Lauf, je Medium höchstens drei Versuche, Medien-IDs gelten bei Meta 7 Tage). Dateien ohne Nachricht
// (nach Art. 17) fallen hier sofort weg. Nie blockierend, Fehler als eine Zeile `[whatsapp] …`. Ohne Einrichtung: nichts.

import { whatsappKonfig } from './konfig';
import { medienNachladen, medienWaisenEntfernen } from './medien';
import './server'; // Glocke bei ungültigem Schlüssel (Graph-Haken)

let laeuft = false;

export async function whatsappJobsImTakt(): Promise<void> {
  const k = whatsappKonfig();
  if (!k || laeuft) return;
  laeuft = true;
  try {
    await medienNachladen(k);
    await medienWaisenEntfernen();
  } catch (e) {
    console.warn(`[whatsapp] Takt: ${e instanceof Error ? e.message.slice(0, 120) : 'Fehler'}`);
  } finally { laeuft = false; }
}
