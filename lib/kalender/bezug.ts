// ─── Kalender — Bezüge zu MAKE OS am Termin (rein, getestet, 29.09., K1) ────
// Wo jede Termin-Information liegt (Kevin 29.09.: „alles sauber mit allen verbunden,
// Datenhaltung sauber“; Datenregel KALENDER_VERBINDUNGEN.md 4a):
//
//   iCloud (VEVENT)       DIE Wahrheit für den Termin: Titel, Zeit, Zone (TZID), ganztags,
//                         Ort, Notiz, Serie (RRULE/EXDATE), Erinnerungen (VALARM), frei/
//                         beschäftigt (TRANSP), Sichtbarkeit (CLASS), Farbe (COLOR), Art
//                         (X-MAKE-ART). Der Arbeitsort steht im Titel.
//   `kalender-bezug`      (dieser Bestand, verschlüsselt wie jeder Bestand) NUR, was es im
//                         Standard nicht gibt: Kennungen zu MAKE OS (Aufgabe, Mandat, Kontakt,
//                         Firma, Deal, Event), wer den Termin in MAKE OS angelegt hat (`von`,
//                         Speichername), den Starttag (für die Verbindungsprüfung) und eine
//                         SICHERUNG von Art und „privat“ — Apple verliert X-Eigenschaften und
//                         CLASS, wenn man den Termin in Apple bearbeitet. Nie Namen, nie Titel.
//                         Schlüssel `uid` (ganze Serie) bzw. `uid::RECURRENCE-ID` (ein Vorkommen).
//   Aufgabe als Termin    ist KEIN Termin: dieselbe Aufgabe im Aufgaben-Modell (`dueDate` +
//                         `dueTime`) — eine Stelle, keine Kopie.
//   Fokus-Block           trägt `terminUid` (lib/zeitmessung/modell.ts) — geprüft in der
//                         Verbindungsprüfung (`zeit-termin-tot`).
//
// Vorrang beim Lesen (`mitBezug`): der iCloud-Text gewinnt; die Sicherung füllt nur, was dort
// fehlt (Art verloren → Sicherung; „privat“ gilt, wenn EINE Seite privat sagt — Privatheit geht
// nie still verloren). Abgleich nach jedem iCloud-Lauf (`bezugAbgleichPlan`): Termine mit
// X-MAKE-ART ohne Eintrag bekommen ihre Sicherung; Einträge, deren X-MAKE-ART fehlt, meldet die
// Verbindungsprüfung (`termin-art-verloren`) — beim nächsten Speichern in MAKE OS wird sie wieder
// geschrieben. Speicher/Sperre: lib/kalender/bezug-server.ts.

import type { Termin, IcsZusatz } from './ics';
import { istIcsArt, type IcsArt } from './arten';

export const BEZUG_FELDER = ['kontaktId', 'firmaId', 'mandatId', 'dealId', 'aufgabeId', 'eventId'] as const;
export type BezugFeld = (typeof BEZUG_FELDER)[number];
export type BezugKennungen = Partial<Record<BezugFeld, string>>;

export interface TerminBezug extends BezugKennungen {
  /** Wer ihn in MAKE OS angelegt hat (Speichername) — Eigentümer für „privat“ im gemeinsamen Kalender. */
  von?: string;
  /** Sicherung der Art (X-MAKE-ART). */
  art?: IcsArt;
  /** Sicherung „privat“ (CLASS:PRIVATE). */
  privat?: true;
  /** Starttag YYYY-MM-DD (Berlin) — „UID tot“ prüft nur im Holfenster. */
  tag?: string;
  geaendert: string;
}
export interface BezugBestand { bezuege: Record<string, TerminBezug> }
export const LEER_BEZUG: BezugBestand = { bezuege: {} };
/** Höchstzahl der Einträge — darüber lehnt der Schreibweg ab (413), nie still kürzen. */
export const BEZUG_MAX = 20_000;

const KENNUNG = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/;
const PERSON = /^[a-z0-9-]{1,40}$/;
const TAG = /^\d{4}-\d{2}-\d{2}$/;
const UID = /^[^\u0000-\u001f\u007f]{1,300}$/;

/** Schlüssel eines Eintrags: die ganze Serie (`uid`) oder ein Vorkommen (`uid::RECURRENCE-ID`). */
export const bezugSchluessel = (uid: string, rid?: string): string => (rid ? `${uid}::${rid}` : uid);
/** UID eines Schlüssels. */
export const uidVonSchluessel = (s: string): string => { const i = s.indexOf('::'); return i < 0 ? s : s.slice(0, i); };
export const schluesselGueltig = (s: unknown): s is string => typeof s === 'string' && UID.test(s) && !!uidVonSchluessel(s);

/** Nur die Kennungen (für Prüfung, Anzeige, Art. 17). */
export function kennungenVon(b: Partial<TerminBezug> | undefined | null): BezugKennungen {
  const raus: BezugKennungen = {};
  for (const f of BEZUG_FELDER) { const v = b?.[f]; if (typeof v === 'string' && KENNUNG.test(v)) raus[f] = v; }
  return raus;
}

/** Einen Eintrag säubern — null, wenn nichts Gültiges übrig bleibt (dann fällt er weg). */
export function bezugSauber(v: unknown, jetzt = new Date().toISOString()): TerminBezug | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const raus: TerminBezug = {
    ...kennungenVon(o as Partial<TerminBezug>),
    ...(typeof o.von === 'string' && PERSON.test(o.von) ? { von: o.von } : {}),
    ...(istIcsArt(o.art) ? { art: o.art } : {}),
    ...(o.privat === true ? { privat: true as const } : {}),
    ...(typeof o.tag === 'string' && TAG.test(o.tag) ? { tag: o.tag } : {}),
    geaendert: typeof o.geaendert === 'string' && Number.isFinite(Date.parse(o.geaendert)) ? o.geaendert : jetzt,
  };
  const inhalt = Object.keys(raus).filter(k => k !== 'geaendert' && k !== 'tag');
  return inhalt.length ? raus : null;
}

