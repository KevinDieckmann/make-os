// ─── Standard · Reise + Fluss — Farben der Formen, „Hier“, die Raute (17.10.; DESIGN_STANDARD.md › Prozess-Visualisierung) ────────────────────
// Die kleinsten gemeinsamen Zeichen der Reise und des Flusses — EIN Ort für alle Bereiche (Fulfillment, Kreislauf, Einrichtung, Planung). Farben nur aus den
// Token; die Bedeutung trägt die Form (Kasten, Brief, Raute, Glocke, Kalender), die Farbe kommt dazu. Keine Daten-Importe (die öffentliche Kunden-Seite
// bündelt diese Datei mit).

import { FARBE as C, LEUCHT } from '@/lib/make-one/design';
import type { FlussForm } from '@/lib/reise/bild';

/**
 * „Hier stehen wir“ bzw. „als Nächstes“ — der Akzent der Instanz (Petrol), derselbe wie auf der Kunden-Seite. Orange ist frei für die Erinnerung im Fluss
 * (Miro-Standard: Grün = Schritt, Gelb = Nachricht, Orange = Erinnerung).
 */
export const JETZT = C.aktiv;
/** Die Farben der festen Formen im Fluss — ruhig (getönte Fläche, halbtransparente Kontur), die Bedeutung trägt die Form. */
export const FORM_FARBE: Record<FlussForm, string> = { schritt: LEUCHT.gut, nachricht: LEUCHT.achtung, entscheidung: C.inkDim, erinnerung: LEUCHT.business, termin: C.ink };

/** Die Raute (Abstimmungspunkt, Abhängigkeit): gefüllt grün = gegeben, Umriss = noch offen, `aktiv` = gerade dran (gelb). */
export function FreigabeRaute({ gegeben, groesse = 12, aktiv }: { gegeben: boolean; groesse?: number; aktiv?: boolean }) {
  const f = gegeben ? LEUCHT.gut : aktiv ? LEUCHT.achtung : C.inkLeise;
  return <span aria-hidden style={{ display: 'inline-block', width: groesse, height: groesse, transform: 'rotate(45deg)', flex: '0 0 auto', borderRadius: 2, border: `2px solid ${f}`, background: gegeben ? f : 'transparent' }} />;
}
