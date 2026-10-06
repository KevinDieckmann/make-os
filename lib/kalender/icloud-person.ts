// ─── Kalender — iCloud je Person (Server, 06.10.2026) ────────────────────────
// Kevin 06.10.: „Malins iCloud-Kalender soll in MAKE OS erscheinen.“ Bis heute war iCloud nur über EINE Apple-ID in der
// Server-Umgebung verbunden (deploy/icloud-verbinden.sh). Jetzt hinterlegt jede Person ihre Apple-ID + ein
// app-spezifisches Passwort selbst (Kalender › Einstellungen › iCloud) — nur für sich, nie für andere.
//
// Zwei Rollen, eine Oberfläche:
//   Haushalts-Kalender  Die Verbindung der HAUPT-Person (`ICLOUD_PERSON`, sonst der Inhaber) speist `kalender-icloud` —
//                       den gemeinsamen Kalender des Haushalts (Gemeinsam, Familie, der Plan …) mit den Sichtregeln wie
//                       bisher. Übergang: ohne Eintrag in der Oberfläche gilt die Server-Umgebung als ihre Verbindung
//                       (lib/kalender/icloud-haupt.ts). Ein Eintrag in der Oberfläche ersetzt sie; „Trennen“ schaltet
//                       auch die Umgebung ab, bis sie neu eingerichtet wird.
//   Je Person           Jede andere Person verbindet ihr EIGENES Konto. Spiegel `kalender-icloud--<person>` (nur die
//                       gezeigten Kalender), über den Stand gelegt wie Google (`ladeStand` → `persoenlicheUeberlagerung`).
//                       Termine daraus tragen `persoenlich` — für alle anderen nur „Belegt“ (Zeit ja, kein Titel, Ort,
//                       Kalendername), überall dort, wo heute schon maskiert wird (Kalender, Jahr, Heute, ZOE, Zwischen-
//                       speicher, Auswertung, Blöcke). Schreiben in diese Kalender darf nur die Person selbst.
//
// Zugangsdaten: Bestand `icloud-verbindung--<person>` (verschlüsselt wie jeder Bestand — mit Datenschlüssel nur als Hülle auf
// der Platte), nie an den Browser (Status liefert nur die maskierte Apple-ID), nie ins Log oder Protokoll, nur an
// *.icloud.com (lib/kalender/icloud.ts `dav`). Vor dem Speichern prüft MAKE OS die Anmeldung bei Apple (ein PROPFIND) —
// ein abgelehntes Passwort wird nie gespeichert.
//
// Fehlerfall „App-Passwort ungültig“ (Apple macht App-Passwörter ungültig, sobald das Apple-Passwort geändert wird):
// iCloud antwortet 401 → der Stand merkt `fehlerAnmeldung` (30 Min. Pause, Apple sperrt sonst), EINE Glocke an die Person,
// die Einstellungen zeigen „Verbindung erneuern“.
//
// Trennen: Zugang und Spiegel dieser Person sind weg (`bestandEntfernen` samt Tageskopien), der Zwischenspeicher wird neu
// geschrieben. Für die Haupt-Person heißt das: der Haushalts-Kalender ist getrennt (mit Rückfrage in der Oberfläche).
//
// Server-Adresse: caldav.icloud.com ist von Apple nicht offiziell dokumentiert — dieselbe, bewährte Adresse wie
// lib/kalender/icloud.ts (seit 25.09.).

import { loadJson, saveJson, updateJson, bestandEntfernen } from '@/lib/store/local-db';
import { entdecke, standHolen, fehlerStand, naechsterVersuchFaellig, abgleichen, abgleichAlter, cacheNeuSchreiben, ladeStandIcloud, SPEICHER, type IcloudStand, type KalenderEintrag } from './icloud';
import { uidVon, adresseAus, type KalenderObjekt } from './ics';
import { kalenderKennung } from './bezug';
import { hauptAblegen, umgebungsZugang, umgebungsFingerabdruck, hauptQuelleSync, type IcloudZugang, type HauptQuelle } from './icloud-haupt';
import { inhaberSpeicher } from '@/lib/zugang/haushalt-inhaber';
import { NEUTRAL_VORSATZ } from './einstellungen';
import { alleSpeicher, namenVon, adresseMaskiert } from '@/lib/zugang/konten';

