// ─── MAKE OS — Social: Probe-Anbieter (Demo und Tests) — 27.10.2026 ───────────────────────────────────────────────────────────────────
// Zeigt den vollautomatischen Weg von Ende zu Ende, ohne dass etwas MAKE OS verlässt: „veröffentlicht“ wird nur im eigenen Bestand
// (Kennung `probe-…`), die Zahlen sind ausdrücklich keine — `messen` liefert nichts (nie erfundene Zahlen). Nur in einer Demo-Instanz
// (`MAKE_OS_DEMO=1`) oder in Tests verfügbar (`probeErlaubt`), nie in einer echten Instanz.

import { randomUUID } from 'node:crypto';
import { nurText, type SocialAnbieter } from './typen';
import { folienAus } from './karussell-pdf';
import type { SocialPlattform } from '../typen';

export const probeErlaubt = (): boolean => process.env.MAKE_OS_DEMO === '1' || process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';

export const probeAnbieter = (plattform: SocialPlattform): SocialAnbieter => ({
  id: 'probe', plattform, name: 'Probe (nichts verlässt MAKE OS)',
  // Wie LinkedIn: Text und Karussell (als PDF aus den Folien) gehen ohne eigene Datei, Video/Bild nicht.
  // Instagram, TikTok und YouTube nehmen keinen reinen Text — dort sagt die Probe ehrlich „von Hand“ (wie es ein echter Anbieter auch täte).
  kann: (f, format) => (plattform !== 'linkedin' ? { ok: false, grund: 'Diese Plattform braucht eine Bild- oder Videodatei — MAKE OS erzeugt sie (noch) nicht.' }
    : (format?.art ?? 'video') === 'karussell' && folienAus(f.skript).length >= 2 ? { ok: true } : nurText(f, format)),
  async posten() {
    if (!probeErlaubt()) return { ok: false, text: 'Probe-Verbindung gibt es nur in einer Demo-Instanz.' };
    return { ok: true, externeId: `probe-${randomUUID()}` };
  },
  async messen() { return null; },
});
