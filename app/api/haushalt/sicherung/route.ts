// ─── Haushaltsfinanzen: Sicherung herunterladen ─────────────────────────────
// Alle Daten des Haushalts als JSON — im Format von Malins Cockpit
// („make-orga-sicherung“, Beträge in Euro, ihre Feldnamen). So bleibt der Weg
// zurück in ihr Format offen, und ihr habt eine Kopie in eurer Hand.

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
    'Content-Disposition': `attachment; filename="MAKE-ORGA-Sicherung-${heuteBerlin()}.json"`,
    'Cache-Control': 'no-store',
  } });
}
