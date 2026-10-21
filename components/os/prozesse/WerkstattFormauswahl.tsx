'use client';

// ─── Prozesse · Werkstatt — die Formauswahl am „+“ (Etappe B2, 21.10.; ANALYSE_100.md Punkt 17; Kevins Bild: „+ am Ausgang hängt den nächsten Baustein an“) ──────
// Ein kleines Fenster an der Stelle des „+“ (bzw. wo ein Faden ins Leere gezogen wurde, bzw. per Tab am gewählten Knoten): Suche, Kategorien des Katalogs
// (Auslöser · Aktion · Entscheidung · Warten · Agent · Teilprozess · Ende), je Baustein Symbol, Name und Satz. Pfeile wählen, Enter nimmt, Esc schließt. Bausteine
// derselben Form wie der Ausgangsknoten stehen oben (lib/prozesse/werkstatt-maske.ts `formauswahl`). Auslöser nur, wenn er an den Anfang kommt; beim Anhängen an
// einen Auslöser stehen sie hinten (Feinschliff 22.10., Befund 1 — Aktionen und Entscheidungen zuerst).

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as RKeyboardEvent } from 'react';
import { FARBE as C, TYP, RAND, FLAECHE_STIL, TIEF, MIKRO } from '@/lib/make-one/design';
import { Pillen } from '../ui';
import { BAUSTEIN_KATALOG, KATALOG_KATEGORIEN, type KatalogEintrag, type KatalogKategorie } from '@/lib/prozesse/baustein-katalog';
import type { ProzessForm } from '@/lib/prozesse/definition';
import { formauswahl } from '@/lib/prozesse/werkstatt-maske';
import { WERKSTATT_FORM_FARBE } from '@/lib/prozesse/farben';
import { symbolVon } from './WerkstattKnoten';

export function WerkstattFormauswahl({ ort, form, ohneAusloeser, anhaengen, titel, onWahl, onZu }: {
  ort: [number, number]; form?: ProzessForm; ohneAusloeser?: boolean; /** An einen Knoten anhängen — Auslöser stehen dann hinten. */ anhaengen?: boolean; titel: string;
  onWahl: (e: KatalogEintrag) => void; onZu: () => void;
}) {
  const [suche, setSuche] = useState('');
  const [kat, setKat] = useState<KatalogKategorie | 'alle'>('alle');
  const [i, setI] = useState(0);
  const eingabe = useRef<HTMLInputElement | null>(null);
  const liste = useMemo(() => formauswahl(BAUSTEIN_KATALOG, { suche, form, ohneAusloeser, anhaengen }).filter(e => kat === 'alle' || e.kategorie === kat), [suche, form, ohneAusloeser, anhaengen, kat]);
  useEffect(() => { eingabe.current?.focus(); }, []);
  useEffect(() => { setI(0); }, [suche, kat]);
  const taste = (e: RKeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onZu(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setI(x => Math.min(liste.length - 1, x + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setI(x => Math.max(0, x - 1)); }
    else if (e.key === 'Enter' && liste[i]) { e.preventDefault(); onWahl(liste[i]); }
  };
  const kategorien = KATALOG_KATEGORIEN.filter(k => !(ohneAusloeser && k.id === 'ausloeser')).sort((a, b) => (anhaengen ? Number(a.id === 'ausloeser') - Number(b.id === 'ausloeser') : 0));
  return (
    <div role="dialog" aria-label={titel} className="pw-auswahl" onKeyDown={taste} onPointerDown={e => e.stopPropagation()}
      style={{ left: Math.max(8, ort[0]), top: Math.max(8, ort[1]), background: C.flaecheHoch, border: `1px solid ${RAND.stark}` }}>
      <div style={{ ...MIKRO }}>{titel}</div>
      <input ref={eingabe} aria-label="Baustein suchen" placeholder="Baustein suchen … (z. B. Mail, Deal, Warten)" value={suche} onChange={e => setSuche(e.target.value)}
        style={{ ...FLAECHE_STIL.eingabe, width: '100%', minHeight: 44, boxSizing: 'border-box', borderRadius: 12, padding: '10px 14px', color: C.ink, fontSize: 16 }} />
      <Pillen einzeilig liste={[{ id: 'alle' as const, label: 'Alle' }, ...kategorien.map(k => ({ id: k.id, label: k.titel }))]} aktiv={kat} onWahl={v => setKat(v)} />
      <ul role="listbox" aria-label="Bausteine" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 2, maxHeight: 320, overflowY: 'auto' }}>
        {liste.map((e, j) => {
          const S = symbolVon({ form: e.form, katalog: { id: e.id } });
          const ton = WERKSTATT_FORM_FARBE[e.form];
          return (
            <li key={e.id} role="option" aria-selected={j === i}>
              <button type="button" className="fassbar pw-auswahl-zeile" onClick={() => onWahl(e)} onMouseEnter={() => setI(j)}
                style={{ background: j === i ? TIEF.flaeche(ton) : 'transparent', borderColor: j === i ? TIEF.rand(ton) : 'transparent' }}>
                <span aria-hidden style={{ display: 'inline-flex', width: 34, height: 34, flex: '0 0 auto', borderRadius: 10, alignItems: 'center', justifyContent: 'center', background: TIEF.flaeche(ton), border: `1px solid ${TIEF.rand(ton)}` }}><S width={18} height={18} color={ton} /></span>
                <span style={{ minWidth: 0, display: 'grid', gap: 2, textAlign: 'left' }}>
                  <span style={{ fontSize: TYP.body, color: C.ink, fontWeight: 600 }}>{e.name}</span>
                  <span style={{ fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.35 }}>{e.satz}</span>
                </span>
              </button>
            </li>
          );
        })}
        {!liste.length && <li style={{ fontSize: TYP.bedien, color: C.inkDim, padding: 8 }}>Nichts gefunden — anders suchen.</li>}
      </ul>
    </div>
  );
}
