// ─── WHOOP — Webhooks (Server, 08.10.2026) ───────────────────────────────────────────────────────────────────────────────
// Doku: https://developer.whoop.com/docs/developing/webhooks (FAKTEN 7).
//   · Signatur: `X-WHOOP-Signature` = base64(HMAC-SHA256(`X-WHOOP-Signature-Timestamp` + ROHKÖRPER, client_secret)) — zeitkonstant
//     verglichen; falsch/fehlend → 401, nichts passiert.
//   · Körper: { user_id, id (v2: UUID; bei Recovery die UUID des Schlafs), type, trace_id }. Ereignisse: workout|sleep|recovery
//     .updated|.deleted (Anlegen = updated). Zyklen (Strain) haben keinen Webhook → Takt.
//   · Nur bekannte `user_id` (aktive Verbindung) → Person; unbekannte werden mit 200 quittiert und verworfen (WHOOP soll nicht
//     wiederholen) — nie eine Person aus dem Körper.
//   · Idempotent über `trace_id` (je Person, die letzten 500). Schnell 200; die Arbeit (Abgleich bzw. Entfernen) danach (`after`), Rückfall Takt.
//   · Ein Höchstalter des Zeitstempels nennt die Doku nicht (Annahme: keins) — eine wiederholte gültige Meldung löst höchstens einen Abgleich aus.
// Liefert NIE Daten.

import { createHmac, timingSafeEqual } from 'node:crypto';
import { updateJson } from '@/lib/store/local-db';
import { alleSpeicher } from '@/lib/zugang/konten';
import { standName } from './konfig';
import { personZuUserId } from './verbindung';
import { SPUREN_MAX, type WhoopStand } from './abgleich';
import { istUuid } from './abbilden';

export const WEBHOOK_KOERPER_MAX = 64 * 1024;
export const WEBHOOK_ARTEN = ['workout.updated', 'workout.deleted', 'sleep.updated', 'sleep.deleted', 'recovery.updated', 'recovery.deleted'] as const;
export type WebhookArt = (typeof WEBHOOK_ARTEN)[number];

/** Signatur prüfen (rein, zeitkonstant). */
export function signaturGueltig(roh: Buffer, zeitstempel: string | null, signatur: string | null, geheimnis: string): boolean {
  if (!zeitstempel || !signatur || !geheimnis || !/^\d{1,16}$/.test(zeitstempel) || signatur.length > 200) return false;
  const soll = createHmac('sha256', geheimnis).update(Buffer.concat([Buffer.from(zeitstempel, 'utf8'), roh])).digest();
  let ist: Buffer;
  try { ist = Buffer.from(signatur.trim(), 'base64'); } catch { return false; }
  return ist.length === soll.length && timingSafeEqual(ist, soll);
}

/** Signatur bilden (Tests, Fake). */
export const signieren = (roh: Buffer | string, zeitstempel: string, geheimnis: string): string =>
  createHmac('sha256', geheimnis).update(Buffer.concat([Buffer.from(zeitstempel, 'utf8'), Buffer.isBuffer(roh) ? roh : Buffer.from(roh, 'utf8')])).digest('base64');

export interface WebhookMeldung { userId: number; id: string; art: WebhookArt; spur: string }

/** Körper lesen (rein) — null bei allem, was nicht genau die belegte Form hat. */
export function meldungAus(roh: Buffer): WebhookMeldung | null {
  let j: unknown;
  try { j = JSON.parse(roh.toString('utf8')); } catch { return null; }
  if (!j || typeof j !== 'object' || Array.isArray(j)) return null;
  const o = j as Record<string, unknown>;
  const userId = Number(o.user_id);
  if (!Number.isSafeInteger(userId) || userId <= 0) return null;
  if (!(WEBHOOK_ARTEN as readonly unknown[]).includes(o.type)) return null;
  if (!istUuid(o.id)) return null;
  const spur = typeof o.trace_id === 'string' && /^[A-Za-z0-9._:-]{1,120}$/.test(o.trace_id) ? o.trace_id : null;
  if (!spur) return null;
  return { userId, id: o.id.toLowerCase(), art: o.type as WebhookArt, spur };
}

export type WebhookErgebnis = { status: 200 | 400 | 401; person?: string; meldung?: WebhookMeldung; doppelt?: boolean };

/**
 * Eine Meldung annehmen: Signatur, Form, Person, Doppelte. Schreibt NUR `webhookZuletzt` + `trace_id` in den Stand der Person — die
 * eigentliche Arbeit macht der Aufrufer danach (`after`).
 */
export async function webhookAnnehmen(roh: Buffer, kopf: { get(n: string): string | null }, geheimnis: string, jetzt = Date.now()): Promise<WebhookErgebnis> {
  if (!signaturGueltig(roh, kopf.get('x-whoop-signature-timestamp'), kopf.get('x-whoop-signature'), geheimnis)) return { status: 401 };
  const m = meldungAus(roh);
  if (!m) return { status: 400 };
  const person = await personZuUserId(m.userId, await alleSpeicher().catch(() => [] as string[]));
  if (!person) return { status: 200 }; // unbekannt: quittieren, nichts tun (nie eine Person aus dem Körper)
  let doppelt = false;
  await updateJson<WhoopStand>(standName(person), cur => {
    const s: WhoopStand = cur && cur.v === 1 ? cur : { v: 1, abTag: new Date(jetzt).toISOString().slice(0, 10), recovery: {}, schlaf: {}, zyklen: {}, workouts: {} };
    const spuren = s.spuren ?? [];
    doppelt = spuren.includes(m.spur);
    return { ...s, webhookZuletzt: new Date(jetzt).toISOString(), spuren: doppelt ? spuren : [...spuren, m.spur].slice(-SPUREN_MAX) };
  });
  return { status: 200, person, meldung: m, doppelt };
}

/** Die Arbeit nach einer neuen Meldung: gelöscht → aus dem Spiegel nehmen; sonst ein (Teil-)Abgleich. */
export async function webhookArbeit(person: string, m: WebhookMeldung): Promise<void> {
  const { whoopAbgleichen, whoopEntfernen } = await import('./abgleich');
  if (m.art.endsWith('.deleted')) { await whoopEntfernen(person, m.art.split('.')[0] as 'sleep' | 'workout' | 'recovery', m.id); return; }
  await whoopAbgleichen(person, { trotzPause: false });
}
