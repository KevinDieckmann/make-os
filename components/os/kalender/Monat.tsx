'use client';

// ─── Kalender: Monatsblatt (27.09.) ─────────────────────────────────────────
// Sechs Wochen, Montag zuerst; je Tag höchstens drei Pillen, der Rest als
// „+n mehr“ (Klick öffnet den Tag). Fristen und Erinnerungen als kleine Punkte.
// Seit 30.09. (K3): Aufgaben an ihrer Deadline (Haken, Klick öffnet, auf einen anderen Tag ziehen = neue Deadline,
// die Uhrzeit bleibt) — dieselben Regeln wie im Raster (lib/kalender/aufgaben.ts).
// Seit 10.10. (Kevin: „man sieht einfach nichts, im Vergleich zu Google“): mehrtägige ganztägige Termine (Urlaub, Reise, Messe) sind je Woche
// EIN durchgehender Balken über die Tage (lib/kalender/layout.ts `ganztagsLegen`, höchstens zwei Bahnen, der Rest zählt in „+n mehr“) — vorher
// stand derselbe Urlaub an jedem Tag einzeln. Das Blatt füllt die Höhe, die der Kalender ihm gibt, und rollt in sich, wenn sie nicht reicht.
// Am Handy sind die Balken schmale Farbstreifen (wie die Punkte, `--monat-balken` in app/globals.css).

import { FARBE as C, SCHRIFT } from '@/lib/make-one/design';
import { LEUCHT } from '../ui';
import { FRIST_ZEICHEN, type KTermin, type KFrist, type KErinnerung } from './teile';
import { ART_FARBE } from '@/types/planer';
import type { KalenderAufgabe } from '@/lib/kalender/aufgaben';
import { ganztagsLegen, ganztagsSicht } from '@/lib/kalender/layout';
import { BLOCK_HEX } from '@/lib/kalender/darstellung';
import { tagPlus } from '@/lib/kalender/zeit';
import { aufgabeZiehStart, aufgabeAusZiehen, ziehtAufgabe } from './aufgaben';

const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MAX = 3;
/** Höchstens so viele Balken-Bahnen je Woche (wie die Ganztags-Zeile im Raster). */
const MAX_BAHNEN = 2;

/** Letzter Tag eines ganztägigen Termins (Ende ausschließlich). */
const ganztagsBis = (t: KTermin): string => { const e = tagPlus(t.ende.slice(0, 10), -1); const s = t.start.slice(0, 10); return e < s ? s : e; };
/** Ein ganztägiger Termin über mehr als einen Tag — er wird zum Balken. */
export const istMonatsBalken = (t: KTermin): boolean => t.ganztags && ganztagsBis(t) > t.start.slice(0, 10);

