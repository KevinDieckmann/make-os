// ─── Google — Rückruf der Anmeldung (03.10.2026) ─────────────────────────────
// Google schickt den Browser mit ?code&state hierher zurück (Weiterleitungs-URI in der Google Cloud Console:
// `<MAKE_OS_ADRESSE>/api/google/rueckruf`). Es gilt NUR für die Person der Sitzung, die die Anmeldung gestartet hat:
// der `state` (einmalig, 15 Min.) gehört ihr, der PKCE-Verifier liegt serverseitig. Danach (Funktion „kalender“):
// Kalender wählen (Hauptkalender) und im Hintergrund die erste Lesung. Weiter zu /os/kalender?google=… — kein Token,
// kein Code, keine Adresse in der Weiterleitung.
// Die Middleware lässt genau diesen Pfad als Navigation von Google (cross-site) zu; die Sitzung gilt trotzdem.
import { NextResponse } from 'next/server';
import { verbindungAbschliessen, GoogleVerbindungsFehler } from '@/lib/google/verbindung';
import { eigenePerson } from '@/lib/google/zugang';
import { aussenAdresse } from '@/lib/innen';
import { googleKalenderWaehlen, googleAbgleichen } from '@/lib/kalender/google/abgleich';
import { protokolliere, werAus } from '@/lib/store/aenderungsprotokoll';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const zurueck = (req: Request, status: string) => NextResponse.redirect(new URL(`/os/kalender?google=${status}`, aussenAdresse() ?? new URL(req.url).origin));

export async function GET(req: Request) {
  const z = await eigenePerson(req);
  if (z instanceof NextResponse) return z;
  const q = new URL(req.url).searchParams;
  if (q.get('error')) return zurueck(req, 'abgebrochen');
  const code = q.get('code'), state = q.get('state');
  if (!code || !state) return zurueck(req, 'abgebrochen');
  try {
    const r = await verbindungAbschliessen(z.person, code, state);
    await protokolliere('kalender', [{ liste: 'google', op: 'neu', id: 'verbindung', felder: r.funktionen }], werAus(req)).catch(() => { /* nur Protokoll */ });
    if (r.fehlendeScopes.length) return zurueck(req, 'scope-fehlt');
    if (r.funktionen.includes('kalender')) {
      await googleKalenderWaehlen(z.person, 'primary');
      void googleAbgleichen(z.person).catch(() => { /* Fehler steht im Stand; der Takt versucht es wieder */ });
    }
    return zurueck(req, 'verbunden');
  } catch (e) {
    if (e instanceof GoogleVerbindungsFehler) return zurueck(req, e.code);
    return zurueck(req, 'fehler');
  }
}
