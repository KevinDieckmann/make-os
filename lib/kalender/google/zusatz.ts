// ─── Kalender — weitere Google-Konten je Person: Spiegel, Abgleich (nur lesen), Überlagerung (Server, 30.10.2026) ─
// Die Termine der weiteren Konten (lib/google/zusatz.ts) zählen als „belegt“ für ihre Person — gegen Doppelbuchungen.
//   Spiegel     `kalender-google-zusatz--<person>`: je gewähltem Kalender (Kennung `gz-<16 hex>` aus Konto + Kalender) Name,
//               syncToken, Ereignisse (schlank, `GEvent`), Abgleich-Zustand. Wahrheit ist Google; Löschung nur dort (wie
//               `kalender-google--*`), der Abgleich holt alles neu.
//   Abgleich    derselbe Kern wie der Haupt-Kalender (lib/kalender/google/abgleich.ts): events.list mit syncToken, erste Lesung
//               ab heute − 90 Tage, `410` → sofort voll neu, abgesagte Vorkommen als Ausnahmen, 429/Retry-After → Pause.
//               Läuft je Person nie doppelt; der Takt alle 5 Min. (`zusatzJobsImTakt`, ohne Push). Es gibt KEINEN Schreibweg.
//   Überlagerung `zusatzUeberlagerung` → `KalenderEintrag` mit `quelle: 'google-zusatz'`, `person`, `schreibbar: false`, Name
//               „<Kalender> · <Bezeichnung>“, neutral „Weitere Termine · <Vorname>“. Die Termine tragen damit `persoenlich`
//               (lib/kalender/icloud.ts `persoenlichMarkieren`) — für alle anderen nur „Belegt“ (`maskieren`), für Verfügbarkeit,
//               freie Zeit, Buchungsseiten, Kapazität belegt NUR ihre Person (`werFuerTermin`). Objekte, deren UID schon im
//               Stand steht (dieselbe Einladung im Haupt-Kalender), zählen nur dort.
//   Hinweis     `ueberschneidungen` (rein): welche Termine der weiteren Konten EINER Person sich mit einer Zeitspanne decken —
//               für den Hinweis beim Anlegen/Verschieben (nie blockieren).

import { createHash } from 'node:crypto';
import { loadJson, updateJson, bestandEntfernen } from '@/lib/store/local-db';
import { localDay } from '@/lib/zeit';
import { alleSpeicher, namenVon } from '@/lib/zugang/konten';
import { anfrageMitToken, GoogleApiFehler, GoogleUeberlastet } from '@/lib/google/http';
import { googleKonfiguriert } from '@/lib/google/verbindung';
import { ladeZusatz, ladeZusatzKonto, zusatzZugriffstoken, zusatzSetzen, ZusatzFehler, ZUSATZ_KALENDER_MAX, personenMitZusatz, type ZusatzKonto } from '@/lib/google/zusatz';
import { schlank, objekteAus, type GEvent } from './abbilden';
import { ereignisseAnwenden } from './stand';
import { aufraeumen, ausnahmeAusId, FENSTER_ZURUECK, EREIGNISSE_MAX, type GoogleKalenderInfo } from './abgleich';
import { tagPlus, ausWandzeit } from '../zeit';
import { uidVon, type KalenderObjekt, type Termin } from '../ics';
import { NEUTRAL_ZUSATZ_VORSATZ } from '../einstellungen';

const API = 'https://www.googleapis.com/calendar/v3';
const SEITE = 250;
const PERSON = /^[a-z0-9-]{1,40}$/;
const MIN = 60_000;

/** Vorsatz des neutralen Namens, unter dem ANDERE Personen diese Kalender sehen („Weitere Termine · <Vorname>“). */
export const NEUTRAL_ZUSATZ = NEUTRAL_ZUSATZ_VORSATZ;
/** Kennung der Kalender in MAKE OS (Teil der Kalender-Adresse, → `kalenderKennung`). */
export const kennungFuer = (konto: string, kalenderId: string): string => `gz-${createHash('sha256').update(`${konto}|${kalenderId}`).digest('hex').slice(0, 16)}`;
export const kalenderIdVon = (kennung: string): string => `gzusatz:kalender/${kennung}`;
export const istZusatzKalenderId = (id: string | undefined): boolean => typeof id === 'string' && id.startsWith('gzusatz:');
export const zusatzStandName = (person: string) => `kalender-google-zusatz--${person}`;

