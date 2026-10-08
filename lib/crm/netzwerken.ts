// ─── Netzwerken — Erfassen (rein, client-sicher, getestet; 02.10.) ───────────
// Malin und Kevin lernen auf Veranstaltungen Menschen kennen. Festhalten muss schneller sein als Vergessen: Karte
// fotografieren, Felder prüfen, „Kennen wir schon?“, ein nächster Schritt — fertig, noch vor dem Rückweg. Hier steht
// alles, was ohne Platte und ohne Netz geht (Server: lib/crm/netzwerken-server.ts, Oberfläche: components/os/netzwerken):
//   · die Schritte nach dem Kennenlernen und ihre Beschriftung
//   · `erfassungPruefen` — der Körper einer Erfassung, geprüft und gesäubert (nie still gekürzt: zu lang → Fehler)
//   · `kenntWirSchon` — tolerante Dublettenprüfung WÄHREND der Eingabe (Mail, Telefon, Name, Firma; dieselben
//     Normalisierungen wie Import und Kartei: `normName`, `normFirma`, `normTelefon`, `alleAdressen`)
//   · `firmaVorschlaege` — bestehende Firma vorschlagen, sonst neu
//   · `danke…` — Danke-Mail-Entwurf (Du/Sie) ab dem Folgetag; Versand NUR per Einzelklick über das Mail-Programm
//   · `berichtAus` — Abendbericht eines Events
// Rechtlich (Kevin, § 7 UWG): eine Visitenkarte ist KEINE Einwilligung. Die neue Person bekommt deshalb nie einen
// Eintrag in `einwilligungen` — „keine“ heißt: es gibt keinen (ein Eintrag mit anderem Sinn würde die Kanal-Ampel grün
// schalten). Der Vermerk `KEINE_EINWILLIGUNG` steht im Verlauf; Herkunft „Veranstaltung“, Quelle „Netzwerken“.

import { anzeigename, normName, normFirma, normTelefon, istSammelAdresse, type Kontakt } from '@/lib/make-one/crm';
import type { Event, EventAnmeldung, EventFuer, Firma, FollowUp, NetzwerkenAngabe, NetzwerkSchritt, Teilnahme, TeilnahmeHerkunft } from './typen';
import { fuerSaeubern, werSaeubern, linkSaeubern } from './besuche-form';
import { alleAdressen } from './emails';
import { firmenSchluessel, bestehendeFirma } from './firmen';
import { haeltBeziehung } from './team';
import { MARKE_EVENTS, NETZWERKEN_MARKE, istNetzwerkenEvent } from './marke';
import { emailNormal, telefonNormal, linkedinNormal, webNormal, text } from './visitenkarte';
import { mailLink } from './erfassen';
import { kanalStatus } from './recht';
import { werktagePlus, tagVon, wandzeit, wandAus, minutenVon } from '@/lib/zeit/kalender-kern';
import { WEG, eventLink } from '@/lib/wege';
import { istKalendertag } from '@/lib/zeit';
import { istKontaktKennung } from '@/lib/kennung';
import { sprachnotizTypErkennen } from '@/lib/dateien/regeln';
import { istEingeschraenkt } from './einschraenkung';
import { base64OhneMetadaten } from '@/lib/netzwerken/bild-bereinigen';
import { datenschutzHinweisText, DANKE_FRIST_TAGE, type DatenschutzAngaben } from './netzwerken-recht';

// ── Festwerte ───────────────────────────────────────────────────────────────

/** Quelle am Kontakt — wo er herkommt. */
export const NETZWERKEN_QUELLE = 'Netzwerken';
/** Label an jeder über „Netzwerken“ erfassten Person — der Kartei-Filter „Label: Netzwerken“ zeigt sie (03.10.). */
export const LABEL_NETZWERKEN = 'Netzwerken';
/** Label, wenn eine neue Person vermutlich schon in der Kartei steht (gleicher Name + Firma, ohne Mail/Nummer). */
export const LABEL_DUBLETTE = 'Dublette prüfen';
/** Label, wenn der Lead nicht angefasst wurde (Firma ist Dienstleister/Investor/Wettbewerber, Kein Fit, Ruht, SQL). */
export const LABEL_LEAD_PRUEFEN = 'Lead prüfen';
/** Vermerk im Verlauf: die Karte wurde gegeben, eine Einwilligung gab es nicht. */
export const KEINE_EINWILLIGUNG = 'Visitenkarte, keine Einwilligung (§ 7 UWG)';
export const MAX_BILDER = 6;
/** Je Bild nach dem Verkleinern (Bytes des Inhalts) — der Browser macht ~1600 px JPEG, das sind 200–600 KB. */
export const MAX_BILD_BYTES = 3 * 1024 * 1024;
/** Sprachnotiz (Bytes) — zwei Minuten AAC/Opus sind ~1 MB. */
export const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
export const INFO_MAX = 1000;
/** Ganzer Körper einer Erfassung (Base64 inklusive) — darüber 413. */
export const KOERPER_MAX = 20 * 1024 * 1024;
/** Älter als so viele Tage darf eine Erfassung beim Senden sein (Offline-Warteschlange). */
export const ERFASSUNG_ALTER_TAGE = 14;
/** Die Kennung einer Erfassung — eine UUID, im Browser erzeugt (`zufallsUuid`). */
export const ERFASSUNG_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TAG = { test: (v: unknown): boolean => istKalendertag(v) };
const WAND = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const PERSON = /^[a-z0-9-]{1,40}$/;
const ID = /^[a-z0-9][a-z0-9-]{1,63}$/;
const FIRMA_ID = /^f-[a-z0-9-]{2,63}$/;

export const BILD_TYPEN = ['image/jpeg', 'image/png'] as const;
/** Sprachnotizen: MediaRecorder liefert je Browser webm (Chrome), mp4/m4a (Safari) oder ogg (Firefox). */
export const AUDIO_TYPEN = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg', 'audio/wav', 'audio/x-m4a', 'audio/aac'] as const;

export const SCHRITTE: readonly { id: NetzwerkSchritt; label: string; kurz: string }[] = [
  { id: 'termin', label: 'Termin', kurz: 'Termin im Kalender' },
  { id: 'qualifizieren', label: 'Qualifizieren', kurz: 'Kommt in die Qualifizierung' },
  { id: 'followup', label: 'Follow-up', kurz: 'Nachfassen mit Frist' },
  { id: 'vermitteln', label: 'Vermitteln', kurz: 'Jemandem vorstellen' },
  { id: 'andere', label: 'Andere', kurz: 'Eigene Aufgabe' },
  { id: 'angebot', label: 'Angebot schicken', kurz: 'Entwurf im Angebots-Tool' },
  { id: 'makeone', label: `Zu ${MARKE_EVENTS} einladen`, kurz: 'Vormerkung' },
  { id: 'nur-kontakt', label: 'Nur Kontakt', kurz: 'Nichts weiter' },
];
export const schrittLabel = (id: string | undefined): string => SCHRITTE.find(s => s.id === id)?.label ?? '—';
const SCHRITT_IDS = SCHRITTE.map(s => s.id) as readonly string[];

/** Ziel eines unterwegs angelegten Events (Pflichtfeld des Events — „Netzwerken“ allein wäre keins). */
export const EVENT_ZIEL = 'Neue Kontakte kennenlernen und binnen 48 Stunden nachfassen';
/**
 * Ein Event, das „Heute bei“ oder der Reiter „Events“ anlegt — Browser (Event-Schreibweg) und Server (wenn es ohne Netz entstand)
 * bauen es gleich. Optional (03.10.): `fuer` (MAKE selbst oder Kunde — fehlt = MAKE), `wer` (wer hingeht), `link`, `anmeldung`;
 * ohne Angabe bleibt der Eintrag so schlank wie vorher.
 */
export function neuesEvent(o: { id: string; titel: string; datum: string; ort?: string; person: string; heute: string; jetztIso: string; fuer?: EventFuer; wer?: string[]; link?: string; anmeldung?: EventAnmeldung }): Event {
  const fuer = fuerSaeubern(o.fuer), wer = werSaeubern(o.wer), link = linkSaeubern(o.link);
  return {
    id: o.id, titel: o.titel, format: 'sonstig', ziel: EVENT_ZIEL, datum: o.datum, ...(o.ort ? { ort: o.ort } : {}),
    status: o.datum <= o.heute ? 'durchgefuehrt' : 'geplant', marke: NETZWERKEN_QUELLE, zustaendig: o.person, geaendert: o.jetztIso, geaendertVon: o.person,
    ...(fuer ? { fuer } : {}), ...(wer ? { wer } : {}), ...(link ? { link } : {}), ...(o.anmeldung ? { anmeldung: o.anmeldung } : {}),
  };
}

