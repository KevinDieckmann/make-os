'use client';

// ─── Finanzplanung jetzt — Diagramme in reinem SVG ───────────────────────────
// Linie (Verlauf mit „heute“-Strich), Stapel (Töpfe je Monat) und Fluss
// (Einnahmen → Haushalt/Umsatz → Töpfe). Keine Fremdbibliothek: eine Fläche,
// wenige Farben, Kupfer für Geld, Lila für IST. Beträge verschwinden mit
// „Verbergen“.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { FARBE as C, SCHRIFT } from '@/lib/make-one/design';
import { eur } from '@/lib/finanzen/plan/hilfen';
import { usePlan } from './daten';

function useBreite<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [b, setB] = useState(0);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(es => { for (const e of es) setB(Math.round(e.contentRect.width)); });
    ro.observe(el); setB(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return [ref, b];
}

/** Schrittweite der Achse: 1·2·5·10 × Zehnerpotenz, höchstens fünf Linien. */
export function achsenSchritt(mn: number, mx: number): number {
  const s = Math.pow(10, Math.floor(Math.log10(Math.max(1, (mx - mn) / 4))));
  return [1, 2, 5, 10].map(k => k * s).find(k => (mx - mn) / k <= 5) ?? 10 * s;
}
const kurz = (v: number) => (Math.abs(v) >= 1000 ? `${eur(v / 1000, Math.abs(v) < 10000 && v % 1000 !== 0 ? 1 : 0)}k` : eur(v));

export interface Serie { name: string; farbe: string; werte: (number | null)[]; breite?: number; gestrichelt?: boolean }

export function Linie({ serien, labels, heute, tick = 3, hoehe = 230, einheit = ' €' }: { serien: Serie[]; labels: string[]; heute?: number; tick?: number; hoehe?: number; einheit?: string }) {
  const [ref, W] = useBreite<HTMLDivElement>();
  const { verbergen } = usePlan();
  const [hov, setHov] = useState<number | null>(null);
  const L = 50, R = 12, T = 12, B = 24, H = hoehe;
  const alle = serien.flatMap(s => s.werte).filter((v): v is number => v != null && Number.isFinite(v));
  let mn = Math.min(0, ...alle), mx = Math.max(0, ...alle); if (mx === mn) mx = mn + 1;
  const pad = (mx - mn) * 0.06; mn -= pad; mx += pad;
  const n = Math.max(1, labels.length);
  const x = (i: number) => L + (i * (W - L - R)) / Math.max(1, n - 1);
  const y = (v: number) => T + ((mx - v) * (H - T - B)) / (mx - mn);
  const st = achsenSchritt(mn, mx);
  const linien: number[] = []; for (let v = Math.ceil(mn / st) * st; v <= mx; v += st) linien.push(v);
  const blur = verbergen ? { filter: 'blur(5px)' } : {};
  const pfad = (s: Serie) => { let d = '', an = false; s.werte.forEach((v, i) => { if (v == null) { an = false; return; } d += `${an ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`; an = true; }); return d; };
  const bewege = (e: React.MouseEvent<SVGSVGElement>) => { const r = e.currentTarget.getBoundingClientRect(); const i = Math.round(((e.clientX - r.left - L) / Math.max(1, W - L - R)) * (n - 1)); setHov(Math.max(0, Math.min(n - 1, i))); };
  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      {W > 0 && (
        <svg width={W} height={H} style={{ display: 'block', overflow: 'visible' }} onMouseMove={bewege} onMouseLeave={() => setHov(null)} aria-hidden>
          {linien.map(v => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={Math.abs(v) < 1e-6 ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.06)'} /><text x={L - 6} y={y(v) + 4} fill={C.inkLeise} fontSize="11" textAnchor="end" fontFamily={SCHRIFT.text} style={blur}>{kurz(v)}</text></g>)}
          {labels.map((l, i) => (i % tick === 0 ? <text key={i} x={x(i)} y={H - 6} fill={C.inkLeise} fontSize="11" textAnchor="middle" fontFamily={SCHRIFT.text}>{l}</text> : null))}
          {heute != null && heute >= 0 && heute < n && <g><line x1={x(heute)} x2={x(heute)} y1={T} y2={H - B} stroke={C.aktiv} strokeDasharray="2 3" /><text x={x(heute) + 4} y={T + 10} fill={C.aktiv} fontSize="11" fontFamily={SCHRIFT.text}>heute</text></g>}
          {serien.map(s => <path key={s.name} d={pfad(s)} fill="none" stroke={s.farbe} strokeWidth={s.breite ?? 2} strokeDasharray={s.gestrichelt ? '4 4' : undefined} strokeLinejoin="round" strokeLinecap="round" />)}
          {hov != null && <line x1={x(hov)} x2={x(hov)} y1={T} y2={H - B} stroke="rgba(255,255,255,.25)" />}
          {hov != null && serien.map(s => { const v = s.werte[hov]; return v == null ? null : <circle key={s.name} cx={x(hov)} cy={y(v)} r={3.5} fill={s.farbe} />; })}
        </svg>
      )}
      {hov != null && (
        <div style={{ position: 'absolute', top: 6, left: Math.min(x(hov) + 12, Math.max(0, W - 190)), pointerEvents: 'none', background: C.flaecheHoch, borderRadius: 10, padding: '8px 10px', fontSize: 12, color: C.inkDim, boxShadow: '0 12px 30px -10px rgba(0,0,0,.7)', whiteSpace: 'nowrap', zIndex: 3 }}>
          <div style={{ color: C.ink, fontWeight: 700, marginBottom: 3 }}>{labels[hov]}</div>
          {serien.map(s => (s.werte[hov] == null ? null : <div key={s.name} style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}><span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: s.farbe, marginRight: 6 }} />{s.name}</span><span style={{ fontVariantNumeric: 'tabular-nums', color: C.ink, ...blur }}>{eur(s.werte[hov])}{einheit}</span></div>))}
        </div>
      )}
    </div>
  );
}

