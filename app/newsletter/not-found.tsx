// Ausgeschaltete Newsletter-Anmeldung (oder gedrosselt): neutrale Seite ohne Namen der Anwendung — auch unter der Adresse der Website (30.10.).
import type { Metadata } from 'next';
import { NichtDa } from '@/components/oeffentlich/NichtDa';
import { OEFFENTLICH_META } from '@/lib/oeffentlich/metadaten';

export const metadata: Metadata = { ...OEFFENTLICH_META, title: 'Seite nicht gefunden' };

export default function NewsletterNichtDa() {
  return <NichtDa text="Die Anmeldung zum Newsletter ist im Moment nicht erreichbar. Bitte versuchen Sie es später noch einmal." />;
}
