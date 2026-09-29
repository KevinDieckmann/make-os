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
import { wandzeit, ausWandzeit, ZONE } from './zeit';
import { rruleText, type Wiederholung } from './wiederholung';
import { istIcsArt, istBlockArt, beschaeftigtStandard, farbeSauber, farbeHex, arbeitsortAusTitel, arbeitsortTitel, erinnerungenSauber, istSichtbarkeit, type IcsArt, type BlockArt, type Sichtbarkeit, type Arbeitsort } from './arten';
import { vtimezoneText, ausWandzeitIn } from './zeitzone';
import { adresseAus, type Teilnahme, type Teilnehmer, type Gast } from './gaeste';

export { rruleText };
export type { Wiederholung, WiederholungFreq } from './wiederholung';
export { adresseAus, TEILNAHMEN, type Teilnahme, type Teilnehmer, type Gast } from './gaeste';

export interface KalenderObjekt { href: string; etag?: string; ics: string }
const PARTSTAT: Record<Exclude<Teilnahme, 'offen'>, string> = { zugesagt: 'ACCEPTED', abgesagt: 'DECLINED', vielleicht: 'TENTATIVE' };
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
  /** Wir sind Gast: unsere Antwort (nur Zusagen/Absagen, nach Klick). */
  meineAntwort?: Teilnahme;
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
  const ev = new ICAL.Event(master);
  const serie = ev.isRecurring();
  if (serie) for (const x of vevents) if (x !== master && x.hasProperty('recurrence-id')) ev.relateException(x);
  const mitTeilnehmern = vevents.some(v => v.hasProperty('attendee'));
  const vonT = ausWandzeit(`${von}T00:00:00`).getTime();
  const bisT = ausWandzeit(`${bis}T00:00:00`).getTime();
  const raus: Termin[] = [];

  const fuege = (e: ICAL.Event, start: ICAL.Time, ende: ICAL.Time, rid?: ICAL.Time) => {
    const z = zusatzVon(e.component);
    const g = gaesteVon(e.component, ich);
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
      // Mit Gästen nur, wenn WIR eingeladen haben (dann nach Bestätigung, K3); als Gast nur zusagen/absagen.
      bearbeitbar: !serie && (!mitTeilnehmern || !!g.ichOrganisator) && kal.schreibbar !== false,
      ...zusatzFelder(z, start, e.component),
      ...g,
      ...(obj.etag ? { stand: obj.etag } : {}),
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

/** Die K1-Felder eines Vorkommens aus seinem VEVENT. */
function zusatzFelder(z: ReturnType<typeof zusatzVon>, start: ICAL.Time, v: ICAL.Component): Pick<Termin, 'art' | 'farbeEigen' | 'farbeId' | 'beschaeftigt' | 'sichtbarkeit' | 'zone' | 'erinnerungen' | 'arbeitsort' | 'blockArt'> {
  const art = z.art ?? 'termin';
  const tzid = !start.isDate ? start.zone?.tzid : undefined;
  const er = erinnerungenVon(v);
  return {
    art,
    ...(z.farbe ? { farbeId: z.farbe, farbeEigen: farbeHex(z.farbe) } : {}),
    beschaeftigt: z.transp ? z.transp === 'OPAQUE' : beschaeftigtStandard(art, start.isDate),
    sichtbarkeit: z.sichtbarkeit ?? 'standard',
    ...(tzid && !['UTC', 'floating', 'Z', ZONE].includes(tzid) ? { zone: tzid } : {}),
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

/** Wandzeit → ical.js-Zeit: ganztags als Datum; sonst in `zone` gemeint (Standard Berlin). */
function zeitFuer(wand: string, ganztags: boolean, zone: string = ZONE): ICAL.Time {
  if (ganztags) {
    const [j, m, t] = wand.slice(0, 10).split('-').map(Number);
    return ICAL.Time.fromData({ year: j, month: m, day: t, isDate: true });
  }
  if (zone === ZONE) return ICAL.Time.fromJSDate(ausWandzeit(wand), true).convertToZone(berlin());
  const tz = zoneFuer(zone, Number(wand.slice(0, 4)));
  const utc = ICAL.Time.fromJSDate(ausWandzeitIn(wand, zone), true);
  return zone === 'UTC' ? utc : utc.convertToZone(tz);
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
  setzeZeit(v, 'dtstart', zeitFuer(t.start, !!t.ganztags, zone));
  setzeZeit(v, 'dtend', zeitFuer(t.ende, !!t.ganztags, zone));
  if (t.ort) v.updatePropertyWithValue('location', sauber(t.ort, 300));
  if (t.notiz) v.updatePropertyWithValue('description', sauber(t.notiz, 2000));
  if (t.wiederholung) v.updatePropertyWithValue('rrule', ICAL.Recur.fromString(rruleText(t.wiederholung, !!t.ganztags)));
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
  if (!t.ganztags) mitZone(cal, zone, Number(t.start.slice(0, 4)));
  cal.addSubcomponent(v);
  return cal.toString();
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
