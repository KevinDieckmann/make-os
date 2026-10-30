// Unbekannte oder abgeschaltete Buchungsseite: neutrale Seite ohne Namen der Anwendung — auch unter der Adresse der Website (30.10.).
import type { Metadata } from 'next';
import { NichtDa } from '@/components/oeffentlich/NichtDa';

export const metadata: Metadata = { title: 'Seite nicht gefunden', robots: { index: false, follow: false }, referrer: 'no-referrer' };

export default function BuchungNichtDa() {
  return <NichtDa text="Diese Buchungsseite ist nicht (mehr) erreichbar. Bitte fragen Sie nach einem neuen Link." />;
}
