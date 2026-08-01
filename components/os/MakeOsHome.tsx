'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  THEME as T, scoreColor,
  MODULES, LIFE_WHEEL, MZG_PILLARS,
} from '@/lib/make-one/os-data';
import { useTasks } from '@/context/TasksContext';
import { LIVE_AGENTS } from '@/lib/make-one/agents-data';
import { Tagesstart } from './Tagesstart';
import { localDay } from '@/lib/zeit';
import type { PerfIndex } from '@/lib/performance';
import { SAEULE_VON_PROJEKT, SAEULE_LABEL, SAEULE_FARBE, FOKUS_SCHWELLE } from '@/lib/make-one/fokus-data';
import { Zeitstrahl, type StrahlMarker } from './Zeitstrahl';

// ─── Zähler: Zahlen laufen ein, statt zu erscheinen (Wow beim Laden) ────────
function useZaehler(ziel: number, dauer = 750): number {
  const [wert, setWert] = useState(0);
  useEffect(() => {
    if (!ziel) { setWert(ziel); return; }
    if (dauer <= 0 || matchMedia('(prefers-reduced-motion: reduce)').matches) { setWert(ziel); return; }
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dauer);
      setWert(Math.round(ziel * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ziel, dauer]);
  return wert;
}

// ─── Mini-Trendlinie (7 Werte) — Kontext statt Momentaufnahme ───────────────
function Spark({ werte, farbe }: { werte: number[]; farbe: string }) {
  if (werte.length < 2) return null;
  const w = 46, h = 14;
  const min = Math.min(...werte), max = Math.max(...werte);
  const span = max - min || 1;
  const pts = werte.map((v, i) => `${((i / (werte.length - 1)) * (w - 2) + 1).toFixed(1)},${(h - 2 - ((v - min) / span) * (h - 4)).toFixed(1)}`).join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'block', marginTop: 4, opacity: 0.85 }}>
      <polyline points={pts} fill="none" stroke={farbe} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ─── Radial gauge ───────────────────────────────────────────────────────────
function Gauge({ value, size = 54 }: { value: number; size?: number }) {
  const r = 22, C = 2 * Math.PI * r, off = C * (1 - value / 100);
  return (
    <svg width={size} height={size} viewBox="0 0 58 58" style={{ flex: '0 0 auto' }}>
      <circle cx="29" cy="29" r={r} fill="none" stroke="rgba(150,168,162,.14)" strokeWidth="4" />
      <circle cx="29" cy="29" r={r} fill="none" stroke={scoreColor(value)} strokeWidth="4" strokeLinecap="round"
        strokeDasharray={C.toFixed(1)} strokeDashoffset={off.toFixed(1)} transform="rotate(-90 29 29)" />
      <text x="29" y="33" textAnchor="middle" fill={T.ink} fontSize="14" fontFamily={T.mono} fontWeight="600">{value}</text>
    </svg>
  );
}

