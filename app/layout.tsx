import type { Metadata } from 'next';
import './globals.css';
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
    <html lang="de" className="dark">
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
