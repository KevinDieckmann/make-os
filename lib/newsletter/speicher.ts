// ─── Newsletter-Anmeldung — Speicher, Token und Formular-Stempel (Server, 30.10., Branch `newsletter-anmeldung`) ─────────────────────
// Bestand `newsletter-anmeldungen` (je Instanz): eine Zeile je Anmeldung — Adresse, Vorname (freiwillig), Token nur als SHA-256 (nur bis zur
// Bestätigung), Zeitpunkte (angemeldet, Mail gesendet, bestätigt), Wortlaut + Fassung der Einwilligung, Übernahme ins CRM. Bestand
// `newsletter-einstellungen`: an/aus (kommt AUS), Absender-Postfach, Name, Einwilligungstext, Fassung, Adresse der Website, Abweichungen vom
// Datenschutz der Instanz. Lesen und schreiben NUR über dieses Modul. Regeln rein in lib/newsletter/regeln.ts.

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { sitzungsGeheimnis } from '@/lib/zugang/sitzung';
import { ANMELDUNGEN, EINSTELLUNGEN, TOKEN_OK, leereEinstellungen, type AnmeldungenBestand, type NewsletterAnmeldung, type NewsletterEinstellungen } from './regeln';

export { ANMELDUNGEN, EINSTELLUNGEN };

// ── Token des Bestätigungslinks ─────────────────────────────────────────────────────────────────────────────────────────────────

/** 256 Bit Zufall, base64url — steht nur in der Mail und im Fragment der Adresse (#t=…), nie in einem Log. */
export const neuesToken = (): string => randomBytes(32).toString('base64url');
/** Eigener Vorsatz — ein Token eines anderen Wegs (Buchung, Check) passt hier nie. */
export const tokenHash = (token: string): string => createHash('sha256').update(`make-os-newsletter|${token}`).digest('hex');

/**
 * Die Anmeldung zu einem Token — zeitkonstant über ALLE wartenden Zeilen (kein früher Abbruch). Index oder −1.
 * Unbekannt, benutzt (Hash entfernt) und kaputt sind von außen nicht zu unterscheiden.
 */
export function tokenIndex(liste: readonly NewsletterAnmeldung[], token: unknown): number {
  if (typeof token !== 'string' || !TOKEN_OK.test(token)) return -1;
  const soll = Buffer.from(tokenHash(token), 'hex');
  let treffer = -1;
  for (let i = 0; i < liste.length; i++) {
    const h = liste[i].tokenHash;
    if (!h || !/^[a-f0-9]{64}$/.test(h)) continue;
    if (timingSafeEqual(soll, Buffer.from(h, 'hex')) && treffer < 0) treffer = i;
  }
  return treffer;
}

// ── Formular-Stempel der öffentlichen Seite (Mindestzeit wie bei Buchung und Check, eigener Zweck) ────────────────────────────────

const stempelSig = (ms: number) => createHmac('sha256', `${sitzungsGeheimnis()}|newsletter-formular`).update(String(ms)).digest('base64url');
/** „<ms>.<signatur>“ — beim Laden der Seite ausgegeben; zu schnell (< 3 s) oder zu alt (> 2 h) zählt nicht (`ausfuellZeitOk`). */
export const newsletterStempel = (ms = Date.now()): string => `${ms}.${stempelSig(ms)}`;
/** Zeit aus einem Stempel — null, wenn gefälscht oder kaputt. */
export function stempelZeit(stempel: unknown): number | null {
  if (typeof stempel !== 'string' || stempel.length > 80) return null;
  const [ms, sig] = stempel.split('.');
  const n = Number(ms);
  if (!Number.isInteger(n) || !sig) return null;
  const soll = Buffer.from(stempelSig(n)), ist = Buffer.from(sig);
  return soll.length === ist.length && timingSafeEqual(soll, ist) ? n : null;
}

// ── Bestände ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export async function ladeAnmeldungen(): Promise<AnmeldungenBestand> {
  const b = await loadJson<AnmeldungenBestand>(ANMELDUNGEN);
  return { anmeldungen: Array.isArray(b?.anmeldungen) ? b.anmeldungen : [] };
}

/** Den Bestand in EINER Sperre ändern — `mut` gibt den neuen Bestand zurück (unverändert → nichts geschrieben). */
export async function aendereAnmeldungen(mut: (b: AnmeldungenBestand) => AnmeldungenBestand): Promise<AnmeldungenBestand> {
  return updateJson<AnmeldungenBestand>(ANMELDUNGEN, cur => {
    const b = { anmeldungen: Array.isArray(cur?.anmeldungen) ? cur!.anmeldungen : [] };
    const neu = mut(b);
    return neu === b && cur ? cur : neu;
  });
}

/** EINE Anmeldung ändern (Server-Wege: Versand vermerken, CRM-Stand) — null, wenn es sie nicht (mehr) gibt. */
export async function aendereAnmeldung(id: string, mut: (a: NewsletterAnmeldung) => NewsletterAnmeldung): Promise<NewsletterAnmeldung | null> {
  let aus: NewsletterAnmeldung | null = null;
  await aendereAnmeldungen(b => {
    const i = b.anmeldungen.findIndex(x => x.id === id);
    if (i < 0) return b;
    aus = mut(b.anmeldungen[i]);
    return { ...b, anmeldungen: b.anmeldungen.map((x, j) => (j === i ? aus! : x)) };
  });
  return aus;
}

/** Gespeicherte Einstellungen in ihre Form bringen (Unbekanntes fällt weg, ohne Bestand die Vorgabe: aus). */
function einstellungenAus(e: Partial<NewsletterEinstellungen> | null | undefined): NewsletterEinstellungen {
  const basis = leereEinstellungen();
  if (!e || typeof e !== 'object') return basis;
  const a = e.absender;
  return {
    aktiv: e.aktiv === true,
    fassung: Number.isInteger(e.fassung) && (e.fassung as number) > 0 ? e.fassung as number : basis.fassung,
    ...(a && typeof a.person === 'string' && typeof a.postfach === 'string' ? { absender: { person: a.person, postfach: a.postfach, gesetztAm: String(a.gesetztAm ?? '') } } : {}),
    ...(typeof e.marke === 'string' && e.marke ? { marke: e.marke } : {}),
    ...(typeof e.einwilligungstext === 'string' && e.einwilligungstext ? { einwilligungstext: e.einwilligungstext } : {}),
    ...(typeof e.website === 'string' && e.website ? { website: e.website } : {}),
    ...(typeof e.verantwortlich === 'string' && e.verantwortlich ? { verantwortlich: e.verantwortlich } : {}),
    ...(typeof e.datenschutzLink === 'string' && e.datenschutzLink ? { datenschutzLink: e.datenschutzLink } : {}),
    ...(e.geaendert ? { geaendert: e.geaendert, ...(e.geaendertVon ? { geaendertVon: e.geaendertVon } : {}) } : {}),
  };
}

export async function ladeEinstellungen(): Promise<NewsletterEinstellungen> {
  return einstellungenAus(await loadJson<Partial<NewsletterEinstellungen>>(EINSTELLUNGEN));
}

/** Einstellungen in EINER Sperre ändern (`mut` bekommt den gespeicherten Stand und darf werfen — dann bleibt alles, wie es war). */
export async function aendereEinstellungen(mut: (alt: NewsletterEinstellungen) => NewsletterEinstellungen): Promise<NewsletterEinstellungen> {
  return einstellungenAus(await updateJson<NewsletterEinstellungen>(EINSTELLUNGEN, cur => mut(einstellungenAus(cur))));
}
