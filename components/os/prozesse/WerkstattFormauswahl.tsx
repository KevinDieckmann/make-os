'use client';

// ─── Prozesse · Werkstatt — die Knoten-Auswahl am „+“ (Etappe B2, 21.10.; seit 22.10. „Werkstatt bau-fertig“ Punkt 5: Seitenleiste wie n8n) ─────────────────────
// Öffnet sich am „+“ eines Ausgangs, am „+“ mitten auf einem Faden (dazwischen einfügen), per Tab am gewählten Knoten bzw. wo ein Faden ins Leere gezogen wurde —
// als Seitenleiste rechts in voller Höhe der Fläche (vorher ein kleines Fenster mit höchstens 320 px Liste). Oben die Suche, darunter die Kategorien als Filter,
// dann die Gruppen (lib/prozesse/werkstatt-maske.ts `formauswahlGruppen`): „Zuletzt benutzt“ (im Browser gemerkt, nie im Bestand), Auslöser, „Daten“ und je
// Anbindung (Ablauf, Aufgabe, CRM, Inbox …). Pfeile wählen über alle Gruppen hinweg, Enter nimmt, Esc schließt. Auslöser nur, wenn er an den Anfang kommt; beim
// Anhängen an einen Knoten stehen sie ganz hinten. Werkstatt-Fäden (24.10., Bau-Test): beim Anhängen gibt es keine Auslöser mehr (ein zweiter landete in eigener
// Bahn) — am Auslöser stehen dafür oben „Auslöser ändern …“ (Typ wechseln) und „Weiteren Auslöser hinzufügen …“; `nurAusloeser` zeigt nur die Auslöser (diese beiden
// Wege). Eine Wahl zählt genau einmal (ein Doppelklick legt nie zwei Knoten an).

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as RKeyboardEvent } from 'react';
import { X, GitFork, Zap, Plus } from 'lucide-react';
import { FARBE as C, TYP, FLAECHE_STIL, TIEF, MIKRO } from '@/lib/make-one/design';
import { Pillen, SymbolKnopf } from '../ui';
import { BAUSTEIN_KATALOG, KATALOG_KATEGORIEN, type KatalogEintrag, type KatalogKategorie } from '@/lib/prozesse/baustein-katalog';
import type { ProzessForm } from '@/lib/prozesse/definition';
import { formauswahlGruppen, zuletztAus, zuletztMerken, ZULETZT_MERKER } from '@/lib/prozesse/werkstatt-maske';
import { WERKSTATT_FORM_FARBE } from '@/lib/prozesse/farben';
import { symbolVon } from './WerkstattKnoten';

const merkerLesen = (): string[] => { try { return zuletztAus(window.localStorage.getItem(ZULETZT_MERKER)); } catch { return []; } };
const merkerSchreiben = (l: readonly string[]) => { try { window.localStorage.setItem(ZULETZT_MERKER, JSON.stringify(l)); } catch { /* privates Fenster */ } };

