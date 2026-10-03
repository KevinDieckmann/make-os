// ─── Google Kalender — Abgleich (Server, 03.10.2026) ─────────────────────────
// Google → MAKE OS, inkrementell mit `syncToken` (events.list, singleEvents=false: Serien als Master + Ausnahmen):
//   · erste Lesung („voll“): ab heute − 90 Tage (wie das Holfenster von iCloud), alles Künftige; Seiten à 250
//   · danach nur Änderungen seit dem letzten Token; `410 Gone` (Token abgelaufen) → der Bestand wird verworfen und
//     SOFORT voll neu gelesen — nie ein halber Stand
//   · abgesagte Ereignisse (`status: cancelled`) fallen weg; abgesagte Vorkommen einer Serie bleiben als Marke (EXDATE im ICS)
//   · Echo: die ETags der eigenen Schreibungen (`eigene`) werden beim Abgleich als „von uns“ erkannt — nicht als Änderung
//     von außen gezählt, nie zurückgeschrieben (es gibt keinen Schreibweg aus dem Lesen: kein Ping-Pong)
//   · Fehler: 401 → Token erneuern (lib/google/http.ts), `invalid_grant` → Verbindung „getrennt“ + EINE Glocke;
//     403/429 → Pause (Retry-After, sonst 2 → 30 Min.); 5xx/Netz → Backoff; „letzter Abgleich vor X Min.“ ab 30 Min.
//     hervorgehoben (`abgleichAlter`, dieselbe Anzeige wie iCloud). Alles landet im Stand, nie als Titel im Protokoll.
// Auslöser: der Takt (alle 5 Min., Rückfall ohne Push), der Push-Webhook (lib/kalender/google/kanal.ts), „Jetzt abgleichen“.

import { localDay } from '@/lib/zeit';
import { namenVon } from '@/lib/zugang/konten';
import { melde } from '@/lib/meldungen/melden';
import { googleAnfrage, GoogleApiFehler, GoogleUeberlastet } from '@/lib/google/http';
import { ladeVerbindung, GoogleVerbindungsFehler, GOOGLE_FUNKTIONEN, scopesFehlen } from '@/lib/google/verbindung';
import { ladeGoogleStand, aendereGoogleStand, setzeGoogleStand, standLeer, ereignisseAnwenden, type GoogleKalenderStand } from './stand';
import { schlank, type GEvent } from './abbilden';
import { tagPlus } from '../zeit';
import { pauseMs, naechsterVersuchFaellig, abgleichAlter, cacheNeuSchreiben } from '../icloud';

const API = 'https://www.googleapis.com/calendar/v3';
/** Holfenster rückwärts in Tagen (wie iCloud). */
export const FENSTER_ZURUECK = 90;
/** Mehr Ereignisse nimmt der Spiegel nicht (Schutz des kleinen Servers) — der Abgleich sagt es deutlich. */
export const EREIGNISSE_MAX = 20_000;
const SEITE = 250;

export interface GoogleKalenderInfo { id: string; name: string; farbe?: string; primary: boolean; schreibbar: boolean; zeitzone?: string }

// ── Kalender wählen ─────────────────────────────────────────────────────────

const kalenderUrl = (id: string) => `${API}/calendars/${encodeURIComponent(id)}`;

function infoAus(k: Record<string, unknown>): GoogleKalenderInfo | null {
  const id = typeof k.id === 'string' ? k.id : '';
  if (!id) return null;
  const rolle = String(k.accessRole ?? '');
  const farbe = typeof k.backgroundColor === 'string' && /^#[0-9a-f]{6}$/i.test(k.backgroundColor) ? k.backgroundColor : undefined;
  return {
    id, name: String(k.summaryOverride ?? k.summary ?? id).slice(0, 120), ...(farbe ? { farbe } : {}), primary: k.primary === true,
    schreibbar: rolle === 'owner' || rolle === 'writer', ...(typeof k.timeZone === 'string' ? { zeitzone: k.timeZone } : {}),
  };
}

/** Die Kalender dieses Google-Kontos (zum Wählen). Nur lesende Rollen mit Termin-Zugriff, ohne versteckte. */
export async function googleKalenderListe(person: string): Promise<GoogleKalenderInfo[]> {
  const r = await googleAnfrage<{ items?: Record<string, unknown>[] }>(person, 'kalender', `${API}/users/me/calendarList`, { query: { minAccessRole: 'reader', maxResults: 250, showHidden: false } });
  if (r.status !== 200) throw new GoogleApiFehler(`Kalenderliste nicht lesbar (${r.status}).`, r.status);
  return (r.json.items ?? []).map(infoAus).filter((x): x is GoogleKalenderInfo => !!x).sort((a, b) => Number(b.primary) - Number(a.primary) || a.name.localeCompare(b.name));
}

