// ─── Kalender für ZOE lesen (Server, 29.09., Paket R-Z #K4/#K2) ─────────────
// Der EINE Lesepfad für alles, was Termine an ein Modell gibt (Brain → ZOE-Gespräch, Kalender-Agent, plan_block,
// Wochenplan-Agent): derselbe Stand wie die Kalender-Sicht (`termineLesen`: iCloud-Stand bzw.
// Mac-Lieferung, Bezug + Sicherung, `wer` aus den Einstellungen), danach je fragender Person gefiltert (`fuerZoe`:
// privat/Gesundheit der anderen → „Belegt“). Nie ein Netzaufruf. Der Kalender gehört dem Haushalt des Inhabers
// (lib/kalender/zugang.ts) — eine Person aus einem anderen Haushalt bekommt keine Termine.
// Jeder Termin trägt `fremd` (Nachtrag #K1, `terminFremd`): Einladung, Abo-/fremder Kalender, Buchungsseite, Altweg.
// Abgesagte bzw. von uns abgelehnte Termine (R-K1 #68, `abgesagt`) fallen hier HERAUS (F2 M5): sie finden nicht statt —
// weder das Brain noch plan_block, Wochenplan oder die Kalender-Analyse sollen mit ihnen rechnen.

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
  /** Die Einstellungen, gegen die gelesen wurde (Kalendernamen je Person — z. B. für Vorschläge). */
  einstellungen: KalenderEinstellungen | null;
}

// Eine zweite, fest verdrahtete Kalenderquelle (Microsoft-365-Snapshot einer Beteiligung) gibt es seit 09.10. nicht mehr: sie lieferte
// seit K5 nichts, und feste Firmen gehören nicht in den Code (Plattform-Regel). Weitere Quellen kommen über die Einstellungen
// (Google je Person, iCloud je Person) in `termineLesen`.
const LEER: ZoeKalender = { termine: [], stand: null, quelle: 'leer', einstellungen: null };

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
  const g = einst ? await termineLesen(einst, von, bis).catch(() => null) : null;
  const herkunft = g && einst ? herkunftAus(g, einst) : null;
  return {
    termine: (g?.termine ?? [])
      .filter(t => !t.abgesagt)
      .map(t => mitFremd(fuerZoe(t, person), !herkunft || terminFremd(t, herkunft)))
      .sort((a, b) => a.start.localeCompare(b.start)),
    stand: g?.stand ?? null,
    quelle: g?.quelle ?? 'leer',
    einstellungen: einst,
  };
}
