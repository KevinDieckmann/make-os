// GET → gibt es schon Konten? (entscheidet, ob /anmelden „Einrichten" zeigt)
import { NextResponse } from 'next/server';
import { ladeKonten } from '@/lib/zugang/konten';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  const s = await ladeKonten();
  return NextResponse.json({ eingerichtet: s.konten.length > 0 });
}
