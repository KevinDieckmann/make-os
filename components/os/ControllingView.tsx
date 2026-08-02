'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { THEME as T } from '@/lib/make-one/os-data';
import { wertVon, STANDARD_MODUS } from '@/lib/make-one/kompass-data';
import {
  DEFAULT_FINANCE, MONTHS_DE, computeMetrics, eur,
  type FinanceState,
} from '@/lib/make-one/finance-data';

interface Analysis { briefing: string; fokus?: string[]; risiken?: string[]; }

const lbl = { fontFamily: T.mono, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: T.muted };
const panel = { background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14 };
const num = (v: string) => Math.max(0, Math.round(Number(v.replace(/[^\d]/g, '')) || 0));

function Kpi({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ ...panel, padding: '12px 16px', minWidth: 150, flex: 1 }}>
      <div style={lbl}>{label}</div>
      <div style={{ fontSize: 21, fontWeight: 700, color: color ?? T.ink, marginTop: 3 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: T.muted, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export function ControllingView() {
  const [s, setS] = useState<FinanceState>(DEFAULT_FINANCE);
  const [loaded, setLoaded] = useState(false);
  // Runway-Grenze kommt aus dem Kompass — eine Zahl für die ganze Software.
  const [runwayRot, setRunwayRot] = useState(3);
  useEffect(() => {
    fetch('/api/state/kompass').then(r => r.json())
      .then(d => setRunwayRot(wertVon('runway-warnung', d.modus ?? STANDARD_MODUS, d.eigene ?? {})))
      .catch(() => {});
  }, []);
  const [a, setA] = useState<Analysis | null>(null);
  const [busy, setBusy] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Konnte der Stand nicht geladen werden, wird NICHT gespeichert — sonst
  // würde eine einzige Eingabe die zwölf Monatszahlen mit Nullen überschreiben.
  const [ladeFehler, setLadeFehler] = useState(false);
  useEffect(() => {
    fetch('/api/state/finance')
      .then(r => { if (!r.ok) throw new Error(`Status ${r.status}`); return r.json(); })
      .then((d: { state: FinanceState | null }) => {
        if (d.state && Array.isArray(d.state.months) && d.state.months.length === 12) setS(d.state);
        setLoaded(true);
      })
      .catch(err => {
        console.error('[MAKE OS] Controlling konnte nicht geladen werden — Speichern gesperrt.', err);
        setLadeFehler(true);
        setLoaded(true);
      });
  }, []);

  function persist(next: FinanceState) {
    setS(next);
    if (ladeFehler) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch('/api/state/finance', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) }).catch(() => {});
    }, 500);
  }
  const setMonth = (i: number, field: 'umsatz' | 'kosten', v: string) =>
    persist({ ...s, months: s.months.map((r, j) => j === i ? { ...r, [field]: num(v) } : r) });
  const setField = (field: 'zielUmsatz' | 'zielGewinn' | 'cash', v: string) => persist({ ...s, [field]: num(v) });

  const m = useMemo(() => computeMetrics(s), [s]);
  const pct = Math.min(100, Math.round(m.fortschritt * 100));
  const maxBar = Math.max(m.runRateNoetig, ...s.months.map(r => r.umsatz), 1);

  async function analyse() {
    setBusy(true);
    try {
      const r = await fetch('/api/controlling/analyse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state: s }) });
      const d = await r.json();
      setA({ briefing: d.briefing ?? '', fokus: d.fokus ?? [], risiken: d.risiken ?? [] });
    } catch { setA({ briefing: 'Analyse gerade nicht möglich.' }); }
    setBusy(false);
  }

  const runRateColor = m.runRateAktuell >= m.runRateNoetig ? T.accent : m.aktiveMonate > 0 ? T.amber : T.muted;

  return (
    <div style={{ minHeight: '100vh', background: T.void, color: T.ink, fontFamily: T.sans }}>
      <div style={{ maxWidth: 940, margin: '0 auto', padding: '26px clamp(16px,3vw,36px) 56px' }}>
        <Link href="/os/agenten" style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, textDecoration: 'none', display: 'inline-block', marginBottom: 8 }}>‹ Agenten</Link>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <div style={lbl}>Controlling-Agent</div>
          <span style={{ fontFamily: T.mono, fontSize: 9.5, color: T.accent, border: `1px solid ${T.accent}55`, borderRadius: 5, padding: '2px 7px' }}>live · autonom</span>
        </div>
        <h1 style={{ fontSize: 25, fontWeight: 600, letterSpacing: '-.02em', margin: '6px 0 4px' }}>Kurs auf 1 Mio €.</h1>
        <p style={{ fontSize: 13.5, color: T.inkDim, maxWidth: 680, lineHeight: 1.5 }}>KD Ventures → 1 Mio € Umsatz, min. 300k € Gewinn für dich & Malin. Trag deine Ist-Zahlen ein — Fortschritt, nötige Run-Rate und Runway rechnen sich live. Der Agent gibt den Lagebericht.</p>

        {/* Ziel-Fortschritt */}
        <div style={{ ...panel, borderTop: `2px solid ${T.accent}`, padding: '18px 22px', margin: '18px 0 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
            <div style={lbl}>Umsatz {s.jahr} gegen Ziel</div>
            <div style={{ fontFamily: T.mono, fontSize: 12, color: T.muted }}>{eur(m.istUmsatz)} / {eur(s.zielUmsatz)}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '6px 0 10px' }}>
            <div style={{ fontSize: 34, fontWeight: 800, color: T.accent, letterSpacing: '-.02em' }}>{pct}%</div>
            <div style={{ fontSize: 13, color: T.inkDim }}>· noch {eur(m.verbleibend)}</div>
          </div>
          <div style={{ height: 10, background: T.void, borderRadius: 6, overflow: 'hidden', border: `1px solid ${T.line}` }}>
            <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg, ${T.accent}, ${T.accentInk})`, transition: 'width .4s' }} />
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          <Kpi label="Run-Rate nötig" value={`${eur(m.runRateNoetig)}`} sub={`/Monat · ${m.restMonate} Monate übrig`} />
          <Kpi label="Run-Rate aktuell" value={m.aktiveMonate > 0 ? `${eur(m.runRateAktuell)}` : '—'} sub={m.aktiveMonate > 0 ? `Ø aus ${m.aktiveMonate} Monaten` : 'keine Ist-Zahlen'} color={runRateColor} />
          <Kpi label="Gewinn" value={m.aktiveMonate > 0 ? `${eur(m.istGewinn)}` : '—'} sub={`Ziel ${eur(s.zielGewinn)}`} color={m.istGewinn >= 0 ? T.ink : T.crit} />
          <Kpi label="Runway" value={m.runwayMonate != null ? `${m.runwayMonate.toFixed(1)} Mon.` : '—'} sub={m.runwayMonate != null ? `bei Ø Burn ${eur(m.avgBurn)}` : 'kein Burn/Cash'} color={m.runwayMonate != null && m.runwayMonate < runwayRot ? T.crit : T.ink} />
        </div>

        {/* Analyse */}
        <button onClick={analyse} disabled={busy} style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 700, padding: '10px 18px', borderRadius: 9, border: 'none', cursor: busy ? 'default' : 'pointer', background: busy ? T.line : T.accent, color: busy ? T.muted : '#04110F', marginBottom: 16 }}>
          {busy ? 'analysiere Lage …' : 'Lage analysieren'}
        </button>

        {a && (
          <div style={{ ...panel, borderTop: `2px solid ${T.accent}`, padding: '16px 20px', marginBottom: 18 }}>
            <div style={{ ...lbl, marginBottom: 6 }}>Lagebericht</div>
            <div style={{ fontSize: 14, color: T.ink, lineHeight: 1.55 }}>{a.briefing}</div>
            {!!a.fokus?.length && (
              <div style={{ marginTop: 12 }}>
                <div style={{ ...lbl, marginBottom: 5 }}>Fokus diesen Monat</div>
                {a.fokus.map((f, i) => <div key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: T.inkDim, lineHeight: 1.5, marginTop: 2 }}><span style={{ color: T.accent }}>›</span>{f}</div>)}
              </div>
            )}
            {!!a.risiken?.length && (
              <div style={{ marginTop: 12 }}>
                <div style={{ ...lbl, color: T.amber, marginBottom: 5 }}>Risiken</div>
                {a.risiken.map((f, i) => <div key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: T.inkDim, lineHeight: 1.5, marginTop: 2 }}><span style={{ color: T.amber }}>⚠</span>{f}</div>)}
              </div>
            )}
          </div>
        )}

        {/* Monats-Balken */}
        <div style={{ ...panel, padding: '16px 20px', marginBottom: 14 }}>
          <div style={{ ...lbl, marginBottom: 12 }}>Umsatz je Monat · <span style={{ color: T.amber }}>Linie = nötige Run-Rate {eur(m.runRateNoetig)}</span></div>
          <div style={{ display: 'flex', gap: 5, alignItems: 'flex-end', height: 120, position: 'relative' }}>
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: `${(m.runRateNoetig / maxBar) * 100}%`, borderTop: `1px dashed ${T.amber}88`, zIndex: 1 }} />
            {s.months.map((r, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
                <div style={{ width: '100%', height: `${(r.umsatz / maxBar) * 100}%`, minHeight: r.umsatz > 0 ? 3 : 0, background: r.umsatz >= m.runRateNoetig && r.umsatz > 0 ? T.accent : T.accentInk, borderRadius: '3px 3px 0 0', opacity: r.umsatz > 0 ? 1 : 0.15 }} />
                <span style={{ fontFamily: T.mono, fontSize: 9, color: i === m.aktMonatIdx ? T.accent : T.muted }}>{r.m}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Eingabe */}
        <details style={{ ...panel, padding: '14px 18px', marginBottom: 14 }} open={loaded && m.aktiveMonate === 0}>
          <summary style={{ cursor: 'pointer', fontFamily: T.mono, fontSize: 11, color: T.accentInk, letterSpacing: '.08em', textTransform: 'uppercase' }}>Zahlen pflegen</summary>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', margin: '14px 0 6px' }}>
            {([['zielUmsatz', 'Ziel-Umsatz'], ['zielGewinn', 'Ziel-Gewinn'], ['cash', 'Cash aktuell']] as const).map(([f, l]) => (
              <label key={f} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={lbl}>{l}</span>
                <input value={eur(s[f])} onChange={e => setField(f, e.target.value)} style={{ background: T.void, border: `1px solid ${T.line}`, borderRadius: 8, color: T.ink, fontFamily: T.mono, fontSize: 13, padding: '7px 10px', width: 150, outline: 'none' }} />
              </label>
            ))}
          </div>
          <div style={{ ...lbl, margin: '12px 0 6px' }}>Ist je Monat — Umsatz / Kosten</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
            {s.months.map((r, i) => (
              <div key={i} style={{ background: T.void, border: `1px solid ${T.line}`, borderRadius: 8, padding: '7px 9px' }}>
                <div style={{ fontFamily: T.mono, fontSize: 10, color: i === m.aktMonatIdx ? T.accent : T.muted, marginBottom: 4 }}>{MONTHS_DE[i]}</div>
                <input value={r.umsatz || ''} placeholder="Umsatz" onChange={e => setMonth(i, 'umsatz', e.target.value)} inputMode="numeric" style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: `1px solid ${T.lineSoft}`, color: T.ink, fontFamily: T.mono, fontSize: 12, padding: '3px 0', outline: 'none' }} />
                <input value={r.kosten || ''} placeholder="Kosten" onChange={e => setMonth(i, 'kosten', e.target.value)} inputMode="numeric" style={{ width: '100%', background: 'transparent', border: 'none', color: T.inkDim, fontFamily: T.mono, fontSize: 12, padding: '3px 0', outline: 'none', marginTop: 2 }} />
              </div>
            ))}
          </div>
          <div style={{ fontFamily: T.mono, fontSize: 10.5, color: T.muted, marginTop: 8 }}>Nur Zahlen eintragen. Wird automatisch gespeichert, alles rechnet live.</div>
        </details>
      </div>
    </div>
  );
}
