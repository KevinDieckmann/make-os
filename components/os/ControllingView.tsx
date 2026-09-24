'use client';

// ─── MAKE OS — Controlling & Ziele ──────────────────────────────────────────
// Die eine Frage: liegen wir auf Kurs zum Jahresziel? Der Ring ist der
// Fortschritt, der Satz sagt, ob die aktuelle Run-Rate reicht. Darunter die
// Liquidität der nächsten zwölf Wochen, die Kennzahlen, der Lagebericht, der
// Umsatz je Monat — und die Ziele samt Ist-Zahlen zum Pflegen.
// 24.09.: auf das lebendige Muster umgezogen (Karten, Leuchtfarben, Ring).

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { wertVon, STANDARD_MODUS } from '@/lib/make-one/kompass-data';
import { localDay } from '@/lib/zeit';
import { useSpeichern } from '@/hooks/useSpeichern';
import { useAbgleich } from '@/hooks/useAbgleich';
import { FINANZPLAN_LISTEN } from '@/lib/sync';
import { vorschau, monatlicheLast, type Firma, type Rechnung, type Zahlung, type Merkposten, type Planposten, type Woche, nurBusiness } from '@/lib/make-one/liquiditaet';
import {
  DEFAULT_FINANCE, MONTHS_DE, computeMetrics, mitKasse, geschaeftsKasse, eur,
  type FinanceState,
} from '@/lib/make-one/finance-data';
import { Seite, Karte, Ueberschrift, Leer, Knopf, Zahl, Ring, feld, zoneFarbe, LEUCHT } from './schlank';

/** Der Teil des Finanzplans, den die Liquiditäts-Vorschau braucht. */
interface FinanzplanStand { firmen: Firma[]; rechnungen: Rechnung[]; zahlungen: Zahlung[]; merkposten: Merkposten[] }

interface Analysis { briefing: string; fokus?: string[]; risiken?: string[]; }

const num = (v: string) => Math.max(0, Math.round(Number(v.replace(/[^\d]/g, '')) || 0));
const datum = (d: string) => `${d.slice(8)}.${d.slice(5, 7)}.`;

const mikro: CSSProperties = { fontSize: TYP.mikro, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: C.inkLeise };
const eingabe: CSSProperties = { ...feld, width: 'auto', padding: '8px 10px', fontSize: TYP.bedien, borderRadius: 8 };
const zahlFeld: CSSProperties = { ...eingabe, fontFamily: SCHRIFT.display, fontWeight: 700, fontVariantNumeric: 'tabular-nums' };
const auswahl: CSSProperties = { background: 'rgba(255,255,255,.05)', border: 'none', borderRadius: 8, color: C.inkDim, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, padding: '7px 10px', colorScheme: 'dark', outline: 'none', cursor: 'pointer' };
const option: CSSProperties = { background: C.flaeche };

/** Stand am Ende der Woche in Zustandsfarbe. */
const standFarbe = (stand: number) => (stand < 0 ? LEUCHT.kritisch : stand < 2000 ? LEUCHT.achtung : LEUCHT.geld);

/** Verlauf als Balken — jede Woche in ihrer Zustandsfarbe, die Nulllinie ist der Boden. */
function Wochenbalken({ wochen, hoehe }: { wochen: Woche[]; hoehe: number }) {
  const maxAbs = Math.max(1, ...wochen.map(w => Math.abs(w.stand)));
  return (
    <>
      <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: hoehe }}>
        {wochen.map((w, i) => {
          const farbe = standFarbe(w.stand);
          const letzte = i === wochen.length - 1;
          return (
            <div key={w.von} className="balken-auf" title={`${w.label}: ${eur(w.stand)}${w.bewegungen.length ? `\n${w.bewegungen.map(b => `${datum(b.datum)} ${b.betrag > 0 ? '+' : ''}${b.betrag} € ${b.text}`).join('\n')}` : ''}`}
              style={{ ['--i' as string]: i, flex: 1, height: Math.max(3, Math.round((Math.abs(w.stand) / maxAbs) * hoehe)), borderRadius: 3, background: farbe, opacity: letzte ? 1 : w.bewegungen.length ? .8 : .35, boxShadow: letzte ? `0 0 10px ${farbe}99` : undefined }} />
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 3, marginTop: 4, fontSize: TYP.mikro, color: C.inkLeise, fontVariantNumeric: 'tabular-nums' }}>
        {wochen.map((w, i) => <div key={w.von} style={{ flex: 1, textAlign: 'center', minWidth: 0, overflow: 'hidden' }}>{i % 2 === 0 ? datum(w.von) : ''}</div>)}
      </div>
    </>
  );
}

