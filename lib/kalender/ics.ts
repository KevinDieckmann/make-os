// ─── Kalender — iCalendar lesen und schreiben (rein, getestet) ──────────────
// Termine kommen als iCalendar-Text aus iCloud. ical.js (Mozilla/Thunderbird)
// rechnet Serien, Ausnahmen und Zeitzonen — das ist der Teil, der von Hand
// gebaut immer irgendwann falsch wäre. Hier: aus Objekten Termine für einen
// Zeitraum machen, neue Termine bauen, bestehende verschieben.
//
// Was MAKE OS bewusst NICHT ändert (nur in Apple): Serientermine.
// Gäste (K3, 30.09., Kevin: „Echte Einladung nach Klick“): ein Termin mit Gästen trägt ORGANIZER (das iCloud-Konto)
// und je Gast ein ATTENDEE mit SCHEDULE-AGENT=SERVER — iCloud verschickt Einladung, Änderung und Absage. Geschrieben
// wird das NUR nach einer ausdrücklichen Bestätigung in der Oberfläche (die Route erzwingt sie: `einladungBestaetigt`).
// Sind wir Gast (ORGANIZER ist jemand anderes), ändern wir nichts am Termin — nur die eigene Antwort (PARTSTAT),
// ebenfalls erst nach Klick (`antwortSetzen`).
//
// Seit 29.09. (K1, Google-Vorbild) trägt ein Termin auch — und NUR diese Standard-/
// Nahezu-Standard-Eigenschaften (Datenregel KALENDER_VERBINDUNGEN.md 4a): Art (X-MAKE-ART),
// eigene Farbe (COLOR, RFC 7986), frei/beschäftigt (TRANSP), Sichtbarkeit (CLASS), Zeitzone
// (TZID + VTIMEZONE aus lib/kalender/zeitzone.ts), mehrere Erinnerungen (VALARM). Der
// Arbeitsort steht im Titel („Home“, „Büro“ …). Bezüge zu MAKE OS (Aufgabe, Mandat,
// Kontakt …) stehen NIE im Termin, nur im Neben-Bestand `kalender-bezug` (lib/kalender/bezug.ts).

import ICAL from 'ical.js';
import { wandzeit, ausWandzeit, tagPlus, ZONE } from './zeit';
import { kalenderKennung, terminSchluessel } from './bezug';
import { rruleText, type Wiederholung } from './wiederholung';
import { istIcsArt, istBlockArt, beschaeftigtStandard, farbeSauber, farbeHex, arbeitsortAusTitel, arbeitsortTitel, erinnerungenSauber, istSichtbarkeit, type IcsArt, type BlockArt, type Sichtbarkeit, type Arbeitsort } from './arten';
import { vtimezoneText, ausWandzeitIn, wandzeitIn, ianaZone } from './zeitzone';
import { adresseAus, type Teilnahme, type Teilnehmer, type Gast } from './gaeste';

export { rruleText };
export type { Wiederholung, WiederholungFreq } from './wiederholung';
export { adresseAus, TEILNAHMEN, type Teilnahme, type Teilnehmer, type Gast } from './gaeste';

export interface KalenderObjekt { href: string; etag?: string; ics: string }
const PARTSTAT: Record<Exclude<Teilnahme, 'offen'>, string> = { zugesagt: 'ACCEPTED', abgesagt: 'DECLINED', vielleicht: 'TENTATIVE' };
export interface KalenderInfo { id: string; name: string; farbe?: string; schreibbar?: boolean }

export interface Termin {
  /**
   * Schlüssel: Kalender-Kennung + UID, bei Serien + Vorkommen — `kalender|uid` bzw. `kalender|uid::RID` (R-K1 #46:
   * dieselbe UID kann in zwei Kalendern stehen). Für Ändern/Löschen/Bezug: `objektSchluessel` (lib/kalender/bezug.ts).
   */
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
  // ── seit 29.09. (K1) ──
  /** Art (X-MAKE-ART) — ohne Angabe „termin“. */
  art: IcsArt;
  /** Eigene Farbe des Termins (COLOR) als #RRGGBB — sonst gilt `farbe` (die des Kalenders). */
  farbeEigen?: string;
  /** Die gespeicherte Farb-Kennung (CSS3-Name der Palette oder Hex) — zum Wiederschreiben. */
  farbeId?: string;
  /** Beschäftigt (TRANSP:OPAQUE) oder frei (TRANSPARENT); ohne Angabe nach Art/ganztags. */
  beschaeftigt: boolean;
  /** CLASS: privat → in geteilten Sichten nur „Belegt“ für die andere Person. */
  sichtbarkeit: Sichtbarkeit;
  /** TZID des Beginns, wenn nicht Europe/Berlin (Anzeige „GMT-04“). */
  zone?: string;
  /** Erinnerungen in Minuten vor Beginn (relative VALARM-Auslöser). */
  erinnerungen?: number[];
  /** Nur Art „arbeitsort“: der Ort, gelesen aus dem Titel. */
  arbeitsort?: Arbeitsort;
  /** Nur Art „block“ (K5): Unterart aus X-MAKE-BLOCK (reha, routine, pause, aufgabe) — ohne = „Block“. */
  blockArt?: BlockArt;
  /** ETag des iCloud-Objekts — der Stand für Änderungen (veraltet → 409 statt still überschreiben). */
  stand?: string;
  // ── seit 30.09. (K3) ──
  /** Gäste (ATTENDEE) ohne das eigene Konto — mit ihrer Antwort (PARTSTAT). */
  teilnehmer?: Teilnehmer[];
  /** Wer eingeladen hat (ORGANIZER). */
  organisator?: { email: string; name?: string };
  /** Wir haben eingeladen (ORGANIZER = eine Adresse des iCloud-Kontos) — dann nach Bestätigung änderbar. */
  ichOrganisator?: boolean;
  /** Wir sind Gast: unsere Antwort (PARTSTAT der eigenen Adresse — die „eigene Antwort“; nur Zusagen/Absagen, nach Klick). */
  meineAntwort?: Teilnahme;
  // ── seit R-K1 (#68, #1) ──
  /** STATUS des VEVENT, wenn angegeben: bestätigt (CONFIRMED), vorläufig (TENTATIVE — belegt trotzdem), abgesagt (CANCELLED). */
  status?: 'bestaetigt' | 'vorlaeufig' | 'abgesagt';
  /** Abgesagt (STATUS:CANCELLED) oder von uns abgelehnt (eigene Antwort DECLINED): belegt nicht, zählt im CRM nicht. */
  abgesagt?: true;
  /** Beginn als echter Zeitpunkt (ms, UTC) — sortiert richtig auch in der doppelten Stunde am 25.10. */
  startMs?: number;
}

