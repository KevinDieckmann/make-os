// ─── MAKE OS — Zwei Spaces: Privat und Business (26.09., Malins Vorschlag) ──
// „Links zwei Spaces, jeweils in eigener Farbe. Tippt man einen an, klappt
// darunter sein Untermenü auf. Unten links gesondert ZOE und Brain, darunter
// System. Oben ein Suchfeld, das im aktiven Space sucht, daneben der Index des
// Space.“ Kevin: Markttraktion und Mandate unter Business; privat ein eigenes
// Kontaktbuch (Menschen); Gesundheit ist persönlich → Privat; Aufgaben in
// beiden. Zweite Fassung (26.09. abends, Kevin: „zu viele Einträge, vieles
// macht keinen Sinn“): sechs Punkte je Space, symmetrisch aufgebaut —
// Inbox und Kalender liegen im Kopf oben und folgen dem aktiven Space.
//
// Ein Space ist eine Sicht: Aufgaben, Ziele, Termine, Postfächer tragen ihren
// Space (lib/make-one/space-regeln.ts); Heute und ZOE sehen beides.

//
// Aufräumen Etappe 1 (08.10., Kevin: „Die Software wirkt unaufgeräumt und überladen, ich weiß gar nicht mehr wo alles ist“):
// EINE Leiste je Space mit höchstens zwölf Punkten — Heute · Inbox · Kalender · Aufgaben · Planung · Finanzen · zwei Bereiche
// des Space · Kontakte · ZOE. Der Space wird oben im Kopf gewählt (Privat | Business), die Leiste zeigt nur seine Punkte.
// `passt` legt den Space fest (Muster mit Parametern), `auch` hebt nur hervor (gemeinsame Seiten ohne Space — Inbox, Kalender,
// Heute, ZOE …). Unten: Einstellungen (/os/system), „Problem oder Idee melden“, Konto.
//
// Nur noch zwei Bereiche (09.10., Kevin: „Oben der Knopf ‚Alles‘ kann raus — es gibt nur Business oder Privat. Und die Zeit wird
// jedes Mal im Hintergrund gemessen, und dann sehen wir das Ganze.“): Die Wahl im Kopf ist IMMER Privat oder Business — die
// Nachbesserung vom 08.10. („Alles“ als dritter Knopf mit eigener Leiste) ist zurückgenommen. Man ist immer in genau einem Bereich,
// dadurch ordnet die Zeitmessung jede Minute eindeutig zu; „das Ganze“ zeigt die Zeit-Karte auf Heute (Privat gegen Business).
// Alte Adressen mit `?space=alles` und ein gemerktes „alles“ gelten als „kein Parameter“ bzw. „der zuletzt konkrete Space“.

import type { LucideIcon } from 'lucide-react';
import { Home, Briefcase, Wallet, Target, ListChecks, HeartPulse, Users, TrendingUp, Sparkles, Sun, Inbox, CalendarDays, Building2, Workflow } from 'lucide-react';
import { SPACE_FARBE, type SpaceId } from './space-regeln';

export type { SpaceId };
/** Die Wahl im Kopf — seit 09.10. genau ein Bereich (Privat · Business), nie mehr „alles“. Name bleibt für die Aufrufer. */
export type SpaceWahl = SpaceId;
export const SPACE_WAHLEN: readonly SpaceWahl[] = ['privat', 'business'];
export const istSpaceWahl = (v: unknown): v is SpaceWahl => v === 'privat' || v === 'business';
/** Ohne Merker (neue Instanz, gelöschter Browser-Speicher, alter Merker „alles“ ohne zuletzt konkreten Space): Business. */
export const SPACE_VORGABE: SpaceId = 'business';
export interface SpaceEintrag {
  href: string; label: string; icon: LucideIcon;
  /** Muster, die den Space festlegen (aktiverSpaceEintrag, spaceVonAdresse). */
  passt: string[];
  /** Muster, die den Punkt nur hervorheben — gemeinsame Seiten ohne eigenen Space. */
  auch?: string[];
  /** Fester Schlüssel für die Zeitmessung, wenn der Name sich geändert hat (gespeicherte Zeit bleibt beim alten Schlüssel). */
  zeitId?: string;
  /**
   * Nur für volle Mitglieder des Haushalts — ein Konto „nur Business“ (`finanzRecht: 'business'`) bekommt den Bereich serverseitig nicht
   * (403, z. B. das Gesellschafts-Register), darum steht der Punkt für es gar nicht erst in der Leiste (Gesamtprüfung 12.10.).
   */
  nurVolleMitglieder?: true;
}
export interface Space {
  id: SpaceId; label: string; farbe: string; icon: LucideIcon; start: string;
  eintraege: SpaceEintrag[];
  suche: string;
}

