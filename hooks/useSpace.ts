'use client';
// Der aktive Space (Privat/Business) — aus der Adresse, sonst der zuletzt gewählte (localStorage).
// Leiste und Kopf lesen denselben Stand; ein Wechsel schickt ein Ereignis, damit beide folgen.
// Seit 08.10. (Aufräumen Etappe 1) liest der Hook die Parameter über `useSearchParams`: auf Heute wechselt nur
// `?space=` (gleicher Pfad) — mit dem alten Lesen aus `window.location` blieb der Space dort stehen.
//
// Nur zwei Bereiche (09.10., Kevin: „Oben der Knopf ‚Alles‘ kann raus — es gibt nur Business oder Privat“): `wahl` ist IMMER ein
// Space. `space` und `filter` sind seitdem dieselbe Wahl (die Felder bleiben für die Aufrufer); Listen mit eigenem Bereichs-Filter
// („Alles“ im Kalender, „alle“ in der Planung) setzen ihn selbst. Ein alter Merker „alles“ gilt als der zuletzt konkrete Space,
// sonst Business (`gemerkteWahlAus`); `bereit` sagt, ob der Merker schon gelesen ist (vorher steht die Vorgabe).
import { useCallback, useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { spaceVonAdresse, wahlVon, gemerkteWahlAus, SPACE_VORGABE, SPACE_MERKER, SPACE_ZULETZT_MERKER, SPACE_EREIGNIS, type SpaceId, type SpaceWahl } from '@/lib/make-one/spaces';
import { useNurBusiness } from '@/components/os/useInhaber';

function gemerkteWahl(): SpaceWahl {
  try { return gemerkteWahlAus(localStorage.getItem(SPACE_MERKER), localStorage.getItem(SPACE_ZULETZT_MERKER)); } catch { return SPACE_VORGABE; }
}
/** Beide Merker gleich halten — ältere Tabs lesen noch `make-space-zuletzt`. */
function merke(w: SpaceWahl) {
  try { localStorage.setItem(SPACE_MERKER, w); localStorage.setItem(SPACE_ZULETZT_MERKER, w); } catch { /* egal */ }
}

export interface SpaceStand {
  /** Der Space der Wahl (seit 09.10. = `wahl`). */
  space: SpaceId;
  /** Die Wahl im Kopf: Privat · Business. */
  wahl: SpaceWahl;
  /** Bereichs-Filter für Listen — seit 09.10. immer der Space der Wahl (eigene „alle“-Filter setzen die Seiten selbst). */
  filter: SpaceId;
  ausAdresse: SpaceId | null;
  suche: string;
  /** Der Merker ist gelesen (vorher gilt die Vorgabe Business — nichts darauf umschreiben). */
  bereit: boolean;
  setzen: (s: SpaceWahl) => void;
}

export function useSpace(): SpaceStand {
  const pfad = usePathname() ?? '/os';
  const params = useSearchParams();
  const text = params?.toString() ?? '';
  const suche = text ? `?${text}` : '';
  const [gemerkt, setGemerkt] = useState<SpaceWahl>(SPACE_VORGABE);
  // Erst nach dem ersten Lesen des Merkers schreiben — sonst überschriebe die Vorgabe die gemerkte Wahl.
  const [geladen, setGeladen] = useState(false);
  const lesen = useCallback(() => { setGemerkt(gemerkteWahl()); setGeladen(true); }, []);
  useEffect(() => { lesen(); }, [pfad, suche, lesen]);
  useEffect(() => {
    window.addEventListener(SPACE_EREIGNIS, lesen);
    return () => window.removeEventListener(SPACE_EREIGNIS, lesen);
  }, [lesen]);
  // Konto „nur Business“ (15.10., Abnahme 2 B8): immer Business — die Adresse öffnet nie den Privat-Bereich (die Seite leitet um).
  const nurBusiness = useNurBusiness() === true;
  const ausAdresse = spaceVonAdresse(pfad, suche);
  const wahl = wahlVon(pfad, suche, gemerkt, nurBusiness);
  const setzen = useCallback((s: SpaceWahl) => { merke(s); setGemerkt(s); window.dispatchEvent(new Event(SPACE_EREIGNIS)); }, []);
  // Die Adresse gewinnt: `?space=` bzw. eine Seite eines Space wird gemerkt; ein alter Merker „alles“ wird dabei konkret.
  useEffect(() => {
    if (!geladen) return;
    let roh: string | null = null;
    try { roh = localStorage.getItem(SPACE_MERKER); } catch { /* egal */ }
    if (wahl !== roh) {
      merke(wahl);
      lesen();
      window.dispatchEvent(new Event(SPACE_EREIGNIS));
    }
  }, [geladen, wahl, lesen]);
  return { space: wahl, wahl, filter: wahl, ausAdresse, suche, bereit: geladen, setzen };
}
