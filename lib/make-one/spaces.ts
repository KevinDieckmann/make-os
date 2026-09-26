// ─── MAKE OS — Zwei Spaces: Privat und Business (26.09., Malins Vorschlag) ──
// „Links zwei Spaces, jeweils in eigener Farbe. Tippt man einen an, klappt
// darunter sein Untermenü auf. Unten links gesondert Jarvis und Brain, darunter
// System. Oben ein Suchfeld, das im aktiven Space sucht, daneben der Index des
// Space.“ Kevin (26.09.): Markttraktion und Mandate unter Business; privat gibt
// es das Kontaktbuch (Menschen). Gesundheit ist persönlich → Privat.
//
// Ein Space ist eine Sicht, kein Datenraum: Aufgaben, Heute, Jarvis bleiben
// gemeinsam. Inbox und Kalender tragen den Space als ?space=… (Postfächer nach
// Quelle, Termine des anderen Space als „belegt“).

import type { LucideIcon } from 'lucide-react';
import { Home, Briefcase, Wallet, Crosshair, ListChecks, HeartPulse, Users, BookUser, Inbox, CalendarDays, Target, TrendingUp, Bot, Brain, Sparkles } from 'lucide-react';
import { LEUCHT } from './design';

export type SpaceId = 'privat' | 'business';
export interface SpaceEintrag { href: string; label: string; icon: LucideIcon; passt: string[] }
export interface Space {
  id: SpaceId; label: string; farbe: string; icon: LucideIcon; start: string;
  eintraege: SpaceEintrag[];
  /** Der Index dieses Space im Kopf oben. */
  index: { label: string; ziel: string };
  suche: string;
}

export const SPACES: Space[] = [
  {
    id: 'privat', label: 'Privat', farbe: LEUCHT.beziehung, icon: Home, start: '/os',
    index: { label: 'Privat-Index', ziel: '/os/finanzen?s=privat#index' },
    suche: 'In Privat suchen: Familie, Gesundheit, Zahlen',
    eintraege: [
      { href: '/os/finanzen?s=privat', label: 'Finanzen', icon: Wallet, passt: ['/os/finanzen?s=privat'] },
      { href: '/os/fokus', label: 'Ziele & Fokus', icon: Crosshair, passt: ['/os/fokus', '/os/kompass', '/os/planung/fokus'] },
      { href: '/os/aufgaben', label: 'Aufgaben', icon: ListChecks, passt: ['/os/aufgaben', '/os/board'] },
      { href: '/os/gesundheit', label: 'Gesundheit', icon: HeartPulse, passt: ['/os/gesundheit', '/os/journal', '/os/ernaehrung', '/os/ritual', '/os/energie', '/os/tageslauf'] },
      { href: '/os/familie', label: 'Familie', icon: Users, passt: ['/os/familie'] },
      { href: '/os/familie?b=familie', label: 'Menschen', icon: BookUser, passt: ['/os/familie?b=familie'] },
      { href: '/os/inbox?space=privat', label: 'Inbox privat', icon: Inbox, passt: ['/os/inbox?space=privat'] },
      { href: '/os/planung/woche?space=privat', label: 'Kalender privat', icon: CalendarDays, passt: ['/os/planung/woche?space=privat', '/os/kalender?space=privat'] },
    ],
  },
  {
    id: 'business', label: 'Business', farbe: LEUCHT.schlaf, icon: Briefcase, start: '/os/finanzen?s=business',
    index: { label: 'Business-Index', ziel: '/os/finanzen?s=business' },
    suche: 'In Business suchen: Rechnungen, Mandate, Kontakte',
    eintraege: [
      { href: '/os/finanzen?s=business', label: 'Finanzen', icon: Wallet, passt: ['/os/finanzen?s=business', '/os/finanzen?s=steuern', '/os/finanzen?s=gesamt', '/os/finanzen?s=chef', '/os/finanzen/', '/os/controlling', '/os/business'] },
      { href: '/os/planung', label: 'Planung', icon: Target, passt: ['/os/planung', '/os/meeting', '/os/okr', '/os/saeule'] },
      { href: '/os/markttraktion', label: 'Markttraktion', icon: TrendingUp, passt: ['/os/markttraktion', '/os/crm', '/os/prospecting', '/os/research', '/os/content'] },
      { href: '/os/mandate', label: 'Mandate', icon: Briefcase, passt: ['/os/mandate'] },
      { href: '/os/agenten', label: 'Agenten', icon: Bot, passt: ['/os/agenten', '/os/stapel', '/os/loop'] },
      { href: '/os/inbox?space=business', label: 'Inbox Business', icon: Inbox, passt: ['/os/inbox?space=business'] },
      { href: '/os/planung/woche?space=business', label: 'Kalender Business', icon: CalendarDays, passt: ['/os/planung/woche?space=business', '/os/kalender?space=business'] },
    ],
  },
];

/** Unten links, gesondert: Jarvis und Brain (Malin), dann System. */
export const UNTEN: SpaceEintrag[] = [
  { href: '/jarvis', label: 'Jarvis', icon: Sparkles, passt: ['/jarvis'] },
  { href: '/os/wissen', label: 'Brain', icon: Brain, passt: ['/os/wissen'] },
];

const passtZu = (voll: string, pfad: string, muster: string): boolean => {
  if (muster.includes('?')) return voll === muster || voll.startsWith(`${muster}&`);
  return pfad === muster || pfad.startsWith(muster.endsWith('/') ? muster : `${muster}/`);
};

/** Welcher Eintrag ist „aktiv“ — der längste passende Präfix über alle Spaces und Unten. */
export function aktiverSpaceEintrag(pfad: string, suche = ''): { space: SpaceId | null; eintrag: SpaceEintrag | null } {
  const voll = pfad + (suche && !suche.startsWith('?') ? `?${suche}` : suche);
  const treffer: { space: SpaceId | null; eintrag: SpaceEintrag; l: number }[] = [];
  const pruefe = (space: SpaceId | null, e: SpaceEintrag) => { for (const m of e.passt) if (passtZu(voll, pfad, m)) treffer.push({ space, eintrag: e, l: m.length }); };
  for (const s of SPACES) for (const e of s.eintraege) pruefe(s.id, e);
  for (const e of UNTEN) pruefe(null, e);
  treffer.sort((x, y) => y.l - x.l);
  return treffer.length ? { space: treffer[0].space, eintrag: treffer[0].eintrag } : { space: null, eintrag: null };
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
