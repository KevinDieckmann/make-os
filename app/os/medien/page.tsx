// Fotos & Videos (09.10., Paket 5 „Medien unterwegs“) — aufnehmen, ordnen, fürs Marketing freigeben, an Heads geben.
import { Suspense } from 'react';
import { MedienSeite } from '@/components/os/medien/MedienSeite';

export const dynamic = 'force-dynamic';

export default function MedienPage() {
  return (
    <Suspense fallback={null}>
      <MedienSeite />
    </Suspense>
  );
}