function Feld({ label, children }: { label: ReactNode; children: ReactNode }) {
  return <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><span style={mikro}>{label}</span>{children}</label>;
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
  // Dieselben Planposten wie unter Zahlen und Liquidität — sonst zeigt jede Seite eine andere Kurve.
  const [posten, setPosten] = useState<Planposten[]>([]);
  useEffect(() => {
    fetch('/api/state/liquiplan').then(r => r.json()).then(d => setPosten(d.posten ?? [])).catch(() => {});
  }, []);
  // Zu zweit: Kontostände als Einzeländerung, Malins Änderungen per Abgleich.
  const planSpeichern = useSpeichern('/api/state/finanzplan', { listen: FINANZPLAN_LISTEN, uebernehmen: st => setFplan(st as unknown as FinanzplanStand) });
  const ladePlan = useCallback(() => fetch('/api/state/finanzplan')
    .then(r => { if (!r.ok) throw new Error(`Status ${r.status}`); return r.json(); })
    .then((d: FinanzplanStand) => { if (planSpeichern.hatOffenes()) return; setFplan(d); planSpeichern.kenne(d); })
    .catch(err => console.error('[MAKE OS] Finanzplan für die Liquiditäts-Vorschau nicht ladbar.', err)), [planSpeichern]);
  useEffect(() => { void ladePlan(); }, [ladePlan]);
  function kontostandSetzen(firmaId: string, wert: string) {
    if (!fplan) return;
    const zahl = wert.trim() === '' ? null : Math.round(Number(wert));
    if (zahl !== null && !Number.isFinite(zahl)) return;
    const next = { ...fplan, firmen: fplan.firmen.map(f => f.id === firmaId ? { ...f, kontostand: zahl } : f) };
    setFplan(next);
    planSpeichern.speichern(next);
  }
  // Speichert auch dann, wenn du sofort die Seite wechselst oder den Tab
  // schließt — beim nächsten Öffnen steht derselbe Stand da. Zu zweit: Monate
  // und Felder einzeln; was Malin in anderen Monaten tippt, bleibt erhalten.
  const finanzSpeichern = useSpeichern('/api/state/finance', { listen: { months: 'm' }, uebernehmen: st => setS(st as unknown as FinanceState) });
  const ladeFinanz = useCallback(() => fetch('/api/state/finance')
    .then(r => { if (!r.ok) throw new Error(`Status ${r.status}`); return r.json(); })
    .then((d: { state: FinanceState | null }) => {
      if (finanzSpeichern.hatOffenes()) return;
      if (d.state && Array.isArray(d.state.months) && d.state.months.length === 12) { setS(d.state); finanzSpeichern.kenne(d.state); }
      setLoaded(true);
    })
    .catch(err => {
      console.error('[MAKE OS] Controlling konnte nicht geladen werden — Speichern gesperrt.', err);
      setLadeFehler(true);
      setLoaded(true);
    }), [finanzSpeichern]);
  useEffect(() => { void ladeFinanz(); }, [ladeFinanz]);
  useAbgleich(() => { void ladePlan(); void ladeFinanz(); }, { pausiert: () => planSpeichern.hatOffenes() || finanzSpeichern.hatOffenes() });
  function persist(next: FinanceState) {
    setS(next);
    if (ladeFehler) return;
    finanzSpeichern.speichern(next);
  }
  const setMonth = (i: number, field: 'umsatz' | 'kosten', v: string) =>
    persist({ ...s, months: s.months.map((r, j) => j === i ? { ...r, [field]: num(v) } : r) });
  const setField = (field: 'zielUmsatz' | 'zielGewinn' | 'cash', v: string) => persist({ ...s, [field]: num(v) });

  // Kasse aus den Firmenkonten — das Feld „Cash“ gilt nur, solange keins einen Stand hat.
  const kasse = useMemo(() => geschaeftsKasse(fplan?.firmen, s.cash), [fplan, s.cash]);
  const m = useMemo(() => computeMetrics(fplan ? mitKasse(s, fplan.firmen) : s), [s, fplan]);
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

  const aufKurs = m.aktiveMonate > 0 && m.runRateAktuell >= m.runRateNoetig;
  const runRateColor = aufKurs ? LEUCHT.gut : m.aktiveMonate > 0 ? LEUCHT.achtung : C.inkLeise;
  const kursFarbe = m.aktiveMonate === 0 ? C.inkLeise : zoneFarbe(pct);

  return (
    <Seite titel="Controlling & Ziele" unter={`Ziel ${s.jahr} · ${eur(s.zielUmsatz)} Umsatz, ${eur(s.zielGewinn)} Gewinn`}
      rechts={<Knopf onClick={analyse} aus={busy}>{busy ? 'analysiere Lage …' : 'Lage analysieren'}</Knopf>}>
      {/* ── Der Held: liegen wir auf Kurs zum Jahresziel? ── */}
      <Karte i={0} akzent={m.aktiveMonate > 0 ? (aufKurs ? LEUCHT.gut : LEUCHT.achtung) : undefined}>
        <Ueberschrift farbe={kursFarbe}>Kurs aufs Jahresziel</Ueberschrift>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap', padding: '6px 0 4px' }}>
          <Ring groesse="gross" wert={m.aktiveMonate > 0 ? String(pct) : undefined} einheit="%" label={`Ziel ${s.jahr}`} farbe={kursFarbe} anteil={pct / 100} />
          <div style={{ flex: '1 1 280px', minWidth: 0 }}>
            <p style={{ fontFamily: SCHRIFT.display, fontSize: TYP.titel, fontWeight: 600, letterSpacing: '-.01em', color: C.ink, margin: 0, lineHeight: 1.35 }}>
              {m.aktiveMonate === 0
                ? <>Noch keine Ist-Zahlen für {s.jahr}. Trag unten einen Monat ein, dann rechnet alles mit.</>
                : aufKurs
                  ? <>Auf Kurs: Ø <b style={{ color: LEUCHT.gut }}>{eur(m.runRateAktuell)}</b> im Monat, nötig sind {eur(m.runRateNoetig)}.</>
                  : <>Es fehlen <b style={{ color: LEUCHT.achtung }}>{eur(m.runRateNoetig - m.runRateAktuell)}</b> im Monat — {eur(m.runRateAktuell)} statt {eur(m.runRateNoetig)}, bei {m.restMonate} Monaten Rest.</>}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16, marginTop: 16 }}>
              <Zahl wert={m.aktiveMonate > 0 ? eur(m.istUmsatz) : undefined} label={`Umsatz · Ziel ${eur(s.zielUmsatz)}`} farbe={LEUCHT.gut} />
              <Zahl wert={eur(m.verbleibend)} label="fehlt noch" />
              {m.runwayMonate != null && (
                <Zahl wert={m.runwayMonate.toFixed(1).replace('.', ',')} label="Monate Runway" farbe={m.runwayMonate < runwayRot ? LEUCHT.kritisch : C.ink} />
              )}
            </div>
          </div>
        </div>
      </Karte>

      {/* ── Liquidität: was ist wann da, und wann wird es eng ── */}
      {fplan && (() => {
        const v = vorschau(fplan.firmen, fplan.rechnungen, fplan.zahlungen, fplan.merkposten, heute, 12, optimistisch, posten, 'real', undefined, true);
        const fix = monatlicheLast(nurBusiness(fplan.merkposten));
        return (
          <Karte i={1}>
            <Ueberschrift farbe={v.engpass ? LEUCHT.kritisch : LEUCHT.geld}
              rechts={<>
                <Knopf leise onClick={() => setOptimistisch(!optimistisch)}>{optimistisch ? 'mit geplanten Rechnungen' : 'nur was gestellt ist'}</Knopf>
                <Link href="/os/finanzen" style={{ color: C.inkLeise, textDecoration: 'none' }}>Rechnungen & Zahlungen ›</Link>
              </>}>
              Liquidität · 12 Wochen
            </Ueberschrift>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, margin: '4px 0 14px' }}>
              <Zahl wert={eur(v.start)} farbe={v.start < 0 ? LEUCHT.kritisch : LEUCHT.geld} label="heute auf den Konten" />
              <Zahl wert={eur(v.tiefpunkt.stand)} farbe={standFarbe(v.tiefpunkt.stand)} label={`Tiefpunkt · ${v.tiefpunkt.label}`} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 'clamp(20px,2.6vw,24px)', letterSpacing: '-.03em', lineHeight: 1.05, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  <span style={{ color: LEUCHT.gut }}>+{eur(v.summeEin)}</span> <span style={{ color: C.inkLeise }}>/</span> <span style={{ color: LEUCHT.achtung }}>−{eur(v.summeAus)}</span>
                </div>
                <div style={{ fontSize: 12.5, color: v.unsicher ? LEUCHT.achtung : C.inkDim, marginTop: 4 }}>{v.unsicher ? `rein / raus · davon ${eur(v.unsicher)} unsicher` : 'rein / raus'}</div>
              </div>
            </div>

            <div style={{ fontSize: TYP.bedien, color: v.engpass ? LEUCHT.kritisch : C.inkDim, lineHeight: 1.5, marginBottom: 12 }}>
              {v.engpass
                ? <><b>Engpass {v.engpass.label}</b> — dann fehlen {eur(Math.abs(v.engpass.stand))}. Entweder kommt vorher Geld rein, oder Zahlungen müssen geschoben werden.</>
                : v.tiefpunkt.stand < 2000
                  ? <>Es reicht, aber knapp: im Tief bleiben nur {eur(v.tiefpunkt.stand)}. Ein unerwarteter Posten kippt das.</>
                  : <>Die nächsten 12 Wochen tragen. Tiefster Punkt {eur(v.tiefpunkt.stand)} ({v.tiefpunkt.label}).</>}
              {!!fix.length && <> Monatlich fest: {fix.map(f => `${f.text} ${eur(f.betrag)}`).join(' · ')}.</>}
            </div>

            <Wochenbalken wochen={v.wochen} hoehe={90} />

            {/* Kontostände direkt hier pflegen — sie sind der Startpunkt der Rechnung */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.06)' }}>
              {fplan.firmen.map(f => (
                <Feld key={f.id} label={<>{f.name}{f.stand ? ` · ${datum(f.stand)}` : ''}</>}>
                  <input type="number" value={f.kontostand ?? ''} onChange={e => kontostandSetzen(f.id, e.target.value)}
                    placeholder="Kontostand" aria-label={`Kontostand ${f.name}`} style={{ ...zahlFeld, width: 140 }} />
                </Feld>
              ))}
              <div style={{ fontSize: 12, color: C.inkLeise, paddingBottom: 8, lineHeight: 1.5 }}>
                Diese Zahlen sind der Startpunkt der Vorschau — je aktueller, desto ehrlicher die Linie.
              </div>
            </div>
          </Karte>
        );
      })()}

      {/* KPIs */}
      <Karte i={2}>
        <Ueberschrift farbe={runRateColor}>Kennzahlen</Ueberschrift>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16 }}>
          <Zahl wert={eur(m.runRateNoetig)} label={`Run-Rate nötig · /Monat · ${m.restMonate} Monate übrig`} />
          <Zahl wert={m.aktiveMonate > 0 ? eur(m.runRateAktuell) : undefined} label={m.aktiveMonate > 0 ? `Run-Rate aktuell · Ø aus ${m.aktiveMonate} Monaten` : 'Run-Rate aktuell · keine Ist-Zahlen'} farbe={runRateColor} />
          <Zahl wert={m.aktiveMonate > 0 ? eur(m.istGewinn) : undefined} label={`Gewinn · Ziel ${eur(s.zielGewinn)}`} farbe={m.istGewinn >= 0 ? LEUCHT.gut : LEUCHT.kritisch} />
          <Zahl wert={m.runwayMonate != null ? `${m.runwayMonate.toFixed(1).replace('.', ',')} Mon.` : undefined} label={m.runwayMonate != null ? `Runway · bei Ø Burn ${eur(m.avgBurn)}` : 'Runway · kein Burn/Cash'} farbe={m.runwayMonate != null && m.runwayMonate < runwayRot ? LEUCHT.kritisch : C.ink} />
        </div>
      </Karte>

      {/* Analyse */}
      {a && (
        <Karte i={3}>
          <Ueberschrift farbe={LEUCHT.agenten}>Lagebericht</Ueberschrift>
          <div style={{ fontSize: TYP.body, color: C.ink, lineHeight: 1.55 }}>{a.briefing}</div>
          {!!a.fokus?.length && (
            <div style={{ marginTop: 14 }}>
              <div style={{ ...mikro, marginBottom: 6 }}>Fokus diesen Monat</div>
              {a.fokus.map((f, i) => <div key={i} style={{ display: 'flex', gap: 8, fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5, marginTop: 3 }}><span style={{ color: LEUCHT.gut }}>›</span>{f}</div>)}
            </div>
          )}
          {!!a.risiken?.length && (
            <div style={{ marginTop: 14 }}>
              <div style={{ ...mikro, color: LEUCHT.achtung, marginBottom: 6 }}>Risiken</div>
              {a.risiken.map((f, i) => <div key={i} style={{ display: 'flex', gap: 8, fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5, marginTop: 3 }}><span style={{ color: LEUCHT.achtung }}>⚠</span>{f}</div>)}
            </div>
          )}
        </Karte>
      )}

      {/* Monats-Balken */}
      <Karte i={4}>
        <Ueberschrift farbe={LEUCHT.business} rechts={<span style={{ color: LEUCHT.achtung }}>Linie = nötige Run-Rate {eur(m.runRateNoetig)}</span>}>Umsatz je Monat</Ueberschrift>
        <div style={{ display: 'flex', gap: 5, alignItems: 'flex-end', height: 120, position: 'relative' }}>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: `${(m.runRateNoetig / maxBar) * 100}%`, borderTop: `1px dashed ${LEUCHT.achtung}88`, zIndex: 1 }} />
          {s.months.map((r, i) => {
            const trifft = r.umsatz >= m.runRateNoetig && r.umsatz > 0;
            const aktuell = i === m.aktMonatIdx;
            return (
              <div key={i} title={`${MONTHS_DE[i]}: ${eur(r.umsatz)}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
                <div className="balken-auf" style={{ ['--i' as string]: i, width: '100%', height: `${(r.umsatz / maxBar) * 100}%`, minHeight: 3, background: r.umsatz > 0 ? (trifft ? LEUCHT.gut : LEUCHT.business) : 'rgba(255,255,255,.08)', borderRadius: 3, opacity: r.umsatz > 0 ? (aktuell ? 1 : .6) : 1, boxShadow: aktuell && r.umsatz > 0 ? `0 0 10px ${trifft ? LEUCHT.gut : LEUCHT.business}99` : undefined }} />
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 5, marginTop: 6, fontSize: TYP.mikro, fontWeight: 600, color: C.inkLeise }}>
          {s.months.map((r, i) => <div key={i} style={{ flex: 1, textAlign: 'center', color: i === m.aktMonatIdx ? LEUCHT.gut : C.inkLeise }}>{r.m}</div>)}
        </div>
      </Karte>

      {/* ── Ziele anpassen: die Grundlage der ganzen Rechnung ── */}
      <Karte i={5}>
        <div onClick={() => setZieleAuf(!zieleAuf)} style={{ cursor: 'pointer' }}>
          <Ueberschrift farbe={LEUCHT.achtung} rechts={<>
            <span>Seit <b style={{ color: C.ink }}>{MONTHS_DE[startMonat]}</b> · Ziel {eur(s.zielUmsatz)} Umsatz, {eur(s.zielGewinn)} Gewinn</span>
            <span>{zieleAuf ? '▾' : '▸'}</span>
          </>}>Ziele anpassen</Ueberschrift>
        </div>

        {zieleAuf && (
          <div>
            <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55, marginBottom: 12 }}>
              Der Startmonat entscheidet über alles: Ohne ihn zählt das System ab Januar und teilt deinen Umsatz
              durch Monate, in denen es dich noch nicht gab. Das drückt den Schnitt und macht die nötige Run-Rate absurd.
            </div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <Feld label="Gestartet ab">
                <select value={startMonat} onChange={e => persist({ ...s, startMonat: Number(e.target.value) })} aria-label="Startmonat" style={{ ...auswahl, width: 150 }}>
                  {MONTHS_DE.map((mo, i) => <option key={mo} value={i} style={option}>{mo} {s.jahr}</option>)}
                </select>
              </Feld>
              {([['zielUmsatz', 'Ziel-Umsatz'], ['zielGewinn', 'Ziel-Gewinn'], ...(kasse.quelle === 'konten' ? [] : [['cash', 'Cash aktuell']])] as ['zielUmsatz' | 'zielGewinn' | 'cash', string][]).map(([f, l]) => (
                <Feld key={f} label={l}>
                  <input value={eur(s[f])} onChange={e => setField(f, e.target.value)} aria-label={l} style={{ ...zahlFeld, width: 150 }} />
                </Feld>
              ))}
              {kasse.quelle === 'konten' && (
                <Feld label="Cash aus den Konten">
                  <div style={{ ...zahlFeld, width: 150, display: 'flex', alignItems: 'center' }} title={`Summe aus ${kasse.konten} Firmenkonten${kasse.stand ? `, ältester Stand ${kasse.stand}` : ''} — pflegen oben unter Liquidität`}>{eur(kasse.betrag)}</div>
                </Feld>
              )}
            </div>

            {/* Was die Einstellung gerade bewirkt — sofort, in echten Zahlen */}
            <div style={{ marginTop: 14, padding: '10px 13px', background: 'rgba(255,255,255,.04)', borderRadius: 12, fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.6 }}>
              {m.aktiveMonate > 0 ? (
                <>
                  <b style={{ color: C.ink }}>{m.aktiveMonate} {m.aktiveMonate === 1 ? 'Monat' : 'Monate'} aktiv</b> seit {MONTHS_DE[startMonat]} ·
                  Schnitt <b style={{ color: C.ink }}>{eur(m.runRateAktuell)}/Monat</b> ·
                  noch <b style={{ color: C.ink }}>{m.restMonate} Monate</b> im Jahr.
                  {m.restMonate > 0 && <> Für das Ziel bräuchtest du ab jetzt <b style={{ color: m.runRateNoetig > m.runRateAktuell * 5 ? LEUCHT.kritisch : LEUCHT.achtung }}>{eur(m.runRateNoetig)}/Monat</b> — {m.runRateNoetig > m.runRateAktuell * 5 ? 'das ist vom aktuellen Stand aus unrealistisch, das Ziel gehört angepasst.' : 'ambitioniert, aber im Bereich.'}</>}
                </>
              ) : <>Noch keine Ist-Zahlen eingetragen — unten je Monat Umsatz und Kosten pflegen, dann rechnet alles live.</>}
            </div>
          </div>
        )}
      </Karte>

      {/* Eingabe */}
      <Karte i={6}>
        <details open={loaded && m.aktiveMonate === 0}>
          <summary style={{ cursor: 'pointer', fontSize: 12, fontWeight: 700, color: C.inkDim, letterSpacing: '.08em', textTransform: 'uppercase', listStyle: 'none' }}>Zahlen pflegen ▸</summary>
          <div style={{ ...mikro, margin: '12px 0 8px' }}>Ist je Monat — Umsatz / Kosten</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
            {s.months.map((r, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,.04)', borderRadius: 12, padding: '8px 10px' }}>
                <div style={{ ...mikro, color: i === m.aktMonatIdx ? LEUCHT.gut : C.inkLeise, marginBottom: 4 }}>{MONTHS_DE[i]}</div>
                <input value={r.umsatz || ''} placeholder="Umsatz" aria-label={`Umsatz ${MONTHS_DE[i]}`} onChange={e => setMonth(i, 'umsatz', e.target.value)} inputMode="numeric"
                  style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,.06)', color: C.ink, fontFamily: SCHRIFT.display, fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: TYP.bedien, padding: '4px 0', outline: 'none' }} />
                <input value={r.kosten || ''} placeholder="Kosten" aria-label={`Kosten ${MONTHS_DE[i]}`} onChange={e => setMonth(i, 'kosten', e.target.value)} inputMode="numeric"
                  style={{ width: '100%', background: 'transparent', border: 'none', color: C.inkDim, fontFamily: SCHRIFT.display, fontWeight: 600, fontVariantNumeric: 'tabular-nums', fontSize: TYP.bedien, padding: '4px 0', outline: 'none', marginTop: 2 }} />
              </div>
            ))}
          </div>
          <Leer>Nur Zahlen eintragen. Wird automatisch gespeichert, alles rechnet live.</Leer>
        </details>
      </Karte>
    </Seite>
  );
}