const PERSON = /^[a-z0-9-]{1,40}$/;
const istPerson = (p: unknown): p is string => typeof p === 'string' && PERSON.test(p);

/** Bestandsnamen je Person (kein Sonderfall für eine feste Person). */
export const verbindungName = (person: string) => `icloud-verbindung--${person}`;
export const standName = (person: string) => `kalender-icloud--${person}`;

/** Die Verbindung einer Person — NUR auf dem Server, nie ausliefern. */
export interface IcloudVerbindung {
  v: 1;
  /** Apple-ID (klein geschrieben). */
  appleId: string;
  /** App-spezifisches Passwort `xxxx-xxxx-xxxx-xxxx` — verschlüsselter Bestand, nie an den Browser, nie ins Log. */
  passwort: string;
  verbundenAm: string;
  erneuertAm?: string;
  /** Kalender (Kennung wie `kalenderKennung`), die NICHT gezeigt werden — Standard: alle zeigen. Nur Verbindungen je Person. */
  ausgeblendet?: string[];
}
/** Nach „Trennen“: kein Zugang mehr. Bei der Haupt-Person zusätzlich der Fingerabdruck der Umgebung, die damit aus ist. */
interface VerbindungGrabstein { v: 0; getrenntAm: string; umgebungAus?: string }

/** Spiegel einer Person: derselbe Aufbau wie der Haushalts-Stand + Person + ob die Glocke „Passwort ungültig“ schon ging. */
export interface PersonStand extends IcloudStand { v: 1; person: string; anmeldungGemeldet?: true }

// ── Eingaben (rein) ─────────────────────────────────────────────────────────

/** Apple-ID säubern: eine E-Mail-Adresse (klein), sonst null. */
export function appleIdSauber(roh: unknown): string | null {
  const t = typeof roh === 'string' ? roh.replace(/\s+/g, '').toLowerCase() : '';
  return t.length <= 254 && /^[^@\s"\\<>]+@[^@\s"\\<>]+\.[a-z]{2,}$/.test(t) ? t : null;
}

/**
 * App-spezifisches Passwort säubern: Apple vergibt 16 Kleinbuchstaben (angezeigt als xxxx-xxxx-xxxx-xxxx). Einfügen mit
 * Leerzeichen, Großbuchstaben oder ohne Bindestriche geht; alles andere (z. B. das normale Apple-Passwort) → null.
 */
export function passwortSauber(roh: unknown): string | null {
  const t = typeof roh === 'string' ? roh.replace(/[\s-]+/g, '').toLowerCase() : '';
  return /^[a-z]{16}$/.test(t) ? `${t.slice(0, 4)}-${t.slice(4, 8)}-${t.slice(8, 12)}-${t.slice(12, 16)}` : null;
}

export const APPLE_ID_UNGUELTIG = 'Das sieht nicht wie eine Apple-ID aus — bitte die E-Mail-Adresse deines Apple-Kontos eintragen.';
export const PASSWORT_UNGUELTIG = 'Das sieht nicht wie ein app-spezifisches Passwort aus (16 Buchstaben, xxxx-xxxx-xxxx-xxxx). Bitte NICHT das normale Apple-Passwort — ein App-Passwort legst du unter appleid.apple.com › Anmelden und Sicherheit › App-spezifische Passwörter an.';

export class IcloudEingabeFehler extends Error { readonly status = 400; }

// ── Bestände ────────────────────────────────────────────────────────────────

export async function ladeVerbindung(person: string): Promise<IcloudVerbindung | null> {
  if (!istPerson(person)) return null;
  const v = await loadJson<IcloudVerbindung | VerbindungGrabstein>(verbindungName(person));
  return v && v.v === 1 && typeof (v as IcloudVerbindung).appleId === 'string' && typeof (v as IcloudVerbindung).passwort === 'string' ? v as IcloudVerbindung : null;
}

async function ladeGrabstein(person: string): Promise<VerbindungGrabstein | null> {
  const v = await loadJson<IcloudVerbindung | VerbindungGrabstein>(verbindungName(person));
  return v && v.v === 0 ? v as VerbindungGrabstein : null;
}

export async function ladePersonStand(person: string): Promise<PersonStand | null> {
  if (!istPerson(person)) return null;
  const s = await loadJson<PersonStand>(standName(person));
  return s && s.v === 1 && Array.isArray(s.kalender) && s.objekte && typeof s.objekte === 'object' ? s : null;
}

