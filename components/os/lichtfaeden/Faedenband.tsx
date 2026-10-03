'use client';

// ─── Lichtfäden v2 — das Band einer Ansicht (03.10.2026) ────────────────────
// Die Fläche: oben die Markierungen als echte Knöpfe (Meilensteine, Ziel-Fristen, Events, Fristen; gestapelt, Überlauf
// „+n“), darunter das Fädenband (Leinwand, lib/lichtfaeden/faedenband.ts), darunter Monate, Quartale, HEUTE. Engstellen
// als ruhige Lichtsäulen mit einem KW-Knopf. Tippen/Klicken auf ein Bündel = eine Ebene tiefer (`onTiefer`), Zeigen hebt
// es hervor. Blättern per Ziehen/Wischen, Umschalt+Rad, Tasten. Klick auf eine freie Stelle = `onTag` (anlegen), wenn gesetzt.
// Die Leinwand ist `aria-hidden` — Bedienung steckt in Knöpfen (Markierungen, Legende, Brotkrumen), Text im Textäquivalent.

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FARBE as C, LEUCHT, LICHT_GLAS, SCHRIFT } from '@/lib/make-one/design';
import { localDay } from '@/lib/zeit';
import { anteilIm, monatsTicks, quartale, stapeln, tagBeiAnteil, tageZwischen } from '@/lib/planung/zeitstrahl';
import { FAEDEN, faedenDeckeln, type Ansicht, type Buendel, type Marke } from '@/lib/lichtfaeden/baum';
import type { Engstelle } from '@/lib/lichtfaeden/fokus';
import { bandMasse, faedenband, type BandBild, type BandBuendel, type BandUebergang, type BandVerbinder, type Faedenband as Zeichner } from '@/lib/lichtfaeden/faedenband';
import { bewegungReduziert } from '@/lib/lichtfaeden/zeichnen';
import { useBlaettern } from './useBlaettern';

const FUSS = 46;
const QUARTAL_H = 24;
const ZEIT = LEUCHT.puls;
const ENGSTELLE = LEUCHT.achtung;
const tagKurz = (d: string) => `${d.slice(8)}.${d.slice(5, 7)}.${d.slice(0, 4) !== localDay().slice(0, 4) ? d.slice(0, 4) : ''}`;

/** Der Übergang, den die Hülle beim Ebenenwechsel mitgibt: `vorher` = die Bündel der verlassenen Ebene. */
export interface FaedenUebergang { richtung: 'auf' | 'zu'; fokus: string; vorher: readonly Buendel[]; fuer: string }

export interface FaedenbandProps {
  ansicht: Ansicht;
  engstellen: readonly Engstelle[];
  uebergang: FaedenUebergang | null;
  hervor: string | null;
  onHervor: (id: string | null) => void;
  onTiefer: (b: Buendel) => void;
  onEngstelle?: (woche: string) => void;
  onTag?: (tag: string) => void;
  onBlaettern?: (monate: number) => void;
  onBreite?: (px: number) => void;
  label: string;
}

const zuBand = (l: readonly Buendel[], deckel: number): BandBuendel[] => faedenDeckeln(l, deckel).map(b => ({ id: b.id, farbe: b.farbe, dichte: b.dichte, faeden: b.faeden }));

