// ─── WhatsApp — Webhook prüfen: Verifizierung (GET) und Signatur (POST) (Server, rein bis auf node:crypto, 07.10.2026) ──────
// Meta (https://developers.facebook.com/docs/graph-api/webhooks/getting-started, abgerufen 07.10.2026):
//   · Verifizierung: GET mit `hub.mode=subscribe`, `hub.verify_token` (der Wert, den wir bei Meta eintragen) und `hub.challenge`
//     — stimmt das Token, antworten wir mit genau der Challenge.
//   · Jede Meldung trägt `X-Hub-Signature-256: sha256=<hex>` = HMAC-SHA256 über den ROHEN Körper mit dem App-Geheimnis.
// Geprüft wird über die Bytes, wie sie ankamen (nie über ein neu serialisiertes JSON), zeitkonstant.

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const SIGNATUR = /^sha256=([0-9a-f]{64})$/i;

/** Ist die Signatur gültig? Fehlender/kaputter Kopf, falsches Geheimnis, veränderter Körper → false. Wirft nie. */
export function signaturGueltig(roh: Buffer | Uint8Array, kopf: string | null | undefined, geheimnis: string): boolean {
  try {
    if (!geheimnis) return false;
    const m = SIGNATUR.exec(String(kopf ?? '').trim());
    if (!m) return false;
    const erwartet = createHmac('sha256', geheimnis).update(roh).digest();
    const gegeben = Buffer.from(m[1].toLowerCase(), 'hex');
    return gegeben.length === erwartet.length && timingSafeEqual(gegeben, erwartet);
  } catch { return false; }
}

/** Zeitkonstanter Vergleich zweier Texte (auch bei unterschiedlicher Länge — über SHA-256). */
export function gleichZeitkonstant(a: string, b: string): boolean {
  const x = createHash('sha256').update(a, 'utf8').digest();
  const y = createHash('sha256').update(b, 'utf8').digest();
  return timingSafeEqual(x, y) && a.length === b.length;
}

const CHALLENGE = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * Verifizierungs-Anfrage prüfen: liefert die Challenge (zum Zurückschicken) oder null (→ 403).
 * Meta sagt „int“ für die Challenge — wir nehmen nur harmlose Zeichen (keine Antwort mit fremdem Markup).
 */
export function verifizieren(q: URLSearchParams, token: string): string | null {
  if (!token) return null;
  const mode = q.get('hub.mode');
  const gegeben = q.get('hub.verify_token') ?? '';
  const challenge = q.get('hub.challenge') ?? '';
  if (mode !== 'subscribe' || !CHALLENGE.test(challenge)) return null;
  return gleichZeitkonstant(gegeben, token) ? challenge : null;
}
