// ─── Fulfillment · Kunde — Zusatz zum 2-Wochen-Report (rein, client-sicher; C2, 10.10.; FULFILLMENT_KONZEPT.md 5.2) ─────────────────────────────
// Der vorhandene Fortschritts-Report der Leistungstreppe (lib/crm/treppe-report.ts) wird ERWEITERT, nicht ersetzt: mit Fall kommen „Wartet auf euch“,
// das Wert-Konto (vorher → jetzt → Ziel), der letzte Kunden-Puls und — nur bei aktivem Kunden-Link mit Recht „Puls“ — die Puls-Frage dazu.
// OHNE Fall: null → Dokument, PDF und Mail bleiben Byte für Byte wie heute (Schnappschuss tests/fulfillment-c2-report.test.ts).
// Gerechnet wird nur mit den Regeln aus C0 (`wartetAufEuch`, `wertKontoZeilen`); der Server holt Fall, Mandat und Kunden-Bestand. Knoten, die auf einen
// Baustein zeigen, der nicht an Kunden geht (`kundenGesperrt` aus C1 — die EINE Regel), erscheinen auch hier nie.

import { wartetAufEuch, wertKontoZeilen } from '../regeln';
import { tagePlus, tagVon } from '@/lib/zeit';
import { letzterPuls } from './puls';
import { knotenGesperrt } from './sicht';
import type { Fall, KundeDatei, ReportZusatz } from '../typen';
import type { Mandat } from '@/lib/crm/typen';

/** Ein Puls zählt im Report, wenn er höchstens so viele Tage alt ist. */
export const PULS_IM_REPORT_TAGE = 90;

export function reportZusatz(fall: Fall | null, mandat: Pick<Mandat, 'id' | 'ziele'>, kunde: Pick<KundeDatei, 'puls'>, heute: string, pulsFrage: boolean, gesperrt: ReadonlySet<string> = new Set()): ReportZusatz | null {
  if (!fall) return null;
  // Der Report geht an den Kunden: nur geteilte Entscheidungen (Prüf-Fund 11.10.), keine gesperrten Knoten.
  const wartet = wartetAufEuch({ ...fall, knoten: fall.knoten.filter(k => !knotenGesperrt(k, gesperrt)), entscheidungen: fall.entscheidungen.filter(x => x.geteilt) }, heute).map(w => (w.tage !== undefined && w.tage > 0 ? `${w.titel} (seit ${w.tage} ${w.tage === 1 ? 'Tag' : 'Tagen'})` : w.titel));
  const p = letzterPuls(kunde, mandat.id);
  const puls = p && tagVon(p.am) >= tagePlus(heute, -PULS_IM_REPORT_TAGE) ? { wert: p.wert, am: tagVon(p.am) } : undefined;
  return { wartetAufEuch: wartet, wertKonto: wertKontoZeilen(fall, mandat), ...(puls ? { puls } : {}), ...(pulsFrage ? { pulsFrage: true } : {}) };
}
