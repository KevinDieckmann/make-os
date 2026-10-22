// ─── MAKE OS — Das Werkzeug-Muster (22.10.; Rückmeldung: „Wenn ich Prozesse aufmache, kommt im Grunde ein neues Tool — wie bei Miro. Genauso bei
// Markttraktion wie bei HubSpot. Alles als eigenes Tool betrachten, das ineinandergreift — dann bekommt jeder Bereich mehr Power.“) ─────────────────
// Ein Werkzeug ist ein Bereich, der beim Öffnen seine eigene Leiste bekommt (wie HubSpot): Steht die Adresse in einem Werkzeug, klappt die linke Leiste
// auf dessen Unterpunkte um — oben „← MAKE OS“ (zurück zur Leiste des Space, ohne die Seite zu verlassen), darunter Name und Symbol, dann die Unterpunkte.
// Im Werkzeugmodus (ganzer Bildschirm, `?voll=1` — derselbe Parameter wie das Vollbild der Flächen, nicht ein zweiter) wird die Leiste zur schmalen
// Symbol-Leiste, oben schwebt die Kopfzeile „← MAKE OS · <Werkzeug> · <Titel>“ (components/os/werkzeug/*).
//
// EINE Konfiguration je Werkzeug, als Daten — rein und client-sicher (Leiste, Blatt am Handy, Symbol-Leiste und Tests lesen dieselbe Liste):
//   · `pfade`       welche Adressen zum Werkzeug gehören (Muster wie `passtZu` in ./spaces.ts) — eine Adresse gehört höchstens EINEM Werkzeug
//   · `leistenPunkt` der Punkt der Space-Leiste, der das Werkzeug öffnet (Name wie in ./spaces.ts) — das Werkzeug ersetzt keinen Leistenpunkt
//   · `punkte`      die Unterpunkte: ein Ziel über `WEG` (vorhandene Adressen — alte Links gelten weiter) ODER eine Aktion der Seite (Ereignis
//                   `make-werkzeug`, die Seite des Werkzeugs lauscht); `aktiv` sagt, wann der Punkt leuchtet, `sichtbar`, wann er da ist;
//                   `unter` = eine Ebene darunter (höchstens zwei Ebenen im Werkzeug-Menü — tiefer gehört es in die Seite)
//   · `gruppe`      Überschrift über zusammengehörigen Unterpunkten (z. B. Markttraktion: CRM · Vertrieb · Marketing · Steuerung) — nur eine Beschriftung,
//                   keine Ebene; Punkte einer Gruppe stehen beieinander (Wächter)
//   · `fuss`        Punkte unten im Werkzeug-Menü (z. B. „Präsentieren“, „Stammdaten“)
//   · `automation`  der Standard-Unterpunkt „Automationen & Head“ (Entscheidung 22.10.: „Jeder Bereich hat einen eigenen Automation & Head of Bereich, wo wir die
//                   Automatisierungen dem jeweiligen Bereich bauen können wie mit den Prozessen — also eigentlich die Prozesse.“): welche Bereiche der
//                   Prozess-Landkarte und welcher Head zum Werkzeug gehören, und WO auf der Seite des Werkzeugs der Baustein steht
//                   (components/os/werkzeug/BereichAutomationen.tsx) — ein Parameter an der vorhandenen Seite, keine eigene Seite (keine dritte Ebene, die
//                   Schnellsuche findet die Seite schon, der Rahmen bleibt). Prozesse selbst trägt ihn nicht: dort ist es die ganze Landkarte.
//   · je Space   ein Werkzeug darf in Privat andere Punkte zeigen als in Business (`sichtbar` liest `k.space` — die Wahl im Kopf bzw. `?space=`); „Automationen
//                & Head“ kann je Space eine eigene Fassung tragen (`automation` als Liste mit `spaces`) — in Privat nur, wo es einen Head gibt (Prozesse nur Business)
//   · Heads       NIE eine zweite Zuordnung: welcher Head zu einem Werkzeug gehört, sagt `SEITEN_REGELN` (lib/agenten/kontext-head.ts) über die Ziele seiner Punkte
//                (`headsDerSeiten` — der Head des Einstiegs zuerst); Markttraktion nimmt die Liste aus `HUB_MENUE` (dieselben Heads, Wächter)
// Werkzeuge heute: Prozesse (Miro-Art), Markttraktion (HubSpot-Art, Gruppen-Überschriften, Punkte aus `HUB_MENUE`), Produkte & Mandate, Unternehmen, Finanzen
// (Punkte aus lib/finanzen/navigation.ts) und Planung — die letzten vier seit 22.10. abends (Gruppe A, Entscheidung: „Ja, alle Empfehlungen“).
// Ein neues Werkzeug = ein Eintrag in `WERKZEUGE` + die Seite hört seine Aktionen (bzw. hängt den Rahmen ein); nichts in der Leiste ändern.

