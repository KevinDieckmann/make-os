'use client';

// ─── MAKE OS — Abhängigkeiten setzen ────────────────────────────────────────
// Das Bedienmuster kombiniert monday und awork: die Abhängigkeit wird direkt
// an der Aufgabe gesetzt (Picker mit Suche statt Spalten-Konfiguration), und
// die Vorgänger stehen mit Status-Farbe im Detail — grün heißt „fertig, du
// bist frei", gelb heißt „daran hängst du noch".
// 24.09.: auf das lebendige Muster umgezogen — Vorgänger als Chips, Suche als
// Liste von Zeilen, keine Rahmen.

import { useMemo, useState, type CSSProperties } from 'react';
import { FARBE as C, SCHRIFT } from '@/lib/make-one/design';
import { offeneBlocker, terminKonflikt, wuerdeKreis } from '@/lib/make-one/abhaengigkeiten';
import { datumKurz } from './Faelligkeit';
import { Liste, Zeile, Leer, Punkt, LEUCHT } from './schlank';
import type { Task } from '@/types/tasks';

const mikro: CSSProperties = { fontFamily: SCHRIFT.text, fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkLeise };

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={mikro}>Wartet auf</span>

        {blocker.map(({ d, b }) => {
          const fertig = b!.status === 'done' || !!d.resolvedAt;
          const farbe = fertig ? LEUCHT.gut : LEUCHT.achtung;
          return (
            <span key={b!.id} title={fertig ? 'Erledigt — blockiert nicht mehr' : 'Noch offen — diese Aufgabe wartet darauf'}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: farbe, background: `${farbe}22`, borderRadius: 999, padding: '4px 10px', maxWidth: 260 }}>
              <Punkt farbe={farbe} groesse={6} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: fertig ? 'line-through' : 'none', opacity: fertig ? 0.75 : 1 }}>{b!.title}</span>
              <button onClick={() => loesen(b!.id)} aria-label="Abhängigkeit entfernen"
                style={{ background: 'transparent', border: 'none', color: farbe, cursor: 'pointer', padding: 0, fontSize: 11, lineHeight: 1, opacity: .8 }}>✕</button>
            </span>
          );
        })}

        <button onClick={() => setAuf(!auf)} className="fassbar"
          style={{ fontFamily: SCHRIFT.text, fontSize: 12, fontWeight: 600, color: auf ? C.aktiv : C.inkLeise, border: 'none', borderRadius: 999, padding: '4px 11px', background: auf ? C.aktivSanft : 'rgba(255,255,255,.06)', cursor: 'pointer' }}>
          {auf ? '✕ zu' : '+ Abhängigkeit'}
        </button>
      </div>

      {konflikt && (
        <div style={{ fontSize: 12, color: LEUCHT.kritisch, lineHeight: 1.45 }}>
          Terminkonflikt: fällig {t.dueDate && datumKurz(t.dueDate)}, aber „{konflikt.title.slice(0, 50)}" erst {konflikt.dueDate && datumKurz(konflikt.dueDate)} — eins von beiden verschieben.
        </div>
      )}

      {auf && (
        <div style={{ background: 'rgba(255,255,255,.04)', borderRadius: 14, padding: '6px 12px 4px' }}>
          <input autoFocus value={suche} onChange={e => setSuche(e.target.value)}
            placeholder="Aufgabe suchen, die vorher fertig sein muss …"
            aria-label="Blockierende Aufgabe suchen"
            style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: C.ink, fontSize: 13, fontFamily: SCHRIFT.text, padding: '6px 0' }} />
          <Liste>
            {kandidaten.map(k => (
              <Zeile key={k.id} onClick={() => setzen(k.id)} titel={k.title}
                rechts={k.dueDate ? <span style={{ fontFamily: SCHRIFT.display, fontSize: 12, color: C.inkLeise, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{datumKurz(k.dueDate)}</span> : undefined} />
            ))}
          </Liste>
          {!kandidaten.length && suche.trim() && <Leer>Nichts gefunden — Kreise und Erledigtes sind ausgeschlossen.</Leer>}
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
      style={{ display: 'inline-flex', alignItems: 'center', fontFamily: SCHRIFT.text, fontSize: 11, fontWeight: 700, letterSpacing: '.02em', color: LEUCHT.achtung, background: `${LEUCHT.achtung}22`, borderRadius: 999, padding: klein ? '2px 8px' : '3px 9px', whiteSpace: 'nowrap' }}>
      ⛓ wartet{b.length > 1 ? ` ×${b.length}` : ''}
    </span>
  );
}
