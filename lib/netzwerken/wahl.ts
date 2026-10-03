// ─── Netzwerken — die gemerkte Wahl „Heute bei“ (rein, client-sicher, getestet; 03.10.) ───
// Die Wahl liegt im Browser (localStorage, nur Komfort). Ob das Event noch „lokal“ ist (ohne Netz angelegt, der Server kennt es nicht), steht
// dort nur als Merker vom Anlegen — gelesen wird es LIVE aus dem Event-Bestand: sobald das Event dort steht (die Erfassung ging raus, der Bestand ist neu
// geladen), ist es nicht mehr lokal. Sonst bliebe „wird beim Speichern angelegt“ und die „Für wen“-Änderung ginge ins Leere (H2).

import type { EventFuer } from '@/lib/crm/typen';

export interface WahlMerker { eventId: string; lokal?: boolean }

/** `lokal` live ableiten: nur wenn der Merker gesetzt ist UND das Event im geladenen Bestand fehlt. Ohne geladenen Bestand (offline) gilt der Merker. */
export function lokalAbleiten<T extends WahlMerker>(w: T, events: readonly { id: string }[] | undefined): T {
  if (!w.lokal || !events || !events.some(x => x.id === w.eventId)) return w;
  const { lokal: _l, ...rest } = w;
  return rest as T;
}

/** „Für wen“ so, wie es in `eventNeu.fuer` gehört (MAKE steht nie drin). */
export const fuerFuerEventNeu = (f: EventFuer): EventFuer | undefined => (f.art === 'kunde' ? f : undefined);