/** Name des Kalenders in MAKE OS: „MAKE Kevin (Google)“ — Vorname aus dem Konto, sonst die Kennung. */
export async function anzeigeName(person: string): Promise<string> {
  const vorname = (await namenVon().catch(() => ({} as Record<string, string>)))[person] || person;
  return `MAKE ${vorname.replace(/[\u0000-\u001f]/g, ' ').slice(0, 40)} (Google)`;
}

/**
 * Den Kalender wählen (`'primary'` = der Hauptkalender des Kontos) und den Bestand neu aufsetzen: der alte Kalender
 * verschwindet aus MAKE OS (Wahrheit bleibt Google), der Push-Kanal des alten wird gestoppt, der neue wird voll gelesen.
 * Jeder MAKE-OS-Kalender hat genau EIN Google-Zuhause.
 */
export async function googleKalenderWaehlen(person: string, kalenderId = 'primary'): Promise<GoogleKalenderStand> {
  const v = await ladeVerbindung(person);
  if (!v || v.status !== 'verbunden') throw new GoogleVerbindungsFehler('nicht-verbunden', 'Google ist für diese Person nicht verbunden.', 409);
  if (scopesFehlen(v.scopes, GOOGLE_FUNKTIONEN.kalender.scopes).length) throw new GoogleVerbindungsFehler('scope-fehlt', 'Für den Kalender fehlt eine Freigabe bei Google — bitte neu verbinden.', 409);
  const r = await googleAnfrage<Record<string, unknown>>(person, 'kalender', `${API}/users/me/calendarList/${encodeURIComponent(kalenderId)}`);
  if (r.status === 404) throw new GoogleApiFehler('Diesen Google-Kalender gibt es nicht (mehr) oder er ist nicht freigegeben.', 404);
  const info = r.status === 200 ? infoAus(r.json) : null;
  if (!info) throw new GoogleApiFehler(`Kalender nicht lesbar (${r.status}).`, r.status);
  const alt = await ladeGoogleStand(person);
  if (alt?.kanal) { const { kanalStoppenFuer } = await import('./kanal'); await kanalStoppenFuer(person, alt).catch(() => { /* der Kanal läuft von selbst ab */ }); }
  return setzeGoogleStand(person, standLeer({ person, email: v.email, kalenderId: info.id, kalenderName: await anzeigeName(person), ...(info.zeitzone ? { zeitzone: info.zeitzone } : {}), ...(info.farbe ? { farbe: info.farbe } : {}), schreibbar: info.schreibbar }));
}

// ── Seiten lesen ────────────────────────────────────────────────────────────

class TokenAbgelaufen extends Error {}

interface Gelesen { items: GEvent[]; syncToken?: string }

async function seitenLesen(person: string, stand: GoogleKalenderStand, syncToken: string | undefined, fensterAb: string): Promise<Gelesen> {
  const items: GEvent[] = [];
  let pageToken: string | undefined;
  let seiten = 0;
  for (;;) {
    const r = await googleAnfrage<{ items?: unknown[]; nextPageToken?: string; nextSyncToken?: string }>(person, 'kalender', `${kalenderUrl(stand.kalenderId)}/events`, {
      query: { singleEvents: false, showDeleted: true, maxResults: SEITE, ...(pageToken ? { pageToken } : {}), ...(syncToken ? { syncToken } : { timeMin: `${fensterAb}T00:00:00Z` }) },
    });
    if (r.status === 410) throw new TokenAbgelaufen();
    if (r.status === 404) throw new GoogleApiFehler('Der Google-Kalender wurde nicht gefunden (gelöscht oder nicht mehr freigegeben).', 404, 'notFound');
    if (r.status === 403) throw new GoogleApiFehler('Google verweigert den Zugriff auf den Kalender (403).', 403, 'forbidden');
    if (r.status !== 200) throw new GoogleApiFehler(`Google: Termine nicht lesbar (${r.status}).`, r.status);
    for (const roh of r.json.items ?? []) { const e = schlank(roh); if (e) items.push(e); }
    if (items.length > EREIGNISSE_MAX) throw new GoogleApiFehler(`Der Kalender hat mehr als ${EREIGNISSE_MAX} Termine im Fenster — zu viele für den Abgleich.`, 413, 'zuViele');
    if (r.json.nextPageToken && ++seiten < 200) { pageToken = r.json.nextPageToken; continue; }
    return { items, syncToken: r.json.nextSyncToken };
  }
}