export interface ZusatzKalenderStand {
  konto: string;
  /** Die Kennung bei Google (`primary` wird beim Wählen in die echte aufgelöst). */
  kalenderId: string;
  name: string;
  farbe?: string;
  zeitzone?: string;
  syncToken?: string;
  fensterAb?: string;
  events: Record<string, GEvent>;
  at?: string;
  fehler?: string;
  fehlerAt?: string;
  fehlerAnmeldung?: boolean;
  fehlerFolge?: number;
  pauseBis?: string;
}
export interface ZusatzSpiegel { v: 1; person: string; kalender: Record<string, ZusatzKalenderStand>; rev: number }

export async function ladeZusatzSpiegel(person: string): Promise<ZusatzSpiegel | null> {
  if (!PERSON.test(person)) return null;
  const s = await loadJson<ZusatzSpiegel>(zusatzStandName(person));
  return s && s.v === 1 && s.kalender && typeof s.kalender === 'object' ? s : null;
}

async function aendereSpiegel(person: string, mutate: (k: Record<string, ZusatzKalenderStand>) => Record<string, ZusatzKalenderStand>): Promise<ZusatzSpiegel> {
  let raus: ZusatzSpiegel = { v: 1, person, kalender: {}, rev: 0 };
  await updateJson<ZusatzSpiegel>(zusatzStandName(person), cur => {
    const alt = cur && cur.v === 1 && cur.kalender ? cur : { v: 1 as const, person, kalender: {}, rev: 0 };
    raus = { v: 1, person, kalender: mutate({ ...alt.kalender }), rev: (alt.rev ?? 0) + 1 };
    return raus;
  });
  return raus;
}

/** Spiegel eines Kontos (oder ganz) verwerfen — nach Trennen. Das letzte Konto → Bestand samt Tageskopien weg. */
export async function zusatzSpiegelEntfernen(person: string, konto?: string): Promise<void> {
  const s = await ladeZusatzSpiegel(person);
  if (!s) return;
  if (konto) {
    const rest = Object.fromEntries(Object.entries(s.kalender).filter(([, k]) => k.konto !== konto));
    if (Object.keys(rest).length) { await aendereSpiegel(person, () => rest); return; }
  }
  await bestandEntfernen(zusatzStandName(person), { tageskopien: true });
}

// ── Google lesen (nur mit dem Token des weiteren Kontos) ────────────────────

const anfrage = <T>(person: string, konto: string, url: string, opt: Parameters<typeof anfrageMitToken>[2] = {}) =>
  anfrageMitToken<T>(erneuern => zusatzZugriffstoken(person, konto, { erneuern }), url, opt);

function infoAus(k: Record<string, unknown>): GoogleKalenderInfo | null {
  const id = typeof k.id === 'string' ? k.id : '';
  if (!id) return null;
  const farbe = typeof k.backgroundColor === 'string' && /^#[0-9a-f]{6}$/i.test(k.backgroundColor) ? k.backgroundColor : undefined;
  return { id, name: String(k.summaryOverride ?? k.summary ?? id).replace(/[\u0000-\u001f·]/g, ' ').slice(0, 80), ...(farbe ? { farbe } : {}), primary: k.primary === true, schreibbar: false, ...(typeof k.timeZone === 'string' ? { zeitzone: k.timeZone } : {}) };
}

/** Die Kalender eines weiteren Kontos (zum Wählen). Alle mit Lesezugriff auf die Termine, ohne versteckte. */
export async function zusatzKalenderListe(person: string, konto: string): Promise<GoogleKalenderInfo[]> {
  const r = await anfrage<{ items?: Record<string, unknown>[] }>(person, konto, `${API}/users/me/calendarList`, { query: { minAccessRole: 'reader', maxResults: 250, showHidden: false } });
  if (r.status !== 200) throw new GoogleApiFehler(`Kalenderliste nicht lesbar (${r.status}).`, r.status);
  return (r.json.items ?? []).map(infoAus).filter((x): x is GoogleKalenderInfo => !!x).sort((a, b) => Number(b.primary) - Number(a.primary) || a.name.localeCompare(b.name));
}

