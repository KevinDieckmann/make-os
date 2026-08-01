'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { THEME as T } from '@/lib/make-one/os-data';
import { useTasks } from '@/context/TasksContext';
import type { Priority } from '@/types';
import { localDay } from '@/lib/zeit';
import { SAEULE_VON_PROJEKT, FOKUS_SCHWELLE } from '@/lib/make-one/fokus-data';

// ── Datums-Kurzhelfer fürs Schnellanlegen und die Zeilen-Aktionen ──
const tagInT = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return localDay(d); };
const naechsterWochentag = (idx: number) => { // 0=So … 6=Sa (JS getDay)
  const d = new Date();
  d.setDate(d.getDate() + (((idx - d.getDay()) % 7 + 7) % 7 || 7));
  return localDay(d);
};

/** Schnell-Anlegen mit Kürzeln: !! kritisch · ! hoch · heute/morgen/mo–so/TT.MM. · #projekt · @malin/@beide */
function parseSchnell(rein: string, projekte: { id: string; title: string }[]): { title: string; priority: Priority; dueDate?: string; projectId?: string; assignee: 'kevin' | 'malin' | 'both' } {
  let s = ` ${rein.trim()} `;
  let priority: Priority = 'medium';
  if (s.includes('!!')) { priority = 'critical'; s = s.replace('!!', ' '); }
  else if (s.includes('!')) { priority = 'high'; s = s.replace('!', ' '); }
  let assignee: 'kevin' | 'malin' | 'both' = 'kevin';
  s = s.replace(/\s@(malin|beide|kevin)\b/i, (_, w) => { assignee = w.toLowerCase() === 'beide' ? 'both' : w.toLowerCase() as 'kevin' | 'malin'; return ' '; });
  let dueDate: string | undefined;
  s = s.replace(/\s(heute|morgen|übermorgen)\b/i, (_, w) => { dueDate = tagInT(w.toLowerCase() === 'heute' ? 0 : w.toLowerCase() === 'morgen' ? 1 : 2); return ' '; });
  if (!dueDate) s = s.replace(/\s(mo|di|mi|do|fr|sa|so)\b/i, (_, w) => { dueDate = naechsterWochentag(['so', 'mo', 'di', 'mi', 'do', 'fr', 'sa'].indexOf(w.toLowerCase())); return ' '; });
  if (!dueDate) s = s.replace(/\s(\d{1,2})\.(\d{1,2})\.?(?=\s)/, (_, tt, mm) => {
    const j = new Date().getFullYear();
    const kand = `${j}-${String(mm).padStart(2, '0')}-${String(tt).padStart(2, '0')}`;
    dueDate = kand < localDay() ? `${j + 1}${kand.slice(4)}` : kand;
    return ' ';
  });
  let projectId: string | undefined;
  s = s.replace(/\s#(\S+)/, (_, w) => {
    const p = projekte.find(x => x.title.toLowerCase().includes(String(w).toLowerCase()));
    if (p) { projectId = p.id; return ' '; }
    return ` #${w}`;
  });
  return { title: s.replace(/\s+/g, ' ').trim(), priority, dueDate, projectId, assignee };
}

const PRIO_ZYKLUS: Priority[] = ['low', 'medium', 'high', 'critical'];

interface Reminder { id: string; list: string; title: string; due?: string; priority: number; }

const panel = { background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14 };
const lbl = { fontFamily: T.mono, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: T.muted };

const PRIO: Record<Priority, { c: string; t: string }> = {
  critical: { c: T.crit, t: 'kritisch' },
  high: { c: T.amber, t: 'hoch' },
  medium: { c: T.accent, t: 'mittel' },
  low: { c: T.muted, t: 'niedrig' },
};
const OWNER: Record<string, string> = { kevin: 'Kevin', malin: 'Malin', both: 'Beide' };

interface DelegVorschlag { taskId: string; titel: string; empfehlung: 'abgeben' | 'bleibt'; an?: string; warum: string; uebergabe?: string }

