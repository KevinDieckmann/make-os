// ─── Zugang: Haushalt des Inhabers ──────────────────────────────────────────
// Kalender (25.09.) und Business-Index (25.09.) gehören Kevin und Malin: Sehen
// und ändern darf, wer im SELBEN Haushalt ist wie der Inhaber — ein anderer
// Haushalt (z. B. der Test-Haushalt) oder ein Konto ohne Haushalt nicht. Dazu
// der Dienstweg (Arbeiter, Zulieferer, Jarvis im Hintergrund), den die
// Middleware schon am Schlüssel erkannt hat.

import { ladeKonten } from '@/lib/zugang/konten';
import { istDienst } from '@/lib/zugang/dienst';

export async function imHaushaltDesInhabers(req: Request): Promise<{ person: string; dienst: boolean } | null> {
  if (istDienst(req)) {
    const p = req.headers.get('x-make-person');
    return { person: p && /^[a-z0-9-]{1,40}$/.test(p) ? p : 'kevin', dienst: true };
  }
  const person = req.headers.get('x-make-user');
  if (!person || !/^[a-z0-9-]{1,40}$/.test(person)) return null;
  return (await personImHaushaltDesInhabers(person)) ? { person, dienst: false } : null;
}

/** Dieselbe Regel für eine Person (z. B. Jarvis-Werkzeuge, die im Auftrag handeln). */
export async function personImHaushaltDesInhabers(person: string | undefined | null): Promise<boolean> {
  if (!person || !/^[a-z0-9-]{1,40}$/.test(person)) return false;
  const { konten } = await ladeKonten();
  const inhaber = konten.find(k => k.rolle === 'inhaber');
  const ich = konten.find(k => k.speicher === person);
  if (!inhaber || !ich) return false;
  if (ich.speicher === inhaber.speicher) return true;
  return !!inhaber.haushalt && ich.haushalt === inhaber.haushalt;
}

/** Ist diese Person der Inhaber (Rolle)? */
export async function istInhaber(person: string | null | undefined): Promise<boolean> {
  if (!person) return false;
  const { konten } = await ladeKonten();
  return konten.find(k => k.speicher === person)?.rolle === 'inhaber';
}

/**
 * Kevins Mac-Postfach und Adressbuch (26.09.): nur der Inhaber selbst. Der
 * Dienstweg ohne Person ist ein Systemlauf (Zulieferer, Signale) und darf;
 * handelt er für eine Person (Jarvis), gilt deren Recht.
 */
export async function nurInhaber(req: Request): Promise<boolean> {
  const w = await imHaushaltDesInhabers(req);
  if (!w) return false;
  if (w.dienst && !req.headers.get('x-make-person')) return true;
  return istInhaber(w.person);
}

/** Der Haushalt des Inhabers — Kalender und Business-Index gehören genau diesem Haushalt. */
export async function haushaltDesInhabers(): Promise<string | null> {
  const { konten } = await ladeKonten();
  return konten.find(k => k.rolle === 'inhaber')?.haushalt ?? null;
}