/** Schlüssel eines Event-Titels: ohne Groß-/Kleinschreibung, Umlaute, Satzzeichen und Leerraum — „Unternehmer-Stammtisch Köln“ = „unternehmer stammtisch koeln“. */
export const eventTitelSchluessel = (t: string): string => String(t ?? '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '');
/**
 * Gibt es dieses besuchte Event schon (gleicher normierter Titel + gleiches Datum, nur Netzwerken-Events, nie ein abgesagtes)? Eine
 * Stelle für Server (Schritt „event“ verwendet es wieder) und Oberfläche („Gibt es schon: …“ beim Anlegen) — so entstehen keine Doppelten (M7).
 */
export function gleichesBesuchEvent(events: readonly Event[], titel: string, datum: string, ausser?: string): Event | undefined {
  const s = eventTitelSchluessel(titel);
  if (s.length < 2) return undefined;
  return events.find(x => x.id !== ausser && istNetzwerkenEvent(x) && x.datum === datum && eventTitelSchluessel(x.titel) === s && x.status !== 'abgesagt' && x.anmeldung !== 'abgesagt');
}

/** Ein Datum, das mehr als ein Jahr von heute entfernt liegt, ist ein Tippfehler (Jahr vertippt) — nie ein Event dort anlegen (N4). */
export const EVENT_DATUM_TAGE = 366;
export const eventDatumPlausibel = (datum: string, heute: string): boolean => {
  const tage = Math.abs(Date.parse(`${datum}T12:00:00Z`) - Date.parse(`${heute}T12:00:00Z`)) / 864e5;
  return Number.isFinite(tage) && tage <= EVENT_DATUM_TAGE;
};

export type TerminArt = 'kennenlernen' | 'telefonat' | 'video';
export const TERMIN_ARTEN: readonly { id: TerminArt; label: string }[] = [
  { id: 'kennenlernen', label: 'Kennenlerngespräch' }, { id: 'telefonat', label: 'Telefonat' }, { id: 'video', label: 'Videocall' },
];
export const terminArtLabel = (id: string | undefined) => TERMIN_ARTEN.find(a => a.id === id)?.label ?? 'Termin';
export const DAUERN = [30, 45, 60] as const;

// ── Die Erfassung ────────────────────────────────────────────────────────────

/** Ohne bestehende Person braucht die Erfassung einen Namen — Vorname ODER Nachname (5.14, Browser und Server). */
export const NAME_FEHLT = 'Vor- oder Nachname fehlt — bitte mindestens einen eintragen.';
export const nameOk = (f: Pick<KontaktFelder, 'vorname' | 'nachname'>): boolean => !!(f.vorname ?? '').trim() || !!(f.nachname ?? '').trim();

export interface KontaktFelder {
  vorname?: string; nachname?: string; firma?: string; position?: string; email?: string; telefon?: string; mobil?: string;
  webseite?: string; anschrift?: string; linkedin?: string; anrede?: 'Du' | 'Sie';
}
export interface BildEingabe { name: string; typ: string; /** Base64 ohne „data:…;base64,“. */ daten: string }
export interface Erfassung {
  erfassungId: string;
  /** ISO — wann die Person kennengelernt wurde (nicht, wann gesendet wird). */
  erfasstAm: string;
  eventId: string;
  /** Nur wenn das Event unterwegs ohne Netz angelegt wurde: der Server legt es an, wenn es fehlt. */
  eventNeu?: { titel: string; datum: string; ort?: string; /** Für wen (03.10.): fehlt = MAKE selbst. */ fuer?: EventFuer };
  kontakt: KontaktFelder;
  /** „Diesen nehmen“: die Erfassung hängt an dieser bestehenden Person (kein neuer Kontakt). */
  vorhandenKontaktId?: string;
  /** „Trotzdem neu“: keine Zusammenführung bei gleicher Mail/Nummer. */
  neuErzwingen?: boolean;
  /**
   * Wer erfasst hat (Kennung der angemeldeten Person im Browser). Eine Erfassung liegt unter Umständen auf einem Gerät, an dem
   * inzwischen jemand anderes angemeldet ist — der Server sendet sie dann NICHT unter fremdem Namen (409, 03.10.). Ohne Angabe: keine Prüfung.
   */
  erfasstVon?: string;
  /** Termin ließ sich nicht anlegen (kein Kalender, iCloud weg): stattdessen mit Follow-up abschließen („Termin vereinbaren“). */
  ohneTermin?: boolean;
  /**
   * „Wir haben persönlich gesprochen“ (Haken beim Erfassen, Standard an; 03.10., § 7 UWG): nur dann gibt es einen Danke-Entwurf.
   * `false` = nur Karte erhalten/mitgenommen, kein Gespräch → kein Entwurf, Datenschutzhinweis beim ersten Kontakt. Fehlt = ja.
   */
  gesprochen?: boolean;
  firmaId?: string;
  bilder: BildEingabe[];
  sprachnotiz?: { typ: string; daten: string; dauerSek?: number };
  schritt: NetzwerkSchritt;
  info?: string;
  zustaendig: string;
  followup?: { faellig: string };
  termin?: { art: TerminArt; dauer: number; start: string };
  vermitteln?: { an: string };
  /** Zu Make.One einladen: das kommende Event, für das die Person als Gast vorgemerkt wird (ohne: Aufgabe + Label). */
  makeone?: { eventId?: string };
  andere?: { text: string; faellig?: string };
}

export type Pruefung<T> = { ok: true; wert: T } | { ok: false; status: number; fehler: string };
const fehler = (fehlertext: string, status = 400): { ok: false; status: number; fehler: string } => ({ ok: false, status, fehler: fehlertext });

/** Base64 → Bytes-Länge, ohne zu dekodieren. */
/** Die ersten `n` Bytes eines Base64-Texts (für die Magic-Bytes-Prüfung) — leer, wenn der Anfang kein gültiges Base64 ist. */
export function kopfBytes(b64: string, n = 16): Uint8Array {
  const teil = b64.slice(0, Math.ceil((n * 4) / 3) + 4);
  const lang = Math.floor(teil.length / 4) * 4;
  try { return Uint8Array.from(atob(teil.slice(0, lang)), c => c.charCodeAt(0)).subarray(0, n); } catch { return new Uint8Array(0); }
}

/**
 * Was ein Bild WIRKLICH ist, aus den ersten Bytes (JPEG, PNG, WebP, HEIC/HEIF) — der mitgeschickte Typ allein zählt nicht.
 * `null` = keines der bekannten Formate. Angenommen werden nur JPEG und PNG (wie die Ablage); WebP/HEIC werden erkannt, damit die
 * Meldung sagen kann, was zu tun ist.
 */
export function bildInhaltsTyp(k: Uint8Array): 'jpeg' | 'png' | 'webp' | 'heic' | null {
  const text = (ab: number, t: string) => t.length > 0 && k.length >= ab + t.length && t.split('').every((c, i) => k[ab + i] === c.charCodeAt(0));
  if (k.length >= 3 && k[0] === 0xff && k[1] === 0xd8 && k[2] === 0xff) return 'jpeg';
  if (k.length >= 8 && k[0] === 0x89 && text(1, 'PNG') && k[4] === 0x0d && k[5] === 0x0a && k[6] === 0x1a && k[7] === 0x0a) return 'png';
  if (text(0, 'RIFF') && text(8, 'WEBP')) return 'webp';
  if (text(4, 'ftyp') && ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1', 'heif'].some(m => text(8, m))) return 'heic';
  return null;
}

export const base64Bytes = (b64: string): number => Math.floor((b64.length * 3) / 4) - (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0);
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** Folgefrist für „Follow-up“: zwei Werktage nach dem Tag der Begegnung (Feiertage NRW zählen mit, `werktagePlus`). */
export const followupFrist = (tag: string): string => werktagePlus(tag, 2);
/** Folgefrist für „Ohne Termin abschließen“: der nächste Werktag — der Termin soll ja bald vereinbart werden. */
export const followupFristEinTag = (tag: string): string => werktagePlus(tag, 1);

/** „Anschrift“ → Stadt (PLZ + Ort in der letzten Zeile) — sonst nichts, nie raten. */
export function stadtAusAnschrift(a: string | undefined): string | undefined {
  const zeilen = (a ?? '').split(/\n|;/).map(z => z.trim()).filter(Boolean);
  const m = /\b\d{5}\s+([^\d,]{2,60})$/.exec(zeilen[zeilen.length - 1] ?? '') ?? /\b\d{5}\s+([^\d,]{2,60}),/.exec(a ?? '');
  return m?.[1].trim();
}

/**
 * Den Körper einer Erfassung prüfen und säubern. Nie still kürzen: zu lange Texte und zu viele/zu große Bilder
 * werden abgelehnt (413 bzw. 400 mit Klartext). Personen und Event-Kennung prüft nur die FORM — ob die Person im
 * Haushalt ist und das Event existiert, entscheidet der Server.
 */
export function erfassungPruefen(roh: unknown, opt: { jetzt?: Date; heute: string }): Pruefung<Erfassung> {
  const jetzt = opt.jetzt ?? new Date();
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return fehler('Kein gültiger Körper.');
  const b = roh as Record<string, unknown>;
  if (typeof b.erfassungId !== 'string' || !ERFASSUNG_ID.test(b.erfassungId)) return fehler('Erfassungs-Kennung fehlt oder ist ungültig.');
  const erfassungId = b.erfassungId;
  if (typeof b.eventId !== 'string' || !ID.test(b.eventId)) return fehler('Bei welchem Event? Bitte zuerst „Heute bei“ wählen.');
  const eventId = b.eventId;

  // Wann: nie in der Zukunft (+10 Min. Uhrenabweichung), nie älter als 14 Tage — sonst jetzt.
  const ms = typeof b.erfasstAm === 'string' ? Date.parse(b.erfasstAm) : NaN;
  const erfasstAm = Number.isFinite(ms) && ms <= jetzt.getTime() + 10 * 60_000 && ms >= jetzt.getTime() - ERFASSUNG_ALTER_TAGE * 864e5 ? new Date(ms).toISOString() : jetzt.toISOString();

  let eventNeu: Erfassung['eventNeu'];
  if (b.eventNeu !== undefined && b.eventNeu !== null) {
    const e = b.eventNeu as Record<string, unknown>;
    const titel = text(e.titel, 161), datum = typeof e.datum === 'string' ? e.datum : '';
    if (!titel || titel.length > 160 || !TAG.test(datum)) return fehler('Das neue Event braucht einen Namen (höchstens 160 Zeichen) und ein Datum.');
    const ort = text(e.ort, 201);
    if (ort.length > 200) return fehler('Der Ort ist zu lang (höchstens 200 Zeichen).');
    const fuer = fuerSaeubern(e.fuer);
    eventNeu = { titel, datum, ...(ort ? { ort } : {}), ...(fuer ? { fuer } : {}) };
  }

  // Person
  const k = (b.kontakt && typeof b.kontakt === 'object' ? b.kontakt : {}) as Record<string, unknown>;
  const lang = (feld: string, v: unknown, max: number): string | { fehler: string } => { const t = text(v, max + 1); return t.length > max ? { fehler: `${feld} ist zu lang (höchstens ${max} Zeichen).` } : t; };
  const felder: KontaktFelder = {};
  for (const [name, label, max] of [['vorname', 'Vorname', 80], ['nachname', 'Nachname', 80], ['firma', 'Firma', 140], ['position', 'Position', 120]] as const) {
    const r = lang(label, k[name], max);
    if (typeof r !== 'string') return fehler(r.fehler);
    if (r) felder[name] = r;
  }
  if (typeof k.anschrift === 'string' && k.anschrift.trim()) {
    // Mehrzeilig erlaubt (Straße, PLZ Ort) — Zeilen einzeln gesäubert.
    const zeilen = k.anschrift.split(/\r?\n/).map(z => text(z, 200)).filter(Boolean);
    const a = zeilen.join('\n');
    if (a.length > 400) return fehler('Die Anschrift ist zu lang (höchstens 400 Zeichen).');
    if (a) felder.anschrift = a;
  }
  if (typeof k.email === 'string' && k.email.trim()) { const e = emailNormal(k.email); if (!e) return fehler('Die E-Mail-Adresse sieht unvollständig aus.'); felder.email = e; }
  for (const [name, label] of [['telefon', 'Telefon'], ['mobil', 'Handy']] as const) {
    if (typeof k[name] === 'string' && (k[name] as string).trim()) { const t = telefonNormal(k[name]); if (!t) return fehler(`${label}: bitte mit Vorwahl (z. B. 0171 … oder +49 …).`); felder[name] = t; }
  }
  if (typeof k.webseite === 'string' && k.webseite.trim()) { const w = webNormal(k.webseite); if (!w) return fehler('Die Webseite sieht nicht gültig aus.'); felder.webseite = w; }
  if (typeof k.linkedin === 'string' && k.linkedin.trim()) { const l = linkedinNormal(k.linkedin); if (!l) return fehler('LinkedIn: bitte die Profil-Adresse (linkedin.com/in/…).'); felder.linkedin = l; }
  if (k.anrede === 'Du' || k.anrede === 'Sie') felder.anrede = k.anrede;

  const vorhanden = typeof b.vorhandenKontaktId === 'string' && b.vorhandenKontaktId ? b.vorhandenKontaktId : undefined;
  if (vorhanden && !istKontaktKennung(vorhanden)) return fehler('Die gewählte Person ist ungültig.');
  // 5.14 (08.10.): Vorname ODER Nachname reicht — auf dem Event kennt man oft nur einen. Die Dublettenregel bleibt sicher: eine gleiche
  // Nummer hängt nur bei gleichem NACHNAMEN an (`zusammenfuehrung`), ohne Nachnamen entsteht eine neue Person mit Hinweis.
  if (!vorhanden && !felder.nachname && !felder.vorname) return fehler(NAME_FEHLT);
  const firmaId = typeof b.firmaId === 'string' && b.firmaId ? b.firmaId : undefined;
  if (firmaId && !FIRMA_ID.test(firmaId)) return fehler('Die gewählte Firma ist ungültig.');

  // Bilder
  const bilderRoh = Array.isArray(b.bilder) ? b.bilder : [];
  if (bilderRoh.length > MAX_BILDER) return fehler(`Höchstens ${MAX_BILDER} Fotos je Karte.`, 413);
  const bilder: BildEingabe[] = [];
  for (const [i, x] of bilderRoh.entries()) {
    const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
    const typ = String(o.typ ?? '');
    const daten = typeof o.daten === 'string' ? o.daten.replace(/\s+/g, '') : '';
    if (!(BILD_TYPEN as readonly string[]).includes(typ) || !daten || !BASE64.test(daten)) return fehler(`Foto ${i + 1}: nur JPEG oder PNG.`, 415);
    if (base64Bytes(daten) > MAX_BILD_BYTES) return fehler(`Foto ${i + 1} ist zu groß (höchstens ${MAX_BILD_BYTES / 1024 / 1024} MB).`, 413);
    // Der Inhalt entscheidet, nicht die Angabe — VOR dem ersten Schreiben: sonst bliebe bei einer Datei, die die Ablage später ablehnt, ein Teilzustand.
    const echt = bildInhaltsTyp(kopfBytes(daten));
    if (echt !== 'jpeg' && echt !== 'png') return fehler(echt === 'webp' || echt === 'heic' ? `Foto ${i + 1}: ${echt === 'heic' ? 'HEIC' : 'WebP'} wird nicht gelesen — bitte als JPEG aufnehmen.` : `Foto ${i + 1}: keine gültige Bilddatei (nur JPEG oder PNG).`, 415);
    // Datenminimierung (03.10.): Exif/GPS/XMP raus, bevor irgendetwas geschrieben wird — auch bei Erfassungen aus der Warteschlange älterer Stände.
    const sauber = base64OhneMetadaten(daten, echt);
    if (!sauber) return fehler(`Foto ${i + 1}: Die Bilddatei ist beschädigt — bitte noch einmal aufnehmen.`, 415);
    bilder.push({ name: text(o.name, 80) || `karte-${i + 1}`, typ, daten: sauber });
  }
  let sprachnotiz: Erfassung['sprachnotiz'];
  if (b.sprachnotiz !== undefined && b.sprachnotiz !== null) {
    const o = b.sprachnotiz as Record<string, unknown>;
    // Safari liefert „audio/mp4;codecs=…“ — nur der Typ vor dem Semikolon zählt.
    const typ = String(o.typ ?? '').split(';')[0].trim().toLowerCase();
    const daten = typeof o.daten === 'string' ? o.daten.replace(/\s+/g, '') : '';
    if (!(AUDIO_TYPEN as readonly string[]).includes(typ) || !daten || !BASE64.test(daten)) return fehler('Die Sprachnotiz hat ein unbekanntes Format.', 415);
    if (base64Bytes(daten) > MAX_AUDIO_BYTES) return fehler(`Die Sprachnotiz ist zu groß (höchstens ${MAX_AUDIO_BYTES / 1024 / 1024} MB).`, 413);
    if (!sprachnotizTypErkennen(kopfBytes(daten))) return fehler('Die Sprachnotiz hat ein unbekanntes Format.', 415);   // am Inhalt, vor dem ersten Schreiben
    const dauer = Math.round(Number(o.dauerSek));
    sprachnotiz = { typ, daten, ...(Number.isFinite(dauer) && dauer > 0 && dauer < 36_000 ? { dauerSek: dauer } : {}) };
  }

  // Schritt und Zuständigkeit
  const schritt = String(b.schritt ?? '');
  if (!SCHRITT_IDS.includes(schritt)) return fehler('Bitte einen nächsten Schritt wählen.');
  const infoRoh = typeof b.info === 'string' ? b.info.replace(/\r\n/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim() : '';
  if (infoRoh.length > INFO_MAX) return fehler(`Die Info ist zu lang (höchstens ${INFO_MAX} Zeichen).`, 413);
  const zustaendig = typeof b.zustaendig === 'string' ? b.zustaendig : '';
  if (!PERSON.test(zustaendig)) return fehler('Bitte wählen, wer zuständig ist.');

  const raus: Erfassung = { erfassungId, erfasstAm, eventId, ...(eventNeu ? { eventNeu } : {}), kontakt: felder, ...(vorhanden ? { vorhandenKontaktId: vorhanden } : {}), ...(b.gesprochen === false ? { gesprochen: false } : {}),
    ...(b.neuErzwingen === true ? { neuErzwingen: true } : {}), ...(typeof b.erfasstVon === 'string' && PERSON.test(b.erfasstVon) ? { erfasstVon: b.erfasstVon } : {}), ...(firmaId ? { firmaId } : {}), bilder, ...(sprachnotiz ? { sprachnotiz } : {}),
    schritt: schritt as NetzwerkSchritt, ...(infoRoh ? { info: infoRoh } : {}), zustaendig };

  // Einzelheiten je Schritt
  if (schritt === 'followup') {
    const f = (b.followup ?? {}) as Record<string, unknown>;
    const tag = typeof f.faellig === 'string' && TAG.test(f.faellig) ? f.faellig : followupFrist(tagVon(wandzeit(new Date(erfasstAm))));
    raus.followup = { faellig: tag };
  } else if (schritt === 'termin') {
    const t = (b.termin ?? {}) as Record<string, unknown>;
    if (!TERMIN_ARTEN.some(a => a.id === t.art)) return fehler('Welche Art von Termin? (Kennenlerngespräch, Telefonat, Videocall)');
    const dauer = Math.round(Number(t.dauer));
    if (!(DAUERN as readonly number[]).includes(dauer)) return fehler('Die Dauer muss 30, 45 oder 60 Minuten sein.');
    if (typeof t.start !== 'string' || !WAND.test(t.start)) return fehler('Wann soll der Termin sein?');
    // Ein Termin in der Vergangenheit ist ein Tippfehler — gemessen am Zeitpunkt der Erfassung (die Warteschlange sendet unter
    // Umständen später), mit 15 Minuten Luft für „jetzt gleich“. Nicht an der Sendezeit: sonst scheiterte jede liegengebliebene Erfassung.
    const ab = wandAus(tagVon(wandzeit(new Date(erfasstAm))), minutenVon(wandzeit(new Date(erfasstAm))) - 15).slice(0, 16);
    if (t.start < ab) return fehler('Der Termin liegt in der Vergangenheit — bitte eine Zeit ab jetzt wählen.');
    raus.termin = { art: t.art as TerminArt, dauer, start: t.start };
    if (b.ohneTermin === true) raus.ohneTermin = true;
  } else if (schritt === 'vermitteln') {
    const v = (b.vermitteln ?? {}) as Record<string, unknown>;
    const an = text(v.an, 161);
    if (an.length < 2) return fehler('An wen vermitteln?');
    if (an.length > 160) return fehler('„An wen“ ist zu lang (höchstens 160 Zeichen).');
    raus.vermitteln = { an };
  } else if (schritt === 'makeone') {
    const m = (b.makeone ?? {}) as Record<string, unknown>;
    if (typeof m.eventId === 'string' && m.eventId) {
      if (!ID.test(m.eventId)) return fehler('Das gewählte Event ist ungültig.');
      raus.makeone = { eventId: m.eventId };
    }
  } else if (schritt === 'andere') {
    const a = (b.andere ?? {}) as Record<string, unknown>;
    const t = text(a.text, 301);
    if (t.length < 2) return fehler('Was soll getan werden?');
    if (t.length > 300) return fehler('Der Text ist zu lang (höchstens 300 Zeichen).');
    raus.andere = { text: t, ...(typeof a.faellig === 'string' && TAG.test(a.faellig) ? { faellig: a.faellig } : {}) };
  }
  return { ok: true, wert: raus };
}

/** Der Berliner Tag eines ISO-Zeitpunkts — „ab dem Folgetag“ zählt in Berlin, nie nach UTC (kurz nach Mitternacht liegt UTC noch am Vortag). */
export const berlinTag = (iso: string): string => tagVon(wandzeit(new Date(iso)));

/** Wandzeit „YYYY-MM-DDTHH:mm“ + Minuten (ohne Zeitumstellung — Termine dauern 30–60 Minuten). */
export const wandPlusMinuten = (start: string, minuten: number): string => wandAus(start.slice(0, 10), minutenVon(start) + minuten).slice(0, 16);

// ── Angabe an der Teilnahme (gesäubert) ──────────────────────────────────────

/**
 * Zweite Begegnung mit derselben Person beim selben Event (N6): die neuere Angabe gilt, die ältere bleibt NACHLESBAR (`vorher`) — nichts wird überschrieben.
 * Ein schon gebuchter Termin (`terminAm`/`terminId`) und eine Make.One-Vormerkung gehen nicht verloren: sie bleiben stehen, solange die neue Angabe keine eigenen hat.
 */
export function angabeMitVorher(alt: NetzwerkenAngabe, neu: NetzwerkenAngabe): NetzwerkenAngabe {
  const frueher = { erfassungId: alt.erfassungId, schritt: alt.schritt, erfasstAm: alt.erfasstAm, ...(alt.info ? { info: alt.info } : {}), ...(alt.terminAm ? { terminAm: alt.terminAm } : {}), ...(alt.terminId ? { terminId: alt.terminId } : {}) };
  return {
    ...neu,
    ...(neu.terminAm || !alt.terminAm ? {} : { terminAm: alt.terminAm, ...(alt.terminId ? { terminId: alt.terminId } : {}) }),
    ...(neu.makeone || !alt.makeone ? {} : { makeone: alt.makeone }),
    ...(alt.neuAngelegt && !neu.neuAngelegt ? { neuAngelegt: true as const } : {}),
    vorher: [...(alt.vorher ?? []), frueher],
  };
}

/** `Teilnahme.netzwerken` aus dem Netz/Speicher säubern — Unbekanntes fällt weg, ohne Kennung/Schritt nichts. */
export function netzwerkenAngabeSaeubern(v: unknown): NetzwerkenAngabe | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  if (typeof o.erfassungId !== 'string' || !ERFASSUNG_ID.test(o.erfassungId) || !SCHRITT_IDS.includes(String(o.schritt))) return undefined;
  const person = (x: unknown) => (typeof x === 'string' && PERSON.test(x) ? x : undefined);
  const zustaendig = person(o.zustaendig), erfasstVon = person(o.erfasstVon);
  const am = typeof o.erfasstAm === 'string' && Number.isFinite(Date.parse(o.erfasstAm)) ? o.erfasstAm.slice(0, 30) : undefined;
  if (!zustaendig || !erfasstVon || !am) return undefined;
  const info = typeof o.info === 'string' ? o.info.slice(0, INFO_MAX) : '';
  const mo = o.makeone && typeof o.makeone === 'object' ? (o.makeone as Record<string, unknown>).eventId : undefined;
  const makeone = typeof mo === 'string' && ID.test(mo) ? { eventId: mo } : undefined;
  // Frühere Begegnungen (N6): jede mit gültiger Kennung; die Liste wächst nur um echte Erfassungen (nie gekürzt).
  const vorher = (Array.isArray(o.vorher) ? o.vorher : []).flatMap(x => {
    const v = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
    if (typeof v.erfassungId !== 'string' || !ERFASSUNG_ID.test(v.erfassungId) || !SCHRITT_IDS.includes(String(v.schritt)) || typeof v.erfasstAm !== 'string' || !Number.isFinite(Date.parse(v.erfasstAm))) return [];
    const i = typeof v.info === 'string' ? v.info.slice(0, INFO_MAX) : '';
    const tAm = typeof v.terminAm === 'string' && WAND.test(v.terminAm) ? v.terminAm : undefined, tId = typeof v.terminId === 'string' && v.terminId.length <= 200 && v.terminId.trim() ? v.terminId : undefined;
    return [{ erfassungId: v.erfassungId, schritt: v.schritt as NetzwerkSchritt, erfasstAm: v.erfasstAm.slice(0, 30), ...(i ? { info: i } : {}), ...(tAm ? { terminAm: tAm } : {}), ...(tId ? { terminId: tId } : {}) }];
  });
  const d = o.danke && typeof o.danke === 'object' ? o.danke as Record<string, unknown> : null;
  const danke = d ? { ...(d.anrede === 'Du' || d.anrede === 'Sie' ? { anrede: d.anrede as 'Du' | 'Sie' } : {}), ...(typeof d.rausAm === 'string' && TAG.test(d.rausAm) ? { rausAm: d.rausAm } : {}), ...(typeof d.verzichtetAm === 'string' && TAG.test(d.verzichtetAm) ? { verzichtetAm: d.verzichtetAm } : {}) } : null;
  return {
    erfassungId: o.erfassungId, schritt: o.schritt as NetzwerkSchritt, zustaendig, erfasstVon, erfasstAm: am,
    ...(info ? { info } : {}), ...(typeof o.terminAm === 'string' && WAND.test(o.terminAm) ? { terminAm: o.terminAm } : {}),
    ...(typeof o.terminId === 'string' && o.terminId.length <= 200 && o.terminId.trim() ? { terminId: o.terminId } : {}),
    ...(danke && Object.keys(danke).length ? { danke } : {}),
    ...(makeone ? { makeone } : {}), ...(vorher.length ? { vorher } : {}),
    ...(o.neuAngelegt === true ? { neuAngelegt: true as const } : {}), ...(o.kartenfoto === true ? { kartenfoto: true as const } : {}), ...(o.keinGespraech === true ? { keinGespraech: true as const } : {}),
  };
}

/** `Teilnahme.herkunft` säubern (gültige Kennungen, sonst nichts) — ohne diese Zeile in `zusatz('teilnahmen')` fiele sie bei jedem Speichern weg. */
export function teilnahmeHerkunftSaeubern(v: unknown): TeilnahmeHerkunft | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  if (o.art !== 'netzwerken' || typeof o.eventId !== 'string' || !ID.test(o.eventId) || typeof o.erfassungId !== 'string' || !ERFASSUNG_ID.test(o.erfassungId)) return undefined;
  return { art: 'netzwerken', eventId: o.eventId, erfassungId: o.erfassungId };
}

// ── „Kennen wir schon?“ ──────────────────────────────────────────────────────

export type TrefferStaerke = 'mail' | 'telefon' | 'name-firma' | 'aehnlich' | 'name';
export interface Treffer {
  kontakt: Kontakt;
  staerke: TrefferStaerke;
  /** Ein Satz für die Anzeige („gleiche E-Mail-Adresse“). */
  grund: string;
  /** Art. 18: gesperrt — nicht auswählbar, nur der Hinweis. */
  gesperrt?: boolean;
}
const STAERKE_RANG: Record<TrefferStaerke, number> = { mail: 0, telefon: 1, 'name-firma': 2, aehnlich: 3, name: 4 };
const GRUND: Record<TrefferStaerke, string> = {
  mail: 'gleiche E-Mail-Adresse', telefon: 'gleiche Telefonnummer', 'name-firma': 'gleicher Name, gleiche Firma', aehnlich: 'ähnlicher Name, gleiche Firma', name: 'gleicher Name, andere Firma',
};

/** Editierabstand (Levenshtein), früh abgebrochen — Namen sind kurz, die Kartei hat ein paar hundert Einträge. */
export function abstand(a: string, b: string, max = 2): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let vor = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const jetzt = [i];
    let kleinster = i;
    for (let j = 1; j <= b.length; j++) {
      const w = Math.min(vor[j] + 1, jetzt[j - 1] + 1, vor[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      jetzt.push(w);
      if (w < kleinster) kleinster = w;
    }
    if (kleinster > max) return max + 1;
    vor = jetzt;
  }
  return vor[b.length];
}

/**
 * Wer in der Kartei könnte dieselbe Person sein? Läuft bei jeder Eingabe (Name/Firma/Mail/Telefon) — deshalb tolerant
 * und billig. Stark: gleiche persönliche Mail oder Telefonnummer (Sammeladressen wie info@ zählen nie). Namen: gleich
 * (ohne Titel, Umlaute, Satzzeichen), mit gleicher Firma stärker; ähnlich (1–2 Buchstaben) nur mit gleicher Firma.
 * Nur Nachname + Firma gleich (bei fehlendem/abgekürztem Vornamen) zählt wie Name + Firma. Bestes zuerst, höchstens `max`.
 */
export function kenntWirSchon(e: { vorname?: string; nachname?: string; firma?: string; email?: string; telefon?: string; mobil?: string }, kontakte: readonly Kontakt[], max = 3): Treffer[] {
  const mail = (e.email ?? '').trim().toLowerCase();
  const mailOk = mail.includes('@') && mail.length >= 6 && !istSammelAdresse(mail);
  const nummern = [normTelefon(e.telefon), normTelefon(e.mobil)].filter(Boolean);
  const name = normName(e.vorname, e.nachname);
  const nach = normName('', e.nachname);
  const firma = normFirma(e.firma);
  const vornameLang = normName(e.vorname, '').length >= 3;
  const treffer: Treffer[] = [];
  for (const k of kontakte) {
    let s: TrefferStaerke | null = null;
    if (mailOk && alleAdressen(k).includes(mail)) s = 'mail';
    else if (nummern.length && [normTelefon(k.telefon), normTelefon(k.sms)].some(t => t && nummern.includes(t))) s = 'telefon';
    else if (name.length >= 4 || nach.length >= 3) {
      const kk = normName(k.vorname, k.nachname), kn = normName('', k.nachname), kf = normFirma(k.firma);
      const firmaGleich = !!firma && firma === kf;
      if (name.length >= 5 && kk === name) s = firmaGleich ? 'name-firma' : 'name';
      else if (firmaGleich && nach.length >= 3 && kn === nach && !vornameLang) s = 'name-firma';
      else if (firmaGleich && name.length >= 7 && abstand(name, kk, name.length >= 12 ? 2 : 1) <= (name.length >= 12 ? 2 : 1)) s = 'aehnlich';
    }
    if (s) treffer.push({ kontakt: k, staerke: s, grund: s === 'name' && !firma ? 'gleicher Name' : GRUND[s], ...(k.eingeschraenkt ? { gesperrt: true } : {}) });
  }
  return treffer.sort((a, b) => STAERKE_RANG[a.staerke] - STAERKE_RANG[b.staerke] || anzeigename(a.kontakt).localeCompare(anzeigename(b.kontakt), 'de')).slice(0, max);
}

/** Zeile „Kennen wir schon: Name · Firma · zuständig X · zuletzt Datum“ — Namen der Zuständigen löst der Aufrufer auf. */
export function kennenText(t: Treffer, nameVon: (id: string) => string): { name: string; firma?: string; zustaendig: string; zuletzt?: string } {
  const k = t.kontakt;
  const zuletzt = k.letzterKontakt ?? [...(k.aktivitaeten ?? [])].filter(a => a.art !== 'system').map(a => a.am.slice(0, 10)).sort().pop();
  return { name: anzeigename(k), ...(k.firma ? { firma: k.firma } : {}), zustaendig: nameVon(haeltBeziehung(k)), ...(zuletzt ? { zuletzt } : {}) };
}

/**
 * Was passiert beim Anlegen mit einer Person, die der Kartei ähnelt? (Server, 03.10.)
 *  · `ziel`           gleiche persönliche Mail — oder gleiche Nummer UND gleicher Nachname: nicht doppelt anlegen, anhängen
 *  · `gleicheNummer`  gleiche Nummer, anderer Nachname (Sammelanschluss, Familie, Zentrale): NEUE Person + Hinweis
 *  · `vermutlich`     gleicher/ähnlicher Name und Firma, aber ohne Mail/Nummer als Beleg: NEUE Person + Hinweis + Label
 * `eigeneId` (die feste Kennung der Erfassung) zählt nie als Treffer — ein wiederholter Lauf findet sich nicht selbst.
 */
export function zusammenfuehrung(e: Pick<Erfassung, 'kontakt'>, kontakte: readonly Kontakt[], eigeneId: string): { ziel?: Treffer; gleicheNummer?: Treffer; vermutlich?: Treffer } {
  const nach = normName('', e.kontakt.nachname);
  const alle = kenntWirSchon({ vorname: e.kontakt.vorname, nachname: e.kontakt.nachname, firma: e.kontakt.firma, email: e.kontakt.email, telefon: e.kontakt.telefon, mobil: e.kontakt.mobil },
    kontakte.filter(x => !x.eingeschraenkt && x.id !== eigeneId), 8);
  let gleicheNummer: Treffer | undefined, vermutlich: Treffer | undefined;
  for (const t of alle) {
    if (t.staerke === 'mail') return { ziel: t };
    if (t.staerke === 'telefon') {
      if (nach && normName('', t.kontakt.nachname) === nach) return { ziel: t };
      gleicheNummer ??= t;
    } else if (t.staerke === 'name-firma' || t.staerke === 'aehnlich') vermutlich ??= t;
  }
  return { ...(gleicheNummer ? { gleicheNummer } : {}), ...(vermutlich ? { vermutlich } : {}) };
}

/**
 * Würde die Erfassung an eine EINGESCHRÄNKTE Person (Art. 18) hängen — gleiche Regel wie `zusammenfuehrung` (Mail, oder Nummer UND
 * Nachname)? Dann darf nichts geschehen: weder anhängen noch daneben neu anlegen (das wäre dieselbe Verarbeitung). Gibt `true` bei Treffer;
 * den Namen der Person nennt die Meldung nie.
 */
export function trifftEingeschraenkte(e: Pick<Erfassung, 'kontakt'>, kontakte: readonly Kontakt[], eigeneId: string): boolean {
  const gesperrt = kontakte.filter(x => x.id !== eigeneId && istEingeschraenkt(x)).map(x => ({ ...x, eingeschraenkt: undefined }));
  return gesperrt.length > 0 && !!zusammenfuehrung(e, gesperrt, eigeneId).ziel;
}

/**
 * Beim Anhängen an eine bestehende Person: leere Felder aus der Karte füllen (Telefon, Handy, Position, LinkedIn, Website),
 * nichts überschreiben. Gibt die Person und die Namen der ergänzten Felder zurück.
 */
export function luekenFuellen(k: Kontakt, neu: KontaktFelder, heute: string, firma?: { id: string; name: string }): { kontakt: Kontakt; ergaenzt: string[]; hinweis?: string } {
  const leer = (v: unknown) => typeof v !== 'string' || !v.trim();
  const x: Kontakt = { ...k };
  const ergaenzt: string[] = [];
  const setze = (feld: 'telefon' | 'sms' | 'position' | 'linkedin' | 'firmaWebseite', wert: string | undefined, name: string) => {
    if (wert && leer(x[feld])) { x[feld] = wert; ergaenzt.push(name); }
  };
  setze('telefon', neu.telefon, 'Telefon'); setze('sms', neu.mobil, 'Handy'); setze('position', neu.position, 'Position');
  setze('linkedin', neu.linkedin, 'LinkedIn'); setze('firmaWebseite', neu.webseite, 'Webseite');
  // Firma der Karte (M6): hat die bestehende Person noch keine, wird sie verknüpft; nennt die Karte eine ANDERE, bleibt alles, wie es ist — nur ein Hinweis
  // (Jobwechsel, Zweitfirma, Tippfehler: das entscheidet ein Mensch, nie die Erfassung).
  let hinweis: string | undefined;
  const kartenFirma = (neu.firma ?? '').trim();
  if (kartenFirma) {
    if (leer(x.firma) && !x.firmaId) { if (firma) { x.firma = firma.name; x.firmaId = firma.id; ergaenzt.push('Firma'); } }
    else if (firmenSchluessel(x.firma ?? firma?.name ?? '') !== firmenSchluessel(kartenFirma) && !(firma && x.firmaId === firma.id)) hinweis = `Karte nennt andere Firma: ${kartenFirma} (bei ${anzeigename(k)} steht ${x.firma ?? 'eine andere'}) — nichts geändert, bitte bei Gelegenheit prüfen.`;
  }
  if (ergaenzt.length) x.geaendertAm = heute;
  return { kontakt: ergaenzt.length ? x : k, ergaenzt, ...(hinweis ? { hinweis } : {}) };
}

/** Passt eine bestehende Firma? Genau (ohne Rechtsform) zuerst, dann Teilübereinstimmung (ab 3 Zeichen). */
export function firmaVorschlaege(name: string, firmen: readonly Firma[], max = 4): { firma: Firma; exakt: boolean }[] {
  const s = firmenSchluessel(name);
  if (s.length < 2) return [];
  const exakt = bestehendeFirma(firmen, name);
  const teil = s.length >= 3 ? firmen.filter(f => f !== exakt && (firmenSchluessel(f.name).startsWith(s) || (s.length >= 4 && firmenSchluessel(f.name).includes(s)))) : [];
  return [...(exakt ? [{ firma: exakt as Firma, exakt: true }] : []), ...teil.slice(0, max).map(f => ({ firma: f, exakt: false }))].slice(0, max);
}

// ── Danke-Mail ───────────────────────────────────────────────────────────────

const WOCHENTAG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const datumDe = (tag: string) => `${tag.slice(8, 10)}.${tag.slice(5, 7)}.`;

/**
 * Entwurf der Danke-Mail — ein Dank und höchstens ein Satz zum verabredeten Schritt, NIE Werbung (§ 7 UWG:
 * eine persönliche Nachricht nach dem Gespräch ist erlaubt, ein Angebot oder eine Einladung per Mail ohne Einwilligung nicht).
 * Versand nur per Einzelklick im Mail-Programm (`dankeMailtoLink`) — MAKE OS verschickt hier nichts.
 */
export function dankeEntwurf(a: { vorname?: string; nachname?: string; anrede: 'Du' | 'Sie'; eventTitel: string; wann: 'gestern' | 'neulich'; schritt?: NetzwerkSchritt; terminAm?: string; absender: string; /** Kunden-Event: Name der Firma, an die die Kontaktdaten weitergehen (Art. 13: Empfänger nennen). */ kunde?: string; /** Kontaktweg und Seite für die Rechte der Person — Standard: MAKE. */ datenschutz?: DatenschutzAngaben; /** An diesem Event NEU angelegt (Standard) — sonst Bestandsperson: „wiedergesehen“, keine Visitenkarte, keine Ankündigung der Weitergabe. */ neu?: boolean; /** Persönlich gesprochen (Standard) — sonst kein „Danke für das Gespräch“. */ gesprochen?: boolean; /** Tag des EVENTS und heute: „gestern“ nur, wenn das EVENT gestern war, sonst „am 08.10.“ (nie relativ zum Erfassungstag). */ eventDatum?: string; heute?: string }): { betreff: string; text: string } {
  const du = a.anrede === 'Du';
  const vorname = a.vorname?.trim() ?? '', nachname = a.nachname?.trim() ?? '';
  const ansprache = du ? `Hallo ${vorname || nachname}`.trim() + ',' : `Guten Tag ${[vorname, nachname].filter(Boolean).join(' ')}`.trim() + ',';
  const neu = a.neu !== false, gesprochen = a.gesprochen !== false;
  const wann = a.eventDatum && a.heute && istKalendertag(a.eventDatum) && istKalendertag(a.heute)
    ? (tageZwischenTage(a.eventDatum, a.heute) === 1 ? 'gestern' : `am ${datumDe(a.eventDatum)}`)
    : a.wann;
  const kennengelernt = !gesprochen
    ? `schön, dass wir uns ${wann} bei ${a.eventTitel} begegnet sind.`
    : neu ? (du ? `schön, dich ${wann} bei ${a.eventTitel} kennengelernt zu haben.` : `schön, Sie ${wann} bei ${a.eventTitel} kennengelernt zu haben.`)
      : (du ? `schön, dich ${wann} bei ${a.eventTitel} wiedergesehen zu haben.` : `schön, Sie ${wann} bei ${a.eventTitel} wiedergesehen zu haben.`);
  const dank = !gesprochen ? '' : du ? 'Danke für das Gespräch — ich habe es gern geführt.' : 'Vielen Dank für das Gespräch — ich habe es gern geführt.';
  let schluss = '';
  if (a.schritt === 'termin' && a.terminAm) schluss = `Wie besprochen: Unser Termin ist am ${WOCHENTAG[new Date(`${a.terminAm.slice(0, 10)}T12:00:00Z`).getUTCDay()]}, ${datumDe(a.terminAm.slice(0, 10))} um ${a.terminAm.slice(11, 16)} Uhr.`;
  else if (a.schritt === 'followup') schluss = du ? 'Ich melde mich in den nächsten Tagen bei dir.' : 'Ich melde mich in den nächsten Tagen bei Ihnen.';
  const gruss = du ? 'Bis bald und viele Grüße' : 'Mit freundlichen Grüßen';
  // Art. 13 DSGVO (03.10.): der Hinweis gehört in die erste Nachricht an die Person — kurz, am Ende, mit Rechten und Empfänger.
  // Der Satz zur Weitergabe an den Kunden nur bei einer an diesem Event neu angelegten Person (Bestandspersonen gehen nicht ungefragt mit).
  const hinweis = datenschutzHinweisText({ du, quelle: neu ? 'karte' : 'bestand', ...(a.kunde && neu ? { kunde: a.kunde } : {}), ...(a.datenschutz ? { angaben: a.datenschutz } : {}) });
  return { betreff: gesprochen ? `Danke für das Gespräch bei ${a.eventTitel}` : `Kurz zu ${a.eventTitel}`, text: [ansprache, '', kennengelernt, ...(dank ? [dank] : []), ...(schluss ? ['', schluss] : []), '', gruss, a.absender, '', '—', hinweis].join('\n') };
}

/** mailto:-Link mit Betreff und Text — nur für eine plausible Adresse. Das Mail-Programm des Geräts öffnet; gesendet wird dort per Klick. */
export function dankeMailtoLink(an: string | undefined, e: { betreff: string; text: string }): string | null {
  const basis = mailLink(an);
  return basis ? `${basis}?subject=${encodeURIComponent(e.betreff)}&body=${encodeURIComponent(e.text)}` : null;
}

export interface DankeZeile {
  teilnahme: Teilnahme;
  kontakt: Kontakt;
  event: Event;
  /** Hat eine E-Mail-Adresse und darf (Ampel nicht rot) per Mail angeschrieben werden. */
  mailOk: boolean;
  /** Grund, wenn nicht: „keine E-Mail“, „Werbesperre …“. */
  mailGrund?: string;
  /** Schon als „raus“ bestätigt (Tag). */
  raus?: string;
  /** Bewusst nicht gesendet („Nicht senden“, Tag) — die Zeile bleibt sichtbar, zählt aber nie als offen. */
  verzichtet?: string;
  /** Älter als `DANKE_FRIST_TAGE` Tage: kein Entwurf mehr (der Anlass ist weg), nicht mehr in Glocke und Heute. */
  abgelaufen?: boolean;
}

/**
 * Danke-Mails zu einem Event: jede über „Netzwerken“ erfasste Person (mit der Begegnung vor heute — „ab dem Folgetag“).
 * `person`: nur die, die diese Person kennengelernt hat (sie schreibt die Danke-Mail, auch wenn eine andere Person den nächsten
 * Schritt betreut); ohne Person alle. Art. 18 → nie.
 */
export function dankeZeilen(o: { events: readonly Event[]; teilnahmen: readonly Teilnahme[]; kontakte: readonly Kontakt[]; heute: string; person?: string; eventId?: string }): DankeZeile[] {
  const nachKontakt = new Map(o.kontakte.map(k => [k.id, k]));
  const nachEvent = new Map(o.events.map(e => [e.id, e]));
  const raus: DankeZeile[] = [];
  for (const t of o.teilnahmen) {
    const n = t.netzwerken;
    if (!n || (o.eventId && t.eventId !== o.eventId)) continue;
    if (o.person && n.erfasstVon !== o.person) continue;
    if (berlinTag(n.erfasstAm) >= o.heute) continue;
    // § 7 UWG (03.10.): ohne persönliches Gespräch gibt es keinen Danke-Entwurf.
    if (n.keinGespraech) continue;
    const k = nachKontakt.get(t.kontaktId), e = nachEvent.get(t.eventId);
    if (!k || !e || k.eingeschraenkt) continue;
    const s = k.email ? kanalStatus(k, 'mail', {}) : null;
    const mailOk = !!k.email && !!s && s.farbe !== 'rot';
    raus.push({ teilnahme: t, kontakt: k, event: e, mailOk, ...(!k.email ? { mailGrund: 'keine E-Mail' } : s && s.farbe === 'rot' ? { mailGrund: s.grund } : {}), ...(n.danke?.rausAm ? { raus: n.danke.rausAm } : {}),
      ...(n.danke?.verzichtetAm ? { verzichtet: n.danke.verzichtetAm } : {}), ...(tageZwischenTage(berlinTag(n.erfasstAm), o.heute) > DANKE_FRIST_TAGE ? { abgelaufen: true } : {}) });
  }
  return raus.sort((a, b) => a.event.datum.localeCompare(b.event.datum) || anzeigename(a.kontakt).localeCompare(anzeigename(b.kontakt), 'de'));
}
/** Wie viele Danke-Mails warten (mit Adresse, noch nicht „raus“, nicht verzichtet, nicht älter als 14 Tage)? */
export const dankeOffen = (z: readonly DankeZeile[]): number => z.filter(x => x.mailOk && !x.raus && !x.verzichtet && !x.abgelaufen).length;
const tageZwischenTage = (von: string, bis: string): number => Math.round((Date.parse(`${bis}T12:00:00Z`) - Date.parse(`${von}T12:00:00Z`)) / 864e5);

// ── Abendbericht ─────────────────────────────────────────────────────────────

export interface BerichtZeile {
  kontaktId: string; name: string; firma?: string;
  schritt: NetzwerkSchritt; schrittText: string;
  zustaendig: string; erfasstVon: string;
  info?: string; terminAm?: string; erfasstAm: string;
  /** Was noch offen ist — Klartext für die Anzeige. */
  offen: string[];
  /** Sprünge zu dem, was die Erfassung angelegt hat: Termin, Deal, Follow-up, Event, Person (03.10.). */
  links: ErgebnisLink[];
  /** Frühere Begegnungen mit derselben Person bei diesem Event (die neuere Angabe gilt, die ältere steht hier — N6). */
  frueher?: { schrittText: string; erfasstAm: string; info?: string; terminAm?: string }[];
}
/** Ein Sprung zu etwas, das eine Erfassung angelegt hat. */
export interface ErgebnisLink { id: 'termin' | 'deal' | 'followup' | 'event' | 'kontakt' | 'makeone' | 'angebot' | 'aufgabe' | 'sprachnotiz'; label: string; href: string }

/**
 * Die Sprünge zu allem, was eine Erfassung angelegt hat — aus Kennungen, die der Server fest vergibt (`ch-nw-<Erfassung>`,
 * `fu-<Erfassung>`, `ang-nw-<Erfassung>`, `nw-<Erfassung>`, Termin-Schlüssel) und dem Make.One-Event der Vormerkung (`makeoneEventId`: Gästeliste
 * des Abends). Dieselbe Liste speist die Fertig-Seite und den Abendbericht — und die Meldung an die andere Person (`ergebnisZiel`).
 */
export function ergebnisLinks(o: { schritt: NetzwerkSchritt; erfassungId?: string; kontaktId?: string; eventId?: string; terminId?: string; terminAm?: string; dealId?: string; followupId?: string; angebotId?: string; makeoneEventId?: string; /** Der Schritt „Andere“ bzw. „Zu Make.One einladen“ ohne Event hat eine Aufgabe angelegt. */ aufgabe?: boolean; /** Zur Erfassung gehört eine Sprachnotiz ohne Abschrift — der Sprung führt in die Akte (Dateien), wo sie angehört wird. */ sprachnotiz?: boolean; /** Besuchtes Event (Events-Reiter, 03.10.): der Sprung geht direkt in die Event-Akte statt über die Weiterleitung von Make.One. */ besuch?: boolean }): ErgebnisLink[] {
  const l: ErgebnisLink[] = [];
  if (o.terminId && o.terminAm) l.push({ id: 'termin', label: 'Termin öffnen', href: WEG.termin(o.terminId, o.terminAm.slice(0, 10)) });
  const deal = o.dealId ?? (o.schritt === 'vermitteln' && o.erfassungId ? `ch-nw-${o.erfassungId}` : undefined);
  if (deal) l.push({ id: 'deal', label: 'Deal öffnen', href: WEG.deal(deal) });
  const fu = o.followupId ?? (o.schritt === 'followup' && o.erfassungId ? `fu-${o.erfassungId}` : undefined);
  if (fu) l.push({ id: 'followup', label: 'Follow-up öffnen', href: WEG.followup() });
  const angebot = o.angebotId ?? (o.schritt === 'angebot' && o.erfassungId ? `ang-nw-${o.erfassungId}` : undefined);
  if (angebot) l.push({ id: 'angebot', label: 'Angebots-Entwurf öffnen', href: WEG.angebot({ angebotId: angebot, ...(o.kontaktId ? { kontaktId: o.kontaktId } : {}) }) });
  if (o.makeoneEventId) l.push({ id: 'makeone', label: `Gästeliste ${MARKE_EVENTS}`, href: WEG.event(o.makeoneEventId, 'gaeste') });
  const aufgabe = o.aufgabe ?? (o.schritt === 'andere');
  if (aufgabe && o.erfassungId) l.push({ id: 'aufgabe', label: 'Aufgabe öffnen', href: WEG.aufgabe(`nw-${o.erfassungId}`) });
  if (o.sprachnotiz && o.kontaktId) l.push({ id: 'sprachnotiz', label: 'Sprachnotiz anhören', href: WEG.akte(o.kontaktId) });
  if (o.eventId) l.push({ id: 'event', label: o.besuch ? 'Event-Akte' : 'Event öffnen', href: eventLink({ id: o.eventId, ...(o.besuch ? { marke: NETZWERKEN_MARKE } : {}) }) });
  if (o.kontaktId) l.push({ id: 'kontakt', label: 'Zur Person', href: WEG.akte(o.kontaktId) });
  return l;
}

/** Wohin die Meldung an die andere Person springt: das, was die Erfassung angelegt hat (Termin → Deal → Angebot → Aufgabe → Follow-up), sonst die Person. */
export function ergebnisZiel(o: { schritt: NetzwerkSchritt; erfassungId: string; kontaktId: string; terminId?: string; terminAm?: string; aufgabe?: boolean }): string {
  const l = ergebnisLinks({ schritt: o.schritt, erfassungId: o.erfassungId, kontaktId: o.kontaktId, ...(o.terminId ? { terminId: o.terminId } : {}), ...(o.terminAm ? { terminAm: o.terminAm } : {}), ...(o.aufgabe !== undefined ? { aufgabe: o.aufgabe } : {}) });
  return (l.find(x => x.id !== 'kontakt' && x.id !== 'event') ?? l.find(x => x.id === 'kontakt'))!.href;
}

/** Hat die Person zu diesem Event eine Sprachnotiz, deren Abschrift noch fehlt? (Aktivität „Sprachnotiz aufgenommen — Abschrift folgt“ mit Bezug zum Event.) */
export const sprachnotizOhneAbschrift = (k: Pick<Kontakt, 'aktivitaeten'>, eventId: string): boolean =>
  (k.aktivitaeten ?? []).some(a => a.art === 'notiz' && a.bezug === eventId && (a.text ?? '').startsWith('Sprachnotiz aufgenommen') && (a.text ?? '').includes('Abschrift folgt'));

export interface Bericht { event: Event; zeilen: BerichtZeile[]; jePerson: Record<string, number>; offenGesamt: number }

/** Der Bericht eines Events: wen, welcher Schritt, wer zuständig, was offen ist — für beide, sortiert nach Zeit. */
export function berichtAus(o: { event: Event; teilnahmen: readonly Teilnahme[]; kontakte: readonly Kontakt[]; followups?: readonly FollowUp[]; heute: string }): Bericht {
  const nachKontakt = new Map(o.kontakte.map(k => [k.id, k]));
  const offeneFu = new Set((o.followups ?? []).filter(f => f.status === 'offen' && f.kontaktId).map(f => f.kontaktId!));
  const zeilen: BerichtZeile[] = [];
  for (const t of o.teilnahmen) {
    const n = t.netzwerken;
    if (!n || t.eventId !== o.event.id) continue;
    const k = nachKontakt.get(t.kontaktId);
    if (!k) continue;
    const offen: string[] = [];
    if (k.eingeschraenkt) offen.push('Verarbeitung eingeschränkt (Art. 18)');
    else {
      if (n.keinGespraech) offen.push('kein Gespräch — Datenschutzhinweis beim ersten Kontakt geben');
      else if (!k.email) offen.push('keine E-Mail — Datenschutzhinweis beim ersten Kontakt geben');
      else if (n.danke?.verzichtetAm && !n.danke.rausAm) offen.push('Danke-Mail nicht gesendet — Datenschutzhinweis beim ersten Kontakt geben');
      else if (!n.danke?.rausAm) offen.push(tageZwischenTage(berlinTag(n.erfasstAm), o.heute) > DANKE_FRIST_TAGE ? 'Danke-Mail nicht mehr angeboten (älter als 14 Tage) — Datenschutzhinweis beim ersten Kontakt geben' : berlinTag(n.erfasstAm) < o.heute ? 'Danke-Mail offen' : 'Danke-Mail ab morgen');
      if (n.schritt === 'followup' && offeneFu.has(k.id)) offen.push('Follow-up offen');
      if (n.schritt === 'qualifizieren' && (!k.lead || k.lead.status === 'qualifizierung')) offen.push('Qualifizierung offen');
      if (n.schritt === 'termin' && !n.terminAm) offen.push('Termin nicht angelegt');
      if (n.schritt === 'angebot') offen.push('Angebot nur als Entwurf');
      // Sprachnotiz ohne Abschrift (M13): die Aufnahme liegt in der Dateiablage an der Person, die Abschrift (KI) gibt es noch nicht — ein offener Punkt,
      // nie eine Sackgasse: der Sprung führt zur Akte, wo die Datei angehört wird. (Hier wird nichts transkribiert.)
      if (sprachnotizOhneAbschrift(k, o.event.id)) offen.push('Sprachnotiz ohne Abschrift — anhören');
      if (n.schritt === 'makeone') {
        // Der echte Stand der Vormerkung (nicht „immer offen“): nur „vorgemerkt“ ist noch zu tun; eingeladen/zugesagt/da ist es nicht mehr.
        const gast = n.makeone ? o.teilnahmen.find(x => x.eventId === n.makeone!.eventId && x.kontaktId === k.id) : undefined;
        if (k.werbesperre) offen.push(`${MARKE_EVENTS}: Werbesperre — nicht vorgemerkt`);
        else if (!n.makeone) offen.push(`${MARKE_EVENTS}-Einladung offen (Aufgabe)`);
        else if (!gast) offen.push(`${MARKE_EVENTS}: Vormerkung nicht mehr da`);
        else if (gast.status === 'vorgemerkt') offen.push(`${MARKE_EVENTS}-Einladung offen`);
      }
    }
    zeilen.push({ kontaktId: k.id, name: anzeigename(k), ...(k.firma ? { firma: k.firma } : {}), schritt: n.schritt, schrittText: schrittLabel(n.schritt), zustaendig: n.zustaendig, erfasstVon: n.erfasstVon, ...(n.info ? { info: n.info } : {}), ...(n.terminAm ? { terminAm: n.terminAm } : {}), erfasstAm: n.erfasstAm, offen,
      links: ergebnisLinks({ schritt: n.schritt, erfassungId: n.erfassungId, kontaktId: k.id, eventId: o.event.id, besuch: istNetzwerkenEvent(o.event), ...(n.terminId ? { terminId: n.terminId } : {}), ...(n.terminAm ? { terminAm: n.terminAm } : {}),
        ...(n.makeone ? { makeoneEventId: n.makeone.eventId } : {}), sprachnotiz: !k.eingeschraenkt && sprachnotizOhneAbschrift(k, o.event.id), aufgabe: n.schritt === 'andere' || (n.schritt === 'makeone' && !n.makeone && !k.werbesperre) }),
      ...(n.vorher?.length ? { frueher: n.vorher.map(v => ({ schrittText: schrittLabel(v.schritt), erfasstAm: v.erfasstAm, ...(v.info ? { info: v.info } : {}), ...(v.terminAm ? { terminAm: v.terminAm } : {}) })) } : {}) });
  }
  zeilen.sort((a, b) => a.erfasstAm.localeCompare(b.erfasstAm));
  const jePerson: Record<string, number> = {};
  for (const z of zeilen) jePerson[z.zustaendig] = (jePerson[z.zustaendig] ?? 0) + 1;
  return { event: o.event, zeilen, jePerson, offenGesamt: zeilen.reduce((s, z) => s + z.offen.length, 0) };
}
