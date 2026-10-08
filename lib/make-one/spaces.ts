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
import { Home, Briefcase, Wallet, Target, ListChecks, HeartPulse, Users, BookUser, TrendingUp, Sparkles, Sun, Inbox, CalendarDays } from 'lucide-react';
import { SPACE_FARBE, type SpaceId } from './space-regeln';

export type { SpaceId };
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
      { href: '/os/finanzen?s=privat', label: 'Finanzen', icon: Wallet, passt: ['/os/finanzen?s=privat', '/os/finanzen?s=finanzplanung&space=privat', '/os/finanzen?s=gesamt&space=privat', '/os/finanzen?s=steuern&space=privat', '/os/finanzplan'], auch: ['/os/finanzen'] },
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
      { href: '/os/finanzen?s=business', label: 'Finanzen', icon: Wallet, passt: ['/os/finanzen?s=business', '/os/finanzen?s=steuern', '/os/finanzen?s=chef', '/os/finanzen?s=finanzplanung&space=business', '/os/finanzen?s=gesamt&space=business', '/os/finanzen/', '/os/controlling', '/os/business'], auch: ['/os/finanzen'] },
      { href: '/os/markttraktion', label: 'Markttraktion', icon: TrendingUp, passt: ['/os/markttraktion', '/os/crm'] },
      // Mandate & Unternehmen (08.10.): eine Gruppe — der Punkt öffnet Mandate, das Gesellschafts-Register ist von dort einen Klick entfernt.
      { href: '/os/mandate', label: 'Mandate & Unternehmen', icon: Briefcase, zeitId: 'mandate', passt: ['/os/mandate', '/os/unternehmen'] },
      { href: '/os/markttraktion?s=kontakte', label: 'Kontakte', icon: BookUser, passt: ['/os/markttraktion?s=kontakte'] },
    ],
  },
];

/** Die Leiste eines Space: seine Punkte, dann ZOE. */
export const leisteFuer = (id: SpaceId): SpaceEintrag[] => [...spaceVon(id).eintraege, ZOE_EINTRAG];

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
export function aktiverLeistenPunkt(id: SpaceId, pfad: string, suche = ''): SpaceEintrag | null {
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

export const spaceVon = (id: SpaceId): Space => SPACES.find(s => s.id === id) ?? SPACES[0];
export const SPACE_MERKER = 'make-space';
export const SPACE_EREIGNIS = 'make-space-gewechselt';

/**
 * Wohin der Space-Schalter im Kopf führt (08.10.): steht man auf einem Punkt der Leiste, der im anderen Space ein Gegenstück
 * gleichen Namens hat (Heute, Inbox, Kalender, Aufgaben, Planung, Finanzen, Kontakte), geht es dorthin; auf einer Seite des
 * einen Space ohne Gegenstück zu Heute des anderen. Gemeinsame Seiten (Konto, Einstellungen, ZOE …) bleiben stehen (null).
 */
export function wechselZiel(pfad: string, suche: string, nach: SpaceId): string | null {
  const von: SpaceId = nach === 'privat' ? 'business' : 'privat';
  const punkt = aktiverLeistenPunkt(von, pfad, suche) ?? aktiverLeistenPunkt(nach, pfad, suche);
  if (!punkt || punkt === ZOE_EINTRAG) return spaceVonAdresse(pfad, suche) ? spaceVon(nach).start : null;
  return spaceVon(nach).eintraege.find(e => e.label === punkt.label)?.href ?? spaceVon(nach).start;
}
