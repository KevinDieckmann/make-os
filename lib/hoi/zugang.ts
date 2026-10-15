// ─── Wer sieht den Head of IT? (15.10., Abnahme 2 B8) ────────────────────────────────────────────────────────────────────────────────────
// CLAUDE.md: „Malin und Kevin haben beide vollen Zugriff auf alles in diesem System.“ Die Sicherheitslage sehen darum alle VOLLEN Mitglieder im
// Haushalt des Inhabers — nie ein Konto „nur Business“ (`finanzRecht: 'business'`, EINE Konto-Sicht), kein fremder Haushalt, kein Testkunde.
// Dazu der eingeschränkte HOI-Schlüssel (`x-make-hoi: 1`, setzt nur die Middleware). Vorher: jedes Konto im Haushalt, auch „nur Business“.
// Genutzt von /api/hoi/{lage,aussen,csp} (GET); Wächter tests/nur-business-sicht.test.ts.

import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { privatAusgeblendetFuer } from '@/lib/zugang/konto-sicht-server';

export async function hoiSehen(req: Request): Promise<boolean> {
  if (req.headers.get('x-make-hoi') === '1') return true;
  const z = await imHaushaltDesInhabers(req);
  if (!z) return false;
  // Unlesbare Konten → wie „nur Business“ (fail-closed).
  return !(await privatAusgeblendetFuer(z.person).catch(() => true));
}
