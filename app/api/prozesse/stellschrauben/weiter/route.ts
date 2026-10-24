// ─── Prozesse — Stellschrauben, die an eine vorhandene Schreibstelle weiterleiten (Restpunkte 24.10.) ───────────────────────────────────────────────────────
// POST { weg: { art: 'scoring' | 'buchung' | 'head', feld, stand, seite? | head? }, wert } — EIN Feld der Scoring-Einstellungen, einer Buchungsseite bzw. eines
// Business-Heads aus dem Steckbrief der Prozesse (`wert: null` = zurück auf die Vorgabe). Gelesen, geprüft und geschrieben wird in
// lib/prozesse/stellschrauben-weiter-server.ts über DIESELBE Schreibstelle wie die Fachseite (scoringSchreiben · seiteSpeichern · einstellungAendern).
// Tor wie die Stellschrauben: Haushalt des Inhabers, nur Business, nur per Sitzung (Dienstweg 403) mit Bau-Kennung; Heads nur der Inhaber (403).
// Stand/409, Grenzen 400 mit Satz, Körper ≤ 16 KB (413). Gibt nur einen Satz zurück — die Werte liest die Karte neu (GET /api/prozesse/landkarte).

import { NextResponse } from 'next/server';
import { prozesseZugang } from '@/lib/prozesse/zugang';
import { stellschraubeWeiter } from '@/lib/prozesse/stellschrauben-weiter-server';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { werAus } from '@/lib/store/aenderungsprotokoll';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const nein = (status: number, fehler: string) => NextResponse.json({ ok: false, fehler }, { status });

export async function POST(req: Request) {
  const z = await prozesseZugang(req, { schreiben: true });
  if (z instanceof Response) return z;
  let b: unknown;
  try { b = await jsonBegrenzt(req, 16 * 1024); } catch (e) { return jsonZuGross(e) ?? nein(400, 'Kein JSON.'); }
  const r = await stellschraubeWeiter(b, { person: z.person, wer: werAus(req) });
  return r.ok ? NextResponse.json({ ok: true, text: r.text }) : nein(r.status, r.fehler);
}
