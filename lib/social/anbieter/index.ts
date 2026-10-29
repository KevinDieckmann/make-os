// ─── MAKE OS — Social: welcher Anbieter für welche Verbindung (Server) — 27.10.2026 ───────────────────────────────────────────────────
import type { SocialPlattform } from '../typen';
import type { AnbieterId, SocialAnbieter } from './typen';
import { probeAnbieter } from './probe';

/** Der Anbieter einer Verbindung — null, wenn es ihn (in dieser Instanz) nicht gibt. */
export async function anbieterFuer(id: AnbieterId, plattform: SocialPlattform): Promise<SocialAnbieter | null> {
  if (id === 'probe') return probeAnbieter(plattform);
  if (id === 'linkedin' && plattform === 'linkedin') {
    const m = await import('./linkedin').catch(() => null);
    return m?.linkedinAnbieter ?? null;
  }
  if (id === 'instagram' && plattform === 'instagram') {
    const m = await import('./instagram').catch(() => null);
    return m?.instagramAnbieter ?? null;
  }
  return null;
}
