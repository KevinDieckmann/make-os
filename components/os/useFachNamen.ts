'use client';
// ─── Namen der Personen-Fächer im Browser (14.10., Abnahme A1) ───────────────────────────────────────────────────────────────
// Die Fächer `kevin`/`malin` (Kennungen in Kalender-Zuordnung und Finanzplan, nie umbenennen) zeigen den Vornamen der Person dahinter —
// aus den Konten des Haushalts (`usePersonen`, Team mit `quelle: 'konto'`), Regel rein in lib/make-one/fach-namen.ts. Solange nichts
// geladen ist: „Person 1“/„Person 2“ und beide Fächer belegt (keine Auswahl springt beim Laden), nie ein fester Name.

import { useMemo } from 'react';
import { useTeam } from '@/hooks/useTeam';
import { usePersonen } from './aufgaben/hilfe';
import { fachNamen, FAECHER, type Fach } from '@/lib/make-one/fach-namen';

export function useFachNamen(): Record<Fach, string> & { belegt: Fach[] } {
  const { geladen } = useTeam();
  const personen = usePersonen();
  return useMemo(() => {
    const n = fachNamen(personen.map(p => ({ id: p.speicher, name: p.name })));
    return geladen && personen.length ? n : { ...n, belegt: [...FAECHER] };
  }, [personen, geladen]);
}
