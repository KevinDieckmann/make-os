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
//
// 24.09.: auf das lebendige Bild angeglichen — die Reiter sehen aus wie
// `Segmente` aus ./schlank (aktiver Reiter hell auf dunkler Pille), bleiben
// aber Links, damit Vorladen und Verlauf weiter funktionieren.

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
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

/** Die dunkle Pille, in der die Reiter sitzen — wie bei `Segmente`. */
const pille = { display: 'inline-flex', gap: 2, background: 'rgba(255,255,255,.06)', borderRadius: 12, padding: 3, flexWrap: 'wrap' as const, alignItems: 'center' };

/** Ein Reiter in der Pille: aktiv hell auf dunkel, sonst leise. */
const reiter = (an: boolean, klein = false) => ({
  fontFamily: SCHRIFT.text, fontSize: klein ? 12 : TYP.bedien, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' as const,
  padding: klein ? '6px 11px' : '7px 14px', borderRadius: klein ? 9 : 10, border: 'none', cursor: 'pointer',
  transition: 'background .2s ease, color .2s ease',
  background: an ? C.ink : 'transparent', color: an ? C.grund : C.inkDim,
});

export function PlanerLeiste({ aktiv, tag }: { aktiv: Horizont; tag?: string }) {
  const router = useRouter();
  const heute = localDay();
  const anker = tag ?? heute;

  const springe = (n: number) => router.push(`/os/planung?tag=${tagPlus(anker, n)}`);

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={pille}>
        {HORIZONTE.map(h => (
          <Link key={h.id} href={h.href} style={reiter(aktiv === h.id)}>{h.label}</Link>
        ))}
      </div>

      {/* Zeitnavigation — bisher nur für den Tag, weil nur der einen Anker kennt */}
      {aktiv === 'tag' && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
          <div style={pille}>
            <button onClick={() => springe(-1)} aria-label="Tag zurück" style={{ ...reiter(false, true), padding: '6px 10px' }}>‹</button>
            {/* Die nächsten Tage auf einen Blick — „zwei, drei Tage vorausgucken" */}
            {[-1, 0, 1, 2, 3].map(n => {
              const d = tagPlus(heute, n);
              const an = d === anker;
              return (
                <Link key={n} href={`/os/planung?tag=${d}`} style={reiter(an, true)}>{tagLabel(d, heute)}</Link>
              );
            })}
            <button onClick={() => springe(1)} aria-label="Tag vor" style={{ ...reiter(false, true), padding: '6px 10px' }}>›</button>
          </div>
          {anker !== heute && (
            <Link href="/os/planung" style={{ fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 700, color: C.aktiv, textDecoration: 'none', marginLeft: 4 }}>↩ zurück zu heute</Link>
          )}
        </div>
      )}
    </div>
  );
}
