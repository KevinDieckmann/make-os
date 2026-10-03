// ─── Gmail — ZOE-Entwurf für eine Antwort (03.10.2026) ───────────────────────
// POST { id, hinweis? } → { ok, draft, quellen } — nur ein VORSCHLAG; gesendet wird nur auf den Einzelklick (/api/gmail/senden).
// Nur die eigene Person (Sitzung), nur eine Mail aus dem eigenen Spiegel; eingeschränkte Personen (Art. 18) bekommen 409;
// Modell-Drossel (`modellSchranke`). Brain-Kontext: die Sicht der Person ohne private Notizen.
import { NextResponse } from 'next/server';
import { eigenePerson } from '@/lib/google/zugang';
import { gmailEntwurf, EntwurfFehler } from '@/lib/gmail/entwurf';
import { modellSchranke, zuGross, ZU_GROSS } from '@/lib/zugang/umfang';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const z = await eigenePerson(req, true);
  if (z instanceof NextResponse) return z;
  if (zuGross(req, 16 * 1024)) return ZU_GROSS(16 * 1024);
  const schranke = modellSchranke(req); if (schranke) return schranke;
  let b: { id?: unknown; hinweis?: unknown };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const id = typeof b.id === 'string' && /^[A-Za-z0-9]{6,40}$/.test(b.id) ? b.id : '';
  if (!id) return NextResponse.json({ ok: false, fehler: 'id fehlt.' }, { status: 400 });
  try {
    const r = await gmailEntwurf(z.person, id, typeof b.hinweis === 'string' ? b.hinweis : undefined);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    if (e instanceof EntwurfFehler) return NextResponse.json({ ok: false, fehler: e.message, ...(e.needsKey ? { needsKey: true } : {}) }, { status: e.status });
    return NextResponse.json({ ok: false, fehler: 'ZOE konnte gerade keinen Entwurf schreiben.' }, { status: 502 });
  }
}
