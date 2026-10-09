// ─── Haushaltsfinanzen: Sicherung herunterladen ─────────────────────────────
// Alle Daten des Haushalts als JSON — im Format des früheren Finanz-Cockpits
// („make-orga-sicherung“, Beträge in Euro, seine Feldnamen). So bleibt der Weg
// zurück in dieses Format offen, und ihr habt eine Kopie in eurer Hand.
// Dateiname seit dem Rundgang 09.10. neutral (jede Instanz lädt hier herunter).

import { NextResponse } from 'next/server';
import { haushaltVon, KEIN_ZUGANG } from '@/lib/finanzen/haushalt/zugriff';
import { ladeHaushalt } from '@/lib/finanzen/haushalt/speicher';
import { alsMalinFormat } from '@/lib/finanzen/haushalt/sicherung';
import { heuteBerlin } from '@/lib/finanzen/haushalt/monat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const z = await haushaltVon(req);
  if (!z) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  const h = await ladeHaushalt(z.haushalt);
  const text = JSON.stringify(alsMalinFormat(h), null, 2);
  return new NextResponse(text, { headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Disposition': `attachment; filename="Haushalt-Sicherung-${heuteBerlin()}.json"`,
    'Cache-Control': 'no-store',
  } });
}
