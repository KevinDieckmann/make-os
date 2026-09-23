'use client';

// ─── MAKE OS — Der erste Gruß ───────────────────────────────────────────────
// Kevins Wunsch: Wenn Malin die Software zum ersten Mal aufmacht, soll ein
// kleiner Bildschirm kommen. Genau einmal — danach nie wieder.
//
// Das Bild ist gezeichnet, kein Foto: zwei Lichter, die sich zu einem Herz
// überlagern. Passt zur Software, wird nie unscharf und lädt nichts von außen.

import { useEffect, useState } from 'react';
import { THEME as T } from '@/lib/make-one/os-data';
import { personLesen, modusLesen, beiWechsel } from '@/lib/make-one/arbeitsplatz-browser';

function ZweiLichter() {
  return (
    <svg viewBox="0 0 320 200" width="100%" height="180" role="img" aria-label="Zwei Lichter, die zusammen ein Herz bilden">
      <defs>
        <radialGradient id="gl-k" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#BFF5EF" stopOpacity="0.95" />
          <stop offset="55%" stopColor="#58D9CD" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#58D9CD" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="gl-m" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#FFD9E6" stopOpacity="0.95" />
          <stop offset="55%" stopColor="#FF5C5C" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#FF5C5C" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="herz" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#BFF5EF" />
          <stop offset="100%" stopColor="#FF5C5C" />
        </linearGradient>
      </defs>

      {/* Sternenfeld — ruhig, nicht kitschig */}
      {[[26, 32], [58, 18], [92, 46], [268, 28], [296, 62], [240, 16], [140, 24], [190, 38]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 1.4 : 0.9} fill="#F5F4F1" opacity={0.25 + (i % 4) * 0.12} />
      ))}

      {/* Die zwei Lichter */}
      <circle cx="126" cy="112" r="62" fill="url(#gl-k)" />
      <circle cx="194" cy="112" r="62" fill="url(#gl-m)" />

      {/* Das Herz dazwischen */}
      <path
        d="M160 148 C 128 124, 112 108, 112 92 C 112 78, 123 68, 136 68 C 145 68, 154 73, 160 82 C 166 73, 175 68, 184 68 C 197 68, 208 78, 208 92 C 208 108, 192 124, 160 148 Z"
        fill="url(#herz)" opacity="0.92"
      />

      <text x="126" y="188" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="10" fill="#58D9CD" opacity="0.75">KEVIN</text>
      <text x="194" y="188" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="10" fill="#FF5C5C" opacity="0.75">MALIN</text>
    </svg>
  );
}

export function WillkommenMalin() {
  const [zeigen, setZeigen] = useState(false);
  const [person, setPerson] = useState<string>('kevin');

  useEffect(() => {
    // Nur für Malin, nur wenn sie ihn noch nie gesehen hat. Wer hier sitzt,
    // steht im Browser — sonst käme der Gruß auf Kevins Bildschirm, sobald sie
    // an ihrem Rechner umschaltet.
    const pruefen = () => {
      const p = personLesen();
      setPerson(p);
      if (p !== 'malin') { setZeigen(false); return; }
      fetch('/api/state/willkommen').then(r => r.json())
        .then(w => { if (!w?.gesehen?.malin) setZeigen(true); })
        .catch(() => {});
    };
    pruefen();
    // Auch wenn erst im laufenden Betrieb auf Malin umgestellt wird.
    return beiWechsel(pruefen);
  }, []);

  const schliessen = () => {
    setZeigen(false);
    fetch('/api/state/willkommen', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ person }), keepalive: true,
    }).catch(() => {});
  };

  if (!zeigen) return null;

  return (
    <div onClick={schliessen} style={{
      position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(4,10,12,.88)',
      display: 'grid', placeItems: 'center', padding: 20, backdropFilter: 'blur(6px)',
    }}>
      <div onClick={e => e.stopPropagation()} className="gruss-auf" style={{
        width: 'min(460px, 94vw)', background: T.panel, border: `1px solid ${T.lineHot}`,
        borderRadius: 20, padding: '26px 28px 24px', textAlign: 'center',
        boxShadow: '0 30px 90px rgba(0,0,0,.6)',
      }}>
        <ZweiLichter />
        <div style={{ fontSize: 22, fontWeight: 700, color: T.ink, marginTop: 14, lineHeight: 1.3 }}>
          Ich liebe dich, Schatziiiii <span style={{ color: T.crit }}>:****</span>
        </div>
        <p style={{ fontSize: 13.5, color: T.inkDim, lineHeight: 1.6, margin: '12px 0 0' }}>
          Willkommen in unserem System. Ich hab das hier für uns beide gebaut —
          damit wir endlich alles an einem Ort haben und du überall drin bist.
          Alles, was du siehst, gehört uns.
        </p>
        <p style={{ fontSize: 13.5, color: T.inkDim, lineHeight: 1.6, margin: '10px 0 0' }}>
          Das hier ist unser Fundament. So schaffen wir es, immer alles
          zusammen zu machen <span style={{ color: T.accent }}>:)</span>
        </p>
        <p style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, margin: '14px 0 0' }}>
          — Kevin
        </p>
        <button onClick={schliessen} style={{
          marginTop: 20, width: '100%', fontFamily: T.sans, fontSize: 14, fontWeight: 700,
          padding: '12px 0', borderRadius: 11, border: 'none', cursor: 'pointer',
          background: T.accent, color: T.void,
        }}>Los geht's</button>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes grussAuf { from { opacity: 0; transform: translateY(10px) scale(.98); } to { opacity: 1; transform: none; } }
        .gruss-auf { animation: grussAuf .45s cubic-bezier(.2,.7,.3,1) both; }
        @media (prefers-reduced-motion: reduce) { .gruss-auf { animation: none; } }
      ` }} />
    </div>
  );
}
