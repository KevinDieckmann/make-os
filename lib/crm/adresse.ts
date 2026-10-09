// ─── Markttraktion — Adressen (rein, getestet) ──────────────────────────────
// /os/markttraktion?s=<Bereich>&a=<Ansicht>&k=<Person, Firma, Deal, Event>
// Aufräumen Etappe 3 (08.10., Kevin: „Die Software wirkt unaufgeräumt und überladen.“): die Reiterzeile hat sechs Reiter und die zwei
// Schnellknöpfe — vorher zwölf. Jede Unteransicht steht genau EINMAL; `REITER_ZEILE` unten ist die eine Stelle für Reihenfolge und
// Zuordnung, `aufloesen` übersetzt jede alte Adresse auf ihren neuen Ort (Wächter: tests/aufraeumen-etappe3.test.ts).
//   Überblick           ueberblick
//   Kontakte & Firmen   kontakte (Personen; a = gespeicherte Ansicht, runde-…, akte) · firmen (Firmen-Kartei)
//   Deals               deals: board (Start) · liste · auswertung (Kanal-Leistung, Kunden kurz, Pipeline-Auswertung) · akte (Deal-Akte zu k)
//   Follow-up           followup: faellig (Start) · woche · powerhour · kadenz
//   Marketing           marketing: uebersicht (Start) · anfragen · segmente · kampagnen · redaktion · newsletter · positionierung
//   Events              besuche (besuchte Veranstaltungen: kalender (Start) · wirkung · kunden; k = Event-Akte) · event (Make.One, k = Abend)
//   Schnellknöpfe       qualifizierung (Runde · leads · scoring · scoring-sales; k = Lead) · angebot (k = Angebot, kontakt/firma/deal)
//   Zahnrad             stammdaten (Qualität, Wertelisten, Gesellschaften, Datenschutz, Import & Export) — nicht in der Reiterzeile
//   „Kontakt öffnen“: t = ueber (Start, ohne t) · aktivitaeten · umsatz · daten; u = Unter-Reiter der Aktivitäten; Anker #akt-… springt.
// Alte Adressen bleiben gültig (nie brechen): /os/crm leitet um (next.config.mjs); `aufloesen` übersetzt die alten Bereiche
// (heute/pipeline/kunden/events/kartei), den früheren Reiter „Sales“ (head/powerhour/kampagnen/auswertung und vom 25./26.09.
// heute/leads/pipeline/kunden), Firmen › Leads und Deals › Kunden — so funktionieren Suche, Befunde, ZOE und Telegram weiter.

export type Bereich = 'ueberblick' | 'kontakte' | 'firmen' | 'deals' | 'followup' | 'qualifizierung' | 'angebot' | 'marketing' | 'besuche' | 'event' | 'stammdaten';
/** Events › Besuchte Events (03.10.): Kalender · Wirkung · Im Kundenauftrag — die Event-Akte steht in `k`. Die Kennung heißt `besuche`, weil `events` als alter Name von Make.One gültig bleibt. */
export type BesucheAnsicht = 'kalender' | 'wirkung' | 'kunden';
export const BESUCHE_ANSICHTEN: BesucheAnsicht[] = ['kalender', 'wirkung', 'kunden'];
export type DealsAnsicht = 'board' | 'liste' | 'akte' | 'auswertung';
export type FollowupAnsicht = 'faellig' | 'woche' | 'powerhour' | 'kadenz';
export type MarketingAnsicht = 'uebersicht' | 'anfragen' | 'segmente' | 'kampagnen' | 'redaktion' | 'newsletter' | 'positionierung';
export const MARKETING_ANSICHTEN: MarketingAnsicht[] = ['uebersicht', 'anfragen', 'segmente', 'kampagnen', 'redaktion', 'newsletter', 'positionierung'];
/** Der frühere Reiter „Sales“ (27.09.–08.10.) und der Sales-Reiter vom 25./26.09. — nur noch zum Übersetzen alter Adressen. */
export const SALES_ALT_ANSICHTEN = ['head', 'powerhour', 'kampagnen', 'auswertung', 'heute', 'leads', 'pipeline', 'kunden'] as const;
export const BEREICHE: Bereich[] = ['ueberblick', 'kontakte', 'firmen', 'deals', 'followup', 'qualifizierung', 'angebot', 'marketing', 'besuche', 'event', 'stammdaten'];
/** Alte Bereiche, die es als Reiter nicht mehr gibt — `aufloesen` übersetzt sie (der Wächter prüft jede Kombination). */
export const BEREICHE_ALT = ['sales', 'heute', 'pipeline', 'kunden', 'events', 'kartei'] as const;

