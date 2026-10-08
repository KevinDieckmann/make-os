// ─── Mac-Zulieferer: an oder aus? (08.10., Lücke 10 der Roadmap, Kevin R6) ──────────────────────────────────────────────
// Kevin 08.10.: „alles nur auf dem Server führen; wir brauchen nachher im Mac nur noch die API zur Mail, den Rest haben wir ja in
// MAKE OS.“ Der Zulieferer (zulieferer.mjs am Mac → POST /api/zulieferung) lieferte Kalender, Apple-Erinnerungen und das Adressbuch.
// Kalender und Mail holt der Server längst selbst (iCloud/Google, IMAP/Gmail); die Erinnerungen werden EINMAL als Aufgaben übernommen
// (lib/zulieferer/erinnerungen.ts), danach geht der Zulieferer aus.
//
// EINE Regel, wer gilt (rein, getestet — tests/zulieferer-aus.test.ts):
//   1. Umgebung `MAKE_OS_ZULIEFERER=aus|an` (lib/zugang/intern.ts) — gewinnt immer (auch die Middleware liest sie).
//   2. Instanz-Einstellung des Inhabers (`konten.json › einstellungen.zulieferer`, gesetzt über /api/zulieferer).
//   3. Vorgabe: Übernahme der Erinnerungen bestätigt → aus · es gibt Altbestand (Spiegel vom Mac) → an (unsere Instanz bis zur
//      Übernahme) · sonst (neue Instanz) → aus.

export type ZuliefererSchalter = 'an' | 'aus';
export type ZuliefererQuelle = 'umgebung' | 'einstellung' | 'uebernommen' | 'altbestand' | 'neu';

export interface ZuliefererEingang {
  umgebung: ZuliefererSchalter | null;
  einstellung: ZuliefererSchalter | null;
  /** Wann die Übernahme der Apple-Erinnerungen bestätigt wurde (ISO) — null = nie. */
  uebernahmeAm: string | null;
  /** Liegt ein Spiegel vom Mac (Erinnerungen oder Adressbuch) bzw. kam je ein Übergangs-Aufruf? */
  altbestand: boolean;
}

export interface ZuliefererWirkung { aktiv: boolean; quelle: ZuliefererQuelle }

export function zuliefererWirksam(e: ZuliefererEingang): ZuliefererWirkung {
  if (e.umgebung) return { aktiv: e.umgebung === 'an', quelle: 'umgebung' };
  if (e.einstellung) return { aktiv: e.einstellung === 'an', quelle: 'einstellung' };
  if (e.uebernahmeAm) return { aktiv: false, quelle: 'uebernommen' };
  if (e.altbestand) return { aktiv: true, quelle: 'altbestand' };
  return { aktiv: false, quelle: 'neu' };
}

/** Ein Satz je Quelle — für die Karte unter Einstellungen › Verbindungen (keine Werte, keine Namen). */
export const QUELLE_TEXT: Record<ZuliefererQuelle, string> = {
  umgebung: 'festgelegt auf dem Server (MAKE_OS_ZULIEFERER)',
  einstellung: 'von Hand eingestellt',
  uebernommen: 'aus, seit die Erinnerungen als Aufgaben übernommen sind',
  altbestand: 'läuft noch, bis die Erinnerungen übernommen sind',
  neu: 'auf dieser Instanz nie benutzt',
};

/** Aus einem gespeicherten Wert (konten.json) einen Schalter machen — alles andere gilt als „nicht gesetzt“. */
export const schalterAus = (v: unknown): ZuliefererSchalter | null => (v === 'an' || v === 'aus' ? v : null);
