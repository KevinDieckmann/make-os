// ─── Kalender — iCalendar lesen und schreiben (rein, getestet) ──────────────
// Termine kommen als iCalendar-Text aus iCloud. ical.js (Mozilla/Thunderbird)
// rechnet Serien, Ausnahmen und Zeitzonen — das ist der Teil, der von Hand
// gebaut immer irgendwann falsch wäre. Hier: aus Objekten Termine für einen
// Zeitraum machen, neue Termine bauen, bestehende verschieben.
//
// Was MAKE OS bewusst NICHT ändert (nur in Apple): Serientermine und Termine
// mit Teilnehmern — bei denen würde iCloud Einladungen verschicken, und
// MAKE OS versendet nie etwas.

import ICAL from 'ical.js';
import { wandzeit, ausWandzeit, ZONE } from './zeit';

export interface KalenderObjekt { href: string; etag?: string; ics: string }
export interface KalenderInfo { id: string; name: string; farbe?: string; schreibbar?: boolean }

export interface Termin {
  /** uid, bei Serien uid::Vorkommen */
  id: string;
  uid: string;
  href: string;
  titel: string;
  /** Berliner Wandzeit YYYY-MM-DDTHH:mm:ss; ganztags 00:00, Ende exklusiv */
  start: string;
  ende: string;
  ganztags: boolean;
  kalender: string;
  kalenderId: string;
  farbe?: string;
  ort?: string;
  notiz?: string;
  serie: boolean;
  mitTeilnehmern: boolean;
  /** In MAKE OS verschieben/umbenennen/löschen erlaubt */
  bearbeitbar: boolean;
}

// Europe/Berlin einmal fest hinterlegen — falls ein Objekt seine Zone nicht mitliefert.
const BERLIN_VTZ = `BEGIN:VCALENDAR
BEGIN:VTIMEZONE
TZID:Europe/Berlin
BEGIN:DAYLIGHT
TZOFFSETFROM:+0100
TZOFFSETTO:+0200
TZNAME:CEST
DTSTART:19700329T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:+0200
TZOFFSETTO:+0100
TZNAME:CET
DTSTART:19701025T030000
RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU
END:STANDARD
END:VTIMEZONE
END:VCALENDAR`;
let berlinDa = false;
function berlin(): ICAL.Timezone {
  if (!berlinDa) {
    const vtz = new ICAL.Component(ICAL.parse(BERLIN_VTZ)).getFirstSubcomponent('vtimezone')!;
    ICAL.TimezoneService.register(vtz);
    berlinDa = true;
  }
  return ICAL.TimezoneService.get(ZONE)!;
}

const tagText = (t: ICAL.Time) => `${t.year}-${String(t.month).padStart(2, '0')}-${String(t.day).padStart(2, '0')}`;

/** Ein ical.js-Zeitpunkt als Berliner Wandzeit (ganztags: Datum 00:00). */
function alsWand(t: ICAL.Time): string {
  if (t.isDate) return `${tagText(t)}T00:00:00`;
  return wandzeit(t.toJSDate());
}

function parse(ics: string): ICAL.Component | null {
  try {
    berlin();
    const comp = new ICAL.Component(ICAL.parse(ics));
    for (const tz of comp.getAllSubcomponents('vtimezone')) {
      const id = tz.getFirstPropertyValue('tzid');
      if (typeof id === 'string' && !ICAL.TimezoneService.has(id)) ICAL.TimezoneService.register(tz);
    }
    return comp;
  } catch { return null; }
}

const kurz = (v: unknown, n: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : undefined);

/**
 * Alle Termine eines Objekts, die in [von, bis) liegen (Berliner Tage
 * YYYY-MM-DD). Serien werden aufgefaltet, Ausnahmen (verschobene oder
 * gestrichene Vorkommen) berücksichtigt.
 */
