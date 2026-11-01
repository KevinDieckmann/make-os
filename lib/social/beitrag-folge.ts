// ─── Redaktionsplan ↔ Social-Folge (rein, 02.11., Marketing-Projekt M3) ─────────────────────────────────────────────────────────────
// Der Head of Marketing legt einen angenommenen Instagram-Entwurf im Redaktionsplan als Beitrag an (Kanal „sonstig“ — der Beitrag kennt keinen
// Kanal Instagram). Damit er nicht nur dort liegt, entsteht dazu EINE Social-Folge im Instagram-Kanal mit `beitragId` = Kennung des Beitrags:
// Entwurf, ohne Freigabe — veröffentlicht wird erst nach dem Klick einer Person nach den Leitplanken des Kanals. Gezählt wird die Veröffentlichung
// einmal (lib/crm/marketing.ts `veroeffentlichungen`). Idempotent über `beitragId`.

import type { SocialDatei, SocialKanal } from './typen';

/** Der Instagram-Kanal für einen Entwurf: genau EIN laufender (nicht archivierter, aktiver) Kanal mit Instagram — sonst keiner (nie raten). */
export function instagramKanalFuer(d: Pick<SocialDatei, 'kanaele'>): { kanal: SocialKanal } | { kanal: null; grund: string } {
  const l = d.kanaele.filter(k => !k.archiviertAm && k.status === 'aktiv' && k.plattformen.includes('instagram'));
  if (l.length === 1) return { kanal: l[0] };
  return { kanal: null, grund: l.length ? `Mehrere Instagram-Kanäle (${l.length}) — die Folge bitte unter Marketing › Social im richtigen Kanal anlegen.` : 'Noch kein laufender Instagram-Kanal unter Marketing › Social — der Entwurf steht nur im Redaktionsplan.' };
}

/** Steht zu diesem Beitrag schon eine Folge? */
export const folgeZumBeitrag = (d: Pick<SocialDatei, 'folgen'>, beitragId: string) => d.folgen.find(f => f.beitragId === beitragId) ?? null;

/** Der Eintrag für die Op `folge` (Server vergibt die Kennung): Entwurf mit Text, sonst Idee — nie freigegeben. */
export function folgeEintragAusBeitrag(kanalId: string, b: { id: string; titel: string; text: string; saeule?: string; mitEntwurf: boolean }): Record<string, unknown> {
  return { kanalId, titel: b.titel.slice(0, 300), skript: b.text, status: b.mitEntwurf ? 'entwurf' : 'idee', beitragId: b.id, hooks: [], quellen: [], ...(b.saeule ? { saeule: b.saeule } : {}) };
}
