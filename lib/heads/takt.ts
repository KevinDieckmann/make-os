// ─── Die Heads im Takt (rein bis auf das Laden) ────────────────────────────
// Head of Sales: werktags ab 7 Uhr die Power Hour vorbereiten, freitags ab
// 14 Uhr Wochenreview, am 1. Werktag des Monats Kundenreview.
// Head of Marketing: montags ab 8 Uhr Wochenplan, am 1. des Monats Review.
// Head of Event: Nachfassen am Tag nach einem Event, Countdown-Planung in
// den 7 Tagen davor (täglich einmal).
// Ausgeschaltet: nie. Ohne Schlüssel läuft der Takt trotzdem — dann liefert
// der Grundlauf (Regelwerk) die Vorschläge. Die Power Hour je Person im Team
// mit Konto (Riegel „power_hour:<person>“). Riegel stehen im eigenen Speicher.
// Business-frei (08.10., Lücke 7, lib/arbeitsrahmen/regel.ts): in einer Business-freien Zeit des Haushalts (gemeinsame Zeiten der
// Familie) ruhen alle Läufe; die Power Hour ruht für eine Person in IHRER Business-freien Zeit. Danach laufen sie von selbst
// („ab Uhrzeit X, einmal am Tag“). Fiel der ganze Rest eines Tages in die freie Zeit, holen die Wochen-/Monats-Läufe und das
// Nachfassen nach einem Event am nächsten freien Takt nach (höchstens 6 Tage zurück) — die täglichen (Power Hour, Vernetzen,
// Countdown) nicht, die kommen am nächsten Tag ohnehin neu.

import { loadJson } from '@/lib/store/local-db';
import { istNetzwerkenEvent } from '@/lib/crm/marke';
import { resolveAgent } from '@/lib/agent-config';
import type { Faellig } from '@/lib/zoe/takt';
import { ladeCrm } from '@/lib/crm/speicher';
import { AGENT_ID, HEAD_NAME, type HeadId } from './prompt';
import { TEAM } from '@/lib/crm/team';
import { ladeKonten } from '@/lib/zugang/konten';
import { leererStand, standName, type HeadStand } from './stand';
import { localDay } from '@/lib/zeit';
import { tagPlus, wandAus } from '@/lib/kalender/zeit';
import { istBusinessFrei } from '@/lib/arbeitsrahmen/regel';

const tag = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const liefHeute = (s: HeadStand, modus: string, heute: string) => (s.letzte[modus] ?? '').slice(0, 10) === heute;
/** Lief der Modus am Tag `ab` oder später? */
const liefSeit = (s: HeadStand, modus: string, ab: string) => (s.letzte[modus] ?? '').slice(0, 10) >= ab;

/** Business-frei für die Heads (Lücke 7) — ohne Angabe laufen sie wie bisher. */
export interface HeadsRahmen {
  /** Ist der Haushalt JETZT Business-frei? Dann ruhen alle Modi ohne Person. */
  haushaltFrei: boolean;
  /** Personen, die JETZT Business-frei sind — ihre Power Hour ruht. */
  personFrei: ReadonlySet<string>;
  /** War der Haushalt am Tag `tag` (lokal) um `stunde` Uhr Business-frei? Fürs Nachholen verpasster Wochen-/Monatsläufe. */
  warFrei: (tag: string, stunde: number) => boolean;
}

/** Welcher Modus ist jetzt dran? Rein, getestet. */
export function faelligeModi(head: HeadId, jetzt: Date, s: HeadStand, alleEvents: { datum: string; status: string; marke?: string }[], personen: string[] = ['kevin'], rahmen?: HeadsRahmen): { modus: string; grund: string; person?: string }[] {
  // Business-frei (Lücke 7): solange der Haushalt frei ist, ruht jeder Head-Lauf — danach kommt er von selbst bzw. holt nach.
  if (rahmen?.haushaltFrei) return [];
  const roh = faelligeModiRoh(head, jetzt, s, alleEvents, personen, rahmen?.personFrei);
  if (roh.length || !rahmen) return roh;
  return nachholen(head, jetzt, s, alleEvents, rahmen).slice(0, 1);
}

