// ─── Markttraktion — Adressen (rein, getestet) ──────────────────────────────
// /os/markttraktion?s=<Bereich>&a=<Ansicht>&k=<Person, Firma, Deal, Event>
// Der Hub (22.10., Kevin: Markttraktion wird ein eigenes Werkzeug wie HubSpot): statt einer Reiterzeile mit Schnellknöpfen und Zahnrad
// trägt die Markttraktion ein Menü mit Gruppen — `HUB_MENUE` unten ist die EINE Stelle für Reihenfolge, Namen, Symbole und Ziele, `punktVon`
// sagt, welcher Punkt zu einer Adresse leuchtet (Wächter: tests/aufraeumen-etappe3.test.ts, tests/markttraktion-hub.test.ts). Jeder Bereich
// gehört genau einem Punkt, dem Fuß oder „Automationen & Head“; die dritte Ebene (Board · Liste, Fällig · Woche …) bleibt als Reiter IN der Seite.
//   Überblick                     ueberblick
//   CRM        Kontakte           kontakte (Personen; a = gespeicherte Ansicht, runde-…, akte)
//              Firmen             firmen (Firmen-Kartei)
//   Vertrieb   Leads & Qualifiz.  qualifizierung (Runde · leads · scoring · scoring-sales; k = Lead)
//              Deals              deals: board (Start) · liste · akte (Deal-Akte zu k)
//              Angebote           angebot (k = Angebot, kontakt/firma/deal)
//              Follow-up & Power Hour  followup: faellig (Start) · woche · powerhour · kadenz
//   Marketing  Marketing          marketing: uebersicht (Start) · anfragen · segmente · kampagnen · redaktion · social · newsletter · positionierung
//              Events             besuche (besuchte Veranstaltungen: kalender (Start) · wirkung · kunden; k = Event-Akte) · event (Make.One, k = Abend)
//              Netzwerken         eigene Seite /os/netzwerken (leuchtet dort)
//   Steuerung  Planung            planung (kreislauf (Start) · ziele · kanaele · challenges; kanal = Filter auf einen Leadkanal)
//              Auswertung         auswertung (Flow Kontakte → gewonnen, Traktions-Index, Scoreboard, Kanal-Leistung, Kunden, Pipeline) —
//                                 die alte Adresse deals&a=auswertung zeigt dasselbe und leuchtet hier
//              Automationen & Head  automationen (Standard-Punkt des Werkzeug-Musters: Prozesse Marketing/Sales/Übergabe + Heads)
//   Fuß        Formulare          formulare (25.10.: „Angebot anfordern“ für Vertriebler, externe Links, Eingänge, Einstellungen — später auch die
//                                 Website-Formulare; im Fuß, weil die Gruppen schon zwölf Punkte tragen)
//              Stammdaten         stammdaten (Qualität, Wertelisten, Gesellschaften, Datenschutz, Import & Export)
//   „Kontakt öffnen“: t = ueber (Start, ohne t) · aktivitaeten · umsatz · daten; u = Unter-Reiter der Aktivitäten; Anker #akt-… springt.
// Alte Adressen bleiben gültig (nie brechen): /os/crm leitet um (next.config.mjs); `aufloesen` übersetzt die alten Bereiche
// (heute/pipeline/kunden/events/kartei), den früheren Reiter „Sales“ (head/powerhour/kampagnen/auswertung und vom 25./26.09.
// heute/leads/pipeline/kunden), Firmen › Leads und Deals › Kunden — so funktionieren Suche, Befunde, ZOE und Telegram weiter.