/** Was ein VEVENT selbst über Art, Farbe und Sichtbarkeit sagt (X-MAKE-ART, COLOR, CLASS). */
export interface IcsZusatz { art?: IcsArt; farbe?: string; sichtbarkeit?: Sichtbarkeit; /** K5: X-MAKE-BLOCK */ blockArt?: BlockArt }

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

const zwei = (n: number) => String(n).padStart(2, '0');
/** Die Wandzeit eines ical.js-Werts, wie sie im Text steht (ohne Umrechnung). */
const wandText = (t: ICAL.Time) => `${tagText(t)}T${zwei(t.hour)}:${zwei(t.minute)}:${zwei(t.second)}`;

/**
 * Der Zeitpunkt eines ical.js-Werts (R-K1 #4/#5/#6): Wandzeit in IANA-Zonen (auch Windows-Namen und Präfixe) über
 * Intl aufgelöst — mehrdeutig = erstes Vorkommen, Lücke = vorwärts (RFC 5545 3.3.5), NICHT über ical.js `toJSDate`
 * (das legt die doppelte Stunde auf das zweite Vorkommen). Floating = Berliner Wandzeit, unabhängig von der Zone der
 * Maschine. UTC direkt. Nur eine unbekannte Zone mit eingebetteter VTIMEZONE rechnet ical.js.
 */
function zeitpunkt(t: ICAL.Time): number {
  if (t.isDate) return ausWandzeit(`${tagText(t)}T00:00:00`).getTime();
  const tzid = t.zone?.tzid;
  if (tzid === 'UTC' || tzid === 'Z') return t.toJSDate().getTime();
  if (!tzid || tzid === 'floating') return ausWandzeit(wandText(t)).getTime();
  const iana = ianaZone(tzid);
  if (iana === 'UTC') return Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute, t.second);
  if (iana) return ausWandzeitIn(wandText(t), iana).getTime();
  return t.toJSDate().getTime();
}

/** Ein ical.js-Zeitpunkt als Berliner Wandzeit (ganztags: Datum 00:00). */
function alsWand(t: ICAL.Time): string {
  if (t.isDate) return `${tagText(t)}T00:00:00`;
  const tzid = t.zone?.tzid;
  // Berlin und floating: die Wandzeit steht schon da (nur eine Uhrzeit aus der Lücke Ende März rückt vor).
  if ((!tzid || tzid === 'floating' || ianaZone(tzid) === ZONE) && t.hour !== 2) return wandText(t);
  return wandzeit(new Date(zeitpunkt(t)));
}

/** Die IANA-Zone eines Werts für die Anzeige (nur, wenn nicht Berlin/UTC/floating). */
function anzeigeZone(t: ICAL.Time): string | undefined {
  if (t.isDate) return undefined;
  const iana = ianaZone(t.zone?.tzid);
  return iana && iana !== 'UTC' && iana !== ZONE ? iana : undefined;
}

/** Die Zonendaten der Laufzeit (Intl) einmal je Prozess und Name registrieren — unter dem Namen, der im Termin steht. */
const ianaRegistriert = new Set<string>();
function ianaRegistrieren(tzid: string, iana: string) {
  if (ianaRegistriert.has(tzid) || iana === 'UTC') return;
  const text = vtimezoneText(iana, new Date().getUTCFullYear()).replace(`TZID:${iana}`, `TZID:${tzid.replace(/[\r\n]/g, '')}`);
  const vtz = new ICAL.Component(ICAL.parse(`BEGIN:VCALENDAR\r\n${text}\r\nEND:VCALENDAR`)).getFirstSubcomponent('vtimezone')!;
  // IANA gewinnt immer (R-K1 #9): eine früher registrierte, eingebettete Fassung wird ersetzt.
  ICAL.TimezoneService.register(vtz);
  ianaRegistriert.add(tzid);
}

/**
 * Parsen und Zonen registrieren, BEVOR ical.js Termine baut (R-K1 #3/#9/#10): jede TZID, die im Text vorkommt (auch
 * ohne mitgeschickte VTIMEZONE), wird — wenn sie sich auf IANA abbilden lässt (IANA direkt, Windows-Name, Präfix) — aus
 * den Zonendaten der Laufzeit registriert; eine eingebettete VTIMEZONE gilt nur für Namen ohne IANA-Entsprechung.
 * Berlin bleibt die fest hinterlegte Fassung (`berlin()`).
 */
function parse(ics: string): ICAL.Component | null {
  try {
    berlin();
    const comp = new ICAL.Component(ICAL.parse(ics));
    const namen = new Set<string>();
    for (const m of ics.replace(/\r?\n[ \t]/g, '').matchAll(/;TZID=("?)([^";:\r\n]+)\1[;:]/gi)) namen.add(m[2]);
    for (const tz of comp.getAllSubcomponents('vtimezone')) {
      const id = tz.getFirstPropertyValue('tzid');
      if (typeof id !== 'string' || id === ZONE) continue;
      namen.delete(id);
      const iana = ianaZone(id);
      if (iana) ianaRegistrieren(id, iana);
      else if (!ICAL.TimezoneService.has(id)) ICAL.TimezoneService.register(tz);
    }
    for (const id of namen) {
      if (id === ZONE) continue;
      const iana = ianaZone(id);
      if (iana) ianaRegistrieren(id, iana);
    }
    return comp;
  } catch { return null; }
}

/**
 * EXDATE ohne Zone (floating) an einer Serie MIT Zone meint die Zone von DTSTART (R-K1 #26) — sonst träfe ical.js das
 * Vorkommen nicht, und es erschiene wieder. Vor dem Auffalten auf die Zone von DTSTART umschreiben.
 */
function exdateInStartzone(v: ICAL.Component) {
  const start = v.getFirstPropertyValue('dtstart');
  if (!(start instanceof ICAL.Time) || start.isDate || !start.zone || ['floating', 'UTC'].includes(start.zone.tzid)) return;
  const zone = start.zone;
  for (const p of v.getAllProperties('exdate')) {
    if (p.getParameter('tzid')) continue;
    const werte = p.getValues().filter((x): x is ICAL.Time => x instanceof ICAL.Time);
    if (!werte.length || werte.some(x => x.isDate || (x.zone && x.zone.tzid !== 'floating'))) continue;
    const neu = new ICAL.Property('exdate', v);
    neu.setParameter('tzid', zone.tzid);
    neu.setValues(werte.map(x => ICAL.Time.fromData({ year: x.year, month: x.month, day: x.day, hour: x.hour, minute: x.minute, second: x.second, isDate: false }, zone)));
    v.removeProperty(p);
    v.addProperty(neu);
  }
}

