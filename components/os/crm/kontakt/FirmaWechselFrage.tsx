'use client';

// ─── Kurz nachfragen: Wie ändert sich die Firma? (Kevin 28.09.) ──────────────
// Wer nur die Firma einer Person ändert (Matrix-Feld „Firma“, Firmenkarte „zuordnen“),
// bekommt ein kleines Menü: Jobwechsel · Zusätzliche Firma · Korrektur. Die Antwort
// geht als `firmaWechsel` mit dem `teil` an den Server (lib/crm/stationen.ts
// `firmaWechselAnwenden`); abbrechen ändert nichts.
//
//   const { frage, dialog } = useFirmaWechselFrage();
//   const absicht = await frage({ von: 'Alte GmbH', nach: 'Neue GmbH' });   // null = abgebrochen
//   … {dialog} irgendwo im JSX rendern.

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { FARBE as C, TYP, SCHRIFT } from '@/lib/make-one/design';
import { Knopf } from '../../ui';
import { FIRMA_WECHSEL_WAHL, type FirmaWechsel } from '@/lib/crm/stationen';

export interface FirmaWechselOptionen {
  /** Bisherige Firma (Anzeige). */
  von?: string;
  /** Neue Firma (Anzeige) — fehlt sie, wird die Firma entfernt (dann kein „zusätzlich“). */
  nach?: string;
}
export type FirmaWechselFrageFn = (o: FirmaWechselOptionen) => Promise<FirmaWechsel | null>;

interface Offen extends FirmaWechselOptionen { resolve: (v: FirmaWechsel | null) => void }

export function useFirmaWechselFrage(): { frage: FirmaWechselFrageFn; dialog: ReactNode } {
  const [offen, setOffen] = useState<Offen | null>(null);
  const frage = useCallback<FirmaWechselFrageFn>(o => new Promise(resolve => {
    setOffen(alt => { alt?.resolve(null); return { ...o, resolve }; });
  }), []);
  const fertig = useCallback((v: FirmaWechsel | null) => { setOffen(alt => { alt?.resolve(v); return null; }); }, []);
  return { frage, dialog: offen ? <Dialog o={offen} onFertig={fertig} /> : null };
}

function Dialog({ o, onFertig }: { o: Offen; onFertig: (v: FirmaWechsel | null) => void }) {
  const erster = useRef<HTMLButtonElement>(null);
  useEffect(() => { erster.current?.focus(); }, []);
  const wahl = FIRMA_WECHSEL_WAHL.filter(w => o.nach || w.id !== 'zusaetzlich');
  const titel = o.nach ? `Firma ändern${o.von ? `: ${o.von} → ${o.nach}` : ` → ${o.nach}`}` : `Firma entfernen${o.von ? `: ${o.von}` : ''}`;
  return (
    <div role="presentation" onClick={() => onFertig(null)} style={{ position: 'fixed', inset: 0, zIndex: 96, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-label={titel} onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); onFertig(null); } }}
        style={{ width: 'min(460px, 100%)', background: C.flaecheHoch, border: `1px solid ${C.linie}`, borderRadius: 16, padding: 18, display: 'grid', gap: 10, fontFamily: SCHRIFT.text, boxShadow: '0 20px 60px rgba(0,0,0,.45)' }}>
        <div style={{ fontSize: TYP.body, fontWeight: 700, color: C.ink }}>{titel}</div>
        <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>Was ist passiert?</div>
        <div role="listbox" aria-label="Art der Änderung" style={{ display: 'grid', gap: 6 }}>
          {wahl.map((w, i) => (
            <button key={w.id} ref={i === 0 ? erster : undefined} type="button" role="option" aria-selected={false} onClick={() => onFertig(w.id)} className="fassbar"
              style={{ display: 'grid', gap: 2, textAlign: 'left', padding: '9px 12px', borderRadius: 11, border: `1px solid ${C.aktiv}44`, background: `${C.aktiv}10`, color: C.ink, cursor: 'pointer', fontFamily: SCHRIFT.text }}>
              <span style={{ fontSize: TYP.bedien, fontWeight: 700, color: C.aktiv }}>{w.id === 'jobwechsel' && !o.nach ? 'Ausgeschieden' : w.label}</span>
              <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>{w.id === 'jobwechsel' && !o.nach ? 'die Station endet heute, der Verlauf bleibt' : w.id === 'korrektur' && !o.nach ? 'die Firma war falsch eingetragen — ohne Historie entfernen' : w.hinweis}</span>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Knopf leise onClick={() => onFertig(null)}>Abbrechen</Knopf></div>
      </div>
    </div>
  );
}
