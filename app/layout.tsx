import type { Metadata } from 'next';
import { Archivo, Public_Sans } from 'next/font/google';
import './globals.css';

// ─── Schrift (Härtung 06.09.) ───────────────────────────────────────────────
// Archivo trägt große Zahlen — der Score-Ring, der Kontostand — mit echten
// Tabellenziffern. Public Sans ist auf kleine Größen ausgelegt und löst
// system-ui ab, das je nach Rechner anders aussah. Beide werden lokal
// mitgeliefert (next/font), also kein Nachladen und kein Schriftsprung.
const archivo = Archivo({
  subsets: ['latin'], weight: ['500', '600', '700'],
  variable: '--schrift-display', display: 'swap',
});
const publicSans = Public_Sans({
  subsets: ['latin'], weight: ['400', '500', '600'],
  variable: '--schrift-text', display: 'swap',
});
import { AppContextProvider } from '@/context/AppContext';
import { TasksProvider } from '@/context/TasksContext';
import { CalendarProvider } from '@/context/CalendarContext';
import { PrivacyProvider } from '@/context/PrivacyContext';
import { MakeOSProvider } from '@/context/MakeOSContext';

export const metadata: Metadata = {
  title: 'make — Life & Business OS',
  description: 'Das persönliche Betriebssystem für Malin & Kevin',
  // PWA: auf dem iPhone „Zum Home-Bildschirm" → läuft wie eine echte App.
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'MAKE' },
  icons: { apple: '/apple-touch-icon.png' },
};

export const viewport = {
  themeColor: '#0B0E10',
  width: 'device-width',
  initialScale: 1,
  // Kein Auto-Zoom in Eingabefeldern auf iOS.
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`dark ${archivo.variable} ${publicSans.variable}`}>
      <body className="antialiased bg-zinc-950 text-foreground">
        <MakeOSProvider>
          <PrivacyProvider>
            <AppContextProvider>
              <TasksProvider>
                <CalendarProvider>
                  {children}
                </CalendarProvider>
              </TasksProvider>
            </AppContextProvider>
          </PrivacyProvider>
        </MakeOSProvider>
      </body>
    </html>
  );
}
