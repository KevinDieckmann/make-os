// ─── Agenten-Bereich: Ablage der Threads — Index + je Thread (09.10., E3 „Gesprächs-Ablage teilen“; ANALYSE_AGENTEN_DATEN.md 5 C) ───
// Entscheidung 09.10. (E3): „Ja, jetzt“ — solange nichts davon online ist. Vorher war `agenten-faeden--<person>` EINE Datei mit allen Threads, Nachrichten,
// Brettern und Plänen: jede Nachricht schrieb (entschlüsseln, parsen, verschlüsseln, fsync) die ganze Datei, der Takt las sie jede Minute zweimal,
// „Läuft“ alle 30 s — auf 1 vCPU blockiert das. Jetzt:
//   • Index `agenten-faeden--<person>` (`fadenBestand`, `FadenIndexKern`): je Thread nur der Kopf (`kopfVon` in faeden.ts — Kennung, Agent, Titel,
//     Status, Lauf, Skill/Plan, Zeiten, Zähler) und das Gedächtnis „Persönlich“. Takt, Läufe, „Als Nächstes“, die Liste lesen NUR ihn.
//   • je Thread `agenten-faden--<person>--<id>` (`fadenDateiBestand`, `FadenDateiKern`): der ganze Thread.
// Schreiben NUR hier (über faeden-server.ts): `ablageAendern` hält die Sperre des INDEX (Rangfolge: erst Index, dann Thread — jeder Thread wird
// nur in der Sperre seines Index geschrieben), lädt nur die Threads, die die Änderung braucht, schreibt geänderte Threads und dann den Index (der
// Kopf kommt immer aus dem geschriebenen Thread). Entfernte Threads verlassen erst den Index, dann geht ihre Datei (samt Tagessicherungen).
// Ein Thread, der (nach einem Absturz) ohne Kopf liegt, gilt nicht — `fadenLesen` liest nur Threads des Index; der Morgenlauf räumt Waisen.
// Altbestand (eine Datei mit allen Threads — Demo, lokal, Tests): Lesen versteht ihn ohne zu schreiben; das erste Schreiben zieht ihn EINMAL um
// (Archivkopie `agenten-vor-teilung-<person>-<zeit>.json` zuerst, dann je Thread eine Datei, dann der Index — idempotent, ohne Verlust).

import { promises as fs } from 'fs';
import path from 'path';
import { bestandEntfernen, datenOrdner, loadJson, saveJson, speicherStand, updateJsonAsync } from '@/lib/store/local-db';
import { fadenBestand, fadenDateiBestand } from './typen';
import {
  fadenHinzuPruefen, fehler, istAblageId, istIndex, kopfVon, ohneAbgelaufene, teilen,
  type Fehler, type FadenBestandKern, type FadenDateiKern, type FadenIndexKern, type FadenKern, type FadenKopfKern,
} from './faeden';

const PERSON = /^[a-z0-9-]{1,40}$/;
const leerIndex = (): FadenIndexKern => ({ v: 2, faeden: [] });
/** Archivkopie vor dem Umzug — Präfix gehört zu den Umzugs-Kopien (Frist „archiv-umzug“, lib/crm/loeschfristen.ts `istUmzugsKopie`). */
export const TEILUNG_KOPIE = 'agenten-vor-teilung-';

// ── Lesen ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

type Roh = { art: 'index'; index: FadenIndexKern } | { art: 'alt'; alt: FadenBestandKern; index: FadenIndexKern } | { art: 'leer'; index: FadenIndexKern };

/** Gelesener Index je Person — gültig, solange sich der Bestand nicht ändert (Stand aus local-db: Inode, Zeit, Größe, Schreibzähler). */
const glob = globalThis as unknown as { __makeosFadenIndex?: Map<string, { stand: string; roh: Roh }> };
const zwischen = (glob.__makeosFadenIndex ??= new Map());

const normal = (f: FadenKern): FadenKern => ({ ...f, nachrichten: Array.isArray(f.nachrichten) ? f.nachrichten : [] });

