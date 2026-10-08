// ─── WHOOP — Lage für den Head of IT (Server, 08.10.2026) ────────────────────────────────────────────────────────────────
// Nur Zähler und Zustände (lib/hoi/lage.ts `whoopBefunde`): wie viele Personen verbunden sind, wie viele getrennt, wie alt der älteste
// Abgleich ist, ob Webhooks ankommen, wie viele ohne Einwilligung warten. Nie Adressen, nie WHOOP-Kennungen, nie Werte.

import { alleSpeicher } from '@/lib/zugang/konten';
import { loadJson } from '@/lib/store/local-db';
import type { WhoopLage } from '@/lib/hoi/lage';
import { gesundheitVerarbeitungErlaubt } from '@/lib/datenschutz/gesundheit-einwilligung';
import { verbindungName, whoopKonfiguriert, whoopWebhookAdresse } from './konfig';
import { ladeWhoopStand, whoopAlter } from './abgleich';
import type { WhoopVerbindung } from './verbindung';

export async function whoopLage(jetzt = Date.now()): Promise<WhoopLage | null> {
  if (!whoopKonfiguriert()) return null;
  let personen = 0, getrennt = 0, veraltet = 0, webhook = 0, ohneEinwilligung = 0, fehler = 0;
  let vorMin: number | null = 0;
  for (const p of await alleSpeicher()) {
    const v = await loadJson<WhoopVerbindung>(verbindungName(p)).catch(() => null);
    if (!v || v.v !== 1) continue;
    personen++;
    if (v.status !== 'verbunden') { getrennt++; continue; }
    if (!(await gesundheitVerarbeitungErlaubt(p))) { ohneEinwilligung++; continue; }
    const a = whoopAlter(await ladeWhoopStand(p).catch(() => null), jetzt);
    if (a.vorMin === null) vorMin = null; else if (vorMin !== null) vorMin = Math.max(vorMin, a.vorMin);
    if (a.veraltet) veraltet++;
    if (a.fehler) fehler++;
    if (a.webhook) webhook++;
  }
  if (!personen) return null;
  return { personen, getrennt, vorMin, veraltet, fehler, webhook, ohneEinwilligung, webhookMoeglich: !!whoopWebhookAdresse() };
}
