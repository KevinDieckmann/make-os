// ─── Wer handelt für eine Welt, wenn kein Mensch auslöst? (nur Server — 02.11., Marketing-Projekt M2 B4) ────────────────────────────────
// Systemläufe einer Welt (Social-Redaktion, Auto-Antworten, Auto-Reel für Firmenkanäle) liefen als Haupt-Inhaber (`inhaberSpeicher()`) — also im
// Namen der Person, die Sales verantwortet, nicht der, die Marketing führt (KI-Protokoll, Glocken, Einwilligungen, Schalter der falschen Person).
// Regel: die/der Verantwortliche der Welt laut Team (lib/crm/team.ts `verantwortlich`, aus den Konten bzw. der Instanz-Einstellung) — aber nur,
// wenn das ein Konto im Haushalt der Inhaber ist (Rollen-Platzhalter oder ein Kürzel ohne Konto zählen nie). Sonst Rückfall auf den Inhaber.
// Nie ein fester Name.

import type { Welt } from './traktion';
import { verantwortlich } from './team';
import { imHaushaltDerInhaber, hauptInhaber } from '@/lib/zugang/inhaber';

export async function verantwortlichePerson(welt: Welt): Promise<string | null> {
  const { ladeKonten } = await import('@/lib/zugang/konten');
  const st = await ladeKonten();   // zieht das Team aus den Konten nach (teamSetzen) — danach gilt `verantwortlich` für diese Instanz
  const v = verantwortlich(welt);
  if (st.konten.some(k => k.speicher === v) && imHaushaltDerInhaber(st, v)) return v;
  return hauptInhaber(st)?.speicher ?? null;
}
