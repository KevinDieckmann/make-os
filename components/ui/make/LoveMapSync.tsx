'use client';

import { useState } from 'react';
import { useMakeOS } from '@/context/MakeOSContext';

const QUESTIONS = [
  {
    id: 'q1',
    question: 'Was war der bedeutendste Moment dieser Woche für dich — und warum hat er dich bewegt?',
    target: 'Kevin fragt Malin',
  },
  {
    id: 'q2',
    question: 'Welche Stärke hast du an mir diese Woche besonders wahrgenommen, die ich vielleicht selbst nicht sehe?',
    target: 'Malin fragt Kevin',
  },
  {
    id: 'q3',
    question: 'Was ist ein Traum oder Ziel, das ich in den nächsten 12 Monaten noch mehr priorisieren möchte, und wie kann ich dich dabei einbeziehen?',
    target: 'Gegenseitig',
  },
];

function isSundayEvening(): boolean {
  const d = new Date();
  return d.getDay() === 0 && d.getHours() >= 18;
}

export function LoveMapSync() {
  const { addEbaInteraction } = useMakeOS();
  const [answers, setAnswers]       = useState<Record<string, string>>({});
  const [unlocked, setUnlocked]     = useState(false);
  const [sliderVal, setSliderVal]   = useState(0);
  const [completed, setCompleted]   = useState(false);
  const [devMode, setDevMode]       = useState(false);

  const available = isSundayEvening() || devMode;
  const allAnswered = QUESTIONS.every(q => (answers[q.id] ?? '').trim().length > 10);

  function handleSlider(val: number) {
    setSliderVal(val);
    if (val >= 95) {
      setUnlocked(true);
      setSliderVal(0);
    }
  }

  function handleSubmit() {
    if (!allAnswered) return;
    setCompleted(true);
    addEbaInteraction('POSITIVE_LISTENING', 'Both', 'Sunday Love-Map Sync abgeschlossen');
  }

  return (
    <div className="os-card" style={{ padding: 0 }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid #1e1e1e', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#555', letterSpacing: '0.12em', marginBottom: 3 }}>
            HABIT_05 // SONNTAGS-SYNC
          </div>
          <div style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#ffffff', letterSpacing: '0.04em' }}>
            LOVE-MAP UPDATE
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!available && (
            <button
              onClick={() => setDevMode(true)}
              className="interactive-element"
              style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#333', border: '1px solid #1a1a1a', padding: '2px 6px', background: 'none', cursor: 'pointer', letterSpacing: '0.08em' }}
            >
              DEV
            </button>
          )}
          <div style={{
            fontFamily: 'var(--mono-font)', fontSize: 11,
            color: available ? '#00ff66' : '#444',
            border: `1px solid ${available ? '#00ff6633' : '#1e1e1e'}`,
            padding: '2px 8px',
            letterSpacing: '0.1em',
          }}>
            {available ? 'ENTSPERRT' : 'SO AB 18:00'}
          </div>
        </div>
      </div>

      <div style={{ padding: 14 }}>
        {!available ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#333', letterSpacing: '0.1em', marginBottom: 8 }}>
              // ZEITSPERRE AKTIV
            </div>
            <div style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#222', letterSpacing: '0.08em', lineHeight: 1.8 }}>
              Dieses Modul entsperrt sich<br />ausschließlich Sonntag ab 18:00 Uhr.<br />Schutzfenster für geteilte Reflexion.
            </div>
          </div>
        ) : !unlocked ? (
          <div>
            <div style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#444', letterSpacing: '0.1em', marginBottom: 12, textAlign: 'center' }}>
              SCHIEBE ZUM ENTSPERREN →
            </div>
            <div style={{ position: 'relative', padding: '0 0 8px' }}>
              <input
                type="range"
                min={0}
                max={100}
                value={sliderVal}
                onChange={e => handleSlider(Number(e.target.value))}
                style={{ width: '100%', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#222' }}>START</span>
                <span style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#222' }}>ENTSPERRT</span>
              </div>
            </div>
          </div>
        ) : completed ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#00ff66', letterSpacing: '0.1em', marginBottom: 6 }}>
              ✓ LOVE-MAP SYNC ABGESCHLOSSEN
            </div>
            <div style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#444', letterSpacing: '0.06em' }}>
              KW{Math.ceil(new Date().getDate() / 7)} GESPEICHERT
            </div>
          </div>
        ) : (
          <div>
            {QUESTIONS.map((q, i) => (
              <div key={q.id} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#555', letterSpacing: '0.1em' }}>FRAGE {i + 1}</span>
                  <span style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#333', letterSpacing: '0.08em' }}>{q.target.toUpperCase()}</span>
                </div>
                <div style={{
                  fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif',
                  fontSize: 12,
                  color: '#888',
                  lineHeight: 1.5,
                  marginBottom: 6,
                }}>
                  {q.question}
                </div>
                <textarea
                  value={answers[q.id] ?? ''}
                  onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                  placeholder="Antwort..."
                  style={{
                    width: '100%',
                    background: '#050505',
                    border: '1px solid #1a1a1a',
                    color: '#ffffff',
                    fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif',
                    fontSize: 12,
                    padding: '8px 10px',
                    outline: 'none',
                    resize: 'vertical',
                    minHeight: 56,
                    lineHeight: 1.5,
                  }}
                />
              </div>
            ))}
            <button
              onClick={handleSubmit}
              disabled={!allAnswered}
              className="interactive-element"
              style={{
                width: '100%',
                padding: '10px',
                background: allAnswered ? '#00ff6611' : 'transparent',
                border: `1px solid ${allAnswered ? '#00ff6633' : '#1e1e1e'}`,
                color: allAnswered ? '#00ff66' : '#333',
                fontFamily: 'var(--mono-font)',
                fontSize: 11,
                letterSpacing: '0.1em',
                cursor: allAnswered ? 'pointer' : 'default',
              }}
            >
              SYNC ABSCHLIESSEN
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
