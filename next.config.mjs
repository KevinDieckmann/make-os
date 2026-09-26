/** @type {import('next').NextConfig} */
const nextConfig = {
  // 25.09.: start.sh baut den schnellen Produktionsmodus nach .next-prod —
  // getrennt vom Entwicklungsmodus (.next), damit beide sich nie stören.
  distDir: process.env.MAKE_OS_DIST || '.next',
  // Nicht verraten, womit gebaut ist (25.09., Härtung).
  poweredByHeader: false,
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
