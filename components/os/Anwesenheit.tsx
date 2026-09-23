'use client';

// ─── MAKE OS — Anwesenheit ──────────────────────────────────────────────────
// Meldet alle 30 Sekunden, wo man gerade ist, und zeigt den anderen an, wenn
// er da ist. Zwei Aufgaben in einem kleinen Baustein:
//
//   1. Auf DERSELBEN Seite: „Malin ist auch hier" — der Moment, in dem man
//      sich gegenseitig ins Gehege kommt.
//   2. Auf einer anderen Seite: dezent, nur der Ort.
//
// Das ist bewusst keine Sperre. Zu zweit ist Wissen besser als Verbieten.

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { THEME as T } from '@/lib/make-one/os-data';
import { personLesen, beiWechsel } from '@/lib/make-one/arbeitsplatz-browser';
import { bereichFuerPfad } from '@/lib/make-one/bereiche';

interface Da { person: string; pfad: string; seitSek: number }

const NAME: Record<string, string> = { kevin: 'Kevin', malin: 'Malin' };

export function Anwesenheit() {
  const pfad = usePathname();
  const [ich, setIch] = useState('kevin');
  const [andere, setAndere] = useState<Da[]>([]);

  useEffect(() => { setIch(personLesen()); return beiWechsel(() => setIch(personLesen())); }, []);

  useEffect(() => {
    if (!pfad?.startsWith('/os')) return;
    let lebt = true;

    const melden = () => {
      fetch('/api/state/anwesenheit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ person: personLesen(), pfad }), keepalive: true,
      }).catch(() => { /* leise */ });
    };
    const holen = () => {
      fetch('/api/state/anwesenheit', { cache: 'no-store' })
        .then(r => r.json())
        .then((d: { aktiv?: Da[] }) => {
          if (!lebt) return;
          setAndere((d.aktiv ?? []).filter(e => e.person !== personLesen()));
        })
        .catch(() => { /* leise */ });
    };

    melden(); holen();
    const iv = setInterval(() => { melden(); holen(); }, 30_000);
    return () => { lebt = false; clearInterval(iv); };
  }, [pfad]);

  if (!andere.length) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0 14px 10px' }}>
      {andere.map(a => {
        const hier = a.pfad === pfad;
        const bereich = bereichFuerPfad(a.pfad);
        const wo = hier ? 'ist auch hier' : `ist in ${bereich?.titel ?? a.pfad.replace('/os/', '').replace('/os', 'der Übersicht')}`;
        const farbe = a.person === 'malin' ? T.amber : T.accentInk;
        return (
          <div key={a.person} title={`${NAME[a.person] ?? a.person} · ${a.pfad} · vor ${a.seitSek}s gesehen`}
            style={{
              display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, lineHeight: 1.35,
              color: hier ? farbe : T.muted,
              background: hier ? `${farbe}14` : 'transparent',
              border: `1px solid ${hier ? `${farbe}44` : 'transparent'}`,
              borderRadius: 8, padding: hier ? '5px 9px' : '2px 3px',
            }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: farbe, flex: '0 0 auto' }} />
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <b style={{ color: farbe, fontWeight: 600 }}>{NAME[a.person] ?? a.person}</b> {wo}
            </span>
          </div>
        );
      })}
    </div>
  );
}