/** Instanz-Kennung `<master>_<20261010T080000Z|20261010>` → Master und Original-Beginn (Google liefert abgesagte Vorkommen manchmal ohne Felder). */
export function ausnahmeAusId(id: string): { recurringEventId: string; originalStartTime: { date?: string; dateTime?: string } } | null {
  const m = /^(.+)_(\d{8})(T(\d{6})Z)?$/.exec(id);
  if (!m) return null;
  const d = `${m[2].slice(0, 4)}-${m[2].slice(4, 6)}-${m[2].slice(6, 8)}`;
  return { recurringEventId: m[1], originalStartTime: m[3] ? { dateTime: `${d}T${m[4].slice(0, 2)}:${m[4].slice(2, 4)}:${m[4].slice(4, 6)}Z` } : { date: d } };
}

/** Abgesagte Vorkommen ohne Master-Bezug ergänzen (aus der Instanz-Kennung) — sonst ginge die Absage verloren. */
function ausnahmenErgaenzen(items: GEvent[]): GEvent[] {
  return items.map(e => {
    if (e.status !== 'cancelled' || e.recurringEventId) return e;
    const a = ausnahmeAusId(e.id);
    return a ? { ...e, recurringEventId: a.recurringEventId, originalStartTime: e.originalStartTime ?? a.originalStartTime } : e;
  }).map(e => (e.status === 'cancelled' && e.recurringEventId && !e.originalStartTime ? { ...e, originalStartTime: ausnahmeAusId(e.id)?.originalStartTime } : e));
}

/** Alte Einzeltermine (Ende vor dem Fenster) und Ausnahmen ohne Master fallen weg — der Bestand wächst nicht endlos. */
export function aufraeumen(events: Record<string, GEvent>, fensterAb: string): Record<string, GEvent> {
  const raus: Record<string, GEvent> = {};
  for (const [id, e] of Object.entries(events)) {
    if (e.recurrence?.length) { raus[id] = e; continue; }
    const ende = e.end?.date ?? e.end?.dateTime?.slice(0, 10) ?? e.start?.date ?? e.start?.dateTime?.slice(0, 10) ?? '';
    if (e.recurringEventId) { if (events[e.recurringEventId]) raus[id] = e; continue; }
    if (ende && ende < fensterAb) continue;
    raus[id] = e;
  }
  return raus;
}

// ── Der Abgleich ────────────────────────────────────────────────────────────

export interface AbgleichErgebnis {
  voll: boolean;
  /** Geänderte Ereignisse seit dem letzten Lauf. */
  geaendert: number;
  /** Davon von AUSSEN (nicht unsere eigene Schreibung). */
  vonAussen: number;
  /** Eigene Schreibungen, die als Echo erkannt wurden. */
  echo: number;
  ereignisse: number;
}

const laeuft = new Map<string, Promise<AbgleichErgebnis>>();
/** Während eines Laufs kam noch ein Anstoß (Push): danach EINMAL noch einmal lesen — sonst ginge die Änderung bis zum nächsten Takt verloren. */
const nachlauf = new Set<string>();
/** Läuft für diese Person gerade ein Abgleich? */
export const googleAbgleichLaeuft = (person: string): boolean => laeuft.has(person);

/** Fehler in den Zustand des Bestands übersetzen (Pause, Anmeldung getrennt …). */
function fehlerZustand(e: unknown, alt: GoogleKalenderStand): Pick<GoogleKalenderStand, 'fehler' | 'fehlerAt' | 'fehlerAnmeldung' | 'fehlerFolge' | 'pauseBis'> {
  const anmeldung = e instanceof GoogleVerbindungsFehler && (e.code === 'getrennt' || e.code === 'scope-fehlt' || e.code === 'nicht-verbunden');
  const sekunden = e instanceof GoogleUeberlastet ? e.sekunden : undefined;
  const folge = (alt.fehlerFolge ?? 0) + 1;
  const jetzt = Date.now();
  const text = e instanceof Error ? e.message.slice(0, 300) : 'Google nicht erreichbar.';
  return { fehler: text, fehlerAt: new Date(jetzt).toISOString(), fehlerAnmeldung: anmeldung, fehlerFolge: folge, pauseBis: new Date(jetzt + pauseMs(folge, anmeldung, sekunden)).toISOString() };
}

