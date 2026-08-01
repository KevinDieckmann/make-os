'use client';

import Link from 'next/link';
// Der Taktgeber: solange MAKE OS offen ist, hält er den Rhythmus — stündlich
// ein leiser Puls, mittags und nachmittags ein kurzer Check. Er fragt nicht,
// er läuft. Meldet sich nur, wenn der Wächter anschlägt.
//
// Bewusst im Browser statt als Server-Cron: die App läuft lokal auf dem Mac,
// und offen ist sie ohnehin, wenn Kevin arbeitet. Ein echter Zeitplan auch bei
// geschlossener App steht als Punkt im Bauplan (loop-automatisch).

import { useEffect, useRef, useState } from 'react';
import { THEME as T } from '@/lib/make-one/os-data';
import { artFuerStunde, tagKey, type LaufArt } from '@/lib/tageslauf';

const MIN = 60_000;

export function Taktgeber() {
  const [alarm, setAlarm] = useState<string | null>(null);
  const laeuft = useRef(false);

  useEffect(() => {
    let aktiv = true;

    async function tick() {
      if (!aktiv || laeuft.current) return;
      // Nachts ruht das System — Kevin soll schlafen, nicht das OS füttern.
      const h = new Date().getHours();
      if (h < 7 || h >= 22) return;

      try {
        const st = await (await fetch('/api/tageslauf')).json() as {
          laeufe?: { art: LaufArt; gestartet: string; alarm?: string }[];
        };
        const heute = (st.laeufe ?? []).filter(l => l.gestartet.slice(0, 10) === tagKey());
        const letzter = heute[0]; // Route liefert neueste zuerst
        const minutenSeit = letzter ? (Date.now() - new Date(letzter.gestartet).getTime()) / MIN : Infinity;

        // Stündlich reicht. Was fällig ist, entscheidet die Uhrzeit.
        if (minutenSeit < 55) return;

        const art = artFuerStunde(h);
        // Den vollen Lauf startet der Tagesstart — der Taktgeber hält nur den
        // Takt danach. Ohne ersten Lauf heute macht er nichts.
        if (!letzter) return;

        laeuft.current = true;
        const r = await fetch('/api/tageslauf', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ art: art === 'voll' ? 'puls' : art }),
        });
        const d = await r.json() as { lauf?: { alarm?: string } };
        if (aktiv && d.lauf?.alarm) setAlarm(d.lauf.alarm);
      } catch { /* leise — der Takt versucht es in einer Stunde wieder */ }
      finally { laeuft.current = false; }
    }

    // Beim Öffnen einmal prüfen, danach alle 5 Minuten nachsehen, ob ein
    // Lauf fällig ist (der 55-Minuten-Abstand verhindert Doppel-Läufe).
    tick();
    const iv = setInterval(tick, 5 * MIN);
    return () => { aktiv = false; clearInterval(iv); };
  }, []);

  if (!alarm) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 18, right: 18, zIndex: 90, maxWidth: 380,
      background: T.panel, border: `1px solid ${T.amber}66`, borderRadius: 12,
      padding: '13px 16px', boxShadow: '0 12px 40px rgba(0,0,0,.45)',
    }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span style={{ color: T.amber, flex: '0 0 auto' }}>⚠</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: T.mono, fontSize: 9.5, letterSpacing: '.12em', textTransform: 'uppercase', color: T.amber, marginBottom: 3 }}>Wächter</div>
          <div style={{ fontSize: 13, color: T.ink, lineHeight: 1.5 }}>{alarm}</div>
          <Link href="/os/tageslauf" style={{ display: 'inline-block', marginTop: 7, fontFamily: T.mono, fontSize: 10.5, color: T.accentInk, textDecoration: 'none' }}>ansehen ›</Link>
        </div>
        <button onClick={() => setAlarm(null)} style={{ background: 'transparent', border: 'none', color: T.muted, cursor: 'pointer', fontSize: 14, padding: 0, flex: '0 0 auto' }}>✕</button>
      </div>
    </div>
  );
}
