// ─── MAKE OS — Social: Stand der automatischen Läufe (Server) — 27.10.2026 ──────────────────────────────────────────────────────────
// Bestand `social-lauf--<haushalt>`: je Lauf-Art (Redaktion, Veröffentlichen, Messen) der letzte Lauf — Zeit, Zahlen, Grund, falls er
// stoppte. Keine Inhalte, keine Personen außer dem Speichernamen der auslösenden Person. Die Oberfläche zeigt ihn unter „Automatik“; der
// Takt liest daraus, wann er wieder dran ist.

import { loadJson, updateJson } from '@/lib/store/local-db';
import { HAUSHALT_OK } from '@/lib/finanzen/haushalt/zugriff';
import { haushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';

export type LaufArt = 'redaktion' | 'veroeffentlichen' | 'messen' | 'community';
export interface LaufEintrag { am: string; von?: string; geschrieben?: number; eingeplant?: number; gepostet?: number; fehler?: number; gemessen?: number; gestoppt?: string; uebersprungen?: { kanalId: string; grund: string }[] }
export type LaufStand = Partial<Record<LaufArt, LaufEintrag>>;

export const laufSpeicherFuer = (h: string | null | undefined) => (h && HAUSHALT_OK.test(h) ? `social-lauf--${h}` : 'social-lauf--inhaber');

export async function ladeLaufStand(): Promise<LaufStand> {
  return (await loadJson<LaufStand>(laufSpeicherFuer(await haushaltDesInhabers()))) ?? {};
}

export async function laufVermerken(art: LaufArt, e: LaufEintrag): Promise<void> {
  await updateJson<LaufStand>(laufSpeicherFuer(await haushaltDesInhabers()), cur => ({ ...(cur ?? {}), [art]: e }));
}
