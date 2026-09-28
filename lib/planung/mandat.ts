// ─── MAKE OS — Mandat an Zielen und Zeit (28.09.) ───────────────────────────
// Kevin: „Mandat an Zielen und Zeit.“ Ziele, Meilensteine und Fokus-Blöcke
// tragen im Business optional den Bezug zum Mandanten: `mandatId` (CRM-Mandat)
// und `firmaId` (CRM-Firma). Ist ein Mandat gesetzt, kommen Firma und Einheit
// aus dem Mandat — die Einheit über seine Gesellschaft, genau wie bei System-
// Aufgaben (lib/aufgaben/einheit.ts `einheitAusBezug`: Mandat → Deal → Produkt).
//
// Hier liegt nur Reines (client-sicher, getestet):
//   · `bezugSaeubern`   — Form der Kennungen, nur im Business (keine Existenzprüfung)
//   · `mandatKurzListe` — die Mandate als Kurzform für Auswahl und Auswertung
//   · `mitMandatBezug`  — Firma und Einheit aus dem Mandat ableiten
//   · `mandatWahlListe` — die Einträge des Mandat-Chips („Firma · Mandatstitel“)
// Tote Verweise meldet die Verbindungsprüfung (lib/crm/verbindungen-planung.ts).
// Laden auf dem Server: lib/planung/mandat-server.ts.

import { einheitName } from '@/lib/einheiten';
import { einheitAusBezug, einheitFarbe } from '@/lib/aufgaben/einheit';

/** Form einer CRM-Kennung (wie der CRM-Schreibweg sie prüft, lib/crm/speicher.ts). */
export const KENNUNG_CRM = /^[a-z0-9][a-z0-9-]{1,63}$/;

/** Eine Kennung säubern — nur die Form, nicht ob es sie gibt. */
export function sauberKennung(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  return KENNUNG_CRM.test(s) ? s : undefined;
}

export interface MandatBezug { mandatId?: string; firmaId?: string }

/** Der Bezug, wie er gespeichert wird: nur im Business, nur gültige Kennungen, sonst leer. */
export function bezugSaeubern(roh: { mandatId?: unknown; firmaId?: unknown } | null | undefined, business: boolean): MandatBezug {
  if (!business || !roh) return {};
  const mandatId = sauberKennung(roh.mandatId);
  const firmaId = sauberKennung(roh.firmaId);
  return { ...(mandatId ? { mandatId } : {}), ...(firmaId ? { firmaId } : {}) };
}

// ── Mandate als Kurzform ────────────────────────────────────────────────────

/** Was Auswahl, Ableitung und Auswertung von einem Mandat brauchen. */
export interface MandatKurz {
  id: string;
  titel: string;
  /** Anzeigename der Firma (CRM-Firma, sonst der Kundenname am Mandat). */
  firma: string;
  firmaId?: string;
  /** Business-Einheit aus der Gesellschaft (Mandat → Deal → Produkt); „offen“ → keine. */
  einheit?: string;
  status: string;
  aktiv: boolean;
  /** Monatshonorar netto (nur bei Basis „Monat“) — für den groben Hinweis €/Stunde, kein Rechnungsbezug. */
  honorarMonat?: number;
}

type MandatRoh = {
  id: string; titel?: string; kunde?: string; firmaId?: string; status?: string; gesellschaft?: string; leistungId?: string; chanceId?: string;
  honorar?: { betrag?: number; basis?: string; netto?: boolean }; ustSatz?: number;
};
export interface CrmFuerMandat {
  mandate?: readonly MandatRoh[];
  firmen?: readonly { id: string; name?: string }[];
  chancen?: readonly { id: string; gesellschaft?: string; leistungId?: string }[];
  leistungen?: readonly { id: string; gesellschaft?: string }[];
}

/** Netto-Monatshonorar — brutto über den USt-Satz zurückgerechnet; andere Basis oder 0 € → undefined. */
export function honorarMonatNetto(h: MandatRoh['honorar'], ustSatz?: number): number | undefined {
  const betrag = Number(h?.betrag);
  if (h?.basis !== 'monat' || !Number.isFinite(betrag) || betrag <= 0) return undefined;
  const ust = Number.isFinite(Number(ustSatz)) ? Number(ustSatz) : 19;
  return Math.round((h.netto === false ? betrag / (1 + ust / 100) : betrag) * 100) / 100;
}

