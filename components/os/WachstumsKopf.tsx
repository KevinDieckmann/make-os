'use client';
import { useSpace } from '@/hooks/useSpace';
import { spaceVon, type SpaceId } from '@/lib/make-one/spaces';

// ─── MAKE OS — Der Wachstums-Score über allem ───────────────────────────────
// Kevin, 24.09.: „Ich möchte, dass der Wachstumsscore oben drüber steht und im
// Grunde genommen der Score ist, auf den wir hinarbeiten. Wir wollen immer
// Wachstum, uns optimieren, Unternehmertum, Firmen optimieren, mehr Geld
// verdienen …" — Also steht er hier: auf jeder Seite oben, wie Whoop seine
// Kennzahlen oben trägt. Ring, Zone, Veränderung zur letzten Messung, die
// fünf Säulen als winzige Ringe. Ein Klick führt in den Bereich Wachstum.

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Ring, Chip, zoneFarbe, LEUCHT } from './schlank';
import { SCORE_NEU } from './WhoopImport';
import { Sun, Inbox as InboxIcon, Search, Lightbulb, CalendarDays } from 'lucide-react';

interface Saeule { key: string; label: string; score: number | null; zuDuenn: boolean }
interface Antwort { aktuell: { index: number | null; label: string; hebel: string | null; hebelKey?: string | null; stand: string; saeulen: Saeule[] }; verlauf: { date: string; index: number | null }[] }

// Jeder Score springt dorthin, wo es weitergeht (Kevin, 24.09.). Seit 24.09.
// abends ist der Kopf die Navigation für alles, was nicht links steht.
const HREF: Record<string, string> = { health: '/os/gesundheit', business: '/os/finanzen?s=business', planning: '/os/saeule/planning', finance: '/os/finanzen', social: '/os/familie', agents: '/os/agenten' };
// Das Label der Familien-Säule heißt überall gleich (26.09.).
// Kalender (25.09.): die Woche mit Terminen aus Apple, Blöcken, Aufgaben und Fristen — leuchtet im ganzen Planer.
const SCHNELL = [
  { href: '/os', label: 'Heute', Icon: Sun, passt: ['/os'] },
  { href: '/os/inbox', label: 'Inbox', Icon: InboxIcon, passt: ['/os/inbox'] },
  { href: '/os/planung/woche', label: 'Kalender', Icon: CalendarDays, passt: ['/os/planung', '/os/kalender'] },
];

// Der Score rechnet über viele Dateien — einmal je fünf Minuten reicht, nicht
// bei jedem Seitenwechsel. Der Bereich Wachstum lädt ihn ohnehin frisch.
let zwischen: { t: number; d: Antwort } | null = null;


/** Der Index des aktiven Space (Malin 26.09.: „daneben der Index des Space“) — Business- oder Privat-Index, klein. */
function SpaceIndex({ space }: { space: SpaceId }) {
  const s = spaceVon(space);
  const [w, setW] = useState<{ index: number | null; label: string } | null>(null);
  useEffect(() => {
    setW(null);
    const url = space === 'business' ? '/api/business?scope=gesamt&kompakt=1' : '/api/privat?kompakt=1';
    fetch(url, { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(d => {
      if (!d) return;
      const bi = space === 'business' ? d.bi : d;
      if (bi && typeof bi === 'object') setW({ index: bi.index ?? null, label: bi.label ?? '' });
    }).catch(() => {});
  }, [space]);
  const farbe = w?.index != null ? zoneFarbe(w.index) : C.inkLeise;
  return (
    <Link href={s.index.ziel} title={`${s.index.label} öffnen`} className="wachstum-kopf-space" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 999, textDecoration: 'none', border: `1px solid ${s.farbe}44`, background: `${s.farbe}12`, color: C.ink, whiteSpace: 'nowrap', flex: '0 0 auto' }}>
      <span style={{ fontSize: 12, color: s.farbe, fontWeight: 700 }}>{s.index.label}</span>
      <span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 14, color: farbe, fontVariantNumeric: 'tabular-nums' }}>{w?.index != null ? Math.round(w.index) : '—'}</span>
      {w?.label && <span className="wachstum-kopf-label" style={{ fontSize: 12, color: C.inkDim }}>· {w.label}</span>}
    </Link>
  );
}

