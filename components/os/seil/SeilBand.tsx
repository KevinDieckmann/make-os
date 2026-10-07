'use client';

// ─── Seil — die Bühne am Rechner (07.10.) ────────────────────────────────────────────────────────────────────────────────
// Links eine feste Spalte mit der Beschriftung jeder Spur (wie ein Gantt: jeder Strang ist auf einen Blick benannt, Fortschritt in
// Prozent, Schloss bei Blockade), rechts die Zeit: Leinwand (lib/lichtfaeden/seilband.ts, `aria-hidden`) mit Strängen, Seilen, Kanten.
// Echte Knöpfe darüber: je Seil ein Kopf (Ziel → Ziel-Seite, Momentum, „Fokus“), je Strang die Beschriftung (→ Meilenstein/Projekt/
// Ziel), am Anker ein Knopf (◎ → Ziel-Seite). Zeigen auf Karte/Strang zeigt einen ruhigen Hinweis (Titel, Fälligkeit, Grund einer
// Blockade); Klick öffnet die Karte bzw. den Strang. Blättern per Ziehen/Wischen/Tasten wie die Lichtfäden (useBlaettern).
// Die Lage rechnet seil-geometrie.ts — hier wird nichts gerechnet.

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Lock, Target } from 'lucide-react';
import { FARBE as C, LEUCHT, LICHT_GLAS, RAND, SCHRIFT, TIEF, TYP } from '@/lib/make-one/design';
import { localDay } from '@/lib/zeit';
import { monatsTicks, tageZwischen } from '@/lib/planung/zeitstrahl';
import type { SeilAnsicht, SeilStrang } from '@/lib/lichtfaeden/seil';
import { SEIL_FORM, seilLage, seilSpalte } from '@/lib/lichtfaeden/seil-geometrie';
import { seilband, type SeilFarben, type Seilband, type SeilTreffer } from '@/lib/lichtfaeden/seilband';
import { bewegungReduziert } from '@/lib/lichtfaeden/zeichnen';
import { useBlaettern } from '../lichtfaeden/useBlaettern';

const ACHSE = 26;
const SP = SEIL_FORM.spalte;
const FARBEN: SeilFarben = { heute: LEUCHT.puls, achtung: LEUCHT.achtung, leise: C.inkLeise, kritisch: LEUCHT.kritisch, grund: C.flaeche };
const kurz = (t: string) => `${t.slice(8, 10)}.${t.slice(5, 7)}.${t.slice(0, 4) !== localDay().slice(0, 4) ? t.slice(2, 4) : ''}`;
const prozent = (v: number) => `${Math.round(v * 100)} %`;
const ART: Record<SeilStrang['art'], string> = { meilenstein: 'Meilenstein', unterziel: 'Unterziel', projekt: 'Projekt', liste: 'Meilenstein-Liste', karten: 'Einzelne Karten' };

export interface SeilBandProps {
  ansicht: SeilAnsicht;
  heute: string;
  fokus: string | null;
  onFokus: (zielId: string | null) => void;
  onBlaettern?: (monate: number) => void;
  /** Breite der Zeit-Fläche (ohne Beschriftungs-Spalte) — für die Zahl der Monate im Fenster. */
  onBreite?: (px: number) => void;
  label: string;
}

