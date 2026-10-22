// ─── Prozesse — Stellschrauben der festen Prozesse (22.10., Branch `prozesse-stellschrauben`) ───────────────────────────────────────────────────────────────
// GET  → die gespeicherten Abweichungen (`gespeichert`), die wirksamen Werte aller neuen Stellschrauben (`wirksam`, Vorgabe eingesetzt) und der Stand (für 409).
//        Nur Business (Sicht Privat → 403), nur Haushalt des Inhabers; Lesen schreibt nie.
// POST { stand, ops: [{ id, wert | null }] } → ändern (null = zurück auf die Vorgabe). Tor wie die Werkstatt: nur per Sitzung (Dienstweg 403) mit Bau-Kennung,
//        nur volle Mitglieder (das Verhalten eines Ablaufs ändern ist wie „Status“ — eine Rolle „nur Business“ sieht die Werte), Stand/409 mit der aktuellen
//        Fassung, unbekannte Kennung 404, ungültiger Wert 400, zu viele 413 — nie gekürzt, alles oder nichts. Bestand `prozesse-stellschrauben--<h>`
//        (lib/prozesse/stellschrauben-werte-server.ts), gespeichert nur Abweichungen. Die Werte der Markttraktion (Nachfassfrist, Wiedervorlage, Deal-Ampel)
//        gehen über POST /api/crm/stammdaten (Wertelisten) — hier nicht.

import { NextResponse } from 'next/server';
import { prozesseZugang } from '@/lib/prozesse/zugang';
import { stellschraubenLesen, stellschraubenSchreiben, stellschraubenStand } from '@/lib/prozesse/stellschrauben-werte-server';
import { WERTE, wert } from '@/lib/prozesse/stellschrauben-werte';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { werAus } from '@/lib/store/aenderungsprotokoll';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const nein = (status: number, fehler: string, extra: Record<string, unknown> = {}) => NextResponse.json({ ok: false, fehler, ...extra }, { status });
const antwort = (b: Awaited<ReturnType<typeof stellschraubenLesen>>) => ({
  gespeichert: b.werte, wirksam: Object.fromEntries(WERTE.map(d => [d.id, wert(b.werte, d.id)])), stand: stellschraubenStand(b),
  ...(b.geaendertAm ? { geaendertAm: b.geaendertAm } : {}), ...(b.geaendertVon ? { geaendertVon: b.geaendertVon } : {}),
});

export async function GET(req: Request) {
  const z = await prozesseZugang(req);
  if (z instanceof Response) return z;
  return NextResponse.json({ ok: true, ...antwort(await stellschraubenLesen(z.haushalt)) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const z = await prozesseZugang(req, { schreiben: true });
  if (z instanceof Response) return z;
  if (!z.rechte.veroeffentlichen) return nein(403, 'Die Stellschrauben der festen Prozesse ändern nur volle Mitglieder des Haushalts — ansehen kannst du sie.');
  let b: Record<string, unknown>;
  try { b = await jsonBegrenzt(req, 64 * 1024); } catch (e) { return jsonZuGross(e) ?? nein(400, 'Kein JSON.'); }
  const r = await stellschraubenSchreiben(z.haushalt, { stand: b.stand, ops: b.ops, person: z.person, jetzt: new Date().toISOString(), wer: werAus(req) });
  if (!r.ok) return nein(r.status, r.fehler, 'aktuell' in r ? antwort(r.aktuell) : {});
  return NextResponse.json({ ok: true, geaendert: r.geaendert, ...antwort(r.bestand) });
}
