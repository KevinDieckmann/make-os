// ─── Kalender — Wandzeit in Berlin ──────────────────────────────────────────
// Alle Termine laufen in MAKE OS als Berliner Wandzeit „YYYY-MM-DDTHH:mm:ss“
// (ohne Zone) — so wie es der Mac-Kalender immer geliefert hat und wie jede
// Ansicht rechnet. Der Server steht in UTC; deshalb hier ausdrücklich über
// Europe/Berlin, nie über die Zeitzone der Maschine.

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
 * Berliner Wandzeit → Zeitpunkt. Zweimal ansetzen, weil der Versatz vom
 * Ergebnis abhängt (Zeitumstellung). Eine Uhrzeit, die es wegen der
 * Umstellung nicht gibt (02:30 Ende März), landet eine Stunde später.
 */
export function ausWandzeit(wand: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(wand);
  if (!m) throw new Error(`Keine Wandzeit: ${wand}`);
  const alsUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0));
  let t = alsUtc - versatz(new Date(alsUtc)) * 60_000;
  t = alsUtc - versatz(new Date(t)) * 60_000;
  return new Date(t);
}

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