/**
 * Die Kalender eines Kontos wählen (Kennungen bei Google, `primary` erlaubt). Nur Kalender aus seiner Liste; höchstens
 * `ZUSATZ_KALENDER_MAX`; mindestens einer. Abgewählte fallen aus dem Spiegel.
 */
export async function zusatzKalenderWaehlen(person: string, konto: string, ids: readonly string[]): Promise<string[]> {
  const liste = await zusatzKalenderListe(person, konto);
  const primary = liste.find(k => k.primary)?.id;
  const gewaehlt = Array.from(new Set(ids.map(id => (id === 'primary' ? primary : id)).filter((id): id is string => !!id && liste.some(k => k.id === id)))).slice(0, ZUSATZ_KALENDER_MAX);
  if (!gewaehlt.length) throw new GoogleApiFehler('Bitte mindestens einen Kalender dieses Kontos wählen.', 400);
  await zusatzSetzen(person, konto, { kalender: gewaehlt });
  const behalten = new Set(gewaehlt.map(id => kennungFuer(konto, id)));
  await aendereSpiegel(person, k => Object.fromEntries(Object.entries(k).filter(([kn, x]) => x.konto !== konto || behalten.has(kn))));
  return gewaehlt;
}

class TokenAbgelaufen extends Error {}

async function seitenLesen(person: string, konto: string, kalenderId: string, syncToken: string | undefined, fensterAb: string): Promise<{ items: GEvent[]; syncToken?: string }> {
  const items: GEvent[] = [];
  let pageToken: string | undefined;
  let seiten = 0;
  for (;;) {
    const r = await anfrage<{ items?: unknown[]; nextPageToken?: string; nextSyncToken?: string }>(person, konto, `${API}/calendars/${encodeURIComponent(kalenderId)}/events`, {
      query: { singleEvents: false, showDeleted: true, maxResults: SEITE, ...(pageToken ? { pageToken } : {}), ...(syncToken ? { syncToken } : { timeMin: `${fensterAb}T00:00:00Z` }) },
    });
    if (r.status === 410) throw new TokenAbgelaufen();
    if (r.status === 404) throw new GoogleApiFehler('Der Kalender wurde nicht gefunden (gelöscht oder nicht mehr freigegeben).', 404, 'notFound');
    if (r.status === 403) throw new GoogleApiFehler('Google verweigert den Zugriff auf den Kalender (403).', 403, 'forbidden');
    if (r.status !== 200) throw new GoogleApiFehler(`Google: Termine nicht lesbar (${r.status}).`, r.status);
    for (const roh of r.json.items ?? []) { const e = schlank(roh); if (e) items.push(e); }
    if (items.length > EREIGNISSE_MAX) throw new GoogleApiFehler(`Der Kalender hat mehr als ${EREIGNISSE_MAX} Termine im Fenster — zu viele für den Abgleich.`, 413, 'zuViele');
    if (r.json.nextPageToken && ++seiten < 200) { pageToken = r.json.nextPageToken; continue; }
    return { items, syncToken: r.json.nextSyncToken };
  }
}

/** Abgesagte Vorkommen ohne Master-Bezug ergänzen (aus der Instanz-Kennung) — wie beim Haupt-Kalender. */
const ausnahmenErgaenzen = (items: GEvent[]): GEvent[] => items.map(e => {
  if (e.status !== 'cancelled') return e;
  const a = ausnahmeAusId(e.id);
  if (!a) return e;
  return { ...e, recurringEventId: e.recurringEventId ?? a.recurringEventId, originalStartTime: e.originalStartTime ?? a.originalStartTime };
});

/** Pause nach Fehler: Anmeldung 30 Min., Überlast nach Retry-After, sonst 2 → 30 Min. (wie iCloud/Google). */
export function pauseNach(folge: number, anmeldung: boolean, sekunden?: number): number {
  if (sekunden) return Math.min(3600, sekunden) * 1000;
  if (anmeldung) return 30 * MIN;
  return Math.min(30, 2 * 2 ** Math.max(0, folge - 1)) * MIN;
}

