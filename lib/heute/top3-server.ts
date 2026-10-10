// ─── Heute: die Top 3 des Tages — Server (10.10., Branch `heute-top3`) ─────────────────────────────────────────────────────────
// Lesen: die Aufgaben der Person durch die EINE Sicht (`ladeAufgabenSicht`: „nur ich“ anderer nie, Konto „nur Business“ ohne Privat), nur der
// gefragte Bereich, ZOEs Vorschlag als Regelwerk (./top3.ts). Schreiben: nur die eigene Festlegung im Bestand `heute-top3--<person>` — immer mit
// Suffix, einer je Person; Privat und Business getrennt in der Datei, der Server liefert nie den anderen Bereich. Kein Modell, kein Netz.

import { loadJson, updateJson } from '@/lib/store/local-db';
import { ladeAufgabenSicht, orgZuordnung } from '@/lib/aufgaben/sicht';
import { kontoSicht } from '@/lib/zugang/konto-sicht-server';
import { wandzeit, tagVon } from '@/lib/kalender/zeit';
import { meilensteinListeId } from '@/lib/planung/meilenstein-aufgaben';
import { eigeneMeilensteineRoh } from '@/lib/planung/eigene-meilensteine-server';
import type { Meilenstein } from '@/lib/planung/typen';
import type { Task, TasksState } from '@/types/tasks';
import { spaceVonAufgabe } from '@/lib/make-one/space-regeln';
import {
  alsZeile, aufgabenZaehler, blockiertJeAufgabe, festgelegteZeile, istOffen, leereTop3Datei, top3Kandidaten, top3Pruefen, top3Saeubern, top3Setzen, top3Vorschlag,
  TOP3_AUSWAHL_MAX, type Top3Block, type Top3Datei, type Top3Kontext, type Top3Wahl, type TopBereich,
} from './top3';

/** Der Bestand einer Person — IMMER mit Suffix (auch das Erstkonto): `PERSON_BESTAENDE` (Export, Löschen), Register `heute-top3--*`. */
export const top3Name = (person: string) => `heute-top3--${person.replace(/[^a-z0-9-]/g, '')}`;

/** Frist (YYYY-MM-DD) offener Meilensteine je Aufgaben-Liste — nur das Datum, nie ein Titel (die Sicht der Aufgabe ist schon gefiltert). */
async function meilensteinFristen(person: string, state: TasksState): Promise<Map<string, string>> {
  const m = new Map<string, string>();
  if (!state.tasks.some(t => t.listeId?.startsWith('lm-') && istOffen(t))) return m;
  const f = await loadJson<{ meilensteine?: Meilenstein[] }>('meilensteine').catch(() => null);
  const eigene = await eigeneMeilensteineRoh(person).catch(() => []);
  for (const x of [...(f?.meilensteine ?? []), ...eigene]) {
    if (x.faellig && /^\d{4}-\d{2}-\d{2}$/.test(x.faellig) && !x.erledigt && !x.archiviertAm) m.set(meilensteinListeId(x.id), x.faellig);
  }
  return m;
}

export interface TagesZahlen { ueberfaellig: number; heuteFaellig: number; kritisch: number }
export interface TagesDaten {
  tag: string;
  bloecke: Partial<Record<TopBereich, Top3Block>>;
  zahlen: Partial<Record<TopBereich, TagesZahlen>>;
}

/** Die Bereiche, die diese Person sehen darf (ein Konto „nur Business“ bekommt Privat nie). */
async function erlaubteBereiche(person: string, gefragt: readonly TopBereich[]): Promise<TopBereich[]> {
  const k = await kontoSicht(person);
  if (!k?.imHaushalt) return [];
  return gefragt.filter(b => b === 'business' || k.privat);
}

const wahlBlock = (state: TasksState, wahl: Top3Wahl | undefined, bereich: TopBereich, kontext: Top3Kontext, projekt: (id: string) => string | undefined) => {
  if (!wahl) return null;
  const nachId = new Map(state.tasks.map(t => [t.id, t]));
  const zeilen = wahl.ids.map(id => nachId.get(id))
    .filter((t): t is Task => !!t && !t.archiviertAm && !t.geloeschtAm && t.status !== 'cancelled' && spaceVonAufgabe(t, kontext.orgs ?? {}) === bereich)
    .map(t => festgelegteZeile(t, bereich, kontext, projekt));
  return { zeilen, am: wahl.am, von: wahl.von };
};

/**
 * Top 3 und Tageszahlen der Person für die gefragten Bereiche. Liest nur — die Festlegung steht im eigenen Bestand, der Vorschlag wird bei jedem
 * Aufruf frisch gerechnet (Regelwerk, wenige Millisekunden). Nur die Person selbst ruft das auf (Route: `eigenePerson`).
 */