/** Der Zugang einer Person (nur ihre eigene Verbindung) — für Abgleich und Schreiben. */
export async function personZugang(person: string): Promise<IcloudZugang | null> {
  const v = await ladeVerbindung(person);
  return v ? { id: v.appleId, passwort: v.passwort } : null;
}

// ── Haupt-Person (Haushalts-Kalender) ───────────────────────────────────────

/** Wem gehört der Haushalts-Kalender? `ICLOUD_PERSON` (Instanz-Einstellung), sonst der Inhaber — nie eine feste Person. */
export async function hauptPerson(): Promise<string | null> {
  const env = process.env.ICLOUD_PERSON?.trim().toLowerCase();
  if (env && PERSON.test(env)) return env;
  return inhaberSpeicher().catch(() => null);
}

/**
 * Den Zugang des Haushalts-Kalenders aus dem Bestand der Haupt-Person laden und ablegen (synchron lesbar für `verbunden()`).
 * Reihenfolge: Eintrag aus der Oberfläche → „getrennt“ (die Umgebung ist für DIESE Werte ausgeschaltet) → Umgebung → keiner.
 * Fehler beim Lesen lassen die bisherige Ablage stehen (sonst gälte still die Umgebung).
 */
export async function hauptZugangLaden(): Promise<{ quelle: HauptQuelle; person: string | null }> {
  const person = await hauptPerson();
  const v = person ? await ladeVerbindung(person) : null;
  let quelle: HauptQuelle;
  let zugang: IcloudZugang | null;
  if (v) { quelle = 'oberflaeche'; zugang = { id: v.appleId, passwort: v.passwort }; }
  else {
    const g = person ? await ladeGrabstein(person) : null;
    const env = umgebungsZugang();
    if (g?.umgebungAus && env && g.umgebungAus === umgebungsFingerabdruck()) { quelle = 'getrennt'; zugang = null; }
    else if (env) { quelle = 'umgebung'; zugang = env; }
    else { quelle = g ? 'getrennt' : 'keine'; zugang = null; }
  }
  hauptAblegen({ zugang, quelle, person });
  return { quelle, person };
}

/** Wie `hauptZugangLaden`, aber Fehler (Bestand nicht lesbar) schlucken — für Start, Takt und Lese-Routen. */
export async function hauptZugangAuffrischen(): Promise<void> {
  try { await hauptZugangLaden(); } catch (e) { console.warn(`[kalender-icloud] Haupt-Zugang nicht lesbar: ${e instanceof Error ? e.name : 'Fehler'}`); }
}

// ── Verbinden, Trennen ──────────────────────────────────────────────────────

/**
 * Verbinden bzw. erneuern (nur für die eigene Person — die Route prüft die Sitzung): Eingaben säubern, die Anmeldung bei
 * iCloud prüfen (abgelehnt → nichts gespeichert, KalenderFehler 401), Zugang speichern, ersten Abgleich anstoßen.
 * Liefert, ob die Verbindung den Haushalts-Kalender speist.
 */
