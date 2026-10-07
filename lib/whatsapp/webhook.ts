// ─── WhatsApp — Webhook verarbeiten (Server, 07.10.2026) ────────────────────────────────────────────────────────────────
// Ablauf eines POST von Meta (Route app/api/whatsapp/webhook):
//   1. Körpergrenze (`WA_GRENZEN.koerper`) — größer → 413
//   2. Signatur `X-Hub-Signature-256` über den ROHEN Körper mit dem App-Geheimnis (lib/whatsapp/signatur.ts) — falsch/fehlend → 403,
//      Fehlversuche je Netz gedrosselt (429); ohne Einrichtung immer 404 (es gibt dann keinen Webhook)
//   3. JSON lesen → `webhookAnwenden` (rein, idempotent über die WAMID — Meta wiederholt bis zu 36 h) → Spiegel schreiben
//   4. schnell 200 (leer); Medien werden danach im Hintergrund geladen (`after` in der Route, sonst im Takt)
// Schlägt das Schreiben fehl, antwortet die Route 500 — Meta liefert erneut, nichts geht verloren, nichts doppelt.
// Die Antwort enthält NIE Daten.

import { pruefe, fehlschlag, erfolg } from '@/lib/zugang/drossel';
import type { WaKonfig } from './konfig';
import { signaturGueltig } from './signatur';
import { aendereWaSpiegel, aendereWaZustand, webhookAnwenden, type WebhookKoerper, type WebhookErgebnis } from './spiegel';
import { WA_GRENZEN } from './typen';

export type WebhookAntwort = { status: 200; neu: number; medien: string[] } | { status: 400 | 403 | 413 | 429 | 500 };

/** Einen Webhook prüfen und verarbeiten. `netz` = Schlüssel der Drossel (Adresse des Aufrufers). Wirft nie. */
export async function webhookVerarbeiten(roh: Buffer, signatur: string | null, k: WaKonfig, netz: string, jetzt = new Date()): Promise<WebhookAntwort> {
  const schluessel = `wa-webhook:${netz}`;
  if (!pruefe(schluessel, jetzt.getTime()).erlaubt) return { status: 429 };
  if (roh.length > WA_GRENZEN.koerper) return { status: 413 };
  if (!signaturGueltig(roh, signatur, k.appGeheimnis)) {
    fehlschlag(schluessel, jetzt.getTime(), 10);
    await aendereWaZustand(z => ({ ...z, webhook: { anzahl: z.webhook?.anzahl ?? 0, ...z.webhook, abgelehnt: (z.webhook?.abgelehnt ?? 0) + 1, zuletztAbgelehnt: jetzt.toISOString() } })).catch(() => {});
    return { status: 403 };
  }
  erfolg(schluessel);
  let koerper: WebhookKoerper;
  try { koerper = JSON.parse(roh.toString('utf8')) as WebhookKoerper; } catch { return { status: 400 }; }
  let r: WebhookErgebnis | null = null;
  try {
    await aendereWaSpiegel(s => { r = webhookAnwenden(s, koerper, k.telefonnummerId, jetzt.toISOString()); return r.spiegel === s ? null : r.spiegel; });
    await aendereWaZustand(z => ({ ...z, webhook: { abgelehnt: z.webhook?.abgelehnt ?? 0, ...z.webhook, anzahl: (z.webhook?.anzahl ?? 0) + 1, zuletzt: jetzt.toISOString() } }));
  } catch (e) {
    console.error(`[whatsapp] Webhook nicht gespeichert: ${e instanceof Error ? e.message.slice(0, 120) : 'Fehler'}`);
    return { status: 500 };
  }
  const x = r as WebhookErgebnis | null;
  // Keine Glocke je Nachricht (die Inbox zeigt sie; das Lagebild zählt sie) — die Glocke läutet nur bei „Verbindung erneuern“.
  return { status: 200, neu: x?.neu ?? 0, medien: x?.medien ?? [] };
}

