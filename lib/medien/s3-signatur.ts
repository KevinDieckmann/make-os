// ─── Medien — AWS Signature Version 4 für S3-kompatible Speicher (09.10., Paket 5) ──────────────────────────────────────────
// Hetzner Object Storage spricht S3 (research/agenten/MEDIEN.md B4). Statt eines SDK (Hunderte KB, eigene Abhängigkeiten) signiert MAKE OS
// die wenigen Aufrufe selbst — nach der veröffentlichten Beschreibung „Signature Version 4“ (Canonical Request → String to Sign →
// abgeleiteter Schlüssel → HMAC). Geprüft gegen das Beispiel „GET Object“ der AWS-Doku (tests/medien-speicher.test.ts).
// Rein (nur node:crypto). Zugangsdaten nur als Parameter — nie ins Log, nie in Fehlermeldungen.

import { createHash, createHmac } from 'node:crypto';

export const LEERER_HASH = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

/** URI-Kodierung nach AWS: nur A–Z a–z 0–9 - . _ ~ bleiben, alles andere %XX (Großbuchstaben). `schraeg` = „/“ bleibt (Pfad). */
export function awsKodieren(s: string, schraeg = false): string {
  let raus = '';
  for (const b of Buffer.from(s, 'utf8')) {
    const c = String.fromCharCode(b);
    if (/[A-Za-z0-9\-._~]/.test(c) || (schraeg && c === '/')) raus += c;
    else raus += `%${b.toString(16).toUpperCase().padStart(2, '0')}`;
  }
  return raus;
}

/** Kanonische Abfrage: nach Schlüssel sortiert, Schlüssel und Werte kodiert, `a=` für leere Werte. */
export function kanonischeAbfrage(abfrage: Record<string, string>): string {
  return Object.keys(abfrage).sort().map(k => `${awsKodieren(k)}=${awsKodieren(abfrage[k])}`).join('&');
}

const hmac = (k: Buffer | string, t: string) => createHmac('sha256', k).update(t, 'utf8').digest();
const hex = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');

export interface SignierEingabe {
  methode: string;
  /** Host (mit Port, wenn nicht Standard) — genau so, wie fetch ihn sendet. */
  host: string;
  /** Pfad, bereits nach `awsKodieren(…, true)` kodiert, mit führendem „/“. */
  pfad: string;
  abfrage: Record<string, string>;
  /** Zusätzlich zu signierende Köpfe (klein geschrieben), z. B. `range`. */
  kopf?: Record<string, string>;
  /** SHA-256 (hex) des Körpers. */
  nutzlast: string;
  zugang: string;
  geheimnis: string;
  region: string;
  jetzt: Date;
}

/** Signierte Köpfe: `authorization`, `x-amz-date`, `x-amz-content-sha256` (+ die übergebenen). */
export function signiere(e: SignierEingabe): Record<string, string> {
  const datum = e.jetzt.toISOString().replace(/[:-]|\.\d{3}/g, ''); // 20130524T000000Z
  const tag = datum.slice(0, 8);
  const koepfe: Record<string, string> = { host: e.host, 'x-amz-content-sha256': e.nutzlast, 'x-amz-date': datum };
  for (const [k, v] of Object.entries(e.kopf ?? {})) koepfe[k.toLowerCase()] = v.trim();
  const namen = Object.keys(koepfe).sort();
  const kanonisch = [
    e.methode.toUpperCase(),
    e.pfad,
    kanonischeAbfrage(e.abfrage),
    namen.map(n => `${n}:${koepfe[n].replace(/\s+/g, ' ')}\n`).join(''),
    namen.join(';'),
    e.nutzlast,
  ].join('\n');
  const umfang = `${tag}/${e.region}/s3/aws4_request`;
  const zuSignieren = ['AWS4-HMAC-SHA256', datum, umfang, hex(kanonisch)].join('\n');
  const schluessel = hmac(hmac(hmac(hmac(`AWS4${e.geheimnis}`, tag), e.region), 's3'), 'aws4_request');
  const signatur = createHmac('sha256', schluessel).update(zuSignieren, 'utf8').digest('hex');
  const { host: _h, ...rest } = koepfe;
  return { ...rest, authorization: `AWS4-HMAC-SHA256 Credential=${e.zugang}/${umfang}, SignedHeaders=${namen.join(';')}, Signature=${signatur}` };
}

/** Nur für den Test gegen die AWS-Doku: der String to Sign derselben Eingabe. */
export function zuSignierenFuer(e: SignierEingabe): string {
  const datum = e.jetzt.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const koepfe: Record<string, string> = { host: e.host, 'x-amz-content-sha256': e.nutzlast, 'x-amz-date': datum };
  for (const [k, v] of Object.entries(e.kopf ?? {})) koepfe[k.toLowerCase()] = v.trim();
  const namen = Object.keys(koepfe).sort();
  const kanonisch = [e.methode.toUpperCase(), e.pfad, kanonischeAbfrage(e.abfrage), namen.map(n => `${n}:${koepfe[n]}\n`).join(''), namen.join(';'), e.nutzlast].join('\n');
  return ['AWS4-HMAC-SHA256', datum, `${datum.slice(0, 8)}/${e.region}/s3/aws4_request`, hex(kanonisch)].join('\n');
}
