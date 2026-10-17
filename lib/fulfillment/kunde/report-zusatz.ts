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
import { fragenText, kundenTeile, kundenText, type KundenAnrede, type KundenHaenger } from './bild';
import type { Fall, Freigabepunkt, KundeDatei, ReportZusatz, RitualVorlage } from '../typen';
import type { Mandat } from '@/lib/crm/typen';

/** Ein Puls zählt im Report, wenn er höchstens so viele Tage alt ist. */
export const PULS_IM_REPORT_TAGE = 90;

/** Was der Report über den Fall hinaus braucht (der Server liest es mit `kundenUmfeld`). */
export interface ReportUmfeld {
  anrede?: KundenAnrede;
  freigaben?: readonly Pick<Freigabepunkt, 'id' | 'titel' | 'wer'>[];
  rituale?: readonly Pick<RitualVorlage, 'id' | 'titel' | 'rhythmus'>[];
  terminTage?: readonly { uid: string; tag: string; von?: string; titel?: string }[];
  /** 14.10.: dieselben offenen Formulare wie die Kunden-Seite (Baustein → öffentlicher Schlüssel; offene mit Zählung) — zählen unter „wartet auf euch“. */
  formulare?: ReadonlyMap<string, string>;
  formulareOffen?: readonly { schluessel: string; titel: string; beantwortet: number; gesamt: number }[];
  /** Was intern hängt (Cockpit) — die Lage übersetzt es in Worte, wie auf der Kunden-Seite. */
  haengt?: readonly KundenHaenger[];
}

/**
 * Der Fall, wie er am Stand eines Reports aussah: Messungen im Wert-Konto und erste Erfolge erst ab ihrem Tag (17.10., dritte Abnahme C6: der Report
 * „Stand 02.10.“ zeigte den Messwert vom 09.10.). Rein — heute = Stand des Reports.
 */
export function fallBisStand(fall: Fall, heute: string): Fall {
  const wertKonto = Object.fromEntries(Object.entries(fall.wertKonto ?? {}).map(([id, w]) => [id, { ...w, messungen: (w.messungen ?? []).filter(m => tagVon(m.am) <= heute) }]));
  const quickWins = (fall.quickWins ?? []).map(q => {
    if (!q.erledigtAm || tagVon(q.erledigtAm) <= heute) return q;
    const r = { ...q };
    delete r.erledigtAm;
    return r;
  });
  return { ...fall, wertKonto, quickWins };
}

export function reportZusatz(fallJetzt: Fall | null, mandat: Pick<Mandat, 'id' | 'ziele'>, kunde: Pick<KundeDatei, 'puls'>, heute: string, pulsFrage: boolean, gesperrt: ReadonlySet<string> = new Set(), umfeld: ReportUmfeld = {}): ReportZusatz | null {
  if (!fallJetzt) return null;
  const fall = fallBisStand(fallJetzt, heute);
  // Der Report geht an den Kunden: nur geteilte Entscheidungen (Prüf-Fund 11.10.), keine gesperrten Knoten, keine internen Kürzel.
  const wartet = wartetAufEuch({ ...fall, knoten: fall.knoten.filter(k => !knotenGesperrt(k, gesperrt)), entscheidungen: (fall.entscheidungen ?? []).filter(x => x.geteilt) }, heute)
    .map(w => { const t = kundenText(w.titel); return w.tage !== undefined && w.tage > 0 ? `${t} (seit ${w.tage} ${w.tage === 1 ? 'Tag' : 'Tagen'})` : t; });
  // Nur ein Puls bis zum Stand des Reports (15.10., Abnahme B6: ein Report vom 01.10. zeigte den Puls vom 15.10.).
  const p = letzterPuls({ puls: kunde.puls.filter(x => tagVon(x.am) <= heute) }, mandat.id);
  const puls = p && tagVon(p.am) >= tagePlus(heute, -PULS_IM_REPORT_TAGE) ? { wert: p.wert, am: tagVon(p.am) } : undefined;
  const anrede = umfeld.anrede ?? 'sie';
  const t = kundenTeile({
    fall, mandat, heute, anrede, gesperrt, ...(umfeld.freigaben ? { freigaben: umfeld.freigaben } : {}), ...(umfeld.rituale ? { rituale: umfeld.rituale } : {}),
    ...(umfeld.terminTage ? { terminTage: umfeld.terminTage } : {}), ...(umfeld.formulare ? { formulare: umfeld.formulare } : {}),
    ...(umfeld.formulareOffen ? { formulareOffen: umfeld.formulareOffen.map(x => x.schluessel) } : {}), ...(umfeld.haengt ? { haengt: umfeld.haengt } : {}),
  });
  // Offene Formulare, die nicht schon über „wartet“ verlinkt sind, stehen mit in der Liste — dieselbe Zählung wie Lage und Kunden-Seite (`brauchtAnzahl`).
  const formularZeilen = (umfeld.formulareOffen ?? []).filter(x => !t.wartet.some(w => w.formular === x.schluessel))
    .map(x => `${kundenText(x.titel)} ${x.gesamt && x.beantwortet === x.gesamt ? 'abschließen' : `ausfüllen (${fragenText(x)})`}`);
  const anteil = new Map(t.wertKonto.map(w => [w.name, w.anteil]));
  return {
    wartetAufEuch: [...wartet, ...formularZeilen], wertKonto: wertKontoZeilen(fall, mandat).map(z => (anteil.get(z.name) != null ? { ...z, anteil: anteil.get(z.name)! } : z)),
    ...(puls ? { puls } : {}), ...(pulsFrage ? { pulsFrage: true } : {}),
    anrede, lage: t.lage, phasen: t.phasen, ...(t.fortschritt ? { fortschritt: t.fortschritt } : {}), erledigt: t.erledigt, naechstes: t.naechstes,
    quickWins: t.quickWins, ...(t.naechsterTermin ? { naechsterTermin: t.naechsterTermin } : {}),
  };
}
