import {
  Activity, Bot, BrainCircuit, CalendarRange, CheckSquare, Compass, Database, Flame,
  Gauge, HeartPulse, Inbox, LayoutGrid, ListChecks, Map, Network, Plug, RefreshCw,
  Repeat, Rocket, Salad, Search, ShieldCheck, Sparkles, Sunrise, Target, TrendingUp,
  UserCheck, UserCog, Users, Utensils, Wallet, IdCard, type LucideIcon,
} from 'lucide-react';
import { THEME as T } from './os-data';

// ─── MAKE OS — Bereiche ─────────────────────────────────────────────────────
// Kevins Ansage: „Das ist mittlerweile sehr voll geworden — ich möchte das
// Ganze mehr mit Klarheit." Vorbild ist der Aufbau von KEMARIS Operations.
//
// Ein Bereich ist eine eigenständige Anwendung. Man betritt ihn, und die
// Seitenleiste zeigt danach NUR noch dessen Punkte — statt vierzig Zeilen auf
// einmal. Eine Quelle für Startfläche, Seitenleiste und Schnellnavigation.

export interface BereichItem { href: string; label: string; icon: LucideIcon; hinweis?: string;
  /** Nur im Business- oder nur im Privat-Modus sichtbar; ohne Angabe: immer. */
  modus?: 'privat' | 'business';
  /** Nicht als Reiter/Menüpunkt, aber als Seite bekannt (Bereichszuordnung, ⌘K).
   *  Für Unterseiten, die man von ihrer Elternseite aus erreicht. */
  versteckt?: boolean }

export interface Bereich {
  id: string;
  /** In welchem Leben der Bereich sichtbar ist (Kevins Privat-/Business-Modus). */
  modus: 'privat' | 'business' | 'beides';
  titel: string;
  kurz: string;
  icon: LucideIcon;
  /** Einstiegsseite — das Ziel des Kachel-Klicks. */
  start: string;
  farbe: string;
  items: BereichItem[];
}

/**
 * Die Einstiege stehen über den Bereichen und gehören zu keinem.
 * Der Kompass sitzt bewusst direkt unter der Inbox (Kevins Ansage): dort
 * werden Prioritäten und Fokus gesetzt, und darüber wird fast alles gesteuert.
 */
export const EINSTIEGE: BereichItem[] = [
  { href: '/os/start', label: 'Startfläche', icon: LayoutGrid },
  { href: '/os', label: 'Heute', icon: Sunrise },
  { href: '/os/inbox', label: 'Inbox', icon: Inbox },
  { href: '/os/kompass', label: 'Kompass', icon: Compass, hinweis: 'steuert' },
];