/** Alle Mandate als Kurzform — aktive zuerst, dann nach Firma und Titel. */
export function mandatKurzListe(crm: CrmFuerMandat | null | undefined): MandatKurz[] {
  if (!crm) return [];
  const firmen = new Map((crm.firmen ?? []).map(f => [f.id, f.name ?? '']));
  return (crm.mandate ?? []).filter(m => m && typeof m.id === 'string').map(m => {
    const einheit = einheitAusBezug(crm, { mandatId: m.id });
    const honorarMonat = honorarMonatNetto(m.honorar, m.ustSatz);
    return {
      id: m.id,
      titel: String(m.titel ?? '').trim() || 'Mandat',
      firma: (m.firmaId ? firmen.get(m.firmaId) : '')?.trim() || String(m.kunde ?? '').trim() || 'ohne Firma',
      ...(m.firmaId ? { firmaId: m.firmaId } : {}),
      ...(einheit ? { einheit } : {}),
      status: String(m.status ?? ''),
      aktiv: m.status === 'aktiv',
      ...(honorarMonat ? { honorarMonat } : {}),
    };
  }).sort((a, b) => Number(b.aktiv) - Number(a.aktiv) || a.firma.localeCompare(b.firma, 'de') || a.titel.localeCompare(b.titel, 'de'));
}

/** „Firma · Mandatstitel“ */
export const mandatLabel = (m: Pick<MandatKurz, 'firma' | 'titel'>): string => `${m.firma} · ${m.titel}`;

const alsKarte = (m: ReadonlyMap<string, MandatKurz> | readonly MandatKurz[]): ReadonlyMap<string, MandatKurz> =>
  (m instanceof Map ? m : new Map((m as readonly MandatKurz[]).map(x => [x.id, x])));

type MitBezug = { einheit?: string; mandatId?: string; firmaId?: string };

/**
 * Firma und Einheit aus dem Mandat ableiten (28.09.):
 * - nicht im Business → `mandatId`/`firmaId` fallen weg (Privat kennt keine Mandanten);
 * - Mandat bekannt → `firmaId` aus dem Mandat (sonst bleibt die gesetzte), Einheit aus seiner Gesellschaft
 *   (sonst bleibt die gesetzte);
 * - Mandat unbekannt oder keine Mandate geladen → unverändert (die Verbindungsprüfung meldet tote Verweise).
 */
export function mitMandatBezug<T extends MitBezug>(e: T, mandate: ReadonlyMap<string, MandatKurz> | readonly MandatKurz[] | null | undefined, business: boolean): T {
  if (!business) {
    if (e.mandatId === undefined && e.firmaId === undefined) return e;
    const { mandatId: _m, firmaId: _f, ...rest } = e;
    return rest as T;
  }
  if (!e.mandatId || !mandate) return e;
  const m = alsKarte(mandate).get(e.mandatId);
  if (!m) return e;
  const firmaId = m.firmaId ?? e.firmaId;
  const einheit = einheitName(m.einheit) ?? e.einheit;
  const { firmaId: _f, einheit: _e, ...rest } = e;
  return { ...rest, ...(firmaId ? { firmaId } : {}), ...(einheit ? { einheit } : {}) } as T;
}

/** Kommt in den rohen Daten irgendwo eine Mandats-Kennung vor? Dann lohnt es, das CRM zu laden. */
export function hatMandatKennung(roh: unknown, tiefe = 0): boolean {
  if (!roh || typeof roh !== 'object' || tiefe > 4) return false;
  if (Array.isArray(roh)) return roh.some(x => hatMandatKennung(x, tiefe + 1));
  const o = roh as Record<string, unknown>;
  if (typeof o.mandatId === 'string' && o.mandatId) return true;
  return Object.values(o).some(v => typeof v === 'object' && hatMandatKennung(v, tiefe + 1));
}

// ── Auswahl (Mandat-Chip) ───────────────────────────────────────────────────

export interface MandatWahlEintrag { id: string; label: string; hinweis?: string; punkt?: string }

/**
 * Die Einträge des Mandat-Chips: aktive Mandate („Firma · Mandatstitel“, Einheit als Hinweis) — das gerade gewählte
 * bleibt drin, auch wenn es nicht mehr aktiv ist; ein gewähltes, das es nicht mehr gibt, steht als „Mandat (gelöscht)“.
 */
export function mandatWahlListe(mandate: readonly MandatKurz[], gewaehlt?: string | null): MandatWahlEintrag[] {
  const aus: MandatWahlEintrag[] = mandate.filter(m => m.aktiv || m.id === gewaehlt).map(m => {
    const label = mandatLabel(m);
    return {
      id: m.id,
      label: label.length > 70 ? `${label.slice(0, 69)}…` : label,
      ...(m.einheit ? { hinweis: m.aktiv ? m.einheit : `${m.einheit} · nicht aktiv`, punkt: einheitFarbe(m.einheit) } : m.aktiv ? {} : { hinweis: 'nicht aktiv' }),
    };
  });
  if (gewaehlt && !aus.some(e => e.id === gewaehlt)) aus.push({ id: gewaehlt, label: 'Mandat (gelöscht)' });
  return aus;
}
