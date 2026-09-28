'use client';

// ─── Kontakt öffnen · Reiter „Umsatz“ (28.09.) ──────────────────────────────
// Platzhalter mit fester Schnittstelle — Paket H2 baut ihn aus: Umsatz mit dem
// Kunden, Zahlungsmöglichkeiten, Verträge, Angebote, Rechnungen, Zahlungseingang.

import type { Kontakt } from '@/lib/make-one/crm';
import type { CrmApi } from '../daten';
import { Karte, Leer } from '../../schlank';

export interface UmsatzReiterProps {
  k: Kontakt;
  api: CrmApi;
  zuDeal?: (id: string) => void;
}

export function UmsatzReiter({ k }: UmsatzReiterProps) {
  return <Karte i={0}><Leer>Umsatz mit {k.vorname || k.nachname} — wird gerade gebaut.</Leer></Karte>;
}
