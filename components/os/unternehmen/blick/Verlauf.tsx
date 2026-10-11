'use client';

// ─── Unternehmen › Gesundheits-Verlauf des Schilds (11.10.) ──────────────────────────────────────────────────────────────────────────
// Je Tag ein Kästchen in der Farbe des Tons (Folge droht · bald · Lücken · im Lot) — die letzten 90 Tage, heute rechts. Den Verlauf merkt sich der Morgenlauf
// (lib/gesellschaften/schild/verlauf.ts, GET /api/gesellschaften/schild?verlauf=1, nur Zahlen); heute zählt zusätzlich der Stand von jetzt.

import { useEffect, useState } from 'react';
import { FARBE as C, TYP, RAND } from '@/lib/make-one/design';
import { verlaufReihe, type VerlaufPunkt } from '@/lib/gesellschaften/schild/verlauf';
import { TON_TEXT, type Ton } from '@/lib/gesellschaften/schild/blick';
import { tagText } from '@/lib/gesellschaften/schild/zeit';
import { TON_FARBE, klein } from './teile';

const TAGE = 90;

/** Lädt den Verlauf einmal je Ansicht. */
export function useVerlauf(): VerlaufPunkt[] | null {
  const [tage, setTage] = useState<VerlaufPunkt[] | null>(null);
  useEffect(() => {
    let lebt = true;
    void fetch('/api/gesellschaften/schild?verlauf=1', { cache: 'no-store' }).then(r => r.json()).catch(() => null)
      .then(d => { if (lebt) setTage(d?.ok ? d.tage as VerlaufPunkt[] : []); });
    return () => { lebt = false; };
  }, []);
  return tage;
}

/** Die Reihe als Kästchen — `id` = eine Gesellschaft, sonst der schlimmste Ton aller. `jetzt` = der Ton von heute (live). */
export function VerlaufStreifen({ tage, id, jetzt, heute }: { tage: VerlaufPunkt[] | null; id?: string; jetzt: Ton; heute: string }) {
  if (!tage) return <span style={klein}>Verlauf lädt …</span>;
  const reihe = verlaufReihe(tage, id).filter(x => x.tag !== heute).slice(-(TAGE - 1));
  const alle = [...reihe, { tag: heute, ton: jetzt }];
  const wechsel = alle.filter((x, i) => i > 0 && x.ton !== alle[i - 1].ton).length;
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div role="img" aria-label={`Verlauf der letzten ${alle.length} Tage: heute ${TON_TEXT[jetzt]}${wechsel ? `, ${wechsel} Wechsel` : ''}`} style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 22, overflow: 'hidden' }}>
        {alle.map(x => (
          <span key={x.tag} title={`${tagText(x.tag)}: ${TON_TEXT[x.ton]}`} style={{ flex: '0 0 auto', width: 6, height: x.ton === 'rot' ? 22 : x.ton === 'gelb' ? 16 : x.ton === 'ruhig' ? 10 : 6, borderRadius: 2, background: x.ton === 'ruhig' ? RAND.stark : TON_FARBE[x.ton], opacity: x.tag === heute ? 1 : 0.8 }} />
        ))}
      </div>
      <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>
        {alle.length < 2 ? 'Der Verlauf beginnt heute — ab jetzt merkt sich MAKE OS jeden Morgen den Stand.' : `Seit ${tagText(alle[0].tag)}: ${wechsel ? `${wechsel} Wechsel` : 'unverändert'} · heute ${TON_TEXT[jetzt]}.`}
      </span>
    </div>
  );
}
