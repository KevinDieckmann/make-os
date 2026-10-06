'use client';
// ─── Menü „…“ an einer Aufgaben- oder Listen-Zeile (06.10., Malins Bauplan-Karte) ─────────────────────
// Umwandeln (Liste → Aufgabe, Aufgabe → Liste, Aufgabe ↔ Unteraufgabe) und „Verschieben nach …“ (die Tastatur-Alternative zum
// Ziehen). Wischen bleibt Archivieren/Löschen (`ZeileAktionen`, Kevin 04.10.: „Alles andere macht da keinen Sinn“) — alles
// Weitere steht hier. Ein Punkt kann direkt etwas tun oder erst eine Auswahl zeigen (mit Suche ab 7 Einträgen).
// Rechner: Menü am Knopf; Handy: Blatt von unten — beides über ein Portal (die Zeile schneidet sonst ab, `.ui-za-bahn`). Escape oder
// Tippen daneben schließt, danach hat der Knopf wieder den Fokus. Die Rand-Knöpfe von `ZeileAktionen` rücken links neben „…“ (globals.css).

import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal, ChevronLeft } from 'lucide-react';
import { FARBE as C, SCHRIFT, TYP, RAND, ECKE, ZIEL, BEDEUTUNG_FARBE } from '@/lib/make-one/design';
import { useHandy, SymbolKnopf } from '../ui';
import { normiere } from '@/lib/crm/wahl';

export interface MenueAuswahl { titel: string; eintraege: { id: string; label: string; hinweis?: string; punkt?: string }[]; waehlen: (id: string) => void; leer?: string }
export interface MenuePunkt {
  label: string;
  /** Direkt ausführen … */
  tun?: () => void;
  /** … oder erst wählen (Liste, Elternteil). */
  auswahl?: MenueAuswahl;
  /** Kurz erklärt (unter dem Punkt). */
  hinweis?: string;
  gefahr?: boolean;
}

const punktStil: CSSProperties = {
  display: 'grid', gap: 2, width: '100%', textAlign: 'left', background: 'none', border: 'none', borderRadius: ECKE.eingabe,
  padding: '8px 12px', minHeight: ZIEL.handy, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, color: C.ink,
};

