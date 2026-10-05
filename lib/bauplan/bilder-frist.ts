// ─── Bauplan — Löschfrist der Bildschirmfotos (05.10., rein, getestet) ──────
// Bildschirmfotos können Personendaten zeigen (eine Kontaktliste, eine Mail). Deshalb (Art. 5 Abs. 1 lit. e):
//   · an einer Karte, die abgeschlossen ist (Spalte „Fertig“ oder verworfen): weg, wenn Abschluss UND Ablage älter als die Frist
//     sind (Standard 90 Tage, Frist „bauplan-bilder“) — der Abschluss = Abnahme, sonst letzter Kommentar, sonst Anlage;
//   · an keiner Karte (verwaist, z. B. hochgeladen und Karte nie angelegt): weg nach `VERWAIST_TAGE` ab Ablage;
//   · an einer offenen Karte: bleibt, solange die Karte offen ist.
import type { BacklogItem } from '@/lib/make-one/backlog-data';
import { spalteVon } from './board';

export const VERWAIST_TAGE = 7;
export interface BildDatei { name: string; /** Tag der Ablage (JJJJ-MM-TT, aus der Datei-Zeit). */ tag: string }

const abschlussTag = (k: BacklogItem): string => (k.abgenommen?.am ?? (k.kommentare ?? []).map(c => c.am).sort().pop() ?? k.angelegt).slice(0, 10);
const abgeschlossen = (k: BacklogItem): boolean => !!k.verworfen || spalteVon(k) === 'fertig';

/** Welche Bilddateien sind fällig? `grenze` = Stichtag der Frist (älter als dieser Tag), `grenzeVerwaist` ebenso. */
export function bilderFaellig(items: readonly BacklogItem[], dateien: readonly BildDatei[], grenze: string, grenzeVerwaist: string): string[] {
  const karteVon = new Map<string, BacklogItem>();
  for (const k of items) for (const b of k.bilder ?? []) karteVon.set(b, k);
  return dateien.filter(d => {
    const k = karteVon.get(d.name);
    if (!k) return d.tag < grenzeVerwaist;
    return abgeschlossen(k) && abschlussTag(k) < grenze && d.tag < grenze;
  }).map(d => d.name);
}
