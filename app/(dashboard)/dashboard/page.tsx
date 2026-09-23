'use client';

import { SystemDispatch }       from '@/components/ui/make/SystemDispatch';
import { EBAEngine }            from '@/components/ui/make/EBAEngine';
import { TaskManager }          from '@/components/ui/make/TaskManager';
import { LoveMapSync }          from '@/components/ui/make/LoveMapSync';
import { SmartGroceries }       from '@/components/ui/make/SmartGroceries';
import { IntelligenceFeedCard } from '@/components/dashboard/IntelligenceFeedCard';
import { useMakeOS }            from '@/context/MakeOSContext';

function HabitCard({ label, shortLabel, sub, accentColor, onClick }: {
  label: string; shortLabel: string; sub: string; accentColor: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="os-card interactive-element"
      style={{
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        cursor: 'pointer',
        background: '#0a0a0a',
        border: '1px solid #1e1e1e',
        textAlign: 'left',
        width: '100%',
        borderLeft: `2px solid ${accentColor}`,
      }}
    >
      <div style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: accentColor, letterSpacing: '0.12em' }}>{shortLabel}</div>
      <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif', fontSize: 13, color: '#ffffff', fontWeight: 500 }}>{label}</div>
      <div style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#777', letterSpacing: '0.04em' }}>{sub}</div>
    </button>
  );
}

export default function DashboardPage() {
  const { openHabit, activateReunion } = useMakeOS();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* ROW 1 — System Dispatch + EBA Engine */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 10, alignItems: 'start' }}>
        <SystemDispatch />
        <EBAEngine />
      </div>

      {/* ROW 2 — Task Manager */}
      <TaskManager />

      {/* ROW 3 — Micro-Habits */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        <HabitCard shortLabel="HABIT_01 // ABSCHIED"      label="Intentionaler Abschied"          sub="3-Sek-Hold · EBA +3.2"           accentColor="#00ff66"  onClick={() => openHabit('parting')} />
        <HabitCard shortLabel="HABIT_02 // WERTSCHÄTZUNG" label="Spezifische Wertschätzung"       sub="Verhalten + Charakter · EBA +8.0" accentColor="#00ff66"  onClick={() => openHabit('appreciation')} />
        <HabitCard shortLabel="HABIT_03 // RESET"         label="6-Sekunden Physiologischer Reset" sub="NFC-Handshake · EBA +5.4"         accentColor="#00aaff" onClick={() => openHabit('reset')} />
        <HabitCard shortLabel="HABIT_04 // REUNION"       label="Analog Dekompressions-Modus"     sub="20-Min Schutzfenster aktivieren"  accentColor="#888888" onClick={activateReunion} />
      </div>

      {/* ROW 4 — Love Map + Groceries */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <LoveMapSync />
        <SmartGroceries />
      </div>

      {/* ROW 5 — Microsoft 365 Intelligence Feed */}
      <IntelligenceFeedCard />

    </div>
  );
}