async function rohLesen(person: string): Promise<Roh> {
  const name = fadenBestand(person);
  const stand = await speicherStand([name]);
  const da = zwischen.get(person);
  if (da && da.stand === stand) return da.roh;
  const b = await loadJson<FadenIndexKern | FadenBestandKern>(name);
  let roh: Roh;
  if (!b) roh = { art: 'leer', index: leerIndex() };
  else if (istIndex(b)) roh = { art: 'index', index: { ...b, faeden: b.faeden.filter(k => k && istAblageId(k.id)) } };
  else {
    const { teilung: _t, ...index } = teilen(b as FadenBestandKern, '').index; // im Speicher gelesen — umgezogen ist noch nichts
    roh = { art: 'alt', alt: { ...(b as FadenBestandKern), faeden: Array.isArray(b.faeden) ? (b.faeden as FadenKern[]).filter(f => f && istAblageId(f.id)).map(normal) : [] }, index };
  }
  if (zwischen.size > 200) zwischen.clear();
  zwischen.set(person, { stand, roh });
  return roh;
}

/**
 * Der Index der Person (Köpfe + Gedächtnis) — schreibt nie. Altbestand wird im Speicher gelesen (Köpfe abgeleitet), nicht umgezogen. Die Köpfe
 * nicht verändern (sie sind zwischengespeichert) — immer neue Objekte bauen.
 */
export async function indexLesen(person: string): Promise<FadenIndexKern> {
  if (!PERSON.test(person)) return leerIndex();
  const r = await rohLesen(person);
  return { ...r.index, faeden: [...r.index.faeden] };
}

async function dateiLesen(person: string, id: string): Promise<FadenKern | null> {
  const d = await loadJson<FadenDateiKern>(fadenDateiBestand(person, id));
  return d?.faden && d.faden.id === id ? normal(d.faden) : null;
}

/** EIN ganzer Thread der Person — nur, wenn sein Kopf im Index steht (sonst null). Schreibt nie. */
export async function fadenLesen(person: string, id: string): Promise<FadenKern | null> {
  if (!PERSON.test(person) || !istAblageId(id)) return null;
  const r = await rohLesen(person);
  if (r.art === 'alt') return r.alt.faeden.find(f => f.id === id) ?? null;
  if (!r.index.faeden.some(k => k.id === id)) return null;
  return dateiLesen(person, id);
}

/** Ganze Threads zu Köpfen (Reihenfolge bleibt; fehlende Dateien fallen weg). Für Leser, die Nachrichten brauchen — nur die nötigen laden. */
export async function faedenLesen(person: string, koepfe: readonly Pick<FadenKopfKern, 'id'>[]): Promise<FadenKern[]> {
  const raus: FadenKern[] = [];
  for (const k of koepfe) { const f = await fadenLesen(person, k.id); if (f) raus.push(f); }
  return raus;
}

/** ALLE Threads der Person ganz (Index → je Thread die Datei). Teuer — nur für Prüfungen, Werkzeuge und Tests, nie im Takt oder in Listen. */
export async function alleFaedenLesen(person: string): Promise<FadenKern[]> {
  if (!PERSON.test(person)) return [];
  const r = await rohLesen(person);
  if (r.art === 'alt') return r.alt.faeden;
  return faedenLesen(person, r.index.faeden);
}

// ── Schreiben ───────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Was eine Änderung sieht und tun darf — alles in der Sperre des Index. */
export interface Arbeit {
  readonly jetzt: string;
  /** Der Index mit den Änderungen dieser Arbeit (Köpfe, Gedächtnis). */
  index(): FadenIndexKern;
  /** Kopf eines Threads (oder null — gibt es nicht bzw. schon entfernt). */
  kopf(id: string): FadenKopfKern | null;
  /** Den ganzen Thread laden (einmal je Arbeit). */
  faden(id: string): Promise<FadenKern | null>;
  /** Einen geänderten Thread festhalten — er muss im Index stehen. */
  setze(f: FadenKern): void;
  /** Neuen Thread anlegen — schon da 409, über der Grenze 413 (nie kürzen). */
  hinzu(f: FadenKern): Fehler | null;
  /** Threads entfernen (Kopf sofort, Datei nach dem Schreiben des Index). */
  entferne(ids: Iterable<string>): void;
  /** Gedächtnis bzw. Marke der ZOE-Übernahme ändern (nie die Köpfe). */
  indexFelder(fn: (i: Omit<FadenIndexKern, 'v' | 'faeden'>) => Omit<FadenIndexKern, 'v' | 'faeden'>): void;
}

