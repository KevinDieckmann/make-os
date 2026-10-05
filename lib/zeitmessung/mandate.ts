// ─── Zeit & Fokus — Zeit je Mandat (28.09., rein, getestet) ─────────────────
// Kevin: „Mandat an Zielen und Zeit“ — z. B. Zeit je Mandat für Abrechnung und
// Auslastung. Gezählt werden (wie bei der Zeit je Einheit) nur bewusste
// Blöcke der Arbeit (Business und, seit 05.10. abends, die Arbeit der Selbstständigkeit unter Privat); der Zeitraum ist die Berliner Woche (Mo–So) oder der
// Kalendermonat (lib/zeitmessung/einheiten.ts `zeitraumVon`/`bloeckeImZeitraum`).
// Je Mandat: Stunden, Blöcke — und, wenn das Mandat ein Monatshonorar hat, ein
// grober Hinweis „≈ € je Stunde“ (Monatshonorar anteilig auf den Zeitraum geteilt
// durch die erfasste Zeit). Das ist bewusst nur ein Hinweis, kein Rechnungsbezug.

import { mandatLabel, type MandatKurz } from '@/lib/planung/mandat';
import { zeitraumVon, bloeckeImZeitraum, arbeitsPruefer, nurBusinessBloecke, type Zeitraum } from './einheiten';
import type { FokusBlock, ZeitDatei } from './modell';

/** Zeile „ohne Mandat“ — der Marker kann mit keiner CRM-Kennung kollidieren. */
export const MANDAT_OHNE = '__ohne__';
/** Unter so viel erfasster Zeit gibt es keinen €/Stunde-Hinweis (sonst absurde Zahlen). */
export const SATZ_AB_SEK = 15 * 60;

export interface MandatZeile {
  /** Mandats-Kennung — oder MANDAT_OHNE. */
  id: string;
  label: string;
  art: 'mandat' | 'geloescht' | 'ohne';
  firmaId?: string;
  einheit?: string;
  sek: number;
  bloecke: number;
  /** Monatshonorar netto des Mandats (nur Basis „Monat“). */
  honorarMonat?: number;
  /** Das Honorar anteilig auf den Zeitraum (Monat: ganz, Woche: × 12/52). */
  honorarZeitraum?: number;
  /** Grober Hinweis: anteiliges Honorar ÷ erfasste Stunden, gerundet — erst ab SATZ_AB_SEK. */
  euroJeStunde?: number;
}
export interface MandatAuswertung {
  /** Alle bewussten Business-Sekunden im Zeitraum (mit und ohne Mandat). */
  sek: number;
  /** Davon mit Mandat. */
  mitMandatSek: number;
  bloecke: number;
  /** Mandate mit Zeit (meiste zuerst), „ohne Mandat“ immer zuletzt. */
  zeilen: MandatZeile[];
}
export interface ZeitJeMandat {
  zeitraum: Zeitraum; von: string; bis: string; label: string;
  personen: { person: string; name: string; auswertung: MandatAuswertung }[];
  gesamt: MandatAuswertung;
}

/** Das Monatshonorar anteilig auf den Zeitraum: Monat ganz, Woche 12/52 davon. */
export const honorarImZeitraum = (honorarMonat: number, zeitraum: Zeitraum): number =>
  Math.round((zeitraum === 'monat' ? honorarMonat : (honorarMonat * 12) / 52) * 100) / 100;

/** Blöcke → Zeilen je Mandat. Ein Mandat, das es nicht (mehr) gibt, steht als „Mandat (gelöscht)“ mit seiner Zeit. */
export function mandateAuswerten(bloecke: readonly FokusBlock[], mandate: ReadonlyMap<string, MandatKurz>, zeitraum: Zeitraum): MandatAuswertung {
  const topf = new Map<string, { sek: number; bloecke: number; firmaId?: string }>();
  let sek = 0, mitMandatSek = 0;
  for (const b of bloecke) {
    if (!(b.sek > 0)) continue;
    const id = b.mandatId || MANDAT_OHNE;
    const t = topf.get(id) ?? { sek: 0, bloecke: 0, ...(b.firmaId ? { firmaId: b.firmaId } : {}) };
    t.sek += b.sek; t.bloecke += 1;
    topf.set(id, t);
    sek += b.sek;
    if (id !== MANDAT_OHNE) mitMandatSek += b.sek;
  }
  const zeilen: MandatZeile[] = [...topf.entries()].filter(([id]) => id !== MANDAT_OHNE).map(([id, t]) => {
    const m = mandate.get(id);
    if (!m) return { id, label: 'Mandat (gelöscht)', art: 'geloescht' as const, ...(t.firmaId ? { firmaId: t.firmaId } : {}), sek: t.sek, bloecke: t.bloecke };
    const honorarZeitraum = m.honorarMonat ? honorarImZeitraum(m.honorarMonat, zeitraum) : undefined;
    const euroJeStunde = honorarZeitraum && t.sek >= SATZ_AB_SEK ? Math.round(honorarZeitraum / (t.sek / 3600)) : undefined;
    return {
      id, label: mandatLabel(m), art: 'mandat' as const,
      ...(m.firmaId ? { firmaId: m.firmaId } : {}), ...(m.einheit ? { einheit: m.einheit } : {}),
      sek: t.sek, bloecke: t.bloecke,
      ...(m.honorarMonat ? { honorarMonat: m.honorarMonat, honorarZeitraum } : {}),
      ...(euroJeStunde ? { euroJeStunde } : {}),
    };
  }).sort((a, b) => b.sek - a.sek || a.label.localeCompare(b.label, 'de'));
  const ohne = topf.get(MANDAT_OHNE);
  zeilen.push({ id: MANDAT_OHNE, label: 'ohne Mandat', art: 'ohne', sek: ohne?.sek ?? 0, bloecke: ohne?.bloecke ?? 0 });
  return { sek, mitMandatSek, bloecke: bloecke.filter(b => b.sek > 0).length, zeilen };
}

/** Die ganze Auswertung: je Person und gesamt (alle übergebenen Personen zusammen). */
export function zeitJeMandat(
  personen: readonly { person: string; name: string; datei: ZeitDatei }[],
  mandate: ReadonlyMap<string, MandatKurz>,
  zeitraum: Zeitraum,
  stichtag: string,
  /** Konten ohne Privatzugang: nur Business-Blöcke (die Arbeit der Selbstständigkeit gehört zu Privat). */
  nurBusiness = false,
): ZeitJeMandat {
  const { von, bis, label } = zeitraumVon(zeitraum, stichtag);
  const alle: FokusBlock[] = [];
  // Arbeit (05.10. abends): Business-Blöcke und Privat-Blöcke mit Mandat/Einheit einer Privat-Arbeits-Einheit (Selbstständigkeit).
  const istArbeit = nurBusiness ? nurBusinessBloecke : arbeitsPruefer(null, mandate);
  const jePerson = personen.map(p => {
    const b = bloeckeImZeitraum(p.datei, von, bis, istArbeit);
    alle.push(...b);
    return { person: p.person, name: p.name, auswertung: mandateAuswerten(b, mandate, zeitraum) };
  });
  return { zeitraum, von, bis, label, personen: jePerson, gesamt: mandateAuswerten(alle, mandate, zeitraum) };
}
