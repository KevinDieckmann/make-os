// ─── Medienspeicher — EINE Schnittstelle, zwei Umsetzungen (09.10., Paket 5) ────────────────────────────────────────────────
// Kevin 09.10.: „Hetzner Object Storage Nürnberg/Falkenstein, privat, nur verschlüsselt.“ Der Speicher sieht nur Chiffrat unter
// zufälligen Namen (lib/medien/krypto.ts) — keine Dateinamen, keine Metadaten, kein SSE-C.
//   s3      Hetzner Object Storage (S3-kompatibel): MAKE_OS_MEDIEN_S3_ENDPUNKT · _BUCKET · _ZUGANG · _GEHEIMNIS (· _REGION · _STIL · _PRAEFIX),
//           gesetzt NUR über deploy/medien-speicher-verbinden.sh (verdeckte Eingabe). Zugangsdaten nur an den Endpunkt, nie ins Log.
//   ordner  ohne Einrichtung: `<daten>/medien` (bzw. MAKE_OS_MEDIEN_DIR) mit Grenze MAKE_OS_MEDIEN_ORDNER_MB (Vorgabe 2048) — der Ordner
//           ist von der Nachtsicherung ausgenommen (deploy/sicherung.sh, Wächter tests/medien-sicherung.test.ts): Videos würden jede
//           Generation um ihre volle Größe aufblähen. Der Head of IT meldet „Medienspeicher nicht eingerichtet“ bzw. „fast voll“.
//   aus     MAKE_OS_MEDIEN=aus — Hochladen geht nicht (503), Lesen des Katalogs schon.
// Objekt-Namen: `<präfix>/<medium>/<variante>` (Präfix je Instanz, falls sich Instanzen einen Bucket teilen).

import path from 'node:path';
import { datenOrdner } from '@/lib/store/local-db';

export type SpeicherModus = 'ordner' | 's3' | 'aus';

export interface S3Konfig {
  modus: 's3';
  endpunkt: string;
  bucket: string;
  zugang: string;
  geheimnis: string;
  region: string;
  /** `pfad` = https://endpunkt/bucket/objekt (Vorgabe) · `host` = https://bucket.endpunkt/objekt. */
  stil: 'pfad' | 'host';
  praefix: string;
}
export interface OrdnerKonfig { modus: 'ordner'; ordner: string; grenze: number; praefix: string }
export type MedienKonfig = S3Konfig | OrdnerKonfig | { modus: 'aus'; praefix: string };

const OBJEKT_OK = /^[a-z0-9][a-z0-9-]{0,62}(\/[a-z0-9][a-z0-9-]{0,80}){1,4}$/;
const PRAEFIX_OK = /^[a-z0-9][a-z0-9-]{0,62}$/;

/** Ein zulässiger Objekt-Name (keine Punkte, keine Pfad-Tricks, nur Kennungen). */
export const objektOk = (o: string): boolean => OBJEKT_OK.test(o) && !o.includes('..');

/** Konfiguration aus der Umgebung (Instanz-fähig: nichts fest im Code). Unvollständiges S3 → Ordner (der HOI sagt es). */
export function medienKonfig(env: NodeJS.ProcessEnv = process.env): MedienKonfig {
  const praefixRoh = (env.MAKE_OS_MEDIEN_PRAEFIX ?? '').trim().toLowerCase();
  const praefix = PRAEFIX_OK.test(praefixRoh) ? praefixRoh : 'm';
  if ((env.MAKE_OS_MEDIEN ?? '').trim().toLowerCase() === 'aus') return { modus: 'aus', praefix };
  const endpunkt = (env.MAKE_OS_MEDIEN_S3_ENDPUNKT ?? '').trim().replace(/\/+$/, '');
  const bucket = (env.MAKE_OS_MEDIEN_S3_BUCKET ?? '').trim();
  const zugang = (env.MAKE_OS_MEDIEN_S3_ZUGANG ?? '').trim();
  const geheimnis = (env.MAKE_OS_MEDIEN_S3_GEHEIMNIS ?? '').trim();
  if (endpunkt && bucket && zugang && geheimnis && /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(endpunkt) && /^[a-z0-9][a-z0-9.-]{1,62}$/.test(bucket)) {
    // Region: ausdrücklich, sonst der erste Teil des Hosts (Hetzner: nbg1.your-objectstorage.com → nbg1). [A] am echten Bucket prüfen.
    const region = (env.MAKE_OS_MEDIEN_S3_REGION ?? '').trim() || new URL(endpunkt).hostname.split('.')[0] || 'us-east-1';
    const stil = (env.MAKE_OS_MEDIEN_S3_STIL ?? '').trim().toLowerCase() === 'host' ? 'host' : 'pfad';
    return { modus: 's3', endpunkt, bucket, zugang, geheimnis, region, stil, praefix };
  }
  const mb = Number(env.MAKE_OS_MEDIEN_ORDNER_MB ?? '');
  const grenze = (Number.isFinite(mb) && mb >= 50 ? Math.floor(mb) : 2048) * 1024 * 1024;
  const ordner = (env.MAKE_OS_MEDIEN_DIR ?? '').trim() || path.join(datenOrdner(), 'medien');
  return { modus: 'ordner', ordner, grenze, praefix };
}

