'use client';

// ─── MAKE OS — Zeitstrahl ───────────────────────────────────────────────────
// Kevins Blick nach vorn, als Linie — gebaut nach den Mustern der besten
// Timeline-Produkte (Linear-Roadmap, Gantt-Swimlanes):
//   1. Reihen-Stapelung: jedes Element bekommt eine Reihe, in der es garantiert
//      nicht mit dem Nachbarn kollidiert; was über `maxReihen` hinausgeht, wird
//      zu „+n“ gebündelt (Klick zeigt die Liste) — nie überlappend (lib/planung/zeitstrahl.ts `stapeln`).
//   2. Fortschritts-Achse: der verstrichene Teil ist gefüllt, der Rest offen.
//   3. Drei leise Ebenen: Achse+Ticks (Hintergrund), Heute-Anker (Akzent),
//      Pills (Inhalt). Nichts anderes kämpft um Aufmerksamkeit.
// Der Aufrufer liefert Fenster (von/bis), Ticks + Marker; die Höhe wächst mit der Dichte.
// 24.09.: auf das lebendige Muster umgezogen — Zeit leuchtet in LEUCHT.puls.
// 03.10.: Die Jahresplanung zeigt statt dieses Strahls die Lichtfäden (components/os/lichtfaeden — Blättern, Anlegen per
// Klick, Quartale, Markierungen über dem Band wanderten mit dorthin). Hier bleibt der schlichte Strahl für Monat, Quartal,
// Aufgaben und Bauplan.

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FARBE as C, SCHRIFT } from '@/lib/make-one/design';
import { LEUCHT } from './ui';
import { localDay } from '@/lib/zeit';
import { anteilIm, stapeln, tageZwischen } from '@/lib/planung/zeitstrahl';

export interface StrahlMarker {
  date: string;
  label: string;
  farbe: string;
  /** ◇ Meilenstein · ● Aufgaben · ◆ braucht Kevin · ▣ Projekt-Frist · ◎ Ziel-Frist · ✓ erledigt */
  symbol?: string;
  titel?: string;
  href?: string;
  /** Kennung (z. B. die des Meilensteins) — eindeutiger Schlüssel neben dem Datum. */
  id?: string;
  /** Leise zeichnen (erledigt) — Vergangenes ist ohnehin gedämpft. */
  blass?: boolean;
}
export interface StrahlTick {
  date: string;
  label: string;
  /** Jahreszahl unter dem Monat (Jahreswechsel, erster Monat des Fensters). */
  jahr?: string;
  /** Januar: Trennlinie über die ganze Höhe. */
  wechsel?: boolean;
}

const LANE_H = 27;    // Höhe einer Pill-Reihe
const MAX_LANES = 5;  // darüber: gebündelt („+n“)
const FUSS = 46;      // Achse + Ticks + Luft
const ZEIT = LEUCHT.puls;
const ACHSE = 'rgba(255,255,255,.1)';

const tagKurz = (d: string) => `${d.slice(8)}.${d.slice(5, 7)}.${d.slice(0, 4) !== localDay().slice(0, 4) ? d.slice(0, 4) : ''}`;

export interface ZeitstrahlProps {
  von: string;
  bis: string;
  marker: StrahlMarker[];
  ticks: StrahlTick[];
  /** Name für Screenreader. */
  label?: string;
  maxReihen?: number;
}

