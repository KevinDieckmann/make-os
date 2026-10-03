// ─── Lichtfäden-Quelle: Gesundheit & Routinen (terminiert) — rein ───────────
// Nur was einen Tag hat: Routinen ab wöchentlich mit `naechstesMal` (Arzt, Vorsorge, Steuererklärung …) und Sport-Ziele
// mit Wettkampf-/Stichtag. Tägliche Routinen zählen nicht — sie wären ein gleichmäßiges Rauschen über jede Woche.
// Gesundheit ist persönlich: Stränge einer Person sind `privat` (die andere sieht ein anonymes „belegt“ — dieselbe
// Regel wie Gesundheits-Termine im Kalender). Gemeinsame Routinen (Besitz „beide“) sind nicht privat.
// Routine-Kategorie: gesundheit → Privat › Gesundheit, leben → Privat › Ziele & Planung, business → Business › Ziele & Planung.

import { BEIDE, gewichtVon, statusVon, tagAus, themaPfad, type Strang } from '../modell';

export interface GsRoutine { id: string; label: string; kategorie: string; aktiv: boolean; owner?: string; rhythmus?: string; naechstesMal?: string; space?: string }
export interface GsSportZiel { id: string; titel: string; datum?: string; erledigt?: boolean }
export interface GesundheitDaten {
  routinen: GsRoutine[];
  /** Sport-Ziele je Person (Speichername → Ziele). */
  sport: { person: string; ziele: GsSportZiel[] }[];
  heute: string;
  links: { routinen: string; sport: string };
}

const TAEGLICH = new Set(['taeglich', '3x-woche']);

export function gesundheitStraenge(d: GesundheitDaten): Strang[] {
  const aus: Strang[] = [];
  for (const r of d.routinen) {
    const tag = tagAus(r.naechstesMal);
    if (!tag || !r.aktiv || TAEGLICH.has(r.rhythmus ?? 'taeglich')) continue;
    const person = !r.owner || r.owner === BEIDE ? BEIDE : r.owner;
    const gesundheit = r.kategorie === 'gesundheit';
    const pfad = gesundheit ? themaPfad('privat', 'gesundheit') : themaPfad(r.kategorie === 'business' || r.space === 'business' ? 'business' : 'privat', 'planung');
    aus.push({ id: `routine:${r.id}`, quelle: 'training', titel: r.label, pfad, person, zeit: { tag }, gewicht: gewichtVon('training'), status: statusVon(false, tag, d.heute), link: d.links.routinen, ...(gesundheit && person !== BEIDE ? { privat: true } : {}) });
  }
  for (const s of d.sport) {
    for (const z of s.ziele) {
      const tag = tagAus(z.datum);
      if (!tag) continue;
      aus.push({ id: `sport:${s.person}:${z.id}`, quelle: 'wettkampf', titel: z.titel, pfad: themaPfad('privat', 'gesundheit'), person: s.person, zeit: { tag }, gewicht: gewichtVon('wettkampf', { erledigt: !!z.erledigt }), status: statusVon(!!z.erledigt, tag, d.heute), link: d.links.sport, privat: true });
    }
  }
  return aus;
}
