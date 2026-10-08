import { EbeneView } from '@/components/os/OnboardingView';

// Ebene „instanz“ — Server, Sicherheit, Einstellungen: die Schritte zeigt die Seite nur Inhabern (jedem Inhaber, R9); die Befunde
// filtert ohnehin der Server (andere sehen nur „Instanz eingerichtet: ja/nein“) (B1, 09.10.).
export const metadata = { title: 'Einrichtung · Instanz · MAKE OS' };

export default function Page() {
  return <EbeneView ebene="instanz" />;
}