export function Stapel({ stapel, labels, farben, namen, hoehe = 240, tick = 3 }: { stapel: number[][]; labels: string[]; farben: string[]; namen: string[]; hoehe?: number; tick?: number }) {
  const [ref, W] = useBreite<HTMLDivElement>();
  const { verbergen } = usePlan();
  const [hov, setHov] = useState<number | null>(null);
  const L = 50, R = 12, T = 12, B = 24, H = hoehe;
  const tot = stapel.map(s => s.reduce((a, b) => a + Math.max(0, b), 0)), neg = stapel.map(s => s.reduce((a, b) => a + Math.min(0, b), 0));
  const mx = Math.max(1, ...tot), mn = Math.min(0, ...neg);
  const n = Math.max(1, labels.length), bw = (W - L - R) / n;
  const y = (v: number) => T + ((mx - v) * (H - T - B)) / (mx - mn);
  const st = achsenSchritt(mn, mx);
  const linien: number[] = []; for (let v = Math.ceil(mn / st) * st; v <= mx; v += st) linien.push(v);
  const blur = verbergen ? { filter: 'blur(5px)' } : {};
  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      {W > 0 && (
        <svg width={W} height={H} style={{ display: 'block' }} onMouseLeave={() => setHov(null)} aria-hidden>
          {linien.map(v => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,.06)" /><text x={L - 6} y={y(v) + 4} fill={C.inkLeise} fontSize="11" textAnchor="end" fontFamily={SCHRIFT.text} style={blur}>{kurz(v)}</text></g>)}
          {stapel.map((s, i) => {
            let auf = 0, ab = 0;
            return (
              <g key={i} onMouseEnter={() => setHov(i)}>
                <rect x={L + i * bw} y={T} width={bw} height={H - T - B} fill={hov === i ? 'rgba(255,255,255,.04)' : 'transparent'} />
                {s.map((v, k) => {
                  if (v >= 0) { const r = <rect key={k} x={L + i * bw + 1.5} width={Math.max(1, bw - 3)} y={y(auf + v)} height={Math.max(0, y(auf) - y(auf + v))} fill={farben[k]} rx={1.5} />; auf += v; return r; }
                  const r = <rect key={k} x={L + i * bw + 1.5} width={Math.max(1, bw - 3)} y={y(ab)} height={Math.max(0, y(ab + v) - y(ab))} fill={farben[k]} opacity={0.7} rx={1.5} />; ab += v; return r;
                })}
                {i % tick === 0 && <text x={L + i * bw + bw / 2} y={H - 6} fill={C.inkLeise} fontSize="11" textAnchor="middle" fontFamily={SCHRIFT.text}>{labels[i]}</text>}
              </g>
            );
          })}
        </svg>
      )}
      {hov != null && (
        <div style={{ position: 'absolute', top: 6, left: Math.min(L + hov * bw + bw + 6, Math.max(0, W - 190)), pointerEvents: 'none', background: C.flaecheHoch, borderRadius: 10, padding: '8px 10px', fontSize: 12, color: C.inkDim, boxShadow: '0 12px 30px -10px rgba(0,0,0,.7)', whiteSpace: 'nowrap', zIndex: 3 }}>
          <div style={{ color: C.ink, fontWeight: 700, marginBottom: 3 }}>{labels[hov]}</div>
          {stapel[hov].map((v, k) => <div key={k} style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}><span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: farben[k], marginRight: 6 }} />{namen[k]}</span><span style={{ fontVariantNumeric: 'tabular-nums', color: C.ink, ...blur }}>{eur(v)} €</span></div>)}
        </div>
      )}
    </div>
  );
}

export interface FlussKante { von: string; nach: string; wert: number; farbe: string; sv: 0 | 1; sn: 1 | 2 }

