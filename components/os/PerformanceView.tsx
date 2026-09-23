'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { THEME as T } from '@/lib/make-one/os-data';
import { FARBE as C, TYP, SCHRIFT, ABSTAND as A, RADIUS } from '@/lib/make-one/design';
import { Held } from './Held';
import type { PerfIndex, Saeule } from '@/lib/performance';

interface Snapshot { date: string; index: number | null; saeulen: Record<string, number | null>; abdeckung: number }
interface Hebel { saeule?: string; warum?: string; schritt?: string }
interface Analyse { lage?: string; hebel?: Hebel; staerke?: string; messluecke?: string }

const lbl = { fontFamily: T.mono, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: T.muted };
const panel = { background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14 };
const col = (v: number | null) => (v == null ? T.muted : v >= 70 ? T.accent : v >= 45 ? T.amber : T.crit);

function Ring({ v, size = 132 }: { v: number | null; size?: number }) {
  const r = size / 2 - 10, C = 2 * Math.PI * r, off = C * (1 - (v ?? 0) / 100);
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: '0 0 auto' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="8" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col(v)} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={C.toFixed(1)} strokeDashoffset={off.toFixed(1)} transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset .6s' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: T.mono, fontSize: size * 0.3, fontWeight: 700, color: T.ink, lineHeight: 1 }}>{v ?? '—'}</span>
        <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, marginTop: 2 }}>INDEX</span>
      </div>
    </div>
  );
}

/** Verlauf: Index als Hero-Linie + Säulen zuschaltbar. Farben folgen den
 *  Säulen-Identitäten; NUR Finanzen ist im Chart auf Kupfer re-gestept —
 *  das Säulen-Teal war vom Planungs-Teal nicht unterscheidbar (validiert:
 *  ΔE 5,5 → jetzt 20,4; CVD 9,4). Eine Achse (0–100), Hover-Fadenkreuz. */
const REIHEN: { key: string; label: string; farbe: string }[] = [
  { key: 'index', label: 'Index', farbe: '#E8EFED' },
  { key: 'health', label: 'Gesundheit', farbe: '#58D9CD' },
  { key: 'business', label: 'Business', farbe: '#4A6CF7' },
  { key: 'planning', label: 'Planung', farbe: '#58D9CD' },
  { key: 'finance', label: 'Finanzen', farbe: '#DE9E63' },
  { key: 'social', label: 'Beziehung', farbe: '#C77DFF' },
];

