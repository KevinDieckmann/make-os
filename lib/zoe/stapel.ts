// ─── MAKE OS — Der Freigabe-Stapel ──────────────────────────────────────────
// Baustein 2 im Kern (07.09.). Alles, was laut Register eine Freigabe braucht,
// wird nicht ausgeführt, sondern hier abgelegt — mit Vorher und Nachher, so
// wie der Trockenlauf es gerechnet hat.
//
// Kevins Vorgabe vom 06.09.: gebündelt, morgens und abends. Deshalb sammelt
// der Stapel, statt zu unterbrechen. Und: einmal freigegeben darf ZOE den
// Auftrag durcharbeiten — das ist das Feld `durcharbeiten`.
//
// Vier Antworten statt zwei (freigeben / ändern / ablehnen / selbst machen):
// die Ablehnung trägt einen Grund, damit ZOE beim nächsten Mal weiß, warum.

//
// 29.09. (B1, Kevin: „Alle Infos müssen immer sauber gespeichert werden“):
//   · Jede Entscheidung trägt, WER entschieden hat (`entschiedenVon`), und geht in derselben Sperre dauerhaft in
//     `zoe-entscheidungen--<haushalt>--<JJJJ-MM>` (lib/zoe/entscheidungen.ts). Gekürzt wird die Arbeitsliste nur um
//     Einträge, die dort schon stehen (`protokolliert`) — Altbestand wird vor dem Kürzen nachgetragen, scheitert das,
//     bleibt er stehen. Nie still.
//   · Freigeben beansprucht den Eintrag zuerst IN der Sperre (`beanspruche` → Status „in_arbeit“), erst dann wird
//     ausgeführt; so führt ein Doppelklick, ein zweites Fenster oder „alle freigeben“ nichts doppelt aus. Schlägt
//     die Ausführung fehl, `loslassen` → wieder „offen“. Ein Anspruch, der älter als ANSPRUCH_MS ist (abgestürzter
//     Lauf), gilt als offen.

import { loadJson, updateJsonAsync } from '@/lib/store/local-db';
import { localDay } from '@/lib/zeit';
import { entscheidungEintrag, haltFest, type EntscheidungArt } from './entscheidungen';
import type { Person } from './raum';
import { neueKennung } from '@/lib/kennung';

export type VorschlagStatus = 'offen' | 'in_arbeit' | 'freigegeben' | 'abgelehnt' | 'fehlgeschlagen';
/** Status, die noch nicht entschieden sind — sie werden nie gekürzt. */
const AKTIV: ReadonlySet<VorschlagStatus> = new Set(['offen', 'in_arbeit']);
/** So lange hält ein Anspruch („in_arbeit“) — danach gilt der Vorschlag wieder als offen. */
export const ANSPRUCH_MS = 10 * 60_000;

/**
 * Arten von Vorschlägen mit eigenem Bezug (28.09., C4). Neue Art: hier ergänzen und in lib/zoe/stapel-arten.ts
 * ihre Freigabe eintragen — der Stapel (Route, Ansicht) behandelt dann alle Arten gleich.
 */
export type StapelArt = 'aufgabe' | 'crm' | 'kalender';
export interface StapelBezug { art: StapelArt; id: string }

export interface Vorschlag {
  id: string;
  zeit: string;
  tag: string;
  werkzeug: string;
  gruppe: string;
  titel: string;
  vorher?: string;
  nachher: string;
  eingabe: Record<string, unknown>;
  /** Warum ZOE das vorschlägt — sein eigener Satz, nicht meiner. */
  anlass?: string;
  /** Wer den Vorschlag ausgelöst hat. */
  person?: Person;
  /**
   * Woher er stammt. Wichtig fürs Etikett: bei einem Vorschlag aus dem
   * Gespräch ist der Anlass Kevins eigener Satz, bei einem aus dem Morgen-
   * oder Abendlauf ist es ZOE' Herleitung. „Weil du gesagt hast" über eine
   * Herleitung zu schreiben, wäre eine kleine Lüge — und Vertrauen bricht an
   * kleinen Lügen.
   */
  quelle?: 'gespraech' | 'lauf';
  /**
   * Worauf sich der Vorschlag bezieht (28.09., C4). Mit Bezug gilt die Freigabe-Funktion seiner Art
   * (lib/zoe/stapel-arten.ts) statt `fuehreAus` — z. B. „aufgabe“: ZOE hat eine Aufgabe vorbereitet.
   */
  bezug?: StapelBezug;
  status: VorschlagStatus;
  entschiedenAm?: string;
  /** Wer entschieden hat (29.09.) — fehlt bei Systemläufen und im Altbestand. */
  entschiedenVon?: string;
  grund?: string;
  /** Ergebnis der Ausführung, sobald freigegeben. */
  ergebnis?: string;
  /** Wer gerade übernimmt (Status „in_arbeit“) und seit wann. */
  inArbeit?: { seit: string; von: string };
  /** Steht dauerhaft in `zoe-entscheidungen` — erst dann darf die Arbeitsliste ihn kürzen. */
  protokolliert?: true;
}

