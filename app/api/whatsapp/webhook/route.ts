// ─── WhatsApp — Webhook der Cloud API (07.10.2026) ─────────────────────────────────────────────────────────────────────
// OHNE Sitzung erreichbar (Middleware lässt genau diesen Pfad durch, GET und POST) — „offen, aber selbst geprüft“:
//   GET   Verifizierung beim Einrichten bei Meta: `hub.mode=subscribe` + `hub.verify_token` (= WHATSAPP_VERIFY_TOKEN, zeitkonstant)
//         → Antwort genau die `hub.challenge` (text/plain); sonst 403. Ohne Einrichtung 404.
//   POST  nur mit gültiger Signatur `X-Hub-Signature-256` (HMAC-SHA256 über den ROHEN Körper, App-Geheimnis); Körper ≤ 512 KB;
//         Fehlversuche je Netz gedrosselt; idempotent (WAMID); schnell 200 mit leerem Körper — Medien lädt `after` im Hintergrund.
// Liefert NIE Daten. Ablauf und Belege: lib/whatsapp/webhook.ts, lib/whatsapp/signatur.ts.
import { after, NextResponse } from 'next/server';
import { whatsappKonfig } from '@/lib/whatsapp/konfig';
import { verifizieren } from '@/lib/whatsapp/signatur';
import { webhookVerarbeiten } from '@/lib/whatsapp/webhook';
import { WA_GRENZEN } from '@/lib/whatsapp/typen';
import { adresseNetz, pruefe, fehlschlag } from '@/lib/zugang/drossel';
import { zuGross } from '@/lib/zugang/umfang';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const leer = (status: number) => new NextResponse(null, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET(req: Request) {
  const k = whatsappKonfig();
  if (!k) return leer(404);
  const netz = `wa-verify:${adresseNetz(req)}`;
  if (!pruefe(netz).erlaubt) return leer(429);
  const challenge = verifizieren(new URL(req.url).searchParams, k.verifyToken);
  if (!challenge) { fehlschlag(netz, Date.now(), 10); return leer(403); }
  return new NextResponse(challenge, { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}

export async function POST(req: Request) {
  const k = whatsappKonfig();
  if (!k) return leer(404);
  if (zuGross(req, WA_GRENZEN.koerper)) return leer(413);
  let roh: Buffer;
  try { roh = Buffer.from(await req.arrayBuffer()); } catch { return leer(400); }
  const r = await webhookVerarbeiten(roh, req.headers.get('x-hub-signature-256'), k, adresseNetz(req));
  if (r.status === 200 && r.medien.length) {
    const medien = r.medien;
    const laden = async () => {
      const { medienNachladen } = await import('@/lib/whatsapp/medien');
      await import('@/lib/whatsapp/server'); // Glocke bei ungültigem Schlüssel (Graph-Haken)
      await medienNachladen(k, medien.length, medien).catch(e => console.warn(`[whatsapp] Medien: ${e instanceof Error ? e.message.slice(0, 120) : 'Fehler'}`));
    };
    // Nach der Antwort (Next `after`); außerhalb einer Anfrage (Tests) einfach im Hintergrund — der Takt holt Verpasstes nach.
    try { after(laden); } catch { void laden().catch(() => {}); }
  }
  return leer(r.status);
}
