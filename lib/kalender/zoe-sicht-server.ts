// ─── Kalender für ZOE lesen (Server, 29.09., Paket R-Z #K4/#K2) ─────────────
// Der EINE Lesepfad für alles, was Termine an ein Modell gibt (Brain → ZOE-Gespräch, Kalender-Agent, plan_block):
// derselbe Stand wie die Kalender-Sicht (`termineLesen`: iCloud-Stand bzw. Mac-Lieferung, Bezug + Sicherung, `wer` aus
// den Einstellungen), danach je fragender Person gefiltert (`fuerZoe`: privat/Gesundheit der anderen → „Belegt“).
// Nie ein Netzaufruf. Der Kalender gehört dem Haushalt des Inhabers (lib/kalender/zugang.ts) — eine Person aus einem
// anderen Haushalt bekommt keine Termine.
// Dazu der KEMARIS-Snapshot (M365, Kevins Arbeitspostfach): gleiche Form, Eigentümer Kevin, gleiche Filterung.

import { loadJson } from '@/lib/store/local-db';
import { personImHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { ladeEinstellungen } from './einstellungen';
import { termineLesen } from './termine-lesen';
import { fuerZoe } from './zoe-sicht';
import type { TerminMitBezug } from './bezug';

export type ZoeTermin = TerminMitBezug & { wer?: string };

export interface ZoeKalender {
  /** iCloud bzw. Mac-Lieferung, für die Person gefiltert, nach Beginn sortiert. */
  termine: ZoeTermin[];
  stand: string | null;
  quelle: 'icloud' | 'mac' | 'leer';
  /** KEMARIS (M365), für die Person gefiltert. */
  kemaris: ZoeTermin[];
  kemarisStand: string | null;
}

const LEER: ZoeKalender = { termine: [], stand: null, quelle: 'leer', kemaris: [], kemarisStand: null };
export const KEMARIS_KALENDER = 'KEMARIS (M365)';

interface KemEv { title?: string; start?: string; end?: string; isTeams?: boolean }

/** Termine im Zeitraum [von, bis) (Berliner Tage), wie ZOE sie für `person` sehen darf. */
export async function termineFuerZoe(person: string, von: string, bis: string): Promise<ZoeKalender> {
  if (!(await personImHaushaltDesInhabers(person).catch(() => false))) return LEER;
  const [g, kem] = await Promise.all([
    ladeEinstellungen().then(e => termineLesen(e, von, bis)).catch(() => null),
    loadJson<{ events?: KemEv[]; at?: string }>('kemaris-calendar').catch(() => null),
  ]);
  const kemaris: ZoeTermin[] = (kem?.events ?? [])
    .filter(e => e.title && e.start && e.start.slice(0, 10) < bis && (e.end ?? e.start).slice(0, 10) >= von)
    .map((e, i) => ({
      id: `m365-${i}`, uid: `m365-${i}`, href: '', titel: e.title!, start: e.start!, ende: e.end ?? e.start!, ganztags: false,
      kalender: KEMARIS_KALENDER, kalenderId: '', serie: false, mitTeilnehmern: !!e.isTeams, bearbeitbar: false,
      art: 'termin' as const, beschaeftigt: true, sichtbarkeit: 'standard' as const, wer: 'kevin',
    }));
  return {
    termine: (g?.termine ?? []).map(t => fuerZoe(t, person)).sort((a, b) => a.start.localeCompare(b.start)),
    stand: g?.stand ?? null,
    quelle: g?.quelle ?? 'leer',
    kemaris: kemaris.map(t => fuerZoe(t, person)),
    kemarisStand: kem?.at ?? null,
  };
}
