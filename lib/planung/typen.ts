// ─── MAKE OS — Planung: die Typen (eine Wahrheit) ───────────────────────────
// Ziele, Meilensteine, Routinen und Wochen-Blöcke waren je Route und je Ansicht
// einzeln notiert. Seit Malins Rückmeldung (27.09.) tragen alle vier einen
// Rang (Priorität per Pfeil), Ziele und Meilensteine im Business eine Einheit,
// Routinen Space, Person, Rhythmus. Client-safe, keine Server-Importe.

import type { SpaceId } from '@/lib/make-one/space-regeln';

export type { SpaceId };

/** Altfeld der Meilensteine (siehe `Meilenstein.bereich`). */
export type MeilensteinBereich = 'business' | 'gesundheit';

/** Die fünf Ebenen der Ziele — die Kaskade läuft von oben nach unten. */
export type ZielHorizont = 'tag' | 'woche' | 'monat' | 'quartal' | 'jahr';
export const ZIEL_HORIZONTE: readonly ZielHorizont[] = ['tag', 'woche', 'monat', 'quartal', 'jahr'];
export const istZielHorizont = (v: unknown): v is ZielHorizont => (ZIEL_HORIZONTE as readonly string[]).includes(v as string);

export interface Ziel {
  id: string;
  titel: string;
  /** 0–100, ehrlich gepflegt. */
  fortschritt: number;
  notiz?: string;
  erledigt?: boolean;
  erledigtAm?: string;
  /** Privat oder Business — ohne Angabe gemeinsam sichtbar in beiden. */
  space?: SpaceId;
  /** Priorität: 1 = ganz oben. Ohne Rang hinten, in Anlage-Reihenfolge. */
  rang?: number;
  /** Business-Einheit (Selbstständigkeit · KD Ventures · Kunden · eigene). Nur im Business. */
  einheit?: string;
  /** Zahlenziel (z. B. 120 Neukunden) — wird auf Quartal/Monat/Woche/Tag verteilt. */
  zielwert?: number;
  /** Ziel mit Datum (YYYY-MM-DD) — wird als Meilenstein im passenden Quartal angelegt. */
  termin?: string;
  /** Id des Jahresziels, aus dem dieses Ziel abgeleitet ist. */
  abgeleitetVon?: string;
  /** Abgeleitet, aber von Hand geändert — die Kaskade rechnet es nicht mehr neu. */
  angepasst?: boolean;
  /**
   * Mandat an Zielen und Zeit (28.09.): das CRM-Mandat, auf das dieses Ziel einzahlt — nur im Business.
   * Ist es gesetzt, kommen Firma und Einheit aus dem Mandat (lib/planung/mandat.ts `mitMandatBezug`).
   */
  mandatId?: string;
  /** Die CRM-Firma (Mandant) — aus dem Mandat abgeleitet, nur im Business. */
  firmaId?: string;
}

export interface Meilenstein {
  id: string;
  titel: string;
  /**
   * Privat oder Business (28.09.) — das echte Feld, wie bei Zielen und Routinen. Fehlt nur im
   * Altbestand, der noch nicht wieder gespeichert wurde: lesen deshalb immer über
   * `meilensteinSpace()` (lib/planung/meilensteine.ts), nie direkt.
   */
  space?: SpaceId;
  /**
   * Altfeld (vor 28.09. die Ersatzlösung für den Space): gesundheit = privat, business = business.
   * Wird beim Speichern aus `space` gespiegelt, damit ältere Leser (Brain, Loop, Gesundheits- und
   * Business-Säule) unverändert weiterlaufen. Nicht mehr selbst setzen — `space` ist führend.
   */
  bereich?: MeilensteinBereich;
  /** Fester Tag YYYY-MM-DD … */
  faellig?: string;
  /** … oder freies Zeitfenster („Q3", „2028"). */
  zeitfenster?: string;
  /** Woran wird „fertig" gemessen? */
  messlatte?: string;
  fortschritt: number;
  erledigt: boolean;
  erledigtAm?: string;
  rang?: number;
  einheit?: string;
  abgeleitetVon?: string;
  angepasst?: boolean;
  /** Mandat an Zielen und Zeit (28.09., wie am Ziel) — nur im Business; Firma und Einheit kommen aus dem Mandat. */
  mandatId?: string;
  firmaId?: string;
}

export type Rhythmus = 'taeglich' | '3x-woche' | 'woechentlich' | 'monatlich' | 'quartal' | 'halbjahr' | 'jaehrlich';
export const RHYTHMEN: { id: Rhythmus; label: string; kurz: string }[] = [
  { id: 'taeglich', label: 'täglich', kurz: 'täglich' },
  { id: '3x-woche', label: '3× pro Woche', kurz: '3×/Wo' },
  { id: 'woechentlich', label: 'wöchentlich', kurz: 'wöchentl.' },
  { id: 'monatlich', label: 'monatlich', kurz: 'monatl.' },
  { id: 'quartal', label: 'quartalsweise', kurz: 'Quartal' },
  { id: 'halbjahr', label: 'halbjährlich', kurz: 'Halbjahr' },
  { id: 'jaehrlich', label: 'jährlich', kurz: 'jährlich' },
];
export const istRhythmus = (v: unknown): v is Rhythmus => RHYTHMEN.some(r => r.id === v);

/** Wem eine Routine gehört: eine Person (Speichername) oder „beide“ (gemeinsam, jede Person hakt selbst ab). */
export const OWNER_BEIDE = 'beide';

export interface Routine {
  id: string;
  label: string;
  wann: 'morgen' | 'tag' | 'abend';
  kategorie: 'gesundheit' | 'leben' | 'business';
  dauerMin: number;
  aktiv: boolean;
  /** Fehlt → privat (Altbestand). */
  space?: SpaceId;
  /** Fehlt → beide (Altbestand: alle sahen alles). */
  owner?: string;
  /** Fehlt → täglich. */
  rhythmus?: Rhythmus;
  /** Nächste Fälligkeit (YYYY-MM-DD) für Rhythmen ab wöchentlich — z. B. Arzt, Steuererklärung. */
  naechstesMal?: string;
  rang?: number;
  /** Business-Einheit (27.09., wie bei Zielen) — nur bei `space: 'business'`. */
  einheit?: string;
}

/** Wochentag 1 = Montag … 7 = Sonntag. */
export type Wochentag = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const WOCHENTAGE: { id: Wochentag; kurz: string; label: string }[] = [
  { id: 1, kurz: 'Mo', label: 'Montag' }, { id: 2, kurz: 'Di', label: 'Dienstag' }, { id: 3, kurz: 'Mi', label: 'Mittwoch' },
  { id: 4, kurz: 'Do', label: 'Donnerstag' }, { id: 5, kurz: 'Fr', label: 'Freitag' }, { id: 6, kurz: 'Sa', label: 'Samstag' }, { id: 7, kurz: 'So', label: 'Sonntag' },
];

/** Ein Zeitfenster der Wochenvorlage einer Person: wann Privat, wann Arbeit. */
export interface Block {
  id: string;
  owner: string;
  wochentag: Wochentag;
  /** HH:MM */
  von: string;
  bis: string;
  art: SpaceId;
  titel?: string;
  rang?: number;
  /** Business-Einheit (28.09., wie bei Zielen und Routinen) — nur bei `art: 'business'`, optional. */
  einheit?: string;
}

export interface RoutinenDatei { routinen: Routine[]; bloecke?: Block[] }
export type ZieleDatei = Record<ZielHorizont, Ziel[]> & { fokus?: Record<string, string> };
