// ─── Fulfillment · Kunde — Zusatz zum 2-Wochen-Report (rein, client-sicher; C2, 10.10.; FULFILLMENT_KONZEPT.md 5.2) ─────────────────────────────
// Der vorhandene Fortschritts-Report der Leistungstreppe (lib/crm/treppe-report.ts) wird ERWEITERT, nicht ersetzt: mit Fall kommen „Wartet auf euch“,
// das Wert-Konto (vorher → jetzt → Ziel), der letzte Kunden-Puls und — nur bei aktivem Kunden-Link mit Recht „Puls“ — die Puls-Frage dazu.
// OHNE Fall: null → Dokument, PDF und Mail bleiben Byte für Byte wie heute (Schnappschuss tests/fulfillment-c2-rein.test.ts).
// Gerechnet wird nur mit den Regeln aus C0 (`wartetAufEuch`, `wertKontoZeilen`); der Server holt Fall, Mandat und Kunden-Bestand. Knoten, die auf einen
// Baustein zeigen, der nicht an Kunden geht (`kundenGesperrt` aus C1 — die EINE Regel), erscheinen auch hier nie.
//
// Seit 12.10. (Fulfillment extern, „ein Bild“): dazu die Teile der Kunden-Seite aus `kundenTeile` (lib/fulfillment/kunde/bild.ts) — Lage mit Ampel und
// drei Sätzen, Phasen-Strahl, Fortschritt, erledigt/als Nächstes aus dem Fall, erste Erfolge, nächster Termin, Anteil je Ziel und die Anrede. Damit
// zeigen Seite 1 des Reports und die Kunden-Seite dasselbe Bild.

import { wartetAufEuch, wertKontoZeilen } from '../regeln';
import { tagePlus, tagVon } from '@/lib/zeit';
import { letzterPuls } from './puls';
import { knotenGesperrt } from './sicht';
import { kundenTeile, kundenText, type KundenAnrede } from './bild';
import type { Fall, Freigabepunkt, KundeDatei, ReportZusatz, RitualVorlage } from '../typen';
import type { Mandat } from '@/lib/crm/typen';

/** Ein Puls zählt im Report, wenn er höchstens so viele Tage alt ist. */
export const PULS_IM_REPORT_TAGE = 90;

/** Was der Report über den Fall hinaus braucht (der Server liest es mit `kundenUmfeld`). */
export interface ReportUmfeld {
  anrede?: KundenAnrede;
  freigaben?: readonly Pick<Freigabepunkt, 'id' | 'titel' | 'wer'>[];
  rituale?: readonly Pick<RitualVorlage, 'id' | 'titel' | 'rhythmus'>[];
  terminTage?: readonly { uid: string; tag: string }[];
}

export function reportZusatz(fall: Fall | null, mandat: Pick<Mandat, 'id' | 'ziele'>, kunde: Pick<KundeDatei, 'puls'>, heute: string, pulsFrage: boolean, gesperrt: ReadonlySet<string> = new Set(), umfeld: ReportUmfeld = {}): ReportZusatz | null {
  if (!fall) return null;
  // Der Report geht an den Kunden: nur geteilte Entscheidungen (Prüf-Fund 11.10.), keine gesperrten Knoten, keine internen Kürzel.
  const wartet = wartetAufEuch({ ...fall, knoten: fall.knoten.filter(k => !knotenGesperrt(k, gesperrt)), entscheidungen: (fall.entscheidungen ?? []).filter(x => x.geteilt) }, heute)
    .map(w => { const t = kundenText(w.titel); return w.tage !== undefined && w.tage > 0 ? `${t} (seit ${w.tage} ${w.tage === 1 ? 'Tag' : 'Tagen'})` : t; });
  const p = letzterPuls(kunde, mandat.id);
  const puls = p && tagVon(p.am) >= tagePlus(heute, -PULS_IM_REPORT_TAGE) ? { wert: p.wert, am: tagVon(p.am) } : undefined;
  const anrede = umfeld.anrede ?? 'sie';
  const t = kundenTeile({
    fall, mandat, heute, anrede, gesperrt, ...(umfeld.freigaben ? { freigaben: umfeld.freigaben } : {}), ...(umfeld.rituale ? { rituale: umfeld.rituale } : {}),
    ...(umfeld.terminTage ? { terminTage: umfeld.terminTage } : {}),
  });
  const anteil = new Map(t.wertKonto.map(w => [w.name, w.anteil]));
  return {
    wartetAufEuch: wartet, wertKonto: wertKontoZeilen(fall, mandat).map(z => (anteil.get(z.name) != null ? { ...z, anteil: anteil.get(z.name)! } : z)),
    ...(puls ? { puls } : {}), ...(pulsFrage ? { pulsFrage: true } : {}),
    anrede, lage: t.lage, phasen: t.phasen, ...(t.fortschritt ? { fortschritt: t.fortschritt } : {}), erledigt: t.erledigt, naechstes: t.naechstes,
    quickWins: t.quickWins, ...(t.naechsterTermin ? { naechsterTermin: t.naechsterTermin } : {}),
  };
}
