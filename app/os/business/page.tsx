import { Suspense } from 'react';
import { BusinessCockpit } from '@/components/os/business/BusinessCockpit';

// Business-Index (25.09.): liest den Link (?f= Firma, ?k= offene Kennzahl) — deshalb in Suspense.
export default function BusinessPage() {
  return <Suspense><BusinessCockpit /></Suspense>;
}
