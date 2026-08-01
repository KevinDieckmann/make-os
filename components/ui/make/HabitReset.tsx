'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMakeOS } from '@/context/MakeOSContext';

const RADIUS = 44;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function HabitReset() {
  const { activeHabit, closeHabit, addEbaInteraction } = useMakeOS();
  const open = activeHabit === 'reset';

  const [running, setRunning]     = useState(false);
  const [seconds, setSeconds]     = useState(6);
  const [done, setDone]           = useState(false);
  const [flash, setFlash]         = useState(false);
  const timerRef                  = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!open) { setRunning(false); setSeconds(6); setDone(false); setFlash(false); }
  }, [open]);

  function startTimer() {
    if (running || done) return;
    setRunning(true);
    timerRef.current = setInterval(() => {
      setSeconds(prev => {
        setFlash(f => !f);
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setRunning(false);
          setDone(true);
          addEbaInteraction('POSITIVE_TOUCH', 'Both', '6-Sekunden physiologischer Reset');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function reset() {
    clearInterval(timerRef.current!);
    setRunning(false);
    setSeconds(6);
    setDone(false);
    setFlash(false);
  }

  const progress = (6 - seconds) / 6;
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);
  const accentColor = done ? '#00ff66' : (running && flash ? '#00ff66' : '#1e1e1e');

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="bd" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={closeHabit}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 9000 }} />

          <motion.div key="modal" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.14 }}
            style={{
              position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              width: 380, background: '#0a0a0a', border: '1px solid #2a2a2a', zIndex: 9001,
            }}
          >
            {/* Header */}
            <div style={{ borderBottom: '1px solid #1e1e1e', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: 'var(--mono-font)', fontSize: 8, color: '#00ff66', letterSpacing: '0.12em', marginBottom: 3 }}>HABIT_03 // MICRO-HABIT</div>
                <div style={{ fontFamily: 'var(--mono-font)', fontSize: 12, color: '#ffffff', letterSpacing: '0.04em' }}>6-SEKUNDEN PHYSIOLOGISCHER RESET</div>
              </div>
              <button onClick={closeHabit} className="interactive-element"
                style={{ fontFamily: 'var(--mono-font)', fontSize: 9, color: '#444', background: 'none', border: '1px solid #1e1e1e', padding: '2px 8px', cursor: 'pointer' }}>
                ESC
              </button>
            </div>

            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
              {/* SVG Ring */}
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width={110} height={110} style={{ transform: 'rotate(-90deg)' }}>
                  {/* Background track */}
                  <circle cx={55} cy={55} r={RADIUS} fill="none" stroke="#1e1e1e" strokeWidth={3} />
                  {/* Progress arc */}
                  <circle
                    cx={55} cy={55} r={RADIUS}
                    fill="none"
                    stroke={done ? '#00ff66' : '#00ff66'}
                    strokeWidth={3}
                    strokeDasharray={CIRCUMFERENCE}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="butt"
                    style={{ transition: running ? 'stroke-dashoffset 1s linear' : 'none' }}
                  />
                </svg>
                {/* Center display */}
                <div style={{
                  position: 'absolute',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2,
                }}>
                  <span style={{
                    fontFamily: 'var(--mono-font)',
                    fontSize: 28,
                    color: done ? '#00ff66' : (running && flash ? '#00ff66' : '#ffffff'),
                    letterSpacing: '-0.04em',
                    lineHeight: 1,
                    transition: 'color 100ms',
                  }}>
                    {done ? '✓' : seconds}
                  </span>
                  {!done && (
                    <span style={{ fontFamily: 'var(--mono-font)', fontSize: 7, color: '#444', letterSpacing: '0.1em' }}>SEK</span>
                  )}
                </div>
              </div>

              {/* Protocol */}
              <div style={{ background: '#050505', border: '1px solid #111', padding: '10px 12px', width: '100%' }}>
                <div style={{ fontFamily: 'var(--mono-font)', fontSize: 7, color: '#333', letterSpacing: '0.12em', marginBottom: 6 }}>// NFC-HANDSHAKE PROTOKOLL</div>
                {[
                  '1. Physischen Kontakt herstellen',
                  '2. Langen Kuss / Umarmung initiieren',
                  '3. 6 Sekunden vollständig halten',
                  '4. Oxytocin-Bindungseffekt aktiviert',
                ].map((s, i) => (
                  <div key={i} style={{ fontFamily: 'var(--mono-font)', fontSize: 8, color: '#555', letterSpacing: '0.04em', padding: '2px 0', lineHeight: 1.5 }}>{s}</div>
                ))}
              </div>

              {/* Controls */}
              {!done ? (
                <div style={{ display: 'flex', gap: 6, width: '100%' }}>
                  <button
                    onClick={startTimer}
                    disabled={running}
                    className="interactive-element"
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: running ? '#050505' : '#00ff6611',
                      border: `1px solid ${running ? '#1e1e1e' : '#00ff6633'}`,
                      color: running ? '#444' : '#00ff66',
                      fontFamily: 'var(--mono-font)',
                      fontSize: 9,
                      letterSpacing: '0.1em',
                      cursor: running ? 'default' : 'pointer',
                    }}
                  >
                    {running ? 'LÄUFT...' : '[ NFC-HANDSHAKE STARTEN ]'}
                  </button>
                  {running && (
                    <button onClick={reset} className="interactive-element"
                      style={{
                        padding: '12px 14px',
                        background: 'transparent',
                        border: '1px solid #1e1e1e',
                        color: '#444',
                        fontFamily: 'var(--mono-font)',
                        fontSize: 9,
                        letterSpacing: '0.1em',
                        cursor: 'pointer',
                      }}>
                      RESET
                    </button>
                  )}
                </div>
              ) : (
                <div style={{
                  width: '100%',
                  border: '1px solid #00ff6633',
                  background: 'rgba(0,255,102,0.04)',
                  padding: '12px',
                  textAlign: 'center',
                }}>
                  <div style={{ fontFamily: 'var(--mono-font)', fontSize: 9, color: '#00ff66', letterSpacing: '0.12em' }}>
                    ✓ RESET ABGESCHLOSSEN — EBA +{(6 * 0.9).toFixed(1)}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
