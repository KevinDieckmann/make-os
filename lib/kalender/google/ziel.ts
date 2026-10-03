// ─── Kalender — wohin kommt ein neuer Termin? EINE Zuordnung (03.10.2026) ────
// Kevin 03.10.: „Wir haben nur den Kalender bei Google für MAKE und alles andere läuft über MAKE OS.“
//   Business / MAKE   → der Google Kalender der Person („MAKE Kevin (Google)“), sobald sie verbunden ist
//   Privat            → bleibt wie heute: der iCloud-Kalender der Person (Kalender-Einstellungen)
//   Gemeinsam         → bleibt wie heute: iCloud „Gemeinsam“
// Jeder MAKE-OS-Kalender hat genau EIN externes Zuhause — kein Termin entsteht in zwei Quellen. Ist die Person NICHT mit
// Google verbunden (oder nur lesend), gilt für Business der bisherige Weg (iCloud) — der Rückfall ist der heutige Stand.
//
// Wer neue Termine schreibt, fragt NUR hier: `kalenderZiel(person, art)`. Wer ihn schon kennt (Browser-Dialog mit
// Kalendername), schickt `kalender` — dann gilt diese Wahl, nie eine stille Umleitung.

import { ladeEinstellungen, type KalenderEinstellungen } from '../einstellungen';
import { googleKalenderNamen } from './namen';
import type { KalenderBereich } from '../bereich';

export { googleKalenderNamen };

export { istBereich, type KalenderBereich } from '../bereich';
export interface KalenderZielErgebnis {
  quelle: 'google' | 'icloud';
  /** Name des Kalenders (wie im Stand) — undefined: für diese Person ist nichts hinterlegt. */
  kalender: string | undefined;
  /** Bei Google: wessen Konto. */
  person?: string;
}

/** Rein: aus den Einstellungen und den verbundenen Google-Kalendern (Person → Kalendername) das Ziel. */
export function zielRein(o: { person: string; art: KalenderBereich; icloud: Partial<Record<string, string>>; google: Readonly<Record<string, string>> }): KalenderZielErgebnis {
  if (o.art === 'gemeinsam') return { quelle: 'icloud', kalender: o.icloud.beide };
  if (o.art === 'business' && o.google[o.person]) return { quelle: 'google', kalender: o.google[o.person], person: o.person };
  return { quelle: 'icloud', kalender: o.icloud[o.person] };
}

export async function kalenderZiel(person: string, art: KalenderBereich, einst?: Pick<KalenderEinstellungen, 'kalender'>): Promise<KalenderZielErgebnis> {
  const e = einst ?? await ladeEinstellungen();
  const google = art === 'business' ? await googleKalenderNamen() : {};
  return zielRein({ person, art, icloud: e.kalender, google });
}
