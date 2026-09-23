// ─── MAKE OS — Die Wache vor den Seiten ─────────────────────────────────────
// Die Middleware prüft die Unterschrift der Sitzung, aber sie kann keine
// Dateien lesen — sie weiß also nicht, ob das Konto noch existiert. Für die
// Seiten prüft das diese Wache (Server-Komponente, darf lesen): gibt es das
// Konto nicht mehr, geht es zur Anmeldung.
//
// Für die Schnittstellen reicht die Unterschrift: Sitzungen laufen nach 30
// Tagen ab, und ein gelöschtes Konto ist der seltene Fall. Wer ihn hart
// braucht, wechselt das SESSION_SECRET — dann sind alle Zettel ungültig.

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SITZUNG_COOKIE, sitzungPruefen, sitzungsGeheimnis } from './sitzung';
import { kontoFuerSpeicher, type Konto } from './konten';

export async function angemeldetesKonto(): Promise<Konto | null> {
  const zettel = cookies().get(SITZUNG_COOKIE)?.value;
  const s = await sitzungPruefen(sitzungsGeheimnis(), zettel);
  if (!s) return null;
  return (await kontoFuerSpeicher(s.speicher)) ?? null;
}

/** In einer Seite aufrufen: leitet um, wenn niemand (mehr) angemeldet ist. */
export async function wache(zu = '/'): Promise<Konto> {
  const k = await angemeldetesKonto();
  if (!k) redirect(`/anmelden?zu=${encodeURIComponent(zu)}`);
  return k;
}
