// ─── Kalender — Uhrzeit in der Zeitzone des Gasts (rein, client-sicher, R-K2 #74, 29.09.) ─
// Die Buchungsseite zeigt Berliner Wandzeit („Zeiten in deutscher Zeit“). Sitzt der Gast woanders (Zone aus
// `Intl.DateTimeFormat().resolvedOptions().timeZone` im Browser — nie gespeichert, nie an den Server), steht die
// zweite Angabe daneben: „10:00 · 04:00 bei Ihnen (New York)“. Gerechnet über den echten Zeitpunkt (`ausWandzeit`),
// damit die Wochen, in denen nur eine Seite umgestellt hat (März/Oktober), stimmen.

import { ausWandzeit, ZONE } from './zeit';

export interface GastZeit { tag: string; zeit: string; /** Weicht Tag oder Uhrzeit von Berlin ab? */ abweichend: boolean }

/** Ist die Zone gültig? (Intl kennt sie) */
export function zoneOk(zone: string | null | undefined): zone is string {
  if (!zone || zone.length > 64) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: zone }); return true; } catch { return false; }
}

/** Berliner Wandzeit → Tag + Uhrzeit in `zone`. null bei ungültiger Zone oder Wandzeit. */
export function gastZeit(wand: string, zone: string): GastZeit | null {
  if (!zoneOk(zone)) return null;
  let d: Date;
  try { d = ausWandzeit(wand); } catch { return null; }
  const t: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d)) if (p.type !== 'literal') t[p.type] = p.value;
  const tag = `${t.year}-${t.month}-${t.day}`, zeit = `${t.hour}:${t.minute}`;
  return { tag, zeit, abweichend: tag !== wand.slice(0, 10) || zeit !== wand.slice(11, 16) };
}

/** Braucht die Seite eine zweite Zeitangabe? Nur, wenn die Zone nicht Berlin ist und gültig. */
export const zweiteZone = (zone: string | null | undefined): zone is string => zoneOk(zone) && zone !== ZONE;

/** Lesbarer Ortsname einer Zone: „America/New_York“ → „New York“. */
export const zonenOrt = (zone: string) => (zone.split('/').pop() ?? zone).replace(/_/g, ' ');

/** „04:00“ bzw. „04:00 (Di, 06.10.)“, wenn der Tag beim Gast ein anderer ist. */
export function gastZeitText(wand: string, zone: string): string | null {
  const g = gastZeit(wand, zone);
  if (!g || !g.abweichend) return null;
  if (g.tag === wand.slice(0, 10)) return g.zeit;
  const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  return `${g.zeit} (${WD[new Date(`${g.tag}T12:00:00Z`).getUTCDay()]}, ${g.tag.slice(8, 10)}.${g.tag.slice(5, 7)}.)`;
}
