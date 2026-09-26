/** @type {import('next').NextConfig} */
const nextConfig = {
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
        ].join('; ') }]
      : [];
    return [
      { source: '/finanz-dashboard.html', headers: basis.filter(h => h.key !== 'X-Frame-Options').concat([{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }]) },
      { source: '/((?!finanz-dashboard\\.html).*)', headers: [...basis, ...csp] },
    ];
  },
  // Gesundheit ist seit 23.09. EINE Seite mit vier Segmenten. Die alten
  // Adressen bleiben gültig — Lesezeichen und Jarvis-Verweise landen richtig.
  async redirects() {
    return [
      { source: '/os/performance', destination: '/os/wachstum', permanent: false },
      // 25.09.: „Brain“ heißt in der Leiste so, die Seite liegt unter /os/wissen.
      { source: '/os/brain', destination: '/os/wissen', permanent: false },
      { source: '/os/uebersicht', destination: '/os', permanent: false },
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
      { source: '/os/woche', destination: '/os/gesundheit?s=koerper', permanent: false },
    ];
  },
};

export default nextConfig;
