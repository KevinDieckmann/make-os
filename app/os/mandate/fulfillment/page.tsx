import { Suspense } from 'react';
import { FulfillmentSeite } from '@/components/os/fulfillment/FulfillmentSeite';

export const metadata = { title: 'Fulfillment · MAKE OS' };

export default function FulfillmentPage() {
  return <Suspense><FulfillmentSeite /></Suspense>;
}
