// ─── Head of Finance im Takt ────────────────────────────────────────────────
// Je echtem Haushalt ein Lauf mit Haushalt (benannt über ein Mitglied — so
// greift dieselbe strenge Prüfung wie bei jedem anderen Zugriff). Gibt es
// keinen Haushalt, läuft er nur für Business. Ohne Schlüssel oder
// ausgeschaltet: gar nicht — sonst stünde jede Minute ein Auftrag an, der
// scheitert. Der Test-Haushalt und Probeläufe bekommen nie einen Takt.

import { loadJson } from '@/lib/store/local-db';
import { hasAnthropicKey } from '@/lib/anthropic';
import { resolveAgent } from '@/lib/agent-config';
import { ladeKonten } from '@/lib/zugang/konten';
import type { Faellig } from '@/lib/jarvis/takt';
import { HAUSHALT_OK } from '../haushalt/zugriff';
import { istEchterHaushalt } from '../haushalt/aufgaben';
import { heuteBerlin, tagPlus } from '../haushalt/monat';
import { faelligerModus } from './plan';
import { steuertermine } from './steuertermine';
import { ladeEinstellung } from './lauf';
import { leererStand, standName, type ChefStand } from './stand';

/** Haushalt → ein Mitglied (alphabetisch erstes Konto), nur echte Haushalte. */
export function haushalteAus(konten: { speicher: string; haushalt?: string }[]): Map<string, string> {
  const raus = new Map<string, string>();
  for (const k of konten.slice().sort((a, b) => a.speicher.localeCompare(b.speicher))) {
    if (k.haushalt && HAUSHALT_OK.test(k.haushalt) && istEchterHaushalt(k.haushalt) && !raus.has(k.haushalt)) raus.set(k.haushalt, k.speicher);
  }
  return raus;
}

export async function finanzchefFaellig(jetzt: Date): Promise<Faellig[]> {
  if (!hasAnthropicKey()) return [];
  if (!(await resolveAgent('finanzchef')).enabled) return [];
  const heute = heuteBerlin(jetzt);
  const einstellung = await ladeEinstellung();
  const termine = steuertermine(heute, tagPlus(heute, 60), einstellung.steuer);
  const haushalte = haushalteAus((await ladeKonten()).konten);
  const ziele: [string | null, string | null][] = haushalte.size ? Array.from(haushalte.entries()) : [[null, null]];
  const raus: Faellig[] = [];
  for (const [haushalt, person] of ziele) {
    const stand = { ...leererStand(), ...((await loadJson<ChefStand>(standName(haushalt))) ?? {}) };
    const m = faelligerModus(stand, heute, jetzt.getDay(), jetzt.getHours(), termine, jetzt);
    if (!m) continue;
    raus.push({
      id: `finanzchef-${haushalt ?? 'business'}`,
      grund: `Head of Finance: ${m.grund}`,
      auftrag: { art: 'agent', name: 'finanzchef', auftrag: `modus:${m.modus}${person ? ` person:${person}` : ''}`, anlass: `Takt: Head of Finance (${m.grund})` },
    });
  }
  return raus;
}
