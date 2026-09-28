'use client';

// ─── Kontakt öffnen · Reiter „Aktivitäten“ (28.09.) ─────────────────────────
// Platzhalter mit fester Schnittstelle — Paket H3 baut ihn aus (HubSpot-Vorbild:
// Alle · Notizen · E-Mails · Anrufe · Aufgaben · Meetings, Suche, Filter).

import type { Kontakt } from '@/lib/make-one/crm';
import type { CrmApi } from '../daten';
import { Karte, Leer } from '../../schlank';

export interface AktivitaetenReiterProps {
  k: Kontakt;
  api: CrmApi;
  /** Welcher Unter-Reiter offen ist (aus der Adresse), z. B. „notizen“. */
  unter?: string | null;
  onUnter?: (u: string) => void;
  zuKontakt?: (id: string) => void;
}

export function AktivitaetenReiter({ k }: AktivitaetenReiterProps) {
  return <Karte i={0}><Leer>Aktivitäten von {k.vorname || k.nachname} — wird gerade gebaut.</Leer></Karte>;
}