import type { LucideIcon } from 'lucide-react';
import {
  Workflow, Map as MapIcon, List, Hammer, PencilRuler, History, FlaskConical, LayoutTemplate, Presentation, Bot, TrendingUp,
  Briefcase, Package, Route, UserPlus, Blocks, ChartColumn, RefreshCw,
  Building2, Gauge, CalendarClock, FileText, TriangleAlert, ShieldCheck, Network, Gavel, FileSignature, Landmark, Archive, Trash2,
  Wallet, LayoutDashboard, Target, Receipt, Waves, BookOpen, Calculator, Scale, Settings2, Anchor, Sun, ListChecks, PiggyBank,
} from 'lucide-react';
import { WEG } from '@/lib/wege';
import { prozesseAusAdresse } from '@/lib/prozesse/adresse';
import { ansichtVorgabe, type ProzessAnsicht } from '@/lib/prozesse/typen';
import { HUB_MENUE, hubOrtFuer, mandateLink, mandateOrt, MANDATE_PFAD, type HubPunkt, type HubOrtId } from '@/lib/crm/adresse';
import { FULFILLMENT_PFAD, FULFILLMENT_BEREICHE, fulfillmentAusAdresse, type FulfillmentBereich } from '@/lib/fulfillment/adresse';
import { LAGE_REITER, AKTE_REITER, UNTERNEHMEN_FILTER, MIT_WAHL, unternehmenOrt } from '@/lib/gesellschaften/schild/adresse';
import type { SchildReiter } from '@/lib/gesellschaften/schild/ampel';
import { FINANZ_MENUE, FINANZ_FUSS, finanzAdresse, finanzFussAdresse, finanzOrt, finanzMenueId, finanzMenueErlaubt, type FinanzBereich, type FinanzMenueId, type FinanzFussPunkt } from '@/lib/finanzen/navigation';
import { HUB_SYMBOLE } from '@/lib/crm/hub-symbole';
import { kontextHeadFuer } from '@/lib/agenten/kontext-head';
import { passtZu, wahlVon, SPACE_VORGABE } from './spaces';
import type { SpaceId } from './space-regeln';

/**
 * Wo man gerade steht — aus der Adresse (und ob es das Handy-Blatt ist: dort gelten die Vorgaben des Handys). `space` = die Wahl im Kopf (Leiste) bzw. was die
 * Adresse sagt (`?space=` gewinnt, sonst die Seite, sonst Business); `nurBusiness` = ein Konto „nur Business“ (der Server liefert ihm nichts Privates — das
 * Menü zeigt ihm, was es benutzen kann).
 */
export interface WerkzeugKontext { pfad: string; q: URLSearchParams; handy: boolean; space: SpaceId; nurBusiness: boolean }

export interface WerkzeugPunkt {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Ziel über `WEG` — darf die Lage der Adresse lesen (z. B. den offenen Prozess). */
  href?: (k: WerkzeugKontext) => string;
  /** Statt eines Links: eine Aktion der Seite des Werkzeugs (Ereignis `make-werkzeug` mit `{ werkzeug, aktion }`). */
  aktion?: string;
  /** Leuchtet, wenn … (ohne Regel nie). */
  aktiv?: (k: WerkzeugKontext) => boolean;
  /** Steht nur da, wenn … (ohne Regel immer). */
  sichtbar?: (k: WerkzeugKontext) => boolean;
  /** Erklärung im Tooltip (die schmale Leiste zeigt nur Symbole). */
  titel?: string;
  /** Eine Ebene darunter — höchstens zwei Ebenen (Wächter in tests/werkzeuge.test.ts). */
  unter?: readonly WerkzeugPunkt[];
  /** Überschrift der Gruppe, zu der der Punkt gehört (nur Beschriftung, keine Ebene). */
  gruppe?: string;
  /**
   * Der Punkt führt in einen ANDEREN Bereich (Name, z. B. „Kalender“) — er verlässt das Werkzeug (Planung › „Woche planen“ öffnet Kalender › Planen); im Menü mit
   * ↗ gekennzeichnet. Nur für Fuß-Punkte gedacht; der Wächter verlangt sonst, dass jedes Ziel im Werkzeug bleibt.
   */
  wechselt?: string;
}

/**
 * „Automationen & Head“ eines Werkzeugs: die Bereiche der Prozess-Landkarte (`PROZESS_BEREICHE`-Kennungen — eigene Bereiche `lb-…` gehören der Instanz und
 * kommen nie in den Code), der Head (Katalog-Kennung, lib/agenten/katalog.ts) und der Ort auf der Seite des Werkzeugs (`href`, über die Adress-Regeln der Seite).
 */
export interface WerkzeugAutomation {
  /** Ganze Bereiche der Landkarte (feste Kennungen). In Privat leer — Prozesse gibt es nur im Business. */
  bereiche: readonly string[];
  /** Einzelne Prozesse der Landkarte (z. B. `sp-monatsabschluss`), die zum Werkzeug gehören, ohne dass ihr ganzer Bereich dazugehört. */
  prozesse?: readonly string[];
  /** In welchen Spaces diese Fassung gilt (ohne Angabe: in allen Spaces des Werkzeugs) — die erste passende gilt. */
  spaces?: readonly SpaceId[];
  /** Der Head des Werkzeugs (Vorbelegung, „Head fragen“). */
  head?: string;
  /** Weitere Heads des Bereichs (z. B. Markttraktion: Marketing und Event neben Sales) — je eine Karte unter der ersten; ohne: nur `head`. */
  weitereHeads?: readonly string[];
  href: (k: WerkzeugKontext) => string;
  aktiv: (k: WerkzeugKontext) => boolean;
  /** Unter welcher Überschrift der Punkt steht (z. B. „Steuerung“); ohne: am Ende der Unterpunkte. */
  gruppe?: string;
}
/** Name und Symbol des Standard-Unterpunkts — überall gleich. */
export const AUTOMATION_LABEL = 'Automationen & Head';
export const AUTOMATION_ICON: LucideIcon = Bot;
const AUTOMATION_TITEL = 'Die Prozesse dieses Bereichs bauen und steuern — mit seinem Head';
/** Alle Heads eines Werkzeugs, der Head des Werkzeugs zuerst, ohne Doppelte (der Baustein zeichnet je Head eine Karte). */
export function automationHeads(a: WerkzeugAutomation | null | undefined): string[] {
  return a ? [...new Set([...(a.head ? [a.head] : []), ...(a.weitereHeads ?? [])])] : [];
}