/** Heute, Inbox, Kalender — in beiden Spaces vorn, der Space wandert als Parameter mit. */
const vorn = (s: SpaceId): SpaceEintrag[] => [
  // „=/os“ = genau die Startseite (nicht jede Unterseite von /os).
  { href: `/os?space=${s}`, label: 'Heute', icon: Sun, passt: [], auch: ['=/os'] },
  { href: `/os/inbox?space=${s}`, label: 'Inbox', icon: Inbox, passt: [`/os/inbox?space=${s}`], auch: ['/os/inbox'] },
  // K5 (29.09.): EIN Kalender — Planen ist dort ein Modus.
  { href: `/os/kalender?space=${s}`, label: 'Kalender', icon: CalendarDays, passt: [`/os/kalender?space=${s}`], auch: ['/os/kalender', '/os/planung/woche'] },
  { href: `/os/aufgaben?space=${s}`, label: 'Aufgaben', icon: ListChecks, passt: [`/os/aufgaben?space=${s}`, `/os/aufgaben?bereich=${s}`], auch: ['/os/aufgaben'] },
  // Planung: Ziele, Horizonte, Routinen, Kapazität — nur Planung (10.10.). Fokus, Prioritäten, Zeit und Wirkung sind die Fokus-Seite oben
  // rechts im Kopf (KOPF_SEITEN) — sie gehört zu keinem Punkt der Leiste und folgt dem Schalter.
  { href: `/os/planung/jahr?space=${s}`, label: 'Planung', icon: Target, zeitId: 'ziele-planung', passt: [`/os/planung?space=${s}`], auch: ['/os/planung'] },
];

/** ZOE — gemeinsam für beide Spaces: Freigaben, Agenten (mit Research, Content, Meeting, Board, Prospecting), Loops, Brain. */
export const ZOE_EINTRAG: SpaceEintrag = {
  href: '/os/stapel', label: 'ZOE', icon: Sparkles, passt: [],
  auch: ['/zoe', '/os/stapel', '/os/agenten', '/os/loop', '/os/wissen', '/os/research', '/os/content', '/os/meeting', '/os/board', '/os/prospecting'],
};

/**
 * Die Bereiche unter ZOE — Brain ist der Name des Wissens, die Adresse bleibt /os/wissen. Seit 22.10. abends zeigt sie das Werkzeug-Menü ZOE
 * (lib/make-one/werkzeuge.ts `ZOE_WERKZEUG`, die frühere Reiterzeile `ZoeReiter` ist weg); die Liste bleibt die Grundlage für Wächter und Einstellungen.
 */
export const ZOE_BEREICH: { href: string; label: string; passt: string[] }[] = [
  { href: '/os/stapel', label: 'Freigaben', passt: ['/os/stapel'] },
  { href: '/os/agenten', label: 'Agenten', passt: ['/os/agenten', '/os/research', '/os/content', '/os/meeting', '/os/board', '/os/prospecting'] },
  { href: '/os/loop', label: 'Loops', passt: ['/os/loop'] },
  { href: '/os/wissen', label: 'Brain', passt: ['/os/wissen'] },
  { href: '/zoe', label: 'Empfang', passt: ['/zoe'] },
];

