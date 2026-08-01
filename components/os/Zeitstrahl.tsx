'use client';

// ─── MAKE OS — Zeitstrahl ───────────────────────────────────────────────────
// Kevins Blick nach vorn, als Linie — gebaut nach den Mustern der besten
// Timeline-Produkte (Linear-Roadmap, Gantt-Swimlanes):
//   1. Lane-Stapelung: jedes Element bekommt eine Reihe, in der es garantiert
//      nicht mit dem Nachbarn kollidiert — keine abgeschnittenen Labels mehr.
//   2. Fortschritts-Achse: der verstrichene Teil des Zeitraums ist gefüllt,
//      der Rest offen — man sieht ohne Lesen, wo im Zeitraum man steht.
//   3. Drei leise Ebenen: Achse+Ticks (Hintergrund), Heute-Anker (Akzent),
//      Pills (Inhalt). Nichts anderes kämpft um Aufmerksamkeit.
// Der Aufrufer liefert Ticks + Marker; die Höhe wächst mit der Dichte.

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { THEME as T } from '@/lib/make-one/os-data';
import { localDay } from '@/lib/zeit';

export interface StrahlMarker {
  date: string;
  label: string;
  farbe: string;
  /** ◇ Meilenstein · ● Aufgaben · ◆ braucht Kevin */
  symbol?: string;
  titel?: string;
  href?: string;
}
export interface StrahlTick { date: string; label: string }

const LANE_H = 27;    // Höhe einer Pill-Reihe
const MAX_LANES = 5;  // darüber: nur noch Punkt auf der Achse
const FUSS = 46;      // Achse + Ticks + Luft

