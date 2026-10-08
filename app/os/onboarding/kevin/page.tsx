import { SpurView } from '@/components/os/OnboardingView';

// Spur „Inhaber“ — die Kennung `kevin` bleibt nur als Adresse (alte Links und Häkchen), sichtbar ist die Rolle (08.10. spät).
export const metadata = { title: 'Einrichtung · Inhaber · MAKE OS' };

export default function Page() {
  return <SpurView spur="kevin" />;
}