export interface Werkzeug {
  id: string;
  name: string;
  icon: LucideIcon;
  /** In welchen Spaces es das Werkzeug gibt (sein Leistenpunkt steht dort). */
  spaces: readonly SpaceId[];
  /** Pfad-Muster (wie `passtZu`): welche Adressen gehören zum Werkzeug. */
  pfade: readonly string[];
  /** Der Einstieg (Klick auf den Namen des Werkzeugs). */
  start: string;
  /** Der Punkt der Space-Leiste, der das Werkzeug öffnet (Name wie in lib/make-one/spaces.ts). */
  leistenPunkt: string;
  punkte: readonly WerkzeugPunkt[];
  fuss?: readonly WerkzeugPunkt[];
  /** „Automationen & Head“ — eine Fassung für alle Spaces oder je Space eine (Liste mit `spaces`). */
  automation?: WerkzeugAutomation | readonly WerkzeugAutomation[];
  /**
   * Nur für volle Mitglieder des Haushalts (wie der Leistenpunkt, `nurVolleMitglieder` in ./spaces.ts): ein Konto „nur Business“ bekommt den Bereich serverseitig
   * nicht (403) — die Leiste zeigt ihm das Menü des Werkzeugs gar nicht erst.
   */
  nurVolleMitglieder?: true;
}

const geteilt = (href: string): { pfad: string; suche: string } => {
  const ohneAnker = href.split('#')[0];
  const i = ohneAnker.indexOf('?');
  return i < 0 ? { pfad: ohneAnker, suche: '' } : { pfad: ohneAnker.slice(0, i), suche: ohneAnker.slice(i) };
};

/** Alle Fassungen von „Automationen & Head“ eines Werkzeugs. */
export function automationenVon(w: Werkzeug): readonly WerkzeugAutomation[] {
  const a = w.automation;
  return !a ? [] : Array.isArray(a) ? a : [a as WerkzeugAutomation];
}
/** Die Fassung von „Automationen & Head“ für einen Space — oder null (dort steht der Punkt nicht). */
export function automationVon(w: Werkzeug, space: SpaceId): WerkzeugAutomation | null {
  return automationenVon(w).find(a => (a.spaces ?? w.spaces).includes(space)) ?? null;
}

/**
 * Die Heads der Seiten eines Werkzeugs — aus `SEITEN_REGELN` (lib/agenten/kontext-head.ts, EINE Zuordnung Seite → Head), in der Reihenfolge der Ziele, ohne
 * Doppelte, nur Heads des Space. So steht nirgends eine zweite Liste „welcher Head gehört zu welchem Bereich“.
 */
export function headsDerSeiten(hrefs: readonly string[], space: SpaceId): string[] {
  const ids = hrefs.map(h => { const g = geteilt(h); return kontextHeadFuer(g.pfad, g.suche, space); });
  return [...new Set(ids.filter((x): x is string => !!x))];
}
/** Die Ziele der Punkte eines Werkzeugs an seinem Einstieg in einem Space (für `headsDerSeiten`) — ohne Punkte, die das Werkzeug verlassen. */
function zieleIm(start: string, punkte: readonly WerkzeugPunkt[], space: SpaceId): string[] {
  const g = geteilt(start);
  const k = werkzeugKontext(g.pfad, g.suche, false, { space });
  return [start, ...punkte.flatMap(p => [p, ...(p.unter ?? [])]).filter(p => !p.wechselt && (p.sichtbar?.(k) ?? true) && p.href).map(p => p.href!(k))];
}
/** „Automationen & Head“ mit den Heads aus `SEITEN_REGELN` — der Head des Einstiegs zuerst, die der übrigen Punkte als weitere Karten. */
function automationMitHeads(start: string, punkte: readonly WerkzeugPunkt[], space: SpaceId, a: Omit<WerkzeugAutomation, 'head' | 'weitereHeads' | 'spaces'>): WerkzeugAutomation {
  const heads = headsDerSeiten(zieleIm(start, punkte, space), space);
  return { ...a, spaces: [space], ...(heads[0] ? { head: heads[0] } : {}), ...(heads.length > 1 ? { weitereHeads: heads.slice(1) } : {}) };
}

