'use client';

// ─── MAKE OS — Research-Agent ───────────────────────────────────────────────
// Eine Frage rein — Markt, Wettbewerb, Förderung, Prospects — Antwort mit
// Quellen zurück. Read-only, keine Freigabe nötig.
// 24.09.: auf das lebendige Muster umgezogen (Seite/Karte/Zeile aus schlank).

import { useEffect, useRef, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Rich } from '@/components/os/Rich';
import { Seite, Karte, Ueberschrift, Liste, Zeile, Leer, Knopf, Chip, feld, LEUCHT } from './schlank';

interface Item { id: number; q: string; a: string; webUsed?: boolean; loading?: boolean; }

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
    <Seite
      titel="Recherchiere mit Quellen."
      unter="Stell eine Frage — Markt, Wettbewerb, Förderung, Prospects. Ich suche im Web und antworte belegt. Read-only, keine Freigabe nötig."
      rechts={<Chip farbe={LEUCHT.agenten}>live · autonom</Chip>}
    >
      {items.length === 0 && (
        <Karte i={0} akzent={LEUCHT.agenten}>
          <Ueberschrift farbe={LEUCHT.agenten}>Beispiele</Ueberschrift>
          <Liste>
            {SUGGEST.map(s => (
              <Zeile key={s} onClick={() => run(s)} links={<span style={{ color: LEUCHT.agenten, fontWeight: 700 }}>›</span>} titel={<span style={{ whiteSpace: 'normal', fontWeight: 500, color: C.inkDim }}>{s}</span>} />
            ))}
          </Liste>
        </Karte>
      )}

      {items.map((it, n) => (
        <Karte key={it.id} i={n}>
          <Ueberschrift farbe={LEUCHT.agenten}>Du</Ueberschrift>
          <div style={{ fontSize: TYP.body, fontWeight: 600, color: C.ink, lineHeight: 1.45, marginBottom: 12 }}>{it.q}</div>
          {it.loading ? (
            <Leer>recherchiere im Web …</Leer>
          ) : (
            <>
              <Rich text={it.a} />
              <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 14 }}>
                {it.webUsed ? '⌁ mit Web-Suche' : '⌁ ohne Live-Suche beantwortet'}
              </div>
            </>
          )}
        </Karte>
      ))}
      <div ref={endRef} />

      <Karte i={items.length + 1} style={{ position: 'sticky', bottom: 16, zIndex: 2 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') run(q); }}
            placeholder="Was soll ich recherchieren?"
            style={{ ...feld, flex: 1, minWidth: 180, width: 'auto', fontFamily: SCHRIFT.text }}
          />
          <Knopf onClick={() => run(q)} aus={busy || !q.trim()} farbe={LEUCHT.agenten}>{busy ? '…' : 'Recherchieren'}</Knopf>
        </div>
      </Karte>
    </Seite>
  );
}
