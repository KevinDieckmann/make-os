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

import type { LucideIcon } from 'lucide-react';
import { Home, Briefcase, Wallet, Target, ListChecks, HeartPulse, Users, BookUser, TrendingUp, Sparkles, Sun, Inbox, CalendarDays, LayoutGrid } from 'lucide-react';
import { SPACE_FARBE, type SpaceId } from './space-regeln';
import { FARBE } from './design';

export type { SpaceId };
/** Die Wahl im Kopf: beide Bereiche („alles“) oder ein Space. */
export type SpaceWahl = 'alles' | SpaceId;
export const SPACE_WAHLEN: readonly SpaceWahl[] = ['alles', 'privat', 'business'];
export const istSpaceWahl = (v: unknown): v is SpaceWahl => v === 'alles' || v === 'privat' || v === 'business';
export interface SpaceEintrag {
  href: string; label: string; icon: LucideIcon;
  /** Muster, die den Space festlegen (aktiverSpaceEintrag, spaceVonAdresse). */
  passt: string[];
  /** Muster, die den Punkt nur hervorheben — gemeinsame Seiten ohne eigenen Space. */
  auch?: string[];
  /** Fester Schlüssel für die Zeitmessung, wenn der Name sich geändert hat (gespeicherte Zeit bleibt beim alten Schlüssel). */
  zeitId?: string;
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
  // Planung: Ziele, Horizonte, Routinen, Kapazität — Fokus, Kompass und Wachstum sind Einstiege darin (PlanerLeiste).
  { href: `/os/planung/jahr?space=${s}`, label: 'Planung', icon: Target, zeitId: 'ziele-planung', passt: [`/os/planung?space=${s}`, `/os/fokus?space=${s}`, `/os/kompass?space=${s}`], auch: ['/os/planung', '/os/fokus', '/os/kompass', '/os/wachstum', '/os/saeule'] },
];

/** ZOE — gemeinsam für beide Spaces: Freigaben, Agenten (mit Research, Content, Meeting, Board, Prospecting), Loops, Brain. */
export const ZOE_EINTRAG: SpaceEintrag = {
  href: '/os/stapel', label: 'ZOE', icon: Sparkles, passt: [],
  auch: ['/zoe', '/os/stapel', '/os/agenten', '/os/loop', '/os/wissen', '/os/research', '/os/content', '/os/meeting', '/os/board', '/os/prospecting'],
};

/** Die Reiter unter ZOE (components/os/ZoeReiter.tsx) — Brain ist der Name des Wissens, die Adresse bleibt /os/wissen. */
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
      { href: '/os/familie', label: 'Familie', icon: Users, passt: ['/os/familie'] },
      { href: '/os/menschen', label: 'Kontakte', icon: BookUser, passt: ['/os/menschen'] },
    ],
  },
  {
    id: 'business', label: 'Business', farbe: SPACE_FARBE.business, icon: Briefcase, start: '/os?space=business',
    suche: 'In Business suchen: Rechnungen, Mandate, Kontakte',
    eintraege: [
      ...vorn('business'),
      { href: '/os/finanzen?s=business', label: 'Finanzen', icon: Wallet, passt: ['/os/finanzen?space=business', '/os/finanzen?s=business', '/os/finanzen?s=controlling', '/os/finanzen?s=rechnungen', '/os/finanzen?s=liquiditaet', '/os/finanzen?s=buchungen', '/os/finanzen?s=steuern', '/os/finanzen?s=chef'], auch: ['/os/finanzen'] },
      { href: '/os/markttraktion', label: 'Markttraktion', icon: TrendingUp, passt: ['/os/markttraktion', '/os/crm'] },
      // Mandate & Unternehmen (08.10.): eine Gruppe — der Punkt öffnet Mandate, das Gesellschafts-Register ist von dort einen Klick entfernt.
      { href: '/os/mandate', label: 'Mandate & Unternehmen', icon: Briefcase, zeitId: 'mandate', passt: ['/os/mandate', '/os/unternehmen'] },
      { href: '/os/markttraktion?s=kontakte', label: 'Kontakte', icon: BookUser, passt: ['/os/markttraktion?s=kontakte'] },
    ],
  },
];

const eintrag = (id: SpaceId, label: string): SpaceEintrag => SPACES.find(s => s.id === id)!.eintraege.find(e => e.label === label)!;

/**
 * „Alles“ (08.10.): die gemeinsamen Punkte ohne Space-Parameter — die Seiten zeigen dann beide Bereiche (Inbox: alle eigenen
 * Postfächer, Kalender: Bereich „alle“, Aufgaben: Überblick über Privat, Firmen und Mandanten, Planung: Filter „alle“, Finanzen:
 * Gesamt). Kontakte = die Kartei der Markttraktion (dort stehen alle Personen; das private Kontaktbuch hebt den Punkt mit hervor).
 */
export const ALLES_EINTRAEGE: SpaceEintrag[] = [
  { href: '/os', label: 'Heute', icon: Sun, passt: [], auch: ['=/os'] },
  { href: '/os/inbox', label: 'Inbox', icon: Inbox, passt: [], auch: ['/os/inbox'] },
  { href: '/os/kalender', label: 'Kalender', icon: CalendarDays, passt: [], auch: ['/os/kalender', '/os/planung/woche'] },
  { href: '/os/aufgaben', label: 'Aufgaben', icon: ListChecks, passt: [], auch: ['/os/aufgaben'] },
  { href: '/os/planung/jahr', label: 'Planung', icon: Target, zeitId: 'ziele-planung', passt: [], auch: ['/os/planung', '/os/fokus', '/os/kompass', '/os/wachstum', '/os/saeule'] },
  { href: '/os/finanzen?s=gesamt', label: 'Finanzen', icon: Wallet, passt: [], auch: ['/os/finanzen'] },
  { href: '/os/markttraktion?s=kontakte', label: 'Kontakte', icon: BookUser, passt: [], auch: ['/os/markttraktion?s=kontakte', '/os/menschen'] },
  ZOE_EINTRAG,
];

