'use client';

// ─── Kalender: Tages-/Wochenraster (27.09.) ─────────────────────────────────
// Wie Google Kalender: Stundenraster 0–24, Ganztags-Zeile oben, Termine als
// Blöcke (überlappende nebeneinander, lib/kalender/layout.ts), rote Jetzt-Linie,
// Klick in eine Lücke legt einen Termin an, Anfassen verschiebt (auch auf einen
// anderen Tag), die untere Kante ändert die Dauer — alles im 15-Minuten-Raster.
// Was nur in Apple änderbar ist (Serie, Teilnehmer, fremder Kalender) zeigt 🔒
// und lässt sich nicht ziehen.

import { useEffect, useMemo, useRef, useState, type PointerEvent as RPE } from 'react';
import { FARBE as C, SCHRIFT } from '@/lib/make-one/design';
import { LEUCHT } from '../schlank';
import { spaltenLegen } from '@/lib/kalender/layout';
import { GanztagsZelle, WER_FARBE, type KTermin, type KFrist, type KErinnerung } from './teile';

export const PX_MIN = 0.9;
const RASTER = 15;
const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const minVon = (wand: string) => Number(wand.slice(11, 13)) * 60 + Number(wand.slice(14, 16));
const uhr = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const schnapp = (m: number) => Math.max(0, Math.min(24 * 60, Math.round(m / RASTER) * RASTER));

interface Zieh { uid: string; art: 'move' | 'resize'; y0: number; x0: number; start: number; ende: number; tag: number; neuTag: number; neuStart: number; neuEnde: number; bewegt: boolean }

