// ─── WhatsApp — Vorlagen des Business-Kontos (07.10.2026) ──────────────────────────────────────────────────────────────
// GET [?neu=1] → { ok, vorlagen: Vorlage[], at } — nur lesen (angelegt/genehmigt wird bei Meta im WhatsApp Manager), zwischengespeichert
// 1 Stunde (`neu=1` holt sofort). Nur die Person selbst mit Zugang zur Business-Nummer (`eigenePerson`; Dienstweg 403).
import { NextResponse } from 'next/server';
import { eigenePerson, NUR_EIGENE_POST } from '@/lib/google/zugang';
import { WhatsappFehler } from '@/lib/whatsapp/graph';
import { whatsappFuer } from '@/lib/whatsapp/server';
import { vorlagenLaden } from '@/lib/whatsapp/vorlagen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const z = await eigenePerson(req, false, NUR_EIGENE_POST);
  if (z instanceof NextResponse) return z;
  const k = await whatsappFuer(z.person);
  if (!k) return NextResponse.json({ ok: false, fehler: 'WhatsApp ist für dieses Konto nicht eingerichtet.' }, { status: 404 });
  try {
    const r = await vorlagenLaden(k, { neu: new URL(req.url).searchParams.get('neu') === '1' });
    return NextResponse.json({ ok: true, vorlagen: r.liste, at: r.at }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    if (e instanceof WhatsappFehler) return NextResponse.json({ ok: false, art: e.art, fehler: e.message, ...(e.erneuern ? { erneuern: true } : {}) }, { status: e.status });
    return NextResponse.json({ ok: false, fehler: 'Die Vorlagen ließen sich nicht laden.' }, { status: 502 });
  }
}
