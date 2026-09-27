'use client';

// ─── Kalender: Monatsblatt (27.09.) ─────────────────────────────────────────
// Sechs Wochen, Montag zuerst; je Tag höchstens drei Pillen, der Rest als
// „+n mehr“ (Klick öffnet den Tag). Fristen und Erinnerungen als kleine Punkte.

import { FARBE as C, SCHRIFT } from '@/lib/make-one/design';
import { LEUCHT } from '../schlank';
import { FRIST_ZEICHEN, type KTermin, type KFrist, type KErinnerung } from './teile';

const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MAX = 3;

export function Monat({ blatt, monat, heute, termine, fristen, erinnerungen, farbe, onTag, onOeffnen }: {
  blatt: string[]; monat: number; heute: string; termine: KTermin[]; fristen: KFrist[]; erinnerungen: KErinnerung[];
  farbe: (t: KTermin) => string; onTag: (tag: string) => void; onOeffnen: (t: KTermin) => void;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', height: '100%', minHeight: 0, border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, overflow: 'hidden', background: 'rgba(255,255,255,.015)', fontFamily: SCHRIFT.text }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
        {WD.map(w => <div key={w} style={{ padding: '8px 6px', textAlign: 'center', fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: C.inkLeise, fontWeight: 700 }}>{w}</div>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridTemplateRows: 'repeat(6, 1fr)', minHeight: 0 }}>
        {blatt.map(tag => {
          const imMonat = Number(tag.slice(5, 7)) === monat;
          const h = tag === heute;
          const heutige = termine.filter(t => t.start.slice(0, 10) <= tag && (t.ende.slice(0, 10) > tag || (t.ende.slice(0, 10) === tag && !t.ganztags && t.ende.slice(11, 16) > '00:00' && t.start.slice(0, 10) === tag))).sort((a, b) => Number(b.ganztags) - Number(a.ganztags) || a.start.localeCompare(b.start));
          const fr = fristen.filter(f => f.tag === tag); const er = erinnerungen.filter(e => e.tag === tag);
          const rest = heutige.length - MAX;
          return (
            <div key={tag} onClick={() => onTag(tag)} style={{ minWidth: 0, minHeight: 92, padding: '5px 5px 4px', borderRight: '1px solid rgba(255,255,255,.05)', borderBottom: '1px solid rgba(255,255,255,.05)', background: h ? 'rgba(255,255,255,.03)' : undefined, opacity: imMonat ? 1 : .45, cursor: 'pointer', display: 'grid', gridTemplateRows: 'auto 1fr', gap: 3, alignContent: 'start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', fontSize: 12.5, fontWeight: 700, background: h ? LEUCHT.puls : 'transparent', color: h ? '#0b0b0c' : C.inkDim }}>{Number(tag.slice(8, 10))}</span>
                {fr.slice(0, 3).map(f => <span key={f.id} title={`${FRIST_ZEICHEN[f.art].label}: ${f.titel}`} style={{ fontSize: 11, color: FRIST_ZEICHEN[f.art].farbe }}>{FRIST_ZEICHEN[f.art].zeichen}</span>)}
                {er.length > 0 && <span title={`${er.length} Erinnerungen`} style={{ fontSize: 11, color: LEUCHT.schlaf }}>◷{er.length > 1 ? er.length : ''}</span>}
              </div>
              <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                {heutige.slice(0, MAX).map(t => { const f = farbe(t); return (
                  <button key={t.id} type="button" onClick={e => { e.stopPropagation(); onOeffnen(t); }} title={`${t.titel} · ${t.ganztags ? 'ganztägig' : t.start.slice(11, 16)} · ${t.kalender}`}
                    style={{ display: 'flex', gap: 4, alignItems: 'center', minWidth: 0, textAlign: 'left', border: 'none', borderRadius: 5, padding: '1px 5px', fontSize: 11, fontWeight: 600, lineHeight: 1.4, cursor: 'pointer', fontFamily: SCHRIFT.text,
                      background: t.ganztags ? `${f}2a` : 'transparent', color: t.ganztags ? C.ink : C.inkDim }}>
                    {!t.ganztags && <span style={{ width: 6, height: 6, borderRadius: '50%', background: f, flex: '0 0 auto' }} />}
                    {!t.ganztags && <span style={{ color: C.inkLeise, fontVariantNumeric: 'tabular-nums' }}>{t.start.slice(11, 16)}</span>}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.titel}</span>
                  </button>
                ); })}
                {rest > 0 && <span style={{ fontSize: 11, color: C.inkLeise, paddingLeft: 5 }}>+{rest} mehr</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
