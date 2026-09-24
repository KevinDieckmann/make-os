'use client';

// ─── MAKE OS — Aufgaben · Board ─────────────────────────────────────────────
// Der volle Bau: Kanban, Kevin & Malin, Themen, Zeitstrahl, Liste — mit
// Filtern, Stichworten, Delegations-Runde und dem aufklappbaren Detail.
// Die schlanke Liste liegt unter /os/aufgaben (AufgabenSchlank.tsx).
// 24.09.: auf das lebendige Muster umgezogen — Seite/Karte/Zeile/Chip/Knopf
// aus schlank.tsx, Farben aus design.ts, keine Rahmen. Jede Funktion des
// alten Baus ist geblieben; nur die Darstellung wechselt.

import Link from 'next/link';
import type { Owner } from '@/types/common';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { AufgabenBoard } from './AufgabenBoard';
import { Abhaengigkeit, BlockiertChip } from './Abhaengigkeit';
import { Faelligkeit } from './Faelligkeit';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
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
import { parseSchnell, tagInT } from '@/lib/make-one/schnell-anlegen';
import { Seite, Karte, Ueberschrift, Liste, Zeile, Leer, Knopf, Segmente, Punkt, Chip, Haken, feld, prioFarbe, LEUCHT } from './schlank';

const PRIO_ZYKLUS: Priority[] = ['low', 'medium', 'high', 'critical'];
const PRIO_RANG: Record<Priority, number> = { critical: 0, high: 1, medium: 2, low: 3 };

interface Reminder { id: string; list: string; title: string; due?: string; priority: number; }

// ── Die Sprache der Seite: Haarlinie, Innenfläche, Beschriftung, Auswahlfeld ──
const HAAR = 'rgba(255,255,255,.06)';
const FLAECHE = 'rgba(255,255,255,.04)';
const mikro: CSSProperties = { fontFamily: SCHRIFT.text, fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkLeise };
const wahl: CSSProperties = { background: 'rgba(255,255,255,.05)', border: 'none', borderRadius: 8, color: C.inkDim, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, padding: '7px 10px', colorScheme: 'dark' };
const textKnopf: CSSProperties = { background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: 12, padding: 0 };
const zahl: CSSProperties = { fontFamily: SCHRIFT.display, fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: C.inkLeise };

