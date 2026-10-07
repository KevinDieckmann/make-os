// ─── Inbox 2 — ZOE-Entwurf für eine Antwort, jede Quelle (06.10.2026; vorher /api/gmail/entwurf) ───────────────────
// POST { gespraech, hinweis? } → { ok, draft, quellen, ki } — nur ein VORSCHLAG; gesendet wird nur auf den Einzelklick (/api/inbox/senden).
// Nur die eigene Person (Sitzung), nur ein Gespräch aus den eigenen Spiegeln; eingeschränkte Personen (Art. 18) → 409; Modell-Drossel
// (`modellSchranke`). Brain-Kontext: die Sicht der Person ohne private Notizen. KI-VO Art. 50: `ki` kennzeichnet den Text.
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { NextResponse } from 'next/server';
import { eigenePerson, NUR_EIGENE_POST } from '@/lib/google/zugang';
import { inboxEntwurf, EntwurfFehler } from '@/lib/inbox/entwurf';
import { istGespraechId } from '@/lib/inbox/strom';
import { modellSchranke, zuGross, ZU_GROSS } from '@/lib/zugang/umfang';
import { kiKennzeichen } from '@/lib/datenschutz/ki-kennzeichnung';
import { kiAus } from '@/lib/datenschutz/ki-lauf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const z = await eigenePerson(req, true, NUR_EIGENE_POST);
  if (z instanceof NextResponse) return z;
  if (zuGross(req, 16 * 1024)) return ZU_GROSS(16 * 1024);
  const schranke = modellSchranke(req); if (schranke) return schranke;
  let b: { gespraech?: unknown; hinweis?: unknown };
  try { b = await jsonBegrenzt(req, 16 * 1024); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  if (!istGespraechId(b.gespraech)) return NextResponse.json({ ok: false, fehler: 'gespraech fehlt.' }, { status: 400 });
  try {
    const r = await inboxEntwurf(z.person, b.gespraech, typeof b.hinweis === 'string' ? b.hinweis : undefined, kiAus(req, ['postfach', 'brain', 'crm'], { anzahl: 1 }));
    return NextResponse.json({ ok: true, ...r, ki: kiKennzeichen() });
  } catch (e) {
    if (e instanceof EntwurfFehler) return NextResponse.json({ ok: false, fehler: e.message, ...(e.needsKey ? { needsKey: true } : {}) }, { status: e.status });
    return NextResponse.json({ ok: false, fehler: 'ZOE konnte gerade keinen Entwurf schreiben.' }, { status: 502 });
  }
}
