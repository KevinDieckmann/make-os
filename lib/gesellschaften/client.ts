'use client';

// ─── Gesellschafts-Register im Browser: die offene Liste für Auswahlen (04.10.) ────────────────────────────────
// EIN Zwischenspeicher für alle Auswahlen (Deals, Mandate, Produkte, Planung): GET /api/gesellschaften?wahl=1 (nur Kennung,
// Name, Status — keine Cap-Table). Ändert das Register etwas, ruft es `gesellschaftenGeaendert()` — alle Auswahlen laden neu.
// Ohne Zugang oder solange es lädt: `null` — die Auswahlen zeigen dann die drei festen (lib/crm/wahl.ts `gesellschaftWahl`).

import { useEffect, useState } from 'react';
import type { GesellschaftId } from '@/lib/einheiten';
import type { GesStatus } from './modell';

export interface GesellschaftKurz { id: GesellschaftId; name: string; status?: GesStatus }
export const GESELLSCHAFTEN_EREIGNIS = 'make-gesellschaften-geaendert';

let speicher: GesellschaftKurz[] | null = null;
let laeuft: Promise<GesellschaftKurz[] | null> | null = null;

async function holen(): Promise<GesellschaftKurz[] | null> {
  if (!laeuft) {
    laeuft = fetch('/api/gesellschaften?wahl=1', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => (d?.ok && Array.isArray(d.gesellschaften) ? (speicher = d.gesellschaften as GesellschaftKurz[]) : null))
      .catch(() => null)
      .finally(() => { laeuft = null; });
  }
  return laeuft;
}

/** Nach jeder Änderung im Register aufrufen — alle offenen Auswahlen laden neu. */
export function gesellschaftenGeaendert(): void {
  speicher = null;
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(GESELLSCHAFTEN_EREIGNIS));
}

/** Die Gesellschaften des Haushalts (feste + Register) — `null`, solange nichts da ist. */
export function useGesellschaftenKurz(): GesellschaftKurz[] | null {
  const [l, setL] = useState<GesellschaftKurz[] | null>(speicher);
  useEffect(() => {
    let an = true;
    const laden = () => { void holen().then(x => { if (an) setL(x); }); };
    if (!speicher) laden();
    window.addEventListener(GESELLSCHAFTEN_EREIGNIS, laden);
    return () => { an = false; window.removeEventListener(GESELLSCHAFTEN_EREIGNIS, laden); };
  }, []);
  return l;
}
