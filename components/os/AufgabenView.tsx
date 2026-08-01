'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { THEME as T } from '@/lib/make-one/os-data';
import { useTasks } from '@/context/TasksContext';
import type { Priority } from '@/types';
import { localDay } from '@/lib/zeit';
import { SAEULE_VON_PROJEKT, FOKUS_SCHWELLE } from '@/lib/make-one/fokus-data';
import { THEMA, STANDARD_ORDNUNG, themaVon, sortierteThemen } from '@/lib/make-one/ordnung-data';
import { STICHWORTE, STICHWORT, stichworteVon, mitEigenen } from '@/lib/make-one/stichworte-data';
import { ORGS, ORG, orgVon } from '@/lib/make-one/organisation-data';
import { einschaetzen, dauerText, WER_LABEL, WER_FARBE, type Wer } from '@/lib/make-one/umsetzung-data';
import { DELEGIERBAR } from '@/lib/make-one/team-data';
import { wertVon, STANDARD_MODUS, type ReglerId } from '@/lib/make-one/kompass-data';
import { Zeitstrahl, type StrahlMarker } from './Zeitstrahl';

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
const PRIO_RANG: Record<Priority, number> = { critical: 0, high: 1, medium: 2, low: 3 };

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

type Ansicht = 'jetzt' | 'themen' | 'zeit' | 'liste';
const ANSICHTEN: { key: Ansicht; label: string }[] = [
  { key: 'jetzt', label: 'Jetzt' },
  { key: 'themen', label: 'Themen' },
  { key: 'zeit', label: 'Zeitstrahl' },
  { key: 'liste', label: 'Liste' },
];

interface DelegVorschlag { taskId: string; titel: string; empfehlung: 'abgeben' | 'bleibt'; an?: string; warum: string; uebergabe?: string }