export type Bereich = 'ueberblick' | 'kontakte' | 'firmen' | 'deals' | 'followup' | 'qualifizierung' | 'angebot' | 'planung' | 'marketing' | 'besuche' | 'event' | 'stammdaten' | 'auswertung' | 'automationen' | 'formulare';
/** Events › Besuchte Events (03.10.): Kalender · Wirkung · Im Kundenauftrag — die Event-Akte steht in `k`. Die Kennung heißt `besuche`, weil `events` als alter Name von Make.One gültig bleibt. */
export type BesucheAnsicht = 'kalender' | 'wirkung' | 'kunden';
export const BESUCHE_ANSICHTEN: BesucheAnsicht[] = ['kalender', 'wirkung', 'kunden'];
export type DealsAnsicht = 'board' | 'liste' | 'akte' | 'auswertung';
export type FollowupAnsicht = 'faellig' | 'woche' | 'powerhour' | 'kadenz';
/** `social` (26.10.): Social-Kanäle, Folgen, Analyse — Unterreiter von Marketing (das Hub-Menü hat Kevins Höchstzahl von zwölf Punkten). */
export type MarketingAnsicht = 'uebersicht' | 'anfragen' | 'check' | 'segmente' | 'kampagnen' | 'redaktion' | 'newsletter' | 'positionierung' | 'social';
export const MARKETING_ANSICHTEN: MarketingAnsicht[] = ['uebersicht', 'anfragen', 'check', 'segmente', 'kampagnen', 'redaktion', 'social', 'newsletter', 'positionierung'];
/** Der frühere Reiter „Sales“ (27.09.–08.10.) und der Sales-Reiter vom 25./26.09. — nur noch zum Übersetzen alter Adressen. */
export const SALES_ALT_ANSICHTEN = ['head', 'powerhour', 'kampagnen', 'auswertung', 'heute', 'leads', 'pipeline', 'kunden'] as const;
export const BEREICHE: Bereich[] = ['ueberblick', 'kontakte', 'firmen', 'deals', 'followup', 'qualifizierung', 'angebot', 'planung', 'marketing', 'besuche', 'event', 'stammdaten', 'auswertung', 'automationen', 'formulare'];
/** Alte Bereiche, die es als eigenen Ort nicht mehr gibt — `aufloesen` übersetzt sie (der Wächter prüft jede Kombination). */
export const BEREICHE_ALT = ['sales', 'heute', 'pipeline', 'kunden', 'events', 'kartei'] as const;

/**
 * „Leads & Qualifizierung“ (03.10. als Schnellknopf „Qualifizierung & Scoring“, seit 22.10. ein Punkt des Hubs; die Kennung `qualifizierung` und alte Links bleiben):
 * `a` fehlt = die Runde · `leads` = alle Leads (Ebene 1, bis 08.10. Firmen › Leads) · `scoring` = Marketing (bis MQL) · `scoring-sales` = Sales (MQL → SQL).
 * `k` = ein Lead (Firma f-… oder Person c-…): Runde bzw. Liste springen dorthin.
 */
export type QualiAnsicht = 'runde' | 'leads' | 'scoring' | 'scoring-sales';
export const QUALI_ANSICHTEN: QualiAnsicht[] = ['runde', 'leads', 'scoring', 'scoring-sales'];
/**
 * „Planung“ (10.10. als Schnellknopf, seit 22.10. ein Punkt des Hubs unter „Steuerung“): `a` fehlt = der Kreislauf (Start) · `ziele` = Umsatzziele → Aktivitäten (mit Kapazität) ·
 * `kanaele` = Leadkanäle (Plan-Quoten, Ist) · `challenges` = Wochen-Challenges und Rückblick. `kanal` filtert auf einen Leadkanal.
 */
export type PlanungAnsicht = 'kreislauf' | 'ziele' | 'kanaele' | 'challenges';
export const PLANUNG_ANSICHTEN: PlanungAnsicht[] = ['kreislauf', 'ziele', 'kanaele', 'challenges'];
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
    // Ohne eigene Ansichten: Überblick, Auswertung (22.10.), Automationen & Head und Formulare (25.10., eine Seite mit Karten) — eine Ansicht fällt weg.
    if (b === 'ueberblick' || b === 'auswertung' || b === 'automationen' || b === 'formulare') return { s: b };
    if (b === 'firmen' && ansicht === 'leads') return SALES_NEU.leads;
    // Die alte Qualifizierungs-Runde der Kartei (Chancen-Runde, 25.09.) ist die Runde unter „Leads & Qualifizierung“.
    if (b === 'kontakte' && ansicht === 'runde-chancen') return { s: 'qualifizierung' };
    if (b === 'deals' && ansicht === 'kunden') return SALES_NEU.kunden;
    if (b === 'deals') return mit(b, ansicht && ansicht !== 'board' && (DEALS_ANSICHTEN as string[]).includes(ansicht) ? ansicht : undefined);
    if (b === 'besuche') return mit(b, ansicht && ansicht !== 'kalender' && (BESUCHE_ANSICHTEN as string[]).includes(ansicht) ? ansicht : undefined);
    if (b === 'followup') return mit(b, ansicht && ansicht !== 'faellig' && (FOLLOWUP_ANSICHTEN as string[]).includes(ansicht) ? ansicht : undefined);
    if (b === 'qualifizierung') return mit(b, ansicht && ansicht !== 'runde' && (QUALI_ANSICHTEN as string[]).includes(ansicht) ? ansicht : undefined);
    if (b === 'planung') return mit(b, ansicht && ansicht !== 'kreislauf' && (PLANUNG_ANSICHTEN as string[]).includes(ansicht) ? ansicht : undefined);
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

