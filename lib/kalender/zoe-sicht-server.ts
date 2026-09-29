// ─── Kalender für ZOE lesen (Server, 29.09., Paket R-Z #K4/#K2) ─────────────
// Der EINE Lesepfad für alles, was Termine an ein Modell gibt (Brain → ZOE-Gespräch, Kalender-Agent, plan_block,
// Wochenplan-Agent): derselbe Stand wie die Kalender-Sicht (`termineLesen`: iCloud-Stand bzw.
// Mac-Lieferung, Bezug + Sicherung, `wer` aus den Einstellungen), danach je fragender Person gefiltert (`fuerZoe`:
// privat/Gesundheit der anderen → „Belegt“). Nie ein Netzaufruf. Der Kalender gehört dem Haushalt des Inhabers
// (lib/kalender/zugang.ts) — eine Person aus einem anderen Haushalt bekommt keine Termine.
// Dazu der KEMARIS-Snapshot (M365, Kevins Arbeitspostfach): gleiche Form, Eigentümer Kevin, gleiche Filterung.
// Jeder Termin trägt `fremd` (Nachtrag #K1, `terminFremd`): Einladung, Abo-/fremder Kalender, Buchungsseite, Altweg.
// Abgesagte bzw. von uns abgelehnte Termine (R-K1 #68, `abgesagt`) fallen hier HERAUS (F2 M5): sie finden nicht statt —
// weder das Brain noch plan_block, Wochenplan oder die Kalender-Analyse sollen mit ihnen rechnen.

import { loadJson } from '@/lib/store/local-db';
import { personImHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { ladeEinstellungen, wemGehoert, type KalenderEinstellungen } from './einstellungen';
import { termineLesen, type GeleseneTermine } from './termine-lesen';
import { fuerZoe, terminFremd, type TerminHerkunft } from './zoe-sicht';
import type { TerminMitBezug } from './bezug';

/** `fremd`: Text möglicherweise von Dritten (nie bei maskierten Terminen — „Belegt“ ist unser Text). */
export type ZoeTermin = TerminMitBezug & { wer?: string; fremd?: boolean };

export interface ZoeKalender {
  /** iCloud bzw. Mac-Lieferung, für die Person gefiltert, nach Beginn sortiert. */
  termine: ZoeTermin[];
  stand: string | null;
  quelle: 'icloud' | 'mac' | 'leer';
  /** KEMARIS (M365), für die Person gefiltert. */
  kemaris: ZoeTermin[];
  kemarisStand: string | null;
  /** Die Einstellungen, gegen die gelesen wurde (Kalendernamen je Person — z. B. für Vorschläge). */
  einstellungen: KalenderEinstellungen | null;
}

const LEER: ZoeKalender = { termine: [], stand: null, quelle: 'leer', kemaris: [], kemarisStand: null, einstellungen: null };
export const KEMARIS_KALENDER = 'KEMARIS (M365)';

interface KemEv { title?: string; start?: string; end?: string; isTeams?: boolean }

/**
 * Welche Kalender gehören dem Haushalt? Die in den Einstellungen zugeordneten (Kevin, Malin, gemeinsam) und die, deren
 * Name Kevin oder Malin nennt (`wemGehoert`) — und nur, wenn sie schreibbar sind (Abo und fremd geteilt: nur lesen).
 */
export function herkunftAus(g: Pick<GeleseneTermine, 'quelle' | 'kalender'>, einst: KalenderEinstellungen): TerminHerkunft {
  const klein = (s: string) => s.trim().toLowerCase();
  const zugeordnet = new Set(Object.values(einst.kalender).map(klein));
  return {
    quelle: g.quelle,
    haushalt: new Set(g.kalender.filter(k => zugeordnet.has(klein(k.name)) || wemGehoert(einst, k.name) !== 'beide').map(k => klein(k.name))),
    nurLesen: new Set(g.kalender.filter(k => !k.schreibbar).map(k => klein(k.name))),
  };
}

const mitFremd = (t: ZoeTermin, fremd: boolean): ZoeTermin => (fremd && !t.maskiert ? { ...t, fremd: true } : t);

/** Termine im Zeitraum [von, bis) (Berliner Tage), wie ZOE sie für `person` sehen darf. */
export async function termineFuerZoe(person: string, von: string, bis: string): Promise<ZoeKalender> {
  if (!(await personImHaushaltDesInhabers(person).catch(() => false))) return LEER;
  const einst = await ladeEinstellungen().catch(() => null);
  const [g, kem] = await Promise.all([
    einst ? termineLesen(einst, von, bis).catch(() => null) : null,
    loadJson<{ events?: KemEv[]; at?: string }>('kemaris-calendar').catch(() => null),
  ]);
  const herkunft = g && einst ? herkunftAus(g, einst) : null;
  const kemaris: ZoeTermin[] = (kem?.events ?? [])
    .filter(e => e.title && e.start && e.start.slice(0, 10) < bis && (e.end ?? e.start).slice(0, 10) >= von)
    .map((e, i) => ({
      id: `m365-${i}`, uid: `m365-${i}`, href: '', titel: e.title!, start: e.start!, ende: e.end ?? e.start!, ganztags: false,
      kalender: KEMARIS_KALENDER, kalenderId: '', serie: false, mitTeilnehmern: !!e.isTeams, bearbeitbar: false,
      art: 'termin' as const, beschaeftigt: true, sichtbarkeit: 'standard' as const, wer: 'kevin',
    }));
  return {
    termine: (g?.termine ?? [])
      .filter(t => !t.abgesagt)
      .map(t => mitFremd(fuerZoe(t, person), !herkunft || terminFremd(t, herkunft)))
      .sort((a, b) => a.start.localeCompare(b.start)),
    stand: g?.stand ?? null,
    quelle: g?.quelle ?? 'leer',
    kemaris: kemaris.map(t => mitFremd(fuerZoe(t, person), true)),
    kemarisStand: kem?.at ?? null,
    einstellungen: einst,
  };
}
