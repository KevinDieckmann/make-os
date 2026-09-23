'use client';

// ─── MAKE OS — Die Leiste ───────────────────────────────────────────────────
// Eine Ebene, sechs Einträge, das Konto, ein Zahnrad. Kein Bereichswechsel,
// kein Modus-Schalter, kein Score-Kasten, keine Fußzeile. Was man anklicken
// kann, ist alles, was da ist.
//
// Auf dem Handy wird daraus eine Leiste unten mit fünf Symbolen — so, wie
// Whoop es macht: die Daumen erreichen sie, und sie nimmt keinen Platz weg.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { HAUPT, HANDY, SYSTEM, aktiverEintrag } from '@/lib/make-one/navigation';

export function Leiste() {
  const pfad = usePathname() ?? '/os';
  const aktiv = aktiverEintrag(pfad);
  const [konto, setKonto] = useState<{ name: string } | null>(null);
  useEffect(() => {
    fetch('/api/konto/ich').then(r => r.json()).then(d => { if (d.ich) setKonto(d.ich); }).catch(() => {});
  }, []);
  const vorname = konto?.name.split(' ')[0] ?? '';

  const zeile = (e: typeof HAUPT[number], klein = false) => {
    const an = aktiv.href === e.href;
    const Icon = e.icon;
    return (
      <Link key={e.href} href={e.href} className="fassbar" style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: klein ? '6px 0' : '9px 10px', borderRadius: 9, textDecoration: 'none',
        color: an ? C.aktiv : C.inkDim, background: an && !klein ? C.aktivSanft : 'transparent', transition: 'background .2s ease, color .2s ease',
        fontFamily: SCHRIFT.text, fontSize: klein ? 11 : 14, fontWeight: 500, flexDirection: klein ? 'column' : 'row', flex: klein ? 1 : undefined,
      }}>
        <Icon size={klein ? 20 : 16} strokeWidth={1.75} />
        <span>{e.label}</span>
      </Link>
    );
  };

  return (
    <>
      <nav className="leiste-desktop" aria-label="Hauptnavigation" style={{
        width: 200, flex: '0 0 200px', padding: '22px 14px', borderRight: `1px solid ${C.linie}`, background: C.grund,
        flexDirection: 'column', gap: 2, position: 'sticky', top: 0, height: '100vh',
      }}>
        <Link href="/os" title="Heute" style={{ display: 'flex', alignItems: 'center', gap: 9, fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 15, letterSpacing: '-.01em', padding: '4px 10px 22px', color: C.ink, textDecoration: 'none' }}>
          <span className="zeit-puls" style={{ width: 9, height: 9, borderRadius: '50%', background: C.aktiv, boxShadow: `0 0 10px ${C.aktiv}` }} />MAKE OS
        </Link>
        {HAUPT.map(e => zeile(e))}
        <div style={{ marginTop: 'auto' }}>
          {zeile(SYSTEM)}
          <Link href="/os/konto" title="Mein Konto" style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 10px 4px', color: C.inkDim, textDecoration: 'none', fontSize: TYP.bedien }}>
            <span style={{ width: 24, height: 24, borderRadius: 7, background: C.flaeche, color: C.aktiv, display: 'grid', placeItems: 'center', fontFamily: SCHRIFT.display, fontSize: 11, fontWeight: 700 }}>{(vorname || '?').charAt(0).toUpperCase()}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vorname || '…'}</span>
          </Link>
        </div>
      </nav>

      <nav className="leiste-mobil" aria-label="Hauptnavigation" style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 40, borderTop: `1px solid ${C.linie}`, background: C.grund,
        padding: '6px 8px calc(6px + env(safe-area-inset-bottom))', justifyContent: 'space-around',
      }}>
        {[...HANDY.map(h => HAUPT.find(e => e.href === h)!), SYSTEM].map(e => zeile(e, true))}
      </nav>
    </>
  );
}
