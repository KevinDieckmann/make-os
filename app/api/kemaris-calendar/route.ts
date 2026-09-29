// ─── KEMARIS (Microsoft 365) Kalender — noch nicht angebunden ───────────────
// Bis 29.09. standen hier fest eingetragene BEISPIEL-Termine (Stand Juli 2026), die in Heute, Wochenplaner, ZOE,
// `planung/vorschlag` und die CRM-Signale liefen, als wären es echte (Verbindungskarte Befund 14). Seit K5 liefert die
// Route NICHTS und schreibt nichts in den Bestand `kemaris-calendar`; kein Leser nimmt ihn mehr (außer Datenschutz:
// Register, Art. 17, Löschfristen). M365 kommt später echt (eigenes Paket, mit Zugang je Person und Maskierung).
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    { lastUpdated: null, events: [], veraltet: true, angebunden: false, hinweis: 'Der KEMARIS-Kalender (Microsoft 365) ist noch nicht angebunden.' },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
