import { EbeneView } from '@/components/os/OnboardingView';

// Ebene „gemeinsam“ — Haushalt und Firmen: eine Person trägt ein, alle sehen den Stand (B1, 09.10.).
export const metadata = { title: 'Einrichtung · Gemeinsam · MAKE OS' };

export default function Page() {
  return <EbeneView ebene="gemeinsam" />;
}