interface Stand { vorschlaege: Vorschlag[] }

/** Mehr als das sammelt niemand ab. Ältere Erledigte fallen hinten raus — nur, wenn sie dauerhaft festgehalten sind. */
const GRENZE = 200;

/**
 * Zwei Vorschläge sind derselbe, wenn sie dasselbe Werkzeug mit derselben
 * Eingabe meinen. Gebildet wie der Schlüssel der Warteschlange — aus der
 * WIRKUNG, nicht aus der Zeit.
 *
 * Aufgefallen am 07.09.: der Morgenlauf lief zweimal (einmal durch den Takt,
 * einmal von Hand) und legte dieselben fünf Vorschläge doppelt hin. Ein
 * Stapel, in dem man dieselbe Sache zweimal wegklicken muss, ist schlimmer
 * als keiner.
 */
function kennung(werkzeug: string, eingabe: Record<string, unknown>): string {
  const sortiert = Object.keys(eingabe).sort().map(k => `${k}=${JSON.stringify(eingabe[k])}`).join('&');
  return `${werkzeug}:${sortiert}`;
}

export async function lege(v: Omit<Vorschlag, 'id' | 'zeit' | 'tag' | 'status'>): Promise<Vorschlag> {
  const vorschlag: Vorschlag = {
    ...v,
    id: neueKennung('v'), // Paket D-C: zufällig, ohne Zeitanteil (lib/kennung.ts)
    zeit: new Date().toISOString(),
    tag: localDay(),
    status: 'offen',
  };
  let schonDa: Vorschlag | undefined;
  await updateJsonAsync<Stand>('zoe-stapel', async current => {
    const liste = current?.vorschlaege ?? [];
    const offen = liste.filter(x => AKTIV.has(x.status));
    // Liegt dieselbe Wirkung schon offen da, kommt nichts Zweites dazu.
    schonDa = offen.find(x => kennung(x.werkzeug, x.eingabe) === kennung(vorschlag.werkzeug, vorschlag.eingabe));
    if (schonDa) return { vorschlaege: liste };
    const erledigt = liste.filter(x => !AKTIV.has(x.status));
    const platz = Math.max(0, GRENZE - offen.length - 1);
    return { vorschlaege: [vorschlag, ...offen, ...erledigt.slice(0, platz), ...(await nichtKuerzbar(erledigt.slice(platz)))] };
  });
  return schonDa ?? vorschlag;
}

/**
 * Was beim Kürzen hinten herausfiele: Protokolliertes darf gehen; Altbestand (ohne `protokolliert`) wird jetzt
 * nachgetragen und geht dann. Scheitert das Nachtragen, bleibt er stehen — die Liste ist dann länger, nie still kürzer.
 */
async function nichtKuerzbar(ueber: Vorschlag[]): Promise<Vorschlag[]> {
  const nach = ueber.filter(x => !x.protokolliert);
  if (!nach.length) return [];
  try {
    await haltFest(nach.map(x => entscheidungEintrag(x, { entscheidung: artVon(x.status), von: x.entschiedenVon, grund: x.grund, ergebnis: x.ergebnis, at: x.entschiedenAm ?? x.zeit, nachgetragen: true })));
    return [];
  } catch (e) {
    console.error('[zoe-stapel] Nachtragen vor dem Kürzen fehlgeschlagen — nichts gekürzt:', e instanceof Error ? e.message : e);
    return nach;
  }
}

const artVon = (s: VorschlagStatus): EntscheidungArt => (s === 'freigegeben' ? 'freigegeben' : s === 'fehlgeschlagen' ? 'fehlgeschlagen' : 'abgelehnt');

