'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMakeOS } from '@/context/MakeOSContext';

const HOLD_DURATION = 3000; // ms

const PEAK_STRAIN = [
  { name: 'MALIN',  time: '08:30–10:00', load: 88, color: '#ec4899' },
  { name: 'KEVIN',  time: '07:00–09:30', load: 94, color: '#3b82f6' },
];

export function HabitParting() {
  const { activeHabit, closeHabit, addEbaInteraction } = useMakeOS();
  const open = activeHabit === 'parting';

  const [holding, setHolding]     = useState(false);
  const [progress, setProgress]   = useState(0);
  const [completed, setCompleted] = useState(false);
  const intervalRef               = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef                  = useRef<number>(0);

  function startHold() {
    if (completed) return;
    setHolding(true);
    startRef.current = Date.now();
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const pct = Math.min((elapsed / HOLD_DURATION) * 100, 100);
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(intervalRef.current!);
        setHolding(false);
        setCompleted(true);
        addEbaInteraction('POSITIVE_PARTING', 'Both', 'Intentionaler Abschied — 3-Sek-Hold');
        setTimeout(closeHabit, 1800);
      }
    }, 40);
  }

  function stopHold() {
    if (completed) return;
    clearInterval(intervalRef.current!);
    setHolding(false);
    setProgress(0);
  }

  useEffect(() => {
    if (!open) { setCompleted(false); setProgress(0); setHolding(false); }
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="bd" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={closeHabit}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 9000 }} />

          <motion.div key="modal" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.14 }}
            style={{
              position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              width: 480, background: '#0a0a0a', border: '1px solid #2a2a2a', zIndex: 9001,
            }}
          >
            {/* Header */}
            <div style={{ borderBottom: '1px solid #1e1e1e', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#00ff66', letterSpacing: '0.12em', marginBottom: 3 }}>HABIT_01 // MICRO-HABIT</div>
                <div style={{ fontFamily: 'var(--mono-font)', fontSize: 12, color: '#ffffff', letterSpacing: '0.04em' }}>INTENTIONALER ABSCHIED</div>
              </div>
              <button onClick={closeHabit} className="interactive-element"
                style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#444', background: 'none', border: '1px solid #1e1e1e', padding: '2px 8px', cursor: 'pointer' }}>
                ESC
              </button>
            </div>

            <div style={{ padding: 16 }}>
              {/* Peak strain display */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#333', letterSpacing: '0.12em', marginBottom: 8 }}>// EXECUTIVE STRAIN — PEAK WINDOW</div>
                {PEAK_STRAIN.map(p => (
                  <div key={p.name} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: p.color, letterSpacing: '0.08em' }}>{p.name}</span>
                      <span style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#555', letterSpacing: '0.06em' }}>{p.time} &nbsp; LOAD: {p.load}%</span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${p.load}%`, background: p.color }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Protocol */}
              <div style={{ background: '#050505', border: '1px solid #111', padding: '10px 12px', marginBottom: 16 }}>
                <div style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#333', letterSpacing: '0.12em', marginBottom: 6 }}>// PROTOKOLL</div>
                {[
                  '1. Augenkontakt herstellen — 3 Sekunden',
                  '2. Einen vollständigen Satz sprechen (nicht nur "Tschüss")',
                  '3. Physischer Kontakt: Umarmung oder Kuss',
                  '4. 3-Sekunden-Halte-Bestätigung unten ausführen',
                ].map((step, i) => (
                  <div key={i} style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#555', letterSpacing: '0.04em', padding: '2px 0', lineHeight: 1.5 }}>{step}</div>
                ))}
              </div>

              {/* Hold button */}
              {!completed ? (
                <div>
                  <div style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#333', letterSpacing: '0.12em', marginBottom: 8, textAlign: 'center' }}>
                    HALTE GEDRÜCKT — 3 SEKUNDEN
                  </div>
                  <div style={{ position: 'relative', overflow: 'hidden' }}>
                    <button
                      onMouseDown={startHold}
                      onMouseUp={stopHold}
                      onMouseLeave={stopHold}
                      onTouchStart={startHold}
                      onTouchEnd={stopHold}
                      className="interactive-element"
                      style={{
                        width: '100%',
                        padding: '14px',
                        background: holding ? '#0d0d0d' : '#0a0a0a',
                        border: `1px solid ${holding ? '#00ff66' : '#2a2a2a'}`,
                        color: '#ffffff',
                        fontFamily: 'var(--mono-font)',
                        fontSize: 11,
                        letterSpacing: '0.1em',
                        cursor: 'pointer',
                        position: 'relative',
                        overflow: 'hidden',
                        userSelect: 'none',
                      }}
                    >
                      {/* Fill bar */}
                      <div style={{
                        position: 'absolute', left: 0, top: 0, bottom: 0,
                        width: `${progress}%`,
                        background: 'rgba(0,255,102,0.12)',
                        transition: 'none',
                      }} />
                      <span style={{ position: 'relative', zIndex: 1 }}>
                        {holding ? `HALTEN... ${Math.round(progress)}%` : '[ GEDRÜCKT HALTEN ]'}
                      </span>
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{
                  border: '1px solid #00ff6633',
                  background: 'rgba(0,255,102,0.04)',
                  padding: '14px',
                  textAlign: 'center',
                }}>
                  <div style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#00ff66', letterSpacing: '0.12em' }}>
                    ✓ ABSCHIED PROTOKOLLIERT — EBA +{(4 * 0.8).toFixed(1)}
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
