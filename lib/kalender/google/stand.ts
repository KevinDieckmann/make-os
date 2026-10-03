// ─── Google Kalender — Bestand je Person und Überlagerung des Kalender-Stands (Server, 03.10.2026) ─
// Je Person EIN Bestand `kalender-google--<person>` (verschlüsselt wie jeder Bestand): der gewählte Google-Kalender, der
// syncToken, die Ereignisse (schlank, `GEvent`), Abgleich-Zustand, der Push-Kanal und die ETags der eigenen Schreibungen
// (Echo-Erkennung). Das Ganze ist ein SPIEGEL — Wahrheit ist Google; Löschen/Art. 17 geschieht dort (Speicher-Register:
// „ausgenommen“, wie `kalender-icloud`). Der Bestand ist neu und optional: ein Rückweg auf den alten Online-Stand liest ihn nie.
//
// Überlagerung: `ladeStand()` (lib/kalender/icloud.ts) legt diese Kalender über den iCloud-Stand — jeder Google-Kalender
// wird ein `KalenderEintrag` (`quelle: 'google'`, `person`, `ich` = die Adresse des Kontos) mit seinen Objekten (ICS aus
// `objekteAus`). Alle Leser, die über den Stand laufen (Kalender, Heute, Wochenplan, ZOE, Verfügbarkeit, Spiegel,
// Verbindungsprüfung, Signale), sehen die Google-Termine so ohne eigene Sonderbehandlung.

import { loadJson, updateJson } from '@/lib/store/local-db';
import type { KalenderObjekt } from '../ics';
import { objekteAus, uidVonEvent, type GEvent } from './abbilden';
import { fnv } from '../bezug';

export const standName = (person: string) => `kalender-google--${person}`;

export interface KanalStand {
  /** Kanal-Kennung `mk-<person>-<24 hex>` — die Person steckt darin, der Webhook findet so den Bestand. */
  id: string;
  /** SHA-256 des Kanal-Tokens (das Token selbst kennt nur Google). */
  tokenHash: string;
  resourceId: string;
  /** Ablauf (ms). */
  ablauf: number;
  adresse: string;
  angelegt: string;
}

export interface GoogleKalenderStand {
  v: 1;
  person: string;
  /** Adresse des Google-Kontos (für „bin ich Organisator/Gast?“) — nur serverseitig. */
  email: string;
  kalenderId: string;
  /** Name in MAKE OS (eindeutig je Person): „MAKE Kevin (Google)“. */
  kalenderName: string;
  zeitzone?: string;
  farbe?: string;
  schreibbar: boolean;
  syncToken?: string;
  /** Beginn des Holfensters der Volllesung (Tag). */
  fensterAb?: string;
  events: Record<string, GEvent>;
  /** Letzter GELUNGENER Abgleich. */
  at?: string;
  fehler?: string;
  fehlerAt?: string;
  fehlerAnmeldung?: boolean;
  fehlerFolge?: number;
  pauseBis?: string;
  /** Die Glocke „Verbindung getrennt“ ist schon gemeldet. */
  getrenntGemeldet?: boolean;
  kanal?: KanalStand;
  /** Google-ID → ETag unserer letzten eigenen Schreibung (Echo-Erkennung beim nächsten Abgleich). */
  eigene?: Record<string, string>;
  /** Letzter Abgleich: wie viele Ereignisse von AUSSEN (nicht von uns) geändert wurden, und wann. */
  aussen?: { at: string; n: number };
  /** Zähler: ändert sich mit jedem Schreiben — Schlüssel für den Objekt-Zwischenspeicher. */
  rev: number;
}

export const standLeer = (o: { person: string; email: string; kalenderId: string; kalenderName: string; zeitzone?: string; farbe?: string; schreibbar: boolean }): GoogleKalenderStand => ({ v: 1, ...o, events: {}, rev: 0 });

export async function ladeGoogleStand(person: string): Promise<GoogleKalenderStand | null> {
  if (!/^[a-z0-9-]{1,40}$/.test(person)) return null;
  const s = await loadJson<GoogleKalenderStand>(standName(person));
  return s && s.v === 1 && s.events && typeof s.kalenderId === 'string' ? s : null;
}

/** Bestand ändern (serialisiert) — `mutate` bekommt den aktuellen Stand und liefert den neuen; `rev` zählt mit. */
export async function aendereGoogleStand(person: string, mutate: (s: GoogleKalenderStand) => GoogleKalenderStand | null): Promise<GoogleKalenderStand | null> {
  // Ohne Bestand nichts schreiben (updateJson würde sonst eine leere Datei anlegen).
  if (!(await ladeGoogleStand(person))) return null;
  let ergebnis: GoogleKalenderStand | null = null;
  await updateJson<GoogleKalenderStand | { v: 0 } | null>(standName(person), cur => {
    const s = cur && (cur as GoogleKalenderStand).v === 1 ? cur as GoogleKalenderStand : null;
    if (!s) return cur as null;
    const neu = mutate(s);
    if (!neu) return cur as GoogleKalenderStand;
    ergebnis = { ...neu, rev: s.rev + 1 };
    return ergebnis;
  });
  return ergebnis;
}