export const BEREICHE: Bereich[] = [
  {
    id: 'tag',
    modus: 'beides',
    titel: 'Tag & Fokus',
    kurz: 'Wie der Tag läuft — Plan, Kompass, Rituale und Regelkreise',
    icon: Compass,
    start: '/os/planung',
    farbe: T.accent,
    items: [
      { href: '/os/planung', label: 'Tag', icon: Target, hinweis: 'Der Tagesplan' },
      { href: '/os/ritual', label: 'Tagesstart & -ende', icon: Sunrise },
      { href: '/os/tageslauf', label: 'Tageslauf', icon: Activity },
      { href: '/os/kalender', label: 'Kalender', icon: CalendarRange },
    ],
  },
  {
    id: 'aufgaben',
    modus: 'beides',
    titel: 'Aufgaben & Planung',
    kurz: 'Alles, was zu tun ist — vom heutigen Schritt bis zum Jahresziel',
    icon: ListChecks,
    start: '/os/aufgaben',
    farbe: T.accentInk,
    items: [
      { href: '/os/aufgaben', label: 'Taskmanagement', icon: CheckSquare },
      { href: '/os/meeting', label: 'Meeting → Aufgaben', icon: Users, modus: 'business' },
      { href: '/os/planung/woche', label: 'Wochenplaner', icon: CalendarRange },
      { href: '/os/planung/monat', label: 'Monat', icon: CalendarRange },
      { href: '/os/planung/quartal', label: 'Quartal', icon: CalendarRange },
      { href: '/os/planung/jahr', label: 'Jahr & Ziele', icon: Target },
      { href: '/os/planung/routinen', label: 'Routinen', icon: Repeat },
    ],
  },
  {
    id: 'finanzen',
    modus: 'beides',
    titel: 'Finanzen',
    kurz: 'Malins Kassenbuch als Grundlage — Liquidität, Rechnungen, Kurs',
    icon: Wallet,
    start: '/os/finanzen',
    farbe: T.amber,
    items: [
      { href: '/os/finanzen', label: 'Dashboard', icon: Wallet },
      { href: '/os/finanzen/grundlage', label: 'Grundlage', icon: Database, hinweis: 'Malins Zahlen', modus: 'business' },
      { href: '/os/finanzen/liquiditaet', label: 'Liquiditäts-Planung', icon: TrendingUp },
      { href: '/os/finanzen/buchungen', label: 'Buchungen', icon: ListChecks },
      { href: '/os/finanzen/planung', label: 'Rechnungen & Zahlungen', icon: CheckSquare, modus: 'business' },
      { href: '/os/controlling', label: 'Controlling', icon: Gauge, modus: 'business' },
      { href: '/os/finanzen/dashboard', label: 'Business-Altbestand', icon: LayoutGrid, modus: 'business' },
    ],
  },
  {
    // Kevin, 23.09.: „Packe alles, was mit Gesundheit & Performance zu tun hat,
    // zusammen — damit wir nicht immer wieder Zeit verlieren." Vorher zwei
    // Bereiche mit elf Seiten; jetzt einer mit sechs Reitern. Die fünf
    // Säulen-Seiten bleiben erreichbar (vom Score aus und per ⌘K), stehen
    // aber nicht mehr als eigene Reiter herum.
    id: 'gesundheit',
    modus: 'beides',
    titel: 'Gesundheit & Performance',
    kurz: 'Körper, Energie, Rhythmus — und der eine Score, in den alles einläuft',
    icon: HeartPulse,
    start: '/os/gesundheit',
    farbe: T.crit,
    items: [
      { href: '/os/gesundheit', label: 'Heute', icon: HeartPulse },
      { href: '/os/journal', label: 'Journal', icon: Salad },
      { href: '/os/ernaehrung', label: 'Ernährung', icon: Utensils },
      { href: '/os/energie', label: 'Körper & Aufbau', icon: Flame },
      { href: '/os/woche', label: 'Wochen-Rhythmus', icon: Repeat },
      { href: '/os/performance', label: 'Der Score', icon: Gauge },
      { href: '/os/saeule/health', label: 'Säule Gesundheit & Energie', icon: HeartPulse, versteckt: true },
      { href: '/os/saeule/business', label: 'Säule Business-Performance', icon: TrendingUp, modus: 'business', versteckt: true },
      { href: '/os/saeule/planning', label: 'Säule Planung & Execution', icon: ListChecks, versteckt: true },
      { href: '/os/saeule/finance', label: 'Säule Finanzen', icon: Wallet, modus: 'business', versteckt: true },
      { href: '/os/familie', label: 'Familie & Partnerschaft', icon: Users, versteckt: true },
    ],
  },
  {
    id: 'wachstum',
    modus: 'business',
    titel: 'Wachstum',
    kurz: 'Netzwerk, Kunden und was als Nächstes gebaut wird',
    icon: Network,
    start: '/os/markttraktion',
    farbe: T.accentInk,
    items: [
      { href: '/os/markttraktion', label: 'Markttraktion', icon: TrendingUp },
      { href: '/os/prospecting', label: 'Zielliste', icon: Target },
      { href: '/os/research', label: 'Research', icon: Search },
      { href: '/os/content', label: 'Content', icon: Sparkles },
      { href: '/os/roadmap', label: 'Roadmap', icon: Map },
      { href: '/os/bauplan', label: 'Bauplan', icon: LayoutGrid },
    ],
  },
  {
    id: 'onboarding',
    modus: 'beides',
    titel: 'Onboarding',
    kurz: 'Schritt für Schritt startklar — eigene Spur für Kevin und für Malin',
    icon: Rocket,
    start: '/os/onboarding',
    farbe: T.accent,
    items: [
      { href: '/os/onboarding', label: 'Übersicht', icon: Rocket, hinweis: 'Fundament' },
      { href: '/os/onboarding/kevin', label: 'Spur Kevin', icon: UserCog },
      { href: '/os/onboarding/malin', label: 'Spur Malin', icon: UserCheck },
      { href: '/os/onboarding/zusammenarbeit', label: 'Zusammenarbeit', icon: ShieldCheck, hinweis: 'Bauzeit' },
    ],
  },
  {
    id: 'system',
    modus: 'beides',
    titel: 'Automatisierung & System',
    kurz: 'Agenten, Regelkreise, Datenbasis und Verbindungen nach außen',
    icon: BrainCircuit,
    start: '/os/agenten',
    farbe: T.inkDim,
    items: [
      { href: '/os/agenten', label: 'Agentensystem', icon: Bot },
      // Der Stapel: was Jarvis vorbereitet hat und auf deine Freigabe wartet.
      { href: '/os/stapel', label: 'Aufträge & Freigaben', icon: ShieldCheck, hinweis: 'Jarvis' },
      // Kevins Ansage: Loops gehören nicht in den Tag, sondern zur Automatisierung.
      { href: '/os/loop', label: 'Loops', icon: RefreshCw, hinweis: 'Regelkreise' },
      { href: '/os/datenbasis', label: 'Datenbasis', icon: Database },
      // Der sichere Platz für Steuernummern, IBANs und Ansprechpartner.
      { href: '/os/stammdaten', label: 'Stammdaten', icon: IdCard, hinweis: 'Firmen · Konten' },
      { href: '/os/verbindungen', label: 'Verbindungen', icon: Plug },
    ],
  },
];