// ─── Prozesse (das erste Werkzeug, Miro-Art) ────────────────────────────────────────────────────────────────────────────────────────────────
// Unterpunkte NUR aus den vorhandenen Orten der Seite (lib/prozesse/adresse.ts): Landkarte (Bild, Ebene 1), Liste, Werkstatt (Übersicht) und — mit offenem
// eigenen Prozess — dessen Reiter Bauen · Läufe · Tests; „Vorlagen“ öffnet die Galerie „Aus Vorlage“, „Präsentieren“ den Modus der Seite. Stellschrauben
// haben keinen eigenen Ort (sie stehen unter dem Steckbrief eines System-Prozesses) — darum kein Punkt.
const ansichtIn = (k: WerkzeugKontext): ProzessAnsicht => {
  const a = prozesseAusAdresse(k.q);
  return a.modus === 'praesentieren' ? 'bild' : ansichtVorgabe(a.ansicht ?? null, k.handy);
};
/** Ein eigener Prozess der Werkstatt ist offen (nur die haben Läufe und Tests — System `sp-…`, Fulfillment `fp-…`/`fk-…` nicht). */
const eigenerProzess = (k: WerkzeugKontext): string | null => { const p = prozesseAusAdresse(k.q).p; return p && /^pz-/.test(p) ? p : null; };
const inWerkstatt = (k: WerkzeugKontext) => ansichtIn(k) === 'werkstatt';
const reiterIn = (k: WerkzeugKontext) => prozesseAusAdresse(k.q).w ?? 'bauen';

export const PROZESSE_WERKZEUG: Werkzeug = {
  id: 'prozesse',
  name: 'Prozesse',
  icon: Workflow,
  spaces: ['business'],
  pfade: ['/os/prozesse'],
  start: WEG.prozesse(),
  leistenPunkt: 'Prozesse',
  punkte: [
    { id: 'landkarte', label: 'Landkarte', icon: MapIcon, titel: 'Die Landkarte aller Prozesse — ein Klick fährt hinein', href: () => WEG.prozesse(), aktiv: k => ansichtIn(k) === 'bild' },
    { id: 'liste', label: 'Liste', icon: List, titel: 'Alle Prozesse als Liste', href: () => WEG.prozesse({ ansicht: 'liste' }), aktiv: k => ansichtIn(k) === 'liste' },
    {
      id: 'werkstatt', label: 'Werkstatt', icon: Hammer, titel: 'Prozesse bauen — Übersicht, „+ Prozess“', href: () => WEG.prozesse({ ansicht: 'werkstatt' }), aktiv: inWerkstatt,
      unter: [
        { id: 'bauen', label: 'Bauen', icon: PencilRuler, href: k => WEG.prozesse({ p: eigenerProzess(k) ?? undefined, ansicht: 'werkstatt' }), sichtbar: k => inWerkstatt(k) && !!eigenerProzess(k), aktiv: k => inWerkstatt(k) && reiterIn(k) === 'bauen' },
        { id: 'laeufe', label: 'Läufe', icon: History, titel: 'Jeder Lauf dieses Prozesses auf demselben Bild', href: k => WEG.prozesse({ p: eigenerProzess(k) ?? undefined, ansicht: 'werkstatt', w: 'laeufe' }), sichtbar: k => inWerkstatt(k) && !!eigenerProzess(k), aktiv: k => inWerkstatt(k) && reiterIn(k) === 'laeufe' },
        { id: 'tests', label: 'Tests', icon: FlaskConical, titel: 'Testfälle dieses Prozesses', href: k => WEG.prozesse({ p: eigenerProzess(k) ?? undefined, ansicht: 'werkstatt', w: 'tests' }), sichtbar: k => inWerkstatt(k) && !!eigenerProzess(k), aktiv: k => inWerkstatt(k) && reiterIn(k) === 'tests' },
      ],
    },
    // Am Handy wird nicht gebaut (Werkstatt unter 768 px nur ansehen) — die Galerie legt einen Prozess an, darum dort nicht.
    { id: 'vorlagen', label: 'Vorlagen', icon: LayoutTemplate, titel: 'Einen Prozess aus einer Vorlage anlegen', aktion: 'vorlagen', sichtbar: k => !k.handy },
  ],
  fuss: [
    { id: 'praesentieren', label: 'Präsentieren', icon: Presentation, titel: 'Präsentieren — Rahmen für Rahmen', aktion: 'praesentieren', sichtbar: k => !k.handy },
  ],
};

// ─── Markttraktion (das zweite Werkzeug, HubSpot-Art) ──────────────────────────────────────────────────────────────────────────────────────
// Die Punkte NUR aus `HUB_MENUE` (lib/crm/adresse.ts — Reihenfolge, Namen, Ziele, Gruppen; Symbole aus lib/crm/hub-symbole.ts): Überblick · CRM (Kontakte,
// Firmen) · Vertrieb (Leads & Qualifizierung, Deals, Angebote, Follow-up & Power Hour) · Marketing (Marketing, Events, Netzwerken) · Steuerung (Planung,
// Auswertung, „Automationen & Head“), Fuß Stammdaten. Welcher Punkt leuchtet, sagt NUR `hubOrtFuer` (auch auf der eigenen Seite Netzwerken). Die dritte
// Ebene (Board · Liste, Fällig · Woche …) bleibt als Reiter in der Seite — darum keine `unter`. Keine Aktionen: jeder Punkt ist eine Adresse.
const hubAn = (k: WerkzeugKontext): HubOrtId | null => hubOrtFuer(k.pfad, k.q.toString());
const hubPunkt = (p: HubPunkt, gruppe: string | null): WerkzeugPunkt => ({
  id: p.id, label: p.name, icon: HUB_SYMBOLE[p.symbol], titel: p.titel, href: () => p.ziel, aktiv: k => hubAn(k) === p.id, ...(gruppe ? { gruppe } : {}),
});
const hubAutomation = HUB_MENUE.automation;

