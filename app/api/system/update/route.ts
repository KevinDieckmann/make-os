// ─── MAKE OS — Läuft gerade ein Update? (08.10., Phase 0) ───────────────────
// GET → { laeuft, seit, bau } für die Zeile im Kopf (components/os/UpdateHinweis.tsx). Nur mit Sitzung (sonst 401);
// keine Inhalte, keine Personen — nur, ob die Marke von deploy/ausrollen.sh gilt (lib/bau/update.ts) und welcher Bau
// hier läuft (lib/bau/kennung.ts). Lesen schreibt nicht.

import { NextResponse } from 'next/server';
import { personDerSitzung, ohnePerson } from '@/lib/zugang/tor';
import { updateStand } from '@/lib/bau/update-server';
import { bauKennung } from '@/lib/bau/kennung';
import type { UpdateAntwort } from '@/lib/bau/update';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!personDerSitzung(req)) return ohnePerson();
  const lage = await updateStand();
  const antwort: UpdateAntwort = { laeuft: lage.laeuft, seit: lage.seit, bau: bauKennung() };
  return NextResponse.json(antwort, { headers: { 'Cache-Control': 'no-store' } });
}