async function kalenderLesen(person: string, konto: ZusatzKonto, kalenderId: string, voll: boolean): Promise<void> {
  const kennung = kennungFuer(konto.id, kalenderId);
  const alt = (await ladeZusatzSpiegel(person))?.kalender[kennung];
  const heute = localDay();
  const nutzeToken = !voll && !!alt?.syncToken;
  const fensterAb = nutzeToken ? (alt?.fensterAb ?? tagPlus(heute, -FENSTER_ZURUECK)) : tagPlus(heute, -FENSTER_ZURUECK);
  try {
    let g: { items: GEvent[]; syncToken?: string };
    let token = nutzeToken;
    try { g = await seitenLesen(person, konto.id, kalenderId, nutzeToken ? alt!.syncToken : undefined, fensterAb); }
    catch (e) { if (!(e instanceof TokenAbgelaufen)) throw e; token = false; g = await seitenLesen(person, konto.id, kalenderId, undefined, tagPlus(heute, -FENSTER_ZURUECK)); }
    const info = alt?.name ? null : await anfrage<Record<string, unknown>>(person, konto.id, `${API}/users/me/calendarList/${encodeURIComponent(kalenderId)}`).then(r => (r.status === 200 ? infoAus(r.json) : null)).catch(() => null);
    const items = ausnahmenErgaenzen(g.items);
    await aendereSpiegel(person, k => {
      const cur = k[kennung];
      const events = aufraeumen(ereignisseAnwenden(token && cur ? cur.events : {}, items), fensterAb);
      k[kennung] = {
        konto: konto.id, kalenderId, name: cur?.name ?? info?.name ?? 'Kalender', ...(cur?.farbe ?? info?.farbe ? { farbe: cur?.farbe ?? info?.farbe } : {}),
        ...(cur?.zeitzone ?? info?.zeitzone ? { zeitzone: cur?.zeitzone ?? info?.zeitzone } : {}),
        events, ...(g.syncToken ? { syncToken: g.syncToken } : {}), fensterAb, at: new Date().toISOString(),
      };
      return k;
    });
  } catch (e) {
    const anmeldung = e instanceof ZusatzFehler && (e.code === 'abgelaufen' || e.code === 'unbekannt');
    const sekunden = e instanceof GoogleUeberlastet ? e.sekunden : undefined;
    const jetzt = Date.now();
    await aendereSpiegel(person, k => {
      const cur = k[kennung] ?? { konto: konto.id, kalenderId, name: 'Kalender', events: {} };
      const folge = (cur.fehlerFolge ?? 0) + 1;
      k[kennung] = { ...cur, fehler: e instanceof Error ? e.message.slice(0, 200) : 'Google nicht erreichbar.', fehlerAt: new Date(jetzt).toISOString(), fehlerAnmeldung: anmeldung, fehlerFolge: folge, pauseBis: new Date(jetzt + pauseNach(folge, anmeldung, sekunden)).toISOString() };
      return k;
    });
    throw e;
  }
}

export interface ZusatzAbgleichErgebnis { kalender: number; fehler: number }
const laeuft = new Map<string, Promise<ZusatzAbgleichErgebnis>>();
export const zusatzAbgleichLaeuft = (person: string): boolean => laeuft.has(person);

/**
 * Alle gewählten Kalender aller verbundenen weiteren Konten einer Person lesen. Je Person nie doppelt (ein laufender wird geteilt).
 * Ein Fehler in einem Kalender hält die anderen nicht auf (steht im Spiegel). `konto`: nur dieses Konto; `voll`: syncToken verwerfen.
 */
export async function zusatzAbgleichen(person: string, opt: { konto?: string; voll?: boolean } = {}): Promise<ZusatzAbgleichErgebnis> {
  if (!PERSON.test(person)) return { kalender: 0, fehler: 0 };
  const l = laeuft.get(person);
  if (l && !opt.voll && !opt.konto) return l;
  while (laeuft.has(person)) await laeuft.get(person)!.catch(() => { /* steht im Spiegel */ });
  const p = (async (): Promise<ZusatzAbgleichErgebnis> => {
    const b = await ladeZusatz(person);
    let kalender = 0, fehler = 0;
    for (const konto of b.konten) {
      if (opt.konto && konto.id !== opt.konto) continue;
      if (konto.status !== 'verbunden') continue;
      let ids = konto.kalender.length ? konto.kalender : ['primary'];
      if (ids.includes('primary')) {
        try { ids = await zusatzKalenderWaehlen(person, konto.id, ids); }
        catch { fehler++; continue; }
      }
      for (const id of ids) {
        try { await kalenderLesen(person, konto, id, !!opt.voll); kalender++; }
        catch (e) { fehler++; if (e instanceof ZusatzFehler && e.code === 'abgelaufen') break; }
      }
    }
    // Spiegel-Einträge zu Konten, die es nicht mehr gibt, fallen weg.
    const ids = new Set(b.konten.map(k => k.id));
    const s = await ladeZusatzSpiegel(person);
    if (s && Object.values(s.kalender).some(k => !ids.has(k.konto))) {
      if (!ids.size) await bestandEntfernen(zusatzStandName(person), { tageskopien: true });
      else await aendereSpiegel(person, k => Object.fromEntries(Object.entries(k).filter(([, x]) => ids.has(x.konto))));
    }
    await import('../icloud').then(m => m.cacheNeuSchreiben()).catch(() => { /* nächster Lauf */ });
    return { kalender, fehler };
  })().finally(() => laeuft.delete(person));
  laeuft.set(person, p);
  return p;
}