export function WerkstattFormauswahl({ form, ohneAusloeser, anhaengen, titel, onWahl, onZu, onMehrfach, nurAusloeser, onAusloeser }: {
  form?: ProzessForm; ohneAusloeser?: boolean; /** An einen Knoten anhängen — Auslöser stehen dann hinten. */ anhaengen?: boolean; titel: string;
  onWahl: (e: KatalogEintrag) => void; onZu: () => void;
  /** Punkt 15: „Mehrfach-Entscheidung“ (Bau-Hilfe — wird zu einer Kaskade aus Rauten nach Regel). */
  onMehrfach?: () => void;
  /** Nur die Auslöser (Auslöser ändern bzw. einen weiteren hinzufügen). */
  nurAusloeser?: boolean;
  /** Am „+“ eines Auslösers: oben die zwei Wege für Auslöser. */
  onAusloeser?: (art: 'wechseln' | 'neu') => void;
}) {
  const [suche, setSuche] = useState('');
  const [kat, setKat] = useState<KatalogKategorie | 'alle'>(nurAusloeser ? 'ausloeser' : 'alle');
  /** Eine Wahl zählt genau einmal — bis die Auswahl zu ist (Doppelklick, Enter + Klick). */
  const genommen = useRef(false);
  const [i, setI] = useState(0);
  const [zuletzt, setZuletzt] = useState<string[]>([]);
  const eingabe = useRef<HTMLInputElement | null>(null);
  const liste = useRef<HTMLDivElement | null>(null);
  useEffect(() => { setZuletzt(merkerLesen()); eingabe.current?.focus(); }, []);
  const gruppen = useMemo(() => formauswahlGruppen(BAUSTEIN_KATALOG, { suche, form, ohneAusloeser: ohneAusloeser && !nurAusloeser, anhaengen: anhaengen && !nurAusloeser, kategorie: nurAusloeser ? 'ausloeser' : kat, zuletzt }), [suche, form, ohneAusloeser, anhaengen, kat, zuletzt, nurAusloeser]);
  const flach = useMemo(() => gruppen.flatMap(g => g.eintraege.map(e => ({ e, g: g.id }))), [gruppen]);
  useEffect(() => { setI(0); }, [suche, kat]);
  useEffect(() => { liste.current?.querySelector(`[data-wahl="${i}"]`)?.scrollIntoView({ block: 'nearest' }); }, [i]);
  const nehmen = (e: KatalogEintrag) => { if (genommen.current) return; genommen.current = true; merkerSchreiben(zuletztMerken(zuletzt, e.id)); onWahl(e); };
  const taste = (e: RKeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onZu(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setI(x => Math.min(flach.length - 1, x + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setI(x => Math.max(0, x - 1)); }
    else if (e.key === 'Enter' && flach[i]) { e.preventDefault(); nehmen(flach[i].e); }
  };
  const kategorien = KATALOG_KATEGORIEN.filter(k => !(ohneAusloeser && k.id === 'ausloeser')).sort((a, b) => (anhaengen ? Number(a.id === 'ausloeser') - Number(b.id === 'ausloeser') : 0));
  let nr = -1;
  return (
    <aside role="dialog" aria-label={titel} className="pw-auswahl-leiste" onKeyDown={taste} onPointerDown={e => e.stopPropagation()}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ ...MIKRO, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={titel}>{titel}</div>
        <SymbolKnopf ariaLabel="Schließen (Esc)" onClick={onZu}><X size={16} /></SymbolKnopf>
      </div>
      <input ref={eingabe} aria-label="Baustein suchen" placeholder="Baustein suchen … (z. B. Mail, Deal, Warten)" value={suche} onChange={e => setSuche(e.target.value)}
        style={{ ...FLAECHE_STIL.eingabe, width: '100%', minHeight: 44, boxSizing: 'border-box', borderRadius: 12, padding: '10px 14px', color: C.ink, fontSize: 16 }} />
      {/* Feinschliff 1 (23.10.): die Filter brechen um und stehen fest über der Liste (vorher eine wischbare Zeile, die die Liste halb verdeckte — globals.css
          `.pw-auswahl-leiste > :not(.pw-auswahl-liste)`). */}
      {!nurAusloeser && <div className="pw-auswahl-filter" role="group" aria-label="Kategorien"><Pillen liste={[{ id: 'alle' as const, label: 'Alle' }, ...kategorien.map(k => ({ id: k.id, label: k.titel }))]} aktiv={kat} onWahl={v => setKat(v)} /></div>}
      {onAusloeser && !suche.trim() && (
        <>
          <button type="button" className="fassbar pw-auswahl-zeile" onClick={() => onAusloeser('wechseln')} title="Den Typ dieses Auslösers wechseln — kein zweiter Auslöser">
            <span aria-hidden style={{ display: 'inline-flex', width: 34, height: 34, flex: '0 0 auto', borderRadius: 10, alignItems: 'center', justifyContent: 'center', background: TIEF.flaeche(WERKSTATT_FORM_FARBE.ausloeser), border: `1px solid ${TIEF.rand(WERKSTATT_FORM_FARBE.ausloeser)}` }}><Zap width={18} height={18} color={WERKSTATT_FORM_FARBE.ausloeser} /></span>
            <span style={{ minWidth: 0, display: 'grid', gap: 2, textAlign: 'left' }}>
              <span style={{ fontSize: TYP.body, color: C.ink, fontWeight: 600 }}>Auslöser ändern …</span>
              <span style={{ fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.35 }}>Von Hand, Ereignis, Zeitplan, je Person ab Uhrzeit, Webhook — der Ablauf dahinter bleibt.</span>
            </span>
          </button>
          <button type="button" className="fassbar pw-auswahl-zeile" onClick={() => onAusloeser('neu')} title="Einen zweiten Auslöser dazu — er führt in den ersten Schritt">
            <span aria-hidden style={{ display: 'inline-flex', width: 34, height: 34, flex: '0 0 auto', borderRadius: 10, alignItems: 'center', justifyContent: 'center', background: TIEF.flaeche(WERKSTATT_FORM_FARBE.ausloeser), border: `1px solid ${TIEF.rand(WERKSTATT_FORM_FARBE.ausloeser)}` }}><Plus width={18} height={18} color={WERKSTATT_FORM_FARBE.ausloeser} /></span>
            <span style={{ minWidth: 0, display: 'grid', gap: 2, textAlign: 'left' }}>
              <span style={{ fontSize: TYP.body, color: C.ink, fontWeight: 600 }}>Weiteren Auslöser hinzufügen …</span>
              <span style={{ fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.35 }}>Ein zweiter Start — beide führen in den ersten Schritt.</span>
            </span>
          </button>
        </>
      )}
      {onMehrfach && !suche.trim() && (kat === 'alle' || kat === 'entscheidung') && (
        <button type="button" className="fassbar pw-auswahl-zeile" onClick={onMehrfach} title="Mehrere Fälle mit je einer Bedingung — gebaut als Rauten nach Regel hintereinander">
          <span aria-hidden style={{ display: 'inline-flex', width: 34, height: 34, flex: '0 0 auto', borderRadius: 10, alignItems: 'center', justifyContent: 'center', background: TIEF.flaeche(WERKSTATT_FORM_FARBE.entscheidung), border: `1px solid ${TIEF.rand(WERKSTATT_FORM_FARBE.entscheidung)}` }}><GitFork width={18} height={18} color={WERKSTATT_FORM_FARBE.entscheidung} /></span>
          <span style={{ minWidth: 0, display: 'grid', gap: 2, textAlign: 'left' }}>
            <span style={{ fontSize: TYP.body, color: C.ink, fontWeight: 600 }}>Mehrfach-Entscheidung …</span>
            <span style={{ fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.35 }}>Mehrere Fälle, der erste passende gewinnt — wird zu Rauten nach Regel.</span>
          </span>
        </button>
      )}
      <div ref={liste} role="listbox" aria-label="Bausteine" className="pw-auswahl-liste">
        {gruppen.map(g => (
          <section key={g.id} aria-label={g.titel} style={{ display: 'grid', gap: 2 }}>
            <div style={{ ...MIKRO, padding: '8px 4px 2px' }}>{g.titel}</div>
            {g.eintraege.map(e => {
              nr += 1;
              const j = nr;
              const S = symbolVon({ form: e.form, katalog: { id: e.id } });
              const ton = WERKSTATT_FORM_FARBE[e.form];
              return (
                <div key={`${g.id}:${e.id}`} role="option" aria-selected={j === i} data-wahl={j}>
                  <button type="button" className="fassbar pw-auswahl-zeile" onClick={() => nehmen(e)} onMouseEnter={() => setI(j)} title={e.satz}
                    style={{ background: j === i ? TIEF.flaeche(ton) : 'transparent', borderColor: j === i ? TIEF.rand(ton) : 'transparent' }}>
                    <span aria-hidden style={{ display: 'inline-flex', width: 34, height: 34, flex: '0 0 auto', borderRadius: 10, alignItems: 'center', justifyContent: 'center', background: TIEF.flaeche(ton), border: `1px solid ${TIEF.rand(ton)}` }}><S width={18} height={18} color={ton} /></span>
                    <span style={{ minWidth: 0, display: 'grid', gap: 2, textAlign: 'left' }}>
                      <span style={{ fontSize: TYP.body, color: C.ink, fontWeight: 600 }}>{e.name}</span>
                      <span style={{ fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.35 }}>{e.satz}</span>
                    </span>
                  </button>
                </div>
              );
            })}
          </section>
        ))}
        {!flach.length && <p style={{ fontSize: TYP.bedien, color: C.inkDim, padding: 8, margin: 0 }}>Nichts gefunden — anders suchen.</p>}
      </div>
    </aside>
  );
}
