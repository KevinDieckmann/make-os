// ─── Schlaf-Hilfe: die Nächte aus den eigenen Werten (09.10.2026, rein, Server) ─────────────────────────────────────────
// Getrennt von lib/gesundheit/schlaf.ts, weil die Abbildung des WHOOP-Spiegels (lib/whoop/abbilden.ts) über lib/vitals an der
// Datenschicht hängt — die Regeln selbst laufen auch im Browser. Dieselbe Hauptschlaf-Regel wie `tageswerte` (lib/whoop/abbilden.ts):
// kein Nickerchen, nur bewertet, je Aufwach-Tag (Ortszeit) der zuletzt endende.

import type { VitalsLog } from '@/lib/vitals';
import { ortsTag, type WSchlaf } from '@/lib/whoop/abbilden';
import type { SchlafNacht } from './schlaf';

const zahl = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

/** Minute des Tages eines Zeitpunkts in der Ortszeit der Messung (`±HH:MM`), ohne Angabe Berliner Zeit. */
export function ortsMinute(iso: string, offset?: string): number | null {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  if (offset && /^[+-]\d{2}:\d{2}$/.test(offset)) {
    const vz = offset.startsWith('-') ? -1 : 1;
    const [h, m] = offset.slice(1).split(':').map(Number);
    const d = new Date(t + vz * (h * 60 + m) * 60_000);
    return d.getUTCHours() * 60 + d.getUTCMinutes();
  }
  const teile = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(t));
  const h = Number(teile.find(p => p.type === 'hour')?.value), m = Number(teile.find(p => p.type === 'minute')?.value);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
}

/**
 * Die Nächte der Person (rein): aus den Vitalwerten (Dauer, Bedarf, Wachzeit, WHOOP-Konsistenz) und — falls vorhanden — aus dem
 * WHOOP-Spiegel (Hauptschlaf je Aufwach-Tag wie in `tageswerte`: kein Nickerchen, nur bewertet, der zuletzt endende): Einschlaf-/
 * Aufwachzeit und Bedarf ohne Schuld-Anteil. Neueste zuerst.
 */
export function naechteAus(vitals: VitalsLog | null | undefined, spiegel?: Record<string, WSchlaf> | null): SchlafNacht[] {
  const je = new Map<string, SchlafNacht>();
  const nacht = (tag: string) => { let n = je.get(tag); if (!n) { n = { tag }; je.set(tag, n); } return n; };
  for (const [tag, v] of Object.entries(vitals ?? {})) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tag) || !v || typeof v !== 'object') continue;
    const dauer = zahl(v.sleep), bedarf = zahl(v.schlafBedarf), wach = zahl(v.phaseWach), konsistenz = zahl(v.schlafKonsistenz);
    if (dauer === undefined && bedarf === undefined && wach === undefined && konsistenz === undefined) continue;
    const n = nacht(tag);
    if (dauer !== undefined && dauer > 0) n.dauer = dauer;
    if (bedarf !== undefined && bedarf > 0) n.bedarf = bedarf;
    if (wach !== undefined && wach >= 0) n.wach = wach;
    if (konsistenz !== undefined) n.konsistenz = konsistenz;
  }
  const haupt = new Map<string, WSchlaf>();
  for (const s of Object.values(spiegel ?? {})) {
    if (!s || s.nap || s.state !== 'SCORED') continue;
    const t = ortsTag(s.ende, s.tz);
    const b = haupt.get(t);
    if (!b || Date.parse(s.ende) > Date.parse(b.ende)) haupt.set(t, s);
  }
  for (const [tag, s] of haupt) {
    const n = nacht(tag);
    const ein = ortsMinute(s.start, s.tz), aus = ortsMinute(s.ende, s.tz);
    if (ein !== null) n.einschlaf = ein;
    if (aus !== null) n.aufwach = aus;
    if (typeof s.bedarfMs === 'number' && s.bedarfMs > 0) n.bedarfOhneSchuld = Math.max(0, (s.bedarfMs - (s.schuldMs ?? 0)) / 3_600_000);
  }
  return [...je.values()].sort((a, b) => (a.tag < b.tag ? 1 : a.tag > b.tag ? -1 : 0));
}

