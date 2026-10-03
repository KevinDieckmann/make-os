// ─── Besuchte Events — Form, Säuberung, Anmeldestand (rein, getestet; 03.10.) ───
// Kevin: „Einmal wirklich Make.One und daneben das ganze Thema Events“ — Events = alle Veranstaltungen, die wir BESUCHEN
// (fremde Events, Messen, Kunden-Events). Ein Datenbestand: besuchte Events sind Events mit `marke: 'Netzwerken'`
// (lib/crm/marke.ts `istNetzwerkenEvent`); die neuen Felder (`fuer`, `anmeldung`, `wer`, `link`, `zielpersonen`,
// `uebergaben`) sind alle OPTIONAL — alte Daten lesen sich ohne Migration weiter.
// Dieses Modul hat bewusst kaum Abhängigkeiten, damit der Säuberer (lib/crm/speicher.ts) es laden kann:
//   · `anmeldungVon` / `anmeldungPatch` — Anmeldestand und wie `status` mitzieht (Kalender-Spiegel, Heads lesen `status`)
//   · `fuerVon` / `fuerSaeubern` — „für wen“: MAKE oder Kunde (Firma der Kartei, Mandat optional)
//   · `zielpersonenSaeubern`, `uebergabenSaeubern`, `linkSaeubern`, `werSaeubern`
// Die Rechnungen (Wirkung je Event, Export für Kunden) stehen in lib/crm/besuche.ts.

import type { Event, EventAnmeldung, EventFuer, EventUebergabe, EventZielperson } from './typen';
import { istNetzwerkenEvent } from './marke';
import { wer as teamWer, BEIDE } from './team';
import { istKontaktKennung } from '@/lib/kennung';

/** Ist das Event ein BESUCHTES (fremde Veranstaltung)? Dieselbe Regel wie die Trennung der Make.One-Kennzahlen. */
export const istBesuch = (e: Pick<Event, 'marke'>): boolean => istNetzwerkenEvent(e);

/** Obergrenzen — darüber lehnt der Server mit 413 ab (nie still kürzen, `LISTEN_GRENZEN`). */
export const ZIELPERSONEN_MAX = 300;
export const UEBERGABEN_MAX = 100;
export const WER_MAX = 8;
export const LINK_MAX = 500;

export const ANMELDUNGEN: readonly { id: EventAnmeldung; label: string }[] = [
  { id: 'geplant', label: 'Geplant' },
  { id: 'angemeldet', label: 'Angemeldet' },
  { id: 'abgesagt', label: 'Abgesagt' },
  { id: 'besucht', label: 'Besucht' },
];
export const anmeldungLabel = (a: EventAnmeldung): string => ANMELDUNGEN.find(x => x.id === a)?.label ?? a;

/** Anmeldestand: der gesetzte, sonst aus dem Status des Events abgeleitet (nie zurückgeschrieben). */
export function anmeldungVon(e: Pick<Event, 'anmeldung' | 'status'>): EventAnmeldung {
  if (e.anmeldung) return e.anmeldung;
  if (e.status === 'abgesagt') return 'abgesagt';
  if (e.status === 'durchgefuehrt') return 'besucht';
  return 'geplant';
}

/**
 * Anmeldestand setzen — `status` zieht mit, damit Kalender-Spiegel (Absage löscht den Termin), Heads und Kennzahlen
 * dasselbe sehen: besucht → durchgefuehrt · abgesagt → abgesagt · geplant/angemeldet → geplant.
 */
export function anmeldungPatch(neu: EventAnmeldung): Pick<Event, 'anmeldung' | 'status'> {
  return { anmeldung: neu, status: neu === 'besucht' ? 'durchgefuehrt' : neu === 'abgesagt' ? 'abgesagt' : 'geplant' };
}

/** Ist das besuchte Event abgesagt (Anmeldestand ODER Status)? */
export const besuchAbgesagt = (e: Pick<Event, 'anmeldung' | 'status'>): boolean => e.anmeldung === 'abgesagt' || e.status === 'abgesagt';

/** Für wen: gesetzt, sonst MAKE selbst. */
export const fuerVon = (e: Pick<Event, 'fuer'>): EventFuer => e.fuer ?? { art: 'make' };
/** Die Kunden-Firma, für die das Event läuft — oder null. */
export const fuerFirmaId = (e: Pick<Event, 'fuer'>): string | null => (e.fuer?.art === 'kunde' ? e.fuer.firmaId : null);