export const MARKTTRAKTION_WERKZEUG: Werkzeug = {
  id: 'markttraktion',
  name: 'Markttraktion',
  icon: TrendingUp,
  spaces: ['business'],
  // Netzwerken (02.10.) ist eine eigene Seite, gehört aber zum Werkzeug — dort leuchtet „Netzwerken“.
  pfade: ['/os/markttraktion', '/os/netzwerken'],
  start: WEG.markttraktion(),
  leistenPunkt: 'Markttraktion',
  punkte: HUB_MENUE.gruppen.flatMap(g => g.punkte.map(p => hubPunkt(p, g.titel))),
  fuss: HUB_MENUE.fuss.map(p => hubPunkt(p, null)),
  automation: {
    bereiche: hubAutomation.prozessBereiche,
    head: hubAutomation.heads[0],
    weitereHeads: hubAutomation.heads.slice(1),
    href: () => hubAutomation.ziel,
    aktiv: k => hubAn(k) === hubAutomation.id,
    gruppe: HUB_MENUE.gruppen.find(g => g.id === hubAutomation.gruppe)?.titel ?? undefined,
  },
};

// ─── Produkte & Mandate (22.10. abends, Gruppe A — Entscheidung: „Ja, alle Empfehlungen“) ─────────────────────────────────────────────────────────────
// Kunden: Mandate · Angebot: Produkte · Fulfillment: Übersicht, Onboarding, Bausteine, Analysen, Kreislauf (Namen aus `FULFILLMENT_BEREICHE`) · „Automationen &
// Head“ (`?s=automationen`: Bereiche Übergabe · Fulfillment · Ausbau + die Prozesse der Produkte über `Leistung.prozessId`; Heads aus `SEITEN_REGELN` = Kundenerfolg,
// unter Produkte Sales). Die frühere Reiterzeile Mandate · Produkte · Fulfillment und die Unter-Reiter des Fulfillments ersetzt dieses Menü (Ebene 1); die dritte
// Ebene bleibt in der Seite (Mandat-Akte, Reiter des Falls, Knoten/Baustein/Editor, Linien-Pillen, Leistungstreppe). Ein Fall (`?m=`) und der Editor (`?e=`)
// gehören zur Übersicht des Fulfillments; alte Adressen (`u=visualisierung`, `r=ablauf` …) liest `fulfillmentAusAdresse`.
type PmOrt = 'mandate' | 'produkte' | 'automationen' | FulfillmentBereich;
const imFulfillment = (k: WerkzeugKontext) => k.pfad === FULFILLMENT_PFAD || k.pfad.startsWith(`${FULFILLMENT_PFAD}/`);
const pmOrt = (k: WerkzeugKontext): PmOrt => (imFulfillment(k) ? fulfillmentAusAdresse(k.q).u : mandateOrt(k.q.get('s')));
const FULFILLMENT_SYMBOL: Record<FulfillmentBereich, LucideIcon> = { prozesse: Route, onboarding: UserPlus, bausteine: Blocks, analysen: ChartColumn, kreislauf: RefreshCw };
const FULFILLMENT_TITEL: Record<FulfillmentBereich, string> = {
  prozesse: 'Heute im Fulfillment, Kunden in Lieferung, die Abläufe — ein Klick öffnet den Fall',
  onboarding: 'Unterschriebene Mandate ins Fulfillment holen',
  bausteine: 'Die Bausteine, aus denen die Abläufe bestehen',
  analysen: 'Analysen und Dossiers der Kunden',
  kreislauf: 'Nach der Leistung: Wirkung, Folgeangebot, Empfehlung',
};
const PM_PUNKTE: readonly WerkzeugPunkt[] = [
  { id: 'mandate', label: 'Mandate', icon: Briefcase, gruppe: 'Kunden', titel: 'Für wen wir gerade arbeiten — Laufzeit, Gesundheit, Umsatz', href: () => mandateLink('mandate'), aktiv: k => pmOrt(k) === 'mandate' },
  { id: 'produkte', label: 'Produkte', icon: Package, gruppe: 'Angebot', titel: 'Was wir anbieten — mit Preis, Ablauf und Unterlagen', href: () => mandateLink('produkte'), aktiv: k => pmOrt(k) === 'produkte' },
  ...FULFILLMENT_BEREICHE.map((b): WerkzeugPunkt => ({
    id: b.id === 'prozesse' ? 'fulfillment' : b.id, label: b.label, icon: FULFILLMENT_SYMBOL[b.id], gruppe: 'Fulfillment', titel: FULFILLMENT_TITEL[b.id],
    href: () => WEG.fulfillment(b.id), aktiv: k => imFulfillment(k) && pmOrt(k) === b.id,
  })),
];

export const PRODUKTE_WERKZEUG: Werkzeug = {
  id: 'produkte-mandate',
  name: 'Produkte & Mandate',
  icon: Briefcase,
  spaces: ['business'],
  pfade: [MANDATE_PFAD],
  start: mandateLink('mandate'),
  leistenPunkt: 'Produkte & Mandate',
  punkte: PM_PUNKTE,
  automation: automationMitHeads(mandateLink('mandate'), PM_PUNKTE, 'business', {
    bereiche: ['uebergabe', 'fulfillment', 'ausbau'],
    href: () => mandateLink('automationen'),
    aktiv: k => !imFulfillment(k) && pmOrt(k) === 'automationen',
  }),
};