export const SPACES: Space[] = [
  {
    id: 'privat', label: 'Privat', farbe: SPACE_FARBE.privat, icon: Home, start: '/os?space=privat',
    suche: 'In Privat suchen: Familie, Gesundheit, Finanzen',
    eintraege: [
      ...vorn('privat'),
      { href: '/os/finanzen?s=privat', label: 'Finanzen', icon: Wallet, passt: ['/os/finanzen?space=privat', '/os/finanzen?s=privat', '/os/finanzen?s=gesamt'], auch: ['/os/finanzen'] },
      { href: '/os/gesundheit', label: 'Gesundheit', icon: HeartPulse, passt: ['/os/gesundheit', '/os/sport', '/os/journal', '/os/ernaehrung', '/os/ritual', '/os/energie', '/os/tageslauf'] },
      // Kontakte privat (/os/menschen) ist seit 22.10. abends ein Punkt im Werkzeug Familie (lib/make-one/werkzeuge.ts) statt eines eigenen Leistenpunkts —
      // die Adresse gehört weiter zu Privat und leuchtet unter Familie; die Zeit zählt weiter unter `kontakte` (lib/zeitmessung/bereich.ts).
      { href: '/os/familie', label: 'Familie', icon: Users, passt: ['/os/familie', '/os/menschen'] },
    ],
  },
  {
    id: 'business', label: 'Business', farbe: SPACE_FARBE.business, icon: Briefcase, start: '/os?space=business',
    suche: 'In Business suchen: Rechnungen, Mandate, Kontakte',
    eintraege: [
      ...vorn('business'),
      { href: '/os/finanzen?s=business', label: 'Finanzen', icon: Wallet, passt: ['/os/finanzen?space=business', '/os/finanzen?s=business', '/os/finanzen?s=controlling', '/os/finanzen?s=rechnungen', '/os/finanzen?s=liquiditaet', '/os/finanzen?s=buchungen', '/os/finanzen?s=steuern', '/os/finanzen?s=chef'], auch: ['/os/finanzen'] },
      { href: '/os/markttraktion', label: 'Markttraktion', icon: TrendingUp, passt: ['/os/markttraktion', '/os/crm'] },
      // Produkte & Mandate und Unternehmen (10.10., Entscheidung: getrennt, Unternehmen eigener Punkt und eigener Ausbau). Kontakte stehen im
      // Business nicht mehr in der Leiste (Entscheidung 10.10.) — die Kartei liegt in Markttraktion › Kontakte & Firmen; `zeitId` bleibt für die Zeitmessung.
      { href: '/os/mandate', label: 'Produkte & Mandate', icon: Briefcase, zeitId: 'mandate', passt: ['/os/mandate'] },
      // Prozesse (21.10., Kevin: „Leistenpunkt ‚Prozesse‘ mit Vollbild“): die Landkarte aller Abläufe von Marketing bis Fulfillment.
      { href: '/os/prozesse', label: 'Prozesse', icon: Workflow, passt: ['/os/prozesse'] },
      { href: '/os/unternehmen', label: 'Unternehmen', icon: Building2, passt: ['/os/unternehmen'], nurVolleMitglieder: true },
    ],
  },
];

/** Die Leiste eines Space: seine Punkte, dann ZOE (gemeinsam für beide). `nurBusiness`: ohne Punkte `nurVolleMitglieder`. */
export const leisteFuer = (id: SpaceWahl, nurBusiness = false): SpaceEintrag[] =>
  [...spaceVon(id).eintraege.filter(e => !(nurBusiness && e.nurVolleMitglieder)), ZOE_EINTRAG];

/**
 * Passt eine Adresse zu einem Muster? Pfad: gleich oder Unterpfad („/os/planung“
 * trifft „/os/planung/woche“). Muster mit „?“: alle genannten Parameter müssen
 * in der Adresse stehen („/os/aufgaben?space=privat“ trifft auch „/os/aufgaben/board?space=privat&offen=…“).
 */
export function passtZu(pfad: string, suche: string, muster: string): boolean {
  const genau = muster.startsWith('=');
  const [mp, mq] = (genau ? muster.slice(1) : muster).split('?');
  const pfadOk = genau ? pfad === mp : mp.endsWith('/') ? pfad.startsWith(mp) : pfad === mp || pfad.startsWith(`${mp}/`);
  if (!pfadOk) return false;
  if (!mq) return true;
  const q = new URLSearchParams(suche.startsWith('?') ? suche.slice(1) : suche);
  return Array.from(new URLSearchParams(mq).entries()).every(([k, v]) => q.get(k) === v);
}

