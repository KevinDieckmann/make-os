'use client';

// ─── MAKE OS — Finanz-Dashboard ─────────────────────────────────────────────
// Das gewachsene Dashboard, das Kevin und Malin selbst gebaut haben, läuft
// hier unverändert weiter — eingebettet, damit man es nicht mehr separat
// öffnen muss. Es hängt an seiner eigenen Datenablage; was daraus ins System
// gehört (Zahlungen, Rechnungen), holen wir gezielt herüber.
// 24.09.: auf das lebendige Muster umgezogen (Seite + Karte, Knopf).
// 08.10. (Aufräumen Etappe 2): keine eigene Seite mehr — Altbestand unter Finanzen › Privat › Planung › Selbstständigkeit,
// geladen erst auf Klick (/os/finanzen/dashboard leitet dorthin weiter).

import Link from 'next/link';
import { WEG } from '@/lib/wege';
import { useState } from 'react';
import { FARBE as C, SCHRIFT, TYP, RAND } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, LEUCHT } from './ui';

export function FinanzDashboardView() {
  const [voll, setVoll] = useState(false);

  const schalter = <Knopf leise onClick={() => setVoll(!voll)}>{voll ? '↙ Rahmen zeigen' : '↗ Ganze Seite'}</Knopf>;
  const fenster = (
    <a href="/finanz-dashboard.html" target="_blank" rel="noopener noreferrer" className="ui-knopf fassbar" style={{ border: `1px solid ${RAND.stark}`, background: 'rgba(255,255,255,.05)', color: C.ink }}>
      In eigenem Fenster ›
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
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: '8px 14px' }}>{schalter}{fenster}</div>
      <Karte i={0} akzent={LEUCHT.geld} style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '18px 20px 0' }}>
          <Ueberschrift farbe={LEUCHT.geld}>Finanz-Dashboard</Ueberschrift>
          <p style={{ fontSize: TYP.bedien, color: C.inkDim, margin: '0 0 14px', maxWidth: 680, lineHeight: 1.55 }}>
            Was daraus ins System gehört, holen wir gezielt herüber: Zahlungen landen unter{' '}
            <Link href={WEG.rechnungen()} style={{ color: C.aktiv, textDecoration: 'none' }}>Rechnungen &amp; Zahlungen</Link>, die Lage im{' '}
            <Link href={WEG.controlling()} style={{ color: C.aktiv, textDecoration: 'none' }}>Controlling</Link>.
          </p>
        </div>
        <iframe src="/finanz-dashboard.html" title="Finanz-Dashboard"
          style={{ display: 'block', width: '100%', border: 0, background: C.grund, height: 'max(560px, calc(100vh - 260px))' }} />
      </Karte>
    </>
  );
}
