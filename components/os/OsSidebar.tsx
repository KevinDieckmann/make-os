'use client';

import Link from 'next/link';
// ─── MAKE OS — Seitenleiste (Bereichs-Modus) ────────────────────────────────
// Kevins Ansage: „Das ist mittlerweile sehr voll geworden — ich möchte das
// Ganze mehr mit Klarheit, besser klickbar." Vorbild: KEMARIS Operations.
//
// Wer in einem Bereich arbeitet, sieht NUR dessen Punkte — nicht die Navigation
// aller sieben Bereiche gleichzeitig. Außerhalb (Startfläche, Heute, Inbox)
// steht die Bereichsauswahl. Einklappbar auf eine Symbolspalte. Darunter
// bleiben „Brennt gerade" und ⌘K, weil beides täglich gebraucht wird.

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, PanelLeftClose, PanelLeftOpen, type LucideIcon } from 'lucide-react';
import { THEME as T } from '@/lib/make-one/os-data';
import { Anwesenheit } from './Anwesenheit';
import { LIVE_AGENTS } from '@/lib/make-one/agents-data';
import { useTasks } from '@/context/TasksContext';
import { localDay } from '@/lib/zeit';
import { ALLE_SEITEN, BEREICHE, EINSTIEGE, bereichFuerPfad, bereicheFuer, type Modus } from '@/lib/make-one/bereiche';

const MERKER_ZU = 'make-os-sidebar-schmal';

/** Dieselben Stufen wie im Score selbst — keine zweite Wahrheit. */
const scoreFarbe = (v: number | null) => v == null ? T.muted : v >= 70 ? T.accent : v >= 50 ? T.accentInk : v >= 30 ? T.amber : T.crit;

function paletteZiele(): { href: string; label: string; group: string; hint?: string }[] {
  return [
    ...ALLE_SEITEN.map(s => ({ href: s.href, label: s.label, group: s.bereich, hint: s.hinweis })),
    ...LIVE_AGENTS.map(a => ({ href: a.href, label: a.name, group: 'Agent', hint: a.role })),
  ];
}

