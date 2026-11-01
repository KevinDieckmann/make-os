// ─── Social — Positionierung als Vorgabe der Markenprofile: laden (Server, 02.11., M3; Regeln rein in ./marke-vorgabe.ts) ──────────────

import { markeMitVorgabe, markenVorgabeAus, vorgabeGilt, type MarkenVorgabe } from './marke-vorgabe';
import type { SocialKanal } from './typen';

/** Server: die Vorgabe aus der Positionierung (ein Fehler → keine Vorgabe, der Kanal bleibt, wie er ist). */
export async function markenVorgabeLaden(): Promise<MarkenVorgabe | null> {
  try {
    const [{ ladeCrm }, { einstellungAus }] = await Promise.all([import('@/lib/crm/speicher'), import('@/lib/crm/marketing')]);
    return markenVorgabeAus(einstellungAus(await ladeCrm()));
  } catch { return null; }
}
export async function kanalMitMarkenVorgabe<K extends Pick<SocialKanal, 'art' | 'marke'>>(k: K): Promise<K> {
  return vorgabeGilt(k) ? markeMitVorgabe(k, await markenVorgabeLaden()) : k;
}
