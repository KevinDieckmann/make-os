'use client';

// ─── Fulfillment — Platzhalter „kommt mit Paket Cx“ (C0, 10.10.) ───────────────────────────────────────────────────────────────────────
// Die Stub-Komponenten der Pakete (components/os/fulfillment/{prozesse,kunde,analyse}/index.tsx) zeigen bis zu ihrem Bau genau diesen Leerzustand.
// Gehört C0; die Pakete ersetzen ihre Stubs und brauchen ihn danach nicht mehr.

import { Leerzustand, LEUCHT } from '../ui';

export function KommtMit({ paket, was }: { paket: 'C1' | 'C2' | 'C3'; was: string }) {
  return (
    <Leerzustand symbol="◎" ton={LEUCHT.business} titel={was}>
      Kommt mit Paket {paket}.
    </Leerzustand>
  );
}
