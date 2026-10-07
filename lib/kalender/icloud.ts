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
//
// Seit R-K1 (29.09., KALENDER_FEHLER_ABGLEICH.md):
//   Schlüssel   Termine heißen `kalender|uid` (+ `::RID`) — dieselbe UID in zwei Kalendern sind zwei Termine (#46).
//               Ändern/Löschen nehmen den Schlüssel oder (alt) die UID; eine alte UID in mehreren Kalendern → 409.
//   Fehler      401 = Anmeldung abgelehnt (30 Min. Pause). 403 bzw. eine gekürzte Antwort (507) betrifft EINEN
//               Kalender: er wird übersprungen (alter Stand bleibt, `hinweise`), der Rest läuft weiter (#51/#43).
//               503/429: Pause nach `Retry-After`, sonst exponentiell 2 → 30 Min. (#50). `abgleichAlter`: „vor X Min.“,
//               ab 30 Min. veraltet — in der Kalender-Antwort und im HOI-Stand.
//   Schreiben   Ohne ETag nie blind: erst holen (GET), bei Abweichung 409 (#37). Zeitüberschreitung beim Anlegen:
//               erst nachsehen (GET `${uid}.ics`), dann mit DERSELBEN UID noch einmal — nie ein Duplikat (#38).
//   Tempo       geparste Termine je Objekt + ETag (+ Zeitraum) im Speicher, nicht je Abgleich (#95).
//
// Seit 06.10. (iCloud je Person, lib/kalender/icloud-person.ts):
//   Haushalt    `kalender-icloud` bleibt der Haushalts-Kalender der Haupt-Person (`ICLOUD_PERSON`, sonst der Inhaber) —
//               Zugang aus der Oberfläche (Kalender › Einstellungen › iCloud) oder, solange dort nichts steht, aus der
//               Umgebung (`zugang()` → lib/kalender/icloud-haupt.ts). Sichtregeln wie bisher.
//   Je Person   Jede weitere Person verbindet ihr EIGENES iCloud-Konto; der Spiegel `kalender-icloud--<person>` liegt über dem
//               Stand (`ladeStand`, wie Google) — Kalender mit `quelle: 'icloud'` + `person`. Termine daraus tragen
//               `persoenlich` und sind für alle anderen nur „Belegt“ (`maskieren`). Geschrieben wird mit dem Zugang DIESER
//               Person (`ortVon`); Termine, die auch im Haushalts-Kalender stehen (geteilte Kalender), zählen nur dort.
//   Server      caldav.icloud.com ist von Apple nicht offiziell dokumentiert — es ist die Adresse, die Apple-Geräte und
//               verbreitete CalDAV-Programme nutzen und die MAKE OS seit 25.09. bewährt verwendet (Entdecken über
//               current-user-principal → calendar-home-set, Weiterleitungen nur innerhalb von *.icloud.com).

import { randomUUID } from 'node:crypto';
import { loadJson, saveJson } from '@/lib/store/local-db';
import { antworten, istTerminKalender, text, adresse, etagSauber, klartext, unvollstaendig } from './dav';
import { termineAus, baueTermin, aendereTermin, antwortSetzen, einladungsLage, uidVon, nichtBearbeitbar, objektKurz, adresseAus, type KalenderObjekt, type Termin, type Aenderung, type NeuerTermin, type Teilnahme } from './ics';
import { tagPlus } from './zeit';
import { localDay } from '@/lib/zeit';
import { mitBezug, kalenderKennung, terminSchluessel, schluesselTeile, type BezugBestand, type ObjektKurz } from './bezug';
import { ausWandzeit } from './zeit';
import { ladeBezuege, bezuegeAbgleichen } from './bezug-server';
import { UID_FEST } from './eingabe';
import { ueberlagerung, type GoogleKalenderEintrag } from './google/stand';
import { alleSpeicher } from '@/lib/zugang/konten';
import { hauptZugangSync, type IcloudZugang } from './icloud-haupt';

export const SPEICHER = 'kalender-icloud';
export const CACHE = 'calendar-cache';
const BASIS = 'https://caldav.icloud.com/';
/** Holfenster für Roh-Objekte (Tage relativ zu heute). */
export const HOLEN_VON = -90, HOLEN_BIS = 400;
/** Fenster für den aufgefalteten calendar-cache. */
const CACHE_VON = -30, CACHE_BIS = 120;
/** Ab wann ein Stand als alt gilt und beim Lesen erneuert wird. */
export const FRISCH_MS = 2 * 60_000;

export interface KalenderEintrag {
  id: string; name: string; farbe?: string; ctag?: string; schreibbar: boolean;
  /**
   * Google (03.10.): dieser Kalender ist die Überlagerung eines Google-Kalenders (lib/kalender/google/stand.ts) — kein CalDAV.
   * `icloud` (06.10.): ein Kalender aus der EIGENEN iCloud-Verbindung einer Person (lib/kalender/icloud-person.ts) — CalDAV mit
   * dem Zugang dieser Person. Ohne Angabe: der Haushalts-Kalender (`kalender-icloud`).
   */
  quelle?: 'google' | 'icloud';
  /** Google bzw. iCloud je Person: wessen Konto. */
  person?: string;
  /** Google bzw. iCloud je Person: die Adresse(n) dieses Kontos (Organisator/Gast?) — sonst gelten die iCloud-Adressen des Stands. */
  ich?: string[];
  /** Nur iCloud je Person: der neutrale Name für andere Personen („iCloud · <Vorname>“). */
  neutral?: string;
}
export interface IcloudStand {
  at?: string;
  fehler?: string;
  fehlerAt?: string;
  /** iCloud hat die Anmeldung abgelehnt — dann seltener versuchen (Apple sperrt sonst). */
  fehlerAnmeldung?: boolean;
  home?: string;
  /** Adressen des Kontos (calendar-user-address-set, klein) — Organisator neuer Einladungen, „bin ich Gast?“ (K3). */
  adressen?: string[];
  /** R-K1 #51/#43: Kalender, die beim letzten Lauf übersprungen wurden (403, gekürzte Antwort) — ihr alter Stand blieb. */
  hinweise?: { kalender: string; grund: string }[];
  /** R-K1 #50: wie oft der Abgleich zuletzt in Folge scheiterte (für das Backoff) … */
  fehlerFolge?: number;
  /** … und vor wann kein neuer Versuch (Retry-After bzw. exponentiell). */
  pauseBis?: string;
  kalender: KalenderEintrag[];
  objekte: Record<string, KalenderObjekt[]>;
}

// ── Zugang ──────────────────────────────────────────────────────────────────

/**
 * Zugang des HAUSHALTS-Kalenders (06.10.): aus der Oberfläche (Haupt-Person) oder der Umgebung — lib/kalender/icloud-haupt.ts.
 * Die Verbindungen der übrigen Personen holt lib/kalender/icloud-person.ts (`personZugang`), nie diese Funktion.
 */
