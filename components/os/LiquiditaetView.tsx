'use client';

// ─── MAKE OS — Liquiditäts-Planung ──────────────────────────────────────────
// Die Frage: Wie viel Geld ist wann da? Gerechnet aus dem, was ist
// (Kontostände, Rechnungen, Zahlungen) und dem, was wir erwarten
// (Planposten: Miete, Gehälter, Mandate, Steuern).

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { THEME as T } from '@/lib/make-one/os-data';
import { localDay } from '@/lib/zeit';
import { eur } from '@/lib/make-one/finance-data';
import { useSpeichern } from '@/hooks/useSpeichern';
import {
  vorschau, KATEGORIEN, KATEGORIE, SZENARIO_LABEL,
  type Firma, type Rechnung, type Zahlung, type Merkposten, type Planposten, type Rhythmus, type Szenario,
} from '@/lib/make-one/liquiditaet';

const panel = { background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14 };
const lbl = { fontFamily: T.mono, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: T.muted };
const feld = { background: T.void, border: `1px solid ${T.line}`, borderRadius: 8, color: T.ink, fontFamily: T.sans, fontSize: 13, padding: '7px 10px', outline: 'none' };

interface Plan { firmen: Firma[]; rechnungen: Rechnung[]; zahlungen: Zahlung[]; merkposten: Merkposten[] }

const RHYTHMUS_LABEL: Record<Rhythmus, string> = {
  einmalig: 'einmalig', monatlich: 'jeden Monat', quartal: 'jedes Quartal', jaehrlich: 'jedes Jahr',
};