export function AufgabenView() {
  const { state, dispatch, ready } = useTasks();
  const [seg, setSeg] = useState<'offen' | 'erledigt' | 'alle'>('offen');
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [remState, setRemState] = useState<'laden' | 'ok' | 'fehler'>('laden');
  // Delegations-Runde: Jarvis schlägt vor, Kevin klickt — nichts geht automatisch raus.
  const [deleg, setDeleg] = useState<DelegVorschlag[] | null>(null);
  const [delegBusy, setDelegBusy] = useState(false);
  const [delegPrivat, setDelegPrivat] = useState(0);
  const [delegStatus, setDelegStatus] = useState<Record<string, string>>({});

  async function delegationsRunde() {
    setDelegBusy(true); setDeleg(null); setDelegStatus({});
    try {
      const r = await fetch('/api/delegation', { method: 'POST' });
      const d = await r.json();
      if (Array.isArray(d.vorschlaege)) { setDeleg(d.vorschlaege); setDelegPrivat(d.privatAnzahl ?? 0); }
    } catch { /* still */ }
    setDelegBusy(false);
  }

  function delegiere(v: DelegVorschlag) {
    const t = state.tasks.find(x => x.id === v.taskId);
    if (!t || !v.an) return;
    const datum = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
    dispatch({ type: 'UPDATE_TASK', payload: {
      id: v.taskId,
      description: `${t.description ? `${t.description}\n` : ''}— Delegiert an ${v.an} (${datum})${v.uebergabe ? `: ${v.uebergabe}` : ''}`,
      assignee: v.an === 'Malin' ? 'malin' as const : t.assignee,
    } });
    setDelegStatus(s => ({ ...s, [v.taskId]: `✓ an ${v.an}` }));
  }

  useEffect(() => {
    let alive = true;
    fetch('/api/apple-reminders')
      .then(r => r.json())
      .then((data: Reminder[] | { error: string }) => {
        if (!alive) return;
        if (Array.isArray(data)) { setReminders(data); setRemState('ok'); }
        else setRemState('fehler');
      })
      .catch(() => { if (alive) setRemState('fehler'); });
    return () => { alive = false; };
  }, []);

  const remByList = useMemo(() => {
    const m = new Map<string, Reminder[]>();
    reminders.forEach(r => { const a = m.get(r.list) ?? []; a.push(r); m.set(r.list, a); });
    return Array.from(m.entries());
  }, [reminders]);

  const projName = (id: string) => state.projects.find(p => p.id === id)?.title ?? '—';
  // Delegiert-Marker aus der Beschreibung („— Delegiert an Frank (31.07): …").
  const delegiertAn = (desc?: string) => desc?.match(/— Delegiert an (\w+)/)?.[1];
  const [bes, setBes] = useState<'alle' | 'kevin' | 'malin' | 'both'>('alle');

  // ── Schnell-Anlegen + Zeilen-Editor + Fokus-Regler-Lenkung ──
  const [neuTitel, setNeuTitel] = useState('');
  const [offenId, setOffenId] = useState<string | null>(null);
  const [regler, setRegler] = useState<Record<string, number>>({});
  useEffect(() => {
    fetch('/api/state/fokus-regler').then(r => r.json()).then(d => setRegler(d.regler ?? {})).catch(() => {});
  }, []);
  const boost = (t: { projectId: string }) => regler[SAEULE_VON_PROJEKT[t.projectId] ?? ''] ?? 50;

  function schnellAnlegen() {
    if (!neuTitel.trim()) return;
    const p = parseSchnell(neuTitel, state.projects);
    if (!p.title) return;
    dispatch({ type: 'ADD_TASK', payload: {
      projectId: p.projectId ?? state.projects[0]?.id ?? '',
      title: p.title, description: '', status: 'todo', priority: p.priority,
      assignee: p.assignee, tags: [], subTasks: [], dependencies: [], sortOrder: 0,
      ...(p.dueDate ? { dueDate: p.dueDate } : {}),
    } });
    setNeuTitel('');
  }

  const heute = localDay();
  const patchTask = (id: string, p: Record<string, unknown>) => dispatch({ type: 'UPDATE_TASK', payload: { id, ...p } });
  const list = useMemo(() => {
    const arr = state.tasks.filter(t => {
      if (seg === 'offen' && t.status === 'done') return false;
      if (seg === 'erledigt' && t.status !== 'done') return false;
      // Malins Sicht: ihr zugewiesen ODER an sie delegiert. Kevin: seins ohne Wegdelegiertes.
      if (bes === 'malin' && !(t.assignee === 'malin' || t.assignee === 'both' || delegiertAn(t.description) === 'Malin')) return false;
      if (bes === 'kevin' && !((t.assignee === 'kevin' || t.assignee === 'both') && !delegiertAn(t.description))) return false;
      if (bes === 'both' && t.assignee !== 'both') return false;
      return true;
    });
    // Priorität schlägt alles, dann lenkt der Fokus-Regler, dann Fälligkeit.
    const rank: Record<Priority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return arr.sort((a, b) =>
      (rank[a.priority] - rank[b.priority]) ||
      boost(b) - boost(a) ||
      (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') ||
      a.title.localeCompare(b.title));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.tasks, seg, bes, regler]);

  // ── Fällig-Gruppen (nur „Offen"): der Blick, der sagt, was JETZT dran ist ──
  const gruppen = useMemo(() => {
    if (seg !== 'offen') return null;
    const morgenT = tagInT(1);
    const sonntag = tagInT(7 - ((new Date().getDay() + 6) % 7) - 1);
    const defs: { key: string; label: string; test: (d?: string) => boolean }[] = [
      { key: 'spaet', label: 'Überfällig', test: d => !!d && d < heute },
      { key: 'heute', label: 'Heute', test: d => d === heute },
      { key: 'morgen', label: 'Morgen', test: d => d === morgenT },
      { key: 'woche', label: 'Diese Woche', test: d => !!d && d > morgenT && d <= sonntag },
      { key: 'spaeter', label: 'Später', test: d => !!d && d > sonntag },
      { key: 'ohne', label: 'Ohne Datum', test: d => !d },
    ];
    return defs
      .map(g => ({ ...g, tasks: list.filter(t => g.test(t.dueDate)) }))
      .filter(g => g.tasks.length);
  }, [seg, list, heute]);

  const openCount = state.tasks.filter(t => t.status !== 'done').length;
  const fromInbox = (desc?: string) => !!desc && desc.startsWith('Aus Inbox');

  const segBtn = (key: 'offen' | 'erledigt' | 'alle', label: string, n?: number) => (
    <button key={key} onClick={() => setSeg(key)} style={{
      fontFamily: T.sans, fontSize: 12.5, fontWeight: 600, padding: '6px 12px', borderRadius: 9, cursor: 'pointer',
      border: `1px solid ${seg === key ? T.lineHot : T.line}`, background: seg === key ? T.accentSoft : 'transparent',
      color: seg === key ? T.accentInk : T.inkDim,
    }}>{label}{typeof n === 'number' ? <span style={{ fontFamily: T.mono, marginLeft: 6, color: seg === key ? T.accent : T.muted }}>{n}</span> : null}</button>
  );

  return (
    <div style={{ minHeight: '100vh', background: T.void, color: T.ink, fontFamily: T.sans }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '26px clamp(16px,3vw,36px) 48px' }}>
        <Link href="/os" style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, textDecoration: 'none', display: 'inline-block', marginBottom: 8 }}>‹ Übersicht</Link>
        <div style={lbl}>Aufgaben · eine Wahrheit, lokal gespeichert</div>
        <h1 style={{ fontSize: 25, fontWeight: 600, letterSpacing: '-.02em', margin: '6px 0 18px' }}>
          {openCount} {openCount === 1 ? 'Aufgabe' : 'Aufgaben'} offen
        </h1>

        {/* Schnell-Anlegen: tippen, Enter, drin — Kürzel machen den Rest */}
        <div style={{ marginBottom: 12 }}>
          <input value={neuTitel} onChange={e => setNeuTitel(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') schnellAnlegen(); }}
            placeholder="Neue Aufgabe … (Enter)  ·  !! kritisch  ·  ! hoch  ·  heute / morgen / fr / 15.08.  ·  #capos  ·  @malin"
            aria-label="Neue Aufgabe anlegen"
            style={{ width: '100%', background: T.panel, border: `1px solid ${T.line}`, borderRadius: 10, padding: '11px 14px', color: T.ink, fontSize: 13.5, fontFamily: T.sans, outline: 'none' }} />
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
          {segBtn('offen', 'Offen', openCount)}
          {segBtn('erledigt', 'Erledigt')}
          {segBtn('alle', 'Alle')}
          <span style={{ width: 1, height: 20, background: T.line, margin: '0 4px' }} />
          {([['alle', 'Jeder'], ['kevin', 'Kevin'], ['malin', 'Malin'], ['both', 'Beide']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setBes(k)} style={{
              fontFamily: T.mono, fontSize: 11, padding: '5px 10px', borderRadius: 8, cursor: 'pointer',
              border: `1px solid ${bes === k ? T.lineHot : T.line}`, background: 'transparent',
              color: bes === k ? T.accentInk : T.muted,
            }}>{label}</button>
          ))}
          <button onClick={delegationsRunde} disabled={delegBusy}
            style={{ marginLeft: 'auto', fontFamily: T.sans, fontSize: 12.5, fontWeight: 600, padding: '6px 14px', borderRadius: 9, cursor: delegBusy ? 'wait' : 'pointer', border: `1px solid ${T.accent}`, background: `${T.accent}1c`, color: T.accentInk, opacity: delegBusy ? 0.6 : 1 }}>
            {delegBusy ? 'Jarvis prüft dein Board …' : '✨ Delegations-Runde'}
          </button>
        </div>

        {/* Delegations-Vorschläge: Kevin behält nur, was nur er kann */}
        {deleg && (
          <div style={{ ...panel, borderLeft: `3px solid ${T.accent}`, padding: '14px 18px', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
              <span style={lbl}>Delegations-Runde</span>
              <span style={{ fontFamily: T.mono, fontSize: 11, color: T.accent }}>{deleg.filter(v => v.empfehlung === 'abgeben').length} abgebbar · {deleg.filter(v => v.empfehlung === 'bleibt').length} bleiben bei dir</span>
              {delegPrivat > 0 && <span style={{ fontFamily: T.mono, fontSize: 10, color: T.muted }}>{delegPrivat} private ausgeblendet</span>}
              <button onClick={() => setDeleg(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: T.muted, cursor: 'pointer', fontSize: 12 }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {deleg.filter(v => v.empfehlung === 'abgeben').map(v => (
                <div key={v.taskId} style={{ borderBottom: `1px solid ${T.lineSoft}`, paddingBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>{v.titel}</span>
                    <span style={{ fontFamily: T.mono, fontSize: 10.5, color: T.accent, border: `1px solid ${T.accent}44`, borderRadius: 6, padding: '2px 8px' }}>→ {v.an}</span>
                    <span style={{ fontSize: 11.5, color: T.muted }}>{v.warum}</span>
                  </div>
                  {v.uebergabe && <div style={{ fontSize: 12.5, color: T.inkDim, margin: '6px 0 7px', lineHeight: 1.5 }}>„{v.uebergabe}"</div>}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {delegStatus[v.taskId]
                      ? <span style={{ fontSize: 12, color: T.accent, border: `1px solid ${T.accent}44`, background: `${T.accent}14`, borderRadius: 8, padding: '5px 11px' }}>{delegStatus[v.taskId]} — Übergabetext in der Aufgabe notiert</span>
                      : <>
                          <button onClick={() => delegiere(v)} style={{ fontSize: 12, fontWeight: 600, color: T.void, background: T.accent, border: `1px solid ${T.accent}`, borderRadius: 8, padding: '5px 12px', cursor: 'pointer' }}>✓ Delegieren an {v.an}</button>
                          {v.uebergabe && <button onClick={() => { try { navigator.clipboard.writeText(v.uebergabe!); } catch { /* egal */ } }} style={{ fontSize: 12, color: T.inkDim, background: 'transparent', border: `1px solid ${T.line}`, borderRadius: 8, padding: '5px 11px', cursor: 'pointer' }}>Übergabetext kopieren</button>}
                          <button onClick={() => setDelegStatus(s => ({ ...s, [v.taskId]: 'bleibt bei dir' }))} style={{ fontSize: 12, color: T.muted, background: 'transparent', border: `1px solid ${T.line}`, borderRadius: 8, padding: '5px 11px', cursor: 'pointer' }}>Bleibt bei mir</button>
                        </>}
                  </div>
                </div>
              ))}
              {deleg.filter(v => v.empfehlung === 'bleibt').length > 0 && (
                <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.6 }}>
                  <b style={{ color: T.inkDim }}>Bleibt bei dir:</b> {deleg.filter(v => v.empfehlung === 'bleibt').map(v => v.titel).join(' · ')}
                </div>
              )}
              {!deleg.length && <span style={{ fontSize: 12.5, color: T.muted }}>Nichts Delegierbares offen.</span>}
            </div>
          </div>
        )}

        <div style={{ ...panel, overflow: 'hidden' }}>
          {!ready && <div style={{ padding: '34px 20px', textAlign: 'center', color: T.muted, fontSize: 13.5 }}>Lade Aufgaben …</div>}
          {ready && list.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: T.muted, fontSize: 13.5 }}>
              {seg === 'offen' ? 'Alles erledigt. 🎯' : 'Keine Aufgaben in dieser Ansicht.'}
            </div>
          )}
          {(gruppen ?? [{ key: 'flach', label: '', tasks: list }]).map(g => (
            <div key={g.key}>
              {g.label && (
                <div style={{ padding: '9px 16px 4px', fontFamily: T.mono, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: g.key === 'spaet' ? T.crit : g.key === 'heute' ? T.accent : T.muted, borderTop: `1px solid ${T.lineSoft}` }}>
                  {g.label} · {g.tasks.length}
                </div>
              )}
              {g.tasks.map((t, i) => {
                const done = t.status === 'done';
                const blockiert = t.status === 'blocked';
                const p = PRIO[t.priority];
                const auf = offenId === t.id;
                const imFokus = !done && boost(t) >= FOKUS_SCHWELLE;
                return (
                  <div key={t.id} style={{ borderTop: i || !g.label ? `1px solid ${T.lineSoft}` : 0, background: auf ? T.panel2 : 'transparent' }}>
                    <div onClick={() => setOffenId(auf ? null : t.id)} style={{ display: 'flex', gap: 13, padding: '12px 16px', alignItems: 'flex-start', cursor: 'pointer' }}>
                      <button onClick={e => { e.stopPropagation(); dispatch({ type: 'TOGGLE_TASK', payload: { id: t.id } }); }} aria-label={done ? 'Wieder öffnen' : 'Erledigen'}
                        style={{ width: 19, height: 19, borderRadius: 6, flex: '0 0 auto', marginTop: 1, cursor: 'pointer',
                          border: `1.6px solid ${done ? T.accent : T.muted}`, background: done ? T.accent : 'transparent',
                          color: T.void, fontSize: 12, lineHeight: 1, display: 'grid', placeItems: 'center' }}>{done ? <span className="check-pop">✓</span> : ''}</button>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 550, color: done ? T.muted : blockiert ? T.amber : T.ink, textDecoration: done ? 'line-through' : 'none', lineHeight: 1.35 }}>
                          {imFokus && <span style={{ color: T.accent }}>◎ </span>}{t.title}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 5, flexWrap: 'wrap' }}>
                          {!done && (
                            <button onClick={e => { e.stopPropagation(); patchTask(t.id, { priority: PRIO_ZYKLUS[(PRIO_ZYKLUS.indexOf(t.priority) + 1) % PRIO_ZYKLUS.length] }); }}
                              title="Priorität wechseln"
                              style={{ fontFamily: T.mono, fontSize: 9.5, letterSpacing: '.04em', textTransform: 'uppercase', color: p.c, border: `1px solid ${p.c}44`, borderRadius: 5, padding: '1px 6px', background: 'transparent', cursor: 'pointer' }}>{p.t}</button>
                          )}
                          {blockiert && <span style={{ fontFamily: T.mono, fontSize: 9.5, letterSpacing: '.04em', textTransform: 'uppercase', color: T.amber, border: `1px solid ${T.amber}55`, borderRadius: 5, padding: '1px 6px' }}>blockiert</span>}
                          {t.dueDate && <span style={{ fontFamily: T.mono, fontSize: 10, color: t.dueDate < heute && !done ? T.crit : T.muted }}>{t.dueDate.slice(8)}.{t.dueDate.slice(5, 7)}.</span>}
                          <span style={{ fontFamily: T.mono, fontSize: 10, color: T.muted }}>{projName(t.projectId)}</span>
                          <span style={{ fontFamily: T.mono, fontSize: 10, color: T.muted }}>· {OWNER[t.assignee] ?? t.assignee}</span>
                          {delegiertAn(t.description) && <span style={{ fontFamily: T.mono, fontSize: 9.5, letterSpacing: '.04em', textTransform: 'uppercase', color: T.amber, border: `1px solid ${T.amber}55`, borderRadius: 5, padding: '1px 6px' }}>→ delegiert an {delegiertAn(t.description)}</span>}
                          {fromInbox(t.description) && <span style={{ fontFamily: T.mono, fontSize: 9.5, letterSpacing: '.04em', textTransform: 'uppercase', color: T.accent, border: `1px solid ${T.lineHot}`, borderRadius: 5, padding: '1px 6px' }}>aus Inbox</span>}
                        </div>
                      </div>
                      <span style={{ fontFamily: T.mono, fontSize: 12, color: T.muted, flex: '0 0 auto' }}>{auf ? '▾' : '▸'}</span>
                    </div>
                    {auf && (
                      <div style={{ padding: '0 16px 13px 48px', display: 'flex', flexDirection: 'column', gap: 9 }}>
                        {t.description && <div style={{ fontSize: 12, color: T.inkDim, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{t.description}</div>}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{ fontFamily: T.mono, fontSize: 9.5, color: T.muted, textTransform: 'uppercase', letterSpacing: '.08em' }}>Fällig</span>
                          {([['Heute', heute], ['Morgen', tagInT(1)], ['Montag', naechsterWochentag(1)], ['+7 Tage', tagInT(7)]] as const).map(([label, d]) => (
                            <button key={label} onClick={() => patchTask(t.id, { dueDate: d })}
                              style={{ fontFamily: T.sans, fontSize: 11.5, padding: '4px 10px', borderRadius: 7, cursor: 'pointer', border: `1px solid ${t.dueDate === d ? T.accent : T.line}`, background: t.dueDate === d ? `${T.accent}1c` : 'transparent', color: t.dueDate === d ? T.accentInk : T.inkDim }}>{label}</button>
                          ))}
                          {t.dueDate && <button onClick={() => patchTask(t.id, { dueDate: undefined })} style={{ fontFamily: T.sans, fontSize: 11.5, padding: '4px 10px', borderRadius: 7, cursor: 'pointer', border: `1px solid ${T.line}`, background: 'transparent', color: T.muted }}>✕ kein Datum</button>}
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                          <select value={t.projectId} onChange={e => patchTask(t.id, { projectId: e.target.value })}
                            style={{ background: T.void, border: `1px solid ${T.line}`, borderRadius: 7, color: T.inkDim, fontFamily: T.sans, fontSize: 11.5, padding: '4px 8px', outline: 'none' }}>
                            {state.projects.map(pr => <option key={pr.id} value={pr.id} style={{ background: T.panel }}>{pr.title}</option>)}
                          </select>
                          <select value={t.assignee} onChange={e => patchTask(t.id, { assignee: e.target.value })}
                            style={{ background: T.void, border: `1px solid ${T.line}`, borderRadius: 7, color: T.inkDim, fontFamily: T.sans, fontSize: 11.5, padding: '4px 8px', outline: 'none' }}>
                            <option value="kevin" style={{ background: T.panel }}>Kevin</option>
                            <option value="malin" style={{ background: T.panel }}>Malin</option>
                            <option value="both" style={{ background: T.panel }}>Beide</option>
                          </select>
                          <button onClick={() => patchTask(t.id, { status: blockiert ? 'todo' : 'blocked' })}
                            style={{ fontFamily: T.sans, fontSize: 11.5, padding: '4px 10px', borderRadius: 7, cursor: 'pointer', border: `1px solid ${blockiert ? T.amber : T.line}`, background: blockiert ? `${T.amber}1c` : 'transparent', color: blockiert ? T.amber : T.inkDim }}>{blockiert ? 'blockiert ✓' : 'blockiert?'}</button>
                          <button onClick={() => { dispatch({ type: 'DELETE_TASK', payload: { id: t.id } }); setOffenId(null); }}
                            style={{ marginLeft: 'auto', fontFamily: T.sans, fontSize: 11.5, padding: '4px 10px', borderRadius: 7, cursor: 'pointer', border: `1px solid ${T.line}`, background: 'transparent', color: T.muted }}>Löschen</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Apple Erinnerungen (iCloud · geteilt mit Malin) */}
        <div style={{ marginTop: 28 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
            <div style={lbl}>Erinnerungen · iCloud <span style={{ color: T.muted, textTransform: 'none', letterSpacing: 0 }}>· geteilt mit Malin</span></div>
            {remState === 'ok' && <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>{reminders.length} offen</span>}
          </div>

          {remState === 'laden' && <div style={{ ...panel, padding: '20px', color: T.muted, fontSize: 13 }}>Lade Erinnerungen aus iCloud …</div>}

          {remState === 'fehler' && (
            <div style={{ ...panel, padding: '18px 20px', borderColor: `${T.amber}55` }}>
              <div style={{ fontSize: 13.5, color: T.ink, fontWeight: 600, marginBottom: 4 }}>Zugriff auf Erinnerungen freigeben</div>
              <div style={{ fontSize: 12.5, color: T.inkDim, lineHeight: 1.5 }}>macOS muss den Zugriff einmalig erlauben — bestätige das Popup „Zugriff auf Erinnerungen", oder aktiviere es unter <b>Systemeinstellungen → Datenschutz &amp; Sicherheit → Erinnerungen</b>. Danach die Seite neu laden.</div>
            </div>
          )}

          {remState === 'ok' && reminders.length === 0 && <div style={{ ...panel, padding: '18px 20px', color: T.muted, fontSize: 13 }}>Keine offenen Erinnerungen. 🎯</div>}

          {remState === 'ok' && remByList.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 12 }}>
              {remByList.map(([lname, items]) => (
                <div key={lname} style={{ ...panel, padding: '14px 16px' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: T.accentInk, marginBottom: 10 }}>{lname} <span style={{ fontFamily: T.mono, fontSize: 10, color: T.muted }}>{items.length}</span></div>
                  {items.slice(0, 10).map((r, i) => (
                    <div key={r.id} style={{ display: 'flex', gap: 9, padding: '7px 0', borderTop: i ? `1px solid ${T.lineSoft}` : 0 }}>
                      <span style={{ width: 15, height: 15, borderRadius: 5, border: `1.5px solid ${T.muted}`, flex: '0 0 auto', marginTop: 1 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: T.inkDim, lineHeight: 1.35 }}>{r.title}</div>
                        {r.due && <div style={{ fontFamily: T.mono, fontSize: 10, color: T.amber, marginTop: 2 }}>{new Date(r.due).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</div>}
                      </div>
                    </div>
                  ))}
                  {items.length > 10 && <div style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, marginTop: 6 }}>+{items.length - 10} weitere</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginTop: 20, fontFamily: T.mono, fontSize: 10.5, color: T.muted }}>
          Aufgaben werden lokal auf deinem Mac gespeichert · Erinnerungen live aus iCloud.
        </div>
      </div>
    </div>
  );
}
