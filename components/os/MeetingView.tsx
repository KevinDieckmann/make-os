'use client';

import Link from 'next/link';
import { useState } from 'react';
import { THEME as T } from '@/lib/make-one/os-data';
import { todayISO } from '@/components/os/kit';

interface ActionItem { titel: string; owner: string; prio: string; projectId: string; due?: string; }
interface Protokoll { titel: string; zusammenfassung: string; entscheidungen: string[]; actionItems: ActionItem[]; }

const lbl = { fontFamily: T.mono, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: T.muted };
const panel = { background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14 };

const PROJECTS: Record<string, string> = {
  'proj-ig': 'IG', 'proj-capos': 'CapOS', 'proj-kdm': 'Holding', 'proj-health': 'Gesundheit', 'proj-make': 'MAKE.One', 'proj-privat': 'Privat',
};
const prioColor = (p: string) => (p === 'critical' ? T.crit : p === 'high' ? T.amber : p === 'medium' ? T.accentInk : T.muted);
const ownerLabel = (o: string) => (o === 'both' ? 'Ma+Ke' : o === 'malin' ? 'Malin' : 'Kevin');

export function MeetingView() {
  const [transcript, setTranscript] = useState('');
  const [prot, setProt] = useState<Protokoll | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [created, setCreated] = useState<Record<number, 'ok' | 'busy' | 'err'>>({});

  async function evaluate() {
    if (transcript.trim().length < 20 || busy) return;
    setBusy(true); setErr(''); setProt(null); setCreated({});
    try {
      const r = await fetch('/api/meeting', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transcript, datum: todayISO() }) });
      const d = await r.json();
      if (d.error) setErr(d.error);
      else setProt({ titel: d.titel, zusammenfassung: d.zusammenfassung, entscheidungen: d.entscheidungen ?? [], actionItems: d.actionItems ?? [] });
    } catch { setErr('Auswertung gerade nicht möglich.'); }
    setBusy(false);
  }

  async function toTask(it: ActionItem, i: number) {
    setCreated(c => ({ ...c, [i]: 'busy' }));
    try {
      const r = await fetch('/api/tasks/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: it.titel, description: `Aus Meeting „${prot?.titel ?? ''}" übernommen.`, projectId: it.projectId, owner: it.owner, priority: it.prio, dueDate: it.due }),
      });
      const d = await r.json();
      setCreated(c => ({ ...c, [i]: d.ok ? 'ok' : 'err' }));
    } catch { setCreated(c => ({ ...c, [i]: 'err' })); }
  }

  async function allToTasks() {
    if (!prot) return;
    for (let i = 0; i < prot.actionItems.length; i++) {
      if (created[i] !== 'ok') await toTask(prot.actionItems[i], i);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: T.void, color: T.ink, fontFamily: T.sans }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '26px clamp(16px,3vw,36px) 56px' }}>
        <Link href="/os/agenten" style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, textDecoration: 'none', display: 'inline-block', marginBottom: 8 }}>‹ Agenten</Link>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <div style={lbl}>Meeting-Agent</div>
          <span style={{ fontFamily: T.mono, fontSize: 9.5, color: T.accentInk, border: `1px solid ${T.accentInk}55`, borderRadius: 5, padding: '2px 7px' }}>live · Entwurf</span>
        </div>
        <h1 style={{ fontSize: 25, fontWeight: 600, letterSpacing: '-.02em', margin: '6px 0 4px' }}>Vom Gespräch zu Aufgaben.</h1>
        <p style={{ fontSize: 13.5, color: T.inkDim, maxWidth: 680, lineHeight: 1.5 }}>Transkript oder Notizen einfügen — der Agent macht Zusammenfassung, Entscheidungen und Action-Items daraus. Jedes Action-Item übernimmst du <b style={{ color: T.ink }}>auf Klick in deine echten Aufgaben</b>. <span style={{ color: T.muted }}>(Auto-Mitschrift via Granola/Fireflies kommt als Zusatz.)</span></p>

        <textarea value={transcript} onChange={e => setTranscript(e.target.value)} rows={7} placeholder="Meeting-Transkript oder Notizen hier einfügen …" style={{ width: '100%', marginTop: 16, background: T.panel2, border: `1px solid ${T.line}`, borderRadius: 10, color: T.ink, fontFamily: T.sans, fontSize: 13.5, lineHeight: 1.5, padding: '12px 14px', outline: 'none', resize: 'vertical' }} />
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 12 }}>
          <button onClick={evaluate} disabled={busy || transcript.trim().length < 20} style={{ fontFamily: T.sans, fontSize: 13.5, fontWeight: 700, padding: '11px 20px', borderRadius: 9, border: 'none', cursor: busy || transcript.trim().length < 20 ? 'default' : 'pointer', background: busy || transcript.trim().length < 20 ? T.line : T.accent, color: busy || transcript.trim().length < 20 ? T.muted : '#04110F' }}>
            {busy ? 'werte aus …' : 'Meeting auswerten'}
          </button>
          {err && <span style={{ fontSize: 12.5, color: T.crit }}>{err}</span>}
        </div>

        {prot && (
          <div style={{ marginTop: 22 }}>
            <div style={{ ...panel, borderTop: `2px solid ${T.accent}`, padding: '16px 20px' }}>
              <div style={{ ...lbl, marginBottom: 4 }}>Protokoll</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: T.ink, marginBottom: 8 }}>{prot.titel}</div>
              <div style={{ fontSize: 13.5, color: T.inkDim, lineHeight: 1.55 }}>{prot.zusammenfassung}</div>
            </div>

            {!!prot.entscheidungen.length && (
              <div style={{ ...panel, padding: '14px 20px', marginTop: 12 }}>
                <div style={{ ...lbl, marginBottom: 8 }}>Entscheidungen</div>
                {prot.entscheidungen.map((e, i) => <div key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: T.inkDim, lineHeight: 1.5, marginTop: 3 }}><span style={{ color: T.accent }}>✓</span>{e}</div>)}
              </div>
            )}

            {!!prot.actionItems.length && (
              <div style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={lbl}>Action-Items ({prot.actionItems.length})</div>
                  <button onClick={allToTasks} style={{ fontFamily: T.sans, fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 8, border: `1px solid ${T.accent}`, background: `${T.accent}22`, color: T.accent, cursor: 'pointer' }}>Alle übernehmen</button>
                </div>
                <div style={{ ...panel, overflow: 'hidden' }}>
                  {prot.actionItems.map((it, i) => (
                    <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 16px', borderTop: i ? `1px solid ${T.lineSoft}` : 0, alignItems: 'center' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{it.titel}</div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: T.mono, fontSize: 9.5, color: prioColor(it.prio), border: `1px solid ${prioColor(it.prio)}55`, borderRadius: 5, padding: '2px 7px' }}>{it.prio}</span>
                          <span style={{ fontFamily: T.mono, fontSize: 9.5, color: T.inkDim, border: `1px solid ${T.line}`, borderRadius: 5, padding: '2px 7px' }}>{ownerLabel(it.owner)}</span>
                          <span style={{ fontFamily: T.mono, fontSize: 9.5, color: T.accentInk, border: `1px solid ${T.accentInk}44`, borderRadius: 5, padding: '2px 7px' }}>{PROJECTS[it.projectId] ?? it.projectId}</span>
                          {it.due && <span style={{ fontFamily: T.mono, fontSize: 9.5, color: T.amber, border: `1px solid ${T.amber}44`, borderRadius: 5, padding: '2px 7px' }}>{it.due}</span>}
                        </div>
                      </div>
                      <button onClick={() => toTask(it, i)} disabled={created[i] === 'busy' || created[i] === 'ok'} style={{ fontFamily: T.sans, fontSize: 12, fontWeight: 600, padding: '7px 13px', borderRadius: 8, whiteSpace: 'nowrap', cursor: created[i] === 'ok' ? 'default' : 'pointer', border: `1px solid ${created[i] === 'err' ? T.crit : T.accent}`, background: created[i] === 'ok' ? 'transparent' : `${T.accent}22`, color: created[i] === 'err' ? T.crit : T.accent }}>
                        {created[i] === 'ok' ? '✓ Aufgabe' : created[i] === 'busy' ? '…' : created[i] === 'err' ? 'Fehler' : '→ Aufgabe'}
                      </button>
                    </div>
                  ))}
                </div>
                <div style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, marginTop: 8 }}>Übernommene Aufgaben landen in deinen echten Aufgaben (/os/aufgaben).</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
