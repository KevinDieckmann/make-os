import { ZoeStart } from '@/components/os/ZoeStart';
import { wache } from '@/lib/zugang/wache';

export const metadata = { title: 'ZOE · MAKE OS' };
// Hinter der Anmeldung: je Anfrage bauen, nie beim Bauen vorab (die Wache liest das Cookie).
export const dynamic = 'force-dynamic';

// Bewusst AUSSERHALB von /os: der Empfang ist eine ganze Fläche, keine Seite
// mit Seitenleiste. Wer Zahlen sehen will, geht von hier eine Ebene tiefer.
export default async function Page() {
  await wache('/zoe');
  return <ZoeStart />;
}