const kurz = (v: unknown, n: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : undefined);
const teilnahmeVon = (p: unknown): Teilnahme => {
  const s = typeof p === 'string' ? p.toUpperCase() : '';
  return s === 'ACCEPTED' ? 'zugesagt' : s === 'DECLINED' ? 'abgesagt' : s === 'TENTATIVE' ? 'vielleicht' : 'offen';
};

/** Gäste und Organisator eines VEVENT; `ich` = Adressen des iCloud-Kontos (klein geschrieben). */
function gaesteVon(v: ICAL.Component, ich: readonly string[]): Pick<Termin, 'teilnehmer' | 'organisator' | 'ichOrganisator' | 'meineAntwort'> {
  const orgProp = v.getFirstProperty('organizer');
  const org = orgProp ? adresseAus(orgProp.getFirstValue()) : undefined;
  const orgName = orgProp ? kurz(orgProp.getParameter('cn'), 120) : undefined;
  const ichOrg = !!org && ich.includes(org);
  const alle = v.getAllProperties('attendee').map(p => ({ email: adresseAus(p.getFirstValue()), name: kurz(p.getParameter('cn'), 120), status: teilnahmeVon(p.getParameter('partstat')), optional: String(p.getParameter('role') ?? '').toUpperCase() === 'OPT-PARTICIPANT' }))
    .filter((x): x is { email: string; name: string | undefined; status: Teilnahme; optional: boolean } => !!x.email);
  if (!alle.length && !org) return {};
  const mein = alle.find(x => ich.includes(x.email));
  // Das eigene Konto steht nicht in der Gästeliste (als Organisator bzw. als Gast mit `meineAntwort`).
  const teilnehmer = alle.filter(x => !ich.includes(x.email))
    .map(x => ({ email: x.email, ...(x.name ? { name: x.name } : {}), status: x.status, ...(x.optional ? { optional: true as const } : {}) }));
  return {
    ...(teilnehmer.length ? { teilnehmer } : {}),
    ...(org ? { organisator: { email: org, ...(orgName ? { name: orgName } : {}) } } : {}),
    ...(ichOrg ? { ichOrganisator: true } : {}),
    ...(!ichOrg && mein ? { meineAntwort: mein.status } : {}),
  };
}

/**
 * Wie steht ein Objekt zu Einladungen (rein)? Gäste (ohne das eigene Konto und den Organisator), ob wir einladen, ob wir
 * Gast sind, ob es eine Serie ist — und `empfaenger`: wer bei einer Änderung Post von iCloud bekommt (wir laden ein: die
 * Gäste; wir sind Gast: der Organisator). Grundlage der Bestätigungs-Pflicht in lib/kalender/icloud.ts.
 */
export function einladungsLage(ics: string, ich: readonly string[]): { gaeste: string[]; empfaenger: string[]; mitTeilnehmern: boolean; ichOrganisator: boolean; organisator?: string; gast: boolean; serie: boolean } {
  const comp = parse(ics);
  const vs = comp?.getAllSubcomponents('vevent') ?? [];
  const serie = vs.some(v => v.hasProperty('rrule') || v.hasProperty('rdate') || v.hasProperty('recurrence-id'));
  const mitTeilnehmern = vs.some(v => v.hasProperty('attendee'));
  const master = vs.find(x => !x.hasProperty('recurrence-id')) ?? vs[0];
  if (!master) return { gaeste: [], empfaenger: [], mitTeilnehmern: false, ichOrganisator: false, gast: false, serie: false };
  const org = adresseAus(master.getFirstPropertyValue('organizer'));
  const ichOrganisator = !!org && ich.includes(org);
  const gaeste = Array.from(new Set(vs.flatMap(v => v.getAllProperties('attendee').map(p => adresseAus(p.getFirstValue())).filter((x): x is string => !!x && !ich.includes(x) && x !== org))));
  const gast = mitTeilnehmern && !ichOrganisator;
  return { gaeste, empfaenger: gast ? (org ? [org] : []) : gaeste, mitTeilnehmern, ichOrganisator, ...(org ? { organisator: org } : {}), gast, serie };
}

/** Die Zusätze eines VEVENT (rein aus dem Text, ohne Neben-Bestand). */
function zusatzVon(v: ICAL.Component): IcsZusatz & { transp?: 'OPAQUE' | 'TRANSPARENT'; markiert: boolean } {
  const x = (n: string) => { const w = v.getFirstPropertyValue(n); return typeof w === 'string' ? w.trim() : undefined; };
  const artRoh = x('x-make-art')?.toLowerCase();
  const blockRoh = x('x-make-block')?.toLowerCase();
  const klasse = x('class')?.toUpperCase();
  const transp = x('transp')?.toUpperCase();
  const sichtbarkeit: Sichtbarkeit | undefined = klasse === 'PRIVATE' || klasse === 'CONFIDENTIAL' ? 'privat' : klasse === 'PUBLIC' ? 'oeffentlich' : undefined;
  return {
    ...(istIcsArt(artRoh) ? { art: artRoh } : {}),
    ...(artRoh === 'block' && istBlockArt(blockRoh) ? { blockArt: blockRoh } : {}),
    ...(farbeSauber(x('color')) ? { farbe: farbeSauber(x('color')) } : {}),
    ...(sichtbarkeit ? { sichtbarkeit } : {}),
    ...(transp === 'OPAQUE' || transp === 'TRANSPARENT' ? { transp } : {}),
    markiert: istIcsArt(artRoh),
  };
}

/** Erinnerungen (Minuten vor Beginn) aus den VALARMs — nur relative Auslöser vor/zu Beginn. */
function erinnerungenVon(v: ICAL.Component): number[] {
  const raus: number[] = [];
  for (const a of v.getAllSubcomponents('valarm')) {
    const t = a.getFirstPropertyValue('trigger');
    if (t && typeof t === 'object' && 'toSeconds' in t) { const sek = (t as ICAL.Duration).toSeconds(); if (sek <= 0) raus.push(Math.round(-sek / 60)); }
  }
  return erinnerungenSauber(raus);
}

