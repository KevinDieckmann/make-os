'use client';

// ─── MAKE OS — Kompass ──────────────────────────────────────────────────────
// Ein Ort für alles, was steuert: die Fokus-Regler, die Reihenfolge der
// Themen, eigene Filter und eigene Stichworte. Was hier steht, wirkt überall
// in der Software — Aufgaben, Tag, Dashboard, Postfach.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { THEME as T } from '@/lib/make-one/os-data';
import { SAEULE_LABEL, SAEULE_FARBE, FOKUS_SCHWELLE } from '@/lib/make-one/fokus-data';
import { THEMEN, THEMA, STANDARD_ORDNUNG, sortierteThemen } from '@/lib/make-one/ordnung-data';
import { ORGS } from '@/lib/make-one/organisation-data';
import { STICHWORTE } from '@/lib/make-one/stichworte-data';
import { FAECHER } from '@/lib/make-one/inbox-data';
import { WER_LABEL } from '@/lib/make-one/umsetzung-data';

const panel = { background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14 };
const lbl = { fontFamily: T.mono, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: T.muted };
const feld = { background: T.void, border: `1px solid ${T.line}`, borderRadius: 8, color: T.ink, fontFamily: T.sans, fontSize: 13, padding: '8px 11px', outline: 'none' };

const SAEULEN = ['health', 'business', 'planning', 'finance', 'social'] as const;
type SaeuleKey = typeof SAEULEN[number];

interface EigenerFilter {
  id: string; name: string; wo: 'aufgaben' | 'inbox';
  themen?: string[]; orgs?: string[]; prios?: string[]; stichworte?: string[]; wege?: string[]; faecher?: string[];
  besitzer?: string; suche?: string;
}
interface EigenesStichwort { id: string; label: string; thema: string; woerter: string[]; kpi?: boolean }

const PRIOS = [['critical', 'kritisch'], ['high', 'hoch'], ['medium', 'mittel'], ['low', 'niedrig']] as const;

