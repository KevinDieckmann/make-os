import type { SchluesselRing, Schluessel } from './huelle.mjs';
export const MAGIE_V1: Buffer;
export const MAGIE_V2: Buffer;
export function binVersion(b: Buffer | Uint8Array): 0 | 1 | 2;
export function binAad(haushalt: string, id: string): Buffer;
export function binAusPfad(pfad: string): { haushalt: string; id: string } | null;
export function binSchreiben(klar: Buffer | Uint8Array, schluessel: Schluessel, haushalt: string, id: string): Buffer;
export function binV1Schreiben(klar: Buffer | Uint8Array, key: Buffer): Buffer;
export function binOeffnen(b: Buffer, ring: SchluesselRing, haushalt: string, id: string): { klar: Buffer; version: 1 | 2; kid: string };
