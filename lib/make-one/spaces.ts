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

import type { LucideIcon } from 'lucide-react';
import { Home, Briefcase, Wallet, Target, ListChecks, HeartPulse, Users, BookUser, TrendingUp, Bot, Brain, Sparkles, LayoutGrid } from 'lucide-react';
import { SPACE_FARBE, type SpaceId } from './space-regeln';

export type { SpaceId };
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
    id: 'privat', label: 'Privat', farbe: SPACE_FARBE.privat, icon: Home, start: '/os/uebersicht?space=privat',
    index: { label: 'Privat-Index', ziel: '/os/finanzen?s=privat#index' },
    suche: 'In Privat suchen: Familie, Gesundheit, Zahlen',
    eintraege: [
      { href: '/os/uebersicht?space=privat', label: 'Übersicht', icon: LayoutGrid, passt: ['/os/uebersicht?space=privat'] },
      { href: '/os/finanzen?s=privat', label: 'Finanzen', icon: Wallet, passt: ['/os/finanzen?s=privat', '/os/finanzen?s=finanzplanung&space=privat', '/os/finanzen?s=gesamt&space=privat', '/os/finanzplan'] },
      { href: '/os/aufgaben?space=privat', label: 'Aufgaben', icon: ListChecks, passt: ['/os/aufgaben?space=privat', '/os/board?space=privat'] },
      { href: '/os/planung/jahr?space=privat', label: 'Ziele & Planung', icon: Target, passt: ['/os/planung?space=privat', '/os/fokus?space=privat', '/os/kompass?space=privat'] },
      { href: '/os/gesundheit', label: 'Gesundheit', icon: HeartPulse, passt: ['/os/gesundheit', '/os/sport', '/os/journal', '/os/ernaehrung', '/os/ritual', '/os/energie', '/os/tageslauf'] },
      { href: '/os/familie', label: 'Familie', icon: Users, passt: ['/os/familie'] },
      { href: '/os/menschen', label: 'Kontakte', icon: BookUser, passt: ['/os/menschen'] },
    ],
  },
  {
    id: 'business', label: 'Business', farbe: SPACE_FARBE.business, icon: Briefcase, start: '/os/uebersicht?space=business',
    index: { label: 'Business-Index', ziel: '/os/finanzen?s=business' },
    suche: 'In Business suchen: Rechnungen, Mandate, Kontakte',
    eintraege: [
      { href: '/os/uebersicht?space=business', label: 'Übersicht', icon: LayoutGrid, passt: ['/os/uebersicht?space=business'] },
      { href: '/os/finanzen?s=business', label: 'Finanzen', icon: Wallet, passt: ['/os/finanzen?s=business', '/os/finanzen?s=steuern', '/os/finanzen?s=chef', '/os/finanzen?s=finanzplanung&space=business', '/os/finanzen?s=gesamt&space=business', '/os/finanzen/', '/os/controlling', '/os/business'] },
      { href: '/os/aufgaben?space=business', label: 'Aufgaben', icon: ListChecks, passt: ['/os/aufgaben?space=business', '/os/board?space=business', '/os/meeting'] },
      { href: '/os/planung/jahr?space=business', label: 'Ziele & Planung', icon: Target, passt: ['/os/planung?space=business', '/os/fokus?space=business', '/os/kompass?space=business', '/os/okr'] },
      { href: '/os/markttraktion', label: 'Markttraktion', icon: TrendingUp, passt: ['/os/markttraktion', '/os/crm', '/os/prospecting', '/os/research', '/os/content'] },
      { href: '/os/mandate', label: 'Mandate', icon: Briefcase, passt: ['/os/mandate'] },
    ],
  },
];

/** Eigener Knopf unter den Spaces (Kevin 26.09.: „das Agenten-Thema einzeln unter Business“). */
export const EIGEN: SpaceEintrag[] = [
  { href: '/os/agenten', label: 'Agenten', icon: Bot, passt: ['/os/agenten', '/os/stapel', '/os/loop'] },
  // Finanzplanung (27.09. unter den Agenten) ist am 04.10. umgezogen (Kevin): Reiter „Finanzplanung“ unter Privat › Finanzen (alles)
  // und Business › Finanzen (nur die Gesellschaften). /os/finanzplan leitet in die Privat-Sicht weiter.
  // Netzwerken (02.10.) steht NUR am Handy als fester Knopf unten in der Leiste (Handschlag) — Kevin 03.10.: „brauchen wir nicht
  // online auf der Plattform, wirklich nur auf dem Handy.“ Am Rechner bleibt die Seite über Links erreichbar (Event-Akte „Jetzt erfassen“).
];

/** Unten links, gesondert: ZOE und Brain (Malin), dann System. */
export const UNTEN: SpaceEintrag[] = [
  { href: '/zoe', label: 'ZOE', icon: Sparkles, passt: ['/zoe'] },
  { href: '/os/wissen', label: 'Brain', icon: Brain, passt: ['/os/wissen'] },
];

/**
 * Passt eine Adresse zu einem Muster? Pfad: gleich oder Unterpfad („/os/planung“
 * trifft „/os/planung/woche“). Muster mit „?“: alle genannten Parameter müssen
 * in der Adresse stehen („/os/aufgaben?space=privat“ trifft auch „/os/aufgaben/board?space=privat&offen=…“).
 */
export function passtZu(pfad: string, suche: string, muster: string): boolean {
  const [mp, mq] = muster.split('?');
  const pfadOk = mp.endsWith('/') ? pfad.startsWith(mp) : pfad === mp || pfad.startsWith(`${mp}/`);
  if (!pfadOk) return false;
  if (!mq) return true;
  const q = new URLSearchParams(suche.startsWith('?') ? suche.slice(1) : suche);
  return Array.from(new URLSearchParams(mq).entries()).every(([k, v]) => q.get(k) === v);
}

/** Welcher Eintrag ist „aktiv“ — das genaueste Muster über alle Spaces und Unten. */
export function aktiverSpaceEintrag(pfad: string, suche = ''): { space: SpaceId | null; eintrag: SpaceEintrag | null } {
  const treffer: { space: SpaceId | null; eintrag: SpaceEintrag; l: number }[] = [];
  const pruefe = (space: SpaceId | null, e: SpaceEintrag) => { for (const m of e.passt) if (passtZu(pfad, suche, m)) treffer.push({ space, eintrag: e, l: m.length }); };
  for (const s of SPACES) for (const e of s.eintraege) pruefe(s.id, e);
  for (const e of [...EIGEN, ...UNTEN]) pruefe(null, e);
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
