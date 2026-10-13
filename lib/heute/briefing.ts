// ─── Heute: das Tages-Briefing als kurzer Text — reine Regeln (10.10., Branch `heute-top3`) ─────────────────────────────────────
// Kevin 08.10. (Fragebogen): „kurzes Tages-Briefing als Text“. Drei bis fünf Sätze: was ansteht, was brennt, was auf Freigabe wartet, die Top 3,
// ein Hinweis zum Fokus. REGELWERK aus Zahlen, die ohnehin da sind — kein Modell, keine Gesundheits- oder Familiendaten, nichts aus dem anderen
// Bereich (die Zahlen kommen schon gefiltert: Heute › Business bekommt nur Business). Der Morgenlauf von ZOE (`/api/zoe/morgen`) schreibt zwar
// einen Bericht, aber als Systemlauf des Inhabers über ALLE Bereiche — er taugt nicht als Text für eine andere Person oder einen Bereich.
//
// Rein und client-sicher; die Zahlen holt ./briefing-server.ts.

import type { TopBereich } from './top3';

export interface BriefingZahlen {
  sicht: TopBereich;
  termine: { anzahl: number; erster?: { uhr: string; titel: string } };
  ueberfaellig: number;
  heuteFaellig: number;
  kritisch: number;
  /** Fällige Follow-ups (nur Business — in Privat immer 0). */
  followups: number;
  /** Offene Vorschläge von ZOE, die diese Person in diesem Bereich sieht. */
  freigaben: number;
  top3: { art: 'festgelegt' | 'vorschlag' | 'keine'; titel: string[]; erledigt: number };
  fokus: { text: string; wann: 'tag' | 'woche' | 'monat' } | null;
}

const kuerzen = (s: string, n: number) => { const t = s.replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t; };
const aufzaehlung = (l: readonly string[]) => (l.length <= 1 ? l.join('') : `${l.slice(0, -1).join(', ')} und ${l[l.length - 1]}`);
const WANN: Record<'tag' | 'woche' | 'monat', string> = { tag: 'heute', woche: 'diese Woche', monat: 'diesen Monat' };

/** Die Sätze des Briefings (3 bis 5) — immer mindestens: Termine, Aufgaben, Top 3 (Freigaben nur, wenn welche warten; Fokus mit Hinweis). */
export function briefingSaetze(z: BriefingZahlen): string[] {
  const s: string[] = [];
  // 1) Was ansteht.
  // Gezählt werden nur kommende/laufende Termine (`termineHeute`) — „kein Termin im Kalender“ stimmte nachmittags nicht, wenn am Morgen einer
  // war (Gesamtprüfung 12.10.: Briefing und Kalender widersprachen sich). „mehr“ ist in beiden Fällen wahr.
  if (z.termine.anzahl === 0) s.push('Heute steht kein Termin mehr an.');
  else if (z.termine.anzahl === 1) s.push(`Heute steht ein Termin an${z.termine.erster ? `: „${kuerzen(z.termine.erster.titel, 40)}“${z.termine.erster.uhr ? ` um ${z.termine.erster.uhr}` : ''}` : ''}.`);
  else s.push(`Heute stehen ${z.termine.anzahl} Termine an${z.termine.erster?.uhr ? `, der erste um ${z.termine.erster.uhr}` : ''}.`);
  // 2) Was brennt.
  const teile = [z.ueberfaellig ? `${z.ueberfaellig} überfällig` : '', z.heuteFaellig ? `${z.heuteFaellig} heute fällig` : '', z.kritisch ? `${z.kritisch} kritisch` : ''].filter(Boolean);
  const klauseln: string[] = [];
  klauseln.push(teile.length ? `Bei den Aufgaben: ${teile.join(', ')}` : 'Bei den Aufgaben brennt nichts');
  if (z.followups > 0) klauseln.push(`dazu ${z.followups} ${z.followups === 1 ? 'fälliges Follow-up' : 'fällige Follow-ups'}`);
  s.push(`${klauseln.join('; ')}.`);
  // 3) Was auf Freigabe wartet.
  if (z.freigaben > 0) s.push(`${z.freigaben} ${z.freigaben === 1 ? 'Vorschlag von ZOE wartet' : 'Vorschläge von ZOE warten'} auf deine Freigabe.`);
  // 4) Die Top 3.
  const titel = z.top3.titel.map(t => `„${kuerzen(t, 40)}“`);
  if (z.top3.art === 'festgelegt' && titel.length) {
    if (z.top3.erledigt >= titel.length) s.push(titel.length === 3 ? 'Deine Top 3 sind erledigt.' : `Deine ${titel.length === 1 ? 'Top 1 ist' : `Top ${titel.length} sind`} erledigt.`);
    else s.push(`Deine Top ${titel.length}: ${aufzaehlung(titel)}${z.top3.erledigt ? ` — ${z.top3.erledigt} davon schon geschafft` : ''}.`);
  } else if (z.top3.art === 'vorschlag' && titel.length) s.push(`ZOE schlägt als Top ${titel.length} vor: ${aufzaehlung(titel)} — übernimm sie oder tausch eine aus.`);
  else s.push('Noch keine Top 3: nichts drängt von allein — leg dir selbst bis zu drei Aufgaben fest.');
  // 5) Der Fokus.
  s.push(z.fokus ? `Dein Fokus ${WANN[z.fokus.wann]}: „${kuerzen(z.fokus.text, 120)}“.` : 'Noch kein Fokus gesetzt — ein Satz unter „Fokus“ genügt.');
  return s;
}

export const briefingText = (z: BriefingZahlen): string => briefingSaetze(z).join(' ');