function Verlauf({ data }: { data: Snapshot[] }) {
  const [aktiv, setAktiv] = useState<Set<string>>(new Set(['index', 'health']));
  const [hover, setHover] = useState<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const pts = data.filter(d => d.index != null).slice(-60);

  if (pts.length < 2) {
    return <div style={{ fontSize: 12.5, color: T.muted, padding: '18px 0' }}>Ab dem zweiten Tag siehst du hier die Bewegung — jeder Tag legt automatisch einen Punkt an.</div>;
  }

  const w = 640, h = 200;
  const x = (i: number) => (i / (pts.length - 1)) * w;
  const y = (v: number) => h - (v / 100) * h;
  const wert = (p: Snapshot, key: string): number | null =>
    key === 'index' ? (p.index as number) : (p.saeulen?.[key] ?? null);
  const pfad = (key: string) => {
    let d = '', offen = false;
    pts.forEach((p, i) => {
      const v = wert(p, key);
      if (v == null) { offen = false; return; }
      d += `${offen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      offen = true;
    });
    return d;
  };
  const toggle = (key: string) => setAktiv(prev => {
    const n = new Set(prev);
    if (n.has(key)) { if (n.size > 1) n.delete(key); } else n.add(key);
    return n;
  });
  const mausBewegt = (e: React.MouseEvent) => {
    const r = boxRef.current?.getBoundingClientRect();
    if (!r) return;
    const frac = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    setHover(Math.round(frac * (pts.length - 1)));
  };
  const letzterIdx = pts[pts.length - 1].index as number;
  const diff = letzterIdx - (pts[0].index as number);
  const hp = hover != null ? pts[hover] : null;

  return (
    <div>
      {/* Legende: klick schaltet die Reihe — Identität nie über Farbe allein */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {REIHEN.map(rh => (
          <button key={rh.key} onClick={() => toggle(rh.key)}
            style={{ fontFamily: T.mono, fontSize: 11, cursor: 'pointer', borderRadius: 7, padding: '3px 9px', display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${aktiv.has(rh.key) ? `${rh.farbe}88` : T.line}`, background: aktiv.has(rh.key) ? `${rh.farbe}14` : 'transparent', color: aktiv.has(rh.key) ? T.ink : T.muted }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: rh.farbe, opacity: aktiv.has(rh.key) ? 1 : 0.35 }} />{rh.label}
          </button>
        ))}
      </div>

      <div ref={boxRef} style={{ position: 'relative' }} onMouseMove={mausBewegt} onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 200, display: 'block' }} preserveAspectRatio="none" role="img" aria-label="Score-Verlauf">
          {[0, 25, 50, 75, 100].map(g => <line key={g} x1={0} x2={w} y1={y(g)} y2={y(g)} stroke="rgba(255,255,255,.05)" />)}
          {hover != null && <line x1={x(hover)} x2={x(hover)} y1={0} y2={h} stroke="rgba(232,239,237,.25)" vectorEffect="non-scaling-stroke" />}
          {REIHEN.filter(rh => aktiv.has(rh.key)).map(rh => (
            <g key={rh.key}>
              <path d={pfad(rh.key)} fill="none" stroke={rh.farbe} strokeWidth={rh.key === 'index' ? 2.5 : 2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" opacity={rh.key === 'index' ? 1 : 0.9} />
              {(() => { const v = wert(pts[pts.length - 1], rh.key); return v != null ? <circle cx={w} cy={y(v)} r="3.5" fill={rh.farbe} stroke={T.panel} strokeWidth="1.5" /> : null; })()}
              {hover != null && (() => { const v = wert(pts[hover], rh.key); return v != null ? <circle cx={x(hover)} cy={y(v)} r="3" fill={rh.farbe} stroke={T.panel} strokeWidth="1.5" /> : null; })()}
            </g>
          ))}
        </svg>
        {/* Y-Beschriftung (Text in Text-Tönen, nie in Serienfarbe) */}
        <div style={{ position: 'absolute', left: 2, top: 0, fontFamily: T.mono, fontSize: 11, color: T.muted }}>100</div>
        <div style={{ position: 'absolute', left: 2, bottom: 0, fontFamily: T.mono, fontSize: 11, color: T.muted }}>0</div>
        {/* Tooltip */}
        {hp && (
          <div style={{ position: 'absolute', top: 6, left: `${(hover! / (pts.length - 1)) * 100}%`, transform: hover! > pts.length / 2 ? 'translateX(calc(-100% - 10px))' : 'translateX(10px)', background: T.panel2, border: `1px solid ${T.line}`, borderRadius: 9, padding: '8px 11px', pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 2 }}>
            <div style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, marginBottom: 4 }}>{hp.date.slice(8)}.{hp.date.slice(5, 7)}.{hp.date.slice(0, 4)}</div>
            {REIHEN.filter(rh => aktiv.has(rh.key)).map(rh => {
              const v = wert(hp, rh.key);
              return v != null ? (
                <div key={rh.key} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: T.inkDim, lineHeight: 1.6 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 2, background: rh.farbe }} />{rh.label}
                  <span style={{ marginLeft: 'auto', fontFamily: T.mono, fontVariantNumeric: 'tabular-nums', color: T.ink, paddingLeft: 10 }}>{v}</span>
                </div>
              ) : null;
            })}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: T.mono, fontSize: 11, color: T.muted, marginTop: 6 }}>
        <span>{pts[0].date.slice(8)}.{pts[0].date.slice(5, 7)}.</span>
        <span style={{ color: diff > 0 ? T.accent : diff < 0 ? T.crit : T.muted }}>Index {diff > 0 ? '+' : ''}{diff} über {pts.length} Tage</span>
        <span>{pts[pts.length - 1].date.slice(8)}.{pts[pts.length - 1].date.slice(5, 7)}.</span>
      </div>

      {/* Tabellen-Sicht: dieselben Zahlen, ohne Farbe lesbar */}
      <details style={{ marginTop: 10 }}>
        <summary style={{ fontFamily: T.mono, fontSize: 11, color: T.accentInk, cursor: 'pointer', letterSpacing: '.08em', textTransform: 'uppercase' }}>Als Tabelle</summary>
        <div style={{ overflowX: 'auto', marginTop: 8 }}>
          <table style={{ borderCollapse: 'collapse', fontFamily: T.mono, fontSize: 11, color: T.inkDim, fontVariantNumeric: 'tabular-nums' }}>
            <thead><tr>{['Datum', ...REIHEN.map(rh => rh.label)].map(hcell => <th key={hcell} style={{ textAlign: 'right', padding: '4px 10px', color: T.muted, fontWeight: 400, borderBottom: `1px solid ${T.line}` }}>{hcell}</th>)}</tr></thead>
            <tbody>
              {[...pts].slice(-14).reverse().map(p => (
                <tr key={p.date}>
                  <td style={{ textAlign: 'right', padding: '3px 10px' }}>{p.date.slice(8)}.{p.date.slice(5, 7)}.</td>
                  {REIHEN.map(rh => <td key={rh.key} style={{ textAlign: 'right', padding: '3px 10px', color: T.ink }}>{wert(p, rh.key) ?? '—'}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function SaeulenKarte({ s, offen, onToggle }: { s: Saeule; offen: boolean; onToggle: () => void }) {
  const luecken = s.faktoren.filter(f => !f.echt).length;
  return (
    <div style={{ ...panel, overflow: 'hidden' }}>
      <div onClick={onToggle} style={{ display: 'flex', gap: 14, padding: '14px 18px', cursor: 'pointer', alignItems: 'center', background: offen ? T.panel2 : 'transparent' }}>
        <div style={{ width: 44, textAlign: 'center', flex: '0 0 auto' }}>
          <div style={{ fontFamily: T.mono, fontSize: 19, fontWeight: 700, color: col(s.score) }}>{s.score ?? '—'}</div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: T.ink }}>{s.label}</div>
          <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>
            Gewicht {Math.round(s.gewicht * 100)}% · {s.hinweis}
            {luecken > 0 && <span style={{ color: T.amber }}> · {luecken} Messlücke{luecken > 1 ? 'n' : ''}</span>}
            {s.zuDuenn && <span style={{ color: T.amber }}> · zählt noch nicht in den Index</span>}
          </div>
          {/* Balken zeigt Höhe, Transparenz zeigt Belastbarkeit */}
          <div style={{ height: 4, background: T.void, borderRadius: 3, marginTop: 7, overflow: 'hidden' }}>
            <div style={{ width: `${s.score ?? 0}%`, height: '100%', background: col(s.score), opacity: 0.35 + s.abdeckung * 0.65 }} />
          </div>
        </div>
        <Link href={`/os/saeule/${s.key}`} onClick={e => e.stopPropagation()} style={{ fontFamily: T.mono, fontSize: 11, color: T.accentInk, textDecoration: 'none', border: `1px solid ${T.line}`, borderRadius: 7, padding: '4px 10px', whiteSpace: 'nowrap', flex: '0 0 auto' }}>öffnen ›</Link>
        <span style={{ fontFamily: T.mono, fontSize: 13, color: T.muted, flex: '0 0 auto' }}>{offen ? '▾' : '▸'}</span>
      </div>

      {offen && (
        <div style={{ padding: '4px 18px 16px 62px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {s.faktoren.map((f, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'baseline', opacity: f.echt ? 1 : 0.6 }}>
              <span style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 700, color: f.echt ? col(f.wert) : T.muted, width: 34, flex: '0 0 auto', textAlign: 'right' }}>
                {f.echt ? f.wert : '—'}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, color: f.echt ? T.ink : T.muted }}>{f.label}</div>
                <div style={{ fontSize: 11.5, color: f.echt ? T.muted : T.amber, marginTop: 1, lineHeight: 1.4 }}>{f.quelle}</div>
              </div>
            </div>
          ))}
          <div style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, marginTop: 4, paddingTop: 8, borderTop: `1px solid ${T.lineSoft}` }}>
            Datenbasis {Math.round(s.abdeckung * 100)}% — nur gemessene Faktoren zählen in den Wert.
          </div>
        </div>
      )}
    </div>
  );
}

