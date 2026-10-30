// ─── Newsletter-Anmeldung über die Website — die öffentliche Schnittstelle (30.10., Branch `newsletter-anmeldung`) ─────────────────────
// OHNE Sitzung erreichbar (middleware.ts `NEWSLETTER_OFFEN`: nur /newsletter und POST /api/newsletter). Handelt nie als Person.
// POST { aktion: 'anmelden', email, vorname?, einwilligung: true, fassung, stempel, webseite (Honigtopf, leer) }
//        → IMMER dieselbe Antwort { ok: true, text } — egal ob die Adresse bekannt, gesperrt, eingeschränkt oder schon angemeldet ist; die Arbeit
//          (Zeile, Token, Bestätigungsmail) läuft NACH der Antwort (lib/newsletter/server.ts `anmeldungVerarbeiten`), damit auch die Zeit nichts verrät.
// POST { aktion: 'bestaetigen', token }  → { ok: true, text } bzw. EIN neutraler Fehler (unbekannt, benutzt, abgelaufen).
// Kommt AUS: ohne Einschalten, Absender-Postfach, Verantwortlichen oder Adresse der Website → 404 für jede Aktion.
// Schutz: Drossel je Netz (anmelden knapp, falsche Tokens wie Fehlversuche), Honigtopf + Mindestzeit mit DEMSELBEN Text (verrät nicht, was
// auffiel), Formular-Stempel signiert, Körper ≤ 4 KB (413), Fassung des Einwilligungstexts muss zur Seite passen.

import { NextResponse } from 'next/server';
import { pruefe, fehlschlag, adresseNetz } from '@/lib/zugang/drossel';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { ausfuellZeitOk } from '@/lib/kalender/buchung';
import { emailSauber, vornameSauber, ANMELDUNG_TEXT, BESTAETIGT_TEXT, LINK_UNGUELTIG } from '@/lib/newsletter/regeln';
import { stempelZeit } from '@/lib/newsletter/speicher';
import { anmeldungVerarbeiten, bestaetigen, newsletterBereit, nachDerAntwort } from '@/lib/newsletter/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 4 * 1024;
const KOPF = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };
const antwort = (body: Record<string, unknown>, status = 200, extra: Record<string, string> = {}) => NextResponse.json(body, { status, headers: { ...KOPF, ...extra } });
const NICHT_DA = { ok: false, fehler: 'Die Anmeldung gibt es hier gerade nicht.' };
/** Honigtopf und zu schnelles/zu altes/gefälschtes Formular: DERSELBE Text (wie beim Check) — verrät nicht, was auffiel. */
const NICHT_ANGENOMMEN = { ok: false, fehler: 'Das hat leider nicht geklappt. Bitte laden Sie die Seite neu und versuchen Sie es noch einmal.' };
/** Anmeldungen je Netz und Viertelstunde frei, danach wächst die Wartezeit. */
const ANMELDEN_FREI = 8;
/** Bestätigungen je Netz und Viertelstunde frei (ein falsches Token zählt wie ein Fehlversuch). */
const BESTAETIGEN_FREI = 20;

function gedrosselt(schluessel: string) {
  const p = pruefe(schluessel);
  return p.erlaubt ? null : antwort({ ok: false, fehler: `Zu viele Versuche auf einmal — bitte in ${Math.max(1, Math.ceil(p.warteSek / 60))} Min. noch einmal.` }, 429, { 'Retry-After': String(p.warteSek) });
}

export async function POST(req: Request) {
  const netz = adresseNetz(req);
  const bereit = await newsletterBereit();
  if (!bereit) return antwort(NICHT_DA, 404);
  let b: Record<string, unknown>;
  try { b = await jsonBegrenzt(req, MAX_BYTES); } catch (x) { return jsonZuGross(x) ?? antwort({ ok: false, fehler: 'Kein JSON.' }, 400); }

  if (b.aktion === 'anmelden') {
    const g = gedrosselt(`newsletter:${netz}`); if (g) return g;
    fehlschlag(`newsletter:${netz}`, Date.now(), ANMELDEN_FREI);
    if (typeof b.webseite === 'string' && b.webseite.trim()) return antwort(NICHT_ANGENOMMEN, 400);
    const geladen = stempelZeit(b.stempel);
    if (geladen === null || !ausfuellZeitOk(geladen, Date.now())) return antwort(NICHT_ANGENOMMEN, 400);
    if (b.einwilligung !== true) return antwort({ ok: false, fehler: 'Bitte setzen Sie das Häkchen — ohne Ihre Einwilligung können wir Ihnen den Newsletter nicht schicken.' }, 400);
    if (b.fassung !== bereit.fassung) return antwort({ ok: false, fehler: 'Der Text der Einwilligung hat sich geändert. Bitte laden Sie die Seite neu und lesen Sie ihn noch einmal.' }, 409);
    const email = emailSauber(b.email);
    if (!email) return antwort({ ok: false, fehler: 'Bitte eine gültige E-Mail-Adresse angeben.' }, 400);
    const vorname = vornameSauber(b.vorname);
    if (vorname === null) return antwort({ ok: false, fehler: 'Bitte im Vornamen nur Buchstaben verwenden (höchstens 60).' }, 400);
    nachDerAntwort(() => anmeldungVerarbeiten({ email, vorname }, bereit));
    return antwort({ ok: true, text: ANMELDUNG_TEXT });
  }

  if (b.aktion === 'bestaetigen') {
    const g = gedrosselt(`newsletter-token:${netz}`); if (g) return g;
    const r = await bestaetigen(b.token);
    if (!r.ok) { fehlschlag(`newsletter-token:${netz}`, Date.now(), BESTAETIGEN_FREI); return antwort({ ok: false, fehler: LINK_UNGUELTIG }, 404); }
    return antwort({ ok: true, text: BESTAETIGT_TEXT });
  }

  return antwort({ ok: false, fehler: 'Unbekannte Aktion.' }, 400);
}
