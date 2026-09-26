// ─── Zeit & Fokus — welcher Bereich ist eine Adresse? ───────────────────────
// Eine Quelle für Anwesenheit, Fokus-Zähler und Widget: die Menüpunkte der
// Spaces (lib/make-one/spaces.ts). Was zu keinem Punkt gehört (Home, Heute,
// Wachstum, System), bekommt einen festen Namen. Client- und serverseitig nutzbar.

import { aktiverSpaceEintrag, spaceVonAdresse } from '@/lib/make-one/spaces';
import type { SpaceId } from '@/lib/make-one/space-regeln';
import { schluesselFuer, type ZeitSpace } from './modell';

export interface BereichTreffer { id: string; label: string }

const FEST: [RegExp, BereichTreffer][] = [
  [/^\/os\/?$/, { id: 'home', label: 'Home' }],
  [/^\/os\/heute/, { id: 'heute', label: 'Heute' }],
  [/^\/os\/wachstum|^\/os\/saeule/, { id: 'wachstum', label: 'Wachstum' }],
  [/^\/os\/(system|konto|datenbasis|verbindungen|bauplan|onboarding)/, { id: 'system', label: 'System' }],
  [/^\/jarvis|^\/os\/(stapel|loop)/, { id: 'jarvis', label: 'Jarvis' }],
  [/^\/os\/inbox/, { id: 'inbox', label: 'Inbox' }],
  [/^\/os\/(kalender|planung\/woche)/, { id: 'kalender', label: 'Kalender' }],
];

/** Aus „Ziele & Planung“ wird `ziele-planung`. */
export const bereichId = (label: string): string =>
  label.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function bereichVon(pfad: string, suche = ''): BereichTreffer {
  for (const [re, t] of FEST) if (re.test(pfad)) return t;
  const { eintrag } = aktiverSpaceEintrag(pfad, suche);
  if (eintrag) return { id: bereichId(eintrag.label), label: eintrag.label };
  return { id: 'sonstiges', label: 'MAKE OS' };
}

/**
 * Der Schlüssel, unter dem Zeit verbucht wird: der Space aus der Adresse gewinnt;
 * eine gemeinsame Seite (Home, Heute, Jarvis …) zählt für den Modus, in dem man
 * gerade ist (Kevin: „wenn man im privaten Modus ist, wird auch dort Zeit gemessen“).
 */
export function zeitSchluessel(pfad: string, suche: string, modus: SpaceId | null | undefined): { schluessel: string; space: ZeitSpace; bereich: BereichTreffer } {
  const bereich = bereichVon(pfad, suche);
  const space: ZeitSpace = spaceVonAdresse(pfad, suche) ?? modus ?? 'gemeinsam';
  return { schluessel: schluesselFuer(space, bereich.id), space, bereich };
}
