// ─── MAKE OS — Routinen 2: Vorlagen zum Übernehmen (rein, 10.10.) ─────────────────────────────────────────────────────────────
// Rückmeldung aus dem Onboarding (10.10.): ein Start, ohne jede Routine von Hand zu bauen. Die Vorlagen sind NEUTRAL (Plattform-Regel:
// nichts Persönliches — keine Namen, keine Beschwerden, keine Ziele einer bestimmten Person) und nur ein Vorschlag: übernommen wird erst
// per Klick, danach ist jede Routine frei änderbar. Eine leere Instanz bekommt nie etwas von selbst (Startroutinen gibt es seit 08.10. nicht
// mehr). Angelegt wird über den normalen Schreibweg (PATCH /api/state/routinen) — hier entstehen nur die Einträge.

import type { Routine, SpaceId } from './typen';
import { neueKennung } from '@/lib/kennung';

/** Eine Routine der Vorlage — ohne Kennung, Besitz, Rang, Datum (die setzt `vorlageAnlegen`). */
export type VorlageRoutine = Omit<Routine, 'id' | 'owner' | 'rang' | 'angelegtAm' | 'space' | 'aktiv'> & { aktiv?: boolean };

export interface RoutinenVorlage {
  id: 'morgen' | 'abend' | 'trinken' | 'mobility' | 'lesen';
  titel: string;
  /** Ein Satz: was die Vorlage anlegt. */
  beschreibung: string;
  routinen: VorlageRoutine[];
}

export const ROUTINEN_VORLAGEN: readonly RoutinenVorlage[] = [
  {
    id: 'morgen', titel: 'Morgenroutine', beschreibung: 'Ein ruhiger Start in drei kurzen Schritten — Wasser, bewegen, den Tag ordnen.',
    routinen: [
      { label: 'Ein Glas Wasser', wann: 'morgen', kategorie: 'gesundheit', dauerMin: 5 },
      { label: 'Fünf Minuten bewegen', wann: 'morgen', kategorie: 'gesundheit', dauerMin: 5 },
      { label: 'Den Tag ordnen', wann: 'morgen', kategorie: 'leben', dauerMin: 10, regel: { art: 'werktage' } },
    ],
  },
  {
    id: 'abend', titel: 'Abendroutine', beschreibung: 'Den Tag abschließen — Bildschirm weg, drei Dinge notieren, den Morgen vorbereiten.',
    routinen: [
      { label: 'Bildschirm weglegen', wann: 'abend', kategorie: 'erholung', dauerMin: 5 },
      { label: 'Drei gute Dinge notieren', wann: 'abend', kategorie: 'leben', dauerMin: 5 },
      { label: 'Den Morgen vorbereiten', wann: 'abend', kategorie: 'leben', dauerMin: 10 },
    ],
  },
  {
    id: 'trinken', titel: 'Trinken', beschreibung: 'Ein Zähler über den Tag: acht Gläser Wasser, jedes Glas ein Tipp.',
    routinen: [{ label: 'Wasser trinken', wann: 'tag', kategorie: 'gesundheit', dauerMin: 5, tagesZiel: 8, zaehlWort: 'Gläser' }],
  },
  {
    id: 'mobility', titel: 'Mobility', beschreibung: 'Dreimal pro Woche Beweglichkeit — an welchen Tagen, entscheidest du.',
    routinen: [{ label: 'Mobility', wann: 'abend', kategorie: 'erholung', dauerMin: 15, regel: { art: 'pro-woche', anzahl: 3 } }],
  },
  {
    id: 'lesen', titel: 'Lesen', beschreibung: 'Jeden Abend zwanzig Minuten lesen.',
    routinen: [{ label: 'Lesen', wann: 'abend', kategorie: 'leben', dauerMin: 20 }],
  },
];

/** Die Routinen einer Vorlage für eine Person (bzw. „beide“) anlegen — neue Kennungen, angelegt heute, Rang hinter den vorhandenen. */
export function vorlageAnlegen(v: RoutinenVorlage, o: { owner: string; space?: SpaceId; heute: string; rangAb: number }): Routine[] {
  return v.routinen.map((r, i) => ({
    ...r,
    id: neueKennung('r'),
    aktiv: r.aktiv !== false,
    owner: o.owner,
    ...(o.space && o.space !== 'privat' ? { space: o.space } : {}),
    rang: o.rangAb + i,
    angelegtAm: o.heute,
  }));
}
