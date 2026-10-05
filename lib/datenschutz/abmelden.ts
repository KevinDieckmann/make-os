// ─── Abmeldelink für jede Massen-Mail (05.10., Paket „Betroffenenrechte v2“; Art. 21 Abs. 2/3 DSGVO, § 7 Abs. 3 Nr. 4 UWG) ───
// Jede Massen-Mail (Newsletter-/Segment-Export für den Versanddienst) trägt je Empfänger einen eigenen Abmeldelink. Ein Klick genügt:
// Werbesperre am Kontakt + Widerruf der Werbe-Einwilligungen + Sperrliste + Verlauf/Änderungsprotokoll. Der Link führt auf eine Seite
// OHNE Anmeldung (`/abmelden/<token>`, middleware.ts), die nur abmelden kann — sie zeigt nie Daten.
//
// Token  `a1-` + 32 Hex = HMAC-SHA-256 (Pepper, lib/datenschutz/pepper.ts) über die Adresse (klein) — trägt KEINE Kennung, keine Adresse
//        (die Kontakt-Kennung enthält die Mail-Adresse und darf nie in einen Link). Ohne Pepper gibt es keinen Link (sonst wäre er erratbar).
// Kein Datenleck: die Antwort ist IMMER dieselbe („Wenn die Adresse bei uns geführt wird, ist sie jetzt abgemeldet“) — gleich, ob es die
//        Adresse gibt, ob sie schon gesperrt war oder ob das Token Unsinn ist. Gedrosselt je Netz.
// One-Click (RFC 8058): `List-Unsubscribe: <https://…/abmelden/<token>>` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click` —
//        Mail-Anbieter schicken dann POST an dieselbe Adresse; die Route nimmt ihn ohne Sitzung und ohne Origin an.

import { hmacHex } from './pepper';
import { timingSafeEqual } from 'node:crypto';

export const ABMELDE_PRAEFIX = 'a1-';
export const ABMELDE_TOKEN = /^a1-[0-9a-f]{32}$/;
/** Die eine Antwort — für jede Abmeldung, gleich ob gefunden oder nicht. */
export const ABMELDE_ANTWORT = 'Wenn diese Adresse bei uns geführt wird, ist sie jetzt abgemeldet: Sie erhalten keine Werbung mehr von uns. Sie müssen nichts weiter tun.';

const norm = (email: string) => email.trim().toLowerCase();

/** Token für eine Adresse — null ohne Pepper oder ohne Adresse. Rein bis auf den Pepper. */
export function abmeldeToken(email: string | undefined | null): string | null {
  const e = norm(email ?? '');
  if (!e.includes('@')) return null;
  const h = hmacHex('make-os-abmelden-v1', e);
  return h ? `${ABMELDE_PRAEFIX}${h.slice(0, 32)}` : null;
}

/** Die Grund-Adresse der Instanz (MAKE_OS_ADRESSE), ohne Schrägstrich am Ende — null, wenn keine (dann kein Link). */
export function instanzAdresse(env: Record<string, string | undefined> = process.env): string | null {
  const a = (env.MAKE_OS_ADRESSE ?? '').trim().replace(/\/+$/, '');
  try { return a && /^https?:$/.test(new URL(a).protocol) ? a : null; } catch { return null; }
}

/** Abmeldelink und die beiden Kopfzeilen (RFC 8058) — oder null (kein Pepper/keine Adresse/keine Mail). */
export function abmeldeLink(email: string | undefined | null, basis: string | null = instanzAdresse()): { link: string; listUnsubscribe: string; listUnsubscribePost: string } | null {
  const t = abmeldeToken(email);
  if (!t || !basis) return null;
  const link = `${basis}/abmelden/${t}`;
  return { link, listUnsubscribe: `<${link}>`, listUnsubscribePost: 'List-Unsubscribe=One-Click' };
}

/** Passt das Token zu einer der Adressen? Konstante Zeit je Vergleich. */
export function tokenPasst(token: string, adressen: readonly string[]): boolean {
  if (!ABMELDE_TOKEN.test(token)) return false;
  const a = Buffer.from(token);
  return adressen.some(e => { const t = abmeldeToken(e); if (!t) return false; const b = Buffer.from(t); return a.length === b.length && timingSafeEqual(a, b); });
}
