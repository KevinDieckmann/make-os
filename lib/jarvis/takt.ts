// ─── MAKE OS — Der Takt ─────────────────────────────────────────────────────
// Baustein 3, Nachtrag (07.09.). Bis hierher schlug der Takt im Browser:
// components/os/Taktgeber.tsx, ein setInterval im offenen Fenster. Wer den Tab
// schloss, hielt die Uhr an — und wer den Rechner erst um neun aufklappte,
// bekam den Morgenlauf um neun statt um sieben.
//
// Jetzt entscheidet der Server, was fällig ist, und legt es in die
// Warteschlange. Der Arbeiter fragt jede Minute nach; der Browser fragt
// zusätzlich alle paar Minuten, falls kein Arbeiter läuft. Beides ist
// gefahrlos, weil die Fälligkeit hier aus dem ECHTEN Zustand kommt und nicht
// aus einem eigenen Zähler — zwei Frager erzeugen deshalb keinen zweiten Lauf.
//
// 25.09.: dazu der Markttraktion-Takt (Morgen-Nachricht, Freitags-Scoreboard).

import { loadJson } from '@/lib/store/local-db';
import { localDay } from '@/lib/zeit';
import { artFuerStunde, tagKey, type LaufArt } from '@/lib/tageslauf';
import { faelligeSlots, type TaktStand } from '@/lib/gesundheit/takt';
import { telegramKonfiguriert } from '@/lib/telegram';
import { alleSpeicher } from '@/lib/zugang/konten';
import type { NeuerAuftrag } from './auftraege';

/** Nachts ruht das System — Kevin soll schlafen, nicht das OS füttern. */
const VON = 7;
const BIS = 22;
/** So lange muss der letzte Tageslauf her sein. */
const ABSTAND_MIN = 55;

/**
 * Der neueste Eintrag — ohne Annahme über die Reihenfolge der Liste.
 *
 * Steht hier als eigene Funktion, weil genau diese Annahme am 07.09. schiefging:
 * die Route liefert neueste zuerst, der Speicher hängt sie hinten an. Wer das
 * verwechselt, liest den ältesten Lauf als den letzten — und der Takt feuert
 * dann im Minutentakt.
 */
export function neuester<T extends { gestartet: string }>(liste: T[]): T | undefined {
  return liste.reduce<T | undefined>((a, b) => (!a || Date.parse(b.gestartet) > Date.parse(a.gestartet) ? b : a), undefined);
}

/** Was der Takt von einem Auftrag braucht, um nach einem Fehlschlag zu warten. */
export interface AuftragSpur { name: string; tag: string; status: string; zeit: string; beendet?: string }

/**
 * Nach einem Fehlschlag nicht gleich wieder (25.09.). „morgen“ scheiterte am
 * leeren KI-Guthaben, der Takt reihte ihn jede Minute neu ein — über 200
 * Fehlläufe an einem Vormittag, jeder mit vollem Einlesen des Gehirns, und die
 * Software wurde zäh. Jetzt wartet der Takt nach dem n-ten Fehlschlag des
 * Tages 5 · 3^(n−1) Minuten (5, 15, 45, 135), höchstens drei Stunden.
 * Rückgabe: Minuten, die noch zu warten sind — 0 heißt frei.
 */
export function wartenNachFehler(auftraege: AuftragSpur[], name: string, heute: string, jetzt: Date): number {
  const fehl = auftraege.filter(a => a.name === name && a.tag === heute && a.status === 'fehler');
  if (!fehl.length) return 0;
  const letzte = Math.max(...fehl.map(a => Date.parse(a.beendet ?? a.zeit)));
  const pause = Math.min(5 * 3 ** (fehl.length - 1), 180);
  const seit = (jetzt.getTime() - letzte) / 60_000;
  return seit >= pause ? 0 : Math.ceil(pause - seit);
}

export interface Faellig {
  id: string;
  grund: string;
  auftrag: NeuerAuftrag;
}

interface TageslaufStand { laeufe?: { art: LaufArt; gestartet: string }[] }
interface TagesstartStand { lastRun?: string }
interface NutzungStand { letzteAnalyse?: string }

/**
 * Was ist jetzt dran? Liest den echten Zustand der beteiligten Speicher,
 * nicht eine eigene Buchführung — sonst gäbe es zwei Wahrheiten darüber,
 * wann etwas zuletzt lief.
 */
export async function faellig(jetzt = new Date()): Promise<Faellig[]> {
  const roh = await faelligOhnePause(jetzt);
  if (!roh.length) return roh;
  const auftraege = (await loadJson<{ auftraege?: AuftragSpur[] }>('jarvis-auftraege'))?.auftraege ?? [];
  const heute = localDay(jetzt);
  return roh.filter(f => wartenNachFehler(auftraege, f.auftrag.name, heute, jetzt) === 0);
}

