// Ausgeschalteter Check (oder gedrosselt): neutrale Seite ohne Namen der Anwendung — auch unter der Adresse der Website (30.10.).
import type { Metadata } from 'next';
import { NichtDa } from '@/components/oeffentlich/NichtDa';

export const metadata: Metadata = { title: 'Seite nicht gefunden', robots: { index: false, follow: false }, referrer: 'no-referrer' };

export default function CheckNichtDa() {
  return <NichtDa text="Der Check ist im Moment nicht erreichbar. Bitte versuchen Sie es später noch einmal." />;
}
