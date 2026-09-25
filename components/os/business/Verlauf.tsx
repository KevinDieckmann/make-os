'use client';

// ─── Business-Index — Verlauf (90 Tage) ─────────────────────────────────────
// Index und die drei Säulen als Linien über die Zeit, mit den Bändern
// Kritisch · Verbesserungsfähig · Solide · Souverän im Hintergrund. Fahren
// über einen Tag zeigt alle Werte dieses Tages. Die Daten entstehen durch den
// täglichen Schnappschuss — am Anfang ist der Verlauf kurz, das steht dabei.

import { useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift } from '../schlank';
import { SAEULE_FARBE } from './teile';

export interface VerlaufPunkt { tag: string; index: number | null; saeulen: Record<string, number | null> }

const SERIEN = [
  { id: 'index', label: 'Index', farbe: C.ink, dick: 2.6 },
  { id: 'fh', label: 'Finanzielle Gesundheit', farbe: SAEULE_FARBE.fh, dick: 1.8 },
  { id: 'ud', label: 'Unternehmer-DNA', farbe: SAEULE_FARBE.ud, dick: 1.8 },
  { id: 'mt', label: 'Markttraktion', farbe: SAEULE_FARBE.mt, dick: 1.8 },
] as const;
const BAENDER = [{ ab: 80, label: 'Souverän' }, { ab: 60, label: 'Solide' }, { ab: 40, label: 'Verbesserungsfähig' }];

const W = 1000, H = 230, L = 34, R = 18, O = 12, U = 28;
const tagKurz = (t: string) => `${t.slice(8)}.${t.slice(5, 7)}.`;

export function VerlaufKarte({ punkte }: { punkte: VerlaufPunkt[] }) {
  const [zeige, setZeige] = useState<number | null>(null);
  const n = punkte.length;
  const x = (i: number) => (n <= 1 ? L + (W - L - R) / 2 : L + (i / (n - 1)) * (W - L - R));
  const y = (v: number) => O + (1 - v / 100) * (H - O - U);
  const wert = (p: VerlaufPunkt, id: string) => (id === 'index' ? p.index : p.saeulen?.[id] ?? null);
  const pfad = (id: string) => {
    let d = '', offen = false;
    punkte.forEach((p, i) => {
      const v = wert(p, id);
      if (v == null) { offen = false; return; }
      d += `${offen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
      offen = true;
    });
    return d.trim();
  };
  const ticks = n <= 1 ? [0] : Array.from(new Set([0, Math.round((n - 1) / 2), n - 1]));
  const aktiv = zeige != null ? punkte[zeige] : null;

  return (
    <Karte i={4}>
      <Ueberschrift rechts={n ? <span>seit {tagKurz(punkte[0].tag)} · {n} Tag{n === 1 ? '' : 'e'}</span> : undefined}>Verlauf</Ueberschrift>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 8 }}>
        {SERIEN.map(s => (
          <span key={s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: C.inkDim }}>
            <span aria-hidden style={{ width: 16, height: s.id === 'index' ? 3 : 2, borderRadius: 2, background: s.farbe }} />{s.label}
          </span>
        ))}
      </div>
      <div style={{ position: 'relative' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Verlauf des Business-Index und seiner drei Säulen">
          {BAENDER.map(b => (
            <g key={b.ab}>
              <line x1={L} x2={W - R} y1={y(b.ab)} y2={y(b.ab)} stroke="rgba(255,255,255,.06)" strokeDasharray="4 6" />
              <text x={L - 6} y={y(b.ab) + 4} textAnchor="end" fontSize="12" fill={C.inkLeise}>{b.ab}</text>
            </g>
          ))}
          <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} stroke="rgba(255,255,255,.08)" />
          {ticks.map(i => <text key={i} x={x(i)} y={H - 8} textAnchor={n > 1 && i === 0 ? 'start' : n > 1 && i === n - 1 ? 'end' : 'middle'} fontSize="12" fill={C.inkLeise}>{tagKurz(punkte[i].tag)}</text>)}
          {SERIEN.slice().reverse().map(s => (
            <g key={s.id}>
              {n > 1 && <path d={pfad(s.id)} fill="none" stroke={s.farbe} strokeWidth={s.dick} strokeLinejoin="round" strokeLinecap="round" opacity={s.id === 'index' ? 1 : 0.85} />}
              {punkte.map((p, i) => {
                const v = wert(p, s.id);
                const letzte = i === n - 1;
                return v != null && (letzte || n === 1) ? <circle key={i} cx={x(i)} cy={y(v)} r={s.id === 'index' ? 4.5 : 3.5} fill={s.farbe} stroke={C.flaeche} strokeWidth="2" /> : null;
              })}
            </g>
          ))}
          {aktiv && zeige != null && <line x1={x(zeige)} x2={x(zeige)} y1={O} y2={H - U} stroke="rgba(255,255,255,.18)" />}
          {punkte.map((_, i) => {
            const breite = n <= 1 ? W - L - R : (W - L - R) / (n - 1);
            return <rect key={i} x={x(i) - breite / 2} y={O} width={breite} height={H - O - U} fill="transparent" onMouseEnter={() => setZeige(i)} onMouseLeave={() => setZeige(null)} />;
          })}
        </svg>
        {aktiv && zeige != null && (
          <div style={{ position: 'absolute', top: 6, left: `min(max(${(x(zeige) / W) * 100}% - 90px, 0px), calc(100% - 190px))`, width: 180, pointerEvents: 'none', background: C.flaecheHoch, border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, padding: '8px 10px', fontSize: 12.5, color: C.ink, boxShadow: '0 10px 30px -10px rgba(0,0,0,.7)' }}>
            <div style={{ color: C.inkDim, marginBottom: 4 }}>{tagKurz(aktiv.tag)}</div>
            {SERIEN.map(s => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontVariantNumeric: 'tabular-nums' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: C.inkDim }}><span style={{ width: 8, height: 2, background: s.farbe }} />{s.id === 'index' ? 'Index' : s.label.split(' ')[0]}</span>
                <b>{wert(aktiv, s.id) ?? '—'}</b>
              </div>
            ))}
          </div>
        )}
      </div>
      {n < 7 && <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 6 }}>Der Verlauf füllt sich jeden Tag von selbst — ab etwa einer Woche zeigt er eine Richtung.</div>}
    </Karte>
  );
}
