'use client';

// ─── Prozesse — Suche mit Sprung (Etappe A, 21.10.; ANALYSE_100.md Punkt 15) ─────────────────────────────────────────────────────────────────
// Sucht Prozesse, Phasen und Schritte (lib/prozesse/modell.ts `prozesseSuchen` — Umlaute gefaltet wie überall). Ein Treffer fährt die Kamera an den Ort
// und lässt das Element kurz aufleuchten (ein Lichtfaden umrundet es). Tastatur: Pfeile wählen, Enter springt, Esc leert. Felder 16 px (kein Zoom am iPhone).

import { useId, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { FARBE as C, TYP, RAND, ECKE, SCHRIFT, FLAECHE_STIL } from '@/lib/make-one/design';
import { prozesseSuchen, type SuchTreffer } from '@/lib/prozesse/modell';
import type { ProzessDef } from '@/lib/prozesse/typen';

const ART: Record<SuchTreffer['art'], string> = { prozess: 'Prozess', phase: 'Phase', schritt: 'Schritt' };

export function ProzessSuche({ prozesse, onTreffer }: { prozesse: readonly ProzessDef[]; onTreffer: (t: SuchTreffer) => void }) {
  const [frage, setFrage] = useState('');
  const [wahl, setWahl] = useState(0);
  const id = useId();
  const treffer = useMemo(() => prozesseSuchen(prozesse, frage, 8), [prozesse, frage]);
  const springe = (t: SuchTreffer | undefined) => { if (!t) return; onTreffer(t); setFrage(''); setWahl(0); };
  return (
    <div className="pz-suche" role="search" style={{ position: 'relative', minWidth: 0 }}>
      <label htmlFor={`${id}-feld`} className="pz-nur-vorlesen">Prozesse durchsuchen</label>
      <span aria-hidden style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', display: 'inline-flex', color: C.inkLeise }}><Search size={16} /></span>
      <input id={`${id}-feld`} type="search" value={frage} placeholder="Prozess, Phase oder Schritt suchen" autoComplete="off"
        role="combobox" aria-expanded={treffer.length > 0} aria-controls={`${id}-liste`} aria-activedescendant={treffer[wahl] ? `${id}-t${wahl}` : undefined}
        onChange={e => { setFrage(e.target.value); setWahl(0); }}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setWahl(w => Math.min(treffer.length - 1, w + 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setWahl(w => Math.max(0, w - 1)); }
          else if (e.key === 'Enter') { e.preventDefault(); springe(treffer[wahl]); }
          else if (e.key === 'Escape' && frage) { e.preventDefault(); e.stopPropagation(); setFrage(''); }
        }}
        style={{ width: '100%', minHeight: 44, boxSizing: 'border-box', padding: '8px 12px 8px 36px', borderRadius: ECKE.eingabe, fontSize: 16, fontFamily: SCHRIFT.text, color: C.ink, ...FLAECHE_STIL.eingabe }} />
      {treffer.length > 0 && (
        <ul id={`${id}-liste`} role="listbox" aria-label="Treffer" className="pz-suche-liste"
          style={{ position: 'absolute', left: 0, right: 0, top: 'calc(100% + 6px)', zIndex: 30, margin: 0, padding: 6, listStyle: 'none', borderRadius: ECKE.flach, background: C.flaecheHoch, border: `1px solid ${RAND.stark}`, display: 'grid', gap: 2 }}>
          {treffer.map((t, i) => (
            <li key={t.id} id={`${id}-t${i}`} role="option" aria-selected={i === wahl}>
              <button type="button" className="fassbar" onMouseDown={e => e.preventDefault()} onClick={() => springe(t)}
                style={{ width: '100%', minHeight: 44, textAlign: 'left', display: 'grid', gap: 2, padding: '6px 10px', borderRadius: 10, border: 0, cursor: 'pointer', fontFamily: SCHRIFT.text,
                  background: i === wahl ? FLAECHE_STIL.flach.background : 'transparent', color: C.ink }}>
                <span style={{ fontSize: TYP.bedien, fontWeight: 600 }}>{t.titel}</span>
                <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>{ART[t.art]} · {t.wo}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