export function zugang(): IcloudZugang | null {
  return hauptZugangSync();
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
/** 403 (R-K1 #51): iCloud verweigert eine Sammlung oder ein Objekt (geteilter Kalender, Rechte) — KEINE abgelehnte Anmeldung. */
export class KalenderVerboten extends KalenderFehler {
  constructor(message: string) { super(message, 403); }
}
/** 503/429 (R-K1 #50): iCloud bittet um Pause — `sekunden` aus Retry-After, wenn angegeben. */
export class KalenderUeberlastet extends KalenderFehler {
  constructor(message: string, public sekunden?: number) { super(message, 503); }
}
/** Zeitüberschreitung (R-K1 #38) — ob die Anfrage ankam, ist offen. */
export class KalenderZeitueberschreitung extends KalenderFehler {
  constructor() { super('iCloud antwortet nicht (Zeitüberschreitung) — bitte gleich noch einmal.', 504); }
}

/**
 * Vorübergehend (Upload U1 M1)? Überlast (503/429), Zeitüberschreitung, iCloud nicht verbunden, Netz weg (fetch-TypeError,
 * ECONN…/ETIMEDOUT/ENOTFOUND/EAI_AGAIN/UND_ERR…) oder ein 5xx von iCloud außer 507. Solche Fehler sind kein Grund, etwas
 * endgültig zu überspringen — der Vorgang scheitert und wird später wieder aufgenommen.
 */
export function voruebergehenderFehler(e: unknown, verbundenJetzt = verbunden()): boolean {
  if (!verbundenJetzt) return true;
  if (e instanceof KalenderUeberlastet || e instanceof KalenderZeitueberschreitung) return true;
  if (e instanceof KalenderFehler) return e.status === 503 || e.status === 504 || /\((50[0-689]|5[1-9]\d)\)/.test(e.message);
  if (e instanceof TypeError) return true;
  const code = (e as { code?: unknown } | null)?.code;
  return typeof code === 'string' && /^(ECONN|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|EPIPE|UND_ERR)/.test(code);
}

/** Retry-After (Sekunden oder HTTP-Datum) → Sekunden, gedeckelt auf eine Stunde. */
export function retryAfterSekunden(v: string | null | undefined, jetzt = Date.now()): number | undefined {
  if (!v) return undefined;
  const n = Number(v.trim());
  const s = Number.isFinite(n) ? n : (Date.parse(v) - jetzt) / 1000;
  return Number.isFinite(s) && s > 0 ? Math.min(3600, Math.ceil(s)) : undefined;
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

/** Text bei abgelehnter Anmeldung (401) — Apple macht App-Passwörter ungültig, sobald das Apple-Passwort geändert wird. */
export const ANMELDUNG_ABGELEHNT = 'iCloud lehnt die Anmeldung ab — das app-spezifische Passwort gilt nicht mehr (Apple macht es ungültig, wenn das Apple-Passwort geändert oder das App-Passwort widerrufen wird) oder die Apple-ID stimmt nicht. Bitte unter Kalender › Einstellungen › iCloud „Verbindung erneuern“.';

/**
 * Eine WebDAV-Anfrage an iCloud. Weiterleitungen nur innerhalb von iCloud, mit Zugang. `mit` = der Zugang einer Person
 * (iCloud je Person, 06.10.) — ohne Angabe der des Haushalts-Kalenders.
 */
async function dav(url: string, method: string, opt: { body?: string; tiefe?: '0' | '1'; kopf?: Record<string, string>; typ?: string } = {}, mit?: IcloudZugang): Promise<{ status: number; text: string; etag?: string }> {
  const z = mit ?? zugang();
  if (!z) throw new KalenderFehler('iCloud ist nicht verbunden.', 503);
  let ziel = url;
  for (let sprung = 0; sprung < 4; sprung++) {
    if (!icloudHost(ziel)) throw new KalenderFehler('Unerwartete Adresse — Abbruch (Zugang geht nur an iCloud).');
    let r: Response;
    try {
      r = await fetch(ziel, {
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
    } catch (e) {
      const name = (e as { name?: string } | null)?.name;
      if (name === 'TimeoutError' || name === 'AbortError') throw new KalenderZeitueberschreitung();
      throw e;
    }
    if ([301, 302, 307, 308].includes(r.status) && r.headers.get('location')) { ziel = new URL(r.headers.get('location')!, ziel).toString(); continue; }
    // 401 = Anmeldung abgelehnt; 403 = diese Sammlung/dieses Objekt ist verboten — getrennt behandeln (R-K1 #51).
    if (r.status === 401) throw new KalenderFehler(ANMELDUNG_ABGELEHNT, 401);
    if (r.status === 403) throw new KalenderVerboten(`iCloud verweigert den Zugriff (403)${method === 'PUT' || method === 'DELETE' ? ' — der Termin ließ sich nicht schreiben' : ''}.`);
    if (r.status === 503 || r.status === 429) throw new KalenderUeberlastet(`iCloud ist gerade überlastet (${r.status}) — neuer Versuch später.`, retryAfterSekunden(r.headers.get('retry-after')));
    return { status: r.status, text: await r.text(), etag: etagSauber(r.headers.get('etag') ?? undefined) };
  }
  throw new KalenderFehler('Zu viele Weiterleitungen.');
}

const PROPFIND = (props: string) => `<?xml version="1.0" encoding="UTF-8"?><d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:cs="http://calendarserver.org/ns/" xmlns:a="http://apple.com/ns/ical/"><d:prop>${props}</d:prop></d:propfind>`;

/**
 * Wo liegen die Kalender? principal → calendar-home-set (+ die Adressen des Kontos für Einladungen, K3). `mit`: Zugang einer
 * Person (06.10. — auch die Anmeldeprüfung beim Verbinden läuft hierüber).
 */
export async function entdecke(mit?: IcloudZugang): Promise<{ home: string; adressen: string[] }> {
  const p = await dav(BASIS, 'PROPFIND', { tiefe: '0', body: PROPFIND('<d:current-user-principal/>') }, mit);
  const principal = text(antworten(p.text, ['current-user-principal'])[0]?.props['current-user-principal'] ?? '', 'href');
  if (!principal) throw new KalenderFehler(`iCloud: kein Konto gefunden (${p.status}).`);
  const h = await dav(adresse(BASIS, principal), 'PROPFIND', { tiefe: '0', body: PROPFIND('<c:calendar-home-set/><c:calendar-user-address-set/>') }, mit);
  const props = antworten(h.text, ['calendar-home-set', 'calendar-user-address-set'])[0]?.props ?? {};
  const home = text(props['calendar-home-set'] ?? '', 'href');
  if (!home) throw new KalenderFehler('iCloud: keine Kalender gefunden.');
  const url = adresse(adresse(BASIS, principal), home);
  if (!icloudHost(url)) throw new KalenderFehler('iCloud: unerwartete Kalender-Adresse.');
  const adressen = Array.from(new Set(Array.from((props['calendar-user-address-set'] ?? '').matchAll(/mailto:([^<\s"]+)/gi)).map(m => adresseAus(m[1])).filter((x): x is string => !!x)));
  return { home: url, adressen };
}

async function kalenderListe(home: string, mit?: IcloudZugang): Promise<KalenderEintrag[]> {
  const r = await dav(home, 'PROPFIND', { tiefe: '1', body: PROPFIND('<d:displayname/><d:resourcetype/><cs:getctag/><a:calendar-color/><c:supported-calendar-component-set/><d:current-user-privilege-set/>') }, mit);
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

async function holeObjekte(kal: Pick<KalenderEintrag, 'id' | 'name'>, fenster: { von: number; bis: number } = { von: HOLEN_VON, bis: HOLEN_BIS }, mit?: IcloudZugang): Promise<KalenderObjekt[]> {
  const heute = localDay();
  const zeitraum = `<c:time-range start="${zeitraumUtc(tagPlus(heute, fenster.von))}" end="${zeitraumUtc(tagPlus(heute, fenster.bis))}"/>`;
  const body = `<?xml version="1.0" encoding="UTF-8"?><c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><d:getetag/><c:calendar-data/></d:prop><c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT">${zeitraum}</c:comp-filter></c:comp-filter></c:filter></c:calendar-query>`;
  const r = await dav(kal.id, 'REPORT', { tiefe: '1', body }, mit);
  if (r.status === 507) throw new KalenderFehler(`„${kal.name}“: iCloud hat die Antwort gekürzt (507) — Termine fehlen, der letzte vollständige Stand bleibt.`, 507);
  if (r.status !== 207) throw new KalenderFehler(`iCloud: „${kal.name}“ nicht lesbar (${r.status}).`);
  // Gekürzte Antwort (507 je Response oder „number-of-matches-within-limits“) nie still übernehmen (R-K1 #43).
  const kurz = unvollstaendig(r.text);
  if (kurz) throw new KalenderFehler(`„${kal.name}“: ${kurz}`, 507);
  return antworten(r.text, ['getetag', 'calendar-data'])
    .filter(a => a.props['calendar-data'])
    .map(a => ({ href: adresse(kal.id, a.href), etag: etagSauber(a.props.getetag), ics: a.props['calendar-data'] }));
}

/**
 * Zeitfenster der täglichen Kalender-Sicherung in Tagen ab heute (Upload U1 H2, 29.09.): −400 … +800 statt „alles“ — die
 * Tagesdateien bleiben klein und enthalten keine Jahrzehnte alter Termine samt Teilnehmern. Serien mit einem Vorkommen
 * im Fenster sind ganz dabei (CalDAV time-range).
 */
export const SICHERUNG_VON = -400;
export const SICHERUNG_BIS = 800;
/** Objekte eines Kalenders im Sicherungs-Fenster — nur für die tägliche Sicherung (R-K1 #K5, lib/kalender/sicherung-server.ts). */
export const holeSicherungsObjekte = (kal: Pick<KalenderEintrag, 'id' | 'name'>): Promise<KalenderObjekt[]> => holeObjekte(kal, { von: SICHERUNG_VON, bis: SICHERUNG_BIS });

/** Ein Objekt neu in einen Kalender legen (nur Wiederherstellung, R-K1 #K5): PUT mit If-None-Match — nie überschreiben. */
export async function objektWiederherstellen(kal: Pick<KalenderEintrag, 'id' | 'name'>, uid: string, ics: string): Promise<'angelegt' | 'schon-da'> {
  if (!/^[^\u0000-\u001f\u007f/]{1,200}$/.test(uid)) throw new KalenderFehler('Ungültige Termin-Kennung.', 400);
  const r = await dav(`${kal.id.replace(/\/?$/, '/')}${encodeURIComponent(uid)}.ics`, 'PUT', { body: ics, typ: 'text/calendar; charset=utf-8', kopf: { 'If-None-Match': '*' } });
  if (r.status === 412) return 'schon-da';
  if (![200, 201, 204].includes(r.status)) throw new KalenderFehler(`iCloud hat den Termin nicht angenommen (${r.status}).`);
  return 'angelegt';
}

// ── Abgleich ────────────────────────────────────────────────────────────────

const LEER: IcloudStand = { kalender: [], objekte: {} };
/** NUR der iCloud-Stand (so wie er auf der Platte liegt) — für den Abgleich selbst und die Sicherung; alle Leser nehmen `ladeStand`. */
export async function ladeStandIcloud(): Promise<IcloudStand> {
  const s = await loadJson<IcloudStand>(SPEICHER);
  return s && Array.isArray(s.kalender) ? { ...LEER, ...s } : { ...LEER };
}

/**
 * Der Stand für ALLE Leser: iCloud plus die Google-Kalender der verbundenen Personen (03.10.2026, lib/kalender/google/*).
 * Die Google-Kalender stehen als weitere `KalenderEintrag` (`quelle: 'google'`) mit ihren ICS-Objekten im Stand — Termine,
 * Bezüge, Verfügbarkeit, Spiegel und Verbindungsprüfung laufen darüber unverändert. Der Kopf des Stands (`at`, `fehler`,
 * `pauseBis` …) bleibt der von iCloud. Ein Fehler in der Überlagerung kostet nie den iCloud-Stand.
 */
export async function ladeStand(): Promise<IcloudStand> {
  return mitUeberlagerung(await ladeStandIcloud());
}

/**
 * Alles, was über dem Haushalts-Kalender liegt: Google je Person (03.10.) und iCloud je Person (06.10.). Nie gespeichert;
 * ein Fehler in einer Überlagerung kostet nie den Haushalts-Stand.
 */
export async function mitUeberlagerung(s: IcloudStand): Promise<IcloudStand> {
  return mitPersoenlich(await mitGoogle(s));
}

/**
 * Die Kalender aus den eigenen iCloud-Verbindungen der Personen dazulegen (lib/kalender/icloud-person.ts). Ein Objekt,
 * dessen UID schon im Stand steht (ein geteilter Kalender, der in beiden Konten auftaucht), zählt nur einmal — im
 * Haushalts-Kalender.
 */
async function mitPersoenlich(s: IcloudStand): Promise<IcloudStand> {
  try {
    const { persoenlicheUeberlagerung } = await import('./icloud-person');
    const p = await persoenlicheUeberlagerung(s);
    if (!p.kalender.length) return s;
    const fremd = new Set(p.kalender.map(k => k.id));
    return { ...s, kalender: [...s.kalender.filter(k => !fremd.has(k.id)), ...p.kalender], objekte: { ...s.objekte, ...p.objekte } };
  } catch (e) {
    console.warn(`[kalender] iCloud je Person nicht lesbar: ${e instanceof Error ? e.message.slice(0, 120) : 'Fehler'}`);
    return s;
  }
}

/** Google-Kalender über einen iCloud-Stand legen (Überlagerung, nie gespeichert). */
export async function mitGoogle(s: IcloudStand): Promise<IcloudStand> {
  try {
    const g = await ueberlagerung(await alleSpeicher());
    if (!g.kalender.length) return s;
    const fremd = new Set(g.kalender.map(k => k.id));
    return { ...s, kalender: [...s.kalender.filter(k => !fremd.has(k.id)), ...(g.kalender as GoogleKalenderEintrag[])], objekte: { ...s.objekte, ...g.objekte } };
  } catch (e) {
    console.warn(`[kalender] Google-Überlagerung nicht lesbar: ${e instanceof Error ? e.message.slice(0, 120) : 'Fehler'}`);
    return s;
  }
}

/**
 * Geparste Termine je Objekt + ETag + Zeitraum (R-K1 #95): die Kalenderseite fragt denselben Zeitraum jede Minute, das
 * ICS-Parsen aller Objekte kostete 100–700 ms (Tempo-Prüfung 27.09.). Früher hing der Cache am Abgleich (`s.at`) und
 * verfiel alle 5 Minuten; jetzt parst ein Abgleich nur die Objekte neu, die sich wirklich geändert haben.
 */
const objektCache = new Map<string, Termin[]>();
const OBJEKT_CACHE_MAX = 20_000;
function fnv(t: string): string { let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return `${(h >>> 0).toString(36)}.${t.length}`; }

/**
 * iCloud je Person (06.10.): Termine aus der eigenen Verbindung einer Person tragen ihre Person (`persoenlich`) und den neutralen
 * Kalendernamen — für alle anderen nur „Belegt“ (`maskieren`). EINE Stelle für jeden Leser, der Termine aus dem Stand baut.
 */
function persoenlichMarkieren(t: Termin[], k: KalenderEintrag): Termin[] {
  return k.quelle === 'icloud' && k.person ? t.map(x => ({ ...x, persoenlich: k.person, persoenlichName: k.neutral ?? 'Belegt' })) : t;
}

function objektTermine(o: KalenderObjekt, k: KalenderEintrag, von: string, bis: string, ich: readonly string[]): Termin[] {
  const key = [k.id, k.name, k.farbe ?? '', k.schreibbar ? 1 : 0, k.quelle ?? '', k.person ?? '', k.neutral ?? '', o.href, o.etag ? `${o.etag}.${o.ics.length}` : fnv(o.ics), von, bis, ich.join(',')].join('|');
  const c = objektCache.get(key);
  if (c) return c;
  const t = persoenlichMarkieren(termineAus(o, k, von, bis, ich), k);
  if (objektCache.size >= OBJEKT_CACHE_MAX) objektCache.clear();
  objektCache.set(key, t);
  return t;
}

/** Zeitpunkt eines Termins für die Sortierung — der mitgeführte (R-K1 #1), sonst aus der Wandzeit. */
const beginnMs = (t: Termin) => t.startMs ?? ausWandzeit(t.start).getTime();

/** Alle Termine aller Kalender im Zeitraum [von, bis) — Berliner Tage, sortiert nach dem echten Zeitpunkt. */
export function termineImZeitraum(s: IcloudStand, von: string, bis: string): Termin[] {
  const raus: Termin[] = [];
  const ich = kontoAdressen(s);
  // iCloud je Person (06.10.): `objektTermine` markiert Termine aus der eigenen Verbindung einer Person (`persoenlichMarkieren`).
  for (const k of s.kalender) for (const o of s.objekte[k.id] ?? []) raus.push(...objektTermine(o, k, von, bis, k.ich ?? ich));
  raus.sort((a, b) => beginnMs(a) - beginnMs(b) || a.titel.localeCompare(b.titel));
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
  // Google (03.10.): der Kalender „MAKE (Google)“ ist der Business-Kalender der Person — `holding` (Leser färben/ordnen danach).
  const google = /^google:/.test(t.kalenderId) ? kalenderKennung(t.kalenderId).replace(/^google-/, '') : null;
  // iCloud je Person (06.10.): privat der Person (`von` = Eigentümer), neutraler Kalendername — die Leser maskieren für andere.
  const eigen = t.persoenlich;
  const e = eigen ? { category: `private-${eigen}`, owner: eigen } : google ? { category: 'holding', owner: google } : EINORDNUNG[t.kalender.trim().toLowerCase()] ?? { category: 'joint', owner: 'both' };
  return {
    id: t.id, uid: t.uid, title: t.titel, ...e, startDate: t.start, endDate: t.ende, allDay: t.ganztags,
    calendarName: eigen ? t.persoenlichName ?? t.kalender : t.kalender, ...(t.ort ? { location: t.ort } : {}), source: 'icloud', serie: t.serie, bearbeitbar: t.bearbeitbar,
    art: m.art, beschaeftigt: m.beschaeftigt, ...(m.sichtbarkeit === 'privat' || eigen ? { privat: true } : {}), ...(eigen ? { von: eigen, persoenlich: eigen } : m.von ? { von: m.von } : {}),
    // R-K1 #68/#100: abgesagte bzw. abgelehnte Termine belegen nicht und zählen im CRM nicht.
    ...(t.abgesagt ? { abgesagt: true } : {}),
  };
}

/** Kurzbild aller Objekte eines Stands (UID, Schlüssel, Starttag, Art/Farbe/Sichtbarkeit aus dem Text) — Abgleich und Verbindungsprüfung. */
export function objekteKurz(s: IcloudStand): (ObjektKurz & { schluessel: string })[] {
  const raus: (ObjektKurz & { schluessel: string })[] = [];
  for (const k of s.kalender) {
    const kal = kalenderKennung(k.id);
    for (const o of s.objekte[k.id] ?? []) { const x = objektKurz(o.ics); if (x.uid) raus.push({ uid: x.uid, schluessel: terminSchluessel(kal, x.uid), ...(x.tag ? { tag: x.tag } : {}), zusatz: x.zusatz }); }
  }
  return raus;
}

/** Das Fenster [von, bis), in dem der Stand alle Objekte kennt — null, wenn der Stand fehlt oder der letzte Lauf scheiterte. */
export function holfenster(s: IcloudStand): { von: string; bis: string } | null {
  if (!s.at || (s.fehlerAt && s.fehlerAt > s.at)) return null;
  const tag = localDay(new Date(s.at));
  return { von: tagPlus(tag, HOLEN_VON), bis: tagPlus(tag, HOLEN_BIS) };
}

let laufend: Promise<IcloudStand> | null = null;
/** Läuft gerade ein Abgleich? (die Kalender-Jobs im Takt warten dann — lib/kalender/takt-jobs.ts, U1 M4) */
export const abgleichLaeuft = (): boolean => laufend !== null;

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
  tzMelden();
  laufend = (async () => {
    const alt = await ladeStandIcloud();
    try {
      const neu = await standHolen(alt, opt);
      await saveJson(SPEICHER, neu);
      // Sicherung von Art/„privat“ im Neben-Bestand nachtragen (Apple kann X-MAKE-ART/CLASS verlieren) — ein Fehler hier kostet den Abgleich nicht.
      let bezuege: BezugBestand | null = null;
      try { await bezuegeAbgleichen(objekteKurz(neu), neu.at); bezuege = await ladeBezuege(); } catch { /* nächster Lauf */ }
      const heute = localDay();
      const gesamt = await mitUeberlagerung(neu);
      await saveJson(CACHE, { events: termineImZeitraum(gesamt, tagPlus(heute, CACHE_VON), tagPlus(heute, CACHE_BIS)).map(t => cacheFormat(t, bezuege)), at: neu.at, quelle: 'icloud' });
      // Gespeichert ist nur der iCloud-Stand; die Leser (frischerStand, Routen) bekommen ihn MIT den Google-Kalendern.
      return gesamt;
    } catch (e) {
      await saveJson(SPEICHER, fehlerStand(alt, e)).catch(() => {});
      throw e;
    }
  })().finally(() => { laufend = null; });
  return laufend;
}

/**
 * EIN Lauf gegen iCloud: Kalenderliste (eine Anfrage), nur Kalender mit geändertem ctag neu holen, 403/507 je Kalender
 * überspringen (R-K1 #51/#43). Speichert nichts — gemeinsam für den Haushalts-Kalender (`abgleichen`) und die Verbindungen
 * je Person (lib/kalender/icloud-person.ts, 06.10.). `holen(k)`: bekommt dieser Kalender Objekte? (iCloud je Person: nur die
 * gezeigten; ein nicht gezeigter bleibt ohne Objekte und ohne ctag, damit er beim Einschalten sofort geholt wird.)
 * `mit`: der Zugang (ohne = Haushalts-Kalender).
 */
export async function standHolen(alt: IcloudStand, opt: { erzwingen?: boolean; nur?: string; holen?: (k: KalenderEintrag) => boolean } = {}, mit?: IcloudZugang): Promise<IcloudStand> {
  // Die Adressen (K3) fehlen in Ständen vor dem 30.09. — dann einmal neu entdecken.
  const ort = alt.home && alt.adressen ? { home: alt.home, adressen: alt.adressen } : await entdecke(mit);
  const home = ort.home;
  const liste = await kalenderListe(home, mit);
  const objekte: Record<string, KalenderObjekt[]> = {};
  const hinweise: { kalender: string; grund: string }[] = [];
  for (let i = 0; i < liste.length; i++) {
    const k = liste[i];
    if (opt.holen && !opt.holen(k)) { liste[i] = { ...k, ctag: undefined }; continue; }
    const vorher = alt.kalender.find(x => x.id === k.id);
    const unveraendert = !opt.erzwingen && opt.nur !== k.id && vorher?.ctag && vorher.ctag === k.ctag && alt.objekte[k.id];
    if (unveraendert) { objekte[k.id] = alt.objekte[k.id]; continue; }
    try { objekte[k.id] = await holeObjekte(k, undefined, mit); }
    catch (e) {
      // 403 (geteilt, Rechte entzogen) oder gekürzte Antwort: NUR diesen Kalender überspringen (R-K1 #51/#43) — sein
      // alter Stand bleibt, der ctag nicht (sonst gälte der alte Stand beim nächsten Lauf als aktuell), Hinweis dazu.
      if (!(e instanceof KalenderFehler) || (e.status !== 403 && e.status !== 507)) throw e;
      objekte[k.id] = alt.objekte[k.id] ?? [];
      liste[i] = { ...k, ctag: vorher?.ctag };
      hinweise.push({ kalender: k.name, grund: e.message.slice(0, 200) });
    }
  }
  return { at: new Date().toISOString(), home, adressen: ort.adressen, kalender: liste, objekte, ...(hinweise.length ? { hinweise } : {}) };
}

/**
 * Der Stand nach einem gescheiterten Lauf (rein bis auf die Uhr): Fehlertext, Pause (R-K1 #50), abgelehnte Anmeldung. Die
 * Adresse kann sich ändern — außer bei abgelehnter Anmeldung wird beim nächsten Mal neu gesucht.
 */
export function fehlerStand(alt: IcloudStand, e: unknown, jetzt = Date.now()): IcloudStand {
  const fehler = e instanceof Error ? e.message.slice(0, 300) : 'iCloud nicht erreichbar.';
  const anmeldung = e instanceof KalenderFehler && e.status === 401;
  const folge = (alt.fehlerFolge ?? 0) + 1;
  return {
    ...alt, home: anmeldung ? alt.home : undefined, ...(anmeldung ? {} : { adressen: undefined }), fehler, fehlerAt: new Date(jetzt).toISOString(), fehlerAnmeldung: anmeldung,
    fehlerFolge: folge, pauseBis: new Date(jetzt + pauseMs(folge, anmeldung, e instanceof KalenderUeberlastet ? e.sekunden : undefined)).toISOString(),
  };
}

/**
 * Den `calendar-cache` (für ZOE, Morgenlauf und alle Server-Leser) aus dem ganzen Stand neu schreiben — iCloud + Google.
 * Der iCloud-Abgleich tut das nach jedem Lauf selbst; der Google-Abgleich und jede Google-Schreibung rufen es hier auf,
 * damit die Leser nicht bis zum nächsten iCloud-Lauf (5 Min.) auf neue Google-Termine warten. Fehler stören nie.
 */
export async function cacheNeuSchreiben(): Promise<void> {
  try {
    const s = await ladeStand();
    let bezuege: BezugBestand | null = null;
    try { bezuege = await ladeBezuege(); } catch { /* ohne Bezug */ }
    const heute = localDay();
    await saveJson(CACHE, { events: termineImZeitraum(s, tagPlus(heute, CACHE_VON), tagPlus(heute, CACHE_BIS)).map(t => cacheFormat(t, bezuege)), at: s.at ?? new Date().toISOString(), quelle: 'icloud' });
  } catch (e) {
    console.warn(`[kalender] Zwischenspeicher nicht geschrieben: ${e instanceof Error ? e.message.slice(0, 120) : 'Fehler'}`);
  }
}

/** Stand, der höchstens FRISCH_MS alt ist — sonst erst abgleichen. Fehler → letzter Stand + Hinweis. */
export async function frischerStand(): Promise<IcloudStand> {
  const s = await ladeStand();
  // Ohne iCloud-Zugang (nur Google, 03.10.) gibt es nichts abzugleichen — und kein Fehlerstand soll entstehen.
  if (!verbunden() || !naechsterVersuchFaellig(s)) return s;
  try { return await abgleichen(); } catch { return ladeStand(); }
}

/**
 * Pause nach dem n-ten Fehlschlag in Folge (R-K1 #50): abgelehnte Anmeldung 30 Min. (Apple sperrt sonst), sonst
 * exponentiell 2, 4, 8, 16, 30 Min. — und nie kürzer als ein `Retry-After` von iCloud.
 */
export function pauseMs(folge: number, anmeldung: boolean, retryAfterSek?: number): number {
  const basis = anmeldung ? 30 * 60_000 : Math.min(30 * 60_000, FRISCH_MS * 2 ** Math.max(0, folge - 1));
  return Math.max(basis, (retryAfterSek ?? 0) * 1000);
}

/** Frisch genug? Nach einem Fehler erst nach der Pause (`pauseBis`) wieder — ältere Stände ohne Pause wie bisher. */
export function naechsterVersuchFaellig(s: Pick<IcloudStand, 'at' | 'fehlerAt' | 'pauseBis' | 'fehlerAnmeldung'>, jetzt = Date.now()): boolean {
  if (s.at && jetzt - Date.parse(s.at) < FRISCH_MS) return false;
  if (s.fehlerAt && (!s.at || s.fehlerAt > s.at)) {
    if (s.pauseBis && Number.isFinite(Date.parse(s.pauseBis))) return jetzt >= Date.parse(s.pauseBis);
    return jetzt - Date.parse(s.fehlerAt) >= (s.fehlerAnmeldung ? 30 * 60_000 : FRISCH_MS);
  }
  return true;
}

/** Ab so vielen Minuten ohne gelungenen Abgleich gilt der Stand als veraltet (R-K1 #51). */
export const VERALTET_MIN = 30;

/**
 * Wie alt ist der Stand (R-K1 #51)? `vorMin` = Minuten seit dem letzten GELUNGENEN Abgleich, `veraltet` ab 30 Min. (oder
 * nie abgeglichen). Für die Kalender-Antwort („letzter Abgleich vor X Min.“) und den HOI-Stand. Rein.
 */
export function abgleichAlter(s: Pick<IcloudStand, 'at' | 'fehler' | 'fehlerAt' | 'fehlerAnmeldung' | 'hinweise' | 'pauseBis'>, jetzt = Date.now()): { letzter: string | null; vorMin: number | null; veraltet: boolean; fehler?: string; anmeldung?: true; hinweise?: { kalender: string; grund: string }[]; naechsterVersuch?: string } {
  const at = s.at && Number.isFinite(Date.parse(s.at)) ? s.at : null;
  const vorMin = at ? Math.max(0, Math.floor((jetzt - Date.parse(at)) / 60_000)) : null;
  const scheitert = !!s.fehlerAt && (!at || s.fehlerAt > at);
  return {
    letzter: at, vorMin, veraltet: vorMin === null || vorMin >= VERALTET_MIN,
    ...(scheitert && s.fehler ? { fehler: s.fehler } : {}), ...(scheitert && s.fehlerAnmeldung ? { anmeldung: true as const } : {}),
    ...(s.hinweise?.length ? { hinweise: s.hinweise } : {}),
    ...(scheitert && s.pauseBis ? { naechsterVersuch: s.pauseBis } : {}),
  };
}

/** Die Zonendaten der Laufzeit (tz-Version) einmal je Prozess protokollieren (R-K1 #9) — Termine rechnen mit ihnen. */
let tzGemeldet = false;
export const tzVersion = (): string => `${process.versions.tz ?? 'unbekannt'} (ICU ${process.versions.icu ?? '?'})`;
function tzMelden() {
  if (tzGemeldet) return;
  tzGemeldet = true;
  console.info(`[kalender] Zeitzonen-Daten: tz ${tzVersion()}`);
}

// ── Schreiben ───────────────────────────────────────────────────────────────

export function kalenderNachName(s: IcloudStand, name: string): KalenderEintrag | undefined {
  const n = name.trim().toLowerCase();
  return s.kalender.find(k => k.name.trim().toLowerCase() === n);
}

/** Alle Objekte zu einem Verweis: Schlüssel `kalender|uid` (nur dieser Kalender) oder alte UID (alle Kalender). */
function objekteZu(s: IcloudStand, ref: string): { kal: KalenderEintrag; obj: KalenderObjekt }[] {
  const t = schluesselTeile(ref);
  const raus: { kal: KalenderEintrag; obj: KalenderObjekt }[] = [];
  for (const kal of s.kalender) {
    if (t.kal && kalenderKennung(kal.id) !== t.kal) continue;
    for (const obj of s.objekte[kal.id] ?? []) if (uidVon(obj.ics) === t.uid) raus.push({ kal, obj });
  }
  return raus;
}

/** Ein Fund: Kalender, Objekt, sein Schlüssel (`kalender|uid`) und ob die UID im ganzen Stand eindeutig ist. */
export interface Fund { kal: KalenderEintrag; obj: KalenderObjekt; schluessel: string; uid: string; eindeutig: boolean }

/**
 * Objekt zu einem Verweis (R-K1 #46). Lesen nimmt beim alten Verweis (nur UID) den ersten Treffer; SCHREIBEN mit einer
 * alten UID, die in mehreren Kalendern steht, bricht ab (409) — sonst träfe es womöglich den falschen Kalender.
 */
export function findeObjekt(s: IcloudStand, ref: string, schreiben = false): Fund | null {
  const l = objekteZu(s, ref);
  if (!l.length) return null;
  if (l.length > 1 && schreiben) throw new KalenderFehler('Diesen Termin gibt es in mehreren Kalendern (gleiche Kennung) — bitte neu laden und im richtigen Kalender ändern.', 409);
  const uid = schluesselTeile(ref).uid;
  const eindeutig = schluesselTeile(ref).kal ? objekteZu(s, uid).length === 1 : l.length === 1;
  return { ...l[0], uid, schluessel: terminSchluessel(kalenderKennung(l[0].kal.id), uid), eindeutig };
}

/** Schlüssel zu einem Verweis im aktuellen Stand — für Bezug und Protokoll; `eindeutig`: die UID steht in genau einem Kalender. */
export async function terminAufloesen(ref: string): Promise<{ schluessel: string; uid: string; eindeutig: boolean } | null> {
  const f = findeObjekt(await frischerStand(), ref);
  return f ? { schluessel: f.schluessel, uid: f.uid, eindeutig: f.eindeutig } : null;
}

/**
 * Wo und womit geschrieben wird (06.10., iCloud je Person): der Haushalts-Kalender mit seinem Zugang und seinen Adressen,
 * ein Kalender aus der eigenen Verbindung einer Person mit DEREN Zugang und Adressen. `nachziehen` gleicht danach genau
 * diesen Kalender ab (Fehler stören nie — der nächste Lauf holt es).
 */
interface SchreibOrt { mit?: IcloudZugang; ich: string[]; nachziehen: (kalenderId: string) => Promise<void> }
async function ortVon(kal: KalenderEintrag, s: IcloudStand): Promise<SchreibOrt> {
  if (kal.quelle === 'icloud' && kal.person) {
    const person = kal.person;
    const p = await import('./icloud-person');
    const mit = await p.personZugang(person);
    if (!mit) throw new KalenderFehler('Die iCloud-Verbindung dieser Person ist getrennt — bitte unter Kalender › Einstellungen › iCloud neu verbinden.', 409);
    return { mit, ich: kal.ich ?? [], nachziehen: id => p.personAbgleichen(person, { nur: id }).then(() => {}, () => {}) };
  }
  return { ich: kontoAdressen(s), nachziehen: id => abgleichen({ nur: id }).then(() => {}, () => {}) };
}

/**
 * Der Stand (ETag), mit dem geschrieben wird (R-K1 #37): fehlt er im Spiegel, erst holen (GET). Weicht der geholte Text
 * vom Spiegel ab, wurde inzwischen woanders geändert → 409. Ohne ETag schreibt MAKE OS nie (auch nicht „blind“).
 */
async function standZumSchreiben(f: Fund, s: IcloudStand, ref: string, o: SchreibOrt): Promise<string> {
  if (f.obj.etag) return f.obj.etag;
  const r = await dav(f.obj.href, 'GET', {}, o.mit);
  if (r.status === 404) throw new KalenderFehler('Termin nicht gefunden — vielleicht gerade in Apple gelöscht.', 404);
  if (r.status !== 200 || !r.etag) throw new KalenderFehler('iCloud liefert für diesen Termin keinen Stand (ETag) — ohne ihn schreibt MAKE OS nicht blind. Bitte neu laden.', 409);
  const glatt = (x: string) => x.replace(/\r\n/g, '\n').trim();
  if (glatt(r.text) !== glatt(f.obj.ics)) {
    await o.nachziehen(f.kal.id);
    throw new KalenderKonflikt('Der Termin wurde inzwischen woanders geändert — deine Fassung ist unten noch da.', aktuellerTermin(await ladeStand().catch(() => s), ref));
  }
  return r.etag;
}

/**
 * Anlegen: alles aus NeuerTermin (ohne uid, ohne Organisator — der kommt aus dem Konto) plus der Kalender (Name). `uid`
 * für Vorgänge, die idempotent sein müssen (K5: Übernahme der Wochenplan-Blöcke, Spiegel von Event/Familie; F1: Buchung,
 * Anlegen aus dem Browser) —
 * eine feste, echte UID: gibt es den Termin schon (If-None-Match scheitert mit 412 oder er steht im Stand), wird nichts
 * doppelt angelegt (`schonDa`).
 */
export type NeuEingabe = Omit<NeuerTermin, 'uid' | 'organisator'> & { kalender: string; uid?: string };


/** Neuen Termin anlegen. Liefert die UID. Mit Gästen nur nach Bestätigung (`einladungBestaetigt`, sonst EinladungNoetig). */
export async function anlegen(e: NeuEingabe, opt: { einladungBestaetigt?: boolean } = {}): Promise<{ uid: string; schluessel: string; kalender: string; gaeste: number; schonDa?: true }> {
  const gaeste = e.gaeste ?? [];
  if (gaeste.length && !opt.einladungBestaetigt) throw new EinladungNoetig('einladung', gaeste.map(g => g.email));
  const s = await frischerStand();
  const kal = kalenderNachName(s, e.kalender);
  if (!kal) throw new KalenderFehler(`Kalender „${e.kalender}“ gibt es in iCloud nicht.`, 400);
  if (!kal.schreibbar) throw new KalenderFehler(`„${kal.name}“ ist nur lesbar (geteilt ohne Schreibrecht).`, 403);
  if (e.uid !== undefined && !UID_FEST.test(e.uid)) throw new KalenderFehler('Ungültige Termin-Kennung.', 400);
  const { uid: fest, kalender: _k, ...rest } = e;
  if (fest) { const da = findeObjekt(s, fest); if (da) return { uid: fest, schluessel: da.schluessel, kalender: da.kal.name, gaeste: 0, schonDa: true }; }
  // Google (03.10.): dieser Kalender gehört einer Person bei Google — dorthin schreibt lib/kalender/google/schreiben.ts.
  if (kal.quelle === 'google') return (await import('./google/schreiben')).googleAnlegen(kal, { ...rest, uid: fest ?? randomUUID().toUpperCase() }, opt);
  const o = await ortVon(kal, s);
  const ich = o.ich;
  if (gaeste.length && !ich[0]) throw new KalenderFehler('Ohne iCloud-Adresse keine Einladung — bitte iCloud neu verbinden.', 409);
  const uid = fest ?? randomUUID().toUpperCase();
  const schluessel = terminSchluessel(kalenderKennung(kal.id), uid);
  const ziel = `${kal.id.replace(/\/?$/, '/')}${uid}.ics`;
  const put = () => dav(ziel, 'PUT', { body: baueTermin({ uid, ...rest, ...(gaeste.length ? { gaeste: gaeste.filter(g => !ich.includes(g.email)), organisator: ich[0] } : {}) }), typ: 'text/calendar; charset=utf-8', kopf: { 'If-None-Match': '*' } }, o.mit);
  let r: { status: number };
  let wiederholt = false;
  try { r = await put(); }
  catch (err) {
    // Zeitüberschreitung (R-K1 #38): ob der PUT ankam, ist offen. Erst nachsehen, dann mit DERSELBEN UID noch einmal
    // (If-None-Match: * schützt zusätzlich) — nie eine neue UID, also nie ein Duplikat.
    if (!(err instanceof KalenderZeitueberschreitung)) throw err;
    const da = await dav(ziel, 'GET', {}, o.mit).catch(() => null);
    wiederholt = true;
    r = da?.status === 200 ? { status: 201 } : await put();
  }
  // Feste UID und 412: der Termin liegt schon dort (ein früherer, abgebrochener Lauf) — nicht noch einmal.
  if (fest && r.status === 412) { await o.nachziehen(kal.id); return { uid, schluessel, kalender: kal.name, gaeste: 0, schonDa: true }; }
  // Nach der Wiederholung heißt 412: der erste PUT kam doch an (die UID ist neu und nur unsere).
  if (wiederholt && r.status === 412) r = { status: 201 };
  if (![200, 201, 204].includes(r.status)) throw new KalenderFehler(`iCloud hat den Termin nicht angenommen (${r.status}).`);
  await o.nachziehen(kal.id);
  return { uid, schluessel, kalender: kal.name, gaeste: gaeste.length };
}

/** Gibt es den Termin (Schlüssel oder UID) im aktuellen Stand? Für Bezug-Änderungen ohne iCloud-Schreiben (auch Serien). */
export async function terminBekannt(uid: string): Promise<boolean> {
  return !!findeObjekt(await frischerStand(), uid);
}

/** Der aktuelle Termin (erstes Vorkommen) eines Objekts — für „Deine Fassung“ bei 409. */
export function aktuellerTermin(s: IcloudStand, uid: string): Termin | null {
  let f: Fund | null = null;
  try { f = findeObjekt(s, uid); } catch { return null; }
  if (!f) return null;
  const heute = localDay();
  return persoenlichMarkieren(termineAus(f.obj, f.kal, tagPlus(heute, HOLEN_VON), tagPlus(heute, HOLEN_BIS), f.kal.ich ?? kontoAdressen(s)), f.kal)[0] ?? null;
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
export async function aendern(uid: string, a: Aenderung, opt: { stand?: string; einladungBestaetigt?: boolean } = {}): Promise<{ gaeste: number; schluessel: string; uid: string; eindeutig: boolean }> {
  const s = await frischerStand();
  const f = findeObjekt(s, uid, true);
  if (!f) throw new KalenderFehler('Termin nicht gefunden — vielleicht gerade in Apple gelöscht.', 404);
  if (!f.kal.schreibbar) throw new KalenderFehler(`„${f.kal.name}“ ist nur lesbar.`, 403);
  if (f.kal.quelle === 'google') return (await import('./google/schreiben')).googleAendern(f, a, opt);
  if (opt.stand && f.obj.etag && opt.stand !== f.obj.etag) throw new KalenderKonflikt('Der Termin wurde inzwischen woanders geändert — deine Fassung ist unten noch da.', aktuellerTermin(s, uid));
  // K3: Post an Gäste nur nach Bestätigung — betroffen sind die bisherigen UND die neuen Gäste (Ausgeladene bekommen eine Absage).
  const o = await ortVon(f.kal, s);
  const ich = o.ich;
  const lage = einladungsLage(f.obj.ics, ich);
  if (lage.serie) throw new KalenderFehler('Serientermin — bitte in Apple Kalender ändern.', 400);
  if (lage.gast) throw new KalenderFehler('Du bist hier Gast — nur zusagen oder absagen; ändern kann nur, wer eingeladen hat.', 400);
  const betroffen = Array.from(new Set([...lage.gaeste, ...(a.gaeste ?? []).map(g => g.email).filter(m => !ich.includes(m))]));
  if (betroffen.length && !opt.einladungBestaetigt) throw new EinladungNoetig(lage.gaeste.length ? 'aenderung' : 'einladung', betroffen);
  const neu = aendereTermin(f.obj.ics, a, new Date(), { ich, einladungBestaetigt: opt.einladungBestaetigt });
  if ('fehler' in neu) throw new KalenderFehler(neu.fehler, 400);
  const etag = await standZumSchreiben(f, s, uid, o);
  const r = await dav(f.obj.href, 'PUT', { body: neu.ics, typ: 'text/calendar; charset=utf-8', kopf: { 'If-Match': etag } }, o.mit);
  if (r.status === 412) { await o.nachziehen(f.kal.id); throw new KalenderKonflikt('Der Termin wurde gerade woanders geändert — deine Fassung ist unten noch da.', aktuellerTermin(await ladeStand(), uid)); }
  if (![200, 201, 204].includes(r.status)) throw new KalenderFehler(`iCloud hat die Änderung nicht angenommen (${r.status}).`);
  await o.nachziehen(f.kal.id);
  return { gaeste: betroffen.length, schluessel: f.schluessel, uid: f.uid, eindeutig: f.eindeutig };
}

/**
 * Termin löschen — Einzeltermine, mit ETag (und `stand` wie beim Ändern). Mit Gästen (K3): nur, wenn wir eingeladen haben,
 * und nur nach Bestätigung (iCloud schickt die Absage). Liefert die Zahl der Gäste (für das Protokoll).
 */
export async function loeschen(uid: string, opt: { stand?: string; einladungBestaetigt?: boolean } = {}): Promise<{ gaeste: number; schluessel?: string; uid?: string; eindeutig?: boolean }> {
  const s = await frischerStand();
  const f = findeObjekt(s, uid, true);
  if (!f) return { gaeste: 0 }; // schon weg
  if (!f.kal.schreibbar) throw new KalenderFehler(`„${f.kal.name}“ ist nur lesbar.`, 403);
  if (f.kal.quelle === 'google') return (await import('./google/schreiben')).googleLoeschen(f, opt);
  if (opt.stand && f.obj.etag && opt.stand !== f.obj.etag) throw new KalenderKonflikt('Der Termin wurde inzwischen woanders geändert — bitte erst ansehen.', aktuellerTermin(s, uid));
  const o = await ortVon(f.kal, s);
  const ich = o.ich;
  const grund = nichtBearbeitbar(f.obj.ics, ich);
  if (grund) throw new KalenderFehler(grund.replace('ändern', 'löschen'), 400);
  const lage = einladungsLage(f.obj.ics, ich);
  if (lage.gaeste.length && !opt.einladungBestaetigt) throw new EinladungNoetig('absage', lage.gaeste);
  let etag: string;
  try { etag = await standZumSchreiben(f, s, uid, o); }
  catch (e) { if (e instanceof KalenderFehler && e.status === 404) return { gaeste: 0, schluessel: f.schluessel, uid: f.uid, eindeutig: f.eindeutig }; throw e; }
  const r = await dav(f.obj.href, 'DELETE', { kopf: { 'If-Match': etag } }, o.mit);
  if (r.status === 412) { await o.nachziehen(f.kal.id); throw new KalenderKonflikt('Der Termin wurde gerade woanders geändert — bitte erst ansehen.', aktuellerTermin(await ladeStand(), uid)); }
  if (![200, 204, 404].includes(r.status)) throw new KalenderFehler(`iCloud hat das Löschen nicht angenommen (${r.status}).`);
  await o.nachziehen(f.kal.id);
  return { gaeste: lage.gaeste.length, schluessel: f.schluessel, uid: f.uid, eindeutig: f.eindeutig };
}

/**
 * Als Gast zusagen/absagen (K3) — auch an Serien (die Antwort gilt dem ganzen Termin). Nur nach Bestätigung: iCloud
 * schickt die Antwort an den Organisator. Mit ETag wie beim Ändern.
 */
export async function antwortSenden(uid: string, status: Exclude<Teilnahme, 'offen'>, opt: { stand?: string; einladungBestaetigt?: boolean } = {}): Promise<void> {
  const s = await frischerStand();
  const f = findeObjekt(s, uid, true);
  if (!f) throw new KalenderFehler('Termin nicht gefunden — vielleicht gerade in Apple gelöscht.', 404);
  if (f.kal.quelle === 'google') return (await import('./google/schreiben')).googleAntwort(f, status, opt);
  if (opt.stand && f.obj.etag && opt.stand !== f.obj.etag) throw new KalenderKonflikt('Der Termin wurde inzwischen woanders geändert — bitte erst ansehen.', aktuellerTermin(s, uid));
  const o = await ortVon(f.kal, s);
  const ich = o.ich;
  const lage = einladungsLage(f.obj.ics, ich);
  if (!lage.gast) throw new KalenderFehler(lage.ichOrganisator ? 'Du hast eingeladen — zusagen oder absagen können nur die Gäste.' : 'Dieser Termin hat keine Einladung.', 400);
  if (!opt.einladungBestaetigt) throw new EinladungNoetig('antwort', lage.empfaenger);
  const neu = antwortSetzen(f.obj.ics, ich, status);
  if ('fehler' in neu) throw new KalenderFehler(neu.fehler, 400);
  const etag = await standZumSchreiben(f, s, uid, o);
  const r = await dav(f.obj.href, 'PUT', { body: neu.ics, typ: 'text/calendar; charset=utf-8', kopf: { 'If-Match': etag } }, o.mit);
  if (r.status === 412) { await o.nachziehen(f.kal.id); throw new KalenderKonflikt('Der Termin wurde gerade woanders geändert — bitte erst ansehen.', aktuellerTermin(await ladeStand(), uid)); }
  if (![200, 201, 204].includes(r.status)) throw new KalenderFehler(`iCloud hat die Antwort nicht angenommen (${r.status}).`);
  await o.nachziehen(f.kal.id);
}