const FIRMA_ID = /^f-[a-z0-9-]{2,63}$/;
const ID = /^[a-z0-9][a-z0-9-]{1,63}$/;
const text = (v: unknown, n: number) => String(v ?? '').replace(/\u0000/g, '').trim().slice(0, n);

/** „Für wen“ säubern: MAKE bleibt weg (Standard), ein Kunde braucht eine gültige Firmenkennung, das Mandat ist optional. */
export function fuerSaeubern(v: unknown): EventFuer | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  if (o.art === 'kunde') {
    const firmaId = text(o.firmaId, 70);
    if (!FIRMA_ID.test(firmaId)) return undefined;
    const mandatId = text(o.mandatId, 70);
    return { art: 'kunde', firmaId, ...(ID.test(mandatId) ? { mandatId } : {}) };
  }
  return undefined;
}

/** Wer geht hin: Team-Kürzel, ohne „beide“ und Doppelte, höchstens `WER_MAX`. */
export function werSaeubern(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const liste = Array.from(new Set(v.map(x => teamWer(x)).filter((x): x is string => !!x && x !== BEIDE))).slice(0, WER_MAX);
  return liste.length ? liste : undefined;
}

/** Link-Fehlertext — sichtbar in der Akte und in der Antwort des Servers (nie still verwerfen, der Eintrag ginge sonst unbemerkt verloren). */
export const LINK_FEHLER = 'Der Link sieht nicht gültig aus — bitte eine Adresse wie https://messe.example/programm oder messe.example/programm eintragen (kein Leerraum, nur http und https).';

/**
 * Link normalisieren: `https://…` und `http://…` bleiben, eine Adresse OHNE Schema („messe.example/programm“) bekommt `https://` vorangestellt; jedes andere Schema
 * (`javascript:`, `data:`, `mailto:` …), Leerraum, zu lang oder kein Rechnername mit Punkt → undefined. Ein Port („messe.example:8080/x“) ist kein Schema.
 */
