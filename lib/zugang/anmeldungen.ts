// ─── MAKE OS — Anmelde-Protokoll (26.09.) ───────────────────────────────────
// Wer sich wann angemeldet hat (und ob es klappte), damit ein Einbruch nicht
// unbemerkt bleibt. Adresse gekürzt (kein volles Nutzerprofil). Aufbewahrung seit 05.10. nach FRIST statt nach Anzahl:
// 12 Monate (vorher 300 Einträge — bei einem Ratenangriff wären echte Anmeldungen binnen Minuten verdrängt worden),
// darüber hinaus nur eine Notbremse gegen Fluten (`MAX_NOTBREMSE`). Gekürzt wird bei jedem neuen Eintrag.
// Seit 05.10. zusätzlich mit Hash-Kette und Siegel (lib/store/protokoll-kette.ts): rollend — fallen vorne Einträge heraus
// (Frist oder Notbremse), rückt der Kettenanfang nach (`kette.verworfen`), ein gelöschter oder veränderter Eintrag fällt auf.

import { loadJson } from '@/lib/store/local-db';
import { anhaengenVerkettet } from '@/lib/store/protokoll-kette';

export type AnmeldeArt = 'anmelden' | 'passwort' | 'alle-abgemeldet' | 'abmelden' | 'zweiter-faktor-an' | 'zweiter-faktor-aus'
  /** Anmelde-Adressen (03.10.): hinzugefügt, zur Hauptadresse gemacht, entfernt — `detail` nennt die Adresse nur maskiert. */
  | 'adresse-hinzu' | 'adresse-haupt' | 'adresse-weg'
  /** Betroffenenrechte (05.10.): eigene Daten heruntergeladen, Konto gelöscht (danach steht `speicher` als „[gelöscht]“), Instanz exportiert. */
  | 'daten-export' | 'konto-loeschen' | 'instanz-export';
export interface Anmeldung { zeit: string; speicher: string | null; art: AnmeldeArt; ok: boolean; adresse: string; /** Nur bei Adress-Änderungen: die betroffene Adresse maskiert (k***@example.invalid). */ detail?: string }
const STORE = 'anmeldungen';
/** Aufbewahrungsfrist des Anmeldeprotokolls in Monaten (Sicherheitszweck, Art. 6 Abs. 1 lit. f — danach gelöscht). */
export const FRIST_MONATE = 12;
/** Notbremse: mehr Einträge werden nie gehalten, auch innerhalb der Frist (Schutz der Platte bei einer Flut). */
export const MAX_NOTBREMSE = 50_000;

/** Einträge innerhalb der Frist, älteste zuerst, höchstens MAX_NOTBREMSE (die neuesten). Rein. */
export function nachFrist(eintraege: Anmeldung[], jetzt: Date = new Date()): Anmeldung[] {
  const grenze = new Date(jetzt);
  grenze.setMonth(grenze.getMonth() - FRIST_MONATE);
  const ab = grenze.toISOString();
  return eintraege.filter(e => typeof e?.zeit === 'string' && e.zeit >= ab).slice(-MAX_NOTBREMSE);
}

/** IPv4: die ersten drei Gruppen, IPv6: die ersten drei Blöcke — genug zum Erkennen, zu wenig zum Verfolgen. */
export function adresseGekuerzt(a: string): string {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(a)) return a.split('.').slice(0, 3).join('.') + '.x';
  if (a.includes(':')) return a.split(':').slice(0, 3).join(':') + ':…';
  return a.slice(0, 24);
}

export async function notiere(e: Omit<Anmeldung, 'zeit'>): Promise<void> {
  const jetzt = new Date();
  const grenze = new Date(jetzt); grenze.setMonth(grenze.getMonth() - FRIST_MONATE);
  await anhaengenVerkettet(STORE, [{ zeit: jetzt.toISOString(), ...e }], { max: MAX_NOTBREMSE, abZeit: grenze.toISOString(), jetzt }).catch(err => console.error('[anmeldungen] nicht notiert:', err instanceof Error ? err.message : err));
}

/** Das ganze Protokoll (innerhalb der Frist) — für den Anmelde-Alarm und den Head of IT. */
export async function alle(): Promise<Anmeldung[]> {
  return (await loadJson<{ eintraege: Anmeldung[] }>(STORE))?.eintraege ?? [];
}

export async function letzte(speicher: string, n = 5): Promise<Anmeldung[]> {
  const f = await loadJson<{ eintraege: Anmeldung[] }>(STORE);
  return (f?.eintraege ?? []).filter(e => e.speicher === speicher).slice(-n).reverse();
}