export function Faedenband({ ansicht, engstellen, uebergang, hervor, onHervor, onTiefer, onEngstelle, onTag, onBlaettern, onBreite, label }: FaedenbandProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const zeichner = useRef<Zeichner | null>(null);
  const [breite, setBreite] = useState(640);
  const breiteMelden = useRef(onBreite); breiteMelden.current = onBreite;
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const mess = () => { const b = el.clientWidth; if (b > 0) { setBreite(b); breiteMelden.current?.(b); } };
    mess();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(mess) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);

  const { von, bis } = ansicht;
  const heute = localDay();
  const frak = (d: string) => Math.max(0, Math.min(1, anteilIm(d, von, bis)));
  const heuteDrin = heute >= von && heute <= bis;
  const heuteX = heuteDrin ? frak(heute) * breite : null;
  const tage = tageZwischen(von, bis) + 1;
  const monatBreite = breite / Math.max(1, tage / 30.44);
  const masse = bandMasse(breite);
  const handy = breite < 520;

  // ── Markierungen stapeln (lib/planung/zeitstrahl.ts `stapeln`) ──
  const pillB = (m: Marke) => Math.min(178, 36 + Math.min(m.titel.length, 24) * 6);
  const st = stapeln(ansicht.marken.map(m => ({ x: frak(m.tag) * breite, w: pillB(m) })), breite, masse.maxReihen);
  const hatUeberlauf = st.buendel.length > 0;
  const reihen = (ansicht.marken.length ? Math.max(1, Math.min(masse.maxReihen, st.reihen)) : 0) + (hatUeberlauf ? 1 : 0);
  const bandOben = reihen * masse.reihe + 12;
  const achseY = bandOben + masse.band;
  const bandMitte = bandOben + masse.band / 2;
  const hoehe = achseY + FUSS - 12 + QUARTAL_H + 6;
  const markeTop = (r: number) => bandOben - 4 - (r + 1) * masse.reihe + (masse.reihe - masse.knopf) / 2;
  const chipUnten = (r: number) => markeTop(r) + masse.knopf / 2 + masse.chip / 2;
  const [offen, setOffen] = useState<number | null>(null);

  // ── Bild für den Zeichner ──
  const verbinder: BandVerbinder[] = ansicht.marken.map((m, i) => {
    const lage = st.lagen[i];
    return { x: frak(m.tag) * breite, yOben: lage && 'reihe' in lage ? chipUnten(lage.reihe) : null, buendel: m.buendel, farbe: m.farbe, leise: m.tag < heute || m.erledigt };
  });
  const deckel = handy ? FAEDEN.deckel.handy : FAEDEN.deckel.rechner;
  const wochenVersatz = ansicht.wochen.length ? tageZwischen(ansicht.wochen[0], von) : 0;
  const engX = engstellen.map(e => ({ woche: e.woche, x0: Math.max(0, (tageZwischen(von, e.woche) / tage) * breite), x1: Math.min(breite, ((tageZwischen(von, e.woche) + 7) / tage) * breite) }));
  const bild: BandBild = {
    breite, hoehe, bandOben, bandHoehe: masse.band, buendel: zuBand(ansicht.buendel, deckel), wochenVersatz, tage,
    heuteX, heuteSeite: heute < von ? 'links' : 'rechts', heuteFarbe: ZEIT, verbinder, engstellen: engX, engstelleFarbe: ENGSTELLE, hervor, handy,
  };
  const bildRef = useRef(bild); bildRef.current = bild;

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const z = faedenband(c, c.parentElement ?? c, bewegungReduziert());
    zeichner.current = z;
    z.setze(bildRef.current);
    // Messpunkt für Prüfungen (Zeichenzeit je Bild, Übergang) — liest nur.
    const messe = window.setInterval(() => { const m = z.lauf.messung(); c.dataset.bilder = String(m.bilder); c.dataset.mittelMs = m.mittelMs.toFixed(2); c.dataset.laengstesMs = m.laengstesMs.toFixed(2); c.dataset.uebergang = String(z.fortschritt() ?? ''); }, 250);
    return () => { window.clearInterval(messe); z.stop(); zeichner.current = null; };
  }, []);
  // Neue Ansicht → einmal mit Übergang (falls er zu ihr gehört); alles andere (Breite, Hervorheben) ohne.
  const angewandt = useRef<Ansicht | null>(null);
  useEffect(() => {
    const z = zeichner.current;
    if (!z) return;
    let u: BandUebergang | null = null;
    if (angewandt.current !== ansicht) {
      angewandt.current = ansicht;
      if (uebergang && uebergang.fuer === ansicht.wurzel.id) {
        const jetzt = zuBand(ansicht.buendel, deckel), vorher = zuBand(uebergang.vorher, deckel);
        u = uebergang.richtung === 'auf'
          ? { richtung: 'auf', fokus: uebergang.fokus, oben: vorher, unten: jetzt }
          : { richtung: 'zu', fokus: uebergang.fokus, oben: jetzt, unten: vorher };
      }
    }
    z.setze(bild, u);
  });

  const b = useBlaettern(boxRef, onBlaettern, monatBreite);
  const xy = (e: { clientX: number; clientY: number }) => { const r = boxRef.current?.getBoundingClientRect(); return r ? { x: e.clientX - r.left - b.zug, y: e.clientY - r.top } : { x: 0, y: 0 }; };
  const nachId = useMemo(() => new Map(ansicht.buendel.map(x => [x.id, x])), [ansicht]);
  const [zeiger, setZeiger] = useState<{ x: number; tiefer: boolean } | null>(null);

  // Ein offenes „+n“ schließt bei Klick daneben und mit Esc.
  useEffect(() => {
    if (offen == null) return;
    const zu = (e: Event) => { if (e instanceof KeyboardEvent ? e.key === 'Escape' : !(e.target instanceof HTMLElement && e.target.closest('[data-strahl-eintrag]'))) setOffen(null); };
    window.addEventListener('keydown', zu); window.addEventListener('pointerdown', zu);
    return () => { window.removeEventListener('keydown', zu); window.removeEventListener('pointerdown', zu); };
  }, [offen]);

  const ticks = monatsTicks(von, bis);
  const qs = quartale(von, bis);
  const eintrag = (t: EventTarget | null) => t instanceof Element && !!t.closest('[data-strahl-eintrag]');

  return (
    <div ref={boxRef} role="group" aria-label={label} tabIndex={onBlaettern ? 0 : undefined} data-faedenband=""
      onKeyDown={b.griffe.onKeyDown}
      onPointerDown={b.griffe.onPointerDown}
      onPointerMove={e => {
        if (b.griffe.onPointerMove(e)) { setZeiger(null); return; }
        if (e.pointerType !== 'mouse' || eintrag(e.target)) { setZeiger(null); return; }
        const p = xy(e);
        const id = zeichner.current?.treffer(p.x, p.y) ?? null;
        if (id !== hervor) onHervor(id);
        setZeiger({ x: p.x, tiefer: !!(id && nachId.get(id)?.tiefer) });
      }}
      onPointerUp={b.griffe.onPointerUp}
      onPointerCancel={b.griffe.onPointerCancel}
      onPointerLeave={() => { setZeiger(null); onHervor(null); }}
      onClickCapture={e => { if (b.gezogen()) { e.preventDefault(); e.stopPropagation(); } }}
      onClick={e => {
        if (eintrag(e.target)) return;
        const p = xy(e);
        const id = zeichner.current?.treffer(p.x, p.y);
        const ziel = id ? nachId.get(id) : undefined;
        if (ziel?.tiefer) { onTiefer(ziel); return; }
        if (onTag && !ziel) onTag(tagBeiAnteil(von, bis, p.x / Math.max(1, breite)));
      }}
      style={{ position: 'relative', height: hoehe, flex: '1 1 auto', minWidth: 0, overflow: 'hidden', touchAction: onBlaettern ? 'pan-y' : undefined, cursor: zeiger?.tiefer ? 'zoom-in' : onTag ? 'copy' : 'default', outline: 'none', userSelect: b.zug ? 'none' : undefined }}>
      <div style={{ position: 'absolute', inset: 0, transform: b.zug ? `translateX(${b.zug}px)` : undefined, transition: b.zug ? 'none' : 'transform .18s ease' }}>
        <canvas ref={canvasRef} aria-hidden="true" data-lichtfaeden=""
          style={{ position: 'absolute', left: 0, top: 0, width: breite, height: hoehe, pointerEvents: 'none', zIndex: 0 }} />

        {/* Quartale — leise Streifen, Name unter den Monaten */}
        {qs.map((q, i) => {
          const l = frak(q.von) * breite, r = frak(q.bis) * breite;
          const t0 = (tageZwischen(von, q.von) / tage) * breite, t1 = ((tageZwischen(von, q.bis) + 1) / tage) * breite;
          return (
            <span key={`q-${q.von}`}>
              {i % 2 === 1 && <span style={{ position: 'absolute', left: t0, width: Math.max(0, t1 - t0), top: 0, height: achseY, background: 'rgba(255,255,255,.018)', pointerEvents: 'none' }} />}
              {r - l > 24 && <span style={{ position: 'absolute', left: (l + r) / 2, top: achseY + FUSS + 2, transform: 'translateX(-50%)', fontFamily: SCHRIFT.text, fontSize: 12, fontWeight: 600, letterSpacing: '.06em', color: C.inkLeise, whiteSpace: 'nowrap', pointerEvents: 'none' }}>{q.label}</span>}
            </span>
          );
        })}
        {ticks.filter(tk => tk.wechsel).map(tk => (
          <span key={`w-${tk.date}`} style={{ position: 'absolute', left: (tageZwischen(von, tk.date) / tage) * breite - 0.5, top: 0, width: 1, height: achseY + 8, background: 'rgba(255,255,255,.16)', pointerEvents: 'none' }} />
        ))}
        {heuteX != null && <div style={{ position: 'absolute', left: heuteX - 0.5, top: 0, width: 1, height: bandOben, background: `${ZEIT}2E`, pointerEvents: 'none' }} />}

        {/* Markierungen — echte Knöpfe über dem Band */}
        {ansicht.marken.map((m, i) => {
          const lage = st.lagen[i];
          if (!lage || !('reihe' in lage)) return null;
          return <Markierung key={m.id} m={m} links={lage.links} top={markeTop(lage.reihe)} w={Math.min(pillB(m), breite)} hoehe={masse.knopf} chip={masse.chip}
            leise={m.tag < heute || m.erledigt} gedimmt={hervor != null && hervor !== m.buendel} onHervor={an => onHervor(an ? m.buendel : null)} />;
        })}
        {st.buendel.map((u, k) => {
          const auf = offen === k;
          return (
            <span key={`u-${k}`}>
              <button data-strahl-eintrag type="button" onClick={e => { e.stopPropagation(); setOffen(auf ? null : k); }} aria-expanded={auf}
                aria-label={`${u.idx.length} weitere: ${u.idx.map(i => ansicht.marken[i].titel).join(', ')}`}
                style={{ position: 'absolute', left: u.x - masse.knopf / 2, top: 2, minWidth: masse.knopf, height: masse.knopf, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', zIndex: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 30, height: masse.chip - 4, padding: '0 8px', borderRadius: 999, background: LICHT_GLAS.flaeche, border: `1px solid ${LICHT_GLAS.achse}`, color: C.ink, fontFamily: SCHRIFT.text, fontSize: 12, fontWeight: 700 }}>+{u.idx.length}</span>
              </button>
              {auf && (
                <div data-strahl-eintrag role="dialog" aria-label={`${u.idx.length} weitere`} onClick={e => e.stopPropagation()}
                  style={{ position: 'absolute', top: masse.knopf + 6, left: Math.max(0, Math.min(breite - 260, u.x - 130)), width: Math.min(260, breite), maxHeight: 240, overflowY: 'auto', background: C.flaecheHoch, border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, boxShadow: '0 16px 40px -12px rgba(0,0,0,.7)', padding: 6, zIndex: 20, cursor: 'default' }}>
                  {u.idx.map(i => {
                    const m = ansicht.marken[i];
                    const inhalt = <><span style={{ color: m.farbe, flex: '0 0 auto' }}>{m.symbol}</span><span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.titel}</span><span style={{ color: C.inkLeise, fontVariantNumeric: 'tabular-nums', flex: '0 0 auto' }}>{tagKurz(m.tag)}</span></>;
                    const stil = { display: 'flex', gap: 8, alignItems: 'center', width: '100%', minHeight: 44, padding: '0 8px', borderRadius: 8, color: C.ink, fontFamily: SCHRIFT.text, fontSize: 13, textDecoration: 'none' } as const;
                    return m.link ? <Link key={m.id} href={m.link} style={stil}>{inhalt}</Link> : <span key={m.id} style={stil}>{inhalt}</span>;
                  })}
                </div>
              )}
            </span>
          );
        })}

        {/* Engstellen — ruhige Marker am unteren Bandrand: ein Knopf je Woche */}
        {engstellen.map((e, i) => {
          const x = (engX[i].x0 + engX[i].x1) / 2;
          return (
            <button key={e.woche} data-strahl-eintrag type="button" className="licht-engstelle" onClick={ev => { ev.stopPropagation(); onEngstelle?.(e.woche); }}
              aria-label={`Engstelle ${e.text}`} title={e.text}
              style={{ position: 'absolute', left: Math.max(0, Math.min(breite - 56, x - 28)), top: achseY - masse.knopf - 2, width: 56, height: masse.knopf, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', zIndex: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 22, padding: '0 8px', borderRadius: 999, background: LICHT_GLAS.flaeche, border: `1px solid ${LICHT_GLAS.rand(ENGSTELLE)}`, color: ENGSTELLE, fontFamily: SCHRIFT.text, fontSize: 12, fontWeight: 700, letterSpacing: '.04em', fontVariantNumeric: 'tabular-nums' }}>
                <span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: '50%', background: ENGSTELLE, boxShadow: LICHT_GLAS.schein(ENGSTELLE) }} />KW {e.kw}
              </span>
            </button>
          );
        })}

        {!ansicht.buendel.length && (
          <div style={{ position: 'absolute', left: 0, right: 0, top: bandMitte - 10, textAlign: 'center', fontSize: 13, color: C.inkDim, pointerEvents: 'none', padding: '0 16px' }}>
            {onTag ? 'Nichts terminiert — Klick auf eine Stelle legt einen Meilenstein an.' : 'Nichts terminiert in diesem Zeitraum.'}
          </div>
        )}

        {/* Achse (Haarlinie), HEUTE, Monate */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: achseY, height: 1, background: LICHT_GLAS.achse }} />
        {heuteX != null && (
          <>
            <div className="zeit-puls" style={{ position: 'absolute', left: heuteX - 4.5, top: bandMitte - 4.5, width: 9, height: 9, borderRadius: '50%', background: ZEIT, boxShadow: `0 0 12px ${ZEIT}33`, zIndex: 2, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', left: heuteX, top: achseY + 9, transform: 'translateX(-50%)', fontFamily: SCHRIFT.text, fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: ZEIT, whiteSpace: 'nowrap', pointerEvents: 'none' }}>HEUTE</div>
          </>
        )}
        {ticks.filter(tk => { if (heuteX == null) return true; const x = frak(tk.date) * breite; return Math.abs(x - heuteX) > (x < 16 || x > breite - 16 ? 56 : 28); }).map(tk => {
          const x = frak(tk.date) * breite;
          const rand = x < 16 ? 'translateX(0)' : x > breite - 16 ? 'translateX(-100%)' : 'translateX(-50%)';
          return (
            <div key={tk.date} style={{ position: 'absolute', left: x, top: achseY + 3, transform: rand, textAlign: x < 16 ? 'left' : x > breite - 16 ? 'right' : 'center', pointerEvents: 'none' }}>
              <div style={{ width: 1, height: 6, background: tk.wechsel ? 'rgba(255,255,255,.3)' : 'rgba(255,255,255,.1)', margin: x < 16 ? 0 : x > breite - 16 ? '0 0 0 auto' : '0 auto' }} />
              <div style={{ fontFamily: SCHRIFT.display, fontSize: 12, color: C.inkLeise, marginTop: 3, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{tk.label}</div>
              {tk.jahr && <div style={{ fontFamily: SCHRIFT.display, fontSize: 12, fontWeight: 800, color: tk.wechsel ? C.ink : C.inkDim, marginTop: 1, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{tk.jahr}</div>}
            </div>
          );
        })}

        {/* Wo ein Klick anlegen würde (nur Maus, nicht über einem Bündel) */}
        {onTag && zeiger && !zeiger.tiefer && !b.zug && (
          <span style={{ position: 'absolute', left: Math.max(0, Math.min(breite - 90, zeiger.x - 45)), top: 0, width: 90, textAlign: 'center', fontFamily: SCHRIFT.text, fontSize: 12, fontWeight: 700, color: C.aktiv, pointerEvents: 'none' }}>+ {tagKurz(tagBeiAnteil(von, bis, zeiger.x / Math.max(1, breite)))}</span>
        )}
      </div>
    </div>
  );
}

/** Eine Markierung: echter Knopf bzw. Link (Tippziel = Reihenhöhe, am Handy 44 px), darin der Glas-Chip mit Symbol in der Bündelfarbe. */
function Markierung({ m, links, top, w, hoehe, chip, leise, gedimmt, onHervor }: {
  m: Marke; links: number; top: number; w: number; hoehe: number; chip: number; leise: boolean; gedimmt: boolean; onHervor: (an: boolean) => void;
}) {
  const quadrat = m.symbol === '◎' || m.symbol === '▣';
  const zeichen = m.symbol === '◇' || quadrat
    ? <span style={{ flex: '0 0 auto', width: quadrat ? 8 : 7, height: quadrat ? 8 : 7, transform: quadrat ? undefined : 'rotate(45deg)', borderRadius: 1.5, background: m.erledigt ? 'transparent' : m.farbe, border: m.erledigt ? `1.5px solid ${m.farbe}` : undefined, boxShadow: m.erledigt ? undefined : LICHT_GLAS.schein(m.farbe) }} />
    : <span style={{ flex: '0 0 auto', color: m.farbe, fontSize: 12, lineHeight: 1 }}>{m.symbol}</span>;
  const titel = `${m.titel} · ${tagKurz(m.tag)}${m.erledigt ? ' · erledigt' : ''}`;
  const innen = (
    <span style={{ display: 'flex', alignItems: 'center', gap: 7, height: chip, maxWidth: w, padding: '0 10px 0 9px', borderRadius: 8,
      background: LICHT_GLAS.flaeche, border: `1px solid ${LICHT_GLAS.rand(m.farbe)}`, backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      fontFamily: SCHRIFT.text, fontSize: 12, fontWeight: 600, color: C.ink, lineHeight: 1, whiteSpace: 'nowrap',
      opacity: gedimmt ? 0.32 : leise ? 0.55 : 1, textDecoration: m.erledigt ? 'line-through' : 'none' }}>
      {zeichen}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.titel}</span>
    </span>
  );
  const stil = { position: 'absolute' as const, left: links, top, height: hoehe, maxWidth: w, display: 'flex', alignItems: 'center', padding: 0, background: 'transparent', border: 'none', zIndex: 2, cursor: m.link ? 'pointer' : 'default', textDecoration: 'none', color: 'inherit' };
  const zeig = { onMouseEnter: () => onHervor(true), onMouseLeave: () => onHervor(false), onFocus: () => onHervor(true), onBlur: () => onHervor(false) };
  if (m.link) return <Link data-strahl-eintrag className="licht-marke" href={m.link} title={titel} aria-label={titel} style={stil} {...zeig}>{innen}</Link>;
  return <span data-strahl-eintrag className="licht-marke" title={titel} style={stil} {...zeig}>{innen}</span>;
}
