// ─── Markttraktion · Mandate für den Mandat-Chip (28.09.) ───────────────────
// Kevin: „Mandat an Zielen und Zeit.“ Ziele, Meilensteine und die Zeitmessung
// wählen ein Mandat über einen Chip („Firma · Mandatstitel“). Dafür reicht die
// Kurzform (lib/planung/mandat.ts `mandatKurzListe`) — nicht der ganze CRM-Bestand.
// GET → { ok, mandate: MandatKurz[] } (alle Mandate, aktive zuerst; der Chip zeigt
// die aktiven und das gerade gewählte). Zugang wie das CRM: Haushalt des Inhabers.
// ETag über den Stand des CRM → 304, wenn sich nichts geändert hat.

import { NextResponse } from 'next/server';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { speicherStand } from '@/lib/store/local-db';
import { etagAus, jsonAntwort, unveraendert } from '@/lib/http/json-antwort';
import { ladeCrm, CRM_SPEICHER } from '@/lib/crm/speicher';
import { mandatKurzListe } from '@/lib/planung/mandat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const zugang = await imHaushaltDesInhabers(req);
  if (!zugang) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  const etag = etagAus('mandat-wahl', await speicherStand([CRM_SPEICHER]));
  const gleich = unveraendert(req, etag);
  if (gleich) return gleich;
  return jsonAntwort(req, { ok: true, mandate: mandatKurzListe(await ladeCrm()) }, etag);
}
