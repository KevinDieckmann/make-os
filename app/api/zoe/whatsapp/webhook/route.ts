// ─── ZOE auf WhatsApp — Webhook der ZOE-Nummer (08.10.2026) ─────────────────────────────────────────────────────────────
// OHNE Sitzung erreichbar (Middleware lässt genau diesen Pfad durch, GET und POST) — „offen, aber selbst geprüft“, wie der Webhook der
// Business-Nummer, aber mit der EIGENEN Konfiguration (WHATSAPP_ZOE_*):
//   GET   Verifizierung beim Einrichten bei Meta: `hub.verify_token` = WHATSAPP_ZOE_VERIFY_TOKEN (zeitkonstant, gedrosselt) → die Challenge
//   POST  nur mit gültiger `X-Hub-Signature-256` (HMAC-SHA256 über den ROHEN Körper, App-Geheimnis der ZOE-Nummer); ≤ 512 KB; idempotent
//         (WAMID); Nachrichten fremder Nummern: nur gezählt, nie gespeichert, nie beantwortet; schnell 200 mit leerem Körper — verarbeitet
//         wird danach (`after`; was dabei scheitert, holt der Takt nach).
// Ohne Einrichtung (oder ZOE-Nummer = Business-Nummer) 404. Liefert NIE Daten. Ablauf: lib/zoe-whatsapp/webhook.ts, eingang.ts.
import { after, NextResponse } from 'next/server';
import { zoeWhatsappKonfig } from '@/lib/zoe-whatsapp/konfig';
import { zoeWebhookVerarbeiten } from '@/lib/zoe-whatsapp/webhook';
import { verifizieren } from '@/lib/whatsapp/signatur';
import { WA_GRENZEN } from '@/lib/whatsapp/typen';
import { adresseNetz, pruefe, fehlschlag } from '@/lib/zugang/drossel';
import { zuGross } from '@/lib/zugang/umfang';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const leer = (status: number) => new NextResponse(null, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET(req: Request) {
  const k = zoeWhatsappKonfig();
  if (!k) return leer(404);
  const netz = `zoe-wa-verify:${adresseNetz(req)}`;
  if (!pruefe(netz).erlaubt) return leer(429);
  const challenge = verifizieren(new URL(req.url).searchParams, k.verifyToken);
  if (!challenge) { fehlschlag(netz, Date.now(), 10); return leer(403); }
  return new NextResponse(challenge, { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}

export async function POST(req: Request) {
  const k = zoeWhatsappKonfig();
  if (!k) return leer(404);
  if (zuGross(req, WA_GRENZEN.koerper)) return leer(413);
  let roh: Buffer;
  try { roh = Buffer.from(await req.arrayBuffer()); } catch { return leer(400); }
  const r = await zoeWebhookVerarbeiten(roh, req.headers.get('x-hub-signature-256'), k, adresseNetz(req));
  if (r.status === 200 && r.personen.length) {
    const personen = r.personen;
    const verarbeiten = async () => {
      const { eingangVerarbeiten } = await import('@/lib/zoe-whatsapp/eingang');
      for (const p of personen) await eingangVerarbeiten(p).catch(e => console.warn(`[zoe-whatsapp] Eingang: ${e instanceof Error ? e.name : 'Fehler'}`));
    };
    // Nach der Antwort (Next `after`); außerhalb einer Anfrage (Tests) im Hintergrund — der Takt holt Verpasstes nach.
    try { after(verarbeiten); } catch { void verarbeiten().catch(() => {}); }
  }
  return leer(r.status);
}