// ─── Unternehmen (22.10. abends, Gruppe A) ─────────────────────────────────────────────────────────────────────────────────────────────────────
// Lage: Überblick · Pflichten & Fristen · Dokumente · Risiken · Marken & Versicherungen (Kennung `schutz`) · Akte: Struktur · Beschlüsse & Satzung · Verträge &
// Organe · Gesellschaften · „Automationen & Head“ (`?s=automationen`: Betroffenenrechte aus „Unterstützung“, Head of Recht aus `SEITEN_REGELN`) · Fuß: Archiv ·
// Papierkorb. Namen und Reihenfolge NUR aus lib/gesellschaften/schild/adresse.ts (dort liest auch die Seite, wo sie steht). Die gewählte Gesellschaft (`w`)
// wandert in die Reiter mit, die sie kennen (`MIT_WAHL`) — wie vorher die Reiterzeile. „Was ist passiert?“ bleibt der Knopf im Seitenkopf. Nur volle Mitglieder:
// ein Konto „nur Business“ sieht das Werkzeug nicht (der Server antwortet ihm mit 403).
const UNTERNEHMEN_SYMBOL: Record<SchildReiter, LucideIcon> = {
  ueberblick: Gauge, pflichten: CalendarClock, dokumente: FileText, risiken: TriangleAlert, schutz: ShieldCheck,
  struktur: Network, beschluesse: Gavel, vertraege: FileSignature, gesellschaften: Landmark,
};
const unternehmenPunkt = (r: { id: SchildReiter; label: string }, gruppe: string): WerkzeugPunkt => ({
  id: r.id, label: r.label, icon: UNTERNEHMEN_SYMBOL[r.id], gruppe,
  href: k => WEG.schild(r.id, MIT_WAHL.includes(r.id) ? k.q.get('w') ?? undefined : undefined),
  aktiv: k => unternehmenOrt(k.q) === r.id,
});
const UNTERNEHMEN_PUNKTE: readonly WerkzeugPunkt[] = [
  ...LAGE_REITER.map(r => unternehmenPunkt(r, 'Lage')),
  ...AKTE_REITER.map(r => unternehmenPunkt(r, 'Akte')),
];

export const UNTERNEHMEN_WERKZEUG: Werkzeug = {
  id: 'unternehmen',
  name: 'Unternehmen',
  icon: Building2,
  spaces: ['business'],
  pfade: ['/os/unternehmen'],
  start: WEG.schild(),
  leistenPunkt: 'Unternehmen',
  nurVolleMitglieder: true,
  punkte: UNTERNEHMEN_PUNKTE,
  fuss: UNTERNEHMEN_FILTER.filter(f => f.id !== 'liste').map((f): WerkzeugPunkt => ({
    id: f.id, label: f.label, icon: f.id === 'archiv' ? Archive : Trash2, titel: f.id === 'archiv' ? 'Ruhende und aufgelöste Gesellschaften' : 'Gelöschte Gesellschaften — endgültig nur ohne Verweise',
    href: () => WEG.schild('gesellschaften', undefined, f.id as 'archiv' | 'papierkorb'), aktiv: k => unternehmenOrt(k.q) === f.id,
  })),
  automation: automationMitHeads(WEG.schild(), UNTERNEHMEN_PUNKTE, 'business', {
    bereiche: [],
    prozesse: ['sp-betroffenenrechte'],
    href: () => WEG.schild('automationen'),
    aktiv: k => unternehmenOrt(k.q) === 'automationen',
  }),
};

// ─── Finanzen (22.10. abends, Gruppe A) — in Business UND Privat ───────────────────────────────────────────────────────────────────────────────
// Aufbau NUR in lib/finanzen/navigation.ts (`FINANZ_MENUE`, `FINANZ_FUSS`) — hier wird nichts aufgezählt. Business: Überblick (Cockpit, Controlling & Ziele) ·
// Geldfluss (Rechnungen & Zahlungen, Liquidität, Buchungen) · Planung & Pflichten (Planung, Steuern) · „Automationen & Head“ (= `s=chef`: Monatsabschluss und
// Rechnung, Head of Finance) · Fuß Einstellungen, 0-Punkt. Privat: Überblick · Konten & Buchungen · Planung · Steuern · „Automationen & Head“ (Head „Finanzen
// privat“, keine Prozesse) · Fuß Altbestand. Welcher Punkt leuchtet, sagt dieselbe Regel wie die Seite (`finanzOrt` → `finanzMenueId`); `?space=` steht in
// jedem Ziel. Konto „nur Business“: nur, was es benutzen kann (`finanzMenueErlaubt`).
const FINANZ_SYMBOL: Record<FinanzMenueId, LucideIcon> = {
  privat: Sun, konten: ListChecks, business: LayoutDashboard, controlling: Target, rechnungen: Receipt, liquiditaet: Waves, buchungen: BookOpen,
  finanzplanung: Calculator, steuern: Scale,
};
const FINANZ_FUSS_SYMBOL: Record<FinanzFussPunkt['id'], LucideIcon> = { einstellungen: Settings2, eroeffnung: Anchor, altbestand: PiggyBank };
/** Der Punkt, der an dieser Adresse leuchtet — wie die Seite: Bereich aus `?space=`/Reiter/Wahl, Punkte, die das Konto nicht hat, zählen als der erste. */
function finanzAn(k: WerkzeugKontext): FinanzMenueId | 'chef' {
  const ort = finanzOrt(k.q, { gemerkt: k.space, haushalt: k.nurBusiness ? false : null });
  const id = finanzMenueId(ort);
  if (id === 'chef') return id;
  const erlaubt = FINANZ_MENUE[ort.bereich].filter(m => finanzMenueErlaubt(m.id, { haushalt: !k.nurBusiness }));
  return erlaubt.some(m => m.id === id) ? id : erlaubt[0]?.id ?? 'business';
}
/** Der Bereich der Seite (Privat · Business) — dieselbe Regel wie die Seite. */
const finanzBereich = (k: WerkzeugKontext): FinanzBereich => finanzOrt(k.q, { gemerkt: k.space, haushalt: k.nurBusiness ? false : null }).bereich;
const FINANZ_PUNKTE: readonly WerkzeugPunkt[] = (['business', 'privat'] as const).flatMap(b => FINANZ_MENUE[b].map((m): WerkzeugPunkt => ({
  id: `${b}-${m.id}`, label: m.label, icon: FINANZ_SYMBOL[m.id], titel: m.titel, ...(m.gruppe ? { gruppe: m.gruppe } : {}),
  href: () => finanzAdresse(b, m.id === 'controlling' ? 'controlling' : m.id),
  sichtbar: k => finanzBereich(k) === b && finanzMenueErlaubt(m.id, { haushalt: !k.nurBusiness }),
  aktiv: k => finanzBereich(k) === b && finanzAn(k) === m.id,
})));

