// Unbekannte oder abgeschaltete Buchungsseite: neutrale Seite ohne Namen der Anwendung — auch unter der Adresse der Website (30.10.).
import type { Metadata } from 'next';
import { NichtDa } from '@/components/oeffentlich/NichtDa';
import { OEFFENTLICH_META } from '@/lib/oeffentlich/metadaten';

export const metadata: Metadata = { ...OEFFENTLICH_META, title: 'Seite nicht gefunden' };

export default function BuchungNichtDa() {
  return <NichtDa text="Diese Buchungsseite ist nicht (mehr) erreichbar. Bitte fragen Sie nach einem neuen Link." />;
}
