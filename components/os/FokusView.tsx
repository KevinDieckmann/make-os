'use client';

import Link from 'next/link';
import { useState } from 'react';
import { THEME as T } from '@/lib/make-one/os-data';
import { WHOOP } from '@/lib/make-one/health-data';
import { Rich } from './Rich';
import { Seitenkopf } from './Seitenkopf';

const panel = { background: 'linear-gradient(165deg, #1A2024 0%, #12171A 100%)', border: 'none', borderRadius: 20, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06), 0 12px 32px rgba(0,0,0,.35)' };

const rec = WHOOP.rec;
const zone = rec >= 66 ? 'grün' : rec >= 40 ? 'gelb' : 'rot';
const zoneColor = zone === 'grün' ? T.accent : zone === 'gelb' ? T.amber : T.crit;
const zoneText = zone === 'grün' ? 'Volle Kapazität — heute geht harter Deep-Work.' : zone === 'gelb' ? 'Fokussiert, aber mit Puffer — nicht überziehen.' : 'Nur das Essentielle + Regeneration. Nicht durchpowern.';

export function FokusView() {
  const [plan, setPlan] = useState('');
  const [busy, setBusy] = useState(false);

  async function align() {
    setBusy(true); setPlan('');
    try {
      const r = await fetch('/api/fokus', { method: 'POST' });
      const d = await r.json();
      setPlan(d.reply ?? 'Kein Plan erhalten.');
    } catch { setPlan('Ich konnte den Tag gerade nicht ausrichten — versuch es nochmal.'); }
    finally { setBusy(false); }
  }

  const r = 44, C = 2 * Math.PI * r, off = C * (1 - rec / 100);

  return (
    <div style={{ minHeight: '100vh', background: T.void, color: T.ink, fontFamily: T.sans }}>
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '30px clamp(18px,4vw,48px) 72px' }}>
        <Link href="/os" style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, textDecoration: 'none', display: 'inline-block', marginBottom: 8 }}>‹ Übersicht</Link>
        <Seitenkopf
          rubrik={<>Fokus · Recovery × Prioritäten</>}
          titel={<>Dein Tag, ausgerichtet.</>}
          satz={<>MAKE verrechnet deine Whoop-Recovery mit deinen Aufgaben — und sagt dir die Tagesform. Firma und Gesundheit in einer Empfehlung.</>}
        />

        {/* Readiness */}
        <div style={{ ...panel, padding: '20px 22px', margin: '20px 0 16px', display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap', borderColor: `${zoneColor}55` }}>
          <div style={{ position: 'relative', width: 100, height: 100, flex: '0 0 auto' }}>
            <svg width="100" height="100" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="7" />
              <circle cx="50" cy="50" r={r} fill="none" stroke={zoneColor} strokeWidth="7" strokeLinecap="round" strokeDasharray={C.toFixed(1)} strokeDashoffset={off.toFixed(1)} transform="rotate(-90 50 50)" />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: T.mono, fontSize: 26, fontWeight: 600, color: T.ink, lineHeight: 1 }}>{rec}</span>
              <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>Recovery</span>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <span style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: zoneColor, border: `1px solid ${zoneColor}55`, borderRadius: 5, padding: '2px 9px' }}>Zone {zone}</span>
            <div style={{ fontSize: 14, color: T.ink, marginTop: 10, lineHeight: 1.5 }}>{zoneText}</div>
            <div style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, marginTop: 6 }}>RHR {WHOOP.rhr} · HRV {WHOOP.hrv} · Schlaf {WHOOP.sleepLast}h</div>
          </div>
          <button onClick={align} disabled={busy}
            style={{ fontFamily: T.sans, fontSize: 13.5, fontWeight: 600, padding: '11px 18px', borderRadius: 10, cursor: busy ? 'default' : 'pointer', whiteSpace: 'nowrap', border: `1px solid ${T.accent}`, background: busy ? T.panel2 : T.accent, color: busy ? T.muted : T.void }}>
            {busy ? 'richtet aus …' : plan ? '↻ Neu ausrichten' : 'Tag ausrichten →'}
          </button>
        </div>

        {plan && <div style={{ ...panel, padding: '20px 22px' }}><Rich text={plan} /></div>}
        {!plan && !busy && <div style={{ fontFamily: T.mono, fontSize: 11.5, color: T.muted, marginTop: 4 }}>Klick „Tag ausrichten" — MAKE nimmt deine Recovery + Aufgaben und baut dir die Tagesform.</div>}
      </div>
    </div>
  );
}
