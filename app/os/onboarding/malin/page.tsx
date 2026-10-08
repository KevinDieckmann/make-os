import { SpurView } from '@/components/os/OnboardingView';

// Spur „Zweite Person“ — die Kennung `malin` bleibt nur als Adresse (alte Links und Häkchen), sichtbar ist die Rolle (08.10. spät).
export const metadata = { title: 'Einrichtung · Zweite Person · MAKE OS' };

export default function Page() {
  return <SpurView spur="malin" />;
}
