export const HUELLE: '__verschluesselt';
export const HUELLE_VERSION: 2;
export class SchluesselFehlt extends Error {}
export class EntschluesselungFehlgeschlagen extends Error {}
export interface Schluessel { kid: string; key: Buffer }
export interface SchluesselRing { aktiv: Schluessel | null; alle: Schluessel[] }
export function schluesselAus(geheim: string): Schluessel;
export function schluesselNeuLaden(): void;
export function schluesselQuelle(env?: NodeJS.ProcessEnv): 'datei' | 'umgebung' | 'keiner';
export function schluesselRing(env?: NodeJS.ProcessEnv): SchluesselRing;
export function aadFuer(bestand: string): Buffer;
export function huellenVersion(o: unknown): 0 | 1 | 2;
export function huelleSchreiben(text: string, schluessel: Schluessel, bestand: string): string;
export function huelleV1Schreiben(text: string, key: Buffer): string;
export function huelleOeffnen(o: unknown, ring: SchluesselRing, bestand: string): { text: string; version: 1 | 2; kid: string | null };
