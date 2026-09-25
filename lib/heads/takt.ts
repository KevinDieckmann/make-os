// ─── Die Heads im Takt (rein bis auf das Laden) ────────────────────────────
// Head of Sales: werktags ab 7 Uhr die Power Hour vorbereiten, freitags ab
// 14 Uhr Wochenreview, am 1. Werktag des Monats Kundenreview.
// Head of Marketing: montags ab 8 Uhr Wochenplan, am 1. des Monats Review.
// Head of Event: Nachfassen am Tag nach einem Event, Countdown-Planung in
// den 7 Tagen davor (täglich einmal).
// Ausgeschaltet: nie. Ohne Schlüssel läuft der Takt trotzdem — dann liefert
// der Grundlauf (Regelwerk) die Vorschläge. Die Power Hour je Person im Team
// mit Konto (Riegel „power_hour:<person>“). Riegel stehen im eigenen Speicher.

import { loadJson } from '@/lib/store/local-db';
import { resolveAgent } from '@/lib/agent-config';
import type { Faellig } from '@/lib/jarvis/takt';
import { ladeCrm } from '@/lib/crm/speicher';
import { AGENT_ID, HEAD_NAME, type HeadId } from './prompt';
import { TEAM } from '@/lib/crm/team';
import { ladeKonten } from '@/lib/zugang/konten';
import { leererStand, standName, type HeadStand } from './stand';

const tag = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const liefHeute = (s: HeadStand, modus: string, heute: string) => (s.letzte[modus] ?? '').slice(0, 10) === heute;

/** Welcher Modus ist jetzt dran? Rein, getestet. */
export function faelligeModi(head: HeadId, jetzt: Date, s: HeadStand, events: { datum: string; status: string }[], personen: string[] = ['kevin']): { modus: string; grund: string; person?: string }[] {
  const heute = tag(jetzt), w = jetzt.getDay(), h = jetzt.getHours(), werktag = w >= 1 && w <= 5;
  const raus: { modus: string; grund: string; person?: string }[] = [];
  const ersterWerktag = werktag && jetzt.getDate() <= 3 && !Array.from({ length: jetzt.getDate() - 1 }, (_, i) => new Date(jetzt.getFullYear(), jetzt.getMonth(), i + 1).getDay()).some(x => x >= 1 && x <= 5);
  if (head === 'sales') {
    for (const p of personen) if (werktag && h >= 7 && !liefHeute(s, `power_hour:${p}`, heute) && !(p === 'kevin' && liefHeute(s, 'power_hour', heute))) raus.push({ modus: 'power_hour', grund: `Power Hour vorbereiten (${p.charAt(0).toUpperCase() + p.slice(1)})`, person: p });
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
  return raus.slice(0, 1); // höchstens ein Lauf je Head und Takt — die nächste Person kommt im nächsten Takt
}

export async function headsFaellig(jetzt: Date): Promise<Faellig[]> {
  const crm = await ladeCrm();
  // Nur Team-Mitglieder mit Konto bekommen eine vorbereitete Power Hour.
  const mitKonto = new Set((await ladeKonten()).konten.map(k => k.speicher));
  const personen = TEAM.map(t => t.id).filter(id => mitKonto.has(id));
  const raus: Faellig[] = [];
  for (const head of ['sales', 'marketing', 'event'] as HeadId[]) {
    if (!(await resolveAgent(AGENT_ID[head])).enabled) continue;
    const s = { ...leererStand(), ...((await loadJson<HeadStand>(standName(head))) ?? {}) };
    for (const m of faelligeModi(head, jetzt, s, crm.events, personen.length ? personen : ['kevin'])) {
      raus.push({ id: `${AGENT_ID[head]}-${m.modus}${m.person ? `-${m.person}` : ''}`, grund: `${HEAD_NAME[head]}: ${m.grund}`, auftrag: { art: 'agent', name: AGENT_ID[head], auftrag: `modus:${m.modus}${m.person ? ` person:${m.person}` : ''}`, anlass: `Takt: ${HEAD_NAME[head]} (${m.grund})` } });
    }
  }
  return raus;
}