/**
 * Welcher Eintrag ist „aktiv“ — das genaueste Muster über alle Spaces und ZOE. `passt` legt den Space fest, `auch` nur den
 * Eintrag (Space null); bei gleicher Länge gewinnt `passt`.
 */
export function aktiverSpaceEintrag(pfad: string, suche = ''): { space: SpaceId | null; eintrag: SpaceEintrag | null } {
  const treffer: { space: SpaceId | null; eintrag: SpaceEintrag; l: number }[] = [];
  const pruefe = (space: SpaceId | null, e: SpaceEintrag) => {
    if (space) for (const m of e.passt) if (passtZu(pfad, suche, m)) treffer.push({ space, eintrag: e, l: m.length + 0.5 });
    for (const m of e.auch ?? []) if (passtZu(pfad, suche, m)) treffer.push({ space: null, eintrag: e, l: m.length });
  };
  for (const s of SPACES) for (const e of s.eintraege) pruefe(s.id, e);
  pruefe(null, ZOE_EINTRAG);
  treffer.sort((x, y) => y.l - x.l);
  return treffer.length ? { space: treffer[0].space, eintrag: treffer[0].eintrag } : { space: null, eintrag: null };
}

/** Welcher Punkt der Leiste eines Space leuchtet — das genaueste Muster (passt oder auch) unter seinen Punkten. */
export function aktiverLeistenPunkt(id: SpaceWahl, pfad: string, suche = ''): SpaceEintrag | null {
  let best: { e: SpaceEintrag; l: number } | null = null;
  for (const e of leisteFuer(id)) for (const m of [...e.passt, ...(e.auch ?? [])]) {
    if (passtZu(pfad, suche, m) && (!best || m.length > best.l)) best = { e, l: m.length };
  }
  return best?.e ?? null;
}

/** Der Space aus der Adresse: ?space=… gewinnt, sonst der Eintrag, sonst null (gemeinsame Seite). */
export function spaceVonAdresse(pfad: string, suche = ''): SpaceId | null {
  const q = new URLSearchParams(suche.startsWith('?') ? suche.slice(1) : suche).get('space');
  if (q === 'privat' || q === 'business') return q;
  return aktiverSpaceEintrag(pfad, suche).space;
}

/** Die Wahl aus dem Parameter `space` allein (privat · business), sonst null — ein altes `?space=alles` zählt wie kein Parameter. */
export function wahlAusParameter(suche = ''): SpaceWahl | null {
  const q = new URLSearchParams(suche.startsWith('?') ? suche.slice(1) : suche).get('space');
  return istSpaceWahl(q) ? q : null;
}

/**
 * Die wirksame Wahl (seit 09.10. immer ein Space): `?space=privat|business` gewinnt, sonst legt die Seite den Space fest
 * (Gesundheit → Privat, Markttraktion → Business …), sonst gilt der gemerkte. `?space=alles` (alte Links, Lesezeichen) zählt nicht.
 * Ein Konto „nur Business“ (15.10., Abnahme 2 B8) ist IMMER in Business — auch mit `?space=privat` oder auf einer Privat-Seite (die leitet
 * ohnehin um, lib/zugang/privat-seite.ts); vorher gewann die Adresse und öffnete die Leiste PRIVAT.
 */
export function wahlVon(pfad: string, suche: string, gemerkt: SpaceWahl, nurBusiness = false): SpaceWahl {
  if (nurBusiness) return 'business';
  return wahlAusParameter(suche) ?? aktiverSpaceEintrag(pfad, suche).space ?? gemerkt;
}

/**
 * Der gemerkte Space aus den beiden Merkern (rein, getestet): `make-space` = privat|business gewinnt; ein altes „alles“ (oder
 * nichts) nimmt den zuletzt konkreten (`make-space-zuletzt`), sonst die Vorgabe Business. Ein Konto „nur Business“ ist immer
 * Business (der Server liefert ihm unter Privat nichts aus dem Haushalt).
 */
export function gemerkteWahlAus(merker: string | null | undefined, zuletzt: string | null | undefined, nurBusiness = false): SpaceWahl {
  if (nurBusiness) return 'business';
  if (istSpaceWahl(merker)) return merker;
  if (istSpaceWahl(zuletzt)) return zuletzt;
  return SPACE_VORGABE;
}

