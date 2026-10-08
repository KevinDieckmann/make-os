// ─── Kontoauszug einlesen — EIN Einstieg für beide Formate (09.10., rein: Server UND Browser) ───────────────────────────────────────────
// `auszugLesen(bytes, { spalten })` erkennt CAMT (XML) oder CSV und liefert dieselbe Form (lib/finanzen/kontoauszug/typen.ts). Der Browser ruft
// es für die Spaltenzuordnung, der Server zum Übernehmen noch einmal mit denselben Bytes — die Datei wird nirgends gespeichert.
// Grenzen: höchstens 5 MB und 10.000 Umsätze (darüber 413, nie gekürzt); PDF/ZIP/Bilder → 415 mit einem Satz, was stattdessen geht.

import { camtLesen, istCamt } from './camt';
import { csvLesen } from './csv';
import { textAusBytes } from './text';
import { AUSZUG_GRENZEN, type LeseErgebnis } from './typen';

const beginnt = (b: Uint8Array, sig: number[]) => sig.every((x, i) => b[i] === x);

export function auszugLesen(bytes: Uint8Array, opt: { spalten?: unknown } = {}): LeseErgebnis {
  if (bytes.length > AUSZUG_GRENZEN.bytes) return { ok: false, status: 413, fehler: 'Die Datei ist größer als 5 MB — bitte einen kürzeren Zeitraum herunterladen. Nichts gelesen.' };
  if (!bytes.length) return { ok: false, status: 400, fehler: 'Die Datei ist leer.' };
  if (beginnt(bytes, [0x25, 0x50, 0x44, 0x46])) return { ok: false, status: 415, fehler: 'Das ist ein PDF — hier gehen CAMT (XML) und CSV. Ein N26-PDF liest „Kontoauszug einlesen“ im Haushalt (Privat › Konten & Buchungen).' };
  if (beginnt(bytes, [0x50, 0x4b, 0x03, 0x04])) return { ok: false, status: 415, fehler: 'Das ist ein ZIP-Archiv — bitte entpacken und die XML- bzw. CSV-Datei wählen.' };
  if (beginnt(bytes, [0x89, 0x50, 0x4e, 0x47]) || beginnt(bytes, [0xff, 0xd8, 0xff])) return { ok: false, status: 415, fehler: 'Das ist ein Bild — hier gehen CAMT (XML) und CSV.' };
  const { text } = textAusBytes(bytes);
  if (text.includes('\u0000')) return { ok: false, status: 415, fehler: 'Die Datei ist kein Text — hier gehen CAMT (XML) und CSV.' };
  return istCamt(text) ? camtLesen(text) : csvLesen(bytes, opt);
}

/** base64 (aus dem Browser) → Bytes; ungültig → null. */
export function bytesAusBase64(b64: unknown): Uint8Array | null {
  if (typeof b64 !== 'string' || !/^[A-Za-z0-9+/=\s]*$/.test(b64)) return null;
  try {
    const roh = atob(b64.replace(/\s+/g, ''));
    const out = new Uint8Array(roh.length);
    for (let i = 0; i < roh.length; i++) out[i] = roh.charCodeAt(i);
    return out;
  } catch { return null; }
}

/** Bytes → base64 (im Browser, für den Versand an den Server). */
export function bytesZuBase64(b: Uint8Array): string {
  let s = '';
  const STUECK = 0x8000;
  for (let i = 0; i < b.length; i += STUECK) s += String.fromCharCode(...Array.from(b.subarray(i, i + STUECK)));
  return btoa(s);
}

export type { LeseErgebnis };
