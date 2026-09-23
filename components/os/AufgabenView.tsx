'use client';

import Link from 'next/link';
import type { Owner } from '@/types/common';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AufgabenBoard } from './AufgabenBoard';
import { Abhaengigkeit, BlockiertChip } from './Abhaengigkeit';
import { Faelligkeit } from './Faelligkeit';
import { THEME as T } from '@/lib/make-one/os-data';
import { FARBE as C, TYP, SCHRIFT, ABSTAND as A, RADIUS, MIKRO } from '@/lib/make-one/design';
import { useTasks } from '@/context/TasksContext';
import type { Priority } from '@/types';
import { localDay } from '@/lib/zeit';
import { SAEULE_VON_PROJEKT, FOKUS_SCHWELLE } from '@/lib/make-one/fokus-data';
import { STANDARD_ORDNUNG, themaVon, sortierteThemen, themenMit } from '@/lib/make-one/ordnung-data';
import { STICHWORTE, STICHWORT, stichworteVon, mitEigenen } from '@/lib/make-one/stichworte-data';
import { ORGS, ORG, orgVon } from '@/lib/make-one/organisation-data';
import { einschaetzen, dauerText, WER_LABEL, WER_FARBE, type Wer } from '@/lib/make-one/umsetzung-data';
import { DELEGIERBAR } from '@/lib/make-one/team-data';
import { wertVon, STANDARD_MODUS, type ReglerId } from '@/lib/make-one/kompass-data';
import { Zeitstrahl, type StrahlMarker } from './Zeitstrahl';
import { parseSchnell, tagInT, naechsterWochentag } from '@/lib/make-one/schnell-anlegen';

const PRIO_ZYKLUS: Priority[] = ['low', 'medium', 'high', 'critical'];
const PRIO_RANG: Record<Priority, number> = { critical: 0, high: 1, medium: 2, low: 3 };

interface Reminder { id: string; list: string; title: string; due?: string; priority: number; }

const panel = { background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14 };
const lbl = { fontFamily: T.mono, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: T.muted };

const PRIO: Record<Priority, { c: string; t: string }> = {
  critical: { c: T.crit, t: 'kritisch' },
  high: { c: T.amber, t: 'hoch' },
  medium: { c: T.accent, t: 'mittel' },
  low: { c: T.muted, t: 'niedrig' },
};
const OWNER: Record<string, string> = { kevin: 'Kevin', malin: 'Malin', both: 'Beide' };

type Ansicht = 'jetzt' | 'board' | 'personen' | 'themen' | 'zeit' | 'liste';
const ANSICHTEN: { key: Ansicht; label: string }[] = [
  { key: 'jetzt', label: 'Jetzt' },
  // Die Verteil-Runde: Spalten von links nach rechts, Bahnen nach Person oder Firma.
  { key: 'board', label: 'Board' },
  { key: 'personen', label: 'Kevin & Malin' },
  { key: 'themen', label: 'Themen' },
  { key: 'zeit', label: 'Zeitstrahl' },
  { key: 'liste', label: 'Liste' },
];

