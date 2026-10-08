// ─── WHOOP — Rückruf der Anmeldung (08.10.2026) ──────────────────────────────────────────────────────────────────────────
// WHOOP schickt den Browser mit ?code&state hierher zurück (Redirect-URL im WHOOP Developer Dashboard: `<MAKE_OS_ADRESSE>/api/whoop/rueckruf`
// bzw. WHOOP_RUECKRUF_URL). Gilt NUR für die Person der Sitzung, die die Anmeldung gestartet hat (der `state` gehört ihr). Danach im
// Hintergrund der Erstabgleich (90 Tage). Weiter zu /os/gesundheit?whoop=… — kein Token, kein Code, keine Adresse in der Weiterleitung.
// Die Middleware lässt genau diesen Pfad als Navigation von WHOOP (cross-site) zu (lib/zugang/cross-site.ts); die Sitzung gilt trotzdem.
import { NextResponse } from 'next/server';
import { verbindungAbschliessen, WhoopVerbindungsFehler } from '@/lib/whoop/verbindung';
import { whoopAbgleichen } from '@/lib/whoop/abgleich';
import { eigenePerson } from '@/lib/google/zugang';
import { NUR_SELBST_WHOOP } from '@/lib/whoop/zugang';
import { aussenAdresse } from '@/lib/innen';
import { alleSpeicher } from '@/lib/zugang/konten';
import { protokolliere, werAus } from '@/lib/store/aenderungsprotokoll';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const zurueck = (req: Request, status: string) => NextResponse.redirect(new URL(`/os/gesundheit?whoop=${status}#whoop`, aussenAdresse() ?? new URL(req.url).origin));

export async function GET(req: Request) {
  const z = await eigenePerson(req, false, NUR_SELBST_WHOOP);
  if (z instanceof NextResponse) return z;
  const q = new URL(req.url).searchParams;
  if (q.get('error')) return zurueck(req, 'abgebrochen');
  const code = q.get('code'), state = q.get('state');
  if (!code || !state) return zurueck(req, 'abgebrochen');
  try {
    const r = await verbindungAbschliessen(z.person, code, state, await alleSpeicher());
    await protokolliere('whoop', [{ liste: 'verbindung', op: 'neu', id: 'whoop' }], werAus(req)).catch(() => { /* nur Protokoll */ });
    void whoopAbgleichen(z.person, { voll: true }).catch(() => { /* Fehler steht im Stand; der Takt versucht es wieder */ });
    return zurueck(req, r.scopesFehlen.length ? 'scope-fehlt' : 'verbunden');
  } catch (e) {
    if (e instanceof WhoopVerbindungsFehler) return zurueck(req, e.code);
    return zurueck(req, 'fehler');
  }
}
