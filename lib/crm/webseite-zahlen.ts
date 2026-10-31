// ─── Website-Zahlen für den Traktions-Index (rein, 31.10., Website-Anbau) ───────────────────────────────────────────────────────────────
// Kevin 31.10.: „Website-Zahlen im Traktions-Index“ — ohne Tracker, nur aus eigenen Beständen:
//   web_anfragen  Anfragen über die Website · 30 Tage   Aktivitäten „Anfrage über Website: …“ (Check, Kontaktformular, Anfrage von Hand mit Kanal
//                                                        Website) — ohne Terminbuchungen, ohne „Adresse unbestätigt“; je Person und Tag einmal.
//   web_checks    Abgeschlossene Checks · 30 Tage       Check-Sitzungen mit gesehenem Ergebnis (`abgeschlossen`, Bestand check-sitzungen).
//   web_termine   Termine aus der Website · 30 Tage     Freigegebene Buchungen der Buchungsseite (Aktivität „Anfrage über Website: Terminbuchung …“).
// Im Index nur, wenn die Website auf der Instanz läuft (Check oder Kontaktformular eingeschaltet — `WebseiteStand.aktiv`; lib/crm/traktion-index.ts
// `WEBSEITE_KENNZAHLEN`); sonst bleibt der Index genau der bisherige. Details mit Links über WEG.

import type { Kontakt } from '@/lib/make-one/crm';
import { anzeigename } from '@/lib/make-one/crm';
import { ausgenommen } from '@/lib/crm/einschraenkung';
import type { Kpi, KpiAmpel } from './kennzahlen';
import type { Detail } from '@/lib/kennzahlen/kern';
import { WEG } from '@/lib/wege';

/** Was der Server über die Website weiß — nur Zähler und Tage, nie Adressen. */
export interface WebseiteStand {
  /** Läuft die Website auf der Instanz (Check oder Kontaktformular eingeschaltet)? */
  aktiv: boolean;
  /** Tage (YYYY-MM-DD) abgeschlossener Checks samt Name des Checks. */
  checks: { tag: string; name: string }[];
}

const PRAEFIX = 'Anfrage über Website: ';
const TERMIN = `${PRAEFIX}Terminbuchung`;
const tagMinus = (heute: string, n: number) => { const d = new Date(`${heute}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
const tagKurz = (t: string) => `${t.slice(8, 10)}.${t.slice(5, 7)}.`;
const stufe = (v: number, gruen: number, gelb: number): KpiAmpel => (v >= gruen ? 'gruen' : v >= gelb ? 'gelb' : 'rot');

/** Anfragen bzw. Termine über die Website im Fenster — je Person und Tag einmal (rein). Eingeschränkte/gesperrte zählen nicht. */
export function webseiteTreffer(kontakte: readonly Kontakt[], heute: string, art: 'anfrage' | 'termin', tage = 30): { kontakt: Kontakt; tag: string; text: string }[] {
  const ab = tagMinus(heute, tage - 1);
  const raus: { kontakt: Kontakt; tag: string; text: string }[] = [];
  for (const k of kontakte) {
    if (ausgenommen(k)) continue;
    const gesehen = new Set<string>();
    for (const a of k.aktivitaeten ?? []) {
      const t = a.text ?? '';
      if (!t.startsWith(PRAEFIX)) continue;
      if ((art === 'termin') !== t.startsWith(TERMIN)) continue;
      const tag = a.am.slice(0, 10);
      if (tag < ab || tag > heute || gesehen.has(tag)) continue;
      gesehen.add(tag);
      raus.push({ kontakt: k, tag, text: t.slice(PRAEFIX.length) });
    }
  }
  return raus.sort((x, y) => y.tag.localeCompare(x.tag));
}

export const checksImFenster = (w: WebseiteStand, heute: string, tage = 30) => { const ab = tagMinus(heute, tage - 1); return w.checks.filter(c => c.tag >= ab && c.tag <= heute).sort((x, y) => y.tag.localeCompare(x.tag)); };

/** Die drei Kennzahlen (Kpi-Form wie die übrigen Welten) — ohne laufende Website „grau“ (Lücke). */
export function webseiteKennzahlen(kontakte: readonly Kontakt[], w: WebseiteStand | undefined, heute: string): Kpi[] {
  const grau = (id: string, label: string, ziel: string): Kpi => ({ id, label, wert: null, anzeige: '—', ampel: 'grau', ziel, quelle: 'Website nicht eingeschaltet (Check oder Kontaktformular)' });
  if (!w?.aktiv) return [grau('web_anfragen', 'Anfragen über die Website · 30 Tage', '≥ 4'), grau('web_checks', 'Abgeschlossene Checks · 30 Tage', '≥ 4'), grau('web_termine', 'Termine aus der Website · 30 Tage', '≥ 2')];
  const a = webseiteTreffer(kontakte, heute, 'anfrage').length;
  const c = checksImFenster(w, heute).length;
  const t = webseiteTreffer(kontakte, heute, 'termin').length;
  return [
    { id: 'web_anfragen', label: 'Anfragen über die Website · 30 Tage', wert: a, anzeige: String(a), ampel: stufe(a, 4, 1), ziel: '≥ 4', quelle: 'Anfragen „über Website“ in der Kartei (Check, Kontaktformular, von Hand)' },
    { id: 'web_checks', label: 'Abgeschlossene Checks · 30 Tage', wert: c, anzeige: String(c), ampel: stufe(c, 4, 1), ziel: '≥ 4', quelle: 'Check-Sitzungen mit Ergebnis' },
    { id: 'web_termine', label: 'Termine aus der Website · 30 Tage', wert: t, anzeige: String(t), ampel: stufe(t, 2, 1), ziel: '≥ 2', quelle: 'Freigegebene Buchungen der Buchungsseite' },
  ];
}

/** Die Punkte hinter den Kennzahlen (je höchstens 4, mit Weg). */
export function webseiteDetails(id: 'web_anfragen' | 'web_checks' | 'web_termine', kontakte: readonly Kontakt[], w: WebseiteStand | undefined, heute: string): Detail[] {
  if (!w?.aktiv) return [];
  if (id === 'web_checks') return checksImFenster(w, heute).slice(0, 4).map(c => ({ titel: c.name, wert: tagKurz(c.tag), href: WEG.website('checks') }));
  return webseiteTreffer(kontakte, heute, id === 'web_termine' ? 'termin' : 'anfrage').slice(0, 4)
    .map(x => ({ titel: anzeigename(x.kontakt), wert: tagKurz(x.tag), unter: x.text.slice(0, 70), href: WEG.akte(x.kontakt.id) }));
}
