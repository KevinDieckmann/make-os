// ─── MAKE OS — Anmelde-Protokoll (26.09.) ───────────────────────────────────
// Wer sich wann angemeldet hat (und ob es klappte), damit ein Einbruch nicht
// unbemerkt bleibt. Adresse gekürzt (kein volles Nutzerprofil), 300 Einträge.

import { updateJson, loadJson } from '@/lib/store/local-db';

export type AnmeldeArt = 'anmelden' | 'passwort' | 'alle-abgemeldet' | 'abmelden' | 'zweiter-faktor-an' | 'zweiter-faktor-aus';
export interface Anmeldung { zeit: string; speicher: string | null; art: AnmeldeArt; ok: boolean; adresse: string }
const STORE = 'anmeldungen';
const MAX = 300;

/** IPv4: die ersten drei Gruppen, IPv6: die ersten drei Blöcke — genug zum Erkennen, zu wenig zum Verfolgen. */
export function adresseGekuerzt(a: string): string {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(a)) return a.split('.').slice(0, 3).join('.') + '.x';
  if (a.includes(':')) return a.split(':').slice(0, 3).join(':') + ':…';
  return a.slice(0, 24);
}

export async function notiere(e: Omit<Anmeldung, 'zeit'>): Promise<void> {
  await updateJson<{ eintraege: Anmeldung[] }>(STORE, alt => ({ eintraege: [...(alt?.eintraege ?? []), { zeit: new Date().toISOString(), ...e }].slice(-MAX) })).catch(() => null);
}

export async function letzte(speicher: string, n = 5): Promise<Anmeldung[]> {
  const f = await loadJson<{ eintraege: Anmeldung[] }>(STORE);
  return (f?.eintraege ?? []).filter(e => e.speicher === speicher).slice(-n).reverse();
}