/** Unter „Alles“ je eine kleine Gruppe: die Bereiche, die nur einen Space kennen (dieselben Einträge wie in der Space-Leiste). */
export const ALLES_GRUPPEN: { space: SpaceId; label: string; farbe: string; eintraege: SpaceEintrag[] }[] = [
  { space: 'privat', label: 'Privat', farbe: SPACE_FARBE.privat, eintraege: [eintrag('privat', 'Gesundheit'), eintrag('privat', 'Familie')] },
  { space: 'business', label: 'Business', farbe: SPACE_FARBE.business, eintraege: [eintrag('business', 'Markttraktion'), eintrag('business', 'Mandate & Unternehmen')] },
];

/** Anzeige der Wahl (Kopf, Leiste, Handy-Blatt): Name, Farbe, Startadresse, Text der Suche. */
export const ALLES = { id: 'alles' as const, label: 'Alles', farbe: FARBE.aktiv, icon: LayoutGrid, start: '/os', suche: 'Überall suchen: Aufgaben, Kontakte, Seiten' };
export function wahlInfo(w: SpaceWahl): { id: SpaceWahl; label: string; farbe: string; icon: LucideIcon; start: string; suche: string } {
  return w === 'alles' ? ALLES : spaceVon(w);
}

/** Die Leiste einer Wahl: Space = seine Punkte, dann ZOE; „Alles“ = die gemeinsamen Punkte samt ZOE, dann die Gruppen. */
export const leisteFuer = (id: SpaceWahl): SpaceEintrag[] =>
  id === 'alles' ? [...ALLES_EINTRAEGE, ...ALLES_GRUPPEN.flatMap(g => g.eintraege)] : [...spaceVon(id).eintraege, ZOE_EINTRAG];

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

/** Die Wahl aus dem Parameter `space` allein (privat · business · alles), sonst null. */
export function wahlAusParameter(suche = ''): SpaceWahl | null {
  const q = new URLSearchParams(suche.startsWith('?') ? suche.slice(1) : suche).get('space');
  return istSpaceWahl(q) ? q : null;
}

/**
 * Die wirksame Wahl (08.10.): `?space=` gewinnt (auch `alles`). Ist „Alles“ gemerkt, bleibt es — Seiten nur eines Bereichs
 * (Gesundheit, Markttraktion …) lassen den Schalter stehen. Ist ein Space gemerkt, legt die Seite ihn fest wie bisher.
 */
export function wahlVon(pfad: string, suche: string, gemerkt: SpaceWahl): SpaceWahl {
  const p = wahlAusParameter(suche);
  if (p) return p;
  if (gemerkt === 'alles') return 'alles';
  return aktiverSpaceEintrag(pfad, suche).space ?? gemerkt;
}

export const spaceVon = (id: SpaceId): Space => SPACES.find(s => s.id === id) ?? SPACES[0];
/** Merker der Wahl im Kopf (`alles` | `privat` | `business`; alte Stände tragen nur einen Space). */
export const SPACE_MERKER = 'make-space';
/** Der zuletzt konkrete Space — für Stellen, die einen Space brauchen (Suche, ZOE, Zeitmessung), auch bei „Alles“. */
export const SPACE_ZULETZT_MERKER = 'make-space-zuletzt';
export const SPACE_EREIGNIS = 'make-space-gewechselt';

/**
 * Wohin der Schalter im Kopf führt (08.10.): steht man auf einem Punkt der Leiste, der in der neuen Wahl ein Gegenstück gleichen
 * Namens hat (Heute, Inbox, Kalender, Aufgaben, Planung, Finanzen, Kontakte), geht es dorthin; trifft die Seite den Punkt der neuen
 * Wahl schon (z. B. Gesundheit bei „Alles“ — die Gruppe Privat), bleibt man stehen (null). Eine Seite eines Space ohne Gegenstück
 * führt zu Heute der neuen Wahl. Gemeinsame Seiten (Konto, Einstellungen, ZOE …) bleiben stehen (null).
 */
export function wechselZiel(pfad: string, suche: string, nach: SpaceWahl): string | null {
  const reihe: SpaceWahl[] = [...SPACE_WAHLEN.filter(w => w !== nach), nach];
  let punkt: SpaceEintrag | null = null;
  for (const w of reihe) { punkt = aktiverLeistenPunkt(w, pfad, suche); if (punkt) break; }
  const start = wahlInfo(nach).start;
  if (!punkt || punkt === ZOE_EINTRAG) return spaceVonAdresse(pfad, suche) || wahlAusParameter(suche) ? start : null;
  const ziel = leisteFuer(nach).find(e => e.label === punkt!.label);
  if (!ziel) return start;
  // Schon da (die Seite trifft den Punkt der neuen Wahl) und kein widersprechender ?space= → stehen bleiben, nur die Wahl wechselt.
  const param = wahlAusParameter(suche);
  const schonDa = ziel.passt.some(m => passtZu(pfad, suche, m)) || passtZu(pfad, suche, ziel.href);
  if (schonDa && (!param || param === nach)) return null;
  return ziel.href;
}
