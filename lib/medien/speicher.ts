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
import { objektOk, praefixOk, praefixAus, s3Angegeben, s3KonfigAus, type S3Konfig } from './s3-kern.mjs';

export type SpeicherModus = 'ordner' | 's3' | 'aus';

// Namen und der S3-Teil der Konfiguration liegen in lib/medien/s3-kern.mjs (auch das Löschskript liest sie dort) — hier nur weitergereicht.
export { objektOk, praefixOk };
export type { S3Konfig };
export interface OrdnerKonfig { modus: 'ordner'; ordner: string; grenze: number; praefix: string }
export type MedienKonfig = S3Konfig | OrdnerKonfig | { modus: 'aus'; praefix: string };

/** Konfiguration aus der Umgebung (Instanz-fähig: nichts fest im Code). Unvollständiges S3 → Ordner (der HOI sagt es). */
export function medienKonfig(env: NodeJS.ProcessEnv = process.env): MedienKonfig {
  const praefix = praefixAus(env);
  if ((env.MAKE_OS_MEDIEN ?? '').trim().toLowerCase() === 'aus') return { modus: 'aus', praefix };
  const s3 = s3KonfigAus(env);
  if (s3) return s3;
  const mb = Number(env.MAKE_OS_MEDIEN_ORDNER_MB ?? '');
  const grenze = (Number.isFinite(mb) && mb >= 50 ? Math.floor(mb) : 2048) * 1024 * 1024;
  const ordner = (env.MAKE_OS_MEDIEN_DIR ?? '').trim() || path.join(datenOrdner(), 'medien');
  return { modus: 'ordner', ordner, grenze, praefix };
}

/** Teilweise eingerichtet (eine S3-Variable fehlt)? Dann läuft der Ordner — der HOI nennt es. */
export function s3Unvollstaendig(env: NodeJS.ProcessEnv = process.env): boolean {
  return s3Angegeben(env) && medienKonfig(env).modus !== 's3';
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
  /**
   * Alle Objekte unter `<präfix>/` — Name und gespeicherte Größe (Chiffrat), seitenweise (09.10., Nachzug: Instanz-Export und
   * Instanz löschen, lib/medien/instanz.ts). Namen, die nicht `objektOk` sind, kommen mit `fremd: true` (nie löschen, nur nennen).
   */
  auflisten?(praefix: string): AsyncGenerator<{ objekt: string; bytes: number; fremd?: true }>;
  /** Offene mehrteilige Uploads unter `<präfix>/` (S3: belegen Platz, bis sie abgebrochen sind; Ordner: Stück-Ordner). */
  offeneUploads?(praefix: string): AsyncGenerator<{ objekt: string; upload: string }>;
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