/**
 * Teil-Änderung eines Eintrags (rein): nur mitgekommene Felder, `null`/'' entfernt ein Feld. Liefert null, wenn danach
 * nichts mehr drinsteht (Eintrag fällt weg).
 */
export function bezugAendern(alt: TerminBezug | undefined, teil: Record<string, unknown>, jetzt: string): TerminBezug | null {
  const neu: Record<string, unknown> = { ...(alt ?? {}) };
  for (const [k, v] of Object.entries(teil)) {
    if (![...BEZUG_FELDER, 'von', 'art', 'privat', 'tag'].includes(k)) continue;
    if (v === null || v === '' || v === false || v === undefined) delete neu[k]; else neu[k] = v;
  }
  neu.geaendert = jetzt;
  return bezugSauber(neu, jetzt);
}

/** Ein Termin mit seinem Eintrag (Sicherung angewandt, Kennungen und `von` dazu). */
export type TerminMitBezug = Termin & { bezug?: BezugKennungen; von?: string; maskiert?: true };

/** Bezug + Sicherung auf einen Termin anwenden (Vorrang siehe Kopf). Serien: erst das Vorkommen, dann die Serie. */
export function mitBezug(t: Termin, bestand: BezugBestand | null | undefined): TerminMitBezug {
  // Vorkommen einer Serie: `id` = uid::RECURRENCE-ID (lib/kalender/ics.ts termineAus).
  const b = (t.id !== t.uid ? bestand?.bezuege[t.id] : undefined) ?? bestand?.bezuege[t.uid];
  if (!b) return t;
  const kennungen = kennungenVon(b);
  // Art verloren (Apple hat X-MAKE-ART beim Bearbeiten weggelassen) → Sicherung. Der iCloud-Text sagt „termin“ nur ohne X-MAKE-ART.
  const art = t.art === 'termin' && b.art && b.art !== 'termin' ? b.art : t.art;
  return {
    ...t,
    art,
    ...(b.privat && t.sichtbarkeit !== 'privat' ? { sichtbarkeit: 'privat' as const } : {}),
    ...(Object.keys(kennungen).length ? { bezug: kennungen } : {}),
    ...(b.von ? { von: b.von } : {}),
  };
}

/** Wem gehört der Termin für „privat“? Wer ihn angelegt hat, sonst der Inhaber des Kalenders (nicht beim gemeinsamen). */
export function eigentuemer(t: { von?: string; wer?: string }): string | undefined {
  if (t.von) return t.von;
  return t.wer && t.wer !== 'beide' ? t.wer : undefined;
}

/**
 * Privat in geteilten Sichten (Kevin 29.09.): die andere Person sieht nur „Belegt“ — Zeit ja, sonst nichts (kein Titel,
 * Ort, Notiz, Bezug, keine Erinnerungen), nie änderbar. Ohne bekannten Eigentümer bleibt der Termin sichtbar.
 */
export function maskieren<T extends TerminMitBezug & { wer?: string }>(t: T, betrachter: string | null | undefined): T {
  if (t.sichtbarkeit !== 'privat') return t;
  const e = eigentuemer(t);
  if (!e || e === betrachter) return t;
  const { ort: _o, notiz: _n, bezug: _b, erinnerungen: _e, farbeEigen: _f, farbeId: _fi, arbeitsort: _a, ...rest } = t;
  return { ...rest, titel: 'Belegt', bearbeitbar: false, maskiert: true } as T;
}

/**
 * Abgleich nach einem iCloud-Lauf (rein): für Termine mit X-MAKE-ART ohne Eintrag die Sicherung anlegen (Art, privat,
 * Starttag); bei vorhandenem Eintrag den Starttag nachziehen. Liefert nur die zu schreibenden Einträge.
 */
export function bezugAbgleichPlan(objekte: readonly { uid: string; tag?: string; zusatz: IcsZusatz | null }[], bestand: BezugBestand | null | undefined, jetzt: string): Record<string, TerminBezug> {
  const raus: Record<string, TerminBezug> = {};
  for (const o of objekte) {
    const alt = bestand?.bezuege[o.uid];
    if (!alt && o.zusatz?.art) {
      const neu = bezugSauber({ art: o.zusatz.art, ...(o.zusatz.sichtbarkeit === 'privat' ? { privat: true } : {}), ...(o.tag ? { tag: o.tag } : {}), geaendert: jetzt }, jetzt);
      if (neu) raus[o.uid] = neu;
    } else if (alt && o.tag && alt.tag !== o.tag) raus[o.uid] = { ...alt, tag: o.tag };
  }
  return raus;
}

/** Einträge, deren Art-Sicherung im iCloud-Text fehlt (Apple hat X-MAKE-ART verloren) — für die Verbindungsprüfung. */
export function artVerloren(objekte: readonly { uid: string; zusatz: IcsZusatz | null }[], bestand: BezugBestand | null | undefined): string[] {
  const raus: string[] = [];
  for (const o of objekte) {
    const b = bestand?.bezuege[o.uid];
    if (b?.art && b.art !== 'termin' && !o.zusatz?.art) raus.push(o.uid);
  }
  return raus;
}
