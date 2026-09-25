// ─── Kalender — wer darf? ───────────────────────────────────────────────────
// Der Kalender ist der des Inhabers (sein iCloud-Konto): Termine, Fristen,
// Zahlungen. Sehen und ändern darf ihn, wer im SELBEN Haushalt ist wie der
// Inhaber (Kevin & Malin) — ein anderer Haushalt (z. B. der Test-Haushalt)
// oder ein Konto ohne Haushalt nicht. Dazu der Dienstweg (Arbeiter,
// Zulieferer, Jarvis im Hintergrund), den die Middleware am Schlüssel erkennt.

import { ladeKonten } from '@/lib/zugang/konten';

export const KEIN_KALENDER = { ok: false, fehler: 'Kein Zugang zum Kalender — er gehört zum Haushalt des Inhabers (System → Konto).' };

export async function kalenderZugang(req: Request): Promise<{ person: string; dienst: boolean } | null> {
  const schluessel = process.env.MAKE_OS_KEY;
  if (schluessel && req.headers.get('x-make-key') === schluessel) {
    const p = req.headers.get('x-make-person');
    return { person: p && /^[a-z0-9-]{1,40}$/.test(p) ? p : 'kevin', dienst: true };
  }
  const person = req.headers.get('x-make-user');
  if (!person || !/^[a-z0-9-]{1,40}$/.test(person)) return null;
  const { konten } = await ladeKonten();
  const inhaber = konten.find(k => k.rolle === 'inhaber');
  const ich = konten.find(k => k.speicher === person);
  if (!inhaber || !ich) return null;
  if (ich.speicher === inhaber.speicher) return { person, dienst: false };
  return inhaber.haushalt && ich.haushalt === inhaber.haushalt ? { person, dienst: false } : null;
}