async function faelligOhnePause(jetzt: Date): Promise<Faellig[]> {
  const h = jetzt.getHours();
  if (h < VON || h >= BIS) return [];

  const raus: Faellig[] = [];
  const heute = localDay(jetzt);

  // 0) Der Gesundheits-Takt (23.09.) — VOR allem anderen und unabhängig vom
  //    Morgenlauf: Kevin soll seine Nachricht aufs Handy bekommen, auch wenn
  //    der Tagesstart hakt. Nur, wenn der Bote überhaupt da ist; die
  //    Fälligkeit je Person und Slot steht in gesundheit-takt.json.
  if (telegramKonfiguriert()) {
    const gt = (await loadJson<TaktStand>('gesundheit-takt')) ?? {};
    const offen = (await alleSpeicher()).flatMap(p => faelligeSlots(gt, p, jetzt, heute).map(s => `${p}:${s}`));
    if (offen.length) {
      raus.push({
        id: 'gesundheit',
        grund: `Gesundheits-Takt fällig: ${offen.join(', ')}`,
        auftrag: { art: 'agent', name: 'gesundheit', anlass: 'Takt: Gesundheit' },
      });
    }
  }

  // 0b) Markttraktion (25.09.): werktags ab 7:30 die Morgen-Nachricht, freitags
  //     ab 15 Uhr das Wochen-Scoreboard — je Person im Team mit Konto, und nur,
  //     wer mit Telegram gekoppelt ist (sonst stünde der Auftrag jede Minute
  //     neu in der Schlange, ohne dass ihn jemand zustellen kann). Wie der
  //     Gesundheits-Takt unabhängig vom Morgenlauf. Riegel je Person und Slot
  //     in markttraktion-takt.json (lib/crm/scoreboard.ts).
  if (telegramKonfiguriert()) {
    try {
      const { faelligeRhythmen, rhythmusStand, RHYTHMUS_SPEICHER } = await import('@/lib/crm/scoreboard');
      const { TEAM } = await import('@/lib/crm/team');
      const { ladeStand, chatsFuerPerson } = await import('@/lib/telegram');
      const [mitKonto, tg, riegel] = await Promise.all([alleSpeicher(), ladeStand(), loadJson<unknown>(RHYTHMUS_SPEICHER)]);
      const personen = TEAM.map(t => t.id).filter(p => mitKonto.includes(p) && chatsFuerPerson(tg, p).length > 0);
      const dran = faelligeRhythmen(rhythmusStand(riegel), personen, jetzt);
      if (dran.length) {
        raus.push({
          id: 'markttraktion',
          grund: `Markttraktion fällig: ${dran.map(d => `${d.person}:${d.slot}`).join(', ')}`,
          auftrag: { art: 'agent', name: 'markttraktion', anlass: 'Takt: Markttraktion' },
        });
      }
    } catch (err) {
      console.error('[MAKE OS] Markttraktion-Takt übersprungen:', err);
    }
  }

  // 1) Der Morgenlauf — einmal am Tag, ab 7 Uhr.
  const start = await loadJson<TagesstartStand>('tagesstart');
  if (start?.lastRun !== heute) {
    raus.push({
      id: 'tagesstart',
      grund: `Morgenlauf für ${heute} steht noch aus`,
      auftrag: { art: 'agent', name: 'tagesstart', anlass: 'Takt: Morgenlauf' },
    });
    // Der Tageslauf setzt auf dem Morgenlauf auf — heute noch nichts weiter.
    return raus;
  }

  // 2) Der Morgenlauf — einmal am Tag, direkt nach dem Tagesstart. Er ist der
  //    Grund, warum morgens überhaupt etwas im Stapel liegt; ohne ihn wartet
  //    Jarvis darauf, gefragt zu werden.
  //
  //    Ob er heute lief, steht in der Warteschlange selbst — kein zweiter
  //    Zähler, der mit der Wirklichkeit auseinanderlaufen könnte.
  const auftraege = await loadJson<{ auftraege?: { name: string; tag: string; status: string }[] }>('jarvis-auftraege');
  const morgenHeute = (auftraege?.auftraege ?? []).some(a =>
    a.name === 'morgen' && a.tag === heute && a.status !== 'fehler');
  if (!morgenHeute) {
    raus.push({
      id: 'morgen',
      grund: 'Vorschläge für heute noch nicht vorbereitet',
      auftrag: { art: 'agent', name: 'morgen', anlass: 'Takt: Morgenlauf' },
    });
  }

  // 3) Der Abendlauf — ab 18 Uhr, einmal. Kevins Vorgabe: gebündelt morgens
  //    UND abends. Der Morgen bereitet vor, der Abend räumt nach.
  const abendHeute = (auftraege?.auftraege ?? []).some(a =>
    a.name === 'abend' && a.tag === heute && a.status !== 'fehler');
  if (h >= 18 && !abendHeute) {
    raus.push({
      id: 'abend',
      grund: 'Tagesabschluss steht noch aus',
      auftrag: { art: 'agent', name: 'abend', anlass: 'Takt: Abendlauf' },
    });
  }

  // 4) Das Selbstbild — einmal am Tag. Was die Software über sich selbst im
  //    Gehirn hat, soll nicht altern; sie ändert sich gerade täglich.
  const selbstbildHeute = (auftraege?.auftraege ?? []).some(a =>
    a.name === 'selbstbild' && a.tag === heute && a.status !== 'fehler');
  if (h >= 8 && !selbstbildHeute) {
    raus.push({
      id: 'selbstbild',
      grund: 'Beschreibung der Software im Gehirn ist von gestern',
      auftrag: { art: 'agent', name: 'selbstbild', anlass: 'Takt: Selbstbild' },
    });
  }

  // 4b) Der Head of Finance (24.09.) — je Haushalt der fällige Modus:
  //     Monatsabschluss > Steuercheck > Wochenreview > Tagescheck. Sein Riegel
  //     steht in seinem eigenen Speicher (letzte/versuche), kein zweiter Zähler.
  try {
    const { finanzchefFaellig } = await import('@/lib/finanzen/chef/takt');
    raus.push(...await finanzchefFaellig(jetzt));
  } catch (err) {
    console.error('[MAKE OS] Head-of-Finance-Takt übersprungen:', err);
  }

  // 4c) Die Heads (24.09.): Sales, Marketing, Event — je höchstens ein Lauf.
  try {
    const { headsFaellig } = await import('@/lib/heads/takt');
    raus.push(...await headsFaellig(jetzt));
  } catch (err) {
    console.error('[MAKE OS] Heads-Takt übersprungen:', err);
  }

  // 5) Der Tageslauf — stündlich, aber nur wenn der Morgenlauf durch ist.
  const tl = await loadJson<TageslaufStand>('tageslauf');
  // Der SPEICHER hängt neue Läufe hinten an — die Route dreht sie erst für die
  // Anzeige um. Ich hatte anfangs das erste Element genommen und damit den
  // ÄLTESTEN Lauf des Tages als „letzten" gelesen: der Takt hielt den Abstand
  // dadurch nie ein und startete den Tageslauf jede Minute neu (gesehen am
  // 07.09. um 10:01, eine Minute nach dem regulären Lauf). Deshalb hier
  // ausdrücklich das Maximum statt einer angenommenen Reihenfolge.
  const heutige = (tl?.laeufe ?? []).filter(l => l.gestartet.slice(0, 10) === tagKey(jetzt));
  const letzter = neuester(heutige);
  const minutenSeit = letzter ? (jetzt.getTime() - Date.parse(letzter.gestartet)) / 60_000 : Infinity;
  if (minutenSeit >= ABSTAND_MIN) {
    // Der volle Lauf gehört dem Morgen; danach reicht der Puls.
    const art = artFuerStunde(h);
    raus.push({
      id: `tageslauf-${h}`,
      grund: letzter ? `letzter Lauf vor ${Math.round(minutenSeit)} Minuten` : 'heute noch kein Lauf',
      auftrag: { art: 'agent', name: 'tageslauf', auftrag: art === 'voll' ? 'puls' : art, anlass: 'Takt: Tageslauf' },
    });
  }

  // 6) Der Verbesserungs-Loop. Sein Riegel steht in nutzung.letzteAnalyse —
  //    dieselbe Zahl, die auch die Route prüft. Kein zweiter Zähler.
  const nu = await loadJson<NutzungStand>('nutzung');
  const tageSeitAnalyse = nu?.letzteAnalyse
    ? (jetzt.getTime() - Date.parse(nu.letzteAnalyse)) / 864e5
    : Infinity;
  if (h >= 9 && tageSeitAnalyse >= 7) {
    raus.push({
      id: 'verbesserung',
      grund: nu?.letzteAnalyse ? `letzte Analyse vor ${Math.round(tageSeitAnalyse)} Tagen` : 'noch nie gelaufen',
      auftrag: { art: 'agent', name: 'verbesserung', anlass: 'Takt: Verbesserungs-Loop' },
    });
  }

  return raus;
}
