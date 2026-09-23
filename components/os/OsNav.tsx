'use client';

import Link from 'next/link';
// ─── MAKE OS — globale Navigation + Schnellzugriff (Cmd/Ctrl+K) ─────────────
// Auf JEDER /os-Route erreichbar: alle Agenten, alle Bereiche, ein Sprung.

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { THEME as T } from '@/lib/make-one/os-data';
import { LIVE_AGENTS } from '@/lib/make-one/agents-data';

interface Target { href: string; label: string; group: string; hint?: string }

const BEREICHE: Target[] = [
  { href: '/os', label: 'Übersicht', group: 'Bereich' },
  { href: '/os/tageslauf', label: 'Tageslauf · die feste Kette', group: 'Bereich', hint: 'jeden Tag gleich' },
  { href: '/os/loop', label: 'Loops · Morgen / Woche / Rückblick', group: 'Bereich', hint: 'der Takt' },
  { href: '/os/inbox', label: 'Inbox', group: 'Bereich' },
  { href: '/os/aufgaben', label: 'Aufgaben', group: 'Bereich' },
  { href: '/os/planung', label: 'Planung', group: 'Bereich' },
  { href: '/os/woche', label: 'Woche', group: 'Bereich' },
  { href: '/os/gesundheit', label: 'Gesundheit', group: 'Bereich' },
  { href: '/os/journal', label: 'Journal', group: 'Bereich' },
  { href: '/os/performance', label: 'Performance-Index', group: 'Bereich', hint: 'wo du stehst' },
  { href: '/os/saeule/health', label: 'Gesundheit & Energie', group: 'Säule', hint: 'Recovery, Schlaf, Routinen' },
  { href: '/os/saeule/business', label: 'Business-Performance', group: 'Säule', hint: 'Umsatz-Kurs, Pipeline' },
  { href: '/os/saeule/planning', label: 'Planung & Execution', group: 'Säule', hint: 'was jetzt brennt' },
  { href: '/os/saeule/finance', label: 'Finanzen', group: 'Säule', hint: 'Runway, Gewinn' },
  { href: '/os/saeule/social', label: 'Beziehung & Team', group: 'Säule', hint: 'Rituale, Delegation' },
  { href: '/os/agenten', label: 'Agenten verwalten', group: 'Bereich' },
  { href: '/os/roadmap', label: 'Roadmap · der Fahrplan', group: 'Bereich', hint: 'sieben Phasen' },
  { href: '/os/bauplan', label: 'Bauplan · was wir noch bauen', group: 'Bereich', hint: 'System-Backlog' },
];

export function OsNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const targets: Target[] = useMemo(() => [
    ...BEREICHE,
    ...LIVE_AGENTS.map(a => ({ href: a.href, label: `${a.name}`, group: 'Agent', hint: a.role })),
  ], []);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return targets;
    return targets.filter(t => `${t.label} ${t.hint ?? ''} ${t.href}`.toLowerCase().includes(s));
  }, [q, targets]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(o => !o); setQ(''); setSel(0); }
      else if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 30); }, [open]);

  function go(href: string) { setOpen(false); router.push(href); }

  const isActive = (href: string) => (href === '/os' ? pathname === '/os' : pathname?.startsWith(href));

  return (
    <>
      {/* Topbar */}
      <div style={{ position: 'sticky', top: 0, zIndex: 40, background: 'rgba(11,14,16,.86)', backdropFilter: 'blur(10px)', borderBottom: `1px solid ${T.lineSoft}` }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '9px clamp(14px,3vw,30px)', display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link href="/os" style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 700, letterSpacing: '.12em', color: T.accent, textDecoration: 'none', flex: '0 0 auto' }}>MAKE</Link>
          <div style={{ display: 'flex', gap: 4, overflowX: 'auto', flex: 1, scrollbarWidth: 'none' }}>
            {[{ href: '/os/tageslauf', label: 'Tageslauf' }, { href: '/os/loop', label: 'Loops' }, { href: '/os/inbox', label: 'Inbox' }, { href: '/os/aufgaben', label: 'Aufgaben' }, { href: '/os/woche', label: 'Woche' }, { href: '/os/gesundheit', label: 'Gesundheit' }, { href: '/os/performance', label: 'Index' }, { href: '/os/agenten', label: 'Agenten' }, { href: '/os/roadmap', label: 'Roadmap' }].map(n => (
              <Link key={n.href} href={n.href} style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: '.05em', textDecoration: 'none', whiteSpace: 'nowrap', padding: '4px 9px', borderRadius: 7, color: isActive(n.href) ? T.accent : T.muted, background: isActive(n.href) ? T.accentSoft : 'transparent' }}>{n.label}</Link>
            ))}
          </div>
          <button onClick={() => { setOpen(true); setQ(''); setSel(0); }} style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, background: 'transparent', border: `1px solid ${T.line}`, borderRadius: 7, padding: '4px 9px', cursor: 'pointer', flex: '0 0 auto', whiteSpace: 'nowrap' }}>⌘K Springen</button>
        </div>
      </div>

      {/* Schnellzugriff */}
      {open && (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '12vh' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 'min(620px, 92vw)', background: 'linear-gradient(165deg, #1A2024 0%, #12171A 100%)', border: 'none', borderRadius: 20, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06), 0 12px 32px rgba(0,0,0,.35)', overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,.5)' }}>
            <input
              ref={inputRef}
              value={q}
              onChange={e => { setQ(e.target.value); setSel(0); }}
              onKeyDown={e => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s + 1, results.length - 1)); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(s - 1, 0)); }
                else if (e.key === 'Enter' && results[sel]) { e.preventDefault(); go(results[sel].href); }
              }}
              placeholder="Wohin? Agent, Bereich, Loop …"
              style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: `1px solid ${T.line}`, color: T.ink, fontFamily: T.sans, fontSize: 15, padding: '14px 18px', outline: 'none' }}
            />
            <div style={{ maxHeight: '52vh', overflowY: 'auto' }}>
              {results.length === 0 && <div style={{ padding: '16px 18px', color: T.muted, fontSize: 13 }}>Nichts gefunden.</div>}
              {results.map((r, i) => (
                <div key={r.href + r.label} onMouseEnter={() => setSel(i)} onClick={() => go(r.href)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', cursor: 'pointer', background: i === sel ? T.accentSoft : 'transparent', borderLeft: `2px solid ${i === sel ? T.accent : 'transparent'}` }}>
                  <span style={{ fontFamily: T.mono, fontSize: 11, color: r.group === 'Agent' ? T.accentInk : T.muted, width: 46, flex: '0 0 auto', textTransform: 'uppercase', letterSpacing: '.08em' }}>{r.group}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, color: T.ink }}>{r.label}</div>
                    {r.hint && <div style={{ fontSize: 11.5, color: T.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.hint}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
