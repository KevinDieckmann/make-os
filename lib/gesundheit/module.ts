// ─── Gesundheits-Module je Person (09.10., PRIVATE_INHALTE_SUCHE.md Paket 2 › C; Plattform-Regel „Nichts Persönliches fest“) ──
// Kevin 08.10. (Fragebogen Teil 3): „Alles als eigene Daten je Person/Instanz.“ Bis heute steckten zwei allgemeine Tagebücher
// in JEDER Instanz und für JEDE Person: das Symptom-Tagebuch (Bestand `haut`) und der Zähler „Sauber geblieben“ (Bestand
// `streak`) — mit Index-Kennzahlen, Abendfragen, Journal-Merkmal und Zeilen auf „Heute“. Jetzt sind beide ein MODUL, das jede
// Person für sich ein- oder ausschaltet (Körper-Profil › Module, nur die Person selbst — /api/gesundheit/koerper).
//
// EINE Regel (`moduleWirksam`), überall gleich (Index, Takt, Routen, Oberfläche):
//   1. ausdrücklich gesetzt (`KoerperStand.module`) gewinnt — an oder aus;
//   2. sonst Altbestand: an, wenn die Person die frühere Anzeige-Einstellung gesetzt hatte (Name des Symptom-Reglers bzw.
//      Zähler an) ODER schon Einträge im Bestand hat — einmal beim Lesen abgeleitet, nie gespeichert, nie automatisch aus
//      (Einträge verschwinden nicht von selbst; ausgeschaltet wird nur von Hand);
//   3. sonst aus (Vorgabe für neue Personen).
// Und EINE Regel für „zählt“ (`modulZaehlt`): Modul an UND in den letzten 60 Tagen geführt — die frühere Regel „nur wenn
// geführt“ des Index, jetzt an EINER Stelle für Index und Wochenrückblick.
//
// Rein (Server UND Browser). Keine Inhalte einer Person: Namen der Module sind allgemein; wie der Regler heißt, legt die
// Person selbst fest (`KoerperStand.symptom`).

import { tageZurueck } from './eintraege';

/** Kennung eines Moduls. Neue Module: Kennung hier, Bestand in `MODUL_INFO`, Prüfung im Index (`kennzahlenFuer`). */
export type GesundheitModul = 'haut' | 'serie';
export const GESUNDHEIT_MODULE: readonly GesundheitModul[] = ['haut', 'serie'];

/** Bestand je Person (über `speicherFuer`) — Name der Daten, nie umbenennen (die Einträge liegen dort). */
export type ModulBestand = 'haut' | 'streak';

export const MODUL_INFO: Record<GesundheitModul, { name: string; satz: string; bestand: ModulBestand }> = {
  haut: {
    name: 'Symptom-Tagebuch',
    satz: 'Ein eigener Regler 0–10 je Tag mit Schub und Auslöser — auf „Heute“, abends abgefragt, im Index und im Verlauf.',
    bestand: 'haut',
  },
  serie: {
    name: 'Zähler „Sauber geblieben“',
    satz: 'Tage seit dem letzten Rückfall, Verlangen 0–10 — auf „Heute“, im Journal, abends abgefragt und im Index.',
    bestand: 'streak',
  },
};

/** Was die Person ausdrücklich eingestellt hat (fehlt = nicht eingestellt → Altbestand-Regel). */
export type ModulEinstellung = Partial<Record<GesundheitModul, boolean>>;
/** Der wirksame Stand: je Modul an/aus. */
export type ModulStand = Record<GesundheitModul, boolean>;
export const MODULE_AUS: ModulStand = { haut: false, serie: false };

/** Wie viele Tage zurück ein Eintrag als „geführt“ zählt (Index, Wochenrückblick). */
export const MODUL_GEFUEHRT_TAGE = 60;

const istModul = (x: unknown): x is GesundheitModul => typeof x === 'string' && (GESUNDHEIT_MODULE as readonly string[]).includes(x);

/** Gespeicherte Einstellung säubern: nur bekannte Module, nur echte Wahrheitswerte. */
export function modulEinstellungSaeubern(roh: unknown): ModulEinstellung | undefined {
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return undefined;
  const e: ModulEinstellung = {};
  for (const [k, v] of Object.entries(roh as Record<string, unknown>)) if (istModul(k) && typeof v === 'boolean') e[k] = v;
  return Object.keys(e).length ? e : undefined;
}

/** Hat ein Tagebuch-Bestand mindestens einen Eintrag (Altbestand)? */
export function hatEintraege(log: Record<string, unknown> | null | undefined): boolean {
  return !!log && Object.keys(log).some(t => /^\d{4}-\d{2}-\d{2}$/.test(t) && !!log[t]);
}

/** Die Teile des Körper-Profils, die die Regel braucht (ohne Profil: null). */
export interface ModulQuelle {
  module?: ModulEinstellung;
  symptom?: { name: string } | null;
  sauberZaehler?: boolean;
}

/**
 * DIE Regel: wirksamer Stand je Modul. `belegt` = hat die Person schon Einträge im Bestand des Moduls (Altbestand).
 * Ausdrücklich gesetzt gewinnt; sonst frühere Anzeige-Einstellung oder Einträge → an; sonst aus.
 */
export function moduleWirksam(k: ModulQuelle | null | undefined, belegt: Partial<Record<GesundheitModul, boolean>> = {}): ModulStand {
  const e = k?.module ?? {};
  const alt: ModulStand = { haut: !!k?.symptom?.name?.trim(), serie: k?.sauberZaehler === true };
  const stand = { ...MODULE_AUS };
  for (const m of GESUNDHEIT_MODULE) stand[m] = typeof e[m] === 'boolean' ? e[m]! : alt[m] || belegt[m] === true;
  return stand;
}

/**
 * Zählt ein Modul (Index-Kennzahl, Zeile im Wochenrückblick)? Nur, wenn es an ist UND in den letzten 60 Tagen geführt wurde.
 * `an` undefined = kein Modul-Stand bekannt (alte Aufrufer) → wie bisher allein „geführt“.
 */
export function modulZaehlt(an: boolean | undefined, log: Record<string, unknown> | null | undefined, heute: string, tage = MODUL_GEFUEHRT_TAGE): boolean {
  if (an === false || !log) return false;
  return tageZurueck(heute, tage).some(t => !!log[t]);
}

/** Name des Symptom-Reglers für Anzeige und Abendfrage — nur mit eingeschaltetem Modul; ohne eigenen Namen der allgemeine. */
export function symptomAnzeige(k: { symptom?: { name: string } | null } | null | undefined, an: boolean): string | null {
  if (!an) return null;
  return k?.symptom?.name?.trim() || MODUL_INFO.haut.name;
}

/** Text der Ablehnung, wenn jemand in ein ausgeschaltetes Modul schreiben will (Route: 409). */
export const modulAusText = (m: GesundheitModul): string =>
  `${MODUL_INFO[m].name} ist für dich ausgeschaltet — einschalten unter Gesundheit › Körper › Module. Nichts gespeichert.`;