const lbl = { fontFamily: T.mono, fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase' as const, color: T.muted };
const panel = { background: T.panel, border: `1px solid ${T.line}`, borderRadius: 16 };
const wbtn = { fontFamily: T.mono, fontSize: 10, color: T.inkDim, background: 'transparent', border: `1px solid ${T.line}`, borderRadius: 6, padding: '3px 8px', cursor: 'pointer' } as const;

// ─── Widget-Board: das Dashboard gehört Kevin ───────────────────────────────
// Jede Kachel ist ein Widget — Reihenfolge & Sichtbarkeit liegen im Store
// (dashboard), „Anpassen" schaltet die Steuerung frei.
const WIDGET_LABEL: Record<string, string> = {
  gesundheit: 'Gesundheit & Energie',
  shields: 'Risk-Shields',
  kopf: 'Fokus jetzt + Tagesstart',
  tagesausrichtung: 'Tagesplan & Ausrichtung',
  zeitstrahl: 'Zeitstrahl',
  score: 'MAKE Score + Fokus & To-dos',
  forecast: 'Forecast (Ziele)',
  module: 'Bereichs-Kacheln',
  system: 'System & Agenten',
  balance: 'Lebensrad + Agenda',
};
// Kevins Ansage: die Tagesausrichtung steht ganz oben; Forecast aufs Board.
const STANDARD_BOARD = ['tagesausrichtung', 'zeitstrahl', 'gesundheit', 'shields', 'kopf', 'score', 'forecast', 'module', 'system', 'balance'];

// ─── Lebensrad (radar) ──────────────────────────────────────────────────────
function Lebensrad() {
  const cx = 140, cy = 140, maxR = 110;
  const pt = (i: number, r: number) => {
    const a = (-90 + i * 45) * Math.PI / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const outer = LIFE_WHEEL.map((_, i) => pt(i, maxR).map(n => n.toFixed(1)).join(',')).join(' ');
  const mid = LIFE_WHEEL.map((_, i) => pt(i, maxR / 2).map(n => n.toFixed(1)).join(',')).join(' ');
  const poly = LIFE_WHEEL.map((a, i) => pt(i, (a.score / 10) * maxR).map(n => n.toFixed(1)).join(',')).join(' ');
  return (
    <section style={{ ...panel, padding: '22px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <span style={lbl}>Lebensrad · Balance</span>
        <span style={{ fontFamily: T.mono, fontSize: 9.5, color: T.muted }}>Mut zum Glücklich sein · Bodo Schäfer</span>
      </div>
      <div style={{ display: 'flex', gap: 22, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
        <svg width="200" height="200" viewBox="0 0 280 280" style={{ flex: '0 0 auto' }} aria-label="Lebensrad">
          <polygon points={outer} fill="none" stroke="rgba(150,168,162,.16)" strokeWidth="1" />
          <polygon points={mid} fill="none" stroke="rgba(150,168,162,.10)" strokeWidth="1" />
          {LIFE_WHEEL.map((_, i) => { const [x, y] = pt(i, maxR); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(150,168,162,.10)" />; })}
          <polygon points={poly} fill="rgba(51,204,156,.14)" stroke={T.accent} strokeWidth="1.5" />
          {LIFE_WHEEL.map((a, i) => { const [x, y] = pt(i, (a.score / 10) * maxR); return <circle key={i} cx={x} cy={y} r="2.5" fill={T.accent} />; })}
        </svg>
        <div style={{ flex: 1, minWidth: 170, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
          {LIFE_WHEEL.map(a => (
            <div key={a.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: T.inkDim }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: a.score >= 7 ? T.accent : a.score >= 5 ? T.amber : T.crit }} />
              {a.label}<span style={{ marginLeft: 'auto', fontFamily: T.mono, color: T.ink }}>{a.score}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 16, borderTop: `1px solid ${T.line}`, paddingTop: 12, fontFamily: T.mono, fontSize: 10, letterSpacing: '.08em', color: T.muted }}>
        METHODIK · {MZG_PILLARS.map(p => <span key={p} style={{ color: T.accent }}>{p} </span>)}— MAKE führt dich durch die Reflexion
      </div>
    </section>
  );
}

// ─── Agenda (KEMARIS live) ──────────────────────────────────────────────────
function Agenda() {
  const [events, setEvents] = useState<{ id: string; start: string; title: string; isTeams: boolean }[]>([]);
  const [label, setLabel] = useState('Heute');
  useEffect(() => {
    let alive = true;
    fetch('/api/kemaris-calendar').then(r => r.json()).then(d => {
      if (!alive) return;
      const all = (d.events ?? []) as { id: string; start: string; title: string; isTeams: boolean }[];
      const today = localDay();
      let day = today, list = all.filter(e => e.start.slice(0, 10) === day);
      if (!list.length) {
        const fut = all.filter(e => e.start.slice(0, 10) >= today).sort((a, b) => a.start.localeCompare(b.start));
        if (fut.length) { day = fut[0].start.slice(0, 10); list = all.filter(e => e.start.slice(0, 10) === day);
          setLabel(new Date(day + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })); }
      }
      setEvents(list.sort((a, b) => a.start.localeCompare(b.start)));
    }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const hhmm = (iso: string) => iso.slice(11, 16);
  const focus = (iso: string) => { const h = +iso.slice(11, 13); return h >= 9 && h < 17; };
  return (
    <section style={{ ...panel, padding: '20px 22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12, gap: 10 }}>
        <span style={lbl}>{label === 'Heute' ? `Heute · ${new Date().toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}` : label}</span>
        <span style={{ fontFamily: T.mono, fontSize: 9.5, color: T.accent }}>KEMARIS + Holding</span>
      </div>
      {events.map((e, i) => (
        <div key={e.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 0', borderTop: i ? `1px solid ${T.lineSoft}` : 0 }}>
          <span style={{ width: 2, alignSelf: 'stretch', borderRadius: 2, background: focus(e.start) ? T.amber : T.accent }} />
          <span style={{ fontFamily: T.mono, fontSize: 12, color: T.ink, minWidth: 46 }}>{hhmm(e.start)}</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, color: T.inkDim, lineHeight: 1.3 }}>{e.title}{e.isTeams && ' · Teams'}</div>
            <div style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: '.06em', textTransform: 'uppercase', marginTop: 4, color: T.muted }}>
              KEMARIS{focus(e.start) && <span style={{ color: T.amber }}> · ⚠ Fokuszeit</span>}
            </div>
          </span>
        </div>
      ))}
    </section>
  );
}

// ─── HOME ───────────────────────────────────────────────────────────────────
export function MakeOsHome() {
  const [clock, setClock] = useState('––:––');
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setClock(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    };
    tick(); const id = setInterval(tick, 15000); return () => clearInterval(id);
  }, []);

  // Der große Auftritt (Kaskade + Score-Hochzählen) spielt EINMAL pro Sitzung —
  // danach steht das Dashboard sofort. Wiederholte Intros nerven statt wowen.
  const [intro] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      if (sessionStorage.getItem('make-os-intro')) return false;
      sessionStorage.setItem('make-os-intro', '1');
      return true;
    } catch { return false; }
  });

  // EIN Score: derselbe echte Index wie unter /os/performance. Vorher stand
  // hier eine zweite, fest eingetragene Rechnung — zwei Wahrheiten für
  // dieselbe Frage.
  const [perf, setPerf] = useState<PerfIndex | null>(null);
  useEffect(() => { fetch('/api/performance').then(r => r.json()).then(d => setPerf(d.aktuell)).catch(() => {}); }, []);
  const msi = perf?.index ?? 0;
  const msiAnzeige = useZaehler(msi, intro ? 750 : 0);
  const { state: tasksState, dispatch: tasksDispatch } = useTasks();

  // Fokus neben dem Score: Tag/Woche/Monat umschaltbar, direkt hier editierbar.
  const [fokus, setFokus] = useState<Record<string, string>>({});
  const [fokusH, setFokusH] = useState<'tag' | 'woche' | 'monat'>('tag');
  const [regler, setRegler] = useState<Record<string, number>>({});
  const fokusTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [zieleAlle, setZieleAlle] = useState<Record<'monat' | 'quartal' | 'jahr', { fortschritt: number; erledigt?: boolean }[]>>({ monat: [], quartal: [], jahr: [] });
  const [msAlle, setMsAlle] = useState<{ titel: string; bereich: string; faellig?: string; erledigt?: boolean }[]>([]);
  useEffect(() => {
    fetch('/api/state/ziele').then(r => r.json()).then(d => {
      const f = d.fokus ?? {};
      setFokus(f);
      if (!f.tag) setFokusH(f.woche ? 'woche' : f.monat ? 'monat' : 'tag');
      setZieleAlle({ monat: d.monat ?? [], quartal: d.quartal ?? [], jahr: d.jahr ?? [] });
    }).catch(() => {});
    fetch('/api/state/fokus-regler').then(r => r.json()).then(d => setRegler(d.regler ?? {})).catch(() => {});
    fetch('/api/state/meilensteine').then(r => r.json()).then(d => setMsAlle(Array.isArray(d.meilensteine) ? d.meilensteine : [])).catch(() => {});
  }, []);
  function fokusSetzen(h: 'tag' | 'woche' | 'monat', text: string) {
    setFokus(prev => ({ ...prev, [h]: text }));
    clearTimeout(fokusTimer.current);
    fokusTimer.current = setTimeout(() => {
      fetch('/api/state/ziele', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ horizont: h, fokus: text }) }).catch(() => {});
    }, 600);
  }

  // Gesundheit & Energie läuft immer parallel mit + An/Aus-Modus (echte Arbeitszeit).
  const [vital, setVital] = useState<{ rec: number; sleep: number; hrv: number; rhr: number; heute: boolean; stand: string; fallback: boolean } | null>(null);
  const [routinenStand, setRoutinenStand] = useState<{ gesamt: number; erledigt: number } | null>(null);
  const [streak, setStreak] = useState(0);
  const [energieHeute, setEnergieHeute] = useState<number | null>(null);
  const [modus, setModus] = useState<{ an: boolean; seit: string | null; aktivMin: number } | null>(null);
  const [gesundZeit, setGesundZeit] = useState<{ an: boolean; seit: string | null; aktivMin: number } | null>(null);
  const [shields, setShields] = useState<{ id: string; stufe: 'rot' | 'amber'; text: string; href: string; label: string }[]>([]);
  const [vlog, setVlog] = useState<Record<string, { rec?: number; sleep?: number; hrv?: number; rhr?: number }>>({});
  useEffect(() => {
    fetch('/api/state/vitals').then(r => r.json()).then(d => { setVital(d.aktuell ?? null); setVlog(d.log ?? {}); }).catch(() => {});
    fetch('/api/state/journal').then(r => r.json()).then(d => setEnergieHeute(d.journal?.[localDay()]?.energy ?? null)).catch(() => {});
    Promise.all([
      fetch('/api/state/routinen').then(r => r.json()).catch(() => ({ routinen: [] })),
      fetch('/api/state/health').then(r => r.json()).catch(() => ({ log: {} })),
    ]).then(([r, h]) => {
      const aktiv = ((r.routinen ?? []) as { id: string; aktiv: boolean }[]).filter(x => x.aktiv);
      const log = (h.log ?? {}) as Record<string, string[]>;
      const heutigen = new Set(log[localDay()] ?? []);
      setRoutinenStand({ gesamt: aktiv.length, erledigt: aktiv.filter(x => heutigen.has(x.id)).length });
      // Streak wie im Cockpit: Tage in Folge mit ≥4 Häkchen (heute darf noch offen sein).
      let s = 0;
      const d = new Date();
      if ((log[localDay()] ?? []).length < 4) d.setDate(d.getDate() - 1);
      while ((log[localDay(d)] ?? []).length >= 4) { s++; d.setDate(d.getDate() - 1); }
      setStreak(s);
    });
    fetch('/api/state/arbeitsmodus').then(r => r.json()).then(d => { setModus(d.heute ?? null); setGesundZeit(d.gesundheit ?? null); }).catch(() => {});
    fetch('/api/risk').then(r => r.json()).then(d => setShields(Array.isArray(d.shields) ? d.shields : [])).catch(() => {});
  }, []);
  async function modusToggle() {
    try {
      const r = await fetch('/api/state/arbeitsmodus', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: modus?.an ? 'aus' : 'an' }) });
      const d = await r.json();
      if (d.heute) setModus(d.heute);
    } catch { /* still */ }
  }
  // Der zweite Schalter: Gesundheits-Zeit (Reha, Bewegung, Erholung) — Kevins
  // Ansage: „oben auch eine Zahl, die für Gesundheit die Zeit anmacht."
  async function gesundZeitToggle() {
    try {
      const r = await fetch('/api/state/arbeitsmodus', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: gesundZeit?.an ? 'aus' : 'an', was: 'gesundheit' }) });
      const d = await r.json();
      if (d.heute) setGesundZeit(d.heute);
    } catch { /* still */ }
  }

  // ── Widget-Board laden/sichern ──
  const [board, setBoard] = useState<string[] | null>(null);
  const [bearbeiten, setBearbeiten] = useState(false);
  const boardTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    fetch('/api/state/dashboard').then(r => r.json())
      .then(d => setBoard(Array.isArray(d.widgets) && d.widgets.length ? d.widgets.filter((w: string) => WIDGET_LABEL[w]) : STANDARD_BOARD))
      .catch(() => setBoard(STANDARD_BOARD));
  }, []);
  function boardSpeichern(next: string[]) {
    setBoard(next);
    clearTimeout(boardTimer.current);
    boardTimer.current = setTimeout(() => {
      fetch('/api/state/dashboard', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ widgets: next }) }).catch(() => {});
    }, 500);
  }
  const aktuellBoard = board ?? STANDARD_BOARD;
  const verborgen = Object.keys(WIDGET_LABEL).filter(id => !aktuellBoard.includes(id));

  // ── iOS-Prinzip: 2 Sekunden halten → Bearbeiten; dann Widgets frei ziehen ──
  const druck = useRef<{ t?: ReturnType<typeof setTimeout>; x: number; y: number }>({ x: 0, y: 0 });
  const druckStart = (e: React.PointerEvent) => {
    if (bearbeiten) return;
    clearTimeout(druck.current.t);
    druck.current = { t: setTimeout(() => setBearbeiten(true), 2000), x: e.clientX, y: e.clientY };
  };
  const druckEnde = () => clearTimeout(druck.current.t);
  const druckBewegt = (e: React.PointerEvent) => {
    if (Math.abs(e.clientX - druck.current.x) + Math.abs(e.clientY - druck.current.y) > 8) clearTimeout(druck.current.t);
  };
  const zieheWidget = useRef<string | null>(null);
  const dragUeber = (id: string) => {
    const von = zieheWidget.current;
    if (!von || von === id) return;
    const b = [...aktuellBoard];
    const i = b.indexOf(von), j = b.indexOf(id);
    if (i < 0 || j < 0) return;
    b.splice(i, 1);
    b.splice(j, 0, von);
    setBoard(b);
  };
  const dragFertig = () => {
    zieheWidget.current = null;
    if (board) boardSpeichern([...board]);
  };

  // Tagesausrichtung — der letzte volle Lauf als eigenes Widget.
  const [ausricht, setAusricht] = useState<{ gruss?: string; prioritaeten?: { titel: string; wann?: string }[]; schutz?: string; stand?: string } | null>(null);
  useEffect(() => {
    fetch('/api/tageslauf').then(r => r.json()).then(d => {
      const a = d.letzterVoll?.ausrichtung;
      if (a) setAusricht({ ...a, stand: d.letzterVoll?.gestartet?.slice(11, 16) });
    }).catch(() => {});
  }, []);


