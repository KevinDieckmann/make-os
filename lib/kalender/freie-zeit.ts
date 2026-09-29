// ─── Kalender — freie Zeit (Server-Lesefunktion, 29.09., Paket K4) ───────────
// EINE Lesefunktion für alle, die freie Zeit brauchen: „Mit … planen“ im Kalender (/api/kalender/frei),
// die öffentliche Buchungsseite (/api/buchung/[slug]), ZOE (Werkzeug „freie_zeit“, nur lesen) und das
// Angebots-Tool („Termin zum Besprechen vorschlagen“). Nur lesen, nie schreiben, liefert nur Zeiten.
//
// Aufbau (KALENDER_VERBINDUNGEN.md › „eine Stelle für Kalenderrechnung“, keine zweite Logik):
//   · WANN jemand da ist = K1 `verfuegbarkeitFuer(person, von, bis)` (lib/kalender/verfuegbarkeit.ts): beschäftigt
//     (TRANSP), Abwesend, Arbeitsort, Soll-Arbeitszeit aus der Wochenvorlage (Planung › Routinen), Feiertage NRW.
//     Hier wird nur übersetzt (`belegungenAus`, `arbeitszeitAus`, `feiertageAus`). Ohne Wochenvorlage gilt der Standard
//     Mo–Fr 09:00–18:00 — mit denselben Ausnahmen wie K1 (kein Feiertag, kein ganz abwesender Tag).
//   · Gehaltene Buchungen (vorläufig/angefragt/bestätigt, noch nicht in iCloud) zählen als belegt.
//   · Lücken suchen = rein in lib/kalender/verfuegbar.ts `freieZeiten`.

import { localDay } from '@/lib/zeit';
import { tagPlus, wandAus } from './zeit';
import { verfuegbarkeitFuer, type Verfuegbarkeit } from './verfuegbarkeit';
import { freieZeiten, fensterSauber, wochentag, ARBEITSZEIT_STANDARD, type Belegung, type FreieZeit, type PersonName, type Zeitspanne } from './verfuegbar';
import { ladeBuchungBestand } from './buchung-speicher';
import { buchungenAlsBelegung } from './buchung';
import { ladeEinstellungen } from './einstellungen';
import { freieTageIm, type FreierTag } from './freie-tage';

/** Belegt aus K1: alles Beschäftigte je Tag (Abwesend als „abwesend“, ohne Puffer), ganz abwesende Tage ganz. */
export function belegungenAus(v: Verfuegbarkeit): Belegung[] {
  const raus: Belegung[] = [];
  for (const t of v.tage) {
    if (t.ganzAbwesend) raus.push({ wer: v.person, start: `${t.tag}T00:00:00`, ende: `${tagPlus(t.tag, 1)}T00:00:00`, art: 'abwesend' });
    for (const b of t.beschaeftigt) raus.push({ wer: v.person, start: b.start, ende: b.ende, art: b.art === 'abwesend' ? 'abwesend' : 'belegt' });
    for (const a of t.abwesend) if (!a.ganztags) raus.push({ wer: v.person, start: a.start, ende: a.ende, art: 'abwesend' });
  }
  return raus;
}

/**
 * Soll-Arbeitszeit je Tag aus K1 (Wochenvorlage). Hat die Person keine Vorlage (kein Tag mit Arbeitszeit), gilt der
 * Standard Mo–Fr 09:00–18:00 — an Feiertagen und ganz abwesenden Tagen nicht (wie K1).
 */
export function arbeitszeitAus(v: Verfuegbarkeit): Record<string, Zeitspanne[]> {
  if (v.tage.some(t => t.arbeitszeit.length)) return Object.fromEntries(v.tage.map(t => [t.tag, t.arbeitszeit]));
  const std = fensterSauber(ARBEITSZEIT_STANDARD) ?? [];
  return Object.fromEntries(v.tage.map(t => [t.tag, t.feiertag || t.ganzAbwesend ? [] : std.filter(f => f.tage.includes(wochentag(t.tag))).map(f => {
    const von = Number(f.von.slice(0, 2)) * 60 + Number(f.von.slice(3, 5)), bis = Number(f.bis.slice(0, 2)) * 60 + Number(f.bis.slice(3, 5));
    return { start: wandAus(t.tag, von), ende: wandAus(t.tag, bis) };
  })]));
}

/** Feiertage NRW aus K1 (Tag → Name). */
export const feiertageAus = (v: Verfuegbarkeit): Record<string, string> => Object.fromEntries(v.tage.filter(t => t.feiertag).map(t => [t.tag, t.feiertag!]));

/**
 * Gesperrte Tage für Buchung und freie Zeit (R-K2 #72): Feiertage NRW aus K1 + die „freien Tage“ aus den
 * Kalender-Einstellungen (24.12., 31.12. … — nicht gesetzlich, aber frei). Tag → Name.
 */
export const sperrTageAus = (v: Verfuegbarkeit, freie: readonly FreierTag[], von: string, bis: string): Record<string, string> =>
  ({ ...freieTageIm(von, bis, freie), ...feiertageAus(v) });

export interface FreieZeitAnfrage {
  personen: PersonName[];
  dauerMin: number;
  /** Ab welchem Berliner Tag (Standard heute). */
  von?: string;
  tage?: number;
  pufferMin?: number;
  vorlaufMin?: number;
  rasterMin?: number;
  grenze?: number;
  jetzt?: Date;
}

/** Freie gemeinsame Zeit der Personen — die eine Lesefunktion. Liefert nur Zeiten (+ Feiertage), nie Titel. */
export async function freieZeitFuer(a: FreieZeitAnfrage): Promise<{ vorschlaege: FreieZeit[]; von: string; bis: string; feiertage: Record<string, string> }> {
  const jetzt = a.jetzt ?? new Date();
  const von = a.von ?? localDay(jetzt);
  const tage = Math.max(1, Math.min(60, Math.round(a.tage ?? 14)));
  const bis = tagPlus(von, tage);
  const personen = Array.from(new Set(a.personen));
  const [je, bestand, einst] = await Promise.all([Promise.all(personen.map(p => verfuegbarkeitFuer(p, von, bis))), ladeBuchungBestand(jetzt), ladeEinstellungen()]);
  const feiertage = je.length ? feiertageAus(je[0]) : {};
  // R-K2 #72: „frei, aber nicht gesetzlich“ (24.12., 31.12. …) — an diesen Tagen schlägt die Suche nichts vor.
  const frei = freieTageIm(von, bis, einst.freieTage);
  const ohneFreie = (az: Record<string, Zeitspanne[]>) => Object.fromEntries(Object.entries(az).map(([tag, z]) => [tag, frei[tag] ? [] : z]));
  const vorschlaege = freieZeiten({
    personen,
    belegungen: [...je.flatMap(belegungenAus), ...personen.flatMap(p => buchungenAlsBelegung(bestand, p, jetzt.toISOString()))],
    arbeitszeitJeTag: Object.fromEntries(je.map(v => [v.person, ohneFreie(arbeitszeitAus(v))])),
    dauerMin: a.dauerMin, von, tage, jetzt, vorlaufMin: a.vorlaufMin ?? 0, pufferMin: a.pufferMin ?? 0, rasterMin: a.rasterMin ?? 15, feiertage, grenze: a.grenze ?? 200,
  });
  return { vorschlaege, von, bis, feiertage };
}