export function Zeitstrahl({ von, bis, marker, ticks }: { von: string; bis: string; marker: StrahlMarker[]; ticks: StrahlTick[] }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [breite, setBreite] = useState(640);
  useEffect(() => {
    const mess = () => { if (boxRef.current) setBreite(boxRef.current.clientWidth); };
    mess();
    window.addEventListener('resize', mess);
    return () => window.removeEventListener('resize', mess);
  }, []);

  const t0 = Date.parse(`${von}T00:00:00`);
  const t1 = Date.parse(`${bis}T23:59:59`);
  const frak = (d: string) => Math.max(0, Math.min(1, (Date.parse(`${d}T12:00:00`) - t0) / (t1 - t0)));
  const heute = localDay();
  const heuteX = heute < von ? 0 : heute > bis ? 1 : frak(heute);
  const heuteDrin = heute >= von && heute <= bis;

  const sichtbar = marker
    .filter(m => m.date >= von && m.date <= bis && !Number.isNaN(Date.parse(`${m.date}T12:00:00`)))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Lane-Stapelung (wie Linear/Gantt): Pill-Breite schätzen, unterste freie
  // Reihe nehmen. Reihen über MAX_LANES degradieren zum Punkt auf der Achse.
  const pillB = (m: StrahlMarker) => Math.min(178, 34 + Math.min(m.label.length, 24) * 6);
  const laneEnde: number[] = [];
  const pills = sichtbar.map(m => {
    const cx = frak(m.date) * breite;
    const w = pillB(m);
    const links = Math.max(0, Math.min(breite - w, cx - w / 2));
    let lane = laneEnde.findIndex(ende => links >= ende + 10);
    if (lane === -1) lane = laneEnde.length;
    const kompakt = lane >= MAX_LANES;
    if (!kompakt) laneEnde[lane] = Math.max(laneEnde[lane] ?? 0, links + w);
    return { m, cx, links, w, lane, kompakt };
  });
  const anzLanes = Math.max(1, Math.min(MAX_LANES, laneEnde.length));
  const achseY = anzLanes * LANE_H + 12;
  const hoehe = achseY + FUSS - 12;

  return (
    <div style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14, padding: '16px 18px 6px', marginBottom: 12 }}>
      <div ref={boxRef} style={{ position: 'relative', height: hoehe }}>

        {/* Heute-Hairline durch den Pill-Raum — leise, hinter allem */}
        {heuteDrin && (
          <div style={{ position: 'absolute', left: heuteX * breite - 0.5, top: 0, width: 1, height: achseY, background: `${T.accent}2E` }} />
        )}

        {/* Pills — Inhalt-Ebene, unterste Lane liegt an der Achse */}
        {pills.filter(p => !p.kompakt).map((p, i) => {
          const vergangen = p.m.date < heute;
          const top = achseY - 10 - (p.lane + 1) * LANE_H;
          const inhalt = (
            <>
              <span style={{ color: p.m.farbe, fontSize: 9, flex: '0 0 auto' }}>{p.m.symbol ?? '◇'}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.m.label}</span>
            </>
          );
          const stil = {
            position: 'absolute' as const, left: p.links, top, maxWidth: p.w,
            display: 'flex', alignItems: 'center', gap: 5, padding: '3px 9px 3px 8px',
            background: T.panel2, border: `1px solid ${p.m.farbe}4D`, borderRadius: 999,
            fontSize: 11, fontWeight: 600, color: T.ink, lineHeight: 1.35,
            opacity: vergangen ? 0.45 : 1, zIndex: 2, textDecoration: 'none' as const,
          };
          const titel = p.m.titel ?? `${p.m.label} · ${p.m.date.slice(8)}.${p.m.date.slice(5, 7)}.`;
          return (
            <span key={`p-${i}`}>
              {p.m.href
                ? <Link className="zeit-pill" href={p.m.href} title={titel} style={stil}>{inhalt}</Link>
                : <span className="zeit-pill" title={titel} style={stil}>{inhalt}</span>}
              {/* Faden vom Pill zur Achse + Punkt auf der Achse */}
              <span style={{ position: 'absolute', left: p.cx - 0.5, top: top + LANE_H - 6, width: 1, height: achseY - (top + LANE_H - 6), background: `${p.m.farbe}40`, zIndex: 1 }} />
              <span style={{ position: 'absolute', left: p.cx - 3, top: achseY - 3, width: 6, height: 6, borderRadius: '50%', background: p.m.farbe, opacity: vergangen ? 0.45 : 1, zIndex: 3 }} />
            </span>
          );
        })}

        {/* Überlauf jenseits der Lanes: nur der Punkt, Details im Hover-Titel */}
        {pills.filter(p => p.kompakt).map((p, i) => (
          <span key={`k-${i}`} title={p.m.titel ?? `${p.m.label} · ${p.m.date.slice(8)}.${p.m.date.slice(5, 7)}.`}
            style={{ position: 'absolute', left: p.cx - 3, top: achseY - 3, width: 6, height: 6, borderRadius: '50%', background: p.m.farbe, zIndex: 3 }} />
        ))}

        {!sichtbar.length && (
          <div style={{ position: 'absolute', left: 0, right: 0, top: achseY - 34, textAlign: 'center', fontSize: 12, color: T.muted }}>
            Nichts terminiert in diesem Zeitraum.
          </div>
        )}

        {/* Achse: verstrichene Zeit gefüllt, Rest offen — der Zeitraum als Fortschritt */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: achseY - 1, height: 2, background: T.line, borderRadius: 1 }} />
        <div style={{ position: 'absolute', left: 0, top: achseY - 1, width: `${heuteX * 100}%`, height: 2, background: `linear-gradient(90deg, ${T.accent}22, ${T.accent}99)`, borderRadius: 1 }} />

        {/* Heute-Anker */}
        {heuteDrin && (
          <>
            <div className="zeit-puls" style={{ position: 'absolute', left: heuteX * breite - 4.5, top: achseY - 4.5, width: 9, height: 9, borderRadius: '50%', background: T.accent, zIndex: 4 }} />
            <div style={{ position: 'absolute', left: heuteX * breite, top: achseY + 9, transform: 'translateX(-50%)', fontFamily: T.mono, fontSize: 8.5, letterSpacing: '.12em', color: T.accent, whiteSpace: 'nowrap' }}>HEUTE</div>
          </>
        )}

        {/* Ticks — Hintergrund-Ebene; weichen dem HEUTE-Label aus */}
        {ticks.filter(tk => !heuteDrin || Math.abs(frak(tk.date) - heuteX) * breite > 28).map(tk => (
          <div key={tk.date} style={{ position: 'absolute', left: `${frak(tk.date) * 100}%`, top: achseY + 3, transform: 'translateX(-50%)', textAlign: 'center' }}>
            <div style={{ width: 1, height: 6, background: T.line, margin: '0 auto' }} />
            <div style={{ fontFamily: T.mono, fontSize: 9, color: T.muted, marginTop: 3, whiteSpace: 'nowrap' }}>{tk.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
