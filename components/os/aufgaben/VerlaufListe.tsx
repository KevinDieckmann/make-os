'use client';
// ─── Verlauf je Aufgabe / je Projekt (28.09. spät) ──────────────────────────
// Wer, wann, was — der Server schreibt ihn (lib/aufgaben/verlauf.ts); hier nur die Anzeige, neueste oben.

import { FARBE as C, TYP } from '@/lib/make-one/design';
import { verlaufText } from '@/lib/aufgaben/verlauf';
import type { EigenesFeld, Task, VerlaufEintrag } from '@/types/tasks';
import { zeitKurz, type Person } from './hilfe';

export function VerlaufListe({ eintraege, personen, felder = [], aufgabe, max = 60, onAufgabe }: {
  eintraege: readonly (VerlaufEintrag & { aufgabe?: Pick<Task, 'id' | 'title'> })[];
  personen: readonly Person[];
  felder?: readonly EigenesFeld[];
  /** Nur im Projekt-Verlauf: die Aufgabe je Eintrag zeigen. */
  aufgabe?: boolean;
  max?: number;
  onAufgabe?: (id: string) => void;
}) {
  const name = (s: string) => (s === 'system' ? 'System' : personen.find(p => p.speicher === s)?.name ?? s);
  const liste = [...eintraege].reverse().slice(0, max);
  if (!liste.length) return <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Noch kein Verlauf — ab jetzt steht hier jede Änderung.</div>;
  return (
    <div style={{ display: 'grid' }}>
      {liste.map((v, i) => (
        <div key={`${v.am}-${i}`} style={{ display: 'flex', gap: 10, alignItems: 'baseline', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,.045)', fontSize: 12.5, flexWrap: 'wrap' }}>
          <span style={{ color: C.inkLeise, fontVariantNumeric: 'tabular-nums', flex: '0 0 auto', minWidth: 92 }}>{zeitKurz(v.am)}</span>
          <span style={{ color: C.inkDim, fontWeight: 600 }}>{v.was === 'zusammengefasst' ? '' : `${name(v.von)}${v.durch === 'zoe' ? ' (über ZOE)' : ''}`}</span>
          <span style={{ color: C.ink, minWidth: 0 }}>{verlaufText(v, id => felder.find(f => f.id === id)?.name, name)}</span>
          {aufgabe && v.aufgabe && (onAufgabe
            ? <button onClick={() => onAufgabe(v.aufgabe!.id)} className="fassbar" style={{ background: 'none', border: 'none', padding: 0, color: C.aktiv, cursor: 'pointer', fontSize: 12.5, marginLeft: 'auto', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.aufgabe.title}</button>
            : <span style={{ color: C.inkLeise, marginLeft: 'auto' }}>{v.aufgabe.title}</span>)}
        </div>
      ))}
      {eintraege.length > max && <div style={{ fontSize: 12, color: C.inkLeise, paddingTop: 6 }}>… {eintraege.length - max} ältere Einträge</div>}
    </div>
  );
}
