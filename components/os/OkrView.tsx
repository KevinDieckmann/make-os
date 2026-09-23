'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { THEME as T } from '@/lib/make-one/os-data';
import { DEFAULT_FINANCE, computeMetrics, eur, type FinanceState } from '@/lib/make-one/finance-data';
import { Seitenkopf } from './Seitenkopf';

interface Objective { titel: string; warum?: string; keyResults?: string[]; hebelTasks?: string[]; luecke?: string; }
interface TaskLite { title: string; status?: string; priority?: string; description?: string; }

const lbl = { fontFamily: T.mono, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: T.muted };
const panel = { background: 'linear-gradient(165deg, #1A2024 0%, #12171A 100%)', border: 'none', borderRadius: 20, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06), 0 12px 32px rgba(0,0,0,.35)' };

export function OkrView() {
  const [fin, setFin] = useState<FinanceState>(DEFAULT_FINANCE);
  const [tasks, setTasks] = useState<TaskLite[]>([]);
  const [lage, setLage] = useState('');
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/state/finance').then(r => r.json()).catch(() => ({ state: null })),
      fetch('/api/state/tasks').then(r => r.json()).catch(() => ({ state: null })),
    ]).then(([f, t]) => {
      if (f.state?.months?.length === 12) setFin(f.state);
      const list: TaskLite[] = (t.state?.tasks ?? []).filter((x: TaskLite) => x.status !== 'done').map((x: { title: string; status?: string; priority?: string; description?: string }) => ({ title: x.title, status: x.status, priority: x.priority, description: x.description }));
      setTasks(list);
      setReady(true);
    });
  }, []);

  const m = computeMetrics(fin);
  const pct = Math.min(100, Math.round(m.fortschritt * 100));

  async function build() {
    setBusy(true);
    try {
      const r = await fetch('/api/okr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ finance: fin, tasks }) });
      const d = await r.json();
      setLage(d.lage ?? ''); setObjectives(d.objectives ?? []);
    } catch { setLage('Analyse gerade nicht möglich.'); }
    setBusy(false);
  }

  return (
    <div style={{ minHeight: '100vh', background: T.void, color: T.ink, fontFamily: T.sans }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '30px clamp(18px,4vw,48px) 72px' }}>
        <Link href="/os/agenten" style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, textDecoration: 'none', display: 'inline-block', marginBottom: 8 }}>‹ Agenten</Link>
          <Seitenkopf
            rubrik={<>OKR-/Ziel-Agent <span style={{ fontFamily: T.mono, fontSize: 11, color: T.accentInk, border: `1px solid ${T.accentInk}55`, borderRadius: 5, padding: '2px 7px' }}>live · Vorschlag</span></>}
            titel={<>Der Weg auf 1 Mio.</>}
            satz={<>Der Agent klammert deinen Nordstern mit den echten Controlling-Zahlen und deinen Aufgaben zusammen — Objectives, Key Results, welche Aufgabe einzahlt und <b style={{ color: T.ink }}>wo eine Lücke klafft</b>.</>}
          />

        {/* Nordstern */}
        <div style={{ ...panel, borderTop: `2px solid ${T.accent}`, padding: '18px 22px', margin: '18px 0 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 6 }}>
            <div style={lbl}>Nordstern · KD Ventures</div>
            <div style={{ fontFamily: T.mono, fontSize: 12, color: T.muted }}>{eur(m.istUmsatz)} / {eur(fin.zielUmsatz)} · Gewinnziel {eur(fin.zielGewinn)}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '6px 0 10px' }}>
            <div style={{ fontSize: 30, fontWeight: 800, color: T.accent }}>{pct}%</div>
            <div style={{ fontSize: 13, color: T.inkDim }}>1 Mio € Umsatz → min. 300k € für dich & Malin</div>
          </div>
          <div style={{ height: 9, background: T.void, borderRadius: 6, overflow: 'hidden', border: `1px solid ${T.line}` }}>
            <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg, ${T.accent}, ${T.accentInk})` }} />
          </div>
        </div>

        <button onClick={build} disabled={busy || !ready} style={{ fontFamily: T.sans, fontSize: 13.5, fontWeight: 700, padding: '11px 20px', borderRadius: 9, border: 'none', cursor: busy || !ready ? 'default' : 'pointer', background: busy || !ready ? T.line : T.accent, color: busy || !ready ? T.muted : '#04110F', marginBottom: 18 }}>
          {busy ? 'baue den Zielbaum …' : objectives.length ? 'Neu berechnen' : 'Zielbaum bauen'}
        </button>
        <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, marginLeft: 12 }}>{ready ? `${tasks.length} offene Aufgaben · ${m.aktiveMonate > 0 ? 'Zahlen da' : 'Controlling leer'}` : 'lade …'}</span>

        {/* Lage */}
        {lage && (
          <div style={{ ...panel, padding: '15px 20px', marginBottom: 16 }}>
            <div style={{ ...lbl, marginBottom: 6 }}>Lage zum Nordstern</div>
            <div style={{ fontSize: 14, color: T.ink, lineHeight: 1.55 }}>{lage}</div>
          </div>
        )}

        {/* Objectives */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {objectives.map((o, i) => (
            <div key={i} style={{ ...panel, padding: '16px 20px' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                <span style={{ fontFamily: T.mono, fontSize: 12, color: T.accent, fontWeight: 700 }}>O{i + 1}</span>
                <div style={{ fontSize: 16, fontWeight: 700, color: T.ink }}>{o.titel}</div>
              </div>
              {o.warum && <div style={{ fontSize: 12.5, color: T.muted, marginTop: 3, marginLeft: 26 }}>{o.warum}</div>}

              {!!o.keyResults?.length && (
                <div style={{ marginTop: 12, marginLeft: 26 }}>
                  <div style={{ ...lbl, marginBottom: 5 }}>Key Results</div>
                  {o.keyResults.map((k, j) => (
                    <div key={j} style={{ display: 'flex', gap: 8, fontSize: 13, color: T.inkDim, lineHeight: 1.5, marginTop: 3 }}><span style={{ color: T.accentInk }}>◇</span>{k}</div>
                  ))}
                </div>
              )}

              {!!o.hebelTasks?.length && (
                <div style={{ marginTop: 12, marginLeft: 26 }}>
                  <div style={{ ...lbl, marginBottom: 6 }}>Zahlt ein (deine Aufgaben)</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {o.hebelTasks.map((t, j) => (
                      <span key={j} style={{ fontSize: 11.5, color: T.accent, background: `${T.accent}14`, border: `1px solid ${T.accent}44`, borderRadius: 6, padding: '3px 9px' }}>✓ {t}</span>
                    ))}
                  </div>
                </div>
              )}

              {o.luecke && (
                <div style={{ marginTop: 12, marginLeft: 26, display: 'flex', gap: 8, background: T.panel2, border: `1px solid ${T.amber}44`, borderRadius: 9, padding: '9px 12px' }}>
                  <span style={{ color: T.amber, flex: '0 0 auto' }}>⚠</span>
                  <div style={{ fontSize: 12.5, color: T.inkDim, lineHeight: 1.5 }}><b style={{ color: T.amber }}>Lücke: </b>{o.luecke}</div>
                </div>
              )}
            </div>
          ))}
        </div>

        {objectives.length === 0 && !busy && lage === '' && (
          <div style={{ ...panel, padding: '22px', textAlign: 'center', color: T.inkDim, fontSize: 13.5, lineHeight: 1.5 }}>
            „Zielbaum bauen" — der Agent zerlegt die 1 Mio in Objectives, ordnet deine Aufgaben zu und zeigt, wo noch nichts einzahlt.
          </div>
        )}
      </div>
    </div>
  );
}
