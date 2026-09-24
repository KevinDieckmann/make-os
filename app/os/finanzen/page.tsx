import { Suspense } from 'react';
import { FinanzenView } from '@/components/os/FinanzenView';
export const metadata = { title: 'Zahlen · MAKE OS' };
export default function Page() { return <Suspense><FinanzenView /></Suspense>; }
