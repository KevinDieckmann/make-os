import { Suspense } from 'react';
import { AgentenSeite } from '@/components/os/agenten/AgentenSeite';

export const metadata = { title: 'ZOE · Agenten' };

// Agenten-Bereich (09.10., Paket 2 „Oberfläche“, AGENTEN_KONZEPT.md C2/C11): ZOE, Heads, Mitarbeiter, Threads, Skills,
// Hintergrundaufgaben. Die Ansicht liest die Adresse (`h`, `f` über WEG.agenten) — darum Suspense. Die bisherige Übersicht
// (AgentenView) bleibt unter „⋯ › Bisherige Übersicht“ erreichbar.
export default function AgentenPage() {
  return <Suspense><AgentenSeite /></Suspense>;
}
