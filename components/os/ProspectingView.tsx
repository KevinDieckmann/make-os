'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { THEME as T } from '@/lib/make-one/os-data';
import {
  DEFAULT_ICP, PROSPECT_STATUS_ORDER, PROSPECT_STATUS_LABEL, PIPELINE_HINT,
  type Prospect, type ProspectStatus, type ProspectsState,
} from '@/lib/make-one/prospecting-data';
import { Seitenkopf } from './Seitenkopf';

const lbl = { fontFamily: T.mono, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: T.muted };
const panel = { background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14 };

const scoreColor = (s?: number) => (s == null ? T.muted : s >= 80 ? T.accent : s >= 50 ? T.amber : T.crit);
const statusColor = (s: ProspectStatus) => (s === 'kontaktiert' ? T.accent : s === 'qualifiziert' ? T.accentInk : s === 'verworfen' ? T.crit : T.muted);

export function ProspectingView() {
  const [icp, setIcp] = useState(DEFAULT_ICP);
  const [rows, setRows] = useState<Prospect[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [bulk, setBulk] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [newName, setNewName] = useState('');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Ohne geladenen Stand wird nicht gespeichert — sonst ersetzt der erste
  // neue Eintrag die ganze Zielkundenliste.
  const [ladeFehler, setLadeFehler] = useState(false);
  useEffect(() => {
    fetch('/api/state/prospects')
      .then(r => { if (!r.ok) throw new Error(`Status ${r.status}`); return r.json(); })
      .then((d: { state: ProspectsState | null }) => {
        if (d.state) { setIcp(d.state.icp || DEFAULT_ICP); setRows(d.state.prospects || []); }
        setLoaded(true);
      })
      .catch(err => {
        console.error('[MAKE OS] Zielkunden konnten nicht geladen werden — Speichern gesperrt.', err);
        setLadeFehler(true);
        setLoaded(true);
      });
  }, []);

  function persist(nextIcp: string, nextRows: Prospect[]) {
    if (ladeFehler) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch('/api/state/prospects', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ icp: nextIcp, prospects: nextRows }) }).catch(() => {});
    }, 400);
  }
  const setRowsP = (next: Prospect[]) => { setRows(next); persist(icp, next); };
  const setIcpP = (v: string) => { setIcp(v); persist(v, rows); };

  async function score(p: Prospect): Promise<Prospect> {
    const r = await fetch('/api/prospecting/score', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prospect: p, icp }) });
    const d = await r.json();
    if (d.error && d.score == null) return p;
    return { ...p, score: d.score, fit: d.fit, angle: d.angle, status: p.status === 'neu' ? 'qualifiziert' : p.status };
  }

  async function scoreOne(p: Prospect) {
    setBusy(b => ({ ...b, [p.id]: true }));
    const upd = await score(p);
    const next = rows.map(x => x.id === p.id ? upd : x);
    setRows(next);
    persist(icp, next);
    setBusy(b => ({ ...b, [p.id]: false }));
  }

  async function scoreAll() {
    setBulk(true);
    const todo = rows.filter(p => p.score == null);
    // Über die Schleife hinweg mitzählen: `rows` aus dem Abschluss wäre nach
    // dem ersten await veraltet, und der Speichervorgang gehört nicht in den
    // State-Updater — React darf den mehrfach aufrufen.
    let aktuell = rows;
    for (const p of todo) {
      const upd = await score(p);
      aktuell = aktuell.map(x => x.id === p.id ? upd : x);
      setRows(aktuell);
      persist(icp, aktuell);
    }
    setBulk(false);
  }

  function cycleStatus(p: Prospect) {
    const i = PROSPECT_STATUS_ORDER.indexOf(p.status);
    const next = PROSPECT_STATUS_ORDER[(i + 1) % PROSPECT_STATUS_ORDER.length];
    setRowsP(rows.map(x => x.id === p.id ? { ...x, status: next } : x));
  }

  // ── Outreach-Agent: Erstansprache in Kevins Stimme (Entwurf — Versand bei dir) ──
  const [entwurf, setEntwurf] = useState<{ fuer: string; betreff: string; email: string; linkedin: string; hinweis: string } | null>(null);
  const [entwurfBusy, setEntwurfBusy] = useState<string | null>(null);
  const [mailInfo, setMailInfo] = useState('');

  async function ansprache(p: Prospect) {
    setEntwurfBusy(p.id); setEntwurf(null); setMailInfo('');
    try {
      const r = await fetch('/api/outreach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prospect: p, icp }) });
      const d = await r.json();
      if (d.email) setEntwurf({ fuer: p.id, betreff: d.betreff ?? '', email: d.email, linkedin: d.linkedin ?? '', hinweis: d.hinweis ?? '' });
    } catch { /* still */ }
    setEntwurfBusy(null);
  }

  async function inMailOeffnen() {
    if (!entwurf) return;
    setMailInfo('öffne …');
    try {
      const r = await fetch('/api/apple-mail/draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: '', subject: entwurf.betreff, body: entwurf.email }) });
      const d = await r.json();
      setMailInfo(d.ok ? '✓ In Apple Mail geöffnet — Empfänger eintragen, prüfen, selbst senden.' : (d.error ?? 'Konnte Mail nicht öffnen.'));
    } catch { setMailInfo('Apple Mail nicht erreichbar.'); }
  }

  function addManual() {
    const name = newName.trim();
    if (!name) return;
    const p: Prospect = { id: `p-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${rows.length}`, company: name, status: 'neu', region: 'DACH', addedAt: '' , source: 'manuell' };
    setRowsP([p, ...rows]); setNewName('');
  }

  const sorted = [...rows].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  const counts = PROSPECT_STATUS_ORDER.map(s => ({ s, n: rows.filter(r => r.status === s).length }));
  const unscored = rows.filter(r => r.score == null).length;
  const hot = rows.filter(r => (r.score ?? 0) >= 80).length;

  return (
    <div style={{ minHeight: '100vh', background: T.void, color: T.ink, fontFamily: T.sans }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '26px clamp(16px,3vw,36px) 56px' }}>
        <Link href="/os/agenten" style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, textDecoration: 'none', display: 'inline-block', marginBottom: 8 }}>‹ Agenten</Link>
          <Seitenkopf
            rubrik={<>Prospecting-Agent <span style={{ fontFamily: T.mono, fontSize: 11, color: T.accent, border: `1px solid ${T.accent}55`, borderRadius: 5, padding: '2px 7px' }}>live · autonom</span></>}
            titel={<>Deine Zielliste zum 1-Mio-Ziel.</>}
            satz={<>Firmen rein, KI qualifiziert gegen dein Profil (Score + Fit + Aufhänger), du priorisierst. {PIPELINE_HINT}</>}
          />

        {/* Kennzahlen */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '18px 0 16px' }}>
          <div style={{ ...panel, padding: '10px 16px' }}><div style={lbl}>In Liste</div><div style={{ fontSize: 22, fontWeight: 700 }}>{rows.length}</div></div>
          <div style={{ ...panel, padding: '10px 16px' }}><div style={lbl}>Starker Fit (80+)</div><div style={{ fontSize: 22, fontWeight: 700, color: T.accent }}>{hot}</div></div>
          <div style={{ ...panel, padding: '10px 16px' }}><div style={lbl}>Noch offen</div><div style={{ fontSize: 22, fontWeight: 700, color: unscored ? T.amber : T.muted }}>{unscored}</div></div>
          {counts.map(c => <div key={c.s} style={{ ...panel, padding: '10px 16px' }}><div style={lbl}>{PROSPECT_STATUS_LABEL[c.s]}</div><div style={{ fontSize: 22, fontWeight: 700, color: statusColor(c.s) }}>{c.n}</div></div>)}
        </div>

        {/* ICP */}
        <details style={{ ...panel, padding: '14px 18px', marginBottom: 16 }}>
          <summary style={{ cursor: 'pointer', fontFamily: T.mono, fontSize: 11, color: T.accentInk, letterSpacing: '.08em', textTransform: 'uppercase' }}>Ideales Kundenprofil (ICP)</summary>
          <textarea value={icp} onChange={e => setIcpP(e.target.value)} rows={7} style={{ width: '100%', marginTop: 10, background: T.void, border: `1px solid ${T.line}`, borderRadius: 10, color: T.inkDim, fontFamily: T.sans, fontSize: 12.5, lineHeight: 1.5, padding: 12, resize: 'vertical', outline: 'none' }} />
          <div style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, marginTop: 6 }}>Das Profil steuert das Scoring. Änderungen werden gespeichert.</div>
        </details>

        {/* Aktionen */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
          <button onClick={scoreAll} disabled={bulk || !unscored} style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 700, padding: '9px 16px', borderRadius: 9, border: 'none', cursor: bulk || !unscored ? 'default' : 'pointer', background: bulk || !unscored ? T.line : T.accent, color: bulk || !unscored ? T.muted : '#04110F' }}>
            {bulk ? 'qualifiziere …' : unscored ? `Alle ${unscored} qualifizieren` : 'Alle qualifiziert ✓'}
          </button>
          <div style={{ display: 'flex', gap: 6, flex: 1, minWidth: 220 }}>
            <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addManual(); }} placeholder="Firma manuell hinzufügen …" style={{ flex: 1, background: T.panel2, border: `1px solid ${T.line}`, borderRadius: 9, color: T.ink, fontFamily: T.sans, fontSize: 13, padding: '8px 12px', outline: 'none' }} />
            <button onClick={addManual} style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 600, padding: '8px 14px', borderRadius: 9, border: `1px solid ${T.line}`, background: 'transparent', color: T.inkDim, cursor: 'pointer' }}>+ Hinzufügen</button>
          </div>
        </div>

        {/* Liste */}
        {!loaded ? (
          <div style={{ fontFamily: T.mono, fontSize: 12, color: T.muted }}>lade Zielliste …</div>
        ) : rows.length === 0 ? (
          <div style={{ ...panel, padding: '28px 20px', textAlign: 'center', color: T.inkDim, fontSize: 13.5, lineHeight: 1.5 }}>
            Noch keine Firmen. Füg oben welche hinzu — oder sag mir im Chat „bau die Zielliste aus", dann ziehe ich echte Mittelstands-Firmen (Explorium) rein.
          </div>
        ) : (
          <div style={{ ...panel, overflow: 'hidden' }}>
            {sorted.map((p, i) => {
              const isOpen = open === p.id;
              return (
                <div key={p.id} style={{ borderTop: i ? `1px solid ${T.lineSoft}` : 0, background: isOpen ? T.panel2 : 'transparent' }}>
                  <div onClick={() => setOpen(isOpen ? null : p.id)} style={{ display: 'flex', gap: 12, padding: '13px 16px', cursor: 'pointer', alignItems: 'center' }}>
                    <div style={{ width: 42, textAlign: 'center', flex: '0 0 auto' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, fontFamily: T.mono, color: scoreColor(p.score) }}>{p.score ?? '–'}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 600, color: T.ink }}>{p.company}</div>
                      <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{[p.industry, p.size, p.region].filter(Boolean).join(' · ') || (p.domain ?? '')}</div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); cycleStatus(p); }} title="Status wechseln" style={{ fontFamily: T.mono, fontSize: 11, color: statusColor(p.status), border: `1px solid ${statusColor(p.status)}55`, borderRadius: 6, padding: '3px 9px', background: 'transparent', cursor: 'pointer', whiteSpace: 'nowrap' }}>{PROSPECT_STATUS_LABEL[p.status]}</button>
                    <button onClick={e => { e.stopPropagation(); scoreOne(p); }} disabled={busy[p.id]} style={{ fontFamily: T.sans, fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8, border: `1px solid ${T.accent}`, background: busy[p.id] ? 'transparent' : `${T.accent}22`, color: T.accent, cursor: busy[p.id] ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>{busy[p.id] ? '…' : p.score == null ? 'Qualifizieren' : 'Neu bewerten'}</button>
                    <span style={{ fontFamily: T.mono, fontSize: 13, color: T.muted }}>{isOpen ? '▾' : '▸'}</span>
                  </div>
                  {isOpen && (
                    <div style={{ padding: '2px 18px 18px 70px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {p.fit && <div><div style={{ ...lbl, marginBottom: 4 }}>Fit</div><div style={{ fontSize: 13, color: T.inkDim, lineHeight: 1.5 }}>{p.fit}</div></div>}
                      {p.angle && <div><div style={{ ...lbl, marginBottom: 4 }}>Aufhänger</div><div style={{ fontSize: 13, color: T.inkDim, lineHeight: 1.5 }}>{p.angle}</div></div>}
                      {!p.fit && !p.angle && <div style={{ fontSize: 12.5, color: T.muted }}>Noch nicht qualifiziert — „Qualifizieren" klicken.</div>}

                      {/* Outreach: Ansprache entwerfen — Versand bleibt bei Kevin */}
                      {p.score != null && (
                        <div>
                          <button onClick={() => ansprache(p)} disabled={entwurfBusy === p.id}
                            style={{ fontFamily: T.sans, fontSize: 12.5, fontWeight: 700, padding: '7px 14px', borderRadius: 9, border: `1px solid ${T.accent}`, background: entwurfBusy === p.id ? 'transparent' : `${T.accent}1c`, color: T.accentInk, cursor: entwurfBusy === p.id ? 'wait' : 'pointer' }}>
                            {entwurfBusy === p.id ? 'Jarvis schreibt …' : entwurf?.fuer === p.id ? '↻ Neu entwerfen' : '✍ Ansprache entwerfen'}
                          </button>
                        </div>
                      )}
                      {entwurf?.fuer === p.id && (
                        <div style={{ background: T.void, border: `1px solid ${T.accent}44`, borderRadius: 12, padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ ...lbl, color: T.accent }}>E-Mail</span>
                            <input value={entwurf.betreff} onChange={e => setEntwurf({ ...entwurf, betreff: e.target.value })}
                              style={{ flex: 1, background: 'transparent', border: `1px solid ${T.line}`, borderRadius: 7, color: T.ink, fontFamily: T.sans, fontSize: 13, fontWeight: 600, padding: '5px 9px', outline: 'none' }} />
                          </div>
                          <textarea value={entwurf.email} onChange={e => setEntwurf({ ...entwurf, email: e.target.value })} rows={7}
                            style={{ background: 'transparent', border: `1px solid ${T.line}`, borderRadius: 8, color: T.inkDim, fontFamily: T.sans, fontSize: 13, lineHeight: 1.55, padding: '9px 11px', outline: 'none', resize: 'vertical' }} />
                          {entwurf.linkedin && (
                            <>
                              <div style={{ ...lbl, color: T.accent }}>LinkedIn-Erstnachricht</div>
                              <textarea value={entwurf.linkedin} onChange={e => setEntwurf({ ...entwurf, linkedin: e.target.value })} rows={3}
                                style={{ background: 'transparent', border: `1px solid ${T.line}`, borderRadius: 8, color: T.inkDim, fontFamily: T.sans, fontSize: 13, lineHeight: 1.55, padding: '9px 11px', outline: 'none', resize: 'vertical' }} />
                            </>
                          )}
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                            <button onClick={inMailOeffnen} style={{ fontFamily: T.sans, fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 8, border: 'none', background: T.accent, color: '#04110F', cursor: 'pointer' }}>In Apple Mail öffnen</button>
                            <button onClick={() => { try { navigator.clipboard.writeText(`${entwurf.betreff}\n\n${entwurf.email}`); } catch { /* egal */ } }} style={{ fontFamily: T.sans, fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8, border: `1px solid ${T.line}`, background: 'transparent', color: T.inkDim, cursor: 'pointer' }}>E-Mail kopieren</button>
                            {entwurf.linkedin && <button onClick={() => { try { navigator.clipboard.writeText(entwurf.linkedin); } catch { /* egal */ } }} style={{ fontFamily: T.sans, fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8, border: `1px solid ${T.line}`, background: 'transparent', color: T.inkDim, cursor: 'pointer' }}>LinkedIn kopieren</button>}
                            <button onClick={() => setRowsP(rows.map(x => x.id === p.id ? { ...x, status: 'kontaktiert' } : x))} style={{ fontFamily: T.sans, fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8, border: `1px solid ${T.accent}66`, background: 'transparent', color: T.accent, cursor: 'pointer' }}>→ als kontaktiert markieren</button>
                            {mailInfo && <span style={{ fontSize: 11.5, color: T.accent }}>{mailInfo}</span>}
                          </div>
                          {entwurf.hinweis && <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.5 }}>{entwurf.hinweis}</div>}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {PROSPECT_STATUS_ORDER.map(s => (
                          <button key={s} onClick={() => setRowsP(rows.map(x => x.id === p.id ? { ...x, status: s } : x))} style={{ fontFamily: T.sans, fontSize: 11.5, fontWeight: 600, padding: '5px 11px', borderRadius: 8, cursor: 'pointer', border: `1px solid ${p.status === s ? statusColor(s) : T.line}`, background: p.status === s ? `${statusColor(s)}22` : 'transparent', color: p.status === s ? statusColor(s) : T.inkDim }}>{PROSPECT_STATUS_LABEL[s]}</button>
                        ))}
                        <button onClick={() => setRowsP(rows.filter(x => x.id !== p.id))} style={{ fontFamily: T.sans, fontSize: 11.5, fontWeight: 600, padding: '5px 11px', borderRadius: 8, cursor: 'pointer', border: `1px solid ${T.line}`, background: 'transparent', color: T.muted, marginLeft: 'auto' }}>Löschen</button>
                      </div>
                      {p.source && <div style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>Quelle: {p.source}</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
