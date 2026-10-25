// ─── Öffentliche Formular-Seite „Angebot anfordern“ für externe Vertriebler (25.10.2026) ────────────────────────────────────────────────
// Ohne Sitzung erreichbar (middleware.ts `ANGEBOT_OFFEN`, nur diese Adresse und ihre Schnittstelle). Zeigt nur die freigegebenen Produkte des
// Links — keine Kundensuche, keine Bestandsdaten. Gedrosselt je Netz (wie die Buchungsseite); ein unbekannter, widerrufener oder abgelaufener Link
// sieht von außen gleich aus (404). Strenge Köpfe (kein Referrer, nicht indexieren) aus next.config.mjs.

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { AngebotAnfordernSeite } from '@/components/angebot/AngebotAnfordern';
import { linkSlugOk } from '@/lib/crm/formulare';
import { aktiverLink } from '@/lib/crm/formulare-server';
import { pruefe, fehlschlag, adresseAusKoepfen, netzVon } from '@/lib/zugang/drossel';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Props = { params: Promise<{ slug: string }> };
const SEITE_FREI = 40;

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Angebot anfordern', robots: { index: false, follow: false }, referrer: 'no-referrer' };
}

export default async function AngebotSeite({ params }: Props) {
  const { slug } = await params;
  const schluessel = `angebot-seite:${netzVon(adresseAusKoepfen(await headers()))}`;
  const p = pruefe(schluessel);
  if (!p.erlaubt) {
    return (
      <main style={{ maxWidth: 560, margin: '64px auto', padding: '0 16px', fontFamily: 'system-ui, sans-serif', lineHeight: 1.5 }}>
        <h1 style={{ fontSize: 20 }}>Gerade zu viele Aufrufe</h1>
        <p>Bitte in {Math.ceil(p.warteSek / 60)} Min. noch einmal versuchen.</p>
      </main>
    );
  }
  fehlschlag(schluessel, Date.now(), SEITE_FREI);
  if (!linkSlugOk(slug) || !(await aktiverLink(slug))) notFound();
  return <AngebotAnfordernSeite slug={slug} />;
}
