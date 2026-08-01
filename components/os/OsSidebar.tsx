'use client';

import Link from 'next/link';
// ─── MAKE OS — Seitenleiste (die Software-Navigation) ───────────────────────
// Kevins Ordnung: MAKE OS · MAKE Score · Ausführung & Tasks · Planung ·
// Gesundheit · Agenten & Wachstum. JEDE Gruppe ist einklappbar — sichtbar ist
// nur, was du gerade brauchst; der Zustand überlebt den Neustart.
// Darunter Favoriten + „Brennt gerade". ⌘K bleibt der Schnellweg.

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { THEME as T } from '@/lib/make-one/os-data';
import { LIVE_AGENTS } from '@/lib/make-one/agents-data';
import { useTasks } from '@/context/TasksContext';
import { localDay } from '@/lib/zeit';

interface Eintrag { href: string; label: string; hint?: string }
interface Gruppe { titel: string; eintraege: Eintrag[] }

const GRUPPEN: Gruppe[] = [
  {
    titel: 'MAKE OS',
    eintraege: [
      { href: '/os', label: 'Dashboard' },
      { href: '/os/planung', label: 'Tag' },
      { href: '/os/inbox', label: 'Inbox' },
      { href: '/os/kompass', label: 'Kompass' },
    ],
  },
  {
    titel: 'MAKE Score',
    eintraege: [
      { href: '/os/performance', label: 'Der Score' },
      { href: '/os/saeule/health', label: 'Gesundheit & Energie' },
      { href: '/os/saeule/business', label: 'Business-Performance' },
      { href: '/os/saeule/planning', label: 'Planung & Execution' },
      { href: '/os/saeule/finance', label: 'Finanzen' },
      { href: '/os/saeule/social', label: 'Beziehung & Team' },
    ],
  },
  {
    titel: 'Gesundheit',
    eintraege: [
      { href: '/os/ritual', label: 'Tagesstart' },
      { href: '/os/ritual?modus=abend', label: 'Tagesende' },
      { href: '/os/gesundheit', label: 'Cockpit' },
      { href: '/os/energie', label: 'Energie erhöhen' },
      { href: '/os/ernaehrung', label: 'Ernährung' },
      { href: '/os/journal', label: 'Journal' },
      { href: '/os/woche', label: 'Wochen-Rhythmus' },
    ],
  },
  {
    titel: 'Ausführung & Tasks',
    eintraege: [
      { href: '/os/aufgaben', label: 'Taskmanagement' },
      { href: '/os/meeting', label: 'Meeting → Aufgaben' },
    ],
  },
  {
    titel: 'Planung',
    eintraege: [
      { href: '/os/planung/woche', label: 'Wochenplaner' },
      { href: '/os/planung/monat', label: 'Monat' },
      { href: '/os/planung/quartal', label: 'Quartal' },
      { href: '/os/planung/jahr', label: 'Jahr & Ziele' },
      { href: '/os/planung/routinen', label: 'Routinen' },
      { href: '/os/tageslauf', label: 'Tageslauf' },
      { href: '/os/planung/fokus', label: 'Fokus-Regler' },
      { href: '/os/loop', label: 'Loops' },
    ],
  },
  {
    titel: 'Finanzen',
    eintraege: [
      { href: '/os/finanzen', label: 'Finanzplanung' },
      { href: '/os/controlling', label: 'Controlling' },
    ],
  },
  {
    titel: 'Datenbasis',
    eintraege: [
      { href: '/os/datenbasis', label: 'Zentrale' },
      { href: '/os/verbindungen', label: 'Verbindungen' },
    ],
  },
  {
    titel: 'Agenten & Wachstum',
    eintraege: [
      { href: '/os/agenten', label: 'Agentensystem' },
      { href: '/os/netzwerk', label: 'Netzwerk & Pipeline' },
      { href: '/os/crm', label: 'CRM & Kunden' },
      { href: '/os/roadmap', label: 'Roadmap' },
      { href: '/os/bauplan', label: 'Bauplan' },
    ],
  },
];

const FAVORITEN: Eintrag[] = [
  { href: '/os/kalender', label: 'Kalender' },
  { href: '/os/research', label: 'Research' },
  { href: '/os/content', label: 'Content' },
  { href: '/os/prospecting', label: 'Zielliste' },
];

const MERKER = 'make-os-sidebar-zu';

function paletteZiele(): { href: string; label: string; group: string; hint?: string }[] {
  return [
    ...GRUPPEN.flatMap(g => g.eintraege.map(e => ({ href: e.href, label: `${g.titel} · ${e.label}`, group: g.titel, hint: e.hint }))),
    ...LIVE_AGENTS.map(a => ({ href: a.href, label: a.name, group: 'Agent', hint: a.role })),
  ];
}