export function Zeitraster({ tage, heute, termine, fristen, erinnerungen, aufgaben, farbe, onOeffnen, onNeu, onVerschieben, onAufgabe }: {
  tage: string[]; heute: string; termine: KTermin[]; fristen: KFrist[]; erinnerungen: KErinnerung[];
  aufgaben: { id: string; title: string; done: boolean; priority?: string; tag: string }[];
  farbe: (t: KTermin) => string;
  onOeffnen: (t: KTermin) => void; onNeu: (tag: string, startMin: number) => void;
  onVerschieben: (t: KTermin, tag: string, startMin: number, endeMin: number) => void; onAufgabe: (id: string) => void;
}) {
  const spalten = useRef<HTMLDivElement | null>(null);
  const rollen = useRef<HTMLDivElement | null>(null);
  const [zieh, setZieh] = useState<Zieh | null>(null);
  const [jetztMin, setJetztMin] = useState(() => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); });
  useEffect(() => { const t = setInterval(() => { const d = new Date(); setJetztMin(d.getHours() * 60 + d.getMinutes()); }, 60_000); return () => clearInterval(t); }, []);
  // Beim ersten Zeichnen auf 7 Uhr rollen (bzw. eine Stunde vor jetzt, wenn heute sichtbar ist).
  useEffect(() => { const r = rollen.current; if (!r) return; const ziel = tage.includes(heute) ? Math.max(0, jetztMin - 60) : 7 * 60; r.scrollTop = ziel * PX_MIN; }, [tage.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const jeTag = useMemo(() => tage.map(tag => {
    const mitZeit = termine.filter(t => !t.ganztags && t.start.slice(0, 10) <= tag && t.ende.slice(0, 10) >= tag && (t.ende.slice(0, 10) > tag || minVon(t.ende) > 0));
    const lagen = mitZeit.map(t => ({ id: t.id, von: t.start.slice(0, 10) < tag ? 0 : minVon(t.start), bis: t.ende.slice(0, 10) > tag ? 24 * 60 : Math.max(minVon(t.ende), (t.start.slice(0, 10) < tag ? 0 : minVon(t.start)) + RASTER) }));
    const plaetze = new Map(spaltenLegen(lagen).map(p => [p.id, p]));
    return { tag, mitZeit, lagen: new Map(lagen.map(l => [l.id, l])), plaetze,
      ganztags: termine.filter(t => t.ganztags && t.start.slice(0, 10) <= tag && t.ende.slice(0, 10) > tag),
      fristen: fristen.filter(f => f.tag === tag), erinnerungen: erinnerungen.filter(e => e.tag === tag), aufgaben: aufgaben.filter(a => a.tag === tag) };
  }), [tage, termine, fristen, erinnerungen, aufgaben]);

  const spalteAus = (clientX: number) => { const r = spalten.current?.getBoundingClientRect(); if (!r) return 0; return Math.max(0, Math.min(tage.length - 1, Math.floor(((clientX - r.left) / r.width) * tage.length))); };

  const anfassen = (e: RPE<HTMLDivElement>, t: KTermin, tagIdx: number, art: Zieh['art']) => {
    if (!t.bearbeitbar || e.button !== 0) return;
    e.stopPropagation();
    const l = jeTag[tagIdx].lagen.get(t.id)!;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setZieh({ uid: t.uid, art, y0: e.clientY, x0: e.clientX, start: l.von, ende: l.bis, tag: tagIdx, neuTag: tagIdx, neuStart: l.von, neuEnde: l.bis, bewegt: false });
  };
  const bewegen = (e: RPE<HTMLDivElement>) => {
    if (!zieh) return;
    const dMin = Math.round((e.clientY - zieh.y0) / PX_MIN / RASTER) * RASTER;
    const bewegt = zieh.bewegt || Math.abs(e.clientY - zieh.y0) > 4 || Math.abs(e.clientX - zieh.x0) > 8;
    if (zieh.art === 'move') {
      const dauer = zieh.ende - zieh.start;
      const neuStart = Math.max(0, Math.min(24 * 60 - dauer, zieh.start + dMin));
      setZieh({ ...zieh, bewegt, neuTag: spalteAus(e.clientX), neuStart, neuEnde: neuStart + dauer });
    } else setZieh({ ...zieh, bewegt, neuEnde: Math.max(zieh.start + RASTER, Math.min(24 * 60, zieh.ende + dMin)) });
  };
  const loslassen = (t: KTermin) => {
    if (!zieh) return;
    const z = zieh; setZieh(null);
    if (!z.bewegt) { onOeffnen(t); return; }
    if (z.neuTag === z.tag && z.neuStart === z.start && z.neuEnde === z.ende) return;
    onVerschieben(t, tage[z.neuTag], z.neuStart, z.neuEnde);
  };
  const klickLuecke = (e: React.MouseEvent<HTMLDivElement>, tag: string) => {
    if (zieh) return;
    const r = e.currentTarget.getBoundingClientRect();
    onNeu(tag, schnapp((e.clientY - r.top) / PX_MIN - RASTER));
  };

  const stunden = Array.from({ length: 24 }, (_, i) => i);
  const kopfBreite = 46;
  return (
    <div style={{ display: 'grid', gridTemplateRows: 'auto auto 1fr', minHeight: 0, height: '100%', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, overflow: 'hidden', background: 'rgba(255,255,255,.015)' }}>
      {/* Tagesköpfe */}
      <div style={{ display: 'grid', gridTemplateColumns: `${kopfBreite}px repeat(${tage.length}, 1fr)`, borderBottom: '1px solid rgba(255,255,255,.07)' }}>
        <div />
        {tage.map(tag => { const d = new Date(`${tag}T12:00:00`); const h = tag === heute; return (
          <div key={tag} style={{ padding: '8px 6px 6px', textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,.05)' }}>
            <div style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: h ? LEUCHT.puls : C.inkLeise, fontWeight: 700 }}>{WD[d.getDay()]}</div>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: '50%', marginTop: 2, fontFamily: SCHRIFT.display, fontSize: 17, fontWeight: 700, background: h ? LEUCHT.puls : 'transparent', color: h ? '#0b0b0c' : C.ink }}>{d.getDate()}</div>
          </div>
        ); })}
      </div>
      {/* Ganztags-Zeile */}
      <div style={{ display: 'grid', gridTemplateColumns: `${kopfBreite}px repeat(${tage.length}, 1fr)`, borderBottom: '1px solid rgba(255,255,255,.07)', maxHeight: 132, overflowY: 'auto' }}>
        <div style={{ fontSize: 11, color: C.inkLeise, padding: '6px 4px', textAlign: 'right' }}>ganzt.</div>
        {jeTag.map(t => (
          <div key={t.tag} style={{ padding: 4, borderLeft: '1px solid rgba(255,255,255,.05)', minWidth: 0 }}>
            <GanztagsZelle termine={t.ganztags} aufgaben={t.aufgaben} erinnerungen={t.erinnerungen} fristen={t.fristen} onTermin={onOeffnen} onAufgabeHaken={onAufgabe} />
          </div>
        ))}
      </div>
      {/* Stundenraster */}
      <div ref={rollen} style={{ overflowY: 'auto', minHeight: 0, position: 'relative' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `${kopfBreite}px 1fr`, height: 24 * 60 * PX_MIN }}>
          <div style={{ position: 'relative' }}>
            {stunden.map(h => <div key={h} style={{ position: 'absolute', top: h * 60 * PX_MIN - 7, right: 6, fontSize: 11, color: C.inkLeise, fontVariantNumeric: 'tabular-nums' }}>{h > 0 ? `${String(h).padStart(2, '0')}:00` : ''}</div>)}
          </div>
          <div ref={spalten} style={{ position: 'relative', display: 'grid', gridTemplateColumns: `repeat(${tage.length}, 1fr)` }}>
            {/* Stundenlinien */}
            {stunden.map(h => <div key={h} style={{ position: 'absolute', left: 0, right: 0, top: h * 60 * PX_MIN, borderTop: `1px solid rgba(255,255,255,${h % 6 === 0 ? '.09' : '.05'})`, pointerEvents: 'none' }} />)}
            {jeTag.map((t, ti) => {
              const h = t.tag === heute;
              return (
                <div key={t.tag} onClick={e => klickLuecke(e, t.tag)} style={{ position: 'relative', borderLeft: '1px solid rgba(255,255,255,.05)', background: h ? 'rgba(255,255,255,.02)' : undefined, cursor: 'copy' }}>
                  {h && <div style={{ position: 'absolute', left: 0, right: 0, top: jetztMin * PX_MIN, borderTop: `2px solid ${LEUCHT.kritisch}`, zIndex: 3, pointerEvents: 'none' }}><span style={{ position: 'absolute', left: -5, top: -5, width: 8, height: 8, borderRadius: '50%', background: LEUCHT.kritisch }} /></div>}
                  {t.mitZeit.map(ev => {
                    const l = t.lagen.get(ev.id)!; const p = t.plaetze.get(ev.id)!;
                    const z = zieh && zieh.uid === ev.uid && zieh.tag === ti ? zieh : null;
                    const von = z ? zieh!.neuStart : l.von, bis = z ? zieh!.neuEnde : l.bis;
                    const versetzt = z && z.art === 'move' && z.neuTag !== ti;
                    const f = farbe(ev);
                    const breite = 100 / p.spalten;
                    return (
                      <div key={ev.id} role="button" tabIndex={0} title={`${ev.titel} · ${uhr(l.von)}–${uhr(l.bis)} · ${ev.kalender}${ev.bearbeitbar ? '' : ' (nur in Apple änderbar)'}`}
                        onPointerDown={e => anfassen(e, ev, ti, 'move')} onPointerMove={bewegen} onPointerUp={() => loslassen(ev)} onPointerCancel={() => setZieh(null)}
                        onClick={e => { e.stopPropagation(); if (!ev.bearbeitbar) onOeffnen(ev); }} onKeyDown={e => { if (e.key === 'Enter') onOeffnen(ev); }}
                        style={{ position: 'absolute', top: von * PX_MIN, height: Math.max(18, (bis - von) * PX_MIN - 2), left: `calc(${p.spalte * breite}% + 2px)`, width: `calc(${breite}% - 4px)`,
                          background: `${f}${versetzt ? '33' : '2a'}`, borderLeft: `3px solid ${f}`, borderRadius: 7, padding: '3px 6px', overflow: 'hidden', cursor: ev.bearbeitbar ? (z ? 'grabbing' : 'grab') : 'pointer',
                          boxShadow: z ? `0 8px 24px rgba(0,0,0,.4), 0 0 0 1px ${f}` : undefined, zIndex: z ? 5 : 2, opacity: versetzt ? .45 : 1, userSelect: 'none', touchAction: 'none', fontFamily: SCHRIFT.text }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{!ev.bearbeitbar && <span aria-label="nur in Apple" style={{ marginRight: 4 }}>🔒</span>}{ev.titel}</div>
                        {(bis - von) * PX_MIN >= 30 && <div style={{ fontSize: 11, color: C.inkDim, fontVariantNumeric: 'tabular-nums' }}>{uhr(von)}–{uhr(bis)}{ev.ort ? ` · ${ev.ort}` : ''}</div>}
                        {ev.bearbeitbar && <div onPointerDown={e => anfassen(e, ev, ti, 'resize')} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 8, cursor: 'ns-resize' }} />}
                      </div>
                    );
                  })}
                  {/* Geist in der Zielspalte beim Verschieben auf einen anderen Tag */}
                  {zieh && zieh.art === 'move' && zieh.neuTag === ti && zieh.tag !== ti && (
                    <div style={{ position: 'absolute', top: zieh.neuStart * PX_MIN, height: (zieh.neuEnde - zieh.neuStart) * PX_MIN - 2, left: 2, right: 2, borderRadius: 7, border: `2px dashed ${WER_FARBE.kevin}`, background: 'rgba(255,255,255,.06)', pointerEvents: 'none', zIndex: 4, fontSize: 11, color: C.inkDim, padding: '3px 6px' }}>{uhr(zieh.neuStart)}–{uhr(zieh.neuEnde)}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 11, color: C.inkLeise, padding: '6px 10px', borderTop: '1px solid rgba(255,255,255,.05)', fontFamily: SCHRIFT.text }}>Klick in eine Lücke legt an · anfassen verschiebt · untere Kante ändert die Dauer · 🔒 nur in Apple änderbar</div>
    </div>
  );
}