export async function icloudVerbinden(person: string, appleIdRoh: unknown, passwortRoh: unknown): Promise<{ haupt: boolean; kalender: number; fehler?: string }> {
  if (!istPerson(person)) throw new IcloudEingabeFehler('Unbekannte Person.');
  const appleId = appleIdSauber(appleIdRoh);
  if (!appleId) throw new IcloudEingabeFehler(APPLE_ID_UNGUELTIG);
  const passwort = passwortSauber(passwortRoh);
  if (!passwort) throw new IcloudEingabeFehler(PASSWORT_UNGUELTIG);
  const zugang: IcloudZugang = { id: appleId, passwort };
  // Anmeldung prüfen, BEVOR etwas gespeichert wird (401 → KalenderFehler mit klarer Meldung).
  const ort = await entdecke(zugang);
  const jetzt = new Date().toISOString();
  const alt = await ladeVerbindung(person);
  const gleichesKonto = alt?.appleId === appleId;
  const neu: IcloudVerbindung = {
    v: 1, appleId, passwort, verbundenAm: gleichesKonto && alt ? alt.verbundenAm : jetzt,
    ...(gleichesKonto ? { erneuertAm: jetzt } : {}),
    ...(gleichesKonto && alt?.ausgeblendet?.length ? { ausgeblendet: alt.ausgeblendet } : {}),
  };
  await saveJson(verbindungName(person), neu);
  const haupt = (await hauptPerson()) === person;
  if (haupt) {
    await hauptZugangLaden();
    // Haushalts-Kalender: das (womöglich andere) Konto neu verorten, Fehler und Pause vergessen — dann sofort abgleichen.
    const s = await ladeStandIcloud();
    const { fehler: _f, fehlerAt: _fa, fehlerAnmeldung: _fn, fehlerFolge: _ff, pauseBis: _p, ...rest } = s;
    await saveJson(SPEICHER, { ...rest, home: ort.home, adressen: ort.adressen });
    try { const st = await abgleichen({ erzwingen: true }); return { haupt, kalender: st.kalender.filter(k => !k.quelle).length }; }
    catch (e) { return { haupt, kalender: 0, fehler: e instanceof Error ? e.message.slice(0, 200) : 'Abgleich gescheitert.' }; }
  }
  // Je Person: frischer Spiegel (anderes Konto) bzw. derselbe ohne Fehlerstand (gleiches Konto, z. B. neues App-Passwort).
  const vorher = gleichesKonto ? await ladePersonStand(person) : null;
  const basis: PersonStand = vorher
    ? (({ fehler: _f, fehlerAt: _fa, fehlerAnmeldung: _fn, fehlerFolge: _ff, pauseBis: _p, anmeldungGemeldet: _g, ...r }) => ({ ...r, home: ort.home, adressen: ort.adressen }))(vorher)
    : { v: 1, person, kalender: [], objekte: {}, home: ort.home, adressen: ort.adressen };
  await saveJson(standName(person), basis);
  try { const st = await personAbgleichen(person, { erzwingen: true }); return { haupt, kalender: st?.kalender.length ?? 0 }; }
  catch (e) { return { haupt, kalender: 0, fehler: e instanceof Error ? e.message.slice(0, 200) : 'Abgleich gescheitert.' }; }
}

/**
 * Trennen (nur die eigene Person): Zugang und Spiegel weg — samt Tageskopien (`bestandEntfernen`). Die Haupt-Person trennt
 * damit den Haushalts-Kalender: ihr Bestand wird ein Grabstein (mit Fingerabdruck der Umgebung, die damit aus ist), der
 * Haushalts-Spiegel wird geleert. Danach den Zwischenspeicher neu schreiben. Liefert, ob es etwas zu trennen gab.
 */
export async function icloudTrennen(person: string): Promise<{ war: boolean; haupt: boolean }> {
  if (!istPerson(person)) return { war: false, haupt: false };
  const haupt = (await hauptPerson()) === person;
  if (haupt) {
    const quelle = hauptQuelleSync().geladen ? hauptQuelleSync().quelle : (await hauptZugangLaden()).quelle;
    const war = quelle === 'oberflaeche' || quelle === 'umgebung' || !!(await ladeVerbindung(person));
    await bestandEntfernen(verbindungName(person), { tageskopien: true });
    const fp = umgebungsFingerabdruck();
    const grab: VerbindungGrabstein = { v: 0, getrenntAm: new Date().toISOString(), ...(fp ? { umgebungAus: fp } : {}) };
    await saveJson(verbindungName(person), grab);
    await hauptZugangLaden();
    await bestandEntfernen(SPEICHER, { tageskopien: true });
    await saveJson(SPEICHER, { kalender: [], objekte: {} } satisfies IcloudStand);
    await cacheNeuSchreiben();
    return { war, haupt };
  }
  const a = await bestandEntfernen(verbindungName(person), { tageskopien: true });
  const b = await bestandEntfernen(standName(person), { tageskopien: true });
  laeuft.delete(person);
  await cacheNeuSchreiben();
  return { war: a || b, haupt };
}

