// ─── MAKE OS — Der Gesundheits-Takt ─────────────────────────────────────────
// Warum der Bereich bis heute tot war: alles wartete darauf, dass Kevin die
// App öffnet. Das tut er nicht. Also dreht sich das um — Jarvis meldet sich,
// dreimal am Tag, aufs Handy:
//
//   morgens   Lage (Recovery, Schlaf) + die Morgenroutinen + „Wie geht's?"
//   mittags   „Schon gegessen?" — regelmäßig essen ist sein Hebel gegen Schübe
//   abends    Journal, Haut, Supplements, Reha, Streak — EINE Nachricht
//   sonntags  Wochenrückblick mit Trend
//
// Die Nachrichten sind BEWUSST ohne Modell gebaut: deterministisch, kurz,
// jeden Tag verlässlich gleich aufgebaut. Das Modell kommt, wenn Kevin
// antwortet — dann liest Jarvis den Satz und schreibt die Werte weg.
//
// Alles hier ist reine Logik; Uhrzeit und Bestände kommen von außen.

import type { HautTrend, StreakStand } from './eintraege';

export type Slot = 'morgen' | 'mittag' | 'abend' | 'woche';
export const SLOTS: readonly Slot[] = ['morgen', 'mittag', 'abend', 'woche'];

/** Fenster, in denen ein Slot gesendet wird. Verpasst = ausgelassen, nicht
 *  nachgeholt: eine Morgennachricht um 15 Uhr wäre nur Rauschen. */
export const FENSTER: Record<Slot, { ab: number; bis: number }> = {
  morgen: { ab: 7, bis: 11 },
  mittag: { ab: 12, bis: 15 },
  abend: { ab: 20, bis: 23 },
  woche: { ab: 18, bis: 22 },
};

/** person → slot → Tag, an dem zuletzt gesendet (oder bewusst übersprungen) wurde. */
export type TaktStand = Record<string, Partial<Record<Slot, string>>>;

export function faelligeSlots(stand: TaktStand, person: string, jetzt: Date, heute: string): Slot[] {
  const h = jetzt.getHours();
  const sonntag = jetzt.getDay() === 0;
  const s = stand[person] ?? {};
  return SLOTS.filter(slot => {
    if (slot === 'woche' && !sonntag) return false;
    const f = FENSTER[slot];
    if (h < f.ab || h >= f.bis) return false;
    return s[slot] !== heute;
  });
}

export function markiere(stand: TaktStand, person: string, slot: Slot, heute: string): TaktStand {
  return { ...stand, [person]: { ...(stand[person] ?? {}), [slot]: heute } };
}

// ── Die Texte ───────────────────────────────────────────────────────────────
// Du-Form, kurz, immer mit dem Hinweis, wie man antwortet. Kein Emoji-Regen.

export interface MorgenEingabe {
  name: string;
  vitals?: { rec?: number; sleep?: number; heute: boolean };
  routinen: string[];
}

export function morgenText(e: MorgenEingabe): string {
  const z: string[] = [`Guten Morgen, ${e.name}.`];
  if (e.vitals?.heute && typeof e.vitals.rec === 'number') {
    const r = e.vitals.rec;
    const lage = r >= 66 ? 'grün — heute darf es Druck sein' : r >= 40 ? 'gelb — fokussiert, mit Puffer' : 'rot — heute nur das Nötige';
    z.push(`Recovery ${r} %, ${lage}.${typeof e.vitals.sleep === 'number' ? ` Schlaf ${e.vitals.sleep} h.` : ''}`);
  } else {
    z.push('Ich habe noch keine Werte von heute. Sag mir Recovery und Schlaf, wenn du sie hast — oder wie du dich fühlst.');
  }
  if (e.routinen.length) z.push(`Heute Morgen: ${e.routinen.join(' · ')}.`);
  z.push('Antworte mit einem Satz. Ich trage es ein.');
  return z.join('\n');
}

export function mittagText(name: string): string {
  return `${name}, kurz: schon gegessen? Und wie ist die Anspannung gerade, 1 bis 5?`;
}

export interface AbendEingabe {
  name: string;
  routinen: string[];
  streakAktiv: boolean;
}

export function abendText(e: AbendEingabe): string {
  const fragen = [
    'Was lief heute gut?',
    'Wofür bist du dankbar?',
    'Wo warst du hart zu dir?',
    'Haut: Juckreiz 0–10, Schub ja/nein, Auslöser?',
  ];
  if (e.routinen.length) fragen.push(`Erledigt? ${e.routinen.join(' · ')}`);
  if (e.streakAktiv) fragen.push('Sauber geblieben? Verlangen 0–10?');
  return `${e.name}, Tagesabschluss — eine Antwort reicht, in deinen Worten:\n` + fragen.map(f => `· ${f}`).join('\n');
}

export interface WochenEingabe {
  name: string;
  recovery7?: number;
  routinenQuote: number;
  routinenTage: number;
  journalTage: number;
  haut: HautTrend;
  streak: StreakStand;
}

export function wochenText(e: WochenEingabe): string {
  const z: string[] = [`${e.name}, deine Woche:`];
  z.push(typeof e.recovery7 === 'number' ? `· Recovery Ø ${e.recovery7} %` : '· Recovery: keine Werte — Whoop verbinden oder morgens sagen');
  z.push(`· Routinen: an ${e.routinenTage} von 7 Tagen etwas abgehakt, ${Math.round(e.routinenQuote * 100)} % vollständig`);
  z.push(`· Journal: ${e.journalTage} von 7 Abenden`);
  if (e.haut.tage) {
    const r = e.haut.richtung === 'besser' ? 'besser als die Woche davor' : e.haut.richtung === 'schlechter' ? 'schlechter als die Woche davor' : e.haut.richtung === 'gleich' ? 'wie die Woche davor' : '';
    z.push(`· Haut: Juckreiz Ø ${e.haut.juckreiz7 ?? '–'}${r ? `, ${r}` : ''}${e.haut.schuebe30 ? `, ${e.haut.schuebe30} Schub-Tage im Monat` : ''}${e.haut.ausloeser[0] ? ` — häufigster Auslöser: ${e.haut.ausloeser[0].was}` : ''}`);
  }
  if (e.streak.aktuell) z.push(`· Sauber seit ${e.streak.sauberTage} Tag${e.streak.sauberTage === 1 ? '' : 'en'}${typeof e.streak.craving7 === 'number' ? `, Verlangen Ø ${e.streak.craving7}` : ''}`);
  z.push('Was nimmst du dir für nächste Woche vor? Ein Satz.');
  return z.join('\n');
}
