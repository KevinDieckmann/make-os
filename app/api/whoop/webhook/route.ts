// ─── WHOOP — Webhook (08.10.2026) ────────────────────────────────────────────────────────────────────────────────────────
// OHNE Sitzung erreichbar (Middleware lässt genau diesen Pfad durch, nur POST) — „offen, aber selbst geprüft“:
//   POST nur mit gültiger Signatur `X-WHOOP-Signature` (base64 HMAC-SHA256 über Zeitstempel + ROHKÖRPER, Client Secret; zeitkonstant)
//        → sonst 401 leer; Körper ≤ 64 KB; Fehlversuche je Netz gedrosselt; idempotent über `trace_id`; nur bekannte WHOOP-Kennungen.
//   Antwort schnell 200 leer (Doku: „within a second“); Abgleich bzw. Entfernen danach (`after`), Rückfall der Takt.
// Ohne Einrichtung 404. Handelt für niemanden aus dem Körper, liefert NIE Daten.
// Doku: https://developer.whoop.com/docs/developing/webhooks
import { after, NextResponse } from 'next/server';
import { whoopKonfig } from '@/lib/whoop/konfig';
import { webhookAnnehmen, webhookArbeit, WEBHOOK_KOERPER_MAX } from '@/lib/whoop/webhook';
import { adresseNetz, pruefe, fehlschlag } from '@/lib/zugang/drossel';
import { zuGross } from '@/lib/zugang/umfang';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const leer = (status: number) => new NextResponse(null, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(req: Request) {
  const k = whoopKonfig();
  if (!k) return leer(404);
  const netz = `whoop-webhook:${adresseNetz(req)}`;
  if (!pruefe(netz).erlaubt) return leer(429);
  if (zuGross(req, WEBHOOK_KOERPER_MAX)) return leer(413);
  let roh: Buffer;
  try { roh = Buffer.from(await req.arrayBuffer()); } catch { return leer(400); }
  if (roh.length > WEBHOOK_KOERPER_MAX) return leer(413);
  const r = await webhookAnnehmen(roh, req.headers, k.clientSecret).catch(() => ({ status: 500 as const }));
  if (r.status === 401) { fehlschlag(netz, Date.now(), 20); return leer(401); }
  if (r.status !== 200) return leer(r.status);
  if ('person' in r && r.person && r.meldung && !r.doppelt) {
    const person = r.person, meldung = r.meldung;
    const arbeit = () => webhookArbeit(person, meldung).catch(e => console.warn(`[whoop] Webhook: ${e instanceof Error ? e.name : 'Fehler'}`));
    // Nach der Antwort (Next `after`); außerhalb einer Anfrage (Tests) einfach im Hintergrund — der Takt holt Verpasstes nach.
    try { after(arbeit); } catch { void arbeit(); }
  }
  return leer(200);
}
