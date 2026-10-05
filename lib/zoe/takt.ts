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
import { wandzeit } from '@/lib/kalender/zeit';
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
interface NutzungStand { letzteAnalyse?: string; /** letzter echter Versuch des Loops — auch ein übersprungener (27.09.) */ letzterLoopVersuch?: string }

/**
 * Was ist jetzt dran? Liest den echten Zustand der beteiligten Speicher,
 * nicht eine eigene Buchführung — sonst gäbe es zwei Wahrheiten darüber,
 * wann etwas zuletzt lief.
 */
/**
 * Läufe des Takts, die NUR mit dem Modell etwas tun (05.10., Datenschutz): mit ausgeschalteter Hintergrund-KI (System ›
 * Datenschutz) reiht der Takt sie gar nicht erst ein, und der Arbeiter führt einen schon eingereihten nicht aus.
 * Alle anderen laufen weiter — ohne KI (Gesundheit/Markttraktion-Nachrichten, HOI, Löschfristen, Durchsicht, Absichten,
 * Tagesstart) bzw. mit Regelwerk statt Modell, weil das KI-Tor den Aufruf sperrt (Morgen-/Abendlauf, Tageslauf-Schritte
 * „übersprungen“, Heads, Brain-Konsolidierung). Kein Byte geht in beiden Fällen an das Modell.
 */
export const KI_LAEUFE: ReadonlySet<string> = new Set(['verbesserung', 'zoe-aufgaben', 'finanzchef']);

export async function faellig(jetzt = new Date()): Promise<Faellig[]> {
  const roh0 = await faelligOhnePause(jetzt);
  if (!roh0.length) return roh0;
  const { kiSchalterFuer } = await import('@/lib/datenschutz/ki-einstellungen');
  const kiAn = (await kiSchalterFuer(null)).hintergrund;
  const roh = kiAn ? roh0 : roh0.filter(f => !KI_LAEUFE.has(f.auftrag.name));
  if (!roh.length) return roh;
  const auftraege = (await loadJson<{ auftraege?: AuftragSpur[] }>('zoe-auftraege'))?.auftraege ?? [];
  const heute = localDay(jetzt);
  return roh.filter(f => wartenNachFehler(auftraege, f.auftrag.name, heute, jetzt) === 0);
}