export function AufgabenView() {
  const { state, dispatch, ready } = useTasks();
  const [seg, setSeg] = useState<'offen' | 'erledigt' | 'alle'>('offen');
  const [ansicht, setAnsicht] = useState<Ansicht>('jetzt');
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [remState, setRemState] = useState<'laden' | 'ok' | 'fehler'>('laden');
  // Delegations-Runde: Jarvis schlägt vor, Kevin klickt — nichts geht automatisch raus.
  const [deleg, setDeleg] = useState<DelegVorschlag[] | null>(null);
  const [delegBusy, setDelegBusy] = useState(false);
  const [delegPrivat, setDelegPrivat] = useState(0);
  const [delegStatus, setDelegStatus] = useState<Record<string, string>>({});
  const [delegSort, setDelegSort] = useState<'person' | 'prio' | 'aufwand' | 'thema'>('person');

  // ── Die Ordnung: Reihenfolge der Themen + Zuordnungen von Hand ──
  const [reihenfolge, setReihenfolge] = useState<string[]>(STANDARD_ORDNUNG);
  const [zuordnung, setZuordnung] = useState<Record<string, string>>({});
  const [handStich, setHandStich] = useState<Record<string, string[]>>({});
  const [orgZuord, setOrgZuord] = useState<Record<string, string>>({});
  // Eigene Filter & Stichworte aus dem Kompass
  const [eigeneFilter, setEigeneFilter] = useState<{ id: string; name: string; wo: string; themen?: string[]; orgs?: string[]; prios?: string[]; stichworte?: string[]; wege?: string[]; besitzer?: string; suche?: string }[]>([]);
  const [eigeneStich, setEigeneStich] = useState<{ id: string; label: string; thema: string; woerter: string[]; kpi?: boolean }[]>([]);
  const [aktiverFilter, setAktiverFilter] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/state/filter').then(r => r.json()).then(d => {
      setEigeneFilter(Array.isArray(d.filter) ? d.filter.filter((f: { wo: string }) => f.wo !== 'inbox') : []);
      setEigeneStich(Array.isArray(d.stichworte) ? d.stichworte : []);
    }).catch(() => {});
  }, []);
  const stichListe = useMemo(() => mitEigenen(eigeneStich), [eigeneStich]);
  // Grenzen aus dem Kompass — dieselben Werte, die dort eingestellt werden.
  const [kompass, setKompass] = useState<{ modus: string; eigene: Partial<Record<ReglerId, number>> }>({ modus: STANDARD_MODUS, eigene: {} });
  useEffect(() => {
    fetch('/api/state/kompass').then(r => r.json()).then(d => setKompass({ modus: d.modus ?? STANDARD_MODUS, eigene: d.eigene ?? {} })).catch(() => {});
  }, []);
  const grenzeLast = wertVon('tageslast', kompass.modus, kompass.eigene);
  const grenzeKritisch = wertVon('kritisch-grenze', kompass.modus, kompass.eigene);
  const [ordnungAuf, setOrdnungAuf] = useState(false);
  useEffect(() => {
    fetch('/api/state/ordnung').then(r => r.json()).then(d => {
      if (Array.isArray(d.reihenfolge) && d.reihenfolge.length) setReihenfolge(d.reihenfolge);
      if (d.zuordnung) setZuordnung(d.zuordnung);
      if (d.stichworte) setHandStich(d.stichworte);
      if (d.orgs) setOrgZuord(d.orgs);
    }).catch(() => {});
  }, []);
  function ordnungSpeichern(next: { reihenfolge?: string[]; zuordnung?: Record<string, string>; stichworte?: Record<string, string[]>; orgs?: Record<string, string> }) {
    if (next.reihenfolge) setReihenfolge(next.reihenfolge);
    if (next.zuordnung) setZuordnung(v => ({ ...v, ...next.zuordnung }));
    if (next.stichworte) setHandStich(v => ({ ...v, ...next.stichworte }));
    if (next.orgs) setOrgZuord(v => ({ ...v, ...next.orgs }));
    fetch('/api/state/ordnung', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) }).catch(() => {});
  }
  function themaSchieben(id: string, richtung: -1 | 1) {
    const i = reihenfolge.indexOf(id);
    const j = i + richtung;
    if (i < 0 || j < 0 || j >= reihenfolge.length) return;
    const next = [...reihenfolge];
    [next[i], next[j]] = [next[j], next[i]];
    ordnungSpeichern({ reihenfolge: next });
  }
  const themen = useMemo(() => sortierteThemen(reihenfolge), [reihenfolge]);
  const themaRang = useMemo(() => Object.fromEntries(themen.map((b, i) => [b.id, i])) as Record<string, number>, [themen]);

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
  const [prioFilter, setPrioFilter] = useState<Priority | 'alle'>('alle');
  const [themaFilter, setThemaFilter] = useState<string | 'alle'>('alle');
  const [orgFilter, setOrgFilter] = useState<string | 'alle'>('alle');
  const [werFilter, setWerFilter] = useState<Wer | 'alle'>('alle');
  const [stichFilter, setStichFilter] = useState<string | null>(null);
  const [stichSuche, setStichSuche] = useState('');
  const [alleStichAuf, setAlleStichAuf] = useState(false);

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
  const meinThema = (t: { id: string; title: string; description?: string; projectId: string }) => themaVon(t, zuordnung);
  const meineStich = (t: { id: string; title: string; description?: string }) => stichworteVon(t, handStich);
  const meineOrg = (t: { id: string; title: string; description?: string; projectId: string }) => orgVon(t, orgZuord);

  const list = useMemo(() => {
    const arr = state.tasks.filter(t => {
      if (seg === 'offen' && t.status === 'done') return false;
      if (seg === 'erledigt' && t.status !== 'done') return false;
      // Malins Sicht: ihr zugewiesen ODER an sie delegiert. Kevin: seins ohne Wegdelegiertes.
      if (bes === 'malin' && !(t.assignee === 'malin' || t.assignee === 'both' || delegiertAn(t.description) === 'Malin')) return false;
      if (bes === 'kevin' && !((t.assignee === 'kevin' || t.assignee === 'both') && !delegiertAn(t.description))) return false;
      if (bes === 'both' && t.assignee !== 'both') return false;
      if (prioFilter !== 'alle' && t.priority !== prioFilter) return false;
      if (themaFilter !== 'alle' && themaVon(t, zuordnung) !== themaFilter) return false;
      if (stichFilter && !stichworteVon(t, handStich, stichListe).includes(stichFilter)) return false;
      if (orgFilter !== 'alle' && orgVon(t, orgZuord) !== orgFilter) return false;
      if (werFilter !== 'alle' && einschaetzen(t).wer !== werFilter) return false;
      // Gespeicherter Filter aus dem Kompass: leere Liste heißt „egal".
      if (aktiverFilter) {
        const f = eigeneFilter.find(x => x.id === aktiverFilter);
        if (f) {
          if (f.themen?.length && !f.themen.includes(themaVon(t, zuordnung))) return false;
          if (f.orgs?.length && !f.orgs.includes(orgVon(t, orgZuord))) return false;
          if (f.prios?.length && !f.prios.includes(t.priority)) return false;
          if (f.wege?.length && !f.wege.includes(einschaetzen(t).wer)) return false;
          if (f.besitzer && t.assignee !== f.besitzer) return false;
          if (f.stichworte?.length) {
            const meine = stichworteVon(t, handStich, stichListe);
            if (!f.stichworte.some(s => meine.includes(s))) return false;
          }
          if (f.suche && !`${t.title} ${t.description ?? ''}`.toLowerCase().includes(f.suche.toLowerCase())) return false;
        }
      }
      return true;
    });
    // Die Ordnung entscheidet: kritisch bricht die Thema (das sind unsere
    // Blocker), danach zählt die Thema-Reihenfolge, dann Prio und Fälligkeit.
    const key = (t: typeof arr[number]) => [
      t.priority === 'critical' ? 0 : 1,
      themaRang[themaVon(t, zuordnung)] ?? 9,
      PRIO_RANG[t.priority],
      t.dueDate && t.dueDate < heute ? 0 : 1,
      t.dueDate ?? '9999-99-99',
    ];
    return arr.sort((a, b) => {
      const ka = key(a), kb = key(b);
      for (let i = 0; i < ka.length; i++) {
        if (ka[i] !== kb[i]) return ka[i] < kb[i] ? -1 : 1;
      }
      return boost(b) - boost(a) || a.title.localeCompare(b.title);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.tasks, seg, bes, prioFilter, themaFilter, stichFilter, orgFilter, werFilter, aktiverFilter, eigeneFilter, stichListe, handStich, orgZuord, regler, zuordnung, themaRang, heute]);

  // ── Stichwort-Register: was gerade wirklich anliegt, nach Dringlichkeit ──
  const stichStand = useMemo(() => {
    const zaehl = new Map<string, { offen: number; kritisch: number; spaet: number }>();
    state.tasks.filter(t => t.status !== 'done').forEach(t => {
      const spaet = !!t.dueDate && t.dueDate < heute;
      stichworteVon(t, handStich).forEach(id => {
        const e = zaehl.get(id) ?? { offen: 0, kritisch: 0, spaet: 0 };
        e.offen++;
        if (t.priority === 'critical') e.kritisch++;
        if (spaet) e.spaet++;
        zaehl.set(id, e);
      });
    });
    return Array.from(zaehl.entries())
      .map(([id, z]) => ({ id, ...z, wort: STICHWORT[id] }))
      .filter(x => x.wort)
      .sort((a, b) => b.kritisch - a.kritisch || b.spaet - a.spaet || b.offen - a.offen || a.wort.label.localeCompare(b.wort.label));
  }, [state.tasks, handStich, heute]);

  // ── Fällig-Gruppen (Listen-Ansicht): was JETZT dran ist ──
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

  // Delegations-Ergebnis sortierbar — nach der Runde will man ordnen können.
  const delegSortiert = useMemo(() => {
    if (!deleg) return [];
    const task = (id: string) => state.tasks.find(x => x.id === id);
    const arr = [...deleg];
    return arr.sort((a, b) => {
      const ta = task(a.taskId), tb = task(b.taskId);
      if (delegSort === 'person') return (a.an ?? 'zz').localeCompare(b.an ?? 'zz') || a.titel.localeCompare(b.titel);
      if (delegSort === 'prio') return (PRIO_RANG[ta?.priority ?? 'low'] - PRIO_RANG[tb?.priority ?? 'low']) || a.titel.localeCompare(b.titel);
      if (delegSort === 'aufwand') return (einschaetzen(tb ?? { title: b.titel }).dauer - einschaetzen(ta ?? { title: a.titel }).dauer);
      return (ta ? themaRang[meinThema(ta)] ?? 9 : 9) - (tb ? themaRang[meinThema(tb)] ?? 9 : 9);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deleg, delegSort, state.tasks, themaRang, zuordnung]);

  const openCount = state.tasks.filter(t => t.status !== 'done').length;
  /** Gesamtaufwand der aktuellen Auswahl — sagt, ob der Plan in einen Tag passt. */
  const lastMin = useMemo(() => list.filter(t => t.status !== 'done').reduce((s, t) => s + einschaetzen(t).dauer, 0), [list]);
  const kritischOffen = state.tasks.filter(t => t.status !== 'done' && t.priority === 'critical').length;
  const fromInbox = (desc?: string) => !!desc && desc.startsWith('Aus Inbox');

  const segBtn = (key: 'offen' | 'erledigt' | 'alle', label: string, n?: number) => (
    <button key={key} onClick={() => setSeg(key)} style={{
      fontFamily: T.sans, fontSize: 12.5, fontWeight: 600, padding: '6px 12px', borderRadius: 9, cursor: 'pointer',
      border: `1px solid ${seg === key ? T.lineHot : T.line}`, background: seg === key ? T.accentSoft : 'transparent',
      color: seg === key ? T.accentInk : T.inkDim,
    }}>{label}{typeof n === 'number' ? <span style={{ fontFamily: T.mono, marginLeft: 6, color: seg === key ? T.accent : T.muted }}>{n}</span> : null}</button>
  );

  /** Eine Aufgabenzeile — überall gleich, damit jede Ansicht dieselbe Wahrheit zeigt. */
  const Zeile = ({ t, i, zeigeThema }: { t: typeof list[number]; i: number; zeigeThema?: boolean }) => {
    const done = t.status === 'done';
    const blockiert = t.status === 'blocked';
    const p = PRIO[t.priority];
    const auf = offenId === t.id;
    const imFokus = !done && boost(t) >= FOKUS_SCHWELLE;
    const thema = THEMA[meinThema(t)];
    const spaet = !!t.dueDate && t.dueDate < heute && !done;
    const kritisch = t.priority === 'critical' && !done;
    return (
      <div style={{ borderTop: i ? `1px solid ${T.lineSoft}` : 0, background: auf ? T.panel2 : 'transparent' }}>
        <div onClick={() => setOffenId(auf ? null : t.id)} style={{ display: 'flex', gap: 13, padding: '12px 16px', alignItems: 'flex-start', cursor: 'pointer' }}>
          <button onClick={e => { e.stopPropagation(); dispatch({ type: 'TOGGLE_TASK', payload: { id: t.id } }); }} aria-label={done ? 'Wieder öffnen' : 'Erledigen'}
            style={{ width: 19, height: 19, borderRadius: 6, flex: '0 0 auto', marginTop: 1, cursor: 'pointer',
              border: `1.6px solid ${done ? T.accent : kritisch ? T.crit : T.muted}`, background: done ? T.accent : 'transparent',
              color: T.void, fontSize: 12, lineHeight: 1, display: 'grid', placeItems: 'center' }}>{done ? <span className="check-pop">✓</span> : ''}</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 550, color: done ? T.muted : blockiert ? T.amber : T.ink, textDecoration: done ? 'line-through' : 'none', lineHeight: 1.35 }}>
              {kritisch && <span className="krit-puls" style={{ color: T.crit, marginRight: 5 }}>●</span>}
              {imFokus && <span style={{ color: T.accent }}>◎ </span>}{t.title}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 5, flexWrap: 'wrap' }}>
              {!done && (
                <button onClick={e => { e.stopPropagation(); patchTask(t.id, { priority: PRIO_ZYKLUS[(PRIO_ZYKLUS.indexOf(t.priority) + 1) % PRIO_ZYKLUS.length] }); }}
                  title="Priorität wechseln"
                  className={kritisch ? 'krit-puls' : undefined}
                  style={{ fontFamily: T.mono, fontSize: 9.5, letterSpacing: '.04em', textTransform: 'uppercase', color: p.c, border: `1px solid ${p.c}${kritisch ? '99' : '44'}`, borderRadius: 5, padding: '1px 6px', background: kritisch ? `${T.crit}18` : 'transparent', cursor: 'pointer' }}>{p.t}</button>
              )}
              {zeigeThema && thema && <span style={{ fontFamily: T.mono, fontSize: 9.5, letterSpacing: '.04em', textTransform: 'uppercase', color: thema.farbe, border: `1px solid ${thema.farbe}44`, borderRadius: 5, padding: '1px 6px' }}>{thema.label.split(' ')[0]}</span>}
              {!done && (() => {
                const e = einschaetzen(t);
                return (
                  <span title={`${WER_LABEL[e.wer]} — ${e.warum}${e.beitrag ? ` · Jarvis: ${e.beitrag}` : ''}`}
                    style={{ fontFamily: T.mono, fontSize: 9.5, color: WER_FARBE[e.wer], border: `1px solid ${WER_FARBE[e.wer]}44`, borderRadius: 5, padding: '1px 6px' }}>
                    {e.wer === 'jarvis' ? '⚡' : e.wer === 'gemeinsam' ? '◐' : '☺'} {dauerText(e.dauer)}
                  </span>
                );
              })()}
              {zeigeThema && <span style={{ fontFamily: T.mono, fontSize: 9.5, color: ORG[meineOrg(t)]?.farbe, opacity: 0.85 }}>{ORG[meineOrg(t)]?.kurz}</span>}
              {meineStich(t).slice(0, 3).map(sid => (
                <button key={sid} onClick={e => { e.stopPropagation(); setStichFilter(stichFilter === sid ? null : sid); }}
                  title={`Alles zu „${STICHWORT[sid]?.label}" zeigen`}
                  style={{ fontFamily: T.sans, fontSize: 10.5, color: stichFilter === sid ? T.accentInk : T.muted, border: `1px solid ${stichFilter === sid ? T.accent : T.line}`, borderRadius: 999, padding: '1px 8px', background: 'transparent', cursor: 'pointer' }}>{STICHWORT[sid]?.label}</button>
              ))}
              {blockiert && <span style={{ fontFamily: T.mono, fontSize: 9.5, letterSpacing: '.04em', textTransform: 'uppercase', color: T.amber, border: `1px solid ${T.amber}55`, borderRadius: 5, padding: '1px 6px' }}>blockiert</span>}
              {t.dueDate && <span className={spaet ? 'krit-puls' : undefined} style={{ fontFamily: T.mono, fontSize: 10, color: spaet ? T.crit : T.muted }}>{t.dueDate.slice(8)}.{t.dueDate.slice(5, 7)}.</span>}
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
            {/* Umsetzung: wie kommt das weg — und was kann Jarvis beitragen */}
            {!done && (() => {
              const e = einschaetzen(t);
              return (
                <div style={{ background: T.panel2, border: `1px solid ${WER_FARBE[e.wer]}33`, borderRadius: 10, padding: '9px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: WER_FARBE[e.wer] }}>{WER_LABEL[e.wer]}</span>
                    <span style={{ fontFamily: T.mono, fontSize: 11, color: T.inkDim }}>≈ {dauerText(e.dauer)}</span>
                    <span style={{ fontSize: 11.5, color: T.muted }}>{e.warum}</span>
                  </div>
                  {e.beitrag && <div style={{ fontSize: 12, color: T.inkDim, marginTop: 4, lineHeight: 1.5 }}>Erster Schritt: {e.beitrag}</div>}
                </div>
              );
            })()}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontFamily: T.mono, fontSize: 9.5, color: T.muted, textTransform: 'uppercase', letterSpacing: '.08em' }}>Ort</span>
              {ORGS.map(o => (
                <button key={o.id} onClick={() => ordnungSpeichern({ orgs: { [t.id]: o.id } })} title={o.satz}
                  style={{ fontFamily: T.sans, fontSize: 11.5, padding: '4px 10px', borderRadius: 7, cursor: 'pointer', border: `1px solid ${meineOrg(t) === o.id ? o.farbe : T.line}`, background: meineOrg(t) === o.id ? `${o.farbe}1c` : 'transparent', color: meineOrg(t) === o.id ? o.farbe : T.inkDim }}>{o.kurz}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontFamily: T.mono, fontSize: 9.5, color: T.muted, textTransform: 'uppercase', letterSpacing: '.08em' }}>Abgeben an</span>
              <select value="" onChange={e => {
                  const an = e.target.value;
                  if (!an) return;
                  const datum = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
                  patchTask(t.id, {
                    description: `${t.description ? `${t.description}\n` : ''}— Delegiert an ${an} (${datum})`,
                    ...(an === 'Malin' ? { assignee: 'malin' } : {}),
                  });
                }}
                aria-label="Aufgabe abgeben an"
                style={{ background: T.void, border: `1px solid ${T.line}`, borderRadius: 7, color: T.inkDim, fontFamily: T.sans, fontSize: 11.5, padding: '4px 8px', outline: 'none' }}>
                <option value="">Person wählen …</option>
                {DELEGIERBAR.map(p => (
                  <option key={p.kurz} value={p.kurz} style={{ background: T.panel }}>{p.name} — {p.bereiche[0]}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontFamily: T.mono, fontSize: 9.5, color: T.muted, textTransform: 'uppercase', letterSpacing: '.08em' }}>Thema</span>
              {themen.map(b => (
                <button key={b.id} onClick={() => ordnungSpeichern({ zuordnung: { [t.id]: b.id } })}
                  style={{ fontFamily: T.sans, fontSize: 11.5, padding: '4px 10px', borderRadius: 7, cursor: 'pointer', border: `1px solid ${meinThema(t) === b.id ? b.farbe : T.line}`, background: meinThema(t) === b.id ? `${b.farbe}1c` : 'transparent', color: meinThema(t) === b.id ? b.farbe : T.inkDim }}>{b.label}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontFamily: T.mono, fontSize: 9.5, color: T.muted, textTransform: 'uppercase', letterSpacing: '.08em' }}>Stichworte</span>
              {meineStich(t).map(sid => {
                const gesetzt = (handStich[t.id] ?? []).includes(sid);
                return (
                  <span key={sid} style={{ fontFamily: T.sans, fontSize: 11.5, color: T.inkDim, border: `1px solid ${T.line}`, borderRadius: 999, padding: '3px 9px', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    {STICHWORT[sid]?.label}
                    {gesetzt
                      ? <button onClick={() => ordnungSpeichern({ stichworte: { [t.id]: (handStich[t.id] ?? []).filter(x => x !== sid) } })} aria-label="Stichwort entfernen" style={{ background: 'none', border: 'none', color: T.muted, cursor: 'pointer', padding: 0, fontSize: 11 }}>✕</button>
                      : <span title="automatisch erkannt" style={{ color: T.accent, fontSize: 9 }}>●</span>}
                  </span>
                );
              })}
              <select value="" onChange={e => { if (e.target.value) ordnungSpeichern({ stichworte: { [t.id]: [...(handStich[t.id] ?? []), e.target.value] } }); }}
                aria-label="Stichwort hinzufügen"
                style={{ background: T.void, border: `1px solid ${T.line}`, borderRadius: 999, color: T.muted, fontFamily: T.sans, fontSize: 11.5, padding: '3px 8px', outline: 'none' }}>
                <option value="">+ Stichwort</option>
                {STICHWORTE.filter(w => !meineStich(t).includes(w.id)).map(w => (
                  <option key={w.id} value={w.id} style={{ background: T.panel }}>{w.label}</option>
                ))}
              </select>
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
  };

  return (
    <div style={{ minHeight: '100vh', background: T.void, color: T.ink, fontFamily: T.sans }}>
      <div style={{ maxWidth: 980, margin: '0 auto', padding: '26px clamp(16px,3vw,36px) 48px' }}>
        <Link href="/os" style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, textDecoration: 'none', display: 'inline-block', marginBottom: 8 }}>‹ Übersicht</Link>
        <div style={lbl}>Aufgaben · eine Wahrheit, lokal gespeichert</div>
        <h1 style={{ fontSize: 25, fontWeight: 600, letterSpacing: '-.02em', margin: '6px 0 4px' }}>
          {openCount} {openCount === 1 ? 'Aufgabe' : 'Aufgaben'} offen
          {kritischOffen > 0 && (
            <span className="krit-puls" style={{ fontSize: 14, fontWeight: 600, color: T.crit, marginLeft: 12 }}>
              ● {kritischOffen} kritisch{kritischOffen > grenzeKritisch ? ` · ${kritischOffen - grenzeKritisch} über deiner Grenze` : ''}
            </span>
          )}
        </h1>
        <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 4 }}>
          Diese Auswahl: <b style={{ color: lastMin > grenzeLast * 60 ? T.amber : T.inkDim }}>{dauerText(lastMin)}</b> geschätzter Aufwand
          {lastMin > grenzeLast * 60 && <> · <b style={{ color: T.amber }}>{dauerText(lastMin - grenzeLast * 60)} über der Tageslast von {grenzeLast} h</b></>}
          {(() => {
            const j = list.filter(t => t.status !== 'done' && einschaetzen(t).wer === 'jarvis');
            const jMin = j.reduce((s, t) => s + einschaetzen(t).dauer, 0);
            return j.length ? <> · davon <b style={{ color: WER_FARBE.jarvis }}>{j.length} Aufgaben ({dauerText(jMin)}) kann Jarvis übernehmen</b></> : null;
          })()}
        </div>

        {/* Die Ordnung — die Reihenfolge, die alles andere sortiert */}
        <div style={{ ...panel, borderLeft: `3px solid ${themen[0]?.farbe ?? T.accent}`, padding: '12px 16px', margin: '14px 0 12px' }}>
          <div onClick={() => setOrdnungAuf(!ordnungAuf)} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', cursor: 'pointer' }}>
            <span style={lbl}>Unsere Ordnung</span>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', flex: 1 }}>
              {themen.map((b, i) => (
                <span key={b.id} style={{ fontSize: 12, fontWeight: 600, color: b.farbe }}>
                  <span style={{ fontFamily: T.mono, fontSize: 10, color: T.muted }}>{i + 1}</span> {b.label}
                  {i < themen.length - 1 && <span style={{ color: T.muted, marginLeft: 7 }}>›</span>}
                </span>
              ))}
            </div>
            <span style={{ fontFamily: T.mono, fontSize: 12, color: T.muted }}>{ordnungAuf ? '▾' : '▸'}</span>
          </div>
          {ordnungAuf && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 12, color: T.inkDim, lineHeight: 1.55 }}>
                Was zuerst zählt, wenn alles wichtig ist. Diese Reihenfolge sortiert jede Ansicht —
                nur <b style={{ color: T.crit }}>kritische</b> Aufgaben brechen sie, weil sie alles andere blockieren.
              </div>
              {themen.map((b, i) => {
                const n = state.tasks.filter(t => t.status !== 'done' && meinThema(t) === b.id).length;
                return (
                  <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 11px', background: T.panel2, border: `1px solid ${b.farbe}33`, borderRadius: 10 }}>
                    <span style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 700, color: b.farbe, width: 16 }}>{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{b.label} <span style={{ fontFamily: T.mono, fontSize: 10.5, color: T.muted }}>{n} offen</span></div>
                      <div style={{ fontSize: 11.5, color: T.muted, marginTop: 1 }}>{b.satz}</div>
                    </div>
                    <button onClick={() => themaSchieben(b.id, -1)} disabled={i === 0} aria-label="Nach oben"
                      style={{ background: 'transparent', border: `1px solid ${T.line}`, borderRadius: 7, color: i === 0 ? T.line : T.inkDim, padding: '3px 9px', cursor: i === 0 ? 'default' : 'pointer' }}>▲</button>
                    <button onClick={() => themaSchieben(b.id, 1)} disabled={i === themen.length - 1} aria-label="Nach unten"
                      style={{ background: 'transparent', border: `1px solid ${T.line}`, borderRadius: 7, color: i === themen.length - 1 ? T.line : T.inkDim, padding: '3px 9px', cursor: i === themen.length - 1 ? 'default' : 'pointer' }}>▼</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Schnell-Anlegen: tippen, Enter, drin — Kürzel machen den Rest */}
        <div style={{ marginBottom: 12 }}>
          <input value={neuTitel} onChange={e => setNeuTitel(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') schnellAnlegen(); }}
            placeholder="Neue Aufgabe … (Enter)  ·  !! kritisch  ·  ! hoch  ·  heute / morgen / fr / 15.08.  ·  #capos  ·  @malin"
            aria-label="Neue Aufgabe anlegen"
            style={{ width: '100%', background: T.panel, border: `1px solid ${T.line}`, borderRadius: 10, padding: '11px 14px', color: T.ink, fontSize: 13.5, fontFamily: T.sans, outline: 'none' }} />
        </div>

        {/* Eigene Filter aus dem Kompass — einmal eingestellt, immer da */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10, alignItems: 'center' }}>
          <span style={{ ...lbl, marginRight: 2 }}>Meine Filter</span>
          {eigeneFilter.map(f => (
            <button key={f.id} onClick={() => setAktiverFilter(aktiverFilter === f.id ? null : f.id)} style={{
              fontFamily: T.sans, fontSize: 12, fontWeight: aktiverFilter === f.id ? 700 : 500, padding: '5px 12px', borderRadius: 999, cursor: 'pointer',
              border: `1px solid ${aktiverFilter === f.id ? T.accent : T.line}`, background: aktiverFilter === f.id ? `${T.accent}1c` : 'transparent',
              color: aktiverFilter === f.id ? T.accentInk : T.inkDim,
            }}>{f.name}</button>
          ))}
          <Link href="/os/kompass" style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, textDecoration: 'none', border: `1px dashed ${T.line}`, borderRadius: 999, padding: '5px 12px' }}>
            {eigeneFilter.length ? '+ verwalten' : '+ eigenen Filter anlegen'}
          </Link>
        </div>

        {/* Ansicht wählen */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {ANSICHTEN.map(a => (
            <button key={a.key} onClick={() => setAnsicht(a.key)} style={{
              fontFamily: T.sans, fontSize: 12.5, fontWeight: 600, padding: '6px 14px', borderRadius: 9, cursor: 'pointer',
              border: `1px solid ${ansicht === a.key ? T.lineHot : T.line}`, background: ansicht === a.key ? T.accentSoft : 'transparent',
              color: ansicht === a.key ? T.accentInk : T.inkDim,
            }}>{a.label}</button>
          ))}
          <button onClick={delegationsRunde} disabled={delegBusy}
            style={{ marginLeft: 'auto', fontFamily: T.sans, fontSize: 12.5, fontWeight: 600, padding: '6px 14px', borderRadius: 9, cursor: delegBusy ? 'wait' : 'pointer', border: `1px solid ${T.accent}`, background: `${T.accent}1c`, color: T.accentInk, opacity: delegBusy ? 0.6 : 1 }}>
            {delegBusy ? 'Jarvis prüft dein Board …' : '✨ Delegations-Runde'}
          </button>
        </div>

        {/* Filter: Status · Besitzer · Priorität · Thema */}
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
          {segBtn('offen', 'Offen', openCount)}
          {segBtn('erledigt', 'Erledigt')}
          {segBtn('alle', 'Alle')}
          <span style={{ width: 1, height: 20, background: T.line, margin: '0 3px' }} />
          {([['alle', 'Jeder'], ['kevin', 'Kevin'], ['malin', 'Malin'], ['both', 'Beide']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setBes(k)} style={{
              fontFamily: T.mono, fontSize: 11, padding: '5px 10px', borderRadius: 8, cursor: 'pointer',
              border: `1px solid ${bes === k ? T.lineHot : T.line}`, background: 'transparent',
              color: bes === k ? T.accentInk : T.muted,
            }}>{label}</button>
          ))}
          <span style={{ width: 1, height: 20, background: T.line, margin: '0 3px' }} />
          {(['alle', 'critical', 'high', 'medium', 'low'] as const).map(k => {
            const an = prioFilter === k;
            const farbe = k === 'alle' ? T.accentInk : PRIO[k].c;
            return (
              <button key={k} onClick={() => setPrioFilter(k)} style={{
                fontFamily: T.mono, fontSize: 11, padding: '5px 10px', borderRadius: 8, cursor: 'pointer',
                border: `1px solid ${an ? farbe : T.line}`, background: an ? `${farbe}1c` : 'transparent', color: an ? farbe : T.muted,
              }}>{k === 'alle' ? 'Alle Stufen' : PRIO[k].t}</button>
            );
          })}
          <span style={{ width: 1, height: 20, background: T.line, margin: '0 3px' }} />
          {(['alle', ...ORGS.map(o => o.id)]).map(k => {
            const an = orgFilter === k;
            const farbe = k === 'alle' ? T.accentInk : ORG[k].farbe;
            return (
              <button key={k} onClick={() => setOrgFilter(k)} title={k === 'alle' ? 'Alle Orte' : ORG[k].satz}
                style={{ fontFamily: T.mono, fontSize: 11, padding: '5px 10px', borderRadius: 8, cursor: 'pointer',
                  border: `1px solid ${an ? farbe : T.line}`, background: an ? `${farbe}1c` : 'transparent', color: an ? farbe : T.muted }}>
                {k === 'alle' ? 'Alle Orte' : ORG[k].kurz}
              </button>
            );
          })}
          <span style={{ width: 1, height: 20, background: T.line, margin: '0 3px' }} />
          {(['alle', 'jarvis', 'gemeinsam', 'mensch'] as const).map(k => {
            const an = werFilter === k;
            const farbe = k === 'alle' ? T.accentInk : WER_FARBE[k];
            return (
              <button key={k} onClick={() => setWerFilter(k)}
                style={{ fontFamily: T.mono, fontSize: 11, padding: '5px 10px', borderRadius: 8, cursor: 'pointer',
                  border: `1px solid ${an ? farbe : T.line}`, background: an ? `${farbe}1c` : 'transparent', color: an ? farbe : T.muted }}>
                {k === 'alle' ? 'Alle Wege' : WER_LABEL[k]}
              </button>
            );
          })}
          <span style={{ width: 1, height: 20, background: T.line, margin: '0 3px' }} />
          {(['alle', ...themen.map(b => b.id)]).map(k => {
            const an = themaFilter === k;
            const farbe = k === 'alle' ? T.accentInk : THEMA[k].farbe;
            return (
              <button key={k} onClick={() => setThemaFilter(k)} style={{
                fontFamily: T.mono, fontSize: 11, padding: '5px 10px', borderRadius: 8, cursor: 'pointer',
                border: `1px solid ${an ? farbe : T.line}`, background: an ? `${farbe}1c` : 'transparent', color: an ? farbe : T.muted,
              }}>{k === 'alle' ? 'Alle Themen' : THEMA[k].label.split(' ')[0]}</button>
            );
          })}
        </div>

        {/* Stichworte — die feine Klassierung: anklicken und am Stück wegarbeiten */}
        <div style={{ ...panel, padding: '12px 16px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 9 }}>
            <span style={lbl}>Stichworte</span>
            <span style={{ fontSize: 11.5, color: T.muted }}>anklicken und alles dazu am Stück wegarbeiten — Dringendstes zuerst</span>
            <input value={stichSuche} onChange={e => setStichSuche(e.target.value)} placeholder="suchen …"
              aria-label="Stichwort suchen"
              style={{ marginLeft: 'auto', width: 150, background: T.void, border: `1px solid ${T.line}`, borderRadius: 8, padding: '5px 10px', color: T.ink, fontSize: 12, fontFamily: T.sans, outline: 'none' }} />
          </div>
          {(() => {
            const suche = stichSuche.trim().toLowerCase();
            const treffer = suche
              ? STICHWORTE.filter(w => w.label.toLowerCase().includes(suche))
                  .map(w => stichStand.find(s => s.id === w.id) ?? { id: w.id, offen: 0, kritisch: 0, spaet: 0, wort: w })
              : (alleStichAuf ? stichStand : stichStand.slice(0, 14));
            if (!treffer.length) return <div style={{ fontSize: 12.5, color: T.muted }}>Keine Stichworte gefunden.</div>;
            return (
              <>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {treffer.map(s => {
                    const an = stichFilter === s.id;
                    const farbe = s.kritisch ? T.crit : s.spaet ? T.amber : THEMA[s.wort.thema]?.farbe ?? T.accent;
                    return (
                      <button key={s.id} onClick={() => setStichFilter(an ? null : s.id)}
                        className={s.kritisch && !an ? 'krit-puls' : undefined}
                        title={`${s.offen} offen${s.kritisch ? ` · ${s.kritisch} kritisch` : ''}${s.spaet ? ` · ${s.spaet} überfällig` : ''}`}
                        style={{ fontFamily: T.sans, fontSize: 12, fontWeight: an ? 700 : 500, padding: '4px 10px', borderRadius: 999, cursor: 'pointer',
                          border: `1px solid ${an ? farbe : s.offen ? `${farbe}55` : T.line}`, background: an ? `${farbe}22` : 'transparent',
                          color: an ? farbe : s.offen ? T.inkDim : T.muted }}>
                        {s.wort.label}
                        {s.offen > 0 && <span style={{ fontFamily: T.mono, fontSize: 10, marginLeft: 6, color: farbe }}>{s.offen}</span>}
                        {s.wort.kpi && <span style={{ fontFamily: T.mono, fontSize: 8.5, marginLeft: 4, color: T.muted }}>KPI</span>}
                      </button>
                    );
                  })}
                  {!suche && stichStand.length > 14 && (
                    <button onClick={() => setAlleStichAuf(!alleStichAuf)}
                      style={{ fontFamily: T.mono, fontSize: 11, padding: '4px 10px', borderRadius: 999, cursor: 'pointer', border: `1px solid ${T.line}`, background: 'transparent', color: T.muted }}>
                      {alleStichAuf ? '− weniger' : `+ ${stichStand.length - 14} weitere`}
                    </button>
                  )}
                </div>
                {stichFilter && (
                  <div style={{ marginTop: 9, display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12.5, color: T.inkDim }}>
                      Gefiltert auf <b style={{ color: T.accentInk }}>{STICHWORT[stichFilter]?.label}</b> · {list.length} {list.length === 1 ? 'Aufgabe' : 'Aufgaben'}
                    </span>
                    <button onClick={() => setStichFilter(null)} style={{ fontFamily: T.sans, fontSize: 11.5, padding: '3px 10px', borderRadius: 7, cursor: 'pointer', border: `1px solid ${T.line}`, background: 'transparent', color: T.muted }}>✕ Filter lösen</button>
                  </div>
                )}
              </>
            );
          })()}
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
            {/* Sortieren — nach der Runde will man das Ergebnis ordnen können */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontFamily: T.mono, fontSize: 9.5, color: T.muted, textTransform: 'uppercase', letterSpacing: '.08em' }}>Sortiert nach</span>
              {([['person', 'Person'], ['prio', 'Priorität'], ['aufwand', 'Aufwand'], ['thema', 'Thema']] as const).map(([k, label]) => (
                <button key={k} onClick={() => setDelegSort(k)} style={{
                  fontFamily: T.sans, fontSize: 11.5, padding: '4px 10px', borderRadius: 7, cursor: 'pointer',
                  border: `1px solid ${delegSort === k ? T.accent : T.line}`, background: delegSort === k ? `${T.accent}1c` : 'transparent',
                  color: delegSort === k ? T.accentInk : T.inkDim,
                }}>{label}</button>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {delegSortiert.filter(v => v.empfehlung === 'abgeben').map(v => (
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

        {!ready && <div style={{ ...panel, padding: '34px 20px', textAlign: 'center', color: T.muted, fontSize: 13.5 }}>Lade Aufgaben …</div>}

        {ready && !list.length && (
          <div style={{ ...panel, padding: '40px 20px', textAlign: 'center', color: T.muted, fontSize: 13.5 }}>
            {seg === 'offen' ? 'Nichts in dieser Auswahl. 🎯' : 'Keine Aufgaben in dieser Ansicht.'}
          </div>
        )}

        {/* ── JETZT: die ersten fünf, dann der Rest ── */}
        {ready && !!list.length && ansicht === 'jetzt' && (() => {
          const top = list.slice(0, 5);
          const rest = list.slice(5);
          return (
            <>
              <div style={{ ...panel, overflow: 'hidden', marginBottom: 14 }}>
                <div style={{ padding: '11px 16px 8px', display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                  <span style={lbl}>Die nächsten fünf</span>
                  <span style={{ fontSize: 11.5, color: T.muted }}>in der Reihenfolge unserer Ordnung — mehr als fünf gleichzeitig ist keine Priorität mehr</span>
                </div>
                {top.map((t, i) => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'stretch', borderTop: `1px solid ${T.lineSoft}` }}>
                    <div style={{ width: 34, flex: '0 0 auto', display: 'grid', placeItems: 'center', fontFamily: T.mono, fontSize: 15, fontWeight: 700, color: THEMA[meinThema(t)]?.farbe ?? T.muted, background: `${THEMA[meinThema(t)]?.farbe ?? T.muted}0f` }}>{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}><Zeile t={t} i={0} zeigeThema /></div>
                  </div>
                ))}
              </div>
              {!!rest.length && (
                <div style={{ ...panel, overflow: 'hidden' }}>
                  <div style={{ padding: '11px 16px 8px', ...lbl }}>Danach · {rest.length}</div>
                  {rest.map((t, i) => <Zeile key={t.id} t={t} i={i + 1} zeigeThema />)}
                </div>
              )}
            </>
          );
        })()}

        {/* ── BAHNEN: das Board — je Thema eine Spalte, in unserer Reihenfolge ── */}
        {ready && !!list.length && ansicht === 'themen' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 12, alignItems: 'start' }}>
            {themen.map((b, bi) => {
              const drin = list.filter(t => meinThema(t) === b.id);
              return (
                <div key={b.id} style={{ ...panel, borderTop: `3px solid ${b.farbe}`, overflow: 'hidden' }}>
                  <div style={{ padding: '11px 14px 9px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                      <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>{bi + 1}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: b.farbe }}>{b.label}</span>
                      <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, marginLeft: 'auto' }}>{drin.length}</span>
                    </div>
                    <div style={{ fontSize: 11, color: T.muted, marginTop: 3, lineHeight: 1.45 }}>{b.satz}</div>
                  </div>
                  {drin.length
                    ? drin.map((t, i) => <Zeile key={t.id} t={t} i={i + 1} />)
                    : <div style={{ padding: '14px', fontSize: 12, color: T.muted, borderTop: `1px solid ${T.lineSoft}` }}>Nichts offen hier.</div>}
                </div>
              );
            })}
          </div>
        )}

        {/* ── ZEITSTRAHL: alle Themen parallel, 60 Tage voraus ── */}
        {ready && !!list.length && ansicht === 'zeit' && (() => {
          const von = heute;
          const bis = tagInT(60);
          const p2 = (n: number) => String(n).padStart(2, '0');
          const ticks = [14, 28, 42, 56].map(o => {
            const d = new Date(); d.setDate(d.getDate() + o);
            return { date: `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`, label: `${d.getDate()}.${d.getMonth() + 1}.` };
          });
          const ohneDatum = list.filter(t => !t.dueDate).length;
          return (
            <>
              {themen.map(b => {
                const drin = list.filter(t => meinThema(t) === b.id && t.dueDate);
                const marker: StrahlMarker[] = drin.map(t => ({
                  date: t.dueDate!,
                  label: t.title,
                  farbe: t.priority === 'critical' ? T.crit : b.farbe,
                  symbol: t.priority === 'critical' ? '◆' : '●',
                  titel: `${t.title} · ${PRIO[t.priority].t} · ${OWNER[t.assignee] ?? t.assignee}`,
                }));
                const spaet = drin.filter(t => t.dueDate! < heute).length;
                return (
                  <div key={b.id} style={{ marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, margin: '0 2px 5px' }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: b.farbe }}>{b.label}</span>
                      <span style={{ fontFamily: T.mono, fontSize: 10.5, color: T.muted }}>{drin.length} terminiert</span>
                      {spaet > 0 && <span className="krit-puls" style={{ fontFamily: T.mono, fontSize: 10.5, color: T.crit }}>{spaet} überfällig</span>}
                    </div>
                    <Zeitstrahl von={von} bis={bis} ticks={ticks} marker={marker} />
                  </div>
                );
              })}
              {ohneDatum > 0 && (
                <div style={{ ...panel, padding: '12px 16px', fontSize: 12.5, color: T.inkDim }}>
                  <b style={{ color: T.amber }}>{ohneDatum} Aufgaben ohne Datum</b> — sie erscheinen erst auf dem Zeitstrahl, wenn ihr ihnen einen Tag gebt. Aufgabe aufklappen → „Fällig".
                </div>
              )}
            </>
          );
        })()}

        {/* ── LISTE: nach Fälligkeit gruppiert ── */}
        {ready && !!list.length && ansicht === 'liste' && (
          <div style={{ ...panel, overflow: 'hidden' }}>
            {(gruppen ?? [{ key: 'flach', label: '', tasks: list }]).map(g => (
              <div key={g.key}>
                {g.label && (
                  <div style={{ padding: '9px 16px 4px', fontFamily: T.mono, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: g.key === 'spaet' ? T.crit : g.key === 'heute' ? T.accent : T.muted, borderTop: `1px solid ${T.lineSoft}` }}>
                    {g.label} · {g.tasks.length}
                  </div>
                )}
                {g.tasks.map((t, i) => <Zeile key={t.id} t={t} i={i || !g.label ? 1 : 0} zeigeThema />)}
              </div>
            ))}
          </div>
        )}

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
