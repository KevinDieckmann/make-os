'use client';

// ─── MAKE OS — Fälligkeit setzen ────────────────────────────────────────────
// Kevins Ansage: „Ich möchte nicht heute/morgen/Montag/+7 Tage, sondern einmal
// draufklicken und dann das Datum verschieben können."
//
// Also: das Datum selbst ist der Knopf. Ein Klick öffnet den Kalender, und
// daneben stehen Pfeile, die den BESTEHENDEN Termin verschieben — nicht einen
// neuen vom heutigen Tag aus rechnen. Genau das ist der Unterschied beim
// Durchgehen einer Liste: „der geht eine Woche später" statt „der ist in einer
// Woche".

import { useEffect, useRef, useState } from 'react';
import { THEME as T } from '@/lib/make-one/os-data';
import { localDay } from '@/lib/zeit';
// Die Rechnung selbst steht jetzt in lib/ — hier bleibt nur die Ansicht.
// Weiterhin von hier exportiert, damit die bestehenden Importe stimmen.
import { tageDazu, datumKurz, tageBis, datumFarbe } from '@/lib/make-one/faelligkeit';

export { tageDazu, datumKurz, tageBis, datumFarbe };

export function Faelligkeit({ wert, setzen, klein = false, spaetPuls = false }: {
  wert?: string;
  setzen: (iso: string | undefined) => void;
  klein?: boolean;
  /** Überfälliges soll in Listen auffallen — wie die kritische Priorität. */
  spaetPuls?: boolean;
}) {
  const [auf, setAuf] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const heute = localDay();

  // Klick daneben schließt — beim Durchgehen einer Liste will man nicht jedes
  // Mal auf ein ✕ zielen.
  useEffect(() => {
    if (!auf) return;
    const zu = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setAuf(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAuf(false); };
    document.addEventListener('mousedown', zu);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', zu); document.removeEventListener('keydown', esc); };
  }, [auf]);

  const farbe = datumFarbe(wert, heute);
  const abstand = wert ? tageBis(wert, heute) : null;
  const spaet = abstand != null && abstand < 0;
  // Ohne Datum bewusst leise: gestrichelt und grau, wie „+ Stichwort" — sonst
  // schreien in einer Liste mit 58 Zeilen alle leeren Felder gleichzeitig.
  const text = wert
    ? `${datumKurz(wert)}${abstand === 0 ? ' · heute' : spaet ? ` · ${-abstand} Tg. über` : ''}`
    : '+ Datum';

  /** Verschieben geht vom gesetzten Termin aus — sonst ist es kein Verschieben. */
  const schieben = (tage: number) => setzen(tageDazu(wert ?? heute, tage));

  return (
    <div ref={box} style={{ position: 'relative', display: 'inline-flex' }}
      // In anklickbaren Zeilen darf das Datum die Zeile nicht mit aufklappen.
      onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setAuf(!auf)}
        title={wert ? 'Datum ändern oder verschieben' : 'Fälligkeit setzen'}
        className={spaet && spaetPuls ? 'krit-puls' : undefined}
        style={{
          fontFamily: T.mono, fontSize: klein ? 10 : 11.5, cursor: 'pointer',
          padding: klein ? '2px 7px' : '4px 10px', borderRadius: 7,
          border: wert ? `1px solid ${farbe}55` : `1px dashed ${T.line}`,
          background: wert ? `${farbe}14` : 'transparent',
          color: wert ? farbe : T.muted, whiteSpace: 'nowrap',
        }}>
        {text}
      </button>

      {auf && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 60, minWidth: 236,
          background: 'linear-gradient(165deg, #1A2024 0%, #12171A 100%)', border: 'none', borderRadius: 20,
          padding: '11px 12px', boxShadow: '0 16px 44px rgba(0,0,0,.5)',
        }}>
          {/* Verschieben — der Fall beim Durchgehen: „geht später" */}
          <div style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: T.muted, marginBottom: 6 }}>
            Verschieben
          </div>
          <div style={{ display: 'flex', gap: 5, marginBottom: 11 }}>
            {([['−1 Wo', -7], ['−1 Tg', -1], ['+1 Tg', 1], ['+1 Wo', 7], ['+1 Mo', 30]] as const).map(([label, n]) => (
              <button key={label} onClick={() => schieben(n)}
                style={{
                  flex: 1, fontFamily: T.sans, fontSize: 11, cursor: 'pointer', padding: '5px 0', borderRadius: 7,
                  border: `1px solid ${T.line}`, background: 'transparent', color: n < 0 ? T.muted : T.inkDim,
                }}>{label}</button>
            ))}
          </div>

          {/* Genaues Datum — der Kalender des Systems, kein Nachbau */}
          <div style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: T.muted, marginBottom: 6 }}>
            Genau auf
          </div>
          <input
            type="date"
            value={wert ?? ''}
            onChange={e => { if (e.target.value) setzen(e.target.value); }}
            aria-label="Fälligkeitsdatum"
            style={{
              width: '100%', background: T.void, border: `1px solid ${T.line}`, borderRadius: 8,
              padding: '7px 10px', color: T.ink, fontFamily: T.mono, fontSize: 12.5, outline: 'none',
              colorScheme: 'dark',
            }} />

          <div style={{ display: 'flex', gap: 5, marginTop: 9 }}>
            <button onClick={() => { setzen(heute); }}
              style={{ flex: 1, fontFamily: T.sans, fontSize: 11.5, cursor: 'pointer', padding: '6px 0', borderRadius: 7, border: `1px solid ${T.line}`, background: 'transparent', color: T.inkDim }}>
              Heute
            </button>
            <button onClick={() => { setzen(undefined); setAuf(false); }}
              style={{ flex: 1, fontFamily: T.sans, fontSize: 11.5, cursor: 'pointer', padding: '6px 0', borderRadius: 7, border: `1px solid ${T.line}`, background: 'transparent', color: T.muted }}>
              Kein Datum
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
