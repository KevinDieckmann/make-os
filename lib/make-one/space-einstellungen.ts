// ─── MAKE OS — Space-Zuordnungen (26.09.): Postfächer → Privat/Business ────
// Malin: „Mails nach Empfangsadresse trennen, nicht nach Inhalt.“ Hier steht,
// welches Postfach (Apple-Konto oder Microsoft 365) zu welchem Space gehört.
// Ohne Eintrag: KEMARIS/M365 ist Business, alles andere Privat. Client-safe.

import { istSpace, type SpaceId } from './space-regeln';

export interface SpaceEinstellungen { postfaecher: Record<string, SpaceId> }
export const SPACE_EINSTELLUNGEN_LEER: SpaceEinstellungen = { postfaecher: {} };

export function spaceEinstellungenSauber(d: unknown): SpaceEinstellungen {
  const r = (d && typeof d === 'object' ? d : {}) as Record<string, unknown>;
  const aus: Record<string, SpaceId> = {};
  for (const [k, v] of Object.entries((r.postfaecher && typeof r.postfaecher === 'object' ? r.postfaecher : {}) as Record<string, unknown>).slice(0, 40)) {
    const name = String(k).trim().slice(0, 80);
    if (name && istSpace(v)) aus[name] = v;
  }
  return { postfaecher: aus };
}

/** Der Space eines Postfachs: Zuordnung, sonst KEMARIS/M365 = Business, sonst Privat. */
export function spaceVonPostfach(e: SpaceEinstellungen | null | undefined, konto: string): SpaceId {
  const fest = e?.postfaecher[konto];
  if (fest) return fest;
  return /kemaris|m365|microsoft/i.test(konto) ? 'business' : 'privat';
}