export function WachstumsKopf() {
  const router = useRouter();
  const pfad = usePathname() ?? '';
  const { space } = useSpace();
  const sp = spaceVon(space);
  const [d, setD] = useState<Antwort | null>(zwischen?.d ?? null);
  useEffect(() => {
    if (zwischen && Date.now() - zwischen.t < 5 * 60_000) { setD(zwischen.d); return; }
    fetch('/api/performance').then(r => r.json()).then((x: Antwort) => { if (x?.aktuell) { zwischen = { t: Date.now(), d: x }; setD(x); } }).catch(() => {});
  }, [pfad]);
  // Im Bereich Wachstum selbst steht der Score groß — der Kopf wäre doppelt.
  // Neue Werte (z. B. Whoop-Export eingelesen): Zwischenspeicher verwerfen, neu holen.
  useEffect(() => {
    const neu = () => { zwischen = null; fetch('/api/performance').then(r => r.json()).then((x: Antwort) => { if (x?.aktuell) { zwischen = { t: Date.now(), d: x }; setD(x); } }).catch(() => {}); };
    window.addEventListener(SCORE_NEU, neu); return () => window.removeEventListener(SCORE_NEU, neu);
  }, []);
  if (pfad.startsWith('/os/wachstum')) return null;

  const p = d?.aktuell;
  const zone = zoneFarbe(p?.index);
  const v = d?.verlauf ?? [];
  const letzte = v.at(-1)?.index, davor = v.at(-2)?.index;
  const delta = letzte != null && davor != null ? letzte - davor : null;

  return (
    <div className="wachstum-kopf os-auf">
      <div className="wachstum-kopf-innen">
      <Link href="/os/wachstum" title="Zum Bereich Wachstum" style={{ display: 'flex', alignItems: 'center', gap: 16, textDecoration: 'none', color: 'inherit', minWidth: 0 }}>
        <Ring groesse="klein" label="" wert={p?.index != null ? String(p.index) : undefined} farbe={zone} anteil={p?.index != null ? p.index / 100 : undefined} />
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="wachstum-kopf-name" style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: TYP.body, letterSpacing: '-.01em', whiteSpace: 'nowrap' }}>Wachstums-Score</span>
            <span className="wachstum-kopf-zone" style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
              {p?.index != null && <Chip farbe={zone}>{p.label}</Chip>}
              {delta != null && delta !== 0 && <span style={{ fontSize: 12, fontWeight: 700, color: delta > 0 ? LEUCHT.gut : LEUCHT.kritisch }}>{delta > 0 ? '▲' : '▼'} {Math.abs(delta)}</span>}
            </span>
          </div>
          <div className="wachstum-kopf-unter" style={{ fontSize: 12, color: C.inkLeise, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {p ? (p.hebel ? <>Größter Hebel: {p.hebelKey && HREF[p.hebelKey] ? <span role="link" tabIndex={0} onClick={e => { e.preventDefault(); e.stopPropagation(); router.push(HREF[p.hebelKey!]); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); router.push(HREF[p.hebelKey!]); } }} style={{ cursor: 'pointer', borderBottom: '1px dotted rgba(255,255,255,.35)' }}>{p.hebel}</span> : p.hebel}</> : `Stand ${p.stand.slice(8)}.${p.stand.slice(5, 7)}.`) : 'Der Score, auf den wir hinarbeiten'}
          </div>
        </div>
      </Link>
      {/* Suchfeld im aktiven Space (Malin 26.09.) — öffnet die Schnellsuche (⌘K) */}
      <button onClick={() => window.dispatchEvent(new CustomEvent('make-suche', { detail: { space } }))} title="Suchen (⌘K)" aria-label="Suchen" className="wachstum-kopf-suche fassbar" style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 260px', minWidth: 0, maxWidth: 520, marginLeft: 8, padding: '9px 14px', borderRadius: 12, cursor: 'text', border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.04)', color: C.inkLeise, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, textAlign: 'left' }}>
        <Search size={15} strokeWidth={1.9} style={{ flex: '0 0 auto' }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{sp.suche}</span>
        <span className="nur-tastatur" style={{ fontSize: 11, border: '1px solid rgba(255,255,255,.12)', borderRadius: 6, padding: '1px 6px', color: C.inkLeise }}>⌘K</span>
      </button>
      <div className="wachstum-kopf-saeulen" style={{ display: 'flex', gap: 12, marginLeft: 'auto', alignItems: 'center', minWidth: 0 }}>
        <button className="wachstum-kopf-lupe" onClick={() => window.dispatchEvent(new CustomEvent('make-suche', { detail: { space } }))} title="Suchen (⌘K)" aria-label="Suchen" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center', border: '2px solid rgba(255,255,255,.1)', color: C.inkDim }}><Search size={15} strokeWidth={1.9} /></div>
            <span className="wachstum-kopf-label" style={{ fontSize: 11, color: C.inkLeise }}>Suche</span>
          </div>
        </button>
        {/* Idee oder Fehler — von jeder Seite direkt in den Bauplan (25.09.). */}
        <button onClick={() => window.dispatchEvent(new Event('make-idee'))} title="Idee oder Fehler in den Bauplan" aria-label="Idee notieren" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center', border: '2px solid rgba(255,255,255,.1)', color: C.inkDim }}><Lightbulb size={15} strokeWidth={1.9} /></div>
            <span className="wachstum-kopf-label" style={{ fontSize: 11, color: C.inkLeise }}>Idee</span>
          </div>
        </button>
        {SCHNELL.map(({ href, label, Icon, passt }) => {
          const an = href === '/os' ? pfad === '/os' : passt.some(p => pfad.startsWith(p));
          return (
            <Link key={href} href={href} title={label} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center', border: `2px solid ${an ? C.aktiv : 'rgba(255,255,255,.1)'}`, color: an ? C.aktiv : C.inkDim }}><Icon size={15} strokeWidth={1.9} /></div>
                <span className="wachstum-kopf-label" style={{ fontSize: 11, color: an ? C.aktiv : C.inkLeise }}>{label}</span>
              </div>
            </Link>
          );
        })}
        <span aria-hidden style={{ width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,.06)', margin: '0 2px' }} />
        {/* Der Index des aktiven Space — die sechs Säulen-Ringe stecken im Bereich Wachstum (Klick auf den Score). */}
        <SpaceIndex space={space} />
      </div>
      </div>
    </div>
  );
}
