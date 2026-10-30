// ─── Checks — Speicher der Sitzungen und Einstellungen (Server, 24.10., Innovations-Check) ───────────────────────
// Bestand `check-sitzungen` (je Instanz): eine Sitzung je Teilnahme — Antworten, Kontakt (erst nach dem Kurzcheck, freiwillig),
// Ergebnis-Stand, CRM-Verweis. Zugang nur mit dem Zufalls-Token der Sitzung (256 Bit, im Browser gehalten, hier nur als SHA-256 —
// wie die Buchung). Bestand `check-einstellungen`: an/aus (kommt AUS — ohne Inhaber-Klick ist die öffentliche Seite 404),
// Buchungsseite für das Gespräch, Gastgeber. Fristen: ohne Kontakt 30 Tage, mit Kontakt 24 Monate (`checkAufraeumen`).

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { neueKennung } from '@/lib/kennung';
import type { CheckAntworten } from './typen';
import type { KontaktStand } from './ablauf';
import { FRIST_MIT_KONTAKT_MONATE, FRIST_OHNE_KONTAKT_TAGE } from './fristen';

export { FRIST_MIT_KONTAKT_MONATE, FRIST_OHNE_KONTAKT_TAGE };

export const SITZUNGEN = 'check-sitzungen';
export const EINSTELLUNGEN = 'check-einstellungen';

/** Höchstens so viele Sitzungen gleichzeitig im Bestand — darüber nimmt der Start keine neue an (503), nichts wird gekürzt. */
export const SITZUNGEN_MAX = 20_000;

export interface CheckKontakt {
  vorname: string;
  email: string;
  firma: string;
  telefon?: string;
  /** Wunsch nach dem Newsletter (eigene, nicht vorausgewählte Checkbox) — ohne Double-Opt-in geht nichts raus. */
  newsletterWunsch: boolean;
  /** Fassung des Datenschutzhinweises, den die Person gesehen hat. */
  hinweisFassung: string;
  am: string;
}

export interface CheckErgebnisStand {
  am: string;
  gesamt: number;
  stufe: number;
  stufeName: string;
  genauigkeit: 'genau' | 'vorlaeufig';
  dimensionen: Record<string, number>;
  lead: { punkte: number; klasse: 'A' | 'B' | 'C' };
}

export interface CheckSitzung {
  id: string;
  vorlage: string;
  tokenHash: string;
  gestartet: string;
  geaendert: string;
  /** Herkunft (z. B. `homepage_hero`, `linkedin_kevin`, `fokus_qr`) — nur `[a-z0-9_-]`. */
  quelle?: string;
  antworten: CheckAntworten;
  uebersprungen: string[];
  kontaktStand: KontaktStand;
  kontakt?: CheckKontakt;
  wahl?: 'ergebnis' | 'mehr';
  /** Erstes Ergebnis gesehen (abgeschlossen) — für Kennzahlen; danach kann weiter beantwortet werden. */
  abgeschlossen?: string;
  ergebnis?: CheckErgebnisStand;
  /** Verweis ins CRM (Anfrage über die Website) — `abgelehnt` z. B. bei Art. 18, nie an den Teilnehmer. */
  crm?: { status: 'ok' | 'abgelehnt' | 'fehler'; am: string; kontaktId?: string; followUpId?: string; grund?: string };
}

export interface CheckBestand { sitzungen: CheckSitzung[] }

export interface CheckEinstellungen {
  aktiv: boolean;
  /** Adresse der Buchungsseite für das 90-Tage-Umsetzungsgespräch (`<vorsatz>-<24 hex>`, lib/kalender/buchung.ts). */
  buchungSlug?: string;
  /** Speichername der Person, die die Gespräche führt und die Anfragen bekommt — ohne Angabe der Inhaber. */
  gastgeber?: string;
  /** Name, unter dem der Check auftritt (z. B. die Marke der Website) — ohne Angabe die Firma der Instanz ohne Rechtsform. */
  marke?: string;
  geaendert?: string;
  geaendertVon?: string;
}

const TOKEN_OK = /^[a-f0-9]{64}$/;
export const ID_OK = /^ck-[a-z0-9-]{8,60}$/;
export const neuesCheckToken = (): string => randomBytes(32).toString('hex');
export const checkTokenHash = (token: string): string => createHash('sha256').update(`make-os-check|${token}`).digest('hex');
export function checkTokenPasst(token: unknown, hash: string): boolean {
  if (typeof token !== 'string' || !TOKEN_OK.test(token) || !TOKEN_OK.test(hash)) return false;
  return timingSafeEqual(Buffer.from(checkTokenHash(token), 'hex'), Buffer.from(hash, 'hex'));
}

export async function ladeCheckBestand(): Promise<CheckBestand> {
  return (await loadJson<CheckBestand>(SITZUNGEN)) ?? { sitzungen: [] };
}

export async function ladeCheckEinstellungen(): Promise<CheckEinstellungen> {
  const e = await loadJson<CheckEinstellungen>(EINSTELLUNGEN);
  return { aktiv: e?.aktiv === true, ...(e?.buchungSlug ? { buchungSlug: e.buchungSlug } : {}), ...(e?.gastgeber ? { gastgeber: e.gastgeber } : {}), ...(e?.marke ? { marke: e.marke } : {}), ...(e?.geaendert ? { geaendert: e.geaendert, geaendertVon: e.geaendertVon } : {}) };
}