/** Einfacher Fluss in zwei Stufen: Quellen → Mitte → Ziele. */
export function Fluss({ kanten, hoehe = 360 }: { kanten: FlussKante[]; hoehe?: number }) {
  const [ref, W] = useBreite<HTMLDivElement>();
  const { verbergen } = usePlan();
  const schmal = W < 620;
  const H = hoehe, knotenB = 12, luecke = 10, rand = schmal ? 104 : 160;
  interface Knoten { n: string; s: number; ein: number; aus: number; x: number; y: number; h: number; oy: number; iy: number }
  const spalten: Knoten[][] = [[], [], []]; const knoten: Record<string, Knoten> = {};
  const hol = (n: string, s: number) => { if (!knoten[n]) { knoten[n] = { n, s, ein: 0, aus: 0, x: 0, y: 0, h: 0, oy: 0, iy: 0 }; spalten[s].push(knoten[n]); } return knoten[n]; };
  const ks = kanten.filter(k => k.wert > 0);
  ks.forEach(k => { hol(k.von, k.sv).aus += k.wert; hol(k.nach, k.sn).ein += k.wert; });
  const hoehen = (k: Knoten) => Math.max(k.ein, k.aus);
  const total = Math.max(1, ...spalten.map(c => c.reduce((s, k) => s + hoehen(k), 0)));
  const f = (H - 24 - luecke * Math.max(...spalten.map(c => c.length))) / total;
  const xs = [rand, W / 2 - knotenB / 2, W - rand - knotenB];
  spalten.forEach((c, s) => { const sum = c.reduce((a, k) => a + hoehen(k) * f, 0) + luecke * (c.length - 1); let yy = (H - sum) / 2; c.forEach(k => { k.x = xs[s]; k.y = yy; k.h = Math.max(2, hoehen(k) * f); k.oy = k.y; k.iy = k.y; yy += k.h + luecke; }); });
  const blur = verbergen ? { filter: 'blur(5px)' } : {};
  const pfade: ReactNode[] = [];
  ks.forEach((k, i) => {
    const a = knoten[k.von], b = knoten[k.nach], h = Math.max(1, k.wert * f); const y1 = a.oy + h / 2, y2 = b.iy + h / 2; a.oy += h; b.iy += h;
    const x1 = a.x + knotenB, x2 = b.x, m = (x1 + x2) / 2;
    pfade.push(<path key={i} d={`M${x1},${y1} C${m},${y1} ${m},${y2} ${x2},${y2}`} stroke={k.farbe} strokeOpacity={0.38} strokeWidth={h} fill="none"><title>{`${k.von} → ${k.nach}${verbergen ? '' : `: ${eur(k.wert)} €`}`}</title></path>);
  });
  return (
    <div ref={ref} style={{ width: '100%', overflow: 'hidden' }}>
      {W > 0 && ks.length > 0 && (
        <svg width={W} height={H} style={{ display: 'block' }} aria-hidden>
          {pfade}
          {Object.values(knoten).map(k => {
            const rechts = k.s === 2, links = k.s === 0;
            const tx = links ? k.x - 8 : rechts ? k.x + knotenB + 8 : k.x + knotenB / 2; const an = links ? 'end' : rechts ? 'start' : 'middle'; const ty = k.s === 1 ? k.y - 8 : k.y + k.h / 2 + 4;
            return (
              <g key={k.n}>
                <rect x={k.x} y={k.y} width={knotenB} height={k.h} rx={2} fill={C.inkDim} />
                <text x={tx} y={ty} fill={C.ink} fontSize={schmal ? 11 : 12} textAnchor={an} fontFamily={SCHRIFT.text}>{k.n}<tspan fill={C.inkDim} fontSize="11" style={blur}> {eur(hoehen(k))}</tspan></text>
              </g>
            );
          })}
        </svg>
      )}
      {W > 0 && !ks.length && <div style={{ padding: 20, color: C.inkLeise, fontSize: 13 }}>Für diesen Monat fließt noch nichts.</div>}
    </div>
  );
}

/** Kleiner Verlauf ohne Achsen — für Ziele und Kacheln. */
export function MiniLinie({ werte, ziel, farbe, hoehe = 110 }: { werte: number[]; ziel?: number; farbe: string; hoehe?: number }) {
  const [ref, W] = useBreite<HTMLDivElement>();
  const alle = [...werte, ...(ziel != null ? [ziel] : [])];
  const mn = Math.min(0, ...alle); let mx = Math.max(...alle); if (mx === mn) mx = mn + 1;
  const n = Math.max(2, werte.length);
  const x = (i: number) => (i * (W - 4)) / (n - 1) + 2, y = (v: number) => 4 + ((mx - v) * (hoehe - 8)) / (mx - mn);
  return (
    <div ref={ref} style={{ width: '100%' }}>
      {W > 0 && (
        <svg width={W} height={hoehe} style={{ display: 'block' }} aria-hidden>
          {ziel != null && <line x1={0} x2={W} y1={y(ziel)} y2={y(ziel)} stroke={C.inkLeise} strokeDasharray="3 4" />}
          <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="rgba(255,255,255,.1)" />
          <path d={werte.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('')} fill="none" stroke={farbe} strokeWidth={2} strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}