export function KompassView() {
  // ── Fokus-Regler ──
  const [regler, setRegler] = useState<Record<string, number>>({ health: 50, business: 50, planning: 50, finance: 50, social: 50 });
  const [geladen, setGeladen] = useState(false);
  useEffect(() => {
    fetch('/api/state/fokus-regler').then(r => r.json()).then(d => { if (d.regler) setRegler(d.regler); setGeladen(true); }).catch(() => setGeladen(true));
  }, []);
  function reglerSetzen(k: SaeuleKey, v: number) {
    const next = { ...regler, [k]: v };
    setRegler(next);
    fetch('/api/state/fokus-regler', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ regler: next }) }).catch(() => {});
  }

  // ── Reihenfolge der Themen ──
  const [reihenfolge, setReihenfolge] = useState<string[]>(STANDARD_ORDNUNG);
  useEffect(() => {
    fetch('/api/state/ordnung').then(r => r.json()).then(d => { if (Array.isArray(d.reihenfolge) && d.reihenfolge.length) setReihenfolge(d.reihenfolge); }).catch(() => {});
  }, []);
  function schieben(id: string, richtung: -1 | 1) {
    const i = reihenfolge.indexOf(id), j = i + richtung;
    if (i < 0 || j < 0 || j >= reihenfolge.length) return;
    const next = [...reihenfolge];
    [next[i], next[j]] = [next[j], next[i]];
    setReihenfolge(next);
    fetch('/api/state/ordnung', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reihenfolge: next }) }).catch(() => {});
  }

  // ── Eigene Filter & Stichworte ──
  const [filter, setFilter] = useState<EigenerFilter[]>([]);
  const [eigene, setEigene] = useState<EigenesStichwort[]>([]);
  useEffect(() => {
    fetch('/api/state/filter').then(r => r.json()).then(d => {
      setFilter(Array.isArray(d.filter) ? d.filter : []);
      setEigene(Array.isArray(d.stichworte) ? d.stichworte : []);
    }).catch(() => {});
  }, []);
  function speichern(next: { filter?: EigenerFilter[]; stichworte?: EigenesStichwort[] }) {
    if (next.filter) setFilter(next.filter);
    if (next.stichworte) setEigene(next.stichworte);
    fetch('/api/state/filter', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filter: next.filter ?? filter, stichworte: next.stichworte ?? eigene }),
    }).catch(() => {});
  }

  const [neuName, setNeuName] = useState('');
  const [offenId, setOffenId] = useState<string | null>(null);
  function filterAnlegen() {
    const name = neuName.trim();
    if (!name) return;
    const f: EigenerFilter = { id: `f-${Date.now().toString(36)}`, name, wo: 'aufgaben', themen: [], orgs: [], prios: [], stichworte: [], wege: [] };
    speichern({ filter: [...filter, f] });
    setNeuName('');
    setOffenId(f.id);
  }
  const patch = (id: string, p: Partial<EigenerFilter>) => speichern({ filter: filter.map(f => f.id === id ? { ...f, ...p } : f) });
  /** Wert in einer Mehrfachauswahl an- oder abwählen. */
  const kippen = (liste: string[] | undefined, wert: string) =>
    (liste ?? []).includes(wert) ? (liste ?? []).filter(x => x !== wert) : [...(liste ?? []), wert];

  const [swLabel, setSwLabel] = useState('');
  const [swWoerter, setSwWoerter] = useState('');
  const [swThema, setSwThema] = useState('umsatz');
  function stichwortAnlegen() {
    const label = swLabel.trim();
    if (!label) return;
    const woerter = swWoerter.split(',').map(w => w.trim()).filter(Boolean);
    speichern({ stichworte: [...eigene, { id: `eig-${Date.now().toString(36)}`, label, thema: swThema, woerter: woerter.length ? woerter : [label] }] });
    setSwLabel(''); setSwWoerter('');
  }

  const themen = sortierteThemen(reihenfolge);
  const summe = SAEULEN.reduce((a, k) => a + (regler[k] ?? 50), 0);

  /** Ein Auswahl-Chip in den Filter-Einstellungen. */
  const chip = (an: boolean, farbe: string, text: string, onClick: () => void, key: string) => (
    <button key={key} onClick={onClick} style={{
      fontFamily: T.sans, fontSize: 11.5, padding: '4px 10px', borderRadius: 7, cursor: 'pointer',
      border: `1px solid ${an ? farbe : T.line}`, background: an ? `${farbe}1c` : 'transparent', color: an ? farbe : T.inkDim,
    }}>{text}</button>
  );

  return (
    <div style={{ minHeight: '100vh', background: T.void, color: T.ink, fontFamily: T.sans }}>
      <div style={{ maxWidth: 940, margin: '0 auto', padding: '26px clamp(16px,3vw,36px) 56px' }}>
        <Link href="/os" style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, textDecoration: 'none', display: 'inline-block', marginBottom: 8 }}>‹ Übersicht</Link>
        <div style={lbl}>Kompass</div>
        <h1 style={{ fontSize: 25, fontWeight: 600, letterSpacing: '-.02em', margin: '6px 0 4px' }}>Woran sich alles ausrichtet.</h1>
        <p style={{ fontSize: 13.5, color: T.inkDim, maxWidth: 660, lineHeight: 1.5, marginBottom: 20 }}>
          Alle Regler an einem Ort. Was hier steht, wirkt überall — in den Aufgaben, im Tag, auf dem Dashboard und im Postfach.
        </p>

        {/* ── Fokus-Regler ── */}
        <div style={{ ...panel, padding: '16px 20px', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={lbl}>Fokus</span>
            <span style={{ fontSize: 12.5, color: T.muted }}>Wie stark jede Säule gerade zieht — ab {FOKUS_SCHWELLE} wandern ihre Aufgaben nach oben.</span>
            <span style={{ marginLeft: 'auto', fontFamily: T.mono, fontSize: 11, color: summe > 300 ? T.amber : T.muted }}>
              Summe {summe}{summe > 300 ? ' · viel gleichzeitig' : ''}
            </span>
          </div>
          {!geladen ? <div style={{ fontFamily: T.mono, fontSize: 12, color: T.muted }}>lädt …</div> : SAEULEN.map(k => {
            const v = regler[k] ?? 50;
            const farbe = SAEULE_FARBE[k] ?? T.accent;
            return (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderTop: `1px solid ${T.lineSoft}` }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: v >= FOKUS_SCHWELLE ? farbe : T.inkDim, width: 150, flex: '0 0 auto' }}>{SAEULE_LABEL[k] ?? k}</span>
                <input type="range" min={0} max={100} step={5} value={v} onChange={e => reglerSetzen(k, Number(e.target.value))}
                  aria-label={`Fokus ${SAEULE_LABEL[k] ?? k}`}
                  style={{ flex: 1, accentColor: farbe, cursor: 'pointer' }} />
                <span style={{ fontFamily: T.mono, fontSize: 12, color: v >= FOKUS_SCHWELLE ? farbe : T.muted, width: 34, textAlign: 'right' }}>{v}</span>
              </div>
            );
          })}
        </div>

        {/* ── Reihenfolge der Themen ── */}
        <div style={{ ...panel, padding: '16px 20px', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
            <span style={lbl}>Unsere Ordnung</span>
            <span style={{ fontSize: 12.5, color: T.muted }}>Was zuerst zählt, wenn alles wichtig ist. Nur Kritisches bricht diese Reihenfolge.</span>
          </div>
          {themen.map((b, i) => (
            <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '8px 0', borderTop: i ? `1px solid ${T.lineSoft}` : 0 }}>
              <span style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 700, color: b.farbe, width: 16 }}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{b.label}</div>
                <div style={{ fontSize: 11.5, color: T.muted }}>{b.satz}</div>
              </div>
              <button onClick={() => schieben(b.id, -1)} disabled={i === 0} aria-label="Nach oben"
                style={{ background: 'transparent', border: `1px solid ${T.line}`, borderRadius: 7, color: i === 0 ? T.line : T.inkDim, padding: '3px 9px', cursor: i === 0 ? 'default' : 'pointer' }}>▲</button>
              <button onClick={() => schieben(b.id, 1)} disabled={i === themen.length - 1} aria-label="Nach unten"
                style={{ background: 'transparent', border: `1px solid ${T.line}`, borderRadius: 7, color: i === themen.length - 1 ? T.line : T.inkDim, padding: '3px 9px', cursor: i === themen.length - 1 ? 'default' : 'pointer' }}>▼</button>
            </div>
          ))}
        </div>

        {/* ── Eigene Filter ── */}
        <div style={{ ...panel, padding: '16px 20px', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            <span style={lbl}>Eigene Filter</span>
            <span style={{ fontSize: 12.5, color: T.muted }}>Eine Auswahl einmal einstellen, dann jederzeit mit einem Klick aufrufen.</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input value={neuName} onChange={e => setNeuName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') filterAnlegen(); }}
              placeholder="Name, z. B. Was Malin heute macht — oder: Alles zum Steuerberater" aria-label="Neuer Filter"
              style={{ ...feld, flex: 1 }} />
            <button onClick={filterAnlegen} style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 700, padding: '8px 16px', borderRadius: 8, border: 'none', background: T.accent, color: '#04110F', cursor: 'pointer' }}>+ Anlegen</button>
          </div>

          {!filter.length && <div style={{ fontSize: 12.5, color: T.muted }}>Noch keine eigenen Filter. Leg einen an — er erscheint dann oben im Taskmanagement.</div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filter.map(f => {
              const auf = offenId === f.id;
              const teile = [
                ...(f.themen ?? []).map(x => THEMA[x]?.label),
                ...(f.orgs ?? []).map(x => ORGS.find(o => o.id === x)?.kurz),
                ...(f.prios ?? []).map(x => PRIOS.find(p => p[0] === x)?.[1]),
                ...(f.wege ?? []).map(x => WER_LABEL[x as keyof typeof WER_LABEL]),
                ...(f.stichworte ?? []).map(x => STICHWORTE.find(s => s.id === x)?.label ?? eigene.find(s => s.id === x)?.label),
              ].filter(Boolean);
              return (
                <div key={f.id} style={{ background: T.panel2, border: `1px solid ${T.line}`, borderRadius: 10, padding: '10px 13px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <input value={f.name} onChange={e => patch(f.id, { name: e.target.value })}
                      aria-label="Filtername"
                      style={{ background: 'transparent', border: 'none', outline: 'none', color: T.ink, fontFamily: T.sans, fontSize: 13.5, fontWeight: 600, flex: 1, minWidth: 140 }} />
                    <span style={{ fontFamily: T.mono, fontSize: 10, color: T.muted }}>{f.wo === 'inbox' ? 'Postfach' : 'Aufgaben'}</span>
                    <button onClick={() => setOffenId(auf ? null : f.id)} style={{ background: 'transparent', border: `1px solid ${T.line}`, borderRadius: 7, color: T.inkDim, padding: '3px 10px', fontSize: 11.5, cursor: 'pointer' }}>{auf ? 'Fertig' : 'Einstellen'}</button>
                    <button onClick={() => speichern({ filter: filter.filter(x => x.id !== f.id) })} aria-label="Filter löschen"
                      style={{ background: 'transparent', border: 'none', color: T.muted, cursor: 'pointer', fontSize: 13 }}>✕</button>
                  </div>
                  {!auf && teile.length > 0 && <div style={{ fontSize: 11.5, color: T.muted, marginTop: 3 }}>{teile.join(' · ')}</div>}
                  {!auf && !teile.length && <div style={{ fontSize: 11.5, color: T.amber, marginTop: 3 }}>Noch nichts eingestellt — „Einstellen" klicken.</div>}

                  {auf && (
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 9 }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ ...lbl, width: 74 }}>Gilt für</span>
                        {chip(f.wo === 'aufgaben', T.accent, 'Aufgaben', () => patch(f.id, { wo: 'aufgaben' }), 'w-a')}
                        {chip(f.wo === 'inbox', T.accent, 'Postfach', () => patch(f.id, { wo: 'inbox' }), 'w-i')}
                      </div>
                      {f.wo === 'aufgaben' ? (
                        <>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                            <span style={{ ...lbl, width: 74 }}>Thema</span>
                            {THEMEN.map(b => chip((f.themen ?? []).includes(b.id), b.farbe, b.label, () => patch(f.id, { themen: kippen(f.themen, b.id) }), b.id))}
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                            <span style={{ ...lbl, width: 74 }}>Ort</span>
                            {ORGS.map(o => chip((f.orgs ?? []).includes(o.id), o.farbe, o.kurz, () => patch(f.id, { orgs: kippen(f.orgs, o.id) }), o.id))}
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                            <span style={{ ...lbl, width: 74 }}>Stufe</span>
                            {PRIOS.map(([k, label]) => chip((f.prios ?? []).includes(k), T.accent, label, () => patch(f.id, { prios: kippen(f.prios, k) }), k))}
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                            <span style={{ ...lbl, width: 74 }}>Weg</span>
                            {(['jarvis', 'gemeinsam', 'mensch'] as const).map(w => chip((f.wege ?? []).includes(w), T.accent, WER_LABEL[w], () => patch(f.id, { wege: kippen(f.wege, w) }), w))}
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                            <span style={{ ...lbl, width: 74 }}>Wer</span>
                            {(['kevin', 'malin', 'both'] as const).map(p => chip(f.besitzer === p, T.accent, p === 'both' ? 'Beide' : p === 'kevin' ? 'Kevin' : 'Malin', () => patch(f.id, { besitzer: f.besitzer === p ? undefined : p }), p))}
                          </div>
                        </>
                      ) : (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{ ...lbl, width: 74 }}>Fach</span>
                          {FAECHER.map(fa => chip((f.faecher ?? []).includes(fa.id), fa.farbe, fa.label, () => patch(f.id, { faecher: kippen(f.faecher, fa.id) }), fa.id))}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ ...lbl, width: 74 }}>Text</span>
                        <input value={f.suche ?? ''} onChange={e => patch(f.id, { suche: e.target.value })}
                          placeholder="muss im Text vorkommen (optional)" aria-label="Suchtext"
                          style={{ ...feld, flex: 1, fontSize: 12 }} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Eigene Stichworte ── */}
        <div style={{ ...panel, padding: '16px 20px', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            <span style={lbl}>Eigene Stichworte</span>
            <span style={{ fontSize: 12.5, color: T.muted }}>{STICHWORTE.length} sind eingebaut — hier kommen eure eigenen dazu.</span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <input value={swLabel} onChange={e => setSwLabel(e.target.value)} placeholder="Name, z. B. Zoo Palais"
              aria-label="Name des Stichworts" style={{ ...feld, width: 190 }} />
            <input value={swWoerter} onChange={e => setSwWoerter(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') stichwortAnlegen(); }}
              placeholder="Wörter zum Erkennen, mit Komma getrennt" aria-label="Erkennungswörter" style={{ ...feld, flex: 1, minWidth: 200 }} />
            <select value={swThema} onChange={e => setSwThema(e.target.value)} aria-label="Thema"
              style={{ ...feld, cursor: 'pointer' }}>
              {THEMEN.map(b => <option key={b.id} value={b.id} style={{ background: T.panel }}>{b.label}</option>)}
            </select>
            <button onClick={stichwortAnlegen} style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 700, padding: '8px 16px', borderRadius: 8, border: 'none', background: T.accent, color: '#04110F', cursor: 'pointer' }}>+ Anlegen</button>
          </div>
          {!eigene.length && <div style={{ fontSize: 12.5, color: T.muted }}>Noch keine eigenen. Beispiel: Name „Zoo Palais", Wörter „Zoo Palais, Pressekonferenz, Volllaunch".</div>}
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {eigene.map(s => (
              <span key={s.id} title={s.woerter.join(', ')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, color: T.inkDim, border: `1px solid ${THEMA[s.thema]?.farbe ?? T.line}55`, borderRadius: 999, padding: '4px 11px' }}>
                {s.label}
                <span style={{ fontFamily: T.mono, fontSize: 9.5, color: T.muted }}>{s.woerter.length} Wörter</span>
                <button onClick={() => speichern({ stichworte: eigene.filter(x => x.id !== s.id) })} aria-label="Stichwort löschen"
                  style={{ background: 'none', border: 'none', color: T.muted, cursor: 'pointer', padding: 0, fontSize: 11 }}>✕</button>
              </span>
            ))}
          </div>
        </div>

        {/* ── Wo das noch wirkt ── */}
        <div style={{ ...panel, padding: '14px 20px' }}>
          <div style={{ ...lbl, marginBottom: 8 }}>Weiter einstellen</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { href: '/os/aufgaben', label: 'Aufgaben · Stichworte je Aufgabe' },
              { href: '/os/inbox', label: 'Postfach · Türsteher & Fächer' },
              { href: '/os/datenbasis', label: 'Datenbasis · Quellen & Verbindungen' },
              { href: '/os/planung/jahr', label: 'Jahr · Ziele & Meilensteine' },
              { href: '/os/bauplan', label: 'Bauplan · was wir noch bauen' },
            ].map(l => (
              <Link key={l.href} href={l.href} style={{ fontSize: 12.5, color: T.accentInk, textDecoration: 'none', border: `1px solid ${T.line}`, borderRadius: 8, padding: '6px 12px' }}>{l.label} ›</Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
