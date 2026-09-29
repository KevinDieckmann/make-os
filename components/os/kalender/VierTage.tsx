'use client';

// ─── Kalender: 4-Tage-Ansicht (29.09., Paket K2) ────────────────────────────
// Wie Googles „4 Tage“: das Raster der Woche mit vier Spalten ab dem gewählten Tag — alles, was das Raster kann
// (Klick legt an, Ziehen verschiebt, Ganztags-Zeile mit Feiertagen/Geburtstagen), kommt aus `Zeitraster`.
// Blättern springt um vier Tage (Kalender.tsx), Kürzel „x“.

import type { ComponentProps } from 'react';
import { tagPlus } from '@/lib/kalender/zeit';
import { Zeitraster } from './Zeitraster';

/** Die vier Tage ab `start`. */
export const vierTageAb = (start: string): string[] => Array.from({ length: 4 }, (_, i) => tagPlus(start, i));

export function VierTage({ start, ...rest }: { start: string } & Omit<ComponentProps<typeof Zeitraster>, 'tage'>) {
  return <Zeitraster tage={vierTageAb(start)} {...rest} />;
}
