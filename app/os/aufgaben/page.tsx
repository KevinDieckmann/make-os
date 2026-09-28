import { Suspense } from 'react';
import { AufgabenRaum } from '@/components/os/aufgaben/AufgabenRaum';
// Aufgaben wie Monday/ClickUp (28.09. abends): Bereich › Space › Projekt › Liste › Aufgabe › Unteraufgabe.
export default function AufgabenPage() { return <Suspense><AufgabenRaum /></Suspense>; }
