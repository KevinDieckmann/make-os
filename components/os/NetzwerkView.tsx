'use client';

// ─── MAKE OS — Netzwerk & Pipeline ──────────────────────────────────────────
// Drei Sichten auf dasselbe: was liegen geblieben ist (der Geldhebel), die
// Pipeline nach Stufen, und die Kontakte selbst. Alles direkt bearbeitbar.

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { THEME as T } from '@/lib/make-one/os-data';
import { localDay } from '@/lib/zeit';
import { eur } from '@/lib/make-one/finance-data';
import {
  NAEHE_META, STUFEN, STUFE, OFFENE_STUFEN, pipelineWert, liegenGeblieben,
  type Kontakt, type Chance, type Naehe, type Stufe,
} from '@/lib/make-one/netzwerk-data';

const panel = { background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14 };
const lbl = { fontFamily: T.mono, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: T.muted };
const feld = { background: T.void, border: `1px solid ${T.line}`, borderRadius: 8, color: T.ink, fontFamily: T.sans, fontSize: 13, padding: '7px 10px', outline: 'none' };

type Sicht = 'liegt' | 'pipeline' | 'kontakte';

export function NetzwerkView() {
  const [kontakte, setKontakte] = useState<Kontakt[]>([]);
  const [chancen, setChancen] = useState<Chance[]>([]);
  const [geladen, setGeladen] = useState(false);
  const [sicht, setSicht] = useState<Sicht>('liegt');
  const [offen, setOffen] = useState<string | null>(null);
  const [suche, setSuche] = useState('');
  const [wer, setWer] = useState<'alle' | 'kevin' | 'malin' | 'beide'>('alle');
  const heute = localDay();

  useEffect(() => {
    fetch('/api/state/netzwerk').then(r => r.json()).then(d => {
      setKontakte(Array.isArray(d.kontakte) ? d.kontakte : []);
      setChancen(Array.isArray(d.chancen) ? d.chancen : []);
      setGeladen(true);
    }).catch(() => setGeladen(true));
  }, []);

  function speichern(k: Kontakt[], c: Chance[]) {
    setKontakte(k); setChancen(c);
    fetch('/api/state/netzwerk', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kontakte: k, chancen: c }) }).catch(() => {});
  }
  const patchK = (id: string, p: Partial<Kontakt>) => speichern(kontakte.map(k => k.id === id ? { ...k, ...p } : k), chancen);
  const patchC = (id: string, p: Partial<Chance>) => speichern(kontakte, chancen.map(c => c.id === id ? { ...c, ...p } : c));

  // ── Neu anlegen ──
  const [neu, setNeu] = useState('');
  function kontaktAnlegen() {
    const roh = neu.trim();
    if (!roh) return;
    // „Name, Firma" oder „Name (Rolle)" wird direkt zerlegt — schneller erfasst.
    const m = roh.match(/^(.+?)\s*[,·]\s*(.+)$/) ?? roh.match(/^(.+?)\s*\((.+)\)$/);
    const k: Kontakt = {
      id: `k-${Date.now().toString(36)}`,
      name: (m?.[1] ?? roh).trim(),
      firma: m?.[2]?.trim(),
      naehe: 'kalt',
      besitzer: 'kevin',
    };
    speichern([...kontakte, k], chancen);
    setNeu('');
    setSicht('kontakte');
    setOffen(k.id);
  }
  function chanceAnlegen(kontaktId: string) {
    const c: Chance = { id: `c-${Date.now().toString(36)}`, kontaktId, titel: 'Neue Chance', stufe: 'kontakt' };
    speichern(kontakte, [...chancen, c]);
  }

  const wert = useMemo(() => pipelineWert(chancen), [chancen]);
  const liegt = useMemo(() => liegenGeblieben(kontakte, chancen, heute), [kontakte, chancen, heute]);
  const sichtbar = useMemo(() => {
    const n = suche.trim().toLowerCase();
    return kontakte.filter(k => {
      if (wer !== 'alle' && k.besitzer !== wer) return false;
      if (!n) return true;
      return `${k.name} ${k.firma ?? ''} ${k.rolle ?? ''} ${k.notizen ?? ''}`.toLowerCase().includes(n);
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [kontakte, suche, wer]);

  const chancenVon = (kid: string) => chancen.filter(c => c.kontaktId === kid);
  const nameVon = (kid: string) => kontakte.find(k => k.id === kid)?.name ?? '—';

  /** Kontaktkarte — überall dieselbe, aufklappbar zum Bearbeiten. */
  const Karte = ({ k, i }: { k: Kontakt; i: number }) => {
    const auf = offen === k.id;
    const meine = chancenVon(k.id);
    const offeneW = meine.filter(c => OFFENE_STUFEN.includes(c.stufe)).reduce((s, c) => s + (c.wert ?? 0), 0);
    const nm = NAEHE_META[k.naehe];
    return (
      <div style={{ borderTop: i ? `1px solid ${T.lineSoft}` : 0, background: auf ? T.panel2 : 'transparent' }}>
        <div onClick={() => setOffen(auf ? null : k.id)} style={{ display: 'flex', gap: 12, padding: '11px 16px', alignItems: 'center', cursor: 'pointer' }}>
          <span style={{ width: 4, height: 30, borderRadius: 2, background: nm.farbe, flex: '0 0 auto' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>
              {k.name}
              {k.firma && <span style={{ color: T.muted, fontWeight: 400 }}> · {k.firma}</span>}
            </div>
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginTop: 3 }}>
              <span style={{ fontFamily: T.mono, fontSize: 9.5, color: nm.farbe, border: `1px solid ${nm.farbe}44`, borderRadius: 5, padding: '1px 6px' }}>{nm.label}</span>
              {k.rolle && <span style={{ fontSize: 11.5, color: T.muted }}>{k.rolle}</span>}
              {k.letzterKontakt && <span style={{ fontFamily: T.mono, fontSize: 10, color: T.muted }}>zuletzt {k.letzterKontakt.slice(8)}.{k.letzterKontakt.slice(5, 7)}.</span>}
              <span style={{ fontFamily: T.mono, fontSize: 10, color: T.muted }}>{k.besitzer === 'beide' ? 'Beide' : k.besitzer === 'malin' ? 'Malin' : 'Kevin'}</span>
              {!!meine.length && <span style={{ fontFamily: T.mono, fontSize: 10, color: T.accent }}>{meine.length} Chance{meine.length === 1 ? '' : 'n'}{offeneW ? ` · ${eur(offeneW)}` : ''}</span>}
            </div>
          </div>
          <span style={{ fontFamily: T.mono, fontSize: 12, color: T.muted }}>{auf ? '▾' : '▸'}</span>
        </div>

        {auf && (
          <div style={{ padding: '0 16px 14px 32px', display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              <input value={k.firma ?? ''} onChange={e => patchK(k.id, { firma: e.target.value })} placeholder="Firma" aria-label="Firma" style={{ ...feld, width: 170 }} />
              <input value={k.rolle ?? ''} onChange={e => patchK(k.id, { rolle: e.target.value })} placeholder="Rolle" aria-label="Rolle" style={{ ...feld, width: 170 }} />
              <input value={k.email ?? ''} onChange={e => patchK(k.id, { email: e.target.value })} placeholder="E-Mail" aria-label="E-Mail" style={{ ...feld, width: 200 }} />
              <input value={k.quelle ?? ''} onChange={e => patchK(k.id, { quelle: e.target.value })} placeholder="Woher kennen wir uns?" aria-label="Quelle" style={{ ...feld, flex: 1, minWidth: 160 }} />
            </div>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ ...lbl, width: 62 }}>Nähe</span>
              {(Object.keys(NAEHE_META) as Naehe[]).map(n => (
                <button key={n} onClick={() => patchK(k.id, { naehe: n })} title={`Melden alle ${NAEHE_META[n].takt} Tage`}
                  style={{ fontFamily: T.sans, fontSize: 11.5, padding: '4px 10px', borderRadius: 7, cursor: 'pointer', border: `1px solid ${k.naehe === n ? NAEHE_META[n].farbe : T.line}`, background: k.naehe === n ? `${NAEHE_META[n].farbe}1c` : 'transparent', color: k.naehe === n ? NAEHE_META[n].farbe : T.inkDim }}>
                  {NAEHE_META[n].label}
                </button>
              ))}
              <span style={{ ...lbl, width: 62, marginLeft: 8 }}>Wer hält</span>
              {(['kevin', 'malin', 'beide'] as const).map(p => (
                <button key={p} onClick={() => patchK(k.id, { besitzer: p })}
                  style={{ fontFamily: T.sans, fontSize: 11.5, padding: '4px 10px', borderRadius: 7, cursor: 'pointer', border: `1px solid ${k.besitzer === p ? T.accent : T.line}`, background: k.besitzer === p ? `${T.accent}1c` : 'transparent', color: k.besitzer === p ? T.accentInk : T.inkDim }}>
                  {p === 'beide' ? 'Beide' : p === 'kevin' ? 'Kevin' : 'Malin'}
                </button>
              ))}
              <button onClick={() => patchK(k.id, { letzterKontakt: heute })}
                style={{ marginLeft: 'auto', fontFamily: T.sans, fontSize: 11.5, fontWeight: 600, padding: '4px 12px', borderRadius: 7, cursor: 'pointer', border: `1px solid ${T.accent}`, background: `${T.accent}1c`, color: T.accentInk }}>
                ✓ heute gesprochen
              </button>
            </div>
            <textarea value={k.notizen ?? ''} onChange={e => patchK(k.id, { notizen: e.target.value })} rows={3}
              placeholder="Was wissen wir über ihn? Worüber haben wir gesprochen, was braucht er, wo können wir helfen?"
              aria-label="Notizen"
              style={{ ...feld, width: '100%', resize: 'vertical', lineHeight: 1.5 }} />

            {/* Chancen an diesem Kontakt */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={lbl}>Chancen</span>
              <button onClick={() => chanceAnlegen(k.id)} style={{ fontFamily: T.sans, fontSize: 11.5, padding: '3px 11px', borderRadius: 7, cursor: 'pointer', border: `1px dashed ${T.line}`, background: 'transparent', color: T.inkDim }}>+ Chance</button>
            </div>
            {meine.map(c => <ChanceZeile key={c.id} c={c} />)}
            <button onClick={() => { if (confirm(`${k.name} wirklich löschen?`)) { speichern(kontakte.filter(x => x.id !== k.id), chancen.filter(c => c.kontaktId !== k.id)); setOffen(null); } }}
              style={{ alignSelf: 'flex-start', fontFamily: T.sans, fontSize: 11.5, padding: '4px 10px', borderRadius: 7, cursor: 'pointer', border: `1px solid ${T.line}`, background: 'transparent', color: T.muted }}>Kontakt löschen</button>
          </div>
        )}
      </div>
    );
  };

  const ChanceZeile = ({ c }: { c: Chance }) => (
    <div style={{ background: T.void, border: `1px solid ${STUFE[c.stufe].farbe}33`, borderRadius: 10, padding: '9px 11px', display: 'flex', flexDirection: 'column', gap: 7 }}>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={c.titel} onChange={e => patchC(c.id, { titel: e.target.value })} aria-label="Titel der Chance"
          style={{ background: 'transparent', border: 'none', outline: 'none', color: T.ink, fontFamily: T.sans, fontSize: 13, fontWeight: 600, flex: 1, minWidth: 130 }} />
        <input type="number" value={c.wert ?? ''} onChange={e => patchC(c.id, { wert: Number(e.target.value) || undefined })} placeholder="€" aria-label="Wert"
          style={{ ...feld, width: 96, fontFamily: T.mono, fontSize: 12 }} />
        <button onClick={() => { if (confirm('Chance löschen?')) speichern(kontakte, chancen.filter(x => x.id !== c.id)); }} aria-label="Chance löschen"
          style={{ background: 'none', border: 'none', color: T.muted, cursor: 'pointer', fontSize: 12 }}>✕</button>
      </div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {STUFEN.map(s => (
          <button key={s.id} onClick={() => patchC(c.id, { stufe: s.id })}
            style={{ fontFamily: T.sans, fontSize: 11, padding: '3px 9px', borderRadius: 6, cursor: 'pointer', border: `1px solid ${c.stufe === s.id ? s.farbe : T.line}`, background: c.stufe === s.id ? `${s.farbe}1c` : 'transparent', color: c.stufe === s.id ? s.farbe : T.muted }}>{s.label}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={c.naechsterSchritt ?? ''} onChange={e => patchC(c.id, { naechsterSchritt: e.target.value })}
          placeholder="Nächster Schritt — ohne den verläuft es sich" aria-label="Nächster Schritt"
          style={{ ...feld, flex: 1, minWidth: 180, fontSize: 12, borderColor: c.naechsterSchritt ? T.line : `${T.amber}66` }} />
        <input type="date" value={c.faellig ?? ''} onChange={e => patchC(c.id, { faellig: e.target.value || undefined })} aria-label="Fällig am"
          style={{ ...feld, fontFamily: T.mono, fontSize: 11.5, colorScheme: 'dark' }} />
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: T.void, color: T.ink, fontFamily: T.sans }}>
      <div style={{ maxWidth: 940, margin: '0 auto', padding: '26px clamp(16px,3vw,36px) 56px' }}>
        <Link href="/os" style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, textDecoration: 'none', display: 'inline-block', marginBottom: 8 }}>‹ Übersicht</Link>
        <div style={lbl}>Netzwerk</div>
        <h1 style={{ fontSize: 25, fontWeight: 600, letterSpacing: '-.02em', margin: '6px 0 4px' }}>
          {kontakte.length} {kontakte.length === 1 ? 'Kontakt' : 'Kontakte'}
          {wert.anzahl > 0 && <span style={{ fontSize: 15, fontWeight: 600, color: T.accent, marginLeft: 12 }}>{eur(wert.gewichtet)} gewichtet</span>}
        </h1>
        <p style={{ fontSize: 13, color: T.inkDim, marginBottom: 16 }}>
          {wert.anzahl > 0
            ? <>{wert.anzahl} offene Chancen über {eur(wert.roh)} — nach Abschluss-Wahrscheinlichkeit der Stufen {eur(wert.gewichtet)}.</>
            : <>Noch keine Chancen erfasst. Das Geld liegt im Nachhalten, nicht im Sammeln.</>}
        </p>

        {/* Anlegen */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <input value={neu} onChange={e => setNeu(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') kontaktAnlegen(); }}
            placeholder="Name, Firma — Enter legt an" aria-label="Neuer Kontakt" style={{ ...feld, flex: 1, fontSize: 13.5, padding: '10px 13px' }} />
          <button onClick={kontaktAnlegen} style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 700, padding: '9px 17px', borderRadius: 8, border: 'none', background: T.accent, color: '#04110F', cursor: 'pointer' }}>+ Kontakt</button>
        </div>

        {/* Sichten */}
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
          {([['liegt', `Liegt liegen${liegt.length ? ` · ${liegt.length}` : ''}`], ['pipeline', 'Pipeline'], ['kontakte', 'Kontakte']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setSicht(k)} style={{
              fontFamily: T.sans, fontSize: 12.5, fontWeight: 600, padding: '6px 14px', borderRadius: 9, cursor: 'pointer',
              border: `1px solid ${sicht === k ? T.lineHot : T.line}`, background: sicht === k ? T.accentSoft : 'transparent',
              color: sicht === k ? T.accentInk : T.inkDim,
            }}>{label}</button>
          ))}
          <span style={{ width: 1, height: 20, background: T.line, margin: '0 3px' }} />
          {(['alle', 'kevin', 'malin', 'beide'] as const).map(p => (
            <button key={p} onClick={() => setWer(p)} style={{
              fontFamily: T.mono, fontSize: 11, padding: '5px 10px', borderRadius: 8, cursor: 'pointer',
              border: `1px solid ${wer === p ? T.lineHot : T.line}`, background: 'transparent', color: wer === p ? T.accentInk : T.muted,
            }}>{p === 'alle' ? 'Jeder' : p === 'beide' ? 'Beide' : p === 'kevin' ? 'Kevin' : 'Malin'}</button>
          ))}
          <input value={suche} onChange={e => setSuche(e.target.value)} placeholder="suchen …" aria-label="Kontakte durchsuchen"
            style={{ ...feld, marginLeft: 'auto', width: 160, fontSize: 12 }} />
        </div>

        {!geladen && <div style={{ ...panel, padding: '30px', textAlign: 'center', color: T.muted, fontSize: 13 }}>lädt …</div>}

        {geladen && !kontakte.length && (
          <div style={{ ...panel, padding: '30px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 6 }}>Noch niemand drin.</div>
            <div style={{ fontSize: 13, color: T.inkDim, lineHeight: 1.6, maxWidth: 480, margin: '0 auto' }}>
              Fangt mit den zwanzig wichtigsten an — die, bei denen euch sofort etwas einfällt.
              Oben eintippen, Nähe setzen, kurz notieren was ihr wisst. Alles Weitere wächst daran.
            </div>
          </div>
        )}

        {/* ── LIEGT LIEGEN: der Geldhebel ── */}
        {geladen && !!kontakte.length && sicht === 'liegt' && (
          liegt.length ? (
            <div style={{ ...panel, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px 8px' }}>
                <span style={lbl}>Was hinten runterfällt</span>
                <div style={{ fontSize: 12.5, color: T.muted, marginTop: 3 }}>Dringendstes zuerst. Jede Zeile ist Geld oder eine Beziehung, die gerade kalt wird.</div>
              </div>
              {liegt.slice(0, 40).map((l, i) => {
                const farbe = l.art === 'schritt-faellig' ? T.crit : l.art === 'ohne-schritt' ? T.amber : T.inkDim;
                return (
                  <div key={`${l.kontaktId}-${l.chanceId ?? l.art}-${i}`}
                    onClick={() => { setSicht('kontakte'); setOffen(l.kontaktId); }}
                    style={{ display: 'flex', gap: 11, padding: '10px 16px', alignItems: 'center', borderTop: `1px solid ${T.lineSoft}`, cursor: 'pointer' }}>
                    <span style={{ color: farbe, fontSize: 11, flex: '0 0 auto' }}>{l.art === 'stumm' ? '◷' : l.art === 'ohne-schritt' ? '◇' : '●'}</span>
                    <span style={{ fontSize: 13, color: T.inkDim, flex: 1, lineHeight: 1.4 }}>{l.text}</span>
                    <span style={{ fontFamily: T.mono, fontSize: 10.5, color: T.muted }}>öffnen ›</span>
                  </div>
                );
              })}
              {liegt.length > 40 && <div style={{ padding: '10px 16px', fontFamily: T.mono, fontSize: 10.5, color: T.muted, borderTop: `1px solid ${T.lineSoft}` }}>+{liegt.length - 40} weitere</div>}
            </div>
          ) : (
            <div style={{ ...panel, padding: '28px', textAlign: 'center', color: T.inkDim, fontSize: 13.5 }}>
              Nichts liegen geblieben. Jede Chance hat einen nächsten Schritt, kein Kontakt ist zu lange still. 🎯
            </div>
          )
        )}

        {/* ── PIPELINE: nach Stufen ── */}
        {geladen && !!kontakte.length && sicht === 'pipeline' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12, alignItems: 'start' }}>
            {STUFEN.filter(s => s.id !== 'verloren').map(s => {
              const drin = chancen.filter(c => c.stufe === s.id);
              const summe = drin.reduce((sum, c) => sum + (c.wert ?? 0), 0);
              return (
                <div key={s.id} style={{ ...panel, borderTop: `3px solid ${s.farbe}`, overflow: 'hidden' }}>
                  <div style={{ padding: '11px 14px 8px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: s.farbe }}>{s.label}</span>
                      <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, marginLeft: 'auto' }}>{drin.length}</span>
                    </div>
                    {!!summe && <div style={{ fontFamily: T.mono, fontSize: 11, color: T.inkDim, marginTop: 2 }}>{eur(summe)}</div>}
                  </div>
                  {drin.map(c => (
                    <div key={c.id} onClick={() => { setSicht('kontakte'); setOffen(c.kontaktId); }}
                      style={{ padding: '9px 14px', borderTop: `1px solid ${T.lineSoft}`, cursor: 'pointer' }}>
                      <div style={{ fontSize: 12.5, color: T.ink, fontWeight: 550 }}>{c.titel}</div>
                      <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
                        {nameVon(c.kontaktId)}{c.wert ? ` · ${eur(c.wert)}` : ''}
                      </div>
                      {c.naechsterSchritt
                        ? <div style={{ fontSize: 11, color: c.faellig && c.faellig < heute ? T.crit : T.inkDim, marginTop: 3 }}>→ {c.naechsterSchritt}{c.faellig ? ` (${c.faellig.slice(8)}.${c.faellig.slice(5, 7)}.)` : ''}</div>
                        : <div style={{ fontSize: 11, color: T.amber, marginTop: 3 }}>→ kein nächster Schritt</div>}
                    </div>
                  ))}
                  {!drin.length && <div style={{ padding: '12px 14px', fontSize: 12, color: T.muted, borderTop: `1px solid ${T.lineSoft}` }}>leer</div>}
                </div>
              );
            })}
          </div>
        )}

        {/* ── KONTAKTE ── */}
        {geladen && !!kontakte.length && sicht === 'kontakte' && (
          <div style={{ ...panel, overflow: 'hidden' }}>
            {sichtbar.map((k, i) => <Karte key={k.id} k={k} i={i} />)}
            {!sichtbar.length && <div style={{ padding: '24px', textAlign: 'center', color: T.muted, fontSize: 13 }}>Kein Treffer.</div>}
          </div>
        )}

        <div style={{ marginTop: 18, fontFamily: T.mono, fontSize: 10.5, color: T.muted }}>
          Euer Netzwerk — liegt lokal, gehört euch. Nähe bestimmt den Melde-Takt: eng 30 · warm 90 · lose 180 Tage.
        </div>
      </div>
    </div>
  );
}
