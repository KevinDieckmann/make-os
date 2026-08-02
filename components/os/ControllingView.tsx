'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { THEME as T } from '@/lib/make-one/os-data';
import { wertVon, STANDARD_MODUS } from '@/lib/make-one/kompass-data';
import { localDay } from '@/lib/zeit';
import { useSpeichern } from '@/hooks/useSpeichern';
import { vorschau, monatlicheLast, type Firma, type Rechnung, type Zahlung, type Merkposten } from '@/lib/make-one/liquiditaet';
import {
  DEFAULT_FINANCE, MONTHS_DE, computeMetrics, eur,
  type FinanceState,
} from '@/lib/make-one/finance-data';

/** Der Teil des Finanzplans, den die Liquiditäts-Vorschau braucht. */
interface FinanzplanStand { firmen: Firma[]; rechnungen: Rechnung[]; zahlungen: Zahlung[]; merkposten: Merkposten[] }

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

  // Konnte der Stand nicht geladen werden, wird NICHT gespeichert — sonst
  // würde eine einzige Eingabe die zwölf Monatszahlen mit Nullen überschreiben.
  const [ladeFehler, setLadeFehler] = useState(false);

  // ── Liquidität: Finanzplan laden, Kontostände hier pflegbar machen ──
  const [fplan, setFplan] = useState<FinanzplanStand | null>(null);
  const [optimistisch, setOptimistisch] = useState(false);
  const [zieleAuf, setZieleAuf] = useState(false);
  const heute = localDay();
  useEffect(() => {
    fetch('/api/state/finanzplan')
      .then(r => { if (!r.ok) throw new Error(`Status ${r.status}`); return r.json(); })
      .then(setFplan)
      .catch(err => console.error('[MAKE OS] Finanzplan für die Liquiditäts-Vorschau nicht ladbar.', err));
  }, []);

  const planSpeichern = useSpeichern('/api/state/finanzplan');
  function kontostandSetzen(firmaId: string, wert: string) {
    if (!fplan) return;
    const zahl = wert.trim() === '' ? null : Math.round(Number(wert));
    if (zahl !== null && !Number.isFinite(zahl)) return;
    const next = { ...fplan, firmen: fplan.firmen.map(f => f.id === firmaId ? { ...f, kontostand: zahl } : f) };
    setFplan(next);
    planSpeichern.speichern(next);
  }
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

  // Speichert auch dann, wenn du sofort die Seite wechselst oder den Tab
  // schließt — beim nächsten Öffnen steht derselbe Stand da.
  const finanzSpeichern = useSpeichern('/api/state/finance');
  function persist(next: FinanceState) {
    setS(next);
    if (ladeFehler) return;
    finanzSpeichern.speichern(next);
  }
  const setMonth = (i: number, field: 'umsatz' | 'kosten', v: string) =>
    persist({ ...s, months: s.months.map((r, j) => j === i ? { ...r, [field]: num(v) } : r) });
  const setField = (field: 'zielUmsatz' | 'zielGewinn' | 'cash', v: string) => persist({ ...s, [field]: num(v) });

  const m = useMemo(() => computeMetrics(s), [s]);
  // Ohne gesetzten Startmonat gilt der erste Monat mit Zahlen als Start.
  const startMonat = useMemo(() => {
    if (typeof s.startMonat === 'number') return Math.max(0, Math.min(11, s.startMonat));
    const i = s.months.findIndex(r => (r.umsatz || 0) > 0 || (r.kosten || 0) > 0);
    return i < 0 ? 0 : i;
  }, [s]);
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

        {/* ── Liquidität: was ist wann da, und wann wird es eng ── */}
        {fplan && (() => {
          const v = vorschau(fplan.firmen, fplan.rechnungen, fplan.zahlungen, fplan.merkposten, heute, 12, optimistisch);
          const fix = monatlicheLast(fplan.merkposten);
          const maxAbs = Math.max(1, ...v.wochen.map(w => Math.abs(w.stand)));
          return (
            <div style={{ ...panel, borderTop: `2px solid ${v.engpass ? T.crit : T.accent}`, padding: '18px 22px', margin: '18px 0 14px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                <span style={lbl}>Liquidität · 12 Wochen</span>
                <button onClick={() => setOptimistisch(!optimistisch)} title="Geplante Rechnungen mitrechnen, obwohl sie noch nicht gestellt sind"
                  style={{ fontFamily: T.sans, fontSize: 11.5, padding: '3px 10px', borderRadius: 7, cursor: 'pointer', border: `1px solid ${optimistisch ? T.amber : T.line}`, background: optimistisch ? `${T.amber}1c` : 'transparent', color: optimistisch ? T.amber : T.muted }}>
                  {optimistisch ? 'mit geplanten Rechnungen' : 'nur was gestellt ist'}
                </button>
                <Link href="/os/finanzen" style={{ marginLeft: 'auto', fontFamily: T.mono, fontSize: 11, color: T.accentInk, textDecoration: 'none' }}>Rechnungen & Zahlungen ›</Link>
              </div>

              <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'baseline', margin: '10px 0 12px' }}>
                <div>
                  <div style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, textTransform: 'uppercase', letterSpacing: '.1em' }}>Heute auf den Konten</div>
                  <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{eur(v.start)}</div>
                </div>
                <div>
                  <div style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, textTransform: 'uppercase', letterSpacing: '.1em' }}>Tiefpunkt</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: v.tiefpunkt.stand < 0 ? T.crit : v.tiefpunkt.stand < 2000 ? T.amber : T.ink, fontVariantNumeric: 'tabular-nums' }}>
                    {eur(v.tiefpunkt.stand)}
                  </div>
                  <div style={{ fontFamily: T.mono, fontSize: 10.5, color: T.muted }}>{v.tiefpunkt.label}</div>
                </div>
                <div>
                  <div style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, textTransform: 'uppercase', letterSpacing: '.1em' }}>Rein / Raus</div>
                  <div style={{ fontSize: 15, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    <span style={{ color: T.accent }}>+{eur(v.summeEin)}</span> <span style={{ color: T.muted }}>/</span> <span style={{ color: T.amber }}>−{eur(v.summeAus)}</span>
                  </div>
                  {!!v.unsicher && <div style={{ fontFamily: T.mono, fontSize: 10.5, color: T.amber }}>davon {eur(v.unsicher)} unsicher</div>}
                </div>
              </div>

              <div style={{ fontSize: 13, color: v.engpass ? T.crit : T.inkDim, lineHeight: 1.5, marginBottom: 12 }}>
                {v.engpass
                  ? <><b>Engpass {v.engpass.label}</b> — dann fehlen {eur(Math.abs(v.engpass.stand))}. Entweder kommt vorher Geld rein, oder Zahlungen müssen geschoben werden.</>
                  : v.tiefpunkt.stand < 2000
                    ? <>Es reicht, aber knapp: im Tief bleiben nur {eur(v.tiefpunkt.stand)}. Ein unerwarteter Posten kippt das.</>
                    : <>Die nächsten 12 Wochen tragen. Tiefster Punkt {eur(v.tiefpunkt.stand)} ({v.tiefpunkt.label}).</>}
                {!!fix.length && <> Monatlich fest: {fix.map(f => `${f.text} ${eur(f.betrag)}`).join(' · ')}.</>}
              </div>

              {/* Verlauf als Balken — die Nulllinie ist der Boden */}
              <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 90, marginBottom: 6 }}>
                {v.wochen.map(w => {
                  const hoehe = Math.max(3, Math.round((Math.abs(w.stand) / maxAbs) * 84));
                  const farbe = w.stand < 0 ? T.crit : w.stand < 2000 ? T.amber : T.accent;
                  return (
                    <div key={w.von} title={`${w.label}: ${eur(w.stand)}${w.bewegungen.length ? `\n${w.bewegungen.map(b => `${b.datum.slice(8)}.${b.datum.slice(5, 7)}. ${b.betrag > 0 ? '+' : ''}${b.betrag} € ${b.text}`).join('\n')}` : ''}`}
                      style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%', cursor: 'default' }}>
                      <div style={{ height: hoehe, background: farbe, opacity: w.bewegungen.length ? 0.85 : 0.35, borderRadius: '3px 3px 0 0' }} />
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 3, fontFamily: T.mono, fontSize: 9, color: T.muted }}>
                {v.wochen.map((w, i) => <div key={w.von} style={{ flex: 1, textAlign: 'center' }}>{i % 2 === 0 ? w.von.slice(8) + '.' + w.von.slice(5, 7) + '.' : ''}</div>)}
              </div>

              {/* Kontostände direkt hier pflegen — sie sind der Startpunkt der Rechnung */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.lineSoft}` }}>
                {fplan.firmen.map(f => (
                  <label key={f.id} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ fontFamily: T.mono, fontSize: 10, color: T.muted }}>{f.name}{f.stand ? ` · ${f.stand.slice(8)}.${f.stand.slice(5, 7)}.` : ''}</span>
                    <input type="number" value={f.kontostand ?? ''} onChange={e => kontostandSetzen(f.id, e.target.value)}
                      placeholder="Kontostand" aria-label={`Kontostand ${f.name}`}
                      style={{ width: 130, background: T.void, border: `1px solid ${T.line}`, borderRadius: 8, padding: '6px 10px', color: T.ink, fontFamily: T.mono, fontSize: 13, outline: 'none' }} />
                  </label>
                ))}
                <div style={{ alignSelf: 'flex-end', fontSize: 11.5, color: T.muted, paddingBottom: 6 }}>
                  Diese Zahlen sind der Startpunkt der Vorschau — je aktueller, desto ehrlicher die Linie.
                </div>
              </div>
            </div>
          );
        })()}

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

        {/* ── Ziele anpassen: die Grundlage der ganzen Rechnung ── */}
        <div style={{ ...panel, borderLeft: `3px solid ${T.amber}`, padding: '14px 18px', marginBottom: 14 }}>
          <div onClick={() => setZieleAuf(!zieleAuf)} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', cursor: 'pointer' }}>
            <span style={lbl}>Ziele anpassen</span>
            <span style={{ fontSize: 12.5, color: T.inkDim }}>
              Seit <b style={{ color: T.ink }}>{MONTHS_DE[startMonat]}</b> · Ziel {eur(s.zielUmsatz)} Umsatz, {eur(s.zielGewinn)} Gewinn
            </span>
            <span style={{ marginLeft: 'auto', fontFamily: T.mono, fontSize: 12, color: T.muted }}>{zieleAuf ? '▾' : '▸'}</span>
          </div>

          {zieleAuf && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.55, marginBottom: 10 }}>
                Der Startmonat entscheidet über alles: Ohne ihn zählt das System ab Januar und teilt deinen Umsatz
                durch Monate, in denen es dich noch nicht gab. Das drückt den Schnitt und macht die nötige Run-Rate absurd.
              </div>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={lbl}>Gestartet ab</span>
                  <select value={startMonat} onChange={e => persist({ ...s, startMonat: Number(e.target.value) })}
                    aria-label="Startmonat"
                    style={{ background: T.void, border: `1px solid ${T.accent}66`, borderRadius: 8, color: T.ink, fontFamily: T.sans, fontSize: 13, padding: '7px 10px', width: 150, outline: 'none', cursor: 'pointer' }}>
                    {MONTHS_DE.map((mo, i) => <option key={mo} value={i} style={{ background: T.panel }}>{mo} {s.jahr}</option>)}
                  </select>
                </label>
                {([['zielUmsatz', 'Ziel-Umsatz'], ['zielGewinn', 'Ziel-Gewinn'], ['cash', 'Cash aktuell']] as const).map(([f, l]) => (
                  <label key={f} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={lbl}>{l}</span>
                    <input value={eur(s[f])} onChange={e => setField(f, e.target.value)} aria-label={l}
                      style={{ background: T.void, border: `1px solid ${T.line}`, borderRadius: 8, color: T.ink, fontFamily: T.mono, fontSize: 13, padding: '7px 10px', width: 150, outline: 'none' }} />
                  </label>
                ))}
              </div>

              {/* Was die Einstellung gerade bewirkt — sofort, in echten Zahlen */}
              <div style={{ marginTop: 12, padding: '10px 13px', background: T.panel2, borderRadius: 10, fontSize: 12.5, color: T.inkDim, lineHeight: 1.6 }}>
                {m.aktiveMonate > 0 ? (
                  <>
                    <b style={{ color: T.ink }}>{m.aktiveMonate} {m.aktiveMonate === 1 ? 'Monat' : 'Monate'} aktiv</b> seit {MONTHS_DE[startMonat]} ·
                    Schnitt <b style={{ color: T.ink }}>{eur(m.runRateAktuell)}/Monat</b> ·
                    noch <b style={{ color: T.ink }}>{m.restMonate} Monate</b> im Jahr.
                    {m.restMonate > 0 && <> Für das Ziel bräuchtest du ab jetzt <b style={{ color: m.runRateNoetig > m.runRateAktuell * 5 ? T.crit : T.amber }}>{eur(m.runRateNoetig)}/Monat</b> — {m.runRateNoetig > m.runRateAktuell * 5 ? 'das ist vom aktuellen Stand aus unrealistisch, das Ziel gehört angepasst.' : 'ambitioniert, aber im Bereich.'}</>}
                  </>
                ) : <>Noch keine Ist-Zahlen eingetragen — unten je Monat Umsatz und Kosten pflegen, dann rechnet alles live.</>}
              </div>
            </div>
          )}
        </div>

        {/* Eingabe */}
        <details style={{ ...panel, padding: '14px 18px', marginBottom: 14 }} open={loaded && m.aktiveMonate === 0}>
          <summary style={{ cursor: 'pointer', fontFamily: T.mono, fontSize: 11, color: T.accentInk, letterSpacing: '.08em', textTransform: 'uppercase' }}>Zahlen pflegen</summary>
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
