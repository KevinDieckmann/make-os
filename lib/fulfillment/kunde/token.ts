// ─── Fulfillment · Kunde — Kennung, Token, Hash, Formular-Stempel (nur Server; C2, 10.10.; FULFILLMENT_KONZEPT.md 5.4/5.5) ───────────────────────
// Vorbild: die öffentliche Buchung (lib/kalender/buchung-speicher.ts).
//   · Öffentliche Kennung `kl-<24 hex>` (96 Bit, `randomBytes(12)`) im Pfad — nicht erratbar, nicht aufzählbar.
//   · Geheimes Token (256 Bit, base64url) NUR im Fragment (`#t=…` bzw. `#p=…`) — nie in Server-Logs, Referer oder Proxies. Die Seite schickt es als
//     Kopf `x-kunde-token` bzw. `x-kunde-puls`.
//   · Gespeichert wird NUR der Hash: `sha256('make-os-kunde|' + token)` bzw. für den Puls `sha256('make-os-kunde-puls|' + token)` — ein Link-Token
//     passt nie als Puls-Token und umgekehrt. Vergleich in konstanter Zeit (`timingSafeEqual`).
//   · Formular-Stempel: HMAC mit dem Sitzungsgeheimnis, Zweck `kunde-formular`, gebunden an die Link-Kennung; gilt ab 3 s und bis 12 h (Kunden füllen
//     lange Formulare). Honigtopf `webseite` und Zeitfehler bekommen denselben Text (`NICHT_ANGENOMMEN`).

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { sitzungsGeheimnis } from '@/lib/zugang/sitzung';
import { neueKennung } from '@/lib/kennung';

export const TOKEN_OK = /^[A-Za-z0-9_-]{43}$/;
export const neueLinkKennung = (): string => `kl-${randomBytes(12).toString('hex')}`;
export const neuesToken = (): string => randomBytes(32).toString('base64url');
export const neuePulsAnfrageKennung = (): string => neueKennung('pa');
export const neuePulsKennung = (): string => neueKennung('pu');
export const neueUnterlageKennung = (): string => neueKennung('ud');

export type TokenArt = 'link' | 'puls';
const VORSATZ: Record<TokenArt, string> = { link: 'make-os-kunde|', puls: 'make-os-kunde-puls|' };
/** Gespeichert wird nur der Hash. */
export const tokenHash = (token: string, art: TokenArt = 'link'): string => createHash('sha256').update(`${VORSATZ[art]}${token}`).digest('hex');
/** Vergleich in konstanter Zeit — falsche Form oder anderer Hash: false. */
export function tokenPasst(token: string | null | undefined, hash: string, art: TokenArt = 'link'): boolean {
  if (typeof token !== 'string' || !TOKEN_OK.test(token) || !/^[a-f0-9]{64}$/.test(hash)) return false;
  return timingSafeEqual(Buffer.from(tokenHash(token, art), 'hex'), Buffer.from(hash, 'hex'));
}

/** Text für Honigtopf UND Zeitfehler (derselbe — eine Maschine soll nicht lernen, was sie verraten hat). */
export const NICHT_ANGENOMMEN = 'Nicht angenommen — bitte die Seite neu laden und in Ruhe ausfüllen.';
export const STEMPEL_MIN_MS = 3_000;
export const STEMPEL_MAX_MS = 12 * 3_600_000;

const stempelSig = (linkId: string, ms: number) => createHmac('sha256', `${sitzungsGeheimnis()}|kunde-formular`).update(`${linkId}|${ms}`).digest('base64url');
/** Formular-Stempel „<ms>.<signatur>“ — mit der Kunden-Sicht ausgegeben. */
export const formularStempel = (linkId: string, ms = Date.now()): string => `${ms}.${stempelSig(linkId, ms)}`;
/** Zeit aus einem Stempel — null, wenn gefälscht oder kaputt. */
export function stempelZeit(linkId: string, stempel: unknown): number | null {
  if (typeof stempel !== 'string' || stempel.length > 80) return null;
  const [ms, sig] = stempel.split('.');
  const n = Number(ms);
  if (!Number.isInteger(n) || !sig) return null;
  const soll = Buffer.from(stempelSig(linkId, n)), ist = Buffer.from(sig);
  return soll.length === ist.length && timingSafeEqual(soll, ist) ? n : null;
}
/** Ab 3 s (Maschinen sind schneller) und bis 12 h (danach neu laden). */
export const ausfuellZeitOk = (geladenMs: number, jetztMs: number): boolean => jetztMs - geladenMs >= STEMPEL_MIN_MS && jetztMs - geladenMs <= STEMPEL_MAX_MS;

/** Stempel UND Honigtopf prüfen — liefert null (in Ordnung) oder den einen Satz. */
export function formularPruefen(linkId: string, stempel: unknown, webseite: unknown, jetztMs = Date.now()): string | null {
  if (typeof webseite === 'string' && webseite.trim()) return NICHT_ANGENOMMEN;
  const geladen = stempelZeit(linkId, stempel);
  if (geladen === null || !ausfuellZeitOk(geladen, jetztMs)) return NICHT_ANGENOMMEN;
  return null;
}
