'use client';

// ─── MAKE OS — Finanz-Dashboard ─────────────────────────────────────────────
// Das gewachsene Dashboard, das Kevin und Malin selbst gebaut haben, läuft
// hier unverändert weiter — eingebettet, damit man es nicht mehr separat
// öffnen muss. Es hängt an seiner eigenen Datenablage; was daraus ins System
// gehört (Zahlungen, Rechnungen), holen wir gezielt herüber.
// 24.09.: auf das lebendige Muster umgezogen (Seite + Karte, Knopf).

import Link from 'next/link';
import { useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Seite, Karte, Ueberschrift, Knopf, LEUCHT } from './schlank';

export function FinanzDashboardView() {
  const [voll, setVoll] = useState(false);

  const schalter = <Knopf leise onClick={() => setVoll(!voll)}>{voll ? '↙ Rahmen zeigen' : '↗ Ganze Seite'}</Knopf>;
  const fenster = (
    <a href="/finanz-dashboard.html" target="_blank" rel="noopener noreferrer" style={{ fontSize: TYP.bedien, color: C.inkLeise, textDecoration: 'none', whiteSpace: 'nowrap' }}>
      in eigenem Fenster ›
    </a>
  );

  // Ganze Seite: nur eine schmale Leiste über dem Dashboard, sonst nichts.
  if (voll) {
    return (
      <div style={{ color: C.ink, fontFamily: SCHRIFT.text }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 14, padding: '10px 16px' }}>
          {schalter}{fenster}
        </div>
        <iframe src="/finanz-dashboard.html" title="Finanz-Dashboard"
          style={{ display: 'block', width: '100%', border: 0, background: C.grund, height: 'calc(100vh - 62px)' }} />
      </div>
    );
  }

  return (
    <Seite titel="Malins Dashboard" unter="Euer eigenes Dashboard — läuft mit seiner eigenen Datenablage weiter, hier nur eingebettet."
      rechts={<span style={{ display: 'flex', alignItems: 'center', gap: 14 }}>{schalter}{fenster}</span>}>
      <Karte i={0} akzent={LEUCHT.geld} style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '18px 20px 0' }}>
          <Ueberschrift farbe={LEUCHT.geld}>Finanz-Dashboard</Ueberschrift>
          <p style={{ fontSize: TYP.bedien, color: C.inkDim, margin: '0 0 14px', maxWidth: 680, lineHeight: 1.55 }}>
            Was daraus ins System gehört, holen wir gezielt herüber: Zahlungen landen in der{' '}
            <Link href="/os/finanzen" style={{ color: C.aktiv, textDecoration: 'none' }}>Prioritätenliste</Link>, die Lage im{' '}
            <Link href="/os/controlling" style={{ color: C.aktiv, textDecoration: 'none' }}>Controlling</Link>.
          </p>
        </div>
        <iframe src="/finanz-dashboard.html" title="Finanz-Dashboard"
          style={{ display: 'block', width: '100%', border: 0, background: C.grund, height: 'max(560px, calc(100vh - 260px))' }} />
      </Karte>
    </Seite>
  );
}