/** Ein Anspruch älter als ANSPRUCH_MS ist verwaist (Lauf abgestürzt) — der Vorschlag gilt wieder als offen. */
export function anspruchVerwaist(v: Pick<Vorschlag, 'status' | 'inArbeit'>, jetzt = Date.now()): boolean {
  if (v.status !== 'in_arbeit') return false;
  const seit = Date.parse(v.inArbeit?.seit ?? '');
  return !Number.isFinite(seit) || jetzt - seit > ANSPRUCH_MS;
}
/** Sicht nach außen: ein verwaister Anspruch erscheint als „offen“ (ohne zu schreiben). */
const sicht = (v: Vorschlag): Vorschlag => {
  if (!anspruchVerwaist(v)) return v;
  const { inArbeit: _a, ...rest } = v;
  return { ...rest, status: 'offen' };
};

export async function lies(nur?: VorschlagStatus): Promise<Vorschlag[]> {
  const s = await loadJson<Stand>('zoe-stapel');
  const liste = (s?.vorschlaege ?? []).map(sicht);
  return nur ? liste.filter(x => x.status === nur) : liste;
}

export async function offeneAnzahl(): Promise<number> {
  return (await lies('offen')).length;
}

export async function hole(id: string): Promise<Vorschlag | null> {
  const s = await loadJson<Stand>('zoe-stapel');
  const v = (s?.vorschlaege ?? []).find(x => x.id === id);
  return v ? sicht(v) : null;
}

export type Anspruch = { ok: true; v: Vorschlag } | { ok: false; status: 403 | 404 | 409; fehler: string };

/**
 * Freigeben, Schritt 1 — IN der Sperre: nur ein offener (oder verwaister) Vorschlag, und nur wenn `pruefe` nichts
 * einwendet, wird „in_arbeit“ (mit Person und Zeit). Wer zu spät kommt, bekommt 409 — es wird nichts ausgeführt.
 * Danach: ausführen, dann `entscheide(…, { ausArbeit: true })` bzw. bei Fehler `loslassen`.
 */
export async function beanspruche(id: string, von: string, pruefe?: (v: Vorschlag) => { status: 403 | 404 | 409; fehler: string } | null): Promise<Anspruch> {
  let raus: Anspruch = { ok: false, status: 404, fehler: 'Vorschlag nicht gefunden.' };
  const jetzt = new Date().toISOString();
  await updateJsonAsync<Stand>('zoe-stapel', async current => {
    const liste = current?.vorschlaege ?? [];
    const i = liste.findIndex(x => x.id === id);
    if (i < 0) return { vorschlaege: liste };
    const v = sicht(liste[i]);
    if (v.status === 'in_arbeit') { raus = { ok: false, status: 409, fehler: 'Wird gerade übernommen — nichts doppelt ausgeführt.' }; return { vorschlaege: liste }; }
    if (v.status !== 'offen') { raus = { ok: false, status: 409, fehler: `Schon entschieden (${v.status}).` }; return { vorschlaege: liste }; }
    const nein = pruefe?.(v) ?? null;
    if (nein) { raus = { ok: false, ...nein }; return { vorschlaege: liste }; }
    const neu: Vorschlag = { ...v, status: 'in_arbeit', inArbeit: { seit: jetzt, von: String(von || 'system').slice(0, 40) } };
    raus = { ok: true, v: neu };
    return { vorschlaege: liste.map((x, j) => (j === i ? neu : x)) };
  });
  return raus;
}

/** Ausführung gescheitert: der Anspruch fällt weg, der Vorschlag ist wieder offen. */
export async function loslassen(id: string): Promise<void> {
  await updateJsonAsync<Stand>('zoe-stapel', async current => {
    const liste = current?.vorschlaege ?? [];
    return { vorschlaege: liste.map(x => {
      if (x.id !== id || x.status !== 'in_arbeit') return x;
      const { inArbeit: _a, ...rest } = x;
      return { ...rest, status: 'offen' as const };
    }) };
  });
}