export function termineAus(obj: KalenderObjekt, kal: KalenderInfo, von: string, bis: string): Termin[] {
  const comp = parse(obj.ics);
  if (!comp) return [];
  const vevents = comp.getAllSubcomponents('vevent');
  const master = vevents.find(v => !v.hasProperty('recurrence-id')) ?? vevents[0];
  if (!master) return [];
  const ev = new ICAL.Event(master);
  const serie = ev.isRecurring();
  if (serie) for (const x of vevents) if (x !== master && x.hasProperty('recurrence-id')) ev.relateException(x);
  const mitTeilnehmern = vevents.some(v => v.hasProperty('attendee'));
  const vonT = ausWandzeit(`${von}T00:00:00`).getTime();
  const bisT = ausWandzeit(`${bis}T00:00:00`).getTime();
  const raus: Termin[] = [];

  const fuege = (e: ICAL.Event, start: ICAL.Time, ende: ICAL.Time, rid?: ICAL.Time) => {
    const s = alsWand(start);
    const en = alsWand(ende && ende.compare(start) > 0 ? ende : start);
    const sT = start.isDate ? ausWandzeit(s).getTime() : start.toJSDate().getTime();
    const eT = start.isDate ? ausWandzeit(en).getTime() : (ende ?? start).toJSDate().getTime();
    // Überlappt den Zeitraum? (ganztägige und Null-Dauer-Termine zählen am Starttag)
    if (!(sT < bisT && (eT > vonT || (eT === sT && sT >= vonT)))) return;
    raus.push({
      id: rid ? `${ev.uid}::${rid.toString()}` : ev.uid, uid: ev.uid, href: obj.href,
      titel: kurz(e.summary, 300) ?? '(ohne Titel)', start: s, ende: en, ganztags: start.isDate,
      kalender: kal.name, kalenderId: kal.id, farbe: kal.farbe,
      ort: kurz(e.location, 300), notiz: kurz(e.description, 2000),
      serie, mitTeilnehmern,
      bearbeitbar: !serie && !mitTeilnehmern && kal.schreibbar !== false,
    });
  };

  if (!serie) {
    fuege(ev, ev.startDate, ev.endDate);
    return raus;
  }
  // Serie: vom Serienbeginn bis zum Zeitraumende aufzählen (gedeckelt).
  const it = ev.iterator();
  const grenze = ICAL.Time.fromJSDate(new Date(bisT), true);
  // Vorkommen weit vor dem Zeitraum nur überspringen (verschobene Ausnahmen haben eine Woche Luft).
  const ab = ICAL.Time.fromJSDate(new Date(vonT - 7 * 86_400_000), true);
  let n: ICAL.Time | null;
  let schritte = 0;
  while ((n = it.next()) && schritte++ < 60_000) {
    if (n.compare(grenze) >= 0) break;
    if (n.compare(ab) < 0) continue;
    const o = ev.getOccurrenceDetails(n);
    fuege(o.item, o.startDate, o.endDate, o.recurrenceId);
  }
  return raus;
}

/** UID eines Objekts — ohne Auffalten (auch bei langen Serien billig). */
export function uidVon(ics: string): string | undefined {
  return /^UID(?:;[^:\r\n]*)?:(.+)$/m.exec(ics.replace(/\r?\n[ \t]/g, ''))?.[1]?.trim();
}

/** Darf MAKE OS dieses Objekt ändern oder löschen? null = ja, sonst der Grund. */
export function nichtBearbeitbar(ics: string): string | null {
  // Nur die Termine selbst ansehen: Zeitzonen haben eigene RRULEs, Alarme eigene ATTENDEEs.
  const glatt = (ics.replace(/\r?\n[ \t]/g, '').match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) ?? [])
    .map(v => v.replace(/BEGIN:VALARM[\s\S]*?END:VALARM/g, '')).join('\n');
  if (/^(RRULE|RDATE|RECURRENCE-ID)[;:]/m.test(glatt)) return 'Serientermin — bitte in Apple Kalender ändern.';
  if (/^ATTENDEE[;:]/m.test(glatt)) return 'Termin mit Teilnehmern — bitte in Apple Kalender ändern (dort gehen die Einladungen raus).';
  return null;
}

/** Text für eine iCalendar-Eigenschaft: ohne Steuerzeichen, begrenzt. */
const sauber = (s: string, n: number) => s.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, ' ').trim().slice(0, n);

export interface NeuerTermin {
  uid: string;
  titel: string;
  /** Berliner Wandzeit; ganztags: Tag 00:00, Ende exklusiv (Folgetag) */
  start: string;
  ende: string;
  ganztags?: boolean;
  ort?: string;
  notiz?: string;
}

function zeitFuer(wand: string, ganztags: boolean): ICAL.Time {
  if (ganztags) {
    const [j, m, t] = wand.slice(0, 10).split('-').map(Number);
    return ICAL.Time.fromData({ year: j, month: m, day: t, isDate: true });
  }
  return ICAL.Time.fromJSDate(ausWandzeit(wand), true).convertToZone(berlin());
}

function setzeZeit(v: ICAL.Component, name: 'dtstart' | 'dtend', t: ICAL.Time) {
  v.removeAllProperties(name);
  const p = new ICAL.Property(name, v);
  p.setValue(t); // ical.js setzt VALUE=DATE bei ganztägigen Werten selbst
  if (!t.isDate && t.zone && t.zone.tzid && !['UTC', 'floating'].includes(t.zone.tzid)) p.setParameter('tzid', t.zone.tzid);
  v.addProperty(p);
}

function mitBerlinZone(comp: ICAL.Component) {
  if (!comp.getAllSubcomponents('vtimezone').some(z => z.getFirstPropertyValue('tzid') === ZONE)) {
    comp.addSubcomponent(new ICAL.Component(ICAL.parse(BERLIN_VTZ)).getFirstSubcomponent('vtimezone')!);
  }
}

