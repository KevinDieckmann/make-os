// ─── Google Kalender ⇄ MAKE OS — Abbildung (rein, getestet, 03.10.2026) ──────
// Kevin 03.10.: Business-/MAKE-Termine jeder Person ↔ Google Kalender dieser Person, in BEIDE Richtungen.
//
// LESEN: ein Google-Ereignis (events.list, singleEvents=false: Serien als Master + Ausnahmen) wird zu einem iCalendar-
// Objekt (`KalenderObjekt`, wie ein CalDAV-Objekt aus iCloud) — danach rechnet derselbe, erprobte Kern (`termineAus`,
// ical.js: Serien, Ausnahmen, Zeitzonen, Zeitumstellung 25.10.2026, ganztägig) und liefert dieselbe `Termin`-Form wie
// iCloud. So funktionieren Kalender, Heute, Wochenplan, ZOE, Bezüge (`kalender-bezug`) und die Verbindungsprüfung ohne
// jede Sonderbehandlung. Was im ICS steht: Titel, Zeit mit TZID (Google `timeZone`) oder UTC, ganztägig (`date`), RRULE/
// EXDATE/RDATE wörtlich aus `recurrence`, abgesagte Vorkommen als EXDATE, verschobene als RECURRENCE-ID-Ausnahme, TRANSP
// (transparency), CLASS (visibility), Art (`extendedProperties.private.art`, sonst Google-eventType), Farbe, Gäste mit
// PARTSTAT, ORGANIZER, Meet-Link (URL), Erinnerungen (VALARM aus reminders.overrides).
//
// SCHREIBEN: `neuBody` / `patchBody` bauen den Google-Körper aus den MAKE-OS-Eingaben. Jedes Ereignis trägt
// `extendedProperties.private.makeOsId` = die UID, unter der MAKE OS es kennt (Bezüge, Spiegel, Zuordnung) und woran es
// seine eigenen Schreibungen wiedererkennt (kein Ping-Pong); die Google-ID wird aus der UID abgeleitet (`eventIdFuer`,
// base32hex), damit ein zweites Anlegen mit derselben UID nie ein Duplikat ergibt (Google antwortet 409).
// UID eines Termins in MAKE OS = `makeOsId`, sonst die Google-ID.

import { createHash } from 'node:crypto';
import type { KalenderObjekt, Aenderung, NeuerTermin } from '../ics';
import { rruleText } from '../wiederholung';
import { arbeitsortTitel, erinnerungenSauber, farbeSauber, istIcsArt, istBlockArt, type IcsArt, type BlockArt, type Sichtbarkeit } from '../arten';
import { ianaZone, wandzeitIn, ausWandzeitIn, STANDARD_ZONE } from '../zeitzone';
import { fnv } from '../bezug';

// ── Google-Typen (nur, was MAKE OS braucht) ─────────────────────────────────

export interface GZeit { date?: string; dateTime?: string; timeZone?: string }
export interface GTeilnehmer { email: string; displayName?: string; responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted'; self?: boolean; organizer?: boolean; resource?: boolean; optional?: boolean }
export interface GEvent {
  id: string;
  status?: 'confirmed' | 'tentative' | 'cancelled';
  etag?: string;
  updated?: string;
  summary?: string; description?: string; location?: string;
  start?: GZeit; end?: GZeit;
  recurrence?: string[];
  recurringEventId?: string;
  originalStartTime?: GZeit;
  transparency?: 'opaque' | 'transparent';
  visibility?: 'default' | 'public' | 'private' | 'confidential';
  attendees?: GTeilnehmer[];
  organizer?: { email?: string; displayName?: string; self?: boolean };
  reminders?: { useDefault?: boolean; overrides?: { method?: string; minutes: number }[] };
  /** Meet-Link (hangoutLink oder erster Video-Einstiegspunkt der Konferenzdaten) — nur lesen. */
  meetLink?: string;
  iCalUID?: string;
  sequence?: number;
  eventType?: string;
  /** Unsere Felder: `makeOsId` (UID in MAKE OS), `art`, `blockArt`, `farbe`. */
  privat?: Record<string, string>;
}

// ── Bereinigen: was Google liefert → was wir speichern ──────────────────────

const txt = (v: unknown, n: number): string | undefined => (typeof v === 'string' && v ? v.slice(0, n) : undefined);
const zeitSauber = (z: unknown): GZeit | undefined => {
  if (!z || typeof z !== 'object') return undefined;
  const o = z as Record<string, unknown>;
  const date = typeof o.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.date) ? o.date : undefined;
  const dateTime = typeof o.dateTime === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/.test(o.dateTime) ? o.dateTime : undefined;
  if (!date && !dateTime) return undefined;
  const tz = txt(o.timeZone, 64);
  return { ...(date ? { date } : {}), ...(dateTime ? { dateTime } : {}), ...(tz ? { timeZone: tz } : {}) };
};
const STATUS_OK = ['confirmed', 'tentative', 'cancelled'];
const ANTWORT_OK = ['needsAction', 'declined', 'tentative', 'accepted'];