class Arbeitsstand implements Arbeit {
  private koepfe: FadenKopfKern[];
  private zusatz: Omit<FadenIndexKern, 'v' | 'faeden'>;
  private readonly ganze = new Map<string, FadenKern>();
  readonly geaendert = new Set<string>();
  readonly entfernt = new Set<string>();
  constructor(private readonly person: string, i: FadenIndexKern, readonly jetzt: string) {
    const { v: _v, faeden, ...zusatz } = i;
    this.koepfe = [...faeden];
    this.zusatz = zusatz;
  }
  index(): FadenIndexKern { return { v: 2, ...this.zusatz, faeden: this.koepfe }; }
  kopf(id: string): FadenKopfKern | null { return this.koepfe.find(k => k.id === id) ?? null; }
  async faden(id: string): Promise<FadenKern | null> {
    if (!this.kopf(id)) return null;
    const g = this.ganze.get(id);
    if (g) return g;
    const f = await dateiLesen(this.person, id);
    if (f) this.ganze.set(id, f);
    return f;
  }
  setze(f: FadenKern): void {
    const i = this.koepfe.findIndex(k => k.id === f.id);
    if (i < 0) throw new Error(`[agenten-ablage] Thread ${f.id} steht nicht im Index — erst hinzu().`);
    this.ganze.set(f.id, f);
    this.geaendert.add(f.id);
    this.koepfe[i] = kopfVon(f, this.jetzt);
  }
  hinzu(f: FadenKern): Fehler | null {
    if (!istAblageId(f.id)) return fehler(400, 'Thread-Kennung ungültig.');
    const x = fadenHinzuPruefen(this.koepfe, f.id);
    if (x) return x;
    this.koepfe.push(kopfVon(f, this.jetzt));
    this.ganze.set(f.id, f);
    this.geaendert.add(f.id);
    this.entfernt.delete(f.id);
    return null;
  }
  entferne(ids: Iterable<string>): void {
    const weg = new Set(ids);
    if (!weg.size) return;
    this.koepfe = this.koepfe.filter(k => !weg.has(k.id));
    for (const id of weg) { this.entfernt.add(id); this.geaendert.delete(id); this.ganze.delete(id); }
  }
  indexFelder(fn: (i: Omit<FadenIndexKern, 'v' | 'faeden'>) => Omit<FadenIndexKern, 'v' | 'faeden'>): void {
    const { v: _v, faeden: _f, ...rest } = fn(this.zusatz) as FadenIndexKern;
    this.zusatz = rest;
  }
  /** Geänderte Threads schreiben (in der Sperre des Index — der Thread hat seine eigene, verschachtelt). */
  async schreiben(): Promise<void> {
    for (const id of this.geaendert) {
      const f = this.ganze.get(id);
      if (f) await saveJson<FadenDateiKern>(fadenDateiBestand(this.person, id), { v: 1, faden: f });
    }
  }
}

class Abbruch extends Error { constructor(readonly f: Fehler) { super(f.fehler); } }

/** Thread-Dateien nach dem Index entfernen (samt Tagessicherungen). Ein Fehler bleibt eine Waise — der Morgenlauf räumt sie. */
async function dateienEntfernen(person: string, ids: Iterable<string>): Promise<void> {
  for (const id of ids) {
    await bestandEntfernen(fadenDateiBestand(person, id), { tageskopien: true })
      .catch(e => console.error('[agenten-ablage] Thread-Datei nicht entfernt (Waise, Morgenlauf räumt):', e instanceof Error ? e.message.slice(0, 120) : e));
  }
}

/**
 * Altbestand EINMAL umziehen (idempotent): Archivkopie, je Thread eine Datei, dann der Index. Schon Index bzw. nichts da → null (nichts getan).
 * Sonst die Zahl der umgezogenen Threads.
 */
