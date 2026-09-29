// ─── Kalender — Gäste aus dem CRM suchen (30.09., Paket K3) ─────────────────
// GET ?q=… → { treffer: [{ email, name, kontaktId, werbesperre? }] } — höchstens 8, erst ab zwei Zeichen.
// Adressen nur auf Anfrage (Datensparsamkeit), eingeschränkte Personen (Art. 18) fehlen ganz
// (`kontakteFuerVerarbeitung`), Werbesperre kommt mit (1:1-Termin erlaubt, die Oberfläche zeigt einen Hinweis).

import { NextResponse } from 'next/server';
import { kalenderZugang, KEIN_KALENDER } from '@/lib/kalender/zugang';
import { kontakteFuerVerarbeitung } from '@/lib/crm/verarbeitung';
import { gaesteSuchen } from '@/lib/kalender/gaeste-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const z = await kalenderZugang(req);
  if (!z) return NextResponse.json(KEIN_KALENDER, { status: 403 });
  const q = (new URL(req.url).searchParams.get('q') ?? '').slice(0, 80);
  return NextResponse.json({ ok: true, treffer: gaesteSuchen(await kontakteFuerVerarbeitung(), q) });
}
