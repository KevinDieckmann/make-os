// ─── Kalender — iCloud direkt (Server) ──────────────────────────────────────
// Kevin 25.09.: „Kalender … mit Apple verbunden“ — entschieden: iCloud direkt.
// Der Server spricht CalDAV mit iCloud, über ein app-spezifisches Passwort
// (ICLOUD_APPLE_ID / ICLOUD_APP_PASSWORT in /srv/make-os/app/.env — nie im
// Repo, nie im Chat; einrichten mit deploy/icloud-verbinden.sh).
//
//   Lesen     Kalenderliste mit ctag (eine Anfrage); nur geänderte Kalender
//             werden neu geholt (-90 … +400 Tage). Roh-Objekte liegen in
//             „kalender-icloud“, aufgefaltet für alle bisherigen Leser in
//             „calendar-cache“ (Heute, Planer, ZOE, Morgenlauf …).
//   Schreiben Anlegen, verschieben, umbenennen, löschen — immer mit ETag
//             (If-Match / If-None-Match): Wer gleichzeitig am iPhone ändert,
//             wird nicht überschrieben (409 statt still weg).
//   Gäste     (K3, 30.09.) Termine mit Gästen tragen ORGANIZER = eine Adresse
//             des Kontos (`calendar-user-address-set`, sonst die Apple-ID) —
//             iCloud verschickt Einladung/Änderung/Absage. Jede Schreibaktion,
//             die Post an Gäste auslöst, braucht `einladungBestaetigt`, sonst
//             `EinladungNoetig` (409 mit Anzahl + Adressen für die Rückfrage).
//
// Die Zugangsdaten gehen NUR an *.icloud.com (auch bei Weiterleitungen).

import { randomUUID } from 'node:crypto';
import { loadJson, saveJson } from '@/lib/store/local-db';
import { antworten, istTerminKalender, text, adresse, etagSauber, klartext } from './dav';
import { termineAus, baueTermin, aendereTermin, antwortSetzen, einladungsLage, uidVon, nichtBearbeitbar, objektKurz, adresseAus, type KalenderObjekt, type Termin, type Aenderung, type NeuerTermin, type Teilnahme } from './ics';
import { tagPlus } from './zeit';
import { localDay } from '@/lib/zeit';
import { mitBezug, type BezugBestand } from './bezug';
import { ladeBezuege, bezuegeAbgleichen } from './bezug-server';

export const SPEICHER = 'kalender-icloud';
export const CACHE = 'calendar-cache';
const BASIS = 'https://caldav.icloud.com/';
/** Holfenster für Roh-Objekte (Tage relativ zu heute). */
export const HOLEN_VON = -90, HOLEN_BIS = 400;
/** Fenster für den aufgefalteten calendar-cache. */
const CACHE_VON = -30, CACHE_BIS = 120;
/** Ab wann ein Stand als alt gilt und beim Lesen erneuert wird. */
export const FRISCH_MS = 2 * 60_000;

export interface KalenderEintrag { id: string; name: string; farbe?: string; ctag?: string; schreibbar: boolean }
export interface IcloudStand {
  at?: string;
  fehler?: string;
  fehlerAt?: string;
  /** iCloud hat die Anmeldung abgelehnt — dann seltener versuchen (Apple sperrt sonst). */
  fehlerAnmeldung?: boolean;
  home?: string;
  /** Adressen des Kontos (calendar-user-address-set, klein) — Organisator neuer Einladungen, „bin ich Gast?“ (K3). */
  adressen?: string[];
  kalender: KalenderEintrag[];
  objekte: Record<string, KalenderObjekt[]>;
}

// ── Zugang ──────────────────────────────────────────────────────────────────

export function zugang(): { id: string; passwort: string } | null {
  const id = process.env.ICLOUD_APPLE_ID?.trim();
  const passwort = process.env.ICLOUD_APP_PASSWORT?.trim();
  return id && passwort ? { id, passwort } : null;
}
export const verbunden = () => zugang() !== null;

