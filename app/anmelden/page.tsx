import { Suspense } from 'react';
import { Anmelden } from '@/components/zugang/Anmelden';

export const metadata = { title: 'Anmelden · MAKE OS' };

// Suspense, weil useSearchParams beim Vorrendern sonst die ganze Seite
// dynamisch macht — hier soll nur das Formular auf die Adresse schauen.
export default function AnmeldenSeite() {
  return <Suspense><Anmelden /></Suspense>;
}
