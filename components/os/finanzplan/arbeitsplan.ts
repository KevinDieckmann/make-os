'use client';

// ─── Finanzplanung jetzt — in den Arbeitsplan schreiben ──────────────────────
// Produkte, Kosten und Szenario-Annahmen liegen im Arbeitsplan (Planszenario). Gibt es noch keinen, legt der erste
// Eintrag einen an („Arbeitsplan“ auf dem aktiven Treiber) — in derselben Änderung, also auch mit einem Klick rückgängig.

import { useCallback } from 'react';
import { neueKennung } from '@/lib/finanzen/plan/hilfen';
import { arbeitsplanVon } from '@/lib/finanzen/szenarien';
import { arbeitsplanSichern } from '@/lib/finanzen/geschaeft';
import type { Operation } from '@/lib/finanzen/plan/operationen';
import { usePlan } from './daten';

export function useArbeitsplan() {
  const { d, aendere } = usePlan();
  const ps = arbeitsplanVon(d);
  /** `bau` bekommt die Kennung des Arbeitsplans und liefert die Operationen; ein fehlender Arbeitsplan wird davor angelegt. */
  const schreibe = useCallback((bau: (id: string) => Operation[], feld: string): Promise<boolean> => {
    const s = arbeitsplanSichern(d, neueKennung('ps'), new Date().toISOString());
    return aendere([...s.vorOps, ...bau(s.id)], feld);
  }, [d, aendere]);
  return { ps, schreibe };
}
