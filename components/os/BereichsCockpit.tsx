'use client';

// ─── MAKE OS — Bereichs-Cockpit ─────────────────────────────────────────────
// Kevins Ansage: „Für jeden einzelnen Bereich ein kleines Cockpit, wo du alles
// zusammenfasst — und wo man dann wieder auf die einzelnen Sachen draufgehen
// kann. Smarter und aufgeräumter."
//
// Steht auf der Einstiegsseite jedes Bereichs, direkt unter der Kopfzeile:
// links die Lage in Zahlen (dieselben wie auf der Startfläche, eine Quelle),
// rechts alle Seiten des Bereichs als Sprungmarken. Auf Unterseiten erscheint
// es nicht — dort arbeitet man schon.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { THEME as T } from '@/lib/make-one/os-data';
import { FARBE as C, TYP, SCHRIFT, ABSTAND as A, RADIUS } from '@/lib/make-one/design';
import { BEREICHE } from '@/lib/make-one/bereiche';

interface Zahl { wert: string; label: string; farbe?: string }
interface Lage { kennzahlen?: Zahl[]; status?: { text: string; farbe: string } }

const FARBE: Record<string, string> = { gut: T.accent, warn: T.amber, krit: T.crit, still: T.muted };

export function BereichsCockpit() {
  const pfad = usePathname();
  const bereich = BEREICHE.find(b => b.start === pfad);
  const [lage, setLage] = useState<Lage | null>(null);

  useEffect(() => {
    if (!bereich) return;
    let weg = false;
    fetch('/api/startflaeche')
      .then(r => r.json())
      .then((d: { lage?: Record<string, Lage> }) => { if (!weg) setLage(d.lage?.[bereich.id] ?? {}); })
      .catch(() => {});
    return () => { weg = true; };
  }, [bereich]);

  if (!bereich) return null;
  const Icon = bereich.icon;
  const st = lage?.status;

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: '14px clamp(16px,3vw,36px) 0' }}>
      <div style={{
        background: T.panel, border: `1px solid ${T.line}`, borderLeft: `3px solid ${bereich.farbe}`,
        borderRadius: 14, padding: '13px 18px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '0 0 auto' }}>
            <Icon size={15} strokeWidth={1.75} color={bereich.farbe} />
            <span style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>{bereich.titel}</span>
          </span>
          {st && (
            <span style={{
              fontFamily: T.mono, fontSize: 11, borderRadius: 6, padding: '2px 8px', flex: '0 0 auto',
              color: FARBE[st.farbe] ?? T.muted, border: `1px solid ${FARBE[st.farbe] ?? T.muted}44`,
            }}>{st.text}</span>
          )}

          {/* Die Lage in Zahlen — dieselbe Quelle wie die Startfläche */}
          {!!lage?.kennzahlen?.length && (
            <span style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginLeft: 4 }}>
              {lage.kennzahlen.map((z, zi) => (
                <span key={`${z.label}-${zi}`} style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: FARBE[z.farbe ?? ''] ?? T.ink, fontVariantNumeric: 'tabular-nums' }}>{z.wert}</span>
                  <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>{z.label}</span>
                </span>
              ))}
            </span>
          )}

          <Link href="/os/start" style={{ marginLeft: 'auto', fontFamily: T.mono, fontSize: 11, color: T.muted, textDecoration: 'none', flex: '0 0 auto' }}>
            alle Bereiche ›
          </Link>
        </div>

        {/* Sprungmarken: alles im Bereich, ein Klick entfernt */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 10, borderTop: `1px solid ${T.lineSoft}`, paddingTop: 10 }}>
          {bereich.items.filter(i => !i.versteckt).map(it => {
            const hier = it.href === pfad;
            return (
              // Klickziel auf 32 px — vorher 19 px hoch und damit auf einem
              // Laptop schwer zu treffen (UX 2, 06.09.).
              <Link key={it.href} href={it.href}
                style={{
                  display: 'inline-flex', alignItems: 'center', minHeight: 32,
                  fontFamily: SCHRIFT.text, fontSize: TYP.bedien, textDecoration: 'none',
                  padding: `0 ${A.m}px`, borderRadius: RADIUS.bauteil,
                  border: `1px solid ${hier ? C.aktiv : C.linie}`,
                  background: hier ? C.aktivSanft : 'transparent',
                  color: hier ? C.aktiv : C.inkDim,
                }}>{it.label}</Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
