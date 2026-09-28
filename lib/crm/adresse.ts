// ─── Markttraktion — Adressen (rein, getestet) ──────────────────────────────
// /os/markttraktion?s=<Bereich>&a=<Ansicht>&k=<Person, Firma, Deal, Event>
//   s (Reiter, Kevins Reihenfolge 27.09.): ueberblick (Start) · kontakte · firmen ·
//      deals · followup · qualifizierung (Runde, 27.09.) · sales · marketing · event · stammdaten
//   a: kontakte   → die gespeicherte Ansicht, eine Runde (runde-…) oder akte („Kontakt öffnen“ zu k)
//      t (nur bei „Kontakt öffnen“, 28.09.): Reiter ueber (Start, ohne t) · aktivitaeten · umsatz · daten —
//      alte Links ohne t bleiben gültig und öffnen „Über“; die Reiter vom 27.09. werden übersetzt
//      (ueberblick → ueber, verlauf → aktivitaeten, stammdaten | beziehung | datenschutz → daten)
//      u (nur im Reiter Aktivitäten): der Unter-Reiter (z. B. alle, notizen) — ein Anker (#…) springt zur Quelle
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

/** Die Reiter von „Kontakt öffnen“ (Kevin 28.09., HubSpot-Vorbild): „Über“ ist der Start und steht nicht in der Adresse. Der Reiter `daten` heißt sichtbar „Stammdaten“ (28.09.) — die Kennung/Adresse `t=daten` bleibt. */
export type AkteReiter = 'ueber' | 'aktivitaeten' | 'umsatz' | 'daten';
export const AKTE_REITER: { id: AkteReiter; label: string }[] = [
  { id: 'ueber', label: 'Über' }, { id: 'aktivitaeten', label: 'Aktivitäten' }, { id: 'umsatz', label: 'Umsatz' }, { id: 'daten', label: 'Stammdaten' },
];
/** Die Reiter vom 27.09. — alte Links, Lesezeichen und gemerkte Reiter landen am neuen Ort. */
const ALTE_REITER: Record<string, AkteReiter> = { ueberblick: 'ueber', verlauf: 'aktivitaeten', stammdaten: 'daten', beziehung: 'daten', datenschutz: 'daten' };
/** Reiter aus `t` — leer oder unbekannt heißt „Über“, alte Werte werden übersetzt (rückwärtskompatibel für Suche, Befunde, ZOE). */
export function akteReiter(t?: string | null): AkteReiter {
  if (!t) return 'ueber';
  if (AKTE_REITER.some(r => r.id === t)) return t as AkteReiter;
  return ALTE_REITER[t] ?? 'ueber';
}
/** Unter-Reiter der Aktivitäten (`u`) — nur ein kurzes Kennwort; welche es gibt, bestimmt der Reiter selbst. */
export function akteUnter(u?: string | null): string | null {
  return u && /^[a-z][a-z_-]{0,23}$/.test(u) ? u : null;
}

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

/** Link in die Markttraktion — für Suche, Startseite, Befunde, ZOE. `t` zählt nur bei „Kontakt öffnen“ (Reiter außer „Über“), `u` nur im Reiter Aktivitäten. */
export function markttraktion(s?: string, a?: string, k?: string, t?: string | null, u?: string | null): string {
  const z = aufloesen(s, a);
  const q = new URLSearchParams();
  if (z.s !== 'ueberblick') q.set('s', z.s);
  if (z.a) q.set('a', z.a);
  if (k) q.set('k', k);
  const reiter = akteReiter(t);
  if (z.s === 'kontakte' && z.a === 'akte' && k && reiter !== 'ueber') {
    q.set('t', reiter);
    const unter = akteUnter(u);
    if (reiter === 'aktivitaeten' && unter) q.set('u', unter);
  }
  const text = q.toString();
  return text ? `${PFAD}?${text}` : PFAD;
}

/** „Kontakt öffnen“ (25.09., Reiter 28.09.): eine ganze Seite je Person, optional direkt auf einem Reiter (und Unter-Reiter der Aktivitäten). */
export const kontaktAkte = (id: string, t?: AkteReiter | string | null, u?: string | null): string => markttraktion('kontakte', 'akte', id, t, u);

/** Kartei gefiltert auf eine BEAN-Gruppe (28.09., H4) — aus der Verteilungskarte im Überblick. Unbekanntes → ungefiltert. */
export const karteiBean = (b: string): string => (/^[BEAN]$/.test(b) ? `${PFAD}?s=kontakte&bean=${b}` : markttraktion('kontakte'));

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
