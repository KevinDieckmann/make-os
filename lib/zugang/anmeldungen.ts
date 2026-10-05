// ─── MAKE OS — Anmelde-Protokoll (26.09.) ───────────────────────────────────
// Wer sich wann angemeldet hat (und ob es klappte), damit ein Einbruch nicht
// unbemerkt bleibt. Adresse gekürzt (kein volles Nutzerprofil), 300 Einträge.
// Seit 05.10. mit Hash-Kette und Siegel (lib/store/protokoll-kette.ts): rollend — fallen vorne Einträge heraus, rückt der
// Kettenanfang nach (`kette.verworfen` zählt sie), ein gelöschter oder veränderter Eintrag fällt bei der Prüfung auf.

import { loadJson } from '@/lib/store/local-db';
import { anhaengenVerkettet } from '@/lib/store/protokoll-kette';

export type AnmeldeArt = 'anmelden' | 'passwort' | 'alle-abgemeldet' | 'abmelden' | 'zweiter-faktor-an' | 'zweiter-faktor-aus'
  /** Anmelde-Adressen (03.10.): hinzugefügt, zur Hauptadresse gemacht, entfernt — `detail` nennt die Adresse nur maskiert. */
  | 'adresse-hinzu' | 'adresse-haupt' | 'adresse-weg';
export interface Anmeldung { zeit: string; speicher: string | null; art: AnmeldeArt; ok: boolean; adresse: string; /** Nur bei Adress-Änderungen: die betroffene Adresse maskiert (k***@example.invalid). */ detail?: string }
const STORE = 'anmeldungen';
const MAX = 300;

/** IPv4: die ersten drei Gruppen, IPv6: die ersten drei Blöcke — genug zum Erkennen, zu wenig zum Verfolgen. */
export function adresseGekuerzt(a: string): string {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(a)) return a.split('.').slice(0, 3).join('.') + '.x';
  if (a.includes(':')) return a.split(':').slice(0, 3).join(':') + ':…';
  return a.slice(0, 24);
}

export async function notiere(e: Omit<Anmeldung, 'zeit'>): Promise<void> {
  await anhaengenVerkettet(STORE, [{ zeit: new Date().toISOString(), ...e }], { max: MAX }).catch(err => console.error('[anmeldungen] nicht notiert:', err instanceof Error ? err.message : err));
}

/** Das ganze Protokoll (höchstens MAX Einträge) — für den Anmelde-Alarm. */
export async function alle(): Promise<Anmeldung[]> {
  return (await loadJson<{ eintraege: Anmeldung[] }>(STORE))?.eintraege ?? [];
}

export async function letzte(speicher: string, n = 5): Promise<Anmeldung[]> {
  const f = await loadJson<{ eintraege: Anmeldung[] }>(STORE);
  return (f?.eintraege ?? []).filter(e => e.speicher === speicher).slice(-n).reverse();
}