export function Zeitstrahl({ von, bis, marker, ticks, label = 'Zeitstrahl', maxReihen = MAX_LANES }: ZeitstrahlProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [breite, setBreite] = useState(640);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const mess = () => { const b = el.clientWidth; if (b > 0) setBreite(b); };
    mess();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(mess) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);

  const frak = useCallback((d: string) => Math.max(0, Math.min(1, anteilIm(d, von, bis))), [von, bis]);
  const heute = localDay();
  const heuteDrin = heute >= von && heute <= bis;
  const heuteX = heute < von ? 0 : heute > bis ? 1 : frak(heute);

  // ── Reihen stapeln, Überlauf bündeln (lib/planung/zeitstrahl.ts `stapeln`) ──
  const ms = useMemo(() => marker
    .filter(m => m.date >= von && m.date <= bis && !Number.isNaN(Date.parse(`${m.date}T12:00:00`)))
    .sort((a, b) => a.date.localeCompare(b.date)), [marker, von, bis]);
  const pillB = (m: StrahlMarker) => Math.min(178, 34 + Math.min(m.label.length, 24) * 6);
  const st = stapeln(ms.map(m => ({ x: frak(m.date) * breite, w: pillB(m) })), breite, maxReihen);
  const hatBuendel = st.buendel.length > 0;
  const reihen = Math.max(1, Math.min(maxReihen, st.reihen)) + (hatBuendel ? 1 : 0);
  const achseY = reihen * LANE_H + 12;
  const hoehe = achseY + FUSS - 12;
  const [offen, setOffen] = useState<number | null>(null); // geöffnetes Bündel

  // Ein Bündel schließt bei Klick daneben und mit Esc.
  useEffect(() => {
    if (offen == null) return;
    const zu = (e: Event) => { if (e instanceof KeyboardEvent ? e.key === 'Escape' : !(e.target instanceof HTMLElement && e.target.closest('[data-strahl-eintrag]'))) setOffen(null); };
    window.addEventListener('keydown', zu); window.addEventListener('pointerdown', zu);
    return () => { window.removeEventListener('keydown', zu); window.removeEventListener('pointerdown', zu); };
  }, [offen]);

  return (
    <div style={{ background: 'linear-gradient(165deg, #1A2024 0%, #12171A 100%)', border: 'none', borderRadius: 20, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06), 0 12px 32px rgba(0,0,0,.35)', padding: '16px 18px 6px', marginBottom: 12, minWidth: 0 }}>
      <div ref={boxRef} role="group" aria-label={label} style={{ position: 'relative', height: hoehe, minWidth: 0, overflow: 'hidden' }}>
        {/* Jahreswechsel — Trennlinie über die ganze Höhe */}
        {ticks.filter(tk => tk.wechsel).map(tk => (
          <span key={`w-${tk.date}`} style={{ position: 'absolute', left: (tageZwischen(von, tk.date) / (tageZwischen(von, bis) + 1)) * breite - 0.5, top: 0, width: 1, height: achseY + 8, background: 'rgba(255,255,255,.16)', pointerEvents: 'none' }} />
        ))}

        {/* Heute-Hairline durch den Pill-Raum — leise, hinter allem */}
        {heuteDrin && <div style={{ position: 'absolute', left: heuteX * breite - 0.5, top: 0, width: 1, height: achseY, background: `${ZEIT}2E` }} />}

        {/* Pills — Inhalt-Ebene, unterste Reihe liegt an der Achse */}
        {ms.map((m, i) => {
          const lage = st.lagen[i];
          if (!lage || !('reihe' in lage)) return null;
          const cx = frak(m.date) * breite;
          const top = achseY - 10 - (lage.reihe + 1) * LANE_H;
          const leise = m.date < heute || !!m.blass;
          return (
            <span key={`p-${m.id ?? ''}-${m.date}-${i}`}>
              <StrahlPill m={m} links={lage.links} top={top} w={Math.min(pillB(m), breite)} leise={leise} />
              {/* Faden vom Pill zur Achse + Punkt auf der Achse */}
              <span style={{ position: 'absolute', left: cx - 0.5, top: top + LANE_H - 6, width: 1, height: achseY - (top + LANE_H - 6), background: `${m.farbe}40`, zIndex: 1, pointerEvents: 'none' }} />
              <span style={{ position: 'absolute', left: cx - 3, top: achseY - 3, width: 6, height: 6, borderRadius: '50%', background: m.farbe, boxShadow: leise ? undefined : `0 0 8px ${m.farbe}33`, opacity: leise ? 0.45 : 1, zIndex: 3, pointerEvents: 'none' }} />
            </span>
          );
        })}

        {/* Überlauf: „+n“ je Stelle in einer eigenen Reihe ganz oben — Klick zeigt die Liste */}
        {st.buendel.map((b, k) => {
          const auf = offen === k;
          return (
            <span key={`b-${k}`}>
              <button data-strahl-eintrag type="button" onClick={e => { e.stopPropagation(); setOffen(auf ? null : k); }} aria-expanded={auf}
                aria-label={`${b.idx.length} weitere: ${b.idx.map(i => ms[i].label).join(', ')}`} title={b.idx.map(i => `${ms[i].label} · ${tagKurz(ms[i].date)}`).join('\n')}
                style={{ position: 'absolute', left: b.x - 15, top: 2, minWidth: 30, height: 20, padding: '0 6px', borderRadius: 999, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,.1)', color: C.ink, fontFamily: SCHRIFT.text, fontSize: 11, fontWeight: 700, zIndex: 4 }}>
                +{b.idx.length}
              </button>
              {b.idx.map(i => <span key={`bp-${i}`} style={{ position: 'absolute', left: frak(ms[i].date) * breite - 3, top: achseY - 3, width: 6, height: 6, borderRadius: '50%', background: ms[i].farbe, zIndex: 3, pointerEvents: 'none' }} />)}
              {auf && (
                <div data-strahl-eintrag role="dialog" aria-label={`${b.idx.length} weitere`} onClick={e => e.stopPropagation()}
                  style={{ position: 'absolute', top: 26, left: Math.max(0, Math.min(breite - 240, b.x - 120)), width: 240, maxHeight: 220, overflowY: 'auto', background: C.flaecheHoch, border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, boxShadow: '0 16px 40px -12px rgba(0,0,0,.7)', padding: 6, zIndex: 20, cursor: 'default' }}>
                  {b.idx.map(i => {
                    const m = ms[i];
                    const inhalt = <><span style={{ color: m.farbe, flex: '0 0 auto' }}>{m.symbol ?? '◇'}</span><span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.label}</span><span style={{ color: C.inkLeise, fontVariantNumeric: 'tabular-nums', flex: '0 0 auto' }}>{tagKurz(m.date)}</span></>;
                    const stil = { display: 'flex', gap: 8, alignItems: 'center', width: '100%', padding: '7px 8px', borderRadius: 8, background: 'transparent', border: 'none', color: C.ink, fontFamily: SCHRIFT.text, fontSize: 12, textAlign: 'left' as const, textDecoration: 'none' };
                    return m.href
                      ? <Link key={i} href={m.href} title={m.titel ?? m.label} style={stil}>{inhalt}</Link>
                      : <span key={i} title={m.titel ?? m.label} style={stil}>{inhalt}</span>;
                  })}
                </div>
              )}
            </span>
          );
        })}

        {!ms.length && (
          <div style={{ position: 'absolute', left: 0, right: 0, top: achseY - 30, textAlign: 'center', fontSize: 12, color: C.inkLeise, pointerEvents: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Nichts terminiert in diesem Zeitraum.
          </div>
        )}

        {/* Achse: verstrichene Zeit gefüllt, Rest offen — der Zeitraum als Fortschritt */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: achseY - 1, height: 2, background: ACHSE, borderRadius: 1 }} />
        <div style={{ position: 'absolute', left: 0, top: achseY - 1, width: `${heuteX * 100}%`, height: 2, background: `linear-gradient(90deg, ${ZEIT}22, ${ZEIT}99)`, borderRadius: 1, boxShadow: `0 0 10px ${ZEIT}33` }} />

        {/* Heute-Anker */}
        {heuteDrin && (
          <>
            <div className="zeit-puls" style={{ position: 'absolute', left: heuteX * breite - 4.5, top: achseY - 4.5, width: 9, height: 9, borderRadius: '50%', background: ZEIT, boxShadow: `0 0 12px ${ZEIT}33`, zIndex: 4 }} />
            <div style={{ position: 'absolute', left: heuteX * breite, top: achseY + 9, transform: 'translateX(-50%)', fontFamily: SCHRIFT.text, fontSize: 11, fontWeight: 700, letterSpacing: '.12em', color: ZEIT, whiteSpace: 'nowrap' }}>HEUTE</div>
          </>
        )}

        {/* Ticks — Hintergrund-Ebene; weichen dem HEUTE-Label aus. Jahreszahl am Jahreswechsel (und am Anfang). */}
        {ticks.filter(tk => { if (!heuteDrin) return true; const x = frak(tk.date) * breite, d = Math.abs(x - heuteX * breite); /* am Rand bündig gesetzte Monate ragen weiter zur Mitte */ return d > (x < 16 || x > breite - 16 ? 56 : 28); }).map(tk => {
          // Am Rand nicht abschneiden: der erste Monat steht links bündig, der letzte rechts bündig.
          const x = frak(tk.date) * breite;
          const rand = x < 16 ? 'translateX(0)' : x > breite - 16 ? 'translateX(-100%)' : 'translateX(-50%)';
          return (
          <div key={tk.date} style={{ position: 'absolute', left: x, top: achseY + 3, transform: rand, textAlign: x < 16 ? 'left' : x > breite - 16 ? 'right' : 'center', pointerEvents: 'none' }}>
            <div style={{ width: 1, height: 6, background: tk.wechsel ? 'rgba(255,255,255,.3)' : ACHSE, margin: x < 16 ? 0 : x > breite - 16 ? '0 0 0 auto' : '0 auto' }} />
            <div style={{ fontFamily: SCHRIFT.display, fontSize: 11, color: C.inkLeise, marginTop: 3, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{tk.label}</div>
            {tk.jahr && <div style={{ fontFamily: SCHRIFT.display, fontSize: 11, fontWeight: 800, color: tk.wechsel ? C.ink : C.inkDim, marginTop: 1, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{tk.jahr}</div>}
          </div>
          );
        })}
      </div>
    </div>
  );
}

/** Eine Pill: Link (href) oder nur Anzeige — immer mit vollem Titel als Tooltip. */
function StrahlPill({ m, links, top, w, leise }: { m: StrahlMarker; links: number; top: number; w: number; leise: boolean }) {
  const inhalt = (
    <>
      <span style={{ color: m.farbe, fontSize: 11, flex: '0 0 auto' }}>{m.symbol ?? '◇'}</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.label}</span>
    </>
  );
  const stil = {
    position: 'absolute' as const, left: links, top, maxWidth: w,
    display: 'flex', alignItems: 'center', gap: 5, padding: '3px 9px 3px 8px',
    background: `${m.farbe}22`, border: 'none', borderRadius: 999,
    fontFamily: SCHRIFT.text, fontSize: 11, fontWeight: 600, color: C.ink, lineHeight: 1.35,
    opacity: leise ? 0.45 : 1, zIndex: 2, textDecoration: m.blass ? 'line-through' as const : 'none' as const, cursor: m.href ? 'pointer' : 'default',
  };
  const titel = m.titel ?? `${m.label} · ${tagKurz(m.date)}`;
  if (m.href) return <Link data-strahl-eintrag className="zeit-pill" href={m.href} title={titel} style={stil}>{inhalt}</Link>;
  return <span data-strahl-eintrag className="zeit-pill" title={titel} style={stil}>{inhalt}</span>;
}