export async function tagesDaten(person: string, jetzt: Date, gefragt: readonly TopBereich[] = ['privat', 'business']): Promise<TagesDaten> {
  const tag = tagVon(wandzeit(jetzt));
  const bereiche = await erlaubteBereiche(person, gefragt);
  const aus: TagesDaten = { tag, bloecke: {}, zahlen: {} };
  if (!bereiche.length) return aus;
  const [state, orgs, roh] = await Promise.all([ladeAufgabenSicht(person), orgZuordnung(), loadJson<unknown>(top3Name(person)).catch(() => null)]);
  const datei = top3Saeubern(roh);
  const kontext: Top3Kontext = { heute: tag, person, blockiert: blockiertJeAufgabe(state.tasks), msFrist: await meilensteinFristen(person, state), orgs };
  const projekt = (id: string) => state.projects.find(p => p.id === id)?.title;
  for (const b of bereiche) {
    const kandidaten = top3Kandidaten(state.tasks, b, kontext, projekt);
    const wahl = datei.tage[tag]?.[b];
    aus.bloecke[b] = {
      bereich: b,
      vorschlag: top3Vorschlag(kandidaten).map(alsZeile),
      festgelegt: wahlBlock(state, wahl, b, kontext, projekt),
      auswahl: kandidaten.slice(0, TOP3_AUSWAHL_MAX).map(alsZeile),
      stand: wahl?.am ?? '',
    };
    aus.zahlen[b] = aufgabenZaehler(state.tasks, person, b, tag, orgs);
  }
  return aus;
}

class StandVeraltet extends Error {}

export type Top3Antwort =
  | { ok: true; block: Top3Block }
  | { ok: false; status: 400 | 403 | 409; fehler: string; block?: Top3Block };

/**
 * Die Top 3 festlegen (`ids` = 1 bis 3 Aufgaben dieses Bereichs, der Person zugewiesen, offen) oder zurücksetzen (`ids` = null → ZOEs Vorschlag gilt
 * wieder). `stand` = der Stand aus der letzten Antwort: hat sich die Festlegung inzwischen geändert (anderes Fenster), 409 mit dem aktuellen Block,
 * nichts überschrieben. Ein Konto „nur Business“ legt in Privat nichts fest (403).
 */
export async function top3Festlegen(person: string, o: { bereich: TopBereich; ids: unknown | null; stand?: string }, jetzt: Date = new Date()): Promise<Top3Antwort> {
  const erlaubt = await erlaubteBereiche(person, [o.bereich]);
  if (!erlaubt.length) return { ok: false, status: 403, fehler: o.bereich === 'privat' ? 'Dieses Konto hat keinen Privat-Bereich.' : 'Dieses Konto gehört zu keinem Haushalt.' };
  const aktuell = async (): Promise<Top3Block> => (await tagesDaten(person, jetzt, [o.bereich])).bloecke[o.bereich]!;
  let wahl: Top3Wahl | null = null;
  if (o.ids !== null) {
    const p = top3Pruefen(o.ids);
    if (!p.ok) return { ok: false, status: 400, fehler: p.fehler };
    // Jede Aufgabe muss in dieser Sicht der Person liegen: gesehen, offen, ihr zugewiesen, in diesem Bereich — sonst 400 ohne Namen.
    const [state, orgs, roh] = await Promise.all([ladeAufgabenSicht(person), orgZuordnung(), loadJson<unknown>(top3Name(person)).catch(() => null)]);
    const nachId = new Map(state.tasks.map(t => [t.id, t]));
    // Eine heute schon festgelegte Aufgabe darf bleiben, auch wenn sie inzwischen erledigt ist (sie steht als Haken in der Liste).
    const bisher = new Set(top3Saeubern(roh).tage[tagVon(wandzeit(jetzt))]?.[o.bereich]?.ids ?? []);
    for (const id of p.ids) {
      const t = nachId.get(id);
      if (!t || t.archiviertAm || t.geloeschtAm || t.status === 'cancelled' || (!istOffen(t) && !bisher.has(id)) || t.assignee !== person || spaceVonAufgabe(t, orgs) !== o.bereich) return { ok: false, status: 400, fehler: `Eine der Aufgaben gehört nicht in die Top 3 ${o.bereich === 'privat' ? 'Privat' : 'Business'} (nicht offen, nicht dir zugewiesen oder aus dem anderen Bereich). Nichts gespeichert.` };
    }
    const vorschlag = (await aktuell()).vorschlag.map(z => z.id);
    const gleich = p.ids.length === vorschlag.length && p.ids.every(id => vorschlag.includes(id));
    wahl = { ids: p.ids, am: jetzt.toISOString(), von: gleich ? 'vorschlag' : 'hand' };
  }
  const tag = tagVon(wandzeit(jetzt));
  let konflikt = false;
  try {
    await updateJson<Top3Datei>(top3Name(person), cur => {
      const d = top3Saeubern(cur ?? leereTop3Datei());
      // Wirft `mutate`, wird nichts geschrieben (lib/store/local-db.ts) — so legt auch ein Konflikt keine leere Datei an.
      if (o.stand !== undefined && o.stand !== (d.tage[tag]?.[o.bereich]?.am ?? '')) throw new StandVeraltet();
      return top3Setzen(d, tag, o.bereich, wahl);
    });
  } catch (e) { if (e instanceof StandVeraltet) konflikt = true; else throw e; }
  if (konflikt) return { ok: false, status: 409, fehler: 'Die Top 3 wurden inzwischen woanders geändert — hier steht der aktuelle Stand. Nichts überschrieben.', block: await aktuell() };
  return { ok: true, block: await aktuell() };
}
