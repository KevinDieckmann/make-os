// ─── WhatsApp — Lage für den Head of IT (Server, 07.10.2026 abends) ─────────────────────────────────────────────────────
// Nur Zahlen und Zustände (lib/hoi/lage.ts `whatsappBefunde`), NUR aus den eigenen Beständen — kein Aufruf bei Meta (Qualität und
// Durchsatz stammen aus dem Cache, den „Verbindung prüfen“ bzw. die Karte unter Verbindungen füllt). Nie Nummern, Profilnamen oder Texte.
// Nicht eingerichtet (WHATSAPP_* fehlen) → null → kein Befund.

import type { WhatsappLage } from '@/lib/hoi/lage';
import { whatsappKonfig } from './konfig';
import { ladeWaSpiegel, ladeWaZustand, type WaSpiegel, type WaZustand } from './spiegel';

const TAG_MS = 24 * 3600_000;

/** Lage aus Zustand und Spiegel (rein, getestet). */
export function whatsappLageAus(z: WaZustand, s: WaSpiegel, jetzt: number): WhatsappLage {
  const zuletzt = z.webhook?.zuletzt ? Date.parse(z.webhook.zuletzt) : NaN;
  const abgelehntAm = z.webhook?.zuletztAbgelehnt ? Date.parse(z.webhook.zuletztAbgelehnt) : NaN;
  const nachrichten = Object.values(s.nachrichten);
  const ab7 = jetzt - 7 * TAG_MS;
  return {
    webhookVorMin: Number.isFinite(zuletzt) ? Math.max(0, Math.floor((jetzt - zuletzt) / 60_000)) : null,
    abgelehnt: z.webhook?.abgelehnt ?? 0,
    abgelehntFrisch: Number.isFinite(abgelehntAm) && jetzt - abgelehntAm < TAG_MS,
    token: !!z.token?.fehlerAt && (!z.token.okAt || z.token.fehlerAt > z.token.okAt),
    ...(z.telefon?.qualitaet ? { qualitaet: z.telefon.qualitaet } : {}),
    ...(z.telefon?.durchsatz ? { durchsatz: z.telefon.durchsatz } : {}),
    gespraeche: Object.keys(s.kontakte).length,
    medienOffen: nachrichten.filter(n => n.medium?.zustand === 'offen').length,
    medienFehler: nachrichten.filter(n => n.medium?.zustand === 'fehler').length,
    fehlgeschlagen7d: nachrichten.filter(n => n.richtung === 'aus' && n.status === 'fehlgeschlagen' && Date.parse(n.statusAm ?? n.am) >= ab7).length,
  };
}

export async function whatsappLage(jetzt = Date.now()): Promise<WhatsappLage | null> {
  if (!whatsappKonfig()) return null;
  const [z, s] = await Promise.all([ladeWaZustand(), ladeWaSpiegel()]);
  return whatsappLageAus(z, s, jetzt);
}
