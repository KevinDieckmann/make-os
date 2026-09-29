// ─── Kalender — Voll-Export und Wiederherstellung (rein, getestet, 29.09., R-K1 #K5) ─
// KALENDER_FEHLER_PRUEFLISTE #K5: Wird in iCloud gelöscht, verteilt sich das auf alle Geräte — der Spiegel
// `kalender-icloud` kennt nur −90 … +400 Tage und führt keinen Weg zurück. Deshalb:
//
//   Export        je Kalender EINE iCalendar-Datei (VCALENDAR mit allen VEVENTs und den nötigen VTIMEZONEs) — das
//                 übliche .ics-Format, das jeder Kalender importieren kann. Der Server legt sie täglich verschlüsselt
//                 ins Archiv (lib/kalender/sicherung-server.ts, Speicherweg lib/store/archiv.ts).
//   Wiederherstellen  Probelauf zuerst: zählt, was in der Sicherung steht und in iCloud FEHLT (gelöscht), was sich
//                 geändert hat und was Gäste trägt. Geschrieben wird nur mit Bestätigung, nur Fehlendes (nie
//                 überschreiben), und nie Termine mit Teilnehmern (Teilnehmer-Sperre: iCloud würde sonst Einladungen
//                 an Dritte verschicken — die gehen nur einzeln von Hand).
//                 F1 (Prüfer 1 #11): gesperrt sind auch Termine einer Buchung (feste UID `makeos-buchung-…` oder die Marke
//                 „MAKE-OS-Buchung …“ in der Notiz) — sie gehören zu einem Vorgang (Freigabe, Absage); ein zurückgespielter
//                 Termin einer abgesagten Buchung stünde sonst wieder im Kalender.
// Nur Termine (VEVENT). Rein: kein Netz, keine Platte, keine Uhr.

import ICAL from 'ical.js';

export interface SicherungsObjekt { uid: string; ics: string }

const glatt = (s: string) => s.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').trim();

/** Alle Objekte eines Kalenders als EINE iCalendar-Datei (unlesbare Objekte fallen weg, Zonen einmal je TZID). */
export function exportIcs(objekte: readonly { ics: string }[], kalenderName: string): { ics: string; termine: number; unlesbar: number } {
  const cal = new ICAL.Component(['vcalendar', [], []]);
  cal.updatePropertyWithValue('version', '2.0');
  cal.updatePropertyWithValue('prodid', '-//MAKE OS//Kalender-Sicherung//DE');
  cal.updatePropertyWithValue('calscale', 'GREGORIAN');
  cal.updatePropertyWithValue('x-wr-calname', kalenderName.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 100));
  const zonen = new Set<string>();
  const uids = new Set<string>();
  let unlesbar = 0;
  for (const o of objekte) {
    let c: ICAL.Component;
    try { c = new ICAL.Component(ICAL.parse(o.ics)); } catch { unlesbar++; continue; }
    for (const tz of c.getAllSubcomponents('vtimezone')) {
      const id = String(tz.getFirstPropertyValue('tzid') ?? '');
      if (id && !zonen.has(id)) { zonen.add(id); cal.addSubcomponent(tz); }
    }
    const vs = c.getAllSubcomponents('vevent');
    if (!vs.length) { unlesbar++; continue; }
    for (const v of vs) { cal.addSubcomponent(v); const u = v.getFirstPropertyValue('uid'); if (typeof u === 'string') uids.add(u); }
  }
  return { ics: cal.toString(), termine: uids.size, unlesbar };
}

/** Eine Export-Datei zurück in Objekte je UID (mit allen VEVENTs dieser UID und den Zonen, die sie brauchen). */
export function objekteAusIcs(ics: string): SicherungsObjekt[] {
  let cal: ICAL.Component;
  try { cal = new ICAL.Component(ICAL.parse(ics)); } catch { return []; }
  const zonen = new Map(cal.getAllSubcomponents('vtimezone').map(z => [String(z.getFirstPropertyValue('tzid') ?? ''), z] as const));
  const je = new Map<string, ICAL.Component[]>();
  for (const v of cal.getAllSubcomponents('vevent')) {
    const u = v.getFirstPropertyValue('uid');
    if (typeof u !== 'string' || !u.trim()) continue;
    je.set(u, [...(je.get(u) ?? []), v]);
  }
  const raus: SicherungsObjekt[] = [];
  for (const [uid, vs] of je) {
    const neu = new ICAL.Component(['vcalendar', [], []]);
    neu.updatePropertyWithValue('version', '2.0');
    neu.updatePropertyWithValue('prodid', '-//MAKE OS//Kalender-Sicherung//DE');
    const text = vs.map(v => v.toString()).join('\n');
    for (const [id, z] of zonen) if (id && (text.includes(`TZID=${id}`) || text.includes(`TZID="${id}"`))) neu.addSubcomponent(z);
    for (const v of vs) neu.addSubcomponent(v);
    raus.push({ uid, ics: neu.toString() });
  }
  return raus;
}

