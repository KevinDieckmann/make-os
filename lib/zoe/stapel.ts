// ─── MAKE OS — Der Freigabe-Stapel ──────────────────────────────────────────
// Baustein 2 im Kern (07.09.). Alles, was laut Register eine Freigabe braucht,
// wird nicht ausgeführt, sondern hier abgelegt — mit Vorher und Nachher, so
// wie der Trockenlauf es gerechnet hat.
//
// Vorgabe vom 06.09.: gebündelt, morgens und abends. Deshalb sammelt
// der Stapel, statt zu unterbrechen. Und: einmal freigegeben darf ZOE den
// Auftrag durcharbeiten — das ist das Feld `durcharbeiten`.
//
// Vier Antworten statt zwei (freigeben / ändern / ablehnen / selbst machen):
// die Ablehnung trägt einen Grund, damit ZOE beim nächsten Mal weiß, warum.

//
// 29.09. (B1, Vorgabe „Alle Infos müssen immer sauber gespeichert werden“):
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
import type { AgentenStapelArt } from '@/lib/agenten/typen';
import { bereichVonSpace, istSpaceId } from '@/lib/aufgaben/struktur';
import { finanzOrtAus } from '@/lib/einheiten';
import { BUSINESS_GRUPPEN, PRIVAT_GRUPPEN, bereichAus, passtZurSicht, type Bereich, type BereichNennt, type BereichOrt, type BereichQuelle } from './bereich';
import { fingerabdruck } from '@/lib/store/fingerabdruck';

export type VorschlagStatus = 'offen' | 'in_arbeit' | 'freigegeben' | 'abgelehnt' | 'fehlgeschlagen';
/** Status, die noch nicht entschieden sind — sie werden nie gekürzt. */
const AKTIV: ReadonlySet<VorschlagStatus> = new Set(['offen', 'in_arbeit']);
/** So lange hält ein Anspruch („in_arbeit“) — danach gilt der Vorschlag wieder als offen. */
export const ANSPRUCH_MS = 10 * 60_000;

/**
 * Arten von Vorschlägen mit eigenem Bezug (28.09., C4). Neue Art: hier ergänzen und in lib/zoe/stapel-arten.ts
 * ihre Freigabe eintragen — der Stapel (Route, Ansicht) behandelt dann alle Arten gleich.
 * Agenten-Bereich (08.10. spät, Paket 0 „Vertrag“): `skill` · `mitarbeiter` · `merksatz` (lib/agenten/typen.ts) — anlegen tut Paket 1
 * (Head-Chat), die Freigabe baut Paket 3 in stapel-arten.ts; bis dahin ist eine Freigabe dieser Arten 409 (unbekannte Art).
 */
// Medien unterwegs (09.10., Paket 5): `medien` — ein Head schlägt Auswahl, Zuschnitte und Texte zu Medien eines Auftrags vor (lib/medien/heads.ts).
export type StapelArt = 'aufgabe' | 'crm' | 'kalender' | 'medien' | AgentenStapelArt;
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
   * Gespräch ist der Anlass der eigene Satz der Person, bei einem aus dem Morgen-
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
  /**
   * Bereich (09.10. spät, Wunsch: „ZOE muss unterscheiden, wo wir schreiben … und das dem richtigen Stapel zuordnen“): wohin der Vorschlag
   * gehört — gesetzt von `lege` über die EINE Regel (lib/zoe/bereich.ts `bereichFuerVorschlag`) bzw. von Hand (`bereichSetzen`). FEHLT das
   * Feld, ist er „unklar“ (auch der Altbestand): er steht in Privat UND Business oben, mit „Bereich wählen“.
   */
  bereich?: Bereich;
  /** Woher der Bereich kommt: Bezug · Inhalt · Gespräch · von Hand. */
  bereichQuelle?: BereichQuelle;
  /** Gesellschaft bzw. Mandanten-Space, wenn eindeutig (nur Anzeige). */
  bereichOrt?: BereichOrt;
  /** CRM-Kennungen, die der Inhalt nennt (höchstens 3) — für den Weg „in der Markttraktion festhalten“. Nur Kennungen, nie Namen. */
  bereichNennt?: BereichNennt[];
  /** Wer den Bereich von Hand gesetzt hat (Speichername). */
  bereichVon?: string;
}

/** Die Bereichs-Felder eines Vorschlags — `lege` setzt sie selbst, eine Angabe des Aufrufers zählt nicht. */
const BEREICH_FELDER = ['bereich', 'bereichQuelle', 'bereichOrt', 'bereichNennt', 'bereichVon'] as const;

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

