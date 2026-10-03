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
//
// 30.09. (Kevin: „bis Ende nächsten Jahres planen“, „einzeln nach vorne und hinten scrollen“) — für die
// Jahresplanung, alles optional (ohne die neuen Props bleibt der Strahl wie bisher, z. B. Aufgaben, Bauplan):
//   · `onBlaettern(n)`: Pfeile ‹ › (Umschalt = Quartal), Tasten ← →, Umschalt+Mausrad / Trackpad waagerecht,
//     Ziehen bzw. Wischen am Handy. Das Fenster selbst hält der Aufrufer (planung/useStrahlFenster.ts).
//   · `onTag(tag)`: Klick in die Fläche → der Tag an dieser Stelle (Anlegen am Zeitstrahl); Maus zeigt die Stelle.
//   · `onMarker(m)`: Klick auf einen Marker ohne `href` (Meilenstein öffnen — EINE Stelle beim Aufrufer).
//   · `baender`: Quartale — leise Streifen über die ganze Höhe, Name unter der Achse.
//   · Ticks mit `jahr`/`wechsel`: Jahreswechsel als Trennlinie mit Jahreszahl.
//
// 03.10. (Kevin: „hier bei der Planung wäre geil, wenn das so reinkommt mit mehreren Elektro-Fäden“) — `licht`:
//   Statt der Achse ein Band aus Lichtfäden (je Ziel ein Bündel in seiner Farbe, Dichte je Woche aus echten Daten —
//   lib/lichtfaeden/dichte.ts, Zeichner lib/lichtfaeden/zeitband.ts über planung/LichtBand.tsx). Die Markierungen
//   schweben als echte Knöpfe darüber (Raute/Quadrat + Titel, Glas), eine feine Linie verbindet sie mit ihrem Bündel;
//   Hover/Fokus hebt das Bündel hervor, die anderen dimmen. Leinwand `aria-hidden`, Textäquivalent `licht.text`.

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { FARBE as C, SCHRIFT } from '@/lib/make-one/design';
import { LEUCHT } from './schlank';
import { localDay } from '@/lib/zeit';
import { anteilIm, stapeln, tagBeiAnteil, tageZwischen } from '@/lib/planung/zeitstrahl';
import { LICHT_GLAS } from '@/lib/make-one/design';
import { zeitbandMasse, type ZeitbandVerbinder } from '@/lib/lichtfaeden/zeitband';
import { OHNE_ZIEL } from '@/lib/lichtfaeden/dichte';
import { LichtBand } from './planung/LichtBand';

export interface StrahlMarker {
  date: string;
  label: string;
  farbe: string;
  /** ◇ Meilenstein · ● Aufgaben · ◆ braucht Kevin · ▣ Projekt-Frist · ◎ Ziel-Frist · ✓ erledigt */
  symbol?: string;
  titel?: string;
  href?: string;
  /** Kennung für `onMarker` (z. B. die des Meilensteins). */
  id?: string;
  /** Leise zeichnen (erledigt) — Vergangenes ist ohnehin gedämpft. */
  blass?: boolean;
  /** Lichtfäden: das Bündel (Ziel-Kennung oder „ohne“), an dem die Markierung hängt. */
  buendel?: string;
}
/** Lichtfäden statt der Achse (03.10.): je Ziel ein Bündel mit Dichte je Woche über das ganze Fenster. */
export interface StrahlLicht {
  buendel: { id: string; farbe: string; titel: string; dichte: readonly number[] }[];
  /** Textäquivalent für Vorleser (lib/lichtfaeden/dichte.ts `lichtText`). */
  text: string;
}
export interface StrahlTick {
  date: string;
  label: string;
  /** Jahreszahl unter dem Monat (Jahreswechsel, erster Monat des Fensters). */
  jahr?: string;
  /** Januar: Trennlinie über die ganze Höhe. */
  wechsel?: boolean;
}
export interface StrahlBand { von: string; bis: string; label: string }

