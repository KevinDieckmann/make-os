'use client';

// ─── MAKE OS — Onboarding-Erinnerung ────────────────────────────────────────
// Kevins Wunsch: „dass ihr Onboarding als Pop-up immer mal wieder aufploppt."
//
// Immer mal wieder heißt: höchstens einmal alle vier Stunden, nie zweimal in
// derselben Sitzung, und nur solange die eigene Spur noch offen ist. Ein
// Hinweis, der zu oft kommt, wird weggeklickt statt gelesen — dann hilft er
// niemandem mehr. Wer ihn wegklickt, hat für heute Ruhe.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { THEME as T } from '@/lib/make-one/os-data';
import { personLesen } from '@/lib/make-one/arbeitsplatz-browser';
import { SCHRITTE } from '@/lib/make-one/onboarding-data';

const MERKER = 'make-os-onboarding-erinnerung';
const ABSTAND_STD = 4;

interface Befund { erfuellt: boolean; wert: string }

export function OnboardingErinnerung() {
  const pfad = usePathname();
  const [zeigen, setZeigen] = useState(false);
  const [person, setPerson] = useState<string>('kevin');
  const [offen, setOffen] = useState(0);
  const [gesamt, setGesamt] = useState(0);
  const [naechster, setNaechster] = useState('');

  useEffect(() => {
    // Nicht im Onboarding selbst nerven — dort arbeitet sie ja gerade daran.
    if (pfad?.startsWith('/os/onboarding')) return;

    let zuletzt = 0;
    try { zuletzt = Number(localStorage.getItem(MERKER) ?? 0); } catch { /* egal */ }
    if (Date.now() - zuletzt < ABSTAND_STD * 3600_000) return;

    fetch('/api/onboarding').then(r => r.json()).catch(() => null).then(o => {
      if (!o) return;
      // Wer hier sitzt, steht im Browser — jeder wird an seine Spur erinnert.
      const p = personLesen();
      const meine = SCHRITTE.filter(s => s.spur === p);
      const fertig = (s: typeof meine[number]) =>
        (s.pruefung && (o.befunde as Record<string, Befund>)?.[s.pruefung]?.erfuellt) || !!o.erledigt?.[s.id];
      const rest = meine.filter(s => !fertig(s));
      if (!rest.length) return;
      setPerson(p);
      setOffen(rest.length);
      setGesamt(meine.length);
      setNaechster(rest[0].titel);
      setZeigen(true);
    });
  }, [pfad]);

  const wegklicken = () => {
    setZeigen(false);
    try { localStorage.setItem(MERKER, String(Date.now())); } catch { /* egal */ }
  };

  if (!zeigen) return null;

  return (
    <div style={{
      position: 'fixed', left: 20, bottom: 20, zIndex: 65, width: 'min(340px, calc(100vw - 40px))',
      background: T.panel, border: `1px solid ${T.lineHot}`, borderLeft: `3px solid ${T.accent}`,
      borderRadius: 14, padding: '14px 16px', boxShadow: '0 18px 50px rgba(0,0,0,.5)',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: T.accent }}>
          Onboarding · {person === 'malin' ? 'Malin' : 'Kevin'}
        </span>
        <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, marginLeft: 'auto' }}>
          {gesamt - offen}/{gesamt}
        </span>
        <button onClick={wegklicken} aria-label="Später erinnern" title="Später erinnern"
          style={{ background: 'transparent', border: 'none', color: T.muted, cursor: 'pointer', fontSize: 12, padding: 0 }}>✕</button>
      </div>
      <div style={{ fontSize: 13, color: T.ink, lineHeight: 1.5, marginTop: 7 }}>
        Noch <strong>{offen}</strong> {offen === 1 ? 'Schritt' : 'Schritte'}, bis alles läuft.
      </div>
      <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.45, marginTop: 3 }}>
        Als Nächstes: {naechster}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 11 }}>
        <Link href={`/os/onboarding/${person}`} onClick={wegklicken} style={{
          flex: 1, textAlign: 'center', fontFamily: T.sans, fontSize: 12.5, fontWeight: 700,
          padding: '7px 0', borderRadius: 9, textDecoration: 'none',
          background: T.accent, color: T.void,
        }}>Weitermachen</Link>
        <button onClick={wegklicken} style={{
          fontFamily: T.sans, fontSize: 12.5, padding: '7px 12px', borderRadius: 9, cursor: 'pointer',
          border: `1px solid ${T.line}`, background: 'transparent', color: T.muted,
        }}>Später</button>
      </div>
    </div>
  );
}
