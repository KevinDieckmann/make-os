'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMakeOS } from '@/context/MakeOSContext';

export function HabitAppreciation() {
  const { activeHabit, closeHabit, addEbaInteraction } = useMakeOS();
  const open = activeHabit === 'appreciation';

  const [sectionA, setSectionA] = useState('');
  const [sectionB, setSectionB] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState({ a: false, b: false });

  useEffect(() => {
    if (!open) { setSectionA(''); setSectionB(''); setSubmitted(false); setErrors({ a: false, b: false }); }
  }, [open]);

  function handleSubmit() {
    const newErrors = { a: sectionA.trim().length < 8, b: sectionB.trim().length < 8 };
    setErrors(newErrors);
    if (newErrors.a || newErrors.b) return;
    setSubmitted(true);
    addEbaInteraction('POSITIVE_APPRECIATION', 'Kevin', `Wertschätzung: "${sectionA.substring(0, 40)}..."`);
    setTimeout(closeHabit, 2000);
  }

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
              width: 520, background: '#0a0a0a', border: '1px solid #2a2a2a', zIndex: 9001,
            }}
          >
            {/* Header */}
            <div style={{ borderBottom: '1px solid #1e1e1e', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#00ff66', letterSpacing: '0.12em', marginBottom: 3 }}>HABIT_02 // MICRO-HABIT</div>
                <div style={{ fontFamily: 'var(--mono-font)', fontSize: 12, color: '#ffffff', letterSpacing: '0.04em' }}>SPEZIFISCHE WERTSCHÄTZUNG</div>
              </div>
              <button onClick={closeHabit} className="interactive-element"
                style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#444', background: 'none', border: '1px solid #1e1e1e', padding: '2px 8px', cursor: 'pointer' }}>
                ESC
              </button>
            </div>

            {!submitted ? (
              <div style={{ padding: 16 }}>
                <div style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#555', letterSpacing: '0.08em', marginBottom: 16, lineHeight: 1.7 }}>
                  Wissenschaftlich validiertes Gottman-Protokoll. Beide Sektionen müssen ausgefüllt werden.
                  Verhaltens-Ebene + Charakter-Ebene erzeugen maximalen EBA-Transfer (×1.0).
                </div>

                {/* Section A */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{
                    fontFamily: 'var(--mono-font)',
                    fontSize: 11,
                    color: errors.a ? '#ff4444' : '#444',
                    letterSpacing: '0.1em',
                    marginBottom: 6,
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}>
                    <span>SEKTION A // VERHALTENS-EBENE</span>
                    {errors.a && <span>PFLICHTFELD</span>}
                  </div>
                  <div style={{
                    fontFamily: 'var(--mono-font)', fontSize: 11, color: '#555',
                    border: '1px solid #1a1a1a', padding: '6px 10px', marginBottom: 6,
                    background: '#050505', letterSpacing: '0.04em',
                  }}>
                    „Ich habe bemerkt, dass du..."
                  </div>
                  <textarea
                    value={sectionA}
                    onChange={e => setSectionA(e.target.value)}
                    placeholder="Konkretes, beobachtbares Verhalten beschreiben..."
                    style={{
                      width: '100%',
                      background: '#050505',
                      border: `1px solid ${errors.a ? '#ff4444' : '#1e1e1e'}`,
                      color: '#ffffff',
                      fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif',
                      fontSize: 13,
                      padding: '10px 12px',
                      outline: 'none',
                      resize: 'vertical',
                      minHeight: 72,
                      lineHeight: 1.5,
                    }}
                  />
                </div>

                {/* Section B */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{
                    fontFamily: 'var(--mono-font)',
                    fontSize: 11,
                    color: errors.b ? '#ff4444' : '#444',
                    letterSpacing: '0.1em',
                    marginBottom: 6,
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}>
                    <span>SEKTION B // CHARAKTER-EBENE</span>
                    {errors.b && <span>PFLICHTFELD</span>}
                  </div>
                  <div style={{
                    fontFamily: 'var(--mono-font)', fontSize: 11, color: '#555',
                    border: '1px solid #1a1a1a', padding: '6px 10px', marginBottom: 6,
                    background: '#050505', letterSpacing: '0.04em',
                  }}>
                    „Das zeigt mir, wie..."
                  </div>
                  <textarea
                    value={sectionB}
                    onChange={e => setSectionB(e.target.value)}
                    placeholder="Charaktereigenschaft oder Wert benennen..."
                    style={{
                      width: '100%',
                      background: '#050505',
                      border: `1px solid ${errors.b ? '#ff4444' : '#1e1e1e'}`,
                      color: '#ffffff',
                      fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif',
                      fontSize: 13,
                      padding: '10px 12px',
                      outline: 'none',
                      resize: 'vertical',
                      minHeight: 72,
                      lineHeight: 1.5,
                    }}
                  />
                </div>

                {/* EBA preview */}
                <div style={{ background: '#050505', border: '1px solid #111', padding: '6px 10px', marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#333', letterSpacing: '0.08em' }}>EBA TRANSFER VORSCHAU</span>
                  <span style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#00ff66', letterSpacing: '0.08em' }}>
                    +{(8 * 1.0).toFixed(1)} PUNKTE
                  </span>
                </div>

                <button
                  onClick={handleSubmit}
                  className="interactive-element"
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#00ff6611',
                    border: '1px solid #00ff6633',
                    color: '#00ff66',
                    fontFamily: 'var(--mono-font)',
                    fontSize: 11,
                    letterSpacing: '0.12em',
                    cursor: 'pointer',
                  }}
                >
                  WERTSCHÄTZUNG ÜBERMITTELN
                </button>
              </div>
            ) : (
              <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#00ff66', letterSpacing: '0.12em', marginBottom: 8 }}>
                  ✓ WERTSCHÄTZUNG PROTOKOLLIERT
                </div>
                <div style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#555', letterSpacing: '0.06em' }}>
                  EBA +8.0 — GOTTMAN RATIO VERBESSERT
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
