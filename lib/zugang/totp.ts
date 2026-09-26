// ─── MAKE OS — Zweiter Faktor: zeitbasierte Einmalcodes (TOTP, RFC 6238) ────
// Kevin (26.09.): „extrem sicher — das sind unsere privatesten Themen.“ Ein
// Passwort allein reicht für ein Login im offenen Netz nicht. Der zweite
// Faktor ist der Sechssteller aus der Authenticator-App (Apple Passwörter,
// Google Authenticator, 1Password …): HMAC-SHA1 über die 30-Sekunden-Stufe,
// wie es alle Apps können. Dazu acht Wiederherstellungscodes für den Fall,
// dass das Handy weg ist. Alles hier ist reine Logik — testbar, ohne Speicher.

import { createHmac, randomBytes, createHash, timingSafeEqual } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Base32 (RFC 4648, ohne Füllzeichen) — so wollen Authenticator-Apps das Geheimnis. */
export function base32(buf: Uint8Array): string {
  let bits = 0, wert = 0, aus = '';
  for (const b of buf) {
    wert = (wert << 8) | b; bits += 8;
    while (bits >= 5) { aus += ALPHABET[(wert >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) aus += ALPHABET[(wert << (5 - bits)) & 31];
  return aus;
}

export function base32Lesen(text: string): Uint8Array {
  const sauber = text.toUpperCase().replace(/[^A-Z2-7]/g, '');
  const aus: number[] = [];
  let bits = 0, wert = 0;
  for (const z of sauber) {
    wert = (wert << 5) | ALPHABET.indexOf(z); bits += 5;
    if (bits >= 8) { aus.push((wert >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Uint8Array.from(aus);
}

/** Ein neues Geheimnis: 20 Bytes (160 Bit, wie RFC 4226 empfiehlt). */
export function neuesGeheimnis(): string {
  return base32(randomBytes(20));
}

export const SCHRITT_S = 30;

/** Der Code für eine bestimmte Zeitstufe (Sekunden ÷ 30). */
export function codeFuer(geheimnis: string, stufe: number, stellen = 6): string {
  const zaehler = Buffer.alloc(8);
  zaehler.writeUInt32BE(Math.floor(stufe / 0x1_0000_0000), 0);
  zaehler.writeUInt32BE(stufe >>> 0, 4);
  const mac = createHmac('sha1', Buffer.from(base32Lesen(geheimnis))).update(zaehler).digest();
  const o = mac[mac.length - 1] & 0x0f;
  const n = ((mac[o] & 0x7f) << 24) | (mac[o + 1] << 16) | (mac[o + 2] << 8) | mac[o + 3];
  return String(n % 10 ** stellen).padStart(stellen, '0');
}

export function stufeVon(jetztMs = Date.now()): number {
  return Math.floor(jetztMs / 1000 / SCHRITT_S);
}

/**
 * Passt der Code? Toleranz eine Stufe vor und zurück (Uhren gehen nie ganz
 * gleich). Gibt die getroffene Stufe zurück, damit derselbe Code nicht ein
 * zweites Mal gilt (Wiederholung abgefangen).
 */
export function codePruefen(geheimnis: string, eingabe: unknown, jetztMs = Date.now(), fenster = 1, nichtVor?: number): { ok: true; stufe: number } | { ok: false } {
  const code = String(eingabe ?? '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(code)) return { ok: false };
  const mitte = stufeVon(jetztMs);
  for (let d = -fenster; d <= fenster; d++) {
    const stufe = mitte + d;
    if (nichtVor !== undefined && stufe <= nichtVor) continue;
    if (gleich(codeFuer(geheimnis, stufe), code)) return { ok: true, stufe };
  }
  return { ok: false };
}

function gleich(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Der Link, den Passwörter-/Authenticator-Apps verstehen. */
export function otpauthLink(konto: string, geheimnis: string, aussteller = 'MAKE OS'): string {
  const label = encodeURIComponent(`${aussteller}:${konto}`);
  return `otpauth://totp/${label}?secret=${geheimnis}&issuer=${encodeURIComponent(aussteller)}&algorithm=SHA1&digits=6&period=${SCHRITT_S}`;
}

// ── Wiederherstellungscodes ──────────────────────────────────────────────────
// Acht Codes à 10 Zeichen (ohne verwechselbare Zeichen). Gespeichert wird nur
// der SHA-256-Hash mit Salz — die Codes selbst sieht man genau einmal.

const CODE_ZEICHEN = 'abcdefghjkmnpqrstuvwxyz23456789';

export function neueWiederherstellungscodes(anzahl = 8): string[] {
  return Array.from({ length: anzahl }, () => {
    const b = randomBytes(10);
    const roh = Array.from(b).map(x => CODE_ZEICHEN[x % CODE_ZEICHEN.length]).join('');
    return `${roh.slice(0, 5)}-${roh.slice(5)}`;
  });
}

export function wiederherstellungHash(code: string, salz: string): string {
  return createHash('sha256').update(`${salz}:${code.toLowerCase().replace(/[^a-z0-9]/g, '')}`).digest('hex');
}

export interface Wiederherstellung { hash: string; benutzt?: string }

/** Welcher Code passt (Index) — oder −1. Benutzte Codes zählen nicht mehr. */
export function wiederherstellungPruefen(liste: Wiederherstellung[], eingabe: unknown, salz: string): number {
  const code = String(eingabe ?? '');
  if (!/^[a-z0-9-]{8,14}$/i.test(code)) return -1;
  const h = wiederherstellungHash(code, salz);
  return liste.findIndex(w => !w.benutzt && gleich(w.hash, h));
}
