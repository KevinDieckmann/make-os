// ─── MAKE OS — Bezüge: was der Server dafür liest (07.10., Seil) ────────────────────────────────────────────────────
// Die Ziele des GETEILTEN Bestands (`ziele`, alle Horizonte, ohne archivierte) als Karte für die Bezugs-Prüfung der
// Aufgaben/Projekte (lib/planung/bezuege.ts `aufgabenBezugPruefen`). Eigene Ziele einer Person (`ziele-eigen--…`) zählen
// bewusst nicht: eine geteilte Aufgabe nennte sonst den Titel eines privaten Ziels. Nur lesen.

import { loadJson } from '@/lib/store/local-db';
import { ZIEL_HORIZONTE, type Ziel, type ZieleDatei } from './typen';

export type ZielFuerBezug = Pick<Ziel, 'id' | 'titel' | 'space' | 'einheit' | 'oberzielId' | 'abgeleitetVon' | 'archiviertAm' | 'erledigt'>;

/** Ziele des geteilten Bestands (alle Horizonte, nicht archiviert) — Kennung → Ziel. */
export async function zieleFuerBezug(): Promise<Map<string, ZielFuerBezug>> {
  const d = await loadJson<ZieleDatei>('ziele');
  const aus = new Map<string, ZielFuerBezug>();
  for (const h of ZIEL_HORIZONTE) {
    for (const z of Array.isArray(d?.[h]) ? d![h] : []) {
      if (!z?.id || z.archiviertAm || aus.has(z.id)) continue;
      aus.set(z.id, { id: z.id, titel: z.titel, space: z.space, einheit: z.einheit, oberzielId: z.oberzielId, abgeleitetVon: z.abgeleitetVon, erledigt: z.erledigt });
    }
  }
  return aus;
}
