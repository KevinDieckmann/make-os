// ─── Markttraktion › Formulare — der Bestand (nur Server, 25.10.2026) ────────────────────────────────────────────────────────────────────
// EIN Bestand je Haushalt (des Inhabers, wie Kartei und CRM): `angebot-formular--<haushalt>` — Einstellungen, externe Links (nur Fingerabdruck
// des Link-Tokens), Eingänge (nur Kennungen, Empfänger als Fingerabdruck + maskiert). Gelesen und geschrieben nur hier; die Löschfrist der
// Eingänge (`EINGANG_FRIST_MONATE`) wirkt bei jedem Schreiben (Speicher-Register: Frist „24 Monate“, rollend). Keine Kundendaten im Klartext.

import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { sitzungsGeheimnis } from '@/lib/zugang/sitzung';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { karteiHaushalt } from './sperrliste';
import { hmacHex, shaHex } from '@/lib/datenschutz/pepper';
import { adresseMaskiert } from '@/lib/zugang/konten';
import { EINGANG_FRIST_MONATE, FORMULAR_GRENZEN, formularBestandName, leererFormularBestand, linkSlugOk, type Eingang, type ExternerLink, type FormularBestand } from './formulare';

export class FormularFehler extends Error {
  constructor(msg: string, readonly status: number, readonly extra: Record<string, unknown> = {}) { super(msg); }
}

/** Der Haushalt, dem Formular, Kartei und CRM gehören (der des Inhabers; Ersatz wie die Sperrliste). */
export const formularHaushalt = (): Promise<string> => karteiHaushalt();

function sauber(roh: FormularBestand | null): FormularBestand {
  if (!roh || roh.v !== 1) return leererFormularBestand();
  return { v: 1, einstellungen: roh.einstellungen && typeof roh.einstellungen === 'object' ? roh.einstellungen : {}, links: Array.isArray(roh.links) ? roh.links : [], eingaenge: Array.isArray(roh.eingaenge) ? roh.eingaenge : [] };
}

export async function ladeFormular(h?: string): Promise<FormularBestand> {
  return sauber(await loadJson<FormularBestand>(formularBestandName(h ?? await formularHaushalt())));
}

/** Eingänge, die älter als die Frist sind, fallen heraus (Löschfrist, kein Kürzen nach Anzahl). Rein. */
export function eingangFrist(l: readonly Eingang[], jetzt: Date): Eingang[] {
  const grenze = new Date(jetzt); grenze.setMonth(grenze.getMonth() - EINGANG_FRIST_MONATE);
  const g = grenze.toISOString();
  return l.filter(e => e.am >= g || e.status === 'laeuft' || e.status === 'freigabe');
}

/** Ändern in EINER Sperre. `fn` darf werfen (dann bleibt alles). Über den Grenzen → 413, nie gekürzt. */
export async function aendereFormular(fn: (b: FormularBestand) => FormularBestand, h?: string, jetzt = new Date()): Promise<FormularBestand> {
  let raus: FormularBestand | null = null;
  let fehler: unknown = null;
  await updateJson<FormularBestand>(formularBestandName(h ?? await formularHaushalt()), cur => {
    try {
      const n = fn(sauber(cur));
      const fertig = { ...n, eingaenge: eingangFrist(n.eingaenge, jetzt) };
      if (fertig.links.length > FORMULAR_GRENZEN.links) throw new FormularFehler(`Höchstens ${FORMULAR_GRENZEN.links} externe Links — bitte alte widerrufene entfernen. Nichts gespeichert.`, 413);
      if (fertig.eingaenge.length > FORMULAR_GRENZEN.eingaenge) throw new FormularFehler('Zu viele Eingänge — nichts gespeichert.', 413);
      raus = fertig;
      return fertig;
    } catch (e) { fehler = e; return cur ?? leererFormularBestand(); }
  });
  if (fehler) throw fehler;
  return raus!;
}

/** Den Eingang ändern (in der Sperre); fehlt er → nichts. */
export async function aendereEingang(id: string, f: (e: Eingang) => Eingang, h?: string): Promise<Eingang | null> {
  let e: Eingang | null = null;
  await aendereFormular(b => ({ ...b, eingaenge: b.eingaenge.map(x => (x.id === id ? (e = f(x)) : x)) }), h);
  return e;
}

// ── Fingerabdrücke ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Empfänger-Adresse als Fingerabdruck (HMAC mit Pepper; ohne Pepper der ungesalzene v1-Abdruck) — nie die Adresse im Bestand. */
export function empfaengerHash(email: string): string {
  const e = email.normalize('NFC').trim().toLowerCase();
  return hmacHex('angebot-formular-an', e) ?? shaHex(`angebot-formular-an|${e}`);
}
export const empfaengerVon = (email: string): Eingang['an'] => ({ hash: empfaengerHash(email), maskiert: adresseMaskiert(email.trim().toLowerCase()) });

/** Fingerabdruck eines Link-Tokens (`<vorsatz>-<24 hex>`) — gespeichert wird nur er. */
export const linkTokenHash = (slug: string): string => createHash('sha256').update(`make-os-angebot-link|${slug}`).digest('hex');

/** Den Link zu einer Adresse finden (zeitkonstanter Vergleich des Fingerabdrucks). Nur die Form, nicht ob er aktiv ist. */
export function linkZuSlug(links: readonly ExternerLink[], slug: string): ExternerLink | null {
  if (!linkSlugOk(slug)) return null;
  const soll = Buffer.from(linkTokenHash(slug), 'hex');
  for (const l of links) {
    if (!/^[a-f0-9]{64}$/.test(l.tokenHash)) continue;
    if (timingSafeEqual(soll, Buffer.from(l.tokenHash, 'hex'))) return l;
  }
  return null;
}

// ── Formular-Stempel der öffentlichen Seite (wie die Buchung, eigener Zweck) ─────────────────────────────────────────────────────

const stempelSig = (slug: string, ms: number) => createHmac('sha256', `${sitzungsGeheimnis()}|angebot-formular`).update(`${slug}|${ms}`).digest('base64url');
/** „<ms>.<signatur>“ — beim Laden der Seite ausgegeben; zu schnell (< 3 s) oder zu alt (> 2 h) zählt nicht (`ausfuellZeitOk`, lib/kalender/buchung.ts). */
export const angebotStempel = (slug: string, ms = Date.now()): string => `${ms}.${stempelSig(slug, ms)}`;
/** Zeit aus einem Stempel — null, wenn gefälscht oder kaputt. */
export function angebotStempelZeit(slug: string, stempel: unknown): number | null {
  if (typeof stempel !== 'string' || stempel.length > 80) return null;
  const [ms, sig] = stempel.split('.');
  const n = Number(ms);
  if (!Number.isInteger(n) || !sig) return null;
  const soll = Buffer.from(stempelSig(slug, n)), ist = Buffer.from(sig);
  return soll.length === ist.length && timingSafeEqual(soll, ist) ? n : null;
}
