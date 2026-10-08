// ─── Privat-Index — Speicher (Server) ───────────────────────────────────────
// Je Haushalt: die Rücklage (Notgroschen, von euch eingetragen), eigene
// Schwellen und ein Schnappschuss am Tag (lib/kennzahlen/speicher). Gelesen
// wird nur der Haushalt der anfragenden Person — nie Business, nie ein
// anderer Haushalt.

import { updateJson } from '@/lib/store/local-db';
import { merken } from '@/lib/store/memo';
import { ladeHaushalt } from '@/lib/finanzen/haushalt/speicher';
import { HAUSHALT_OK } from '@/lib/finanzen/haushalt/zugriff';
import { heuteBerlin } from '@/lib/finanzen/haushalt/monat';
import { ladeIndexDatei, fortschreiben, speichereSchwelle, indexName, type IndexDatei, type IndexVerlauf } from '@/lib/kennzahlen/speicher';
import { berechnePrivat, privatFrisch, PRIVAT_KENNZAHLEN, type PrivatIndex } from './index';
import type { ZeitBild } from '@/lib/zeitmessung/modell';
import { ruecklageAusRegister } from '@/lib/finanzen/konten/server';

interface Extra { ruecklage: { betrag: number; stand: string; von: string } | null }
export type PrivatDatei = IndexDatei & Extra;

const name = (haushalt: string) => {
  if (!HAUSHALT_OK.test(haushalt)) throw new Error(`Ungültiger Haushalt: ${haushalt}`);
  return indexName(`privat-index--${haushalt}`);
};

export async function ladePrivatDatei(haushalt: string): Promise<PrivatDatei> {
  const d = await ladeIndexDatei<Extra>(name(haushalt));
  return { ...d, ruecklage: d.ruecklage ?? null };
}

/** Die wirksame Rücklage: `quelle: 'register'` = Tagesgeld (privat + gemeinsam) aus dem Konten-Register (08.10.), sonst die eingetragene. */
export type Ruecklage = (NonNullable<PrivatDatei['ruecklage']> & { quelle?: 'register' }) | null;
export interface PrivatStand extends IndexVerlauf { pi: PrivatIndex; frisch: boolean; ruecklage: Ruecklage }

/**
 * Konten-Register (08.10., „Haushalt führt das Ist“): führt das Register Tagesgeld-Konten des Haushalts mit Stand, ist ihre Summe die Rücklage —
 * sonst gilt die eingetragene (bit-gleich wie vorher). Die Eintragung bleibt gespeichert (Rückweg).
 */
async function ruecklageWirksam(haushalt: string, d: PrivatDatei): Promise<Ruecklage> {
  const r = await ruecklageAusRegister(haushalt);
  return r ? { betrag: r.betrag, stand: r.stand, von: d.ruecklage?.von ?? '', quelle: 'register' } : d.ruecklage;
}

/** Rechnet den Index des Haushalts, schreibt einmal am Tag den Schnappschuss (nur mit Buchungen). */
export async function privatStand(haushalt: string, heute = heuteBerlin(), zeit?: ZeitBild | null, person = '-'): Promise<PrivatStand> {
  // Die Zeit ist persönlich — deshalb steckt die Person im Schlüssel des Zwischenspeichers (26.09. spät).
  return merken(`privat:${haushalt}:${person}:${heute}`, 2 * 60_000, () => privatStandFrisch(haushalt, heute, zeit));
}
async function privatStandFrisch(haushalt: string, heute: string, zeit?: ZeitBild | null): Promise<PrivatStand> {
  const [h, d] = await Promise.all([ladeHaushalt(haushalt), ladePrivatDatei(haushalt)]);
  const ruecklage = await ruecklageWirksam(haushalt, d);
  const bestand = { heute, haushalt: h, ruecklage, schwellen: d.schwellen, zeit: zeit ?? null };
  const pi = berechnePrivat(bestand);
  const v = await fortschreiben(name(haushalt), d, pi, heute, h.buchungen.length > 0);
  return { pi, frisch: privatFrisch(bestand), ruecklage, ...v };
}

/** Nur rechnen, nichts schreiben — für den Wachstums-Score. */
export async function privatIndexFuer(haushalt: string, heute = heuteBerlin(), zeit?: ZeitBild | null): Promise<{ pi: PrivatIndex; frisch: boolean }> {
  const [h, d] = await Promise.all([ladeHaushalt(haushalt), ladePrivatDatei(haushalt)]);
  const bestand = { heute, haushalt: h, ruecklage: await ruecklageWirksam(haushalt, d), schwellen: d.schwellen, zeit: zeit ?? null };
  return { pi: berechnePrivat(bestand), frisch: privatFrisch(bestand) };
}

const zahl = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v.replace(/\./g, '').replace(',', '.')) : NaN);

/** Rücklage (Euro) oder eigene Schwelle setzen/zurücksetzen. */
export async function speicherePrivat(haushalt: string, roh: Record<string, unknown>, von: string): Promise<{ ok: true } | { ok: false; fehler: string }> {
  if ('ruecklage' in roh) {
    let ruecklage: Extra['ruecklage'] = null;
    if (!(roh.ruecklage === null || roh.ruecklage === '')) {
      const n = zahl(roh.ruecklage);
      if (!Number.isFinite(n) || n < 0 || n > 1e8) return { ok: false, fehler: 'Rücklage bitte als Betrag in Euro, z. B. 12.000.' };
      ruecklage = { betrag: Math.round(n * 100), stand: heuteBerlin(), von };
    }
    await updateJson<PrivatDatei>(name(haushalt), alt => ({ schwellen: {}, tage: {}, ...(alt ?? {}), ruecklage }));
  }
  if (roh.schwelle && typeof roh.schwelle === 'object') return speichereSchwelle(name(haushalt), PRIVAT_KENNZAHLEN, roh.schwelle as Record<string, unknown>);
  return { ok: true };
}
