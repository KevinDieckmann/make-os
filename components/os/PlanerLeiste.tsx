'use client';

// ─── MAKE OS — Planer-Leiste ────────────────────────────────────────────────
// Kevins Ansage: „Ich muss überall zwischendrin schnell umschalten können —
// den nächsten Tag angucken, zwei, drei Tage vorausgucken, in den Wochen und
// Monaten hin- und herspringen. Wir brauchen nicht acht verschiedene Tabs,
// sondern eine Maske, in der wir umschalten."
//
// Also: EINE Leiste, die auf jeder Planer-Seite oben steht. Links der Horizont,
// rechts die Zeitnavigation. Wo ein Horizont noch keinen Anker kennt, steht
// die Navigation bewusst nicht da — lieber kein Knopf als ein toter Knopf.

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { THEME as T } from '@/lib/make-one/os-data';
import { localDay } from '@/lib/zeit';

export type Horizont = 'tag' | 'woche' | 'monat' | 'quartal' | 'jahr' | 'routinen';

const HORIZONTE: { id: Horizont; label: string; href: string }[] = [
  { id: 'tag', label: 'Tag', href: '/os/planung' },
  { id: 'woche', label: 'Woche', href: '/os/planung/woche' },
  { id: 'monat', label: 'Monat', href: '/os/planung/monat' },
  { id: 'quartal', label: 'Quartal', href: '/os/planung/quartal' },
  { id: 'jahr', label: 'Jahr & Ziele', href: '/os/planung/jahr' },
  { id: 'routinen', label: 'Routinen', href: '/os/planung/routinen' },
];

const WOCHENTAG = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

/** Tag verschieben, ohne über Zeitzonen zu stolpern. */
export function tagPlus(tag: string, n: number): string {
  const d = new Date(`${tag}T12:00:00`);
  d.setDate(d.getDate() + n);
  return localDay(d);
}

export function tagLabel(tag: string, heute: string): string {
  if (tag === heute) return 'Heute';
  if (tag === tagPlus(heute, 1)) return 'Morgen';
  if (tag === tagPlus(heute, -1)) return 'Gestern';
  const d = new Date(`${tag}T12:00:00`);
  return `${WOCHENTAG[d.getDay()]} ${tag.slice(8)}.${tag.slice(5, 7)}.`;
}

export function PlanerLeiste({ aktiv, tag }: { aktiv: Horizont; tag?: string }) {
  const router = useRouter();
  const heute = localDay();
  const anker = tag ?? heute;

  const springe = (n: number) => router.push(`/os/planung?tag=${tagPlus(anker, n)}`);

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
        {HORIZONTE.map(h => (
          <Link key={h.id} href={h.href}
            style={{
              fontFamily: T.sans, fontSize: 12.5, textDecoration: 'none', padding: '6px 13px', borderRadius: 9,
              border: `1px solid ${aktiv === h.id ? T.accent : T.line}`,
              background: aktiv === h.id ? T.accentSoft : 'transparent',
              color: aktiv === h.id ? T.accent : T.inkDim,
              fontWeight: aktiv === h.id ? 700 : 500,
            }}>{h.label}</Link>
        ))}
      </div>

      {/* Zeitnavigation — bisher nur für den Tag, weil nur der einen Anker kennt */}
      {aktiv === 'tag' && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 9 }}>
          <button onClick={() => springe(-1)} aria-label="Tag zurück"
            style={{ fontFamily: T.mono, fontSize: 12, color: T.inkDim, background: 'transparent', border: `1px solid ${T.line}`, borderRadius: 8, padding: '5px 10px', cursor: 'pointer' }}>‹</button>
          {/* Die nächsten Tage auf einen Blick — „zwei, drei Tage vorausgucken" */}
          {[-1, 0, 1, 2, 3].map(n => {
            const d = tagPlus(heute, n);
            const an = d === anker;
            return (
              <Link key={n} href={`/os/planung?tag=${d}`}
                style={{
                  fontFamily: T.mono, fontSize: 11, textDecoration: 'none', padding: '5px 11px', borderRadius: 8,
                  border: `1px solid ${an ? T.accent : T.line}`,
                  background: an ? T.accentSoft : 'transparent',
                  color: an ? T.accent : T.muted,
                  fontWeight: an ? 700 : 400,
                }}>{tagLabel(d, heute)}</Link>
            );
          })}
          <button onClick={() => springe(1)} aria-label="Tag vor"
            style={{ fontFamily: T.mono, fontSize: 12, color: T.inkDim, background: 'transparent', border: `1px solid ${T.line}`, borderRadius: 8, padding: '5px 10px', cursor: 'pointer' }}>›</button>
          {anker !== heute && (
            <Link href="/os/planung" style={{ fontFamily: T.mono, fontSize: 11, color: T.accentInk, textDecoration: 'none', marginLeft: 6 }}>↩ zurück zu heute</Link>
          )}
        </div>
      )}
    </div>
  );
}
