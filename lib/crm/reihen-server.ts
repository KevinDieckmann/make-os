// ─── Markttraktion — die Reihen DIESER Instanz (Server, 14.10.) ─────────────────────────────────────────────────────────────────────
// Kevins Entscheidung 14.10.: Reihen sind Instanz-Daten (lib/crm/marke.ts). Eine neue Instanz startet ohne Reihe und legt eigene in den
// Wertelisten an; die Betreiber-Instanz (lib/betrieb/betreiber-server.ts, ohne Server-Schritt erkannt) behält ihre Reihe über die Start-
// Kennung unten — nur die KENNUNG (sie steht im Bestand), der Name entsteht aus ihr (`nameAusKennung`). Jede Liste, die Reihen anbietet
// (GET /api/crm/bestand, Planung, Stammdaten), kommt von hier; nebenbei wird die Laufzeit-Liste `EVENT_REIHEN` gesetzt.

import type { CrmBestand } from './typen';
import { reihenListe, reihenSetzen, reihenStartSetzen, type EventReihe } from './marke';

/** Start-Kennungen der Betreiber-Instanz (Altbestand) — Kennungen, keine Namen. */
export const BETREIBER_REIHEN: readonly string[] = ['fokus-innovation'];

export async function reihenDerInstanz(crm: Pick<CrmBestand, 'wertelisten' | 'events'>): Promise<EventReihe[]> {
  const { istBetreiberInstanz } = await import('@/lib/betrieb/betreiber-server');
  const start = (await istBetreiberInstanz().catch(() => false)) ? BETREIBER_REIHEN : [];
  reihenStartSetzen(start);
  const l = reihenListe({ gespeichert: crm.wertelisten?.reihen, start, events: crm.events });
  reihenSetzen(l);
  return l;
}
