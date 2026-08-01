import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { CommandPalette } from '@/components/ui/make/CommandPalette';
import { ReunionDecompression } from '@/components/ui/make/ReunionDecompression';
import { HabitParting } from '@/components/ui/make/HabitParting';
import { HabitAppreciation } from '@/components/ui/make/HabitAppreciation';
import { HabitReset } from '@/components/ui/make/HabitReset';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#000000' }}>
      <Sidebar />
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <Header />
        <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', background: '#000000' }}>
          <div style={{ padding: 16, minHeight: '100%' }}>
            {children}
          </div>
        </main>
      </div>

      {/* Overlays */}
      <CommandPalette />
      <ReunionDecompression />
      <HabitParting />
      <HabitAppreciation />
      <HabitReset />
    </div>
  );
}
