// ─── Abmelden — öffentliche Seite des Abmeldelinks (05.10., Betroffenenrechte v2; lib/datenschutz/abmelden.ts) ────────────────
// Ohne Anmeldung (middleware.ts `ABMELDE_OFFEN`, nur Token der Form `a1-<32 hex>`). Zeigt NIE Daten — weder Adresse noch Name, nicht
// einmal, ob das Token passt. Abgemeldet wird erst mit dem Knopf (POST), damit Link-Prüfer in Postfächern niemanden abmelden; die
// One-Click-Abmeldung der Mail-Anbieter (RFC 8058) geht direkt an die Schnittstelle.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Abmelden } from '@/components/abmelden/Abmelden';
import { ABMELDE_TOKEN } from '@/lib/datenschutz/abmelden';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const metadata: Metadata = { title: 'Abmelden', robots: { index: false, follow: false }, referrer: 'no-referrer' };

type Props = { params: Promise<{ token: string }> };

export default async function AbmeldenSeite({ params }: Props) {
  const { token } = await params;
  if (!ABMELDE_TOKEN.test(token)) notFound();
  return <Abmelden token={token} />;
}
