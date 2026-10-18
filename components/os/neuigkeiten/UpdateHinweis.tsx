'use client';

// ─── Was ist neu — der Hinweis nach einem Update (18.10., Kevin: „… dass ihr uns sagt, dass ein Update auf der Software war, und zeigt, was
// neu ist — damit Malin auch immer Bescheid weiß“) ──────────────────────────────────────────────────────────────────────────────────────
// Läuft auf jeder /os-Seite mit (app/os/layout.tsx). Ob er erscheint, entscheidet der Server (GET /api/neuigkeiten → `ungelesen`): je Person
// genau einmal je Update, auch über Geräte hinweg. „Gelesen“ und „Alles ansehen“ merken das neueste gesehene Update (POST). Danach steht
// alles unter Einstellungen › Was ist neu. Neutral für jede Instanz — die Texte kommen aus lib/neuigkeiten/eintraege.ts.

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Fenster } from '../Fenster';
import { Knopf } from '../ui';
import { UpdateAbschnitte, datumDe, punkteAnzahl } from './UpdateTeile';
import type { Neuigkeit } from '@/lib/neuigkeiten/eintraege';

/** So viele Punkte zeigt der Hinweis — den Rest die Seite. */
const HINWEIS_PUNKTE = 6;
export const NEUIGKEITEN_PFAD = '/os/neuigkeiten';

export function UpdateHinweis() {
  const pfad = usePathname();
  const [ungelesen, setUngelesen] = useState<Neuigkeit[] | null>(null);

  useEffect(() => {
    let weg = false;
    fetch('/api/neuigkeiten', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null))
      .then(d => { if (!weg && Array.isArray(d?.ungelesen) && d.ungelesen.length) setUngelesen(d.ungelesen as Neuigkeit[]); })
      .catch(() => {});
    return () => { weg = true; };
  }, []);

  const gesehen = () => {
    const neuestes = ungelesen?.[0]?.id;
    setUngelesen(null);
    if (!neuestes) return;
    fetch('/api/neuigkeiten', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gesehen: neuestes }), keepalive: true })
      .then(() => window.dispatchEvent(new Event('make-neuigkeiten-gesehen'))).catch(() => {});
  };

  // Auf der Seite „Was ist neu“ selbst braucht es keinen Hinweis — dort steht alles (die Seite merkt sich das Gesehene).
  if (!ungelesen?.length || pfad === NEUIGKEITEN_PFAD) return null;
  const n = ungelesen[0];
  const mehr = punkteAnzahl(n) > HINWEIS_PUNKTE;

  return (
    <Fenster breit={560} onZu={gesehen} titel={<>MAKE OS hat ein Update bekommen</>}>
      <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>
        {datumDe(n.datum)} · {n.titel}{ungelesen.length > 1 ? ` · dazu ${ungelesen.length - 1} ${ungelesen.length - 1 === 1 ? 'weiteres Update' : 'weitere Updates'} seit deinem letzten Besuch` : ''}
      </div>
      <p style={{ fontSize: TYP.body, color: C.ink, lineHeight: 1.6, margin: 0 }}>{n.kurz}</p>
      <UpdateAbschnitte n={n} max={HINWEIS_PUNKTE} onWeg={gesehen} />
      <div style={{ display: 'grid', gap: 8 }}>
        <Knopf haupt href={NEUIGKEITEN_PFAD} onClick={gesehen}>{mehr ? 'Alles ansehen' : 'Zur Übersicht'}</Knopf>
        <Knopf leise onClick={gesehen}>Gelesen</Knopf>
      </div>
    </Fenster>
  );
}