/** Tage vor heute (1 … 6), an denen `passt(tag, datum)` gilt — jüngster zuerst. */
function letzteTage(jetzt: Date, passt: (d: Date) => boolean): string[] {
  const raus: string[] = [];
  for (let k = 1; k <= 6; k++) { const d = new Date(jetzt.getTime() - k * 864e5); if (passt(d)) raus.push(tag(d)); }
  return raus;
}
const ersterWerktagVon = (d: Date) => { const w = d.getDay(); return w >= 1 && w <= 5 && !Array.from({ length: d.getDate() - 1 }, (_, i) => new Date(d.getFullYear(), d.getMonth(), i + 1).getDay()).some(x => x >= 1 && x <= 5); };

/**
 * Verpasste Wochen-/Monatsläufe und Nachfassen nach einem Event — nur, wenn der geplante Zeitpunkt in einer Business-freien Zeit
 * des Haushalts lag und der Lauf seitdem nicht lief. Rein (der Aufrufer prüft, dass JETZT nicht Business-frei ist).
 */
function nachholen(head: HeadId, jetzt: Date, s: HeadStand, alleEvents: { datum: string; status: string; marke?: string }[], r: HeadsRahmen): { modus: string; grund: string }[] {
  const raus: { modus: string; grund: string }[] = [];
  const pruefe = (modus: string, grund: string, tage: string[], stunde: number) => {
    const d = tage.find(t => r.warFrei(t, stunde));
    if (d && !liefSeit(s, modus, d)) raus.push({ modus, grund: `${grund} (nachgeholt nach Business-frei)` });
  };
  if (head === 'sales') {
    pruefe('wochenreview', 'Wochenreview Vertrieb', letzteTage(jetzt, d => d.getDay() === 5), 14);
    pruefe('lead_review', 'Leads qualifizieren (Wochenstart)', letzteTage(jetzt, d => d.getDay() === 1), 9);
    pruefe('kundenreview', 'Kundenreview zum Monatsanfang', letzteTage(jetzt, d => ersterWerktagVon(d) && d.getMonth() === jetzt.getMonth()), 9);
  }
  if (head === 'marketing') {
    pruefe('wochenplan', 'Wochenplan Marketing', letzteTage(jetzt, d => d.getDay() === 1), 8);
    pruefe('monatsreview', 'Monatsreview Marketing', letzteTage(jetzt, d => ersterWerktagVon(d) && d.getMonth() === jetzt.getMonth()), 10);
  }
  if (head === 'event') {
    const events = alleEvents.filter(e => !istNetzwerkenEvent(e) && e.status !== 'abgesagt');
    const tageNachEvent = letzteTage(jetzt, d => events.some(e => e.datum === tag(new Date(d.getTime() - 864e5))));
    pruefe('nachfassen', 'Nachfassen nach dem Event (48 h)', tageNachEvent, 8);
  }
  return raus;
}

