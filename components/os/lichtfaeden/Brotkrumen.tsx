'use client';

// ─── Lichtfäden — Brotkrumen „Gesamt › Privat › Gesundheit › …“ ─────────────
// Jede Ebene oberhalb der aktuellen ist ein Knopf (zurück = die Fäden fließen zusammen), die aktuelle steht als Text mit
// `aria-current`. Am Handy wischbar in einer Zeile, Tippziele 44 px. `oben` begrenzt, wie weit man zurück darf (Ziel-Seite: das Ziel).

import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import type { Knoten } from '@/lib/lichtfaeden/modell';

export function Brotkrumen({ pfad, onWahl, oben }: { pfad: readonly Knoten[]; onWahl: (id: string) => void; oben?: string }) {
  const ab = oben ? Math.max(0, pfad.findIndex(k => k.id === oben)) : 0;
  const sichtbar = pfad.slice(ab);
  return (
    <nav aria-label="Ebene der Lichtfäden" className="ui-wisch" style={{ display: 'flex', alignItems: 'center', gap: 2, overflowX: 'auto', minWidth: 0, scrollbarWidth: 'none' }}>
      {sichtbar.map((k, i) => {
        const letzte = i === sichtbar.length - 1;
        return (
          <span key={k.id} style={{ display: 'inline-flex', alignItems: 'center', flex: '0 0 auto' }}>
            {i > 0 && <span aria-hidden="true" style={{ color: C.inkLeise, padding: '0 4px', fontSize: TYP.bedien }}>›</span>}
            {letzte
              ? <span aria-current="page" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 44, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 700, color: C.ink, whiteSpace: 'nowrap' }}>
                  <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: k.farbe, boxShadow: `0 0 8px ${k.farbe}80` }} />{k.name}
                </span>
              : <button type="button" className="fassbar licht-krume" onClick={() => onWahl(k.id)}
                  style={{ minHeight: 44, padding: '0 6px', border: 'none', background: 'transparent', color: C.inkDim, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', borderRadius: 10 }}>{k.name}</button>}
          </span>
        );
      })}
    </nav>
  );
}