/** Kalender zeigen/ausblenden (nur Verbindungen je Person) — danach einmal abgleichen, damit ein eingeschalteter sofort kommt. */
export async function kalenderZeigen(person: string, kennung: string, zeigen: boolean): Promise<boolean> {
  if (!(await ladeVerbindung(person)) || !/^[\w.@%+-]{1,200}$/.test(kennung)) return false;
  const s = await ladePersonStand(person);
  if (!s?.kalender.some(k => kalenderKennung(k.id) === kennung)) return false;
  await updateJson<IcloudVerbindung | VerbindungGrabstein | null>(verbindungName(person), cur => {
    if (!cur || cur.v !== 1) return cur;
    const aus = new Set(cur.ausgeblendet ?? []);
    if (zeigen) aus.delete(kennung); else aus.add(kennung);
    const { ausgeblendet: _a, ...rest } = cur;
    return aus.size ? { ...rest, ausgeblendet: Array.from(aus).slice(0, 100) } : rest;
  });
  await personAbgleichen(person, zeigen ? { erzwingen: true } : {}).catch(() => { /* Fehler steht im Stand */ });
  return true;
}

// ── Abgleich je Person ──────────────────────────────────────────────────────

const laeuft = new Map<string, Promise<PersonStand | null>>();
export const personAbgleichLaeuft = (person: string): boolean => laeuft.has(person);

/** Glocke, wenn Apple das App-Passwort nicht (mehr) annimmt — neutral, ohne Werte (Telegram-Regel). */
export const MELDUNG_ANMELDUNG = 'Apple hat das App-Passwort für deinen Kalender nicht angenommen — bitte unter Kalender › Einstellungen › iCloud „Verbindung erneuern“.';

/**
 * Den Spiegel einer Person abgleichen (nur ihre gezeigten Kalender). Läuft je Person nie doppelt; ein laufender wird geteilt,
 * außer nach eigenem Schreiben (`nur`/`erzwingen` → ein neuer). Fehler werfen weiter UND stehen im Stand (Pause, 401).
 * Ohne Verbindung → null. Nicht für die Haupt-Person (ihr Kalender ist der Haushalts-Kalender, `abgleichen`).
 */
export async function personAbgleichen(person: string, opt: { erzwingen?: boolean; nur?: string } = {}): Promise<PersonStand | null> {
  if (!istPerson(person)) return null;
  const l = laeuft.get(person);
  if (l && !opt.nur && !opt.erzwingen) return l;
  while (laeuft.has(person)) await laeuft.get(person)!.catch(() => { /* der Fehler steht im Stand */ });
  const p = (async (): Promise<PersonStand | null> => {
    const v = await ladeVerbindung(person);
    if (!v) return null;
    const alt: PersonStand = (await ladePersonStand(person)) ?? { v: 1, person, kalender: [], objekte: {} };
    const aus = new Set(v.ausgeblendet ?? []);
    try {
      const neu = await standHolen(alt, { ...opt, holen: k => !aus.has(kalenderKennung(k.id)) }, { id: v.appleId, passwort: v.passwort });
      // Während des Laufs getrennt? Dann nichts zurückschreiben.
      if (!(await ladeVerbindung(person))) return null;
      const stand: PersonStand = { ...neu, v: 1, person };
      await saveJson(standName(person), stand);
      await cacheNeuSchreiben();
      return stand;
    } catch (e) {
      if (!(await ladeVerbindung(person))) throw e;
      const f = fehlerStand(alt, e);
      const melden = !!f.fehlerAnmeldung && !alt.anmeldungGemeldet;
      const stand: PersonStand = { ...f, v: 1, person, ...(f.fehlerAnmeldung && (melden || alt.anmeldungGemeldet) ? { anmeldungGemeldet: true as const } : {}) };
      if (!stand.fehlerAnmeldung) delete stand.anmeldungGemeldet;
      await saveJson(standName(person), stand).catch(() => {});
      if (melden) {
        const { melde } = await import('@/lib/meldungen/melden');
        await melde({ an: person, art: 'kalender', titel: MELDUNG_ANMELDUNG, link: '/os/kalender' });
      }
      throw e;
    }
  })().finally(() => { if (laeuft.get(person) === p) laeuft.delete(person); });
  laeuft.set(person, p);
  return p;
}

/** Alle Personen mit eigener Verbindung (ohne die Haupt-Person) — für Takt und Überlagerung. */
export async function personenMitIcloud(kandidaten?: readonly string[]): Promise<string[]> {
  const alle = kandidaten ?? await alleSpeicher().catch(() => [] as string[]);
  const haupt = await hauptPerson().catch(() => null);
  const raus: string[] = [];
  for (const p of alle) if (istPerson(p) && p !== haupt && await ladeVerbindung(p).catch(() => null)) raus.push(p);
  return raus;
}

