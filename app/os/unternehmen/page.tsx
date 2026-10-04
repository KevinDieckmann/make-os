import { Suspense } from 'react';
import { UnternehmenView } from '@/components/os/unternehmen/UnternehmenView';

export const metadata = { title: 'Unternehmen · MAKE OS' };

export default function UnternehmenPage() {
  return <Suspense><UnternehmenView /></Suspense>;
}
