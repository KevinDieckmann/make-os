// ─── Google — Rückruf der Anmeldung (03.10.2026) ─────────────────────────────
// Google schickt den Browser mit ?code&state hierher zurück (Weiterleitungs-URI in der Google Cloud Console:
// `<MAKE_OS_ADRESSE>/api/google/rueckruf`). Es gilt NUR für die Person der Sitzung, die die Anmeldung gestartet hat:
// der `state` (einmalig, 15 Min.) gehört ihr, der PKCE-Verifier liegt serverseitig. Danach (Funktion „kalender“):
// Kalender wählen (Hauptkalender) und im Hintergrund die erste Lesung. Weiter zu /os/kalender?google=… — kein Token,
// kein Code, keine Adresse in der Weiterleitung.
// Gmail (03.10.): wer NUR Gmail ergänzt hat, kommt zurück in die Inbox (`/os/inbox?google=…`); eingerichtet wird nur, was
// DIESE Anmeldung neu wollte (`angefordert`) — ein Gmail-Zusatz setzt den gewählten Kalender nie zurück.
// Die Middleware lässt genau diesen Pfad als Navigation von Google (cross-site) zu; die Sitzung gilt trotzdem.
// Weitere Kalender-Konten (30.10., lib/google/zusatz.ts): DERSELBE Pfad — gehört der `state` einer Anmeldung eines weiteren Kontos
// (`istZusatzState`), läuft nur `zusatzAbschliessen` (nur lesen, eigene Bestände) und es geht zurück nach /os/kalender?google-zusatz=…;
// sonst unverändert der Weg der Haupt-Verbindung.
import { NextResponse } from 'next/server';
import { verbindungAbschliessen, GoogleVerbindungsFehler } from '@/lib/google/verbindung';
import { eigenePerson } from '@/lib/google/zugang';
import { aussenAdresse } from '@/lib/innen';
import { googleKalenderWaehlen, googleAbgleichen } from '@/lib/kalender/google/abgleich';
import { gmailEinrichten } from '@/lib/gmail/abgleich';
import { protokolliere, werAus } from '@/lib/store/aenderungsprotokoll';
import { istZusatzState, zusatzAbschliessen, ZusatzFehler } from '@/lib/google/zusatz';
import { zusatzAbgleichen } from '@/lib/kalender/google/zusatz';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const zurueck = (req: Request, status: string, seite = '/os/kalender') => NextResponse.redirect(new URL(`${seite}?google=${status}`, aussenAdresse() ?? new URL(req.url).origin));

export async function GET(req: Request) {
  const z = await eigenePerson(req);
  if (z instanceof NextResponse) return z;
  const q = new URL(req.url).searchParams;
  if (await istZusatzState(q.get('state'))) return zusatzRueckruf(req, z.person, q);
  if (q.get('error')) return zurueck(req, 'abgebrochen');
  const code = q.get('code'), state = q.get('state');
  if (!code || !state) return zurueck(req, 'abgebrochen');
  try {
    const r = await verbindungAbschliessen(z.person, code, state);
    await protokolliere('kalender', [{ liste: 'google', op: 'neu', id: 'verbindung', felder: r.funktionen }], werAus(req)).catch(() => { /* nur Protokoll */ });
    const nurGmail = r.angefordert.includes('gmail') && !r.angefordert.includes('kalender');
    const seite = nurGmail ? '/os/inbox' : '/os/kalender';
    if (r.fehlendeScopes.length) return zurueck(req, 'scope-fehlt', seite);
    if (r.angefordert.includes('kalender')) {
      await googleKalenderWaehlen(z.person, 'primary');
      void googleAbgleichen(z.person).catch(() => { /* Fehler steht im Stand; der Takt versucht es wieder */ });
    }
    if (r.angefordert.includes('gmail')) void gmailEinrichten(z.person).catch(() => { /* Fehler steht im Stand; der Takt versucht es wieder */ });
    return zurueck(req, 'verbunden', seite);
  } catch (e) {
    if (e instanceof GoogleVerbindungsFehler) return zurueck(req, e.code);
    return zurueck(req, 'fehler');
  }
}

/** Rückruf eines weiteren Kalender-Kontos (nur lesen) — eigene Rückkehr-Adresse, nie Code/Token/Adresse darin. */
async function zusatzRueckruf(req: Request, person: string, q: URLSearchParams): Promise<NextResponse> {
  const weg = (status: string) => NextResponse.redirect(new URL(`/os/kalender?google-zusatz=${status}`, aussenAdresse() ?? new URL(req.url).origin));
  const code = q.get('code'), state = q.get('state');
  if (q.get('error') || !code || !state) return weg('abgebrochen');
  try {
    const r = await zusatzAbschliessen(person, code, state);
    await protokolliere('kalender', [{ liste: 'google-zusatz', op: r.neu ? 'neu' : 'geaendert', id: r.konto, felder: ['verbindung'] }], werAus(req)).catch(() => { /* nur Protokoll */ });
    void zusatzAbgleichen(person, { konto: r.konto, voll: true }).catch(() => { /* Fehler steht im Spiegel; der Takt versucht es wieder */ });
    return weg('verbunden');
  } catch (e) {
    return weg(e instanceof ZusatzFehler ? e.code : 'fehler');
  }
}
