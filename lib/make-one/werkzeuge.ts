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
// Werkzeuge heute: Prozesse (Miro-Art) und Markttraktion (HubSpot-Art, Gruppen-Überschriften, Punkte aus `HUB_MENUE`).
// Ein neues Werkzeug = ein Eintrag in `WERKZEUGE` + die Seite hört seine Aktionen (bzw. hängt den Rahmen ein); nichts in der Leiste ändern.
// Gruppe B (22.10. abends — Kalender, Inbox, Aufgaben, Gesundheit, Familie, ZOE; Entscheidung: „Ja, alle Empfehlungen“) bringt zwei Bausteine dazu:
//   · `liste`    Unterpunkte aus den Daten der Person (Bereiche der Inbox, Spaces der Aufgaben): die Seite legt Kennung + Name ab (`werkzeugListeSetzen`,
//                components/os/werkzeug/listen.ts — nie Inhalte, nur was ihre serverseitig gefilterte Antwort schon trägt), die Konfiguration sagt Ziel und Regel
//   · `spalte`   das Werkzeug bringt eine eigene linke Spalte mit (Kalender: Mini-Monat, Kalender, Planen-Bausteine) — breit steht sie IN der Leiste unter dem
//                Menü (EINE Spalte, components/os/werkzeug/spalte.tsx), schmal wie bisher auf der Seite

import type { LucideIcon } from 'lucide-react';
import {
  Workflow, Map as MapIcon, List, Hammer, PencilRuler, History, FlaskConical, LayoutTemplate, Presentation, Bot, TrendingUp,
  CalendarDays, Blocks, ListChecks, Settings2, Inbox, Layers, Mailbox, LayoutGrid, FolderKanban, ChartGantt, Archive, Sun, Sunrise, NotebookPen, Dumbbell,
  BatteryCharging, PersonStanding, Salad, Gauge, ChartLine, HeartPulse, Heart, Users, Shield, BookUser, Sparkles, CheckCheck, Microscope, PenLine, Mic,
  Radar, Repeat, Brain,
} from 'lucide-react';
import { WEG } from '@/lib/wege';
import { prozesseAusAdresse } from '@/lib/prozesse/adresse';
import { ansichtVorgabe, type ProzessAnsicht } from '@/lib/prozesse/typen';
import { HUB_MENUE, hubOrtFuer, type HubPunkt, type HubOrtId } from '@/lib/crm/adresse';
import { HUB_SYMBOLE } from '@/lib/crm/hub-symbole';
import { kontextHeadFuer } from '@/lib/agenten/kontext-head';
import { adresseLesen as aufgabenAdresseLesen, aufgabenLink } from '@/lib/aufgaben/adresse';
import { kalenderLink, modusAusAdresse } from '@/lib/kalender/modus';
import { passtZu, wahlVon, SPACE_VORGABE } from './spaces';
import type { SpaceId } from './space-regeln';

/**
 * Wo man gerade steht — aus der Adresse (und ob es das Handy-Blatt ist: dort gelten die Vorgaben des Handys). `space` = die Wahl im Kopf (Leiste) bzw. was die
 * Adresse sagt (`?space=` gewinnt, sonst die Seite, sonst Business); `nurBusiness` = ein Konto „nur Business“ (der Server liefert ihm nichts Privates — das
 * Menü zeigt ihm, was es benutzen kann). `listen` = die Einträge, die die Seite zur Laufzeit abgelegt hat (Punkte mit `liste`); ohne: keine solchen Punkte.
 */
export interface WerkzeugKontext { pfad: string; q: URLSearchParams; handy: boolean; space: SpaceId; nurBusiness: boolean; listen?: WerkzeugListen }

/**
 * Ein Eintrag einer Liste, die eine Seite zur Laufzeit liefert (Bereiche der Inbox, Spaces der Aufgaben) — nur Kennung, Name und Merkmale für die Regel
 * (Bereich, Archiv, Zähler); nie Inhalte. Kommt aus der serverseitig gefilterten Antwort der Seite (sie zeigt nur, was die Sicht sehen darf).
 */
