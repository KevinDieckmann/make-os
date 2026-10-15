// ─── Seiten des Privat-Bereichs — für ein Konto „nur Business“ eine Umleitung (15.10., Abnahme 2 B8) ───────────────────────────────────────
// Ein Konto „nur Business“ (`finanzRecht: 'business'`) öffnete per Adresse (`/os?space=privat`, `/os/gesundheit`, `/os/familie` …) den Bereich
// PRIVAT mit eigener Leiste — leere Karten, 403 in der Konsole. Die Daten trennt der Server schon (jede Route filtert bzw. 403); diese Seiten
// führen jetzt nach Business-Heute: die Middleware leitet um (serverseitig, auch bei Navigation im Browser), der Kopf ebenso (`useSpace`).
// Rein und ohne Abhängigkeiten (läuft in der Middleware am Rand). Welche Seiten: alles, was die Leiste dem Privat-Bereich zuordnet
// (lib/make-one/spaces.ts — der Wächter tests/nur-business-sicht.test.ts prüft, dass jede dort genannte Privat-Seite hier steht) und jede
// Seite mit `?space=privat` bzw. `?bereich=privat` (ältere Aufgaben-Links).

/** Wohin ein Konto „nur Business“ statt einer Privat-Seite kommt. */
export const NUR_BUSINESS_START = '/os?space=business';

/** Seiten (Pfad, auch Unterseiten), die nur dem Privat-Bereich dienen. */
export const PRIVAT_SEITEN: readonly string[] = [
  '/os/gesundheit', '/os/sport', '/os/journal', '/os/ernaehrung', '/os/energie', '/os/familie', '/os/menschen',
];

/**
 * Seiten, die die Leiste unter Privat hervorhebt, die aber auch ein Konto „nur Business“ braucht (mit SEINEM Business-Inhalt): Tagesstart/
 * Tagesende (`/os/ritual`, verlinkt aus Heute — der Fokus folgt dort der Konto-Sicht) und der Tageslauf (je Person). Keine Umleitung.
 */
export const AUCH_NUR_BUSINESS: readonly string[] = ['/os/ritual', '/os/tageslauf'];

/** Finanzen › Privat bzw. Gesamt (Privat-Bereich der Finanzen). */
const PRIVAT_FINANZEN = new Set(['privat', 'gesamt']);

const parameter = (suche: string) => new URLSearchParams(suche.startsWith('?') ? suche.slice(1) : suche);

/** Ist das eine Seite des Privat-Bereichs (Pfad + `?…`)? Nur Seiten unter `/os` — nie eine Schnittstelle. */
export function privatSeite(pfad: string, suche = ''): boolean {
  if (!(pfad === '/os' || pfad.startsWith('/os/'))) return false;
  const q = parameter(suche);
  if (q.get('space') === 'privat' || q.get('bereich') === 'privat') return true;
  if (PRIVAT_SEITEN.some(p => pfad === p || pfad.startsWith(`${p}/`))) return true;
  return pfad === '/os/finanzen' && PRIVAT_FINANZEN.has(q.get('s') ?? '');
}
