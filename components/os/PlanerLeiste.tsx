'use client';

// ─── MAKE OS — Planer-Leiste ────────────────────────────────────────────────
// Kevins Ansage: „Ich muss überall zwischendrin schnell umschalten können —
// den nächsten Tag angucken, zwei, drei Tage vorausgucken, in den Wochen und
// Monaten hin- und herspringen. Wir brauchen nicht acht verschiedene Tabs,
// sondern eine Maske, in der wir umschalten."
//
// 24.09.: auf das lebendige Bild angeglichen — die Reiter sehen aus wie
// `Segmente` aus ./schlank (aktiver Reiter hell auf dunkler Pille), bleiben
// aber Links, damit Vorladen und Verlauf weiter funktionieren.
//
// 22.10. abends (Werkzeug Planung, Gruppe A — Kevin: „Ja, alle Empfehlungen“): die Horizonte (Jahr & Ziele · Quartal · Monat · Tag) und
// Rhythmus & Zeit (Routinen · Kapazität) stehen als Menü in der linken Leiste (lib/make-one/werkzeuge.ts `PLANUNG_WERKZEUG`, am Handy oben im
// Blatt „Menü“); „Woche planen ↗“ führt von dort in Kalender › Planen. Diese Leiste trägt darum nur noch die Zeitnavigation des Tages — keine
// doppelte Navigation. Fokus, Kompass und Wachstum gehören nicht zur Planung (Fokus-Seite oben rechts im Kopf, 10.10.).

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { localDay } from '@/lib/zeit';

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
const reiter = (an: boolean) => ({
  fontFamily: SCHRIFT.text, fontSize: 12, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' as const,
  padding: '6px 11px', borderRadius: 9, border: 'none', cursor: 'pointer',
  transition: 'background .2s ease, color .2s ease',
  background: an ? C.ink : 'transparent', color: an ? C.grund : C.inkDim,
});

/** Die Zeitnavigation des Tages (Planung › Tag): Tag zurück/vor, die nächsten Tage auf einen Blick, „zurück zu heute“ — der Space wandert mit. */
export function PlanerLeiste({ tag }: { tag?: string }) {
  const router = useRouter();
  const heute = localDay();
  const anker = tag ?? heute;
  // Der Space (Privat/Business) wandert mit (26.09.).
  const sp = useSearchParams().get('space');
  const space = sp === 'privat' || sp === 'business' ? sp : null;
  const mit = (href: string) => (space ? `${href}${href.includes('?') ? '&' : '?'}space=${space}` : href);

  const springe = (n: number) => router.push(mit(`/os/planung?tag=${tagPlus(anker, n)}`));

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
      <div style={pille}>
        <button onClick={() => springe(-1)} aria-label="Tag zurück" style={{ ...reiter(false), padding: '6px 10px' }}>‹</button>
        {/* Die nächsten Tage auf einen Blick — „zwei, drei Tage vorausgucken" */}
        {[-1, 0, 1, 2, 3].map(n => {
          const d = tagPlus(heute, n);
          const an = d === anker;
          return (
            <Link key={n} href={mit(`/os/planung?tag=${d}`)} className="planer-reiter" style={reiter(an)}>{tagLabel(d, heute)}</Link>
          );
        })}
        <button onClick={() => springe(1)} aria-label="Tag vor" style={{ ...reiter(false), padding: '6px 10px' }}>›</button>
      </div>
      {anker !== heute && (
        <Link href={mit('/os/planung')} style={{ fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 700, color: C.aktiv, textDecoration: 'none', marginLeft: 4 }}>↩ zurück zu heute</Link>
      )}
    </div>
  );
}
