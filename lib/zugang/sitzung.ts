// ─── MAKE OS — Die Sitzung ──────────────────────────────────────────────────
// Kevins Entscheidung vom 23.09.: „dieses Kevin/Malin-Thema geht raus" —
// echte Konten, echter Login. Eine Sitzung ist ein signierter Zettel:
//
//   <speicher>.<ablauf>.<stand>.<sid>.<signatur>
//
// „sid“ ist die Kennung des Zettels: Abmelden trägt sie in die Widerrufsliste des
// Kontos ein (26.09.) — ein gestohlener Zettel stirbt damit beim Abmelden, nicht
// erst nach 14 Tagen. „Alle anderen Geräte abmelden“ setzt `sitzungenAb`.
//
// „stand“ ist der Fingerabdruck des Passwort-Salzes (26.09.): ändert jemand sein
// Passwort, bekommt das Salz einen neuen Wert — alte Zettel passen nicht mehr
// (die Middleware fragt den Stand beim Server ab, höchstens einmal je Minute).
//
// Die Signatur ist HMAC-SHA256 über die ersten beiden Teile mit einem
// Geheimnis, das nur der Server kennt. Wer den Zettel fälschen will, braucht
// das Geheimnis — der Browser hat es nie gesehen.
//
// Bewusst mit Web Crypto statt node:crypto: die Middleware läuft im Edge-
// Laufzeitmodell ohne Node-Module, und Node 22 hat Web Crypto ebenfalls.
// EINE Implementierung für beide Seiten — sonst laufen sie auseinander.

export const SITZUNG_COOKIE = 'make-os-sitzung';
/** Nicht signiert, nicht geheim: nur damit der Browser weiß, wer da ist. */
export const WER_COOKIE = 'make-os-wer';
export const SITZUNG_TAGE = 14;

const enc = new TextEncoder();

async function signiere(geheimnis: string, text: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', enc.encode(geheimnis), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, enc.encode(text));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Ein Vergleich, der nicht am ersten falschen Zeichen aufgibt. */
export function gleich(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/** Fingerabdruck des Passwort-Salzes — kein Geheimnis, aber nur mit dem Salz zu bilden. */
export async function kontoStand(salz: string): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', enc.encode(`stand:${salz}`));
  return Array.from(new Uint8Array(h)).slice(0, 6).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Kennung eines Zettels — zufällig, 12 Hex. */
export function neueSid(): string {
  const b = new Uint8Array(6); crypto.getRandomValues(b);
  return Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
}

export async function sitzungAusstellen(geheimnis: string, speicher: string, stand: string, jetzt = Date.now(), sid = neueSid()): Promise<string> {
  const ablauf = jetzt + SITZUNG_TAGE * 864e5;
  const kern = `${speicher}.${ablauf}.${stand}.${sid}`;
  return `${kern}.${await signiere(geheimnis, kern)}`;
}

export interface Sitzung { speicher: string; stand: string; sid: string; /** Zeitpunkt der Ausstellung (ms). */ ausgestellt: number; ablauf: number }

export async function sitzungPruefen(geheimnis: string, zettel: string | undefined, jetzt = Date.now()): Promise<Sitzung | null> {
  if (!zettel) return null;
  const teile = zettel.split('.');
  // Zettel ohne Stand und Kennung (vor 26.09.) gelten nicht mehr — einmal neu anmelden.
  if (teile.length !== 5) return null;
  const [speicher, ablaufText, stand, sid, sig] = teile;
  if (!/^[a-z0-9-]{1,40}$/.test(speicher) || !/^[a-f0-9]{12}$/.test(stand) || !/^[a-f0-9]{12}$/.test(sid)) return null;
  const ablauf = Number(ablaufText);
  if (!isFinite(ablauf) || ablauf < jetzt) return null;
  const soll = await signiere(geheimnis, `${speicher}.${ablaufText}.${stand}.${sid}`);
  return gleich(soll, sig) ? { speicher, stand, sid, ausgestellt: ablauf - SITZUNG_TAGE * 864e5, ablauf } : null;
}

/** Das Geheimnis der Sitzungen. Eigener Wert, sonst der Zugangsschlüssel. */
let gewarnt = false;
export function sitzungsGeheimnis(): string {
  if (!process.env.SESSION_SECRET && !gewarnt) { gewarnt = true; console.warn('[MAKE OS] SESSION_SECRET fehlt — Sitzungen werden mit MAKE_OS_KEY signiert. Bitte in .env setzen (start.sh legt ihn lokal an).'); }
  return process.env.SESSION_SECRET || process.env.MAKE_OS_KEY || '';
}
