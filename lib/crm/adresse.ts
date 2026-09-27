// ─── Markttraktion — Adressen (rein, getestet) ──────────────────────────────
// /os/markttraktion?s=<Bereich>&a=<Ansicht>&k=<Person, Firma, Deal, Event>
//   s (Reiter, Kevins Reihenfolge 27.09.): ueberblick (Start) · kontakte · firmen ·
//      deals · followup · qualifizierung (Runde, 27.09.) · sales · marketing · event · stammdaten
//   a: kontakte   → die gespeicherte Ansicht, eine Runde (runde-…) oder akte (Kontaktakte zu k)
//      firmen     → (leer) Kartei · leads (Ebene 1: qualifizieren → SQL)
//      deals      → board (Start) · liste · akte (Deal-Akte zu k) · kunden · auswertung
//      followup   → faellig (Start) · woche · powerhour · kadenz
//      marketing  → uebersicht (Start) · anfragen · segmente · kampagnen · redaktion · newsletter · positionierung
//      stammdaten → der Reiter
// Alte Adressen bleiben gültig: /os/crm leitet um; `aufloesen` übersetzt die alten
// Bereiche (heute/pipeline/kunden/events/kartei) UND den Reiter „Sales“ vom 25./26.09.
// (s=sales&a=heute|leads|pipeline|kunden|kampagnen) auf die neuen Reiter — so
// funktionieren alle Links aus Suche, Befunden, ZOE und Telegram weiter.

export type Bereich = 'ueberblick' | 'kontakte' | 'firmen' | 'deals' | 'followup' | 'qualifizierung' | 'sales' | 'marketing' | 'event' | 'stammdaten';
/** Der Reiter „Sales“ rechts (Kevin 27.09.): Head of Sales · Power Hour · Kampagnen · Auswertung. */
export type SalesReiterAnsicht = 'head' | 'powerhour' | 'kampagnen' | 'auswertung';
export const SALES_REITER_ANSICHTEN: SalesReiterAnsicht[] = ['head', 'powerhour', 'kampagnen', 'auswertung'];
export type DealsAnsicht = 'board' | 'liste' | 'akte' | 'kunden' | 'auswertung';
export type FollowupAnsicht = 'faellig' | 'woche' | 'powerhour' | 'kadenz';
/** Der alte Sales-Reiter (bis 26.09.) — nur noch zum Übersetzen alter Adressen. */
export type SalesAnsicht = 'heute' | 'leads' | 'pipeline' | 'kunden' | 'kampagnen';
export const BEREICHE: Bereich[] = ['ueberblick', 'kontakte', 'firmen', 'deals', 'followup', 'qualifizierung', 'sales', 'marketing', 'event', 'stammdaten'];
export const DEALS_ANSICHTEN: DealsAnsicht[] = ['board', 'liste', 'akte', 'kunden', 'auswertung'];
export const FOLLOWUP_ANSICHTEN: FollowupAnsicht[] = ['faellig', 'woche', 'powerhour', 'kadenz'];
export const SALES_ANSICHTEN: SalesAnsicht[] = ['heute', 'leads', 'pipeline', 'kunden', 'kampagnen'];
export const PFAD = '/os/markttraktion';

/** Wohin der alte Sales-Reiter zeigt. */
const SALES_NEU: Record<SalesAnsicht, { s: Bereich; a?: string }> = {
  heute: { s: 'sales', a: 'powerhour' },
  leads: { s: 'firmen', a: 'leads' },
  pipeline: { s: 'deals' },
  kunden: { s: 'deals', a: 'kunden' },
  kampagnen: { s: 'sales', a: 'kampagnen' },
};

/** Bereich + Ansicht aus der Adresse — alte CRM-Bereiche und der alte Sales-Reiter eingeschlossen. */
export function aufloesen(s?: string | null, a?: string | null): { s: Bereich; a?: string } {
  const ansicht = a || undefined;
  if (s === 'heute' || s === 'pipeline' || s === 'kunden') return SALES_NEU[s];
  if (s === 'events') return { s: 'event', ...(ansicht ? { a: ansicht } : {}) };
  if (s === 'kartei') return { s: 'kontakte', ...(ansicht ? { a: ansicht } : {}) };
  // „Sales“ ist seit 27.09. wieder ein eigener Reiter (rechts); alte Sales-Ansichten (heute, leads, pipeline, kunden) werden übersetzt.
  if (s === 'sales' && ansicht && (SALES_ANSICHTEN as string[]).includes(ansicht) && !(SALES_REITER_ANSICHTEN as string[]).includes(ansicht)) return SALES_NEU[ansicht as SalesAnsicht];
  if (s === 'sales') return { s: 'sales', ...(ansicht && ansicht !== 'head' && (SALES_REITER_ANSICHTEN as string[]).includes(ansicht) ? { a: ansicht } : {}) };
  if (s && (BEREICHE as string[]).includes(s)) {
    const b = s as Bereich;
    if (b === 'deals') return { s: b, ...(ansicht && ansicht !== 'board' && (DEALS_ANSICHTEN as string[]).includes(ansicht) ? { a: ansicht } : {}) };
    if (b === 'followup') return { s: b, ...(ansicht && ansicht !== 'faellig' && (FOLLOWUP_ANSICHTEN as string[]).includes(ansicht) ? { a: ansicht } : {}) };
    return { s: b, ...(ansicht ? { a: ansicht } : {}) };
  }
  return { s: 'ueberblick' };
}

/** Link in die Markttraktion — für Suche, Startseite, Befunde, ZOE. */
export function markttraktion(s?: string, a?: string, k?: string): string {
  const z = aufloesen(s, a);
  const q = new URLSearchParams();
  if (z.s !== 'ueberblick') q.set('s', z.s);
  if (z.a) q.set('a', z.a);
  if (k) q.set('k', k);
  const t = q.toString();
  return t ? `${PFAD}?${t}` : PFAD;
}

/** Die Deal-Akte (27.09.): eine ganze Seite je Deal. */
export const dealAkte = (id: string): string => markttraktion('deals', 'akte', id);

/** Produkte & Mandate (25.09.): eigener Bereich links unter Aufgaben — s: mandate (Start) · produkte, k: Mandat bzw. Produkt. */
export const MANDATE_PFAD = '/os/mandate';
export function mandateLink(s?: 'mandate' | 'produkte', k?: string): string {
  const q = new URLSearchParams();
  if (s === 'produkte') q.set('s', 'produkte');
  if (k) q.set('k', k);
  const t = q.toString();
  return t ? `${MANDATE_PFAD}?${t}` : MANDATE_PFAD;
}
