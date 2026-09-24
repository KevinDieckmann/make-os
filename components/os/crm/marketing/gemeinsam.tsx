'use client';

// ─── CRM · Marketing — gemeinsame Bauteile ─────────────────────────────────
// Kennzahl-Leiste (grau = noch nichts gemessen), Mehrfachwahl aus Pillen,
// Personenwahl mit Suche (ohne gesperrte Personen), Textfeld, das beim
// Verlassen speichert.

import { useEffect, useMemo, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { feld, LEUCHT } from '../../schlank';
import { anzeigename, findeKontakte, type Kontakt } from '@/lib/make-one/crm';
import type { Kpi } from '@/lib/crm/kennzahlen';
import { Pillen } from '../teile';

export const KPI_FARBE = { gruen: LEUCHT.gut, gelb: LEUCHT.achtung, rot: LEUCHT.kritisch, grau: C.inkLeise } as const;

/** Kennzahlen als Kacheln — Farbe am Rand, Ziel und Herkunft darunter. */
export function KpiLeiste({ liste }: { liste: Kpi[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 170px), 1fr))', gap: 10 }}>
      {liste.map(k => (
        <div key={k.id} title={k.quelle} style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,.03)', borderLeft: `3px solid ${KPI_FARBE[k.ampel]}` }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: k.ampel === 'grau' ? C.inkDim : C.ink, fontVariantNumeric: 'tabular-nums' }}>{k.anzeige}</div>
          <div style={{ fontSize: 12, color: C.inkDim, marginTop: 2, lineHeight: 1.35 }}>{k.label}</div>
          <div style={{ fontSize: 11, color: C.inkLeise, marginTop: 2, lineHeight: 1.35 }}>Ziel {k.ziel} · {k.quelle}</div>
        </div>
      ))}
    </div>
  );
}

/** Mehrfachwahl — jede Pille schaltet für sich. */
export function Mehrfach<T extends string>({ liste, aktiv, onWahl, farbe }: { liste: { id: T; label: string }[]; aktiv: T[]; onWahl: (l: T[]) => void; farbe?: string }) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {liste.map(o => <Pillen key={o.id} farbe={farbe} liste={[o]} aktiv={aktiv.includes(o.id) ? o.id : null} onWahl={id => onWahl(aktiv.includes(id) ? aktiv.filter(x => x !== id) : [...aktiv, id])} />)}
    </div>
  );
}

/** Person aus der Kartei suchen (ab zwei Zeichen). Gesperrte Personen stehen nicht zur Wahl. */
export function PersonWahl({ kontakte, onWahl, platzhalter = 'Person suchen: Name, Firma, Mail …' }: { kontakte: Kontakt[]; onWahl: (k: Kontakt) => void; platzhalter?: string }) {
  const [q, setQ] = useState('');
  const treffer = useMemo(() => (q.trim().length >= 2 ? findeKontakte(kontakte.filter(k => !k.werbesperre), q, 6) : []), [kontakte, q]);
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder={platzhalter} aria-label="Person suchen" style={{ ...feld, fontSize: TYP.bedien, padding: '8px 11px' }} />
      {treffer.map(k => (
        <button key={k.id} onClick={() => { onWahl(k); setQ(''); }} className="fassbar" style={{ textAlign: 'left', background: 'rgba(255,255,255,.03)', border: 'none', borderRadius: 10, color: C.ink, cursor: 'pointer', fontSize: TYP.bedien, padding: '7px 10px' }}>
          {anzeigename(k)}{k.firma ? <span style={{ color: C.inkLeise }}> · {k.firma}</span> : null}
        </button>
      ))}
      {q.trim().length >= 2 && !treffer.length && <div style={{ fontSize: 12, color: C.inkLeise, padding: '2px 2px' }}>Niemand gefunden.</div>}
    </div>
  );
}

/** Mehrzeiliges Feld, das beim Verlassen speichert. */
export function Textfeld({ wert = '', onFertig, platzhalter, zeilen = 4, max }: { wert?: string; onFertig: (t: string) => void; platzhalter?: string; zeilen?: number; max?: number }) {
  const [t, setT] = useState(wert);
  useEffect(() => { setT(wert); }, [wert]);
  return <textarea value={t} rows={zeilen} maxLength={max} placeholder={platzhalter} aria-label={platzhalter} onChange={e => setT(e.target.value)} onBlur={() => { if (t !== wert) onFertig(t); }}
    style={{ ...feld, resize: 'vertical', fontSize: TYP.bedien, padding: '9px 12px', lineHeight: 1.5 }} />;
}

/** In die Zwischenablage — Versand und Veröffentlichung bleiben bei dir. */
export async function kopieren(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}
