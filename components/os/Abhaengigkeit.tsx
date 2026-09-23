'use client';

// ─── MAKE OS — Abhängigkeiten setzen ────────────────────────────────────────
// Das Bedienmuster kombiniert monday und awork: die Abhängigkeit wird direkt
// an der Aufgabe gesetzt (Picker mit Suche statt Spalten-Konfiguration), und
// die Vorgänger stehen mit Status-Farbe im Detail — grün heißt „fertig, du
// bist frei", amber heißt „daran hängst du noch".

import { useMemo, useState } from 'react';
import { THEME as T } from '@/lib/make-one/os-data';
import { offeneBlocker, terminKonflikt, wuerdeKreis } from '@/lib/make-one/abhaengigkeiten';
import { datumKurz } from './Faelligkeit';
import type { Task } from '@/types/tasks';

export function Abhaengigkeit({ t, alle, patchTask }: {
  t: Task;
  alle: Task[];
  patchTask: (id: string, p: Record<string, unknown>) => void;
}) {
  const [suche, setSuche] = useState('');
  const [auf, setAuf] = useState(false);

  const deps = t.dependencies ?? [];
  const nachId = useMemo(() => new Map(alle.map(x => [x.id, x])), [alle]);
  const blocker = deps.map(d => ({ d, b: nachId.get(d.blockedByTaskId) })).filter(x => x.b);
  const konflikt = terminKonflikt(t, alle);

  // Zur Wahl: offene Aufgaben, nicht sie selbst, kein Kreis, nicht schon dran.
  const kandidaten = useMemo(() => {
    const s = suche.trim().toLowerCase();
    if (!auf) return [];
    return alle
      .filter(x => x.status !== 'done' && x.id !== t.id
        && !deps.some(d => d.blockedByTaskId === x.id)
        && (!s || x.title.toLowerCase().includes(s)))
      .filter(x => !wuerdeKreis(t.id, x.id, alle))
      .slice(0, 8);
  }, [auf, suche, alle, deps, t.id]);

  const setzen = (aufgabeId: string) => {
    const ziel = nachId.get(aufgabeId);
    patchTask(t.id, {
      dependencies: [...deps, {
        blockedByTaskId: aufgabeId,
        // Hängt sie an etwas Fertigem, ist sie sofort aufgelöst — der
        // Eintrag dokumentiert dann nur noch die Reihenfolge.
        ...(ziel?.status === 'done' ? { resolvedAt: new Date().toISOString() } : {}),
      }],
    });
    setSuche('');
    setAuf(false);
  };

  const loesen = (aufgabeId: string) =>
    patchTask(t.id, { dependencies: deps.filter(d => d.blockedByTaskId !== aufgabeId) });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: '.08em' }}>Wartet auf</span>

        {blocker.map(({ d, b }) => {
          const fertig = b!.status === 'done' || !!d.resolvedAt;
          const farbe = fertig ? T.accent : T.amber;
          return (
            <span key={b!.id} title={fertig ? 'Erledigt — blockiert nicht mehr' : 'Noch offen — diese Aufgabe wartet darauf'}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: farbe, background: `${farbe}12`, border: `1px solid ${farbe}44`, borderRadius: 7, padding: '3px 8px', maxWidth: 260 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: farbe, flex: '0 0 auto' }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: fertig ? 'line-through' : 'none', opacity: fertig ? 0.75 : 1 }}>{b!.title}</span>
              <button onClick={() => loesen(b!.id)} aria-label="Abhängigkeit entfernen"
                style={{ background: 'transparent', border: 'none', color: T.muted, cursor: 'pointer', padding: 0, fontSize: 11, lineHeight: 1 }}>✕</button>
            </span>
          );
        })}

        <button onClick={() => setAuf(!auf)}
          style={{ fontFamily: T.sans, fontSize: 11, color: auf ? T.accentInk : T.muted, border: `1px dashed ${auf ? T.accent : T.line}`, borderRadius: 7, padding: '3px 9px', background: 'transparent', cursor: 'pointer' }}>
          {auf ? '✕ zu' : '+ Abhängigkeit'}
        </button>
      </div>

      {konflikt && (
        <div style={{ fontSize: 11.5, color: T.crit, lineHeight: 1.45 }}>
          Terminkonflikt: fällig {t.dueDate && datumKurz(t.dueDate)}, aber „{konflikt.title.slice(0, 50)}" erst {konflikt.dueDate && datumKurz(konflikt.dueDate)} — eins von beiden verschieben.
        </div>
      )}

      {auf && (
        <div style={{ background: T.void, border: `1px solid ${T.line}`, borderRadius: 9, padding: '8px 10px' }}>
          <input autoFocus value={suche} onChange={e => setSuche(e.target.value)}
            placeholder="Aufgabe suchen, die vorher fertig sein muss …"
            aria-label="Blockierende Aufgabe suchen"
            style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: T.ink, fontSize: 12.5, fontFamily: T.sans, marginBottom: kandidaten.length ? 7 : 0 }} />
          {kandidaten.map(k => (
            <button key={k.id} onClick={() => setzen(k.id)}
              style={{ display: 'block', width: '100%', textAlign: 'left', fontSize: 12.5, color: T.inkDim, background: 'transparent', border: 'none', borderTop: `1px solid ${T.lineSoft}`, padding: '6px 2px', cursor: 'pointer' }}>
              {k.title}
              {k.dueDate && <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, marginLeft: 7 }}>{datumKurz(k.dueDate)}</span>}
            </button>
          ))}
          {!kandidaten.length && suche.trim() && <div style={{ fontSize: 12, color: T.muted }}>Nichts gefunden — Kreise und Erledigtes sind ausgeschlossen.</div>}
        </div>
      )}
    </div>
  );
}

/** Kleiner Zeilen-/Karten-Hinweis: wartet noch auf N Aufgaben. */
export function BlockiertChip({ t, alle, klein = false }: { t: Task; alle: Task[]; klein?: boolean }) {
  const b = offeneBlocker(t, alle);
  if (!b.length) return null;
  return (
    <span title={`Wartet auf: ${b.map(x => x.title).join(' · ')}`}
      style={{ fontFamily: T.mono, fontSize: klein ? 9 : 9.5, color: T.amber, border: `1px solid ${T.amber}55`, borderRadius: 5, padding: klein ? '1px 5px' : '1px 6px', whiteSpace: 'nowrap' }}>
      ⛓ wartet{b.length > 1 ? ` ×${b.length}` : ''}
    </span>
  );
}
