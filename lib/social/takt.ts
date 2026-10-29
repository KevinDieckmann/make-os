// ─── MAKE OS — Social: Jobs im Takt (Server) — 27.10.2026 ────────────────────────────────────────────────────────────────────────────
// Der Takt (app/api/zoe/takt, jede Minute) hält den automatischen Ablauf am Laufen — nie blockierend, Fehler als EINE Zeile `[social] …`:
//   · Veröffentlichen: jeden Takt, aber nur mit mindestens einer aktiven Verbindung (sonst kostet es nichts).
//   · Redaktion: höchstens alle `REDAKTION_ABSTAND_STD` Stunden zwischen 6 und 22 Uhr, nur wenn ein Kanal den Agenten eingeschaltet hat —
//     Systemlauf (Hintergrund-KI-Schalter, Not-Aus und Budget des Head of Marketing gelten dort).
//   · Zahlen: einmal am Tag ab 6 Uhr.
//   · Reel-Werkstatt (28.10.): wartende Arbeit (Untertitel, Rendern) anstoßen, falls der Anstoß der Route verloren ging — rund um die Uhr,
//     nie blockierend (ein Lauf zur Zeit).

import { wandzeit } from '@/lib/kalender/zeit';
import { localDay } from '@/lib/zeit';
import { ladeSocial } from './server';
import { planVon } from './plan';
import { ladeLaufStand } from './lauf-stand';

export const REDAKTION_ABSTAND_STD = 6;
export const COMMUNITY_ABSTAND_MIN = 15;
let letzteCommunity = 0;

export async function socialJobsImTakt(jetzt = new Date()): Promise<void> {
  const { socialVeroeffentlichenLauf, socialMessenLauf } = await import('./veroeffentlichen-server');
  await socialVeroeffentlichenLauf(jetzt).catch(e => console.warn(`[social] Veröffentlichen: ${e instanceof Error ? e.name : 'Fehler'}`));
  const { werkstattAnstossen } = await import('./werkstatt/server');
  werkstattAnstossen();
  // Kommentare und DMs (28.10.): alle 15 Minuten abholen (Merker im Prozess) — vermerkt wird nur, wenn ein Kanal verbunden ist.
  if (Date.now() - letzteCommunity >= COMMUNITY_ABSTAND_MIN * 60_000) {
    letzteCommunity = Date.now();
    const { communityAbholen } = await import('./community');
    const { laufVermerken } = await import('./lauf-stand');
    void communityAbholen(undefined, jetzt)
      .then(r => (r.kanaele ? laufVermerken('community', { am: jetzt.toISOString(), gemessen: r.neu, ...(r.fehler ? { gestoppt: r.fehler.slice(0, 160) } : {}) }) : undefined))
      .catch(e => console.warn(`[social] Community: ${e instanceof Error ? e.name : 'Fehler'}`));
  }
  const stunde = Number(wandzeit(jetzt).slice(11, 13));
  if (stunde < 6 || stunde >= 22) return;
  const stand = await ladeLaufStand().catch(() => ({} as Awaited<ReturnType<typeof ladeLaufStand>>));
  if (!stand.messen || localDay(new Date(stand.messen.am)) !== localDay(jetzt)) void socialMessenLauf(jetzt).catch(e => console.warn(`[social] Zahlen: ${e instanceof Error ? e.name : 'Fehler'}`));
  const letzte = stand.redaktion && !stand.redaktion.von?.startsWith('takt') ? null : stand.redaktion;
  if (letzte && jetzt.getTime() - Date.parse(letzte.am) < REDAKTION_ABSTAND_STD * 3_600_000) return;
  const d = await ladeSocial().catch(() => null);
  if (!d?.kanaele.some(k => !k.archiviertAm && k.status === 'aktiv' && planVon(k).agent)) return;
  const { socialRedaktionLauf, redaktionLaeuft } = await import('./agent-server');
  if (redaktionLaeuft()) return;
  void socialRedaktionLauf({ person: null, jetzt }).catch(e => console.warn(`[social] Redaktion: ${e instanceof Error ? e.name : 'Fehler'}`));
}
