// Build-Kennung (29.09., A2 — lib/bau/kennung.ts): EINMAL je Bau erzeugt und über die Umgebung an die Bau-Arbeiter
// vererbt (die laden diese Datei erneut — ohne `||=` bekäme jeder eine eigene). `env` setzt sie beim Bauen wörtlich in
// Browser- und Server-Code ein; alte Tabs schicken damit eine fremde Kennung und bekommen „bitte neu laden“.
process.env.MAKE_OS_BAU ||= `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: { NEXT_PUBLIC_MAKE_BAU: process.env.MAKE_OS_BAU },
  // 25.09.: start.sh baut den schnellen Produktionsmodus nach .next-prod —
  // getrennt vom Entwicklungsmodus (.next), damit beide sich nie stören.
  distDir: process.env.MAKE_OS_DIST || '.next',
  // Nicht verraten, womit gebaut ist (25.09., Härtung).
  poweredByHeader: false,
  // Sicherheits-Kopfzeilen aus der App selbst (26.09.) — gelten auch lokal und über Tailscale, nicht nur
  // hinter Caddy. Die Content-Security-Policy nur im Produktionsbau (der Entwicklungsmodus braucht eval).
  // Der Altbestand /finanz-dashboard.html lädt Firebase von außen — er bekommt keine CSP.
  async headers() {
    const basis = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(), payment=(), usb=()' },
    ];
    const csp = process.env.NODE_ENV === 'production'
      ? [{ key: 'Content-Security-Policy', value: [
          "default-src 'self'", "script-src 'self' 'unsafe-inline'", "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob:", "font-src 'self' data:", "connect-src 'self'", "worker-src 'self' blob:",
          "media-src 'self' blob:", "frame-src 'self'", "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'", "object-src 'none'",
          // Verstöße gehen an den Head of IT (27.09.): alter Weg (report-uri) und neuer (report-to) — der Browser nimmt, was er kann.
          'report-uri /api/hoi/csp', 'report-to csp',
        ].join('; ') }, { key: 'Reporting-Endpoints', value: 'csp="/api/hoi/csp"' }]
      : [];
    // Öffentliche Buchungsseite (29.09., K4): strengere Richtlinie — kein Einbetten, keine Rahmen, keine Worker, keine
    // Kamera/Mikrofon, keine Referrer (die Status-Adresse trägt das Token im Fragment), nicht indexieren, nicht zwischenspeichern.
    // Steht NACH der allgemeinen Regel: bei gleichem Kopf gewinnt der spätere Eintrag.
    const buchung = [
      { key: 'Referrer-Policy', value: 'no-referrer' },
      { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
      { key: 'Cache-Control', value: 'no-store' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
      ...(process.env.NODE_ENV === 'production' ? [{ key: 'Content-Security-Policy', value: [
        "default-src 'self'", "script-src 'self' 'unsafe-inline'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data:", "font-src 'self' data:",
        "connect-src 'self'", "worker-src 'none'", "media-src 'none'", "frame-src 'none'", "frame-ancestors 'none'", "base-uri 'none'", "form-action 'self'", "object-src 'none'",
        'report-uri /api/hoi/csp', 'report-to csp',
      ].join('; ') }] : []),
    ];
    return [
      { source: '/finanz-dashboard.html', headers: basis.filter(h => h.key !== 'X-Frame-Options').concat([{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }]) },
      { source: '/((?!finanz-dashboard\\.html).*)', headers: [...basis, ...csp] },
      { source: '/buchen/:pfad*', headers: buchung },
      { source: '/api/buchung/:pfad*', headers: buchung },
    ];
  },
  // Gesundheit ist seit 23.09. EINE Seite mit vier Segmenten. Die alten
  // Adressen bleiben gültig — Lesezeichen und ZOE-Verweise landen richtig.
  async redirects() {
    return [
      { source: '/os/performance', destination: '/os/wachstum', permanent: false },
      // 25.09.: „Brain“ heißt in der Leiste so, die Seite liegt unter /os/wissen.
      { source: '/os/brain', destination: '/os/wissen', permanent: false },
      // '/os/uebersicht' ist seit 26.09. wieder eine echte Seite (Übersicht je Space) — die alte Weiterleitung nach Home ist weg.
      { source: '/os/start', destination: '/os', permanent: false },
      // 26.09.: die Gesundheits-Säule IST der Gesundheits-Index; das Journal (/os/journal) ist wieder eine eigene Seite —
      // dort stehen Energie, Stress und die Flags, aus denen der Index rechnet.
      { source: '/os/saeule/health', destination: '/os/gesundheit?s=index', permanent: false },
      { source: '/os/saeule/social', destination: '/os/familie', permanent: false },
      // 24.09.: eine Kartei im CRM statt Netzwerk + Kontakte + Kunden
      { source: '/os/netzwerk', destination: '/os/crm?s=kontakte', permanent: false },
      { source: '/os/kunden', destination: '/os/crm?s=kunden', permanent: false },
      { source: '/os/ernaehrung', destination: '/os/gesundheit?s=ernaehrung', permanent: false },
      { source: '/os/energie', destination: '/os/gesundheit?s=koerper', permanent: false },
      // 26.09.: der alte Wochen-Rhythmus lebt im Wochenplaner (nicht mehr unter Gesundheit).
      { source: '/os/woche', destination: '/os/kalender?modus=planen', permanent: false },
      // 29.09. (K5): das Alt-Dashboard /calendar (Beispieldaten) ist weg — Lesezeichen landen im Kalender.
      { source: '/calendar', destination: '/os/kalender', permanent: false },
      { source: '/calendar/:ansicht*', destination: '/os/kalender', permanent: false },
      // 02.08.: die Fokus-Regler leben im Kompass.
      { source: '/os/planung/fokus', destination: '/os/kompass', permanent: false },
    ];
  },
};

export default nextConfig;
