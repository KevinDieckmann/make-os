// ─── Die Heads im Takt (rein bis auf das Laden) ────────────────────────────
// Head of Sales: werktags ab 7 Uhr die Power Hour vorbereiten, freitags ab
// 14 Uhr Wochenreview, am 1. Werktag des Monats Kundenreview.
// Head of Marketing: montags ab 8 Uhr Wochenplan, am 1. des Monats Review.
// Head of Event: Nachfassen am Tag nach einem Event, Countdown-Planung in
// den 7 Tagen davor (täglich einmal).
// Ohne Schlüssel oder ausgeschaltet: nie. Riegel stehen im eigenen Speicher.

import { loadJson } from '@/lib/store/local-db';
import { hasAnthropicKey } from '@/lib/anthropic';
import { resolveAgent } from '@/lib/agent-config';
import type { Faellig } from '@/lib/jarvis/takt';
import { ladeCrm } from '@/lib/crm/speicher';
import { AGENT_ID, HEAD_NAME, type HeadId } from './prompt';
import { leererStand, standName, type HeadStand } from './stand';

const tag = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const liefHeute = (s: HeadStand, modus: string, heute: string) => (s.letzte[modus] ?? '').slice(0, 10) === heute;

/** Welcher Modus ist jetzt dran? Rein, getestet. */
export function faelligeModi(head: HeadId, jetzt: Date, s: HeadStand, events: { datum: string; status: string }[]): { modus: string; grund: string }[] {
  const heute = tag(jetzt), w = jetzt.getDay(), h = jetzt.getHours(), werktag = w >= 1 && w <= 5;
  const raus: { modus: string; grund: string }[] = [];
  const ersterWerktag = werktag && jetzt.getDate() <= 3 && !Array.from({ length: jetzt.getDate() - 1 }, (_, i) => new Date(jetzt.getFullYear(), jetzt.getMonth(), i + 1).getDay()).some(x => x >= 1 && x <= 5);
  if (head === 'sales') {
    if (werktag && h >= 7 && !liefHeute(s, 'power_hour', heute)) raus.push({ modus: 'power_hour', grund: 'Power Hour vorbereiten' });
    if (w === 5 && h >= 14 && !liefHeute(s, 'wochenreview', heute)) raus.push({ modus: 'wochenreview', grund: 'Wochenreview Vertrieb' });
    if (ersterWerktag && h >= 9 && !liefHeute(s, 'kundenreview', heute)) raus.push({ modus: 'kundenreview', grund: 'Kundenreview zum Monatsanfang' });
  }
  if (head === 'marketing') {
    if (w === 1 && h >= 8 && !liefHeute(s, 'wochenplan', heute)) raus.push({ modus: 'wochenplan', grund: 'Wochenplan Marketing' });
    if (ersterWerktag && h >= 10 && !liefHeute(s, 'monatsreview', heute)) raus.push({ modus: 'monatsreview', grund: 'Monatsreview Marketing' });
  }
  if (head === 'event' && h >= 8) {
    const gestern = tag(new Date(jetzt.getTime() - 864e5));
    const bald = events.some(e => e.status !== 'abgesagt' && e.datum > heute && e.datum <= tag(new Date(jetzt.getTime() + 7 * 864e5)));
    if (events.some(e => e.datum === gestern && e.status !== 'abgesagt') && !liefHeute(s, 'nachfassen', heute)) raus.push({ modus: 'nachfassen', grund: 'Nachfassen nach dem Event (48 h)' });
    if (bald && !liefHeute(s, 'planung', heute)) raus.push({ modus: 'planung', grund: 'Countdown bis zum Event' });
  }
  return raus.slice(0, 1); // höchstens ein Lauf je Head und Takt
}

export async function headsFaellig(jetzt: Date): Promise<Faellig[]> {
  if (!hasAnthropicKey()) return [];
  const crm = await ladeCrm();
  const raus: Faellig[] = [];
  for (const head of ['sales', 'marketing', 'event'] as HeadId[]) {
    if (!(await resolveAgent(AGENT_ID[head])).enabled) continue;
    const s = { ...leererStand(), ...((await loadJson<HeadStand>(standName(head))) ?? {}) };
    for (const m of faelligeModi(head, jetzt, s, crm.events)) {
      raus.push({ id: `${AGENT_ID[head]}-${m.modus}`, grund: `${HEAD_NAME[head]}: ${m.grund}`, auftrag: { art: 'agent', name: AGENT_ID[head], auftrag: `modus:${m.modus}`, anlass: `Takt: ${HEAD_NAME[head]} (${m.grund})` } });
    }
  }
  return raus;
}
