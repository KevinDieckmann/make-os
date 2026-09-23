// ─── MAKE OS — Die Navigation (23.09.) ──────────────────────────────────────
// Kevin: „Das ist grausig … wie würdest du es maximal verschlanken?"
//
// Vorher: 50 Seiten in 7 Bereichen, eine Seitenleiste, die je Bereich ihren
// Inhalt wechselte, darüber eine Reiterleiste mit denselben Einträgen, dazu
// ein Modus-Schalter. Jetzt: EINE Ebene, sechs Einträge, ein Zahnrad.
//
// Jeder Eintrag kennt die Pfade, für die er „aktiv" ist — so bleibt jede alte
// Adresse erreichbar und die Leiste zeigt trotzdem, wo man ist.

import type { LucideIcon } from 'lucide-react';
import { Clock, Inbox, HeartPulse, TrendingUp, ListChecks, BarChart3, Users, Sparkles, Settings } from 'lucide-react';

export interface Eintrag { href: string; label: string; icon: LucideIcon; passt: string[] }

export const HAUPT: Eintrag[] = [
  { href: '/os', label: 'Heute', icon: Clock, passt: ['/os', '/os/start', '/os/kompass', '/os/tageslauf', '/os/ritual', '/os/planung', '/os/kalender'] },
  { href: '/os/inbox', label: 'Inbox', icon: Inbox, passt: ['/os/inbox'] },
  { href: '/os/gesundheit', label: 'Gesundheit', icon: HeartPulse, passt: ['/os/gesundheit', '/os/journal', '/os/ernaehrung', '/os/energie', '/os/woche', '/os/fokus', '/os/saeule/health'] },
  // 24.09., Kevin: „Nimm als Score das ganze Thema Wachstum mit rein. Einen eigenen Bereich."
  { href: '/os/wachstum', label: 'Wachstum', icon: TrendingUp, passt: ['/os/wachstum', '/os/performance', '/os/saeule'] },
  { href: '/os/aufgaben', label: 'Aufgaben', icon: ListChecks, passt: ['/os/aufgaben', '/os/planung/woche', '/os/planung/monat', '/os/planung/quartal', '/os/planung/jahr', '/os/planung/routinen', '/os/meeting', '/os/board'] },
  { href: '/os/finanzen', label: 'Zahlen', icon: BarChart3, passt: ['/os/finanzen', '/os/controlling'] },
  { href: '/os/crm', label: 'Kontakte', icon: Users, passt: ['/os/crm', '/os/netzwerk', '/os/prospecting'] },
  // 24.09., Kevin: „Nimm Jarvis einfach links als eigene Seite mit rein, wo ich draufklicken kann, wenn ich möchte."
  { href: '/jarvis', label: 'Jarvis', icon: Sparkles, passt: ['/jarvis'] },
];

/** Die fünf Plätze der Handy-Leiste — Whoop hat auch nur fünf. */
export const HANDY = ['/os', '/os/inbox', '/os/gesundheit', '/os/wachstum'];

export const SYSTEM: Eintrag = { href: '/os/system', label: 'System', icon: Settings, passt: ['/os/system', '/os/agenten', '/os/stapel', '/os/verbindungen', '/os/konto', '/os/datenbasis', '/os/stammdaten', '/os/bauplan', '/os/roadmap', '/os/loop', '/os/onboarding', '/os/research', '/os/content'] };

export function aktiverEintrag(pfad: string): Eintrag {
  const alle = [...HAUPT, SYSTEM];
  // Längster passender Präfix gewinnt — /os/planung/woche gehört zu Aufgaben, /os/planung zu Heute.
  let best: { e: Eintrag; l: number } | null = null;
  for (const e of alle) for (const p of e.passt) {
    const ok = p === '/os' ? pfad === '/os' : pfad === p || pfad.startsWith(`${p}/`);
    if (ok && (!best || p.length > best.l)) best = { e, l: p.length };
  }
  return best?.e ?? HAUPT[0];
}