const LANE_H = 27;    // Höhe einer Pill-Reihe
const MAX_LANES = 5;  // darüber: gebündelt („+n“)
const FUSS = 46;      // Achse + Ticks + Luft
const QUARTAL_H = 24; // Zeile mit den Quartalsnamen unter Monaten und Jahreszahlen
const ZEIT = LEUCHT.puls;
const ACHSE = 'rgba(255,255,255,.1)';

const tagKurz = (d: string) => `${d.slice(8)}.${d.slice(5, 7)}.${d.slice(0, 4) !== localDay().slice(0, 4) ? d.slice(0, 4) : ''}`;

export interface ZeitstrahlProps {
  von: string;
  bis: string;
  marker: StrahlMarker[];
  ticks: StrahlTick[];
  baender?: StrahlBand[];
  onMarker?: (m: StrahlMarker) => void;
  onTag?: (tag: string) => void;
  onBlaettern?: (monate: number) => void;
  onBreite?: (px: number) => void;
  /** Steuerung über dem Strahl (Zeitraum-Wahl, „Heute“, „+ Meilenstein“) — in derselben Karte. */
  kopf?: ReactNode;
  /** Name für Screenreader. */
  label?: string;
  maxReihen?: number;
  /** Lichtfäden-Band statt der Achse (Jahresplanung). */
  licht?: StrahlLicht;
}

