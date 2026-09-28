'use client';

// ─── Markttraktion · Angebot (Schnellknopf, 28.09.) ─────────────────────────
// Platzhalter mit fester Schnittstelle — Paket A1 baut das Angebots-Tool aus:
// Kontakt/Firma/Deal wählen, Produkte zusammenklicken, anpassen, Vorschau
// (Mail klein + Angebot groß), Senden = Mail-Programm + PDF.

import type { CrmApi } from '../daten';
import { Karte, Leer } from '../../schlank';

export interface AngebotStartProps {
  api: CrmApi;
  /** Vorbelegung aus der Adresse bzw. dem Aufrufer (Kontakt öffnen, Deal-Akte). */
  kontaktId?: string | null;
  firmaId?: string | null;
  dealId?: string | null;
  /** Ein bestehendes Angebot öffnen (Kennung aus der Adresse `k`). */
  angebotId?: string | null;
  zuKontakt?: (id: string) => void;
  zuDeal?: (id: string) => void;
}

export function AngebotStart(_: AngebotStartProps) {
  return <Karte i={0}><Leer>Angebots-Tool — wird gerade gebaut.</Leer></Karte>;
}