/** Apple-ID für die Anzeige: k•••@icloud.com */
export function kontoAnzeige(): string | null {
  const z = zugang();
  if (!z) return null;
  const [n, d] = z.id.split('@');
  return d ? `${n.slice(0, 1)}•••@${d}` : `${z.id.slice(0, 1)}•••`;
}

export class KalenderFehler extends Error {
  constructor(message: string, public status = 502) { super(message); }
}
/** 409: der Termin hat inzwischen einen anderen Stand (ETag) — mit dem aktuellen Termin, damit „Deine Fassung“ bleibt. */
export class KalenderKonflikt extends KalenderFehler {
  constructor(message: string, public aktuell: Termin | null) { super(message, 409); }
}
/**
 * 409 (K3): diese Schreibaktion schickt Post an Gäste (Einladung, Änderung, Absage, Antwort) — erst nach Bestätigung.
 * `adressen` nur für die Rückfrage in der Oberfläche (nie ins Protokoll).
 */
export class EinladungNoetig extends KalenderFehler {
  constructor(public was: 'einladung' | 'aenderung' | 'absage' | 'antwort', public adressen: string[]) {
    super(was === 'antwort' ? 'Antwort an den Organisator senden?' : `${was === 'einladung' ? 'Einladung' : was === 'absage' ? 'Absage' : 'Änderung'} an ${adressen.length} ${adressen.length === 1 ? 'Person' : 'Personen'} über iCloud senden?`, 409);
  }
}

/** Adressen des Kontos (klein): aus iCloud, sonst die Apple-ID. */
export function kontoAdressen(s: Pick<IcloudStand, 'adressen'>): string[] {
  if (s.adressen?.length) return s.adressen;
  const id = adresseAus(zugang()?.id);
  return id ? [id] : [];
}

const icloudHost = (u: string) => { try { const h = new URL(u); return h.protocol === 'https:' && (h.hostname === 'icloud.com' || h.hostname.endsWith('.icloud.com')); } catch { return false; } };

/** Eine WebDAV-Anfrage an iCloud. Weiterleitungen nur innerhalb von iCloud, mit Zugang. */
async function dav(url: string, method: string, opt: { body?: string; tiefe?: '0' | '1'; kopf?: Record<string, string>; typ?: string } = {}): Promise<{ status: number; text: string; etag?: string }> {
  const z = zugang();
  if (!z) throw new KalenderFehler('iCloud ist nicht verbunden.', 503);
  let ziel = url;
  for (let sprung = 0; sprung < 4; sprung++) {
    if (!icloudHost(ziel)) throw new KalenderFehler('Unerwartete Adresse — Abbruch (Zugang geht nur an iCloud).');
    const r = await fetch(ziel, {
      method, redirect: 'manual', signal: AbortSignal.timeout(25_000),
      headers: {
        Authorization: `Basic ${Buffer.from(`${z.id}:${z.passwort}`).toString('base64')}`,
        ...(opt.body ? { 'Content-Type': opt.typ ?? 'application/xml; charset=utf-8' } : {}),
        ...(opt.tiefe ? { Depth: opt.tiefe } : {}),
        'User-Agent': 'MAKE OS Kalender',
        ...opt.kopf,
      },
      body: opt.body,
    });
    if ([301, 302, 307, 308].includes(r.status) && r.headers.get('location')) { ziel = new URL(r.headers.get('location')!, ziel).toString(); continue; }
    if (r.status === 401 || r.status === 403) throw new KalenderFehler('iCloud lehnt die Anmeldung ab — Apple-ID oder app-spezifisches Passwort stimmt nicht (neu einrichten mit deploy/icloud-verbinden.sh).', 401);
    return { status: r.status, text: await r.text(), etag: etagSauber(r.headers.get('etag') ?? undefined) };
  }
  throw new KalenderFehler('Zu viele Weiterleitungen.');
}

const PROPFIND = (props: string) => `<?xml version="1.0" encoding="UTF-8"?><d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:cs="http://calendarserver.org/ns/" xmlns:a="http://apple.com/ns/ical/"><d:prop>${props}</d:prop></d:propfind>`;