export async function ablageUmziehen(person: string, jetzt = new Date().toISOString()): Promise<number | null> {
  if (!PERSON.test(person)) return null;
  const name = fadenBestand(person);
  // Gelesen über den Zwischenspeicher (Stand) — jedes Schreiben fragt hier zuerst; der Index wird dafür nicht jedes Mal neu geparst.
  if ((await rohLesen(person)).art !== 'alt') return null;
  let n: number | null = null;
  await updateJsonAsync<FadenIndexKern>(name, async cur => {
    if (!cur) return leerIndex();
    if (istIndex(cur)) return cur;
    const t = await umzugInDerSperre(person, cur, jetzt);
    n = t.faeden.length;
    return t.index;
  });
  return n;
}

/** Der Umzug selbst — NUR in der Sperre des Index aufrufen: Archivkopie, dann je Thread die Datei; zurück kommt der Index (noch ungeschrieben). */
async function umzugInDerSperre(person: string, cur: unknown, jetzt: string): Promise<{ index: FadenIndexKern; faeden: FadenKern[] }> {
  const roh = cur as FadenBestandKern;
  // Nie Nachrichten verlieren: ein Eintrag OHNE Nachrichten (ein Kopf, den jemand als Altbestand zurückgeschrieben hat), dessen Thread-Datei es
  // schon gibt, behält Nachrichten, Bretter, Pläne und Kurzfassung der Datei — nur seine Kopf-Felder gelten.
  const faeden: FadenKern[] = [];
  for (const f of Array.isArray(roh?.faeden) ? roh.faeden : []) {
    if (!f || typeof f !== 'object' || !istAblageId(f.id) || Array.isArray((f as Partial<FadenKern>).nachrichten)) { faeden.push(f); continue; }
    const da = await dateiLesen(person, f.id);
    if (!da) { faeden.push(f); continue; }
    const { zaehler: _z, letzte: _l, letzteAntwort: _a, geschrieben: _g, ...kopf } = f as FadenKern & Partial<FadenKopfKern>;
    faeden.push({ ...da, ...kopf, nachrichten: da.nachrichten, ...(da.bretter ? { bretter: da.bretter } : {}), ...(da.plaene ? { plaene: da.plaene } : {}), ...(da.kurzfassung ? { kurzfassung: da.kurzfassung } : {}) });
  }
  const alt: FadenBestandKern = { ...roh, faeden };
  const t = teilen(alt, jetzt);
  if (t.faeden.length || alt.gedaechtnis || alt.zoeUebernahme) {
    const { archivSchreiben, archivZeit } = await import('@/lib/store/archiv');
    await archivSchreiben(`${TEILUNG_KOPIE}${person}-${archivZeit(jetzt)}.json`, alt);
  }
  for (const f of t.faeden) await saveJson<FadenDateiKern>(fadenDateiBestand(person, f.id), { v: 1, faden: f });
  return t;
}

/**
 * EINE Änderung an der Ablage der Person — in der Sperre des Index. `fn` arbeitet über `Arbeit` (lädt nur, was sie braucht) und liefert ein
 * Ergebnis oder einen Fehler (dann wird nichts geschrieben). Abgelaufene Threads (Löschfrist, `fristMonate`) fallen dabei heraus — wie vorher bei
 * jedem Schreiben. Altbestand zieht vorher um.
 */
export async function ablageAendern<E>(person: string, fn: (t: Arbeit) => Promise<{ e: E } | Fehler> | { e: E } | Fehler, o: { jetzt?: string; fristMonate?: number } = {}): Promise<{ ok: true; e: E; index: FadenIndexKern } | Fehler> {
  if (!PERSON.test(person)) return fehler(400, 'Person ungültig.');
  const jetzt = o.jetzt ?? new Date().toISOString();
  await ablageUmziehen(person, jetzt);
  let ergebnis: E | undefined;
  let weg: string[] = [];
  try {
    const neu = await updateJsonAsync<FadenIndexKern>(fadenBestand(person), async cur => {
      // Altbestand (auch einer, der nach dem Umzug von außen wieder hingeschrieben wurde) zieht hier in der Sperre um — nie überschreiben.
      const basis: FadenIndexKern = istIndex(cur) ? cur : cur ? (await umzugInDerSperre(person, cur, jetzt)).index : leerIndex();
      const frist = o.fristMonate === undefined ? basis : ohneAbgelaufene(basis, jetzt, o.fristMonate);
      const abgelaufen = basis.faeden.filter(k => !frist.faeden.some(x => x.id === k.id)).map(k => k.id);
      const t = new Arbeitsstand(person, frist, jetzt);
      const r = await fn(t);
      if ('ok' in r && r.ok === false) throw new Abbruch(r);
      await t.schreiben();
      ergebnis = (r as { e: E }).e;
      weg = [...abgelaufen, ...t.entfernt];
      return t.index();
    });
    if (weg.length) await dateienEntfernen(person, weg);
    return { ok: true, e: ergebnis as E, index: neu };
  } catch (x) {
    if (x instanceof Abbruch) return x.f;
    throw x;
  }
}

