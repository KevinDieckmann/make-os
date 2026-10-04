'use client';

// ─── Gesellschaft wählen — offene Liste (04.10., Register /os/unternehmen) ─────────────────────────────────────
// EIN Baustein für Deals, Mandate und Produkte: die drei festen Gesellschaften, die aus dem Register und „offen“.
// Gespeichert bleibt die Kennung (kdc · kdv · ug · g-… · offen). Liste: lib/crm/wahl.ts `gesellschaftWahl`.

import { Wahl } from './Wahl';
import { gesellschaftWahl } from '@/lib/crm/wahl';
import { useGesellschaftenKurz } from '@/lib/gesellschaften/client';
import type { Gesellschaft } from '@/lib/crm/typen';

export function GesellschaftWahl({ wert, onWahl }: { wert: Gesellschaft; onWahl: (g: Gesellschaft) => void }) {
  const register = useGesellschaftenKurz();
  return <Wahl label="Gesellschaft" liste={gesellschaftWahl(register, wert)} wert={wert} onWahl={onWahl} />;
}
