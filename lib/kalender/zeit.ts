// ─── Kalender — Wandzeit in Berlin ──────────────────────────────────────────
// Alle Termine laufen in MAKE OS als Berliner Wandzeit „YYYY-MM-DDTHH:mm:ss“
// (ohne Zone) — so wie es der Mac-Kalender immer geliefert hat und wie jede
// Ansicht rechnet. Der Server steht zwar auf TZ=Europe/Berlin (Dockerfile,
// compose.yml), aber darauf verlässt sich hier nichts: gerechnet wird immer
// ausdrücklich über Europe/Berlin (Intl), nie über die Zone der Maschine oder
// des Browsers (R-K1 #6/#7 — Tests laufen zusätzlich unter UTC und Los Angeles).

export const ZONE = 'Europe/Berlin';

const FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

function teile(d: Date): Record<string, number> {
  const t: Record<string, number> = {};
  for (const p of FORMAT.formatToParts(d)) if (p.type !== 'literal') t[p.type] = Number(p.value);
  return t;
}

const zwei = (n: number) => String(n).padStart(2, '0');

/** Ein Zeitpunkt als Berliner Wandzeit „YYYY-MM-DDTHH:mm:ss“. */
export function wandzeit(d: Date): string {
  const t = teile(d);
  return `${t.year}-${zwei(t.month)}-${zwei(t.day)}T${zwei(t.hour)}:${zwei(t.minute)}:${zwei(t.second)}`;
}

/** Abstand Berlin − UTC in Minuten zu einem Zeitpunkt (60 oder 120). */
function versatz(d: Date): number {
  const t = teile(d);
  return (Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute, t.second) - Math.floor(d.getTime() / 1000) * 1000) / 60_000;
}

/**
 * Wandzeit (als UTC-Zahl gelesen) → Zeitpunkt, für eine beliebige Zone über ihre Versatz-Funktion (RFC 5545 3.3.5):
 * eine MEHRDEUTIGE Uhrzeit (die doppelte Stunde Ende Oktober) meint das ERSTE Vorkommen (Sommerzeit), eine Uhrzeit, die
 * es NICHT GIBT (02:30 Ende März), wird mit dem Versatz VOR der Lücke gedeutet — landet also eine Stunde später (03:30).
 */
export function wandzeitAufloesen(alsUtc: number, versatzMin: (d: Date) => number): number {
  const vorher = versatzMin(new Date(alsUtc - 36 * 3600_000));
  const nachher = versatzMin(new Date(alsUtc + 36 * 3600_000));
  const kandidaten = Array.from(new Set([vorher, versatzMin(new Date(alsUtc)), nachher]))
    .map(v => alsUtc - v * 60_000)
    .filter(t => alsUtc - versatzMin(new Date(t)) * 60_000 === t)
    .sort((a, b) => a - b);
  return kandidaten.length ? kandidaten[0] : alsUtc - vorher * 60_000;
}

/** „YYYY-MM-DD[THH:mm[:ss]]“ → die Wandzeit als UTC-Zahl (ohne Zone). */
export function wandzeitZahl(wand: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(wand);
  if (!m) throw new Error(`Keine Wandzeit: ${wand}`);
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0));
}

/**
 * Berliner Wandzeit → Zeitpunkt. Die doppelte Stunde (25.10., 02:00–02:59) meint das erste Vorkommen (MESZ); eine
 * Uhrzeit, die es wegen der Umstellung nicht gibt (29.03., 02:30), landet eine Stunde später (03:30 MESZ).
 */
export function ausWandzeit(wand: string): Date {
  return new Date(wandzeitAufloesen(wandzeitZahl(wand), versatz));
}

/** Eine Wandzeit, wie Berlin sie wirklich zeigt: eine Uhrzeit aus der Lücke Ende März rückt vor (02:30 → 03:30). */
export const wandzeitNormal = (wand: string): string => wandzeit(ausWandzeit(wand));

/** Reines Datum „YYYY-MM-DD“ (ohne Uhrzeit)? */
export const istReinesDatum = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

export const tagVon = (wand: string) => wand.slice(0, 10);

/** Tag ± n Tage (Kalendertage, ohne Zeitzonen-Stolperer). */
export function tagPlus(tag: string, n: number): string {
  const d = new Date(`${tag}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Minuten seit Mitternacht einer Wandzeit. */
export const minutenVon = (wand: string) => Number(wand.slice(11, 13)) * 60 + Number(wand.slice(14, 16));

/** Wandzeit aus Tag + Minuten seit Mitternacht (über Mitternacht hinaus → Folgetag). */
export function wandAus(tag: string, minuten: number): string {
  const extra = Math.floor(minuten / 1440);
  const rest = ((minuten % 1440) + 1440) % 1440;
  return `${tagPlus(tag, extra)}T${zwei(Math.floor(rest / 60))}:${zwei(rest % 60)}:00`;
}
