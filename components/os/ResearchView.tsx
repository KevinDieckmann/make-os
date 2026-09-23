'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { THEME as T } from '@/lib/make-one/os-data';
import { Rich } from '@/components/os/Rich';
import { Seitenkopf } from './Seitenkopf';

interface Item { id: number; q: string; a: string; webUsed?: boolean; loading?: boolean; }

const lbl = { fontFamily: T.mono, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: T.muted };
const SUGGEST = [
  'Wettbewerber für ein Controlling-Cockpit (CapOS) im deutschen KMU-Markt',
  'Wie ist BSFZ-Forschungszulage 2026 geregelt — Sätze & Voraussetzungen?',
  'Marktgröße & Trends: Finanz-/Liquiditätsplanung-Software für KMU (DACH)',
];

export function ResearchView() {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(1);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [items]);

  async function run(query: string) {
    const text = query.trim();
    if (!text || busy) return;
    setBusy(true); setQ('');
    const id = idRef.current++;
    setItems(prev => [...prev, { id, q: text, a: '', loading: true }]);
    try {
      const r = await fetch('/api/research', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: text }) });
      const d = await r.json();
      setItems(prev => prev.map(it => it.id === id ? { ...it, a: d.reply ?? 'Keine Antwort.', webUsed: d.webUsed, loading: false } : it));
    } catch {
      setItems(prev => prev.map(it => it.id === id ? { ...it, a: 'Fehler bei der Anfrage — nochmal versuchen.', loading: false } : it));
    } finally { setBusy(false); }
  }

  return (
    <div style={{ minHeight: '100vh', background: T.void, color: T.ink, fontFamily: T.sans }}>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '26px clamp(16px,3vw,36px) 40px' }}>
        <Link href="/os/agenten" style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, textDecoration: 'none', display: 'inline-block', marginBottom: 8 }}>‹ Agenten</Link>
          <Seitenkopf
            rubrik={<>Research-Agent <span style={{ fontFamily: T.mono, fontSize: 11, color: T.accent, border: `1px solid ${T.accent}55`, borderRadius: 5, padding: '2px 7px' }}>live · autonom</span></>}
            titel={<>Recherchiere mit Quellen.</>}
            satz={<>Stell eine Frage — Markt, Wettbewerb, Förderung, Prospects. Ich suche im Web und antworte belegt. Read-only, keine Freigabe nötig.</>}
          />

        {items.length === 0 && (
          <div style={{ marginTop: 22 }}>
            <div style={{ ...lbl, marginBottom: 9 }}>Beispiele</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {SUGGEST.map(s => (
                <button key={s} onClick={() => run(s)} style={{ textAlign: 'left', fontFamily: T.sans, fontSize: 13, color: T.inkDim, background: 'linear-gradient(165deg, #1A2024 0%, #12171A 100%)', border: 'none', borderRadius: 20, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06), 0 12px 32px rgba(0,0,0,.35)', padding: '11px 14px', cursor: 'pointer', lineHeight: 1.4 }}>
                  <span style={{ color: T.accent, marginRight: 8 }}>›</span>{s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, margin: '22px 0' }}>
          {items.map(it => (
            <div key={it.id}>
              <div style={{ display: 'flex', gap: 9, marginBottom: 10 }}>
                <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, flex: '0 0 auto', marginTop: 3 }}>Du</span>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: T.ink, lineHeight: 1.45 }}>{it.q}</div>
              </div>
              <div style={{ background: 'linear-gradient(165deg, #1A2024 0%, #12171A 100%)', border: 'none', borderRadius: 20, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06), 0 12px 32px rgba(0,0,0,.35)', padding: '14px 18px' }}>
                {it.loading ? (
                  <div style={{ fontFamily: T.mono, fontSize: 12, color: T.muted }}>recherchiere im Web …</div>
                ) : (
                  <>
                    <Rich text={it.a} />
                    <div style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, marginTop: 12, paddingTop: 10, borderTop: `1px solid ${T.lineSoft}` }}>
                      {it.webUsed ? '⌁ mit Web-Suche' : '⌁ ohne Live-Suche beantwortet'}
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        <div style={{ position: 'sticky', bottom: 16, display: 'flex', gap: 8, background: 'linear-gradient(165deg, #1A2024 0%, #12171A 100%)', border: 'none', borderRadius: 20, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06), 0 12px 32px rgba(0,0,0,.35)', padding: 8 }}>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') run(q); }}
            placeholder="Was soll ich recherchieren?"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: T.ink, fontFamily: T.sans, fontSize: 14, padding: '8px 10px' }}
          />
          <button onClick={() => run(q)} disabled={busy || !q.trim()} style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 600, padding: '8px 18px', borderRadius: 9, cursor: busy || !q.trim() ? 'default' : 'pointer', border: 'none', background: busy || !q.trim() ? T.line : T.accent, color: busy || !q.trim() ? T.muted : '#04110F' }}>
            {busy ? '…' : 'Recherchieren'}
          </button>
        </div>
      </div>
    </div>
  );
}
