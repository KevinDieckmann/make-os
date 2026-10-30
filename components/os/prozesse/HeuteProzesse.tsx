'use client';

// ─── Prozesse — die Tageszeile auf Heute (22.10.; ANALYSE_100.md Punkt 69: „Glocke nur für Freigaben und Endgültiges, Rest als Tageszeile“) ───────────────────
// „Prozesse heute: n gelaufen, m warten auf dich“ (GET /api/prozesse/laeufe?heute=1 — nur scharfe Läufe; der Server lehnt die Sicht Privat ab), mit Link zu Prozesse.
// Nur im Business-Standard von Heute (components/os/HeuteView.tsx; die Fläche bleibt `uebersicht-business`). Ohne Lauf und ohne Wartendes zeichnet sie nichts.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Workflow } from 'lucide-react';
import { FARBE as C, TYP, LEUCHT } from '@/lib/make-one/design';
import { WEG } from '@/lib/wege';
import { Karte } from '../ui';
import { heuteSatz } from '@/lib/prozesse/laeufe-ansicht';

export const HEUTE_PROZESSE_QUELLE = '/api/prozesse/laeufe?heute=1&space=business';
type Heute = { gelaufen: number; warten: number; aufDich: number; /** Probeläufe (Schatten), getrennt gezählt (30.10.). */ probe?: number };

export function ProzesseHeuteZeile({ i, titel, vorgabe }: { i?: number; titel?: string; /** Nur für Tests: die Zahlen, als kämen sie vom Server. */ vorgabe?: Heute }) {
  const [h, setH] = useState<Heute | null>(vorgabe ?? null);
  useEffect(() => {
    if (vorgabe) return;
    let an = true;
    fetch(HEUTE_PROZESSE_QUELLE, { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(j => { if (an && j?.ok && j.heute) setH(j.heute as Heute); }).catch(() => null);
    return () => { an = false; };
  }, [vorgabe]);
  const satz = heuteSatz(h);
  if (!satz) return null;
  return (
    <Karte i={i}>
      <Link href={WEG.prozesse()} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, textDecoration: 'none', color: C.ink, fontSize: TYP.body }}>
        <Workflow size={18} color={h?.aufDich ? LEUCHT.achtung : C.inkDim} aria-hidden />
        <span style={{ flex: 1, minWidth: 0 }}>{titel ? `${titel}: ${satz.replace(/^Prozesse heute: /, '')}` : satz}</span>
        <span style={{ color: C.inkLeise }} aria-hidden>›</span>
      </Link>
    </Karte>
  );
}
