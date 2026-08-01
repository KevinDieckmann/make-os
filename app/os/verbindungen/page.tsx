import { Suspense } from 'react';
import { VerbindungenView } from '@/components/os/VerbindungenView';

export const metadata = { title: 'Verbindungen — MAKE OS' };

export default function VerbindungenPage() {
  // Suspense: VerbindungenView liest useSearchParams (status nach dem Callback).
  return (
    <Suspense fallback={null}>
      <VerbindungenView />
    </Suspense>
  );
}
