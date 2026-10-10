// ─── Unternehmen › Schild: Kalendertage rechnen (rein, client-sicher, 10.10.) ───────────────────────────────────────
// Fristen nach der Schreibweise der Recherche (`GJE+3M`, `E+1W`, „unverzüglich“): Tage als `JJJJ-MM-TT`, gerechnet über UTC-Mittag
// (keine Zeitumstellung), Monatsende gekappt (31.03. + 1 M = 30.04.). „Heute“ kommt immer von außen (Berliner Tag, `localDay`).

const TAG = /^\d{4}-\d{2}-\d{2}$/;
export const istTag = (v: unknown): v is string => typeof v === 'string' && TAG.test(v) && Number.isFinite(Date.parse(`${v}T12:00:00Z`)) && new Date(`${v}T12:00:00Z`).toISOString().slice(0, 10) === v;

const zuTag = (d: Date) => d.toISOString().slice(0, 10);
const datum = (tag: string) => new Date(`${tag}T12:00:00Z`);

export function tagePlus(tag: string, n: number): string { const d = datum(tag); d.setUTCDate(d.getUTCDate() + n); return zuTag(d); }

/** Letzter Tag des Monats von `jahr`/`monat` (1–12). */
export function monatsletzter(jahr: number, monat: number): string {
  return zuTag(new Date(Date.UTC(jahr, monat, 0, 12)));
}

/** `tag` + n Monate, Monatsende gekappt; ein Monatsletzter bleibt Monatsletzter (31.12. + 3 M = 31.03., 30.09. + 3 M = 31.12.). */
export function monatePlus(tag: string, n: number): string {
  const j = Number(tag.slice(0, 4)), m = Number(tag.slice(5, 7)), t = Number(tag.slice(8, 10));
  const ziel = new Date(Date.UTC(j, m - 1 + n, 1, 12));
  const zj = ziel.getUTCFullYear(), zm = ziel.getUTCMonth() + 1;
  const letzter = Number(monatsletzter(zj, zm).slice(8, 10));
  const warLetzter = tag === monatsletzter(j, m);
  const tagNeu = warLetzter ? letzter : Math.min(t, letzter);
  return `${zj}-${String(zm).padStart(2, '0')}-${String(tagNeu).padStart(2, '0')}`;
}

export const jahrePlus = (tag: string, n: number) => monatePlus(tag, n * 12);

/** Tage von `a` bis `b` (b − a). */
export const tageZwischen = (a: string, b: string): number => Math.round((datum(b).getTime() - datum(a).getTime()) / 86_400_000);

/** 31.12. des Jahres von `tag` (Fristbeginn der Aufbewahrung: Ende des Kalenderjahres). */
export const jahresende = (tag: string) => `${tag.slice(0, 4)}-12-31`;

/** Quartal eines Tages: `2026-Q4`. */
export function quartal(tag: string): string { return `${tag.slice(0, 4)}-Q${Math.floor((Number(tag.slice(5, 7)) - 1) / 3) + 1}`; }
/** Erster Tag des Quartals. */
export function quartalsBeginn(tag: string): string { const m = Math.floor((Number(tag.slice(5, 7)) - 1) / 3) * 3 + 1; return `${tag.slice(0, 4)}-${String(m).padStart(2, '0')}-01`; }

/** „31.03.2026“. */
export const tagText = (t?: string) => (t && TAG.test(t) ? `${t.slice(8, 10)}.${t.slice(5, 7)}.${t.slice(0, 4)}` : '');

/**
 * Geschäftsjahres-Enden im Fenster [von, bis] — `beginn` = erster Monat des Geschäftsjahres (1 = Kalenderjahr). Das erste Geschäftsjahr
 * (Rumpfgeschäftsjahr) endet am ersten Stichtag NACH der Gründung; davor gibt es keines.
 */
export function geschaeftsjahresEnden(beginn: number | undefined, von: string, bis: string, gegruendet?: string): string[] {
  const b = beginn && beginn >= 2 && beginn <= 12 ? beginn : 1;
  const endMonat = b === 1 ? 12 : b - 1;
  const raus: string[] = [];
  for (let j = Number(von.slice(0, 4)) - 1; j <= Number(bis.slice(0, 4)) + 1; j++) {
    const ende = monatsletzter(j, endMonat);
    if (ende < von || ende > bis) continue;
    if (gegruendet && ende < gegruendet) continue;
    raus.push(ende);
  }
  return raus;
}

/** „GJ 2025“ bzw. „GJ 2025/26“ (abweichendes Geschäftsjahr). */
export function gjLabel(ende: string): string {
  if (ende.slice(5) === '12-31') return `GJ ${ende.slice(0, 4)}`;
  const j = Number(ende.slice(0, 4));
  return `GJ ${j - 1}/${String(j).slice(2)}`;
}