export async function speichereCheckEinstellungen(e: CheckEinstellungen): Promise<CheckEinstellungen> {
  return updateJson<CheckEinstellungen>(EINSTELLUNGEN, () => e);
}

/** Neue Sitzung — Token nur einmal im Klartext zurück. `null`, wenn der Bestand voll ist. */
export async function sitzungAnlegen(vorlage: string, quelle: string | undefined, jetzt = new Date().toISOString()): Promise<{ sitzung: CheckSitzung; token: string } | null> {
  const token = neuesCheckToken();
  const sitzung: CheckSitzung = { id: neueKennung('ck'), vorlage, tokenHash: checkTokenHash(token), gestartet: jetzt, geaendert: jetzt, ...(quelle ? { quelle } : {}), antworten: {}, uebersprungen: [], kontaktStand: 'offen' };
  let voll = false;
  await updateJson<CheckBestand>(SITZUNGEN, cur => {
    const b = cur ?? { sitzungen: [] };
    if (b.sitzungen.length >= SITZUNGEN_MAX) { voll = true; return b; }
    return { ...b, sitzungen: [...b.sitzungen, sitzung] };
  });
  return voll ? null : { sitzung, token };
}

/** Sitzung nur mit passendem Token — sonst null (unbekannt und falsches Token sind von außen nicht zu unterscheiden). */
export async function sitzungLesen(id: unknown, token: unknown): Promise<CheckSitzung | null> {
  if (typeof id !== 'string' || !ID_OK.test(id)) return null;
  const s = (await ladeCheckBestand()).sitzungen.find(x => x.id === id);
  return s && checkTokenPasst(token, s.tokenHash) ? s : null;
}

/**
 * Ändert EINE Sitzung in der Sperre des Bestands — Token wird IN der Sperre geprüft. `aendern` gibt die neue Sitzung zurück oder
 * einen Fehler (dann bleibt alles, wie es war). Ergebnis: die gespeicherte Sitzung, `null` (nicht gefunden) oder der Fehler.
 */
export async function sitzungAendern<F>(id: unknown, token: unknown, aendern: (s: CheckSitzung) => CheckSitzung | { fehler: F }, jetzt = new Date().toISOString()): Promise<CheckSitzung | { fehler: F } | null> {
  if (typeof id !== 'string' || !ID_OK.test(id)) return null;
  let aus: CheckSitzung | { fehler: F } | null = null;
  await updateJson<CheckBestand>(SITZUNGEN, cur => {
    const b = cur ?? { sitzungen: [] };
    const i = b.sitzungen.findIndex(x => x.id === id);
    if (i < 0 || !checkTokenPasst(token, b.sitzungen[i].tokenHash)) return b;
    const r = aendern(b.sitzungen[i]);
    if ('fehler' in r) { aus = r; return b; }
    const neu = { ...r, geaendert: jetzt };
    aus = neu;
    return { ...b, sitzungen: b.sitzungen.map((x, j) => (j === i ? neu : x)) };
  });
  return aus;
}

/** Ändert eine Sitzung ohne Token (nur Server-Wege: CRM-Verweis nachtragen, Beleg-Bewertung durch den Haushalt). */
export async function sitzungIntern(id: string, aendern: (s: CheckSitzung) => CheckSitzung): Promise<CheckSitzung | null> {
  let aus: CheckSitzung | null = null;
  await updateJson<CheckBestand>(SITZUNGEN, cur => {
    const b = cur ?? { sitzungen: [] };
    const i = b.sitzungen.findIndex(x => x.id === id);
    if (i < 0) return b;
    aus = aendern(b.sitzungen[i]);
    return { ...b, sitzungen: b.sitzungen.map((x, j) => (j === i ? aus! : x)) };
  });
  return aus;
}

/** Löschfrist (rein): Sitzungen ohne Kontakt nach 30 Tagen, mit Kontakt nach 24 Monaten ohne Änderung. */
export function checkAufraeumen(b: CheckBestand, jetzt: Date): { bestand: CheckBestand; entfernt: number } {
  const ohne = jetzt.getTime() - FRIST_OHNE_KONTAKT_TAGE * 86_400_000;
  const mit = new Date(jetzt); mit.setUTCMonth(mit.getUTCMonth() - FRIST_MIT_KONTAKT_MONATE);
  const bleibt = b.sitzungen.filter(s => Date.parse(s.geaendert) >= (s.kontakt ? mit.getTime() : ohne));
  return { bestand: { ...b, sitzungen: bleibt }, entfernt: b.sitzungen.length - bleibt.length };
}

/** Morgenlauf: Löschfrist anwenden (schreibt nur, wenn etwas wegfällt). */
export async function checkFristLauf(jetzt = new Date()): Promise<number> {
  if (!(await loadJson<CheckBestand>(SITZUNGEN))) return 0;
  let entfernt = 0;
  await updateJson<CheckBestand>(SITZUNGEN, cur => {
    const r = checkAufraeumen(cur ?? { sitzungen: [] }, jetzt);
    entfernt = r.entfernt;
    return r.entfernt ? r.bestand : (cur ?? r.bestand);
  });
  return entfernt;
}

/** Art. 15/17: Sitzungen mit dieser Kontaktadresse (klein geschrieben verglichen). */
export const sitzungenMitAdresse = (b: CheckBestand, adressen: readonly string[]): CheckSitzung[] => {
  const set = new Set(adressen.map(a => a.trim().toLowerCase()).filter(Boolean));
  return b.sitzungen.filter(s => s.kontakt && set.has(s.kontakt.email.toLowerCase()));
};
