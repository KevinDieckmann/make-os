/** @type {import('next').NextConfig} */
const nextConfig = {
  // Gesundheit ist seit 23.09. EINE Seite mit vier Segmenten. Die alten
  // Adressen bleiben gültig — Lesezeichen und Jarvis-Verweise landen richtig.
  async redirects() {
    return [
      { source: '/os/performance', destination: '/os/wachstum', permanent: false },
      { source: '/os/uebersicht', destination: '/os', permanent: false },
      { source: '/os/start', destination: '/os', permanent: false },
      { source: '/os/journal', destination: '/os/gesundheit', permanent: false },
      { source: '/os/ritual', destination: '/os/gesundheit', permanent: false },
      { source: '/os/saeule/health', destination: '/os/gesundheit?s=verlauf', permanent: false },
      { source: '/os/saeule/social', destination: '/os/familie', permanent: false },
      // 24.09.: eine Kartei im CRM statt Netzwerk + Kontakte + Kunden
      { source: '/os/netzwerk', destination: '/os/crm?s=kartei', permanent: false },
      { source: '/os/kunden', destination: '/os/crm?s=kunden', permanent: false },
      { source: '/os/ernaehrung', destination: '/os/gesundheit?s=ernaehrung', permanent: false },
      { source: '/os/energie', destination: '/os/gesundheit?s=koerper', permanent: false },
      { source: '/os/woche', destination: '/os/gesundheit?s=koerper', permanent: false },
    ];
  },
};

export default nextConfig;
