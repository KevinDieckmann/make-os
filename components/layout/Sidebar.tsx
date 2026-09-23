'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMakeOS } from '@/context/MakeOSContext';

const NAV = [
  { href: '/dashboard', label: 'DASHBOARD',  key: '01' },
  { href: '/tasks',     label: 'PROJEKTE',   key: '02' },
  { href: '/calendar',  label: 'KALENDER',   key: '03' },
  { href: '/wellness',  label: 'FUNDAMENT',  key: '04' },
  { href: '/dog',       label: 'LUNA',       key: '05' },
  { href: '/groceries', label: 'EINKAUF',    key: '06' },
  { href: '/routines',  label: 'ROUTINEN',   key: '07' },
];

const HABITS = [
  { id: 'parting',      label: '/parting',      shortcut: 'P' },
  { id: 'appreciation', label: '/appreciate',   shortcut: 'A' },
  { id: 'reset',        label: '/reset',        shortcut: 'R' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { openPalette, openHabit, activateReunion } = useMakeOS();

  return (
    <aside style={{
      width: 200,
      background: '#000000',
      borderRight: '1px solid #1e1e1e',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      flexShrink: 0,
      fontFamily: 'var(--mono-font)',
    }}>

      {/* Logo */}
      <div style={{
        height: 52,
        borderBottom: '1px solid #1e1e1e',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 8,
      }}>
        <span style={{ color: '#00ff66', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em' }}>MAKE</span>
        <span style={{ color: '#888', fontSize: 11, letterSpacing: '0.08em' }}>OS</span>
        <span style={{ color: '#444', fontSize: 11, marginLeft: 'auto' }}>v1</span>
      </div>

      {/* Primary Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        <div style={{ padding: '0 12px 6px', fontSize: 11, color: '#555', letterSpacing: '0.14em' }}>// NAVIGATION</div>
        {NAV.map(item => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} style={{ display: 'block', textDecoration: 'none' }}>
              <div
                className="interactive-element"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 12px',
                  background: active ? '#0a0a0a' : 'transparent',
                  borderLeft: active ? '2px solid #00ff66' : '2px solid transparent',
                  cursor: 'pointer',
                  transition: 'background 80ms',
                }}
              >
                <span style={{ color: active ? '#00ff66' : '#555', fontSize: 11, letterSpacing: '0.08em', minWidth: 14 }}>
                  {item.key}
                </span>
                <span style={{ color: active ? '#ffffff' : '#aaaaaa', fontSize: 11, letterSpacing: '0.08em', fontWeight: active ? 600 : 400 }}>
                  {item.label}
                </span>
              </div>
            </Link>
          );
        })}

        {/* Habits Section */}
        <div style={{ padding: '16px 12px 6px', fontSize: 11, color: '#555', letterSpacing: '0.14em' }}>// MICRO-HABITS</div>
        {HABITS.map(h => (
          <button
            key={h.id}
            onClick={() => openHabit(h.id as 'parting' | 'appreciation' | 'reset')}
            className="interactive-element"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 12px',
              background: 'transparent',
              border: 'none',
              borderLeft: '2px solid transparent',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span style={{ color: '#555', fontSize: 11, letterSpacing: '0.08em', minWidth: 14 }}>{h.shortcut}</span>
            <span style={{ color: '#888', fontSize: 11, letterSpacing: '0.06em', fontFamily: 'var(--mono-font)' }}>{h.label}</span>
          </button>
        ))}

        <button
          onClick={activateReunion}
          className="interactive-element"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 12px',
            background: 'transparent',
            border: 'none',
            borderLeft: '2px solid transparent',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <span style={{ color: '#555', fontSize: 11, letterSpacing: '0.08em', minWidth: 14 }}>U</span>
          <span style={{ color: '#888', fontSize: 11, letterSpacing: '0.06em', fontFamily: 'var(--mono-font)' }}>/reunion</span>
        </button>
      </nav>

      {/* Members */}
      <div style={{ borderTop: '1px solid #1e1e1e', padding: '10px 12px' }}>
        <div style={{ fontSize: 11, color: '#555', letterSpacing: '0.14em', marginBottom: 8 }}>// MITGLIEDER</div>
        {[
          { id: 'malin', label: 'MALIN', color: '#ec4899' },
          { id: 'kevin', label: 'KEVIN', color: '#3b82f6' },
        ].map(m => (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
            <div style={{
              width: 6, height: 6, background: m.color, flexShrink: 0,
            }} />
            <span style={{ fontSize: 11, color: '#888', letterSpacing: '0.08em' }}>{m.label}</span>
          </div>
        ))}
      </div>

      {/* Cmd+K hint */}
      <button
        onClick={openPalette}
        className="interactive-element"
        style={{
          borderTop: '1px solid #1e1e1e',
          padding: '10px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          width: '100%',
        }}
      >
        <span style={{ fontSize: 11, color: '#666', border: '1px solid #444', padding: '1px 5px', fontFamily: 'var(--mono-font)', letterSpacing: '0.06em' }}>⌘K</span>
        <span style={{ fontSize: 11, color: '#666', letterSpacing: '0.08em', fontFamily: 'var(--mono-font)' }}>BEFEHLSPALETTE</span>
      </button>
    </aside>
  );
}
