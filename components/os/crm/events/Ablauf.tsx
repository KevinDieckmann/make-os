'use client';

// ─── Event · Ablauf — der Abend in Uhrzeit und Punkt ────────────────────────
// Steht auch in der Kalender-Datei (ohne Gäste, ohne Ziel). Gespeichert wird
// immer nach Uhrzeit sortiert; leere Punkte verwirft der Server.

import { useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Ueberschrift, Knopf, Leer, feld } from '../../schlank';
import { VORLAGEN } from '@/lib/crm/eventplanung';
import type { Event } from '@/lib/crm/typen';
import { Feld } from '../teile';
import { eventSetzen, type ReiterProps } from './gemeinsam';

type Punkt = NonNullable<Event['ablauf']>[number];
const sortiert = (l: Punkt[]) => [...l].sort((a, b) => a.zeit.localeCompare(b.zeit));

export function Ablauf({ e, api }: ReiterProps) {
  const [zeit, setZeit] = useState('');
  const [punkt, setPunkt] = useState('');
  const liste = sortiert(e.ablauf ?? []);
  const speichern = (neu: Punkt[]) => eventSetzen(api, e, { ablauf: sortiert(neu) });
  const aendern = (i: number, teil: Partial<Punkt>) => speichern(liste.map((a, j) => (j === i ? { ...a, ...teil } : a)));
  const dazu = () => { if (!punkt.trim()) return; void speichern([...liste, { zeit, punkt: punkt.trim() }]); setPunkt(''); };
  const vorlage = VORLAGEN.find(v => v.format === e.format);

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <Ueberschrift rechts={liste.length ? `${liste[0].zeit || '—'} bis ${liste[liste.length - 1].zeit || '—'}` : undefined}>Ablauf</Ueberschrift>
      {liste.map((a, i) => (
        <div key={`${i}-${a.zeit}`} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Feld typ="time" wert={a.zeit} breite={110} platzhalter="Uhrzeit" onFertig={z => aendern(i, { zeit: z })} />
          <div style={{ flex: 1, minWidth: 0 }}><Feld wert={a.punkt} platzhalter="Punkt" onFertig={p => (p.trim() ? aendern(i, { punkt: p.trim() }) : speichern(liste.filter((_, j) => j !== i)))} /></div>
          <button onClick={() => speichern(liste.filter((_, j) => j !== i))} aria-label="Punkt entfernen" style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: TYP.body }}>×</button>
        </div>
      ))}
      {!liste.length && (
        <Leer>
          Noch kein Ablauf. Ein Abend mit Absicht: Ankommen, Begrüßung mit der einen Frage, Impuls, Austausch — der Gastgeber stellt Leute einander vor.
          {vorlage && <div style={{ marginTop: 10 }}><Knopf leise onClick={() => speichern(vorlage.ablauf.map(a => ({ ...a })))}>Ablauf „{vorlage.label}“ übernehmen</Knopf></div>}
        </Leer>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="time" value={zeit} onChange={x => setZeit(x.target.value)} aria-label="Uhrzeit" style={{ ...feld, width: 110, fontSize: TYP.bedien, padding: '8px 11px' }} />
        <input value={punkt} onChange={x => setPunkt(x.target.value)} onKeyDown={x => { if (x.key === 'Enter') dazu(); }} placeholder="Neuer Punkt, z. B. Begrüßung und Vorstellungsrunde" aria-label="Neuer Punkt"
          style={{ ...feld, flex: 1, minWidth: 200, width: 'auto', fontSize: TYP.bedien, padding: '8px 11px' }} />
        <Knopf leise aus={!punkt.trim()} onClick={dazu}>+ Punkt</Knopf>
      </div>
    </div>
  );
}
