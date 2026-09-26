'use client';

// ─── MAKE OS — Fläche: eine Seite, die man sich selbst gestaltet (26.09.) ───
// Kevin: „Alle Widgets immer zu bearbeiten, andere hinzufügen; seine eigene
// Seite vorne soll man sich selber gestalten — auch wenn wir am Anfang unsere
// jetzt lassen.“ Entschieden: alle Karten-Seiten, Stift oben + langer Druck,
// Breite ⅓/½/⅔/voll, ✕ ausblenden, ⚙ Einstellungen, „+ Widget“ aus dem Katalog.
//
//   <Flaeche seite="heute" widgets={[{ id: 'aufgaben', art: 'aufgaben', breite: 4 }, …]} />
//   <Flaeche seite="gesundheit-heute">
//     <Kachel id="morgen" titel="Morgen-Check" breite={4}><Karte>…</Karte></Kachel>
//   </Flaeche>
// Feste Karten der Seite (Kachel) und Katalog-Widgets liegen in EINEM Raster:
// 6 Spalten, 8-px-Zeilen, jede Kachel misst ihre Höhe (ResizeObserver) und
// spannt so viele Zeilen — dichtes Packen wie zwei Spalten, aber frei. Unter
// 1180 px eine Spalte. Layout je Person (/api/state/flaeche); der Standard
// der Seite wird nie gespeichert, so entwickelt er sich weiter.

import { Children, createContext, isValidElement, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent, type ReactElement, type ReactNode } from 'react';
import { anwenden, wende, ausgeblendet, istStandard, BREITEN, type Layout, type Op, type Platz, type StandardPlatz, type Breite, type Wert } from '@/lib/flaeche/modell';
import { FARBE as C, TYP, LEUCHT } from '@/lib/make-one/design';
import { Karte, Leer, Knopf, useBreit } from '../schlank';
import { WIDGETS, KATALOG, type EinstellungDef } from './widgets';

export interface KachelProps { id: string; titel: string; breite?: Breite; children: ReactNode }
/** Feste Karte einer Seite — nur als Kind von <Flaeche> gültig. */
export function Kachel(_: KachelProps): ReactElement | null { return null; }

interface Ctx { bearbeiten: boolean; dragId: string | null; schmal: boolean; tu: (op: Op) => void; starteZug: (id: string, e: RPointerEvent) => void; langerDruck: (e: RPointerEvent) => void }
const FlaecheCtx = createContext<Ctx | null>(null);

const nackt: CSSProperties = { background: 'none', border: 'none', padding: '4px 6px', cursor: 'pointer', color: C.inkDim, fontSize: 12, fontFamily: 'inherit', borderRadius: 8 };
const GAP = 14, ZEILE = 8;