/** Wo liegen die Kalender? principal → calendar-home-set (+ die Adressen des Kontos für Einladungen, K3). */
async function entdecke(): Promise<{ home: string; adressen: string[] }> {
  const p = await dav(BASIS, 'PROPFIND', { tiefe: '0', body: PROPFIND('<d:current-user-principal/>') });
  const principal = text(antworten(p.text, ['current-user-principal'])[0]?.props['current-user-principal'] ?? '', 'href');
  if (!principal) throw new KalenderFehler(`iCloud: kein Konto gefunden (${p.status}).`);
  const h = await dav(adresse(BASIS, principal), 'PROPFIND', { tiefe: '0', body: PROPFIND('<c:calendar-home-set/><c:calendar-user-address-set/>') });
  const props = antworten(h.text, ['calendar-home-set', 'calendar-user-address-set'])[0]?.props ?? {};
  const home = text(props['calendar-home-set'] ?? '', 'href');
  if (!home) throw new KalenderFehler('iCloud: keine Kalender gefunden.');
  const url = adresse(adresse(BASIS, principal), home);
  if (!icloudHost(url)) throw new KalenderFehler('iCloud: unerwartete Kalender-Adresse.');
  const adressen = Array.from(new Set(Array.from((props['calendar-user-address-set'] ?? '').matchAll(/mailto:([^<\s"]+)/gi)).map(m => adresseAus(m[1])).filter((x): x is string => !!x)));
  return { home: url, adressen };
}

async function kalenderListe(home: string): Promise<KalenderEintrag[]> {
  const r = await dav(home, 'PROPFIND', { tiefe: '1', body: PROPFIND('<d:displayname/><d:resourcetype/><cs:getctag/><a:calendar-color/><c:supported-calendar-component-set/><d:current-user-privilege-set/>') });
  if (r.status !== 207) throw new KalenderFehler(`iCloud: Kalenderliste nicht lesbar (${r.status}).`);
  return antworten(r.text, ['displayname', 'resourcetype', 'getctag', 'calendar-color', 'supported-calendar-component-set', 'current-user-privilege-set'])
    .filter(a => istTerminKalender(a.props))
    .map(a => {
      const farbe = klartext(a.props['calendar-color'])?.slice(0, 7);
      const rechte = a.props['current-user-privilege-set'];
      return {
        id: adresse(home, a.href),
        name: klartext(a.props.displayname) || 'Kalender',
        ...(farbe && /^#[0-9a-f]{6}$/i.test(farbe) ? { farbe } : {}),
        ctag: klartext(a.props.getctag),
        schreibbar: !rechte || /<(?:[\w-]+:)?(write|write-content|all)\s*\/?>/.test(rechte),
      };
    });
}

const zeitraumUtc = (tag: string) => `${tag.replace(/-/g, '')}T000000Z`;

async function holeObjekte(kal: KalenderEintrag): Promise<KalenderObjekt[]> {
  const heute = localDay();
  const body = `<?xml version="1.0" encoding="UTF-8"?><c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><d:getetag/><c:calendar-data/></d:prop><c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT"><c:time-range start="${zeitraumUtc(tagPlus(heute, HOLEN_VON))}" end="${zeitraumUtc(tagPlus(heute, HOLEN_BIS))}"/></c:comp-filter></c:comp-filter></c:filter></c:calendar-query>`;
  const r = await dav(kal.id, 'REPORT', { tiefe: '1', body });
  if (r.status !== 207) throw new KalenderFehler(`iCloud: „${kal.name}“ nicht lesbar (${r.status}).`);
  return antworten(r.text, ['getetag', 'calendar-data'])
    .filter(a => a.props['calendar-data'])
    .map(a => ({ href: adresse(kal.id, a.href), etag: etagSauber(a.props.getetag), ics: a.props['calendar-data'] }));
}

// ── Abgleich ────────────────────────────────────────────────────────────────

const LEER: IcloudStand = { kalender: [], objekte: {} };
export async function ladeStand(): Promise<IcloudStand> {
  const s = await loadJson<IcloudStand>(SPEICHER);
  return s && Array.isArray(s.kalender) ? { ...LEER, ...s } : { ...LEER };
}

/** Geparste Termine je (Stand, Zeitraum) — die Kalenderseite fragt denselben Zeitraum jede Minute, das ICS-Parsen aller Objekte kostete jedes Mal 100–700 ms (Tempo-Prüfung 27.09.). */
const terminCache = new Map<string, Termin[]>();

/** Alle Termine aller Kalender im Zeitraum [von, bis) — Berliner Tage. */
export function termineImZeitraum(s: IcloudStand, von: string, bis: string): Termin[] {
  const key = `${s.at ?? ''}|${von}|${bis}`;
  const c = s.at ? terminCache.get(key) : undefined;
  if (c) return c;
  const raus: Termin[] = [];
  const ich = kontoAdressen(s);
  for (const k of s.kalender) for (const o of s.objekte[k.id] ?? []) raus.push(...termineAus(o, k, von, bis, ich));
  raus.sort((a, b) => a.start.localeCompare(b.start) || a.titel.localeCompare(b.titel));
  if (s.at) { if (terminCache.size >= 24) terminCache.clear(); terminCache.set(key, raus); }
  return raus;
}

/** Wie der Mac-Kalender die Kalender eingeordnet hat — manche Leser färben danach. */
const EINORDNUNG: Record<string, { category: string; owner: string }> = {
  'privat kevin': { category: 'private-kevin', owner: 'kevin' },
  'privat malin': { category: 'private-malin', owner: 'malin' },
  'kevin dieckmann': { category: 'holding', owner: 'kevin' },
};

/**
 * Für alle bisherigen Leser: aufgefaltet im alten Format (Mac-Kalender). Seit 29.09. (K1) mit Art, frei/beschäftigt
 * und „privat“ (+ `von`, wer ihn angelegt hat) — die Leser (Heute, ZOE, Signale) müssen private Termine anderer
 * Personen selbst als „Belegt“ zeigen (Verbindungsrunde K6).
 */
function cacheFormat(t: Termin, bezuege: BezugBestand | null) {
  const m = mitBezug(t, bezuege);
  const e = EINORDNUNG[t.kalender.trim().toLowerCase()] ?? { category: 'joint', owner: 'both' };
  return {
    id: t.id, uid: t.uid, title: t.titel, ...e, startDate: t.start, endDate: t.ende, allDay: t.ganztags,
    calendarName: t.kalender, ...(t.ort ? { location: t.ort } : {}), source: 'icloud', serie: t.serie, bearbeitbar: t.bearbeitbar,
    art: m.art, beschaeftigt: m.beschaeftigt, ...(m.sichtbarkeit === 'privat' ? { privat: true } : {}), ...(m.von ? { von: m.von } : {}),
  };
}

/** Kurzbild aller Objekte eines Stands (UID, Starttag, Art/Farbe/Sichtbarkeit aus dem Text) — Abgleich und Verbindungsprüfung. */
export function objekteKurz(s: IcloudStand): { uid: string; tag?: string; zusatz: ReturnType<typeof objektKurz>['zusatz'] }[] {
  const raus: { uid: string; tag?: string; zusatz: ReturnType<typeof objektKurz>['zusatz'] }[] = [];
  for (const k of s.kalender) for (const o of s.objekte[k.id] ?? []) { const x = objektKurz(o.ics); if (x.uid) raus.push({ uid: x.uid, ...(x.tag ? { tag: x.tag } : {}), zusatz: x.zusatz }); }
  return raus;
}

/** Das Fenster [von, bis), in dem der Stand alle Objekte kennt — null, wenn der Stand fehlt oder der letzte Lauf scheiterte. */
export function holfenster(s: IcloudStand): { von: string; bis: string } | null {
  if (!s.at || (s.fehlerAt && s.fehlerAt > s.at)) return null;
  const tag = localDay(new Date(s.at));
  return { von: tagPlus(tag, HOLEN_VON), bis: tagPlus(tag, HOLEN_BIS) };
}

let laufend: Promise<IcloudStand> | null = null;

/**
 * Mit iCloud abgleichen. Eine Anfrage für die Kalenderliste; nur Kalender,
 * deren ctag sich geändert hat, werden neu geholt. Läuft nie doppelt.
 */
export async function abgleichen(opt: { erzwingen?: boolean; nur?: string } = {}): Promise<IcloudStand> {
  // Ein gewöhnlicher Abgleich hängt sich an einen laufenden an. Nach einem
  // eigenen Schreiben (nur/erzwingen) muss es ein NEUER sein — der laufende
  // hat die Änderung womöglich noch nicht gesehen.
  if (laufend && !opt.nur && !opt.erzwingen) return laufend;
  while (laufend) await laufend.catch(() => {});
  laufend = (async () => {
    const alt = await ladeStand();
    try {
      // Die Adressen (K3) fehlen in Ständen vor dem 30.09. — dann einmal neu entdecken.
      const ort = alt.home && alt.adressen ? { home: alt.home, adressen: alt.adressen } : await entdecke();
      const home = ort.home;
      const liste = await kalenderListe(home);
      const objekte: Record<string, KalenderObjekt[]> = {};
      for (const k of liste) {
        const vorher = alt.kalender.find(x => x.id === k.id);
        const unveraendert = !opt.erzwingen && opt.nur !== k.id && vorher?.ctag && vorher.ctag === k.ctag && alt.objekte[k.id];
        objekte[k.id] = unveraendert ? alt.objekte[k.id] : await holeObjekte(k);
      }
      const neu: IcloudStand = { at: new Date().toISOString(), home, adressen: ort.adressen, kalender: liste, objekte };
      await saveJson(SPEICHER, neu);
      // Sicherung von Art/„privat“ im Neben-Bestand nachtragen (Apple kann X-MAKE-ART/CLASS verlieren) — ein Fehler hier kostet den Abgleich nicht.
      let bezuege: BezugBestand | null = null;
      try { await bezuegeAbgleichen(objekteKurz(neu), neu.at); bezuege = await ladeBezuege(); } catch { /* nächster Lauf */ }
      const heute = localDay();
      await saveJson(CACHE, { events: termineImZeitraum(neu, tagPlus(heute, CACHE_VON), tagPlus(heute, CACHE_BIS)).map(t => cacheFormat(t, bezuege)), at: neu.at, quelle: 'icloud' });
      return neu;
    } catch (e) {
      const fehler = e instanceof Error ? e.message.slice(0, 300) : 'iCloud nicht erreichbar.';
      // Die Adresse kann sich ändern — beim nächsten Mal neu suchen.
      const anmeldung = e instanceof KalenderFehler && e.status === 401;
      const s: IcloudStand = { ...alt, home: anmeldung ? alt.home : undefined, ...(anmeldung ? {} : { adressen: undefined }), fehler, fehlerAt: new Date().toISOString(), fehlerAnmeldung: anmeldung };
      await saveJson(SPEICHER, s).catch(() => {});
      throw e;
    }
  })().finally(() => { laufend = null; });
  return laufend;
}

/** Stand, der höchstens FRISCH_MS alt ist — sonst erst abgleichen. Fehler → letzter Stand + Hinweis. */
export async function frischerStand(): Promise<IcloudStand> {
  const s = await ladeStand();
  if (!naechsterVersuchFaellig(s)) return s;
  try { return await abgleichen(); } catch { return ladeStand(); }
}

/** Frisch genug? Nach einem Fehler erst nach einer Pause wieder — nach abgelehnter Anmeldung nach 30 Minuten. */
export function naechsterVersuchFaellig(s: IcloudStand, jetzt = Date.now()): boolean {
  if (s.at && jetzt - Date.parse(s.at) < FRISCH_MS) return false;
  if (s.fehlerAt && (!s.at || s.fehlerAt > s.at)) return jetzt - Date.parse(s.fehlerAt) >= (s.fehlerAnmeldung ? 30 * 60_000 : FRISCH_MS);
  return true;
}

// ── Schreiben ───────────────────────────────────────────────────────────────

export function kalenderNachName(s: IcloudStand, name: string): KalenderEintrag | undefined {
  const n = name.trim().toLowerCase();
  return s.kalender.find(k => k.name.trim().toLowerCase() === n);
}

function findeObjekt(s: IcloudStand, uid: string): { kal: KalenderEintrag; obj: KalenderObjekt } | null {
  for (const kal of s.kalender) for (const obj of s.objekte[kal.id] ?? []) if (uidVon(obj.ics) === uid) return { kal, obj };
  return null;
}

/**
 * Anlegen: alles aus NeuerTermin (ohne uid, ohne Organisator — der kommt aus dem Konto) plus der Kalender (Name). `uid`
 * nur für Server-Vorgänge, die idempotent sein müssen (K5: Übernahme der Wochenplan-Blöcke, Spiegel von Event/Familie) —
 * eine feste, echte UID: gibt es den Termin schon (If-None-Match scheitert mit 412 oder er steht im Stand), wird nichts
 * doppelt angelegt (`schonDa`).
 */
export type NeuEingabe = Omit<NeuerTermin, 'uid' | 'organisator'> & { kalender: string; uid?: string };

const UID_FEST = /^[A-Za-z0-9][A-Za-z0-9._-]{7,120}$/;

/** Neuen Termin anlegen. Liefert die UID. Mit Gästen nur nach Bestätigung (`einladungBestaetigt`, sonst EinladungNoetig). */
export async function anlegen(e: NeuEingabe, opt: { einladungBestaetigt?: boolean } = {}): Promise<{ uid: string; kalender: string; gaeste: number; schonDa?: true }> {
  const gaeste = e.gaeste ?? [];
  if (gaeste.length && !opt.einladungBestaetigt) throw new EinladungNoetig('einladung', gaeste.map(g => g.email));
  const s = await frischerStand();
  const kal = kalenderNachName(s, e.kalender);
  if (!kal) throw new KalenderFehler(`Kalender „${e.kalender}“ gibt es in iCloud nicht.`, 400);
  if (!kal.schreibbar) throw new KalenderFehler(`„${kal.name}“ ist nur lesbar (geteilt ohne Schreibrecht).`, 403);
  if (e.uid !== undefined && !UID_FEST.test(e.uid)) throw new KalenderFehler('Ungültige Termin-Kennung.', 400);
  const { uid: fest, kalender: _k, ...rest } = e;
  if (fest) { const da = findeObjekt(s, fest); if (da) return { uid: fest, kalender: da.kal.name, gaeste: 0, schonDa: true }; }
  const ich = kontoAdressen(s);
  if (gaeste.length && !ich[0]) throw new KalenderFehler('Ohne iCloud-Adresse keine Einladung — bitte iCloud neu verbinden.', 409);
  const uid = fest ?? randomUUID().toUpperCase();
  const r = await dav(`${kal.id.replace(/\/?$/, '/')}${uid}.ics`, 'PUT', { body: baueTermin({ uid, ...rest, ...(gaeste.length ? { gaeste: gaeste.filter(g => !ich.includes(g.email)), organisator: ich[0] } : {}) }), typ: 'text/calendar; charset=utf-8', kopf: { 'If-None-Match': '*' } });
  // Feste UID und 412: der Termin liegt schon dort (ein früherer, abgebrochener Lauf) — nicht noch einmal.
  if (fest && r.status === 412) { await abgleichen({ nur: kal.id }).catch(() => {}); return { uid, kalender: kal.name, gaeste: 0, schonDa: true }; }
  if (![200, 201, 204].includes(r.status)) throw new KalenderFehler(`iCloud hat den Termin nicht angenommen (${r.status}).`);
  await abgleichen({ nur: kal.id }).catch(() => {});
  return { uid, kalender: kal.name, gaeste: gaeste.length };
}

/** Gibt es den Termin (UID) im aktuellen Stand? Für Bezug-Änderungen ohne iCloud-Schreiben (auch Serien). */
export async function terminBekannt(uid: string): Promise<boolean> {
  return !!findeObjekt(await frischerStand(), uid);
}

/** Der aktuelle Termin (erstes Vorkommen) eines Objekts — für „Deine Fassung“ bei 409. */
function aktuellerTermin(s: IcloudStand, uid: string): Termin | null {
  const f = findeObjekt(s, uid);
  if (!f) return null;
  const heute = localDay();
  return termineAus(f.obj, f.kal, tagPlus(heute, HOLEN_VON), tagPlus(heute, HOLEN_BIS), kontoAdressen(s))[0] ?? null;
}

/** Der Termin (erstes Vorkommen im Holfenster) aus dem aktuellen Stand — für die CRM-Folgen einer Bezug-Änderung (K3). */
export async function terminLesen(uid: string): Promise<Termin | null> {
  return aktuellerTermin(await frischerStand(), uid);
}

/**
 * Einzeltermin ändern (Zeit, Titel, Ort, Notiz, Art, Farbe, frei/beschäftigt, Sichtbarkeit) — mit ETag, nie blind.
 * `stand` = das ETag, das der Browser zuletzt gesehen hat: weicht es vom aktuellen ab (am iPhone geändert, schon
 * abgeglichen), gibt es 409 mit dem aktuellen Termin statt still zu überschreiben.
 */
export async function aendern(uid: string, a: Aenderung, opt: { stand?: string; einladungBestaetigt?: boolean } = {}): Promise<{ gaeste: number }> {
  const s = await frischerStand();
  const f = findeObjekt(s, uid);
  if (!f) throw new KalenderFehler('Termin nicht gefunden — vielleicht gerade in Apple gelöscht.', 404);
  if (!f.kal.schreibbar) throw new KalenderFehler(`„${f.kal.name}“ ist nur lesbar.`, 403);
  if (opt.stand && f.obj.etag && opt.stand !== f.obj.etag) throw new KalenderKonflikt('Der Termin wurde inzwischen woanders geändert — deine Fassung ist unten noch da.', aktuellerTermin(s, uid));
  // K3: Post an Gäste nur nach Bestätigung — betroffen sind die bisherigen UND die neuen Gäste (Ausgeladene bekommen eine Absage).
  const ich = kontoAdressen(s);
  const lage = einladungsLage(f.obj.ics, ich);
  if (lage.serie) throw new KalenderFehler('Serientermin — bitte in Apple Kalender ändern.', 400);
  if (lage.gast) throw new KalenderFehler('Du bist hier Gast — nur zusagen oder absagen; ändern kann nur, wer eingeladen hat.', 400);
  const betroffen = Array.from(new Set([...lage.gaeste, ...(a.gaeste ?? []).map(g => g.email).filter(m => !ich.includes(m))]));
  if (betroffen.length && !opt.einladungBestaetigt) throw new EinladungNoetig(lage.gaeste.length ? 'aenderung' : 'einladung', betroffen);
  const neu = aendereTermin(f.obj.ics, a, new Date(), { ich, einladungBestaetigt: opt.einladungBestaetigt });
  if ('fehler' in neu) throw new KalenderFehler(neu.fehler, 400);
  const r = await dav(f.obj.href, 'PUT', { body: neu.ics, typ: 'text/calendar; charset=utf-8', kopf: f.obj.etag ? { 'If-Match': f.obj.etag } : {} });
  if (r.status === 412) { await abgleichen({ nur: f.kal.id }).catch(() => {}); throw new KalenderKonflikt('Der Termin wurde gerade woanders geändert — deine Fassung ist unten noch da.', aktuellerTermin(await ladeStand(), uid)); }
  if (![200, 201, 204].includes(r.status)) throw new KalenderFehler(`iCloud hat die Änderung nicht angenommen (${r.status}).`);
  await abgleichen({ nur: f.kal.id }).catch(() => {});
  return { gaeste: betroffen.length };
}

/**
 * Termin löschen — Einzeltermine, mit ETag (und `stand` wie beim Ändern). Mit Gästen (K3): nur, wenn wir eingeladen haben,
 * und nur nach Bestätigung (iCloud schickt die Absage). Liefert die Zahl der Gäste (für das Protokoll).
 */
export async function loeschen(uid: string, opt: { stand?: string; einladungBestaetigt?: boolean } = {}): Promise<{ gaeste: number }> {
  const s = await frischerStand();
  const f = findeObjekt(s, uid);
  if (!f) return { gaeste: 0 }; // schon weg
  if (!f.kal.schreibbar) throw new KalenderFehler(`„${f.kal.name}“ ist nur lesbar.`, 403);
  if (opt.stand && f.obj.etag && opt.stand !== f.obj.etag) throw new KalenderKonflikt('Der Termin wurde inzwischen woanders geändert — bitte erst ansehen.', aktuellerTermin(s, uid));
  const ich = kontoAdressen(s);
  const grund = nichtBearbeitbar(f.obj.ics, ich);
  if (grund) throw new KalenderFehler(grund.replace('ändern', 'löschen'), 400);
  const lage = einladungsLage(f.obj.ics, ich);
  if (lage.gaeste.length && !opt.einladungBestaetigt) throw new EinladungNoetig('absage', lage.gaeste);
  const r = await dav(f.obj.href, 'DELETE', { kopf: f.obj.etag ? { 'If-Match': f.obj.etag } : {} });
  if (r.status === 412) { await abgleichen({ nur: f.kal.id }).catch(() => {}); throw new KalenderKonflikt('Der Termin wurde gerade woanders geändert — bitte erst ansehen.', aktuellerTermin(await ladeStand(), uid)); }
  if (![200, 204, 404].includes(r.status)) throw new KalenderFehler(`iCloud hat das Löschen nicht angenommen (${r.status}).`);
  await abgleichen({ nur: f.kal.id }).catch(() => {});
  return { gaeste: lage.gaeste.length };
}

/**
 * Als Gast zusagen/absagen (K3) — auch an Serien (die Antwort gilt dem ganzen Termin). Nur nach Bestätigung: iCloud
 * schickt die Antwort an den Organisator. Mit ETag wie beim Ändern.
 */
export async function antwortSenden(uid: string, status: Exclude<Teilnahme, 'offen'>, opt: { stand?: string; einladungBestaetigt?: boolean } = {}): Promise<void> {
  const s = await frischerStand();
  const f = findeObjekt(s, uid);
  if (!f) throw new KalenderFehler('Termin nicht gefunden — vielleicht gerade in Apple gelöscht.', 404);
  if (opt.stand && f.obj.etag && opt.stand !== f.obj.etag) throw new KalenderKonflikt('Der Termin wurde inzwischen woanders geändert — bitte erst ansehen.', aktuellerTermin(s, uid));
  const ich = kontoAdressen(s);
  const lage = einladungsLage(f.obj.ics, ich);
  if (!lage.gast) throw new KalenderFehler(lage.ichOrganisator ? 'Du hast eingeladen — zusagen oder absagen können nur die Gäste.' : 'Dieser Termin hat keine Einladung.', 400);
  if (!opt.einladungBestaetigt) throw new EinladungNoetig('antwort', lage.empfaenger);
  const neu = antwortSetzen(f.obj.ics, ich, status);
  if ('fehler' in neu) throw new KalenderFehler(neu.fehler, 400);
  const r = await dav(f.obj.href, 'PUT', { body: neu.ics, typ: 'text/calendar; charset=utf-8', kopf: f.obj.etag ? { 'If-Match': f.obj.etag } : {} });
  if (r.status === 412) { await abgleichen({ nur: f.kal.id }).catch(() => {}); throw new KalenderKonflikt('Der Termin wurde gerade woanders geändert — bitte erst ansehen.', aktuellerTermin(await ladeStand(), uid)); }
  if (![200, 201, 204].includes(r.status)) throw new KalenderFehler(`iCloud hat die Antwort nicht angenommen (${r.status}).`);
  await abgleichen({ nur: f.kal.id }).catch(() => {});
}
