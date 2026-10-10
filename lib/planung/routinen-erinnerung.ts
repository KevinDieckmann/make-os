// ─── MAKE OS — Routinen 2: Erinnerungen und Kalender-Blöcke (rein, 10.10.) ─────────────────────────────────────────────────────
// Rückmeldung aus dem Onboarding (10.10.): je Routine „Erinnerung“ und optional „Kalender-Block“. Hier steht nur, WANN und WAS —
// ohne Speicher, ohne Netz:
//   • Erinnerung: zur festen Uhrzeit (mehrmals täglich: je Uhrzeit), sonst zur Tageszeit (morgens/tagsüber/abends). Eine Routine
//     meldet sich, solange sie heute dran und (für diese Uhrzeit) noch nicht erledigt ist — in der Glocke abgeleitet (nie gespeichert,
//     lib/meldungen/regeln.ts `routinenAbleiten`), aufs Handy nur mit der Einstellung der Person (Takt, lib/planung/routinen-takt.ts).
//     Der Handy-Text ist IMMER neutral: kein Name der Routine, keine Zahl (lib/datenschutz/telegram-text.ts).
//   • Kalender-Block: die geplanten Tage der nächsten zwei Wochen (`geplanteTage`) je Uhrzeit als Block mit FESTER UID — idempotent,
//     nachgezogen im Morgenlauf und nach dem Speichern; entfernt werden nur Blöcke, die MAKE OS selbst angelegt hat (Kennungen im
//     Bestand der Person), und nur künftige.
// Tests: tests/routinen-2-erinnerung.test.ts.

import type { Routine } from './typen';
import { faelligkeit, geplanteTage, tagesZielVon } from './rhythmus';
import { erledigtTage, heuteIst, spaceVonRoutine, type ZaehlerLog } from './routinen';
import { tagePlus } from './zeitraum';

/** Uhrzeit je Tageszeit, wenn die Routine keine feste Uhrzeit hat. */
export const WANN_UHR: Readonly<Record<Routine['wann'], string>> = { morgen: '07:30', tag: '12:30', abend: '19:30' };

/** Wann sich eine Routine meldet: ihre Uhrzeiten, sonst die ihrer Tageszeit. */
export const erinnerungsZeiten = (r: Pick<Routine, 'uhrzeiten' | 'wann'>): string[] => (r.uhrzeiten?.length ? [...r.uhrzeiten] : [WANN_UHR[r.wann] ?? WANN_UHR.morgen]);

export interface OffeneErinnerung {
  routine: Routine;
  /** Die Uhrzeit, um die es geht (die späteste schon erreichte, die noch offen ist). */
  uhr: string;
  ist: number; ziel: number;
  /** Schlüssel für Riegel/Gelesen: `<routine>@<HH:MM>`. */
  schluessel: string;
  business: boolean;
}

/**
 * Welche Erinnerungen sind JETZT offen? Nur Routinen mit `erinnerung`, aktiv, heute dran (Rhythmus, Pause, Zeitraum) und — je Uhrzeit —
 * noch nicht erledigt: bei mehreren Uhrzeiten zählt der Zähler (die zweite Uhrzeit ist offen, solange weniger als 2 erledigt sind), sonst
 * das Tagesziel. Je Routine höchstens EINE (die späteste erreichte Uhrzeit) — keine Flut. `routinen` = schon die, die die Person sieht.
 */
export function offeneErinnerungen(routinen: readonly Routine[], log: Record<string, string[]> | null | undefined, zaehler: ZaehlerLog | null | undefined, heute: string, jetztUhr: string): OffeneErinnerung[] {
  const raus: OffeneErinnerung[] = [];
  for (const r of routinen) {
    if (!r.erinnerung || !r.aktiv || r.belegt) continue;
    const tage = erledigtTage(log, r.id);
    const heuteErledigt = tage.includes(heute);
    if (!faelligkeit(r, tage, heute).faellig) continue;
    const ziel = tagesZielVon(r);
    const ist = heuteIst(r, heuteErledigt, zaehler, heute);
    if (ist >= ziel) continue;
    const zeiten = erinnerungsZeiten(r);
    let treffer: string | null = null;
    for (let i = 0; i < zeiten.length; i++) {
      if (zeiten[i] > jetztUhr) break;
      if (zeiten.length >= 2 ? ist <= i : ist < ziel) treffer = zeiten[i];
    }
    if (treffer) raus.push({ routine: r, uhr: treffer, ist, ziel, schluessel: `${r.id}@${treffer}`, business: spaceVonRoutine(r) === 'business' });
  }
  return raus.sort((a, b) => a.uhr.localeCompare(b.uhr) || a.routine.label.localeCompare(b.routine.label, 'de'));
}

