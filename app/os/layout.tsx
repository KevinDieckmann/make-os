// MAKE OS — Software-Rahmen. Seit 23.09. verschlankt: die Leiste (eine Ebene),
// der Inhalt, das ZOE-Panel, der Taktgeber, der Fehlermelder. Weg sind
// Bereichs-Cockpit, Bauzeit-Hinweis, Onboarding-Erinnerung und Zurufe. Was
// mitläuft, muss etwas tun, nicht nur da sein.
import { Taktgeber } from '@/components/os/Taktgeber';
import { AnfrageBuendel } from '@/components/os/AnfrageBuendel';
import { Kopf } from '@/components/os/Kopf';
import { Leiste } from '@/components/os/Leiste';
import { ZoePanel } from '@/components/os/ZoePanel';
import { FehlerMelder } from '@/components/os/FehlerMelder';
import { NutzungsMelder } from '@/components/os/NutzungsMelder';
import { Protokollant } from '@/components/os/Protokollant';
import { Mitarbeit } from '@/components/os/Mitarbeit';
import { WillkommenMalin } from '@/components/os/WillkommenMalin';
import { Schnellsuche } from '@/components/os/Schnellsuche';
import { IdeeErfassen } from '@/components/os/bauplan/IdeeErfassen';
import { wache } from '@/lib/zugang/wache';

// Alles hinter der Anmeldung wird je Anfrage gebaut (25.09., schneller Modus): Die Wache liest das
// Sitzungs-Cookie — beim Vorab-Erzeugen während `next build` gibt es keins.
export const dynamic = 'force-dynamic';

export default async function OsLayout({ children }: { children: React.ReactNode }) {
  // Seit 23.09.: ohne gültiges Konto keine Seite — die Middleware prüft die
  // Unterschrift, die Wache prüft, ob es das Konto noch gibt.
  await wache('/os');
  return (
    <div className="os-shell" style={{ display: 'flex', minHeight: '100vh', alignItems: 'stretch' }}>
      {/* Tempo (27.09.): gleiche GET-Abfragen an /api werden geteilt statt dreifach gestellt. */}
      <AnfrageBuendel />
      {/* Schreibt Browser-Fehler mit, damit sie nicht nur auf dem Bildschirm stehen. */}
      <FehlerMelder />
      {/* Hält fest, wer welchen Bestand geändert hat. */}
      <Protokollant />
      {/* Schreibt leise mit, welche Seiten benutzt werden — Grundlage der Verbesserungs-Vorschläge. */}
      <NutzungsMelder />
      {/* Die Leiste (26.09.): Home · Wachstum · Privat · Business · Agenten, unten ZOE · Brain · System. */}
      <Leiste />
      <main style={{ flex: 1, minWidth: 0, height: '100vh', overflowY: 'auto', overflowX: 'hidden' }}>
        {/* Der Kopf (26.09.): Suche im Space · Idee · Heute · Inbox · Kalender · Index des Space. */}
        <Kopf />
        <Taktgeber />
        {children}
      </main>
      {/* ZOE läuft rechts auf JEDER /os-Seite mit — in Stufen aufziehbar. */}
      <ZoePanel />
      {/* ⌘K von überall: Kontakte, Firmen, Chancen, Mandate, Bereiche (24.09.). */}
      <Schnellsuche />
      {/* „Idee“ von jeder Seite → Bauplan (25.09.). */}
      <IdeeErfassen />
      {/* Zu zweit: wer ist gerade wo (24.09.). */}
      <Mitarbeit />
      {/* Einmaliger Gruß beim allerersten Öffnen. */}
      <WillkommenMalin />
    </div>
  );
}