export function PerformanceView() {
  const [d, setD] = useState<{ aktuell: PerfIndex; verlauf: Snapshot[] } | null>(null);
  const [a, setA] = useState<Analyse | null>(null);
  const [busy, setBusy] = useState(false);
  const [offen, setOffen] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/performance').then(r => r.json()).then(setD).catch(() => {});
  }, []);

  async function analyse() {
    setBusy(true);
    try {
      const r = await fetch('/api/performance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ analyse: true }) });
      const j = await r.json();
      setD({ aktuell: j.aktuell, verlauf: j.verlauf ?? [] });
      setA({ lage: j.lage, hebel: j.hebel, staerke: j.staerke, messluecke: j.messluecke });
    } catch { /* still */ }
    setBusy(false);
  }

  const idx = d?.aktuell;

  return (
    <div style={{ minHeight: '100vh', background: T.void, color: T.ink, fontFamily: T.sans }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '26px clamp(16px,3vw,36px) 56px' }}>
        <Link href="/os" style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, textDecoration: 'none', display: 'inline-block', marginBottom: 8 }}>‹ Übersicht</Link>

        {!idx ? (
          <div style={{ fontFamily: T.mono, fontSize: 12, color: T.muted, marginTop: 20 }}>rechne …</div>
        ) : (
          <>
            {/* ── Der Held (UX 5, 06.09.) ─────────────────────────────────────
                Vorher: Rubrik, Überschrift, Erklärabsatz und erst danach der
                Ring — vier Ebenen, bevor die Zahl kam. Jetzt steht die Zahl
                zuerst und sagt in einem Satz, woran sie hängt. */}
            <Held
              ring={idx.index}
              wert={String(idx.index)}
              label="Index"
              satz={<>
                {idx.label}.{' '}
                {idx.hebel ? <>Größter Hebel ist <b style={{ color: C.aktiv }}>{idx.hebel}</b>.</>
                  : 'Alle fünf Säulen tragen gleich.'}
              </>}
              neben={[{
                label: 'aus echten Daten',
                wert: `${Math.round(idx.abdeckung * 100)} %`,
                farbe: idx.abdeckung >= 0.6 ? C.gut : C.achtung,
              }]}
              kinder={
                <button onClick={analyse} disabled={busy} style={{
                  fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 700, padding: `9px ${A.l}px`, minHeight: 36,
                  borderRadius: RADIUS.bauteil, border: 'none', cursor: busy ? 'default' : 'pointer',
                  background: busy ? C.linie : C.gut, color: busy ? C.inkLeise : C.grund,
                }}>{busy ? 'ordne ein …' : 'Lage einordnen'}</button>
              }
            />

            {/* Einordnung */}
            {a?.lage && (
              <div style={{ ...panel, padding: '16px 20px', marginBottom: 14 }}>
                <div style={{ ...lbl, marginBottom: 6 }}>Einordnung</div>
                <div style={{ fontSize: 14, color: T.ink, lineHeight: 1.55 }}>{a.lage}</div>
                {a.hebel?.saeule && (
                  <div style={{ marginTop: 12, background: T.panel2, border: `1px solid ${T.accent}44`, borderRadius: 10, padding: '11px 14px' }}>
                    <div style={{ ...lbl, color: T.accent, marginBottom: 4 }}>Hebel · {a.hebel.saeule}</div>
                    {a.hebel.warum && <div style={{ fontSize: 13, color: T.inkDim, lineHeight: 1.5 }}>{a.hebel.warum}</div>}
                    {a.hebel.schritt && <div style={{ fontSize: 13.5, color: T.ink, marginTop: 6 }}>→ {a.hebel.schritt}</div>}
                  </div>
                )}
                {a.staerke && <div style={{ fontSize: 12.5, color: T.accentInk, marginTop: 10 }}>◇ {a.staerke}</div>}
                {a.messluecke && <div style={{ fontSize: 12.5, color: T.amber, marginTop: 6 }}>⚠ {a.messluecke}</div>}
              </div>
            )}

            {/* Messlücken — der kürzeste Weg zu einem ehrlichen Index */}
            {(() => {
              const luecken = idx.saeulen.flatMap(s2 =>
                s2.faktoren.filter(f => !f.echt).map(f => ({ saeule: s2.label, key: s2.key, label: f.label, quelle: f.quelle }))
              );
              if (!luecken.length) return null;
              const ziel = (k: string) =>
                k === 'health' ? '/os/gesundheit'
                : k === 'business' ? '/os/controlling'
                : k === 'finance' ? '/os/saeule/finance'
                : k === 'social' ? '/os/journal'
                : '/os/aufgaben';
              return (
                <div style={{ ...panel, borderColor: `${T.amber}44`, padding: '16px 20px', marginBottom: 14 }}>
                  <div style={{ ...lbl, color: T.amber, marginBottom: 4 }}>Messlücken ({luecken.length})</div>
                  <div style={{ fontSize: 12.5, color: T.inkDim, marginBottom: 12, lineHeight: 1.5 }}>
                    Das sind keine schlechten Werte — das sind Stellen, an denen das System dich noch nicht messen kann.
                    Jede geschlossene Lücke macht den Index ehrlicher.
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {luecken.map((l, i) => (
                      <Link key={i} href={ziel(l.key)} style={{ display: 'flex', gap: 10, alignItems: 'baseline', textDecoration: 'none', flexWrap: 'wrap' }}>
                        <span style={{ color: T.amber, flex: '0 0 auto' }}>→</span>
                        <span style={{ fontSize: 13, color: T.ink }}>{l.label}</span>
                        <span style={{ fontSize: 11.5, color: T.muted }}>{l.saeule} · {l.quelle}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Verlauf */}
            <div style={{ ...panel, padding: '16px 20px', marginBottom: 14 }}>
              <div style={{ ...lbl, marginBottom: 8 }}>Verlauf</div>
              <Verlauf data={d.verlauf ?? []} />
            </div>

            {/* Säulen */}
            <div style={{ ...lbl, marginBottom: 9 }}>Die fünf Säulen — aufklappen für die Rechnung</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {idx.saeulen.map(s => (
                <SaeulenKarte key={s.key} s={s} offen={offen === s.key} onToggle={() => setOffen(offen === s.key ? null : s.key)} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