/**
 * Art/Farbe/Sichtbarkeit aus einem iCalendar-Text (erstes VEVENT ohne RECURRENCE-ID) — null, wenn der Termin kein
 * X-MAKE-ART trägt. Grundlage des Abgleichs mit der Sicherung im Neben-Bestand (lib/kalender/bezug.ts).
 */
export function icsZusatz(ics: string): IcsZusatz | null {
  const comp = parse(ics);
  const vs = comp?.getAllSubcomponents('vevent') ?? [];
  const v = vs.find(x => !x.hasProperty('recurrence-id')) ?? vs[0];
  if (!v) return null;
  const { transp: _t, markiert, ...z } = zusatzVon(v);
  return markiert ? z : null;
}

/**
 * Alle Termine eines Objekts, die in [von, bis) liegen (Berliner Tage
 * YYYY-MM-DD). Serien werden aufgefaltet, Ausnahmen (verschobene oder
 * gestrichene Vorkommen) berücksichtigt. `ich` = Adressen des iCloud-Kontos (K3: Organisator oder Gast?).
 */
export function termineAus(obj: KalenderObjekt, kal: KalenderInfo, von: string, bis: string, ich: readonly string[] = []): Termin[] {
  const comp = parse(obj.ics);
  if (!comp) return [];
  const vevents = comp.getAllSubcomponents('vevent');
  const master = vevents.find(v => !v.hasProperty('recurrence-id')) ?? vevents[0];
  if (!master) return [];
  exdateInStartzone(master);
  // Minütliche/sekündliche Serien aus fremden Daten (R-K1 #33): nicht auffalten — nur der erste Termin zählt.
  const freq = String((master.getFirstPropertyValue('rrule') as ICAL.Recur | null)?.freq ?? '').toUpperCase();
  if (freq === 'MINUTELY' || freq === 'SECONDLY') master.removeAllProperties('rrule');
  const ev = new ICAL.Event(master);
  const serie = ev.isRecurring();
  const ausnahmen = vevents.filter(x => x !== master && x.hasProperty('recurrence-id'));
  if (serie) for (const x of ausnahmen) ev.relateException(x);
  const mitTeilnehmern = vevents.some(v => v.hasProperty('attendee'));
  const vonT = ausWandzeit(`${von}T00:00:00`).getTime();
  const bisT = ausWandzeit(`${bis}T00:00:00`).getTime();
  const raus: Termin[] = [];
  const kal0 = kalenderKennung(kal.id);
  const gesehen = new Set<string>();

  const fuege = (e: ICAL.Event, start: ICAL.Time, ende: ICAL.Time, rid?: ICAL.Time) => {
    if (rid) gesehen.add(rid.toString());
    const z = zusatzVon(e.component);
    const g = gaesteVon(e.component, ich);
    const endeW = ende && ende.compare(start) > 0 ? ende : start;
    const s = alsWand(start);
    const en = alsWand(endeW);
    const sT = zeitpunkt(start);
    const eT = Math.max(sT, zeitpunkt(endeW));
    // Überlappt den Zeitraum? (ganztägige und Null-Dauer-Termine zählen am Starttag)
    if (!(sT < bisT && (eT > vonT || (eT === sT && sT >= vonT)))) return;
    const st = String(e.component.getFirstPropertyValue('status') ?? '').toUpperCase();
    const status = st === 'CANCELLED' ? 'abgesagt' as const : st === 'TENTATIVE' ? 'vorlaeufig' as const : st === 'CONFIRMED' ? 'bestaetigt' as const : undefined;
    const abgesagt = status === 'abgesagt' || g.meineAntwort === 'abgesagt';
    raus.push({
      id: terminSchluessel(kal0, ev.uid, rid?.toString()), uid: ev.uid, href: obj.href,
      titel: kurz(e.summary, 300) ?? '(ohne Titel)', start: s, ende: en, ganztags: start.isDate,
      kalender: kal.name, kalenderId: kal.id, farbe: kal.farbe,
      ort: kurz(e.location, 300), notiz: kurz(e.description, 2000),
      serie, mitTeilnehmern,
      // Mit Gästen nur, wenn WIR eingeladen haben (dann nach Bestätigung, K3); als Gast nur zusagen/absagen.
      bearbeitbar: !serie && (!mitTeilnehmern || !!g.ichOrganisator) && kal.schreibbar !== false,
      ...zusatzFelder(z, start, e.component),
      // Abgesagt/abgelehnt belegt nicht (#68); vorläufig (TENTATIVE) belegt wie bestätigt.
      ...(abgesagt ? { beschaeftigt: false, abgesagt: true as const } : {}),
      ...g,
      ...(status ? { status } : {}),
      startMs: sT,
      ...(obj.etag ? { stand: obj.etag } : {}),
    });
  };

  if (!serie) {
    fuege(ev, ev.startDate, ev.endDate);
    return raus;
  }
  // Serie: vom Serienbeginn bis zum Zeitraumende aufzählen (gedeckelt: 60.000 Schritte, höchstens VORKOMMEN_MAX Termine).
  const it = ev.iterator();
  const grenze = ICAL.Time.fromJSDate(new Date(bisT), true);
  // Vorkommen weit vor dem Zeitraum nur überspringen (verschobene Ausnahmen holt der Nachlauf unten).
  const ab = ICAL.Time.fromJSDate(new Date(vonT - 7 * 86_400_000), true);
  let n: ICAL.Time | null;
  let schritte = 0;
  while ((n = it.next()) && schritte++ < 60_000 && raus.length < VORKOMMEN_MAX) {
    if (n.compare(grenze) >= 0) break;
    if (n.compare(ab) < 0) continue;
    const o = ev.getOccurrenceDetails(n);
    fuege(o.item, o.startDate, o.endDate, o.recurrenceId);
  }
  // Verschobene Vorkommen (RECURRENCE-ID), deren Original weit außerhalb liegt, die aber IN den Zeitraum verschoben
  // wurden (R-K1 #35) — nach ihrem tatsächlichen Beginn, ohne Doppelte.
  for (const x of ausnahmen) {
    if (raus.length >= VORKOMMEN_MAX) break;
    const rid = x.getFirstPropertyValue('recurrence-id');
    if (!(rid instanceof ICAL.Time) || gesehen.has(rid.toString())) continue;
    const o = ev.getOccurrenceDetails(rid);
    fuege(o.item, o.startDate, o.endDate, o.recurrenceId ?? rid);
  }
  return raus;
}

/** Höchstzahl Vorkommen je Objekt und Abfrage (R-K1 #33) — eine fremde Serie darf den Server (1 vCPU) nicht lähmen. */
export const VORKOMMEN_MAX = 2000;

