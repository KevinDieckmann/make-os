// ─── Fulfillment — verwaiste Fälle (Löschfristen 8.1, rein; Gesamtprüfung 17.10. L2 B5) ─────────────────────────────────────────
// Ein Fall gehört zu einem Mandat (Schlüssel = Mandats-Kennung). Ist das Mandat endgültig weg (nicht im CRM, auch nicht im Papierkorb),
// räumt der Löschfristen-Lauf den Fall ab — aber nie auf einen Schlag: bis 17.10. entfernte er ihn sofort, und ein leerer oder falsch
// gelesener Mandats-Bestand (Wiederherstellung, Umzug, Fehler) hätte JEDEN Fall gelöscht. Jetzt:
//   · ohne ein einziges Mandat im CRM wird nichts angefasst (Bremse — das ist nie der Normalfall, solange es Fälle gibt);
//   · ein verwaister Fall bekommt zuerst die Marke `verwaist-seit` (Tag); erst nach `VERWAIST_TAGE` ohne Mandat fällt er weg;
//   · taucht das Mandat wieder auf (Rückspielen, Papierkorb zurück), verschwindet die Marke — nichts ging verloren;
//   · fielen auf einmal mehr als die Hälfte aller Fälle (und mehr als `MASSEN_AB`) weg, bremst der Lauf und entfernt keinen.
// Nur Zähler nach außen — keine Namen, keine Kennungen.

import type { Fall } from '../typen';
import { tagPlus } from '@/lib/kalender/zeit';

export const MARKE_VERWAIST = 'verwaist-seit';
/** So lange bleibt ein Fall ohne Mandat liegen, bevor der Lauf ihn entfernt. */
export const VERWAIST_TAGE = 30;
/** Ab so vielen Fällen auf einmal (und mehr als der Hälfte) bremst der Lauf. */
export const MASSEN_AB = 3;

export interface VerwaistErgebnis {
  faelle: Record<string, Fall>;
  /** Fälle, die heute zum ersten Mal ohne Mandat gesehen wurden. */
  markiert: number;
  /** Fälle, deren Mandat wieder da ist (Marke gelöst). */
  zurueck: number;
  /** Entfernte Fälle (nach Ablauf der Wartezeit). */
  weg: number;
  /** Der Lauf hat gebremst (kein Mandat im CRM oder zu viele auf einmal). */
  gebremst: 'keine-mandate' | 'zu-viele' | null;
}

const ohneMarke = (f: Fall): Fall => {
  const { [MARKE_VERWAIST]: _w, ...rest } = f.marken;
  return { ...f, marken: rest };
};

export function verwaisteFaelleOrdnen(faelle: Readonly<Record<string, Fall>>, mandatIds: ReadonlySet<string>, heute: string): VerwaistErgebnis {
  const ids = Object.keys(faelle);
  if (ids.length && !mandatIds.size) return { faelle: { ...faelle }, markiert: 0, zurueck: 0, weg: 0, gebremst: 'keine-mandate' };
  const neu: Record<string, Fall> = {};
  const faellig: string[] = [];
  let markiert = 0, zurueck = 0;
  for (const id of ids) {
    const f = faelle[id];
    const seit = f.marken[MARKE_VERWAIST];
    if (mandatIds.has(id)) {
      if (seit) { neu[id] = ohneMarke(f); zurueck++; } else neu[id] = f;
      continue;
    }
    if (!seit) { neu[id] = { ...f, marken: { ...f.marken, [MARKE_VERWAIST]: heute } }; markiert++; continue; }
    neu[id] = f;
    if (tagPlus(seit.slice(0, 10), VERWAIST_TAGE) <= heute) faellig.push(id);
  }
  if (faellig.length > MASSEN_AB && faellig.length * 2 > ids.length) return { faelle: neu, markiert, zurueck, weg: 0, gebremst: 'zu-viele' };
  for (const id of faellig) delete neu[id];
  return { faelle: neu, markiert, zurueck, weg: faellig.length, gebremst: null };
}
