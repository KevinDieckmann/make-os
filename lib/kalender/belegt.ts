// ─── Kalender — wem gehört ein Kalender, zählt er als belegt? (rein, client-sicher, R-K2 #69, 29.09.) ─
// Vorher galt jeder nicht zugeordnete Kalender (Apples Standard „Kalender“, ein Abo, ein geteilter) als „beide“ — ein
// Termin darin blockierte Kevins UND Malins Buchungsseite. Jetzt: Schalter „zählt als belegt“ je Kalender in den
// Kalender-Einstellungen (`belegt`). Ohne Schalter zählen die zugeordneten Kalender, nicht zugeordnete niemanden.
// Server (lib/kalender/einstellungen.ts re-exportiert) und Oberfläche (Einstellungen im Kalender) rechnen hiermit.

export type KalenderWer = 'kevin' | 'malin' | 'beide';
export interface BelegtEinstellungen { kalender: Record<KalenderWer, string>; belegt?: Record<string, boolean>; /** Google (03.10.): Kalendername → Person — gehört dem Kalender der Person, nie „beide“. */ google?: Record<string, string> }

/** Zugeordnet (Einstellungen oder eindeutiger Name wie „Kevin Dieckmann“) — sonst null („nicht zugeordnet“). */
export function zuordnung(e: Pick<BelegtEinstellungen, 'kalender' | 'google'>, kalenderName: string): KalenderWer | null {
  const g = e.google?.[kalenderName.trim()];
  if (g === 'kevin' || g === 'malin') return g;
  const n = kalenderName.trim().toLowerCase();
  if (n === e.kalender.kevin.trim().toLowerCase()) return 'kevin';
  if (n === e.kalender.malin.trim().toLowerCase()) return 'malin';
  if (n === e.kalender.beide.trim().toLowerCase()) return 'beide';
  const kevin = /\bkevin\b/.test(n), malin = /\bmalin\b/.test(n);
  return kevin && !malin ? 'kevin' : malin && !kevin ? 'malin' : null;
}

/** Zählt der Kalender als belegt? Schalter aus den Einstellungen, sonst: zugeordnet ja, nicht zugeordnet nein. */
export function zaehltAlsBelegt(e: BelegtEinstellungen, kalenderName: string): boolean {
  const s = e.belegt?.[kalenderName.trim()];
  return typeof s === 'boolean' ? s : zuordnung(e, kalenderName) !== null;
}

/**
 * Wessen Verfügbarkeit ein Termin dieses Kalenders betrifft (lib/kalender/verfuegbarkeit.ts): der Besitzer — oder
 * „niemand“, wenn der Kalender nicht als belegt zählt. Ein nicht zugeordneter Kalender mit Schalter „an“ gilt für beide.
 */
export function werFuerBelegung(e: BelegtEinstellungen, kalenderName: string): KalenderWer | 'niemand' {
  if (!zaehltAlsBelegt(e, kalenderName)) return 'niemand';
  return zuordnung(e, kalenderName) ?? 'beide';
}
