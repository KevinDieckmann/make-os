'use client';

// ─── Kontakt öffnen · einklappbare Karten (28.09.) ──────────────────────────
// Eine Karte mit Kopfzeile (Titel = Knopf), die sich je Person merkt, ob sie
// zu ist (localStorage `mt-akte-zu-<id>`, wie seit 27.09.). Genutzt in allen
// drei Spalten von „Kontakt öffnen“ (Akte.tsx, KontaktSpalten.tsx, KontaktUeber.tsx).

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Karte } from '../ui';

/** Eingeklappte Abschnitte je Person — im Browser gemerkt, ohne Speicher einfach alles offen. */
export function useKlappen(personId: string, vorgabeZu: readonly string[] = []) {
  const [zu, setZu] = useState<string[]>([...vorgabeZu]);
  useEffect(() => {
    try {
      const x = localStorage.getItem(`mt-akte-zu-${personId}`);
      const l: unknown = x ? JSON.parse(x) : null;
      setZu(Array.isArray(l) ? l.filter((a): a is string => typeof a === 'string') : [...vorgabeZu]);
    } catch { setZu([...vorgabeZu]); }
    // Die Vorgabe gilt nur für Personen ohne gemerkten Stand.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId]);
  const umschalten = useCallback((a: string) => setZu(alt => {
    const neu = alt.includes(a) ? alt.filter(x => x !== a) : [...alt, a];
    try { localStorage.setItem(`mt-akte-zu-${personId}`, JSON.stringify(neu)); } catch { /* egal */ }
    return neu;
  }), [personId]);
  return { istZu: (a: string) => zu.includes(a), umschalten };
}
export type Klappen = ReturnType<typeof useKlappen>;

/** Ein einklappbarer Abschnitt: Karte mit Kopfzeile (Titel = Knopf), Inhalt nur offen. `klein` für die schmalen Seitenspalten. */
export function Klappe({ id, titel, unter, rechts, akzent, i, zu, umschalten, klein, children }: {
  id: string; titel: ReactNode; unter?: ReactNode; rechts?: ReactNode; akzent?: string; i: number; zu: boolean; umschalten: (id: string) => void; klein?: boolean; children: ReactNode;
}) {
  const inhaltId = `akte-${id}`;
  return (
    <Karte i={i} akzent={zu ? undefined : akzent} style={klein ? { padding: '14px 16px' } : undefined}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: zu ? 0 : klein ? 10 : 14 }}>
        <button onClick={() => umschalten(id)} aria-expanded={!zu} aria-controls={inhaltId} className="fassbar" title={zu ? 'Aufklappen' : 'Einklappen'}
          style={{ display: 'flex', alignItems: 'flex-start', gap: 8, minWidth: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', fontFamily: SCHRIFT.text, color: C.ink }}>
          <span aria-hidden style={{ display: 'inline-block', width: 12, marginTop: klein ? 3 : 4, fontSize: klein ? 10 : 11, color: C.inkLeise, transform: zu ? 'rotate(-90deg)' : 'none', transition: 'transform .18s ease' }}>▼</span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontFamily: SCHRIFT.display, fontSize: klein ? 14 : 16, fontWeight: 700, letterSpacing: '-.01em', lineHeight: 1.25 }}>{titel}</span>
            {unter && !zu && <span style={{ display: 'block', fontSize: TYP.bedien, color: C.inkLeise, marginTop: 3 }}>{unter}</span>}
          </span>
        </button>
        {rechts && <span style={{ fontSize: TYP.bedien, color: C.inkLeise, display: 'flex', gap: 10, alignItems: 'center', flex: '0 0 auto', marginTop: klein ? 1 : 3 }}>{rechts}</span>}
      </div>
      {!zu && <div id={inhaltId}>{children}</div>}
    </Karte>
  );
}

/** Leiser Textknopf in Kopfzeilen („alle ›“, „+ Hinzufügen“). */
export const leiseKnopf = { background: 'none', border: 'none', color: C.aktiv, cursor: 'pointer', fontSize: TYP.bedien, padding: 0, fontFamily: SCHRIFT.text } as const;

/** Breite eines Elements — für Spalten, die sich nach dem Platz in der Mitte richten, nicht nach dem Fenster. */
export function useBreite<T extends HTMLElement>(): [(el: T | null) => void, number] {
  const [el, setEl] = useState<T | null>(null);
  const [breite, setBreite] = useState(0);
  useEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver(e => setBreite(Math.round(e[0]?.contentRect.width ?? 0)));
    ro.observe(el);
    setBreite(Math.round(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, [el]);
  return [setEl, breite];
}
