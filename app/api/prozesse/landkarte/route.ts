// ─── Prozesse — die Landkarte (Etappe A, 21.10.; research/prozesse/ANALYSE_100.md Punkte 1–4, 27, 74) ─────────────────────────────────────
// GET → alle Prozesse der Landkarte (System-Prozesse aus dem Register + Vorlagen aus dem Fulfillment) mit Steckbrief, Phasen, Schritten, Übergaben und
//       der Zahl der Fälle, wo es echte Daten gibt. Nur Business (Sicht Privat → 403), nur Haushalt des Inhabers (auch „nur Business“ liest), nur lesen —
//       schreibt nie. ETag aus dem Inhalt (304, wenn sich nichts geändert hat). Gerechnet in lib/prozesse/server.ts.

import { prozesseZugang } from '@/lib/prozesse/zugang';
import { landkarteLesen } from '@/lib/prozesse/server';
import { etagAus, jsonAntwort, unveraendert } from '@/lib/http/json-antwort';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const z = await prozesseZugang(req);
  if (z instanceof Response) return z;
  const daten = await landkarteLesen();
  const etag = etagAus('prozesse', daten.stand);
  return unveraendert(req, etag) ?? jsonAntwort(req, { ok: true, ...daten }, etag);
}
