// ─── Datenschlüssel im laufenden Betrieb umstellen (29.09., Paket D-A #52) ─────
// Nur Dienstweg (deploy/datenschluessel-rotieren-live.sh ruft das im App-Container). Liest die Schlüsseldateien
// neu (aktiv = neuer Schlüssel, …_ALT = alter) und bringt Bestand für Bestand — in dessen Schreibsperre — in die
// v2-Hülle mit dem aktiven Schlüssel. Antwort: nur Zähler und Schlüssel-ID (nie ein Schlüssel).

import { NextResponse } from 'next/server';
import { istDienst } from '@/lib/zugang/dienst';
import { allesUmschluesseln } from '@/lib/store/umschluesseln';
import { schluesselNeuLaden, schluesselRing } from '@/lib/store/huelle.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!istDienst(req)) return NextResponse.json({ ok: false, fehler: 'Nur Dienstweg.' }, { status: 403 });
  let b: { nurLaden?: unknown };
  try { b = await req.json(); } catch { b = {}; }
  if (b.nurLaden === true) {
    // Nach dem Entfernen des alten Schlüssels: Ring neu lesen und zeigen, was noch drin ist.
    schluesselNeuLaden();
    const ring = schluesselRing();
    return NextResponse.json({ ok: !!ring.aktiv, aktivKid: ring.aktiv?.kid ?? null, ring: ring.alle.length });
  }
  try {
    const r = await allesUmschluesseln(true);
    return NextResponse.json({ ok: r.fehler.length === 0, ...r, fehler: r.fehler.slice(0, 50), fehlerAnzahl: r.fehler.length });
  } catch (e) {
    return NextResponse.json({ ok: false, fehler: [e instanceof Error ? e.message : String(e)] }, { status: 500 });
  }
}
