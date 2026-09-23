import { redirect } from 'next/navigation';

// Die Fokus-Regler leben seit 02.08. im Kompass — dort stehen Prioritäten,
// Fokus und Regler an einem Ort. Alte Verweise laufen so nicht ins Leere.
export default function FokusReglerPage() {
  redirect('/os/kompass');
}