/** Die K1-Felder eines Vorkommens aus seinem VEVENT. */
function zusatzFelder(z: ReturnType<typeof zusatzVon>, start: ICAL.Time, v: ICAL.Component): Pick<Termin, 'art' | 'farbeEigen' | 'farbeId' | 'beschaeftigt' | 'sichtbarkeit' | 'zone' | 'erinnerungen' | 'arbeitsort' | 'blockArt'> {
  const art = z.art ?? 'termin';
  const zone = anzeigeZone(start);
  const er = erinnerungenVon(v);
  return {
    art,
    ...(z.farbe ? { farbeId: z.farbe, farbeEigen: farbeHex(z.farbe) } : {}),
    beschaeftigt: z.transp ? z.transp === 'OPAQUE' : beschaeftigtStandard(art, start.isDate),
    sichtbarkeit: z.sichtbarkeit ?? 'standard',
    ...(zone ? { zone } : {}),
    ...(er.length ? { erinnerungen: er } : {}),
    ...(art === 'arbeitsort' ? { arbeitsort: arbeitsortAusTitel(String(v.getFirstPropertyValue('summary') ?? '')) } : {}),
    ...(art === 'block' && z.blockArt ? { blockArt: z.blockArt } : {}),
  };
}

/** Kurzbild eines Objekts (ein Parse): UID, Starttag (Berlin) und was es selbst über Art/Farbe/Sichtbarkeit sagt. */
export function objektKurz(ics: string): { uid?: string; tag?: string; zusatz: IcsZusatz | null } {
  const comp = parse(ics);
  const vs = comp?.getAllSubcomponents('vevent') ?? [];
  const v = vs.find(x => !x.hasProperty('recurrence-id')) ?? vs[0];
  if (!v) return { zusatz: null };
  const uid = v.getFirstPropertyValue('uid');
  const start = v.getFirstPropertyValue('dtstart');
  const { transp: _t, markiert, ...z } = zusatzVon(v);
  return {
    ...(typeof uid === 'string' ? { uid } : {}),
    ...(start instanceof ICAL.Time ? { tag: alsWand(start).slice(0, 10) } : {}),
    zusatz: markiert ? z : null,
  };
}

/** UID eines Objekts — ohne Auffalten (auch bei langen Serien billig). */
export function uidVon(ics: string): string | undefined {
  return /^UID(?:;[^:\r\n]*)?:(.+)$/m.exec(ics.replace(/\r?\n[ \t]/g, ''))?.[1]?.trim();
}

/**
 * Darf MAKE OS dieses Objekt ändern oder löschen? null = ja, sonst der Grund. Mit Gästen (K3): nur, wenn wir eingeladen
 * haben (`ich` enthält den ORGANIZER) — die Bestätigung („Absage an n Gäste senden?“) prüft lib/kalender/icloud.ts.
 */
export function nichtBearbeitbar(ics: string, ich: readonly string[] = []): string | null {
  // Nur die Termine selbst ansehen: Zeitzonen haben eigene RRULEs, Alarme eigene ATTENDEEs.
  const glatt = (ics.replace(/\r?\n[ \t]/g, '').match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) ?? [])
    .map(v => v.replace(/BEGIN:VALARM[\s\S]*?END:VALARM/g, '')).join('\n');
  if (/^(RRULE|RDATE|RECURRENCE-ID)[;:]/m.test(glatt)) return 'Serientermin — bitte in Apple Kalender ändern.';
  if (/^ATTENDEE[;:]/m.test(glatt)) {
    const org = adresseAus(/^ORGANIZER[^:\r\n]*:(.+)$/m.exec(glatt)?.[1]);
    if (!org || !ich.includes(org)) return 'Du bist hier Gast — nur zusagen oder absagen; ändern kann nur, wer eingeladen hat.';
  }
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
  /** Serie — als RRULE; Apple zeigt sie wie eigene Serien. */
  wiederholung?: Wiederholung;
  /** Erinnerung in Minuten vor Beginn — als VALARM (DISPLAY), Apple/iPhone melden sie. */
  erinnerungMin?: number;
  // ── seit 29.09. (K1) ──
  /** Mehrere Erinnerungen (Minuten vor Beginn) — zusammen mit `erinnerungMin`. */
  erinnerungenMin?: number[];
  art?: IcsArt;
  /** Farb-Kennung der Palette (lib/kalender/arten.ts TERMIN_FARBEN) → COLOR. */
  farbe?: string;
  /** Ohne Angabe: nach Art und ganztags (beschaeftigtStandard). */
  beschaeftigt?: boolean;
  sichtbarkeit?: Sichtbarkeit;
  /** IANA-Zone, in der `start`/`ende` gemeint sind (Standard Europe/Berlin). */
  zone?: string;
  /** R-K1 #13: IANA-Zone des ENDES, wenn anders als `zone` (Flug Berlin → New York) — `ende` ist dann dort gemeint. */
  endZone?: string;
  /** Nur Art „arbeitsort“: wird der Titel. */
  arbeitsort?: Arbeitsort;
  // ── seit 30.09. (K3) ── nur nach Bestätigung (Route: `einladungBestaetigt`)
  /** Gäste — je ein ATTENDEE (SCHEDULE-AGENT=SERVER: iCloud verschickt die Einladung). */
  gaeste?: Gast[];
  /** ORGANIZER = eine Adresse des iCloud-Kontos (Pflicht, sobald es Gäste gibt). */
  organisator?: string;
  /** Nur Art „block“ (K5): Unterart → X-MAKE-BLOCK. */
  blockArt?: BlockArt;
}

