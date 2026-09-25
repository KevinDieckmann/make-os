import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

// ─── Schrift (Härtung 06.09., selbst mitgeliefert seit 25.09.) ──────────────
// Archivo trägt große Zahlen — der Score-Ring, der Kontostand — mit echten
// Tabellenziffern. Public Sans ist auf kleine Größen ausgelegt. Beide liegen
// als Dateien im Repo (app/schriften, SIL Open Font License): Beim Bauen auf
// dem Server gibt es so keine Abhängigkeit von Google (ein Aussetzer dort ließ
// am 25.09. das Ausrollen scheitern), kein Nachladen, kein Schriftsprung.
const archivo = localFont({
  src: './schriften/archivo-latin.woff2', weight: '500 700', style: 'normal',
  variable: '--schrift-display', display: 'swap', adjustFontFallback: 'Arial',
});
const publicSans = localFont({
  src: './schriften/public-sans-latin.woff2', weight: '400 600', style: 'normal',
  variable: '--schrift-text', display: 'swap', adjustFontFallback: 'Arial',
});
import { AppContextProvider } from '@/context/AppContext';
import { TasksProvider } from '@/context/TasksContext';
import { CalendarProvider } from '@/context/CalendarContext';
import { PrivacyProvider } from '@/context/PrivacyContext';
import { MakeOSProvider } from '@/context/MakeOSContext';
import { VerlaufWaechter } from '@/components/os/Verlauf';

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
        {/* Sauber zurück, überall: Tiefe je Verlaufseintrag und Scrollposition (components/os/Verlauf.tsx). */}
        <VerlaufWaechter />
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
