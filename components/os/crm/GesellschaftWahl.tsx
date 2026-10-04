'use client';

// ─── Gesellschaft wählen — offene Liste (04.10., Register /os/unternehmen) ─────────────────────────────────────
// EIN Baustein für Deals, Mandate und Produkte: die drei festen Gesellschaften, die aus dem Register und „offen“.
// Gespeichert bleibt die Kennung (kdc · kdv · ug · g-… · offen). Liste: lib/crm/wahl.ts `gesellschaftWahl`.
// Im Menü unten der Weg ins Register — zur gewählten Gesellschaft bzw. zur Liste (wie „Pflegen ›“ bei den Wertelisten).

import Link from 'next/link';
import { Wahl } from './Wahl';
import { gesellschaftWahl } from '@/lib/crm/wahl';
import { useGesellschaftenKurz } from '@/lib/gesellschaften/client';
import { istGesellschaftId } from '@/lib/einheiten';
import { FARBE as C } from '@/lib/make-one/design';
import { WEG } from '@/lib/wege';
import type { Gesellschaft } from '@/lib/crm/typen';

export function GesellschaftWahl({ wert, onWahl }: { wert: Gesellschaft; onWahl: (g: Gesellschaft) => void }) {
  const register = useGesellschaftenKurz();
  const weg = istGesellschaftId(wert) ? WEG.unternehmen(wert) : WEG.unternehmen();
  return (
    <Wahl label="Gesellschaft" liste={gesellschaftWahl(register, wert)} wert={wert} onWahl={onWahl}
      fuss={<Link href={weg} style={{ color: C.inkLeise, textDecoration: 'none', padding: '4px 2px' }}>{istGesellschaftId(wert) ? 'Im Register öffnen ›' : 'Register pflegen ›'}</Link>} />
  );
}
