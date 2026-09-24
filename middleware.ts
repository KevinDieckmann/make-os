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
import { SITZUNG_COOKIE, sitzungPruefen, sitzungsGeheimnis } from '@/lib/zugang/sitzung';

/** Ohne Sitzung erreichbar: die Anmeldung selbst und ihre Schnittstellen. */
const OFFEN = [/^\/anmelden$/, /^\/api\/konto\/(status|anmelden|einrichten|beitreten)$/];

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

  // CSRF-Schutz: Schreibzugriffe aus fremden Browser-Kontexten abweisen.
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const origin = req.headers.get('origin');
    if (origin) {
      // Die eigene Adresse ist, was der Browser als Host schickt — hinter einem
      // Vorbau (Tailscale Serve, später Caddy auf Hetzner) steht sie in
      // X-Forwarded-Host, und fest eingetragen in MAKE_OS_ADRESSE. Ein Browser
      // kann X-Forwarded-Host bei einer fremden Seite nicht setzen, ohne an
      // der Vorabprüfung zu scheitern — der Schutz bleibt also dicht.
      const eigene = [req.headers.get('host'), req.headers.get('x-forwarded-host'), adresseHost()].filter(Boolean);
      try { if (!eigene.includes(new URL(origin).host)) return verweigertApi(); }
      catch { return verweigertApi(); }
    }
  }

  const pfad = req.nextUrl.pathname;
  const kopf = new Headers(req.headers);

  // Interner Dienstweg: Arbeiter, Bote, Takt. Sie dürfen die Person im Kopf
  // mitgeben (x-make-person) — sie handeln im Auftrag.
  if (req.headers.get('x-make-key') === schluessel) {
    return NextResponse.next({ request: { headers: kopf } });
  }
  // Alles andere darf sich NICHT selbst benennen.
  kopf.delete('x-make-user');
  kopf.delete('x-make-person');

  if (OFFEN.some(r => r.test(pfad))) return NextResponse.next({ request: { headers: kopf } });

  const sitzung = await sitzungPruefen(sitzungsGeheimnis(), req.cookies.get(SITZUNG_COOKIE)?.value);
  if (sitzung) {
    kopf.set('x-make-user', sitzung.speicher);
    return NextResponse.next({ request: { headers: kopf } });
  }

  if (pfad.startsWith('/api/')) return verweigertApi();
  const ziel = req.nextUrl.clone();
  ziel.pathname = '/anmelden';
  ziel.search = pfad && pfad !== '/' ? `?zu=${encodeURIComponent(pfad)}` : '';
  return NextResponse.redirect(ziel);
}

// Alles schützen. Frei bleiben nur Next-interne Assets (kompilierter Code,
// keine Daten) und die PWA-Dateien — sonst scheitert die Home-Bildschirm-
// Installation auf dem iPhone am Icon.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon-192.png|icon-512.png|apple-touch-icon.png).*)'],
};
