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
// 24.09.: auf das lebendige Muster umgezogen — Datum als leuchtende Pille,
// Kalender als dunkle Karte mit Tiefe, keine Rahmen mehr.

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { localDay } from '@/lib/zeit';
// Die Rechnung selbst steht jetzt in lib/ — hier bleibt nur die Ansicht.
// Weiterhin von hier exportiert, damit die bestehenden Importe stimmen.
import { tageDazu, datumKurz, tageBis, datumFarbe } from '@/lib/make-one/faelligkeit';
import { feld } from './schlank';

export { tageDazu, datumKurz, tageBis, datumFarbe };

/** Rahmenlose Pille als Wahlknopf — dieselbe Sprache wie Chip. */
const pille = (leise?: boolean): CSSProperties => ({
  flex: 1, fontFamily: SCHRIFT.text, fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '7px 0', borderRadius: 999,
  border: 'none', background: 'rgba(255,255,255,.06)', color: leise ? C.inkLeise : C.inkDim, whiteSpace: 'nowrap',
});
const mikro: CSSProperties = { fontFamily: SCHRIFT.text, fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkLeise, marginBottom: 6 };

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
  // Ohne Datum bewusst leise: grau, wie „+ Stichwort" — sonst schreien in
  // einer Liste mit 58 Zeilen alle leeren Felder gleichzeitig.
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
          fontFamily: SCHRIFT.text, fontSize: klein ? 11 : 12, fontWeight: wert ? 700 : 500, cursor: 'pointer',
          padding: klein ? '3px 9px' : '5px 11px', borderRadius: 999, border: 'none',
          background: wert ? `${farbe}22` : 'rgba(255,255,255,.06)',
          color: wert ? farbe : C.inkLeise, whiteSpace: 'nowrap', letterSpacing: '.02em',
        }}>
        {text}
      </button>

      {auf && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 60, minWidth: 260,
          background: 'linear-gradient(165deg, #1A2024 0%, #12171A 100%)', border: 'none', borderRadius: 18,
          padding: '13px 14px', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06), 0 16px 44px rgba(0,0,0,.5)',
        }}>
          {/* Verschieben — der Fall beim Durchgehen: „geht später" */}
          <div style={mikro}>Verschieben</div>
          <div style={{ display: 'flex', gap: 5, marginBottom: 12 }}>
            {([['−1 Wo', -7], ['−1 Tg', -1], ['+1 Tg', 1], ['+1 Wo', 7], ['+1 Mo', 30]] as const).map(([label, n]) => (
              <button key={label} onClick={() => schieben(n)} className="fassbar" style={pille(n < 0)}>{label}</button>
            ))}
          </div>

          {/* Genaues Datum — der Kalender des Systems, kein Nachbau */}
          <div style={mikro}>Genau auf</div>
          <input
            type="date"
            value={wert ?? ''}
            onChange={e => { if (e.target.value) setzen(e.target.value); }}
            aria-label="Fälligkeitsdatum"
            style={{ ...feld, fontSize: TYP.bedien, padding: '8px 12px', colorScheme: 'dark' }} />

          <div style={{ display: 'flex', gap: 5, marginTop: 10 }}>
            <button onClick={() => { setzen(heute); }} className="fassbar" style={pille()}>Heute</button>
            <button onClick={() => { setzen(undefined); setAuf(false); }} className="fassbar" style={pille(true)}>Kein Datum</button>
          </div>
        </div>
      )}
    </div>
  );
}
