import { Kalender } from '@/components/os/kalender/Kalender';
import { HandlungProvider } from '@/components/os/aufgaben/Handlung';

// K3 (30.09.): Aufgaben im Kalender abhaken/verschieben mit Rückfrage und „Rückgängig“ — derselbe HandlungProvider wie
// auf der Aufgaben-Seite (components/os/aufgaben/Handlung.tsx).
export default function KalenderPage() {
  return <HandlungProvider><Kalender /></HandlungProvider>;
}