export function Flaeche({ seite, widgets = [], standard: standardProp, children, katalog = true }: { seite: string; widgets?: StandardPlatz[]; standard?: StandardPlatz[]; children?: ReactNode; katalog?: boolean }) {
  const schmal = !useBreit();
  // Feste Karten aus den Kindern einsammeln (Reihenfolge = Standard)
  const kinder = useMemo(() => {
    const m = new Map<string, KachelProps>();
    Children.forEach(children, k => { if (isValidElement<KachelProps>(k) && k.type === Kachel && k.props.id) m.set(k.props.id, k.props); });
    return m;
  }, [children]);
  const standard = useMemo<StandardPlatz[]>(() => standardProp ?? [...[...kinder.values()].map(k => ({ id: k.id, art: 'seite', breite: k.breite ?? 3, titel: k.titel })), ...widgets], [standardProp, kinder, widgets]);
  const standardKey = standard.map(s => `${s.id}:${s.breite}`).join('|');

  const [gespeichert, setGespeichert] = useState<Layout | null | undefined>(undefined);
  const [bearbeiten, setBearbeiten] = useState(false);
  const [katalogOffen, setKatalogOffen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [meld, setMeld] = useState('');
  useEffect(() => {
    let aktiv = true;
    fetch(`/api/state/flaeche?seite=${encodeURIComponent(seite)}`, { cache: 'no-store' }).then(r => r.json()).then(d => { if (aktiv) setGespeichert(d?.layout ?? null); }).catch(() => { if (aktiv) setGespeichert(null); });
    return () => { aktiv = false; };
  }, [seite]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const layout = useMemo(() => anwenden(standard, gespeichert ?? null), [standardKey, gespeichert]);

  const speicherTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const tu = useCallback((op: Op) => {
    setGespeichert(alt => {
      const basis = anwenden(standard, alt ?? null);
      const neu = wende(basis, op, standard);
      const zuSpeichern = istStandard(neu, standard) ? null : neu;
      clearTimeout(speicherTimer.current);
      speicherTimer.current = setTimeout(() => {
        fetch('/api/state/flaeche', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seite, layout: zuSpeichern }) })
          .then(r => r.json()).then(d => { if (!d?.ok) setMeld(d?.error ?? 'Nicht gespeichert.'); }).catch(() => setMeld('Nicht gespeichert — offline?'));
      }, 400);
      return zuSpeichern ?? { plaetze: [], versteckt: [], stand: '' };
    });
  }, [seite, standard]);

  // ── Ziehen am Griff (Maus und Finger): wohin der Zeiger zeigt, dorthin rutscht die Kachel ──
  const zug = useRef<{ id: string; letzteVorId: string | null | undefined }>({ id: '', letzteVorId: undefined });
  const starteZug = useCallback((id: string, e: RPointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    zug.current = { id, letzteVorId: undefined };
    setDragId(id);
  }, []);
  const zugBewegt = (e: RPointerEvent) => {
    if (!dragId) return;
    const ziel = document.elementsFromPoint(e.clientX, e.clientY).map(el => (el as HTMLElement).closest?.('[data-kachel-id]') as HTMLElement | null).find(el => el && el.dataset.kachelId !== dragId);
    if (!ziel) return;
    const zielId = ziel.dataset.kachelId!;
    const r = ziel.getBoundingClientRect();
    const unten = schmal ? e.clientY > r.top + r.height / 2 : (e.clientY > r.top + r.height / 2 && e.clientX > r.left + r.width * 0.25) || e.clientX > r.left + r.width * 0.75;
    const ids = layout.plaetze.map(p => p.id);
    const idx = ids.indexOf(zielId);
    const vorId = unten ? (ids[idx + 1] === dragId ? ids[idx + 2] ?? null : ids[idx + 1] ?? null) : zielId;
    if (vorId === zug.current.letzteVorId) return;
    zug.current.letzteVorId = vorId;
    tu({ op: 'verschieben', id: dragId, vorId: vorId === dragId ? null : vorId });
  };
  const zugEnde = () => { if (dragId) setDragId(null); };

  // ── Langer Druck (600 ms, ohne Bewegung) auf eine Kachel öffnet den Bearbeiten-Modus ──
  const druck = useRef<{ t: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null);
  const langerDruck = useCallback((e: RPointerEvent) => {
    if (bearbeiten) return;
    const ziel = e.target as HTMLElement;
    if (ziel.closest('input, textarea, select, button, a, label, [contenteditable], [role="button"]')) return;
    const x = e.clientX, y = e.clientY;
    const ende = () => { if (druck.current) { clearTimeout(druck.current.t); druck.current = null; } window.removeEventListener('pointerup', ende); window.removeEventListener('pointercancel', ende); window.removeEventListener('pointermove', bewegt); };
    const bewegt = (ev: PointerEvent) => { if (Math.hypot(ev.clientX - x, ev.clientY - y) > 8) ende(); };
    druck.current = { t: setTimeout(() => { ende(); setBearbeiten(true); try { navigator.vibrate?.(12); } catch { /* egal */ } }, 600), x, y };
    window.addEventListener('pointerup', ende); window.addEventListener('pointercancel', ende); window.addEventListener('pointermove', bewegt);
  }, [bearbeiten]);

  const ctx = useMemo<Ctx>(() => ({ bearbeiten, dragId, schmal, tu, starteZug, langerDruck }), [bearbeiten, dragId, schmal, tu, starteZug, langerDruck]);
  const versteckte = ausgeblendet(layout, standard);
  const zuruecksetzbar = !istStandard(layout, standard);

  return (
    <FlaecheCtx.Provider value={ctx}>
      <div className="flaeche-kopf" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, flexWrap: 'wrap', minHeight: 28, margin: '-6px 0 2px' }}>
        {meld && <span style={{ fontSize: 12, color: LEUCHT.achtung, marginRight: 'auto' }}>{meld}</span>}
        {bearbeiten ? (
          <>
            <span style={{ fontSize: 12, color: C.inkLeise, marginRight: 'auto', ...(schmal ? { order: 9, flex: '1 1 100%' } : {}) }}>{schmal ? 'Am ⋮⋮ ziehen · ✕ ausblenden · ⚙ einstellen' : 'Am ⋮⋮ ziehen · Breite ⅓ ½ ⅔ ▭ · ✕ ausblenden · ⚙ einstellen'}</span>
            {katalog && <Knopf leise onClick={() => setKatalogOffen(o => !o)}>{katalogOffen ? 'Katalog schließen' : '+ Widget'}</Knopf>}
            {zuruecksetzbar && <Knopf leise onClick={() => { if (window.confirm('Diese Seite auf den Standard zurücksetzen?')) { tu({ op: 'zuruecksetzen' }); setKatalogOffen(false); } }}>Zurücksetzen</Knopf>}
            <Knopf farbe={LEUCHT.gut} onClick={() => { setBearbeiten(false); setKatalogOffen(false); }}>Fertig</Knopf>
          </>
        ) : (
          <button type="button" onClick={() => setBearbeiten(true)} title="Seite anpassen — oder eine Karte länger gedrückt halten" className="fassbar" style={{ ...nackt, color: C.inkLeise, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span aria-hidden style={{ fontSize: 13 }}>✎</span> Anpassen
          </button>
        )}
      </div>

      {bearbeiten && katalogOffen && (
        <Karte i={0} akzent={LEUCHT.gut} style={{ marginBottom: GAP }}>
          <div style={{ display: 'grid', gap: 14 }}>
            {versteckte.length > 0 && (
              <div>
                <div style={{ fontSize: TYP.mikro, letterSpacing: '.1em', textTransform: 'uppercase', color: C.inkLeise, fontWeight: 600, marginBottom: 8 }}>Ausgeblendet auf dieser Seite</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {versteckte.map(v => <button key={v.id} type="button" onClick={() => tu({ op: 'einblenden', id: v.id })} style={{ ...nackt, padding: '7px 12px', background: 'rgba(255,255,255,.05)', color: C.ink, fontSize: TYP.bedien }}>+ {v.titel ?? WIDGETS[v.art ?? '']?.label ?? v.id}</button>)}
                </div>
              </div>
            )}
            {katalog && [...new Set(KATALOG.map(k => k.bereich))].map(bereich => (
              <div key={bereich}>
                <div style={{ fontSize: TYP.mikro, letterSpacing: '.1em', textTransform: 'uppercase', color: C.inkLeise, fontWeight: 600, marginBottom: 8 }}>{bereich}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                  {KATALOG.filter(k => k.bereich === bereich).map((k, n) => (
                    <button key={`${k.art}-${n}`} type="button" onClick={() => { tu({ op: 'hinzufuegen', art: k.art, breite: k.breite, einstellungen: k.voreinstellung, titel: k.label !== WIDGETS[k.art]?.label ? k.label : undefined }); setMeld(''); }}
                      className="fassbar" style={{ ...nackt, textAlign: 'left', padding: '10px 12px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 12, display: 'grid', gap: 3 }}>
                      <span style={{ color: C.ink, fontSize: TYP.bedien, fontWeight: 600 }}>+ {k.label}</span>
                      <span style={{ color: C.inkLeise, fontSize: 12, lineHeight: 1.4 }}>{k.beschreibung}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <p style={{ fontSize: 12, color: C.inkLeise, margin: 0 }}>Widgets zeigen nur, was es für dich gibt — ohne Haushalt keine Familie, ohne Werte keine Zahlen.</p>
          </div>
        </Karte>
      )}

      <div className={`flaeche${schmal ? ' flaeche-schmal' : ''}`} onPointerMove={dragId ? zugBewegt : undefined} onPointerUp={dragId ? zugEnde : undefined} onPointerCancel={dragId ? zugEnde : undefined}>
        {layout.plaetze.map((p, i) => {
          const kind = kinder.get(p.id);
          const def = WIDGETS[p.art];
          if (!kind && !def) return null;
          const titel = p.titel ?? kind?.titel ?? def?.label ?? p.id;
          return (
            <Platzhalter key={p.id} platz={p} titel={titel} einstellungen={def?.einstellungen} festeKarte={!!kind}>
              {kind ? kind.children : def ? <def.Komponente e={p.einstellungen} titel={p.titel} i={Math.min(i, 6)} /> : null}
            </Platzhalter>
          );
        })}
        {!layout.plaetze.length && <Karte i={0}><Leer>Diese Seite ist leer. {bearbeiten ? 'Über „+ Widget“ kommt etwas drauf.' : 'Über ✎ Anpassen kommt etwas drauf.'}</Leer></Karte>}
      </div>
    </FlaecheCtx.Provider>
  );
}

/** Ein Platz im Raster: misst seine Höhe, spannt Zeilen, trägt im Bearbeiten-Modus Griff, Breite, ⚙ und ✕. */
function Platzhalter({ platz, titel, einstellungen, festeKarte, children }: { platz: Platz; titel: string; einstellungen?: EinstellungDef[]; festeKarte: boolean; children: ReactNode }) {
  const ctx = useContext(FlaecheCtx)!;
  const { bearbeiten, dragId, schmal, tu } = ctx;
  const aussen = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState(1);
  const [leer, setLeer] = useState(false);
  const [offen, setOffen] = useState(false);
  useEffect(() => {
    const a = aussen.current, el = inner.current; if (!a || !el) return;
    // Zeilen nach der ganzen Kachel (Leiste + Inhalt + Platzhalter), „leer“ nur nach dem Inhalt.
    const mess = () => { setLeer(el.getBoundingClientRect().height < 2); setRows(Math.max(1, Math.ceil((a.getBoundingClientRect().height + GAP) / ZEILE))); };
    mess();
    const ro = new ResizeObserver(mess); ro.observe(a); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => { if (!bearbeiten) setOffen(false); }, [bearbeiten]);
  const unsichtbar = leer && !bearbeiten;
  const style: CSSProperties = unsichtbar
    ? { position: 'absolute', visibility: 'hidden', pointerEvents: 'none', width: 320, left: 0, top: 0 }
    : schmal ? {} : { gridColumn: `span ${platz.breite}`, gridRowEnd: `span ${rows}` };
  return (
    <div ref={aussen} data-kachel-id={platz.id} className={`kachel${bearbeiten ? ' kachel-bearbeiten' : ''}${dragId === platz.id ? ' kachel-zieht' : ''}`} style={style} onPointerDown={ctx.langerDruck}>
      {bearbeiten && (
        <div className="kachel-leiste">
          <button type="button" className="kachel-griff" onPointerDown={e => ctx.starteZug(platz.id, e)} title="Ziehen" aria-label={`${titel} verschieben`} style={{ ...nackt, fontSize: 15, letterSpacing: '-.1em', color: C.inkDim }}>⋮⋮</button>
          <span style={{ fontSize: 12, color: C.inkDim, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{titel}</span>
          {!schmal && BREITEN.map(b => (
            <button key={b.b} type="button" onClick={() => tu({ op: 'breite', id: platz.id, breite: b.b })} title={b.titel} style={{ ...nackt, padding: '3px 6px', color: platz.breite === b.b ? LEUCHT.gut : C.inkLeise, background: platz.breite === b.b ? `${LEUCHT.gut}1A` : 'transparent' }}>{b.label}</button>
          ))}
          {(einstellungen?.length || !festeKarte) && <button type="button" onClick={() => setOffen(o => !o)} title="Einstellungen" style={{ ...nackt, color: offen ? LEUCHT.gut : C.inkLeise }}>⚙</button>}
          <button type="button" onClick={() => tu({ op: 'ausblenden', id: platz.id })} title={festeKarte ? 'Ausblenden (kommt über „+ Widget“ zurück)' : 'Entfernen'} style={{ ...nackt, color: C.inkLeise }}>✕</button>
        </div>
      )}
      <div ref={inner} className="kachel-inhalt">
        {bearbeiten && offen && <Einstellungen platz={platz} defs={einstellungen ?? []} festeKarte={festeKarte} tu={tu} zu={() => setOffen(false)} />}
        {children}
      </div>
      {leer && bearbeiten && <Karte i={0}><Leer>{titel}: gerade nichts anzuzeigen — bleibt hier stehen, bis es etwas gibt.</Leer></Karte>}
    </div>
  );
}

function Einstellungen({ platz, defs, festeKarte, tu, zu }: { platz: Platz; defs: EinstellungDef[]; festeKarte: boolean; tu: (op: Op) => void; zu: () => void }) {
  const [titel, setTitel] = useState(platz.titel ?? '');
  const wert = (d: EinstellungDef): Wert => platz.einstellungen[d.k] ?? d.standard;
  const setz = (k: string, v: Wert) => tu({ op: 'einstellen', id: platz.id, einstellungen: { [k]: v } });
  const feldStil: CSSProperties = { background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 9, color: C.ink, padding: '6px 9px', fontSize: 12.5, fontFamily: 'inherit', colorScheme: 'dark' };
  return (
    <div style={{ padding: '10px 12px', marginBottom: 8, borderRadius: 12, background: 'rgba(255,255,255,.04)', border: `1px solid ${LEUCHT.gut}33`, display: 'grid', gap: 8, pointerEvents: 'auto' }}>
      {!festeKarte && (
        <label style={{ display: 'grid', gap: 4, fontSize: 12, color: C.inkLeise }}>Titel (leer = Standard)
          <input value={titel} onChange={e => setTitel(e.target.value)} onBlur={() => tu({ op: 'einstellen', id: platz.id, titel: titel.trim() || null })} placeholder="eigener Titel" style={feldStil} />
        </label>
      )}
      {defs.map(d => (
        <label key={d.k} style={{ display: 'grid', gap: 4, fontSize: 12, color: C.inkLeise }}>{d.label}
          {d.art === 'wahl' && <select value={String(wert(d))} onChange={e => { const o = d.optionen?.find(x => String(x.w) === e.target.value); if (o) setz(d.k, o.w); }} style={feldStil}>{(d.optionen ?? []).map(o => <option key={String(o.w)} value={String(o.w)}>{o.label}</option>)}</select>}
          {d.art === 'schalter' && <button type="button" onClick={() => setz(d.k, !(wert(d) === true))} style={{ ...feldStil, textAlign: 'left', cursor: 'pointer', color: wert(d) === true ? LEUCHT.gut : C.inkDim }}>{wert(d) === true ? '● an' : '○ aus'}</button>}
          {d.art === 'text' && <input value={String(wert(d))} onChange={e => setz(d.k, e.target.value)} style={feldStil} />}
        </label>
      ))}
      <div><button type="button" onClick={zu} style={{ ...nackt, padding: '5px 10px', background: 'rgba(255,255,255,.06)', color: C.ink }}>Fertig</button></div>
    </div>
  );
}
