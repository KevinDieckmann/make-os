// ─── Markttraktion — Adressen (rein, getestet) ──────────────────────────────
// /os/markttraktion?s=<Bereich>&a=<Ansicht>&k=<Person oder Firma>
//   s: ueberblick (Start) · sales · marketing · event · kontakte · firmen · stammdaten
//   a: sales     → heute (Start) · leads (Ebene 1) · pipeline (Deals, Ebene 2) · kunden (Ebene 3) · kampagnen
//      marketing → uebersicht (Start) · segmente · kampagnen · redaktion · newsletter · positionierung
//      kontakte/stammdaten → die gespeicherte Ansicht bzw. der Reiter
// Alte CRM-Adressen (/os/crm?s=heute|pipeline|kunden|events|kartei …) bleiben
// gültig: /os/crm leitet um, und `aufloesen` übersetzt die alten Bereiche.

export type Bereich = 'ueberblick' | 'sales' | 'marketing' | 'event' | 'kontakte' | 'firmen' | 'stammdaten';
export type SalesAnsicht = 'heute' | 'leads' | 'pipeline' | 'kunden' | 'kampagnen';
export const BEREICHE: Bereich[] = ['ueberblick', 'sales', 'marketing', 'event', 'kontakte', 'firmen', 'stammdaten'];
export const SALES_ANSICHTEN: SalesAnsicht[] = ['heute', 'leads', 'pipeline', 'kunden', 'kampagnen'];
export const PFAD = '/os/markttraktion';

/** Bereich + Ansicht aus der Adresse — alte CRM-Bereiche eingeschlossen. */
export function aufloesen(s?: string | null, a?: string | null): { s: Bereich; a?: string } {
  const ansicht = a || undefined;
  if (s === 'heute' || s === 'pipeline' || s === 'kunden') return { s: 'sales', a: s };
  if (s === 'events') return { s: 'event' };
  if (s === 'kartei') return { s: 'kontakte', a: ansicht };
  if (s && (BEREICHE as string[]).includes(s)) {
    if (s === 'sales') return { s, a: ansicht && (SALES_ANSICHTEN as string[]).includes(ansicht) ? ansicht : 'heute' };
    return { s: s as Bereich, a: ansicht };
  }
  return { s: 'ueberblick' };
}

/** Link in die Markttraktion — für Suche, Startseite, Befunde, Jarvis. */
export function markttraktion(s?: string, a?: string, k?: string): string {
  const z = aufloesen(s, a);
  const q = new URLSearchParams();
  if (z.s !== 'ueberblick') q.set('s', z.s);
  if (z.a && !(z.s === 'sales' && z.a === 'heute')) q.set('a', z.a);
  if (k) q.set('k', k);
  const t = q.toString();
  return t ? `${PFAD}?${t}` : PFAD;
}
