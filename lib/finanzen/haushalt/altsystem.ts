// ─── Haushaltsfinanzen: gibt es für diese Instanz ein Altsystem? (Rundgang 09.10., Plattform-Regel) ─────────────────────────
// Der Umzug (app/api/haushalt/umzug) holt die Daten eines früheren Finanz-Cockpits einer gewachsenen Instanz. Eine neue Instanz hat
// kein solches Altsystem — sie beginnt mit einem Konto und dem ersten Kontoauszug. Deshalb entscheidet der SERVER, ob Finanzen › Privat
// die Übernahme überhaupt anbietet (Feld `altsystem` in GET /api/haushalt), und der Umzug nimmt ohne eingerichtetes Altsystem keinen
// Probelauf an. Eingerichtet heißt: die Verbindung steht in der Umgebung (MAKE_ORGA_URL, MAKE_ORGA_KEY), der Haushalt hat schon einmal
// übernommen (`meta.umzug`) oder es liegt ein Probelauf vor. Kein Name, keine Instanz im Code.

import { loadJson } from '@/lib/store/local-db';
import { verbindungAusUmgebung } from './supabase-umzug';
import type { Meta } from './speicher';

/** Stand des Umzugs je Haushalt (Probelauf, Bericht, Übernahme) — EINE Stelle für den Namen (Route und Prüfung). */
export const umzugStandName = (haushalt: string) => `haushalt-umzug--${haushalt}`;

/** Rein: eingerichtet, wenn eine der drei Spuren da ist. */
export function altsystemAus(o: { verbindung: boolean; uebernommen: boolean; probelauf: boolean }): boolean {
  return o.verbindung || o.uebernommen || o.probelauf;
}

/** Ist für diesen Haushalt ein Altsystem eingerichtet? Ein unlesbarer Stand zählt nicht (dann bietet die Seite die Übernahme nicht an). */
export async function altsystemFuer(haushalt: string, meta?: Pick<Meta, 'umzug'> | null): Promise<boolean> {
  const verbindung = !!verbindungAusUmgebung();
  const uebernommen = !!meta?.umzug;
  if (verbindung || uebernommen) return true;
  const probelauf = !!(await loadJson<unknown>(umzugStandName(haushalt)).catch(() => null));
  return altsystemAus({ verbindung, uebernommen, probelauf });
}
