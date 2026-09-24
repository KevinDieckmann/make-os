'use client';

// ─── MAKE OS — Schnellsuche (⌘K / Strg+K) ──────────────────────────────────
// Von jeder Seite aus: Kontakte, Firmen, Chancen, Mandate, Kampagnen — und die
// Bereiche selbst. Pfeile wählen, Enter springt hinein, Esc schließt. Oben im
// Kopf gibt es dafür auch die Lupe (Ereignis „make-suche“).

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { LEUCHT } from './schlank';

interface Treffer { art: string; id: string; titel: string; unter?: string; href: string }
const SEITEN: Treffer[] = [
  { art: 'seite', id: 'crm', titel: 'CRM · Heute (Power Hour)', href: '/os/crm' }, { art: 'seite', id: 'kontakte', titel: 'CRM · Kontakte', href: '/os/crm?s=kontakte' },
  { art: 'seite', id: 'firmen', titel: 'CRM · Firmen', href: '/os/crm?s=firmen' }, { art: 'seite', id: 'pipeline', titel: 'CRM · Pipeline', href: '/os/crm?s=pipeline' },
  { art: 'seite', id: 'kunden', titel: 'CRM · Kunden & Mandate', href: '/os/crm?s=kunden' }, { art: 'seite', id: 'marketing', titel: 'CRM · Marketing & Kampagnen', href: '/os/crm?s=marketing' },
  { art: 'seite', id: 'events', titel: 'CRM · Events', href: '/os/crm?s=events' }, { art: 'seite', id: 'stammdaten', titel: 'CRM · Stammdaten', href: '/os/crm?s=stammdaten' },
  { art: 'seite', id: 'aufgaben', titel: 'Aufgaben', href: '/os/aufgaben' }, { art: 'seite', id: 'finanzen', titel: 'Zahlen', href: '/os/finanzen' },
  { art: 'seite', id: 'familie', titel: 'Familie & Partnerschaft', href: '/os/familie' }, { art: 'seite', id: 'fokus', titel: 'Fokus', href: '/os/fokus' },
  { art: 'seite', id: 'gesundheit', titel: 'Gesundheit', href: '/os/gesundheit' }, { art: 'seite', id: 'wissen', titel: 'Brain', href: '/os/wissen' },
];
const ART: Record<string, { label: string; farbe: string }> = {
  kontakt: { label: 'Person', farbe: LEUCHT.business }, firma: { label: 'Firma', farbe: LEUCHT.puls }, chance: { label: 'Chance', farbe: LEUCHT.achtung },
  mandat: { label: 'Mandat', farbe: LEUCHT.geld }, kampagne: { label: 'Kampagne', farbe: LEUCHT.beziehung }, seite: { label: 'Bereich', farbe: C.inkDim },
};

export function Schnellsuche() {
  const router = useRouter();
  const [offen, setOffen] = useState(false);
  const [q, setQ] = useState('');
  const [treffer, setTreffer] = useState<Treffer[]>([]);
  const [i, setI] = useState(0);
  const feldRef = useRef<HTMLInputElement>(null);
  const schliessen = useCallback(() => { setOffen(false); setQ(''); setTreffer([]); setI(0); }, []);

  useEffect(() => {
    const taste = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOffen(o => !o); } };
    const auf = () => setOffen(true);
    window.addEventListener('keydown', taste);
    window.addEventListener('make-suche', auf);
    return () => { window.removeEventListener('keydown', taste); window.removeEventListener('make-suche', auf); };
  }, []);
  useEffect(() => { if (offen) setTimeout(() => feldRef.current?.focus(), 30); }, [offen]);
  useEffect(() => {
    if (!offen) return;
    const t = q.trim();
    const seiten = SEITEN.filter(s => !t || s.titel.toLowerCase().includes(t.toLowerCase()));
    if (t.length < 2) { setTreffer(seiten.slice(0, 8)); setI(0); return; }
    const ab = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/crm/suche?q=${encodeURIComponent(t)}`, { signal: ab.signal }).then(r => r.json()).then(d => { setTreffer([...(d.treffer ?? []), ...seiten.slice(0, 3)]); setI(0); }).catch(() => {});
    }, 140);
    return () => { clearTimeout(timer); ab.abort(); };
  }, [q, offen]);

  const oeffne = (t: Treffer) => { schliessen(); router.push(t.href); };
  if (!offen) return null;
  return (
    <div onClick={schliessen} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(5,7,8,.62)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '12vh', paddingInline: 16 }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-label="Schnellsuche" style={{ width: 'min(640px, 100%)', background: C.flaeche, borderRadius: 16, boxShadow: '0 30px 80px -20px rgba(0,0,0,.8)', border: '1px solid rgba(255,255,255,.07)', overflow: 'hidden' }}>
        <input ref={feldRef} value={q} onChange={e => setQ(e.target.value)} placeholder="Person, Firma, Chance, Mandat oder Bereich …" aria-label="Suchen"
          onKeyDown={e => {
            if (e.key === 'Escape') schliessen();
            else if (e.key === 'ArrowDown') { e.preventDefault(); setI(x => Math.min(treffer.length - 1, x + 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setI(x => Math.max(0, x - 1)); }
            else if (e.key === 'Enter' && treffer[i]) oeffne(treffer[i]);
          }}
          style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,.07)', padding: '18px 20px', color: C.ink, fontFamily: SCHRIFT.text, fontSize: 17, outline: 'none' }} />
        <div style={{ maxHeight: '52vh', overflowY: 'auto', padding: 6 }}>
          {treffer.map((t, j) => (
            <button key={`${t.art}-${t.id}`} onMouseEnter={() => setI(j)} onClick={() => oeffne(t)}
              style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 12, padding: '10px 14px', border: 'none', borderRadius: 10, cursor: 'pointer', textAlign: 'left', background: j === i ? 'rgba(255,255,255,.07)' : 'transparent', color: C.ink }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: ART[t.art]?.farbe ?? C.inkDim, width: 66, flex: '0 0 auto' }}>{ART[t.art]?.label ?? t.art}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: TYP.body, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.titel}</span>
                {t.unter && <span style={{ display: 'block', fontSize: 12.5, color: C.inkLeise, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.unter}</span>}
              </span>
            </button>
          ))}
          {!treffer.length && q.trim().length >= 2 && <div style={{ padding: '14px 16px', color: C.inkLeise, fontSize: TYP.bedien }}>Nichts gefunden.</div>}
        </div>
        <div style={{ padding: '8px 16px', borderTop: '1px solid rgba(255,255,255,.06)', fontSize: 12, color: C.inkLeise }}>↑↓ wählen · Enter öffnen · Esc schließen · ⌘K von überall</div>
      </div>
    </div>
  );
}
