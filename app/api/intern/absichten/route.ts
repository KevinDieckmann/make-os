// ─── Absichtsprotokoll: Lage und Wiederaufnahme von Hand (29.09., Paket D-C #17) — nur Inhaber bzw. Dienstweg ──
// GET                                   → je Haushalt die Absichten OHNE Daten (Art, Status, Schritte, Versuche, Fehlergrund)
// POST { aktion: 'fertigstellen' }      → offene Absichten jetzt fertigstellen (auch junge; laufende bleiben unberührt)
// POST { aktion: 'erneut', id }         → eine GESCHEITERTE Absicht wieder freigeben (Zähler 0) und fertigstellen —
//                                          erst, wenn die Ursache behoben ist (NOTFALL.md „Absichten“)
// Logik: lib/store/absichten.ts, lib/store/absichten-fortsetzen.ts. Der Takt und die Durchsicht tun dasselbe von selbst.

import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { NextResponse } from 'next/server';
import { nurInhaber } from '@/lib/zugang/haushalt-inhaber';
import { absichtenHaushalte, absichtenLaden, absichtErneutVersuchen } from '@/lib/store/absichten';
import { offeneFertigstellen } from '@/lib/store/absichten-fortsetzen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!(await nurInhaber(req))) return NextResponse.json({ ok: false, fehler: 'Nur der Inhaber.' }, { status: 403 });
  const raus: Record<string, unknown[]> = {};
  for (const h of await absichtenHaushalte()) {
    // Nie die Daten (Namen, Adressen, alte Kennungen) — nur, was zum Beurteilen reicht.
    raus[h] = (await absichtenLaden(h)).map(a => ({ id: a.id, art: a.art, status: a.status, angelegt: a.angelegt, schritte: a.schritte, versuche: a.versuche, ...(a.letzterFehler ? { letzterFehler: a.letzterFehler } : {}), ...(a.abgeschlossen ? { abgeschlossen: a.abgeschlossen } : {}) }));
  }
  return NextResponse.json({ ok: true, haushalte: raus });
}

export async function POST(req: Request) {
  if (!(await nurInhaber(req))) return NextResponse.json({ ok: false, fehler: 'Nur der Inhaber.' }, { status: 403 });
  let b: { aktion?: unknown; id?: unknown };
  try { b = await jsonBegrenzt(req); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  if (b.aktion === 'erneut') {
    const id = String(b.id ?? '');
    if (!/^ab-[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ ok: false, fehler: 'id fehlt.' }, { status: 400 });
    let gab = false;
    for (const h of await absichtenHaushalte()) gab = (await absichtErneutVersuchen(h, id)) || gab;
    if (!gab) return NextResponse.json({ ok: false, fehler: 'Keine gescheiterte Absicht mit dieser Kennung.' }, { status: 404 });
  } else if (b.aktion !== 'fertigstellen') return NextResponse.json({ ok: false, fehler: 'aktion ist fertigstellen oder erneut.' }, { status: 400 });
  return NextResponse.json({ ok: true, ...(await offeneFertigstellen()) });
}
