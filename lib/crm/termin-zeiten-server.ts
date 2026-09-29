// ─── CRM — Zeiten der Termine hinter den Meetings lesen (Server, K6a, 29.09.) ─
// Kalender-Verbindungen, Befund „Meeting-Zeit doppelt“ (KALENDER_VERBINDUNGEN.md, doppelte Wahrheit 6): der Termin ist die
// Quelle für die Zeit. Eine Aktivität „Meeting“ mit `terminUid` trägt kein `wann` (K3) — wer die Zeit braucht (ZOE, Heads,
// Glocke/Heute, Brain), liest sie hier über den Verweis, nie aus `am` (dem Zeitpunkt des Festhaltens).
// Gelesen wird der gespeicherte Stand ohne iCloud-Abgleich (`termineLesen`, nie ein Netzaufruf). Alle Leser hier sind
// Modellpfade (ZOE-CRM-Werkzeuge, Heads): es gilt DIESELBE Regel wie für ZOE (`fuerZoe`, lib/kalender/zoe-sicht.ts — F2 N2):
// privat UND Gesundheit der anderen Person → maskiert → fällt heraus. Wirft nie — ohne Kalender: leere Zeiten.

import { ladeEinstellungen } from '@/lib/kalender/einstellungen';
import { termineLesen } from '@/lib/kalender/termine-lesen';
import { fuerZoe } from '@/lib/kalender/zoe-sicht';
import { tagPlus } from '@/lib/kalender/zeit';
import { localDay } from '@/lib/zeit';
import type { Kontakt } from '@/lib/make-one/crm';
import { zeitenAus, kontakteMitTerminZeit, hatTerminVerweise, type TerminZeiten } from './aktivitaeten';

/** So weit schaut der Leser zurück und voraus (der iCloud-Stand hält −90 … +400 Tage). */
export const ZEITEN_ZURUECK = 400, ZEITEN_VORAUS = 400;

/** Zeiten aller lesbaren Termine je Schlüssel (neue und alte Form) — für die Person nach der ZOE-Regel gefiltert. */
export async function terminZeitenLesen(person: string, heute = localDay()): Promise<TerminZeiten> {
  try {
    const g = await termineLesen(await ladeEinstellungen(), tagPlus(heute, -ZEITEN_ZURUECK), tagPlus(heute, ZEITEN_VORAUS + 1));
    return zeitenAus(g.termine.map(t => fuerZoe(t, person)));
  } catch {
    return {};
  }
}

/** Kartei mit den Termin-Zeiten der Meetings (nur für Anzeige/Datenpakete — nie speichern). Ohne Verweise: unverändert. */
export async function kontakteMitTerminZeitenLesen<K extends Pick<Kontakt, 'aktivitaeten'>>(kontakte: readonly K[], person: string): Promise<K[]> {
  if (!hatTerminVerweise(kontakte)) return [...kontakte];
  return kontakteMitTerminZeit(kontakte, await terminZeitenLesen(person));
}