async function faelligOhnePause(jetzt: Date): Promise<Faellig[]> {
  // Berliner Wandzeit (29.09., Paket D-A #40) — nicht die Zeitzone der Maschine.
  const wand = wandzeit(jetzt);
  const h = Number(wand.slice(11, 13));
  const heute = localDay(jetzt);
  const raus: Faellig[] = [];

  // 00) Durchsicht der Bestände (Paket D-A #85): einmal am Tag ab 4 Uhr — nach der Sicherung (03:15), auch nachts.
  //     Riegel = `letzter.tag` im Bestand hoi-durchsicht (der Lauf schreibt ihn). Ohne KI.
  try {
    const d = (await loadJson<{ letzter?: { tag?: string } }>('hoi-durchsicht')) ?? {};
    if (h >= 4 && d.letzter?.tag !== heute) raus.push({ id: 'durchsicht', grund: 'Durchsicht der Bestände steht aus', auftrag: { art: 'agent', name: 'durchsicht', anlass: 'Takt: Durchsicht' } });
  } catch (err) { console.error('[MAKE OS] Durchsicht-Takt übersprungen:', err); }

  // 00b) Abgebrochene Vorgänge (Absichtsprotokoll, Paket D-C #17): offene Absichten, die älter als 10 Minuten und nicht
  //      im Rückzug nach einem Fehlversuch sind, fertigstellen — auch nachts. Ohne KI.
  try {
    const { absichtenLage, MINDEST_ALTER_MS } = await import('@/lib/store/absichten-fortsetzen');
    const l = await absichtenLage(jetzt, MINDEST_ALTER_MS);
    if (l.faellig) raus.push({ id: 'absichten', grund: `${l.faellig} abgebrochene${l.faellig === 1 ? 'r Vorgang' : ' Vorgänge'} fertigstellen`, auftrag: { art: 'agent', name: 'absichten', anlass: 'Takt: Absichten' } });
  } catch (err) { console.error('[MAKE OS] Absichten-Takt übersprungen:', err); }

  if (h < VON || h >= BIS) return raus;

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

  // 0c) Head of IT (27.09.): ab 7:45 der Tagesbericht (einmal), danach stündlich der Blick auf NEUES Rot —
  //     den nur, wenn ein Bote da ist, der es zustellen kann. Riegel in hoi-meldung.json (der Lauf schreibt ihn).
  try {
    const hm = (await loadJson<{ berichtTag?: string; zuletzt?: string }>('hoi-meldung')) ?? {};
    const minuten = h * 60 + Number(wand.slice(14, 16));
    if (minuten >= 7 * 60 + 45 && hm.berichtTag !== heute) raus.push({ id: 'hoi-bericht', grund: 'Head of IT: Tagesbericht', auftrag: { art: 'agent', name: 'hoi', auftrag: 'bericht', anlass: 'Takt: Head of IT' } });
    else if (telegramKonfiguriert() && (!hm.zuletzt || jetzt.getTime() - Date.parse(hm.zuletzt) >= 55 * 60_000)) raus.push({ id: `hoi-${h}`, grund: 'Head of IT: Stundenblick auf neues Rot', auftrag: { art: 'agent', name: 'hoi', auftrag: 'pruefen', anlass: 'Takt: Head of IT' } });
  } catch (err) {
    console.error('[MAKE OS] HOI-Takt übersprungen:', err);
  }

  // 0d) Brain-Konsolidierung (27.09.): ab 21 Uhr einmal am Tag — verdichtet den Tag zu Vorschlägen in der Brain-Inbox.
  //     Riegel im eigenen Bestand (brain-konsolidierung), der Lauf schreibt ihn.
  try {
    const bk = (await loadJson<{ letzterTag?: string }>('brain-konsolidierung')) ?? {};
    if (h >= 21 && bk.letzterTag !== heute) raus.push({ id: 'konsolidierung', grund: 'Brain: den Tag verdichten', auftrag: { art: 'agent', name: 'konsolidierung', anlass: 'Takt: Brain-Konsolidierung' } });
  } catch (err) { console.error('[MAKE OS] Konsolidierungs-Takt übersprungen:', err); }

  // 0e) Löschfristen (28.09., U2 #52): einmal am Tag ab 7 Uhr — Personen über der Frist nur als Aufgabe, technische
  //     Bestände nach Frist bereinigen. Riegel = Tagesmarke `lauf.tag` im Bestand crm-loeschfristen (der Lauf schreibt sie).
  try {
    const lf = (await loadJson<{ lauf?: { tag?: string } }>('crm-loeschfristen')) ?? {};
    // 29.09. (#70): auch sobald die Grabsteine neuer sind als ihre Marke im Datenordner — nach einem Restore oder Neustart
    // wendet der nächste Takt die Löschungen erneut an (der Lauf selbst prüft das vor der Tagesmarke).
    const { grabsteineOffen } = await import('@/lib/datenschutz/grabsteine');
    if (lf.lauf?.tag !== heute) raus.push({ id: 'loeschfristen', grund: 'Löschfristen: Tageslauf steht aus', auftrag: { art: 'agent', name: 'loeschfristen', anlass: 'Takt: Löschfristen' } });
    else if (await grabsteineOffen()) raus.push({ id: 'grabsteine', grund: 'Grabsteine gelöschter Personen anwenden (nach Restore/Löschung)', auftrag: { art: 'agent', name: 'loeschfristen', anlass: 'Takt: Grabsteine' } });
  } catch (err) { console.error('[MAKE OS] Löschfristen-Takt übersprungen:', err); }

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
  //    ZOE darauf, gefragt zu werden.
  //
  //    Ob er heute lief, steht in der Warteschlange selbst — kein zweiter
  //    Zähler, der mit der Wirklichkeit auseinanderlaufen könnte.
  const auftraege = await loadJson<{ auftraege?: { name: string; tag: string; status: string }[] }>('zoe-auftraege');
  const morgenHeute = (auftraege?.auftraege ?? []).some(a =>
    a.name === 'morgen' && a.tag === heute && a.status !== 'fehler');
  if (!morgenHeute) {
    raus.push({
      id: 'morgen',
      grund: 'Vorschläge für heute noch nicht vorbereitet',
      auftrag: { art: 'agent', name: 'morgen', anlass: 'Takt: Morgenlauf' },
    });
  }

  // 2b) ZOE-Aufgaben (28.09., Paket C4) — einmal am Tag nach dem Morgenlauf, nur wenn etwas bei ZOE offen liegt.
  //     Riegel = die Warteschlange selbst (wie beim Morgenlauf); der Lauf legt nur Vorschläge in den Stapel.
  const zoeAufgabenHeute = (auftraege?.auftraege ?? []).some(a => a.name === 'zoe-aufgaben' && a.tag === heute && a.status !== 'fehler');
  if (morgenHeute && !zoeAufgabenHeute) {
    try {
      const { zoeAufgabenFaellig } = await import('./aufgaben-lauf');
      if (await zoeAufgabenFaellig(jetzt)) raus.push({ id: 'zoe-aufgaben', grund: 'Aufgaben liegen bei ZOE', auftrag: { art: 'agent', name: 'zoe-aufgaben', anlass: 'Takt: ZOE-Aufgaben' } });
    } catch (err) { console.error('[MAKE OS] ZOE-Aufgaben-Takt übersprungen:', err); }
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
  // Nach einem Versuch (auch einem übersprungenen) einen Tag Ruhe — sonst stand der Loop bis 27.09. jede Minute neu in der Schlange.
  const stundenSeitVersuch = nu?.letzterLoopVersuch ? (jetzt.getTime() - Date.parse(nu.letzterLoopVersuch)) / 3_600_000 : Infinity;
  if (h >= 9 && tageSeitAnalyse >= 7 && stundenSeitVersuch >= 24) {
    raus.push({
      id: 'verbesserung',
      grund: nu?.letzteAnalyse ? `letzte Analyse vor ${Math.round(tageSeitAnalyse)} Tagen` : 'noch nie gelaufen',
      auftrag: { art: 'agent', name: 'verbesserung', anlass: 'Takt: Verbesserungs-Loop' },
    });
  }

  return raus;
}
