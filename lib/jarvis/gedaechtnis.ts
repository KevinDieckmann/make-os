// ─── MAKE OS — Jarvis' Gedächtnis ───────────────────────────────────────────
// Baustein 4a (07.09.). Vorher war Jarvis' Gedächtnis eine Datei mit einem
// einzigen Gespräch: alles, was nicht im laufenden Faden stand, war weg.
//
// Kevins Entscheidung vom 06.09.: „Sofort merken, sichtbar in einer Liste."
// Also kein Vorschlagsstapel für Fakten — er merkt sich etwas im Vorbeigehen,
// und Kevin sieht später, was da steht, und wirft raus, was nicht stimmt.
//
// Bewusst strukturierte Fakten und NICHT Vektorsuche: „wann habe ich Frank
// zuletzt gesprochen" ist eine Frage nach einem Feld, keine nach Ähnlichkeit.
// Der wörtliche Satz bleibt trotzdem erhalten — die Formulierung ist oft die
// eigentliche Information.

import { loadJson, updateJson } from '@/lib/store/local-db';
import { localDay } from '@/lib/zeit';

/** Wozu ein Fakt gehört. Grob genug, dass Jarvis nicht rätselt. */
export type FaktArt = 'person' | 'firma' | 'vorliebe' | 'entscheidung' | 'termin' | 'zahl' | 'sonstiges';

export const ART_LABEL: Record<FaktArt, string> = {
  person: 'Person', firma: 'Firma', vorliebe: 'Vorliebe', entscheidung: 'Entscheidung',
  termin: 'Termin', zahl: 'Zahl', sonstiges: 'Sonstiges',
};

export interface Fakt {
  id: string;
  zeit: string;
  tag: string;
  art: FaktArt;
  /** Worum es geht — „Frank Mathick", „KEMARIS", „Rücken". */
  thema: string;
  /** Der Fakt selbst, so wie er gesagt wurde. */
  satz: string;
  /** Woher er stammt: Kevins Satz, eine Mail, ein Agentenlauf. */
  woher?: string;
  /** Wem er gehört. Vorbereitet für Malins eigenen Raum (Baustein Räume). */
  raum: string;
  /** Ab wann er nicht mehr gilt — für Dinge mit Verfallsdatum. */
  bis?: string;
  geloeschtAm?: string;
}

interface Stand { fakten: Fakt[] }

const GRENZE = 1200;

/** Zwei Fakten sind dasselbe, wenn Thema und Satz übereinstimmen. Verhindert,
 *  dass derselbe Hinweis bei jedem Gespräch erneut abgelegt wird. */
const kennung = (thema: string, satz: string) =>
  `${thema.toLowerCase().trim()}|${satz.toLowerCase().replace(/\s+/g, ' ').trim()}`;

export async function merke(neu: Omit<Fakt, 'id' | 'zeit' | 'tag' | 'raum'> & { raum?: Fakt['raum'] }): Promise<{ fakt: Fakt; neu: boolean }> {
  const fakt: Fakt = {
    ...neu,
    raum: neu.raum ?? 'kevin',
    id: `f-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    zeit: new Date().toISOString(),
    tag: localDay(),
  };
  let warNeu = true;
  await updateJson<Stand>('jarvis-gedaechtnis', current => {
    const liste = (current?.fakten ?? []).filter(f => !f.geloeschtAm);
    const da = liste.find(f => kennung(f.thema, f.satz) === kennung(fakt.thema, fakt.satz));
    if (da) { warNeu = false; return { fakten: current?.fakten ?? [] }; }
    return { fakten: [fakt, ...(current?.fakten ?? [])].slice(0, GRENZE) };
  });
  return { fakt, neu: warNeu };
}

export async function lies(opt: { thema?: string; art?: FaktArt; raum?: Fakt['raum']; anzahl?: number } = {}): Promise<Fakt[]> {
  const s = await loadJson<Stand>('jarvis-gedaechtnis');
  const heute = localDay();
  let liste = (s?.fakten ?? []).filter(f => !f.geloeschtAm && (!f.bis || f.bis >= heute));
  if (opt.raum) liste = liste.filter(f => f.raum === opt.raum || f.raum === 'gemeinsam');
  if (opt.art) liste = liste.filter(f => f.art === opt.art);
  if (opt.thema) {
    const suche = opt.thema.toLowerCase().trim();
    liste = liste.filter(f => f.thema.toLowerCase().includes(suche) || f.satz.toLowerCase().includes(suche));
  }
  return liste.slice(0, opt.anzahl ?? 200);
}

/** Löschen heißt hier: als gelöscht stempeln. Ein Fakt, den Kevin rauswirft,
 *  soll nicht durch einen späteren Import wieder auftauchen. */
export async function vergiss(id: string): Promise<boolean> {
  let gefunden = false;
  await updateJson<Stand>('jarvis-gedaechtnis', current => {
    const liste = current?.fakten ?? [];
    return {
      fakten: liste.map(f => {
        if (f.id !== id || f.geloeschtAm) return f;
        gefunden = true;
        return { ...f, geloeschtAm: new Date().toISOString() };
      }),
    };
  });
  return gefunden;
}

/**
 * Was davon in jeden Prompt gehört. Bewusst knapp: das Gedächtnis wächst, der
 * Platz im Kontext nicht. Neueste zuerst, nach Thema gebündelt, gedeckelt.
 */
export function fuerPrompt(fakten: Fakt[], maxZeichen = 1800): string {
  if (!fakten.length) return '';
  const nachThema = new Map<string, string[]>();
  for (const f of fakten) {
    const liste = nachThema.get(f.thema) ?? [];
    if (liste.length < 4) liste.push(f.satz);
    nachThema.set(f.thema, liste);
  }
  const zeilen: string[] = [];
  let laenge = 0;
  for (const [thema, saetze] of Array.from(nachThema.entries())) {
    const zeile = `- ${thema}: ${saetze.join(' · ')}`;
    if (laenge + zeile.length > maxZeichen) break;
    zeilen.push(zeile);
    laenge += zeile.length;
  }
  return zeilen.join('\n');
}