export function LiquiditaetView() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [posten, setPosten] = useState<Planposten[]>([]);
  const [geladen, setGeladen] = useState(false);
  const [wochen, setWochen] = useState(12);
  const [szenario, setSzenario] = useState<Szenario>('real');
  const [nurFirma, setNurFirma] = useState<string>('alle');
  const [offen, setOffen] = useState<string | null>(null);
  const heute = localDay();

  useEffect(() => {
    fetch('/api/state/finanzplan').then(r => r.json()).then(setPlan).catch(() => {});
    fetch('/api/state/liquiplan').then(r => r.json()).then(d => {
      setPosten(Array.isArray(d.posten) ? d.posten : []);
      setGeladen(true);
    }).catch(() => setGeladen(true));
  }, []);

  const speichernHook = useSpeichern('/api/state/liquiplan', { verzoegerung: 400 });
  const planSpeichern = useSpeichern('/api/state/finanzplan');
  function setzePosten(next: Planposten[]) {
    setPosten(next);
    speichernHook.speichern({ posten: next });
  }
  const patch = (id: string, p: Partial<Planposten>) => setzePosten(posten.map(x => x.id === id ? { ...x, ...p } : x));

  function anlegen(vorzeichen: 1 | -1) {
    const p: Planposten = {
      id: `lp-${Date.now().toString(36)}`,
      titel: vorzeichen > 0 ? 'Neue Einnahme' : 'Neue Ausgabe',
      betrag: vorzeichen * 100,
      rhythmus: 'monatlich',
      ab: heute,
      sicher: vorzeichen < 0,
    };
    setzePosten([...posten, p]);
    setOffen(p.id);
  }

  function kontostand(firmaId: string, wert: string) {
    if (!plan) return;
    const zahl = wert.trim() === '' ? null : Math.round(Number(wert));
    if (zahl !== null && !Number.isFinite(zahl)) return;
    const next = { ...plan, firmen: plan.firmen.map(f => f.id === firmaId ? { ...f, kontostand: zahl } : f) };
    setPlan(next);
    planSpeichern.speichern(next);
  }

  const firmaFilter = nurFirma === 'alle' ? undefined : nurFirma;
  const v = useMemo(
    () => plan ? vorschau(plan.firmen, plan.rechnungen, plan.zahlungen, plan.merkposten, heute, wochen, false, posten, szenario, firmaFilter) : null,
    [plan, posten, heute, wochen, szenario, firmaFilter],
  );
  /** Dieselbe Rechnung in allen drei Szenarien — für den Vergleich. */
  const dreiFaelle = useMemo(() => {
    if (!plan) return null;
    const f = (sz: Szenario) => vorschau(plan.firmen, plan.rechnungen, plan.zahlungen, plan.merkposten, heute, wochen, false, posten, sz, firmaFilter);
    return { schlecht: f('schlecht'), real: f('real'), gut: f('gut') };
  }, [plan, posten, heute, wochen, firmaFilter]);
  /** Aufschlüsselung nach Kategorie über den ganzen Zeitraum. */
  const nachKategorie = useMemo(() => {
    if (!v) return [];
    const summen = new Map<string, number>();
    v.wochen.forEach(w => w.bewegungen.forEach(b => {
      const k = b.kategorie ?? (b.betrag > 0 ? 'sonstige-ein' : 'betrieb');
      summen.set(k, (summen.get(k) ?? 0) + b.betrag);
    }));
    return Array.from(summen.entries())
      .map(([id, betrag]) => ({ id, betrag, meta: KATEGORIE[id] }))
      .filter(x => x.meta && Math.abs(x.betrag) > 0)
      .sort((a, b) => Math.abs(b.betrag) - Math.abs(a.betrag));
  }, [v]);

  const ein = posten.filter(p => p.betrag > 0);
  const aus = posten.filter(p => p.betrag < 0);
  /** Was ein Posten im Monat ausmacht — für die Summe unten. */
  const proMonat = (p: Planposten) =>
    p.rhythmus === 'monatlich' ? p.betrag : p.rhythmus === 'quartal' ? p.betrag / 3 : p.rhythmus === 'jaehrlich' ? p.betrag / 12 : 0;
  const monatEin = Math.round(ein.reduce((s, p) => s + proMonat(p), 0));
  const monatAus = Math.round(Math.abs(aus.reduce((s, p) => s + proMonat(p), 0)));

  const zeile = (p: Planposten) => {
    const auf = offen === p.id;
    const raus = p.betrag < 0;
    return (
      <div key={p.id} style={{ borderTop: `1px solid ${T.lineSoft}`, background: auf ? T.panel2 : 'transparent' }}>
        <div onClick={() => setOffen(auf ? null : p.id)} style={{ display: 'flex', gap: 11, padding: '9px 14px', alignItems: 'center', cursor: 'pointer' }}>
          <span style={{ fontSize: 13, color: T.ink, flex: 1, minWidth: 0 }}>{p.titel}</span>
          {!p.sicher && <span style={{ fontFamily: T.mono, fontSize: 9.5, color: T.amber, border: `1px solid ${T.amber}55`, borderRadius: 5, padding: '1px 6px' }}>unsicher</span>}
          <span style={{ fontFamily: T.mono, fontSize: 10.5, color: T.muted }}>{RHYTHMUS_LABEL[p.rhythmus]}</span>
          <span style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 600, color: raus ? T.amber : T.accent, minWidth: 84, textAlign: 'right' }}>
            {raus ? '−' : '+'}{eur(Math.abs(p.betrag))}
          </span>
          <span style={{ fontFamily: T.mono, fontSize: 12, color: T.muted }}>{auf ? '▾' : '▸'}</span>
        </div>
        {auf && (
          <div style={{ padding: '0 14px 12px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 170 }}>
              <span style={lbl}>Wofür</span>
              <input value={p.titel} onChange={e => patch(p.id, { titel: e.target.value })} aria-label="Bezeichnung" style={{ ...feld, width: '100%' }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={lbl}>Betrag</span>
              <input type="number" value={Math.abs(p.betrag)} onChange={e => patch(p.id, { betrag: (raus ? -1 : 1) * Math.abs(Math.round(Number(e.target.value) || 0)) })}
                aria-label="Betrag" style={{ ...feld, width: 110, fontFamily: T.mono }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={lbl}>Wie oft</span>
              <select value={p.rhythmus} onChange={e => patch(p.id, { rhythmus: e.target.value as Rhythmus })} aria-label="Rhythmus" style={{ ...feld, cursor: 'pointer' }}>
                {(Object.keys(RHYTHMUS_LABEL) as Rhythmus[]).map(r => <option key={r} value={r} style={{ background: T.panel }}>{RHYTHMUS_LABEL[r]}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={lbl}>Ab</span>
              <input type="date" value={p.ab} onChange={e => patch(p.id, { ab: e.target.value })} aria-label="Ab wann" style={{ ...feld, fontFamily: T.mono, fontSize: 12, colorScheme: 'dark' }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={lbl}>Bis (optional)</span>
              <input type="date" value={p.bis ?? ''} onChange={e => patch(p.id, { bis: e.target.value || undefined })} aria-label="Bis wann" style={{ ...feld, fontFamily: T.mono, fontSize: 12, colorScheme: 'dark' }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={lbl}>Wofür (Art)</span>
              <select value={p.kategorie ?? ''} onChange={e => patch(p.id, { kategorie: e.target.value || undefined })} aria-label="Kategorie"
                style={{ ...feld, cursor: 'pointer', maxWidth: 190 }}>
                <option value="" style={{ background: T.panel }}>— nicht zugeordnet</option>
                {KATEGORIEN.filter(k => k.art === (raus ? 'aus' : 'ein')).map(k => (
                  <option key={k.id} value={k.id} style={{ background: T.panel }}>{k.label}</option>
                ))}
              </select>
            </label>
            {plan && plan.firmen.length > 1 && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={lbl}>Wessen Konto</span>
                <select value={p.firmaId ?? ''} onChange={e => patch(p.id, { firmaId: e.target.value || undefined })} aria-label="Firma"
                  style={{ ...feld, cursor: 'pointer', maxWidth: 170 }}>
                  <option value="" style={{ background: T.panel }}>— alle</option>
                  {plan.firmen.map(f => <option key={f.id} value={f.id} style={{ background: T.panel }}>{f.name}</option>)}
                </select>
              </label>
            )}
            <button onClick={() => patch(p.id, { sicher: !p.sicher })}
              style={{ fontFamily: T.sans, fontSize: 11.5, padding: '7px 12px', borderRadius: 8, cursor: 'pointer', border: `1px solid ${p.sicher ? T.accent : T.amber}`, background: p.sicher ? `${T.accent}1c` : `${T.amber}1c`, color: p.sicher ? T.accentInk : T.amber }}>
              {p.sicher ? 'sicher' : 'unsicher'}
            </button>
            {!p.sicher && !raus && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={lbl}>Wie sicher · {p.wahrscheinlich ?? 50}%</span>
                <input type="range" min={0} max={100} step={10} value={p.wahrscheinlich ?? 50}
                  onChange={e => patch(p.id, { wahrscheinlich: Number(e.target.value) })}
                  aria-label="Wahrscheinlichkeit"
                  title="Ab 60% zählt der Posten im realistischen Fall mit, ab 100% auch im schlechten"
                  style={{ width: 140, accentColor: T.accent, cursor: 'pointer' }} />
              </label>
            )}
            <button onClick={() => { setzePosten(posten.filter(x => x.id !== p.id)); setOffen(null); }}
              style={{ fontFamily: T.sans, fontSize: 11.5, padding: '7px 12px', borderRadius: 8, cursor: 'pointer', border: `1px solid ${T.line}`, background: 'transparent', color: T.muted }}>Löschen</button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ minHeight: '100vh', background: T.void, color: T.ink, fontFamily: T.sans }}>
      <div style={{ maxWidth: 940, margin: '0 auto', padding: '26px clamp(16px,3vw,36px) 56px' }}>
        <Link href="/os/finanzen" style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, textDecoration: 'none', display: 'inline-block', marginBottom: 8 }}>‹ Finanzen</Link>
        <div style={lbl}>Liquiditäts-Planung</div>
        <h1 style={{ fontSize: 25, fontWeight: 600, letterSpacing: '-.02em', margin: '6px 0 4px' }}>Wie viel Geld ist wann da.</h1>
        <p style={{ fontSize: 13.5, color: T.inkDim, maxWidth: 680, lineHeight: 1.5, marginBottom: 18 }}>
          Gerechnet aus dem, was ist — Kontostände, offene Rechnungen, fällige Zahlungen —
          und dem, was ihr erwartet. Was hier eingetragen ist, rechnet sofort mit.
        </p>

        {!v && <div style={{ ...panel, padding: '30px', color: T.muted, fontSize: 13 }}>lädt …</div>}

        {v && (
          <>
            {/* Der Verlauf */}
            <div style={{ ...panel, borderTop: `2px solid ${v.engpass ? T.crit : T.accent}`, padding: '18px 22px', marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
                <span style={lbl}>Verlauf</span>
                {[8, 12, 26, 52].map(w => (
                  <button key={w} onClick={() => setWochen(w)} style={{
                    fontFamily: T.mono, fontSize: 11, padding: '4px 10px', borderRadius: 7, cursor: 'pointer',
                    border: `1px solid ${wochen === w ? T.accent : T.line}`, background: wochen === w ? `${T.accent}1c` : 'transparent',
                    color: wochen === w ? T.accentInk : T.muted,
                  }}>{w} Wo.</button>
                ))}
                {plan && plan.firmen.length > 1 && (
                  <span style={{ marginLeft: 'auto', display: 'flex', gap: 5 }}>
                    {['alle', ...plan.firmen.map(f => f.id)].map(fid => {
                      const name = fid === 'alle' ? 'Alle Konten' : plan.firmen.find(f => f.id === fid)?.name.split(' ')[0] ?? fid;
                      const an = nurFirma === fid;
                      return (
                        <button key={fid} onClick={() => setNurFirma(fid)} style={{
                          fontFamily: T.mono, fontSize: 11, padding: '4px 10px', borderRadius: 7, cursor: 'pointer',
                          border: `1px solid ${an ? T.accent : T.line}`, background: an ? `${T.accent}1c` : 'transparent',
                          color: an ? T.accentInk : T.muted,
                        }}>{name}</button>
                      );
                    })}
                  </span>
                )}
              </div>

              {/* Ebene 2: drei Szenarien nebeneinander */}
              {dreiFaelle && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
                  {(['schlecht', 'real', 'gut'] as const).map(sz => {
                    const f = dreiFaelle[sz];
                    const an = szenario === sz;
                    const ende = f.wochen.at(-1)?.stand ?? 0;
                    const farbe = f.engpass ? T.crit : ende < 2000 ? T.amber : T.accent;
                    return (
                      <button key={sz} onClick={() => setSzenario(sz)} style={{
                        textAlign: 'left', padding: '10px 12px', borderRadius: 11, cursor: 'pointer',
                        border: `1px solid ${an ? farbe : T.line}`, background: an ? `${farbe}14` : T.panel2,
                      }}>
                        <div style={{ fontFamily: T.mono, fontSize: 9.5, color: T.muted, textTransform: 'uppercase', letterSpacing: '.08em' }}>{SZENARIO_LABEL[sz]}</div>
                        <div style={{ fontSize: 17, fontWeight: 700, color: an ? farbe : T.inkDim, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{eur(ende)}</div>
                        <div style={{ fontFamily: T.mono, fontSize: 10, color: f.engpass ? T.crit : T.muted }}>
                          {f.engpass ? `eng ab ${f.engpass.label}` : `Tief ${eur(f.tiefpunkt.stand)}`}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'baseline', marginBottom: 14 }}>
                <div>
                  <div style={lbl}>Heute</div>
                  <div style={{ fontSize: 24, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{eur(v.start)}</div>
                </div>
                <div>
                  <div style={lbl}>Tiefpunkt</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: v.tiefpunkt.stand < 0 ? T.crit : v.tiefpunkt.stand < 2000 ? T.amber : T.ink, fontVariantNumeric: 'tabular-nums' }}>{eur(v.tiefpunkt.stand)}</div>
                  <div style={{ fontFamily: T.mono, fontSize: 10.5, color: T.muted }}>{v.tiefpunkt.label}</div>
                </div>
                <div>
                  <div style={lbl}>Am Ende</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: (v.wochen.at(-1)?.stand ?? 0) < 0 ? T.crit : T.ink, fontVariantNumeric: 'tabular-nums' }}>{eur(v.wochen.at(-1)?.stand ?? 0)}</div>
                  <div style={{ fontFamily: T.mono, fontSize: 10.5, color: T.muted }}>in {wochen} Wochen</div>
                </div>
              </div>

              <div style={{ fontSize: 13, color: v.engpass ? T.crit : T.inkDim, lineHeight: 1.55, marginBottom: 14 }}>
                {v.engpass
                  ? <><b>Es wird eng {v.engpass.label}</b> — dann fehlen {eur(Math.abs(v.engpass.stand))}. Entweder kommt vorher Geld rein, oder Ausgaben müssen später.</>
                  : v.tiefpunkt.stand < 2000
                    ? <>Es reicht, aber knapp — im Tief bleiben {eur(v.tiefpunkt.stand)}.</>
                    : <>Trägt über den ganzen Zeitraum, tiefster Punkt {eur(v.tiefpunkt.stand)}.</>}
                {!!v.unsicher && <> {eur(v.unsicher)} sind in diesem Fall nicht mitgerechnet.</>}
              </div>

              {/* Balken */}
              {(() => {
                const maxAbs = Math.max(1, ...v.wochen.map(w => Math.abs(w.stand)));
                return (
                  <>
                    <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 110 }}>
                      {v.wochen.map(w => (
                        <div key={w.von} title={`${w.label} (${w.von.slice(8)}.${w.von.slice(5, 7)}.): ${eur(w.stand)}${w.bewegungen.length ? '\n' + w.bewegungen.map(b => `${b.datum.slice(8)}.${b.datum.slice(5, 7)}. ${b.betrag > 0 ? '+' : ''}${b.betrag} € ${b.text}`).join('\n') : '\nkeine Bewegung'}`}
                          style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
                          <div style={{
                            height: Math.max(3, Math.round((Math.abs(w.stand) / maxAbs) * 104)),
                            background: w.stand < 0 ? T.crit : w.stand < 2000 ? T.amber : T.accent,
                            opacity: w.bewegungen.length ? 0.9 : 0.3, borderRadius: '3px 3px 0 0',
                          }} />
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 2, marginTop: 4, fontFamily: T.mono, fontSize: 9, color: T.muted }}>
                      {v.wochen.map((w, i) => <div key={w.von} style={{ flex: 1, textAlign: 'center' }}>{i % Math.ceil(wochen / 8) === 0 ? `${w.von.slice(8)}.${w.von.slice(5, 7)}.` : ''}</div>)}
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Ebene 3: wohin das Geld geht */}
            {!!nachKategorie.length && (
              <div style={{ ...panel, padding: '16px 20px', marginBottom: 14 }}>
                <div style={{ ...lbl, marginBottom: 10 }}>Wohin es geht · {wochen} Wochen</div>
                {(() => {
                  const max = Math.max(...nachKategorie.map(k => Math.abs(k.betrag)), 1);
                  return nachKategorie.map(k => (
                    <div key={k.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '5px 0' }}>
                      <span style={{ fontSize: 12.5, color: T.inkDim, width: 165, flex: '0 0 auto' }}>{k.meta.label}</span>
                      <div style={{ flex: 1, height: 9, background: T.void, borderRadius: 5, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.round((Math.abs(k.betrag) / max) * 100)}%`, height: '100%', background: k.meta.farbe, borderRadius: 5 }} />
                      </div>
                      <span style={{ fontFamily: T.mono, fontSize: 12.5, fontWeight: 600, color: k.betrag > 0 ? T.accent : T.inkDim, width: 92, textAlign: 'right' }}>
                        {k.betrag > 0 ? '+' : '−'}{eur(Math.abs(k.betrag))}
                      </span>
                    </div>
                  ));
                })()}
              </div>
            )}

            {/* Kontostände */}
            {plan && (
              <div style={{ ...panel, padding: '14px 18px', marginBottom: 14 }}>
                <div style={{ ...lbl, marginBottom: 8 }}>Kontostände · der Startpunkt</div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {plan.firmen.map(f => (
                    <label key={f.id} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <span style={{ fontFamily: T.mono, fontSize: 10, color: T.muted }}>{f.name}</span>
                      <input type="number" value={f.kontostand ?? ''} onChange={e => kontostand(f.id, e.target.value)}
                        placeholder="—" aria-label={`Kontostand ${f.name}`} style={{ ...feld, width: 140, fontFamily: T.mono }} />
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Planposten */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14 }}>
              <div style={{ ...panel, borderTop: `2px solid ${T.accent}`, overflow: 'hidden' }}>
                <div style={{ padding: '13px 14px 10px', display: 'flex', alignItems: 'baseline', gap: 10 }}>
                  <span style={{ ...lbl, color: T.accent }}>Was reinkommt</span>
                  {!!monatEin && <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>≈ {eur(monatEin)}/Monat</span>}
                  <button onClick={() => anlegen(1)} style={{ marginLeft: 'auto', fontFamily: T.sans, fontSize: 11.5, padding: '3px 11px', borderRadius: 7, cursor: 'pointer', border: `1px dashed ${T.line}`, background: 'transparent', color: T.inkDim }}>+ Einnahme</button>
                </div>
                {ein.length ? ein.map(zeile) : <div style={{ padding: '14px', fontSize: 12.5, color: T.muted, borderTop: `1px solid ${T.lineSoft}` }}>Noch nichts geplant. Mandate, wiederkehrende Honorare, Gehalt.</div>}
              </div>

              <div style={{ ...panel, borderTop: `2px solid ${T.amber}`, overflow: 'hidden' }}>
                <div style={{ padding: '13px 14px 10px', display: 'flex', alignItems: 'baseline', gap: 10 }}>
                  <span style={{ ...lbl, color: T.amber }}>Was rausgeht</span>
                  {!!monatAus && <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>≈ {eur(monatAus)}/Monat</span>}
                  <button onClick={() => anlegen(-1)} style={{ marginLeft: 'auto', fontFamily: T.sans, fontSize: 11.5, padding: '3px 11px', borderRadius: 7, cursor: 'pointer', border: `1px dashed ${T.line}`, background: 'transparent', color: T.inkDim }}>+ Ausgabe</button>
                </div>
                {aus.length ? aus.map(zeile) : <div style={{ padding: '14px', fontSize: 12.5, color: T.muted, borderTop: `1px solid ${T.lineSoft}` }}>Noch nichts geplant. Miete, Versicherungen, Kreditraten, Steuern.</div>}
              </div>
            </div>

            {geladen && !posten.length && (
              <div style={{ ...panel, padding: '14px 18px', marginTop: 14, fontSize: 12.5, color: T.inkDim, lineHeight: 1.6 }}>
                Solange hier nichts steht, rechnet die Vorschau nur mit dem, was schon im Finanzplan liegt —
                also mit den erkannten Fixkosten aus den Merkposten. Sobald ihr eigene Posten eintragt,
                zählen nur noch diese: eine Wahrheit statt zwei.
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
              <Link href="/os/finanzen" style={{ fontSize: 12.5, color: T.accentInk, textDecoration: 'none', border: `1px solid ${T.line}`, borderRadius: 8, padding: '6px 12px' }}>Rechnungen & Zahlungen ›</Link>
              <Link href="/os/controlling" style={{ fontSize: 12.5, color: T.accentInk, textDecoration: 'none', border: `1px solid ${T.line}`, borderRadius: 8, padding: '6px 12px' }}>Controlling & Ziele ›</Link>
              <Link href="/os/finanzen/dashboard" style={{ fontSize: 12.5, color: T.accentInk, textDecoration: 'none', border: `1px solid ${T.line}`, borderRadius: 8, padding: '6px 12px' }}>Finanz-Dashboard ›</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