export type Modus = 'privat' | 'business' | 'alles';

/**
 * Die Bereiche, die im gewählten Leben sichtbar sind. Kevins Ansage: „Bei
 * Privat ist nur noch ein Bereich sichtbar — Gesundheit, Fokus, Planung, aber
 * kein Business mehr." Bereiche UND einzelne Seiten werden gefiltert, damit im
 * Privat-Modus nicht die Rechnungen unter Finanzen stehenbleiben.
 */
export function bereicheFuer(modus: Modus): Bereich[] {
  if (modus === 'alles') return BEREICHE;
  return BEREICHE
    .filter(b => b.modus === 'beides' || b.modus === modus)
    .map(b => ({ ...b, items: b.items.filter(i => !i.modus || i.modus === modus) }))
    .filter(b => b.items.length > 0);
}

/** Bereich zu einem Pfad — längster Treffer gewinnt (/os/planung vs. /os/planung/woche). */
export function bereichFuerPfad(pfad: string): Bereich | null {
  if (EINSTIEGE.some(e => (e.href === '/os' ? pfad === '/os' : pfad === e.href || pfad.startsWith(`${e.href}/`)))) return null;
  let treffer: { bereich: Bereich; laenge: number } | null = null;
  for (const b of BEREICHE) {
    for (const it of b.items) {
      const passt = pfad === it.href || pfad.startsWith(`${it.href}/`);
      if (passt && (!treffer || it.href.length > treffer.laenge)) treffer = { bereich: b, laenge: it.href.length };
    }
  }
  return treffer?.bereich ?? null;
}

/** Alle Seiten über alle Bereiche — Grundlage der Schnellnavigation (⌘K). */
export const ALLE_SEITEN: (BereichItem & { bereich: string })[] = [
  ...EINSTIEGE.map(e => ({ ...e, bereich: 'Einstieg' })),
  ...BEREICHE.flatMap(b => b.items.map(it => ({ ...it, bereich: b.titel }))),
];

/** Kennzahl auf einer Bereichs-Kachel. Nur echte Zahlen — sonst gar keine. */
export interface Kennzahl { wert: string; label: string; farbe?: string }
export interface BereichsLage { kennzahlen?: Kennzahl[]; status?: { text: string; farbe: string } }
