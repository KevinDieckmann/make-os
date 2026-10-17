// ─── Flächen: welches Widget gehört in welche Sicht (rein, 10.10., Branch `sweep-bereiche`) ────────────────────────────────────────────
// Entscheidung 10.10.: „Business-Themen sind Business-Themen und Privat Privat — wir haben im Business-Bereich keinen Bereich, der Familie und
// Partnerschaft heißt. Guck, dass das nicht mehr passiert.“ Bis dahin bot „+ Widget“ auf Heute › Business den ganzen Katalog an (Familie &
// Partnerschaft, Körper, Erholung, Essen, Privat-Index …), und ein gespeichertes Layout zeigte, was immer darin stand.
//
// EINE Regel für Katalog (Browser), Standard (Wächter) und gespeicherte Layouts (Server, app/api/state/flaeche):
//   · `privat`   — Inhalte nur des Privat-Bereichs (Gesundheit, Familie, Essen, Privat-Finanzen, Wachstums-Score mit den Säulen Gesundheit/Familie).
//   · `business` — Inhalte nur des Business-Bereichs (Markttraktion, Business-Index, Traktion, Zeit je Einheit).
//   · `neutral`  — das Widget folgt dem Bereich seiner Fläche (Aufgaben, Termine, Fokus, Ziele, Steht an, Top 3, Tages-Briefing, Freigaben von ZOE & Inbox, Zeit „Privat gegen
//                  Business“ = nur Summen, Entscheidung 09.10.). Auf einer Fläche mit Bereich nimmt es IMMER deren Bereich (`widgetSpace`).
// Eine Fläche mit Bereich (`spaceAusFlaeche`: Heute › Privat/Business, Gesundheit, Familie, Markttraktion …) zeigt nur `neutral` und ihren
// eigenen Bereich. Flächen ohne Bereich (System, Konto …) zeigen alles.

import { spaceAusFlaeche } from './space';
import type { Einstellungen, Layout, Platz } from './modell';

export type WidgetSicht = 'privat' | 'business' | 'neutral';

const NUR_PRIVAT: ReadonlySet<string> = new Set(['koerper', 'erholung', 'routinen', 'essen', 'finanzen-privat', 'familie', 'score']);
const NUR_BUSINESS: ReadonlySet<string> = new Set(['dran', 'kanal', 'event', 'fulfillment']);
const INDEX_BEREICH: Readonly<Record<string, Exclude<WidgetSicht, 'neutral'>>> = { privat: 'privat', gesundheit: 'privat', business: 'business', traktion: 'business' };

const bereichAus = (v: unknown): Exclude<WidgetSicht, 'neutral'> | null => (v === 'privat' || v === 'business' ? v : null);

/** Der Bereich eines Widgets aus Art und Einstellungen. */
export function widgetSicht(art: string, e: Einstellungen = {}): WidgetSicht {
  if (NUR_PRIVAT.has(art)) return 'privat';
  if (NUR_BUSINESS.has(art)) return 'business';
  if (art === 'index') return INDEX_BEREICH[String(e.saeule ?? 'business')] ?? 'business';
  // Zeit je Einheit (Business-Gesellschaften) ist Business; „Privat gegen Business“ (`beide`) zeigt nur Summen und folgt der Fläche.
  if (art === 'zeit' && e.nach === 'einheit') return 'business';
  // Ein Widget mit festem Bereich in den Einstellungen gehört zu diesem Bereich (Aufgaben, Termine, Fokus, Routinen heute, Zeit …).
  return bereichAus(e.space) ?? 'neutral';
}

/** Passt ein Widget auf eine Fläche? (Fläche ohne Bereich: alles.) */
export function widgetPasst(seite: string | null | undefined, art: string, e: Einstellungen = {}): boolean {
  const s = spaceAusFlaeche(seite);
  if (s === 'alle') return true;
  const w = widgetSicht(art, e);
  return w === 'neutral' || w === s;
}

/** Der Bereich, mit dem ein Widget auf dieser Fläche liest: der Bereich der Fläche gewinnt; sonst die Einstellung; sonst „alle“. */
export function widgetSpace(seite: string | null | undefined, e: Einstellungen = {}): 'privat' | 'business' | 'alle' {
  const s = spaceAusFlaeche(seite);
  if (s !== 'alle') return s;
  return bereichAus(e.space) ?? 'alle';
}

/** Ein gespeichertes Layout nur mit den Plätzen, die auf die Fläche passen (Server: jede Antwort von GET /api/state/flaeche). */
export function layoutFuerSeite(seite: string, layout: Layout): Layout {
  return { ...layout, plaetze: layout.plaetze.filter(p => widgetPasst(seite, p.art, p.einstellungen)) };
}

/** Plätze, die NICHT auf die Fläche passen (PUT → 400, nie still gespeichert). */
export const fremdePlaetze = (seite: string, plaetze: readonly Platz[]): Platz[] => plaetze.filter(p => !widgetPasst(seite, p.art, p.einstellungen));

/**
 * Prüf-Fund 11.10.: GET liefert nur die Plätze, die auf die Fläche passen — schickte der Browser danach sein Layout zurück, waren die anderen
 * (z. B. ein Privat-Widget, das in einem älteren Layout auf Heute › Business stand) dauerhaft weg. Darum legt der Schreibweg die gespeicherten,
 * nicht ausgelieferten Plätze unverändert zurück (hinten an, nur wenn die Kennung nicht schon im neuen Layout steht). `null` = Eintrag löschen.
 */
export function mitVerborgenenPlaetzen(seite: string, neu: Layout | null, alt: Layout | undefined): Layout | null {
  const verborgen = alt ? fremdePlaetze(seite, alt.plaetze) : [];
  const leer = !neu || (!neu.plaetze.length && !neu.versteckt.length);
  if (!verborgen.length) return leer ? null : neu;
  const basis: Layout = neu ?? { plaetze: [], versteckt: [], stand: alt?.stand ?? '' };
  const da = new Set(basis.plaetze.map(p => p.id));
  return { ...basis, plaetze: [...basis.plaetze, ...verborgen.filter(p => !da.has(p.id))] };
}
