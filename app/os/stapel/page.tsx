import { Suspense } from 'react';
import { StapelView } from '@/components/os/StapelView';

export const metadata = { title: 'ZOE · Aufträge & Freigaben' };

// Reiter „Offen“ · „Protokoll“ (?t=protokoll, 08.10.) — die Ansicht liest die Adresse (useSearchParams), darum Suspense.
export default function Page() {
  return <Suspense><StapelView /></Suspense>;
}