/** Link in die Planung (10.10.): ohne Angaben der Kreislauf; `kanal` = auf einen Leadkanal gefiltert (Kennung `lk-…` oder `ohne`). */
export function planungLink(a?: PlanungAnsicht, kanal?: string | null): string {
  const basis = markttraktion('planung', a && a !== 'kreislauf' ? a : undefined);
  return kanal && (kanal === 'ohne' || /^lk-[a-z0-9-]{4,60}$/.test(kanal)) ? `${basis}&kanal=${kanal}` : basis;
}

/** Vorbelegung eines Angebots (28.09.): welches Angebot (`k`) und für wen — Kontakt, Firma, Deal. */
export interface AngebotAdresse { angebotId?: string | null; kontaktId?: string | null; firmaId?: string | null; dealId?: string | null }
/** Kennungen in der Adresse: kurz und ohne Sonderzeichen (c-…, f-…, ch-…, ang-…) — alles andere fällt weg. */
const KENNUNG = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/;
const kennung = (x?: string | null): string | null => (x && KENNUNG.test(x) ? x : null);

/** Link zum Angebot (Hub „Angebote“, „+ Angebot“ in Kontakt-, Firmen- und Deal-Akte): `?s=angebot&k=<angebot>&kontakt=<id>&firma=<id>&deal=<id>`. */
export function angebotLink({ kontaktId, firmaId, dealId, angebotId }: AngebotAdresse = {}): string {
  const q = new URLSearchParams({ s: 'angebot' });
  const k = kennung(angebotId); if (k) q.set('k', k);
  const kontakt = kennung(kontaktId); if (kontakt) q.set('kontakt', kontakt);
  const firma = kennung(firmaId); if (firma) q.set('firma', firma);
  const deal = kennung(dealId); if (deal) q.set('deal', deal);
  return `${PFAD}?${q}`;
}

/**
 * „+ Angebot“ nimmt mit, was gerade offen ist (08.10., Markttraktion Woche 2 · 3.15 — vorher ging der offene Kontakt verloren; seit 22.10.
 * die Aktion in Kontakt-, Firmen- und Deal-Akte statt eines Schnellknopfs): eine Person in „Kontakte“ (auch „Kontakt öffnen“) → Kontakt, eine
 * Firma → Firma, ein Deal in seiner Akte → Deal. Firmen tragen `f-…`; in „Kontakte“ ist eine Kennung mit `f-` die Firmenkarte. Ohne offenen
 * Bezug: die Liste der Angebote.
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

/**
 * Produkte & Mandate (25.09.): eigener Bereich links unter Aufgaben — s: mandate (Start) · produkte · automationen („Automationen & Head“ des Werkzeugs,
 * 22.10. abends), k: Mandat bzw. Produkt.
 */
export const MANDATE_PFAD = '/os/mandate';
export type MandateOrt = 'mandate' | 'produkte' | 'automationen';
/** Welcher Ort der Seite /os/mandate (Unbekanntes = Mandate) — dieselbe Regel für die Seite und das Werkzeug-Menü. */
export const mandateOrt = (s: string | null | undefined): MandateOrt => (s === 'produkte' || s === 'automationen' ? s : 'mandate');

