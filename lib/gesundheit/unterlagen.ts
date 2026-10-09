// ─── Gesundheits-Unterlagen je Person — Regeln (rein, client-sicher; 09.10.) ─────────────────────────────────────────────────────
// Kevin 09.10.: „… beim Onboarding im Thema Gesundheit wirklich auch einen Prompt jeweils für den Agenten schreiben … Oder eine Datei hochgeladen
// werden kann.“ Eine geschützte Ablage für Gesundheits-Unterlagen (Arztbrief, Laborwerte, Trainingsplan) — Art. 9 DSGVO:
//   • gehört NUR der Person selbst: Bestand `gesundheit-unterlagen--<person>` (immer mit Suffix, auch das Erstkonto), Dateien verschlüsselt in der
//     Bild-Ablage (Ordner `gesundheit-unterlagen`, lib/store/bild-ablage.ts — Hülle mit AAD, atomar, 0600); auch bei „Gesundheit teilen“ nie
//     andere Konten, nie der Inhaber, nie der Dienstweg;
//   • Speichern nur mit Einwilligung (a) (`gesundheitSchreibSperre`); Lesen/Herunterladen/Löschen der EIGENEN immer (Art. 15/17);
//   • Typ am INHALT (PDF, PNG, JPG, HEIC, TXT, MD — Endung muss passen), höchstens 15 MB je Datei, höchstens `UNTERLAGEN_MAX` je Person (413);
//   • Text daraus geht NUR an den Gesundheits-Head der Person und NUR mit Einwilligung (b) — gekapselt (`fremd()`), höchstens `UNTERLAGEN_ZEICHEN`
//     je Aufruf, darüber sichtbar „Teil x von y“ (nie still gekürzt). Bilder haben keinen Text (keine Texterkennung) — nur Angaben.

import { aufgabenTypErkennen } from '@/lib/dateien/aufgaben-regeln';

/** Bestand je Person (immer mit Suffix). */
export const unterlagenBestand = (person: string) => `gesundheit-unterlagen--${person}`;
/** Ordner der Dateien in der Bild-Ablage (lib/store/datei-huelle.mjs `BILD_ORDNER`). */
export const UNTERLAGEN_ORDNER = 'gesundheit-unterlagen' as const;
/** Höchstens 15 MB je Datei. */
export const MAX_UNTERLAGE_BYTES = 15 * 1024 * 1024;
/** Höchstens so viele Unterlagen je Person — darüber 413 (nie still verworfen). */
export const UNTERLAGEN_MAX = 200;
/** So viele Zeichen gibt der Gesundheits-Head je Aufruf höchstens weiter — darüber „Teil x von y“. */
export const UNTERLAGEN_ZEICHEN = 30_000;
/** Notiz je Unterlage. */
export const NOTIZ_MAX = 300;

/** Erlaubte Typen (am Inhalt erkannt) mit Endungen. */
export const UNTERLAGEN_TYPEN = {
  'application/pdf': ['pdf'],
  'image/png': ['png'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/heic': ['heic', 'heif'],
  'text/plain': ['txt'],
  'text/markdown': ['md'],
} as const;
export type UnterlageTyp = keyof typeof UNTERLAGEN_TYPEN;
/** Für `<input accept>`. */
export const UNTERLAGEN_ANNEHMEN = Object.values(UNTERLAGEN_TYPEN).flat().map(e => `.${e}`).join(',');

/** Kennung `gu-<uuid>` — zugleich der Dateiname in der Ablage (`<id>.bin`). */
export const UNTERLAGE_ID = /^gu-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const dateiNameVon = (id: string) => `${id}.bin`;

export interface Unterlage {
  id: string;
  /** Dateiname (gesäubert, mit Endung). */
  name: string;
  typ: UnterlageTyp;
  groesse: number;
  hochgeladen: string;
  /** SHA-256 des Inhalts (gleiche Datei zweimal → 409). */
  pruefsumme: string;
  notiz?: string;
}
export interface UnterlagenDatei { v: 1; unterlagen: Unterlage[] }
export const UNTERLAGEN_LEER: UnterlagenDatei = { v: 1, unterlagen: [] };

/** Typ am INHALT erkennen (und mit der Endung abgleichen) — nur die erlaubten. null → 415. Rein. */
export function unterlageTypErkennen(name: string, bytes: Uint8Array): UnterlageTyp | null {
  const t = aufgabenTypErkennen(name, bytes);
  return t && t in UNTERLAGEN_TYPEN ? (t as UnterlageTyp) : null;
}

/** Bild ohne Text (keine Texterkennung). */
export const istBild = (typ: string): boolean => typ.startsWith('image/');

/** Notiz säubern: Steuerzeichen weg, höchstens `NOTIZ_MAX` — darüber 413 (die Route), hier nur prüfen. Rein. */
export function notizSaeubern(v: unknown): { ok: true; notiz?: string } | { ok: false; status: 400 | 413; fehler: string } {
  if (v === undefined || v === null || v === '') return { ok: true };
  if (typeof v !== 'string') return { ok: false, status: 400, fehler: 'Notiz: ein Text.' };
  // eslint-disable-next-line no-control-regex -- Steuerzeichen bewusst entfernen
  const t = v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  if (t.length > NOTIZ_MAX) return { ok: false, status: 413, fehler: `Die Notiz hat ${t.length} Zeichen — höchstens ${NOTIZ_MAX}. Nichts gespeichert.` };
  return t ? { ok: true, notiz: t } : { ok: true };
}

/** Bestand säubern (Lesen): nur gültige Einträge, nie gekürzt. Rein. */
export function unterlagenSaeubern(roh: unknown): UnterlagenDatei {
  const l = roh && typeof roh === 'object' && Array.isArray((roh as UnterlagenDatei).unterlagen) ? (roh as UnterlagenDatei).unterlagen : [];
  const unterlagen = l.filter((u): u is Unterlage => !!u && typeof u === 'object' && UNTERLAGE_ID.test(String(u.id)) && typeof u.name === 'string'
    && typeof u.typ === 'string' && u.typ in UNTERLAGEN_TYPEN && typeof u.groesse === 'number' && typeof u.hochgeladen === 'string');
  return { v: 1, unterlagen };
}

/**
 * Ein Abschnitt aus einem langen Text: Teil `teil` (1-basiert) zu je `UNTERLAGEN_ZEICHEN`. Rein. Über der Länge: `teile` > 1, der Aufrufer sagt
 * „Teil x von y“ — nie still gekürzt. Ein Teil außerhalb → null.
 */
export function abschnitt(text: string, teil = 1, je = UNTERLAGEN_ZEICHEN): { text: string; teil: number; teile: number } | null {
  const teile = Math.max(1, Math.ceil(text.length / je));
  if (!Number.isInteger(teil) || teil < 1 || teil > teile) return null;
  return { text: text.slice((teil - 1) * je, teil * je), teil, teile };
}

/** Größe lesbar. */
export const groesseText = (b: number): string => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
