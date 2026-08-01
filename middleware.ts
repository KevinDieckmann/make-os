// ─── MAKE OS — Zugangsschutz ────────────────────────────────────────────────
// Die App enthält Kevins komplettes Leben (Gesundheit, Rechtsstreit, Finanzen)
// und nutzt seinen Anthropic-Key. Der Dev-Server lauscht auf ALLEN Netzwerk-
// Schnittstellen — diese Schranke ist die einzige Tür.
//
// Gelernt aus dem Audit: dem Host-Header darf man NICHT trauen (jeder Client
// kann „Host: localhost" senden). Deshalb gilt der Schlüssel IMMER — auch am
// Mac. Der Starter öffnet den Browser einmal mit ?key=…, danach hält ein
// signiertes Cookie (HMAC, nie der Klartext-Schlüssel) 30 Tage.
//
// Wege hinein:
//   · Browser: einmal  http://localhost:3001/os?key=<MAKE_OS_KEY>  → Cookie.
//   · iPhone:  einmal  http://<mac-ip>:3001/os?key=<MAKE_OS_KEY>   → Cookie.
//   · Interne Server-Aufrufe (Tageslauf → eigene Routen): Header x-make-key.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const COOKIE = 'make-os-zutritt';

/** Signierte Cookie-Marke aus dem Schlüssel — der Klartext verlässt nie den Server. */
async function marke(schluessel: string): Promise<string> {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey('raw', enc.encode(schluessel), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, enc.encode('make-os-zutritt-v1'));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function verweigert(req: NextRequest): NextResponse {
  if (req.nextUrl.pathname.startsWith('/api/')) {
    return new NextResponse('MAKE OS ist privat.', { status: 403 });
  }
  // Für Seiten: kleine Eingabemaske statt nackter Fehlerseite.
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>MAKE OS · privat</title>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0B0E10;color:#E8ECEA;font-family:-apple-system,sans-serif">
<form method="get" style="text-align:center;padding:24px">
<div style="font-size:15px;letter-spacing:.2em;color:#21B5AA;margin-bottom:6px">MAKE OS</div>
<div style="font-size:13px;color:#96A8A2;margin-bottom:18px">Privat. Schlüssel aus .env.local (MAKE_OS_KEY):</div>
<input name="key" type="password" autofocus style="background:#14181B;border:1px solid #232A2D;border-radius:10px;color:#E8ECEA;padding:12px 14px;font-size:16px;width:240px;outline:none">
<button style="display:block;margin:14px auto 0;background:#21B5AA;color:#04110F;border:none;border-radius:10px;padding:11px 22px;font-size:14px;font-weight:700">Öffnen</button>
</form></body>`;
  return new NextResponse(html, { status: 403, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

export async function middleware(req: NextRequest) {
  const schluessel = process.env.MAKE_OS_KEY;
  // Ohne konfigurierten Schlüssel bleibt alles zu — lieber gesperrt als offen.
  if (!schluessel) return verweigert(req);

  // CSRF-Schutz: Schreibzugriffe aus fremden Browser-Kontexten abweisen.
  // (curl/Server senden keinen Origin — die laufen hier durch.)
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const origin = req.headers.get('origin');
    if (origin) {
      try {
        if (new URL(origin).host !== (req.headers.get('host') ?? '')) return verweigert(req);
      } catch { return verweigert(req); }
    }
  }

  // Interner Dienstweg: der Server ruft eigene Routen (Tageslauf-Kette).
  if (req.headers.get('x-make-key') === schluessel) return NextResponse.next();

  const m = await marke(schluessel);
  if (req.cookies.get(COOKIE)?.value === m) return NextResponse.next();

  // Erste Anmeldung: ?key=… → signiertes Cookie, Schlüssel aus der URL entfernen.
  if (req.nextUrl.searchParams.get('key') === schluessel) {
    const ziel = req.nextUrl.clone();
    ziel.searchParams.delete('key');
    const res = NextResponse.redirect(ziel);
    res.cookies.set(COOKIE, m, { httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 30 });
    return res;
  }

  return verweigert(req);
}

// Alles schützen. Frei bleiben nur Next-interne Assets (kompilierter Code,
// keine Daten) und die PWA-Dateien — sonst scheitert die Home-Bildschirm-
// Installation auf dem iPhone am Icon.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon-192.png|icon-512.png|apple-touch-icon.png).*)'],
};
