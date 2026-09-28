'use client';

// ─── Die Mandate als Kurzform im Browser (28.09.) ───────────────────────────
// Ein gemeinsamer Abruf von /api/crm/mandat-wahl für alle Mandat-Chips
// (components/os/zeit/MandatWahl.tsx) und Mandant-Links (components/os/crm/MandantLink.tsx):
// einmal je Minute im Fenster gemerkt, gleichzeitige Abrufe teilen sich eine Anfrage.
// Wer keinen Zugang zum CRM hat (nicht im Haushalt des Inhabers), bekommt `zugang: false`.

import { useEffect, useMemo, useState } from 'react';
import type { MandatKurz } from '@/lib/planung/mandat';

export interface MandateStand { mandate: MandatKurz[]; zugang: boolean }
const HALTBAR_MS = 60_000;
let zwischen: { t: number; w: MandateStand } | null = null;
let unterwegs: Promise<MandateStand> | null = null;

function holen(): Promise<MandateStand> {
  if (zwischen && Date.now() - zwischen.t < HALTBAR_MS) return Promise.resolve(zwischen.w);
  unterwegs ??= fetch('/api/crm/mandat-wahl', { cache: 'no-store' })
    .then(async r => {
      const d = (await r.json().catch(() => null)) as { ok?: boolean; mandate?: MandatKurz[] } | null;
      const w: MandateStand = { mandate: d?.ok && Array.isArray(d.mandate) ? d.mandate : [], zugang: r.ok && !!d?.ok };
      zwischen = { t: Date.now(), w };
      return w;
    })
    .catch(() => ({ mandate: [], zugang: false }))
    .finally(() => { unterwegs = null; });
  return unterwegs;
}

/** Die Mandate als Kurzform (und ob es Zugang gibt) — geteilt von allen Chips und Links im Fenster. */
export function useMandate(): MandateStand & { geladen: boolean; karte: ReadonlyMap<string, MandatKurz> } {
  const [w, setW] = useState<MandateStand | null>(zwischen?.w ?? null);
  useEffect(() => { let aktiv = true; void holen().then(x => { if (aktiv) setW(x); }); return () => { aktiv = false; }; }, []);
  const karte = useMemo(() => new Map((w?.mandate ?? []).map(m => [m.id, m])), [w]);
  return { mandate: w?.mandate ?? [], zugang: w?.zugang ?? false, geladen: !!w, karte };
}
