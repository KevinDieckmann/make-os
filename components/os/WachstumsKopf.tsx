'use client';

// ─── MAKE OS — Der Wachstums-Score über allem ───────────────────────────────
// Kevin, 24.09.: „Ich möchte, dass der Wachstumsscore oben drüber steht und im
// Grunde genommen der Score ist, auf den wir hinarbeiten. Wir wollen immer
// Wachstum, uns optimieren, Unternehmertum, Firmen optimieren, mehr Geld
// verdienen …" — Also steht er hier: auf jeder Seite oben, wie Whoop seine
// Kennzahlen oben trägt. Ring, Zone, Veränderung zur letzten Messung, die
// fünf Säulen als winzige Ringe. Ein Klick führt in den Bereich Wachstum.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Ring, Chip, zoneFarbe, LEUCHT } from './schlank';

interface Saeule { key: string; label: string; score: number | null; zuDuenn: boolean }
interface Antwort { aktuell: { index: number | null; label: string; hebel: string | null; stand: string; saeulen: Saeule[] }; verlauf: { date: string; index: number | null }[] }

const FARBE_JE: Record<string, string> = { health: LEUCHT.gut, business: LEUCHT.business, planning: LEUCHT.planung, finance: LEUCHT.geld, social: LEUCHT.beziehung, agents: LEUCHT.agenten };
const KURZ: Record<string, string> = { health: 'Gesundheit', business: 'Business', planning: 'Planung', finance: 'Finanzen', social: 'Beziehung', agents: 'Agenten' };
// Jeder Score springt dorthin, wo es weitergeht (Kevin, 24.09.).
const HREF: Record<string, string> = { health: '/os/gesundheit', business: '/os/saeule/business', planning: '/os/saeule/planning', finance: '/os/finanzen', social: '/os/saeule/social', agents: '/os/agenten' };

// Der Score rechnet über viele Dateien — einmal je fünf Minuten reicht, nicht
// bei jedem Seitenwechsel. Der Bereich Wachstum lädt ihn ohnehin frisch.
let zwischen: { t: number; d: Antwort } | null = null;

function Winzig({ wert, farbe, label }: { wert?: number; farbe: string; label: string }) {
  const r = 13, u = 2 * Math.PI * r;
  const [an, setAn] = useState(false);
  useEffect(() => { const t = requestAnimationFrame(() => setAn(true)); return () => cancelAnimationFrame(t); }, []);
  const anteil = wert != null ? Math.max(0.03, Math.min(1, wert / 100)) : 0;
  return (
    <div title={`${label}: ${wert ?? '—'}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <div style={{ position: 'relative', width: 34, height: 34 }}>
        <svg viewBox="0 0 34 34" style={{ width: 34, height: 34, display: 'block', filter: wert != null ? `drop-shadow(0 0 4px ${farbe}88)` : undefined }} aria-hidden>
          <circle cx="17" cy="17" r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="4" />
          {wert != null && <circle cx="17" cy="17" r={r} fill="none" stroke={farbe} strokeWidth="4" strokeLinecap="round" strokeDasharray={u.toFixed(1)} strokeDashoffset={(u * (1 - (an ? anteil : 0))).toFixed(1)} transform="rotate(-90 17 17)" style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.22,1,.36,1)' }} />}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 11, fontVariantNumeric: 'tabular-nums', color: wert == null ? C.inkLeise : C.ink }}>{wert ?? '—'}</div>
      </div>
      <span className="wachstum-kopf-label" style={{ fontSize: 11, color: C.inkLeise, letterSpacing: '.01em' }}>{label}</span>
    </div>
  );
}

export function WachstumsKopf() {
  const pfad = usePathname() ?? '';
  const [d, setD] = useState<Antwort | null>(zwischen?.d ?? null);
  useEffect(() => {
    if (zwischen && Date.now() - zwischen.t < 5 * 60_000) { setD(zwischen.d); return; }
    fetch('/api/performance').then(r => r.json()).then((x: Antwort) => { if (x?.aktuell) { zwischen = { t: Date.now(), d: x }; setD(x); } }).catch(() => {});
  }, [pfad]);
  // Im Bereich Wachstum selbst steht der Score groß — der Kopf wäre doppelt.
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
            {p ? (p.hebel ? `Größter Hebel: ${p.hebel}` : `Stand ${p.stand.slice(8)}.${p.stand.slice(5, 7)}.`) : 'Der Score, auf den wir hinarbeiten'}
          </div>
        </div>
      </Link>
      <div className="wachstum-kopf-saeulen" style={{ display: 'flex', gap: 12, marginLeft: 'auto', alignItems: 'flex-start' }}>
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
