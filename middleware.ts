// ─── MAKE OS — Zugangsschutz ────────────────────────────────────────────────
// Seit 23.09.: echte Konten. Wer eine gültige Sitzung hat, kommt hinein — und
// die Middleware sagt jeder Route, wer das ist (Kopf x-make-user). Wer keine
// hat, landet auf /anmelden. Der Zugangsschlüssel MAKE_OS_KEY wird nur noch
// für zwei Dinge gebraucht: den internen Dienstweg (Arbeiter, Bote, Takt) und
// das Einrichten des allerersten Kontos.
//
// Gelernt aus dem Audit (weiter gültig): dem Host-Header nicht trauen, dem
// Origin bei Schreibzugriffen schon. Und: Köpfe, mit denen sich ein Client
// als jemand ausgeben könnte (x-make-user, x-make-person), werden hier
// gelöscht, bevor die Anfrage weitergeht — nur die Middleware setzt sie.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SITZUNG_COOKIE, WER_COOKIE, sitzungPruefen, sitzungsGeheimnis, gleich } from '@/lib/zugang/sitzung';
import { standGueltig } from '@/lib/zugang/stand-pruefung';

/** Ohne Sitzung erreichbar: die Anmeldung selbst und ihre Schnittstellen. */
const OFFEN = [/^\/anmelden$/, /^\/api\/konto\/(status|anmelden|einrichten|beitreten)$/];
// Der Browser meldet CSP-Verstöße ohne Sitzung und ohne verlässlichen Origin-Kopf (27.09.) — die Route
// nimmt nur Zähler an (Richtlinie, blockierte Quelle, Seite ohne Parameter) und begrenzt die Rate selbst.
const CSP_MELDEWEG = /^\/api\/hoi\/csp$/;

function adresseHost(): string | null {
  try { const a = process.env.MAKE_OS_ADRESSE?.trim(); return a ? new URL(a).host : null; } catch { return null; }
}

function verweigertApi(): NextResponse {
  return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });
}

export async function middleware(req: NextRequest) {
  const schluessel = process.env.MAKE_OS_KEY;
  // Ohne konfigurierten Schlüssel bleibt alles zu — lieber gesperrt als offen.
  if (!schluessel) return new NextResponse('MAKE OS ist nicht eingerichtet (MAKE_OS_KEY fehlt).', { status: 503 });
  // Auf dem Server ist das Sitzungsgeheimnis Pflicht (26.09.) — kein Rückfall auf den Dienstschlüssel.
  if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) return new NextResponse('MAKE OS ist nicht eingerichtet (SESSION_SECRET fehlt in .env).', { status: 503 });

  // CSRF-Schutz: Schreibzugriffe aus fremden Browser-Kontexten abweisen.
  if (req.method !== 'GET' && req.method !== 'HEAD' && !CSP_MELDEWEG.test(req.nextUrl.pathname)) {
    const origin = req.headers.get('origin');
    if (origin) {
      // Die eigene Adresse ist, was der Browser als Host schickt — hinter einem
      // Vorbau (Tailscale Serve, später Caddy auf Hetzner) steht sie in
      // X-Forwarded-Host, und fest eingetragen in MAKE_OS_ADRESSE. Ein Browser
      // kann X-Forwarded-Host bei einer fremden Seite nicht setzen, ohne an
      // der Vorabprüfung zu scheitern — der Schutz bleibt also dicht.
      // X-Forwarded-Host nur hinter dem eigenen Vorbau (Caddy) — direkt gesetzt wäre er frei wählbar (26.09.).
      const vorbau = process.env.NODE_ENV === 'production' || process.env.TRUST_PROXY === '1';
      const eigene = [req.headers.get('host'), vorbau ? req.headers.get('x-forwarded-host') : null, adresseHost()].filter(Boolean);
      try { if (!eigene.includes(new URL(origin).host)) return verweigertApi(); }
      catch { return verweigertApi(); }
    }
  }

  const pfad = req.nextUrl.pathname;
  const kopf = new Headers(req.headers);

  // Interner Dienstweg: Arbeiter, Bote, Takt. Sie dürfen die Person im Kopf
  // mitgeben (x-make-person) — sie handeln im Auftrag.
  const dienstKopf = req.headers.get('x-make-key');
  if (dienstKopf && gleich(dienstKopf, schluessel)) {
    return NextResponse.next({ request: { headers: kopf } });
  }
  // Alles andere darf sich NICHT selbst benennen.
  kopf.delete('x-make-user');
  kopf.delete('x-make-person');
  kopf.delete('x-make-hoi');

  // Eingeschränkter Schlüssel des Head of IT (27.09.): öffnet NUR /api/hoi/* — damit meldet der
  // GitHub-Läufer den Außenblick, ohne den Dienstschlüssel zu kennen. Für alles andere: 401.
  const hoiSchluessel = process.env.MAKE_OS_KEY_HOI?.trim();
  if (dienstKopf && hoiSchluessel && hoiSchluessel.length >= 24 && gleich(dienstKopf, hoiSchluessel)) {
    if (!pfad.startsWith('/api/hoi/')) return verweigertApi();
    kopf.set('x-make-hoi', '1');
    return NextResponse.next({ request: { headers: kopf } });
  }
  if (CSP_MELDEWEG.test(pfad) && req.method === 'POST') return NextResponse.next({ request: { headers: kopf } });

  // Eine Schnittstelle ist nie das Ziel einer Navigation von einer fremden Seite (26.09.): so kann kein
  // fremder Link mit dem Cookie im Gepäck eine GET-Route mit Wirkung auslösen.
  if (pfad.startsWith('/api/') && req.headers.get('sec-fetch-site') === 'cross-site' && req.headers.get('sec-fetch-mode') === 'navigate') return verweigertApi();

  if (OFFEN.some(r => r.test(pfad))) return NextResponse.next({ request: { headers: kopf } });

  const sitzung = await sitzungPruefen(sitzungsGeheimnis(), req.cookies.get(SITZUNG_COOKIE)?.value);
  // Passt der Zettel noch zum Passwort? (nach einem Wechsel: alle anderen Geräte binnen einer Minute raus)
  if (sitzung && await standGueltig(req, sitzung, schluessel)) {
    kopf.set('x-make-user', sitzung.speicher);
    return NextResponse.next({ request: { headers: kopf } });
  }

  if (pfad.startsWith('/api/')) return verweigertApi();
  const ziel = req.nextUrl.clone();
  ziel.pathname = '/anmelden';
  ziel.search = pfad && pfad !== '/' ? `?zu=${encodeURIComponent(pfad)}` : '';
  const weiter = NextResponse.redirect(ziel);
  // Sitzung ungültig (abgelaufen, Passwort anderswo geändert): den lesbaren Namens-Zettel mit wegräumen — sonst hielten die
  // Kontexte im Browser (Aufgaben, Kalender) die Person für angemeldet und fragten auf /anmelden mit 401 an (29.09.).
  if (req.cookies.get(WER_COOKIE)?.value) weiter.cookies.set(WER_COOKIE, '', { maxAge: 0, path: '/' });
  return weiter;
}

// Alles schützen. Frei bleiben nur Next-interne Assets (kompilierter Code,
// keine Daten) und die PWA-Dateien — sonst scheitert die Home-Bildschirm-
// Installation auf dem iPhone am Icon.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon-192.png|icon-512.png|apple-touch-icon.png).*)'],
};
