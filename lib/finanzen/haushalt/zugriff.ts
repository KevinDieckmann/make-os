// ─── Wer darf an die Haushaltsfinanzen? ─────────────────────────────────────
// Streng, ohne Rückfall: personAus() fällt bei Dienstaufrufen ohne Person auf
// „kevin“ zurück (gewollt für Tageslauf & Co.). Für private Finanzen wäre das
// ein Loch — ein Hintergrundlauf ohne Person sähe dann Kevins Haushalt. Hier
// gilt nur, wer ausdrücklich benannt ist (Sitzung oder Dienstweg mit Person)
// UND am Konto einen Haushalt eingetragen hat.

import { kontoFuerSpeicher } from '@/lib/zugang/konten';

export const HAUSHALT_OK = /^[a-z0-9][a-z0-9-]{0,39}$/;

/** Die ausdrücklich benannte Person — oder null. Kein Rückfall. */
export function personStreng(req: Request): string | null {
  const p = req.headers.get('x-make-user') || req.headers.get('x-make-person');
  return p && /^[a-z0-9-]{1,40}$/.test(p) ? p : null;
}

export interface HaushaltZugang { person: string; haushalt: string }

/** Haushalt der anfragenden Person, oder null (→ 403). */
export async function haushaltVon(req: Request): Promise<HaushaltZugang | null> {
  const person = personStreng(req);
  if (!person) return null;
  return haushaltFuer(person);
}

export async function haushaltFuer(person: string | null | undefined): Promise<HaushaltZugang | null> {
  if (!person) return null;
  const k = await kontoFuerSpeicher(person);
  const h = k?.haushalt;
  // Konten mit Finanzrecht „nur Business“ (04.10.) haben KEINEN Zugang zu den privaten Haushaltsfinanzen — nur die Business-Sicht der Finanzplanung.
  if (k?.finanzRecht === 'business') return null;
  return h && HAUSHALT_OK.test(h) ? { person, haushalt: h } : null;
}

/** Zugang zur Finanzplanung des Haushalts: welcher Haushalt und welche Datensicht — die Sicht entscheidet der Server aus dem Konto. */
export interface PlanZugang extends HaushaltZugang { sicht: 'privat' | 'business' }

/**
 * Finanzplanung (04.10. spät, Kevin: „im Business meine Planung haben … immer sehen können“): Wer zum Haushalt gehört, sieht ALLES
 * (Sicht „privat“ = voll) — in beiden Bereichen. Nur Konten mit `finanzRecht: 'business'` (Teammitglieder/Partner ohne Privatzugang,
 * spätere Kunden-Rollen) bekommen die Business-Sicht (Privat wird serverseitig herausgefiltert, Schreiben auf Privat → 403).
 * Entschieden wird NUR hier aus dem Konto — nie aus der Adresse.
 */
export async function planZugangFuer(person: string | null | undefined): Promise<PlanZugang | null> {
  if (!person) return null;
  const k = await kontoFuerSpeicher(person);
  const h = k?.haushalt;
  if (!h || !HAUSHALT_OK.test(h)) return null;
  return { person, haushalt: h, sicht: k?.finanzRecht === 'business' ? 'business' : 'privat' };
}
export async function planZugangVon(req: Request): Promise<PlanZugang | null> { return planZugangFuer(personStreng(req)); }

export const KEIN_ZUGANG = { ok: false, fehler: 'Kein Zugang zu den Haushaltsfinanzen. Der Inhaber schaltet ihn unter System → Konto frei.' };