/** Liegt `uhr` höchstens `fenster` Minuten vor `jetztUhr` (gleicher Tag)? — Handy-Erinnerung nur frisch, nie nachträglich am Abend für morgens. */
export function imFenster(uhr: string, jetztUhr: string, fenster = 20): boolean {
  const m = (u: string) => Number(u.slice(0, 2)) * 60 + Number(u.slice(3, 5));
  const d = m(jetztUhr) - m(uhr);
  return d >= 0 && d <= fenster;
}

// ── Kalender-Blöcke ──────────────────────────────────────────────────────────────────────────────────────────────────────────

/** So weit legt MAKE OS Routinen-Blöcke im Voraus an (heute eingeschlossen). */
export const KALENDER_FENSTER_TAGE = 14;

const fnv = (s: string) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36); };
/** Feste UID eines Routinen-Blocks — erfüllt UID_FEST (lib/kalender/eingabe.ts), verrät weder Person noch Routine. */
export const routineBlockUid = (person: string, routineId: string, tag: string, uhr: string): string =>
  `makeos-routine-${fnv(`${person}|${routineId}`)}-${tag.replace(/-/g, '')}-${uhr.replace(':', '')}`;

export interface BlockSoll { uid: string; routineId: string; tag: string; uhr: string; titel: string; dauerMin: number; erholung: boolean }

/** Welche Blöcke sollen stehen? Nur EIGENE Routinen (Besitz = diese Person) mit `kalender`, aktiv; je geplantem Tag und Uhrzeit einer. */
export function blockSoll(person: string, routinen: readonly Routine[], log: Record<string, string[]> | null | undefined, heute: string, tage = KALENDER_FENSTER_TAGE): BlockSoll[] {
  const bis = tagePlus(heute, tage - 1);
  const raus: BlockSoll[] = [];
  for (const r of routinen) {
    if (!r.kalender || !r.aktiv || r.owner !== person) continue;
    for (const tag of geplanteTage(r, erledigtTage(log, r.id), heute, bis)) {
      for (const uhr of erinnerungsZeiten(r)) raus.push({ uid: routineBlockUid(person, r.id, tag, uhr), routineId: r.id, tag, uhr, titel: r.label, dauerMin: r.dauerMin, erholung: r.kategorie === 'erholung' });
    }
  }
  return raus;
}

/**
 * Was anlegen, was entfernen? Entfernt wird nur, was MAKE OS selbst angelegt hat (`bestand`) und erst ab morgen liegt — heutige und
 * vergangene Blöcke bleiben stehen (die Zeit ist schon verplant bzw. vorbei). `behalten` = der neue Bestand (ohne Vergangenes).
 */
export function blockDiff(soll: readonly BlockSoll[], bestand: Readonly<Record<string, { r: string; tag: string }>>, heute: string): { anlegen: BlockSoll[]; entfernen: string[]; behalten: Record<string, { r: string; tag: string }> } {
  const sollUids = new Set(soll.map(b => b.uid));
  const anlegen = soll.filter(b => !bestand[b.uid]);
  const entfernen = Object.entries(bestand).filter(([uid, x]) => x.tag > heute && !sollUids.has(uid)).map(([uid]) => uid);
  const behalten = Object.fromEntries(Object.entries(bestand).filter(([uid, x]) => x.tag >= heute && !entfernen.includes(uid)));
  return { anlegen, entfernen, behalten };
}