/** Fällig? Frisch 5 Min., nach Fehler erst nach der Pause, nie für ein abgelaufenes Konto. Rein. */
export function zusatzFaellig(s: ZusatzSpiegel | null, konten: readonly Pick<ZusatzKonto, 'id' | 'status' | 'kalender'>[], jetzt: number): boolean {
  const offen = konten.filter(k => k.status === 'verbunden');
  if (!offen.length) return false;
  for (const k of offen) {
    const eintraege = Object.values(s?.kalender ?? {}).filter(x => x.konto === k.id);
    if (!eintraege.length) return true;
    for (const e of eintraege) {
      if (e.pauseBis && Date.parse(e.pauseBis) > jetzt) continue;
      if (!e.at || jetzt - Date.parse(e.at) >= 5 * MIN) return true;
    }
  }
  return false;
}

/** Takt: je Person mit weiteren Konten alle 5 Min. abgleichen (im Hintergrund, nie blockierend, nie mit Titeln im Log). */
export async function zusatzJobsImTakt(jetzt = Date.now()): Promise<{ gestartet: string[] }> {
  if (!googleKonfiguriert()) return { gestartet: [] };
  const personen = await personenMitZusatz(await alleSpeicher().catch(() => [] as string[]));
  const gestartet: string[] = [];
  for (const p of personen) {
    if (zusatzAbgleichLaeuft(p)) continue;
    const [b, s] = await Promise.all([ladeZusatz(p), ladeZusatzSpiegel(p).catch(() => null)]);
    if (!zusatzFaellig(s, b.konten, jetzt)) continue;
    gestartet.push(p);
    void zusatzAbgleichen(p).catch(e => console.warn(`[kalender-google-zusatz] Abgleich: ${e instanceof Error ? e.name : 'Fehler'}`));
  }
  return { gestartet };
}

// ── Überlagerung des Kalender-Stands ────────────────────────────────────────

export interface ZusatzEintrag {
  id: string; name: string; farbe?: string; ctag?: string; schreibbar: false;
  quelle: 'google-zusatz'; person: string; ich: string[]; neutral: string;
}

/**
 * Die Kalender der weiteren Konten aller Personen (Kandidaten) für `ladeStand()`. `vorhanden` = UIDs, die schon im Stand stehen
 * (dieselbe Einladung im Haupt- oder Haushalts-Kalender) — sie zählen nur dort. `vergeben` = Namen, die es schon gibt.
 */
export async function zusatzUeberlagerung(personen: readonly string[], vorhanden: ReadonlySet<string>, vergeben: Set<string>): Promise<{ kalender: ZusatzEintrag[]; objekte: Record<string, KalenderObjekt[]> }> {
  const kalender: ZusatzEintrag[] = [];
  const objekte: Record<string, KalenderObjekt[]> = {};
  const kandidaten = await personenMitZusatz(personen);
  if (!kandidaten.length) return { kalender, objekte };
  const namen = await namenVon().catch(() => ({} as Record<string, string>));
  for (const p of kandidaten) {
    const [b, s] = await Promise.all([ladeZusatz(p), ladeZusatzSpiegel(p)]);
    if (!s) continue;
    const vorname = ((namen[p] ?? p).trim().split(/\s+/)[0] || p).slice(0, 40);
    for (const konto of b.konten) {
      for (const [kennung, k] of Object.entries(s.kalender)) {
        if (k.konto !== konto.id || !konto.kalender.includes(k.kalenderId)) continue;
        let name = `${k.name} · ${konto.label}`;
        for (let n = 2; vergeben.has(name.toLowerCase()); n++) name = `${k.name} · ${konto.label} (${n})`;
        vergeben.add(name.toLowerCase());
        const id = kalenderIdVon(kennung);
        kalender.push({ id, name, ...(k.farbe ? { farbe: k.farbe } : {}), ctag: `${s.rev}`, schreibbar: false, quelle: 'google-zusatz', person: p, ich: [konto.email], neutral: `${NEUTRAL_ZUSATZ}${vorname}` });
        objekte[id] = objekteAus(k.events, `${p}~${kennung}`).objekte.filter(o => { const u = uidVon(o.ics); return !u || !vorhanden.has(u); });
      }
    }
  }
  return { kalender, objekte };
}