/**
 * Die Reiterzeile (Aufräumen Etappe 3, 08.10.): sechs Reiter, in der Mitte die zwei Schnellknöpfe (Qualifizierung orange, Angebot
 * grün — pulsieren leise). Ein Reiter kann mehrere Bereiche tragen (Kontakte & Firmen, Events); die Stammdaten stehen hinter dem Zahnrad.
 * Jeder Bereich gehört genau einem Reiter, einem Schnellknopf oder dem Zahnrad.
 */
export type ReiterId = 'ueberblick' | 'kontakte' | 'deals' | 'followup' | 'marketing' | 'events';
export interface ReiterDef { id: ReiterId; bereiche: Bereich[] }
export const REITER_ZEILE: { links: ReiterDef[]; mitte: Bereich[]; rechts: ReiterDef[]; zahnrad: Bereich } = {
  links: [
    { id: 'ueberblick', bereiche: ['ueberblick'] },
    { id: 'kontakte', bereiche: ['kontakte', 'firmen'] },
    { id: 'deals', bereiche: ['deals'] },
    { id: 'followup', bereiche: ['followup'] },
  ],
  mitte: ['qualifizierung', 'angebot'],
  rechts: [
    { id: 'marketing', bereiche: ['marketing'] },
    { id: 'events', bereiche: ['besuche', 'event'] },
  ],
  zahnrad: 'stammdaten',
};
const ALLE_REITER: ReiterDef[] = [...REITER_ZEILE.links, ...REITER_ZEILE.rechts];
/** Die Reiter der Zeile (ohne Schnellknöpfe). */
export const REITER_IDS: ReiterId[] = ALLE_REITER.map(r => r.id);
/** Klickziele der Reiterzeile: Reiter + Schnellknöpfe. */
export const KLICKZIELE_ZEILE = REITER_IDS.length + REITER_ZEILE.mitte.length;
/** Welcher Reiter zu einem Bereich leuchtet — null für Schnellknöpfe und das Zahnrad. */
export function reiterVon(b: Bereich): ReiterId | null {
  return ALLE_REITER.find(r => r.bereiche.includes(b))?.id ?? null;
}
/** Der erste Bereich eines Reiters (wohin ein Klick auf den Reiter führt). */
export const reiterStart = (r: ReiterId): Bereich => ALLE_REITER.find(x => x.id === r)?.bereiche[0] ?? 'ueberblick';

/**
 * Der Schnellknopf „Qualifizierung & Scoring“ (03.10.; die Kennung `qualifizierung` und alte Links bleiben):
 * `a` fehlt = die Runde · `leads` = alle Leads (Ebene 1, bis 08.10. Firmen › Leads) · `scoring` = Marketing (bis MQL) · `scoring-sales` = Sales (MQL → SQL).
 * `k` = ein Lead (Firma f-… oder Person c-…): Runde bzw. Liste springen dorthin.
 */
export type QualiAnsicht = 'runde' | 'leads' | 'scoring' | 'scoring-sales';
export const QUALI_ANSICHTEN: QualiAnsicht[] = ['runde', 'leads', 'scoring', 'scoring-sales'];
export const DEALS_ANSICHTEN: DealsAnsicht[] = ['board', 'liste', 'akte', 'auswertung'];
export const FOLLOWUP_ANSICHTEN: FollowupAnsicht[] = ['faellig', 'woche', 'powerhour', 'kadenz'];
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

