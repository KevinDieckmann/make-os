'use client';

// ─── MAKE OS — Der erste Gruß für neue Personen (09.10., Onboarding B5) ────────────────────────────────
// Wer über eine Einladung neu dazukommt, sieht beim ersten Öffnen genau einmal einen kleinen Gruß — danach nie wieder (auch nicht in
// einem anderen Browser: das Häkchen steht im Bestand `willkommen`). Neutral für jede Instanz: kein Name im Code, keine privaten
// Sätze — der Vorname kommt aus dem eigenen Konto. Ob er erscheint, entscheidet der Server (GET /api/state/willkommen → `zeigen`:
// eingeladenes Konto, noch nicht gesehen). Löst den früheren persönlichen Gruß ab.
//
// Das Bild ist gezeichnet, kein Foto: zwei Lichter, die sich überlagern — zwei Menschen, ein System. Lädt nichts von außen.

import { useEffect, useId, useState } from 'react';
import { FARBE as C, LEUCHT, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Knopf } from './ui';

function ZweiLichter() {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 320 170" width="100%" height="150" role="img" aria-label="Zwei Lichter, die sich überlagern">
      <defs>
        <radialGradient id={`${id}-a`} cx="50%" cy="50%">
          <stop offset="0%" stopColor={C.ink} stopOpacity="0.85" />
          <stop offset="55%" stopColor={C.aktiv} stopOpacity="0.55" />
          <stop offset="100%" stopColor={C.aktiv} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-b`} cx="50%" cy="50%">
          <stop offset="0%" stopColor={C.ink} stopOpacity="0.85" />
          <stop offset="55%" stopColor={LEUCHT.puls} stopOpacity="0.5" />
          <stop offset="100%" stopColor={LEUCHT.puls} stopOpacity="0" />
        </radialGradient>
      </defs>
      {[[26, 30], [58, 16], [92, 42], [268, 26], [296, 58], [240, 14], [140, 22], [190, 36]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 1.4 : 0.9} fill={C.ink} opacity={0.25 + (i % 4) * 0.12} />
      ))}
      <circle cx="132" cy="98" r="60" fill={`url(#${id}-a)`} />
      <circle cx="188" cy="98" r="60" fill={`url(#${id}-b)`} />
    </svg>
  );
}

export function Willkommen() {
  const [vorname, setVorname] = useState<string | null>(null);

  useEffect(() => {
    let weg = false;
    fetch('/api/state/willkommen', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null))
      .then(w => { if (!weg && w?.zeigen) setVorname(typeof w.vorname === 'string' ? w.vorname : ''); })
      .catch(() => {});
    return () => { weg = true; };
  }, []);

  const schliessen = () => {
    setVorname(null);
    fetch('/api/state/willkommen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', keepalive: true }).catch(() => {});
  };

  if (vorname === null) return null;

  return (
    <div onClick={schliessen} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(4,10,12,.88)', display: 'grid', placeItems: 'center', padding: 20, backdropFilter: 'blur(6px)' }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Willkommen" className="gruss-auf" style={{
        width: 'min(460px, 94vw)', background: C.flaeche, borderRadius: 20, padding: '26px 28px 24px', textAlign: 'center', color: C.ink, fontFamily: SCHRIFT.text,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06), 0 30px 90px rgba(0,0,0,.6)',
      }}>
        <ZweiLichter />
        <div style={{ fontFamily: SCHRIFT.display, fontSize: 22, fontWeight: 700, letterSpacing: '-.02em', color: C.ink, marginTop: 14, lineHeight: 1.3 }}>
          Willkommen{vorname ? `, ${vorname}` : ''}.
        </div>
        <p style={{ fontSize: TYP.body, color: C.inkDim, lineHeight: 1.6, margin: '12px 0 0' }}>
          Schön, dass du da bist. Hier liegt alles an einem Ort — Heute, Inbox, Kalender, Aufgaben, Planung und Finanzen. Was nur dir
          gehört, bleibt bei dir; was ihr teilt, seht ihr gemeinsam.
        </p>
        <p style={{ fontSize: TYP.body, color: C.inkDim, lineHeight: 1.6, margin: '10px 0 0' }}>
          Die Einrichtung führt dich Schritt für Schritt — zuerst der zweite Faktor, dann deine Verbindungen.
        </p>
        <div style={{ display: 'grid', gap: 8, marginTop: 20 }}>
          <Knopf haupt href="/os/onboarding/ich" onClick={schliessen}>Zur Einrichtung</Knopf>
          <Knopf leise onClick={schliessen}>Später</Knopf>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes grussAuf { from { opacity: 0; transform: translateY(10px) scale(.98); } to { opacity: 1; transform: none; } }
        .gruss-auf { animation: grussAuf .45s cubic-bezier(.2,.7,.3,1) both; }
        @media (prefers-reduced-motion: reduce) { .gruss-auf { animation: none; } }
      ` }} />
    </div>
  );
}
