'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { THEME as T } from '@/lib/make-one/os-data';
import { todayISO } from '@/components/os/kit';
import { Seitenkopf } from './Seitenkopf';

interface ActionItem { titel: string; owner: string; prio: string; projectId: string; due?: string; }
interface Protokoll { titel: string; zusammenfassung: string; entscheidungen: string[]; actionItems: ActionItem[]; }
interface Termin { id: string; title?: string; startDate?: string }
interface Meeting {
  id: string; datum: string; titel: string; terminTitel?: string;
  zusammenfassung?: string; entscheidungen?: string[];
  aufgaben?: { text: string; wer?: string; frist?: string }[];
  transcript?: string;
}

const lbl = { fontFamily: T.mono, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: T.muted };
const panel = { background: 'linear-gradient(165deg, #1A2024 0%, #12171A 100%)', border: 'none', borderRadius: 20, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06), 0 12px 32px rgba(0,0,0,.35)' };

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
  // Skriptverlauf: was schon protokolliert wurde, plus die Termine von heute,
  // damit ein Protokoll an den richtigen Termin gehängt wird.
  const [verlauf, setVerlauf] = useState<Meeting[]>([]);
  const [termine, setTermine] = useState<Termin[]>([]);
  const [gewaehlterTermin, setGewaehlterTermin] = useState('');
  const [meetingId, setMeetingId] = useState('');
  const [offenesProtokoll, setOffenesProtokoll] = useState<string | null>(null);

  const ladeVerlauf = () => {
    fetch('/api/state/meetings').then(r => r.json()).then(d => setVerlauf(d.meetings ?? [])).catch(() => {});
  };
  useEffect(() => {
    ladeVerlauf();
    // Die Termine kommen aus dem Apple-Kalender — dort wird gepflegt, hier
    // nur gelesen und verknüpft.
    fetch('/api/apple-calendar').then(r => r.json()).then((e: Termin[]) => {
      const heute = todayISO();
      setTermine((Array.isArray(e) ? e : []).filter(t => (t.startDate ?? '').slice(0, 10) === heute));
    }).catch(() => {});
  }, []);

  async function evaluate() {
    if (transcript.trim().length < 20 || busy) return;
    setBusy(true); setErr(''); setProt(null); setCreated({});
    try {
      const r = await fetch('/api/meeting', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transcript, datum: todayISO() }) });
      const d = await r.json();
      if (d.error) setErr(d.error);
      else {
        const p = { titel: d.titel, zusammenfassung: d.zusammenfassung, entscheidungen: d.entscheidungen ?? [], actionItems: d.actionItems ?? [] };
        setProt(p);
        // Kevins Ansage: der Skriptverlauf soll bleiben. Also sofort ablegen —
        // samt Termin, wenn einer an diesem Tag dazu passt.
        const termin = termine.find(t => t.id === gewaehlterTermin);
        const id = `mt-${Date.now().toString(36)}`;
        setMeetingId(id);
        fetch('/api/state/meetings', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id, datum: todayISO(), titel: p.titel, transcript,
            zusammenfassung: p.zusammenfassung, entscheidungen: p.entscheidungen,
            aufgaben: p.actionItems.map((a: ActionItem) => ({ text: a.titel, wer: ownerLabel(a.owner), frist: a.due })),
            terminId: termin?.id, terminTitel: termin?.title,
          }), keepalive: true,
        }).then(() => ladeVerlauf()).catch(() => {});
      }
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
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '30px clamp(18px,4vw,48px) 72px' }}>
        <Link href="/os/agenten" style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, textDecoration: 'none', display: 'inline-block', marginBottom: 8 }}>‹ Agenten</Link>
          <Seitenkopf
            rubrik={<>Meeting-Agent <span style={{ fontFamily: T.mono, fontSize: 11, color: T.accentInk, border: `1px solid ${T.accentInk}55`, borderRadius: 5, padding: '2px 7px' }}>live · Entwurf</span></>}
            titel={<>Vom Gespräch zu Aufgaben.</>}
            satz={<>Transkript oder Notizen einfügen — der Agent macht Zusammenfassung, Entscheidungen und Action-Items daraus. Jedes Action-Item übernimmst du <b style={{ color: T.ink }}>auf Klick in deine echten Aufgaben</b>. <span style={{ color: T.muted }}>(Auto-Mitschrift via Granola/Fireflies kommt als Zusatz.)</span></>}
          />

        <textarea value={transcript} onChange={e => setTranscript(e.target.value)} rows={7} placeholder="Meeting-Transkript oder Notizen hier einfügen …" style={{ width: '100%', marginTop: 16, background: 'linear-gradient(165deg, #1A2024 0%, #12171A 100%)', border: 'none', borderRadius: 20, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06), 0 12px 32px rgba(0,0,0,.35)', color: T.ink, fontFamily: T.sans, fontSize: 13.5, lineHeight: 1.5, padding: '12px 14px', outline: 'none', resize: 'vertical' }} />
        {/* Zu welchem Termin gehört das? Der Kalender bleibt die Pflegebasis. */}
        {!!termine.length && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
            <span style={lbl}>Termin heute</span>
            <select value={gewaehlterTermin} onChange={e => setGewaehlterTermin(e.target.value)} aria-label="Termin zuordnen"
              style={{ background: T.void, border: `1px solid ${T.line}`, borderRadius: 8, color: T.ink, fontSize: 12.5, padding: '6px 10px', cursor: 'pointer', maxWidth: 380 }}>
              <option value="" style={{ background: T.panel }}>— ohne Termin</option>
              {termine.map(t => (
                <option key={t.id} value={t.id} style={{ background: T.panel }}>
                  {(t.startDate ?? '').slice(11, 16)} · {t.title ?? 'Termin'}
                </option>
              ))}
            </select>
          </div>
        )}

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
                          <span style={{ fontFamily: T.mono, fontSize: 11, color: prioColor(it.prio), border: `1px solid ${prioColor(it.prio)}55`, borderRadius: 5, padding: '2px 7px' }}>{it.prio}</span>
                          <span style={{ fontFamily: T.mono, fontSize: 11, color: T.inkDim, border: `1px solid ${T.line}`, borderRadius: 5, padding: '2px 7px' }}>{ownerLabel(it.owner)}</span>
                          <span style={{ fontFamily: T.mono, fontSize: 11, color: T.accentInk, border: `1px solid ${T.accentInk}44`, borderRadius: 5, padding: '2px 7px' }}>{PROJECTS[it.projectId] ?? it.projectId}</span>
                          {it.due && <span style={{ fontFamily: T.mono, fontSize: 11, color: T.amber, border: `1px solid ${T.amber}44`, borderRadius: 5, padding: '2px 7px' }}>{it.due}</span>}
                        </div>
                      </div>
                      <button onClick={() => toTask(it, i)} disabled={created[i] === 'busy' || created[i] === 'ok'} style={{ fontFamily: T.sans, fontSize: 12, fontWeight: 600, padding: '7px 13px', borderRadius: 8, whiteSpace: 'nowrap', cursor: created[i] === 'ok' ? 'default' : 'pointer', border: `1px solid ${created[i] === 'err' ? T.crit : T.accent}`, background: created[i] === 'ok' ? 'transparent' : `${T.accent}22`, color: created[i] === 'err' ? T.crit : T.accent }}>
                        {created[i] === 'ok' ? '✓ Aufgabe' : created[i] === 'busy' ? '…' : created[i] === 'err' ? 'Fehler' : '→ Aufgabe'}
                      </button>
                    </div>
                  ))}
                </div>
                <div style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, marginTop: 8 }}>Übernommene Aufgaben landen in deinen echten Aufgaben (/os/aufgaben).</div>
              </div>
            )}
          </div>
        )}

        {/* ── SKRIPTVERLAUF ─────────────────────────────────────────────────
            Kevins Ansage: jedes Skript, in dem ihr wart, soll dahinterliegen.
            Vorher war jedes Protokoll nach der Sitzung weg. */}
        <div style={{ ...panel, padding: '16px 20px', marginTop: 22 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            <span style={lbl}>Skriptverlauf</span>
            <span style={{ fontSize: 12.5, color: T.muted }}>
              {verlauf.length ? `${verlauf.length} Protokoll${verlauf.length === 1 ? '' : 'e'} — bleiben liegen, mit Termin verknüpft.` : 'Noch nichts protokolliert. Ab jetzt bleibt jede Auswertung hier liegen.'}
            </span>
          </div>
          {verlauf.map(m => {
            const auf = offenesProtokoll === m.id;
            return (
              <div key={m.id} style={{ borderTop: `1px solid ${T.lineSoft}`, padding: '9px 0' }}>
                <div onClick={() => setOffenesProtokoll(auf ? null : m.id)} style={{ display: 'flex', gap: 11, alignItems: 'baseline', cursor: 'pointer' }}>
                  <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, width: 62, flex: '0 0 auto' }}>{m.datum.slice(8)}.{m.datum.slice(5, 7)}.</span>
                  <span style={{ fontSize: 13, color: T.ink, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.titel}</span>
                  {m.terminTitel && <span style={{ fontFamily: T.mono, fontSize: 11, color: T.accentInk, border: `1px solid ${T.lineHot}`, borderRadius: 5, padding: '1px 6px', flex: '0 0 auto' }}>⌛ {m.terminTitel}</span>}
                  <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, flex: '0 0 auto' }}>{(m.aufgaben ?? []).length} Aufgaben</span>
                  <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, flex: '0 0 auto' }}>{auf ? '▾' : '▸'}</span>
                </div>
                {auf && (
                  <div style={{ padding: '8px 0 4px 73px' }}>
                    {m.zusammenfassung && <div style={{ fontSize: 12.5, color: T.inkDim, lineHeight: 1.55, marginBottom: 7 }}>{m.zusammenfassung}</div>}
                    {!!m.entscheidungen?.length && (
                      <ul style={{ margin: '0 0 7px', paddingLeft: 17 }}>
                        {m.entscheidungen.map((e, i) => <li key={i} style={{ fontSize: 12.5, color: T.inkDim, lineHeight: 1.55 }}>{e}</li>)}
                      </ul>
                    )}
                    {(m.aufgaben ?? []).map((a, i) => (
                      <div key={i} style={{ fontSize: 12.5, color: T.inkDim, padding: '2px 0' }}>
                        ◇ {a.text}{a.wer ? <span style={{ color: T.muted }}> · {a.wer}</span> : null}{a.frist ? <span style={{ color: T.muted }}> · {a.frist}</span> : null}
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                      {m.transcript && (
                        <details style={{ fontSize: 11.5, color: T.muted }}>
                          <summary style={{ cursor: 'pointer' }}>Skript nachlesen</summary>
                          <div style={{ whiteSpace: 'pre-wrap', marginTop: 6, maxHeight: 260, overflowY: 'auto', fontSize: 12, color: T.inkDim, lineHeight: 1.5 }}>{m.transcript}</div>
                        </details>
                      )}
                      <button onClick={() => {
                        fetch(`/api/state/meetings?id=${encodeURIComponent(m.id)}`, { method: 'DELETE' })
                          .then(() => setVerlauf(v => v.filter(x => x.id !== m.id))).catch(() => {});
                      }} style={{ marginLeft: 'auto', fontFamily: T.mono, fontSize: 11, background: 'transparent', border: `1px solid ${T.line}`, borderRadius: 7, color: T.muted, padding: '3px 9px', cursor: 'pointer' }}>Protokoll löschen</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
