'use client';
// Der aktive Space (Privat/Business) — aus der Adresse, sonst der zuletzt gewählte (localStorage).
// Leiste und Kopf lesen denselben Stand; ein Wechsel schickt ein Ereignis, damit beide folgen.
// Seit 08.10. (Aufräumen Etappe 1) liest der Hook die Parameter über `useSearchParams`: auf Heute wechselt nur
// `?space=` (gleicher Pfad) — mit dem alten Lesen aus `window.location` blieb der Space dort stehen.
//
// Nachbesserung 08.10. (Kevin: „ein Schalter, oben, mit Alles“): `wahl` = Alles · Privat · Business (der Schalter im Kopf, die
// Leiste, Heute). `space` bleibt immer ein konkreter Space (Suche, ZOE, Zeitmessung): bei „Alles“ der Space der Seite, sonst der
// zuletzt konkrete. `filter` = was Listen mit eigenem Bereichs-Filter zeigen: der Space der Adresse, sonst die Wahl („alle“ bei Alles).
import { useCallback, useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { spaceVonAdresse, wahlVon, istSpaceWahl, SPACE_MERKER, SPACE_ZULETZT_MERKER, SPACE_EREIGNIS, type SpaceId, type SpaceWahl } from '@/lib/make-one/spaces';

/** Ohne Merker gilt „Alles“ (beide Bereiche) — so startet eine neue Instanz. */
function gemerkteWahl(): SpaceWahl {
  try { const v = localStorage.getItem(SPACE_MERKER); return istSpaceWahl(v) ? v : 'alles'; } catch { return 'alles'; }
}
function zuletztKonkret(): SpaceId {
  try {
    const z = localStorage.getItem(SPACE_ZULETZT_MERKER);
    if (z === 'privat' || z === 'business') return z;
    const w = localStorage.getItem(SPACE_MERKER);
    return w === 'business' ? 'business' : 'privat';
  } catch { return 'privat'; }
}
function merke(w: SpaceWahl) {
  try {
    localStorage.setItem(SPACE_MERKER, w);
    if (w !== 'alles') localStorage.setItem(SPACE_ZULETZT_MERKER, w);
  } catch { /* egal */ }
}

export interface SpaceStand {
  /** Immer ein konkreter Space (bei „Alles“: der Space der Seite, sonst der zuletzt konkrete). */
  space: SpaceId;
  /** Die Wahl im Kopf: Alles · Privat · Business. */
  wahl: SpaceWahl;
  /** Bereichs-Filter für Listen: Space der Adresse, sonst die Wahl (`alle` bei „Alles“). */
  filter: SpaceId | 'alle';
  ausAdresse: SpaceId | null;
  suche: string;
  setzen: (s: SpaceWahl) => void;
}

export function useSpace(): SpaceStand {
  const pfad = usePathname() ?? '/os';
  const params = useSearchParams();
  const text = params?.toString() ?? '';
  const suche = text ? `?${text}` : '';
  const [gemerkt, setGemerkt] = useState<SpaceWahl>('alles');
  const [zuletzt, setZuletzt] = useState<SpaceId>('privat');
  // Erst nach dem ersten Lesen des Merkers schreiben — sonst überschriebe der Startwert „Alles“ die gemerkte Wahl.
  const [geladen, setGeladen] = useState(false);
  const lesen = useCallback(() => { setGemerkt(gemerkteWahl()); setZuletzt(zuletztKonkret()); setGeladen(true); }, []);
  useEffect(() => { lesen(); }, [pfad, suche, lesen]);
  useEffect(() => {
    window.addEventListener(SPACE_EREIGNIS, lesen);
    return () => window.removeEventListener(SPACE_EREIGNIS, lesen);
  }, [lesen]);
  const ausAdresse = spaceVonAdresse(pfad, suche);
  const wahl = wahlVon(pfad, suche, gemerkt);
  const setzen = useCallback((s: SpaceWahl) => { merke(s); setGemerkt(s); if (s !== 'alles') setZuletzt(s); window.dispatchEvent(new Event(SPACE_EREIGNIS)); }, []);
  // Die Adresse gewinnt: `?space=` bzw. eine Seite eines Space bei gemerktem Space wird gemerkt (bei „Alles“ bleibt „Alles“).
  useEffect(() => {
    if (!geladen) return;
    const vorher = gemerkteWahl();
    if (wahl !== vorher || (ausAdresse && ausAdresse !== zuletztKonkret())) {
      merke(wahl);
      if (ausAdresse) { try { localStorage.setItem(SPACE_ZULETZT_MERKER, ausAdresse); } catch { /* egal */ } }
      lesen();
      window.dispatchEvent(new Event(SPACE_EREIGNIS));
    }
  }, [geladen, wahl, ausAdresse, lesen]);
  const space: SpaceId = ausAdresse ?? (wahl === 'alles' ? zuletzt : wahl);
  const filter: SpaceId | 'alle' = ausAdresse ?? (wahl === 'alles' ? 'alle' : wahl);
  return { space, wahl, filter, ausAdresse, suche, setzen };
}
