'use client';

// ─── MAKE OS — Übersicht je Space (26.09., Kevin: „Privat und Business separat
// aufbauen, sodass es separat funktioniert“) ────────────────────────────────
// Jeder Space hat sein eigenes Dashboard — dieselbe Fläche wie Home, aber nur
// mit dem, was zu diesem Space gehört. Jede Person gestaltet es über „Anpassen“.

import { useSearchParams } from 'next/navigation';
import { Seite, ZielBezug } from './ui';
import { Flaeche } from './flaeche/Flaeche';
import { spaceVon } from '@/lib/make-one/spaces';
import type { StandardPlatz } from '@/lib/flaeche/modell';

const STANDARD: Record<'privat' | 'business', StandardPlatz[]> = {
  privat: [
    { id: 'index', art: 'index', breite: 2, einstellungen: { saeule: 'privat' } },
    { id: 'fokus', art: 'fokus', breite: 2, einstellungen: { space: 'privat' } },
    { id: 'koerper', art: 'koerper', breite: 2 },
    { id: 'aufgaben', art: 'aufgaben', breite: 4, einstellungen: { space: 'privat', nur: 'dran' } },
    { id: 'finanzen-privat', art: 'finanzen-privat', breite: 2 },
    { id: 'termine', art: 'termine', breite: 4, einstellungen: { tage: 3, space: 'privat' }, titel: 'Nächste 3 Tage · Privat' },
    { id: 'familie', art: 'familie', breite: 2 },
    { id: 'essen', art: 'essen', breite: 2 },
    { id: 'routinen', art: 'routinen', breite: 2 },
    { id: 'zoe', art: 'zoe', breite: 2, einstellungen: { inbox: true } },
  ],
  business: [
    { id: 'index', art: 'index', breite: 2, einstellungen: { saeule: 'business' } },
    { id: 'fokus', art: 'fokus', breite: 2, einstellungen: { space: 'business' } },
    { id: 'traktion', art: 'index', breite: 2, einstellungen: { saeule: 'traktion' } },
    { id: 'aufgaben', art: 'aufgaben', breite: 4, einstellungen: { space: 'business', nur: 'dran' } },
    { id: 'dran', art: 'dran', breite: 2 },
    { id: 'termine', art: 'termine', breite: 4, einstellungen: { tage: 3, space: 'business', business: true }, titel: 'Nächste 3 Tage · Business' },
    { id: 'zoe', art: 'zoe', breite: 2, einstellungen: { inbox: true } },
    { id: 'score', art: 'score', breite: 2 },
  ],
};

export function SpaceUebersichtView() {
  const p = useSearchParams().get('space');
  const space = p === 'business' ? 'business' : 'privat';
  const s = spaceVon(space);
  return (
    <Seite titel={s.label} unter={space === 'privat' ? 'Dein privater Überblick: Familie, Gesundheit, Zahlen, Aufgaben — über „Anpassen“ frei gestaltbar.' : 'Dein Business-Überblick: Index, Markttraktion, Aufgaben, Termine — über „Anpassen“ frei gestaltbar.'}>
      {space === 'privat' && <ZielBezug bereich="privat" max={2} />}
      <Flaeche key={space} seite={`uebersicht-${space}`} widgets={STANDARD[space]} />
    </Seite>
  );
}
