'use client';

// ─── MAKE OS — Der Wachstums-Score über allem ───────────────────────────────
// Kevin, 24.09.: „Ich möchte, dass der Wachstumsscore oben drüber steht und im
// Grunde genommen der Score ist, auf den wir hinarbeiten. Wir wollen immer
// Wachstum, uns optimieren, Unternehmertum, Firmen optimieren, mehr Geld
// verdienen …" — Also steht er hier: auf jeder Seite oben, wie Whoop seine
// Kennzahlen oben trägt. Ring, Zone, Veränderung zur letzten Messung, die
// fünf Säulen als winzige Ringe. Ein Klick führt in den Bereich Wachstum.

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useId, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP, TIEF } from '@/lib/make-one/design';
import { Ring, Chip, zoneFarbe, LEUCHT } from './schlank';
import { SCORE_NEU } from './WhoopImport';
import { Sun, Inbox as InboxIcon, Search, Lightbulb, CalendarDays } from 'lucide-react';

interface Saeule { key: string; label: string; score: number | null; zuDuenn: boolean }
interface Antwort { aktuell: { index: number | null; label: string; hebel: string | null; hebelKey?: string | null; stand: string; saeulen: Saeule[] }; verlauf: { date: string; index: number | null }[] }

const FARBE_JE: Record<string, string> = { health: LEUCHT.gut, business: LEUCHT.business, planning: LEUCHT.planung, finance: LEUCHT.geld, social: LEUCHT.beziehung, agents: LEUCHT.agenten };
const KURZ: Record<string, string> = { health: 'Gesundheit', business: 'Business', planning: 'Planung', finance: 'Finanzen', social: 'Familie', agents: 'Agenten' };
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

function Winzig({ wert, farbe, label }: { wert?: number; farbe: string; label: string }) {
  const r = 13, u = 2 * Math.PI * r;
  const [an, setAn] = useState(false);
  useEffect(() => { const t = requestAnimationFrame(() => setAn(true)); return () => cancelAnimationFrame(t); }, []);
  const anteil = wert != null ? Math.max(0.03, Math.min(1, wert / 100)) : 0;
  const id = `winzig-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
  return (
    <div title={`${label}: ${wert ?? '—'}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <div style={{ position: 'relative', width: 34, height: 34 }}>
        <svg viewBox="0 0 34 34" style={{ width: 34, height: 34, display: 'block', filter: wert != null ? TIEF.svgSchein(farbe, 4) : undefined }} aria-hidden>
          {/* Tiefe Akzente (25.09.): Verlauf in den tieferen Ton, getönte Scheibe — wie die großen Ringe. */}
          <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor={farbe} /><stop offset="100%" style={{ stopColor: TIEF.tiefer(farbe, 60) }} /></linearGradient></defs>
          {wert != null && <circle cx="17" cy="17" r={r - 3} fill={TIEF.flaeche(farbe)} />}
          <circle cx="17" cy="17" r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="4" />
          {wert != null && <circle cx="17" cy="17" r={r} fill="none" stroke={`url(#${id})`} strokeWidth="4" strokeLinecap="round" strokeDasharray={u.toFixed(1)} strokeDashoffset={(u * (1 - (an ? anteil : 0))).toFixed(1)} transform="rotate(-90 17 17)" style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.22,1,.36,1)' }} />}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 11, fontVariantNumeric: 'tabular-nums', color: wert == null ? C.inkLeise : C.ink }}>{wert ?? '—'}</div>
      </div>
      <span className="wachstum-kopf-label" style={{ fontSize: 11, color: C.inkLeise, letterSpacing: '.01em' }}>{label}</span>
    </div>
  );
}

export function WachstumsKopf() {
  const router = useRouter();
  const pfad = usePathname() ?? '';
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
      <div className="wachstum-kopf-saeulen" style={{ display: 'flex', gap: 12, marginLeft: 'auto', alignItems: 'flex-start', minWidth: 0 }}>
        <button onClick={() => window.dispatchEvent(new Event('make-suche'))} title="Suchen (⌘K)" aria-label="Suchen" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit' }}>
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
        {(p?.saeulen ?? []).map(s => (
          <Link key={s.key} href={HREF[s.key] ?? `/os/saeule/${s.key}`} title={`${KURZ[s.key] ?? s.label} — weiter`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <Winzig wert={s.score == null || s.score === 0 ? undefined : s.score} farbe={FARBE_JE[s.key] ?? C.inkLeise} label={KURZ[s.key] ?? s.label} />
          </Link>
        ))}
      </div>
      <Link href="/os/wachstum" title="Zum Bereich Wachstum" style={{ color: C.inkLeise, fontSize: 18, textDecoration: 'none' }}>›</Link>
      </div>
    </div>
  );
}
