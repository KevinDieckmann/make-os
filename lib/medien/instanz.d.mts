// Typen zu lib/medien/instanz.mjs (Medien der ganzen Instanz: auflisten, Inventur, leeren, Plan des Löschskripts).

/** Was ein Speicher dafür können muss (MedienSpeicher der App bzw. `s3Basis`). */
export interface ListenSpeicher {
  auflisten?(praefix: string): AsyncGenerator<{ objekt: string; bytes: number; fremd?: true }>;
  offeneUploads?(praefix: string): AsyncGenerator<{ objekt: string; upload: string }>;
  loeschen(objekt: string): Promise<void>;
  abbrechen(objekt: string, upload: string): Promise<void>;
}

export interface MedienInventur {
  modus: 's3' | 'ordner';
  /** Wo: Endpunkt + Bucket bzw. Ordner (ohne Zugangsdaten). */
  ort: string;
  praefix: string;
  objekte: number;
  /** Gespeicherte Größe (Chiffrat) in Bytes. */
  bytes: number;
  /** Namen unter dem Präfix, die nicht wie Medien-Objekte aussehen — werden nie gelöscht. */
  fremd: number;
  offeneUploads: number;
}

export interface MedienObjekt {
  objekt: string;
  bytes: number;
  /** Medium (`md-…`) bzw. Einwilligung (`ew-…`) und Variante aus dem Namen `<präfix>/<kennung>/<variante>`. */
  kennung?: string;
  variante?: string;
  fremd?: true;
}

export interface MedienLeerBericht { geloescht: number; bytes: number; abgebrochen: number; fehler: number; fremd: number }

export function ordnerZaehlen(ordner: string): Promise<{ dateien: number; bytes: number }>;
export function ortVon(k: { modus: 's3'; endpunkt: string; bucket: string } | { modus: 'ordner'; ordner: string } | { modus: 'aus' }): string;
export function objektTeile(objekt: string, praefix: string): { kennung?: string; variante?: string };
export function medienObjekteListen(s: ListenSpeicher, praefix: string): Promise<MedienObjekt[]>;
export function medienInventur(s: ListenSpeicher, k: { modus: 's3' | 'ordner'; ort: string; praefix: string }): Promise<MedienInventur>;
export function medienLeeren(s: ListenSpeicher, praefix: string): Promise<MedienLeerBericht>;

export type MedienPlan =
  | { ok: false; abbruch: string }
  | { ok: true; zeilen: string[]; stand: string; ausfuehren(): Promise<{ ok: true; zeilen: string[] } | { ok: false; abbruch: string }> };
export function medienPlan(o: {
  env: Record<string, string | undefined>;
  datenOrdner: string;
  lokal?: string | null;
  ohneMedien?: boolean;
  holen?: typeof fetch;
}): Promise<MedienPlan>;