export function mandateLink(s?: MandateOrt, k?: string): string {
  const q = new URLSearchParams();
  if (s === 'produkte' || s === 'automationen') q.set('s', s);
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

// ─── Der Hub — das Menü der Markttraktion als Werkzeug (22.10., Kevins Entscheidungen) ─────────────────────────────────────────────────────
// Kevin 22.10.: Markttraktion wird ein eigenes Werkzeug (HubSpot-Art) — beim Öffnen klappt die linke Leiste auf diese Punkte um (das gemeinsame
// Werkzeug-Muster, lib/make-one/werkzeuge.ts, hängt die Liste dort ein). Hier steht NUR die Liste als Daten: Gruppen mit Überschrift, je Punkt Kennung,
// Name, lucide-Symbol (als Name — aufgelöst in lib/crm/hub-symbole.ts `HUB_SYMBOLE`), Ziel über die Link-Funktionen dieser
// Datei und die Bereiche, bei denen er leuchtet. Dazu der Standard-Punkt „Automationen & Head“ (eigener Eintrag `automation`, wie im Werkzeug-
// Muster) und der Fuß (Stammdaten). Produkte & Mandate bleibt ein eigenes Werkzeug, Kontakte stehen nur hier (nie zusätzlich in der Hauptleiste).
// Regeln (Wächter tests/aufraeumen-etappe3.test.ts + tests/markttraktion-hub.test.ts): höchstens zwölf Punkte in den Gruppen (dazu der Fuß und
// „Automationen & Head“), jeder Bereich genau einem Punkt, dem Fuß oder „Automationen & Head“, jedes Ziel löst auf seinen Punkt auf. Hub-Punkte
// sind KEINE Einträge der Space-Leiste (lib/make-one/spaces.ts) — die Zeitmessung zählt die ganze Markttraktion weiter als `business:markttraktion`.

/** Netzwerken (02.10.) ist eine eigene Seite — im Hub ein Punkt, der dort leuchtet. Dieselbe Adresse wie `WEG.netzwerken()` (Test). */
export const NETZWERKEN_PFAD = '/os/netzwerken';
/** Die Auswertung (22.10.): Flow vom Kontakt zum gewonnenen Deal, Traktions-Index, Scoreboard, Kanal-Leistung, Kunden, Pipeline. */
export const auswertungLink = (): string => markttraktion('auswertung');
/** „Automationen & Head“ der Markttraktion (Ort auf der Seite, an dem das Werkzeug-Muster seinen Baustein einhängt). */
export const automationenLink = (): string => markttraktion('automationen');
/** Formulare (25.10.): „Angebot anfordern“, externe Links, Eingänge, Einstellungen — eine Seite. `#anker` springt zu einer Karte. */
export const formulareLink = (anker?: 'anfordern' | 'links' | 'eingaenge' | 'einstellungen'): string => `${markttraktion('formulare')}${anker ? `#${anker}` : ''}`;

/** Die Symbole der Punkte — Namen aus lucide-react (die Oberfläche löst sie auf; lib bleibt ohne React). */
export type HubSymbol = 'LayoutDashboard' | 'Users' | 'Building2' | 'Funnel' | 'SquareKanban' | 'FileSignature' | 'PhoneCall' | 'Megaphone' | 'CalendarDays'
  | 'Handshake' | 'Goal' | 'ChartNoAxesCombined' | 'Bot' | 'Settings' | 'ClipboardList';
export type HubPunktId = 'ueberblick' | 'kontakte' | 'firmen' | 'qualifizierung' | 'deals' | 'angebot' | 'followup' | 'marketing' | 'events' | 'netzwerken'
  | 'planung' | 'auswertung' | 'formulare' | 'stammdaten';
/** Wo man im Hub steht: ein Punkt oder „Automationen & Head“. */
export type HubOrtId = HubPunktId | 'automationen';
export type HubGruppeId = 'start' | 'crm' | 'vertrieb' | 'marketing' | 'steuerung';

export interface HubPunkt {
  id: HubPunktId;
  name: string;
  symbol: HubSymbol;
  /** Wohin ein Klick führt — über die Link-Funktionen dieser Datei (alte Adressen bleiben gültig). */
  ziel: string;
  /** Die Bereiche der Markttraktion, bei denen der Punkt leuchtet (leer bei einer eigenen Seite). */
  bereiche: readonly Bereich[];
  /** Eine eigene Seite außerhalb der Markttraktion (Netzwerken) — der Punkt leuchtet auf diesem Pfad und darunter. */
  pfad?: string;
  /** Erklärung im Tooltip (die schmale Leiste zeigt nur Symbole). */
  titel: string;
}
export interface HubGruppe { id: HubGruppeId; /** null = ohne Überschrift (der Überblick oben). */ titel: string | null; punkte: readonly HubPunkt[] }
/** Der Standard-Punkt „Automationen & Head“ (Form wie `WerkzeugAutomation` im Werkzeug-Muster): Prozess-Bereiche, Heads, Ort auf der Seite, Gruppe. */
export interface HubAutomation {
  id: 'automationen';
  name: string;
  symbol: HubSymbol;
  ziel: string;
  bereiche: readonly Bereich[];
  /** Kennungen aus `PROZESS_BEREICHE` (lib/prozesse/definition.ts) — die Abläufe der Kundengewinnung. */
  prozessBereiche: readonly string[];
  /** Heads aus dem Katalog (lib/agenten/katalog.ts) — der erste ist der Head des Werkzeugs. */
  heads: readonly string[];
  gruppe: HubGruppeId;
  titel: string;
}

export const HUB_MENUE: { gruppen: readonly HubGruppe[]; automation: HubAutomation; fuss: readonly HubPunkt[] } = {
  gruppen: [
    { id: 'start', titel: null, punkte: [
      { id: 'ueberblick', name: 'Überblick', symbol: 'LayoutDashboard', ziel: markttraktion(), bereiche: ['ueberblick'], titel: 'Für dich, Team, Übergaben — was jetzt zu tun ist' },
    ] },
    { id: 'crm', titel: 'CRM', punkte: [
      { id: 'kontakte', name: 'Kontakte', symbol: 'Users', ziel: markttraktion('kontakte'), bereiche: ['kontakte'], titel: 'Jede Person mit ihrer ganzen Geschichte' },
      { id: 'firmen', name: 'Firmen', symbol: 'Building2', ziel: markttraktion('firmen'), bereiche: ['firmen'], titel: 'Jedes Unternehmen mit allen Beziehungen' },
    ] },
    { id: 'vertrieb', titel: 'Vertrieb', punkte: [
      { id: 'qualifizierung', name: 'Leads & Qualifizierung', symbol: 'Funnel', ziel: qualifizierungLink(), bereiche: ['qualifizierung'], titel: 'Runde, Leads und Scoring — bis zum SQL' },
      { id: 'deals', name: 'Deals', symbol: 'SquareKanban', ziel: markttraktion('deals'), bereiche: ['deals'], titel: 'Ab SQL im Closing — Board und Liste' },
      { id: 'angebot', name: 'Angebote', symbol: 'FileSignature', ziel: angebotLink(), bereiche: ['angebot'], titel: 'Alle Angebote — neu aus Produkten in einer Minute' },
      { id: 'followup', name: 'Follow-up & Power Hour', symbol: 'PhoneCall', ziel: markttraktion('followup'), bereiche: ['followup'], titel: 'Fällig, Woche, Power Hour, Kadenz' },
    ] },
    { id: 'marketing', titel: 'Marketing', punkte: [
      { id: 'marketing', name: 'Marketing', symbol: 'Megaphone', ziel: markttraktion('marketing'), bereiche: ['marketing'], titel: 'Anfragen, Segmente, Kampagnen, Redaktion, Social, Newsletter, Positionierung' },
      { id: 'events', name: 'Events', symbol: 'CalendarDays', ziel: markttraktion('besuche'), bereiche: ['besuche', 'event'], titel: 'Besuchte Events und unsere eigenen Abende' },
      { id: 'netzwerken', name: 'Netzwerken', symbol: 'Handshake', ziel: NETZWERKEN_PFAD, bereiche: [], pfad: NETZWERKEN_PFAD, titel: 'Vor Ort erfassen — Karte, Gespräch, nächster Schritt' },
    ] },
    { id: 'steuerung', titel: 'Steuerung', punkte: [
      { id: 'planung', name: 'Planung', symbol: 'Goal', ziel: planungLink(), bereiche: ['planung'], titel: 'Vom Umsatzziel zu den Aktivitäten je Leadkanal' },
      { id: 'auswertung', name: 'Auswertung', symbol: 'ChartNoAxesCombined', ziel: auswertungLink(), bereiche: ['auswertung'], titel: 'Der Weg zum Kunden, Traktions-Index, Scoreboard, Kanäle, Pipeline' },
    ] },
  ],
  automation: {
    id: 'automationen', name: 'Automationen & Head', symbol: 'Bot', ziel: automationenLink(), bereiche: ['automationen'],
    prozessBereiche: ['marketing', 'sales', 'uebergabe'], heads: ['sales', 'marketing', 'event'], gruppe: 'steuerung',
    titel: 'Die Prozesse von Marketing, Sales und Übergabe — mit den Heads Sales, Marketing und Event',
  },
  // Fuß (25.10.): Formulare vor Stammdaten — die Gruppen tragen schon zwölf Punkte (Kevins Grenze), der Fuß zählt nicht mit.
  fuss: [
    { id: 'formulare', name: 'Formulare', symbol: 'ClipboardList', ziel: formulareLink(), bereiche: ['formulare'], titel: 'Angebot anfordern — für das Team und externe Vertriebler per Link' },
    { id: 'stammdaten', name: 'Stammdaten', symbol: 'Settings', ziel: markttraktion('stammdaten'), bereiche: ['stammdaten'], titel: 'Qualität, Wertelisten, Datenschutz, Import & Export' },
  ],
};

/** Alle eigenen Punkte (Gruppen und Fuß) — ohne „Automationen & Head“. */
export const HUB_PUNKTE: readonly HubPunkt[] = [...HUB_MENUE.gruppen.flatMap(g => g.punkte), ...HUB_MENUE.fuss];

/** Ein Eintrag zum Zeichnen — eigener Punkt oder „Automationen & Head“. */
export interface HubEintrag { id: HubOrtId; name: string; symbol: HubSymbol; ziel: string; titel: string }
/**
 * Die Gruppen in der Reihenfolge des Menüs (Tests, Beschreibungen): die eigenen Punkte, „Automationen & Head“ am Ende seiner Gruppe — dieselbe
 * Reihenfolge, die `alleUnterpunkte(MARKTTRAKTION_WERKZEUG)` in der Werkzeug-Leiste zeichnet (Wächter tests/werkzeuge.test.ts).
 */
export function hubGruppenAnzeige(): { id: HubGruppeId; titel: string | null; punkte: HubEintrag[] }[] {
  const a = HUB_MENUE.automation;
  const eintrag = (p: HubPunkt): HubEintrag => ({ id: p.id, name: p.name, symbol: p.symbol, ziel: p.ziel, titel: p.titel });
  return HUB_MENUE.gruppen.map(g => ({
    id: g.id, titel: g.titel,
    punkte: [...g.punkte.map(eintrag), ...(g.id === a.gruppe ? [{ id: a.id, name: a.name, symbol: a.symbol, ziel: a.ziel, titel: a.titel }] : [])],
  }));
}

/**
 * Welcher Punkt leuchtet zu einer aufgelösten Adresse (`aufloesen(s, a)`)? Jeder Bereich gehört genau einem Punkt; die alte Adresse
 * `deals&a=auswertung` (WEG.kunden, Kennzahlen, Widgets) zeigt die Auswertung und leuchtet dort.
 */
export function punktVon(z: { s: Bereich; a?: string }): HubOrtId {
  if (z.s === 'deals' && z.a === 'auswertung') return 'auswertung';
  if (HUB_MENUE.automation.bereiche.includes(z.s)) return 'automationen';
  return HUB_PUNKTE.find(p => p.bereiche.includes(z.s))?.id ?? 'ueberblick';
}

/** Dasselbe für eine Adresse (Pfad + Parameter): in der Markttraktion nach `punktVon`, auf einer eigenen Seite des Hubs (Netzwerken) ihr Punkt, sonst null. */
export function hubOrtFuer(pfad: string, suche = ''): HubOrtId | null {
  if (pfad === PFAD) {
    const q = new URLSearchParams(suche.startsWith('?') ? suche.slice(1) : suche);
    return punktVon(aufloesen(q.get('s'), q.get('a')));
  }
  return HUB_PUNKTE.find(p => p.pfad && (pfad === p.pfad || pfad.startsWith(`${p.pfad}/`)))?.id ?? null;
}

/**
 * Events in EINER Reiterzeile (22.10., keine vierte Ebene): Kalender · Wirkung · Im Kundenauftrag (besuchte Events) · Make.One (eigene Abende).
 * Die Adressen bleiben (`besuche`, `besuche&a=wirkung|kunden`, `event`); die Beschriftung setzt die Oberfläche (Make.One aus lib/crm/marke.ts).
 */
export type EventsReiterId = BesucheAnsicht | 'makeone';
export const EVENTS_REITER: readonly { id: EventsReiterId; s: 'besuche' | 'event'; a?: BesucheAnsicht }[] = [
  { id: 'kalender', s: 'besuche' }, { id: 'wirkung', s: 'besuche', a: 'wirkung' }, { id: 'kunden', s: 'besuche', a: 'kunden' }, { id: 'makeone', s: 'event' },
];
/** Welcher Events-Reiter zu einer aufgelösten Adresse leuchtet — null außerhalb der Events. */
export function eventsReiterVon(z: { s: Bereich; a?: string }): EventsReiterId | null {
  if (z.s === 'event') return 'makeone';
  if (z.s !== 'besuche') return null;
  return EVENTS_REITER.find(r => r.s === 'besuche' && (r.a ?? 'kalender') === (z.a ?? 'kalender'))?.id ?? 'kalender';
}