/** Die drei Bahnen der Ansicht „Kevin & Malin". */
const BAHNEN = [
  { id: 'kevin' as const, titel: 'Kevin', satz: 'Was nur er machen kann.' },
  { id: 'both' as const, titel: 'Beide', satz: 'Braucht euch zusammen.' },
  { id: 'malin' as const, titel: 'Malin', satz: 'Bei ihr besser aufgehoben.' },
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
  // Eure eigenen Bezeichnungen aus dem Kompass — leer heißt Standard.
  const [eigeneNamen, setEigeneNamen] = useState<Record<string, string>>({});
  useEffect(() => {
    fetch('/api/state/labels').then(r => r.json()).then(d => setEigeneNamen(d.themen ?? {})).catch(() => {});
  }, []);
  const themen = useMemo(() => sortierteThemen(reihenfolge, eigeneNamen), [reihenfolge, eigeneNamen]);
  const THEMA_EIGEN = useMemo(() => themenMit(eigeneNamen), [eigeneNamen]);
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
  const [bes, setBes] = useState<'alle' | string | 'both'>('alle');
  const [prioFilter, setPrioFilter] = useState<Priority | 'alle'>('alle');
  const [themaFilter, setThemaFilter] = useState<string | 'alle'>('alle');
  const [orgFilter, setOrgFilter] = useState<string | 'alle'>('alle');
  /** Termin-Lage: alles · nur ohne Datum · nur überfällig. */
  const [datumFilter, setDatumFilter] = useState<'alle' | 'ohne' | 'spaet'>('alle');
  const [werFilter, setWerFilter] = useState<Wer | 'alle'>('alle');
  const [stichFilter, setStichFilter] = useState<string | null>(null);
  const [stichSuche, setStichSuche] = useState('');
  const [alleStichAuf, setAlleStichAuf] = useState(false);

  // ── Schnell-Anlegen + Zeilen-Editor + Fokus-Regler-Lenkung ──
  const [neuTitel, setNeuTitel] = useState('');
  // Anlegen mit Feldern statt nur Kürzeln — und die beiden Klappen, damit oben
  // nicht dauerhaft vier Reihen Filter stehen.
  const [neuAuf, setNeuAuf] = useState(false);
  const [neuPrio, setNeuPrio] = useState<Priority>('medium');
  const [neuWer, setNeuWer] = useState<Owner>('kevin');
  const [neuDatum, setNeuDatum] = useState<string | undefined>(undefined);
  const [neuOrg, setNeuOrg] = useState<string>('kdv');
  const [filterAuf, setFilterAuf] = useState(false);
  const [stichAuf, setStichAuf] = useState(false);
  /** Ort, der der zuletzt angelegten Aufgabe noch zugeordnet werden muss. */
  const [orgFuerNeu, setOrgFuerNeu] = useState<string | null>(null);
  /** Entprellt die Notizen — es ist immer nur ein Feld zugleich im Fokus. */
  const notizTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [offenId, setOffenId] = useState<string | null>(null);
  // Welches Feld gerade zur Auswahl offensteht — ein Klick auf „kritisch",
  // ein Stichwort oder die Zuweisung öffnet den Streifen unter der Zeile.
  const [menue, setMenue] = useState<{ id: string; feld: 'prio' | 'wer' | 'stich' } | null>(null);
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

  /**
   * Anlegen mit den Feldern aus dem ＋-Formular. Die Kürzel im Titel gelten
   * weiterhin — was Kevin angeklickt hat, schlägt sie aber, denn der Klick ist
   * die spätere und bewusstere Angabe.
   */
  function anlegenMitFeldern() {
    const roh = neuTitel.trim();
    if (!roh) return;
    const p = parseSchnell(roh, state.projects);
    dispatch({ type: 'ADD_TASK', payload: {
      projectId: p.projectId ?? state.projects[0]?.id ?? '',
      title: p.title || roh, description: '', status: 'todo',
      priority: neuPrio, assignee: neuWer,
      tags: [], subTasks: [], dependencies: [], sortOrder: 0,
      ...(neuDatum ?? p.dueDate ? { dueDate: neuDatum ?? p.dueDate } : {}),
    } });
    // Die Id vergibt der Reducer. Der Ort wird deshalb im Zug danach gesetzt —
    // die neue Aufgabe hängt immer hinten in der Liste.
    setOrgFuerNeu(neuOrg);
    setNeuTitel('');
    setNeuDatum(undefined);
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
      if (datumFilter === 'ohne' && t.dueDate) return false;
      if (datumFilter === 'spaet' && !(t.dueDate && t.dueDate < heute && t.status !== 'done')) return false;
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
  }, [state.tasks, seg, bes, prioFilter, themaFilter, stichFilter, orgFilter, datumFilter, werFilter, aktiverFilter, eigeneFilter, stichListe, handStich, orgZuord, regler, zuordnung, themaRang, heute]);

  // Zähler für die Termin-Chips — über ALLE offenen Aufgaben, nicht über die
  // gerade gefilterte Liste: sonst zeigt „ohne Datum 0", während 20 offen sind.
  // Ort der frisch angelegten Aufgabe nachtragen, sobald sie im Zustand steht.
  useEffect(() => {
    if (!orgFuerNeu) return;
    const letzte = state.tasks[state.tasks.length - 1];
    if (letzte) ordnungSpeichern({ orgs: { [letzte.id]: orgFuerNeu } });
    setOrgFuerNeu(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgFuerNeu, state.tasks]);

  /** Wie viele Filter gerade wirklich greifen — steht auf der zugeklappten Klappe. */
  const aktiveFilter = [
    bes !== 'alle', prioFilter !== 'alle', themaFilter !== 'alle', orgFilter !== 'alle',
    datumFilter !== 'alle', werFilter !== 'alle', !!stichFilter, !!aktiverFilter,
  ].filter(Boolean).length;

  const ohneDatumAnzahl = useMemo(() => state.tasks.filter(t => t.status !== 'done' && !t.dueDate).length, [state.tasks]);
  const ueberfaelligAnzahl = useMemo(() => state.tasks.filter(t => t.status !== 'done' && t.dueDate && t.dueDate < heute).length, [state.tasks, heute]);

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
  /**
   * Ein Auswahl-Streifen direkt unter der Zeile. Kevins Ansage: „Ich möchte
   * einmal auf kritisch draufgehen und dann die Möglichkeiten zur Auswahl da
   * drunter stehen haben." Vorher rotierte der Klick durch die Stufen — man
   * sah nie, was zur Wahl steht, und brauchte drei Klicks für einen Schritt.
   */
  function auswahl(
    titel: string,
    optionen: { id: string; label: string; farbe?: string; aktiv: boolean }[],
    waehle: (id: string) => void,
    zu: () => void,
  ) {
    return (
      <div onClick={e => e.stopPropagation()}
        style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', padding: '9px 16px 11px 48px', background: T.panel2, borderTop: `1px solid ${T.lineSoft}` }}>
        <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: '.08em', marginRight: 2 }}>{titel}</span>
        {optionen.map(o => (
          <button key={o.id} onClick={() => { waehle(o.id); zu(); }}
            style={{
              fontFamily: T.sans, fontSize: 11.5, padding: '4px 11px', borderRadius: 7, cursor: 'pointer',
              border: `1px solid ${o.aktiv ? (o.farbe ?? T.accent) : T.line}`,
              background: o.aktiv ? `${o.farbe ?? T.accent}1c` : 'transparent',
              color: o.aktiv ? (o.farbe ?? T.accentInk) : T.inkDim,
              fontWeight: o.aktiv ? 700 : 400,
            }}>{o.aktiv ? '✓ ' : ''}{o.label}</button>
        ))}
        <button onClick={zu} title="Auswahl schließen"
          style={{ marginLeft: 'auto', fontFamily: T.mono, fontSize: 11, color: T.muted, background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 6px' }}>✕</button>
      </div>
    );
  }

  function zeile(t: typeof list[number], i: number, zeigeThema?: boolean) {
    const done = t.status === 'done';
    const blockiert = t.status === 'blocked';
    const p = PRIO[t.priority];
    const auf = offenId === t.id;
    const imFokus = !done && boost(t) >= FOKUS_SCHWELLE;
    const thema = THEMA_EIGEN[meinThema(t)];
    const spaet = !!t.dueDate && t.dueDate < heute && !done;
    const kritisch = t.priority === 'critical' && !done;
    return (
      <div key={t.id} style={{ borderTop: i ? `1px solid ${T.lineSoft}` : 0, background: auf ? T.panel2 : 'transparent' }}>
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
                <button onClick={e => { e.stopPropagation(); setMenue(m => m?.id === t.id && m.feld === 'prio' ? null : { id: t.id, feld: 'prio' }); }}
                  title="Priorität ändern — Auswahl erscheint darunter"
                  className={kritisch ? 'krit-puls' : undefined}
                  style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: '.04em', textTransform: 'uppercase', color: p.c, border: `1px solid ${p.c}${kritisch ? '99' : '44'}`, borderRadius: 5, padding: '1px 6px', background: kritisch ? `${T.crit}18` : 'transparent', cursor: 'pointer' }}>{p.t}</button>
              )}
              {/* Entklobt (awork-Muster): reine Anzeigen sind farbiger Text
                  ohne Rahmen — Rahmen heißt ab jetzt „hier kann man klicken". */}
              {zeigeThema && thema && <span style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: '.04em', textTransform: 'uppercase', color: thema.farbe, opacity: 0.9 }}>{thema.label.split(' ')[0]}</span>}
              {!done && (() => {
                const e = einschaetzen(t);
                return (
                  <span title={`${WER_LABEL[e.wer]} — ${e.warum}${e.beitrag ? ` · Jarvis: ${e.beitrag}` : ''}`}
                    style={{ fontFamily: T.mono, fontSize: 11, color: WER_FARBE[e.wer], opacity: 0.9 }}>
                    {e.wer === 'jarvis' ? '⚡' : e.wer === 'gemeinsam' ? '◐' : '☺'} {dauerText(e.dauer)}
                  </span>
                );
              })()}
              {zeigeThema && <span style={{ fontFamily: T.mono, fontSize: 11, color: ORG[meineOrg(t)]?.farbe, opacity: 0.85 }}>{ORG[meineOrg(t)]?.kurz}</span>}
              {meineStich(t).slice(0, 3).map(sid => (
                <button key={sid} onClick={e => { e.stopPropagation(); setMenue(m => m?.id === t.id && m.feld === 'stich' ? null : { id: t.id, feld: 'stich' }); }}
                  title={`„${STICHWORT[sid]?.label}" — klicken, um die Stichworte zu ändern`}
                  style={{ fontFamily: T.sans, fontSize: 11, color: stichFilter === sid ? T.accentInk : T.muted, border: `1px solid ${stichFilter === sid ? T.accent : T.line}`, borderRadius: 999, padding: '1px 8px', background: 'transparent', cursor: 'pointer' }}>{STICHWORT[sid]?.label}</button>
              ))}
              {!done && !meineStich(t).length && (
                <button onClick={e => { e.stopPropagation(); setMenue({ id: t.id, feld: 'stich' }); }} title="Stichwort setzen"
                  style={{ fontFamily: T.sans, fontSize: 11, color: T.muted, border: `1px dashed ${T.line}`, borderRadius: 999, padding: '1px 8px', background: 'transparent', cursor: 'pointer' }}>+ Stichwort</button>
              )}
              {blockiert && <span style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: '.04em', textTransform: 'uppercase', color: T.amber, border: `1px solid ${T.amber}55`, borderRadius: 5, padding: '1px 6px' }}>blockiert</span>}
              {!done && <BlockiertChip t={t} alle={state.tasks} />}
              {/* Das Datum ist der Knopf — auch wenn noch keins gesetzt ist.
                  Sonst muss man für jede Deadline erst die Zeile aufklappen. */}
              {!done && <Faelligkeit klein spaetPuls wert={t.dueDate} setzen={d => patchTask(t.id, { dueDate: d })} />}
              {done && t.dueDate && <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>{t.dueDate.slice(8)}.{t.dueDate.slice(5, 7)}.</span>}
              <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>{projName(t.projectId)}</span>
              <button onClick={e => { e.stopPropagation(); setMenue(m => m?.id === t.id && m.feld === 'wer' ? null : { id: t.id, feld: 'wer' }); }}
                title="Zuweisung ändern — Kevin, Malin oder beide"
                style={{ fontFamily: T.mono, fontSize: 11, color: t.assignee === 'malin' ? T.accentInk : T.muted, background: 'transparent', border: `1px solid ${t.assignee === 'malin' ? T.lineHot : 'transparent'}`, borderRadius: 5, padding: '1px 5px', cursor: 'pointer' }}>
                · {OWNER[t.assignee] ?? t.assignee}
              </button>
              {delegiertAn(t.description) && <span style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: '.04em', textTransform: 'uppercase', color: T.amber, border: `1px solid ${T.amber}55`, borderRadius: 5, padding: '1px 6px' }}>→ delegiert an {delegiertAn(t.description)}</span>}
              {fromInbox(t.description) && <span style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: '.04em', textTransform: 'uppercase', color: T.accent, border: `1px solid ${T.lineHot}`, borderRadius: 5, padding: '1px 6px' }}>aus Inbox</span>}
            </div>
          </div>
          <span style={{ fontFamily: T.mono, fontSize: 12, color: T.muted, flex: '0 0 auto' }}>{auf ? '▾' : '▸'}</span>
        </div>

        {/* Auswahl direkt unter der Zeile — ohne die Aufgabe aufklappen zu müssen */}
        {menue?.id === t.id && menue.feld === 'prio' && auswahl(
          'Priorität',
          PRIO_ZYKLUS.slice().reverse().map(p2 => ({ id: p2, label: PRIO[p2].t, farbe: PRIO[p2].c, aktiv: t.priority === p2 })),
          id => patchTask(t.id, { priority: id as Priority }),
          () => setMenue(null),
        )}
        {menue?.id === t.id && menue.feld === 'wer' && auswahl(
          'Wer macht das',
          [
            { id: 'kevin', label: 'Kevin', aktiv: t.assignee === 'kevin' },
            { id: 'malin', label: 'Malin', aktiv: t.assignee === 'malin' },
            { id: 'both', label: 'Beide', aktiv: t.assignee === 'both' },
          ],
          id => patchTask(t.id, { assignee: id }),
          () => setMenue(null),
        )}
        {menue?.id === t.id && menue.feld === 'stich' && (() => {
          const meine = meineStich(t);
          // Zur Wahl: was schon dranhängt, plus die Stichworte des Themas —
          // sonst stehen hier 139 Knöpfe und man findet nichts.
          const thema2 = meinThema(t);
          const passend = stichListe.filter(s => s.thema === thema2).map(s => s.id);
          const zurWahl = Array.from(new Set([...meine, ...passend])).slice(0, 24);
          return auswahl(
            'Stichworte',
            zurWahl.map(sid => ({ id: sid, label: STICHWORT[sid]?.label ?? sid, aktiv: meine.includes(sid) })),
            sid => {
              const next = meine.includes(sid) ? meine.filter(x => x !== sid) : [...meine, sid];
              ordnungSpeichern({ stichworte: { [t.id]: next } });
            },
            () => setMenue(null),
          );
        })()}
        {auf && (
          // ─── Aufgaben-Detail — Kevins Ansage: „Da muss ein Textfeld sein
          // für Infos und all solche grundlegenden Sachen. Sauberer Stand,
          // damit Malin und ich darin richtig arbeiten können." ───
          // Aufbau: Notizen zuerst (die Information), darunter ein Raster mit
          // fester Label-Spalte — alles fluchtet, nichts stapelt sich mehr.
          <div style={{ margin: '0 16px 13px 48px', background: T.panel2, border: `1px solid ${T.line}`, borderRadius: 12, padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: 11 }}>

            {/* 1 · Notizen — das Feld, das gefehlt hat. Speichert beim Verlassen. */}
            <textarea
              key={t.id}
              defaultValue={t.description ?? ''}
              // Beim Tippen entprellt speichern UND beim Verlassen sofort —
              // so geht nie eine Notiz verloren, egal wie man das Feld verlässt.
              onChange={e => {
                const v = e.target.value;
                clearTimeout(notizTimer.current);
                notizTimer.current = setTimeout(() => { if (v !== (t.description ?? '')) patchTask(t.id, { description: v }); }, 700);
              }}
              onBlur={e => { clearTimeout(notizTimer.current); const v = e.target.value; if (v !== (t.description ?? '')) patchTask(t.id, { description: v }); }}
              placeholder="Notizen — Kontext, Infos, Übergabe an Malin, Zwischenstände …"
              aria-label="Notizen zur Aufgabe"
              rows={t.description && t.description.length > 160 ? 4 : 2}
              style={{ width: '100%', background: T.void, border: `1px solid ${T.line}`, borderRadius: 9, padding: '9px 11px', color: T.ink, fontSize: 12.5, fontFamily: T.sans, lineHeight: 1.55, resize: 'vertical', outline: 'none' }} />

            {/* 2 · Eigenschaften — feste Label-Spalte, alles auf einer Flucht */}
            <div style={{ display: 'grid', gridTemplateColumns: '88px 1fr', rowGap: 8, columnGap: 10, alignItems: 'center' }}>
              <DetailLabel>Fällig</DetailLabel>
              <div><Faelligkeit wert={t.dueDate} setzen={d => patchTask(t.id, { dueDate: d })} /></div>

              <DetailLabel>Person</DetailLabel>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {([['kevin', 'Kevin'], ['both', 'Beide'], ['malin', 'Malin']] as const).map(([k, label]) => (
                  <DetailWahl key={k} an={t.assignee === k} farbe={k === 'malin' ? T.amber : k === 'both' ? T.accent : T.accentInk} onClick={() => patchTask(t.id, { assignee: k })}>{label}</DetailWahl>
                ))}
              </div>

              <DetailLabel>Ort</DetailLabel>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {ORGS.map(o => (
                  <DetailWahl key={o.id} an={meineOrg(t) === o.id} farbe={o.farbe} titel={o.satz} onClick={() => ordnungSpeichern({ orgs: { [t.id]: o.id } })}>{o.kurz}</DetailWahl>
                ))}
              </div>

              <DetailLabel>Thema</DetailLabel>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {themen.map(b => (
                  <DetailWahl key={b.id} an={meinThema(t) === b.id} farbe={b.farbe} onClick={() => ordnungSpeichern({ zuordnung: { [t.id]: b.id } })}>{b.label}</DetailWahl>
                ))}
              </div>

              <DetailLabel>Projekt</DetailLabel>
              <div>
                <select value={t.projectId} onChange={e => patchTask(t.id, { projectId: e.target.value })}
                  style={{ background: T.void, border: `1px solid ${T.line}`, borderRadius: 7, color: T.inkDim, fontFamily: T.sans, fontSize: 11.5, padding: '5px 8px', outline: 'none', maxWidth: 280 }}>
                  {state.projects.map(pr => <option key={pr.id} value={pr.id} style={{ background: T.panel }}>{pr.title}</option>)}
                </select>
              </div>

              <DetailLabel>Abgeben</DetailLabel>
              <div>
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
                  style={{ background: T.void, border: `1px solid ${T.line}`, borderRadius: 7, color: T.muted, fontFamily: T.sans, fontSize: 11.5, padding: '5px 8px', outline: 'none', maxWidth: 280 }}>
                  <option value="">Person wählen …</option>
                  {DELEGIERBAR.map(p => (
                    <option key={p.kurz} value={p.kurz} style={{ background: T.panel }}>{p.name} — {p.bereiche[0]}</option>
                  ))}
                </select>
              </div>

              <DetailLabel>Stichworte</DetailLabel>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                {meineStich(t).map(sid => {
                  const gesetzt = (handStich[t.id] ?? []).includes(sid);
                  return (
                    <span key={sid} style={{ fontFamily: T.sans, fontSize: 11.5, color: T.inkDim, border: `1px solid ${T.line}`, borderRadius: 999, padding: '2px 9px', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      {STICHWORT[sid]?.label}
                      {gesetzt
                        ? <button onClick={() => ordnungSpeichern({ stichworte: { [t.id]: (handStich[t.id] ?? []).filter(x => x !== sid) } })} aria-label="Stichwort entfernen" style={{ background: 'none', border: 'none', color: T.muted, cursor: 'pointer', padding: 0, fontSize: 11 }}>✕</button>
                        : <span title="automatisch erkannt" style={{ color: T.accent, fontSize: 11 }}>●</span>}
                    </span>
                  );
                })}
                <select value="" onChange={e => { if (e.target.value) ordnungSpeichern({ stichworte: { [t.id]: [...(handStich[t.id] ?? []), e.target.value] } }); }}
                  aria-label="Stichwort hinzufügen"
                  style={{ background: 'transparent', border: `1px dashed ${T.line}`, borderRadius: 999, color: T.muted, fontFamily: T.sans, fontSize: 11.5, padding: '2px 8px', outline: 'none', maxWidth: 130 }}>
                  <option value="">+ Stichwort</option>
                  {STICHWORTE.filter(w => !meineStich(t).includes(w.id)).map(w => (
                    <option key={w.id} value={w.id} style={{ background: T.panel }}>{w.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 3 · Reihenfolge: was muss vorher fertig sein? */}
            {!done && <Abhaengigkeit t={t} alle={state.tasks} patchTask={patchTask} />}

            {/* 4 · Fuß: Jarvis-Einschätzung als eine Zeile + Aktionen */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', borderTop: `1px solid ${T.lineSoft}`, paddingTop: 10 }}>
              {!done && (() => {
                const e = einschaetzen(t);
                return (
                  <span title={`${e.warum}${e.beitrag ? ` · Erster Schritt: ${e.beitrag}` : ''}`}
                    style={{ fontSize: 11.5, color: WER_FARBE[e.wer], minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {WER_LABEL[e.wer]} · ≈ {dauerText(e.dauer)}{e.beitrag ? ` — ${e.beitrag}` : ''}
                  </span>
                );
              })()}
              <button onClick={() => patchTask(t.id, { status: blockiert ? 'todo' : 'blocked' })}
                style={{ fontFamily: T.sans, fontSize: 11.5, padding: '4px 10px', borderRadius: 7, cursor: 'pointer', border: `1px solid ${blockiert ? T.amber : T.line}`, background: blockiert ? `${T.amber}1c` : 'transparent', color: blockiert ? T.amber : T.inkDim, flex: '0 0 auto', marginLeft: done ? 'auto' : 0 }}>{blockiert ? 'blockiert ✓' : 'blockiert?'}</button>
              <button onClick={() => { if (confirm(`„${t.title.slice(0, 60)}" wirklich löschen?`)) { dispatch({ type: 'DELETE_TASK', payload: { id: t.id } }); setOffenId(null); } }}
                style={{ fontFamily: T.sans, fontSize: 11.5, padding: '4px 10px', borderRadius: 7, cursor: 'pointer', border: `1px solid ${T.line}`, background: 'transparent', color: T.muted, flex: '0 0 auto' }}>Löschen</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ minHeight: '100vh', background: T.void, color: T.ink, fontFamily: T.sans }}>
      <div style={{ maxWidth: 980, margin: '0 auto', padding: '26px clamp(16px,3vw,36px) 48px' }}>
        {/* ─── Kopf (UX 2, 06.09.) ──────────────────────────────────────────
            Vorher standen hier acht gestapelte Zeilen — 218 px, bevor die
            erste Aufgabe kam. Jetzt: EINE Zeile mit der Lage, eine mit dem
            Anlegen, eine mit Ansicht + Filter. Die Prioritäten-Reihenfolge
            ist in die Klappe gewandert; sie gehört zur Steuerung, nicht auf
            jede Aufgabenseite. */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: A.m, flexWrap: 'wrap', marginBottom: A.m }}>
          <h1 style={{ fontFamily: SCHRIFT.display, fontSize: TYP.titel, fontWeight: 600, letterSpacing: '-.01em', margin: 0 }}>
            {openCount} {openCount === 1 ? 'Aufgabe' : 'Aufgaben'} offen
          </h1>
          {kritischOffen > 0 && (
            <span className="krit-puls" style={{ fontSize: TYP.bedien, fontWeight: 600, color: C.kritisch }}>
              ● {kritischOffen} kritisch{kritischOffen > grenzeKritisch ? ` · ${kritischOffen - grenzeKritisch} über deiner Grenze` : ''}
            </span>
          )}
          <span style={{ fontSize: TYP.bedien, color: C.inkLeise, marginLeft: 'auto' }}>
            <b style={{ color: lastMin > grenzeLast * 60 ? C.achtung : C.inkDim, fontWeight: 600 }}>{dauerText(lastMin)}</b> Aufwand
            {lastMin > grenzeLast * 60 && <> · <b style={{ color: C.achtung }}>{dauerText(lastMin - grenzeLast * 60)} über {grenzeLast} h</b></>}
            {(() => {
              const j = list.filter(t => t.status !== 'done' && einschaetzen(t).wer === 'jarvis');
              const jMin = j.reduce((s, t) => s + einschaetzen(t).dauer, 0);
              return j.length ? <> · <b style={{ color: WER_FARBE.jarvis, fontWeight: 600 }}>{j.length} für Jarvis ({dauerText(jMin)})</b></> : null;
            })()}
          </span>
        </div>

        {/* Prioritäten-Reihenfolge: nur noch auf Wunsch sichtbar */}
        <div style={{ marginBottom: A.m }}>
          <button onClick={() => setOrdnungAuf(!ordnungAuf)}
            style={{ ...MIKRO, background: 'transparent', border: 'none', padding: `6px 0`, cursor: 'pointer', color: ordnungAuf ? C.aktiv : C.inkLeise, minHeight: 32 }}>
            {ordnungAuf ? '▾' : '▸'} Unsere Prioritäten · {themen.map(b => b.label.split(' ')[0]).join(' › ')}
          </button>
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
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{b.label} <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>{n} offen</span></div>
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

        {/* Anlegen: schnell tippen ODER mit dem ＋ alles anklicken.
            Kevins Ansage: „dass ich selber Sachen anlegen kann — mit einem
            Plus, wo ich alles schnell ausklicken kann." */}
        <div style={{ display: 'flex', gap: 8, marginBottom: neuAuf ? 0 : 12 }}>
          <input value={neuTitel} onChange={e => setNeuTitel(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { if (neuAuf) anlegenMitFeldern(); else schnellAnlegen(); } }}
            placeholder="Neue Aufgabe … (Enter)  ·  !! kritisch  ·  ! hoch  ·  heute / morgen / fr / 15.08.  ·  #capos  ·  @malin"
            aria-label="Neue Aufgabe anlegen"
            style={{ flex: 1, minWidth: 0, background: T.panel, border: `1px solid ${neuAuf ? T.lineHot : T.line}`, borderRadius: 10, padding: '11px 14px', color: T.ink, fontSize: 13.5, fontFamily: T.sans, outline: 'none' }} />
          <button onClick={() => setNeuAuf(!neuAuf)} title={neuAuf ? 'Felder zuklappen' : 'Alles selbst festlegen: Stufe, Person, Termin, Ort'}
            aria-label="Aufgabe mit Feldern anlegen"
            style={{
              flex: '0 0 auto', width: 46, borderRadius: 10, cursor: 'pointer', fontSize: 19, lineHeight: 1,
              border: `1px solid ${neuAuf ? T.accent : T.line}`, background: neuAuf ? `${T.accent}1c` : T.panel,
              color: neuAuf ? T.accentInk : T.inkDim,
            }}>{neuAuf ? '×' : '＋'}</button>
        </div>

        {neuAuf && (
          <div style={{ ...panel, borderTop: `2px solid ${T.accent}`, padding: '13px 16px', margin: '8px 0 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Feldzeile titel="Stufe">
              {(['critical', 'high', 'medium', 'low'] as const).map(k => (
                <Wahl key={k} an={neuPrio === k} farbe={PRIO[k].c} onClick={() => setNeuPrio(k)}>{PRIO[k].t}</Wahl>
              ))}
            </Feldzeile>
            <Feldzeile titel="Wer">
              {(['kevin', 'both', 'malin'] as const).map(k => (
                <Wahl key={k} an={neuWer === k} farbe={k === 'malin' ? T.amber : k === 'both' ? T.accent : T.accentInk} onClick={() => setNeuWer(k)}>{OWNER[k]}</Wahl>
              ))}
            </Feldzeile>
            <Feldzeile titel="Fällig">
              <Faelligkeit wert={neuDatum} setzen={d => setNeuDatum(d)} />
            </Feldzeile>
            <Feldzeile titel="Ort">
              {ORGS.map(o => (
                <Wahl key={o.id} an={neuOrg === o.id} farbe={o.farbe} onClick={() => setNeuOrg(o.id)}>{o.kurz}</Wahl>
              ))}
            </Feldzeile>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={anlegenMitFeldern} disabled={!neuTitel.trim()}
                style={{
                  fontFamily: T.sans, fontSize: 13, fontWeight: 700, padding: '9px 18px', borderRadius: 9,
                  cursor: neuTitel.trim() ? 'pointer' : 'default', border: 'none',
                  background: neuTitel.trim() ? T.accent : T.line, color: neuTitel.trim() ? T.void : T.muted,
                }}>Aufgabe anlegen</button>
              <span style={{ fontSize: 11.5, color: T.muted }}>
                {neuTitel.trim() ? 'Enter legt sie auch an.' : 'Titel oben eintippen.'}
              </span>
            </div>
          </div>
        )}

        {/* Ansicht wählen — ein Segment-Schalter statt sechs Einzelknöpfe.
            Gleiche Auswahl, liest sich aber als EIN Bedienelement (UX 2). */}
        <div style={{ display: 'flex', gap: A.s, flexWrap: 'wrap', alignItems: 'center', marginBottom: A.m }}>
          <div role="group" aria-label="Ansicht"
            style={{ display: 'flex', gap: 2, background: C.grund, border: `1px solid ${C.linie}`, borderRadius: RADIUS.bauteil, padding: 2 }}>
            {ANSICHTEN.map(a => (
              <button key={a.key} onClick={() => setAnsicht(a.key)} aria-pressed={ansicht === a.key} style={{
                fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 600, padding: `7px ${A.m}px`,
                minHeight: 32, borderRadius: 6, cursor: 'pointer', border: 'none',
                background: ansicht === a.key ? C.aktivSanft : 'transparent',
                color: ansicht === a.key ? C.aktiv : C.inkLeise,
              }}>{a.label}</button>
            ))}
          </div>
          {/* Die Filter-Klappe: zu, solange man nicht filtert. Steht etwas an,
              sagt der Knopf, wie viele Filter gerade greifen. */}
          <button onClick={() => setFilterAuf(!filterAuf)}
            title="Status, Person, Stufe, Termine, Ort, Weg, Thema"
            style={{
              marginLeft: 'auto', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 600,
              padding: `7px ${A.m}px`, minHeight: 32, borderRadius: RADIUS.bauteil, cursor: 'pointer',
              border: `1px solid ${filterAuf || aktiveFilter ? C.aktiv : C.linie}`,
              background: filterAuf || aktiveFilter ? C.aktivSanft : 'transparent',
              color: filterAuf || aktiveFilter ? C.aktiv : C.inkDim,
            }}>
            {filterAuf ? '▾' : '▸'} Filter{aktiveFilter ? ` · ${aktiveFilter}` : ''}
          </button>
          <button onClick={delegationsRunde} disabled={delegBusy}
            style={{
              fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 600, padding: `7px ${A.m}px`,
              minHeight: 32, borderRadius: RADIUS.bauteil, cursor: delegBusy ? 'wait' : 'pointer',
              border: `1px solid ${C.gut}`, background: C.gut, color: C.grund, opacity: delegBusy ? 0.6 : 1,
            }}>
            {delegBusy ? 'Jarvis prüft …' : '✨ Delegations-Runde'}
          </button>
        </div>

        {/* Eigene Filter aus dem Kompass — in der Klappe, wie die anderen */}
        {filterAuf && (
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
        )}

        {/* Filter: Status · Besitzer · Priorität · Termine · Ort · Weg · Thema */}
        {filterAuf && (
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
          {/* Termin-Lage: die zwei Fälle, die man beim Planen wirklich greifen
              will — was noch kein Datum hat, und was schon drüber ist. */}
          <span style={{ width: 1, height: 20, background: T.line, margin: '0 3px' }} />
          {([['alle', 'Alle Termine', T.accentInk], ['ohne', 'ohne Datum', T.amber], ['spaet', 'überfällig', T.crit]] as const).map(([k, label, farbe]) => {
            const an = datumFilter === k;
            const wieviele = k === 'ohne' ? ohneDatumAnzahl : k === 'spaet' ? ueberfaelligAnzahl : 0;
            return (
              <button key={k} onClick={() => setDatumFilter(k)}
                title={k === 'ohne' ? 'Aufgaben, die noch keinen Termin haben — die fehlen in jeder Planung' : k === 'spaet' ? 'Termin liegt in der Vergangenheit' : 'Termin egal'}
                style={{ fontFamily: T.mono, fontSize: 11, padding: '5px 10px', borderRadius: 8, cursor: 'pointer',
                  border: `1px solid ${an ? farbe : T.line}`, background: an ? `${farbe}1c` : 'transparent', color: an ? farbe : T.muted }}>
                {label}{wieviele ? ` ${wieviele}` : ''}
              </button>
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
            const farbe = k === 'alle' ? T.accentInk : THEMA_EIGEN[k].farbe;
            return (
              <button key={k} onClick={() => setThemaFilter(k)} style={{
                fontFamily: T.mono, fontSize: 11, padding: '5px 10px', borderRadius: 8, cursor: 'pointer',
                border: `1px solid ${an ? farbe : T.line}`, background: an ? `${farbe}1c` : 'transparent', color: an ? farbe : T.muted,
              }}>{k === 'alle' ? 'Alle Themen' : THEMA_EIGEN[k].label.split(' ')[0]}</button>
            );
          })}
        </div>
        )}

        {/* Stichworte — die feine Klassierung, ebenfalls zum Zuklappen:
            man braucht sie beim Wegarbeiten, nicht die ganze Zeit. */}
        <div style={{ ...panel, padding: stichAuf ? '12px 16px' : '9px 16px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: stichAuf ? 9 : 0 }}>
            <button onClick={() => setStichAuf(!stichAuf)}
              style={{ ...MIKRO, background: 'transparent', border: 'none', padding: '4px 0', minHeight: 32, cursor: 'pointer', color: stichAuf ? C.aktiv : C.inkLeise }}>
              {stichAuf ? '▾' : '▸'} Stichworte{!stichAuf && stichStand.length ? ` · ${stichStand.length}` : ''}
            </button>
            {stichAuf
              ? <span style={{ fontSize: 11.5, color: T.muted }}>anklicken und alles dazu am Stück wegarbeiten — Dringendstes zuerst</span>
              : stichFilter && <span style={{ fontSize: 11.5, color: T.accentInk }}>gefiltert: {STICHWORT[stichFilter]?.label ?? stichFilter}</span>}
            {stichAuf && (
              <input value={stichSuche} onChange={e => setStichSuche(e.target.value)} placeholder="suchen …"
                aria-label="Stichwort suchen"
                style={{ marginLeft: 'auto', width: 150, background: T.void, border: `1px solid ${T.line}`, borderRadius: 8, padding: '5px 10px', color: T.ink, fontSize: 12, fontFamily: T.sans, outline: 'none' }} />
            )}
            {!stichAuf && stichFilter && (
              <button onClick={() => setStichFilter(null)} style={{ marginLeft: 'auto', fontFamily: T.sans, fontSize: 11.5, color: T.muted, background: 'transparent', border: `1px solid ${T.line}`, borderRadius: 7, padding: '3px 9px', cursor: 'pointer' }}>✕ aufheben</button>
            )}
          </div>
          {stichAuf && (() => {
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
                    const farbe = s.kritisch ? T.crit : s.spaet ? T.amber : THEMA_EIGEN[s.wort.thema]?.farbe ?? T.accent;
                    return (
                      <button key={s.id} onClick={() => setStichFilter(an ? null : s.id)}
                        className={s.kritisch && !an ? 'krit-puls' : undefined}
                        title={`${s.offen} offen${s.kritisch ? ` · ${s.kritisch} kritisch` : ''}${s.spaet ? ` · ${s.spaet} überfällig` : ''}`}
                        style={{ fontFamily: T.sans, fontSize: 12, fontWeight: an ? 700 : 500, padding: '4px 10px', borderRadius: 999, cursor: 'pointer',
                          border: `1px solid ${an ? farbe : s.offen ? `${farbe}55` : T.line}`, background: an ? `${farbe}22` : 'transparent',
                          color: an ? farbe : s.offen ? T.inkDim : T.muted }}>
                        {s.wort.label}
                        {s.offen > 0 && <span style={{ fontFamily: T.mono, fontSize: 11, marginLeft: 6, color: farbe }}>{s.offen}</span>}
                        {s.wort.kpi && <span style={{ fontFamily: T.mono, fontSize: 11, marginLeft: 4, color: T.muted }}>KPI</span>}
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
              {delegPrivat > 0 && <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>{delegPrivat} private ausgeblendet</span>}
              <button onClick={() => setDeleg(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: T.muted, cursor: 'pointer', fontSize: 12 }}>✕</button>
            </div>
            {/* Sortieren — nach der Runde will man das Ergebnis ordnen können */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: '.08em' }}>Sortiert nach</span>
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
                    <span style={{ fontFamily: T.mono, fontSize: 11, color: T.accent, border: `1px solid ${T.accent}44`, borderRadius: 6, padding: '2px 8px' }}>→ {v.an}</span>
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

        {/* ── BOARD: verteilen, terminieren, zuordnen ── */}
        {ready && ansicht === 'board' && (
          <AufgabenBoard
            tasks={list}
            heute={heute}
            orgVon={meineOrg}
            patchTask={patchTask}
            setOrg={(id, org) => ordnungSpeichern({ orgs: { [id]: org } })}
          />
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
                    <div style={{ width: 34, flex: '0 0 auto', display: 'grid', placeItems: 'center', fontFamily: T.mono, fontSize: 15, fontWeight: 700, color: THEMA_EIGEN[meinThema(t)]?.farbe ?? T.muted, background: `${THEMA_EIGEN[meinThema(t)]?.farbe ?? T.muted}0f` }}>{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>{zeile(t, 0, true)}</div>
                  </div>
                ))}
              </div>
              {!!rest.length && (
                <div style={{ ...panel, overflow: 'hidden' }}>
                  <div style={{ padding: '11px 16px 8px', ...lbl }}>Danach · {rest.length}</div>
                  {rest.map((t, i) => zeile(t, i + 1, true))}
                </div>
              )}
            </>
          );
        })()}

        {/* ── KEVIN & MALIN: je Person eine eigene Pipeline ──────────────────
            Kevins Ansage: „aufteilen nach den Aufgaben von Kevin, von Malin
            oder welche beide machen müssen — und da auch eine eigene Pipeline,
            die jeder vernünftig mitnehmen kann." Jede Bahn zeigt ihre eigene
            Last; per Klick wandert eine Aufgabe in die andere Bahn. */}
        {ready && !!list.length && ansicht === 'personen' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 12, alignItems: 'start' }}>
            {BAHNEN.map(b => {
              const drin = list.filter(t => t.assignee === b.id);
              const offen = drin.filter(t => t.status !== 'done');
              const kritisch = offen.filter(t => t.priority === 'critical').length;
              const spaet = offen.filter(t => t.dueDate && t.dueDate < heute).length;
              const minuten = offen.reduce((s, t) => s + einschaetzen(t).dauer, 0);
              const jarvis = offen.filter(t => einschaetzen(t).wer === 'jarvis').length;
              const farbe = b.id === 'malin' ? T.accentInk : b.id === 'both' ? T.amber : T.accent;
              return (
                <div key={b.id} style={{ ...panel, borderTop: `3px solid ${farbe}`, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 14px 10px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: farbe }}>{b.titel}</span>
                      <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, marginLeft: 'auto' }}>{offen.length}</span>
                    </div>
                    <div style={{ fontSize: 11, color: T.muted, marginTop: 3, lineHeight: 1.45 }}>{b.satz}</div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 7 }}>
                      <span style={{ fontFamily: T.mono, fontSize: 11, color: kritisch ? T.crit : T.muted }}>{kritisch} kritisch</span>
                      <span style={{ fontFamily: T.mono, fontSize: 11, color: spaet ? T.crit : T.muted }}>{spaet} überfällig</span>
                      <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>{dauerText(minuten)}</span>
                      {!!jarvis && <span style={{ fontFamily: T.mono, fontSize: 11, color: T.accent }}>⚡ {jarvis}</span>}
                    </div>
                    <div style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, marginTop: 7 }}>
                      Übergeben: in der Zeile auf den Namen klicken
                    </div>
                  </div>
                  {offen.length
                    ? offen.map((t, i) => zeile(t, i + 1, true))
                    : <div style={{ padding: '14px', fontSize: 12, color: T.muted, borderTop: `1px solid ${T.lineSoft}` }}>Nichts offen hier.</div>}
                </div>
              );
            })}
          </div>
        )}

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
                    ? drin.map((t, i) => zeile(t, i + 1))
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
                      <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>{drin.length} terminiert</span>
                      {spaet > 0 && <span className="krit-puls" style={{ fontFamily: T.mono, fontSize: 11, color: T.crit }}>{spaet} überfällig</span>}
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
                  <div style={{ padding: '9px 16px 4px', fontFamily: T.mono, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: g.key === 'spaet' ? T.crit : g.key === 'heute' ? T.accent : T.muted, borderTop: `1px solid ${T.lineSoft}` }}>
                    {g.label} · {g.tasks.length}
                  </div>
                )}
                {g.tasks.map((t, i) => zeile(t, i || !g.label ? 1 : 0, true))}
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
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: T.accentInk, marginBottom: 10 }}>{lname} <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>{items.length}</span></div>
                  {items.slice(0, 10).map((r, i) => (
                    <div key={r.id} style={{ display: 'flex', gap: 9, padding: '7px 0', borderTop: i ? `1px solid ${T.lineSoft}` : 0 }}>
                      <span style={{ width: 15, height: 15, borderRadius: 5, border: `1.5px solid ${T.muted}`, flex: '0 0 auto', marginTop: 1 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: T.inkDim, lineHeight: 1.35 }}>{r.title}</div>
                        {r.due && <div style={{ fontFamily: T.mono, fontSize: 11, color: T.amber, marginTop: 2 }}>{new Date(r.due).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</div>}
                      </div>
                    </div>
                  ))}
                  {items.length > 10 && <div style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, marginTop: 6 }}>+{items.length - 10} weitere</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginTop: 20, fontFamily: T.mono, fontSize: 11, color: T.muted }}>
          Aufgaben werden lokal auf deinem Mac gespeichert · Erinnerungen live aus iCloud.
        </div>
      </div>
    </div>
  );
}

