'use client';

// ─── Prozesse · Werkstatt — Probelauf mit echtem Fall (22.10.; ANALYSE_100.md Punkt 48) ────────────────────────────────────────────────────────────────────
// Der Probelauf spielt den Entwurf mit dem erfundenen Beispiel-Fall ODER mit einem echten Fall der Fall-Art des Prozesses durch — schreibt nichts (derselbe Motor
// im Schatten). Gesucht wird über die vorhandenen schlanken Verweise (GET /api/aufgaben/crm: nur Kennung und Name, eingeschränkte Personen fehlen dort schon);
// Events und Kampagnen gibt es dort nicht — für sie bleibt der Beispiel-Fall. Dieselbe Auswahl nimmt der Reiter „Tests“ für einen neuen Testfall.

import { useMemo, useState } from 'react';
import { Play, X } from 'lucide-react';
import { FARBE as C, TYP, MIKRO } from '@/lib/make-one/design';
import { Knopf, Segmente, SymbolKnopf, feld } from '../ui';
import type { FallArt } from '@/lib/prozesse/definition';
import { FALL_SUCHBAR, FALL_WORT, echterFall, fallTreffer, type FallTreffer } from '@/lib/prozesse/laeufe-ansicht';
import { useVerweise } from './laeufe-daten';

export type FallWert = 'beispiel' | FallTreffer;
const klein = { fontSize: TYP.bedien, color: C.inkLeise, margin: 0, lineHeight: 1.45 } as const;

/** Beispiel-Fall oder ein echter Fall der Fall-Art (Suche über die schlanken Verweise). */
export function FallWahl({ fallArt, wert, onWert }: { fallArt: FallArt; wert: FallWert; onWert: (w: FallWert) => void }) {
  const verweise = useVerweise();
  const [art, setArt] = useState<'beispiel' | 'echt'>(wert === 'beispiel' ? 'beispiel' : 'echt');
  const [q, setQ] = useState('');
  const treffer = useMemo(() => fallTreffer(verweise, fallArt, q), [verweise, fallArt, q]);
  const suchbar = FALL_SUCHBAR.has(fallArt);
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <Segmente liste={[{ id: 'beispiel' as const, label: 'Beispiel-Fall' }, { id: 'echt' as const, label: echterFall(fallArt) }]} aktiv={suchbar ? art : 'beispiel'}
        onWahl={v => { if (v === 'echt' && !suchbar) return; setArt(v); if (v === 'beispiel') onWert('beispiel'); }} />
      {!suchbar && <p style={klein}>{fallArt === 'keiner' ? 'Dieser Prozess hängt an keinem Fall — der Probelauf nimmt das Beispiel.' : `Einen echten Fall der Art „${FALL_WORT[fallArt]}“ gibt es hier nicht zur Auswahl — der Probelauf nimmt das Beispiel.`}</p>}
      {suchbar && art === 'echt' && (
        <>
          <input aria-label={`${FALL_WORT[fallArt]} suchen`} placeholder={`${FALL_WORT[fallArt]} suchen …`} value={q} onChange={e => setQ(e.target.value)} style={feld} />
          <ul role="listbox" aria-label="Fälle" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 2, maxHeight: 220, overflowY: 'auto' }}>
            {treffer.map(t => (
              <li key={`${t.art}:${t.id}`} role="option" aria-selected={wert !== 'beispiel' && wert.id === t.id}>
                <button type="button" className="fassbar pz-feld-zeile" onClick={() => onWert(t)} style={{ display: 'grid', textAlign: 'left', color: C.ink, cursor: 'pointer', outline: wert !== 'beispiel' && wert.id === t.id ? `1px solid ${C.ink}` : undefined }}>
                  {/* Runde 4: das Merkmal (Produkt, Stufe, Status) hinter dem Namen — damit man den passenden Fall wählt. */}
                  <span style={{ fontSize: TYP.bedien, fontWeight: 600 }}>{t.name}{t.merkmal && <span style={{ fontWeight: 400, color: C.inkDim }}>{` · ${t.merkmal}`}</span>}</span>
                  {t.unter && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{t.unter}</span>}
                </button>
              </li>
            ))}
            {!treffer.length && <li style={klein}>{verweise ? 'Nichts gefunden — anders suchen.' : 'Die Fälle laden …'}</li>}
          </ul>
        </>
      )}
    </div>
  );
}

/** Das kleine Fenster am Knopf „Probelauf“: Fall wählen, dann starten. */
export function ProbeFallFenster({ fallArt, wert, onWert, onStart, onZu }: { fallArt: FallArt; wert: FallWert; onWert: (w: FallWert) => void; onStart: () => void; onZu: () => void }) {
  return (
    <div role="dialog" aria-label="Probelauf mit welchem Fall?" className="pz-hilfe" onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); onZu(); } }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ ...MIKRO }}>Probelauf · mit welchem Fall?</span>
        <SymbolKnopf ariaLabel="Schließen (Esc)" onClick={onZu}><X size={16} /></SymbolKnopf>
      </div>
      <FallWahl fallArt={fallArt} wert={wert} onWert={onWert} />
      <p style={klein}>Der Probelauf schreibt nichts — keine Aufgabe, kein Vorschlag, kein Modellaufruf.</p>
      <div><Knopf onClick={onStart}><span className="pz-knopf-inhalt"><Play size={14} aria-hidden />{wert === 'beispiel' ? 'Mit dem Beispiel starten' : `Mit „${wert.name}“ starten`}</span></Knopf></div>
    </div>
  );
}