/**
 * Entscheidung festhalten. Die Ausführung selbst passiert in der Route bzw. der Art —
 * der Speicher trifft keine Entscheidungen, er hält sie fest: am Eintrag (Status, Zeit, Person, Grund) und in
 * DERSELBEN Sperre dauerhaft in `zoe-entscheidungen` (lib/zoe/entscheidungen.ts).
 * Nur ein offener Vorschlag wird entschieden — ein „in_arbeit“ nur mit `ausArbeit` (wer ihn beansprucht hat).
 * Sonst `null` (schon entschieden bzw. gerade in Arbeit) — nichts geändert.
 * `zurueck`: abgelehnt und gleich wieder an ZOE gegeben (Aufgaben „nochmal“).
 */
export async function entscheide(
  id: string,
  status: Exclude<VorschlagStatus, 'offen' | 'in_arbeit'>,
  extra?: { grund?: string; ergebnis?: string; eingabe?: Record<string, unknown>; von?: string | null; ausArbeit?: boolean; zurueck?: boolean },
): Promise<Vorschlag | null> {
  let raus: Vorschlag | null = null;
  await updateJsonAsync<Stand>('zoe-stapel', async current => {
    const liste = current?.vorschlaege ?? [];
    const i = liste.findIndex(x => x.id === id);
    if (i < 0) return { vorschlaege: liste };
    const x = sicht(liste[i]);
    if (!(x.status === 'offen' || (x.status === 'in_arbeit' && extra?.ausArbeit))) return { vorschlaege: liste };
    const { inArbeit: _a, ...ohneAnspruch } = x;
    const von = extra?.von && /^[a-z0-9-]{1,40}$/.test(extra.von) ? extra.von : undefined;
    const neu: Vorschlag = {
      ...ohneAnspruch,
      status,
      entschiedenAm: new Date().toISOString(),
      ...(von ? { entschiedenVon: von } : {}),
      ...(extra?.grund ? { grund: extra.grund } : {}),
      ...(extra?.ergebnis ? { ergebnis: extra.ergebnis } : {}),
      ...(extra?.eingabe ? { eingabe: extra.eingabe } : {}),
    };
    // Erst dauerhaft festhalten — gelingt es nicht, steht die Entscheidung trotzdem am Eintrag (ohne `protokolliert`)
    // und wird vor dem Kürzen nachgetragen.
    try {
      await haltFest([entscheidungEintrag(neu, { entscheidung: extra?.zurueck && status === 'abgelehnt' ? 'zurueck' : artVon(status), von, grund: neu.grund, ergebnis: neu.ergebnis, at: neu.entschiedenAm! })]);
      neu.protokolliert = true;
    } catch (e) {
      console.error('[zoe-stapel] Entscheidung nicht dauerhaft festgehalten (wird vor dem Kürzen nachgetragen):', e instanceof Error ? e.message : e);
    }
    raus = neu;
    return { vorschlaege: liste.map((y, j) => (j === i ? neu : y)) };
  });
  // Wichtiges Ereignis fürs Brain: den _App-Spiegel gebündelt nachziehen (nur wenn eingeschaltet, nie blockierend).
  if (raus && process.env.MAKE_OS_APP_SPIEGEL?.trim() === 'an') void import('@/lib/brain/app-spiegel').then(m => m.spiegelAnstossen()).catch(() => {});
  return raus;
}

/**
 * Frist (29.09., Paket D-B #93, Löschklasse „zoe-arbeitslisten“, 90 Tage): ENTSCHIEDENE Vorschläge, die vor `grenze`
 * (Tag) entschieden wurden, fallen weg — offene und laufende nie. Nicht dauerhaft Festgehaltenes wird vorher nachgetragen;
 * scheitert das, bleibt es stehen (nie still). Liefert die Zahl.
 */
export async function stapelFrist(grenze: string): Promise<number> {
  if ((await loadJson<Stand>('zoe-stapel')) === null) return 0;
  let n = 0;
  await updateJsonAsync<Stand>('zoe-stapel', async current => {
    const liste = current?.vorschlaege ?? [];
    const alt = liste.filter(x => !AKTIV.has(x.status) && (x.entschiedenAm ?? x.zeit ?? '').slice(0, 10) < grenze);
    if (!alt.length) return current as Stand;
    const bleibt = new Set((await nichtKuerzbar(alt)).map(x => x.id));
    const weg = new Set(alt.filter(x => !bleibt.has(x.id)).map(x => x.id));
    n = weg.size;
    return n ? { vorschlaege: liste.filter(x => !weg.has(x.id)) } : (current as Stand);
  });
  return n;
}
