// ─── Social — die Positionierung als Vorgabe der Markenprofile (rein + Server, 02.11., Marketing-Projekt M3) ───────────────────────────
// Kevin 01.11.: „alles verbunden“. Die Positionierung (Marketing › Positionierung: Positionierung, Zielgruppe/ICP, Ton, Themensäulen) ist die
// Vorgabe für die Markenprofile der Firmen- und Personenkanäle: ein LEERES Feld im Markenprofil gilt als das Feld der Positionierung. Gespeichert
// wird nichts (die Vorgabe wirkt nur beim Lesen — Redaktions-Agent, Antwort-Vorschläge, Werkstatt — und als Platzhalter im Kanal-Formular).
// Laden (Server): ./marke-vorgabe-server.ts.
// Eigene Werte im Markenprofil gewinnen immer. Kanäle ohne Gesicht (faceless) haben ihr eigenes Thema — dort gilt keine Vorgabe.

import type { MarketingEinstellung } from '@/lib/crm/typen';
import type { SocialKanal } from './typen';

export interface MarkenVorgabe { versprechen?: string; zielgruppe?: string; ton?: string; saeulen: string[] }

/** Im Prompt höchstens so viele Zeichen je Feld (die Positionierung darf länger sein als ein Markenprofil-Feld). */
export const VORGABE_ZEICHEN = 600;
const kurz = (t: string) => { const x = t.trim(); return x.length > VORGABE_ZEICHEN ? `${x.slice(0, VORGABE_ZEICHEN - 1)}…` : x; };

export function markenVorgabeAus(e: Pick<MarketingEinstellung, 'positionierung' | 'icp' | 'ton' | 'saeulen'> | null | undefined): MarkenVorgabe | null {
  if (!e) return null;
  const v: MarkenVorgabe = {
    ...(e.positionierung?.trim() ? { versprechen: kurz(e.positionierung) } : {}),
    ...(e.icp?.trim() ? { zielgruppe: kurz(e.icp) } : {}),
    ...(e.ton?.trim() ? { ton: kurz(e.ton) } : {}),
    saeulen: (e.saeulen ?? []).map(s => s.name.trim()).filter(Boolean).slice(0, 8),
  };
  return v.versprechen || v.zielgruppe || v.ton || v.saeulen.length ? v : null;
}

/** Gilt die Vorgabe für diesen Kanal? Firmenaccount und Personenmarke ja, ein Kanal ohne Gesicht nie (fehlt `art`, gilt faceless). */
export const vorgabeGilt = (k: Pick<SocialKanal, 'art'>): boolean => k.art === 'firma' || k.art === 'person';

/** Der Kanal mit wirksamem Markenprofil: leere Felder aus der Vorgabe (derselbe Wert, wenn nichts zu ergänzen ist). */
export function markeMitVorgabe<K extends Pick<SocialKanal, 'art' | 'marke'>>(k: K, v: MarkenVorgabe | null): K {
  if (!v || !vorgabeGilt(k)) return k;
  const m = k.marke;
  const dazu = {
    ...(!m.versprechen?.trim() && v.versprechen ? { versprechen: v.versprechen } : {}),
    ...(!m.zielgruppe?.trim() && v.zielgruppe ? { zielgruppe: v.zielgruppe } : {}),
    ...(!m.ton?.trim() && v.ton ? { ton: v.ton } : {}),
    ...(!m.saeulen.length && v.saeulen.length ? { saeulen: v.saeulen } : {}),
  };
  return Object.keys(dazu).length ? { ...k, marke: { ...m, ...dazu } } : k;
}