export function Zeitstrahl({ von, bis, marker, ticks, baender, onMarker, onTag, onBlaettern, onBreite, kopf, label = 'Zeitstrahl', maxReihen = MAX_LANES, licht }: ZeitstrahlProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [breite, setBreite] = useState(640);
  const breiteMelden = useRef(onBreite); breiteMelden.current = onBreite;
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const mess = () => { const b = el.clientWidth; if (b > 0) { setBreite(b); breiteMelden.current?.(b); } };
    mess();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(mess) : null;
    ro?.observe(el);
    window.addEventListener('resize', mess);
    return () => { ro?.disconnect(); window.removeEventListener('resize', mess); };
  }, []);

  const frak = useCallback((d: string) => Math.max(0, Math.min(1, anteilIm(d, von, bis))), [von, bis]);
  const heute = localDay();
  const heuteDrin = heute >= von && heute <= bis;
  const heuteX = heute < von ? 0 : heute > bis ? 1 : frak(heute);
  const monatBreite = breite / Math.max(1, (tageZwischen(von, bis) + 1) / 30.44);

  // ── Reihen stapeln, Überlauf bündeln (lib/planung/zeitstrahl.ts `stapeln`) ──
  const ms = useMemo(() => marker
    .filter(m => m.date >= von && m.date <= bis && !Number.isNaN(Date.parse(`${m.date}T12:00:00`)))
    .sort((a, b) => a.date.localeCompare(b.date)), [marker, von, bis]);
  const pillB = (m: StrahlMarker) => Math.min(178, 34 + Math.min(m.label.length, 24) * 6);
  const masse = licht ? zeitbandMasse(breite) : null;
  const laneH = masse ? masse.reihe : LANE_H;
  const maxR = masse ? Math.min(maxReihen, masse.maxReihen) : maxReihen;
  const st = stapeln(ms.map(m => ({ x: frak(m.date) * breite, w: pillB(m) })), breite, maxR);
  const hatBuendel = st.buendel.length > 0;
  const reihen = Math.max(1, Math.min(maxR, st.reihen)) + (hatBuendel ? 1 : 0);
  // Lichtfäden: Markierungen oben, darunter das Band, darunter die Achse. Sonst: Markierungen direkt auf der Achse.
  const bandOben = reihen * laneH + 12;
  const achseY = masse ? bandOben + masse.band : reihen * LANE_H + 12;
  const bandMitte = masse ? bandOben + masse.band / 2 : achseY;
  const [hervor, setHervor] = useState<string | null>(null);
  /** Oberkante des Knopfs einer Markierung in Reihe r (0 = am Band) und Unterkante ihres Chips (Ansatz des Verbinders). */
  const lichtTop = (r: number) => (masse ? bandOben - 4 - (r + 1) * laneH + (laneH - masse.knopf) / 2 : 0);
  const chipUnten = (r: number) => (masse ? lichtTop(r) + masse.knopf / 2 + masse.chip / 2 : 0);
  const hatQuartale = !!baender?.length;
  const hoehe = achseY + FUSS - 12 + (hatQuartale ? QUARTAL_H + 6 : 0); // +6: die Quartalsnamen nicht unten abschneiden

  // ── Blättern: Ziehen/Wischen, Mausrad, Tasten ──
  const [zug, setZug] = useState(0);
  const drag = useRef<{ x: number; y: number; id: number; aktiv: boolean } | null>(null);
  const gezogen = useRef(false);
  const blaettern = useRef(onBlaettern); blaettern.current = onBlaettern;
  const rad = useRef(0);
  useEffect(() => {
    const el = boxRef.current;
    if (!el || !onBlaettern) return;
    const aufRad = (e: WheelEvent) => {
      const dx = e.shiftKey && Math.abs(e.deltaX) < Math.abs(e.deltaY) ? e.deltaY : e.deltaX;
      if (!e.shiftKey && Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return; // senkrecht = Seite rollen
      e.preventDefault();
      rad.current += dx;
      const schritt = Math.max(40, monatBreite * 0.6);
      const n = Math.trunc(rad.current / schritt);
      if (n) { rad.current -= n * schritt; blaettern.current?.(n); }
    };
    el.addEventListener('wheel', aufRad, { passive: false });
    return () => el.removeEventListener('wheel', aufRad);
  }, [onBlaettern, monatBreite]);

  const [zeiger, setZeiger] = useState<number | null>(null); // Maus-Stelle für „+ anlegen“
  const [offen, setOffen] = useState<number | null>(null); // geöffnetes Bündel

  // Lichtfäden: Verbinder Markierung → Bündel (gebündelte „+n“ nur als Punkt auf dem Bündel).
  const verbinder: ZeitbandVerbinder[] = [];
  if (masse) {
    ms.forEach((m, i) => {
      const lage = st.lagen[i];
      if (!lage) return;
      const x = frak(m.date) * breite;
      verbinder.push({ x, yOben: 'reihe' in lage ? chipUnten(lage.reihe) : null, buendel: m.buendel ?? OHNE_ZIEL, farbe: m.farbe, leise: m.date < heute || !!m.blass });
    });
  }
  const heuteSeite: 'links' | 'rechts' = heute < von ? 'links' : 'rechts';

  const xAus = (clientX: number) => { const r = boxRef.current?.getBoundingClientRect(); return r ? Math.max(0, Math.min(r.width, clientX - r.left)) : 0; };

  const flaeche = (
    <div ref={boxRef} role="group" aria-label={label} tabIndex={onBlaettern ? 0 : undefined}
      onKeyDown={onBlaettern ? e => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); onBlaettern((e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 3 : 1)); }
      } : undefined}
      onPointerDown={onBlaettern ? e => { if (e.button !== 0) return; drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId, aktiv: false }; gezogen.current = false; } : undefined}
      onPointerMove={e => {
        const d = drag.current;
        if (d && d.id === e.pointerId) {
          const dx = e.clientX - d.x, dy = e.clientY - d.y;
          if (!d.aktiv && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) { d.aktiv = true; try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* egal */ } }
          if (d.aktiv) { gezogen.current = true; setZug(dx); setZeiger(null); return; }
        }
        if (onTag && e.pointerType === 'mouse') setZeiger(e.target instanceof Element && e.target.closest('[data-strahl-eintrag]') ? null : xAus(e.clientX));
      }}
      onPointerUp={e => {
        const d = drag.current; drag.current = null;
        if (d?.aktiv) { const n = Math.round(-(e.clientX - d.x) / Math.max(1, monatBreite)); setZug(0); if (n) blaettern.current?.(n); }
      }}
      onPointerCancel={() => { drag.current = null; setZug(0); }}
      onPointerLeave={() => setZeiger(null)}
      onClickCapture={e => { if (gezogen.current) { e.preventDefault(); e.stopPropagation(); gezogen.current = false; } }}
      onClick={onTag ? e => { if (e.target instanceof HTMLElement && e.target.closest('[data-strahl-eintrag]')) return; onTag(tagBeiAnteil(von, bis, xAus(e.clientX) / Math.max(1, breite))); } : undefined}
      style={{ position: 'relative', height: hoehe, flex: '1 1 auto', minWidth: 0, overflow: 'hidden', touchAction: onBlaettern ? 'pan-y' : undefined, cursor: onTag ? 'copy' : undefined, outline: 'none', userSelect: zug ? 'none' : undefined }}>
      <div style={{ position: 'absolute', inset: 0, transform: zug ? `translateX(${zug}px)` : undefined, transition: zug ? 'none' : 'transform .18s ease' }}>
        {licht && masse && (
          <LichtBand daten={{
            breite, hoehe, bandOben, bandHoehe: masse.band, buendel: licht.buendel, heuteX: heuteDrin ? heuteX * breite : null, heuteSeite,
            heuteFarbe: ZEIT, verbinder, hervor, handy: breite < 520,
          }} />
        )}

        {/* Quartale — leise Streifen über die ganze Höhe, der Name unter den Monaten */}
        {baender?.map((b, i) => {
          const l = frak(b.von) * breite, r = frak(b.bis) * breite;
          const t0 = (tageZwischen(von, b.von) / (tageZwischen(von, bis) + 1)) * breite;
          const t1 = ((tageZwischen(von, b.bis) + 1) / (tageZwischen(von, bis) + 1)) * breite;
          return (
            <span key={`q-${b.von}`}>
              {i % 2 === 1 && <span style={{ position: 'absolute', left: t0, width: Math.max(0, t1 - t0), top: 0, height: achseY, background: 'rgba(255,255,255,.018)' }} />}
              {r - l > 24 && <span style={{ position: 'absolute', left: (l + r) / 2, top: achseY + FUSS + 2, transform: 'translateX(-50%)', fontFamily: SCHRIFT.text, fontSize: 11, fontWeight: 600, letterSpacing: '.06em', color: 'rgba(255,255,255,.28)', whiteSpace: 'nowrap', pointerEvents: 'none' }}>{b.label}</span>}
            </span>
          );
        })}

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
          if (masse) {
            const b = m.buendel ?? OHNE_ZIEL;
            return <LichtMarke key={`p-${m.id ?? ''}-${m.date}-${i}`} m={m} links={lage.links} top={lichtTop(lage.reihe)} w={Math.min(pillB(m), breite)} hoehe={masse.knopf} chip={masse.chip}
              leise={leise} gedimmt={hervor != null && hervor !== b} onMarker={onMarker} onHervor={an => setHervor(an ? b : null)} />;
          }
          return (
            <span key={`p-${m.id ?? ''}-${m.date}-${i}`}>
              <StrahlPill m={m} links={lage.links} top={top} w={Math.min(pillB(m), breite)} leise={leise} onMarker={onMarker} />
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
                style={masse
                  ? { position: 'absolute', left: b.x - masse.knopf / 2, top: 2, minWidth: masse.knopf, height: masse.knopf, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', zIndex: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }
                  : { position: 'absolute', left: b.x - 15, top: 2, minWidth: 30, height: 20, padding: '0 6px', borderRadius: 999, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,.1)', color: C.ink, fontFamily: SCHRIFT.text, fontSize: 11, fontWeight: 700, zIndex: 4 }}>
                {masse
                  ? <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 30, height: masse.chip - 4, padding: '0 8px', borderRadius: 999, background: LICHT_GLAS.flaeche, border: `1px solid ${LICHT_GLAS.achse}`, color: C.ink, fontFamily: SCHRIFT.text, fontSize: 12, fontWeight: 700 }}>+{b.idx.length}</span>
                  : <>+{b.idx.length}</>}
              </button>
              {!masse && b.idx.map(i => <span key={`bp-${i}`} style={{ position: 'absolute', left: frak(ms[i].date) * breite - 3, top: achseY - 3, width: 6, height: 6, borderRadius: '50%', background: ms[i].farbe, zIndex: 3, pointerEvents: 'none' }} />)}
              {auf && (
                <div data-strahl-eintrag role="dialog" aria-label={`${b.idx.length} weitere`} onClick={e => e.stopPropagation()}
                  style={{ position: 'absolute', top: masse ? masse.knopf + 6 : 26, left: Math.max(0, Math.min(breite - 240, b.x - 120)), width: 240, maxHeight: 220, overflowY: 'auto', background: C.flaecheHoch, border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, boxShadow: '0 16px 40px -12px rgba(0,0,0,.7)', padding: 6, zIndex: 20, cursor: 'default' }}>
                  {b.idx.map(i => {
                    const m = ms[i];
                    const inhalt = <><span style={{ color: m.farbe, flex: '0 0 auto' }}>{m.symbol ?? '◇'}</span><span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.label}</span><span style={{ color: C.inkLeise, fontVariantNumeric: 'tabular-nums', flex: '0 0 auto' }}>{tagKurz(m.date)}</span></>;
                    const stil = { display: 'flex', gap: 8, alignItems: 'center', width: '100%', padding: '7px 8px', borderRadius: 8, background: 'transparent', border: 'none', color: C.ink, fontFamily: SCHRIFT.text, fontSize: 12, textAlign: 'left' as const, cursor: 'pointer', textDecoration: 'none' };
                    return m.href
                      ? <Link key={i} href={m.href} title={m.titel ?? m.label} style={stil}>{inhalt}</Link>
                      : <button key={i} type="button" title={m.titel ?? m.label} onClick={() => { setOffen(null); onMarker?.(m); }} disabled={!onMarker} style={stil}>{inhalt}</button>;
                  })}
                </div>
              )}
            </span>
          );
        })}

        {!ms.length && (
          <div style={{ position: 'absolute', left: 0, right: 0, top: masse ? Math.max(0, bandOben - 30) : achseY - 30, textAlign: 'center', fontSize: 12, color: C.inkLeise, pointerEvents: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {onTag ? (breite < 480 ? 'Nichts terminiert — Klick legt an.' : 'Nichts terminiert in diesem Zeitraum — Klick auf eine Stelle legt einen Meilenstein an.') : 'Nichts terminiert in diesem Zeitraum.'}
          </div>
        )}

        {/* Achse: verstrichene Zeit gefüllt, Rest offen — der Zeitraum als Fortschritt (Lichtfäden: nur eine Haarlinie) */}
        {masse ? (
          <div style={{ position: 'absolute', left: 0, right: 0, top: achseY, height: 1, background: LICHT_GLAS.achse }} />
        ) : (
          <>
            <div style={{ position: 'absolute', left: 0, right: 0, top: achseY - 1, height: 2, background: ACHSE, borderRadius: 1 }} />
            <div style={{ position: 'absolute', left: 0, top: achseY - 1, width: `${heuteX * 100}%`, height: 2, background: `linear-gradient(90deg, ${ZEIT}22, ${ZEIT}99)`, borderRadius: 1, boxShadow: `0 0 10px ${ZEIT}33` }} />
          </>
        )}

        {/* Heute-Anker (Lichtfäden: auf der Mittellinie des Bands) */}
        {heuteDrin && (
          <>
            <div className="zeit-puls" style={{ position: 'absolute', left: heuteX * breite - 4.5, top: bandMitte - 4.5, width: 9, height: 9, borderRadius: '50%', background: ZEIT, boxShadow: `0 0 12px ${ZEIT}33`, zIndex: 4 }} />
            <div style={{ position: 'absolute', left: heuteX * breite, top: achseY + 9, transform: 'translateX(-50%)', fontFamily: SCHRIFT.text, fontSize: 11, fontWeight: 700, letterSpacing: '.12em', color: ZEIT, whiteSpace: 'nowrap' }}>HEUTE</div>
          </>
        )}

        {/* Ticks — Hintergrund-Ebene; weichen dem HEUTE-Label aus. Jahreszahl am Jahreswechsel (und am Anfang). */}
        {ticks.filter(tk => !heuteDrin || Math.abs(frak(tk.date) - heuteX) * breite > 28).map(tk => {
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

        {/* Wo ein Klick anlegen würde (nur Maus) */}
        {onTag && zeiger != null && !zug && (
          <>
            <span style={{ position: 'absolute', left: zeiger - 0.5, top: 0, width: 1, height: achseY, background: `${C.aktiv}55`, pointerEvents: 'none' }} />
            <span style={{ position: 'absolute', left: Math.max(0, Math.min(breite - 90, zeiger - 45)), top: 0, width: 90, textAlign: 'center', fontFamily: SCHRIFT.text, fontSize: 11, fontWeight: 700, color: C.aktiv, pointerEvents: 'none' }}>+ {tagKurz(tagBeiAnteil(von, bis, zeiger / Math.max(1, breite)))}</span>
          </>
        )}
      </div>
    </div>
  );

  // Ein Bündel schließt bei Klick daneben und mit Esc.
  useEffect(() => {
    if (!offen) return;
    const zu = (e: Event) => { if (e instanceof KeyboardEvent ? e.key === 'Escape' : !(e.target instanceof HTMLElement && e.target.closest('[data-strahl-eintrag]'))) setOffen(null); };
    window.addEventListener('keydown', zu); window.addEventListener('pointerdown', zu);
    return () => { window.removeEventListener('keydown', zu); window.removeEventListener('pointerdown', zu); };
  }, [offen]);

  const pfeil = (richtung: -1 | 1) => (
    <button type="button" onClick={e => onBlaettern?.(richtung * (e.shiftKey ? 3 : 1))} className="fassbar"
      aria-label={richtung < 0 ? 'Einen Monat zurück (Umschalt: ein Quartal)' : 'Einen Monat vor (Umschalt: ein Quartal)'} title={richtung < 0 ? 'Einen Monat zurück — Umschalt: ein Quartal · Tasten ← →' : 'Einen Monat vor — Umschalt: ein Quartal · Tasten ← →'}
      style={{ flex: '0 0 auto', alignSelf: 'center', width: 28, height: 44, borderRadius: 10, border: 'none', background: 'rgba(255,255,255,.05)', color: C.inkDim, fontSize: 18, cursor: 'pointer', margin: richtung < 0 ? '0 8px 0 -6px' : '0 -6px 0 8px' }}>{richtung < 0 ? '‹' : '›'}</button>
  );

  return (
    <div style={{ background: licht ? LICHT_GLAS.karte : 'linear-gradient(165deg, #1A2024 0%, #12171A 100%)', border: 'none', borderRadius: 20, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06), 0 12px 32px rgba(0,0,0,.35)', padding: '16px 18px 6px', marginBottom: 12, minWidth: 0 }}>
      {kopf && <div style={{ marginBottom: 12 }}>{kopf}</div>}
      <div style={{ display: 'flex', alignItems: 'stretch', minWidth: 0 }}>
        {onBlaettern && pfeil(-1)}
        {flaeche}
        {onBlaettern && pfeil(1)}
      </div>
      {licht && (
        <>
          {/* Legende: je Bündel Farbe + Ziel — Zeigen hebt das Bündel hervor (für Vorleser steht der Text darunter) */}
          <div aria-hidden="true" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', padding: onBlaettern ? '4px 30px 10px' : '4px 0 10px' }}>
            {licht.buendel.map(b => (
              <span key={b.id} onMouseEnter={() => setHervor(b.id)} onMouseLeave={() => setHervor(null)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: SCHRIFT.text, fontSize: 12, fontWeight: 600, color: hervor == null || hervor === b.id ? C.inkDim : C.inkLeise, cursor: 'default', maxWidth: 260, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <span style={{ flex: '0 0 auto', width: 14, height: 2, borderRadius: 2, background: b.farbe, boxShadow: LICHT_GLAS.schein(b.farbe) }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.titel}</span>
              </span>
            ))}
          </div>
          <p className="nur-vorleser">{licht.text}</p>
        </>
      )}
    </div>
  );
}

/** Eine Pill: Link (href), Knopf (onMarker) oder nur Anzeige — immer mit vollem Titel als Tooltip. */
function StrahlPill({ m, links, top, w, leise, onMarker }: { m: StrahlMarker; links: number; top: number; w: number; leise: boolean; onMarker?: (m: StrahlMarker) => void }) {
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
    opacity: leise ? 0.45 : 1, zIndex: 2, textDecoration: m.blass ? 'line-through' as const : 'none' as const, cursor: m.href || onMarker ? 'pointer' : 'default',
  };
  const titel = m.titel ?? `${m.label} · ${tagKurz(m.date)}`;
  if (m.href) return <Link data-strahl-eintrag className="zeit-pill" href={m.href} title={titel} style={stil}>{inhalt}</Link>;
  if (onMarker) return <button data-strahl-eintrag type="button" className="zeit-pill" title={titel} aria-label={titel} onClick={e => { e.stopPropagation(); onMarker(m); }} style={stil}>{inhalt}</button>;
  return <span data-strahl-eintrag className="zeit-pill" title={titel} style={stil}>{inhalt}</span>;
}

/**
 * Lichtfäden-Markierung: ein echter Knopf (Tippziel = Reihenhöhe, am Handy 44 px), darin der Glas-Chip mit Raute (Meilenstein),
 * Quadrat (Ziel-Frist, Projekt) oder Haken (erledigt) in der Bündelfarbe. Hover/Fokus melden das Bündel (Hervorheben).
 */
function LichtMarke({ m, links, top, w, hoehe, chip, leise, gedimmt, onMarker, onHervor }: {
  m: StrahlMarker; links: number; top: number; w: number; hoehe: number; chip: number; leise: boolean; gedimmt: boolean;
  onMarker?: (m: StrahlMarker) => void; onHervor: (an: boolean) => void;
}) {
  const sym = m.symbol ?? '◇';
  const quadrat = sym === '◎' || sym === '▣';
  const hohl = sym === '✓' || sym === '▣';
  const zeichen = sym === '●'
    ? <span style={{ flex: '0 0 auto', width: 7, height: 7, borderRadius: '50%', background: m.farbe, boxShadow: LICHT_GLAS.schein(m.farbe) }} />
    : <span style={{ flex: '0 0 auto', width: quadrat ? 8 : 7, height: quadrat ? 8 : 7, transform: quadrat ? undefined : 'rotate(45deg)', borderRadius: 1.5,
        background: hohl ? 'transparent' : m.farbe, border: hohl ? `1.5px solid ${m.farbe}` : undefined, boxShadow: hohl ? undefined : LICHT_GLAS.schein(m.farbe) }} />;
  const innen = (
    <span style={{ display: 'flex', alignItems: 'center', gap: 7, height: chip, maxWidth: w, padding: '0 10px 0 9px', borderRadius: 8,
      background: LICHT_GLAS.flaeche, border: `1px solid ${LICHT_GLAS.rand(m.farbe)}`, backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      fontFamily: SCHRIFT.text, fontSize: 12, fontWeight: 600, color: C.ink, lineHeight: 1, whiteSpace: 'nowrap',
      opacity: gedimmt ? 0.32 : leise ? 0.55 : 1, textDecoration: m.blass ? 'line-through' : 'none' }}>
      {zeichen}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.label}</span>
    </span>
  );
  const titel = m.titel ?? `${m.label} · ${tagKurz(m.date)}`;
  const stil = { position: 'absolute' as const, left: links, top, height: hoehe, maxWidth: w, display: 'flex', alignItems: 'center', padding: 0, background: 'transparent',
    border: 'none', zIndex: 2, cursor: m.href || onMarker ? 'pointer' : 'default', textDecoration: 'none', color: 'inherit' };
  const zeig = { onMouseEnter: () => onHervor(true), onMouseLeave: () => onHervor(false), onFocus: () => onHervor(true), onBlur: () => onHervor(false) };
  if (m.href) return <Link data-strahl-eintrag className="licht-marke" href={m.href} title={titel} aria-label={titel} style={stil} {...zeig}>{innen}</Link>;
  if (onMarker) return <button data-strahl-eintrag type="button" className="licht-marke" title={titel} aria-label={titel} onClick={e => { e.stopPropagation(); onMarker(m); }} style={stil} {...zeig}>{innen}</button>;
  return <span data-strahl-eintrag className="licht-marke" title={titel} style={stil} {...zeig}>{innen}</span>;
}
