'use client';

import Link from 'next/link';
// ─── MAKE OS — Routine-Planer ───────────────────────────────────────────────
// Positive Routinen für Gesundheit, Leben und Business — HIER werden sie
// geplant. Alles andere greift darauf zu: der Wochenplaner (Leiste + Jarvis),
// die Tagesplanung, das Gesundheits-Cockpit (Häkchen) und der MAKE Score.

import { useEffect, useRef, useState } from 'react';
import { THEME as T } from '@/lib/make-one/os-data';

interface Routine { id: string; label: string; wann: 'morgen' | 'tag' | 'abend'; kategorie: 'gesundheit' | 'leben' | 'business'; dauerMin: number; aktiv: boolean }

const lbl = { fontFamily: T.mono, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: T.muted };
const panel = { background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14 };

const WANN: { id: Routine['wann']; label: string; hint: string }[] = [
  { id: 'morgen', label: 'Morgens', hint: 'der Start — vor allem anderen' },
  { id: 'tag', label: 'Tagsüber', hint: 'zwischen den Blöcken' },
  { id: 'abend', label: 'Abends', hint: 'der Abschluss — runterfahren' },
];
const KAT: { id: Routine['kategorie']; label: string; farbe: string }[] = [
  { id: 'gesundheit', label: 'Gesundheit', farbe: '#58D9CD' },
  { id: 'leben', label: 'Leben', farbe: '#C77DFF' },
  { id: 'business', label: 'Business', farbe: '#4A6CF7' },
];
const katFarbe = (k: Routine['kategorie']) => KAT.find(x => x.id === k)!.farbe;

