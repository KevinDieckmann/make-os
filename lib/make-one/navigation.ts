// ─── MAKE OS — Die Navigation ───────────────────────────────────────────────
// 23.09. (Kevin: „Das ist grausig … maximal verschlanken"): eine Ebene statt
// sieben Bereichen. 24.09. abends, Kevin: „Wir haben oben alle Sachen sauber
// verlinkt, das bedeutet wir brauchen auf der linken Seite nicht alles —
// das doppelt sich." Links stehen jetzt nur die Arbeitsräume: Jarvis, Brain,
// Markttraktion, Fokus, Aufgaben. Heute, Inbox, Wachstum, Gesundheit, Business,
// Planung, Zahlen, Familie und Agenten erreicht man über den Kopf oben
// (WachstumsKopf) — auf dem Handy genauso.
//
// Jeder Eintrag kennt die Pfade, für die er „aktiv" ist — so bleibt jede alte
// Adresse erreichbar und die Leiste zeigt trotzdem, wo man ist.

import type { LucideIcon } from 'lucide-react';
import { ListChecks, TrendingUp, Brain, Sparkles, Settings, Crosshair } from 'lucide-react';

export interface Eintrag { href: string; label: string; icon: LucideIcon; passt: string[] }

export const HAUPT: Eintrag[] = [
  // 24.09., Kevin: „Nimm Jarvis einfach links als eigene Seite mit rein."
  { href: '/jarvis', label: 'Jarvis', icon: Sparkles, passt: ['/jarvis'] },
  // Kevin: „Wissen, wo ich aber gerne Brain für haben möchte." Obsidian ist Wissensbank Nr. 1.
  { href: '/os/wissen', label: 'Brain', icon: Brain, passt: ['/os/wissen'] },
  // Kevin: „das Thema CRM, was jetzt gerade noch Kontakte ist." — seit 25.09. „Markttraktion" (Sales, Marketing, Event).
  { href: '/os/markttraktion', label: 'Markttraktion', icon: TrendingUp, passt: ['/os/markttraktion', '/os/crm', '/os/prospecting'] },
  // Kevin: „Fokus, das haben wir ja auch als riesiges Thema."
  { href: '/os/fokus', label: 'Fokus', icon: Crosshair, passt: ['/os/fokus', '/os/kompass', '/os/planung/fokus'] },
  { href: '/os/aufgaben', label: 'Aufgaben', icon: ListChecks, passt: ['/os/aufgaben', '/os/planung/woche', '/os/planung/monat', '/os/planung/quartal', '/os/planung/jahr', '/os/planung/routinen', '/os/meeting', '/os/board'] },
];

/** Die Handy-Leiste: dieselben Arbeitsräume wie links, dazu das Zahnrad. */
export const HANDY = HAUPT.map(e => e.href);

export const SYSTEM: Eintrag = { href: '/os/system', label: 'System', icon: Settings, passt: ['/os/system', '/os/agenten', '/os/stapel', '/os/verbindungen', '/os/konto', '/os/datenbasis', '/os/stammdaten', '/os/bauplan', '/os/roadmap', '/os/loop', '/os/onboarding', '/os/research', '/os/content'] };

/** Der aktive Leisten-Eintrag — oder keiner (Heute, Zahlen, Gesundheit … liegen im Kopf). */
export function aktiverEintrag(pfad: string): Eintrag | null {
  const alle = [...HAUPT, SYSTEM];
  // Längster passender Präfix gewinnt — /os/planung/woche gehört zu Aufgaben.
  let best: { e: Eintrag; l: number } | null = null;
  for (const e of alle) for (const p of e.passt) {
    const ok = pfad === p || pfad.startsWith(`${p}/`);
    if (ok && (!best || p.length > best.l)) best = { e, l: p.length };
  }
  return best?.e ?? null;
}