export function OsSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { state: tasksState } = useTasks();

  const [mobilOffen, setMobilOffen] = useState(false);
  const [zu, setZu] = useState<Record<string, boolean>>({});
  const [geladen, setGeladen] = useState(false);
  const [palette, setPalette] = useState(false);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Zugeklappt-Zustand laden; Standard: alles zu AUSSER „MAKE OS" und der
  // Gruppe, in der du gerade bist. So stehen nie 20 Zeilen untereinander.
  useEffect(() => {
    let gespeichert: Record<string, boolean> | null = null;
    try { gespeichert = JSON.parse(localStorage.getItem(MERKER) ?? 'null'); } catch { /* egal */ }
    if (gespeichert && typeof gespeichert === 'object') {
      setZu(gespeichert);
    } else {
      const start: Record<string, boolean> = {};
      for (const g of GRUPPEN) start[g.titel] = g.titel !== 'MAKE OS';
      setZu(start);
    }
    setGeladen(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Aktive Gruppe immer sichtbar — auch wenn sie zugeklappt gespeichert war.
  const aktiveGruppe = useMemo(
    () => GRUPPEN.find(g => g.eintraege.some(e => (e.href === '/os' ? pathname === '/os' : pathname.startsWith(e.href))))?.titel,
    [pathname]
  );

  function klappe(titel: string) {
    setZu(prev => {
      const next = { ...prev, [titel]: !prev[titel] };
      try { localStorage.setItem(MERKER, JSON.stringify(next)); } catch { /* egal */ }
      return next;
    });
  }

  const brennt = useMemo(() => {
    const heute = localDay();
    const offen = tasksState.tasks.filter(t => t.status !== 'done');
    const spaet = offen.filter(t => t.dueDate && t.dueDate < heute);
    const krit = offen.filter(t => t.priority === 'critical' && !spaet.includes(t));
    return [...spaet, ...krit].slice(0, 3);
  }, [tasksState]);

  const ziele = useMemo(paletteZiele, []);
  const treffer = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return ziele;
    return ziele.filter(t => `${t.label} ${t.hint ?? ''} ${t.href}`.toLowerCase().includes(s));
  }, [q, ziele]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette(p => !p); setQ(''); setSel(0); }
      else if (e.key === 'Escape') { setPalette(false); setMobilOffen(false); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => { if (palette) setTimeout(() => inputRef.current?.focus(), 30); }, [palette]);
  useEffect(() => { setMobilOffen(false); }, [pathname]);

  const aktiv = (href: string) => (href === '/os' ? pathname === '/os' : pathname.startsWith(href));

  const inhalt = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', padding: '14px 10px 18px' }}>
      <Link href="/os" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none', padding: '4px 10px 14px' }}>
        <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'radial-gradient(circle, #BFF5EF, #21B5AA 55%, rgba(33,181,170,.2))', flex: '0 0 auto' }} />
        <span style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 700, letterSpacing: '.14em', color: T.ink }}>MAKE OS</span>
      </Link>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        {GRUPPEN.map(g => {
          const offenJetzt = geladen && (!zu[g.titel] || g.titel === aktiveGruppe);
          const enthaeltAktiv = g.titel === aktiveGruppe;
          return (
            <div key={g.titel}>
              <button
                onClick={() => klappe(g.titel)}
                style={{
                  width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: 'transparent', border: 'none', cursor: 'pointer', padding: '7px 10px', borderRadius: 8,
                  fontFamily: T.mono, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase',
                  color: enthaeltAktiv ? T.accent : T.muted,
                }}
              >
                <span>{g.titel}</span>
                <span style={{ fontSize: 11 }}>{offenJetzt ? '▾' : '▸'}</span>
              </button>
              {offenJetzt && g.eintraege.map(e => (
                <Link key={e.href} href={e.href} className={aktiv(e.href) ? 'sb-aktiv' : undefined} style={{
                  display: 'block', textDecoration: 'none', padding: '6px 10px 6px 16px', borderRadius: 8, marginBottom: 1,
                  background: aktiv(e.href) ? 'rgba(33,181,170,.13)' : 'transparent',
                  borderLeft: `2px solid ${aktiv(e.href) ? T.accent : 'transparent'}`,
                }}>
                  <span style={{ fontSize: 13, fontWeight: aktiv(e.href) ? 700 : 500, color: aktiv(e.href) ? T.accent : T.inkDim }}>{e.label}</span>
                  {e.hint && <span style={{ fontSize: 10.5, color: T.muted, marginLeft: 7 }}>{e.hint}</span>}
                </Link>
              ))}
            </div>
          );
        })}
      </nav>

      <div style={{ borderTop: `1px solid ${T.lineSoft}`, paddingTop: 12, marginTop: 12 }}>
        <div style={{ fontFamily: T.mono, fontSize: 9.5, letterSpacing: '.16em', textTransform: 'uppercase', color: T.muted, padding: '0 10px 7px' }}>Favoriten</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, padding: '0 8px' }}>
          {FAVORITEN.map(f => (
            <Link key={f.href} href={f.href} style={{ fontSize: 11.5, color: aktiv(f.href) ? T.accent : T.inkDim, textDecoration: 'none', border: `1px solid ${T.line}`, borderRadius: 7, padding: '4px 9px' }}>{f.label}</Link>
          ))}
        </div>
      </div>

      {brennt.length > 0 && (
        <div style={{ borderTop: `1px solid ${T.lineSoft}`, paddingTop: 12, marginTop: 12 }}>
          <div style={{ fontFamily: T.mono, fontSize: 9.5, letterSpacing: '.16em', textTransform: 'uppercase', color: T.amber, padding: '0 10px 7px' }}>Brennt gerade</div>
          {brennt.map(t => (
            <Link key={t.id} href="/os/aufgaben" style={{ display: 'block', textDecoration: 'none', padding: '5px 10px' }}>
              <span style={{ fontSize: 12, color: T.inkDim, lineHeight: 1.35, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <span style={{ color: t.dueDate && t.dueDate < localDay() ? T.crit : T.amber }}>●</span> {t.title}
              </span>
            </Link>
          ))}
        </div>
      )}

      <button onClick={() => { setPalette(true); setQ(''); setSel(0); }} style={{ margin: '14px 8px 0', fontFamily: T.mono, fontSize: 11, color: T.muted, background: 'transparent', border: `1px solid ${T.line}`, borderRadius: 8, padding: '8px 10px', cursor: 'pointer', textAlign: 'left' }}>
        ⌘K Springen …
      </button>
    </div>
  );

  return (
    <>
      <aside className="os-sidebar-desktop" style={{ width: 232, flex: '0 0 auto', borderRight: `1px solid ${T.line}`, background: T.panel, height: '100vh', position: 'sticky', top: 0 }}>
        {inhalt}
      </aside>

      <div className="os-sidebar-mobilbar" style={{ display: 'none', position: 'sticky', top: 0, zIndex: 40, background: T.panel, borderBottom: `1px solid ${T.line}`, padding: '10px 14px', alignItems: 'center', gap: 12 }}>
        <button onClick={() => setMobilOffen(true)} aria-label="Menü" style={{ background: 'transparent', border: `1px solid ${T.line}`, borderRadius: 8, color: T.ink, fontSize: 16, padding: '4px 10px', cursor: 'pointer' }}>☰</button>
        <Link href="/os" style={{ fontFamily: T.mono, fontSize: 12.5, fontWeight: 700, letterSpacing: '.14em', color: T.ink, textDecoration: 'none' }}>MAKE OS</Link>
      </div>
      {mobilOffen && (
        <div onClick={() => setMobilOffen(false)} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,.55)' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 262, height: '100%', background: T.panel, borderRight: `1px solid ${T.line}` }}>
            {inhalt}
          </div>
        </div>
      )}

      {palette && (
        <div onClick={() => setPalette(false)} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '14vh' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 'min(560px, 92vw)', background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14, overflow: 'hidden' }}>
            <input
              ref={inputRef} value={q}
              onChange={e => { setQ(e.target.value); setSel(0); }}
              onKeyDown={e => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s + 1, treffer.length - 1)); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(s - 1, 0)); }
                else if (e.key === 'Enter' && treffer[sel]) { setPalette(false); router.push(treffer[sel].href); }
              }}
              placeholder="Wohin, Sir? (Bereich oder Agent tippen)"
              style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: T.ink, fontFamily: T.sans, fontSize: 15, padding: '14px 16px', borderBottom: `1px solid ${T.line}` }}
            />
            <div style={{ maxHeight: '46vh', overflowY: 'auto', padding: 6 }}>
              {treffer.slice(0, 14).map((t, i) => (
                <div key={t.href + i} onClick={() => { setPalette(false); router.push(t.href); }} onMouseEnter={() => setSel(i)}
                  style={{ display: 'flex', gap: 10, alignItems: 'baseline', padding: '9px 12px', borderRadius: 9, cursor: 'pointer', background: i === sel ? 'rgba(33,181,170,.14)' : 'transparent' }}>
                  <span style={{ fontFamily: T.mono, fontSize: 9, color: T.muted, width: 92, flex: '0 0 auto', textTransform: 'uppercase', letterSpacing: '.06em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.group}</span>
                  <span style={{ fontSize: 13.5, color: i === sel ? T.accent : T.ink }}>{t.label}</span>
                  {t.hint && <span style={{ fontSize: 11, color: T.muted }}>{t.hint}</span>}
                </div>
              ))}
              {!treffer.length && <div style={{ padding: '14px 16px', fontSize: 13, color: T.muted }}>Nichts gefunden.</div>}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 900px) {
          .os-sidebar-desktop { display: none !important; }
          .os-sidebar-mobilbar { display: flex !important; }
          .os-shell { flex-direction: column !important; }
          .os-shell > main { height: auto !important; min-height: calc(100vh - 49px); }
        }
      `}</style>
    </>
  );
}