export interface ListenEintrag { id: string; label: string; bereich?: SpaceId; archiv?: boolean; zahl?: number }
export type WerkzeugListen = Readonly<Record<string, readonly ListenEintrag[]>>;
/** Ein Unterpunkt je Eintrag einer Liste (statt eines festen Punkts): Ziel, Regel „leuchtet“ und „steht da“ je Eintrag. */
export interface WerkzeugListe {
  /** Unter welchem Schlüssel die Seite die Einträge ablegt (components/os/werkzeug/listen.ts). */
  schluessel: string;
  href: (k: WerkzeugKontext, e: ListenEintrag) => string;
  aktiv: (k: WerkzeugKontext, e: ListenEintrag) => boolean;
  sichtbar?: (k: WerkzeugKontext, e: ListenEintrag) => boolean;
}

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
  /** Statt EINES Punkts: je Eintrag einer Liste der Seite ein Punkt (Symbol, Gruppe und Titel von hier). Ohne Einträge steht nichts da. */
  liste?: WerkzeugListe;
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
  /**
   * Das Werkzeug bringt eine eigene linke Spalte mit (Kalender): breit steht sie in der Leiste unter dem Menü (EINE Spalte — nie zwei linke Spalten nebeneinander,
   * components/os/werkzeug/spalte.tsx), die Leiste wird dafür breiter; schmal und mit eingeklappter Leiste legt die Seite sie selbst hin.
   */
  spalte?: true;
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
/** Die Ziele der Punkte eines Werkzeugs an seinem Einstieg in einem Space (für `headsDerSeiten`) — ohne Punkte aus Listen der Seite. */
function zieleIm(start: string, punkte: readonly WerkzeugPunkt[], space: SpaceId): string[] {
  const g = geteilt(start);
  const k = werkzeugKontext(g.pfad, g.suche, false, { space });
  return [start, ...punkte.flatMap(p => [p, ...(p.unter ?? [])]).filter(p => (p.sichtbar?.(k) ?? true) && p.href).map(p => p.href!(k))];
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

/** Alle Werkzeuge — Prozesse und Markttraktion, dann die übrigen Bereiche. */
export const WERKZEUGE: readonly Werkzeug[] = [PROZESSE_WERKZEUG, MARKTTRAKTION_WERKZEUG];

/** Zu welchem Werkzeug gehört die Adresse? Höchstens eines (Wächter); sonst null. */
export function werkzeugFuer(pfad: string, suche = ''): Werkzeug | null {
  return WERKZEUGE.find(w => w.pfade.some(m => passtZu(pfad, suche, m))) ?? null;
}
/** Dasselbe für einen Link (Pfad mit Parametern). */
export const werkzeugVonHref = (href: string): Werkzeug | null => { const g = geteilt(href); return werkzeugFuer(g.pfad, g.suche); };

/** Ein Werkzeug „nur volle Mitglieder“ steht für ein Konto „nur Business“ nicht da (wie sein Leistenpunkt). */
export const werkzeugFuerKonto = (w: Werkzeug | null, nurBusiness: boolean | null | undefined): Werkzeug | null => (w && w.nurVolleMitglieder && nurBusiness === true ? null : w);

/** Der Kontext einer Adresse — `space` ohne Angabe wie die Wahl im Kopf (`?space=` gewinnt, sonst die Seite, sonst Business). */
export function werkzeugKontext(pfad: string, suche = '', handy = false, o: { space?: SpaceId; nurBusiness?: boolean; listen?: WerkzeugListen } = {}): WerkzeugKontext {
  const nurBusiness = !!o.nurBusiness;
  return {
    pfad, q: new URLSearchParams(suche.startsWith('?') ? suche.slice(1) : suche), handy, nurBusiness,
    space: o.space ?? wahlVon(pfad, suche, SPACE_VORGABE, nurBusiness), ...(o.listen ? { listen: o.listen } : {}),
  };
}

/** Ein Unterpunkt, aufgelöst für die Anzeige: Ziel bzw. Aktion, leuchtet ja/nein, die sichtbaren Kinder, die Überschrift der Gruppe. */
export interface PunktAnsicht {
  id: string; label: string; icon: LucideIcon; titel: string;
  href: string | null; aktion: string | null; an: boolean;
  unter: PunktAnsicht[];
  gruppe?: string;
  /** Kleine Zahl hinter dem Namen (z. B. ungelesen bzw. offen) — nur bei Punkten aus einer Liste der Seite. */
  zahl?: number;
}
const aufloesen = (p: WerkzeugPunkt, k: WerkzeugKontext, tiefe: number): PunktAnsicht => ({
  id: p.id, label: p.label, icon: p.icon, titel: p.titel ?? p.label, ...(p.gruppe ? { gruppe: p.gruppe } : {}),
  href: p.href ? p.href(k) : null, aktion: p.aktion ?? null, an: !!p.aktiv?.(k),
  // Höchstens zwei Ebenen: Kinder der Kinder fallen weg (die Konfiguration darf sie gar nicht erst tragen).
  unter: tiefe === 0 ? (p.unter ?? []).filter(u => u.sichtbar?.(k) ?? true).flatMap(u => aufloesenAlle(u, k, 1)) : [],
});
/** Ein Punkt mit `liste` wird zu je einem Punkt für jeden (sichtbaren) Eintrag der Seite; Kennung `<punkt>:<eintrag>`. */
function aufloesenAlle(p: WerkzeugPunkt, k: WerkzeugKontext, tiefe: number): PunktAnsicht[] {
  const l = p.liste;
  if (!l) return [aufloesen(p, k, tiefe)];
  return (k.listen?.[l.schluessel] ?? []).filter(e => l.sichtbar?.(k, e) ?? true).map(e => ({
    id: `${p.id}:${e.id}`, label: e.label, icon: p.icon, titel: e.label, ...(p.gruppe ? { gruppe: p.gruppe } : {}),
    href: l.href(k, e), aktion: null, an: l.aktiv(k, e), unter: [], ...(e.zahl ? { zahl: e.zahl } : {}),
  }));
}
/**
 * Der Standard-Unterpunkt „Automationen & Head“ eines Werkzeugs (aus `automation`) — oder null. Je Space die passende Fassung (`automationVon`): in einem Space
 * ohne Fassung steht der Punkt nicht da.
 */
export function automationPunkt(w: Werkzeug): WerkzeugPunkt | null {
  const alle = automationenVon(w);
  if (!alle.length) return null;
  const gruppe = alle[0].gruppe;
  return {
    id: 'automationen', label: AUTOMATION_LABEL, icon: AUTOMATION_ICON, titel: 'Die Prozesse dieses Bereichs bauen und steuern — mit seinem Head',
    href: k => automationVon(w, k.space)?.href(k) ?? w.start, aktiv: k => !!automationVon(w, k.space)?.aktiv(k), sichtbar: k => !!automationVon(w, k.space),
    ...(gruppe ? { gruppe } : {}),
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
  return (teil === 'punkte' ? alleUnterpunkte(w) : w.fuss ?? []).filter(p => p.sichtbar?.(k) ?? true).flatMap(p => aufloesenAlle(p, k, 0));
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