export function Monat({ blatt, monat, heute, termine, fristen, erinnerungen, farbe, onTag, onOeffnen, aufgaben = [], onAufgabe, onAufgabeHaken, onAufgabeEinplanen }: {
  blatt: string[]; monat: number; heute: string; termine: KTermin[]; fristen: KFrist[]; erinnerungen: KErinnerung[];
  farbe: (t: KTermin) => string; onTag: (tag: string) => void; onOeffnen: (t: KTermin) => void;
  aufgaben?: KalenderAufgabe[]; onAufgabe?: (id: string) => void; onAufgabeHaken?: (id: string) => void;
  onAufgabeEinplanen?: (id: string, tag: string, zeit: string | null) => void;
}) {
  const balkenTermine = termine.filter(istMonatsBalken);
  const nachId = new Map(balkenTermine.map(t => [t.id, t]));
  const wochen = Array.from({ length: Math.ceil(blatt.length / 7) }, (_, w) => blatt.slice(w * 7, w * 7 + 7));
  return (
    <div style={{ display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', height: '100%', minHeight: 0, border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, overflow: 'hidden', background: 'rgba(255,255,255,.015)', fontFamily: SCHRIFT.text }}>
      {/* Wochentage — am Handy die Wisch-Zeile (wischen.ts). */}
      <div data-wisch-kopf="" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid rgba(255,255,255,.07)', touchAction: 'pan-y' }}>
        {WD.map(w => <div key={w} style={{ padding: '8px 6px', textAlign: 'center', fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: C.inkLeise, fontWeight: 700 }}>{w}</div>)}
      </div>
      <div style={{ display: 'grid', gridTemplateRows: `repeat(${wochen.length}, minmax(var(--monat-zeile, 92px), 1fr))`, minHeight: 0, overflowY: 'auto', overscrollBehaviorY: 'contain' }} className="ui-monat-wochen">
        {wochen.map(woche => {
          const lage = ganztagsLegen(balkenTermine.map(t => ({ id: t.id, von: t.start.slice(0, 10), bis: ganztagsBis(t) })), woche);
          const sicht = ganztagsSicht(lage, woche.length, false, MAX_BAHNEN);
          const bahnen = sicht.zeilen;
          return (
            <div key={woche[0]} className="ui-monat-woche" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gridTemplateRows: `var(--monat-kopf, 30px)${bahnen ? ` repeat(${bahnen}, var(--monat-balken, 20px))` : ''} minmax(0, 1fr)`, rowGap: 2, minHeight: 0 }}>
              {woche.map((tag, i) => {
                const imMonat = Number(tag.slice(5, 7)) === monat;
                const h = tag === heute;
                const alle = termine.filter(t => t.start.slice(0, 10) <= tag && (t.ende.slice(0, 10) > tag || (t.ende.slice(0, 10) === tag && !t.ganztags && t.ende.slice(11, 16) > '00:00' && t.start.slice(0, 10) === tag))).sort((a, b) => Number(b.ganztags) - Number(a.ganztags) || a.start.localeCompare(b.start));
                // Was als Balken steht, kommt nicht noch einmal als Pille; was hinter „+n“ steckt, zählt in „mehr“.
                const heutige = alle.filter(t => !nachId.has(t.id));
                const fr = fristen.filter(f => f.tag === tag); const er = erinnerungen.filter(e => e.tag === tag);
                const auf = aufgaben.filter(a => a.tag === tag);
                const imBalken = sicht.sichtbar.filter(p => p.a <= i && p.b >= i).length;
                const platz = Math.max(0, MAX - imBalken);
                const platzAuf = Math.max(0, platz - heutige.length);
                const rest = Math.max(0, heutige.length - platz) + Math.max(0, auf.length - platzAuf) + sicht.mehr[i];
                return (
                  <div key={tag} onClick={() => onTag(tag)} data-monatstag={tag} role="button" tabIndex={0} className="ui-monat-zelle ui-kein-ziel" aria-label={`${Number(tag.slice(8, 10))}. — ${alle.length + auf.length ? `${alle.length + auf.length} Einträge` : 'frei'}, Tag öffnen`}
                    onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); onTag(tag); } }}
                    onDragOver={e => { if (onAufgabeEinplanen && ziehtAufgabe(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } }}
                    onDrop={e => { const id = aufgabeAusZiehen(e); if (!id || !onAufgabeEinplanen) return; e.preventDefault(); onAufgabeEinplanen(id, tag, aufgaben.find(a => a.id === id)?.zeit ?? null); }}
                    style={{ gridColumn: i + 1, gridRow: '1 / -1', minWidth: 0, minHeight: 'var(--monat-zeile, 92px)', padding: '4px 5px 4px', borderRight: '1px solid rgba(255,255,255,.05)', borderBottom: '1px solid rgba(255,255,255,.05)', background: h ? 'rgba(79,195,247,.04)' : undefined, opacity: imMonat ? 1 : .45, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: 'calc(var(--monat-kopf, 30px) - 4px)', flex: '0 0 auto' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', fontSize: 12.5, fontWeight: 700, background: h ? LEUCHT.puls : 'transparent', color: h ? '#0b0b0c' : C.inkDim }}>{Number(tag.slice(8, 10))}</span>
                      {fr.slice(0, 3).map(f => <span key={f.id} title={`${FRIST_ZEICHEN[f.art].label}: ${f.titel}`} style={{ fontSize: 12, color: FRIST_ZEICHEN[f.art].farbe }}>{FRIST_ZEICHEN[f.art].zeichen}</span>)}
                      {er.length > 0 && <span title={`${er.length} Erinnerungen`} style={{ fontSize: 12, color: LEUCHT.schlaf }}>◷{er.length > 1 ? er.length : ''}</span>}
                    </div>
                    {/* Platz für die Balken dieser Woche (sie liegen über den Zellen). */}
                    {bahnen > 0 && <div aria-hidden style={{ flex: '0 0 auto', height: `calc(${bahnen} * (var(--monat-balken, 20px) + 2px))` }} />}
                    <div className="ui-monat-punkte" aria-hidden>
                      {heutige.slice(0, 4).map(t => <span key={t.id} style={{ width: 7, height: 7, borderRadius: '50%', background: farbe(t) }} />)}
                      {heutige.length < 4 && auf.slice(0, 4 - heutige.length).map(a => <span key={a.id} style={{ width: 7, height: 7, borderRadius: 2, border: `1.5px solid ${ART_FARBE.aufgabe}`, boxSizing: 'border-box' }} />)}
                    </div>
                    <div className="ui-monat-pillen" style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                      {heutige.slice(0, platz).map(t => { const f = farbe(t); return (
                        <button key={t.id} type="button" className="ui-kein-ziel" onClick={e => { e.stopPropagation(); onOeffnen(t); }} title={`${t.titel} · ${t.ganztags ? 'ganztägig' : t.start.slice(11, 16)} · ${t.kalender}`}
                          style={{ display: 'flex', gap: 4, alignItems: 'center', minWidth: 0, textAlign: 'left', border: 'none', borderRadius: 5, padding: '1px 5px', fontSize: 12.5, fontWeight: 600, lineHeight: 1.45, cursor: 'pointer', fontFamily: SCHRIFT.text,
                            background: t.ganztags ? `${f}${BLOCK_HEX}` : 'transparent', color: C.ink }}>
                          {!t.ganztags && <span style={{ width: 7, height: 7, borderRadius: '50%', background: f, flex: '0 0 auto' }} />}
                          {!t.ganztags && <span style={{ color: C.inkDim, fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>{t.start.slice(11, 16)}</span>}
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.titel}</span>
                        </button>
                      ); })}
                      {auf.slice(0, platzAuf).map(a => (
                        <div key={`a:${a.id}`} draggable={!!onAufgabeEinplanen} onDragStart={e => { e.stopPropagation(); aufgabeZiehStart(e, a.id); }} onClick={e => e.stopPropagation()}
                          title={`Aufgabe${a.eltern ? ` (Unteraufgabe von „${a.eltern}“)` : ''}: ${a.title}${a.zeit ? ` · ${a.zeit}` : ''}`}
                          style={{ display: 'flex', gap: 4, alignItems: 'center', minWidth: 0, padding: '1px 5px', fontSize: 12.5, fontWeight: 600, color: C.ink, cursor: onAufgabeEinplanen ? 'grab' : 'default' }}>
                          <button type="button" disabled={!onAufgabeHaken} onClick={() => onAufgabeHaken?.(a.id)} aria-label={`„${a.title}“ als erledigt markieren`}
                            style={{ width: 10, height: 10, borderRadius: 3, border: `1.5px solid ${ART_FARBE.aufgabe}`, background: 'transparent', padding: 0, flex: '0 0 auto', cursor: onAufgabeHaken ? 'pointer' : 'default' }} />
                          <button type="button" onClick={() => onAufgabe?.(a.id)} style={{ all: 'unset', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{a.eltern ? '↳ ' : ''}{a.zeit ? <span style={{ color: C.inkDim, fontWeight: 500 }}>{a.zeit} </span> : ''}{a.title}</button>
                        </div>
                      ))}
                      {rest > 0 && <span style={{ fontSize: 12, color: C.inkDim, paddingLeft: 5, fontWeight: 600 }}>+{rest} mehr</span>}
                    </div>
                  </div>
                );
              })}
              {/* Mehrtägige ganztägige Termine: EIN Balken je Woche (über den Zellen; Klick öffnet den Termin). */}
              {sicht.sichtbar.map(p => {
                const t = nachId.get(p.id); if (!t) return null;
                const f = t.art === 'abwesend' ? LEUCHT.kritisch : farbe(t);
                return (
                  <button key={p.id} type="button" className="ui-kein-ziel ui-monat-balken" data-monat-balken={t.id} onClick={() => onOeffnen(t)} title={`${t.titel} · ${t.start.slice(8, 10)}.${t.start.slice(5, 7)}. – ${ganztagsBis(t).slice(8, 10)}.${ganztagsBis(t).slice(5, 7)}. · ${t.kalender}`}
                    style={{ gridColumn: `${p.a + 1} / ${p.b + 2}`, gridRow: p.bahn + 2, zIndex: 1, margin: `0 ${p.rechtsOffen ? 0 : 4}px 0 ${p.linksOffen ? 0 : 4}px`, minWidth: 0, display: 'flex', alignItems: 'center', gap: 4, padding: '0 6px', border: 'none',
                      borderLeft: p.linksOffen ? 'none' : `3px solid ${f}`, borderRadius: `${p.linksOffen ? 0 : 5}px ${p.rechtsOffen ? 0 : 5}px ${p.rechtsOffen ? 0 : 5}px ${p.linksOffen ? 0 : 5}px`,
                      background: `${f}${BLOCK_HEX}`, color: C.ink, fontSize: 12.5, fontWeight: 600, fontFamily: SCHRIFT.text, textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', cursor: 'pointer' }}>
                    {p.linksOffen && <span aria-hidden style={{ color: C.inkDim }}>‹</span>}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, flex: 1 }}>{t.art === 'abwesend' ? '⊘ ' : ''}{t.titel}</span>
                    {p.rechtsOffen && <span aria-hidden style={{ color: C.inkDim }}>›</span>}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
