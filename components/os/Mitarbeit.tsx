'use client';

// ─── Wer ist gerade da? (24.09., zu zweit arbeiten) ─────────────────────────
// Kevin: „Wenn wir beide in der Software arbeiten, müssen wir alles perfekt
// zusammen ausarbeiten können.“ Einzeländerungen verhindern, dass sich zwei
// ganze Listen überschreiben. Ändern beide DENSELBEN Eintrag, gewinnt der
// letzte Klick — deshalb sichtbar machen: „Malin ist gerade hier.“
// Meldet alle 30 Sekunden die eigene Seite (Person kommt serverseitig aus der
// Sitzung) und zeigt, wer sonst gerade in MAKE OS ist.

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { FARBE as C, SCHRIFT } from '@/lib/make-one/design';
import { LEUCHT } from '@/lib/make-one/design';

interface Aktiv { person: string; name: string; pfad: string; seitSek: number }

const BEREICH: [RegExp, string][] = [
  [/^\/os\/finanzen/, 'Zahlen'], [/^\/os\/controlling/, 'Controlling'], [/^\/os\/aufgaben/, 'Aufgaben'], [/^\/os\/gesundheit/, 'Gesundheit'],
  [/^\/os\/inbox/, 'Inbox'], [/^\/os\/(crm|netzwerk|kontakte)/, 'Kontakte'], [/^\/os\/wissen/, 'Wissen'], [/^\/os\/?$/, 'Heute'],
];
const bereich = (pfad: string) => BEREICH.find(([r]) => r.test(pfad))?.[1] ?? 'MAKE OS';

export function Mitarbeit() {
  const pfad = usePathname() ?? '/os';
  const [andere, setAndere] = useState<Aktiv[]>([]);
  useEffect(() => {
    let weg = false;
    const melden = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        await fetch('/api/state/anwesenheit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pfad }) });
        const d = await fetch('/api/state/anwesenheit').then(r => r.json());
        if (!weg) setAndere(((d.aktiv ?? []) as Aktiv[]).filter(a => a.person !== d.ich));
      } catch { /* still */ }
    };
    void melden();
    const t = setInterval(melden, 30_000);
    return () => { weg = true; clearInterval(t); };
  }, [pfad]);
  if (!andere.length) return null;
  return (
    <div style={{ position: 'fixed', right: 96, bottom: 26, zIndex: 60, display: 'grid', gap: 6, justifyItems: 'end', pointerEvents: 'none' }} className="os-mitarbeit">
      {andere.map(a => {
        const hier = a.pfad.split('?')[0] === pfad;
        return (
          <Link key={a.person} href={a.pfad} style={{ pointerEvents: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 999, textDecoration: 'none',
            background: 'rgba(20,24,26,.92)', border: `1px solid ${hier ? LEUCHT.beziehung : 'rgba(255,255,255,.08)'}`, color: C.ink, fontFamily: SCHRIFT.text, fontSize: 12.5, boxShadow: '0 6px 20px -8px rgba(0,0,0,.6)' }}
            title={hier ? 'Ihr seid auf derselben Seite — ändert nicht gleichzeitig denselben Eintrag.' : 'Klick: dorthin wechseln'}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: LEUCHT.beziehung, boxShadow: `0 0 8px ${LEUCHT.beziehung}` }} />
            {hier ? <><b>{a.name}</b>&nbsp;ist auch hier</> : <><b>{a.name}</b>&nbsp;ist in {bereich(a.pfad)}</>}
          </Link>
        );
      })}
    </div>
  );
}
