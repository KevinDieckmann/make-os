// ─── Gmail — Pub/Sub-Push-Webhook (03.10.2026) ───────────────────────────────
// POST von der Pub/Sub-Subscription (users.watch). OHNE Sitzung erreichbar (Middleware lässt genau diesen Pfad durch) — dafür gilt:
//   · nur mit gültigem OIDC-Token von Google (Signatur, Aussteller, Audience, Dienstkonto, Ablauf — lib/gmail/meldung.ts), sonst
//     403 mit leerem Körper; ohne Einrichtung (GMAIL_PUSH_DIENSTKONTO/-AUDIENCE) immer 403; Fehlversuche je Netz gedrosselt (429)
//   · liefert NIE Daten: die Antwort ist immer leer; die Meldung stößt höchstens einen Abgleich an (Hintergrund)
//   · höchstens ein Anstoß je Person alle 5 Sekunden; Körper höchstens 16 KB
import { NextResponse } from 'next/server';
import { pushVerarbeiten, anstossenAbgleich } from '@/lib/gmail/meldung';
import { zuGross } from '@/lib/zugang/umfang';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (zuGross(req, 16 * 1024)) return new NextResponse(null, { status: 413 });
  const r = await pushVerarbeiten(req, anstossenAbgleich);
  return new NextResponse(null, { status: r.status });
}
