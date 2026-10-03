// ─── MAKE OS — Zeit (die EINE Quelle für Datums-Schlüssel) ──────────────────
// Vorher gab es localDay/tagKey/todayISO/localKey in acht Dateien — jede Kopie
// eine Gelegenheit für den UTC-Fehler (toISOString liefert nachts den Vortag).
// Ab jetzt kommt der Tages-Schlüssel nur noch von hier.
//
// 29.09. (Paket D-A #40): „heute“ ist der BERLINER Tag — ausdrücklich über Intl mit
// Europe/Berlin, nicht über die Zeitzone der Maschine. Vorher stimmte es nur, weil
// Dockerfile/compose TZ=Europe/Berlin setzen; ein Skript, ein Test oder ein neuer
// Container ohne TZ verschob „heute/fällig“ nachts um einen Tag.

import { ZONE } from '@/lib/kalender/zeit';

const TAG_FORMAT = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

/** YYYY-MM-DD in Berliner Zeit (Europe/Berlin). Bewusst nicht toISOString(): das rechnet UTC. */
export function localDay(d = new Date()): string {
  let j = '', m = '', t = '';
  for (const p of TAG_FORMAT.formatToParts(d)) {
    if (p.type === 'year') j = p.value; else if (p.type === 'month') m = p.value; else if (p.type === 'day') t = p.value;
  }
  return `${j}-${m}-${t}`;
}

/** Ein echter Kalendertag „YYYY-MM-DD“ — nicht nur die Form: „2026-13-45“ und „2026-02-30“ sind keiner (Roundtrip über UTC). */
export function istKalendertag(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** Kalendertage ± n — reine Datumsrechnung (UTC-Mittag), unabhängig von Zeitzone und Zeitumstellung. */
export function tagePlus(start: string, tage: number): string {
  const d = new Date(`${start.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + tage);
  return d.toISOString().slice(0, 10);
}

/** Alter eines ISO-Zeitstempels in Stunden; null wenn unbrauchbar. */
export function alterStunden(iso?: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return null;
  return (Date.now() - t) / 3_600_000;
}

/** Berliner Tag (YYYY-MM-DD) eines ISO-Zeitpunkts — statt `.slice(0, 10)`, das den UTC-Tag nimmt (nachts ab 0 Uhr MESZ liegt der um einen Tag daneben). */
export function tagVon(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso.slice(0, 10) : localDay(d);
}

// ── Datum im Prompt (29.09., Paket R-Z #K3) ──────────────────────────────────
// Ohne Datum rechnet ein Modell „bis Freitag“ oder „morgen früh“ um 00:30 auf den falschen Tag. Der Satz stand erst nur
// im Aufgabenlauf (lib/aufgaben/zoe.ts); jetzt hier, damit ZOE-Gespräch und Läufe denselben benutzen.

const WOCHENTAG_LANG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const UHR_FORMAT = new Intl.DateTimeFormat('de-DE', { timeZone: ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** „Heute ist Dienstag, 29.09.2026 (Zeitzone Europe/Berlin).“ — `heute` = Berliner Tag (YYYY-MM-DD). */
export function heuteSatz(heute: string): string {
  const w = new Date(`${heute.slice(0, 10)}T12:00:00Z`).getUTCDay();
  return `Heute ist ${WOCHENTAG_LANG[w]}, ${heute.slice(8, 10)}.${heute.slice(5, 7)}.${heute.slice(0, 4)} (Zeitzone Europe/Berlin).`;
}

/** Datum + Berliner Uhrzeit für einen Systemprompt, mit der Regel für relative Angaben. */
export function jetztSatz(d = new Date()): string {
  return `${heuteSatz(localDay(d))} Es ist ${UHR_FORMAT.format(d)} Uhr. Relative Angaben („morgen“, „bis Freitag“, „nächste Woche“) rechnest du von diesem Datum aus um, nie von einem angenommenen.`;
}
