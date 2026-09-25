import { Suspense } from 'react';
import { BauplanBoard } from '@/components/os/bauplan/BauplanBoard';

// Der Bauplan liest den Link (?k= offene Karte, ?s=plan Planung) — deshalb in Suspense.
export default function BauplanPage() {
  return <Suspense><BauplanBoard /></Suspense>;
}