export function RoutinenPlanerView() {
  const [routinen, setRoutinen] = useState<Routine[]>([]);
  const [geladen, setGeladen] = useState(false);
  /** Laden fehlgeschlagen → nicht speichern, sonst löscht der erste Klick alles. */
  const [ladeFehler, setLadeFehler] = useState(false);
  const [neu, setNeu] = useState('');
  const [neuWann, setNeuWann] = useState<Routine['wann']>('morgen');
  const [neuKat, setNeuKat] = useState<Routine['kategorie']>('gesundheit');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    fetch('/api/state/routinen')
      .then(r => { if (!r.ok) throw new Error(`Status ${r.status}`); return r.json(); })
      .then(d => { setRoutinen(Array.isArray(d.routinen) ? d.routinen : []); setGeladen(true); })
      .catch(err => {
        console.error('[MAKE OS] Routinen konnten nicht geladen werden — Speichern gesperrt.', err);
        setLadeFehler(true); setGeladen(true);
      });
  }, []);

  function persist(next: Routine[]) {
    setRoutinen(next);
    if (ladeFehler) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch('/api/state/routinen', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ routinen: next }) }).catch(() => {});
    }, 500);
  }

  const add = () => {
    const l = neu.trim();
    if (!l) return;
    persist([...routinen, { id: `r-${Date.now().toString(36)}`, label: l, wann: neuWann, kategorie: neuKat, dauerMin: 15, aktiv: true }]);
    setNeu('');
  };

  const aktivN = routinen.filter(r => r.aktiv).length;

  return (
    <div style={{ minHeight: '100vh', background: T.void, color: T.ink, fontFamily: T.sans }}>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '26px clamp(16px,3vw,36px) 56px' }}>
        <div style={lbl}>Routine-Planer</div>
        <h1 style={{ fontSize: 25, fontWeight: 600, letterSpacing: '-.02em', margin: '6px 0 4px' }}>Was dich jeden Tag trägt.</h1>
        <p style={{ fontSize: 13.5, color: T.inkDim, maxWidth: 680, lineHeight: 1.5 }}>
          Positive Routinen für Gesundheit, Leben und Business — hier geplant, überall wirksam:
          im <Link href="/os/planung/woche" style={{ color: T.accentInk, textDecoration: 'none' }}>Wochenplaner</Link> (Leiste + Jarvis-Vorschlag),
          in der <Link href="/os/planung" style={{ color: T.accentInk, textDecoration: 'none' }}>Tagesplanung</Link>,
          im <Link href="/os/gesundheit" style={{ color: T.accentInk, textDecoration: 'none' }}>Cockpit</Link> (Häkchen) und im MAKE Score.
        </p>

        {/* Neu anlegen */}
        <div style={{ ...panel, padding: '14px 16px', margin: '18px 0 16px' }}>
          <div style={{ ...lbl, marginBottom: 9 }}>Neue Routine</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input value={neu} onChange={e => setNeu(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add(); }}
              placeholder="z. B. 10 Min Spazieren nach dem Mittag …"
              style={{ flex: 1, minWidth: 220, background: T.panel2, border: `1px solid ${T.line}`, borderRadius: 10, color: T.ink, fontFamily: T.sans, fontSize: 13.5, padding: '10px 13px', outline: 'none' }} />
            <select value={neuWann} onChange={e => setNeuWann(e.target.value as Routine['wann'])}
              style={{ background: T.panel2, border: `1px solid ${T.line}`, borderRadius: 10, color: T.ink, fontFamily: T.sans, fontSize: 13, padding: '9px 11px', outline: 'none' }}>
              {WANN.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
            </select>
            <select value={neuKat} onChange={e => setNeuKat(e.target.value as Routine['kategorie'])}
              style={{ background: T.panel2, border: `1px solid ${T.line}`, borderRadius: 10, color: T.ink, fontFamily: T.sans, fontSize: 13, padding: '9px 11px', outline: 'none' }}>
              {KAT.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
            </select>
            <button onClick={add} style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 700, padding: '10px 16px', borderRadius: 9, border: 'none', cursor: 'pointer', background: T.accent, color: '#04110F' }}>+ Routine</button>
          </div>
        </div>

        {/* Drei Tageszeiten */}
        {!geladen ? (
          <div style={{ fontFamily: T.mono, fontSize: 12, color: T.muted }}>lade …</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {WANN.map(w => {
              const eigene = routinen.filter(r => r.wann === w.id);
              return (
                <div key={w.id} style={{ ...panel, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px 8px', display: 'flex', alignItems: 'baseline', gap: 10 }}>
                    <span style={{ fontSize: 14.5, fontWeight: 700, color: T.ink }}>{w.label}</span>
                    <span style={{ fontSize: 11.5, color: T.muted }}>{w.hint}</span>
                    <span style={{ marginLeft: 'auto', fontFamily: T.mono, fontSize: 10.5, color: T.muted }}>{eigene.filter(r => r.aktiv).length} aktiv</span>
                  </div>
                  {!eigene.length && <div style={{ padding: '4px 16px 14px', fontSize: 12.5, color: T.muted }}>Noch nichts — leg oben eine an.</div>}
                  {eigene.map((r, i) => (
                    <div key={r.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '9px 16px', borderTop: i || true ? `1px solid ${T.lineSoft}` : 0, opacity: r.aktiv ? 1 : 0.45, flexWrap: 'wrap' }}>
                      <button onClick={() => persist(routinen.map(x => x.id === r.id ? { ...x, aktiv: !x.aktiv } : x))}
                        title={r.aktiv ? 'aktiv — klicken zum Pausieren' : 'pausiert — klicken zum Aktivieren'}
                        style={{ width: 34, height: 20, borderRadius: 11, cursor: 'pointer', border: `1px solid ${r.aktiv ? T.accent : T.line}`, background: r.aktiv ? `${T.accent}33` : 'transparent', position: 'relative', flex: '0 0 auto' }}>
                        <span style={{ position: 'absolute', top: 2, left: r.aktiv ? 16 : 2, width: 14, height: 14, borderRadius: '50%', background: r.aktiv ? T.accent : T.muted, transition: 'left .15s' }} />
                      </button>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: katFarbe(r.kategorie), flex: '0 0 auto' }} />
                      <input value={r.label} onChange={e => persist(routinen.map(x => x.id === r.id ? { ...x, label: e.target.value } : x))}
                        style={{ flex: 1, minWidth: 180, background: 'transparent', border: 'none', outline: 'none', color: T.ink, fontFamily: T.sans, fontSize: 13.5 }} />
                      <select value={r.kategorie} onChange={e => persist(routinen.map(x => x.id === r.id ? { ...x, kategorie: e.target.value as Routine['kategorie'] } : x))}
                        style={{ background: 'transparent', border: `1px solid ${T.line}`, borderRadius: 7, color: katFarbe(r.kategorie), fontFamily: T.mono, fontSize: 10, padding: '3px 6px', outline: 'none' }}>
                        {KAT.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
                      </select>
                      <select value={r.wann} onChange={e => persist(routinen.map(x => x.id === r.id ? { ...x, wann: e.target.value as Routine['wann'] } : x))}
                        style={{ background: 'transparent', border: `1px solid ${T.line}`, borderRadius: 7, color: T.inkDim, fontFamily: T.mono, fontSize: 10, padding: '3px 6px', outline: 'none' }}>
                        {WANN.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
                      </select>
                      <span style={{ fontFamily: T.mono, fontSize: 10.5, color: T.muted, flex: '0 0 auto' }}>
                        <button onClick={() => persist(routinen.map(x => x.id === r.id ? { ...x, dauerMin: Math.max(5, x.dauerMin - 5) } : x))} style={mini()}>−</button>
                        {' '}{r.dauerMin}m{' '}
                        <button onClick={() => persist(routinen.map(x => x.id === r.id ? { ...x, dauerMin: Math.min(120, x.dauerMin + 5) } : x))} style={mini()}>＋</button>
                      </span>
                      <button onClick={() => persist(routinen.filter(x => x.id !== r.id))} style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, background: 'transparent', border: 'none', cursor: 'pointer', flex: '0 0 auto' }}>✕</button>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        <div style={{ fontFamily: T.mono, fontSize: 10.5, color: T.muted, marginTop: 14, lineHeight: 1.6 }}>
          {aktivN} aktive Routinen · {KAT.map(k => <span key={k.id}><span style={{ color: k.farbe }}>■</span> {k.label}  </span>)}— pausierte zählen nirgends mit.
        </div>
      </div>
    </div>
  );
}

function mini(): React.CSSProperties {
  return { width: 18, height: 18, lineHeight: '13px', fontSize: 11, borderRadius: 5, cursor: 'pointer', border: `1px solid ${T.line}`, background: 'transparent', color: T.inkDim, padding: 0 };
}