/**
 * Einen Vorschlag ablegen. Den Bereich (Privat/Business) setzt `lege` selbst über die EINE Regel (lib/zoe/bereich-server.ts
 * `bereichErmitteln`: Bezug → Inhalt → `opt.gespraech` → unklar) — der Aufrufer gibt nur den geprüften Bereich des Gesprächs mit, wenn es
 * einen gibt. Scheitert das Erkennen, liegt der Vorschlag „unklar“ (in beiden Sichten) — das Ablegen scheitert daran nie.
 */
export async function lege(v: Omit<Vorschlag, 'id' | 'zeit' | 'tag' | 'status'>, opt: { gespraech?: Bereich | null } = {}): Promise<Vorschlag> {
  const roh: Record<string, unknown> = { ...v };
  for (const f of BEREICH_FELDER) delete roh[f];
  const ohneBereich = roh as Omit<Vorschlag, 'id' | 'zeit' | 'tag' | 'status'>;
  const b = await (async () => {
    try { return await (await import('./bereich-server')).bereichErmitteln(ohneBereich, { gespraech: bereichAus(opt.gespraech) }); }
    catch { return { bereich: 'unklar' as const }; }
  })();
  const vorschlag: Vorschlag = {
    ...ohneBereich,
    id: neueKennung('v'), // Paket D-C: zufällig, ohne Zeitanteil (lib/kennung.ts)
    zeit: new Date().toISOString(),
    tag: localDay(),
    status: 'offen',
    ...(b.bereich !== 'unklar' ? { bereich: b.bereich, ...(b.quelle ? { bereichQuelle: b.quelle } : {}), ...(b.ort ? { bereichOrt: b.ort } : {}) } : {}),
    ...(b.nennt?.length ? { bereichNennt: b.nennt } : {}),
  };
  let schonDa: Vorschlag | undefined;
  await updateJsonAsync<Stand>('zoe-stapel', async current => {
    const liste = current?.vorschlaege ?? [];
    const offen = liste.filter(x => AKTIV.has(x.status));
    // Liegt dieselbe Wirkung schon offen da, kommt nichts Zweites dazu — aber nur für DIESELBE Person (09.10., Agenten-Datenschicht):
    // vorher verschwand der Vorschlag der einen Person still, wenn die andere denselben offen hatte (den sie nie sieht), und der
    // Aufrufer bekam den fremden Vorschlag zurück. Personlose (System-)Vorschläge gleichen nur personlose ab.
    schonDa = offen.find(x => (x.person ?? null) === (vorschlag.person ?? null) && kennung(x.werkzeug, x.eingabe) === kennung(vorschlag.werkzeug, vorschlag.eingabe));
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

// Gruppen je Bereich: EINE Liste in lib/zoe/bereich.ts (BUSINESS_GRUPPEN, PRIVAT_GRUPPEN) — dieselbe für `vorschlagPrivat` und `bereichFuerVorschlag`.

/**
 * Liegt ein Vorschlag (möglicherweise) im Privat-Bereich? (rein, 09.10., E4) — für Vorschläge des SYSTEMS (ohne Person), die ein Konto
 * „nur Business“ nur sieht, wenn sie sicher Business sind. Bezug CRM / Business-Gruppe → nein; Gesundheit/Haushalt → ja; sonst entscheidet
 * eine ausdrückliche Angabe in der Eingabe (`space`/`bereich` privat|business, `spaceId`/`einheit` über den Bereich der Einheit) —
 * ohne Angabe: im Zweifel privat (nie auf Verdacht zeigen).
 */
export function vorschlagPrivat(v: { gruppe: string; eingabe?: Record<string, unknown>; bezug?: { art: string }; bereich?: unknown }): boolean {
  // Ein Vorschlag mit Bereich „Privat“ (09.10. spät, lib/zoe/bereich.ts) ist privat — nur verschärfend: „Business“ allein öffnet ihn nie
  // für ein Konto „nur Business“ (der Bereich kann aus dem Gespräch kommen); dafür gelten weiter die Regeln unten.
  if (bereichAus(v.bereich) === 'privat') return true;
  if (v.bezug?.art === 'crm' || BUSINESS_GRUPPEN.has(v.gruppe)) return false;
  if (PRIVAT_GRUPPEN.has(v.gruppe)) return true;
  const e = v.eingabe ?? {};
  const wert = (k: string) => (typeof e[k] === 'string' ? (e[k] as string).trim() : '');
  for (const k of ['space', 'bereich']) {
    if (wert(k) === 'privat') return true;
    if (wert(k) === 'business') return false;
  }
  for (const k of ['spaceId', 'einheit']) {
    const id = wert(k);
    if (!id) continue;
    const ort = finanzOrtAus(id) ?? (istSpaceId(id) ? id : null);
    if (ort) return bereichVonSpace(ort) === 'privat';
  }
  return true;
}

/**
 * Sieht/entscheidet `person` diesen Vorschlag? — EINE Regel (Route /api/zoe/stapel und Heute/Glocke, F2 M6): eigene und
 * die des Systems (ohne Person). `imHaushalt` = die Person gehört zum Haushalt des Inhabers (`personImHaushaltDesInhabers`).
 * Seit S1 (29.09.): Vorschläge des Systems (ohne Person) und die der Gruppe „haushalt“ NUR im Haushalt des Inhabers —
 * vorher sah jedes Konto (auch ohne Haushalt) die personlosen Vorschläge und konnte sie freigeben.
 * Seit 09.10. (E4, EINE Konto-Sicht): `privat` = die Person sieht den Privat-Bereich (lib/zugang/konto-sicht.ts — nein für ein Konto
 * „nur Business“). Ohne ihn sieht sie von den Vorschlägen des Systems nur die sicher geschäftlichen (`vorschlagPrivat`). Fehlt das
 * Argument, gilt das Verhalten von vorher (volle Sicht) — jeder Leser an eine Person gibt es mit.
 */
export const vorschlagSichtbar = (v: { person?: string; gruppe: string; eingabe?: Record<string, unknown>; bezug?: { art: string }; bereich?: unknown }, person: string | null, imHaushalt: boolean, privat = true): boolean => {
  if (!person) return false;
  if (v.person) return v.person === person && (imHaushalt || v.gruppe !== 'haushalt');
  return imHaushalt && (privat || !vorschlagPrivat(v));
};

export async function lies(nur?: VorschlagStatus): Promise<Vorschlag[]> {
  const s = await loadJson<Stand>('zoe-stapel');
  const liste = (s?.vorschlaege ?? []).map(sicht);
  return nur ? liste.filter(x => x.status === nur) : liste;
}

export async function offeneAnzahl(): Promise<number> {
  return (await lies('offen')).length;
}

/**
 * Offene Vorschläge, die DIESE Person sieht (eigene + die des Systems, `vorschlagSichtbar`) — die Zahl, die an eine Person geht (ZOE-Antwort,
 * Empfang, Morgenlauf). Sicherheitsprüfung 09.10.: dort stand `offeneAnzahl()` — die Zahl zählte die Vorschläge der anderen Person mit.
 */
export async function offeneAnzahlFuer(person: string | null, space: Bereich | null = null): Promise<number> {
  return (await vorschlaegeFuer(person, 'offen', space)).length;
}

/**
 * Die Vorschläge, die `person` sieht (`vorschlagSichtbar` mit der EINEN Konto-Sicht, 09.10., E4: im Haushalt, Privat-Bereich nur ohne
 * „nur Business“). Für jeden Leser an eine Person (Zähler, Heute, Agenten-Bereich). Konten unlesbar → nichts (nie auf Verdacht zeigen).
 * `space` (09.10. spät) = die Sicht Privat/Business (dieser Bereich + „unklar“); ohne = alle.
 */
export async function vorschlaegeFuer(person: string | null, nur?: VorschlagStatus, space: Bereich | null = null): Promise<Vorschlag[]> {
  if (!person) return [];
  const { kontoSicht } = await import('@/lib/zugang/konto-sicht-server');
  const k = await kontoSicht(person).catch(() => null);
  if (!k) return [];
  // Sicht Privat/Business (09.10. spät): nur Vorschläge dieses Bereichs und die unklaren (in beiden), lib/zoe/bereich.ts `passtZurSicht`.
  return (await lies(nur)).filter(v => vorschlagSichtbar(v, person, k.imHaushalt, k.privat) && passtZurSicht(v, space));
}

export async function hole(id: string): Promise<Vorschlag | null> {
  const s = await loadJson<Stand>('zoe-stapel');
  const v = (s?.vorschlaege ?? []).find(x => x.id === id);
  return v ? sicht(v) : null;
}

/**
 * Stand eines Vorschlags (09.10. spät) — Fingerabdruck des Eintrags, wie ihn die Sicht zeigt. Die Route liefert ihn je Vorschlag mit; wer den
 * Bereich setzt oder freigibt, schickt ihn zurück: hat sich der Vorschlag inzwischen geändert (anderes Fenster, andere Person, entschieden),
 * gibt es 409 statt einer Entscheidung über etwas, das man so nicht gesehen hat.
 */
export const vorschlagStand = (v: Vorschlag): string => fingerabdruck(sicht(v) as unknown as Record<string, unknown>);

export type BereichSetzen = { ok: true; v: Vorschlag } | { ok: false; status: 403 | 404 | 409; fehler: string; v?: Vorschlag };

/**
 * Bereich von Hand setzen (09.10. spät, „Bereich wählen“) — IN der Sperre: nur ein offener Vorschlag, nur mit passendem Stand (sonst 409 mit
 * dem aktuellen Eintrag), nur wenn `pruefe` nichts einwendet (Sicht der Person → 404). Ein von Hand gesetzter Bereich gilt (Quelle „hand“);
 * ein Ort, der nicht mehr zum Bereich passt, fällt weg.
 */
export async function bereichSetzen(id: string, bereich: Bereich, o: { von: string; stand?: string | null; pruefe?: (v: Vorschlag) => { status: 403 | 404 | 409; fehler: string } | null }): Promise<BereichSetzen> {
  let raus: BereichSetzen = { ok: false, status: 404, fehler: 'Vorschlag nicht gefunden.' };
  await updateJsonAsync<Stand>('zoe-stapel', async current => {
    const liste = current?.vorschlaege ?? [];
    const i = liste.findIndex(x => x.id === id);
    if (i < 0) return current as Stand;
    const v = sicht(liste[i]);
    const nein = o.pruefe?.(v) ?? null;
    if (nein) { raus = { ok: false, ...nein }; return current as Stand; }
    if (v.status !== 'offen') { raus = { ok: false, status: 409, fehler: v.status === 'in_arbeit' ? 'Wird gerade übernommen — Bereich nicht geändert.' : `Schon entschieden (${v.status}) — Bereich nicht geändert.`, v }; return current as Stand; }
    if (o.stand && o.stand !== vorschlagStand(v)) { raus = { ok: false, status: 409, fehler: 'Inzwischen geändert — bitte neu ansehen. Bereich nicht geändert.', v }; return current as Stand; }
    const ortPasst = v.bereichOrt && v.bereich === bereich;
    const { bereichOrt: _o, ...ohneOrt } = v;
    const neu: Vorschlag = { ...(ortPasst ? v : ohneOrt), bereich, bereichQuelle: 'hand', bereichVon: String(o.von || 'system').slice(0, 40) };
    raus = { ok: true, v: neu };
    return { vorschlaege: liste.map((x, j) => (j === i ? neu : x)) };
  });
  return raus;
}

export type Anspruch = { ok: true; v: Vorschlag } | { ok: false; status: 403 | 404 | 409; fehler: string; code?: typeof BEREICH_FEHLT_CODE };

/**
 * Ohne Bereich keine Freigabe (Entscheidung 09.10. spät: „Unklar erst Bereich wählen“) — auch der Altbestand. Ablehnen geht jederzeit. Geprüft IN
 * `beanspruche`, durch das jede Freigabe läuft (Route, Arten, ZOE-Kanal); die Route antwortet vorher schon mit `code`.
 */
export const BEREICH_FEHLT_CODE = 'bereich-fehlt' as const;
export const BEREICH_FEHLT = 'Erst den Bereich wählen (Privat oder Business), dann freigeben — ZOE konnte ihn nicht sicher erkennen. Ablehnen geht jederzeit. Nichts freigegeben.';

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
    if (!bereichAus(v.bereich)) { raus = { ok: false, status: 409, fehler: BEREICH_FEHLT, code: BEREICH_FEHLT_CODE }; return { vorschlaege: liste }; }
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
  // Erfolgsquote je Skill (09.10., Agenten-Datenschicht D7): stammt der Vorschlag aus einem Agenten-Lauf (Anlass „<Head>: …“), zählt die
  // Entscheidung beim Skill dieses Laufs (lib/agenten/skills-server.ts `skillEntscheidungZaehlen`). Genau einmal — `entscheide` entscheidet
  // nur Offenes. „fehlgeschlagen“ zählt hier nicht (der Lauf selbst zählt Fehler).
  const r = raus as Vorschlag | null;
  if (r && (status === 'freigegeben' || status === 'abgelehnt')) {
    const { headVonVorschlag } = await import('@/lib/agenten/katalog');
    if (headVonVorschlag(r)) await (await import('@/lib/agenten/skills-server')).skillEntscheidungZaehlen(r, status === 'freigegeben' ? 'angenommen' : 'abgelehnt').catch(() => null);
  }
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