// ── Pflege (Morgenlauf), Konto löschen ──────────────────────────────────────────────────────────────────────────────────

/** Namen der Thread-Dateien einer Person im Datenordner (ohne `.json`). */
export async function fadenDateienVon(person: string): Promise<string[]> {
  if (!PERSON.test(person)) return [];
  const vorn = `agenten-faden--${person}--`;
  return (await fs.readdir(datenOrdner()).catch(() => [] as string[]))
    .filter(n => n.startsWith(vorn) && n.endsWith('.json') && istAblageId(n.slice(vorn.length, -5)))
    .map(n => n.slice(0, -5));
}

/**
 * Index und Dateien in Einklang bringen (Morgenlauf, idempotent, in der Sperre des Index): Thread-Dateien ohne Kopf (Waisen nach einem Absturz)
 * gehen, Köpfe ohne Datei (die Datei fehlt) fallen aus dem Index. Nur Zahlen zurück.
 */
export async function ablageAbgleichen(person: string): Promise<{ waisen: number; ohneDatei: number }> {
  const nichts = { waisen: 0, ohneDatei: 0 };
  if (!PERSON.test(person)) return nichts;
  const vorn = `agenten-faden--${person}--`;
  const dateienJetzt = async () => new Set((await fadenDateienVon(person)).map(n => n.slice(vorn.length)));
  // Erst ohne Sperre nachsehen — meist ist alles im Einklang (dann nichts sperren, nichts schreiben).
  const index = await rohLesen(person);
  if (index.art !== 'index') return nichts; // Altbestand: zieht beim nächsten Schreiben um
  const da0 = await dateienJetzt();
  const ids0 = new Set(index.index.faeden.map(k => k.id));
  if (![...da0].some(id => !ids0.has(id)) && !index.index.faeden.some(k => !da0.has(k.id))) return nichts;
  let r = nichts;
  try {
    await updateJsonAsync<FadenIndexKern>(fadenBestand(person), async cur => {
      if (!istIndex(cur)) throw new Nichts();
      // In der Sperre neu — kein Schreiber des Index (und damit keiner seiner Threads) läuft gleichzeitig.
      const da = await dateienJetzt();
      const imIndex = new Set(cur.faeden.map(k => k.id));
      const waisen = [...da].filter(id => !imIndex.has(id));
      for (const id of waisen) await bestandEntfernen(fadenDateiBestand(person, id), { tageskopien: true });
      const rest = cur.faeden.filter(k => da.has(k.id));
      r = { waisen: waisen.length, ohneDatei: cur.faeden.length - rest.length };
      return r.ohneDatei ? { ...cur, faeden: rest } : cur;
    });
  } catch (x) { if (!(x instanceof Nichts)) throw x; }
  return r;
}
class Nichts extends Error {}

/** Archivkopien vor dem Umzug einer Person entfernen (Konto löschen) — sonst lägen ihre Threads dort bis zur Frist (30 Tage). */
export async function teilungsKopienEntfernen(person: string): Promise<number> {
  if (!PERSON.test(person)) return 0;
  const { archivOrdner } = await import('@/lib/store/archiv');
  const vorn = `${TEILUNG_KOPIE}${person}-`;
  let n = 0;
  for (const d of await fs.readdir(archivOrdner()).catch(() => [] as string[])) {
    if (!d.startsWith(vorn) || !d.endsWith('.json') || !/^\d{4}-\d{2}-\d{2}T/.test(d.slice(vorn.length))) continue;
    await fs.unlink(path.join(archivOrdner(), d)).then(() => { n++; }).catch(() => {});
  }
  return n;
}
