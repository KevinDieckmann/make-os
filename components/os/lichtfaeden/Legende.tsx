'use client';

// ─── Lichtfäden — Legende: je Bündel Farbe, Name, Zahl der Stränge ──────────
// Jedes Bündel, unter dem es weitergeht, ist ein echter Knopf („eine Ebene tiefer“) — der barrierefreie Weg neben dem
// Tippen aufs Band. Zeigen/Fokus hebt das Bündel im Band hervor. Bündel ohne Tiefe mit Detailseite sind Links.

import Link from 'next/link';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import type { Buendel } from '@/lib/lichtfaeden/baum';

export function Legende({ buendel, hervor, onHervor, onTiefer }: { buendel: readonly Buendel[]; hervor: string | null; onHervor: (id: string | null) => void; onTiefer: (b: Buendel) => void }) {
  if (!buendel.length) return null;
  return (
    <ul aria-label="Bündel" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: '2px 14px' }}>
      {buendel.map(b => {
        const an = hervor == null || hervor === b.id;
        const inhalt = (
          <>
            <span aria-hidden="true" style={{ flex: '0 0 auto', width: 16, height: 3, borderRadius: 2, background: b.farbe, boxShadow: `0 0 10px ${b.farbe}80` }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.name}</span>
            <span style={{ color: C.inkLeise, fontVariantNumeric: 'tabular-nums', flex: '0 0 auto' }}>{b.anzahl}</span>
            {b.tiefer && <span aria-hidden="true" style={{ color: C.inkLeise, flex: '0 0 auto' }}>›</span>}
          </>
        );
        const stil = { display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 44, maxWidth: 300, padding: '0 6px', border: 'none', borderRadius: 10, background: 'transparent', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 600, color: an ? C.ink : C.inkLeise, whiteSpace: 'nowrap' as const, textDecoration: 'none', cursor: b.tiefer || b.link ? 'pointer' : 'default' };
        const zeig = { onMouseEnter: () => onHervor(b.id), onMouseLeave: () => onHervor(null), onFocus: () => onHervor(b.id), onBlur: () => onHervor(null) };
        const name = `${b.name}, ${b.anzahl} ${b.anzahl === 1 ? 'Strang' : 'Stränge'}`;
        return (
          <li key={b.id} style={{ minWidth: 0 }}>
            {b.tiefer
              ? <button type="button" className="fassbar licht-buendel" onClick={() => onTiefer(b)} aria-label={`${name} — eine Ebene tiefer`} style={stil} {...zeig}>{inhalt}</button>
              : b.link
                ? <Link href={b.link} className="fassbar licht-buendel" aria-label={`${name} — öffnen`} style={stil} {...zeig}>{inhalt}</Link>
                : <span className="licht-buendel" style={stil} {...zeig}>{inhalt}</span>}
          </li>
        );
      })}
    </ul>
  );
}
