// MAKE OS — Software-Rahmen: Seitenleiste links (wie eine echte Arbeits-
// umgebung), Inhalt rechts mit eigenem Scroll. Auf dem Handy wird die Leiste
// zur Schublade (Kopfzeile mit ☰). Der Taktgeber läuft im Rahmen — auf jeder
// /os-Route, ohne dass eine Seite ihn einbinden muss.
import { OsSidebar } from '@/components/os/OsSidebar';
import { Taktgeber } from '@/components/os/Taktgeber';
import { JarvisPanel } from '@/components/os/JarvisPanel';

export default function OsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="os-shell" style={{ display: 'flex', minHeight: '100vh', alignItems: 'stretch' }}>
      <OsSidebar />
      <main style={{ flex: 1, minWidth: 0, height: '100vh', overflowY: 'auto', overflowX: 'hidden' }}>
        <Taktgeber />
        {children}
      </main>
      {/* Jarvis läuft rechts auf JEDER /os-Seite mit — in Stufen aufziehbar. */}
      <JarvisPanel />
    </div>
  );
}