/** Kalendername → Person für die gezeigten Kalender der weiteren Konten (Zuordnung „wem gehört“, Space; nie gespeichert). */
export async function zusatzNamen(): Promise<Record<string, string>> {
  try {
    const r = await zusatzUeberlagerung(await alleSpeicher(), new Set(), new Set());
    return Object.fromEntries(r.kalender.flatMap(k => [[k.name, k.person], [k.neutral, k.person]]));
  } catch { return {}; }
}

// ── Überschneidung (rein) ───────────────────────────────────────────────────

export interface Ueberschneidung { kalender: string; start: string; ende: string; ganztags: boolean }

/**
 * Termine der weiteren Konten von `person`, die sich mit [start, ende) decken (Berliner Wandzeit). Nur Termine, die belegen
 * (nicht abgesagt, nicht „frei“); `ohneUid` = der Termin selbst (beim Verschieben). Rein.
 */
export function ueberschneidungen(termine: readonly Termin[], person: string, start: string, ende: string, ohneUid?: string): Ueberschneidung[] {
  const a = ausWandzeit(start).getTime(), b = ausWandzeit(ende).getTime();
  if (!(b > a)) return [];
  return termine
    .filter(t => istZusatzKalenderId(t.kalenderId) && t.persoenlich === person && !t.abgesagt && t.beschaeftigt !== false && t.uid !== ohneUid)
    .filter(t => ausWandzeit(t.start).getTime() < b && ausWandzeit(t.ende).getTime() > a)
    .slice(0, 5)
    .map(t => ({ kalender: t.kalender, start: t.start, ende: t.ende, ganztags: t.ganztags }));
}

/** Die Überschneidungen für eine Person aus dem aktuellen Stand (Server). Fehler → keine (nie ein Grund, nicht zu speichern). */
export async function ueberschneidungenFuer(person: string, start: string, ende: string, ohneUid?: string): Promise<Ueberschneidung[]> {
  try {
    if (!PERSON.test(person) || !(await ladeZusatzSpiegel(person))) return [];
    const { ladeStand, termineImZeitraum } = await import('../icloud');
    const von = start.slice(0, 10), bis = tagPlus(ende.slice(0, 10), 1);
    return ueberschneidungen(termineImZeitraum(await ladeStand(), von, bis > von ? bis : tagPlus(von, 1)), person, start, ende, ohneUid);
  } catch { return []; }
}

/** Für die Statusanzeige: je Konto die Kalender im Spiegel (Name, Termine, letzter Abgleich) — keine Inhalte. */
export async function zusatzSpiegelStatus(person: string): Promise<Record<string, { kennung: string; name: string; termine: number; at?: string; fehler?: string }[]>> {
  const s = await ladeZusatzSpiegel(person);
  const raus: Record<string, { kennung: string; name: string; termine: number; at?: string; fehler?: string }[]> = {};
  for (const [kennung, k] of Object.entries(s?.kalender ?? {})) {
    (raus[k.konto] ??= []).push({ kennung, name: k.name, termine: Object.keys(k.events).length, ...(k.at ? { at: k.at } : {}), ...(k.fehler && (!k.at || (k.fehlerAt ?? '') > k.at) ? { fehler: k.fehler } : {}) });
  }
  return raus;
}

/** Ein Konto (Kennung) der Person — für Routen. */
export const zusatzKontoDa = async (person: string, konto: string): Promise<boolean> => !!(await ladeZusatzKonto(person, konto));
