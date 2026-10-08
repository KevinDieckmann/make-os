import { EbeneView } from '@/components/os/OnboardingView';

// Ebene „ich“ — „Meine Einrichtung“: jede Person für sich, Prüfung und Häkchen gelten nur der Person der Sitzung (B1, 09.10.).
export const metadata = { title: 'Einrichtung · Meine Einrichtung · MAKE OS' };

export default function Page() {
  return <EbeneView ebene="ich" />;
}