/** Wird iCloud genutzt (Haushalts-Kalender oder mindestens eine Verbindung je Person)? — für das Verzeichnis (Art. 30). */
export async function icloudInGebrauch(): Promise<boolean> {
  await hauptZugangAuffrischen();
  if (hauptQuelleSync().quelle === 'oberflaeche' || hauptQuelleSync().quelle === 'umgebung') return true;
  return (await personenMitIcloud().catch(() => [] as string[])).length > 0;
}

/** Takt (lib/kalender/takt-jobs.ts): je Person höchstens alle 5 Min., nie in der Pause nach Fehlern, nie doppelt. Nie blockierend. */
export async function icloudPersonenImTakt(jetzt = Date.now()): Promise<{ gestartet: string[] }> {
  const gestartet: string[] = [];
  for (const p of await personenMitIcloud()) {
    if (laeuft.has(p)) continue;
    const s = await ladePersonStand(p).catch(() => null);
    const zuletzt = Date.parse(s?.at ?? '') || 0;
    if (s && (jetzt - zuletzt <= 5 * 60_000 || !naechsterVersuchFaellig(s, jetzt))) continue;
    gestartet.push(p);
    void personAbgleichen(p).catch(e => console.warn(`[kalender-icloud] Abgleich ${p}: ${e instanceof Error ? e.name : 'Fehler'}`));
  }
  return { gestartet };
}

// ── Überlagerung (für `ladeStand`) ──────────────────────────────────────────

let uidMerk: { schluessel: string; uids: Set<string> } | null = null;
/** UIDs des Haushalts-Stands (gemerkt je Stand) — geteilte Kalender tauchen in beiden Konten auf und zählen nur dort. */
function hauptUids(s: IcloudStand): Set<string> {
  const objekte = s.kalender.filter(k => !k.quelle).flatMap(k => s.objekte[k.id] ?? []);
  const schluessel = `${s.at ?? ''}|${objekte.length}`;
  if (uidMerk?.schluessel === schluessel) return uidMerk.uids;
  const uids = new Set(objekte.map(o => uidVon(o.ics)).filter((u): u is string => !!u));
  uidMerk = { schluessel, uids };
  return uids;
}

/**
 * Die gezeigten Kalender aller Personen mit eigener Verbindung als `KalenderEintrag` (`quelle: 'icloud'`, `person`, `ich`,
 * `neutral`) mit ihren Objekten — ohne Objekte, deren UID schon im Haushalts-Stand steht. Name in MAKE OS:
 * „<Kalender> · <Vorname>“ (eindeutig gemacht); für andere Personen nur „iCloud · <Vorname>“ (Maskierung).
 */
export async function persoenlicheUeberlagerung(haupt: IcloudStand): Promise<{ kalender: KalenderEintrag[]; objekte: Record<string, KalenderObjekt[]> }> {
  const personen = await personenMitIcloud();
  if (!personen.length) return { kalender: [], objekte: {} };
  const namen = await namenVon().catch(() => ({} as Record<string, string>));
  const vergeben = new Set(haupt.kalender.filter(k => !k.quelle).map(k => k.name.trim().toLowerCase()));
  const doppelt = hauptUids(haupt);
  const kalender: KalenderEintrag[] = [];
  const objekte: Record<string, KalenderObjekt[]> = {};
  for (const p of personen) {
    const [v, s] = await Promise.all([ladeVerbindung(p), ladePersonStand(p)]);
    if (!v || !s) continue;
    const aus = new Set(v.ausgeblendet ?? []);
    const vorname = (namen[p] ?? p).trim() || p;
    const ich = s.adressen?.length ? s.adressen : [adresseAus(v.appleId)].filter((x): x is string => !!x);
    for (const k of s.kalender) {
      if (aus.has(kalenderKennung(k.id))) continue;
      let name = `${k.name} · ${vorname}`;
      for (let n = 2; vergeben.has(name.toLowerCase()); n++) name = `${k.name} · ${vorname} (${n})`;
      vergeben.add(name.toLowerCase());
      kalender.push({ id: k.id, name, ...(k.farbe ? { farbe: k.farbe } : {}), ...(k.ctag ? { ctag: k.ctag } : {}), schreibbar: k.schreibbar, quelle: 'icloud', person: p, ich, neutral: `${NEUTRAL_VORSATZ}${vorname}` });
      objekte[k.id] = (s.objekte[k.id] ?? []).filter(o => { const u = uidVon(o.ics); return !u || !doppelt.has(u); });
    }
  }
  return { kalender, objekte };
}