async function einmal(person: string, voll: boolean): Promise<AbgleichErgebnis> {
  const start = await ladeGoogleStand(person);
  if (!start) throw new GoogleApiFehler('Kein Google-Kalender gewählt.', 409);
  const heute = localDay();
  const fensterAb = voll || !start.syncToken ? tagPlus(heute, -FENSTER_ZURUECK) : (start.fensterAb ?? tagPlus(heute, -FENSTER_ZURUECK));
  const nutzeToken = !voll && !!start.syncToken;
  let gelesen: Gelesen;
  try { gelesen = await seitenLesen(person, start, nutzeToken ? start.syncToken : undefined, fensterAb); }
  catch (e) {
    if (e instanceof TokenAbgelaufen) return einmal(person, true); // 410: voller Neuabgleich, sofort
    throw e;
  }
  const items = ausnahmenErgaenzen(gelesen.items);
  let vonAussen = 0, echo = 0;
  const neuer = await aendereGoogleStand(person, cur => {
    const eigene = { ...(cur.eigene ?? {}) };
    for (const e of items) {
      if (e.status === 'cancelled' && !e.recurringEventId) { if (cur.events[e.id]) vonAussen++; delete eigene[e.id]; continue; }
      if (eigene[e.id] && eigene[e.id] === e.etag) { echo++; delete eigene[e.id]; continue; }
      if (!cur.events[e.id] || cur.events[e.id].etag !== e.etag) vonAussen++;
    }
    const events = aufraeumen(ereignisseAnwenden(nutzeToken ? cur.events : {}, items), fensterAb);
    const kleinEigene = Object.fromEntries(Object.entries(eigene).slice(-200));
    const { fehler: _f, fehlerAt: _fa, fehlerAnmeldung: _fn, fehlerFolge: _ff, pauseBis: _p, getrenntGemeldet: _g, ...ohneFehler } = cur;
    return { ...ohneFehler, events, ...(gelesen.syncToken ? { syncToken: gelesen.syncToken } : {}), fensterAb, at: new Date().toISOString(), eigene: kleinEigene, ...(vonAussen ? { aussen: { at: new Date().toISOString(), n: vonAussen } } : cur.aussen ? { aussen: cur.aussen } : {}) };
  });
  if (!neuer) throw new GoogleApiFehler('Der Google-Kalender wurde währenddessen getrennt.', 409);
  await cacheNeuSchreiben();
  return { voll: !nutzeToken, geaendert: items.length, vonAussen, echo, ereignisse: Object.keys(neuer.events).length };
}

/**
 * Mit Google abgleichen. Läuft nie doppelt je Person (ein laufender Abgleich wird geteilt). Fehler werfen weiter UND stehen
 * im Bestand (Pause, „vor X Min.“). `voll`: den syncToken verwerfen und alles neu lesen.
 */
export async function googleAbgleichen(person: string, opt: { voll?: boolean; nachlauf?: boolean } = {}): Promise<AbgleichErgebnis> {
  const l = laeuft.get(person);
  if (l && !opt.voll) { if (opt.nachlauf) nachlauf.add(person); return l; }
  while (laeuft.has(person)) await laeuft.get(person)!.catch(() => { /* der Fehler steht im Stand */ });
  const p = (async () => {
    try {
      const v = await ladeVerbindung(person);
      if (!v || v.status !== 'verbunden') throw new GoogleVerbindungsFehler(v ? 'getrennt' : 'nicht-verbunden', v ? 'Die Google-Verbindung ist getrennt — bitte neu verbinden.' : 'Google ist für diese Person nicht verbunden.', 409);
      if (!(await ladeGoogleStand(person))) await googleKalenderWaehlen(person, 'primary');
      return await einmal(person, !!opt.voll);
    } catch (e) {
      const alt = await ladeGoogleStand(person);
      if (alt) {
        const z = fehlerZustand(e, alt);
        let melden = false;
        await aendereGoogleStand(person, cur => { melden = !!z.fehlerAnmeldung && !cur.getrenntGemeldet; return { ...cur, ...z, ...(z.fehlerAnmeldung ? { getrenntGemeldet: true } : {}) }; });
        if (melden) await melde({ an: person, art: 'kalender', titel: 'Die Google-Verbindung ist getrennt — bitte im Kalender (Einstellungen) neu verbinden.', link: '/os/kalender' });
      }
      throw e;
    }
  })().finally(() => {
    laeuft.delete(person);
    if (nachlauf.delete(person)) void googleAbgleichen(person).catch(() => { /* der Fehler steht im Stand */ });
  });
  laeuft.set(person, p);
  return p;
}

/** Ist ein Abgleich fällig? (frisch bis 2 Min., nach Fehler erst nach der Pause — wie iCloud) */
export function googleAbgleichFaellig(s: GoogleKalenderStand | null, jetzt = Date.now(), minAlterMs?: number): boolean {
  if (!s) return true;
  if (minAlterMs !== undefined && s.at && jetzt - Date.parse(s.at) < minAlterMs) return false;
  return naechsterVersuchFaellig(s, jetzt);
}

/** „Letzter Abgleich vor X Min.“ je Person — dieselbe Form wie bei iCloud (`abgleichAlter`), für Kalender-Kopf und HOI. */
export function googleAlter(s: GoogleKalenderStand | null, jetzt = Date.now()): ReturnType<typeof abgleichAlter> | null {
  return s ? abgleichAlter(s, jetzt) : null;
}