/** Termin einer Buchung (lib/kalender/buchung.ts `buchungTerminUid` / `terminMarke`)? — nie automatisch zurückspielen. */
export const buchungsTermin = (ics: string): boolean => { const g = glatt(ics); return /^UID:makeos-buchung-/m.test(g) || /MAKE-OS-Buchung /.test(g); };

/** Trägt das Objekt Teilnehmer (ATTENDEE)? — dann nie automatisch zurückspielen (Teilnehmer-Sperre). */
export const mitTeilnehmern = (ics: string): boolean => /^ATTENDEE[;:]/m.test(glatt(ics).replace(/BEGIN:VALARM[\s\S]*?END:VALARM/g, ''));

export interface WiederherstellPlan {
  /** In der Sicherung, in iCloud nicht (mehr) da — und ohne Gäste: das würde die Wiederherstellung anlegen. */
  fehlt: string[];
  /** Fehlt ebenfalls, trägt aber Gäste oder gehört zu einer Buchung — gesperrt (nur einzeln von Hand). */
  gesperrt: string[];
  /** In beiden, aber inzwischen geändert — bleibt, wie es in iCloud ist (nie überschreiben). */
  geaendert: string[];
  /** In beiden und gleich. */
  gleich: number;
  /** In iCloud, aber nicht in der Sicherung (neu seitdem) — bleibt. */
  neu: number;
}

/** Probelauf (rein): vergleicht eine Sicherung mit dem aktuellen iCloud-Stand desselben Kalenders — nach UID. */
export function wiederherstellPlan(sicherung: readonly SicherungsObjekt[], ist: readonly SicherungsObjekt[]): WiederherstellPlan {
  const jetzt = new Map(ist.map(o => [o.uid, o.ics] as const));
  const plan: WiederherstellPlan = { fehlt: [], gesperrt: [], geaendert: [], gleich: 0, neu: 0 };
  const inSicherung = new Set<string>();
  for (const o of sicherung) {
    inSicherung.add(o.uid);
    const da = jetzt.get(o.uid);
    if (da === undefined) (mitTeilnehmern(o.ics) || buchungsTermin(o.ics) ? plan.gesperrt : plan.fehlt).push(o.uid);
    else if (vevents(da) === vevents(o.ics)) plan.gleich++;
    else plan.geaendert.push(o.uid);
  }
  plan.neu = ist.filter(o => !inSicherung.has(o.uid)).length;
  return plan;
}

/** Nur die VEVENT-Blöcke (ohne DTSTAMP, der sich bei jedem Lesen ändern darf) — für „gleich?“. */
function vevents(ics: string): string {
  return (glatt(ics).match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) ?? []).map(v => v.replace(/^DTSTAMP[;:].*$/gm, '')).sort().join('\n');
}

/** Archiv-Dateiname einer Tagessicherung: `kalender-export-<kalender>-<YYYY-MM-DD>.json`. */
export const exportDatei = (kalenderKennung: string, tag: string): string => `kalender-export-${kalenderKennung.toLowerCase().replace(/[^a-z0-9._-]/g, '-').slice(0, 60)}-${tag}.json`;
const DATEI = /^kalender-export-(.+)-(\d{4}-\d{2}-\d{2})\.json$/;
/** Kalender-Kennung und Tag aus einem Dateinamen (null = keine Kalender-Sicherung). */
export function exportDateiTeile(datei: string): { kennung: string; tag: string } | null {
  const m = DATEI.exec(datei);
  return m ? { kennung: m[1], tag: m[2] } : null;
}

/** Wie viele Tage die Tagessicherungen je Kalender bleiben. */
export const SICHERUNG_TAGE = 14;
/** Welche Dateien sind älter als die Frist (rein, nach dem Tag im Namen)? */
export function abgelaufen(dateien: readonly string[], heute: string, tagePlus: (t: string, n: number) => string): string[] {
  const grenze = tagePlus(heute, -SICHERUNG_TAGE);
  return dateien.filter(d => { const t = exportDateiTeile(d); return !!t && t.tag < grenze; });
}

/** Ist die Tagessicherung fällig? Einmal je Berliner Tag, nachts ab 03:00 (nach dem Abgleich, vor dem Morgen). */
export function sicherungFaellig(letzterTag: string | undefined, jetztWand: string): boolean {
  return letzterTag !== jetztWand.slice(0, 10) && Number(jetztWand.slice(11, 13)) >= 3;
}
