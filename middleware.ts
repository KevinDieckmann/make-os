// ─── MAKE OS — Zugangsschutz ────────────────────────────────────────────────
// Seit 23.09.: echte Konten. Wer eine gültige Sitzung hat, kommt hinein — und
// die Middleware sagt jeder Route, wer das ist (Kopf x-make-user). Wer keine
// hat, landet auf /anmelden. Der Zugangsschlüssel MAKE_OS_KEY gilt seit 05.10. nur
// noch für den internen Dienstweg (Arbeiter, Bote, Takt — nur von innen, lib/zugang/intern.ts)
// und das Einrichten des allerersten Kontos.
//
// Gelernt aus dem Audit (weiter gültig): dem Host-Header nicht trauen, dem
// Origin bei Schreibzugriffen schon. Und: Köpfe, mit denen sich ein Client
// als jemand ausgeben könnte (x-make-user, x-make-person), werden hier
// gelöscht, bevor die Anfrage weitergeht — nur die Middleware setzt sie.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SITZUNG_COOKIE, WER_COOKIE, sitzungPruefen, sitzungsGeheimnis, gleich } from '@/lib/zugang/sitzung';
import { standGueltig } from '@/lib/zugang/stand-pruefung';
import { crossSiteVerboten } from '@/lib/zugang/cross-site';
import { anfrageIntern, zuliefererSchluessel, ZULIEFERUNG, EINGESCHRAENKT_MIN } from '@/lib/zugang/intern';

/** Ohne Sitzung erreichbar: die Anmeldung selbst und ihre Schnittstellen. */
const OFFEN = [/^\/anmelden$/, /^\/api\/konto\/(status|anmelden|einrichten|beitreten)$/];
// Der Browser meldet CSP-Verstöße ohne Sitzung und ohne verlässlichen Origin-Kopf (27.09.) — die Route
// nimmt nur Zähler an (Richtlinie, blockierte Quelle, Seite ohne Parameter) und begrenzt die Rate selbst.
const CSP_MELDEWEG = /^\/api\/hoi\/csp$/;
// Google (03.10.): Push-Meldungen des Kalenders (events.watch) kommen von Googles Servern — ohne Sitzung, ohne Origin. Die Route
// prüft Kanal-Kennung + Token + Ressourcen-ID selbst und liefert nie Daten (lib/kalender/google/kanal.ts). Nur POST.
// Gmail (03.10.): die Pub/Sub-Push-Subscription ruft `POST /api/google/gmail/meldung` — ebenfalls ohne Sitzung und ohne Origin; die Route prüft
// das OIDC-Token von Google (Signatur, Aussteller, Audience, Dienstkonto) selbst und liefert nie Daten (lib/gmail/meldung.ts).
const GOOGLE_MELDEWEG = /^\/api\/(kalender\/google|google\/gmail)\/meldung$/;
// Öffentliche Buchungsseite (29.09., K4): NUR diese Pfade sind ohne Sitzung offen — die Seite einer Buchungsadresse,
// ihre Status-Seite und genau deren zwei Schnittstellen. Adresse = lesbarer Vorsatz + 96 Bit Zufall (lib/kalender/buchung.ts
// `slugOk`); alles andere (auch /buchen ohne Adresse oder tiefere Pfade) bleibt zu. Die Routen drosseln selbst.
const BUCHUNG_OFFEN = [/^\/buchen\/[a-z0-9-]{1,40}-[a-f0-9]{24}(\/status)?$/, /^\/api\/buchung\/[a-z0-9-]{1,40}-[a-f0-9]{24}(\/status)?$/];

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
  if (req.method !== 'GET' && req.method !== 'HEAD' && !CSP_MELDEWEG.test(req.nextUrl.pathname) && !(GOOGLE_MELDEWEG.test(req.nextUrl.pathname) && req.method === 'POST')) {
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

  // Alles, was nicht der interne Dienstweg ist, darf sich NICHT selbst benennen.
  const ohneSelbstbenennung = () => { for (const k of ['x-make-user', 'x-make-person', 'x-make-hoi', 'x-make-zulieferer']) kopf.delete(k); };

  // Interner Dienstweg: Arbeiter, Bote, Takt. Sie dürfen die Person im Kopf
  // mitgeben (x-make-person) — sie handeln im Auftrag.
  // Seit 05.10. NUR von innen (Docker-Netz, Loopback — lib/zugang/intern.ts): über Caddy ist der Dienstschlüssel kein
  // Generalschlüssel mehr. Einzige Ausnahme (Übergang): der Mac-Zulieferer, solange MAKE_OS_ZULIEFERER_KEY fehlt.
  const dienstKopf = req.headers.get('x-make-key');
  if (dienstKopf && gleich(dienstKopf, schluessel)) {
    if (anfrageIntern(req.headers)) return NextResponse.next({ request: { headers: kopf } });
    if (req.method === 'POST' && ZULIEFERUNG.test(pfad) && !zuliefererSchluessel()) {
      ohneSelbstbenennung();
      kopf.delete('x-make-key');
      kopf.set('x-make-zulieferer', 'alt');
      return NextResponse.next({ request: { headers: kopf } });
    }
    return verweigertApi();
  }
  ohneSelbstbenennung();

  // Eingeschränkter Schlüssel des Head of IT (27.09.): öffnet NUR /api/hoi/* — damit meldet der
  // GitHub-Läufer den Außenblick, ohne den Dienstschlüssel zu kennen. Für alles andere: 401.
  const hoiSchluessel = process.env.MAKE_OS_KEY_HOI?.trim();
  if (dienstKopf && hoiSchluessel && hoiSchluessel.length >= EINGESCHRAENKT_MIN && gleich(dienstKopf, hoiSchluessel)) {
    if (!pfad.startsWith('/api/hoi/')) return verweigertApi();
    kopf.set('x-make-hoi', '1');
    return NextResponse.next({ request: { headers: kopf } });
  }
  // Eigener Schlüssel des Mac-Zulieferers (05.10., Vorbild HOI): öffnet NUR die Zulieferung (POST), nie den Dienstweg.
  const zSchluessel = zuliefererSchluessel();
  if (dienstKopf && zSchluessel && gleich(dienstKopf, zSchluessel)) {
    if (req.method !== 'POST' || !ZULIEFERUNG.test(pfad)) return verweigertApi();
    kopf.delete('x-make-key');
    kopf.set('x-make-zulieferer', '1');
    return NextResponse.next({ request: { headers: kopf } });
  }
  if (CSP_MELDEWEG.test(pfad) && req.method === 'POST') return NextResponse.next({ request: { headers: kopf } });
  if (GOOGLE_MELDEWEG.test(pfad) && req.method === 'POST') return NextResponse.next({ request: { headers: kopf } });

  // Eine Schnittstelle ist nie das Ziel einer Navigation von einer fremden Seite (26.09.): so kann kein
  // fremder Link mit dem Cookie im Gepäck eine GET-Route mit Wirkung auslösen.
  // Einzige Ausnahme: der Rückruf der Google-Anmeldung (lib/zugang/cross-site.ts).
  if (crossSiteVerboten(pfad, req.headers)) return verweigertApi();

  if (OFFEN.some(r => r.test(pfad))) return NextResponse.next({ request: { headers: kopf } });
  // Öffentliche Buchung: nie als jemand (Köpfe oben gelöscht), auch nicht mit Sitzung — die Routen handeln für niemanden.
  if (BUCHUNG_OFFEN.some(r => r.test(pfad))) return NextResponse.next({ request: { headers: kopf } });

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