export function OsSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { state: tasksState } = useTasks();

  const bereich = useMemo(() => bereichFuerPfad(pathname), [pathname]);

  // In welchem Leben — steuert, was in der Navigation steht. Eine Sache
  // dieses Rechners (localStorage). WER da ist, entscheidet seit 23.09. die
  // Anmeldung, nicht mehr ein Schalter: das Konto kommt vom Server.
  const [modus, setModus] = useState<Modus>('alles');
  const [konto, setKonto] = useState<{ speicher: string; name: string; rolle: string } | null>(null);
  useEffect(() => {
    try {
      const m = localStorage.getItem('make-os-modus');
      if (m === 'alles' || m === 'business' || m === 'privat') setModus(m);
    } catch { /* egal */ }
    fetch('/api/konto/ich').then(r => r.json()).then(d => { if (d.ich) setKonto(d.ich); }).catch(() => {});
  }, []);
  const person = konto?.speicher ?? '';
  const arbeitsplatzSetzen = (teil: { modus?: Modus }) => {
    if (teil.modus) setModus(teil.modus);
    try { if (teil.modus) localStorage.setItem('make-os-modus', teil.modus); } catch { /* egal */ }
    // Andere Bereiche der Seite (Gruß, Zurufe, Mitschrift) hören mit.
    window.dispatchEvent(new CustomEvent('make-os-arbeitsplatz', { detail: { person, modus: teil.modus ?? modus } }));
  };
  const abmelden = async () => {
    await fetch('/api/konto/abmelden', { method: 'POST' }).catch(() => {});
    window.location.href = '/anmelden';
  };
  const sichtbareBereiche = useMemo(() => bereicheFuer(modus), [modus]);

  // Der Score je Leben — kommt aus derselben Quelle wie die Startfläche.
  const [scoreModi, setScoreModi] = useState<Record<string, { index: number | null; label: string; abdeckung: number }>>({});
  useEffect(() => {
    fetch('/api/startflaeche').then(r => r.json()).then(d => setScoreModi(d?.score?.modi ?? {})).catch(() => {});
  }, []);
  const scoreModus = scoreModi[modus];

  const [mobilOffen, setMobilOffen] = useState(false);
  const [schmal, setSchmal] = useState(false);
  const [palette, setPalette] = useState(false);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try { setSchmal(localStorage.getItem(MERKER_ZU) === '1'); } catch { /* egal */ }
  }, []);
  // Merken gehört neben den Zustandswechsel, nicht hinein: React darf einen
  // Updater mehrfach aufrufen.
  const umschalten = () => {
    const neu = !schmal;
    setSchmal(neu);
    try { localStorage.setItem(MERKER_ZU, neu ? '1' : '0'); } catch { /* egal */ }
  };

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
    return ziele.filter(t => `${t.label} ${t.hint ?? ''} ${t.group} ${t.href}`.toLowerCase().includes(s));
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

  const aktiv = (href: string) => (href === '/os' ? pathname === '/os' : pathname === href || pathname.startsWith(`${href}/`));

  /** Eine Navigationszeile — als Funktion, nicht als Komponente (sonst baut React sie neu auf). */
  const zeile = (it: { href: string; label: string; icon: LucideIcon; hinweis?: string }, farbe?: string) => {
    const on = aktiv(it.href);
    const Icon = it.icon;
    return (
      <Link key={it.href} href={it.href} title={schmal ? it.label : undefined} aria-current={on ? 'page' : undefined}
        style={{
          display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none', borderRadius: 9,
          padding: schmal ? '8px 0' : '7px 10px', justifyContent: schmal ? 'center' : 'flex-start',
          background: on ? T.accentSoft : 'transparent',
          borderLeft: `2px solid ${on ? T.accent : 'transparent'}`,
        }}>
        <Icon size={15} strokeWidth={1.75} color={on ? T.accent : (farbe ?? T.muted)} style={{ flex: '0 0 auto' }} />
        {!schmal && (
          <>
            <span style={{ fontSize: 13, fontWeight: on ? 700 : 500, color: on ? T.accent : T.inkDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.label}</span>
            {it.hinweis && <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, marginLeft: 'auto', flex: '0 0 auto' }}>{it.hinweis}</span>}
          </>
        )}
      </Link>
    );
  };

  const inhalt = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', padding: schmal ? '14px 8px 16px' : '14px 10px 16px', gap: 2 }}>

      {/* Marke + Einklappen */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: schmal ? 'center' : 'space-between', gap: 8, padding: schmal ? '0 0 14px' : '0 6px 14px', flexDirection: schmal ? 'column' : 'row' }}>
        <Link href="/os/start" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none', minWidth: 0 }}>
          <span style={{ width: 26, height: 26, borderRadius: 8, flex: '0 0 auto', display: 'grid', placeItems: 'center', background: 'radial-gradient(circle at 30% 30%, #BFF5EF, #58D9CD 60%, rgba(33,181,170,.25))', fontFamily: T.mono, fontSize: 11, fontWeight: 700, color: T.void }}>OS</span>
          {!schmal && (
            <span style={{ lineHeight: 1.25, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 700, letterSpacing: '-.01em', color: T.ink }}>MAKE OS</span>
              <span style={{ display: 'block', fontFamily: T.mono, fontSize: 11, color: T.muted, whiteSpace: 'nowrap' }}>Life &amp; Business OS</span>
            </span>
          )}
        </Link>
        <button onClick={umschalten} aria-label={schmal ? 'Navigation ausklappen' : 'Navigation einklappen'} title={schmal ? 'Ausklappen' : 'Einklappen'}
          style={{ background: 'transparent', border: 'none', color: T.muted, cursor: 'pointer', padding: 5, borderRadius: 8, display: 'grid', placeItems: 'center' }}>
          {schmal ? <PanelLeftOpen size={15} strokeWidth={1.75} /> : <PanelLeftClose size={15} strokeWidth={1.75} />}
        </button>
      </div>

      {/* ── ARBEITSPLATZ: wer arbeitet, in welchem Leben ────────────────────
          Seit 23.09.: das angemeldete Konto statt eines Schalters. Und der bewusste Schnitt
          zwischen Privat und Business — im Privat-Modus verschwindet das
          Geschäft aus der Navigation, nicht nur aus dem Blick. */}
      {!schmal && (
        <div style={{ padding: '0 4px 12px' }}>
          {/* Das Konto — wer angemeldet ist. Kein Schalter mehr (23.09.):
              wer jemand anderes sein will, meldet sich als jemand anderes an. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 4px 9px' }}>
            <span style={{ width: 24, height: 24, borderRadius: 8, flex: '0 0 auto', display: 'grid', placeItems: 'center', background: T.accentSoft, color: T.accent, fontFamily: T.mono, fontSize: 11, fontWeight: 700 }}>
              {(konto?.name ?? '?').charAt(0).toUpperCase()}
            </span>
            <Link href="/os/konto" title="Mein Konto" style={{ flex: 1, minWidth: 0, textDecoration: 'none', color: T.ink, fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {konto?.name ?? '…'}
            </Link>
            <button onClick={abmelden} title="Abmelden" style={{ background: 'transparent', border: 'none', color: T.muted, cursor: 'pointer', fontFamily: T.mono, fontSize: 11, padding: '3px 6px', borderRadius: 6 }}>abmelden</button>
          </div>
          <div style={{ display: 'flex', gap: 3, background: T.void, border: `1px solid ${T.line}`, borderRadius: 9, padding: 3 }}>
            {([['alles', 'Alles'], ['business', 'Business'], ['privat', 'Privat']] as const).map(([m, label]) => (
              <button key={m} onClick={() => arbeitsplatzSetzen({ modus: m })} title={
                m === 'privat' ? 'Nur Gesundheit, Tag, Planung und Privates — kein Geschäft.'
                  : m === 'business' ? 'Nur das Geschäft — Gesundheit und Privates treten zurück.'
                    : 'Beides nebeneinander.'
              } style={{
                flex: 1, fontFamily: T.mono, fontSize: 11, fontWeight: modus === m ? 700 : 400, padding: '5px 0', borderRadius: 7,
                cursor: 'pointer', border: 'none',
                background: modus === m ? (m === 'privat' ? `${T.crit}22` : m === 'business' ? `${T.amber}22` : T.accentSoft) : 'transparent',
                color: modus === m ? (m === 'privat' ? T.crit : m === 'business' ? T.amber : T.accent) : T.muted,
              }}>{label}</button>
            ))}
          </div>

          {/* Der MAKE Score für das gewählte Leben — Kevins Ansage: gehört mit
              zu den Schaltflächen und rechnet sich je nach Auswahl neu. So gibt
              es auch einen privaten Score, nicht nur einen Gesamtwert. */}
          <Link href="/os/performance" title={`MAKE Score ${modus === 'alles' ? 'gesamt' : modus} — ${scoreModus?.label ?? ''}`}
            className="score-puls" style={{
              display: 'flex', alignItems: 'center', gap: 9, marginTop: 5, textDecoration: 'none',
              background: T.void, border: `1px solid ${scoreFarbe(scoreModus?.index ?? null)}55`,
              borderRadius: 9, padding: '7px 11px',
            }}>
            <span style={{ fontSize: 17, fontWeight: 700, color: scoreFarbe(scoreModus?.index ?? null), fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
              {scoreModus?.index ?? '—'}
            </span>
            <span style={{ minWidth: 0, lineHeight: 1.25 }}>
              <span style={{ display: 'block', fontFamily: T.mono, fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: T.muted }}>
                MAKE Score {modus === 'alles' ? '' : modus}
              </span>
              <span style={{ display: 'block', fontSize: 11, color: scoreFarbe(scoreModus?.index ?? null), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {scoreModus?.label ?? 'lädt …'}
              </span>
            </span>
            {scoreModus && scoreModus.abdeckung < 0.6 && (
              <span title={`Nur ${Math.round(scoreModus.abdeckung * 100)} % der Säulen haben tragfähige Daten`}
                style={{ marginLeft: 'auto', fontFamily: T.mono, fontSize: 11, color: T.amber, flex: '0 0 auto' }}>
                {Math.round(scoreModus.abdeckung * 100)}%
              </span>
            )}
          </Link>
        </div>
      )}

      {bereich ? (
        /* ── Im Bereich: Rücksprung, Bereichsname, nur dessen Punkte ── */
        <>
          <Link href="/os/start" title={schmal ? 'Alle Bereiche' : undefined}
            style={{ display: 'flex', alignItems: 'center', gap: 7, textDecoration: 'none', color: T.muted, padding: schmal ? '7px 0' : '6px 10px', justifyContent: schmal ? 'center' : 'flex-start', borderRadius: 9, marginBottom: 2 }}>
            <ArrowLeft size={13} strokeWidth={2} style={{ flex: '0 0 auto' }} />
            {!schmal && <span style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase' }}>Alle Bereiche</span>}
          </Link>
          {!schmal && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 10px 8px' }}>
              <bereich.icon size={15} strokeWidth={1.75} color={bereich.farbe} style={{ flex: '0 0 auto' }} />
              <span style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: '-.01em', color: T.ink }}>{bereich.titel}</span>
            </div>
          )}
          {bereich.items.filter(i => !i.versteckt).map(it => zeile(it, bereich.farbe))}
        </>
      ) : (
        /* ── Außerhalb: Einstiege + Bereichsauswahl ── */
        <>
          {EINSTIEGE.map(e => zeile(e))}
          {schmal
            ? <div style={{ height: 1, background: T.line, margin: '10px auto', width: 22 }} role="presentation" />
            : <div style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: T.muted, padding: '16px 10px 6px' }}>Bereiche</div>}
          {sichtbareBereiche.map(b => {
            const Icon = b.icon;
            return (
              <Link key={b.id} href={b.start} title={schmal ? b.titel : undefined}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none', borderRadius: 9,
                  padding: schmal ? '8px 0' : '7px 10px', justifyContent: schmal ? 'center' : 'flex-start',
                  borderLeft: '2px solid transparent',
                }}>
                <Icon size={15} strokeWidth={1.75} color={b.farbe} style={{ flex: '0 0 auto' }} />
                {!schmal && (
                  <>
                    <span style={{ fontSize: 13, fontWeight: 500, color: T.inkDim }}>{b.titel}</span>
                    <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, marginLeft: 'auto' }}>{b.items.length}</span>
                  </>
                )}
              </Link>
            );
          })}
        </>
      )}

      <div style={{ flex: 1 }} />

      {brennt.length > 0 && !schmal && (
        <div style={{ borderTop: `1px solid ${T.lineSoft}`, paddingTop: 11, marginTop: 11 }}>
          <div style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: T.amber, padding: '0 10px 6px' }}>Brennt gerade</div>
          {brennt.map(t => (
            <Link key={t.id} href="/os/aufgaben" style={{ display: 'block', textDecoration: 'none', padding: '4px 10px' }}>
              <span style={{ fontSize: 11.5, color: T.inkDim, lineHeight: 1.35, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <span style={{ color: t.dueDate && t.dueDate < localDay() ? T.crit : T.amber }}>●</span> {t.title}
              </span>
            </Link>
          ))}
        </div>
      )}

      {/* Wer sonst gerade im System ist — schmal zusammengeklappt kein Platz. */}
      {!schmal && <Anwesenheit />}

      <button onClick={() => { setPalette(true); setQ(''); setSel(0); }} title="Schnellnavigation"
        style={{ marginTop: 11, borderTop: `1px solid ${T.lineSoft}`, paddingTop: 11, fontFamily: T.mono, fontSize: 11, color: T.muted, background: 'transparent', border: 'none', borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: T.lineSoft, cursor: 'pointer', textAlign: schmal ? 'center' : 'left', padding: schmal ? '11px 0 0' : '11px 10px 0' }}>
        {schmal ? '⌘K' : <>Schnellnavigation: <span style={{ border: `1px solid ${T.line}`, borderRadius: 5, padding: '1px 5px', background: T.panel2 }}>⌘K</span></>}
      </button>
    </div>
  );

  return (
    <>
      <aside className="os-sidebar-desktop" style={{ width: schmal ? 64 : 236, flex: '0 0 auto', borderRight: `1px solid ${T.line}`, background: T.panel, height: '100vh', position: 'sticky', top: 0, transition: 'width .18s ease' }}>
        {inhalt}
      </aside>

      <div className="os-sidebar-mobilbar" style={{ display: 'none', position: 'sticky', top: 0, zIndex: 40, background: T.panel, borderBottom: `1px solid ${T.line}`, padding: '10px 14px', alignItems: 'center', gap: 12 }}>
        <button onClick={() => setMobilOffen(true)} aria-label="Menü" style={{ background: 'transparent', border: `1px solid ${T.line}`, borderRadius: 8, color: T.ink, fontSize: 16, padding: '4px 10px', cursor: 'pointer' }}>☰</button>
        <Link href="/os/start" style={{ fontFamily: T.mono, fontSize: 12.5, fontWeight: 700, letterSpacing: '.14em', color: T.ink, textDecoration: 'none' }}>MAKE OS</Link>
        {bereich && <span style={{ fontSize: 12, color: T.muted }}>· {bereich.titel}</span>}
      </div>
      {mobilOffen && (
        <div onClick={() => setMobilOffen(false)} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,.55)' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 268, height: '100%', background: T.panel, borderRight: `1px solid ${T.line}` }}>
            {inhalt}
          </div>
        </div>
      )}

      {palette && (
        <div onClick={() => setPalette(false)} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '14vh' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 'min(560px, 92vw)', background: 'linear-gradient(165deg, #1A2024 0%, #12171A 100%)', border: 'none', borderRadius: 20, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06), 0 12px 32px rgba(0,0,0,.35)', overflow: 'hidden' }}>
            <input
              ref={inputRef} value={q}
              onChange={e => { setQ(e.target.value); setSel(0); }}
              onKeyDown={e => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s + 1, treffer.length - 1)); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(s - 1, 0)); }
                else if (e.key === 'Enter' && treffer[sel]) { setPalette(false); router.push(treffer[sel].href); }
              }}
              placeholder="Wohin, Sir? (Bereich, Seite oder Agent tippen)"
              style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: T.ink, fontFamily: T.sans, fontSize: 15, padding: '14px 16px', borderBottom: `1px solid ${T.line}` }}
            />
            <div style={{ maxHeight: '46vh', overflowY: 'auto', padding: 6 }}>
              {treffer.slice(0, 14).map((t, i) => (
                <div key={t.href + i} onClick={() => { setPalette(false); router.push(t.href); }} onMouseEnter={() => setSel(i)}
                  style={{ display: 'flex', gap: 10, alignItems: 'baseline', padding: '9px 12px', borderRadius: 9, cursor: 'pointer', background: i === sel ? T.accentSoft : 'transparent' }}>
                  <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, width: 104, flex: '0 0 auto', textTransform: 'uppercase', letterSpacing: '.06em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.group}</span>
                  <span style={{ fontSize: 13.5, color: i === sel ? T.accent : T.ink }}>{t.label}</span>
                  {t.hint && <span style={{ fontSize: 11, color: T.muted }}>{t.hint}</span>}
                </div>
              ))}
              {!treffer.length && <div style={{ padding: '14px 16px', fontSize: 13, color: T.muted }}>Nichts gefunden.</div>}
            </div>
          </div>
        </div>
      )}

      {/* dangerouslySetInnerHTML, nicht als Kind-Text: das „>" im Kindselektor
          wird sonst serverseitig zu &gt; escaped, clientseitig nicht — genau
          das löste den Hydrations-Fehler aus, der auf JEDER /os-Seite unten im
          Bild hing. */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes scorePuls { 0%,100% { box-shadow: 0 0 0 0 rgba(33,181,170,.0); } 50% { box-shadow: 0 0 0 4px rgba(33,181,170,.10); } }
        .score-puls { animation: scorePuls 3.2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .score-puls { animation: none; } }
        @media (max-width: 900px) {
          .os-sidebar-desktop { display: none !important; }
          .os-sidebar-mobilbar { display: flex !important; }
          .os-shell { flex-direction: column !important; }
          .os-shell > main { height: auto !important; min-height: calc(100vh - 49px); }
        }
      ` }} />
    </>
  );
}
