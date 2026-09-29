// ─── Öffentliche Buchungsseite — Status des Buchenden (29.09., Paket K4) ─────
// Adresse /buchen/<slug>/status#<token>: das Token steht nur im Fragment (geht nie an den Server, nicht ins Log);
// die Seite schickt es im Körper an /api/buchung/<slug>/status. Bestätigen (Double-Opt-in-Ersatz), Status sehen, absagen.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BuchungStatus } from '@/components/buchen/BuchungStatus';
import { slugOk } from '@/lib/kalender/buchung';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Ihre Terminanfrage', robots: { index: false, follow: false }, referrer: 'no-referrer' };

export default async function StatusSeite({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!slugOk(slug)) notFound();
  return <BuchungStatus slug={slug} />;
}
