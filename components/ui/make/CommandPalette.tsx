'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMakeOS } from '@/context/MakeOSContext';
import { useRouter } from 'next/navigation';

interface Command {
  id: string;
  label: string;
  desc: string;
  tag: string;
  action: () => void;
}

export function CommandPalette() {
  const { paletteOpen, closePalette, openHabit, activateReunion, toggleHoldingBlur, setPhaseOverride } = useMakeOS();
  const router   = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);

  const COMMANDS: Command[] = [
    { id: 'dashboard',    label: 'Dashboard',               desc: 'Zum Haupt-Dashboard',             tag: 'NAV',     action: () => { router.push('/dashboard'); closePalette(); } },
    { id: 'tasks',        label: 'Projekte & Tasks',         desc: 'Task-Manager öffnen',             tag: 'NAV',     action: () => { router.push('/tasks'); closePalette(); } },
    { id: 'calendar',     label: 'Kalender',                desc: 'Kalenderansicht öffnen',          tag: 'NAV',     action: () => { router.push('/calendar'); closePalette(); } },
    { id: 'parting',      label: '/parting — Abschied',     desc: 'Intentionaler Abschied starten',  tag: 'HABIT',   action: () => { openHabit('parting'); closePalette(); } },
    { id: 'appreciate',   label: '/appreciate — Wertschätzen', desc: 'Wertschätzungsmodul öffnen',  tag: 'HABIT',   action: () => { openHabit('appreciation'); closePalette(); } },
    { id: 'reset',        label: '/reset — 6-Sekunden Reset', desc: 'Physiologischen Reset starten', tag: 'HABIT',   action: () => { openHabit('reset'); closePalette(); } },
    { id: 'reunion',      label: '/reunion — Analog Mode',  desc: 'Dekompressionszeit aktivieren',   tag: 'MODE',    action: () => { activateReunion(); closePalette(); } },
    { id: 'blur',         label: '/holding — Privacy Toggle', desc: 'Holding-Daten aus-/einblenden', tag: 'PRIVACY', action: () => { toggleHoldingBlur(); closePalette(); } },
    { id: 'phase1',       label: '/phase 1 — Fokus-Modus',  desc: 'Phase 1 simulieren (Test)',       tag: 'DEBUG',   action: () => { setPhaseOverride(1); closePalette(); } },
    { id: 'phase2',       label: '/phase 2 — Connection',   desc: 'Phase 2 simulieren (Test)',       tag: 'DEBUG',   action: () => { setPhaseOverride(2); closePalette(); } },
    { id: 'phaseclear',   label: '/phase reset',            desc: 'Override zurücksetzen',           tag: 'DEBUG',   action: () => { setPhaseOverride(null); closePalette(); } },
  ];

  const filtered = query.trim()
    ? COMMANDS.filter(c =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        c.desc.toLowerCase().includes(query.toLowerCase()) ||
        c.id.toLowerCase().includes(query.toLowerCase())
      )
    : COMMANDS;

  useEffect(() => { if (paletteOpen) { setTimeout(() => inputRef.current?.focus(), 50); setQuery(''); setCursor(0); } }, [paletteOpen]);
  useEffect(() => { setCursor(0); }, [query]);

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(v => Math.min(v + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(v => Math.max(v - 1, 0)); }
    if (e.key === 'Enter' && filtered[cursor]) { filtered[cursor].action(); }
    if (e.key === 'Escape') closePalette();
  }

  const TAG_COLORS: Record<string, string> = {
    NAV: '#888888', HABIT: '#00ff66', MODE: '#00aaff', PRIVACY: '#ff8800', DEBUG: '#ff4444',
  };

  return (
    <AnimatePresence>
      {paletteOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            onClick={closePalette}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9998 }}
          />

          {/* Palette */}
          <motion.div
            key="palette"
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0,   scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            style={{
              position: 'fixed',
              top: '20%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 560,
              background: '#0a0a0a',
              border: '1px solid #2a2a2a',
              zIndex: 9999,
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{ borderBottom: '1px solid #1e1e1e', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#00ff66', letterSpacing: '0.1em' }}>⌘K</span>
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={onKey}
                placeholder="Befehl eingeben..."
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#ffffff',
                  fontFamily: 'var(--mono-font)',
                  fontSize: 13,
                  letterSpacing: '0.02em',
                }}
              />
              <span style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#444', letterSpacing: '0.08em' }}>ESC</span>
            </div>

            {/* Results */}
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {filtered.length === 0 && (
                <div style={{ padding: '20px 14px', fontFamily: 'var(--mono-font)', fontSize: 11, color: '#444', textAlign: 'center' }}>
                  KEIN BEFEHL GEFUNDEN
                </div>
              )}
              {filtered.map((cmd, i) => (
                <div
                  key={cmd.id}
                  onClick={cmd.action}
                  onMouseEnter={() => setCursor(i)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '9px 14px',
                    cursor: 'pointer',
                    background: i === cursor ? '#141414' : 'transparent',
                    borderBottom: '1px solid #111',
                    transition: 'background 60ms',
                  }}
                >
                  <span style={{
                    fontFamily: 'var(--mono-font)', fontSize: 11, letterSpacing: '0.1em',
                    color: TAG_COLORS[cmd.tag] ?? '#888',
                    minWidth: 56, textAlign: 'right',
                  }}>
                    {cmd.tag}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--mono-font)', fontSize: 12, color: i === cursor ? '#ffffff' : '#cccccc', letterSpacing: '0.01em' }}>
                      {cmd.label}
                    </div>
                    <div style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#555', marginTop: 1, letterSpacing: '0.02em' }}>
                      {cmd.desc}
                    </div>
                  </div>
                  {i === cursor && (
                    <span style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#333' }}>↵</span>
                  )}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div style={{ borderTop: '1px solid #1e1e1e', padding: '6px 14px', display: 'flex', gap: 16 }}>
              {[['↑↓', 'NAVIGIEREN'], ['↵', 'AUSFÜHREN'], ['ESC', 'SCHLIESSEN']].map(([k, l]) => (
                <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#333', border: '1px solid #222', padding: '1px 4px' }}>{k}</span>
                  <span style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#333', letterSpacing: '0.08em' }}>{l}</span>
                </span>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
