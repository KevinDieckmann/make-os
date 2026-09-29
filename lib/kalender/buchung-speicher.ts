// ─── Kalender — Speicher der Buchungsseiten (Server, 29.09., Paket K4) ───────
// Bestand `buchung--<haushalt>` (Haushalt des Inhabers, wie Kartei und Sperrliste — `karteiHaushalt`),
// verschlüsselt wie jeder Bestand über local-db: Buchungsseiten, Buchungen (Name, E-Mail, Anliegen,
// Einwilligungs-Nachweis, Hash des Status-Tokens). Arbeitszeiten stehen NICHT hier (Wochenvorlage, K1).
// Register: lib/crm/speicher-register.ts (`buchung--*`, Art. 17 über lib/crm/person-weitere.ts, Löschfrist
// „buchungen“ im Löschfristen-Lauf). Jede Änderung zieht vorher Abgelaufenes nach (nie löschen — das macht nur
// die Löschfrist mit Protokoll).
//
// Geheimnisse: Status-Token (32 Byte Zufall, base64url) kennt nur der Buchende — gespeichert wird der SHA-256.
// Der Formular-Stempel (Zeitprüfung gegen Maschinen) ist mit dem Sitzungsgeheimnis signiert (HMAC-SHA-256).

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { karteiHaushalt } from '@/lib/crm/sperrliste';
import { sitzungsGeheimnis } from '@/lib/zugang/sitzung';
import { protokolliere, type Aenderung, type Wer } from '@/lib/store/aenderungsprotokoll';
import { bestandSauber, ablaufNachziehen, loeschfristAnwenden, slugVorsatz, type BuchungBestand } from './buchung';

export async function buchungHaushalt(): Promise<string> { return karteiHaushalt(); }

/** Bestand lesen (Abgelaufenes nur in der Sicht nachgezogen — geschrieben wird beim nächsten Ändern). */
export async function ladeBuchungBestand(jetzt = new Date()): Promise<BuchungBestand> {
  const h = await buchungHaushalt();
  return ablaufNachziehen(bestandSauber(await loadJson<BuchungBestand>(`buchung--${h}`)), jetzt).bestand;
}

/** Bestand in EINER Sperre ändern — `mut` bekommt den frischen, nachgezogenen Stand. */
export async function aendereBuchungBestand(mut: (b: BuchungBestand) => BuchungBestand, jetzt = new Date()): Promise<BuchungBestand> {
  const h = await buchungHaushalt();
  return updateJson<BuchungBestand>(`buchung--${h}`, cur => mut(ablaufNachziehen(bestandSauber(cur), jetzt).bestand));
}

/**
 * Änderungsprotokoll des Bestands (nur Kennungen und Feldnamen, nie Namen/Adressen). Handlungen des Buchenden auf der
 * öffentlichen Seite laufen als „system“ mit Liste „buchungen“ und Feld „oeffentlich“.
 */
export async function buchungProtokoll(aenderungen: Aenderung[], wer: Wer): Promise<void> {
  await protokolliere(`buchung--${await buchungHaushalt()}`, aenderungen, wer);
}

/**
 * Löschfrist (täglicher Lauf lib/crm/loeschfristen-lauf.ts, Frist „buchungen“): Endzustände nach `tage`, bestätigte
 * `tage` nach dem Termin fallen weg — mit Protokoll (nur Kennungen). Legt nie einen leeren Bestand an. Liefert die Zahl.
 */
export async function buchungenLoeschfrist(jetzt: Date, tage: number): Promise<number> {
  const h = await buchungHaushalt();
  if ((await loadJson<BuchungBestand>(`buchung--${h}`)) === null) return 0;
  let entfernt: string[] = [];
  await updateJson<BuchungBestand>(`buchung--${h}`, cur => {
    const r = loeschfristAnwenden(ablaufNachziehen(bestandSauber(cur), jetzt).bestand, jetzt, tage);
    entfernt = r.entfernt;
    return r.bestand;
  });
  if (entfernt.length) await protokolliere(`buchung--${h}`, entfernt.map(id => ({ liste: 'buchungen', op: 'geloescht' as const, id, felder: ['loeschfrist'] })), { art: 'system' });
  return entfernt.length;
}

// ── Token, Adresse, Stempel ─────────────────────────────────────────────────

const b64url = (b: Buffer) => b.toString('base64url');
/** Neues Status-Token (256 Bit). */
export const neuesToken = (): string => b64url(randomBytes(32));
export const TOKEN_OK = /^[A-Za-z0-9_-]{43}$/;
/** Gespeichert wird nur der Hash. */
export const tokenHash = (token: string): string => createHash('sha256').update(`make-os-buchung|${token}`).digest('hex');
/** Vergleich in konstanter Zeit. */
export function tokenPasst(token: string, hash: string): boolean {
  if (!TOKEN_OK.test(token) || !/^[a-f0-9]{64}$/.test(hash)) return false;
  return timingSafeEqual(Buffer.from(tokenHash(token), 'hex'), Buffer.from(hash, 'hex'));
}

/**
 * Bestätigungslink der E-Mail-Adresse (R-K2 #76): eigenes Token (256 Bit) mit eigenem Hash-Vorsatz — ein Status-Token
 * passt nie als Mail-Token und umgekehrt. Gespeichert wird nur der Hash (`Buchung.mailLink.hash`).
 */
export const mailTokenHash = (token: string): string => createHash('sha256').update(`make-os-buchung-mail|${token}`).digest('hex');
export function mailTokenPasst(token: string, hash: string | undefined): boolean {
  if (!hash || !TOKEN_OK.test(token) || !/^[a-f0-9]{64}$/.test(hash)) return false;
  return timingSafeEqual(Buffer.from(mailTokenHash(token), 'hex'), Buffer.from(hash, 'hex'));
}

/** Neue Adresse: lesbarer Vorsatz + 96 Bit Zufall (hex) — nicht erratbar, nicht aufzählbar. */
export const neuerSlug = (titel: string): string => `${slugVorsatz(titel)}-${randomBytes(12).toString('hex')}`;

const stempelSig = (slug: string, ms: number) => createHmac('sha256', `${sitzungsGeheimnis()}|buchung-formular`).update(`${slug}|${ms}`).digest('base64url');
/** Formular-Stempel „<ms>.<signatur>“ — beim Laden der Seite ausgegeben. */
export const formularStempel = (slug: string, ms = Date.now()): string => `${ms}.${stempelSig(slug, ms)}`;
/** Zeit aus einem Stempel — null, wenn gefälscht oder kaputt. */
export function stempelZeit(slug: string, stempel: unknown): number | null {
  if (typeof stempel !== 'string' || stempel.length > 80) return null;
  const [ms, sig] = stempel.split('.');
  const n = Number(ms);
  if (!Number.isInteger(n) || !sig) return null;
  const soll = Buffer.from(stempelSig(slug, n)), ist = Buffer.from(sig);
  return soll.length === ist.length && timingSafeEqual(soll, ist) ? n : null;
}
