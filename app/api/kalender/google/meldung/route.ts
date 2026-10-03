// ─── Kalender — Google: Push-Webhook (03.10.2026) ────────────────────────────
// POST von Google (events.watch). OHNE Sitzung erreichbar (Middleware lässt genau diesen Pfad durch) — dafür gilt:
//   · nur mit gültiger Kanal-Kennung + Kanal-Token + Ressourcen-ID (lib/kalender/google/kanal.ts `meldungPasst`),
//     sonst 403 mit leerem Körper; Fehlversuche je Netz gedrosselt (429)
//   · liefert NIE Daten: die Antwort ist immer leer; die Meldung stößt höchstens einen Abgleich an (Hintergrund)
//   · höchstens ein Anstoß je Person alle 5 Sekunden
import { NextResponse } from 'next/server';
import { meldungVerarbeiten } from '@/lib/kalender/google/kanal';
import { googleAbgleichen } from '@/lib/kalender/google/abgleich';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const r = await meldungVerarbeiten(req, person => { void googleAbgleichen(person, { nachlauf: true }).catch(() => { /* der Fehler steht im Stand */ }); });
  return new NextResponse(null, { status: r.status });
}