/** Teilweise eingerichtet (eine S3-Variable fehlt)? Dann läuft der Ordner — der HOI nennt es. */
export function s3Unvollstaendig(env: NodeJS.ProcessEnv = process.env): boolean {
  const n = ['MAKE_OS_MEDIEN_S3_ENDPUNKT', 'MAKE_OS_MEDIEN_S3_BUCKET', 'MAKE_OS_MEDIEN_S3_ZUGANG', 'MAKE_OS_MEDIEN_S3_GEHEIMNIS'].filter(k => (env[k] ?? '').trim()).length;
  return n > 0 && medienKonfig(env).modus !== 's3';
}

export class SpeicherFehler extends Error {
  constructor(msg: string, readonly status = 502, readonly code?: string) { super(msg); }
}

export interface MedienSpeicher {
  modus: 'ordner' | 's3';
  /** Mehrteiligen Upload beginnen — Kennung des Uploads im Speicher. */
  beginnen(objekt: string): Promise<string>;
  /** Ein Stück (Chiffrat) schreiben — liefert den ETag. `nr` 0-basiert. Dasselbe Stück erneut = überschreiben. */
  teil(objekt: string, upload: string, nr: number, bytes: Buffer): Promise<string>;
  abschliessen(objekt: string, upload: string, teile: readonly { nr: number; etag: string }[]): Promise<void>;
  abbrechen(objekt: string, upload: string): Promise<void>;
  /** Kleines Objekt am Stück. */
  schreiben(objekt: string, bytes: Buffer): Promise<void>;
  /** Objekt (oder Byte-Bereich [von, bis] inklusive) lesen — `null`, wenn es fehlt. */
  lesen(objekt: string, bereich?: { von: number; bis: number }): Promise<Buffer | null>;
  /** Objekt löschen (fehlt es, ist das kein Fehler). */
  loeschen(objekt: string): Promise<void>;
  /** Nur Ordner: belegte Bytes (Medien + offene Stücke). */
  belegt?(): Promise<number>;
}

const G = globalThis as unknown as { __makeosMedienSpeicher?: { schluessel: string; s: MedienSpeicher }; __makeosMedienSpeicherTest?: MedienSpeicher | null };

/** Tests: einen Speicher (S3 gegen den Fake) fest einsetzen; `null` hebt es auf. */
export function speicherSetzen(s: MedienSpeicher | null): void { G.__makeosMedienSpeicherTest = s; G.__makeosMedienSpeicher = undefined; }

/** Der Speicher dieser Instanz — `null`, wenn Medien aus sind. */
export async function medienSpeicher(env: NodeJS.ProcessEnv = process.env): Promise<MedienSpeicher | null> {
  if (G.__makeosMedienSpeicherTest) return G.__makeosMedienSpeicherTest;
  const k = medienKonfig(env);
  if (k.modus === 'aus') return null;
  const schluessel = k.modus === 's3' ? `s3|${k.endpunkt}|${k.bucket}|${k.zugang}|${k.region}|${k.stil}` : `ordner|${k.ordner}`;
  if (G.__makeosMedienSpeicher?.schluessel === schluessel) return G.__makeosMedienSpeicher.s;
  const s = k.modus === 's3' ? (await import('./speicher-s3')).s3Speicher(k) : (await import('./speicher-ordner')).ordnerSpeicher(k);
  G.__makeosMedienSpeicher = { schluessel, s };
  return s;
}