// ── Kleine Bausteine für das ＋-Formular ────────────────────────────────────
// Bewusst schlicht: eine Beschriftung links, Knöpfe rechts. Kevins Ansage war
// „schnell ausklicken" — also keine Auswahllisten, alles auf einen Blick.

function Feldzeile({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <span style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: T.muted, width: 52, flex: '0 0 auto' }}>{titel}</span>
      {children}
    </div>
  );
}

function Wahl({ an, farbe, onClick, children }: { an: boolean; farbe: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      fontFamily: T.sans, fontSize: 11.5, padding: '4px 11px', borderRadius: 7, cursor: 'pointer',
      border: `1px solid ${an ? farbe : T.line}`, background: an ? `${farbe}1c` : 'transparent', color: an ? farbe : T.inkDim,
    }}>{children}</button>
  );
}

// ── Bausteine des Aufgaben-Details ──────────────────────────────────────────
// Feste Label-Spalte + einheitliche Wahl-Knöpfe: alles fluchtet, und ein
// Rahmen heißt überall dasselbe — „hier kann man klicken".

function DetailLabel({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: '.08em', alignSelf: 'center' }}>
      {children}
    </span>
  );
}

function DetailWahl({ an, farbe, titel, onClick, children }: {
  an: boolean; farbe: string; titel?: string; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} title={titel} style={{
      fontFamily: T.sans, fontSize: 11.5, padding: '3px 10px', borderRadius: 7, cursor: 'pointer',
      border: `1px solid ${an ? farbe : T.line}`, background: an ? `${farbe}1c` : 'transparent', color: an ? farbe : T.inkDim,
    }}>{children}</button>
  );
}
