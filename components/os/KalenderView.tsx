'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { THEME as T } from '@/lib/make-one/os-data';
import { todayISO } from '@/components/os/kit';

interface Ev { id: string; title: string; startDate: string; endDate: string; allDay?: boolean; calendarName?: string; location?: string; category?: string; }
interface Block { title: string; date: string; startHour: number; startMin?: number; durationMin: number; calendar: string; grund?: string; }
interface AnalyseAntwort { briefing?: string; conflicts?: Conflict[]; vorschlaege?: Block[]; eingetragen?: boolean; }
interface Conflict { date: string; a: string; b: string; overlap: string; }

const lbl = { fontFamily: T.mono, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: T.muted };
const panel = { background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14 };
const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

const calColor = (c?: string) => (c === 'Privat Kevin' ? T.accentInk : c === 'Privat Malin' ? '#C77DFF' : c === 'Kevin Dieckmann' ? T.amber : T.accent);
const fmtTime = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? '' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const dayKey = (iso: string) => iso.slice(0, 10);
const dayLabel = (k: string) => { const d = new Date(`${k}T00:00:00`); return `${WD[d.getDay()]} · ${d.getDate()}.${d.getMonth() + 1}.`; };

export function KalenderView() {
  // pro Render frisch — sonst steht das Datum bei offenem Tab über Mitternacht still
  const TODAY = todayISO();
  const [events, setEvents] = useState<Ev[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [briefing, setBriefing] = useState('');
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [analysing, setAnalysing] = useState(false);
  const [added, setAdded] = useState<Record<number, 'ok' | 'err' | 'busy'>>({});

  async function load() {
    setLoading(true); setLoadErr(null);
    try {
      const r = await fetch('/api/apple-calendar');
      const d = await r.json();
      if (Array.isArray(d)) setEvents(d);
      else setLoadErr(d.detail || d.error || 'Kein Zugriff.');
    } catch (e) { setLoadErr(e instanceof Error ? e.message : 'Fehler'); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function analyse() {
    setAnalysing(true); setAdded({});
    try {
      const r = await fetch('/api/kalender/analyse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ events, today: TODAY }) });
      const d: AnalyseAntwort = await r.json();
      setBriefing(d.briefing ?? ''); setConflicts(d.conflicts ?? []); setBlocks(d.vorschlaege ?? []);
      // Autonom eingetragen? Dann Knöpfe direkt auf „eingetragen" stellen + neu laden.
      if (d.eingetragen) {
        setAdded(Object.fromEntries((d.vorschlaege ?? []).map((_, i) => [i, 'ok' as const])));
        setTimeout(load, 800);
      }
    } catch { setBriefing('Analyse gerade nicht möglich.'); }
    setAnalysing(false);
  }

  async function addBlock(b: Block, i: number) {
    setAdded(a => ({ ...a, [i]: 'busy' }));
    try {
      const r = await fetch('/api/apple-calendar/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ events: [b] }) });
      const d = await r.json();
      setAdded(a => ({ ...a, [i]: d.ok ? 'ok' : 'err' }));
      if (d.ok) setTimeout(load, 600);
    } catch { setAdded(a => ({ ...a, [i]: 'err' })); }
  }

  async function addAll() {
    const pending = blocks.map((b, i) => ({ b, i })).filter(x => added[x.i] !== 'ok');
    for (const { b, i } of pending) await addBlock(b, i);
  }

  // Termine ab heute, nach Tag gruppiert
  const upcoming = events.filter(e => e.startDate && dayKey(e.startDate) >= TODAY).sort((a, b) => a.startDate.localeCompare(b.startDate));
  const byDay = upcoming.reduce<Record<string, Ev[]>>((acc, e) => { const k = dayKey(e.startDate); (acc[k] ??= []).push(e); return acc; }, {});
  const days = Object.keys(byDay).sort().slice(0, 8);
  const conflictKey = (c: Conflict) => `${c.date}|${c.a}|${c.b}`;
  const conflictTitles = new Set(conflicts.flatMap(c => [`${c.date}|${c.a}`, `${c.date}|${c.b}`]));

  return (
    <div style={{ minHeight: '100vh', background: T.void, color: T.ink, fontFamily: T.sans }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '26px clamp(16px,3vw,36px) 56px' }}>
        <Link href="/os/agenten" style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, textDecoration: 'none', display: 'inline-block', marginBottom: 8 }}>‹ Agenten</Link>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <div style={lbl}>Kalender-Agent</div>
          <span style={{ fontFamily: T.mono, fontSize: 9.5, color: T.accent, border: `1px solid ${T.accent}55`, borderRadius: 5, padding: '2px 7px' }}>live · mit Freigabe</span>
        </div>
        <h1 style={{ fontSize: 25, fontWeight: 600, letterSpacing: '-.02em', margin: '6px 0 4px' }}>Die Woche schützt sich selbst.</h1>
        <p style={{ fontSize: 13.5, color: T.inkDim, maxWidth: 680, lineHeight: 1.5 }}>Echte Termine aus Apple Kalender, Konflikte markiert. Der Agent schlägt Reha- & Fokus-Blöcke in die freien Lücken vor — eintragen tust du auf Klick.</p>

        {/* Aktionsleiste */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', margin: '18px 0 16px' }}>
          <button onClick={analyse} disabled={analysing || loading || !!loadErr} style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 700, padding: '9px 16px', borderRadius: 9, border: 'none', cursor: analysing || loading || loadErr ? 'default' : 'pointer', background: analysing || loading || loadErr ? T.line : T.accent, color: analysing || loading || loadErr ? T.muted : '#04110F' }}>
            {analysing ? 'analysiere …' : 'Woche analysieren & schützen'}
          </button>
          <button onClick={load} style={{ fontFamily: T.sans, fontSize: 12.5, fontWeight: 600, padding: '9px 14px', borderRadius: 9, border: `1px solid ${T.line}`, background: 'transparent', color: T.inkDim, cursor: 'pointer' }}>↻ Termine neu laden</button>
          <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>{loading ? 'lade …' : loadErr ? '' : `${upcoming.length} Termine · ${conflicts.length} Konflikte`}</span>
        </div>

        {loadErr && (
          <div style={{ ...panel, borderColor: `${T.crit}55`, padding: '14px 18px', marginBottom: 16, fontSize: 13, color: T.inkDim, lineHeight: 1.5 }}>
            <b style={{ color: T.crit }}>Kein Kalender-Zugriff.</b> Systemeinstellungen → Datenschutz & Sicherheit → Kalender → Node.js/Terminal erlauben. <span style={{ color: T.muted }}>({loadErr.slice(0, 120)})</span>
          </div>
        )}

        {/* KI-Briefing */}
        {briefing && (
          <div style={{ ...panel, borderTop: `2px solid ${T.accent}`, padding: '16px 20px', marginBottom: 16 }}>
            <div style={{ ...lbl, marginBottom: 6 }}>Briefing</div>
            <div style={{ fontSize: 14, color: T.ink, lineHeight: 1.55 }}>{briefing}</div>
          </div>
        )}

        {/* Konflikte */}
        {conflicts.length > 0 && (
          <div style={{ ...panel, borderColor: `${T.crit}44`, padding: '14px 18px', marginBottom: 16 }}>
            <div style={{ ...lbl, color: T.crit, marginBottom: 8 }}>Konflikte ({conflicts.length})</div>
            {conflicts.map(c => (
              <div key={conflictKey(c)} style={{ fontSize: 13, color: T.inkDim, lineHeight: 1.6 }}>
                <span style={{ color: T.crit }}>⨯</span> {dayLabel(c.date)} — <b style={{ color: T.ink }}>{c.a}</b> ⨯ <b style={{ color: T.ink }}>{c.b}</b> <span style={{ color: T.muted }}>({c.overlap})</span>
              </div>
            ))}
          </div>
        )}

        {/* Vorschläge */}
        {blocks.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={lbl}>Schutz-Blöcke ({blocks.length})</div>
              <button onClick={addAll} style={{ fontFamily: T.sans, fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 8, border: `1px solid ${T.accent}`, background: `${T.accent}22`, color: T.accent, cursor: 'pointer' }}>Alle eintragen</button>
            </div>
            <div style={{ ...panel, overflow: 'hidden' }}>
              {blocks.map((b, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 16px', borderTop: i ? `1px solid ${T.lineSoft}` : 0, alignItems: 'center' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{b.title}</div>
                    <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{dayLabel(b.date)} · {String(b.startHour).padStart(2, '0')}:{String(b.startMin ?? 0).padStart(2, '0')} · {b.durationMin} Min · <span style={{ color: calColor(b.calendar) }}>{b.calendar}</span></div>
                    {b.grund && <div style={{ fontSize: 12.5, color: T.inkDim, marginTop: 4, lineHeight: 1.4 }}>{b.grund}</div>}
                  </div>
                  <button onClick={() => addBlock(b, i)} disabled={added[i] === 'busy' || added[i] === 'ok'} style={{ fontFamily: T.sans, fontSize: 12, fontWeight: 600, padding: '7px 13px', borderRadius: 8, whiteSpace: 'nowrap', cursor: added[i] === 'ok' ? 'default' : 'pointer', border: `1px solid ${added[i] === 'err' ? T.crit : T.accent}`, background: added[i] === 'ok' ? 'transparent' : `${T.accent}22`, color: added[i] === 'err' ? T.crit : T.accent }}>
                    {added[i] === 'ok' ? '✓ eingetragen' : added[i] === 'busy' ? '…' : added[i] === 'err' ? 'Fehler' : 'In Kalender legen'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Wochen-Übersicht */}
        {!loadErr && (
          <div>
            <div style={{ ...lbl, marginBottom: 10 }}>Deine nächsten 7 Tage</div>
            {loading ? (
              <div style={{ fontFamily: T.mono, fontSize: 12, color: T.muted }}>lade Termine …</div>
            ) : days.length === 0 ? (
              <div style={{ ...panel, padding: '22px', textAlign: 'center', color: T.inkDim, fontSize: 13 }}>Keine Termine in den nächsten Tagen.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {days.map(k => (
                  <div key={k} style={{ ...panel, padding: '12px 16px' }}>
                    <div style={{ fontFamily: T.mono, fontSize: 11, color: k === TODAY ? T.accent : T.inkDim, marginBottom: 8, letterSpacing: '.05em' }}>{dayLabel(k)}{k === TODAY ? ' · heute' : ''}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {byDay[k].map(e => {
                        const clash = conflictTitles.has(`${k}|${e.title}`);
                        return (
                          <div key={e.id} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                            <span style={{ fontFamily: T.mono, fontSize: 12, color: T.muted, width: 46, flex: '0 0 auto' }}>{e.allDay ? 'ganzt.' : fmtTime(e.startDate)}</span>
                            <span style={{ width: 7, height: 7, borderRadius: 2, background: calColor(e.calendarName), flex: '0 0 auto', marginTop: 5 }} />
                            <span style={{ fontSize: 13.5, color: T.ink }}>{e.title}{clash && <span style={{ color: T.crit, marginLeft: 6, fontSize: 11 }}>⨯ Konflikt</span>}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