export function SeilBand({ ansicht, heute, fokus, onFokus, onBlaettern, onBreite, label }: SeilBandProps) {
  const router = useRouter();
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const zeichner = useRef<Seilband | null>(null);
  const [gesamt, setGesamt] = useState(900);
  // Links die Beschriftungs-Spalte, rechts die Zeit — geteilt nach EINER Regel (seilSpalte).
  const { spalte: rand, zeit: breite } = seilSpalte(gesamt);
  /** Schmale Spalte: ohne Prozent-Zahl (der gefüllte Anteil der Röhre und der Hinweis nennen ihn). */
  const schmal = rand <= SP.schmal;
  const breiteMelden = useRef(onBreite); breiteMelden.current = onBreite;
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const mess = () => { const b = el.clientWidth; if (b > 0) { setGesamt(b); breiteMelden.current?.(seilSpalte(b).zeit); } };
    mess();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(mess) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);

  const lage = useMemo(() => seilLage(ansicht, breite), [ansicht, breite]);
  const { von, bis } = ansicht;
  const tage = tageZwischen(von, bis) + 1;
  const heuteX = heute >= von && heute <= bis ? lage.x(heute) : null;
  const ticks = useMemo(() => monatsTicks(von, bis), [von, bis]);
  const raster = useMemo(() => ticks.map(t => lage.x(t.date)), [ticks, lage]);
  // Monatsnamen ohne Überlappung: geschätzte Breite je Beschriftung (7 px je Zeichen).
  const tickSichtbar = useMemo(() => {
    let rechts = -Infinity;
    return ticks.map(tk => {
      const x = lage.x(tk.date);
      const text = `${tk.label}${tk.jahr ? ` ${tk.jahr}` : ''}`;
      const ok = x - 2 > rechts && x + text.length * 7 < breite + 4;
      if (ok) rechts = x + text.length * 7 + 6;
      return { tk, x, text, ok };
    }).filter(t => t.ok);
  }, [ticks, lage, breite]);
  const [hervor, setHervor] = useState<string | null>(null);
  const [zeig, setZeig] = useState<{ x: number; y: number; text: string; grund?: string } | null>(null);

  const bild = { ansicht, lage, heuteX, fokus, hervor, raster, farben: FARBEN, handy: false };
  const bildRef = useRef(bild); bildRef.current = bild;
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const z = seilband(c, c.parentElement ?? c, bewegungReduziert());
    zeichner.current = z;
    z.setze(bildRef.current);
    // Messpunkt für Prüfungen (Zeichenzeit, Aufbau) — nur außerhalb der Produktion bzw. mit `data-messen`.
    const messen = process.env.NODE_ENV !== 'production' || !!c.closest('[data-messen]');
    const messe = messen ? window.setInterval(() => { const m = z.lauf.messung(); c.dataset.bilder = String(m.bilder); c.dataset.mittelMs = m.mittelMs.toFixed(2); c.dataset.aufbau = String(z.aufbau() ?? ''); c.dataset.bewegt = String(z.bewegt()); }, 250) : undefined;
    return () => { if (messe !== undefined) window.clearInterval(messe); z.stop(); zeichner.current = null; };
  }, []);
  useEffect(() => { zeichner.current?.setze(bild); });

  const monatBreite = breite / Math.max(1, tage / 30.44);
  const b = useBlaettern(boxRef, onBlaettern, monatBreite);
  const xy = (e: { clientX: number; clientY: number }) => { const r = canvasRef.current?.getBoundingClientRect(); return r ? { x: e.clientX - r.left, y: e.clientY - r.top } : { x: 0, y: 0 }; };
  const kartenNach = useMemo(() => new Map(Object.values(ansicht.straenge).flatMap(s => s.karten.map(k => [k.id, { k, s }] as const))), [ansicht]);
  const beschreibe = (t: SeilTreffer): { text: string; grund?: string; link?: string } | null => {
    if (t.art === 'karte') {
      const e = kartenNach.get(t.id);
      if (!e) return null;
      const { k, s } = e;
      return { text: `${k.titel}${k.tag ? ` · fällig ${kurz(k.tag)}` : ''} · ${k.status === 'erledigt' ? 'erledigt' : k.status === 'abgebrochen' ? 'abgebrochen' : 'offen'} — ${s.titel}`, ...(k.grund ? { grund: k.grund } : {}), ...(k.link ? { link: k.link } : {}) };
    }
    if (t.art === 'strang') {
      const s = ansicht.straenge[t.id];
      if (!s) return null;
      return { text: `${ART[s.art]} „${s.titel}“ · ${prozent(s.fortschritt)}${s.ohneDatum ? ' · ohne Datum' : ` · bis ${kurz(s.bis)}`}${s.ueber ? ` · über „${s.ueber}“` : ''}`, ...(s.grund ? { grund: s.grund } : {}), ...(s.link ? { link: s.link } : {}) };
    }
    return null;
  };
  const eintrag = (t: EventTarget | null) => t instanceof Element && !!t.closest('[data-seil-eintrag]');
  const leiste = { fontFamily: SCHRIFT.text, fontSize: TYP.bedien, lineHeight: '16px' } as const;

  return (
    <div ref={boxRef} role="group" aria-label={label} tabIndex={onBlaettern ? 0 : undefined} data-seilband=""
      onKeyDown={b.griffe.onKeyDown} onPointerDown={b.griffe.onPointerDown} onPointerUp={b.griffe.onPointerUp} onPointerCancel={b.griffe.onPointerCancel}
      onPointerMove={e => {
        if (b.griffe.onPointerMove(e)) { setZeig(null); return; }
        if (eintrag(e.target)) { setZeig(null); return; }
        const p = xy(e);
        const t = p.x >= 0 ? zeichner.current?.treffer(p.x, p.y) ?? null : null;
        const id = t?.art === 'strang' ? t.id : t?.art === 'karte' ? t.strang : null;
        if (id !== hervor) setHervor(id);
        const info = t ? beschreibe(t) : null;
        setZeig(info ? { x: p.x, y: p.y, text: info.text, ...(info.grund ? { grund: info.grund } : {}) } : null);
      }}
      onPointerLeave={() => { setZeig(null); setHervor(null); }}
      onClickCapture={e => { if (b.gezogen()) { e.preventDefault(); e.stopPropagation(); } }}
      onClick={e => {
        if (eintrag(e.target)) return;
        const p = xy(e);
        const t = p.x >= 0 ? zeichner.current?.treffer(p.x, p.y) : null;
        if (!t) return;
        if (t.art === 'seil') { onFokus(fokus === t.id ? null : t.id); return; }
        const link = beschreibe(t)?.link;
        if (link) router.push(link);
      }}
      style={{ position: 'relative', width: '100%', minWidth: 0, outline: 'none', touchAction: onBlaettern ? 'pan-y' : undefined, userSelect: b.zug ? 'none' : undefined }}>
      {/* Kopf der Beschriftungs-Spalte (wie ein Gantt) */}
      <span aria-hidden="true" style={{ position: 'absolute', left: SP.einzug, top: 0, height: ACHSE, display: 'flex', alignItems: 'center', fontFamily: SCHRIFT.text, fontSize: TYP.mikro, fontWeight: 700, letterSpacing: '.12em', color: C.inkLeise }}>STRÄNGE</span>
      {/* Monate oben (die Achse liest sich vor den Strängen) — nur über der Zeit-Fläche */}
      <div aria-hidden="true" style={{ position: 'relative', height: ACHSE, marginLeft: rand, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, transform: b.zug ? `translateX(${b.zug}px)` : undefined, transition: b.zug ? 'none' : 'transform .18s ease' }}>
          {tickSichtbar.map(({ tk, x, text }) => (
            <span key={tk.date} style={{ position: 'absolute', left: x, top: 4, fontFamily: SCHRIFT.display, fontSize: 12, color: tk.wechsel || tk.jahr ? C.ink : C.inkLeise, fontWeight: tk.jahr ? 800 : 500, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{text}</span>
          ))}
          {heuteX != null && <span style={{ position: 'absolute', left: heuteX, bottom: 0, transform: 'translateX(-50%)', fontFamily: SCHRIFT.text, fontSize: 11, fontWeight: 700, letterSpacing: '.12em', color: LEUCHT.puls, background: C.flaeche, padding: '0 4px' }}>HEUTE</span>}
        </div>
      </div>
      <div style={{ position: 'relative', height: lage.hoehe }}>
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: rand, width: breite, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, transform: b.zug ? `translateX(${b.zug}px)` : undefined, transition: b.zug ? 'none' : 'transform .18s ease' }}>
            <canvas ref={canvasRef} aria-hidden="true" data-seil="" style={{ position: 'absolute', left: 0, top: 0, width: breite, height: lage.hoehe, pointerEvents: 'none' }} />
          </div>
        </div>
        {/* Trennlinie zwischen Spalte und Zeit — eine Haarlinie */}
        <div aria-hidden="true" style={{ position: 'absolute', top: 0, bottom: 0, left: rand - 1, width: 1, background: RAND.haar, pointerEvents: 'none' }} />
        {lage.gruppen.map(g => {
          const s = g.seil ? ansicht.seile.find(x => x.zielId === g.seil) : undefined;
          const gedimmt = !!fokus && fokus !== g.seil;
          const blockiert = g.spuren.filter(sp => ansicht.straenge[sp.id].status === 'blockiert').length;
          return (
            <div key={g.seil ?? 'ohne'} style={{ opacity: gedimmt ? 0.45 : 1, transition: 'opacity .25s ease' }}>
              {/* Kopf über die ganze Breite: Ziel, Momentum, Fokus */}
              <div data-seil-eintrag="" style={{ position: 'absolute', left: 0, right: 0, top: g.y0, height: SEIL_FORM.kopf, display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, borderTop: g.y0 > 0 ? `1px solid ${RAND.haar}` : undefined }}>
                {s ? (
                  <>
                    <Link href={s.link ?? '#'} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0, flex: '0 1 auto', color: C.ink, textDecoration: 'none', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 700 }} title={`Ziel „${s.titel}“ öffnen`}>
                      <Target size={14} color={s.farbe} aria-hidden style={{ flex: '0 0 auto' }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.titel}</span>
                    </Link>
                    <span style={{ fontFamily: SCHRIFT.display, fontSize: 12, color: C.inkDim, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', flex: '0 0 auto' }}>
                      {prozent(s.momentum)} · {s.fertig}/{s.straenge.length} fertig{blockiert ? ` · ${blockiert} wartet` : ''}{s.ankerArt === 'frist' ? ` · Frist ${kurz(s.anker)}` : ''}{s.ueberfaellig ? ' (überschritten)' : ''}
                    </span>
                    <button type="button" onClick={() => onFokus(fokus === s.zielId ? null : s.zielId)} aria-pressed={fokus === s.zielId} className="fassbar"
                      aria-label={fokus === s.zielId ? `Fokus auf „${s.titel}“ lösen` : `Fokus auf „${s.titel}“ — nur seine Stränge, kritischer Pfad`}
                      style={{ marginLeft: 'auto', flex: '0 0 auto', height: 28, minWidth: 64, padding: '0 10px', borderRadius: 999, ...(fokus === s.zielId ? TIEF.knopf(s.farbe) : { border: `1px solid ${RAND.stark}`, background: 'transparent', color: C.inkDim }), fontFamily: SCHRIFT.text, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      {fokus === s.zielId ? 'Fokus ✕' : 'Fokus'}
                    </button>
                  </>
                ) : (
                  <span style={{ fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 700, color: C.inkDim }}>Ohne Ziel <span style={{ fontWeight: 500, color: C.inkLeise }}>— zahlt noch auf kein Ziel ein</span></span>
                )}
              </div>
              {/* Beschriftung je Spur in der linken Spalte: Marke (Schloss bei Blockade, gefüllt wenn erledigt), Titel, Fortschritt.
                  Die ganze Spur-Höhe ist Tippfläche; Zeigen/Fokus hebt den Strang auf der Leinwand hervor (und umgekehrt). */}
              {g.spuren.map(sp => {
                const st = ansicht.straenge[sp.id];
                const fertig = st.status === 'erledigt';
                const inhalt = (
                  <>
                    {st.status === 'blockiert'
                      ? <Lock size={12} aria-hidden style={{ flex: '0 0 auto', color: LEUCHT.achtung }} />
                      : <span aria-hidden="true" style={{ flex: '0 0 auto', width: 8, height: 8, borderRadius: 2, background: fertig ? st.farbe : 'transparent', border: `1.5px solid ${st.farbe}` }} />}
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {st.ueber && <span aria-hidden="true" style={{ color: C.inkLeise }}>› </span>}{st.titel}
                    </span>
                    {!schmal && <span style={{ flex: '0 0 auto', color: fertig ? C.inkLeise : st.status === 'ueberfaellig' ? LEUCHT.achtung : C.inkDim, fontFamily: SCHRIFT.display, fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{prozent(st.fortschritt)}</span>}
                  </>
                );
                const an = hervor === st.id;
                const stil = {
                  ...leiste, position: 'absolute' as const, left: SP.einzug, top: sp.y - SEIL_FORM.spur / 2, width: rand - SP.einzug - SP.luft, height: SEIL_FORM.spur,
                  display: 'flex', alignItems: 'center', gap: 6, paddingRight: 2, borderRadius: 6, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' as const,
                  color: fertig ? C.inkLeise : C.ink, background: an ? TIEF.flaeche(st.farbe) : 'transparent', opacity: hervor && !an ? 0.6 : 1,
                };
                const titel = `${ART[st.art]} „${st.titel}“${st.ueber ? ` (über „${st.ueber}“)` : ''} · ${prozent(st.fortschritt)}${st.ohneDatum ? ' · ohne Datum' : ` · bis ${kurz(st.bis)}`}${st.grund ? ` — ${st.grund}` : ''}`;
                const zeige = { onMouseEnter: () => setHervor(st.id), onMouseLeave: () => setHervor(null), onFocus: () => setHervor(st.id), onBlur: () => setHervor(null) };
                return st.link
                  ? <Link key={sp.id} data-seil-eintrag="" data-seil-zeile={st.id} href={st.link} title={titel} aria-label={titel} style={stil} {...zeige}>{inhalt}</Link>
                  : <span key={sp.id} data-seil-eintrag="" data-seil-zeile={st.id} title={titel} style={stil} {...zeige}>{inhalt}</span>;
              })}
              {/* Anker (◎ → Ziel-Seite) bzw. Hinweis, wenn er hinter dem Fenster liegt */}
              {s && g.ankerAusserhalb == null && g.xAnker + b.zug >= 0 && g.xAnker + b.zug <= breite && (
                <Link data-seil-eintrag="" href={s.link ?? '#'} aria-label={`Ziel „${s.titel}“ — ${s.ankerArt === 'frist' ? `Frist ${kurz(s.anker)}` : s.ankerArt === 'jahresende' ? `bis Jahresende ${s.anker.slice(0, 4)}` : 'ohne Frist'}, Momentum ${prozent(s.momentum)}`}
                  title={`${s.titel} · ${s.ankerArt === 'frist' ? `Frist ${kurz(s.anker)}` : s.ankerArt === 'jahresende' ? `bis Ende ${s.anker.slice(0, 4)}` : 'ohne Frist'}`}
                  style={{ position: 'absolute', left: rand + g.xAnker - 14 + b.zug, top: g.seilY - 14, width: 28, height: 28, borderRadius: 999 }} />
              )}
              {s && g.ankerAusserhalb === 'rechts' && (
                <span style={{ position: 'absolute', right: 0, top: g.seilY - 9, fontFamily: SCHRIFT.text, fontSize: 12, color: s.farbe, background: C.flaeche, padding: '0 4px', borderRadius: 6 }}>▶ {kurz(s.anker)}</span>
              )}
              {s && g.ankerAusserhalb === 'links' && (
                <span style={{ position: 'absolute', left: rand + 4, top: g.seilY - 9, fontFamily: SCHRIFT.text, fontSize: 12, color: s.farbe, background: C.flaeche, padding: '0 4px', borderRadius: 6 }}>◀ {kurz(s.anker)}</span>
              )}
            </div>
          );
        })}
        {zeig && (
          <div role="status" style={{ position: 'absolute', left: Math.max(rand, Math.min(gesamt - 300, rand + b.zug + zeig.x + 12)), top: zeig.y + 14, width: 'max-content', maxWidth: 300, padding: '8px 10px', borderRadius: 10, background: LICHT_GLAS.flaeche, border: `1px solid ${RAND.flaeche}`, boxShadow: '0 12px 30px -12px rgba(0,0,0,.8)', fontFamily: SCHRIFT.text, fontSize: 12, color: C.ink, pointerEvents: 'none', zIndex: 5 }}>
            {zeig.text}
            {zeig.grund && <div style={{ marginTop: 4, color: LEUCHT.achtung }}>{zeig.grund}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
