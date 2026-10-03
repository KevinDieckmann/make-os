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
import { ausgenommen } from './einschraenkung';
import type { Kontakt } from '@/lib/make-one/crm';

/** Ist das Event ein BESUCHTES (fremde Veranstaltung)? Dieselbe Regel wie die Trennung der Make.One-Kennzahlen. */
export const istBesuch = (e: Pick<Event, 'marke'>): boolean => istNetzwerkenEvent(e);

/** Obergrenzen — darüber lehnt der Server mit 413 ab (nie still kürzen, `LISTEN_GRENZEN`). */
export const ZIELPERSONEN_MAX = 300;
export const UEBERGABEN_MAX = 100;
/** Personen je Übergabe im Protokoll (`kontaktIds`) — darüber lehnt die Route ab (413), nie still gekürzt. */
export const UEBERGABE_KONTAKTE_MAX = 3000;
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

/** Link: nur https, ohne Leerraum — nie javascript: o. Ä. */
export function linkSaeubern(v: unknown): string | undefined {
  const t = text(v, LINK_MAX);
  return /^https:\/\/[^\s]+$/i.test(t) ? t : undefined;
}

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

/**
 * Übergabe-Protokoll säubern: Tag, Person, Anzahl — dazu (03.10., netz-recht) optional Empfänger (Firma), Dateiname, Kennungen der
 * übergebenen Personen (nie Namen) und der Haken „Rolle/Vertrag geklärt“. Die Kennungen kürzt die Säuberung nicht still: mehr als
 * `UEBERGABE_KONTAKTE_MAX` verwirft den ganzen Eintrag nicht, sondern lässt nur die Liste weg — die Route lehnt so große Übergaben vorher ab.
 */
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
    const firma = text(o.empfaengerFirmaId, 70);
    const datei = text(o.dateiname, 120);
    const ids = Array.isArray(o.kontaktIds) ? Array.from(new Set(o.kontaktIds.filter((k): k is string => typeof k === 'string' && istKontaktKennung(k)))) : [];
    raus.push({
      am, von, anzahl: Math.min(100000, Math.round(n)),
      ...(FIRMA_ID.test(firma) ? { empfaengerFirmaId: firma } : {}),
      ...(/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(datei) ? { dateiname: datei } : {}),
      ...(ids.length && ids.length <= UEBERGABE_KONTAKTE_MAX ? { kontaktIds: ids } : {}),
      ...(o.avvBzwHinweisBestaetigt === true ? { avvBzwHinweisBestaetigt: true } : {}),
    });
    if (raus.length >= max) break;
  }
  return raus.length ? raus : undefined;
}

/**
 * Ist diese Zielperson inzwischen gesperrt (Art. 18 eingeschränkt oder Werbesperre)? Nur für die ANZEIGE in der Event-Akte
 * („gesperrt“, ausgegraut) — der Server-Weg der Zielpersonen (Neuaufnahme, Haken) lehnt gesperrte Personen selbst ab
 * (`personenSchranke`). `null` = nicht gesperrt (oder Person nicht in der Kartei).
 */
export function zielpersonGesperrt(k: Pick<Kontakt, 'eingeschraenkt' | 'werbesperre'> | null | undefined): 'eingeschraenkt' | 'werbesperre' | null {
  if (!k || !ausgenommen(k)) return null;
  return k.eingeschraenkt ? 'eingeschraenkt' : 'werbesperre';
}

/** Anmeldestand säubern: nur die vier bekannten Werte. */
export const anmeldungSaeubern = (v: unknown): EventAnmeldung | undefined => (ANMELDUNGEN.some(a => a.id === v) ? (v as EventAnmeldung) : undefined);
