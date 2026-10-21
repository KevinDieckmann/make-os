import { Suspense } from 'react';
import { ProzesseSeite } from '@/components/os/prozesse/ProzesseSeite';

export const metadata = { title: 'Prozesse · MAKE OS' };

export default function ProzessePage() {
  return <Suspense><ProzesseSeite /></Suspense>;
}
