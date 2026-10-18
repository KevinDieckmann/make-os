// ─── Kalender — wem gehört ein Kalender, zählt er als belegt? (rein, client-sicher, R-K2 #69, 29.09.) ─
// Vorher galt jeder nicht zugeordnete Kalender (Apples Standard „Kalender“, ein Abo, ein geteilter) als „beide“ — ein
// Termin darin blockierte Kevins UND Malins Buchungsseite. Jetzt: Schalter „zählt als belegt“ je Kalender in den
// Kalender-Einstellungen (`belegt`). Ohne Schalter zählen die zugeordneten Kalender, nicht zugeordnete niemanden.
// Server (lib/kalender/einstellungen.ts re-exportiert) und Oberfläche (Einstellungen im Kalender) rechnen hiermit.

export type KalenderWer = 'kevin' | 'malin' | 'beide';
export interface BelegtEinstellungen {
  kalender: Record<KalenderWer, string>; belegt?: Record<string, boolean>;
  /** Google (03.10.): Kalendername → Person — gehört dem Kalender der Person, nie „beide“. */
  google?: Record<string, string>;
  /** iCloud je Person (06.10.): Kalendername (auch der neutrale „iCloud · <Vorname>“) → Person — gehört ihr, nie „beide“. */
  persoenlich?: Record<string, string>;
  /**
   * Vornamen hinter den Fächern (14.10., Abnahme-Reste 2): aus den Konten, zur Laufzeit dazugelegt (`mitGoogleNamen`), NIE gespeichert. Erkennt
   * einen Kalender am Vornamen im Namen (Apples Vorgabe-Kalender trägt den vollen Namen der Person) — vorher stand der Vorname fest im Code.
   */
  vornamen?: Partial<Record<Exclude<KalenderWer, 'beide'>, string>>;
}

/** Steht der Vorname als eigenes Wort im (kleingeschriebenen) Kalendernamen? Ohne Vornamen: nein. Rein. */
export function vornameImNamen(nameKlein: string, vorname: string | null | undefined): boolean {
  const v = String(vorname ?? '').trim().toLowerCase();
  if (!v) return false;
  const esc = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Wortgrenze für jeden Buchstaben (auch Umlaute) — ohne Lookbehind (ältere Browser).
  return new RegExp(`(?:^|[^\\p{L}\\p{N}_])${esc}(?![\\p{L}\\p{N}_])`, 'u').test(nameKlein);
}

/** Zugeordnet (Einstellungen oder eindeutiger Vorname im Namen, z. B. Apples Kalender mit dem vollen Namen) — sonst null („nicht zugeordnet“). */
export function zuordnung(e: Pick<BelegtEinstellungen, 'kalender' | 'google' | 'persoenlich' | 'vornamen'>, kalenderName: string): KalenderWer | null {
  const g = e.google?.[kalenderName.trim()] ?? e.persoenlich?.[kalenderName.trim()];
  if (g === 'kevin' || g === 'malin') return g;
  const n = kalenderName.trim().toLowerCase();
  if (n === e.kalender.kevin.trim().toLowerCase()) return 'kevin';
  if (n === e.kalender.malin.trim().toLowerCase()) return 'malin';
  if (n === e.kalender.beide.trim().toLowerCase()) return 'beide';
  // Vorname als eigenes Wort (14.10.: aus den Konten statt fest im Code) — nur eindeutig (beide Vornamen im Namen → nicht zugeordnet).
  const eins = vornameImNamen(n, e.vornamen?.kevin), zwei = vornameImNamen(n, e.vornamen?.malin);
  return eins && !zwei ? 'kevin' : zwei && !eins ? 'malin' : null;
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

/**
 * Wessen Verfügbarkeit ein TERMIN betrifft (18.10.): ein Termin aus der EIGENEN iCloud-Verbindung einer Person (`persoenlich`, gesetzt nur in
 * lib/kalender/icloud.ts `persoenlichMarkieren`) gehört genau ihr (Speichername) — auch, wenn ihr Name zu keinem Fach der Einstellungen passt —,
 * außer sie hat den Kalender ausdrücklich auf „zählt nicht als belegt“ gestellt. Alle anderen Termine wie `werFuerBelegung`. Rein.
 */
export function werFuerTermin(e: BelegtEinstellungen, t: { kalender: string; persoenlich?: string }): string {
  if (t.persoenlich) return e.belegt?.[t.kalender.trim()] === false ? 'niemand' : t.persoenlich;
  return werFuerBelegung(e, t.kalender);
}
