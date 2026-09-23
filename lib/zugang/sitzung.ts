// ─── MAKE OS — Die Sitzung ──────────────────────────────────────────────────
// Kevins Entscheidung vom 23.09.: „dieses Kevin/Malin-Thema geht raus" —
// echte Konten, echter Login. Eine Sitzung ist ein signierter Zettel:
//
//   <speicher>.<ablauf>.<signatur>
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
export const SITZUNG_TAGE = 30;

const enc = new TextEncoder();

async function signiere(geheimnis: string, text: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', enc.encode(geheimnis), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, enc.encode(text));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Ein Vergleich, der nicht am ersten falschen Zeichen aufgibt. */
function gleich(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function sitzungAusstellen(geheimnis: string, speicher: string, jetzt = Date.now()): Promise<string> {
  const ablauf = jetzt + SITZUNG_TAGE * 864e5;
  const kern = `${speicher}.${ablauf}`;
  return `${kern}.${await signiere(geheimnis, kern)}`;
}

export async function sitzungPruefen(geheimnis: string, zettel: string | undefined, jetzt = Date.now()): Promise<{ speicher: string } | null> {
  if (!zettel) return null;
  const teile = zettel.split('.');
  if (teile.length !== 3) return null;
  const [speicher, ablaufText, sig] = teile;
  if (!/^[a-z0-9-]{1,40}$/.test(speicher)) return null;
  const ablauf = Number(ablaufText);
  if (!isFinite(ablauf) || ablauf < jetzt) return null;
  const soll = await signiere(geheimnis, `${speicher}.${ablaufText}`);
  return gleich(soll, sig) ? { speicher } : null;
}

/** Das Geheimnis der Sitzungen. Eigener Wert, sonst der Zugangsschlüssel. */
export function sitzungsGeheimnis(): string {
  return process.env.SESSION_SECRET || process.env.MAKE_OS_KEY || '';
}
