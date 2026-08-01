'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMakeOS } from '@/context/MakeOSContext';

const DURATION_MINUTES = 20;
const DURATION_SECONDS = DURATION_MINUTES * 60;

export function ReunionDecompression() {
  const { reunionActive, deactivateReunion } = useMakeOS();
  const [remaining, setRemaining] = useState(DURATION_SECONDS);
  const [paused, setPaused]       = useState(false);
  const intervalRef               = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (reunionActive) {
      setRemaining(DURATION_SECONDS);
      setPaused(false);
    } else {
      clearInterval(intervalRef.current!);
    }
  }, [reunionActive]);

  useEffect(() => {
    if (!reunionActive || paused) { clearInterval(intervalRef.current!); return; }
    intervalRef.current = setInterval(() => {
      setRemaining(v => {
        if (v <= 1) { clearInterval(intervalRef.current!); deactivateReunion(); return 0; }
        return v - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current!);
  }, [reunionActive, paused, deactivateReunion]);

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');
  const progress = ((DURATION_SECONDS - remaining) / DURATION_SECONDS) * 100;

  return (
    <AnimatePresence>
      {reunionActive && (
        <motion.div
          key="reunion"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="grain-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            background: '#030303',
            zIndex: 10000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 40,
          }}
        >
          {/* Top label */}
          <div style={{ position: 'absolute', top: 24, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'var(--mono-font)', fontSize: 8, color: '#222', letterSpacing: '0.2em' }}>
              ANALOG MODE AKTIV // DEKOMPRESSIONS-PROTOKOLL
            </span>
          </div>

          {/* Main clock */}
          <div style={{ textAlign: 'center', zIndex: 1 }}>
            <div style={{
              fontFamily: 'var(--mono-font)',
              fontSize: 72,
              color: '#1e1e1e',
              letterSpacing: '0.08em',
              lineHeight: 1,
              marginBottom: 12,
            }}>
              {mm}:{ss}
            </div>
            <div style={{ fontFamily: 'var(--mono-font)', fontSize: 9, color: '#1a1a1a', letterSpacing: '0.2em' }}>
              VERBLEIBENDE DEKOMPRESSIONSZEIT
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ width: 200, zIndex: 1 }}>
            <div className="progress-track" style={{ height: 1 }}>
              <div className="progress-fill" style={{ width: `${progress}%`, background: '#1e1e1e' }} />
            </div>
          </div>

          {/* Protocol text */}
          <div style={{ textAlign: 'center', zIndex: 1, maxWidth: 320 }}>
            {[
              'Keine Bildschirme.',
              'Keine Arbeit.',
              'Nur Anwesenheit.',
            ].map((line, i) => (
              <div key={i} style={{ fontFamily: 'var(--mono-font)', fontSize: 10, color: '#1a1a1a', letterSpacing: '0.12em', padding: '4px 0' }}>
                {line}
              </div>
            ))}
          </div>

          {/* Controls */}
          <div style={{ position: 'absolute', bottom: 24, display: 'flex', gap: 8, zIndex: 1 }}>
            <button
              onClick={() => setPaused(v => !v)}
              className="interactive-element"
              style={{
                padding: '6px 16px',
                background: 'transparent',
                border: '1px solid #111',
                color: '#1e1e1e',
                fontFamily: 'var(--mono-font)',
                fontSize: 8,
                letterSpacing: '0.1em',
                cursor: 'pointer',
              }}
            >
              {paused ? 'FORTSETZEN' : 'PAUSE'}
            </button>
            <button
              onClick={deactivateReunion}
              className="interactive-element"
              style={{
                padding: '6px 16px',
                background: 'transparent',
                border: '1px solid #111',
                color: '#1e1e1e',
                fontFamily: 'var(--mono-font)',
                fontSize: 8,
                letterSpacing: '0.1em',
                cursor: 'pointer',
              }}
            >
              BEENDEN
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
