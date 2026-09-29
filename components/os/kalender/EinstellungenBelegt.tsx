'use client';

// ─── Kalender-Einstellungen: „zählt als belegt“ und freie Tage (R-K2 #69/#72, 29.09.) ─
// Zwei Abschnitte in der Einstellungs-Karte des Kalenders (Kalender.tsx reicht `einst` und `setzen` durch — EIN
// Schreibweg, PUT /api/state/kalender-einstellungen):
//   · Je Kalender der Schalter „zählt als belegt“ — wirkt auf freie Zeit und Buchungsseite (lib/kalender/belegt.ts).
//     Ohne Schalter: zugeordnete Kalender zählen, nicht zugeordnete blockieren niemanden (steht als Hinweis daneben).
//   · „Frei, aber nicht gesetzlich“ (24.12., 31.12. …): diese Tage sperren Buchungsseite und freie-Zeit-Suche wie ein
//     Feiertag (lib/kalender/freie-tage.ts). Hinzufügen (TT.MM. + Name) und Entfernen.

import { useState } from 'react';
import { FARBE as C, SCHRIFT } from '@/lib/make-one/design';
import { Knopf, feld, LEUCHT } from '../schlank';
import { zaehltAlsBelegt, zuordnung, type BelegtEinstellungen } from '@/lib/kalender/belegt';
import { freieTageSauber, FREIE_TAGE_STANDARD, type FreierTag } from '@/lib/kalender/freie-tage';

type Einst = BelegtEinstellungen & { freieTage?: FreierTag[] };

export function EinstellungenBelegt({ kalender, einst, setzen }: { kalender: readonly { name: string }[]; einst: Einst | null; setzen: (teil: { belegt?: Record<string, boolean>; freieTage?: FreierTag[] }) => void }) {
  const [neuTag, setNeuTag] = useState('');
  const [neuName, setNeuName] = useState('');
  const [fehler, setFehler] = useState('');
  if (!einst) return null;
  const freie = einst.freieTage ?? [...FREIE_TAGE_STANDARD];
  const hinzu = () => {
    const m = /^(\d{1,2})\.(\d{1,2})\.?$/.exec(neuTag.trim());
    const tag = m ? `${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : '';
    const liste = freieTageSauber([...freie, { tag, name: neuName.trim() }]);
    if (!m || liste.length === freie.length) { setFehler('Tag als TT.MM. (z. B. 24.12.) — und noch nicht in der Liste.'); return; }
    setFehler(''); setNeuTag(''); setNeuName('');
    setzen({ freieTage: liste });
  };
  const klein = { fontSize: 12, color: C.inkLeise } as const;
  return (
    <>
      <div style={{ display: 'grid', gap: 4 }}>
        <span style={klein}>Zählt als belegt (freie Zeit, Buchungsseite)</span>
        {kalender.map(k => {
          const an = zaehltAlsBelegt(einst, k.name);
          const zugeordnet = zuordnung(einst, k.name) !== null;
          const eigen = typeof einst.belegt?.[k.name] === 'boolean';
          return (
            <label key={k.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer', minHeight: 24 }}>
              <input type="checkbox" checked={an} onChange={() => setzen({ belegt: { ...(einst.belegt ?? {}), [k.name]: !an } })} />
              <span style={{ flex: 1, color: an ? C.ink : C.inkDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.name}</span>
              {!zugeordnet && !eigen && <span title="Nicht Kevin, Malin oder Gemeinsam zugeordnet — blockiert niemanden, bis du es einschaltest" style={{ fontSize: 11, color: LEUCHT.achtung }}>nicht zugeordnet</span>}
            </label>
          );
        })}
        {!kalender.length && <span style={{ fontSize: 12, color: C.inkLeise }}>Noch keine Kalender geladen.</span>}
      </div>
      <div style={{ display: 'grid', gap: 4 }}>
        <span style={klein}>Frei, aber nicht gesetzlich (keine Buchungen, keine Vorschläge)</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {freie.map(f => (
            <span key={f.tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '3px 4px 3px 9px', borderRadius: 999, background: 'rgba(255,255,255,.05)', color: C.ink, fontFamily: SCHRIFT.text }}>
              {f.tag.slice(3, 5)}.{f.tag.slice(0, 2)}. {f.name}
              <button type="button" aria-label={`${f.name} entfernen`} onClick={() => setzen({ freieTage: freie.filter(x => x.tag !== f.tag) })} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', minWidth: 24, minHeight: 24, padding: 0 }}>✕</button>
            </span>
          ))}
          {!freie.length && <span style={{ fontSize: 12, color: C.inkLeise }}>keine</span>}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={neuTag} onChange={e => setNeuTag(e.target.value)} placeholder="TT.MM." aria-label="Freier Tag (TT.MM.)" style={{ ...feld, width: 76, fontSize: 13, padding: '6px 8px' }} />
          <input value={neuName} onChange={e => setNeuName(e.target.value)} maxLength={40} placeholder="Name" aria-label="Name des freien Tags" style={{ ...feld, flex: 1, minWidth: 90, fontSize: 13, padding: '6px 8px' }} />
          <Knopf leise onClick={hinzu}>+ Tag</Knopf>
        </div>
        {fehler && <span style={{ fontSize: 11.5, color: LEUCHT.achtung }}>{fehler}</span>}
      </div>
    </>
  );
}
