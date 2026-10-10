// ─── Fulfillment — Personenteil der Dossiers (STUB aus C0; gehört Paket C3) ───────────────────────────────────────────────────────────
// FULFILLMENT_KONZEPT.md Abschnitt 9 / 4.5: berufliche Personenkarten · pruefen · art14 · verknuepfen (kontaktId) · loeschen; Lese-Protokoll
// „personenrecherche“. Tor `personenteilZugang`: nur der Inhaber oder ein Mitglied OHNE finanzRecht „business“ (sonst 403).

import { NextResponse } from 'next/server';
import { personenteilZugang } from '@/lib/fulfillment/zugang';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KOMMT = { ok: false, fehler: 'kommt mit Paket C3' } as const;

export async function GET(req: Request) {
  const z = await personenteilZugang(req);
  if (z instanceof Response) return z;
  return NextResponse.json(KOMMT, { status: 501 });
}

export async function POST(req: Request) {
  const z = await personenteilZugang(req, { schreiben: true });
  if (z instanceof Response) return z;
  return NextResponse.json(KOMMT, { status: 501 });
}