// ── Die Widgets: jede Kachel ein Fall — Reihenfolge bestimmt das Board ──
  const renderWidget = (id: string): React.ReactNode => {
    switch (id) {
      case 'gesundheit': return (<>
        {/* ── GESUNDHEIT & ENERGIE — die allererste Kachel: ein Urteil, Werte
             gegen die eigene Baseline (Ø14T), Trends statt Momentaufnahmen ── */}
        {(() => {
          const zone = vital ? (vital.rec >= 66 ? { l: 'GRÜN', c: T.accent } : vital.rec >= 40 ? { l: 'GELB', c: T.amber } : { l: 'ROT', c: T.crit }) : { l: '…', c: '#58D9CD' };
          type VK = 'rec' | 'sleep' | 'hrv' | 'rhr';
          const serie = (k: VK) => Object.keys(vlog).sort().slice(-7).map(t => vlog[t]?.[k]).filter((x): x is number => typeof x === 'number');
          const basis = (k: VK) => {
            const w = Object.keys(vlog).sort().filter(t => t !== localDay()).slice(-14).map(t => vlog[t]?.[k]).filter((x): x is number => typeof x === 'number');
            return w.length >= 3 ? w.reduce((a, b) => a + b, 0) / w.length : null;
          };
          // ▲/▼ gegen die eigene 14-Tage-Baseline — Tageslärm bekommt Kontext.
          const delta = (wert: number, k: VK, besserHoch: boolean) => {
            const avg = basis(k);
            if (avg == null) return null;
            const d = wert - avg;
            if (Math.abs(d) < 0.04 * Math.max(1, Math.abs(avg))) return <span style={{ fontFamily: T.mono, fontSize: 9.5, color: T.muted }}>≈ Ø</span>;
            const gut = besserHoch ? d > 0 : d < 0;
            return <span style={{ fontFamily: T.mono, fontSize: 9.5, color: gut ? T.accent : T.amber }}>{d > 0 ? '▲' : '▼'} {(Math.abs(d) < 10 ? Math.abs(d).toFixed(1).replace('.', ',') : String(Math.round(Math.abs(d))))} vs Ø</span>;
          };
          // Das eine Urteil des Morgens — deterministisch aus der Zone.
          const urteil = !vital ? '' :
            vital.rec >= 66 ? 'Grünes Licht — heute darf hart gefahren werden. Reha bleibt trotzdem fest.' :
            vital.rec >= 40 ? 'Halbe Ladung — zwei gute Fokusblöcke, Pausen ernst nehmen.' :
            'Erhaltungsmodus — nur Essenzielles, Rücken schonen, früh Schluss.';
          const stat = (l: string, v: React.ReactNode, extra?: React.ReactNode) => (
            <div style={{ minWidth: 76 }}>
              <div style={{ fontFamily: T.mono, fontSize: 9.5, letterSpacing: '.12em', textTransform: 'uppercase', color: T.muted }}>{l}</div>
              <div style={{ fontFamily: T.mono, fontSize: 21, fontWeight: 700, color: T.ink, marginTop: 3 }}>{v}</div>
              {extra}
            </div>
          );
          return (
            <div className="gesund-kachel" onClick={() => { window.location.href = '/os/gesundheit'; }} role="link" tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter') window.location.href = '/os/gesundheit'; }}
              style={{ ...panel, borderLeft: '3px solid #58D9CD', padding: '20px 24px', marginBottom: 14, display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap', cursor: 'pointer' }}>
              {/* Herzschlag */}
              <span style={{ position: 'relative', width: 52, height: 52, flex: '0 0 auto' }}>
                <span className="gesund-puls-ring" style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `2px solid ${zone.c}` }} />
                <span className="gesund-puls-kern" style={{ position: 'absolute', inset: 13, borderRadius: '50%', background: zone.c, opacity: 0.9 }} />
              </span>
              <div style={{ minWidth: 230, maxWidth: 340 }}>
                <div style={{ ...lbl, color: '#58D9CD' }}>Gesundheit & Energie</div>
                <div style={{ fontSize: 19, fontWeight: 700, color: zone.c, marginTop: 3 }}>
                  {vital ? <>{zone.l} · Recovery {vital.rec}% <span style={{ fontSize: 11, fontWeight: 400 }}>{delta(vital.rec, 'rec', true)}</span></> : 'lade …'}
                </div>
                {vital && !vital.heute && (
                  <div style={{ fontSize: 11.5, color: T.amber, marginTop: 3 }}>Stand {vital.stand.slice(8)}.{vital.stand.slice(5, 7)}. — Morgen-Check fehlt</div>
                )}
                {vital && <div style={{ fontSize: 12, color: T.inkDim, marginTop: 4, lineHeight: 1.45 }}>{urteil}</div>}
              </div>
              {vital && (
                <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  {stat('Score', perf?.saeulen.find(s => s.key === 'health')?.score ?? '—')}
                  {stat('Schlaf', `${String(vital.sleep).replace('.', ',')} h`, <>{delta(vital.sleep, 'sleep', true)}<Spark werte={serie('sleep')} farbe="#58D9CD" /></>)}
                  {stat('HRV', vital.hrv, <>{delta(vital.hrv, 'hrv', true)}<Spark werte={serie('hrv')} farbe="#58D9CD" /></>)}
                  {stat('Puls', vital.rhr, <>{delta(vital.rhr, 'rhr', false)}<Spark werte={serie('rhr')} farbe="#58D9CD" /></>)}
                  {stat('Energie', energieHeute != null ? `${energieHeute}/5` : '—')}
                  {routinenStand && stat('Routinen', `${routinenStand.erledigt}/${routinenStand.gesamt}`, (
                    <div style={{ width: 46, height: 4, borderRadius: 2, background: 'rgba(150,168,162,.14)', marginTop: 6 }}>
                      <div className="fuell-anim" style={{ width: `${routinenStand.gesamt ? Math.round((routinenStand.erledigt / routinenStand.gesamt) * 100) : 0}%`, height: '100%', borderRadius: 2, background: '#58D9CD' }} />
                    </div>
                  ))}
                  {stat('Streak', `${streak} T`)}
                </div>
              )}
              <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                <Link href="/os/gesundheit" onClick={e => e.stopPropagation()} style={{ fontFamily: T.mono, fontSize: 11, color: T.accentInk, textDecoration: 'none' }}>Cockpit ›</Link>
                <Link href="/os/energie" onClick={e => e.stopPropagation()} style={{ fontFamily: T.mono, fontSize: 11, color: '#58D9CD', textDecoration: 'none' }}>Energie erhöhen ›</Link>
              </div>
            </div>
          );
        })()}

      </>);
      case 'shields': return (<>
        {/* ── RISK-SHIELDS: Warnungen, bevor es weh tut — nur wenn es welche gibt ── */}
        {shields.length > 0 && (
          <div style={{ ...panel, borderLeft: `3px solid ${shields.some(s => s.stufe === 'rot') ? T.crit : T.amber}`, padding: '10px 16px', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {shields.slice(0, 4).map(s => (
              <Link key={s.id} href={s.href} style={{ display: 'flex', gap: 9, alignItems: 'baseline', textDecoration: 'none', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, color: s.stufe === 'rot' ? T.crit : T.amber, flex: '0 0 auto' }}>●</span>
                <span style={{ fontSize: 12.5, color: T.ink, flex: 1, minWidth: 200 }}>{s.text}</span>
                <span style={{ fontFamily: T.mono, fontSize: 10.5, color: T.accentInk, flex: '0 0 auto' }}>{s.label} ›</span>
              </Link>
            ))}
          </div>
        )}

      </>);
      case 'kopf': return (<>
        {/* KOPF: Fokus jetzt + Tagesstart — halbiert, nebeneinander */}
        <div className="os-kopf" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 12, marginBottom: 18, alignItems: 'stretch' }}>
        {/* FOKUS JETZT — aus den ECHTEN Aufgaben, nicht aus einer Konstante */}
        {(() => {
          const offen = tasksState.tasks.filter(t => t.status !== 'done');
          const heute = localDay();
          const spaet = offen.filter(t => t.dueDate && t.dueDate < heute);
          const krit = offen.filter(t => t.priority === 'critical');
          const top = spaet[0] ?? krit[0] ?? offen.find(t => t.dueDate === heute);
          if (!top) return null;
          const istSpaet = !!top.dueDate && top.dueDate < heute;
          return (
            <Link href="/os/fokus" style={{ ...panel, borderLeft: `3px solid ${istSpaet || top.priority === 'critical' ? T.crit : T.amber}`, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}>
              <span style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: '.16em', color: istSpaet || top.priority === 'critical' ? T.crit : T.amber, textTransform: 'uppercase' }}>◆ Fokus jetzt</span>
              <span style={{ fontSize: 16, fontWeight: 600, color: T.ink }}>{top.title}</span>
              <span style={{ fontSize: 13, color: T.inkDim }}>{istSpaet ? `überfällig seit ${top.dueDate}` : top.dueDate === heute ? 'heute fällig' : `${top.priority} · ${krit.length} kritisch offen`}</span>
              <span style={{ marginLeft: 'auto', fontFamily: T.mono, fontSize: 11, color: T.accent, whiteSpace: 'nowrap' }}>Tag ausrichten →</span>
            </Link>
          );
        })()}
          <Tagesstart />
        </div>

      </>);
      case 'score': return (<>
        {/* MAKE SCORE (halb) + FOKUS & WICHTIGSTE TO-DOS (halb) — über Jarvis */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 12, marginBottom: 18, alignItems: 'stretch' }}>
          <section style={{ ...panel, padding: '20px 22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={lbl}>MAKE Score</span>
              <Link href="/os/performance" style={{ fontFamily: T.mono, fontSize: 9.5, color: T.accentInk, textDecoration: 'none' }}>aufschlüsseln ›</Link>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, margin: '14px 0 14px' }}>
              <div style={{ position: 'relative', width: 84, height: 84, flex: '0 0 auto' }}>
                {/* Atmung hinter dem Ring — der Score lebt */}
                <div className="score-atem" style={{ position: 'absolute', inset: -10, borderRadius: '50%', background: `radial-gradient(circle, ${scoreColor(msi)}30, transparent 70%)`, pointerEvents: 'none' }} />
                <svg width="84" height="84" viewBox="0 0 92 92" style={{ position: 'relative' }}>
                  <circle cx="46" cy="46" r="40" fill="none" stroke="rgba(150,168,162,.14)" strokeWidth="6" />
                  {/* Ring zeichnet sich beim Laden (ring-anim: Übergang auf dashoffset) */}
                  <circle className="ring-anim" cx="46" cy="46" r="40" fill="none" stroke={scoreColor(msi)} strokeWidth="6" strokeLinecap="round"
                    strokeDasharray={(2 * Math.PI * 40).toFixed(1)} strokeDashoffset={(2 * Math.PI * 40 * (1 - msi / 100)).toFixed(1)} transform="rotate(-90 46 46)" />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontFamily: T.mono, fontSize: 24, fontWeight: 600, color: T.ink, lineHeight: 1 }}>{msiAnzeige}</span>
                  <span style={{ fontFamily: T.mono, fontSize: 8, color: T.muted }}>/100</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: scoreColor(msi) }}>{perf?.label ?? '…'}</div>
                {perf && (
                  <div style={{ fontSize: 12, color: T.inkDim, marginTop: 3 }}>
                    Datenbasis <b style={{ color: perf.abdeckung >= 0.6 ? T.accent : T.amber }}>{Math.round(perf.abdeckung * 100)}%</b>
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, borderTop: `1px solid ${T.line}`, paddingTop: 14 }}>
              {(perf?.saeulen ?? []).map(p => (
                <Link key={p.key} href={`/os/saeule/${p.key}`} style={{ textDecoration: 'none', display: 'block' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: T.inkDim }}>
                      {p.label} <span style={{ color: T.muted, fontSize: 10 }}>· {Math.round(p.gewicht * 100)}%</span>
                      {p.zuDuenn && <span style={{ color: T.amber, fontSize: 10 }}> · zu dünn</span>}
                    </span>
                    <span style={{ fontFamily: T.mono, fontSize: 12, color: p.score == null ? T.muted : scoreColor(p.score) }}>{p.score ?? '—'}</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: 'rgba(150,168,162,.12)' }}>
                    <div className="fuell-anim" style={{ width: `${p.score ?? 0}%`, height: '100%', borderRadius: 2, background: p.score == null ? T.muted : scoreColor(p.score), opacity: 0.35 + p.abdeckung * 0.65 }} />
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* Fokus + wichtigste To-dos — die Reihenfolge lenkt der Fokus-Regler */}
          {(() => {
            const rank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
            const boost = (t: { projectId?: string }) => regler[SAEULE_VON_PROJEKT[t.projectId ?? ''] ?? ''] ?? 50;
            const heute = localDay();
            const top = tasksState.tasks
              .filter(t => t.status !== 'done')
              .sort((a, b) =>
                (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9) ||
                boost(b) - boost(a) ||
                (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'))
              .slice(0, 7);
            const bereiche = Object.entries(regler).filter(([, v]) => v >= FOKUS_SCHWELLE);
            return (
              <section style={{ ...panel, borderLeft: `3px solid ${T.accent}`, padding: '20px 22px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span style={lbl}>◎ Fokus</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {(['tag', 'woche', 'monat'] as const).map(h => (
                      <button key={h} onClick={() => setFokusH(h)}
                        style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: '.06em', cursor: 'pointer', borderRadius: 6, padding: '3px 9px', border: `1px solid ${fokusH === h ? T.accent : T.line}`, background: fokusH === h ? `${T.accent}1c` : 'transparent', color: fokusH === h ? T.accentInk : T.muted }}>
                        {h === 'tag' ? 'Tag' : h === 'woche' ? 'Woche' : 'Monat'}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  value={fokus[fokusH] ?? ''}
                  onChange={e => fokusSetzen(fokusH, e.target.value)}
                  placeholder={fokusH === 'tag' ? 'Worauf liegt der Fokus heute?' : fokusH === 'woche' ? 'Worauf liegt der Fokus diese Woche?' : 'Worauf liegt der Fokus diesen Monat?'}
                  style={{ margin: '10px 0 6px', background: 'transparent', border: 'none', outline: 'none', borderBottom: `1px solid ${T.line}`, padding: '2px 0 6px', fontSize: 15, fontWeight: 700, color: T.ink, fontFamily: T.sans, width: '100%' }}
                />
                {bereiche.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                    {bereiche.map(([k, v]) => (
                      <span key={k} style={{ fontSize: 10.5, fontWeight: 600, color: SAEULE_FARBE[k] ?? T.inkDim, border: `1px solid ${SAEULE_FARBE[k] ?? T.line}55`, borderRadius: 6, padding: '2px 7px' }}>{SAEULE_LABEL[k] ?? k} {v}</span>
                    ))}
                  </div>
                )}
                <div style={{ ...lbl, margin: '10px 0 8px' }}>Wichtigste To-dos</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>
                  {top.map(t => {
                    const spaet = !!t.dueDate && t.dueDate < heute;
                    const imFokus = boost(t) >= FOKUS_SCHWELLE;
                    return (
                      <Link key={t.id} href="/os/aufgaben" style={{ display: 'flex', gap: 9, alignItems: 'baseline', textDecoration: 'none' }}>
                        <span style={{ flex: '0 0 auto', fontSize: 11, color: t.priority === 'critical' || spaet ? T.crit : imFokus ? T.accent : T.muted }}>
                          {t.priority === 'critical' ? '‼' : imFokus ? '◎' : '·'}
                        </span>
                        <span style={{ fontSize: 13, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                        {t.dueDate && (
                          <span style={{ marginLeft: 'auto', fontFamily: T.mono, fontSize: 10, color: spaet ? T.crit : t.dueDate === heute ? T.amber : T.muted, flex: '0 0 auto' }}>
                            {spaet ? 'überfällig' : t.dueDate === heute ? 'heute' : `${t.dueDate.slice(8)}.${t.dueDate.slice(5, 7)}.`}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                  {!top.length && <span style={{ fontSize: 12.5, color: T.muted }}>Nichts offen — freie Bahn.</span>}
                </div>
                <div style={{ marginTop: 10, display: 'flex', gap: 14 }}>
                  <Link href="/os/planung" style={{ fontSize: 11.5, color: T.accentInk, textDecoration: 'none' }}>In den Tag ziehen ›</Link>
                  <Link href="/os/aufgaben" style={{ fontSize: 11.5, color: T.accentInk, textDecoration: 'none' }}>Alle Aufgaben ›</Link>
                  <Link href="/os/planung/fokus" style={{ fontSize: 11.5, color: T.accentInk, textDecoration: 'none', marginLeft: 'auto' }}>Regler ›</Link>
                </div>
              </section>
            );
          })()}
        </div>

      </>);
      case 'module': return (<>
        {/* modules */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 12, marginTop: 18 }} className="os-mods">
          {MODULES.map(mRaw => {
            const m = mRaw.dom === 'Performance · Index' && perf?.index != null
              ? { ...mRaw, score: perf.index, val: `Performance-Index ${perf.index}`, sub: `${perf.label} · Datenbasis ${Math.round(perf.abdeckung * 100)}%`, subTone: (perf.index >= 60 ? 'ok' : 'att') as typeof mRaw.subTone }
              : mRaw;
            return (
            <Link key={m.dom} href={m.href ?? '/os'} style={{ ...panel, padding: '16px 17px', display: 'flex', gap: 14, alignItems: 'center', textDecoration: 'none', color: 'inherit', position: 'relative' }}>
              {m.tag && <span style={{ position: 'absolute', top: 13, right: 14, fontFamily: T.mono, fontSize: 8.5, letterSpacing: '.1em', textTransform: 'uppercase', padding: '3px 7px', borderRadius: 5, color: m.tag.tone === 'ok' ? T.accent : T.amber, border: `1px solid ${m.tag.tone === 'ok' ? 'rgba(51,204,156,.28)' : 'rgba(227,162,75,.3)'}` }}>{m.tag.text}</span>}
              {m.score != null
                ? <Gauge value={m.score} />
                : <span style={{ width: 54, height: 54, borderRadius: '50%', flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${T.line}`, background: 'radial-gradient(circle, rgba(33,181,170,.16), transparent 70%)', fontSize: 18 }}>›</span>}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: '.11em', textTransform: 'uppercase', color: T.muted, paddingRight: 54 }}>{m.dom}</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginTop: 5, lineHeight: 1.18 }}>{m.val}</div>
                <div style={{ fontSize: 12, marginTop: 5, lineHeight: 1.4, color: m.subTone === 'crit' ? T.crit : m.subTone === 'att' ? T.amber : T.inkDim }}>{m.sub}</div>
              </div>
            </Link>
            );
          })}
        </div>

      </>);
      case 'system': return (<>
        {/* SO ARBEITET DAS SYSTEM — das Konstrukt hinter allem, jede Stufe klickbar */}
        <div style={{ marginTop: 18 }}>
          <div style={{ ...lbl, marginBottom: 9 }}>So arbeitet MAKE OS</div>
          <div style={{ ...panel, padding: '14px 16px', display: 'flex', alignItems: 'stretch', gap: 0, overflowX: 'auto', marginBottom: 12 }}>
            {([
              { href: '/os/tageslauf', titel: 'Eingang', sub: 'Postfächer, Termine, Aufgaben, Lage — die Kette läuft von selbst', icon: '⇥' },
              { href: '/os/performance', titel: 'Brain', sub: 'eine Kontextschicht, eine Wahrheit — mit Frische je Quelle', icon: '◉' },
              { href: '/os/agenten', titel: 'Jarvis & Agenten', sub: 'dirigiert 7 Abteilungen — Autonomie stellst du ein', icon: '⌘' },
              { href: '/os/aufgaben', titel: 'Handlung', sub: 'Prioritäten werden Aufgaben — per Klick oder autonom', icon: '→' },
              { href: '/os/roadmap', titel: 'Messung & Ausbau', sub: 'ein Score, Loops, Roadmap — das System prüft sich selbst', icon: '↻' },
            ] as const).map((st, i, arr) => (
              <div key={st.titel} style={{ display: 'flex', alignItems: 'stretch', flex: 1, minWidth: 150 }}>
                <Link href={st.href} style={{ flex: 1, textDecoration: 'none', color: 'inherit', padding: '4px 10px', borderRadius: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                    <span style={{ color: T.accent, fontSize: 14 }}>{st.icon}</span>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>{st.titel}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: T.muted, marginTop: 4, lineHeight: 1.4 }}>{st.sub}</div>
                </Link>
                {i < arr.length - 1 && <span style={{ alignSelf: 'center', color: T.line, fontSize: 15, padding: '0 2px', flex: '0 0 auto' }}>›</span>}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
            <Link href="/os/tageslauf" style={{ ...panel, borderLeft: `3px solid ${T.accent}`, padding: '13px 18px', display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'inherit', flex: 2, minWidth: 260 }}>
              <span style={{ fontSize: 18, flex: '0 0 auto' }}>⇥</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>Tageslauf — die feste Kette</div>
                <div style={{ fontSize: 12, color: T.inkDim, marginTop: 2 }}>Läuft beim Öffnen automatisch, danach hält der Taktgeber den Rhythmus.</div>
              </div>
              <span style={{ fontFamily: T.mono, fontSize: 11, color: T.accent, flex: '0 0 auto' }}>öffnen ›</span>
            </Link>
            <Link href="/os/loop" style={{ ...panel, padding: '13px 18px', display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'inherit', flex: 1, minWidth: 200 }}>
              <span style={{ fontSize: 18, flex: '0 0 auto' }}>↻</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>Wochen-Loop & Rückblick</div>
                <div style={{ fontSize: 12, color: T.inkDim, marginTop: 2 }}>Bilanz + Selbstkritik des Systems.</div>
              </div>
            </Link>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 9 }}>
            <div style={{ ...lbl }}>Deine Agenten</div>
            <span style={{ fontFamily: T.mono, fontSize: 10.5, color: T.muted }}>{LIVE_AGENTS.length} live · <Link href="/os/agenten" style={{ color: T.accentInk, textDecoration: 'none' }}>verwalten ›</Link></span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(196px, 1fr))', gap: 8 }}>
            {LIVE_AGENTS.map(a => (
              <Link key={a.id} href={a.href} style={{ ...panel, padding: '11px 13px', textDecoration: 'none', color: 'inherit', display: 'block' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 2, background: a.deptColor, flex: '0 0 auto' }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name.replace('-Agent', '')}</span>
                </div>
                <div style={{ fontSize: 11.5, color: T.muted, marginTop: 3, lineHeight: 1.35 }}>{a.role}</div>
              </Link>
            ))}
          </div>
        </div>

      </>);
      case 'balance': return (<>
        {/* balance: Lebensrad + Agenda */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,1fr)', gap: 18, marginTop: 18, alignItems: 'start' }} className="os-deck">
          <Lebensrad />
          <Agenda />
        </div>

      </>);
      case 'tagesausrichtung': return (<>
        {/* Der TAGESPLAN — groß: links die Ausrichtung, rechts die Aufgaben des Tages */}
        {(() => {
          const heuteT = localDay();
          const tagesTasks = tasksState.tasks
            .filter(t => t.status !== 'done' && ((t.dueDate && t.dueDate <= heuteT) || t.priority === 'critical'))
            .sort((a, b) => ((a.dueDate ?? '9999') < heuteT ? 0 : 1) - ((b.dueDate ?? '9999') < heuteT ? 0 : 1) || (a.priority === 'critical' ? 0 : 1) - (b.priority === 'critical' ? 0 : 1))
            .slice(0, 8);
          return (
            <div style={{ ...panel, borderLeft: `3px solid ${T.accent}`, padding: '20px 24px', marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 12 }}>
                <span style={lbl}>Tagesplan</span>
                {ausricht?.stand && <span style={{ fontFamily: T.mono, fontSize: 10, color: T.muted }}>Lage von {ausricht.stand} Uhr</span>}
                <Link href="/os/planung" style={{ marginLeft: 'auto', fontFamily: T.mono, fontSize: 11, color: T.accentInk, textDecoration: 'none' }}>Tagesplanung ›</Link>
                <Link href="/os/tageslauf" style={{ fontFamily: T.mono, fontSize: 11, color: T.accentInk, textDecoration: 'none' }}>Tageslauf ›</Link>
              </div>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                {/* Links: die Ausrichtung */}
                <div style={{ flex: '1 1 340px', minWidth: 280 }}>
                  {ausricht?.gruss ? (
                    <>
                      <div style={{ fontSize: 15.5, color: T.ink, lineHeight: 1.5, marginBottom: 12 }}>{ausricht.gruss}</div>
                      {(ausricht.prioritaeten ?? []).slice(0, 3).map((pz, i) => (
                        <div key={i} style={{ fontSize: 14, color: T.inkDim, lineHeight: 1.5, padding: '7px 0', borderTop: i ? `1px solid ${T.lineSoft}` : 0 }}>
                          <b style={{ fontFamily: T.mono, fontSize: 12, color: T.accent, marginRight: 8 }}>{i + 1}</b>
                          <b style={{ color: T.ink }}>{pz.titel}</b>{pz.wann ? <span style={{ color: T.muted }}> · {pz.wann}</span> : null}
                        </div>
                      ))}
                      {ausricht.schutz && <div style={{ fontSize: 13, color: '#58D9CD', marginTop: 10 }}>◇ {ausricht.schutz}</div>}
                    </>
                  ) : (
                    <div style={{ fontSize: 13, color: T.muted }}>Noch kein voller Lauf heute — im <Link href="/os/ritual" style={{ color: T.accentInk, textDecoration: 'none' }}>Tagesstart</Link> „Lage ziehen“.</div>
                  )}
                </div>
                {/* Rechts: die Aufgaben des Tages — direkt abhakbar */}
                <div style={{ flex: '1 1 320px', minWidth: 280 }}>
                  <div style={{ ...lbl, marginBottom: 8 }}>Heute zu tun · {tagesTasks.length}</div>
                  {tagesTasks.length ? tagesTasks.map((t, i) => {
                    const spaet = !!t.dueDate && t.dueDate < heuteT;
                    return (
                      <div key={t.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '6px 0', borderTop: i ? `1px solid ${T.lineSoft}` : 0 }}>
                        <button onClick={() => tasksDispatch({ type: 'TOGGLE_TASK', payload: { id: t.id } })} aria-label="Erledigen"
                          style={{ width: 18, height: 18, borderRadius: 6, flex: '0 0 auto', marginTop: 2, cursor: 'pointer', border: `1.6px solid ${T.muted}`, background: 'transparent' }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.35 }}>{t.priority === 'critical' ? <span style={{ color: T.crit }}>‼ </span> : ''}{t.title}</div>
                          <div style={{ fontFamily: T.mono, fontSize: 10, color: spaet ? T.crit : T.muted, marginTop: 2 }}>
                            {spaet ? `überfällig seit ${t.dueDate!.slice(8)}.${t.dueDate!.slice(5, 7)}.` : t.dueDate === heuteT ? 'heute fällig' : 'kritisch'}
                          </div>
                        </div>
                      </div>
                    );
                  }) : <div style={{ fontSize: 13, color: T.muted }}>Nichts fällig, nichts kritisch — freie Bahn.</div>}
                </div>
              </div>
            </div>
          );
        })()}
      </>);
      case 'zeitstrahl': return (<>
        {/* Die nächsten 30 Tage als Linie — Meilensteine + fällige Aufgaben */}
        {(() => {
          const p2 = (n: number) => String(n).padStart(2, '0');
          const von = localDay();
          const tag = (offset: number) => {
            const d = new Date();
            d.setDate(d.getDate() + offset);
            return { iso: `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`, label: `${d.getDate()}.${d.getMonth() + 1}.` };
          };
          const bis = tag(30).iso;
          const ticks = [7, 14, 21, 28].map(o => { const t = tag(o); return { date: t.iso, label: t.label }; });
          const marker: StrahlMarker[] = msAlle
            .filter(m => !m.erledigt && m.faellig)
            .map(m => ({ date: m.faellig!, label: m.titel, farbe: m.bereich === 'gesundheit' ? '#58D9CD' : T.amber, symbol: '◇', href: '/os/planung/jahr' }));
          const proTag: Record<string, string[]> = {};
          tasksState.tasks
            .filter(t => t.status !== 'done' && t.dueDate && t.dueDate >= von && t.dueDate <= bis)
            .forEach(t => { proTag[t.dueDate!] = [...(proTag[t.dueDate!] ?? []), t.title]; });
          Object.keys(proTag).forEach(d => {
            const titel = proTag[d];
            marker.push({ date: d, label: titel.length === 1 ? titel[0] : `${titel.length} Aufgaben`, farbe: T.inkDim, symbol: '●', titel: titel.join(' · '), href: '/os/aufgaben' });
          });
          return (
            <div style={{ marginBottom: 2 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', marginBottom: 6 }}>
                <span style={lbl}>Zeitstrahl · 30 Tage</span>
                <Link href="/os/planung/monat" style={{ marginLeft: 'auto', fontFamily: T.mono, fontSize: 11, color: T.accentInk, textDecoration: 'none' }}>Planung ›</Link>
              </div>
              <Zeitstrahl von={von} bis={bis} ticks={ticks} marker={marker} />
            </div>
          );
        })()}
      </>);
      case 'forecast': return (<>
        {/* Forecast wie in der Planung: Zeit vs. Fortschritt, deterministisch */}
        {(() => {
          const jetzt = Date.now();
          const rechne = (h: 'monat' | 'quartal' | 'jahr') => {
            const d = new Date();
            const j = d.getFullYear();
            let von: Date, bis: Date, label: string;
            if (h === 'monat') { von = new Date(j, d.getMonth(), 1); bis = new Date(j, d.getMonth() + 1, 0); label = d.toLocaleDateString('de-DE', { month: 'long' }); }
            else if (h === 'quartal') { const q = Math.floor(d.getMonth() / 3); von = new Date(j, q * 3, 1); bis = new Date(j, q * 3 + 3, 0); label = `Q${q + 1}`; }
            else { von = new Date(j, 0, 1); bis = new Date(j, 11, 31); label = String(j); }
            const verstrichen = Math.max(0, Math.min(100, Math.round(((jetzt - von.getTime()) / (bis.getTime() - von.getTime())) * 100)));
            const liste = zieleAlle[h].filter(z => !z.erledigt);
            const schnitt = liste.length ? Math.round(liste.reduce((s, z) => s + (z.fortschritt || 0), 0) / liste.length) : null;
            const prognose = schnitt != null && verstrichen > 5 ? Math.min(150, Math.round((schnitt / verstrichen) * 100)) : null;
            return { h, label, verstrichen, schnitt, prognose, anzahl: liste.length };
          };
          const zeilen = (['monat', 'quartal', 'jahr'] as const).map(rechne);
          return (
            <div style={{ ...panel, padding: '16px 20px', marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', marginBottom: 10 }}>
                <span style={lbl}>Forecast</span>
                <Link href="/os/planung/monat" style={{ marginLeft: 'auto', fontFamily: T.mono, fontSize: 11, color: T.accentInk, textDecoration: 'none' }}>Planung ›</Link>
              </div>
              {zeilen.map(z => (
                <div key={z.h} style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap', padding: '7px 0', borderTop: z.h !== 'monat' ? `1px solid ${T.lineSoft}` : 0 }}>
                  <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, width: 64, textTransform: 'uppercase', letterSpacing: '.08em' }}>{z.label}</span>
                  {z.schnitt != null && z.prognose != null ? (
                    <>
                      <span style={{ fontSize: 12.5, color: T.inkDim }}>{z.verstrichen}% der Zeit · Ziele Ø {z.schnitt}%</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: z.prognose >= 95 ? T.accent : z.prognose >= 70 ? T.amber : T.crit }}>
                        → ~{z.prognose}% am Ende{z.prognose < 95 ? ' — nachschärfen' : ' — Kurs hält'}
                      </span>
                    </>
                  ) : (
                    <span style={{ fontSize: 12.5, color: T.muted }}>{z.anzahl ? 'zu früh für eine Prognose' : 'keine Ziele gepflegt'}</span>
                  )}
                </div>
              ))}
            </div>
          );
        })()}
      </>);
      default: return null;
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: T.void, color: T.ink, fontFamily: T.sans, position: 'relative', overflowX: 'hidden' }}>
      <div style={{ position: 'fixed', top: '-20vh', left: '50%', transform: 'translateX(-50%)', width: '80vw', height: '60vh', background: 'radial-gradient(ellipse,rgba(33,181,170,.06),transparent 68%)', filter: 'blur(60px)', pointerEvents: 'none', zIndex: 0 }} />
      <div className={intro ? 'stagger' : undefined} style={{ position: 'relative', zIndex: 2, maxWidth: 1300, margin: '0 auto', padding: '28px clamp(16px,3vw,40px) 56px' }}>

        {/* top bar */}
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 26, height: 26, borderRadius: '50%', border: `1.5px solid ${T.accent}`, position: 'relative' }}>
              <div style={{ position: 'absolute', inset: 7, borderRadius: '50%', background: T.accent }} />
            </div>
            <div style={{ fontWeight: 500, letterSpacing: '.3em', fontSize: 14 }}>MAKE OS <span style={{ color: T.muted, fontWeight: 400 }}>· DASHBOARD</span></div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontFamily: T.mono, fontSize: 11, color: T.muted, letterSpacing: '.06em' }}>
            <button onClick={() => setBearbeiten(b => !b)} title="Widgets ein-/ausblenden und umsortieren"
              style={{ cursor: 'pointer', fontFamily: T.mono, fontSize: 10.5, letterSpacing: '.06em', borderRadius: 7, padding: '4px 10px', border: `1px solid ${bearbeiten ? T.accent : T.line}`, background: bearbeiten ? `${T.accent}1c` : 'transparent', color: bearbeiten ? T.accentInk : T.muted }}>
              {bearbeiten ? '✓ Fertig' : '⚙ Anpassen'}
            </button>
            <button onClick={gesundZeitToggle} title={gesundZeit?.an ? 'Gesundheits-Zeit stoppen' : 'Gesundheits-Zeit starten — Reha, Bewegung, Erholung'}
              style={{ cursor: 'pointer', fontFamily: T.mono, fontSize: 10.5, letterSpacing: '.06em', borderRadius: 7, padding: '4px 10px', border: `1px solid ${gesundZeit?.an ? '#58D9CD' : T.line}`, background: gesundZeit?.an ? 'rgba(88,217,205,.12)' : 'transparent', color: gesundZeit?.an ? '#58D9CD' : T.muted }}>
              {gesundZeit?.an ? `♥ läuft seit ${gesundZeit.seit}` : '♥'}{gesundZeit && gesundZeit.aktivMin > 0 ? ` · ${(gesundZeit.aktivMin / 60).toFixed(1).replace('.', ',')} h` : ''}
            </button>
            <button onClick={modusToggle} title={modus?.an ? 'Ausloggen — beendet die Arbeits-Session' : 'Anmelden — startet die Arbeits-Session'}
              style={{ cursor: 'pointer', fontFamily: T.mono, fontSize: 10.5, letterSpacing: '.06em', borderRadius: 7, padding: '4px 10px', border: `1px solid ${modus?.an ? T.accent : T.line}`, background: modus?.an ? `${T.accent}1c` : 'transparent', color: modus?.an ? T.accentInk : T.muted }}>
              {modus?.an ? `⏻ seit ${modus.seit}` : '⏻'}{modus && modus.aktivMin > 0 ? ` · ${(modus.aktivMin / 60).toFixed(1).replace('.', ',')} h` : ''}
            </button>
            <span><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: T.accent, marginRight: 7 }} /><span style={{ color: T.accent }}>JARVIS · ONLINE</span></span>
            <span style={{ color: T.ink, fontVariantNumeric: 'tabular-nums' }}>{clock}</span>
          </div>
        </header>

        {/* ── WIDGET-BOARD: 2 Sekunden halten → bearbeiten, dann frei ziehen ── */}
        {aktuellBoard.filter(id => WIDGET_LABEL[id]).map(id => (
          <div key={id}
            onPointerDown={druckStart} onPointerUp={druckEnde} onPointerLeave={druckEnde} onPointerMove={druckBewegt}
            draggable={bearbeiten}
            onDragStart={() => { zieheWidget.current = id; }}
            onDragOver={e => { if (bearbeiten) { e.preventDefault(); dragUeber(id); } }}
            onDragEnd={dragFertig}
            onDrop={e => e.preventDefault()}
            style={bearbeiten ? { border: `1px dashed ${zieheWidget.current === id ? T.accent : 'rgba(33,181,170,.4)'}`, borderRadius: 18, padding: '10px 10px 2px', marginBottom: 14, cursor: 'grab' } : undefined}>
            {bearbeiten && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '0 4px 10px' }}>
                <span style={{ fontFamily: T.mono, fontSize: 12, color: T.muted, cursor: 'grab' }}>⠿</span>
                <span style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: T.accent }}>{WIDGET_LABEL[id]}</span>
                <span style={{ fontFamily: T.mono, fontSize: 9.5, color: T.muted }}>ziehen zum Sortieren</span>
                <button onClick={() => boardSpeichern(aktuellBoard.filter(x => x !== id))} title="Nur vom Dashboard nehmen — bleibt in seiner Abteilung"
                  style={{ ...wbtn, marginLeft: 'auto', color: T.crit, borderColor: `${T.crit}55` }}>✕</button>
              </div>
            )}
            {renderWidget(id)}
          </div>
        ))}
        {bearbeiten && verborgen.length > 0 && (
          <div style={{ background: T.panel, border: `1px dashed ${T.line}`, borderRadius: 14, padding: '12px 16px', marginBottom: 14 }}>
            <div style={{ ...lbl, marginBottom: 8 }}>Ausgeblendet — anklicken holt es aufs Board</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {verborgen.map(id => (
                <button key={id} onClick={() => boardSpeichern([...aktuellBoard, id])} style={{ fontFamily: T.sans, fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8, border: `1px solid ${T.accent}`, background: 'rgba(33,181,170,.1)', color: T.accentInk, cursor: 'pointer' }}>+ {WIDGET_LABEL[id]}</button>
              ))}
            </div>
          </div>
        )}
        <div style={{ marginTop: 24, textAlign: 'center', fontFamily: T.mono, fontSize: 10, letterSpacing: '.1em', color: T.muted }}>
          MAKE OS · GRUNDGERÜST — <span style={{ color: T.inkDim }}>MAKE steuert dein Leben &amp; beide Firmen. Du gewinnst Zeit für Gesundheit &amp; Mindset.</span>
        </div>
      </div>

      <style>{`
        @media (max-width:960px){ .os-deck{grid-template-columns:1fr !important} .os-mods{grid-template-columns:1fr 1fr !important} }
        @media (max-width:560px){ .os-mods{grid-template-columns:1fr !important} }
      `}</style>
    </div>
  );
}
