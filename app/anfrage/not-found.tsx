// Ausgeschaltetes Kontaktformular (oder gedrosselt): neutrale Seite ohne Namen der Anwendung — auch unter der Adresse der Website (31.10.).
import type { Metadata } from 'next';
import { NichtDa } from '@/components/oeffentlich/NichtDa';
import { OEFFENTLICH_META } from '@/lib/oeffentlich/metadaten';

export const metadata: Metadata = { ...OEFFENTLICH_META, title: 'Seite nicht gefunden' };

export default function KontaktformularNichtDa() {
  return <NichtDa text="Das Kontaktformular ist im Moment nicht erreichbar. Bitte versuchen Sie es später noch einmal." />;
}
