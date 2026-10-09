// ─── Agenten-Bereich: eigener Auftrag an einen Head — Server-Teil (09.10.) ──────────────────────────────────────────────────────
// EINE Stelle, die entscheidet, ob der Auftrag einer Person bzw. des Haushalts gerade an das Modell geht (Regeln rein in ./auftrag.ts):
// die aktiven Kategorien des Heads für diese Person (Katalog + Einwilligung (a)+(b) + KI-Schalter — dieselbe Rechnung wie der Lauf,
// lib/agenten/werkzeuge.ts `aktiveKategorien`) und ein offener KI-Weg für die Kategorie (lib/ki/tor.ts `kategorienMoeglich`). Genutzt vom
// Lauf (lib/agenten/gespraech.ts) und von der Anzeige (GET /api/agenten, lib/agenten/faeden-server.ts) — beide sagen dasselbe.

import { kiSchalterFuer, type KiSchalter } from '@/lib/datenschutz/ki-einstellungen';
import { auftragAnKi, auftragKategorie, type AuftragKiLage } from './auftrag';
import { kategorienFuer, type KontoSicht } from './sicht';
import { aktiveKategorien } from './werkzeuge';
import type { HeadDef, KiKategorie } from './typen';

/** Ist ein KI-Weg für diese Kategorie offen? Ohne Anbieter-Tor immer ja; ein Lesefehler heißt „nein“ (der Auftrag bleibt draußen). */
async function wegOffen(k: KiKategorie): Promise<boolean> {
  if (k === 'allgemein') return true;
  const { kategorienMoeglich } = await import('@/lib/ki/tor');
  return kategorienMoeglich([k]).catch(() => false);
}

/**
 * Geht der Auftrag an diesen Head für diese Person gerade an das Modell? `kats` = schon gerechnete aktive Kategorien (der Lauf hat sie);
 * sonst werden sie hier gerechnet (Schalter der Person, Einwilligung aus der Konto-Sicht).
 */
export async function auftragLageFuer(head: HeadDef, sicht: KontoSicht, o: { kats?: readonly KiKategorie[]; schalter?: KiSchalter } = {}): Promise<AuftragKiLage> {
  const kats = o.kats ?? aktiveKategorien(kategorienFuer(head, sicht), o.schalter ?? await kiSchalterFuer(sicht.person), sicht.gesundheit.verarbeiten && sicht.gesundheit.ki);
  const kategorie = auftragKategorie(head);
  return auftragAnKi(head, { aktiv: kats, moeglich: kats.includes(kategorie) || kategorie === 'allgemein' ? await wegOffen(kategorie) : true });
}
