// ─── WHOOP — Status der EIGENEN Verbindung (08.10.2026) ──────────────────────────────────────────────────────────────────
// GET → { ok, konfiguriert, fehlt (nur Variablennamen), verbunden, konto (maskiert), seit, getrennt?, scopesFehlen, einwilligung,
//         abgleich: { vorMin, veraltet, fehler?, hinweis?, webhook }, zuletzt?: { tag, rec?, sleep?, strain? } }
// Nur die eigene Person (eigenePerson; Dienstweg 403); nie Tokens, nie die volle Adresse, nie die WHOOP-Kennung. `zuletzt` sind eigene
// Gesundheitswerte → Lese-Protokoll (Art. 9).
import { NextResponse } from 'next/server';
import { whoopStatus } from '@/lib/whoop/verbindung';
import { ladeWhoopStand, whoopAlter } from '@/lib/whoop/abgleich';
import { tageswerte } from '@/lib/whoop/abbilden';
import { eigenePerson } from '@/lib/google/zugang';
import { NUR_SELBST_WHOOP } from '@/lib/whoop/zugang';
import { gesundheitVerarbeitungErlaubt } from '@/lib/datenschutz/gesundheit-einwilligung';
import { leseZugriff } from '@/lib/store/leseprotokoll';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const z = await eigenePerson(req, false, NUR_SELBST_WHOOP);
  if (z instanceof NextResponse) return z;
  const s = await whoopStatus(z.person);
  const einwilligung = await gesundheitVerarbeitungErlaubt(z.person);
  const stand = s.verbunden ? await ladeWhoopStand(z.person).catch(() => null) : null;
  const a = whoopAlter(stand);
  let zuletzt: { tag: string; rec?: number; sleep?: number; strain?: number } | undefined;
  if (stand) {
    const w = tageswerte(stand);
    const tag = Object.keys(w).sort().pop();
    if (tag) { zuletzt = { tag, ...w[tag] }; delete (zuletzt as { hrv?: number }).hrv; delete (zuletzt as { rhr?: number }).rhr; }
    leseZugriff(req, 'gesundheit', { betroffen: z.person }); // Lese-Protokoll (Art. 9)
  }
  return NextResponse.json({
    ok: true, ...s, einwilligung,
    abgleich: { vorMin: a.vorMin, veraltet: a.veraltet, webhook: a.webhook, ...(a.fehler ? { fehler: a.fehler } : {}), ...(stand?.hinweis ? { hinweis: stand.hinweis } : {}) },
    ...(zuletzt ? { zuletzt } : {}),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
