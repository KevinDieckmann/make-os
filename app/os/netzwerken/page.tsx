import { Suspense } from 'react';
import { NetzwerkenSeite } from '@/components/os/netzwerken/Netzwerken';

// Netzwerken (02.10.): Karte fotografieren, Person erfassen, Abendbericht — handyzuerst. `?bericht=<Event>` öffnet den Abendbericht.
export default function NetzwerkenPage() {
  return <Suspense><NetzwerkenSeite /></Suspense>;
}
