'use client';

// ─── MAKE OS — Finanz-Dashboard ─────────────────────────────────────────────
// Das gewachsene Dashboard, das Kevin und Malin selbst gebaut haben, läuft
// hier unverändert weiter — eingebettet, damit man es nicht mehr separat
// öffnen muss. Es hängt an seiner eigenen Datenablage; was daraus ins System
// gehört (Zahlungen, Rechnungen), holen wir gezielt herüber.

import Link from 'next/link';
import { useState } from 'react';
import { THEME as T } from '@/lib/make-one/os-data';

const lbl = { fontFamily: T.mono, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: T.muted };

export function FinanzDashboardView() {
  const [voll, setVoll] = useState(false);

  return (
    <div style={{ minHeight: '100vh', background: T.void, color: T.ink, fontFamily: T.sans, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: voll ? '10px 16px' : '20px clamp(16px,3vw,32px) 12px', flex: '0 0 auto' }}>
        {!voll && (
          <>
            <Link href="/os/finanzen" style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, textDecoration: 'none', display: 'inline-block', marginBottom: 8 }}>‹ Finanzen</Link>
            <div style={lbl}>Finanz-Dashboard</div>
          </>
        )}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          {!voll && <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-.02em', margin: '6px 0 0' }}>Euer eigenes Dashboard.</h1>}
          <button onClick={() => setVoll(!voll)} style={{
            marginLeft: 'auto', fontFamily: T.sans, fontSize: 12.5, fontWeight: 600, padding: '6px 13px', borderRadius: 9,
            cursor: 'pointer', border: `1px solid ${T.line}`, background: 'transparent', color: T.inkDim,
          }}>{voll ? '↙ Rahmen zeigen' : '↗ Ganze Seite'}</button>
          <a href="/finanz-dashboard.html" target="_blank" rel="noopener noreferrer"
            style={{ fontFamily: T.mono, fontSize: 11, color: T.accentInk, textDecoration: 'none' }}>in eigenem Fenster ›</a>
        </div>
        {!voll && (
          <p style={{ fontSize: 12.5, color: T.muted, margin: '6px 0 0', maxWidth: 680, lineHeight: 1.5 }}>
            Läuft mit seiner eigenen Datenablage weiter — hier nur eingebettet.
            Was daraus ins System gehört, holen wir gezielt herüber: Zahlungen landen in der{' '}
            <Link href="/os/finanzen" style={{ color: T.accentInk }}>Prioritätenliste</Link>, die Lage im{' '}
            <Link href="/os/controlling" style={{ color: T.accentInk }}>Controlling</Link>.
          </p>
        )}
      </div>

      <iframe
        src="/finanz-dashboard.html"
        title="Finanz-Dashboard"
        style={{ flex: 1, width: '100%', border: 0, background: '#0B0E10', minHeight: voll ? 'calc(100vh - 52px)' : 'calc(100vh - 150px)' }}
      />
    </div>
  );
}
