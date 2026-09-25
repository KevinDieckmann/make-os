import { Suspense } from 'react';
import { ProdukteMandate } from '@/components/os/mandate/ProdukteMandate';

export const metadata = { title: 'Produkte & Mandate · MAKE OS' };

export default function MandatePage() {
  return <Suspense><ProdukteMandate /></Suspense>;
}
