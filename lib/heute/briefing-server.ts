// ─── Heute: das Tages-Briefing — Server (10.10., Branch `heute-top3`) ─────────────────────────────────────────────────────────
// Holt die Zahlen für einen Bereich (Privat ODER Business — nie beides in einem Text) aus den vorhandenen, schon gefilterten Quellen und lässt
// ./briefing.ts den Text bauen. Kein Modell: nichts verlässt das Haus, und es gibt keinen Aufruf je Seitenaufruf, der etwas kostet. Gemerkt
// (`merken`, 60 s, Schlüssel mit Person, Bereich und Tag) — die Seite wird oft geöffnet, die Quellen sind teuer.
// Quellen (alle für DIESE Person): Aufgaben + Top 3 (./top3-server.ts), Termine und Follow-ups (`anstehendLesen` → `anstehendFuerSpace`),
// offene ZOE-Vorschläge (`vorschlaegeFuer`, Sicht des Bereichs), Fokus (`fokusSichtFuer`). Keine Gesundheit, keine Familie, keine Erholung.

import { merken } from '@/lib/store/memo';
import { anstehendLesen } from './anstehend-server';
import { anstehendFuerSpace } from './anstehend';
import { vorschlaegeFuer } from '@/lib/zoe/stapel';
import { fokusSichtFuer, type FokusSicht } from '@/lib/planung/fokus-server';
import { tagesDaten } from './top3-server';
import { briefingSaetze, type BriefingZahlen } from './briefing';
import type { TopBereich } from './top3';

/** `zahlen` (11.10.): dieselben Zahlen, aus denen die Sätze entstehen — die Karte zeigt sie als Lage-Kacheln über dem Text (nichts Neues, nur als Bild). */
export interface BriefingAntwort { tag: string; bereich: TopBereich; saetze: string[]; text: string; zahlen: BriefingZahlen }

const sicher = async <T>(p: Promise<T>, sonst: T): Promise<T> => { try { return await p; } catch { return sonst; } };

/**
 * Der engste gesetzte Fokus: heute, sonst diese Woche, sonst diesen Monat — Mein Fokus vor Unser. Prüf-Fund 11.10.: nur Sätze des LAUFENDEN
 * Zeitraums (`fokusSichtFuer` leert vergangene) — einer ohne Zeitraum (`unbekannt`, vor dem 11.10. gesetzt) steht nie als „heute“ da.
 */
export function fokusFuerBriefing(horizonte: Pick<FokusSicht['horizonte'], 'tag' | 'woche' | 'monat'>): BriefingZahlen['fokus'] {
  for (const wann of ['tag', 'woche', 'monat'] as const) {
    const h = horizonte[wann];
    const text = ([h.mein, h.unser].find(c => c.text.trim() && !c.unbekannt)?.text ?? '').trim();
    if (text) return { text, wann };
  }
  return null;
}

/** Die Zahlen des Briefings für eine Person und einen Bereich (rein aus Lesequellen). */
export async function briefingZahlen(person: string, bereich: TopBereich, jetzt: Date): Promise<{ tag: string; zahlen: BriefingZahlen } | null> {
  const t = await tagesDaten(person, jetzt, [bereich]);
  const block = t.bloecke[bereich], z = t.zahlen[bereich];
  if (!block || !z) return null; // der Bereich gehört nicht zu dieser Person (Konto „nur Business“, fremder Haushalt)
  const [anst, offen, fokus] = await Promise.all([
    sicher(anstehendLesen(person, jetzt).then(a => anstehendFuerSpace(a, bereich)), null),
    sicher(vorschlaegeFuer(person, 'offen', bereich), []),
    sicher(fokusSichtFuer(person, bereich), null),
  ]);
  const termine = anst?.termine ?? []; // `termineHeute`: kommend/laufend, ohne Arbeitsort, ohne „Belegt“ der anderen Person
  // Der erste mit Uhrzeit (Ganztägiges steht in der Liste vorn, hat aber keine Uhr).
  const erster = termine.find(x => !x.ganztags) ?? termine[0];
  const f = fokus && !('fehler' in fokus) ? fokus : null;
  const fokusText = f ? fokusFuerBriefing(f.horizonte) : null;
  const festgelegt = block.festgelegt?.zeilen ?? [];
  const top3: BriefingZahlen['top3'] = festgelegt.length
    ? { art: 'festgelegt', titel: festgelegt.map(x => x.titel), erledigt: festgelegt.filter(x => x.erledigt).length }
    : block.vorschlag.length ? { art: 'vorschlag', titel: block.vorschlag.map(x => x.titel), erledigt: 0 } : { art: 'keine', titel: [], erledigt: 0 };
  return {
    tag: t.tag,
    zahlen: {
      sicht: bereich,
      termine: { anzahl: termine.length, ...(erster ? { erster: { uhr: erster.ganztags ? '' : erster.start.slice(11, 16), titel: erster.titel } } : {}) },
      ueberfaellig: z.ueberfaellig, heuteFaellig: z.heuteFaellig, kritisch: z.kritisch,
      // Follow-ups gehören zu Business — `anstehendFuerSpace` hat sie in Privat schon entfernt.
      followups: bereich === 'business' ? (anst?.followups.length ?? 0) : 0,
      freigaben: offen.length, top3, fokus: fokusText,
    },
  };
}

/** Das Briefing der Person für einen Bereich — `null`, wenn dieser Bereich nicht zu ihr gehört. */
export async function briefingLesen(person: string, bereich: TopBereich, jetzt: Date = new Date()): Promise<BriefingAntwort | null> {
  const tag = jetzt.toISOString().slice(0, 13); // pro Stunde — Terminliste und Uhr ändern sich, der Text soll nicht ewig stehen
  return merken(`heute-briefing:${person}:${bereich}:${tag}`, 60_000, async () => {
    const r = await briefingZahlen(person, bereich, jetzt);
    if (!r) return null;
    const saetze = briefingSaetze(r.zahlen);
    return { tag: r.tag, bereich, saetze, text: saetze.join(' '), zahlen: r.zahlen };
  });
}