/** Bestand anlegen oder ersetzen (z. B. beim Verbinden/Kalender wechseln) — der `rev` läuft weiter, damit kein Zwischenspeicher veraltet stimmt. */
export async function setzeGoogleStand(person: string, neu: GoogleKalenderStand): Promise<GoogleKalenderStand> {
  let rev = 0;
  const alt = await loadJson<GoogleKalenderStand>(standName(person));
  if (alt && typeof alt.rev === 'number') rev = alt.rev;
  const s = { ...neu, rev: rev + 1 };
  await updateJson<GoogleKalenderStand>(standName(person), () => s);
  return s;
}

/** Grabstein statt Löschen (die Datenschicht kennt kein Löschen): ohne Ereignisse, ohne Token-Bezug. */
export async function leereGoogleStand(person: string): Promise<void> {
  await updateJson<GoogleKalenderStand | { v: 0; getrenntAm: string }>(standName(person), () => ({ v: 0, getrenntAm: new Date().toISOString() }));
  zwischen.delete(person);
}

// ── Objekte aus dem Stand (zwischengespeichert je `rev`) ─────────────────────

const zwischen = new Map<string, { schluessel: string; objekte: KalenderObjekt[]; kurz: ReturnType<typeof objekteAus>['kurz'] }>();
export function objekteVon(s: GoogleKalenderStand): { objekte: KalenderObjekt[]; kurz: ReturnType<typeof objekteAus>['kurz'] } {
  // Schlüssel: Zähler + Stand des Abgleichs + Größe + Token — ein ersetzter oder zurückgesetzter Bestand trifft nie einen alten Eintrag.
  const schluessel = `${s.rev}|${s.at ?? ''}|${Object.keys(s.events).length}|${s.syncToken ?? ''}|${s.kalenderId}`;
  const c = zwischen.get(s.person);
  if (c && c.schluessel === schluessel) return c;
  const r = objekteAus(s.events, s.person);
  zwischen.set(s.person, { schluessel, ...r });
  return r;
}

/** Kennung des Kalenders in MAKE OS (Adresse → Schlüssel `google-<person>|uid`; Test: lib/kalender/bezug.ts `kalenderKennung`). */
export const kalenderIdVon = (person: string) => `google:kalender/google-${person}`;
export const istGoogleKalender = (k: { quelle?: string } | null | undefined): boolean => k?.quelle === 'google';

export interface GoogleKalenderEintrag {
  id: string; name: string; farbe?: string; ctag?: string; schreibbar: boolean;
  quelle: 'google'; person: string; ich: string[];
}

/** Die Kalender + Objekte aller verbundenen Personen — für `ladeStand()`. `personen` = Kandidaten (die Konten). */
export async function ueberlagerung(personen: readonly string[]): Promise<{ kalender: GoogleKalenderEintrag[]; objekte: Record<string, KalenderObjekt[]> }> {
  const kalender: GoogleKalenderEintrag[] = [];
  const objekte: Record<string, KalenderObjekt[]> = {};
  for (const p of personen) {
    const s = await ladeGoogleStand(p);
    if (!s) continue;
    const id = kalenderIdVon(p);
    kalender.push({ id, name: s.kalenderName, ...(s.farbe ? { farbe: s.farbe } : {}), ctag: String(s.rev), schreibbar: s.schreibbar, quelle: 'google', person: p, ich: [s.email] });
    objekte[id] = objekteVon(s).objekte;
  }
  return { kalender, objekte };
}

// ── Suchen im Stand ─────────────────────────────────────────────────────────

/** Das Master-Ereignis (nicht eine Ausnahme) zu einer UID. */
export function findeEvent(s: GoogleKalenderStand, uid: string): GEvent | null {
  for (const e of Object.values(s.events)) if (!e.recurringEventId && uidVonEvent(e) === uid) return e;
  return null;
}

/** Ereignisse (roh, schlank) in den Stand legen bzw. entfernen — Master weg → seine Ausnahmen mit. */
export function ereignisseAnwenden(events: Record<string, GEvent>, neu: readonly GEvent[]): Record<string, GEvent> {
  const raus = { ...events };
  for (const e of neu) {
    if (e.status === 'cancelled' && !e.recurringEventId) {
      delete raus[e.id];
      for (const [k, v] of Object.entries(raus)) if (v.recurringEventId === e.id) delete raus[k];
    } else raus[e.id] = e;
  }
  return raus;
}

/** Kurzer Fingerabdruck eines Standes — für Tests und Protokolle (nie Inhalte). */
export const standMarke = (s: GoogleKalenderStand): string => fnv(`${s.rev}|${Object.keys(s.events).length}|${s.syncToken ?? ''}`);
