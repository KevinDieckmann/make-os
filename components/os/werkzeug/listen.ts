'use client';

// ─── Werkzeug-Muster — Listen der Seite für das Menü (22.10. abends, Gruppe B; lib/make-one/werkzeuge.ts `liste`) ───────────────────────────────────
// Manche Unterpunkte kommen aus den Daten der Person: die Bereiche der Inbox (aus der Antwort von GET /api/inbox, die der Server nach Space filtert) und die
// Spaces der Aufgaben (aus dem Aufgaben-Bestand der Person). Die Seite legt hier NUR Kennung, Name und die Merkmale für die Regel ab (Bereich, Archiv, Zähler)
// — nie Inhalte, nie mehr, als ihre eigene Antwort schon trägt; die Leiste liest es und baut daraus die Punkte (Ziel und Regel sagt die Konfiguration).
// Verlässt man die Seite, verschwindet die Liste wieder. Gemerkt wird nichts — die Liste lebt nur im Arbeitsspeicher der offenen Seite.

import { useEffect, useSyncExternalStore } from 'react';
import type { ListenEintrag, WerkzeugListen } from '@/lib/make-one/werkzeuge';

const LEER: WerkzeugListen = Object.freeze({});
let stand: WerkzeugListen = LEER;
const hoerer = new Set<() => void>();
const melden = () => { for (const h of hoerer) h(); };

/** Die Liste eines Schlüssels setzen (null = weg). Gleicher Inhalt → nichts (die Leiste zeichnet dann nicht neu). */
export function werkzeugListeSetzen(schluessel: string, liste: readonly ListenEintrag[] | null): void {
  const alt = stand[schluessel];
  if (!liste) {
    if (!alt) return;
    const { [schluessel]: _weg, ...rest } = stand; // eslint-disable-line @typescript-eslint/no-unused-vars
    stand = rest;
    melden();
    return;
  }
  if (alt && JSON.stringify(alt) === JSON.stringify(liste)) return;
  stand = { ...stand, [schluessel]: liste };
  melden();
}

const abonnieren = (h: () => void) => { hoerer.add(h); return () => { hoerer.delete(h); }; };
/** Alle Listen (Leiste) — auf dem Server und beim ersten Zeichnen leer. */
export function useWerkzeugListen(): WerkzeugListen {
  return useSyncExternalStore(abonnieren, () => stand, () => LEER);
}

/** Die Seite legt ihre Liste ab (und nimmt sie beim Verlassen wieder weg). `liste` null = noch nicht geladen. */
export function useWerkzeugListe(schluessel: string, liste: readonly ListenEintrag[] | null): void {
  const text = liste ? JSON.stringify(liste) : '';
  useEffect(() => {
    werkzeugListeSetzen(schluessel, text ? (JSON.parse(text) as ListenEintrag[]) : null);
  }, [schluessel, text]);
  useEffect(() => () => werkzeugListeSetzen(schluessel, null), [schluessel]);
}