/** Name für einen Parameter (CN): eine Zeile, ohne Anführungszeichen und Steuerzeichen. */
const cnSauber = (s: string | undefined) => (s ? s.replace(/[\u0000-\u001f\u007f"]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) : '');

/** Ein ATTENDEE für einen Gast — neu: noch ohne Antwort, Antwort erbeten, iCloud verschickt (SCHEDULE-AGENT=SERVER). */
function gastEigenschaft(v: ICAL.Component, g: Gast, status: string = 'NEEDS-ACTION'): ICAL.Property {
  const p = new ICAL.Property('attendee', v);
  p.setValue(`mailto:${g.email}`);
  const cn = cnSauber(g.name);
  if (cn) p.setParameter('cn', cn);
  p.setParameter('cutype', 'INDIVIDUAL');
  p.setParameter('role', 'REQ-PARTICIPANT');
  p.setParameter('partstat', status);
  p.setParameter('rsvp', 'TRUE');
  p.setParameter('schedule-agent', 'SERVER');
  return p;
}

function organisatorSetzen(v: ICAL.Component, email: string) {
  v.removeAllProperties('organizer');
  const p = new ICAL.Property('organizer', v);
  p.setValue(`mailto:${email}`);
  p.setParameter('schedule-agent', 'SERVER');
  v.addProperty(p);
}

/** Gästeliste eines VEVENT neu setzen: bekannte Gäste behalten ihre Antwort, neue kommen ohne Antwort dazu. */
function gaesteSetzen(v: ICAL.Component, gaeste: readonly Gast[], organisator: string, ich: readonly string[]) {
  const alt = new Map(v.getAllProperties('attendee').map(p => [adresseAus(p.getFirstValue()) ?? '', p] as const));
  v.removeAllProperties('attendee');
  // Das eigene Konto als Teilnehmer (falls Apple es eingetragen hatte) bleibt stehen.
  for (const [mail, p] of alt) if (ich.includes(mail)) v.addProperty(p);
  for (const g of gaeste) {
    if (ich.includes(g.email)) continue;
    const war = alt.get(g.email);
    v.addProperty(war ?? gastEigenschaft(v, g));
  }
  if (gaeste.length && !v.hasProperty('organizer')) organisatorSetzen(v, organisator);
}

/** Die Zone für ical.js — Berlin fest hinterlegt, andere aus den Zonendaten der Laufzeit (einmal registriert). */
function zoneFuer(zone: string, jahr: number): ICAL.Timezone {
  if (zone === ZONE) return berlin();
  if (zone === 'UTC') return ICAL.Timezone.utcTimezone;
  if (!ICAL.TimezoneService.has(zone)) {
    const vtz = new ICAL.Component(ICAL.parse(`BEGIN:VCALENDAR\r\n${vtimezoneText(zone, jahr)}\r\nEND:VCALENDAR`)).getFirstSubcomponent('vtimezone')!;
    ICAL.TimezoneService.register(vtz);
  }
  return ICAL.TimezoneService.get(zone)!;
}

/** ical.js-Zeit direkt aus den Wandzeit-Teilen „YYYY-MM-DDTHH:mm:ss“ in einer Zone — ohne Umweg über UTC. */
function ausTeilen(wand: string, tz: ICAL.Timezone): ICAL.Time {
  const [j, mo, t] = wand.slice(0, 10).split('-').map(Number);
  const [h, mi, se] = wand.slice(11, 19).split(':').map(x => Number(x || 0));
  return ICAL.Time.fromData({ year: j, month: mo, day: t, hour: h, minute: mi, second: se || 0, isDate: false }, tz);
}

/**
 * Wandzeit → ical.js-Zeit: ganztags als Datum; sonst in `zone` gemeint (Standard Berlin). Seit R-K1 (#4/#5) aus den
 * Wandzeit-Teilen gebaut, nicht über den UTC-Zeitpunkt und `convertToZone` (ical.js machte am 25.10. aus 02:00–03:00
 * einen Termin 03:00–03:00). Eine Uhrzeit aus der Lücke Ende März gibt es nicht: sie rückt nach RFC vor (02:30 → 03:30).
 * Eine mehrdeutige (doppelte Stunde) bleibt stehen — sie meint das erste Vorkommen (Sommerzeit).
 */
function zeitFuer(wand: string, ganztags: boolean, zone: string = ZONE): ICAL.Time {
  if (ganztags) {
    const [j, m, t] = wand.slice(0, 10).split('-').map(Number);
    return ICAL.Time.fromData({ year: j, month: m, day: t, isDate: true });
  }
  if (zone === 'UTC') return ICAL.Time.fromJSDate(ausWandzeitIn(wand, 'UTC'), true);
  const echt = wandzeitIn(ausWandzeitIn(wand, zone), zone);
  return ausTeilen(echt, zoneFuer(zone, Number(wand.slice(0, 4))));
}

/** Ein echter Zeitpunkt als ical.js-Zeit in einer IANA-Zone (über deren Wandzeit). */
function zeitAusMs(ms: number, zone: string): ICAL.Time {
  if (zone === 'UTC') return ICAL.Time.fromJSDate(new Date(ms), true);
  return ausTeilen(wandzeitIn(new Date(ms), zone), zoneFuer(zone, new Date(ms).getUTCFullYear()));
}

/**
 * Serien (R-K1 #20): DTSTART muss das erste echte Vorkommen sein — sonst zählt Apple (RFC: DTSTART ist immer das erste)
 * anders als ical.js (überspringt einen unpassenden Beginn). Liefert die Verschiebung in Tagen (0 = passt schon).
 */
function tageBisErstesVorkommen(start: ICAL.Time, rrule: string): number {
  try {
    const n = ICAL.Recur.fromString(rrule).iterator(start.clone()).next();
    if (!n) return 0;
    const tag = (t: ICAL.Time) => Date.UTC(t.year, t.month - 1, t.day);
    return Math.round((tag(n) - tag(start)) / 86_400_000);
  } catch { return 0; }
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

/** Die VTIMEZONE einer anderen Zone mitschicken (Apple und jeder andere Client rechnen damit). */
function mitZone(comp: ICAL.Component, zone: string, jahr: number) {
  if (zone === ZONE) { mitBerlinZone(comp); return; }
  if (zone === 'UTC' || comp.getAllSubcomponents('vtimezone').some(z => z.getFirstPropertyValue('tzid') === zone)) return;
  comp.addSubcomponent(new ICAL.Component(ICAL.parse(`BEGIN:VCALENDAR\r\n${vtimezoneText(zone, jahr)}\r\nEND:VCALENDAR`)).getFirstSubcomponent('vtimezone')!);
}

/** Art, Farbe, Sichtbarkeit in ein VEVENT schreiben (nur die übergebenen; `null`/„standard“ entfernt). */
function zusaetzeSetzen(v: ICAL.Component, z: { art?: IcsArt; farbe?: string | null; sichtbarkeit?: Sichtbarkeit; blockArt?: BlockArt | null }) {
  const setze = (name: string, wert: string | undefined) => { v.removeAllProperties(name); if (wert) v.updatePropertyWithValue(name, wert); };
  if (z.art !== undefined) setze('x-make-art', z.art);
  // Unterart nur bei Blöcken; eine andere Art nimmt sie mit weg.
  if (z.blockArt !== undefined || (z.art !== undefined && z.art !== 'block')) setze('x-make-block', z.art !== undefined && z.art !== 'block' ? undefined : z.blockArt ?? undefined);
  if (z.farbe !== undefined) setze('color', farbeSauber(z.farbe));
  if (z.sichtbarkeit !== undefined) setze('class', z.sichtbarkeit === 'privat' ? 'PRIVATE' : z.sichtbarkeit === 'oeffentlich' ? 'PUBLIC' : undefined);
}

function alarmeSetzen(v: ICAL.Component, minuten: number[], titel: string) {
  for (const min of erinnerungenSauber(minuten)) {
    const a = new ICAL.Component('valarm');
    a.updatePropertyWithValue('action', 'DISPLAY');
    a.updatePropertyWithValue('description', sauber(titel, 300) || 'Termin');
    const p = new ICAL.Property('trigger', a); p.setValue(ICAL.Duration.fromString(`${min > 0 ? '-' : ''}PT${min}M`)); a.addProperty(p);
    v.addSubcomponent(a);
  }
}

/** Ein neuer Termin als iCalendar-Text — Gäste nur, wenn mitgegeben (die Route lässt sie erst nach Bestätigung durch). */
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
  const art: IcsArt = t.art ?? 'termin';
  const titel = art === 'arbeitsort' && t.arbeitsort ? arbeitsortTitel(t.arbeitsort) : t.titel;
  v.updatePropertyWithValue('summary', sauber(titel, 300) || 'Termin');
  const zone = t.zone ?? ZONE;
  // Ende in einer anderen Zone (R-K1 #13, z. B. ein Flug) — sonst dieselbe wie der Beginn.
  const zoneE = !t.ganztags && t.endZone ? t.endZone : zone;
  const rrule = t.wiederholung ? rruleText(t.wiederholung, !!t.ganztags, zone) : null;
  let start = t.start, ende = t.ende;
  if (rrule) {
    const tage = tageBisErstesVorkommen(zeitFuer(start, !!t.ganztags, zone), rrule);
    if (tage > 0) { start = `${tagPlus(start.slice(0, 10), tage)}${start.slice(10)}`; ende = `${tagPlus(ende.slice(0, 10), tage)}${ende.slice(10)}`; }
  }
  setzeZeit(v, 'dtstart', zeitFuer(start, !!t.ganztags, zone));
  setzeZeit(v, 'dtend', zeitFuer(ende, !!t.ganztags, zoneE));
  if (t.ort) v.updatePropertyWithValue('location', sauber(t.ort, 300));
  if (t.notiz) v.updatePropertyWithValue('description', sauber(t.notiz, 2000));
  if (rrule) v.updatePropertyWithValue('rrule', ICAL.Recur.fromString(rrule));
  // Frei/beschäftigt immer ausdrücklich — Apple, Google und die freie-Zeit-Suche lesen TRANSP.
  v.updatePropertyWithValue('transp', (t.beschaeftigt ?? beschaeftigtStandard(art, !!t.ganztags)) ? 'OPAQUE' : 'TRANSPARENT');
  zusaetzeSetzen(v, { art, ...(t.farbe ? { farbe: t.farbe } : {}), ...(t.sichtbarkeit && t.sichtbarkeit !== 'standard' ? { sichtbarkeit: t.sichtbarkeit } : {}), ...(art === 'block' && t.blockArt ? { blockArt: t.blockArt } : {}) });
  const min = [...(t.erinnerungenMin ?? []), ...(t.erinnerungMin !== undefined && t.erinnerungMin >= 0 ? [Math.min(60 * 24 * 14, Math.round(t.erinnerungMin))] : [])];
  alarmeSetzen(v, min, titel);
  if (t.gaeste?.length) {
    if (!t.organisator) throw new Error('Gäste ohne Organisator — ohne iCloud-Adresse keine Einladung.');
    organisatorSetzen(v, t.organisator);
    for (const g of t.gaeste) if (g.email !== t.organisator) v.addProperty(gastEigenschaft(v, g));
  }
  if (!t.ganztags) { mitZone(cal, zone, Number(start.slice(0, 4))); if (zoneE !== zone) mitZone(cal, zoneE, Number(ende.slice(0, 4))); }
  cal.addSubcomponent(v);
  const text = cal.toString();
  if (!rrule) return text;
  // ical.js lässt WKST=MO beim Schreiben weg (sein Standard) — die RRULE des Termins steht wörtlich da (R-K1 #25).
  const i = text.indexOf('BEGIN:VEVENT');
  return text.slice(0, i) + text.slice(i).replace(/\r\nRRULE:[^\r\n]*/, `\r\nRRULE:${rrule}`);
}

export interface Aenderung {
  titel?: string; start?: string; ende?: string; ort?: string | null; notiz?: string | null;
  // ── seit 29.09. (K1) ── (Arbeitsort ändern = Titel ändern)
  art?: IcsArt; farbe?: string | null; beschaeftigt?: boolean; sichtbarkeit?: Sichtbarkeit;
  // ── seit 30.09. (K3) ── die ganze neue Gästeliste (leer = alle ausladen) — nur nach Bestätigung
  gaeste?: Gast[];
  /** K5: Unterart eines Blocks (null entfernt). */
  blockArt?: BlockArt | null;
}

/**
 * Einen bestehenden Einzeltermin ändern — alles andere (Alarme, Notizen,
 * Anhänge, Apple-Felder) bleibt, wie es ist. Serien: Fehler (nur in Apple ändern).
 * Mit Gästen (K3): nur als Organisator (`opt.ich` enthält den ORGANIZER) UND nach Bestätigung (`opt.einladungBestaetigt`)
 * — dann verschickt iCloud die Änderung (SEQUENCE steigt). Als Gast: Fehler (nur `antwortSetzen`).
 */
export function aendereTermin(ics: string, a: Aenderung, jetzt = new Date(), opt: { ich?: readonly string[]; einladungBestaetigt?: boolean } = {}): { ics: string } | { fehler: string } {
  const comp = parse(ics);
  if (!comp) return { fehler: 'Der Termin ließ sich nicht lesen.' };
  const vevents = comp.getAllSubcomponents('vevent');
  if (vevents.length !== 1) return { fehler: 'Serientermin — bitte in Apple Kalender ändern.' };
  const v = vevents[0];
  if (v.hasProperty('rrule') || v.hasProperty('rdate') || v.hasProperty('recurrence-id')) return { fehler: 'Serientermin — bitte in Apple Kalender ändern.' };
  const ich = opt.ich ?? [];
  if (v.hasProperty('attendee') || a.gaeste?.length) {
    const org = adresseAus(v.getFirstPropertyValue('organizer'));
    if (v.hasProperty('attendee') && (!org || !ich.includes(org))) return { fehler: 'Du bist hier Gast — nur zusagen oder absagen; ändern kann nur, wer eingeladen hat.' };
    if (!opt.einladungBestaetigt) return { fehler: 'Termin mit Gästen — erst bestätigen, dass iCloud die Änderung an die Gäste schickt.' };
    if (!org && !ich[0]) return { fehler: 'Ohne iCloud-Adresse keine Einladung.' };
  }
  if (a.gaeste !== undefined) gaesteSetzen(v, a.gaeste, adresseAus(v.getFirstPropertyValue('organizer')) ?? ich[0] ?? '', ich);
  const ev = new ICAL.Event(v);
  const ganztags = ev.startDate.isDate;
  if (a.titel !== undefined) v.updatePropertyWithValue('summary', sauber(a.titel, 300) || 'Termin');
  if (a.beschaeftigt !== undefined) v.updatePropertyWithValue('transp', a.beschaeftigt ? 'OPAQUE' : 'TRANSPARENT');
  if (a.sichtbarkeit !== undefined && !istSichtbarkeit(a.sichtbarkeit)) return { fehler: 'Unbekannte Sichtbarkeit.' };
  zusaetzeSetzen(v, { ...(a.art !== undefined ? { art: a.art } : {}), ...(a.farbe !== undefined ? { farbe: a.farbe } : {}), ...(a.sichtbarkeit !== undefined ? { sichtbarkeit: a.sichtbarkeit } : {}), ...(a.blockArt !== undefined ? { blockArt: a.blockArt } : {}) });
  if (a.ort !== undefined) { if (a.ort) v.updatePropertyWithValue('location', sauber(a.ort, 300)); else v.removeAllProperties('location'); }
  if (a.notiz !== undefined) { if (a.notiz) v.updatePropertyWithValue('description', sauber(a.notiz, 2000)); else v.removeAllProperties('description'); }
  if (a.start || a.ende) {
    // Ohne neues Ende: Dauer bleibt. `a.start`/`a.ende` sind Berliner Wandzeit.
    const altS = ev.startDate, altE = ev.endDate ?? ev.startDate;
    if (ganztags) {
      const neuS = a.start ? zeitFuer(a.start, true) : altS;
      let neuE: ICAL.Time;
      if (a.ende) neuE = zeitFuer(a.ende, true);
      else { neuE = neuS.clone(); const tage = altE.subtractDate(altS).toSeconds() / 86400; neuE.adjust(Math.max(1, Math.round(tage)), 0, 0, 0); }
      if (neuE.compare(neuS) <= 0) return { fehler: 'Das Ende liegt vor dem Anfang.' };
      setzeZeit(v, 'dtstart', neuS);
      setzeZeit(v, 'dtend', neuE);
    } else {
      // Die Zonen von Beginn UND Ende bleiben (R-K1 #13: ein Flug Berlin → New York behält beide). Floating und
      // unbekannte Zonen werden Berlin; Windows-Namen/Präfixe ihr IANA-Name. Geschrieben aus der Wandzeit der Zone.
      const zoneVon = (t: ICAL.Time) => ianaZone(t.zone?.tzid) ?? ZONE;
      const zS = zoneVon(altS), zE = zoneVon(altE);
      const sMs = a.start ? ausWandzeit(a.start).getTime() : zeitpunkt(altS);
      const eMs = a.ende ? ausWandzeit(a.ende).getTime() : sMs + (zeitpunkt(altE) - zeitpunkt(altS));
      if (eMs <= sMs) return { fehler: 'Das Ende liegt vor dem Anfang.' };
      setzeZeit(v, 'dtstart', zeitAusMs(sMs, zS));
      setzeZeit(v, 'dtend', zeitAusMs(eMs, zE));
      mitZone(comp, zS, new Date(sMs).getUTCFullYear());
      if (zE !== zS) mitZone(comp, zE, new Date(eMs).getUTCFullYear());
    }
    v.removeAllProperties('duration');
  }
  const stempel = ICAL.Time.fromJSDate(jetzt, true);
  v.updatePropertyWithValue('dtstamp', stempel);
  v.updatePropertyWithValue('last-modified', stempel);
  // SEQUENCE (KALENDER_FEHLER_PRUEFLISTE #61): mit Gästen nur bei wesentlichen Änderungen (Zeit, Ort) — sonst müssten alle
  // neu zusagen; ohne Gäste wie bisher bei jeder Änderung.
  const wesentlich = !!(a.start || a.ende) || a.ort !== undefined;
  if (!v.hasProperty('attendee') || wesentlich) {
    const seq = Number(v.getFirstPropertyValue('sequence') ?? 0);
    v.updatePropertyWithValue('sequence', (Number.isFinite(seq) ? seq : 0) + 1);
  }
  return { ics: comp.toString() };
}

/**
 * Als Gast antworten (K3): PARTSTAT der eigenen Adresse in ALLEN VEVENTs (auch Serien) — iCloud schickt die Antwort an
 * den Organisator. Kein SEQUENCE-Sprung (eine Antwort ist keine Änderung des Termins). Rein.
 */
export function antwortSetzen(ics: string, ich: readonly string[], status: Exclude<Teilnahme, 'offen'>, jetzt = new Date()): { ics: string } | { fehler: string } {
  const comp = parse(ics);
  if (!comp) return { fehler: 'Der Termin ließ sich nicht lesen.' };
  const vs = comp.getAllSubcomponents('vevent');
  const org = adresseAus(vs[0]?.getFirstPropertyValue('organizer'));
  if (org && ich.includes(org)) return { fehler: 'Du hast eingeladen — zusagen oder absagen können nur die Gäste.' };
  let gefunden = false;
  const stempel = ICAL.Time.fromJSDate(jetzt, true);
  for (const v of vs) {
    for (const p of v.getAllProperties('attendee')) {
      const mail = adresseAus(p.getFirstValue());
      if (!mail || !ich.includes(mail)) continue;
      p.setParameter('partstat', PARTSTAT[status]);
      p.removeParameter('rsvp');
      gefunden = true;
    }
    v.updatePropertyWithValue('dtstamp', stempel);
  }
  if (!gefunden) return { fehler: 'Du stehst nicht auf der Gästeliste dieses Termins.' };
  return { ics: comp.toString() };
}
