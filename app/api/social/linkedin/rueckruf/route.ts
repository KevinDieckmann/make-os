// ─── MAKE OS — Social: Rückruf der LinkedIn-Anmeldung (27.10.2026) ──────────────────────────────────────────────────────────────────
// LinkedIn schickt den Browser mit ?code&state hierher (Redirect-URL in der LinkedIn-App: `<MAKE_OS_ADRESSE>/api/social/linkedin/rueckruf`
// bzw. LINKEDIN_RUECKRUF_URL). Gilt NUR für die Person der Sitzung, die die Anmeldung gestartet hat (der `state` gehört ihr und nennt den
// Kanal). Bei einer Personenmarke nur die Person der Marke. Danach weiter zu Social — kein Token, kein Code in der Weiterleitung.
// Die Middleware lässt genau diesen Pfad als Navigation von LinkedIn (cross-site) zu (lib/zugang/cross-site.ts); die Sitzung gilt trotzdem.
import { NextResponse } from 'next/server';
import { eigenePerson } from '@/lib/google/zugang';
import { aussenAdresse } from '@/lib/innen';
import { protokolliere, werAus } from '@/lib/store/aenderungsprotokoll';
import { linkedinAbschliessen } from '@/lib/social/anbieter/linkedin';
import { verbindungSetzen } from '@/lib/social/verbindungen';
import { ladeSocial } from '@/lib/social/server';
import { socialFuerPerson } from '@/lib/social/daten';
import { WEG } from '@/lib/wege';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NUR_SELBST = { ok: false as const, fehler: 'Die LinkedIn-Verbindung legt nur die Person selbst an — angemeldet, nie über den Dienstweg.' };
const zurueck = (req: Request, status: string) => NextResponse.redirect(new URL(`${WEG.marketing('social')}&linkedin=${status}`, aussenAdresse() ?? new URL(req.url).origin));

export async function GET(req: Request) {
  const z = await eigenePerson(req, false, NUR_SELBST);
  if (z instanceof NextResponse) return z;
  const q = new URL(req.url).searchParams;
  if (q.get('error')) return zurueck(req, 'abgebrochen');
  const code = q.get('code'), state = q.get('state');
  if (!code || !state) return zurueck(req, 'abgebrochen');
  const r = await linkedinAbschliessen(z.person, code, state).catch(() => null);
  if (!r || !r.ok) return zurueck(req, r?.grund ?? 'fehler');
  const kanal = socialFuerPerson(await ladeSocial(), z.person).kanaele.find(k => k.id === r.kanalId);
  if (!kanal || (kanal.art === 'person' && kanal.person && kanal.person !== z.person)) return zurueck(req, 'kanal');
  const v = await verbindungSetzen({ kanalId: kanal.id, plattform: 'linkedin', anbieter: 'linkedin', konto: r.konto, verbundenVon: z.person, geheim: r.geheim });
  await protokolliere('social', [{ liste: 'verbindungen', op: 'neu', id: v.id }], werAus(req)).catch(() => {});
  return zurueck(req, 'verbunden');
}