/** Wohin der frühere Reiter „Sales“ zeigt (alle Ansichten seit 25.09.) — ohne Ansicht: Deals (dort steht der Head of Sales). */
const SALES_NEU: Record<(typeof SALES_ALT_ANSICHTEN)[number], { s: Bereich; a?: string }> = {
  head: { s: 'deals' },
  powerhour: { s: 'followup', a: 'powerhour' },
  heute: { s: 'followup', a: 'powerhour' },
  kampagnen: { s: 'marketing', a: 'kampagnen' },
  auswertung: { s: 'deals', a: 'auswertung' },
  leads: { s: 'qualifizierung', a: 'leads' },
  pipeline: { s: 'deals' },
  kunden: { s: 'deals', a: 'auswertung' },
};
const mit = (s: Bereich, a?: string): { s: Bereich; a?: string } => (a ? { s, a } : { s });
const salesAlt = (a?: string): a is keyof typeof SALES_NEU => !!a && (SALES_ALT_ANSICHTEN as readonly string[]).includes(a);

/** Bereich + Ansicht aus der Adresse — alte CRM-Bereiche, der frühere Reiter „Sales“, Firmen › Leads und Deals › Kunden eingeschlossen. */
export function aufloesen(s?: string | null, a?: string | null): { s: Bereich; a?: string } {
  const ansicht = a || undefined;
  if (s === 'heute') return SALES_NEU.heute;
  if (s === 'pipeline') return SALES_NEU.pipeline;
  if (s === 'kunden') return SALES_NEU.kunden;
  if (s === 'events') return mit('event', ansicht);
  if (s === 'kartei') return aufloesen('kontakte', ansicht);
  if (s === 'sales') return salesAlt(ansicht) ? SALES_NEU[ansicht] : SALES_NEU.head;
  if (s && (BEREICHE as string[]).includes(s)) {
    const b = s as Bereich;
    if (b === 'ueberblick') return { s: b };
    if (b === 'firmen' && ansicht === 'leads') return SALES_NEU.leads;
    // Die alte Qualifizierungs-Runde der Kartei (Chancen-Runde, 25.09.) ist die Runde des Schnellknopfs.
    if (b === 'kontakte' && ansicht === 'runde-chancen') return { s: 'qualifizierung' };
    if (b === 'deals' && ansicht === 'kunden') return SALES_NEU.kunden;
    if (b === 'deals') return mit(b, ansicht && ansicht !== 'board' && (DEALS_ANSICHTEN as string[]).includes(ansicht) ? ansicht : undefined);
    if (b === 'besuche') return mit(b, ansicht && ansicht !== 'kalender' && (BESUCHE_ANSICHTEN as string[]).includes(ansicht) ? ansicht : undefined);
    if (b === 'followup') return mit(b, ansicht && ansicht !== 'faellig' && (FOLLOWUP_ANSICHTEN as string[]).includes(ansicht) ? ansicht : undefined);
    if (b === 'qualifizierung') return mit(b, ansicht && ansicht !== 'runde' && (QUALI_ANSICHTEN as string[]).includes(ansicht) ? ansicht : undefined);
    if (b === 'marketing') return mit(b, ansicht && ansicht !== 'uebersicht' && (MARKETING_ANSICHTEN as string[]).includes(ansicht) ? ansicht : undefined);
    return mit(b, ansicht);
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

/** Link in die Qualifizierung & Scoring (03.10.): ohne Angaben die Runde; `k` = dieser Lead (Firma oder Person), `a` = Scoring-Einstellungen. */
export const qualifizierungLink = (k?: string, a?: QualiAnsicht): string => markttraktion('qualifizierung', a && a !== 'runde' ? a : undefined, k && KENNUNG.test(k) ? k : undefined);

/** Vorbelegung eines Angebots (28.09.): welches Angebot (`k`) und für wen — Kontakt, Firma, Deal. */
export interface AngebotAdresse { angebotId?: string | null; kontaktId?: string | null; firmaId?: string | null; dealId?: string | null }
/** Kennungen in der Adresse: kurz und ohne Sonderzeichen (c-…, f-…, ch-…, ang-…) — alles andere fällt weg. */
const KENNUNG = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/;
const kennung = (x?: string | null): string | null => (x && KENNUNG.test(x) ? x : null);

/** Link zum Angebot (Schnellknopf „Angebot“, Kontakt öffnen, Deal-Akte): `?s=angebot&k=<angebot>&kontakt=<id>&firma=<id>&deal=<id>`. */
export function angebotLink({ kontaktId, firmaId, dealId, angebotId }: AngebotAdresse = {}): string {
  const q = new URLSearchParams({ s: 'angebot' });
  const k = kennung(angebotId); if (k) q.set('k', k);
  const kontakt = kennung(kontaktId); if (kontakt) q.set('kontakt', kontakt);
  const firma = kennung(firmaId); if (firma) q.set('firma', firma);
  const deal = kennung(dealId); if (deal) q.set('deal', deal);
  return `${PFAD}?${q}`;
}

/**
 * Der Schnellknopf „Angebot“ nimmt mit, was gerade offen ist (08.10., Markttraktion Woche 2 · 3.15 — vorher ging der offene Kontakt
 * verloren): eine Person in „Kontakte“ (auch „Kontakt öffnen“) → Kontakt, eine Firma → Firma, ein Deal in seiner Akte → Deal. Firmen tragen
 * `f-…`; in „Kontakte“ ist eine Kennung mit `f-` die Firmenkarte.
 */
export function angebotVonHier(bereich: string, ansicht: string | null | undefined, k: string | null | undefined): string {
  const id = kennung(k);
  if (!id) return angebotLink();
  if (bereich === 'deals' && ansicht === 'akte') return angebotLink({ dealId: id });
  if (bereich === 'firmen' || ((bereich === 'kontakte') && id.startsWith('f-'))) return angebotLink({ firmaId: id });
  if (bereich === 'kontakte') return angebotLink({ kontaktId: id });
  return angebotLink();
}

/** Liest die Vorbelegung des Angebots aus der Adresse (Gegenstück zu `angebotLink`). */
export function angebotAusAdresse(p: { get(name: string): string | null }): { angebotId: string | null; kontaktId: string | null; firmaId: string | null; dealId: string | null } {
  return { angebotId: kennung(p.get('k')), kontaktId: kennung(p.get('kontakt')), firmaId: kennung(p.get('firma')), dealId: kennung(p.get('deal')) };
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

// ─── Mandant überall klickbar (28.09., Kevin: „Mandanten auch klickbar“) ─────
// Wo außerhalb des CRM ein Mandant erscheint (Zeit, Ziele, Finanzen, Kalender, Suche),
// führt ein Klick in die CRM-Akte: das Mandat vor der Firma. Gebaut wird der Link NUR
// hier (Baustein components/os/crm/MandantLink.tsx) — nie Pfade von Hand.
//   privat               → 'aus'       (Privat kennt keine Mandanten — nichts anzeigen)
//   kein Zugang zum CRM  → 'text'      (nur der Name, die Akte ginge ohnehin nicht auf)
//   Mandat da            → 'mandat'    /os/mandate?k=<Mandat>
//   Mandat weg, Firma da → 'firma'     /os/markttraktion?s=firmen&k=<Firma> (mandatGeloescht)
//   beides weg           → 'geloescht' (Text mit „(gelöscht)“)
//   keine Kennung        → 'text'
// `…Da` = undefined heißt „nicht geprüft“ und gilt als vorhanden (die Akte zeigt dann selbst, was fehlt).
export interface MandantEingabe {
  mandatId?: string | null;
  firmaId?: string | null;
  privat?: boolean;
  /** Gibt es das Mandat noch? undefined = unbekannt (gilt als ja). */
  mandatDa?: boolean;
  /** Gibt es die Firma noch? undefined = unbekannt (gilt als ja). */
  firmaDa?: boolean;
  /** Darf die Person ins CRM? false → nur Text. */
  zugang?: boolean;
}
export type MandantZiel =
  | { art: 'aus'; href: null }
  | { art: 'text'; href: null }
  | { art: 'geloescht'; href: null }
  | { art: 'mandat'; href: string }
  | { art: 'firma'; href: string; mandatGeloescht: boolean };

export function mandantZiel({ mandatId, firmaId, privat, mandatDa, firmaDa, zugang }: MandantEingabe): MandantZiel {
  if (privat) return { art: 'aus', href: null };
  const m = kennung(mandatId), f = kennung(firmaId);
  if (zugang === false) return { art: 'text', href: null };
  if (m && mandatDa !== false) return { art: 'mandat', href: mandateLink('mandate', m) };
  if (f && firmaDa !== false) return { art: 'firma', href: markttraktion('firmen', undefined, f), mandatGeloescht: !!m };
  if (m || f) return { art: 'geloescht', href: null };
  return { art: 'text', href: null };
}
