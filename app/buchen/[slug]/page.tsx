// ─── Öffentliche Buchungsseite (29.09., Paket K4) ───────────────────────────
// „30 min mit Kevin“: freie Plätze wählen, Name + E-Mail (+ Firma, Anliegen), Einwilligung mit Wortlaut und Fassung.
// Ohne Sitzung erreichbar (middleware.ts, nur diese Adresse und ihre Status-Seite). Zeigt nur freie Zeiten — keine
// Termininhalte, keine Namen, keinen Ort (den sieht der Buchende erst nach der Freigabe auf seiner Status-Seite).

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Buchen } from '@/components/buchen/Buchen';
import { slugOk } from '@/lib/kalender/buchung';
import { ladeBuchungBestand } from '@/lib/kalender/buchung-speicher';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Props = { params: Promise<{ slug: string }> };

async function seiteFuer(slug: string) {
  if (!slugOk(slug)) return null;
  return (await ladeBuchungBestand()).seiten.find(s => s.slug === slug && s.aktiv) ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const s = await seiteFuer((await params).slug);
  return { title: s ? `${s.titel} · Termin buchen` : 'Termin buchen', robots: { index: false, follow: false }, referrer: 'no-referrer' };
}

export default async function BuchenSeite({ params }: Props) {
  const { slug } = await params;
  if (!(await seiteFuer(slug))) notFound();
  return <Buchen slug={slug} />;
}