/** Steht noch das alte `?space=alles` in der Adresse (Links und Lesezeichen aus der Zeit mit drei Knöpfen, 08.10.)? */
export const altesAlles = (suche = ''): boolean => new URLSearchParams(suche.startsWith('?') ? suche.slice(1) : suche).get('space') === 'alles';

/**
 * Die Adresse ohne das alte `?space=alles` (09.10.): der Parameter wird auf den wirksamen Space gesetzt, alle anderen bleiben in
 * ihrer Reihenfolge. Ohne `space=alles` → null (nichts umschreiben). Der Kopf ersetzt die Adresse damit (replace, kein Verlaufseintrag).
 */
export function adresseOhneAlles(pfad: string, suche: string, wahl: SpaceWahl): string | null {
  if (!altesAlles(suche)) return null;
  const q = new URLSearchParams(suche.startsWith('?') ? suche.slice(1) : suche);
  q.set('space', wahl);
  return `${pfad}?${q.toString()}`;
}

export const spaceVon = (id: SpaceId): Space => SPACES.find(s => s.id === id) ?? SPACES[0];
/** Merker der Wahl im Kopf (`privat` | `business`; ein Stand vom 08.10. kann noch `alles` tragen — gilt dann `make-space-zuletzt`). */
export const SPACE_MERKER = 'make-space';
/** Der zuletzt konkrete Space — Rückfall für einen alten Merker „alles“; wird mit `make-space` gleich gehalten. */
export const SPACE_ZULETZT_MERKER = 'make-space-zuletzt';
export const SPACE_EREIGNIS = 'make-space-gewechselt';

/**
 * Wohin der Schalter im Kopf führt (08.10.): steht man auf einem Punkt der Leiste, der im anderen Space ein Gegenstück gleichen
 * Namens hat (Heute, Inbox, Kalender, Aufgaben, Planung, Finanzen, Kontakte), geht es dorthin; trifft die Seite den Punkt des
 * neuen Space schon (z. B. Finanzen › Gesamt unter Privat), bleibt man stehen (null). Eine Seite eines Space ohne Gegenstück
 * führt zu Heute des neuen Space. Gemeinsame Seiten (Konto, Einstellungen, ZOE …) bleiben stehen (null).
 */
/**
 * Seiten, die der Kopf öffnet und die dem Schalter folgen, ohne Punkt der Leiste (10.10.: die Fokus-Seite). Der Schalter bleibt dort stehen;
 * trägt die Adresse ein `?space=`, wird nur dieser Parameter umgeschrieben (sonst gewönne die Adresse gegen die neue Wahl).
 */
export const KOPF_SEITEN: readonly string[] = ['/os/fokus'];

export function wechselZiel(pfad: string, suche: string, nach: SpaceWahl): string | null {
  if (KOPF_SEITEN.some(k => pfad === k || pfad.startsWith(`${k}/`))) {
    const param = wahlAusParameter(suche);
    if (!param || param === nach) return null;
    const q = new URLSearchParams(suche.startsWith('?') ? suche.slice(1) : suche);
    q.set('space', nach);
    return `${pfad}?${q.toString()}`;
  }
  const reihe: SpaceWahl[] = [...SPACE_WAHLEN.filter(w => w !== nach), nach];
  let punkt: SpaceEintrag | null = null;
  for (const w of reihe) { punkt = aktiverLeistenPunkt(w, pfad, suche); if (punkt) break; }
  const start = spaceVon(nach).start;
  if (!punkt || punkt === ZOE_EINTRAG) return spaceVonAdresse(pfad, suche) ? start : null;
  const ziel = leisteFuer(nach).find(e => e.label === punkt!.label);
  if (!ziel) return start;
  // Schon da (die Seite trifft den Punkt der neuen Wahl) und kein widersprechender ?space= → stehen bleiben, nur die Wahl wechselt.
  const param = wahlAusParameter(suche);
  const schonDa = ziel.passt.some(m => passtZu(pfad, suche, m)) || passtZu(pfad, suche, ziel.href);
  if (schonDa && (!param || param === nach)) return null;
  return ziel.href;
}