export function ZeilenMenue({ titel, punkte }: { titel: string; punkte: readonly MenuePunkt[] }) {
  const [auf, setAuf] = useState(false);
  const [wahl, setWahl] = useState<MenueAuswahl | null>(null);
  const [suche, setSuche] = useState('');
  const [rect, setRect] = useState<DOMRect | null>(null);
  const handy = useHandy();
  const id = useId();
  const knopf = useRef<HTMLSpanElement>(null);
  const menue = useRef<HTMLDivElement>(null);
  const zu = (fokus = true) => { setAuf(false); setWahl(null); setSuche(''); if (fokus) setTimeout(() => knopf.current?.querySelector('button')?.focus(), 0); };
  useEffect(() => {
    if (!auf) return;
    const daneben = (e: PointerEvent) => { if (!menue.current?.contains(e.target as Node) && !knopf.current?.contains(e.target as Node)) zu(false); };
    const taste = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); zu(); } };
    document.addEventListener('pointerdown', daneben, true);
    document.addEventListener('keydown', taste, true);
    setTimeout(() => menue.current?.querySelector<HTMLElement>('input, button')?.focus(), 0);
    return () => { document.removeEventListener('pointerdown', daneben, true); document.removeEventListener('keydown', taste, true); };
  }, [auf, wahl]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!punkte.length) return null;
  const treffer = wahl ? wahl.eintraege.filter(e => !suche.trim() || normiere(`${e.label} ${e.hinweis ?? ''}`).includes(normiere(suche))) : [];
  const unten = !rect || rect.bottom + 430 < window.innerHeight;
  const lage: CSSProperties = handy || !rect
    ? { position: 'fixed', left: 8, right: 8, bottom: 8, maxHeight: '70vh' }
    : { position: 'fixed', right: Math.max(8, window.innerWidth - rect.right), width: 320, maxHeight: 420, ...(unten ? { top: rect.bottom + 4 } : { bottom: window.innerHeight - rect.top + 4 }) };
  return (
    <span ref={knopf} className="aufgaben-zeilenmenue" style={{ position: 'relative', display: 'inline-flex', flex: '0 0 auto' }} onClick={e => e.stopPropagation()}>
      <SymbolKnopf onClick={() => { if (auf) { zu(); return; } setRect(knopf.current?.getBoundingClientRect() ?? null); setAuf(true); }} ariaLabel={`Mehr zu „${titel}“: umwandeln, verschieben`} titel="Mehr: umwandeln, verschieben"><MoreHorizontal size={18} aria-hidden /></SymbolKnopf>
      {auf && createPortal(
        <div ref={menue} role="menu" onClick={e => e.stopPropagation()} id={id} aria-label={wahl ? wahl.titel : `Mehr zu „${titel}“`}
          style={{ ...lage, zIndex: 60, overflowY: 'auto', display: 'grid', alignContent: 'start', gap: 2, padding: 6, borderRadius: ECKE.flach, background: C.flaecheHoch, border: `1px solid ${RAND.stark}`, boxShadow: '0 18px 40px -12px rgba(0,0,0,.7)' }}>
          {!wahl && punkte.map(p => (
            <button key={p.label} role="menuitem" type="button" className="fassbar" style={{ ...punktStil, color: p.gefahr ? BEDEUTUNG_FARBE.kritisch : C.ink }}
              onClick={() => { if (p.auswahl) { setWahl(p.auswahl); setSuche(''); } else { zu(); p.tun?.(); } }}>
              <span style={{ fontWeight: 600 }}>{p.label}{p.auswahl ? ' …' : ''}</span>
              {p.hinweis && <span style={{ color: C.inkLeise, fontSize: TYP.bedien }}>{p.hinweis}</span>}
            </button>
          ))}
          {wahl && <>
            <button type="button" onClick={() => { setWahl(null); setSuche(''); }} className="fassbar" style={{ ...punktStil, display: 'flex', alignItems: 'center', gap: 6, color: C.inkDim }}>
              <ChevronLeft size={16} aria-hidden /> <span style={{ fontWeight: 700 }}>{wahl.titel}</span>
            </button>
            {wahl.eintraege.length > 6 && (
              <input value={suche} onChange={e => setSuche(e.target.value)} aria-label={`${wahl.titel}: suchen`} placeholder="suchen …"
                style={{ margin: '2px 4px 6px', padding: '8px 12px', minHeight: ZIEL.rechner, borderRadius: ECKE.eingabe, border: `1px solid ${RAND.stark}`, background: 'rgba(255,255,255,.05)', color: C.ink, fontFamily: SCHRIFT.text, fontSize: TYP.bedien }} />
            )}
            {treffer.map(e => (
              <button key={e.id} role="menuitem" type="button" className="fassbar" style={punktStil} onClick={() => { zu(); wahl.waehlen(e.id); }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {e.punkt && <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: e.punkt, flex: '0 0 auto' }} />}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.label}</span>
                </span>
                {e.hinweis && <span style={{ color: C.inkLeise, fontSize: TYP.bedien }}>{e.hinweis}</span>}
              </button>
            ))}
            {!treffer.length && <span style={{ padding: '8px 12px', color: C.inkLeise, fontSize: TYP.bedien }}>{wahl.eintraege.length ? 'Nichts gefunden.' : wahl.leer ?? 'Hier passt nichts.'}</span>}
          </>}
          {handy && <button type="button" onClick={() => zu()} className="fassbar" style={{ ...punktStil, textAlign: 'center', color: C.inkDim }}>Schließen</button>}
        </div>, document.body,
      )}
    </span>
  );
}
