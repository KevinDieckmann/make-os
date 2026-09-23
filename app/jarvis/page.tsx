import { JarvisStart } from '@/components/os/JarvisStart';
import { wache } from '@/lib/zugang/wache';

export const metadata = { title: 'Jarvis · MAKE OS' };

// Bewusst AUSSERHALB von /os: der Empfang ist eine ganze Fläche, keine Seite
// mit Seitenleiste. Wer Zahlen sehen will, geht von hier eine Ebene tiefer.
export default async function Page() {
  await wache('/jarvis');
  return <JarvisStart />;
}