const PRIO: Record<Priority, { c: string; t: string }> = {
  critical: { c: prioFarbe('critical'), t: 'kritisch' },
  high: { c: prioFarbe('high'), t: 'hoch' },
  medium: { c: prioFarbe('medium'), t: 'mittel' },
  low: { c: prioFarbe('low'), t: 'niedrig' },
};
const OWNER: Record<string, string> = { kevin: 'Kevin', malin: 'Malin', both: 'Beide' };
// Personenfarben sind keine Zustandsfarben — Kevin Türkis, Malin Rosé, Beide Violett.
// (Dieselbe Zuordnung steht in AufgabenBoard.tsx.)
const PERSON_FARBE: Record<string, string> = { kevin: C.aktiv, malin: LEUCHT.beziehung, both: LEUCHT.agenten };

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
const ANSICHT_WAHL = ANSICHTEN.map(a => ({ id: a.key, label: a.label }));

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
    <Pille key={key} an={seg === key} onClick={() => setSeg(key)}>
      {label}{typeof n === 'number' ? <span style={{ ...zahl, marginLeft: 6, color: seg === key ? C.aktiv : C.inkLeise }}>{n || '—'}</span> : null}
    </Pille>
  );

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
        style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', padding: '9px 12px 11px', margin: '0 0 8px 36px', background: FLAECHE, borderRadius: 12 }}>
        <span style={{ ...mikro, marginRight: 2 }}>{titel}</span>
        {optionen.map(o => (
          <Pille key={o.id} an={o.aktiv} farbe={o.farbe} onClick={() => { waehle(o.id); zu(); }}>{o.aktiv ? '✓ ' : ''}{o.label}</Pille>
        ))}
        <button onClick={zu} title="Auswahl schließen" style={{ ...textKnopf, marginLeft: 'auto', padding: '4px 6px' }}>✕</button>
      </div>
    );
  }

  /** Eine Aufgabenzeile — überall gleich, damit jede Ansicht dieselbe Wahrheit zeigt. */
  function zeile(t: typeof list[number], i: number, zeigeThema?: boolean, nummer?: { n: number; farbe: string }) {
    const done = t.status === 'done';
    const blockiert = t.status === 'blocked';
    const p = PRIO[t.priority];
    const auf = offenId === t.id;
    const imFokus = !done && boost(t) >= FOKUS_SCHWELLE;
    const thema = THEMA_EIGEN[meinThema(t)];
    const kritisch = t.priority === 'critical' && !done;
    void i;
    return (
      <div key={t.id} className="zeile" style={{ borderBottom: `1px solid ${HAAR}` }}>
        <div onClick={() => setOffenId(auf ? null : t.id)} className="zeile-klick"
          style={{ display: 'flex', gap: 12, padding: '11px 6px', margin: '0 -6px', alignItems: 'flex-start', cursor: 'pointer', background: auf ? 'rgba(255,255,255,.05)' : 'transparent', borderRadius: 10 }}>
          {nummer && <span style={{ fontFamily: SCHRIFT.display, fontSize: 16, fontWeight: 700, color: nummer.farbe, width: 18, flex: '0 0 auto', textAlign: 'center', marginTop: 2, textShadow: `0 0 14px ${nummer.farbe}88`, fontVariantNumeric: 'tabular-nums' }}>{nummer.n}</span>}
          <Haken an={done} onChange={() => dispatch({ type: 'TOGGLE_TASK', payload: { id: t.id } })} farbe={kritisch ? LEUCHT.kritisch : prioFarbe(t.priority)} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: TYP.body, fontWeight: 500, color: done ? C.inkLeise : blockiert ? LEUCHT.achtung : C.ink, textDecoration: done ? 'line-through' : 'none', lineHeight: 1.35, display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
              {kritisch && <span className="krit-puls" style={{ display: 'inline-flex' }}><Punkt farbe={LEUCHT.kritisch} groesse={8} /></span>}
              {imFokus && <span style={{ color: LEUCHT.schlaf, textShadow: `0 0 10px ${LEUCHT.schlaf}99` }} title="Im Fokus — der Regler dieser Säule steht hoch">◎</span>}
              <span>{t.title}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
              {!done && (
                <button onClick={e => { e.stopPropagation(); setMenue(m => m?.id === t.id && m.feld === 'prio' ? null : { id: t.id, feld: 'prio' }); }}
                  title="Priorität ändern — Auswahl erscheint darunter"
                  className={kritisch ? 'krit-puls fassbar' : 'fassbar'}
                  style={{ fontFamily: SCHRIFT.text, fontSize: 11, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: p.c, border: 'none', borderRadius: 999, padding: '3px 9px', background: `${p.c}22`, cursor: 'pointer' }}>{p.t}</button>
              )}
              {/* Reine Anzeigen sind farbiger Text ohne Fläche — Fläche heißt „hier kann man klicken". */}
              {zeigeThema && thema && <span style={{ fontFamily: SCHRIFT.text, fontSize: 11, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', color: thema.farbe, opacity: 0.9 }}>{thema.label.split(' ')[0]}</span>}
              {!done && (() => {
                const e = einschaetzen(t);
                return (
                  <span title={`${WER_LABEL[e.wer]} — ${e.warum}${e.beitrag ? ` · Jarvis: ${e.beitrag}` : ''}`}
                    style={{ fontFamily: SCHRIFT.text, fontSize: 11, fontWeight: 600, color: WER_FARBE[e.wer], opacity: 0.9 }}>
                    {e.wer === 'jarvis' ? '⚡' : e.wer === 'gemeinsam' ? '◐' : '☺'} {dauerText(e.dauer)}
                  </span>
                );
              })()}
              {zeigeThema && <span style={{ fontFamily: SCHRIFT.text, fontSize: 11, fontWeight: 600, color: ORG[meineOrg(t)]?.farbe, opacity: 0.85 }}>{ORG[meineOrg(t)]?.kurz}</span>}
              {meineStich(t).slice(0, 3).map(sid => (
                <Pille key={sid} klein an={stichFilter === sid} title={`„${STICHWORT[sid]?.label}" — klicken, um die Stichworte zu ändern`}
                  onClick={e => { e.stopPropagation(); setMenue(m => m?.id === t.id && m.feld === 'stich' ? null : { id: t.id, feld: 'stich' }); }}>{STICHWORT[sid]?.label}</Pille>
              ))}
              {!done && !meineStich(t).length && (
                <Pille klein leise title="Stichwort setzen" onClick={e => { e.stopPropagation(); setMenue({ id: t.id, feld: 'stich' }); }}>+ Stichwort</Pille>
              )}
              {blockiert && <Chip farbe={LEUCHT.achtung}>blockiert</Chip>}
              {!done && <BlockiertChip t={t} alle={state.tasks} />}
              {/* Das Datum ist der Knopf — auch wenn noch keins gesetzt ist.
                  Sonst muss man für jede Deadline erst die Zeile aufklappen. */}
              {!done && <Faelligkeit klein spaetPuls wert={t.dueDate} setzen={d => patchTask(t.id, { dueDate: d })} />}
              {done && t.dueDate && <span style={zahl}>{t.dueDate.slice(8)}.{t.dueDate.slice(5, 7)}.</span>}
              <span style={{ fontSize: 11, color: C.inkLeise }}>{projName(t.projectId)}</span>
              <button onClick={e => { e.stopPropagation(); setMenue(m => m?.id === t.id && m.feld === 'wer' ? null : { id: t.id, feld: 'wer' }); }}
                title="Zuweisung ändern — Kevin, Malin oder beide"
                style={{ fontFamily: SCHRIFT.text, fontSize: 11, fontWeight: 600, color: t.assignee === 'kevin' ? C.inkLeise : PERSON_FARBE[t.assignee], background: 'transparent', border: 'none', padding: '1px 4px', cursor: 'pointer' }}>
                · {OWNER[t.assignee] ?? t.assignee}
              </button>
              {delegiertAn(t.description) && <Chip farbe={LEUCHT.achtung}>→ delegiert an {delegiertAn(t.description)}</Chip>}
              {fromInbox(t.description) && <Chip farbe={LEUCHT.puls}>aus Inbox</Chip>}
            </div>
          </div>
          <span style={{ fontSize: 12, color: C.inkLeise, flex: '0 0 auto', marginTop: 4 }}>{auf ? '▾' : '▸'}</span>
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
            { id: 'kevin', label: 'Kevin', farbe: PERSON_FARBE.kevin, aktiv: t.assignee === 'kevin' },
            { id: 'malin', label: 'Malin', farbe: PERSON_FARBE.malin, aktiv: t.assignee === 'malin' },
            { id: 'both', label: 'Beide', farbe: PERSON_FARBE.both, aktiv: t.assignee === 'both' },
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
          <div style={{ margin: '4px 0 12px 36px', background: FLAECHE, borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

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
              style={{ ...feld, fontSize: TYP.bedien, lineHeight: 1.55, resize: 'vertical' }} />

            {/* 2 · Eigenschaften — feste Label-Spalte, alles auf einer Flucht */}
            <div style={{ display: 'grid', gridTemplateColumns: '88px 1fr', rowGap: 9, columnGap: 10, alignItems: 'center' }}>
              <DetailLabel>Fällig</DetailLabel>
              <div><Faelligkeit wert={t.dueDate} setzen={d => patchTask(t.id, { dueDate: d })} /></div>

              <DetailLabel>Person</DetailLabel>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {([['kevin', 'Kevin'], ['both', 'Beide'], ['malin', 'Malin']] as const).map(([k, label]) => (
                  <Pille key={k} an={t.assignee === k} farbe={PERSON_FARBE[k]} onClick={() => patchTask(t.id, { assignee: k })}>{label}</Pille>
                ))}
              </div>

              <DetailLabel>Ort</DetailLabel>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {ORGS.map(o => (
                  <Pille key={o.id} an={meineOrg(t) === o.id} farbe={o.farbe} title={o.satz} onClick={() => ordnungSpeichern({ orgs: { [t.id]: o.id } })}>{o.kurz}</Pille>
                ))}
              </div>

              <DetailLabel>Thema</DetailLabel>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {themen.map(b => (
                  <Pille key={b.id} an={meinThema(t) === b.id} farbe={b.farbe} onClick={() => ordnungSpeichern({ zuordnung: { [t.id]: b.id } })}>{b.label}</Pille>
                ))}
              </div>

              <DetailLabel>Projekt</DetailLabel>
              <div>
                <select value={t.projectId} onChange={e => patchTask(t.id, { projectId: e.target.value })} style={{ ...wahl, maxWidth: 280 }}>
                  {state.projects.map(pr => <option key={pr.id} value={pr.id}>{pr.title}</option>)}
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
                  style={{ ...wahl, color: C.inkLeise, maxWidth: 280 }}>
                  <option value="">Person wählen …</option>
                  {DELEGIERBAR.map(p => (
                    <option key={p.kurz} value={p.kurz}>{p.name} — {p.bereiche[0]}</option>
                  ))}
                </select>
              </div>

              <DetailLabel>Stichworte</DetailLabel>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                {meineStich(t).map(sid => {
                  const gesetzt = (handStich[t.id] ?? []).includes(sid);
                  return (
                    <span key={sid} style={{ fontFamily: SCHRIFT.text, fontSize: 12, fontWeight: 600, color: C.inkDim, background: 'rgba(255,255,255,.06)', borderRadius: 999, padding: '3px 10px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {STICHWORT[sid]?.label}
                      {gesetzt
                        ? <button onClick={() => ordnungSpeichern({ stichworte: { [t.id]: (handStich[t.id] ?? []).filter(x => x !== sid) } })} aria-label="Stichwort entfernen" style={{ ...textKnopf, fontSize: 11, lineHeight: 1 }}>✕</button>
                        : <span title="automatisch erkannt" style={{ display: 'inline-flex' }}><Punkt farbe={C.aktiv} groesse={6} /></span>}
                    </span>
                  );
                })}
                <select value="" onChange={e => { if (e.target.value) ordnungSpeichern({ stichworte: { [t.id]: [...(handStich[t.id] ?? []), e.target.value] } }); }}
                  aria-label="Stichwort hinzufügen"
                  style={{ ...wahl, borderRadius: 999, color: C.inkLeise, padding: '3px 10px', fontSize: 12, maxWidth: 140 }}>
                  <option value="">+ Stichwort</option>
                  {STICHWORTE.filter(w => !meineStich(t).includes(w.id)).map(w => (
                    <option key={w.id} value={w.id}>{w.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 3 · Reihenfolge: was muss vorher fertig sein? */}
            {!done && <Abhaengigkeit t={t} alle={state.tasks} patchTask={patchTask} />}

            {/* 4 · Fuß: Jarvis-Einschätzung als eine Zeile + Aktionen */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', borderTop: `1px solid ${HAAR}`, paddingTop: 12 }}>
              {!done && (() => {
                const e = einschaetzen(t);
                return (
                  <span title={`${e.warum}${e.beitrag ? ` · Erster Schritt: ${e.beitrag}` : ''}`}
                    style={{ fontSize: 12, color: WER_FARBE[e.wer], minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {WER_LABEL[e.wer]} · ≈ {dauerText(e.dauer)}{e.beitrag ? ` — ${e.beitrag}` : ''}
                  </span>
                );
              })()}
              {done && <span style={{ flex: 1 }} />}
              <Pille an={blockiert} farbe={LEUCHT.achtung} onClick={() => patchTask(t.id, { status: blockiert ? 'todo' : 'blocked' })}>{blockiert ? 'blockiert ✓' : 'blockiert?'}</Pille>
              <Pille leise onClick={() => { if (confirm(`„${t.title.slice(0, 60)}" wirklich löschen?`)) { dispatch({ type: 'DELETE_TASK', payload: { id: t.id } }); setOffenId(null); } }}>Löschen</Pille>
            </div>
          </div>
        )}
      </div>
    );
  }

  /** Farben der Fällig-Gruppen in der Listen-Ansicht. */
  const gruppeFarbe = (key: string) => (key === 'spaet' ? LEUCHT.kritisch : key === 'heute' ? LEUCHT.gut : key === 'morgen' || key === 'woche' ? LEUCHT.achtung : key === 'spaeter' ? LEUCHT.puls : C.inkLeise);

  const jarvisListe = list.filter(t => t.status !== 'done' && einschaetzen(t).wer === 'jarvis');
  const jarvisMin = jarvisListe.reduce((s, t) => s + einschaetzen(t).dauer, 0);
  const ueberLast = lastMin > grenzeLast * 60;

  // Karten zählen hoch, damit sie gestaffelt erscheinen.
  let ki = 0;

  return (
    <Seite titel="Aufgaben · Board"
      unter={
        <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', alignItems: 'baseline' }}>
          <span>{openCount ? `${openCount} ${openCount === 1 ? 'Aufgabe' : 'Aufgaben'} offen` : 'Nichts offen'}</span>
          {kritischOffen > 0 && (
            <span className="krit-puls" style={{ fontWeight: 600, color: LEUCHT.kritisch }}>
              · ● {kritischOffen} kritisch{kritischOffen > grenzeKritisch ? ` · ${kritischOffen - grenzeKritisch} über deiner Grenze` : ''}
            </span>
          )}
          <span>
            · <b style={{ color: ueberLast ? LEUCHT.achtung : C.inkDim, fontWeight: 600 }}>{dauerText(lastMin)}</b> Aufwand
            {ueberLast && <> · <b style={{ color: LEUCHT.achtung }}>{dauerText(lastMin - grenzeLast * 60)} über {grenzeLast} h</b></>}
            {jarvisListe.length > 0 && <> · <b style={{ color: WER_FARBE.jarvis, fontWeight: 600 }}>{jarvisListe.length} für Jarvis ({dauerText(jarvisMin)})</b></>}
          </span>
        </span>
      }
      rechts={<Link href="/os/aufgaben" style={{ fontSize: TYP.bedien, color: C.inkLeise, textDecoration: 'none' }}>Liste ›</Link>}>

      {/* ─── Anlegen: schnell tippen ODER mit dem ＋ alles anklicken.
          Kevins Ansage: „dass ich selber Sachen anlegen kann — mit einem
          Plus, wo ich alles schnell ausklicken kann." */}
      <Karte i={ki++} akzent={LEUCHT.achtung}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={neuTitel} onChange={e => setNeuTitel(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { if (neuAuf) anlegenMitFeldern(); else schnellAnlegen(); } }}
            placeholder="Neue Aufgabe … (Enter)  ·  !! kritisch  ·  ! hoch  ·  heute / morgen / fr / 15.08.  ·  #capos  ·  @malin"
            aria-label="Neue Aufgabe anlegen"
            style={{ ...feld, flex: 1, minWidth: 0, width: 'auto', fontSize: TYP.body, boxShadow: neuAuf ? `0 0 0 1px ${C.aktiv}55` : undefined }} />
          <button onClick={() => setNeuAuf(!neuAuf)} title={neuAuf ? 'Felder zuklappen' : 'Alles selbst festlegen: Stufe, Person, Termin, Ort'}
            aria-label="Aufgabe mit Feldern anlegen" className="fassbar"
            style={{
              flex: '0 0 auto', width: 46, borderRadius: 12, cursor: 'pointer', fontSize: 19, lineHeight: 1, border: 'none',
              background: neuAuf ? C.aktivSanft : 'rgba(255,255,255,.06)', color: neuAuf ? C.aktiv : C.inkDim, transition: 'background .2s ease',
            }}>{neuAuf ? '×' : '＋'}</button>
        </div>

        {neuAuf && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Feldzeile titel="Stufe">
              {(['critical', 'high', 'medium', 'low'] as const).map(k => (
                <Pille key={k} an={neuPrio === k} farbe={PRIO[k].c} onClick={() => setNeuPrio(k)}>{PRIO[k].t}</Pille>
              ))}
            </Feldzeile>
            <Feldzeile titel="Wer">
              {(['kevin', 'both', 'malin'] as const).map(k => (
                <Pille key={k} an={neuWer === k} farbe={PERSON_FARBE[k]} onClick={() => setNeuWer(k)}>{OWNER[k]}</Pille>
              ))}
            </Feldzeile>
            <Feldzeile titel="Fällig">
              <Faelligkeit wert={neuDatum} setzen={d => setNeuDatum(d)} />
            </Feldzeile>
            <Feldzeile titel="Ort">
              {ORGS.map(o => (
                <Pille key={o.id} an={neuOrg === o.id} farbe={o.farbe} onClick={() => setNeuOrg(o.id)}>{o.kurz}</Pille>
              ))}
            </Feldzeile>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <Knopf onClick={anlegenMitFeldern} aus={!neuTitel.trim()}>Aufgabe anlegen</Knopf>
              <span style={{ fontSize: 12, color: C.inkLeise }}>
                {neuTitel.trim() ? 'Enter legt sie auch an.' : 'Titel oben eintippen.'}
              </span>
            </div>
          </div>
        )}
      </Karte>

      {/* ─── Steuerung: Ansicht · Filter · Delegations-Runde · Prioritäten · Stichworte ─── */}
      <Karte i={ki++}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div role="group" aria-label="Ansicht" style={{ overflowX: 'auto', maxWidth: '100%' }}>
            <Segmente liste={ANSICHT_WAHL} aktiv={ansicht} onWahl={setAnsicht} />
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {/* Die Filter-Klappe: zu, solange man nicht filtert. Steht etwas an,
                sagt der Knopf, wie viele Filter gerade greifen. */}
            <Pille gross an={filterAuf || aktiveFilter > 0} onClick={() => setFilterAuf(!filterAuf)} title="Status, Person, Stufe, Termine, Ort, Weg, Thema">
              {filterAuf ? '▾' : '▸'} Filter{aktiveFilter ? ` · ${aktiveFilter}` : ''}
            </Pille>
            <Knopf onClick={delegationsRunde} aus={delegBusy} farbe={LEUCHT.gut}>{delegBusy ? 'Jarvis prüft …' : '✨ Delegations-Runde'}</Knopf>
          </div>
        </div>

        {/* Eigene Filter aus dem Kompass — in der Klappe, wie die anderen */}
        {filterAuf && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14, alignItems: 'center' }}>
            <span style={{ ...mikro, marginRight: 2 }}>Meine Filter</span>
            {eigeneFilter.map(f => (
              <Pille key={f.id} an={aktiverFilter === f.id} onClick={() => setAktiverFilter(aktiverFilter === f.id ? null : f.id)}>{f.name}</Pille>
            ))}
            <Link href="/os/kompass" style={{ fontSize: 12, color: C.inkLeise, textDecoration: 'none', padding: '5px 4px' }}>
              {eigeneFilter.length ? '+ verwalten' : '+ eigenen Filter anlegen'}
            </Link>
          </div>
        )}

        {/* Filter: Status · Besitzer · Priorität · Termine · Ort · Weg · Thema */}
        {filterAuf && (
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
            {segBtn('offen', 'Offen', openCount)}
            {segBtn('erledigt', 'Erledigt')}
            {segBtn('alle', 'Alle')}
            <Trenner />
            {([['alle', 'Jeder'], ['kevin', 'Kevin'], ['malin', 'Malin'], ['both', 'Beide']] as const).map(([k, label]) => (
              <Pille key={k} an={bes === k} farbe={k === 'alle' ? C.aktiv : PERSON_FARBE[k]} onClick={() => setBes(k)}>{label}</Pille>
            ))}
            <Trenner />
            {(['alle', 'critical', 'high', 'medium', 'low'] as const).map(k => (
              <Pille key={k} an={prioFilter === k} farbe={k === 'alle' ? C.aktiv : PRIO[k].c} onClick={() => setPrioFilter(k)}>{k === 'alle' ? 'Alle Stufen' : PRIO[k].t}</Pille>
            ))}
            {/* Termin-Lage: die zwei Fälle, die man beim Planen wirklich greifen
                will — was noch kein Datum hat, und was schon drüber ist. */}
            <Trenner />
            {([['alle', 'Alle Termine', C.aktiv], ['ohne', 'ohne Datum', LEUCHT.achtung], ['spaet', 'überfällig', LEUCHT.kritisch]] as const).map(([k, label, farbe]) => {
              const wieviele = k === 'ohne' ? ohneDatumAnzahl : k === 'spaet' ? ueberfaelligAnzahl : 0;
              return (
                <Pille key={k} an={datumFilter === k} farbe={farbe} onClick={() => setDatumFilter(k)}
                  title={k === 'ohne' ? 'Aufgaben, die noch keinen Termin haben — die fehlen in jeder Planung' : k === 'spaet' ? 'Termin liegt in der Vergangenheit' : 'Termin egal'}>
                  {label}{wieviele ? ` ${wieviele}` : ''}
                </Pille>
              );
            })}
            <Trenner />
            {(['alle', ...ORGS.map(o => o.id)]).map(k => (
              <Pille key={k} an={orgFilter === k} farbe={k === 'alle' ? C.aktiv : ORG[k].farbe} onClick={() => setOrgFilter(k)} title={k === 'alle' ? 'Alle Orte' : ORG[k].satz}>
                {k === 'alle' ? 'Alle Orte' : ORG[k].kurz}
              </Pille>
            ))}
            <Trenner />
            {(['alle', 'jarvis', 'gemeinsam', 'mensch'] as const).map(k => (
              <Pille key={k} an={werFilter === k} farbe={k === 'alle' ? C.aktiv : WER_FARBE[k]} onClick={() => setWerFilter(k)}>{k === 'alle' ? 'Alle Wege' : WER_LABEL[k]}</Pille>
            ))}
            <Trenner />
            {(['alle', ...themen.map(b => b.id)]).map(k => (
              <Pille key={k} an={themaFilter === k} farbe={k === 'alle' ? C.aktiv : THEMA_EIGEN[k].farbe} onClick={() => setThemaFilter(k)}>{k === 'alle' ? 'Alle Themen' : THEMA_EIGEN[k].label.split(' ')[0]}</Pille>
            ))}
          </div>
        )}

        {/* Prioritäten-Reihenfolge: nur noch auf Wunsch sichtbar */}
        <div style={{ borderTop: `1px solid ${HAAR}`, marginTop: 14, paddingTop: 10 }}>
          <button onClick={() => setOrdnungAuf(!ordnungAuf)}
            style={{ ...mikro, background: 'transparent', border: 'none', padding: '4px 0', cursor: 'pointer', color: ordnungAuf ? C.aktiv : C.inkLeise, minHeight: 32, textAlign: 'left' }}>
            {ordnungAuf ? '▾' : '▸'} Unsere Prioritäten · {themen.map(b => b.label.split(' ')[0]).join(' › ')}
          </button>
          {ordnungAuf && (
            <div style={{ marginTop: 6 }}>
              <div style={{ fontSize: 12, color: C.inkDim, lineHeight: 1.55, marginBottom: 4 }}>
                Was zuerst zählt, wenn alles wichtig ist. Diese Reihenfolge sortiert jede Ansicht —
                nur <b style={{ color: LEUCHT.kritisch }}>kritische</b> Aufgaben brechen sie, weil sie alles andere blockieren.
              </div>
              <Liste>
                {themen.map((b, i) => {
                  const n = state.tasks.filter(t => t.status !== 'done' && meinThema(t) === b.id).length;
                  return (
                    <Zeile key={b.id}
                      links={<span style={{ fontFamily: SCHRIFT.display, fontSize: 15, fontWeight: 700, color: b.farbe, width: 18, textAlign: 'center', flex: '0 0 auto', textShadow: `0 0 12px ${b.farbe}88` }}>{i + 1}</span>}
                      titel={<>{b.label} <span style={{ ...zahl, marginLeft: 6 }}>{n ? `${n} offen` : 'nichts offen'}</span></>}
                      unter={b.satz}
                      rechts={<span style={{ display: 'flex', gap: 4 }}>
                        <Pille leise aus={i === 0} aria="Nach oben" onClick={() => themaSchieben(b.id, -1)}>▲</Pille>
                        <Pille leise aus={i === themen.length - 1} aria="Nach unten" onClick={() => themaSchieben(b.id, 1)}>▼</Pille>
                      </span>} />
                  );
                })}
              </Liste>
            </div>
          )}
        </div>

        {/* Stichworte — die feine Klassierung, ebenfalls zum Zuklappen:
            man braucht sie beim Wegarbeiten, nicht die ganze Zeit. */}
        <div style={{ borderTop: `1px solid ${HAAR}`, marginTop: 6, paddingTop: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={() => setStichAuf(!stichAuf)}
              style={{ ...mikro, background: 'transparent', border: 'none', padding: '4px 0', minHeight: 32, cursor: 'pointer', color: stichAuf ? C.aktiv : C.inkLeise, textAlign: 'left' }}>
              {stichAuf ? '▾' : '▸'} Stichworte{!stichAuf && stichStand.length ? ` · ${stichStand.length}` : ''}
            </button>
            {stichAuf
              ? <span style={{ fontSize: 12, color: C.inkLeise }}>anklicken und alles dazu am Stück wegarbeiten — Dringendstes zuerst</span>
              : stichFilter && <span style={{ fontSize: 12, color: C.aktiv }}>gefiltert: {STICHWORT[stichFilter]?.label ?? stichFilter}</span>}
            {stichAuf && (
              <input value={stichSuche} onChange={e => setStichSuche(e.target.value)} placeholder="suchen …"
                aria-label="Stichwort suchen"
                style={{ ...feld, marginLeft: 'auto', width: 160, padding: '6px 12px', fontSize: TYP.bedien, borderRadius: 999 }} />
            )}
            {!stichAuf && stichFilter && (
              <span style={{ marginLeft: 'auto' }}><Pille leise onClick={() => setStichFilter(null)}>✕ aufheben</Pille></span>
            )}
          </div>
          {stichAuf && (() => {
            const suche = stichSuche.trim().toLowerCase();
            const treffer = suche
              ? STICHWORTE.filter(w => w.label.toLowerCase().includes(suche))
                  .map(w => stichStand.find(s => s.id === w.id) ?? { id: w.id, offen: 0, kritisch: 0, spaet: 0, wort: w })
              : (alleStichAuf ? stichStand : stichStand.slice(0, 14));
            if (!treffer.length) return <Leer>Keine Stichworte gefunden.</Leer>;
            return (
              <div style={{ marginTop: 10 }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {treffer.map(s => {
                    const an = stichFilter === s.id;
                    const farbe = s.kritisch ? LEUCHT.kritisch : s.spaet ? LEUCHT.achtung : THEMA_EIGEN[s.wort.thema]?.farbe ?? C.aktiv;
                    return (
                      <Pille key={s.id} an={an} farbe={farbe} leise={!s.offen} onClick={() => setStichFilter(an ? null : s.id)}
                        className={s.kritisch && !an ? 'krit-puls' : undefined}
                        title={`${s.offen} offen${s.kritisch ? ` · ${s.kritisch} kritisch` : ''}${s.spaet ? ` · ${s.spaet} überfällig` : ''}`}>
                        {s.wort.label}
                        {s.offen > 0 && <span style={{ ...zahl, marginLeft: 6, color: farbe }}>{s.offen}</span>}
                        {s.wort.kpi && <span style={{ ...zahl, marginLeft: 4, fontSize: 11 }}>KPI</span>}
                      </Pille>
                    );
                  })}
                  {!suche && stichStand.length > 14 && (
                    <Pille leise onClick={() => setAlleStichAuf(!alleStichAuf)}>{alleStichAuf ? '− weniger' : `+ ${stichStand.length - 14} weitere`}</Pille>
                  )}
                </div>
                {stichFilter && (
                  <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>
                      Gefiltert auf <b style={{ color: C.aktiv }}>{STICHWORT[stichFilter]?.label}</b> · {list.length} {list.length === 1 ? 'Aufgabe' : 'Aufgaben'}
                    </span>
                    <Pille leise onClick={() => setStichFilter(null)}>✕ Filter lösen</Pille>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </Karte>

      {/* ─── Delegations-Vorschläge: Kevin behält nur, was nur er kann ─── */}
      {deleg && (
        <Karte i={ki++} akzent={C.aktiv}>
          <Ueberschrift farbe={C.aktiv} rechts={<>
            <span style={{ color: C.aktiv }}>{deleg.filter(v => v.empfehlung === 'abgeben').length} abgebbar · {deleg.filter(v => v.empfehlung === 'bleibt').length} bleiben bei dir</span>
            {delegPrivat > 0 && <span>{delegPrivat} private ausgeblendet</span>}
            <button onClick={() => setDeleg(null)} aria-label="Delegations-Runde schließen" style={textKnopf}>✕</button>
          </>}>Delegations-Runde</Ueberschrift>
          {/* Sortieren — nach der Runde will man das Ergebnis ordnen können */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
            <span style={mikro}>Sortiert nach</span>
            {([['person', 'Person'], ['prio', 'Priorität'], ['aufwand', 'Aufwand'], ['thema', 'Thema']] as const).map(([k, label]) => (
              <Pille key={k} an={delegSort === k} onClick={() => setDelegSort(k)}>{label}</Pille>
            ))}
          </div>
          <Liste>
            {delegSortiert.filter(v => v.empfehlung === 'abgeben').map(v => (
              <div key={v.taskId} className="zeile" style={{ borderBottom: `1px solid ${HAAR}`, padding: '12px 2px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: TYP.body, fontWeight: 600, color: C.ink }}>{v.titel}</span>
                  <Chip farbe={C.aktiv}>→ {v.an}</Chip>
                  <span style={{ fontSize: 12, color: C.inkLeise }}>{v.warum}</span>
                </div>
                {v.uebergabe && <div style={{ fontSize: TYP.bedien, color: C.inkDim, margin: '6px 0 8px', lineHeight: 1.5 }}>„{v.uebergabe}“</div>}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: v.uebergabe ? 0 : 8 }}>
                  {delegStatus[v.taskId]
                    ? <Chip farbe={LEUCHT.gut}>{delegStatus[v.taskId]} — Übergabetext in der Aufgabe notiert</Chip>
                    : <>
                        <Knopf onClick={() => delegiere(v)}>✓ Delegieren an {v.an}</Knopf>
                        {v.uebergabe && <Knopf leise onClick={() => { try { navigator.clipboard.writeText(v.uebergabe!); } catch { /* egal */ } }}>Übergabetext kopieren</Knopf>}
                        <Knopf leise onClick={() => setDelegStatus(s => ({ ...s, [v.taskId]: 'bleibt bei dir' }))}>Bleibt bei mir</Knopf>
                      </>}
                </div>
              </div>
            ))}
          </Liste>
          {deleg.filter(v => v.empfehlung === 'bleibt').length > 0 && (
            <div style={{ fontSize: 12, color: C.inkLeise, lineHeight: 1.6, marginTop: 10 }}>
              <b style={{ color: C.inkDim }}>Bleibt bei dir:</b> {deleg.filter(v => v.empfehlung === 'bleibt').map(v => v.titel).join(' · ')}
            </div>
          )}
          {!deleg.length && <Leer>Nichts Delegierbares offen.</Leer>}
        </Karte>
      )}

      {!ready && <Karte i={ki++}><Leer>Lade Aufgaben …</Leer></Karte>}

      {ready && !list.length && (
        <Karte i={ki++}><Leer>{seg === 'offen' ? 'Nichts in dieser Auswahl. 🎯' : 'Keine Aufgaben in dieser Ansicht.'}</Leer></Karte>
      )}

      {/* ── BOARD: verteilen, terminieren, zuordnen ── */}
      {ready && ansicht === 'board' && (
        <Karte i={ki++}>
          <Ueberschrift farbe={LEUCHT.puls} rechts={list.length ? `${list.length} ${list.length === 1 ? 'Aufgabe' : 'Aufgaben'}` : undefined}>Board</Ueberschrift>
          <AufgabenBoard
            tasks={list}
            heute={heute}
            orgVon={meineOrg}
            patchTask={patchTask}
            setOrg={(id, org) => ordnungSpeichern({ orgs: { [id]: org } })}
          />
        </Karte>
      )}

      {/* ── JETZT: die ersten fünf, dann der Rest ── */}
      {ready && !!list.length && ansicht === 'jetzt' && (() => {
        const top = list.slice(0, 5);
        const rest = list.slice(5);
        return (
          <>
            <Karte i={ki++} akzent={LEUCHT.schlaf}>
              <Ueberschrift farbe={LEUCHT.schlaf} rechts="in der Reihenfolge unserer Ordnung — mehr als fünf gleichzeitig ist keine Priorität mehr">Die nächsten fünf</Ueberschrift>
              <Liste>
                {top.map((t, i) => zeile(t, 0, true, { n: i + 1, farbe: THEMA_EIGEN[meinThema(t)]?.farbe ?? C.inkLeise }))}
              </Liste>
            </Karte>
            {!!rest.length && (
              <Karte i={ki++}>
                <Ueberschrift rechts={`${rest.length}`}>Danach</Ueberschrift>
                <Liste>{rest.map((t, i) => zeile(t, i + 1, true))}</Liste>
              </Karte>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 14, alignItems: 'start' }}>
          {BAHNEN.map(b => {
            const drin = list.filter(t => t.assignee === b.id);
            const offen = drin.filter(t => t.status !== 'done');
            const kritisch = offen.filter(t => t.priority === 'critical').length;
            const spaet = offen.filter(t => t.dueDate && t.dueDate < heute).length;
            const minuten = offen.reduce((s, t) => s + einschaetzen(t).dauer, 0);
            const jarvis = offen.filter(t => einschaetzen(t).wer === 'jarvis').length;
            const farbe = PERSON_FARBE[b.id];
            return (
              <Karte key={b.id} i={ki++} akzent={farbe}>
                <Ueberschrift farbe={farbe} rechts={offen.length ? `${offen.length}` : '—'}>{b.titel}</Ueberschrift>
                <div style={{ fontSize: 12, color: C.inkLeise, lineHeight: 1.45 }}>{b.satz}</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8, fontSize: 11, fontWeight: 600 }}>
                  <span style={{ color: kritisch ? LEUCHT.kritisch : C.inkLeise }}>{kritisch} kritisch</span>
                  <span style={{ color: spaet ? LEUCHT.kritisch : C.inkLeise }}>{spaet} überfällig</span>
                  <span style={{ color: C.inkLeise }}>{dauerText(minuten)}</span>
                  {!!jarvis && <span style={{ color: WER_FARBE.jarvis }}>⚡ {jarvis}</span>}
                </div>
                <div style={{ fontSize: 11, color: C.inkLeise, marginTop: 6, marginBottom: 6 }}>
                  Übergeben: in der Zeile auf den Namen klicken
                </div>
                {offen.length
                  ? <Liste>{offen.map((t, i) => zeile(t, i + 1, true))}</Liste>
                  : <Leer>Nichts offen hier.</Leer>}
              </Karte>
            );
          })}
        </div>
      )}

      {/* ── BAHNEN: das Board — je Thema eine Spalte, in unserer Reihenfolge ── */}
      {ready && !!list.length && ansicht === 'themen' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 14, alignItems: 'start' }}>
          {themen.map((b, bi) => {
            const drin = list.filter(t => meinThema(t) === b.id);
            return (
              <Karte key={b.id} i={ki++} akzent={drin.length ? b.farbe : undefined}>
                <Ueberschrift farbe={b.farbe} rechts={drin.length ? `${drin.length}` : '—'}>{bi + 1} · {b.label}</Ueberschrift>
                <div style={{ fontSize: 12, color: C.inkLeise, lineHeight: 1.45, marginBottom: 6 }}>{b.satz}</div>
                {drin.length
                  ? <Liste>{drin.map((t, i) => zeile(t, i + 1))}</Liste>
                  : <Leer>Nichts offen hier.</Leer>}
              </Karte>
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
                farbe: t.priority === 'critical' ? LEUCHT.kritisch : b.farbe,
                symbol: t.priority === 'critical' ? '◆' : '●',
                titel: `${t.title} · ${PRIO[t.priority].t} · ${OWNER[t.assignee] ?? t.assignee}`,
              }));
              const spaet = drin.filter(t => t.dueDate! < heute).length;
              return (
                <Karte key={b.id} i={ki++}>
                  <Ueberschrift farbe={b.farbe} rechts={<>
                    <span>{drin.length ? `${drin.length} terminiert` : 'nichts terminiert'}</span>
                    {spaet > 0 && <span className="krit-puls" style={{ color: LEUCHT.kritisch, fontWeight: 700 }}>{spaet} überfällig</span>}
                  </>}>{b.label}</Ueberschrift>
                  <Zeitstrahl von={von} bis={bis} ticks={ticks} marker={marker} />
                </Karte>
              );
            })}
            {ohneDatum > 0 && (
              <Karte i={ki++}>
                <Leer>
                  <b style={{ color: LEUCHT.achtung }}>{ohneDatum} Aufgaben ohne Datum</b> — sie erscheinen erst auf dem Zeitstrahl, wenn ihr ihnen einen Tag gebt. Aufgabe aufklappen → „Fällig“.
                </Leer>
              </Karte>
            )}
          </>
        );
      })()}

      {/* ── LISTE: nach Fälligkeit gruppiert ── */}
      {ready && !!list.length && ansicht === 'liste' && (
        <Karte i={ki++}>
          {(gruppen ?? [{ key: 'flach', label: '', tasks: list }]).map((g, gi) => (
            <div key={g.key} style={{ marginTop: gi ? 18 : 0 }}>
              {g.label && <Ueberschrift farbe={gruppeFarbe(g.key)} rechts={`${g.tasks.length}`}>{g.label}</Ueberschrift>}
              <Liste>{g.tasks.map((t, i) => zeile(t, i || !g.label ? 1 : 0, true))}</Liste>
            </div>
          ))}
        </Karte>
      )}

      {/* ─── Apple Erinnerungen (iCloud · geteilt mit Malin) ─── */}
      <Karte i={ki++}>
        <Ueberschrift farbe={remState === 'ok' ? LEUCHT.puls : remState === 'fehler' ? LEUCHT.achtung : undefined}
          rechts={<>
            <span>geteilt mit Malin</span>
            {remState === 'ok' && <span style={zahl}>{reminders.length ? `${reminders.length} offen` : 'nichts offen'}</span>}
          </>}>Erinnerungen · iCloud</Ueberschrift>

        {remState === 'laden' && <Leer>Lade Erinnerungen aus iCloud …</Leer>}

        {remState === 'fehler' && (
          <Leer>
            <div style={{ fontSize: TYP.body, color: C.ink, fontWeight: 600, marginBottom: 4 }}>Zugriff auf Erinnerungen freigeben</div>
            macOS muss den Zugriff einmalig erlauben — bestätige das Popup „Zugriff auf Erinnerungen“, oder aktiviere es unter <b>Systemeinstellungen → Datenschutz &amp; Sicherheit → Erinnerungen</b>. Danach die Seite neu laden.
          </Leer>
        )}

        {remState === 'ok' && reminders.length === 0 && <Leer>Keine offenen Erinnerungen. 🎯</Leer>}

        {remState === 'ok' && remByList.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 12 }}>
            {remByList.map(([lname, items]) => (
              <div key={lname} style={{ background: FLAECHE, borderRadius: 14, padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: TYP.bedien, fontWeight: 700, color: C.aktiv }}>{lname}</span>
                  <span style={zahl}>{items.length}</span>
                </div>
                <Liste>
                  {items.slice(0, 10).map(r => (
                    <Zeile key={r.id} links={<Punkt farbe={C.inkLeise} groesse={8} />}
                      titel={<span style={{ color: C.inkDim, fontWeight: 400 }}>{r.title}</span>}
                      rechts={r.due ? <span style={{ ...zahl, color: LEUCHT.achtung }}>{new Date(r.due).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</span> : undefined} />
                  ))}
                </Liste>
                {items.length > 10 && <div style={{ fontSize: 11, color: C.inkLeise, marginTop: 8 }}>+{items.length - 10} weitere</div>}
              </div>
            ))}
          </div>
        )}
      </Karte>

      <div style={{ fontSize: 12, color: C.inkLeise, padding: '0 2px' }}>
        Aufgaben werden lokal auf deinem Mac gespeichert · Erinnerungen live aus iCloud.
      </div>
    </Seite>
  );
}

// ── Kleine Bausteine ────────────────────────────────────────────────────────
// Eine Pille ist überall der Wahlknopf: rahmenlos, leuchtet in der Farbe der
// gewählten Option. Bewusst schlicht — Kevins Ansage war „schnell ausklicken".

function Pille({ an, farbe, leise, klein, gross, aus, onClick, title, aria, className, children }: {
  an?: boolean; farbe?: string; leise?: boolean; klein?: boolean; gross?: boolean; aus?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void; title?: string; aria?: string; className?: string; children: ReactNode;
}) {
  const f = farbe ?? C.aktiv;
  return (
    <button onClick={onClick} title={title} aria-label={aria} disabled={aus} className={`fassbar${className ? ` ${className}` : ''}`} style={{
      fontFamily: SCHRIFT.text, fontSize: gross ? TYP.bedien : klein ? 11 : 12, fontWeight: an || gross ? 700 : 500,
      padding: gross ? '9px 15px' : klein ? '2px 9px' : '5px 11px', borderRadius: gross ? 11 : 999, border: 'none',
      cursor: aus ? 'default' : 'pointer', whiteSpace: 'nowrap', letterSpacing: '.02em', transition: 'background .2s ease, color .2s ease',
      background: an ? `${f}22` : 'rgba(255,255,255,.06)', color: an ? f : aus ? 'rgba(255,255,255,.18)' : leise ? C.inkLeise : C.inkDim,
      opacity: aus ? .7 : 1,
    }}>{children}</button>
  );
}

/** Beschriftung links, Knöpfe rechts — das ＋-Formular. */
function Feldzeile({ titel, children }: { titel: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <span style={{ ...mikro, width: 52, flex: '0 0 auto' }}>{titel}</span>
      {children}
    </div>
  );
}

/** Feste Label-Spalte im Aufgaben-Detail — alles fluchtet. */
function DetailLabel({ children }: { children: ReactNode }) {
  return <span style={{ ...mikro, alignSelf: 'center' }}>{children}</span>;
}

/** Senkrechte Haarlinie zwischen Filtergruppen. */
function Trenner() {
  return <span style={{ width: 1, height: 20, background: 'rgba(255,255,255,.1)', margin: '0 3px' }} />;
}
