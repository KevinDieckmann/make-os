// ─── Kalender — Termine NUR lesen, ohne Abgleich (29.09., Paket K2, Server) ──
// Für Leser, die keinen iCloud-Abgleich anstoßen dürfen oder müssen (Jahresansicht, Zeit-Auswertung): der gespeicherte
// iCloud-Stand (`kalender-icloud`) über `termineImZeitraum` — sonst der zuletzt vom Mac gelieferte `calendar-cache`
// (nur lesen), gleiche Abbildung wie GET /api/kalender. Nie ein Netzaufruf. `wer` kommt aus den Einstellungen,
// Bezüge/Sicherung (Art, privat, Kennungen) aus `kalender-bezug` über `mitBezug` (K1).

import { loadJson } from '@/lib/store/local-db';
import { verbunden, ladeStand, termineImZeitraum, CACHE } from './icloud';
import { googleKalenderNamen } from './google/namen';
import { wemGehoert, type KalenderEinstellungen, type Wer } from './einstellungen';
import type { Termin } from './ics';
import { ladeBezuege } from './bezug-server';
import { mitBezug, type TerminMitBezug } from './bezug';

export interface MacEv { id?: string; title?: string; startDate?: string; endDate?: string; allDay?: boolean; calendarName?: string; location?: string }

/**
 * Der vom Mac gelieferte Stand (`calendar-cache`) als Termine im Zeitraum [von, bis) — die EINE Abbildung (K6a: vorher
 * doppelt in GET /api/kalender). Nur lesen: Mac-Termine sind in MAKE OS nie bearbeitbar.
 */
export function macTermine(events: readonly MacEv[] | undefined, von: string, bis: string): Termin[] {
  return (events ?? []).filter(e => e.title && e.startDate && e.startDate.slice(0, 10) < bis && (e.endDate ?? e.startDate).slice(0, 10) >= von).map((e, i) => ({
    id: e.id ?? `mac-${i}`, uid: e.id ?? `mac-${i}`, href: '', titel: e.title!, start: e.startDate!, ende: e.endDate ?? e.startDate!, ganztags: !!e.allDay,
    kalender: (e.calendarName ?? 'Kalender').trim(), kalenderId: '', ...(e.location ? { ort: e.location } : {}), serie: false, mitTeilnehmern: false, bearbeitbar: false,
    art: 'termin' as const, beschaeftigt: !e.allDay, sichtbarkeit: 'standard' as const,
  }));
}

export interface GeleseneTermine {
  quelle: 'icloud' | 'mac' | 'leer';
  termine: (TerminMitBezug & { wer: Wer })[];
  kalender: { name: string; farbe?: string; schreibbar: boolean; wer: Wer }[];
  /** Zeitpunkt des gelesenen Stands (iCloud-Abgleich bzw. Mac-Lieferung) — für die Frische (ZOE, 29.09. #K4). */
  stand?: string | null;
}

/** Termine im Zeitraum [von, bis) — Berliner Tage. */
export async function termineLesen(einst: KalenderEinstellungen, von: string, bis: string): Promise<GeleseneTermine> {
  let termine: Termin[] = [];
  let quelle: GeleseneTermine['quelle'] = 'leer';
  let kalender: { name: string; farbe?: string; schreibbar: boolean }[] = [];
  let stand: string | null = null;
  // iCloud und/oder Google (03.10.): beide stehen im selben Stand (`ladeStand`).
  const google = Object.keys(await googleKalenderNamen()).length > 0;
  if (verbunden() || google) {
    const s = await ladeStand();
    if (s.at || google) { termine = termineImZeitraum(s, von, bis); quelle = 'icloud'; stand = s.at ?? new Date().toISOString(); }
    kalender = s.kalender.map(k => ({ name: k.name, ...(k.farbe ? { farbe: k.farbe } : {}), schreibbar: k.schreibbar }));
  } else {
    const c = await loadJson<{ events?: MacEv[]; at?: string }>(CACHE);
    if (c?.at) { quelle = 'mac'; stand = c.at; }
    termine = macTermine(c?.events, von, bis);
    kalender = Array.from(new Set(termine.map(t => t.kalender))).map(name => ({ name, schreibbar: false }));
  }
  const bezuege = await ladeBezuege().catch(() => null);
  return { quelle, stand, termine: termine.map(t => ({ ...mitBezug(t, bezuege), wer: wemGehoert(einst, t.kalender) })), kalender: kalender.map(k => ({ ...k, wer: wemGehoert(einst, k.name) })) };
}
