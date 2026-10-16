// ─── MAKE OS — Sitzung in die Antwort schreiben ─────────────────────────────
import { NextResponse } from 'next/server';
import { SITZUNG_COOKIE, WER_COOKIE, SITZUNG_TAGE, sitzungAusstellen, sitzungsGeheimnis, kontoStand, cookieNurHttps } from './sitzung';
import type { Konto } from './konten';
import { oeffentlich } from './konten';

/** Hinter HTTPS (Server) dürfen die Cookies nur verschlüsselt reisen — die Regel steht seit 16.10. EINMAL in sitzung.ts (auch fürs Geräte-Cookie). */
const nurHttps = cookieNurHttps;

export async function mitSitzung(konto: Konto, extra: Record<string, unknown> = {}): Promise<NextResponse> {
  const zettel = await sitzungAusstellen(sitzungsGeheimnis(), konto.speicher, await kontoStand(konto.salz));
  const res = NextResponse.json({ ok: true, konto: oeffentlich(konto), ...extra });
  const alter = 60 * 60 * 24 * SITZUNG_TAGE;
  res.cookies.set(SITZUNG_COOKIE, zettel, { httpOnly: true, sameSite: 'lax', maxAge: alter, path: '/', secure: nurHttps() });
  // Nicht geheim: der Browser zeigt damit den Namen, ohne erst zu fragen.
  res.cookies.set(WER_COOKIE, konto.speicher, { httpOnly: false, sameSite: 'lax', maxAge: alter, path: '/', secure: nurHttps() });
  // Das alte Schlüssel-Cookie (vor 23.09.) hat ausgedient.
  res.cookies.set('make-os-zutritt', '', { maxAge: 0, path: '/' });
  res.cookies.set('make-os-person', '', { maxAge: 0, path: '/' });
  return res;
}

export function ohneSitzung(): NextResponse {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SITZUNG_COOKIE, '', { maxAge: 0, path: '/' });
  res.cookies.set(WER_COOKIE, '', { maxAge: 0, path: '/' });
  return res;
}