/** Ein rohes Google-Ereignis (events.list/get/insert/patch) → schlanke, gesäuberte Form. null = unbrauchbar. */
export function schlank(roh: unknown): GEvent | null {
  if (!roh || typeof roh !== 'object') return null;
  const r = roh as Record<string, unknown>;
  const id = txt(r.id, 1024);
  if (!id) return null;
  const status = typeof r.status === 'string' && STATUS_OK.includes(r.status) ? r.status as GEvent['status'] : undefined;
  const rec = Array.isArray(r.recurrence) ? (r.recurrence as unknown[]).filter((x): x is string => typeof x === 'string' && /^(RRULE|RDATE|EXDATE|EXRULE)[;:]/i.test(x) && x.length <= 800).slice(0, 40) : undefined;
  const att = Array.isArray(r.attendees)
    ? (r.attendees as Record<string, unknown>[]).filter(a => a && typeof a.email === 'string' && a.email.includes('@')).slice(0, 300).map(a => ({
      email: String(a.email).trim().toLowerCase().slice(0, 254),
      ...(txt(a.displayName, 120) ? { displayName: txt(a.displayName, 120) } : {}),
      ...(typeof a.responseStatus === 'string' && ANTWORT_OK.includes(a.responseStatus) ? { responseStatus: a.responseStatus as GTeilnehmer['responseStatus'] } : {}),
      ...(a.self === true ? { self: true } : {}), ...(a.organizer === true ? { organizer: true } : {}), ...(a.resource === true ? { resource: true } : {}), ...(a.optional === true ? { optional: true } : {}),
    }))
    : undefined;
  const org = r.organizer && typeof r.organizer === 'object' ? r.organizer as Record<string, unknown> : null;
  const rem = r.reminders && typeof r.reminders === 'object' ? r.reminders as Record<string, unknown> : null;
  const over = Array.isArray(rem?.overrides) ? (rem!.overrides as Record<string, unknown>[]).filter(o => o && Number.isFinite(Number(o.minutes))).slice(0, 5).map(o => ({ ...(txt(o.method, 20) ? { method: txt(o.method, 20) } : {}), minutes: Math.max(0, Math.min(40320, Math.round(Number(o.minutes)))) })) : undefined;
  const conf = r.conferenceData && typeof r.conferenceData === 'object' ? (r.conferenceData as { entryPoints?: { entryPointType?: string; uri?: string }[] }).entryPoints : undefined;
  const video = Array.isArray(conf) ? conf.find(x => x?.entryPointType === 'video' && typeof x.uri === 'string')?.uri : undefined;
  const meet = [txt(r.hangoutLink, 500), txt(video, 500)].find(u => u && /^https:\/\//.test(u));
  const ext = (r.extendedProperties as { private?: Record<string, unknown> } | undefined)?.private;
  const privat: Record<string, string> = {};
  if (ext && typeof ext === 'object') for (const k of ['makeOsId', 'art', 'blockArt', 'farbe']) if (typeof ext[k] === 'string' && ext[k]) privat[k] = String(ext[k]).slice(0, 300);
  const start = zeitSauber(r.start), end = zeitSauber(r.end), orig = zeitSauber(r.originalStartTime);
  return {
    id, ...(status ? { status } : {}), ...(txt(r.etag, 200) ? { etag: txt(r.etag, 200) } : {}), ...(txt(r.updated, 40) ? { updated: txt(r.updated, 40) } : {}),
    ...(txt(r.summary, 400) ? { summary: txt(r.summary, 400) } : {}), ...(txt(r.description, 8000) ? { description: txt(r.description, 8000) } : {}), ...(txt(r.location, 400) ? { location: txt(r.location, 400) } : {}),
    ...(start ? { start } : {}), ...(end ? { end } : {}),
    ...(rec?.length ? { recurrence: rec } : {}), ...(txt(r.recurringEventId, 1024) ? { recurringEventId: txt(r.recurringEventId, 1024) } : {}), ...(orig ? { originalStartTime: orig } : {}),
    ...(r.transparency === 'transparent' || r.transparency === 'opaque' ? { transparency: r.transparency } : {}),
    ...(['default', 'public', 'private', 'confidential'].includes(String(r.visibility)) ? { visibility: r.visibility as GEvent['visibility'] } : {}),
    ...(att?.length ? { attendees: att } : {}),
    ...(org && typeof org.email === 'string' ? { organizer: { email: String(org.email).toLowerCase().slice(0, 254), ...(txt(org.displayName, 120) ? { displayName: txt(org.displayName, 120) } : {}), ...(org.self === true ? { self: true } : {}) } } : {}),
    ...(rem ? { reminders: { ...(rem.useDefault === true ? { useDefault: true } : {}), ...(over ? { overrides: over } : {}) } } : {}),
    ...(meet ? { meetLink: meet } : {}),
    ...(txt(r.iCalUID, 300) ? { iCalUID: txt(r.iCalUID, 300) } : {}), ...(Number.isFinite(Number(r.sequence)) ? { sequence: Number(r.sequence) } : {}),
    ...(txt(r.eventType, 40) ? { eventType: txt(r.eventType, 40) } : {}),
    ...(Object.keys(privat).length ? { privat } : {}),
  };
}

/** Die UID, unter der MAKE OS ein Google-Ereignis kennt: unsere `makeOsId`, sonst die Google-ID. */
export const uidVonEvent = (e: Pick<GEvent, 'id' | 'privat'>): string => e.privat?.makeOsId || e.id;

// ── Google-ID aus der UID ───────────────────────────────────────────────────
const B32HEX = '0123456789abcdefghijklmnopqrstuv';
/** Google erlaubt eigene Ereignis-IDs aus a–v und 0–9 (5–1024 Zeichen, base32hex): aus der UID abgeleitet → idempotent. */
export function eventIdFuer(uid: string): string {
  const b = createHash('sha1').update(uid).digest();
  let bits = 0, wert = 0, raus = '';
  for (const x of b) { wert = (wert << 8) | x; bits += 8; while (bits >= 5) { raus += B32HEX[(wert >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) raus += B32HEX[(wert << (5 - bits)) & 31];
  return `mk${raus}`;
}

// ── ICS aus Google ──────────────────────────────────────────────────────────

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, ' ');
const param = (s: string) => `"${s.replace(/["\r\n\u0000-\u001f]/g, ' ')}"`;
const ics2 = (n: number) => String(n).padStart(2, '0');

/** HTML-Beschreibung (Google erlaubt Markup) → Text: Umbrüche bleiben, Tags fallen weg. */
export function htmlZuText(s: string): string {
  if (!/<[a-z!/]/i.test(s)) return s;
  return s
    .replace(/<\s*br\s*\/?>/gi, '\n').replace(/<\/\s*(p|div|h[1-6]|tr)\s*>/gi, '\n').replace(/<\s*li[^>]*>/gi, '- ').replace(/<\/\s*li\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n').trim();
}

interface IcsZeit { wert: string; param: string }
/** Eine Google-Zeit als ICS-Wert: ganztägig `VALUE=DATE`, mit Zone `TZID=…` (Wandzeit der Zone), sonst UTC (`…Z`). */
export function icsZeit(z: GZeit | undefined, exakt = false): IcsZeit | null {
  if (!z) return null;
  if (z.date) return { param: ';VALUE=DATE', wert: z.date.replace(/-/g, '') };
  if (!z.dateTime) return null;
  const t = new Date(z.dateTime);
  if (Number.isNaN(t.getTime())) return null;
  const zone = z.timeZone ? ianaZone(z.timeZone) : null;
  const utc = `${t.getUTCFullYear()}${ics2(t.getUTCMonth() + 1)}${ics2(t.getUTCDate())}T${ics2(t.getUTCHours())}${ics2(t.getUTCMinutes())}${ics2(t.getUTCSeconds())}Z`;
  if (zone) {
    const w = wandzeitIn(t, zone);
    // Einzeltermin in der doppelten Stunde (Zeitumstellung): die Wandzeit allein ist mehrdeutig (RFC 5545: erstes Vorkommen) —
    // Google kennt den genauen Zeitpunkt (Offset), also schreiben wir ihn als UTC, damit der zweite 02:30 nicht zum ersten wird.
    if (exakt && ausWandzeitIn(w, zone).getTime() !== t.getTime()) return { param: '', wert: utc };
    return { param: `;TZID=${zone}`, wert: w.replace(/[-:]/g, '') };
  }
  return { param: '', wert: utc };
}

const ART_AUS_TYP: Record<string, IcsArt> = { outOfOffice: 'abwesend', focusTime: 'fokus', workingLocation: 'arbeitsort' };
/** Art eines Ereignisses: unsere Marke gewinnt, sonst Googles eventType, sonst normaler Termin. */
export function artVon(e: Pick<GEvent, 'privat' | 'eventType'>): IcsArt {
  const m = e.privat?.art;
  if (istIcsArt(m)) return m;
  return ART_AUS_TYP[e.eventType ?? ''] ?? 'termin';
}

const ANTWORT: Record<string, string> = { accepted: 'ACCEPTED', declined: 'DECLINED', tentative: 'TENTATIVE', needsAction: 'NEEDS-ACTION' };

function veventZeilen(e: GEvent, uid: string, o: { rid?: IcsZeit | null; serie?: boolean }): string[] | null {
  // Serien rechnen in der Wandzeit der Zone (TZID); Einzeltermine tragen den genauen Zeitpunkt, wo die Wandzeit mehrdeutig wäre.
  const s = icsZeit(e.start, !o.serie);
  if (!s) return null;
  const en = icsZeit(e.end, !o.serie);
  const z: string[] = ['BEGIN:VEVENT', `UID:${esc(uid)}`];
  const stempel = e.updated && !Number.isNaN(Date.parse(e.updated)) ? new Date(e.updated) : new Date(0);
  z.push(`DTSTAMP:${stempel.getUTCFullYear()}${ics2(stempel.getUTCMonth() + 1)}${ics2(stempel.getUTCDate())}T${ics2(stempel.getUTCHours())}${ics2(stempel.getUTCMinutes())}${ics2(stempel.getUTCSeconds())}Z`);
  if (o.rid) z.push(`RECURRENCE-ID${o.rid.param}:${o.rid.wert}`);
  z.push(`DTSTART${s.param}:${s.wert}`);
  if (en) z.push(`DTEND${en.param}:${en.wert}`);
  z.push(`SUMMARY:${esc((e.summary ?? '').trim() || '(ohne Titel)')}`);
  if (e.description) z.push(`DESCRIPTION:${esc(htmlZuText(e.description))}`);
  if (e.location) z.push(`LOCATION:${esc(e.location)}`);
  z.push(`STATUS:${e.status === 'tentative' ? 'TENTATIVE' : e.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'}`);
  z.push(`TRANSP:${e.transparency === 'transparent' ? 'TRANSPARENT' : 'OPAQUE'}`);
  if (e.visibility === 'private' || e.visibility === 'confidential') z.push('CLASS:PRIVATE');
  else if (e.visibility === 'public') z.push('CLASS:PUBLIC');
  const art = artVon(e);
  if (art !== 'termin') z.push(`X-MAKE-ART:${art}`);
  if (art === 'block' && istBlockArt(e.privat?.blockArt)) z.push(`X-MAKE-BLOCK:${e.privat!.blockArt}`);
  const farbe = farbeSauber(e.privat?.farbe);
  if (farbe) z.push(`COLOR:${farbe}`);
  if (e.meetLink) z.push(`URL:${e.meetLink}`);
  // Organisator und Gäste nur bei Terminen MIT Gästen (Google nennt den Organisator auch bei Einzeltermin — dort wäre er Rauschen).
  const gaeste = (e.attendees ?? []).filter(a => !a.resource);
  if (gaeste.length) {
    const org = e.organizer?.email ?? gaeste.find(a => a.organizer)?.email;
    if (org) z.push(`ORGANIZER${e.organizer?.displayName ? `;CN=${param(e.organizer.displayName)}` : ''}:mailto:${org}`);
    for (const a of gaeste) z.push(`ATTENDEE${a.displayName ? `;CN=${param(a.displayName)}` : ''};PARTSTAT=${ANTWORT[a.responseStatus ?? 'needsAction'] ?? 'NEEDS-ACTION'}${a.optional ? ';ROLE=OPT-PARTICIPANT' : ''}:mailto:${a.email}`);
  }
  for (const m of e.reminders?.overrides ?? []) {
    z.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc((e.summary ?? 'Termin').slice(0, 80))}`, `TRIGGER:${m.minutes <= 0 ? 'PT0S' : `-PT${m.minutes}M`}`, 'END:VALARM');
  }
  z.push('END:VEVENT');
  return z;
}

/** Zeilen EXDATE/RDATE/RRULE aus `recurrence` (Google schreibt sie schon als iCalendar-Zeilen). */
function serienZeilen(e: GEvent): string[] {
  return (e.recurrence ?? []).filter(l => !/^EXRULE/i.test(l)).map(l => l.replace(/[\u0000-\u001f\u007f]/g, ' '));
}

/** Ein abgesagtes Vorkommen als EXDATE — im Wertformat des Master-Beginns (Datum, Zone, UTC). */
function exdateZeile(orig: GZeit | undefined): string | null {
  const t = icsZeit(orig);
  return t ? `EXDATE${t.param}:${t.wert}` : null;
}

/**
 * Das iCalendar-Objekt einer Serie bzw. eines Einzeltermins: `master` + seine Ausnahmen (verschobene/geänderte als
 * RECURRENCE-ID-Ereignis, abgesagte als EXDATE). null, wenn der Master keinen Beginn hat (kaputt) oder abgesagt ist.
 */
export function objektIcs(master: GEvent, ausnahmen: readonly GEvent[]): string | null {
  if (master.status === 'cancelled') return null;
  const uid = uidVonEvent(master);
  const z = veventZeilen(master, uid, { serie: !!master.recurrence?.length });
  if (!z) return null;
  const serie = !!master.recurrence?.length;
  const zeilen: string[] = [];
  if (serie) {
    // Serienzeilen hinter DTSTART/DTEND einfügen: vor END:VEVENT, nach STATUS usw. — die Reihenfolge ist im ICS frei.
    const ende = z.lastIndexOf('END:VEVENT');
    const extra = serienZeilen(master);
    for (const x of ausnahmen) if (x.status === 'cancelled') { const l = exdateZeile(x.originalStartTime); if (l) extra.push(l); }
    z.splice(ende, 0, ...extra);
  }
  zeilen.push(...z);
  if (serie) {
    for (const x of ausnahmen) {
      if (x.status === 'cancelled') continue;
      const rid = icsZeit(x.originalStartTime);
      if (!rid) continue;
      const ex = veventZeilen(x, uid, { rid, serie: false });
      if (ex) zeilen.push(...ex);
    }
  }
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MAKE OS//Google Kalender//DE', 'CALSCALE:GREGORIAN', ...zeilen, 'END:VCALENDAR'].join('\r\n');
}

export interface GruppeKurz { masterId: string; uid: string; ics: string; etag: string; href: string }

/**
 * Alle Ereignisse eines Kalenders → Objekte (ein Objekt je Master/Einzeltermin, Ausnahmen darin). `href` =
 * `google://<person>/<masterId>` — nur eine Kennung, nie ein Aufruf. `etag` = Googles ETag des Masters (Einzeltermin:
 * genau der Stand für If-Match); bei Serien zusätzlich ein Hash der Ausnahmen (ändert sich, wenn eine ändert).
 */
export function objekteAus(events: Readonly<Record<string, GEvent>>, person: string): { objekte: KalenderObjekt[]; kurz: GruppeKurz[] } {
  const nachMaster = new Map<string, GEvent[]>();
  const alle = Object.values(events);
  const masterIds = new Set(alle.filter(e => !e.recurringEventId).map(e => e.id));
  for (const e of alle) {
    if (!e.recurringEventId || !masterIds.has(e.recurringEventId)) continue;
    const l = nachMaster.get(e.recurringEventId) ?? [];
    l.push(e);
    nachMaster.set(e.recurringEventId, l);
  }
  const objekte: KalenderObjekt[] = [];
  const kurz: GruppeKurz[] = [];
  for (const e of alle) {
    // Verwaiste Ausnahme (Master liegt außerhalb des Holfensters): als eigener Einzeltermin zeigen.
    const eigen = e.recurringEventId && !masterIds.has(e.recurringEventId) ? { ...e, recurringEventId: undefined, recurrence: undefined } : e;
    if (eigen.recurringEventId) continue;
    const ausn = nachMaster.get(e.id) ?? [];
    const ics = objektIcs(eigen, ausn);
    if (!ics) continue;
    const etag = ausn.length ? `${e.etag ?? ''}+${fnv(ausn.map(x => `${x.id}:${x.etag ?? x.updated ?? ''}`).sort().join('|'))}` : (e.etag ?? `u${fnv(e.updated ?? e.id)}`);
    const href = `google://${person}/${encodeURIComponent(e.id)}`;
    objekte.push({ href, etag, ics });
    kurz.push({ masterId: e.id, uid: uidVonEvent(e), ics, etag, href });
  }
  return { objekte, kurz };
}

// ── MAKE OS → Google ────────────────────────────────────────────────────────

export type NeuEingabeG = Omit<NeuerTermin, 'uid' | 'organisator'> & { uid: string };

const sauber = (s: string, n: number) => s.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, ' ').trim().slice(0, n);

/** Wandzeit „YYYY-MM-DDTHH:mm(:ss)“ → Google-Zeit in einer Zone (die Wandzeit bleibt, Google kennt die Zone). */
export function gZeitAus(wand: string, ganztags: boolean, zone: string): GZeit {
  if (ganztags) return { date: wand.slice(0, 10) };
  return { dateTime: `${wand.slice(0, 16)}:00`, timeZone: ianaZone(zone) ?? STANDARD_ZONE };
}

function privatAus(art: IcsArt, blockArt: BlockArt | undefined, farbe: string | undefined, uid: string): Record<string, string> {
  return { makeOsId: uid, ...(art !== 'termin' ? { art } : {}), ...(art === 'block' && blockArt ? { blockArt } : {}), ...(farbe ? { farbe } : {}) };
}

export interface GBody {
  id?: string; summary?: string | null; description?: string | null; location?: string | null;
  start?: GZeit; end?: GZeit; recurrence?: string[];
  transparency?: 'opaque' | 'transparent'; visibility?: 'default' | 'public' | 'private';
  reminders?: { useDefault: boolean; overrides: { method: 'popup'; minutes: number }[] };
  attendees?: { email: string; displayName?: string; responseStatus?: string }[];
  extendedProperties?: { private: Record<string, string | null> };
}

/** Körper für events.insert. Gäste (`gaeste`) nur, wenn der Aufrufer die Einladung bestätigt hat — das prüft die Route. */
export function neuBody(t: NeuEingabeG, beschaeftigtStandard: boolean): GBody {
  const art: IcsArt = t.art ?? 'termin';
  const titel = art === 'arbeitsort' && t.arbeitsort ? arbeitsortTitel(t.arbeitsort) : t.titel;
  const zone = t.zone ?? STANDARD_ZONE;
  const zoneE = !t.ganztags && t.endZone ? t.endZone : zone;
  const min = erinnerungenSauber([...(t.erinnerungenMin ?? []), ...(t.erinnerungMin !== undefined && t.erinnerungMin >= 0 ? [t.erinnerungMin] : [])]);
  const farbe = t.farbe ? farbeSauber(t.farbe) : undefined;
  return {
    id: eventIdFuer(t.uid),
    summary: sauber(titel, 300) || 'Termin',
    ...(t.notiz ? { description: sauber(t.notiz, 8000) } : {}),
    ...(t.ort ? { location: sauber(t.ort, 300) } : {}),
    start: gZeitAus(t.start, !!t.ganztags, zone),
    end: gZeitAus(t.ende, !!t.ganztags, zoneE),
    ...(t.wiederholung ? { recurrence: [`RRULE:${rruleText(t.wiederholung, !!t.ganztags, zone)}`] } : {}),
    transparency: (t.beschaeftigt ?? beschaeftigtStandard) ? 'opaque' : 'transparent',
    visibility: t.sichtbarkeit === 'privat' ? 'private' : t.sichtbarkeit === 'oeffentlich' ? 'public' : 'default',
    reminders: { useDefault: false, overrides: min.map(m => ({ method: 'popup' as const, minutes: m })) },
    ...(t.gaeste?.length ? { attendees: t.gaeste.map(g => ({ email: g.email, ...(g.name ? { displayName: sauber(g.name, 120) } : {}) })) } : {}),
    extendedProperties: { private: privatAus(art, t.blockArt, farbe, t.uid) },
  };
}

/**
 * Körper für events.patch aus einer `Aenderung` — nur, was sich ändert. `bisher` = das gespeicherte Ereignis (für Zone,
 * ganztägig und die Gästeliste: Antworten bleiben, wo die Adresse schon eingeladen war).
 */
export function patchBody(a: Aenderung, bisher: GEvent): GBody {
  const b: GBody = {};
  const ganztags = !!bisher.start?.date;
  if (a.titel !== undefined) b.summary = sauber(a.titel, 300) || 'Termin';
  if (a.ort !== undefined) b.location = a.ort === null ? null : sauber(a.ort, 300);
  if (a.notiz !== undefined) b.description = a.notiz === null ? null : sauber(a.notiz, 8000);
  if (a.start !== undefined || a.ende !== undefined) {
    // Die Oberfläche arbeitet in Berliner Wandzeit — geänderte Zeiten gehen in genau dieser Zone zu Google (ein Termin in
    // einer anderen Zone wechselt damit auf Berlin; Beginn und Ende werden beim Verschieben immer zusammen geschickt).
    if (a.start !== undefined) b.start = gZeitAus(a.start, ganztags, STANDARD_ZONE);
    if (a.ende !== undefined) b.end = gZeitAus(a.ende, ganztags, STANDARD_ZONE);
  }
  if (a.beschaeftigt !== undefined) b.transparency = a.beschaeftigt ? 'opaque' : 'transparent';
  if (a.sichtbarkeit !== undefined) b.visibility = a.sichtbarkeit === 'privat' ? 'private' : a.sichtbarkeit === 'oeffentlich' ? 'public' : 'default';
  const p: Record<string, string | null> = {};
  if (a.art !== undefined) p.art = a.art === 'termin' ? null : a.art;
  if (a.blockArt !== undefined) p.blockArt = a.blockArt;
  if (a.farbe !== undefined) p.farbe = a.farbe === null ? null : farbeSauber(a.farbe) ?? null;
  if (Object.keys(p).length) b.extendedProperties = { private: p };
  if (a.gaeste !== undefined) {
    const alt = new Map((bisher.attendees ?? []).map(x => [x.email, x]));
    const eigene = (bisher.attendees ?? []).filter(x => x.self || x.organizer).map(x => x.email);
    const liste = a.gaeste.map(g => { const v = alt.get(g.email.toLowerCase()); return { email: g.email.toLowerCase(), ...(g.name || v?.displayName ? { displayName: sauber(g.name ?? v?.displayName ?? '', 120) } : {}), ...(v?.responseStatus ? { responseStatus: v.responseStatus } : {}) }; });
    // Die eigene Adresse (Organisator) bleibt in der Liste, sobald es Gäste gibt — sonst fiele der Organisator als Teilnehmer heraus.
    for (const e of eigene) if (liste.length && !liste.some(x => x.email === e)) liste.push({ email: e, responseStatus: alt.get(e)?.responseStatus ?? 'accepted' });
    b.attendees = liste;
  }
  return b;
}

/** Die Gästeliste mit geänderter eigener Antwort (zusagen/absagen/vielleicht) — Rest unverändert. */
export function antwortBody(bisher: GEvent, ich: readonly string[], status: 'zugesagt' | 'abgesagt' | 'vielleicht'): GBody {
  const g = status === 'zugesagt' ? 'accepted' : status === 'abgesagt' ? 'declined' : 'tentative';
  return { attendees: (bisher.attendees ?? []).map(x => ({ email: x.email, ...(x.displayName ? { displayName: x.displayName } : {}), responseStatus: x.self || ich.includes(x.email) ? g : x.responseStatus ?? 'needsAction' })) };
}

/** Sichtbarkeit aus Google für die Anzeige. */
export const sichtbarkeitVon = (e: Pick<GEvent, 'visibility'>): Sichtbarkeit => (e.visibility === 'private' || e.visibility === 'confidential' ? 'privat' : e.visibility === 'public' ? 'oeffentlich' : 'standard');
