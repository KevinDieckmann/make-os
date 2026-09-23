// MAKE OS — Software-Rahmen. Seit 23.09. verschlankt: die Leiste (eine Ebene),
// der Inhalt, das Jarvis-Panel, der Taktgeber, der Fehlermelder. Weg sind
// Bereichs-Cockpit, Bauzeit-Hinweis, Onboarding-Erinnerung und Zurufe. Was
// mitläuft, muss etwas tun, nicht nur da sein.
import { Taktgeber } from '@/components/os/Taktgeber';
import { Leiste } from '@/components/os/Leiste';
import { JarvisPanel } from '@/components/os/JarvisPanel';
import { FehlerMelder } from '@/components/os/FehlerMelder';
import { NutzungsMelder } from '@/components/os/NutzungsMelder';
import { Protokollant } from '@/components/os/Protokollant';
import { WillkommenMalin } from '@/components/os/WillkommenMalin';
import { wache } from '@/lib/zugang/wache';

export default async function OsLayout({ children }: { children: React.ReactNode }) {
  // Seit 23.09.: ohne gültiges Konto keine Seite — die Middleware prüft die
  // Unterschrift, die Wache prüft, ob es das Konto noch gibt.
  await wache('/os');
  return (
    <div className="os-shell" style={{ display: 'flex', minHeight: '100vh', alignItems: 'stretch' }}>
      {/* Schreibt Browser-Fehler mit, damit sie nicht nur auf dem Bildschirm stehen. */}
      <FehlerMelder />
      {/* Hält fest, wer welchen Bestand geändert hat. */}
      <Protokollant />
      {/* Schreibt leise mit, welche Seiten benutzt werden — Grundlage der Verbesserungs-Vorschläge. */}
      <NutzungsMelder />
      {/* Eine Ebene, sechs Einträge (23.09.). */}
      <Leiste />
      <main style={{ flex: 1, minWidth: 0, height: '100vh', overflowY: 'auto', overflowX: 'hidden' }}>
        <Taktgeber />
        {children}
      </main>
      {/* Jarvis läuft rechts auf JEDER /os-Seite mit — in Stufen aufziehbar. */}
      <JarvisPanel />
      {/* Einmaliger Gruß beim allerersten Öffnen. */}
      <WillkommenMalin />
    </div>
  );
}