function faelligeModiRoh(head: HeadId, jetzt: Date, s: HeadStand, alleEvents: { datum: string; status: string; marke?: string }[], personen: string[], personFrei: ReadonlySet<string> = new Set()): { modus: string; grund: string; person?: string }[] {
  // Fremde Veranstaltungen aus „Netzwerken“ (Marke „Netzwerken“) sind keine Make.One-Events: kein Nachfassen/Countdown dafür.
  const events = alleEvents.filter(e => !istNetzwerkenEvent(e));
  const heute = tag(jetzt), w = jetzt.getDay(), h = jetzt.getHours(), werktag = w >= 1 && w <= 5;
  const raus: { modus: string; grund: string; person?: string }[] = [];
  const ersterWerktag = werktag && jetzt.getDate() <= 3 && !Array.from({ length: jetzt.getDate() - 1 }, (_, i) => new Date(jetzt.getFullYear(), jetzt.getMonth(), i + 1).getDay()).some(x => x >= 1 && x <= 5);
  if (head === 'sales') {
    for (const p of personen) if (werktag && h >= 7 && !personFrei.has(p) && !liefHeute(s, `power_hour:${p}`, heute) && !(p === 'kevin' && liefHeute(s, 'power_hour', heute))) raus.push({ modus: 'power_hour', grund: `Power Hour vorbereiten (${p.charAt(0).toUpperCase() + p.slice(1)})`, person: p });
    if (w === 5 && h >= 14 && !liefHeute(s, 'wochenreview', heute)) raus.push({ modus: 'wochenreview', grund: 'Wochenreview Vertrieb' });
    if (w === 1 && h >= 9 && !liefHeute(s, 'lead_review', heute)) raus.push({ modus: 'lead_review', grund: 'Leads qualifizieren (Wochenstart)' });
    if (ersterWerktag && h >= 9 && !liefHeute(s, 'kundenreview', heute)) raus.push({ modus: 'kundenreview', grund: 'Kundenreview zum Monatsanfang' });
  }
  if (head === 'marketing') {
    if (w === 1 && h >= 8 && !liefHeute(s, 'wochenplan', heute)) raus.push({ modus: 'wochenplan', grund: 'Wochenplan Marketing' });
    // LinkedIn (25.09.): werktags ab 8 Uhr die Vernetzen-Portion planen — reines Regelwerk, kostet kein Guthaben.
    if (werktag && h >= 8 && !liefHeute(s, 'netzwerk', heute)) raus.push({ modus: 'netzwerk', grund: 'Netzwerk: Vernetzen-Runde für heute planen' });
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

/** Der Rahmen für die Heads (Lücke 7) — Fehler beim Lesen → kein Rahmen (wie bisher). */
async function headsRahmen(jetzt: Date, personen: readonly string[]): Promise<HeadsRahmen | undefined> {
  try {
    const { haushaltBusinessFreiJetzt, haushaltFensterFuer, businessFreiJetzt } = await import('@/lib/arbeitsrahmen/server');
    const heute = localDay(jetzt);
    const [hf, spannen, frei] = await Promise.all([
      haushaltBusinessFreiJetzt(jetzt),
      haushaltFensterFuer(tagPlus(heute, -7), tagPlus(heute, 1)),
      Promise.all(personen.map(async p => ((await businessFreiJetzt(p, jetzt)).frei ? p : null))),
    ]);
    return { haushaltFrei: hf.frei, personFrei: new Set(frei.filter((p): p is string => !!p)), warFrei: (t, stunde) => istBusinessFrei(spannen, wandAus(t, stunde * 60)) };
  } catch { return undefined; }
}

export async function headsFaellig(jetzt: Date): Promise<Faellig[]> {
  const crm = await ladeCrm();
  // Nur Team-Mitglieder mit Konto bekommen eine vorbereitete Power Hour.
  const mitKonto = new Set((await ladeKonten()).konten.map(k => k.speicher));
  const personen = TEAM.map(t => t.id).filter(id => mitKonto.has(id));
  const rahmen = await headsRahmen(jetzt, personen);
  const raus: Faellig[] = [];
  for (const head of ['sales', 'marketing', 'event'] as HeadId[]) {
    if (!(await resolveAgent(AGENT_ID[head])).enabled) continue;
    const s = { ...leererStand(), ...((await loadJson<HeadStand>(standName(head))) ?? {}) };
    for (const m of faelligeModi(head, jetzt, s, crm.events, personen.length ? personen : ['kevin'], rahmen)) {
      raus.push({ id: `${AGENT_ID[head]}-${m.modus}${m.person ? `-${m.person}` : ''}`, grund: `${HEAD_NAME[head]}: ${m.grund}`, auftrag: { art: 'agent', name: AGENT_ID[head], auftrag: `modus:${m.modus}${m.person ? ` person:${m.person}` : ''}`, anlass: `Takt: ${HEAD_NAME[head]} (${m.grund})` } });
    }
  }
  return raus;
}