export function linkNormal(v: unknown): string | undefined {
  const roh = String(v ?? '').replace(/\u0000/g, '').trim();
  if (!roh || roh.length > LINK_MAX || /\s/.test(roh)) return undefined;
  if (/^https?:\/\/[^\s/?#]+/i.test(roh)) return /^https?:\/\/[^\s/?#]*\.[^\s/?#]*/i.test(roh) || /^https?:\/\/localhost\b/i.test(roh) ? roh : undefined;
  if (/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(roh)) return undefined;
  const host = /^[^/?#]+/.exec(roh)?.[0] ?? '';
  const mitHttps = `https://${roh}`;
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d{1,5})?$/i.test(host) && mitHttps.length <= LINK_MAX ? mitHttps : undefined;
}
/** Wie `linkNormal` — der Name aus dem Säuberer (`zusatz('events')`). */
export const linkSaeubern = linkNormal;

/** Schlüssel einer Zielperson (für Doppelte und Abhaken). */
export const zielSchluessel = (z: Pick<EventZielperson, 'kontaktId' | 'firmaId'>): string => (z.kontaktId ? `k:${z.kontaktId}` : `f:${z.firmaId ?? ''}`);

/** Zielpersonen säubern: Person ODER Firma (gültige Kennung), ohne Doppelte; `getroffen` nur als `true`. Länge prüft `crmGrenzen`. */
export function zielpersonenSaeubern(v: unknown, max = ZIELPERSONEN_MAX): EventZielperson[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const gesehen = new Set<string>();
  const raus: EventZielperson[] = [];
  for (const x of v) {
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    const kontaktId = typeof o.kontaktId === 'string' && istKontaktKennung(o.kontaktId) ? o.kontaktId : undefined;
    const firmaId = typeof o.firmaId === 'string' && FIRMA_ID.test(o.firmaId) ? o.firmaId : undefined;
    if (!kontaktId && !firmaId) continue;
    const z: EventZielperson = { ...(kontaktId ? { kontaktId } : {}), ...(firmaId ? { firmaId } : {}), ...(o.getroffen === true ? { getroffen: true } : {}) };
    const s = zielSchluessel(z);
    if (gesehen.has(s)) continue;
    gesehen.add(s);
    raus.push(z);
    if (raus.length >= max) break;
  }
  return raus.length ? raus : undefined;
}

/** Eine Änderung an der Zielliste eines Events — immer EINE Person/Firma (nie die ganze Liste), damit zwei Geräte einander nicht überschreiben. */
export type ZielAenderung = { op: 'hinzu' | 'weg'; kontaktId?: string; firmaId?: string } | { op: 'getroffen'; kontaktId?: string; firmaId?: string; wert: boolean };

/** Die Änderung aus dem Netz prüfen (Form) — null, wenn weder eine gültige Person noch eine gültige Firma genannt ist. */
export function zielAenderungAus(v: unknown): ZielAenderung | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const kontaktId = typeof o.kontaktId === 'string' && istKontaktKennung(o.kontaktId) ? o.kontaktId : undefined;
  const firmaId = typeof o.firmaId === 'string' && FIRMA_ID.test(o.firmaId) ? o.firmaId : undefined;
  if (!kontaktId === !firmaId) return null;   // genau eins von beiden
  const ziel = kontaktId ? { kontaktId } : { firmaId: firmaId! };
  if (o.op === 'hinzu' || o.op === 'weg') return { op: o.op, ...ziel };
  if (o.op === 'getroffen' && typeof o.wert === 'boolean') return { op: 'getroffen', ...ziel, wert: o.wert };
  return null;
}

/**
 * Die Änderung auf die AKTUELLE Liste anwenden (Server, in der Sperre). `fehler`: 413 über der Grenze (nie gekürzt), 404 für „getroffen“ an einem Eintrag, den es
 * nicht (mehr) gibt. „hinzu“ bei vorhandenem Eintrag und „weg“ bei fehlendem sind kein Fehler (wiederholbar).
 */
export function zielAendern(liste: readonly EventZielperson[] | undefined, a: ZielAenderung): { liste: EventZielperson[]; fehler?: { status: number; text: string } } {
  const alt = [...(liste ?? [])];
  const schluessel = zielSchluessel(a);
  const da = alt.some(z => zielSchluessel(z) === schluessel);
  if (a.op === 'hinzu') {
    if (da) return { liste: alt };
    if (alt.length >= ZIELPERSONEN_MAX) return { liste: alt, fehler: { status: 413, text: `Höchstens ${ZIELPERSONEN_MAX} Zielpersonen je Event.` } };
    return { liste: [...alt, a.kontaktId ? { kontaktId: a.kontaktId } : { firmaId: a.firmaId! }] };
  }
  if (a.op === 'weg') return { liste: alt.filter(z => zielSchluessel(z) !== schluessel) };
  if (!da) return { liste: alt, fehler: { status: 404, text: 'Diese Zielperson steht nicht (mehr) auf der Liste.' } };
  const getroffen = a.op === 'getroffen' && a.wert;
  return { liste: alt.map(z => (zielSchluessel(z) === schluessel ? { ...(z.kontaktId ? { kontaktId: z.kontaktId } : {}), ...(z.firmaId ? { firmaId: z.firmaId } : {}), ...(getroffen ? { getroffen: true } : {}) } : z)) };
}

/** Übergabe-Protokoll säubern: Tag, Person, Anzahl — sonst nichts. */
export function uebergabenSaeubern(v: unknown, max = UEBERGABEN_MAX): EventUebergabe[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const raus: EventUebergabe[] = [];
  for (const x of v) {
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    const am = text(o.am, 25);
    const von = text(o.von, 40);
    const n = Number(o.anzahl);
    if (!/^\d{4}-\d{2}-\d{2}/.test(am) || !/^[a-z0-9-]{1,40}$/.test(von) || !Number.isFinite(n) || n < 0) continue;
    raus.push({ am, von, anzahl: Math.min(100000, Math.round(n)) });
    if (raus.length >= max) break;
  }
  return raus.length ? raus : undefined;
}

/** Anmeldestand säubern: nur die vier bekannten Werte. */
export const anmeldungSaeubern = (v: unknown): EventAnmeldung | undefined => (ANMELDUNGEN.some(a => a.id === v) ? (v as EventAnmeldung) : undefined);
