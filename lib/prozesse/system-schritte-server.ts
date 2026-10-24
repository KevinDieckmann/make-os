// ─── Prozesse · Überführung — die festen Schritte (Server; 22.10., Paket Ü) ──────────────────────────────────────────────────────────────────────────────
// Ein fester Schritt (Baustein `system.fest`) ist der Kern eines überführten System-Ablaufs — er ruft DENSELBEN Kern wie der alte Einstiegspunkt (eine Regel, ein
// Schreibweg, dieselben Kennungen: die Kennungs-Brücke). Der Prozess der Werkstatt steuert, wann er läuft; der Schritt selbst erfindet nichts:
//   mahnaufgaben    lib/finanzen/rechnung/server.ts `mahnAufgabenKern` (nur Rechnungen der Business-Gesellschaften) — Aufgabe `mahn-<rechnung>-<stufe>`
//   treppe-report   lib/crm/treppe-server.ts `treppeReportsKern` (Mandate der Leistungstreppe sind Business) — Vorschlag + Glocke + Marke `report:<mandat>`
//   fall-vorschlag  lib/fulfillment/prozesse/server.ts `onboardingVorschlaegeKern` (nur Business-Mandate) — Vorschlag „Fall starten“ + Glocke + Marke `onboarding-vorschlag:<mandat>`
//   power-hour      lib/heads/takt.ts `powerHourKern` (je Person des Laufs, 24.10.) — Auftrag `head-sales · modus:power_hour person:<p>` in die Warteschlange
// `schatten` rechnet nur (schreibt NICHTS) und liefert das Wirkungsbild für den Vergleich; `scharf` schreibt über den Kern. Die Wirkungsbilder (`mahnBild`,
// `reportBild`) bauen alter und neuer Weg mit derselben Funktion — nur Kennungen, die Zuständigkeit speichert der Vergleich nur als Fingerabdruck.

import { localDay } from '@/lib/zeit';
import type { SystemSchrittId, Wirkungsbild } from './ueberfuehrung';
import type { Wirkung } from './lauf-typen';

export type SystemSchrittErgebnis = { ok: true; bild: Wirkungsbild[]; neu: number; wirkung: Wirkung[] } | { ok: false; voruebergehend: boolean };

/** Wirkungsbild der Mahnaufgaben: je fälliger Stufe die Aufgabe (`mahn-…`), fällig heute, für beide (wie der Morgenlauf seit dem 08.10.). */
export const mahnBild = (soll: readonly { id: string }[], heute: string): Wirkungsbild[] => soll.map(s => ({ art: 'aufgabe', ziel: s.id, tag: heute, zustaendig: 'both' }));
/** Wirkungsbild der Report-Vorschläge: je Mandat der Vorschlag (`report:<mandat>`), heute, für die zuständige Team-Person bzw. den Haushalt. */
export const reportBild = (soll: readonly { mandatId: string; fuer: string }[], heute: string): Wirkungsbild[] => soll.map(s => ({ art: 'vorschlag', ziel: `report:${s.mandatId}`, tag: heute, zustaendig: s.fuer }));

/** Wirkungsbild der Onboarding-Vorschläge: je Mandat der Vorschlag (`onboarding:<mandat>`), heute, für die zuständige Person bzw. den Haushalt. */
export const onboardingBild = (soll: readonly { mandatId: string; fuer: string }[], heute: string): Wirkungsbild[] => soll.map(s => ({ art: 'vorschlag', ziel: `onboarding:${s.mandatId}`, tag: heute, zustaendig: s.fuer }));

/** Einen festen Schritt ausführen (`scharf`) bzw. nur rechnen (`schatten`). Wirft nie — ein nicht lesbarer Bestand ist „vorübergehend“ (der Motor wiederholt). */
export async function systemSchrittAusfuehren(s: SystemSchrittId, kx: { modus: 'scharf' | 'schatten'; jetzt: Date; /** Die Person des Laufs (Auslöser „je Person“). */ person?: string | null }): Promise<SystemSchrittErgebnis> {
  const heute = localDay(kx.jetzt);
  const schreiben = kx.modus === 'scharf';
  try {
    switch (s) {
      case 'mahnaufgaben': {
        const { mahnAufgabenKern } = await import('@/lib/finanzen/rechnung/server');
        const r = await mahnAufgabenKern(heute, { bereich: 'business', schreiben });
        return { ok: true, bild: mahnBild(r.soll, heute), neu: r.neu, wirkung: r.neueIds.map(id => ({ art: 'aufgabe' as const, id })) };
      }
      case 'treppe-report': {
        const { treppeReportsKern } = await import('@/lib/crm/treppe-server');
        const r = await treppeReportsKern(heute, { schreiben });
        return { ok: true, bild: reportBild(r.soll, heute), neu: r.reports, wirkung: r.vorschlaege.map(id => ({ art: 'vorschlag' as const, id })) };
      }
      case 'fall-vorschlag': {
        const [{ onboardingVorschlaegeKern }, { fulfillmentHaushalt }] = await Promise.all([import('@/lib/fulfillment/prozesse/server'), import('@/lib/fulfillment/speicher')]);
        const r = await onboardingVorschlaegeKern(await fulfillmentHaushalt(), heute, { schreiben });
        return { ok: true, bild: onboardingBild(r.soll, heute), neu: r.vorschlaege.length, wirkung: r.vorschlaege.map(id => ({ art: 'vorschlag' as const, id })) };
      }
      case 'power-hour': {
        // Je Person (Auslöser „je Person“): ohne Person kein Auftrag — dauerhaft (der Lauf hält mit Grund, nie ein Rückfall auf den Inhaber).
        if (!kx.person || kx.person === '[gelöscht]') return { ok: false, voruebergehend: false };
        const { powerHourKern } = await import('@/lib/heads/takt');
        const r = await powerHourKern(kx.person, kx.jetzt, { schreiben });
        // Gesperrt (Not-Aus, Head-Budget, Pause nach Fehlern) bzw. Warteschlange voll: später noch einmal — wie der Takt, der jede Minute wieder fragt.
        if (r.status === 'gesperrt' || r.status === 'voll') return { ok: false, voruebergehend: true };
        return { ok: true, bild: r.bild, neu: r.status === 'eingereiht' ? 1 : 0, wirkung: r.auftragId ? [{ art: 'auftrag' as const, id: r.auftragId }] : [] };
      }
    }
  } catch (e) {
    console.error(`[prozesse/fester-schritt] ${s}: ${e instanceof Error ? e.message.slice(0, 160) : 'Fehler'}`);
    return { ok: false, voruebergehend: true };
  }
}