export const FINANZEN_WERKZEUG: Werkzeug = {
  id: 'finanzen',
  name: 'Finanzen',
  icon: Wallet,
  spaces: ['privat', 'business'],
  pfade: ['/os/finanzen'],
  start: finanzAdresse('business', 'business'),
  leistenPunkt: 'Finanzen',
  punkte: FINANZ_PUNKTE,
  fuss: (['business', 'privat'] as const).flatMap(b => FINANZ_FUSS[b].map((f): WerkzeugPunkt => ({
    id: f.id, label: f.label, icon: FINANZ_FUSS_SYMBOL[f.id], titel: f.titel, href: () => finanzFussAdresse(f.id),
    // Der Altbestand gehört Privat — ein Konto „nur Business“ hat ihn nicht.
    sichtbar: k => finanzBereich(k) === b && !(b === 'privat' && k.nurBusiness),
  }))),
  automation: (['business', 'privat'] as const).map(b => automationMitHeads(finanzAdresse(b, b), FINANZ_PUNKTE, b, {
    bereiche: [],
    ...(b === 'business' ? { prozesse: ['sp-monatsabschluss', 'sp-rechnung'] } : {}),
    href: () => finanzAdresse(b, 'chef'),
    aktiv: k => finanzAn(k) === 'chef',
  })),
};

/** Alle Werkzeuge — Prozesse und Markttraktion, dann die übrigen Bereiche. */
export const WERKZEUGE: readonly Werkzeug[] = [PROZESSE_WERKZEUG, MARKTTRAKTION_WERKZEUG, PRODUKTE_WERKZEUG, UNTERNEHMEN_WERKZEUG, FINANZEN_WERKZEUG];

/** Zu welchem Werkzeug gehört die Adresse? Höchstens eines (Wächter); sonst null. */
export function werkzeugFuer(pfad: string, suche = ''): Werkzeug | null {
  return WERKZEUGE.find(w => w.pfade.some(m => passtZu(pfad, suche, m))) ?? null;
}
/** Dasselbe für einen Link (Pfad mit Parametern). */
export const werkzeugVonHref = (href: string): Werkzeug | null => { const g = geteilt(href); return werkzeugFuer(g.pfad, g.suche); };

/** Der Kontext einer Adresse — `space` ohne Angabe wie die Wahl im Kopf (`?space=` gewinnt, sonst die Seite, sonst Business). */
export function werkzeugKontext(pfad: string, suche = '', handy = false, o: { space?: SpaceId; nurBusiness?: boolean } = {}): WerkzeugKontext {
  const nurBusiness = !!o.nurBusiness;
  return {
    pfad, q: new URLSearchParams(suche.startsWith('?') ? suche.slice(1) : suche), handy,
    space: nurBusiness ? 'business' : o.space ?? wahlVon(pfad, suche, SPACE_VORGABE), nurBusiness,
  };
}
/** Steht das Werkzeug für dieses Konto da? (Ein Werkzeug `nurVolleMitglieder` nicht für ein Konto „nur Business“ — wie sein Leistenpunkt.) */
export const werkzeugFuerKonto = (w: Werkzeug | null, nurBusiness: boolean | null | undefined): Werkzeug | null => (w && !(nurBusiness && w.nurVolleMitglieder) ? w : null);

