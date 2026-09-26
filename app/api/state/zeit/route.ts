// ─── MAKE OS — Zeit & Fokus ─────────────────────────────────────────────────
// GET  → das Bild der Person: heute und die letzten 7 Tage je Space und Bereich,
//        bewusste Fokus-Zeit, Fokus-Tage, die letzten Blöcke.
// POST { aktion: 'fokus', von, bis, schluessel, label } → ein bewusster Block ist zu Ende.
// Die laufende Messung kommt über die Anwesenheit (/api/state/anwesenheit).

import { NextResponse } from 'next/server';
import { personAus } from '@/lib/jarvis/raum';
import { fokusAbschliessen, zeitBildFuer } from '@/lib/zeitmessung/speicher';
import { bild } from '@/lib/zeitmessung/modell';
import { localDay } from '@/lib/zeit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const person = personAus(req);
  return NextResponse.json({ ok: true, bild: await zeitBildFuer(person) }, { headers: { 'Cache-Control': 'no-store' } });
}

const SCHLUESSEL = /^(privat|business|gemeinsam):[a-z0-9-]{1,40}$/;
const iso = (v: unknown): string | null => (typeof v === 'string' && Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : null);

export async function POST(req: Request) {
  let b: { aktion?: string; von?: unknown; bis?: unknown; schluessel?: unknown; label?: unknown };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  if (b.aktion !== 'fokus') return NextResponse.json({ ok: false, error: 'Unbekannte Aktion.' }, { status: 400 });
  const von = iso(b.von), bis = iso(b.bis) ?? new Date().toISOString();
  const schluessel = typeof b.schluessel === 'string' && SCHLUESSEL.test(b.schluessel) ? b.schluessel : null;
  if (!von || !schluessel) return NextResponse.json({ ok: false, error: 'von und schluessel nötig.' }, { status: 400 });
  if (Date.parse(bis) <= Date.parse(von)) return NextResponse.json({ ok: false, error: 'Ende liegt vor dem Anfang.' }, { status: 400 });
  const person = personAus(req);
  const d = await fokusAbschliessen(person, { von, bis, schluessel, label: typeof b.label === 'string' ? b.label : '' });
  return NextResponse.json({ ok: true, bild: bild(d, localDay()) }, { headers: { 'Cache-Control': 'no-store' } });
}
