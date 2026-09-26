'use client';

// ─── MAKE OS — Der Kopf über jeder Seite (26.09. abends, Malins Bild) ───────
// Links das Suchfeld, das im aktiven Space sucht (⌘K), dann Idee · Heute ·
// Inbox · Kalender, rechts der Index des Space (Privat- oder Business-Index).
// Der Wachstums-Score stand seit 24.09. hier oben; seit heute steht er auf
// Heute als Widget und groß im Bereich Wachstum (Kevin: ruhiger, schneller —
// der Score rechnete bei jedem Seitenwechsel über viele Bestände).

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { zoneFarbe } from './schlank';
import { Sun, Inbox as InboxIcon, Search, Lightbulb, CalendarDays } from 'lucide-react';
import { useSpace } from '@/hooks/useSpace';
import { spaceVon, type SpaceId } from '@/lib/make-one/spaces';

const SCHNELL = [
  { href: '/os', label: 'Heute', Icon: Sun, passt: ['/os'] },
  { href: '/os/inbox', label: 'Inbox', Icon: InboxIcon, passt: ['/os/inbox'] },
  { href: '/os/planung/woche', label: 'Kalender', Icon: CalendarDays, passt: ['/os/planung', '/os/kalender'] },
];

// Der Index je Space: einmal je fünf Minuten holen, nicht bei jedem Seitenwechsel.
const indexZwischen = new Map<SpaceId, { t: number; w: { index: number | null; label: string } }>();

/** Der Index des aktiven Space (Malin 26.09.: „daneben der Index des Space“). */
function SpaceIndex({ space }: { space: SpaceId }) {
  const s = spaceVon(space);
  const [w, setW] = useState<{ index: number | null; label: string } | null>(indexZwischen.get(space)?.w ?? null);
  useEffect(() => {
    const z = indexZwischen.get(space);
    if (z && Date.now() - z.t < 5 * 60_000) { setW(z.w); return; }
    const url = space === 'business' ? '/api/business?scope=gesamt&kompakt=1' : '/api/privat?kompakt=1';
    fetch(url, { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(d => {
      if (!d) return;
      const bi = space === 'business' ? d.bi : d;
      if (bi && typeof bi === 'object') { const wert = { index: bi.index ?? null, label: bi.label ?? '' }; indexZwischen.set(space, { t: Date.now(), w: wert }); setW(wert); }
    }).catch(() => {});
  }, [space]);
  const farbe = w?.index != null ? zoneFarbe(w.index) : C.inkLeise;
  return (
    <Link href={s.index.ziel} title={`${s.index.label} öffnen`} className="wachstum-kopf-space fassbar" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 999, textDecoration: 'none', border: `1px solid ${s.farbe}44`, background: `${s.farbe}12`, color: C.ink, whiteSpace: 'nowrap', flex: '0 0 auto' }}>
      <span className="wachstum-kopf-label" style={{ fontSize: 12, color: s.farbe, fontWeight: 700 }}>{s.index.label}</span>
      <span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 14, color: farbe, fontVariantNumeric: 'tabular-nums' }}>{w?.index != null ? Math.round(w.index) : '—'}</span>
      {w?.label && <span className="wachstum-kopf-label" style={{ fontSize: 12, color: C.inkDim }}>· {w.label}</span>}
    </Link>
  );
}

const rund = (an: boolean) => ({ width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center', border: `2px solid ${an ? C.aktiv : 'rgba(255,255,255,.1)'}`, color: an ? C.aktiv : C.inkDim } as const);

export function WachstumsKopf() {
  const pfad = usePathname() ?? '';
  const { space } = useSpace();
  const sp = spaceVon(space);
  const suchen = () => window.dispatchEvent(new CustomEvent('make-suche', { detail: { space } }));
  return (
    <div className="wachstum-kopf os-auf">
      <div className="wachstum-kopf-innen">
        {/* Suchfeld im aktiven Space — auf dem Handy nur die Lupe */}
        <button onClick={suchen} title="Suchen (⌘K)" aria-label="Suchen" className="wachstum-kopf-suche fassbar" style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 280px', minWidth: 0, maxWidth: 560, padding: '9px 14px', borderRadius: 12, cursor: 'text', border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.04)', color: C.inkLeise, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, textAlign: 'left' }}>
          <Search size={15} strokeWidth={1.9} style={{ flex: '0 0 auto' }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{sp.suche}</span>
          <span className="nur-tastatur" style={{ fontSize: 11, border: '1px solid rgba(255,255,255,.12)', borderRadius: 6, padding: '1px 6px', color: C.inkLeise }}>⌘K</span>
        </button>
        <div className="wachstum-kopf-saeulen" style={{ display: 'flex', gap: 12, marginLeft: 'auto', alignItems: 'center', minWidth: 0 }}>
          <button className="wachstum-kopf-lupe" onClick={suchen} title="Suchen (⌘K)" aria-label="Suchen" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}><div style={rund(false)}><Search size={15} strokeWidth={1.9} /></div><span className="wachstum-kopf-label" style={{ fontSize: 11, color: C.inkLeise }}>Suche</span></div>
          </button>
          {/* Idee oder Fehler — von jeder Seite direkt in den Bauplan (25.09.). */}
          <button onClick={() => window.dispatchEvent(new Event('make-idee'))} title="Idee oder Fehler in den Bauplan" aria-label="Idee notieren" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}><div style={rund(false)}><Lightbulb size={15} strokeWidth={1.9} /></div><span className="wachstum-kopf-label" style={{ fontSize: 11, color: C.inkLeise }}>Idee</span></div>
          </button>
          {SCHNELL.map(({ href, label, Icon, passt }) => {
            const an = href === '/os' ? pfad === '/os' : passt.some(p => pfad.startsWith(p));
            return (
              <Link key={href} href={href} title={label} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}><div style={rund(an)}><Icon size={15} strokeWidth={1.9} /></div><span className="wachstum-kopf-label" style={{ fontSize: 11, color: an ? C.aktiv : C.inkLeise }}>{label}</span></div>
              </Link>
            );
          })}
          <span aria-hidden style={{ width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,.06)', margin: '0 2px' }} />
          <SpaceIndex space={space} />
        </div>
      </div>
    </div>
  );
}
