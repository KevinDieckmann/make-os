// ─── CRM — Dubletten ────────────────────────────────────────────────────────
// GET  → Paare mit gleichem Namen und zweitem gemeinsamen Merkmal
// POST { behalten, weg } → zusammenführen (Verlauf, Einwilligungen, Sperre,
//      Verweise in Chancen/Mandaten/Events). Bewusste Handlung, einzeln.

import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { personAus } from '@/lib/jarvis/raum';
import { anzeigename, type Kontakt } from '@/lib/make-one/crm';
import { aendereCrm } from '@/lib/crm/speicher';
import { dubletten, zusammenfuehren, verweiseUmbiegen } from '@/lib/crm/dubletten';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const k = (await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];
  return NextResponse.json({ ok: true, paare: dubletten(k).map(([a, b]) => ({ a: { id: a.id, name: anzeigename(a), email: a.email, firma: a.firma, verlauf: a.aktivitaeten?.length ?? 0 }, b: { id: b.id, name: anzeigename(b), email: b.email, firma: b.firma, verlauf: b.aktivitaeten?.length ?? 0 } })) });
}

export async function POST(req: Request) {
  let body: { behalten?: string; weg?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  if (!body.behalten || !body.weg || body.behalten === body.weg) return NextResponse.json({ ok: false, fehler: 'behalten und weg nötig.' }, { status: 400 });
  const person = personAus(req);
  let ergebnis: Kontakt | null = null;
  await updateJson<{ kontakte: Kontakt[] }>('kontakte', cur => {
    const f = cur ?? { kontakte: [] };
    const a = f.kontakte.find(x => x.id === body.behalten), b = f.kontakte.find(x => x.id === body.weg);
    if (!a || !b) return f;
    ergebnis = zusammenfuehren(a, b, person, new Date().toISOString());
    return { ...f, kontakte: f.kontakte.filter(x => x.id !== b.id).map(x => (x.id === a.id ? ergebnis! : x)) };
  });
  if (!ergebnis) return NextResponse.json({ ok: false, fehler: 'Kontakt nicht gefunden.' }, { status: 404 });
  await aendereCrm(c => verweiseUmbiegen(c, body.weg!, body.behalten!));
  return NextResponse.json({ ok: true, kontakt: ergebnis });
}