/** Ein neuer Termin als iCalendar-Text (ohne Teilnehmer — MAKE OS lädt niemanden ein). */
export function baueTermin(t: NeuerTermin, jetzt = new Date()): string {
  berlin();
  const cal = new ICAL.Component(['vcalendar', [], []]);
  cal.updatePropertyWithValue('version', '2.0');
  cal.updatePropertyWithValue('prodid', '-//MAKE OS//Kalender//DE');
  cal.updatePropertyWithValue('calscale', 'GREGORIAN');
  const v = new ICAL.Component('vevent');
  v.updatePropertyWithValue('uid', t.uid);
  const stempel = ICAL.Time.fromJSDate(jetzt, true);
  v.updatePropertyWithValue('dtstamp', stempel);
  v.updatePropertyWithValue('created', stempel);
  v.updatePropertyWithValue('last-modified', stempel);
  v.updatePropertyWithValue('summary', sauber(t.titel, 300) || 'Termin');
  setzeZeit(v, 'dtstart', zeitFuer(t.start, !!t.ganztags));
  setzeZeit(v, 'dtend', zeitFuer(t.ende, !!t.ganztags));
  if (t.ort) v.updatePropertyWithValue('location', sauber(t.ort, 300));
  if (t.notiz) v.updatePropertyWithValue('description', sauber(t.notiz, 2000));
  if (!t.ganztags) mitBerlinZone(cal);
  cal.addSubcomponent(v);
  return cal.toString();
}

export interface Aenderung { titel?: string; start?: string; ende?: string; ort?: string | null; notiz?: string | null }

/**
 * Einen bestehenden Einzeltermin ändern — alles andere (Alarme, Notizen,
 * Anhänge, Apple-Felder) bleibt, wie es ist. Serien und Termine mit
 * Teilnehmern: Fehler (nur in Apple ändern).
 */
export function aendereTermin(ics: string, a: Aenderung, jetzt = new Date()): { ics: string } | { fehler: string } {
  const comp = parse(ics);
  if (!comp) return { fehler: 'Der Termin ließ sich nicht lesen.' };
  const vevents = comp.getAllSubcomponents('vevent');
  if (vevents.length !== 1) return { fehler: 'Serientermin — bitte in Apple Kalender ändern.' };
  const v = vevents[0];
  if (v.hasProperty('rrule') || v.hasProperty('rdate') || v.hasProperty('recurrence-id')) return { fehler: 'Serientermin — bitte in Apple Kalender ändern.' };
  if (v.hasProperty('attendee')) return { fehler: 'Termin mit Teilnehmern — bitte in Apple Kalender ändern (dort gehen die Einladungen raus).' };
  const ev = new ICAL.Event(v);
  const ganztags = ev.startDate.isDate;
  if (a.titel !== undefined) v.updatePropertyWithValue('summary', sauber(a.titel, 300) || 'Termin');
  if (a.ort !== undefined) { if (a.ort) v.updatePropertyWithValue('location', sauber(a.ort, 300)); else v.removeAllProperties('location'); }
  if (a.notiz !== undefined) { if (a.notiz) v.updatePropertyWithValue('description', sauber(a.notiz, 2000)); else v.removeAllProperties('description'); }
  if (a.start || a.ende) {
    // Ohne neues Ende: Dauer bleibt. Die Zone des Termins bleibt, wenn es eine gibt.
    const altS = ev.startDate, altE = ev.endDate ?? ev.startDate;
    const dauerMs = ganztags ? 0 : altE.toJSDate().getTime() - altS.toJSDate().getTime();
    const neuS = a.start ? zeitFuer(a.start, ganztags) : altS;
    let neuE: ICAL.Time;
    if (a.ende) neuE = zeitFuer(a.ende, ganztags);
    else if (ganztags) { neuE = neuS.clone(); const tage = altE.subtractDate(altS).toSeconds() / 86400; neuE.adjust(Math.max(1, Math.round(tage)), 0, 0, 0); }
    else neuE = ICAL.Time.fromJSDate(new Date(neuS.toJSDate().getTime() + dauerMs), true).convertToZone(berlin());
    if (neuE.compare(neuS) <= 0) return { fehler: 'Das Ende liegt vor dem Anfang.' };
    const zone = !ganztags && altS.zone && altS.zone.tzid && !['UTC', 'floating'].includes(altS.zone.tzid) ? altS.zone : null;
    setzeZeit(v, 'dtstart', zone ? neuS.convertToZone(zone) : neuS);
    setzeZeit(v, 'dtend', zone ? neuE.convertToZone(zone) : neuE);
    v.removeAllProperties('duration');
    if (!ganztags && (!zone || zone.tzid === ZONE)) mitBerlinZone(comp);
  }
  const stempel = ICAL.Time.fromJSDate(jetzt, true);
  v.updatePropertyWithValue('dtstamp', stempel);
  v.updatePropertyWithValue('last-modified', stempel);
  const seq = Number(v.getFirstPropertyValue('sequence') ?? 0);
  v.updatePropertyWithValue('sequence', (Number.isFinite(seq) ? seq : 0) + 1);
  return { ics: comp.toString() };
}