/** Ein Unterpunkt, aufgelöst für die Anzeige: Ziel bzw. Aktion, leuchtet ja/nein, die sichtbaren Kinder, die Überschrift der Gruppe. */
export interface PunktAnsicht {
  id: string; label: string; icon: LucideIcon; titel: string;
  href: string | null; aktion: string | null; an: boolean;
  unter: PunktAnsicht[];
  gruppe?: string;
  /** Führt in einen anderen Bereich (Name) — im Menü mit ↗. */
  wechselt?: string;
}
const aufloesen = (p: WerkzeugPunkt, k: WerkzeugKontext, tiefe: number): PunktAnsicht => ({
  id: p.id, label: p.label, icon: p.icon, titel: p.titel ?? p.label, ...(p.gruppe ? { gruppe: p.gruppe } : {}), ...(p.wechselt ? { wechselt: p.wechselt } : {}),
  href: p.href ? p.href(k) : null, aktion: p.aktion ?? null, an: !!p.aktiv?.(k),
  // Höchstens zwei Ebenen: Kinder der Kinder fallen weg (die Konfiguration darf sie gar nicht erst tragen).
  unter: tiefe === 0 ? (p.unter ?? []).filter(u => u.sichtbar?.(k) ?? true).map(u => aufloesen(u, k, 1)) : [],
});
/** Der Standard-Unterpunkt „Automationen & Head“ eines Werkzeugs (aus `automation`) — oder null. */
export function automationPunkt(w: Werkzeug): WerkzeugPunkt | null {
  const alle = automationenVon(w);
  if (!alle.length) return null;
  const a = alle[0];
  // Nur eine Fassung für alle Spaces: wie bisher. Je Space eine: der Punkt steht nur, wo es eine gibt (in Privat nur, wo es einen Head gibt).
  if (alle.length === 1 && !a.spaces) {
    return { id: 'automationen', label: AUTOMATION_LABEL, icon: AUTOMATION_ICON, titel: AUTOMATION_TITEL, href: a.href, aktiv: a.aktiv, ...(a.gruppe ? { gruppe: a.gruppe } : {}) };
  }
  return {
    id: 'automationen', label: AUTOMATION_LABEL, icon: AUTOMATION_ICON, titel: AUTOMATION_TITEL, ...(a.gruppe ? { gruppe: a.gruppe } : {}),
    href: k => (automationVon(w, k.space) ?? a).href(k),
    aktiv: k => !!automationVon(w, k.space)?.aktiv(k),
    sichtbar: k => !!automationVon(w, k.space),
  };
}
/** Die Unterpunkte samt „Automationen & Head“ (in seiner Gruppe bzw. am Ende). */
export function alleUnterpunkte(w: Werkzeug): readonly WerkzeugPunkt[] {
  const a = automationPunkt(w);
  if (!a) return w.punkte;
  if (!a.gruppe) return [...w.punkte, a];
  const letzter = w.punkte.map(p => p.gruppe).lastIndexOf(a.gruppe);
  return letzter < 0 ? [...w.punkte, a] : [...w.punkte.slice(0, letzter + 1), a, ...w.punkte.slice(letzter + 1)];
}
/** Die sichtbaren Unterpunkte bzw. Fußpunkte des Werkzeugs an dieser Adresse. */
export function werkzeugPunkte(w: Werkzeug, k: WerkzeugKontext, teil: 'punkte' | 'fuss' = 'punkte'): PunktAnsicht[] {
  return (teil === 'punkte' ? alleUnterpunkte(w) : w.fuss ?? []).filter(p => p.sichtbar?.(k) ?? true).map(p => aufloesen(p, k, 0));
}

// ─── Werkzeugmodus = Vollbild (`voll=1`) ───────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Die Adresse mit bzw. ohne Vollbild — alle übrigen Parameter bleiben; ohne Vollbild fällt auch „Präsentieren“ weg (es schließt das Vollbild ein).
 * EINE Regel für Flächen und Werkzeuge (components/os/ui/flaeche/vollbild.ts reicht sie weiter).
 */
export function vollAdresse(pfad: string, suche: string, an: boolean): string {
  const q = new URLSearchParams(suche.startsWith('?') ? suche.slice(1) : suche);
  if (an) q.set('voll', '1');
  else { q.delete('voll'); q.delete('modus'); }
  const t = q.toString();
  return t ? `${pfad}?${t}` : pfad;
}
/** Ein Link im Werkzeugmodus: das Ziel bleibt im ganzen Bildschirm (Symbol-Leiste, Kopfzeile). */
export const imWerkzeugModus = (href: string): string => { const g = geteilt(href); return vollAdresse(g.pfad, g.suche, true); };

// ─── Aktionen und Rückweg (Ereignisse, die Seite bzw. die Leiste lauscht) ──────────────────────────────────────────────────────────────────

/** Eine Aktion eines Unterpunkts (z. B. „Vorlagen“): die Seite des Werkzeugs lauscht auf `make-werkzeug`. Synchron im Klick — Fullscreen braucht die Geste. */
export const WERKZEUG_EREIGNIS = 'make-werkzeug';
export interface WerkzeugAktion { werkzeug: string; aktion: string }
export function werkzeugAktion(werkzeug: string, aktion: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<WerkzeugAktion>(WERKZEUG_EREIGNIS, { detail: { werkzeug, aktion } }));
}
/**
 * „← MAKE OS“: die Leiste zeigt wieder die Punkte des Space — die Seite bleibt (ein ungespeicherter Entwurf geht nie verloren; jeder Punkt ist von dort
 * einen Klick entfernt, Heute der erste). Aus dem Werkzeugmodus heraus verlässt der Rahmen zuerst den ganzen Bildschirm.
 */
export const WERKZEUG_ZURUECK = 'make-werkzeug-zurueck';
export const zurUebersicht = (): void => { if (typeof window !== 'undefined') window.dispatchEvent(new Event(WERKZEUG_ZURUECK)); };
/** Beschriftung des Rückwegs (überall gleich). */
export const RUECKWEG_LABEL = 'MAKE OS';
export const RUECKWEG_TITEL = 'Zurück zur Leiste von MAKE OS — die Seite bleibt offen';
