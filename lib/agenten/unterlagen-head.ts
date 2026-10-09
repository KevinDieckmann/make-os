// ─── Agenten-Bereich: welcher Head liest die Gesundheits-Unterlagen (09.10., client-sicher) ─────────────────────────────────────────
// Eigene Datei, weil die Oberfläche (components/os/agenten/HeadMitte.tsx) die Regel braucht und `unterlagen-werkzeug.ts` über
// lib/anthropic.ts Server-Module (fs) nachzieht — im Browser-Bündel bricht dann `next build` ab (Generalprobe 09.10.). Rein, nur Typen.

import type { HeadDef } from './typen';

/** Darf dieser Head die Gesundheits-Unterlagen seiner Person lesen? Privat, Ebene Person, Kategorie Gesundheit fest (nicht nur „mit Einwilligung“). Rein. */
export const unterlagenHead = (head: Pick<HeadDef, 'bereich' | 'ebene' | 'kategorien'>): boolean =>
  head.bereich === 'privat' && head.ebene === 'person' && head.kategorien.includes('gesundheit');