/** Kalendername → Person für die gezeigten Kalender je Person (Zuordnung „wem gehört“, wie Google; nie gespeichert). */
export async function persoenlicheNamen(): Promise<Record<string, string>> {
  try {
    const p = await persoenlicheUeberlagerung(await ladeStandIcloud());
    return Object.fromEntries(p.kalender.flatMap(k => [[k.name, k.person!], [k.neutral ?? k.name, k.person!]]));
  } catch { return {}; }
}

// ── Status für die Oberfläche (nie Zugangsdaten) ────────────────────────────

export interface IcloudStatus {
  /** Diese Verbindung speist den Haushalts-Kalender (Haupt-Person). */
  haupt: boolean;
  /** Woher der Zugang kommt: Oberfläche · Server-Einrichtung (Umgebung) · getrennt · keine. */
  quelle: HauptQuelle;
  verbunden: boolean;
  /** Apple-ID maskiert (k•••@icloud.com) — nie im Klartext. */
  konto?: string;
  seit?: string;
  erneuert?: string;
  abgleich?: ReturnType<typeof abgleichAlter>;
  /** Apple nimmt das App-Passwort nicht an → „Verbindung erneuern“. */
  anmeldung?: true;
  /** Nur je Person: die Kalender des Kontos zum Zeigen/Ausblenden (Kennung, Name, gezeigt, schreibbar, Termine im Spiegel). */
  kalender?: { kennung: string; name: string; gezeigt: boolean; schreibbar: boolean; termine: number }[];
}

const maskiert = (id: string | undefined): string | undefined => (id ? adresseMaskiert(id) : undefined);

/** Status der EIGENEN Verbindung — nie Passwort, nie die volle Apple-ID. */
export async function icloudStatus(person: string): Promise<IcloudStatus> {
  const haupt = (await hauptPerson()) === person;
  if (haupt) {
    const { quelle } = await hauptZugangLaden();
    const v = await ladeVerbindung(person);
    const s = await ladeStandIcloud();
    const verbunden = quelle === 'oberflaeche' || quelle === 'umgebung';
    const a = verbunden ? abgleichAlter(s) : undefined;
    return {
      haupt, quelle, verbunden,
      ...(verbunden ? { konto: maskiert(v?.appleId ?? umgebungsZugang()?.id) } : {}),
      ...(v ? { seit: v.verbundenAm, ...(v.erneuertAm ? { erneuert: v.erneuertAm } : {}) } : {}),
      ...(a ? { abgleich: a } : {}), ...(a?.anmeldung ? { anmeldung: true as const } : {}),
    };
  }
  const v = await ladeVerbindung(person);
  if (!v) return { haupt, quelle: (await ladeGrabstein(person)) ? 'getrennt' : 'keine', verbunden: false };
  const s = await ladePersonStand(person);
  const aus = new Set(v.ausgeblendet ?? []);
  const a = s ? abgleichAlter(s) : undefined;
  return {
    haupt, quelle: 'oberflaeche', verbunden: true, konto: maskiert(v.appleId), seit: v.verbundenAm, ...(v.erneuertAm ? { erneuert: v.erneuertAm } : {}),
    ...(a ? { abgleich: a } : {}), ...(a?.anmeldung ? { anmeldung: true as const } : {}),
    kalender: (s?.kalender ?? []).map(k => ({ kennung: kalenderKennung(k.id), name: k.name, gezeigt: !aus.has(kalenderKennung(k.id)), schreibbar: k.schreibbar, termine: (s?.objekte[k.id] ?? []).length })),
  };
}

/** Darf `person` in diesen Kalender (Name) schreiben? Kalender je Person nur ihre Besitzerin — alle anderen nie. */
export function persoenlichFremd(kal: Pick<KalenderEintrag, 'quelle' | 'person'> | undefined, person: string | null | undefined): boolean {
  return !!kal && kal.quelle === 'icloud' && !!kal.person && kal.person !== person;
}
