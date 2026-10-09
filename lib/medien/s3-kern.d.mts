// Typen zu lib/medien/s3-kern.mjs (S3-Kern ohne Abhängigkeiten — App und Löschskript).

export function objektOk(o: string): boolean;
export function praefixOk(p: string): boolean;

export const LEERER_HASH: string;
export function awsKodieren(s: string, schraeg?: boolean): string;
export function kanonischeAbfrage(abfrage: Record<string, string>): string;

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
export function signiere(e: SignierEingabe): Record<string, string>;
export function zuSignierenFuer(e: SignierEingabe): string;

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
export const S3_VARIABLEN: readonly string[];
export function praefixAus(env: Record<string, string | undefined>): string;
export function s3KonfigAus(env: Record<string, string | undefined>): S3Konfig | null;
export function s3Angegeben(env: Record<string, string | undefined>): boolean;

export function xmlWert(xml: string, tag: string): string | null;
export function xmlBloecke(xml: string, tag: string): string[];

export interface S3Aufruf { abfrage?: Record<string, string>; koerper?: Buffer; kopf?: Record<string, string>; ok?: number[] }
export interface S3Basis {
  /** Ein signierter Aufruf; `objekt: null` = Bucket-Ebene. */
  rufe(methode: string, objekt: string | null, o?: S3Aufruf): Promise<Response>;
  loeschen(objekt: string): Promise<void>;
  abbrechen(objekt: string, upload: string): Promise<void>;
  auflisten(praefix: string): AsyncGenerator<{ objekt: string; bytes: number; fremd?: true }>;
  offeneUploads(praefix: string): AsyncGenerator<{ objekt: string; upload: string }>;
}
export function s3Basis(k: S3Konfig, holen: typeof fetch, fehler: (text: string, status: number, code?: string) => Error): S3Basis;
