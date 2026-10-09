// ─── MAKE OS — ZOE' Gedächtnis ───────────────────────────────────────────
// Baustein 4a (07.09.). Vorher war ZOE' Gedächtnis eine Datei mit einem
// einzigen Gespräch: alles, was nicht im laufenden Faden stand, war weg.
//
// Entscheidung vom 06.09.: „Sofort merken, sichtbar in einer Liste."
// Also kein Vorschlagsstapel für Fakten — ZOE merkt sich etwas im Vorbeigehen,
// und die Person sieht später, was da steht, und wirft raus, was nicht stimmt.
//
// Bewusst strukturierte Fakten und NICHT Vektorsuche: „wann habe ich Anna
// zuletzt gesprochen" ist eine Frage nach einem Feld, keine nach Ähnlichkeit.
// Der wörtliche Satz bleibt trotzdem erhalten — die Formulierung ist oft die
// eigentliche Information.

import { loadJson, updateJson } from '@/lib/store/local-db';
import { localDay } from '@/lib/zeit';
import { neueKennung } from '@/lib/kennung';

/** Wozu ein Fakt gehört. Grob genug, dass ZOE nicht rätselt. */
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
  /** Worum es geht — „Anna Beispiel", „Beispiel GmbH", „Urlaub". */
  thema: string;
  /** Der Fakt selbst, so wie er gesagt wurde. */
  satz: string;
  /** Woher er stammt: ein Satz der Person, eine Mail, ein Agentenlauf. */
  woher?: string;
  /** Wem er gehört: Speichername der Person oder „gemeinsam“ (lib/zoe/raum.ts). Altbestand trägt den Speichernamen, mit dem er
   *  geschrieben wurde — er wird so gelesen, nie umgeschrieben. */
  raum: string;
  /** Ab wann er nicht mehr gilt — für Dinge mit Verfallsdatum. */
  bis?: string;
  geloeschtAm?: string;
}

interface Stand { fakten: Fakt[] }

export const GRENZE = 1200;

/**
 * Über der Grenze wird nie still gekürzt (09.10., Agenten-Datenschicht — vorher `slice(0, 1200)`: der älteste AKTIVE Fakt fiel weg).
 * Platz machen dürfen nur Einträge, die nichts mehr tragen: zuerst die Nachweise vergessener Fakten (älteste zuerst), dann Fakten, deren
 * eigene Frist (`bis`) abgelaufen ist. Reicht das nicht, wird nichts gemerkt: `GedaechtnisVoll` (413-Satz, beginnt mit „Fehlgeschlagen“ —
 * so erkennen Werkzeug-Aufruf und Stapel den Fehlschlag). Rein, getestet (tests/agenten-datenschicht.test.ts).
 */
export class GedaechtnisVoll extends Error {
  readonly status = 413;
  constructor() { super(`Fehlgeschlagen: Das Gedächtnis ist voll (höchstens ${GRENZE.toLocaleString('de-DE')} Fakten) — erst Fakten unter ZOE › Gedächtnis vergessen, dann neu merken. Nichts gemerkt.`); }
}
export function platzMachen(liste: readonly Fakt[], heute: string, grenze = GRENZE): Fakt[] | null {
  if (liste.length <= grenze) return [...liste];
  let ueber = liste.length - grenze;
  const raus = new Set<number>();
  // Liste: neueste zuerst — also von hinten (älteste) her.
  for (const regel of [(f: Fakt) => !!f.geloeschtAm, (f: Fakt) => !f.geloeschtAm && !!f.bis && f.bis < heute]) {
    for (let i = liste.length - 1; i >= 0 && ueber > 0; i--) if (!raus.has(i) && regel(liste[i])) { raus.add(i); ueber--; }
  }
  return ueber > 0 ? null : liste.filter((_, i) => !raus.has(i));
}

/**
 * Ein vergessener Fakt (Nachschliff 09.10.: „vergessen heißt vergessen“): nur Kennung, Raum, Art und die Zeitpunkte bleiben als Nachweis —
 * Thema, Satz, Herkunft und Frist sind weg. Vorher blieb der Satz mit `geloeschtAm` im Bestand (nur ausgeblendet). Rein.
 */
export function vergessenerFakt(f: Fakt): Fakt {
  return { id: f.id, zeit: f.zeit, tag: f.tag, art: f.art, thema: '', satz: '', raum: f.raum, geloeschtAm: f.geloeschtAm ?? new Date().toISOString() };
}
/** Altbestand säubern (beim nächsten Schreiben): vergessene Fakten, die noch Text tragen, auf den Nachweis kürzen. Rein, idempotent. */
export function ohneVergessenenText(liste: readonly Fakt[]): Fakt[] {
  return liste.map(f => (f.geloeschtAm && (f.thema || f.satz || f.woher || f.bis) ? vergessenerFakt(f) : f));
}

/** Zwei Fakten sind dasselbe, wenn Thema und Satz übereinstimmen. Verhindert,
 *  dass derselbe Hinweis bei jedem Gespräch erneut abgelegt wird. */
const kennung = (thema: string, satz: string) =>
  `${thema.toLowerCase().trim()}|${satz.toLowerCase().replace(/\s+/g, ' ').trim()}`;

/** Einen Fakt ablegen — der Raum ist Pflicht (Person oder „gemeinsam“): nie ein Rückfall auf eine feste Person (09.10.). */
export async function merke(neu: Omit<Fakt, 'id' | 'zeit' | 'tag'>): Promise<{ fakt: Fakt; neu: boolean }> {
  const fakt: Fakt = {
    ...neu,
    id: neueKennung('f'),
    zeit: new Date().toISOString(),
    tag: localDay(),
  };
  let warNeu = true;
  await updateJson<Stand>('zoe-gedaechtnis', current => {
    const alle = ohneVergessenenText(current?.fakten ?? []);
    const liste = alle.filter(f => !f.geloeschtAm);
    const da = liste.find(f => kennung(f.thema, f.satz) === kennung(fakt.thema, fakt.satz));
    if (da) { warNeu = false; return { fakten: alle }; }
    const mitNeu = platzMachen([fakt, ...alle], fakt.tag);
    if (!mitNeu) throw new GedaechtnisVoll();
    return { fakten: mitNeu };
  });
  return { fakt, neu: warNeu };
}

export async function lies(opt: { thema?: string; art?: FaktArt; raum?: Fakt['raum']; anzahl?: number } = {}): Promise<Fakt[]> {
  const s = await loadJson<Stand>('zoe-gedaechtnis');
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

/**
 * Vergessen: der Text ist sofort weg (Nachschliff 09.10.) — es bleibt nur der Nachweis „Fakt X am … vergessen“ (`vergessenerFakt`: Kennung,
 * Raum, Art, Zeitpunkte). Altbestand mit `geloeschtAm` und Satz wird dabei mit gesäubert. Art. 15 und Konto-Export zeigen Vergessenes nie.
 */
export async function vergiss(id: string): Promise<boolean> {
  let gefunden = false;
  await updateJson<Stand>('zoe-gedaechtnis', current => {
    const liste = ohneVergessenenText(current?.fakten ?? []);
    return {
      fakten: liste.map(f => {
        if (f.id !== id || f.geloeschtAm) return f;
        gefunden = true;
        return vergessenerFakt({ ...f, geloeschtAm: new Date().toISOString() });
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
